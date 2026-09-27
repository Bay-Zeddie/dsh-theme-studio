/**
 * controls/Slider.ts —— ★ 官方 primitives **没有 Slider**（面板里有 12 个滑块），
 * 本文件是自写件。几何与令牌依据见 Slider.module.css 顶部的逐条出处。
 *
 * 语义：原生 `<input type="range">` —— 方向键（←/→/↑/↓）、Home/End、PageUp/PageDown
 * 全部由浏览器提供，不需要自写 keydown；`aria-label`／关联可见 `<label>` 给出可访问名；
 * `<output>` 通过 `htmlFor` 关联到同一个 input，既显示数值又表达"这个数字属于哪条滑块"。
 * 数值展示用官方设置页的排版（tabular-nums + 13/1.5），与主题插件自己的数值步进器一致。
 * 越界与 NaN 在 onChange 里钳制（原生 range 一般不会给出越界值，但受控写入可能）。
 *
 * 本控件自有而官方无从参考的两个决定（记在 05-controls-port.md）：
 *   - 可见标签行 + 右侧数值（`showValue` 默认 true）；
 *   - 给出 `unit` 时同时写入 `aria-valuetext`（否则读屏只念一个裸数字）。
 */
import { clsx, e, useId } from './runtime.ts';
import css from './Slider.module.css';

export interface SliderProps {
  /** 本地化的可见标签，同时是 input 的可访问名；必填。 */
  label: string;
  /** 当前值；控件完全受控。 */
  value: number;
  /** 以钳制后的新值调用。 */
  onChange: (next: number) => void;
  /** 下界，默认 0。 */
  min?: number;
  /** 上界，默认 100。 */
  max?: number;
  /** 步进，默认 1。 */
  step?: number;
  /** 数值后缀（如 `%`、`px`）；给出时同时作为 aria-valuetext。 */
  unit?: string;
  /** 是否显示右侧数值，默认 true。 */
  showValue?: boolean;
  /** 标签下方的补充说明，由调用方本地化。 */
  hint?: string;
  /** 是否拒绝输入。 */
  disabled?: boolean;
  /** 显式 id（同时给 `label` 与 `output` 的 for）；缺省用 useId 生成。 */
  id?: string;
  /** 布局定位用的额外类名。 */
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * 渲染一条带数值展示的滑块。
 * @param props - 见 {@link SliderProps}。
 * @returns 标签行、range 输入与数值输出。
 */
export function Slider(props: SliderProps): any {
  var generatedId = useId();
  var id = props.id === undefined ? 'dts-slider-' + String(generatedId).replace(/:/g, '') : props.id;
  var min = props.min === undefined ? 0 : props.min;
  var max = props.max === undefined ? 100 : props.max;
  var step = props.step === undefined ? 1 : props.step;
  var showValue = props.showValue === undefined ? true : props.showValue;
  var unit = props.unit === undefined ? '' : props.unit;

  var span = max - min;
  var percent = span === 0 ? 0 : ((props.value - min) / span) * 100;
  if (!(percent >= 0)) percent = 0;
  if (percent > 100) percent = 100;

  var text = String(props.value) + unit;

  return e(
    'div',
    { className: clsx(css.dtsSlider, props.className) },
    e(
      'div',
      { className: css.dtsSliderHead, key: 'head' },
      e('label', { className: css.dtsSliderLabel, htmlFor: id, key: 'label' }, props.label),
      showValue ? e('output', { className: css.dtsSliderOutput, htmlFor: id, key: 'output' }, text) : null,
    ),
    e('input', {
      key: 'input',
      id: id,
      className: css.dtsSliderInput,
      type: 'range',
      min: min,
      max: max,
      step: step,
      value: props.value,
      disabled: props.disabled === true,
      style: { '--dts-slider-fill': percent + '%' },
      'aria-valuetext': unit === '' ? undefined : text,
      onChange: function (event: any) {
        var next = Number(event.target.value);
        props.onChange(clamp(next, min, max));
      },
    }),
    props.hint !== undefined && props.hint !== ''
      ? e('p', { className: css.dtsSliderHint, key: 'hint' }, props.hint)
      : null,
  );
}
