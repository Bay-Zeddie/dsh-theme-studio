/**
 * controls/MenuSurface.ts —— 官方 MenuSurface 的自写替代。
 *
 * 官方来源：lib/index.js:3738-3777（lib/types/MenuSurface.js）+ lib/MenuSurface.module.css。
 * 抄了什么：`forwardRef` 的 div、`data-menu-material="translucent"`、内部一层
 * `aria-hidden` 的 `.material`（透明填充 + `backdrop-filter`，即菜单材质）、
 * `compact` 变体（较小圆角）、div 属性与 style 原样转发、以及 `--dsh-menu-anchor`
 * 这道 CSS 锚点名（`useId()` 生成后去掉冒号）。
 * 改了什么：类名前缀 dts；**macOS 底层改用 React portal 而不是 `document.body.appendChild`**
 * —— 本层纪律禁止控件手工 append 到 body（卸载路径必须由 React 统一负责）。
 * 用 portal 渲染同一个 `aria-hidden` 底层，行为等价（CSS 锚点仍把它对齐到卡片范围、
 * 随卡片一起卸载），但不再有"自己挂、自己摘"的裸 DOM 生命周期。
 * 保留的行为：只做材质与外圆角，布局与层级归调用方（官方 README.zh.md:118）。
 */
import { Fragment, clsx, createPortal, e, forwardRef, useId } from './runtime.ts';
import css from './MenuSurface.module.css';

export interface MenuSurfaceProps {
  /** 使用较小的菜单圆角与排版档。 */
  compact?: boolean;
  className?: string;
  style?: any;
  children?: any;
  /** 其余 div 属性透传。 */
  [nativeAttribute: string]: any;
}

/**
 * 绘制一块菜单，并在 macOS 上于页面内容之后补一层不透明底衬。
 * CSS 锚点让每层底衬在放置、缩放与嵌套菜单移动时保持对齐。
 * @param props - div 内容与放置方式，以及紧凑几何。
 * @param ref - 可见的菜单 div（不含不可交互的底衬）。
 * @returns 菜单内容，外加随菜单一起移除的底衬 portal。
 */
export var MenuSurface: any = forwardRef(function MenuSurface(props: MenuSurfaceProps, ref: any) {
  var id = useId();

  var anchorStyle: Record<string, string> = {
    '--dsh-menu-anchor': '--dsh-menu-' + String(id).replace(/:/g, ''),
  };

  var rest: Record<string, any> = {};
  for (var key in props) {
    if (key === 'compact' || key === 'className' || key === 'style' || key === 'children') continue;
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    rest[key] = props[key];
  }

  return e(
    Fragment,
    null,
    e(
      'div',
      Object.assign({}, rest, {
        key: 'surface',
        ref: ref,
        'data-menu-material': 'translucent',
        className: clsx(css.dtsMenuSurface, props.compact === true && css.dtsMenuSurfaceCompact, props.className),
        style: Object.assign({}, props.style, anchorStyle),
      }),
      e('div', { 'aria-hidden': 'true', className: css.dtsMenuMaterial, key: 'material' }),
      props.children,
    ),
    createPortal(
      e('div', {
        'aria-hidden': 'true',
        'data-menu-backing': '',
        className: clsx(css.dtsMenuBacking, props.compact === true && css.dtsMenuSurfaceCompact),
        style: Object.assign({}, anchorStyle, {
          visibility: props.style === undefined ? undefined : props.style.visibility,
        }),
      }),
      document.body,
      'backing',
    ),
  );
}) as any;
