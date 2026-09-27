/**
 * bundle 静态审计（借鉴姊妹工程 dsh-agent-instructions/tests/audit-bundle.mjs）：
 * 产物是**文本契约**（loader 按约定装载 closure-factory），文案键的错漏与产物形态
 * 漂移都不受类型检查覆盖，只能对产物本身显式查。
 *
 *   ① t()/tt() 引用的键必须在字典里 —— 缺这个检查时 `t('comon.failed')` 拼错
 *      不报任何错：取不到就返回 undefined，界面渲染成空白，静默得几乎无法察觉。
 *   ② 字典键必须被引用 —— 死键是漂移的温床（改文案时没人知道它还活不活）。
 *   ③ 产物打印器风格无关：引号可以是单/双、数字可省前导零（构建工具差异），
 *      锚一律按语义等价写，不为某一版打包器写死形态。
 *
 * 跑法： node --test test/audit-bundle.test.mjs
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'node:test'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'client.js'), 'utf8')

/**
 * 从产物里取「变量名 → 字典块」：`zh: {...}` / `en: {...}`（冒号后可带空格）。
 * 返回块文本、引号键、以及块里第一个真键的值 —— 值用来对账"注册进官方目录的
 * 到底是哪一份词典"，键用来跑既有的引用/死键/键集三条锁。
 */
function dictBlocks() {
  const out = {}
  for (const name of ['zh', 'en']) {
    const anchor = new RegExp(`${name}:\\s*\\{`)
    const match = anchor.exec(src)
    assert.ok(match, `找不到字典锚点：${name}: {`)
    const start = match.index + match[0].length - 1
    let depth = 0
    let end = start
    for (let i = start; i < src.length; i += 1) {
      const ch = src[i]
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) { end = i; break }
      }
    }
    const block = src.slice(start, end)
    // 引号双向：现行切片是单引号；r1-probe 实测 rolldown 产物会把属性键归一成双引号
    // （'tab.presets' → "tab.presets"）。两种形态都必须能提取，产线切换才不用返工。
    const keys = [...block.matchAll(/["']([a-z][A-Za-z0-9.]*)["']:/g)].map((m) => m[1])
    assert.ok(keys.length > 100, `${name} 字典块只提取到 ${String(keys.length)} 个键：锚点可能错了（抓到了 register 的 {zh, en} 短对象）`)
    const valueAt = new RegExp(`["']section\\.title["']\\s*:\\s*([\\s\\S]*?)\\n`).exec(block)
    assert.ok(valueAt, `${name} 字典块里找不到 section.title`)
    out[name] = { block, keys, value: valueAt[1].trim() }
  }
  return out
}

const dicts = dictBlocks()
const zh = dicts.zh
const en = dicts.en
/**
 * 去掉字典块与注释后的源码：引号键出现才算「被引用」（定义不算、注释示例不算）。
 * ⚠️ 块注释只配**行首开启**的：`accept: 'image/*'`、`'font/*'` 这类字符串字面量里的
 * `/*` 会把无锚定的正则戳穿，吞掉随后整段调用点（曾误报 38 个死键，实证）。
 */
const rest = src
  .replace(zh.block, '')
  .replace(en.block, '')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1')

it('bundle 审计 · t()/tt() 静态引用的键必须在字典里（拼错 = 界面静默空白）', () => {
  const dict = new Set(zh.keys)
  const called = new Set()
  // 只收「首参为引号字面量」的静态调用；三元/参数动态选键不在此列（当前 bundle 没有）。
  // 引号双向（同上：单引号切片 / bundler 双引号产物都认）。
  for (const m of rest.matchAll(/\b(?:t|tt)\(\s*["']([a-z][A-Za-z0-9.]*)["']/g)) called.add(m[1])
  assert.ok(called.size > 20, `静态调用解析失败（只扫到 ${String(called.size)} 个键）`)
  const missing = [...called].filter((key) => !dict.has(key))
  assert.deepEqual(missing, [], `这些键被 t()/tt() 调用但不在字典里：${missing.join(', ')}`)
})

it('bundle 审计 · 字典键必须被引用（死键清点）', () => {
  // 键名含点先转义；引号双向（单引号切片 / bundler 双引号产物都认）。
  const quoted = (key) => new RegExp('[\'"]' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]')
  const unused = zh.keys.filter((key) => !quoted(key).test(rest))
  assert.deepEqual(unused, [], `从未被引用的死文案键：${unused.join(', ')}`)
})

it('bundle 审计 · zh/en 键集一致，且键名只用小写点分段', () => {
  assert.deepEqual([...zh.keys].sort(), [...en.keys].sort(), 'zh/en 键集必须一致')
  for (const key of zh.keys) {
    assert.match(key, /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/, `键名不合点分段惯例：${key}`)
  }
})

it('bundle 审计 · 词典真的注册进官方 locale 服务（register(ns,{zh,en}) 与 MESSAGES 同源）', () => {
  // 官方契约（_official/dsh-client-locale/lib/client.js:1387）：
  //   register(ns, localeOrDicts, dict) —— 对象形态即 { zh, en }，两语言都必给。
  // 这里查的是"注册进官方目录的到底是不是 MESSAGES 里的那两块"：
  // 只断言"调用了 register"不够 —— 传空对象也能过，界面照样空白。
  const call = /register\([^)]*?\{\s*([\s\S]{0,120}?)\}\s*\)/.exec(src)
  assert.ok(call, 'client.js 里应有 locale.register(ns, { … }) 的注册点')
  const arg = call[1]
  const refZh = /(?:^|[,{\s])zh\s*:\s*([A-Za-z_$][\w$]*)\.zh/.exec(arg)
  const refEn = /(?:^|[,{\s])en\s*:\s*([A-Za-z_$][\w$]*)\.en/.exec(arg)
  assert.ok(refZh, `注册的第一个语言参数必须取自同一份词典对象的 .zh：${arg}`)
  assert.ok(refEn, `注册的第二个语言参数必须取自同一份词典对象的 .en：${arg}`)
  assert.equal(refZh[1], refEn[1], 'zh/en 必须来自同一个词典对象（同源不漂移）')

  // 命名空间常量：可判定的字符串字面量，且全产物只定义一次
  const ns = /LOCALE_NS\s*=\s*["']([^"']+)["']/.exec(src)
  assert.ok(ns, 'LOCALE_NS 必须是字符串字面量（键名空间不能算出来）')
  assert.equal(ns[1], 'dsh-theme-studio', '命名空间 = 包名（官方惯例是插件自有名）')
  assert.equal((src.match(/\bLOCALE_NS\s*=/g) ?? []).length, 1, 'LOCALE_NS 只许定义一次')
  assert.ok(src.includes('return registerLocaleDictionary(getLocaleService())'),
    '注册必须用 getLocaleService() 现取服务（不是抓一个 boot 期快照）')
})

it('bundle 审计 · 取文案走官方 bind(ns)，插值按官方具名参数折', () => {
  // 官方取文案面（locale/client.js:1414 bind / :1423 translate）：bind(ns) 返回
  // (key, params) => string；官方 renderer 的 localeSeat 也是这么用的（ui-renderer:531）。
  assert.match(src, /\.bind\(LOCALE_NS\)/, '取文案必须经官方 bind(LOCALE_NS)')
  assert.match(src, /getSnapshot\(\)[^;]*revision|revision[^;]*getSnapshot\(\)/,
    '绑定函数必须按官方 revision 判定是否重取（官方 renderer 同款缓存键）')
  // 官方插值是具名参数 `{name}`（:1427 正则 /\{(\w+)\}/g）；本表唯一的占位键是
  // 位置式 `{0}` —— 数字属 \w，所以位置参数折成 { '0': v } 后官方正则能命中。
  assert.match(src, /String\(i\)/, '位置参数必须折成官方具名参数对象（String(i) 键名）')
  assert.match(src, /\\\{\(\\d\+\)\\\}/, '本地兜底仍要保留 {n} 顺序替换（服务缺席时用）')
})

it('bundle 审计 · 语言权威源是 locale 服务，<html lang> 只当兜底', () => {
  // 降级链顺序：locale 服务 → <html lang> → navigator.language。
  // 这里只查"三源都在、且服务在前"（源码顺序，不做 minify 形态耦合的行为断言）。
  const src_i18n = readFileSync(join(here, '..', 'src', 'client', 'i18n.ts'), 'utf8')
  const body = /export function currentLang\(\)\s*\{([\s\S]*?)\n        \}/.exec(src_i18n)
  assert.ok(body, 'src/client/i18n.ts 里应有 currentLang 实现')
  const atService = body[1].indexOf('getSnapshot')
  const atDoc = body[1].indexOf('documentElement.lang')
  const atNav = body[1].indexOf('navigator.language')
  assert.ok(atService >= 0 && atDoc >= 0 && atNav >= 0, 'currentLang 的三个来源都必须保留')
  assert.ok(atService < atDoc && atDoc < atNav,
    '权威源顺序必须是 locale 服务 → <html lang> → navigator（降级链不再是主路径）')
  // t() 必须先问官方，本地词典在后
  const tfn = /export function t\(key: string[\s\S]*?\n        \}/.exec(src_i18n)
  assert.ok(tfn, 'src/client/i18n.ts 里应有 t() 实现')
  const atOfficial = tfn[0].indexOf('boundTranslate()')
  const atLocal = tfn[0].indexOf('localTemplate(')
  assert.ok(atOfficial >= 0 && atLocal >= 0, 't() 必须同时有官方面与本地兜底面')
  assert.ok(atOfficial < atLocal, 't() 必须先走官方 API，本地词典是兜底')
})

it('bundle 审计 · 颜色公式单一真源（D3 根治哨兵）', () => {
  const core = readFileSync(join(here, '..', 'lib', 'color-core.js'), 'utf8')
  const engine = readFileSync(join(here, '..', 'lib', 'engine.js'), 'utf8')
  // WCAG 通道公式的无歧义常量：只许活在 color-core 一份。
  // ⚠️ 产物字面量形态由生产方打印器决定：手写切片写 `0.2126`，rolldown 省略前导零
  // 成 `.2126`（TS 产线实测）。哨兵认「同一数字的两种写法」，且必须恰好 1 份 ——
  // 谁再养副本都逃不掉；公式若被常量折叠，计数会掉到 0 而在这里暴露。
  const countIn = (text, marker) => {
    const re = new RegExp(`(?:^|[^\\d.])0?\\${marker.slice(1)}(?![\\d])`, 'g')
    return (text.match(re) ?? []).length
  }
  for (const marker of ['0.03928', '1.055', '0.2126', '0.7152', '0.0722']) {
    assert.ok(core.includes(marker), `color-core.js 缺公式常量 ${marker}`)
    assert.ok(!engine.includes(marker), `engine.js 不该再养公式副本（真源在 color-core）：${marker}`)
    const n = countIn(src, marker)
    assert.equal(n, 1, `client.js 中 ${marker} 应恰好 1 份（color-core 内联，允许省略前导零写法），实际 ${String(n)} 份`)
  }
  // 0.36 明暗阈值：真源定义在 core（prefersLightText），client 玻璃自愈按语义引用。
  assert.ok(core.includes('0.36'), 'color-core.js 缺明暗阈值 0.36')
  assert.ok(countIn(src, '0.36') >= 1, 'client.js 应保留 0.36 明暗阈值')
})

it('bundle 审计 · locale/*.json 只放市场元信息，文案唯一真源是 MESSAGES', () => {
  // 这是"两套真相"的哨兵：locale/*.json 会随包发布（package.json exports
  // ./locale/*.json），谁哪天往里塞半份词典，界面文案就有了第二个权威源，
  // 而 audit-bundle 的键集一致性只查 bundle 内部 —— 照样全绿、照样漂移。
  for (const name of ['zh.json', 'en.json']) {
    const parsed = JSON.parse(readFileSync(join(here, '..', 'locale', name), 'utf8'))
    assert.deepEqual(Object.keys(parsed).sort(), ['meta'],
      `${name} 顶层只许 meta：文案唯一真源是 bundle 里的 MESSAGES`)
    assert.equal(typeof parsed.meta?.title, 'string', `${name} 缺 meta.title`)
    assert.equal(typeof parsed.meta?.description, 'string', `${name} 缺 meta.description`)
    assert.ok(String(parsed.meta.title).trim() !== '', `${name} meta.title 不该是空串`)
    assert.ok(String(parsed.meta.description).trim() !== '', `${name} meta.description 不该是空串`)
  }
})
