/**
 * controls/Tag.ts —— 官方 Tag 的自写替代。
 *
 * 官方来源：lib/index.js:3282-3296（lib/types/Tag.js）+ lib/Tag.module.css。
 * 抄了什么：只读徽章 `<span data-tone>`，tone 默认 `outline`，八种取值全部保留：
 * outline / solid / neutral / quiet / success / info / warning / danger
 * （官方 README.zh.md:51「`tone` 选择八种配色之一」；产物 CSS 里正好八条规则）。
 * 改了什么：类名前缀 dts；tone 用联合类型写死在 props 上（官方是 JSDoc，无从校验）。
 * 保留的行为：`Tag` 与 `Pill` **不可互换**（README.zh.md:76）——Tag 是 11px 只读徽章，
 * 没有 onClick/active，也没有交互态样式；需要可选中就用 Pill。
 */
import { clsx, e } from './runtime.ts';
import css from './Tag.module.css';

/** 官方八色（对应 CSS 里 data-tone 的八条规则）。 */
export type TagTone =
  | 'outline'
  | 'solid'
  | 'neutral'
  | 'quiet'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger';

export interface TagProps {
  /** 使用哪套配色（默认 `outline`）。 */
  tone?: TagTone;
  /** 布局定位用的额外类名。 */
  className?: string;
  /** 本地化文案，归渲染点所有。 */
  children?: any;
}

/**
 * 渲染一枚只读标签。
 * @param props.tone - 使用哪套配色（默认 `outline`）。
 * @param props.className - 布局定位的额外类名。
 * @param props.children - 本地化文案。
 * @returns tag 元素。
 */
export function Tag(props: TagProps): any {
  return e(
    'span',
    {
      className: clsx(css.dtsTag, props.className),
      'data-tone': props.tone === undefined ? 'outline' : props.tone,
    },
    props.children,
  );
}
