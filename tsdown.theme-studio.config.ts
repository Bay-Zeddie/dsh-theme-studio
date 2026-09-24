/**
 * 项目版 standalone 客户端构建配置（R1 产线）：
 *   src/client/index.ts → lib/client.js（closure-factory 产物，loader 契约三件套）。
 *
 * 关键决策（均有实证支撑，见 reports/r1-official-buildchain-probe.md）：
 *  - 不引 harness 的 tsdown.client.ts（workspace 私有，import 仓库根脚本）——复刻三件套，
 *    与官方 tsdown.client.ts:604-625 / cherrchen standalone 版逐字一致。
 *  - react / react-dom / ui-primitives 走 bare require()（neverBundle）：运行时形态与现行
 *    手写产线完全一致，r1-probe 实测打包原样透传、两种 react 形态都兼容。
 *  - color-core.js 走真 ESM import + alwaysBundle 内联：D3 单一真源的正式形态。
 *  - 外层 try/catch 容错壳由 entry 模块（src/client/boot.ts）负责，见 outputOptions 说明。
 */
import { defineConfig, type UserConfig } from 'tsdown'

const PACKAGE_NAME = 'dsh-theme-studio'

/** 基座模块表键：这些 specifier 在产物里保持 require，由 loader 注入。 */
const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-client-store',
]

const isExternal = (specifier: string): boolean =>
  EXTERNALS.includes(specifier) || EXTERNALS.some((ext) => specifier.startsWith(`${ext}/`))

export const clientConfig: UserConfig = {
  name: `${PACKAGE_NAME}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib-build',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: false,
  clean: true,
  treeshake: false,
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
