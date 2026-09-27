/**
 * controls/Switch.ts —— 官方 Switch 的自写替代。
 *
 * 官方来源：lib/index.js:3345-3371（lib/types/Switch.js）+ lib/Switch.module.css。
 * 抄了什么：36×20 几何、`role="switch"` + `aria-checked`、`onChange(!checked)` 的
 * 完全受控语义、`label` 必填（官方原话：控件不可能在没有名称的情况下发布）、
 * `disabled` / `title` / `className`、拇指 span 的位移由 CSS 按 aria-checked 驱动。
 * 改了什么：类名前缀 dts；`aria-checked` 仍传布尔值（React 渲染为 "true"/"false"，
 * 与官方产物一致，CSS 选择器 `[aria-checked='true']` 因此成立）。
 * 保留的行为：键盘可达性 —— 控件是原生 `<button>`，Space/Enter 由浏览器转成 click，
 * 官方也没有额外的 keydown 处理器；禁用态不可聚焦。
 */
import { clsx, e } from './runtime.ts';
import css from './Switch.module.css';

export interface SwitchProps {
  /** 当前状态；控件完全受控。 */
  checked: boolean;
  /** 收到点击所请求的目标状态。 */
  onChange: (next: boolean) => void;
  /** 本地化的无障碍名称，由渲染点提供；官方规定必填。 */
  label: string;
  /** 是否拒绝输入；写入进行中时拥有者也应置真，而不只在部署锁死开关时。 */
  disabled?: boolean;
  /** 本地化的悬停文本，通常说明开关为何被锁。 */
  title?: string;
  /** 布局定位用的额外类名。 */
  className?: string;
}

/**
 * 渲染一个开关。
 * @param props.checked - 当前状态；控件完全受控。
 * @param props.onChange - 以点击请求的目标状态调用。
 * @param props.label - 本地化的无障碍名称。
 * @param props.disabled - 是否拒绝输入。
 * @param props.title - 本地化的悬停文本。
 * @param props.className - 布局定位的额外类名。
 * @returns switch 元素。
 */
export function Switch(props: SwitchProps): any {
  return e(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': props.checked,
      'aria-label': props.label,
      title: props.title,
      disabled: props.disabled === undefined ? false : props.disabled,
      className: clsx(css.dtsSwitch, props.className),
      onClick: function () {
        props.onChange(!props.checked);
      },
    },
    e('span', { className: css.dtsSwitchThumb }),
  );
}
