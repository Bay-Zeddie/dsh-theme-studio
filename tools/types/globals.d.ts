/**
 * checkJs 环境垫片：外部库弱类型声明 + 浏览器私有前缀 + dsh loader 契约 + Error 扩展。
 * 只为让 tsc 看清**本插件代码**的类型；外部库一律 any（真类型留给 TS 迁移后的
 * devDeps @types/react 等）。
 */

declare module 'react' {
  const React: any
  export = React
}
declare module 'react-dom' {
  const ReactDOM: any
  export = ReactDOM
}
declare module 'react-dom/client' {
  const ReactDOMClient: any
  export = ReactDOMClient
}
declare module '@deepseek-ai/cordis' {
  export type Context = any
}
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  const primitives: any
  export = primitives
}

// Node 内建模块：裸声明（隐式 any）。不引 harness 的 @types/node（老版本会把
// 三方 JS 拖进 checkJs 程序）；真类型留给 TS 迁移后的 devDeps。
declare module 'node:crypto'
declare module 'node:child_process'
declare module 'node:fs'
declare module 'node:fs/promises'
declare module 'node:http' {
  /** JSDoc 处引用的两个形状；实现面仍是 any。 */
  export type IncomingMessage = any
  export type ServerResponse = any
  export function createServer(...args: any[]): any
  export function request(...args: any[]): any
}
declare module 'node:module'
declare module 'node:os'
declare module 'node:path'
declare module 'node:url'
declare module 'node:vm'
declare var process: any
declare var Buffer: any

interface Error {
  /** HttpError 面：unwrap/commit 按状态码分支。 */
  status?: number
}

interface Window {
  /** dsh 客户端模块装载契约（closure-factory 注册面）。 */
  __ModuleLoader__?: {
    load(registration: {
      id: string
      chunk?: string
      factory: (require: (specifier: string) => any) => any
    }): void
  }
  /** Host 首屏注入的写口令与前缀（index-inject global 行）。 */
  __DTS_BOOT__?: { prefix?: string; writeToken?: string; revision?: number; backdropMode?: string }
}

interface Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void | Promise<void>
}
interface Element {
  webkitRequestFullscreen?: () => void | Promise<void>
}
interface Navigator {
  /**
   * Electron `titleBarOverlay` 的 Window Controls Overlay 面：只读顶条的**自由区**
   * 矩形，原生 — □ × 画在它右边 —— 顶条按钮（整窗全屏）的右偏移就靠它实测。
   */
  windowControlsOverlay?: {
    visible?: boolean
    getTitlebarAreaRect?: () => { x: number; y: number; width: number; height: number }
  }
}
