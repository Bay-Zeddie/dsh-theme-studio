/**
 * controls/SegmentedTabs.ts —— 官方 SegmentedTabs 的自写替代。
 *
 * 官方来源：lib/index.js:3213-3280（lib/types/SegmentedTabs.js）+ lib/SegmentedTabs.module.css。
 * 抄了什么：受控等宽分段标签 —— 轨道是 grid，列数由 `style.gridTemplateColumns =
 * repeat(n, minmax(0,1fr))` 内联写死（等宽是"一个指示块按百分比平移"的前提）；
 * 指示块宽度 `calc((100% - 8px) / n)`、位移 `translateX(selectedIndex * 100%)`；
 * 每段经 `Pill` 渲染并带上 `id` / `role="tab"` / `aria-selected` / `aria-controls={panelId}`
 * / `tabIndex`（只有选中项在 Tab 序列里）/ `onClick` / `onKeyDown`；
 * 键盘左右方向键环绕、Home/End 跳首末，**按键同时移动焦点**
 * （`tablist.querySelectorAll('[role="tab"]').item(next).focus()`），并
 * preventDefault + stopPropagation。
 * 改了什么：类名前缀 dts。
 * 保留的行为：面板归调用方所有（tag 只给 `aria-controls` 的 id，不渲染面板）。
 *
 * 与 SegmentedControl 的官方判据（README.zh.md:45/50/77）：两者都是 tablist，
 * 但 SegmentedControl 用在"在几种互斥模式间切换一张卡片/面板"，`id` 派生面板名、
 * 支持控件级 disabled 与逐段 disabled/title；SegmentedTabs 用在"等宽分段标签 + 滑动
 * 指示条"，由调用方提供文案、标签与面板 id。本层两个都给出，按此判据选用。
 */
import { clsx, e } from './runtime.ts';
import { Pill } from './Pill.ts';
import css from './SegmentedTabs.module.css';

export interface SegmentedTabsItem {
  /** 唯一值，也是选中判据。 */
  value: string;
  /** 本地化文案。 */
  label: any;
  /** 该 tab 的 DOM id。 */
  id: string;
  /** 它所控制的面板 id（落到 aria-controls）。 */
  panelId: string;
}

export interface SegmentedTabsProps {
  /** 非空、有序、value 与 id 唯一的标签集合。 */
  items: SegmentedTabsItem[];
  /** 选中的值，必须属于 items。 */
  value: string;
  /** 点击、左右方向键或 Home/End 请求的选择。 */
  onChange: (value: string) => void;
  /** tablist 的本地化无障碍名称。 */
  label: string;
  /** 布局定位用的额外类名；面板仍归调用方所有。 */
  className?: string;
}

/**
 * 渲染受控等宽分段标签与滑动选中指示块。
 * @param props.items - 非空有序标签，value 与 DOM id 唯一。
 * @param props.value - 选中的值，必须属于 items。
 * @param props.onChange - 点击、左右方向键或 Home/End 请求的选择；键盘选择同时移动焦点，只有选中 tab 是 tab stop。
 * @param props.label - tablist 的本地化无障碍名称。
 * @param props.className - 布局定位的额外类名。
 * @returns tab 列表，不含它的面板。
 */
export function SegmentedTabs(props: SegmentedTabsProps): any {
  var selectedIndex = -1;
  for (var i = 0; i < props.items.length; i += 1) {
    if (props.items[i].value === props.value) {
      selectedIndex = i;
      break;
    }
  }

  var onKeyDown = function (event: any, index: number) {
    var next: number;
    switch (event.key) {
      case 'ArrowLeft':
        next = (index + props.items.length - 1) % props.items.length;
        break;
      case 'ArrowRight':
        next = (index + 1) % props.items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = props.items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    var tablist = event.currentTarget.parentElement;
    var nextItem = props.items[next];
    if (tablist === null || tablist === undefined || nextItem === undefined) return;
    tablist.querySelectorAll('[role="tab"]').item(next).focus();
    props.onChange(nextItem.value);
  };

  return e(
    'div',
    {
      role: 'tablist',
      'aria-label': props.label,
      className: clsx(css.dtsSegmentedTabs, props.className),
      style: { gridTemplateColumns: 'repeat(' + props.items.length + ', minmax(0, 1fr))' },
    },
    e('span', {
      key: 'indicator',
      className: css.dtsSegmentedTabsIndicator,
      'aria-hidden': 'true',
      style: {
        width: 'calc((100% - 8px) / ' + props.items.length + ')',
        transform: 'translateX(' + selectedIndex * 100 + '%)',
      },
    }),
    props.items.map(function (item, index) {
      return e(
        Pill,
        {
          key: item.value,
          id: item.id,
          role: 'tab',
          className: css.dtsSegmentedTabsTab,
          'aria-selected': props.value === item.value,
          'aria-controls': item.panelId,
          tabIndex: props.value === item.value ? 0 : -1,
          onClick: function () {
            props.onChange(item.value);
          },
          onKeyDown: function (event: any) {
            onKeyDown(event, index);
          },
        },
        item.label,
      );
    }),
  );
}
