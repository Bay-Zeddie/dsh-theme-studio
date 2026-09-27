/**
 * 项目版 standalone 客户端构建配置（R1 产线）：
 *   src/client/index.ts → lib/client.js（closure-factory 产物，loader 契约三件套）。
 *
 * 关键决策（均有实证支撑，见 reports/r1-official-buildchain-probe.md）：
 *  - 不引 harness 的 tsdown.client.ts（workspace 私有，import 仓库根脚本）——复刻三件套，
 *    与官方 tsdown.client.ts:604-625 / cherrchen standalone 版逐字一致。
 *  - react / react-dom 走 bare require()（neverBundle）：运行时形态与现行
 *    手写产线完全一致，r1-probe 实测打包原样透传、两种 react 形态都兼容。
 *  - color-core.js 走真 ESM import + alwaysBundle 内联：D3 单一真源的正式形态。
 *  - 外层 try/catch 容错壳由 entry 模块（src/client/boot.ts）负责，见 outputOptions 说明。
 *
 * 合规改造（本次）：**基座白名单收缩到只剩真正被 import 的模块**。
 * 官方规范（references_practices.md:35）禁止插件把 Harness Client 包当模块加载，
 * 控件因此全部自写（src/client/controls/**）。旧表里的 4 个客户端包（ui-primitives /
 * ui-slots / ui-theme / dsh-client-store）**源码里一处 import 都没有**，属于白名单虚胖：
 * 留着它们等于给"以后顺手 require 官方包"留后门。现在表 == 实际 require 集合，
 * 由 tools/verify-bundle.mjs 的静态锁钉死。
 *
 * ⚠️ 收缩时**不能**顺手删掉 `react-dom`：它除了 app.ts 的退路，还是 controls/runtime.ts
 * 取 `createPortal` 的唯一来源（该行本轮刚修，见文件内注释）。上一轮把它当"只有退路在用"
 * 删掉过一次，产物里于是留着裸 require、而测试夹具的模块表也没有这条键 —— 本插件
 * 99% 的用例在装载期就崩。基座表的判据是"产物里真的 require 了它"，不是"主路径用它"。
 */
import { defineConfig, type UserConfig } from 'tsdown'
import { cssModules } from './tools/css-modules.mjs'

const PACKAGE_NAME = 'dsh-theme-studio'

/**
 * 基座模块表键：这些 specifier 在产物里保持 require，由 loader 注入。
 * 逐项对照源码实况（本轮合规改造后 grep 实测）：
 *   react            —— deps.ts / controls/runtime.ts 的 `require('react')`
 *   react-dom        —— ① controls/runtime.ts 的 `require('react-dom')`（**createPortal 的唯一来源**：
 *                        React.createPortal 恒 undefined，写错会让 6 个 portal 化控件白屏）；
 *                        ② app.ts openModal 的 `require('react-dom')`（ReactDOMClient 缺失时的退路）
 *   react-dom/client —— deps.ts 的 `require('react-dom/client')`
 * `react/jsx-runtime` 已移除：全插件零 JSX（控件也是 `createElement`），产物里从未出现过它。
 */
const EXTERNALS = [
  'react',
  'react-dom',
  'react-dom/client',
]

const isExternal = (specifier: string): boolean =>
  EXTERNALS.includes(specifier) || EXTERNALS.some((ext) => specifier.startsWith(`${ext}/`))

/**
 * 只读控件层的 JSDoc 形状归一化（**构建期**改写，磁盘上的源文件一个字节都不动）。
 *
 * 为什么需要：`src/client/controls/**` 用 `@param props.checked - …` 这种 JSDoc 简写。
 * tsc 查 `.ts` 源（tsconfig.client.json，exit 0）时对它无意见，但只要这层被**打进 client.js**
 * ——而 client.js 是被 `checkJs` 管的 JS ——每个这样的块就报一条
 * `TS8032: Qualified name 'props.checked' is not allowed without a leading '@param {object} props'`。
 * 本轮合规改造正是第一次把控件层接进产物，于是 14 条 TS8032 一次性冒出来（typecheck 变红）。
 * controls/** 是只读的（改不了源），也**不能**为此把 client.js 从类型网里摘掉 ——
 * 那道网是唯一能逮住产物里悬空标识符（TS2304）的防线。
 *
 * 用什么形状补：实测（tsc 7.0.2，`ui-align/_ts-probe`）只有**字面** `@param {object} props`
 * 能消掉 TS8032；但补上它以后 `props` 的类型就变成"只有被点名的那些键"的对象字面量类型，
 * 代码里凡是访问没被点名的键（`props.onClick` / `props.className` / `props.children`…）
 * 立刻变成 TS2339（14 条 TS8032 换成 6 条 TS2339，实测）。所以**不能补**那一行。
 * 唯一两全的形状是把成员标签降级成普通描述行（`@param props.x - 说明` → `props.x - 说明`）：
 *   · TS8032 消失（没有限定名标签了）；
 *   · `props` 不再被 JSDoc 定型，代码照旧全部通过；
 *   · 文档一个字没少（整行原样保留，只去掉行首的 `@param `）；
 *   · **TS2304 这道防线原样有效** —— 同一份探针里故意写悬空标识符，仍然照抓（见 h.js）。
 * 只作用于 `src/client/controls/**` 的模块；其它文件的注释原样保留（本插件的取证注释是资产）。
 */
function controlsJsdoc(): { name: string; transform: (code: string, id: string) => any } {
  const CONTROL_FILE = /src[\\/]client[\\/]controls[\\/][^\\/]+\.ts$/
  return {
    name: 'dsh-theme-studio:controls-jsdoc',
    transform(code: string, id: string) {
      if (!CONTROL_FILE.test(id)) return null
      const fixed = code.replace(/\/\*\*[\s\S]*?\*\//g, (block) =>
        block.replace(/^([ \t]*\*[ \t]+)@param props\./gm, '$1props.'))
      return fixed === code ? null : { code: fixed, map: null }
    },
  }
}

export const clientConfig: UserConfig = {
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib-build',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  // 官方 15 个客户端 bundle 全带 `//# sourceMappingURL=client.js.map`（tsdown 构建期生成，
  // 发布时按 files 剔除）——打开它，产物形态与官方一致；map 不进 package.json 的 files。
  sourcemap: true,
  clean: true,
  treeshake: false,
  // CSS Modules：与官方 dsh-css 插件逐字同构（内联 CSS + 查询式幂等注入 + 类名映射对象）。
  // 见 tools/css-modules.mjs 与 tools/test-css-modules.mjs。
  // controlsJsdoc 见上方说明（只读控件层的 JSDoc 形状补全，让类型网能继续管住 client.js）。
  plugins: [controlsJsdoc(), cssModules({ root: import.meta.dirname, packageName: PACKAGE_NAME })],
  deps: {
    neverBundle: isExternal,
    alwaysBundle: (specifier: string) => !isExternal(specifier),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([clientConfig])
