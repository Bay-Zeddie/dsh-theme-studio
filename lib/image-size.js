/**
 * 从图片头部解析固有尺寸（不解码像素），让 UI 能标出"原图 3840×2160"。
 * 从 store.js 拆出，行为不变；store 侧 re-export 保持契约。
 */

/**
 * @param {Buffer} head - 至少 64 字节，JPEG 建议 64KB。
 * @param {string} mime
 * @returns {{width?:number,height?:number}|null}
 */
export function readImageSize(head, mime) {
  const dv = bufferView(head)
  if (!dv) return null
  switch (mime) {
    case 'image/png':
      if (head.length >= 24) return { width: dv.getUint32(16, false), height: dv.getUint32(20, false) }
      return null
    case 'image/gif':
      if (head.length >= 10) return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) }
      return null
    case 'image/bmp':
      if (head.length >= 26) return { width: Math.abs(dv.getInt32(18, true)), height: Math.abs(dv.getInt32(22, true)) }
      return null
    case 'image/jpeg':
      return jpegSize(head)
    case 'image/webp':
      return webpSize(head)
    default:
      return null
  }
}

function bufferView(buf) {
  if (buf.buffer && buf.byteLength !== undefined) {
    return new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  return null
}

function jpegSize(buf) {
  const dv = bufferView(buf)
  if (!dv) return null
  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buf[offset + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = dv.getUint16(offset + 2, false)
    // SOF0..SOF15，跳过 DHT/JPGL/ DAC 等
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: dv.getUint16(offset + 5, false), width: dv.getUint16(offset + 7, false) }
    }
    offset += 2 + length
  }
  return null
}

function webpSize(buf) {
  const dv = bufferView(buf)
  if (!dv || buf.length < 30) return null
  const chunk = Buffer.from(buf.subarray(12, 16)).toString('latin1')
  if (chunk === 'VP8X') {
    return {
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    }
  }
  if (chunk === 'VP8L') {
    const bits = dv.getUint32(21, true)
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }
  }
  if (chunk === 'VP8 ') {
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
  }
  return null
}
