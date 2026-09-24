/**
 * Host 半装配与首屏注入测试。
 *
 * 这一层唯一"往 index.html 里写东西"的通路是 webserver/index-inject，
 * 所以重点是：注入行形状正确、用户可控字符串无法提前闭合 script/style、
 * 以及没有 webServer 的组合（CLI / ACP）里插件必须安静地不注册路由。
 *
 * 跑法： node --test test/host.test.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ThemeStore } from '../lib/store.js'
import { PREFIX, apply as hostApply, bootInjections } from '../index.js'

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function freshStore(docPatch) {
  const root = await mkdtemp(join(tmpdir(), 'dts-host-'))
  const store = new ThemeStore({ root })
  await store.init()
  if (docPatch !== undefined) await store.saveDoc(docPatch)
  return { store, root }
}

/** 造一个只实现 index.js 真正会用到的成员的 Cordis ctx 替身。 */
function makeHostCtx(services) {
  const recorded = { routes: [], events: [], effects: [], logs: [] }
  const ctx = {
    logger: {
      info: (msg) => recorded.logs.push(['info', msg]),
      warn: (msg) => recorded.logs.push(['warn', msg]),
      error: (msg) => recorded.logs.push(['error', msg]),
    },
    effect(fn) {
      const disposer = fn()
      if (typeof disposer === 'function') recorded.effects.push(disposer)
      return undefined
    },
    on(event, handler, options) {
      recorded.events.push({ event, handler, options })
      return () => {}
    },
    get: () => undefined,
    inject(names, fn) {
      const missing = names.filter((name) => services[name] === undefined)
      if (missing.length === 0) fn(childCtxWith(services))
      return undefined
    },
  }
  function childCtxWith(map) {
    return Object.assign({}, ctx, map)
  }
  return { ctx, recorded }
}

describe('首屏注入行', () => {
  it('默认状态只下发一行写口令', async () => {
    const { store, root } = await freshStore()
    try {
      const rows = bootInjections(store)
      assert.equal(rows.length, 1, '无背景时不该下发样式或脚本')
      assert.equal(rows[0].kind, 'global')
      assert.equal(rows[0].name, '__DTS_BOOT__')
      assert.equal(typeof rows[0].value.writeToken, 'string')
      assert.ok(rows[0].value.writeToken.length >= 16)
      assert.equal(rows[0].value.backdropMode, 'none')
      assert.equal(rows[0].value.prefix, PREFIX)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('图片背景下发 style + html 两行，且 CSS 无法提前闭合', async () => {
    const { store, root } = await freshStore({
      backdrop: { mode: 'image', mediaId: 'wall.png', dim: 0.35, blur: 2 },
    })
    try {
      const rows = bootInjections(store)
      const style = rows.find((row) => row.kind === 'style')
      const html = rows.find((row) => row.kind === 'html')
      assert.ok(style, '应有首屏样式行')
      assert.ok(html, '应有背景层标记')
      assert.match(style.text, /position:fixed/)
      assert.match(style.text, /url\("\/dsh-theme-studio\/media\/wall\.png\/"\)/)
      assert.match(style.text, /filter:blur\(2px\)/)
      assert.match(html.html, /id="dts-backdrop"/)
      assert.ok(!style.text.includes('</style'), '注入 CSS 不允许提前闭合 style')
      assert.ok(!html.html.includes('<script'), '背景标记不该带脚本')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('恶意 mediaId 被 URL 编码，逃不出引号与标签', async () => {
    const hostile = 'x.png");background:url(javascript:alert(1));/**/'
    const { store, root } = await freshStore({ backdrop: { mode: 'image', mediaId: hostile } })
    try {
      const style = bootInjections(store).find((row) => row.kind === 'style')
      assert.ok(style)
      assert.ok(!style.text.includes('javascript:'), '伪协议必须被编码掉')
      assert.ok(!/[^"]";/.test(style.text), '不得出现提前闭合的引号')
      assert.match(style.text, /url\("[^"]*"\)/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('视频背景用脚本挂 <video>，属性逐条生成且不提前闭合 script', async () => {
    const { store, root } = await freshStore({
      backdrop: { mode: 'video', mediaId: 'clip.webm', video: { muted: true, loop: true, autoplay: true, playbackRate: 1.5 } },
    })
    try {
      const rows = bootInjections(store)
      const script = rows.find((row) => row.kind === 'script' && row.placement === 'body')
      assert.ok(script, '视频背景需要脚本挂元素')
      assert.ok(!script.text.includes('</script'), '脚本内不得出现提前闭合')
      assert.match(script.text, /video\.muted = true;/)
      assert.match(script.text, /video\.loop = true;/)
      assert.match(script.text, /setAttribute\("playsinline", ""\)/)
      assert.match(script.text, /video\.playbackRate = 1.5/)
      assert.match(script.text, /\/dsh-theme-studio\/media\/clip\.webm\//)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('未静音或未循环时对应属性就不写（不假设默认）', async () => {
    const { store, root } = await freshStore({
      backdrop: { mode: 'video', mediaId: 'a.webm', video: { muted: false, loop: false, autoplay: false, playbackRate: 1 } },
    })
    try {
      const script = bootInjections(store).find((row) => row.kind === 'script')
      assert.ok(!script.text.includes('video.muted = true;'))
      assert.ok(!script.text.includes('video.loop = true;'))
      assert.ok(!script.text.includes('.play()'), '关自动播放就不该调 play()')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('apply(ctx) 装配', () => {
  it('没有 webServer 的组合里安静跳过（CLI / ACP）', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dts-apply-'))
    const previous = process.env.DSH_THEME_STUDIO_HOME
    process.env.DSH_THEME_STUDIO_HOME = root
    try {
      const { ctx, recorded } = makeHostCtx({})
      hostApply(ctx)
      await tick(40)
      assert.equal(recorded.routes.length, 0, '不该注册任何路由')
    } finally {
      if (previous === undefined) delete process.env.DSH_THEME_STUDIO_HOME
      else process.env.DSH_THEME_STUDIO_HOME = previous
      await rm(root, { recursive: true, force: true })
    }
  })

  it('有 webServer 时注册前缀路由并响应 index-inject', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dts-apply-'))
    const previous = process.env.DSH_THEME_STUDIO_HOME
    process.env.DSH_THEME_STUDIO_HOME = root
    try {
      const webServer = {
        register(route) {
          recorded.routes.push(route)
          return () => {}
        },
      }
      const { ctx, recorded } = makeHostCtx({ webServer })
      hostApply(ctx)
      await tick(60)

      assert.equal(recorded.routes.length, 1)
      const route = recorded.routes[0]
      assert.equal(route.kind, 'prefix')
      assert.equal(route.path, '/dsh-theme-studio')
      assert.equal(typeof route.handler, 'function')

      const inject = recorded.events.find((item) => item.event === 'webserver/index-inject')
      assert.ok(inject, '应订阅 webserver/index-inject')
      // prepend 对齐官方 ui-theme 的注册形态：主题行先进表，背景层垫底、口令先行。
      assert.equal(inject.options?.prepend, true, 'index-inject 订阅应带 { prepend: true }（ui-theme 同款）')
      const table = []
      inject.handler(table)
      assert.ok(table.length >= 1, '首屏至少下发写口令行')
      assert.equal(table[0].kind, 'global')

      // 路由真的能服务：走一遍 /api/state。
      const res = makeCapturableResponse()
      await route.handler({ method: 'GET', url: '/dsh-theme-studio/api/state', headers: {} }, res)
      assert.equal(res.statusCode, 200)
      const body = JSON.parse(res.chunks.join(''))
      assert.equal(body.ok, true)
      assert.equal(body.value.doc.backdrop.mode, 'none')
    } finally {
      if (previous === undefined) delete process.env.DSH_THEME_STUDIO_HOME
      else process.env.DSH_THEME_STUDIO_HOME = previous
      await rm(root, { recursive: true, force: true })
    }
  })

  it('写入端口在无写口令时被拒（宿主装配里同样生效）', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dts-apply-'))
    const previous = process.env.DSH_THEME_STUDIO_HOME
    process.env.DSH_THEME_STUDIO_HOME = root
    try {
      const routes = []
      const ctx = {
        logger: { info() {}, warn() {}, error() {} },
        effect(fn) { const d = fn(); if (typeof d === 'function') { /* 记录在 makeHostCtx 里 */ } },
        on() { return () => {} },
        get: () => undefined,
        inject(names, fn) { if (names.includes('webServer')) fn(this) },
        webServer: { register(route) { routes.push(route); return () => {} } },
      }
      hostApply(ctx)
      await tick(60)
      const res = makeCapturableResponse()
      await routes[0].handler({
        method: 'PUT',
        url: '/dsh-theme-studio/api/state',
        headers: { 'content-type': 'application/json' },
      }, res)
      // 请求体一条不发的 PUT 会被 JSON 读取与口令校验挡住。
      assert.ok(res.statusCode === 401 || res.statusCode === 400, `实际 ${String(res.statusCode)}`)
    } finally {
      if (previous === undefined) delete process.env.DSH_THEME_STUDIO_HOME
      else process.env.DSH_THEME_STUDIO_HOME = previous
      await rm(root, { recursive: true, force: true })
    }
  })
})

/** 最小 ServerResponse 替身，够 http.js 用到的面。 */
function makeCapturableResponse() {
  const res = {
    statusCode: 0,
    headers: null,
    chunks: [],
    headersSent: false,
    writeHead(status, headers) {
      res.statusCode = status
      res.headers = headers ?? null
      res.headersSent = true
      return res
    },
    write(chunk) { res.chunks.push(String(chunk)); return true },
    end(chunk) { if (chunk !== undefined) res.chunks.push(String(chunk)); res.ended = true },
    on() {},
    once() {},
    emit() {},
    removeHeader() {},
    setHeader() {},
    getHeader() { return undefined },
    destroy() {},
  }
  return res
}
