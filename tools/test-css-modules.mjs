/**
 * ============================================================================
 * dsh-theme-studio — CSS Modules 编译器自测（零依赖）
 * ============================================================================
 *
 *   node tools/test-css-modules.mjs
 *
 * 覆盖三块：
 *   A. 纯函数 `compileCssModule` 的行为（类名作用域 / 误伤防护 / 关键帧 / 结构与压缩 / hash 确定性）
 *   B. 模块源码形态与官方 `dsh-css` 产物逐字同构（含 <style> 注入的幂等语义）
 *   C. 真 rolldown 打包集成：插件 resolveId/load 端到端可用，产物能正确拿到类名映射
 *
 * 全部 PASS 时 exit 0；任何一条 FAIL 则打印失败明细并 exit 1。
 * 零依赖：只用 `node:` 内置 + 项目已装的 rolldown（集成用例；缺失时该条记为 SKIP 而非 FAIL）。
 * ============================================================================
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { compileCssModule, cssModules } from './css-modules.mjs'

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(TOOLS_DIR, '..')
const PACKAGE_NAME = 'dsh-theme-studio'
const FIXTURE_DIR = join(TOOLS_DIR, '_tmp-css-fixture')

/** 被测用的「源码文件路径」——纯函数不读盘，只把它当身份用（决定 tagId 与 hash 的一部分）。 */
const FILE_A = `${ROOT}/src/client/chrome.module.css`
const FILE_B = `${ROOT}/src/client/tabs.module.css`

// ---------------------------------------------------------------------------
// 迷你断言框架
// ---------------------------------------------------------------------------

let passed = 0
const failures = []

/**
 * 断言一条用例（支持 async 用例体）。
 * @param {string} name 用例名
 * @param {() => void | Promise<void>} body 用例体；抛错/拒绝即 FAIL
 */
async function check(name, body) {
  try {
    await body()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failures.push({ name, message: error?.message ?? String(error) })
    console.log(`FAIL  ${name}\n        ${String(error?.message ?? error).split('\n').join('\n        ')}`)
  }
}

/** 断言相等（对象走 JSON 比较，数组/对象字面量都能读）。 */
function eq(actual, expected, hint = '') {
  const a = typeof actual === 'object' && actual !== null ? JSON.stringify(actual) : String(actual)
  const b = typeof expected === 'object' && expected !== null ? JSON.stringify(expected) : String(expected)
  if (a !== b) throw new Error(`${hint}期望 ${b}\n       实际 ${a}`)
}

/** 断言包含子串。 */
function includes(haystack, needle, hint = '') {
  if (!String(haystack).includes(needle)) throw new Error(`${hint}未找到 ${JSON.stringify(needle)}\n       在 ${JSON.stringify(String(haystack))}`)
}

/** 断言不包含子串。 */
function excludes(haystack, needle, hint = '') {
  if (String(haystack).includes(needle)) throw new Error(`${hint}不应出现 ${JSON.stringify(needle)}\n       在 ${JSON.stringify(String(haystack))}`)
}

/** 断言为真。 */
function ok(value, message) {
  if (!value) throw new Error(message)
}

/** 断言抛出错误且信息匹配。 */
function throws(fn, pattern) {
  let caught = null
  try {
    fn()
  } catch (error) {
    caught = error
  }
  if (caught === null) throw new Error(`期望抛出错误（匹配 ${pattern}），但没有抛`)
  if (pattern !== undefined && !pattern.test(caught.message)) {
    throw new Error(`错误信息不匹配 ${pattern}\n       实际 ${caught.message}`)
  }
}

/** 编译一段 CSS（默认用 FILE_A 作身份）。 */
const compile = (css, file = FILE_A) => compileCssModule(css, { file, root: ROOT, packageName: PACKAGE_NAME })

/** 取一段 CSS 编译后的短 hash（同一文件同一内容必然一致）。 */
const hashOf = (css, file = FILE_A) => {
  const first = Object.values(compile(css, file).classMap)[0]
  if (first === undefined) throw new Error(`用例需要至少一个 localName：${JSON.stringify(css)}`)
  return first.split('_')[0]
}

// ===========================================================================
// 1 · 类名与作用域
// ===========================================================================

console.log('\n=== 1 · 类名与作用域 ===')

await check('1.1 简单 .a → 类名 <6位hash>_a，CSS 里同步替换', () => {
  const { css, classMap } = compile('.a{color:red}')
  const scoped = classMap.a
  ok(/^[0-9A-Za-z]{6}_a$/.test(scoped), `类名形态应为 <6位base62>_a，实际 ${scoped}`)
  eq(css, `.${scoped}{color:red}`)
  eq(classMap, { a: scoped })
})

await check('1.2 多类 .a.b / 后代 .a .b / 并列 .a,.b 全部作用域化', () => {
  const { css, classMap } = compile('.a.b{color:red}.a .b{x:1}.a,.b{y:2}')
  eq(Object.keys(classMap), ['a', 'b'])
  eq(css, `.${classMap.a}.${classMap.b}{color:red}.${classMap.a} .${classMap.b}{x:1}.${classMap.a},.${classMap.b}{y:2}`)
})

await check('1.3 伪类 .a:hover / 伪元素 .a::before / :not(.b) 里的类名都作用域化', () => {
  const { css, classMap } = compile('.a:hover{color:red}.a::before{content:""}.c:not(.b){color:blue}')
  includes(css, `.${classMap.a}:hover{`)
  includes(css, `.${classMap.a}::before{`)
  includes(css, `.${classMap.c}:not(.${classMap.b}){`)
  eq(Object.keys(classMap).sort(), ['a', 'b', 'c'])
})

await check('1.4 :global(...) 包裹的类名原样保留，不替换、不进 classMap', () => {
  const { css, classMap } = compile(':global(.dsw-x){color:red}.a{color:blue}')
  includes(css, ':global(.dsw-x){')
  excludes(css, `_dsw-x`, ':global 里的类名不该被作用域化')
  eq(classMap, { a: classMap.a })
  eq(Object.keys(classMap), ['a'])
})

await check('1.5 :global(.a .b) 整段 + :global(.a):hover .b 局部，都只跳过 global 内部', () => {
  const whole = compile(':global(.dsw-x .dsw-y){color:red}')
  eq(whole.css, ':global(.dsw-x .dsw-y){color:red}')
  eq(whole.classMap, {})

  const partial = compile(':global(.dsw-x):hover .b{color:red}')
  includes(partial.css, ':global(.dsw-x):hover .')
  includes(partial.css, `_b{color:red}`)
  eq(Object.keys(partial.classMap), ['b'])
})

await check('1.6 :global { ... } 块形式整块原样保留', () => {
  const { css, classMap } = compile(':global{.dsw-x{color:red}}.a{color:blue}')
  includes(css, ':global{.dsw-x{color:red}}')
  eq(Object.keys(classMap), ['a'])
})

await check('1.7 类名里的 - _ 数字：.dts-glass-fill / .a_1 / .b-2', () => {
  const { css, classMap } = compile('.dts-glass-fill{}.a_1{}.b-2{}')
  eq(Object.keys(classMap).sort(), ['a_1', 'b-2', 'dts-glass-fill'])
  for (const local of ['dts-glass-fill', 'a_1', 'b-2']) {
    includes(css, `.${classMap[local]}{}`)
    ok(classMap[local].endsWith(`_${local}`), `${local} → ${classMap[local]}`)
  }
})

await check('1.8 转义类名 .a\\:b / .x\\.y 整段读入并作用域化（转义序列不被截断）', () => {
  const { css, classMap } = compile('.a\\:b{color:red}.x\\.y{color:green}')
  eq(Object.keys(classMap).sort(), ['a\\:b', 'x\\.y'])
  includes(css, `.${classMap['a\\:b']}{color:red}`)
  includes(css, `.${classMap['x\\.y']}{color:green}`)
  ok(classMap['a\\:b'].endsWith('_a\\:b'), `转义序列应原样保留在 scoped 名里：${classMap['a\\:b']}`)
})

// ===========================================================================
// 2 · 误伤防护（最重要）
// ===========================================================================

console.log('\n=== 2 · 误伤防护 ===')

await check('2.1 属性选择器里的点与字符串：[class$="_card"] [data-x=".a"] 全不动', () => {
  const { css, classMap } = compile('[class$="_card"]{color:red}[data-x=".a"]{y:1}')
  eq(css, '[class$="_card"]{color:red}[data-x=".a"]{y:1}')
  eq(classMap, {})
})

await check('2.2 注释里的类名不被替换，且注释被压缩掉', () => {
  const { css, classMap } = compile('/* .a { color: red } */.b{color:red}')
  excludes(css, '/*', '注释应被压缩掉')
  includes(css, `_b{color:red}`)
  eq(Object.keys(classMap), ['b'])
})

await check('2.3 字符串 content:"v1.2" 与 url("a.b.png") 里的点不动', () => {
  const { css, classMap } = compile('.a{content:"v1.2"}.b{background:url("a.b.png")}')
  includes(css, 'content:"v1.2"')
  includes(css, 'url("a.b.png")')
  eq(Object.keys(classMap), ['a', 'b'])
})

await check('2.4 裸 url(a.b.png)（无引号）里的点不动', () => {
  const { css, classMap } = compile('.a{background:url(./a.b.png)}')
  includes(css, 'url(./a.b.png)')
  eq(Object.keys(classMap), ['a'])
})

await check('2.5 自定义属性与 var()：--dts-x: var(--dsw-y) 里的 -- 不动', () => {
  const { css, classMap } = compile('.a{--dts-x:var(--dsw-y);--dts-y:1px}')
  includes(css, '--dts-x:var(--dsw-y)')
  includes(css, '--dts-y:1px')
  eq(Object.keys(classMap), ['a'])
})

await check('2.6 数值 1.5px / translate3d(0,0,0) / cubic-bezier(.4,0,.2,1) 里的点不动', () => {
  const input = '.a{margin:1.5px;transform:translate3d(0,0,0);transition-timing-function:cubic-bezier(.4,0,.2,1)}'
  const { css, classMap } = compile(input)
  includes(css, 'margin:1.5px')
  includes(css, 'translate3d(0,0,0)')
  includes(css, 'cubic-bezier(.4,0,.2,1)')
  eq(Object.keys(classMap), ['a'])
})

await check('2.7 rgba(16,20,24,.28) 里的 .28 不被当类名', () => {
  const { css, classMap } = compile('.a{color:rgba(16,20,24,.28);border-color:rgb(0 0 0/.5)}')
  includes(css, 'rgba(16,20,24,.28)')
  includes(css, 'rgb(0 0 0/.5)')
  eq(Object.keys(classMap), ['a'])
})

await check('2.8 数值之间删空白不粘连：padding:1.5px 4px 不被压成 1.54px', () => {
  const { css } = compile('.a{padding:1.5px 4px 2px 3px}')
  includes(css, '1.5px 4px')
  excludes(css, '1.54px')
})

await check('2.9 @media / @supports 前奏里的数值与括号不被当成选择器改类名', () => {
  const { css, classMap } = compile('@media (min-width:37.5em) and (max-width:64em){.a{color:red}}@supports (display:grid){.b{color:blue}}')
  includes(css, '@media(min-width:37.5em)')
  includes(css, 'and(max-width:64em){')
  includes(css, '@supports(display:grid){')
  eq(Object.keys(classMap).sort(), ['a', 'b'])
  excludes(css, '_and', '前奏里的关键字不该被作用域化')
  excludes(css, '_em', '前奏里的数值单位不该被作用域化')
})

await check('2.10 :nth-child(2n+1) / :is() / :where() 里的点与加号不被误伤', () => {
  const { css, classMap } = compile('.a:nth-child(2n+1) .b:is(.c, .d):where(.e){color:red}')
  eq(Object.keys(classMap).sort(), ['a', 'b', 'c', 'd', 'e'])
  includes(css, ':nth-child(2n+1)')
  includes(css, `:is(.${classMap.c},.${classMap.d})`)
  includes(css, `:where(.${classMap.e})`)
})

// ===========================================================================
// 3 · 关键帧
// ===========================================================================

console.log('\n=== 3 · 关键帧 ===')

await check('3.1 @keyframes spin 的 spin 被 scoped，animation / animation-name 引用同步改名', () => {
  const { css, classMap } = compile('@keyframes spin{from{opacity:0}to{opacity:1}}.a{animation:spin 1s linear}.b{animation-name:spin}')
  const hash = classMap.a.split('_')[0]
  includes(css, `@keyframes ${hash}_spin{`)
  includes(css, `animation:${hash}_spin 1s linear`)
  includes(css, `animation-name:${hash}_spin`)
  excludes(css, 'animation:spin ')
  excludes(css, 'animation-name:spin')
  // 关键帧名不是类名，不该进 classMap
  eq(Object.keys(classMap), ['a', 'b'])
})

await check('3.2 @keyframes 内的 from / to / 50% 不动', () => {
  const { css } = compile('@keyframes spin{0%{opacity:0}from{opacity:.2}50%{opacity:.5}to{opacity:1}}')
  includes(css, '0%{opacity:0}')
  includes(css, 'from{opacity:.2}')
  includes(css, '50%{opacity:.5}')
  includes(css, 'to{opacity:1}')
})

await check('3.3 @keyframes 块内不做任何类名猜测，且类名不进 classMap', () => {
  const { css, classMap } = compile('@keyframes spin{from{opacity:0}to{opacity:1}}.a{animation:spin 1s}')
  eq(Object.keys(classMap), ['a'])
  excludes(css, `_from`, '关键帧选择器 from 不该被作用域化')
  excludes(css, `_to`, '关键帧选择器 to 不该被作用域化')
  // 关键帧名本身被改名，但它是动画名不是类名
  ok(!Object.keys(classMap).includes('spin'), 'spin 是动画名，不该出现在 classMap')
})

await check('3.4 @-webkit-keyframes 前缀形态同样处理', () => {
  const { css, classMap } = compile('@-webkit-keyframes spin{from{opacity:0}}.a{animation:spin 1s}')
  const hash = classMap.a.split('_')[0]
  includes(css, `@-webkit-keyframes ${hash}_spin{`)
  includes(css, `animation:${hash}_spin 1s`)
})

await check('3.5 未定义的关键帧引用不改名（避免把同名的普通标识符改掉）', () => {
  const { css } = compile('.a{animation:unknown 1s;transition-timing-function:ease}')
  includes(css, 'animation:unknown 1s')
  includes(css, 'ease')
})

await check('3.6 animation 值里的字符串/注释不会被误当动画名', () => {
  const { css, classMap } = compile('@keyframes spin{to{opacity:1}}.a{animation:spin 1s}.b{content:"spin"}')
  const hash = classMap.a.split('_')[0]
  includes(css, `animation:${hash}_spin 1s`)
  includes(css, 'content:"spin"')
})

// ===========================================================================
// 4 · 结构与压缩
// ===========================================================================

console.log('\n=== 4 · 结构与压缩 ===')

await check('4.1 @media / @supports / 嵌套块内类名照常作用域化', () => {
  const { css, classMap } = compile(
    '@media (min-width:600px){.a{color:red}}@supports (display:grid){.b{display:grid}}@layer base{.c{color:blue}}',
  )
  eq(Object.keys(classMap).sort(), ['a', 'b', 'c'])
  includes(css, `_a{color:red}`)
  includes(css, `_b{display:grid}`)
  includes(css, `_c{color:blue}`)
  includes(css, '@supports(display:grid){')
  includes(css, '@layer base{')
})

await check('4.2 压缩：无注释、无多余空白、前导零 shave、尾零归一、零值单位与盒模型简写折叠', () => {
  const { css } = compile(`
    /* 头注释 */
    .a , .b > .c {
      color : red ;
      padding : 0px 0px 0px 0px ;
      border-radius : 0 0 0 0 ;
      background : 0 0 ;
      line-height : 0.5 ;
      opacity : 0.25 ;
      margin : 1.50px ;
    }
  `)
  excludes(css, '/*')
  excludes(css, '\n')
  excludes(css, '  ')
  excludes(css, '0px')
  excludes(css, '0.5')
  excludes(css, '0.25')
  excludes(css, '1.50')
  includes(css, 'padding:0;')
  includes(css, 'border-radius:0;')
  // ⚠️ `background` 不在盒模型简写白名单里：`0 0` 必须原样保留（官方产物同形，别动它）
  includes(css, 'background:0 0;')
  includes(css, 'line-height:.5')
  includes(css, 'opacity:.25')
  includes(css, 'margin:1.5px')
  includes(css, 'color:red')
})

await check('4.3 组合符两侧空白删除，但 +（calc 运算符）保守保留', () => {
  const { css } = compile('.a > .b , .c ~ .d{color:red}.e{width:calc(100% + 10px)}')
  includes(css, '>.')
  includes(css, '~.')
  includes(css, ',.')
  includes(css, 'calc(100% + 10px)')
})

await check('4.4 :root / @font-face / @property 等声明型块不被误判', () => {
  const { css, classMap } = compile(
    ':root{--dts-x:1px}@font-face{font-family:"X";src:url(a.woff2)}@property --dts-y{syntax:"<length>";inherits:false}',
  )
  eq(classMap, {})
  includes(css, ':root{--dts-x:1px}')
  includes(css, '@font-face{font-family:"X";src:url(a.woff2)}')
  includes(css, '@property --dts-y{')
})

await check('4.5 声明块里的嵌套规则（含 &）正确区分声明与嵌套选择器', () => {
  const { css, classMap } = compile('.a{color:red;&:hover{color:blue}.b{color:green}.c .d{color:gray}}')
  eq(Object.keys(classMap).sort(), ['a', 'b', 'c', 'd'])
  includes(css, `&:hover{color:blue}`)
  includes(css, `.${classMap.b}{color:green}`)
  includes(css, `.${classMap.c} .${classMap.d}{color:gray}`)
})

await check('4.6 !important 与逗号分隔声明保持正确形状', () => {
  const { css } = compile('.a{color:red !important;font:12px/1.5 sans-serif;transition:color .2s,opacity .3s}')
  includes(css, 'color:red !important')
  includes(css, 'font:12px/1.5 sans-serif')
  includes(css, 'transition:color .2s,opacity .3s')
})

// ---------------------------------------------------------------------------
// 4.x · 盒模型简写等价折叠 与 数值尾零归一（本次补充的压缩规则）
//
// 折叠口径：只做**逐槽位等价**的化简，四值语义是「上 右 下 左」——
//   `a a a a` → `a`   /   `a b a b` → `a b`   /   `a b c b` → `a b c`（递归）
// 非等价四值绝不化简（`0 0 0 1px` 折成 `0 1px` 就是 `0 1px 0 1px`，语义变了）。
// 官方 dist 产物同款实证：源 `padding:6px 8px 8px 8px` → 产物 `padding:6px 8px 8px`，
// 而 `padding:0 0 0 10px` / `inset:4px auto 4px 4px` 原样保留。
// ---------------------------------------------------------------------------

await check('4.7 盒模型四值全同 `a a a a` → `a`（padding / margin / border-radius / border-width）', () => {
  const { css } = compile(
    '.a{padding:0 0 0 0}.b{margin:10px 10px 10px 10px}.c{border-radius:50% 50% 50% 50%}.d{border-width:thin thin thin thin}',
  )
  includes(css, 'padding:0}')
  includes(css, 'margin:10px}')
  includes(css, 'border-radius:50%}')
  includes(css, 'border-width:thin}')
  excludes(css, 'padding:0 0')
  excludes(css, 'margin:10px 10px')
  excludes(css, 'border-radius:50% 50%')
})

await check('4.8 盒模型四值交替 `a b a b` → `a b`', () => {
  const { css } = compile('.a{margin:10px 20px 10px 20px}.b{padding:8px 0 8px 0}.c{inset:4px 8px 4px 8px}')
  includes(css, 'margin:10px 20px}')
  includes(css, 'padding:8px 0}')
  includes(css, 'inset:4px 8px}')
  excludes(css, 'margin:10px 20px 10px 20px')
  excludes(css, 'padding:8px 0 8px 0')
  excludes(css, 'inset:4px 8px 4px 8px')
})

await check('4.9 盒模型四值 `a b c b` → `a b c`（左 = 右，与官方 dist 产物同款）', () => {
  const { css } = compile('.a{padding:6px 8px 8px 8px}.b{padding:1px 2px 3px 2px}.c{margin:0 4px 12px 4px}')
  includes(css, 'padding:6px 8px 8px}')
  includes(css, 'padding:1px 2px 3px}')
  includes(css, 'margin:0 4px 12px}')
  excludes(css, 'padding:6px 8px 8px 8px')
  excludes(css, 'padding:1px 2px 3px 2px')
  excludes(css, 'margin:0 4px 12px 4px')
})

await check('4.10 非等价四值必须原样保留（不得跨槽位折叠改语义）', () => {
  const { css } = compile(
    '.a{margin:0 0 0 1px}.b{padding:1px 2px 3px 4px}.c{inset:4px auto 4px 4px}.d{padding:0 0 0 10px}.e{margin:1px 0 0 12px}',
  )
  // `margin:0 0 0 1px` 折成 `0 1px` 就变成 `0 1px 0 1px` 了 —— 必须保持四值
  includes(css, 'margin:0 0 0 1px')
  includes(css, 'padding:1px 2px 3px 4px')
  includes(css, 'inset:4px auto 4px 4px') // 左(4px) ≠ 右(auto)
  includes(css, 'padding:0 0 0 10px') // 左(10px) ≠ 右(0)
  includes(css, 'margin:1px 0 0 12px')
  excludes(css, 'margin:0 1px')
  excludes(css, 'inset:4px auto 4px}')
})

await check('4.11 三值 / 两值等价折叠：`a b a` → `a b`、`a a` → `a`', () => {
  const { css } = compile(
    '.a{padding:1px 2px 1px}.b{border-color:red blue red}.c{gap:8px 8px}.d{margin:10px 10px}.e{border-radius:4px 4px}.f{padding:1px 2px 3px}',
  )
  includes(css, 'padding:1px 2px}')
  includes(css, 'border-color:red blue}')
  includes(css, 'gap:8px}')
  includes(css, 'margin:10px}')
  includes(css, 'border-radius:4px}')
  includes(css, 'padding:1px 2px 3px') // `a b c`（下 ≠ 上）不能再折
  excludes(css, 'padding:1px 2px 1px')
  excludes(css, 'gap:8px 8px')
  excludes(css, 'border-radius:4px 4px')
})

await check('4.12 语义敏感属性明确不折叠：grid-template-columns / background / font / transition / overflow', () => {
  const { css } = compile(
    '.a{grid-template-columns:1fr 1fr 1fr 1fr}.b{background:0 0}.c{font:12px/1.5 sans-serif}.d{transition:color .2s,opacity .2s}.e{overflow:hidden hidden}',
  )
  // 四条轨道折成一条就是布局灾难（不是「四边」语义）；`background:0 0` 是官方产物原形
  includes(css, 'grid-template-columns:1fr 1fr 1fr 1fr')
  includes(css, 'background:0 0')
  includes(css, 'font:12px/1.5 sans-serif')
  includes(css, 'transition:color .2s,opacity .2s')
  includes(css, 'overflow:hidden hidden')
  excludes(css, 'grid-template-columns:1fr}')
  excludes(css, 'background:0}')
})

await check('4.13 数值尾零归一：1.50px → 1.5px、1.0 → 1、0.250 → .25、10.00px → 10px', () => {
  const { css } = compile('.a{margin:1.50px;line-height:1.0;opacity:0.250;width:10.00px;z-index:2.0;padding:1.05px}')
  includes(css, 'margin:1.5px')
  includes(css, 'line-height:1;')
  includes(css, 'opacity:.25')
  includes(css, 'width:10px')
  includes(css, 'z-index:2;')
  includes(css, 'padding:1.05px') // 中间那个 0 不能动
  excludes(css, '1.50')
  excludes(css, 'line-height:1.0')
  excludes(css, '10.00')
})

await check('4.14 尾零 + 前导零 + 零值单位叠加：0.50px → .5px、0.0px 与 .0px 都 → 0', () => {
  const { css } = compile(
    '.a{padding:0.50px}.b{margin:0.0px}.c{line-height:0.50}.d{padding:0.00 1px 0.0 1px}.e{width:.0px}.f{transition:opacity .20s}.g{width:.50px}',
  )
  includes(css, 'padding:.5px')
  includes(css, 'margin:0}')
  includes(css, 'line-height:.5')
  // `0.00 / 0.0` 先归一成 `0`，再依四值规则折成 `0 1px`（= `0 1px 0 1px`）
  includes(css, 'padding:0 1px}')
  // 裸小数（`.0px` / `.50px`）与大写零（`0.0px` / `0.50px`）是同一个值，必须同样归一
  includes(css, 'width:0}')
  includes(css, 'width:.5px')
  includes(css, 'transition:opacity .2s')
  excludes(css, '0.5')
  excludes(css, '0.0')
  excludes(css, '.0px')
})

await check('4.15 尾零归一不误伤字符串与 url 内容', () => {
  const { css } = compile('.a{content:"1.50"}.b{background:url(v1.50.png)}.c{content:"padding:0 0 0 0"}')
  includes(css, 'content:"1.50"')
  includes(css, 'url(v1.50.png)')
  includes(css, 'content:"padding:0 0 0 0"')
})

await check('4.16 `!important` 前的盒模型简写同样折叠（`!` 结束值但不能漏掉折叠）', () => {
  const { css } = compile('.a{padding:0 0 0 0 !important}.b{margin:10px 20px 10px 20px !important}.c{color:red !important}')
  includes(css, 'padding:0!important')
  includes(css, 'margin:10px 20px!important')
  includes(css, 'color:red !important') // 非白名单属性原样
  excludes(css, 'padding:0 0 0 0 !important')
})

// ===========================================================================
// 5 · hash 确定性与跨文件隔离
// ===========================================================================

console.log('\n=== 5 · hash 确定性与跨文件隔离 ===')

await check('5.1 同文件同内容两次编译 hash 相同（无随机源）', () => {
  const a = compile('.a{color:red}')
  const b = compile('.a{color:red}')
  eq(a.classMap, b.classMap, 'hash 必须确定：')
  eq(a.css, b.css)
  eq(a.code, b.code)
})

await check('5.2 内容变化 → hash 变化', () => {
  const a = hashOf('.a{color:red}')
  const b = hashOf('.a{color:blue}')
  const c = hashOf('.a{color:red}/* x */')
  ok(a !== b, `内容变化 hash 未变：${a}`)
  ok(a !== c, `内容变化 hash 未变：${a}`)
})

await check('5.3 不同文件、同 localName → 不同 hash（避免跨文件碰撞）', () => {
  const a = hashOf('.a{color:red}', FILE_A)
  const b = hashOf('.a{color:red}', FILE_B)
  ok(a !== b, `跨文件 hash 相同：${a}`)
  ok(a.length === 6 && b.length === 6, 'hash 长度必须是 6')
})

await check('5.4 hash 是 6 位标识符（首字符必为字母，其余 base62），且由 sha256 派生（可独立复算）', () => {
  const css = '.a{color:red}'
  const relativePath = 'src/client/chrome.module.css'
  const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const B52 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const digest = createHash('sha256').update(`${relativePath}\u0000${css}`, 'utf8').digest()
  // ⚠️ 首字符必须来自字母集：CSS 标识符不许以数字开头，而 base62 首字符有 10/62 概率是数字 ——
  // 一旦命中，整条规则在真实浏览器里静默作废（cssRules.length === 0，形如 `.5Al7WO_dtsInputWrap`）。
  // 本机真机渲染冒烟实测命中过 Input/TextField 两个模块，无报错、无提示，只有量 cssRules 才看得见。
  let expected = B52[digest[0] % 52]
  for (let i = 1; i < 6; i += 1) expected += B62[digest[i] % 62]
  eq(hashOf(css), expected, 'hash 应等于 sha256(相对路径\\0内容) 首字节 % 52 + 其余 % 62 查表：')
  ok(/^[A-Za-z][0-9A-Za-z]{5}$/.test(expected), 'hash 必须是合法 CSS 标识符：首字符字母 + 其余 5 位 base62')
})

await check('5.5 同一 localName 在文件内多处出现 → 同一次编译内映射一致', () => {
  const { css, classMap } = compile('.a{color:red}.a .a{color:blue}.x.a{color:green}')
  const occurrences = css.split(classMap.a).length - 1
  eq(occurrences, 4, '同一个 localName 的所有出现都应替换成同一个 scoped 名：')
})

// ===========================================================================
// 6 · classMap
// ===========================================================================

console.log('\n=== 6 · classMap ===')

await check('6.1 classMap 覆盖全部 localName，且只含被替换的类名', () => {
  const input = ':global(.dsw-x){color:red}.a{color:red}.b .c{color:blue}:global(.dsw-y .dsw-z){color:green}'
  const { css, classMap } = compile(input)
  eq(Object.keys(classMap).sort(), ['a', 'b', 'c'])
  // 反向校验：classMap 里每个 scoped 名都真的出现在 CSS 里
  for (const scoped of Object.values(classMap)) includes(css, scoped)
  // 且 :global 里的名字一个都没进 map
  for (const name of ['dsw-x', 'dsw-y', 'dsw-z']) {
    ok(!Object.keys(classMap).includes(name), `${name} 不该进 classMap`)
  }
})

await check('6.2 classMap 键按字母序（对齐官方产物）', () => {
  const { classMap } = compile('.zeta{}.alpha{}.Mid{}.b-2{}.a_1{}')
  eq(Object.keys(classMap), ['Mid', 'a_1', 'alpha', 'b-2', 'zeta'])
})

await check('6.3 空 CSS / 只有 global 的 CSS → classMap 为空对象', () => {
  eq(compile('').classMap, {})
  eq(compile('').css, '')
  eq(compile(':global(.dsw-x){color:red}').classMap, {})
})

await check('6.4 大小写敏感：.A 与 .a 是两个不同的 localName', () => {
  const { classMap } = compile('.A{color:red}.a{color:blue}')
  eq(Object.keys(classMap).sort(), ['A', 'a'])
  ok(classMap.A !== classMap.a, '.A 与 .a 应得到不同 scoped 名')
})

// ===========================================================================
// 7 · 模块源码形态（与官方 dsh-css 产物同构）
// ===========================================================================

console.log('\n=== 7 · 模块源码形态 ===')

await check('7.1 tagId = <包名>/<相对包根 POSIX 路径>', () => {
  const { tagId } = compile('.a{}')
  eq(tagId, 'dsh-theme-studio/src/client/chrome.module.css')
  const nested = compileCssModule('.a{}', {
    file: `${ROOT}\\src\\client\\deep\\x.module.css`,
    root: `${ROOT}`,
    packageName: PACKAGE_NAME,
  })
  eq(nested.tagId, 'dsh-theme-studio/src/client/deep/x.module.css', 'Windows 反斜杠必须归一成 /：')
})

await check('7.2 注入代码与官方逐字同构：幂等选择器 + dataset.plugin/pluginCss + textContent', () => {
  const { code, css, tagId } = compile('.group{padding:0 0 0 0}')
  includes(code, `const css = ${JSON.stringify(css)};`)
  includes(code, `const tagId = ${JSON.stringify(tagId)};`)
  includes(
    code,
    'if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
  )
  includes(code, '\tconst tag = document.createElement("style");')
  includes(code, `\ttag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`)
  includes(code, '\ttag.dataset.pluginCss = tagId;')
  includes(code, '\ttag.textContent = css;')
  includes(code, '\tdocument.head.appendChild(tag);')
})

await check('7.3 map 变量名 = <路径>_module_css_default，且带 export default', () => {
  const { code } = compile('.a{}')
  includes(code, 'var src_client_chrome_module_css_default = {')
  includes(code, 'export default src_client_chrome_module_css_default;')
})

await check('7.4 运行时语义：document 存在时注入一次，重复装载不重复注入', () => {
  const { code, css, tagId, classMap } = compile('.group{color:red}.title{color:blue}')
  const tags = []
  const document = {
    head: { appendChild: (node) => tags.push(node) },
    querySelector: (selector) => tags.find((tag) => `style[data-plugin-css="${tag.dataset.pluginCss}"]` === selector) ?? null,
    createElement: () => ({ dataset: {}, textContent: '' }),
  }
  const load = (mod, doc) => {
    const factory = new Function('document', 'module', `${code.replace('export default src_client_chrome_module_css_default;', 'module.exports = src_client_chrome_module_css_default;')}`)
    const module = { exports: {} }
    factory(doc, module)
    return module.exports
  }
  const first = load(null, document)
  eq(first, classMap, '导出的应是类名映射：')
  eq(tags.length, 1, '首次装载应注入 1 个 <style>：')
  eq(tags[0].textContent, css)
  eq(tags[0].dataset.plugin, PACKAGE_NAME)
  eq(tags[0].dataset.pluginCss, tagId)
  // 官方形态**不设** tag.id / style.id：幂等键是 `data-plugin-css` 属性，不是 id
  ok(!Object.prototype.hasOwnProperty.call(tags[0], 'id'), '官方形态不设 tag.id（只设 dataset.plugin / dataset.pluginCss）：')
  load(null, document) // 第二次装载：幂等选择器命中 → 不再注入
  eq(tags.length, 1, '重复装载不应重复注入：')

  // 无 document（SSR / node）时不抛错
  const noDoc = new Function('document', 'module', `${code.replace('export default src_client_chrome_module_css_default;', 'module.exports = src_client_chrome_module_css_default;')}`)
  const module = { exports: {} }
  noDoc(undefined, module)
  eq(module.exports, classMap, '无 document 时应静默跳过注入但仍导出映射：')
})

await check('7.5 注入段与官方逐字同构（整段模板比对）+ tagId 契约 + 不设 style.id', () => {
  const { code, css, tagId } = compile('.group{padding:0 0 0 0}')

  // 官方 `@deepseek-ai/dsh-client-ui-theme/lib/client.js` 的注入段原文（含 tab 缩进），
  // 逐字比对整段 —— 不是逐行 includes，杜绝「少了一行也过」的假通过。
  // （官方原文里变量名可能是 `tagId$1`，那是打包去重产物；模块源码形态就是 `tagId`。）
  const officialBlock = [
    'if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
    '\tconst tag = document.createElement("style");',
    `\ttag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
    '\ttag.dataset.pluginCss = tagId;',
    '\ttag.textContent = css;',
    '\tdocument.head.appendChild(tag);',
    '}',
  ].join('\n')
  includes(code, officialBlock, '注入段必须与官方逐字一致：')
  includes(code, `const css = ${JSON.stringify(css)};`)
  ok(code.indexOf('const css = ') < code.indexOf('const tagId = '), 'css 必须先于 tagId 声明')
  ok(code.indexOf('const tagId = ') < code.indexOf('document.querySelector'), 'tagId 必须先于幂等判断声明')

  // 官方只设 dataset.plugin / dataset.pluginCss；**不设** style.id / tag.id
  excludes(code, 'style.id', '官方形态不设 style.id：')
  excludes(code, 'tag.id =', '官方形态不设 tag.id：')
  excludes(code, 'setAttribute("id"', '官方形态不设 id 属性：')

  // tagId = `<包名>/<相对包根的 POSIX 路径>`（绝不含反斜杠）
  eq(tagId, `${PACKAGE_NAME}/src/client/chrome.module.css`)
  ok(!tagId.includes('\\'), `tagId 必须是 POSIX 路径，实际 ${tagId}`)

  // 可选对拍：把官方产物路径放进 DTS_OFFICIAL_THEME_CLIENT，就能直接与官方原文互证
  const officialPath = process.env.DTS_OFFICIAL_THEME_CLIENT
  if (typeof officialPath !== 'string' || officialPath === '' || !existsSync(officialPath)) {
    console.log('      （可选对拍已跳过：未设置可用的 DTS_OFFICIAL_THEME_CLIENT）')
    return
  }
  const officialText = readFileSync(officialPath, 'utf8')
  includes(officialText, 'document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId', '官方产物应使用同一幂等选择器：')
  includes(officialText, 'tag.dataset.pluginCss = tagId', '官方产物应设 dataset.pluginCss：')
  includes(officialText, 'tag.textContent = css', '官方产物应设 tag.textContent：')
  ok(!/tag\.id\s*=/.test(officialText), '官方产物不应给 <style> 设 id')
  console.log('      （已与官方产物对拍通过：与官方注入段同构）')
})

// ===========================================================================
// 8 · 明确不支持项（显式报错，不静默产出错误结果）
// ===========================================================================

console.log('\n=== 8 · 显式报错 ===')

await check('8.1 :local(...) 显式报错（而不是静默不改名）', () => {
  throws(() => compile(':local(.a){color:red}'), /不支持 :local/)
})

await check('8.2 未闭合注释 / 字符串 / url / 花括号 都报错并带位置', () => {
  throws(() => compile('.a{/* 没有闭合'), /注释没有闭合（第 1 行 第 4 列）/)
  throws(() => compile('.a{content:"没有闭合'), /字符串没有闭合（第 1 行 第 12 列）/)
  throws(() => compile('.a{background:url(a.png'), /url\( 没有闭合（第 1 行 第 15 列）/)
  throws(() => compile('.a{color:red'), /花括号没有配平：缺少 `\}`（第 1 行 第 13 列）/)
  // `:global(` 的列号口径：指向**构造的起始字符**（那个 `:`，第 1 列），而不是 `(`（第 8 列）。
  // 依据是同族诊断必须同口径 —— 上面 `url( 没有闭合` 报的是 `url` 的起始列（第 15 列 = `u`，
  // `(` 在第 18 列），而不是括号列。用户拿到的是「这是哪个构造、从哪开始」的锚点，
  // 便于整段圈选后补上缺失的 `)`；`:` 与 `(` 的列差固定，定位同一个构造的能力没有损失。
  throws(() => compile(':global(.a{color:red}'), /:global\( 没有闭合（第 1 行 第 1 列）/)
})

await check('8.3 参数校验：缺 file / packageName / 非字符串 css 都报错', () => {
  throws(() => compileCssModule('.a{}', { root: ROOT, packageName: PACKAGE_NAME }), /options\.file/)
  throws(() => compileCssModule('.a{}', { file: FILE_A, root: ROOT }), /options\.packageName/)
  throws(() => compileCssModule(null, { file: FILE_A, root: ROOT, packageName: PACKAGE_NAME }), /cssText 必须是字符串/)
})

// ===========================================================================
// 9 · rolldown / tsdown 插件端到端
// ===========================================================================

console.log('\n=== 9 · rolldown 集成（插件 resolveId / load） ===')

let rolldownAvailable = false
try {
  await import('rolldown')
  rolldownAvailable = true
} catch {
  rolldownAvailable = false
}

if (!rolldownAvailable) {
  console.log('SKIP  9.x rolldown 未安装（纯函数用例已全部覆盖编译器逻辑）')
} else {
  const { rolldown } = await import('rolldown')
  const appCss = '.studio-shell{padding:0px 0px 0px 0px;display:flex}\n.studio-title{color:var(--dsw-alias-label-primary)}'
  const globalCss = ':global(.dsw-legacy){color:red}\n.panel .row{color:blue}'

  rmSync(FIXTURE_DIR, { recursive: true, force: true })
  mkdirSync(FIXTURE_DIR, { recursive: true })
  writeFileSync(join(FIXTURE_DIR, 'Studio.module.css'), appCss)
  writeFileSync(join(FIXTURE_DIR, 'Panel.module.css'), globalCss)
  writeFileSync(
    join(FIXTURE_DIR, 'entry.mjs'),
    [
      "import studio from './Studio.module.css'",
      "import panel from './Panel.module.css'",
      'export const names = { studio, panel }',
      '',
    ].join('\n'),
  )

  const bundle = await rolldown({
    input: join(FIXTURE_DIR, 'entry.mjs'),
    plugins: [cssModules({ root: ROOT, packageName: PACKAGE_NAME })],
    logLevel: 'silent',
  })
  const { output } = await bundle.generate({
    format: 'cjs',
    entryFileNames: 'entry.cjs',
    banner: 'window.__ModuleLoader__.load({ factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  })
  await bundle.close()

  const chunk = output.find((item) => item.type === 'chunk')
  const code = chunk.code
  const relativeFixture = 'tools/_tmp-css-fixture'

  await check('9.1 插件拦下 *.module.css 并编译（bundle 里内联 CSS + 类名映射）', () => {
    includes(code, 'data-plugin-css')
    includes(code, `${PACKAGE_NAME}/${relativeFixture}/Studio.module.css`)
    includes(code, `${PACKAGE_NAME}/${relativeFixture}/Panel.module.css`)
    includes(code, ':global(.dsw-legacy)')
    ok(code.length > appCss.length, 'bundle 里应包含编译后的 CSS')
  })

  await check('9.2 打包产物能正确拿到类名映射（export default 落进 cjs）', () => {
    const expectedStudio = compileCssModule(appCss, {
      file: join(FIXTURE_DIR, 'Studio.module.css'),
      root: ROOT,
      packageName: PACKAGE_NAME,
    })
    const expectedPanel = compileCssModule(globalCss, {
      file: join(FIXTURE_DIR, 'Panel.module.css'),
      root: ROOT,
      packageName: PACKAGE_NAME,
    })
    for (const scoped of Object.values(expectedStudio.classMap)) includes(code, scoped)
    for (const scoped of Object.values(expectedPanel.classMap)) includes(code, scoped)
    // 原类名不得以「未作用域的选择器」形态残留
    ok(!code.includes('.studio-shell{'), '原类名不该以未作用域形态出现在选择器里')
    ok(!code.includes('.panel .row{'), '原类名不该以未作用域形态出现在选择器里')
  })

  await check('9.3 虚拟 id 契约：resolveId 返回 \\0dts-css:<绝对路径>.mjs，load 能读回源码', async () => {
    const plugin = cssModules({ root: ROOT, packageName: PACKAGE_NAME })
    const importer = join(FIXTURE_DIR, 'entry.mjs').replaceAll('\\', '/')
    const id = await plugin.resolveId('./Studio.module.css', importer)
    ok(typeof id === 'string' && id.startsWith('\0dts-css:'), `虚拟 id 必须以 \\0 前缀开头，实际 ${JSON.stringify(id)}`)
    ok(id.endsWith('Studio.module.css.mjs'), `虚拟 id 应以 .mjs 结尾，实际 ${JSON.stringify(id)}`)
    const loaded = plugin.load(id)
    includes(loaded, 'const css = ')
    includes(loaded, 'data-plugin-css')
    includes(loaded, `${PACKAGE_NAME}/${relativeFixture}/Studio.module.css`)
    // 非本插件 id 必须放行
    eq(plugin.load(join(FIXTURE_DIR, 'entry.mjs')), null)
    eq(await plugin.resolveId('./plain.css', importer), null)
    eq(await plugin.resolveId('react', importer), null)
    // 绝对路径直接命中同一虚拟 id（不依赖 this.resolve）
    eq(await plugin.resolveId(join(FIXTURE_DIR, 'Studio.module.css'), importer), id, '相对/绝对路径应解析到同一虚拟 id：')
  })

  await check('9.4 产物可执行：装载后拿到类名映射，且 <style> 恰好注入一次', () => {
    const tags = []
    const document = {
      head: { appendChild: (node) => tags.push(node) },
      querySelector: (selector) =>
        tags.find((tag) => `style[data-plugin-css="${tag.dataset.pluginCss}"]` === selector) ?? null,
      createElement: () => ({ dataset: {}, textContent: '' }),
    }
    const sandbox = { loaded: null }
    sandbox.window = { __ModuleLoader__: { load: (definition) => (sandbox.loaded = definition.factory(() => ({}))) } }
    const run = new Function('window', 'document', code)
    run(sandbox.window, document)
    ok(tags.length === 2, `两个 CSS 模块应注入 2 个 <style>，实际 ${tags.length}`)
    eq(
      sandbox.loaded.names.studio,
      compileCssModule(appCss, { file: join(FIXTURE_DIR, 'Studio.module.css'), root: ROOT, packageName: PACKAGE_NAME }).classMap,
      '装载后拿到的类名映射应与编译器输出一致：',
    )
    eq(sandbox.loaded.names.panel, compileCssModule(globalCss, { file: join(FIXTURE_DIR, 'Panel.module.css'), root: ROOT, packageName: PACKAGE_NAME }).classMap)
    eq(tags[0].dataset.plugin, PACKAGE_NAME)
    ok(tags.every((tag) => tag.textContent.length > 0), '每个 <style> 都应有 CSS 文本')
    // 再跑一次：幂等选择器命中，不重复注入
    run(sandbox.window, document)
    ok(tags.length === 2, `重复装载不应重复注入，实际 ${tags.length}`)
  })

  rmSync(FIXTURE_DIR, { recursive: true, force: true })
}

// ===========================================================================
// 汇总
// ===========================================================================

const total = passed + failures.length
console.log(`\n${'='.repeat(60)}`)
if (failures.length === 0) {
  console.log(`全部通过：${passed}/${total} PASS，0 FAIL`)
  process.exit(0)
}
console.log(`${passed}/${total} PASS，${failures.length} FAIL`)
for (const failure of failures) console.log(`  FAIL  ${failure.name}\n        ${failure.message.split('\n').join('\n        ')}`)
process.exit(1)
