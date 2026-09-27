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

/**
 * 统一玻璃契约（唯一真源）：所有弹层/卡片/选项/提示都读这两个变量。
 * 断言写"变量引用"而不是数字 —— 数字改一次要动十几处测试，那是把
 * 复制粘贴固化进测试网；变量名才是这条契约本身。
 */
const GLASS_EXPECT = 'var(--dts-glass-fill,transparent)!important'
/** 模糊：`--dts-glass-blur` → 官方 `--dsw-menu-backdrop-filter`，两级兜底
 *  （末级 `blur(40px) saturate(150%)` 就是官方该令牌的定义值 —— 零色口径下
 *  糊是唯一的可读性机制，宿主令牌缺席时不许退化成"只变淡"）。 */
const GLASS_BLUR_EXPECT = 'var(--dts-glass-blur,var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%)))!important'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = readFileSync(join(here, '..', 'client.js'), 'utf8')

/* ------------------------------------------------------------------ */
/* 控件层 CSS 模块的取用面（本轮起面板大量样式搬进了 controls/**）        */
/* ------------------------------------------------------------------ */

/**
 * 从产物里取出某个**自写控件** CSS 模块的原文。
 * 按内容里的局部名标记认，不赌变量名（rolldown 给每个模块编号 `css$1/2/3…`）。
 * @param {string} marker 该模块里必然出现的一个局部名（如 `dtsModalMask`）。
 * @returns {string} CSS 原文；找不到返回空串。
 */
function controlCss(marker) {
  const re = /const css\$\d+ = "([^"]*)"/g
  let hit
  while ((hit = re.exec(bundle)) !== null) {
    if (hit[1].includes(marker)) return hit[1]
  }
  return ''
}

/**
 * 归一 CSS 值里的空白：`tools/css-modules.mjs` 编译期会把 `calc(...)`/`var(...)`
 * 里的空格压掉（`max(12px,var(--x,12px))`），断言不能绑死书写风格。
 */
const squeeze = (text) => String(text).replace(/\s+/g, '')

/**
 * 取「局部名以 suffix 结尾」的那条规则的声明表。
 * CSS Modules 给类名加 `<6 位盐>_` 前缀，所以只能按后缀找，不能按字面类名找。
 * @returns {Map<string,string>|undefined}
 */
function scopedDecls(cssText, suffix) {
  const re = new RegExp('_' + suffix + '$')
  const hit = parseCss(cssText).find((selector) => re.test(selector))[0]
  return hit === undefined ? undefined : hit.decls
}

/* ------------------------------------------------------------------ */
/* DOM 替身：只实现 client.js 真会碰到的成员                             */
/* ------------------------------------------------------------------ */

/**
 * 真库 react-dom 的门户类型标记（`Symbol.for('react.portal')`）。
 * 用 `Symbol.for` 而不是普通对象：真库就是这么标的，且**跨 vm 语境同值**
 * （符号注册表是进程级的），所以替身造出来的门户在测试侧也认得出。
 */
const PORTAL_TYPE = Symbol.for('react.portal')

/** 门户节点（`createPortal` 的返回值）：惰性，落 DOM 是 commit 的事。 */
const isPortal = (node) => node !== null && typeof node === 'object' && node.$$typeof === PORTAL_TYPE

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
  /**
   * `document.getElementById` 的语义是「**树序第一个**带这个 id 的节点」。
   * 本夹具用"**先建先赢**"近似它：先进 `byId` 的不会被后来的顶掉。
   *
   * ⚠️ 这一条是实测踩出来的：产物里 `#dts-modal-host` 有**两个**节点 ——
   * 浮层宿主渲染的常驻容器，以及 `ModalHost` 门户进该容器的"显示开关盒"（两者同 id，
   * 见 §5 的产品真 bug 记录）。真宿主里 `getElementById` 拿到的是**容器**（树序在前），
   * 而"后来者覆盖"的替身会拿到盒子，于是 `ModalHost` 里
   * `document.getElementById(MODAL_HOST_ID)` 也取错对象、断言随之失真。
   */
  function index(node) {
    if (node && node.id && !byId.has(node.id)) byId.set(node.id, node)
    return node
  }
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
      // 自写控件层的 .module.css 在模块初始化期就注入 <style data-plugin-css=…>，
      // 注入代码写 tag.dataset.plugin / tag.dataset.pluginCss —— 替身必须有 dataset。
      dataset: Object.create(null),
      style: makeStyle(),
      textContent: '',
      isConnected: true,
      parentNode: null,
      get className() { return this.attributes.class ?? '' },
      set className(value) { this.setAttribute('class', value) },
      get firstChild() { return this.children[0] ?? null },
      appendChild(child) {
        // 真 DOM 的移动语义：已经在别的父节点下就先摘下来（否则"搬回官方槽"会留下影子节点）。
        if (child.parentNode) child.parentNode.removeChild(child)
        this.children.push(child)
        child.parentNode = this
        child.isConnected = true
        index(child)
        return child
      },
      insertBefore(child, ref) {
        if (child.parentNode) child.parentNode.removeChild(child)
        const at = ref === undefined || ref === null ? 0 : this.children.indexOf(ref)
        if (at < 0) this.children.unshift(child)
        else this.children.splice(at, 0, child)
        child.parentNode = this
        child.isConnected = true
        index(child)
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
        if (this.id && byId.get(this.id) === this) byId.delete(this.id)
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
      getClientRects() { return [{ left: 0, top: 0, width: 800, height: 400 }] },
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
    /** 把已建好的节点登记进 `byId`（`mountOverlay` 造宿主节点时用；真运行时由插入文档建立）。 */
    __indexById(node) { return index(node) },
    // document 级监听也要记录：模态的 Esc 处理挂在 document 上。
    addEventListener(type, fn) { events.push({ el: doc, type: type, fn: fn }) },
    removeEventListener(type, fn) {
      const at = events.findIndex((item) => item.el === doc && item.type === type && item.fn === fn)
      if (at >= 0) events.splice(at, 1)
    },
    // CSS Modules 的幂等注入键：返回 null ⇒ 每个样式表注入一次（与真浏览器首次装载同路径）。
    querySelector: () => null,
    querySelectorAll: () => [],
  }
  return { doc: doc, byId: byId, events: events, fire: fire, docEvents: events }
}

/** 极简 React 替身：本测试不跑交互树，只要 API 齐备、能被调用而不抛。
 *
 * ⚠️ `forwardRef` / `memo` 不是可选项：自写控件层（src/client/controls/**）在**模块初始化期**
 * 就用它们包组件（Button / MenuSurface 用 forwardRef，DisclosureRow 用 memo）——
 * 缺了这两个，产物在装载期直接 TypeError，整个套件连门都进不去。
 * 其余 hook（useState/useEffect/useRef…）只在控件被**渲染**时才调用，而本套件只遍历元素树、
 * 不调用控件函数（findNodes 只看 node.type / node.props），所以那几个仍然够用。
 */
function createReactStub() {
  /**
   * ⚠️ 与真 React 的 `createElement` **只对齐一处，但很关键**：`children` 要**归一**成
   * "没有 = `undefined` / 一个 = 该子节点 / 多个 = 数组"（真库 ReactElement 构造如此）。
   * 替身若一律给数组，`cloneElement(child, …)` 这类**单子节点契约**就会拿到数组并返回
   * `undefined` —— 实测后果：Tooltip 的锚点变成 undefined、气泡永不出现，而真运行时是好的。
   */
  function createElement(type, props) {
    /* 真库 `createElement` 会把 `null` / `undefined` / 布尔子节点**丢掉**，
       并在只剩一个子节点时把它归一成该子节点（`cloneElement(child, …)` 这类
       单子节点契约就靠这一点）。替身必须同形，否则 Tooltip 的锚点会拿到数组。 */
    const raw = Array.prototype.slice.call(arguments, 2)
      .filter((k) => k !== null && k !== undefined && k !== false && k !== true)
    const children = raw.length === 0 ? undefined : raw.length === 1 ? raw[0] : raw
    return {
      $$typeof: 'element',
      type: type,
      props: props ?? {},
      children: children,
    }
  }
  return {
    createElement: createElement,
    cloneElement: (el, props) => Object.assign({}, el, { props: Object.assign({}, el.props, props) }),
    // forwardRef / memo 直接返回内层函数：控件的**函数名**因此保留（Button / Toast / Input…），
    // 这正是不再能靠 `loaded.primitives.X` 认身份之后，测试识别控件的依据（见 isControl）。
    forwardRef: (render) => render,
    memo: (render) => render,
    Fragment: 'Fragment',
    /* hooks：语义照真库的最小面（`useState` 的函数初值要**调用**、`useSyncExternalStore`
       交回当前快照）。渲染整棵设置页时会走到 Slider 等控件（`useId`），缺一个就抛
       `xxx is not a function` —— 那会让"产品回归"表现成夹具崩溃而不是断言变红。 */
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    // ⚠️ 真 React 也有它（同步 DOM 副作用）；控件层的 Toast/Tooltip 在用。
    useLayoutEffect: () => {},
    useRef: (initial) => ({ current: initial }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
    useId: () => 'dts-test-id',
  }
}

/**
 * 官方包替身已**删除**：合规改造后产物不得 require 任何 Harness Client 包
 * （`@deepseek-ai/dsh-client-ui-primitives` 等，references_practices.md:35），
 * 控件全部自写为 src/client/controls/**。替身留着的话，下面"基座之外必须抛"
 * 那条防线就会替官方包开后门，退化成永远为真。
 */

function loadBundle(options) {
  const opts = options ?? {}
  const dom = createDom()
  const registrations = []
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
    // react-dom 是**官方 9 键基座表**里的键（与 react / react-dom/client 同级），必须给。
    // 缺它的那段时间：产物只 require react，缺口不暴露；一旦产物 require('react-dom')
    // （controls/runtime.ts 取 createPortal），装载期就抛，本文件几乎整套用例连锁崩。
    'react-dom': {
      /* ⚠️ 与真库 react-dom 同形的**惰性门户对象**（本轮修正的根因，见 §2/§3）。
         真库的 `createPortal(children, container)` **不碰 DOM**：它交回
         `{ $$typeof: REACT_PORTAL_TYPE, key, children, containerInfo }`，
         真正落 DOM 发生在 **commit 阶段**，且按位置复用既有节点。
         旧替身"渲染期就 append 并把节点交回"，把渲染与挂载压成一件事 ——
         于是每多渲染一遍就多挂一份（四条断言取不到稳定节点，实测）。
         `$$typeof` 用 `Symbol.for('react.portal')`（真库 REACT_PORTAL_TYPE 同值，
         跨 vm 语境也认得出：Symbol.for 走全局注册表）。 */
      createPortal: (node, container) => ({
        $$typeof: PORTAL_TYPE,
        key: null,
        children: node === undefined ? null : node,
        containerInfo: container === undefined ? null : container,
      }),
      render() {},
      unmountComponentAtNode: () => true,
    },
  }
  // createRoot 记下最后一次渲染的节点，模态里的结构才能被断言。
  // `reactDomClient: false` 用来复刻"宿主没给 react-dom/client"的形态：app.ts 的模态宿主
  // 会走 `require('react-dom')` + ReactDOM.render 的退路分支 —— 产物里那条 require 只有在这条
  // 路径上才会被执行，静态清单一律看得见它，运行时则要专门把这个开关关掉才会出现。
  if (opts.reactDomClient !== false) {
    modules['react-dom/client'] = {
      createRoot: (host) => ({
        render(node) { host.__rendered = node },
        unmount() { host.__rendered = null },
      }),
    }
  }
  const requested = []
  const exportsFromFactory = registrations[0].factory(function require(specifier) {
    requested.push(specifier)
    if (specifier in modules) return modules[specifier]
    throw new Error('bundle 请求了基座之外的模块（越出官方 9 键基座表）：' + specifier)
  })
  return { exports: exportsFromFactory, dom: dom, sandbox: sandbox, requested: requested, modules: modules }
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
    // effect 的 reason 串与各自回收的 disposer：官方写法要求词典注册包在
    // ctx.effect(...) 里（第二个参数就是 reason），所以要能按 reason 取回那一笔。
    effectReasons: [],
    effectDisposers: [],
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
        /* `shell.overlay` 是较新机制：老宿主版本**没有这个槽**，工厂根本不会被调用
           （官方 ui-slots：槽未被父节点声明时 register 直接抛）。
           这里用它模拟"槽不存在"的宿主，验证壁纸落位的功能安全网。 */
        if (name === 'shell.overlay' && opts.overlaySlot === false) return () => {}
        const disposer = factory()
        if (typeof disposer === 'function') calls.disposers.push(disposer)
        return () => {}
      },
      register(regOptions, component) {
        calls.registrations.push({ options: regOptions, component: component })
        return () => {}
      },
    },
    effect(fn, reason) {
      const disposer = fn()
      calls.effectReasons.push(reason)
      if (typeof disposer === 'function') {
        calls.effectDisposers.push({ reason: reason, dispose: disposer })
        calls.disposers.push(disposer)
      }
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

/* 官方 9 键基座表（references_practices.md 的 loader 注入表）—— 本插件只允许落在表内。
 * 这里单独留一份而不是从产物里反推：反推等于把断言写成 "产物 require 了产物 require 的东西"，
 * 越表也照样绿。表外键在真运行时是硬失败（loader 抛 `missed the module table`）。 */
const LOADER_BASE_TABLE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'dsh-client-store',
  'dsh-client-ui-slots',
  'dsh-client-ui-primitives',
  'dsh-client-ui-dockkit',
]

it('bundle 只 require 官方基座表内的模块，并导出 Cordis 契约', () => {
  const loaded = loadBundle()
  // 合规锁（运行时侧）：产物 require 的模块**全部落在官方 9 键基座表内**，
  // 且官方 Harness Client 包（ui-primitives 等）一个都不许进 —— references_practices.md:35
  // 明文禁止，控件已自写为 src/client/controls/**；静态文本侧的同一条锁在 tools/verify-bundle.mjs。
  //
  // 口径为什么从"只允许 react 基座"改成"落在基座表内 + 钉住实际清单"：
  // 旧口径写死在 `['react', 'react-dom/client']`，而 createPortal 只能从 **react-dom** 取
  // （React.createPortal 恒 undefined），产物因此合法地多一条 require("react-dom") —— 旧断言
  // 把"正确的修复"判成越界。改口径的同时**没有放宽**：表仍只到官方那 9 个键，并且把**实际清单**
  // 逐项钉死（含重复次数），既拦住"越表"也拦住"清单悄悄变了没人发现"。
  // 钉住**含重复次数**的实际清单。这里数是 **require 调用次数**，不是去重集合：
  //   react ×2            —— deps.ts 与 controls/runtime.ts 各裸取一次（模块初始化期都执行）
  //   react-dom/client ×1 —— deps.ts 在 try 里取 createRoot
  //   react-dom ×1        —— controls/runtime.ts 取 createPortal（模块初始化期，必执行）
  // 还有**第 4 条** require("react-dom") 在产物里，但它落在 app.ts 的模态宿主退路分支
  // （ReactDOMClient 缺席时才走），本夹具给了 createRoot ⇒ 这条路径不执行、不计数。
  // 想连它一起数，把 `reactDomClient: false` 打开即可（见下一条用例）。
  assert.deepEqual(
    [...loaded.requested].sort(),
    ['react', 'react', 'react-dom', 'react-dom/client'],
    '产物 require 调用清单变了 —— 应为 react ×2 / react-dom ×1 / react-dom-client ×1',
  )
  for (const specifier of loaded.requested) {
    assert.ok(
      LOADER_BASE_TABLE.includes(specifier),
      `产物 require 了基座表之外的模块：${specifier}（loader 会抛 missed the module table）`,
    )
  }
  assert.deepEqual(loaded.requested.filter((spec) => spec.startsWith('@deepseek-ai/')), [],
    '产物不得 require 任何官方包（含 ui-primitives / ui-slots / ui-theme / dsh-client-store）')
  assert.equal(
    loaded.requested.filter((spec) => spec === 'react').length, 2,
    'react 基座恰被两处裸取（deps.ts 与 controls/runtime.ts）',
  )
  assert.equal(
    loaded.requested.filter((spec) => spec === 'react-dom').length, 1,
    'react-dom 至少被 controls/runtime.ts 取一次（createPortal 的来源）',
  )
  // createPortal 的来源锁：必须由 require("react-dom") 提供（React.createPortal 恒 undefined ——
  // 那正是让 6 个 portal 化控件在真运行时白屏的写法）。这里连**模块对象本身**一起验：
  // 替身里 createPortal 必须是真函数，否则装载期就会 `createPortal is not a function`。
  assert.ok(loaded.requested.includes('react-dom'), 'createPortal 必须由 require("react-dom") 提供')
  assert.equal(typeof loaded.modules['react-dom'].createPortal, 'function',
    'mock 的 react-dom.createPortal 必须是真函数（React.createPortal 恒 undefined）')
  assert.equal(loaded.exports.name, 'dsh-theme-studio')
  // exports.inject 由沙箱语境创建，原型与测试文件不同 ⇒ 按内容比较而不是深比字面量。
  assert.deepEqual(Array.from(loaded.exports.inject), ['slots', 'theme'])
  assert.equal(typeof loaded.exports.apply, 'function')
})

it('缺 react-dom/client 时不再有第二条渲染路径，且门户落 DOM 只在提交、且只落一次', async () => {
  /* 改造前这条用例是"缺 createRoot 时模态落到 require('react-dom') 的 ReactDOM.render 退路"。
     **阶段 E 把那条退路整段删掉了** —— 模态改成声明式（`ModalHost` 用 `createPortal` 渲染进
     浮层容器），于是"渲染"永远只有 portal 一条路，`react-dom` 的 require 收敛到 **1 处**
     （控件层 `runtime.ts` 取 createPortal）。断言随之**收紧**：不再有第二条 require、
     也不再有 `ReactDOM.render` 这个活口。 */
  const loaded = loadBundle({ boot: {}, reactDomClient: false })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(80)
  assert.ok(calls.registrations.length >= 2, '设置页入口与浮层入口都照常注册')

  // 即便宿主没给 createRoot，模态照旧走 portal 渲染（`ModalHost` 不依赖 createRoot）。
  mountOverlay(calls, loaded.dom.doc)
  const { face } = panelHandle(calls)
  const opener = loaded.dom.doc.createElement('button')
  loaded.dom.doc.body.appendChild(opener)
  opener.focus()
  face.env.openModal()
  await tick(20)
  const host = loaded.dom.byId.get('dts-modal-host')
  assert.ok(host !== null && host !== undefined, '模态容器由浮层宿主渲染（与 createRoot 无关）')

  const counts = loaded.requested.reduce((acc, spec) => {
    acc[spec] = (acc[spec] ?? 0) + 1
    return acc
  }, {})
  assert.equal(counts['react-dom'], 1, 'react-dom 只剩 createPortal 一处（模态退路已删）')
  assert.equal(counts['react'], 2, 'react 基座仍是两次')
  for (const specifier of loaded.requested) {
    assert.ok(LOADER_BASE_TABLE.includes(specifier), `基座表之外的模块：${specifier}`)
  }

  /* ★ 门户替身的**真语义**（本轮修正的根因，见 §2/§3）：
     `createPortal` 在真库 react-dom 里是**惰性**的 —— 它交回
     `{$$typeof: REACT_PORTAL_TYPE, children, containerInfo}`，落 DOM 只发生在 **commit**，
     且按位置复用既有节点。旧替身"渲染期就 append 并把节点交回"，把渲染与挂载压成一件事，
     于是每多渲染一遍就多挂一份 —— 四条断言因此取不到稳定节点（实测）。
     这里把三件事一起钉死：门户对象形状 / 渲染期绝不碰 DOM / 重复提交不重复挂载。 */
  const node = loaded.dom.doc.createElement('div')
  const portal = loaded.modules['react-dom'].createPortal(node, loaded.dom.doc.body)
  assert.equal(portal.$$typeof, PORTAL_TYPE, 'createPortal 必须交回真门户对象（Symbol.for("react.portal")）')
  assert.equal(portal.containerInfo, loaded.dom.doc.body, '门户必须带上落点 containerInfo')
  assert.equal(portal.children, node, '门户的 children 是被渲染的子树（单子节点不包成数组）')
  assert.equal(node.parentNode, null, '渲染期绝不许碰 DOM —— 落 DOM 是 commit 的事')

  /* 重复提交不叠加：容器里的子节点数不变（旧替身会翻倍）。
     模态容器里落着**一个**门户节点 —— `ModalHost` 的显示开关盒（常驻，靠 display 切换）。 */
  const modalNode = loaded.dom.byId.get('dts-modal-host')
  const committed = modalNode.children.length
  assert.equal(committed, 1, '模态容器里应恰好落着一个门户节点（常驻的显示开关盒）')
  commitOverlay(calls, loaded.dom.doc)
  commitOverlay(calls, loaded.dom.doc)
  assert.equal(modalNode.children.length, committed, '重复提交不得重复挂载门户（渲染 ≠ 挂载）')
  assert.equal(modalNode.children[0].__element.props.id, 'dts-modal-host',
    '落进容器的是 ModalHost 门户的那个显示开关盒')
})

it('控件全部自写：官方包缺席（本轮起是常态）也照常渲染控件，没有降级分支', async () => {
  // 旧用例断言"缺 ui-primitives 时退回原生元素"。合规改造后这条降级链**整条不存在了**：
  // 控件是静态导入，永远在位 —— 于是该用例翻成正向断言：不 require 官方包，
  // 面板照样渲染出自写 Button / StateDot。
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)
  const nodes = findNodes(component(face), () => true)
  assert.ok(nodes.some(isControl('Button')), '面板按钮应由自写 Button 渲染')
  assert.ok(nodes.some(isControl('StateDot')), '状态点应由自写 StateDot 渲染')
  assert.deepEqual(loaded.requested.filter((spec) => spec.startsWith('@deepseek-ai/')), [])
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
  /* ★ 背景层的**分层硬约束**：`shell.overlay` 那层是宿主 `AppFrame.module.css` 的
     `.overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}`，
     背景层进了那棵子树就随 z-index:20 压在 `#root`（我们自己写的 `position:relative;
     z-index:1`）的全部内容之上 ⇒ **壁纸盖住整个界面**（真机复现过）。
     正确分层 = 背景(body, z0) < UI(#root, z1) < 浮层(shell.overlay, z20)，
     所以背景层**固定挂 body 首子节点**（= 改造前的形态），浮层槽只承载模态/Toast。 */
  const overlay = mountOverlay(calls, loaded.dom.doc)
  const backdrop = loaded.dom.byId.get('dts-backdrop')
  assert.ok(backdrop, '背景层应被创建')
  assert.equal(backdrop.parentNode, loaded.dom.doc.body,
    '背景层必须在 document.body 下（进了 shell.overlay 就会被 z-index:20 抬到 UI 之上）')
  assert.equal(loaded.dom.doc.body.firstChild, backdrop,
    '背景层必须是 body 首子节点（改造前的落位方式）')
  assert.equal(overlay.hostNode.children.some((child) => child.id === 'dts-backdrop'), false,
    '背景层不许进浮层容器（那是 z-index:20 的框架级浮层）')
  assert.ok(loaded.dom.doc.body.classList.contains('dts-on'), 'body 应标记主题工坊已生效')

  // 首选官方 settings.section，且不越界占用别的槽。
  // 阶段 E 起多了 `shell.overlay`：背景层/提示/兜底模态/全屏键都注在它里面
  // （官方对该槽的定义是 "Frame-wide floating layer, above every column and outside
  //   their scroll containers"，官方自己的 8 个条目都在这里）。
  assert.deepEqual(calls.injected, ['shell.overlay', 'settings.section'])
  const registration = calls.registrations.find((item) => item.options.name === 'settings.section')
  assert.equal(registration.options.id, 'dsh-theme-studio')
  // ★ 官方注册签名：`label` 必须是 **thunk**（外壳投影导航时调 resolveSlotLabel），
  //   字符串会被原样用掉 —— 那样换语言就只能靠"重注册"，而重注册会整棵重建组件。
  assert.equal(typeof registration.options.label, 'function',
    'label 必须传 thunk（官方 settings-general:1171 逐字：label: () => t("general.nav")）')
  assert.equal(registration.options.label(), '主题工坊', 'thunk 现取当前语言')
  // 本 ctx 没有 locale 服务（makeCtx 未传 opts.locale）→ 有意**不**声明 locale：
  // renderer 对"声明了 locale 却没有 locale face"是抛 SlotAssemblyError（白屏整个条目）。
  assert.equal(registration.options.locale, undefined,
    'locale 服务缺席时不许声明 locale —— 否则 slot 条目直接 crash')
  assert.equal(typeof registration.component, 'function')
})

it('★ 本轮恢复：宿主没有 shell.overlay 槽时，壁纸照常落在 document.body（核心功能不静默失效）', async () => {
  /* 缺口 2：`shell.overlay` 是较新机制。若宿主版本没有这个槽，
     `OverlaySurface` 永远不会挂载（注册入口当时只 `console.warn` 后放弃）
     ⇒ 旧实现"容器缺席就先不落 DOM"等于**壁纸永远不出现** —— 整个插件的核心功能静默失效。
     现在背景层**固定挂 `<body>`**（分层硬约束：浮层槽是 z-index:20，进去就盖住 UI），
     所以"槽在不在"与壁纸落位**完全解耦**。本用例锁的正是这个解耦。 */
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true, overlaySlot: false })
  loaded.exports.apply(ctx)
  await tick(80)

  assert.deepEqual(calls.injected, ['shell.overlay', 'settings.section'],
    '仍然优先尝试官方槽（请求发了，只是宿主没接）')
  assert.equal(calls.registrations.some((r) => r.options.name === 'shell.overlay'), false,
    '槽不存在时条目注册根本没发生 ⇒ 浮层容器不会出现')

  const backdrop = loaded.dom.byId.get('dts-backdrop')
  assert.ok(backdrop, '壁纸层必须仍然落在 DOM 里（核心功能不许静默失效）')
  assert.equal(backdrop.parentNode, loaded.dom.doc.body,
    '槽缺席 ⇒ 壁纸仍然落在 document.body（落位与浮层槽解耦）')
  assert.equal(loaded.dom.doc.body.firstChild, backdrop,
    '挂在 body 首子节点（z-index:0 的固定层压在 #root 之下）')
  assert.ok(loaded.dom.doc.body.classList.contains('dts-on'), '材质改写族的闸照常打开')
})

it('ledger 说没落地时，回退到「通用设置」一行（入口消失就是功能退化）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: false })
  loaded.exports.apply(ctx)
  await tick(80)
  assert.deepEqual(calls.injected, ['shell.overlay', 'settings.section', 'settings.general.item'])
})

/**
 * 官方 locale 服务的忠实替身（契约逐条抄自运行中产物
 * `_official/dsh-client-locale/lib/client.js`）：
 *   · register(ns, {zh,en})                     → :1387  返回撤销本次注册的 disposer :1398
 *   · bind(ns) → (key, params) => translate     → :1414-1421
 *   · translate：回退链 → common → 键名本身；插值正则 `/\{(\w+)\}/g` → :1423-1427
 *   · getSnapshot() 带单调递增 revision          → :1250 / :1443
 *   · subscribe(fn) → unsubscribe               → :1260
 * 用它当被测对象，才能证明"注册真的发生、t() 真的走官方 API"，
 * 而不是只证明我们调了一个同名函数。
 */
function makeFakeLocaleService(active) {
  const dicts = new Map()
  const listeners = new Set()
  const registers = []
  const binds = []
  let bound = 0
  const state = { active: active ?? 'zh', revision: 0 }
  const service = {
    registers,
    binds,
    dicts,
    getBoundCalls: () => bound,
    snapshot() { return { active: state.active, locales: [{ id: 'zh' }, { id: 'en' }], revision: state.revision } },
    setActive(next) { state.active = next; state.revision += 1; service.notify() },
    notify() { for (const fn of [...listeners]) fn() },
    register(ns, dictsArg) {
      registers.push({ ns, dicts: dictsArg })
      const owner = dicts.get(ns) ?? new Map()
      dicts.set(ns, owner)
      for (const [locale, entries] of Object.entries(dictsArg)) owner.set(locale, entries)
      state.revision += 1
      service.notify()
      return () => {
        for (const locale of Object.keys(dictsArg)) owner.delete(locale)
        state.revision += 1
        service.notify()
      }
    },
    getSnapshot() { return service.snapshot() },
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn) } },
    bind(ns) {
      binds.push(ns)
      return (key, params) => {
        bound += 1
        const owner = dicts.get(ns)
        const chain = state.active === 'zh' ? ['zh', 'en'] : ['en']
        let template
        for (const locale of chain) {
          const value = owner?.get(locale)?.[key]
          if (value !== undefined) { template = value; break }
        }
        if (template === undefined) {
          for (const locale of chain) {
            const value = dicts.get('common')?.get(locale)?.[key]
            if (value !== undefined) { template = value; break }
          }
        }
        // 未命中回吐键名 —— 与官方 translate 的 `?? key` 逐字一致（client.js:1425）。
        if (template === undefined) return key
        if (!params) return template
        return String(template).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
      }
    },
  }
  return service
}

it('官方 locale 契约 · 词典按 ctx.effect(() => locale.register(ns, {zh,en})) 注册，卸载被 effect 回收', async () => {
  const loaded = loadBundle({ boot: {}, language: 'zh-CN' })
  loaded.sandbox.fetch = stateFetch
  const locale = makeFakeLocaleService('zh')
  const { ctx, calls } = makeCtx({ entries: true, locale: locale })
  loaded.exports.apply(ctx)
  await tick(80)

  // ① 注册真的发生，且是官方签名：ctx.locale.register(ns, { zh, en })，ns 为字符串
  assert.equal(locale.registers.length, 1, 'zh/en 文案表应注册进官方 locale 服务')
  const registration = locale.registers[0]
  assert.equal(registration.ns, 'dsh-theme-studio', '命名空间 = 插件自有名（点分风格留给 settings.* 这类）')
  assert.deepEqual(Object.keys(registration.dicts).sort(), ['en', 'zh'], '两个内置语言必须都注册')
  const { MESSAGES, LOCALE_NS } = loaded.exports.__internals
  assert.equal(LOCALE_NS, 'dsh-theme-studio', '命名空间常量必须与注册值一致（不许两处各写一遍）')
  assert.equal(registration.dicts.zh, MESSAGES.zh, '词典必须与本地 t() 同源（同一 MESSAGES 对象），不漂移')
  assert.equal(registration.dicts.en, MESSAGES.en)
  assert.equal(Object.keys(registration.dicts.zh).length, 148, 'zh 词典 148 键（阶段 E 增 section.intro，恢复轮增 shape.motionOff），注册的必须是完整词典')
  assert.equal(Object.keys(registration.dicts.en).length, 148, 'en 词典 148 键')

  // ② 注册发生在 apply 内，且包在 ctx.effect 里（官方形态），带非空 reason
  const dictEffect = calls.effectDisposers.find((item) => item.reason === 'theme-studio: locale dictionaries')
  assert.ok(dictEffect, '词典注册必须作为一个具名 ctx.effect 存在（官方形态）')
  assert.equal(calls.effectReasons.filter((r) => r === 'theme-studio: locale dictionaries').length, 1,
    '词典注册只许有一个 effect（重复注册会撞 already has locale）')

  // ③ 卸载时 effect 回收：register 的 disposer 真的撤销了这次注册
  assert.deepEqual([...locale.dicts.get('dsh-theme-studio').keys()].sort(), ['en', 'zh'])
  dictEffect.dispose()
  assert.deepEqual([...locale.dicts.get('dsh-theme-studio').keys()], [], '卸载必须撤掉词典注册（不留悬空目录）')
  // 撤销之后再注册不会撞 "already has locale"（register 对重复语言会抛）
  assert.doesNotThrow(() => locale.register('dsh-theme-studio', { zh: MESSAGES.zh, en: MESSAGES.en }),
    'disposer 必须真的释放语言槽位，否则重注册会抛 already has locale')

  assert.equal(calls.registrations.length, 2,
    '首次注册两个条目：设置页 settings.section + 框架级浮层 shell.overlay（阶段 E 起背景层/提示挂后者）')
  const { component: sectionComponent, face: sectionFace } = panelHandle(calls)
  void sectionComponent
  void sectionFace
  const sectionReg = calls.registrations.find((item) => item.options.name === 'settings.section')
  assert.equal(typeof sectionReg.options.label, 'function', 'label 是 thunk')
  assert.equal(sectionReg.options.label(), '主题工坊')
  assert.equal(sectionReg.options.locale, LOCALE_NS,
    '有 locale 服务时按官方签名声明 locale 命名空间（换语言由外壳重解析，不再重注册）')
})

it('官方 locale 契约 · 换语言靠 label thunk + locale 声明，不再 dispose/重注册', async () => {
  const loaded = loadBundle({ boot: {}, language: 'zh-CN' })
  loaded.sandbox.fetch = stateFetch
  const locale = makeFakeLocaleService('zh')
  const { ctx, calls } = makeCtx({ entries: true, locale: locale })
  loaded.exports.apply(ctx)
  await tick(80)
  const { component: sectionComponent, face: sectionFace } = panelHandle(calls)
  void sectionComponent
  void sectionFace
  const registration = calls.registrations.find((item) => item.options.name === 'settings.section')
  assert.equal(registration.options.label(), '主题工坊')
  assert.equal(registration.options.locale, 'dsh-theme-studio',
    '声明 locale：外壳把 locale revision 纳入投影比较键，换语言时重解析 label 并重渲染 outlet')

  // 宿主切到英文：locale 服务换语言只做一次 publish → revision +1 → 订阅者被撞。
  locale.setActive('en')
  await tick(20)

  /* ★ 本轮改造的核心断言：**注册次数不变**。
     旧实现（字符串 label + 无 locale）只能靠"换语言 → dispose + 重注册"来换文案，
     代价是组件整棵重建、"重注册丢草稿"。现在文案由 thunk 现取，外壳负责重渲染。 */
  assert.equal(calls.registrations.length, 2,
    '换语言不许重新注册：label 是 thunk，外壳自己重解析（官方全程没有重注册代码）')
  assert.equal(registration.options.label(), 'Theme Studio',
    '同一个 thunk 换语言后必须现取到英文 —— 这就是"不需要重注册"的判据')
  assert.equal(registration.options.id, 'dsh-theme-studio')
  // 换语言不重注册词典（官方 revision 会同时标记换语言与词典注册，这里必须是换语言那一次）
  assert.equal(locale.registers.length, 1, '换语言不该重复注册词典')
})

it('官方 locale 契约 · t() 优先走官方 bind(ns)，服务缺席才回落本地词典', async () => {
  const loaded = loadBundle({ boot: {}, language: 'zh-CN' })
  const { t, MESSAGES, setLocaleService, LOCALE_NS } = loaded.exports.__internals
  const locale = makeFakeLocaleService('zh')

  // 服务接入前：本地词典兜底（语言取自 navigator=zh-CN）
  assert.equal(t('section.title'), '主题工坊', '无服务时必须仍能取到中文（降级链）')

  setLocaleService(locale, null)
  // 官方目录给"可分辨"的副本：这样才分得清取到的是官方目录还是本地表。
  const officialZh = Object.assign({}, MESSAGES.zh, { 'section.title': '官方·主题工坊' })
  const officialEn = Object.assign({}, MESSAGES.en, { 'section.title': 'Official Theme Studio' })
  locale.register(LOCALE_NS, { zh: officialZh, en: officialEn })

  // 走官方：t() 必须取官方目录的值（不是本地表的值）
  assert.equal(t('section.title'), '官方·主题工坊', '有服务时官方目录是主路径')
  assert.ok(locale.getBoundCalls() > 0, 't() 必须真的经官方 bind(ns) 取文案')
  assert.deepEqual(locale.binds, [LOCALE_NS], 'bind 的命名空间必须是注册时的同一个')

  // 官方目录原地换文案 → t() 立刻跟随（证明读的就是官方目录，不是本地表）
  officialZh['section.title'] = '官方·改过了'
  assert.equal(t('section.title'), '官方·改过了', '官方目录变了 t() 要跟随')

  // 官方两个目录都没有的键 → 回落到本地同源词典（MESSAGES），而不是显示键名
  delete officialZh['profile.hint']
  delete officialEn['profile.hint']
  assert.equal(t('profile.hint'), MESSAGES.zh['profile.hint'],
    '官方 en/zh 都未命中必须回落本地同源词典（同一次查询里英文回退不成立才算未命中）')

  // 换语言：官方 active='en' → t() 跟随官方英文目录（权威源是 locale 服务）
  locale.setActive('en')
  assert.equal(t('section.title'), 'Official Theme Studio', '官方语言一变，t() 必须跟随')

  // 服务不可用：回到降级链（<html lang> 优先于 navigator），证明兜底仍在、但已不是主路径
  setLocaleService(null, null)
  loaded.sandbox.document.documentElement.lang = 'en'
  assert.equal(t('profile.hint'), MESSAGES.en['profile.hint'], '服务缺席时回落本地词典，语言按 <html lang> 判')
  loaded.sandbox.document.documentElement.lang = 'zh-CN'
  assert.equal(t('profile.hint'), MESSAGES.zh['profile.hint'], '再回中文：降级链每次现读，不缓存语言')
})

it('官方 locale 契约 · 位置参数折成官方具名参数，{0} 由官方正则替换', async () => {
  const loaded = loadBundle({ boot: {}, language: 'zh-CN' })
  const { t, MESSAGES, setLocaleService } = loaded.exports.__internals
  const locale = makeFakeLocaleService('zh')
  setLocaleService(locale, null)
  locale.register('dsh-theme-studio', { zh: MESSAGES.zh, en: MESSAGES.en })

  // 本表唯一带占位的键：官方正则是 /\{(\w+)\}/g（具名），数字属 \w，
  // 所以位置参数折成 { '0': v } 后官方替换能命中 `{0}`。
  assert.equal(t('menu.noop', '撤销'), '「撤销」这次没有可以作用的内容',
    '官方路径下 {0} 必须被替换 —— 否则界面直接显示 {0}')
  assert.equal(t('menu.noop'), '「{0}」这次没有可以作用的内容',
    '没传参数时应保留 {0} 原样，不能渲染成 undefined')
  assert.equal(t('__no_such_key__', 'x'), '__no_such_key__', '缺键回退键名这条契约不许退化')

  // 与官方实现同一条正则：证明 `{0}` + {'0': …} 的组合真的成立
  const official = '「{0}」这次没有可以作用的内容'.replace(/\{(\w+)\}/g,
    (match, name) => (name in { '0': '撤销' } ? String({ '0': '撤销' }[name]) : match))
  assert.equal(official, '「撤销」这次没有可以作用的内容', '官方插值正则必须命中 {0}（数字属 \\w）')
})

it('官方 locale 契约 · 148 键逐条经官方服务可解析（键名与官方点分风格一致）', async () => {
  const loaded = loadBundle({ boot: {}, language: 'zh-CN' })
  const { MESSAGES, setLocaleService } = loaded.exports.__internals
  const locale = makeFakeLocaleService('zh')
  setLocaleService(locale, null)
  locale.register('dsh-theme-studio', { zh: MESSAGES.zh, en: MESSAGES.en })
  const bound = locale.bind('dsh-theme-studio')
  const keys = Object.keys(MESSAGES.zh)
  assert.equal(keys.length, 148)
  for (const key of keys) {
    assert.equal(bound(key), MESSAGES.zh[key], `官方目录里 ${key} 必须能取到中文原值`)
  }
  locale.setActive('en')
  for (const key of keys) {
    assert.equal(bound(key), MESSAGES.en[key], `官方目录里 ${key} 必须能取到英文原值`)
  }
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

it('整窗全屏已挪进窗口顶条（面板头里不再有它，右偏移按 WCO 实测）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(60)

  /* ★ 阶段 E：全屏键不再是"客户端 appendChild 到 body 的裸 button"，
     而是浮层宿主里 React 渲染的节点 —— 所以要在挂载浮层之后从元素树里取它。 */
  mountOverlay(calls, loaded.dom.doc)
  const fsView = overlayView(calls, 'FullscreenButton')
  assert.ok(fsView, '浮层里应有 FullscreenButton（顶条全屏键）')
  const fsNode = findNodes(fsView, (props) => props.className === 'dts-fs')[0]
  assert.ok(fsNode, '顶条上应挂出整窗全屏按钮')
  assert.equal(fsNode.children[0], '⤢')
  assert.equal(loaded.dom.doc.body.children.some((el) => el.className === 'dts-fs'), false,
    'document.body 下不许出现全屏键（阶段 E：该处 body 写入已删）')
  // title / aria-label 都来自同一个本地化键；再核一遍那个键本身不是空串。
  assert.equal(fsNode.props.title, loaded.exports.__internals.t('common.fullscreen'))
  assert.equal(fsNode.props['aria-label'], fsNode.props.title, 'title 与 aria-label 必须同源')
  /* §3 Tooltip 接线（本轮新增的**唯一** Tooltip 调用点）：全屏键是纯图标键（只有 ⤢），
     气泡给的正是它的无障碍名。契约的证明方式：Tooltip 靠
     `cloneElement(child, { ref, onMouseEnter, onMouseLeave, onFocus, onBlur })` 定位锚点 ——
     所以锚点元素上**必须出现这四个处理器 + ref**。这同时是"children 是能接 ref 的原生元素"的
     **更强**证明：函数组件不转发 ref 时，这些处理器根本落不到任何节点上。 */
  assert.equal(fsNode.type, 'button',
    'Tooltip.children 必须是原生元素（函数组件不转发 ref ⇒ 气泡永不出现）')
  for (const handler of ['ref', 'onMouseEnter', 'onMouseLeave', 'onFocus', 'onBlur']) {
    assert.equal(typeof fsNode.props[handler], 'function',
      `Tooltip 必须把 ${handler} 克隆到锚点上（这正是气泡能定位/弹出的前提）`)
  }

  const { CHROME_CSS } = loaded.exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-fs', 'position'), 'fixed', '必须脱离面板流、贴到窗口顶条')
  assert.equal(declOf(parsed, '.dts-fs', '-webkit-app-region'), 'no-drag',
    '顶条整条是 drag 区，不标 no-drag 会被当成标题栏拖走、点不动')
  assert.match(declOf(parsed, '.dts-fs', 'right'), /--dts-caption-inset/,
    '右偏移必须走 JS 实测的自定义属性（原生 — □ × 宽度不是常量）')

  // 面板头里不该再留同一个按钮：它是"移走"，不是"复制一个"。
  const { component, face } = panelHandle(calls)
  const stillInHead = findNodes(component(face), (props) => props.children === '⤢')
  assert.equal(stillInHead.length, 0, '面板头里不该再有整窗全屏')
})

it('文本域必须 border-box：width:100% 的 padding 加在外面会顶出横向滚动（实测超界 16px）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  const boxed = parsed.find(() => true)
    .filter((entry) => entry.decls.get('box-sizing') === 'border-box')
    .flatMap((entry) => entry.selector.split(',').map((part) => part.trim()))
  // 这一族是"宽 100% + 自带 padding"的主力：漏一个就是 content-box，
  // padding 挤到容器外 → body/group 被顶出横向滚动（主人实测「这个 UI 超出了界限」）。
  // ⚠️ 阶段 C/D：`.dts-input` 已随"Input 控件等价皮肤"一起删除（控件自己的
  // module.css 是唯一几何真源），这个角色现在只剩高级页的原生 textarea。
  for (const cls of ['.dts-textarea', '.dts-body', '.dts-group', '.dts-modal-panel',
    '.dts-modal-options', '.dts-row']) {
    assert.ok(boxed.includes(cls), cls + ' 必须进 box-sizing:border-box 名单')
  }
  assert.equal(declOf(parsed, '.dts-textarea', 'width'), '100%', '文本域按容器铺满')
  assert.match(declOf(parsed, '.dts-textarea', 'padding'), /4px 8px/,
    '它带左右 8px 内边距 —— 不在 border-box 名单里就会比容器宽出 16px')
  // 反向锁：那层等价皮肤必须**已删**（控件 module.css 生效后它就是第二个真源）。
  for (const gone of ['.dts-input', '.dts-field-grow>input', '.dts-input-flex>span', '.dts-input-flex input']) {
    assert.equal(parsed.rule(gone), undefined, gone + ' 等价皮肤应已删除（盐 bug 已修，控件自带样式生效）')
  }
})

it('遮罩层绝不许成为 backdrop root —— 官方形态：只走令牌，且自造遮罩已整族删除', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)

  /* 机制：带 backdrop-filter 的元素是 backdrop root，子树里再开 blur 只采到"这一层"。
     实测（条纹壁纸 + 遮罩 + 玻璃卡）：遮罩无 blur → 卡内条纹被卡片自己的 40px 抹净 ✓；
     遮罩 blur(2px) → 卡内条纹**清晰可见** ✗。

     自家模态的遮罩 `.dts-scrim`/`.dts-modal-mask` 已**整族删除**，遮罩改由自写控件层
     的 `Modal` 提供 —— 形态是官方的 `backdrop-filter: var(--dsw-mask-blur)`，
     而 ui-theme 把 `--dsw-mask-blur` 定义为 `none`（官方明文"遮罩不模糊背景"）。
     所以纪律换了个载体但没变：不自己写模糊（走令牌，令牌当前 = none）；
     不压黑到废掉子级取景（官方用 `bg-mask-1` 的语义色，不是自选黑）。 */
  for (const gone of ['.dts-scrim', '.dts-modal-mask', '.dts-modal-card', '.dts-dialog']) {
    assert.equal(parsed.rule(gone), undefined, gone + ' 应已整族删除（改由 Modal 控件承载）')
  }
  const modalCss = controlCss('dtsModalMask')
  assert.ok(modalCss.length > 0, '应能在产物里找到 Modal 控件的 CSS 模块')
  const maskDecls = scopedDecls(modalCss, 'dtsModalMask')
  assert.ok(maskDecls !== undefined, 'Modal 控件应有遮罩规则')
  assert.equal(maskDecls.get('backdrop-filter'), 'var(--dsw-mask-blur)',
    '官方遮罩的模糊走 --dsw-mask-blur 令牌（当前 = none，即"遮罩不模糊背景"）')
  assert.ok(!/blur\(/.test(modalCss.replace(/var\(--dsw-mask-blur\)/g, '')),
    '控件层遮罩里不许出现字面 blur()：模糊强度是 token 的事')

  /* ★ 本轮恢复：宿主遮罩族（`_backdrop` / `_scrim` / `-backdrop` / `-scrim`）摘掉
     backdrop-filter 的那一组规则**必须回来** —— 零自选色口径下 blur() 是唯一承担
     "看不清底字"的机制，而带 backdrop-filter 的遮罩会成为 **backdrop root**，
     把它子树里所有玻璃面的取景圈死（实测：遮罩 blur2px → 卡片内条纹清晰可见）。
     Phase C/D 曾整族删除并反转锁，主人复判为误判，本轮按副本恢复。 */
  for (const back of ['body.dts-on [class$="_backdrop"]', 'body.dts-on [class$="-scrim"]',
    'body.dts-on [class$="_backdrop"] > *', 'body.dts-on [class$="-scrim"] > *']) {
    assert.ok(parsed.rule(back) !== undefined, back + ' 是「遮罩不当 backdrop root」的载体，必须恢复')
  }
  for (const face of ['body.dts-on [class$="_backdrop"]', 'body.dts-on [class$="-scrim"]']) {
    assert.equal(declOf(parsed, face, 'backdrop-filter'), 'none!important',
      face + ' 必须摘掉自己的 backdrop-filter（否则圈死子树取景）')
  }
  // 遮罩的**子元素**（浮层玻璃卡）则必须给糊 —— 32px 玻璃卡是模态语义的载体。
  for (const card of ['body.dts-on [class$="_backdrop"] > *', 'body.dts-on [class$="-scrim"] > *']) {
    assert.equal(declOf(parsed, card, 'backdrop-filter'), GLASS_BLUR_EXPECT, card + ' 要真磨砂')
    assert.equal(declOf(parsed, card, 'border-radius'), '32px!important')
  }
  // 反向闸：真正该磨砂的**自家**玻璃面必须留着 blur，别被这条纪律一刀切掉。
  for (const face of ['.dts-cmenu', '.dts-cmenu-toast']) {
    assert.equal(declOf(parsed, face, 'backdrop-filter'), GLASS_BLUR_EXPECT,
      face + ' 是真玻璃面，模糊必须留着且只走官方令牌')
  }
})

it('★ 宿主表面锚点强注：输入卡/弹层/引导卡/停靠面板/hover 卡一处都不许再丢（本轮恢复）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  /* ★ 本轮恢复（主人复测判定阶段 C/D 的"整族删除宿主锚点"为误判）：
     主人原话「有很多原本的设定和功能都缺失了，比如这个对话框要磨砂。零自选色，零压暗」，
     截图是会话页**输入卡没有磨砂**。零自选色口径下 `blur()` 是唯一承担"看不清底字"的
     机制，而宿主大量表面（输入卡 / 「+」命令弹层 / hover 卡 / 引导卡 / DockKit 面板 /
     设置之上的叠加层 / portal 到 body 的对话框）**不是**官方 MenuSurface，没有材料子层、
     底色直接读 `--dsw-alias-bg-layer-*`（已被玻璃重铸成半透明）—— 只靠令牌重铸覆盖不到。
     Phase C/D 用一条 `FORBIDDEN` 正则把这些锚点整族钉成"不许出现"；本轮**按副本原样移植**
     回来，锁随之翻转成"这些面必须都在"，并加**计数下限**防止再被静默删光。
     ⚠️ 判据不是"我们猜中了宿主的类名"，而是"主人点名的表面必须拿到磨砂"：
     计数下限 + 逐面存在性断言，比"一个正则禁掉全部"更贴近诉求。 */
  const need = [
    ['输入卡本体', 'body.dts-on [class$="_card"]'],
    ['输入卡多类名变体（busy 态）', 'body.dts-on [class*="_card "]'],
    ['输入卡的磨砂搬进 ::before（卡片本体不当 backdrop root）',
      'body.dts-on [class$="_card"]:has([data-placeholder])::before'],
    ['「+」命令弹层', 'body.dts-on [class$="_card"]:has([class*="search"])'],
    ['会话统计条', 'body.dts-on [data-composer-stats]'],
    ['会话/工作区 hover 卡', 'body > :has([class*="hoverTime"])'],
    ['文件行', 'body.dts-on [class$="_file"]'],
    ['交接预览', 'body.dts-on [class$="_preview"]'],
    ['DockKit 停靠面板', 'body.dts-on [data-dockkit-pane]'],
    ['引导卡（已全屏 → 磨砂）',
      'body.dts-on [class$="_panel"]:has([data-sidebar-right-mode="push"]) [class$="_entry"]'],
    ['引导卡（未全屏 → 零材质）',
      'body.dts-on [data-sidebar-right-panel="push"] [class$="_entry"]'],
    ['加载浮标', 'body.dts-on [class$="_loadingFloat"]'],
    ['宿主对话框族', 'body.dts-on [role="dialog"]'],
    ['宿主工具提示/菜单/列表（全局兜底）',
      'body.dts-on :is([role="tooltip"],[role="menu"],[role="listbox"],[role="alertdialog"],[class$="_tooltip"],[class$="_popover"],[class$="_dropdown"],[class$="_popup"])'],
    ['设置面板本体（零色 + 磨砂）',
      'body.dts-on [class$="_overlay"]:has(> [class$="_mask"]) > [class$="_panel"]'],
    ['设置遮罩（摘掉 backdrop-filter）',
      'body.dts-on [class$="_overlay"] > [class$="_mask"]'],
    ['设置面板内的一切叠加层',
      'body.dts-on [class$="_overlay"]:has(> [class$="_mask"]) > [class$="_panel"] :is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"],[class$="_dialog"],[class$="_menu"],[class$="_popover"],[class$="_popup"],[class$="_tooltip"],[class$="_dropdown"],[class$="_sheet"])'],
    ['确认框实底压实（特异性稳压 `-scrim > *`）',
      'body.dts-on .dsh-agent-dialog.dsh-agent-dialog[class~="dsh-agent-dialog"]'],
    ['构建版本徽章', '[class*="buildVersion"]'],
    ['反相实底 chip', 'body.dts-on [class*="_tag_"][data-tone="solid"]'],
  ]
  const missing = need.filter(([, selector]) => parsed.rule(selector) === undefined)
  assert.deepEqual(missing.map(([label]) => label), [],
    '这些主人点名的表面锚点丢了 —— 恢复源：audit-theme-studio/_tmp/mut/src/client/chrome.ts')
  // 计数下限：防"逐条断言被一起删掉"的历史重演（副本实测 [class$= ×85 / [class*= ×32 / :has( ×24）。
  const counts = {
    'class$=': (CHROME_CSS.match(/class\$=/g) ?? []).length,
    'class*=': (CHROME_CSS.match(/class\*=/g) ?? []).length,
    ':has(': (CHROME_CSS.match(/:has\(/g) ?? []).length,
    '[role=': (CHROME_CSS.match(/\[role=/g) ?? []).length,
  }
  assert.ok(counts['class$='] >= 40, 'host `class$=` 锚点计数过低：' + counts['class$='])
  assert.ok(counts['class*='] >= 15, 'host `class*=` 锚点计数过低：' + counts['class*='])
  assert.ok(counts[':has('] >= 10, 'host `:has(` 锚点计数过低：' + counts[':has('])
  assert.ok(counts['[role='] >= 5, 'host `[role=` 锚点计数过低：' + counts['[role='])
  // 反向闸：别把整份样式删空了当"合规" —— 自家规则必须还在。
  const own = parseCss(CHROME_CSS).find(() => true)
    .filter((entry) => /^(body\.dts-on )?\.dts-/.test(entry.selector))
  assert.ok(own.length >= 30, '自家规则至少 30 条，实际 ' + own.length + ' —— 少了说明删过头')
  // 自家类名也不该再用 *any* 属性锚 —— Select 触发器走 ARIA 契约。
  assert.equal(CHROME_CSS.indexOf('dtsSelectTrigger'), -1,
    '不许再按 module 类名后缀锚定（ARIA 契约同样稳定且不吃构建盐）')
  // ★ 阶段 E 的承重墙：背景层靠它压在 #root 之下 —— 恢复锚点时绝不许连带把它删掉。
  assert.equal(declOf(parsed, 'body.dts-on #root', 'z-index'), '1')
  assert.equal(declOf(parsed, 'body.dts-on #root', 'position'), 'relative')
})

it('★ 本轮恢复：玻璃清单 = 别名层 + 基元白名单（neutral-50/100 放行，基元大族仍全挡）', () => {
  const { composeGlass } = loadBundle().exports.__internals
  /* 宿主四张「白面卡」的局部填充变量（`--changes-fill` / `--deliverable-fill` /
     `--plan-card-fill` / `--card-fill`）在**卡片元素自身**上声明为
     `var(--dsw-static-neutral-50)`，而宿主 `ThemePresenter.apply()` 把我们的令牌写成
     **body 行内样式** ⇒ 元素自身的声明压过继承值 ⇒ **只有沿 var() 链改基元**才重铸得到
     白面；把局部变量名塞进清单是空操作（实测）。爆炸半径逐字实测：整份宿主产物里
     neutral-50 共 10 处、-100 共 8 处，消费点 = 那四个组件 + 一个别名
     `--dsw-alias-markdown-inline-code`（本就在清单里、有自己的重铸值）。 */
  assert.ok(GLASS_SURFACES.length >= 20, '玻璃清单不该被删空')
  assert.ok(GLASS_SURFACES.includes('--dsw-static-neutral-50'),
    '产出卡白面基元必须进清单（否则白字主题下白底白字）')
  assert.ok(GLASS_SURFACES.includes('--dsw-static-neutral-100'), '同上（hover 面）')
  for (const name of GLASS_SURFACES) {
    if (name.indexOf('--dsw-static-') === 0) continue
    assert.match(name, /^--dsw-(alias|specific)-/, '除基元白名单外只许别名层：' + name)
  }
  assert.ok(!GLASS_SURFACES.includes('--dsw-alias-bg-layer-4'),
    '--dsw-alias-bg-layer-4 不存在（官方层阶只有 base/1/2/3/overlay）')
  assert.ok(!GLASS_SURFACES.includes('--dsw-specific-input-major'),
    '全局 input-major 不进玻璃清单（宿主会话输入框保持不透明）')

  /* ★ 闸口必须只有一处判据。清单（identity.ts，经 engine.js 投影）之外还有**三道**，
     任一处漏改都会静默失效（本轮实测踩到过）：`app.ts` 对宿主投影的过滤、
     `probe-glass.ts` 的 composeGlass 运行时闸 —— 两处都必须调同一个判据函数。 */
  const src = (rel) => readFileSync(join(here, '..', rel), 'utf8')
  const identitySrc = src('src/client/identity.ts')
  assert.ok(identitySrc.includes('export function isGlassSurfaceAllowed'),
    'identity.ts 必须导出唯一的闸口判据 isGlassSurfaceAllowed()')
  for (const rel of ['src/client/app.ts', 'src/client/probe-glass.ts']) {
    assert.ok(src(rel).includes('isGlassSurfaceAllowed('),
      rel + ' 必须走同一个闸口判据（否则清单改了会被这一道静默挡掉）')
  }
  // 反向闸：不许再有第二份"前缀硬编码"的旁路判断。
  for (const rel of ['src/client/app.ts', 'src/client/probe-glass.ts']) {
    assert.equal(/indexOf\('--dsw-static-'\)\s*(===|!==)\s*0/.test(src(rel)), false,
      rel + ' 里不许再出现 --dsw-static- 前缀硬编码旁路')
  }

  // 运行时闸（行为面）：白名单里的两个真的被重铸，基元大族真的被拦掉。
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#101418' : '#ffffff') }
  const doc = { glass: { enabled: true, alpha: 0.5 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(
    ['--dsw-static-neutral-50', '--dsw-static-neutral-100', '--dsw-static-neutral-850',
      '--dsw-static-neutral-00', '--dsw-static-blue-500', '--dsw-alias-bg-layer-1'], doc, probe, {})
  assert.ok(out['--dsw-static-neutral-50'] !== undefined, '白名单基元必须被重铸（产出卡白面）')
  assert.ok(out['--dsw-static-neutral-100'] !== undefined, '同上')
  for (const blocked of ['--dsw-static-neutral-850', '--dsw-static-neutral-00', '--dsw-static-blue-500']) {
    assert.equal(out[blocked], undefined, '基元大族仍必须被运行时闸拦掉：' + blocked)
  }
  assert.ok(out['--dsw-alias-bg-layer-1'] !== undefined, '别名层照常重铸（闸不能误伤）')
})

it('★ 阶段 D：令牌基准值优先走官方 ctx.theme.getTheme()，样式表扫描只是兜底', () => {
  const { createTokenProbe } = loadBundle().exports.__internals
  /* 官方服务面（运行时自省实测）：
       getTheme(): ThemeSnapshot = { preference, fontSize, active: ThemeDefinition, themes, revision }
       ThemeDefinition = { id, colorScheme: 'light'|'dark', tokens: Record<string,string> }
     两套模式基准值 = `themes` 按 colorScheme 分组。这正是官方自己发布的读法
     （"Reads go through getTheme …"），而旧实现是遍历 `document.styleSheets` ——
     references_ui-plugin.md:13 明文点名的 stylesheet 读取。 */
  const LIGHT = {
    '--dsw-alias-bg-base': '#ffffff',
    '--dsw-alias-label-primary': '#0f1115',
    '--dsw-specific-menu': 'var(--dsw-menu-surface-fill)',
    '--dsw-menu-surface-fill': '#f8f9fa94',
  }
  const DARK = {
    '--dsw-alias-bg-base': '#151517',
    '--dsw-alias-label-primary': '#f2f3f5',
    '--dsw-specific-menu': 'var(--dsw-menu-surface-fill)',
    '--dsw-menu-surface-fill': '#43454a73',
  }
  const themes = [
    { id: 'light', colorScheme: 'light', tokens: LIGHT },
    { id: 'dark', colorScheme: 'dark', tokens: DARK },
  ]
  const service = { getTheme: () => ({ preference: 'light', fontSize: 14, revision: 3, themes: themes, active: { id: 'light', colorScheme: 'light', tokens: {} } }) }
  const probe = createTokenProbe({ theme: () => service })
  assert.equal(probe.source(), 'theme-service', '官方服务在位时必须走官方路径')
  assert.equal(probe.of('--dsw-alias-bg-base', 'light'), '#ffffff')
  assert.equal(probe.of('--dsw-alias-bg-base', 'dark'), '#151517', '两套模式都从 themes 分组拿到')
  assert.equal(probe.of('--dsw-specific-menu', 'dark'), '#43454a73',
    '表内 var() 引用必须递归解析到字面量（把 var() 原样写回 override 等于玻璃静默失效）')

  // ⚠️ active.tokens 只**补缺**，绝不覆盖 themes 的基础值：active 是"按覆盖层合成后"的
  // 视图（我们自己的 overrideTokens 层也在里面），拿它当基准就是"读自己写过的值再算一遍"。
  const overridden = createTokenProbe({
    theme: () => ({
      getTheme: () => ({
        preference: 'light', fontSize: 14, revision: 4, themes: themes,
        active: { id: 'light', colorScheme: 'light', tokens: { '--dsw-alias-bg-base': '#000000', '--dsw-specific-bubble': '#123456' } },
      }),
    }),
  })
  assert.equal(overridden.of('--dsw-alias-bg-base', 'light'), '#ffffff',
    'active 里的同名值不许覆盖 themes 的基础值（那是我们自己覆盖层合出来的视图 = 反馈环）')
  assert.equal(overridden.of('--dsw-specific-bubble', 'light'), '#123456',
    'themes 里没有的名字才由 active 补')

  // 兜底路径：服务缺席 / getTheme 抛错 / 只回一侧 —— 才回落样式表扫描。
  const missing = createTokenProbe({ theme: () => null })
  assert.equal(missing.source(), 'stylesheet-scan',
    '服务缺席才回落扫描（该兜底正是 ui-plugin.md:13 点名的 stylesheet 读取，删不删由主人定，见报告 §2）')
  assert.equal(missing.of('--dsw-alias-bg-base', 'light'), '#ffffff', '兜底路径仍要能取到基准值')
  const throwing = createTokenProbe({ theme: () => ({ getTheme: () => { throw new Error('boom') } }) })
  assert.equal(throwing.source(), 'stylesheet-scan', 'getTheme 抛错必须退到兜底而不是崩')
  const halfSide = createTokenProbe({
    theme: () => ({ getTheme: () => ({ themes: [{ id: 'light', colorScheme: 'light', tokens: LIGHT }], active: null }) }),
  })
  assert.equal(halfSide.source(), 'stylesheet-scan', '只回一侧说明服务形态不符，也走兜底')
  // 完全没有 theme 服务句柄时同样不崩（老宿主 / 服务未挂载）。
  assert.equal(createTokenProbe({}).source(), 'stylesheet-scan')
  assert.equal(createTokenProbe().source(), 'stylesheet-scan')
})

it('顶条「编辑」菜单换成磨砂面板（原生 Menu.popup 的 CSS 够不着，只能拦点击换掉）', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(60)

  // 装载时必须登记文档级监听：原生菜单是 preload 按钮的 click 触发的，
  // 只有捕获阶段能抢在它前面把它拦下来。
  assert.ok(loaded.dom.docEvents.some((item) => item.el === loaded.dom.doc && item.type === 'click'),
    '必须登记文档级捕获点击（拦住 preload 按钮的 click 才换得掉）')
  assert.ok(loaded.dom.docEvents.some((item) => item.el === loaded.dom.doc && item.type === 'keydown'),
    '必须登记 Escape 关闭')

  const { CHROME_CSS } = loaded.exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-cmenu', 'position'), 'fixed', '面板要贴在按钮下沿、脱离文档流')
  assert.equal(declOf(parsed, '.dts-cmenu', 'background'), GLASS_EXPECT,
    '必须读统一玻璃变量：有透明感但看不清底面字，全插件一个真源')
  assert.equal(declOf(parsed, '.dts-cmenu', 'backdrop-filter'), GLASS_BLUR_EXPECT,
    '必须真磨砂，且模糊只许来自官方 --dsw-menu-backdrop-filter（没有它就只是变淡，不是玻璃）')
})

it('★ 零自选色：CHROME_CSS 里除了存档例外，不许有硬编码颜色/字面 blur', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)

  /* 判据（references_practices.md:34）：
       "Style with the theme tokens … **literal colors are for artwork only**"
     ⚠️ 本轮恢复后有三类**存档例外**（都是"官方不为此发令牌"的 artwork 面，逐条在
     chrome.ts 里写明理由，副本原文即如此）：
       · 近黑深底 `rgba(16,20,24,.28/.92)` 与 `rgba(16,18,22,.82)`
         —— ①`--dts-glass-fill-thin`（无糊小件的浅底，唯一带自选色的玻璃令牌，
         无奈的技术例外）②`.dsh-agent-dialog` 确认框实底压实 ③反相实底 chip 兜底；
       · `rgba(255,255,255,.08)` 描边 / `rgba(0,0,0,.4)` 阴影 —— 官方没有"通用白描边"令牌；
       · `#16181d` / `#263148` —— 原生 <select> 弹层（Chromium 对弹层仅有的可样式化入口，
         必须不透明，半透明会被弹层忽略）。
     断言方式：**先剥掉这几处存档例外**，再要求剩余部分一个颜色字面值都没有 ——
     "顺手多写一个自选色"依然会被抓住；历史另一套自选色（深蓝灰 48,64,88）
     与近黑的**非例外 alpha** 仍在反例扫描里钉死。 */
  const SANCTIONED_COLOR = /rgba\(16,\s*20,\s*24,\s*\.(28|92|15)\)|rgba\(16,\s*18,\s*22,\s*\.82\)|rgba\(255,\s*255,\s*255,\s*\.08\)|rgba\(0,\s*0,\s*0,\s*\.4\)|#16181d|#263148/g
  const stripped = CHROME_CSS.replace(SANCTIONED_COLOR, '')
  const colors = stripped.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []
  assert.deepEqual(colors, [], '存档例外之外还有硬编码颜色：' + colors.join(', '))
  /* 字面 blur() 只许出现在**兜底链**里（`--dts-glass-blur` → 官方令牌的末级兜底），
     且兜底链的形态必须是"我们的变量 → 官方令牌 → 官方默认值"，不许出现别的字面模糊。 */
  const BLUR_FALLBACK = /var\(--dts-glass-blur,var\(--dsw-menu-backdrop-filter,blur\(40px\) saturate\(150%\)\)\)/g
  const BLUR_FALLBACK_INNER = /var\(--dsw-menu-backdrop-filter,blur\(40px\) saturate\(150%\)\)/g
  const fallbackUses = (CHROME_CSS.match(BLUR_FALLBACK) ?? []).length
  assert.ok(fallbackUses >= 5,
    '兜底链应在每处玻璃面都出现（glass() 组装），实际 ' + fallbackUses)
  const blurs = CHROME_CSS
    .replace(BLUR_FALLBACK, '')
    .replace(BLUR_FALLBACK_INNER, '')
    .match(/blur\(/g) ?? []
  assert.deepEqual(blurs, [], '兜底链之外不许有字面 blur()：' + blurs.join(', '))

  // ① 真源：零自选色（transparent）+ 薄底 + 带兜底的模糊转发，且只有一处定义。
  const rootFill = parsed.rule(':root')
  assert.equal(rootFill.get('--dts-glass-fill'), 'transparent',
    '零自选色：玻璃的颜色 100% 来自壁纸（由 blur() 采样），我们一个色都不选')
  const blurOwner = parsed.find(() => true).find((entry) => entry.decls.has('--dts-glass-blur'))
  assert.equal(blurOwner && blurOwner.decls.get('--dts-glass-blur'),
    'var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%))',
    '--dts-glass-blur 必须是转发层并保留兜底链（模糊只有一个来源；缺席时不许退化成"只变淡不磨砂"）')
  /* ★★★ 而且**必须声明在 body 上**（第三十三轮）：自定义属性的 var() 在**声明它的元素**上求值，
     而官方把 --dsw-menu-backdrop-filter 发在 body 上。挂在 :root 上时该元素上它未定义 ⇒ 直接吃
     fallback，子元素继承到的是**已算完**的固定值、不会重新求值 ⇒ 全页 15 个 backdrop-filter 元素
     的模糊与「面板模糊/面板饱和」滑块彻底脱钩（真机实测：令牌从 0 变到 60，渲染值一个不动）。 */
  assert.equal(rootFill.get('--dts-glass-blur'), undefined,
    '--dts-glass-blur 不许再挂在 :root 上 —— 那样它会在求值时吃 fallback，与模糊滑块脱钩')
  assert.equal(rootFill.get('--dts-glass-fill-thin'), 'rgba(16,20,24,.28)',
    '"无糊小件"的浅底是**半透明薄底**（既不是 transparent、也不是 menu-surface-fill）：'
    + '透明+无糊=控件消失，这条是唯一的技术例外')
  const defs = parsed.find(() => true).filter((entry) => entry.decls.has('--dts-glass-fill'))
  assert.equal(defs.length, 1, '真源只许有一处定义，多一处就是又分叉了')

  // ② 所有玻璃面都读它 —— "统一"的机器证明（自家面 + 宿主面）。
  const glassy = parsed.find(() => true).filter((entry) =>
    /backdrop-filter/.test([...entry.decls.keys()].join()))
  assert.ok(glassy.length >= 3, '真玻璃面至少 3 处，实际 ' + glassy.length)
  for (const entry of glassy) {
    const bf = entry.decls.get('backdrop-filter')
    if (bf === 'none' || bf === 'none!important') continue
    assert.equal(bf, GLASS_BLUR_EXPECT,
      entry.selector + ' 的模糊必须走 --dts-glass-blur → 官方令牌（唯一来源 + 兜底链）')
    const bg = entry.decls.get('background') ?? entry.decls.get('background-color')
    if (bg === undefined) continue
    /* 允许三条路径：统一玻璃变量 / 显式 transparent / **压字实底件**走的
       `--dsw-alias-button-elevated-fill`（反相 chip：零色化后它是 transparent 就变成
       "白字浮在透明底上"，亮壁纸上读不出字 —— 小色块是压字件，不是玻璃面，见 chrome.ts）。 */
    assert.match(bg, /--dts-glass-fill|transparent|--dsw-alias-button-elevated-fill/,
      entry.selector + ' 没走统一变量 —— 每个写死的实色都是一次"又给自己选了个色"')
  }

  // ③ 反例扫描：历史另一套自选色必须绝迹；近黑只许以存档例外的 alpha 出现
  //    （.28 薄底 / .92 确认框实底 / .15 徽章兜底）。
  const nearBlack = CHROME_CSS.match(/rgba\(16,\s*20,\s*24,\s*\.(?!28|92|15)\d+/g) ?? []
  assert.deepEqual(nearBlack, [], '近黑自选色只许是存档例外（.28/.92/.15）：' + nearBlack.join(', '))
  assert.equal(CHROME_CSS.match(/rgba\(48,\s*64,\s*88/g), null, '深蓝灰自选色必须绝迹')
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
  assert.equal(loaded.dom.byId.has('dts-backdrop'), false, '背景层应被移除')
  assert.equal(loaded.dom.byId.has('dts-layer-style'), false, '背景样式应被回收')
  assert.equal(loaded.dom.byId.has('dts-chrome-style'), false, '界面样式应被回收')
  assert.equal(loaded.dom.doc.body.children.some((el) => el.className === 'dts-fs'), false,
    '顶条上的整窗全屏按钮必须随卸载摘掉')
})

it('getState 自带写口令：宿主重启轮换口令后客户端能自证刷新', async () => {
  const seen = []
  const loaded = loadBundle({ boot: { writeToken: 'tok-abc' } })
  loaded.sandbox.fetch = async (url, init) => {
    seen.push({ url: String(url), headers: (init && init.headers) || {} })
    return { ok: true, status: 200, json: async () => ({ ok: true, value: PROJECTION }) }
  }
  const { ctx } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(60)
  const stateCall = seen.find((item) => item.url.includes('/api/state'))
  assert.ok(stateCall, '应请求过 /api/state')
  // Host 只对持口令方回显 writeToken（http.js 的 holder 分支）：不带头就永远拿不到
  // 宿主重启后的新口令，只能整页刷新才能再写。
  assert.equal(stateCall.headers['x-dts-key'], 'tok-abc', 'GET /api/state 必须带写口令')
  // 自检快照：皮肤问题的第一现场在 DOM，这是外部唯一能读到它的通道。
  const diag = stateCall.headers['x-dts-diag']
  assert.equal(typeof diag, 'string', 'GET /api/state 必须带自检快照')
  const parsed = JSON.parse(decodeURIComponent(diag))
  assert.equal(typeof parsed.chrome, 'boolean', '快照要能回答"样式注进去了没有"')
  assert.equal(typeof parsed.body, 'string', '快照要能回答"body 上有没有 dts-on"')
  assert.ok(Array.isArray(parsed.cards) && parsed.cards.length >= 0,
    '快照要带回宿主卡片的类名（用来判定命名约定是哪套）')
})

it('卸载后在飞的投影不得复活样式与背景层（僵尸主题回归锁）', async () => {
  let release = null
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      if (release === null) await new Promise((resolve) => { release = resolve })
      else await Promise.resolve()
      return { ok: true, value: PROJECTION }
    },
  })
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(20)
  assert.ok(typeof release === 'function', '首次 reload 应已挂起在 json() 上')
  calls.disposers.forEach((dispose) => dispose())
  assert.equal(loaded.dom.byId.has('dts-layer-style'), false, '卸载时样式应已回收')
  release()
  await tick(40)
  assert.equal(loaded.dom.byId.has('dts-layer-style'), false, '在飞响应不得把样式重新长回来')
  assert.equal(loaded.dom.byId.has('dts-backdrop'), false, '在飞响应不得重建背景层')
})

it('过期投影不落地：并发 reload 的旧响应不得把 revision 打回去（第四轮）', async () => {
  const loaded = loadBundle({ boot: {} })
  let stale = false
  loaded.sandbox.fetch = async () => {
    const value = stale
      ? Object.assign({}, PROJECTION, { revision: PROJECTION.revision - 1, css: '/* STALE */' })
      : PROJECTION
    return { ok: true, status: 200, json: async () => ({ ok: true, value }) }
  }
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(60)
  const styleEl = loaded.dom.byId.get('dts-layer-style')
  assert.ok(styleEl, '新鲜投影应已落地')
  assert.ok(!styleEl.textContent.includes('STALE'))
  const before = calls.overrideTokens.length
  stale = true
  // reload 有 4 个触发源（boot settle / 可见性 / SSE / 提交失败），旧响应后到就该被
  // 同一道过期门挡掉 —— commit 早就有这道门，reload 一直没有（审计发现）。
  loaded.dom.fire(loaded.dom.doc, 'visibilitychange')
  await tick(60)
  assert.equal(calls.overrideTokens.length, before, '过期投影不得重新落地（否则会把已应用的 revision 打回去）')
  assert.ok(!loaded.dom.byId.get('dts-layer-style').textContent.includes('STALE'),
    '过期 css 不得写进样式表')
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

it('★ 阶段 C：色彩令牌不写硬编码兜底（官方：要么裸引用，要么兜另一个令牌）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  /* 官方 39 个 `.module.css` 里 **0 处** `var(--dsw-*,<字面值>)` 兜底；唯一带色彩兜底的
     范例是 `var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))`
     —— 兜**另一个令牌**。数值/关键字型令牌才写兜底
     （`var(--dsh-frame-top-clearance, 24px)`、`var(--ds-transition-duration, .2s)`）。
     阶段 C 之前有 104 处 `var(--dsw-x,#hex)`，本轮全部改掉。 */
  const offenders = []
  const re = /var\((--[a-z0-9-]+),([^()]*)/g
  let hit
  while ((hit = re.exec(CHROME_CSS)) !== null) {
    const value = hit[2].trim()
    if (/^(#|rgba?\(|hsla?\()/.test(value)) offenders.push(hit[1] + ' → ' + value)
  }
  assert.deepEqual(offenders, [], '色彩令牌不许写硬编码兜底：' + offenders.join(' | '))
  // 少数派口径：带兜底的引用必须远少于裸引用（官方 133 个被消费令牌里只有 14 个带兜底）。
  const withFallback = (CHROME_CSS.match(/var\(--[a-z0-9-]+,/g) ?? []).length
  const bare = (CHROME_CSS.match(/var\(--[a-z0-9-]+\)/g) ?? []).length
  assert.ok(bare > withFallback, '裸引用必须多于带兜底引用：裸 ' + bare + ' / 兜底 ' + withFallback)
  // box-sizing 的作用域必须全是自家 dts-* 类，不能污染官方组件。
  const parsed = parseCss(CHROME_CSS)
  const boxRules = parsed.find((selector) => parsed.rule(selector).get('box-sizing') === 'border-box')
  assert.ok(boxRules.length >= 1, '应有 box-sizing 规则')
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

/* ------------------------------------------------------------------ */
/* 交互层：设置入口 → 模态 → 焦点归还 → 确认框 → 自写控件                  */
/* ------------------------------------------------------------------ */

/**
 * 控件身份判定：自写控件层（src/client/controls/**）与调用方同处一个 bundle，
 * 测试里拿不到它的导出对象 —— 于是按**函数名**认。
 * 为什么可靠：① 产物不压缩（treeshake/minify 都关着），函数名不会被打散；
 * ② 控件走 forwardRef/memo，而本文件的 react 替身把这两者实现成"返回内层函数"，
 * 名字因此原样保留；③ 插件自己没有再定义同名函数（唯一的重名 Slider 不在断言里用）。
 */
const isControl = (name) => (node) => typeof node.type === 'function' && node.type.name === name

/**
 * 在渲染树里找出**控件元素**。
 *
 * ⚠️ 为什么不能写成 `findNodes(tree, isControl(name))`：`findNodes` 的谓词收到的是
 * **props**（它按"组件的入参"筛选，例如 `props.id === 'dts-modal-host'`），
 * 而 `isControl` 吃的是**节点**（要用 `node.type.name`）—— 两者混用**恒返回 0 条**，
 * 断言会以"提示必须由自写 Toast 渲染（0 !== 1）"这种形式永远为假（实测踩过：
 * 上一轮的这两条 Toast 断言就是这么写的，等于一句话都没验）。
 */
function findControls(tree, name) {
  return findNodes(tree, () => true).filter(isControl(name))
}

/**
 * 「渲染到控件 `name` 为止」的停止谓词：命中时**该组件保留为元素本身**。
 *
 * 为什么必须有这一条：断言要看的是"交给这个控件的 props / children"
 * （`Modal` 的 `open/headless/closeLabel`、`Toast` 的 `tone/holdMs/text`），
 * 而真 React 也不会因为"组件渲染过了"就把调用方传进去的元素从树上抹掉 ——
 * 它只是**另外**产出一棵子树。本夹具用"保留元素 + 显式停止"表达这一点。
 */
const stopAt = (name) => (node) => typeof node.type === 'function' && node.type.name === name

/** 类名归一成列表：CSS Modules 给字符串，`clsx(...)` 给字符串或数组。 */
function classList(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value ?? '').split(/\s+/).filter(Boolean)
}

/**
 * 元素的直接子节点，**总是数组**。
 *
 * ⚠️ 真库把 `createElement(Comp, {}, 'x')` 的单子节点归一成 `props.children = 'x'`
 * （**字符串，不是数组**）—— 本夹具的 react 替身逐字对齐了这一点（`cloneElement`
 * 的单子节点契约就靠它）。于是"按下标取第一个子节点"的断言必须经这里拉平，
 * 否则拿到的是字符串本身（`'保存当前方案'[0]` 是 `'保'`）。
 */
function childNodes(node) {
  const props = node.props ?? {}
  const raw = props.children !== undefined ? props.children : node.children
  if (raw === null || raw === undefined) return []
  return Array.isArray(raw) ? raw.filter((item) => item !== null && item !== undefined) : [raw]
}

/** 深度遍历渲染树，收集满足条件的元素节点。
 *
 *  ⚠️ 三条与真库对齐的遍历规则：
 *   ① 门户节点（`{$$typeof: Symbol.for('react.portal'), children, containerInfo}`）要
 *      **穿透** —— 它的 children 就是被渲染进 containerInfo 的那棵子树；
 *   ② 子元素同时挂在 `props.children` 与 `node.children` 上时**只走一遍**
 *      （真库只有 `props.children` 一处；本夹具多留的 `children` 字段是便利访问），
 *      否则同一棵子树会被数两次；
 *   ③ 宿主元素与门户都继续下钻（真 React 会把它们渲染出来）。
 */
function findNodes(node, predicate, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) findNodes(item, predicate, out)
    return out
  }
  if (isPortal(node) || node.$$typeof === 'element') {
    if (node.$$typeof === 'element' && predicate(node.props ?? {})) out.push(node)
    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (key === 'children' && node.children !== undefined) continue
      findNodes(value, predicate, out)
    }
    findNodes(node.children, predicate, out)
    return out
  }
  /* 其它宿主包装（本夹具不会产生）：继续钻它的 children。 */
  findNodes(node.children, predicate, out)
  return out
}

/** 从已注册的设置页条目里取回组件与 inject 面（组件唯一的依赖来源）。 */
function panelHandle(calls) {
  const reg = calls.registrations.find((item) => item.options.name === 'settings.section')
  assert.ok(reg, '设置页条目应已注册')
  return { component: reg.component, face: reg.options.inject() }
}

/**
 * `shell.overlay` 的注册记录（框架级浮层是背景层/提示/兜底模态/全屏键的唯一落点）。
 * @returns {{ options: any, component: Function }}
 */
function overlayRegistration(calls) {
  const reg = calls.registrations.find((item) => item.options.name === 'shell.overlay')
  assert.ok(reg, 'shell.overlay 条目应已注册（框架级浮层的唯一落点）')
  return reg
}

/** 浮层条目的元素树（只调条目组件一次；`OverlaySurface` 自己调 `props.content()` 摆内容）。 */
function overlayEntry(calls) {
  return overlayRegistration(calls).component({})
}

/**
 * 「渲染」一棵元素树 —— 本夹具的 reconciler-lite，语义与真库对齐的三条：
 *
 *   ① **门户是惰性的**：`createPortal(children, container)` 只交出
 *      `{$$typeof: Symbol.for('react.portal'), children, containerInfo}`；
 *      落 DOM 发生在**提交**（`commitPortals`），不在渲染期。所以"再渲染一遍"
 *      绝不重复挂载（旧替身把渲染与挂载压成同一件事，是四条断言取不到稳定节点的根因）。
 *   ② **函数组件被调用一次得到它的输出**（宿主元素 / 门户 / 数组 / null）；
 *      `props.children` 按真库语义传进去（`node.children` 是我们多留的便利字段）。
 *   ③ **停止谓词**（`options.stop`）：命中时该组件**保留为元素本身**，不再展开 ——
 *      断言要看的就是"交给控件的 props/children"（见 `stopAt`）。
 *
 * `options.intoPortals`：是否把门户的 children 也渲染进来（阅读视图 true；提交 false）。
 * `options.blankPortals`：门户只留落点、children 置空 —— 取"框架层结构"时用，
 *   免得门户内容（住在别的容器里）混进浮层宿主自己的树（见 `overlayFrame`）。
 */
function renderTree(node, options, depth = 0) {
  const opts = options ?? {}
  const stop = opts.stop ?? null
  const intoPortals = opts.intoPortals !== false
  const blankPortals = opts.blankPortals === true
  if (depth > 24) return node
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map((item) => renderTree(item, opts, depth + 1))
  if (typeof node !== 'object') return node
  if (isPortal(node)) {
    if (blankPortals) return Object.assign({}, node, { children: null })
    if (!intoPortals) return node
    return Object.assign({}, node, { children: renderTree(node.children, opts, depth + 1) })
  }
  if (node.$$typeof !== 'element') return node
  if (stop !== null && stop(node)) return node
  if (typeof node.type === 'function') {
    const props = Object.assign({}, node.props)
    if (node.children !== undefined) props.children = node.children
    return renderTree(node.type(props), opts, depth + 1)
  }
  /* 宿主元素（含 Fragment 那条字符串标记）：React 会渲染它的 children。 */
  return Object.assign({}, node, { children: renderTree(node.children, opts, depth + 1) })
}

/**
 * 浮层宿主的**框架层结构**：门户只留落点、不带内容。
 *
 * 为什么要有这一层：门户的内容渲染在 `containerInfo` 里（`Toast`/`Modal` portal 到
 * `document.body`、模态盒 portal 进 `#dts-modal-host`），**不属于浮层宿主自己的树**。
 * 「重复打开不得叠第二个模态容器」这类"框架层只有一个"的断言就该在这一层判。
 */
function overlayFrame(calls) {
  return renderTree(overlayEntry(calls), { intoPortals: false, blankPortals: true })
}

/**
 * 取出浮层里某个内容组件（`NoticeViewport` / `ModalHost` / `FullscreenButton`）的**元素**。
 * `OverlaySurface` 把内容放在 `props.content` 回调里并自己调用它，所以只能按**组件函数名**
 * 取（与 `isControl` 认名字同源），不能靠 children 位置。
 */
function contentElement(calls, name) {
  const found = findNodes(renderTree(overlayEntry(calls), { intoPortals: false, stop: stopAt(name) }), () => true)
    .find((node) => typeof node.type === 'function' && node.type.name === name)
  assert.ok(found, `浮层内容里应有 ${name}（由 shell.overlay 的 OverlaySurface 渲染）`)
  return found
}

/**
 * 渲染一个浮层内容组件（等价于 React 渲染那一层）。
 *
 * @param calls `makeCtx` 记下的调用记录。
 * @param name 内容组件名（`NoticeViewport` / `ModalHost` / `FullscreenButton`）。
 * @param stop 停止谓词（`stopAt('Toast')` / `stopAt('Modal')`）—— 把要断言的控件
 *   保留为元素；不传则一路展开到原生节点。
 * @returns 渲染树（函数组件已展开、门户保留为惰性对象；**不落 DOM**）。
 */
function overlayView(calls, name, stop = null) {
  return renderTree(contentElement(calls, name), { stop: stop, intoPortals: true })
}

/**
 * 自顶向下摊平组件树，收集**宿主元素 → 它的 ref 回调**的**配对**。
 *
 * 为什么是配对而不是两个平行数组：只有带 `ref` 的宿主元素才进得了 ref 列表，
 * 平行下标一旦遇到"无 ref 的宿主元素"就错位（把 A 的 DOM 节点交给 B 的 ref）。
 *
 * ⚠️ 宿主节点必须用**夹具自己的** `document.createElement` 造（`dom.doc`）。
 * 早先用"自带的最小替身"造节点时，`appendChild` 没有写进夹具的 `byId` 索引，
 * 于是层管理器把层挂上去之后 `document.getElementById('dts-backdrop')` 仍是 null ——
 * 表现为"背景层应被创建"红，而日志里 `append -> true`（实测踩过这一脚）。
 *
 * 门户（`{$$typeof: react.portal}`）不在这里处理：它不是元素，且内容住在别的容器里
 * （落 DOM 是 `commitPortals` 的事）。
 */
function walkHosts(node, doc, pairs, hosts, depth = 0) {
  if (depth > 12) return
  if (Array.isArray(node)) {
    for (const item of node) walkHosts(item, doc, pairs, hosts, depth + 1)
    return
  }
  if (node === null || node === undefined || typeof node !== 'object') return
  if (node.$$typeof !== 'element') return
  if (typeof node.type === 'function') {
    walkHosts(node.type(Object.assign({}, node.props, { children: node.children })), doc, pairs, hosts, depth + 1)
    return
  }
  /* Fragment 不是元素（它只把 children 拼平），不要给它造节点、也不要当成 ref 宿主。
     react 替身把 `Fragment` 打成字符串 `'Fragment'`（真库是 Symbol，两者都不等于宿主标签名）。 */
  if (node.type === 'Fragment') {
    walkHosts(node.children, doc, pairs, hosts, depth + 1)
    return
  }
  const host = doc.createElement(node.type)
  if (node.props.id !== undefined) {
    host.id = node.props.id
    /* 宿主节点要能被夹具的 `document.getElementById` 找到：React 真运行时它们会**先**被
       插进文档（`<div ref>` 提交）再被 ref 回调交给插件，`byId` 索引就是那一刻建立的。
       这里没有真调度器，所以补这一笔 —— 缺了它会表现为"模态容器由浮层宿主渲染"红。 */
    if (doc.__indexById) doc.__indexById(host)
  }
  /* 兄弟宿主节点在真运行时是**嵌套**的（模态容器是层容器的子节点）——
     这里没有 DOM 插入，所以按"父亲已就位就挂上去"补上父子关系。 */
  const parent = hosts.length > 0 ? hosts[0] : null
  if (parent !== null && typeof parent.appendChild === 'function') parent.appendChild(host)
  hosts.push(host)
  if (typeof node.props.ref === 'function') pairs.push({ ref: node.props.ref, host: host })
  walkHosts(node.children, doc, pairs, hosts, depth + 1)
}

/** 每个 `calls` 上已提交的门户槽位：`Map<门户序号, { container, node }>`。 */
const overlaySlots = new WeakMap()

/**
 * 把门户落进它的 `containerInfo` —— 真库 React 的 **commit 阶段**。
 *
 * 规则（本夹具的边界，与 §6 的说明一致）：
 *   · 只处理"门户的直接子节点**已经是宿主元素**"的情形（不再展开任何组件）——
 *     框架层的容器盒（`ModalHost` portal 进浮层容器的那个 `display` 开关盒）正是这一类；
 *     门户里还是"组件"的子节点（`Toast` 元素等）不在这里造 DOM：它们的 DOM 由控件自己
 *     portal，断言读元素树（真库那一份由真浏览器负责，不由夹具代劳）。
 *   · **每个门户一个槽位**：同一个 `calls` 上再提交一次只**更新**那个节点，
 *     绝不 append 第二个（旧替身在渲染期 append ⇒ 每多渲染一遍就多挂一份）。
 */
function commitPortals(tree, slots, doc) {
  let portalIndex = 0
  /** 造宿主元素的 DOM 节点：只认断言用得上的 `id` / `className`（`style` 读元素树）。 */
  function materialize(element) {
    const host = doc.createElement(element.type)
    if (element.props.id !== undefined) {
      host.id = element.props.id
      if (doc.__indexById) doc.__indexById(host)
    }
    if (typeof element.props.className === 'string') host.className = element.props.className
    /* 回链：DOM 节点 ↔ 产出它的元素（断言"提交的是哪个门户"时用得上）。 */
    host.__element = element
    return host
  }
  const visit = (node) => {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (isPortal(node)) {
      const index = portalIndex
      portalIndex += 1
      const container = node.containerInfo
      if (container === null || container === undefined || typeof container.appendChild !== 'function') return
      const children = Array.isArray(node.children) ? node.children : [node.children]
      const hostElement = children.find((child) => child !== null && child !== undefined
        && typeof child === 'object' && child.$$typeof === 'element' && typeof child.type !== 'function')
      if (hostElement === undefined) return
      const slot = slots.get(index)
      if (slot !== undefined && slot.container === container) {
        slot.node.__element = hostElement
        return
      }
      const host = materialize(hostElement)
      container.appendChild(host)
      slots.set(index, { container: container, node: host })
      return
    }
    if (node.$$typeof !== 'element') return
    visit(node.children)
  }
  visit(tree)
}

/**
 * 重跑一次"渲染 + 提交"（等价于 React 的一次重渲染）：门户只更新、不叠加。
 * 不碰任何 `ref` —— React 只在 mount/unmount 时调 ref，重渲染不调。
 */
function commitOverlay(calls, doc) {
  const slots = overlaySlots.get(calls) ?? new Map()
  commitPortals(renderTree(overlayEntry(calls), { intoPortals: false }), slots, doc)
  overlaySlots.set(calls, slots)
  return slots
}

/* 挂载状态按 `calls` 缓存：本夹具没有 React 调度器，**重复挂载会真的走一遍卸载 + 重挂**
   （`OverlaySurface` 的 effect 清理会把 ref 回调成 `null` → `layer.detachStage()`），
   于是"多问几次当前树"就会把背景层拆掉 —— 与真运行时不符（React 只在真正卸载时才那样）。
   所以这里模拟一次挂载并缓存：后续查询复用同一份宿主句柄。 */
const overlayMounts = new WeakMap()

/**
 * 模拟"浮层条目挂载"（React 的 mount + 首次 commit）：
 *   ① 调组件函数拿元素树，自顶向下为宿主元素造 DOM 节点；
 *   ② 把 `ref(node)` 回调**配对**调用一次（commit 阶段把真实节点交给插件）——
 *      层容器 / 模态容器的节点就是靠它交出去的
 *      （`OverlaySurface` 的 `setHost`/`setModalHost` → `layer.attachStage`）；
 *   ③ 门户落进各自容器（`commitPortals`）。
 *
 * @param calls `makeCtx` 记下的调用记录。
 * @param doc 夹具的 `document`（`loaded.dom.doc`）—— 宿主节点必须由它创建，见 `walkHosts`。
 * @returns 挂载句柄（`hostNode` 是浮层宿主容器、`modalHostNode` 是模态容器）。
 */
function mountOverlay(calls, doc) {
  const cached = overlayMounts.get(calls)
  if (cached !== undefined) return cached
  assert.ok(doc && typeof doc.createElement === 'function', 'mountOverlay 需要夹具的 document')
  const pairs = []
  const hosts = []
  walkHosts(overlayEntry(calls), doc, pairs, hosts)
  assert.ok(hosts.length >= 2, '浮层应至少交出层容器与模态容器两个宿主节点')
  for (const pair of pairs) pair.ref(pair.host)
  commitOverlay(calls, doc)
  const mounted = {
    registration: overlayRegistration(calls), pairs: pairs, hosts: hosts,
    hostNode: hosts[0], modalHostNode: hosts[1],
  }
  overlayMounts.set(calls, mounted)
  return mounted
}

it('设置入口打开模态（Modal 控件承载），关闭路径把焦点交还原处', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const mounted = mountOverlay(calls, loaded.dom.doc)

  const { face } = panelHandle(calls)
  // 模态的唯一入口是设置页里的入口按钮：造一个真实按钮并聚焦，
  // 关闭后焦点必须回到它身上（不能掉回 body）。
  const opener = loaded.dom.doc.createElement('button')
  loaded.dom.doc.body.appendChild(opener)
  opener.focus()
  face.env.openModal()
  await tick(20)

  const host = loaded.dom.byId.get('dts-modal-host')
  assert.ok(host, '设置入口应把模态注进浮层宿主里的模态容器（不再自己往 body 挂节点）')
  assert.equal(host.parentNode, mounted.hostNode, '模态容器必须是浮层宿主的子节点（React 渲染，随卸载消失）')

  // 重复打开不得叠第二个模态。
  face.env.openModal()
  const hosts = loaded.dom.doc.body.children.filter((child) => child.id === 'dts-modal-host')
  assert.equal(hosts.length, 0, '模态容器不再挂在 document.body 下（阶段 E：body 写入清零）')
  assert.equal(
    findNodes(overlayFrame(calls), (props) => props.id === 'dts-modal-host').length, 1,
    '模态容器必须幂等：**浮层宿主自己的树**上只有一个（门户内容渲染在各自容器里，不属于这一层）',
  )

  /* ★ 本轮改造：Escape / 遮罩点击 / Tab 陷阱 / 焦点归还全部交给自写控件层的 `Modal`
     （逐字移植官方 `useModalLayer`）。本夹具只跑渲染、不跑组件树，所以文档级 Escape
     无处可去 —— 可断言的是"Modal 的 onClose 就是关模态"这条接线（Esc/遮罩两条路都汇到它）。
     走 `ModalHost` 交出的门户结构：它把 `ThemeStudioApp`（模态变体）portal 进
     `#dts-modal-host`，模态变体再包一层自写 `Modal` 控件 —— 所以渲染到 `Modal` 为止
     （`stopAt('Modal')`），否则控件的 props 会被它自己的产物顶掉、断言就无从下手。 */
  const mhv = overlayView(calls, 'ModalHost', stopAt('Modal'))
  const modalTree = findNodes(mhv, () => true)
  const modalNode = modalTree.find(isControl('Modal'))
  assert.ok(modalNode, '兜底模态必须由自写 Modal 渲染')
  assert.equal(modalNode.props.open, true)
  assert.equal(modalNode.props.headless, true, '面板自己画头部（54px + 28×28 关闭键）')
  assert.equal(modalNode.props.className, 'dts-modal-panel', '面板几何类（对齐官方 SettingsPanel）')
  assert.equal(modalNode.props.closeLabel, '关闭', 'closeLabel 是 Modal 的必填契约')
  assert.equal(typeof modalNode.props.onClose, 'function')
  const closeMarks = findNodes(modalNode, (props) => props.className === 'dts-modal-close')
  assert.equal(closeMarks.length, 1, '头部应有一个关闭键（28×28 / radius-sm）')
  assert.equal(closeMarks[0].props['aria-label'], '关闭')
  // 打开态：常驻的显示开关盒**不**隐藏（关闭时的 display:none 靠它切换）。
  const boxPortals = (Array.isArray(mhv) ? mhv : [mhv]).filter(isPortal)
  assert.equal(boxPortals.length, 2, '打开时 ModalHost 交出两个门户：显示开关盒 + 模态子树')
  assert.equal(boxPortals[0].containerInfo, host, '开关盒门户的落点是浮层宿主里的模态容器（不是 body）')
  assert.equal(boxPortals[1].containerInfo, host, '模态子树门户的落点同样是那个模态容器')
  assert.equal(isControl('Modal')(boxPortals[1].children), true,
    '门户进容器的正是「自写 Modal 控件承载的模态子树」（用户可见契约：确实经自写 Modal 渲染）')
  const openBox = boxPortals[0].children
  assert.ok(openBox, '打开态必须把常驻的显示开关盒 portal 进模态容器')
  assert.equal(openBox.props.style.display, undefined, '打开态显示开关盒不隐藏')

  // 关闭路径走 props 上的 openModal/closeModal 对偶：这里直接调入口 env 的关闭面
  //（Modal 控件的 onClose 也指向它，真运行时 Esc/遮罩两条路都汇到同一个函数）。
  if (typeof face.env.closeModal === 'function') face.env.closeModal()
  else modalNode.props.onClose()
  await tick(20)
  /* 阶段 E：模态**宿主节点不再由我们创建/销毁**（它是浮层宿主里 React 渲染的常驻容器），
     所以"关闭"的判据变成三条：① 模态树里不再有 Modal 控件；② 显示开关盒被标成
     `display:none`；③ 容器节点仍在浮层宿主下（没有被摘掉）。 */
  const closedView = overlayView(calls, 'ModalHost', stopAt('Modal'))
  /* ⚠️ 这里必须走 `findControls`：`findNodes(tree, isControl('Modal'))` 恒返回 0 条
     （前者把 **props** 交给谓词、后者吃的是**节点**），那样的断言"永远是绿的"、
     根本咬不住"关闭后 Modal 仍在渲染"这种回归。 */
  assert.equal(findControls(closedView, 'Modal').length, 0, '关闭后模态树里不该再有 Modal 控件')
  const closedBox = findNodes(closedView, (props) => props.id === 'dts-modal-host')[0]
  assert.ok(closedBox, '关闭后模态容器仍在浮层树上（常驻节点，不是 appendChild/remove 的建销对）')
  assert.equal(
    closedBox.props.style.display,
    'none', '关闭后模态容器必须隐藏（常驻节点 + display:none，不再是 appendChild/remove 的建销对）',
  )
  assert.equal(host.parentNode, mounted.hostNode, '关闭后模态容器仍挂在浮层宿主下（常驻，未被摘除）')
  assert.equal(host.isConnected, true, '关闭后模态容器仍然连接在文档上')
  // 提交一次：开关盒**更新**成隐藏，而不是再挂一个。
  commitOverlay(calls, loaded.dom.doc)
  assert.equal(loaded.dom.byId.get('dts-modal-host').children.length, 1, '关闭只更新开关盒，不再挂第二个')
  assert.equal(loaded.dom.byId.get('dts-modal-host').children[0].__element.props.style.display, 'none',
    'DOM 侧同一个开关盒被更新为隐藏（提交是"改"，不是"再挂一份"）')
  assert.equal(loaded.dom.doc.activeElement, opener, '焦点应归还入口按钮')
})

it('主路径只渲染内容列；模态变体才包一层 Modal 控件', async () => {
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
  /* ★ 第 1 步核验的那件事的**回归哨**：主路径（注进 settings.section）下，
     宿主已经给了 overlay + mask + 800px panel —— 我们不许再画第二层。
     判据：整棵树里不许出现 Modal 控件、也不许有自造遮罩类。 */
  const pageNodes = findNodes(component(face), () => true)
  assert.equal(pageNodes.filter(isControl('Modal')).length, 0,
    '主路径不许再套 Modal/遮罩：那会叠出双层遮罩 + 双层卡片（宿主已提供）')
  assert.equal(pageNodes.filter((n) => n.props.className === 'dts-modal-panel').length, 0,
    '主路径不许画第二个面板壳（宽度/圆角/阴影都归宿主那个 800px panel）')

  const modalTree = component(Object.assign({}, face, { onRequestClose() {} }))
  const variant = findNodes(modalTree, (props) => props['data-variant'] !== undefined)
  assert.equal(variant[0].props['data-variant'], 'modal')
  // 模态变体：内容列外面包一个 Modal（role=dialog + aria-modal 由控件内部渲染）。
  const dialog = findNodes(modalTree, () => true).filter(isControl('Modal'))
  assert.equal(dialog.length, 1, '兜底模态必须声明 role=dialog（由 Modal 控件承载）')
  assert.equal(dialog[0].props.title, '主题工坊', 'Modal 的 title 落 aria-label')
  assert.equal(dialog[0].props.open, true)
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
  // ★ 确认框改走自写控件层的 `Modal`（官方 useModalLayer：遮罩/Escape/焦点陷阱/aria）。
  const inner = findNodes(opened[0].type(opened[0].props), () => true)
  const dialog = inner.filter(isControl('Modal'))
  assert.equal(dialog.length, 1, '确认框必须由 Modal 控件承载（role=dialog + aria-modal 在它内部）')
  assert.equal(dialog[0].props.title, '删除这个素材？', 'Modal 的 title 落 aria-label')
  assert.equal(typeof dialog[0].props.onClose, 'function', 'Modal 的 onClose 就是"取消"')
  assert.equal(dialog[0].props.closeLabel, '取消', 'closeLabel 是 Modal 的必填契约')
  // 初始焦点必须用 data-modal-autofocus 标记确认键（不能用 React autoFocus）。
  const autofocus = findNodes(dialog[0], (props) => props['data-modal-autofocus'] !== undefined)
  assert.equal(autofocus.length, 1, '确认键必须带 data-modal-autofocus（官方 useModalLayer 唯一的初始焦点钩子）')
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

it('控件全部自写：按钮/状态点/页签交给 controls，官方包零 require', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const made = makeCtx({ entries: true })
  loaded.exports.apply(made.ctx)
  await tick(40)
  const { component, face } = panelHandle(made.calls)
  const nodes = findNodes(component(face), () => true)
  assert.ok(nodes.some(isControl('Button')), '按钮应交给自写 Button')
  assert.ok(nodes.some(isControl('StateDot')), '状态点应交给自写 StateDot')
  // ★ 页签改用自写控件层的 SegmentedTabs（官方等宽分段页签）：
  //   它自己渲染 tablist/tab 与滑动指示条 —— 就地调一次就能验 ARIA 契约。
  const tabsNode = nodes.find(isControl('SegmentedTabs'))
  assert.ok(tabsNode, '面板页签应交给自写 SegmentedTabs')
  const tabTree = findNodes(tabsNode.type(tabsNode.props), () => true)
  assert.equal(tabTree.filter((n) => n.props.role === 'tablist').length, 1, '页签栏必须带 tablist 角色')
  const tabs = tabTree.filter((n) => n.props.role === 'tab')
  assert.equal(tabs.length, tabsNode.props.items.length, '每个页签都有 tab 角色')
  assert.ok(tabs.every((n) => typeof n.props['aria-controls'] === 'string' && n.props['aria-controls'] !== ''),
    '每个页签必须 aria-controls 到它控制的 panel')
  // 旧用例还断言过"退回原生 button"的那条降级路径 —— 分支已删，正向锁替换之。
  assert.deepEqual(loaded.requested.filter((spec) => spec.startsWith('@deepseek-ai/')), [],
    '产物不得 require 任何官方包')
})

it('页签选择落到 localStorage，重建组件后仍是那一页', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { component, face } = panelHandle(calls)

  const tabsNode = findNodes(component(face), () => true).find(isControl('SegmentedTabs'))
  assert.ok(tabsNode, '页签应由 SegmentedTabs 渲染')
  const TAB_LIST = loaded.exports.__internals.TABS
  assert.ok(tabsNode.props.items.length >= 4, '应有多个页签')
  assert.equal(tabsNode.props.label, '主题工坊', 'tablist 的本地化无障碍名')
  // 第 3 个页签的可见文案来自同一次 t()，且点它要落 localStorage。
  assert.equal(tabsNode.props.items[2].label, face.t(TAB_LIST[2].key))
  const tabTree = findNodes(tabsNode.type(tabsNode.props), () => true)
  const tabs = tabTree.filter((n) => n.props.role === 'tab')
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
  // ⚠️ 打印器会给重名标识符加 `$n` 后缀：本插件里 deps.ts 与 controls/runtime.ts 各自
  // 导出一个 createElement 简写 `e`（两处实现等价、都走 loader 注入的 react），
  // 自写控件层进产物后，rolldown 把 tabs.ts 那个打印成 `e$1`。锁因此必须容忍后缀 ——
  // 认的是"存在 createElement 渲染点"，不是某个固定的标识符拼写。
  const renderPoint = (name) => new RegExp(`\\be(?:\\$\\d+)?\\(${name},`)
  const directCall = (name) => new RegExp(`(^|[^\\w.$])${name}\\$?\\d*\\(\\{`, 'm')
  for (const name of hookComponents) {
    assert.ok(!directCall(name).test(bundle), `${name} 被当函数直调了（应 e(${name}, {…})），会白屏`)
    // 页签组件经 e(Current, …) 变量分发渲染，不存在字面量 e(名字, 调用点。
    if (name === 'ProfileTab') continue
    assert.ok(renderPoint(name).test(bundle), `${name} 应有 e() 渲染点`)
  }
})

it('回归锁 · 前端契约同步宿主：键盘导航 / 焦点陷阱 / 动效令牌（交叉核验）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  // ⚠️ 产物引号风格由生产方决定：手写切片用单引号，rolldown 打印器统一双引号
  // （r1-probe 实测 + TS 产线实测）。锁只认「字面量存在」，不绑定引号风格。
  const hasLiteral = (text) => bundle.includes(`'${text}'`) || bundle.includes(`"${text}"`)
  // 下拉键盘契约（官方 Menu 逐字）：↑↓ wrap / Home / End / Enter —— 现在住在控件层
  // 的 Select/Menu 里（原来是我们自绘的 Choice）。
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
    assert.ok(hasLiteral(key), `下拉键盘缺少 ${key}（对齐官方 Menu）`)
  }
  // 页签键盘契约（官方 SegmentedTabs）：←→ wrap + Home/End + roving tabindex。
  assert.ok(hasLiteral('ArrowLeft'), '页签键盘缺少 ←（官方 SegmentedTabs）')
  assert.match(bundle, /tabIndex:\s*props\.value === item\.value \? 0 : -1/,
    '页签必须 roving tabindex（官方 SegmentedTabs：只有选中项是 tab 停点）')
  assert.ok(hasLiteral("tablist.querySelectorAll('[role=\"tab\"]')") || /querySelectorAll\(.\[role="tab"\].\)/.test(bundle),
    '页签方向键移动必须落到真实 tab 节点上（官方 SegmentedTabs 契约）')
  // 焦点陷阱（官方 useModalLayer 逐字，控件层 runtime.ts 移植）：Tab 圈闭在模态/对话框内，
  // 且排除 [inert]/[hidden] 子树。
  assert.ok(bundle.includes('[inert], [hidden]'),
    '模态/确认框必须有 Tab 焦点陷阱（官方 useModalLayer：排除 inert/hidden 子树）')
  assert.ok(/stack\[stack\.length - 1\] !== layer/.test(bundle),
    'Escape/Tab 的归属按"模态层栈"判定 —— 只有最顶层吃键（官方 useModalLayer）')
  // Esc 归属协议：下拉/菜单在**捕获阶段** preventDefault，模态层逐字检查 defaultPrevented。
  // 这正是原先手写版 `watchModalEscape` + `.dts-select-menu` 特判想做的事，现在走官方协议。
  assert.ok(/event\.defaultPrevented/.test(bundle),
    'Esc 归属必须走 event.defaultPrevented 协议（模态层不再手写"下拉开着就让位"）')
  // 动效令牌（ui-theme/src/styles/base.css 实证：--ds-ease-in-out / duration 0.2/fast 0.1/slow 0.3）。
  const parsed = parseCss(CHROME_CSS)
  const transitions = parsed.find(() => true)
    .flatMap(({ selector, decls }) => [...decls.entries()].map(([prop, value]) => ({ selector, prop, value })))
  assert.ok(transitions.some((d) => d.value.includes('var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)')),
    '动效必须走 --ds-transition-duration / --ds-ease-in-out 权威令牌，不散落硬编码')
  /* 下拉弹层的几何/材质契约**搬家了**：从 CHROME_CSS 的自绘 `.dts-select-menu`
     搬进控件层 `Select.module.css`（`MenuSurface` 材质 + `fields.module.css` 触发器几何）。
     锁因此改成读控件模块的 CSS —— 契约照旧钉住，只是换了文件。 */
  const selectCss = controlCss('dtsSelectList')
  assert.ok(selectCss.length > 0, '应能在产物里找到 Select 控件的 CSS 模块')
  const listDecls = scopedDecls(selectCss, 'dtsSelectList')
  assert.ok(listDecls !== undefined, 'Select 应有列表规则')
  // ⚠️ CSS Modules 编译器会把 calc() 与 var() 里的空格压掉，断言必须先归一空格。
  assert.equal(squeeze(listDecls.get('max-height')),
    squeeze('calc(100vh - 12px - max(12px, var(--dsh-frame-top-clearance, 12px)))'),
    '下拉列表必须有高度上限（视口净空扣掉顶边净空）—— 否则项数一多就撑出视口、被裁的项滚不到')
  assert.equal(listDecls.get('overflow-y'), undefined,
    '上限挂在卡片上、滚动挂在视口上（官方 Menu 的分工）')
  /* ★ 本轮恢复：`select{color-scheme:dark}` 与 `select option{}` 的深色兜底回来了。
     理由（副本原文）：原生 <select> 的弹层是**系统 UI**，主题令牌与 backdrop-filter
     一条都够不着；`option` 的 background/color 是 Chromium 桌面对原生弹层仅有的几个
     可样式化入口，而且**必须给不透明色**（半透明会被弹层忽略）。
     主人实测过「选项这里没同步」与"旧缓存下弹出浅灰透字弹层"两种翻车形态。
     ⚠️ 我们的面板**不用**原生 select（下拉是自写控件层的 `Select`：listbox 语义 +
     官方 Menu 几何）—— 这几条只作用于宿主可能残留的原生下拉，不参与面板外观。 */
  assert.equal(declOf(parsed, 'select', 'color-scheme'), 'dark',
    '原生弹层唯一可靠的外观开关（旧缓存下弹层也一并变深色实底）')
  assert.equal(declOf(parsed, 'select option', 'background'), '#16181d',
    'option 必须用不透明深色（半透明会被原生弹层忽略）')
  assert.equal(declOf(parsed, 'select option:checked', 'background'), 'var(--dsw-alias-brand-primary)',
    '选中项压掉系统蓝高亮，跟品牌色走')
})

it('「我的方案」注册进 TABS 第二位，高级页旧主题档区块已迁走', () => {
  const { TABS } = loadBundle().exports.__internals
  assert.equal(TABS[1].id, 'profile', '方案页紧跟预设，符合"随时切换"的定位')
  assert.ok(TABS.some((tab) => typeof tab.view === 'function' && tab.view.name === 'ProfileTab'))
  assert.ok(!bundle.includes("'adv.themes'"), '高级页不该再残留主题档区块')
})

it('每个自绘交互控件都有可见焦点环（原生回退类也不能让 Tab 看不见）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  // 收集所有 :focus-visible 规则里点到的类名（结构化解析，不抠文本）。
  const covered = new Set()
  for (const { selector } of parseCss(CHROME_CSS).find((s) => s.includes(':focus-visible'))) {
    for (const m of selector.matchAll(/\.dts-[a-z0-9-]+/g)) covered.add(m[0])
  }
  // 这些是插件自绘元素（原生 input / 色块 / 建议弹层 / 关闭键…）用到的类 —— 焦点环必须一样可见。
  // （页签与下拉项已搬进控件层，焦点环由各自的 .module.css 负责；这里只查 CHROME_CSS 这一侧。）
  const interactive = ['.dts-btn', '.dts-pill', '.dts-switch', '.dts-textarea',
    '.dts-swatch', '.dts-drop', '.dts-suggest-row', '.dts-modal-close']
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

  // 卡片按钮必须走 sm 尺寸：窄卡里两个按钮不许撑爆裁切。
  const tree = findNodes(component(face), () => true)
  const tabNode = tree.find((n) => typeof n.type === 'function' && n.type.name === 'LibraryTab')
  assert.ok(tabNode, 'library 页签应从 localStorage 恢复并渲染')
  const cards = findNodes(tabNode.type(tabNode.props), () => true)
  const buttons = cards.filter(isControl('Button'))
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

it('回归锁 · 自写 Toast 按契约传参：错误态省略 tone、带 holdMs', async () => {
  const loaded = loadBundle({ boot: {} })
  loaded.sandbox.fetch = stateFetch
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(40)
  const { face } = panelHandle(calls)
  mountOverlay(calls, loaded.dom.doc)

  face.env.notify('出错了', 'error')
  await tick(0)
  /* ⚠️ 视图**必须在 notify 之后**取：`OverlaySurface` 的内容是"渲染那一刻"的快照
     （本夹具的替身不重渲染），notify 之前取到的是一份空提示的树。 */
  /* ⚠️ 这里断言的是 **Toast 的产物节点**（`role="alert"`），不是 `Toast` 控件元素：
     渲染到原生节点才能验"错误态不画勾圈图标"这条产物特征。
     提示住在 `NoticeViewport` 的门户里（门户进浮层容器），所以走
     `overlayView(calls, 'NoticeViewport')` —— 等价于 React 渲染那个内容组件。 */
  const toastsAfterError = findNodes(overlayView(calls, 'NoticeViewport'), (props) => props.role === 'alert')
  assert.equal(toastsAfterError.length, 1, '提示必须由自写 Toast 渲染（不再 require 官方包）')
  assert.match(String(toastsAfterError[0].type), /^(span|div)$/,
    'Toast 的根是原生元素（控件内部 portal 到 body）')
  /* 类名形状与真库一致：CSS Modules 给字符串、`clsx(...)` 可能给数组 —— 按"类名列表成员"断言。 */
  const errorClasses = classList(toastsAfterError[0].props.className)
  assert.equal(errorClasses.some((name) => String(name).includes('dtsToast')), true,
    '根节点必须带控件自己的 Toast 类（dts 前缀，不借官方类名）')
  assert.equal(toastsAfterError[0].props.role, 'alert', 'Toast 的产物根必须是 role="alert"（官方契约）')
  assert.equal(errorClasses.some((name) => String(name).includes('IconSuccess')), false,
    "错误态省略 tone：不渲染 success 图标座（'error' 是契约外值，传了连座都空）")
  assert.equal(toastsAfterError[0].props.style['--dsh-toast-hold'], '4200ms',
    '错误态 = 4200ms 保持 + 1s 淡出（官方 holdMs 契约）')

  face.env.notify('好了', 'ok')
  await tick(0)
  /* 控件元素层的断言：渲染到 `Toast` 为止（`stopAt`），拿到的就是交给控件的 props。 */
  const toastsAfterOk = findControls(overlayView(calls, 'NoticeViewport', stopAt('Toast')), 'Toast')
  assert.equal(toastsAfterOk.length, 2, '两条提示各自成一条（不互相覆盖）')
  assert.equal(toastsAfterOk[1].props.tone, 'success')
  assert.equal(toastsAfterOk[0].props.tone, undefined, '错误态省略 tone（不给 success 图标座）')
  assert.equal(toastsAfterOk[0].props.holdMs, 4200, '错误态 holdMs 对齐改造前的 5.2s 停留（4.2s + 1s 淡出）')
  assert.equal(toastsAfterOk[1].props.holdMs, undefined, '成功态走控件默认档')
  /* ⛔ 反向哨：提示不再有"命令式造一个 body 子节点"的宿主。 */
  assert.equal(loaded.dom.doc.body.children.some((el) => el.id === 'dts-toast-host'), false,
    'document.body 下不许有 dts-toast-host（阶段 E：该处 body 写入已删）')
  assert.equal(loaded.dom.doc.body.children.some((el) => el.id === 'dts-notice'), false,
    'document.body 下不许有 dts-notice（阶段 E：自绘提示条已删）')
})

it('回归锁 · Input/Button 契约适配的两件皮肤在样式表里（wrapper 布局 + danger 上色）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-input-flex', 'flex'), '1', '控件 Input 的布局 style 要有 wrapper 接盘')
  assert.match(declOf(parsed, '.dts-btn-danger', 'color'), /state-error/, '自写 Button 的 variant 表里没有 danger，自家上色')
})

it('回归锁 · 按钮不折行不被 flex 压缩，字号与自绘统一（「保存当前方案」折行溢出）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  for (const selector of ['.dts-page button', '.dts-page .dts-btn']) {
    assert.equal(declOf(parsed, selector, 'white-space'), 'nowrap',
      '官方 .button 没有 white-space，flex 行一挤就折行堆叠 —— 必须单行完整显示')
    assert.equal(declOf(parsed, selector, 'flex'), 'none')
  }
  assert.equal(declOf(parsed, '.dts-page button', 'font-size'), '13px',
    '按钮字号统一到官方 13px 档（12.5px 不在官方阶上；自绘 .dts-btn 同步改 13px）')
})

it('回归锁 · 玻璃重铸对比自愈：白字主题下表面翻成深玻璃（「都看不清」实测）', () => {
  const { composeGlass } = loadBundle().exports.__internals
  const probeWhiteFg = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '#ffffff') }
  const doc = { glass: { enabled: true, alpha: 0.5 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(['--dsw-alias-bg-layer-1'], doc, probeWhiteFg, {})
  assert.equal(out['--dsw-alias-bg-layer-1'].light, 'transparent',
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
  assert.equal(out['--dsw-alias-button-floating-hover'].light, 'transparent',
    'hover 小色块翻深且浓度拉到可读档，不随 0.15 薄玻璃走')
  assert.equal(out['--dsw-alias-markdown-tag'].light, 'transparent',
    '活动页签小色块同理，白字才读得清')
  assert.equal(out['--dsw-alias-bg-layer-1'].light, 'transparent',
    '普通大表面照常跟随用户的面板透明度')
})

it('回归锁 · input 令牌重铸为毛玻璃色 + placeholder 提实（busy 态白板回归锁）', () => {
  const { composeGlass, fixTextFamily } = loadBundle().exports.__internals
  const probe = { of: (name) => (name === '--dsw-alias-label-primary' ? '#ffffff' : '#f1f3f5') }
  const doc = { glass: { enabled: true, alpha: 0.15 }, backdrop: { mode: 'image' }, palette: { tokens: {} } }
  const out = composeGlass(['--dsw-specific-input-major', '--dsw-specific-sidebar-fill'], doc, probe, {})
  assert.equal(out['--dsw-specific-input-major'].light, 'transparent',
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
  assert.equal(out['--dsw-specific-input-major'].light, 'transparent',
    'input 族与普通表面同档重铸为深玻璃色（翻深自愈），杜绝 busy 态裸奔白板')
  assert.ok(out['--dsw-specific-sidebar-fill'], '侧栏照常玻璃化，壁纸透出不受影响')
})

it('★ 宿主徽章 / 反相 chip / 原生下拉的材质改写（本轮恢复）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  /* ★ 本轮恢复三条被阶段 D 删掉的材质改写（副本原文 + 原始取证依据）：
       · `[class*="buildVersion"]`（SidebarRoot 的徽章：拿 `--dsw-alias-label-primary`
         做底、反相色写字 → 白字主题下就是 logo 下那块纯白小斑；`label-primary`
         是文字主色、**不能**玻璃化，所以只能单独给徽章换成已玻璃化的按钮面）；
       · `[class*="_tag_"][data-tone="solid"]`（AgentPresetSeat 的反相实底 chip：
         白字主题下 = 纯白 chip + 半透明深字，又刺眼又看不清）——
         ⚠️ 这里**不能用** GLASS_FILL：零色化后它是 transparent，chip 就是
         "白字浮在透明底上"，遇到亮壁纸直接读不出字。小色块是**压字**的实底件。
       · `select` / `select option`（原生下拉弹层：系统 UI，令牌与 backdrop-filter
         都够不着，只能用不透明深色 + color-scheme 兜）。
     这几条与"宿主表面要磨砂"是同一批诉求的两面：能走令牌的走令牌，
     令牌表达不了的（反相实底、系统弹层外观）只能就地补 —— 删掉就是主人说的
     "原本的设定缺失"。 */
  assert.equal(declOf(parsed, '[class*="buildVersion"]', 'background'),
    'var(--dsw-alias-button-elevated-fill,rgba(16,20,24,.15))!important',
    '徽章底色必须换成已玻璃化的按钮面（徽章原底是文字主色，不能玻璃化）')
  const chip = parsed.rule('body.dts-on [class*="_tag_"][data-tone="solid"]')
  assert.ok(chip !== undefined, '反相实底 chip 的实底改写必须回来')
  assert.match(chip.get('background'), /^var\(--dsw-alias-button-elevated-fill/,
    'chip 是压字的实底件，必须走已玻璃化的实底令牌')
  assert.equal(chip.get('backdrop-filter'), GLASS_BLUR_EXPECT, 'chip 也带糊（零色口径下糊是唯一可读性机制）')
  assert.equal(declOf(parsed, 'select', 'color-scheme'), 'dark')
  assert.equal(declOf(parsed, 'select option', 'background'), '#16181d')
  assert.equal(declOf(parsed, 'select option:hover', 'background'), '#263148')
  assert.equal(declOf(parsed, 'select option:checked', 'background'), 'var(--dsw-alias-brand-primary)')
  // 令牌层照旧承担大头：按钮族填充仍在玻璃清单里。
  assert.ok(GLASS_SURFACES.includes('--dsw-alias-button-elevated-fill'),
    '普通按钮底色必须仍在玻璃清单里（宿主组件靠它跟着变）')
})

it('回归锁 · 次级文字对比自愈（宿主卡片材质改写本轮已恢复）', () => {
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
  // 漏网暗字：primary-dimmed / primary-bluish 基准是暗色，压深玻璃底"选择才看清"实测。
  assert.equal(merged['--dsw-alias-label-primary-dimmed'].light, 'rgba(255, 255, 255, 0.88)',
    'primary-dimmed 必须进文字自愈族，否则排队消息预览是近黑字压深底')
  assert.equal(merged['--dsw-alias-label-primary-bluish'].light, 'rgba(255, 255, 255, 0.85)',
    'primary-bluish 同族漏网暗字，一并自愈')
  /* ★ 本轮恢复：卡片族的四条宿主锚点（非交接类 `_card` 读统一玻璃 / 交接卡透明 /
     `_file` 与 `_preview` 玻璃条）必须都在 —— 会话输入卡就是 `_card`，
     它是主人截图点名"要磨砂"的那个面。判据见上方「宿主表面锚点强注」那条锁。 */
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, 'body.dts-on [class$="_card"]', 'background'), GLASS_EXPECT)
  assert.equal(declOf(parsed, 'body.dts-on [class$="_card"]', 'backdrop-filter'), GLASS_BLUR_EXPECT)
  assert.equal(declOf(parsed, 'body.dts-on [class$="_file"]', 'background'), GLASS_EXPECT)
  assert.equal(declOf(parsed, 'body.dts-on [class$="_preview"]', 'background'), GLASS_EXPECT)
  // 交接卡是**透明**的（主人钦定「看得清背景壁纸」），不是玻璃。
  const handoff = parsed.rule('body.dts-on [class$="_card"]:has([class$="_path"],[class$="_counts"],[class$="_file"])')
  assert.ok(handoff !== undefined, '交接卡的 :has 特征锚必须回来（_row 太泛会误伤输入框）')
  assert.equal(handoff.get('background'), 'transparent!important')
  assert.equal(handoff.get('backdrop-filter'), 'none!important')
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

it('回归锁 · diff 语义色翻深（浮层/遮罩的宿主锚点已随阶段 D 删除）', () => {
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
  /* ★ 本轮恢复：宿主浮层/遮罩锚点（`_backdrop`/`_scrim`/`-backdrop`/`-scrim`）回来了。
     **我们自己的**浮层照旧各走官方材质（不改）：
       · 顶条菜单替身 `.dts-cmenu` → 官方 Menu 公式（半径 lg / elevation-prominent /
         `--dts-glass-fill` + `--dts-glass-blur` → `--dsw-menu-backdrop-filter`）；
       · 模态/确认框 → 控件层 `Modal`（radius-panel + bg-layer-2 + elevation-prominent）；
       · 提示 → 控件层 `Toast`（toast-bg + shadow-lv3）。 */
  const parsed = parseCss(CHROME_CSS)
  assert.equal(declOf(parsed, '.dts-cmenu', 'backdrop-filter'), GLASS_BLUR_EXPECT,
    '自家菜单读统一玻璃模糊（含官方令牌兜底链）')
  assert.equal(declOf(parsed, '.dts-cmenu', 'border-radius'), 'var(--dsw-radius-lg)',
    '官方 MenuSurface 默认档半径')
  for (const back of ['body.dts-on [class$="_backdrop"] > *', 'body.dts-on [class$="-scrim"] > *',
    'body.dts-on [class$="_backdrop"]', 'body.dts-on [class$="-scrim"]']) {
    assert.ok(parsed.rule(back) !== undefined, back + ' 必须恢复（遮罩族是"不当 backdrop root"的载体）')
  }
})

it('★ 宿主表面改写本轮恢复 —— 令牌层与逐面锚点两条路并存，且闸门只认 body.dts-on', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  /* ★ 本轮恢复（主人复判阶段 D 的"整族删除"为误判）。
     阶段 D 的三条判据在"主人要的宿主表面磨砂"这件事上都不成立：
       · 官方材料层只覆盖 MenuSurface/Modal（有 `.material` 或已成型的 bg 令牌），
         **覆盖不到**输入卡 / 「+」命令弹层 / hover 卡 / 引导卡 / DockKit 面板 /
         设置之上的叠加层 —— 这些面"清底了没有糊"，正是主人截图看到的现象；
       · 令牌层（`ctx.theme.overrideTokens`）继续承担**能表达**的那部分（本轮未回退）；
       · "猜类名会误伤"是真的（chat 的 `.entry`、`.dsh-agent-dialog` 确认框都实测误伤过），
         所以恢复时**保留了那几轮补丁**（祖先闸 / 特征锚 / 特异性稳压），见 chrome.ts 注释。
     结论：两条路**并存** —— 令牌层管能表达的，逐面锚点管表达不了的。
     ⚠️ 但下面这条仍然要守住：宿主材质改写（≈79 条）**必须全部挂 `body.dts-on` 闸**
     （= 有背景），否则"没开任何背景时宿主照样被强制半透明 + 模糊 + !important"，
     浅色模式深色染底、每个弹窗被抹透，全都发生在插件根本没启用的场景里。 */
  const hostRewrites = [
    'body.dts-on [data-composer-stats]', 'body.dts-on [role="dialog"]',
    'body.dts-on .lc-root .lc-card', 'body.dts-on .dsh-agent-dialog',
    'body.dts-on [class$="_file"]', 'body.dts-on [class$="_card"]',
    'body.dts-on [class$="_preview"]', 'body.dts-on [class*="_tag_"][data-tone="solid"]',
    '[class*="buildVersion"]', 'select', 'select option',
  ]
  const missing = hostRewrites.filter((selector) => parsed.rule(selector) === undefined)
  assert.deepEqual(missing, [], '这些宿主表面改写必须恢复：' + missing.join(' | '))
  // 令牌重铸照旧（两条路并存，不是二选一）。
  assert.ok(GLASS_SURFACES.length >= 20, '玻璃表面清单必须仍在')
  assert.ok(GLASS_SURFACES.includes('--dsw-alias-bg-layer-2'), '层阶令牌必须仍在清单里')
  /* ★ dts-on 闸的守门：闸下的宿主规则只许是**我们认得的宿主表面锚点**，
     不许出现"只作用于宿主、且没有闸"的新条目（那才是"没启用也改别人外观"）。
     自家面 + `#root` 承重墙照旧在闸下。 */
  const gated = parsed.find(() => true).filter((entry) => entry.selector.indexOf('body.dts-on ') === 0)
  assert.ok(gated.length >= 1, 'dts-on 闸下必须有规则')
  /* ① `[aria-haspopup]` / `[aria-expanded]` / `[aria-pressed]` 与 `[role=]` 同类：
     **无障碍语义属性**锚点，不是"猜宿主类名" —— 官方组件按规范稳定输出它们
     （官方 Button 的 `aria-haspopup="menu"`、`aria-expanded={open}` 都是 JSX 里逐字写的）。
     ② `[data-windows-menu]` / `[data-menu-material]` 是**官方 preload/JSX 写死的 data 钩子**
     （主人第二十四轮从 DevTools 实测抓到，本插件 `caption-menu.ts` 也用同一个钩子），
     与 `data-dockkit`/`data-sidebar-right` 同类；而同一张截图里的
     `_surface_ri079_1` / `_list_gzo7u_7` 是**带模块盐**的类名，锚不住。 */
  const hostAnchor = /\[(class[$*~]?=|data-(dockkit|sidebar-right|composer-stats|placeholder|windows-menu|menu-material)|aria-(haspopup|expanded|pressed)|clip-path)|\[role=|:has\(|\.dsh-agent|\.lc-/
  for (const entry of gated) {
    const own = /^body\.dts-on (\.dts-|#root|:is\(\[role=)/.test(entry.selector)
    assert.ok(own || hostAnchor.test(entry.selector),
      'dts-on 闸下出现了既非自家类、也非已知宿主表面锚点的选择器：' + entry.selector)
  }
  /* 反例：宿主材质改写**一条都不许**脱离 dts-on 闸。
     记录在案的两处例外（都在 chrome.ts 写明理由）：
       · hover 卡 `body > :has([class*="hoverTime"])` / `[class*="_card_"][class*="_copyable_"]`
         —— 可读性与壁纸开没开无关，且 `dts-on` 可能因首屏时序缺席，能不赌就不赌；
       · `[class*="buildVersion"]`（构建版本徽章）—— 它换的是"文字主色做底"的纯白小斑，
         在任何主题下都是刺眼的错色，与壁纸是否开启无关；副本原文即无闸。 */
  const ungated = parsed.find(() => true)
    /* 自家类（`.dts-`）**不算**"宿主材质改写"：`aria-pressed` 这类语义锚点同样会命中
       我们自己的 Pill/Swatch（`.dts-pill[aria-pressed="true"]`），不排除它们就会
       把自家控件误报成"脱闸改宿主"。这条锁要盯的是**宿主**表面。 */
    .filter((entry) => entry.selector.indexOf('.dts-') === -1)
    .filter((entry) => hostAnchor.test(entry.selector))
    .filter((entry) => entry.selector.indexOf('body.dts-on') !== 0)
    .map((entry) => entry.selector)
    .sort()
  assert.deepEqual(ungated, ['[class*="_card_"][class*="_copyable_"]', '[class*="buildVersion"]',
    'body > :has([class*="hoverTime"])'],
    '宿主材质改写只许有这三处记录在案的例外，实际脱离闸门的：' + ungated.join(' | '))
})

it('回归锁 · 插件自家输入面跟玻璃走（文本框与下拉触发器，锚 ARIA 契约）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  // 少量大件保真模糊：高级页文本域 + 面板里的下拉触发器（自写 Select）。
  for (const selector of ['body.dts-on .dts-textarea',
    'body.dts-on .dts-page button[aria-haspopup="listbox"]']) {
    assert.equal(declOf(parsed, selector, 'background'), GLASS_EXPECT)
    assert.equal(declOf(parsed, selector, 'backdrop-filter'), GLASS_BLUR_EXPECT)
  }
  // ⚠️ 下拉触发器的锚点是**自家面板子树 + ARIA 契约**，不是 module 类名后缀 ——
  // 阶段 C/D 的机械判据要求 `class$=`/`class*=` 归零，ARIA 契约同样稳定且不吃构建盐。
  assert.equal(CHROME_CSS.indexOf('dtsSelectTrigger'), -1, '不许按 module 类名后缀锚定')
  // 无壁纸时保持宿主输入面；且不许重铸全局 input-major（会话输入框钦定不透明，
  // 它与本面板控件是同一令牌的两个消费面，必须分离）。
  assert.equal(declOf(parsed, '.dts-textarea', 'background'), 'var(--dsw-specific-input-major)')
  assert.ok(!GLASS_SURFACES.includes('--dsw-specific-input-major'), '全局 input-major 不进玻璃清单')
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

it('回归锁 · 胶囊/正圆必须配 corner-shape: round（官方 Pill/Switch/Tag/StateDot 同构）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  /* 官方那批 `.module.css` 里，凡是 `border-radius:999px` / `50%` 的规则都紧跟一条
     `corner-shape:round`（_official\dsh-client-ui-primitives\lib：
     Pill.module.css:11-12、Switch.module.css:14-16 与 :38-40、Tag.module.css:11-12、
     StateDot.module.css:16-17 与 :107-108、ImageLightbox.module.css:40）。
     缺了它，宿主自己的 `--dsw-corner-shape`（本插件默认重铸成 superellipse(1.5)）
     会把胶囊/正圆一起掰成圆角矩形 —— 形状就不再等于官方几何。
     机械判据（不枚举选择器）：CHROME_CSS 里每条 border-radius 恰为 999px/50% 的规则
     都必须带 corner-shape:round。 */
  const pills = parsed.find(() => true)
    .filter(({ decls }) => /^(999px|50%)$/.test(String(decls.get('border-radius') ?? '')))
  assert.ok(pills.length >= 5, `胶囊/正圆至少 5 处（实测 7 处），实际 ${pills.length}`)
  for (const { selector, decls } of pills) {
    assert.equal(decls.get('corner-shape'), 'round',
      `${selector} 是胶囊/正圆，必须配 corner-shape:round（官方同族写法）`)
  }
  // 点名（07 报告 §六 #10 的五处 + 两处同类圆点/准星）。`.dts-badge` 已随自造徽章
  // 一起删除（对比度等级改走控件层 `Tag`，它的 corner-shape 在 Tag.module.css 里）。
  for (const selector of ['.dts-switch', '.dts-switch::after', '.dts-pill',
    '.dts-profile-dot', '.dts-dot', '.dts-focus::after']) {
    assert.equal(declOf(parsed, selector, 'corner-shape'), 'round', `${selector} 必须带 corner-shape:round`)
  }
  // 控件层的胶囊/正圆同样要带（Tag / Pill / Switch / StateDot 都是官方同族写法）。
  const tagCss = controlCss('dtsTag')
  assert.ok(tagCss.length > 0, '应能在产物里找到 Tag 控件的 CSS 模块')
  const tagDecls = scopedDecls(tagCss, 'dtsTag')
  assert.ok(tagDecls !== undefined, 'Tag 控件应有根规则')
  assert.equal(tagDecls.get('border-radius'), '999px', 'Tag 是胶囊')
  assert.equal(tagDecls.get('corner-shape'), 'round', 'Tag 胶囊必须配 corner-shape:round')
})

it('回归锁 · 合成成本红线：backdrop-filter 只许挂白名单（自家大件 + 低实例宿主面）', () => {
  const { CHROME_CSS } = loadBundle().exports.__internals
  const parsed = parseCss(CHROME_CSS)
  /* 自家三处真玻璃面：全是"单屏个位数实例"的大件/弹层。 */
  const ALLOW = [/^\.dts-cmenu/, /^\.dts-cmenu-toast/, /^body\.dts-on \.dts-textarea/,
    /^body\.dts-on \.dts-page button\[aria-haspopup="listbox"\]/]
  /* ★ 本轮恢复的宿主表面锚点：逐条都是"单屏个位数实例"（输入卡 1–2、统计条 1、
     用量表 1、hover 卡 1、加载浮标 1、引导卡 4、停靠面板 1–2、浮层/对话框 1、
     文件行与预览各若干但都是卡片内的行）—— 不属于"密集复用"。
     ⚠️ 判断标准不是"自家还是宿主"，而是**单屏实例数**：这条红线当年是因为
     色彩页 token 行 **98 个**输入框逐个挂 blur 才立的（闪屏/渲染撕裂/丢失交互实测）。
     所以下面仍然硬禁密集类，并且密集小输入改走 `--dts-glass-fill-thin`（半透明薄底、零合成成本）。 */
  const HOST_ALLOW = [
    'body.dts-on [data-composer-stats]',
    'body.dts-on span[class$="_root"]:has(button[class$="_trigger"][aria-haspopup="dialog"])',
    'body.dts-on [class$="_card"]', 'body.dts-on [class*="_card "]',
    'body.dts-on [class$="_card"]:has([class*="search"])',
    'body.dts-on [class$="_card"]:has([data-placeholder])::before',
    'body.dts-on [class*="_card "]:has([data-placeholder])::before',
    'body.dts-on [class$="_file"]', 'body.dts-on [class$="_preview"]',
    'body.dts-on [class$="_panel"]:has([data-sidebar-right-mode="push"]) [class$="_entry"]',
    'body.dts-on [class$="_panel"]:has([data-sidebar-right-mode="push"]) [class*="_entry "]',
    'body.dts-on [data-sidebar-right-panel]:not([data-sidebar-right-panel="push"]) [class$="_entry"]',
    'body.dts-on [data-sidebar-right-panel]:not([data-sidebar-right-panel="push"]) [class*="_entry "]',
    'body.dts-on [class$="_loadingFloat"]',
    'body.dts-on [data-dockkit-pane]', 'body.dts-on [data-dockkit-float]',
    'body.dts-on .lc-root .lc-card', 'body.dts-on .lc-modal-card',
    'body.dts-on [class$="_overlay"]:has(> [class$="_mask"]) > [class$="_panel"]',
    'body.dts-on [class$="_overlay"]:has(> [class$="_mask"]) > [class$="_panel"] :is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"],[class$="_dialog"],[class$="_menu"],[class$="_popover"],[class$="_popup"],[class$="_tooltip"],[class$="_dropdown"],[class$="_sheet"])',
    'body.dts-on :is([role="tooltip"],[role="menu"],[role="listbox"],[role="alertdialog"],[class$="_tooltip"],[class$="_popover"],[class$="_dropdown"],[class$="_popup"])',
    'body.dts-on [role="dialog"]', 'body.dts-on [role="alertdialog"]',
    'body.dts-on .dsh-agent-dialog', 'body.dts-on .dsh-agent-modal-card',
    'body.dts-on [class*="_tag_"][data-tone="solid"]',
    'body.dts-on [class$="_backdrop"] > *', 'body.dts-on [class$="_scrim"] > *',
    'body.dts-on [class$="-backdrop"] > *', 'body.dts-on [class$="-scrim"] > *',
    'body > :has([class*="hoverTime"])', '[class*="_card_"][class*="_copyable_"]',
  ]
  // 密集复用类（token 行输入 49×2、按钮、色卡、建议弹层行）：单屏几十个实例，
  // 挂 backdrop-filter = 合成层爆炸（色彩页闪屏、渲染撕裂、丢失交互实测）。
  const DENY = [/\.dts-suggest-row/, /\.dts-btn(?![a-z-])/, /\.dts-swatch/, /\.dts-pill/,
    /\.dts-switch/, /\.dts-dot/, /\.dts-card(?![a-z-])/, /\.dts-thumb/, /\.dts-input-flex/]
  let blurRules = 0
  for (const { selector, decls } of parsed.find(() => true)) {
    const bf = decls.get('backdrop-filter')
    if (!bf || bf === 'none' || bf === 'none!important') continue
    blurRules += 1
    for (const deny of DENY) {
      assert.ok(!deny.test(selector), '密集复用类禁挂 backdrop-filter：' + selector)
    }
    assert.ok(ALLOW.some((allow) => allow.test(selector)) || HOST_ALLOW.includes(selector),
      'backdrop-filter 出现在白名单外（先问：这个类单屏有几个实例？）：' + selector)
  }
  assert.ok(blurRules >= 6, '玻璃面不该被整体误删，实际 ' + blurRules)
  // 无糊的密集小输入必须走**薄底令牌**而不是 transparent（透明+无糊=控件消失）。
  assert.equal(declOf(parsed, 'body.dts-on .dts-input-flex>*', 'background'),
    'var(--dts-glass-fill-thin,rgba(16,20,24,.28))!important',
    '密集小输入走 --dts-glass-fill-thin（半透明薄底，零合成成本），不许跟 GLASS_FILL 走')
  assert.equal(declOf(parsed, 'body.dts-on .dts-input-flex>*', 'backdrop-filter'), undefined,
    '密集小输入不许挂 blur（98 个实例实测闪屏）')
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
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(80)
  mountOverlay(calls, loaded.dom.doc)
  const layer = loaded.dom.byId.get('dts-backdrop')
  assert.ok(layer, '背景层应存在（退回 CSS 层）')
  const tags = layer.children.map((child) => child.tagName)
  assert.ok(!tags.includes('VIDEO'),
    '原型键取出的伪 meta 曾让背景层挂上 /media/undefined 的死视频')
})

it('回归锁 · 编辑撞 409 明确告知「这次没保存」，不再静默吞掉（第四轮）', async () => {
  const loaded = loadBundle({ boot: { writeToken: 'tok-123' } })
  let puts = 0
  loaded.sandbox.fetch = async (url, init) => {
    const method = String((init && init.method) || 'GET').toUpperCase()
    if (method !== 'PUT') return { ok: true, status: 200, json: async () => ({ ok: true, value: PROJECTION }) }
    puts += 1
    return {
      ok: false, status: 409,
      json: async () => ({ ok: false, error: { message: 'revision 冲突：别的标签页已经先改过了', status: 409 } }),
    }
  }
  const { ctx, calls } = makeCtx({ entries: true })
  loaded.exports.apply(ctx)
  await tick(60)
  mountOverlay(calls, loaded.dom.doc)
  const { face } = panelHandle(calls)
  face.env.patch(function (d) { d.base.fontSize = 15 })
  await tick(500)
  assert.ok(puts >= 1, '编辑必须真的提交过一次')
  /* 提示住在 `NoticeViewport` 的门户里 —— 渲染到 `Toast` 为止，拿到的就是交给控件的 props。 */
  const toasts = findControls(overlayView(calls, 'NoticeViewport', stopAt('Toast')), 'Toast')
  assert.equal(toasts.length, 1, '409 必须弹提示，不能只在状态栏闪一下')
  assert.match(toasts[0].props.text, /没有保存/,
    '文案必须直说"这次没保存" —— 状态栏那句 409 消息会被紧随其后的 reload 冲掉')
  assert.equal(toasts[0].props.tone, undefined,
    '冲突必须走**错误态**（省略 tone）：不给 success 图标座、红字警示座')
  assert.equal(toasts[0].props.holdMs, 4200, '错误提示停留 4.2s + 1s 淡出（不被后续 reload 冲掉）')
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
  /* ⚠️ 子节点按**真库形状**取：`uiButton({children: …})` 内部是
     `e(Button, {…}, 文案)`，真库把单子节点归一成**字符串**（不是数组），
     所以 `node.children[0]` 会拿到 `'保'` —— 必须经 `childNodes()` 拉平。
     断言强度不变：仍然要求这个按钮的**首个子节点就是那句本地化文案**。 */
  const labelled = (node) => childNodes(node)[0] === face.t('profile.saveNew')
  const saveBtn = tree.find((node) => node.type === 'button' && labelled(node))
    ?? tree.find((node) => isControl('Button')(node) && labelled(node))
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

/* ==================================================================== */
/* 客户端 UI 交互契约批次（第四轮审计的 11 条发现，逐条钉住）              */
/* ==================================================================== */

it('★ Select 契约：Tab/Enter/Space 与鼠标点击都必须把焦点交还触发器（控件层）', () => {
  // 根因（自绘 Choice 时代起就成立，现在由控件层继承）：被激活的 option 随弹层卸载会从
  // DOM 消失，焦点不落触发器就掉 <body>，键盘用户的 Tab 链在此断裂。
  // 本轮自绘 Choice（约 190 行）已整段删除，能力搬进 controls/Select.ts —— 锁因此改判
  // **控件层源码**：三条收起点必须都经 `close(...)` / 显式 `focusWithoutRing(trigger)`。
  const src = readFileSync(join(here, '..', 'src', 'client', 'controls', 'Select.ts'), 'utf8')
  assert.match(src, /function close\(refocus\?: boolean\)/,
    'Select 必须有统一的收起点（决定焦点去向），否则无法交还焦点')
  assert.match(src, /focusWithoutRing\(trigger\)/,
    '收起点内部必须有焦点归还的落地路径（官方 focusWithoutRing，不画焦点环）')
  // 三条路径：Esc / Tab / 鼠标点击。
  assert.match(src, /if \(event\.key === 'Escape' && !event\.shiftKey\)[\s\S]{0,160}close\(true\)/,
    'Esc 必须关闭并把焦点交还触发器')
  assert.match(src, /if \(insideList\) \{\s*event\.preventDefault\(\);[\s\S]{0,240}close\(true\)/,
    'Tab 必须 preventDefault（取了焦点所有权就不能留着浏览器默认移动）并交还聚焦行/触发器')
  assert.match(src, /onClick: function \(\) \{[\s\S]{0,420}focusWithoutRing\(trigger\)/,
    '鼠标点击同样回焦触发器：被点的 option 会随弹层卸载，焦点不落触发器就掉 <body>')
})

it('★ Select 弹层必须有高度上限与视口钳制（选项一多就够不着）', () => {
  const selectCss = controlCss('dtsSelectList')
  assert.ok(selectCss.length > 0, '应能在产物里找到 Select 控件的 CSS 模块')
  const listDecls = scopedDecls(selectCss, 'dtsSelectList')
  assert.ok(listDecls !== undefined, 'Select 应有列表规则')
  assert.equal(squeeze(listDecls.get('max-height')),
    squeeze('calc(100vh - 12px - max(12px, var(--dsh-frame-top-clearance, 12px)))'),
    '弹层高度上限必须按视口净空算（含 macOS 红绿灯顶边净空）')
  const viewport = scopedDecls(selectCss, 'dtsSelectViewport')
  assert.ok(viewport !== undefined, 'Select 应有滚动视口规则')
  assert.equal(viewport.get('overflow-y'), 'auto', '有上限就必须能滚')
  assert.equal(viewport.get('min-height'), '0',
    '滚动区必须 min-height:0 —— 否则 flex 子项的默认 min-height:auto 会撑破卡片、滚不动')
  // 滚动到底不许把滚动链传给宿主页面：自家的建议弹层钉这条（Select 控件侧由
  // 高度上限 + 视口可滚承担，控件层不含 overscroll 声明）。
  const chromeCss = loadBundle().exports.__internals.CHROME_CSS
  assert.equal(declOf(parseCss(chromeCss), '.dts-suggest', 'overscroll-behavior'), 'contain',
    '浮层滚动区必须 overscroll-behavior:contain（滚到底不把滚动链传给宿主面板）')
  // 定位不再靠"向上翻转"的 CSS 钩子，而是控件层的 useAnchoredPosition 把 fixed 面板
  // 钳进视口（portal 到 body）—— 纯 CSS 做不到，官方 Menu 走同一条路。
  const src = readFileSync(join(here, '..', 'src', 'client', 'controls', 'Select.ts'), 'utf8')
  assert.match(src, /useAnchoredPosition\(\{/, 'Select 必须用锚点定位钩子（官方 useAnchoredPosition）')
  assert.match(src, /createPortal\(list, document\.body\)/,
    'portal 到 body：面板在可滚动容器里，就地列表会被祖先 overflow 裁掉')
})

it('顶条「编辑」替身：键盘可达 + 索引硬化（不许再有 children[0]/[1] 硬编码）', () => {
  const src = readFileSync(join(here, '..', 'src', 'client', 'caption-menu.ts'), 'utf8')

  // ① 索引硬化：宿主在菜单条里插一个元素就会整体错位，而错位的后果是
  //    对「应用」preventDefault —— 直接违反本文件开头那条边界。
  //    断言的是**可执行代码**里不许出现该成员访问；注释里提到旧写法是文档，放行。
  const codeLines = src.split('\n').filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
  const code = codeLines.join('\n')
  assert.ok(!/bar\.children\s*\[/.test(code),
    '不许再用 bar.children[N] 定位：宿主改结构就会误拦「应用」，导致关于/退出点不开')
  assert.match(src, /querySelectorAll\('\[role="menuitem"\]\[aria-haspopup="menu"\]'\)/,
    '应按 role + aria-haspopup 取全集定位（preload 只给那两个按钮挂该 role）')
  assert.match(src, /items\.length !== 2[\s\S]{0,80}return null/,
    '候选数不是恰好 2 个就整体放弃拦截 —— 宁可不磨砂，也不能拦错')

  // ② 键盘可达：role="menu" 声明了就必须有项间移动。
  assert.match(src, /event\.key === 'ArrowDown'/, '面板内必须有 ↓ 项间移动')
  assert.match(src, /event\.key === 'ArrowUp'/, '面板内必须有 ↑ 项间移动')
  assert.match(src, /event\.key === 'Home'/, '面板内必须有 Home')
  assert.match(src, /event\.key === 'End'/, '面板内必须有 End')
  assert.match(src, /event\.key === 'Enter'/, '面板内必须有 Enter 执行')
  assert.ok(!/try \{ root\.focus\(/.test(src),
    '焦点必须落在**第一项**而不是 tabIndex=-1 的容器：落容器时按 Enter 什么都不发生')
})

it('编辑命令失败必须可见反馈，不许静默 swallow', () => {
  const src = readFileSync(join(here, '..', 'src', 'client', 'caption-menu.ts'), 'utf8')
  assert.match(src, /function runEditCommand\(cmd: string, saved: ReturnType<typeof rememberEditor>\): boolean/,
    'runEditCommand 必须返回成败 —— 否则调用方无从判断，失败就是静默')
  assert.match(src, /aria-live/, '提示节点必须有 aria-live，读屏才拿得到')
  assert.match(src, /role', 'status'\)/, '提示节点必须有 role=status')
  // paste 回退的两条自检缺一就会"静默无效"
  assert.match(src, /const editable =[\s\S]{0,260}isContentEditable/,
    'paste 回退前必须确认焦点真的可编辑：目标落到 <body> 时粘贴必然无效')
  assert.match(src, /return accepted === false/,
    'dispatchEvent 的返回值必须被使用：false（被 preventDefault）才算这次回退生效')
})

it('失败提示条的定时器必须收进 disposer（不许裸挂 setTimeout）', () => {
  const src = readFileSync(join(here, '..', 'src', 'client', 'caption-menu.ts'), 'utf8')
  /* references_ui-plugin.md:13：定时器要在 `apply` 里用 `ctx.effect` 登记并返回清理函数。
     提示条原先裸挂 `window.setTimeout(() => { node.remove() }, 2400)` —— 定时器句柄
     谁也不认识：不泄漏（2.4s 自清），但**不受卸载控制**（卸载后那 2.4s 内仍有一条
     `dts-cmenu-toast` 留在 body 上），且连点两次失败会叠两个定时器。 */
  assert.match(src, /let toastTimer = 0/, '定时器句柄必须是组件状态（否则 disposer 停不掉它）')
  assert.match(src, /toastTimer = window\.setTimeout\(/,
    '定时器必须存住句柄：裸 window.setTimeout(...) 的返回值没人认识')
  assert.ok(!/window\.setTimeout\(\(\)\s*=>\s*\{\s*node\.remove\(\)\s*\}/.test(src),
    '旧的裸定时器写法必须已删')
  const tail = src.slice(src.indexOf('const notify ='))
  assert.match(tail, /hideToast\(\)[\s\S]{0,400}toastTimer = window\.setTimeout\(/,
    'notify 必须先撤旧条再挂新条：连点两次失败只留一条提示、只留一个定时器')
  const disposer = src.slice(src.indexOf('const onDocumentPointer'))
  assert.match(disposer, /hideToast\(\)/,
    'installCaptionMenu 返回的 disposer 必须撤掉提示条并停掉定时器')
})

it('取色 Image 的 load/error 监听必须成对摘除（监听器泄漏）', () => {
  const src = readFileSync(join(here, '..', 'src', 'client', 'app.ts'), 'utf8')
  const block = src.slice(src.indexOf('function sampleFromImage'), src.indexOf('/* ---------------- 模态'))
  assert.ok(block.length > 0, '应能找到 sampleFromImage')
  assert.match(block, /removeEventListener\('load'/, 'load 监听必须被摘')
  assert.match(block, /removeEventListener\('error'/, 'error 监听必须被摘')
  assert.match(block, /var settle = function/, '摘除应收口在统一的 settle 里，两条路径都走它')
})

it('i18n 的 {n} 占位替换真的生效（曾只处理函数分支，字符串参数被静默丢弃）', () => {
  const loaded = loadBundle()
  const { t } = loaded.exports.__internals
  assert.ok(typeof t === 'function', 't 应可从 internals 取到')
  // 带占位的键：中文
  assert.equal(t('menu.noop', '撤销'), '「撤销」这次没有可以作用的内容',
    '中文占位必须被替换 —— 否则界面直接显示 {0}')
  // 参数不足时保留原占位而不是渲染 undefined
  assert.equal(t('menu.noop'), '「{0}」这次没有可以作用的内容',
    '没传参数时应保留 {0} 原样，不能渲染成 undefined')
  // 缺键回退成键名（既有契约不许退化）
  assert.equal(t('__no_such_key__', 'x'), '__no_such_key__', '缺键回退键名这条契约不许退化')
})

it('合并导入必须真的有 UI 入口（宿主与 api 早就实现，此前只差按钮）', () => {
  const src = readFileSync(join(here, '..', 'src', 'client', 'tabs.ts'), 'utf8')
  assert.match(src, /importDoc\(JSON\.parse\(text\), merge \? 'merge' : ''\)/,
    'importDoc 的第二参必须由 UI 决定：否则 merge 分支永远走不到，属"功能有、按钮缺"')
  // 勾选框改走自写控件层的 `Checkbox`（onChange 直接给布尔，不是 event）。
  assert.match(src, /e\(Checkbox, \{[\s\S]{0,400}checked: merge[\s\S]{0,400}setMerge\(next\)/,
    '必须有可切换的「合并导入」勾选框（控件层 Checkbox 契约：onChange 直接给布尔）')
  // 双语键都要在
  const i18n = readFileSync(join(here, '..', 'src', 'client', 'i18n.ts'), 'utf8')
  const zh = (i18n.match(/'adv\.merge'/g) ?? []).length
  assert.equal(zh, 2, `adv.merge 必须中英各一条，实际 ${zh} 条`)
  assert.equal((i18n.match(/'adv\.mergeHint'/g) ?? []).length, 2, 'adv.mergeHint 必须中英各一条')
})









/* ═══════════════════════════════════════════════════════════════════════════
   ★★★ 三条「棘轮」约束（第三十二轮补，主人批准的第一梯队）
   棘轮 = 只许往好的方向走：把**当前实测值**钉住，将来恶化就红。
   为什么需要：这个项目最大的风险是**静默失效**（不报错、不白屏，只是某条规则没生效），
   而静默失效常来自"载体继续恶化"与"两处机制各写一半"。棘轮不改善现状，但它让现状**不再退步**。
   ⚠️ 本文件是 ESM：没有 require / __dirname，取路径一律 await import + import.meta.url。
   ═══════════════════════════════════════════════════════════════════════════ */

const RATCHET_ROOT = new URL('../', import.meta.url)

it('★ 棘轮①：CHROME_CSS 的规则数不得增长（新增规则请写进 controls/*.module.css）', async () => {
  /* 基准 179 → 180（第三十四轮）：新增一条「宿主侧 disabled 按钮可读性」
     （官方 disabled = 浅底 + 深字 + 整块 opacity .4，在壁纸上会化掉 ⇒ 改成深色实底 + 亮字）。
     ⚠️ 口径提醒：本棘轮统计的是 CHROME_CSS 的全部规则数，把两类混在一起了 ——
       (a) 必须住在这里的宿主锚点规则（进 .module.css 会被作用域化成哈希类名而失效）
       (b) 本该搬进 .module.css 的自绘类规则
     将来可改成只统计 (b)。 */
  /* 基准 178 → 179（第三十三轮）：唯一一次放行，用来把 `--dts-glass-blur` 的声明从 `:root`
     挪到 `body` —— 挂在 :root 上会让它在求值时吃 fallback，导致全页 15 个 backdrop-filter 元素
     的模糊与「面板模糊/面板饱和」滑块脱钩（详见 chrome.ts 里那条 ★★★ 注释）。 */
  const fsx = await import('node:fs')
  const src = fsx.readFileSync(new URL('src/client/chrome.ts', RATCHET_ROOT), 'utf8')
  const a = src.indexOf('CHROME_CSS = [')
  const b = src.indexOf('].join(', a)
  const frags = [...src.slice(a, b).matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1])
  const count = (frags.join('\n').match(/\{/g) || []).length
  assert.ok(
    count <= 180,
    'CHROME_CSS 规则数从 180 涨到了 ' + count +
    ' —— 新增规则请写进 src/client/controls/*.module.css。这个 TS 字符串数组没有语法高亮、' +
    '没有 lint、选择器非法也不报错，已经因此静默失效过两次。',
  )
})

it('★ 棘轮②：控件层焦点环覆盖率（除 4 个纯展示控件外都必须有 :focus-visible）', async () => {
  const fsx = await import('node:fs')
  const cd = new URL('src/client/controls/', RATCHET_ROOT)
  /* 体检确认这 4 个不含可聚焦元素（纯展示/纯封装），故豁免：
       MenuSurface 只画面 · StateDot 状态点 · Tag 只读徽章 · Tooltip 被动展示。
     另注：TextField / NumberField 的 :focus-visible 是 `outline:none` + `border-color` 变色，
     那是逐条抄官方 fields.module.css 的口径，**正确**，不要改成 outline。 */
  const exempt = ['MenuSurface', 'StateDot', 'Tag', 'Tooltip']
  const missing = fsx.readdirSync(cd)
    .filter((f) => f.endsWith('.module.css'))
    .map((f) => f.replace('.module.css', ''))
    .filter((n) => !exempt.includes(n))
    .filter((n) => !/:focus-visible/.test(fsx.readFileSync(new URL(n + '.module.css', cd), 'utf8')))
  assert.deepEqual(missing, [], '这些控件缺 :focus-visible（键盘用户 Tab 上去看不见焦点）：' + missing.join(', '))
})

it('★ 棘轮③：玻璃令牌双写必须显式登记（host ∩ client 的集合 = 已登记清单）', async () => {
  const fsx = await import('node:fs')
  const toks = (s) => new Set(s.match(/--dsw-[a-z0-9-]+/g) || [])
  const host = toks(fsx.readFileSync(new URL('lib/engine.js', RATCHET_ROOT), 'utf8'))
  const cli = toks(fsx.readFileSync(new URL('src/client/probe-glass.ts', RATCHET_ROOT), 'utf8'))
  const both = [...host].filter((x) => cli.has(x)).sort()
  /* 设计妥协（不是 bug）：host 出全量基准令牌层；client 为"玻璃面上的文字与填充"做对比自愈。
     两边都会碰到的就是下面这 6 个。**新增或删除都必须改这份清单** —— 这样"谁写哪些令牌"
     从"靠人记住"变成"改了就红"。 */
  const KNOWN = [
    '--dsw-alias-label-caption',
    '--dsw-alias-label-dimmed',
    '--dsw-alias-label-primary',
    '--dsw-alias-label-secondary',
    '--dsw-alias-label-tertiary',
    '--dsw-menu-surface-fill',
  ]
  assert.deepEqual(both, KNOWN,
    'host 与 client 都写的 --dsw-* 令牌变了。请确认是有意为之，然后更新这份登记清单。')
})
