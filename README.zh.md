---
description: "DeepSeek Harness 主题工坊：给 Web 界面换背景图片与视频（原画质、带 HTTP Range）、逐令牌改配色、上传自己的字体、玻璃质感与圆角动效调节，12 套双模式预设 + 取色器 + 命名方案一键互切。"
kind: "package-reference"
---

# dsh-theme-studio

[English](README.md) | 中文

## 概述

`dsh-theme-studio`（主题工坊）给 DeepSeek Harness 的界面换背景：图片、视频、内置渐变，或者什么都不放。素材**按原始字节存储与回吐** —— 全程不转码、不缩放、不压缩，视频靠 HTTP Range 任意拖动进度条。配色以**逐令牌**的方式改：**7 组 49 个**宿主真实令牌的深浅双值，加上强调色自动派生、从背景图取色、任意 `--dsw-*` 令牌自定义增删。此外还有 12 套手工校色的深浅双模式预设、命名方案快照、上传自己的字体、玻璃质感、圆角曲率与动效时长调节、整窗全屏。

功能**不改动宿主的任何代码**：配色由 `ctx.theme.overrideTokens()` 重铸宿主令牌，字号与明暗走宿主 `setTheme()` / `setFontSize()`，界面文案注册进宿主 locale 服务，面板是宿主设置页里的一个 `settings.section`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

**桌面端（唯一目标部署）**：在应用的「插件」页以本地路径安装本目录；或在桌面 profile（`~/.dsh/profiles/desktop/package.json`）的 `dependencies` 里加 `link:` 依赖 + bundles 条目后重启应用。也可以走一键脚本（`-Profile` 指定目标 profile，如 `desktop`）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile desktop
```

> **只有改了 `src/client/*.ts` 才需要构建**：`npm run build:client`（需要 `tsdown`，见「DSH 兼容性」）。`client.js` 是随包发布的产物，直接安装即可用，不需要构建工具。

**装完要重启应用**：Host 半（HTTP 路由 + 数据目录）只在启动时装载。桌面端由 Electron 把 `dsh-app://app` 下的请求转发给内嵌 Web Host，重启后设置里应出现「主题工坊」独立一页。

卸载：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -Profile desktop            # 保留你的主题与素材
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -Profile desktop -PurgeData # 连数据一起清
```

### 一个入口

1. **设置 → 主题工坊** —— 完整面板（设置导航里的独立一页，走官方 `settings.section` 槽）；
2. **「通用设置」兜底行** —— 仅当 `settings.section` 没进官方 ledger 时注册的一行按钮，点开的是内嵌同一棵组件树的模态，只靠 `data-variant` 分版面。

> 右下角的圆形浮动按钮已移除：它与聊天输入区抢右下角、又与设置页入口重复。移除后不再有碰撞淡出逻辑与图标对比自愈（`.dts-fab` 样式、`mountFab` 一族同步删净）。

破坏性动作（恢复默认、删除素材、覆盖同名方案）一律先弹**确认框**：`Esc` 取消、`Enter` 确认，取消不发任何请求。

**快捷键**：`Alt+F` 整窗全屏 · 模态打开时 `Esc` 关闭并把焦点交还给打开它的按钮。

### 面板能力

| 面板 | 能改的东西 |
|---|---|
| **预设** | 12 套手工校色的深浅双模式配色（深海 / 极光 / 炭火 / 苔原 / 夜樱 / 赛博 / 宣纸 / 石墨 / 兰夜 / 雨岩 / 陶土 / 官方原色）；明暗模式；对话字号 |
| **我的方案** | 把当前「配色 + 背景 + 玻璃 + 字体」整体存成命名快照；卡片列表带主色点与背景摘要；一键应用 / 覆盖 / 删除（破坏性动作走确认框）；多窗口即时同步 |
| **背景** | 图片 / 视频 / 内置渐变 / 无；铺法（铺满·完整显示·**原始像素平铺**）；焦点位置（在画面上直接拖）；放大倍率（图与视频同一语义：铺法给 `cover`/`contain` 关键字，放大走 `transform: scale`，遮罩开着也照常生效）；模糊 / 亮度 / 饱和 / 对比 / 去色 / 复古 / 色相；压暗遮罩（上轻下重）；Ken Burns 缓慢推拉；鼠标视差；输入时淡化；视频静音·循环·自动播放·倍速；玻璃质感（面板透明度·模糊·饱和） |
| **素材库** | 拖拽或点选上传（图片 / 视频 / 字体），进度条、缩略图、原始尺寸与体积、一键设为背景（自动连带开启玻璃透出 —— 不透明面板会把壁纸整个盖住，「点了没反应」多半是这个）、引用保护删除（背景素材与**在用字体**都拦，删除字体时确认框明说回退后果） |
| **色彩** | 强调色（自动派生主色 / 链接 / 选中态 / 悬停反馈）；**从背景图取色**；7 组 49 个宿主真实令牌的深浅双值精修（含「按钮与反馈」族）；任意 `--dsw-*` 令牌自定义增删；正文对比度实时读数（WCAG） |
| **文字** | 界面字体栈、代码字体栈、字距；上传自己的字体（woff2/woff/ttf/otf）→ 自动 `@font-face` → 一键采用 |
| **形状与动效** | 圆角曲率（超级椭圆指数，宿主默认 1.5）；动效时长倍率（含一键关闭）；减少动态效果；滚动条（默认 / 胶囊 / 极细 / 隐藏） |
| **高级** | 追加自定义 CSS；主题 JSON 导入导出；素材占用统计（主题档管理在「我的方案」页） |

> 上表「色彩」一行的 **49 个令牌**与《引擎》一节的 `TOKEN_GROUPS` 是同一份数据：7 个分组、49 个互不重复的令牌名，由一条用例对账。

### 数据位置

```
$DSH_HOME/theme-studio/
├── state.json                    主题文档 + 素材索引 + 修订号
├── media/<sha256前24位><ext>     原样落盘的素材字节
└── themes/<safeName>.json        命名方案（「我的方案」页的每张卡一个文件）
```

默认 `$DSH_HOME` 是 `~/.dsh`。可用环境变量覆盖：

| 变量 | 作用 | 默认 |
|---|---|---|
| `DSH_THEME_STUDIO_HOME` | 数据目录 | `<$DSH_HOME>/theme-studio` |
| `DSH_THEME_STUDIO_MAX_UPLOAD` | 单文件上限（字节） | `1073741824`（1 GiB） |

### 整窗全屏

原生 `— □ ×` 左侧，不再占面板头一行：右偏移由 `navigator.windowControlsOverlay.getTitlebarAreaRect()` 实测 —— Win11 三键兜底 138px、macOS 红绿灯在左兜底 12px；高度取宿主发布的 `--dsh-windows-titlebar-height`，并带 `-webkit-app-region:no-drag`（顶条整条是拖拽区，不标就点不动）。

### 原画质

这是本插件唯一不妥协的点，实现上刻意绕开了宿主的附件管线：

1. **不走 `ctx.attachments`。** 附件的语义是"发给模型看"，会归一化到长边 2048px / 编码 4MiB。主题背景要的是"给人看"，所以媒体走插件自己的路由，一个字节都不重编码。
2. **上传是流式落盘。** 浏览器 `fetch(File)` 直接当请求体发送，Host 边写盘边算 SHA-256，视频不整个进内存；扩展名与 MIME 由**文件头魔数**决定，不信浏览器声明也不信文件名。
3. **回吐带 HTTP Range。** `GET /dsh-theme-studio/media/<id>/<name>` 支持 `bytes=a-b` 与后缀区间、`206 Partial Content`、`416`、`ETag`/`304`、`HEAD` 无 body —— 这是 `<video>` 能任意拖动进度条而不必先下载整片的前提。
4. **内容寻址 → 永久强缓存。** 文件名就是内容哈希，所以 `Cache-Control: public, max-age=31536000, immutable` 是安全的；重复上传同一文件直接命中同一素材（去重）。
5. **滤镜不重编码。** 模糊/亮度/饱和/遮罩全部是 CSS `filter`/渐变叠加，跑在 GPU 合成阶段。原文件永远是你上传的那份，改参数不会掉画质。
6. **平铺模式**（`原始像素平铺`）连 `background-size` 都不设，4K 图按 1:1 像素铺开。

-----

<a id="understand-the-implementation"></a>
## 理解实现

配色逻辑**只在宿主跑一份**：浏览器半不复刻引擎，只接收 Host 算好的 `css` 与 `tokenLayers`。刷新时 `webserver/index-inject` 用同一个引擎生成首屏样式，所以"插件加载后"和"首屏"必然一致，不会闪。改色一律走 `ctx.theme.overrideTokens()` —— `ui-layout` 的 `ThemePresenter` 把令牌写成 `body` 的 inline style，优先级高于任何选择器规则。

界面文案注册进官方 `ctx.locale` 服务（`ctx.effect(() => locale.register(NS, {zh,en}), '<reason>')`），与自研 `t()` 共用同一个 `MESSAGES` 对象，同源不漂移；官方 locale 服务缺席时安静跳过，界面走本地词典降级链。设置页条目的 `label` 是 thunk 并声明了 `locale`，换语言由官方外壳自己重解析，不需要重新注册。

<details>
<summary>实现细节——点击展开</summary>

### 架构

```
桌面端界面 (Electron)                     Node 宿主 (index.js)
┌──────────────────────────┐ dsh-app://  ┌────────────────────────────┐
│ 设置页 / 兜底行模态        │ ──────────> │ /dsh-theme-studio/* 路由    │
│ 令牌补齐 probe（读样式表）  │ <─────────  │ 状态 + 素材 + 投影(css/令牌) │
│ ctx.theme.overrideTokens  │  SSE        │ 流式上传 · Range 回吐       │
│ 背景层 DOM（图/视频/渐变）  │           │ $DSH_HOME/theme-studio     │
└──────────────────────────┘            └────────────┬───────────────┘
                                                     │
                                        lib/engine.js（唯一配色真源）
                                        buildTokenLayers() / buildCss()
                                        buildBootCss() → index-inject
```

四个关键设计决定：

- **配色逻辑只在宿主跑一份。** 浏览器半不复刻引擎，只接收 Host 算好的 `css` 与 `tokenLayers`。
- **改色一律走 `ctx.theme.overrideTokens()`。** 明暗模式与字号也走宿主 `setTheme()` / `setFontSize()`，跟原生「外观」设置同源。深浅成对的补齐分两段：**Host 看不见页面基准值，只补自己有把握的，单侧缺值留空**；浏览器半读 `body` / `body[data-ds-dark-theme]` 两套基准值收口 —— 于是"只改浅色"不会把深色一起改掉。
- **入口先自省再回退。** 注册 `settings.section` 后用官方 `slots.entries()` 核对条目真的进了 ledger；没进就回退注册「通用设置」一行。入口消失就是功能退化，所以两处注册都包 `try/catch`。
- **不提供落不了地的开关。** 例如正文宽度：宿主把 `--dsh-chat-user-width` 写在元素自己的 inline 上，`body` 层覆盖不赢，所以本插件**没有**这个旋钮。清单里每一项都对应一条真实生效的声明。

### 令牌层与玻璃

**契约**：玻璃上不带任何自选色、不做任何压暗 —— **颜色 100% 来自壁纸，只加磨砂**。即 `background: transparent` + `backdrop-filter: blur()`。

```css
:root{
  --dts-glass-fill: transparent;                                               /* 零自选色 */
  --dts-glass-blur: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%)); /* 直接转发宿主的糊 */
}
```

宿主菜单表面的填充同样**无条件清零**：令牌层写入 `--dsw-menu-surface-fill: transparent`，与 `--dts-glass-fill` 同档 —— 全插件"只有一个玻璃真源"这个承诺才立得住，这里多一个数字就是又分叉。于是分工是一句话：**糊管看不清字，填充已经归零（颜色全交给壁纸）**。

**为什么是零色**：早先用固定实色（`rgba(16,20,24,.8)` 近黑 → `rgba(48,64,88,.72)` 深蓝灰）时，实度 `.72` 意味着 **72% 是我们选的颜色、壁纸只剩 28%** —— 玻璃的颜色必然与壁纸脱节，主人实测原话：「感觉不是和壁纸同一个色源」。而**堵住底字靠的是不透明度而非黑度**，两者可解耦：「只做模糊」把可读性交给 `blur()`、把颜色完全交还给壁纸。

> **修订记录（旧文失实项）**：本 README 早期版本在「玻璃实度」一节写"实度维持 `.8` 不动"、"全表实度只剩 `.8` 与 `.15`"。那是第五轮改成 `transparent` **之前**的历史叙述，未标注为历史，读者会当成当前契约 —— 已作废。当前真源是 `--dts-glass-fill: transparent`；`CHROME_CSS` 里残留的 `rgba(16,20,24,·)` 只有 **`.15` / `.28` / `.92`** 三档（含义见下表例外），由一条用例逐值断言。

⚠️ **代价（主人知情并选择）**：去掉实色与压暗后，`blur()` 是**唯一**承担"看不清底字"的机制。一旦某处 `backdrop-filter` 被祖链圈死而失效，背后正文会直接透上来，没有兜底。所以「糊必须活着」是硬前提，三处保障：遮罩层不许带 `backdrop-filter`、输入卡的磨砂搬进 `::before`、`[role=dialog]` 显式带糊。

**三处例外**（都有硬理由，不是漏改）：

| 例外 | 值 | 为什么必须 |
|---|---|---|
| `--dts-glass-fill-thin` | `rgba(16,20,24,.28)` | 密集小输入**没有** backdrop-filter（98 个挂 blur 会合成层爆炸），透明 + 无糊 = 控件消失 |
| `.dsh-agent-dialog` | `rgba(16,20,24,.92)` | 嵌套确认框渲染在设置模态卡**内部**，卡片的 blur 把它变成 backdrop root、糊被圈死，只能靠接近不透的实底压住背后文字 |
| `_tag_[data-tone=solid]` 与 `buildVersion` 徽章 | 宿主按钮令牌 / `.15` 兜底 | 反相 chip 是**白字压底**的小件，纯透明会变成"白字浮在透明底上"；徽章那条是宿主自己的 `button-elevated-fill` token，不是玻璃面 |

⚠️ `.92` 那条**曾被一次"合并重合规则"的代码整理误删**（它看起来像 `[role=dialog]` 的重复，实为独立功能规则），靠 git `128f530` 才追回，现已加回归锁。**整理代码时不要把它当重复删掉。**

### 多窗口同步

Host 侧 SSE 广播修订号，打开的各界面窗口即时跟随；SSE 不可用时退回可见性轮询。落盘是「临时文件 + rename」原子替换，`revision` 单调递增；**调参编辑流自带乐观锁基准**（提交时携带编辑起点的 `expectRevision`），A-B 两个窗口改同一主题时后写收到 `409` 被要求重读，而不是静默覆盖。

### 客户端自检

客户端每次 `GET /api/state` 附带 `x-dts-diag`（URL 编码的紧凑快照：`body` 类名、`dts-chrome-style` 是否注进去、`#dts-backdrop` 在不在、设置页入口有没有落地、宿主 `*card*` 元素的真实类名、两个目标选择器各命中几个），Host 逐字段白名单收敛后放进 `/api/state` 的 `client` 字段（`client === null` = 客户端半从未回传 = 客户端没跑，本身就是结论）。皮肤类问题的第一现场永远在 DOM 里，而外部读不到它 —— 没有这条通道就只能靠截图猜选择器、猜错再重启。

⚠️ **这条通道目前无鉴权**：任何能发起请求的本机进程或页面都能带 `x-dts-diag` 写入这个全局单变量，并随任意 `GET /api/state` 被读走。见「已知限制」。

### 自测

```powershell
npm test               # 完整链：构建同步校验 → 184 条行为锁 → 类型检查（宿主 JS + TS 源双网） → 装载契约冒烟 → 端到端集成
npm run build:client   # 改了 src/client/* 后重新构建 client.js
npm run typecheck      # 只跑类型网
```

① `build-client --check`（改源码忘构建 → 直接红）② 184 条行为锁（测试清单由 `tools/run-tests.mjs` **自动发现** `test/*.test.mjs`，扫不到文件同样报红）③ `tsc` 类型网双配置（`jsconfig.json` 宿主 JS + `tsconfig.client.json` 浏览器半 TS 源码）④ `verify-bundle` 装载契约 + `integration-check` 端到端装配（20 项）。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

### 交叉核验记录

交互模型对齐姊妹插件 `dsh-agent-instructions`；下表每条都到 harness 产物就地核实，不采信任何注释或 README 的转述：

| 核实的事实 | 出处 | 对本插件的处置 |
|---|---|---|
| `slots.register(options, component)` 只有两个参数；槽位未被父节点声明时直接 throw | `ui-slots` 产物 | 所有注册包 `try/catch`，并备回退入口 |
| list 槽「同 id + 同 priority」重复注册会 throw | 同上 | 换语言重新注册前先 dispose 旧注册 |
| `slots.entries(key)` 是官方 ledger 自省 API，`ui-settings-general` 投影导航就用它 | 同上 | 注册后核对条目真落地，未落地才回退 |
| 语言权威源是 `ctx.locale.getSnapshot().active` | `locale` 产物 | `<html lang>` 只当兜底：服务端 HTML 写死 `lang="en"`，改写是插件激活后异步发生的 |
| `Switch` 的 `label` 只作 `aria-label`，不渲染可见文字；`onChange(next: boolean)` | `ui-primitives` 产物 | 可见标签由 `Row` 自己给 |
| `Tooltip` 的 children 必须能接 ref | 同上 | 包控件时先套一层 `span` |
| `StateDot` 的 prop 是 `state`（`done/warning/error/idle/ongoing`） | 同上 | 面板状态点优先用自写控件，缺失时退回 `.dts-dot` |
| `Button` 的 `variant` 只有 `primary/ghost/outline/toolbar`，原生属性透传 | 同上 | `danger` 是契约外值 ⇒ 映射 `ghost` + 自家 `.dts-btn-danger` 上色 |
| `Input` 的 `className` 落外层 wrapper、其余属性透传内层 input | 同上 | 布局 `style` 会掉进内层吃不到 flex ⇒ 外包 `.dts-input-flex` 承接 |
| `Pill` 有 `onClick` 渲染 button、无则渲染静态 span | 同上 | 传 `active` + `onClick`，契约吻合 |
| `Toast` 的 `tone` **只有 `'success'`**：省略 tone 即警示座 | 同上 | 错误态**省略** `tone`（传 `'error'` 连图标座都空掉） |
| `react-dom/client` 在基座静态表里 | `client-modules` 产物 | 可直接 `require`，无需在 package.json 声明 |
| 正文宽度由元素级 inline 控制 | `ui-conversation` 产物 | `body` 覆盖不赢 ⇒ 不做该旋钮 |
| `Theme.listTokens` 全部令牌 `requiresLightAndDark: true`；面板 49 个令牌逐一核真均有真实定义与消费方 | 运行时自省 + `ui-theme` 样式表 | 深浅成对由 `fillTokenPairs` 收口；无死旋钮 |
| locale 词典面：`locale.register(ns, {zh,en})`；连续同步走 `locale/change` 事件或 getSnapshot/subscribe 对 | `locale` 产物、`cordis-client-runner` api-catalog | zh/en 词典注册进 locale 服务（与自研 `t()` 共用同一 `MESSAGES`，同源不漂移） |
| `dsh.client.immediately` 语义 = stage-one prefetch | `client-modules` / `client-web` 产物 | 声明 `true`：背景层与令牌进第一阶段接管，不等懒加载 |
| `webserver/index-inject` 订阅可带 `{ prepend: true }`，ui-theme 的启动注入就这么注册 | `ui-theme` 产物 | 同款：主题行先进表，背景层垫底、写口令先行 |

> **引用口径说明**：上表的出处一律是**宿主产物**（`lib/*.js`），不再引用 `src/*.ts` 行号 —— 本机只有 asar 产物，没有 TS 源码树，TS 行号无法就地核实。

### 审计结论

两位独立审计员背对背跑过一轮客户端 UI 核验（68 控件 + 73 交互检查点），我逐条复验 —— **其中 4 条被推翻**（撤回不留记录亦不留代码），**9 条坐实并已修**。

**被推翻的假发现**：`Slider` 缺 `aria-label`（恒传 `props.label`）· `uiSwitch` 丢可见标签（由外层 `Row` 的 `<label>` 提供）· 切非图片模式清 `mediaId` 无对称控件（本就是防悬挂引用）· 模态缺焦点陷阱（`app.ts` 完整实现）—— **先复验再采信，是这批审计里最有价值的一步**，否则会白改四处正确的代码。

**坐实并修复的 9 条**（每条都有回归锁，且锁全部验证过会咬人）：

| # | 缺陷 | 根因 | 修法 |
|---|---|---|---|
| P1 | `Choice` Tab/Enter/鼠标收起点后焦点掉 `<body>` | 被激活的 option 随弹层卸载，焦点无归处 | `commitAt(index, back)` 三处调用全传 `true`，回焦触发器 |
| P2 | `Choice` Tab 分支缺 `preventDefault`/`stopPropagation` | 取了焦点所有权却留着浏览器默认移动 | 两条路径都补 |
| P3 | 编辑菜单无键盘导航、焦点停在 `tabIndex=-1` 容器 | `role="menu"` 声明了却没实现项间移动 | ↑↓/Home/End/Enter/Tab 全套 + 焦点落**第一项** |
| P4 | `execCommand` 失败静默无反馈 | 除 paste 外一律 `return` | 返回成败 → `role=status` + `aria-live` 提示条 |
| P5 | `paste` 回退目标可能是 `<body>`、且无条件宣称成功 | 没校验焦点可编辑、丢弃 `dispatchEvent` 返回值 | 两道自检，不成立即判失败 |
| P7 | 自绘下拉无高度上限、无向上翻转 | 选项一多就撑出视口，被裁的项**滚不到** | `max-height:min(52vh,420px)` + `data-flip="up"` |
| P8 | 顶条菜单用 `bar.children[0]/[1]` 硬编码定位 | 宿主插一个元素就整体错位 → **误拦「应用」**，关于/退出点不开 | 改 `role="menuitem"][aria-haspopup="menu"]` 取全集；**数量≠2 就整体放弃拦截** |
| P10 | 取色 `Image` 的 `load`/`error` 监听从不摘除 | 两条只触发一条，另一条永久残留 | 收口到 `settle()` 统一摘 |
| 新 | `importDoc(doc, mode)` 的 `merge` 分支**无 UI 入口** | 宿主与 api 两半都实现好了，只差一个按钮 | 「合并导入」勾选框 |

**外加一条实现与注释不符**：`t()` 的文档写"带 `{n}` 占位的文案按顺序多传参数"，实现却只处理"值是函数"分支 —— 而文案表**全是字符串**，参数被静默丢弃。现已两条分支都覆盖，并把签名改成 `t(key, ...args)`（类型网当场逮住了 arity 不符）。

**验证方式**：9 条锁逐条注射缺陷 → 全部变红 → 还原全绿（`verify_locks.mjs`）；17 处修复逐条确认进了最终产物 `client.js`（`verify_bundle_fixes.mjs`）—— **不靠读源码下结论**。

### 玻璃排查记

*第一轮（错）*：主人反馈统一后仍看得见底下的字。建复现页量到「嵌套弹层两层 `.8` 相乘 `=1-(1-.8)²=.96` 近乎全黑、backdrop root 被父级卡圈住」，据此加了一档 `--dts-glass-fill-nested:.35`。**诊断是错的** —— 错在**复现页几何建错了**：我把确认框放进了模态卡的内容流；真实层级是它渲染在 `.dts-scrim` 里、**浮在整页之上**。忠实复刻后 backdrop root 链只有它自己，`.8 + blur` 完全够用。那条 `.35` 规则与变量已整个删掉（不留"修错方向还留着"的死配置）。

*第二轮（错，差点改错方向）*：主人追加「加上磨砂质感，看不清底下的字就可以，很多都把底厚实了，观感不好失去了那种透亮感」。我扫五档 fill 想降实度，**把五档排在同一行**比，视觉上被上排的模糊掩盖，得出「`.8` 是六倍于必要、`.45` 才是那条线」。把「糊活着 / 糊失效」**两态并排**再量才看清：

| fill | 糊活着 | 糊失效 |
|---|---|---|
| `.45` | 读不出 | **背后正文逐字清晰可读** ✗ |
| `.80` | 读不出 | 只剩色斑 ✓ |

结论反了：**`.8` 不是过厚，它是唯一能在糊失效时兜住「看不清底面的字」的值**。主人嫌「厚实/不透亮」不是要降 fill —— 是要**把糊救活**。

*第三轮（打中）*：真正的根因是**遮罩层自己成了 `backdrop root`，把子级玻璃面的磨砂整体废掉**。条纹壁纸 + 遮罩 + 玻璃卡三格横排：

| 遮罩状态 | 卡片内条纹 | 判定 |
|---|---|---|
| **无** `backdrop-filter` | 被卡片自己的 `blur(40px)` 抹净 | ✓ **真磨砂** |
| 带 `blur(2px)` | **条纹清晰可见** | ✗ 卡片 40px 被圈死，只采到遮罩那层 2px |
| 压黑 `.24` + 带模糊 | 条纹清晰 + 发暗 | ✗ 双重受害 |

机制：**带 `backdrop-filter` 的元素会成为其子树的 backdrop root**，子树里再开 blur 只采到这一层。所以遮罩一开模糊，反而废掉弹层的磨砂 —— 观感就是「加了磨砂还是透」。两处遮罩都中招（`.dts-scrim` 与 `.dts-modal-mask`，后者是设置弹窗卡的直接父级），且我一度还给它们配了底色，那层黑会把背后对比度先砍掉一截，blur 采到「被压暗过的底」，糊出来只剩灰雾。现已双双改为 **`background:transparent` + `backdrop-filter:none`**，语义（聚焦 + 挡点击）由 z-index 表达。

**回归锁** `遮罩层绝不许成为 backdrop root`：断言 `.dts-scrim`/`.dts-modal-mask`/宿主四个遮罩族的 `backdrop-filter` 必须是 `none`、底色必须是 `transparent`；**反向断言** `.dts-dialog`/`.dts-modal-card`/`.dts-cmenu`/`.dts-select-menu` 的 blur 必须还在（防一刀切把真玻璃面也摘了）。注入 `backdrop-filter:blur(2px)` 实测：**套件立刻红这一条**。

> **第三步之后填色归零**：糊救活之后，填充就能换挡 —— `--dsw-menu-surface-fill` 与 `--dts-glass-fill` **同档**（都是 `transparent`）。全插件"只有一个玻璃真源"这个承诺才立得住。早先它单独走过 `0.6 → 0.4 → .72` 几档，那都是"我们自己选的实色"时代的产物。

**顺手修掉一个多余数字**：宿主自己给了 `--dsw-menu-backdrop-filter: blur(40px) saturate(150%)`（在 `ui-theme` 产物里，恒存在、与主题设置无关），另一个方向是 `--dsw-specific-menu` 走 `MenuSurface`。我们原先硬编兜底 `blur(50px)` 是第二个来源，改为转发 `blur(40px)`。

### 漏网面普查

不靠猜 —— 把宿主**带背景的类族**全量枚举，逐个判「我们的后缀选择器吃不吃得到」。「开始」面板四张引导卡（`.lnbXlW_entry`）、终端引导卡（`.Txfvra_entry`）、引导面板容器（`.lnbXlW_guide`）、加载浮标（`.nIBokW_loadingFloat`）都曾漏网。它们的宿主底色是 `--dsw-alias-bg-layer-1/2`（**不透明层令牌**），所以整块死灰、壁纸被彻底挡死。补规则后实测 `.lnbXlW_entry` → `transparent | blur(40px) saturate(1.5)` ✓、`.lnbXlW_guide` → `transparent` ✓（壁纸透出来）。

**边界纪律（不铺满全屏）**：5 条内容区卡片**故意不磨** —— `balanceCard`(`settings-card-fill`) · `rowCard`/`setupCard`（设置页内部模块）· `ioCard`×2（`markdown-code-block`）。它们嵌在正文流里，磨砂会毁掉卡内文字的可读性。锁里有哨兵断言：这些类一旦出现在玻璃名单就报警。

### 面板超界

根因是 **`.dts-input` 不在 `box-sizing:border-box` 名单里** —— 它有 `width:100%` + `padding:5px 8px`，content-box 下 padding 会**加在 100% 之外**，文本域比容器宽 16px，把 `.dts-body`/`.dts-group` 顶出横向滚动、右边贴死卡片边。不是猜的：把构建产物里的 `CHROME_CSS` 抽出来灌进复现页、用 Playwright 量整条链 —— 修前 `.dts-panel/.dts-body/.dts-group` 全是 `scrollWidth 944 > clientWidth 940`、textarea 右边越出 group 内容盒 16px；修后**三个视口下逐层 `scrollWidth === clientWidth`、textarea 正好 916 = 容器内容宽**。名单补 `.dts-input,.dts-textarea` 两个成员，并加了一条锁把这族（宽 100% + 自带 padding）全部钉在 border-box 上。

-----

<a id="model-experience"></a>
## 模型体验

无 —— 本插件不注册模型工具、不写入提示词，模型看不见任何主题状态。

#### KV Cache effect

无 —— 本插件不增删模型请求的 token，也不参与任何 provider 请求的装配。

-----

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

### 安全边界

| 面 | 处理 |
|---|---|
| 谁能改主题 / 写文件 | 需要**写口令**。口令每次宿主启动随机生成，只随 `index.html` 首屏注入下发给同源页面；`GET /api/state` 仅对**已持口令**的调用方回显口令（自证刷新），被动探测拿不到。`ctx.connection` 在位时再叠一层 DSH 浏览器会话校验 |
| DNS rebinding | 每个请求校验 `Host` 白名单（`127.0.0.1` / `localhost` / `::1`；大小写归一，`::1` 认 `[::1]:PORT` 形态）。rebinding 会把 `Host: attacker.com` 带进来，Host 校验是唯一天然拆穿它的点。曾有的 `DSH_THEME_STUDIO_TRUST_HOSTS` 与局域网 IP 直访分支随 web 端废弃一并移除：非回环来源现在一律 421 |
| 跨站写 | 写请求另校验 `Origin` 与 `Host` 一致（`Origin: null` 的沙箱 iframe / `file://` 形态直接拒）—— **但见下方"桌面端这道闸不参与"** |
| 素材读取 | 公开（与宿主的静态资源、`/plugins` bundle 同级）：`<img>` / `<video>` 的子资源请求不带自定义头。**素材 id 本身是内容哈希，但可枚举性并不成立** —— 见下方已知限制 |
| 只读接口 | `GET /api/state`（主题配置与投影；写口令只对持口令方回显）、`/api/export`、`/api/themes`、`/api/usage`。它们**不含服务器文件路径**，但 `/api/state` 会带回 `media[]` 索引（素材 id、**用户上传时的原始文件名**、尺寸、字节数、sha256）与主题档名 |
| SVG | "能带脚本的图片"双重设防：入库走**全文**危险特征体检（脚本 / `on*` 事件 / 外链嵌入 / 伪协议，16 MiB 上限），回吐带 `Content-Security-Policy: sandbox` + `Content-Disposition: attachment` —— `<img>`/背景引用照常显示，直接导航不在本源渲染 |
| 令牌名 | 只允许 `--dsw-` / `--ds-` / `--dsh-` 前缀，白名单正则 |
| 令牌值 | **先归一化反斜杠再校验**，拒绝 `<` `>`、`javascript:` / `vbscript:` / `expression()`；`url()` 只允许同源绝对路径（协议相对 `//host` 也拒）；字体栈只允许字母数字空格逗号引号连字符 |
| 高级 CSS | 只进浏览器半的 `style.textContent`（不参与 HTML 解析），不进 index；长度上限 200 KB |
| 文件类型 | 按文件头魔数判定，伪装成 `.png` 的可执行文件返回 `415`；上限默认 1 GiB |
| 删除 | 被当前主题引用的素材（背景素材与**在用字体**）默认拒绝（`409`），要 `force=1` 才放行，避免一键白屏 |
| 主题档覆盖 | `safeName` 消毒是多对一映射（「午夜?深蓝」与「午夜深蓝」同档）：目标已存在时服务端返回 `409`，UI 过确认框后带 `overwrite` 重试，不静默盖档 |

> **写口令的边界说清楚**：它挡的是**跨源与被动 API 探测**（跨源页读不到口令）。但它挡不住**能打开你界面的客户端** —— 口令就下发在首屏 HTML 里，桌面端会话内的页面天然持有它。非回环来源（局域网直连等）已被 Host 闸整体挡在 421。

> **桌面端真正生效的防线只有两道：Host 白名单 + 写口令。** 宿主 Electron 的 `forwardWebRequest` 在转发前会删掉 `host` / `origin` / `cookie` / `sec-fetch-site` 四个头，随后用 undici `fetch()` 发出 —— undici 按 HTTP/1.1 规范**自动补回 `Host: 127.0.0.1:<port>`**（命中白名单），而 `Origin` **不会被补**，于是 `originAllowed` 走 `origin === ''` 的放行分支。**也就是说 Origin 这道闸在桌面端（唯一目标部署）从不参与**，它只在"浏览器直连 127.0.0.1"这种已废弃部署里才有意义。
>
> **修订记录（旧文失实项）**：早期版本写「桌面端 Electron 转发的请求本就不带 Host 头，**缺失即放行**，这是桌面端的常态路径」，并把 `Origin` 一致性列为写请求的**第二道防线**。两句都与真实形态相反 —— 桌面端走的是**白名单命中**分支（不是缺失放行），Origin 闸整体空转。已改写。

### 已知限制

- **桌面端专用。** Electron 把 `dsh-app://app` 下的 API 与素材请求转发给内嵌 Web Host（保留 Range 请求头，视频可任意拖动；转发前剥掉 Host/Origin/Cookie 后重贴 Cookie）；宿主的首屏注入（防壁纸闪烁的 boot CSS）经 `collectIndexInjections()` 随启动注入进入桌面首屏。浏览器直连与 CLI `dsh web` 部署已废弃：非回环来源在 Host 闸即被 421。
- **`/api/state` 无鉴权，且它会带回完整素材索引**（id + 用户原始文件名 + 尺寸 + sha256 + 主题档名）。也就是说**枚举面恰恰就在那个端点里** —— 早期版本用"素材 id 由内容哈希派生、不可枚举"论证公开读取是安全的，这个前提**被本插件自己的端点推翻了**。危害有限（同源/本机可达，不含服务器文件路径），但措辞必须改：**素材读取是公开的，可枚举性成立**。
- **诊断通道（`x-dts-diag`）无鉴权可写、且污染全局可见。** 任何请求只要带这个头就会写进服务端闭包里的**全局单变量** `clientSeen`，随后任意 `GET /api/state` 都能读到；多窗口还会互相覆盖。它本是"皮肤问题唯一可观测通道"，现在可被任何本机进程投毒。
- **调参有约 220ms 防抖 + 一次本机回环往返。** 因为配色只在宿主算一份 —— 换取"首屏与运行时永不打架"。滑块本身跟手（本地草稿即时显示），落地的视觉效果略滞后。
- **玻璃质感依赖浏览器实测基准色**（`document.styleSheets` 扫描 + `getComputedStyle` 兜底）。宿主若把样式表搬进跨源链接表，退化为"只保证当前模式准确"。
- **玻璃质感对宿主类名与结构有大量适配。** 相当一部分表面靠属性选择器匹配宿主 CSS Modules 类名后缀（`[class$="_card"]`、`[class*="_entry "]`）或结构特征（`:has([data-placeholder])`、`:has([class*="hoverTime"])`）兜底 —— 宿主若更换类名生成规则或调整 DOM 结构，这些补丁会**静默失效**（不报错，只是退回不透明白底）。这是当前最大的技术债：官方明文禁止读另一个插件的 DOM/样式表，本插件的玻璃层仍在这条线上。
- **顶条菜单替身依赖宿主 preload 的 shadow DOM 结构**：靠 `[data-windows-menu]` 的 open shadow root 里 `children[0]`=应用 / `children[1]`=编辑 定位（与语言无关）。宿主插一个元素就整体错位，所以数量≠2 时整体放弃拦截 —— 那时「编辑」菜单退回系统原生弹层（主题令牌与 backdrop-filter 一条都够不着）。
- **不覆盖组件自己 inline 声明的变量**（正文宽度即属此类），所以没做对应旋钮。
- **设置导航项的图标无法自定义。** 官方 `ui-settings-general` 的 `navIcon(id)` 是硬编码表，`settings.section` 的注册选项里也没有 `icon` 字段 —— 所以主题工坊的图形只出现在**面板标题**这一个自己可控的表面上。
- **SVG 壁纸有 16 MiB 全文体检上限**（安全取舍：垫长绕过头部嗅探是实证过的攻击面），其余类型上限仍是 1 GiB。
- **平铺模式不跑 Ken Burns 推拉**：原始像素语义就是不缩放，推拉与它矛盾，直接跳过。
- **多个 UI 路径未在真机上验证过。** 本机没有 react（运行时由 loader 注入），19 个自写控件**一次都没被真正渲染过** —— Modal 焦点/Escape、Menu/Select 键盘、Tooltip 定位、Slider 钳制等**行为契约未验证**，测试只到"元素树里出现自写控件 + 契约参数正确 + ARIA 角色正确"这一层；视觉一致性也没有真机对比。
- **构建需要 `tsdown`**（开发态）：浏览器半源码是 TS（`src/client/**/*.ts`），改动后必须 `npm run build:client` 重新生成 `client.js`；`npm test` 首步会校验两者同步（未构建直接报错）。运行时不依赖任何构建工具。
- **`dsh.id` 是非官方字段。** 官方零个包声明 `dsh.id`，DSH 运行时也不消费它；这里保留是为了生态工具，与 `name` 永远同值。

### DSH 兼容性

| 项 | 值 |
|---|---|
| `dsh.compatibility.dsh` | `>=0.1.5` |
| Node.js（运行时） | `>=20`（`engines`；插件运行本身无更高要求） |
| Node.js（开发/构建） | `^22.18 \|\| >=24`（`tsdown 0.22` 的要求，仅 `build:client` 需要） |
| 平台 | darwin / linux / win32 |
| Client 组合 | `platform: web`，`immediately: true`（stage-one prefetch）；注入 `@deepseek-ai/dsh-client-ui-theme` + `@deepseek-ai/dsh-client-ui-slots` |
| 构建期依赖 | `tsdown`（+ 其自带 rolldown）。**仅开发态**：发布包里的 `client.js` 已构建好，安装者无需构建工具 |
| 宿主包依赖 | **零** —— 产物里的运行时 `require` 只有 `react`、`react-dom`、`react-dom/client`，全部落在宿主的基座静态表内；`@deepseek-ai/*` 的 require 计数为 **0** |
| Model Experience | 无 —— 不注册模型工具、不写入提示词 |
| KV Cache effect | 无 —— 不增删模型请求 token |

### 目录

```
dsh-theme-studio/
├── index.js                     Host 半：路由装载 + 首屏注入
├── client.js                    ⚠️ 生成物（TS 产线产物；改 src/client/* 后跑 npm run build:client）
├── src/client/*.ts              浏览器半源码（15 个 .ts：identity/deps/i18n/utils/primitives/
│                                store/probe-glass/api/layer/chrome/caption-menu/tabs/app/
│                                index 装配入口 + platform.d.ts 宿主类型声明）
├── src/client/controls/         自写控件层：19 个 *.ts + 19 个配套 *.module.css
├── lib-build/client.js          tsdown 中间产物（构建落地点；client.js 由它复制而来）
├── lib/color-core.js            颜色单一真源（engine 与浏览器半共享）
├── lib/engine.js                配色与 CSS 引擎（纯函数，唯一配色真源）
├── lib/store.js                 状态与素材存储（原子写、内容寻址、乐观锁）
├── lib/sniff.js                 媒体魔数判定 + SVG 全文体检
├── lib/image-size.js            图片头部尺寸解析（png/gif/bmp/jpeg/webp）
├── lib/http.js                  纯 node:http 处理器（Range、写口令、SSE），可脱离 Cordis 自测
├── tsdown.theme-studio.config.ts 客户端构建配置（banner/intro/footer 三件套对齐官方契约）
├── tsconfig.client.json         TS 类型检查配置（npm run typecheck）
├── tools/                       构建与测试工具（build-client / typecheck / verify-bundle /
│                                integration-check / run-tests / css-modules 自研编译器）
├── test/                        自测（引擎+HTTP 契约 / Host 装配 / 浏览器交互 / 三轮审计修复锁 /
│                                bundle 静态审计 / css-probe / VISUAL-SMOKE 冒烟清单）
├── cordis.patch.yml             profile 层插入行
├── icon.svg + locale/           Plugin Manager 卡片元数据（官方 display metadata 契约）
├── install.ps1 / uninstall.ps1
└── package.json                 dsh.client 声明（platform: web, immediately: true）
```

零运行时依赖 —— `dependencies` 是空的，浏览器半的 `react` / `react-dom` 由宿主基座注入（bare require）；构建期依赖 `tsdown` 仅在开发态使用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作上下文——点击展开</summary>

**产物契约实测值**：`client.js` = 7128 行 / 297535 字节；banner 与 footer 与官方 15 个 bundle **逐字一致**（`window.__ModuleLoader__.load({` + `\tid: "<包名>",` + `\tfactory: (require) => {` + 三行 intro，尾部 `exports.apply` / `exports.inject` + `return module.exports;`）。`lib-build/client.js` 与它一致。

**CSS 注入原语**：`layer.ts` 的 `upsertStyle(id, css)` 用 `document.querySelector('style[data-plugin-css="<包名>/<id>"]')` 做查询式幂等守卫，设 `data-plugin` / `data-plugin-css` 两个属性、不设 `style.id`（官方从不设 `style.id`），`head.appendChild`；卸载时手工 `styles.forEach(el => el.remove())`，比依赖宿主回收更早撤。

**CSS Modules**：源码写 `.module.css`，由自研零依赖编译器 `tools/css-modules.mjs` 在构建期编译成「内联 CSS + 查询式幂等注入 + 类名映射对象」，产物形态与官方**逐字同构** —— `<6位盐>_<局部名>`、`style[data-plugin-css="dsh-theme-studio/<路径>"]` 幂等、`dataset.plugin` / `dataset.pluginCss`、不设 `style.id`。本机没有 lightningcss/postcss，所以编译器是自写的（`node tools/test-css-modules.mjs` → 61/61 PASS；19 份控件 CSS 全部编译通过且类名双向对平）。**`@keyframes` 引用做了两遍扫描**：先收集全部定义再改名引用，否则 `animation: spin 1s` 写在 `@keyframes spin` 之前时引用不改名、动画静默失效。

**sourcemap**：构建期生成 `lib-build/client.js.map`，**不进 `files`**（官方同款：构建期生成、发布时剔除）—— 所以产物里的 `//# sourceMappingURL` 只在开发态存在。

**测试清单自动发现**：`tools/run-tests.mjs` 扫 `test/*.test.mjs`。原来 7 个文件在 `package.json` 里**硬编码枚举**，加了测试文件忘了改脚本就**静默不跑**、整条链照样报绿（最典型的假阴性：测试写了等于没写）。一个文件都扫不到时同样报红，不接受"零测试也算过"。`typecheck` 找不到 tsc 也从 `exit 0` 改为**直接报红**；`build-client --check` 构建失败时**回放 tsdown 输出**（原来 `stdio:'ignore'` 把报错整段吞掉，只剩一个光秃秃的 exit code）。

</details>

**运行时不变式**：宿主 `theme` 服务缺件与接口不通时只报错、不抛给宿主；卸载后在飞的投影不得把样式与背景层重新长回来（僵尸主题）；token 层永远成对写入，单侧缺值先取基准值再退到另一侧。上述三条分别由 `test/client.test.mjs` 与 `test/host.test.mjs` 直接断言。

## 许可

MIT
