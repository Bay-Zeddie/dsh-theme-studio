/**
 * dsh-theme-studio 主题引擎（纯函数、零依赖、只在 Host 侧运行一份）。
 *
 * 两条输出通道，各自对应宿主里一条"一定会赢"的落地路径：
 *
 *  1. buildTokenLayers() → 交给浏览器半的 ctx.theme.overrideTokens()。
 *     ui-layout 的 ThemePresenter 会把这些令牌写成 body 的 inline style，
 *     优先级高于任何选择器规则，因此 ui-theme 在 `body` / `body[data-ds-dark-theme]`
 *     上声明的基准色必然被覆盖。改颜色 / 改字体 / 改圆角 / 改动效 / 改滚动条都走这里。
 *
 *  2. buildCss() → 只管插件自己拥有的 DOM：背景层、遮罩、视频、@font-face，
 *     以及必须靠选择器或伪元素才能做到的部分（隐藏滚动条、玻璃 backdrop-filter、字距）。
 *
 * 刻意不做的事：不去覆盖组件自己 inline 声明的变量。例如 ui-conversation 用
 * --dsh-chat-user-width 控制正文宽度，那是元素级 inline，body 覆盖不赢——
 * 所以本插件不提供"正文宽度"这种会静默失效的旋钮。清单里每个开关都对应一条真实声明。
 *
 * 所有来自浏览器的输入都必须先过 normalizeDoc 钳制，本文件同时是校验边界。
 *
 * @module dsh-theme-studio/engine
 */

/** 文档 schema 版本；升版时在这里加迁移分支。 */
export const DOC_SCHEMA = 1

/* ================================================================== */
/* 颜色工具：唯一真源在 color-core.js（与浏览器半共享，D3 根治）；        */
/* 此处 re-export 保持 engine 既有契约不动。                             */
/* ================================================================== */

import {
  clamp, clamp01, clamp255, contrastRatio, hslToHex, luminance, parseColor,
  prefersLightText, rgbToHsl, rgba, round2, toHex, withAlpha,
} from './color-core.js'

export {
  clamp, clamp01, clamp255, contrastRatio, hslToHex, luminance, parseColor,
  prefersLightText, rgbToHsl, rgba, round2, toHex, withAlpha,
}

/* ================================================================== */
/* 常量：内置渐变 / 玻璃表面 / 令牌分组 / 形状令牌                     */
/* ================================================================== */

/** 内置渐变：不上传素材也能立刻得到好看的界面。 */
export const GRADIENTS = {
  midnight: { label: '午夜', angle: 160, stops: ['#05070f', '#0f1b3d', '#25264a'] },
  aurora: { label: '极光', angle: 135, stops: ['#0b1b3a', '#123a5c', '#1d6f6a', '#7ad0c1'] },
  sunset: { label: '落日', angle: 180, stops: ['#1a0b2e', '#7b2d58', '#e0763c', '#f5c26b'] },
  ink: { label: '墨玉', angle: 145, stops: ['#0d0d10', '#1c1f26', '#2b3040'] },
  paper: { label: '宣纸', angle: 160, stops: ['#f7f2e7', '#ece2cf', '#e3d6bd'] },
  sakura: { label: '夜樱', angle: 150, stops: ['#2a1020', '#743057', '#d98a9c', '#f7d9d9'] },
  forest: { label: '苔原', angle: 155, stops: ['#04120c', '#0d3b2a', '#2f7a52', '#8fc98f'] },
  cyber: { label: '赛博', angle: 120, stops: ['#05010f', '#1b0b3a', '#4a0f6b', '#00e5ff'] },
  ember: { label: '炭火', angle: 150, stops: ['#150606', '#3d1010', '#8c2f18', '#e0a24c'] },
  orchid: { label: '兰夜', angle: 140, stops: ['#0a0714', '#1e1140', '#43237a', '#8b6ff0'] },
}

/**
 * 玻璃模式要重铸的表面令牌。
 * 基准值只有浏览器知道（ui-theme 的样式表在运行时才成型），
 * 所以这份清单由浏览器半配合 probe 完成实际计算。
 */
export const GLASS_SURFACES = [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-bg-overlay',
  '--dsw-specific-sidebar-fill',
  // input-major 不进玻璃清单：会话输入框保持宿主不透明基准（主人钦定
  // 「变回原来那种不透明的」）。浏览器半同样跳过 input 族，双保险。
  '--dsw-specific-selector',
  '--dsw-specific-tip',
  '--dsw-alias-markdown-code-block',
  '--dsw-alias-markdown-inline-code',
  // 按钮族填充面与聊天气泡也是"表面"：漏掉它们，「新会话」条与消息气泡
  // 就是不透明白斑（「有底不好」实测）。
  '--dsw-alias-button-elevated-fill',
  '--dsw-specific-bubble',
  '--dsw-specific-bubble-highlight',
  '--dsw-alias-bg-module-platform',
  '--dsw-specific-sidebar-nav-item-active',
  '--dsw-specific-sidebar-nav-item-hover',
  '--dsw-static-neutral-50',
  '--dsw-static-neutral-100',
  // hover / active / 页签等"小色块"：不玻璃化就是不透明白 #f1f3f5，
  // 白字主题下白底白字（「新会话」悬停、TabHost「文件」活动页签实测同根）。
  '--dsw-alias-button-floating-hover',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-interactive-bg-active',
  '--dsw-alias-button-tool-bar-fill',
  '--dsw-alias-button-tool-bar-hover',
  '--dsw-alias-markdown-tag',
  '--dsw-specific-menu',
  // hover/active 的 solid（不透明）变体：悬停高亮与小按钮的纯白底就是它们
  // （#f1f3f5 / #ebeef2 实测），非 solid 版玻璃化后 solid 版曾漏网。
  '--dsw-alias-interactive-bg-hover-solid',
  '--dsw-alias-button-ghost-active-fill',
]

/** 设置面板呈现的令牌分组。名字必须是宿主真在用的别名。 */
export const TOKEN_GROUPS = [
  {
    id: 'surface',
    label: '表面与背景',
    tokens: [
      { name: '--dsw-alias-bg-base', label: '应用底色' },
      { name: '--dsw-alias-bg-layer-1', label: '一级面板' },
      { name: '--dsw-alias-bg-layer-2', label: '二级面板' },
      { name: '--dsw-alias-bg-layer-3', label: '三级面板' },
      { name: '--dsw-alias-bg-overlay', label: '浮层底色' },
      { name: '--dsw-specific-sidebar-fill', label: '侧栏底色' },
      { name: '--dsw-specific-input-major', label: '输入框底色' },
      { name: '--dsw-specific-selector', label: '选择器底色' },
      { name: '--dsw-specific-menu', label: '菜单材质' },
      { name: '--dsw-alias-bg-skeleton', label: '骨架屏' },
    ],
  },
  {
    id: 'text',
    label: '文字与链接',
    tokens: [
      { name: '--dsw-alias-label-primary', label: '主文字' },
      { name: '--dsw-alias-label-secondary', label: '次文字' },
      { name: '--dsw-alias-label-tertiary', label: '三级文字' },
      { name: '--dsw-alias-label-dimmed', label: '弱化文字' },
      { name: '--dsw-alias-label-caption', label: '说明文字' },
      { name: '--dsw-alias-link', label: '链接' },
      { name: '--dsw-alias-brand-primary', label: '品牌主色' },
      { name: '--dsw-alias-brand-text', label: '品牌文字' },
    ],
  },
  {
    id: 'border',
    label: '描边与投影',
    tokens: [
      { name: '--dsw-alias-border-l1', label: '描边 L1' },
      { name: '--dsw-alias-border-l2', label: '描边 L2' },
      { name: '--dsw-alias-border-l3', label: '描边 L3' },
      { name: '--dsw-alias-border-l4', label: '描边 L4' },
      { name: '--dsw-elevation-stroke-color', label: '投影描边' },
    ],
  },
  {
    id: 'state',
    label: '状态色',
    tokens: [
      { name: '--dsw-alias-state-business-primary', label: '业务主色' },
      { name: '--dsw-alias-state-success-primary', label: '成功' },
      { name: '--dsw-alias-state-warn-primary', label: '警告' },
      { name: '--dsw-alias-state-error-primary', label: '错误' },
      { name: '--dsw-alias-state-idle-primary', label: '空闲' },
    ],
  },
  {
    id: 'chat',
    label: '对话与代码',
    tokens: [
      { name: '--dsw-specific-bubble', label: '气泡底色' },
      { name: '--dsw-specific-bubble-highlight', label: '气泡高亮' },
      { name: '--dsw-alias-markdown-code-block', label: '代码块' },
      { name: '--dsw-alias-markdown-inline-code', label: '行内代码' },
      { name: '--dsw-alias-markdown-tag', label: '行内标签' },
      { name: '--dsw-alias-markdown-citation', label: '引用' },
      { name: '--dsw-alias-code-diff-added', label: 'Diff 新增' },
      { name: '--dsw-alias-code-diff-deleted', label: 'Diff 删除' },
    ],
  },
  {
    id: 'chrome',
    label: '其它材质',
    tokens: [
      { name: '--dsw-alias-tooltip-bg', label: '提示气泡' },
      { name: '--dsw-alias-toast-bg', label: 'Toast' },
      { name: '--dsw-alias-scrollbar-bg-l1', label: '滚动条' },
      { name: '--dsw-alias-scrollbar-hover-l1', label: '滚动条悬停' },
      { name: '--dsw-alias-interactive-bg-hover', label: '悬停反馈' },
      { name: '--dsw-alias-interactive-bg-active', label: '按下反馈' },
    ],
  },
  {
    id: 'button',
    label: '按钮与反馈',
    tokens: [
      { name: '--dsw-alias-button-elevated-fill', label: '普通按钮底色' },
      { name: '--dsw-alias-button-floating-hover', label: '普通按钮悬停' },
      { name: '--dsw-alias-button-primary-fill', label: '主按钮底色' },
      { name: '--dsw-alias-button-primary-hover', label: '主按钮悬停' },
      { name: '--dsw-alias-label-primary-foreground', label: '主按钮文字' },
      { name: '--dsw-alias-button-tool-bar-fill', label: '工具按钮底色' },
      { name: '--dsw-alias-button-tool-bar-hover', label: '工具按钮悬停' },
    ],
  },
]

/** 字体 / 圆角 / 动效 / 滚动条对应的真实令牌名。 */
export const SHAPE_TOKENS = {
  fontFamily: '--dsw-font-family',
  codeFontFamily: '--ds-font-family-code',
  cornerShape: '--dsw-corner-shape',
  menuBackdrop: '--dsw-menu-backdrop-filter',
  duration: '--ds-transition-duration',
  durationFast: '--ds-transition-duration-fast',
  durationSlow: '--ds-transition-duration-slow',
  scrollbarWidth: '--dsh-scrollbar-width',
}

/* ================================================================== */
/* 文档模型                                                            */
/* ================================================================== */

function defaultDoc() {
  return {
    schema: DOC_SCHEMA,
    /** 当前套用的预设 id；'' 表示手工配色。 */
    preset: '',
    base: {
      /** system 跟随系统；light/dark 直接决定 ui-theme 底色板。 */
      scheme: 'system',
      /** 对话正文像素字号，与宿主的 12..17 对齐。 */
      fontSize: 14,
    },
    backdrop: {
      /** none | image | video | gradient */
      mode: 'none',
      mediaId: '',
      gradient: 'midnight',
      fit: 'cover',
      focusX: 50,
      focusY: 50,
      scale: 1,
      /** 平铺：按素材原始像素重复，一格都不缩放。 */
      tile: false,
      blur: 0,
      brightness: 100,
      saturate: 100,
      contrast: 100,
      grayscale: 0,
      sepia: 0,
      hueRotate: 0,
      dim: 0,
      veilColor: '#000000',
      veilGradient: true,
      kenBurns: false,
      kenBurnsSeconds: 40,
      parallax: 0,
      video: { muted: true, loop: true, autoplay: true, playbackRate: 1 },
      fadeOnFocus: false,
    },
    glass: { enabled: false, alpha: 0.72, blur: 16, saturate: 150 },
    palette: {
      accent: '',
      autoAccent: true,
      /** 令牌名 → { light, dark }。 */
      tokens: {},
    },
    type: {
      uiFont: '',
      codeFont: '',
      letterSpacing: 0,
      /** 用户上传字体素材派生出的族。 */
      families: [],
    },
    shape: {
      cornerShape: 1.5,
      motionSpeed: 1,
      scrollbar: 'native',
      reduceMotion: false,
    },
    advanced: { css: '' },
  }
}

/**
 * 归一化 + 钳制外部输入：非法值一律退回默认，绝不把脏数据带进 CSS。
 * @param {unknown} raw
 */
export function normalizeDoc(raw) {
  const base = defaultDoc()
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base
  deepMerge(base, raw)

  base.preset = str(base.preset, 64)
  base.base.scheme = oneOf(base.base.scheme, ['system', 'light', 'dark'], 'system')
  base.base.fontSize = int(base.base.fontSize, 12, 17, 14)

  const b = base.backdrop
  b.mode = oneOf(b.mode, ['none', 'image', 'video', 'gradient'], 'none')
  b.mediaId = str(b.mediaId, 200)
  // Object.hasOwn 而不是 `in`：`in` 查原型链，'constructor'/'__proto__' 这类原型键
  // 会穿过校验，gradientCss 再取到 Object 构造函数，整个投影当场炸成 500。
  b.gradient = typeof b.gradient === 'string' && Object.hasOwn(GRADIENTS, b.gradient) ? b.gradient : 'midnight'
  b.fit = oneOf(b.fit, ['cover', 'contain'], 'cover')
  b.focusX = num(b.focusX, 0, 100, 50)
  b.focusY = num(b.focusY, 0, 100, 50)
  b.scale = num(b.scale, 0.5, 4, 1)
  b.tile = bool(b.tile)
  b.blur = num(b.blur, 0, 40, 0)
  b.brightness = num(b.brightness, 20, 220, 100)
  b.saturate = num(b.saturate, 0, 300, 100)
  b.contrast = num(b.contrast, 20, 300, 100)
  b.grayscale = num(b.grayscale, 0, 100, 0)
  b.sepia = num(b.sepia, 0, 100, 0)
  b.hueRotate = num(b.hueRotate, -180, 180, 0)
  b.dim = num(b.dim, 0, 0.95, 0)
  b.veilColor = colorOr(b.veilColor, '#000000')
  b.veilGradient = bool(b.veilGradient)
  b.kenBurns = bool(b.kenBurns)
  b.kenBurnsSeconds = num(b.kenBurnsSeconds, 8, 240, 40)
  b.parallax = num(b.parallax, 0, 60, 0)
  b.video.muted = bool(b.video.muted)
  b.video.loop = bool(b.video.loop)
  b.video.autoplay = bool(b.video.autoplay)
  b.video.playbackRate = num(b.video.playbackRate, 0.25, 2, 1)
  b.fadeOnFocus = bool(b.fadeOnFocus)

  base.glass.enabled = bool(base.glass.enabled)
  base.glass.alpha = num(base.glass.alpha, 0.15, 1, 0.72)
  base.glass.blur = num(base.glass.blur, 0, 60, 16)
  base.glass.saturate = num(base.glass.saturate, 100, 300, 150)

  base.palette.accent = base.palette.accent === '' ? '' : colorOr(base.palette.accent, '')
  base.palette.autoAccent = bool(base.palette.autoAccent)
  base.palette.tokens = normalizeTokenMap(base.palette.tokens)

  base.type.uiFont = fontStackOr(base.type.uiFont)
  base.type.codeFont = fontStackOr(base.type.codeFont)
  base.type.letterSpacing = num(base.type.letterSpacing, -1, 4, 0)
  base.type.families = Array.isArray(base.type.families)
    ? base.type.families
      .map((f) => ({
        id: str(f?.id, 200),
        family: familyOr(f?.family),
        weight: int(f?.weight, 1, 1000, 400),
        style: oneOf(f?.style, ['normal', 'italic'], 'normal'),
      }))
      .filter((f) => f.id !== '' && f.family !== '')
      .slice(0, 24)
    : []

  base.shape.cornerShape = num(base.shape.cornerShape, 1, 3, 1.5)
  base.shape.motionSpeed = num(base.shape.motionSpeed, 0, 4, 1)
  base.shape.scrollbar = oneOf(base.shape.scrollbar, ['native', 'auto', 'slim', 'hidden'], 'native')
  base.shape.reduceMotion = bool(base.shape.reduceMotion)

  base.advanced.css = str(base.advanced.css, 200_000)
  return base
}

/**
 * 令牌表归一化：`{ name: "#hex" }` 与 `{ name: { light, dark } }` 都收，
 * 非法令牌名与非法值直接丢弃。
 * @param {unknown} input
 */
function normalizeTokenMap(input) {
  const out = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = String(rawName).trim()
    if (!isSafeTokenName(name)) continue
    if (typeof rawValue === 'string') {
      const value = sanitizeCssValue(rawValue)
      if (value !== '') out[name] = { light: value, dark: value }
      continue
    }
    if (rawValue === null || typeof rawValue !== 'object') continue
    const light = sanitizeCssValue(rawValue.light)
    const dark = sanitizeCssValue(rawValue.dark)
    if (light === '' && dark === '') continue
    out[name] = { light, dark }
  }
  return out
}

/** 令牌名：CSS 自定义属性，且只允许宿主在用的三套前缀。 */
export function isSafeTokenName(name) {
  return /^--(?:dsw|ds|dsh)-[a-z0-9-]{1,64}$/.test(String(name))
}

/** CSS 值白名单式清洗：拒绝标签逃逸、脚本协议与表达式注入。 */
export function sanitizeCssValue(rawValue) {
  if (typeof rawValue !== 'string') return ''
  // 反斜杠形变必须在一切校验**之前**归一化：先校验后去反斜杠会把
  // `expr\ession(` 这类形变放进来、去反斜杠后伪协议复活（已实证）。
  const value = rawValue.trim().replaceAll('\\', '')
  if (value.length === 0 || value.length > 4000) return ''
  if (/[<>]/.test(value)) return ''
  if (/javascript:|vbscript:|expression\s*\(/i.test(value)) return ''
  // url() 只允许同源绝对路径：素材一律走插件自己的路由。
  for (const found of value.match(/url\(([^)]*)\)/gi) ?? []) {
    const inner = found.slice(4, -1).trim().replaceAll(/^["']|["']$/g, '')
    // 协议相对 //host 会真的出站请求，不是"同源绝对路径"——头部显式拒绝。
    if (inner.startsWith('//')) return ''
    // 点段（/media/../state.json）能过字符白名单但不是本插件任何合法素材地址；
    // 显式拒绝，别让"同源绝对路径"这个不变量依赖浏览器与服务端的两层兜底。
    if (inner.includes('..')) return ''
    if (!/^\/[A-Za-z0-9._\-/?=&%]*$/.test(inner)) return ''
  }
  return value
}

function fontStackOr(value) {
  const clean = sanitizeCssValue(value)
  if (clean === '') return ''
  // 字体栈只允许名称、引号、逗号、数字与连字符。
  return /^[A-Za-z0-9 ,.'"-]+$/.test(clean) ? clean.slice(0, 512) : ''
}

/** 单条令牌编辑的即时校验，供设置面板复用。 */
export function validateTokenEdit(name, value) {
  if (!isSafeTokenName(name)) return { ok: false, error: '令牌名需以 --dsw- / --ds- / --dsh- 开头' }
  const clean = sanitizeCssValue(value)
  if (clean === '') return { ok: false, error: '非法 CSS 值' }
  return { ok: true, value: clean }
}

function deepMerge(target, source) {
  if (source === null || typeof source !== 'object') return target
  for (const [key, value] of Object.entries(source)) {
    // 原型链键三件套直接丢弃：JSON.parse 会把 {"__proto__":{…}} 变成 own 键，
    // 走到赋值分支就是原型替换（`target['__proto__'] = …` 触发 setter）。
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (!Object.hasOwn(target, key)) continue
    const current = target[key]
    if (Array.isArray(current)) {
      if (Array.isArray(value)) target[key] = value
      continue
    }
    if (current !== null && typeof current === 'object') {
      if (value === null || typeof value !== 'object') continue
      // 空对象默认值是"自由映射表"（令牌名 → 值），键无法预知：整份收下，
      // 再由 normalizeTokenMap 这类真正的白名单去过滤。
      if (Object.keys(current).length === 0) {
        target[key] = clonePlain(value)
        continue
      }
      deepMerge(current, value)
      continue
    }
    if (value !== null && value !== undefined) target[key] = value
  }
  return target
}

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      // 与 deepMerge 同一套原型链键守卫：JSON.parse 会把 {"__proto__":{…}} 变成
      // own 键，走到赋值分支就触发原型 setter。当前唯一自由映射表（palette.tokens）
      // 会被 normalizeTokenMap 再洗一遍，但这个工具不该给下一个调用方埋雷。
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      out[String(key)] = clonePlain(item)
    }
    return out
  }
  return value
}

function num(value, lo, hi, fallback) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(n)) return fallback
  return clamp(n, lo, hi)
}

function int(value, lo, hi, fallback) {
  return Math.round(num(value, lo, hi, fallback))
}

function bool(value) {
  return value === true || value === 'true' || value === 1
}

function str(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function oneOf(value, options, fallback) {
  return options.includes(value) ? value : fallback
}

/** 族名会进 @font-face 的 font-family 与 inline style：只收常规字体名字符。 */
function familyOr(value) {
  const clean = str(value, 80).trim()
  return /^[A-Za-z0-9\u4e00-\u9fa5 _-]{1,80}$/.test(clean) ? clean : ''
}

function colorOr(value, fallback) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return parseColor(trimmed) === null ? fallback : trimmed
}

/* ================================================================== */
/* 预设                                                                */
/* ================================================================== */

/**
 * 由一枚强调色展开整套配色，深浅两套都给全。
 * @param {string} accent
 * @param {{mood?: string}} [options] - 气质倾向（warm/cool/neutral；PRESETS 推断为
 *   string，这里放宽，分支只做相等比较）
 * @returns {Record<string, {light:string,dark:string}>}
 */
export function paletteFromAccent(accent, options = {}) {
  const seed = parseColor(accent) ?? { r: 65, g: 118, b: 230, a: 1 }
  const hsl = rgbToHsl(seed)
  const tint = options.mood === 'warm' ? 16 : options.mood === 'cool' ? -12 : 0
  const both = (light, dark) => ({ light, dark })
  const bgLight = hslToHex(hsl.h + tint, clamp(hsl.s * 0.28, 5, 16), 98)
  const bgDark = hslToHex(hsl.h + tint, clamp(hsl.s * 0.34, 8, 22), 7)
  const layerLight = hslToHex(hsl.h + tint, clamp(hsl.s * 0.24, 4, 12), 100)
  const layerDark = hslToHex(hsl.h + tint, clamp(hsl.s * 0.3, 6, 18), 11)
  const deepLight = hslToHex(hsl.h + tint, clamp(hsl.s * 0.32, 6, 16), 95)
  const deepDark = hslToHex(hsl.h + tint, clamp(hsl.s * 0.34, 8, 20), 9)
  const accentLight = hslToHex(hsl.h, clamp(hsl.s + 6, 45, 90), 42)
  const accentDark = hslToHex(hsl.h, clamp(hsl.s, 52, 92), 66)
  const softLight = hslToHex(hsl.h, clamp(hsl.s * 0.7, 30, 80), 93)
  const softDark = hslToHex(hsl.h, clamp(hsl.s * 0.5, 16, 42), 22)
  const labelLight = hslToHex(hsl.h + tint, clamp(hsl.s * 0.5, 18, 42), 10)
  const labelDark = hslToHex(hsl.h + tint, 12, 96)
  return {
    '--dsw-alias-bg-base': both(bgLight, bgDark),
    '--dsw-alias-bg-layer-1': both(layerLight, layerDark),
    '--dsw-alias-bg-layer-2': both(hslToHex(hsl.h + tint, clamp(hsl.s * 0.28, 5, 14), 97), hslToHex(hsl.h + tint, clamp(hsl.s * 0.32, 6, 20), 15)),
    '--dsw-alias-bg-layer-3': both(hslToHex(hsl.h + tint, clamp(hsl.s * 0.28, 5, 14), 96), hslToHex(hsl.h + tint, clamp(hsl.s * 0.32, 6, 20), 17)),
    '--dsw-alias-bg-overlay': both(layerLight, hslToHex(hsl.h + tint, clamp(hsl.s * 0.3, 6, 18), 13)),
    '--dsw-specific-sidebar-fill': both(deepLight, deepDark),
    '--dsw-specific-selector': both(softLight, softDark),
    '--dsw-specific-bubble': both(softLight, softDark),
    '--dsw-specific-bubble-highlight': both(hslToHex(hsl.h, clamp(hsl.s, 45, 85), 78), hslToHex(hsl.h, clamp(hsl.s, 45, 85), 34)),
    '--dsw-alias-label-primary': both(labelLight, labelDark),
    '--dsw-alias-label-secondary': both(hslToHex(hsl.h + tint, 14, 32), hslToHex(hsl.h + tint, 10, 74)),
    '--dsw-alias-brand-primary': both(accentLight, accentDark),
    '--dsw-alias-link': both(accentLight, accentDark),
    '--dsw-alias-state-business-primary': both(accentLight, accentDark),
    '--dsw-alias-border-l1': both(rgba({ r: 12, g: 14, b: 20 }, 0.05), rgba({ r: 220, g: 228, b: 240 }, 0.07)),
    '--dsw-alias-border-l2': both(rgba({ r: 12, g: 14, b: 20 }, 0.1), rgba({ r: 220, g: 228, b: 240 }, 0.12)),
  }
}

/** 预设：每个都是"配色 + 背景"成套校好的成品。 */
export const PRESETS = [
  { id: 'default', name: '官方原色', accent: '', mood: 'neutral', backdrop: 'none', gradient: 'midnight', note: '不覆盖任何令牌' },
  { id: 'deepsea', name: '深海', accent: '#2f8fd6', mood: 'cool', backdrop: 'gradient', gradient: 'midnight' },
  { id: 'aurora', name: '极光', accent: '#39d0b4', mood: 'cool', backdrop: 'gradient', gradient: 'aurora' },
  { id: 'ember', name: '炭火', accent: '#e0703c', mood: 'warm', backdrop: 'gradient', gradient: 'ember' },
  { id: 'moss', name: '苔原', accent: '#57b17a', mood: 'cool', backdrop: 'gradient', gradient: 'forest' },
  { id: 'sakura', name: '夜樱', accent: '#e486a4', mood: 'warm', backdrop: 'gradient', gradient: 'sakura' },
  { id: 'cyber', name: '赛博', accent: '#00e5ff', mood: 'cool', backdrop: 'gradient', gradient: 'cyber' },
  { id: 'parchment', name: '宣纸', accent: '#9a6b34', mood: 'warm', backdrop: 'none', gradient: 'paper' },
  { id: 'graphite', name: '石墨', accent: '#8f9bb3', mood: 'neutral', backdrop: 'none', gradient: 'ink' },
  { id: 'orchid', name: '兰夜', accent: '#8b6ff0', mood: 'cool', backdrop: 'gradient', gradient: 'orchid' },
  { id: 'slate', name: '雨岩', accent: '#5b8aa6', mood: 'neutral', backdrop: 'gradient', gradient: 'aurora' },
  { id: 'clay', name: '陶土', accent: '#c07a55', mood: 'warm', backdrop: 'none', gradient: 'sunset' },
]

/**
 * 套用预设（返回新文档，不改入参）。
 * @param {object} doc
 * @param {string} presetId
 */
export function applyPreset(doc, presetId) {
  const next = normalizeDoc(doc)
  const preset = PRESETS.find((p) => p.id === presetId)
  if (preset === undefined) return next
  next.preset = preset.id
  if (preset.accent === '') {
    next.palette.accent = ''
    next.palette.tokens = {}
    next.backdrop.mode = 'none'
    next.glass.enabled = false
    return next
  }
  next.palette.accent = preset.accent
  next.palette.autoAccent = true
  next.palette.tokens = paletteFromAccent(preset.accent, { mood: preset.mood })
  next.backdrop.mode = preset.backdrop === 'none' ? 'none' : 'gradient'
  next.backdrop.gradient = preset.gradient
  next.backdrop.dim = preset.backdrop === 'none' ? 0 : 0.18
  return next
}

/* ================================================================== */
/* 令牌层                                                              */
/* ================================================================== */

/** 强调色单独生效时派生的令牌（用户手写过的不覆盖）。 */
const ACCENT_SHARED = [
  '--dsw-alias-brand-primary',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-button-info-fill',
  '--dsw-alias-state-business-primary',
  '--dsw-alias-link',
]

/**
 * 把文档翻译成 ctx.theme 需要的令牌层：`{ 令牌名: { light, dark } }`。
 *
 * overrideTokens 要求两个模式都给值（否则切到另一个配色就"半瞎"），但补值分两段：
 * Host 看不见页面基准值，只负责"有 probe 就补、没有就留空"；
 * 真正成对由浏览器半 fillTokenPairs 收口（先基准值，基准值也没有才退到另一侧）。
 * 这样"只改浅色"的编辑不会被冒充成深色值。
 *
 * @param {any} doc
 * @param {{probe?:(name:string, scheme:'light'|'dark')=>string}} [options]
 * @returns {Record<string, {light:string,dark:string}>}
 */
export function buildTokenLayers(doc, options = {}) {
  const { probe } = options
  /** @type {Record<string, {light:string,dark:string}>} */
  const out = {}
  const put = (name, light, dark, force = false) => {
    if (!isSafeTokenName(name)) return
    if (!force && out[name] !== undefined) return
    const cleanLight = sanitizeCssValue(light ?? '')
    const cleanDark = sanitizeCssValue(dark ?? '')
    if (cleanLight === '' && cleanDark === '') return
    out[name] = { light: cleanLight, dark: cleanDark }
  }

  // 1) 显式令牌优先级最高：后面所有派生都不覆盖它。
  for (const [name, value] of Object.entries(doc.palette.tokens)) {
    out[name] = { light: value.light, dark: value.dark }
  }
  const explicit = new Set(Object.keys(out))

  // 2) 强调色派生（仅作用于用户没手写过的那些）
  if (doc.palette.accent !== '' && doc.palette.autoAccent) {
    const accent = parseColor(doc.palette.accent)
    if (accent !== null) {
      const hsl = rgbToHsl(accent)
      const light = hslToHex(hsl.h, clamp(hsl.s + 6, 45, 90), 42)
      const dark = hslToHex(hsl.h, clamp(hsl.s, 52, 92), 66)
      for (const name of ACCENT_SHARED) {
        if (!explicit.has(name)) put(name, light, dark)
      }
      if (!explicit.has('--dsw-alias-interactive-bg-hover-accent')) {
        put('--dsw-alias-interactive-bg-hover-accent', rgba(accent, 0.14), rgba(accent, 0.2))
      }
      if (!explicit.has('--dsw-specific-sidebar-nav-item-active-accent')) {
        put('--dsw-specific-sidebar-nav-item-active-accent', rgba(accent, 0.14), rgba(accent, 0.22))
      }
    }
  }

  // 3) 字体 / 圆角 / 动效 / 滚动条：与明暗无关，两侧同值。
  //    不带 force：用户在令牌编辑器里手写的同名显式令牌优先（与第 1 步的
  //    注释契约一致）。尤其 cornerShape 是无条件落地的 —— 若强制覆盖，
  //    滑块的默认值 1.5 会把手写的 --dsw-corner-shape 静默打回去。
  if (doc.type.uiFont !== '') put(SHAPE_TOKENS.fontFamily, doc.type.uiFont, doc.type.uiFont)
  if (doc.type.codeFont !== '') put(SHAPE_TOKENS.codeFontFamily, doc.type.codeFont, doc.type.codeFont)
  put(SHAPE_TOKENS.cornerShape, `superellipse(${round2(doc.shape.cornerShape)})`, `superellipse(${round2(doc.shape.cornerShape)})`)
  if (doc.glass.enabled && doc.backdrop.mode !== 'none') {
    const filter = `blur(${doc.glass.blur}px) saturate(${doc.glass.saturate}%)`
    put(SHAPE_TOKENS.menuBackdrop, filter, filter)
    // 弹层面板填充：MenuSurface 的磨砂材料层（.material）在被玻璃祖先（如输入卡
    // _card 的 backdrop-filter）圈住的子树里取景失效，blur 帮不上忙 —— 填充自身
    // 的不透明度就是唯一防线。0.6：亮文字只剩隐约色块，同时保住玻璃的透亮
    // （0.88 曾把整体压闷，主人实测；「+ 菜单/弹出的界面不能看清后面的字」）。
    put('--dsw-menu-surface-fill', 'rgba(16, 20, 24, 0.6)', 'rgba(16, 20, 24, 0.6)')
  }
  const speed = doc.shape.reduceMotion ? 0 : doc.shape.motionSpeed
  if (speed !== 1) {
    const scale = (ms) => (speed <= 0 ? '0s' : `${round2(ms * speed)}s`)
    put(SHAPE_TOKENS.duration, scale(0.2), scale(0.2))
    put(SHAPE_TOKENS.durationFast, scale(0.1), scale(0.1))
    put(SHAPE_TOKENS.durationSlow, scale(0.3), scale(0.3))
  }
  if (doc.shape.scrollbar === 'slim') put(SHAPE_TOKENS.scrollbarWidth, '3px', '3px')
  if (doc.shape.scrollbar === 'auto') put(SHAPE_TOKENS.scrollbarWidth, '8px', '8px')

  // 4) 单侧缺值：有 probe 就取页面基准值，没有就留空，交给浏览器半补。
  // ⚠️ 不在 Host 侧"沿用另一侧"：Host 看不见页面基准值，镜像会把一次只改浅色的
  // 编辑冒充成深色值（用户只改浅色时，深色该保留它自己的基准，不是跟着变浅）。
  // 浏览器半 fillTokenPairs 才是最终收口：先基准值，基准值也没有才退到另一侧。
  for (const [name, value] of Object.entries(out)) {
    if (value.light === '') value.light = probe?.(name, 'light') ?? ''
    if (value.dark === '') value.dark = probe?.(name, 'dark') ?? ''
  }
  return out
}

/* ================================================================== */
/* CSS：只负责插件自己拥有的 DOM                                       */
/* ================================================================== */

/** 素材地址。带上原名，下载与调试时看得见。 */
export function mediaUrl(media, prefix = '/dsh-theme-studio') {
  return `${prefix}/media/${encodeURIComponent(media.id)}/${encodeURIComponent(media.name ?? '')}`
}

function filterOf(b) {
  const parts = []
  if (b.blur > 0) parts.push(`blur(${b.blur}px)`)
  if (b.brightness !== 100) parts.push(`brightness(${b.brightness}%)`)
  if (b.saturate !== 100) parts.push(`saturate(${b.saturate}%)`)
  if (b.contrast !== 100) parts.push(`contrast(${b.contrast}%)`)
  if (b.grayscale > 0) parts.push(`grayscale(${b.grayscale}%)`)
  if (b.sepia > 0) parts.push(`sepia(${b.sepia}%)`)
  if (b.hueRotate !== 0) parts.push(`hue-rotate(${b.hueRotate}deg)`)
  return parts.length > 0 ? parts.join(' ') : 'none'
}

/** 内置渐变的 CSS 值。 */
export function gradientCss(id) {
  // 同 normalizeDoc：下标查询必须 hasOwn，否则原型键取到 Object 构造函数。
  const g = typeof id === 'string' && Object.hasOwn(GRADIENTS, id) ? GRADIENTS[id] : GRADIENTS.midnight
  return `linear-gradient(${g.angle}deg, ${g.stops.join(', ')})`
}

function veilOf(b) {
  if (b.dim <= 0) return ''
  const veil = parseColor(b.veilColor) ?? { r: 0, g: 0, b: 0, a: 1 }
  if (!b.veilGradient) return rgba(veil, b.dim)
  // 上轻下重：对话正文多落在中下部，这样压暗最省对比度预算。
  return `linear-gradient(180deg, ${rgba(veil, b.dim * 0.55)} 0%, ${rgba(veil, b.dim)} 58%, ${rgba(veil, b.dim * 0.85)} 100%)`
}

/** 由字体素材派生族名（同一素材永远得到同一个名字）。 */
export function fontFamilyFor(media) {
  return `DTS-${String(media.id).slice(0, 8)}`
}

function fontFormat(mime) {
  if (mime === 'font/woff2') return 'woff2'
  if (mime === 'font/woff') return 'woff'
  if (mime === 'font/otf') return 'opentype'
  return 'truetype'
}

/**
 * 生成插件自有 DOM 的样式表。
 * @param {any} doc
 * @param {{mediaUrlFor?:(id:string)=>string, prefix?:string, media?:Record<string,any>}} [env]
 */
export function buildCss(doc, env = {}) {
  const b = doc.backdrop
  const urlFor = env.mediaUrlFor ?? ((id) => `${env.prefix ?? '/dsh-theme-studio'}/media/${encodeURIComponent(id)}/`)
  const out = []

  // --- 背景层 -------------------------------------------------------------
  if (b.mode !== 'none') {
    // 层的定位必须跟背景样式同源。这两行原来只在首屏注入 CSS 里，而首屏
    // 只在"启动时就已有背景"时才输出；从"无背景"点出背景的链路全走浏览器侧
    // 注入，缺了它们，层就是一个零尺寸的静态 div —— 表现正是"点了没反应"。
    out.push(
      '.dts-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; contain: paint; }\n'
      + '#root { position: relative; z-index: 1; }',
    )
    const veil = veilOf(b)
    const layers = veil === '' ? [] : [veil]
    const hasImage = b.mode === 'image' && b.mediaId !== ''
    if (hasImage) layers.push(`url("${urlFor(b.mediaId)}")`)
    else layers.push(gradientCss(b.gradient))

    // 铺法交给 background-size 关键字、放大倍率交给 transform —— 与 .dts-video 的
    // object-fit + transform: scale 同构。旧实现把 scale 拼进 background-size 的值
    // 列表：遮罩层在列表第一格把 scale 吃掉、图片层拿到 auto —— "放大倍率"在开着
    // 压暗遮罩时形同虚设（已实证）；铺满档也只是宽度 100% 而不是真 cover。
    const size = b.tile ? 'auto' : (hasImage && b.fit === 'contain' ? 'contain' : 'cover')
    const zoom = b.tile ? '' : `\n  transform: scale(${round2(b.scale)});`
    out.push(
      `.dts-layer--css {\n  background-image: ${layers.join(',\n  ')};\n  background-size: ${size};\n  background-position: ${b.tile ? '0% 0%' : `${b.focusX}% ${b.focusY}%`};\n  background-repeat: ${b.tile ? 'repeat' : 'no-repeat'};${zoom}\n  filter: ${filterOf(b)};\n}`,
    )
    out.push(
      `.dts-video {\n  object-fit: ${b.tile ? 'none' : b.fit};\n  object-position: ${b.focusX}% ${b.focusY}%;\n  transform: scale(${round2(b.scale)});\n  filter: ${filterOf(b)};\n}`,
    )

    if (b.parallax > 0) {
      const shift = round2(b.parallax / 30)
      // 只作用在外层 wrapper（#dts-backdrop）：旧写法用 `.dts-layer` 选择器，
      // wrapper 与内层 --css 层都带这个类 —— 同特异性下源序取胜，视差规则会
      // 覆盖掉内层的 `transform: scale(放大倍率)`（ Ken Burns 关着时放大旋钮整个失灵），
      // 而且两层各平移一次，位移翻倍；平铺模式还会被塞进 scale，违反"一格都不缩放"。
      // 平移放 wrapper 上（整层一起动，单次位移），缩放仍归内层自己的属性链。
      out.push(`#dts-backdrop { transform: translate3d(calc(var(--dts-mx, 0) * ${shift}px), calc(var(--dts-my, 0) * ${shift}px), 0); }`)
    }
    if (b.kenBurns && !b.tile) {
      // 推拉动 transform，与放大倍率同一条属性链；这里 background-size 只有关键字，
      // 关键字之间没有平滑动画。平铺模式（原始像素）本就不缩放，跳过推拉。
      const from = round2(b.scale)
      const to = round2(b.scale * 1.12)
      out.push(`.dts-layer--css { animation: dts-kenburns ${b.kenBurnsSeconds}s ease-in-out infinite alternate; }`)
      out.push(`@keyframes dts-kenburns {\n  from { transform: scale(${from}); }\n  to { transform: scale(${to}); }\n}`)
    }
    if (b.fadeOnFocus) {
      out.push('body:has(textarea:focus-visible) .dts-layer, body:has(input:focus-visible) .dts-layer { opacity: 0.35; }')
    }
    // 画布不透明就把壁纸挡死了：这一条是背景能看见的前提。
    out.push(
      'html, body { background-color: transparent !important; }\n'
      + '#root, #root > * { background-color: transparent; }',
    )
  }

  // --- 玻璃：给已知会用 backdrop-filter 的材质补一层模糊 --------------------
  if (doc.glass.enabled && b.mode !== 'none') {
    out.push(
      '[role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [class*="menu"], [class*="Menu"] {\n  backdrop-filter: blur(${blur}px) saturate(${sat}%);\n}'
        .replace('${blur}', String(doc.glass.blur))
        .replace('${sat}', String(doc.glass.saturate)),
    )
    // 豁免：AgentPresetSeat 的包裹层（HKgFRW_menuAnchor）类名含 "menu" 子串，
    // 会被上面的兜底命中，常驻一块磨砂暗斑 —— 亮壁纸区域上 blur(50px) 就是
    // 一块浅色磨砂（主人实测「创造模式底色应和工作区一样透」）。
    // ⚠️ 用子串匹配 + !important：Menu 原语会给包装层拼接额外类名，结尾锚定
    // （[class$=…]）会落空；!important 保证压过兜底与本包其它声明。
    // 真正的弹出菜单走 role=menu/listbox 照常命中不受影响。
    out.push('[class*="menuAnchor"] {\n  background: none !important;\n  backdrop-filter: none !important;\n}')
  }

  // --- 滚动条：隐藏只能靠伪元素规则，令牌做不到 ----------------------------
  if (doc.shape.scrollbar === 'hidden') {
    out.push('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }\n* { scrollbar-width: none; }')
  } else if (doc.shape.scrollbar === 'auto') {
    out.push('::-webkit-scrollbar-thumb { border: 2px solid transparent; background-clip: padding-box; }')
  }

  // --- 字距（宿主没有对应令牌，只能落在 body 上） --------------------------
  if (doc.type.letterSpacing !== 0) {
    out.push(`body { letter-spacing: ${doc.type.letterSpacing}em; }`)
  }

  // --- @font-face：用户上传的字体 ------------------------------------------
  const media = env.media ?? {}
  for (const entry of doc.type.families) {
    const meta = media[entry.id]
    if (meta === undefined || meta.kind !== 'font') continue
    out.push(
      `@font-face {\n  font-family: "${entry.family}";\n  font-style: ${entry.style};\n  font-weight: ${entry.weight};\n  font-display: swap;\n  src: url("${urlFor(entry.id)}") format("${fontFormat(meta.mime)}");\n}`,
    )
  }

  // --- 减少动态效果 --------------------------------------------------------
  if (doc.shape.reduceMotion) {
    out.push('*, *::before, *::after { animation-duration: 0.001s !important; animation-iteration-count: 1 !important; transition-duration: 0s !important; }')
  }

  if (doc.advanced.css !== '') out.push(`/* dsh-theme-studio: 高级自定义 */\n${doc.advanced.css}`)
  return out.join('\n')
}

/**
 * 首屏样式：只保证"刷新那一刻就有背景与正确底色"，完整效果等插件加载后补上。
 * 由 Host 在 index.html 渲染时注入，因此不依赖任何浏览器端时序。
 * @param {any} doc
 * @param {{mediaUrlFor?:(id:string)=>string, prefix?:string}} [env]
 */
export function buildBootCss(doc, env = {}) {
  const b = doc.backdrop
  if (b.mode === 'none') return ''
  const urlFor = env.mediaUrlFor ?? ((id) => `${env.prefix ?? '/dsh-theme-studio'}/media/${encodeURIComponent(id)}/`)
  const veil = veilOf(b)
  const layers = veil === '' ? [] : [veil]
  const hasImage = b.mode === 'image' && b.mediaId !== ''
  if (hasImage) layers.push(`url("${urlFor(b.mediaId)}")`)
  else layers.push(gradientCss(b.gradient))

  // 与 buildCss 同源同义：铺法关键字 + transform 放大（详见 buildCss 的注释）。
  const size = b.tile ? 'auto' : (hasImage && b.fit === 'contain' ? 'contain' : 'cover')
  const zoom = b.tile ? '' : `transform:scale(${round2(b.scale)});`

  return [
    // 背景层固定在最底且不吃交互；#root 抬到它上面。
    '.dts-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:paint}',
    '#root{position:relative;z-index:1}',
    `.dts-layer--css{background-image:${layers.join(',')};background-size:${size};background-position:${b.tile ? '0% 0%' : `${b.focusX}% ${b.focusY}%`};background-repeat:${b.tile ? 'repeat' : 'no-repeat'};${zoom}filter:${filterOf(b)}}`,
    `.dts-video{position:absolute;inset:0;width:100%;height:100%;object-fit:${b.fit};object-position:${b.focusX}% ${b.focusY}%;transform:scale(${round2(b.scale)});filter:${filterOf(b)}}`,
    // 背景一旦启用，画布必须透明，否则壁纸被 body/#root 的底色压住看不见。
    // #root 一层与 buildCss 同源：宿主内容容器的不透明底（首屏样式表里就有）
    // 会盖住壁纸 —— 首屏少了这一条，"刷新那一刻就有背景"就只兑现一半。
    'html,body{background-color:transparent!important}',
    '#root,#root>*{background-color:transparent}',
  ].join('\n')
}

export { defaultDoc as createDefaultDoc }
