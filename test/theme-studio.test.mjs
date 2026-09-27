/**
 * dsh-theme-studio 自测：起一个真实的 node:http 服务，走完
 * "上传 → 原样回读 → Range 切片 → 状态持久化 → 冲突/鉴权/去重" 全链路。
 *
 * 这一层刻意不依赖 Cordis：插件的 Host 半只是把同一个 handler 挂到 ctx.webServer 上，
 * 所以在这里验证过的行为，就等于在宿主里验证过。
 *
 * 跑法：  node --test test/
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ThemeStore } from '../lib/store.js'
import { PREFIX, apply as hostApply, bootInjections } from '../index.js'
import { createThemeStudioHttp } from '../lib/http.js'
import { buildBootCss, buildCss, buildTokenLayers, contrastRatio, fontFamilyFor, gradientCss, isSafeTokenName, mediaUrl, normalizeDoc, paletteFromAccent, parseColor, prefersLightText, rgba, rgbToHsl, sanitizeCssValue, toHex, withAlpha, applyPreset, GLASS_SURFACES, GRADIENTS, PRESETS, SHAPE_TOKENS, TOKEN_GROUPS } from '../lib/engine.js'

/** 最小合法 PNG 头（8×8），只用于魔数与 IHDR 尺寸解析。 */
function png8x8(extra = 0) {
  const head = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0)
  head.writeUInt32BE(13, 8)
  head.write('IHDR', 12, 'ascii')
  head.writeUInt32BE(8, 16)
  head.writeUInt32BE(8, 20)
  head[24] = 8
  head[25] = 6
  return Buffer.concat([head, Buffer.alloc(extra)])
}

function webm(bytes = 4096) {
  const head = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f, 0x4d, 0x9b, 0x74])
  return Buffer.concat([head, Buffer.alloc(bytes - head.length, 0x42)])
}

describe('theme-studio 全链路', () => {
  /** @type {{url:string, close:()=>Promise<void>}} */
  let server
  /** @type {ThemeStore} */
  let store
  let root

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dts-test-'))
    store = new ThemeStore({ root, maxUploadBytes: 64 * 1024 })
    await store.init()
    const http = createThemeStudioHttp({ store })
    const node = createServer((req, res) => { void http.handle(req, res) })
    await new Promise((resolve) => node.listen(0, '127.0.0.1', resolve))
    server = {
      url: `http://127.0.0.1:${String(node.address().port)}`,
      close: () => new Promise((resolve) => node.close(resolve)),
    }
  })

  after(async () => {
    await server.close()
    await rm(root, { recursive: true, force: true })
  })

  const api = (path, init) => fetch(`${server.url}${path}`, init)
  const keyHeaders = () => ({ 'x-dts-key': store.writeToken })

  it('GET /api/state 返回文档与预设；写口令只回显给持口令方（M1）', async () => {
    const body = await (await api('/dsh-theme-studio/api/state')).json()
    assert.equal(body.ok, true)
    assert.equal(body.value.writeToken, undefined, '被动 GET 不下发写口令（curl 无同源约束）')
    const holder = await (await api('/dsh-theme-studio/api/state', { headers: keyHeaders() })).json()
    assert.equal(holder.value.writeToken, store.writeToken, '持口令方仍可自证取回')
    assert.equal(body.value.doc.base.scheme, 'system')
    assert.ok(Array.isArray(body.value.presets) && body.value.presets.length > 5)
  })

  it('未带写口令的写入被拒', async () => {
    const res = await api('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ doc: { base: { fontSize: 16 } } }),
    })
    assert.equal(res.status, 401)
  })

  it('错误写口令被拒（403）', async () => {
    const res = await api('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-dts-key': 'wrong' },
      body: JSON.stringify({ doc: {} }),
    })
    assert.equal(res.status, 403)
  })

  it('PUT /api/state 保存并钳制越界值', async () => {
    const res = await api('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ doc: { base: { fontSize: 999, scheme: 'neon' }, backdrop: { blur: 10_000 } } }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.value.doc.base.fontSize, 17)
    assert.equal(body.value.doc.base.scheme, 'system')
    assert.equal(body.value.doc.backdrop.blur, 40)
  })

  it('revision 单调递增，陈旧 revision 触发 409', async () => {
    const before2 = store.state.revision
    const ok = await api('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ doc: store.state.doc, expectRevision: before2 }),
    })
    assert.equal(ok.status, 200)
    const stale = await api('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ doc: store.state.doc, expectRevision: before2 }),
    })
    assert.equal(stale.status, 409)
  })

  it('上传 PNG：按魔数识别类型并解出原始尺寸', async () => {
    const res = await api('/dsh-theme-studio/api/media?name=%E5%A3%81%E7%BA%B8.png', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', ...keyHeaders() },
      body: png8x8(200),
    })
    assert.equal(res.status, 201)
    const body = await res.json()
    assert.equal(body.value.media.mime, 'image/png')
    assert.equal(body.value.media.width, 8)
    assert.equal(body.value.media.height, 8)
    assert.equal(body.value.media.name, '壁纸.png')
    assert.match(body.value.url, /^\/dsh-theme-studio\/media\//)
  })

  it('伪装扩展名的非白名单文件被拒（415），且不留下半截文件', async () => {
    const before = store.listMedia().length
    const res = await api('/dsh-theme-studio/api/media?name=evil.png', {
      method: 'POST',
      headers: keyHeaders(),
      body: Buffer.from('MZ\x90\x00 this is not an image at all, just a fake header bytes', 'utf8'),
    })
    assert.equal(res.status, 415)
    assert.equal(store.listMedia().length, before, '被拒的上传不能进素材索引')
    const entries = await readdir(join(root, 'media'))
    assert.ok(entries.every((name) => !name.startsWith('.upload-')), '临时文件必须被清理')
  })

  it('素材回读字节与上传字节逐字节相同（原画质）', async () => {
    const payload = png8x8(1024)
    const uploaded = await (await api('/dsh-theme-studio/api/media', {
      method: 'POST',
      headers: keyHeaders(),
      body: payload,
    })).json()
    const res = await api(uploaded.value.url)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.equal(res.headers.get('accept-ranges'), 'bytes')
    assert.match(res.headers.get('cache-control') ?? '', /immutable/)
    const got = Buffer.from(await res.arrayBuffer())
    assert.equal(got.length, payload.length)
    assert.ok(got.equals(payload), '素材字节必须与原始文件完全一致')
  })

  it('视频 Range 切片返回 206 且区间内容正确', async () => {
    const clip = webm(4096)
    const uploaded = await (await api('/dsh-theme-studio/api/media', {
      method: 'POST',
      headers: keyHeaders(),
      body: clip,
    })).json()
    const res = await api(uploaded.value.url, { headers: { range: 'bytes=100-199' } })
    assert.equal(res.status, 206)
    assert.equal(res.headers.get('content-range'), `bytes 100-199/${String(clip.length)}`)
    assert.equal(res.headers.get('content-length'), '100')
    assert.equal(res.headers.get('content-type'), 'video/webm')
    const slice = Buffer.from(await res.arrayBuffer())
    assert.ok(slice.equals(clip.subarray(100, 200)))
    const suffix = await api(uploaded.value.url, { headers: { range: 'bytes=-16' } })
    assert.equal(suffix.status, 206)
    assert.equal(suffix.headers.get('content-length'), '16')
    assert.equal(suffix.headers.get('content-range'), `bytes ${String(clip.length - 16)}-${String(clip.length - 1)}/${String(clip.length)}`)
    // 开区间：拖到结尾。
    const tail = await api(uploaded.value.url, { headers: { range: `bytes=${String(clip.length - 100)}-` } })
    assert.equal(tail.status, 206)
    assert.equal(tail.headers.get('content-length'), '100')
    // 多区间当前按整份返回（RFC 允许的降级），不能报错。
    const multi = await api(uploaded.value.url, { headers: { range: 'bytes=0-9,20-29' } })
    assert.equal(multi.status, 200)
    const bad = await api(uploaded.value.url, { headers: { range: `bytes=${String(clip.length + 10)}-` } })
    assert.equal(bad.status, 416)
  })

  it('HEAD 不返回 body，ETag 命中 304', async () => {
    const uploaded = await (await api('/dsh-theme-studio/api/media', {
      method: 'POST',
      headers: keyHeaders(),
      body: png8x8(64),
    })).json()
    const head = await api(uploaded.value.url, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(Number(head.headers.get('content-length')), 64 + 33)
    const etag = head.headers.get('etag')
    const revalidated = await api(uploaded.value.url, { headers: { 'if-none-match': etag ?? '' } })
    assert.equal(revalidated.status, 304)
  })

  it('相同内容去重到同一素材 id', async () => {
    const a = await (await api('/dsh-theme-studio/api/media', { method: 'POST', headers: keyHeaders(), body: png8x8(128) })).json()
    const b = await (await api('/dsh-theme-studio/api/media', { method: 'POST', headers: keyHeaders(), body: png8x8(128) })).json()
    assert.equal(a.value.media.id, b.value.media.id)
  })

  it('被引用的素材默认拒绝删除，force 可删', async () => {
    const uploaded = await (await api('/dsh-theme-studio/api/media', { method: 'POST', headers: keyHeaders(), body: png8x8(90) })).json()
    const id = uploaded.value.media.id
    await api('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ doc: { ...store.state.doc, backdrop: { ...store.state.doc.backdrop, mode: 'image', mediaId: id } } }),
    })
    const refused = await api(`/dsh-theme-studio/api/media/${encodeURIComponent(id)}`, { method: 'DELETE', headers: keyHeaders() })
    assert.equal(refused.status, 409)
    const forced = await api(`/dsh-theme-studio/api/media/${encodeURIComponent(id)}?force=1`, { method: 'DELETE', headers: keyHeaders() })
    assert.equal(forced.status, 200)
    const gone = await api(uploaded.value.url)
    assert.equal(gone.status, 404)
  })

  it('导出/导入主题 JSON 往返一致', async () => {
    await api('/dsh-theme-studio/api/preset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ id: 'aurora' }),
    })
    const text = await (await api('/dsh-theme-studio/api/export')).text()
    const exported = JSON.parse(text)
    assert.equal(exported.kind, 'dsh-theme-studio')
    const imported = await (await api('/dsh-theme-studio/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ doc: exported.doc }),
    })).json()
    assert.equal(Object.keys(imported.value.doc.palette.tokens).length > 0, true, '导入后应带回令牌')
    // 投影契约：浏览器半靠这几个字段落地，缺一不可。
    assert.equal(typeof imported.value.css, 'string')
    assert.match(imported.value.css, /--dsw|dts-layer|superellipse/)
    assert.ok(Array.isArray(imported.value.glassSurfaces) && imported.value.glassSurfaces.length > 0)
    // 预设写全了深浅两侧，所以这里的投影不该有缺值；
    // 真实用户手写可能只给一侧，那是设计允许的空缺，由浏览器半补齐。
    for (const [name, pair] of Object.entries(imported.value.tokenLayers)) {
      assert.ok(typeof pair.light === 'string' && typeof pair.dark === 'string', `${name} 令牌层形状不对`)
      assert.ok(pair.light !== '' && pair.dark !== '', `预设令牌 ${name} 不该留空侧`)
    }
  })

  it('主题档（方案）：命名消毒、元信息列表、应用换档、删除与 404/401', async () => {
    const saved = await (await api('/dsh-theme-studio/api/themes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ name: '午夜深蓝 ../../evil' }),
    })).json()
    // 路径分隔符必须被吃掉（落进 themesDir 靠 readdir 自证）；中文原样保留。
    assert.ok(!saved.value.slug.includes('/') && !saved.value.slug.includes('\\'), saved.value.slug)
    assert.match(saved.value.slug, /午夜深蓝/)
    const list = await (await api('/dsh-theme-studio/api/themes')).json()
    const row = list.value.themes.find((t) => t.slug === saved.value.slug)
    assert.ok(row, '列表应能找回这条方案')
    assert.equal(typeof row.exportedAt, 'number')
    assert.equal(typeof row.mode, 'string')
    assert.ok(!('file' in row), '列表不再外泄服务器绝对路径')

    const before = (await (await api('/dsh-theme-studio/api/state')).json()).value.revision
    const loaded = await api('/dsh-theme-studio/api/themes/load', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ slug: saved.value.slug }),
    })
    assert.equal(loaded.status, 200)
    const loadedBody = await loaded.json()
    assert.ok(loadedBody.value.revision > before, '应用方案要真的换掉活文档')

    const del = await api('/dsh-theme-studio/api/themes/' + encodeURIComponent(saved.value.slug), {
      method: 'DELETE', headers: keyHeaders(),
    })
    assert.equal(del.status, 200)
    const again = await api('/dsh-theme-studio/api/themes/' + encodeURIComponent(saved.value.slug), {
      method: 'DELETE', headers: keyHeaders(),
    })
    assert.equal(again.status, 404, '重复删除必须 404')
    const noKey = await api('/dsh-theme-studio/api/themes/whatever', { method: 'DELETE' })
    assert.ok(noKey.status === 401 || noKey.status === 403, '删除需要写口令')
  })

  it('路径穿越素材名被拒', async () => {
    const res = await api('/dsh-theme-studio/media/..%2f..%2fstate.json')
    assert.ok(res.status === 404 || res.status === 400)
  })

  it('未知路由 404 而不是 SPA 的 HTML', async () => {
    const res = await api('/dsh-theme-studio/api/nope')
    assert.equal(res.status, 404)
    assert.match(res.headers.get('content-type') ?? '', /application\/json/)
  })

  it('state.json 落盘可被重启后的新实例读回', async () => {
    const reopened = new ThemeStore({ root })
    await reopened.init()
    assert.equal(reopened.state.revision, store.state.revision)
    assert.deepEqual(reopened.state.doc, store.state.doc)
    assert.ok(Object.keys(reopened.state.media).length > 0)
  })
})

describe('主题引擎', () => {
  it('normalizeDoc 对垃圾输入返回安全默认', () => {
    for (const junk of [null, undefined, 'x', 42, [], { backdrop: { blur: 'NaN' } }]) {
      const doc = normalizeDoc(junk)
      assert.equal(doc.backdrop.mode, 'none')
      assert.equal(doc.base.fontSize, 14)
      assert.ok(Number.isFinite(doc.backdrop.blur))
    }
  })

  it('越界值被钳制而不是原样入库', () => {
    const doc = normalizeDoc({
      base: { fontSize: 999, scheme: 'neon' },
      backdrop: { blur: 10_000, dim: 5, mode: 'hacked', veilColor: 'not-a-color', parallax: -50 },
      glass: { alpha: 42 },
      shape: { cornerShape: 99 },
    })
    assert.equal(doc.base.fontSize, 17)
    assert.equal(doc.base.scheme, 'system')
    assert.equal(doc.backdrop.blur, 40)
    assert.equal(doc.backdrop.dim, 0.95)
    assert.equal(doc.backdrop.mode, 'none')
    assert.equal(doc.backdrop.veilColor, '#000000')
    assert.equal(doc.backdrop.parallax, 0)
    assert.equal(doc.glass.alpha, 1)
    assert.equal(doc.shape.cornerShape, 3)
  })

  it('令牌层永远成对：单侧缺值先取基准值，再退到另一侧', () => {
    const doc = normalizeDoc({ palette: { tokens: { '--dsw-alias-bg-base': { light: '#010203', dark: '' } } } })
    const pairs = buildTokenLayers(doc, { probe: () => '#abcdef' })
    for (const value of Object.values(pairs)) {
      assert.notEqual(value.light, '', '不允许把空串交给宿主')
      assert.notEqual(value.dark, '', '不允许把空串交给宿主')
    }
    assert.equal(pairs['--dsw-alias-bg-base'].light, '#010203')
    assert.equal(pairs['--dsw-alias-bg-base'].dark, '#abcdef')
    // 没有 probe 时**留空**而不是镜像：Host 看不见页面基准值，
    // 镜像会把"只改了浅色"的编辑冒充成深色值。收口交给浏览器半。
    const deferred = buildTokenLayers(doc)
    assert.equal(deferred['--dsw-alias-bg-base'].light, '#010203')
    assert.equal(deferred['--dsw-alias-bg-base'].dark, '')
  })

  it('裸字符串令牌两侧同值', () => {
    const doc = normalizeDoc({ palette: { tokens: { '--dsw-alias-border-l1': '#ff0000' } } })
    const pair = doc.palette.tokens['--dsw-alias-border-l1']
    assert.deepEqual(pair, { light: '#ff0000', dark: '#ff0000' })
  })

  it('拒绝把脚本与逃逸塞进 style：非法令牌名、<>、伪协议都不落地', () => {
    const doc = normalizeDoc({
      palette: {
        tokens: {
          '--evil': '#fff',
          '--dsw-alias-bg-base': 'red;</style><script>alert(1)</script>',
          '--dsw-alias-link': 'url(javascript:alert(1))',
          '--dsw-alias-border-l1': 'expression(alert(1))',
          '--dsw-alias-bg-overlay': 'url(https://evil.example/x.png)',
          '--dsw-specific-menu': '#101418',
        },
      },
      advanced: { css: 'x'.repeat(500_000) },
    })
    assert.equal(doc.palette.tokens['--evil'], undefined)
    assert.equal(doc.palette.tokens['--dsw-alias-bg-base'], undefined)
    assert.equal(doc.palette.tokens['--dsw-alias-link'], undefined)
    assert.equal(doc.palette.tokens['--dsw-alias-border-l1'], undefined)
    assert.equal(doc.palette.tokens['--dsw-alias-bg-overlay'], undefined)
    assert.equal(doc.palette.tokens['--dsw-specific-menu'].light, '#101418')
    assert.ok(doc.advanced.css.length <= 200_000, '自定义 CSS 有长度上限')
    const pairs = buildTokenLayers(doc)
    assert.equal(pairs['--dsw-alias-bg-base'], undefined)
  })

  it('同源 url() 允许，外域与伪协议拒绝', () => {
    assert.equal(sanitizeCssValue('url(/dsh-theme-studio/media/a.png/)'), 'url(/dsh-theme-studio/media/a.png/)')
    assert.equal(sanitizeCssValue('url("https://evil.example/a.png")'), '')
    assert.equal(sanitizeCssValue('url("data:image/svg+xml,<svg/>")'), '')
  })

  it('令牌名白名单只收宿主在用的三套前缀', () => {
    assert.equal(isSafeTokenName('--dsw-alias-bg-base'), true)
    assert.equal(isSafeTokenName('--ds-font-family-code'), true)
    assert.equal(isSafeTokenName('--dsh-content-font-size'), true)
    assert.equal(isSafeTokenName('--chat-content'), false)
    assert.equal(isSafeTokenName('--dsw-alias-bg base'), false)
    assert.equal(isSafeTokenName('dsw-alias'), false)
  })

  it('CSS 生成：无背景时不产出 .dts-layer 规则', () => {
    const css = buildCss(normalizeDoc({}))
    assert.equal(css.includes('.dts-layer'), false)
  })

  it('CSS 生成：图片背景带滤镜、遮罩与定位', () => {
    const doc = normalizeDoc({
      backdrop: { mode: 'image', mediaId: 'a.png', blur: 6, brightness: 90, dim: 0.4, focusX: 30, focusY: 70, scale: 1.4 },
    })
    const css = buildCss(doc, { mediaUrlFor: (id) => `/m/${id}` })
    assert.match(css, /url\("\/m\/a\.png"\)/)
    assert.match(css, /blur\(6px\)/)
    assert.match(css, /brightness\(90%\)/)
    assert.match(css, /background-position: 30% 70%/)
    assert.match(css, /linear-gradient\(180deg,/)
    // 画布不透明就把壁纸挡死，这一条是背景可见的前提。
    assert.match(css, /background-color:\s*transparent\s*!important/)
    // 层定位必须随背景样式同源产出：不依赖首屏注入，才是"点了设为背景立即生效"的前提。
    assert.match(css, /\.dts-layer\s*\{[^}]*position:\s*fixed/, '完整 CSS 应自带层定位（否则浏览器侧点亮时层是零尺寸 div）')
    assert.match(css, /#root\s*\{\s*position:\s*relative/, '#root 需抬到背景层之上')
  })

  it('平铺模式按原始像素重复，不做任何缩放', () => {
    const doc = normalizeDoc({ backdrop: { mode: 'image', mediaId: 'a.png', tile: true, scale: 3 } })
    const css = buildCss(doc, { mediaUrlFor: (id) => `/m/${id}` })
    assert.match(css, /background-size: auto/)
    assert.match(css, /background-repeat: repeat/)
    assert.match(css, /background-position: 0% 0%/)
  })

  it('Ken Burns 只在开启时注入 keyframes', () => {
    assert.equal(buildCss(normalizeDoc({ backdrop: { mode: 'gradient', kenBurns: true } })).includes('@keyframes dts-kenburns'), true)
    assert.equal(buildCss(normalizeDoc({ backdrop: { mode: 'gradient' } })).includes('@keyframes dts-kenburns'), false)
  })

  it('@font-face 只给确实存在的字体素材生成', () => {
    const doc = normalizeDoc({ type: { families: [{ id: 'f1.woff2', family: 'DTS-f1', weight: 700, style: 'normal' }] } })
    assert.equal(buildCss(doc).includes('@font-face'), false, '素材缺失时不能留下死引用')
    const withFont = buildCss(doc, {
      media: { 'f1.woff2': { id: 'f1.woff2', kind: 'font', mime: 'font/woff2' } },
      mediaUrlFor: (id) => `/m/${id}`,
    })
    assert.match(withFont, /@font-face/)
    assert.match(withFont, /font-family: "DTS-f1"/)
    assert.match(withFont, /format\("woff2"\)/)
    assert.match(withFont, /url\("\/m\/f1\.woff2"\)/)
  })

  it('首屏 CSS：无背景时彻底留空，有背景时自带定位与透明画布', () => {
    assert.equal(buildBootCss(normalizeDoc({})), '')
    const boot = buildBootCss(normalizeDoc({ backdrop: { mode: 'image', mediaId: 'a.png', focusX: 20, focusY: 80, blur: 3 } }), {
      mediaUrlFor: (id) => `/m/${id}`,
    })
    assert.match(boot, /\.dts-layer\{position:fixed/)
    assert.match(boot, /url\("\/m\/a\.png"\)/)
    assert.match(boot, /background-position:20% 80%/)
    assert.match(boot, /filter:blur\(3px\)/)
    assert.match(boot, /html,body\{background-color:transparent!important\}/)
  })

  it('每个预设都产出双模式、可解析的颜色', () => {
    for (const preset of PRESETS) {
      const doc = applyPreset(normalizeDoc({}), preset.id)
      const pairs = buildTokenLayers(doc)
      for (const [name, value] of Object.entries(pairs)) {
        for (const scheme of ['light', 'dark']) {
          assert.notEqual(value[scheme], '', `${preset.id}/${name}/${scheme} 不能为空`)
          // rgba() 走 var() 之外的分支，两种形态都算合法 CSS 值。
          const parsed = parseColor(value[scheme])
          assert.ok(parsed !== null || /^var\(|^superellipse|^blur|^linear-gradient|^[0-9.]+s$|^[0-9.]+px$|,/.test(value[scheme]),
            `${preset.id}/${name}/${scheme} 不是合法 CSS 值：${value[scheme]}`)
        }
      }
    }
  })

  it('强调色派生不覆盖用户手写的令牌', () => {
    const doc = normalizeDoc({
      palette: {
        accent: '#ff0000',
        autoAccent: true,
        tokens: { '--dsw-alias-link': { light: '#123456', dark: '#654321' } },
      },
    })
    const pairs = buildTokenLayers(doc)
    assert.equal(pairs['--dsw-alias-link'].light, '#123456')
    assert.notEqual(pairs['--dsw-alias-brand-primary'].light, '#123456')
    // autoAccent 关掉后，派生令牌整体消失，只留手写的。
    const off = buildTokenLayers(normalizeDoc({ ...doc, palette: { ...doc.palette, autoAccent: false } }))
    assert.equal(off['--dsw-alias-brand-primary'], undefined)
    assert.equal(off['--dsw-alias-link'].light, '#123456')
  })

  it('默认文档的令牌层：圆角 + **无条件清零** MenuSurface 填充（零自选色，本轮恢复）', () => {
    const pairs = buildTokenLayers(normalizeDoc({}))
    /* ★ 本轮恢复（主人复测判定阶段 C/D 的"不再清零"为误判，原话「零自选色，零压暗」）：
       口径是颜色**全部**交还壁纸、玻璃只负责磨砂。于是 `--dsw-menu-surface-fill` 必须
       **无条件**清零 —— 它与 chrome.ts 的 --dts-glass-fill:transparent 是同一件事的两半；
       只恢复一半就会出现"我们自己的面全透明、宿主 MenuSurface 仍是半透明中性填充"的
       分叉（那正是主人说的"原本的设定缺失"）。
       代价（主人知情并选择）：blur() 成为**唯一**承担"看不清底字"的机制 —— 所以三处保障
       必须都在（遮罩不带 bf / 输入卡糊搬进 ::before / role=dialog 显式带糊），见 chrome.ts。 */
    assert.deepEqual(Object.keys(pairs).sort(),
      ['--dsw-corner-shape', '--dsw-menu-surface-fill'],
      '默认文档 = 圆角 + 无条件清零 MenuSurface 填充')
    assert.equal(pairs['--dsw-corner-shape'].light, 'superellipse(1.5)')
    assert.equal(pairs['--dsw-menu-surface-fill'].light, 'transparent',
      '零自选色：宿主 MenuSurface 填充必须清零（颜色全部来自壁纸）')
    assert.equal(pairs['--dsw-menu-surface-fill'].dark, 'transparent', '明暗两侧同值')
    // 开关关掉 / 没开背景时**也必须**清零：否则 MenuSurface 退回宿主不透明填充，
    // 弹层又变成一块与壁纸无关的实色板（主人多轮要求消除的东西）。
    const off = buildTokenLayers(normalizeDoc({ glass: { enabled: false }, backdrop: { mode: 'none' } }))
    assert.equal(off['--dsw-menu-surface-fill'].light, 'transparent',
      '清零是无条件的，不许挂在 glass 开关或背景模式上')
  })

  it('宿主弹层：兜底通道恢复 —— 清底与给糊绑在一起，模糊只走 --dsw-menu-backdrop-filter', () => {
    // ⚠️ 必须带上 backdrop.mode：模糊令牌的重铸条件与 composeGlass 同源
    //    （`glass.enabled && backdrop.mode !== 'none'`）—— 没开背景时重铸模糊没有意义，
    //    那条兜底选择器当年正是因为"没开背景也给宿主挂 50px 模糊"才被删掉的。
    const doc = normalizeDoc({
      glass: { enabled: true, alpha: 0.5, blur: 24, saturate: 180 },
      backdrop: { mode: 'image', fadeOnFocus: true },
    })
    const pairs = buildTokenLayers(doc)
    assert.equal(pairs['--dsw-menu-backdrop-filter'].light, 'blur(24px) saturate(180%)',
      '玻璃开关开着时模糊公式走令牌重铸（唯一合法来源）')
    assert.equal(pairs['--dsw-menu-backdrop-filter'].dark, 'blur(24px) saturate(180%)',
      '明暗两侧同值（模糊不是配色）')
    // 反向闸：没开背景时**不许**写这个令牌（否则等于给宿主挂模糊，正是被删掉的兜底）。
    const off = buildTokenLayers(normalizeDoc({ glass: { enabled: true, alpha: 0.5 } }))
    assert.equal(off['--dsw-menu-backdrop-filter'], undefined,
      '未开背景时不许重铸模糊令牌')
    const css = buildCss(doc)
    /* ★ 本轮恢复：兜底通道回来了 —— 清底**必须**与给糊同时出现，否则"全透明 + 零模糊"
       比原来的实色板更糟（背后正文直接穿透且没有任何模糊）。 */
    assert.match(css, /\[role="menu"\], \[role="listbox"\], \[role="dialog"\], \[role="tooltip"\]/,
      '兜底必须覆盖 role=menu/listbox/dialog/tooltip（官方材料层够不到 dialog/tooltip）')
    assert.match(css, /background: transparent !important/,
      '零自选色：兜底必须把宿主底色清成 transparent')
    assert.match(css, /backdrop-filter: var\(--dsw-menu-backdrop-filter\) !important/,
      '给糊必须走令牌，不许写字面 blur(Npx)')
    assert.doesNotMatch(css, /blur\(/, '引擎 CSS 里不许出现字面 blur()（模糊归令牌）')
    assert.ok(css.indexOf('menuAnchor') !== -1,
      'menuAnchor 自伤补丁必须与兜底同时在场（子串匹配会打到 AgentPresetSeat 包裹层）')
    assert.ok(css.indexOf('class*=') !== -1, '兜底选择器照搬副本（子串形态）')
    // 聚焦淡出：作用域恢复成并集（宿主输入框 + 自家面板），见 engine.js 该处注释。
    assert.ok(css.indexOf('body:has(textarea') !== -1, '聚焦淡出恢复读宿主输入框（改造前语义）')
    assert.ok(css.indexOf('.dts-page') !== -1 || css.indexOf('.dts-layer') !== -1,
      '自家选择器仍在（别把整份 CSS 删空）')
  })

  it('字体与动效经令牌层落地，且两侧同值', () => {
    const doc = normalizeDoc({
      type: { uiFont: 'Consolas, monospace', codeFont: "'JetBrains Mono', monospace" },
      shape: { motionSpeed: 2, scrollbar: 'slim' },
    })
    const pairs = buildTokenLayers(doc)
    // SHAPE_TOKENS 是面板与引擎的共用映射表，名字必须就是宿主在用的那几个。
    assert.equal(SHAPE_TOKENS.fontFamily, '--dsw-font-family')
    assert.equal(pairs[SHAPE_TOKENS.fontFamily].light, 'Consolas, monospace')
    assert.equal(pairs[SHAPE_TOKENS.codeFontFamily].dark, "'JetBrains Mono', monospace")
    assert.equal(pairs[SHAPE_TOKENS.duration].light, '0.4s')
    assert.equal(pairs[SHAPE_TOKENS.durationFast].light, '0.2s')
    assert.equal(pairs[SHAPE_TOKENS.scrollbarWidth].light, '3px')
  })

  it('内置渐变表可直接渲染，未知名字退回默认而不是产出坏 CSS', () => {
    const css = gradientCss('aurora')
    assert.match(css, /^linear-gradient\(\d+deg, #/)
    assert.ok(Object.keys(GRADIENTS).length >= 8)
    assert.equal(gradientCss('nope'), gradientCss('midnight'))
  })

  it('坏字体栈被拒绝，好字体栈通过', () => {
    assert.equal(normalizeDoc({ type: { uiFont: '</style><img>' } }).type.uiFont, '')
    assert.equal(normalizeDoc({ type: { uiFont: "url(/x)" } }).type.uiFont, '')
    assert.equal(normalizeDoc({ type: { uiFont: "'Noto Sans SC', sans-serif" } }).type.uiFont, "'Noto Sans SC', sans-serif")
  })

  it('paletteFromAccent 的深底浅字与亮底深字方向正确', () => {
    const palette = paletteFromAccent('#4176e6')
    const lightness = (value) => rgbToHsl(parseColor(value) ?? { r: 0, g: 0, b: 0 }).l
    assert.ok(lightness(palette['--dsw-alias-bg-base'].dark) < 20, '深色底要真的深')
    assert.ok(lightness(palette['--dsw-alias-bg-base'].light) > 90, '浅色底要真的浅')
    assert.ok(lightness(palette['--dsw-alias-label-primary'].dark) > 80, '深色主题文字要亮')
    assert.ok(lightness(palette['--dsw-alias-label-primary'].light) < 20, '浅色主题文字要暗')
    assert.ok(contrastRatio(palette['--dsw-alias-bg-base'].light, palette['--dsw-alias-label-primary'].light) >= 7,
      '浅色预设正文要达到 AAA')
    assert.ok(contrastRatio(palette['--dsw-alias-bg-base'].dark, palette['--dsw-alias-label-primary'].dark) >= 7,
      '深色预设正文要达到 AAA')
  })

  it('面板暴露的令牌名全部合法且无重复', () => {
    const seen = new Set()
    for (const group of TOKEN_GROUPS) {
      for (const token of group.tokens) {
        assert.equal(isSafeTokenName(token.name), true, token.name)
        assert.ok(!seen.has(token.name), `同一令牌不该出现在两个分组：${token.name}`)
        seen.add(token.name)
      }
    }
    assert.ok(TOKEN_GROUPS.length >= 5)
    for (const name of GLASS_SURFACES) assert.equal(isSafeTokenName(name), true, name)
  })

  it('素材地址带原名且做转义', () => {
    assert.equal(mediaUrl({ id: 'a.png', name: 'wall.png' }), '/dsh-theme-studio/media/a.png/wall.png')
    assert.equal(
      mediaUrl({ id: 'a b.png', name: '夜 景.png' }, '/p'),
      '/p/media/a%20b.png/' + encodeURIComponent('夜 景.png'),
    )
  })

  it('颜色工具链自洽', () => {
    assert.equal(toHex({ r: 255, g: 106, b: 61 }), '#ff6a3d')
    assert.equal(rgba({ r: 10, g: 12, b: 18 }, 0.6), 'rgba(10, 12, 18, 0.6)')
    assert.equal(withAlpha('#0a0c12', 0.5), 'rgba(10, 12, 18, 0.5)')
    assert.equal(contrastRatio('#000000', '#ffffff'), 21)
    assert.equal(contrastRatio('#777777', '#777777'), 1)
    assert.equal(prefersLightText('#0a0c12'), 1)
    assert.equal(prefersLightText('#ffffff'), 0)
    assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 })
    assert.equal(parseColor('nonsense'), null)
    assert.equal(fontFamilyFor({ id: 'abcdef123456789.png' }), 'DTS-abcdef12')
  })
})

after(() => {
  // 收尾排干连接池：fetch/http 的 keep-alive 连接会让 close 悬挂，
  // --test-force-exit 强杀与句柄关闭赛跑，Windows 上撞 libuv 的
  // UV_HANDLE_CLOSING 断言（文件被误标失败，用例本身全绿）。
  // 直接销毁所有指向远端的存活 socket —— stdout/stderr/IPC 没有
  // remoteAddress，不会误伤。
  for (const handle of process._getActiveHandles()) {
    if (handle?.constructor?.name === 'Socket'
      && typeof handle.remoteAddress === 'string' && handle.remoteAddress !== ''
      && typeof handle.destroy === 'function') {
      handle.destroy()
    }
  }
})
