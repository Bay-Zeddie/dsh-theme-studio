# dsh-theme-studio · 主题工坊

> 给 DeepSeek Harness 的 Web 界面换皮肤：背景图片 / 视频、逐令牌改配色、上传自己的字体、玻璃质感、圆角与动效、整窗全屏。
> **素材按原始字节存储与回吐，全程不转码、不缩放、不压缩。**

---

## 我能改什么

| 面板 | 能改的东西 |
|---|---|
| **预设** | 12 套手工校色的深浅双模式配色（深海 / 极光 / 炭火 / 苔原 / 夜樱 / 赛博 / 宣纸 / 石墨 / 兰夜 / 雨岩 / 陶土 / 官方原色）；明暗模式；对话字号 |
| **我的方案** | 把当前「配色 + 背景 + 玻璃 + 字体」整体存成命名快照；卡片列表带主色点与背景摘要；一键应用 / 覆盖 / 删除（破坏性动作走确认框）；多标签页即时同步 |
| **背景** | 图片 / 视频 / 内置渐变 / 无；铺法（铺满·完整显示·**原始像素平铺**）；焦点位置（在画面上直接拖）；放大倍率（图与视频同一语义：铺法给 `cover`/`contain` 关键字，放大走 `transform: scale`，遮罩开着也照常生效）；模糊 / 亮度 / 饱和 / 对比 / 去色 / 复古 / 色相；压暗遮罩（上轻下重）；Ken Burns 缓慢推拉；鼠标视差；输入时淡化；视频静音·循环·自动播放·倍速；玻璃质感（面板透明度·模糊·饱和） |
| **素材库** | 拖拽或点选上传（图片 / 视频 / 字体），进度条、缩略图、原始尺寸与体积、一键设为背景（自动连带开启玻璃透出——不透明面板会把壁纸整个盖住，"点了没反应"多半是这个）、引用保护删除（背景素材与**在用字体**都拦，删除字体时确认框明说回退后果） |
| **色彩** | 强调色（自动派生主色 / 链接 / 选中态 / 悬停反馈）；**从背景图取色**；7 组 48 个宿主真实令牌的深浅双值精修（含「按钮与反馈」族）；任意 `--dsw-*` 令牌自定义增删；正文对比度实时读数（WCAG） |
| **文字** | 界面字体栈、代码字体栈、字距；上传自己的字体（woff2/woff/ttf/otf）→ 自动 `@font-face` → 一键采用 |
| **形状与动效** | 圆角曲率（超级椭圆指数，宿主默认 1.5）；动效时长倍率（含一键关闭）；减少动态效果；滚动条（默认 / 胶囊 / 极细 / 隐藏） |
| **高级** | 追加自定义 CSS；主题 JSON 导入导出；素材占用统计（主题档管理已迁至「我的方案」页） |

**两个入口，同一棵组件树**（与姊妹插件 dsh-agent-instructions 一致的交互模型）：

1. **设置 → 主题工坊** —— 完整面板（设置导航里的独立一页）；
2. **右下角圆形浮动按钮** —— 打开模态，内嵌同一棵组件树，只靠 `data-variant` 分版面。
   浮动按钮平时都在，只有真被聊天输入区压住右下角时才自动淡出（判定见代码注释）。

破坏性动作（恢复默认、删除素材）一律先弹**确认框**：`Esc` 取消、`Enter` 确认，取消不发任何请求。

**快捷键**：`Alt+F` 整窗全屏 · 模态打开时 `Esc` 关闭并把焦点交还给打开它的按钮

---

## 安装

**桌面端（推荐）**：在应用的「插件」页以本地路径安装本目录；或在 profile 的
`package.json` 里加 `link:` 依赖 + bundles 条目后重启应用。

CLI 宿主（可选）：

```powershell
dsh plugin --profile <profile> add link:<本插件目录>
```

或一键脚本（含 pnpm 补齐与 profile 备份，`-Profile` 指定目标 profile）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile <profile>
```

> **改了 `src/client/*.ts` 才需要构建**：`npm run build:client`（需要 `tsdown`，见「DSH 兼容性」）。`client.js` 是随包发布的产物，直接安装即可用，无需构建工具。

**装完要重启宿主**（桌面端重启应用 / CLI 重启 `dsh web`）：Host 半（HTTP 路由 + 数据目录）只在启动时装载。重启后界面右下角应出现圆形浮动按钮，设置里应出现「主题工坊」独立一页。

卸载：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1            # 保留你的主题与素材
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -PurgeData # 连数据一起清
```

### 数据落在哪

```
$DSH_HOME/theme-studio/
├── state.json          主题文档 + 素材索引 + 修订号
└── media/<sha256前24位><ext>   原样落盘的素材字节
```

默认 `$DSH_HOME` 是 `~/.dsh`。可用环境变量覆盖：

| 变量 | 作用 | 默认 |
|---|---|---|
| `DSH_THEME_STUDIO_HOME` | 数据目录 | `<$DSH_HOME>/theme-studio` |
| `DSH_THEME_STUDIO_MAX_UPLOAD` | 单文件上限（字节） | `1073741824`（1 GiB） |
| `DSH_THEME_STUDIO_TRUST_HOSTS` | 额外放行的 Host 名（逗号分隔，主机名访问时用） | 空（只认 `127.0.0.1` / `localhost` / 连接本地地址） |

---

## 为什么"原画质"这件事是真的

这是本插件唯一不妥协的点，实现上刻意绕开了宿主的附件管线：

1. **不走 `ctx.attachments`。** 附件的语义是"发给模型看"，会归一化到长边 2048px / 编码 4MiB。主题背景要的是"给人看"，所以媒体走插件自己的路由，一个字节都不重编码。
2. **上传是流式落盘。** 浏览器 `fetch(File)` 直接当请求体发送，Host 边写盘边算 SHA-256，视频不整个进内存；扩展名与 MIME 由**文件头魔数**决定，不信浏览器声明也不信文件名。
3. **回吐带 HTTP Range。** `GET /dsh-theme-studio/media/<id>/<name>` 支持 `bytes=a-b` 与后缀区间、`206 Partial Content`、`416`、`ETag`/`304`、`HEAD` 无 body —— 这是 `<video>` 能任意拖动进度条而不必先下载整片的前提。
4. **内容寻址 → 永久强缓存。** 文件名就是内容哈希，所以 `Cache-Control: public, max-age=31536000, immutable` 是安全的；重复上传同一文件直接命中同一素材（去重）。
5. **滤镜不重编码。** 模糊/亮度/饱和/遮罩全部是 CSS `filter`/渐变叠加，跑在 GPU 合成阶段。原文件永远是你上传的那份，改参数不会掉画质。
6. **平铺模式**（`原始像素平铺`）连 `background-size` 都不设，4K 图按 1:1 像素铺开。

---

## 架构

```
浏览器 (client.js)                        Node 宿主 (index.js)
┌──────────────────────────┐   fetch    ┌────────────────────────────┐
│ 设置页 / FAB+模态          │ ─────────> │ /dsh-theme-studio/* 路由    │
│ 令牌补齐 probe（读样式表）  │ <───────── │ 状态 + 素材 + 投影(css/令牌) │
│ ctx.theme.overrideTokens  │  SSE/轮询  │ 流式上传 · Range 回吐       │
│ 背景层 DOM（图/视频/渐变）  │           │ $DSH_HOME/theme-studio     │
└──────────────────────────┘            └────────────┬───────────────┘
                                                     │
                                        lib/engine.js（唯一配色真源）
                                        buildTokenLayers() / buildCss()
                                        buildBootCss() → index-inject
```

四个关键设计决定：

- **配色逻辑只在宿主跑一份。** 浏览器半不复刻引擎，只接收 Host 算好的 `css` 与 `tokenLayers`。刷新时 `webserver/index-inject` 用同一个引擎生成首屏样式，所以"插件加载后"和"首屏"必然一致，不会闪。
- **改色一律走 `ctx.theme.overrideTokens()`。** `ui-layout` 的 `ThemePresenter` 把令牌写成 `body` 的 inline style，优先级高于任何选择器规则，必然生效；明暗模式与字号也走宿主 `setTheme()` / `setFontSize()`，跟原生"外观"设置同源。深浅成对的补齐分两段：**Host 看不见页面基准值，只补自己有把握的，单侧缺值留空**；浏览器半读 `body` / `body[data-ds-dark-theme]` 两套基准值收口 —— 于是"只改浅色"不会把深色一起改掉。
- **入口先自省再回退。** 注册 `settings.section` 后用官方 `slots.entries()` 核对条目真的进了 ledger；没进就回退注册「通用设置」一行。入口消失就是功能退化，所以两处注册都包 `try/catch`。
- **不提供落不了地的开关。** 例如正文宽度：宿主把 `--dsh-chat-user-width` 写在元素自己的 inline 上，`body` 层覆盖不赢，所以本插件**没有**这个旋钮。清单里每一项都对应一条真实生效的声明。

**多标签页同步**：Host 侧 SSE 广播修订号，各页面即时跟随；SSE 不可用时退回可见性轮询。落盘是「临时文件 + rename」原子替换，`revision` 单调递增；**调参编辑流自带乐观锁基准**（提交时携带编辑起点的 `expectRevision`），A-B 双标签页改同一主题时后写收到 `409` 被要求重读，而不是静默覆盖。

---

## 交叉核验记录

交互模型对齐姊妹插件 `dsh-agent-instructions`；下表每条都到 harness 源码就地核实，不采信任何注释或README 的转述：

| 核实的事实 | 出处 | 对本插件的处置 |
|---|---|---|
| `slots.register(options, component)` 只有两个参数；槽位未被父节点声明时直接 throw | `ui-slots/src/index.ts:1203-1207` | 所有注册包 `try/catch`，并备回退入口 |
| list 槽「同 id + 同 priority」重复注册会 throw | 同文件 `:1229-1234` | 换语言重新注册前先 dispose 旧注册 |
| `slots.entries(key)` 是官方 ledger 自省 API，`ui-settings-general` 投影导航就用它 | 同文件 `:1336` | 注册后核对条目真落地，未落地才回退 |
| 语言权威源是 `ctx.locale.getSnapshot().active`；`provide('locale')` 在 `:581` | `locale/src/client/index.ts:227/581` | `<html lang>` 只当兜底：服务端 HTML 写死 `lang="en"`，改写是插件激活后异步发生的 |
| `Switch` 的 `label` 只作 `aria-label`，不渲染可见文字；`onChange(next: boolean)` | `ui-primitives/src/Switch.tsx:18-41` | 可见标签由 `Row` 自己给 |
| `Tooltip` 的 children 必须能接 ref（`ReactElement<AnchorProps>`） | `ui-primitives/src/Tooltip.tsx:61` | 包官方控件时先套一层 `span` |
| `StateDot` 的 prop 是 `state`（`done/warning/error/idle/ongoing`） | `ui-primitives/src/StateDot.tsx:33` | 面板状态点用官方组件，缺失时退回自家 `.dts-dot` |
| `Button` 的 `variant` 只有 `primary/ghost/outline/toolbar`，原生属性透传 | `ui-primitives/src/Button.tsx:9-31` | `danger` 是契约外值 ⇒ 映射 `ghost` + 自家 `.dts-btn-danger` 上色 |
| `Input` 的 `className` 落外层 wrapper、其余属性透传内层 input | `ui-primitives/src/Input.tsx:13-23` | 布局 `style` 会掉进内层吃不到 flex ⇒ 外包 `.dts-input-flex` 承接 |
| `Pill` 有 `onClick` 渲染 button、无则渲染静态 span | `ui-primitives/src/Pill.tsx:16-36` | 传 `active` + `onClick`，契约吻合 |
| `Toast` 的 `tone` **只有 `'success'`**：省略 tone 即警示座；`onDone` 在 holdMs+1s 淡出后回调 | `ui-primitives/src/Toast.tsx:46-60` | 错误态**省略** `tone`（传 `'error'` 连图标座都空掉），`holdMs: 4200` 对齐自绘回退的 5.2s |
| `react-dom/client`、`@deepseek-ai/dsh-client-ui-primitives` 都在基座静态表里 | `client/web/src/platform.ts:8-14` | 可直接 `require`，无需在 package.json 声明 |
| 正文宽度由元素级 inline 控制 | `ui-conversation/.../ConversationWidthControls.tsx:142` | `body` 覆盖不赢 ⇒ 不做该旋钮 |
| `Theme.listTokens` 全部令牌 `requiresLightAndDark: true`；面板 48 个令牌逐一核真均有真实定义与消费方 | 运行时自省 `Theme.listTokens` + `ui-theme/src/styles/design-platform.css:173-362` | 深浅成对由 `fillTokenPairs` 收口；无死旋钮 |
| locale 词典面：`locale.register(ns, {zh,en})`；连续同步走 `locale/change` 事件或 getSnapshot/subscribe 对 | `locale/src/client/index.ts:502`、cordis-client-runner `api-catalog:121` | zh/en 词典注册进 locale 服务（与自研 `t()` 共用同一 MESSAGES，同源不漂移）；`locale/change` 订阅合法保留 |
| `dsh.client.immediately` 语义 = stage-one prefetch | `client/modules/src/client/manifest.ts:47`、`client/web/src/boot.ts:109` | 声明 `true`：背景层与令牌进第一阶段接管，不等懒加载 |
| `webserver/index-inject` 订阅可带 `{ prepend: true }`，ui-theme 的启动注入就这么注册 | `ui-theme/src/index.ts:41-43` | 同款：主题行先进表，背景层垫底、写口令先行 |

**有意保留的偏差**：CSS 类前缀继续用 `dts-`（`dts-layer` / `dts-video` / `#dts-backdrop` 是 Host 引擎、浏览器半、首屏注入三方共享的契约，改名要连带动四个文件与全部断言，收益不抵风险）。

---

## 安全边界

| 面 | 处理 |
|---|---|
| 谁能改主题 / 写文件 | 需要**写口令**。口令每次宿主启动随机生成，只随 `index.html` 首屏注入下发给同源页面；`GET /api/state` 仅对**已持口令**的调用方回显口令（自证刷新），被动探测拿不到。`ctx.connection` 在位时再叠一层 DSH 浏览器会话校验；写请求另校验 `Origin` 与 `Host` 一致（跨站直拒） |
| DNS rebinding | 每个请求校验 `Host` 白名单（`127.0.0.1` / `localhost` / 连接本地地址；主机名访问用 `DSH_THEME_STUDIO_TRUST_HOSTS` 显式声明）——rebinding 会把 `Host: attacker.com` 带进来，Host 校验是唯一天然拆穿它的点 |
| 素材读取 | 公开（与宿主的静态资源、`/plugins` bundle 同级）：`<img>` / `<video>` 的子资源请求不带自定义头，而素材 id 由内容哈希派生、不可枚举 |
| 只读接口 | `GET /api/state`（主题配置与投影，**写口令只对持口令方回显**）、`/api/export`、`/api/themes`、`/api/usage` 公开——只含主题配置与统计，不含服务器文件路径 |
| SVG | "能带脚本的图片"双重设防：入库走**全文**危险特征体检（脚本 / `on*` 事件 / 外链嵌入 / 伪协议，16 MiB 上限），回吐带 `Content-Security-Policy: sandbox` + `Content-Disposition: attachment`——`<img>`/背景引用照常显示，直接导航不在本源渲染 |
| 令牌名 | 只允许 `--dsw-` / `--ds-` / `--dsh-` 前缀，白名单正则 |
| 令牌值 | **先归一化反斜杠再校验**，拒绝 `<` `>`、`javascript:` / `vbscript:` / `expression()`；`url()` 只允许同源绝对路径（协议相对 `//host` 也拒）；字体栈只允许字母数字空格逗号引号连字符 |
| 高级 CSS | 只进浏览器半的 `style.textContent`（不参与 HTML 解析），不进 index；长度上限 200 KB |
| 文件类型 | 按文件头魔数判定，伪装成 `.png` 的可执行文件返回 `415`；上限默认 1 GiB |
| 删除 | 被当前主题引用的素材（背景素材与**在用字体**）默认拒绝（`409`），要 `force=1` 才放行，避免一键白屏 |
| 主题档覆盖 | `safeName` 消毒是多对一映射（「午夜?深蓝」与「午夜深蓝」同档）：目标已存在时服务端返回 `409`，UI 过确认框后带 `overwrite` 重试，不静默盖档 |

> **写口令的边界说清楚**：它挡的是**浏览器跨源**与**被动 API 探测**（跨源页读不到口令；curl 直接 GET 也拿不到）。但它挡不住**能打开你界面的客户端**——口令就下发在首屏 HTML 里。若把 DSH 绑到 `0.0.0.0` 暴露到局域网：同网段浏览器打开界面即可改主题、上传素材、删素材（等于共享一个可写的主题面板）；不打开界面的被动探测只能读主题配置与猜不到 id 的壁纸。要收回这个面就别把 web 绑出回环，或用 `DSH_THEME_STUDIO_TRUST_HOSTS` 收紧 Host 闸。

---

## 自测

不依赖 DSH 运行实例，也不需要浏览器：

```powershell
npm test         # 完整链：构建同步校验 → 120 行为锁 → 类型检查 → 装载契约冒烟 → 端到端集成
npm run build:client   # 改了 src/client/* 后重新构建 client.js
npm run typecheck      # 只跑类型网
```

**四层验证链**：① `build-client --check`（改源码忘构建 → 直接红）② 120 条行为锁 ③ `tsc` 类型网（0 错误基线）④ `verify-bundle` 装载契约 + `integration-check` 端到端装配（15 项）。

120 个用例，覆盖：

- **`theme-studio.test.mjs`** — 真起 `node:http`：上传→**逐字节回读比对**→Range 区间内容正确→416/304/HEAD→去重→鉴权缺失 401/403→修订冲突 409→类型伪装 415 且不残留半截文件→引用保护删除→导出/导入往返→重启后 state.json 读回；以及引擎侧：越界钳制、注入清洗、令牌成对补齐、`@font-face`、首屏 CSS、每套预设的 WCAG 对比度、面板暴露的令牌名全部合法
- **`host.test.mjs`** — 首屏注入行形状；**恶意 `mediaId` 逃不出引号与标签**；视频脚本逐条生成属性、不提前闭合 `</script>`；无 `webServer` 的 CLI/ACP 组合里安静跳过
- **`client.test.mjs`** — 用 `vm` 沙箱复刻浏览器装载路径：bundle 只 `require` 基座模块、导出契约正确、`apply()` 把**成对**令牌交给 `ctx.theme`、注入样式与背景层、浮动按钮就位；**交互层**另测：点浮动按钮开模态、`Esc` 关闭并归还焦点、模态自称 `role=dialog` 而页面变体不是、删除走确认框且取消不发请求、被输入区抢位才淡出且离开即恢复、官方 `ui-primitives` 在位时用官方组件而缺失时退回原生元素、页签记忆落到 localStorage。入口侧还验证 ledger 自省：`settings.section` 没真落地就回退注册「通用设置」一行。宿主 `theme` 服务缺件与接口不通时只报错不抛给宿主
- **`regression.test.mjs`** — 审计修复回归锁：原型链键打穿字典（曾致全接口持久化 500）、CSS 清洗顺序与协议相对 `url()`、铺法/放大倍率各归其位（含平铺跳过推拉）、字体引用删除保护与 families 清理、usage 不泄路径、SVG 全文体检 + 回吐沙箱头、伪造 Host（DNS rebinding 形态）421、跨站 Origin 403、存储未初始化 503
- **`audit-fixes.test.mjs`** — 第二轮全量审计修复锁：被动 GET 不下发写口令（M1）、safeName 碰撞不静默盖档（M2，store + http 双层）、SSE keepalive 不互相广播（L1）、损坏主题档报 4xx 不裸抛（L2）、store 未就绪也下发写口令行（L4）；客户端面另锁 media 原型键查表（L3）与 409 → 确认框 → overwrite 重试（M2）
- **`audit-bundle.test.mjs`** — bundle 静态审计（借鉴姊妹工程 dsh-agent-instructions）：`t()/tt()` 引用键必须在字典（拼错 = 界面静默空白）、死文案键清点、zh/en 键集一致且键名点分段、颜色公式单一真源哨兵（认前导零两写法，公式被折叠即报警）。产物引号风格无关：锁同时认单引号与双引号（不同打包器的打印器风格差异）
- 另有**合成成本红线**（client.test）：backdrop-filter 只许挂白名单大件/浮层类，密集复用类（token 行输入/下拉选项/按钮/色卡）禁挂——98 层 blur 闪屏的回归哨；以及 **`test/VISUAL-SMOKE.md`** 视觉冒烟清单（锁不住像素/合成器/渲染——视觉变更后 5 分钟人跑，含可粘贴量测 snippet）

---

## 已知限制

- **桌面端与 CLI 宿主通用。** 桌面端由 Electron 把 `dsh-app://app` 下的 API 与素材请求转发给已认证的 Web Host（`apps/desktop/src/web-document.ts` 的 `forwardWebRequest`，保留 Range 请求头，视频可任意拖动）；宿主的首屏注入（防壁纸闪烁的 boot CSS）经 `collectIndexInjections()` 随启动注入进入桌面首屏。仅当宿主未运行时会给出明确离线提示。
- **调参有约 220ms 防抖 + 一次本机回环往返。** 因为配色只在宿主算一份 —— 换取"首屏与运行时永不打架"。滑块本身跟手（本地草稿即时显示），落地的视觉效果略滞后。
- **玻璃质感依赖浏览器实测基准色**（`document.styleSheets` 扫描 + `getComputedStyle` 兜底）。宿主若把样式表搬进跨源链接表，退化为"只保证当前模式准确"。
- **不覆盖组件自己 inline 声明的变量**（正文宽度即属此类），所以没做对应旋钮。
- **设置导航项的图标无法自定义。** 官方 `ui-settings-general` 的 `navIcon(id)` 是硬编码表，`settings.section` 的注册选项里也没有 `icon` 字段 —— 所以主题工坊的图形只出现在**浮动按钮**与**面板标题**这两个自己可控的表面上。
- **SVG 壁纸有 16 MiB 全文体检上限**（安全取舍：垫长绕过头部嗅探是实证过的攻击面），其余类型上限仍是 1 GiB。
- **平铺模式不跑 Ken Burns 推拉**：原始像素语义就是不缩放，推拉与它矛盾，直接跳过。
- **主机名访问要声明**：`Host` 白名单默认只认本机名与连接本地地址，用 `http://机器名:端口` 访问时设 `DSH_THEME_STUDIO_TRUST_HOSTS=机器名`。
- **构建需要 `tsdown`**（开发态）：浏览器半源码是 TS（`src/client/*.ts`），改动后必须 `npm run build:client` 重新生成 `client.js`；`npm test` 首步会校验两者同步（未构建直接报错）。运行时不依赖任何构建工具。
- **玻璃质感对宿主类名有少量适配**：部分表面（产出卡/文件行/构建徽章等）靠属性选择器匹配宿主 CSS Modules 类名兜底——宿主若更换类名生成规则，这些补丁会**静默失效**（不报错，只是退回不透明白底）。详见下方「交叉核验记录」。

---

## DSH 兼容性

| 项 | 值 |
|---|---|
| `dsh.compatibility.dsh` | `>=0.1.5` |
| Node.js（运行时） | `>=20`（`engines`；插件运行本身无更高要求） |
| Node.js（开发/构建） | `^22.18 \|\| >=24`（`tsdown 0.22` 的要求，仅 `build:client` 需要） |
| 平台 | darwin / linux / win32 |
| Client 组合 | `platform: web`，`immediately: true`（stage-one prefetch）；注入 `@deepseek-ai/dsh-client-ui-theme` + `@deepseek-ai/dsh-client-ui-slots` |
| 构建期依赖 | `tsdown`（+ 其自带 rolldown/lightningcss）。**仅开发态**：发布包里的 `client.js` 已构建好，安装者无需构建工具 |
| Model Experience | 无 —— 不注册模型工具、不写入提示词 |
| KV Cache effect | 无 —— 不增删模型请求 token |

---

## 目录

```
dsh-theme-studio/
├── index.js                     Host 半：路由装载 + 首屏注入
├── client.js                    ⚠️ 生成物（TS 产线产物；改 src/client/* 后跑 npm run build:client）
├── src/client/*.ts              浏览器半源码（13 个 TS 模块：identity/deps/i18n/utils/primitives/store/
│                                probe-glass/api/layer/chrome/tabs/app + index 装配入口）
├── lib-build/client.js          tsdown 中间产物（构建落地点；client.js 由它复制而来）
├── lib/color-core.js            颜色单一真源（engine 与浏览器半共享，D3 根治）
├── lib/engine.js                配色与 CSS 引擎（纯函数，唯一配色真源）
├── lib/store.js                 状态与素材存储（原子写、内容寻址、乐观锁）
├── lib/sniff.js                 媒体魔数判定 + SVG 全文体检（自 store 拆出）
├── lib/image-size.js            图片头部尺寸解析（png/gif/bmp/jpeg/webp）
├── lib/http.js                  纯 node:http 处理器（Range、写口令、SSE），可脱离 Cordis 自测
├── tsdown.theme-studio.config.ts 客户端构建配置（banner/intro/footer 三件套对齐官方契约）
├── tsconfig.client.json         TS 类型检查配置（npm run typecheck）
├── tools/build-client.mjs       构建入口（tsdown → 契约自检 → 落地 client.js）
├── tools/typecheck.mjs          类型网（checkJs/tsc）
├── tools/verify-bundle.mjs      产物装载契约冒烟（LOADER-SMOKE）
├── tools/integration-check.mjs  端到端集成验证（模拟 loader 全装配路径 15 项）
├── test/                        自测（引擎+HTTP 契约 / Host 装配 / 浏览器交互 / 两轮审计修复锁 / bundle 静态审计 / css-probe / VISUAL-SMOKE 冒烟清单）
├── cordis.patch.yml             profile 层插入行
├── icon.svg + locale/           Plugin Manager 卡片元数据（官方 display metadata 契约）
├── install.ps1 / uninstall.ps1
└── package.json                 dsh.client 声明（platform: web, immediately: true）
```

零运行时依赖 —— `dependencies` 是空的，浏览器半的 `react`/`react-dom`/`ui-primitives` 由宿主基座注入（bare require）；构建期依赖 `tsdown` 仅在开发态使用。

## 许可

MIT
