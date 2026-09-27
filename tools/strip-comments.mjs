/**
 * `tools/strip-comments.mjs` —— 产物**只读**文本剥注释器（单一实现，两处锁共用）。
 *
 * 为什么必须共用一份：产物**保留注释**（treeshake/minify 都关着，与官方 14 个客户端
 * bundle 同形），而 `src/client/controls/**` 的文件头 JSDoc 逐字引用了官方禁令原文
 * （`` `require('@deepseek-ai/dsh-client-ui-primitives')` ``）。于是"整份产物里
 * @deepseek-ai/require 出现几次"这个**粗口径**永远不为 0，而同一份产物里 `require("react")`
 * 在注释中也被引用过。两处锁（tools/verify-bundle.mjs 的静态锁、tools/integration-check.mjs
 * 的静态口径）如果各写一份剥器，迟早出现"一边剥了、一边没剥"的口径漂移 —— 一边红一边绿，
 * 谁也说不清哪边对。所以剥器只留一份，两个入口同源调用。
 *
 * 不追求通用 JS 词法分析：只服务于本项目的 require 口径锁。剥过头的风险由调用侧的
 * **正控**兜住（剥完必须还能看见 `require("react")`，否则剥器被当成把代码吃掉了）。
 *
 * @param {string} source 产物源码
 * @returns {string} 去注释后的源码（字符串/模板字面量原样保留）
 */
export function stripComments(source) {
  let out = ''
  let i = 0
  /** @type {string|null} 当前状态：null=代码，"'"/'"'/'`'=字符串，"//"/"/*"=注释 */
  let mode = null
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (mode === null) {
      if (ch === '/' && next === '/') { mode = '//'; i += 2; continue }
      if (ch === '/' && next === '*') { mode = '/*'; i += 2; continue }
      if (ch === "'" || ch === '"' || ch === '`') { mode = ch; out += ch; i += 1; continue }
      out += ch; i += 1; continue
    }
    if (mode === '//') { if (ch === '\n') { mode = null; out += ch } i += 1; continue }
    if (mode === '/*') { if (ch === '*' && next === '/') { mode = null; i += 2 } else i += 1; continue }
    if (ch === '\\') { out += ch + (next ?? ''); i += 2; continue }
    out += ch
    if (ch === mode) mode = null
    i += 1
  }
  return out
}

/**
 * 官方 9 键基座表（references_practices.md 的 loader 注入表）——插件产物只允许 require 表内键。
 * **写死在工具侧**，不从产物反推：从产物反推等于"产物 require 了产物 require 的东西"，
 * 越表照样绿，锁形同虚设。表外键在真运行时是硬失败：loader 抛 `missed the module table`，
 * 整个 slot 条目白屏（官方 SKILL.md:21 警告的 `slot entry crashed in '<slot>'`）。
 * @type {readonly string[]}
 */
export const LOADER_BASE_TABLE = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'dsh-client-store',
  'dsh-client-ui-slots',
  'dsh-client-ui-primitives',
  'dsh-client-ui-dockkit',
]

/**
 * 取源码里**代码位置**（注释已剥）的全部 `require("…")` specifier，含重复次数。
 * @param {string} code 产物源码
 * @returns {string[]} 按出现顺序的 specifier 列表
 */
export function requireSpecifiers(code) {
  return [...stripComments(code).matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
}
