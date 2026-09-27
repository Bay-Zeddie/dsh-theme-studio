/**
 * controls/StateDot.ts —— 官方 StateDot 的自写替代。
 *
 * 官方来源：lib/index.js:3040-3094（lib/types/StateDot.js，含 `syncSpinner`）+
 * lib/StateDot.module.css。
 * 抄了什么：`state` 五态 done / warning / error / idle / ongoing；`size` 缺省时
 * ongoing 14px、实心态 10px；实心态是 10px 槽 + `::after` inset 20% 的 6px 圆核；
 * ongoing 是 24 viewBox 的 SVG（整环 + 呼吸弧，共用 1.5s 周期）且**把动画起始时间
 * 钉到文档时间零点**（`animation.startTime = 0`，官方注释：不同时刻挂载的 loader
 * 否则会错相旋转）；`aria-hidden="true"` —— 名称由渲染点提供；`appearance="step"` 变体。
 * 改了什么：类名前缀 dts；官方用的 `IconCheckOutlineRegular` 图标不能 require，
 * 这里把它 16 viewBox 的路径原样内联（Step 完成态的实心勾），尺寸仍按官方 `edge - 2`。
 * 保留的行为：ongoing 的 `getAnimations({ subtree: true })` 在 ref 回调里同步，
 * 卸载时 ref 收到 null 直接返回；无 `getAnimations` 的宿主（jsdom）静默降级。
 */
import { clsx, e } from './runtime.ts';
import css from './StateDot.module.css';

/** 官方五态。 */
export type StateDotState = 'done' | 'warning' | 'error' | 'idle' | 'ongoing';

export interface StateDotProps {
  /** 显示 done、warning、ongoing、error、idle 中的哪一种。 */
  state: StateDotState;
  /** 外径 px；缺省 ongoing 14，实心态 10。 */
  size?: number;
  /** 布局定位用的额外类名。 */
  className?: string;
  /** 默认紧凑圆点；step 用实心勾或空心待办圆。 */
  appearance?: 'dot' | 'step';
}

/**
 * 把 loader 的 CSS 动画钉到文档时间零点。
 * CSS 动画在元素插入时开始，不同时刻挂载的 loader 会错相；共用一个起始时间
 * 才能让所有可见 loader 同步。
 * @param element 已挂载的 loader，卸载时为 null。
 */
function syncSpinner(element: any): void {
  if (element === null || element === undefined) return;
  var animations = typeof element.getAnimations === 'function'
    ? element.getAnimations({ subtree: true })
    : [];
  if (animations === undefined || animations === null) return;
  for (var i = 0; i < animations.length; i += 1) animations[i].startTime = 0;
}

/** Step 完成态的实心勾（官方 IconCheckOutlineRegular 的 16 viewBox 路径，1px 描边）。 */
function CheckGlyph(props: { size: number }): any {
  return e(
    'svg',
    {
      width: props.size,
      height: props.size,
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
 * 渲染一个状态点。
 * @param props.state - 显示 done、warning、ongoing、error、idle 中的哪一种。
 * @param props.size - 外径 px；缺省 ongoing 14，实心态 10。
 * @param props.className - 布局定位的额外类名。
 * @param props.appearance - 紧凑圆点（默认）或 step 变体。
 * @returns 圆点元素（aria-hidden；可访问名称请由渲染点提供）。
 */
export function StateDot(props: StateDotProps): any {
  var edge = props.size === undefined ? (props.state === 'ongoing' ? 14 : 10) : props.size;

  if (props.state === 'ongoing') {
    return e(
      'svg',
      {
        ref: syncSpinner,
        className: clsx(css.dtsSpinner, props.className),
        'data-state': 'ongoing',
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
      },
      e(
        'g',
        { className: css.dtsSpinnerMotion },
        e('circle', { className: css.dtsSpinnerTrack, cx: '12', cy: '12', r: '9.5' }),
        e('circle', { className: css.dtsSpinnerArc, cx: '12', cy: '12', r: '9.5' }),
      ),
    );
  }

  var appearance = props.appearance === undefined ? 'dot' : props.appearance;
  return e(
    'span',
    {
      className: clsx(appearance === 'step' ? css.dtsStep : css.dtsDot, props.className),
      'data-state': props.state,
      style: { width: edge, height: edge },
      'aria-hidden': 'true',
    },
    appearance === 'step' && props.state === 'done' ? e(CheckGlyph, { size: edge - 2, key: 'check' }) : null,
  );
}
