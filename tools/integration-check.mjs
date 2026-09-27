/**
 * TS 产物端到端集成验证（无浏览器）：模拟 dsh loader 装载产物 → 驱动 apply 全生命周期
 * → 断言 DOM 落地、令牌注入、卸载回收。
 *
 * 与 test/client.test.mjs 的分工：那里用 vm 沙箱认证 bundle 契约；这里用**独立实现的
 * 更挑剔的 DOM 替身 + 真实产物文件**跑一遍完整装配路径，作为产线切换的交叉佐证。
 *
 *   node tools/integration-check.mjs [path=client.js]
 */
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 剥注释器与官方 9 键基座表与 tools/verify-bundle.mjs 同源共用（避免两侧口径漂移）。
import { LOADER_BASE_TABLE, requireSpecifiers } from './strip-comments.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] ?? join(root, 'client.js')
const code = readFileSync(target, 'utf8')

/* ---------- 最小 DOM ---------- */
const byId = new Map()
const docEvents = []
function makeStyle() {
  const props = new Map()
  return {
    setProperty: (n, v) => props.set(n, String(v)),
    removeProperty: (n) => props.delete(n),
    getPropertyValue: (n) => props.get(n) ?? '',
  }
}
function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    children: [],
    attributes: Object.create(null),
    // 自写控件层的 .module.css 在模块初始化期就 <style data-plugin-css=…> 注入，
    // 注入代码会写 tag.dataset.plugin / tag.dataset.pluginCss —— 替身必须有 dataset。
    dataset: Object.create(null),
    style: makeStyle(),
    textContent: '',
    isConnected: true,
    parentNode: null,
    get className() { return this.attributes.class ?? '' },
    set className(v) { this.setAttribute('class', v) },
    get firstChild() { return this.children[0] ?? null },
    appendChild(c) { this.children.push(c); c.parentNode = this; if (c.id) byId.set(c.id, c); return c },
    insertBefore(c) { this.children.unshift(c); c.parentNode = this; if (c.id) byId.set(c.id, c); return c },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c },
    remove() { this.isConnected = false; if (this.parentNode) this.parentNode.removeChild(this); if (this.id) byId.delete(this.id) },
    setAttribute(n, v) { this.attributes[n] = String(v) },
    getAttribute(n) { return n in this.attributes ? this.attributes[n] : null },
    removeAttribute(n) { delete this.attributes[n] },
    hasAttribute(n) { return n in this.attributes },
    addEventListener(t, fn) { docEvents.push({ el, type: t, fn }) },
    removeEventListener(t, fn) {
      const at = docEvents.findIndex((i) => i.el === el && i.type === t && i.fn === fn)
      if (at >= 0) docEvents.splice(at, 1)
    },
    contains(o) { let n = o; while (n) { if (n === el) return true; n = n.parentNode } return false },
    querySelector() { return null },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400, bottom: 400, right: 800 }),
    play: () => Promise.resolve(),
    pause() {},
    focus() {},
    classList: { _s: new Set(), add(n) { this._s.add(n) }, remove(n) { this._s.delete(n) }, contains(n) { return this._s.has(n) } },
  }
  return el
}
const body = makeElement('body')
const head = makeElement('head')
const rootEl = makeElement('html')
rootEl.appendChild(head); rootEl.appendChild(body)
const doc = {
  documentElement: rootEl, head, body, styleSheets: [], visibilityState: 'visible', fullscreenElement: null,
  activeElement: body, createElement: makeElement, getElementById: (id) => byId.get(id) ?? null,
  addEventListener(t, fn) { docEvents.push({ el: doc, type: t, fn }) },
  // CSS Modules 的幂等注入键：返回 null ⇒ 每个样式表注入一次（与真浏览器首次装载同路径）。
  querySelector: () => null,
  removeEventListener() {}, querySelectorAll: () => [],
}

const themeCalls = { overrideTokens: [], setTheme: [], setFontSize: [] }
const registrations = []
const ctx = {
  theme: {
    overrideTokens(source, tokens) { themeCalls.overrideTokens.push({ source, count: Object.keys(tokens).length }); return () => {} },
    setTheme(id) { themeCalls.setTheme.push(id) },
    setFontSize(px) { themeCalls.setFontSize.push(px) },
  },
  slots: {
    inject(name, factory) { const d = factory(); return typeof d === 'function' ? d : () => {} },
    register(opts, component) { registrations.push({ opts, component }); return () => {} },
    entries: () => [{ options: { id: 'dsh-theme-studio' } }],
  },
  effect(fn) { const d = fn(); return d },
  on() { return () => {} },
  get: () => undefined,
}

const projection = {
  revision: 3, prefix: '/dsh-theme-studio', writeToken: 'tok',
  doc: {
    schema: 1, preset: 'deepsea', base: { scheme: 'dark', fontSize: 15 },
    backdrop: { mode: 'image', mediaId: 'abc.png', gradient: 'midnight', fit: 'cover', focusX: 50, focusY: 50, scale: 1, tile: false, blur: 0, brightness: 100, saturate: 100, contrast: 100, grayscale: 0, sepia: 0, hueRotate: 0, dim: 0.2, veilColor: '#000000', veilGradient: true, kenBurns: false, kenBurnsSeconds: 40, parallax: 0, video: { muted: true, loop: true, autoplay: true, playbackRate: 1 }, fadeOnFocus: false },
    glass: { enabled: true, alpha: 0.5, blur: 16, saturate: 150 },
    palette: { accent: '', autoAccent: true, tokens: {} },
    type: { uiFont: '', codeFont: '', letterSpacing: 0, families: [] },
    shape: { cornerShape: 1.5, motionSpeed: 1, scrollbar: 'native', reduceMotion: false },
    advanced: { css: '' },
  },
  media: { 'abc.png': { id: 'abc.png', name: 'wall.png', mime: 'image/png', kind: 'image', bytes: 100, width: 1920, height: 1080 } },
  css: '.dts-layer--css { background-image: url("/dsh-theme-studio/media/abc.png/"); }',
  tokenLayers: { '--dsw-alias-bg-base': { light: '#ffffff', dark: '#0a0c12' } },
  glassSurfaces: ['--dsw-alias-bg-base'],
  tokenGroups: [{ id: 'surface', label: '表面', tokens: [{ name: '--dsw-alias-bg-base', label: '应用底色' }] }],
  presets: [{ id: 'deepsea', name: '深海', accent: '#2f8fd6', mood: 'cool', backdrop: 'gradient', gradient: 'midnight' }],
  gradients: { midnight: { label: '午夜', angle: 160, stops: ['#05070f', '#0f1b3d'] } },
}

const sandboxGlobal = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Object, Array, JSON, Math,
  Number, String, Boolean, Error, TypeError, RegExp, Date, Set, Map, Symbol, Intl, Function,
  encodeURIComponent, decodeURIComponent, URL,
  document: doc,
  navigator: { language: 'zh-CN' },
  location: { origin: 'http://127.0.0.1:3080' },
  getComputedStyle: () => ({ getPropertyValue: () => '', backgroundColor: 'rgb(255,255,255)' }),
  EventSource: function () { this.addEventListener = () => {}; this.close = () => {} },
  Image: function () { this.addEventListener = (t, fn) => { if (t === 'error') fn() } },
  XMLHttpRequest: function () { this.open = () => {}; this.setRequestHeader = () => {}; this.send = () => {}; this.addEventListener = () => {}; this.upload = { addEventListener: () => {} } },
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, value: projection }) }),
  Blob: function () {},
  // react 替身：自写控件层（src/client/controls/**）在模块初始化期就用 forwardRef / memo
  // 包组件，所以这两个 API 必须在位；真渲染由宿主负责，这里只保证装载路径不抛。
  // 阶段 E 起还多了一条用途：背景层的**容器**由 React 渲染（`OverlaySurface` 注册进官方
  // `shell.overlay` 槽），验"背景层 DOM 存在"就必须真跑一遍那个组件的渲染函数 ——
  // 于是 hooks 也照最小语义补齐（不是完整调度器，够渲染一次即可）。
  React: {
    createElement: (t, p, ...c) => ({ type: t, props: p, children: c }),
    cloneElement: (el) => el,
    forwardRef: (render) => render,
    memo: (render) => render,
    Fragment: 'Fragment',
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  },
}

let handoff = null
const window = {
  __ModuleLoader__: { load: (h) => { handoff = h } },
  __DTS_BOOT__: { prefix: '/dsh-theme-studio', writeToken: 'tok' },
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame: (fn) => setTimeout(() => fn(0), 0),
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  innerWidth: 1600, innerHeight: 900,
}
Object.assign(sandboxGlobal, { window, globalThis: sandboxGlobal })
sandboxGlobal.self = window

const raf = (fn) => setTimeout(() => fn(0), 0)
/** @type {any} vm 沙箱上下文：动态挂 globalThis/self 与运行时注入的宿主面。 */
const context = {
  ...sandboxGlobal,
  window, document: doc, navigator: sandboxGlobal.navigator,
  localStorage: window.localStorage, requestAnimationFrame: raf,
}
context.globalThis = context
context.self = window
createContext(context)
runInContext(code, context, { filename: target })

const main = async () => {
const checks = []
const check = (name, cond, detail) => checks.push({ name, ok: !!cond, detail })

check('产物注册 load()', handoff !== null)
check('id 与包名一致', handoff.id === 'dsh-theme-studio', `id=${String(handoff.id)}`)
check('factory 是函数', typeof handoff.factory === 'function')

const modules = {
  react: sandboxGlobal.React,
  'react-dom/client': { createRoot: () => ({ render() {}, unmount() {} }) },
  // react-dom 是**官方 9 键基座表**里的键，而且是 createPortal 的唯一来源
  // （React.createPortal 恒 undefined —— 那正是让 MenuSurface/Modal/Toast/Tooltip/Select/Menu
  // 六件 portal 化控件在真运行时白屏的写法）。createPortal 必须是**真函数**。
  // ⚠️ 真库的 `createPortal` 是**惰性**的：交回 `{$$typeof: REACT_PORTAL_TYPE, children,
  // containerInfo}`，落 DOM 发生在 commit 阶段。本替身照此实现（旧替身在"渲染期"就 append，
  // 把渲染与挂载压成一件事 —— test/client.test.mjs 的四条断言曾因此取不到稳定节点）。
  // 本文件不模拟 commit：背景层走的是"ref 交容器"那条路，不经过门户；门户落 DOM 那一侧的
  // 断言在 test/client.test.mjs（commit 模拟）与真机冒烟里。
  'react-dom': {
    createPortal: (node, container) => ({
      $$typeof: Symbol.for('react.portal'),
      key: null,
      children: node === undefined ? null : node,
      containerInfo: container === undefined ? null : container,
    }),
    render() {},
    unmountComponentAtNode: () => true,
  },
  // 官方包替身已删除：合规改造后产物不得 require 任何 @deepseek-ai/* 包，
  // 留着替身就会让"越界 require"这条断言永远为真。
}
/** 实际被 require 的 specifier（含重复），供下面的基座表断言核对。 */
const requested = []
const exported = handoff.factory((spec) => {
  requested.push(spec)
  if (spec in modules) return modules[spec]
  throw new Error(`require 越界（基座表之外）：${spec}`)
})

/**
 * 静态口径：产物里**出现的** require 调用点（不看运行时是否走到）。
 * 剥器与基座表与 tools/verify-bundle.mjs **同源**（tools/strip-comments.mjs）——
 * 这里再查一遍是为了让"端到端装配"与"静态锁"两侧互相印证（一侧只读文本、一侧真跑装配），
 * 共用一份剥器则保证两侧口径不会漂移（产物保留注释，注释里也引用了禁用的 require 原文）。
 */
const staticRequires = requireSpecifiers(code)

// 运行时口径：本次装配实际执行到的 require。createRoot 在位 ⇒ app.ts 的 ReactDOM.render
// 退路分支不执行，所以 react-dom 只计 1 次（createPortal 那一处，模块初始化期必执行）。
check('运行时 require = react×2 / react-dom×1 / react-dom/client×1',
  [...requested].sort().join('|') === 'react|react|react-dom|react-dom/client',
  `实际 [${[...requested].sort().join(', ')}]`)
check('运行时 require 逐项落在官方 9 键基座表内',
  requested.every((spec) => LOADER_BASE_TABLE.includes(spec)),
  `表外项 [${requested.filter((spec) => !LOADER_BASE_TABLE.includes(spec)).join(', ')}]`)
// 静态口径：产物里共 4 个 require 调用点 —— react×2（deps.ts / controls/runtime.ts，
// 模块初始化期都执行）/ react-dom×1（createPortal 的唯一来源）/ react-dom/client×1（createRoot）。
// ⚠️ 旧口径是 "react-dom×2"：第 2 条落在 app.ts 的**模态退路分支**里 ——
// 阶段 E 把模态改成声明式（`ModalHost` + `createPortal`）后那条退路整段删除，
// 于是这条锁锁住了"已经不存在"的实现。口径与 tools/verify-bundle.mjs 的
// EXPECTED_REQUIRES（5→4）同步；**锁本身没有放宽**：仍然逐项钉死清单与重复次数。
check('静态 require 调用点 = react×2 / react-dom×1 / react-dom/client×1',
  [...staticRequires].sort().join('|') === 'react|react|react-dom|react-dom/client',
  `实际 [${[...staticRequires].sort().join(', ')}]`)
check('静态 require 逐项落在官方 9 键基座表内',
  staticRequires.every((spec) => LOADER_BASE_TABLE.includes(spec)),
  `表外项 [${[...new Set(staticRequires.filter((spec) => !LOADER_BASE_TABLE.includes(spec)))].join(', ')}]`)
check('createPortal 替身是真函数（React.createPortal 恒 undefined）',
  typeof modules['react-dom'].createPortal === 'function')
check('exports.name 正确', exported.name === 'dsh-theme-studio')
check('exports.inject = [slots, theme]', Array.isArray(exported.inject) && exported.inject.join(',') === 'slots,theme')
check('exports.apply 是函数', typeof exported.apply === 'function')
check('__internals 齐备', exported.__internals && typeof exported.__internals.MESSAGES === 'object')

exported.apply(ctx)
await new Promise((r) => setTimeout(r, 120))

/**
 * 模拟 React 挂载 `shell.overlay` 条目（**模态 / Toast 等真正浮层的落点**）：
 * 调组件函数拿元素树 → 给宿主元素造 DOM 节点 → 把 `ref` 回调**配对**交出去
 * （React 在 commit 阶段就是这么做的：`OverlaySurface` 的 `setHost` → `layer.attachStage`）。
 *
 * ⚠️ **背景层不在这个容器里**（真机实测修正）：宿主该槽是 `z-index:20` 的浮层容器，
 * 背景层进去会盖住 `#root`（`z-index:1`）的全部内容 ⇒ 壁纸埋掉整个界面。
 * 背景层固定挂 `document.body`（见下方两条分层断言）。这里仍然要跑一遍组件渲染，
 * 因为模态/Toast 容器确实由它交出，且 `attachStage` 会顺带触发一次落位。
 *
 * @returns {any} 浮层宿主容器的 DOM 节点（容器没注册时返回 null）。
 */
function mountOverlayEntry() {
  const reg = registrations.find((item) => item.opts && item.opts.name === 'shell.overlay')
  if (reg === undefined) return null
  const hosts = []
  const pairs = []
  const walk = (node, depth = 0) => {
    if (depth > 12 || node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (typeof node.type === 'function') {
      walk(node.type(Object.assign({}, node.props, { children: node.children })), depth + 1)
      return
    }
    if (typeof node.type !== 'string' || node.type === 'Fragment') {
      walk(node.children, depth + 1)
      return
    }
    const host = makeElement(node.type)
    if (node.props && node.props.id !== undefined) {
      host.id = node.props.id
      byId.set(host.id, host)
    }
    const parent = hosts.length > 0 ? hosts[0] : null
    if (parent !== null) parent.appendChild(host)
    hosts.push(host)
    if (node.props && typeof node.props.ref === 'function') pairs.push({ ref: node.props.ref, host: host })
    walk(node.children, depth + 1)
  }
  walk(reg.component({}))
  for (const pair of pairs) pair.ref(pair.host)
  return hosts.length > 0 ? hosts[0] : null
}

const overlayHost = mountOverlayEntry()

check('token 注入发生', themeCalls.overrideTokens.length >= 1, `${String(themeCalls.overrideTokens.length)} 次`)
check('token source 正确', themeCalls.overrideTokens[0]?.source === 'dsh-theme-studio')
check('setTheme 被调用', themeCalls.setTheme.length >= 1, JSON.stringify(themeCalls.setTheme))
check('setFontSize 被调用', themeCalls.setFontSize.length >= 1, JSON.stringify(themeCalls.setFontSize))
check('浮层条目已注册（模态/Toast 的落点）', overlayHost !== null)
check('背景层 DOM 存在', doc.getElementById('dts-backdrop') !== null)
/* ★ 分层契约（真机实测修正）：背景层**必须挂在 `<body>`** 上。
   ⚠️ 宿主 `shell.overlay` 的容器是 **`z-index:20` 的浮层槽**
   （`AppFrame.module.css` 逐字 `.ZTP-Xa_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}`），
   而我们自己的 `buildCss` 写了 `#root{position:relative;z-index:1}` ⇒ 背景层一旦进了那棵子树，
   就随 **z-index:20** 压在 `#root` 的**全部内容**之上 ⇒ **壁纸盖住整个界面**（真机复现过：整屏只剩壁纸）。
   正确分层：背景（body, z0）< UI（`#root`, z1）< 浮层（shell.overlay, z20）——
   `body.dts-on #root{position:relative;z-index:1}` 这条承重墙**只在"背景层是 body 的子节点"时成立**。
   这与改造前的行为一致（那时就是 `document.body.insertBefore(layer, body.firstChild)`）。 */
check('背景层挂在 <body> 上（分层：背景 z0 < #root z1 < 浮层 z20）',
  doc.getElementById('dts-backdrop')?.parentNode === body,
  `parent=${String(doc.getElementById('dts-backdrop')?.parentNode?.id || doc.getElementById('dts-backdrop')?.parentNode?.tagName)}`)
check('背景层绝不许进浮层容器（z-index:20 会盖住整个 UI）',
  overlayHost === null || doc.getElementById('dts-backdrop')?.parentNode !== overlayHost,
  `overlayHost 子节点 [${overlayHost === null ? 'n/a' : overlayHost.children.map((child) => child.id || child.tagName).join(', ')}]`)
check('浮动按钮已移除（入口只走设置页）', doc.getElementById('dts-fab') === null)
check('界面样式注入', doc.getElementById('dts-chrome-style') !== null)
check('设置页注册发生', registrations.length >= 1, `${String(registrations.length)} 条`)

const failed = checks.filter((c) => !c.ok)
for (const c of checks) console.log(`  ${c.ok ? '✔' : '✖'} ${c.name}${c.detail ? `  (${c.detail})` : ''}`)
console.log(`\n[integration] ${String(checks.length - failed.length)}/${String(checks.length)} 项通过`)
process.exit(failed.length === 0 ? 0 : 1)
}

await main()
