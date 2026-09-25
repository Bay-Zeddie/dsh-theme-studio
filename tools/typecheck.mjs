/**
 * 类型网探测器：跑 checkJs（tsc -p jsconfig.json）+ TS 源码网（tsc -p tsconfig.client.json）。
 * 两条网各管一半：jsconfig 覆盖宿主 JS（index/lib/client.js/tools），
 * tsconfig.client 覆盖浏览器半 TS 源码（src/client/*.ts）—— 产物 client.js
 * 就是从这些源码构建的，漏了它们等于发布物没有类型网。
 * tsc 查找顺序：项目 node_modules → harness checkout（本机开发布局）→ 跳过并提示。
 * 找不到 tsc 不算失败（npm test 保持零安装可跑），但提示类型网未生效。
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  join(root, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  join(root, '..', '..', '..', 'deepseek-harness', 'node_modules', 'typescript', 'lib', 'tsc.js'),
]
const tsc = candidates.find((path) => existsSync(path))
if (tsc === undefined) {
  console.warn('[typecheck] 未找到 tsc（npm i -D typescript 后类型网生效）—— 跳过')
  process.exit(0)
}
const configs = [
  join(root, 'jsconfig.json'),
  join(root, 'tsconfig.client.json'),
]
for (const config of configs) {
  console.log(`[typecheck] ${config.slice(root.length + 1)}`)
  const result = spawnSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit' })
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
}
