// src/client/utils.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { luminance, parseColor, rgba } from '../../lib/color-core.js'

        /* ============================================================ */
        /* 零依赖小工具                                                   */
        /* ============================================================ */

        /* 颜色工具并入 lib/color-core.js 单一真源（D3 根治）：真 ESM import，
           构建期由 tsdown alwaysBundle 内联为一份。
           withAlphaCss 保留「var() 原样透传」语义（解析失败不换成透明黑，实测防线）。 */
        export var relativeLuminance = luminance;

        /** 只改不透明度，RGB 原样保留；解析不了（var(...) 等）就原样返回。 */
        export function withAlphaCss(value, alpha) {
          if (parseColor(value) === null) return value;
          return rgba(value, alpha);
        }

        export function humanBytes(bytes) {
          var n = Number(bytes);
          if (!Number.isFinite(n) || n <= 0) return '0 B';
          var units = ['B', 'KB', 'MB', 'GB', 'TB'];
          var i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
          var value = n / Math.pow(1024, i);
          return (value >= 100 ? Math.round(value) : Math.round(value * 10) / 10) + ' ' + units[i];
        }

        /**
         * media 字典查表。必须 hasOwn：media 是 JSON 反序列化的普通对象，
         * 'constructor'/'toString' 这类原型键取出的是函数不是素材元数据
         * （曾把 Object 构造函数当 meta 拼出 /media/undefined 的死视频）。
         */
        export function mediaLookup(media, id) {
          if (media === null || typeof media !== 'object') return undefined;
          return Object.hasOwn(media, id) ? media[id] : undefined;
        }

        /** 只存界面偏好（当前页签这类），主题数据一律在宿主。 */
        export function readLocal(key) {
          try { return window.localStorage.getItem(key) } catch (err) { return null }
        }

        export function writeLocal(key, value) {
          try { window.localStorage.setItem(key, String(value)) } catch (err) { /* 隐私模式：忽略 */ }
        }

