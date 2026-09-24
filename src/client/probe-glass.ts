// src/client/probe-glass.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { contrastRatio, rgba } from '../../lib/color-core.js'
import { readableGlassFloor } from './identity.ts'
import { relativeLuminance, withAlphaCss } from './utils.ts'

        /* ============================================================ */
        /* 令牌基准值探测：扫宿主样式表拿明/暗两套基准值                    */
        /* ============================================================ */

        /**
         * ui-theme 的令牌表是激活时注入的同源 <style>，cssRules 可枚举。
         * 一次扫出 body 与 body[data-ds-dark-theme] 两条规则里的全部自定义属性，
         * 就拿到"两套模式的基准值"——比临时切 data 属性再 getComputedStyle 可靠：
         * 不闪屏、不依赖当前模式。扫不到时退回现值，只保证当前模式准确。
         */
        export function createTokenProbe() {
          var cache = null;
          var nameCache = null;
          function safeRules(sheet) {
            try { return sheet.cssRules || null } catch (err) { return null }
          }
          function scan() {
            if (cache !== null) return cache;
            var light = {};
            var dark = {};
            try {
              var sheets = document.styleSheets;
              for (var i = 0; i < sheets.length; i += 1) {
                var rules = safeRules(sheets[i]);
                if (rules === null) continue;
                for (var j = 0; j < rules.length; j += 1) {
                  var rule = rules[j];
                  var selector = rule.selectorText;
                  if (typeof selector !== 'string' || !rule.style) continue;
                  var isDark = /\[data-ds-dark-theme\]/.test(selector);
                  var isLight = /(^|,)\s*body\s*(,|$)/.test(selector) && !isDark;
                  if (!isDark && !isLight) continue;
                  var target = isDark ? dark : light;
                  for (var k = 0; k < rule.style.length; k += 1) {
                    var name = rule.style[k];
                    if (name.indexOf('--') !== 0) continue;
                    var value = rule.style.getPropertyValue(name);
                    if (value) target[name] = value.trim();
                  }
                }
              }
            } catch (err) {
              /* 跨源样式表等极端情况：下面用 computed 兜底 */
            }
            cache = { light: light, dark: dark };
            return cache;
          }
          function live(name) {
            try { return getComputedStyle(document.body).getPropertyValue(name).trim() } catch (err) { return '' }
          }
          // 声明文本不解变量：body 规则里常是 var(--static-…) 引用，引用进了
          // withAlphaCss 会原样返回 —— 玻璃重铸在真实浏览器里就静默失效
          // （教训：测试 fixture 用裸 hex 把这个洞藏住了）。只收颜色字面量，
          // 其余交给 live()（getComputedStyle 给的是解析后的终值）。
          function isColorLiteral(value) {
            return typeof value === 'string'
              && (value.indexOf('#') === 0 || value.indexOf('rgb') === 0 || value.indexOf('hsl') === 0)
          }
          /**
           * 表内解析 var() 引用：design-platform 的 alias 层全是 var(--dsw-static-…) 形态
           * （实测 elevated-fill 玻璃失效的根因之一），static 层的字面量就在同一张表里，
           * 纯表内递归即可拿到基准，不闪屏也不依赖当前模式。
           */
          function resolveVar(value, scheme, depth) {
            if (typeof value !== 'string' || depth > 3) return '';
            var m = /^var\((--[a-z0-9-]+)\)$/i.exec(value.trim());
            if (!m) return value;
            return resolveVar(scan()[scheme][m[1]] || '', scheme, depth + 1);
          }
          return {
            of: function (name, scheme) {
              var found = resolveVar(scan()[scheme][name] || '', scheme, 0);
              if (isColorLiteral(found)) return found;
              if (liveScheme === scheme) {
                var value = live(name);
                // computed 兜底同样只收颜色字面量：var() 残留写回 override 等于玻璃失效。
                if (isColorLiteral(value)) return value;
              }
              var altLight = resolveVar(scan().light[name] || '', 'light', 0);
              if (isColorLiteral(altLight)) return altLight;
              var altDark = resolveVar(scan().dark[name] || '', 'dark', 0);
              return isColorLiteral(altDark) ? altDark : '';
            },
            names: function () {
              // 缓存清单：曾每次渲染都重建 600 项 Set + 排序（自定义令牌 datalist
              // 每次渲染现取），色彩页渲染密集时是白热开销。invalidate 时一并清。
              if (nameCache !== null) return nameCache;
              var found = scan();
              var set = new Set();
              Object.keys(found.light).forEach(function (k) { set.add(k) });
              Object.keys(found.dark).forEach(function (k) { set.add(k) });
              nameCache = Array.from(set).sort();
              return nameCache;
            },
            invalidate: function () { cache = null; nameCache = null },
          };
        }
        /* liveScheme 是跨模块可变状态（原单闭包共享）。ESM 的 import 绑定只读，
           故改为「本模块持有 + getter/setter 导出」，写入方走 setLiveScheme()。 */
        var liveScheme = 'light';
        export function getLiveScheme() { return liveScheme }
        export function setLiveScheme(next) { liveScheme = next }

        /** Host 给的令牌层可能只填了一侧（用户只改了深色），这里补成对：基准值优先，否则另一侧。 */
        export function fillTokenPairs(layers, probe) {
          var out = {};
          Object.keys(layers || {}).forEach(function (name) {
            var pair = layers[name] || {};
            var light = typeof pair.light === 'string' ? pair.light : '';
            var dark = typeof pair.dark === 'string' ? pair.dark : '';
            if (light === '' && dark === '') return;
            if (light === '') light = probe.of(name, 'light') || dark;
            if (dark === '') dark = probe.of(name, 'dark') || light;
            if (light === '' || dark === '') return;
            out[name] = { light: light, dark: dark };
          });
          return out;
        }

        /**
         * 玻璃质感：把表面基准色按 alpha 重铸；用户显式写过的令牌让位。
         * **对比自愈**：基准色与文字色对比不足 4.5:1 时翻到对比侧（白字配深玻璃、
         * 深字配浅玻璃）——否则"白底白字"整块隐形（设置面板/新会话实测都看不清）。
         */
        export function composeGlass(surfaces, doc, probe, explicit) {
          var out = {};
          if (!doc.glass || !doc.glass.enabled || doc.backdrop.mode === 'none') return out;
          var userTokens = explicit || {};
          var fgOf = function (scheme) {
            var own = userTokens['--dsw-alias-label-primary'];
            if (own && typeof own[scheme] === 'string' && own[scheme] !== '') return own[scheme];
            return probe.of('--dsw-alias-label-primary', scheme);
          };
          (surfaces || []).forEach(function (name) {
            if (userTokens[name] !== undefined) return;
            // ⚠️ input 族必须参与重铸（普通档 = 翻深毛玻璃色 rgba(16,20,24,α)）：
            // 退出重铸时基准是 #fff，busy 态输入卡没吃到 _card 规则就裸奔成大白板
            // （主人实测「执行中」输入框纯白）。任何用到 input-major 的元素都拿到
            // 毛玻璃深色，blur 由元素级规则补，配合才成"不透但毛玻璃"。
            var light = probe.of(name, 'light');
            var dark = probe.of(name, 'dark');
            if (light === '' && dark === '') return;
            // 输入类表面与小色块直接压字，浓度拉到可读档：跟随薄玻璃会让
            // 输入文字/placeholder 在亮壁纸上消失（输入框字看不清实测）。
            // 其余普通大表面仍跟随用户的面板透明度，保留"透"的观感。
            var floor = readableGlassFloor(name);
            var alpha = floor > 0
              ? Math.min(0.9, Math.max(doc.glass.alpha * 2.5, floor))
              : Math.min(0.9, doc.glass.alpha);
            out[name] = {
              light: glassColor(light === '' ? dark : light, fgOf('light'), alpha),
              dark: glassColor(dark === '' ? light : dark, fgOf('dark'), alpha),
            };
          });
          return out;
        }

        /** 玻璃基准 × alpha；与文字对比不足 4.5:1 就翻到对比侧。 */
        export function glassColor(bg, fg, alpha) {
          if (typeof bg !== 'string' || bg === '') return bg;
          if (fg !== '' && contrastRatio(bg, fg) >= 4.5) return withAlphaCss(bg, alpha);
          // 文字是浅色 ⇒ 表面翻深；文字是深色 ⇒ 表面翻浅。
          var wantDark = fg === '' ? true : relativeLuminance(fg) > 0.36;
          return withAlphaCss(wantDark ? 'rgb(16, 20, 24)' : 'rgb(250, 250, 252)', alpha);
        }

        /** 文字族对比自愈涉及的次级文字令牌（按层级给半透明度）。
         *  caption 是输入框 placeholder 的底色来源：0.62 太淡（输入字看不清实测），
         *  提到 0.82 保 placeholder 可读；其余档保持层次差。
         *  ⚠️ primary-dimmed / primary-bluish 是漏网暗字：白字主题下基准仍是
         *  #151517 / #0e3074 暗字，压深玻璃底看不见（排队消息预览"选择才看清"实测）。 */
        export var TEXT_FAMILY = {
          '--dsw-alias-label-primary-dimmed': 0.88,
          '--dsw-alias-label-primary-bluish': 0.85,
          '--dsw-alias-label-caption': 0.82,
          '--dsw-alias-label-secondary': 0.75,
          '--dsw-alias-label-tertiary': 0.55,
          '--dsw-alias-label-dimmed': 0.45,
        };

        /**
         * 文字族对比自愈：白字主题常只设 label-primary，次级文字留默认暗灰 ——
         * 暗字在深玻璃上完全不可读（产出卡"已输出 N 个文件"实测）。按主文字方向
         * 翻成同向半透明；用户显式写过的让位。
         */
        export function fixTextFamily(merged, userTokens, probe) {
          var own = userTokens || {};
          ['light', 'dark'].forEach(function (scheme) {
            var primary = own['--dsw-alias-label-primary'];
            var fg = (primary && typeof primary[scheme] === 'string' && primary[scheme] !== '')
              ? primary[scheme]
              : probe.of('--dsw-alias-label-primary', scheme);
            if (fg === '') return;
            var lightText = relativeLuminance(fg) > 0.36;
            Object.keys(TEXT_FAMILY).forEach(function (name) {
              if (own[name] !== undefined) return;
              if (!merged[name]) merged[name] = { light: '', dark: '' };
              merged[name][scheme] = withAlphaCss(
                lightText ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)', TEXT_FAMILY[name]);
            });
          });
        }

        /** diff 语义色的深色版（design-platform 深色行的值）。 */
        export var DIFF_FAMILY = {
          '--dsw-alias-file-diff-added-bg': 'rgb(31, 49, 36)',
          '--dsw-alias-file-diff-added-gutter': 'rgb(19, 32, 22)',
          '--dsw-alias-file-diff-added-marker': 'rgb(65, 201, 119)',
          '--dsw-alias-file-diff-deleted-bg': 'rgb(60, 31, 27)',
          '--dsw-alias-file-diff-deleted-gutter': 'rgb(40, 19, 14)',
          '--dsw-alias-file-diff-deleted-marker': 'rgb(250, 66, 62)',
        };

        /**
         * diff 语义色方向矫正：白字主题下浅绿/浅粉 diff 块与深玻璃格格不入、
         * 文字看不清（点文件展开实测）——翻成深色版（dark 分支本就是对的）；
         * 用户显式写过的让位。
         */
        export function fixDiffFamily(merged, userTokens, probe) {
          var own = userTokens || {};
          var primary = own['--dsw-alias-label-primary'];
          var fg = (primary && typeof primary.light === 'string' && primary.light !== '')
            ? primary.light
            : probe.of('--dsw-alias-label-primary', 'light');
          if (fg === '' || relativeLuminance(fg) <= 0.36) return;
          Object.keys(DIFF_FAMILY).forEach(function (name) {
            if (own[name] !== undefined) return;
            merged[name] = { light: DIFF_FAMILY[name], dark: DIFF_FAMILY[name] };
          });
        }

