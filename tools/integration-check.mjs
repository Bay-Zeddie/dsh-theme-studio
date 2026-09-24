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
  React: { createElement: (t, p, ...c) => ({ type: t, props: p, children: c }), cloneElement: (el) => el },
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
  'react-dom': { render() {}, unmountComponentAtNode: () => true },
  '@deepseek-ai/dsh-client-ui-primitives': {},
}
const exported = handoff.factory((spec) => {
  if (spec in modules) return modules[spec]
  throw new Error(`require 越界：${spec}`)
})
check('exports.name 正确', exported.name === 'dsh-theme-studio')
check('exports.inject = [slots, theme]', Array.isArray(exported.inject) && exported.inject.join(',') === 'slots,theme')
check('exports.apply 是函数', typeof exported.apply === 'function')
check('__internals 齐备', exported.__internals && typeof exported.__internals.MESSAGES === 'object')

exported.apply(ctx)
await new Promise((r) => setTimeout(r, 120))

check('token 注入发生', themeCalls.overrideTokens.length >= 1, `${String(themeCalls.overrideTokens.length)} 次`)
check('token source 正确', themeCalls.overrideTokens[0]?.source === 'dsh-theme-studio')
check('setTheme 被调用', themeCalls.setTheme.length >= 1, JSON.stringify(themeCalls.setTheme))
check('setFontSize 被调用', themeCalls.setFontSize.length >= 1, JSON.stringify(themeCalls.setFontSize))
check('背景层 DOM 存在', doc.getElementById('dts-backdrop') !== null)
check('浮动按钮存在', doc.getElementById('dts-fab') !== null)
check('界面样式注入', doc.getElementById('dts-chrome-style') !== null)
check('设置页注册发生', registrations.length >= 1, `${String(registrations.length)} 条`)

const failed = checks.filter((c) => !c.ok)
for (const c of checks) console.log(`  ${c.ok ? '✔' : '✖'} ${c.name}${c.detail ? `  (${c.detail})` : ''}`)
console.log(`\n[integration] ${String(checks.length - failed.length)}/${String(checks.length)} 项通过`)
process.exit(failed.length === 0 ? 0 : 1)
}

await main()
