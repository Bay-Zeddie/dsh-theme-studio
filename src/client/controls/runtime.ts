/**
 * controls/runtime.ts —— 自写控件层的**内部**运行时垫片。
 *
 * 存在的唯一理由：官方规范禁止插件 `require('@deepseek-ai/dsh-client-ui-primitives')`
 * （references_practices.md:35），控件必须自写。自写之后有四个东西是所有控件共用的，
 * 与其在 19 个控件里各抄一遍，不如集中一份：
 *
 *   1. react 基座 —— 与 src/client/deps.ts 同形（裸 `require('react')`，由 loader 注入）；
 *   2. `e` / `clsx` —— createElement 简写与类名拼接（官方 clsx 的等价最小面）；
 *   3. 宿主 DOM 契约 —— `focusWithoutRing` / `overlayTopMargin` / `observeComposition` /
 *      `isBehindModal` / `useModalLayer` / `useAnchoredPosition`；
 *   4. 输入模态 —— Tooltip 判断"这次聚焦是否来自键盘"。
 *
 * 全部逐字抄自官方产物，来源：
 *   - focusWithoutRing            lib/index.js:3594-3631（lib/types/focus.js）
 *   - useModalLayer/isBehindModal lib/index.js:3632-3719（lib/types/useModalLayer.js）
 *   - observeComposition          lib/index.js:3551-3592（lib/types/keyboard-composition.js）
 *   - overlayTopMargin            lib/index.js:3504-3520（lib/types/overlay-top-margin.js）
 *   - useAnchoredPosition         lib/index.js:4288-4356（lib/types/useAnchoredPosition.js）
 *   - 输入模态语义                lib/index.js:4422-4485（lib/types/input-modality.js）
 *
 * 与官方实现的两处**有意差异**（本层纪律要求，见 ui-align/05-controls-port.md）：
 *   - 输入模态不装模块级常驻监听：官方在 import 期即挂 window 监听且永不卸载；
 *     本层改为**引用计数**订阅（首个订阅者挂、最后一个卸载时摘），既保留
 *     "指针交互后聚焦不弹 Tooltip" 的行为，又不留常驻全局监听。
 *   - 不写 `data-input-modality` 属性：那是宿主（web 壳自带的 ui-primitives）发布的
 *     全局事实，本层只读、不与之争抢写权。
 */

/* ============================================================ */
/* react 基座                                                     */
/* ============================================================ */

/** 与 deps.ts 同形：裸 require 交给 loader。 */
export var React: any = require('react');

/**
 * ⚠️ `createPortal` 在 **react-dom** 上，**不在 react 上** —— `React.createPortal` 恒为 `undefined`。
 * 官方 9 键基座表含 `react-dom`，裸 require 合法（与 `deps.ts` 同形）。
 * 实证：写成 `React.createPortal` 会让 6 个 portal 化控件（MenuSurface / Modal / Toast /
 * Tooltip / Select / Menu）在真实运行时抛 `createPortal is not a function` —— 也就是官方
 * `SKILL.md:21` 特意警告的 `slot entry crashed in '<slot>'`（整个 slot 条目白屏）。
 * 本机真实 Chromium 渲染冒烟抓到的就是这个（见 `ui-align/_smoke/`）。
 */
export var ReactDOM: any = require('react-dom');
export var createPortal: any = ReactDOM.createPortal;
export var forwardRef: any = React.forwardRef;
export var memo: any = React.memo;
export var Fragment: any = React.Fragment;
export var cloneElement: any = React.cloneElement;
export var useCallback: any = React.useCallback;
export var useEffect: any = React.useEffect;
export var useId: any = React.useId;
export var useLayoutEffect: any = React.useLayoutEffect;
export var useMemo: any = React.useMemo;
export var useRef: any = React.useRef;
export var useState: any = React.useState;

/**
 * createElement 简写。
 * 与 deps.ts 的 `e` 同形：可变子节点走 rest params（不要改箭头函数 + arguments）。
 */
export function e(type: any, props?: any, ...children: any[]): any {
  return React.createElement.apply(React, [type, props].concat(children));
}

/** 官方 clsx 的最小等价面：字符串保留，假值与别的类型丢弃。 */
export function clsx(...parts: any[]): string {
  var out: string[] = [];
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    if (typeof part === 'string' && part !== '') out.push(part);
  }
  return out.join(' ');
}

/* ============================================================ */
/* 宿主发布的框架属性（只读，不写）                                 */
/* ============================================================ */

/** 官方 focus.js 的自动聚焦标记；对应样式由 ui-theme 的 base.css 提供。 */
export var AUTOMATIC_FOCUS_ATTRIBUTE = 'data-dsh-automatic-focus';

/* ============================================================ */
/* 浮层几何                                                       */
/* ============================================================ */

/**
 * 浮层距视口顶边的净空。macOS 桌面由框架在根元素发布
 * `--dsh-frame-top-clearance`（红绿灯条下方的恒定步进）；别处该属性缺省，
 * 直接用调用方给的下限。
 * @param min 浮层自己的视口边距（px），作为下限。
 * @returns `min` 与框架发布的顶边净空中的较大者。
 */
export function overlayTopMargin(min: number): number {
  var clearance = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-top-clearance'),
  );
  return Number.isNaN(clearance) ? min : Math.max(min, clearance);
}

/** 官方 Menu 的 portal 视口边距（Menu.tsx MARGIN）。 */
export var OVERLAY_MARGIN = 12;

/**
 * 把 fixed 定位的浮动面板锚在触发器上（官方 useAnchoredPosition 逐字）。
 * 面板从锚点的视口矩形定位，滚一下就不再成立——这个钩子只管这一件事：
 * 量锚点、按上下偏移、把结果钳进视口，并在滚动（捕获阶段，覆盖嵌套滚动容器）、
 * 缩放、面板自身尺寸变化时重算。
 * @param options 开关状态、两个 ref、placement 与间距。
 * @returns 面板的 `left`/`top`，首次测量前为 null。
 */
export function useAnchoredPosition(options: any): any {
  var open = options.open;
  var anchorRef = options.anchorRef;
  var panelRef = options.panelRef;
  var side = options.side === undefined ? 'bottom' : options.side;
  var align = options.align === undefined ? 'start' : options.align;
  var gap = options.gap;
  var margin = options.margin;
  var state = useState(null);
  var position = state[0];
  var setPosition = state[1];

  useLayoutEffect(function () {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    var place = function () {
      var rect = anchorRef.current === null || anchorRef.current === undefined
        ? undefined
        : anchorRef.current.getBoundingClientRect();
      if (rect === undefined) return;
      var panel = panelRef.current;
      var width = panel === null || panel === undefined ? 0 : panel.offsetWidth;
      var height = panel === null || panel === undefined ? 0 : panel.offsetHeight;
      var left = align === 'end' ? rect.right - width : rect.left;
      var top = side === 'top' ? rect.top - gap - height : rect.bottom + gap;
      if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
      if (height > 0) top = Math.min(Math.max(top, margin), window.innerHeight - height - margin);
      setPosition({ left: left, top: top });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    var panel = panelRef.current;
    var observer = null;
    if (typeof ResizeObserver !== 'undefined' && panel !== null && panel !== undefined) {
      observer = new ResizeObserver(place);
      observer.observe(panel);
    }
    return function () {
      if (observer !== null) observer.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchorRef, panelRef, side, align, gap, margin]);

  return position;
}

/* ============================================================ */
/* 焦点呈现                                                       */
/* ============================================================ */

/** 自动进入与归还焦点时的呈现策略（官方 focus.js releases 表）。 */
var releases = new WeakMap();

var navigationKeys = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);

/**
 * 自动目的地聚焦但不画焦点框，直到键盘导航或失焦。
 * 主题在 `data-dsh-automatic-focus` 存在时抑制轮廓；边框与阴影保持。
 * @param element 接收自动聚焦的控件或容器。
 * @param options 浏览器 focus 选项（含 scroll 保持）。
 */
export function focusWithoutRing(element: any, options?: any): void {
  var existing = releases.get(element);
  if (existing !== undefined) existing();
  var release = function () {
    element.removeAttribute(AUTOMATIC_FOCUS_ATTRIBUTE);
    element.removeEventListener('blur', release);
    element.removeEventListener('keydown', navigate, true);
    releases.delete(element);
  };
  var navigate = function (event: any) {
    if (!event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey && navigationKeys.has(event.key)) {
      release();
    }
  };
  releases.set(element, release);
  element.setAttribute(AUTOMATIC_FOCUS_ATTRIBUTE, '');
  element.addEventListener('blur', release);
  element.addEventListener('keydown', navigate, true);
  element.focus(options);
  if (!element.matches(':focus')) release();
}

/* ============================================================ */
/* 输入法（IME）保护                                              */
/* ============================================================ */

/**
 * 观察 composition 直到其结束键被释放或消费（官方 keyboard-composition.js 逐字）。
 * 调用方**必须**在交互生命周期结束时调用 `dispose()`。
 * @param doc 事件归属的 document。
 * @returns 事件守卫与释放器。
 */
export function observeComposition(doc: any): any {
  var composing = false;
  var ended = false;
  var start = function () {
    composing = true;
  };
  var end = function () {
    composing = false;
    ended = true;
  };
  var release = function () {
    ended = false;
  };
  var blur = function () {
    composing = false;
    ended = false;
  };
  doc.addEventListener('compositionstart', start, true);
  doc.addEventListener('compositionend', end, true);
  doc.addEventListener('keyup', release, true);
  if (doc.defaultView !== null && doc.defaultView !== undefined) doc.defaultView.addEventListener('blur', blur);
  return {
    guards: function (event: any) {
      var guarded = composing || ended || event.isComposing || event.keyCode === 229;
      ended = false;
      return guarded;
    },
    dispose: function () {
      doc.removeEventListener('compositionstart', start, true);
      doc.removeEventListener('compositionend', end, true);
      doc.removeEventListener('keyup', release, true);
      if (doc.defaultView !== null && doc.defaultView !== undefined) doc.defaultView.removeEventListener('blur', blur);
    },
  };
}

/* ============================================================ */
/* 模态层                                                         */
/* ============================================================ */

/** 决定前台键盘归属的 dialog 与 menu 元素（文档序即层级）。 */
var modalSelector = '[role="dialog"][aria-modal="true"], [role="menu"], [role="listbox"]';

/** document → 该文档已注册的模态层栈。 */
var layers = new WeakMap();

/**
 * 锚点是否位于当前模态之后、必须让出键盘输入。
 * @param anchor 持有输入处理的本地控件。
 * @returns 另一个模态占据前台时为 true。
 */
export function isBehindModal(anchor: any): boolean {
  if (anchor === null || anchor === undefined) return false;
  var stack = layers.get(anchor.ownerDocument);
  var top = stack === undefined ? undefined : stack[stack.length - 1];
  return top !== undefined && !top.element.contains(anchor);
}

var focusable =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]';

/**
 * 只把 Escape 与 Tab 交给最上层模态，关闭时归还先前的焦点（官方 useModalLayer 逐字）。
 * 自动进入与归还焦点不画轮廓；键盘遍历保留指示器。
 * 用 `data-modal-autofocus` 标记弹窗的初始控件（React autoFocus 会先于本层保存触发控件）。
 * @param dialog 已挂载的 dialog 元素 ref。
 * @param open 本层是否生效。
 * @param onClose 顶层 Escape 或应用关闭动作。
 */
export function useModalLayer(dialog: any, open: boolean, onClose: () => void): void {
  var close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(function () {
    var element = dialog.current;
    if (!open || element === null || element === undefined) return undefined;
    var doc = element.ownerDocument;
    var composition = observeComposition(doc);
    var previous = doc.activeElement;
    var stack = layers.get(doc);
    if (stack === undefined) {
      stack = [];
      layers.set(doc, stack);
    }
    var layer = {
      element: element,
      close: function () {
        close.current();
      },
    };
    stack.push(layer);

    var initial =
      element.querySelector('[data-modal-autofocus]') ||
      element.querySelector(focusable) ||
      element;
    if (!element.contains(doc.activeElement)) focusWithoutRing(initial);

    var keydown = function (event: any) {
      var composing = composition.guards(event);
      if (stack[stack.length - 1] !== layer || event.defaultPrevented || composing
        || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === 'Escape' && !event.shiftKey) {
        event.preventDefault();
        if (!event.repeat) close.current();
      }
      if (event.key !== 'Tab') return;
      if (doc.activeElement !== null && doc.activeElement.closest !== undefined
        && doc.activeElement.closest('[role="menu"], [role="listbox"]') !== null) return;
      var items = Array.prototype.slice.call(element.querySelectorAll(focusable)).filter(function (item: any) {
        return item.closest('[inert], [hidden]') === null;
      });
      var first = items.length === 0 ? element : items[0];
      var last = items.length === 0 ? element : items[items.length - 1];
      var atEdge = event.shiftKey ? doc.activeElement === first : doc.activeElement === last;
      if (doc.activeElement === element || !element.contains(doc.activeElement) || atEdge) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    doc.addEventListener('keydown', keydown);
    return function () {
      composition.dispose();
      var wasTop = stack[stack.length - 1] === layer;
      stack.splice(stack.indexOf(layer), 1);
      doc.removeEventListener('keydown', keydown);
      if (stack.length === 0) layers.delete(doc);
      if (wasTop) {
        var target = previous instanceof HTMLElement && previous.isConnected
          ? previous
          : (stack.length === 0 ? undefined : stack[stack.length - 1].element);
        if (target !== undefined) focusWithoutRing(target);
      }
    };
  }, [dialog, open]);
}

/* ============================================================ */
/* 输入模态（引用计数订阅）                                        */
/* ============================================================ */

/** `data-input-modality` 的取值（宿主 ui-theme 的焦点样式也读它）。 */
export var INPUT_MODALITY = { pointer: 'pointer', keyboard: 'keyboard' };

var pointerLast = false;
var subscriberCount = 0;
var detachModality: any = null;

function seedModalityFromHost(): void {
  var published = document.documentElement.getAttribute('data-input-modality');
  if (published === INPUT_MODALITY.pointer) pointerLast = true;
  else if (published === INPUT_MODALITY.keyboard) pointerLast = false;
}

/**
 * 最近一次输入是否来自指针（与焦点环是否可见无关）。
 * @returns 指针输入之后为 true；任意按键之后为 false。
 */
export function pointerModality(): boolean {
  return pointerLast;
}

/**
 * 按引用计数订阅输入模态：首个订阅者挂 window 监听，最后一个卸载时摘掉。
 * 初值从宿主已发布的 `data-input-modality` 播种（只读，不写回）。
 * @returns 退订函数（务必在 effect 的清理里调用）。
 */
export function subscribeInputModality(): () => void {
  if (subscriberCount === 0 && typeof window !== 'undefined') {
    seedModalityFromHost();
    var onPointerDown = function () {
      pointerLast = true;
    };
    var onKeyDown = function () {
      pointerLast = false;
    };
    var onBlur = function () {
      pointerLast = false;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    detachModality = function () {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }
  subscriberCount += 1;
  var disposed = false;
  return function () {
    if (disposed) return;
    disposed = true;
    subscriberCount -= 1;
    if (subscriberCount === 0 && detachModality !== null) {
      detachModality();
      detachModality = null;
    }
  };
}
