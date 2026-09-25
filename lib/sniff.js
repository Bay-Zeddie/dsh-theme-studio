/**
 * 媒体类型白名单与文件头判定（从 store.js 拆出，行为不变；store 侧 re-export 保持契约）。
 * 判定只看魔数字节 —— 不看扩展名，也不看浏览器声明。
 */

/** 允许的素材类型：魔数字节决定。 */
export const MEDIA_TYPES = {
  'image/png': { ext: '.png', kind: 'image' },
  'image/jpeg': { ext: '.jpg', kind: 'image' },
  'image/gif': { ext: '.gif', kind: 'image' },
  'image/webp': { ext: '.webp', kind: 'image' },
  'image/avif': { ext: '.avif', kind: 'image' },
  'image/bmp': { ext: '.bmp', kind: 'image' },
  'image/svg+xml': { ext: '.svg', kind: 'image' },
  'video/mp4': { ext: '.mp4', kind: 'video' },
  'video/webm': { ext: '.webm', kind: 'video' },
  'video/quicktime': { ext: '.mov', kind: 'video' },
  'video/x-matroska': { ext: '.mkv', kind: 'video' },
  'video/mp2t': { ext: '.ts', kind: 'video' },
  'font/woff2': { ext: '.woff2', kind: 'font' },
  'font/woff': { ext: '.woff', kind: 'font' },
  'font/ttf': { ext: '.ttf', kind: 'font' },
  'font/otf': { ext: '.otf', kind: 'font' },
}

/**
 * 依据文件头魔数判定真实类型。返回 undefined 表示不在白名单内。
 * @param {Uint8Array} head - 文件起始若干字节（≥ 32 字节最稳）。
 * @returns {string|undefined}
 */
export function sniffMediaType(head) {
  if (head.length < 12) return undefined
  const u8 = head
  const ascii = (from, len) => Buffer.from(u8.subarray(from, from + len)).toString('latin1')
  // 图片
  if (u8[0] === 0x89 && ascii(1, 3) === 'PNG' && u8[4] === 0x0d && u8[5] === 0x0a) return 'image/png'
  if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg'
  if (ascii(0, 3) === 'GIF' && ascii(3, 3) === '89a') return 'image/gif'
  if (ascii(0, 3) === 'GIF' && ascii(3, 3) === '87a') return 'image/gif'
  if (u8[0] === 0x42 && u8[1] === 0x4d) return 'image/bmp'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ' || chunk === 'VP8L' || chunk === 'VP8X') return 'image/webp'
  }
  if (ascii(4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 4))) return 'image/avif'
  // 视频
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4)
    if (['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'avc1', 'mp41', 'mp42', '3gp4', '3gp5', 'MSNV', 'dash'].includes(brand)) return 'video/mp4'
    if (brand === 'qt  ') return 'video/quicktime'
  }
  if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return 'video/webm'
  if (u8[0] === 0x47 && u8[188] === 0x47 && u8[376] === 0x47) return 'video/mp2t'
  // 字体
  if (ascii(0, 4) === 'wOF2') return 'font/woff2'
  if (ascii(0, 4) === 'wOFF') return 'font/woff'
  const sfnt = ascii(0, 4)
  if (sfnt === 'OTTO') return 'font/otf'
  if (u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00) return 'font/ttf'
  if (ascii(0, 4) === 'true' || ascii(0, 4) === 'ttcf') return 'font/ttf'
  return undefined
}

/**
 * SVG 静态危险特征（黑名单）。黑名单只是纵深防御的一层（回吐侧还有
 * CSP sandbox + attachment 兜底），但每堵高一分，回吐头失守时的爆炸半径就小一分。
 */
const SVG_DANGER_RE = /<script|<\/?foreignobject|\son[a-z]+\s*=|javascript:|<use\b|<iframe|<embed|<object|<animate|<set\b|<handler\b|attributename\s*=\s*["']?\s*on|(?:xlink:)?href\s*=\s*["']?\s*(?:https?:)?\/\//i

/**
 * 扫描前的归一化：黑名单匹配的是字面文本，而浏览器按 XML 语义解析，
 * 两者的差异就是绕过面。这里把已知形变折回字面形态再匹配（宁可误报，不可漏报）：
 *  - 数字/十六进制实体解码：`href="&#106;avascript:…"` 浏览器解析后就是 javascript:
 *  - 命名空间前缀剥离：`<s:script>` 带上 SVG 命名空间声明就是真 script 元素
 *  - 制表/换行剔除：URL 解析器会把 `java\tscript:` 里的控制符剥掉
 */
function normalizeSvgForScan(text) {
  const decodeEntity = (body) => {
    const code = body.startsWith('x') || body.startsWith('X') ? Number.parseInt(body.slice(1), 16) : Number.parseInt(body, 10)
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' '
  }
  return text
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => decodeEntity(`x${hex}`))
    .replace(/&#(\d+);?/g, (_, dec) => decodeEntity(dec))
    .replace(/<([a-z0-9_.-]+):/gi, '<')
    .replace(/<\/([a-z0-9_.-]+):/gi, '</')
    .replaceAll(/[\t\n\r\f\v]/g, '')
}

/** SVG 全文体检的大小上限：纯文本壁纸不该超过这个量级。 */
export const SVG_FULL_SCAN_MAX = 16 * 1024 * 1024

/**
 * SVG 需要单独宽松判定：它没有二进制魔数，但作为背景图很常用。
 * 只接受以 <?xml 或 <svg 起始、且不含脚本/事件/外链特征的文本。
 * 头部嗅探之外，ingest 还会拿全文再走一次本函数（头部 512B 可被垫长注释绕过）。
 * @param {Uint8Array|string} input - 文件起始字节，或全文文本（更可靠）。
 */
export function sniffSvg(input) {
  const text = (typeof input === 'string'
    ? input
    : Buffer.from(input.subarray(0, Math.min(input.length, 512))).toString('utf8')).trim()
  if (text.length < 5) return false
  if (!text.startsWith('<?xml') && !text.startsWith('<svg')) return false
  return !SVG_DANGER_RE.test(normalizeSvgForScan(text))
}
