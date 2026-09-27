/**
 * 行为锁发现器：package.json 里曾经把 7 个测试文件**硬编码枚举**在 test 脚本里 ——
 * 加了 test/xxx.test.mjs 却忘了改脚本，新用例**静默不跑**，而整条链照样报绿。
 * 这是最典型的假阴性：测试写了，等于没写。
 *
 * 这里改为扫描 test/ 下的 `*.test.mjs`（显式后缀，helper 文件 css-probe.mjs 不会被
 * 当测试跑），排序后交给 `node --test`。不用 `node --test` 的裸目录/glob 语义：
 * 引擎版本对 glob 的支持不一致（engines 是 node >=20），显式传文件列表各版本都成立。
 *
 * 跑法： node tools/run-tests.mjs
 */
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const testDir = join(root, 'test')

let entries = []
try {
  entries = readdirSync(testDir)
} catch (error) {
  console.error(`[run-tests] 读不到测试目录 ${testDir}：${String(error?.code ?? error)}`)
  process.exit(1)
}

const files = entries
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join('test', name))

if (files.length === 0) {
  console.error('[run-tests] test/ 下一个 *.test.mjs 都没扫到 —— 拒绝"零测试也算过"')
  process.exit(1)
}
console.log(`[run-tests] ${String(files.length)} 个测试文件（自动发现，非硬编码枚举）`)

const result = spawnSync(
  process.execPath,
  ['--test', '--test-force-exit', '--test-concurrency=1', ...files],
  { cwd: root, stdio: 'inherit' },
)
if (result.error) {
  console.error('[run-tests] 无法启动 node --test：', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
