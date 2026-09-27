/**
 * controls/SegmentedControl.ts —— 官方 SegmentedControl 的自写替代。
 *
 * 官方来源：lib/index.js:3373-3456（lib/types/SegmentedControl.js）+ lib/SegmentedControl.module.css。
 * 抄了什么：`role="tablist"` + `aria-label`；每段是 `role="tab"`，`id` 派生
 * `<id>-<value>`，`aria-controls` 指向 `<id>-<value>-panel`（面板由调用方渲染并用
 * aria-labelledby 指回 tab），只有选中段在 Tab 序列里（`tabIndex` 0/-1）；
 * `walk()` 的走位语义（方向键走到最近的可选邻居并环绕，Home/End 跳到首/末个**可选**段）；
 * 选中项由调用方持有，`onChange` 只会在真的换了值时才被调用；
 * 值变化后若焦点还在控件内，把焦点交给新选中段（官方 useEffect）；
 * 指示块靠 `--dsh-segment-count` / `--dsh-segment-index` 算术定位。
 * 改了什么：类名前缀 dts（官方那种 `css$9[someKey]` 式动态查表在本层没有余地，改显式常量）。
 * 保留的行为：控件级 `disabled` 锁住全部分段（官方：当前面板有进行中的写入/取数时用）；
 * 分段各自可 `disabled` 并带 `title`。
 */
import { clsx, e, useEffect, useRef } from './runtime.ts';
import css from './SegmentedControl.module.css';

export interface SegmentedControlOption {
  value: string;
  label: any;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps {
  /** 拥有者的基础 id：每段是 `<id>-<value>`，并命名它控制的面板 `<id>-<value>-panel`。 */
  id: string;
  /** 选中项的值；控件完全受控。 */
  value: string;
  /** 按显示顺序排列的分段；至少两个。 */
  options: SegmentedControlOption[];
  /** 以点击或走位键请求的值调用，永不传已选中的值。 */
  onChange: (value: string) => void;
  /** tablist 的本地化无障碍名称。 */
  label: string;
  /** 锁住每个分段，通常在展示面板里有"切走就会孤儿化"的写入或取数时。 */
  disabled?: boolean;
  /** 布局定位用的额外类名。 */
  className?: string;
}

function isWalkKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown'
    || key === 'Home' || key === 'End';
}

/**
 * 从选中项出发，走位键落到的那个可选段：方向键步进到最近的可选邻居并环绕，
 * Home/End 跳到首/末个可选段。
 */
function walk(options: SegmentedControlOption[], from: number, key: string): SegmentedControlOption | undefined {
  var enabled = options.filter(function (option) {
    return option.disabled !== true;
  });
  if (key === 'Home') return enabled[0];
  if (key === 'End') return enabled[enabled.length - 1];
  var step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
  var count = options.length;
  for (var offset = 1; offset < count; offset += 1) {
    var candidate = options[(((from + step * offset) % count) + count) % count];
    if (candidate !== undefined && candidate.disabled !== true) return candidate;
  }
  return undefined;
}

/**
 * 渲染一个分段控件。
 * @param props.id - 拥有者的基础 id。
 * @param props.value - 选中项的值；控件完全受控。
 * @param props.options - 按显示顺序的分段。
 * @param props.onChange - 以点击或走位键请求的值调用。
 * @param props.label - tablist 的本地化无障碍名称。
 * @param props.disabled - 锁住全部分段。
 * @param props.className - 布局定位的额外类名。
 * @returns tablist 元素。
 */
export function SegmentedControl(props: SegmentedControlProps): any {
  var list = useRef(null);
  var selected = -1;
  for (var i = 0; i < props.options.length; i += 1) {
    if (props.options[i].value === props.value) {
      selected = i;
      break;
    }
  }

  useEffect(function () {
    var root = list.current;
    if (root === null || root === undefined) return;
    if (!root.contains(document.activeElement)) return;
    var active = root.querySelector('[role="tab"][aria-selected="true"]');
    if (active !== null) active.focus();
  }, [props.value]);

  var onKeyDown = function (event: any) {
    if (!isWalkKey(event.key)) return;
    event.preventDefault();
    var target = walk(props.options, selected, event.key);
    if (target !== undefined && target.value !== props.value) props.onChange(target.value);
  };

  var indicator: Record<string, string> = {
    '--dsh-segment-count': String(props.options.length),
    '--dsh-segment-index': String(selected),
  };

  return e(
    'div',
    {
      ref: list,
      role: 'tablist',
      'aria-label': props.label,
      className: clsx(css.dtsSegmentedControl, props.className),
      style: indicator,
    },
    e('span', { 'aria-hidden': 'true', className: css.dtsSegmentedIndicator, key: 'indicator' }),
    props.options.map(function (option) {
      var active = option.value === props.value;
      return e(
        'button',
        {
          key: option.value,
          id: props.id + '-' + option.value,
          type: 'button',
          role: 'tab',
          'aria-selected': active,
          'aria-controls': props.id + '-' + option.value + '-panel',
          tabIndex: active ? 0 : -1,
          disabled: props.disabled === true || option.disabled === true,
          title: option.title,
          className: css.dtsSegmentedTab,
          onClick: function () {
            if (!active) props.onChange(option.value);
          },
          onKeyDown: onKeyDown,
        },
        option.label,
      );
    }),
  );
}
