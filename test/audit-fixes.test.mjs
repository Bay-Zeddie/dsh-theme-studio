/**
 * 审计修复锁（2026-02 全量审计）：每条锁先以「期望行为」复现缺陷（红 = 问题实证），
 * 修复后转绿。对应审计报告 M1/M2/L1/L2/L4 五项（L3/M2-client 面在 client.test.mjs）。
 *
 *   M1  被动 GET /api/state 曾把写口令递给任何能连上的客户端 —— 与 README
 *       「同网段拿不到写口令」的安全承诺矛盾（curl/脚本无同源策略约束）。
 *   M2  safeName 消毒会把不同名字映射到同一落盘 slug（'午夜?深蓝' → '午夜深蓝'），
 *       主题档保存曾静默覆盖 —— 绕过 UI 的覆盖确认，数据丢失。
 *   L1  SSE keepalive 曾对全体连接广播 ping：N 连接 = N² 写。
 *   L2  /api/themes/load 曾把损坏档的裸 SyntaxError 抛成 500。
 *   L4  index-inject 曾在 store 未就绪时整段跳过 —— 首屏连写口令都不下发。
 *
 * 跑法： node --test test/audit-fixes.test.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ThemeStore } from '../lib/store.js'
import { createThemeStudioHttp } from '../lib/http.js'
import { PREFIX, apply as hostApply } from '../index.js'

const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function freshStore() {
  const root = await mkdtemp(join(tmpdir(), 'dts-audit-'))
  const store = new ThemeStore({ root, maxUploadBytes: 1024 * 1024 })
  await store.init()
  return { store, root }
}

async function withServer(run, options = {}) {
  const { store, root } = await freshStore()
  const http = createThemeStudioHttp({ store, ...options })
  const node = createServer((req, res) => { void http.handle(req, res) })
  await new Promise((resolve) => node.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${String(node.address().port)}`
  try {
    await run({ store, base, port: node.address().port })
  } finally {
    node.closeAllConnections?.()
    await new Promise((resolve) => node.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
}

describe('回归锁 M1 · 写口令不进被动 GET', () => {
  it('无凭据 GET /api/state 不下发 writeToken；持口令自证才回显', async () => {
    await withServer(async ({ store, base }) => {
      // curl / 任意脚本没有同源策略：被动 GET 曾直接得口令 = 网络可达即可写。
      const plain = await (await fetch(`${base}${PREFIX}/api/state`)).json()
      assert.equal(plain.ok, true)
      assert.equal(plain.value.writeToken, undefined, '无凭据响应体不得包含写口令')

      const holder = await (await fetch(`${base}${PREFIX}/api/state`, {
        headers: { 'x-dts-key': store.writeToken },
      })).json()
      assert.equal(holder.value.writeToken, store.writeToken, '持口令的调用方（浏览器半）仍可自证取回')

      // 防线兜底：拿不到口令就写不动。
      const write = await fetch(`${base}${PREFIX}/api/state`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc: {} }),
      })
      assert.equal(write.status, 401)
    })
  })
})

describe('回归锁 M2 · safeName 碰撞不许静默覆盖主题档', () => {
  it('store 层：消毒后同 slug 的二次保存必须 409，overwrite 才覆盖', async () => {
    const { store, root } = await freshStore()
    try {
      const first = await store.saveThemeFile('午夜深蓝')
      assert.equal(first.slug, '午夜深蓝')
      // '午夜?深蓝' 消毒后落盘名与 '午夜深蓝' 同档 —— 曾直接覆盖（UI 查重比的是原名，拦不住）。
      await assert.rejects(
        () => store.saveThemeFile('午夜?深蓝'),
        (error) => error.status === 409,
        'safeName 碰撞的二次保存曾静默覆盖已有主题档（绕过覆盖确认）',
      )
      const forced = await store.saveThemeFile('午夜?深蓝', { overwrite: true })
      assert.equal(forced.slug, '午夜深蓝', '显式覆盖走同一个 slug')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('http 层：POST /api/themes 二次同档 409，body.overwrite=true 才放行', async () => {
    await withServer(async ({ store, base }) => {
      const key = { 'x-dts-key': store.writeToken, 'content-type': 'application/json' }
      const first = await fetch(`${base}${PREFIX}/api/themes`, {
        method: 'POST', headers: key, body: JSON.stringify({ name: '午夜深蓝' }),
      })
      assert.equal(first.status, 201)
      // '午夜?深蓝' 消毒后 = '午夜深蓝' 同档。
      const again = await fetch(`${base}${PREFIX}/api/themes`, {
        method: 'POST', headers: key, body: JSON.stringify({ name: '午夜?深蓝' }),
      })
      assert.equal(again.status, 409, '消毒后同档的保存曾静默覆盖')
      const forced = await fetch(`${base}${PREFIX}/api/themes`, {
        method: 'POST', headers: key, body: JSON.stringify({ name: '午夜?深蓝', overwrite: true }),
      })
      assert.equal(forced.status, 201)
    })
  })
})

describe('回归锁 L1 · SSE keepalive 不再互相广播', () => {
  it('两个客户端各自只收到自己连接的 ping（曾 N 连接 N² 写）', async () => {
    await withServer(async ({ port }) => {
      const path = `${PREFIX}/api/events`
      const clients = []
      for (let i = 0; i < 2; i += 1) {
        const counter = { count: 0 }
        await new Promise((resolve) => {
          const req = httpRequest({ host: '127.0.0.1', port, path }, (res) => {
            res.on('data', (chunk) => {
              counter.count = (String(chunk).match(/: ping/g) ?? []).length + counter.count
            })
            resolve(undefined)
          })
          req.end()
          clients.push({ req, counter })
        })
      }
      await tick(400)
      for (const client of clients) client.req.destroy()
      // keepAliveMs=25 → 400ms 约 16 个周期。单连接只该有自己的 ≈16 条；
      // 曾经每条 interval 广播给全体，单连接实收 ≈32 条。
      const ceiling = Math.ceil(400 / 25) + 3
      for (const client of clients) {
        assert.ok(client.counter.count >= 1, 'keepalive 应保持连接活跃')
        assert.ok(client.counter.count <= ceiling,
          `单连接收到 ${String(client.counter.count)} 条 ping，超过自身周期数上限 ${String(ceiling)} —— keepalive 在替别的连接广播`)
      }
    }, { keepAliveMs: 25 })
  })
})

describe('回归锁 L2 · 损坏主题档不裸抛', () => {
  it('readThemeFile 对非 JSON 档报 400（曾裸 SyntaxError → 500）', async () => {
    const { store, root } = await freshStore()
    try {
      await mkdir(join(root, 'themes'), { recursive: true })
      await writeFile(join(root, 'themes', 'broken.json'), 'not-json{{', 'utf8')
      await assert.rejects(
        () => store.readThemeFile('broken'),
        (error) => error.status === 400 && /损坏/.test(String(error.message)),
        '损坏档曾把解析器原文抛成 500，与 listThemeFiles「坏文件不拖垮整表」口径不一致',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('http 层：载入损坏档返回 4xx 而不是 5xx', async () => {
    await withServer(async ({ store, base }) => {
      await mkdir(join(store.root, 'themes'), { recursive: true })
      await writeFile(join(store.root, 'themes', 'broken.json'), 'not-json{{', 'utf8')
      const res = await fetch(`${base}${PREFIX}/api/themes/load`, {
        method: 'POST',
        headers: { 'x-dts-key': store.writeToken, 'content-type': 'application/json' },
        body: JSON.stringify({ slug: 'broken' }),
      })
      assert.ok(res.status >= 400 && res.status < 500, `实际 ${String(res.status)}`)
    })
  })
})

describe('回归锁 L4 · 写口令行永不缺席', () => {
  it('store 未就绪（init 失败）时 index-inject 仍下发写口令行（曾整段跳过）', async () => {
    // 数据根指向一个**文件**：mkdir 必失败 → init reject → store.state 永远 null，
    // 复刻「初始化窗口/初始化失败」时的首屏注入路径。
    const tmp = await mkdtemp(join(tmpdir(), 'dts-audit-l4-'))
    const blocker = join(tmp, 'blocker')
    await writeFile(blocker, 'x', 'utf8')
    const previous = process.env.DSH_THEME_STUDIO_HOME
    process.env.DSH_THEME_STUDIO_HOME = blocker
    try {
      const events = []
      const ctx = {
        logger: { info() {}, warn() {}, error() {} },
        effect(fn) { const dispose = fn(); if (typeof dispose === 'function') events.push({ dispose }) },
        on(name, handler) { events.push({ name, handler }); return () => {} },
        get: () => undefined,
        inject(names, fn) { if (names.includes('webServer')) fn(ctx) },
        webServer: { register() { return () => {} } },
      }
      hostApply(ctx)
      await tick(60) // 等 init reject 完成
      const inject = events.find((item) => item.name === 'webserver/index-inject')
      assert.ok(inject, '应订阅 webserver/index-inject')
      const table = []
      inject.handler(table)
      assert.ok(table.length >= 1, 'store 未就绪时首屏注入曾整段跳过 —— 刷新后连写口令都拿不到')
      assert.equal(table[0].kind, 'global')
      assert.equal(table[0].name, '__DTS_BOOT__')
      assert.equal(typeof table[0].value.writeToken, 'string')
    } finally {
      if (previous === undefined) delete process.env.DSH_THEME_STUDIO_HOME
      else process.env.DSH_THEME_STUDIO_HOME = previous
      await rm(tmp, { recursive: true, force: true })
    }
  })
})
