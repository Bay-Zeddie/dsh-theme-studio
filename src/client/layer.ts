// src/client/layer.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { clamp } from '../../lib/color-core.js'
import { LAYER_ID, PLUGIN_ID } from './identity.ts'
import { setLiveScheme } from './probe-glass.ts'
import { mediaLookup } from './utils.ts'

        /* ============================================================ */
        /* 背景层：插件自己维护的固定层                                     */
        /* ============================================================ */

        export function createLayerManager() {
          var layer = null;
          var cssInner = null;
          var video = null;
          var parallaxBound = false;
          var parallaxRaf = 0;

          function ensureLayer() {
            if (layer !== null && document.body.contains(layer)) return layer;
            layer = document.getElementById(LAYER_ID);
            if (layer === null) {
              layer = document.createElement('div');
              layer.id = LAYER_ID;
              layer.className = 'dts-layer';
              layer.setAttribute('aria-hidden', 'true');
              document.body.insertBefore(layer, document.body.firstChild);
            }
            return layer;
          }

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

          function attachParallax() {
            if (parallaxBound) return;
            parallaxBound = true;
            window.addEventListener('pointermove', onPointerMove, { passive: true });
          }

          function detachParallax() {
            if (!parallaxBound) return;
            parallaxBound = false;
            window.removeEventListener('pointermove', onPointerMove);
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
            detachParallax();
          }

          function showVideoLayer(src, doc) {
            var host = ensureLayer();
            host.className = 'dts-layer';
            if (cssInner !== null) { cssInner.remove(); cssInner = null }
            if (video === null || !host.contains(video)) {
              video = document.createElement('video');
              video.className = 'dts-video';
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
            detachParallax();
          }

          function sync(doc, prefix, media) {
            var b = doc.backdrop;
            if (b.mode === 'none') {
              if (layer !== null) {
                if (video !== null) { try { video.pause() } catch (err) { /* 已卸载 */ } }
                layer.remove();
                layer = null; cssInner = null; video = null;
              }
              detachParallax();
              document.body.classList.remove('dts-on');
              return;
            }
            document.body.classList.add('dts-on');
            setLiveScheme(document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light');
            var meta = mediaLookup(media, b.mediaId);
            if (b.mode === 'video' && b.mediaId !== '' && meta !== undefined) {
              showVideoLayer(prefix + '/media/' + encodeURIComponent(meta.id) + '/' + encodeURIComponent(meta.name || ''), doc);
            } else {
              showCssLayer();
            }
            if (b.parallax > 0) attachParallax(); else detachParallax();
          }

          function element() { return document.getElementById(LAYER_ID) }

          function dispose() {
            detachParallax();
            if (video !== null) { try { video.pause() } catch (err) { /* 已卸载 */ } }
            if (layer !== null) layer.remove();
            layer = null; cssInner = null; video = null;
          }

          return { sync: sync, dispose: dispose, element: element };
        }

        /** 注入或替换一段样式；带 data-plugin* 标记，交给宿主按插件生命周期回收。 */
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

