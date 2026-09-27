---
description: "Theme Studio for DeepSeek Harness: image and video wallpapers served byte-for-byte with HTTP Range, per-token recoloring, custom fonts, glass surfaces, corner and motion controls, 12 light/dark presets, color picking from the wallpaper, and named theme profiles."
kind: "package-reference"
---

# dsh-theme-studio

English | [中文](README.zh.md)

## 维护者须知（改这个插件前先读这三条）

1. **新增 CSS 规则写进 `src/client/controls/*.module.css`**，不要再往 `src/client/chrome.ts` 的
   `CHROME_CSS` 数组里加。那个数组是 TS 字符串：没有语法高亮、没有 lint、**选择器非法也不报错**；
   它已经因此静默失效过两次（注释块夹在数组元素之间时，下一行以 `+` 开头会被解析成**一元加号**，
   `Number('body…')` = NaN，产物里出现 `"NaNbody…"` 坏选择器，整条规则不生效、不报错、不白屏）。
   有一条产物级哨兵 + 一条规则数棘轮会咬它。
2. **`CHROME_CSS` 里的 `⚠️` 注释不要删**。实测 96 个注释块中 **64% 是警告、25% 是实测依据** ——
   宿主 DOM 是黑盒，这些注释是"为什么锚这个选择器、改这里会踩什么"的唯一记录。
3. **改任何与宿主外观有关的东西，必须走真机验证**：`npm test` 只能证明语法与契约，证明不了
   "界面上真的变了"。本仓库的排版/材质问题（背景层被盖、`⌄` 的糊、HARNESS 白斑、面板三列不齐）
   全部是靠真机读 computed style 才定位到的。

## Summary

`dsh-theme-studio` (Theme Studio) re-skins the DeepSeek Harness interface: image, video or built-in gradient wallpapers, or none at all. Media is **stored and served byte-for-byte** — no transcoding, no rescaling, no recompression — and video is served with HTTP Range so the scrubber works anywhere in the file. Recoloring is **per token**: **7 groups / 49** real host tokens with paired light and dark values, plus accent-derived palettes, color picking from the wallpaper image, and free-form `--dsw-*` token add/remove. On top of that sit 12 hand-graded light/dark presets, named theme-profile snapshots, uploaded fonts, glass surfaces, corner curvature and motion-duration controls, and window-wide fullscreen.

Nothing in the host is patched: color is re-cast through `ctx.theme.overrideTokens()`, light/dark and font size go through the host's `setTheme()` / `setFontSize()`, interface copy is registered with the host locale service, and the panel is one `settings.section` entry inside the host settings page.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

**Desktop is the only supported deployment.** Install this directory by local path from the app's Plugins page, or add a `link:` dependency plus a bundles entry to the desktop profile (`~/.dsh/profiles/desktop/package.json`) and restart the app. A one-shot script is also available (`-Profile` selects the target profile, e.g. `desktop`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile desktop
```

> **A build is only needed after editing `src/client/*.ts`**: `npm run build:client` (requires `tsdown`, see "DSH compatibility"). `client.js` ships prebuilt, so installing needs no build tooling.

**Restart the app after installing**: the Host half (HTTP routes plus the data directory) is mounted at startup only. On desktop, Electron forwards requests under `dsh-app://app` to the embedded Web Host; after the restart, Settings should show a standalone "Theme Studio" page.

Uninstall:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -Profile desktop            # keeps your themes and media
powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1 -Profile desktop -PurgeData # removes the data too
```

### One entry point

1. **Settings → Theme Studio** — the full panel, as a standalone page in the settings navigation (registered through the official `settings.section` slot);
2. **A fallback row in "General"** — registered only when `settings.section` never lands in the official ledger. It opens a modal that embeds the *same* component tree and differs only by a `data-variant` attribute.

> The round floating button in the bottom-right corner was removed: it fought the composer for that corner and duplicated the settings entry. The collision fade-out logic and the icon-contrast self-healing went with it (`.dts-fab` styles and the whole `mountFab` family are gone).

Destructive actions (reset to defaults, delete media, overwrite a same-named profile) always raise a **confirm dialog**: `Esc` cancels, `Enter` confirms, and cancelling sends no request at all.

**Shortcuts**: `Alt+F` toggles window-wide fullscreen · while a modal is open, `Esc` closes it and hands focus back to the button that opened it.

### Panel surfaces

| Panel | What it changes |
|---|---|
| **Presets** | 12 hand-graded light/dark palettes (Deep Sea / Aurora / Ember / Tundra / Night Sakura / Cyber / Rice Paper / Graphite / Orchid Night / Rain Rock / Terracotta / Official); light/dark/system mode; conversation font size |
| **My profiles** | Saves the current "palette + wallpaper + glass + font" as a named snapshot; cards show the accent dot and a wallpaper summary; apply / overwrite / delete in one click (destructive actions go through a confirm dialog); live sync across windows |
| **Wallpaper** | Image / video / built-in gradient / none; fit (cover · contain · **tile at native pixels**); focus point (dragged directly on the image); zoom (one semantic for images and video: fit sets the `cover`/`contain` keyword, zoom goes through `transform: scale`, and it still applies while the veil is on); blur / brightness / saturation / contrast / grayscale / sepia / hue; dimming veil (lighter at the top, heavier at the bottom); Ken Burns slow pan-and-zoom; pointer parallax; fade while typing; video mute · loop · autoplay · playback rate; glass (panel alpha · blur · saturation) |
| **Library** | Upload by drag-and-drop or picker (image / video / font), progress bar, thumbnails, native dimensions and byte size, one-click "set as wallpaper" (which also turns glass on — an opaque panel covers the wallpaper completely, and this is the usual cause of "I clicked and nothing happened"), and reference-protected deletion (both the active wallpaper asset and **in-use fonts** are blocked; deleting a font states the fallback consequence in the confirm dialog) |
| **Color** | Accent color (auto-derives primary / link / selected / hover tokens); **color picked from the wallpaper**; paired light/dark fine-tuning of **49 real host tokens in 7 groups** (including the "buttons and feedback" family); free-form `--dsw-*` token add/remove; live body-text contrast readout (WCAG) |
| **Text** | UI font stack, code font stack, letter spacing; upload your own font (woff2/woff/ttf/otf) → automatic `@font-face` → one-click apply |
| **Shape and motion** | Corner curvature (superellipse exponent; host default 1.5); motion-duration multiplier (including a one-click off); reduced motion; scrollbars (default / pill / hairline / hidden) |
| **Advanced** | Extra custom CSS; theme JSON import/export; media usage statistics (profile management lives on the "My profiles" page) |

> The **49 tokens** in the Color row and `TOKEN_GROUPS` in "Understand the implementation" are the same data: 7 groups, 49 pairwise-distinct token names, reconciled by one test case.

### Data location

```
$DSH_HOME/theme-studio/
├── state.json                    theme document + media index + revision
├── media/<first 24 of sha256><ext>   media bytes written verbatim
└── themes/<safeName>.json        named profiles (one file per card on the "My profiles" page)
```

`$DSH_HOME` defaults to `~/.dsh`. Environment overrides:

| Variable | Effect | Default |
|---|---|---|
| `DSH_THEME_STUDIO_HOME` | Data directory | `<$DSH_HOME>/theme-studio` |
| `DSH_THEME_STUDIO_MAX_UPLOAD` | Per-file limit (bytes) | `1073741824` (1 GiB) |

### Fullscreen button

To the left of the native `— □ ×`, not on a panel header row. Its right inset is measured through `navigator.windowControlsOverlay.getTitlebarAreaRect()` — 138 px fallback for the three Windows buttons, 12 px for the macOS traffic lights on the left. Height comes from the host-published `--dsh-windows-titlebar-height`, and the element carries `-webkit-app-region:no-drag` (the whole title bar is a drag region; without it the button cannot be clicked).

### Native quality

This is the one point the plugin does not compromise on, and the implementation deliberately bypasses the host attachment pipeline:

1. **It does not use `ctx.attachments`.** Attachments mean "show this to the model" and are normalized to a 2048 px long edge / 4 MiB encoded. A theme wallpaper means "show this to the human", so media travels over the plugin's own route and not a single byte is re-encoded.
2. **Uploads stream straight to disk.** The browser sends `fetch(File)` as the request body; the host writes and computes SHA-256 on the fly, so video never lands in memory whole. The extension and MIME come from **file-header magic bytes** — never from the browser's claim, never from the filename.
3. **Playback supports HTTP Range.** `GET /dsh-theme-studio/media/<id>/<name>` handles `bytes=a-b` and suffix ranges, `206 Partial Content`, `416`, `ETag`/`304`, and body-less `HEAD` — the precondition for `<video>` scrubbing without downloading the whole file first.
4. **Content addressing → permanent immutable caching.** The filename *is* the content hash, so `Cache-Control: public, max-age=31536000, immutable` is safe; re-uploading the same file hits the same asset (deduplication).
5. **Filters never re-encode.** Blur/brightness/saturation/veil are all CSS `filter` and gradient overlays running in GPU compositing. The original file is always the one you uploaded; changing parameters cannot cost quality.
6. **Tile mode** (`tile at native pixels`) does not even set `background-size`, so a 4K image lays out 1:1.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

Color logic runs **once, on the host**: the browser half does not reimplement the engine and only consumes the `css` and `tokenLayers` the host computed. On reload, `webserver/index-inject` builds the first-paint styles with the same engine, so "after the plugin loads" and "first paint" cannot disagree and cannot flash. All recoloring goes through `ctx.theme.overrideTokens()` — `ui-layout`'s `ThemePresenter` writes tokens as inline styles on `body`, which outranks any selector rule.

Interface copy is registered with the official `ctx.locale` service (`ctx.effect(() => locale.register(NS, {zh,en}), '<reason>')`) and shares one `MESSAGES` object with the in-house `t()`, so the two cannot drift. When the official locale service is absent the registration is skipped quietly and the UI falls back to the bundled dictionary chain. The settings entry's `label` is a thunk that declares `locale`, so the official shell re-resolves it on a language change and no re-registration is needed.

<details>
<summary>Implementation internals — click to expand</summary>

### Architecture

```
Desktop UI (Electron)                       Node host (index.js)
┌──────────────────────────┐ dsh-app://  ┌────────────────────────────┐
│ settings page / fallback  │ ──────────> │ /dsh-theme-studio/* routes  │
│ token-fill probe (sheets) │ <─────────  │ state + media + projection  │
│ ctx.theme.overrideTokens  │  SSE        │ streaming upload · Range    │
│ backdrop DOM (img/vid)    │             │ $DSH_HOME/theme-studio      │
└──────────────────────────┘             └────────────┬───────────────┘
                                                      │
                                         lib/engine.js (sole color source)
                                         buildTokenLayers() / buildCss()
                                         buildBootCss() → index-inject
```

Four decisions define the shape:

- **Color logic runs once, on the host.** The browser half does not reimplement the engine; it consumes the host-computed `css` and `tokenLayers`.
- **All recoloring goes through `ctx.theme.overrideTokens()`.** Light/dark mode and font size also go through the host `setTheme()` / `setFontSize()`, the same source as the native Appearance settings. Paired light/dark filling happens in two stages: **the host cannot see the page's baseline values, so it only fills what it is sure about and leaves one-sided gaps empty**; the browser half then closes over both baselines read from `body` and `body[data-ds-dark-theme]`. That is why "change only the light palette" cannot drag the dark palette along.
- **The entry point self-checks, then falls back.** After registering `settings.section` it verifies with the official `slots.entries()` that the entry really reached the ledger; if not, it falls back to a single "General" row. A missing entry is a functional regression, so both registrations are wrapped in `try/catch`.
- **No switch is offered that cannot land.** Text width is the example: the host writes `--dsh-chat-user-width` as an inline style on the element itself, so a `body`-level override loses, and this plugin therefore **has no such knob**. Every item in the panel corresponds to a declaration that actually takes effect.

### Token layers and glass

**Contract**: a glass surface carries no self-chosen color and applies no dimming — **100% of its color comes from the wallpaper; only frosting is added**. That is `background: transparent` + `backdrop-filter: blur()`.

```css
:root{
  --dts-glass-fill: transparent;                                               /* zero self-chosen color */
  --dts-glass-blur: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%)); /* forward the host's frosting */
}
```

The host menu-surface fill is zeroed **unconditionally**: the token layer writes `--dsw-menu-surface-fill: transparent`, the same tier as `--dts-glass-fill`. That is the only way "one glass source of truth for the whole plugin" holds — one extra number here would be a second fork. The division of labor is one sentence: **frosting handles legibility, fill has been zeroed (all color goes to the wallpaper)**.

**Why zero color**: with the earlier fixed fills (`rgba(16,20,24,.8)` near-black → `rgba(48,64,88,.72)` slate blue), an alpha of `.72` meant **72% was a color *we* picked and only 28% of the wallpaper survived** — the glass color inevitably detached from the wallpaper. The owner's own words: "it doesn't feel like it comes from the same color source as the wallpaper." Blocking background text depends on **opacity, not darkness**, and the two can be decoupled: "blur only" hands legibility to `blur()` and hands color entirely back to the wallpaper.

> **Revision note (retired claims)**: an earlier revision of this README said "alpha stays at `.8`" and "the whole table only contains `.8` and `.15`" in this section. That was history from *before* the fifth round moved to `transparent`, and it was not marked as history, so a reader would take it for the current contract. Both sentences are withdrawn. The current source of truth is `--dts-glass-fill: transparent`; the only `rgba(16,20,24,·)` values left in `CHROME_CSS` are **`.15` / `.28` / `.92`** (meanings in the exception table below), asserted value by value by a test case.

⚠️ **The accepted cost** (the owner knows and chose it): with the fills and dimming gone, `blur()` is the **only** mechanism keeping background text hard to read. If a `backdrop-filter` is ever boxed in by an ancestor chain and stops working, the body text behind it becomes directly legible with nothing to fall back on. So "the frosting must stay alive" is a hard precondition, protected in three places: overlay layers must never carry `backdrop-filter`, the composer card's frosting moved into a `::before`, and `[role=dialog]` carries frosting explicitly.

**Three exceptions** (each has a hard reason; none is an oversight):

| Exception | Value | Why it is mandatory |
|---|---|---|
| `--dts-glass-fill-thin` | `rgba(16,20,24,.28)` | Dense small inputs carry **no** backdrop-filter (98 blurred nodes would explode the compositor); transparent + no frosting = the control disappears |
| `.dsh-agent-dialog` | `rgba(16,20,24,.92)` | Nested confirm dialogs render **inside** the settings modal card, whose blur turns it into a backdrop root and boxes the frosting in — only a near-opaque fill keeps the text behind it from bleeding through |
| `_tag_[data-tone=solid]` and the `buildVersion` badge | host button tokens / `.15` fallback | The inverted chip is a small **white-text-on-fill** element; fully transparent turns it into "white text floating on nothing". The badge entry is the host's own `button-elevated-fill` token, not a glass surface |

⚠️ The `.92` rule **was once deleted by a "merge duplicate rules" cleanup pass** (it looks like a duplicate of `[role=dialog]` but is an independent functional rule) and had to be recovered through git `128f530`. It now has a regression lock. **Do not delete it as a duplicate while tidying code.**

### Cross-window sync

The host broadcasts the revision over SSE and every open window follows immediately; when SSE is unavailable it degrades to visibility polling. Writes land as "temp file + rename" atomic replacement and `revision` increases monotonically. **The parameter-editing flow carries an optimistic-lock base** (each commit carries the `expectRevision` from where editing started), so when two windows edit the same theme the later writer receives `409` and is asked to re-read instead of silently overwriting.

### Client self-diagnostics

On every `GET /api/state` the client sends `x-dts-diag`, a URL-encoded compact snapshot: `body` class names, whether `dts-chrome-style` is injected, whether `#dts-backdrop` exists, whether the settings entry landed, the real class names of host `*card*` elements, and how many nodes each of two target selectors matches. The host whitelists the fields and puts the result in the `client` field of `/api/state` (`client === null` means the browser half never reported back — i.e. it did not run, which is itself a finding). Skin problems always originate in the DOM, and the DOM is unreachable from outside, so without this channel the only option is guessing selectors from screenshots and restarting when the guess is wrong.

⚠️ **This channel is currently unauthenticated**: any local process or page that can issue a request may write to this single global variable with `x-dts-diag`, and any `GET /api/state` reads it back. See "Known limitations".

### Self-test

```powershell
npm test               # full chain: build sync check → 184 behavior locks → typecheck (host JS + TS source) → load-contract smoke → end-to-end integration
npm run build:client   # rebuild client.js after editing src/client/*
npm run typecheck      # type network only
```

① `build-client --check` (edit source without rebuilding → red immediately) ② 184 behavior locks (the test list is **auto-discovered** from `test/*.test.mjs` by `tools/run-tests.mjs`; finding no files is also red) ③ the `tsc` type network in two configurations (`jsconfig.json` for the host JS, `tsconfig.client.json` for the browser-half TS source) ④ `verify-bundle` load-contract smoke plus `integration-check` end-to-end assembly (20 items).

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

### Cross-verification record

The interaction model mirrors the sibling plugin `dsh-agent-instructions`. Every row below was verified against the harness artifacts in place; no comment or README restatement was taken on trust:

| Verified fact | Source | How this plugin handles it |
|---|---|---|
| `slots.register(options, component)` takes exactly two arguments; it throws outright when the slot was never declared by a parent | `ui-slots` artifact | Every registration is wrapped in `try/catch` and a fallback entry point exists |
| Duplicate registration in a list slot with the same id *and* priority throws | same | The old registration is disposed before re-registering on a language change |
| `slots.entries(key)` is the official ledger introspection API; `ui-settings-general` projects navigation with it | same | After registering, the entry is checked to have really landed; only then is the fallback skipped |
| The authoritative language source is `ctx.locale.getSnapshot().active` | `locale` artifact | `<html lang>` is a fallback only: the server HTML hard-codes `lang="en"` and the rewrite happens asynchronously after plugin activation |
| `Switch`'s `label` is only an `aria-label` and renders no visible text; `onChange(next: boolean)` | `ui-primitives` artifact | The visible label is supplied by the `Row` itself |
| `Tooltip`'s children must be able to take a ref | same | Wrap the control in a `span` first |
| `StateDot`'s prop is `state` (`done/warning/error/idle/ongoing`) | same | The panel status dot uses the in-house control, falling back to `.dts-dot` |
| `Button`'s `variant` only accepts `primary/ghost/outline/toolbar`; native attributes pass through | same | `danger` is out of contract ⇒ mapped to `ghost` plus the in-house `.dts-btn-danger` color |
| `Input`'s `className` lands on the outer wrapper and everything else passes to the inner input | same | A layout `style` would fall into the inner node and miss flex ⇒ an outer `.dts-input-flex` takes it |
| `Pill` renders a button when it has `onClick` and a static span otherwise | same | Passes `active` + `onClick`, matching the contract |
| `Toast`'s `tone` accepts **only** `'success'`; omitting the tone yields the warning seat | same | The error state **omits** `tone` (passing `'error'` empties even the icon seat) |
| `react-dom/client` is in the host seed module table | `client-modules` artifact | It can be `require`d directly without declaring it in package.json |
| Body text width is controlled by an element-level inline style | `ui-conversation` artifact | A `body` override loses ⇒ no such knob is offered |
| Every `Theme.listTokens` token has `requiresLightAndDark: true`; all 49 panel tokens were checked to have real definitions and consumers | runtime introspection + `ui-theme` stylesheets | Paired light/dark filling is closed by `fillTokenPairs`; no dead knobs |
| Locale dictionary surface: `locale.register(ns, {zh,en})`; continuous sync via the `locale/change` event or the getSnapshot/subscribe pair | `locale` artifact, `cordis-client-runner` api-catalog | Both dictionaries are registered with the locale service and share one `MESSAGES` object with the in-house `t()`, so they cannot drift |
| `dsh.client.immediately` means stage-one prefetch | `client-modules` / `client-web` artifacts | Declared `true`: the backdrop layer and tokens join the first stage instead of waiting for lazy loading |
| A `webserver/index-inject` subscription may carry `{ prepend: true }`; that is how ui-theme registers its boot injection | `ui-theme` artifact | Same here: the theme row goes in first, the backdrop layer goes last, and the write key line goes ahead of everything |

> **On citations**: every source above is a **host artifact** (`lib/*.js`). Line numbers into `src/*.ts` are deliberately no longer cited — only the asar artifacts exist on this machine, there is no TS source tree, and TS line numbers cannot be verified in place.

### Audit conclusions

Two independent auditors ran a client-UI verification pass back to back (68 controls + 73 interaction checkpoints). I re-verified every item myself: **4 were overturned** (withdrawn, leaving neither a note nor code) and **9 were confirmed and fixed**.

**Overturned false findings**: `Slider` missing `aria-label` (it always passes `props.label`) · `uiSwitch` dropping its visible label (supplied by the outer `Row`'s `<label>`) · switching to a non-image mode clearing `mediaId` with no symmetric control (it prevents a dangling reference by design) · the modal missing a focus trap (fully implemented in `app.ts`). **Re-verifying before believing is the single most valuable step in this batch** — without it, four correct pieces of code would have been changed for nothing.

**The 9 confirmed and fixed items** (each has a regression lock, and every lock was verified to actually bite):

| # | Defect | Root cause | Fix |
|---|---|---|---|
| P1 | `Choice` dropped focus to `<body>` after Tab/Enter/mouse commit | The activated option unmounted with the popup, leaving focus nowhere | All three `commitAt(index, back)` call sites pass `true`, returning focus to the trigger |
| P2 | `Choice`'s Tab path lacked `preventDefault`/`stopPropagation` | It took ownership of focus but left the browser's default movement in place | Added on both paths |
| P3 | The edit menu had no keyboard navigation and left focus on a `tabIndex=-1` container | `role="menu"` was declared but item-to-item movement was never implemented | Full ↑↓/Home/End/Enter/Tab set plus focus landing on the **first item** |
| P4 | `execCommand` failures gave silently no feedback | Everything except paste simply `return`ed | Return success/failure → `role=status` + `aria-live` notice |
| P5 | The `paste` fallback target could be `<body>` and always claimed success | Focus editability was never checked and `dispatchEvent`'s return value was discarded | Two self-checks; failure is reported as failure |
| P7 | The in-house dropdown had no height cap and no upward flip | Enough options pushed it out of the viewport, and clipped items **could not be scrolled to** | `max-height:min(52vh,420px)` + `data-flip="up"` |
| P8 | The title-bar menu located items by hard-coded `bar.children[0]/[1]` | One extra host element shifted everything → **"Application" got hijacked** and About/Quit became unclickable | Switched to the full set matched by `[role="menuitem"][aria-haspopup="menu"]`; **if the count is not exactly 2, interception is abandoned entirely** |
| P10 | The color-picking `Image`'s `load`/`error` listeners were never removed | Only one of the two ever fires, so the other leaked permanently | Both are removed through a shared `settle()` |
| new | `importDoc(doc, mode)`'s `merge` branch had **no UI entry** | Both the host and the api half implemented it; only a button was missing | A "merge import" checkbox |

**Plus one place where implementation contradicted its own comment**: `t()`'s documentation said "copy containing `{n}` placeholders takes extra arguments in order", but the implementation only handled the "value is a function" branch — and the copy table is **entirely strings**, so arguments were silently dropped. Both branches are now covered and the signature is `t(key, ...args)` (the type network caught the arity mismatch immediately).

**How this was verified**: the 9 locks were each injected with the defect → all turned red → reverting turned them green (`verify_locks.mjs`); all 17 fixes were confirmed present in the final `client.js` artifact (`verify_bundle_fixes.mjs`). **No conclusion here rests on reading source code.**

### Glass investigation

*Round one (wrong)*: after unifying the fill, the owner still saw text through the glass. I built a repro page and measured "two nested overlays multiply `.8 × .8` to `1-(1-.8)²=.96`, nearly black, and the backdrop root is boxed in by the parent card", then added a `--dts-glass-fill-nested:.35` tier on that basis. **The diagnosis was wrong** — the repro page's geometry was wrong: I had placed the confirm dialog inside the modal card's content flow, whereas in reality it renders inside `.dts-scrim` and **floats above the whole page**. A faithful reproduction showed the backdrop-root chain contains only the dialog itself, so `.8 + blur` is entirely sufficient. That `.35` rule and variable were deleted outright (no dead configuration left behind from a wrong fix).

*Round two (wrong, and nearly a wrong fix)*: the owner added "make it frosted, it's fine if the text underneath is unreadable; a lot of surfaces are too solid and lose that translucent feel". I swept five fill tiers to lower the alpha, **compared all five on one row**, and let the upper row's blur mask the difference, concluding "`.8` is six times more than needed; `.45` is the line". Only after laying **"frosting alive / frosting dead" side by side** did the truth show:

| fill | frosting alive | frosting dead |
|---|---|---|
| `.45` | unreadable | **body text behind it stays legible word for word** ✗ |
| `.80` | unreadable | only color blotches remain ✓ |

The conclusion inverted: **`.8` is not too thick; it is the only value that still holds "the text behind is unreadable" when the frosting dies.** What the owner disliked was not the fill level — it was that **the frosting needed to be brought back to life**.

*Round three (the hit)*: the real root cause was **an overlay layer becoming a `backdrop root` itself and killing the frosting of every glass surface beneath it**. Striped wallpaper + overlay + glass card, three cells side by side:

| Overlay state | Stripes inside the card | Verdict |
|---|---|---|
| **no** `backdrop-filter` | erased by the card's own `blur(40px)` | ✓ **real frosting** |
| with `blur(2px)` | **stripes clearly visible** | ✗ the card's 40px is boxed in; only the overlay's 2px is sampled |
| dimmed `.24` + blurred | stripes visible *and* darker | ✗ victim twice over |

The mechanism: **an element carrying `backdrop-filter` becomes the backdrop root for its subtree**, and any blur opened inside that subtree only samples that one layer. So turning on overlay blur actually destroys the popup's frosting — which reads to the eye as "I added frosting and it is still see-through". Both overlay layers were affected (`.dts-scrim` and `.dts-modal-mask`, the latter the direct parent of the settings dialog card), and I had even given them a background color, which cut the behind-contrast first so the blur sampled "an already-dimmed backdrop" and produced only grey haze. Both are now **`background:transparent` + `backdrop-filter:none`**, with their semantics (focus capture and click blocking) expressed by z-index.

**The regression lock** `an overlay layer must never become a backdrop root` asserts that `.dts-scrim` / `.dts-modal-mask` and four host overlay families must have `backdrop-filter: none` and a `transparent` background, **and conversely** that `.dts-dialog` / `.dts-modal-card` / `.dts-cmenu` / `.dts-select-menu` still carry their blur (so a blanket cleanup cannot strip the real glass surfaces). Injecting `backdrop-filter:blur(2px)` makes **exactly that one assertion go red**.

> **After the third round the fill could change tiers**: once the frosting was alive again, `--dsw-menu-surface-fill` and `--dts-glass-fill` ended up on the **same tier** (both `transparent`). Only then does "one glass source of truth for the whole plugin" hold. It had earlier passed through `0.6 → 0.4 → .72` on its own — all artifacts of the "a solid color we picked ourselves" era.

**One redundant number removed along the way**: the host already publishes `--dsw-menu-backdrop-filter: blur(40px) saturate(150%)` (in the `ui-theme` artifact; always present and independent of theme settings), and the other direction is `--dsw-specific-menu` through `MenuSurface`. Our hard-coded `blur(50px)` fallback was a second source, now changed to forward `blur(40px)`.

### Missed-surface sweep

No guessing — every backgrounded host class family was enumerated and tested against "does our suffix selector reach it". Four were missed: the four onboarding cards on the Start panel (`.lnbXlW_entry`), the terminal onboarding card (`.Txfvra_entry`), the onboarding panel container (`.lnbXlW_guide`) and the loading float (`.nIBokW_loadingFloat`). Their host fill is `--dsw-alias-bg-layer-1/2` (an **opaque layer token**), so they stayed dead grey and hid the wallpaper completely. After adding rules, `.lnbXlW_entry` measures `transparent | blur(40px) saturate(1.5)` ✓ and `.lnbXlW_guide` measures `transparent` ✓ (the wallpaper shows through).

**Boundary discipline (do not frost everything)**: 5 content-area cards are **deliberately left unfrosted** — `balanceCard` (`settings-card-fill`), `rowCard`/`setupCard` (settings-page internals), and `ioCard`×2 (`markdown-code-block`). They sit inside prose flow where frosting would destroy the legibility of their own text. A sentinel assertion in the test suite fires if any of these class names appears on the glass list.

### Panel overflow

The root cause was that **`.dts-input` was not on the `box-sizing:border-box` list** — it has `width:100%` plus `padding:5px 8px`, and under content-box the padding is **added on top of 100%**, making the textarea 16 px wider than its container and pushing `.dts-body` / `.dts-group` into horizontal scroll, hard against the card edge. This was not guessed: `CHROME_CSS` was extracted from the build artifact, loaded into a repro page, and the whole chain measured with Playwright. Before the fix, `.dts-panel` / `.dts-body` / `.dts-group` all reported `scrollWidth 944 > clientWidth 940` and the textarea overran the group's content box by 16 px; after the fix, **all three viewports report `scrollWidth === clientWidth` at every level and the textarea measures exactly 916 = the container's content width**. `.dts-input` and `.dts-textarea` were added to the list, plus a lock that pins this whole family (100% width with its own padding) to border-box.

-----

<a id="model-experience"></a>
## Model Experience

None — this plugin registers no model tools and writes no prompt text, so the model sees no theme state.

#### KV Cache effect

None — this plugin neither adds nor removes tokens from a model request and takes no part in assembling a provider request.

-----

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

### Security boundary

| Surface | Handling |
|---|---|
| Who may change the theme / write files | A **write key** is required. It is regenerated at random on every host start and delivered only inside the `index.html` first-paint injection to same-origin pages; `GET /api/state` echoes the key **only to a caller that already holds it** (self-refresh), so passive probing cannot obtain it. When `ctx.connection` is present, a DSH browser-session check is layered on top |
| DNS rebinding | Every request validates a `Host` allowlist (`127.0.0.1` / `localhost` / `::1`; case-normalized, and `[::1]:PORT` is accepted for `::1`). Rebinding arrives with `Host: attacker.com`, and the Host check is the only point that naturally exposes it. The former `DSH_THEME_STUDIO_TRUST_HOSTS` and LAN-IP direct-access branches were removed along with the web deployment: non-loopback origins now always receive 421 |
| Cross-site writes | Write requests additionally check that `Origin` matches `Host` (`Origin: null` from sandboxed iframes and `file://` is rejected outright) — **but see "this gate never participates on desktop" below** |
| Media reads | Public (the same tier as host static assets and `/plugins` bundles): `<img>` / `<video>` subresource requests carry no custom headers. **The media id is a content hash, but non-enumerability does not hold** — see Known limitations |
| Read-only endpoints | `GET /api/state` (theme configuration and projection; the write key is echoed only to a key holder), `/api/export`, `/api/themes`, `/api/usage`. They contain **no server file paths**, but `/api/state` returns the `media[]` index (media ids, **the original filenames from upload**, dimensions, byte sizes, sha256) as well as profile names |
| SVG | Double defense for "an image that can carry script": ingestion runs a **full-text** dangerous-feature scan (scripts, `on*` handlers, external embeds, pseudo-protocols; 16 MiB cap), and playback carries `Content-Security-Policy: sandbox` plus `Content-Disposition: attachment` — so `<img>`/wallpaper references still render, while direct navigation cannot execute in this origin |
| Token names | Only the `--dsw-` / `--ds-` / `--dsh-` prefixes, by allowlist regular expression |
| Token values | Backslashes are **normalized before validation**; `<` `>`, `javascript:` / `vbscript:` / `expression()` are rejected; `url()` accepts only same-origin absolute paths (protocol-relative `//host` is rejected too); the font stack accepts only letters, digits, spaces, commas, quotes and hyphens |
| Extra CSS | Goes only into the browser half's `style.textContent` (never parsed as HTML) and never into index injection; capped at 200 KB |
| File type | Determined by file-header magic bytes; an executable disguised as `.png` returns `415`; the default cap is 1 GiB |
| Deletion | Media referenced by the current theme (the active wallpaper asset and **in-use fonts**) is refused by default (`409`) and requires `force=1`, preventing a one-click blank screen |
| Profile overwrite | `safeName` sanitization is a many-to-one mapping ("Midnight?Blue" and "MidnightBlue" collide): the server returns `409` when the target exists, and the UI retries with `overwrite` after a confirm dialog instead of silently overwriting |

> **Where the write key actually stands**: it blocks **cross-origin and passive API probing** (a cross-origin page cannot read the key). It does not block **a client that can open your interface** — the key is delivered inside the first-paint HTML, so a page inside the desktop session inherently holds it. Non-loopback origins (LAN direct access and the like) are stopped as a whole by the Host gate with 421.

> **Only two defenses are actually live on desktop: the Host allowlist and the write key.** The host's Electron `forwardWebRequest` deletes `host` / `origin` / `cookie` / `sec-fetch-site` before forwarding and then issues the request with undici's `fetch()` — undici **re-adds `Host: 127.0.0.1:<port>`** per the HTTP/1.1 requirement (which hits the allowlist), while `Origin` is **not** re-added, so `originAllowed` takes its `origin === ''` pass-through branch. **In other words the Origin gate never participates on desktop, the only supported deployment**; it only means anything for the retired "browser directly against 127.0.0.1" deployment.
>
> **Revision note (retired claims)**: an earlier revision said "requests Electron forwards on desktop carry no Host header at all, so **a missing Host is passed through**, and that is the normal desktop path", and listed the `Origin`/`Host` agreement as the write path's **second line of defense**. Both statements are the inverse of the real shape: desktop takes the **allowlist-hit** branch rather than the missing-Host branch, and the Origin gate is idle throughout. Rewritten.

### Known limitations

- **Desktop only.** Electron forwards API and media requests under `dsh-app://app` to the embedded Web Host (keeping the Range request header so video scrubs freely; it strips Host/Origin/Cookie and re-attaches its own Cookie). The host's first-paint injection (boot CSS that prevents wallpaper flashing) enters the desktop first paint through `collectIndexInjections()` at startup. Browser direct access and the CLI `dsh web` deployment are retired: non-loopback origins receive 421 at the Host gate.
- **`/api/state` is unauthenticated, and it returns the full media index** (id + original filename + dimensions + sha256 + profile names). The enumeration surface therefore sits inside that very endpoint: an earlier revision argued that public media reads were safe because "the media id is derived from the content hash and therefore not enumerable", and **that premise is refuted by this plugin's own endpoint**. The impact is limited (same-origin/local reachable, no server file paths), but the wording must change: **media reads are public, and enumerability holds.**
- **The diagnostics channel (`x-dts-diag`) is unauthenticated and its pollution is globally visible.** Any request carrying that header writes into a **single global variable** (`clientSeen`) in the server closure, which any subsequent `GET /api/state` reads back; multiple windows overwrite one another. It was meant to be "the only observable channel for skin problems" and can now be poisoned by any local process.
- **Parameter changes are debounced by roughly 220 ms plus one loopback round trip.** Color is computed once, on the host — the price for "first paint and runtime can never disagree". The slider itself tracks the pointer (local draft renders immediately); the applied visual result lags slightly.
- **Glass depends on browser-measured baseline colors** (a `document.styleSheets` scan with a `getComputedStyle` fallback). If the host ever moves its stylesheets into cross-origin links, this degrades to "only the current mode is guaranteed accurate".
- **Glass carries a large amount of host class-name and structure adaptation.** A substantial share of surfaces relies on attribute selectors matching host CSS Modules class-name suffixes (`[class$="_card"]`, `[class*="_entry "]`) or structural features (`:has([data-placeholder])`, `:has([class*="hoverTime"])`). If the host changes its class-name generation or DOM structure, these patches **fail silently** (no error, just a return to opaque white). This is the largest piece of technical debt here: the official rules explicitly forbid reading another plugin's DOM or stylesheets, and this plugin's glass layer still lives on that line.
- **The title-bar menu stand-in depends on the host preload's shadow DOM shape**: it locates items via `children[0]` = Application and `children[1]` = Edit inside the open shadow root of `[data-windows-menu]` (language-independent). One extra host element shifts everything, so interception is abandoned entirely when the count is not exactly 2 — at which point the Edit menu falls back to the native system popup (which theme tokens and `backdrop-filter` cannot reach at all).
- **Variables declared inline by components are not overridden** (body text width is the example), which is why no such knob exists.
- **The settings navigation icon cannot be customized.** `navIcon(id)` in the official `ui-settings-general` is a hard-coded table and the `settings.section` registration options have no `icon` field — so Theme Studio's artwork appears only on **the panel title**, the one surface it controls.
- **SVG wallpapers have a 16 MiB full-text scan cap** (a security tradeoff: padding past header sniffing is a demonstrated attack surface); every other type keeps the 1 GiB cap.
- **Tile mode skips Ken Burns.** The native-pixel semantic is "do not scale", which contradicts pan-and-zoom, so it is skipped.
- **Several UI paths have never been verified on a real renderer.** This machine has no react (the runtime is injected by the loader), so the 19 in-house controls **have never actually been rendered** — behavior contracts for Modal focus/Escape, Menu/Select keyboard handling, Tooltip positioning and Slider clamping are **unverified**. Tests reach only as far as "the in-house control appears in the element tree, its contract props are correct, and its ARIA roles are right"; visual consistency has had no real side-by-side comparison either.
- **Building requires `tsdown`** (development only): the browser half's source is TS (`src/client/**/*.ts`), so any change needs `npm run build:client` to regenerate `client.js`; the first step of `npm test` checks the two are in sync (an unbuilt change fails outright). The runtime needs no build tooling.
- **`dsh.id` is a non-official field.** No official package declares `dsh.id` and the DSH runtime never consumes it; it is kept here for ecosystem tooling and is always equal to `name`.

### DSH compatibility

| Item | Value |
|---|---|
| `dsh.compatibility.dsh` | `>=0.1.5` |
| Node.js (runtime) | `>=20` (`engines`; the plugin itself has no higher requirement) |
| Node.js (dev/build) | `^22.18 \|\| >=24` (a `tsdown 0.22` requirement; `build:client` only) |
| Platforms | darwin / linux / win32 |
| Client composition | `platform: web`, `immediately: true` (stage-one prefetch); injects `@deepseek-ai/dsh-client-ui-theme` + `@deepseek-ai/dsh-client-ui-slots` |
| Build-time dependencies | `tsdown` (with its bundled rolldown). **Development only**: `client.js` ships prebuilt, so installers need no build tooling |
| Host package dependencies | **Zero** — the artifact's runtime `require` set is exactly `react`, `react-dom`, `react-dom/client`, all inside the host seed module table; the `@deepseek-ai/*` require count is **0** |
| Model Experience | None — registers no model tools and writes no prompt text |
| KV Cache effect | None — adds or removes no model request tokens |

### Layout

```
dsh-theme-studio/
├── index.js                     Host half: route mounting + first-paint injection
├── client.js                    ⚠️ generated (TS pipeline output; run npm run build:client after editing src/client/*)
├── src/client/*.ts              Browser-half source (15 .ts files: identity/deps/i18n/utils/primitives/
│                                store/probe-glass/api/layer/chrome/caption-menu/tabs/app/
│                                index assembly entry + platform.d.ts host typings)
├── src/client/controls/         In-house control layer: 19 *.ts plus 19 paired *.module.css
├── lib-build/client.js          tsdown intermediate output (client.js is copied from it)
├── lib/color-core.js            Sole color source of truth (shared by the engine and the browser half)
├── lib/engine.js                Color and CSS engine (pure functions; sole color authority)
├── lib/store.js                 State and media storage (atomic writes, content addressing, optimistic locking)
├── lib/sniff.js                 Media magic-byte detection + full-text SVG scan
├── lib/image-size.js            Image header dimension parsing (png/gif/bmp/jpeg/webp)
├── lib/http.js                  Pure node:http handler (Range, write key, SSE), testable without Cordis
├── tsdown.theme-studio.config.ts Client build config (banner/intro/footer aligned with the official contract)
├── tsconfig.client.json         TS typecheck config (npm run typecheck)
├── tools/                       Build and test tooling (build-client / typecheck / verify-bundle /
│                                integration-check / run-tests / the in-house css-modules compiler)
├── test/                        Self-tests (engine+HTTP contract / host assembly / browser interaction /
│                                three rounds of audit-fix locks / bundle static audit / css-probe / VISUAL-SMOKE)
├── cordis.patch.yml             Profile-layer insertion line
├── icon.svg + locale/           Plugin Manager card metadata (official display metadata contract)
├── install.ps1 / uninstall.ps1
└── package.json                 dsh.client declaration (platform: web, immediately: true)
```

Zero runtime dependencies — `dependencies` is empty and the browser half's `react` / `react-dom` come from the host seed modules (bare require); the build-time `tsdown` dependency is used in development only.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

**Measured artifact contract**: `client.js` is 7128 lines / 297535 bytes; the banner and footer are **word-for-word identical** to all 15 official bundles (`window.__ModuleLoader__.load({` + `\tid: "<package name>",` + `\tfactory: (require) => {` + the three intro lines, and the trailing `exports.apply` / `exports.inject` + `return module.exports;`). `lib-build/client.js` matches it.

**CSS injection primitive**: `upsertStyle(id, css)` in `layer.ts` uses `document.querySelector('style[data-plugin-css="<package name>/<id>"]')` as a query-based idempotence guard, sets the `data-plugin` / `data-plugin-css` attributes, never sets `style.id` (the official bundles never do), and appends to `head`. On unload it removes its own styles via `styles.forEach(el => el.remove())`, which is earlier than relying on host reclamation.

**CSS Modules**: source is written as `.module.css` and compiled at build time by the in-house zero-dependency compiler `tools/css-modules.mjs` into "inlined CSS + query-based idempotent injection + a class-name mapping object", producing an artifact **word-for-word isomorphic** to the official one — `<6-char salt>_<local name>`, idempotence through `style[data-plugin-css="dsh-theme-studio/<path>"]`, `dataset.plugin` / `dataset.pluginCss`, and no `style.id`. This machine has neither lightningcss nor postcss, so the compiler is hand-written (`node tools/test-css-modules.mjs` → 61/61 PASS; all 19 control stylesheets compile and their class names reconcile in both directions). **`@keyframes` references get a two-pass scan**: definitions are collected first and references renamed after, otherwise an `animation: spin 1s` written before `@keyframes spin` keeps the old name and the animation dies silently.

**Sourcemap**: `lib-build/client.js.map` is generated at build time and **is not in `files`** (same as the official packages: generated at build, excluded from publication) — so the `//# sourceMappingURL` comment exists in development only.

**Test discovery is automatic**: `tools/run-tests.mjs` scans `test/*.test.mjs`. The seven files used to be **enumerated by hand** in `package.json`, so adding a test file without updating the script made it **silently not run** while the whole chain still reported green — the classic false negative, where writing a test is the same as not writing it. Finding zero files is red too; "zero tests count as a pass" is not accepted. `typecheck` likewise changed from `exit 0` to **failing outright** when tsc is missing, and `build-client --check` now **replays the tsdown output** on a failed build (it used to swallow the whole error with `stdio:'ignore'`, leaving a bare exit code).

</details>

**Runtime invariants**: when the host `theme` service is missing or its API is unreachable the plugin only logs and never throws into the host; a projection still in flight after unload must not regrow the styles and backdrop layer (zombie theme); token layers are always written in pairs, with a one-sided gap taking the baseline value first and then falling back to the other side. These three are asserted directly by `test/client.test.mjs` and `test/host.test.mjs`.

## License

MIT
