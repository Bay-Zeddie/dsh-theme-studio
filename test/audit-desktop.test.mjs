/**
 * 第三轮全量审计修复锁 + 桌面端迁移锁。
 *
 *   I   store：版本错位不再静默清库（先备份、按当前版本收敛）、修订号钳制
 *   J   engine：视差规则只作用外层 wrapper（不再覆盖放大倍率/平铺语义）；
 *       显式令牌优先级契约（cornerShape 默认值不再打回手写令牌）；
 *       boot CSS 补上 #root 透明行（首屏完整透明画布）
 *   K   color-core：rgb() 通道百分比按 0..100% 映射（曾被当 0..255 读）
 *   L   sniff：SVG 扫描对命名空间前缀/实体编码/控制符伪协议/<set>/外链引用加固
 *   M   http：Origin: null 拒绝；桌面端转发形态（无 Host 头）放行；
 *       TRUST_HOSTS 与局域网分支随 web 端废弃一并移除
 *
 * 跑法： node --test test/audit-desktop.test.mjs
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { mkdtemp, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ThemeStore } from '../lib/store.js'
import { createThemeStudioHttp } from '../lib/http.js'
import { buildBootCss, buildCss, buildTokenLayers, normalizeDoc, parseColor } from '../lib/engine.js'
import { sniffSvg } from '../lib/sniff.js'

describe('锁 I · store 版本错位与修订号', () => {
  let root
  before(async () => { root = await mkdtemp(join(tmpdir(), 'dts-adt-i-')) })
  after(async () => { await rm(root, { recursive: true, force: true }) })

  it('版本不匹配不再静默清库：备份原件，文档与素材索引按当前版本收敛', async () => {
    await mkdir(join(root, 'media'), { recursive: true })
    await writeFile(join(root, 'media', 'abc.png'), Buffer.alloc(16, 1))
    const future = {
      version: 2,
      revision: 7,
      doc: { backdrop: { mode: 'gradient', gradient: 'aurora' } },
      media: { 'abc.png': { id: 'abc.png', file: 'abc.png', name: '旧素材', mime: 'image/png', kind: 'image' } },
    }
    await writeFile(join(root, 'state.json'), JSON.stringify(future))
    const store = new ThemeStore({ root })
    await store.init()
    assert.equal(store.state.version, 1)
    assert.equal(store.state.doc.backdrop.mode, 'gradient', '文档不应被擦成默认')
    assert.equal(store.state.doc.backdrop.gradient, 'aurora')
    assert.ok(store.state.media['abc.png'], '素材索引不应被擦掉')
    const entries = await readdir(root)
    assert.ok(entries.some((entry) => /^state\.v2-\d+\.json$/.test(entry)), '升级前原件必须有备份')
  })

  it('修订号恢复为非负整数（负数/浮点破坏单调递增契约）', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dts-adt-rev-'))
    try {
      await writeFile(join(dir, 'state.json'), JSON.stringify({ version: 1, revision: -5.5, doc: {}, media: {} }))
      const store = new ThemeStore({ root: dir })
      await store.init()
      assert.equal(store.state.revision, 0)
      assert.equal(Number.isInteger(store.state.revision), true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('锁 J · 引擎：视差/显式令牌/首屏透明', () => {
  it('视差规则只作用 #dts-backdrop，不再覆盖图层 scale，也不给平铺塞缩放', () => {
    const css = buildCss(normalizeDoc({ backdrop: { mode: 'image', mediaId: 'a.png', parallax: 30, scale: 1.4 } }))
    assert.match(css, /#dts-backdrop \{ transform: translate3d/, '视差必须挂在 wrapper 上')
    assert.doesNotMatch(css, /#dts-backdrop \{[^}]*scale/, 'wrapper 不得再带 scale（曾导致双层位移 + 平铺被缩放）')
    assert.match(css, /\.dts-layer--css \{[^}]*transform: scale\(1\.4\)/, '放大倍率仍归图层本体（视差开着也不许被源序吃掉）')

    const tile = buildCss(normalizeDoc({ backdrop: { mode: 'image', mediaId: 'a.png', parallax: 30, tile: true } }))
    const wrapper = (tile.match(/#dts-backdrop \{[^}]*\}/) ?? [''])[0]
    const layer = (tile.match(/\.dts-layer--css \{[^}]*\}/) ?? [''])[0]
    assert.doesNotMatch(wrapper + layer, /scale\(/, '平铺模式一格都不缩放（.dts-video 的 scale 与背景层无关）')
  })

  it('显式令牌优先级最高：手写 --dsw-corner-shape 不被滑块默认值打回（曾 force 覆盖）', () => {
    const doc = normalizeDoc({ palette: { tokens: { '--dsw-corner-shape': 'superellipse(2.5)' } } })
    const pairs = buildTokenLayers(doc)
    assert.equal(pairs['--dsw-corner-shape'].light, 'superellipse(2.5)')
    assert.equal(pairs['--dsw-corner-shape'].dark, 'superellipse(2.5)')

    const font = normalizeDoc({
      palette: { tokens: { '--dsw-font-family': 'Serif" , serif' } },
      type: { uiFont: 'Sans, sans-serif' },
    })
    const fontPairs = buildTokenLayers(font)
    assert.equal(fontPairs['--dsw-font-family'].light, 'Serif" , serif', '手写令牌赢过面板字段')
  })

  it('boot CSS 补上 #root 透明行（与 buildCss 同源，首屏不再被宿主底色压住一半）', () => {
    const boot = buildBootCss(normalizeDoc({ backdrop: { mode: 'gradient' } }))
    assert.match(boot, /#root,#root>\*\{background-color:transparent\}/)
    assert.equal(buildBootCss(normalizeDoc({})), '')
  })

  it('Agent 预设选择器包裹层（menuAnchor）豁免毛玻璃兜底（创造模式浅斑实测）', () => {
    const css = buildCss(normalizeDoc({ backdrop: { mode: 'gradient' }, glass: { enabled: true } }))
    const blanket = css.indexOf('[class*="menu"]')
    const exempt = css.indexOf('[class*="menuAnchor"]')
    assert.ok(blanket !== -1 && exempt !== -1 && exempt > blanket, '豁免声明必须排在兜底之后（同源层叠）')
    assert.match(css, /\[class\*="menuAnchor"\] \{[^}]*backdrop-filter: none !important/, '豁免必须 !important（Menu 原语会拼接额外类名，结尾锚定会落空）')
  })
})

describe('锁 K · rgb() 通道百分比', () => {
  it('rgb(50%, 0, 0) 按半量程解析（曾把 50% 当作 50/255）', () => {
    assert.equal(parseColor('rgb(50%, 0, 0)').r, 127.5)
    assert.equal(parseColor('rgb(100%, 100%, 100%)').g, 255)
    assert.equal(parseColor('rgba(0%, 0%, 0%, 50%)').a, 0.5)
    assert.equal(parseColor('hsl(120, 50%, 40%)').g, 153, 'hsl 的 s/l 百分比口径不受影响')
  })
})

describe('锁 L · SVG 扫描加固', () => {
  const ok = (text) => assert.equal(sniffSvg(text), true, '合法 SVG 不应误伤')
  const bad = (text, why) => assert.equal(sniffSvg(text), false, why)

  it('合法 SVG 照常放行：命名空间声明、本地引用、普通形状', () => {
    ok('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')
    ok('<svg xmlns:xlink="http://www.w3.org/1999/xlink"><rect width="1" height="1"/></svg>')
    ok('<svg><a href="/local/path"><text>x</text></a></svg>')
  })

  it('命名空间前缀形变被拆穿：<s:script> 就是 script 元素', () => {
    bad('<svg xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>', '前缀脚本必须被拒')
    bad('<svg xmlns:s="http://www.w3.org/2000/svg"><s:animate onbegin="alert(1)" attributeName="x"/></svg>', '前缀 animate 必须被拒')
  })

  it('实体编码伪协议被拆穿：&#106;avascript: 解码后就是 javascript:', () => {
    bad('<svg><a xlink:href="&#106;avascript:alert(1)"><text>x</text></a></svg>', '十进制实体伪协议必须被拒')
    bad('<svg><a href="&#x6a;avascript:alert(1)"><text>x</text></a></svg>', '十六进制实体伪协议必须被拒')
  })

  it('<set>/<handler> 与 attributeName=on、外链引用被拒', () => {
    bad('<svg><set attributeName="onmouseover" to="alert(1)"/></svg>', '<set 事件注入必须被拒')
    bad('<svg><handler xmlns="http://www.w3.org/2001/xml-events">alert(1)</handler></svg>', '<handler 必须被拒')
    bad('<svg><image href="http://evil.example/track.png"/></svg>', '外链引用必须被拒')
    bad('<svg><image xlink:href="//evil.example/track.png"/></svg>', '协议相对外链必须被拒')
  })
})

describe('锁 M · Origin: null 与桌面端转发形态', () => {
  /** @type {{url:string, port:number, close:()=>Promise<void>}} */
  let server
  /** @type {ThemeStore} */
  let store
  let root

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dts-adt-m-'))
    store = new ThemeStore({ root })
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
  })

  after(async () => {
    await server.close()
    await rm(root, { recursive: true, force: true })
  })

  const keyHeaders = () => ({ 'x-dts-key': store.writeToken })

  /** 手写原始请求：fetch 不让碰 Host/Origin 头，而它们恰好是本组的被测面。 */
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

  /** 真·无 Host 头请求（node:http 客户端总会补 Host，只能用裸 socket）。
   *  桌面端 forwardWebRequest 在转发前剥掉 Host/Origin —— 缺失必须放行。 */
  function rawNoHost(text) {
    return new Promise((resolve, reject) => {
      const socket = connect(server.port, '127.0.0.1', () => { socket.end(text) })
      let data = ''
      socket.on('data', (chunk) => { data += chunk.toString('utf8') })
      socket.on('end', () => resolve(data))
      socket.on('error', reject)
      socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('timeout')) })
    })
  }

  it('Origin: null（沙箱 iframe / file:// 形态）写请求被 403', async () => {
    const nulled = await raw('/dsh-theme-studio/api/state', {
      method: 'PUT',
      headers: { host: `127.0.0.1:${String(server.port)}`, origin: 'null', 'content-type': 'application/json', ...keyHeaders() },
      body: '{"doc":{}}',
    })
    assert.equal(nulled.status, 403)
  })

  it('无 Host 头（桌面端 Electron 转发形态）放行', async () => {
    // HTTP/1.0 才允许无 Host：node 的解析器对 1.1 无 Host 在进入处理器前就 400。
    const text = await rawNoHost('GET /dsh-theme-studio/api/state HTTP/1.0\r\n\r\n')
    assert.match(text, /^HTTP\/1\.0 200|^HTTP\/1\.1 200/, '桌面端转发不带 Host 头，必须放行')
  })

  it('DSH_THEME_STUDIO_TRUST_HOSTS 已随 web 端废弃：设了也不再放行外部主机名', async () => {
    process.env.DSH_THEME_STUDIO_TRUST_HOSTS = 'attacker.example'
    try {
      const hostile = await raw('/dsh-theme-studio/api/state', { headers: { host: 'attacker.example' } })
      assert.equal(hostile.status, 421)
    } finally {
      delete process.env.DSH_THEME_STUDIO_TRUST_HOSTS
    }
  })
})

describe('锁 N · connection.requestRejection 会话闸（写请求第二道门）', () => {
  /** @type {{port:number, close:()=>Promise<void>}} */
  let server
  /** @type {ThemeStore} */
  let store
  let root
  /** 每个用例换成自己的 connection 桩：闸的行为面在 handler 层锁。 */
  let currentHttp = null

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'dts-adt-n-'))
    store = new ThemeStore({ root })
    await store.init()
    const node = createServer((req, res) => { void currentHttp.handle(req, res) })
    await new Promise((resolve) => node.listen(0, '127.0.0.1', resolve))
    server = {
      port: node.address().port,
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
  const hostHeader = () => ({ host: `127.0.0.1:${String(server.port)}` })

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

  it('拒绝号原样透传为状态码，消息标明会话未通过；闸收到请求上下文三件套', async () => {
    for (const status of [403, 429]) {
      let seen = null
      currentHttp = createThemeStudioHttp({ store, connection: { requestRejection: (request) => { seen = request; return status } } })
      const res = await raw('/dsh-theme-studio/api/state', {
        method: 'PUT',
        headers: { ...hostHeader(), 'content-type': 'application/json', ...keyHeaders() },
        body: '{"doc":{}}',
      })
      assert.equal(res.status, status, `拒绝号 ${String(status)} 应原样成为响应状态码`)
      assert.match(res.text, /浏览器会话未通过/)
      assert.deepEqual(Object.keys(seen).sort(), ['headers', 'method', 'url'], '闸只拿 headers/method/url 三件套')
      assert.equal(seen.method, 'PUT')
      assert.equal(seen.url, '/dsh-theme-studio/api/state')
    }
  })

  it('闸放行形态：返回 0 或 undefined 都不拦', async () => {
    for (const verdict of [0, undefined]) {
      currentHttp = createThemeStudioHttp({ store, connection: { requestRejection: () => verdict } })
      const res = await raw('/dsh-theme-studio/api/state', {
        method: 'PUT',
        headers: { ...hostHeader(), 'content-type': 'application/json', ...keyHeaders() },
        body: '{"doc":{}}',
      })
      assert.equal(res.status, 200, `返回 ${String(verdict)} 应放行`)
    }
  })

  it('闸在口令校验之后：无口令 401 / 错口令 403 都不咨询会话闸', async () => {
    let calls = 0
    currentHttp = createThemeStudioHttp({ store, connection: { requestRejection: () => { calls += 1; return 403 } } })
    const missing = await raw('/dsh-theme-studio/api/state', {
      method: 'PUT', headers: { ...hostHeader(), 'content-type': 'application/json' }, body: '{"doc":{}}',
    })
    assert.equal(missing.status, 401)
    const wrong = await raw('/dsh-theme-studio/api/state', {
      method: 'PUT', headers: { ...hostHeader(), 'content-type': 'application/json', 'x-dts-key': 'not-the-token' }, body: '{"doc":{}}',
    })
    assert.equal(wrong.status, 403)
    assert.equal(calls, 0, '写口令没过就不该问会话闸')
  })

  it('读请求不咨询会话闸', async () => {
    let calls = 0
    currentHttp = createThemeStudioHttp({ store, connection: { requestRejection: () => { calls += 1; return 403 } } })
    const res = await raw('/dsh-theme-studio/api/state', { headers: hostHeader() })
    assert.equal(res.status, 200)
    assert.equal(calls, 0, 'GET /api/state 不走会话闸')
  })

  it('写路由族代表：PUT / POST / DELETE 全部过闸（闸先于路由处理器）', async () => {
    currentHttp = createThemeStudioHttp({ store, connection: { requestRejection: () => 403 } })
    const authed = { ...hostHeader(), ...keyHeaders() }
    const put = await raw('/dsh-theme-studio/api/state', { method: 'PUT', headers: { ...authed, 'content-type': 'application/json' }, body: '{"doc":{}}' })
    const post = await raw('/dsh-theme-studio/api/preset', { method: 'POST', headers: { ...authed, 'content-type': 'application/json' }, body: '{"id":"deepsea"}' })
    // 素材不存在本该 404：闸在路由处理器之前拦下，说明 DELETE 族同样过闸。
    const del = await raw('/dsh-theme-studio/api/media/nope.png', { method: 'DELETE', headers: authed })
    for (const res of [put, post, del]) {
      assert.equal(res.status, 403)
      assert.match(res.text, /浏览器会话未通过/)
    }
  })
})

describe('锁 O · PowerShell 脚本可被 5.1 解析（UTF-8 BOM 契约）', () => {
  const isWin = process.platform === 'win32'
  it('install.ps1 / uninstall.ps1 无语法错误（无 BOM 时 5.1 按 ANSI 误读中文，here-string 终止符被吞）', { skip: !isWin }, async () => {
    const { spawnSync } = await import('node:child_process')
    const dir = join(dirname(fileURLToPath(import.meta.url)))
    const root = dirname(dir)
    const check = (file) => {
      const script = `$errors=$null;$t=$null;` +
        `[System.Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$t,[ref]$errors)|Out-Null;` +
        `if($errors.Count -gt 0){Write-Output $errors[0].Message;exit 1};exit 0`
      const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' })
      assert.equal(res.status, 0, `${file} 应能被 Windows PowerShell 5.1 解析：${String(res.stdout ?? '').trim()}`)
    }
    check(join(root, 'install.ps1'))
    check(join(root, 'uninstall.ps1'))
  })
})
