/**
 * dsh-theme-studio 的 HTTP 层（纯 node:http，不依赖 Cordis，可独立起服务自测）。
 *
 * 路由（前缀可配，默认 /dsh-theme-studio）：
 *   GET    /api/state            当前文档 + 素材索引 + 预设 + 写口令
 *   PUT    /api/state            保存文档（需写口令）
 *   POST   /api/preset           应用内置预设 {id}
 *   POST   /api/media            上传素材：请求体就是原始字节，不打包、不转码
 *   DELETE /api/media/<id>       删除素材（?force=1 跳过引用检查）
 *   GET    /media/<id>/<name>    原样回吐素材：Accept-Ranges / 206 / 强缓存 / ETag
 *   GET    /api/usage            存储用量
 *   GET    /api/export           导出当前主题为 JSON
 *   POST   /api/import           导入主题 JSON {doc, mode:'replace'|'merge'}
 *   GET    /api/themes           已存主题档列表
 *   POST   /api/themes           把当前文档存成主题档 {name}
 *   POST   /api/themes/load      载入某个主题档 {slug}
 *   DELETE /api/themes/<slug>    删除本机主题档（需写口令）
 *   GET    /api/events           SSE：任一标签页改动，其它标签页即时跟随
 *
 * 写口令：每次 Host 进程随机生成，随 index.html 注入下发。同源页面天然拿得到，
 * 跨源页面拿不到（也就无法往本机写文件或改主题）。素材读取保持公开：
 * <img>/<video> 发起的子资源请求不会带自定义头，而素材 id 由内容哈希派生、不可枚举。
 *
 * @module dsh-theme-studio/http
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createHash, timingSafeEqual } from 'node:crypto'
import { extname } from 'node:path'

import { HttpError, MEDIA_TYPES } from './store.js'
import { GRADIENTS, GLASS_SURFACES, PRESETS, TOKEN_GROUPS, applyPreset, buildCss, buildTokenLayers, mediaUrl, normalizeDoc } from './engine.js'

const MAX_JSON_BYTES = 8 * 1024 * 1024
const RANGE_RE = /^bytes=(\d*)-(\d*)$/
const WRITE_METHODS = new Set(['PUT', 'POST', 'DELETE'])

/**
 * Host 白名单。桌面端经 Electron 转发的请求会剥掉 Host 头（缺失 = 放行，
 * 这是桌面端的常态路径）；直接以 127.0.0.1 / localhost / ::1 访问本机也放行。
 * 其余一律 421 —— DNS rebinding 会把 attacker.com 解析到 127.0.0.1，请求带着
 * attacker.com 的 Host 头进来，Host 校验是唯一天然拆穿它的点。
 * （web 浏览器直连部署已随 web 端废弃：曾有的 DSH_THEME_STUDIO_TRUST_HOSTS
 * 与局域网 IP 直访分支一并移除。）
 */
function hostAllowed(req) {
  const raw = req.headers?.host
  if (typeof raw !== 'string' || raw === '') return true
  let host = raw.trim().toLowerCase()
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    host = end === -1 ? host.slice(1) : host.slice(1, end)
  } else {
    const colon = host.indexOf(':')
    if (colon > 0 && host.indexOf(':', colon + 1) === -1) host = host.slice(0, colon)
  }
  return host === '' || host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

/** 写请求的第二道闸：浏览器跨站请求一定带 Origin，与 Host 不一致即拒绝。 */
function originAllowed(req) {
  const origin = req.headers?.origin
  if (typeof origin !== 'string' || origin === '') return true
  // Origin: null 来自沙箱 iframe / file:// 页面 —— 同源写请求从不发这个值，
  // 它只会出现在"来源不可信"的语境里，直接拒绝（此前与放行同义，闸门空转）。
  if (origin === 'null') return false
  let originHost = ''
  try { originHost = new URL(origin).host.toLowerCase() } catch { return false }
  return originHost !== '' && originHost === String(req.headers?.host ?? '').toLowerCase()
}

/** 扩展名 → MIME 的回退表（素材元数据缺失时用）。 */
const EXT_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska', '.ts': 'video/mp2t',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
}

/**
 * 一次成型的状态投影：文档 + 素材 + 可直接落地的 CSS 与令牌层。
 * Host 与 Client 因此共用同一份引擎产物，浏览器不再复刻任何配色逻辑。
 * 令牌层可能只填了明暗中的一侧，由浏览器半用页面基准值补齐。
 * @param {import('./store.js').ThemeStore} store
 * @param {string} prefix
 */
function projection(store, prefix) {
  const doc = store.state.doc
  const mediaUrlFor = (id) => `${prefix}/media/${encodeURIComponent(id)}/`
  return {
    revision: store.state.revision,
    doc,
    media: store.state.media,
    css: buildCss(doc, { mediaUrlFor, prefix, media: store.state.media }),
    tokenLayers: buildTokenLayers(doc),
    tokenGroups: TOKEN_GROUPS,
    // 玻璃要重铸哪些表面：由 Host 说一次，浏览器不再自带一份清单。
    glassSurfaces: GLASS_SURFACES,
    presets: PRESETS,
    gradients: GRADIENTS,
    mediaTypes: Object.keys(MEDIA_TYPES),
  }
}

/**
 * @param {object} options
 * @param {import('./store.js').ThemeStore} options.store
 * @param {string} [options.prefix]
 * @param {{requestRejection?:(request:object)=>unknown}} [options.connection]
 *   DSH 的 Host Connection 句柄；存在时对写请求追加浏览器会话校验。
 * @param {number} [options.keepAliveMs] SSE keepalive 周期，默认 25s（测试可调短）。
 */
export function createThemeStudioHttp({ store, prefix = '/dsh-theme-studio', connection, keepAliveMs = 25_000 }) {
  const route = (sub) => `${prefix}${sub}`
  /** @type {Set<import('node:http').ServerResponse>} */
  const clients = new Set()
  /** SSE 订阅上限：无界集合会让本机任意进程/跨源 EventSource 钉死 socket 与 keepalive。 */
  const MAX_EVENT_CLIENTS = 64

  function requireWriteKey(req) {
    const supplied = req.headers['x-dts-key']
    if (typeof supplied !== 'string' || supplied.length === 0) {
      throw new HttpError(401, '缺少写口令 x-dts-key：刷新页面后重试')
    }
    if (!timingSafeEquals(supplied, store.writeToken)) throw new HttpError(403, '写口令不匹配')
    const rejection = connection?.requestRejection?.({ headers: req.headers, method: req.method, url: req.url })
    if (typeof rejection === 'number' && rejection !== 0) {
      throw new HttpError(rejection, 'DSH 浏览器会话未通过')
    }
  }

  /** 事件流广播：一次改动，所有已打开的界面同步跟上。 */
  function broadcast() {
    const payload = `data: ${JSON.stringify({ revision: store.state.revision })}\n\n`
    for (const client of clients) client.write(payload)
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function handle(req, res) {
    const rawUrl = req.url ?? '/'
    const qIndex = rawUrl.indexOf('?')
    const path = (qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex)).replace(/\/+$/, '') || '/'
    const query = new URLSearchParams(qIndex === -1 ? '' : rawUrl.slice(qIndex + 1))
    const method = (req.method ?? 'GET').toUpperCase()
    try {
      if (!hostAllowed(req)) {
        throw new HttpError(421, 'Host 不在允许清单（拦截 DNS rebinding）：请通过 127.0.0.1 / localhost 访问')
      }
      if (WRITE_METHODS.has(method) && !originAllowed(req)) {
        throw new HttpError(403, '跨站来源被拒绝（Origin 与 Host 不一致）')
      }
      if (method === 'OPTIONS') {
        writeHead(res, 204, { allow: 'GET, HEAD, PUT, POST, DELETE, OPTIONS' })
        res.end()
        return
      }
      // 存储初始化是异步的：没就绪就报 503，别让 null state 在 projection 里炸成 500。
      if (store.state === null) {
        throw new HttpError(503, 'theme-studio 存储仍在初始化，稍后重试')
      }

      if ((method === 'GET' || method === 'HEAD') && path === route('/api/state')) {
        // 写口令只回显给已持口令的调用方（自证刷新）：被动 GET 不递口令 ——
        // curl / 任意脚本没有同源策略，曾经「GET state 即得口令」等于网络可达即可写。
        const supplied = req.headers['x-dts-key']
        const holder = typeof supplied === 'string' && supplied.length > 0
          && timingSafeEquals(supplied, store.writeToken)
        return json(res, {
          ok: true,
          value: {
            ...projection(store, prefix),
            ...(holder ? { writeToken: store.writeToken } : {}),
            maxUploadBytes: store.maxUploadBytes,
            prefix,
            serverTime: Date.now(),
          },
        })
      }

      if (method === 'PUT' && path === route('/api/state')) {
        requireWriteKey(req)
        const body = await readJson(req)
        const doc = normalizeDoc(body?.doc ?? body)
        await store.saveDoc(doc, { expectRevision: body?.expectRevision })
        broadcast()
        return json(res, { ok: true, value: projection(store, prefix) })
      }

      if (method === 'POST' && path === route('/api/preset')) {
        requireWriteKey(req)
        const body = await readJson(req)
        const next = applyPreset(store.state.doc, String(body?.id ?? ''))
        await store.saveDoc(next)
        broadcast()
        return json(res, { ok: true, value: projection(store, prefix) })
      }

      if (method === 'POST' && path === route('/api/media')) {
        requireWriteKey(req)
        const name = query.get('name') ?? (typeof req.headers['x-dts-name'] === 'string' ? req.headers['x-dts-name'] : undefined)
        const record = await store.ingest(req, { name })
        broadcast()
        return json(res, { ok: true, value: { media: record, url: mediaUrl(record, prefix) } }, 201)
      }

      if (method === 'DELETE' && path.startsWith(route('/api/media/'))) {
        requireWriteKey(req)
        const id = decodeSafe(path.slice(route('/api/media/').length))
        const value = await store.removeMedia(id, { force: query.get('force') === '1' })
        broadcast()
        return json(res, { ok: true, value })
      }

      if ((method === 'GET' || method === 'HEAD') && path === route('/api/usage')) {
        return json(res, { ok: true, value: await store.usage() })
      }

      if ((method === 'GET' || method === 'HEAD') && path === route('/api/export')) {
        const text = JSON.stringify({ kind: 'dsh-theme-studio', version: 1, exportedAt: Date.now(), doc: store.state.doc }, null, 2)
        writeHead(res, 200, {
          'content-type': 'application/json; charset=utf-8',
          'content-length': String(Buffer.byteLength(text)),
          'content-disposition': `attachment; filename="dsh-theme.json"; filename*=UTF-8''${encodeURIComponent('dsh-主题.json')}`,
          'cache-control': 'no-store',
        })
        res.end(method === 'HEAD' ? undefined : text)
        return
      }

      if (method === 'POST' && path === route('/api/import')) {
        requireWriteKey(req)
        const body = await readJson(req)
        const incoming = body?.doc ?? body
        const merged = query.get('mode') === 'merge'
          ? normalizeDoc({ ...store.state.doc, ...asObject(incoming) })
          : normalizeDoc(incoming)
        await store.saveDoc(merged)
        broadcast()
        return json(res, { ok: true, value: projection(store, prefix) })
      }

      if ((method === 'GET' || method === 'HEAD') && path === route('/api/themes')) {
        return json(res, { ok: true, value: { themes: await store.listThemeFiles() } })
      }

      if (method === 'POST' && path === route('/api/themes')) {
        requireWriteKey(req)
        const body = await readJson(req)
        // overwrite 显式传才允许盖档：safeName 消毒碰撞（'午夜?深蓝' → '午夜深蓝'）
        // 靠本地查重拦不住，决定权收在服务端 409 + UI 确认这条链上。
        return json(res, { ok: true, value: await store.saveThemeFile(body?.name, { overwrite: body?.overwrite === true }) }, 201)
      }

      if (method === 'POST' && path === route('/api/themes/load')) {
        requireWriteKey(req)
        const body = await readJson(req)
        const doc = normalizeDoc(await store.readThemeFile(String(body?.slug ?? '')))
        await store.saveDoc(doc)
        broadcast()
        return json(res, { ok: true, value: projection(store, prefix) })
      }

      if (method === 'DELETE' && path.startsWith(route('/api/themes/'))) {
        requireWriteKey(req)
        const rest = path.slice(route('/api/themes/').length)
        let slug = rest
        try { slug = decodeURIComponent(rest) } catch { /* 非法转义按原样进 safeName 消毒 */ }
        if (slug === '' || slug === 'load') throw new HttpError(400, '缺少主题档名')
        return json(res, { ok: true, value: await store.removeThemeFile(slug) })
      }

      if ((method === 'GET' || method === 'HEAD') && path.startsWith(route('/media/'))) {
        await serveMedia(req, res, path.slice(route('/media/').length))
        return
      }

      if (method === 'GET' && path === route('/api/events')) {
        openEvents(req, res)
        return
      }

      writeHead(res, 404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ok: false, error: { message: 'no such route' } }))
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      // 503（初始化窗口）是预期状态，不算处理失败，不打错误栈。
      if (status >= 500 && status !== 503) console.error('[dsh-theme-studio] 请求处理失败', error)
      // 先快照"头是否已发"再写头：writeHead 会把 headersSent 置真，顺序反了
      // 就会走成"永远断开、永远不发 body"（实测把 4xx 全部变成连接重置）。
      const alreadyStarted = res.headersSent === true
      if (!alreadyStarted) {
        writeHead(res, status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      }
      // 非 HttpError 的意外异常不回显 message：fs 错误会内嵌服务器绝对路径，
      // 与 usage/themes 接口"不外泄路径"的口径自相矛盾。细节已在上一行进日志。
      const message = error instanceof HttpError
        ? error.message
        : status === 503 ? 'theme-studio 存储仍在初始化，稍后重试' : 'theme-studio internal error'
      if (alreadyStarted) {
        // 头已发（流式中途抛错）：无法再补状态码，也不该往已写一半的 body 里
        // 追加 JSON —— 干脆断开，让客户端按网络错误处理。
        res.destroy()
        return
      }
      res.end(JSON.stringify({ ok: false, error: { message, status } }))
    }
  }

  function openEvents(req, res) {
    // 超上限先挤掉最早的一路：正常使用远到不了这个量级（每标签页一路）。
    while (clients.size >= MAX_EVENT_CLIENTS) {
      const oldest = clients.values().next().value
      if (oldest === undefined) break
      clients.delete(oldest)
      try { oldest.destroy() } catch { /* 已断开 */ }
    }
    writeHead(res, 200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write(': dsh-theme-studio\n\n')
    clients.add(res)
    // keepalive 只写自己的连接：曾对 clients 全体广播，N 个标签页 = N² 次写。
    const keepAlive = setInterval(() => {
      res.write(': ping\n\n')
    }, keepAliveMs)
    const close = () => {
      clients.delete(res)
      clearInterval(keepAlive)
    }
    req.on('close', close)
    res.on('error', close)
  }

  /**
   * 素材原样回吐。内容寻址 → 一年强缓存；Range → 4K 视频任意拖动不回源。
   * 这里不做任何转码/缩放：浏览器拿到的字节与用户选的文件逐字节相同。
   */
  async function serveMedia(req, res, rest) {
    const slash = rest.indexOf('/')
    const id = decodeSafe(slash === -1 ? rest : rest.slice(0, slash))
    const meta = store.mediaMeta(id)
    if (meta === undefined) throw new HttpError(404, '素材不存在')
    const absolute = store.absoluteOf(meta)
    const info = await stat(absolute).catch(() => null)
    if (info === null || !info.isFile()) throw new HttpError(404, '素材文件缺失')
    const mime = meta.mime ?? EXT_MIME[extname(meta.id).toLowerCase()] ?? 'application/octet-stream'
    const etag = `"${meta.sha256 ?? `${String(Math.round(info.mtimeMs))}-${String(info.size)}`}"`
    const isSvg = mime === 'image/svg+xml'
    const headers = {
      'content-type': mime,
      'accept-ranges': 'bytes',
      etag,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      // SVG 是"能带脚本的图片"：直接导航（文档渲染）时必须瘫掉脚本与外链；
      // 作为 <img>/背景引用时浏览器本就在无脚本上下文渲染，这两个头不影响显示。
      'content-disposition': `${isSvg ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
      ...(isSvg ? { 'content-security-policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
    }
    if (req.headers['if-none-match'] === etag) {
      writeHead(res, 304, { etag, 'cache-control': headers['cache-control'] })
      res.end()
      return
    }
    const range = parseRange(req.headers.range, info.size)
    if (range === 'unsatisfiable') {
      writeHead(res, 416, { ...headers, 'content-range': `bytes */${String(info.size)}` })
      res.end()
      return
    }
      if (range !== undefined) {
        writeHead(res, 206, {
          ...headers,
          'content-length': String(range.end - range.start + 1),
          'content-range': `bytes ${String(range.start)}-${String(range.end)}/${String(info.size)}`,
        })
      } else {
        writeHead(res, 200, { ...headers, 'content-length': String(info.size) })
      }
      if ((req.method ?? 'GET').toUpperCase() === 'HEAD') {
        res.end()
        return
      }
      try {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          const stream = createReadStream(absolute, range === undefined ? {} : { start: range.start, end: range.end })
          stream.on('error', (error) => reject(new HttpError(500, '读取素材失败（详见宿主日志）')))
          stream.on('close', resolve)
          res.on('close', () => {
            // 客户端中途断开（拖进度条常态）：主动销毁读流，别让 fd 拖到 GC 才回收。
            stream.destroy()
            resolve()
          })
          stream.pipe(res)
        }))
      } catch (error) {
        // 读流失败时响应多半已经开始（206/200 头已发）：不能往二进制体里追加
        // 一段 JSON，直接断开连接让客户端按网络错误处理；细节进日志。
        console.error('[dsh-theme-studio] 素材回吐失败', error)
        if (!res.headersSent) throw error
        res.destroy()
      }
    }

  return { handle, broadcast, requireWriteKey, prefix, route }
}

/**
 * 解析单区间 Range（浏览器音视频拖动只会发单区间）。
 * 多区间、无法识别的写法一律忽略并按整份 200 返回——这是 RFC 允许的降级，
 * 比硬凑一个半吊子多区间实现更安全。
 * @returns {{start:number,end:number}|'unsatisfiable'|undefined}
 */
function parseRange(header, size) {
  if (typeof header !== 'string' || header === '') return undefined
  const match = RANGE_RE.exec(header.trim())
  if (match === null) return undefined
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return undefined
  // 空文件没有任何可满足的字节区间：后缀区间的算术会产生 end=-1 的畸形 206
  // （Content-Range: bytes 0--1/0），随后读流还会中途炸掉。
  if (size === 0) return 'unsatisfiable'
  // 后缀区间 "bytes=-N"：只要末尾 N 字节。
  if (rawStart === '') {
    const count = Number.parseInt(rawEnd, 10)
    if (!Number.isFinite(count) || count <= 0) return 'unsatisfiable'
    return { start: Math.max(0, size - count), end: size - 1 }
  }
  const start = Number.parseInt(rawStart, 10)
  if (!Number.isFinite(start) || start >= size) return 'unsatisfiable'
  // 开区间 "bytes=N-"：到文件末尾。
  if (rawEnd === '') return { start, end: size - 1 }
  const end = Number.parseInt(rawEnd, 10)
  if (!Number.isFinite(end) || end < start) return 'unsatisfiable'
  return { start, end: Math.min(end, size - 1) }
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const raw of req) {
    const piece = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
    total += piece.length
    if (total > MAX_JSON_BYTES) throw new HttpError(413, 'JSON 请求体过大')
    chunks.push(piece)
  }
  if (total === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error) {
    throw new HttpError(400, `JSON 解析失败：${error.message}`)
  }
}

function json(res, value, status = 200) {
  const text = JSON.stringify(value)
  writeHead(res, status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(text)),
    'cache-control': 'no-store',
  })
  res.end(text)
}

function writeHead(res, status, headers) {
  res.writeHead(status, headers)
}

function timingSafeEquals(a, b) {
  // 先各自收进 SHA-256 再比对：crypto.timingSafeEqual 要求等长输入，直接比
  // 明文只能手写循环，还会从耗时里泄人口令长度。哈希后长度归一（32 字节），
  // 逐位恒时，早期返回不存在。
  const ha = createHash('sha256').update(String(a)).digest()
  const hb = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ha, hb)
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(String(value ?? ''))
  } catch {
    return String(value ?? '')
  }
}

function asObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
