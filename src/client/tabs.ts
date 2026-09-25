// src/client/tabs.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { clamp, toHex } from '../../lib/color-core.js'
import { P, React, e, useEffect, useRef, useState } from './deps.ts'
import { t } from './i18n.ts'
import { uiButton, uiPill, uiSwitch } from './primitives.ts'
import { humanBytes, mediaLookup } from './utils.ts'

        /* ============================================================ */

        /**
         * 面板图标。导航项图标无法自定义（ui-settings-general 的 navIcon 是硬编码表，
         * settings.section 注册项也没有 icon 字段），所以只画在标题与浮动按钮上。
         */
        export var ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" '
          + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
          + '<path d="M8 1.9a6.1 6.1 0 1 0 0 12.2c1 0 1.6-.7 1.6-1.5 0-.4-.2-.7-.4-1-.2-.3-.3-.5-.3-.9 0-.8.6-1.4 1.5-1.4h1.2'
          + 'a2.5 2.5 0 0 0 2.5-2.5c0-2.7-2.6-4.9-6.1-4.9Z"/>'
          + '<circle cx="4.6" cy="6.6" r=".95" fill="currentColor" stroke="none"/>'
          + '<circle cx="7.6" cy="4.4" r=".95" fill="currentColor" stroke="none"/>'
          + '<circle cx="10.9" cy="6.2" r=".95" fill="currentColor" stroke="none"/></svg>';

        export function Svg() {
          return e('span', { 'aria-hidden': 'true', style: { display: 'inline-flex' }, dangerouslySetInnerHTML: { __html: ICON } })
        }

        /** 数组 children 统一补 key 并剔除 null 分支。 */
        export function keyed(children) {
          if (!Array.isArray(children)) return children;
          var out = [];
          for (var i = 0; i < children.length; i += 1) {
            var child = children[i];
            if (child === null || child === undefined || child === false) continue;
            if (Array.isArray(child)) { out = out.concat(keyed(child)); continue }
            out.push(child.key === null || child.key === undefined ? React.cloneElement(child, { key: 'k' + i }) : child);
          }
          return out;
        }

        export function Group(props) {
          return e('div', { className: 'dts-group' },
            props.title ? e('h4', null, props.title) : null,
            keyed(props.children),
            props.hint ? e('p', { className: 'dts-hint' }, props.hint) : null)
        }

        export function Row(props) {
          return e('div', { className: 'dts-row' },
            e('label', null, props.label),
            e('div', { style: { minWidth: 0 } }, keyed(props.children)),
            props.tail ? e('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, keyed(props.tail)) : null)
        }

        export function Slider(props) {
          return e('div', { className: 'dts-range' },
            e('input', {
              type: 'range', min: props.min, max: props.max,
              step: props.step === undefined ? 1 : props.step,
              value: props.value, 'aria-label': props.label,
              onChange: function (event) { props.onChange(Number(event.target.value)) },
            }),
            e('output', null, props.format ? props.format(props.value) : (props.value + (props.suffix || ''))))
        }

        /**
         * 下拉选择（自绘）：原生 <select> 弹层是系统 UI，吃不到毛玻璃，主题里很突兀
         * （主人实测「选项这里没同步」）。弹层用设置弹窗同款毛玻璃自绘，质感全局统一。
         * 键盘契约对齐官方 Menu（ui-primitives/Menu.tsx 就地核验）：↑↓ wrap 移动、
         * Home/End 首尾、Enter/Space 选中、Esc/Shift+Tab 关闭并把焦点交还触发器、
         * Tab 确认当前项收起（“Tab settles like Enter”）。
         * ⚠️ 本组件有 hooks：调用一律 e(Choice, {…})，禁止直调（有回归锁）。
         */
        export function Choice(props) {
          var openState = useState(false);
          var open = openState[0], setOpen = openState[1];
          var activeState = useState(0);
          var active = activeState[0], setActive = activeState[1];
          var rootRef = useRef(null);
          var triggerRef = useRef(null);
          var options = props.options || [];
          var count = options.length;
          /** @type {any} 初值 null + 回调赋值：不标注会被 CFA 推断成 never。 */
          var current = null;
          options.forEach(function (option) { if (option.value === props.value) current = option });

          function closeToTrigger(back) {
            setOpen(false);
            if (back && triggerRef.current && typeof triggerRef.current.focus === 'function') triggerRef.current.focus();
          }
          function commitAt(index) {
            var option = options[index];
            if (!option) return;
            setOpen(false);
            if (option.value !== props.value) props.onChange(option.value);
          }
          function focusIndex(index) {
            setActive(index);
            var node = rootRef.current && typeof rootRef.current.querySelector === 'function'
              ? rootRef.current.querySelector('[data-index="' + String(index) + '"]')
              : null;
            if (node && typeof node.focus === 'function') node.focus();
          }

          useEffect(function () {
            if (!open) return undefined;
            function onDocDown(event) {
              var node = rootRef.current;
              if (node && event.target && !node.contains(event.target)) setOpen(false);
            }
            document.addEventListener('mousedown', onDocDown);
            return function () { document.removeEventListener('mousedown', onDocDown) };
          }, [open]);

          function onRootKey(event) {
            if (!open) {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                var from = 0;
                options.forEach(function (option, i) { if (option.value === props.value) from = i });
                setActive(from);
                setOpen(true);
                window.setTimeout(function () { focusIndex(from) }, 0);
              }
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeToTrigger(true);
              return;
            }
            if (event.key === 'Tab') {
              // Menu 语义：Shift+Tab 像 Esc（关并回触发器）；Tab 确认当前项收起。
              if (event.shiftKey) {
                event.preventDefault();
                closeToTrigger(true);
              } else if (options[active]) {
                commitAt(active);
              }
              return;
            }
            if (count === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusIndex((active + 1) % count);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusIndex((active - 1 + count) % count);
            } else if (event.key === 'Home') {
              event.preventDefault();
              focusIndex(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              focusIndex(count - 1);
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              commitAt(active);
            }
          }

          return e('div', { className: 'dts-select', ref: rootRef, onKeyDown: onRootKey },
            e('button', {
              type: 'button', className: 'dts-input dts-select-trigger',
              'aria-haspopup': 'listbox', 'aria-expanded': open ? 'true' : 'false',
              'aria-label': props.label, title: current ? current.label : props.label,
              ref: triggerRef,
              onClick: function () {
                if (open) { closeToTrigger(false); return }
                var from = 0;
                options.forEach(function (option, i) { if (option.value === props.value) from = i });
                setActive(from);
                setOpen(true);
              },
            },
              e('span', { className: 'dts-select-text' }, current ? current.label : ''),
              e('span', { className: 'dts-select-caret', 'aria-hidden': 'true' }, '⌄')),
            open ? e('div', { className: 'dts-select-menu', role: 'listbox', 'aria-label': props.label },
              options.map(function (option, index) {
                var selected = option.value === props.value;
                return e('button', {
                  key: option.value, type: 'button', role: 'option', 'data-index': String(index),
                  'aria-selected': selected ? 'true' : 'false',
                  className: 'dts-select-option', 'data-selected': selected ? 'true' : 'false',
                  onFocus: function () { setActive(index) },
                  onClick: function () { commitAt(index) },
                }, option.label)
              })) : null)
        }

        /** 开关一律用 Switch（官方缺失时退回自绘），文字标签由外层 Row 给。 */
        export function Toggle(props) {
          return uiSwitch({
            checked: props.checked,
            label: props.label,
            title: props.title,
            onChange: props.onChange,
          })
        }

        export function ColorField(props) {
          var value = props.value || '';
          return e('div', { className: 'dts-color' },
            e('input', {
              type: 'color', value: value === '' ? '#808080' : toHex(value), 'aria-label': props.label,
              onChange: function (event) { props.onChange(event.target.value) },
            }),
            uiInput({
              className: 'dts-input', style: { flex: 1 }, value: value, placeholder: '#rrggbb',
              spellCheck: false, 'aria-label': props.label,
              onChange: function (event) { props.onChange(event.target.value.trim()) },
            }),
            value !== '' ? uiButton({
              variant: 'ghost', ariaLabel: props.label, title: props.clearLabel,
              onClick: function () { props.onChange('') }, children: '×',
            }) : null)
        }

        /**
         * 官方 Input 的 className 落外层 wrapper、其余属性透传给内层 input（Input.tsx），
         * 直接把 style 透进去只作用到内层、flex 布局吃不到 —— 包一层承接布局样式。
         */
        export function uiInput(props) {
          if (P.Input) {
            var inner = Object.assign({}, props);
            delete inner.style;
            return e('span', { className: 'dts-input-flex', style: props.style }, e(P.Input, inner))
          }
          return e('input', props)
        }

        /** 确认框：Esc = 取消，Enter = 确认，焦点落在最后一个（确认）按钮上。 */
        export function ConfirmDialog(props) {
          var cardRef = useRef(null);
          useEffect(function () {
            var onKey = function (event) {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                props.onDone(false);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                props.onDone(true);
              } else if (event.key === 'Tab') {
                // 焦点陷阱对齐官方 ImageLightbox（就地核验）：Tab 圈闭在对话框内，
                // 不允许跑到背后的界面。stopPropagation 还要挡住外层模态卡的
                // 同名陷阱 —— 两个处理器都跑会把一次 Tab 走两步（实测）。
                event.preventDefault();
                event.stopPropagation();
                var nodes = cardRef.current && typeof cardRef.current.querySelectorAll === 'function'
                  ? Array.prototype.slice.call(cardRef.current.querySelectorAll('button')) : [];
                if (nodes.length === 0) return;
                var at = nodes.indexOf(document.activeElement);
                var nextAt = event.shiftKey
                  ? (at <= 0 ? nodes.length - 1 : at - 1)
                  : (at === nodes.length - 1 || at === -1 ? 0 : at + 1);
                if (typeof nodes[nextAt].focus === 'function') nodes[nextAt].focus();
              }
            };
            document.addEventListener('keydown', onKey, true);
            var timer = setTimeout(function () {
              var buttons = cardRef.current ? cardRef.current.querySelectorAll('button') : [];
              var last = buttons[buttons.length - 1];
              if (last && last.focus) last.focus();
            }, 30);
            return function () {
              document.removeEventListener('keydown', onKey, true);
              clearTimeout(timer);
            };
          }, []);
          return e('div', {
            className: 'dts-scrim',
            onClick: function (event) { if (event.target === event.currentTarget) props.onDone(false) },
          }, e('div', {
            className: 'dts-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title, ref: cardRef,
          },
            e('h3', null, props.title),
            (props.lines || []).filter(function (line) { return line !== '' }).map(function (line, index) {
              return e('div', {
                key: index, className: 'dts-dialog-line',
                'data-kind': /[\\/]/.test(line) ? 'path' : 'text',
              }, line)
            }),
            e('div', { className: 'dts-dialog-foot' },
              uiButton({ variant: 'ghost', onClick: function () { props.onDone(false) }, children: props.cancelLabel }),
              uiButton({ variant: props.tone === 'danger' ? 'danger' : 'primary', onClick: function () { props.onDone(true) }, children: props.confirmLabel }))))
        }

        export function FocusPad(props) {
          var boxRef = useRef(null);
          function pick(event) {
            var box = boxRef.current;
            if (box === null) return;
            var rect = box.getBoundingClientRect();
            props.onChange(
              Math.round(clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100)),
              Math.round(clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, 0, 100)));
          }
          return e('div', {
            ref: boxRef, className: 'dts-focus',
            style: Object.assign(
              {},
              props.src ? { backgroundImage: 'url("' + props.src + '")' } : null,
              { '--fx': props.x + '%', '--fy': props.y + '%' },
            ),
            onPointerDown: function (event) {
              event.preventDefault();
              if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
              pick(event);
            },
            onPointerMove: function (event) { if (event.buttons === 1) pick(event) },
          })
        }

        /** 预设/渐变缩略图：只画小卡片，真样式一律来自宿主投影。 */
        export var THUMBS = {
          midnight: 'linear-gradient(160deg,#05070f,#0f1b3d,#25264a)',
          aurora: 'linear-gradient(135deg,#0b1b3a,#123a5c,#1d6f6a,#7ad0c1)',
          sunset: 'linear-gradient(180deg,#1a0b2e,#7b2d58,#e0763c,#f5c26b)',
          ink: 'linear-gradient(145deg,#0d0d10,#1c1f26,#2b3040)',
          paper: 'linear-gradient(160deg,#f7f2e7,#ece2cf,#e3d6bd)',
          sakura: 'linear-gradient(150deg,#2a1020,#743057,#d98a9c,#f7d9d9)',
          forest: 'linear-gradient(155deg,#04120c,#0d3b2a,#2f7a52,#8fc98f)',
          cyber: 'linear-gradient(120deg,#05010f,#1b0b3a,#4a0f6b,#00e5ff)',
          ember: 'linear-gradient(150deg,#150606,#3d1010,#8c2f18,#e0a24c)',
          orchid: 'linear-gradient(140deg,#0a0714,#1e1140,#43237a,#8b6ff0)',
        };

        export function gradientThumb(name: any, fallback?: any) {
          if (Object.hasOwn(THUMBS, name)) return THUMBS[name];
          if (!fallback || !Array.isArray(fallback.stops)) return THUMBS.midnight;
          return 'linear-gradient(' + (fallback.angle || 135) + 'deg, ' + fallback.stops.join(', ') + ')';
        }

        /* -------------------------------------------------------- 预设页 */

        export function PresetTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var presets = env.state.presets || [];
          return e('div', { className: 'dts-body' },
            Group({
              title: tt('base.scheme'), hint: tt('base.hint'),
              children: [
                Row({
                  label: tt('base.scheme'),
                  children: e(Choice, {
                    label: tt('base.scheme'), value: doc.base.scheme,
                    options: [
                      { value: 'system', label: tt('base.system') },
                      { value: 'light', label: tt('base.light') },
                      { value: 'dark', label: tt('base.dark') },
                    ],
                    onChange: function (value) { env.patch(function (d) { d.base.scheme = value }) },
                  }),
                }),
                Row({
                  label: tt('base.fontSize'),
                  children: Slider({
                    label: tt('base.fontSize'), min: 12, max: 17, value: doc.base.fontSize, suffix: 'px',
                    onChange: function (value) { env.patch(function (d) { d.base.fontSize = value }) },
                  }),
                }),
              ],
            }),
            Group({
              title: tt('tab.presets'), hint: tt('preset.note'),
              children: e('div', { className: 'dts-swatches' }, presets.map(function (preset) {
                var art = preset.accent === '' ? 'linear-gradient(135deg,#f5f6f7,#dfe3e8)' : gradientThumb(preset.gradient);
                return e('button', {
                  key: preset.id, type: 'button', className: 'dts-swatch',
                  'aria-pressed': doc.preset === preset.id ? 'true' : 'false',
                  onClick: function () { void env.applyPreset(preset.id) },
                },
                  e('span', {
                    className: 'dts-swatch-art',
                    style: { background: art, boxShadow: preset.accent === '' ? undefined : 'inset 0 -3px 0 0 ' + preset.accent },
                  }),
                  e('span', { className: 'dts-swatch-name' }, preset.name),
                  e('span', { className: 'dts-swatch-note' }, preset.note || preset.id))
              })),
            }))
        }

        /* -------------------------------------------------------- 上传区 */

        export function Uploader(props) {
          var env = props.env, tt = props.t;
          var inputRef = useRef(null);
          var hot = useState(false);
          var busy = useState('');
          function pick() { if (inputRef.current) inputRef.current.click() }
          function handle(files) {
            var list = Array.prototype.slice.call(files || []);
            if (list.length === 0) return;
            busy[1]('uploading');
            var done = 0;
            list.reduce(function (chain, file) {
              return chain.then(function () {
                return env.upload(file).then(
                  function (value) { done += 1; return value },
                  // 失败提示由 env.upload 统一发（曾在这再发一次，一文件双 toast）；
                  // 这里静默吞掉，让后续文件继续传。
                  function () { /* already notified */ })
              })
            }, Promise.resolve()).then(function () {
              busy[1]('');
              if (done > 0) env.notify(tt('common.uploaded') + ' ×' + done, 'ok');
            });
          }
          return e('div', null,
            e('div', {
              className: 'dts-drop', 'data-hot': hot[0] ? 'true' : 'false', role: 'button', tabIndex: 0,
              onClick: pick,
              onKeyDown: function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick() } },
              onDragOver: function (event) { event.preventDefault(); hot[1](true) },
              onDragLeave: function () { hot[1](false) },
              onDrop: function (event) { event.preventDefault(); hot[1](false); handle(event.dataTransfer && event.dataTransfer.files) },
            }, busy[0] === 'uploading' ? tt('common.uploading') : tt('common.dropHere')),
            e('input', {
              ref: inputRef, type: 'file', multiple: true, hidden: true, accept: props.accept,
              onChange: function (event) { handle(event.target.files); event.target.value = '' },
            }))
        }

        /* -------------------------------------------------------- 背景页 */

        export function BackdropTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var b = doc.backdrop;
          var media = env.state.media || {};
          var meta = mediaLookup(media, b.mediaId);
          var src = meta ? env.mediaUrl(meta) : '';
          var isMedia = b.mode === 'image' || b.mode === 'video';

          function set(field, value) { env.patch(function (d) { d.backdrop[field] = value }) }
          function setVideo(field, value) { env.patch(function (d) { d.backdrop.video[field] = value }) }
          function range(labelKey: any, min: any, max: any, field: any, suffix?: any, step?: any, format?: any) {
            return Row({
              label: tt(labelKey),
              children: Slider({
                label: tt(labelKey), min: min, max: max, value: b[field], suffix: suffix,
                step: step === undefined ? (suffix ? 1 : 0.05) : step, format: format,
                onChange: function (v) { set(field, v) },
              }),
            })
          }

          var options = [{ value: '', label: tt('color.noToken') }];
          var want = b.mode === 'video' ? 'video' : 'image';
          Object.keys(media).forEach(function (id) {
            if (media[id].kind === want) options.push({ value: id, label: media[id].name });
          });

          return e('div', { className: 'dts-body' },
            Group({
              title: tt('backdrop.mode'), hint: tt('backdrop.hint'),
              children: [
                Row({
                  label: tt('backdrop.mode'),
                  children: e(Choice, {
                    label: tt('backdrop.mode'), value: b.mode,
                    options: [
                      { value: 'none', label: tt('common.none') },
                      { value: 'image', label: tt('common.image') },
                      { value: 'video', label: tt('common.video') },
                      { value: 'gradient', label: tt('common.gradient') },
                    ],
                    onChange: function (v) { env.setBackdropMode(v) },
                  }),
                }),
                isMedia
                  ? (options.length === 1
                    ? e('p', { className: 'dts-note', 'data-tone': 'warn' }, tt('common.empty'))
                    : Row({
                      label: tt('backdrop.pick'),
                      children: e(Choice, { label: tt('backdrop.pick'), value: b.mediaId, options: options, onChange: function (v) { set('mediaId', v) } }),
                    }))
                  : null,
                b.mode === 'gradient' ? e('div', { className: 'dts-swatches' }, Object.keys(env.state.gradients || {}).map(function (name) {
                  var gradient = env.state.gradients[name];
                  return e('button', {
                    key: name, type: 'button', className: 'dts-swatch',
                    'aria-pressed': b.gradient === name ? 'true' : 'false',
                    onClick: function () { set('gradient', name) },
                  },
                    e('span', { className: 'dts-swatch-art', style: { background: gradientThumb(name, gradient) } }),
                    e('span', { className: 'dts-swatch-name' }, gradient.label || name))
                })) : null,
                isMedia ? e(Uploader, { env: env, t: tt, accept: want + '/*' }) : null,
              ],
            }),

            b.mode === 'image' ? Group({
              title: tt('backdrop.fit'),
              children: [
                Row({
                  label: tt('backdrop.fit'),
                  children: e(Choice, {
                    label: tt('backdrop.fit'), value: b.fit,
                    options: [{ value: 'cover', label: tt('backdrop.cover') }, { value: 'contain', label: tt('backdrop.contain') }],
                    onChange: function (v) { set('fit', v) },
                  }),
                }),
                Row({ label: tt('backdrop.tile'), children: Toggle({ checked: b.tile, label: tt('backdrop.tile'), onChange: function (v) { set('tile', v) } }) }),
                range('backdrop.scale', 0.5, 4, 'scale', '', 0.05, function (v) { return (Math.round(v * 100) / 100) + '×' }),
                Row({
                  label: tt('backdrop.focus'),
                  tail: e('span', { className: 'dts-card-meta' }, 'X ' + b.focusX + '% · Y ' + b.focusY + '%'),
                  children: e(FocusPad, {
                    src: src, x: b.focusX, y: b.focusY,
                    onChange: function (x, y) { env.patch(function (d) { d.backdrop.focusX = x; d.backdrop.focusY = y }) },
                  }),
                }),
                e('p', { className: 'dts-hint' }, tt('backdrop.focusHint')),
              ],
            }) : null,

            isMedia ? Group({
              title: tt('backdrop.filters'),
              children: [
                range('backdrop.blur', 0, 40, 'blur', 'px'),
                range('backdrop.brightness', 20, 220, 'brightness', '%'),
                range('backdrop.saturate', 0, 300, 'saturate', '%'),
                range('backdrop.contrast', 20, 300, 'contrast', '%'),
                range('backdrop.grayscale', 0, 100, 'grayscale', '%'),
                range('backdrop.sepia', 0, 100, 'sepia', '%'),
                range('backdrop.hueRotate', -180, 180, 'hueRotate', '°'),
              ],
            }) : null,

            b.mode !== 'none' ? Group({
              title: tt('backdrop.veil'),
              children: [
                Row({
                  label: tt('backdrop.dim'),
                  children: Slider({
                    label: tt('backdrop.dim'), min: 0, max: 0.95, step: 0.01, value: b.dim,
                    format: function (v) { return Math.round(v * 100) + '%' },
                    onChange: function (v) { set('dim', v) },
                  }),
                }),
                Row({
                  label: tt('backdrop.veilColor'),
                  children: ColorField({
                    label: tt('backdrop.veilColor'), value: b.veilColor, clearLabel: tt('color.clear'),
                    onChange: function (v) { set('veilColor', v) },
                  }),
                }),
                Row({ label: tt('backdrop.veilGradient'), children: Toggle({ checked: b.veilGradient, label: tt('backdrop.veilGradient'), onChange: function (v) { set('veilGradient', v) } }) }),
              ],
            }) : null,

            b.mode !== 'none' ? Group({
              title: tt('backdrop.motion'),
              children: [
                Row({
                  label: tt('backdrop.kenBurns'),
                  children: Toggle({ checked: b.kenBurns, label: tt('backdrop.kenBurns'), onChange: function (v) { set('kenBurns', v) } }),
                  tail: Slider({
                    label: tt('backdrop.kenBurnsSeconds'), min: 8, max: 240, step: 2, value: b.kenBurnsSeconds,
                    format: function (v) { return v + 's' },
                    onChange: function (v) { set('kenBurnsSeconds', v) },
                  }),
                }),
                range('backdrop.parallax', 0, 60, 'parallax', ''),
                Row({ label: tt('backdrop.fadeOnFocus'), children: Toggle({ checked: b.fadeOnFocus, label: tt('backdrop.fadeOnFocus'), onChange: function (v) { set('fadeOnFocus', v) } }) }),
              ],
            }) : null,

            b.mode === 'video' ? Group({
              title: tt('backdrop.videoTitle'),
              children: [
                Row({ label: tt('backdrop.muted'), children: Toggle({ checked: b.video.muted, label: tt('backdrop.muted'), onChange: function (v) { setVideo('muted', v) } }) }),
                Row({ label: tt('backdrop.loop'), children: Toggle({ checked: b.video.loop, label: tt('backdrop.loop'), onChange: function (v) { setVideo('loop', v) } }) }),
                Row({ label: tt('backdrop.autoplay'), children: Toggle({ checked: b.video.autoplay, label: tt('backdrop.autoplay'), onChange: function (v) { setVideo('autoplay', v) } }) }),
                Row({
                  label: tt('backdrop.playbackRate'),
                  children: Slider({
                    label: tt('backdrop.playbackRate'), min: 0.25, max: 2, step: 0.05, value: b.video.playbackRate,
                    format: function (v) { return (Math.round(v * 100) / 100) + '×' },
                    onChange: function (v) { setVideo('playbackRate', v) },
                  }),
                }),
              ],
            }) : null,

            b.mode !== 'none' ? Group({
              title: tt('glass.enabled'), hint: tt('glass.hint'),
              children: [
                Row({ label: tt('glass.enabled'), children: Toggle({ checked: doc.glass.enabled, label: tt('glass.enabled'), onChange: function (v) { env.patch(function (d) { d.glass.enabled = v }) } }) }),
                Row({
                  label: tt('glass.alpha'),
                  children: Slider({
                    label: tt('glass.alpha'), min: 0.15, max: 1, step: 0.01, value: doc.glass.alpha,
                    format: function (v) { return Math.round(v * 100) + '%' },
                    onChange: function (v) { env.patch(function (d) { d.glass.alpha = v }) },
                  }),
                }),
                Row({ label: tt('glass.blur'), children: Slider({ label: tt('glass.blur'), min: 0, max: 60, value: doc.glass.blur, suffix: 'px', onChange: function (v) { env.patch(function (d) { d.glass.blur = v }) } }) }),
                Row({ label: tt('glass.saturate'), children: Slider({ label: tt('glass.saturate'), min: 100, max: 300, step: 5, value: doc.glass.saturate, suffix: '%', onChange: function (v) { env.patch(function (d) { d.glass.saturate = v }) } }) }),
              ],
            }) : null)
        }

        /* -------------------------------------------------------- 素材库 */

        export function LibraryTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var media = env.state.media || {};
          var list = Object.keys(media).map(function (id) { return media[id] })
            .sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0) });
          return e('div', { className: 'dts-body' },
            e(Uploader, { env: env, t: tt, accept: 'image/*,video/*,.woff,.woff2,.ttf,.otf' }),
            list.length === 0
              ? e('p', { className: 'dts-note' }, tt('common.empty'))
              : e('div', { className: 'dts-library' }, list.map(function (item) {
                var active = doc.backdrop.mediaId === item.id;
                return e('div', { key: item.id, className: 'dts-card' },
                  item.kind === 'video'
                    ? e('video', { className: 'dts-thumb', src: env.mediaUrl(item), muted: true, playsInline: true, preload: 'metadata' })
                    : item.kind === 'font'
                      ? e('div', { className: 'dts-thumb', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 } }, 'Ag 字')
                      : e('img', { className: 'dts-thumb', src: env.mediaUrl(item), alt: item.name, loading: 'lazy', decoding: 'async' }),
                  e('div', { className: 'dts-card-body' },
                    e('div', { className: 'dts-card-name', title: item.name }, item.name),
                    e('div', { className: 'dts-card-meta' },
                      item.kind + ' · ' + humanBytes(item.bytes) + (item.width ? ' · ' + item.width + '×' + item.height : ''))),
                  e('div', { className: 'dts-card-actions' },
                    item.kind === 'font'
                      ? uiButton({ variant: 'ghost', size: 'sm', onClick: function () { env.useAsFont(item) }, children: tt('type.useFamily') })
                      : uiButton({
                        variant: active ? 'primary' : 'ghost',
                        size: 'sm',
                        // 统一走 activateBackdrop：开壁纸的同时把表面透亮化，否则壁纸会被不透明面板整个盖住。
                        onClick: function () { env.activateBackdrop(item.kind, item.id) },
                        children: tt('common.use'),
                      }),
                    uiButton({ variant: 'ghost', size: 'sm', onClick: function () { env.askDelete(item) }, children: tt('common.delete') })))
              })))
        }

        /* -------------------------------------------------------- 色彩页 */

        export function ContrastReadout(props) {
          var ratio = props.env.textContrast(props.scheme);
          var level = ratio >= 7 ? 'ok' : (ratio >= 4.5 ? '' : 'bad');
          return e('div', { className: 'dts-contrast' },
            e('span', null, props.t('color.contrast')),
            e('span', { className: 'dts-badge', 'data-level': level }, (Math.round(ratio * 100) / 100) + ':1'))
        }

        export function ColorTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var groups = env.state.tokenGroups || [];
          var filter = useState('');
          var scheme = doc.base.scheme === 'light' ? 'light' : (doc.base.scheme === 'dark' ? 'dark' : env.liveScheme());
          var tokens = doc.palette.tokens || {};
          var used = Object.keys(tokens);
          var extras = used.filter(function (name) { return !env.isKnownToken(name) });

          function setValue(name, side, value) {
            env.patch(function (d) {
              var current = d.palette.tokens[name] || { light: '', dark: '' };
              var next = { light: current.light || '', dark: current.dark || '' };
              next[side] = value;
              if (next.light === '' && next.dark === '') delete d.palette.tokens[name];
              else d.palette.tokens[name] = next;
            })
          }
          function addCustom(name) {
            if (name === '') return;
            env.patch(function (d) {
              if (!d.palette.tokens[name]) d.palette.tokens[name] = { light: '', dark: '' };
            })
          }

          return e('div', { className: 'dts-body' },
            Group({
              title: tt('color.accent'), hint: tt('color.accentHint'),
              children: [
                Row({
                  label: tt('color.accent'),
                  children: ColorField({
                    label: tt('color.accent'), value: doc.palette.accent, clearLabel: tt('color.clear'),
                    onChange: function (v) { env.patch(function (d) { d.palette.accent = v }) },
                  }),
                }),
                Row({
                  label: tt('color.autoAccent'),
                  children: Toggle({
                    checked: doc.palette.autoAccent, label: tt('color.autoAccent'),
                    onChange: function (v) { env.patch(function (d) { d.palette.autoAccent = v }) },
                  }),
                  tail: uiButton({ variant: 'ghost', onClick: function () { void env.sampleAccent() }, children: tt('color.fromImage') }),
                }),
              ],
            }),
            Group({
              title: tt('color.groups'), hint: tt('color.contrastHint'),
              children: e('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
                e('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
                  e('input', {
                    className: 'dts-input', placeholder: '--dsw-…', value: filter[0], 'aria-label': tt('color.groups'),
                    // 不过滤输入本身：trim 会让空格永远打不进去；匹配时再收口。
                    onChange: function (event) { filter[1](event.target.value) },
                  }),
                  ContrastReadout({ env: env, t: tt, scheme: scheme })),
                groups.map(function (group) {
                  var needle = filter[0].trim().toLowerCase();
                  var rows = group.tokens.filter(function (item) {
                    if (needle === '') return true;
                    return item.name.toLowerCase().indexOf(needle) >= 0 || String(item.label || '').toLowerCase().indexOf(needle) >= 0;
                  });
                  if (rows.length === 0) return null;
                  return e('div', { key: group.id },
                    e('h4', { className: 'dts-card-meta', style: { margin: '8px 0 6px' } }, group.label),
                    rows.map(function (item) {
                      var pair = tokens[item.name];
                      return e('div', { key: item.name, className: 'dts-token-row', style: { marginBottom: 6 } },
                        e('div', { className: 'dts-token-name', title: item.name }, item.label || item.name),
                        e('div', { className: 'dts-pair' }, e('span', { className: 'dts-pair-label' }, tt('color.light')), ColorField({
                          label: item.name + ' ' + tt('color.light'), value: (pair && pair.light) || '',
                          clearLabel: tt('color.clear'), onChange: function (v) { setValue(item.name, 'light', v) },
                        })),
                        e('div', { className: 'dts-pair' }, e('span', { className: 'dts-pair-label' }, tt('color.dark')), ColorField({
                          label: item.name + ' ' + tt('color.dark'), value: (pair && pair.dark) || '',
                          clearLabel: tt('color.clear'), onChange: function (v) { setValue(item.name, 'dark', v) },
                        })),
                        // 恒渲染第 4 子项（无值时隐形占位）：独立 grid 行间轨道才对齐。
                        e('span', { className: 'dts-clear-slot', 'data-empty': pair ? undefined : 'true' },
                          uiButton({
                            variant: 'ghost',
                            onClick: function () { env.patch(function (d) { delete d.palette.tokens[item.name] }) },
                            children: tt('color.clear'),
                          })))
                    }))
                }),
                e('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 } },
                  extras.map(function (name) {
                    return e('div', { key: name, className: 'dts-token-row' },
                      e('div', { className: 'dts-token-name', title: name }, name),
                      e('div', { className: 'dts-pair' }, e('span', { className: 'dts-pair-label' }, tt('color.light')), ColorField({
                        label: name + ' ' + tt('color.light'), value: tokens[name].light || '',
                        clearLabel: '×', onChange: function (v) { setValue(name, 'light', v) },
                      })),
                      e('div', { className: 'dts-pair' }, e('span', { className: 'dts-pair-label' }, tt('color.dark')), ColorField({
                        label: name + ' ' + tt('color.dark'), value: tokens[name].dark || '',
                        clearLabel: '×', onChange: function (v) { setValue(name, 'dark', v) },
                      })),
                      uiButton({
                        variant: 'ghost',
                        onClick: function () { env.patch(function (d) { delete d.palette.tokens[name] }) },
                        children: tt('color.clear'),
                      }))
                  }),
                  e(CustomTokenAdder, { env: env, t: tt, onAdd: addCustom }))),
            }));
        }

        /**
         * 自定义令牌添加行。
         * 草稿必须是**组件内状态**：设置页与模态同时打开时就是两个实例，
         * 放模块级共享对象会互相串字；而且原先 `value: ''` 写死，
         * 输入框根本显示不出用户敲的字。
         */
        export function CustomTokenAdder(props) {
          var env = props.env, tt = props.t;
          var draft = useState('');
          function add() {
            var name = String(draft[0] || '').trim();
            if (name === '') return;
            props.onAdd(name);
            draft[1]('');
          }
          return e('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
            e('input', {
              className: 'dts-input', placeholder: tt('color.customName'), value: draft[0],
              list: 'dts-token-list', 'aria-label': tt('color.custom'), spellCheck: false,
              onChange: function (event) { draft[1](event.target.value) },
              onKeyDown: function (event) {
                if (event.key === 'Enter') { event.preventDefault(); add() }
              },
            }),
            uiButton({ variant: 'ghost', onClick: add, children: tt('color.customAdd') }),
            e('datalist', { id: 'dts-token-list' }, env.tokenNames().slice(0, 600).map(function (name) {
              return e('option', { key: name, value: name })
            })))
        }

        /* -------------------------------------------------------- 文字页 */

        /** 字体采用 pill 的开合语义：已采用再点 = 恢复宿主默认（曾会重复前置同名族）。 */
        function toggleFamily(doc: any, family: any, field: any) {
          var quoted = '"' + family + '"';
          if (String(doc.type[field]).indexOf(family) >= 0) {
            doc.type[field] = '';
            return;
          }
          doc.type[field] = quoted + ', ' + (field === 'codeFont' ? 'monospace' : (doc.type[field] || 'sans-serif'));
        }

        export function TypeTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var families = doc.type.families || [];
          return e('div', { className: 'dts-body' },
            Group({
              title: tt('type.uiFont'), hint: tt('type.hint'),
              children: [
                Row({
                  label: tt('type.uiFont'),
                  children: e('input', {
                    className: 'dts-input', value: doc.type.uiFont, spellCheck: false, 'aria-label': tt('type.uiFont'),
                    onChange: function (event) { env.patch(function (d) { d.type.uiFont = event.target.value }) },
                  }),
                }),
                Row({
                  label: tt('type.codeFont'),
                  children: e('input', {
                    className: 'dts-input', value: doc.type.codeFont, spellCheck: false, 'aria-label': tt('type.codeFont'),
                    onChange: function (event) { env.patch(function (d) { d.type.codeFont = event.target.value }) },
                  }),
                }),
                Row({
                  label: tt('type.letterSpacing'),
                  children: Slider({
                    label: tt('type.letterSpacing'), min: -1, max: 4, step: 0.05, value: doc.type.letterSpacing,
                    format: function (v) { return (Math.round(v * 100) / 100) + 'em' },
                    onChange: function (v) { env.patch(function (d) { d.type.letterSpacing = v }) },
                  }),
                }),
              ],
            }),
            Group({ title: tt('type.uploadFont'), hint: tt('type.hint'), children: e(Uploader, { env: env, t: tt, accept: '.woff,.woff2,.ttf,.otf,font/*' }) }),
            families.length > 0 ? Group({
              title: tt('type.families'),
              children: families.map(function (family) {
                return e('div', { key: family.id, className: 'dts-token-row' },
                  e('div', { className: 'dts-token-name', title: family.family }, family.family),
                  e('div', { style: { fontSize: 15, fontFamily: '"' + family.family + '", var(--dsw-font-family,inherit)' } }, '永字八法 AaBb 0123 ' + (family.weight || 400)),
                  e('div', null),
                  e('div', { style: { display: 'flex', gap: 4 } },
                    uiPill({
                      active: doc.type.uiFont.indexOf(family.family) >= 0,
                      onClick: function () { env.patch(function (d) { toggleFamily(d, family.family, 'uiFont') }) },
                      children: tt('type.useFamily'),
                    }),
                    uiPill({
                      active: doc.type.codeFont.indexOf(family.family) >= 0,
                      onClick: function () { env.patch(function (d) { toggleFamily(d, family.family, 'codeFont') }) },
                      children: tt('type.useCodeFamily'),
                    })))
              }),
            }) : null)
        }

        /* --------------------------------------------------- 形状与动效页 */

        export function ShapeTab(props) {
          var env = props.env, tt = props.t, s = props.doc.shape;
          return e('div', { className: 'dts-body' },
            Group({
              title: tt('tab.shape'), hint: tt('shape.cornerHint'),
              children: [
                Row({
                  label: tt('shape.corner'),
                  children: Slider({
                    label: tt('shape.corner'), min: 1, max: 3, step: 0.05, value: s.cornerShape,
                    format: function (v) { return 'superellipse(' + (Math.round(v * 100) / 100) + ')' },
                    onChange: function (v) { env.patch(function (d) { d.shape.cornerShape = v }) },
                  }),
                }),
                Row({
                  label: tt('shape.motion'),
                  children: Slider({
                    label: tt('shape.motion'), min: 0, max: 4, step: 0.1, value: s.motionSpeed,
                    format: function (v) { return v === 0 ? 'off' : (Math.round(v * 100) / 100) + '×' },
                    onChange: function (v) { env.patch(function (d) { d.shape.motionSpeed = v }) },
                  }),
                }),
                Row({
                  label: tt('shape.reduceMotion'),
                  children: Toggle({ checked: s.reduceMotion, label: tt('shape.reduceMotion'), onChange: function (v) { env.patch(function (d) { d.shape.reduceMotion = v }) } }),
                }),
                Row({
                  label: tt('shape.scrollbar'),
                  children: e(Choice, {
                    label: tt('shape.scrollbar'), value: s.scrollbar,
                    options: [
                      { value: 'native', label: tt('shape.native') },
                      { value: 'auto', label: tt('shape.auto') },
                      { value: 'slim', label: tt('shape.slim') },
                      { value: 'hidden', label: tt('shape.hidden') },
                    ],
                    onChange: function (v) { env.patch(function (d) { d.shape.scrollbar = v }) },
                  }),
                }),
              ],
            }))
        }

        /* ---------------------------------------------------- 我的方案页 */

        /**
         * 方案 = 整份主题文档（配色+背景+玻璃+字体）的命名快照，一键互切。
         * 保存/应用走主题档路由；覆盖同名与删除都要过官方确认框。
         * 本组件用了 hooks，只能经 e(Current, …) 渲染 —— 禁止直调（有回归锁测试）。
         */
        export function ProfileTab(props) {
          var env = props.env, tt = props.t;
          var nameState = useState('');
          var rowsState = useState(null);
          var activeState = useState('');
          function refresh() {
            return env.api.themes().then(function (value) { rowsState[1](value) }, function () { /* 读不到就留旧列表，不打扰 */ })
          }
          useEffect(function () { void refresh() }, []);
          var rows = rowsState[0] === null ? null : (rowsState[0].themes || []);
          function saveAs(name, force) {
            var clean = String(name || '').trim()
            if (clean === '') clean = 'theme-' + new Date().toISOString().slice(0, 10);
            var dup = (rows || []).some(function (r) { return r.name === clean || r.slug === clean });
            var proceed = function (overwrite) {
              return env.api.saveTheme(clean, overwrite === true).then(function () {
                nameState[1]('');
                activeState[1](clean);
                env.notify(tt('profile.saved') + '「' + clean + '」', 'ok');
                return refresh()
              }, function (error) {
                // 服务端 409 = safeName 消毒后已有同档（'午夜?深蓝' 撞 '午夜深蓝'，
                // 本地查重比不出这种碰撞）：过确认框再带 overwrite 重试，绝不静默盖档。
                if (error.status === 409) {
                  return env.confirmDialog({
                    title: tt('profile.existsTitle'), lines: [tt('profile.existsBody')],
                    confirmLabel: tt('common.confirm'), cancelLabel: tt('common.cancel'), tone: 'danger',
                  }).then(function (yes) { return yes ? proceed(true) : undefined })
                }
                env.notify(tt('common.failed') + '：' + String(error.message || error), 'error')
                return undefined
              })
            };
            if (!dup || force) { void proceed(force); return }
            void env.confirmDialog({
              title: tt('profile.existsTitle'), lines: [tt('profile.existsBody')],
              confirmLabel: tt('common.confirm'), cancelLabel: tt('common.cancel'), tone: 'danger',
            }).then(function (yes) { if (yes) void proceed(true) })
          }
          function apply(row) {
            void env.api.loadTheme(row.slug).then(function (projection) {
              env.accept(projection);
              activeState[1](row.name || row.slug);
              env.notify(tt('profile.applied') + '「' + (row.name || row.slug) + '」', 'ok')
            }, function (error) { env.notify(tt('common.failed') + '：' + String(error.message || error), 'error') })
          }
          function remove(row) {
            void env.confirmDialog({
              title: tt('profile.deleteTitle'), lines: [tt('profile.deleteBody')],
              confirmLabel: tt('common.delete'), cancelLabel: tt('common.cancel'), tone: 'danger',
            }).then(function (yes) {
              if (!yes) return;
              return env.api.removeTheme(row.slug).then(refresh, function (error) {
                env.notify(tt('common.failed') + '：' + String(error.message || error), 'error')
              })
            })
          }
          function metaOf(row) {
            var bits = [];
            if (row.mode && row.mode !== 'none') bits.push(tt('profile.background') + '：' + (row.mediaName || row.mode));
            if (row.scheme === 'dark' || row.scheme === 'light') bits.push(row.scheme);
            if (row.exportedAt > 0) { try { bits.push(new Date(row.exportedAt).toLocaleString()) } catch (err) { /* 环境差异，略 */ } }
            return bits.join(' · ')
          }
          return e('div', { className: 'dts-body' },
            Group({
              title: tt('tab.profile'), hint: tt('profile.hint'),
              children: e('div', { style: { display: 'flex', gap: 8 } },
                e('input', {
                  className: 'dts-input', value: nameState[0], placeholder: tt('profile.namePh'),
                  'aria-label': tt('profile.namePh'),
                  onChange: function (event) { nameState[1](event.target.value) },
                  onKeyDown: function (event) { if (event.key === 'Enter') saveAs(nameState[0], false) },
                }),
                uiButton({ variant: 'primary', size: 'sm', onClick: function () { saveAs(nameState[0], false) }, children: tt('profile.saveNew') })),
            }),
            rows === null
              ? e('p', { className: 'dts-hint' }, tt('profile.hint'))
              : rows.length === 0
                ? e('p', { className: 'dts-hint' }, tt('profile.empty'))
                : e('div', { className: 'dts-profile-list' }, rows.map(function (row) {
                  var on = activeState[0] !== '' && (row.name === activeState[0] || row.slug === activeState[0]);
                  return e('div', { key: row.slug, className: 'dts-token-row dts-profile-row', 'data-active': on ? 'true' : undefined },
                    e('div', { className: 'dts-token-name', title: row.slug },
                      row.accent ? e('span', { className: 'dts-profile-dot', style: { background: row.accent } }) : null,
                      (row.name || row.slug) + (on ? ' ✓' : '')),
                    e('div', { className: 'dts-hint' }, metaOf(row)),
                    e('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' } },
                      uiButton({ variant: 'primary', size: 'sm', disabled: on, onClick: function () { apply(row) }, children: tt('profile.apply') }),
                      uiButton({ variant: 'ghost', size: 'sm', onClick: function () { saveAs(row.name || row.slug, true) }, children: tt('profile.overwrite') }),
                      uiButton({ variant: 'ghost', size: 'sm', onClick: function () { remove(row) }, children: tt('profile.del') })))
                })))
        }

        /* -------------------------------------------------------- 高级页 */

        export function AdvancedTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var usageState = useState(null);
          useEffect(function () {
            var alive = true;
            void env.api.usage().then(
              function (value) { if (alive) usageState[1](value) },
              function () { /* 读不到不打扰 */ });
            return function () { alive = false };
          }, []);
          return e('div', { className: 'dts-body' },
            Group({
              title: tt('adv.css'), hint: tt('adv.cssHint'),
              children: e('textarea', {
                className: 'dts-input dts-textarea', value: doc.advanced.css, spellCheck: false, 'aria-label': tt('adv.css'),
                onChange: function (event) { env.patch(function (d) { d.advanced.css = event.target.value }, { debounce: 700 }) },
              }),
            }),
            Group({
              title: 'JSON',
              children: e('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
                e('a', { className: 'dts-btn', href: env.api.exportUrl(), download: 'dsh-theme.json' }, tt('adv.export')),
                e('label', { className: 'dts-btn', style: { cursor: 'pointer' } }, tt('adv.import'),
                  e('input', {
                    type: 'file', accept: 'application/json,.json', hidden: true,
                    onChange: function (event) {
                      var file = event.target.files && event.target.files[0];
                      event.target.value = '';
                      if (!file) return;
                      file.text()
                        .then(function (text) { return env.api.importDoc(JSON.parse(text)) })
                        .then(function (projection) { env.accept(projection); env.notify(tt('common.saved'), 'ok') },
                          function (error) { env.notify(tt('common.failed') + '：' + String(error.message || error), 'error') })
                    },
                  }))),
            }),
            usageState[0] ? Group({
              title: tt('adv.usage'),
              children: e('p', { className: 'dts-hint' },
                String(usageState[0].files) + ' files · ' + humanBytes(usageState[0].bytes)),
            }) : null)
        }

