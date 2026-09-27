/**
 * controls/index.ts —— 自写控件层的统一出口。
 *
 * 这一层是 `src/client/primitives.ts` 里 `require('@deepseek-ai/dsh-client-ui-primitives')`
 * 的替代品：官方规范（references_practices.md:35）明文禁止插件把 Harness Client 包当模块加载，
 * 要求"抄 markup、CSS 与行为到自己包里，类名换成自己的前缀，只保留 `--dsw-alias-*` 令牌引用"。
 * 每个控件文件头都记着它抄自官方产物的哪一段（`lib/index.js:行号` 或 `lib/X.module.css`）。
 *
 * 用法：`import { Button, Switch, Modal } from './controls/index.ts'`。
 * 顺序与官方 README.zh.md 的"组件目录"一致，便于逐条对照。
 */

/* 基础动作与状态 */
export { Button } from './Button.ts';
export type { ButtonProps, ButtonSize, ButtonVariant } from './Button.ts';
export { Switch } from './Switch.ts';
export type { SwitchProps } from './Switch.ts';
export { Checkbox } from './Checkbox.ts';
export type { CheckboxProps } from './Checkbox.ts';
export { Pill } from './Pill.ts';
export type { PillProps } from './Pill.ts';
export { Tag } from './Tag.ts';
export type { TagProps, TagTone } from './Tag.ts';
export { StateDot } from './StateDot.ts';
export type { StateDotProps, StateDotState } from './StateDot.ts';
export { DisclosureRow } from './DisclosureRow.ts';
export type { DisclosureRowProps } from './DisclosureRow.ts';

/* 受控选择：分段控件（互斥模式）与分段标签（等宽页签）按官方判据各用其一 */
export { SegmentedControl } from './SegmentedControl.ts';
export type { SegmentedControlProps, SegmentedControlOption } from './SegmentedControl.ts';
export { SegmentedTabs } from './SegmentedTabs.ts';
export type { SegmentedTabsProps, SegmentedTabsItem } from './SegmentedTabs.ts';

/* 输入族 */
export { Input } from './Input.ts';
export type { InputProps } from './Input.ts';
export { TextField } from './TextField.ts';
export type { TextFieldProps } from './TextField.ts';
export { NumberField } from './NumberField.ts';
export type { NumberFieldProps } from './NumberField.ts';
export { Slider } from './Slider.ts';
export type { SliderProps } from './Slider.ts';
export { Select } from './Select.ts';
export type { SelectProps, SelectOption } from './Select.ts';

/* 浮层族 */
export { Menu, MenuItemButton } from './Menu.ts';
export type { MenuProps, MenuEntry, MenuOptionEntry, MenuLabelEntry, MenuSeparatorEntry, MenuItemButtonProps } from './Menu.ts';
export { MenuSurface } from './MenuSurface.ts';
export type { MenuSurfaceProps } from './MenuSurface.ts';
export { Modal } from './Modal.ts';
export type { ModalProps } from './Modal.ts';
export { Toast } from './Toast.ts';
export type { ToastProps, ToastAction } from './Toast.ts';
export { Tooltip } from './Tooltip.ts';
export type { TooltipProps } from './Tooltip.ts';

/* 内部运行时垫片（react 基座、focus/Escape 生命周期、浮层几何、输入模态）。
 * 控件之外也要用同一套契约时从这里取，不要各自再 require 一次 react。 */
export {
  React,
  AUTOMATIC_FOCUS_ATTRIBUTE,
  INPUT_MODALITY,
  OVERLAY_MARGIN,
  clsx,
  createPortal,
  e,
  focusWithoutRing,
  isBehindModal,
  observeComposition,
  overlayTopMargin,
  pointerModality,
  subscribeInputModality,
  useAnchoredPosition,
  useModalLayer,
} from './runtime.ts';
