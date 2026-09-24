/**
 * dsh-theme-studio · Host 半
 *
 * 职责：
 *  1. 主题数据落在 $DSH_HOME/theme-studio/（文档 + 原画质素材），原子写、自管版本；
 *  2. 在 ctx.webServer 上注册 /dsh-theme-studio/*：状态读写、素材上传、
 *     以及带 Range 与一年强缓存的素材回吐（视频任意拖动不需要整份进内存）；
 *  3. 通过 webserver/index-inject 在首屏装好背景层与写口令，
 *     消除"插件加载后壁纸才跳出来"的闪烁。
 *
 * 与宿主的关系：不 fork、不 patch。表现层真正的着色仍走 ui-theme 的 ctx.theme
 * 令牌注册表（由 Client 半负责），Host 只做数据与传输。
 *
 * 配置覆盖（环境变量，不声明 Config schema，避免与宿主配置校验耦合）：
 *   DSH_THEME_STUDIO_HOME       数据目录，默认 <$DSH_HOME 或 ~/.dsh>/theme-studio
 *   DSH_THEME_STUDIO_MAX_UPLOAD 单文件上限字节，默认 1 GiB
 *
 * @module dsh-theme-studio
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { ThemeStore } from './lib/store.js'
import { createThemeStudioHttp } from './lib/http.js'
import { buildBootCss, normalizeDoc } from './lib/engine.js'

/** 路由前缀，同时也是注入全局量的命名空间。 */
export const PREFIX = '/dsh-theme-studio'
const BOOT_GLOBAL = '__DTS_BOOT__'
const DEFAULT_MAX_UPLOAD = 1024 * 1024 * 1024

/**
 * 解析数据根目录。DSH 的 home 优先级是 $DSH_HOME > ~/.dsh，这里保持一致；
 * 刻意内联而不是 peer-import @deepseek-ai/dsh-home-paths：宿主版本一变就可能
 * 解析失败，插件不该因为一个十行路径工具起不来。
 * @returns {string}
 */
function dataRoot() {
  const configured = process.env.DSH_THEME_STUDIO_HOME
  if (typeof configured === 'string' && configured.trim().length > 0) return resolve(expandHome(configured.trim()))
  const home = process.env.DSH_HOME
  const root = home !== undefined && home.trim().length > 0 ? expandHome(home.trim()) : join(homedir(), '.dsh')
  return join(resolve(root), 'theme-studio')
}

function expandHome(path) {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

function maxUploadBytes() {
  const raw = Number(process.env.DSH_THEME_STUDIO_MAX_UPLOAD)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_UPLOAD
}

/** 素材 URL：内容寻址的 id 直接当文件名，附带原名只为下载与可读性。 */
function assetUrl(prefix, id) {
  return `${prefix}/media/${encodeURIComponent(id)}/`
}

/**
 * 生成首屏注入行。每次 index 渲染都重新生成，因此 store 的最新状态天然生效。
 * @param {ThemeStore} store
 * @param {string} prefix
 */
export function bootInjections(store, prefix = PREFIX) {
  const doc = store.state === null ? normalizeDoc({}) : store.state.doc
  const rows = []
  /**
   * 写口令：进程级随机，同源页面在 HTML 里直接读到，跨源页面读不到——
   * 这就是"谁能往本机写文件"的边界。素材读取保持公开（内容寻址、不可枚举）。
   */
  rows.push({
    kind: 'global',
    name: BOOT_GLOBAL,
    value: {
      prefix,
      writeToken: store.writeToken,
      revision: store.state === null ? 0 : store.state.revision,
      backdropMode: doc.backdrop.mode,
    },
  })
  if (doc.backdrop.mode === 'none') return rows

  const css = buildBootCss(doc, { mediaUrlFor: (id) => assetUrl(prefix, id) })
  if (css !== '') rows.push({ kind: 'style', text: css })

  if (doc.backdrop.mode === 'video' && doc.backdrop.mediaId !== '') {
    rows.push({ kind: 'script', placement: 'body', text: bootVideoScript(doc, prefix) })
  } else {
    // 图片与渐变都由 CSS 背景层承担，纯标记即可，不跑脚本。
    // 结构与浏览器半的 layer 管理器逐字一致：外层固定层 + 内层上色的 --css 层，
    // 这样插件加载后是"接管"这两个节点，而不是再嵌一层重复的固定层。
    rows.push({
      kind: 'html',
      placement: 'body',
      html: '<div id="dts-backdrop" class="dts-layer" aria-hidden="true"><div class="dts-layer dts-layer--css"></div></div>',
    })
  }
  return rows
}

/**
 * 视频背景的启动脚本：在插件加载前就把 <video> 挂上，让浏览器立刻开始
 * Range 流式拉流。属性逐条由数据生成，不做任何字符串拼接戏法。
 * @param {object} doc
 * @param {string} prefix
 */
function bootVideoScript(doc, prefix) {
  const b = doc.backdrop
  const url = assetUrl(prefix, b.mediaId)
  const setters = [
    `video.src = ${JSON.stringify(url)};`,
    b.video.muted ? 'video.muted = true;' : '',
    b.video.loop ? 'video.loop = true;' : '',
    'video.setAttribute("playsinline", "");',
    'video.setAttribute("preload", "auto");',
    `video.playbackRate = ${String(b.video.playbackRate)};`,
    b.video.autoplay
      ? 'video.addEventListener("loadeddata", function () { var p = video.play(); if (p && p.catch) { p.catch(function () {}); } }, { once: true });'
      : '',
  ].filter((line) => line !== '')
  return [
    '(function () {',
    '  if (document.getElementById("dts-backdrop")) { return; }',
    '  var layer = document.createElement("div");',
    '  layer.id = "dts-backdrop";',
    '  layer.className = "dts-layer";',
    '  layer.setAttribute("aria-hidden", "true");',
    '  var video = document.createElement("video");',
    '  video.className = "dts-video";',
    ...setters.map((line) => `  ${line}`),
    '  layer.appendChild(video);',
    '  document.body.insertBefore(layer, document.body.firstChild);',
    '})();',
  ].join('\n')
}

/**
 * Cordis 入口。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const root = dataRoot()
  const store = new ThemeStore({
    root,
    maxUploadBytes: maxUploadBytes(),
    log: (msg) => { ctx.logger.warn(`dsh-theme-studio: ${msg}`) },
  })
  // Host Connection 只在 web 组合里存在；拿不到就退回"写口令"这一层防线。
  const connection = safeGet(ctx, 'connection')
  const http = createThemeStudioHttp({ store, prefix: PREFIX, connection })

  // 初始化不 await：磁盘慢不该拖住宿主启动，失败走日志并在首次请求时报错。
  void store.init().then(
    () => {
      ctx.logger.info(`dsh-theme-studio: 数据目录 ${root}，素材 ${String(Object.keys(store.state.media).length)} 个`)
    },
    (error) => {
      ctx.logger.error(new Error(`dsh-theme-studio: 初始化失败：${String(error?.message ?? error)}`))
    },
  )

  // webServer 缺席（CLI/ACP 组合）时整段自动跳过——本插件只服务浏览器界面。
  ctx.inject(['webServer'], (web) => {
    web.effect(() => {
      const unregister = web.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler: (req, res) => {
          void http.handle(req, res).catch((error) => {
            ctx.logger.error(new Error(`dsh-theme-studio: 路由处理异常：${String(error?.message ?? error)}`))
            if (!res.headersSent) {
              res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
            }
            res.end(JSON.stringify({ ok: false, error: { message: 'theme-studio internal error' } }))
          })
        },
      })
      // prepend 对齐官方 ui-theme 的 index-inject 注册形态（src/index.ts:41-43）：
      // 主题行先进表，__DTS_BOOT__ 与背景层先于其他插件的行渲染（层垫底、口令先行）。
      const offInject = web.on('webserver/index-inject', (table) => {
        // 不因 store.state === null 跳过：bootInjections 自带兜底（至少下发写口令行），
        // 否则初始化窗口/初始化失败时渲染的首屏连写口令都没有，刷新也救不回来。
        try {
          table.push(...bootInjections(store, PREFIX))
        } catch (error) {
          ctx.logger.warn(`dsh-theme-studio: 首屏注入生成失败：${String(error?.message ?? error)}`)
        }
      }, { prepend: true })
      // 路由注册与注入监听同一生命周期收口：卸载时都撤干净，不留悬挂监听。
      return () => {
        if (typeof unregister === 'function') unregister()
        if (typeof offInject === 'function') offInject()
      }
    }, 'theme-studio: http routes')
  })
}

/** ctx.get 在服务未挂载时可能抛，统一兜成 undefined。 */
function safeGet(ctx, name) {
  try {
    return ctx.get?.(name) ?? undefined
  } catch {
    return undefined
  }
}

export const name = 'dsh-theme-studio'

export { ThemeStore, createThemeStudioHttp }
