/**
 * controls/Input.ts —— 官方 Input 的自写替代。
 *
 * 官方来源：lib/index.js:3485-3502（lib/types/Input.js）+ lib/Input.module.css。
 * 抄了什么：wrapper `span` 承载 `className` 与几何（H32 / R12 / 0.5px border-l4 /
 * bg-layer-1 / focus-within 换 business 描边），可选 16px 前置图标，内层原生 input
 * 承接其余全部属性（`flex:1` 无边框无轮廓，14/22 主标签色，placeholder 用 label-dimmed）。
 * 改了什么：类名前缀 dts；**追加**可选的 `label` prop —— 官方把命名权完全交给调用方，
 * 本层按纪律「面向用户的控件必须有名称」把它落到内层 input 的 aria-label 上
 * （调用方已显式传 `aria-label` 时不覆盖）。
 * 保留的行为：原生 input 的全部键盘与表单语义（透传）。
 */
import { clsx, e } from './runtime.ts';
import css from './Input.module.css';

export interface InputProps {
  /** 可选的前置 16px 图标节点。 */
  icon?: any;
  /** 布局定位用的额外类名；按官方约定落在 wrapper 上，不在内层 input 上。 */
  className?: string;
  /** 无障碍名称；落到内层 input 的 aria-label。官方无此 prop，本层为满足命名纪律追加。 */
  label?: string;
  /** 原生 input 属性透传（value / placeholder / disabled / onChange / type / aria-*…）。 */
  [nativeAttribute: string]: any;
}

/**
 * 渲染一个带可选前置图标的文本输入。
 * @param props.icon - 可选的前置 16px 图标节点。
 * @param props.className - 落在 wrapper 上的布局类名。
 * @param props.label - 无障碍名称（落到内层 input 的 aria-label）。
 * @returns 包住原生 input 的 wrapper span；input 属性透传。
 */
export function Input(props: InputProps): any {
  var rest: Record<string, any> = {};
  for (var key in props) {
    if (key === 'icon' || key === 'className' || key === 'label') continue;
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    rest[key] = props[key];
  }
  if (props.label !== undefined && rest['aria-label'] === undefined) rest['aria-label'] = props.label;
  return e(
    'span',
    { className: clsx(css.dtsInputWrap, props.className) },
    props.icon != null ? e('span', { className: css.dtsInputIcon, key: 'icon' }, props.icon) : null,
    e('input', Object.assign({ className: css.dtsInput }, rest)),
  );
}
