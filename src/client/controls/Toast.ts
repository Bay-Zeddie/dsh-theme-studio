/**
 * controls/Toast.ts —— 官方 Toast 的自写替代。
 *
 * 官方来源：lib/index.js:6592-6682（lib/types/Toast.js）+ lib/Toast.module.css。
 * 抄了什么：顶部居中、portal 到 body（拥有者在有 transform/filter 的祖先里也困不住它）、
 * `role="alert"`、`holdMs` 默认 3000，**保持 `holdMs` 之后才开始淡出**，
 * 卸载定时器是 `holdMs + FADE_MS(1000)`，与样式表的淡出时长共用一个真源
 * （`--dsh-toast-hold` 由组件内联写入）；`onDone` 在淡出结束后回调一次，
 * 且始终调用**最新的** onDone（ref 保存，父组件重渲染不会延长生命周期也不会用旧闭包）；
 * `holdMs` 不变时父组件重渲染不重置计时（effect 依赖只有 holdMs）；
 * `anchor` 给定时横幅跟随该元素水平中心（并监听 resize），否则以视口居中；
 * `actions` 以 "前缀 + 可点动作文字" 续在正文后面成一句，只有动作文字吃指针。
 * 改了什么：类名前缀 dts；官方在 `tone="success"` 时用的
 * `IconCheckCircleOutlineRegular` 不能 require，改为内联同一份 16 viewBox 路径。
 *
 * **核实结论（任务书要求核实 `tone` 的取值）**：官方产物里 `tone` 只有一个被识别的值 ——
 * `'success'`（渲染自带的对勾圈图形，并把图标座染成 success 色）。
 * 省略 `tone` 时图标座保持 **warning** 色（官方图标座样式的 `--dsw-alias-state-warn-label`），
 * 而不是灰色或继承色。没有任何 error/info/warning/neutral 之类的其他 tone 分支
 * （lib/index.js:6664 是唯一的 tone 判断）。
 */
import { Fragment, clsx, createPortal, e, useEffect, useLayoutEffect, useRef, useState } from './runtime.ts';
import css from './Toast.module.css';

/** 满不透明度保持时长；拥有者未给时使用的默认值。 */
var HOLD_MS = 3000;
/** 淡出时长。必须与样式表里的 toast-fade 时长一致。 */
var FADE_MS = 1000;

export interface ToastAction {
  /** 连接词之类的纯文本前缀（例如"或"），由调用方本地化。 */
  prefix?: string;
  /** 本地化的动作文案。 */
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  /** 已解析的横幅文案；拥有者传本地化后的文本。 */
  text: any;
  /** 可选的前置图形；`tone="success"` 时被忽略（自带勾圈）。 */
  icon?: any;
  /** 官方唯一取值 `'success'`：渲染设计稿的绿色勾圈作为前置图形。 */
  tone?: 'success';
  /** 可选：横幅跟随其水平中心的元素（例如 composer 卡片）。 */
  anchor?: any;
  /** 开始淡出前的满不透明度保持时长，默认 3000。 */
  holdMs?: number;
  /** 可选的续句动作。 */
  actions?: ToastAction[];
  /** 淡出完成后调用一次；在这里卸载 toast。 */
  onDone: () => void;
}

/** 官方 IconCheckCircleOutlineRegular 的路径（16 viewBox），tone='success' 的图形。 */
function CheckCircleGlyph(): any {
  return e(
    'svg',
    {
      width: 16,
      height: 16,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      strokeWidth: 1,
    },
    e('path', {
      key: 'check',
      d: 'M12.5303 6.53027L8.80273 10.2578C8.54967 10.5109 8.31796 10.7439 8.10645 10.9141C7.88375 11.0932 7.616 11.2602 7.27344 11.3145C7.09229 11.3431 6.90771 11.3431 6.72656 11.3145C6.384 11.2602 6.11625 11.0932 5.89355 10.9141C5.68204 10.7439 5.45033 10.5109 5.19727 10.2578L3.46973 8.53027L4.53027 7.46973L6.25781 9.19727C6.53457 9.47402 6.70036 9.63859 6.83398 9.74609C6.95637 9.84453 6.98241 9.83644 6.96094 9.83301C6.98679 9.83709 7.01321 9.83709 7.03906 9.83301C7.01759 9.83644 7.04363 9.84453 7.16602 9.74609C7.29964 9.63859 7.46543 9.47402 7.74219 9.19727L11.4697 5.46973L12.5303 6.53027Z',
      fill: 'currentColor',
    }),
    e('path', {
      key: 'ring',
      d: 'M14.5996 8C14.5996 4.35492 11.6451 1.40039 8 1.40039C4.35492 1.40039 1.40039 4.35492 1.40039 8C1.40039 11.6451 4.35492 14.5996 8 14.5996C11.6451 14.5996 14.5996 11.6451 14.5996 8ZM15.9004 8C15.9004 12.363 12.363 15.9004 8 15.9004C3.63695 15.9004 0.0996094 12.363 0.0996094 8C0.0996094 3.63695 3.63695 0.0996094 8 0.0996094C12.363 0.0996094 15.9004 3.63695 15.9004 8Z',
      fill: 'currentColor',
    }),
  );
}

/**
 * 顶部居中的瞬时横幅：滑入、满不透明度保持、淡出，然后报告完成让拥有者卸载它。
 * 同一段文字再次显示时（拥有者按每次显示的序号 remount），周期重新开始。
 * @param props - 见 {@link ToastProps}。
 * @returns 浮动横幅。
 */
export function Toast(props: ToastProps): any {
  var holdMs = props.holdMs === undefined ? HOLD_MS : props.holdMs;
  var latestOnDone = useRef(props.onDone);
  useLayoutEffect(function () {
    latestOnDone.current = props.onDone;
  }, [props.onDone]);

  useEffect(function () {
    var timer = setTimeout(function () {
      latestOnDone.current();
    }, holdMs + FADE_MS);
    return function () {
      clearTimeout(timer);
    };
  }, [holdMs]);

  var leftState = useState(null);
  var left = leftState[0];
  var setLeft = leftState[1];
  useLayoutEffect(function () {
    if (props.anchor === null || props.anchor === undefined) return undefined;
    var measure = function () {
      var rect = props.anchor.getBoundingClientRect();
      setLeft(rect.left + rect.width / 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return function () {
      window.removeEventListener('resize', measure);
    };
  }, [props.anchor]);

  var style: Record<string, any> = { '--dsh-toast-hold': String(holdMs) + 'ms' };
  if (left !== null) style.left = left;

  return createPortal(
    e(
      'div',
      { className: css.dtsToast, role: 'alert', style: style },
      props.tone === 'success'
        ? e('span', {
            key: 'icon',
            className: clsx(css.dtsToastIcon, css.dtsToastIconSuccess),
            'aria-hidden': true,
          }, e(CheckCircleGlyph, null))
        : (props.icon !== undefined
            ? e('span', { key: 'icon', className: css.dtsToastIcon, 'aria-hidden': true }, props.icon)
            : null),
      e(
        'span',
        { className: css.dtsToastText, key: 'text' },
        props.text,
        props.actions === undefined
          ? null
          : props.actions.map(function (action) {
              return e(
                Fragment,
                { key: action.label },
                action.prefix,
                e(
                  'button',
                  {
                    type: 'button',
                    className: css.dtsToastAction,
                    onClick: action.onClick,
                  },
                  action.label,
                ),
              );
            }),
      ),
    ),
    document.body,
  );
}
