// src/client/app.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { clamp, contrastRatio, hslToHex, rgbToHsl, rgba } from '../../lib/color-core.js'
import { createApi } from './api.ts'
import { CHROME_CSS, exitFullscreen, fullscreenElement, requestFullscreen } from './chrome.ts'
import { P, ReactDOMClient, e, useState } from './deps.ts'
import { MESSAGES, currentLang, getLocaleService, setLocaleService, t } from './i18n.ts'
import { CHROME_STYLE_ID, COMMIT_DEBOUNCE_MS, DEFAULT_PREFIX, EXTRA_GLASS_SURFACES, FAB_ID, MODAL_HOST_ID, PLUGIN_ID, STYLE_ID, TAB_STORAGE_KEY, TOKEN_SOURCE } from './identity.ts'
import { createLayerManager, upsertStyle } from './layer.ts'
import { uiButton, uiStateDot, wrapForTooltip } from './primitives.ts'
import { composeGlass, createTokenProbe, fillTokenPairs, fixDiffFamily, fixTextFamily, setLiveScheme } from './probe-glass.ts'
import { createStore, useSlice } from './store.ts'
import { AdvancedTab, BackdropTab, ColorTab, ConfirmDialog, ICON, LibraryTab, PresetTab, ProfileTab, ShapeTab, Svg, TypeTab } from './tabs.ts'
import { humanBytes, mediaLookup, readLocal, relativeLuminance, writeLocal } from './utils.ts'

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

          /* 页签键盘契约对齐官方 TabPanel（ui-dockkit 就地核验）：←→ wrap 移动
             焦点（manual activation，移动与选中分离）、Home/End 首尾、
             Enter/Space 激活（TabPanel 选中键实证）。 */
          function onTabKey(event, index) {
            var group = event.currentTarget && event.currentTarget.parentElement;
            var tabs = group && typeof group.querySelectorAll === 'function'
              ? group.querySelectorAll('.dts-tab') : [];
            var count = tabs.length;
            if (count === 0) return;
            var next = -1;
            if (event.key === 'ArrowRight') next = (index + 1) % count;
            else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = count - 1;
            else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              chooseTab(TABS[index].id);
              return;
            }
            if (next >= 0) {
              event.preventDefault();
              var node = tabs[next];
              if (node && typeof node.focus === 'function') node.focus();
            }
          }

          var tree = e('div', { className: 'dts-panel', 'data-variant': isModal ? 'modal' : 'page' },
            e('div', { className: 'dts-head' },
              e('h3', { className: 'dts-title' }, Svg(), tt('section.title')),
              wrapForTooltip(tt('common.fullscreen'),
                uiButton({ variant: 'ghost', onClick: function () { void env.toggleFullscreen() }, children: '⤢' })),
              uiButton({ variant: 'ghost', onClick: function () { env.askReset() }, children: tt('common.reset') }),
              isModal ? uiButton({ variant: 'ghost', onClick: function () { props.onRequestClose() }, children: tt('common.close') }) : null,
              e('span', { className: 'dts-status', 'data-state': state.status === 'error' ? 'error' : 'idle' },
                uiStateDot({ state: statusDot }), statusLabel)),

            e('div', { className: 'dts-tabs', role: 'tablist' }, TABS.map(function (item, index) {
              return e('button', {
                key: item.id, type: 'button', role: 'tab', className: 'dts-tab',
                'aria-selected': active === item.id ? 'true' : 'false',
                tabIndex: active === item.id ? 0 : -1,
                onKeyDown: function (event) { onTabKey(event, index) },
                onClick: function () { chooseTab(item.id) },
              }, tt(item.key))
            })),

            state.status === 'error' && state.doc === null
              ? e('p', { className: 'dts-note', 'data-tone': 'error' }, state.error || tt('common.failed'))
              : null,

            state.doc
              ? e('div', { role: 'tabpanel', key: active }, e(Current, { env: env, t: tt, doc: state.doc }))
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

          if (!isModal) return tree;
          // 模态必须自我声明为 dialog：遮罩只是视觉遮挡，没有 role/aria-modal
          // 的话读屏与 Tab 仍会落到背后的界面（焦点没有被困住）。
          return e('div', {
            className: 'dts-modal-mask',
            onClick: function (event) { if (event.target === event.currentTarget) props.onRequestClose() },
          }, e('div', {
            className: 'dts-modal-card',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': tt('section.title'),
            onKeyDown: function (event) {
              // 焦点陷阱对齐官方 ImageLightbox：Tab 圈闭在模态内（含反向）。
              if (event.key !== 'Tab') return;
              var card = event.currentTarget;
              var nodes = typeof card.querySelectorAll === 'function'
                ? Array.prototype.slice.call(card.querySelectorAll(
                  'button, input, select, textarea, [tabindex]:not([tabindex="-1"])')) : [];
              if (nodes.length === 0) return;
              var at = nodes.indexOf(document.activeElement);
              var nextAt = event.shiftKey
                ? (at <= 0 ? nodes.length - 1 : at - 1)
                : (at === nodes.length - 1 || at === -1 ? 0 : at + 1);
              event.preventDefault();
              if (typeof nodes[nextAt].focus === 'function') nodes[nextAt].focus();
            },
          }, tree))
        }

        /** 语言变化后设置页条目要用新文案重新注册，这里给一个不依赖 slot 的兜底行。 */
        export function ThemeStudioGeneralRow(props) {
          var env = props.env, tt = props.t;
          return e('div', { className: 'dts-row' },
            e('label', null, tt('section.title')),
            uiButton({ variant: 'ghost', onClick: function () { env.openModal() }, children: tt('common.openPanel') }))
        }

        /* ============================================================ */
        /* 装配：状态机、DOM 落地、入口注册                                 */
        /* ============================================================ */

        /**
         * Cordis 入口。
         * @param {import('@deepseek-ai/cordis').Context} ctx
         */
        export function apply(ctx) {
          var boot = window.__DTS_BOOT__ || {};
          var prefix = typeof boot.prefix === 'string' && boot.prefix !== '' ? boot.prefix : DEFAULT_PREFIX;
          var writeToken = typeof boot.writeToken === 'string' ? boot.writeToken : '';
          var probe = createTokenProbe();
          var layer = createLayerManager();
          var commitTimer = 0;
          var lastAppliedRevision = -1;
          var dialogAnswer = null;
          var styles = [];
          /**
           * 跨组件重建保留的未保存草稿：换语言时官方契约要求用新文案重新注册设置页条目，
           * 重新注册会卸载并重建组件 —— 草稿只活在组件里就会跟着丢。
           */
          var draft = null;
          /** locale 是可选依赖：接上模块级句柄，取不到就走降级链（不声明进 inject）。 */
          setLocaleService(typeof ctx.get === 'function'
            ? ctx.get('locale') ?? null
            : ctx.locale ?? null);

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
            if (!projection || !projection.doc) return;
            prefix = projection.prefix || prefix;
            if (typeof projection.writeToken === 'string' && projection.writeToken !== '') writeToken = projection.writeToken;
            var doc = projection.doc;
            var pairs = fillTokenPairs(projection.tokenLayers || {}, probe);
            // Host 的 glassSurfaces 是权威源但随宿主启动装载（桌面端 / CLI 同一路径）——
            // 浏览器半自带高频表面兜底（新会话条/聊天气泡），刷新即透明，不等重启。
            var surfaces = (projection.glassSurfaces || []).slice();
            EXTRA_GLASS_SURFACES.forEach(function (name) {
              if (surfaces.indexOf(name) === -1) surfaces.push(name);
            });
            var glass = composeGlass(surfaces, doc, probe, doc.palette.tokens || {});
            var merged = Object.assign({}, glass, pairs);
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
            // 令牌可能刚把按钮底色调成与图标同色：每次投影落地都重校一次对比。
            fixFabContrast(document.getElementById(FAB_ID));
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

          function commit() {
            if (draft === null) return;
            var inflight = draft;
            // expectRevision 必须随编辑流一起发：不发等于关掉乐观锁，双标签页改同一
            // 主题时后写静默覆盖先写（README 承诺的 409 重读形同虚设，已实证）。
            api.saveDoc(inflight.doc, inflight.baseRevision).then(function (projection) {
              if (draft === inflight) {
                // 期间没有新改动：草稿作废，回到服务端权威值。
                draft = null;
                accept(projection);
                return;
              }
              // 期间又拖了滑块：换上服务端效果（显示仍是新草稿），并把新草稿的
              // 乐观锁基准推到最新 revision —— 否则下一次提交会被自己人 409 打回。
              if (draft !== null) draft.baseRevision = projection.revision;
              accept(projection);
              scheduleCommit();
            }, function (error) {
              engine.update({ status: 'error', error: String(error.message || error) });
              if (error.status === 409 || error.status === 401) {
                // 冲突或缺写口令：以服务端为准重建，不拿脏文档反复重试。
                draft = null;
                void reload();
              }
            })
          }

          function reload() {
            return api.getState().then(accept, function (error) {
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
              draft = null;
              return api.saveDoc({}).then(accept, function (error) {
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

          /* ---------------- 提示：官方 Toast 优先，缺失时自绘一条 ---------------- */

          var noticeTimer = 0;
          var noticeEl = null;
          var toastHost = null;
          var toastRoot = null;

          function notify(message, tone) {
            if (!message) return;
            if (P.Toast && ReactDOMClient && typeof ReactDOMClient.createRoot === 'function') {
              try {
                if (toastHost === null || !document.body.contains(toastHost)) {
                  toastHost = document.createElement('div');
                  toastHost.id = 'dts-toast-host';
                  document.body.appendChild(toastHost);
                  toastRoot = ReactDOMClient.createRoot(toastHost);
                }
                // 官方 Toast 的 tone 只有 'success' 一个合法值，错误态是"省略 tone"的
                // 警示座（Toast.tsx）；'error' 是契约外值，传了连图标座都空掉。
                toastRoot.render(e(P.Toast, {
                  text: message,
                  tone: tone === 'error' ? undefined : 'success',
                  // 官方生命周期 = holdMs + 1s 淡出；错误态对齐自绘回退的 5.2s。
                  holdMs: tone === 'error' ? 4200 : undefined,
                  onDone: function () { try { toastRoot.render(null) } catch (err) { /* 已卸载 */ } },
                }));
                return;
              } catch (err) {
                /* 退回自绘 */
              }
            }
            if (noticeEl === null || !document.body.contains(noticeEl)) {
              noticeEl = document.createElement('div');
              noticeEl.id = 'dts-notice';
              noticeEl.setAttribute('role', 'status');
              noticeEl.className = 'dts-note';
              noticeEl.style.cssText = 'position:fixed;right:16px;bottom:58px;z-index:2147482002;max-width:60vw;'
                + 'word-break:break-word;padding:7px 12px;border-radius:10px;font-size:12.5px;'
                + 'background:var(--dsw-alias-toast-bg,#151517);color:var(--dsw-alias-label-primary-inverted,#fff);'
                + 'box-shadow:var(--dsw-elevation-prominent,0 3px 8px rgba(0,0,0,.04));'
                + 'transition:opacity .25s var(--ds-ease-in-out,ease)';
              document.body.appendChild(noticeEl);
            }
            noticeEl.textContent = message;
            noticeEl.setAttribute('data-tone', tone === 'error' ? 'error' : 'ok');
            noticeEl.style.opacity = '1';
            window.clearTimeout(noticeTimer);
            noticeTimer = window.setTimeout(function () {
              if (noticeEl !== null) noticeEl.style.opacity = '0';
            }, tone === 'error' ? 5200 : 2400);
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
              img.addEventListener('load', function () {
                try {
                  var size = 32;
                  var canvas = document.createElement('canvas');
                  canvas.width = size;
                  canvas.height = size;
                  var c2d = canvas.getContext('2d');
                  if (c2d === null) { resolve(null); return }
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
                  if (best === null) { resolve(null); return }
                  // 直接取到的颜色常偏灰或过暗，拉回可用的强调色区间。
                  resolve(hslToHex(best.h, clamp(best.s, 45, 88), clamp(best.l < 24 ? 52 : best.l, 34, 62)));
                } catch (err) {
                  resolve(null)
                }
              }); // 加载失败走下方 error 监听（曾误把 onerror 当第三参传，等于死参）
              img.addEventListener('error', function () { resolve(null) });
              img.src = url;
            })
          }

          /* ---------------- 浮动按钮与模态 ---------------- */

          var modalHost = null;
          var modalRoot = null;
          /** 打开模态前记住焦点所在，关闭时归还，不让焦点掉回 body。 */
          var lastFocused = null;
          /** 碰撞检测 interval 句柄：0 = 未启动。单所有者，start/stop 幂等。 */
          var fabTimer = 0;

          /**
           * 只在几何上确实与聊天输入区抢右下角时才让位。
           * 判定只看"主输入框有没有伸进视口底部这条带子"：
           * 新会话输入框居中（离底远）⇒ 按钮常显；有对话时输入区延伸到底部 ⇒ 隐藏。
           * 不用 dsh 的内部 class（哈希会变），也不猜祖先容器宽度。
           */
          function pokeFabCollision() {
            var BOTTOM_ZONE = 200;
            var fab = document.getElementById(FAB_ID);
            if (!fab) return;
            var collide = false;
            try {
              var nodes = document.querySelectorAll('[contenteditable], textarea');
              for (var i = 0; i < nodes.length; i += 1) {
                var rect = nodes[i].getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                if (rect.width < window.innerWidth * 0.5) continue;
                if (rect.bottom > window.innerHeight - BOTTOM_ZONE) { collide = true; break }
              }
            } catch (err) {
              /* 量不到就保持可见 */
            }
            var next = collide ? 'true' : 'false';
            // 只在真正翻转时写属性，否则每 500ms 触发一次样式重算。
            // 用 data-* 属性而不是 dataset：属性在一切 DOM 实现里都在，dataset 不是。
            if (fab.getAttribute('data-hidden') !== next) fab.setAttribute('data-hidden', next);
          }

          function startFabCollision() {
            pokeFabCollision();
            // 幂等：重复调用不叠 interval。旧写法"先停再重建"在卸载竞态里
            // 出现过 closeModal 于 disposer 之后重建、结果只剩一个没人回收的 interval。
            if (fabTimer !== 0) return;
            fabTimer = setInterval(pokeFabCollision, 500);
          }

          function stopFabCollision() {
            if (fabTimer === 0) return;
            clearInterval(fabTimer);
            fabTimer = 0;
          }

          /**
           * FAB 图标对比自愈：图标走 currentColor（= label-primary）、背景是
           * button-elevated-fill —— 主题把两者调成同色时按钮整个隐形（实测白底白图标）。
           * 按背景亮度二值定图标深浅，任何主题下都保底可见。
           */
          function fixFabContrast(fab) {
            if (!fab) return;
            try {
              var bg = getComputedStyle(fab).backgroundColor;
              if (typeof bg !== 'string' || bg === '') return;
              fab.style.color = relativeLuminance(bg) < 0.36 ? '#ffffff' : '#101418';
            } catch (err) { /* 取不到计算样式就保持令牌色 */ }
          }

          function setFabLabel(fab) {
            if (!fab) return;
            fab.title = t('section.title');
            fab.setAttribute('aria-label', t('section.title'));
          }

          function mountFab() {
            ensureChromeStyle();
            var existing = document.getElementById(FAB_ID);
            if (existing !== null) { setFabLabel(existing); fixFabContrast(existing); startFabCollision(); return }
            var fab = document.createElement('button');
            fab.id = FAB_ID;
            fab.className = 'dts-fab';
            fab.type = 'button';
            fab.innerHTML = ICON;
            setFabLabel(fab);
            fixFabContrast(fab);
            fab.addEventListener('click', function () { openModal() });
            document.body.appendChild(fab);
            startFabCollision();
          }

          function openModal() {
            if (document.getElementById(MODAL_HOST_ID) !== null) return;
            ensureChromeStyle();
            lastFocused = document.activeElement || null;
            modalHost = document.createElement('div');
            modalHost.id = MODAL_HOST_ID;
            document.body.appendChild(modalHost);
            try {
              if (ReactDOMClient && typeof ReactDOMClient.createRoot === 'function') {
                modalRoot = ReactDOMClient.createRoot(modalHost);
              } else {
                var ReactDOM = require('react-dom');
                modalRoot = {
                  render: function (node) { ReactDOM.render(node, modalHost) },
                  unmount: function () { ReactDOM.unmountComponentAtNode(modalHost) },
                };
              }
              modalRoot.render(e(ThemeStudioApp, { env: env, t: tt, onRequestClose: closeModal }));
              focusIntoModal();
            } catch (err) {
              console.warn('[dsh-theme-studio] 模态渲染失败：', err);
              closeModal();
            }
          }

          /**
           * 打开时把焦点移进模态：只声明 aria-modal 而不接管焦点，Tab 仍会跑到
           * 遮罩背后的界面上。取不到焦点就跳过，不阻断鼠标操作 —— 降级而非抛错。
           */
          function focusIntoModal() {
            try {
              if (modalHost === null || typeof modalHost.querySelector !== 'function') return;
              var target = modalHost.querySelector('input, button, select, textarea, [tabindex]');
              if (target !== null && typeof target.focus === 'function') target.focus();
            } catch (err) {
              /* 聚焦失败不影响使用 */
            }
          }

          function closeModal() {
            if (modalRoot !== null) {
              try { modalRoot.unmount() } catch (err) { /* 已卸载 */ }
              modalRoot = null;
            }
            if (modalHost !== null) modalHost.remove();
            modalHost = null;
            // 焦点归还到打开前的元素（通常就是浮动按钮），再复核一次碰撞。
            if (lastFocused !== null && typeof lastFocused.focus === 'function'
              && document.body.contains(lastFocused)) {
              try { lastFocused.focus() } catch (err) { /* 原元素已离开文档 */ }
            }
            lastFocused = null;
            pokeFabCollision();
          }

          /** 浮动按钮与设置页在模态里渲染时，Escape 一律关闭。 */
          function watchModalEscape() {
            var onKey = function (event) {
              if (event.key !== 'Escape') return;
              // 下拉弹层开着时 Esc 归下拉（关闭并把焦点交还触发器，Menu 契约），
              // 不许一击关掉整个模态 —— document capture 会抢跑（实测）。
              var menuOpen = typeof document.querySelector === 'function'
                ? document.querySelector('.dts-select-menu') !== null
                : false;
              if (menuOpen) return;
              if (engine.get().dialog !== null) return;
              if (document.getElementById(MODAL_HOST_ID) !== null) closeModal();
            };
            document.addEventListener('keydown', onKey, true);
            return function () { document.removeEventListener('keydown', onKey, true) }
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
            accept: accept,
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
              draft = null;
              return api.preset(id).then(function (projection) {
                accept(projection);
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

          /**
           * 注册（或按新文案**重新**注册）设置页独立页。
           * ⚠️ 必须先 dispose 旧注册：list 槽同 id + 同 priority 重复注册会 throw。
           */
          function registerSettingsSection() {
            if (settingsDisposer !== null) {
              try { settingsDisposer() } catch (err) { /* 旧注册已失效 */ }
              settingsDisposer = null;
            }
            settingsDisposer = ctx.slots.inject('settings.section', function () {
              return ctx.slots.register({
                name: 'settings.section',
                id: PLUGIN_ID,
                order: 60,
                priority: 60,
                label: tt('section.title'),
                inject: function () { return { env: env, t: tt } },
              }, ThemeStudioApp)
            });
          }

          function registerFallbackRow() {
            if (fallbackDisposer !== null) return;
            fallbackDisposer = ctx.slots.inject('settings.general.item', function () {
              return ctx.slots.register({
                name: 'settings.general.item',
                id: PLUGIN_ID,
                order: 60,
                inject: function () { return { env: env, t: tt } },
              }, ThemeStudioGeneralRow)
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
            setTimeout(function () {
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
           */
          var lang = currentLang();
          function onLangSourceChanged() {
            var next = currentLang();
            if (next === lang) return;
            lang = next;
            setFabLabel(document.getElementById(FAB_ID));
            if (entryMode === 'section') {
              try { registerSettingsSection() } catch (err) { console.warn('[dsh-theme-studio] 语言切换后重新注册失败：', err) }
            }
          }

          /* ---------------- 生命周期 ---------------- */

          ctx.effect(function () {
            if (!ctx.theme) {
              console.warn('[dsh-theme-studio] 环境未提供 theme 服务，配色改动将只落在背景层');
            }
            ensureChromeStyle();
            mountFab();
            mountSettingsEntry();
            void reload();
            // 宿主样式表可能在插件之后装载，追一次把基准值补全。
            var settle = window.setTimeout(function () {
              probe.invalidate();
              void reload();
            }, 400);
            return function () {
              window.clearTimeout(settle);
              closeModal();
              stopFabCollision();
              var fab = document.getElementById(FAB_ID);
              if (fab !== null) fab.remove();
            };
          }, 'theme-studio: boot');

          ctx.effect(function () {
            // 只报「有可能变了」，是否真的换语言交给 onLangSourceChanged 统一判定。
            // 词典顺手注册进官方 locale 服务（ui-plugin.md：可见文案过 locale 服务）：
            // 与自研 t() 共用同一个 MESSAGES 对象，同源不漂移；locale 缺席（Electron
            // 壳）安静跳过。仍不声明进 inject —— 免得某环境缺服务就整个插件不加载。
            var offDict = null;
            try {
              var localeSvc = getLocaleService();
              if (localeSvc && typeof localeSvc.register === 'function') {
                offDict = localeSvc.register(PLUGIN_ID, { zh: MESSAGES.zh, en: MESSAGES.en });
              }
            } catch (err) {
              console.info('[dsh-theme-studio] locale 词典注册跳过：', err && err.message);
            }
            var observer = null;
            try {
              observer = new MutationObserver(function () { onLangSourceChanged() });
              observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
            } catch (err) {
              observer = null;
            }
            var offService = null;
            try {
              if (typeof ctx.on === 'function' && getLocaleService()) offService = ctx.on('locale/change', function () { onLangSourceChanged() });
            } catch (err) {
              offService = null;
            }
            return function () {
              if (typeof offDict === 'function') {
                try { offDict() } catch (err) { /* 服务已卸 */ }
              }
              if (observer !== null) observer.disconnect();
              if (typeof offService === 'function') {
                try { offService() } catch (err) { /* 已解绑 */ }
              }
            };
          }, 'theme-studio: language watch');

          ctx.effect(function () {
            var offEscape = watchModalEscape();
            function onKey(event) {
              if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              var key = String(event.key).toLowerCase();
              if (key === 'f') { event.preventDefault(); void toggleFullscreen() }
            }
            window.addEventListener('keydown', onKey);
            return function () {
              offEscape();
              window.removeEventListener('keydown', onKey);
            };
          }, 'theme-studio: hotkeys');

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
              stream.addEventListener('error', function () { /* 断开由轮询兜住 */ });
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
              window.clearTimeout(commitTimer);
              window.clearTimeout(noticeTimer);
              styles.forEach(function (el) { el.remove() });
              var notice = document.getElementById('dts-notice');
              if (notice !== null) notice.remove();
              if (toastRoot !== null) {
                try { toastRoot.unmount() } catch (err) { /* 已卸载 */ }
                toastRoot = null; toastHost = null;
              }
              var toast = document.getElementById('dts-toast-host');
              if (toast !== null) toast.remove();
              layer.dispose();
              if (ctx.theme && typeof ctx.theme.overrideTokens === 'function') {
                // 同名 source 再注册会替换整层：这里用空层把自己撤干净。
                try { ctx.theme.overrideTokens(TOKEN_SOURCE, {}) } catch (err) { /* 注册表已先走 */ }
              }
            };
          }, 'theme-studio: teardown');
        }

