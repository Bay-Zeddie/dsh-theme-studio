/**
 * CSS Modules 的环境声明（TS 类型网需要）。
 *
 * 为什么放在这里：tsconfig.client.json 的 include 只覆盖 src/client 下的 .ts 文件，
 * 且（本任务不许改配置）没有注入任何 CSS Modules 的 build-time 类型垫片；缺了这条
 * 通配声明，每个控件的 `import css from './X.module.css'` 都会在 tsc 下报 TS2307。
 *
 * 语义与官方 dsh-css 编译产物一致：默认导出是「localName → 编译后类名」的表。
 * localName 一律带 dts 前缀（见 ui-align/05-controls-port.md 的命名约定）。
 */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
