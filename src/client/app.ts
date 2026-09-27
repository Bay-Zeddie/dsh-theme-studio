// src/client/app.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { clamp, contrastRatio, hslToHex, rgbToHsl } from '../../lib/color-core.js'
import { createApi } from './api.ts'
import { installCaptionMenu } from './caption-menu.ts'
import { CHROME_CSS, exitFullscreen, fullscreenElement, requestFullscreen } from './chrome.ts'
import { Modal, SegmentedTabs, Toast, createPortal } from './controls/index.ts'
import { e, useEffect, useState } from './deps.ts'
import { LOCALE_NS, MESSAGES, currentLang, getLocaleService, registerLocaleDictionary, setLocaleService, subscribeLocaleChanges, t } from './i18n.ts'
import { CHROME_STYLE_ID, COMMIT_DEBOUNCE_MS, DEFAULT_PREFIX, EXTRA_GLASS_SURFACES, LAYER_ID, MODAL_HOST_ID, PLUGIN_ID, STYLE_ID, TAB_STORAGE_KEY, TOKEN_SOURCE, isGlassSurfaceAllowed } from './identity.ts'
import { OverlaySurface, createLayerManager, createNotices, createOverlayEffects, upsertStyle } from './layer.ts'
import { uiButton, uiStateDot, uiTooltip } from './primitives.ts'
import { composeGlass, createTokenProbe, fillTokenPairs, fixDiffFamily, fixTextFamily, setLiveScheme } from './probe-glass.ts'
import { createStore, useSlice } from './store.ts'
import { AdvancedTab, BackdropTab, ColorTab, ConfirmDialog, LibraryTab, PresetTab, ProfileTab, ShapeTab, Svg, TypeTab } from './tabs.ts'
import { humanBytes, mediaLookup, readLocal, writeLocal } from './utils.ts'

        /* ============================================================ */
        /* 共用组件树：设置页与模态各渲染一次，只靠 data-variant 分版面      */
        /* ============================================================ */

        export var TABS = [
          { id: 'presets', key: 'tab.presets', view: PresetTab },
          { id: 'profile', key: 'tab.profile', view: ProfileTab },
          { id: 'backdrop', key: 'tab.backdrop', view: BackdropTab },
          { id: 'library', key: 'tab.library', view: LibraryTab },
          { id: 'color', key: 'tab.color', view: ColorTab },
          { id: 'type', key: 'tab.type', view: TypeTab },
          { id: 'shape', key: 'tab.shape', view: ShapeTab },
          { id: 'advanced', key: 'tab.advanced', view: AdvancedTab },
        ];

        /** 页签的 DOM id 对（`SegmentedTabs` 契约要求每个 item 带唯一 id 与它控制的 panelId）。 */
        function tabDomIds(id) {
          return { id: 'dts-tab-' + id, panelId: 'dts-tabpanel-' + id };
        }

        /** 官方 `IconCloseOutlineRegular` 的路径（16 viewBox / 1px 描边）。 */
        function CloseGlyph() {
          return e('svg', {
            width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none',
            xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true', strokeWidth: 1,
          },
            e('path', { d: 'M2.5 2.5L13.5 13.5', stroke: 'currentColor', key: 'a' }),
            e('path', { d: 'M13.5 2.5L2.5 13.5', stroke: 'currentColor', key: 'b' }))
        }

        /**
         * 面板主体。**两条路径共用同一棵"内容列"**，区别只在外面套什么：
         *
         *   · 主路径（注进 `settings.section`）：宿主已经给了 overlay + mask + 800px panel
         *     + 188px 导航列 + **唯一滚动容器**（`settings-general/lib/client.js:60` 的
         *     `.y7bFDa_overlay/.mask/.panel/.nav/.content/.options`，`SettingsPanel` 把我们
         *     渲染进 `.options`，见 `:333`）。所以我们**只渲染内容列**：
         *       ✗ 不画遮罩、不画卡片、不画导航列、不自带滚动容器
         *         —— 再画一层就是双层遮罩 + 双层卡片（第 1 步专门核验过这一点）。
         *     ✅ 内容列形状对齐官方 `PluginsSettingsSection`（`ui-settings-plugins/lib/client.js:11`）：
         *        页面根 `max-width:760px; flex-direction:column; gap:12px`
         *        + `h2 18/600` + 引言 `13/--dsw-alias-label-tertiary` + 页签 + 面板。
         *   · 兜底模态路径（宿主没把条目收进 ledger）：宿主什么都没给，用自写控件层的
         *     `Modal` 自己当那个设置面板（几何见 chrome.ts 的 `.dts-modal-*` 段落）。
         */
        export function ThemeStudioApp(props) {
          var env = props.env, tt = props.t;
          var state = useSlice(env.engine);
          var isModal = typeof props.onRequestClose === 'function';
          var tabState = useState(readLocal(TAB_STORAGE_KEY) || 'presets');
          var active = TABS.some(function (item) { return item.id === tabState[0] }) ? tabState[0] : 'presets';
          var Current = TABS.find(function (item) { return item.id === active }).view;
          var statusLabel = state.status === 'saving' ? tt('common.saving')
            : state.status === 'error' ? (state.error || tt('common.failed'))
              : state.status === 'ready' ? tt('common.saved') : '…';
          // 状态点与文字同源；读屏只念文字，点保持装饰性。
          var statusDot = state.status === 'saving' ? 'ongoing'
            : state.status === 'error' ? 'error'
              : state.status === 'ready' ? 'done' : 'idle';
          function chooseTab(id) {
            tabState[1](id);
            writeLocal(TAB_STORAGE_KEY, id);
          }

          /* 页签交给自写控件层的 `SegmentedTabs`（官方 primitives 的等宽分段页签）：
             ←→ 环绕 + Home/End 移动焦点并选中、roving tabindex（只有选中项是 tab 停点）、
             滑动指示条。原实现自绘 `.dts-tabs/.dts-tab` + 手写 `onTabKey`（manual activation）
             整段删除 —— 官方契约由控件自带，且自动激活（箭头即选中）才是官方 SegmentedTabs 的语义。 */
          var items = TABS.map(function (item) {
            var dom = tabDomIds(item.id);
            return { value: item.id, label: tt(item.key), id: dom.id, panelId: dom.panelId };
          });
          var panelDom = tabDomIds(active);

          var content = e('div', { className: 'dts-page', 'data-variant': isModal ? 'modal' : 'page' },
            e('div', { className: 'dts-page-head' },
              e('div', { className: 'dts-page-text' },
                e('h2', { className: 'dts-page-title' }, Svg(), tt('section.title')),
                e('p', { className: 'dts-page-intro' }, tt('section.intro'))),
              e('div', { className: 'dts-page-actions' },
                uiButton({ variant: 'ghost', onClick: function () { env.askReset() }, children: tt('common.reset') }),
                e('span', { className: 'dts-status', 'data-state': state.status === 'error' ? 'error' : 'idle' },
                  uiStateDot({ state: statusDot }), statusLabel))),

            e(SegmentedTabs, {
              items: items,
              value: active,
              onChange: chooseTab,
              label: tt('section.title'),
              className: 'dts-page-tabs',
            }),

            state.status === 'error' && state.doc === null
              ? e('p', { className: 'dts-note', 'data-tone': 'error' }, state.error || tt('common.failed'))
              : null,

            state.doc
              ? e('div', {
                className: 'dts-body', role: 'tabpanel', key: active, tabIndex: -1,
                id: panelDom.panelId, 'aria-labelledby': panelDom.id,
              }, e(Current, { env: env, t: tt, doc: state.doc }))
              : null,

            state.dialog
              ? e(ConfirmDialog, {
                title: state.dialog.title,
                lines: state.dialog.lines,
                confirmLabel: state.dialog.confirmLabel,
                cancelLabel: state.dialog.cancelLabel,
                tone: state.dialog.tone,
                onDone: function (answer) { env.answerDialog(answer) },
              })
              : null);

          if (!isModal) return content;
          /* 兜底模态：宿主没把条目收进 `settings.section` ledger（或那个槽不存在）时，
             「通用设置」一行上的按钮走这里。`Modal` 提供官方模态语义
             （portal 到 body / `role=dialog` + `aria-modal` / 遮罩点击即关 /
             Escape 只归最顶层 / Tab 焦点陷阱 / 关闭归还焦点），
             几何由 `.dts-modal-panel` 逐值对齐官方 `SettingsPanel`。 */
          return e(Modal, {
            open: true,
            title: tt('section.title'),
            closeLabel: tt('common.close'),
            headless: true,
            className: 'dts-modal-panel',
            onClose: function () { props.onRequestClose() },
          },
            e('div', { className: 'dts-modal-head', key: 'head' },
              e('button', {
                type: 'button', className: 'dts-modal-close', key: 'close',
                'aria-label': tt('common.close'), title: tt('common.close'),
                onClick: function () { props.onRequestClose() },
              }, e(CloseGlyph, null))),
            e('div', { className: 'dts-modal-options', key: 'options' }, content));
        }

        /** 语言变化后设置页条目要用新文案重新注册，这里给一个不依赖 slot 的兜底行。 */
        export function ThemeStudioGeneralRow(props) {
          var env = props.env, tt = props.t;
          return e('div', { className: 'dts-row' },
            e('label', null, tt('section.title')),
            uiButton({ variant: 'ghost', onClick: function () { env.openModal() }, children: tt('common.openPanel') }))
        }

        /**
         * 同源路由前缀白名单：只收 `/xxx/yyy` 这种同源绝对路径。
         * `//attacker` 与 `http://…` 会被拼进 fetch / EventSource / 导出链接 ——
         * 一旦前缀被污染，`x-dts-key` 就跟着发到异源去。值来自自家 Host，但不
         * 假设它永远干净：形态不合就整个退回默认前缀（仍指向本插件的路由）。
         */
        function safePrefix(value) {
          return typeof value === 'string' && /^\/(?!\/)[A-Za-z0-9_\-/]*$/.test(value)
            ? value.replace(/\/+$/, '')
            : '';
        }

        /* ============================================================ */
        /* 装配：状态机、DOM 落地、入口注册                                 */
        /* ============================================================ */

        /**
         * Cordis 入口。
         * @param {import('@deepseek-ai/cordis').Context} ctx
         */
        export function apply(ctx) {
          /* ★ 系统「降低透明度」状态：matchMedia 监听（`ctx.effect` 收口），
             命中时给 body 挂 `dts-reduced-transparency`（CSS 半见 chrome.ts），
             并把 `--dsw-menu-backdrop-filter` 重铸成 none（令牌半见 accept()）。
             之所以不用 CSS 媒体查询：测试的扁平解析器不区分媒体上下文，
             重声明同批选择器会让静态探针失去判据。 */
          var reduceTransparency = false;
          try {
            var mqReduce = window.matchMedia('(prefers-reduced-transparency: reduce)');
            reduceTransparency = mqReduce.matches === true;
            ctx.effect(function () {
              var onChange = function (event) {
                reduceTransparency = event.matches === true;
                try {
                  if (reduceTransparency) document.body.classList.add('dts-reduced-transparency');
                  else document.body.classList.remove('dts-reduced-transparency');
                } catch (err) { /* body 尚不可用 */ }
              };
              mqReduce.addEventListener('change', onChange);
              return function () { mqReduce.removeEventListener('change', onChange) };
            }, 'theme-studio: reduced transparency');
          } catch (err) { /* 老引擎没有 matchMedia → 保持默认（不降级） */ }
          var boot = window.__DTS_BOOT__ || {};
          var prefix = safePrefix(boot.prefix) || DEFAULT_PREFIX;
          var writeToken = typeof boot.writeToken === 'string' ? boot.writeToken : '';
          /* 令牌基准值探测：**官方服务优先**（`ctx.theme.getTheme()`），样式表扫描兜底。
             ⚠️ 传的是 getter 而不是句柄：`ctx.theme` 可能在本插件 apply 之后才挂载，
             现取才拿得到；服务缺席时探针自己回退（`probe.source()` 可查走的是哪条路）。 */
          var probe = createTokenProbe({ theme: function () { return ctx.theme } });
          var layer = createLayerManager();
          var commitTimer = 0;
          var lastAppliedRevision = -1;
          var dialogAnswer = null;
          var styles = [];
          /** `shell.overlay` 注册的 disposer（`registerOverlaySurface` 里赋值）。 */
          var overlayDisposer = null;
          /** 浮层宿主容器的状态源（提示/模态/全屏键都 `createPortal` 进它）。 */
          var overlayEffects = createOverlayEffects();
          /** 一次性提示的状态源（`notify()` 写、`NoticeViewport` 渲染）。 */
          var notices = createNotices();
          /** 换语言后让**不在 slot 树里**的那几件（全屏键文案）重渲染一次。 */
          var langRevision = createStore({ revision: 0 });
          /**
           * 在飞提交的本地草稿（乐观值 + 乐观锁基准）。
           *
           * ⚠️ 注释更正（本轮）：它曾经被写成"跨组件重建保留的未保存草稿 —— 换语言时
           * 重新注册会卸载并重建组件，草稿只活在组件里就会跟着丢"。那只是它**顺带**
           * 起到的作用；换语言重注册这条链已经删掉了（label thunk + locale），
           * 而它本身**是提交管线的核心状态**，删不得：
           *   · `patch()` 写入草稿并把 status 置为 saving；
           *   · `commit()` 只提交草稿，成功后才按 `draft === inflight` 收口；
           *   · 409/401/403 时按"草稿是不是被打回的那一版"分流（新草稿不作废、
           *     只换基准重发），暂态失败时草稿保留并指数退避重试；
           *   · `accept()` 在投影到达时用它保证"用户正在改的值不被服务端旧值盖掉"。
           */
          var draft = null;
          /**
           * locale 是可选依赖（不声明进 exports.inject）：接上模块级句柄，取不到就走降级链。
           * 顺带把 ctx 交给 i18n —— 服务若在本插件 apply 之后才挂载，它还能按需重取一次。
           */
          var localeAtBoot = null;
          try {
            localeAtBoot = typeof ctx.get === 'function'
              ? ctx.get('locale') ?? null
              : ctx.locale ?? null;
          } catch (err) {
            // ctx.get 对未挂载的服务可能直接抛：locale 缺席不该让整个插件不加载。
            localeAtBoot = null;
          }
          setLocaleService(localeAtBoot, ctx);

          var engine = createStore({
            status: 'loading',
            error: '',
            doc: null,
            media: {},
            css: '',
            revision: 0,
            presets: [],
            gradients: {},
            tokenGroups: [],
            glassSurfaces: [],
            layerAvailable: false,
            dialog: null,
          });

          var api = createApi(function () { return prefix }, function () { return writeToken });

          /** 在飞提交的中止句柄，**按代次登记**（Map），不是一个可被覆盖的槽。
           *  单槽的坏处：并发两次提交时后一个覆盖前一个，而前一个的成功回调无条件
           *  `commitAbort = null`，会连带丢掉更新那次的句柄 —— 于是 acceptRemote
           *  调 cancelPendingCommit() 时已无东西可 abort，旧草稿的 PUT 仍会落到
           *  服务端，把刚载入的文档盖回去（epoch 只能作废客户端响应，作废不了
           *  服务端写入）。 */
          var commitControllers = new Map();
          var commitEpoch = 0;
          /**
           * 卸载门闩：teardown 之后到达的在飞响应回调一律作废。
           * 没有它，dispose 瞬间的 getState/saveDoc/upload 的 `.then(accept)` 会在
           * 清场之后执行 —— 样式标签、背景层、令牌层又被重新长回来（僵尸主题）。
           */
          var disposed = false;

          function cancelPendingCommit() {
            commitEpoch += 1;
            window.clearTimeout(commitTimer);
            commitControllers.forEach(function (controller) {
              try { controller.abort() } catch (err) { /* 已结束 */ }
            });
            commitControllers.clear();
          }

          function liveSchemeNow() {
            return document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
          }

          function mediaUrl(item) {
            return prefix + '/media/' + encodeURIComponent(item.id) + '/' + encodeURIComponent(item.name || '')
          }

          /* ---------------- 落地 ---------------- */

          /**
           * 把一份投影落到界面：样式 → 令牌 → theme 服务 → 背景层。
           * 顺序有讲究：写完令牌层才会触发 theme/change，由 Presenter 落 inline 变量。
           * 用户正在改（draft 在飞）时继续显示草稿，样式与令牌仍来自服务端投影。
           */
          function accept(projection) {
            if (disposed) return;
            if (!projection || !projection.doc) return;
            prefix = safePrefix(projection.prefix) || prefix;
            if (typeof projection.writeToken === 'string' && projection.writeToken !== '') writeToken = projection.writeToken;
            var doc = projection.doc;
            var pairs = fillTokenPairs(projection.tokenLayers || {}, probe);
            // Host 的 glassSurfaces 是权威源但随宿主启动装载（桌面端 / CLI 同一路径）——
            // 浏览器半自带高频表面兜底（新会话条/聊天气泡），刷新即透明，不等重启。
            // ⚠️ 表面筛选的**唯一判据**是 `isGlassSurfaceAllowed()`（identity.ts）：
            // 别名层放行，`--dsw-static-*` 大族挡住、只放行 `neutral-50/100` 两个
            // 点名例外（宿主四张"白面卡"的填充源；理由见 engine.js 的 GLASS_SURFACES）。
            // 这份过滤是**第二道**，与 `engine.js` 的清单、`composeGlass()` 的运行时闸
            // 共用同一个判据 —— 分开写三份的话，改了一处会被另一处静默挡掉（实测踩过）。
            var surfaces = (projection.glassSurfaces || []).filter(function (name) {
              return isGlassSurfaceAllowed(name);
            });
            EXTRA_GLASS_SURFACES.forEach(function (name) {
              if (!isGlassSurfaceAllowed(name)) return;
              if (surfaces.indexOf(name) === -1) surfaces.push(name);
            });
            var glass = composeGlass(surfaces, doc, probe, doc.palette.tokens || {});
            var merged = Object.assign({}, glass, pairs);
            /* 系统「降低透明度」：把浮层模糊令牌也置 none（CSS 那一半在 chrome.ts 的
               `body.dts-on.dts-reduced-transparency` 规则里；两半必须同时在场）。 */
            if (reduceTransparency) merged['--dsw-menu-backdrop-filter'] = { light: 'none', dark: 'none' };
            // 次级文字对比自愈：白字主题下默认暗灰的次级文字在深玻璃上不可读。
            fixTextFamily(merged, doc.palette.tokens || {}, probe);
            // diff 语义色方向矫正：白字主题下浅绿/浅粉 diff 块翻深色版。
            fixDiffFamily(merged, doc.palette.tokens || {}, probe);

            var styleEl = upsertStyle(STYLE_ID, projection.css || '');
            if (styles.indexOf(styleEl) === -1) styles.push(styleEl);

            if (ctx.theme && typeof ctx.theme.overrideTokens === 'function') ctx.theme.overrideTokens(TOKEN_SOURCE, merged);
            if (ctx.theme && typeof ctx.theme.setTheme === 'function') {
              try { ctx.theme.setTheme(doc.base.scheme) } catch (err) { /* 注册表未就绪，theme/change 会再来一次 */ }
            }
            if (ctx.theme && typeof ctx.theme.setFontSize === 'function') {
              try { ctx.theme.setFontSize(doc.base.fontSize) } catch (err) { /* 同上 */ }
            }
            setLiveScheme(liveSchemeNow());
            layer.sync(doc, prefix, projection.media || {});
            engine.update({
              status: 'ready',
              error: '',
              doc: draft === null ? doc : draft.doc,
              media: projection.media || {},
              css: projection.css || '',
              revision: projection.revision,
              presets: projection.presets || engine.get().presets,
              gradients: projection.gradients || engine.get().gradients,
              tokenGroups: projection.tokenGroups || engine.get().tokenGroups,
              glassSurfaces: projection.glassSurfaces || engine.get().glassSurfaces,
              layerAvailable: doc.backdrop.mode !== 'none',
            });
            lastAppliedRevision = projection.revision;
          }

          /**
           * 整份文档替换（预设/载入方案/导入/重置）的唯一入口：先作废本地草稿
           * 与在飞提交。直接调 accept 的话，~220ms 后 commit 会把旧草稿
           * PUT 回服务端，刚载入的主题被打回原形（实测）。
           */
          function acceptRemote(projection: any) {
            cancelPendingCommit();
            draft = null;
            accept(projection);
          }

          function patch(mutate: any, options?: any) {
            var current = engine.get().doc;
            if (current === null) return;
            var next = JSON.parse(JSON.stringify(current));
            mutate(next);
            // baseRevision = 本次编辑的服务端基准：提交时当乐观锁用（409 才有意义）。
            draft = { doc: next, baseRevision: engine.get().revision };
            engine.update({ doc: next, status: 'saving' });
            scheduleCommit(options);
          }

          function scheduleCommit(options?: any) {
            window.clearTimeout(commitTimer);
            var delay = options && options.debounce ? options.debounce : COMMIT_DEBOUNCE_MS;
            commitTimer = window.setTimeout(commit, delay);
          }

          /** 暂态失败（网络闪断/5xx）的自动重试：指数退避，给上限，不让编辑悄悄蒸发。 */
          var commitRetries = 0;
          function commitFailure(epoch: any, inflight: any, error: any) {
            if (epoch !== commitEpoch) return; // 已被整份替换接管：旧提交的失败不得重试/重载
            commitControllers.delete(epoch);
            engine.update({ status: 'error', error: String(error.message || error) });
            // 409 冲突 / 401 缺口令 / 403 口令失配或会话未过：三者重试都不会好，
            // 落进退避重试只会空转 5 次并把真正的提示（err.writeToken / 服务端消息）
            // 憋在通用错误文案里。以服务端为准重建，下一次 reload 顺手刷新写口令。
            if (error.status === 409 || error.status === 401 || error.status === 403) {
              if (draft !== null && draft !== inflight) {
                // 飞行中又拖了滑块：新草稿不作废 —— 只作废被打回的这一版，
                // 新草稿以服务端为基准重发。直接清掉会把用户 flight 中的新编辑静默吞掉。
                void reload().then(function () {
                  if (draft !== null) {
                    draft.baseRevision = engine.get().revision;
                    scheduleCommit({ debounce: 50 });
                  }
                });
              } else {
                // 冲突或缺写口令：以服务端为准重建，不拿脏文档反复重试。
                draft = null;
                commitRetries = 0;
                // 状态栏那句 409 消息会在紧随其后的 reload 里被 error:'' 冲掉
                // （只闪几毫秒）—— 用户必须看得见"刚才那下没存住、已回退到最新"，
                // 否则最典型的一种失败是完全静默的。走 toast，停留 4 秒以上。
                if (error.status === 409) notify(t('err.conflict'), 'error');
                void reload();
              }
              return;
            }
            // 暂态失败：draft 保留（那是用户没保存的编辑），退避后重试；
            // 重试上限内不自暴自弃 —— 否则一次网络闪断就把实时同步闷死到下次交互。
            commitRetries += 1;
            if (commitRetries <= 5) scheduleCommit({ debounce: 800 * commitRetries });
          }

          function commit() {
            if (disposed || draft === null) return;
            var inflight = draft;
            var epoch = commitEpoch;
            var controller = typeof AbortController === 'function' ? new AbortController() : null;
            if (controller !== null) commitControllers.set(epoch, controller);
            // expectRevision 必须随编辑流一起发：不发等于关掉乐观锁，双标签页改同一
            // 主题时后写静默覆盖先写（README 承诺的 409 重读形同虚设，已实证）。
            api.saveDoc(inflight.doc, inflight.baseRevision, controller === null ? undefined : controller.signal).then(function (projection) {
              if (epoch !== commitEpoch) return; // 已被整份替换接管：过期响应一律作废
              commitControllers.delete(epoch);
              commitRetries = 0;
              // 过期投影：提交在飞时用户点了预设/载入了方案（服务端 revision 已更高），
              // 这份作废 —— 落了它会把旧令牌打回去（响应次序竞争，实测回跳）。
              // ⚠️ 作废的只是"落地"，**不能连草稿的收口一起 return 掉**：那样 draft 不清、
              // baseRevision 不重挂、scheduleCommit 不续排，status 会一直停在 saving，
              // 直到用户下次手动编辑才恢复（且 SSE/可见性 reload 都被 draft!==null 挡着）。
              var stale = lastAppliedRevision >= 0 && projection.revision < lastAppliedRevision;
              if (draft === inflight) {
                // 期间没有新改动：草稿作废，回到服务端权威值。
                draft = null;
                if (stale) {
                  // 权威值已经在界面上了（更晚的那份投影已落地），只需把状态收口。
                  engine.update({ status: 'ready', error: '' });
                  return;
                }
                accept(projection);
                return;
              }
              // 期间又拖了滑块：换上服务端效果（显示仍是新草稿），并把新草稿的
              // 乐观锁基准推到最新 revision —— 否则下一次提交会被自己人 409 打回。
              // 过期份的 revision 比界面上的旧，基准要取已落地的那个（lastApplied）。
              if (draft !== null) draft.baseRevision = stale ? lastAppliedRevision : projection.revision;
              if (!stale) accept(projection);
              scheduleCommit();
            }, function (error) { commitFailure(epoch, inflight, error) })
          }

          /**
           * 自检快照：随 GET /api/state 回传给 Host，只读 ` /api/state ` 就能看到。
           *
           * 为什么要有：皮肤问题的第一现场永远在 DOM 里（"我的样式注进去了吗"
           * "dts-on 在不在"），而外部没有任何通道能读到它 —— 结果就是一轮轮靠截图猜。
           * 把这几个事实打成快照回传，一次查询就能分辨"客户端没跑 / 样式没注 /
           * 设置项没落地"三种完全不同的病。字段全部白名单收敛、逐个截断，不含任何
           * 令牌或路径。
           *
           * ⚠️ **阶段 C/D 删除**：原实现还有 5 个**读宿主 DOM**的探针 ——
           *   `[class*="card" i]`（把宿主卡片的类名打回给 Host）、
           *   `[style*="hover-preview-fade"]`、`[class*="_card_"]`、
           *   `.dsh-agent-dialog`、`[role="dialog"]`。
           * 它们存在的唯一目的是"分辨宿主用的是哪套类名命名约定"，也就是
           * `references_ui-plugin.md:13` 明文禁止的那件事（按别人的 DOM 猜结构），
           * 而且宿主侧白名单里根本没有 `overlays` 那类字段（`lib/http.js`
           * 的 `sanitizeDiag()` 只透传 body/chrome/chromeLen/layer/section/cards/hit）——
           * 诊断数据本身也是半丢失的。删掉它们**不丢任何用户可见功能**。
           * 保留的 `cards` / `hit` 两个键位改报**插件自己的**事实（键位由宿主侧
           * 只读白名单固定，新增字段会被 `sanitizeDiag` 丢掉，故不复用不了的名字）。
           */
          function buildDiag() {
            try {
              var chrome = document.getElementById(CHROME_STYLE_ID);
              return {
                body: typeof document.body.className === 'string' ? document.body.className.slice(0, 200) : '',
                chrome: chrome !== null,
                chromeLen: chrome !== null && typeof chrome.textContent === 'string' ? chrome.textContent.length : 0,
                layer: document.getElementById(LAYER_ID) !== null,
                section: landed(),
                // 自家浮层容器是否在位（原先是"宿主卡片类名清单"，已删）。
                cards: [],
                hit: {
                  // 自家菜单/提示/建议浮层的实时节点数（原先是读宿主的
                  // `.dts-dialog`/`.dsh-agent-dialog`/`[role=dialog]` 三个宿主探针）。
                  dts: document.querySelectorAll('.dts-cmenu,.dts-cmenu-toast,.dts-suggest').length,
                },
              };
            } catch (error) {
              return { error: String((error as any)?.message ?? error) };
            }
          }

          function reload() {
            if (disposed) return Promise.resolve();
            var diag = '';
            try { diag = encodeURIComponent(JSON.stringify(buildDiag())) } catch (err) { diag = '' }
            return api.getState(diag === '' ? undefined : diag).then(function (projection) {
              if (disposed) return;
              // 与 commit 同一道过期门：reload 有 4 个触发源（boot settle / 可见性 /
              // SSE / 提交失败），并发时旧响应可能后到，直接落地会把已应用的更新
              // revision 打回去（SSE 注释里描述过的"回跳"，在 reload 路径上没防）。
              if (lastAppliedRevision >= 0 && projection.revision < lastAppliedRevision) return;
              accept(projection);
            }, function (error) {
              if (disposed) return;
              // 状态文案按错误面收口：缺写口令 / 接口不通各有面向用户的提示
              // （err.writeToken / err.offline，曾设计未接线成死键），其余展示服务端消息。
              var message = error && error.status === 401 ? t('err.writeToken')
                : (error && error.status ? String(error.message || error) : t('err.offline'));
              engine.update({ status: 'error', error: message })
            })
          }

          /* ---------------- 对话框 ---------------- */

          function openDialog(spec) {
            return new Promise(function (resolve) {
              // 已有确认框在飞：把上一个按"取消"收尾。直接覆盖 dialogAnswer 会让
              // 第一个调用方的 Promise 永远悬挂（泄漏）。
              if (typeof dialogAnswer === 'function') dialogAnswer(false);
              dialogAnswer = resolve;
              engine.update({ dialog: spec });
            })
          }

          function answerDialog(answer) {
            var resolve = dialogAnswer;
            dialogAnswer = null;
            engine.update({ dialog: null });
            if (typeof resolve === 'function') resolve(answer === true);
          }

          function askDelete(item) {
            var lines = [item.name, item.kind + ' · ' + humanBytes(item.bytes)
              + (item.width ? ' · ' + item.width + '×' + item.height : ''), t('dialog.deleteBody')];
            var doc = engine.get().doc;
            if (doc !== null && item.kind === 'font'
              && (doc.type.families || []).some(function (f) { return f.id === item.id })) {
              lines.push(t('dialog.forceFontBody'));
            } else if (doc !== null && doc.backdrop.mediaId === item.id) {
              lines.push(t('dialog.forceBody'));
            }
            return openDialog({
              title: t('dialog.deleteTitle'),
              lines: lines,
              confirmLabel: t('common.delete'),
              cancelLabel: t('common.cancel'),
              tone: 'danger',
            }).then(function (yes) {
              if (yes) return removeMedia(item.id, true)
              return undefined
            })
          }

          function askReset() {
            return openDialog({
              title: t('dialog.resetTitle'),
              lines: [t('dialog.resetBody')],
              confirmLabel: t('common.confirm'),
              cancelLabel: t('common.cancel'),
              tone: 'danger',
            }).then(function (yes) {
              if (!yes) return undefined;
              cancelPendingCommit();
              draft = null;
              // 与其它编辑同一契约：带乐观锁基准，别静默覆盖别的标签页刚存的版本。
              return api.saveDoc({}, engine.get().revision).then(acceptRemote, function (error) {
                notify(t('common.failed') + '：' + String(error.message || error), 'error')
              })
            })
          }

          function removeMedia(id, force) {
            return api.removeMedia(id, force).then(function () {
              probe.invalidate();
              return reload()
            }, function (error) { notify(t('common.failed') + '：' + String(error.message || error), 'error') })
          }

          /* ------------- 提示：自写 Toast（不 require 官方包），宿主容器内渲染 ------------- */

          /**
           * 改造前这里是**三处 `document.body` 写入**里的两处：
           *   · `document.body.appendChild(toastHost)`（`#dts-toast-host` + `createRoot`）
           *   · `document.body.appendChild(noticeEl)`（`#dts-notice` 自绘提示条）
           * 现在两者都走 React：提示进 `notices` 状态 → `OverlaySurface` 交出的容器由
           * `NoticeViewport` 渲染（`Toast` 控件自身 portal 到 body，是控件层与官方
           * `Toast` 逐字同构的行为）。这里只保留**命令式入口** `notify()`
           * （引擎回调、上传、错误处理都从它发），不再有任何节点创建。
           */
          function notify(message, tone) {
            notices.push(message, tone === 'error' ? 'error' : 'ok');
          }

          /**
           * 提示区：`Toast` 控件 + `OverlaySurface` 交出的容器。
           * `tone` 的取舍照旧（控件 `tone` 只有 `'success'` 一个合法值，
           * 错误态是"省略 tone"的警示座）—— 与改造前逐字一致。
           */
          function NoticeViewport() {
            var slice = useSlice(notices.store);
            var hostSlice = useSlice(overlayEffects.store);
            var host = hostSlice.host;
            if (host === null || host === undefined) return null;
            return createPortal(slice.items.map(function (item) {
              return e(Toast, {
                key: 'dts-notice-' + item.id,
                text: item.text,
                tone: item.tone === 'error' ? undefined : 'success',
                // 控件生命周期 = holdMs + 1s 淡出（与官方契约同值）；错误态对齐改造前的 5.2s。
                holdMs: item.tone === 'error' ? 4200 : undefined,
                onDone: function () { notices.drop(item.id) },
              });
            }), host);
          }

          /* ---------------- 取色 ---------------- */

          function sampleAccent() {
            var state = engine.get();
            var doc = state.doc;
            if (doc === null || doc.backdrop.mode !== 'image') {
              notify(t('color.fromImage') + '：' + t('common.empty'), 'error');
              return Promise.resolve();
            }
            var item = mediaLookup(state.media, doc.backdrop.mediaId);
            if (item === undefined) return Promise.resolve();
            return sampleFromImage(mediaUrl(item)).then(function (hex) {
              if (hex === null) {
                notify(t('common.failed'), 'error');
                return;
              }
              patch(function (d) {
                d.palette.accent = hex;
                d.palette.autoAccent = true;
              });
            })
          }

          /** 缩样 + 饱和度/亮度加权取主色；素材同源，canvas 不会被污染。 */
          function sampleFromImage(url) {
            return new Promise(function (resolve) {
              var img = new Image();
              img.crossOrigin = 'anonymous';
              /* 两个监听都要能摘掉：load 与 error 只有一个会触发，另一个会残留在
                 img 上。单次调用随后可被 GC，但"永远不摘监听"是实打实的泄漏写法 ——
                 一旦 img 被复用或高频取色就叠加。settle 时统一摘干净。 */
              var settle = function (value) {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(value);
              };
              var onLoad = function () {
                try {
                  var size = 32;
                  var canvas = document.createElement('canvas');
                  canvas.width = size;
                  canvas.height = size;
                  var c2d = canvas.getContext('2d');
                  if (c2d === null) { settle(null); return }
                  c2d.drawImage(img, 0, 0, size, size);
                  var data = c2d.getImageData(0, 0, size, size).data;
                  var best = null;
                  var bestScore = -1;
                  for (var i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 128) continue;
                    var hsl = rgbToHsl({ r: data[i], g: data[i + 1], b: data[i + 2] });
                    var score = hsl.s * (1 - Math.abs(hsl.l - 52) / 60);
                    if (score > bestScore) { bestScore = score; best = hsl }
                  }
                  if (best === null) { settle(null); return }
                  // 直接取到的颜色常偏灰或过暗，拉回可用的强调色区间。
                  settle(hslToHex(best.h, clamp(best.s, 45, 88), clamp(best.l < 24 ? 52 : best.l, 34, 62)));
                } catch (err) {
                  settle(null)
                }
              };
              var onError = function () { settle(null) };
              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
              img.src = url;
            })
          }

          /* ---------------- 模态（设置页「通用设置」兜底行的入口） ---------------- */

          /**
           * 改造前这里是**第三处 `document.body` 写入**：
           *   `modalHost = document.createElement('div'); document.body.appendChild(modalHost)`
           *   + `ReactDOMClient.createRoot(modalHost)`（另含一条 `require('react-dom')` 退路）。
           * 现在模态是**声明式**的：`modalOpen` 一个布尔 → `ModalHost` 组件渲染到
           * `OverlaySurface` 交出的容器里。宿主容器由 React 渲染、随组件卸载自动消失，
           * 因此**没有任何节点创建**，`require('react-dom')` 的那条退路也一并消失
           * （`react-dom` 现在只剩控件层 `runtime.ts` 的 `createPortal` 一处 require）。
           */
          var modalOpen = createStore({ open: false });
          /** 打开模态前记住焦点所在，关闭时归还，不让焦点掉回 body。 */
          var lastFocused = null;

          function openModal() {
            ensureChromeStyle();
            if (modalOpen.get().open) return;
            lastFocused = document.activeElement || null;
            modalOpen.update({ open: true });
          }

          /**
           * 关闭兜底模态。
           *
           * ⚠️ 这里**不再**手写焦点接管与 Escape 归属 —— 那两件事现在归 `Modal` 控件里的
           * 官方 `useModalLayer`（初始焦点取 `[data-modal-autofocus]` → 首个可聚焦控件 →
           * 容器；Tab 陷阱；Esc 只归最顶层；关闭时 `focusWithoutRing(previous)`）。
           * 原实现里的 `focusIntoModal()`（querySelector 抓第一个 input/button）与
           * `watchModalEscape()`（document 捕获阶段 + `.dts-select-menu` 特判让位）
           * **整条链删除**：`watchModalEscape` 那套"下拉开着时让 Esc 归下拉"其实是
           * 手写版 `event.defaultPrevented` 协议 —— 自写控件层的 Menu/Select 已经在
           * 捕获阶段 `preventDefault()`，官方 `useModalLayer` 又逐字检查 `defaultPrevented`，
           * 于是优先级天然正确，不需要我们再加一层。
           *
           * `lastFocused` 归还保留：真运行时 `useModalLayer` 的清理已经做过一次（同一个
           * 目标，重复聚焦无副作用），而测试夹具里的 `useLayoutEffect` 是缺省的
           * （只遍历元素树、不跑组件树），这一行是那时唯一的归还有点。
           */
          function closeModal() {
            if (!modalOpen.get().open) return;
            modalOpen.update({ open: false });
            // 焦点归还到打开前的元素（设置页里的入口按钮），不让焦点掉回 body。
            if (lastFocused !== null && typeof lastFocused.focus === 'function'
              && document.body.contains(lastFocused)) {
              try { lastFocused.focus() } catch (err) { /* 原元素已离开文档 */ }
            }
            lastFocused = null;
          }

          /**
           * 兜底模态：`OverlaySurface` 容器里的常驻宿主节点（关闭时 `display:none`），
           * 打开时才把 `ThemeStudioApp` 的模态变体 `createPortal` 进去。
           *
           * 常驻而不是按需创建 —— 少一个"什么时候建、什么时候摘"的状态，
           * 也免掉"节点还没建好就渲染"的竞态；`#dts-modal-host` 这个 id 同时是
           * 兜底入口的幂等键（旧实现靠 `document.getElementById(MODAL_HOST_ID)` 判重）。
           */
          function ModalHost() {
            var slice = useSlice(modalOpen);
            var hostSlice = useSlice(overlayEffects.store);
            var host = hostSlice.modalHost;
            if (host === null || host === undefined) return null;
            var box = e('div', {
              id: MODAL_HOST_ID,
              style: { display: slice.open ? undefined : 'none' },
            });
            /* ⚠️ 已知缺陷（审计 D1）：本节点与 `layer.ts` 的容器**共用** `MODAL_HOST_ID`，
               `getElementById` 按树序恒返回容器 ⇒ 本开关盒的 `display:none` 是死开关。
               无用户可见症状（关闭态本就不渲染模态子树）。第二十九轮曾尝试分离 id，
               但测试夹具的 portal 落点断言与之深度耦合、连锁改动过大，**已回退**，
               留作独立小任务处理。 */
            var node = document.getElementById(MODAL_HOST_ID);
            if (!slice.open || node === null) return createPortal(box, host);
            return [
              createPortal(box, host),
              createPortal(e(ThemeStudioApp, { env: env, t: tt, onRequestClose: closeModal }), node),
            ];
          }

          function toggleFullscreen() {
            if (fullscreenElement() !== null) return exitFullscreen();
            return requestFullscreen(document.documentElement).catch(function () { /* 被拒绝就算了 */ })
          }

          /* ---------------- env：组件的唯一依赖 ---------------- */

          var env = {
            engine: engine,
            api: api,
            /** 组件每次渲染现读：外层 useSlice 订阅后整棵子树跟着重渲染。 */
            get state() { return engine.get() },
            patch: patch,
            // 整份文档替换走 acceptRemote（先作废本地草稿与待发提交）：
            // 方案页「应用」与高级页「导入 JSON」都从这里进去。
            accept: acceptRemote,
            liveScheme: liveSchemeNow,
            mediaUrl: mediaUrl,
            tokenNames: function () { return probe.names() },
            isKnownToken: function (name) {
              var groups = engine.get().tokenGroups || [];
              for (var i = 0; i < groups.length; i += 1) {
                var tokens = groups[i].tokens || [];
                for (var j = 0; j < tokens.length; j += 1) {
                  if (tokens[j].name === name) return true;
                }
              }
              return false;
            },
            textContrast: function (scheme) {
              var doc = engine.get().doc;
              if (doc === null) return 21;
              var tokens = doc.palette.tokens || {};
              var bg = (tokens['--dsw-alias-bg-base'] && tokens['--dsw-alias-bg-base'][scheme])
                || probe.of('--dsw-alias-bg-base', scheme)
                || (scheme === 'dark' ? '#151517' : '#ffffff');
              var fg = (tokens['--dsw-alias-label-primary'] && tokens['--dsw-alias-label-primary'][scheme])
                || probe.of('--dsw-alias-label-primary', scheme)
                || (scheme === 'dark' ? '#f2f4f8' : '#0f1115');
              return contrastRatio(bg, fg);
            },
            applyPreset: function (id) {
              return api.preset(id).then(function (projection) {
                acceptRemote(projection);
                notify(t('preset.applied'), 'ok');
              }, function (error) { notify(t('common.failed') + '：' + String(error.message || error), 'error') })
            },
            upload: function (file) {
              return api.upload(file).then(function (value) {
                probe.invalidate();
                return reload().then(function () { return value })
              }, function (error) {
                notify(t('common.failed') + '：' + String(error.message || error), 'error');
                throw error
              })
            },
            useAsFont: function (item) {
              var family = 'DTS-' + String(item.id).slice(0, 8);
              patch(function (d) {
                var exists = d.type.families.some(function (f) { return f.id === item.id });
                if (!exists) d.type.families.push({ id: item.id, family: family, weight: 400, style: 'normal' });
                d.type.uiFont = '"' + family + '", ' + (d.type.uiFont || 'sans-serif');
              })
            },
            // 壁纸和半透表面在产品语义上是一体的：任何"点亮壁纸"的动作都保证
            // 表面能透出，且只在真的翻转了玻璃开关时提示一次 —— 否则用户只会
            // 觉得"点了没反应"（壁纸其实早就存进去了）。关壁纸则不擅自动玻璃。
            activateBackdrop: function (kind, id) {
              var doc = engine.get().doc;
              if (doc === null) return;
              var turnedGlassOn = !doc.glass.enabled;
              patch(function (d) {
                d.backdrop.mode = kind;
                d.backdrop.mediaId = id;
                if (turnedGlassOn) {
                  d.glass.enabled = true;
                  // 教训（主人实测）：默认 alpha .72 = 七成白纱，壁纸透出来约等于没显示。
                  // 点亮壁纸场景直接把不透明度压到真能看见的档位；之后想调回随我。
                  if (d.glass.alpha > 0.6) d.glass.alpha = 0.45;
                }
              });
              if (turnedGlassOn) notify(t('backdrop.glassOn'), 'ok');
            },
            setBackdropMode: function (v) {
              var doc = engine.get().doc;
              if (doc === null) return;
              var turnedGlassOn = v !== 'none' && !doc.glass.enabled;
              patch(function (d) {
                d.backdrop.mode = v;
                // 换模式时清掉类型不符的 mediaId：图→视频直接切会把图片 id 塞进
                // <video>（error 后黑屏到底，素材下拉也显示空标签）；切到渐变/无背景
                // 时也清 —— 否则这块"看不见的素材"的引用会一直留着。
                if (v === 'image' || v === 'video') {
                  var item = mediaLookup(engine.get().media, d.backdrop.mediaId);
                  if (d.backdrop.mediaId !== '' && (item === undefined || item.kind !== v)) d.backdrop.mediaId = '';
                } else {
                  d.backdrop.mediaId = '';
                }
                if (turnedGlassOn) {
                  d.glass.enabled = true;
                  if (d.glass.alpha > 0.6) d.glass.alpha = 0.45;
                }
              });
              if (turnedGlassOn) notify(t('backdrop.glassOn'), 'ok');
            },
            // 通用确认框入口（方案页的覆盖/删除用它）：返回 Promise<boolean>。
            confirmDialog: openDialog,
            askDelete: askDelete,
            askReset: askReset,
            answerDialog: answerDialog,
            sampleAccent: sampleAccent,
            notify: notify,
            openModal: openModal,
            // 关闭面同时交给组件（模态自己的关闭键走 onRequestClose → closeModal）：
            // 做成声明式之后没有"卸载 React root"那一步，关就是翻一个布尔。
            closeModal: closeModal,
            toggleFullscreen: toggleFullscreen,
          };

          function ensureChromeStyle() {
            var el = upsertStyle(CHROME_STYLE_ID, CHROME_CSS);
            if (styles.indexOf(el) === -1) styles.push(el);
          }

          function tt(key) {
            var args = Array.prototype.slice.call(arguments, 1);
            return t.apply(null, [key].concat(args))
          }

          /* ---------------- 入口注册 ---------------- */

          var settingsDisposer = null;
          var fallbackDisposer = null;
          var entryMode = '';
          /** 回退判定的 setTimeout 句柄：卸载前要能取消，否则会在已 dispose 的 ctx 上注册。 */
          var entryTimer = 0;

          /**
           * ★ 官方注册签名（产物逐字，`settings-general/lib/client.js:1169-1172`）：
           *   `{ id: 'general', order: 0, label: () => t('general.nav'), locale: NS }`
           *
           * 两个要点，缺一不成：
           *   · `label` 必须传 **thunk**（不是字符串）—— 官方外壳投影导航时调的是
           *     `resolveSlotLabel(e.options.label)`（`ui-slots/lib/index.js:27`），
           *     字符串会被原样用掉，thunk 才会在每次投影时现取当前语言；
           *   · 声明 `locale: NS` —— 外壳把 `ctx.locale.getSnapshot().revision` 纳入
           *     `useSections` 的比较键（`settings-general/lib/client.js:1020-1021`），
           *     revision 一变就重解析 label **并重渲染 outlet**
           *     （`ui-renderer/lib/client.js:1097-1098`）。
           * 于是"换语言 → dispose + 重注册 + 组件整棵重建"这整条链不再需要 ——
           * 连带消掉了"重注册会丢组件内草稿"的那个坑（见下面 `draft` 的说明）。
           *
           * ⚠️ **有意偏离官方一处**：`locale` 只在拿得到 locale 服务时才声明。
           * 官方页面的 `inject` 数组里含 `locale`，服务必在；本插件把 locale 当**可选**依赖
           * （`exports.inject = ['slots','theme']`，Electron 壳可能没有 locale 插件），
           * 而 renderer 对"声明了 locale 却没有 locale face"的处理是**抛
           * `SlotAssemblyError`**（`ui-renderer/lib/client.js:721-724`）——
           * 那会让整个 slot 条目白屏（正是 SKILL.md:21 点名要避免的
           * `slot entry crashed`）。所以这里按"服务在不在"决定要不要声明：
           * 有服务 = 官方形态（换语言自动重渲染）；没服务 = 不声明，界面走本地词典降级链，
           * 只是换语言要刷新页面 —— 好过整个面板消失。
           */
          function registerSettingsSection() {
            if (settingsDisposer !== null) return;
            settingsDisposer = ctx.slots.inject('settings.section', function () {
              var options: any = {
                name: 'settings.section',
                id: PLUGIN_ID,
                order: 60,
                priority: 60,
                label: function () { return t('section.title') },
                inject: function () { return { env: env, t: tt } },
              };
              if (getLocaleService() !== null) options.locale = LOCALE_NS;
              return ctx.slots.register(options, ThemeStudioApp)
            });
          }

          function registerFallbackRow() {
            if (fallbackDisposer !== null) return;
            fallbackDisposer = ctx.slots.inject('settings.general.item', function () {
              var options: any = {
                name: 'settings.general.item',
                id: PLUGIN_ID,
                order: 60,
                inject: function () { return { env: env, t: tt } },
              };
              // 同一套理由（见 registerSettingsSection）：有 locale 服务才声明命名空间。
              if (getLocaleService() !== null) options.locale = LOCALE_NS;
              return ctx.slots.register(options, ThemeStudioGeneralRow)
            });
          }

          /** ledger 自省：条目是否真的进了设置导航。官方外壳就是读这张表投影导航的。 */
          function landed() {
            try {
              if (typeof ctx.slots.entries !== 'function') return true;
              var rows = ctx.slots.entries('settings.section') || [];
              for (var i = 0; i < rows.length; i += 1) {
                var options = rows[i] && rows[i].options;
                if (options && options.id === PLUGIN_ID) return true;
              }
              return false;
            } catch (err) {
              /* 自省不可用就当已落地，别因此撤回一个本来在的入口 */
              return true;
            }
          }

          /**
           * 设置页入口。首选官方 settings.section；没进 ledger 就回退到「通用设置」一行。
           * 无论 slot 契约怎么变都要有入口 —— 入口消失就是功能退化。
           */
          function mountSettingsEntry() {
            if (!ctx.slots || typeof ctx.slots.inject !== 'function') {
              console.info('[dsh-theme-studio] 环境未提供 slots 服务，跳过设置页入口');
              return;
            }
            try {
              registerSettingsSection();
              entryMode = 'section';
            } catch (err) {
              console.warn('[dsh-theme-studio] settings.section 注册失败：', err);
              entryMode = 'none';
            }
            // inject 的触发可能是异步的，给两拍再判定。
            window.clearTimeout(entryTimer);
            entryTimer = window.setTimeout(function () {
              if (disposed) return;
              if (entryMode === 'section' && landed()) {
                if (fallbackDisposer !== null) {
                  try { fallbackDisposer() } catch (err) { /* 已回收 */ }
                  fallbackDisposer = null;
                }
                return;
              }
              if (entryMode !== 'fallback') {
                console.warn('[dsh-theme-studio] settings.section 未进 ledger，回退到「通用设置」行');
                entryMode = 'fallback';
                try { registerFallbackRow() } catch (err) { console.warn('[dsh-theme-studio] 回退入口注册失败：', err) }
              }
            }, 0);
          }

          /**
           * 语言来源变化的唯一漏斗：只有解析出来的语言真的变了才刷新。
           * 两个来源各判一次会行为不一致（一个改了文案另一个没跟）。
           *
           * ⚠️ 这里**不再重注册设置页条目**（`label` 改 thunk + 声明 `locale` 之后，
           * 重渲染由官方外壳负责，见 registerSettingsSection 的注释）。重注册曾是
           * "换语言丢草稿"的唯一成因：dispose + 重注册会让组件整棵重建。
           */
          var lang = currentLang();
          function onLangSourceChanged() {
            var next = currentLang();
            if (next === lang) return;
            lang = next;
            /* 顶条上的全屏键**不在设置页组件树里**（它在 `shell.overlay` 的浮层宿主里），
               所以外壳换语言时不会连带重渲染它 —— 由这里推一次 revision，
               `FullscreenButton` 订了这个 store，文案（title/aria-label/气泡）跟着变。
               改造前这里是 `setFsLabel()`：抓到节点再改属性；现在是纯状态。 */
            langRevision.update({ revision: langRevision.get().revision + 1 });
          }

          /* ---------------- 窗口顶条：整窗全屏 ---------------- */
          /**
           * 「整窗全屏」原来挂在面板头里（标题右边），按主人指定挪进**窗口顶条**、
           * 紧挨原生最小化键左侧。Windows 是 `titleBarStyle:"hidden"` +
           * `titleBarOverlay:{height:40}` —— — □ × 由系统画在右上角，页面这一侧能用的
           * 只剩它们左边的自由区，所以右偏移必须实测：
           *   WCO 给出自由区矩形 → 视口右沿减去自由区右沿 = 三键总宽；
           *   拿不到（非 Windows / WCO 关闭）按 Win11 三键 46×3=138 兜底，
           *   macOS 红绿灯在左、右边是空的 → 12。
           */
          /**
           * 改造前这里是**第四处 `document.body` 写入**：
           *   `document.body.appendChild(fsButton)`（`<button class="dts-fs">` 浮在窗口顶条）
           *   + `window.addEventListener('resize', syncFsInset)`（注册点也不在 effect 内）。
           * 现在它同时是 §3 的 `Tooltip` 唯一接线点（见 `FullscreenButton`）。
           */
          function captionInset() {
            try {
              var overlay = (navigator as any).windowControlsOverlay;
              if (overlay && typeof overlay.getTitlebarAreaRect === 'function') {
                var rect = overlay.getTitlebarAreaRect();
                var inset = window.innerWidth - (rect.x + rect.width);
                if (Number.isFinite(inset) && inset >= 0 && inset <= 480) return inset;
              }
            } catch (err) { /* WCO 不可用 → 走兜底 */ }
            return document.documentElement.hasAttribute('data-windows-titlebar') ? 138 : 12;
          }

          /**
           * 窗口顶条的全屏键。**声明式**渲染在 `OverlaySurface` 的容器里：
           *   · 换语言：`langRevision` 由 `onLangSourceChanged` 推进 ⇒ 文案跟着变，
           *     不再需要 `setFsLabel()` 那种"抓到节点再改属性"的命令式刷新；
           *   · `resize` 监听：注册在 `useEffect` 里（组件级 effect，随卸载摘除）——
           *     与旧实现"在 mountFsButton 里挂、在 unmountFsButton 里摘"等价但更严。
           */
          function FullscreenButton() {
            var slice = useSlice(langRevision);
            var insetState = useState(captionInset);
            useEffect(function () {
              function onResize() { insetState[1](captionInset()) }
              window.addEventListener('resize', onResize);
              return function () { window.removeEventListener('resize', onResize) };
            }, []);
            var label = tt('common.fullscreen');
            return uiTooltip(tt('common.fullscreen'), e('button', {
              type: 'button', className: 'dts-fs',
              style: { '--dts-caption-inset': String(insetState[0]) + 'px' },
              'aria-label': label, title: label,
              onClick: function () { void toggleFullscreen() },
            }, '⤢'));
          }

          /* ---------------- 浮层：官方 shell.overlay 槽 ---------------- */

          /**
           * 把插件在**框架级浮层**里的一切注到官方 `shell.overlay` 槽（`OverlaySurface`）。
           *
           * 官方依据（`dsh-client-ui-layout` 产物逐字）：
           *   `{ key: 'shell.overlay', kind: 'list', scope: 'root',
           *      summary: 'Frame-wide floating layer, above every column and outside their
           *                scroll containers.' }`
           * 且该层 **click-through**（`[data-shell-overlay]{position:absolute;inset:0;
           * z-index:20;pointer-events:none}`）—— 条目自己决定哪一块吃指针。
           * 官方自己的 8 个条目（`chat.quota-notice` / `schedule.delete-toast` / …）都注在这里。
           *
           * 我们说得出"为什么需要浮层"（`references_ui-plugin.md:5` 的判据）：
           * 壁纸要盖住整个框架（不属于任何一列）、一次性提示要跨面板存活、
           * 全屏键要贴在窗口顶条上 —— 三者都不是某列内部的东西。
           *
           * ⚠️ 注册失败（宿主没有这个槽 / 槽契约变了）不改入口模式：只是浮层那几件
           * （背景层、提示、兜底模态、全屏键）暂时不出现，设置页入口照常。
           */
          /**
           * 浮层宿主的**内容**：三件挂在框架级浮层上的东西 —— 一次性提示、兜底模态、全屏键。
           *
           * ⚠️ 这里是**元素**而不是"调三个组件函数"：本夹具（node 侧）不跑 React 调度器，
           * 直接把组件函数当普通函数调会让它们内部的 hooks 抛 `Invalid hook call` ——
           * 返回元素则与真运行时同构（React 负责调用）。
           */
          function OverlayContent() {
            return [
              e(NoticeViewport, { key: 'notices' }),
              e(ModalHost, { key: 'modal' }),
              e(FullscreenButton, { key: 'fs' }),
            ];
          }

          function registerOverlaySurface() {
            if (overlayDisposer !== null) return;
            if (!ctx.slots || typeof ctx.slots.inject !== 'function') return;
            try {
              overlayDisposer = ctx.slots.inject('shell.overlay', function () {
                var options: any = {
                  name: 'shell.overlay',
                  id: PLUGIN_ID,
                  order: 60,
                };
                if (getLocaleService() !== null) options.locale = LOCALE_NS;
                return ctx.slots.register(options, function OverlayEntry() {
                  return e(OverlaySurface, {
                    effects: overlayEffects,
                    attachStage: function (node) { layer.attachStage(node) },
                    detachStage: function () { layer.detachStage() },
                    content: OverlayContent,
                  });
                });
              });
            } catch (err) {
              overlayDisposer = null;
              console.warn('[dsh-theme-studio] shell.overlay 注册失败（浮层不出现，面板照常）：', err);
            }
          }

          /* ---------------- 生命周期 ---------------- */

          /**
           * 视差监听的注册点（`references_ui-plugin.md:13`：注册一律在 `ctx.effect` 内）。
           * 改造前 `window.addEventListener('pointermove')` 是在 `sync()`（网络回调）里挂的，
           * 现在业务侧只翻开关，真正的注册/摘除在这里成对发生。
           */
          layer.createBackdropEffect(ctx);

          ctx.effect(function () {
            if (!ctx.theme) {
              console.warn('[dsh-theme-studio] 环境未提供 theme 服务，配色改动将只落在背景层');
            }
            ensureChromeStyle();
            registerOverlaySurface();
            mountSettingsEntry();
            // 顶条「编辑」菜单换成磨砂面板：系统菜单是原生 Menu.popup，CSS 够不着，
            // 只能在它弹出前拦下那次点击（详见 caption-menu.ts 的取证注释）。
            var disposeCaptionMenu = installCaptionMenu();
            void reload();
            // 宿主样式表可能在插件之后装载，追一次把基准值补全。
            var settle = window.setTimeout(function () {
              probe.invalidate();
              void reload();
            }, 400);
            return function () {
              window.clearTimeout(settle);
              disposeCaptionMenu();
              closeModal();
              notices.clear();
              layer.detachStage();
              if (overlayDisposer !== null) {
                try { overlayDisposer() } catch (err) { /* 已回收 */ }
                overlayDisposer = null;
              }
            };
          }, 'theme-studio: boot');

          /**
           * 词典注册进官方 locale 服务 —— 官方写法（ui-theme:1583 / ui-settings-general:969
           * / ui-chat:12234 同一形态）：`ctx.effect(() => locale.register(NS, {zh,en}), '<reason>')`。
           * `register` 返回撤销本次注册的 disposer，由 effect 在卸载时回收。
           * 与自研 t() 共用同一个 MESSAGES 对象，同源不漂移；locale 缺席（Electron 壳）
           * 则安静跳过，界面走本地词典降级链。
           */
          ctx.effect(function () {
            return registerLocaleDictionary(getLocaleService());
          }, 'theme-studio: locale dictionaries');

          ctx.effect(function () {
            /**
             * 语言变化的订阅面 —— **只剩官方两个来源**（本轮删掉了第三档）：
             *   ① locale.subscribe —— 官方推荐面，换语言与词典注册都会撞 revision；
             *   ② ctx.on('locale/change') —— 官方事件（只在真的换语言时发）。
             *
             * ⚠️ 这条链**不再负责设置页条目**：条目的 `label` 是 thunk + 声明了 `locale`，
             *    官方外壳自己在 locale revision 变化时重解析并重渲染
             *    （`settings-general/lib/client.js:1022-1023` 的 `resolveSlotLabel(e.options.label)`
             *     外面套着 `ctx.locale.getSnapshot().revision` 比较；
             *     `ui-renderer/lib/client.js:1097-1098` 的每个 outlet 都订了 `useLocaleRevision`）。
             *    它现在只服务**不在 slot 树里**的那样东西：窗口顶条的全屏按钮
             *    （`setFsLabel()` 刷 title/aria-label）。
             *
             * ★ 已删除的第三档：`MutationObserver(<html lang>)`。
             *   它当初存在的理由是"两个官方来源都没有时，靠 <html lang> 变化触发
             *   **重新注册设置页条目**"。重注册整条链已经不存在（label thunk + locale 声明），
             *   于是这一档只剩下"locale 服务缺席时，让全屏按钮的文案跟着 <html lang> 变"
             *   这点残余作用 —— 而 locale 服务缺席时本插件的文案本来就在启动时定死
             *   （面板内容也靠外壳重渲染，没有外壳就没有重渲染信号），
             *   留它反而是一处"看起来在自愈、其实只救了半件事"的假象。
             *   代价如实记在 `ui-align/13-panel-official-paradigm.md` §5/§7：
             *   无 locale 服务的组合里，切 `<html lang>` 不再刷新全屏按钮的 title。
             */
            var offService = null;
            var offEvent = null;
            try {
              var localeSvc = getLocaleService();
              offService = subscribeLocaleChanges(localeSvc, function () { onLangSourceChanged() });
              if (offService === null && typeof ctx.on === 'function' && localeSvc) {
                offEvent = ctx.on('locale/change', function () { onLangSourceChanged() });
              }
            } catch (err) {
              offService = null;
              offEvent = null;
            }
            return function () {
              if (typeof offService === 'function') {
                try { offService() } catch (err) { /* 服务已卸 */ }
              }
              if (typeof offEvent === 'function') {
                try { offEvent() } catch (err) { /* 已解绑 */ }
              }
            };
          }, 'theme-studio: language watch');

          ctx.effect(function () {
            function onKey(event) {
              if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              var key = String(event.key).toLowerCase();
              if (key === 'f') { event.preventDefault(); void toggleFullscreen() }
            }
            window.addEventListener('keydown', onKey);
            return function () { window.removeEventListener('keydown', onKey) };
          }, 'theme-studio: hotkeys');

          /* 浮层诊断采样器（每 800ms 扫一次宿主浮层、把类名/backdropFilter/祖先玻璃面
             攒进 overlayMemory，随 GET /api/state 的 client.diag.overlays 回传）已整段删除。
             理由（`07-compliance-audit.md` §七 批次 0 第 2 条，净删）：
               ① 它只服务自检，不参与任何渲染/状态/持久化决策 → 删掉零用户可见损失；
               ② 它的 13 个宿主类名锚点（`[class$="_card"]`、`[class*="_trigger "]`…）正是
                  `references_ui-plugin.md:13` 禁止的"猜别人的类名"——它存在的理由就是"为了
                  猜类名而造的探针"；
               ③ 更关键的是**它本来就是死的**：宿主 `lib/http.js:114 sanitizeDiag()` 的白名单
                  里从来没有 `overlays` 字段（只留 body/chrome/chromeLen/layer/section/cards/hit），
                  所以采样结果在 Host 侧就被丢掉了，`/api/state` 从未带出过它。
             浮层为什么没有磨砂，改由官方通道回答：模糊=重铸 `--dsw-menu-backdrop-filter`，
             表面=重铸 `--dsw-menu-surface-fill`（engine.js 的 buildTokenLayers）。 */

          ctx.effect(function () {
            if (!ctx.theme) return undefined;
            if (typeof ctx.on !== 'function') return undefined;
            var off = ctx.on('theme/change', function () {
              // 明暗切换会换掉基准色：玻璃层要按新基准重铸一次。
              setLiveScheme(liveSchemeNow());
              var doc = engine.get().doc;
              if (doc !== null) layer.sync(doc, prefix, engine.get().media);
            });
            return typeof off === 'function' ? off : undefined;
          }, 'theme-studio: theme/change');

          ctx.effect(function () {
            var closed = false;
            var stream = null;
            try {
              stream = new EventSource(prefix + '/api/events');
              stream.addEventListener('message', function (event) {
                var payload = null;
                try { payload = JSON.parse(event.data) } catch (err) { payload = null }
                if (payload && payload.revision === lastAppliedRevision) return;
                if (draft !== null) return;
                void reload();
              });
              stream.addEventListener('error', function () { /* EventSource 自带指数退避重连，无需另起轮询 */ });
            } catch (err) {
              /* 没有 EventSource：只用轮询 */
            }
            function onVisible() {
              if (document.visibilityState === 'visible' && !closed && draft === null) void reload();
            }
            document.addEventListener('visibilitychange', onVisible);
            return function () {
              closed = true;
              document.removeEventListener('visibilitychange', onVisible);
              if (stream !== null) stream.close();
            };
          }, 'theme-studio: live sync');

          ctx.effect(function () {
            return function () {
              // 先立门闩、再清场：在飞的 getState/saveDoc/upload 回调此后一律作废，
              // 否则清掉的样式与令牌会被 `.then(accept)` 重新长回来（僵尸主题）。
              disposed = true;
              cancelPendingCommit();
              window.clearTimeout(entryTimer);
              // 设置页入口要亲手撤：slots 注册不随 effect 作用域自动回收，
              // 不撤就会留下一个渲染已死引擎的条目。
              if (settingsDisposer !== null) {
                try { settingsDisposer() } catch (err) { /* 已回收 */ }
                settingsDisposer = null;
              }
              if (fallbackDisposer !== null) {
                try { fallbackDisposer() } catch (err) { /* 已回收 */ }
                fallbackDisposer = null;
              }
              if (overlayDisposer !== null) {
                try { overlayDisposer() } catch (err) { /* 已回收 */ }
                overlayDisposer = null;
              }
              window.clearTimeout(commitTimer);
              styles.forEach(function (el) { el.remove() });
              /* 提示/模态/全屏键都不再是"我们造的 body 子节点"：它们由 React 渲染在
                 `shell.overlay` 的容器里（提示由 Toast 控件 portal，模态由 Modal 控件
                 portal）—— 清状态源即可，节点随组件卸载一起走。 */
              notices.clear();
              closeModal();
              layer.dispose();
              if (ctx.theme && typeof ctx.theme.overrideTokens === 'function') {
                // 同名 source 再注册会替换整层：这里用空层把自己撤干净。
                try { ctx.theme.overrideTokens(TOKEN_SOURCE, {}) } catch (err) { /* 注册表已先走 */ }
              }
            };
          }, 'theme-studio: teardown');
        }

