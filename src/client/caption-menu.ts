// src/client/caption-menu.ts —— Windows 顶条「编辑」菜单的磨砂替身。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。

        /**
         * 系统原生弹层拦不到：`应用 / 编辑` 两个下拉是 **Electron 原生菜单**，不是页面元素
         * （app.asar 里取证）：
         *
         *   preload: const buttons = [createButton("application", 0), createButton("edit", 1)]
         *            button.addEventListener("click", () => open())
         *            await electron.ipcRenderer.invoke(DESKTOP_IPC.windowsMenu, name, rect.left, rect.bottom)
         *   main:    ipcMain.handle(DESKTOP_IPC.windowsMenu, (e, name, x, y) =>
         *              Menu.buildFromTemplate(items).popup({ window, x, y }))
         *
         * 弹出的是**另一个原生窗口**，页面里的 CSS / `backdrop-filter` / 主题令牌一条都够不着 ——
         * 所以"改成磨砂"只有一条路：在它弹出**之前**把那次点击拦下来，换成自己的 DOM 面板。
         *
         * **只拦 `edit`（索引 1，与语言无关的顺序常量）**：
         *   · `edit` 七项动作就在页面里（编辑器本来的命令），自绘后一点即达，与原生等价。
         *   · `application` 三项（关于 / 检查更新 / 退出）**保持系统原生、一律放行**。
         *     它们的动作是主进程闭包 `applicationItems()` 里的
         *     `about()/checkUpdates()/app.quit()`，插件拿不到 ipcRenderer、client 的
         *     Service 目录里没有 app 服务、preload 也只暴露了
         *     `dshPlatform / __DSH_HOST_PATHS__ / dshDesktopBoot / dshOnboarding`（实测）。
         *     之前试过"自绘面板 + 点项时转交系统菜单（要点两次）"，主人实测**有 bug**，
         *     于是按主人指令**只把「应用」恢复原样、「编辑」不动** —— 这里就是那条边界：
         *     application 的点击绝不 preventDefault / stopPropagation，走宿主自己的 IPC。
         */
import { t } from './i18n.ts'

        type Entry = { kind: 'sep' } | { kind: 'cmd'; label: string; accel: string; cmd: string }

        /**
         * 记住焦点所在的编辑器：面板是 `body` 上的固定层，点它会把焦点抢走，
         * 而编辑命令必须作用在**编辑器**上 —— 打开时存、执行命令前还回去
         * （与 preload 里 `restoreEditor()` 同一套动作）。
         */
        function rememberEditor() {
          const el = document.activeElement
          if (el instanceof HTMLInputElement) return { el, start: el.selectionStart, end: el.selectionEnd }
          if (el instanceof HTMLTextAreaElement) return { el, start: el.selectionStart, end: el.selectionEnd }
          if (el instanceof HTMLElement && el.isContentEditable) return { el, start: undefined, end: undefined }
          return null
        }

        function restoreEditor(saved: ReturnType<typeof rememberEditor>) {
          if (saved === null) return
          const el = saved.el
          if (!el.isConnected) return
          try {
            el.focus({ preventScroll: true })
            if (saved.start != null && saved.end != null && typeof (el as HTMLInputElement).setSelectionRange === 'function') {
              (el as HTMLInputElement).setSelectionRange(saved.start, saved.end)
            }
          } catch (err) { /* 焦点还不了就不阻断命令 */ }
        }

        /**
         * 执行编辑命令。返回值告诉调用方**这次到底成没成** —— 早先失败是静默的：
         * `undo` 在无撤销栈、`cut/copy` 在无选区时都返回 false，用户点了菜单什么都不发生，
         * 分不清"命令失败"还是"没生效"。现在把成败透出去，由面板给一条可见提示。
         */
        function runEditCommand(cmd: string, saved: ReturnType<typeof rememberEditor>): boolean {
          restoreEditor(saved)
          let done = false
          try { done = document.execCommand(cmd) } catch (err) { done = false }
          if (done) return true
          if (cmd !== 'paste') return false
          // Chromium 对 web 内容禁掉 execCommand('paste')；退回 Ctrl+V —— 应用自己的
          // 粘贴处理（文本/图片/文件）正是挂在 keydown 上的，与用户手按等价。
          //
          // ⚠️ 两条自检，缺一就会"静默无效"：
          // ① 目标必须是**真的可编辑焦点**：若 restoreEditor 因原元素掉线而提前返回，
          //    activeElement 会是 <body>，事件打到 body 上必然没反应 —— 这种情况直接判失败。
          // ② dispatchEvent 的返回值：false 表示被 preventDefault 掉了（有人接了），
          //    才算这次回退生效；合成事件的 isTrusted 为 false，宿主若不认这也没办法，
          //    但至少我们不再**无条件**宣称成功。
          const active = document.activeElement
          const editable = active !== null && active !== document.body
            && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
              || (active instanceof HTMLElement && active.isContentEditable))
          if (!editable) return false
          const accepted = active.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'v', code: 'KeyV', ctrlKey: true, bubbles: true, cancelable: true,
          }))
          return accepted === false
        }

        /** 与主进程 edit 菜单逐项对齐（label / 快捷键 / 命令一字不差）。 */
        function editEntries(): Entry[] {
          return [
            { kind: 'cmd', label: t('menu.undo'), accel: 'Ctrl+Z', cmd: 'undo' },
            { kind: 'cmd', label: t('menu.redo'), accel: 'Ctrl+Y', cmd: 'redo' },
            { kind: 'sep' },
            { kind: 'cmd', label: t('menu.cut'), accel: 'Ctrl+X', cmd: 'cut' },
            { kind: 'cmd', label: t('menu.copy'), accel: 'Ctrl+C', cmd: 'copy' },
            { kind: 'cmd', label: t('menu.paste'), accel: 'Ctrl+V', cmd: 'paste' },
            { kind: 'cmd', label: t('menu.delete'), accel: 'Delete', cmd: 'delete' },
            { kind: 'sep' },
            { kind: 'cmd', label: t('menu.selectAll'), accel: 'Ctrl+A', cmd: 'selectAll' },
          ]
        }

        /**
         * 挂载顶条菜单的拦截：返回卸载函数。
         * 找不到 `[data-windows-menu]`（非 Windows / preload 尚未装）时只登记监听、
         * 每次点击现查 —— 菜单条是 MutationObserver 挂上来的，装的时机不归我们管。
         */
        export function installCaptionMenu() {
          /**
           * 挂到**浮层容器**（`shell.overlay` 里的 `#dts-overlay-host`）——
           * 官方 `practices.md:36` 明令「不要在自己组件之外写 DOM、不要 append 到 body」。
           * 容器缺席时（老宿主 / 时序未到）才退回 `document.body`，保证功能不丢。
           */
          function mountToOverlay(node) {
            var overlay = document.getElementById('dts-overlay-host');
            (overlay === null || overlay === undefined ? document.body : overlay).appendChild(node);
          }

          let panel: HTMLElement | null = null
          let saved: ReturnType<typeof rememberEditor> = null
          let expandedButton: HTMLElement | null = null
          /* 失败提示条的句柄与它的自动消隐定时器 —— 两者都是**本组件注册的资源**，
             必须由下面返回的 disposer 收口（`references_ui-plugin.md:13`：定时器要在
             `apply` 里用 `ctx.effect` 登记并返回清理函数）。原先定时器裸挂在 `notify()`
             里：不泄漏（2.4s 自清），但**不受卸载控制** —— 卸载后那 2.4s 内一条
             `dts-cmenu-toast` 会留在 body 上，且连续两次失败会叠两个定时器。 */
          let toast: HTMLElement | null = null
          let toastTimer = 0

          const close = () => {
            if (panel !== null) { panel.remove(); panel = null }
            if (expandedButton !== null) { expandedButton.setAttribute('aria-expanded', 'false'); expandedButton = null }
          }

          /** 撤掉提示条并停掉它的定时器。幂等：没有提示条时是空操作。 */
          const hideToast = () => {
            if (toastTimer !== 0) { clearTimeout(toastTimer); toastTimer = 0 }
            if (toast !== null) { toast.remove(); toast = null }
          }

          /** 面板内的菜单项（不含分隔符）。键盘导航与焦点圈闭都要用。 */
          const itemsOf = (root: HTMLElement) =>
            Array.prototype.slice.call(root.querySelectorAll('.dts-cmenu-item')) as HTMLElement[]

          /**
           * 失败提示：`role="status"` + `aria-live="polite"`，读屏与视觉都能拿到。
           * 没有它的话，命令失败 = 界面毫无反应，用户无法区分"失败"和"没点中"。
           * ⚠️ 先 `hideToast()` 再挂新的：连点两次失败**只留一条**提示、**只留一个**
           * 定时器（旧实现每次 notify 都新起一个 setTimeout，句柄谁也不认识）。
           */
          const notify = (message: string) => {
            hideToast()
            const node = document.createElement('div')
            node.className = 'dts-cmenu-toast'
            node.setAttribute('role', 'status')
            node.setAttribute('aria-live', 'polite')
            node.textContent = message
            mountToOverlay(node)
            toast = node
            toastTimer = window.setTimeout(() => {
              toastTimer = 0
              if (toast === node) { node.remove(); toast = null }
            }, 2400)
          }

          const open = (anchor: Element, entries: Entry[]) => {
            const rect = anchor.getBoundingClientRect()
            saved = rememberEditor()
            const root = document.createElement('div')
            root.className = 'dts-cmenu'
            root.setAttribute('role', 'menu')
            root.tabIndex = -1
            for (const entry of entries) {
              if (entry.kind === 'sep') {
                const divider = document.createElement('div')
                divider.className = 'dts-cmenu-sep'
                divider.setAttribute('role', 'separator')
                root.appendChild(divider)
                continue
              }
              const button = document.createElement('button')
              button.type = 'button'
              button.className = 'dts-cmenu-item'
              button.setAttribute('role', 'menuitem')
              // roving tabindex：默认只第一项可 Tab 进入，箭头键在项间移动并改 tabIndex。
              button.tabIndex = -1
              const label = document.createElement('span')
              label.textContent = entry.label
              button.appendChild(label)
              if (entry.kind === 'cmd') {
                const key = document.createElement('kbd')
                key.textContent = entry.accel
                button.appendChild(key)
              }
              button.addEventListener('click', () => {
                const cmd = entry.kind === 'cmd' ? entry.cmd : ''
                close()
                const ok = runEditCommand(cmd, saved)
                // 失败才提示，并且只提示"没做到"，不去猜原因（原因分不清，别编）。
                if (!ok) notify(t('menu.noop', entry.label))
                else restoreEditor(saved)
              })
              root.appendChild(button)
            }
            mountToOverlay(root)

            /* ── 定位：先按锚点下方放，放不下就上翻；右侧超界就左收。 ──
               原先直接写 rect.left/rect.bottom：编辑器窗口靠右时面板会伸出视口，
               而「编辑」按钮就在顶条右侧、紧邻最小化键 —— 是常态而非边角。
               尺寸要 append 之后才量得到（CSS 由 dts-cmenu 决定）。 */
            const size = root.getBoundingClientRect()
            const gap = 4
            const vw = window.innerWidth
            const vh = window.innerHeight
            let left = rect.left
            if (left + size.width > vw - gap) left = Math.max(gap, vw - gap - size.width)
            let top = rect.bottom + gap
            if (top + size.height > vh - gap) {
              const above = rect.top - gap - size.height
              top = above >= gap ? above : Math.max(gap, vh - gap - size.height)
            }
            root.style.left = `${Math.round(left)}px`
            root.style.top = `${Math.round(top)}px`

            panel = root
            expandedButton = anchor as HTMLElement
            expandedButton.setAttribute('aria-expanded', 'true')
            /* 焦点落到**第一项**而不是容器：落在 tabIndex=-1 的容器上时，
               Enter/Space 什么都不会发生，用户必须再 Tab 一次才进得来 ——
               这就是"键盘基本不可用"的直接原因。 */
            const first = itemsOf(root)[0]
            if (first !== undefined) first.tabIndex = 0
            try { (first ?? root).focus({ preventScroll: true }) } catch (err) { /* 不支持聚焦就算了 */ }
          }

          /**
           * 面板内键盘契约（对齐官方 Menu 与自家 Choice，同一插件不搞两套）：
           * ↑↓ wrap、Home/End 首尾、Enter/Space 执行、Esc 关并把焦点交还锚点、
           * Tab 在面板内圈闭（跑出去就会出现"面板悬空但焦点已在宿主页面"）。
           */
          const onPanelKey = (event: KeyboardEvent) => {
            if (panel === null) return
            const items = itemsOf(panel)
            if (items.length === 0) return
            const at = items.indexOf(document.activeElement as HTMLElement)
            const moveTo = (index: number) => {
              event.preventDefault()
              for (const it of items) it.tabIndex = -1
              const node = items[(index + items.length) % items.length]
              node.tabIndex = 0
              node.focus()
            }
            if (event.key === 'ArrowDown') return moveTo(at + 1)
            if (event.key === 'ArrowUp') return moveTo(at - 1)
            if (event.key === 'Home') return moveTo(0)
            if (event.key === 'End') return moveTo(items.length - 1)
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              if (at >= 0) items[at].click()
              return
            }
            if (event.key === 'Tab') {
              event.preventDefault()
              event.stopPropagation()
              moveTo(event.shiftKey ? at - 1 : at + 1)
            }
          }

          /**
           * 定位顶条那两个原生菜单按钮 —— **不靠 `children[0]/[1]` 索引**。
           *
           * 取证（app.asar → lib/preload-app.cjs，`createButton` 原文）：
           *   button.setAttribute("role", "menuitem")
           *   button.setAttribute("aria-haspopup", "menu")
           *   button.tabIndex = index === 0 ? 0 : -1
           *   const buttons = [createButton("application", 0), createButton("edit", 1)]
           *
           * 注意两件事：
           * ① 按钮**没有** name/aria-label/class 之类的稳定标识 —— 文字是
           *    `buttons[0].textContent = messages.application` 后填的，**随语言变**，
           *    所以不能拿 textContent 当锚（中英文下会失配）。
           * ② 早先这里用 `bar.children[0]`/`children[1]`：宿主只要在菜单条里插一个
           *    别的东西（分隔符、包装层）就会**整体错位**，而错位的后果很严重 ——
           *    我们会对「应用」preventDefault，直接违反本文件开头那条边界，
           *    导致「关于/检查更新/退出」完全点不开。
           *
           * 现在的锚：bar 里**按 `role="menuitem"` 取全集**（preload 只给这两个按钮挂该
           * role，`update()` 只改文字不改结构），再按 `aria-haspopup="menu"` 收窄。
           * 拿到的如果**不是恰好 2 个**，就整体放弃拦截（宁可不磨砂，也不能拦错）。
           */
          const menuButtons = () => {
            const host = document.querySelector('[data-windows-menu]')
            if (host === null) return null
            const shadow = (host as { shadowRoot?: ShadowRoot | null }).shadowRoot
            const bar = shadow === undefined || shadow === null ? null : shadow.querySelector('[role="menubar"]')
            if (bar === null) return null
            const items = Array.prototype.slice.call(
              bar.querySelectorAll('[role="menuitem"][aria-haspopup="menu"]'),
            ) as Element[]
            // 数量不是 2 ⇒ 宿主结构变了，放弃拦截（安全侧：放行走原生菜单）。
            if (items.length !== 2) return null
            return { application: items[0], edit: items[1] }
          }

          const onDocumentClick = (event: Event) => {
            const buttons = menuButtons()
            if (buttons === null) return
            const path = typeof event.composedPath === 'function' ? event.composedPath() : []
            // 「应用」（children[0]）**不拦**：主人指令恢复原样，走宿主自己的 IPC → 系统菜单。
            if (path.indexOf(buttons.edit) === -1) return
            event.preventDefault()
            event.stopImmediatePropagation()
            if (panel !== null) { close(); return }   // 再点一次 = 收起
            open(buttons.edit, editEntries())
          }

          const onDocumentKey = (event: Event) => {
            if (panel === null) return
            const key = (event as KeyboardEvent).key
            // Esc：关面板并把焦点交还锚点 —— 焦点留在已卸载的容器上会掉 <body>。
            if (key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              const back = expandedButton
              close()
              if (back !== null && typeof back.focus === 'function') {
                try { back.focus({ preventScroll: true }) } catch (err) { /* 不支持就算了 */ }
              }
              return
            }
            onPanelKey(event as KeyboardEvent)
          }

          const onDocumentPointer = (event: Event) => {
            if (panel === null) return
            const path = typeof event.composedPath === 'function' ? event.composedPath() : []
            if (path.indexOf(panel) !== -1) return
            close()
          }

          document.addEventListener('click', onDocumentClick, true)
          document.addEventListener('keydown', onDocumentKey, true)
          document.addEventListener('pointerdown', onDocumentPointer, true)

          return () => {
            document.removeEventListener('click', onDocumentClick, true)
            document.removeEventListener('keydown', onDocumentKey, true)
            document.removeEventListener('pointerdown', onDocumentPointer, true)
            close()
            hideToast()
          }
        }
