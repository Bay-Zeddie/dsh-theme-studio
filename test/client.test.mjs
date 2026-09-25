/**
 * 客户端 bundle 契约测试。
 *
 * 用 vm 沙箱复刻浏览器装载路径（window.__ModuleLoader__.load + 基座 require），
 * 不依赖真浏览器即可证明：
 *   1) bundle 以正确 id 注册，只 require 基座模块，导出 apply / inject / name；
 *   2) apply() 把"成对"令牌交给 ctx.theme、注入样式与背景层、挂上入口；
 *   3) 入口走官方 settings.section，并用 slots.entries ledger 自省确认落地；
 *      没落地必须回退到「通用设置」行 —— 入口消失就是功能退化；
 *   4) 语言以 locale 服务为权威源，变化时**先撤销旧注册再按新文案重新注册**；
 *   5) 卸载时把自己写过的东西撤干净（令牌空层、DOM 与定时器回收）。
 *
 * 跑法： node --test test/client.test.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { it } from 'node:test'

import { GLASS_SURFACES, contrastRatio as engineContrast, luminance as engineLuminance, rgbToHsl as engineRgbToHsl } from '../lib/engine.js'
import { parseCss, declOf } from './css-probe.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = readFileSync(join(here, '..', 'client.js'), 'utf8')

/* ------------------------------------------------------------------ */
/* DOM 替身：只实现 client.js 真会碰到的成员                             */
/* ------------------------------------------------------------------ */

function makeRuleStyle(pairs) {
  const names = Object.keys(pairs)
  const style = { length: names.length, getPropertyValue: (name) => pairs[name] ?? '' }
  names.forEach((name, index) => { style[index] = name })
  return style
}

/**
 * 伪造 ui-theme 的令牌表：探针主要靠扫样式表拿两套模式的基准值，
 * 这里给出真实的规则形状，让玻璃重铸走主路径而不是降级路径。
 */
function createTokenSheets() {
  return [{
    cssRules: [
      {
        selectorText: 'body',
        style: makeRuleStyle({
          '--dsw-alias-bg-base': '#ffffff',
          '--dsw-alias-bg-layer-1': '#ffffff',
          '--dsw-alias-label-primary': '#0f1115',
          '--dsw-specific-sidebar-fill': '#f9fafb',
          '--dsw-specific-tip': '#f1f3f5',
          '--dsw-alias-markdown-code-block': '#fafafa',
          '--dsw-alias-markdown-inline-code': '#fafafa',
          '--dsw-alias-bg-overlay': '#ffffff',
          '--dsw-alias-bg-layer-2': '#f5f6f7',
          '--dsw-alias-bg-layer-3': '#f2f3f5',
          '--dsw-specific-input-major': '#ffffff',
          '--dsw-specific-selector': '#f1f3f5',
          '--dsw-alias-button-elevated-fill': '#ffffff',
          '--dsw-alias-button-floating-hover': '#f1f3f5',
          '--dsw-alias-markdown-tag': '#f1f3f5',
          '--dsw-specific-bubble': '#ffffff',
          '--dsw-specific-bubble-highlight': '#eef2f8',
        }),
      },
      {
        selectorText: 'body[data-ds-dark-theme]',
        style: makeRuleStyle({
          '--dsw-alias-bg-base': '#151517',
          '--dsw-alias-bg-layer-1': '#1b1c1f',
          '--dsw-alias-label-primary': '#f2f4f8',
          '--dsw-specific-sidebar-fill': '#0f1012',
          '--dsw-specific-tip': '#232325',
          '--dsw-alias-markdown-code-block': '#1b1c1f',
          '--dsw-alias-markdown-inline-code': '#232325',
          '--dsw-alias-bg-overlay': '#1b1c1f',
          '--dsw-alias-bg-layer-2': '#202124',
          '--dsw-alias-bg-layer-3': '#25262a',
          '--dsw-specific-input-major': '#1b1c1f',
          '--dsw-specific-selector': '#232325',
          '--dsw-alias-button-elevated-fill': '#43454a',
          '--dsw-alias-button-floating-hover': '#2b2d31',
          '--dsw-alias-markdown-tag': '#2b2d31',
          '--dsw-specific-bubble': '#1b1c1f',
          '--dsw-specific-bubble-highlight': '#25262a',
        }),
      },
      // 干扰项：不是 body 选择器，探针必须忽略它。
      { selectorText: '.dts-something', style: makeRuleStyle({ '--dsw-alias-link': '#123456' }) },
    ],
  }]
}

function createDom() {
  const byId = new Map()
  const events = []
  function makeStyle() {
    const props = new Map()
    return {
      setProperty(name, value) { props.set(name, String(value)) },
      removeProperty(name) { props.delete(name) },
      getPropertyValue(name) { return props.get(name) ?? '' },
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
      set className(value) { this.setAttribute('class', value) },
      get firstChild() { return this.children[0] ?? null },
      appendChild(child) {
        this.children.push(child)
        child.parentNode = this
        if (child.id) byId.set(child.id, child)
        return child
      },
      insertBefore(child) {
        this.children.unshift(child)
        child.parentNode = this
        if (child.id) byId.set(child.id, child)
        return child
      },
      removeChild(child) {
        this.children = this.children.filter((item) => item !== child)
        child.parentNode = null
        return child
      },
      remove() {
        this.isConnected = false
        if (this.parentNode) this.parentNode.removeChild(this)
        if (this.id) byId.delete(this.id)
      },
      setAttribute(name, value) { this.attributes[name] = String(value) },
      getAttribute(name) { return name in this.attributes ? this.attributes[name] : null },
      removeAttribute(name) { delete this.attributes[name] },
      hasAttribute(name) { return name in this.attributes },
      addEventListener(type, fn) { events.push({ el: el, type: type, fn: fn }) },
      removeEventListener(type, fn) {
        const at = events.findIndex((item) => item.el === el && item.type === type && item.fn === fn)
        if (at >= 0) events.splice(at, 1)
      },
      contains(other) {
        let node = other
        while (node) { if (node === el) return true; node = node.parentNode }
        return false
      },
      querySelector(selector) {
        const wanted = String(selector).replace(/^\./, '')
        const find = (node) => {
          for (const child of node.children) {
            if (String(child.className ?? '').split(/\s+/).includes(wanted)) return child
            const nested = find(child)
            if (nested !== null) return nested
          }
          return null
        }
        return find(el)
      },
      getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 } },
      querySelectorAll: () => [],
      setPointerCapture() {},
      play() { return Promise.resolve() },
      pause() {},
      click() { fire(el, 'click', {}) },
      // 焦点跟踪：用于断言"打开模态移入焦点、关闭后归还"。
      focus() { activeElement = el },
      classList: {
        _set: new Set(),
        add() { for (const name of arguments) this._set.add(name) },
        remove() { for (const name of arguments) this._set.delete(name) },
        contains(name) { return this._set.has(name) },
      },
    }
    return el
  }
  /** 派发一个事件：让"点浮动按钮""按 Esc"这类交互真的可测。 */
  function fire(target, type, init) {
    const event = Object.assign({
      type: type,
      target: target,
      currentTarget: target,
      preventDefault() {},
      stopPropagation() {},
    }, init || {})
    for (const item of events.slice()) {
      if (item.el === target && item.type === type) item.fn(event)
    }
    return event
  }
  let activeElement = null
  const documentElement = makeElement('html')
  const head = makeElement('head')
  const body = makeElement('body')
  documentElement.appendChild(head)
  documentElement.appendChild(body)
  activeElement = body
  const doc = {
    documentElement: documentElement,
    head: head,
    body: body,
    styleSheets: createTokenSheets(),
    visibilityState: 'visible',
    fullscreenElement: null,
    get activeElement() { return activeElement },
    createElement: makeElement,
    getElementById: (id) => byId.get(id) ?? null,
    // document 级监听也要记录：模态的 Esc 处理挂在 document 上。
    addEventListener(type, fn) { events.push({ el: doc, type: type, fn: fn }) },
    removeEventListener(type, fn) {
      const at = events.findIndex((item) => item.el === doc && item.type === type && item.fn === fn)
      if (at >= 0) events.splice(at, 1)
    },
    querySelectorAll: () => [],
  }
  return { doc: doc, byId: byId, events: events, fire: fire, docEvents: events }
}

/** 极简 React 替身：本测试不跑交互树，只要 API 齐备、能被调用而不抛。 */
function createReactStub() {
  function createElement(type, props) {
    return {
      $$typeof: 'element',
      type: type,
      props: props ?? {},
      children: Array.prototype.slice.call(arguments, 2),
    }
  }
  return {
    createElement: createElement,
    cloneElement: (el, props) => Object.assign({}, el, { props: Object.assign({}, el.props, props) }),
    useState: (initial) => [initial, () => {}],
    useEffect: () => {},
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
  }
}

/** 官方控件替身：用来验证"能拿到就用官方组件"的降级链。 */
function createPrimitivesStub() {
  const mark = (name) => function Primitive() { return { $$typeof: 'element', type: name, props: {}, children: [] } }
  return {
    Button: mark('P.Button'),
    Input: mark('P.Input'),
    Switch: mark('P.Switch'),
    Pill: mark('P.Pill'),
    StateDot: mark('P.StateDot'),
    Toast: mark('P.Toast'),
    Tooltip: mark('P.Tooltip'),
    Checkbox: mark('P.Checkbox'),
  }
}

function loadBundle(options) {
  const opts = options ?? {}
  const dom = createDom()
  const registrations = []
  const primitives = opts.primitives === false ? null : createPrimitivesStub()
  const sandbox = {
    console: console,
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
    Promise: Promise, Object: Object, Array: Array, JSON: JSON, Math: Math, Number: Number,
    String: String, Boolean: Boolean, Error: Error, TypeError: TypeError, RegExp: RegExp,
    Date: Date, Set: Set, Map: Map, Symbol: Symbol, Intl: Intl, Function: Function,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent, URL: URL,
    window: {
      __DTS_BOOT__: 'boot' in opts ? opts.boot : {},
      __ModuleLoader__: { load: (registration) => registrations.push(registration) },
      // 界面偏好的落点：client.js 的 readLocal/writeLocal 都包了 try，
      // 但"页签记忆"要断言真的写进去了，所以给一个可用的内存实现。
      localStorage: opts.localStorage ?? (() => {
        const store = new Map()
        return {
          store,
          getItem: (key) => (store.has(key) ? store.get(key) : null),
          setItem: (key, value) => { store.set(key, String(value)) },
          removeItem: (key) => { store.delete(key) },
        }
      })(),
      addEventListener() {},
      removeEventListener() {},
      requestAnimationFrame: (fn) => setTimeout(() => fn(0), 0),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      innerWidth: 1600,
      innerHeight: 900,
    },
    document: dom.doc,
    navigator: { language: opts.language ?? 'zh-CN' },
    location: { origin: 'http://127.0.0.1:3080' },
    fetch: opts.fetch ?? (async () => ({ ok: true, status: 200, json: async () => ({ ok: true, value: {} }) })),
    EventSource: function EventSource() {
      this.addEventListener = () => {}
      this.close = () => {}
    },
    Image: function Image() {
      this.addEventListener = (type, fn) => { if (type === 'error') setTimeout(fn, 0) }
    },
    XMLHttpRequest: function XMLHttpRequest() {
      this.open = () => {}
      this.setRequestHeader = () => {}
      this.send = () => {}
      this.addEventListener = () => {}
      this.upload = { addEventListener: () => {} }
    },
    getComputedStyle: (el) => ({ getPropertyValue: (name) => el.style.getPropertyValue(name) }),
    Blob: function Blob() {},
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox.window
  createContext(sandbox)
  runInContext(bundle, sandbox, { filename: 'dsh-theme-studio/client.js' })
  assert.equal(registrations.length, 1, 'bundle 应恰好注册一次')
  assert.equal(registrations[0].id, 'dsh-theme-studio', '注册 id 必须等于包名')
  const modules = {
    react: createReactStub(),
    // createRoot 记下最后一次渲染的节点，模态里的结构才能被断言。
    'react-dom/client': {
      createRoot: (host) => ({
        render(node) { host.__rendered = node },
        unmount() { host.__rendered = null },
      }),
    },
  }
  if (primitives !== null) modules['@deepseek-ai/dsh-client-ui-primitives'] = primitives
  const requested = []
  const exportsFromFactory = registrations[0].factory(function require(specifier) {
    requested.push(specifier)
    if (specifier in modules) return modules[specifier]
    throw new Error('bundle 请求了基座之外的模块：' + specifier)
  })
  return { exports: exportsFromFactory, dom: dom, sandbox: sandbox, requested: requested, primitives: primitives }
}

/* ------------------------------------------------------------------ */
/* Cordis ctx 替身                                                      */
/* ------------------------------------------------------------------ */

function makeCtx(options) {
  const opts = options ?? {}
  const calls = {
    overrideTokens: [],
    setTheme: [],
    setFontSize: [],
    injected: [],
    registrations: [],
    disposers: [],
    events: [],
  }
  const ctx = {
    theme: {
      overrideTokens(source, tokens) {
        calls.overrideTokens.push({ source: source, tokens: tokens })
        return () => {}
      },
      setTheme(id) { calls.setTheme.push(id) },
      setFontSize(px) { calls.setFontSize.push(px) },
      getTheme: () => ({ preference: 'system', fontSize: 14, active: { colorScheme: 'light', tokens: {} }, themes: [] }),
    },
    slots: {
      inject(name, factory) {
        calls.injected.push(name)
        const disposer = factory()
        if (typeof disposer === 'function') calls.disposers.push(disposer)
        return () => {}
      },
      register(regOptions, component) {
        calls.registrations.push({ options: regOptions, component: component })
        return () => {}
      },
    },
    effect(fn) {
      const disposer = fn()
      if (typeof disposer === 'function') calls.disposers.push(disposer)
      return undefined
    },
    on(name, handler) {
      calls.events.push({ name: name, handler: handler })
      return () => {}
    },
    get: (name) => (name === 'locale' ? opts.locale : undefined),
  }
  // ledger 可配置：模拟 settings.section 有没有真的收下这个条目。
  if (opts.entries !== undefined) {
    ctx.slots.entries = typeof opts.entries === 'function'
      ? opts.entries
      : () => (opts.entries ? [{ options: { id: 'dsh-theme-studio' } }] : [])
  }
  return { ctx: ctx, calls: calls }
}

/* ------------------------------------------------------------------ */
/* 投影夹具                                                            */
/* ------------------------------------------------------------------ */

const PROJECTION = {
  revision: 7,
  prefix: '/dsh-theme-studio',
  writeToken: 'tok-123',
  doc: {
    schema: 1,
    preset: 'deepsea',
    base: { scheme: 'dark', fontSize: 16 },
    backdrop: {
      mode: 'image', mediaId: 'abc.png', gradient: 'midnight', fit: 'cover',
      focusX: 40, focusY: 60, scale: 1.2, tile: false, blur: 4, brightness: 90,
      saturate: 110, contrast: 100, grayscale: 0, sepia: 0, hueRotate: 0,
      dim: 0.3, veilColor: '#000000', veilGradient: true, kenBurns: false,
      kenBurnsSeconds: 40, parallax: 0,
      video: { muted: true, loop: true, autoplay: true, playbackRate: 1 },
      fadeOnFocus: false,
    },
    glass: { enabled: true, alpha: 0.6, blur: 18, saturate: 160 },
    palette: { accent: '#ff6a3d', autoAccent: true, tokens: { '--dsw-alias-bg-base': { light: '#ffffff', dark: '#0a0c12' } } },
    type: { uiFont: '', codeFont: '', letterSpacing: 0, families: [] },
    shape: { cornerShape: 1.8, motionSpeed: 1, scrollbar: 'native', reduceMotion: false },
    advanced: { css: '' },
  },
  media: {
    'abc.png': { id: 'abc.png', name: 'wall.png', mime: 'image/png', kind: 'image', bytes: 12345, width: 3840, height: 2160 },
  },
  css: '.dts-layer--css { background-image: url("/dsh-theme-studio/media/abc.png/wall.png"); }',
  tokenLayers: {
    '--dsw-alias-bg-base': { light: '#ffffff', dark: '#0a0c12' },
    // 故意只给一侧：浏览器半必须补齐，绝不把空串交给宿主。
    '--dsw-alias-label-primary': { light: '#101418', dark: '' },
  },
  glassSurfaces: ['--dsw-alias-bg-base', '--dsw-specific-sidebar-fill'],
  tokenGroups: [{ id: 'surface', label: '表面', tokens: [{ name: '--dsw-alias-bg-base', label: '应用底色' }] }],
  presets: [{ id: 'deepsea', name: '深海', accent: '#2f8fd6', mood: 'cool', backdrop: 'gradient', gradient: 'midnight' }],
  gradients: { midnight: { label: '午夜', angle: 160, stops: ['#05070f', '#0f1b3d'] } },
}

const stateFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true, value: PROJECTION }),
})

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/* 用例                                                                */
/* ------------------------------------------------------------------ */

it('bundle 只 require 基座模块，并导出 Cordis 契约', () => {
  const loaded = loadBundle()
  // react 必给；react-dom/client 与 ui-primitives 是基座静态表里的可选项。
  assert.deepEqual(loaded.requested.slice().sort(), [
    '@deepseek-ai/dsh-client-ui-primitives',
    'react',
    'react-dom/client',
  ])
  assert.equal(loaded.exports.name, 'dsh-theme-studio')
  // exports.inject 由沙箱语境创建，原型与测试文件不同 ⇒ 按内容比较而不是深比字面量。
  assert.deepEqual(Array.from(loaded.exports.inject), ['slots', 'theme'])
  assert.equal(typeof loaded.exports.apply, 'function')
})

it('基座缺 ui-primitives 时只降级，不抛', () => {
  const loaded = loadBundle({ primitives: false })
  assert.equal(typeof loaded.exports.apply, 'function')
  assert.ok(loaded.requested.indexOf('react') !== -1)
})

it('apply() 把成对令牌交给 theme，注入样式与背景层，并挂上设置页入口', async () => {
  const loaded = loadBundle({ boot: { prefix: '/dsh-theme-studio', writeToken: 'tok-123' } })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(80)

  assert.ok(calls.overrideTokens.length >= 1, '至少注入一次令牌层')
  const layer = calls.overrideTokens[calls.overrideTokens.length - 1]
  assert.equal(layer.source, 'dsh-theme-studio')
  const names = Object.keys(layer.tokens)
  assert.ok(names.length > 0)
  for (const name of names) {
    assert.notEqual(layer.tokens[name].light, '', name + ' 缺 light 值')
    assert.notEqual(layer.tokens[name].dark, '', name + ' 缺 dark 值')
  }
  // 单侧缺值要按页面基准补齐（夹具里深色侧的基准是 #151517 那套）。
  assert.equal(layer.tokens['--dsw-alias-label-primary'].dark, '#f2f4f8')
  // 玻璃表面按基准色重铸出来，且用户显式写过的令牌让位。
  assert.ok(names.includes('--dsw-specific-sidebar-fill'), '玻璃表面应进令牌层')
  assert.equal(layer.tokens['--dsw-alias-bg-base'].dark, '#0a0c12')
  // 明暗与字号一律走宿主 theme 服务。
  assert.deepEqual(calls.setTheme, ['dark'])
  assert.deepEqual(calls.setFontSize, [16])

  const styleEl = loaded.dom.byId.get('dts-layer-style')
  assert.ok(styleEl, '样式标签应被注入')
  assert.match(styleEl.textContent, /dts-layer--css/)
  assert.ok(loaded.dom.byId.get('dts-backdrop'), '背景层应被创建')
  assert.ok(loaded.dom.doc.body.classList.contains('dts-on'), 'body 应标记主题工坊已生效')
  assert.ok(loaded.dom.byId.get('dts-fab'), '右下角浮动按钮应存在')

  // 首选官方 settings.section，且不越界占用别的槽。
  assert.deepEqual(calls.injected, ['settings.section'])
  const registration = calls.registrations[0]
  assert.equal(registration.options.id, 'dsh-theme-studio')
  assert.equal(registration.options.label, '主题工坊')
  assert.equal(typeof registration.component, 'function')
})

it('ledger 说没落地时，回退到「通用设置」一行（入口消失就是功能退化）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: false })
  loaded.exports.apply(ctx)
  await tick(80)
  assert.deepEqual(calls.injected, ['settings.section', 'settings.general.item'])
})

it('语言以 locale 服务为权威源，变化时先撤销旧注册再按新文案重新注册', async () => {
  const loaded = loadBundle({ boot: {}, language: 'zh-CN' })
  loaded.sandbox.fetch = stateFetch
  const registered = []
  const locale = {
    active: 'zh',
    getSnapshot() { return { active: this.active, revision: 1 } },
    subscribe() { return () => {} },
    // 官方词典注册面（locale.register）：zh/en 词典应进 locale 服务目录。
    register(ns, dicts) { registered.push({ ns, dicts }); return () => {} },
  }
  const { ctx, calls } = makeCtx({ entries: true, locale: locale })
  loaded.exports.apply(ctx)
  await tick(80)
  assert.equal(registered.length, 1, 'zh/en 文案表应注册进官方 locale 服务')
  assert.equal(registered[0].ns, 'dsh-theme-studio')
  assert.deepEqual(Object.keys(registered[0].dicts).sort(), ['en', 'zh'])
  const { MESSAGES } = loaded.exports.__internals
  assert.equal(registered[0].dicts.zh, MESSAGES.zh, '词典必须与自研 t() 同源（同一 MESSAGES 对象），不漂移')
  assert.equal(calls.registrations.length, 1, '首次只注册一个设置页条目')
  assert.equal(calls.registrations[0].options.label, '主题工坊')

  // 宿主切到英文：locale 服务变更 → 先 dispose 旧注册，再用英文文案重新注册。
  locale.active = 'en'
  const notify = calls.events.find((item) => item.name === 'locale/change')
  assert.ok(notify, '应订阅 locale/change')
  notify.handler()
  await tick(20)

  assert.equal(calls.registrations.length, 2, '换语言应追加一次重新注册')
  const latest = calls.registrations[calls.registrations.length - 1]
  assert.equal(latest.options.label, 'Theme Studio')
  assert.equal(latest.options.id, 'dsh-theme-studio', '重新注册要用同一个 id，否则会留下双入口')
  // 旧注册必须被撤销：list 槽同 id + 同 priority 重复注册会 throw。
  assert.ok(calls.disposers.length >= 1)
})

it('宿主 theme 服务缺件时不崩（版本漂移兜底）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  ctx.theme = {}
  loaded.exports.apply(ctx)
  await tick(80)
  assert.ok(calls.injected.includes('settings.section'), '即使没有 theme 服务，入口也要在')
})

it('接口不通时只报错，不抛到宿主', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = async () => { throw new Error('connection refused') }
  const { ctx, calls } = makeCtx({ entries: true })
  assert.doesNotThrow(() => loaded.exports.apply(ctx))
  await tick(80)
  assert.ok(calls.injected.includes('settings.section'))
})

it('卸载时撤空令牌层并回收 DOM 与定时器', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(80)
  const before = calls.overrideTokens.length
  calls.disposers.forEach((dispose) => dispose())
  assert.ok(calls.overrideTokens.length > before, '卸载应再写一次空层把自己撤掉')
  const last = calls.overrideTokens[calls.overrideTokens.length - 1]
  // 沙箱语境与普通语境的原型不同，按结构断言而不是深比较字面量。
  assert.deepEqual(Object.keys(last.tokens), [], '卸载必须把令牌撤成空层')
  assert.equal(loaded.dom.byId.has('dts-fab'), false, '浮动按钮应被移除')
  assert.equal(loaded.dom.byId.has('dts-backdrop'), false, '背景层应被移除')
  assert.equal(loaded.dom.byId.has('dts-layer-style'), false, '背景样式应被回收')
  assert.equal(loaded.dom.byId.has('dts-chrome-style'), false, '界面样式应被回收')
})

it('语言解析链：locale 服务优先，其次 html lang，最后 navigator', () => {
  const { normalizeLang, MESSAGES } = loadBundle().exports.__internals
  assert.equal(normalizeLang('zh-CN'), 'zh')
  assert.equal(normalizeLang('en-GB'), 'en')
  assert.equal(normalizeLang('fr-FR'), '')
  assert.equal(normalizeLang(undefined), '')
  // 两套文案的键必须一致，缺一个就会在切换语言时露出原始 key。
  const zh = Object.keys(MESSAGES.zh).sort()
  const en = Object.keys(MESSAGES.en).sort()
  assert.deepEqual(zh, en)
})

it('玻璃重铸保留 RGB 只改 alpha，解析不了的原样返回', () => {
  const { withAlphaCss, contrastRatio, humanBytes, toHex, clamp } = loadBundle().exports.__internals
  assert.equal(withAlphaCss('#0a0c12', 0.6), 'rgba(10, 12, 18, 0.6)')
  assert.equal(withAlphaCss('rgb(10, 12, 18)', 0.25), 'rgba(10, 12, 18, 0.25)')
  assert.equal(withAlphaCss('var(--x)', 0.5), 'var(--x)')
  assert.equal(toHex('rgb(255, 106, 61)'), '#ff6a3d')
  assert.equal(contrastRatio('#000000', '#ffffff'), 21)
  assert.equal(humanBytes(12345), '12.1 KB')
  assert.equal(clamp(9, 0, 5), 5)
})

it('样式表里每个 token 引用都带兜底值，且只碰自家类', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  // 宿主令牌缺失时不能出现 transparent/invalid。
  const bare = CHROME_CSS.match(/var\(--dsw-[a-z0-9-]+\)/gi) ?? []
  assert.deepEqual(bare, [], '存在没有兜底值的 token 引用：' + bare.join(', '))
  // box-sizing 的作用域必须全是自家 dts-* 类，不能污染官方组件。
  const parsed = parseCss(CHROME_CSS)
  const boxRules = parsed.find((selector) => parsed.rule(selector).get('box-sizing') === 'border-box')
  assert.ok(boxRules.length >= 1, '应有 box-sizing 规则')
  // 并集拆分后逐成员各成一条：意图是作用域不越界，全部限 .dts-*。
  for (const { selector } of boxRules) {
    assert.match(selector, /^\.dts-/, '越界选择器：' + selector)
  }
})

it('双引擎颜色工具交叉一致（D3：两份实现曾有 <0.01 取色漂移）', () => {
  const { contrastRatio, relativeLuminance, rgbToHsl, withAlphaCss } = loadBundle().exports.__internals
  const samples = [
    { r: 255, g: 106, b: 61 }, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 },
    { r: 10, g: 12, b: 18 }, { r: 65, g: 118, b: 230 }, { r: 127, g: 127, b: 127 },
  ]
  for (const rgb of samples) {
    const hex = '#' + [rgb.r, rgb.g, rgb.b].map((n) => n.toString(16).padStart(2, '0')).join('')
    assert.equal(relativeLuminance(hex), engineLuminance(hex), `亮度不一致：${hex}`)
    assert.equal(contrastRatio(hex, '#ffffff'), engineContrast(hex, '#ffffff'), `对比度不一致：${hex}`)
    // 跨 vm 语境原型不同（沙箱 Object ≠ 宿主 Object），逐字段标量比较而非深比对象。
    const clientHsl = rgbToHsl(rgb)
    const engineHsl = engineRgbToHsl(rgb)
    for (const axis of ['h', 's', 'l']) {
      assert.equal(clientHsl[axis], engineHsl[axis], `rgbToHsl.${axis} 必须同口径 round2：${hex}`)
    }
    assert.match(withAlphaCss(hex, 0.5), /^rgba\(\d+, \d+, \d+, 0\.5\)$/, 'rgba 输出两端同形')
  }
})

it('浮动按钮只画图标，不带文字（带文字的胶囊会压住聊天输入区）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-fab', 'width'), '34px')
  assert.equal(declOf(parsed, '.dts-fab', 'border-radius'), '50%')
  assert.equal(declOf(parsed, '.dts-fab', 'position'), 'fixed')
  assert.equal(declOf(parsed, '.dts-fab[data-hidden="true"]', 'opacity'), '0')
  assert.equal(declOf(parsed, '.dts-fab[data-hidden="true"]', 'pointer-events'), 'none')
})

/* ------------------------------------------------------------------ */
/* 交互层：FAB → 模态 → 焦点归还 → 确认框 → 碰撞避让 → 官方控件         */
/* ------------------------------------------------------------------ */

/** 深度遍历渲染树，收集满足条件的元素节点。 */
function findNodes(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) findNodes(item, predicate, out)
    return out
  }
  if (node.$$typeof === 'element') {
    if (predicate(node.props ?? {})) out.push(node)
    for (const value of Object.values(node.props ?? {})) findNodes(value, predicate, out)
    findNodes(node.children, predicate, out)
  }
  return out
}

/** 从已注册的设置页条目里取回组件与 inject 面（组件唯一的依赖来源）。 */
function panelHandle(calls) {
  const reg = calls.registrations.find((item) => item.options.name === 'settings.section')
  assert.ok(reg, '设置页条目应已注册')
  return { component: reg.component, face: reg.options.inject() }
}

it('点浮动按钮打开模态，Esc 关闭并把焦点交还原处', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)

  const fab = loaded.dom.byId.get('dts-fab')
  assert.ok(fab, '浮动按钮应存在')
  fab.focus()
  loaded.dom.fire(fab, 'click')
  await tick(20)

  const host = loaded.dom.byId.get('dts-modal-host')
  assert.ok(host, '点 FAB 应创建模态宿主')
  assert.ok(host.__rendered, '模态宿主应被渲染')

  // 重复点击不得叠第二个模态。
  loaded.dom.fire(fab, 'click')
  const hosts = loaded.dom.doc.body.children.filter((child) => child.id === 'dts-modal-host')
  assert.equal(hosts.length, 1, '模态必须幂等，不得叠加')

  loaded.dom.fire(loaded.dom.doc, 'keydown', { key: 'Escape' })
  await tick(20)
  assert.equal(loaded.dom.byId.has('dts-modal-host'), false, 'Esc 应关闭模态')
  assert.equal(host.__rendered, null, '关闭应卸载 React root')
  assert.equal(loaded.dom.doc.activeElement, fab, '焦点应归还浮动按钮')
})

it('模态自我声明为 dialog；页面变体不是模态，只靠 data-variant 分版面', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)

  const page = findNodes(component(face), (props) => props['data-variant'] !== undefined)
  assert.equal(page.length, 1)
  assert.equal(page[0].props['data-variant'], 'page')
  assert.equal(findNodes(component(face), (props) => props['aria-modal'] === 'true').length, 0,
    '页面变体不该自称模态')

  const modalTree = component(Object.assign({}, face, { onRequestClose() {} }))
  const variant = findNodes(modalTree, (props) => props['data-variant'] !== undefined)
  assert.equal(variant[0].props['data-variant'], 'modal')
  const dialog = findNodes(modalTree, (props) => props.role === 'dialog')
  assert.equal(dialog.length, 1, '模态必须声明 role=dialog')
  assert.equal(dialog[0].props['aria-modal'], 'true')
  assert.equal(dialog[0].props['aria-label'], '主题工坊')
})

it('删除走确认框：取消不发请求，确认才发 force 删除', async () => {
  const loaded = loadBundle({ boot: {} })
  const deleted = []
  loaded.sandbox.fetch = async (url, init) => {
    const method = String((init && init.method) || 'GET').toUpperCase()
    if (method === 'DELETE' && String(url).includes('/api/media/')) deleted.push(String(url))
    return { ok: true, status: 200, json: async () => ({ ok: true, value: PROJECTION }) }
  }
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)
  const env = face.env

  // 确认框现在是 e() 惰性元素：按它独有的 props 形状（title+onDone）找元素，
  // 再直调组件函数验证其内部 dialog 语义 —— 白屏修复后 hooks 归各自 fiber。
  const dialogOf = (tree) => findNodes(tree, (p) => typeof p.title === 'string' && typeof p.onDone === 'function')
  assert.equal(dialogOf(component(face)).length, 0,
    '未触发动作时不该有确认框')

  const cancel = env.askDelete(PROJECTION.media['abc.png'])
  const opened = dialogOf(component(face))
  assert.equal(opened.length, 1,
    '破坏性动作必须先弹确认框')
  const inner = findNodes(opened[0].type(opened[0].props), () => true)
  assert.ok(inner.some((n) => n.props.role === 'dialog' && n.props['aria-modal'] === 'true'),
    '确认框必须声明 role=dialog')
  env.answerDialog(false)
  await cancel
  assert.equal(deleted.length, 0, '取消后不得发出删除请求')

  const accept = env.askDelete(PROJECTION.media['abc.png'])
  env.answerDialog(true)
  await accept
  await tick(40)
  assert.equal(deleted.length, 1, '确认后应真的发出删除')
  assert.match(deleted[0], /force=1$/, '确认框本身就是意图证明，删除要带 force')
  assert.equal(dialogOf(component(face)).length, 0,
    '答完必须收回确认框')
})

it('浮动按钮只在真被输入区抢位时让位，输入区离开就恢复', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const fab = loaded.dom.byId.get('dts-fab')
  assert.equal(fab.getAttribute('data-hidden'), 'false', '默认不让位')

  // 宽输入框伸进视口底部 200px 带内 ⇒ 让位。
  loaded.dom.doc.querySelectorAll = () => [{
    getBoundingClientRect: () => ({ width: 1200, height: 90, bottom: 880, left: 0, top: 790 }),
  }]
  await tick(700)
  assert.equal(fab.getAttribute('data-hidden'), 'true', '被抢位时应让位')

  // 窄元素（消息里的代码块等）不算主输入区 ⇒ 恢复可见。
  loaded.dom.doc.querySelectorAll = () => [{
    getBoundingClientRect: () => ({ width: 120, height: 40, bottom: 880, left: 0, top: 840 }),
  }]
  await tick(700)
  assert.equal(fab.getAttribute('data-hidden'), 'false', '窄元素不该触发让位')
})

it('官方控件在位时用官方组件，缺失时退回原生元素', async () => {
  const withP = loadBundle({ boot: {} })
  withP.sandbox.fetch = stateFetch
  const made = makeCtx({ entries: true })
  withP.exports.apply(made.ctx)
  await tick(40)
  const { component, face } = panelHandle(made.calls)
  const nodes = findNodes(component(face), () => true)
  assert.ok(nodes.some((node) => node.type === withP.primitives.Button), '按钮应交给官方 Button')
  assert.ok(nodes.some((node) => node.props.role === 'tab'), '页签必须带 tab 角色')
  assert.ok(nodes.some((node) => node.props.role === 'tablist'), '页签栏必须带 tablist 角色')

  const bare = loadBundle({ boot: {}, primitives: false })
  bare.sandbox.fetch = stateFetch
  const bareMade = makeCtx({ entries: true })
  bare.exports.apply(bareMade.ctx)
  await tick(40)
  const barePanel = panelHandle(bareMade.calls)
  const bareNodes = findNodes(barePanel.component(barePanel.face), () => true)
  assert.ok(bareNodes.some((node) => node.type === 'button'), '缺官方控件时要能退回原生 button')
  assert.ok(bareNodes.every((node) => node.type !== withP.primitives.Button))
})

it('页签选择落到 localStorage，重建组件后仍是那一页', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)

  const tabs = findNodes(component(face), (props) => props.role === 'tab')
  assert.ok(tabs.length >= 4, '应有多个页签')
  const TAB_LIST = loaded.exports.__internals.TABS
  // 文案走 createElement 的可变参数，落在 children 上而不是 props.children。
  assert.equal(face.t(TAB_LIST[2].key), tabs[2].children[0])
  tabs[2].props.onClick()
  assert.equal(loaded.sandbox.window.localStorage.getItem('dts:active-tab'), TAB_LIST[2].id,
    '页签要写进 localStorage，换语言重建组件后才不丢')
})

it('hook 组件禁止当函数直调 —— 「恢复默认」白屏的回归锁', () => {
  // 根因复盘：ConfirmDialog/Uploader/FocusPad/CustomTokenAdder 内含
  // useState/useEffect/useRef。以 Name({...}) 形式直调时，它们的 hooks 记在**父组件**
  // 的 fiber 上；一旦调用点位于条件分支（state.dialog ? … : null），分支翻转就让父
  // 组件两次渲染的 hooks 数量对不上，React 直接抛 "Rendered more hooks"，整个面板
  // 白屏 —— 点「恢复默认」弹确认框就是第一发。修法只有一个：e(Name, {...})，
  // 让 hooks 归组件自己的 fiber。此测试静态扫描源码，防止再犯。
  const hookComponents = ['Uploader', 'FocusPad', 'ConfirmDialog', 'CustomTokenAdder', 'ProfileTab', 'Choice']
  for (const name of hookComponents) {
    const direct = new RegExp(`(^|[^\\w.$])${name}\\(\\{`, 'm')
    assert.ok(!direct.test(bundle), `${name} 被当函数直调了（应 e(${name}, {…})），会白屏`)
    // 页签组件经 e(Current, …) 变量分发渲染，不存在字面量 e(名字, 调用点。
    if (name === 'ProfileTab') continue
    assert.ok(bundle.includes(`e(${name},`), `${name} 应有 e() 渲染点`)
  }
})

it('回归锁 · 前端契约同步宿主：键盘导航 / 焦点陷阱 / 动效令牌（交叉核验）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  // ⚠️ 产物引号风格由生产方决定：手写切片用单引号，rolldown 打印器统一双引号
  // （r1-probe 实测 + TS 产线实测）。锁只认「字面量存在」，不绑定引号风格。
  const hasLiteral = (text) => bundle.includes(`'${text}'`) || bundle.includes(`"${text}"`)
  // 下拉键盘契约（ui-primitives/Menu.tsx 就地核验）：↑↓ wrap / Home / End / Enter。
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.ok(hasLiteral(key), `下拉键盘缺少 ${key}（对齐官方 Menu）`)
  }
  // 页签键盘契约（ui-dockkit/TabPanel.tsx 就地核验）：←→ wrap + roving tabindex。
  assert.ok(hasLiteral('ArrowLeft'), '页签键盘缺少 ←（对齐官方 TabPanel manual activation）')
  assert.ok(/tabIndex:\s*active === item\.id \? 0 : -1/.test(bundle),
    '页签必须 roving tabindex，方向键只移焦点、Enter/Space 才激活（TabPanel 契约）')
  // 焦点陷阱（ui-primitives/ImageLightbox.tsx 就地核验）：Tab 圈闭在模态/对话框内。
  assert.ok(bundle.includes('nodes.indexOf(document.activeElement)'),
    '模态/确认框必须有 Tab 焦点陷阱（对齐官方 ImageLightbox）')
  // Esc 归属（Menu 契约）：下拉开着时 Esc 归下拉，不得一击关掉整个模态。
  assert.ok(/document\.querySelector\(\s*['"]\.dts-select-menu['"]\s*\)/.test(bundle),
    'watchModalEscape 必须让下拉优先处理 Esc（document capture 会抢跑，实测）')
  // 动效令牌（ui-theme/src/styles/base.css 实证：--ds-ease-in-out / duration 0.2/fast 0.1/slow 0.3）。
  const parsed = parseCss(CHROME_CSS)
  const transitions = parsed.find(() => true)
    .flatMap(({ selector, decls }) => [...decls.entries()].map(([prop, value]) => ({ selector, prop, value })))
  assert.ok(transitions.some((d) => d.value.includes('var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)')),
    '动效必须走 --ds-transition-duration / --ds-ease-in-out 权威令牌，不散落硬编码')
  assert.equal(declOf(parsed, '.dts-select-menu', 'animation'),
    'dts-menu-in var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)', '下拉开合动画走 fast 档令牌')
  assert.equal(declOf(parsed, '.dts-select-menu', 'border'),
    '1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08))', '浮层描边走 border-l 令牌（hairline 体系对齐）')
  // 下拉弹层压正文：高实度挡字 + blur 糊化（0.15 薄玻璃会与背后文字叠读，实测）。
  assert.equal(declOf(parsed, '.dts-select-menu', 'background'), 'rgba(16,20,24,.88)!important',
    '下拉弹层必须高实度（0.88）挡住后面的字，不能透')
  assert.equal(declOf(parsed, '.dts-select-menu', 'backdrop-filter'),
    'var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important', '下拉弹层保留 blur 糊化背景（毛玻璃质感）')
  // 原生弹层兜底深色化（color-scheme 是系统弹层唯一可靠外观开关）。
  for (const selector of ['select', '.dts-select-trigger']) {
    assert.equal(declOf(parsed, selector, 'color-scheme'), 'dark',
      '原生 select 弹层必须 color-scheme:dark 兜底，旧缓存下浅灰透字弹层实测')
  }
})

it('「我的方案」注册进 TABS 第二位，高级页旧主题档区块已迁走', () => {
  const { TABS } = loadBundle().exports.__internals
  assert.equal(TABS[1].id, 'profile', '方案页紧跟预设，符合"随时切换"的定位')
  assert.ok(TABS.some((tab) => typeof tab.view === 'function' && tab.view.name === 'ProfileTab'))
  assert.ok(!bundle.includes("'adv.themes'"), '高级页不该再残留主题档区块')
})

it('每个自绘交互控件都有可见焦点环（官方控件缺失时 Tab 不能看不见）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  // 收集所有 :focus-visible 规则里点到的类名（结构化解析，不抠文本）。
  const covered = new Set()
  for (const { selector } of parseCss(CHROME_CSS).find((s) => s.includes(':focus-visible'))) {
    for (const m of selector.matchAll(/\.dts-[a-z0-9-]+/g)) covered.add(m[0])
  }
  // 这些是 ui-primitives 缺席时真正会被渲染出来的可交互元素。
  const interactive = ['.dts-btn', '.dts-pill', '.dts-switch', '.dts-input', '.dts-tab',
    '.dts-fab', '.dts-swatch', '.dts-drop', '.dts-select-option']
  const missing = interactive.filter((cls) => !covered.has(cls))
  assert.deepEqual(missing, [], `这些控件缺 :focus-visible 焦点环：${missing.join(', ')}`)
})

it('点亮壁纸自动开玻璃质感；卡片按钮走官方 sm 尺寸（壁纸不被盖、窄卡不溢出）', async () => {
  const glassOff = JSON.parse(JSON.stringify(PROJECTION))
  glassOff.doc.backdrop.mode = 'none'
  glassOff.doc.backdrop.mediaId = ''
  glassOff.doc.glass.enabled = false
  // 模拟引擎默认浓度（fixture 里是 0.6，默认真实值是 0.72 —— 白纱档）。
  glassOff.doc.glass.alpha = 0.72
  const saves = []
  const loaded = loadBundle({
    boot: {},
    localStorage: (() => {
      const store = new Map([['dts:active-tab', 'library']])
      return {
        store,
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)) },
      }
    })(),
  })
  loaded.sandbox.fetch = async (url, init) => {
    if (init && String(init.method).toUpperCase() === 'PUT') saves.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => ({ ok: true, value: glassOff }) }
  }
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)
  const env = face.env

  // 「设为背景」= 模式 + 素材 + 透出，一次到位；乐观态立即可见，不等回包。
  env.activateBackdrop('image', 'abc.png')
  assert.equal(env.engine.get().doc.backdrop.mode, 'image')
  assert.equal(env.engine.get().doc.glass.enabled, true,
    '不透明表面会把壁纸整个盖住 —— 点亮壁纸必须同时透出')
  await tick(320)
  assert.equal(saves.length, 1, 'activateBackdrop 必须真的落盘')
  assert.equal(saves[0].doc.backdrop.mediaId, 'abc.png')
  assert.equal(saves[0].doc.glass.enabled, true, '落盘文档同样带上玻璃开启')
  assert.equal(saves[0].doc.glass.alpha, 0.45,
    '自动开启必须把 0.72 的默认浓度压到真能看见的档位，否则等于白纱盖壁纸')
  assert.equal(saves[0].expectRevision, PROJECTION.revision,
    '回归锁 B：编辑流必须带乐观锁基准，否则双标签页后写静默覆盖先写')

  // 反向：关壁纸不许顺手改玻璃开关（玻璃是独立审美决定）。
  const glassBefore = env.engine.get().doc.glass.enabled
  env.setBackdropMode('none')
  assert.equal(env.engine.get().doc.backdrop.mode, 'none')
  assert.equal(env.engine.get().doc.glass.enabled, glassBefore, '关壁纸不该擅自动玻璃')

  // 卡片按钮必须走官方 sm：窄卡里两个按钮不许撑爆裁切。
  const tree = findNodes(component(face), () => true)
  const tabNode = tree.find((n) => typeof n.type === 'function' && n.type.name === 'LibraryTab')
  assert.ok(tabNode, 'library 页签应从 localStorage 恢复并渲染')
  const cards = findNodes(tabNode.type(tabNode.props), () => true)
  const buttons = cards.filter((n) => n.type === loaded.primitives.Button)
  assert.ok(buttons.length >= 2, '素材卡应有动作按钮')
  assert.ok(buttons.every((n) => n.props.size === 'sm'), '卡片按钮必须 sm 尺寸')
})

it('玻璃基准只收颜色字面量：body 规则里的 var() 引用交给 computed 解析', async () => {
  const loaded = loadBundle({ boot: {} })
  // 复刻真实 design-platform.css 的形状：body 规则声明的是 var(--static-…) 引用。
  // 复刻真实 design-platform.css 的形状：body 规则声明的是 var(--static-…) 引用。
  // label-primary 一并保留：它是对比自愈的文字基准，缺了会被自愈判成白底白字翻深。
  loaded.dom.doc.styleSheets[0].cssRules[0].style = makeRuleStyle({
    '--dsw-alias-bg-base': 'var(--dsw-static-neutral-bluish-00)',
    '--dsw-alias-label-primary': '#0f1115',
  })
  loaded.sandbox.getComputedStyle = () => ({
    getPropertyValue: (name) => (name === '--dsw-alias-bg-base' ? 'rgb(255, 255, 255)' : ''),
  })
  // fixture 里 bg-base 是"用户显式令牌"——按设计它必须赢过玻璃；这里把它从
  // 显式表与服务器层里都删掉，让玻璃重铸路径真正接管，才能验证 var() 守卫。
  const clean = JSON.parse(JSON.stringify(PROJECTION))
  delete clean.tokenLayers['--dsw-alias-bg-base']
  delete clean.doc.palette.tokens['--dsw-alias-bg-base']
  loaded.sandbox.fetch = async () => ({
    ok: true, status: 200, json: async () => ({ ok: true, value: clean }),
  })
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)

  const layer = calls.overrideTokens[calls.overrideTokens.length - 1]
  const base = layer.tokens['--dsw-alias-bg-base']
  assert.ok(base, 'bg-base 应在玻璃重铸清单里')
  assert.doesNotMatch(base.light + base.dark, /var\(/,
    '把 var() 引用原样写回 override 等于玻璃静默失效')
  assert.equal(base.light, 'rgba(255, 255, 255, 0.6)',
    '必须用 computed 解析后的终值 + 玻璃浓度重铸')
})

it('回归锁 · 官方 Toast 按契约传参：错误态省略 tone、带 holdMs', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { face } = panelHandle(calls)

  face.env.notify('出错了', 'error')
  const toastHost = loaded.dom.byId.get('dts-toast-host')
  assert.ok(toastHost, '官方 Toast 在位时应挂 toast 宿主')
  const toastNode = toastHost.__rendered
  assert.equal(toastNode.type, loaded.primitives.Toast)
  assert.equal(toastNode.props.tone, undefined,
    "错误态不传契约外值 'error'，省略 tone 留警示座（Toast.tsx）")
  assert.equal(toastNode.props.holdMs, 4200, '错误态 = 4200ms 保持 + 1s 淡出，对齐自绘回退的 5.2s')

  face.env.notify('好了', 'ok')
  assert.equal(loaded.dom.byId.get('dts-toast-host').__rendered.props.tone, 'success')
})

it('回归锁 · Input/Button 契约适配的两件皮肤在样式表里（wrapper 布局 + danger 上色）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-input-flex', 'flex'), '1', '官方 Input 的布局 style 要有 wrapper 接盘')
  assert.match(declOf(parsed, '.dts-btn-danger', 'color'), /state-error/, '官方 Button 没有 danger variant，自家上色')
})

it('回归锁 · 按钮不折行不被 flex 压缩，字号与自绘统一（「保存当前方案」折行溢出）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  for (const selector of ['.dts-panel button', '.dts-panel .dts-btn']) {
    assert.equal(declOf(parsed, selector, 'white-space'), 'nowrap',
      '官方 .button 没有 white-space，flex 行一挤就折行堆叠 —— 必须单行完整显示')
    assert.equal(declOf(parsed, selector, 'flex'), 'none')
  }
  assert.equal(declOf(parsed, '.dts-panel button:not(.dts-tab)', 'font-size'), '12.5px',
    '按钮字号统一 12.5px，官方在位/缺失两套观感一致')
})

it('回归锁 · FAB 图标对比自愈：同色背景上保底可见（白底白图标实测隐形）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  loaded.sandbox.getComputedStyle = () => ({ backgroundColor: 'rgb(255, 255, 255)', getPropertyValue: () => '' })
  const { ctx } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const fab = loaded.dom.byId.get('dts-fab')
  assert.equal(fab.style.color, '#101418', '白底上图标必须切深色')
})

it('回归锁 · 玻璃重铸对比自愈：白字主题下表面翻成深玻璃（「都看不清」实测）', () => {
  const { composeGlass } = loadBundle().exports.__internals
  const probeWhiteFg = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '#ffffff') }
  const doc = { glass: { enabled: true, alpha: 0.5 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(['--dsw-alias-bg-layer-1'], doc, probeWhiteFg, {})
  assert.equal(out['--dsw-alias-bg-layer-1'].light, 'rgba(16, 20, 24, 0.5)',
    '白底 × 白字必须翻成深玻璃，否则整块隐形')

  const probeDarkFg = { of: (name) => (name === '--dsw-alias-label-primary' ? '#101418' : '#ffffff') }
  const out2 = composeGlass(['--dsw-alias-bg-layer-1'], doc, probeDarkFg, {})
  assert.equal(out2['--dsw-alias-bg-layer-1'].light, 'rgba(255, 255, 255, 0.5)',
    '深字 × 白底对比达标时保持白玻璃')

  const explicit = { '--dsw-alias-bg-layer-1': { light: '#123456', dark: '#123456' } }
  assert.equal(composeGlass(['--dsw-alias-bg-layer-1'], doc, probeWhiteFg, explicit)['--dsw-alias-bg-layer-1'],
    undefined, '用户显式写过的令牌让位，不被自愈改写')
})

it('回归锁 · 小色块玻璃拉到可读档：hover/页签不随薄玻璃变白底白字（「文件」页签实测）', () => {
  const { composeGlass } = loadBundle().exports.__internals
  // 白字主题：label-primary 白，小色块基准是 #f1f3f5 不透明白（floating-hover/markdown-tag 实测值）。
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '#f1f3f5') }
  const doc = { glass: { enabled: true, alpha: 0.15 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(
    ['--dsw-alias-button-floating-hover', '--dsw-alias-markdown-tag', '--dsw-alias-bg-layer-1'],
    doc, probe, {})
  assert.equal(out['--dsw-alias-button-floating-hover'].light, 'rgba(16, 20, 24, 0.55)',
    'hover 小色块翻深且浓度拉到可读档，不随 0.15 薄玻璃走')
  assert.equal(out['--dsw-alias-markdown-tag'].light, 'rgba(16, 20, 24, 0.55)',
    '活动页签小色块同理，白字才读得清')
  assert.equal(out['--dsw-alias-bg-layer-1'].light, 'rgba(16, 20, 24, 0.15)',
    '普通大表面照常跟随用户的面板透明度')
})

it('回归锁 · input 令牌重铸为毛玻璃色 + placeholder 提实（busy 态白板回归锁）', () => {
  const { composeGlass, fixTextFamily } = loadBundle().exports.__internals
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '#f1f3f5') }
  const doc = { glass: { enabled: true, alpha: 0.15 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(['--dsw-specific-input-major', '--dsw-specific-sidebar-fill'], doc, probe, {})
  assert.equal(out['--dsw-specific-input-major'].light, 'rgba(16, 20, 24, 0.15)',
    'input 令牌必须重铸为毛玻璃深色：退出重铸时基准 #fff 会把 busy 态输入卡变成大白板（实测）')
  assert.ok(out['--dsw-specific-sidebar-fill'], '其余表面照常玻璃化')
  const merged = {}
  fixTextFamily(merged, {}, { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '') })
  assert.equal(merged['--dsw-alias-label-caption'].light, 'rgba(255, 255, 255, 0.82)',
    'placeholder 走 caption：0.62 太淡看不清，自愈值提到 0.82')
})

it('回归锁 · probe 表内解析 var() 链：alias 层的 var(static) 引用能当基准', () => {
  const loaded = loadBundle({ boot: {} })
  // 复刻 design-platform 形状：alias 行是 var() 引用，static 行是字面量。
  loaded.dom.doc.styleSheets[0].cssRules[0].style = makeRuleStyle({
    '--dsw-alias-button-elevated-fill': 'var(--dsw-static-neutral-bluish-00)',
    '--dsw-static-neutral-bluish-00': 'rgb(255, 255, 255)',
  })
  loaded.dom.doc.styleSheets[0].cssRules[1].style = makeRuleStyle({
    '--dsw-alias-button-elevated-fill': 'var(--dsw-static-neutral-bluish-750)',
    '--dsw-static-neutral-bluish-750': 'rgb(67, 69, 74)',
  })
  loaded.sandbox.getComputedStyle = () => ({ getPropertyValue: () => '' })
  const probe = loaded.exports.__internals.createTokenProbe()
  assert.equal(probe.of('--dsw-alias-button-elevated-fill', 'light'), 'rgb(255, 255, 255)')
  assert.equal(probe.of('--dsw-alias-button-elevated-fill', 'dark'), 'rgb(67, 69, 74)',
    '深色侧的 var() 引用也必须解析到基准，否则深色模式玻璃静默失效')
})

it('回归锁 · input 族重铸为深玻璃、其余表面照常（「区分不明显」旧锁的再收口）', () => {
  const { composeGlass } = loadBundle().exports.__internals
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '#ffffff') }
  const doc = { glass: { enabled: true, alpha: 0.3 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(['--dsw-specific-input-major', '--dsw-specific-sidebar-fill'], doc, probe, {})
  assert.equal(out['--dsw-specific-input-major'].light, 'rgba(16, 20, 24, 0.3)',
    'input 族与普通表面同档重铸为深玻璃色（翻深自愈），杜绝 busy 态裸奔白板')
  assert.ok(out['--dsw-specific-sidebar-fill'], '侧栏照常玻璃化，壁纸透出不受影响')
})

it('回归锁 · 构建版本徽章换玻璃材质（logo 下白斑：底色=label-primary 的徽章设计）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.match(declOf(parsed, '[class*="buildVersion"]', 'background'), /button-elevated-fill,/,
    '徽章底色必须换玻璃面且带 fallback，否则白字主题下是纯白小斑')
  const tag = declOf(parsed, '[class*="_tag_"][data-tone="solid"]', 'background')
  assert.equal(tag, 'rgba(16,20,24,.55)!important',
    '反相实底标签（「新任务默认」chip）必须换毛玻璃：label-primary 做底在白字主题下是纯白块')
  assert.match(declOf(parsed, '[class*="_tag_"][data-tone="solid"]', 'color'), /label-primary/)
  assert.equal(declOf(parsed, 'select option', 'background'), '#16181d',
    '原生 select 弹层必须换深色实底（系统弹层无 backdrop-filter），否则浅灰弹层很突兀')
  assert.match(declOf(parsed, 'select option:checked', 'background'), /brand-primary/,
    '下拉选中项用品牌色压掉系统蓝高亮')
})

it('回归锁 · 次级文字对比自愈 + 交接卡透明/文件展示玻璃（「看不清」与「交接面板质感互换」实测）', () => {
  const { fixTextFamily, CHROME_CSS } = loadBundle().exports.__internals
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '') }
  const merged = {}
  fixTextFamily(merged, {}, probe)
  assert.equal(merged['--dsw-alias-label-tertiary'].light, 'rgba(255, 255, 255, 0.55)',
    '白字主题下暗次字必须翻半透明白，否则深玻璃上不可读')
  const own = { '--dsw-alias-label-tertiary': { light: '#123456', dark: '#123456' } }
  const merged2 = {}
  fixTextFamily(merged2, own, probe)
  assert.equal(merged2['--dsw-alias-label-tertiary'], undefined, '用户显式文字不被自愈改写')
  // 漏网暗字：primary-dimmed / primary-bluish 基准是 #151517 / #0e3074 暗字，
  // 排队消息预览（mBRiIW_preview）压深玻璃底"选择才看清"实测。
  assert.equal(merged['--dsw-alias-label-primary-dimmed'].light, 'rgba(255, 255, 255, 0.88)',
    'primary-dimmed 必须进文字自愈族，否则排队消息预览是近黑字压深底')
  assert.equal(merged['--dsw-alias-label-primary-bluish'].light, 'rgba(255, 255, 255, 0.85)',
    'primary-bluish 同族漏网暗字，一并自愈')
  // 任务结束交接卡透明（壁纸看清）；文件行/文件展示是玻璃条（透但看不清壁纸）。
  const parsed = parseCss(CHROME_CSS)
  for (const selector of ['[class$="_card"]', '[class*="_card "]']) {
    assert.equal(declOf(parsed, selector, 'background'), 'rgba(16,20,24,.15)!important',
      '非交接类 _card（会话输入卡）必须是设置同款毛玻璃；多类名（busy 态）也要命中，后缀匹配曾漏')
  }
  for (const selector of [
    '[class$="_card"]:has([class$="_path"],[class$="_counts"],[class$="_file"])',
    '[class*="_card "]:has([class$="_path"],[class$="_counts"],[class$="_file"])',
  ]) {
    assert.equal(declOf(parsed, selector, 'background'), 'transparent!important',
      '交接卡必须透明（:has 文件三件套特征 + 多类名并集），壁纸直接看得清')
  }
  assert.equal(declOf(parsed, '[class$="_file"]', 'background'), 'rgba(16,20,24,.5)!important',
    '文件行是玻璃条：看不清壁纸但是是透的')
  assert.equal(declOf(parsed, '[class$="_preview"]', 'background'), 'rgba(16,20,24,.5)!important',
    '交接任务文件的展示换成交接卡同款玻璃（透但看不清壁纸）')
})

it('回归锁 · 玻璃表面浏览器半兜底：新会话条/聊天气泡不等 Host 重启（「有底不好」实测）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const layer = calls.overrideTokens[calls.overrideTokens.length - 1]
  for (const name of ['--dsw-alias-button-elevated-fill', '--dsw-specific-bubble', '--dsw-specific-bubble-highlight',
    '--dsw-alias-button-floating-hover', '--dsw-alias-markdown-tag']) {
    assert.ok(layer.tokens[name], `${name} 必须被浏览器半兜底玻璃化`)
    assert.match(layer.tokens[name].light, /^rgba\(/, '兜底表面必须重铸成玻璃而不是实色')
  }
})

it('回归锁 · diff 语义色翻深 + 浮层玻璃对齐设置弹窗（「点文件展开」与「不是透透的」实测）', () => {
  const { fixDiffFamily, CHROME_CSS } = loadBundle().exports.__internals
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '') }
  const merged = {}
  fixDiffFamily(merged, {}, probe)
  assert.equal(merged['--dsw-alias-file-diff-added-bg'].light, 'rgb(31, 49, 36)',
    '白字主题下浅绿 diff 块必须翻深色版')
  assert.equal(merged['--dsw-alias-file-diff-deleted-bg'].light, 'rgb(60, 31, 27)')
  // 深字主题不动（浅色 diff 本来正常）。
  const darkFg = { of: (name) => (name === '--dsw-alias-label-primary' ? '#101418' : '') }
  const merged2 = {}
  fixDiffFamily(merged2, {}, darkFg)
  assert.equal(merged2['--dsw-alias-file-diff-added-bg'], undefined, '深字主题不干预 diff')
  // 用户显式让位。
  const own = { '--dsw-alias-file-diff-added-bg': { light: '#123456', dark: '#123456' } }
  const merged3 = {}
  fixDiffFamily(merged3, own, probe)
  assert.equal(merged3['--dsw-alias-file-diff-added-bg'], undefined, '用户显式 diff 色不被改写')
  // 浮层玻璃卡与设置弹窗逐参数对齐（实测 KHARfa_panel：0.15 薄玻璃 + 大模糊 + 32px 圆角）。
  const parsed = parseCss(CHROME_CSS)
  for (const selector of ['[class$="_backdrop"] > *', '[class$="_scrim"] > *', '[class$="-backdrop"] > *']) {
    assert.equal(declOf(parsed, selector, 'background'), 'rgba(16,20,24,.15)!important',
      '浮层面板必须是设置同款 0.15 薄玻璃，加黑会死黑与整体不符（实测）')
    assert.equal(declOf(parsed, selector, 'backdrop-filter'), 'var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important',
      '大模糊才是透透玻璃感与可读性的来源（设置弹窗实测）')
    assert.equal(declOf(parsed, selector, 'border-radius'), '32px!important', '浮层卡圆角对齐设置弹窗的 32px')
  }
  for (const selector of ['[class$="_backdrop"]', '[class$="_scrim"]', '[class$="-backdrop"]', '[class$="-scrim"]']) {
    assert.equal(declOf(parsed, selector, 'background'), 'transparent!important',
      '遮罩层不加黑：设置弹窗 overlay 本体就是全透明（实测），周边壁纸要透')
    assert.equal(declOf(parsed, selector, 'backdrop-filter'), 'none!important')
  }
  assert.ok(parsed.rule('[class$="_card"] [class$="_header"]') !== undefined,
    '交接卡内部件（卡头/图标块）保持透明不叠底')
})

it('回归锁 · 插件自家输入面跟玻璃走（下拉触发器与 CSS 文本框白底实测）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  // 密集小输入：纯色玻璃观感、**零 backdrop-filter**（49×2=98 个 blur 合成层曾把
  // 色彩页闪到渲染撕裂、丢失交互 —— 性能回归实测，其他页 input 少不复现）。
  assert.equal(declOf(parsed, 'body.dts-on .dts-input', 'background'), 'rgba(16,20,24,.35)!important',
    '有壁纸时自家输入面必须玻璃化（明暗模式/滚动条下拉与自定义 CSS 文本框曾纯白）')
  assert.equal(declOf(parsed, 'body.dts-on .dts-input', 'backdrop-filter'), undefined,
    '密集小输入禁挂 backdrop-filter 大模糊（合成层爆炸实测）')
  // 少量大件保真模糊：textarea / 下拉触发器。
  for (const selector of ['body.dts-on .dts-select-trigger', 'body.dts-on .dts-textarea']) {
    assert.equal(declOf(parsed, selector, 'background'), 'rgba(16,20,24,.15)!important')
    assert.equal(declOf(parsed, selector, 'backdrop-filter'),
      'var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important')
  }
  // 无壁纸时保持宿主输入面；且不许重铸全局 input-major（会话输入框钦定不透明，
  // 它与本面板控件是同一令牌的两个消费面，必须分离）。
  assert.equal(declOf(parsed, '.dts-input', 'background'), 'var(--dsw-specific-input-major,#fff)')
  assert.ok(!GLASS_SURFACES.includes('--dsw-specific-input-major'),
    '全局 input-major 不进玻璃清单（宿主会话输入框保持不透明）')
})

it('回归锁 · 色彩页 token 行：标签锁宽不竖排、清除钮隐形占位对齐轨道（色彩页实测）', async () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-pair-label', 'flex'), 'none',
    '「浅色值/深色值」标签曾被 flex 挤到一字宽竖排（实测）')
  assert.equal(declOf(parsed, '.dts-pair-label', 'white-space'), 'nowrap')
  assert.equal(declOf(parsed, '.dts-clear-slot[data-empty="true"]', 'visibility'), 'hidden',
    '无值行清除钮要隐形占位 —— 独立 grid 的 auto 轨曾 0px vs 53px 上下错位（实测）')
  assert.equal(declOf(parsed, '.dts-input-flex', 'min-width'), '36px',
    '极限挤压下输入位残缺可见而不是整个消失')

  // 渲染面：token 行恒 4 子项，第 4 位是清除钮/隐形占位。
  const loaded = loadBundle({
    boot: {},
    localStorage: (() => {
      const store = new Map([['dts:active-tab', 'color']])
      return { store, getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)) } }
    })(),
  })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)
  const tab = findNodes(component(face), () => true)
    .find((node) => typeof node.type === 'function' && node.type.name === 'ColorTab')
  assert.ok(tab, '色彩页应从 localStorage 恢复并渲染')
  const rows = findNodes(tab.type(tab.props), (props) => String(props.className || '').includes('dts-token-row'))
  assert.ok(rows.length >= 1, 'token 行应渲染（fixture 组内至少 1 行）')
  for (const row of rows) {
    const kids = (row.children || []).filter((child) => child && typeof child === 'object')
    assert.equal(kids.length, 4, `token 行必须恒 4 子项：${String(row.children && row.children.length)}`)
    assert.match(String(kids[3].props.className), /dts-clear-slot/, '第 4 子项必须是清除钮/隐形占位 slot')
  }
})

it('回归锁 · 合成成本红线：backdrop-filter 只许挂白名单类（98 层 blur 闪屏回归哨）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  // 允许真模糊的面：每屏实例数个位数的大件 / 弹层 / 浮层 / 宿主卡片补丁
  // （下划线与连字符后缀两类宿主形态都要认：_backdrop 与 lc-ov-backdrop 同族）。
  const ALLOW = [/dts-select-trigger/, /dts-textarea/, /dts-select-menu/, /dts-modal-mask/,
    /_tag_/, /_file"/, /_preview/, /_card/, /[_-]backdrop/, /[_-]scrim/, /data-composer-stats/,
    /class\$="_trigger"/, /lc-card/, /lc-modal-card/, /dockkit/, /role="dialog"/]
  // 密集复用类（token 行输入 49×2、下拉选项、按钮、色卡）：单屏几十个实例，
  // 挂 backdrop-filter = 合成层爆炸（色彩页闪屏、渲染撕裂、丢失交互实测）。
  const DENY = [/\.dts-input(?![a-z-])/, /\.dts-select-option/, /\.dts-btn(?![a-z-])/,
    /\.dts-swatch/, /\.dts-pill/, /\.dts-switch/, /\.dts-dot/]
  let blurRules = 0
  for (const { selector, decls } of parsed.find(() => true)) {
    const bf = decls.get('backdrop-filter')
    if (!bf || bf === 'none' || bf === 'none!important') continue
    blurRules += 1
    for (const deny of DENY) {
      assert.ok(!deny.test(selector), `密集复用类禁挂 backdrop-filter：${selector}`)
    }
    assert.ok(ALLOW.some((allow) => allow.test(selector)),
      `backdrop-filter 出现在非白名单选择器（先问：这个类单屏有几个实例？）：${selector}`)
  }
  assert.ok(blurRules >= 3, '浮层/大件玻璃面不该被整体误删')
})

it('回归锁 · media 元数据查表防原型键：constructor 不再拼出 /media/undefined 视频（L3）', async () => {
  const { mediaLookup } = loadBundle().exports.__internals
  assert.equal(mediaLookup({}, 'constructor'), undefined, '原型键不得取出构造函数当素材元数据')
  assert.equal(mediaLookup({}, '__proto__'), undefined)
  const real = { id: 'a.png', name: 'a.png' }
  assert.equal(mediaLookup({ 'a.png': real }, 'a.png'), real)

  // 行为面：video 模式 + mediaId='constructor' 曾把 Object 构造函数当 meta，
  // showVideoLayer 拼出 /media/undefined/undefined 的死视频。
  const hostile = JSON.parse(JSON.stringify(PROJECTION))
  hostile.doc.backdrop.mode = 'video'
  hostile.doc.backdrop.mediaId = 'constructor'
  hostile.media = {}
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = async () => ({
    ok: true, status: 200, json: async () => ({ ok: true, value: hostile }),
  })
  const { ctx } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(80)
  const layer = loaded.dom.byId.get('dts-backdrop')
  assert.ok(layer, '背景层应存在（退回 CSS 层）')
  const tags = layer.children.map((child) => child.tagName)
  assert.ok(!tags.includes('VIDEO'),
    '原型键取出的伪 meta 曾让背景层挂上 /media/undefined 的死视频')
})

it('回归锁 · 主题档撞 409 走确认框再带 overwrite 重试（M2 客户端面）', async () => {
  const calls = []
  const loaded = loadBundle({
    boot: {},
    // 页签记忆落到「我的方案」，ProfileTab 才在渲染树里。
    localStorage: (() => {
      const store = new Map([['dts:active-tab', 'profile']])
      return {
        store,
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)) },
      }
    })(),
  })
  loaded.sandbox.fetch = async (url, init) => {
    const method = String((init && init.method) || 'GET').toUpperCase()
    if (method === 'GET' && String(url).includes('/api/themes')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, value: { themes: [] } }) }
    }
    if (method === 'POST' && String(url).includes('/api/themes')) {
      const body = JSON.parse(init.body)
      calls.push(body)
      if (body.overwrite !== true) {
        // 服务端 409：safeName 消毒后同档（'午夜?深蓝' 与 '午夜深蓝' 同落盘名）。
        return { ok: true, status: 409, json: async () => ({ ok: false, error: { status: 409, message: '主题档已存在' } }) }
      }
      return { ok: true, status: 201, json: async () => ({ ok: true, value: { slug: 'x', name: body.name } }) }
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, value: PROJECTION }) }
  }
  const { ctx, calls: ctxCalls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(ctxCalls)
  const tab = findNodes(component(face), () => true)
    .find((node) => typeof node.type === 'function' && node.type.name === 'ProfileTab')
  assert.ok(tab, '「我的方案」页应渲染')
  const tree = findNodes(tab.type(tab.props), () => true)
  const saveBtn = tree.find((node) => node.type === 'button'
    && Array.isArray(node.children) && node.children[0] === face.t('profile.saveNew'))
    ?? tree.find((node) => node.type === loaded.primitives.Button
      && Array.isArray(node.children) && node.children[0] === face.t('profile.saveNew'))
  assert.ok(saveBtn, '应找到「保存当前方案」按钮')

  // 确认框：409 后必须问过用户才覆盖，取消则不再发请求。
  let confirmAsked = 0
  face.env.confirmDialog = () => { confirmAsked += 1; return Promise.resolve(false) }
  saveBtn.props.onClick()
  await tick(60)
  assert.ok(confirmAsked >= 1, 'safeName 碰撞的 409 曾被忽略成静默失败/覆盖，必须走确认框')
  assert.equal(calls.length, 1, '用户没确认就不许发 overwrite 重试')

  face.env.confirmDialog = () => { confirmAsked += 1; return Promise.resolve(true) }
  saveBtn.props.onClick()
  await tick(60)
  assert.ok(calls.length >= 3, '确认后应带 overwrite 重发')
  assert.equal(calls[calls.length - 1].overwrite, true, '重试必须显式带 overwrite')
})






