/**
 * 修复回归锁：每条锁对应审计报告里一个已实证/确凿的缺陷，防止再犯。
 *   A  原型链键打穿字典 → 全接口持久化 500
 *   B  编辑流不带 expectRevision → 双标签页静默覆盖（client 面锁在 client.test.mjs）
 *   C  SVG 头部嗅探绕过 → 同源 XSS
 *   D  无 Host/Origin 闸 → DNS rebinding 打穿写口令模型
 *   E  CSS 清洗先校验后去反斜杠 / 协议相对 url()
 *   F  放大倍率被遮罩层吃掉（background-size 值列表层序错位）
 *   G  字体素材删除保护失效（type.fonts 与 type.families 字段错位）
 *   H  usage 外泄服务器绝对路径
 *
 * 跑法： node --test test/regression.test.mjs
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ThemeStore, sniffSvg } from '../lib/store.js'
import { createThemeStudioHttp } from '../lib/http.js'
import { normalizeDoc, buildCss, buildBootCss, gradientCss, sanitizeCssValue, GLASS_SURFACES, TOKEN_GROUPS } from '../lib/engine.js'

describe('回归锁 A · 原型链键不可再打穿字典', () => {
  it("gradient='constructor'/'__proto__' 等原型键被重置，CSS 生成不炸（曾致全接口持久化 500）", () => {
    for (const evil of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      const doc = normalizeDoc({ backdrop: { mode: 'gradient', gradient: evil } })
      assert.equal(doc.backdrop.gradient, 'midnight', `${evil} 必须被重置`)
      assert.doesNotThrow(() => buildCss(doc))
      assert.doesNotThrow(() => buildBootCss(normalizeDoc({ backdrop: { mode: 'image', mediaId: '', gradient: evil } })))
    }
    assert.equal(gradientCss('constructor'), gradientCss('midnight'))
    assert.match(gradientCss('aurora'), /^linear-gradient\(\d+deg, #/)
  })

  it('深合并丢弃 __proto__/constructor/prototype，文档原型不被改写', () => {
    const evil = JSON.parse('{"__proto__": {"backdrop": {"mode": "video"}}, "constructor": 1}')
    const doc = normalizeDoc(evil)
    assert.equal(Object.getPrototypeOf(doc), Object.prototype, '原型被用户 JSON 改写了')
    assert.equal(Object.hasOwn(doc, '__proto__'), false)
    assert.equal(doc.backdrop.mode, 'none')
  })
})

describe('回归锁 E · CSS 清洗顺序与 url 白名单', () => {
  it('反斜杠形变不再复活伪协议（曾绕过 expression()/javascript: 检查）', () => {
    assert.equal(sanitizeCssValue('expr\\ession(alert(1))'), '')
    assert.equal(sanitizeCssValue('ja\\vaScript:alert(1)'), '')
    assert.equal(sanitizeCssValue('expr\\ession\\(alert(1)\\)'), '')
  })

  it('协议相对 URL 被拒（曾穿过"只允许同源绝对路径"），同源绝对路径照常放行', () => {
    assert.equal(sanitizeCssValue('url(//evil.example/track.png)'), '')
    assert.equal(sanitizeCssValue('url("/dsh-theme-studio/media/a.png/")'), 'url("/dsh-theme-studio/media/a.png/")')
  })
})

describe('回归锁 F · 铺法与放大倍率各归其位', () => {
  /** 只取背景图层的声明块（.dts-video 的 transform 是另一条链，不进断言）。 */
  const cssLayerOf = (css) => /\.dts-layer--css \{[^}]*\}/.exec(css)[0]

  it('遮罩在场时放大倍率落图层本体（transform），铺法给 background-size 关键字', () => {
    const css = buildCss(normalizeDoc({
      backdrop: { mode: 'image', mediaId: 'a.png', dim: 0.4, scale: 1.4, fit: 'cover' },
    }), { mediaUrlFor: (id) => `/m/${id}` })
    const layer = cssLayerOf(css)
    assert.match(layer, /transform: scale\(1\.4\)/, '放大倍率必须作用到图层本体')
    assert.match(layer, /background-size: cover/)

    const contain = cssLayerOf(buildCss(normalizeDoc({
      backdrop: { mode: 'image', mediaId: 'a.png', dim: 0.4, scale: 2, fit: 'contain' },
    }), { mediaUrlFor: (id) => `/m/${id}` }))
    assert.match(contain, /background-size: contain/)
    assert.match(contain, /transform: scale\(2\)/)
  })

  it('平铺模式保持原始像素不缩放；推拉动画在平铺下跳过', () => {
    const css = buildCss(normalizeDoc({
      backdrop: { mode: 'image', mediaId: 'a.png', tile: true, scale: 3, kenBurns: true },
    }), { mediaUrlFor: (id) => `/m/${id}` })
    const layer = cssLayerOf(css)
    assert.match(layer, /background-size: auto/)
    assert.doesNotMatch(layer, /transform/)
    assert.doesNotMatch(css, /@keyframes dts-kenburns/)
  })

  it('推拉动 transform 与放大倍率同一条属性链', () => {
    const css = buildCss(normalizeDoc({
      backdrop: { mode: 'gradient', kenBurns: true, kenBurnsSeconds: 40, scale: 1 },
    }), {})
    assert.match(css, /@keyframes dts-kenburns \{\n {2}from \{ transform: scale\(1\); \}/)
    assert.match(css, /to \{ transform: scale\(1\.12\); \}/)
  })

  it('首屏注入与完整 CSS 同源同义', () => {
    const doc = normalizeDoc({ backdrop: { mode: 'image', mediaId: 'a.png', scale: 1.25 } })
    const boot = buildBootCss(doc, { mediaUrlFor: (id) => `/m/${id}` })
    assert.match(boot, /background-size:cover/)
    assert.match(boot, /transform:scale\(1\.25\)/)
    const css = buildCss(doc, { mediaUrlFor: (id) => `/m/${id}` })
    assert.match(css, /background-size: cover/)
    assert.match(css, /transform: scale\(1\.25\)/)
  })
})

describe('回归锁 G/H · 字体引用、存储口径与族名清洗', () => {
  it('被字体栈引用的素材删除受保护（409）；force 删除后 families 同步清理', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dts-reg-g-'))
    try {
      const store = new ThemeStore({ root })
      await store.init()
      store.state.media['f0nt.woff2'] = {
        id: 'f0nt.woff2', file: 'f0nt.woff2', name: 'demo.woff2', mime: 'font/woff2',
        kind: 'font', bytes: 8, sha256: 'ab', addedAt: Date.now(),
      }
      await store.saveDoc(normalizeDoc({
        type: { families: [{ id: 'f0nt.woff2', family: 'DTS-f0nt', weight: 400, style: 'normal' }] },
      }))
      await assert.rejects(() => store.removeMedia('f0nt.woff2'), (err) => err.status === 409)
      await store.removeMedia('f0nt.woff2', { force: true })
      assert.equal(store.state.doc.type.families.filter((f) => f.id === 'f0nt.woff2').length, 0, '脏引用必须清掉')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('usage 不外泄服务器绝对路径；mediaMeta 不再被原型键骗出函数', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dts-reg-h-'))
    try {
      const store = new ThemeStore({ root })
      await store.init()
      const usage = await store.usage()
      assert.deepEqual(Object.keys(usage).sort(), ['bytes', 'files'])
      assert.equal(store.mediaMeta('constructor'), undefined)
      assert.equal(store.mediaMeta('toString'), undefined)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('非法族名被丢弃，不再裸进 @font-face', () => {
    const doc = normalizeDoc({
      type: {
        families: [
          { id: 'a.woff2', family: 'x";}</style><script>', weight: 400, style: 'normal' },
          { id: 'b.woff2', family: 'Noto Sans SC', weight: 400, style: 'normal' },
        ],
      },
    })
    assert.deepEqual(doc.type.families.map((f) => f.family), ['Noto Sans SC'])
  })

  it('按钮族进玻璃清单与令牌面板：白底按钮不再是一块不透明白斑（「新会话」实测）', () => {
    assert.ok(GLASS_SURFACES.includes('--dsw-alias-button-elevated-fill'),
      'elevated-fill 必须玻璃化，否则新会话按钮是不透明白斑')
    assert.ok(GLASS_SURFACES.includes('--dsw-specific-bubble'),
      '聊天气泡必须玻璃化，否则气泡是一块不透明白底（「有底不好」）')
    assert.ok(GLASS_SURFACES.includes('--dsw-alias-bg-module-platform'),
      '设置弹窗控件族（选择器/步进器/主题卡）必须玻璃化（「设置里面的也没变」实测归因）')
    assert.ok(GLASS_SURFACES.includes('--dsw-specific-sidebar-nav-item-active'),
      '设置导航选中态必须玻璃化')
    assert.ok(GLASS_SURFACES.includes('--dsw-specific-sidebar-nav-item-hover'),
      '设置导航悬停态必须玻璃化（「内置插件」白块实测归因）')
    assert.ok(GLASS_SURFACES.includes('--dsw-static-neutral-50'),
      '会话结束产出卡的 static 白面必须玻璃化（「已输出 N 个文件」白卡实测归因）')
    assert.ok(GLASS_SURFACES.includes('--dsw-static-neutral-100'),
      '产出卡 hover 白面同源，一并玻璃化')
    assert.ok(GLASS_SURFACES.includes('--dsw-alias-button-floating-hover'),
      '「新会话」悬停底色必须玻璃化，否则白字主题 hover 时白底白字（实测）')
    assert.ok(GLASS_SURFACES.includes('--dsw-alias-markdown-tag'),
      'TabHost 活动页签底色必须玻璃化，否则「文件」页签白底白字（实测）')
    for (const name of ['--dsw-alias-interactive-bg-hover', '--dsw-alias-interactive-bg-active',
      '--dsw-alias-button-tool-bar-fill', '--dsw-alias-button-tool-bar-hover', '--dsw-specific-menu',
      '--dsw-alias-interactive-bg-hover-solid', '--dsw-alias-button-ghost-active-fill']) {
      assert.ok(GLASS_SURFACES.includes(name), `${name} 同族小色块一并玻璃化（solid 变体曾漏网：悬停白条/「加载更早」白按钮实测）`)
    }
    const names = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name))
    for (const name of ['--dsw-alias-button-elevated-fill', '--dsw-alias-button-primary-fill', '--dsw-alias-button-tool-bar-fill']) {
      assert.ok(names.includes(name), `${name} 必须能在面板里设定`)
    }
  })
})

describe('回归锁 C/D · SVG 入库体检、回吐沙箱与 Host/Origin 闸', () => {
  /** @type {{url:string, port:number, close:()=>Promise<void>}} */
  let server
  /** @type {ThemeStore} */
  let store
  let root

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dts-reg-c-'))
    store = new ThemeStore({ root, maxUploadBytes: 1024 * 1024 })
    await store.init()
    const http = createThemeStudioHttp({ store })
    const node = createServer((req, res) => { void http.handle(req, res) })
    await new Promise((resolve) => node.listen(0, '127.0.0.1', resolve))
    server = {
      url: `http://127.0.0.1:${String(node.address().port)}`,
      port: node.address().port,
      // fetch（undici）的 keep-alive 连接会让 close 悬挂，--test-force-exit 强杀时
      // libuv 在 Windows 上报 UV_HANDLE_CLOSING 断言 —— 关闭前强制排干连接。
      close: () => new Promise((resolve) => {
        node.closeAllConnections?.()
        node.close(resolve)
      }),
    }
  })

  after(async () => {
    await server.close()
    await rm(root, { recursive: true, force: true })
  })

  const keyHeaders = () => ({ 'x-dts-key': store.writeToken })

  /** 手写原始请求：fetch 不让碰 Host 头，而 Host 恰好是本组的被测面。 */
  function raw(path, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: server.port, path, method, headers }, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        }))
      })
      req.on('error', reject)
      if (body !== undefined) req.write(body)
      req.end()
    })
  }

  it('sniffSvg 危险特征全覆盖：脚本、事件属性、外链、伪协议', () => {
    assert.equal(sniffSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'), true)
    assert.equal(sniffSvg('<svg><script>alert(1)</script></svg>'), false)
    assert.equal(sniffSvg('<svg><rect onerror="alert(1)"/></svg>'), false)
    assert.equal(sniffSvg('<svg><use href="//evil.example/x.svg#p"/></svg>'), false)
    assert.equal(sniffSvg('<svg><a href="javascript:alert(1)"/></svg>'), false)
    assert.equal(sniffSvg('<svg><foreignObject><body></body></foreignObject></svg>'), false)
    assert.equal(sniffSvg('<svg><animate onbegin="alert(1)"/></svg>'), false)
  })

  it('垫长注释绕过头部嗅探的脚本 SVG 被全文体检拒收（曾入库）', async () => {
    const evasive = '<?xml version="1.0"?>\n<!--' + 'A'.repeat(800) + '--><script>alert(1)</script><svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const res = await fetch(`${server.url}/dsh-theme-studio/api/media?name=evil.svg`, {
      method: 'POST', headers: keyHeaders(), body: evasive,
    })
    assert.equal(res.status, 415)
  })

  it('事件属性 SVG 被拒；干净 SVG 通过且回吐带沙箱头（PNG 仍 inline）', async () => {
    const bad = await fetch(`${server.url}/dsh-theme-studio/api/media?name=bad.svg`, {
      method: 'POST', headers: keyHeaders(), body: '<svg xmlns="http://www.w3.org/2000/svg"><rect onerror="alert(1)"/></svg>',
    })
    assert.equal(bad.status, 415)

    const good = await fetch(`${server.url}/dsh-theme-studio/api/media?name=ok.svg`, {
      method: 'POST', headers: keyHeaders(), body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
    })
    assert.equal(good.status, 201)
    const body = await good.json()
    const served = await fetch(`${server.url}${body.value.url}`)
    assert.equal(served.status, 200)
    assert.match(served.headers.get('content-disposition') ?? '', /^attachment/, 'SVG 直接导航应强制下载，不在本源渲染')
    assert.match(served.headers.get('content-security-policy') ?? '', /sandbox/, 'SVG 渲染必须沙箱化')

    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(48, 0),
    ])
    const up = await (await fetch(`${server.url}/dsh-theme-studio/api/media`, {
      method: 'POST', headers: keyHeaders(), body: png,
    })).json()
    const pngRes = await fetch(`${server.url}${up.value.url}`)
    assert.match(pngRes.headers.get('content-disposition') ?? '', /^inline/, '普通图片/视频不受影响')
  })

  it('伪造 Host（DNS rebinding 形态）被 421 拒绝，本机 Host 照常放行', async () => {
    const hostile = await raw('/dsh-theme-studio/api/state', { headers: { host: 'attacker.example' } })
    assert.equal(hostile.status, 421)
    const ok = await raw('/dsh-theme-studio/api/state', { headers: { host: `127.0.0.1:${String(server.port)}` } })
    assert.equal(ok.status, 200)
  })

  it('写请求 Origin 与 Host 不一致被 403；同源写入与无 Origin 的非浏览器客户端放行', async () => {
    const cross = await raw('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: {
        host: `127.0.0.1:${String(server.port)}`,
        origin: 'http://attacker.example',
        'content-type': 'application/json',
        ...keyHeaders(),
      },
      body: '{"doc":{}}',
    })
    assert.equal(cross.status, 403)

    const same = await raw('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: {
        host: `127.0.0.1:${String(server.port)}`,
        origin: `http://127.0.0.1:${String(server.port)}`,
        'content-type': 'application/json',
        ...keyHeaders(),
      },
      body: '{"doc":{}}',
    })
    assert.equal(same.status, 200)

    const headless = await raw('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: '{"doc":{}}',
    })
    assert.equal(headless.status, 200, 'curl 等无 Origin 客户端不受影响')
  })

  it('存储未初始化时报 503 而不是 500', async () => {
    const cold = new ThemeStore({ root: await mkdtemp(join(tmpdir(), 'dts-reg-cold-')) })
    const http = createThemeStudioHttp({ store: cold })
    const res = {
      statusCode: 0, headersSent: false,
      writeHead(status) { res.statusCode = status; res.headersSent = true; return res },
      write() { return true },
      end() {},
      on() {}, removeHeader() {}, setHeader() {}, getHeader() { return undefined }, destroy() {},
    }
    await http.handle({ method: 'GET', url: '/dsh-theme-studio/api/state', headers: {} }, res)
    assert.equal(res.statusCode, 503)
  })
})
