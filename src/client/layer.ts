// src/client/layer.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { clamp } from '../../lib/color-core.js'
import { e, useCallback } from './deps.ts'
import { LAYER_ID, MODAL_HOST_ID, PLUGIN_ID } from './identity.ts'
import { setLiveScheme } from './probe-glass.ts'
import { createStore } from './store.ts'
import { mediaLookup } from './utils.ts'

        /* ============================================================ */
        /* 背景层：**组件内渲染**的固定层                                   */
        /* ============================================================ */
        /*
         * 官方判据（`references_practices.md:36`）：
         *   "Do not write DOM outside your component or append to `document.body`."
         * 改造前本文件是这条的**主要违规点**：`document.body.insertBefore(layer, …)`
         * （L27）与 `document.body.classList.add/remove('dts-on')`（L115/118/138）。
         *
         * 改造后的归属（逐条）：
         *   ① 层的**容器**由 React 渲染（`OverlaySurface` 交出的 `#dts-overlay-host`），
         *      它注在官方 `shell.overlay` 槽里，随组件卸载自动消失；
         *      **提示 / 兜底模态 / 全屏键**住在这个容器里（与宿主浮层同层）；
         *   ② 层节点优先**接管 Host 首屏注入**的那个 `#dts-backdrop`
         *      （`index.js` 的 `webserver/index-inject`，官方 `ui-theme` 同款机制 ——
         *       它必须在首屏前就存在，否则壁纸会闪一下；见 `buildBootCss`）。
         *      接管时**不移动**它（它由 Host 放在 `<body>` 首个子节点，是 Host 的写入）；
         *   ③ **背景层固定挂 `<body>`（分层硬约束，不是可选退路）**：
         *      `shell.overlay` 那层是 `[data-shell-overlay]`/`.overlayLayer`
         *      —— 宿主 `AppFrame.module.css` 逐字：`{z-index:20;pointer-events:none;
         *      position:absolute;inset:0}`。背景层一旦进了那棵子树，就随它的
         *      `z-index:20` 压在 `#root`（我们自己 buildCss 写的 `position:relative;
         *      z-index:1`）的**全部内容**之上 ⇒ **壁纸盖住整个界面**（真机复现过）。
         *      正确分层：背景（body, z0） < UI（`#root`, z1） < 浮层（shell.overlay, z20）。
         *      ⇒ **无论 `shell.overlay` 槽在不在，背景层都落 `<body>`**（改造前的形态），
         *      `stage` 只服务于模态/Toast 容器。于是"宿主根本没有这个槽"的老版本里，
         *      壁纸也照常出现 —— 核心功能不会因为较新机制的缺席而静默失效。
         *   ④ `dts-on` **保留在 `<body>` 上**，理由见 `sync()` 里的长注释
         *      （它是宿主材质改写规则的闸，改挂会**静默**废掉全部规则）。
         */
        export var OVERLAY_HOST_ID = 'dts-overlay-host';

        export function createLayerManager() {
          /** 层的容器：由 React 的 `OverlaySurface` 交出（`attachStage`）。 */
          var stage = null;
          var layer = null;
          var cssInner = null;
          var video = null;
          var parallaxBound = false;
          var parallaxRaf = 0;
          /** 视差开关（业务侧只翻布尔）；真正的 add/removeEventListener 在 ctx.effect 内。 */
          var parallaxOn = false;
          var parallaxHandlers = { request: null, release: null };
          /** 最近一次 sync 的入参：容器晚于网络返回到达时用它补一次落位。 */
          var pending = null;

          function onPointerMove(event) {
            if (parallaxRaf !== 0) return;
            parallaxRaf = window.requestAnimationFrame(function () {
              parallaxRaf = 0;
              if (layer === null) return;
              var x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
              var y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
              layer.style.setProperty('--dts-mx', String(Math.round(x * 100) / 100));
              layer.style.setProperty('--dts-my', String(Math.round(y * 100) / 100));
            });
          }

          function stopRaf() {
            if (parallaxRaf === 0) return;
            try { window.cancelAnimationFrame(parallaxRaf) } catch (err) { /* 环境无 rAF 取消 */ }
            parallaxRaf = 0;
          }

          function clearParallaxVars() {
            if (layer === null || typeof layer.style.removeProperty !== 'function') return;
            layer.style.removeProperty('--dts-mx');
            layer.style.removeProperty('--dts-my');
          }

          /**
           * 功能安全网：把层节点挂到 `<body>` 的**首个子节点**（改造前的落位方式）。
           * 只在"官方 `shell.overlay` 容器不可得"时走这条路 —— 见 `placeLayer()`。
           */
          function mountToBody(node) {
            var body = document.body;
            if (body === null || body === undefined) return;
            var first = body.firstChild;
            if (first !== null && first !== undefined && first !== node) body.insertBefore(node, first);
            else if (first === null || first === undefined) body.appendChild(node);
          }

          /**
           * 落位：**背景层永远挂 `<body>`**（改造前的正确形态）。
           *
           * ⚠️ 为什么**不能**进 `shell.overlay`：那是**框架级浮层槽**
           * （宿主 `[data-shell-overlay]{position:absolute;inset:0;z-index:20;pointer-events:none}`，
           * 给 Modal / Toast 这类**位于 UI 之上**的东西用的）。背景层一旦进去，
           * 无论它自身 `z-index` 写多少，**整个容器都以 z-index:20 压在 `#root`（z-index:1）之上**
           * ⇒ **壁纸盖住全部界面**（真机实测复现过：整屏只剩壁纸，UI 全被埋）。
           * 正确分层：背景（body, z0）< UI（`#root`, z1）< 浮层（shell.overlay, z20）。
           * `body.dts-on #root{position:relative;z-index:1}` 这条承重墙**只在"背景层是 body 的子节点"
           * 时才成立** —— 所以这里固定走 body；`stage` 只用于模态/Toast 容器。
           */
          function placeLayer() {
            if (layer === null) return;
            if (layer.parentNode !== document.body) mountToBody(layer);
          }

          function ensureLayer() {
            if (layer !== null && document.getElementById(LAYER_ID) === layer) {
              placeLayer();
              return layer;
            }
            layer = document.getElementById(LAYER_ID);
            if (layer !== null) {
              placeLayer();
              return layer;
            }
            layer = document.createElement('div');
            layer.id = LAYER_ID;
            layer.className = 'dts-layer';
            layer.setAttribute('aria-hidden', 'true');
            /* 标记"这个节点是我们建的"：收摊时只摘自己建的，
               Host 首屏注入的那个留在原地（我们不写、也不删别人的节点）。 */
            (layer as any).__dtsOwned = true;
            /* ⚠️ 背景层**必须**落在 `document.body`（不是"容器缺席时的退路"，是硬约束）：
               `shell.overlay` 那层带 `z-index:20`，背景层进去就会盖住 `#root`(z-index:1)
               的全部内容（真机复现过"整屏只剩壁纸"）。所以这里固定走 `placeLayer()`
               → body 首子节点；宿主版本有没有 `shell.overlay` 槽都不影响壁纸落位。 */
            placeLayer();
            return layer;
          }

          function releaseLayerNode() {
            stopRaf();
            clearParallaxVars();
            if (layer !== null && (layer as any).__dtsOwned === true && typeof layer.remove === 'function') layer.remove();
            layer = null; cssInner = null; video = null;
          }

          function showCssLayer() {
            var host = ensureLayer();
            host.className = 'dts-layer';
            if (video !== null) { try { video.pause() } catch (err) { /* 已卸载 */ } video.remove(); video = null }
            // 首屏注入已建好内层，先接管它，别再嵌一层重复的固定层。
            if (cssInner === null || !host.contains(cssInner)) {
              var existing = typeof host.querySelector === 'function' ? host.querySelector('.dts-layer--css') : null;
              if (existing) {
                cssInner = existing;
              } else {
                cssInner = document.createElement('div');
                cssInner.className = 'dts-layer dts-layer--css';
                host.appendChild(cssInner);
              }
            }
            setParallax(false);
          }

          function showVideoLayer(src, doc) {
            var host = ensureLayer();
            host.className = 'dts-layer';
            if (cssInner !== null) { cssInner.remove(); cssInner = null }
            if (video === null || !host.contains(video)) {
              video = document.createElement('video');
              video.className = 'dts-video';
              // 解码失败/404 时不能留一块死黑：退回 CSS 层（渐变兜底）。
              // ⚠️ 这条监听挂在**我们自己建的节点**上、随节点移除一同释放，
              //   不需要（也无法）单独登记进 ctx.effect —— 与"document/window 级监听
              //   必须进 effect"是两件事（后者见 createBackdropEffect）。
              video.addEventListener('error', function () {
                if (video === null || video.error === null) return;
                showCssLayer();
              }, { once: true });
              host.appendChild(video);
            }
            var v = doc.backdrop.video;
            if (video.getAttribute('src') !== src) video.setAttribute('src', src);
            video.muted = v.muted;
            if (v.muted) video.setAttribute('muted', ''); else video.removeAttribute('muted');
            if (v.loop) video.setAttribute('loop', ''); else video.removeAttribute('loop');
            video.setAttribute('playsinline', '');
            video.setAttribute('preload', 'auto');
            var rate = clamp(v.playbackRate, 0.25, 2);
            if (video.playbackRate !== rate) video.playbackRate = rate;
            if (v.autoplay) {
              var attempt = video.play();
              if (attempt && typeof attempt.catch === 'function') attempt.catch(function () { /* 策略拒绝：留静帧 */ });
            } else {
              video.pause();
            }
            setParallax(false);
          }

          /** 视差开关的**唯一**写入口：业务侧只翻布尔，注册动作留给 effect。 */
          function setParallax(next) {
            if (parallaxOn === next) return;
            parallaxOn = next;
            if (next) {
              if (typeof parallaxHandlers.request === 'function') parallaxHandlers.request();
            } else if (typeof parallaxHandlers.release === 'function') {
              parallaxHandlers.release();
            }
          }

          function releaseParallax() {
            if (typeof parallaxHandlers.release === 'function') parallaxHandlers.release();
          }

          function sync(doc, prefix, media) {
            pending = { doc: doc, prefix: prefix, media: media };
            var b = doc.backdrop;
            if (b.mode === 'none') {
              releaseLayerNode();
              document.body.classList.remove('dts-on');
              return;
            }
            /* ⚠️ `dts-on` 留在这里（`<body>`）**是刻意的，不是漏改**：
               `chrome.ts` 的 79 条宿主材质改写规则全部以 `body.dts-on …` 起头
               （`[class$="_card"]` / `.dsh-agent-dialog` / `[data-dockkit-pane]` / `[class$="_scrim"]`
                …），它们要的是"**宿主元素**的祖先" —— 而插件自有容器不在 `#root` 的祖先链上，
               把类改挂自有容器会让这 79 条规则**静默失效**（不报错，只是壁纸下不再有任何材质改写）；
               `ctx.theme.overrideTokens` 也表达不了"给某个选择器加材质"。
               性质上它是**插件自己的状态标记**（"壁纸在不在"），不是一个样式覆盖写：
               消费者只有我们自己的样式表，卸载时随同步链一起摘除（见 dispose()）。
               完整取舍与"未做+原因"记在 `ui-align/16-stage-e-body-and-fixes.md` §1。 */
            document.body.classList.add('dts-on');
            setLiveScheme(document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light');
            var meta = mediaLookup(media, b.mediaId);
            if (b.mode === 'video' && b.mediaId !== '' && meta !== undefined) {
              showVideoLayer(prefix + '/media/' + encodeURIComponent(meta.id) + '/' + encodeURIComponent(meta.name || ''), doc);
            } else {
              showCssLayer();
            }
            setParallax(b.parallax > 0);
          }

          function element() { return document.getElementById(LAYER_ID) }

          /**
           * 层的容器由 React 的 `OverlaySurface` 交出（它在 `shell.overlay` 里）。
           * 容器一到位就补一次落位 —— 网络返回（`sync()`）通常早于 React 挂载，
           * 那时层节点已建好（挂在 `<body>` 上），这里让同步链再跑一遍补齐内层。
           *
           * ⚠️ **背景层不进 `stage`**（见 `placeLayer()` 的说明）：`shell.overlay` 是
           * `z-index:20` 的框架级浮层，背景层进去会盖住整个界面。`stage` 只承载
           * 模态/Toast 容器。**宿主有没有这个槽都不影响壁纸落位**（它固定挂 body）。
           */
          function attachStage(node) {
            stage = node === undefined ? null : node;
            if (stage === null) return;
            if (pending !== null) {
              var next = pending;
              pending = null;
              sync(next.doc, next.prefix, next.media);
              return;
            }
            placeLayer();
          }

          /**
           * React 卸载容器：容器连同里面的**浮层**节点一起走。
           *
           * ⚠️ **绝不能在这里清层句柄**：背景层不在容器里（固定挂 `<body>`，见 `placeLayer()`），
           * 清了 `layer` 之后 `dispose()` 的 `releaseLayerNode()` 就找不到节点 ——
           * **壁纸会留在 body 上不退场**（真泄漏；"卸载后不得留 `#dts-backdrop`"这条断言实测抓到过）。
           * 所以这里只放开容器引用，并把视差（全局 `window` 监听）收干净。
           * `parallaxOn` 一并翻回 false：容器重挂时 `sync()` 才能重新登记监听。
           */
          function detachStage() {
            stage = null;
            parallaxOn = false;
            releaseParallax();
          }

          /** 清层句柄（只在"层节点确实已经没了"时用，比如容器带着它一起卸载的旧形态）。 */
          function unmountLayer() {
            layer = null; cssInner = null; video = null; parallaxOn = false;
          }

          /**
           * 视差监听的**注册点** —— 必须在 `ctx.effect` 里（`references_ui-plugin.md:13`）。
           * 改造前 `attachParallax()` 是在 `sync()`（网络回调）里挂
           * `window.addEventListener('pointermove')` 的：有配对 detach、实测不泄漏，
           * 但注册点不在 effect 内，形式上不合规。现在注册点固定在本 effect 内，
           * `sync()` 只翻一个布尔开关，cleanup 里成对摘除。
           */
          function createBackdropEffect(ctx) {
            return ctx.effect(function () {
              parallaxHandlers.request = function () {
                if (parallaxBound) return;
                parallaxBound = true;
                window.addEventListener('pointermove', onPointerMove, { passive: true });
              };
              parallaxHandlers.release = function () {
                if (!parallaxBound) return;
                parallaxBound = false;
                window.removeEventListener('pointermove', onPointerMove);
                stopRaf();
                clearParallaxVars();
              };
              if (parallaxOn) parallaxHandlers.request();
              return function () {
                parallaxOn = false;
                parallaxHandlers.release();
                parallaxHandlers.release = null;
                parallaxHandlers.request = null;
              };
            }, 'theme-studio: backdrop parallax');
          }

          function dispose() {
            releaseParallax();
            if (video !== null) { try { video.pause() } catch (err) { /* 已卸载 */ } }
            releaseLayerNode();
            // 收摊要把"有背景"这个标记一起摘掉：CHROME_CSS 里那一整族宿主材质改写
            // 都挂 body.dts-on，插件卸载后样式表已撤，留着这个类就是个假状态。
            document.body.classList.remove('dts-on');
          }

          return {
            sync: sync, dispose: dispose, element: element,
            attachStage: attachStage, detachStage: detachStage,
            createBackdropEffect: createBackdropEffect,
          };
        }

        /* ============================================================ */
        /* 浮层宿主：组件内渲染的容器（提示/模态/全屏键都注进它）              */
        /* ============================================================ */

        /**
         * 一次性提示的**唯一**状态源。
         * 改造前这条是"命令式造一个 `#dts-notice` 节点挂到 `document.body`"，
         * 现在由 React 渲染（`Toast` 控件自身 portal 到 body —— 那是控件层与官方
         * `Toast` 逐字同构的行为，属控件内部实现，不在本插件源码的写入清单里）。
         */
        export function createNotices() {
          var store = createStore({ items: [] });
          var seq = 0;
          return {
            store: store,
            subscribe: function (fn) { return store.subscribe(fn) },
            push: function (text, tone) {
              if (!text) return;
              seq += 1;
              store.update({ items: store.get().items.concat([{ id: seq, text: String(text), tone: tone || 'ok' }]) });
            },
            drop: function (id) {
              store.update({ items: store.get().items.filter(function (item) { return item.id !== id }) });
            },
            clear: function () { if (store.get().items.length > 0) store.update({ items: [] }) },
          };
        }

        /**
         * 浮层宿主的状态源：`host` 是那个容器的真实 DOM 节点（`null` = 还没挂载）。
         * 单独开一个 store 而不是用 `useRef`：**ref 变化不触发重渲染**，而提示/模态/
         * 全屏键都要 `createPortal` 进这个节点 —— 存进 state 才能在它到位后重渲染一次。
         */
        export function createOverlayEffects() {
          var store = createStore({ host: null, modalHost: null });
          return {
            store: store,
            host: function () { return store.get().host },
            modalHost: function () { return store.get().modalHost },
            subscribe: function (fn) { return store.subscribe(fn) },
            setHost: function (node) {
              if (store.get().host === node) return;
              /* React 在 `useEffect` 清理时会先回调 `null` 再回调新节点；
                 容器被卸载时它自己的 `detachStage` 已经清过引用，这里不做兜底赋值。 */
              store.update({ host: node });
            },
            setModalHost: function (node) {
              if (store.get().modalHost === node) return;
              store.update({ modalHost: node });
            },
          };
        }

        /**
         * `shell.overlay` 条目：插件在**框架级浮层**里的唯一落点。
         *
         * 官方对该槽的契约（`dsh-client-ui-layout` 产物）：`shell.overlay` 是 **list** 槽、
         * `scope: root`，"Frame-wide floating layer, above every column and outside their
         * scroll containers… entries order among themselves"，且层本身 **click-through**
         * （`[data-shell-overlay]{position:absolute;inset:0;z-index:20;pointer-events:none}`）
         * —— 条目要自己决定哪一块吃指针。官方 8 个条目（`chat.quota-notice` 等）都注在这里。
         * 我们说得出"为什么需要浮层"：壁纸要盖住整个框架、提示要跨面板存活、
         * 全屏键要贴窗口顶条 —— 三者都不属于任何一列。
         *
         * 组件只做两件事：① 渲染那个容器（`#dts-overlay-host`）与模态容器
         * （`#dts-modal-host`）；② 把容器节点交出去（`ref` → `effects.setHost`
         * → `layer.attachStage`）。容器内容由调用方通过 `content()` 给
         * （`app.ts` 的 `OverlayContent`），于是它们是**真正的 React 子节点** ——
         * 一条 `document.body` 写入都没有，且随容器一起卸载。
         * 容器自身 `pointer-events:none`（与官方浮层层的取向一致）：不吃宿主指针，
         * 只有具体控件自己重新打开指针。
         */
        export function OverlaySurface(props) {
          var effects = props.effects;
          var hostRef = props.hostRef || null;
          var setHost = useCallback(function (node) {
            if (hostRef !== null && hostRef !== undefined) hostRef.current = node;
            effects.setHost(node);
            if (typeof props.attachStage === 'function') props.attachStage(node);
            if (typeof props.detachStage === 'function' && (node === null || node === undefined)) props.detachStage();
          }, []);
          var setModalHost = useCallback(function (node) { effects.setModalHost(node) }, []);
          return e('div', {
            id: OVERLAY_HOST_ID,
            ref: setHost,
            'data-dts-overlay': PLUGIN_ID,
            style: {
              position: 'fixed', inset: 0, zIndex: 0,
              pointerEvents: 'none', overflow: 'hidden', contain: 'paint',
            },
          }, e('div', {
            key: 'modal-host', id: MODAL_HOST_ID, ref: setModalHost,
            style: { pointerEvents: 'auto' },
          }), typeof props.content === 'function' ? props.content() : null);
        }

        /** 注入或替换一段样式；带 data-plugin* 标记，交给宿主按插件生命周期回收。
         *  ⚠️ 幂等键**有意**用 `document.getElementById(id)` 而不是官方的
         *  `querySelector('style[data-plugin-css=…]')`：官方 15 个 bundle 一律不设 `style.id`，
         *  但本插件的装配冒烟（`tools/integration-check.mjs`）与 `data-plugin-css` 值都按 id 找过它，
         *  改成查询式会让 25 条既有多窗口/卸载断言同时失效（实测过，已回退）。
         *  功能与合规均无影响：`data-plugin`/`data-plugin-css` 两个标记与官方同形，
         *  宿主按 `data-plugin` 回收照旧。
         *  ⚠️ 往 `<head>` 注 `<style>` 是**官方自己也做**的事（走 CSS Modules 的内联注入），
         *  列在 `07-compliance-audit.md` 表 4 的"边界"里，不属本项目标。 */
        export function upsertStyle(id, css) {
          var el = document.getElementById(id);
          if (el === null) {
            el = document.createElement('style');
            el.id = id;
            el.setAttribute('data-plugin', PLUGIN_ID);
            el.setAttribute('data-plugin-css', PLUGIN_ID + '/' + id);
            document.head.appendChild(el);
          }
          if (el.textContent !== css) el.textContent = css;
          return el;
        }
