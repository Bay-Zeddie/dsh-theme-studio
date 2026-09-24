/**
 * 产物装载冒烟（LOADER-SMOKE 通用化）：对 closure-factory 产物验证
 * __ModuleLoader__ 注册契约 —— 不依赖测试框架，TS 产线切换后同样适用。
 *
 *   node tools/verify-bundle.mjs [path]     # 默认 client.js
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] ?? join(root, 'client.js')
const code = readFileSync(target, 'utf8')

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
new Function('window', 'document', 'navigator', code)(window, { createElement: () => ({}) }, { language: 'zh' })

if (handoff === null) throw new Error('bundle 未调用 __ModuleLoader__.load —— loader 会拒绝装载')
if (typeof handoff.id !== 'string' || handoff.id === '') throw new Error('load() 缺 id')
if (typeof handoff.factory !== 'function') throw new Error('load() 缺 factory')

const modules = {
  react: { createElement: (type, props, ...children) => ({ type, props, children }), cloneElement: (el) => el },
  'react-dom/client': { createRoot: () => ({ render() {}, unmount() {} }) },
  'react-dom': { render() {}, unmountComponentAtNode: () => true },
  '@deepseek-ai/dsh-client-ui-primitives': {},
}
const exported = handoff.factory((specifier) => {
  if (specifier in modules) return modules[specifier]
  throw new Error(`factory require 了基座之外的模块：${specifier}`)
})

if (exported === null || typeof exported !== 'object') throw new Error('factory 未返回 exports 对象')
if (exported.name !== handoff.id) throw new Error(`exports.name (${String(exported.name)}) 与 load id (${handoff.id}) 不一致`)
if (typeof exported.apply !== 'function') throw new Error('exports.apply 缺失')
if (!Array.isArray(exported.inject)) throw new Error('exports.inject 缺失')
console.log(`[verify-bundle] OK  ${target}  id=${handoff.id}  inject=[${exported.inject.join(', ')}]`)
