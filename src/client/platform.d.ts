/**
 * 浏览器半全局环境声明（TS 产线）。
 * 与 tools/types/globals.d.ts（checkJs 旧产线）语义对齐，面向 TS 模块。
 */

/** factory 的 require 形参在模块图里以全局形态可见（banner 注入）。 */
declare const require: (specifier: string) => any

/** dsh 客户端模块装载契约（closure-factory 注册面）。 */
interface Window {
  __ModuleLoader__?: {
    load(registration: {
      id: string
      chunk?: string
      factory: (require: (specifier: string) => any) => any
    }): void
  }
  /** Host 首屏注入的写口令与前缀（webserver/index-inject 的 global 行）。 */
  __DTS_BOOT__?: {
    prefix?: string
    writeToken?: string
    revision?: number
    backdropMode?: string
  }
}

/** HttpError 面：api 层 unwrap/commit 按 status 分支。 */
interface Error {
  status?: number
}

interface Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => void | Promise<void>
}

interface Element {
  webkitRequestFullscreen?: () => void | Promise<void>
}
