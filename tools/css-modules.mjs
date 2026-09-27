/**
 * ============================================================================
 * dsh-theme-studio — 零依赖构建期 CSS Modules 编译器
 * ============================================================================
 *
 * 目的：让本插件用与 DSH 官方客户端插件**完全一致的技术载体**写样式 —— 源码里写
 * `Foo.module.css`，构建期编译成「内联 CSS 文本 + 幂等 <style> 注入 + 类名映射对象」。
 * 官方产物形态（app.asar 内 `@deepseek-ai/dsh-client-ui-theme/lib/client.js` 实测原文）：
 *
 *   const css$1 = ".acoaHG_group{border-bottom:.5px solid var(--dsw-alias-border-l2);...}"
 *   const tagId$1 = "@deepseek-ai/dsh-client-ui-theme/AppearanceRow.module.css";
 *   if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
 *     const tag = document.createElement("style");
 *     tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-theme";
 *     tag.dataset.pluginCss = tagId$1;
 *     tag.textContent = css$1;
 *     document.head.appendChild(tag);
 *   }
 *   var AppearanceRow_module_css_default = {
 *     "cubeRow": "acoaHG_cubeRow",
 *     "group": "acoaHG_group",
 *     ...
 *   };
 *
 * 关键对齐点（逐条实证自官方产物）：
 *   1. 类名规则 = `<6位base62 hash>_<localName>`（官方实例：acoaHG_group / hWPpAa_row /
 *      LdtX1G_bubble / nIBokW_loadingFloat / BuPN2G_card）。
 *   2. 幂等键 = `style[data-plugin-css="<包名>/<相对包根的源码路径>"]`。
 *   3. CSS 是压缩过的（官方那份是 esbuild 风格：无注释、无多余空白、
 *      `border-radius:0 0 0 0` → `0`、`margin:1.50px` → `1.5px`、`background:0 0`、
 *      `line-height:.5`）。
 *      盒模型简写只做**等价**折叠（`a b c b` → `a b c` → … → `a`；四值语义是
 *      上/右/下/左），非等价的四值一律原样保留。官方 dist 产物同款实证：
 *      源 `padding:6px 8px 8px 8px` → 产物 `padding:6px 8px 8px`，而
 *      `padding:0 0 0 10px` / `inset:4px auto 4px 4px` 原样保留。
 *   4. 类名映射对象的键**按字母序**排列（官方连续两份产物均如此）。
 *   5. CJS 风格（与官方一致）：`const css` / `const tagId` / `if (typeof document ...)` /
 *      `var <路径>_module_css_default = {...}`；末尾补一行 `export default`，让 rolldown
 *      以 ESM 语义正确处理默认导出，并最终落进 tsdown 的 cjs 产物（`module.exports.default`）。
 *
 * ---------------------------------------------------------------------------
 * 明确不支持（用不到 —— 遇到就**显式报错**，绝不静默产出错误结果）
 * ---------------------------------------------------------------------------
 *   - `composes: ... from "..."`  跨文件类名组合
 *   - `:local(...)`                本编译器默认全部 local，无需显式标注（遇到直接抛错）
 *   - `:export { ... }` / ICSS      向 JS 导出额外常量
 *   - `@import` / `@value` 的模块化 只做类名作用域，不做模块依赖图（`@import` 原样留在 CSS 里）
 *
 * 支持：类名作用域、`:global(...)`（`:global(.a .b)` 整段 + `:global(.a):hover .b` 局部，
 * 以及 `:global { ... }` 块形式）、`@keyframes` 名作用域与 `animation` / `animation-name`
 * 引用同步改名、`@media` / `@supports` / `@container` / `@layer` / `@scope` 等块内类名照常
 * 作用域、嵌套规则（含 `&`）、CSS 转义标识符、CSS 自定义属性。
 *
 * ---------------------------------------------------------------------------
 * 为什么必须是状态机，不能是正则
 * ---------------------------------------------------------------------------
 * `replace(/\.\w+/g, ...)` 一定会误伤这些**真实存在于样式里的点**：
 *   `[data-x=".a"]`（属性选择器里的字符串）   `/* .a { } *\/`（注释）
 *   `content:"v1.2"`（字符串）                 `url("a.b.png")`（url 内容）
 *   `1.5px` / `rgba(16,20,24,.28)`（数值）     `cubic-bezier(.4,0,.2,1)`（函数参数）
 *   `--dts-x: var(--dsw-y)`（自定义属性名里的 `--`）
 * 所以这里逐字符走状态机，显式跟踪：
 *   注释 `/* *\/` · 字符串 `"` `'` · `url(...)` 内容 · 花括号块种类与嵌套层级 ·
 *   是否处于 `:global` 内 · 是否处于 `@keyframes` 内
 * 只有在「**选择器位置** + 非字符串/注释/url + 非 global」时，`.` 后面紧跟的合法标识符
 * 才被当作类名替换；数值（`1.5`、`.28`）在 `.` 分支之前就被数字分支整段吃掉。
 *
 * 零依赖：只用 `node:crypto` / `node:fs` / `node:path`。
 * ============================================================================
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute, relative as pathRelative, resolve as pathResolve } from 'node:path'

/** 虚拟模块 id 前缀。`\0` 是 rolldown/rollup 约定的「虚拟模块」标记，不会落到磁盘。 */
export const VIRTUAL_PREFIX = '\0dts-css:'

/** base62 字母表：0-9 A-Z a-z。位置即数值，映射完全确定（不含 Math.random）。 */
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
/** 纯字母集：**首字符专用** —— CSS 标识符不许以数字开头（见 scopeHash 注释）。 */
const BASE52 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** 扫描期写入、压缩期读取的「必要分词边界」占位符（还原为单个空格）。 */
const SPACE_MARK = '\u0000'
/** 扫描期写入、压缩期读取的「可选分词边界」占位符（可安全删除）。 */
const SOFT_MARK = '\u0001'

// ---------------------------------------------------------------------------
// 路径与 hash
// ---------------------------------------------------------------------------

/** 把路径统一成 POSIX 风格（Windows 的 `\` → `/`），保证跨平台产物逐字一致。 */
const toPosix = (value) => String(value).replaceAll('\\', '/')

/**
 * 相对包根的源码路径（tagId 的右半边）。
 *   `/repo/pkg/src/a.css`    + root `/repo/pkg`   → `src/a.css`
 *   `D:\repo\pkg\src\a.css`  + root `D:\repo\pkg` → `src/a.css`
 * 先按 POSIX 化后的公共前缀裁剪（Windows 盘符也能正确落进去），再退回 path.relative。
 */
function relativeToRoot(file, root) {
  const forwardRoot = `${toPosix(root).replace(/\/+$/, '')}/`
  const forwardFile = toPosix(file)
  if (forwardFile.startsWith(forwardRoot)) return forwardFile.slice(forwardRoot.length)
  const rel = toPosix(pathRelative(root, file))
  return rel.startsWith('..') || isAbsolute(rel) ? forwardFile : rel
}

/**
 * 作用域 hash：`<相对包根路径>\0<文件内容>` 的 sha256 → 6 位 base62。
 * 取摘要前 6 字节、逐字节 `% 62` 查表：sha256 输出本身即均匀字节流，直接映射天然确定，
 * 没有浮点、没有随机源，跨进程 / 跨平台 / 跨 Node 版本一致。
 * 路径进摘要 → 同名 localName 在不同文件不会互撞；内容进摘要 → 改内容 hash 就变。
 *
 * ⚠️ **首字符必须取自字母集**（`BASE52`）：CSS 标识符不许以数字开头，而 base62 的首字符
 * 有 10/62 概率是数字 —— 一旦命中，**整条规则在真实浏览器里静默作废**
 * （`document.styleSheets[i].cssRules.length === 0`），形如 `.5Al7WO_dtsInputWrap`。
 * 该缺陷由本机真机渲染冒烟实测命中：`Input.module.css` 与 `TextField.module.css` 两个模块
 * 的 CSS 整份失效（其余 17 个正常），**无报错、无控制台提示**，只有量 `cssRules.length` 才看得见。
 * 熵不受影响：52 × 62^5 ≈ 4.7e10。
 */
function scopeHash(relativePath, cssText) {
  const digest = createHash('sha256').update(`${relativePath}\u0000${cssText}`, 'utf8').digest()
  let out = BASE52[digest[0] % 52]
  for (let i = 1; i < 6; i += 1) out += BASE62[digest[i] % 62]
  return out
}

/** map key：`src/client/Foo.module.css` → `src_client_Foo_module_css`（对齐官方 default 变量名）。 */
const mapKeyFor = (relativePath) => toPosix(relativePath).replace(/[^A-Za-z0-9]/g, '_')

// ---------------------------------------------------------------------------
// 字符分类
// ---------------------------------------------------------------------------

/** 标识符起始字符（ASCII；>=128 归入非 ASCII 标识符字符）。 */
const isIdentStart = (code) => (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || code === 95 || code >= 128

/** 标识符后续字符（含数字与 `-`）。 */
const isIdentChar = (code) => isIdentStart(code) || (code >= 48 && code <= 57) || code === 45

/** 数字。 */
const isDigit = (code) => code >= 48 && code <= 57

/** 十六进制数字（CSS 转义用）。 */
const isHex = (code) => (code >= 48 && code <= 57) || (code >= 97 && code <= 102) || (code >= 65 && code <= 70)

/** 合法 CSS 标识符：必须以 `-` / `_` / 字母 / 非 ASCII 开头。 */
const isValidIdent = (value) =>
  value.length > 0 && value !== '-' && (value.startsWith('-') || value.startsWith('_') || isIdentStart(value.charCodeAt(0)))

/** 行号 / 列号（1 起），仅用于报错信息。 */
function locate(text, index) {
  let line = 1
  let lineStart = 0
  const end = Math.min(index, text.length)
  for (let i = 0; i < end; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1
      lineStart = i + 1
    }
  }
  return { line, column: end - lineStart + 1 }
}

/** 构造带位置信息的编译错误。 */
function cssError(message, text, index) {
  const { line, column } = locate(text, index)
  return new Error(`[css-modules] ${message}（第 ${line} 行 第 ${column} 列）`)
}

/**
 * 数值字面量归一化（扫描期对每个数字 token 调用一次）。两条规则：
 *   1. 去掉前导零：`0.5` → `.5`、`-0.5` → `-.5`（实证自官方产物：`0.5px` 一律写作 `.5px`）。
 *   2. 去掉小数尾零：`1.50px` → `1.5px`、`1.0` → `1`、`0.250` → `.25`、`10.00px` → `10px`。
 * 只作用在**数字 token** 上 —— 字符串 / url 内容 / 选择器里的转义序列根本不会走数字分支，
 * 所以 `content:"1.50"`、`url(v1.50.png)` 天然不受影响。
 * 正则不匹配的畸形态（如 `1.5.5`、带转义的 `1px\9`）一律原样返回：宁可不动，
 * 也绝不产出错的数字。
 */
function normalizeNumberToken(token) {
  const matched = /^([+-]?)(\d*)(?:\.(\d*))?(?:([eE][+-]?\d+))?([A-Za-z%]*)$/.exec(token)
  if (matched === null) return token
  const sign = matched[1]
  const intPart = matched[2]
  const fracRaw = matched[3]
  if (fracRaw === undefined) return token // 没有小数点：前导零 / 尾零都无从谈起
  const exponent = matched[4] ?? ''
  const unit = matched[5]
  const frac = fracRaw.replace(/0+$/, '')
  const head = intPart === '0' ? '' : intPart // 前导零 shave
  if (frac === '') return `${sign}${head === '' ? '0' : head}${exponent}${unit}` // 尾零全去 → 整数
  return `${sign}${head}.${frac}${exponent}${unit}`
}

/** 读取标识符（含 `\` 转义），返回结束下标。 */
function readIdent(text, from) {
  let j = from
  while (j < text.length) {
    const code = text.charCodeAt(j)
    if (code === 92 /* \ */) {
      j += 1
      if (j >= text.length) break
      let hex = 0
      while (hex < 6 && isHex(text.charCodeAt(j))) {
        j += 1
        hex += 1
      }
      if (hex > 0 && text.charCodeAt(j) === 32) j += 1 // 十六进制转义后的空白终止符
      else if (hex === 0) j += 1 // 转义了单个字符
      continue
    }
    if (!isIdentChar(code)) break
    j += 1
  }
  return j
}

// ---------------------------------------------------------------------------
// 扫描（解析 + 改名）
// ---------------------------------------------------------------------------

/**
 * 逐字符扫描一段 CSS，返回改名后的 CSS 文本（含压缩占位符）与收集到的 token 表。
 *
 * 状态机维护：
 *  - `blocks` 栈：每层 `{ kind, keyframes, global }`
 *      kind：'decl'（声明块，如 `.a{color:red}`）/ 'nested'（声明块里的嵌套规则，如
 *            `.a{&:hover{}}`）/ 'list'（选择器列表块，如 `@media{...}` 或顶层）/
 *            'at'（普通 at-rule 的块，默认按选择器列表处理）/ 'keyframes'（关键帧块）
 *      keyframes：本层是否处于 @keyframes 内（内部 `from` / `50%` 不做任何猜测）
 *      global：本层是否处于 `:global` 块内
 *  - `pending`：当前块「待判决」状态，用来区分 `{` 是「嵌套规则」还是真声明块：
 *      'unknown' 未定性 / 'decl' 已定性为声明块 / 'list' 已定性为选择器列表
 *  - `atRule`：紧邻当前块的 at-rule 名（识别 @keyframes / @font-face 等）
 */
function scanCss(cssText, hash, preseededKeyframes) {
  const out = []
  const classTokens = new Map() // localName -> scopedName（对外 classMap 的来源）
  const keyframeTokens = preseededKeyframes ?? new Map() // 动画名 -> scopedName（声明值里引用改名的查找表）
  const blocks = []
  let i = 0
  let pending = 'unknown'
  let atRule = null
  /** `@keyframes` 后紧跟的标识符 = 动画名；>=0 表示「正在等这个名字」。 */
  let awaitingKeyframes = -1

  const current = () => blocks[blocks.length - 1] ?? null
  const inGlobal = () => current()?.global === true

  /** 跳过 `url(...)` 的全部内容，返回闭括号之后的下标；未闭合返回 -1。 */
  const skipUrl = (from) => {
    let j = from
    while (j < cssText.length) {
      const code = cssText.charCodeAt(j)
      if (code === 92) {
        j += 2
        continue
      }
      if (code === 34 || code === 39) {
        const quote = cssText[j]
        j += 1
        while (j < cssText.length && cssText[j] !== quote) {
          if (cssText.charCodeAt(j) === 92) j += 1
          j += 1
        }
        j += 1
        continue
      }
      if (code === 41) return j + 1
      j += 1
    }
    return -1
  }

  /** 复制一段带引号的原子字符串，返回结束下标。 */
  const copyString = (from) => {
    const quote = cssText[from]
    let j = from + 1
    while (j < cssText.length) {
      const code = cssText.charCodeAt(j)
      if (code === 92) {
        j += 2
        continue
      }
      if (cssText[j] === quote) {
        out.push(cssText.slice(from, j + 1))
        return j + 1
      }
      j += 1
    }
    throw cssError('字符串没有闭合', cssText, from)
  }

  /**
   * `:global(...)`：整段原样搬运，内部一律不改名（嵌套 global() 由深度计数保证）。
   *
   * 报错位置的**口径**：指向整个 `:global(` 构造的起始字符（即那个 `:`），
   * 而不是 `(`。理由是同族诊断必须同口径 —— `url( 没有闭合` 报的是 `url` 的
   * 起始列（见 `.a{background:url(a.png` 的第 15 列 = `u`），而不是 `(` 的列。
   * 两者的列差固定，但用户拿到的应是「这是哪一个构造、从哪里开始」的锚点，
   * 便于整段圈选后补上缺失的 `)`。
   */
  const skipGlobal = (openParen, tokenStart) => {
    let depth = 1
    let j = openParen + 1
    const start = j
    while (j < cssText.length) {
      const code = cssText.charCodeAt(j)
      if (code === 34 || code === 39) {
        const quote = cssText[j]
        j += 1
        while (j < cssText.length && cssText[j] !== quote) {
          if (cssText.charCodeAt(j) === 92) j += 1
          j += 1
        }
        j += 1
        continue
      }
      if (code === 92) {
        j += 2
        continue
      }
      if (code === 40) depth += 1
      else if (code === 41) {
        depth -= 1
        if (depth === 0) {
          out.push(`:global(${cssText.slice(start, j)})`)
          return j + 1
        }
      }
      j += 1
    }
    throw cssError(':global( 没有闭合', cssText, tokenStart)
  }

  /** 推导进入 `{` 后新块的 kind。 */
  const blockKeyOf = (parentKind, wasAtRule) => {
    if (parentKind === 'decl' || parentKind === 'nested') return 'nested' // 声明块里的 `{` = 嵌套规则
    if (wasAtRule) return 'at' // @media / @supports / @layer ... 内部按选择器列表处理
    return pending === 'decl' ? 'decl' : 'list'
  }

  while (i < cssText.length) {
    const code = cssText.charCodeAt(i)
    const char = cssText[i]

    // ---------------------------------------------------------------- 注释
    if (code === 47 && cssText.charCodeAt(i + 1) === 42) {
      const end = cssText.indexOf('*/', i + 2)
      if (end === -1) throw cssError('注释没有闭合', cssText, i)
      out.push(cssText.slice(i, end + 2))
      i = end + 2
      continue
    }

    // -------------------------------------------------------------- 字符串
    if (code === 34 || code === 39) {
      i = copyString(i)
      continue
    }

    // --------------------------------------------------- @keyframes 的动画名
    // `@keyframes` 与名字之间可能有空白/换行，所以先跳过空白再读标识符。
    if (awaitingKeyframes !== -1) {
      let k = i
      while (k < cssText.length && /\s/.test(cssText[k])) k += 1
      const end = readIdent(cssText, k)
      const word = cssText.slice(k, end)
      if (isValidIdent(word)) {
        // 定义即登记：`@keyframes spin` → `spin` 变 `<hash>_spin`，声明值里的引用同步改名。
        // 名字前若被改过名的选择器占着（`.__h_a@keyframes`）必须补 SOFT_MARK，否则会粘连。
        const prev = out.length > 0 ? out[out.length - 1] : ''
        const needsSep = prev !== '' && isIdentChar(prev.charCodeAt(prev.length - 1))
        const scoped = `${hash}_${word}`
        keyframeTokens.set(word, scoped)
        if (needsSep) out.push(SOFT_MARK)
        out.push(cssText.slice(i, k), scoped)
        awaitingKeyframes = -1
        pending = 'list'
        i = end
        continue
      }
      awaitingKeyframes = -1
    }

    // ------------------------------------------------------------ 大括号
    if (char === '{') {
      const parent = current()
      const parentKind = parent?.kind ?? 'list'
      const lowerAt = atRule ?? ''
      const isKeyframesRule = lowerAt === 'keyframes' || /(^|-)keyframes$/.test(lowerAt)
      const wasAtRule = atRule !== null && parentKind !== 'decl' && parentKind !== 'nested' && pending === 'unknown'
      // 声明型 at-rule：内部直接是声明，不做选择器推断
      const isDeclarationAt =
        lowerAt === 'font-face' || lowerAt === 'page' || lowerAt === 'property' || lowerAt === 'counter-style' || lowerAt === 'viewport'
      const key = isKeyframesRule ? 'keyframes' : isDeclarationAt ? 'decl' : blockKeyOf(parentKind, wasAtRule)
      out.push('{')
      blocks.push({
        kind: key,
        keyframes: key === 'keyframes' || (parent?.keyframes ?? false),
        global: parent?.global === true,
      })
      pending = 'unknown'
      atRule = null
      awaitingKeyframes = -1
      i += 1
      continue
    }

    if (char === '}') {
      out.push('}')
      blocks.pop()
      pending = 'unknown'
      atRule = null
      awaitingKeyframes = -1
      i += 1
      continue
    }

    // ------------------------------------------------------------- 分号
    if (char === ';') {
      out.push(';')
      pending = 'unknown'
      atRule = null
      awaitingKeyframes = -1
      i += 1
      continue
    }

    // ---------------------------------------------------------- at-rule
    if (char === '@') {
      const end = readIdent(cssText, i + 1)
      const name = cssText.slice(i + 1, end)
      out.push(cssText.slice(i, end))
      atRule = name.toLowerCase()
      pending = 'unknown'
      if (atRule === 'keyframes' || /(^|-)keyframes$/.test(atRule)) awaitingKeyframes = end
      i = end
      continue
    }

    // ------------------------------------------------------------- 冒号
    if (char === ':') {
      const end = readIdent(cssText, i + 1)
      const word = cssText.slice(i + 1, end)
      const lower = word.toLowerCase()

      // `:global(...)` —— 包裹的类名原样保留
      if (lower === 'global' && cssText.charCodeAt(end) === 40) {
        i = skipGlobal(end, i)
        continue
      }
      // `:global { ... }` —— 整块原样保留
      if (lower === 'global') {
        let k = end
        while (k < cssText.length && /\s/.test(cssText[k])) k += 1
        if (cssText[k] === '{') {
          out.push(cssText.slice(i, k + 1))
          blocks.push({ kind: 'list', keyframes: current()?.keyframes ?? false, global: true })
          pending = 'unknown'
          atRule = null
          i = k + 1
          continue
        }
      }
      // `:local(...)` —— 明确不支持，显式报错（本编译器默认全部 local）
      if (lower === 'local' && cssText.charCodeAt(end) === 40) {
        throw cssError('不支持 :local(...)：本编译器默认全部 local，直接写 .foo 即可', cssText, i)
      }

      out.push(':')
      // `ident:` → 本层定性为声明块（`color:...` / `--dts-x:...` / `animation:...`）
      if (pending === 'unknown' && current() !== null) pending = 'decl'
      i += 1
      continue
    }

    // ---------------------------------------------------------- 标识符
    const canStartIdent =
      isIdentStart(code) || (code === 45 && (isIdentStart(cssText.charCodeAt(i + 1)) || cssText.charCodeAt(i + 1) === 45))
    if (canStartIdent) {
      const end = readIdent(cssText, i)
      const word = cssText.slice(i, end)

      // url(...)：内容整段不改名（`url("a.b.png")` 里的 `.b` 绝不能被当类名）
      if ((word === 'url' || word === 'URL' || word === 'Url') && cssText.charCodeAt(end) === 40) {
        const after = skipUrl(end + 1)
        if (after === -1) throw cssError('url( 没有闭合', cssText, i)
        out.push(word, '(', cssText.slice(end + 1, after))
        i = after
        continue
      }

      // 声明值里的 animation / animation-name 引用 → 同步改名
      if (pending === 'decl' && keyframeTokens.has(word)) {
        out.push(keyframeTokens.get(word))
        i = end
        continue
      }

      out.push(word)
      i = end
      continue
    }

    // -------------------------------------------------------------- 小数点
    // 走到这里说明「`.` 后面不是数字」。`.28` / `.0px` 这类**裸小数**交给下面的数字分支
    // 整段吃掉（那里才做尾零归一，`0.0px` 与 `.0px` 是同一个值，必须同样归一成 `0`）；
    // 类名不可能以数字开头（`.5x` 不是合法类选择器），所以这里不会漏掉任何类名。
    if (char === '.' && !isDigit(cssText.charCodeAt(i + 1))) {
      const end = readIdent(cssText, i + 1)
      const word = cssText.slice(i + 1, end)
      const kindNow = current()?.kind
      const selectorPosition = kindNow === undefined || kindNow === 'list' || kindNow === 'at'
      if (selectorPosition && !inGlobal() && isValidIdent(word)) {
        const scoped = `${hash}_${word}`
        classTokens.set(word, scoped)
        out.push('.', scoped)
        i = end
        continue
      }
      out.push('.')
      i += 1
      continue
    }

    // -------------------------------------------------------------- 数字
    const isNumberStart =
      isDigit(code) ||
      (code === 46 && isDigit(cssText.charCodeAt(i + 1))) ||
      (code === 45 && (isDigit(cssText.charCodeAt(i + 1)) || cssText.charCodeAt(i + 1) === 46)) ||
      (code === 43 && isDigit(cssText.charCodeAt(i + 1)))
    if (isNumberStart) {
      let j = i
      if (code === 45 || code === 43) j += 1 // 符号位
      while (j < cssText.length && (isDigit(cssText.charCodeAt(j)) || cssText.charCodeAt(j) === 46)) j += 1
      if (cssText.charCodeAt(j - 1) === 46) j -= 1 // 结尾孤立的 `.` 不属于数字
      const expCode = cssText.charCodeAt(j)
      if (expCode === 101 || expCode === 69) {
        let k = j + 1
        if (cssText.charCodeAt(k) === 43 || cssText.charCodeAt(k) === 45) k += 1
        if (isDigit(cssText.charCodeAt(k))) {
          while (k < cssText.length && isDigit(cssText.charCodeAt(k))) k += 1
          j = k
        }
      }
      // 单位后缀（px / rem / deg ...）与百分号
      if (cssText.charCodeAt(j) === 37) j += 1
      else {
        const unitEnd = readIdent(cssText, j)
        if (unitEnd > j && isIdentStart(cssText.charCodeAt(j))) j = unitEnd
      }
      if (j <= i) j = i + 1
      out.push(normalizeNumberToken(cssText.slice(i, j)))
      i = j
      continue
    }

    // -------------------------------------------------------------- 左括号
    // 声明位置出现 `(` 说明这里其实已经是选择器（声明必然先有 `ident:`），例如
    // 嵌套规则 `&:not(.b)` / `div:hover`。定性为选择器列表，避免 `{` 被误判成嵌套规则。
    if (char === '(') {
      out.push('(')
      if (pending !== 'decl') pending = 'list'
      i += 1
      continue
    }

    // -------------------------------------------------------------- 其他
    out.push(char)
    i += 1
  }

  if (blocks.length > 0) throw cssError('花括号没有配平：缺少 `}`', cssText, cssText.length)
  return { marked: out.join(''), classTokens, keyframeTokens }
}

// ---------------------------------------------------------------------------
// 压缩（对齐官方 esbuild 风格）
// ---------------------------------------------------------------------------

/**
 * 空白处理表（只在**选择器**上下文生效；值上下文一律保守处理）：
 *   组合符两侧：`.a > .b` → `.a>.b`
 *   分隔符两侧：`,;{}()` 与 `:` 的多余空白
 * 刻意**不**处理 `+`：它在 `calc(1px + 2px)` 里是运算符，两侧删空格会改变语义。
 * `|` 只允许删「右侧」空格（`[a|b]` 名字空间连接符绝不粘连）。
 */
const COMBINATORS = new Set(['>', '~'])
/** 出现在左侧时可以吃掉右侧空格的字符。 */
const BEFORE_DROP = new Set([',', '>', '~', '{', '}', ';', ')', ':', '('])
/** 出现在右侧时可以吃掉左侧空格的字符。 */
const AFTER_DROP = new Set([',', '>', '~', '|', '{', '}', ';', ')', ':', '('])

/**
 * 粘连保护：删掉空白后 `prev` 与 `next` 会不会被当成**同一个 token**。
 * 真实风险只有「数字 + 数字」与「数字 + 小数点」（`1.5 4px` 删空格 → `1.54px`）。
 * `+` / `-` 与数字之间删空格是安全的（`3-2` 是表达式，不会变成数字 token）。
 */
const wouldGlue = (prev, next) => prev !== '' && next !== '' && /\d/.test(prev) && (/\d/.test(next) || next === '.')

/** 零值后可以安全删除的长度 / 角度 / 时间单位（对齐官方 `0 0` / `background:0 0`）。 */
const ZERO_UNITS = new Set([
  'px', 'em', 'rem', 'ex', 'ch', 'vw', 'vh', 'vmin', 'vmax', 'cm', 'mm', 'in', 'pt', 'pc', 'q',
  'deg', 'rad', 'grad', 'turn', 's', 'ms', 'hz', 'khz', 'dpi', 'dpcm', 'dppx', 'fr',
])

/** 零值单位只在「值位置」删：前一个字符属于这里（或位于串首）才说明这个 `0` 是一个值的开头。 */
const ZERO_HEAD = new Set([':', ',', '(', ' ', ''])

/**
 * 可以做「多值 → 更少值」**等价**折叠的盒模型简写属性白名单。
 * 准入判据只有一条：这几个值必须真的是「四边 / 两轴」语义，更短的写法与之逐槽位等价。
 *   - `margin` / `padding` / `inset`、`border-width` / `border-style` / `border-color`、
 *     `border-radius`：四值 = 上 右 下 左（`border-radius` 同序 = 四角）
 *   - `scroll-margin` / `scroll-padding`：同上，四边
 *   - `gap` / `grid-gap`：两值 = 行 列
 * 明确**不**折叠（放进来会改语义，或与官方产物不符）：
 *   - `grid-template-columns` / `grid-template-rows` / `grid-template-areas` / `grid` /
 *     `grid-area`：值是多条轨道 / 行号（`1fr 1fr 1fr 1fr` 折成 `1fr` 就是灾难），不是四边
 *   - `background` / `font` / `transition` / `animation` / `border` / `outline`：
 *     混着 `/`、逗号或多个子简写；官方产物也把 `background:0 0` 原样留着
 *   - `overflow` / `place-items` / `place-content` / `place-self`：最多两值，
 *     压根不存在四值形态，没必要也不该做简写猜测
 */
const BOX_SHORTHANDS = new Set([
  'margin', 'padding', 'inset', 'border-width', 'border-radius', 'border-color', 'border-style',
  'scroll-margin', 'scroll-padding', 'gap', 'grid-gap',
])

/**
 * 压缩 CSS：
 *  1. 丢注释（`/*!` 版权注释例外，与 esbuild 的 legal comment 语义一致）。
 *  2. 空白折叠成「按需单空格」：选择器上下文里组合符 / 分隔符两侧全删；
 *     值上下文保守保留单空格；有粘连风险时强制保留空格。
 *  3. 零值单位删除（`padding:0px` → `padding:0`）。
 *  4. 盒模型简写**等价**折叠（`padding:0 0 0 0` → `padding:0`、
 *     `margin:10px 20px 10px 20px` → `margin:10px 20px`、
 *     `padding:6px 8px 8px 8px` → `padding:6px 8px 8px`；非等价的四值一律不动）。
 *     （数值的前导零 / 尾零归一在扫描期完成，见 `normalizeNumberToken`。）
 */
function minifyCss(marked) {
  let out = ''
  let i = 0
  let lastEmitted = ''
  let space = false
  /** true = 当前处于「值位置」（`prop:` 之后到最近的 `;` / `}` / `{`） */
  let inValue = false
  /** true = 当前处于选择器位置（顶层 / 选择器列表块内 / at-rule 前奏） */
  let inSelector = true
  /** 花括号块种类栈：只用于判断「当前是否在选择器位置」 */
  const blockKinds = []
  /**
   * 待折叠的盒模型声明：`{ name, tokens, valid }`。
   * `tokens` 逐个累积，遇到 `;` / `}` 时统一回写折叠结果。
   */
  let box = null

  const emit = (char) => {
    out += char
    lastEmitted = char
  }

  const syncContext = () => {
    const kind = blockKinds[blockKinds.length - 1]
    inSelector = !inValue && (kind === undefined || kind === 'list' || kind === 'at' || kind === 'keyframes')
  }

  /**
   * 多值等价折叠：返回与入参**逐槽位语义相同**的最短 token 序列。
   * 四值语义是 `top right bottom left`，于是三条等价化简（逐级递归）：
   *   4 值 `a b c b` → 3 值 `a b c`（左 = 右）
   *   3 值 `a b a`   → 2 值 `a b`（下 = 上）
   *   2 值 `a a`     → 1 值 `a`（左 = 右）
   * 递归后：`0 0 0 0` → `0`、`10px 20px 10px 20px` → `10px 20px`、
   * `6px 8px 8px 8px` → `6px 8px 8px`。
   * **绝不**做跨槽位的非等价化简：`0 0 0 1px`（左 ≠ 右）与 `4px auto 4px 4px`
   * （左 ≠ 右）都必须保持 4 值 —— 折成 `0 1px` 就变成 `0 1px 0 1px` 了。
   * 官方 dist 产物同款实证：源 `padding:6px 8px 8px 8px` → 产物 `padding:6px 8px 8px`
   * 且折成 3 值；而 `padding:0 0 0 10px`、`inset:4px auto 4px 4px`、
   * `padding:12px 14px 12px 0` 全部原样保留（与上面三条规则逐例吻合）。
   */
  const foldBoxTokens = (tokens) => {
    let kept = tokens
    for (;;) {
      const count = kept.length
      if (count === 4 && kept[3] === kept[1]) kept = kept.slice(0, 3)
      else if (count === 3 && kept[2] === kept[0]) kept = kept.slice(0, 2)
      else if (count === 2 && kept[1] === kept[0]) kept = kept.slice(0, 1)
      else return kept
    }
  }

  /** 盒模型折叠：把已写入 out 的值段就地截断，重写成 `foldBoxTokens` 的结果。 */
  const flushBox = () => {
    const pendingBox = box
    box = null
    if (pendingBox === null || !pendingBox.valid) return
    const { tokens, name, end } = pendingBox
    if (!BOX_SHORTHANDS.has(name)) return
    if (tokens.length < 2) return
    const kept = foldBoxTokens(tokens)
    if (kept.length === tokens.length) return
    out = out.slice(0, end) + kept.join(' ')
    lastEmitted = out[out.length - 1] ?? ''
  }

  while (i < marked.length) {
    const char = marked[i]

    // ---- 扫描期写入的分词边界占位符
    if (char === SPACE_MARK || char === SOFT_MARK) {
      space = char === SPACE_MARK
      i += 1
      continue
    }

    // ---- 字符串：整段原样搬运，内部不参与任何压缩决策
    if (char === '"' || char === "'") {
      const quote = char
      let j = i + 1
      while (j < marked.length) {
        if (marked[j] === '\\') {
          j += 2
          continue
        }
        if (marked[j] === quote) break
        j += 1
      }
      if (box !== null) box.valid = false
      out += marked.slice(i, j + 1)
      lastEmitted = quote
      i = j + 1
      continue
    }

    // ---- 注释
    if (char === '/' && marked[i + 1] === '*') {
      const end = marked.indexOf('*/', i + 2)
      const stop = end === -1 ? marked.length : end + 2
      if (marked[i + 2] === '!') out += marked.slice(i, stop)
      i = stop
      continue
    }

    // ---- 结构性字符
    if (char === '{') {
      flushBox()
      emit('{')
      blockKinds.push(inSelector ? 'list' : 'decl')
      inValue = false
      syncContext()
      i += 1
      continue
    }
    if (char === '}') {
      flushBox()
      emit('}')
      blockKinds.pop()
      inValue = false
      syncContext()
      i += 1
      continue
    }
    if (char === ';') {
      flushBox()
      emit(';')
      inValue = false
      syncContext()
      i += 1
      continue
    }
    if (char === ':') {
      flushBox()
      emit(':')
      inValue = true
      syncContext()
      // 记录「值起点 + 前一个字符是 `:`」：只有 `ident:` 形态才可能是盒模型简写
      const nameMatch = /([A-Za-z-][A-Za-z0-9-]*)$/.exec(out.slice(0, out.length - 1))
      box = nameMatch === null ? null : { name: nameMatch[1].toLowerCase(), tokens: [], valid: true, end: out.length }
      i += 1
      continue
    }
    if (char === '(') {
      if (inSelector) {
        // 选择器里出现括号（`:not(...)` / `:nth-child(...)`）：本块定性为选择器列表
        if (blockKinds[blockKinds.length - 1] === 'decl') blockKinds[blockKinds.length - 1] = 'list'
      } else if (box !== null) {
        box.valid = false // 函数值（rgb() / var()）不参与简写折叠
      }
      emit('(')
      i += 1
      continue
    }

    // ---- 空白
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f') {
      space = true
      i += 1
      continue
    }

    if (space) {
      space = false
      const prev = lastEmitted
      let keep
      if (inSelector) {
        const dropLeft = prev === '' || AFTER_DROP.has(prev)
        const dropRight = BEFORE_DROP.has(char)
        const bothCombinators =
          (COMBINATORS.has(prev) && (COMBINATORS.has(char) || char === ',')) || (prev === ',' && COMBINATORS.has(char))
        keep = (!dropLeft && !dropRight && !bothCombinators) || wouldGlue(prev, char)
      } else {
        // 值上下文：`:` `(` `,` 之后与 `,` `)` `;` `}` 之前不留空格
        keep = !(prev === ':' || prev === '(' || prev === ',' || char === ',' || char === ')' || char === '}' || char === ';')
        // 注意：这里**不能**动 `box.valid` —— 空格本来就可能被删（`padding: 0px` → `padding:0px`），
        // 删空格完全不影响盒模型简写判定；值与值之间是否有空白由 `preSpace` 单独判断。
      }
      if (keep) emit(' ')
    }

    // ---- 零值单位（`0px` → `0`）：仅在值位置、且 `0` 是一个值的开头时删
    //      必须先于盒模型 token 累积执行，否则 `0px` 会先被整段收进 tokens。
    if (char === '0' && inValue && ZERO_HEAD.has(lastEmitted)) {
      const zEnd = readIdentEnd(marked, i + 1)
      if (zEnd > i + 1) {
        const unit = marked.slice(i + 1, zEnd).toLowerCase()
        if (ZERO_UNITS.has(unit) && !isIdentChar(marked.charCodeAt(zEnd))) {
          const preSpace = out.endsWith(' ') ? ' ' : ''
          const wasEnd = out.slice(0, out.length - preSpace.length)
          emit('0')
          if (box !== null && box.valid) {
            if (box.tokens.length > 0 && wasEnd !== box.end) box.tokens.push('0')
            else if (box.tokens.length === 0) box.tokens.push('0')
            else box.valid = false
          }
          i = zEnd
          continue
        }
      }
    }

    // ---- `!important`：它结束当前值，所以先把已累积的简写折叠掉再输出 `!`
    //      （不这么做的话 `padding:0 0 0 0 !important` 会因为 `!` 让 box 失效而漏掉折叠）
    if (char === '!') {
      flushBox()
      emit(char)
      i += 1
      continue
    }

    // ---- 盒模型简写：累积简单值 token
    //      `box.end` 始终是「冒号之后」的写入位置，回写时用它把整段值截断重写。
    if (box !== null && box.valid) {
      const end = readSimpleToken(marked, i)
      if (end === -1) {
        box.valid = false
      } else {
        const preSpace = out.endsWith(' ') ? ' ' : ''
        const wasEnd = out.slice(0, out.length - preSpace.length)
        if (box.tokens.length > 0 && (wasEnd === box.end || preSpace === '')) {
          box.valid = false // 两个值之间没有空白：不是简写值，放弃
        } else {
          const token = marked.slice(i, end)
          box.tokens.push(token)
          out += token
          lastEmitted = token[token.length - 1]
          i = end
          continue
        }
      }
    }

    // ---- 普通字符
    if (box !== null && box.valid && !/[-+.\w%]/.test(char)) box.valid = false
    emit(char)
    i += 1
  }

  flushBox()
  return out
}

/** 读取标识符（不含转义语义，压缩期只用于切 token）。 */
function readIdentEnd(text, from) {
  let j = from
  while (j < text.length && isIdentChar(text.charCodeAt(j))) j += 1
  return j
}

/** 仅测试用的内部钩子：暴露扫描中间态（含压缩占位符）与压缩器，便于定位问题。 */
export function __internals(cssText, hash) {
  const { marked } = scanCss(cssText, hash ?? 'HASHHH')
  return { marked, minified: minifyCss(marked) }
}

/**
 * 从 `from` 读一个「简单值 token」（数字+单位 / 标识符 / `#hex`），返回结束下标；失败返回 -1。
 * 数值的前导零在这里不处理 —— 扫描期已经 shave 过，这里只是切开 token。
 */
function readSimpleToken(text, from) {
  const code = text.charCodeAt(from)
  if (isDigit(code) || code === 46 || ((code === 45 || code === 43) && (isDigit(text.charCodeAt(from + 1)) || text.charCodeAt(from + 1) === 46))) {
    let j = from
    if (code === 45 || code === 43) j += 1
    while (j < text.length && (isDigit(text.charCodeAt(j)) || text.charCodeAt(j) === 46)) j += 1
    if (text.charCodeAt(j - 1) === 46) j -= 1
    if (text.charCodeAt(j) === 37) j += 1
    else {
      const unitEnd = readIdent(text, j)
      if (unitEnd > j) j = unitEnd
    }
    return j > from ? j : -1
  }
  if (isIdentStart(code) || code === 45) {
    const end = readIdent(text, from)
    if (end > from) return end
  }
  if (code === 35 /* # */) {
    const end = readIdent(text, from + 1)
    if (end > from + 1) return end
  }
  return -1
}

// ---------------------------------------------------------------------------
// 纯函数入口
// ---------------------------------------------------------------------------

/**
 * 把一段 CSS 编译成官方同构的模块源码。
 *
 * @param {string} cssText `.module.css` 源码文本
 * @param {{ file?: string, root?: string, packageName?: string }} options
 *        file：源码绝对路径 / root：包根绝对路径 / packageName：包名
 * @returns {{ code: string, css: string, classMap: Record<string, string>, tagId: string }}
 */
export function compileCssModule(cssText, options = {}) {
  const { file, root, packageName } = options
  if (typeof cssText !== 'string') throw new TypeError('[css-modules] cssText 必须是字符串')
  if (typeof file !== 'string' || file === '') throw new TypeError('[css-modules] options.file 必须是绝对路径')
  if (typeof packageName !== 'string' || packageName === '') {
    throw new TypeError('[css-modules] options.packageName 必须是非空字符串')
  }
  const resolvedRoot = root === undefined || root === '' ? process.cwd() : root
  if (typeof resolvedRoot !== 'string') throw new TypeError('[css-modules] options.root 必须是目录路径')

  const relativePath = relativeToRoot(file, resolvedRoot)
  const hash = scopeHash(relativePath, cssText)
  // 两遍扫描：`animation: spin 1s` 常常写在 `@keyframes spin` **之前**（CSS 里极常见），
  // 而单遍扫描时引用侧查的是"已登记的动画名"——此刻还没登记，于是引用不改名、
  // 动画静默失效（本插件 4 处控件动画就栽在这）。第一遍只收集 `@keyframes` 定义
  // （走同一个状态机，注释/字符串里的伪定义不会被误收），第二遍才做引用改名。
  const first = scanCss(cssText, hash)
  const { marked, classTokens } = scanCss(cssText, hash, first.keyframeTokens)
  const css = minifyCss(marked)

  // 类名映射按字母序（对齐官方产物）
  const classMap = {}
  for (const key of [...classTokens.keys()].sort()) classMap[key] = classTokens.get(key)

  const tagId = `${packageName}/${relativePath}`
  const varName = `${mapKeyFor(relativePath)}_default`
  const code = renderModule({ css, tagId, packageName, classMap, varName })
  return { code, css, classMap, tagId }
}

/**
 * 生成模块源码。形态与官方 `lib/client.js` 内的 CSS 段逐字同构：
 * CJS 风格的 `const css` / `const tagId` / `if (typeof document ...)` / `var xxx_default = {}`，
 * 末尾补 `export default`，交给 rolldown 完成 ESM → cjs 的正确互操作。
 */
function renderModule({ css, tagId, packageName, classMap, varName }) {
  const entries = Object.entries(classMap)
  const mapBody =
    entries.length === 0
      ? '{}'
      : `{\n${entries.map(([local, scoped]) => `\t${JSON.stringify(local)}: ${JSON.stringify(scoped)}`).join(',\n')}\n}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    'if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
    '\tconst tag = document.createElement("style");',
    `\ttag.dataset.plugin = ${JSON.stringify(packageName)};`,
    '\ttag.dataset.pluginCss = tagId;',
    '\ttag.textContent = css;',
    '\tdocument.head.appendChild(tag);',
    '}',
    `var ${varName} = ${mapBody};`,
    `export default ${varName};`,
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// rolldown / tsdown 插件
// ---------------------------------------------------------------------------

/**
 * rolldown / tsdown 插件：拦截 `*.module.css` 导入。
 *
 * @param {{ root?: string, packageName?: string }} options
 */
export function cssModules(options = {}) {
  const root = options.root === undefined || options.root === '' ? process.cwd() : options.root
  const packageName = options.packageName
  if (typeof packageName !== 'string' || packageName === '') {
    throw new TypeError('[css-modules] cssModules({ packageName }) 必填')
  }

  return {
    name: 'dsh-theme-studio:css-modules',

    /**
     * 解析 `*.module.css`：返回虚拟 id `\0dts-css:<绝对路径>.mjs`。
     * 相对说明符交给 rolldown 自带解析器（`this.resolve` 时 skipSelf 防自递归）。
     */
    async resolveId(source, importer, resolveOptions) {
      if (typeof source !== 'string' || !source.endsWith('.module.css')) return null
      let abs = null
      if (isAbsolute(source)) {
        abs = source
      } else if (typeof this?.resolve === 'function') {
        const resolved = await this.resolve(source, importer, { ...(resolveOptions ?? {}), skipSelf: true })
        if (resolved !== null && resolved !== undefined && typeof resolved.id === 'string') abs = resolved.id
      }
      if (abs === null) {
        if (typeof importer === 'string' && importer !== '' && !importer.startsWith('\0')) {
          abs = pathResolve(importer, '..', source)
        } else {
          abs = pathResolve(root, source)
        }
      }
      return `${VIRTUAL_PREFIX}${toPosix(abs)}.mjs`
    },

    /** 加载虚拟模块：读源码 → 编译 → 返回官方同构代码。 */
    load(id) {
      const normalized = String(id).replace(/^\0+/, '')
      const prefix = VIRTUAL_PREFIX.replace(/^\0+/, '')
      if (!normalized.startsWith(prefix)) return null
      const absPath = toPosix(normalized.slice(prefix.length).replace(/\.mjs$/, ''))
      const cssText = readFileSync(absPath, 'utf8')
      return compileCssModule(cssText, { file: absPath, root: toPosix(root), packageName }).code
    },
  }
}

export default cssModules
