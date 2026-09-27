/**
 * src/client/tokens.ts —— 设计令牌常量与常用派生（自写控件层的样式依赖面）。
 *
 * 为什么单独一份：官方规范（references_practices.md:35）要求"令牌是唯一允许共享的样式依赖"。
 * 把令牌名集中在这里有两个好处 ——
 *   1. 控件样式表里凡是能用 `var(--dsw-*)` 的地方就不会写死颜色；改主题时全层跟着动；
 *   2. 谁引用了宿主并未发布的令牌，用 `.d.ts` 之外的一张清单就能一眼对出来。
 *
 * **清单的事实来源**：ui-theme 在 `lib/client.js` 里发布的全量令牌（404 个 `--dsw-*` /
 * `--dsh-*`，：1133-1180 的 base/design-platform/focus/gradient-shadow-text 四张表）。
 * 本文件只收录**本层控件真正用到**的那些，并为常用的几何事实提供数值常量。
 *
 * 已知的宿主令牌缺口（官方 primitives 自己也踩到，本层因此回避）：
 *   - `--dsw-alias-bg-layer-4`（lib/settings-form/fields.module.css 用了）与
 *     `--dsw-alias-label-error`（lib/settings-form/SettingsForm.module.css 用了）
 *     都**不在** ui-theme 发布的那 404 个里；本层一律不用它们，
 *     错误色统一走确有发布的 `--dsw-alias-state-error-primary`。
 */

/** 前缀：`--dsw-*` 是设计令牌（含 alias/static/elevation/radius/font 各族）。 */
export const DSW_PREFIX = '--dsw-';
/** 前缀：`--dsh-*` 是宿主发布的框架变量（内容字号轴、滚动条、菜单锚点、toast 保持时长…）。 */
export const DSH_PREFIX = '--dsh-';

/**
 * 圆角阶。数值来自 ui-theme 的 `:root`：
 * `--dsw-radius-xs:4px; --dsw-radius-sm:8px; --dsw-radius-md:12px; --dsw-radius-lg:16px;
 * --dsw-radius-xl:20px; --dsw-radius-panel:28px`。
 */
export const RADIUS = {
  xs: 'var(--dsw-radius-xs)',
  sm: 'var(--dsw-radius-sm)',
  md: 'var(--dsw-radius-md)',
  lg: 'var(--dsw-radius-lg)',
  xl: 'var(--dsw-radius-xl)',
  panel: 'var(--dsw-radius-panel)',
} as const;

/** 同一阶梯的像素值（官方在 `:root` 上的原值），供需要在 JS 里做几何计算的地方用。 */
export const RADIUS_PX = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, panel: 28 } as const;

/** 焦点环表达式：颜色可被 `--dsw-focus-ring-color` 重绑（ui-theme focus.css 的契约）。 */
export const FOCUS = {
  width: 'var(--dsw-focus-ring-width)',
  color: 'var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))',
} as const;

/** 官方控件几何事实（README.zh.md:44/114 与各控件 CSS 的原值）。 */
export const CONTROL_GEOMETRY = {
  /** Button md：H36 / R12。 */
  buttonMdHeight: 36,
  /** Button sm：H28 / R8。 */
  buttonSmHeight: 28,
  /** Input：H32 / R12 / 左右 8。 */
  inputHeight: 32,
  /** 设置页字段输入（NumberField/TextField/Select 触发器）：H34 / 左右 12。 */
  fieldHeight: 34,
  /** Switch：36×20，拇指 16，行程 16。 */
  switchWidth: 36,
  switchHeight: 20,
  switchThumb: 16,
  /** Checkbox 方框 16。 */
  checkboxBox: 16,
  /** Pill：H24。 */
  pillHeight: 24,
  /** Modal 卡片宽 min(380, 100%)、四周 24 空气。 */
  modalWidth: 380,
  modalInset: 24,
  /** Menu 卡片：min-width 144 / max-width 360 / padding 4 / 行 min-height 34。 */
  menuMinWidth: 144,
  menuMaxWidth: 360,
  menuPadding: 4,
  menuItemMinHeight: 34,
  /** 浮层与视口的净空（官方 Menu portal 的 MARGIN）。 */
  overlayMargin: 12,
  /** StateDot 槽位：实心 10 / ongoing 14；核 6（inset 20%）。 */
  stateDotSlot: 10,
  stateDotOngoing: 14,
  /** DisclosureRow 行高 24。 */
  disclosureRowHeight: 24,
} as const;

/**
 * 本层控件用到的 `--dsw-alias-*` 语义令牌（名称即用途，值随主题切换）。
 * 键名对控件是稳定 API，值是官方令牌名本身。
 */
export const ALIAS = {
  /* 文字 */
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  labelTertiary: 'var(--dsw-alias-label-tertiary)',
  labelDimmed: 'var(--dsw-alias-label-dimmed)',
  labelOnPrimary: 'var(--dsw-alias-label-primary-foreground)',
  /* 表面 */
  bgBase: 'var(--dsw-alias-bg-base)',
  bgLayer1: 'var(--dsw-alias-bg-layer-1)',
  bgLayer2: 'var(--dsw-alias-bg-layer-2)',
  bgLayer3: 'var(--dsw-alias-bg-layer-3)',
  bgModulePlatform: 'var(--dsw-alias-bg-module-platform)',
  bgMask1: 'var(--dsw-alias-bg-mask-1)',
  menuSurfaceFill: 'var(--dsw-menu-surface-fill)',
  /* 描边（l1 在菜单表面上几乎不可见，菜单里的分隔与底栏用 l2） */
  borderL1: 'var(--dsw-alias-border-l1)',
  borderL2: 'var(--dsw-alias-border-l2)',
  borderL3: 'var(--dsw-alias-border-l3)',
  borderL4: 'var(--dsw-alias-border-l4)',
  /* 交互填充 */
  interactiveHover: 'var(--dsw-alias-interactive-bg-hover)',
  interactiveActive: 'var(--dsw-alias-interactive-bg-active)',
  interactiveHoverDanger: 'var(--dsw-alias-interactive-bg-hover-danger)',
  /* 按钮族 */
  buttonPrimaryFill: 'var(--dsw-alias-button-primary-fill)',
  buttonPrimaryHover: 'var(--dsw-alias-button-primary-hover)',
  buttonToolbarFill: 'var(--dsw-alias-button-tool-bar-fill)',
  buttonToolbarHover: 'var(--dsw-alias-button-tool-bar-hover)',
  buttonGhostActiveFill: 'var(--dsw-alias-button-ghost-active-fill)',
  buttonGhostActiveBorder: 'var(--dsw-alias-button-ghost-active-border)',
  /* 品牌与状态 */
  brandPrimary: 'var(--dsw-alias-brand-primary)',
  stateBusiness: 'var(--dsw-alias-state-business-primary)',
  stateSuccess: 'var(--dsw-alias-state-success-primary)',
  stateWarn: 'var(--dsw-alias-state-warn-primary)',
  stateWarnLabel: 'var(--dsw-alias-state-warn-label)',
  stateError: 'var(--dsw-alias-state-error-primary)',
  stateIdle: 'var(--dsw-alias-state-idle-primary)',
  /* 浮层 */
  tooltipBg: 'var(--dsw-alias-tooltip-bg)',
  tooltipLabel: 'var(--dsw-static-neutral-bluish-00)',
  toastBg: 'var(--dsw-alias-toast-bg)',
  toastLabel: 'var(--dsw-alias-toast-label)',
  toastAction: 'var(--dsw-static-deepseek-400)',
  menuIcon: 'var(--dsw-alias-menu-icon)',
} as const;

/** 阴影 / elevation 阶（高层级表面 `border: 0` + elevation-stroke 自画发丝边）。 */
export const ELEVATION = {
  stroke: 'var(--dsw-elevation-stroke)',
  soft: 'var(--dsw-elevation-soft)',
  panel: 'var(--dsw-elevation-panel)',
  prominent: 'var(--dsw-elevation-prominent)',
  strokeColor: 'var(--dsw-elevation-stroke-color)',
  shadowLv3: 'var(--dsw-shadow-lv3)',
} as const;

/** 宿主发布的框架变量（`--dsh-*`）：字号轴、滚动条、菜单锚点、toast 保持时长、遮罩模糊。 */
export const FRAMEWORK = {
  /** 设置页字号偏好相对正文的增量（px），DisclosureRow 的行高/图标随之平移。 */
  contentFontDelta: 'var(--dsh-content-font-delta)',
  /** 比正文低一档的字号（默认 13px）。 */
  contentFontSizeSecondary: 'var(--dsh-content-font-size-secondary)',
  /** macOS 窗口条下方的顶边净空，所有 JS 钳制的浮层都要让出它。 */
  frameTopClearance: 'var(--dsh-frame-top-clearance)',
  /** 菜单材质：透明填充 + 40px 模糊 + 150% 饱和。 */
  menuSurfaceFill: 'var(--dsw-menu-surface-fill)',
  menuBackdropFilter: 'var(--dsw-menu-backdrop-filter)',
  /** 遮罩模糊令牌（ui-theme 当前发布为 `none`，即官方"遮罩不模糊背景"的实际效果）。 */
  maskBlur: 'var(--dsw-mask-blur)',
  /** 高层级表面的滚动条重绑目标（菜单/浮层/对话框用 l2）。 */
  scrollbarThumb: 'var(--dsh-scrollbar-thumb)',
  scrollbarThumbHover: 'var(--dsh-scrollbar-thumb-hover)',
  /** 由组件写入、供样式表读取的 toast 保持时长。 */
  toastHold: 'var(--dsh-toast-hold)',
  /** 由 SegmentedControl 写入、供指示块算术定位的两个量。 */
  segmentCount: 'var(--dsh-segment-count)',
  segmentIndex: 'var(--dsh-segment-index)',
} as const;

/**
 * 归一化一个令牌名：接受 `dsw-alias-label-primary`、`--dsw-alias-label-primary`
 * 两种写法，返回 `var(--dsw-alias-label-primary)`。
 * @param name 令牌名（可带可不带前导 `--`）。
 * @returns 可直接放进 style 的 `var(...)` 表达式。
 */
export function token(name: string): string {
  const normalized = name.indexOf('--') === 0 ? name : `--${name}`;
  return `var(${normalized})`;
}

/**
 * 带兜底值的令牌表达式：`var(--dsw-x, fallback)`。
 * @param name 令牌名。
 * @param fallback 令牌未发布时的兜底值（通常写官方在 `:root` 上的原值）。
 * @returns `var(...)` 表达式。
 */
export function tokenWithFallback(name: string, fallback: string): string {
  return `var(${name.indexOf('--') === 0 ? name : `--${name}`}, ${fallback})`;
}

/**
 * 读取某个令牌当前解析出的值（含主题、作用域重绑与内联覆盖）。
 * @param name 令牌名。
 * @param element 读取起点，默认 `document.documentElement`。
 * @returns 解析后的字符串（未定义时为空串）。
 */
export function readToken(name: string, element?: Element | null): string {
  const target = element === undefined || element === null ? document.documentElement : element;
  const normalized = name.indexOf('--') === 0 ? name : `--${name}`;
  return getComputedStyle(target).getPropertyValue(normalized).trim();
}

/**
 * 在给定元素上写一个令牌覆盖（内联自定义属性）。
 * 只碰调用方给的元素，不碰全局作用域 —— 本层没有任何控件会自己改根节点。
 * @param element 作用域元素。
 * @param name 令牌名。
 * @param value 新值（空串表示清除该覆盖）。
 */
export function writeToken(element: HTMLElement, name: string, value: string): void {
  const normalized = name.indexOf('--') === 0 ? name : `--${name}`;
  if (value === '') element.style.removeProperty(normalized);
  else element.style.setProperty(normalized, value);
}

/**
 * 摘掉一个令牌覆盖，回到级联算出来的值。
 * @param element 作用域元素。
 * @param name 令牌名。
 */
export function clearToken(element: HTMLElement, name: string): void {
  writeToken(element, name, '');
}
