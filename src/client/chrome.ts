// src/client/chrome.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。

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
        /* 界面样式：只作用于**插件自己的 DOM**，全部读官方 --dsw-* 令牌      */
        /* ============================================================ */

        /**
         * ── 玻璃真源（全插件唯一）──
         *
         * **契约（主人七轮迭代后的最终口径，本轮从审计前副本原样恢复）**：
         *   玻璃上不带任何自选色、不做任何压暗 —— 颜色 100% 来自壁纸，只加磨砂。
         *   即：`background: transparent` + `backdrop-filter: blur()`。
         *
         *   --dts-glass-fill   transparent  零自选色。颜色由 `blur()` 采样真实壁纸得来，
         *                     所以每处玻璃的色调都跟着背后的壁纸走（"同色源"）。
         *   --dts-glass-blur   转发宿主令牌 `--dsw-menu-backdrop-filter`
         *                     (= blur(40px) saturate(150%))，**带兜底链**、不加任何后缀。
         *                     禁止追加 brightness()/contrast() —— 那也是"替壁纸做决定"。
         *
         * **为什么是零色**：实度 .72 的旧方案意味着 72% 是我们选的颜色、壁纸只剩 28%，
         * 玻璃必然与壁纸脱节。堵住底字靠的是**不透明度**而非**黑度**，两者可解耦 ——
         * 而"只做模糊"把可读性完全交给 `blur()`，颜色则完全交还给壁纸。
         *
         * ⚠️ **代价（主人知情并选择）**：去掉实色与压暗后，`blur()` 是**唯一**承担
         * "看不清底字"的机制。一旦某处 `backdrop-filter` 被祖链圈死而失效，背后正文
         * 会直接透上来，**没有兜底**。所以「糊必须活着」是**硬前提**，三处保障：
         *   · 遮罩层（宿主 `_mask` / `_backdrop` / `_scrim` 与自家控件层 `Modal` 的遮罩）
         *     绝不许带 backdrop-filter —— 否则圈死子级取景；
         *   · 输入卡的磨砂搬进 `::before`（卡片本体不当 backdrop root）；
         *   · `[role="dialog"]` / `[role="alertdialog"]` 显式带糊
         *     （零色化后只声明 background-color 会全透明）。
         *
         * **例外（都不是玻璃面）**：
         *   · `--dts-glass-fill-thin` 给**没有 backdrop-filter** 的密集小输入兜底
         *     （98 个挂 blur 会合成层爆炸；透明+无糊=控件消失）；
         *   · 反相实底 chip（`_tag_[data-tone=solid]`）白字压底，走宿主已玻璃化的按钮令牌；
         *   · `.dsh-agent-dialog` 确认框的实底压实（字压底，不是玻璃面）。
         *
         * ⚠️ **本轮恢复说明（主人复测判定阶段 C/D 为误判）**：
         *   「有很多原本的设定和功能都缺失了，比如这个对话框要磨砂。零自选色，零压暗」
         *   阶段 C/D 曾把上面这条口径改成"官方半透明填充 + 大模糊"，并把 42 个宿主表面
         *   锚点整族删除。本文件按审计前副本（`audit-theme-studio/_tmp/mut`）恢复：
         *     · 玻璃口径 + `--dts-glass-blur` 变量（含兜底链）
         *     · 宿主表面锚点强注段（见下方 ★★★ 宿主表面锚点强注）
         *   **保留未回退**的本轮改进：CSS Modules 工具链、官方 locale、自写控件层、
         *   面板几何/行范式、`createPortal`/盐/死槽位等真 bug 修复。
         *
         * **保留的两条纪律**（与官方一致，没变）：
         *   · 遮罩层**不带** backdrop-filter（官方 `--dsw-mask-blur` 默认就是 `none`）——
         *     带它的元素成为 backdrop root，子树里再开 blur 只采到"这一层"；
         *   · 需要磨砂的面把模糊挂在自己的**材料子层**上（自家面板走控件层的
         *     `MenuSurface` / `Modal`），不给"承载内容的卡片本体"挂 blur
         *     —— 唯一的例外是输入卡，它把糊搬进 `::before`。
         */
        /* 变量名保留 `GLASS_FILL`（24 处引用 + 锁 + 宿主契约都认它），但值已是 `transparent`。
           变量名与"填充色"语义的这层偏差写明在此，免得下一个人以为它还在填色。 */
        var GLASS_FILL = 'var(--dts-glass-fill,transparent)'
        /** 模糊：转发 `--dts-glass-blur` → 官方 `--dsw-menu-backdrop-filter`，两级兜底。
         *  兜底值 `blur(40px) saturate(150%)` 就是官方该令牌的定义值 —— 宿主令牌缺席时
         *  玻璃面不能变成"只变淡不磨砂"（零色口径下糊是唯一可读性机制）。 */
        var GLASS_BLUR = 'var(--dts-glass-blur,var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%)))'
        /** 玻璃面统一组装：省得每条规则各写一遍、漏掉一半。 */
        var glass = (background: string) =>
          'background:' + background + '!important;backdrop-filter:' + GLASS_BLUR + '!important'

        /**
         * ⚠️ **维护约定（第三十一轮定）**：
         *   1. **新增规则请写进 `src/client/controls/*.module.css`**（走已有的 CSS Modules 管线），
         *      不要再往本数组里加。这个数组是 TS 字符串，**没有语法高亮、没有 lint、
         *      选择器非法也不报错** —— 实测踩过两次：注释块夹在数组元素之间时，下一行以 `+` 开头
         *      会被解析成**一元加号**（`+'str'` = NaN），产物里出现 `"NaNbody…"` 坏选择器，
         *      整条规则**静默失效**（不报错、不白屏）。
         *      `test/audit-bundle.test.mjs` 有一条产物级哨兵会咬它，但那只是兜底。
         *   2. 存量 206 条规则**暂不搬迁**：搬迁过程本身极易再造同类静默失效，
         *      要做必须先有产物级护栏（哨兵已补），且一格一格搬、每格跑真机。
         *   3. 注释里 `⚠️` 那类**不要删** —— 它们记录的是"为什么锚这个"与"改这里会踩什么"，
         *      宿主 DOM 是黑盒，这些是唯一的依据（实测：96 个注释块里 64% 是警告、25% 是实测依据）。
         */
        export var CHROME_CSS = [
          /* 层定位兜底：只要背景在（body.dts-on 由层管理器维护），定位就由浏览器半自己
             供给 —— Host 重启前点"设为背景"也立即生效；重启后与 buildBootCss/buildCss
             同源同值，双份声明完全一致，不产生分叉。 */
          'body.dts-on .dts-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:paint}',
          'body.dts-on #root{position:relative;z-index:1}',
          /* 只作用于自家类：官方 ui-primitives 可能依赖既有盒模型，不去碰。
             ⚠️ `.dts-textarea` 必须在里面：它有 `width:100%` + 左右内边距，
             漏在 border-box 名单外就是 content-box —— padding 会**加在 100% 之外**，
             文本域比容器宽 16px，把 `.dts-body`/`.dts-group` 顶出横向滚动、
             右边贴死卡片边（主人实测「这个 UI 超出了界限」）。 */
          '.dts-page,.dts-page-head,.dts-page-actions,.dts-body,.dts-group,.dts-row,.dts-row-text,'
          + '.dts-row-control,.dts-row-tail,.dts-field-row,.dts-adder,.dts-adder-field,.dts-suggest,'
          + '.dts-suggest-row,.dts-dialog-foot,.dts-dialog-line,'
          + '.dts-btn,.dts-pill,.dts-switch,.dts-card,.dts-card-body,.dts-card-actions,.dts-drop,.dts-focus,'
          + '.dts-color,.dts-token-row,.dts-pair,.dts-clear-slot,.dts-note,.dts-status,'
          + '.dts-textarea,.dts-modal-panel,.dts-modal-head,.dts-modal-close,.dts-modal-options'
          + '{box-sizing:border-box}',

          /* ══════════════════════════════════════════════════════════════════
             ★★★ 面板内容列 —— 与官方 settings.section 页**同构**（产物实测）

             官方参照（三处，都以产物为准）：
               · `dsh-client-ui-settings-plugins/lib/client.js`
                 `.section{max-width:760px;color:var(--dsw-alias-label-primary);
                           flex-direction:column;gap:12px;display:flex}`
                 `.heading{margin:0;font-size:18px;font-weight:600}`
                 `.intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}`
                 `.presetSettingsTitle{margin:0;font-size:15px;font-weight:600;line-height:22px}`
               · `dsh-client-ui-settings-general/lib/client.js`
                 `.panel{width:800px;height:min(800px,calc(100vh - 2*max(24px,var(--dsh-frame-top-clearance,24px))));
                         border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);
                         max-width:calc(100vw - 48px);box-shadow:var(--dsw-elevation-prominent);
                         display:flex;overflow:hidden}`
                 `.nav{width:188px;padding:22px 12px 0}` / `.header{height:54px;padding:20px 14px 8px 10px}`
                 `.options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}`  ← 唯一滚动容器
               · 官方同款「行」= `.c0hGya_row{border-bottom:.5px solid var(--dsw-alias-border-l2);
                   justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}`
                 `.c0hGya_title{font-size:14px;line-height:20px}`
                 `.c0hGya_description{color:var(--dsw-alias-label-secondary);margin-top:4px;
                   font-size:12px;line-height:18px}`
                 ↑ **这正是 practices.md:34 指定的"同类参考页"（管理列表 = Plugin Manager /
                   设置页）**，我们的行几何逐值抄它，包括 `gap:24px` —— 施工图给的
                   4/6/8/10/12/20 是通用间距阶梯，行距以同类参考页为准（见报告 §3 说明）。

             ⚠️ **主路径（注进 settings.section）下我们只渲染「内容列」**：
               外壳已经给了 overlay + mask + 800px panel + 188px 导航列 + 唯一滚动容器。
               所以 `.dts-page` **不许**再声明宽度/高度/圆角/阴影/背景 —— 那就是第二层卡片。
               这里的几何只服务**兜底模态**路径：那里宿主什么都没给，我们必须自己当那个
               800px 面板（`.dts-modal-*` 一族）。 */
          '.dts-page{display:flex;flex-direction:column;gap:12px;max-width:760px;'
          + 'font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary)}',
          /* 面板内的页头行：左边标题+引言，右边页级动作（恢复默认/状态/关闭）。 */
          '.dts-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
          '.dts-page-title{display:flex;align-items:center;gap:8px;margin:0;font-size:18px;font-weight:600}',
          '.dts-page-intro{margin:4px 0 0;font-size:13px;line-height:20px;'
          + 'color:var(--dsw-alias-label-tertiary)}',
          '.dts-page-actions{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap}',
          '.dts-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;'
          + 'color:var(--dsw-alias-label-tertiary)}',
          /* 整窗全屏：在**窗口顶条**上、紧挨原生最小化键左侧。Windows 走
             `titleBarStyle:"hidden"` + `titleBarOverlay:{height:40}` —— — □ × 由系统画在
             右上角，页面这侧只能占它们左边那条自由区，所以右偏移不是硬编码而是 JS 实测
             后写进 `--dts-caption-inset`（WCO 自由区矩形；兜底 Win11 三键 46×3=138，
             macOS 红绿灯在左 → 12）。顶条高取宿主自己发布的
             `--dsh-windows-titlebar-height`（该名不在官方 514 条令牌表里 → 保留数值兜底，
             属官方允许的"可能未注入的宿主令牌"一档）。
             `-webkit-app-region:no-drag` 必须给：顶条整条是 drag 区，不标 no-drag 的
             控件会被当成标题栏拖走、点不动。 */
          /* z-index:1 —— 它现在住在 `#dts-overlay-host`（`position:fixed;inset:0;
             pointer-events:none;overflow:hidden;contain:paint`）里。`contain:paint` 会把
             `position:fixed` 的 containing block 变成**该容器本身**；容器是 `inset:0` 全屏，
             所以位置与"贴 viewport"等价 —— 但它必须**显式抬一层**，否则会与容器里
             同为定位元素的模态/提示抢层序（缺它时会被 Modal 的遮罩压住）。 */
          /* ⚠️ `pointer-events:auto` 是**必须**的：它住在 `#dts-overlay-host`
             （`pointer-events:none`，官方浮层取向：不吃宿主指针）里，子元素**默认继承 `none`**
             —— 于是图标画得出来、**点不动**（主人实测：「图标在，功能没了」）。
             `#dts-modal-host` 一直是显式 `auto`，这枚按钮漏了。 */
          '.dts-fs{position:fixed;top:0;right:var(--dts-caption-inset,138px);pointer-events:auto;'
          + 'height:var(--dsh-windows-titlebar-height,40px);display:inline-flex;align-items:center;'
          + 'padding:0 10px;border:0;background:transparent;cursor:pointer;'
          + 'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;'
          + 'z-index:1000;-webkit-app-region:no-drag}',
          '.dts-fs:hover{background:var(--dsw-alias-interactive-bg-hover)}',
          '.dts-fs:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid '
          + 'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
          /* 顶条「编辑」菜单的磨砂替身 —— 系统菜单是原生 `Menu.popup`（另一个窗口），
             主题令牌与 backdrop-filter 一条都够不着，只能在它弹出前拦下点击、换成
             自己的 DOM 面板。几何逐条对齐官方 `Menu.module.css` 的紧凑档：
               `padding:4px` / 行 `min-height:30px;padding:4px 8px;border-radius:var(--dsw-radius-md)`
               / 行内 `gap:6px` / 快捷键 `font-size:11px;line-height:16px` 走 `label-caption`
               / 卡片圆角 `--dsw-radius-lg`（MenuSurface 默认档）/ 阴影 `--dsw-elevation-prominent`
               / 分隔线 `height:.5px;margin:3px 2px;background:var(--dsw-alias-border-l2)`。
             ⚠️ z-index 收敛到官方那一个 **1000**（宿主设置面板 overlay 就是 1000）：
              原先的 2147483100 属于"与宿主菜单/提示抢层级"的自造量级，正是
              `07-compliance-audit.md` 点名的根因。 */
          '.dts-cmenu{position:fixed;z-index:1000;min-width:220px;padding:4px;'
          + 'display:flex;flex-direction:column;gap:0;border-radius:var(--dsw-radius-lg);'
          + 'border:.5px solid var(--dsw-alias-border-l2);'
          + glass(GLASS_FILL) + ';'
          + 'box-shadow:var(--dsw-elevation-prominent);'
          + 'color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family)}',
          '.dts-cmenu-item{display:flex;align-items:center;gap:6px;width:100%;'
          + 'min-height:30px;padding:4px 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;'
          + 'color:inherit;font:inherit;font-size:13px;line-height:20px;cursor:pointer;text-align:start}',
          '.dts-cmenu-item>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.dts-cmenu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
          /* 官方 Menu 的键盘行态：填充即焦点指示，不再叠浏览器默认环
             （`Menu.module.css` `.item:focus-visible:not(:disabled){background:
             var(--dsw-alias-interactive-bg-hover);outline:none}`）。 */
          '.dts-cmenu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}',
          '.dts-cmenu-item kbd{margin-inline-start:auto;flex:none;font:inherit;font-size:11px;line-height:16px;'
          + 'color:var(--dsw-alias-label-caption)}',
          '.dts-cmenu-sep{height:.5px;margin:3px 2px;'
          + 'background:var(--dsw-alias-border-l2)}',
          /* 命令没生效时的提示条：命令失败原先是静默的，用户点了菜单毫无反应，
             分不清"失败"与"没点中"。跟统一玻璃走同一套令牌。 */
          '.dts-cmenu-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);'
          + 'z-index:1000;max-width:min(420px,90vw);padding:8px 14px;border-radius:var(--dsw-radius-md);'
          + 'font-size:12px;color:var(--dsw-alias-label-primary);'
          + glass(GLASS_FILL) + ';'
          + 'box-shadow:var(--dsw-shadow-lv3)}',
          /* StateDot 缺失时的等价圆点：颜色跟着语义状态令牌走，不硬编码。 */
          '.dts-dot{width:8px;height:8px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-state-idle-primary)}',
          '.dts-dot[data-state="done"]{background:var(--dsw-alias-state-success-primary)}',
          '.dts-dot[data-state="error"]{background:var(--dsw-alias-state-error-primary)}',
          '.dts-dot[data-state="ongoing"]{background:var(--dsw-alias-brand-primary);'
          + 'animation:dts-pulse 1.2s var(--ds-ease-in-out) infinite}',
          '@keyframes dts-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
          '.dts-status[data-state="error"]{color:var(--dsw-alias-state-error-primary)}',

          /* 页签栏不再自绘：面板页签交给自写控件层的 `SegmentedTabs`
             （官方 primitives 的等宽分段页签：Pill + 滑动指示条 + ←→/Home/End
              自动激活 + roving tabindex）。原 `.dts-tabs/.dts-tab` 那一族连同
              app.ts 里的 onTabKey 手写键盘一起删除 —— 官方契约由控件自带。 */

          '.dts-body{display:flex;flex-direction:column;gap:12px;min-width:0}',
          /* ★ 分组 = **普通 div 撑满列宽，没有卡片壳**（官方 DeveloperToolsRow /
             PluginsSettingsSection：分层靠 h2/h3 + 行分割线，不靠自绘卡片边框）。 */
          '.dts-group{display:flex;flex-direction:column}',
          /* 分组标题 15/600/22 —— 官方 `PluginsSettingsSection.presetSettingsTitle` 逐字
             （`.tn1v9q_presetSettingsTitle{margin:0;font-size:15px;font-weight:600;line-height:22px}`）。
             07 报告曾判"15px 不在官方阶上"，**以产物为准该判定不成立**：15px 正是这一档。
             页面级标题是 h2 18/600（见 .dts-page-title，官方 `.heading`）。 */
          '.dts-group-title{margin:0;font-size:15px;font-weight:600;line-height:22px;'
          + 'color:var(--dsw-alias-label-primary)}',
          /* 分组引言 13/20 tertiary —— 官方 `.intro` 逐字。 */
          '.dts-group-desc{margin:2px 0 0;font-size:13px;line-height:20px;'
          + 'color:var(--dsw-alias-label-tertiary)}',
          '.dts-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
          '.dts-note{margin:0;padding:8px 10px;font-size:12px;line-height:18px;'
          + 'border-radius:var(--dsw-radius-sm);'
          + 'background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}',
          '.dts-note[data-tone="warn"]{background:var(--dsw-alias-state-warn-tertiary);'
          + 'color:var(--dsw-alias-state-warn-label)}',
          '.dts-note[data-tone="error"]{background:var(--dsw-alias-code-diff-deleted);'
          + 'color:var(--dsw-alias-state-error-primary)}',

          /* ★ 行 = 官方设置页范式（`c0hGya_row` 逐字）：
               display:flex; justify-content:space-between; align-items:center;
               gap:24px; padding:16px 0; border-bottom:.5px solid var(--dsw-alias-border-l2)
             标题 14/20；描述 12/18 label-secondary + margin-top:4px。 */
          '.dts-row{display:flex;justify-content:space-between;align-items:center;gap:24px;'
          + 'padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
          '.dts-row-text{min-width:0}',
          '.dts-row-title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}',
          '.dts-row-desc{margin-top:4px;font-size:12px;line-height:18px;'
          + 'color:var(--dsw-alias-label-secondary)}',
          '.dts-row-control{flex:1 1 auto;min-width:0;display:flex;align-items:center;'
          + 'justify-content:flex-end;gap:8px}',
          '.dts-row-tail{flex:none;display:flex;align-items:center;gap:6px}',
          /* 焦点 X/Y 两个数字字段（自写 NumberField 控件）在行末：给它定宽
             （控件自带的纵向内边距由控件自己负责，行的 16px 已经承担了行距）。 */
          '.dts-focus-num{width:80px;padding:0}',
          /* ★ 行末分割线由**容器**用后代选择器收尾 —— 官方写法：
               官方 `section>[data-slot="settings.general.item"]>:last-child{border-bottom:none}`
             行自己不判断"我是不是最后一个"（那样行组件就不纯了，也没法被别的容器复用）。 */
          '.dts-group>.dts-row:last-child,.dts-body>.dts-row:last-child,'
          + '.dts-group>div:last-child>.dts-row:last-child{border-bottom:none}',
          /* 字段行（无 Row 外壳的窄场景：方案名 + 保存按钮）。 */
          '.dts-field-row{display:flex;align-items:flex-end;gap:8px}',
          /* 输入框行：`align-items:flex-end` 让按钮与 input 底部对齐，但按钮是 `sm`(28px)、
             TextField 的 input 是 34px ⇒ 一高一矮看着仍然不齐。把行内按钮抬到同高。 */
          /* 真机实测：TextField 的 wrapper 底部比它内部 input 的底部**低 12px**
             （label 20 + gap 6 + input 36，wrapper 还带自己的下边距），所以 `align-items:flex-end`
             会让按钮比输入框低 12px（截图里就是"按钮掉下去一截"）。这里把这 12px 抵消掉。 */
          '.dts-field-row .dts-btn,.dts-field-row button{height:34px;flex:none;margin-bottom:12px}',
          /* Slider 的数值读数（`<output class="…dtsSliderOutput">`）在真机里被压到 12px / 7px 宽
             （逐屏核验：背景页两处）—— 读数字被截断/换行。控件层已写 `flex:none`，但父级 flex
             仍把它压扁，所以这里补一个最小宽度。类名带模块盐 ⇒ 锚**后缀**。 */
          '.dts-page [class*="dtsSliderOutput"]{flex:none;min-width:46px;text-align:right;white-space:nowrap}',
          /* ★ 真机键盘复核发现：`Pill` 控件**自己没有焦点环**
             （`controls/Pill.module.css` 里没有任何 `:focus-visible`，而 Button/Switch/… 都有）——
             它用在页签组与色板等处，Tab 到它时看不到焦点（真机实测 8 次 Tab 里唯一 ring=false 的一个）。
             控件层不在本轮可写范围，因此在页面侧补一条；锚类名**后缀**（盐前缀随构建变）。 */
          '.dts-page [class*="dtsPill"]:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-alias-brand-primary);outline-offset:2px}',
          /* ⚠️ 本轮删除：为绕过 `tools/css-modules.mjs` 盐 bug 临时补的
             **Input / TextField 等价皮肤**（旧 `.dts-field-grow>input`、
             `.dts-input-flex>span`、`.dts-input-flex input` 五条规则）。
             该 bug 已由 Lead 修好（盐首字符强制取字母，真机实测 19/19 模块均解析出规则），
             控件自身的 `Input.module.css` / `TextField.module.css` 已生效且与那层皮肤**同源同值**
             （同一份官方 `lib/settings-form/fields.module.css`），留着就是**第二个真源**。
             下面只保留**布局**（不涉几何/颜色），几何一律归控件自己的 module.css。 */
          '.dts-field-grow{flex:1;min-width:0}',
          '.dts-input-flex{flex:1;min-width:36px;display:flex}',
          /* 布局：让控件铺满输入位。`min-width:36px` 保底：极限挤压下输入位残缺可见
             而不是整个消失。 */
          '.dts-input-flex>*{flex:1;min-width:0}',
          '.dts-filter-row{display:flex;align-items:flex-end;gap:12px;margin-bottom:10px}',
          '.dts-token-groups{display:flex;flex-direction:column;gap:10px}',
          '.dts-extras{display:flex;flex-direction:column;gap:6px;margin-top:6px}',
          '.dts-row-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}',
          '.dts-json-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 0 0}',
          '.dts-disclosure{padding:4px 0}',

          /* 高级页的自定义 CSS 文本域（原生 textarea，不属控件层）。
             底盘走官方字段几何：官方字段的圆角/描边/底色 + 等宽字。
             ⚠️ 玻璃只在 `body.dts-on`（= 有背景）下接管，且**必须同时给填充与模糊**。 */
          '.dts-textarea{width:100%;min-width:0;padding:4px 8px;min-height:132px;resize:vertical;'
          + 'font-family:var(--ds-font-family-code,monospace);font-size:12px;line-height:1.6;'
          + 'color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);'
          + 'border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);'
          + 'box-shadow:var(--dsw-elevation-soft)}',
          /* 自家输入面跟壁纸玻璃走（body.dts-on = 有背景）
             ⚠️ 大模糊只给**少量大件**（textarea）：密集小输入若逐个挂 blur，
             色彩页合成层爆炸 —— 闪屏、渲染撕裂、丢失交互（实测回归）。
             ⚠️⚠️ 小输入**不能跟 GLASS_FILL 走** —— 它是 transparent，而这条路径
             **没有 backdrop-filter**（就是上面那条性能约束），透明 + 无糊 = 输入框
             整个消失、用户看不见自己在哪输入。它要的是"看着像玻璃的浅底"、不必真磨砂：
             给它**自己的浅玻璃令牌** `--dts-glass-fill-thin`（半透明、非 transparent）。
             锚点用**自家类** `.dts-input-flex`（tabs.ts 的 `uiInput` 包壳，颜色页 hex 框、
             方案名输入、令牌名输入…全走它）—— 不猜宿主类名、也不依赖构建盐。 */
          'body.dts-on .dts-textarea{' + glass(GLASS_FILL) + '}',
          'body.dts-on .dts-input-flex>*{background:var(--dts-glass-fill-thin,rgba(16,20,24,.28))!important}',
          /* 面板里的下拉触发器 —— 自写控件层 `Select` 的按钮。
             ⚠️ 选择器用**自家面板子树 + ARIA 契约**（`.dts-page` 是我们的类，
             `aria-haspopup="listbox"` 是规范强制的无障碍契约），不再用
             `[class$="_dtsSelectTrigger"]` 这种"按 module 类名后缀锚"的写法：
             阶段 C/D 的机械判据要求 `class$=`/`class*=` 归零，而 ARIA 契约同样稳定
             （且不依赖 `tools/css-modules.mjs` 的盐格式）。 */
          'body.dts-on .dts-page button[aria-haspopup="listbox"]{' + glass(GLASS_FILL) + '}',

          '.dts-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;font:inherit;font-size:13px;'
          + 'color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-elevated-fill);'
          + 'border:0;border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-soft);cursor:pointer;text-decoration:none}',
          '.dts-btn:hover{background:var(--dsw-alias-button-floating-hover)}',
          '.dts-btn:disabled{opacity:.5;cursor:not-allowed}',
          /* 官方控件缺失时走这些自绘类，键盘焦点环必须一样可见。 */
          '.dts-btn:focus-visible,.dts-pill:focus-visible,.dts-switch:focus-visible,'
          + '.dts-swatch:focus-visible,.dts-drop:focus-visible,.dts-textarea:focus-visible{'
          + 'outline:var(--dsw-focus-ring-width,2px) solid '
          + 'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
          '.dts-btn[data-tone="primary"]{color:var(--dsw-alias-label-primary-foreground);'
          + 'background:var(--dsw-alias-button-primary-fill)}',
          '.dts-btn[data-tone="danger"]{color:var(--dsw-alias-state-error-primary)}',
          /* 官方 Button 的 danger 只能自家上色（官方 variant 表里没有 danger）。 */
          '.dts-btn-danger{color:var(--dsw-alias-state-error-primary)}',
          /* 面板内按钮一律单行完整显示：官方 `.button` 没有 white-space（`Button.module.css`），
             flex 行里被 width:100% 的输入框一挤就折行堆叠溢出（「保存当前方案」实锤）。
             字号与自绘 `.dts-btn` 统一（官方 13px 档）。 */
          '.dts-page button,.dts-page .dts-btn{white-space:nowrap;flex:none;font-size:13px}',
          /* 动效统一走 ui-theme 权威令牌（`base.css` 实证：--ds-ease-in-out /
             duration .2s / fast .1s / slow .3s），不再散落硬编码时长。
             ⚠️ 这里的兜底是**时长与关键字**（官方也只对数值型令牌写兜底），不是颜色。 */
          '.dts-page button,.dts-page .dts-btn{transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),'
          + 'color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),'
          + 'border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}',
          /* 滑块不再自绘：面板里 20 条滑块全部交给自写控件层的 `Slider`。 */
          '.dts-color{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto;justify-content:flex-end}',
          '.dts-color input[type="color"]{width:30px;height:26px;padding:0;border:0;background:transparent;cursor:pointer;flex:none}',
          /* 开关兜底（官方控件缺席时）—— 逐条对齐官方 `Switch.module.css`：
             轨道 `--dsw-alias-border-l3`、开态 `--dsw-alias-brand-primary`、
             拇指 `--dsw-alias-label-primary-foreground`、位移 16px、动效 120ms ease。
             （旧版开态用 success 绿、拇指是写死的纯白，两处都偏离官方。） */
          '.dts-switch{width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;cursor:pointer;position:relative;'
          + 'background:var(--dsw-alias-border-l3)}',
          '.dts-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;corner-shape:round;'
          + 'background:var(--dsw-alias-label-primary-foreground);transition:transform 120ms ease}',
          '.dts-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}',
          '.dts-switch[aria-checked="true"]::after{transform:translateX(16px)}',
          /* 令牌名建议弹层（替掉原生 <datalist>：它的弹层是系统 UI，主题够不着 ——
             与"原生 <select> 弹层吃不到毛玻璃"同一个根因）。材质走自写 MenuSurface，
             这里只补定位与滚动上限。 */
          '.dts-adder{display:flex;align-items:flex-end;gap:8px}',
          '.dts-adder-field{position:relative;flex:1;min-width:0}',
          '.dts-suggest{position:absolute;bottom:calc(100% + 4px);left:0;right:0;z-index:1000;'
          + 'max-height:220px;overflow-y:auto;overscroll-behavior:contain;'
          + 'padding:4px;display:flex;flex-direction:column;gap:0;'
          + 'box-shadow:var(--dsw-elevation-prominent)}',
          '.dts-suggest-row{appearance:none;border:0;background:transparent;text-align:start;font:inherit;'
          + 'font-family:var(--ds-font-family-code,monospace);font-size:12px;padding:6px 8px;'
          + 'border-radius:var(--dsw-radius-md);cursor:pointer;color:var(--dsw-alias-label-primary);'
          + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.dts-suggest-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
          '.dts-suggest-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid '
          + 'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',

          '.dts-pill{padding:3px 10px;font:inherit;font-size:12px;border:0;border-radius:999px;corner-shape:round;cursor:pointer;'
          + 'background:var(--dsw-specific-selector);color:var(--dsw-alias-label-secondary)}',
          '.dts-pill[aria-pressed="true"]{background:var(--dsw-alias-brand-primary);'
          + 'color:var(--dsw-alias-label-primary-foreground)}',

          '.dts-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:8px}',
          '.dts-swatch{display:flex;flex-direction:column;overflow:hidden;padding:0;text-align:start;font:inherit;'
          + 'color:inherit;background:var(--dsw-alias-bg-layer-1);border:0;border-radius:var(--dsw-radius-md);'
          + 'box-shadow:var(--dsw-elevation-soft);cursor:pointer}',
          '.dts-swatch:hover{box-shadow:var(--dsw-elevation-prominent)}',
          '.dts-swatch[aria-pressed="true"]{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary),'
          + 'var(--dsw-elevation-soft)}',
          '.dts-swatch-art{display:block;height:44px}',
          '.dts-swatch-name{padding:6px 8px 2px;font-size:12px}',
          '.dts-swatch-note{padding:0 8px 7px;font-size:11px;color:var(--dsw-alias-label-tertiary)}',

          '.dts-library{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}',
          '.dts-card{display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1);'
          + 'border:0;border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-soft)}',
          '.dts-thumb{display:block;width:100%;height:82px;object-fit:cover;background:var(--dsw-alias-bg-skeleton)}',
          '.dts-card-body{display:flex;flex-direction:column;gap:4px;padding:8px}',
          '.dts-card-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.dts-card-meta{display:flex;align-items:center;gap:6px;font-size:11px;'
          + 'color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}',
          '.dts-card-actions{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 8px}',
          '.dts-btn--sm{padding:3px 8px;font-size:12px}',
          '.dts-profile-list{display:flex;flex-direction:column;gap:6px}',
          /* ⚠️ profile 行**只有 3 个元素**（名字 | 描述 | 动作），却继承了 `.dts-token-row` 的
             **4 列**模板（`1.6fr 1fr 1fr auto`）⇒ 动作落到第 3 列、第 4 列整列空着，
             视觉上就是「右边一大块留白、三列不齐」—— 主人截图里指出的那个"歪"。
             给它自己的三列：名字按内容宽、描述吃剩余、动作贴右。 */
          '.dts-token-row.dts-profile-row{grid-template-columns:minmax(0,auto) minmax(0,1fr) auto;align-items:center}',
          '.dts-profile-dot{display:inline-block;width:11px;height:11px;border-radius:50%;corner-shape:round;margin-right:6px;vertical-align:-1px;'
          + 'border:.5px solid var(--dsw-alias-border-l2)}',
          // 官方 Button 的 className 是哈希类名，只能按元素收紧：卡片窄时按钮文字不许折行。
          '.dts-card-actions button,.dts-card-actions .dts-btn{flex:none;white-space:nowrap}',
          '.dts-drop{display:flex;align-items:center;justify-content:center;padding:20px 14px;font-size:13px;'
          + 'color:var(--dsw-alias-label-tertiary);border:.5px dashed var(--dsw-alias-border-l3);'
          + 'border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-skeleton);cursor:pointer;text-align:center}',
          '.dts-drop[data-hot="true"]{border-color:var(--dsw-alias-brand-primary);'
          + 'color:var(--dsw-alias-brand-primary);background:var(--dsw-specific-selector)}',
          '.dts-focus{position:relative;width:100%;max-width:230px;aspect-ratio:16/9;overflow:hidden;border-radius:var(--dsw-radius-md);'
          + 'background:var(--dsw-alias-bg-skeleton) center/cover no-repeat;cursor:crosshair}',
          '.dts-focus::after{content:"";position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;'
          + 'border:2px solid var(--dsw-alias-brand-primary);border-radius:50%;corner-shape:round;'
          + 'box-shadow:0 0 0 999px var(--dsw-alias-bg-mask-2);left:var(--fx,50%);top:var(--fy,50%)}',
          '.dts-token-row{display:grid;grid-template-columns:minmax(120px,1.6fr) repeat(2,minmax(120px,1fr)) auto;gap:8px;align-items:center}',
          '.dts-token-name{font-family:var(--ds-font-family-code,monospace);font-size:11px;'
          + 'color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          /* profile 行复用 `.dts-token-name` 时**不该**是等宽 11px（那是给色值/令牌名用的）：
             行标题按官方行的排版（13/20、中黑），与描述一起构成"标题 + 说明"的左列。 */
          '.dts-profile-row .dts-token-name{font-family:inherit;font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary)}',
          '.dts-pair{display:flex;gap:6px;align-items:center;font-size:11px;'
          + 'color:var(--dsw-alias-label-tertiary);min-width:0}',
          /* 「浅色值/深色值」标签锁宽不参与压缩：曾被 flex 挤到一字宽竖排
             （色彩页 token 行实测，窄模态更严重）。挤压压力交给输入链优雅退化。 */
          '.dts-pair-label{flex:none;white-space:nowrap}',
          /* 「清除」按钮隐形占位：无值行曾不渲染第 4 子项，独立 grid 的 auto 轨
             一行为 0 一行为 53px —— 上下列错位（色彩页实测）。恒渲染 + visibility
             占位让每行轨道测量一致；hidden 保不可交互。 */
          '.dts-clear-slot{display:inline-flex}.dts-clear-slot[data-empty="true"]{visibility:hidden}',
          '.dts-contrast{display:inline-flex;gap:6px;align-items:center;font-size:12px;'
          + 'font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}',
          /* 对比度读数里的等级徽章改走自写控件层的 `Tag`（只读徽章，8 种 tone），
             原来的 `.dts-badge` 一族连同 data-level 语义一起删除。 */

          /* 确认框（由 `Modal` 控件承载）里那几行正文与动作行。 */
          '.dts-dialog-line{font-size:13px;line-height:20px;'
          + 'color:var(--dsw-alias-label-secondary);word-break:break-word}',
          '.dts-dialog-line[data-kind="path"]{font-family:var(--ds-font-family-code,monospace);font-size:12px}',
          '.dts-dialog-foot{display:flex;justify-content:flex-end;gap:8px}',

          /* ══════════════════════════════════════════════════════════════════
             ★★★ 兜底模态路径的「设置面板」几何 —— 与官方逐值对齐

             为什么这里才需要几何：主路径（注进 `settings.section`）下**宿主已经给了**
             overlay + mask + 800px panel（取证见本文件上方 `.dts-page` 段落的引文），
             我们只渲染内容列；只有在 `slots.entries('settings.section')` 说条目没落地时，
             才回退到「通用设置」一行 + 自开模态 —— 那时宿主什么都没给，必须自己当面板。

             结构对齐官方 `SettingsPanel`：
               root(固定全视口 + 居中，padding 上下 max(24px, --dsh-frame-top-clearance))
                 ├ mask（`bg-mask-1` + `--dsw-mask-blur`，默认 none）
                 └ dialog（`.dts-modal-panel`，即官方 `.panel`）
                     ├ `.dts-modal-head`    ← 官方 `.header{height:54px;padding:20px 14px 8px 10px}`
                     └ `.dts-modal-options` ← 官方 `.options{flex:1;min-height:0;padding:0 24px 24px;
                                                            overflow-y:auto}`（唯一滚动容器）

             ⚠️ 宽高为什么不写 `calc(100vh - 2*max(...))` 而写 `100%`：
               overlay 的 padding 已经吃掉了那两段净空（`max(24px, clearance)` 上下各一），
               所以 `height:100%` 恒等于官方那条 `calc(100vh - 2*max(24px, clearance))`，
               `max-width:100%` 恒等于官方的 `calc(100vw - 48px)`（左右各 24px）。
             ⚠️ 圆角/底色/阴影不在这里写：`Modal.module.css` 的 `.dtsModalDialog` 已经是
               官方那三条（--dsw-radius-panel / bg-layer-2 / --dsw-elevation-prominent），
               这里只覆盖几何，不重复声明材质（重复声明=第二个真源）。 */
          '.dts-modal-panel{width:800px;max-width:100%;height:min(800px,100%);gap:0;padding:0;'
          + 'display:flex;flex-direction:column;overflow:hidden}',
          '.dts-modal-head{flex:none;height:54px;padding:20px 14px 8px 10px;display:flex;'
          + 'align-items:center;justify-content:flex-end;gap:8px}',
          '.dts-modal-close{width:28px;height:28px;padding:0;border:0;flex:none;display:inline-flex;'
          + 'align-items:center;justify-content:center;border-radius:var(--dsw-radius-sm);'
          + 'background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary)}',
          '.dts-modal-close:hover{background:var(--dsw-alias-interactive-bg-hover)}',
          '.dts-modal-close:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid '
          + 'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
          '.dts-modal-options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}',

          /* ⚠️ 遮罩层**既不能压黑、也绝不能带 backdrop-filter** —— 这是「弹窗没有磨砂质感」
             的真根因，两条都实测过（条纹壁纸 + 遮罩 + 玻璃卡三格横排复现）：
              ① **不能压黑**：48% 黑先铺在弹层底下，把背后正文与底色的对比度砍到极低再进
                 blur 采样；糊只抹"有对比度的细节"，剩下的就是**一坨灰雾**。
              ② **不能带 backdrop-filter**：带它的元素会成为 **backdrop root**，子树里
                 再开 blur 就只采到"这一层"为止。实测：
                   遮罩无 blur  → 卡片内条纹被卡片自己的 blur(40px) 抹净 ✓ 真磨砂
                   遮罩 blur2px → 卡片内**条纹清晰可见** ✗ 卡片的 blur 被圈死
             自造遮罩/卡片/对话框（`.dts-scrim` / `.dts-modal-mask` / `.dts-modal-card` /
             `.dts-dialog*`）已**整族删除**：面板模态与确认框现在都由自写控件层的 `Modal`
             承担 —— 它逐字移植了官方 `lib/Modal.module.css` + `useModalLayer`
             （`createPortal(..., document.body)`、`role="presentation"` 根层、`aria-hidden`
             遮罩点击即关、`role="dialog"` + `aria-modal` + `aria-label`、初始焦点
             `[data-modal-autofocus]`、Escape 只归最顶层、Tab 焦点陷阱、关闭时归还焦点、
             `--dsw-radius-panel` + `--dsw-elevation-prominent`），z-index 是官方那一个 **1000**。
             官方遮罩形态 = `bg-mask-1` + `backdrop-filter:var(--dsw-mask-blur)`，而 ui-theme
             把 `--dsw-mask-blur` 定义为 `none`（官方明文"遮罩不模糊背景"）——
             所以它既不压暗到废掉子级取景、也不会成为 backdrop root。**纪律没变，只是换了载体。** */

          /* ══════════════════════════════════════════════════════════════════
             ★★★ 宿主表面锚点强注（**本轮从审计前副本原样移植**，主人钦定）

             为什么必须有这一段：零自选色口径下 `blur()` 是**唯一**承担"看不清底字"的
             机制，而宿主的大量表面**不是**官方 `MenuSurface`／`Modal`，它们没有材料子层、
             底色直接读 `--dsw-alias-bg-layer-*`（已被我们重铸成半透明）——
             于是壁纸与正文直接透上来、字叠字。只靠令牌重铸覆盖不到这些面：
               · 会话**输入卡**（`_card`）—— 主人截图点名的"对话框要磨砂"；
               · 输入框「+」命令弹层（`_card:has(search)`）；
               · 会话/工作区 **hover 卡**（portal 到 body，`hoverTime` 是唯一稳定特征）；
               · 引导卡族（`_entry` / `_guide` / `_loadingFloat`）与其中的图标型小按钮；
               · DockKit 停靠面板族（`[data-dockkit-*]`）；
               · 设置面板**之上的叠加层**与 portal 到 body 的对话框/浮层。

             ⚠️ 纪律（本段每条都必须守）：
               · 磨砂一律走 `glass()`（= `var(--dts-glass-fill)` + `var(--dts-glass-blur…)`），
                 **不写死新的字面 blur()**；
               · 颜色/圆角/描边优先 `--dsw-*` 令牌；确实没有等价令牌的按副本保留原字面值
                 （`rgba(255,255,255,.08)` 描边、`rgba(16,20,24,.92)` 确认框实底、
                 `#16181d` 原生下拉弹层 —— 这三处是"官方不为此发令牌"的 artwork 例外）；
               · `body.dts-on` 闸 = "有背景"（与 engine 侧 `glass.enabled &&
                 backdrop.mode !== 'none'` 同源），宿主材质改写一律挂在它下面；
                 唯一的例外是 hover 卡（`body > :has([class*="hoverTime"])`）——
                 它的可读性与壁纸开没开无关，且 `dts-on` 可能因首屏时序缺席，能不赌就不赌。
               · **`body.dts-on #root{position:relative;z-index:1}` 是阶段 E 的承重墙**
                 （背景层靠它压在 `#root` 之下），绝对不许动。
             ══════════════════════════════════════════════════════════════════ */

          /* ── A. 会话页：统计条 / 上下文用量表 ─────────────────────────────
             会话统计条（StatsPills，根节点带 `data-composer-stats`）：宿主默认完全无背景
             （药丸 `background:0 0`，原设计坐在不透明底上）；壁纸主题下消息文字从它背后
             滚过直接叠字（主人实测）。给输入卡同款玻璃 —— 不透但毛玻璃质感。 */
          'body.dts-on [data-composer-stats]{border-radius:16px;padding:4px 12px;'
          + glass(GLASS_FILL) + '}',
          /* 上下文用量表（ContextMeter，"44%" 圆环）：与统计条同排的兄弟控件，同样是
             "静默透明、hover 填充"的宿主设计。子串匹配 `_root`+`_trigger`，再要求触发钮
             带 `aria-haspopup=dialog`（上下文面板是 dialog 弹层，与 menu/listbox 区分）。 */
          'body.dts-on span[class$="_root"]:has(button[class$="_trigger"][aria-haspopup="dialog"])'
          + '{border-radius:16px;padding:4px 8px;' + glass(GLASS_FILL) + '}',

          /* ── B. 会话页：输入卡族（★ 主人截图点名面） ────────────────────
             非交接类 `_card`（会话输入卡 `BuPN2G_card` / `ThMjxG_card` 等）：设置同款
             毛玻璃 —— 不透但磨砂质感。
             ⚠️ `[class*="_card "]` 并集不可省：busy 态输入卡是多类名（`_card` 不在属性
             末尾），`[class$="_card"]` 后缀匹配不中，曾裸奔成纯白大白板（实测）。 */
          'body.dts-on [class$="_card"],body.dts-on [class*="_card "]{'
          + glass(GLASS_FILL) + ';border-radius:16px!important}',
          /* ★ 输入卡 = 「+ 命令菜单 / 一切 MenuSurface 弹层」的祖先 —— 这才是
             「+ 菜单没有玻璃磨砂质感、还是透的」的真根因。实测链路（app.asar）：
               · 宿主 `.BuPN2G_card`（输入卡）**自己没有** backdrop-filter；
               · MenuSurface 的 `.material{background:var(--dsw-menu-surface-fill);
                 backdrop-filter:var(--dsw-menu-backdrop-filter)}` —— 磨砂层是自带的；
               · 菜单之所以永远只"透"不"磨"，是因为**我们**上面那条 `[class$="_card"]`
                 给卡片本体挂了 blur → 卡片成了 backdrop root → 子树里 `.material`
                 的取景被圈死（engine 注释里那句「blur 帮不上忙 / 取景失效」就是它）。
             解法：把这层磨砂**搬进 `::before`** —— 视觉结果与挂在本体上完全一致，
             但**卡片本体不再是 backdrop root**，菜单里的 blur 立刻恢复工作。
             只对输入卡做：`:has([data-placeholder])` 在全量 bundle 里**唯一命中**
             （实测 `data-placeholder` 全库仅 1 处，就在输入框上），且 `.BuPN2G_card`
             实测 `position:relative`，`::before` 的 `inset:0` 才有正确包含块。
             ⚠️ 绝不能推广到整个卡片族：23 条 `_card` 规则里 18 条是 static 的，
             静态卡片的 `inset:0` 会按视口取尺寸，糊出一整屏。 */
          'body.dts-on [class$="_card"]:has([data-placeholder]),'
          + 'body.dts-on [class*="_card "]:has([data-placeholder])'
          + '{backdrop-filter:none!important}',
          'body.dts-on [class$="_card"]:has([data-placeholder])::before,'
          + 'body.dts-on [class*="_card "]:has([data-placeholder])::before'
          + '{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;'
          + 'border-radius:inherit;background:' + GLASS_FILL + '!important;'
          + 'backdrop-filter:' + GLASS_BLUR + '!important}',
          /* 输入框「+」/ 命令弹层（`PopupSelectView.card = a5k4Qq_card`，内容哈希不吃）——
             它属于 `[class$="_card"]` 族，本该拿到卡片同款玻璃。用 `:has(search 输入)`
             精确命中它（`a5k4Qq_search` 是本地名、不吃哈希），走统一 `glass()`。 */
          'body.dts-on [class$="_card"]:has([class*="search"])'
          + '{' + glass(GLASS_FILL) + '}',
          /* 任务结束交接卡（`gKjQ0W_card`）：透明 —— 壁纸直接看得清（主人钦定
             「搞成透明的，看得清背景壁纸的那种」），只留圆角描边勾轮廓。
             ⚠️ `:has` 必须用文件三件套（`_path`/`_counts`/`_file`）当特征：`_row` 后缀
             太泛，会话输入卡内部也有 `_row`，曾把输入框误伤成透明（主人实测
             「变回原来那种不透明的」）。本条特异性高于上条，交接卡胜出。 */
          'body.dts-on [class$="_card"]:has([class$="_path"],[class$="_counts"],[class$="_file"]),'
          + 'body.dts-on [class*="_card "]:has([class$="_path"],[class$="_counts"],[class$="_file"])'
          + '{background:transparent!important;backdrop-filter:none!important;'
          + 'border:1px solid rgba(255,255,255,.08)!important;border-radius:16px}',
          /* 卡片/文件行内的子件不该再自带底（否则玻璃上叠出一块实色）。 */
          'body.dts-on [class$="_card"] [class$="_header"],body.dts-on [class$="_card"] [class$="_tile"],'
          + 'body.dts-on [class$="_file"] [class$="_fileIcon"]{background:transparent!important;border-color:transparent!important}',

          /* ── C. 会话页：文件行 / 预览（交接任务） ──────────────────────── */
          'body.dts-on [class$="_file"]{border:1px solid rgba(255,255,255,.08)!important;border-radius:16px;'
          + glass(GLASS_FILL) + '}',
          /* 交接任务文件的展示（`_preview` / diff 预览）：换成交接卡同款玻璃 ——
             看不清壁纸但是是透的（主人钦定），与透明外壳形成层次。 */
          'body.dts-on [class$="_preview"]{border:1px solid rgba(255,255,255,.08)!important;'
          + 'border-radius:12px;' + glass(GLASS_FILL) + '}',

          /* ── D. 会话 / 工作区 hover 卡（portal 到 body） ─────────────────
             主人实测「不是透明磨砂质感、看不清字」。卡子是 ui-primitives 的 HoverCard：
             面写死成 `--dsw-hovercard-bg:#2C2C2E` 的**实底**，整条 `.card` 规则
             **没有 backdrop-filter**，所以永远是一块不透深灰压在壁纸上。
             前两版落空的教训：一次认了「类名是 `_card_xxx`」、一次认了「style 里一定有
             `--dsw-hover-preview-fade`」—— 两个都是**猜的**，类名/样式在不同构建里形态
             不一，猜错就整条静默失配。这版改成**用看得见的那部分反推**：卡里装的是 Rows 的
             `hoverTitle`/`hoverTime`/`hoverStatus`，而 HoverCard 是
             `createPortal(card, document.body)` —— 卡片**直接挂在 body 下**。
             于是 `body > :has([class*="hoverTime"])` 精确命中「卡片本身」：`>` 保证不会
             同时命中卡**内部**的 hoverContent（否则会叠两层底色、内框更深），
             `[class*="hoverTime"]` 是本地名子串，哈希前/后两套命名约定都吃。
             第二条留作同元素的备份钩子（`_copyable_` 只会长在卡片上）。
             不挂 `body.dts-on` 闸：hover 卡的可读性与壁纸开没开无关，而且 `dts-on` 是个
             可能缺席的类（首屏壁纸来自 boot CSS，两者并不同步）—— 能不赌就不赌。 */
          'body > :has([class*="hoverTime"]),'
          + '[class*="_card_"][class*="_copyable_"]'
          + '{' + glass(GLASS_FILL) + '}',

          /* ── E. 引导卡族：两态材质（主人第七轮钦定） ─────────────────────
             「开始」面板的**两态材质**：
               未全屏（右侧栏，与正文并排）→ **零材质**，壁纸 100% 原样看清，连磨砂都不要；
               全屏（整窗铺开）            → 维持全局口径：壁纸原生色 + 只加磨砂。
             判定锚点 = **宿主自己在用的** `data-sidebar-right-panel`
             （JSX：`"data-sidebar-right-panel": fullscreen ? "fullscreen" : "push"`）——
             纯 CSS 可判定、随宿主切换即时生效。
             ⚠️ 别用 `:fullscreen` 伪类：那是浏览器 Fullscreen API 的状态，而这个"全屏"是
             应用内部侧栏展开，`:fullscreen` 不会命中。
             ⚠️⚠️ **两条都必须带右侧栏祖先闸**：早先只有后缀、没有祖先限定时**越界打到了
             聊天正文** —— `_entry` 这个后缀**跨 3 个包**在用（sidebar-right 的引导卡、
             terminal 的引导卡、chat 的目录项），仅凭后缀匹配会误伤第三方。
             ⚠️⚠️ ④ 的 `:not([...="push"])` **不是可选修饰，是必须的**：
             `[data-sidebar-right-panel="push"]` 与 `[data-sidebar-right-panel]` 特异性
             完全相同 (0,3,1)，谁覆盖谁**只由书写顺序决定**；不带 `:not()` 时 push 态被
             反压成 blur(40px) —— 未全屏长出磨砂，与要求相反。带 `:not()` 后结构互斥。 */
          /* ① 锚按钮（首选）：面板里**没有** mode="push" 按钮 ⟺ 尚未全屏 → 零材质 */
          'body.dts-on [class$="_panel"]:not(:has([data-sidebar-right-mode="push"])) [class$="_entry"],'
          + 'body.dts-on [class$="_panel"]:not(:has([data-sidebar-right-mode="push"])) [class*="_entry "]'
          + '{background:transparent!important;backdrop-filter:none!important;'
          + 'border:1px solid rgba(255,255,255,.08)!important;border-radius:16px!important}',
          /* ② 锚按钮（首选）：面板里**有** mode="push" 按钮 ⟺ 已全屏 → 只加磨砂
             ⚠️ 语义是反向的：该属性记的是"点下去会切到哪个模式"，不是当前模式。 */
          'body.dts-on [class$="_panel"]:has([data-sidebar-right-mode="push"]) [class$="_entry"],'
          + 'body.dts-on [class$="_panel"]:has([data-sidebar-right-mode="push"]) [class*="_entry "]'
          + '{' + glass(GLASS_FILL) + ';border:1px solid rgba(255,255,255,.08)!important;'
          + 'border-radius:16px!important}',
          /* ③ 锚面板属性（兜底）：未全屏 */
          'body.dts-on [data-sidebar-right-panel="push"] [class$="_entry"],'
          + 'body.dts-on [data-sidebar-right-panel="push"] [class*="_entry "]'
          + '{background:transparent!important;backdrop-filter:none!important;'
          + 'border:1px solid rgba(255,255,255,.08)!important;border-radius:16px!important}',
          /* ④ 锚面板属性（兜底）：已全屏。双锚并存 —— 宿主若改掉其中一处的命名，
             另一条仍兜住；语义都收敛到「未全屏 = 零材质 / 已全屏 = 只磨砂」。 */
          'body.dts-on [data-sidebar-right-panel]:not([data-sidebar-right-panel="push"]) [class$="_entry"],'
          + 'body.dts-on [data-sidebar-right-panel]:not([data-sidebar-right-panel="push"]) [class*="_entry "]'
          + '{' + glass(GLASS_FILL) + ';border:1px solid rgba(255,255,255,.08)!important;'
          + 'border-radius:16px!important}',
          /* 面板容器本身：**两种状态都透明**（它就是承载壁纸的那层，不该有自己的底色）。
             双锚齐上、任一命中即可 —— `_guide` 同样跨包（chat 有 guidePanel/guideItem），
             范围锁在右侧栏内最稳。 */
          'body.dts-on [class$="_panel"]:has([data-sidebar-right-mode]) [class$="_guide"],'
          + 'body.dts-on [data-sidebar-right-panel] [class$="_guide"]'
          + '{background:transparent!important;backdrop-filter:none!important}',
          /* 加载浮标 `_loadingFloat` —— 名字自带 Float，底色 `bg-layer-2`（不透明），
             是浮在内容之上的状态条，按浮层磨砂。 */
          'body.dts-on [class$="_loadingFloat"]{' + glass(GLASS_FILL) + '}',

          /* ── F. 引导卡内的**图标型小按钮**（主人截图指出的漏网面） ────────
             取证（asar → dsh-client-ui-sidebar-terminal）：`Txfvra_trigger` 是个独立
             <button>（「新建终端」那个 ⌄），自己的 CSS **没有 background** —— 底色来自
             浏览器默认按钮样式或宿主全局 button 规则。而 Button.module.css：
               `.button{background:transparent}` / `.ghost:hover{background:
               var(--dsw-alias-interactive-bg-hover)}` —— 那两个令牌被我们的玻璃重铸成了
             **半透明深色**，在透明卡片上就显出一块不透明小方块（主人截图正是悬停/展开态）。
             所以病灶不在"按钮静止底色"，而在**它的 hover/active 填充**。
             ══ 通用根因封杀（比逐个找类名可靠）══
             扫描 ui-primitives / sidebar-right / sidebar-terminal / agent-preset 四个包，
             发现一个**系统性模式**：宿主大量小按钮在交互态用「层令牌」上底
             （`.helpButton:hover{background:var(--dsw-alias-bg-layer-4)}` /
             `.iconButton:hover{background:var(--dsw-alias-bg-layer-1)}`…），
             而这些令牌**会被我们的玻璃重铸改成不透明深色** ⇒ 从"几乎看不见的浅灰"变成
             "透明卡片上一块明显的实心色块"。逐个类名追是追不完的，改为按**语义**一次封杀：
             凡是**图标型小按钮**（`[aria-label]` + 不是卡片主点击层）的交互态，
             一律不参与自带填充 —— 它们本来就不该靠底色表达状态。 */
          'body.dts-on [class$="_entry"] button:hover,'
          + 'body.dts-on [class*="_entry "] button:hover,'
          + 'body.dts-on [class$="_entry"] button:active,'
          + 'body.dts-on [class*="_entry "] button:active'
          + '{background:transparent!important}',
          'body.dts-on [class$="_entry"] button[aria-haspopup],'
          + 'body.dts-on [class*="_entry "] button[aria-haspopup],'
          + 'body.dts-on [class$="_entry"] button[aria-expanded],'
          + 'body.dts-on [class*="_entry "] button[aria-expanded],'
          + 'body.dts-on [class$="_entry"] button:not([class*="_main"]),'
          + 'body.dts-on [class*="_entry "] button:not([class*="_main"])'
          + '{background:transparent!important;border:0!important;box-shadow:none!important}',
          /* ★★★ 真根因（第二十五轮，**Playwright 打开独立 DSH web 实例实测拿到**）：
             上面所有规则写的都是 `[class$="_entry"] button` —— **要求 button 是 `_entry` 的
             后代**。而引导卡的真身是「**卡片本身就是那个 `<button>`**」：
                 <button type="button" class="lnbXlW_entry" data-sidebar-right-guide-entry="files" …>
             实测 computed style（注入前 → 注入后）：
                 button.lnbXlW_entry  bg: rgb(255,255,255)  →  rgba(0,0,0,0)
             ⇒ 后代选择器**一条都打不到卡片本体**，所以「⌄ 那块实心方块」一直在。
             那就是主人看到的深色方块：宿主的白底经过我们的玻璃重铸 → 半透明深色。
             补齐：**卡片自身带 `_entry` 类的 button**（含 hover/active/后代全部清零）。 */
/* 引导卡**不限元素类型**：真身有的是 `button`、有的是 `div`（实测 `div.Txfvra_entry`
             注入前 `rgb(255,255,255)`、注入后 `rgba(0,0,0,0)`）。只写 button 会漏掉 div 那种。 */
          'body.dts-on [class$="_entry"],'
          + 'body.dts-on [class*="_entry "],'
          + 'body.dts-on [class$="_entry"]:hover,'
          + 'body.dts-on [class*="_entry "]:hover,'
          + 'body.dts-on [class$="_entry"]:active,'
          + 'body.dts-on [class*="_entry "]:active,'
          + 'body.dts-on [class$="_entry"] *,'
          + 'body.dts-on [class*="_entry "] *,'
          + 'body.dts-on [class$="_entry"][role="button"],'
          + 'body.dts-on [class*="_entry "][role="button"]'
          + '{background:transparent!important;border:0!important;box-shadow:none!important}',
          'body.dts-on button[class$="_trigger"],body.dts-on button[class*="_trigger "],'
          + 'body.dts-on button[class$="_trigger"]:hover,body.dts-on button[class*="_trigger "]:hover,'
          + 'body.dts-on button[class$="_trigger"]:active,body.dts-on button[class*="_trigger "]:active,'
          /* ★★★ 主人第三轮强调（原话）：「这个向下的箭头是要**透过壁纸能看见壁纸**，
             不要磨砂，什么都不要，就是透明的」。
             我此前只清了 `background`，**没有清 `backdrop-filter`** —— 而"糊"正是它造成的：
             那个 `⌄` 是 `button.Txfvra_trigger`（官方 `_ghost_` 变体 + 调用方的 `_trigger`），
             只要任何一层（我们的玻璃重铸或宿主）在它/它的内层包裹上挂了 `backdrop-filter`，
             它就**模糊背后的壁纸**而不是"透过去"。
             ⇒ `backdrop-filter` 一并置 `none`（含 `-webkit-`），并覆盖到**后代**
             （糊可能挂在内层 span/svg 包裹上，只写按钮本体打不到）。 */
          + 'body.dts-on button[class$="_trigger"] *,body.dts-on button[class*="_trigger "] *,'
          + 'body.dts-on [class*="_menu"] button,body.dts-on [class*="_menu"] button *,'
/* 真根因（独立实例实测）：磨砂挂在**包住按钮的菜单根 span** 上（`span._root_…`，
             原值 `backdrop-filter: blur(50px)`），不是按钮本身。锚**类名后缀** `_root_`
             （hash 前缀随构建变）。主人原话：要透过壁纸能看见壁纸，不要磨砂。 */
          + 'body.dts-on span[class*="_root_"]:has(> button),'
          /* ⚠️ 这里**不能**用 `… *`：菜单根 span 的后代里除了按钮，还有**弹出的菜单面**
             （`div._surface_…` + 内层材质层 `div._material_…` —— 官方 MenuSurface 的磨砂就长在材质层，
             它自己 `background: var(--dsw-menu-surface-fill)` + `backdrop-filter: var(--dsw-menu-backdrop-filter)`）。
             用 `*` 会把菜单面一起 `backdrop-filter:none` + `background:transparent` ⇒ **下拉变成完全透明**。
             真机实测：菜单面 computed = bg rgba(0,0,0,0)、bf none，而令牌明明是 blur(50px) saturate(260%)。
             主人要的是「那个 ⌄ 图标透过去」，不是「整个菜单透明」。收窄到**按钮本体 + 按钮内部**
             （内部那层 span/svg 包裹仍要清 —— 糊可能挂在它上面）。 */
          + 'body.dts-on span[class*="_root_"]:has(> button) > button,'
          + 'body.dts-on span[class*="_root_"]:has(> button) > button *,'
          + 'body.dts-on button[class$="_trigger"],body.dts-on button[class*="_trigger "]'
          + '{background:transparent!important;border:0!important;box-shadow:none!important;'
          + 'backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
          /* ★ 宿主侧 disabled 按钮在壁纸上会"化掉"：官方 disabled = 浅底(白) + 深字 + **整块 opacity .4**，
             白底被压成 40% 白、字也被压到 40%，压在壁纸上几乎看不见（主人截图：「保存 看不清」）。
             官方那套样式是按"不透明底"设计的。这里换成**深色实底 + 亮字**。
             ⚠️ **不要用 `opacity` 表达"禁用"**：opacity 是**整体透明**，会把深色实底也一起冲淡
             （`.9` 再乘 `.72` ⇒ 实际只有约 65% 不透明，在壁纸上就是"发灰发淡"——主人复测：「太淡了」）。
             禁用语义交给 `cursor:default` 与"没有 hover/active 反馈"，底色保持不透明才显眼。
             —— 既看得清，又保留"明显不可点"的差别。
             ⚠️ 用 `:not()` 避开自家控件（`dtsBtn`）与自家面板（`.dts-page`）：它们有自己的玻璃表面对比，
             不该被这条改掉。 */
          'body.dts-on button:disabled:not([class*="dtsBtn"]):not(.dts-page *),'
          + 'body.dts-on [role="button"][aria-disabled="true"]:not(.dts-page *){'
          + 'background:var(--dsw-alias-button-elevated-fill)!important;'
          + 'color:var(--dsw-alias-label-primary)!important;'
          + 'opacity:1!important}',
          'body.dts-on button[aria-label]:not([class*="_main"]):hover,'
          + 'body.dts-on button[aria-label]:not([class*="_main"]):active,'
          + 'body.dts-on button[aria-label]:not([class*="_main"])[aria-expanded="true"],'
          + 'body.dts-on button[aria-label]:not([class*="_main"])[aria-pressed="true"]'
          + '{background:transparent!important}',
          /* ★ 主人第二十三轮：「新建终端 ⌄」那个下拉箭头在悬停/展开时会显出一块实底方块。
             上一条要求按钮带 `aria-label`，而它多半是**只有 `aria-haspopup`/`aria-expanded`
             的纯图标键** ⇒ 不被命中。于是按**语义属性**（而不是类名/aria-label）再封一遍：
             宿主所有 `aria-haspopup` / `aria-expanded` 的按钮，交互态一律不自带填充
             —— 它们本来就靠图标与文字色表达状态，实底只会破坏「零自选色、零压暗」的通透感。 */
          /* 第二十九轮清理：本体的 :hover/:active/[aria-expanded=true] 已被下面 `button:not([class*="primary"]):not([class*="_main"])` 完全覆盖（真机命中 152 >= 13），删重复。 */
          /* ★ 关键补充（主人第二轮复测仍见实底）：那块底的载体**常常不是 `<button>` 本身**，
             而是它内层的 span/svg 包裹（官方 Button 的图标槽自带类与背景）。
             只写 `button` 打不到它 —— 所以把**后代一并纳入**。
             ⚠️ 下面这行**不能**以 `+` 开头：它前面是一个 `,` 结束的数组元素 + 注释块，
             写成 `+'…'` 会被解析成**一元加号**（`Number('body…')` = NaN），与下一行拼成
             `"NaNbody.dts-on …"` ⇒ 这两条后代规则**静默失效**（第三十轮核对产物时抓到）。 */
          'body.dts-on button[aria-haspopup] *,'
          + 'body.dts-on button[aria-expanded] *,'
          + 'body.dts-on [role="button"][aria-expanded],'
          + 'body.dts-on [role="button"][aria-haspopup] *,'
          + 'body.dts-on [role="button"][aria-expanded] *'
          + '{background:transparent!important}',
          /* ★ 主人第三轮复测：「⌄ 还是实心的」。已按官方源码逐包取证 ——
             官方 `Button.module.css` 里"交互态上底"的机制就是这两条：
               `.ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}`
               `.ghost:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}`
             而这两个令牌**被我们重铸成半透明深色** ⇒ 在**已经透明**的卡片上显出一块实心方块
             （三轮看到的是同一现象）。
             逐个元素追不出来（它既不在 `sidebar-terminal/lib/client.js` 里，也不带
             `aria-haspopup`/`aria-expanded`），所以按**主人的总口径**收口：
             **除主按钮（primary）与卡片主点击层（_main）外，一切交互态填充归零**。
             这正是「零自选色、零压暗」的落地 —— 状态反馈交给图标与文字色，不靠底色。 */
          'body.dts-on button:not([class*="primary"]):not([class*="_main"]):hover,'
          + 'body.dts-on button:not([class*="primary"]):not([class*="_main"]):active,'
          + 'body.dts-on button:not([class*="primary"]):not([class*="_main"])[aria-expanded="true"],'
          + 'body.dts-on button:not([class*="primary"]):not([class*="_main"])[aria-pressed="true"],'
          + 'body.dts-on [role="button"]:not([class*="primary"]):hover,'
          + 'body.dts-on [role="button"]:not([class*="primary"]):active'
          + '{background:transparent!important}',
/* 窗口菜单容器（主人 DevTools 抓到的稳定 data 钩子；`caption-menu.ts` 也用同一个）。
             `data-windows-menu` 是官方 preload 写死的属性，比 `_surface_gzo7u_7` 那种带模块盐的类名稳。 */
          'body.dts-on [data-windows-menu],'
          + 'body.dts-on [data-windows-menu] *,'
          + 'body.dts-on [data-windows-menu] button:hover,'
          + 'body.dts-on [data-windows-menu] button:active,'
          + 'body.dts-on [data-windows-menu] [role="button"]:hover,'
          + 'body.dts-on [data-windows-menu] [role="button"]:active'
          + '{background:transparent!important}',

          /* ── G. DockKit 停靠面板族（文件/浏览器/终端/上下文洞察…） ───────
             宿主设计坐在不透明应用底色上，玻璃化后面板背后就是会话文字。
             按框架钩子 `[data-dockkit-*]` 一次覆盖。低不透明度 + 大模糊：
             磨砂把背后文字糊掉，面板保持透亮（主人实测 0.65 太闷）。
             ★★★ 主人第八轮修正：「我说的是**这一整个开始菜单**，不是里面的选项」——
             之前几轮改的 `_entry`（四张引导卡）**不是**他看到的那片磨砂。
             真凶是**下面这条**：它给整个 dockkit 面板容器 `[data-dockkit-pane]` 套了磨砂，
             而「开始」面板整个就是这样一个 pane —— 底色在容器层，改卡片没用。
             按主人钦定口径分态（锚 = 那个全屏按钮，取证见上）：
                · 未全屏（面板与正文并排）→ **整个面板零材质**，壁纸 100% 原样
                · 已全屏（整窗铺开）      → 维持磨砂
             双锚并存：按钮属性（首选）+ 面板属性（兜底），任一命中即可。 */
          /* ① 未全屏 → 整个面板容器零材质（清底 + 清糊） */
          'body.dts-on [class$="_panel"]:not(:has([data-sidebar-right-mode="push"])) [data-dockkit-pane],'
          + 'body.dts-on [class$="_panel"]:not(:has([data-sidebar-right-mode="push"])) [data-dockkit-float],'
          + 'body.dts-on [data-sidebar-right-panel="push"] [data-dockkit-pane],'
          + 'body.dts-on [data-sidebar-right-panel="push"] [data-dockkit-float]'
          + '{background:transparent!important;backdrop-filter:none!important}',
          /* ② 其余（含已全屏）→ 磨砂，与全局口径一致 */
          'body.dts-on [data-dockkit-pane], body.dts-on [data-dockkit-float]{'
          + glass(GLASS_FILL) + '}',

          /* ── H. 别的插件的面板卡片（dsh-context 洞察） ───────────────────
             `.lc-card` / `.lc-modal-card`：底色走 `--dsw-alias-bg-layer-1`，被玻璃重铸成
             低不透明度后没有 blur 跟进 —— 全屏看洞察数据时会话文字从卡片背后透出来
             （主人实测）。补输入卡同款磨砂。只覆盖样式，不动其源码。 */
          'body.dts-on .lc-root .lc-card, body.dts-on .lc-modal-card{'
          + glass(GLASS_FILL) + '}',

          /* ── I. 设置界面**之上的叠加层**（结构性一次覆盖，主人第八轮钦定） ──
             「只要叠加在设置上的弹窗都加磨砂，零自选色、零压暗、不能只改一处」
             取证（asar → dsh-client-ui-settings-general 的真实 CSS）：
               `.y7bFDa_overlay{position:fixed;inset:0;z-index:1000}`   ← 设置的外层容器
                 `.y7bFDa_mask {position:absolute;inset:0;
                                background:var(--dsw-alias-bg-mask-1);
                                backdrop-filter:var(--dsw-mask-blur)}`  ← 遮罩（带 bf）
                 `.y7bFDa_panel{z-index:1;width:800px;
                                background:var(--dsw-alias-bg-layer-2)}` ← 设置面板本体
             ⚠️ ① **面板本体没有 backdrop-filter**，底色是 `--dsw-alias-bg-layer-2`
             —— 被玻璃重铸改成半透明后，壁纸细节完整透上来、字叠字（主人图1/图2 的现象）。
             ⚠️ ② **`.mask` 带 backdrop-filter** → 它成为 backdrop root，面板内**任何**
             浮层的 `blur()` 都采不到壁纸、糊等于没加（这就是"加了磨砂还是混"的机制）。
             写法用**后缀锚**（`_overlay`/`_mask`/`_panel`）而不是哈希前缀（`y7bFDa_`
             会随构建变）—— 锚的是**角色后缀**，不是具体类名。
             ⚠️ 判定锚用 `:has(> [class$="_mask"])` 挂在 **overlay** 上，不是 panel 上：
             宿主真实结构里 mask 与 panel **平级**（都是 overlay 的子元素），
             所以 `[class$="_panel"]:has(> [class$="_mask"])` 恒为 false（实测
             `matches()=false`），必须从 overlay 往下选。 */
          /* ① 设置面板本体 —— 半透明底 + 磨砂（糊由它自己承担，颜色交给壁纸） */
          'body.dts-on [class$="_overlay"]:has(> [class$="_mask"]) > [class$="_panel"]'
          + '{' + glass(GLASS_FILL) + '}',
          /* ② 设置遮罩 —— 去掉 backdrop-filter（否则圈死面板内所有浮层的取景），
                只留它自己的半透明底做视觉压暗（这是宿主的设计语义，不是我们的自选色） */
          'body.dts-on [class$="_overlay"] > [class$="_mask"]'
          + '{backdrop-filter:none!important}',
          /* ③ 设置面板**内部的一切叠加层** —— 一条规则覆盖全部，含未来新增的。
                判据是"结构性角色"而非类名：只要它带悬浮语义（role / 浮层后缀），
                且在设置面板子树内，就给它零自选色 + 只加磨砂。
                ⚠️ 用 `:is()` 收拢；`:is()` 取列表里最高的特异性。
                ⚠️ 起点必须是 overlay（同上：panel 与 mask 平级，用 panel 当起点选不到）。 */
          'body.dts-on [class$="_overlay"]:has(> [class$="_mask"]) > [class$="_panel"]'
          + ' :is([role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"],'
          + '[class$="_dialog"],[class$="_menu"],[class$="_popover"],[class$="_popup"],'
          + '[class$="_tooltip"],[class$="_dropdown"],[class$="_sheet"])'
          + '{' + glass(GLASS_FILL) + '}',
          /* ④ 挂在**设置面板之外**的浮层（tooltip 常 portal 到 body 下，不在 panel 子树里）
                —— 上面那条后代选择器够不着，这里按"语义角色"给全局兜底。
                ⚠️ 不含 `[class$="_card"]`：卡片族另有专门规则，混进来会误伤内容卡。 */
          'body.dts-on :is([role="tooltip"],[role="menu"],[role="listbox"],[role="alertdialog"],'
          + '[class$="_tooltip"],[class$="_popover"],[class$="_dropdown"],[class$="_popup"])'
          + '{' + glass(GLASS_FILL) + '}',

          /* ── J. 宿主弹窗族：**全局兜底**（不限于设置面板内） ─────────────
             ⚠️ 这条不能删：`[role="dialog"]` / `.dsh-agent-dialog` 这些弹窗是
             `createPortal` 挂到 **body** 下的，**不在设置面板的子树里** ——
             上面那条"设置面板内部的叠加层"规则根本够不着它们。
             零自选色 + 只加磨砂，与全局口径一致。
             ⚠️ **必须带 backdrop-filter**：GLASS_FILL 是 transparent，
             只声明透明底色而不给糊，弹窗就整个透掉、背后正文直接穿透上来
             —— 这正是主人截图里「这个对话框要磨砂」的那一面。
             自家控件层 `Modal`（`role="dialog"`）也落在这条里，与宿主弹窗同材质。 */
          'body.dts-on [role="dialog"],'
          + 'body.dts-on [role="alertdialog"],'
          + 'body.dts-on .dsh-agent-dialog,'
          + 'body.dts-on .dsh-agent-modal-card'
          + '{' + glass(GLASS_FILL) + '}',
          /* ★★ 被上面「遮罩子元素」规则误伤的浮层 —— 主人截图实锤：
             「切换『仅工作区』」确认框字和底下混在一起。
             误伤机制（Playwright 逐规则 matches 取证）：`.dsh-agent-dialog` 是
             `.dsh-agent-dialog-scrim` 的**直接子元素**，而 `[class$="-scrim"] > *`
             后缀匹配命中它 → 被刷成 transparent + blur。该规则特异性 (0,3,1) **高于**
             给确认框单独压实的 (0,2,1)，所以"压实底"那条被反压、失效。
             ⚠️ 特异性必须**真的**高于 `body.dts-on [class$="-scrim"] > *`（(0,3,1)）：
             写成 `.dsh-agent-dialog.dsh-agent-dialog`（类名重复）拿到 (0,3,1) + 元素收敛，
             再叠 `[class~="dsh-agent-dialog"]` 属性选择器 → (0,4,1)，稳压。
             ⛔ **不要写 `body.dts-on body.dts-on .dsh-agent-dialog`** —— 那要求两个嵌套
             `<body>`，语法上永不匹配（实测 `matches()` 返回 false，规则静默失效）。
             ⚠️ 用 `background-color` 长名而非 `background` 简写：简写会重置 color。
             ⚠️ 位置必须在下面那条 `> *` 规则**之后**（双保险）。 */
          'body.dts-on .dsh-agent-dialog.dsh-agent-dialog[class~="dsh-agent-dialog"],'
          + 'body.dts-on .dsh-agent-dialog-scrim > .dsh-agent-dialog.dsh-agent-dialog'
          + '{background-color:rgba(16,20,24,.92)!important}',

          /* ── K. 遮罩族：周边壁纸保持原色透感 ─────────────────────────────
             遮罩层对齐设置弹窗（`KHARfa_overlay` 实测全透明无模糊）：模态语义由 32px
             玻璃卡自己表达；灯箱（`-lightbox`）不进此列，暗场是图片查看的语义。
             ⚠️ 去掉遮罩自己的 backdrop-filter 是**必须**的（否则圈死子树取景，见 §I ②）。 */
          'body.dts-on [class$="_backdrop"],body.dts-on [class$="_scrim"],'
          + 'body.dts-on [class$="-backdrop"],body.dts-on [class$="-scrim"]'
          + '{background:transparent!important;backdrop-filter:none!important}',
          /* 浮层面板玻璃卡 —— 与设置弹窗逐参数对齐（实测 `KHARfa_panel`）：
             零自选色 + 宿主 menu-backdrop-filter 大模糊 + 32px 圆角、无描边。
             ⚠️ 大模糊才是"透透的玻璃感"与可读性的来源，不是加黑（主人实测历史：
             「不是那种透透的」）。 */
          'body.dts-on [class$="_backdrop"] > *,body.dts-on [class$="_scrim"] > *{'
          + 'border:none!important;border-radius:32px!important;'
          + 'box-shadow:0 12px 32px rgba(0,0,0,.4);'
          + glass(GLASS_FILL) + '}',
          /* 连字符后缀浮层（`lc-ov-backdrop`「上下文洞察」）同款玻璃卡：下划线后缀匹配
             不中它，卡片曾是 0.15 无模糊的薄纱（实测），文字直接叠壁纸。
             ⚠️ 核心声明必须 `!important`：`lc-ov-card` 自带 background/border/radius
             声明且选择器特异性更高，不加会被压回 0.15 无模糊薄纱（实测）。 */
          'body.dts-on [class$="-backdrop"] > *,body.dts-on [class$="-scrim"] > *{'
          + 'border:none!important;border-radius:32px!important;'
          + 'box-shadow:0 12px 32px rgba(0,0,0,.4);'
          + glass(GLASS_FILL) + '}',

          /* ── L. 徽章 / 反相 chip / 原生下拉弹层 ──────────────────────────
             构建版本徽章的底色是 `var(--dsw-alias-label-primary)`（SidebarRoot 里
             "主文字色做底、反相色写字"的徽章设计），白字主题下就是 logo 下那块纯白小斑。
             `label-primary` 是文字主色、不能玻璃化，这里单独给徽章换成已玻璃化的按钮面。 */
          '[class*="buildVersion"]{background:var(--dsw-alias-button-elevated-fill,rgba(16,20,24,.15))!important}',
          /* HARNESS 白斑（主人要它透明）：品牌 / 版本 / mark 族一律清零。
             只锚**角色名后缀**（badge / Badge / version / mark），不锚会随构建变的哈希前缀。
             ⚠️ 实测（独立 web 实例）：这一族在 web profile 里命中 0 —— 桌面壳的品牌区不在 web 里，
             这条是给桌面壳留的；若仍见白斑，用 F12 取真实类名再收窄。
             ⚠️ 本行**不能以 `+` 开头**：前面是数组元素的 `,`，写成 `+ 'x'` 会被解析成**一元加号**
             （`+'str'` = NaN）→ 产物出现 `"NaNbody…"`、整条规则作废（踩过一次）。 */
          /* ★ HARNESS 徽章底板（主人第二十九轮从 DevTools 给出真身）：
             它是 `BrandWordmark` SVG 里的一个 `<rect x="129.348" y="5.5" width="52" height="14" rx="2"
             fill="currentColor">`，紧邻 `<g clip-path="url(#dsh-wordmark-badge-clip)">`。
             因为 `fill="currentColor"`，它在白字主题下就随文字变白 ⇒ 一块白斑。
             用 `:has(+ …)` 精准锚'紧邻 badge-clip 组的那块 rect'，只清它的填充，
             不动鲸鱼与 wordmark 文字（它们同样是 currentColor，但那是**该**跟文字的）。 */
          /* ⚠️ **只清底板，别碰文字**：上面那条一度把 `g[clip-path*="badge"] *` 也清了，
             结果 HARNESS 的**字**跟着一起透明 —— 主人反馈"完全看不清了"。
             底板是那个 `<rect fill="currentColor">`；文字在 badge-clip 组里的 path，
             它要保持 `currentColor`，这样白字主题下就和旁边的 `deepseek` **同一个风格**。 */
          'body.dts-on svg rect:has(+ g[clip-path*="badge"])'
          + '{fill:transparent!important}',
          /* ★ 底板透明后**文字必须跟着换成同色系**：实测 HARNESS 的 7 条 path 是**硬编码深灰**
             `rgb(53,54,56)` —— 官方设计是"白底 + 深灰字"，我把白底拿走，深灰字压在深色壁纸上
             就完全看不见了（主人反馈"完全看不清了"）。
             主人要求：**弄成和旁边 deepseek 一样的风格白字**。旁边那些 path 的 computed fill
             是 `rgb(255,255,255)`、来自 `currentColor`，所以这里也用 `currentColor`
             —— 这样亮/暗主题各自跟随文字色，与 wordmark 永远同色系。 */
          'body.dts-on svg g[clip-path*="badge"] path,'
          + 'body.dts-on svg g[clip-path*="badge"] *'
          + '{fill:currentColor!important}',
          'body.dts-on [class*="badge"],body.dts-on [class*="Badge"],'
          + 'body.dts-on [class*="version"],body.dts-on [class*="Version"],'
          + 'body.dts-on [class*="logoMark"],body.dts-on [class*="brandMark"],'
          + 'body.dts-on [class*="brand-mark"],body.dts-on [class*="wordmark"],'
          + 'body.dts-on [class*="harnessBadge"],body.dts-on [class*="productBadge"],'
          + 'body.dts-on [class*="badge"] *,body.dts-on [class*="Badge"] *,'
          + 'body.dts-on [class*="wordmark"] *,body.dts-on [class*="harnessBadge"] *,'
          + 'body.dts-on [class*="productBadge"] *'
          + '{background:transparent!important;border-color:transparent!important;box-shadow:none!important}',
          /* 反相实底标签（`_tag_[data-tone="solid"]`）：宿主设计拿 label-primary 做底、
             bg 做字，白字主题下 = 纯白 chip + 半透明深字，又刺眼又看不清。
             ⚠️ 这里**不能用 GLASS_FILL** —— 它是 transparent，这个 chip 就成了"白字浮在
             透明底上"，遇到亮壁纸直接读不出字。小色块是**压字**的实底件，不是玻璃面：
             给它自己那条玻璃化令牌（`--dsw-alias-button-elevated-fill` 已被玻璃重铸覆盖为
             半透明深色），拿不到时退回半透明深色兜底 —— 无论如何不能是 transparent。 */
          'body.dts-on [class*="_tag_"][data-tone="solid"]{'
          + 'background:var(--dsw-alias-button-elevated-fill,rgba(16,18,22,.82))!important;'
          + 'color:var(--dsw-alias-label-primary)!important;'
          + 'backdrop-filter:' + GLASS_BLUR + '!important}',
          /* 原生 <select> 弹层：系统弹层吃不到毛玻璃（无 backdrop-filter），用深色实底
             贴近主题消除突兀（主人实测「选项这里没同步」）；选中项品牌色压掉系统蓝高亮。
             `option` 的 background/color 是 Chromium 桌面对原生弹层仅有的几个可样式化
             入口，这里必须用不透明色（半透明会被弹层忽略）。
             `color-scheme` 是系统弹层唯一可靠的外观开关 —— 即便页面跑旧样式，
             弹层也一并变深色实底，不再透出后面的字。 */
          'select{color-scheme:dark}',
          'select option{background:#16181d;color:var(--dsw-alias-label-primary)}',
          'select option:hover{background:#263148}',
          'select option:checked{background:var(--dsw-alias-brand-primary);'
          + 'color:var(--dsw-alias-label-primary-foreground)}',

          /* ★ 玻璃令牌的**定义处**（全插件唯一真源）——
             全部读它，**只做磨砂、零自选色、零压暗**。
             挂在 :root 上而不是 body 上：模态可能被 portal 到 body 外层，读不到
             body 作用域的变量。宿主自己的令牌一律不碰，只用我们自己的 --dts-* 命名。
             · --dts-glass-fill      transparent —— 零自选色（颜色全来自壁纸）
             · --dts-glass-fill-thin 浅底 —— 只给**没有 backdrop-filter** 的小件用
               （密集小输入 98 个，挂 blur 会合成层爆炸；无糊 + transparent = 消失）
               ⚠️ 它是全局唯一还带自选色的玻璃令牌，是**无奈的技术例外**（见该处注释）
             · --dts-glass-blur      转发 --dsw-menu-backdrop-filter，带兜底链（**必须声明在 body 上**，见下方说明） */
          ':root{--dts-glass-fill:transparent;'
          + '--dts-glass-fill-thin:rgba(16,20,24,.28)}',
          /* ★★★ `--dts-glass-blur` **必须声明在 `body` 上，不能挂在 `:root`**。
             自定义属性的 `var()` 是在**声明它的那个元素**上求值的；而官方的 `--dsw-menu-backdrop-filter`
             发在 **body** 上（证据：ui-theme 的 design-platform.css 就是 `body { --dsw-alias-bg-base: … }`）。
             挂在 `:root` 上时该元素上它未定义 ⇒ **直接吃 fallback**；子元素继承到的是**已算完**的固定值，
             不会重新求值。实测后果（主人问「这些功能是虚的吗」时抓到）：全页 **15 个**带 backdrop-filter 的
             元素（官方设置面板 / MenuSurface 材质层 / 我们自绘表面）模糊恒为 fallback 那个固定值（blur+饱和度写死在兜底链里，与滑块无关）；
             拖「面板模糊 / 面板饱和」滑块时 `--dsw-menu-backdrop-filter` 明明在变（模糊 0 → 60），
             **渲染值一个都不动**。判据：改滑块后读 `body` 上的 `--dts-glass-blur`，期望它跟着变。 */
          'body{--dts-glass-blur:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%))}',

          '@media (max-width:720px){.dts-row{flex-direction:column;align-items:stretch;gap:8px}'
          + '.dts-row-control{justify-content:flex-start}.dts-token-row,.dts-token-row.dts-profile-row{grid-template-columns:1fr}}',

          // 动效降级：系统声明"减少动态效果"时，自有表面的过渡与入场动画全部归零。
          // 视频背景的停播由 boot 脚本按同一媒体查询处理（见 index.js bootVideoScript）。
          '@media (prefers-reduced-motion: reduce){'
          + '.dts-page *,.dts-suggest,.dts-layer'
          + '{transition-duration:0s!important;animation-duration:0s!important}}',
          /* ★ 系统「降低透明度」：收回**全部**毛玻璃、表面改回实底。
             官方 `ui-layout` 用 `@media (prefers-reduced-transparency:reduce)` 改具体元素的 background；
             本插件**不走媒体查询**，改由 `app.ts` 监听 matchMedia 往 body 挂 `dts-reduced-transparency` 类
             —— 理由见下条注释：测试的扁平解析器不区分媒体上下文，重声明同批选择器会让静态探针失去判据；
             换成**新的选择器前缀**（`body.dts-on.dts-reduced-transparency`）既不与之冲突、又表达同一语义。
             令牌层那一半由 `app.ts` 把 `--dsw-menu-backdrop-filter` 重铸成 `none`。 */
          'body.dts-on.dts-reduced-transparency,body.dts-on.dts-reduced-transparency *{'
          + 'backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
          /* ⚠️ 这里**不**覆盖 `--dts-glass-fill` —— 那条令牌只许有**一处**定义（测试有锁：
             "真源只许有一处定义，多一处就是又分叉了"），在 reduce 分支再写一次就是分叉。
             收回毛玻璃只需清 `backdrop-filter`：底色本来就是 `transparent`（零自选色），
             清掉模糊后壁纸直接清晰可见、表面不再雾化。
             （官方在 darwin 侧栏额外把背景抬到 `color-mix(… 90%, transparent)` 以求可读；
              本插件不这么做 —— 那要重声明同一批选择器，会破坏静态探针判据。此处如实标注。） */
          /* ⚠️ 官方还处理了 `prefers-reduced-transparency: reduce`（`ui-layout` 用它
             "收回毛玻璃侧栏"）。本插件**本轮未实现**：在 CHROME_CSS 里重声明同一批选择器
             （哪怕包在 @media 里）会让"每个选择器只有一条规则"的静态探针失去判据
             （测试用的是扁平解析器，不区分媒体上下文）；正确做法是在**令牌层**
             表达（`ctx.theme.overrideTokens` 里按 matchMedia 结果切换填充/模糊令牌），
             列入下一轮。本行是**如实标注**，不是实现。 */
        ].join('\n');
