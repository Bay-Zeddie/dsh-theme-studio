/**
 * controls/Select.ts —— ★ 官方 primitives **没有下拉控件**（宿主用原生 `<select>` 或 Menu），
 * 本文件是自写件，官方风格来自两处现成事实：
 *   - 材质与视口几何：`MenuSurface`（透明填充 + `--dsw-menu-backdrop-filter` 模糊 +
 *     外圆角）与 `lib/Menu.module.css` 的卡片/行几何（min-width 144、padding 4、
 *     elevation-prominent、行 min-height 34 / padding 6 8 / radius-md / 13-20、
 *     l2 滚动条令牌、`max-height: calc(100vh - 12px - max(12px, var(--dsh-frame-top-clearance,12px)))`）；
 *   - 触发器几何：`lib/settings-form/fields.module.css` 的 `.input`（H34 / pad 0 12 /
 *     0.5px border-l4 / radius-md / bg-layer-3 / 13px），即官方设置页字段的形状。
 * 键盘范式逐条对齐 `lib/index.js:4022-4077` 的 Menu：↑/↓ 走位（环绕）、Home/End 跳首末、
 * Enter/Space 激活聚焦行（原生 button 语义）、Esc 关闭并归还焦点、Tab 提交聚焦行并归还焦点、
 * 外部 pointerdown 关闭。焦点归还用官方 `focusWithoutRing`。
 * 官方没有的判据由本控件自己定（已逐条记在 05-controls-port.md）：
 *   - 语义用 `listbox`/`option`（"在 N 个互斥值里选一个"的 ARIA 正道），不是 menu/menuitem；
 *   - 打开状态由控件自持（原生 select 也是自持 popup），不设受控 `open` prop；
 *   - 打开后把焦点放到当前选中项（原生 select 的行为）；选中行同时用 `aria-selected`
 *     与官方 Menu 的 `selection='fill'` 填充表达；
 *   - `portal` 默认 **true**：面板里的下拉位于可滚动容器内，就地列表会被祖先 overflow 裁掉；
 *     官方 Menu 默认 false 是因为它多挂在顶级工具栏上。
 * 官方 Menu 的嵌套子菜单 / 快捷键键帽 / closeOnPointerLeave 不适用于下拉，未移植。
 *
 * 监听器纪律：文档级 pointerdown/keydown 只在 `open` 期间存在，随 effect 清理成对摘除；
 * 所有会随渲染变化的输入都走 ref，避免每按一次方向键就重挂监听。
 */
import { clsx, createPortal, e, focusWithoutRing, isBehindModal, observeComposition, useAnchoredPosition, useEffect, useRef, useState, OVERLAY_MARGIN } from './runtime.ts';
import { MenuSurface } from './MenuSurface.ts';
import css from './Select.module.css';

export interface SelectOption {
  value: string;
  label: any;
  disabled?: boolean;
}

export interface SelectProps {
  /** 本地化的无障碍名称（落到触发器的 aria-label）；必填。 */
  label: string;
  /** 当前值；控件完全受控。 */
  value: string;
  /** 按显示顺序排列的选项。 */
  options: SelectOption[];
  /** 以点击或键盘请求的值调用。 */
  onChange: (value: string) => void;
  /** 当前值不在 options 里时，触发器显示的文案，由调用方本地化。 */
  placeholder?: string;
  /** 选项为空时列表里显示的一行文案，由调用方本地化。 */
  emptyLabel?: string;
  /** 是否拒绝交互。 */
  disabled?: boolean;
  /** 本地化的悬停文本，通常说明为何被锁。 */
  title?: string;
  /** 渲染进 document.body 并按锚点矩形 fixed 定位（默认 true，避免被祖先裁剪）。 */
  portal?: boolean;
  /** 使用更小的菜单排版。 */
  compact?: boolean;
  /** 相对锚点在上方（`top`）或下方（`bottom`，默认）展开。 */
  side?: 'bottom' | 'top';
  /** 相对锚点左对齐（`start`，默认）或右对齐（`end`）。 */
  align?: 'start' | 'end';
  /** 布局定位用的额外类名（落在根 span 上）。 */
  className?: string;
  /** 下拉卡片的额外类名。 */
  listClassName?: string;
}

/** 未放置的 portal 列表：隐藏但按固定原点布局，offsetWidth/offsetHeight 因此是真实值。 */
var MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 };

/** 官方 IconChevronDownOutlineRegular 的路径（16 viewBox / 1px 描边 / 默认 14px）。 */
function ChevronDown(props: { className?: string }): any {
  return e(
    'svg',
    {
      width: 14,
      height: 14,
      className: props.className,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      strokeWidth: 1,
    },
    e('path', {
      d: 'M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6',
      stroke: 'currentColor',
    }),
  );
}

/** 官方 IconCheckOutlineRegular 的路径，用作选中标记。 */
function CheckGlyph(props: { className?: string }): any {
  return e(
    'svg',
    {
      width: 14,
      height: 14,
      className: props.className,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      strokeWidth: 1,
    },
    e('path', {
      d: 'M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4',
      stroke: 'currentColor',
    }),
  );
}

/**
 * 渲染一个受控下拉选择。
 * @param props - 见 {@link SelectProps}。
 * @returns 触发器与条件渲染的 listbox。
 */
export function Select(props: SelectProps): any {
  var rootRef = useRef(null);
  var triggerRef = useRef(null);
  var listRef = useRef(null);
  var openState = useState(false);
  var open = openState[0];
  var setOpen = openState[1];
  var activeState = useState(0);
  var activeIndex = activeState[0];
  var setActiveIndex = activeState[1];

  var options = props.options === undefined ? [] : props.options;

  var selectedIndex = -1;
  for (var i = 0; i < options.length; i += 1) {
    if (options[i].value === props.value) {
      selectedIndex = i;
      break;
    }
  }
  var selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /* 会随渲染变化的输入统一走 ref：文档级监听因此只在 open 变化时重挂。 */
  var latest = useRef(null);
  latest.current = {
    options: options,
    value: props.value,
    activeIndex: activeIndex,
    onChange: props.onChange,
  };
  var activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;

  /** 列表里可聚焦的行下标（禁用行不参与走位，同官方 Menu 的 `button:not(:disabled)`）。 */
  function enabledIndexes(list: SelectOption[]): number[] {
    var out: number[] = [];
    for (var k = 0; k < list.length; k += 1) {
      if (list[k].disabled !== true) out.push(k);
    }
    return out;
  }

  /** 把真实焦点放到第 index 个选项上（禁用行会被跳过）。 */
  function focusOption(index: number): void {
    var list = listRef.current;
    if (list === null || list === undefined) return;
    var rows = list.querySelectorAll('button[role="option"]:not(:disabled)');
    if (rows.length === 0) return;
    var slot = enabledIndexes(latest.current.options).indexOf(index);
    var target = rows[slot >= 0 ? slot : 0];
    if (target !== undefined && target !== null) target.focus();
    if (slot >= 0) setActiveIndex(index);
  }

  /** 关闭；默认把键盘还给触发器（官方 Menu 的 refocusAnchor）。 */
  function close(refocus?: boolean): void {
    setOpen(false);
    if (refocus === false) return;
    var trigger = triggerRef.current;
    if (trigger !== null && trigger !== undefined && document.contains(trigger)) focusWithoutRing(trigger);
  }

  function openList(): void {
    if (props.disabled === true) return;
    var enabled = enabledIndexes(options);
    if (enabled.length === 0) {
      setOpen(true);
      return;
    }
    var start = selectedIndex >= 0 && options[selectedIndex].disabled !== true ? selectedIndex : enabled[0];
    setActiveIndex(start);
    setOpen(true);
  }

  /* 打开后把焦点放到当前选中项（原生 select 的行为）：列表首帧还不存在，
   * 所以必须等 open 生效后的 effect。 */
  useEffect(function () {
    if (!open) return;
    focusOption(activeRef.current);
  }, [open]);

  var position = useAnchoredPosition({
    open: open && props.portal !== false,
    anchorRef: triggerRef,
    panelRef: listRef,
    side: props.side === undefined ? 'bottom' : props.side,
    align: props.align === undefined ? 'start' : props.align,
    gap: 4,
    margin: OVERLAY_MARGIN,
  });

  useEffect(function () {
    if (!open) return undefined;
    var composition = observeComposition(document);
    var root = rootRef.current;

    var onPointerDown = function (event: any) {
      if (!(event.target instanceof Node)) return;
      if (root !== null && root !== undefined && root.contains(event.target)) return;
      if (listRef.current !== null && listRef.current.contains(event.target)) return;
      setOpen(false);
    };

    var onKeyDown = function (event: any) {
      if (composition.guards(event) || isBehindModal(root) || event.ctrlKey || event.altKey || event.metaKey) return;
      var focused = document.activeElement;
      var insideList = listRef.current !== null && listRef.current.contains(focused);
      var onTrigger = triggerRef.current !== null && triggerRef.current === focused;
      if (!insideList && !onTrigger) return;

      if (event.key === 'Escape' && !event.shiftKey) {
        event.preventDefault();
        if (event.repeat) return;
        close(true);
        return;
      }

      if (onTrigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        openList();
        return;
      }

      if (event.key === 'Tab') {
        /* Tab 提交聚焦行（官方 Menu：Tab 选定聚焦行），随后关闭并归还焦点。 */
        if (insideList) {
          event.preventDefault();
          if (focused instanceof HTMLElement && focused.getAttribute('role') === 'option') focused.click();
          else close(true);
          return;
        }
        close(false);
        return;
      }

      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) < 0) return;
      if (!insideList) return;
      var enabled = enabledIndexes(latest.current.options);
      if (enabled.length === 0) return;
      event.preventDefault();
      var slot = enabled.indexOf(activeRef.current);
      var nextSlot;
      if (event.key === 'Home') nextSlot = 0;
      else if (event.key === 'End') nextSlot = enabled.length - 1;
      else if (slot < 0) nextSlot = event.key === 'ArrowDown' ? 0 : enabled.length - 1;
      else nextSlot = (slot + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
      focusOption(enabled[nextSlot]);
    };

    document.addEventListener('pointerdown', onPointerDown);
    var onEscape = function (event: any) {
      if (event.key === 'Escape') onKeyDown(event);
    };
    var onOtherKey = function (event: any) {
      if (event.key !== 'Escape') onKeyDown(event);
    };
    document.addEventListener('keydown', onOtherKey);
    document.addEventListener('keydown', onEscape, true);
    return function () {
      composition.dispose();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onOtherKey);
      document.removeEventListener('keydown', onEscape, true);
    };
  }, [open, props.disabled]);

  var list = open
    ? e(
        MenuSurface,
        {
          compact: props.compact === true,
          ref: listRef,
          className: clsx(
            css.dtsSelectList,
            props.listClassName,
            props.portal === false ? css.dtsSelectListInPlace : css.dtsSelectPortal,
          ),
          style: props.portal === false ? undefined : (position === null ? MEASURE_STYLE : position),
          role: 'listbox',
          'aria-label': props.label,
          onClick: function (event: any) {
            event.stopPropagation();
          },
        },
        e(
          'div',
          { className: css.dtsSelectViewport, role: 'presentation', key: 'viewport' },
          options.length === 0
            ? e('div', { className: css.dtsSelectEmpty, key: 'empty' }, props.emptyLabel)
            : options.map(function (option, index) {
                var isSelected = option.value === props.value;
                return e(
                  'button',
                  {
                    key: option.value,
                    type: 'button',
                    role: 'option',
                    'aria-selected': isSelected,
                    tabIndex: index === activeIndex ? 0 : -1,
                    disabled: option.disabled === true,
                    className: css.dtsSelectOption,
                    onMouseEnter: function () {
                      if (option.disabled !== true) setActiveIndex(index);
                    },
                    onClick: function () {
                      setOpen(false);
                      latest.current.onChange(option.value);
                      var trigger = triggerRef.current;
                      if (trigger !== null && trigger !== undefined && document.contains(trigger)) {
                        focusWithoutRing(trigger);
                      }
                    },
                  },
                  e('span', { className: css.dtsSelectOptionLabel, key: 'label' }, option.label),
                  isSelected ? e(CheckGlyph, { className: css.dtsSelectCheck, key: 'check' }) : null,
                );
              }),
        ),
      )
    : null;

  return e(
    'span',
    { ref: rootRef, className: clsx(css.dtsSelectRoot, props.className) },
    e(
      'button',
      {
        ref: triggerRef,
        type: 'button',
        className: css.dtsSelectTrigger,
        disabled: props.disabled === true,
        title: props.title,
        'aria-label': props.label,
        'aria-haspopup': 'listbox',
        'aria-expanded': open,
        onClick: function () {
          if (open) close(true);
          else openList();
        },
      },
      e(
        'span',
        { className: clsx(css.dtsSelectValue, selected === undefined && css.dtsSelectPlaceholder) },
        selected === undefined ? props.placeholder : selected.label,
      ),
      e(ChevronDown, { className: css.dtsSelectCaret }),
    ),
    props.portal === false ? list : (list !== null ? createPortal(list, document.body) : null),
  );
}
