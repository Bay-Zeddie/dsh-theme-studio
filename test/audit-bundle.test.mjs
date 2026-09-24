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

/** 抠出 MESSAGES 里某个语言字典的块文本（括号平衡），再提取引号键。 */
function dictKeys(anchor) {
  const start = src.indexOf(anchor)
  assert.ok(start >= 0, `找不到字典锚点：${anchor}`)
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
  return { block, keys: [...block.matchAll(/["']([a-z][A-Za-z0-9.]*)["']:/g)].map((m) => m[1]) }
}

const zh = dictKeys('zh: {')
const en = dictKeys('en: {')
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
