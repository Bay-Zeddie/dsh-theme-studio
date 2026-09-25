// src/client/chrome.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { rgba } from '../../lib/color-core.js'

        /* ============================================================ */
        /* 全屏                                                           */
        /* ============================================================ */

        export function fullscreenElement() {
          return document.fullscreenElement || document.webkitFullscreenElement || null;
        }

        export function requestFullscreen(target) {
          var el = target || document.documentElement;
          var method = el.requestFullscreen || el.webkitRequestFullscreen;
          if (typeof method !== 'function') return Promise.reject(new Error('unsupported'));
          try { return Promise.resolve(method.call(el)) } catch (err) { return Promise.reject(err) }
        }

        export function exitFullscreen() {
          var method = document.exitFullscreen || document.webkitExitFullscreen;
          if (typeof method !== 'function') return Promise.resolve();
          try { return Promise.resolve(method.call(document)) } catch (err) { return Promise.resolve() }
        }

        /* ============================================================ */
        /* 界面样式：全部读 --dsw-* token 并给兜底值                       */
        /* ============================================================ */

        export var CHROME_CSS = [
          /* 层定位兜底：只要背景在（body.dts-on 由层管理器维护），定位就由浏览器半自己
             供给 —— Host 重启前点"设为背景"也立即生效；重启后与 buildBootCss/buildCss
             同源同值，双份声明完全一致，不产生分叉。 */
          'body.dts-on .dts-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:paint}',
          'body.dts-on #root{position:relative;z-index:1}',
          /* 只作用于自家类：官方 ui-primitives 可能依赖既有盒模型，不去碰。 */
          '.dts-panel,.dts-row,.dts-head,.dts-tabs,.dts-body,.dts-group,.dts-btn,.dts-pill,.dts-switch,'
          + '.dts-card,.dts-card-body,.dts-card-actions,.dts-drop,.dts-focus,.dts-color,.dts-range,.dts-fab,'
          + '.dts-modal-mask,.dts-modal-card,.dts-scrim,.dts-dialog,.dts-btnwrap,.dts-note,.dts-tab,.dts-status'
          + '{box-sizing:border-box}',

          '.dts-panel{display:flex;flex-direction:column;gap:14px;font-family:var(--dsw-font-family,inherit);'
          + 'color:var(--dsw-alias-label-primary,#101418)}',
          '.dts-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
          '.dts-title{display:flex;align-items:center;gap:7px;margin:0;font-size:15px;font-weight:600}',
          '.dts-status{display:inline-flex;align-items:center;gap:5px;margin-inline-start:auto;font-size:12px;'
          + 'color:var(--dsw-alias-label-tertiary,#6d7480)}',
          /* StateDot 缺失时的等价圆点：颜色跟着语义状态令牌走，不硬编码。 */
          '.dts-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary,#d4d6d8)}',
          '.dts-dot[data-state="done"]{background:var(--dsw-alias-state-success-primary,#22c55e)}',
          '.dts-dot[data-state="error"]{background:var(--dsw-alias-state-error-primary,#ec1313)}',
          '.dts-dot[data-state="ongoing"]{background:var(--dsw-alias-brand-primary,#0f1115);'
          + 'animation:dts-pulse 1.2s var(--ds-ease-in-out,ease) infinite}',
          '@keyframes dts-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
          '.dts-status[data-state="error"]{color:var(--dsw-alias-state-error-primary,#ec1313)}',

          '.dts-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));'
          + 'overflow-x:auto;scrollbar-width:none}',
          '.dts-tab{appearance:none;border:0;background:transparent;padding:7px 11px;font:inherit;font-size:13px;'
          + 'color:var(--dsw-alias-label-secondary,#353638);border-radius:8px 8px 0 0;cursor:pointer;white-space:nowrap}',
          '.dts-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));'
          + 'color:var(--dsw-alias-label-primary,#101418)}',
          '.dts-tab[aria-selected="true"]{color:var(--dsw-alias-brand-primary,#0f1115);'
          + 'box-shadow:inset 0 -2px 0 0 var(--dsw-alias-brand-primary,#0f1115)}',
          '.dts-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}',

          '.dts-body{display:flex;flex-direction:column;gap:14px}',
          '.dts-group{display:flex;flex-direction:column;gap:9px;padding:12px;border-radius:12px;'
          + 'background:var(--dsw-alias-bg-layer-2,#f5f6f7);box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}',
          '.dts-group>h4{margin:0;font-size:12px;font-weight:600;letter-spacing:.02em;'
          + 'color:var(--dsw-alias-label-tertiary,#6d7480)}',
          '.dts-hint{margin:0;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#6d7480)}',
          '.dts-note{margin:0;padding:6px 9px;font-size:12px;border-radius:9px;'
          + 'background:var(--dsw-specific-tip,#f1f3f5);color:var(--dsw-alias-label-secondary,#353638)}',
          '.dts-note[data-tone="warn"]{background:var(--dsw-alias-state-warn-tertiary,#fef5e7);'
          + 'color:var(--dsw-alias-state-warn-label,#dd8629)}',
          '.dts-note[data-tone="error"]{background:var(--dsw-alias-code-diff-deleted,rgba(236,19,19,.08));'
          + 'color:var(--dsw-alias-state-error-primary,#ec1313)}',

          '.dts-row{display:grid;grid-template-columns:minmax(96px,168px) 1fr auto;align-items:center;gap:10px}',
          '.dts-row>label{font-size:12.5px;color:var(--dsw-alias-label-secondary,#353638)}',
          '.dts-input{width:100%;min-width:0;padding:5px 8px;font:inherit;font-size:12.5px;'
          + 'color:var(--dsw-alias-label-primary,#101418);background:var(--dsw-specific-input-major,#fff);'
          + 'border:0;border-radius:8px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}',
          '.dts-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}',
          /* 插件自家输入面跟壁纸玻璃走（body.dts-on = 有背景）：⚠️ 不能重铸全局
             --dsw-specific-input-major —— 它被钦定排除在玻璃清单外（宿主会话输入框
             保持不透明），而本面板的文本框/textarea/下拉触发器是同一令牌的另一批
             消费面，跟着退回纯白（明暗模式/滚动条下拉与自定义 CSS 白底实测）。
             ⚠️ backdrop-filter 大模糊只给**少量大件**（textarea/下拉触发器）：
             密集小输入（token 行 49×2=98 个）若逐个挂 blur(50px)，色彩页合成层
             爆炸 —— 闪屏、渲染撕裂、丢失交互（实测回归，其他页 input 少不复现）。
             小输入用同色系纯半透（观感同玻璃、零合成成本）。 */
          'body.dts-on .dts-input{background:rgba(16,20,24,.35)!important}',
          'body.dts-on .dts-select-trigger,body.dts-on .dts-textarea'
          + '{background:rgba(16,20,24,.15)!important;'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          '.dts-textarea{min-height:132px;font-family:var(--ds-font-family-code,monospace);font-size:11.5px;'
          + 'line-height:1.6;resize:vertical}',
          '.dts-range{display:flex;align-items:center;gap:8px}',
          '.dts-range input[type="range"]{flex:1;accent-color:var(--dsw-alias-brand-primary,#0f1115)}',
          '.dts-range output{min-width:48px;font-size:11.5px;font-variant-numeric:tabular-nums;'
          + 'color:var(--dsw-alias-label-tertiary,#6d7480);text-align:right}',
          '.dts-color{display:flex;align-items:center;gap:6px;min-width:0}',
          '.dts-color input[type="color"]{width:30px;height:26px;padding:0;border:0;background:transparent;cursor:pointer;flex:none}',
          '.dts-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;'
          + 'color:var(--dsw-alias-label-secondary,#353638);cursor:pointer}',
          '.dts-switch{width:36px;height:20px;padding:0;border:0;border-radius:999px;cursor:pointer;position:relative;'
          + 'background:var(--dsw-alias-state-idle-primary,#d4d6d8)}',
          '.dts-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;'
          + 'background:#fff;transition:transform var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}',
          '.dts-switch[aria-checked="true"]{background:var(--dsw-alias-state-success-primary,#22c55e)}',
          '.dts-switch[aria-checked="true"]::after{transform:translateX(16px)}',

          '.dts-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;font:inherit;font-size:12.5px;'
          + 'color:var(--dsw-alias-label-primary,#101418);background:var(--dsw-alias-button-elevated-fill,#fff);'
          + 'border:0;border-radius:9px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03));cursor:pointer;text-decoration:none}',
          '.dts-btn:hover{background:var(--dsw-alias-button-floating-hover,#f1f3f5)}',
          '.dts-btn:disabled{opacity:.5;cursor:not-allowed}',
          /* 官方控件缺失时走这些自绘类，键盘焦点环必须一样可见。 */
          '.dts-btn:focus-visible,.dts-pill:focus-visible,.dts-switch:focus-visible,'
          + '.dts-swatch:focus-visible,.dts-drop:focus-visible{'
          + 'outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}',
          '.dts-btn[data-tone="primary"]{color:var(--dsw-alias-label-primary-foreground,#fff);'
          + 'background:var(--dsw-alias-button-primary-fill,#0f1115)}',
          '.dts-btn[data-tone="danger"]{color:var(--dsw-alias-state-error-primary,#ec1313)}',
          /* 官方 Button 的 danger 只能自家上色（官方 variant 表里没有 danger）。 */
          '.dts-btn-danger{color:var(--dsw-alias-state-error-primary,#ec1313)}',
          /* 官方 Input 的布局 style 落外层 wrapper（className 也归 wrapper）。
             min-width 36px 保底：极限挤压下输入位残缺可见而不是整个消失。 */
          '.dts-input-flex{flex:1;min-width:36px;display:flex}',
          /* 宿主元素材质补丁：构建版本徽章的底色是 var(--dsw-alias-label-primary)
             （SidebarRoot.module.css:379，"主文字色做底、反相色写字"的徽章设计），
             白字主题下就是 logo 下那块纯白小斑。label-primary 是文字主色、不能
             玻璃化，这里单独给徽章换成已玻璃化的按钮面，跟全局材质走。 */
          '[class*="buildVersion"]{background:var(--dsw-alias-button-elevated-fill,rgba(16,20,24,.15))!important}',
          /* 反相实底标签（_tag[data-tone="solid"]）：宿主设计拿 label-primary 做底、
             bg 做字（徽章同款「反相」），白字主题下 = 纯白 chip + 半透明深字，又刺眼
             又看不清（Agent 预设「新任务默认」实测）。换小色块可读档毛玻璃 + 主文字色。 */
          '[class*="_tag_"][data-tone="solid"]{background:rgba(16,20,24,.55)!important;'
          + 'color:var(--dsw-alias-label-primary,#fff)!important;'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          /* 原生 <select> 弹层：系统弹层吃不到毛玻璃（无 backdrop-filter），用深色
             实底贴近主题消除突兀（主人实测「选项这里没同步」）；选中项品牌色压掉
             系统蓝高亮。option 的 background/color 是 Chromium 桌面对原生弹层
             仅有的几个可样式化入口，这里必须用不透明色（半透明会被弹层忽略）。 */
          /* 原生 <select> 弹层兜底深色化：color-scheme 是系统弹层唯一可靠的外观
             开关（旧缓存/残留原生下拉弹出浅灰透字弹层，实测）——即便页面跑旧样式，
             弹层也一并变深色实底，不再透出后面的字。 */
          'select,.dts-select-trigger{color-scheme:dark}',
          'select option{background:#16181d;color:var(--dsw-alias-label-primary,#fff)}',
          'select option:hover{background:#263148}',
          'select option:checked{background:var(--dsw-alias-brand-primary,#0bcb81);'
          + 'color:var(--dsw-alias-label-primary-foreground,#fff)}',
          /* 文件行：玻璃条（「看不清壁纸但是是透的」）。 */
          '[class$="_file"]{background:rgba(16,20,24,.5)!important;'
          + 'border:1px solid rgba(255,255,255,.08)!important;border-radius:16px;'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          /* 非交接类 _card（会话输入卡 ThMjxG_card 等）：设置同款毛玻璃 ——
             不透但磨砂质感（主人钦定「不透但是毛玻璃质感，像设置一样」）。
             曾回退成宿主纯色基准 = 浅色模式下一块大白板，与玻璃主题格格不入（实测）。
             ⚠️ [class*="_card "] 并集不可省：busy 态输入卡是多类名（_card 不在属性
             末尾），[class$="_card"] 后缀匹配不中，曾裸奔成纯白大白板（实测）。 */
          '[class$="_card"],[class*="_card "]{background:rgba(16,20,24,.15)!important;'
          + 'border-radius:16px!important;'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          /* 任务结束交接卡（gKjQ0W_card）：透明 —— 壁纸直接看得清（主人钦定
             「搞成透明的，看得清背景壁纸的那种」），只留圆角描边勾轮廓。
             ⚠️ :has 必须用文件三件套（_path/_counts/_file）当特征：_row 后缀太泛，
             会话输入卡 ThMjxG_card 内部也有 ThMjxG_row，曾把输入框误伤成透明
             （主人实测「变回原来那种不透明的」）。本条特异性高于上条，交接卡胜出。 */
          '[class$="_card"]:has([class$="_path"],[class$="_counts"],[class$="_file"]),'
          + '[class*="_card "]:has([class$="_path"],[class$="_counts"],[class$="_file"])'
          + '{background:transparent!important;backdrop-filter:none!important;'
          + 'border:1px solid rgba(255,255,255,.08)!important;border-radius:16px}',
          /* 交接任务文件的展示（gKjQ0W_preview / diff 预览）：换成交接卡同款玻璃 ——
             看不清壁纸但是是透的（主人钦定），与透明外壳形成层次。 */
          '[class$="_preview"]{background:rgba(16,20,24,.5)!important;'
          + 'border:1px solid rgba(255,255,255,.08)!important;border-radius:12px;'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          '[class$="_card"] [class$="_header"],[class$="_card"] [class$="_tile"],'
          + '[class$="_file"] [class$="_fileIcon"]{background:transparent!important;border-color:transparent!important}',
          /* 遮罩层对齐设置弹窗（KHARfa_overlay 实测全透明无模糊）：周边壁纸保持
             原色透感，模态语义由 32px 玻璃卡自己表达；灯箱（-lightbox）不进此列，
             暗场是图片查看的语义。 */
          '[class$="_backdrop"],[class$="_scrim"],[class$="-backdrop"],[class$="-scrim"]'
          + '{background:transparent!important;backdrop-filter:none!important}',
          /* 浮层面板玻璃卡 —— 与设置弹窗逐参数对齐（实测 KHARfa_panel）：
             0.15 薄玻璃 + menu-backdrop-filter 大模糊 + 32px 圆角、无描边。
             ⚠️ 大模糊才是"透透的玻璃感"与可读性的来源，不是加黑：曾配 0.55 遮罩 +
             0.5 卡片双重加黑，死黑与整体不符（主人实测「不是那种透透的」）。
             周边壁纸保持原色透感；卡片自身大模糊已糊掉底层文字干扰。 */
          '[class$="_backdrop"] > *,[class$="_scrim"] > *{background:rgba(16,20,24,.15)!important;'
          + 'border:none!important;border-radius:32px!important;'
          + 'box-shadow:0 12px 32px rgba(0,0,0,.4);'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          /* 连字符后缀浮层（lc-ov-backdrop「上下文洞察」）同款玻璃卡：下划线后缀
             匹配不中它，卡片曾是 0.15 无模糊的薄纱（实测），文字直接叠壁纸。
             ⚠️ 核心声明必须 !important：lc-ov-card 自带 background/border/radius
             声明且选择器特异性更高，不加会被压回 0.15 无模糊薄纱（实测）。 */
          '[class$="-backdrop"] > *,[class$="-scrim"] > *{background:rgba(16,20,24,.15)!important;'
          + 'border:none!important;border-radius:32px!important;'
          + 'box-shadow:0 12px 32px rgba(0,0,0,.4);'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}',
          /* 面板内按钮一律单行完整显示：官方 .button 没有 white-space（Button.module.css），
             flex 行里被 width:100% 的输入框一挤就折行堆叠溢出（「保存当前方案」实锤）。
             字号与自绘 .dts-btn 统一 12.5px，官方在位/缺失两套观感一致（页签保持 13px）。 */
          '.dts-panel button,.dts-panel .dts-btn{white-space:nowrap;flex:none}',
          '.dts-panel button:not(.dts-tab){font-size:12.5px}',
          /* 自绘下拉（替掉原生 select）：弹层压在正文上，必须高实度挡住后面的字
             + blur 糊化背景（主人实测「不要透，不然和后面的字重叠了，给他模糊化」）；
             0.15 薄玻璃只适合大面板，小弹层会与背后文字叠读。 */
          '.dts-select{position:relative;min-width:0}',
          '.dts-select-trigger{display:flex;align-items:center;gap:6px;cursor:pointer;text-align:start}',
          '.dts-select-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.dts-select-caret{flex:none;opacity:.7;font-size:10px;line-height:1}',
          '.dts-select-menu{position:absolute;z-index:2147482100;top:calc(100% + 6px);left:0;right:0;min-width:140px;'
          + 'padding:6px;display:flex;flex-direction:column;gap:2px;'
          + 'border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:16px;background:rgba(16,20,24,.88)!important;'
          + 'box-shadow:0 12px 32px rgba(0,0,0,.4);color-scheme:dark;'
          + 'backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important;'
          + 'animation:dts-menu-in var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}',
          '@keyframes dts-menu-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',
          /* 动效统一走 ui-theme 权威令牌（base.css 实证：--ds-ease-in-out /
             duration 0.2 / fast 0.1 / slow 0.3），不再散落硬编码时长。 */
          '.dts-panel button,.dts-panel .dts-btn{transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),'
          + 'color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),'
          + 'border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}',
          '.dts-select-option{appearance:none;border:0;background:transparent;text-align:start;font:inherit;'
          + 'font-size:12.5px;padding:6px 10px;border-radius:9px;cursor:pointer;'
          + 'color:var(--dsw-alias-label-primary,#fff);'
          + 'transition:background-color var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}',
          '.dts-select-option:hover{background:rgba(38,49,72,.55)}',
          '.dts-select-option[data-selected="true"]{background:var(--dsw-alias-brand-primary,#0bcb81);'
          + 'color:var(--dsw-alias-label-primary-foreground,#fff)}',
          '.dts-select-option:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}',
          '.dts-pill{padding:3px 10px;font:inherit;font-size:12px;border:0;border-radius:999px;cursor:pointer;'
          + 'background:var(--dsw-specific-selector,#f1f3f5);color:var(--dsw-alias-label-secondary,#353638)}',
          '.dts-pill[aria-pressed="true"]{background:var(--dsw-alias-brand-primary,#0f1115);'
          + 'color:var(--dsw-alias-label-primary-foreground,#fff)}',

          '.dts-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:9px}',
          '.dts-swatch{display:flex;flex-direction:column;overflow:hidden;padding:0;text-align:start;font:inherit;'
          + 'color:inherit;background:var(--dsw-alias-bg-layer-1,#fff);border:0;border-radius:11px;'
          + 'box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03));cursor:pointer}',
          '.dts-swatch:hover{box-shadow:var(--dsw-elevation-prominent,0 3px 8px rgba(0,0,0,.04))}',
          '.dts-swatch[aria-pressed="true"]{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary,#0f1115),'
          + 'var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}',
          '.dts-swatch-art{display:block;height:44px}',
          '.dts-swatch-name{padding:6px 8px 2px;font-size:12px}',
          '.dts-swatch-note{padding:0 8px 7px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6d7480)}',

          '.dts-library{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}',
          '.dts-card{display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff);'
          + 'border:0;border-radius:11px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}',
          '.dts-thumb{display:block;width:100%;height:82px;object-fit:cover;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04))}',
          '.dts-card-body{display:flex;flex-direction:column;gap:2px;padding:7px 8px}',
          '.dts-card-name{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.dts-card-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6d7480);font-variant-numeric:tabular-nums}',
          '.dts-card-actions{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 8px}',
          '.dts-btn--sm{padding:3px 8px;font-size:11.5px}',
          '.dts-profile-list{display:flex;flex-direction:column;gap:6px}',
          '.dts-profile-row{align-items:center}',
          '.dts-profile-dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;'
          + 'border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15))}',
          // 官方 Button 的 className 是哈希类名，只能按元素收紧：卡片窄时按钮文字不许折行。
          '.dts-card-actions button,.dts-card-actions .dts-btn{flex:none;white-space:nowrap}',
          '.dts-drop{display:flex;align-items:center;justify-content:center;padding:20px 14px;font-size:12.5px;'
          + 'color:var(--dsw-alias-label-tertiary,#6d7480);border:1px dashed var(--dsw-alias-border-l3,rgba(0,0,0,.12));'
          + 'border-radius:12px;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04));cursor:pointer;text-align:center}',
          '.dts-drop[data-hot="true"]{border-color:var(--dsw-alias-brand-primary,#0f1115);'
          + 'color:var(--dsw-alias-brand-primary,#0f1115);background:var(--dsw-specific-selector,#f1f3f5)}',
          '.dts-focus{position:relative;width:100%;max-width:230px;aspect-ratio:16/9;overflow:hidden;border-radius:10px;'
          + 'background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04)) center/cover no-repeat;cursor:crosshair}',
          '.dts-focus::after{content:"";position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;'
          + 'border:2px solid var(--dsw-alias-brand-primary,#0f1115);border-radius:50%;'
          + 'box-shadow:0 0 0 999px rgba(0,0,0,.12);left:var(--fx,50%);top:var(--fy,50%)}',
          '.dts-token-row{display:grid;grid-template-columns:minmax(120px,1.6fr) repeat(2,minmax(120px,1fr)) auto;gap:8px;align-items:center}',
          '.dts-token-name{font-family:var(--ds-font-family-code,monospace);font-size:11px;'
          + 'color:var(--dsw-alias-label-secondary,#353638);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.dts-pair{display:flex;gap:6px;align-items:center;font-size:10.5px;'
          + 'color:var(--dsw-alias-label-tertiary,#6d7480);min-width:0}',
          /* 「浅色值/深色值」标签锁宽不参与压缩：曾被 flex 挤到一字宽竖排
             （色彩页 token 行实测，窄模态更严重）。挤压压力交给输入链优雅退化。 */
          '.dts-pair-label{flex:none;white-space:nowrap}',
          /* 「清除」按钮隐形占位：无值行曾不渲染第 4 子项，独立 grid 的 auto 轨
             一行为 0 一行为 53px —— 上下列错位（色彩页实测）。恒渲染 + visibility
             占位让每行轨道测量一致；hidden 保不可交互。 */
          '.dts-clear-slot{display:inline-flex}.dts-clear-slot[data-empty="true"]{visibility:hidden}',
          '.dts-contrast{display:inline-flex;gap:6px;align-items:center;font-size:11.5px;font-variant-numeric:tabular-nums}',
          '.dts-badge{padding:1px 6px;border-radius:999px;font-size:10.5px;background:var(--dsw-specific-selector,#f1f3f5);'
          + 'color:var(--dsw-alias-label-secondary,#353638)}',
          '.dts-badge[data-level="ok"]{background:var(--dsw-alias-state-success-tertiary,#e6faed);'
          + 'color:var(--dsw-alias-state-success-primary,#22c55e)}',
          '.dts-badge[data-level="bad"]{background:var(--dsw-alias-code-diff-deleted,rgba(236,19,19,.08));'
          + 'color:var(--dsw-alias-state-error-primary,#ec1313)}',

          /* 浮动按钮只放图标：带文字的胶囊会压住聊天输入区右下角。 */
          '.dts-fab{position:fixed;right:16px;bottom:16px;z-index:2147482000;display:flex;align-items:center;'
          + 'justify-content:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;cursor:pointer;'
          + 'color:var(--dsw-alias-label-primary,#101418);background:var(--dsw-alias-button-elevated-fill,#fff);'
          + 'box-shadow:var(--dsw-elevation-prominent,0 3px 8px rgba(0,0,0,.04));'
          + 'transition:opacity var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),'
          + 'transform var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}',
          '.dts-fab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));transform:translateY(-1px)}',
          '.dts-fab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}',
          '.dts-fab svg{flex:none}',
          '.dts-fab[data-hidden="true"]{opacity:0;pointer-events:none}',

          '.dts-modal-mask{position:fixed;inset:0;z-index:2147482001;display:flex;align-items:center;'
          + 'justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24));'
          + 'backdrop-filter:var(--dsw-mask-blur,blur(2px))}',
          '.dts-modal-card{display:flex;flex-direction:column;width:min(980px,100%);max-height:min(88vh,900px);'
          + 'overflow:auto;padding:18px 20px 16px;border-radius:16px;background:var(--dsw-alias-bg-layer-2,#f5f6f7);'
          + 'box-shadow:var(--dsw-elevation-prominent,0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.08))}',

          '.dts-scrim{position:fixed;inset:0;z-index:2147482010;display:flex;align-items:center;justify-content:center;'
          + 'padding:24px;background:var(--dsw-alias-bg-mask-3,rgba(0,0,0,.48))}',
          '.dts-dialog{width:min(440px,100%);display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:14px;'
          + 'background:var(--dsw-alias-bg-layer-1,#fff);'
          + 'box-shadow:var(--dsw-elevation-prominent,0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.08))}',
          '.dts-dialog h3{margin:0;font-size:14px}',
          '.dts-dialog-line{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,#353638);word-break:break-word}',
          '.dts-dialog-line[data-kind="path"]{font-family:var(--ds-font-family-code,monospace);font-size:11px}',
          '.dts-dialog-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}',

          '@media (max-width:720px){.dts-row{grid-template-columns:1fr;gap:4px}.dts-token-row{grid-template-columns:1fr}}',

          // 动效降级：系统声明"减少动态效果"时，自有表面的过渡与入场动画全部归零。
          // 视频背景的停播由 boot 脚本按同一媒体查询处理（见 index.js bootVideoScript）。
          '@media (prefers-reduced-motion: reduce){'
          + '.dts-panel *,.dts-fab,.dts-modal,.dts-modal-card,.dts-modal-mask,.dts-dialog,.dts-scrim,.dts-select-menu,'
          + '.dts-layer{transition-duration:0s!important;animation-duration:0s!important}}',
        ].join('\n');

