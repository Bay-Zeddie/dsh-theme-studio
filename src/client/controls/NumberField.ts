/**
 * controls/NumberField.ts —— 官方 primitives 没有"有边界的数字输入"（设置页字段由
 * settings-form 的字段族渲染成裸 `<input>`），本文件按那份字段的几何与令牌自写。
 *
 * 几何/令牌来源：lib/settings-form/fields.module.css 的 .field / .head / .label /
 * .input / .input:focus-visible / .input:disabled / .input[aria-invalid] / .invalid / .hint。
 *
 * 有界语义：`min` / `max` / `step` 同时给原生 `<input type="number">`（浏览器的步进器与
 * 原生校验）与本控件的提交处理。非法输入回退规则（本控件自有，官方无同类控件）：
 *   - 草稿为空        → 回退到当前值，不标错；
 *   - 非有限数        → 回退到当前值，并置 `aria-invalid` + 显示调用方给的 `invalidLabel`；
 *   - 有限但越界      → **钳到边界**后提交（面板要的是"别把我写到区间外"，而不是拒绝输入）；
 *   - 提交时机        → blur 与 Enter；改动中的草稿不写回拥有者，避免每个按键都触发一次重绘/落盘。
 * 可访问名：可见 `<label htmlFor>`；错误文案由调用方本地化（控件不持有任何语言）。
 */
import { clsx, e, useEffect, useId, useState } from './runtime.ts';
import css from './NumberField.module.css';

export interface NumberFieldProps {
  /** 本地化的可见标签，同时是输入的可访问名；必填。 */
  label: string;
  /** 当前值。 */
  value: number;
  /** 以钳制后的合法值调用（仅在值真的变化时）。 */
  onChange: (next: number) => void;
  /** 下界。 */
  min?: number;
  /** 上界。 */
  max?: number;
  /** 步进。 */
  step?: number;
  /** 标签下方的补充说明，由调用方本地化。 */
  hint?: string;
  /** 非法输入回退时显示的文案，由调用方本地化。 */
  invalidLabel?: string;
  /** 是否拒绝编辑。 */
  disabled?: boolean;
  /** 显式 id（给 `label` 的 for）；缺省用 useId 生成。 */
  id?: string;
  /** 布局定位用的额外类名。 */
  className?: string;
}

/**
 * 渲染一个有边界的数字输入。
 * @param props - 见 {@link NumberFieldProps}。
 * @returns 标签行、number 输入与可选说明。
 */
export function NumberField(props: NumberFieldProps): any {
  var generatedId = useId();
  var id = props.id === undefined ? 'dts-number-' + String(generatedId).replace(/:/g, '') : props.id;
  var draftState = useState(null);
  var draft = draftState[0];
  var setDraft = draftState[1];
  var invalidState = useState(false);
  var invalid = invalidState[0];
  var setInvalid = invalidState[1];

  /* 拥有者从外部改了值（例如"重置"）时丢掉草稿，避免输入框里留着过期文本。 */
  useEffect(function () {
    setDraft(null);
    setInvalid(false);
  }, [props.value]);

  function commit(): void {
    if (draft === null) return;
    var raw = draft.trim();
    if (raw === '') {
      setDraft(null);
      setInvalid(false);
      return;
    }
    var parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(null);
      setInvalid(true);
      return;
    }
    var next = parsed;
    if (props.min !== undefined && next < props.min) next = props.min;
    if (props.max !== undefined && next > props.max) next = props.max;
    setDraft(null);
    setInvalid(false);
    if (next !== props.value) props.onChange(next);
  }

  var text = draft === null ? String(props.value) : draft;

  return e(
    'div',
    { className: clsx(css.dtsNumberField, props.className) },
    e(
      'div',
      { className: css.dtsNumberFieldHead, key: 'head' },
      e('label', { className: css.dtsNumberFieldLabel, htmlFor: id, key: 'label' }, props.label),
    ),
    e('input', {
      key: 'input',
      id: id,
      className: css.dtsNumberFieldInput,
      type: 'number',
      min: props.min,
      max: props.max,
      step: props.step,
      value: text,
      disabled: props.disabled === true,
      'aria-invalid': invalid ? true : undefined,
      onChange: function (event: any) {
        setDraft(event.target.value);
        if (invalid) setInvalid(false);
      },
      onBlur: function () {
        commit();
      },
      onKeyDown: function (event: any) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commit();
      },
    }),
    invalid && props.invalidLabel !== undefined && props.invalidLabel !== ''
      ? e('p', { className: css.dtsNumberFieldInvalid, key: 'invalid', role: 'status' }, props.invalidLabel)
      : null,
    props.hint !== undefined && props.hint !== ''
      ? e('p', { className: css.dtsNumberFieldHint, key: 'hint' }, props.hint)
      : null,
  );
}
