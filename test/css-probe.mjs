/**
 * 测试共享：CSS 文本 → 规则表解析器（R-T 锁结构化改造）。
 *
 * 存在理由：形状锁曾用正则抠 CHROME_CSS 文本（`/border-radius:16px;background:.../`），
 * 样式微调（换个写法/插入一条声明）即批量误红，重构税 ×3。改「解析成规则表再断言」：
 * 同样的强度（属性值精确相等），但对声明顺序/无关声明插入免疫。
 * 支持嵌套块（@media 内联规则并入外层表；@keyframes 按原样保留选择器）。
 */

/**
 * @param {string} text
 * @returns {{ rules: Map<string, Map<string, string>>, rule(selector: string): Map<string,string>|undefined,
 *   selectors(): string[], find(predicate: (selector: string) => boolean): Array<{selector: string, decls: Map<string,string>}> }}
 */
export function parseCss(text) {
  /** @type {Map<string, Map<string, string>>} */
  const rules = new Map()

  /** 按并集逗号拆选择器，跳过括号内逗号（`:has(.a,.b)` 不能拆碎）。 */
  function splitSelector(selector) {
    const out = []
    let depth = 0
    let current = ''
    for (const ch of selector) {
      if (ch === '(' || ch === '[') depth += 1
      else if (ch === ')' || ch === ']') depth -= 1
      if (ch === ',' && depth === 0) {
        out.push(current)
        current = ''
        continue
      }
      current += ch
    }
    out.push(current)
    return out.map((s) => s.trim()).filter((s) => s !== '')
  }

  function addRule(selector, body) {
    const key = selector.replace(/\s+/g, ' ').trim()
    const decls = rules.get(key) ?? new Map()
    for (const part of body.split(';')) {
      const at = part.indexOf(':')
      if (at <= 0) continue
      const prop = part.slice(0, at).trim()
      const value = part.slice(at + 1).trim()
      if (prop !== '' && value !== '') decls.set(prop, value)
    }
    rules.set(key, decls)
  }

  function walk(chunk, prefix) {
    let i = 0
    while (i < chunk.length) {
      const open = chunk.indexOf('{', i)
      if (open < 0) break
      const selector = chunk.slice(i, open).trim()
      let depth = 1
      let j = open + 1
      while (j < chunk.length && depth > 0) {
        if (chunk[j] === '{') depth += 1
        else if (chunk[j] === '}') depth -= 1
        j += 1
      }
      const body = chunk.slice(open + 1, j - 1)
      if (selector.startsWith('@media') || selector.startsWith('@supports')) {
        walk(body, prefix)
      } else if (selector.startsWith('@')) {
        // @keyframes 等：保留为带前缀的原始规则，不拆声明语义。
        addRule((prefix + ' ' + selector).trim(), body)
      } else if (selector !== '') {
        for (const one of splitSelector(selector)) addRule((prefix + ' ' + one).trim(), body)
      }
      i = j
    }
  }

  walk(text, '')
  return {
    rules,
    rule(selector) {
      const key = selector.replace(/\s+/g, ' ').trim()
      if (rules.has(key)) return rules.get(key)
      // 容忍选择器书写序差异：按规范化后逐成员比对并集串。
      const norm = (s) => splitSelector(s).sort().join(',')
      for (const [name, decls] of rules) {
        if (norm(name) === norm(key)) return decls
      }
      return undefined
    },
    selectors() { return [...rules.keys()] },
    find(predicate) {
      return [...rules.entries()]
        .filter(([selector]) => predicate(selector))
        .map(([selector, decls]) => ({ selector, decls }))
    },
  }
}

/** 断言辅助：取一条规则的某个声明值，选择器缺失即失败（错误信息带全部选择器）。 */
export function declOf(parsed, selector, prop) {
  const decls = parsed.rule(selector)
  if (decls === undefined) {
    throw new Error(`找不到规则：${selector}\n现有：${parsed.selectors().join(' | ')}`)
  }
  return decls.get(prop)
}
