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
 *   P  第四轮：写面 Origin/Host 全覆盖、上传与主题档穿越、畸形 Range、
 *       原型键查表、SVG 16 MiB 上限（"已实现却没锁住"的边界补锁）
 *
 * 跑法： node --test test/regression.test.mjs
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ThemeStore, sniffSvg, SVG_FULL_SCAN_MAX } from '../lib/store.js'
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
    /* ★ 本轮恢复（2026-09-27）：`--dsw-static-neutral-50/100` 回到清单。
       它们是宿主 ui-deliverables / ui-schedule 四张「白面卡」局部填充变量
       （`--changes-fill`/`--deliverable-fill`/`--plan-card-fill`/`--card-fill`）的
       `var()` 上游，而局部变量声明在**卡片元素自身**上、压过从 body 继承的值
       （宿主 Presenter 把令牌写成 body 行内样式）—— 所以只有改基元才重铸得到白面；
       把局部变量名塞进清单是**空操作**（实测）。爆炸半径逐字测过：整份宿主产物里
       `neutral-50` 共 10 处、`-100` 共 8 处，消费点只有那四个组件 + 一个别名
       `--dsw-alias-markdown-inline-code`（它本就在清单里、有自己的重铸值）。 */
    assert.ok(GLASS_SURFACES.includes('--dsw-static-neutral-50'),
      '会话结束产出卡的 static 白面必须玻璃化（「已输出 N 个文件」白卡实测归因）')
    assert.ok(GLASS_SURFACES.includes('--dsw-static-neutral-100'),
      '产出卡 hover 白面同源，一并玻璃化')
    /* ★ 但**基元大族仍然全挡** —— 口径是白名单，不是"前缀放行"。
       除这两个点名例外，`--dsw-static-*` 一个都不许进（它们是整条色阶的定义处）。 */
    for (const name of GLASS_SURFACES) {
      if (name.indexOf('--dsw-static-') !== 0) continue
      assert.ok(name === '--dsw-static-neutral-50' || name === '--dsw-static-neutral-100',
        '基元白名单只放行 neutral-50/100，其余 --dsw-static-* 一律不许进：' + name)
    }
    for (const name of GLASS_SURFACES) {
      if (name.indexOf('--dsw-static-') === 0) continue
      assert.match(name, /^--dsw-(alias|specific)-/, '除基元白名单外只许别名层：' + name)
    }
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

/**
 * 第四轮审计补锁：把「已实现但没被任何测试锁住」的边界补上。
 *   P1 跨站 Origin 只锁了 PUT —— 其余写路由（上传/删除/预设/导入/主题档）逐个锁
 *   P2 Host 闸只锁了 GET —— 写请求与 SSE 也必须 421
 *   P3 只读端点逐个确认不回显写口令（不只 /api/state）
 *   P4 上传 ?name= 路径穿越、主题档 slug 的原型键
 *   P5 畸形 Range（无法解析 / 反向 / 超大起始）的降级与 416
 *   P6 SVG 16 MiB 全文体检上限（README 承诺、此前零测试）
 */
describe('回归锁 P · 第四轮审计补锁（写面全覆盖 / 穿越 / Range / 原型键 / SVG 上限）', () => {
  /** @type {{url:string, port:number, close:()=>Promise<void>}} */
  let server
  /** @type {ThemeStore} */
  let store
  let root
  let mediaUrlPath

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dts-reg-p-'))
    // 上限放到 32 MiB：本组要真的撞 16 MiB 的 SVG 上限，1 MiB 的老夹具会先 413。
    store = new ThemeStore({ root, maxUploadBytes: 32 * 1024 * 1024 })
    await store.init()
    const http = createThemeStudioHttp({ store })
    const node = createServer((req, res) => { void http.handle(req, res) })
    await new Promise((resolve) => node.listen(0, '127.0.0.1', resolve))
    server = {
      url: `http://127.0.0.1:${String(node.address().port)}`,
      port: node.address().port,
      close: () => new Promise((resolve) => {
        node.closeAllConnections?.()
        node.close(resolve)
      }),
    }
    // 先落一个素材：Range 组要一个真文件，name 穿越组要一次真实上传。
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0),
    ])
    const res = await fetch(`${server.url}/dsh-theme-studio/api/media?name=r.png`, {
      method: 'POST', headers: { 'x-dts-key': store.writeToken }, body: png,
    })
    mediaUrlPath = (await res.json()).value.url
  })

  after(async () => {
    await server.close()
    await rm(root, { recursive: true, force: true })
  })

  const keyHeaders = () => ({ 'x-dts-key': store.writeToken })

  /** 手写原始请求：fetch 不让碰 Host 头，而 Host 恰好是被测面之一。 */
  function raw(path, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: server.port, path, method, headers }, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
      })
      req.on('error', reject)
      if (body !== undefined) req.write(body)
      req.end()
    })
  }

  const crossSite = (extra = {}) => ({
    host: `127.0.0.1:${String(server.port)}`,
    origin: 'http://attacker.example',
    'content-type': 'application/json',
    ...keyHeaders(),
    ...extra,
  })

  it('跨站 Origin 覆盖全部写路由（曾只锁 PUT /api/state）', async () => {
    const writes = [
      { method: 'POST', path: '/dsh-theme-studio/api/preset', body: '{"id":"deepsea"}' },
      { method: 'POST', path: '/dsh-theme-studio/api/import', body: '{"doc":{}}' },
      { method: 'POST', path: '/dsh-theme-studio/api/themes', body: '{"name":"x"}' },
      { method: 'POST', path: '/dsh-theme-studio/api/themes/load', body: '{"slug":"x"}' },
      { method: 'DELETE', path: '/dsh-theme-studio/api/themes/x' },
      { method: 'DELETE', path: `/dsh-theme-studio/api/media/${encodeURIComponent(store.writeToken)}` },
      { method: 'POST', path: '/dsh-theme-studio/api/media', body: 'not-a-real-image' },
    ]
    for (const write of writes) {
      const res = await raw(write.path, { method: write.method, headers: crossSite(), body: write.body })
      assert.equal(res.status, 403, `${write.method} ${write.path} 跨站来源必须 403`)
    }
  })

  it('Host 闸覆盖写请求与 SSE（曾只锁 GET /api/state）', async () => {
    const probes = [
      { method: 'PUT', path: '/dsh-theme-studio/api/state', body: '{"doc":{}}' },
      { method: 'POST', path: '/dsh-theme-studio/api/preset', body: '{"id":"deepsea"}' },
      { method: 'POST', path: '/dsh-theme-studio/api/media', body: 'x' },
      { method: 'GET', path: '/dsh-theme-studio/api/events' },
      { method: 'GET', path: '/dsh-theme-studio/api/usage' },
    ]
    for (const probe of probes) {
      const res = await raw(probe.path, {
        method: probe.method,
        headers: { host: 'attacker.example', 'content-type': 'application/json', ...keyHeaders() },
        body: probe.body,
      })
      assert.equal(res.status, 421, `${probe.method} ${probe.path} 伪造 Host 必须 421`)
    }
  })

  it('只读端点一律不回显写口令（不只 /api/state）', async () => {
    for (const path of ['/api/state', '/api/export', '/api/themes', '/api/usage']) {
      const res = await fetch(`${server.url}/dsh-theme-studio${path}`)
      const text = await res.text()
      assert.ok(!text.includes(store.writeToken), `${path} 不得把写口令吐给无凭据调用方`)
    }
  })

  it('上传 ?name= 的路径穿越进不了文件名（落盘路径本就由内容哈希决定）', async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(32, 0),
    ])
    const res = await fetch(`${server.url}/dsh-theme-studio/api/media?name=${encodeURIComponent('../../../evil.png')}`, {
      method: 'POST', headers: keyHeaders(), body: png,
    })
    assert.equal(res.status, 201)
    const record = (await res.json()).value.media
    assert.ok(!record.name.includes('/') && !record.name.includes('\\'),
      `消毒后的素材名不得含路径分隔符：${record.name}`)
    assert.ok(store.mediaMeta(record.id), '素材应按内容哈希落进索引')
    assert.ok(!store.absoluteOf(record).includes('..'), `绝对路径不得带点段：${store.absoluteOf(record)}`)
  })

  it('主题档查表用原型键只报 4xx，不 500', async () => {
    const load = await fetch(`${server.url}/dsh-theme-studio/api/themes/load`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...keyHeaders() },
      body: JSON.stringify({ slug: 'constructor' }),
    })
    assert.ok(load.status >= 400 && load.status < 500,
      `slug=constructor 应是 404 一类的 4xx，实际 ${String(load.status)}`)
    const del = await fetch(`${server.url}/dsh-theme-studio/api/themes/constructor`, {
      method: 'DELETE', headers: keyHeaders(),
    })
    assert.equal(del.status, 404)
  })

  it('畸形 Range：无法解析降级 200，反向与超大起始 416', async () => {
    const ask = async (range) => {
      const res = await fetch(`${server.url}${mediaUrlPath}`, { headers: { range } })
      await res.arrayBuffer()
      return res.status
    }
    assert.equal(await ask('bytes=abc'), 200, '无法解析的 Range 按整份 200 降级（RFC 允许）')
    assert.equal(await ask('bytes= 0-10'), 200, '带空格的写法同样降级，不猜着解析')
    assert.equal(await ask('bytes=5-1'), 416, '反向区间必须 416，不能吐出 Content-Range: bytes 5-1/N')
    assert.equal(await ask('bytes=99999999999999999999-'), 416, '天文数字起点（parseInt 溢出到 1e20）必须 416')
  })

  it('超过 16 MiB 的 SVG 被全文体检上限拒收（README 承诺的边界，此前零测试）', async () => {
    const before = await store.usage()
    const huge = '<?xml version="1.0"?>\n<!--'
      + 'A'.repeat(SVG_FULL_SCAN_MAX)
      + '--><svg xmlns="http://www.w3.org/2000/svg"></svg>'
    const res = await fetch(`${server.url}/dsh-theme-studio/api/media?name=huge.svg`, {
      method: 'POST', headers: keyHeaders(), body: huge,
    })
    assert.equal(res.status, 415, '超过 16 MiB 的"壁纸"不是壁纸')
    const after = await store.usage()
    assert.equal(after.files, before.files, '被拒的上传不得在 media/ 里留下半截文件')
  })

  it('客户端自检快照回传：只读 GET /api/state 就能拿到 DOM 现场（皮肤问题的唯一可观测通道）', async () => {
    const diag = encodeURIComponent(JSON.stringify({
      body: 'dts-on dsh',
      chrome: true,
      chromeLen: 1234,
      layer: true,
      section: true,
      cards: ['ThMjxG_card', '_card_38jqx_9'],
      hit: { fade: 1, card_: 2, agent: 0, dts: 0, role: 3 },
    }))
    const res = await fetch(`${server.url}/dsh-theme-studio/api/state`, { headers: { 'x-dts-diag': diag } })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(body.value.client, '应带客户端自检')
    assert.equal(body.value.client.diag.chrome, true, '要能回答"样式注进去了没有"')
    assert.equal(body.value.client.diag.body, 'dts-on dsh', '要能回答"body 上有没有 dts-on"')
    assert.equal(body.value.client.diag.section, true, '要能回答"设置页入口落地没有"')
    assert.deepEqual(body.value.client.diag.cards, ['ThMjxG_card', '_card_38jqx_9'],
      '要带回宿主卡片类名：这是判定命名约定是哪套的唯一依据')
    assert.equal(body.value.client.diag.hit.fade, 1)
    assert.ok(Number.isFinite(body.value.client.lastSeenAt))

    // 白名单收敛：白名单外的字段与超长文本都不许原样带出去。
    const dirty = encodeURIComponent(JSON.stringify({
      body: 'x'.repeat(500), secret: 'nope', cards: ['a'.repeat(500), 123],
    }))
    const res2 = await fetch(`${server.url}/dsh-theme-studio/api/state`, { headers: { 'x-dts-diag': dirty } })
    const body2 = await res2.json()
    assert.equal(body2.value.client.diag.body.length, 200, 'body 必须截断')
    assert.equal(body2.value.client.diag.secret, undefined, '白名单外的字段必须丢掉')
    assert.deepEqual(body2.value.client.diag.cards, ['a'.repeat(160)], '卡片项必须是字符串且截断')

    // 坏快照不能把 /api/state 打挂。
    const res3 = await fetch(`${server.url}/dsh-theme-studio/api/state`, { headers: { 'x-dts-diag': 'not-json' } })
    assert.equal(res3.status, 200)
    const body3 = await res3.json()
    assert.equal(typeof body3.value.client.diag.error, 'string')
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
