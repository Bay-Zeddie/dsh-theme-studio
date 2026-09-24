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
import { extname } from 'node:path'

import { HttpError, MEDIA_TYPES } from './store.js'
import { GRADIENTS, GLASS_SURFACES, PRESETS, TOKEN_GROUPS, applyPreset, buildCss, buildTokenLayers, mediaUrl, normalizeDoc } from './engine.js'

const MAX_JSON_BYTES = 8 * 1024 * 1024
const RANGE_RE = /^bytes=(\d*)-(\d*)$/
const WRITE_METHODS = new Set(['PUT', 'POST', 'DELETE'])

/**
 * Host 白名单。写口令的安全模型是"跨源页面读不到 index.html 里的口令"，但
 * DNS rebinding 之后 attacker.com 与回环地址在浏览器眼里就是同源 —— Sec-Fetch-Site
 * 同样被骗过，Host 校验是唯一天然拆穿 rebinding 的点。除 localhost 集合外，
 * 还接受与连接本地地址一致的 Host（局域网 IP 直访）；用主机名访问请以
 * DSH_THEME_STUDIO_TRUST_HOSTS 显式声明（逗号分隔）。
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
  if (host === '' || host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  const extra = String(process.env.DSH_THEME_STUDIO_TRUST_HOSTS ?? '')
    .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  if (extra.includes(host)) return true
  const local = String(req.socket?.localAddress ?? '').toLowerCase().replace(/^::ffff:/, '')
  return local !== '' && host.replace(/^::ffff:/, '') === local
}

/** 写请求的第二道闸：浏览器跨站请求一定带 Origin，与 Host 不一致即拒绝。 */
function originAllowed(req) {
  const origin = req.headers?.origin
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return true
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
        throw new HttpError(421, 'Host 不在允许清单（拦截 DNS rebinding）：请通过 127.0.0.1 / localhost 访问，或设置 DSH_THEME_STUDIO_TRUST_HOSTS')
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
      if (!res.headersSent) {
        writeHead(res, status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      }
      res.end(JSON.stringify({
        ok: false,
        error: { message: error instanceof HttpError ? error.message : String(error?.message ?? error), status },
      }))
    }
  }

  function openEvents(req, res) {
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
    await new Promise((resolve, reject) => {
      const stream = createReadStream(absolute, range === undefined ? {} : { start: range.start, end: range.end })
      stream.on('error', (error) => reject(new HttpError(500, `读取素材失败：${error.message}`)))
      stream.on('close', resolve)
      res.on('close', () => {
        // 客户端中途断开（拖进度条常态）：主动销毁读流，别让 fd 拖到 GC 才回收。
        stream.destroy()
        resolve()
      })
      stream.pipe(res)
    })
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
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
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
