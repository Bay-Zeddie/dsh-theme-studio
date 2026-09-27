// src/client/identity.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。

        /* ============================================================ */
        /* 标识                                                          */
        /* ============================================================ */

        export var PLUGIN_ID = 'dsh-theme-studio';
        export var TOKEN_SOURCE = 'dsh-theme-studio';
        export var LAYER_ID = 'dts-backdrop';
        export var STYLE_ID = 'dts-layer-style';
        export var CHROME_STYLE_ID = 'dts-chrome-style';
        export var MODAL_HOST_ID = 'dts-modal-host';
        export var DEFAULT_PREFIX = '/dsh-theme-studio';
        /**
         * 玻璃表面兜底清单：Host 的 glassSurfaces 是权威源，但随宿主启动装载（桌面端 / CLI 同一装载路径，改它要重启）。
         * 刷新即生效：新会话条（button-elevated-fill）与聊天气泡（specific-bubble）。
         *
         * ⚠️ 口径是"**别名层 + 两个点名放行的调色板基元**"。原先这里有
         * `--dsw-static-neutral-50` / `-100`，阶段 C/D 删除过一轮；**本轮（2026-09-27）
         * 按改造前副本恢复并补上解释** —— 这两个基元是宿主 ui-deliverables /
         * ui-schedule 四张"白面卡"的填充源，宿主 CSS Modules 在**卡片元素自身上**
         * 声明 `--changes-fill:var(--dsw-static-neutral-50)` 之类，**元素自身的声明
         * 永远压过从 `body` 继承的值**（宿主 Presenter 把令牌写成 body 行内样式）
         * ⇒ 只有沿 `var()` 链改基元才重铸得到那四张白面；**把局部变量塞进清单是空操作**。
         * 逐字实测的爆炸半径与四处同改要求见 `lib/engine.js` 的 `GLASS_SURFACES` 注释。
         *
         * 闸口只有一个：`isGlassSurfaceAllowed()`。清单、`app.ts` 的投影过滤、
         * `composeGlass()` 的运行时闸三处都调它，避免"改了清单却被某个闸静默挡掉"。
         */
        export var EXTRA_GLASS_SURFACES = [
          '--dsw-alias-button-elevated-fill',
          '--dsw-specific-bubble',
          '--dsw-specific-bubble-highlight',
          // 设置弹窗族：选择器/步进器/主题卡走 bg-module-platform，导航选中与
          // 悬停走 sidebar-nav-item-active/-hover（实测归因），都是浅白硬基准。
          '--dsw-alias-bg-module-platform',
          '--dsw-specific-sidebar-nav-item-active',
          '--dsw-specific-sidebar-nav-item-hover',
          // 会话结束产出卡（ui-deliverables）的卡头/文件行、工作区计划卡与日程卡的
          // 白面：局部 `--changes-fill`/`--deliverable-fill`/`--plan-card-fill`/
          // `--card-fill` 四种填充的源头都是这两个调色板基元（亮色分支；暗色走 850/800）。
          // 未玻璃化时的实测后果：白字主题下卡头/文件行 #fafafa 白底白字，
          // 两个 40×40 图标砖（`_cardIcon`/`_leading`）白底白图标。
          '--dsw-static-neutral-50',
          '--dsw-static-neutral-100',
          // hover / active / 页签等"小色块"：底色令牌（floating-hover、markdown-tag）
          // 缺席玻璃重铸时就是不透明白 #f1f3f5 —— 白字主题下白底白字（实测：
          // 「新会话」悬停、TabHost「文件」活动页签两处同根）。一并纳入。
          '--dsw-alias-button-floating-hover',
          '--dsw-alias-interactive-bg-hover',
          '--dsw-alias-interactive-bg-active',
          '--dsw-alias-button-tool-bar-fill',
          '--dsw-alias-button-tool-bar-hover',
          '--dsw-alias-markdown-tag',
          '--dsw-specific-menu',
          // hover/active 的 solid（不透明）变体：悬停高亮与「加载更早」按钮的白底
          // 就是它（#f1f3f5 实测），非 solid 版已玻璃化但 solid 版漏网（实测）。
          '--dsw-alias-interactive-bg-hover-solid',
          '--dsw-alias-button-ghost-active-fill',
        ];
        /**
         * 玻璃清单的**唯一闸口**：哪些名字允许被玻璃重铸。
         *
         * 规则：别名层（`--dsw-alias-*` / `--dsw-specific-*`）与其它一切名字放行；
         * `--dsw-static-*` 调色板**大族**一律挡住（它们是"色"的定义处，绝大多数
         * 只该由宿主自己管），**只点名放行两个例外**：
         * `--dsw-static-neutral-50` / `-100` —— 宿主四张"白面卡"的填充源。
         *
         * 为什么必须是白名单而不是"前缀全挡"：那两个基元是局部变量
         * （`--changes-fill` 等）的 `var()` 上游，**只有改基元才重铸得到白面**
         * （局部变量在卡片元素自身上声明，压过从 body 继承的值）。
         *
         * 为什么要集中成一处：清单（`engine.js` / `EXTRA_GLASS_SURFACES`）、
         * `app.ts` 对宿主投影的过滤、`composeGlass()` 的运行时闸都要用同一个判据 ——
         * 分开写三份的话，改了一处会被另一处**静默**挡掉（实测踩过）。
         * @param name - 令牌名。
         * @returns 是否允许进玻璃重铸。
         */
        export var GLASS_PRIMITIVE_ALLOW = ['--dsw-static-neutral-50', '--dsw-static-neutral-100'];
        export function isGlassSurfaceAllowed(name: string): boolean {
          if (typeof name !== 'string' || name === '') return false;
          if (name.indexOf('--dsw-static-') !== 0) return true;
          return GLASS_PRIMITIVE_ALLOW.indexOf(name) !== -1;
        }
        /**
         * 承载文字的"小色块"（hover/active 反馈、页签、工具条、菜单）：
         * 面积小但直接压字，普通表面的薄玻璃在亮壁纸上读不清 —— 玻璃浓度
         * 拉到可读档（≥0.55），其余表面仍跟随用户调的面板透明度。
         * @returns {number} 可读档浓度下限；0 = 普通表面
         */
        export function readableGlassFloor(name) {
          if (name.indexOf('hover') !== -1 || name.indexOf('active') !== -1
            || name.indexOf('tool-bar') !== -1 || name.indexOf('markdown-tag') !== -1
            || name === '--dsw-specific-menu') return 0.55;
          return 0;
        }
        export var COMMIT_DEBOUNCE_MS = 220;
        export var TAB_STORAGE_KEY = 'dts:active-tab';

