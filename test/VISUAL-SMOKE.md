# 视觉冒烟清单（VISUAL SMOKE）

Node 层 141 条锁锁不住像素、合成器与真实渲染——白底返白、标签竖排、98 层 blur 闪屏
三个 bug 全部发生在测试全绿的时刻。本清单是验证网的顶层：**任何 CHROME_CSS / 组件布局 /
玻璃逻辑变更后、发版前**跑一遍，约 5 分钟。

前置：桌面端应用运行中（插件面板随应用启动装载），应用内 DevTools Console 或
Playwright evaluate 均可执行下方 snippet。

## 1. 导航与交互存活（≈1 分钟）

设置 → 主题工坊 → 八个页签逐个点开 → 色彩 ↔ 文字 ↔ 形状与动效 往返 3 次 →
在任一输入框打字。**哨兵**：无闪烁、无渲染撕裂、点击与输入即时响应。

## 2. 合成层计数（色彩页必跑）

```js
// 期望：≤ 4（textarea/下拉触发器等大件）；98 = 闪屏回归复发
[...document.querySelectorAll('.dts-input, .dts-select-trigger, .dts-textarea')]
  .filter((el) => { const bf = getComputedStyle(el).backdropFilter; return bf && bf !== 'none' }).length
```

## 3. token 行几何（色彩页）

```js
// 期望：全部行 cols 一致、kids 恒 4、label ≈ 31×14 横排（高 ≈14 而非 40+）
[...document.querySelectorAll('.dts-token-row')].slice(0, 8).map((row) => {
  const label = row.querySelector('.dts-pair-label')
  const r = label && label.getBoundingClientRect()
  return { cols: getComputedStyle(row).gridTemplateColumns, kids: row.children.length,
    label: r ? [Math.round(r.width), Math.round(r.height)] : null }
})
```

## 4. 输入面玻璃抽查（任一页）

「预设→明暗模式」「形状与动效→滚动条」两个下拉触发器、高级页自定义 CSS 文本框：
有壁纸时应是深玻璃观感，**不得纯白**；无壁纸时走宿主输入面。宿主会话输入框（composer）
始终保持不透明（钦定语义，input-major 与本面板消费面分离）。

## 5. 会话与主页宿主面（有壁纸会话内跑）

- 会话页输入卡下方的**统计条**（`[data-composer-stats]`，"N 轮 N 步 / 缓存命中"）：
  应是输入卡同款深玻璃圆角带，消息文字上下滚动时**不再从它背后叠字**。
```js
// 期望：有背景 + 大模糊；无 = 修复脱落
var s = document.querySelector('[data-composer-stats]')
s && [getComputedStyle(s).backgroundColor, getComputedStyle(s).backdropFilter]
```
- 主页「创造模式」选择器：底色应与左侧工作区选择器一致（清透，仅 hover 有填充），
  **不得有常驻磨砂暗斑**（menuAnchor 曾被 [class*="menu"] 兜底误伤）。

## 6. 双主题对拍

明暗模式切到浅色 → 重跑 2/3 → 切深色 → 重跑 2/3。**哨兵**：两种模式下几何一致、
玻璃对比自愈生效（白字主题下表面翻深、diff 块翻深）。

## 历史坑对照

| 坑 | 特征 | 本清单哨兵 |
|---|---|---|
| 输入面返纯白 | 下拉/文本框白底与玻璃不搭 | §4 目测 |
| label 竖排 / 列错位 | 「浅色值」挤成一字宽、上下行 input 不对齐 | §3 几何 |
| 合成层爆炸 | 色彩页闪、撕裂、丢交互 | §2 计数（≤4） |
