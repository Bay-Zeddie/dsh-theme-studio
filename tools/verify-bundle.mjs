/**
 * 产物装载冒烟（LOADER-SMOKE 通用化）：对 closure-factory 产物验证
 * __ModuleLoader__ 注册契约 —— 不依赖测试框架，TS 产线切换后同样适用。
 *
 * 合规改造后这里多了**三条静态锁**（把"不再依赖官方包"变成机器锁）：
 *   ① 产物代码里不得出现 `require("@deepseek-ai/dsh-client-ui-primitives")`；
 *   ② 产物代码里不得 require **任何** `@deepseek-ai/*` 包 —— 基座只允许 react 三件套；
 *   ③ 产物 require 的**每一条** specifier 都必须落在官方 9 键基座表内，且实际清单**被钉死**
 *      （静态口径：react ×2 / react-dom ×1 / react-dom/client ×1）。越表在真运行时是硬失败：
 *      loader 直接抛 `missed the module table`，整个 slot 条目白屏。
 * 同时把官方包的 require 替身一并删掉：替身留着的话，冒烟仍会"通过能 require 官方包"，
 * 锁就形同虚设。
 *
 * ⚠️ 锁查的是**代码**不是**注释**：`src/client/controls/**` 是只读的合规层，它的
 * 文件头 JSDoc 里逐字引用了禁令原文（`` `require('@deepseek-ai/dsh-client-ui-primitives')` ``），
 * 而产物保留注释（treeshake/minify 都关着）。不剥注释就会把"文档里提到过"判成"代码里依赖"，
 * 锁每天误报一次，最后一定被人注释掉。所以这里先剥注释再匹配，并且带**正控**
 * （剥完必须还能看见 `require("react")`）—— 剥器一旦把真代码当注释吃掉，正控立刻红。
 * 剥器与基座表已抽到 tools/strip-comments.mjs，与 tools/integration-check.mjs 同源共用。
 *
 *   node tools/verify-bundle.mjs [path]     # 默认 client.js
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOADER_BASE_TABLE, requireSpecifiers, stripComments } from './strip-comments.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] ?? join(root, 'client.js')
const code = readFileSync(target, 'utf8')

/** 引号风格由打包器决定（rolldown 打双引号，手写切片用单引号），锁只认语义形态。 */
const requireCall = (pkg) =>
  new RegExp(`require\\(\\s*["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s*\\)`)

/* 剥注释器与基座表已抽到 tools/strip-comments.mjs —— 与 tools/integration-check.mjs 同源，
 * 免得两侧口径漂移（一边剥了、一边没剥）。 */
const codeOnly = stripComments(code)

/* 正控：react 是必给的基座，剥完注释后它必须还在 —— 否则锁会假绿。 */
if (!requireCall('react').test(codeOnly)) {
  throw new Error('静态锁失效：剥注释后找不到 require("react")，剥器可能把代码当注释吃掉了')
}
if (requireCall('@deepseek-ai/dsh-client-ui-primitives').test(codeOnly)) {
  throw new Error(
    '产物仍 require "@deepseek-ai/dsh-client-ui-primitives" —— 官方规范禁止插件把 '
    + 'Harness Client 包当模块加载（references_practices.md:35），控件必须自写',
  )
}
const officialRequire = codeOnly.match(/require\(\s*["']@deepseek-ai\/[^"']+["']\s*\)/g) ?? []
if (officialRequire.length > 0) {
  throw new Error(
    `产物 require 了官方 Harness Client 包：${officialRequire.join(', ')} —— `
    + '基座只允许 react / react-dom / react-dom/client',
  )
}

/* 取所有 require("…") 的 specifier（代码里，注释已剥）。 */
const requiredSpecifiers = requireSpecifiers(code)
const unexpected = [...new Set(requiredSpecifiers)].filter((spec) => !LOADER_BASE_TABLE.includes(spec))
if (unexpected.length > 0) {
  throw new Error(
    `产物 require 了基座表之外的模块：${unexpected.join(', ')} —— 官方 9 键基座表 = `
    + `${LOADER_BASE_TABLE.join(' / ')}（表外键会让 loader 抛 missed the module table，整个 slot 条目白屏）`,
  )
}

/**
 * 钉住**实际清单**（含重复次数）：越表被上面拦住，"清单悄悄变了却没人发现"被这里拦住。
 *
 * ⚠️ 这里数的是**产物里出现的 require 调用点**（静态文本），不是"一次装载中执行了几次"
 * （后者取决于运行时分支）。
 * ⚠️ **阶段 E 更新（2026-09-27，锁钉的值随之变了一次，是有意的）**：
 *    背景层/提示/兜底模态改成组件内渲染后，`app.ts` 里那条
 *    `require('react-dom')` 的**模态宿主退路分支整段删除**（不再有 `createRoot` 缺席的
 *    第二条渲染路径）—— 于是静态清单从 5 条收敛到 4 条：
 *      react ×2            —— deps.ts 与 controls/runtime.ts 各裸取一次（模块初始化期都执行）
 *      react-dom ×1        —— controls/runtime.ts 取 createPortal（模块初始化期，必执行）
 *      react-dom/client ×1 —— deps.ts 在 try 里取 createRoot
 *    运行时口径（`test/client.test.mjs`）同步核对这条事实。
 */
const EXPECTED_REQUIRES = ['react', 'react', 'react-dom', 'react-dom/client']
const actualSorted = [...requiredSpecifiers].sort()
if (actualSorted.join('|') !== EXPECTED_REQUIRES.join('|')) {
  throw new Error(
    `产物 require 清单漂移：实际 [${actualSorted.join(', ')}] ≠ 期望 [${EXPECTED_REQUIRES.join(', ')}]`,
  )
}
if (!requireCall('react-dom').test(codeOnly)) {
  throw new Error(
    '产物里找不到 require("react-dom") —— createPortal 只能从 react-dom 取'
    + '（React.createPortal 恒 undefined，6 个 portal 化控件会在真运行时白屏）',
  )
}

/* ------------------------------------------------------------------ */
/* 装载冒烟                                                            */
/* ------------------------------------------------------------------ */

/**
 * document 替身：自写控件层的 `.module.css` 在**模块初始化期**就注入样式标签
 * （`document.querySelector("style[data-plugin-css=…]")` → `createElement('style')`
 * → `tag.dataset.*` / `textContent` → `head.appendChild`）。
 * 缺 querySelector / dataset 会让整个产物在装载期抛错 —— 这里的替身必须够用。
 */
const documentStub = {
  head: { appendChild() {} },
  createElement: () => ({ dataset: {}, textContent: '', setAttribute() {} }),
  querySelector: () => null,
  querySelectorAll: () => [],
}

/** @type {any} 闭包内赋值：不标注会被 CFA 推断成恒 null。 */
let handoff = null
const window = {
  __ModuleLoader__: {
    load(registration) {
      if (handoff !== null) throw new Error('bundle 注册了两次 load()')
      handoff = registration
    },
  },
}
new Function('window', 'document', 'navigator', code)(window, documentStub, { language: 'zh' })

if (handoff === null) throw new Error('bundle 未调用 __ModuleLoader__.load —— loader 会拒绝装载')
if (typeof handoff.id !== 'string' || handoff.id === '') throw new Error('load() 缺 id')
if (typeof handoff.factory !== 'function') throw new Error('load() 缺 factory')

/** react 替身：自写控件层在模块初始化期就要 `forwardRef` / `memo`（Button / DisclosureRow）。 */
const modules = {
  react: {
    createElement: (type, props, ...children) => ({ type, props, children }),
    cloneElement: (el) => el,
    forwardRef: (render) => render,
    memo: (render) => render,
    Fragment: 'Fragment',
  },
  'react-dom/client': { createRoot: () => ({ render() {}, unmount() {} }) },
  // react-dom 是官方 9 键基座表里的键，且是 **createPortal 的唯一来源**。
  // 装载冒烟现在还碰不到 portal 路径（不驱动渲染），但替身必须给"真函数 + 能挂节点"的实现：
  // 给 undefined 的话，将来这条路径一旦被冒烟覆盖，报的会是 `createPortal is not a function`
  // ——正是这次要修的真 bug 形态；替身必须与真库同形，才谈得上"替身即契约"。
  'react-dom': {
    createPortal: (node, container) => {
      if (container && typeof container.appendChild === 'function' && node && typeof node === 'object') {
        container.appendChild(node)
      }
      return node
    },
    render() {},
    unmountComponentAtNode: () => true,
  },
}
const exported = handoff.factory((specifier) => {
  if (specifier in modules) return modules[specifier]
  throw new Error(`factory require 了基座表之外的模块：${specifier}`)
})

if (exported === null || typeof exported !== 'object') throw new Error('factory 未返回 exports 对象')
if (exported.name !== handoff.id) throw new Error(`exports.name (${String(exported.name)}) 与 load id (${handoff.id}) 不一致`)
if (typeof exported.apply !== 'function') throw new Error('exports.apply 缺失')
if (!Array.isArray(exported.inject)) throw new Error('exports.inject 缺失')
console.log(`[verify-bundle] OK  ${target}  id=${handoff.id}  inject=[${exported.inject.join(', ')}]`)
console.log('[verify-bundle] 官方包 require 锁 ✓（代码里 @deepseek-ai/* require 计数 = 0）')
console.log(`[verify-bundle] 基座表锁 ✓（require 清单 = [${actualSorted.join(', ')}]，逐项落在官方 9 键基座表内）`)
// 口径透明化：产物**保留注释**（官方 bundle 同样保留），而只读的 controls/** 文件头
// 逐字引用了禁令原文、app.ts 又用 JSDoc 标了 cordis 的 Context 类型 —— 于是"整份产物里
// @deepseek-ai/ 出现几次"这个粗口径永远不为 0。那几处都不是 require 调用（上面已按代码判定），
// 这里把数报出来，免得有人拿粗 greps 当"依赖没清干净"的证据。
const rawMentions = (code.match(/@deepseek-ai\//g) ?? []).length
console.log(`[verify-bundle] 口径说明：产物原文里 @deepseek-ai/ 出现 ${String(rawMentions)} 次，`
  + '全部在注释里（禁令引文 + cordis JSDoc 类型引用），无一为 require 调用')
