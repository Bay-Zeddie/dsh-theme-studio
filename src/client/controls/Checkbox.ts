/**
 * controls/Checkbox.ts —— 官方 Checkbox 的自写替代。
 *
 * 官方来源：lib/index.js:3458-3483（lib/types/Checkbox.js）+ lib/Checkbox.module.css。
 * 抄了什么：`<label>` 包住原生 `<input type="checkbox">` 加一个文案 span —— 可见文案
 * 同时就是无障碍名称（原生 label 关联，不需要额外的 aria 属性）；受控 `checked`、
 * `onChange(event.target.checked)`、`disabled` / `title` / `className`（落在 label 上）；
 * 16px 方框用 `accent-color: var(--dsw-alias-brand-primary)` 上色。
 * 改了什么：类名前缀 dts。
 * 保留的行为：键盘（Tab 进入、Space 切换）与表单语义全部来自原生 checkbox；
 * 禁用态由 `:has(input:disabled)` 降透明并改光标。
 */
import { clsx, e } from './runtime.ts';
import css from './Checkbox.module.css';

export interface CheckboxProps {
  /** 当前勾选状态。 */
  checked: boolean;
  /** 收到请求的勾选状态。 */
  onChange: (next: boolean) => void;
  /** 本地化的可见文案，同时是它的无障碍名称。 */
  label: string;
  /** 是否拒绝更改。 */
  disabled?: boolean;
  /** 可选的本地化悬停文本。 */
  title?: string;
  /** label 的布局定位类名。 */
  className?: string;
}

/**
 * 渲染一个带文案的原生复选框。
 * @param props.checked - 当前勾选状态。
 * @param props.onChange - 以请求的勾选状态调用。
 * @param props.label - 本地化的可见且无障碍文案。
 * @param props.disabled - 是否拒绝更改。
 * @param props.title - 可选悬停文本。
 * @param props.className - label 的定位类名。
 * @returns 包住自身复选框的 label。
 */
export function Checkbox(props: CheckboxProps): any {
  return e(
    'label',
    { className: clsx(css.dtsCheckbox, props.className), title: props.title },
    e('input', {
      type: 'checkbox',
      checked: props.checked,
      disabled: props.disabled === undefined ? false : props.disabled,
      onChange: function (event: any) {
        props.onChange(event.target.checked);
      },
    }),
    e('span', null, props.label),
  );
}
