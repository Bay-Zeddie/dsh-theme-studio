// src/client/primitives.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { P, e } from './deps.ts'

        /* ============================================================ */
        /* 官方控件适配：缺失时退回等价原生元素                             */
        /* ============================================================ */

        export function uiButton(props) {
          if (P.Button) {
            // 官方 Button 的 variant 只有 primary/ghost/outline/toolbar（Button.tsx）：
            // 'danger' 是契约外值，映射到 ghost + 自家红色类，两套回退视觉一致。
            return e(P.Button, {
              variant: props.variant === 'primary' ? 'primary' : 'ghost',
              className: props.variant === 'danger' ? 'dts-btn-danger' : undefined,
              size: props.size,
              disabled: props.disabled,
              title: props.title,
              'aria-label': props.ariaLabel,
              onClick: props.onClick,
            }, props.children)
          }
          return e('button', {
            type: 'button', className: props.size === 'sm' ? 'dts-btn dts-btn--sm' : 'dts-btn',
            'data-tone': props.variant === 'primary' ? 'primary' : (props.variant === 'danger' ? 'danger' : undefined),
            disabled: props.disabled, title: props.title, 'aria-label': props.ariaLabel,
            onClick: props.onClick,
          }, props.children)
        }

        /** Switch 的 label 只做无障碍名称（官方实现不画文字），可见标签由 Row 给。 */
        export function uiSwitch(props) {
          if (P.Switch) {
            return e(P.Switch, {
              checked: !!props.checked, disabled: props.disabled,
              title: props.title, label: props.label, onChange: props.onChange,
            })
          }
          return e('button', {
            type: 'button', className: 'dts-switch', role: 'switch',
            'aria-checked': !!props.checked, 'aria-label': props.label, title: props.title,
            disabled: props.disabled,
            onClick: function () { props.onChange(!props.checked) },
          })
        }

        export function uiPill(props) {
          if (P.Pill) return e(P.Pill, { active: !!props.active, title: props.title, onClick: props.onClick }, props.children)
          return e('button', {
            type: 'button', className: 'dts-pill', 'aria-pressed': props.active ? 'true' : 'false',
            title: props.title, onClick: props.onClick,
          }, props.children)
        }

        /** 状态点：官方 StateDot 的 prop 是 `state`（done/warning/error/idle/ongoing）。 */
        export function uiStateDot(props) {
          if (P.StateDot) return e(P.StateDot, { state: props.state })
          return e('span', { 'aria-hidden': 'true', className: 'dts-dot', 'data-state': props.state })
        }

        /**
         * Tooltip 的 children 必须能接 ref ⇒ 只包原生元素；
         * 包官方控件时先套一层 span，避免 ref 转发告警与错位。
         */
        export function uiTooltip(label, child) {
          if (!P.Tooltip || !label) return child;
          try { return e(P.Tooltip, { label: label, side: 'top' }, child) } catch (err) { return child }
        }

        export function wrapForTooltip(label, element) {
          return uiTooltip(label, e('span', { className: 'dts-btnwrap' }, element))
        }

