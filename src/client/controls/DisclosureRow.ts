/**
 * controls/DisclosureRow.ts —— 官方 DisclosureRow 的自写替代。
 *
 * 官方来源：lib/index.js:3113-3168（lib/types/DisclosureRow.js）+ lib/DisclosureRow.module.css。
 * 抄了什么：24px 紧凑行（高度/前导盒/字形都跟着 `--dsh-content-font-delta` 走）；
 * 标题与内容左右排列（`root` 竖排：行 + 展开内容）；两条展开路径 ——
 * `expandOnRowClick` 时整行成为 `role="button"` + `tabIndex=0` + `aria-expanded`
 * 并吃 Enter/Space，否则只有前导是 `<button aria-expanded>`；`previewChevron` 决定
 * 折叠时前导是否在悬停时从图标切成 chevron；`keepContentWhenOpen` 决定展开时是否
 * 保留 collapsedContent；`memo` + 浅比较（官方要求调用方保持回调与 React 节点的引用稳定）。
 * 改了什么：类名前缀 dts；官方标题经 `TextShimmer` 渲染，本层不引该组件（它的样式表
 * 与 `--dsh-text-shimmer-spread` 不在本层范围内），改为一个 span 并**保留官方发布的
 * `data-text-shimmer` 钩子**（running 为真时置上，宿主若有 shimmer 样式即可生效）；
 * 官方用的 chevron 图标改为内联同路径 SVG。
 * 保留的行为：前导点击 `stopPropagation` 后 toggle（不会和整行点击叠加触发两次）；
 * 键盘只在 `rowExpands` 时拦截 Enter/Space 并 preventDefault。
 */
import { memo, clsx, e } from './runtime.ts';
import css from './DisclosureRow.module.css';

export interface DisclosureRowProps {
  /** 折叠时显示的前导图标（previewChevron 为真时悬停会被 chevron 替换）。 */
  icon?: any;
  /** 标题节点。 */
  title?: any;
  /** 受控展开态。 */
  open: boolean;
  /** 是否可展开（决定是否渲染前导按钮/整行按钮）。 */
  expandable?: boolean;
  /** 请求切换展开态。 */
  onToggle: () => void;
  /** 运行中标记；本层只把它发布为标题上的 `data-text-shimmer` 钩子。 */
  running?: boolean;
  /** 整行是否可点（否则只有前导可点）。 */
  expandOnRowClick?: boolean;
  /** 折叠时前导是否预览 chevron。 */
  previewChevron?: boolean;
  /** 展开时是否保留 collapsedContent。 */
  keepContentWhenOpen?: boolean;
  /** 行右侧的折叠态内容。 */
  collapsedContent?: any;
  /** 展开后的内容（左右排列的下半部分）。 */
  children?: any;
  className?: string;
  rowClassName?: string;
  leadingClassName?: string;
  chevronClassName?: string;
  titleClassName?: string;
}

/** 官方 IconChevronDownOutlineRegular 的路径（16 viewBox / 1px 描边 / 默认 14px）。 */
function ChevronDown(props: { className?: string }): any {
  return e(
    'svg',
    {
      width: 14,
      height: 14,
      className: props.className,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      strokeWidth: 1,
    },
    e('path', {
      d: 'M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6',
      stroke: 'currentColor',
    }),
  );
}

/** 官方 IconChevronUpOutlineRegular 的路径。 */
function ChevronUp(props: { className?: string }): any {
  return e(
    'svg',
    {
      width: 14,
      height: 14,
      className: props.className,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      strokeWidth: 1,
    },
    e('path', {
      d: 'M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10',
      stroke: 'currentColor',
    }),
  );
}

/**
 * 渲染一个折叠头及其受控展开内容。
 * 浅层 prop 比较要求稳定的回调与 React 节点引用，未变化的行才会跳过重渲染。
 * @param props - 视觉内容、受控状态与交互策略。
 * @returns 折叠行。
 */
export var DisclosureRow: any = memo(function DisclosureRow(props: DisclosureRowProps) {
  var rowExpands = props.expandable === true && props.expandOnRowClick === true;
  var previewChevron = props.previewChevron === undefined ? props.expandable === true : props.previewChevron;

  var toggleFromLeading = function (event: any) {
    event.stopPropagation();
    props.onToggle();
  };

  var toggleFromKeyboard = function (event: any) {
    if (!rowExpands || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    props.onToggle();
  };

  var collapsedLeading = previewChevron
    ? [
        e('span', { className: css.dtsDisclosureIconIdle, key: 'icon' }, props.icon),
        e(ChevronDown, { className: clsx(props.chevronClassName, css.dtsDisclosureChevronHover), key: 'chevron' }),
      ]
    : props.icon;

  var leading = props.open
    ? e(ChevronUp, { className: props.chevronClassName })
    : collapsedLeading;

  return e(
    'div',
    { className: clsx(css.dtsDisclosureRoot, props.className), 'data-open': props.open || undefined },
    e(
      'div',
      {
        className: clsx(css.dtsDisclosureRow, props.rowClassName),
        'data-disclosure-row': true,
        'data-expandable': rowExpands || undefined,
        role: rowExpands ? 'button' : undefined,
        tabIndex: rowExpands ? 0 : undefined,
        'aria-expanded': rowExpands ? props.open : undefined,
        onClick: rowExpands ? props.onToggle : undefined,
        onKeyDown: rowExpands ? toggleFromKeyboard : undefined,
      },
      props.expandable === true && !rowExpands
        ? e(
            'button',
            {
              type: 'button',
              className: clsx(css.dtsDisclosureLeading, props.leadingClassName),
              'aria-expanded': props.open,
              onClick: toggleFromLeading,
              key: 'leading',
            },
            leading,
          )
        : e('span', { className: clsx(css.dtsDisclosureLeading, props.leadingClassName), key: 'leading' }, leading),
      e(
        'span',
        {
          className: clsx(css.dtsDisclosureTitle, props.titleClassName),
          'data-text-shimmer': props.running === true ? true : undefined,
          key: 'title',
        },
        props.title,
      ),
      (props.keepContentWhenOpen === true || !props.open) && props.collapsedContent,
    ),
    props.open && props.children,
  );
}) as any;
