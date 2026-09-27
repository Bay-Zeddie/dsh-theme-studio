/**
 * controls/Button.ts —— 官方 Button 的自写替代（不 require primitives）。
 *
 * 官方来源：lib/index.js:3170-3190（lib/types/Button.js）+ lib/Button.module.css。
 * 抄了什么：markup 结构（button[type=button] + 可选 16px 前置图标 span）、
 * `variant` 四值 primary/ghost/outline/toolbar（默认 ghost）、`size` md(36px/12px 圆角)
 * / sm(28px/8px 圆角)、`icon`、ref 指向原生 button、其余原生属性透传。
 * 改了什么：官方 `css[variant]` / `css[size]` 的动态查表，在本层换成显式映射
 * （localName 带 dts 前缀后不能再用裸 variant 当键）；类名前缀 dts。
 * 保留的行为：原生 button 语义（Space/Enter 激活）、禁用态不可聚焦、
 * 焦点环由主题的全局 `:focus-visible` 兜底（官方也没有自己的 focus 规则）。
 */
import { forwardRef, clsx, e } from './runtime.ts';
import css from './Button.module.css';

/** 官方四种视觉族；`ghost` 为默认。 */
export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'toolbar';
/** `md` = 36px 高 / 12px 圆角；`sm` = 28px 高 / 8px 圆角。 */
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  /** 视觉族，默认 'ghost'。 */
  variant?: ButtonVariant;
  /** 尺寸，默认 'md'。 */
  size?: ButtonSize;
  /** 可选的前置 16px 图标节点。 */
  icon?: any;
  className?: string;
  children?: any;
  /** 原生 button 属性透传（title / aria-label / onClick / disabled / type 覆盖…）。 */
  [nativeAttribute: string]: any;
}

var VARIANT_CLASS: Record<string, string> = {
  primary: css.dtsBtnPrimary,
  ghost: css.dtsBtnGhost,
  outline: css.dtsBtnOutline,
  toolbar: css.dtsBtnToolbar,
};

var SIZE_CLASS: Record<string, string> = {
  md: css.dtsBtnMd,
  sm: css.dtsBtnSm,
};

/**
 * 渲染一个按钮。
 * @param props.variant - 视觉族（默认 'ghost'）。
 * @param props.size - 'md' 36px 控件 12px 圆角，或 'sm' 28px 控件 8px 圆角。
 * @param props.icon - 可选的前置 16px 图标节点。
 * @param ref - 原生 button，供焦点控制与浮层锚定使用。
 * @returns button 元素；原生 button 属性透传。
 */
export var Button: any = forwardRef(function Button(props: ButtonProps, ref: any) {
  var variant = props.variant === undefined ? 'ghost' : props.variant;
  var size = props.size === undefined ? 'md' : props.size;
  var rest: Record<string, any> = {};
  for (var key in props) {
    if (key === 'variant' || key === 'size' || key === 'icon' || key === 'className' || key === 'children') continue;
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    rest[key] = props[key];
  }
  return e(
    'button',
    Object.assign(
      {
        ref: ref,
        type: 'button',
        className: clsx(css.dtsBtn, VARIANT_CLASS[variant], SIZE_CLASS[size], props.className),
      },
      rest,
    ),
    props.icon != null ? e('span', { className: css.dtsBtnIcon, key: 'icon' }, props.icon) : null,
    props.children,
  );
}) as any;
