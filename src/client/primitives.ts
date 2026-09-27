// src/client/primitives.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
//
// 合规改造：本文件曾经是「官方 ui-primitives 的薄适配层 + 缺失退回原生元素」。
// 官方规范（references_practices.md:35）禁止插件 require 任何 Harness Client 包
// （`@deepseek-ai/dsh-client-ui-primitives` 等）：它们随时会变、纯 JS 插件没有类型检查、
// 组件一抛异常整个 slot 条目就白屏（console: `slot entry crashed in '<slot>'`）。
// 规范给的正解是「把 markup / CSS / 行为抄进插件自己包里，类名换成自己的前缀，
// 只留 `--dsw-*` 令牌引用」—— 那一层就是 ./controls/**（19 个自写控件）。
//
// 所以本文件现在的职责只有一个：**保持对外导出形状不变，内部改从控件层取实现**，
// 让调用点（tabs.ts / app.ts）的改动降到最小。没有任何「官方在不在」的分支了 ——
// 控件是静态导入，永远在位，不存在降级路径（这正是自给自足的意思）。
import { Button, Pill, StateDot, Switch, Tooltip } from './controls/index.ts'
import { e } from './deps.ts'

        /* ============================================================ */
        /* 自写控件层的取用面（形状与旧适配层一致）                          */
        /* ============================================================ */

        export function uiButton(props) {
          // 官方 Button 的 variant 只有 primary/ghost/outline/toolbar（Button.ts）：
          // 'danger' 是契约外值，映射到 ghost + 自家红色类（.dts-btn-danger）——
          // 这条映射是上游调用点依赖的契约，控件层同样不认 'danger'，必须留在这里。
          return e(Button, {
            variant: props.variant === 'primary' ? 'primary' : 'ghost',
            className: props.variant === 'danger' ? 'dts-btn-danger' : undefined,
            size: props.size,
            disabled: props.disabled,
            title: props.title,
            'aria-label': props.ariaLabel,
            // 弹窗初始焦点标记（官方 `useModalLayer` 只认这个属性，不认 React autoFocus）：
            // 原生 button 属性透传，所以能直接落在 Button 渲染出的 <button> 上。
            'data-modal-autofocus': props.autofocus === true ? '' : undefined,
            onClick: props.onClick,
          }, props.children)
        }

        /** Switch 的 label 只做无障碍名称（官方实现不画文字），可见标签由 Row 给。 */
        export function uiSwitch(props) {
          return e(Switch, {
            checked: !!props.checked, disabled: props.disabled,
            title: props.title, label: props.label, onChange: props.onChange,
          })
        }

        export function uiPill(props) {
          return e(Pill, { active: !!props.active, title: props.title, onClick: props.onClick }, props.children)
        }

        /** 状态点：控件的 prop 是 `state`（done/warning/error/idle/ongoing）。 */
        export function uiStateDot(props) {
          return e(StateDot, { state: props.state })
        }

        /**
         * Tooltip 的 children 必须能接 ref ⇒ **只包原生元素**。
         * 控件靠 `cloneElement(child, { ref })` 定位锚点，函数式/类组件不转发 ref
         * 就永远量不到矩形、气泡永不出现（旧适配层踩过同一个坑）。
         * label 为空时直接返回 children：不挂一个没有文案的气泡。
         */
        export function uiTooltip(label, child) {
          if (!label) return child;
          return e(Tooltip, { label: label, side: 'top' }, child)
        }
