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
        export var FAB_ID = 'dts-fab';
        export var MODAL_HOST_ID = 'dts-modal-host';
        export var DEFAULT_PREFIX = '/dsh-theme-studio';
        /**
         * 玻璃表面兜底清单：Host 的 glassSurfaces 是权威源，但随 dsh web 启动装载
         * （改它要重启）。这几位"有底不好"的高频表面在浏览器半自带一份补集，
         * 刷新即生效：新会话条（button-elevated-fill）与聊天气泡（specific-bubble）。
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
          // 会话结束产出卡（ui-deliverables）：卡头/文件行的白面走局部
          // --changes-fill/--deliverable-fill，源头是设计常量 static-neutral-50/100。
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

