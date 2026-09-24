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
 * @param {Buffer} head - 文件起始若干字节（≥ 32 字节最稳）。
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

/** SVG 静态危险特征：脚本、任意 on* 事件属性、嵌入/外链、伪协议（黑名单）。 */
const SVG_DANGER_RE = /<script|<\/?foreignobject|\son[a-z]+\s*=|javascript:|<use\b|<iframe|<embed|<object|<animate/i

/** SVG 全文体检的大小上限：纯文本壁纸不该超过这个量级。 */
export const SVG_FULL_SCAN_MAX = 16 * 1024 * 1024

/**
 * SVG 需要单独宽松判定：它没有二进制魔数，但作为背景图很常用。
 * 只接受以 <?xml 或 <svg 起始、且不含脚本/事件/外链特征的文本。
 * 头部嗅探之外，ingest 还会拿全文再走一次本函数（头部 512B 可被垫长注释绕过）。
 * @param {Buffer|string} input - 文件起始字节，或全文文本（更可靠）。
 */
export function sniffSvg(input) {
  const text = (typeof input === 'string'
    ? input
    : Buffer.from(input.subarray(0, Math.min(input.length, 512))).toString('utf8')).trim()
  if (text.length < 5) return false
  if (!text.startsWith('<?xml') && !text.startsWith('<svg')) return false
  return !SVG_DANGER_RE.test(text)
}
