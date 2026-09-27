// src/client/deps.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。

        /* ============================================================ */
        /* 依赖装载：react 基座必给；其余取不到就降级                       */
        /* ============================================================ */

        // ⛔ 这里曾经 `require('@deepseek-ai/dsh-client-ui-primitives')` —— 官方规范
        // （references_practices.md:35）明文禁止插件把 Harness Client 包当模块加载：
        // 它们随时会变、纯 JS 插件没有类型检查、组件一抛异常整个 slot 条目就白屏。
        // 控件已自写并落在 ./controls/**（令牌是唯一的共享样式依赖），官方包一个都不 require。
        export var React: any = require('react');
        export var ReactDOMClient: any = null;

        try { ReactDOMClient = require('react-dom/client') || null; } catch (err) { ReactDOMClient = null }

        /**
         * createElement 简写。
         * ⚠️ 必须是函数声明而不是箭头 —— 要用 arguments 收可变子节点，
         * 箭头函数没有自己的 arguments（node --check 抓不到，只在运行时炸）。
         */
        export function e(type: any, props: any, ..._children: any[]): any {
          var children = Array.prototype.slice.call(arguments, 2);
          return React.createElement.apply(React, [type, props].concat(children));
        }

        export const useState: any = React.useState;
        export const useEffect: any = React.useEffect;
        export const useRef: any = React.useRef;
        export const useCallback: any = React.useCallback;
        export const useSyncExternalStore: any = React.useSyncExternalStore;

