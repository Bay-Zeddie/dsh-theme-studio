/**
 * controls/Menu.ts —— 官方 Menu / MenuItemButton 的自写替代。
 *
 * 官方来源：lib/index.js:3779-4239（lib/types/Menu.js）+ lib/Menu.module.css。
 *
 * 抄了什么（逐条对照官方 JSDoc 与实现）：
 *   - 结构：外层 `<span class=root>` 承载锚点与就地列表；列表本身是 `MenuSurface`
 *     并带 `role="menu"`；行分三种数据条目（选项 / `{type:'separator'}` / `{type:'label'}`）
 *     加 `children` 组件行；`footer` 的行钉在滚动区下方，用 hairline 分隔。
 *   - 键盘范式：列表打开期间 `↑`/`↓`（以及 Home/End）在列表中走位、Tab 选定聚焦行
 *     （从触发器按下 Tab 则进入列表）、Escape 或 Shift+Tab 关闭并把焦点还给锚点
 *     （打开时握住键盘的那个控件，取不到就退回锚点的第一个可用 button）；
 *     选定一行同样把键盘还给它 —— 除非拥有者自己移动了焦点。
 *     只拦截位于锚点或列表内的键盘，页面上别处的 Tab 仍归浏览器。
 *   - 走位细节：`walkIndex` 记住方向键最后落点，焦点离开行后按方向键从那里续走；
 *     行集合按 `button:not(:disabled)` 实时取，`Home`/`End` 跳首末行。
 *   - 关闭时机：外部 pointerdown、Escape、以及"焦点落进跨源 iframe 时唯一能收到的
 *     信号" window blur。
 *   - 焦点归还的两种路径：`refocusAnchor`（Esc / Shift+Tab，`navigation` 决定是否
 *     保留焦点指示器，走 `focusWithoutRing`）与 `refocusAfterSelection`
 *     （选完即随列表卸载，用 queueMicrotask 判断键盘是否被留在了正在关闭的列表上）。
 *   - 干扰保护：`observeComposition`（IME）、`isBehindModal`（嵌套在模态之后时不抢键盘）、
 *     `e.defaultPrevented` / 修饰键不拦截、`e.repeat` 不重复关闭。
 *   - portal 模式：从锚点矩形 fixed 定位，MARGIN=12，跟随滚动（捕获阶段）/缩放，
 *     每帧 rAF 跟踪嵌套滚动；测量期间用 visibility:hidden 的就地样式量真实尺寸。
 *   - 选中标记：`selection='check'`（尾部勾，默认）或 `'fill'`（行握 hover 填充）。
 *
 * 有意**未移植**（本层不需要，删掉比留空壳更诚实；逐条记在 05-controls-port.md）：
 *   - 嵌套子菜单（`submenu` 字段、`openSubmenuId`、`collapseSubmenuFrom` 与 .submenu 样式）；
 *   - `closeOnPointerLeave` + `usePointerGrace`（本层面板里的菜单都由点击开合）；
 *   - `shortcut` 键帽显示（需要 ShortcutKeys 组件，不在本层控件清单里）。
 * 因此这里也把官方的 "有子菜单就不加 .scrollable" 判据简化为恒真：官方在无子菜单时
 * 同样恒真，行为一致。
 */
import { clsx, e, createPortal, focusWithoutRing, isBehindModal, observeComposition, overlayTopMargin, useLayoutEffect, useRef, useState, useEffect } from './runtime.ts';
import { MenuSurface } from './MenuSurface.ts';
import css from './Menu.module.css';

/** 选项行。 */
export interface MenuOptionEntry {
  id: string;
  label: any;
  icon?: any;
  disabled?: boolean;
  /** 使用破坏性行的配色。 */
  danger?: boolean;
}

/** 分组标题行（不可交互）。 */
export interface MenuLabelEntry {
  type: 'label';
  id: string;
  text: any;
}

/** 分隔线。 */
export interface MenuSeparatorEntry {
  type: 'separator';
  id: string;
}

export type MenuEntry = MenuOptionEntry | MenuLabelEntry | MenuSeparatorEntry;

/** 官方 `MenuItemButton` 的 props：组件行与数据行走同一套样式与键盘走位。 */
export interface MenuItemButtonProps {
  /** 可见的行文案。 */
  children?: any;
  /** 可选的前置图标。 */
  icon?: any;
  /** 该行是否不可激活。 */
  disabled?: boolean;
  /** 是否使用破坏性行配色。 */
  danger?: boolean;
  /** 该行是否开启一个新分组（其上方画 hairline）。 */
  separatorBefore?: boolean;
  /** 行激活回调。关闭菜单仍是拥有者的决定。 */
  onSelect?: () => void;
  key?: any;
}

export interface MenuProps {
  /** 是否展示（拥有者受控）。 */
  open: boolean;
  /** 触发器元素（就地渲染）。 */
  anchor: any;
  /** 可选的数据行与分隔线（默认无；若 `children` 也没有，列表就是空的）。 */
  items?: MenuEntry[];
  /** 在同一列表里追加的组件行，每行一个 MenuItemButton。 */
  children?: any;
  /** 显示为选中的行 id。 */
  selectedId?: string;
  /** 菜单内含互相独立的选项组时，显示为选中的那批行 id。 */
  selectedIds?: string[];
  /** 数据行激活回调（禁用行与只开子菜单的父行不调用）。 */
  onSelect?: (id: string) => void;
  /** 外部点击、Escape，或焦点落入 iframe 时的 window blur 上调用。 */
  onClose: () => void;
  /** 列表相对锚点的对齐方式（默认 'start'）。 */
  align?: 'start' | 'end';
  /** 在锚点下方（`bottom`，默认）或上方（`top`）展开。 */
  side?: 'bottom' | 'top' | 'right';
  /** 把列表渲染进 document.body 并按其锚点矩形 fixed 定位；默认 false（纯 CSS 就地行为）。 */
  portal?: boolean;
  /** 减小行的纵向间距而不改标准排版与卡片宽度。 */
  dense?: boolean;
  /** 使用更小的菜单排版与间距。 */
  compact?: boolean;
  /** 打开时聚焦首行；两种模式下方向键都能走位。 */
  autoFocus?: boolean;
  /** portal 模式专用：直接给出锚点矩形，替代测量 Menu 自己的 wrapper span。 */
  getAnchorRect?: () => any;
  /** 钉在滚动条目区下方的行，用 hairline 分隔。 */
  footer?: MenuEntry[];
  /** 锚点 wrapper span 的额外类名。 */
  className?: string;
  /** 下拉卡片本身的额外类名；这是唯一能触达 portal 列表的样式钩子。 */
  listClassName?: string;
  /** 选中行如何标记：尾部勾（'check'，默认）或行握住 hover 填充（'fill'）。 */
  selection?: 'check' | 'fill';
}

/** 未放置的 portal 列表：隐藏但按固定原点布局，offsetWidth/offsetHeight 因此是真实值。 */
var MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 };

function isSeparator(entry: MenuEntry): entry is MenuSeparatorEntry {
  return (entry as MenuSeparatorEntry).type === 'separator';
}

function isLabel(entry: MenuEntry): entry is MenuLabelEntry {
  return (entry as MenuLabelEntry).type === 'label';
}

/** 官方 IconCheckOutlineRegular 的路径（16 viewBox / 1px 描边），用作选中标记。 */
function CheckGlyph(props: { className?: string }): any {
  return e(
    'svg',
    {
      width: 16,
      height: 16,
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
 * 渲染一个 `role="menuitem"` 行，供行本身是组件而不在 `items` 数据里的 Menu 使用：
 * 与数据行同一套 markup 与样式，因此共享列表的键盘走位与选后焦点归还，不需要任何共享状态。
 * @param props.children - 可见的行文案。
 * @param props.icon - 可选的前置图标。
 * @param props.disabled - 该行是否不可激活。
 * @param props.danger - 是否使用破坏性行配色。
 * @param props.separatorBefore - 该行是否开启新分组（其上方画 hairline）。
 * @param props.onSelect - 行激活回调。
 * @returns 一个菜单行。
 */
export function MenuItemButton(props: MenuItemButtonProps): any {
  return e(
    'div',
    { className: css.dtsMenuItemWrap },
    props.separatorBefore === true ? e('div', { className: css.dtsMenuSeparator, role: 'separator', key: 'sep' }) : null,
    e(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        className: clsx(css.dtsMenuItem, props.danger === true && css.dtsMenuDanger),
        disabled: props.disabled === true,
        onClick: props.onSelect,
      },
      props.icon !== undefined ? e('span', { className: css.dtsMenuItemIcon, key: 'icon' }, props.icon) : null,
      e('span', { className: css.dtsMenuItemLabel, key: 'label' }, props.children),
    ),
  );
}

/**
 * 渲染一个锚定的下拉菜单。
 * @param props - 见 {@link MenuProps}。
 * @returns 锚点 wrapper 与条件渲染的列表。
 */
export function Menu(props: MenuProps): any {
  var rootRef = useRef(null);
  var listRef = useRef(null);
  /** 方向键最后聚焦的下标；焦点离开行后的续走起点。 */
  var walkIndex = useRef(null);
  /**
   * 打开这个菜单时握住键盘的控件 —— 它自己的触发器。锚点如果包住多个控件
   * （分裂按钮），按位置就点不出是哪一个。
   */
  var triggerRef = useRef(null);
  var selectingWithTab = useRef(false);
  var openRef = useRef(props.open);
  openRef.current = props.open;

  var items = props.items === undefined ? [] : props.items;
  var footer = props.footer === undefined ? [] : props.footer;

  /**
   * 把键盘交还给打开菜单的触发器；锚点从未握住键盘时退给它内部第一个 button。
   * 否则焦点会落在被移除的行上、掉到页面 body，下一次 Tab 就从页面顶部重来。
   * @param navigation 显式键盘遍历是否保留焦点指示器。
   */
  var refocusAnchor = function (navigation?: boolean) {
    var trigger = triggerRef.current;
    var target = trigger !== null && document.contains(trigger) && !trigger.disabled
      ? trigger
      : (rootRef.current === null ? null : rootRef.current.querySelector('button:not(:disabled)'));
    if (target === null || target === undefined) return;
    if (navigation === true) target.focus();
    else focusWithoutRing(target);
  };

  /**
   * 行随列表一起卸载的那些路径上的选后焦点。拥有者选择保持菜单打开时不干预；
   * 自己移动了焦点的拥有者（例如把焦点交给预览按钮）同样不干预：只有键盘留在
   * 正在关闭的列表上（或留在列表移除后产生的 body 上）时才回到触发器。
   */
  var refocusAfterSelection = function () {
    var navigation = selectingWithTab.current === true;
    queueMicrotask(function () {
      if (openRef.current) return;
      var active = document.activeElement;
      if (active === null || active === document.body
        || (listRef.current !== null && listRef.current.contains(active))) {
        refocusAnchor(navigation);
      }
    });
  };

  var fixedPosState = useState(null);
  var fixedPos = fixedPosState[0];
  var setFixedPos = fixedPosState[1];

  useLayoutEffect(function () {
    if (!props.open || props.portal !== true) {
      setFixedPos(null);
      return undefined;
    }
    var place = function () {
      var r;
      if (props.getAnchorRect !== undefined) r = props.getAnchorRect();
      else r = rootRef.current === null ? null : rootRef.current.getBoundingClientRect();
      if (r === null || r === undefined) return;
      var MARGIN = 12;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var listEl = listRef.current;
      var lw = listEl === null || listEl === undefined ? 0 : listEl.offsetWidth;
      var lh = listEl === null || listEl === undefined ? 0 : listEl.offsetHeight;
      var x;
      var y;
      if (props.side === 'right') {
        x = r.right + 4;
        y = r.top;
      } else if (props.align !== 'end') {
        x = r.left;
        y = props.side === 'bottom' || props.side === undefined ? r.bottom + 4 : r.top - lh - 4;
      } else {
        x = r.right - lw;
        y = props.side === 'bottom' || props.side === undefined ? r.bottom + 4 : r.top - lh - 4;
      }
      if (lw > 0) x = Math.min(Math.max(x, MARGIN), vw - lw - MARGIN);
      if (lh > 0) y = Math.min(Math.max(y, overlayTopMargin(MARGIN)), vh - lh - MARGIN);
      setFixedPos(function (current: any) {
        if (current !== null && current !== undefined && current.left === x && current.top === y) return current;
        return { left: x, top: y };
      });
    };
    place();
    var frame = requestAnimationFrame(function track() {
      place();
      frame = requestAnimationFrame(track);
    });
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return function () {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [props.open, props.portal, props.align, props.side, props.getAnchorRect]);

  useEffect(function () {
    if (!props.open) {
      triggerRef.current = null;
      return;
    }
    var active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement
      && rootRef.current !== null && rootRef.current.contains(active)
      ? active
      : null;
  }, [props.open]);

  useEffect(function () {
    if (!props.open || props.autoFocus !== true) return;
    var first = listRef.current === null ? null : listRef.current.querySelector('button:not(:disabled)');
    walkIndex.current = first === undefined || first === null ? null : 0;
    if (first !== null && first !== undefined) focusWithoutRing(first);
  }, [props.open, props.autoFocus]);

  useEffect(function () {
    if (!props.open) {
      walkIndex.current = null;
      return undefined;
    }
    var composition = observeComposition(document);

    var onPointerDown = function (event: any) {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
      if (listRef.current !== null && listRef.current.contains(event.target)) return;
      props.onClose();
    };

    var onKeyDown = function (event: any) {
      if (composition.guards(event) || isBehindModal(rootRef.current) || event.defaultPrevented
        || event.ctrlKey || event.altKey || event.metaKey) return;
      var focused = document.activeElement;
      var insideList = listRef.current !== null && listRef.current.contains(focused);
      var anchored = (rootRef.current !== null && rootRef.current.contains(focused)) || insideList;

      if (event.key === 'Escape' && !event.shiftKey) {
        event.preventDefault();
        if (event.repeat) return;
        props.onClose();
        if (anchored || props.autoFocus === true) refocusAnchor();
      }

      if (event.key === 'Tab') {
        var list = listRef.current;
        if (list === null || !anchored) return;
        if (event.shiftKey) {
          event.preventDefault();
          props.onClose();
          refocusAnchor(true);
          return;
        }
        if (insideList) {
          if (focused instanceof HTMLElement && focused.getAttribute('role') === 'menuitem') {
            event.preventDefault();
            selectingWithTab.current = true;
            try {
              focused.click();
            } finally {
              selectingWithTab.current = false;
            }
          }
          return;
        }
        var row = list.querySelector('button:not(:disabled)');
        if (row === null) return;
        event.preventDefault();
        row.focus();
        walkIndex.current = 0;
        return;
      }

      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) < 0) return;
      var target = listRef.current;
      if (target === null || !anchored) return;
      var buttons = Array.prototype.slice.call(target.querySelectorAll('button:not(:disabled)'));
      if (buttons.length === 0) return;
      var index = buttons.indexOf(focused);
      var from = index >= 0 ? index : walkIndex.current;
      var next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else if (from === null) next = event.key === 'ArrowDown' ? 0 : buttons.length - 1;
      else next = (from + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault();
      walkIndex.current = next;
      if (buttons[next] !== undefined) buttons[next].focus();
    };

    var onWindowBlur = function () {
      if (document.activeElement instanceof HTMLIFrameElement) props.onClose();
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
    window.addEventListener('blur', onWindowBlur);
    return function () {
      composition.dispose();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onOtherKey);
      document.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [props.open, props.onClose, props.autoFocus]);

  var renderEntry = function (entry: MenuEntry) {
    if (isSeparator(entry)) {
      return e('div', { className: css.dtsMenuSeparator, role: 'separator', key: entry.id });
    }
    if (isLabel(entry)) {
      return e('div', { className: css.dtsMenuLabel, role: 'presentation', key: entry.id }, entry.text);
    }
    var selected = entry.id === props.selectedId
      || (props.selectedIds !== undefined && props.selectedIds.indexOf(entry.id) >= 0);
    return e(
      'div',
      { className: css.dtsMenuItemWrap, key: entry.id },
      e(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: clsx(
            css.dtsMenuItem,
            selected && (props.selection === 'fill' ? css.dtsMenuSelectedFill : css.dtsMenuSelected),
            entry.danger === true && css.dtsMenuDanger,
          ),
          disabled: entry.disabled === true,
          onClick: function () {
            if (props.onSelect !== undefined) props.onSelect(entry.id);
          },
        },
        entry.icon !== undefined ? e('span', { className: css.dtsMenuItemIcon, key: 'icon' }, entry.icon) : null,
        e('span', { className: css.dtsMenuItemLabel, key: 'label' }, entry.label),
        selected && props.selection !== 'fill'
          ? e(CheckGlyph, { className: css.dtsMenuCheck, key: 'check' })
          : null,
      ),
    );
  };

  var list = props.open
    ? e(
        MenuSurface,
        {
          compact: props.compact === true,
          ref: listRef,
          className: clsx(
            css.dtsMenuList,
            props.listClassName,
            props.dense === true && css.dtsMenuDenseList,
            props.compact === true && css.dtsMenuCompactList,
            css.dtsMenuScrollable,
            props.portal === true && css.dtsMenuPortal,
            props.side === 'top' && props.portal !== true && css.dtsMenuSideTop,
            props.align === 'end' && props.portal !== true && css.dtsMenuAlignEnd,
          ),
          style: props.portal === true ? (fixedPos === null ? MEASURE_STYLE : fixedPos) : undefined,
          role: 'menu',
          onClick: function (event: any) {
            event.stopPropagation();
            var row = event.target instanceof Element
              ? event.target.closest('button[role="menuitem"]')
              : null;
            if (row !== null) refocusAfterSelection();
          },
        },
        e(
          'div',
          { className: css.dtsMenuViewport, role: 'presentation', key: 'viewport' },
          items.map(renderEntry),
          props.children,
        ),
        footer.length > 0
          ? e('div', { className: css.dtsMenuFooter, role: 'presentation', key: 'footer' }, footer.map(renderEntry))
          : null,
      )
    : null;

  return e(
    'span',
    { ref: rootRef, className: clsx(css.dtsMenuRoot, props.className) },
    props.anchor,
    props.portal === true
      ? (list !== null ? createPortal(list, document.body) : null)
      : list,
  );
}
