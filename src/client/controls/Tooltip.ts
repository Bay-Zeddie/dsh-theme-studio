/**
 * controls/Tooltip.ts —— 官方 Tooltip 的自写替代。
 *
 * 官方来源：lib/index.js:4486-4689（lib/types/Tooltip.js）+ lib/Tooltip.module.css
 * + lib/index.js:4422-4485（lib/types/input-modality.js 的语义）。
 * 抄了什么（官方点名要保的"定位不触发 React 渲染"就在这里）：
 *   - **锚定克隆子元素**：`cloneElement(children, { ref: mergedRef, onMouseEnter/Leave/Click/Focus/Blur })`，
 *     子元素自己的 ref（callback 或对象）与 tooltip 的 ref 一起转发，子元素原有同名处理器先被调用
 *     再执行 tooltip 逻辑；
 *   - **定位不触发 React 渲染**：位置只在 `show()` 时算一次矩形写进 state，之后气泡的
 *     横向视口钳制、上下翻转、`data-side` 的改写全部直接写 DOM（`el.style.left/top`、
 *     `el.dataset.side`），并由 `ResizeObserver(box: 'border-box')` + window resize 驱动；
 *     首帧没有尺寸前气泡 `visibility: hidden`（不闪现在错误位置）；
 *   - **聚焦按输入模态决定**：`onFocus` 时若最近一次输入来自指针（`pointerModality()`）则**不弹**，
 *     键盘聚焦立即弹出（不受 `delayMs` 影响）；`onClick` 收起并把 focus 标记清掉；
 *     指针离开、失焦都会收起，show 定时器成对清理；
 *   - `portal`：把气泡渲染到 document.body，逃出祖先的裁剪与层叠上下文；默认 false（就地）。
 * 改了什么：类名前缀 dts；不引 `ShortcutKeys`（键帽不在本层控件清单），因此没有
 * `shortcutKeys` prop、没有 `[data-has-shortcut]` 样式、也不写只有键帽才需要的那条
 * `aria-label`；不引 `TooltipSuppression` 上下文（官方用它让嵌套的 HoverCard/灯箱让位，
 * 本层没有这两个组件）。`label` 因此成为必填。
 * 监听器纪律：`ResizeObserver` + window resize 随 effect 成对摘除；
 * 输入模态走 runtime 的**引用计数订阅**（首个 Tooltip 挂、最后一个摘），不留常驻全局监听。
 */
import { Fragment, cloneElement, createPortal, e, pointerModality, subscribeInputModality, useCallback, useEffect, useRef, useState } from './runtime.ts';
import css from './Tooltip.module.css';

export interface TooltipProps {
  /** 气泡文本，或只在可见时才求值的解析函数；必填。 */
  label: string | (() => string);
  /** 相对锚点的位置（默认 'right'）。 */
  side?: 'right' | 'bottom' | 'top';
  /** 'bottom'/'top' 气泡的横向锚边对齐：'end' 把气泡右边缘钉在锚点右边缘（默认 'center'）。 */
  align?: 'center' | 'end';
  /** 悬停延迟毫秒；键盘聚焦始终立即显示。 */
  delayMs?: number;
  /** 'bottom'/'top' 气泡与锚点的距离像素（默认 8）；side='right' 时忽略。 */
  gap?: number;
  /** 为真时抑制气泡；锚点渲染完全不变（切换不会 remount 掉它的 CSS 过渡）。 */
  disabled?: boolean;
  /** 把气泡渲染到 document.body 之下，逃出祖先裁剪或层叠上下文。 */
  portal?: boolean;
  /** 气泡宽度上限像素。 */
  maxWidth?: number;
  /** 单个锚点元素；它自己的 ref 会与本组件的 ref 一起被转发。 */
  children: any;
}

/**
 * 给锚点元素挂一个悬停/聚焦提示。
 * @param props - 见 {@link TooltipProps}。
 * @returns 克隆后的锚点，外加可选的 fixed 定位气泡。
 */
export function Tooltip(props: TooltipProps): any {
  var anchor = useRef(null);
  var childRef = props.children === null || props.children === undefined ? undefined : props.children.ref;
  var mergedRef = useCallback(function (el: any) {
    anchor.current = el;
    if (typeof childRef === 'function') childRef(el);
    else if (childRef !== null && childRef !== undefined) childRef.current = el;
  }, [childRef]);

  var posState = useState(null);
  var pos = posState[0];
  var setPos = posState[1];
  var bubble = useRef(null);

  var side = props.side === undefined ? 'right' : props.side;
  var align = props.align === undefined ? 'center' : props.align;
  var gap = props.gap === undefined ? 8 : props.gap;
  var disabled = props.disabled === true;
  var portal = props.portal === true;

  var resolvedLabel = pos === null ? null : (typeof props.label === 'function' ? props.label() : props.label);
  var y = pos === null ? 0 : side === 'right' ? pos.top + (pos.bottom - pos.top) / 2 : side === 'top' ? pos.top - gap : pos.bottom + gap;

  var showTimer = useRef(null);
  var triggers = useRef({ hover: false, focus: false });
  var visible = pos !== null && !disabled;

  /* 输入模态的引用计数订阅：Tooltip 全部卸载后监听随之摘除。 */
  useEffect(function () {
    return subscribeInputModality();
  }, []);

  useEffect(function () {
    var el = bubble.current;
    if (pos === null || !visible || el === null || el === undefined) return undefined;
    var edgeMargin = 12;
    var size: any;
    var placement = side;
    var fit = function () {
      if (size === undefined) return;
      var width = size.inlineSize;
      var height = size.blockSize;
      var offset = side === 'right' ? 0 : align === 'end' ? width : width / 2;
      var left = Math.max(edgeMargin, Math.min(pos.x - offset, window.innerWidth - edgeMargin - width));
      var fitsBelow = pos.bottom + gap + height <= window.innerHeight - edgeMargin;
      var fitsAbove = pos.top - gap - height >= edgeMargin;
      if (placement === 'bottom' && !fitsBelow && fitsAbove) placement = 'top';
      else if (placement === 'top' && !fitsAbove && fitsBelow) placement = 'bottom';
      el.style.left = String(left + offset) + 'px';
      el.style.top = String(
        placement === 'right' ? (pos.top + pos.bottom) / 2 : placement === 'top' ? pos.top - gap : pos.bottom + gap,
      ) + 'px';
      el.dataset.side = placement;
      el.style.visibility = 'visible';
    };
    var observer = new ResizeObserver(function (entries: any[]) {
      size = entries[0].borderBoxSize[0];
      fit();
    });
    observer.observe(el, { box: 'border-box' });
    window.addEventListener('resize', fit);
    return function () {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [align, gap, pos, side, visible]);

  var cancelShow = useCallback(function () {
    if (showTimer.current === null || showTimer.current === undefined) return;
    clearTimeout(showTimer.current);
    showTimer.current = null;
  }, []);

  useEffect(function () {
    if (disabled) {
      cancelShow();
      triggers.current = { hover: false, focus: false };
      setPos(null);
    }
    return cancelShow;
  }, [cancelShow, disabled]);

  var show = function () {
    if (disabled) return;
    var el = anchor.current;
    if (el === null || el === undefined) return;
    var r = el.getBoundingClientRect();
    setPos({
      x: side === 'right' ? r.right + 10 : align === 'end' ? r.right : r.left + r.width / 2,
      top: r.top,
      bottom: r.bottom,
    });
  };

  var showAfterHoverDelay = function () {
    cancelShow();
    if (props.delayMs === undefined || props.delayMs <= 0) {
      show();
      return;
    }
    showTimer.current = setTimeout(function () {
      showTimer.current = null;
      show();
    }, props.delayMs);
  };

  var hide = function () {
    cancelShow();
    if (!triggers.current.hover && !triggers.current.focus) setPos(null);
  };

  var content = visible
    ? e(
        'span',
        {
          ref: bubble,
          className: css.dtsTooltipBubble,
          'data-side': side,
          'data-portal': portal || undefined,
          'data-align': align,
          style: Object.assign(
            { left: pos.x, top: y, visibility: 'hidden' },
            props.maxWidth === undefined ? {} : { maxWidth: props.maxWidth },
          ),
          role: 'tooltip',
        },
        resolvedLabel
          ? e('span', { className: css.dtsTooltipLabel, key: 'label' }, resolvedLabel)
          : null,
      )
    : null;

  var child = props.children;
  var cloned = cloneElement(child, {
    ref: mergedRef,
    onMouseEnter: function (event: any) {
      if (child.props.onMouseEnter !== undefined) child.props.onMouseEnter(event);
      triggers.current.hover = true;
      showAfterHoverDelay();
    },
    onMouseLeave: function (event: any) {
      if (child.props.onMouseLeave !== undefined) child.props.onMouseLeave(event);
      triggers.current.hover = false;
      cancelShow();
      setPos(null);
    },
    onClick: function (event: any) {
      if (child.props.onClick !== undefined) child.props.onClick(event);
      triggers.current.focus = false;
      cancelShow();
      setPos(null);
    },
    onFocus: function (event: any) {
      if (child.props.onFocus !== undefined) child.props.onFocus(event);
      if (pointerModality()) return;
      triggers.current.focus = true;
      cancelShow();
      show();
    },
    onBlur: function (event: any) {
      if (child.props.onBlur !== undefined) child.props.onBlur(event);
      triggers.current.focus = false;
      hide();
    },
  });

  if (!portal) return e(Fragment, null, cloned, content);
  return e(
    Fragment,
    null,
    cloned,
    content !== null ? createPortal(content, document.body) : null,
  );
}
