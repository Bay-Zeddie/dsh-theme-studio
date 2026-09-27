/**
 * 类型网探测器：跑 checkJs（tsc -p jsconfig.json）+ TS 源码网（tsc -p tsconfig.client.json）。
 * 两条网各管一半：jsconfig 覆盖宿主 JS（index/lib/client.js/tools），
 * tsconfig.client 覆盖浏览器半 TS 源码（src/client/*.ts）—— 产物 client.js
 * 就是从这些源码构建的，漏了它们等于发布物没有类型网。
 * tsc 查找顺序：项目 node_modules → harness checkout（本机开发布局）。
 * ⚠️ 找不到 tsc = **失败**，不再 exit 0 装绿：这条链里缺 tsdown 早就直接红了
 * （build-client 第①道），缺 tsc 却放行就是"两道网一个严一个松"；而类型网恰恰是
 * 唯一能逮住 `TS2304 悬空标识符` 的那一道（第四轮的 P0 正是它逮住的）。
 * typescript 本来就在 devDependencies 里，装了依赖就一定有 tsc。
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
  console.error('[typecheck] 未找到 tsc：类型网无法执行，拒绝报绿')
  console.error(`[typecheck] 试过：\n  - ${candidates.join('\n  - ')}`)
  console.error('[typecheck] 装依赖即可：npm i -D typescript')
  process.exit(1)
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
