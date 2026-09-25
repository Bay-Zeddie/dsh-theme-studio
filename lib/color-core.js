/**
 * 颜色核心（唯一真源）：Host 引擎（lib/engine.js）与浏览器半（src/client/*.ts）共享。
 *
 * 历史：两端曾各养一份实现（D3），0.36 明暗阈值与 WCAG 通道公式两处手抄，
 * 连 round2 口径都漂移过（client 曾输出全精度）。如今 Host 侧走真 ESM import、
 * 浏览器侧由构建期 alwaysBundle 内联进产物 —— 源码一份，运行时同一套口径。
 *
 * 零依赖、纯函数；数值口径 round2 是与 client 交叉锁钉死的契约，不得单边修改。
 */

/** CSS 颜色解析白名单形态。 */
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function clamp255(v) {
  return Math.max(0, Math.min(255, v))
}

function round2(v) {
  return Math.round(v * 100) / 100
}

function pair(hex) {
  return Number.parseInt(hex + hex, 16)
}

function hue2rgb(p, q, t) {
  let value = t
  if (value < 0) value += 1
  if (value > 1) value -= 1
  if (value < 1 / 6) return p + (q - p) * 6 * value
  if (value < 1 / 2) return q
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
  return p
}

function hslToRgb(h, s, l) {
  const hh = (((h % 360) + 360) % 360) / 360
  const ss = clamp01(s / 100)
  const ll = clamp01(l / 100)
  if (ss === 0) {
    const v = Math.round(ll * 255)
    return { r: v, g: v, b: v }
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  return {
    r: Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hh) * 255),
    b: Math.round(hue2rgb(p, q, hh - 1 / 3) * 255),
  }
}

/**
 * 解析 CSS 颜色为 {r,g,b,a}。支持 #hex / rgb[a]() / hsl[a]() / transparent。
 * @param {unknown} value
 * @returns {{r:number,g:number,b:number,a:number}|null}
 */
export function parseColor(value) {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (HEX_RE.test(text)) {
    const body = text.slice(1)
    if (body.length === 3 || body.length === 4) {
      return {
        r: pair(body[0]),
        g: pair(body[1]),
        b: pair(body[2]),
        a: body.length === 4 ? round2(pair(body[3]) / 255) : 1,
      }
    }
    return {
      r: Number.parseInt(body.slice(0, 2), 16),
      g: Number.parseInt(body.slice(2, 4), 16),
      b: Number.parseInt(body.slice(4, 6), 16),
      a: body.length === 8 ? round2(Number.parseInt(body.slice(6, 8), 16) / 255) : 1,
    }
  }
  const fn = /^(rgba?|hsla?)\(([^)]+)\)$/.exec(text)
  if (fn === null) return null
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const isHsl = fn[1].startsWith('hsl')
  const nums = parts.slice(0, 3).map((token, index) => {
    const n = Number.parseFloat(token)
    if (Number.isNaN(n)) return NaN
    if (!token.endsWith('%')) return n
    // rgb() 的通道百分比是 0..100%，要映射到 0..255（`rgb(50%,0,0)` 曾被当成
    // `rgb(50,0,0)`，亮度直接掉一半）；hsl() 的 s/l 本来就是百分比口径，原样收。
    return isHsl && index > 0 ? n : (n / 100) * 255
  })
  if (nums.some(Number.isNaN)) return null
  const rgb = fn[1] === 'rgb' || fn[1] === 'rgba'
    ? { r: nums[0], g: nums[1], b: nums[2] }
    : hslToRgb(nums[0], nums[1], nums[2])
  const alphaToken = parts[3]
  const alpha = alphaToken === undefined
    ? 1
    : alphaToken.endsWith('%')
      ? Number.parseFloat(alphaToken) / 100
      : Number.parseFloat(alphaToken)
  if (Number.isNaN(alpha)) return null
  return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: clamp01(alpha) }
}

/** rgb → hsl（h 0..360，s/l 0..100；round2 口径是双端交叉锁契约）。 */
export function rgbToHsl({ r, g, b }) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: round2(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
  else if (max === gg) h = ((bb - rr) / d + 2) / 6
  else h = ((rr - gg) / d + 4) / 6
  return { h: round2(h * 360), s: round2(s * 100), l: round2(l * 100) }
}

/** HSL → #rrggbb（取色器与强调色派生共用）。 */
export function hslToHex(h, s, l) {
  return toHex(hslToRgb(h, s, l))
}

/** 以 #rrggbb 输出（收颜色对象或任意可解析字符串）。 */
export function toHex(color) {
  const c = typeof color === 'string' ? parseColor(color) : color
  if (c === null || c === undefined) return '#000000'
  const hex = (v) => Math.round(clamp255(v)).toString(16).padStart(2, '0')
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`
}

/** 输出 rgba(r, g, b, a)；换不透明度保持 RGB（玻璃重铸的底座）。 */
export function rgba(color, alpha) {
  const c = typeof color === 'string' ? parseColor(color) : color
  if (c === null || c === undefined) return 'rgba(0, 0, 0, 0)'
  return `rgba(${Math.round(clamp255(c.r))}, ${Math.round(clamp255(c.g))}, ${Math.round(clamp255(c.b))}, ${round2(clamp01(alpha))})`
}

/** 换掉一枚颜色的不透明度（保持 RGB 不动）。 */
export function withAlpha(color, alpha) {
  return rgba(color, alpha)
}

/** WCAG 相对亮度。 */
export function luminance(color) {
  const c = typeof color === 'string' ? parseColor(color) : color
  if (c === null || c === undefined) return 0
  const channel = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

/** WCAG 对比度（1..21）。 */
export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return round2((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))
}

/** 给定背景，正文该用亮字还是暗字（1=亮字，0=暗字）。 */
export function prefersLightText(background) {
  return luminance(background) < 0.36 ? 1 : 0
}

export { clamp, clamp01, clamp255, round2 }
