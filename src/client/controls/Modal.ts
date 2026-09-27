/**
 * controls/Modal.ts —— 官方 Modal 的自写替代。
 *
 * 官方来源：lib/index.js:4989-5062（lib/types/Modal.js）+ lib/Modal.module.css
 * + lib/index.js:3632-3719（lib/types/useModalLayer.js，焦点与 Escape 的生命周期，
 * 已逐字移植到 ./runtime.ts 的 useModalLayer）。
 * 抄了什么（官方点名要保的行为全在）：
 *   - 结构与语义：`createPortal(..., document.body)`；根层 `role="presentation"` 且把
 *     `onKeyDownCapture` 挂在**根**上（嵌套对话框因此能在文档级 Escape 之前拦到按键）；
 *     遮罩 `aria-hidden` 且**点击即关**（不吃穿透：遮罩自己就是那一层，点击不会落到页面）；
 *     卡片 `role="dialog"` + `aria-modal="true"` + `aria-label={title}` + `tabIndex=-1`；
 *   - 焦点：`useModalLayer` 保存打开前的 activeElement，初始焦点取 `[data-modal-autofocus]`
 *     → 第一个可聚焦控件 → 容器本身（**必须用 data 属性而不是 React autoFocus**，
 *     否则 autoFocus 会先于本层保存触发控件执行）；关闭（Escape / 应用关闭 / 遮罩点击）
 *     且本层在最顶时把焦点**归还**给先前元素（`focusWithoutRing`，不画焦点环）；
 *   - Escape：仅最顶层模态吃掉，`shift+Escape` 不吃，`event.repeat` 不重复关闭；
 *   - Tab 陷阱：容器聚焦时 Tab/Shift+Tab 分别进首/末个可聚焦控件，在边缘环绕；
 *     `[inert]` / `[hidden]` 子树被排除；
 *   - `headless`：只保留遮罩/卡片/Escape/aria-label，不画默认头与关闭按钮；
 *   - `backdropBlur`：默认 true，走 CSS 的 `backdrop-filter: var(--dsw-mask-blur)`。
 * 改了什么：类名前缀 dts；官方用的关闭图标不能 require，改为内联同一份路径（16 viewBox / 1px）。
 *
 * **核实过的官方事实（任务书里的说法需要更正）**：官方 `backdropBlur` 默认值是 **true**，
 * 不是 false（lib/index.js:5010）。默认形态下遮罩的模糊来自 `var(--dsw-mask-blur)`，而
 * ui-theme 把这个令牌定义为 `none`（ui-theme/lib/client.js:1160），所以**默认效果确实是不模糊背景**
 * —— 与 README.zh.md:118「模态遮罩保留黑色半透明填充，不模糊背景」一致；
 * `backdropBlur={false}` 则是硬写 `backdrop-filter: none`，供重绑过该令牌的宿主显式关掉。
 */
import { clsx, createPortal, e, useModalLayer, useRef } from './runtime.ts';
import css from './Modal.module.css';

export interface ModalProps {
  /** 是否显示。 */
  open: boolean;
  /** 应用关闭、Escape 或遮罩点击；对话框内有菜单打开时 Escape 先归菜单。 */
  onClose: () => void;
  /** 对话框标题（每种模式下都作为 aria-label）；必填。 */
  title: string;
  /** 关闭按钮的本地化无障碍名称；必填。 */
  closeLabel: string;
  /** 标题下方的可选说明句。 */
  description?: string;
  /** 对话框正文；初始焦点控件用 `data-modal-autofocus` 标记。 */
  children?: any;
  /** 动作行（取消 / 创建）。 */
  footer?: any;
  /** 卡片本身的额外类名。 */
  className?: string;
  /** 可滚动内容区的额外类名。 */
  contentClassName?: string;
  /** 在文档级 Escape 监听之前处理嵌套对话框的按键。 */
  onKeyDownCapture?: (event: any) => void;
  /** 直接在卡片里渲染 children（不要默认的头部/关闭/正文外壳）；遮罩、卡片、Escape 与 aria-label 仍在。 */
  headless?: boolean;
  /** 调用方已经模糊了页面时置 false；默认 true（走 `--dsw-mask-blur`，当前主题为 none）。 */
  backdropBlur?: boolean;
  /** 允许快捷键命令生效的作用域；未命名对话框会拦住应用命令。 */
  shortcutModal?: string;
}

/** 官方 IconCloseOutlineRegular 的路径（16 viewBox / 1px 描边），用作关闭按钮图形。 */
function CloseGlyph(): any {
  return e(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 16 16',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      'aria-hidden': 'true',
      strokeWidth: 1,
    },
    e('path', { d: 'M2.5 2.5L13.5 13.5', stroke: 'currentColor', key: 'a' }),
    e('path', { d: 'M13.5 2.5L2.5 13.5', stroke: 'currentColor', key: 'b' }),
  );
}

/**
 * 渲染一个居中的、portal 到 body 的模态对话框。
 * @param props - 见 {@link ModalProps}。
 * @returns 关闭时为 null；否则整棵浮层树。
 */
export function Modal(props: ModalProps): any {
  var dialog = useRef(null);
  useModalLayer(dialog, props.open, props.onClose);
  if (!props.open) return null;

  return createPortal(
    e(
      'div',
      {
        className: css.dtsModalRoot,
        role: 'presentation',
        onKeyDownCapture: props.onKeyDownCapture,
      },
      e('div', {
        key: 'mask',
        className: css.dtsModalMask,
        style: props.backdropBlur === false ? { backdropFilter: 'none' } : undefined,
        'aria-hidden': 'true',
        onClick: props.onClose,
      }),
      e(
        'div',
        {
          key: 'dialog',
          ref: dialog,
          tabIndex: -1,
          'data-shortcut-modal': props.shortcutModal,
          className: clsx(css.dtsModalDialog, props.className),
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': props.title,
        },
        props.headless === true
          ? props.children
          : [
              e(
                'div',
                { className: clsx(css.dtsModalContent, props.contentClassName), key: 'content' },
                e(
                  'div',
                  { className: css.dtsModalHeader, key: 'header' },
                  e('h2', { className: css.dtsModalTitle, key: 'title' }, props.title),
                  e(
                    'button',
                    {
                      key: 'close',
                      type: 'button',
                      className: css.dtsModalClose,
                      'aria-label': props.closeLabel,
                      onClick: props.onClose,
                    },
                    e(CloseGlyph, null),
                  ),
                ),
                props.description !== undefined && props.description !== ''
                  ? e('p', { className: css.dtsModalDescription, key: 'description' }, props.description)
                  : null,
                props.children !== undefined
                  ? e('div', { className: css.dtsModalBody, key: 'body' }, props.children)
                  : null,
              ),
              props.footer !== undefined
                ? e('div', { className: css.dtsModalFooter, key: 'footer' }, props.footer)
                : null,
            ],
      ),
    ),
    document.body,
  );
}
