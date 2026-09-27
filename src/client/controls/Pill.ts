/**
 * controls/Pill.ts —— 官方 Pill 的自写替代。
 *
 * 官方来源：lib/index.js:3192-3211（lib/types/Pill.js）+ lib/Pill.module.css。
 * 抄了什么：`onClick` 存在时渲染 `<button>`（可选中胶囊），否则渲染静态 `<span>`——
 * 这是官方的关键判据，不是装饰；`active` 默认 false；`...rest` **在 onClick 之后**展开
 * （官方顺序也如此，SegmentedTabs 正是靠这一点把 role/aria-selected/tabIndex/id/onKeyDown
 * 灌进来，且这套顺序必须原样保留）。
 * 改了什么：类名前缀 dts。
 * 保留的行为：`active` 是"已选中"的视觉态；可交互形态的键盘可达性来自原生 button。
 */
import { clsx, e } from './runtime.ts';
import css from './Pill.module.css';

export interface PillProps {
  /** 选中/激活的视觉态。 */
  active?: boolean;
  className?: string;
  children?: any;
  /** 有 onClick ⇒ 渲染可交互 button；没有 ⇒ 渲染静态 span。 */
  onClick?: (event?: any) => void;
  /** 其余属性透传到 button（仅可交互形态）。 */
  [nativeAttribute: string]: any;
}

/**
 * 渲染一枚胶囊 chip。给出 `onClick` 时可交互（渲染 button）；否则是静态 span。
 * @param props.active - 选中/激活的视觉态。
 * @returns 胶囊元素。
 */
export function Pill(props: PillProps): any {
  if (!props.onClick) {
    return e(
      'span',
      { className: clsx(css.dtsPill, props.active && css.dtsPillActive, props.className) },
      props.children,
    );
  }
  var rest: Record<string, any> = {};
  for (var key in props) {
    if (key === 'active' || key === 'className' || key === 'children' || key === 'onClick') continue;
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    rest[key] = props[key];
  }
  return e(
    'button',
    Object.assign(
      {
        type: 'button',
        className: clsx(
          css.dtsPill,
          css.dtsPillInteractive,
          props.active && css.dtsPillActive,
          props.className,
        ),
        onClick: props.onClick,
      },
      rest,
    ),
    props.children,
  );
}
