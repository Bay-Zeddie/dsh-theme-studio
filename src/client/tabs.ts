// src/client/tabs.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { clamp, toHex } from '../../lib/color-core.js'
import {
  Checkbox, DisclosureRow, Input, Menu, MenuItemButton, MenuSurface, Modal,
  NumberField, SegmentedControl, Select, Slider, Tag, TextField,
} from './controls/index.ts'
import { React, e, useEffect, useRef, useState } from './deps.ts'
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

        /**
         * 设置页分组 —— 官方范式：**普通 div 撑满列宽，没有卡片壳**。
         * 官方 `DeveloperToolsRow` 与 `PluginsSettingsSection`（ui-settings-general / ui-settings-plugins）
         * 都用"页面级 h2 18/600 + 分组 h3 15/600 + 引言 13/tertiary + 行分割线"分层，
         * 没有自绘卡片边框。旧实现是 12px 内边距 + 圆角 + `bg-layer-2` + `elevation-soft`
         * 的卡片壳 —— 与官方设置页并排看就是两套语言。
         */
        export function Group(props) {
          return e('div', { className: 'dts-group' },
            props.title ? e('h3', { className: 'dts-group-title' }, props.title) : null,
            props.hint ? e('p', { className: 'dts-group-desc' }, props.hint) : null,
            keyed(props.children))
        }

        /**
         * 设置页行 —— 官方 `DeveloperToolsRow.module.css` 逐字：
         *   `display:flex; justify-content:space-between; align-items:center; gap:24px;
         *    padding:16px 0; border-bottom:.5px solid var(--dsw-alias-border-l2)`
         * 标题 `14px/20`、描述 `12px/18 var(--dsw-alias-label-secondary)` + `margin-top:4px`。
         * 旧实现是 grid 三列（`minmax(96px,168px) 1fr auto`）+ 12.5px 标签。
         *
         * ⚠️ 行**自己**不判断"我是不是最后一个" —— 行末分割线由**容器**用后代选择器收尾，
         *   这是官方写法（`section>[data-slot="settings.general.item"]>:last-child{border-bottom:none}`），
         *   见 chrome.ts 的 `.dts-group>.dts-row:last-child`。
         *
         * 入参：`label` 行标题（必填、已本地化）、`hint` 行描述（可选）、
         * `children` 右侧控件区、`tail` 最右侧附加物（按钮/读数）。
         */
        export function Row(props) {
          return e('div', { className: 'dts-row' },
            e('div', { className: 'dts-row-text' },
              e('div', { className: 'dts-row-title' }, props.label),
              props.hint ? e('div', { className: 'dts-row-desc' }, props.hint) : null),
            e('div', { className: 'dts-row-control' }, keyed(props.children)),
            props.tail ? e('div', { className: 'dts-row-tail' }, keyed(props.tail)) : null)
        }

        /**
         * 滑块 —— 直接转发到自写控件层的 `Slider`。
         *
         * 旧实现是本文件里的原生 `<input type=range>` + `<output>`（`.dts-range` 一族），
         * 几何/字号/数值排版全是自造值；控件层那份是"官方没有 Slider，按官方设置页
         * 字段几何与排版令牌自写"的版本（可见标签 + 右侧 tabular-nums 数值 +
         * `aria-valuetext` + 越界钳制），并且已经过真机渲染冒烟。
         *
         * 参数换名：旧的 `suffix` → 控件的 `unit`；旧的 `format(v)` 回调**不保留**
         * （控件只做 `String(value) + unit`）—— 需要百分数显示的地方改为在调用点把
         * 值域折成百分数（如 `dim 0.3` → 滑块值 `30` + `unit:'%'`），语义不变。
         */
        export function Range(props) {
          return e(Slider, {
            label: props.label,
            value: props.value,
            onChange: props.onChange,
            min: props.min,
            max: props.max,
            step: props.step,
            unit: props.unit === undefined ? props.suffix : props.unit,
            showValue: props.showValue,
            hint: props.hint,
            disabled: props.disabled,
            id: props.id,
          })
        }

        /**
         * 下拉选择 —— 直接转发到自写控件层的 `Select`。
         *
         * 旧实现是本文件里的 `Choice`（约 190 行：自绘触发器 + 自绘弹层 + 手写
         * ↑↓/Home/End/Enter/Space/Tab/Esc 键盘 + 视口翻转测量 + 文档级 mousedown），
         * 整段已删除。控件层那份是"官方 primitives 没有下拉，按官方 Menu 的键盘范式
         * + 官方 `fields.module.css` 的触发器几何 + `MenuSurface` 材质自写"的版本，
         * 语义用 `listbox`/`option`（"在 N 个互斥值里选一个"的 ARIA 正道），
         * `portal` 默认 true（面板在可滚动容器里，就地列表会被祖先 overflow 裁掉）。
         */
        export function Choice(props) {
          return e(Select, {
            label: props.label,
            value: props.value,
            options: props.options,
            onChange: props.onChange,
            placeholder: props.placeholder,
            disabled: props.disabled,
            className: props.className,
          })
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
              // ⚠️ 阶段 C/D：不再给控件挂 `.dts-input`。那条自绘规则是"Input 控件样式
              // 整份失效"时代的等价皮肤（`tools/css-modules.mjs` 的盐以数字开头 →
              // CSS 标识符非法 → 整份静默失效，Lead 已修，真机实测 19/19 模块均解析出规则）。
              // 现在控件自己的 `Input.module.css` 就是唯一真源（官方 H32/R12/pad 0 8 几何），
              // 再挂 `.dts-input`（bg specific-input-major + radius-sm + 12.5px）就是第二个真源，
              // 同特异性下还会按注入顺序互相压制。这里只留布局。
              style: { flex: 1 }, value: value, placeholder: '#rrggbb',
              spellCheck: false, 'aria-label': props.label,
              onChange: function (event) { props.onChange(event.target.value.trim()) },
            }),
            value !== '' ? uiButton({
              variant: 'ghost', ariaLabel: props.label, title: props.clearLabel,
              onClick: function () { props.onChange('') }, children: '×',
            }) : null)
        }

        /**
         * 自写控件层的 Input：className 落外层 wrapper、其余属性透传给内层 input，
         * 直接把 style 透进去只作用到内层、flex 布局吃不到 —— 包一层承接布局样式。
         * 形状与旧「官方 Input 在位」那条路径逐字一致（wrapper span + 控件自身 wrapper），
         * 只是实现换成了 ./controls/Input.ts，不再 require 官方包。
         */
        export function uiInput(props) {
          var inner = Object.assign({}, props);
          delete inner.style;
          return e('span', { className: 'dts-input-flex', style: props.style }, e(Input, inner))
        }

        /**
         * 确认框 —— 走自写控件层的 `Modal`（官方 `useModalLayer` 契约）。
         *
         * 旧实现是自造 `.dts-scrim` + `.dts-dialog` 与一套手写键盘：Esc=取消、
         * Enter=确认、document 捕获阶段的 Tab 焦点陷阱、30ms 后把焦点放到最后一个按钮。
         * 现在这些**全部由 Modal 提供**，且都是官方契约：
         *   · Esc 只归**最顶层**模态（栈语义；不再需要 `engine.get().dialog !== null` 那种手写让位）；
         *   · 遮罩点击即关、`aria-hidden`、不吃穿透；
         *   · Tab 焦点陷阱（容器聚焦时进首/末项、边缘环绕、排除 `[inert]/[hidden]`）；
         *   · 关闭时把焦点归还给打开前的元素（`focusWithoutRing`）；
         *   · 初始焦点取 `[data-modal-autofocus]` —— **必须用 data 属性而不是 React autoFocus**
         *     （autoFocus 会先于本层保存触发元素执行）。这里给确认键打这个标记。
         * Enter=确认不属官方契约（官方 Modal 只认 Esc / 应用关闭 / 遮罩点击），
         * 保留在根层的 `onKeyDownCapture` 里 —— 捕获阶段先于文档级监听，不会被 Esc 抢走。
         */
        export function ConfirmDialog(props) {
          return e(Modal, {
            open: true,
            title: props.title,
            closeLabel: props.cancelLabel,
            className: 'dts-dialog-modal',
            onClose: function () { props.onDone(false) },
            onKeyDownCapture: function (event) {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              props.onDone(true);
            },
            footer: e('div', { className: 'dts-dialog-foot' },
              uiButton({ variant: 'ghost', onClick: function () { props.onDone(false) }, children: props.cancelLabel }),
              uiButton({
                variant: props.tone === 'danger' ? 'danger' : 'primary',
                autofocus: true,
                onClick: function () { props.onDone(true) },
                children: props.confirmLabel,
              })),
          },
            (props.lines || []).filter(function (line) { return line !== '' }).map(function (line, index) {
              return e('div', {
                key: index, className: 'dts-dialog-line',
                'data-kind': /[\\/]/.test(line) ? 'path' : 'text',
              }, line)
            }))
        }

        export function FocusPad(props) {
          var boxRef = useRef(null);
          /**
           * 拖动合帧：每个 pointermove 都 patch 会深拷贝整份 doc 并重渲整棵活动
           * 页签（store 是单例订阅、全文件无 memo）。与 layer.ts 的视差同款 rAF 门：
           * 一帧最多落地一次 —— 视觉仍是跟手的 60fps，重渲次数从"事件频率"降到"帧率"。
           * ⚠️ 暂存的是**数值**不是事件对象：React 16 会回收合成事件，延后取
           * clientX/clientY 会取到 null。
           */
          var frameRaf = 0;
          var pendingPoint = null;
          function flushFrame() {
            frameRaf = 0;
            var point = pendingPoint;
            pendingPoint = null;
            if (point === null) return;
            pickAt(point.x, point.y);
          }
          function pickAt(clientX, clientY) {
            var box = boxRef.current;
            if (box === null) return;
            var rect = box.getBoundingClientRect();
            props.onChange(
              Math.round(clamp(((clientX - rect.left) / Math.max(1, rect.width)) * 100, 0, 100)),
              Math.round(clamp(((clientY - rect.top) / Math.max(1, rect.height)) * 100, 0, 100)));
          }
          function pick(event) { pickAt(event.clientX, event.clientY) }
          useEffect(function () {
            return function () {
              if (frameRaf !== 0 && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frameRaf);
              frameRaf = 0;
              pendingPoint = null;
            };
          }, []);
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
            onPointerMove: function (event) {
              if (event.buttons !== 1) return;
              pendingPoint = { x: event.clientX, y: event.clientY };
              if (frameRaf !== 0) return;
              frameRaf = window.requestAnimationFrame(flushFrame);
            },
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
              /* 本组的行描述就是"明暗与字号直接驱动宿主 theme 服务"（`base.hint`）——
                 页面级引言另有独立键 `section.intro`（见 app.ts 的 `.dts-page-intro`），
                 两者不再互相借用：页面级 h2 + 引言 + 分组标题 + 行描述是官方四层节奏。 */
              title: tt('base.scheme'), hint: tt('base.hint'),
              children: [
                Row({
                  label: tt('base.scheme'),
                  children: e(SegmentedControl, {
                    id: 'dts-scheme',
                    label: tt('base.scheme'),
                    value: doc.base.scheme,
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
                  children: Range({
                    label: tt('base.fontSize'), min: 12, max: 17, value: doc.base.fontSize, unit: 'px',
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
          /** 字段滑块（走控件层 Slider）。`unit` 是显示后缀，也是 aria-valuetext 的内容。 */
          function range(labelKey: any, min: any, max: any, field: any, unit?: any, step?: any) {
            return Row({
              label: tt(labelKey),
              children: Range({
                label: tt(labelKey), min: min, max: max, value: b[field], unit: unit,
                step: step === undefined ? (unit ? 1 : 0.05) : step,
                onChange: function (v) { set(field, v) },
              }),
            })
          }
          /**
           * 分数值滑块（文档里存 0..1，界面显示百分数）。
           * 控件层 Slider 只做 `String(value) + unit`，没有 format 回调 —— 于是把
           * **值域折成百分数**再交给它：语义不变（写回时 ÷100），读数与旧 format 逐字相同。
           */
          function percentRange(labelKey: any, minPercent: any, maxPercent: any, read: any, write: any) {
            return Row({
              label: tt(labelKey),
              children: Range({
                label: tt(labelKey), min: minPercent, max: maxPercent, step: 1, unit: '%',
                value: Math.round(read() * 100),
                onChange: function (v) { write(v / 100) },
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
                  children: e(SegmentedControl, {
                    id: 'dts-backdrop-mode',
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
                range('backdrop.scale', 0.5, 4, 'scale', '×', 0.05),
                Row({
                  label: tt('backdrop.focus'),
                  hint: tt('backdrop.focusHint'),
                  tail: [
                    e(NumberField, {
                      label: 'X %', min: 0, max: 100, step: 1, value: b.focusX,
                      className: 'dts-focus-num',
                      onChange: function (v) { env.patch(function (d) { d.backdrop.focusX = v }) },
                    }),
                    e(NumberField, {
                      label: 'Y %', min: 0, max: 100, step: 1, value: b.focusY,
                      className: 'dts-focus-num',
                      onChange: function (v) { env.patch(function (d) { d.backdrop.focusY = v }) },
                    }),
                  ],
                  children: e(FocusPad, {
                    src: src, x: b.focusX, y: b.focusY,
                    onChange: function (x, y) { env.patch(function (d) { d.backdrop.focusX = x; d.backdrop.focusY = y }) },
                  }),
                }),
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
                  children: Range({
                    label: tt('backdrop.dim'), min: 0, max: 95, step: 1, unit: '%',
                    value: Math.round(b.dim * 100),
                    onChange: function (v) { set('dim', v / 100) },
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
                  tail: Range({
                    label: tt('backdrop.kenBurnsSeconds'), min: 8, max: 240, step: 2, unit: 's',
                    value: b.kenBurnsSeconds,
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
                  children: Range({
                    label: tt('backdrop.playbackRate'), min: 0.25, max: 2, step: 0.05, unit: '×',
                    value: b.video.playbackRate,
                    onChange: function (v) { setVideo('playbackRate', v) },
                  }),
                }),
              ],
            }) : null,

            b.mode !== 'none' ? Group({
              title: tt('glass.enabled'), hint: tt('glass.hint'),
              children: [
                Row({ label: tt('glass.enabled'), children: Toggle({ checked: doc.glass.enabled, label: tt('glass.enabled'), onChange: function (v) { env.patch(function (d) { d.glass.enabled = v }) } }) }),
                percentRange('glass.alpha', 15, 100,
                  function () { return doc.glass.alpha },
                  function (v) { env.patch(function (d) { d.glass.alpha = v }) }),
                Row({ label: tt('glass.blur'), children: Range({ label: tt('glass.blur'), min: 0, max: 60, value: doc.glass.blur, unit: 'px', onChange: function (v) { env.patch(function (d) { d.glass.blur = v }) } }) }),
                Row({ label: tt('glass.saturate'), children: Range({ label: tt('glass.saturate'), min: 100, max: 300, step: 5, value: doc.glass.saturate, unit: '%', onChange: function (v) { env.patch(function (d) { d.glass.saturate = v }) } }) }),
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
                    // 素材类型是**只读徽章**：交给自写控件层的 `Tag`（8 种 tone），
                    // 不再拼字符串（旧写法把 kind 直接缀进一行 10.5px 文本，读不出层级）。
                    e('div', { className: 'dts-card-meta' },
                      e(Tag, { tone: 'quiet' }, item.kind),
                      e('span', null, humanBytes(item.bytes)
                        + (item.width ? ' · ' + item.width + '×' + item.height : '')))),
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
          // 等级徽章走自写控件层的 `Tag`（只读徽章）：语义 tone 直接表达 WCAG 档位，
          // 不必再自造 `data-level` 属性 + 三条 `.dts-badge` 规则。
          var tone = ratio >= 7 ? 'success' : (ratio >= 4.5 ? 'neutral' : 'danger');
          return e('div', { className: 'dts-contrast' },
            e('span', null, props.t('color.contrast')),
            e(Tag, { tone: tone }, (Math.round(ratio * 100) / 100) + ':1'))
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
              children: e('div', { className: 'dts-token-groups' },
                e('div', { className: 'dts-filter-row' },
                  e(TextField, {
                    className: 'dts-field-grow',
                    label: tt('color.groups'), placeholder: '--dsw-…', value: filter[0], spellCheck: false,
                    // 不过滤输入本身：trim 会让空格永远打不进去；匹配时再收口。
                    onChange: function (v) { filter[1](v) },
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
                e('div', { className: 'dts-extras' },
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
         *
         * ★ 令牌名建议弹层走自写控件层的 `MenuSurface`（材质/圆角/模糊/暗色兜底全在它
         *   内部），替掉原来的原生 `<datalist>`：后者是**系统 UI**，主题令牌一条都够不着
         *   —— 与"原生 `<select>` 弹层吃不到毛玻璃"完全同一个根因（主人实测
         *   「选项这里没同步」）。语义用 `listbox`/`option`（"在候选里选一个"）。
         * ⚠️ 键盘契约只做最小面：Escape 收起、（未做）↑↓ 走位 —— 见 13 报告 §4 的说明。
         *   弹层向上展开：本行位于色彩页最底部，向下弹会被祖先滚动容器裁掉。
         */
        export function CustomTokenAdder(props) {
          var env = props.env, tt = props.t;
          var draft = useState('');
          var openState = useState(false);
          var open = openState[0];
          function add(value?) {
            var name = String(value === undefined ? (draft[0] || '') : value).trim();
            if (name === '') return;
            props.onAdd(name);
            draft[1]('');
            openState[1](false);
          }
          var needle = String(draft[0] || '').trim().toLowerCase();
          var matches = needle === ''
            ? []
            : env.tokenNames().filter(function (name) {
              return name.toLowerCase().indexOf(needle) >= 0;
            }).slice(0, 8);
          useEffect(function () {
            if (!open) return undefined;
            function onDocDown(event) {
              var field = document.getElementById('dts-token-adder');
              if (field !== null && event.target instanceof Node && field.contains(event.target)) return;
              openState[1](false);
            }
            document.addEventListener('pointerdown', onDocDown);
            return function () { document.removeEventListener('pointerdown', onDocDown) };
          }, [open]);
          return e('div', { className: 'dts-adder', id: 'dts-token-adder' },
            e('div', { className: 'dts-adder-field' },
              e(TextField, {
                className: 'dts-field-grow',
                label: tt('color.custom'), placeholder: tt('color.customName'), value: draft[0],
                spellCheck: false, autoComplete: 'off',
                'aria-expanded': open ? 'true' : 'false',
                'aria-controls': 'dts-token-suggest',
                onChange: function (v) { draft[1](v); openState[1](true) },
                onFocus: function () { openState[1](true) },
                onKeyDown: function (event) {
                  if (event.key === 'Enter') { event.preventDefault(); add() } else if (event.key === 'Escape') { openState[1](false) }
                },
              }),
              open && matches.length > 0
                ? e(MenuSurface, {
                  id: 'dts-token-suggest', className: 'dts-suggest',
                  role: 'listbox', 'aria-label': tt('color.custom'),
                }, matches.map(function (name) {
                  return e('button', {
                    key: name, type: 'button', role: 'option', className: 'dts-suggest-row',
                    onClick: function () { add(name) },
                  }, name)
                }))
                : null),
            uiButton({ variant: 'ghost', onClick: function () { add() }, children: tt('color.customAdd') }))
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
                  children: e(TextField, {
                    className: 'dts-field-grow',
                    label: tt('type.uiFont'), value: doc.type.uiFont, spellCheck: false,
                    // ⚠️ 控件契约：onChange 直接给**字符串**，不是 event。
                    onChange: function (v) { env.patch(function (d) { d.type.uiFont = v }) },
                  }),
                }),
                Row({
                  label: tt('type.codeFont'),
                  children: e(TextField, {
                    className: 'dts-field-grow',
                    label: tt('type.codeFont'), value: doc.type.codeFont, spellCheck: false,
                    onChange: function (v) { env.patch(function (d) { d.type.codeFont = v }) },
                  }),
                }),
                Row({
                  label: tt('type.letterSpacing'),
                  children: Range({
                    label: tt('type.letterSpacing'), min: -1, max: 4, step: 0.05, unit: 'em',
                    value: doc.type.letterSpacing,
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
                  hint: tt('shape.cornerHint'),
                  children: Range({
                    label: tt('shape.corner'), min: 1, max: 3, step: 0.05, value: s.cornerShape,
                    onChange: function (v) { env.patch(function (d) { d.shape.cornerShape = v }) },
                  }),
                }),
                Row({
                  label: tt('shape.motion'),
                  children: Range({
                    label: tt('shape.motion'), min: 0, max: 4, step: 0.1, unit: '×', value: s.motionSpeed,
                    /* 读数为 0 时 `unit:'×'` 会渲染成 `0×` —— 看着像"零倍速"而不是"关闭"，
                       改造前这一格显示的是 `off`。用 `hint` 把语义说清楚。
                       **不给 Slider 加 `format`**：官方 Slider 契约里没有这个 prop，
                       为一个读数标注偏离官方接口不值（改造前那处也是自家实现才有的能力）。 */
                    hint: s.motionSpeed === 0 ? tt('shape.motionOff') : undefined,
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
          /** 打开着「⋯」菜单的那一行（slug）；空串 = 全关。 */
          var menuState = useState('');
          /** 卸载门闩：切页签/关模态后在飞的主题档列表响应不得再写 state
           *  （同文件 AdvancedTab 已有同款，这里补上，行为对齐）。 */
          var alive = true;
          function refresh() {
            return env.api.themes().then(function (value) { if (alive) rowsState[1](value) }, function () { /* 读不到就留旧列表，不打扰 */ })
          }
          useEffect(function () { void refresh(); return function () { alive = false } }, []);
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
              children: e('div', { className: 'dts-field-row' },
                e(TextField, {
                  className: 'dts-field-grow',
                  label: tt('tab.profile'), value: nameState[0], placeholder: tt('profile.namePh'),
                  onChange: function (v) { nameState[1](v) },
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
                    e('div', { className: 'dts-row-actions' },
                      uiButton({ variant: 'primary', size: 'sm', disabled: on, onClick: function () { apply(row) }, children: tt('profile.apply') }),
                      /* ★ 行的次要动作收进菜单 —— 这是**菜单语义**的正确落点
                         （references_practices.md:35「按同类官方页面抄行模式」：
                         一行一个主操作 + 一个"更多"菜单，而不是三个并排按钮互相挤）。
                         走自写控件层的 `Menu` + `MenuItemButton`：
                           · `Menu` 是官方 Menu 的逐字移植（↑↓ 环绕 / Home / End /
                             Enter / Esc 归还焦点 / Tab settles like Enter / 外部点击关闭）；
                           · `MenuItemButton` 是官方组件行的写法（role=menuitem + 支持 danger
                             配色与 separatorBefore 分组线）；
                           · `portal: true` —— 列表渲染进 body 并按其锚点矩形 fixed 定位，
                             否则会被祖先的 `overflow-y:auto`（面板唯一滚动容器）裁掉。 */
                      e(Menu, {
                        open: menuState[0] === row.slug,
                        portal: true,
                        align: 'end',
                        onClose: function () { menuState[1]('') },
                        anchor: uiButton({
                          variant: 'ghost', size: 'sm',
                          ariaLabel: tt('tab.profile'), title: tt('tab.profile'),
                          onClick: function () { menuState[1](menuState[0] === row.slug ? '' : row.slug) },
                          children: '⋯',
                        }),
                      },
                        e(MenuItemButton, {
                          key: 'overwrite',
                          onSelect: function () { menuState[1](''); saveAs(row.name || row.slug, true) },
                        }, tt('profile.overwrite')),
                        e(MenuItemButton, {
                          key: 'delete', danger: true, separatorBefore: true,
                          onSelect: function () { menuState[1](''); remove(row) },
                        }, tt('profile.del'))))
                  )
                })))
        }

        /* -------------------------------------------------------- 高级页 */

        export function AdvancedTab(props) {
          var env = props.env, tt = props.t, doc = props.doc;
          var usageState = useState(null);
          /**
           * 导入的合并开关。宿主 `/api/import?mode=merge` 与 api.importDoc 的第二参
           * 早就实现了"按字段合并"，但此前**没有任何 UI 能传这个参** —— 功能有、按钮缺。
           * 默认关（保持"整份替换"这个既有语义），勾上才走合并。
           */
          var mergeState = useState(false);
          var merge = mergeState[0], setMerge = mergeState[1];
          /** 「素材占用」折叠行的开合（DisclosureRow 是受控组件）。 */
          var usageOpen = useState(false);
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
                className: 'dts-textarea', value: doc.advanced.css, spellCheck: false, 'aria-label': tt('adv.css'),
                onChange: function (event) { env.patch(function (d) { d.advanced.css = event.target.value }, { debounce: 700 }) },
              }),
            }),
            Group({
              title: 'JSON',
              children: [
                /* ⚠️ 真缺陷修复（第 13 轮渲染冒烟抓到的）：这一格的勾选框原先写成
                   `Group({ …, tail: e('label', …checkbox…) })` —— 而 `Group` **根本不读 `tail`**
                   （它只渲染 title/hint/children）。于是「合并导入」这个勾选框从加进来的那天起
                   **一次都没渲染过**：宿主与 api 早就实现 `mode=merge`，按钮却从未出现在界面上。
                   静态源码锁（`/type: 'checkbox'…setMerge/`）看不到这种"死槽位"——
                   只有真渲染才暴露。现在它是一个正式的行（Row 的右侧控件位），必然渲染。 */
                Row({
                  label: tt('adv.merge'),
                  hint: tt('adv.mergeHint'),
                  children: e(Checkbox, {
                    checked: merge,
                    label: tt('adv.merge'),
                    title: tt('adv.mergeHint'),
                    // 控件契约：onChange 直接给**布尔**，不是 event。
                    onChange: function (next) { setMerge(next) },
                  }),
                }),
                e('div', { className: 'dts-json-actions' },
                  e('a', { className: 'dts-btn', href: env.api.exportUrl(), download: 'dsh-theme.json' }, tt('adv.export')),
                  e('label', { className: 'dts-btn', style: { cursor: 'pointer' } }, tt('adv.import'),
                    e('input', {
                      type: 'file', accept: 'application/json,.json', hidden: true,
                      onChange: function (event) {
                        var file = event.target.files && event.target.files[0];
                        event.target.value = '';
                        if (!file) return;
                        file.text()
                          .then(function (text) { return env.api.importDoc(JSON.parse(text), merge ? 'merge' : '') })
                          .then(function (projection) { env.accept(projection); env.notify(tt('common.saved'), 'ok') },
                            function (error) { env.notify(tt('common.failed') + '：' + String(error.message || error), 'error') })
                      },
                    }))),
              ],
            }),
            /* 「素材占用」是次要读数：收进自写控件层的 `DisclosureRow`（官方折叠行），
               默认折叠 —— 它不再占一整块版面，需要时点开。 */
            usageState[0] ? e(DisclosureRow, {
              key: 'usage',
              title: tt('adv.usage'),
              open: usageOpen[0],
              expandable: true,
              expandOnRowClick: true,
              onToggle: function () { usageOpen[1](!usageOpen[0]) },
              className: 'dts-disclosure',
            },
              e('p', { className: 'dts-hint' },
                String(usageState[0].files) + ' files · ' + humanBytes(usageState[0].bytes))) : null)
        }
