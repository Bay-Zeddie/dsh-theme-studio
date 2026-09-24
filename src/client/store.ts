// src/client/store.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { useCallback, useSyncExternalStore } from './deps.ts'

        /* ============================================================ */
        /* 可观察存储                                                     */
        /* ============================================================ */

        export function createStore(initial: any): any {
          var snapshot = initial;
          /** 订阅者集合：显式标注，否则 Set<unknown> 让 fn() 不可调用。 */
          var listeners = new Set<() => void>();
          return {
            get: function () { return snapshot },
            set: function (next) {
              if (next === snapshot) return;
              snapshot = next;
              listeners.forEach(function (fn) { fn() });
            },
            update: function (patch) {
              this.set(Object.assign({}, snapshot, typeof patch === 'function' ? patch(snapshot) : patch));
            },
            subscribe: function (fn) {
              listeners.add(fn);
              return function () { listeners.delete(fn) };
            },
          };
        }

        export function useSlice(store: any): any {
          var read = useCallback(store.get, [store]);
          var subscribe = useCallback(store.subscribe, [store]);
          return useSyncExternalStore(subscribe, read, read);
        }

