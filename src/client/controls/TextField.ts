/**
 * controls/TextField.ts —— NumberField 的文本孪生：同一份官方字段几何
 * （lib/settings-form/fields.module.css），换成 `type="text"` 的受控输入。
 *
 * 与 NumberField 的差别只在语义：文本没有 min/max/step，也不做数值回退；
 * 校验状态由调用方驱动（`invalid` + `invalidLabel`），因为"什么算非法文本"
 * 只有调用方知道（例如导入主题档时要看它是不是合法 JSON）。
 * `Input` 与本控件的分工：`Input` 是官方那个无标签的行内输入（H32，用于搜索框这类
 * 就地控件）；本控件是设置页字段形状（H34 + 可见标签 + 说明 + 错误行）。
 */
import { clsx, e, useId } from './runtime.ts';
import css from './TextField.module.css';

export interface TextFieldProps {
  /** 本地化的可见标签，同时是输入的可访问名；必填。 */
  label: string;
  /** 当前文本。 */
  value: string;
  /** 以新文本调用（受控，逐键回调）。 */
  onChange: (next: string) => void;
  /** 原生 input 的 type，默认 'text'。 */
  type?: string;
  /** 占位文案，由调用方本地化。 */
  placeholder?: string;
  /** 标签下方的补充说明，由调用方本地化。 */
  hint?: string;
  /** 调用方驱动的非法态；为真时输入换 error 描边。 */
  invalid?: boolean;
  /** 非法态下显示的文案，由调用方本地化。 */
  invalidLabel?: string;
  /** 是否拒绝编辑。 */
  disabled?: boolean;
  /** 显式 id（给 `label` 的 for）；缺省用 useId 生成。 */
  id?: string;
  /** 布局定位用的额外类名。 */
  className?: string;
  /** 其余原生 input 属性透传（maxLength / inputMode / autoComplete / spellCheck / onKeyDown…）。 */
  [nativeAttribute: string]: any;
}

/**
 * 渲染一个带标签的文本输入。
 * @param props - 见 {@link TextFieldProps}。
 * @returns 标签行、文本输入与可选错误/说明行。
 */
export function TextField(props: TextFieldProps): any {
  var generatedId = useId();
  var id = props.id === undefined ? 'dts-text-' + String(generatedId).replace(/:/g, '') : props.id;

  var rest: Record<string, any> = {};
  for (var key in props) {
    if (key === 'label' || key === 'value' || key === 'onChange' || key === 'type' || key === 'placeholder'
      || key === 'hint' || key === 'invalid' || key === 'invalidLabel' || key === 'disabled'
      || key === 'id' || key === 'className') continue;
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    rest[key] = props[key];
  }

  return e(
    'div',
    { className: clsx(css.dtsTextField, props.className) },
    e(
      'div',
      { className: css.dtsTextFieldHead, key: 'head' },
      e('label', { className: css.dtsTextFieldLabel, htmlFor: id, key: 'label' }, props.label),
    ),
    e(
      'input',
      Object.assign({}, rest, {
        key: 'input',
        id: id,
        className: css.dtsTextFieldInput,
        type: props.type === undefined ? 'text' : props.type,
        value: props.value,
        placeholder: props.placeholder,
        disabled: props.disabled === true,
        'aria-invalid': props.invalid === true ? true : undefined,
        onChange: function (event: any) {
          props.onChange(event.target.value);
        },
      }),
    ),
    props.invalid === true && props.invalidLabel !== undefined && props.invalidLabel !== ''
      ? e('p', { className: css.dtsTextFieldInvalid, key: 'invalid', role: 'status' }, props.invalidLabel)
      : null,
    props.hint !== undefined && props.hint !== ''
      ? e('p', { className: css.dtsTextFieldHint, key: 'hint' }, props.hint)
      : null,
  );
}
