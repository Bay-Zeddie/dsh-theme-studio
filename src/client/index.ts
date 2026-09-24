/**
 * src/client/index.ts —— 浏览器半入口：装配 Cordis 客户端契约。
 *
 * 与官方源码交叉核验过的事实（逐条对过 harness，不是照抄注释）：
 *   - ctx.slots.register(options, component) 只有两个参数；slot 未被父节点声明时
 *     直接 throw（ui-slots/src/index.ts:1205-1207）⇒ 注册一律包 try/catch 并备回退入口。
 *   - list 槽"同 id + 同 priority"重复注册会 throw（同文件 :1231）⇒ 换语言重新注册前
 *     必须先 dispose 旧注册，否则第二次必炸。
 *   - ctx.locale.getSnapshot().active 是语言的权威源（locale/src/client/index.ts:581
 *     provide、:227 getSnapshot）。⚠️ 不能只认 <html lang>：服务端 HTML 写死 lang="en"，
 *     要等 locale 插件激活后才异步改写；观察器若挂在写入之后，界面会永久停在英文。
 *   - Switch 的 label 只作 aria-label、不渲染可见文字；Tooltip 的 children 必须能接 ref；
 *     react-dom/client 与 ui-primitives 都在 PLATFORM_MODULES 基座表里（client/web/src/platform.ts）。
 *
 * 产物契约（tools/tsdown.theme-studio.config.ts 的 banner/intro/footer 三件套包装）：
 * 本模块的导出即 closure-factory 的 module.exports。bare require() 取基座模块
 * （现行生产验证过的运行时形态，r1-probe 实测打包原样透传、两种 react 形态都兼容）。
 */
import { COMMIT_DEBOUNCE_MS, DEFAULT_PREFIX, FAB_ID, LAYER_ID, MODAL_HOST_ID, PLUGIN_ID, STYLE_ID } from './identity.ts'
import { MESSAGES, normalizeLang, t } from './i18n.ts'
import { clamp, contrastRatio, rgbToHsl, toHex } from '../../lib/color-core.js'
import { humanBytes, mediaLookup, relativeLuminance, withAlphaCss } from './utils.ts'
import { createStore } from './store.ts'
import { createTokenProbe, fillTokenPairs, composeGlass, fixTextFamily, fixDiffFamily } from './probe-glass.ts'
import { createApi } from './api.ts'
import { createLayerManager, upsertStyle } from './layer.ts'
import { CHROME_CSS, exitFullscreen, fullscreenElement, requestFullscreen } from './chrome.ts'
import { TABS } from './app.ts'
import { keyed } from './tabs.ts'
import { apply } from './app.ts'

export const name = PLUGIN_ID
/**
 * ⚠️ 这是 **cordis 服务注入表**：要用 ctx.slots 就得写 'slots'。
 * 与 package.json 里的 dsh.client.inject（包级声明）不是一回事。
 * locale 故意不声明：它是可选依赖，用 ctx.get 取，拿不到就走降级链。
 */
export const inject = ['slots', 'theme']
export { apply }
export const __internals = {
  MESSAGES: MESSAGES,
  t: t,
  normalizeLang: normalizeLang,
  createStore: createStore,
  createApi: createApi,
  createTokenProbe: createTokenProbe,
  fillTokenPairs: fillTokenPairs,
  composeGlass: composeGlass,
  fixTextFamily: fixTextFamily,
  fixDiffFamily: fixDiffFamily,
  createLayerManager: createLayerManager,
  upsertStyle: upsertStyle,
  keyed: keyed,
  withAlphaCss: withAlphaCss,
  toHex: toHex,
  contrastRatio: contrastRatio,
  humanBytes: humanBytes,
  mediaLookup: mediaLookup,
  clamp: clamp,
  CHROME_CSS: CHROME_CSS,
  TABS: TABS,
  requestFullscreen: requestFullscreen,
  exitFullscreen: exitFullscreen,
  fullscreenElement: fullscreenElement,
  COMMIT_DEBOUNCE_MS: COMMIT_DEBOUNCE_MS,
  LAYER_ID: LAYER_ID,
  STYLE_ID: STYLE_ID,
  FAB_ID: FAB_ID,
  MODAL_HOST_ID: MODAL_HOST_ID,
  DEFAULT_PREFIX: DEFAULT_PREFIX,
  relativeLuminance: relativeLuminance,
  rgbToHsl: rgbToHsl,
}
