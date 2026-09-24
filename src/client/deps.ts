// src/client/deps.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。

        /* ============================================================ */
        /* 依赖装载：react 基座必给；其余取不到就降级                       */
        /* ============================================================ */

        export var React: any = require('react');
        export var ReactDOMClient: any = null;
        /** 官方 ui-primitives 句柄（缺失时为空对象，适配层逐个降级）。 */
        export var P: any = {};

        try { ReactDOMClient = require('react-dom/client') || null; } catch (err) { ReactDOMClient = null }
        try { P = require('@deepseek-ai/dsh-client-ui-primitives') || {} } catch (err) { P = {} }

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

