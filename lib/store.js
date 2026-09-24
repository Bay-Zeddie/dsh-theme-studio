/**
 * dsh-theme-studio 存储层：主题文档 + 媒体素材库。
 *
 * 布局（默认 <DSH_HOME>/theme-studio/）：
 *   state.json            当前主题文档、素材索引、修订号
 *   media/<hash><ext>     原样落盘的素材字节（内容寻址，天然去重、可永久缓存）
 *   themes/<slug>.json    用户导出的独立主题档（导入时读）
 *
 * 为什么自己写而不走 attachments：附件管线会把长边压到 2048px、编码压到 4MiB，
 * 那是"发给模型看"的语义；主题背景要的是"原画质展示"，两者目标相反。
 * 这里一个字节都不重编码，回读时按原始 Content-Type + Range 直吐。
 *
 * @module dsh-theme-studio/store
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, rename, readFile, rm, stat, writeFile, readdir, copyFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import { DOC_SCHEMA, normalizeDoc } from './engine.js'
import { MEDIA_TYPES, SVG_FULL_SCAN_MAX, sniffMediaType, sniffSvg } from './sniff.js'
import { readImageSize } from './image-size.js'

/** 兼容出口：测试与 http 层从 store.js 取这些契约（实现已拆到 sniff.js / image-size.js）。 */
export { MEDIA_TYPES, SVG_FULL_SCAN_MAX, sniffMediaType, sniffSvg, readImageSize }

const STATE_VERSION = 1

/**
 * 依据文件头魔数判定真实类型（实现在 sniff.js；此处契约由顶部 re-export 保持）。
 */

/** SVG 静态危险特征与全文体检在 sniff.js。 */

/** 只保留安全字符，用作素材文件名，避免路径穿越。 */
function safeName(name) {
  const clean = String(name ?? '')
    .replaceAll(/[\\/]/g, '_')
    .replace(/[^A-Za-z0-9._\-\u4e00-\u9fa5 \u00b7]/g, '')
    .trim()
    .slice(0, 120)
  return clean.length > 0 ? clean : 'untitled'
}

/**
 * 主题工坊的文件存储。所有写操作都是"临时文件 + rename"的原子替换。
 */
export class ThemeStore {
  /**
   * @param {object} options
   * @param {string} options.root - 数据根目录（绝对路径）。
   * @param {number} [options.maxUploadBytes] - 单文件上限，默认 1 GiB。
   * @param {(msg:string)=>void} [options.log]
   */
  constructor(options) {
    this.root = options.root
    this.statePath = join(options.root, 'state.json')
    this.mediaDir = join(options.root, 'media')
    this.themesDir = join(options.root, 'themes')
    this.maxUploadBytes = options.maxUploadBytes ?? 1024 * 1024 * 1024
    this.log = options.log ?? (() => {})
    /** @type {{version:number, revision:number, doc:object, media:Record<string, any>}|null} */
    this.state = null
    this.writeTail = Promise.resolve()
    this.startedAt = Date.now()
    // 每次进程启动一个写入口令：随 index.html 下发给同源页面，防止跨站写。
    this.writeToken = randomUUID().replaceAll('-', '')
  }

  /** 建目录并读入（或初始化）state。 */
  async init() {
    await mkdir(this.mediaDir, { recursive: true })
    await mkdir(this.themesDir, { recursive: true })
    let loaded = null
    try {
      const text = await readFile(this.statePath, 'utf8')
      const parsed = JSON.parse(text)
      if (parsed !== null && typeof parsed === 'object') loaded = parsed
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // 损坏时保留原件再重建，绝不静默丢弃用户配好的主题。
        this.log(`state.json 解析失败，已备份后重建：${error?.message ?? error}`)
        try {
          await copyFile(this.statePath, join(this.root, `state.broken-${String(Date.now())}.json`))
        } catch { /* 备份失败不阻断初始化 */ }
      }
    }
    if (loaded === null || Number(loaded.version) !== STATE_VERSION) {
      loaded = { version: STATE_VERSION, revision: 0, doc: normalizeDoc({}), media: {} }
    }
    if (Number(loaded.doc?.schema ?? 0) < DOC_SCHEMA) {
      loaded.doc = normalizeDoc(loaded.doc)
    }
    this.state = {
      version: STATE_VERSION,
      revision: Number.isFinite(loaded.revision) ? loaded.revision : 0,
      doc: normalizeDoc(loaded.doc),
      media: sanitizeMediaIndex(loaded.media),
    }
    // 索引与磁盘对账：孤儿素材文件保留（用户可能手动放过），索引指向的缺失文件清掉。
    for (const [id, meta] of Object.entries(this.state.media)) {
      try {
        await stat(this.absoluteOf(meta))
      } catch {
        this.log(`素材 ${id} 的文件缺失，已从索引移除`)
        delete this.state.media[id]
      }
    }
    return this.state
  }

  /** @returns {{revision:number, doc:object, media:Object<string,any>}} */
  snapshot() {
    return {
      revision: this.state.revision,
      doc: this.state.doc,
      media: this.state.media,
    }
  }

  /**
   * 写入新的主题文档。revision 单调递增，供多标签页判断"是不是我改的"。
   * @param {unknown} rawDoc
   * @param {{expectRevision?:number}} [options]
   */
  async saveDoc(rawDoc, options = {}) {
    const doc = normalizeDoc(rawDoc)
    return this.mutate((state) => {
      if (options.expectRevision !== undefined && options.expectRevision !== state.revision) {
        throw new HttpError(409, 'revision 冲突：别的标签页已经先改过了')
      }
      state.doc = doc
      return doc
    })
  }

  /**
   * 流式接收一个素材：边写盘边算 sha256，先嗅探魔数再决定收不收。
   * 大文件（视频）不会整份进内存。
   * @param {import('node:http').IncomingMessage} req
   * @param {{name?:string, expectBytes?:number}} [meta]
   * @returns {Promise<any>} 素材元数据
   */
  async ingest(req, meta = {}) {
    const limit = this.maxUploadBytes
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > limit) {
      throw new HttpError(413, `文件超过上限 ${(limit / 1024 / 1024).toFixed(0)} MiB`)
    }
    const tmp = join(this.mediaDir, `.upload-${randomUUID()}`)
    await mkdir(this.mediaDir, { recursive: true })
    const hasher = createHash('sha256')
    const chunks = []
    let headBytes = 0
    let received = 0
    let sniffed
    let file
    try {
      file = await openWrite(tmp)
      for await (const raw of req) {
        const piece = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
        received += piece.length
        if (received > limit) throw new HttpError(413, '上传超过上限')
        // 只留存头部若干字节用于嗅探与读尺寸，其余直接落盘，不占内存。
        if (headBytes < 65536) {
          chunks.push(Buffer.from(piece))
          headBytes += piece.length
        }
        hasher.update(piece)
        if (sniffed === undefined && headBytes >= 64) {
          const head = Buffer.concat(chunks)
          const mime = sniffMediaType(head) ?? (sniffSvg(head) ? 'image/svg+xml' : undefined)
          if (mime === undefined) throw new HttpError(415, '不支持的文件类型（按文件头识别）')
          sniffed = mime
        }
        await file.write(piece)
      }
      if (received === 0) throw new HttpError(400, '空文件')
      if (sniffed === undefined) {
        const head = Buffer.concat(chunks)
        const mime = sniffMediaType(head) ?? (sniffSvg(head) ? 'image/svg+xml' : undefined)
        if (mime === undefined) throw new HttpError(415, '不支持的文件类型（按文件头识别）')
        sniffed = mime
      }
      await file.close()
      file = undefined
      if (sniffed === 'image/svg+xml') {
        // 头部 512B 的黑名单可被"垫长注释"绕过（已实证），SVG 再做一次全文体检；
        // SVG 是纯文本，超过 16 MiB 的"壁纸"基本不是壁纸，直接拒。
        if (received > SVG_FULL_SCAN_MAX) throw new HttpError(415, 'SVG 超过全文体检上限（16 MiB）')
        if (!sniffSvg(await readFile(tmp, 'utf8'))) throw new HttpError(415, 'SVG 含脚本/事件/外链特征，已拒绝')
      }
      const sha256 = hasher.digest('hex')
      const short = sha256.slice(0, 24)
      const info = MEDIA_TYPES[sniffed] ?? { ext: '.bin', kind: 'file' }
      const id = `${short}${info.ext}`
      const target = join(this.mediaDir, id)
      try {
        await rename(tmp, target)
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        // 内容寻址：同名即同内容，直接丢弃临时副本。
        await rm(tmp, { force: true })
      }
      const head = Buffer.concat(chunks).subarray(0, sniffed === 'image/jpeg' ? 65536 : 64)
      const dims = info.kind === 'image' && sniffed !== 'image/svg+xml' ? readImageSize(Buffer.from(head), sniffed) : null
      const existing = this.state.media[id]
      const record = {
        id,
        file: id,
        name: safeName(meta.name ?? existing?.name ?? id),
        mime: sniffed,
        kind: info.kind,
        bytes: received,
        width: dims?.width ?? existing?.width,
        height: dims?.height ?? existing?.height,
        sha256,
        addedAt: existing?.addedAt ?? Date.now(),
      }
      await this.mutate((state) => {
        state.media[id] = record
      })
      return record
    } finally {
      if (file !== undefined) {
        try { await file.close() } catch { /* 已关闭 */ }
      }
      await rm(tmp, { force: true }).catch(() => {})
    }
  }

  /** 素材的绝对路径（含越界防护）。 */
  absoluteOf(meta) {
    const name = basename(String(meta.file ?? meta.id ?? ''))
    if (name === '' || name.includes('..')) throw new HttpError(400, '非法素材名')
    return join(this.mediaDir, name)
  }

  mediaMeta(id) {
    const clean = basename(String(id ?? ''))
    // hasOwn：'constructor'/'toString' 这类原型键会把函数当素材元数据取出来。
    return Object.hasOwn(this.state.media, clean) ? this.state.media[clean] : undefined
  }

  /** 列出全部素材，按加入时间倒序。 */
  listMedia() {
    return Object.values(this.state.media).sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
  }

  /**
   * 删除素材。被当前主题引用时默认拒绝，force 才允许（避免"一键变白屏"）。
   * @param {string} id
   * @param {{force?:boolean}} [options]
   */
  async removeMedia(id, options = {}) {
    const meta = this.mediaMeta(id)
    if (meta === undefined) throw new HttpError(404, '素材不存在')
    if (!options.force && isReferenced(this.state.doc, meta.id)) {
      throw new HttpError(409, '该素材正被当前主题使用；先切换背景或勾选"强制删除"')
    }
    await this.mutate((state) => {
      delete state.media[meta.id]
      if (state.doc.backdrop.mediaId === meta.id) state.doc.backdrop.mediaId = ''
      if (Array.isArray(state.doc.type.families)) state.doc.type.families = state.doc.type.families.filter((f) => f?.id !== meta.id)
    })
    const absolute = this.absoluteOf(meta)
    await rm(absolute, { force: true }).catch(() => {})
    await rm(`${absolute}.json`, { force: true }).catch(() => {})
    return { id: meta.id }
  }

  /** 把当前文档另存为独立主题档（方案）。name 存原始展示名，slug 负责落盘安全。
   *  safeName 是多对一映射（'午夜?深蓝' 与 '午夜深蓝' 同档）：目标已存在且未显式
   *  overwrite 一律 409，把覆盖决定权交回 UI 确认框，绝不静默盖档。 */
  async saveThemeFile(name, options = {}) {
    const display = String(name ?? '').trim() || `theme-${new Date().toISOString().slice(0, 10)}`
    const slug = safeName(display)
    const file = join(this.themesDir, `${slug}.json`)
    if (options.overwrite !== true) {
      const exists = await stat(file).then(() => true, () => false)
      if (exists) throw new HttpError(409, `主题档已存在（消毒后同档：${slug}.json）`)
    }
    const now = Date.now()
    await atomicWrite(file, JSON.stringify({
      version: STATE_VERSION, name: display, exportedAt: now, doc: this.state.doc,
    }, null, 2))
    return { slug, name: display, exportedAt: now }
  }

  /**
   * 主题档列表，带方案页要展示的元信息（主色/背景/时间）。
   * 坏文件不拖垮整表：解析失败也要让条目可见（按 slug 展示，可删可覆盖）。
   * 不再外泄服务器绝对路径（旧实现把 file 路径发给了浏览器）。
   */
  async listThemeFiles() {
    let entries = []
    try { entries = await readdir(this.themesDir) } catch { return [] }
    const rows = []
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const slug = entry.replace(/\.json$/, '')
      const row = { slug, name: slug, exportedAt: 0, mode: '', mediaId: '', mediaName: '', accent: '', scheme: '' }
      try {
        const parsed = JSON.parse(await readFile(join(this.themesDir, entry), 'utf8'))
        const doc = parsed?.doc ?? parsed
        row.name = String(parsed?.name ?? slug)
        row.exportedAt = Number(parsed?.exportedAt ?? 0)
        if (doc && typeof doc === 'object') {
          row.mode = String(doc?.backdrop?.mode ?? '')
          row.mediaId = String(doc?.backdrop?.mediaId ?? '')
          const meta = row.mediaId !== '' ? this.state.media[row.mediaId] : null
          row.mediaName = meta ? String(meta.name ?? '') : ''
          row.accent = String(doc?.palette?.accent ?? '')
          row.scheme = String(doc?.base?.scheme ?? '')
        }
      } catch { /* 解析失败：保留 slug 兜底行 */ }
      rows.push(row)
    }
    return rows
  }

  /** 删除一个本机主题档：不碰素材，也不影响正在应用的文档。 */
  async removeThemeFile(slug) {
    const safe = safeName(String(slug ?? ''))
    const file = join(this.themesDir, `${safe}.json`)
    try { await rm(file) } catch { throw new HttpError(404, `找不到主题档 ${String(slug)}`) }
    return { slug: safe }
  }

  async readThemeFile(slug) {
    const file = join(this.themesDir, `${safeName(slug)}.json`)
    const text = await readFile(file, 'utf8').catch((error) => {
      throw new HttpError(404, `找不到主题档 ${String(slug)}`, error)
    })
    // 与 listThemeFiles 同口径：坏文件不裸抛解析器异常（曾直接 500）。
    try {
      const parsed = JSON.parse(text)
      return parsed?.doc ?? parsed
    } catch (error) {
      throw new HttpError(400, `主题档已损坏：${String(slug)}`, error)
    }
  }

  /**
   * 串行化的"改状态 → 落盘"。返回新 revision 与回调结果。
   * @param {(state:any)=>Promise<any>|any} mutate
   */
  mutate(mutate) {
    const task = this.writeTail.then(async () => {
      const result = await mutate(this.state)
      this.state.revision += 1
      await atomicWrite(this.statePath, JSON.stringify({
        version: this.state.version,
        revision: this.state.revision,
        savedAt: Date.now(),
        doc: this.state.doc,
        media: this.state.media,
      }, null, 2))
      return { result, revision: this.state.revision }
    })
    // 尾巴永远保持 fulfilled：一次失败不能卡住后续写入队列。
    this.writeTail = task.then(() => {}, () => {})
    return task
  }

  /** 供 UI 显示的存储用量。 */
  async usage() {
    let bytes = 0
    let files = 0
    try {
      const entries = await readdir(this.mediaDir)
      for (const entry of entries) {
        if (entry.startsWith('.')) continue
        const st = await stat(join(this.mediaDir, entry)).catch(() => null)
        if (st?.isFile()) {
          bytes += st.size
          files += 1
        }
      }
    } catch { /* 目录还没建 */ }
    // 不外泄服务器绝对路径（与主题档列表同一口径）。
    return { files, bytes }
  }
}

function sanitizeMediaIndex(input) {
  // null 原型字典：'__proto__' 这类键进来也不会改写对象原型。
  const out = Object.create(null)
  if (input === null || typeof input !== 'object') return out
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'object' || value === null) continue
    const id = basename(String(value.id ?? key))
    if (id === '' || id === '.' || id === '..') continue
    out[id] = {
      id,
      file: basename(String(value.file ?? id)),
      name: safeName(value.name ?? id),
      mime: typeof value.mime === 'string' ? value.mime : 'application/octet-stream',
      kind: ['image', 'video', 'font', 'file'].includes(value.kind) ? value.kind : 'file',
      bytes: Number.isFinite(value.bytes) ? value.bytes : 0,
      width: Number.isFinite(value.width) ? value.width : undefined,
      height: Number.isFinite(value.height) ? value.height : undefined,
      sha256: typeof value.sha256 === 'string' ? value.sha256 : undefined,
      addedAt: Number.isFinite(value.addedAt) ? value.addedAt : undefined,
    }
  }
  return out
}

function isReferenced(doc, id) {
  if (doc?.backdrop?.mediaId === id) return true
  // 字体引用住在 type.families（{id,…} 条目）。旧代码查 type.fonts —— 文档模型里
  // 根本没有这个字段，等于字体素材的删除保护整个失效（已实证）。
  if (Array.isArray(doc?.type?.families) && doc.type.families.some((f) => f?.id === id)) return true
  return false
}

/** node:fs open 的懒加载封装（Windows 上也能用）。 */
async function openWrite(path) {
  return await open(path, 'wx')
}

/** 原子写：先写 .tmp 再 rename，避免崩溃留下半个 JSON。 */
async function atomicWrite(path, text) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, text, 'utf8')
  try {
    await rename(tmp, path)
  } catch (error) {
    // Windows 上 rename 撞到已存在文件偶尔 EPERM，重试一次即可。
    if (error?.code !== 'EPERM' && error?.code !== 'EEXIST') throw error
    await rm(path, { force: true }).catch(() => {})
    await rename(tmp, path)
  }
}

/** 带 HTTP 状态码的错误，路由层直接翻译。 */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(status, message, cause) {
    super(message)
    this.status = status
    this.cause = cause
  }
}

export { safeName, atomicWrite }
