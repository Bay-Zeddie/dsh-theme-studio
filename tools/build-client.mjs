/**
 * 客户端构建（TS 产线）：tsdown standalone → lib-build/client.js → 落地 client.js。
 *
 * 为什么两步：tsdown 的 outDir 与最终产物目录分离，避免把中间产物混进包根；
 * 落地时顺带做产物契约自检（verify-bundle），不合格就不覆盖 client.js。
 *
 *   node tools/build-client.mjs          # 构建并落地
 *   node tools/build-client.mjs --check  # 只校验已落地的 client.js 与 lib-build 一致
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * tsdown 的 JS 入口（不用 .cmd —— Windows 上 spawnSync 直接 spawn .cmd 会 EINVAL）：
 * 项目 node_modules（junction 或真安装）→ harness checkout。
 */
const TSDOWN_ENTRY = [
  join(root, 'node_modules', 'tsdown', 'dist', 'run.mjs'),
  join(root, '..', '..', '..', 'deepseek-harness', 'node_modules', 'tsdown', 'dist', 'run.mjs'),
].find((path) => existsSync(path))

const built = join(root, 'lib-build', 'client.js')
const target = join(root, 'client.js')

// ⚠️ 检查语义 = 「src 与 client.js 同步」，所以必须先真构建再比对 ——
// 拿旧 lib-build 对比会永远“同步”（lib-build 与 client.js 上次一起过期）。
if (TSDOWN_ENTRY === undefined) {
  console.error('[build-client] 未找到 tsdown（npm i -D tsdown 或链接 harness node_modules）')
  process.exit(1)
}
const result = spawnSync(process.execPath, [TSDOWN_ENTRY, '--config', 'tsdown.theme-studio.config.ts'], {
  cwd: root, stdio: process.argv.includes('--check') ? 'ignore' : 'inherit',
})
if ((result.status ?? 1) !== 0) {
  if (result.error) console.error('[build-client] 构建进程无法启动：', result.error.message)
  process.exit(result.status ?? 1)
}

if (process.argv.includes('--check')) {
  if (!existsSync(built)) {
    console.error('[build-client] 构建未产出 lib-build/client.js')
    process.exit(1)
  }
  const same = readFileSync(built, 'utf8') === readFileSync(target, 'utf8')
  if (!same) {
    console.error('[build-client] client.js 落后于 src/client/*：跑 node tools/build-client.mjs 重新构建落地')
    process.exit(1)
  }
  console.log('[build-client] 同步 ✓（已重新构建并比对）')
  process.exit(0)
}

// 契约自检后再落地：产物不合格绝不覆盖现役 client.js。
const verify = spawnSync(process.execPath, [join(root, 'tools', 'verify-bundle.mjs'), built], { cwd: root, stdio: 'inherit' })
if ((verify.status ?? 1) !== 0) {
  console.error('[build-client] 产物未通过装载冒烟，client.js 保持不动')
  process.exit(verify.status ?? 1)
}
copyFileSync(built, target)
console.log('[build-client] 已落地 client.js')
