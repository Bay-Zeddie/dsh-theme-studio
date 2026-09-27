window.__ModuleLoader__.load({
	id: "dsh-theme-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/identity.ts
		var PLUGIN_ID = "dsh-theme-studio";
		var TOKEN_SOURCE = "dsh-theme-studio";
		var LAYER_ID = "dts-backdrop";
		var STYLE_ID = "dts-layer-style";
		var CHROME_STYLE_ID = "dts-chrome-style";
		var MODAL_HOST_ID = "dts-modal-host";
		var DEFAULT_PREFIX = "/dsh-theme-studio";
		/**
		* 玻璃表面兜底清单：Host 的 glassSurfaces 是权威源，但随宿主启动装载（桌面端 / CLI 同一装载路径，改它要重启）。
		* 刷新即生效：新会话条（button-elevated-fill）与聊天气泡（specific-bubble）。
		*
		* ⚠️ 口径是"**别名层 + 两个点名放行的调色板基元**"。原先这里有
		* `--dsw-static-neutral-50` / `-100`，阶段 C/D 删除过一轮；**本轮（2026-09-27）
		* 按改造前副本恢复并补上解释** —— 这两个基元是宿主 ui-deliverables /
		* ui-schedule 四张"白面卡"的填充源，宿主 CSS Modules 在**卡片元素自身上**
		* 声明 `--changes-fill:var(--dsw-static-neutral-50)` 之类，**元素自身的声明
		* 永远压过从 `body` 继承的值**（宿主 Presenter 把令牌写成 body 行内样式）
		* ⇒ 只有沿 `var()` 链改基元才重铸得到那四张白面；**把局部变量塞进清单是空操作**。
		* 逐字实测的爆炸半径与四处同改要求见 `lib/engine.js` 的 `GLASS_SURFACES` 注释。
		*
		* 闸口只有一个：`isGlassSurfaceAllowed()`。清单、`app.ts` 的投影过滤、
		* `composeGlass()` 的运行时闸三处都调它，避免"改了清单却被某个闸静默挡掉"。
		*/
		var EXTRA_GLASS_SURFACES = [
			"--dsw-alias-button-elevated-fill",
			"--dsw-specific-bubble",
			"--dsw-specific-bubble-highlight",
			"--dsw-alias-bg-module-platform",
			"--dsw-specific-sidebar-nav-item-active",
			"--dsw-specific-sidebar-nav-item-hover",
			"--dsw-static-neutral-50",
			"--dsw-static-neutral-100",
			"--dsw-alias-button-floating-hover",
			"--dsw-alias-interactive-bg-hover",
			"--dsw-alias-interactive-bg-active",
			"--dsw-alias-button-tool-bar-fill",
			"--dsw-alias-button-tool-bar-hover",
			"--dsw-alias-markdown-tag",
			"--dsw-specific-menu",
			"--dsw-alias-interactive-bg-hover-solid",
			"--dsw-alias-button-ghost-active-fill"
		];
		/**
		* 玻璃清单的**唯一闸口**：哪些名字允许被玻璃重铸。
		*
		* 规则：别名层（`--dsw-alias-*` / `--dsw-specific-*`）与其它一切名字放行；
		* `--dsw-static-*` 调色板**大族**一律挡住（它们是"色"的定义处，绝大多数
		* 只该由宿主自己管），**只点名放行两个例外**：
		* `--dsw-static-neutral-50` / `-100` —— 宿主四张"白面卡"的填充源。
		*
		* 为什么必须是白名单而不是"前缀全挡"：那两个基元是局部变量
		* （`--changes-fill` 等）的 `var()` 上游，**只有改基元才重铸得到白面**
		* （局部变量在卡片元素自身上声明，压过从 body 继承的值）。
		*
		* 为什么要集中成一处：清单（`engine.js` / `EXTRA_GLASS_SURFACES`）、
		* `app.ts` 对宿主投影的过滤、`composeGlass()` 的运行时闸都要用同一个判据 ——
		* 分开写三份的话，改了一处会被另一处**静默**挡掉（实测踩过）。
		* @param name - 令牌名。
		* @returns 是否允许进玻璃重铸。
		*/
		var GLASS_PRIMITIVE_ALLOW = ["--dsw-static-neutral-50", "--dsw-static-neutral-100"];
		function isGlassSurfaceAllowed(name) {
			if (typeof name !== "string" || name === "") return false;
			if (name.indexOf("--dsw-static-") !== 0) return true;
			return GLASS_PRIMITIVE_ALLOW.indexOf(name) !== -1;
		}
		/**
		* 承载文字的"小色块"（hover/active 反馈、页签、工具条、菜单）：
		* 面积小但直接压字，普通表面的薄玻璃在亮壁纸上读不清 —— 玻璃浓度
		* 拉到可读档（≥0.55），其余表面仍跟随用户调的面板透明度。
		* @returns {number} 可读档浓度下限；0 = 普通表面
		*/
		function readableGlassFloor(name) {
			if (name.indexOf("hover") !== -1 || name.indexOf("active") !== -1 || name.indexOf("tool-bar") !== -1 || name.indexOf("markdown-tag") !== -1 || name === "--dsw-specific-menu") return .55;
			return 0;
		}
		var TAB_STORAGE_KEY = "dts:active-tab";
		//#endregion
		//#region src/client/i18n.ts
		var MESSAGES = {
			zh: {
				"section.title": "主题工坊",
				"section.intro": "给界面换背景图片与视频，逐令牌改配色、字体、圆角与玻璃质感；改动实时生效，随时可恢复默认。",
				"tab.presets": "预设",
				"tab.backdrop": "背景",
				"tab.library": "素材库",
				"tab.color": "色彩",
				"tab.type": "文字",
				"tab.shape": "形状与动效",
				"tab.advanced": "高级",
				"tab.profile": "我的方案",
				"preset.groupTitle": "选择预设",
				"shape.groupTitle": "圆角、动效与滚动条",
				"profile.groupTitle": "保存的方案",
				"profile.hint": "保存\"配色 + 背景 + 玻璃 + 字体\"的整体快照，随时一键切回。",
				"profile.namePh": "方案名称（如：午夜深蓝）",
				"profile.saveNew": "保存当前方案",
				"profile.apply": "应用",
				"profile.overwrite": "覆盖",
				"profile.del": "删除",
				"profile.background": "背景",
				"profile.empty": "还没有方案：把界面调成喜欢的样子，取个名字点「保存当前方案」。",
				"profile.saved": "已保存方案",
				"profile.applied": "已切换到方案",
				"profile.existsTitle": "覆盖已有方案？",
				"profile.existsBody": "同名方案会被当前配置替换。",
				"profile.deleteTitle": "删除主题档？",
				"profile.deleteBody": "只删除本机主题档，素材与当前界面不受影响。",
				"common.reset": "恢复默认",
				"common.saved": "已保存",
				"common.saving": "保存中…",
				"common.failed": "操作失败",
				"common.uploading": "上传中…",
				"common.close": "关闭",
				"common.fullscreen": "整窗全屏",
				"menu.undo": "撤销",
				"menu.redo": "重做",
				"menu.cut": "剪切",
				"menu.copy": "复制",
				"menu.paste": "粘贴",
				"menu.delete": "删除",
				"menu.selectAll": "全选",
				"menu.noop": "「{0}」这次没有可以作用的内容",
				"common.none": "无",
				"common.image": "图片",
				"common.video": "视频",
				"common.gradient": "渐变",
				"common.dropHere": "拖拽图片 / 视频 / 字体到此处上传（原样保存，不压缩）",
				"common.delete": "删除",
				"common.use": "设为背景",
				"common.uploaded": "上传完成",
				"common.empty": "还没有素材。把图片、视频或字体拖到上面即可。",
				"common.confirm": "确认",
				"common.cancel": "取消",
				"common.openPanel": "打开主题工坊",
				"base.scheme": "明暗模式",
				"base.system": "跟随系统",
				"base.light": "浅色",
				"base.dark": "深色",
				"base.fontSize": "对话字号",
				"base.hint": "明暗与字号直接驱动宿主 theme 服务，切换后所有面板同步。",
				"preset.note": "预设一次性写好配色与背景；之后每项仍可微调。",
				"preset.applied": "已套用预设",
				"backdrop.mode": "背景类型",
				"backdrop.pick": "选择素材",
				"backdrop.fit": "铺法",
				"backdrop.cover": "铺满（裁切）",
				"backdrop.contain": "完整显示（留边）",
				"backdrop.tile": "原始像素平铺（1px 都不缩放）",
				"backdrop.focus": "焦点位置",
				"backdrop.focusHint": "在画面上拖动决定裁切中心；X/Y 对应横向与纵向。",
				"backdrop.scale": "放大倍率",
				"backdrop.filters": "画面滤镜",
				"backdrop.blur": "模糊",
				"backdrop.brightness": "亮度",
				"backdrop.saturate": "饱和度",
				"backdrop.contrast": "对比度",
				"backdrop.grayscale": "去色",
				"backdrop.sepia": "复古",
				"backdrop.hueRotate": "色相旋转",
				"backdrop.veil": "压暗遮罩（保证正文可读）",
				"backdrop.dim": "遮罩浓度",
				"backdrop.veilColor": "遮罩颜色",
				"backdrop.veilGradient": "上轻下重渐变",
				"backdrop.motion": "动感",
				"backdrop.kenBurns": "缓慢推拉（Ken Burns）",
				"backdrop.kenBurnsSeconds": "推拉周期",
				"backdrop.parallax": "鼠标视差",
				"backdrop.videoTitle": "视频播放",
				"backdrop.muted": "静音",
				"backdrop.loop": "循环",
				"backdrop.autoplay": "自动播放",
				"backdrop.playbackRate": "倍速",
				"backdrop.fadeOnFocus": "输入时淡化背景",
				"backdrop.glassOn": "已顺手开启玻璃质感 —— 不透明的面板会把壁纸整个盖住；不需要可在本页关掉",
				"backdrop.hint": "素材按原始字节保存与回吐（HTTP Range），4K 图与视频都不会被重编码。",
				"glass.enabled": "玻璃质感",
				"glass.alpha": "面板透明度",
				"glass.blur": "面板模糊",
				"glass.saturate": "面板饱和",
				"glass.hint": "把表面令牌按基准色重铸成半透明，壁纸才真正透得出来。",
				"color.accent": "强调色",
				"color.accentHint": "只改主色/链接/选中态等派生令牌，不打乱既有版面层级。",
				"color.autoAccent": "从强调色派生相关令牌",
				"color.groups": "分组精修",
				"color.light": "浅色值",
				"color.dark": "深色值",
				"color.clear": "清除",
				"color.contrast": "正文对比度",
				"color.contrastHint": "WCAG：≥7 优秀，≥4.5 达标，低于 4.5 建议加深遮罩或调整文字色。",
				"color.custom": "自定义令牌",
				"color.customAdd": "添加",
				"color.customName": "--dsw-别名",
				"color.noToken": "（未设置）",
				"color.fromImage": "从背景图取色",
				"type.uiFont": "界面字体栈",
				"type.codeFont": "代码字体栈",
				"type.letterSpacing": "字距",
				"type.uploadFont": "上传字体（woff2 / woff / ttf / otf）",
				"type.families": "已上传字体",
				"type.useFamily": "用作界面字体",
				"type.useCodeFamily": "用作代码字体",
				"type.hint": "字体文件同样原样存储，@font-face 由本机路由供给，不依赖外网。",
				"shape.corner": "圆角曲率（超级椭圆指数）",
				"shape.cornerHint": "1=正圆弧，1.5=宿主默认，越大越方。",
				"shape.motion": "动效时长倍率",
				"shape.motionOff": "0 = 关闭动效",
				"shape.reduceMotion": "减少动态效果",
				"shape.scrollbar": "滚动条",
				"shape.native": "宿主默认",
				"shape.auto": "胶囊描边",
				"shape.slim": "极细",
				"shape.hidden": "隐藏",
				"adv.css": "追加自定义 CSS",
				"adv.cssHint": "最后注入，可覆盖上面的一切；只影响你自己的界面。",
				"adv.export": "导出主题 JSON",
				"adv.import": "导入主题 JSON",
				"adv.merge": "合并导入",
				"adv.mergeHint": "勾上则只覆盖 JSON 里出现的字段，其余保持现状；不勾则整份替换。",
				"adv.usage": "素材占用",
				"dialog.resetTitle": "恢复默认主题？",
				"dialog.resetBody": "当前配色、背景与素材引用会被重置；已上传的素材文件不会删除。",
				"dialog.deleteTitle": "删除这个素材？",
				"dialog.deleteBody": "文件会从磁盘移除，使用该素材的主题会失去背景。",
				"dialog.forceBody": "该素材正被当前主题引用，删除后背景会变空。",
				"dialog.forceFontBody": "该字体正被字体栈使用，删除后相关文字回退默认字体。",
				"err.offline": "连不上主题工坊的本地接口：确认宿主正在运行且主题工坊已加载，然后刷新页面重试。",
				"err.writeToken": "写口令缺失：刷新页面即可恢复。",
				"err.conflict": "主题刚被其它窗口改动过：已回到最新版本，你这次的修改没有保存。"
			},
			en: {
				"section.title": "Theme Studio",
				"section.intro": "Swap in image and video backdrops, retune colors per token, fonts, corners and glass — changes apply live and reset in one click.",
				"tab.presets": "Presets",
				"tab.backdrop": "Backdrop",
				"tab.library": "Library",
				"tab.color": "Colors",
				"tab.type": "Type",
				"tab.shape": "Shape & Motion",
				"tab.advanced": "Advanced",
				"tab.profile": "Profiles",
				"preset.groupTitle": "Choose a preset",
				"shape.groupTitle": "Corners, motion & scrollbar",
				"profile.groupTitle": "Saved profiles",
				"profile.hint": "A snapshot of colors + backdrop + glass + type — switch back with one click.",
				"profile.namePh": "Profile name (e.g. Midnight Blue)",
				"profile.saveNew": "Save current",
				"profile.apply": "Apply",
				"profile.overwrite": "Overwrite",
				"profile.del": "Delete",
				"profile.background": "Backdrop",
				"profile.empty": "No profiles yet: style the UI, name it, then hit \"Save current\".",
				"profile.saved": "Profile saved",
				"profile.applied": "Switched to profile",
				"profile.existsTitle": "Overwrite existing profile?",
				"profile.existsBody": "The profile with this name will be replaced by the current configuration.",
				"profile.deleteTitle": "Delete theme file?",
				"profile.deleteBody": "Only the saved file is removed; media and the live theme stay untouched.",
				"common.reset": "Reset",
				"common.saved": "Saved",
				"common.saving": "Saving…",
				"common.failed": "Operation failed",
				"common.uploading": "Uploading…",
				"common.close": "Close",
				"common.fullscreen": "Fullscreen",
				"menu.undo": "Undo",
				"menu.redo": "Redo",
				"menu.cut": "Cut",
				"menu.copy": "Copy",
				"menu.paste": "Paste",
				"menu.delete": "Delete",
				"menu.selectAll": "Select All",
				"menu.noop": "Nothing for \"{0}\" to act on this time",
				"common.none": "None",
				"common.image": "Image",
				"common.video": "Video",
				"common.gradient": "Gradient",
				"common.dropHere": "Drop images / videos / fonts here (stored byte-for-byte, never recompressed)",
				"common.delete": "Delete",
				"common.use": "Set as backdrop",
				"common.uploaded": "Uploaded",
				"common.empty": "No material yet. Drop an image, video or font above.",
				"common.confirm": "Confirm",
				"common.cancel": "Cancel",
				"common.openPanel": "Open Theme Studio",
				"base.scheme": "Color scheme",
				"base.system": "System",
				"base.light": "Light",
				"base.dark": "Dark",
				"base.fontSize": "Content font size",
				"base.hint": "Scheme and font size drive the host theme service, so every panel follows.",
				"preset.note": "A preset writes colors and backdrop at once; every knob stays adjustable afterwards.",
				"preset.applied": "Preset applied",
				"backdrop.mode": "Backdrop type",
				"backdrop.pick": "Pick material",
				"backdrop.fit": "Fit",
				"backdrop.cover": "Cover (crop)",
				"backdrop.contain": "Contain (letterbox)",
				"backdrop.tile": "Tile at native pixels (no scaling)",
				"backdrop.focus": "Focus point",
				"backdrop.focusHint": "Drag on the preview to choose the crop centre; X and Y are horizontal and vertical.",
				"backdrop.scale": "Zoom",
				"backdrop.filters": "Filters",
				"backdrop.blur": "Blur",
				"backdrop.brightness": "Brightness",
				"backdrop.saturate": "Saturation",
				"backdrop.contrast": "Contrast",
				"backdrop.grayscale": "Grayscale",
				"backdrop.sepia": "Sepia",
				"backdrop.hueRotate": "Hue rotate",
				"backdrop.veil": "Dim veil (keeps text readable)",
				"backdrop.dim": "Veil strength",
				"backdrop.veilColor": "Veil color",
				"backdrop.veilGradient": "Heavier toward bottom",
				"backdrop.motion": "Motion",
				"backdrop.kenBurns": "Slow zoom (Ken Burns)",
				"backdrop.kenBurnsSeconds": "Zoom period",
				"backdrop.parallax": "Pointer parallax",
				"backdrop.videoTitle": "Video playback",
				"backdrop.muted": "Muted",
				"backdrop.loop": "Loop",
				"backdrop.autoplay": "Autoplay",
				"backdrop.playbackRate": "Rate",
				"backdrop.fadeOnFocus": "Fade backdrop while typing",
				"backdrop.glassOn": "Glass surfaces switched on — opaque panels would cover the backdrop entirely; turn it off here if unwanted",
				"backdrop.hint": "Materials are stored and served as original bytes over HTTP Range — 4K stills and video are never re-encoded.",
				"glass.enabled": "Glass surfaces",
				"glass.alpha": "Surface opacity",
				"glass.blur": "Surface blur",
				"glass.saturate": "Surface saturation",
				"glass.hint": "Rebuilds surface tokens from their base color with alpha, so the backdrop actually shows through.",
				"color.accent": "Accent color",
				"color.accentHint": "Rewrites primary / link / selection tokens only; layout hierarchy stays intact.",
				"color.autoAccent": "Derive related tokens from accent",
				"color.groups": "Grouped tuning",
				"color.light": "Light",
				"color.dark": "Dark",
				"color.clear": "Clear",
				"color.contrast": "Text contrast",
				"color.contrastHint": "WCAG: ≥7 excellent, ≥4.5 acceptable; below 4.5 add veil or darken text.",
				"color.custom": "Custom tokens",
				"color.customAdd": "Add",
				"color.customName": "--dsw-alias",
				"color.noToken": "(none)",
				"color.fromImage": "Sample from backdrop",
				"type.uiFont": "UI font stack",
				"type.codeFont": "Code font stack",
				"type.letterSpacing": "Letter spacing",
				"type.uploadFont": "Upload font (woff2 / woff / ttf / otf)",
				"type.families": "Uploaded fonts",
				"type.useFamily": "Use as UI font",
				"type.useCodeFamily": "Use as code font",
				"type.hint": "Fonts are stored verbatim too; @font-face is served by the local route, with no CDN.",
				"shape.corner": "Corner curvature (superellipse exponent)",
				"shape.cornerHint": "1 = circular arc, 1.5 = host default, larger = squarish.",
				"shape.motion": "Motion duration scale",
				"shape.motionOff": "0 = motion off",
				"shape.reduceMotion": "Reduce motion",
				"shape.scrollbar": "Scrollbar",
				"shape.native": "Host default",
				"shape.auto": "Pill border",
				"shape.slim": "Slim",
				"shape.hidden": "Hidden",
				"adv.css": "Extra custom CSS",
				"adv.cssHint": "Injected last, so it overrides everything above; affects your own shell only.",
				"adv.export": "Export theme JSON",
				"adv.import": "Import theme JSON",
				"adv.merge": "Merge import",
				"adv.mergeHint": "When ticked, only fields present in the JSON are overwritten; otherwise the whole document is replaced.",
				"adv.usage": "Material usage",
				"dialog.resetTitle": "Reset to the default theme?",
				"dialog.resetBody": "Colors, backdrop and media references reset; uploaded material files are kept.",
				"dialog.deleteTitle": "Delete this material?",
				"dialog.deleteBody": "The file is removed from disk and any theme using it loses its backdrop.",
				"dialog.forceBody": "The active theme references this material; the backdrop goes empty after deletion.",
				"dialog.forceFontBody": "This font is used by a font stack; affected text falls back to defaults after deletion.",
				"err.offline": "Cannot reach the local Theme Studio API: make sure the host is running with Theme Studio loaded, then reload the page.",
				"err.writeToken": "Missing write token: reload the page to restore it.",
				"err.conflict": "The theme just changed in another window: back to the latest version, your last edit was not saved."
			}
		};
		function normalizeLang(value) {
			var tag = String(value || "").toLowerCase();
			if (tag.indexOf("zh") === 0) return "zh";
			if (tag.indexOf("en") === 0) return "en";
			return "";
		}
		/** 我们的词典命名空间 = 包名（官方惯例是插件自有名，如 `chat` / `settings.theme`）。 */
		var LOCALE_NS = "dsh-theme-studio";
		/**
		* 官方 locale 服务切片。**必须住在工厂作用域**：模块级 t() 要现读它，
		* 关进 apply() 会让 apply 之外的一切 t() 调用直接 ReferenceError。
		* 它是可选依赖（不写进 exports.inject），服务缺席时整条链降级到本地词典。
		*/
		var localeService = null;
		/** apply() 时的 cordis ctx：服务在 apply 之后才挂载时，靠它按需重取一次。 */
		var localeCtx = null;
		var boundT = null;
		var boundTNs = "";
		var boundTAt = null;
		/**
		* 跨模块可变：apply() 装配时赋值（ESM import 绑定只读，走存取器）。
		* @param next 官方 locale 服务（可空 —— 缺席就走降级链）
		* @param context 取服务用的 cordis ctx（可空）
		*/
		function setLocaleService(next, context) {
			localeService = next || null;
			localeCtx = context || null;
			boundT = null;
			boundTNs = "";
			boundTAt = null;
		}
		/** 取服务：显式句柄优先，其次向 ctx 再问一次（激活顺序未知时自愈）。 */
		function getLocaleService() {
			if (localeService) return localeService;
			if (!localeCtx || typeof localeCtx.get !== "function") return null;
			try {
				var late = localeCtx.get("locale") || null;
				if (late) localeService = late;
				return late;
			} catch (err) {
				return null;
			}
		}
		/**
		* 官方文案函数：`ctx.locale.bind(ns)` 的等价物，**按 revision 缓存**
		* （官方 renderer 的 localeSeat 同样以 revision 为缓存键：revision 变则重取）。
		* @returns 官方 t 或 null（服务不可用 / 无 bind）
		*/
		function boundTranslate() {
			var svc = getLocaleService();
			if (!svc || typeof svc.bind !== "function") return null;
			var revision = null;
			try {
				var snapshot = typeof svc.getSnapshot === "function" ? svc.getSnapshot() : null;
				revision = snapshot ? snapshot.revision : null;
			} catch (err) {
				revision = null;
			}
			if (boundT !== null && boundT !== void 0 && boundTNs === "dsh-theme-studio" && boundTAt === revision) return boundT;
			var next = null;
			try {
				next = svc.bind(LOCALE_NS);
			} catch (err) {
				return null;
			}
			if (typeof next !== "function") return null;
			boundT = next;
			boundTNs = LOCALE_NS;
			boundTAt = revision;
			return next;
		}
		/**
		* 位置参数 → 官方具名参数对象。`t('menu.noop', label)` 折成 `{ '0': label }`，
		* 好让官方 `{(\w+)}` 正则命中本表的 `{0}`。
		*/
		function paramsFor(args) {
			if (args.length === 0) return null;
			var params = {};
			for (var i = 0; i < args.length; i += 1) params[String(i)] = args[i];
			return params;
		}
		/** 本地词典查询（降级链与官方未命中时的第二源，与注册进官方的是同一对象）。 */
		function localTemplate(key) {
			var dict = MESSAGES[currentLang()] || MESSAGES.zh;
			return dict[key] !== void 0 ? dict[key] : MESSAGES.zh[key];
		}
		/**
		* 当前语言。**权威源是官方 locale 服务，不是 <html lang>。**
		* 服务端 HTML 写死 lang="en"，要等 locale 插件激活后才异步改写；
		* 只认 <html lang> 会在早于改写时永远拿到 en，观察器若挂在写入之后
		* 就再也收不到那一次变化 —— 界面永久停在英文且无自愈通道。
		* 顺序：locale 服务 → <html lang> → navigator.language，且必须每次现读。
		* 降级链只在服务不可用时才是主路径（官方规范里语言权威源就是 locale 服务）。
		*/
		function currentLang() {
			try {
				var svc = getLocaleService();
				var snapshot = svc && typeof svc.getSnapshot === "function" ? svc.getSnapshot() : null;
				var fromService = normalizeLang(snapshot && snapshot.active);
				if (fromService !== "") return fromService;
				var fromDoc = normalizeLang(document.documentElement.lang);
				if (fromDoc !== "") return fromDoc;
				var fromNav = normalizeLang(navigator.language);
				if (fromNav !== "") return fromNav;
				return "zh";
			} catch (err) {
				return "zh";
			}
		}
		/**
		* 取文案：**优先走官方 API**（`ctx.locale.bind(ns)` 的绑定函数），
		* 官方不可用（Electron 壳 / locale 插件缺席）或未命中该键时，
		* 才用本地 MESSAGES 与 `{n}` 顺序替换兜底 —— 兜底不是主路径。
		*
		* 官方 translate 未命中时返回键名本身（client.js:1425 `?? key`），
		* 与本地两语言都缺键时的回退逐字相同，所以"缺键回退键名"这条契约不变。
		* ⚠️ 参数仍是位置式的：带 `{0}` `{1}` 占位的文案按顺序多传 `t('key', a, b)`，
		* 内部折成官方具名参数 `{ '0': a }` 再交给官方正则。
		*/
		function t(key, ...args) {
			var params = paramsFor(args);
			var official = boundTranslate();
			if (official !== null) {
				var value;
				try {
					value = official(key, args.length > 0 && params ? params : void 0);
				} catch (err) {
					value = void 0;
				}
				if (typeof value === "string") {
					if (value !== key) return value;
				} else if (value !== void 0 && value !== null) return value;
			}
			var local = localTemplate(key);
			if (local === void 0) return String(key);
			if (typeof local === "function") return local.apply(null, args);
			if (args.length === 0) return local;
			return String(local).replace(/\{(\d+)\}/g, function(whole, index) {
				var at = Number(index);
				return at < args.length ? String(args[at]) : whole;
			});
		}
		/**
		* 把本模块的词典按官方签名注册进 locale 服务。
		* @param service 官方 locale 服务（可空）
		* @returns 官方 disposer（撤销本次词典注册）或 null
		*/
		function registerLocaleDictionary(service) {
			if (!service || typeof service.register !== "function") return null;
			return service.register(LOCALE_NS, {
				zh: MESSAGES.zh,
				en: MESSAGES.en
			});
		}
		/**
		* 订阅官方 locale 的 **revision** 变化（换语言与词典注册都会 +1）。
		* 官方订阅者不接收参数，所以回调里现读 getSnapshot()。
		* @param service 官方 locale 服务（可空）
		* @param handler 变化回调（读快照用）
		* @returns unsubscribe 或 null
		*/
		function subscribeLocaleChanges(service, handler) {
			if (!service || typeof service.subscribe !== "function") return null;
			return service.subscribe(function() {
				handler();
			});
		}
		//#endregion
		//#region lib/color-core.js
		/**
		* 颜色核心（唯一真源）：Host 引擎（lib/engine.js）与浏览器半（src/client/*.ts）共享。
		*
		* 历史：两端曾各养一份实现（D3），0.36 明暗阈值与 WCAG 通道公式两处手抄，
		* 连 round2 口径都漂移过（client 曾输出全精度）。如今 Host 侧走真 ESM import、
		* 浏览器侧由构建期 alwaysBundle 内联进产物 —— 源码一份，运行时同一套口径。
		*
		* 零依赖、纯函数；数值口径 round2 是与 client 交叉锁钉死的契约，不得单边修改。
		*/
		/** CSS 颜色解析白名单形态。 */
		const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
		function clamp$1(v, lo, hi) {
			return Math.max(lo, Math.min(hi, v));
		}
		function clamp01(v) {
			return Math.max(0, Math.min(1, v));
		}
		function clamp255(v) {
			return Math.max(0, Math.min(255, v));
		}
		function round2(v) {
			return Math.round(v * 100) / 100;
		}
		function pair(hex) {
			return Number.parseInt(hex + hex, 16);
		}
		function hue2rgb(p, q, t) {
			let value = t;
			if (value < 0) value += 1;
			if (value > 1) value -= 1;
			if (value < 1 / 6) return p + (q - p) * 6 * value;
			if (value < 1 / 2) return q;
			if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
			return p;
		}
		function hslToRgb(h, s, l) {
			const hh = (h % 360 + 360) % 360 / 360;
			const ss = clamp01(s / 100);
			const ll = clamp01(l / 100);
			if (ss === 0) {
				const v = Math.round(ll * 255);
				return {
					r: v,
					g: v,
					b: v
				};
			}
			const q = ll < .5 ? ll * (1 + ss) : ll + ss - ll * ss;
			const p = 2 * ll - q;
			return {
				r: Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
				g: Math.round(hue2rgb(p, q, hh) * 255),
				b: Math.round(hue2rgb(p, q, hh - 1 / 3) * 255)
			};
		}
		/**
		* 解析 CSS 颜色为 {r,g,b,a}。支持 #hex / rgb[a]() / hsl[a]() / transparent。
		* @param {unknown} value
		* @returns {{r:number,g:number,b:number,a:number}|null}
		*/
		function parseColor(value) {
			if (typeof value !== "string") return null;
			const text = value.trim().toLowerCase();
			if (text === "transparent") return {
				r: 0,
				g: 0,
				b: 0,
				a: 0
			};
			if (HEX_RE.test(text)) {
				const body = text.slice(1);
				if (body.length === 3 || body.length === 4) return {
					r: pair(body[0]),
					g: pair(body[1]),
					b: pair(body[2]),
					a: body.length === 4 ? round2(pair(body[3]) / 255) : 1
				};
				return {
					r: Number.parseInt(body.slice(0, 2), 16),
					g: Number.parseInt(body.slice(2, 4), 16),
					b: Number.parseInt(body.slice(4, 6), 16),
					a: body.length === 8 ? round2(Number.parseInt(body.slice(6, 8), 16) / 255) : 1
				};
			}
			const fn = /^(rgba?|hsla?)\(([^)]+)\)$/.exec(text);
			if (fn === null) return null;
			const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
			if (parts.length < 3) return null;
			const isHsl = fn[1].startsWith("hsl");
			const nums = parts.slice(0, 3).map((token, index) => {
				const n = Number.parseFloat(token);
				if (Number.isNaN(n)) return NaN;
				if (!token.endsWith("%")) return n;
				return isHsl && index > 0 ? n : n / 100 * 255;
			});
			if (nums.some(Number.isNaN)) return null;
			const rgb = fn[1] === "rgb" || fn[1] === "rgba" ? {
				r: nums[0],
				g: nums[1],
				b: nums[2]
			} : hslToRgb(nums[0], nums[1], nums[2]);
			const alphaToken = parts[3];
			const alpha = alphaToken === void 0 ? 1 : alphaToken.endsWith("%") ? Number.parseFloat(alphaToken) / 100 : Number.parseFloat(alphaToken);
			if (Number.isNaN(alpha)) return null;
			return {
				r: clamp255(rgb.r),
				g: clamp255(rgb.g),
				b: clamp255(rgb.b),
				a: clamp01(alpha)
			};
		}
		/** rgb → hsl（h 0..360，s/l 0..100；round2 口径是双端交叉锁契约）。 */
		function rgbToHsl({ r, g, b }) {
			const rr = r / 255;
			const gg = g / 255;
			const bb = b / 255;
			const max = Math.max(rr, gg, bb);
			const min = Math.min(rr, gg, bb);
			const l = (max + min) / 2;
			if (max === min) return {
				h: 0,
				s: 0,
				l: round2(l * 100)
			};
			const d = max - min;
			const s = l > .5 ? d / (2 - max - min) : d / (max + min);
			let h;
			if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
			else if (max === gg) h = ((bb - rr) / d + 2) / 6;
			else h = ((rr - gg) / d + 4) / 6;
			return {
				h: round2(h * 360),
				s: round2(s * 100),
				l: round2(l * 100)
			};
		}
		/** HSL → #rrggbb（取色器与强调色派生共用）。 */
		function hslToHex(h, s, l) {
			return toHex(hslToRgb(h, s, l));
		}
		/** 以 #rrggbb 输出（收颜色对象或任意可解析字符串）。 */
		function toHex(color) {
			const c = typeof color === "string" ? parseColor(color) : color;
			if (c === null || c === void 0) return "#000000";
			const hex = (v) => Math.round(clamp255(v)).toString(16).padStart(2, "0");
			return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
		}
		/** 输出 rgba(r, g, b, a)；换不透明度保持 RGB（玻璃重铸的底座）。 */
		function rgba(color, alpha) {
			const c = typeof color === "string" ? parseColor(color) : color;
			if (c === null || c === void 0) return "rgba(0, 0, 0, 0)";
			return `rgba(${Math.round(clamp255(c.r))}, ${Math.round(clamp255(c.g))}, ${Math.round(clamp255(c.b))}, ${round2(clamp01(alpha))})`;
		}
		/** WCAG 相对亮度。 */
		function luminance(color) {
			const c = typeof color === "string" ? parseColor(color) : color;
			if (c === null || c === void 0) return 0;
			const channel = (v) => {
				const s = v / 255;
				return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
			};
			return .2126 * channel(c.r) + .7152 * channel(c.g) + .0722 * channel(c.b);
		}
		/** WCAG 对比度（1..21）。 */
		function contrastRatio(a, b) {
			const la = luminance(a);
			const lb = luminance(b);
			return round2((Math.max(la, lb) + .05) / (Math.min(la, lb) + .05));
		}
		//#endregion
		//#region src/client/utils.ts
		var relativeLuminance = luminance;
		/** 只改不透明度，RGB 原样保留；解析不了（var(...) 等）就原样返回。 */
		function withAlphaCss(value, alpha) {
			if (parseColor(value) === null) return value;
			return rgba(value, alpha);
		}
		function humanBytes(bytes) {
			var n = Number(bytes);
			if (!Number.isFinite(n) || n <= 0) return "0 B";
			var units = [
				"B",
				"KB",
				"MB",
				"GB",
				"TB"
			];
			var i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
			var value = n / Math.pow(1024, i);
			return (value >= 100 ? Math.round(value) : Math.round(value * 10) / 10) + " " + units[i];
		}
		/**
		* media 字典查表。必须 hasOwn：media 是 JSON 反序列化的普通对象，
		* 'constructor'/'toString' 这类原型键取出的是函数不是素材元数据
		* （曾把 Object 构造函数当 meta 拼出 /media/undefined 的死视频）。
		*/
		function mediaLookup(media, id) {
			if (media === null || typeof media !== "object") return void 0;
			return Object.hasOwn(media, id) ? media[id] : void 0;
		}
		/** 只存界面偏好（当前页签这类），主题数据一律在宿主。 */
		function readLocal(key) {
			try {
				return window.localStorage.getItem(key);
			} catch (err) {
				return null;
			}
		}
		function writeLocal(key, value) {
			try {
				window.localStorage.setItem(key, String(value));
			} catch (err) {}
		}
		//#endregion
		//#region src/client/deps.ts
		var React$1 = require("react");
		try {
			require("react-dom/client");
		} catch (err) {}
		/**
		* createElement 简写。
		* ⚠️ 必须是函数声明而不是箭头 —— 要用 arguments 收可变子节点，
		* 箭头函数没有自己的 arguments（node --check 抓不到，只在运行时炸）。
		*/
		function e$1(type, props, ..._children) {
			var children = Array.prototype.slice.call(arguments, 2);
			return React$1.createElement.apply(React$1, [type, props].concat(children));
		}
		const useState$1 = React$1.useState;
		const useEffect$1 = React$1.useEffect;
		const useRef$1 = React$1.useRef;
		const useCallback$1 = React$1.useCallback;
		const useSyncExternalStore = React$1.useSyncExternalStore;
		//#endregion
		//#region src/client/store.ts
		function createStore(initial) {
			var snapshot = initial;
			/** 订阅者集合：显式标注，否则 Set<unknown> 让 fn() 不可调用。 */
			var listeners = /* @__PURE__ */ new Set();
			return {
				get: function() {
					return snapshot;
				},
				set: function(next) {
					if (next === snapshot) return;
					snapshot = next;
					listeners.forEach(function(fn) {
						fn();
					});
				},
				update: function(patch) {
					this.set(Object.assign({}, snapshot, typeof patch === "function" ? patch(snapshot) : patch));
				},
				subscribe: function(fn) {
					listeners.add(fn);
					return function() {
						listeners.delete(fn);
					};
				}
			};
		}
		function useSlice(store) {
			var read = useCallback$1(store.get, [store]);
			var subscribe = useCallback$1(store.subscribe, [store]);
			return useSyncExternalStore(subscribe, read, read);
		}
		//#endregion
		//#region src/client/probe-glass.ts
		/**
		* ── 取数路径（阶段 C/D 改写，见报告 §2）─────────────────────────────
		*
		* ① **官方服务（主路径）**：`ctx.theme.getTheme()` → `ThemeSnapshot`
		*      `{ preference, fontSize, active: ThemeDefinition, themes, revision }`
		*      `ThemeDefinition = { id, colorScheme: 'light'|'dark', tokens: Record<string,string> }`
		*    把 `themes` 按 `colorScheme` 分组就拿到**亮/暗两套基准值**（每个内置主题
		*    自带整张令牌表），`active.tokens` 只用来**补 `themes` 里没有的名字**。
		*    这正是官方自己发布的读法 —— 服务描述逐字：
		*      "Reads go through getTheme; preference writes only through setTheme;
		*       continuous sync only through the `theme/change` event."
		*
		*    ⚠️ **为什么 `themes` 在前、`active` 在后**：`getTheme().active.tokens` 是
		*    **按覆盖层合成后**的视图（我们自己的 `overrideTokens` 层也在里面），拿它当
		*    基准会形成"读自己写过的值 → 再算一遍"的反馈环。`themes` 是注册表里的**基础
		*    主题定义**（`overrideTokens` 的 JSDoc 逐字："the base theme stays untouched"），
		*    所以基础值一律以它为准，`active` 只补缺。
		*
		* ② **样式表扫描（兜底，⚠️ 合规上有瑕疵）**：官方服务拿不到（宿主版本较老 /
		*    服务未挂载 / `getTheme` 抛错 / 只回一侧）时，回退到原来的做法 —— 遍历
		*    `document.styleSheets` 的 `cssRules`，按 `body` 与 `body[data-ds-dark-theme]`
		*    两条规则抓自定义属性，一次拿两套基准。
		*    ⚠️ **这条兜底正是 `references_ui-plugin.md:13` 明文点名的 stylesheet 读取**
		*    （"Do not read another plugin's DOM, **stylesheet**, or component source
		*    to estimate placement"）。**严格合规要求删掉它**；保留它的理由是**视觉取舍**：
		*    删掉后若官方服务在某个宿主版本上不返回表面基准色，玻璃重铸会静默退化为
		*    "只保证当前模式准确"（README 已如实记录这一档）。**删不删由主人定** ——
		*    本轮按要求"官方优先 + 保留兜底"，并把这条写进代码注释与报告，不做静默处理。
		*
		* ③ `probe.source()` 暴露本轮**实际**走的是哪条路径
		*    （`'theme-service'` | `'stylesheet-scan'`）：合规状态必须**可观测**，
		*    而不是靠读代码猜。测试也按它正向锁"官方优先"。
		*/
		function createTokenProbe(services) {
			var cache = null;
			var nameCache = null;
			var service = services && typeof services.theme === "function" ? services.theme : null;
			/** ctx.theme 可能在本插件 apply 之后才挂载 → 每次现取，取不到不算错。 */
			function themeService() {
				if (service === null) return null;
				try {
					var found = service();
					return found && typeof found.getTheme === "function" ? found : null;
				} catch (err) {
					return null;
				}
			}
			function safeRules(sheet) {
				try {
					return sheet.cssRules || null;
				} catch (err) {
					return null;
				}
			}
			/** 把一张 ThemeDefinition 的 tokens 并进某一侧（非字符串一律忽略）。 */
			function absorb(target, tokens) {
				if (!tokens || typeof tokens !== "object") return;
				Object.keys(tokens).forEach(function(name) {
					var value = tokens[name];
					if (typeof value !== "string" || value === "") return;
					target[name] = value.trim();
				});
			}
			/** ① 官方服务。两侧都拿到才认（只拿到一侧说明服务形态不符，交给兜底）。 */
			function fromService() {
				var found = themeService();
				if (found === null) return null;
				var snapshot = null;
				try {
					snapshot = found.getTheme();
				} catch (err) {
					return null;
				}
				if (!snapshot || typeof snapshot !== "object") return null;
				var light = {};
				var dark = {};
				var themes = Array.isArray(snapshot.themes) ? snapshot.themes : [];
				for (var i = 0; i < themes.length; i += 1) {
					var definition = themes[i];
					if (!definition || typeof definition !== "object") continue;
					if (definition.colorScheme === "dark") absorb(dark, definition.tokens);
					else if (definition.colorScheme === "light") absorb(light, definition.tokens);
				}
				var active = snapshot.active;
				if (active && typeof active === "object") {
					var side = active.colorScheme === "dark" ? dark : light;
					var extra = active.tokens;
					if (extra && typeof extra === "object") Object.keys(extra).forEach(function(name) {
						if (side[name] !== void 0) return;
						var value = extra[name];
						if (typeof value === "string" && value !== "") side[name] = value.trim();
					});
				}
				if (Object.keys(light).length === 0 || Object.keys(dark).length === 0) return null;
				return {
					light,
					dark,
					source: "theme-service"
				};
			}
			/** ② 样式表扫描（兜底，见卷首 ② 的合规说明）。 */
			function fromStyleSheets() {
				var light = {};
				var dark = {};
				try {
					var sheets = document.styleSheets;
					for (var i = 0; i < sheets.length; i += 1) {
						var rules = safeRules(sheets[i]);
						if (rules === null) continue;
						for (var j = 0; j < rules.length; j += 1) {
							var rule = rules[j];
							var selector = rule.selectorText;
							if (typeof selector !== "string" || !rule.style) continue;
							var isDark = /\[data-ds-dark-theme\]/.test(selector);
							var isLight = /(^|,)\s*body\s*(,|$)/.test(selector) && !isDark;
							if (!isDark && !isLight) continue;
							var target = isDark ? dark : light;
							for (var k = 0; k < rule.style.length; k += 1) {
								var name = rule.style[k];
								if (name.indexOf("--") !== 0) continue;
								var value = rule.style.getPropertyValue(name);
								if (value) target[name] = value.trim();
							}
						}
					}
				} catch (err) {}
				return {
					light,
					dark,
					source: "stylesheet-scan"
				};
			}
			function scan() {
				if (cache !== null) return cache;
				cache = fromService() || fromStyleSheets();
				return cache;
			}
			function live(name) {
				try {
					return getComputedStyle(document.body).getPropertyValue(name).trim();
				} catch (err) {
					return "";
				}
			}
			function isColorLiteral(value) {
				return typeof value === "string" && (value.indexOf("#") === 0 || value.indexOf("rgb") === 0 || value.indexOf("hsl") === 0);
			}
			/**
			* 表内解析 var() 引用：design-platform 的 alias 层全是 var(--dsw-static-…) 形态
			* （实测 elevated-fill 玻璃失效的根因之一），static 层的字面量就在同一张表里，
			* 纯表内递归即可拿到基准，不闪屏也不依赖当前模式。
			*/
			function resolveVar(value, scheme, depth) {
				if (typeof value !== "string" || depth > 3) return "";
				var m = /^var\((--[a-z0-9-]+)\)$/i.exec(value.trim());
				if (!m) return value;
				return resolveVar(scan()[scheme][m[1]] || "", scheme, depth + 1);
			}
			return {
				of: function(name, scheme) {
					var found = resolveVar(scan()[scheme][name] || "", scheme, 0);
					if (isColorLiteral(found)) return found;
					if (liveScheme === scheme) {
						var value = live(name);
						if (isColorLiteral(value)) return value;
					}
					var altLight = resolveVar(scan().light[name] || "", "light", 0);
					if (isColorLiteral(altLight)) return altLight;
					var altDark = resolveVar(scan().dark[name] || "", "dark", 0);
					return isColorLiteral(altDark) ? altDark : "";
				},
				names: function() {
					if (nameCache !== null) return nameCache;
					var found = scan();
					var set = /* @__PURE__ */ new Set();
					Object.keys(found.light).forEach(function(k) {
						set.add(k);
					});
					Object.keys(found.dark).forEach(function(k) {
						set.add(k);
					});
					nameCache = Array.from(set).sort();
					return nameCache;
				},
				/** 本轮实际走通的取数路径：'theme-service'（官方优先）| 'stylesheet-scan'（兜底）。 */
				source: function() {
					return scan().source;
				},
				invalidate: function() {
					cache = null;
					nameCache = null;
				}
			};
		}
		var liveScheme = "light";
		function setLiveScheme(next) {
			liveScheme = next;
		}
		/** Host 给的令牌层可能只填了一侧（用户只改了深色），这里补成对：基准值优先，否则另一侧。 */
		function fillTokenPairs(layers, probe) {
			var out = {};
			Object.keys(layers || {}).forEach(function(name) {
				var pair = layers[name] || {};
				var light = typeof pair.light === "string" ? pair.light : "";
				var dark = typeof pair.dark === "string" ? pair.dark : "";
				if (light === "" && dark === "") return;
				if (light === "") light = probe.of(name, "light") || dark;
				if (dark === "") dark = probe.of(name, "dark") || light;
				if (light === "" || dark === "") return;
				out[name] = {
					light,
					dark
				};
			});
			return out;
		}
		/**
		* 玻璃质感：把表面基准色按 alpha 重铸；用户显式写过的令牌让位。
		* **对比自愈**：基准色与文字色对比不足 4.5:1 时翻到对比侧（白字配深玻璃、
		* 深字配浅玻璃）——否则"白底白字"整块隐形（设置面板/新会话实测都看不清）。
		*/
		function composeGlass(surfaces, doc, probe, explicit) {
			var out = {};
			if (!doc.glass || !doc.glass.enabled || doc.backdrop.mode === "none") return out;
			var userTokens = explicit || {};
			var fgOf = function(scheme) {
				var own = userTokens["--dsw-alias-label-primary"];
				if (own && typeof own[scheme] === "string" && own[scheme] !== "") return own[scheme];
				return probe.of("--dsw-alias-label-primary", scheme);
			};
			(surfaces || []).forEach(function(name) {
				if (userTokens[name] !== void 0) return;
				if (!isGlassSurfaceAllowed(name)) return;
				var light = probe.of(name, "light");
				var dark = probe.of(name, "dark");
				if (light === "" && dark === "") return;
				var floor = readableGlassFloor(name);
				var alpha = floor > 0 ? Math.min(.9, Math.max(doc.glass.alpha * 2.5, floor)) : Math.min(.9, doc.glass.alpha);
				out[name] = {
					light: glassColor(light === "" ? dark : light, fgOf("light"), alpha),
					dark: glassColor(dark === "" ? light : dark, fgOf("dark"), alpha)
				};
			});
			return out;
		}
		/**
		* 玻璃基准 × alpha；与文字对比不足 4.5:1 就翻到对比侧。
		*
		* ⚠️ 翻深侧现在**返回透明** —— 但**透明不再是玻璃的默认语义**：
		* 阶段 C/D 起，玻璃面的"色"来自官方 `--dsw-menu-surface-fill`（半透明中性填充），
		* 这里只在"基准色与文字对比不足"这一个自愈分支里翻深（那种情况下半透明中性色
		* 压不住文字）。历史：前四轮这里塞过近黑（亮度 0.0068）→ 深蓝灰，
		* 每次都是"换一块不那么难看的实心板"，实度一到 .72 就等于**72% 是我们选的
		* 颜色、壁纸只剩 28%**，玻璃的颜色自然与壁纸脱节。
		*/
		function glassColor(bg, fg, alpha) {
			if (typeof bg !== "string" || bg === "") return bg;
			if (fg !== "" && contrastRatio(bg, fg) >= 4.5) return withAlphaCss(bg, alpha);
			if (fg === "" ? true : relativeLuminance(fg) > .36) return "transparent";
			return withAlphaCss("rgb(250, 250, 252)", alpha);
		}
		/** 文字族对比自愈涉及的次级文字令牌（按层级给半透明度）。
		*  caption 是输入框 placeholder 的底色来源：0.62 太淡（输入字看不清实测），
		*  提到 0.82 保 placeholder 可读；其余档保持层次差。
		*  ⚠️ primary-dimmed / primary-bluish 是漏网暗字：白字主题下基准仍是
		*  暗色（#151517 / #0e3074），压深玻璃底看不见（排队消息预览"选择才看清"实测）。 */
		var TEXT_FAMILY = {
			"--dsw-alias-label-primary-dimmed": .88,
			"--dsw-alias-label-primary-bluish": .85,
			"--dsw-alias-label-caption": .82,
			"--dsw-alias-label-secondary": .75,
			"--dsw-alias-label-tertiary": .55,
			"--dsw-alias-label-dimmed": .45
		};
		/**
		* 文字族对比自愈：白字主题常只设 label-primary，次级文字留默认暗灰 ——
		* 暗字在深玻璃上完全不可读（产出卡"已输出 N 个文件"实测）。按主文字方向
		* 翻成同向半透明；用户显式写过的让位。
		*/
		function fixTextFamily(merged, userTokens, probe) {
			var own = userTokens || {};
			["light", "dark"].forEach(function(scheme) {
				var primary = own["--dsw-alias-label-primary"];
				var fg = primary && typeof primary[scheme] === "string" && primary[scheme] !== "" ? primary[scheme] : probe.of("--dsw-alias-label-primary", scheme);
				if (fg === "") return;
				var lightText = relativeLuminance(fg) > .36;
				Object.keys(TEXT_FAMILY).forEach(function(name) {
					if (own[name] !== void 0) return;
					if (!merged[name]) merged[name] = {
						light: "",
						dark: ""
					};
					merged[name][scheme] = withAlphaCss(lightText ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)", TEXT_FAMILY[name]);
				});
			});
		}
		/** diff 语义色的深色版（design-platform 深色行的值）。 */
		var DIFF_FAMILY = {
			"--dsw-alias-file-diff-added-bg": "rgb(31, 49, 36)",
			"--dsw-alias-file-diff-added-gutter": "rgb(19, 32, 22)",
			"--dsw-alias-file-diff-added-marker": "rgb(65, 201, 119)",
			"--dsw-alias-file-diff-deleted-bg": "rgb(60, 31, 27)",
			"--dsw-alias-file-diff-deleted-gutter": "rgb(40, 19, 14)",
			"--dsw-alias-file-diff-deleted-marker": "rgb(250, 66, 62)"
		};
		/**
		* diff 语义色方向矫正：白字主题下浅绿/浅粉 diff 块与深玻璃格格不入、
		* 文字看不清（点文件展开实测）——翻成深色版（dark 分支本就是对的）；
		* 用户显式写过的让位。
		*/
		function fixDiffFamily(merged, userTokens, probe) {
			var own = userTokens || {};
			var primary = own["--dsw-alias-label-primary"];
			var fg = primary && typeof primary.light === "string" && primary.light !== "" ? primary.light : probe.of("--dsw-alias-label-primary", "light");
			if (fg === "" || relativeLuminance(fg) <= .36) return;
			Object.keys(DIFF_FAMILY).forEach(function(name) {
				if (own[name] !== void 0) return;
				merged[name] = {
					light: DIFF_FAMILY[name],
					dark: DIFF_FAMILY[name]
				};
			});
		}
		//#endregion
		//#region src/client/api.ts
		function createApi(getPrefix, getToken) {
			function url(path) {
				return getPrefix() + path;
			}
			function headers(extra) {
				return Object.assign({ "x-dts-key": getToken() || "" }, extra || {});
			}
			function unwrap(response) {
				return response.json().catch(function() {
					var parseError = /* @__PURE__ */ new Error("HTTP " + String(response.status));
					parseError.status = response.status;
					throw parseError;
				}).then(function(body) {
					if (body && body.ok === true) return body.value;
					var message = body && body.error && body.error.message || "HTTP " + response.status;
					var error = new Error(message);
					error.status = body && body.error && body.error.status || response.status;
					throw error;
				});
			}
			return {
				getState: function(diag) {
					return fetch(url("/api/state"), {
						cache: "no-store",
						headers: diag ? headers({ "x-dts-diag": diag }) : headers()
					}).then(unwrap);
				},
				saveDoc: function(doc, expectRevision, signal) {
					return fetch(url("/api/state"), {
						method: "PUT",
						headers: headers({ "content-type": "application/json" }),
						body: JSON.stringify({
							doc,
							expectRevision
						}),
						signal
					}).then(unwrap);
				},
				preset: function(id) {
					return fetch(url("/api/preset"), {
						method: "POST",
						headers: headers({ "content-type": "application/json" }),
						body: JSON.stringify({ id })
					}).then(unwrap);
				},
				/** 把 File 直接当请求体：不打包、不 base64、不留内存副本，这是原画质的前提。 */
				upload: function(file, onProgress) {
					var target = url("/api/media?name=" + encodeURIComponent(file.name || "material"));
					return new Promise(function(resolve, reject) {
						var xhr = new XMLHttpRequest();
						xhr.open("POST", target, true);
						xhr.setRequestHeader("x-dts-key", getToken() || "");
						if (typeof onProgress === "function") xhr.upload.addEventListener("progress", function(event) {
							if (event.lengthComputable) onProgress(event.loaded / event.total);
						});
						xhr.addEventListener("load", function() {
							var body = null;
							try {
								body = JSON.parse(xhr.responseText);
							} catch (err) {
								body = null;
							}
							if (body && body.ok === true) resolve(body.value);
							else reject(new Error(body && body.error && body.error.message || "HTTP " + String(xhr.status)));
						});
						xhr.addEventListener("error", function() {
							reject(/* @__PURE__ */ new Error("network"));
						});
						xhr.addEventListener("abort", function() {
							reject(/* @__PURE__ */ new Error("abort"));
						});
						xhr.send(file);
					});
				},
				removeMedia: function(id, force) {
					return fetch(url("/api/media/" + encodeURIComponent(id) + (force ? "?force=1" : "")), {
						method: "DELETE",
						headers: headers()
					}).then(unwrap);
				},
				usage: function() {
					return fetch(url("/api/usage"), { cache: "no-store" }).then(unwrap);
				},
				themes: function() {
					return fetch(url("/api/themes"), { cache: "no-store" }).then(unwrap);
				},
				saveTheme: function(name, overwrite) {
					return fetch(url("/api/themes"), {
						method: "POST",
						headers: headers({ "content-type": "application/json" }),
						body: JSON.stringify({
							name,
							overwrite: overwrite === true
						})
					}).then(unwrap);
				},
				loadTheme: function(slug) {
					return fetch(url("/api/themes/load"), {
						method: "POST",
						headers: headers({ "content-type": "application/json" }),
						body: JSON.stringify({ slug })
					}).then(unwrap);
				},
				removeTheme: function(slug) {
					return fetch(url("/api/themes/" + encodeURIComponent(slug)), {
						method: "DELETE",
						headers: headers()
					}).then(unwrap);
				},
				importDoc: function(doc, mode) {
					return fetch(url("/api/import" + (mode === "merge" ? "?mode=merge" : "")), {
						method: "POST",
						headers: headers({ "content-type": "application/json" }),
						body: JSON.stringify({ doc })
					}).then(unwrap);
				},
				exportUrl: function() {
					return url("/api/export");
				}
			};
		}
		//#endregion
		//#region src/client/layer.ts
		var OVERLAY_HOST_ID = "dts-overlay-host";
		function createLayerManager() {
			/** 层的容器：由 React 的 `OverlaySurface` 交出（`attachStage`）。 */
			var stage = null;
			var layer = null;
			var cssInner = null;
			var video = null;
			var parallaxBound = false;
			var parallaxRaf = 0;
			/** 视差开关（业务侧只翻布尔）；真正的 add/removeEventListener 在 ctx.effect 内。 */
			var parallaxOn = false;
			var parallaxHandlers = {
				request: null,
				release: null
			};
			/** 最近一次 sync 的入参：容器晚于网络返回到达时用它补一次落位。 */
			var pending = null;
			function onPointerMove(event) {
				if (parallaxRaf !== 0) return;
				parallaxRaf = window.requestAnimationFrame(function() {
					parallaxRaf = 0;
					if (layer === null) return;
					var x = (event.clientX / Math.max(1, window.innerWidth) - .5) * 2;
					var y = (event.clientY / Math.max(1, window.innerHeight) - .5) * 2;
					layer.style.setProperty("--dts-mx", String(Math.round(x * 100) / 100));
					layer.style.setProperty("--dts-my", String(Math.round(y * 100) / 100));
				});
			}
			function stopRaf() {
				if (parallaxRaf === 0) return;
				try {
					window.cancelAnimationFrame(parallaxRaf);
				} catch (err) {}
				parallaxRaf = 0;
			}
			function clearParallaxVars() {
				if (layer === null || typeof layer.style.removeProperty !== "function") return;
				layer.style.removeProperty("--dts-mx");
				layer.style.removeProperty("--dts-my");
			}
			/**
			* 功能安全网：把层节点挂到 `<body>` 的**首个子节点**（改造前的落位方式）。
			* 只在"官方 `shell.overlay` 容器不可得"时走这条路 —— 见 `placeLayer()`。
			*/
			function mountToBody(node) {
				var body = document.body;
				if (body === null || body === void 0) return;
				var first = body.firstChild;
				if (first !== null && first !== void 0 && first !== node) body.insertBefore(node, first);
				else if (first === null || first === void 0) body.appendChild(node);
			}
			/**
			* 落位：**背景层永远挂 `<body>`**（改造前的正确形态）。
			*
			* ⚠️ 为什么**不能**进 `shell.overlay`：那是**框架级浮层槽**
			* （宿主 `[data-shell-overlay]{position:absolute;inset:0;z-index:20;pointer-events:none}`，
			* 给 Modal / Toast 这类**位于 UI 之上**的东西用的）。背景层一旦进去，
			* 无论它自身 `z-index` 写多少，**整个容器都以 z-index:20 压在 `#root`（z-index:1）之上**
			* ⇒ **壁纸盖住全部界面**（真机实测复现过：整屏只剩壁纸，UI 全被埋）。
			* 正确分层：背景（body, z0）< UI（`#root`, z1）< 浮层（shell.overlay, z20）。
			* `body.dts-on #root{position:relative;z-index:1}` 这条承重墙**只在"背景层是 body 的子节点"
			* 时才成立** —— 所以这里固定走 body；`stage` 只用于模态/Toast 容器。
			*/
			function placeLayer() {
				if (layer === null) return;
				if (layer.parentNode !== document.body) mountToBody(layer);
			}
			function ensureLayer() {
				if (layer !== null && document.getElementById("dts-backdrop") === layer) {
					placeLayer();
					return layer;
				}
				layer = document.getElementById(LAYER_ID);
				if (layer !== null) {
					placeLayer();
					return layer;
				}
				layer = document.createElement("div");
				layer.id = LAYER_ID;
				layer.className = "dts-layer";
				layer.setAttribute("aria-hidden", "true");
				layer.__dtsOwned = true;
				placeLayer();
				return layer;
			}
			function releaseLayerNode() {
				stopRaf();
				clearParallaxVars();
				if (layer !== null && layer.__dtsOwned === true && typeof layer.remove === "function") layer.remove();
				layer = null;
				cssInner = null;
				video = null;
			}
			function showCssLayer() {
				var host = ensureLayer();
				host.className = "dts-layer";
				if (video !== null) {
					try {
						video.pause();
					} catch (err) {}
					video.remove();
					video = null;
				}
				if (cssInner === null || !host.contains(cssInner)) {
					var existing = typeof host.querySelector === "function" ? host.querySelector(".dts-layer--css") : null;
					if (existing) cssInner = existing;
					else {
						cssInner = document.createElement("div");
						cssInner.className = "dts-layer dts-layer--css";
						host.appendChild(cssInner);
					}
				}
				setParallax(false);
			}
			function showVideoLayer(src, doc) {
				var host = ensureLayer();
				host.className = "dts-layer";
				if (cssInner !== null) {
					cssInner.remove();
					cssInner = null;
				}
				if (video === null || !host.contains(video)) {
					video = document.createElement("video");
					video.className = "dts-video";
					video.addEventListener("error", function() {
						if (video === null || video.error === null) return;
						showCssLayer();
					}, { once: true });
					host.appendChild(video);
				}
				var v = doc.backdrop.video;
				if (video.getAttribute("src") !== src) video.setAttribute("src", src);
				video.muted = v.muted;
				if (v.muted) video.setAttribute("muted", "");
				else video.removeAttribute("muted");
				if (v.loop) video.setAttribute("loop", "");
				else video.removeAttribute("loop");
				video.setAttribute("playsinline", "");
				video.setAttribute("preload", "auto");
				var rate = clamp$1(v.playbackRate, .25, 2);
				if (video.playbackRate !== rate) video.playbackRate = rate;
				if (v.autoplay) {
					var attempt = video.play();
					if (attempt && typeof attempt.catch === "function") attempt.catch(function() {});
				} else video.pause();
				setParallax(false);
			}
			/** 视差开关的**唯一**写入口：业务侧只翻布尔，注册动作留给 effect。 */
			function setParallax(next) {
				if (parallaxOn === next) return;
				parallaxOn = next;
				if (next) {
					if (typeof parallaxHandlers.request === "function") parallaxHandlers.request();
				} else if (typeof parallaxHandlers.release === "function") parallaxHandlers.release();
			}
			function releaseParallax() {
				if (typeof parallaxHandlers.release === "function") parallaxHandlers.release();
			}
			function sync(doc, prefix, media) {
				pending = {
					doc,
					prefix,
					media
				};
				var b = doc.backdrop;
				if (b.mode === "none") {
					releaseLayerNode();
					document.body.classList.remove("dts-on");
					return;
				}
				document.body.classList.add("dts-on");
				setLiveScheme(document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light");
				var meta = mediaLookup(media, b.mediaId);
				if (b.mode === "video" && b.mediaId !== "" && meta !== void 0) showVideoLayer(prefix + "/media/" + encodeURIComponent(meta.id) + "/" + encodeURIComponent(meta.name || ""), doc);
				else showCssLayer();
				setParallax(b.parallax > 0);
			}
			function element() {
				return document.getElementById(LAYER_ID);
			}
			/**
			* 层的容器由 React 的 `OverlaySurface` 交出（它在 `shell.overlay` 里）。
			* 容器一到位就补一次落位 —— 网络返回（`sync()`）通常早于 React 挂载，
			* 那时层节点已建好（挂在 `<body>` 上），这里让同步链再跑一遍补齐内层。
			*
			* ⚠️ **背景层不进 `stage`**（见 `placeLayer()` 的说明）：`shell.overlay` 是
			* `z-index:20` 的框架级浮层，背景层进去会盖住整个界面。`stage` 只承载
			* 模态/Toast 容器。**宿主有没有这个槽都不影响壁纸落位**（它固定挂 body）。
			*/
			function attachStage(node) {
				stage = node === void 0 ? null : node;
				if (stage === null) return;
				if (pending !== null) {
					var next = pending;
					pending = null;
					sync(next.doc, next.prefix, next.media);
					return;
				}
				placeLayer();
			}
			/**
			* React 卸载容器：容器连同里面的**浮层**节点一起走。
			*
			* ⚠️ **绝不能在这里清层句柄**：背景层不在容器里（固定挂 `<body>`，见 `placeLayer()`），
			* 清了 `layer` 之后 `dispose()` 的 `releaseLayerNode()` 就找不到节点 ——
			* **壁纸会留在 body 上不退场**（真泄漏；"卸载后不得留 `#dts-backdrop`"这条断言实测抓到过）。
			* 所以这里只放开容器引用，并把视差（全局 `window` 监听）收干净。
			* `parallaxOn` 一并翻回 false：容器重挂时 `sync()` 才能重新登记监听。
			*/
			function detachStage() {
				stage = null;
				parallaxOn = false;
				releaseParallax();
			}
			/**
			* 视差监听的**注册点** —— 必须在 `ctx.effect` 里（`references_ui-plugin.md:13`）。
			* 改造前 `attachParallax()` 是在 `sync()`（网络回调）里挂
			* `window.addEventListener('pointermove')` 的：有配对 detach、实测不泄漏，
			* 但注册点不在 effect 内，形式上不合规。现在注册点固定在本 effect 内，
			* `sync()` 只翻一个布尔开关，cleanup 里成对摘除。
			*/
			function createBackdropEffect(ctx) {
				return ctx.effect(function() {
					parallaxHandlers.request = function() {
						if (parallaxBound) return;
						parallaxBound = true;
						window.addEventListener("pointermove", onPointerMove, { passive: true });
					};
					parallaxHandlers.release = function() {
						if (!parallaxBound) return;
						parallaxBound = false;
						window.removeEventListener("pointermove", onPointerMove);
						stopRaf();
						clearParallaxVars();
					};
					if (parallaxOn) parallaxHandlers.request();
					return function() {
						parallaxOn = false;
						parallaxHandlers.release();
						parallaxHandlers.release = null;
						parallaxHandlers.request = null;
					};
				}, "theme-studio: backdrop parallax");
			}
			function dispose() {
				releaseParallax();
				if (video !== null) try {
					video.pause();
				} catch (err) {}
				releaseLayerNode();
				document.body.classList.remove("dts-on");
			}
			return {
				sync,
				dispose,
				element,
				attachStage,
				detachStage,
				createBackdropEffect
			};
		}
		/**
		* 一次性提示的**唯一**状态源。
		* 改造前这条是"命令式造一个 `#dts-notice` 节点挂到 `document.body`"，
		* 现在由 React 渲染（`Toast` 控件自身 portal 到 body —— 那是控件层与官方
		* `Toast` 逐字同构的行为，属控件内部实现，不在本插件源码的写入清单里）。
		*/
		function createNotices() {
			var store = createStore({ items: [] });
			var seq = 0;
			return {
				store,
				subscribe: function(fn) {
					return store.subscribe(fn);
				},
				push: function(text, tone) {
					if (!text) return;
					seq += 1;
					store.update({ items: store.get().items.concat([{
						id: seq,
						text: String(text),
						tone: tone || "ok"
					}]) });
				},
				drop: function(id) {
					store.update({ items: store.get().items.filter(function(item) {
						return item.id !== id;
					}) });
				},
				clear: function() {
					if (store.get().items.length > 0) store.update({ items: [] });
				}
			};
		}
		/**
		* 浮层宿主的状态源：`host` 是那个容器的真实 DOM 节点（`null` = 还没挂载）。
		* 单独开一个 store 而不是用 `useRef`：**ref 变化不触发重渲染**，而提示/模态/
		* 全屏键都要 `createPortal` 进这个节点 —— 存进 state 才能在它到位后重渲染一次。
		*/
		function createOverlayEffects() {
			var store = createStore({
				host: null,
				modalHost: null
			});
			return {
				store,
				host: function() {
					return store.get().host;
				},
				modalHost: function() {
					return store.get().modalHost;
				},
				subscribe: function(fn) {
					return store.subscribe(fn);
				},
				setHost: function(node) {
					if (store.get().host === node) return;
					store.update({ host: node });
				},
				setModalHost: function(node) {
					if (store.get().modalHost === node) return;
					store.update({ modalHost: node });
				}
			};
		}
		/**
		* `shell.overlay` 条目：插件在**框架级浮层**里的唯一落点。
		*
		* 官方对该槽的契约（`dsh-client-ui-layout` 产物）：`shell.overlay` 是 **list** 槽、
		* `scope: root`，"Frame-wide floating layer, above every column and outside their
		* scroll containers… entries order among themselves"，且层本身 **click-through**
		* （`[data-shell-overlay]{position:absolute;inset:0;z-index:20;pointer-events:none}`）
		* —— 条目要自己决定哪一块吃指针。官方 8 个条目（`chat.quota-notice` 等）都注在这里。
		* 我们说得出"为什么需要浮层"：壁纸要盖住整个框架、提示要跨面板存活、
		* 全屏键要贴窗口顶条 —— 三者都不属于任何一列。
		*
		* 组件只做两件事：① 渲染那个容器（`#dts-overlay-host`）与模态容器
		* （`#dts-modal-host`）；② 把容器节点交出去（`ref` → `effects.setHost`
		* → `layer.attachStage`）。容器内容由调用方通过 `content()` 给
		* （`app.ts` 的 `OverlayContent`），于是它们是**真正的 React 子节点** ——
		* 一条 `document.body` 写入都没有，且随容器一起卸载。
		* 容器自身 `pointer-events:none`（与官方浮层层的取向一致）：不吃宿主指针，
		* 只有具体控件自己重新打开指针。
		*/
		function OverlaySurface(props) {
			var effects = props.effects;
			var hostRef = props.hostRef || null;
			var setHost = useCallback$1(function(node) {
				if (hostRef !== null && hostRef !== void 0) hostRef.current = node;
				effects.setHost(node);
				if (typeof props.attachStage === "function") props.attachStage(node);
				if (typeof props.detachStage === "function" && (node === null || node === void 0)) props.detachStage();
			}, []);
			var setModalHost = useCallback$1(function(node) {
				effects.setModalHost(node);
			}, []);
			return e$1("div", {
				id: OVERLAY_HOST_ID,
				ref: setHost,
				"data-dts-overlay": PLUGIN_ID,
				style: {
					position: "fixed",
					inset: 0,
					zIndex: 0,
					pointerEvents: "none",
					overflow: "hidden",
					contain: "paint"
				}
			}, e$1("div", {
				key: "modal-host",
				id: MODAL_HOST_ID,
				ref: setModalHost,
				style: { pointerEvents: "auto" }
			}), typeof props.content === "function" ? props.content() : null);
		}
		/** 注入或替换一段样式；带 data-plugin* 标记，交给宿主按插件生命周期回收。
		*  ⚠️ 幂等键**有意**用 `document.getElementById(id)` 而不是官方的
		*  `querySelector('style[data-plugin-css=…]')`：官方 15 个 bundle 一律不设 `style.id`，
		*  但本插件的装配冒烟（`tools/integration-check.mjs`）与 `data-plugin-css` 值都按 id 找过它，
		*  改成查询式会让 25 条既有多窗口/卸载断言同时失效（实测过，已回退）。
		*  功能与合规均无影响：`data-plugin`/`data-plugin-css` 两个标记与官方同形，
		*  宿主按 `data-plugin` 回收照旧。
		*  ⚠️ 往 `<head>` 注 `<style>` 是**官方自己也做**的事（走 CSS Modules 的内联注入），
		*  列在 `07-compliance-audit.md` 表 4 的"边界"里，不属本项目标。 */
		function upsertStyle(id, css) {
			var el = document.getElementById(id);
			if (el === null) {
				el = document.createElement("style");
				el.id = id;
				el.setAttribute("data-plugin", PLUGIN_ID);
				el.setAttribute("data-plugin-css", PLUGIN_ID + "/" + id);
				document.head.appendChild(el);
			}
			if (el.textContent !== css) el.textContent = css;
			return el;
		}
		//#endregion
		//#region src/client/chrome.ts
		function fullscreenElement() {
			return document.fullscreenElement || document.webkitFullscreenElement || null;
		}
		function requestFullscreen(target) {
			var el = target || document.documentElement;
			var method = el.requestFullscreen || el.webkitRequestFullscreen;
			if (typeof method !== "function") return Promise.reject(/* @__PURE__ */ new Error("unsupported"));
			try {
				return Promise.resolve(method.call(el));
			} catch (err) {
				return Promise.reject(err);
			}
		}
		function exitFullscreen() {
			var method = document.exitFullscreen || document.webkitExitFullscreen;
			if (typeof method !== "function") return Promise.resolve();
			try {
				return Promise.resolve(method.call(document));
			} catch (err) {
				return Promise.resolve();
			}
		}
		/**
		* ── 玻璃真源（全插件唯一）──
		*
		* **契约（主人七轮迭代后的最终口径，本轮从审计前副本原样恢复）**：
		*   玻璃上不带任何自选色、不做任何压暗 —— 颜色 100% 来自壁纸，只加磨砂。
		*   即：`background: transparent` + `backdrop-filter: blur()`。
		*
		*   --dts-glass-fill   transparent  零自选色。颜色由 `blur()` 采样真实壁纸得来，
		*                     所以每处玻璃的色调都跟着背后的壁纸走（"同色源"）。
		*   --dts-glass-blur   转发宿主令牌 `--dsw-menu-backdrop-filter`
		*                     (= blur(40px) saturate(150%))，**带兜底链**、不加任何后缀。
		*                     禁止追加 brightness()/contrast() —— 那也是"替壁纸做决定"。
		*
		* **为什么是零色**：实度 .72 的旧方案意味着 72% 是我们选的颜色、壁纸只剩 28%，
		* 玻璃必然与壁纸脱节。堵住底字靠的是**不透明度**而非**黑度**，两者可解耦 ——
		* 而"只做模糊"把可读性完全交给 `blur()`，颜色则完全交还给壁纸。
		*
		* ⚠️ **代价（主人知情并选择）**：去掉实色与压暗后，`blur()` 是**唯一**承担
		* "看不清底字"的机制。一旦某处 `backdrop-filter` 被祖链圈死而失效，背后正文
		* 会直接透上来，**没有兜底**。所以「糊必须活着」是**硬前提**，三处保障：
		*   · 遮罩层（宿主 `_mask` / `_backdrop` / `_scrim` 与自家控件层 `Modal` 的遮罩）
		*     绝不许带 backdrop-filter —— 否则圈死子级取景；
		*   · 输入卡的磨砂搬进 `::before`（卡片本体不当 backdrop root）；
		*   · `[role="dialog"]` / `[role="alertdialog"]` 显式带糊
		*     （零色化后只声明 background-color 会全透明）。
		*
		* **例外（都不是玻璃面）**：
		*   · `--dts-glass-fill-thin` 给**没有 backdrop-filter** 的密集小输入兜底
		*     （98 个挂 blur 会合成层爆炸；透明+无糊=控件消失）；
		*   · 反相实底 chip（`_tag_[data-tone=solid]`）白字压底，走宿主已玻璃化的按钮令牌；
		*   · `.dsh-agent-dialog` 确认框的实底压实（字压底，不是玻璃面）。
		*
		* ⚠️ **本轮恢复说明（主人复测判定阶段 C/D 为误判）**：
		*   「有很多原本的设定和功能都缺失了，比如这个对话框要磨砂。零自选色，零压暗」
		*   阶段 C/D 曾把上面这条口径改成"官方半透明填充 + 大模糊"，并把 42 个宿主表面
		*   锚点整族删除。本文件按审计前副本（`audit-theme-studio/_tmp/mut`）恢复：
		*     · 玻璃口径 + `--dts-glass-blur` 变量（含兜底链）
		*     · 宿主表面锚点强注段（见下方 ★★★ 宿主表面锚点强注）
		*   **保留未回退**的本轮改进：CSS Modules 工具链、官方 locale、自写控件层、
		*   面板几何/行范式、`createPortal`/盐/死槽位等真 bug 修复。
		*
		* **保留的两条纪律**（与官方一致，没变）：
		*   · 遮罩层**不带** backdrop-filter（官方 `--dsw-mask-blur` 默认就是 `none`）——
		*     带它的元素成为 backdrop root，子树里再开 blur 只采到"这一层"；
		*   · 需要磨砂的面把模糊挂在自己的**材料子层**上（自家面板走控件层的
		*     `MenuSurface` / `Modal`），不给"承载内容的卡片本体"挂 blur
		*     —— 唯一的例外是输入卡，它把糊搬进 `::before`。
		*/
		var GLASS_FILL = "var(--dts-glass-fill,transparent)";
		/** 模糊：转发 `--dts-glass-blur` → 官方 `--dsw-menu-backdrop-filter`，两级兜底。
		*  兜底值 `blur(40px) saturate(150%)` 就是官方该令牌的定义值 —— 宿主令牌缺席时
		*  玻璃面不能变成"只变淡不磨砂"（零色口径下糊是唯一可读性机制）。 */
		var GLASS_BLUR = "var(--dts-glass-blur,var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%)))";
		/** 玻璃面统一组装：省得每条规则各写一遍、漏掉一半。 */
		var glass = (background) => "background:" + background + "!important;backdrop-filter:" + GLASS_BLUR + "!important";
		var CHROME_CSS = [
			"body.dts-on .dts-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:paint}",
			"body.dts-on #root{position:relative;z-index:1}",
			".dts-page,.dts-page-head,.dts-page-actions,.dts-body,.dts-group,.dts-row,.dts-row-text,.dts-row-control,.dts-row-tail,.dts-field-row,.dts-adder,.dts-adder-field,.dts-suggest,.dts-suggest-row,.dts-dialog-foot,.dts-dialog-line,.dts-btn,.dts-pill,.dts-switch,.dts-card,.dts-card-body,.dts-card-actions,.dts-drop,.dts-focus,.dts-color,.dts-token-row,.dts-pair,.dts-clear-slot,.dts-note,.dts-status,.dts-textarea,.dts-modal-panel,.dts-modal-head,.dts-modal-close,.dts-modal-options{box-sizing:border-box}",
			".dts-page{display:flex;flex-direction:column;gap:12px;max-width:760px;font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary)}",
			".dts-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}",
			".dts-page-title{display:flex;align-items:center;gap:8px;margin:0;font-size:18px;font-weight:600}",
			".dts-page-intro{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}",
			".dts-page-actions{display:flex;align-items:center;gap:8px;flex:none;flex-wrap:wrap}",
			".dts-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary)}",
			".dts-fs{position:fixed;top:0;right:var(--dts-caption-inset,138px);pointer-events:auto;height:var(--dsh-windows-titlebar-height,40px);display:inline-flex;align-items:center;padding:0 10px;border:0;background:transparent;cursor:pointer;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;z-index:1000;-webkit-app-region:no-drag}",
			".dts-fs:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dts-fs:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
			".dts-cmenu{position:fixed;z-index:1000;min-width:220px;padding:4px;display:flex;flex-direction:column;gap:0;border-radius:var(--dsw-radius-lg);border:.5px solid var(--dsw-alias-border-l2);" + glass(GLASS_FILL) + ";box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family)}",
			".dts-cmenu-item{display:flex;align-items:center;gap:6px;width:100%;min-height:30px;padding:4px 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:inherit;font:inherit;font-size:13px;line-height:20px;cursor:pointer;text-align:start}",
			".dts-cmenu-item>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-cmenu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dts-cmenu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}",
			".dts-cmenu-item kbd{margin-inline-start:auto;flex:none;font:inherit;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}",
			".dts-cmenu-sep{height:.5px;margin:3px 2px;background:var(--dsw-alias-border-l2)}",
			".dts-cmenu-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:1000;max-width:min(420px,90vw);padding:8px 14px;border-radius:var(--dsw-radius-md);font-size:12px;color:var(--dsw-alias-label-primary);" + glass(GLASS_FILL) + ";box-shadow:var(--dsw-shadow-lv3)}",
			".dts-dot{width:8px;height:8px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-state-idle-primary)}",
			".dts-dot[data-state=\"done\"]{background:var(--dsw-alias-state-success-primary)}",
			".dts-dot[data-state=\"error\"]{background:var(--dsw-alias-state-error-primary)}",
			".dts-dot[data-state=\"ongoing\"]{background:var(--dsw-alias-brand-primary);animation:dts-pulse 1.2s var(--ds-ease-in-out) infinite}",
			"@keyframes dts-pulse{0%,100%{opacity:1}50%{opacity:.35}}",
			".dts-status[data-state=\"error\"]{color:var(--dsw-alias-state-error-primary)}",
			".dts-body{display:flex;flex-direction:column;gap:12px;min-width:0}",
			".dts-group{display:flex;flex-direction:column}",
			".dts-group-title{margin:0;font-size:15px;font-weight:600;line-height:22px;color:var(--dsw-alias-label-primary)}",
			".dts-group-desc{margin:2px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}",
			".dts-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
			".dts-note{margin:0;padding:8px 10px;font-size:12px;line-height:18px;border-radius:var(--dsw-radius-sm);background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}",
			".dts-note[data-tone=\"warn\"]{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}",
			".dts-note[data-tone=\"error\"]{background:var(--dsw-alias-code-diff-deleted);color:var(--dsw-alias-state-error-primary)}",
			".dts-row{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}",
			".dts-row-text{min-width:0}",
			".dts-row-title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}",
			".dts-row-desc{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
			".dts-row-control{flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:8px}",
			".dts-row-tail{flex:none;display:flex;align-items:center;gap:6px}",
			".dts-focus-num{width:80px;padding:0}",
			".dts-group>.dts-row:last-child,.dts-body>.dts-row:last-child,.dts-group>div:last-child>.dts-row:last-child{border-bottom:none}",
			".dts-field-row{display:flex;align-items:flex-end;gap:8px}",
			".dts-field-row .dts-btn,.dts-field-row button{height:34px;flex:none;margin-bottom:12px}",
			".dts-page [class*=\"dtsSliderOutput\"]{flex:none;min-width:46px;text-align:right;white-space:nowrap}",
			".dts-field-grow{flex:1;min-width:0}",
			".dts-input-flex{flex:1;min-width:36px;display:flex}",
			".dts-input-flex>*{flex:1;min-width:0}",
			".dts-filter-row{display:flex;align-items:flex-end;gap:12px;margin-bottom:10px}",
			".dts-token-groups{display:flex;flex-direction:column;gap:10px}",
			".dts-extras{display:flex;flex-direction:column;gap:6px;margin-top:6px}",
			".dts-row-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}",
			".dts-json-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px 0 0}",
			".dts-disclosure{padding:4px 0}",
			".dts-textarea{width:100%;min-width:0;padding:4px 8px;min-height:132px;resize:vertical;font-family:var(--ds-font-family-code,monospace);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-soft)}",
			"body.dts-on .dts-textarea{" + glass(GLASS_FILL) + "}",
			"body.dts-on .dts-input-flex>*{background:var(--dts-glass-fill-thin,rgba(16,20,24,.28))!important}",
			"body.dts-on .dts-page button[aria-haspopup=\"listbox\"]{" + glass(GLASS_FILL) + "}",
			".dts-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-elevated-fill);border:0;border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-soft);cursor:pointer;text-decoration:none}",
			".dts-btn:hover{background:var(--dsw-alias-button-floating-hover)}",
			".dts-btn:disabled{opacity:.5;cursor:not-allowed}",
			".dts-btn:focus-visible,.dts-pill:focus-visible,.dts-switch:focus-visible,.dts-swatch:focus-visible,.dts-drop:focus-visible,.dts-textarea:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}",
			".dts-btn[data-tone=\"primary\"]{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill)}",
			".dts-btn[data-tone=\"danger\"]{color:var(--dsw-alias-state-error-primary)}",
			".dts-btn-danger{color:var(--dsw-alias-state-error-primary)}",
			".dts-page button,.dts-page .dts-btn{white-space:nowrap;flex:none;font-size:13px}",
			".dts-page button,.dts-page .dts-btn{transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}",
			".dts-color{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto;justify-content:flex-end}",
			".dts-color input[type=\"color\"]{width:30px;height:26px;padding:0;border:0;background:transparent;cursor:pointer;flex:none}",
			".dts-switch{width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;cursor:pointer;position:relative;background:var(--dsw-alias-border-l3)}",
			".dts-switch::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform 120ms ease}",
			".dts-switch[aria-checked=\"true\"]{background:var(--dsw-alias-brand-primary)}",
			".dts-switch[aria-checked=\"true\"]::after{transform:translateX(16px)}",
			".dts-adder{display:flex;align-items:flex-end;gap:8px}",
			".dts-adder-field{position:relative;flex:1;min-width:0}",
			".dts-suggest{position:absolute;bottom:calc(100% + 4px);left:0;right:0;z-index:1000;max-height:220px;overflow-y:auto;overscroll-behavior:contain;padding:4px;display:flex;flex-direction:column;gap:0;box-shadow:var(--dsw-elevation-prominent)}",
			".dts-suggest-row{appearance:none;border:0;background:transparent;text-align:start;font:inherit;font-family:var(--ds-font-family-code,monospace);font-size:12px;padding:6px 8px;border-radius:var(--dsw-radius-md);cursor:pointer;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-suggest-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dts-suggest-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
			".dts-pill{padding:3px 10px;font:inherit;font-size:12px;border:0;border-radius:999px;corner-shape:round;cursor:pointer;background:var(--dsw-specific-selector);color:var(--dsw-alias-label-secondary)}",
			".dts-pill[aria-pressed=\"true\"]{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}",
			".dts-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:8px}",
			".dts-swatch{display:flex;flex-direction:column;overflow:hidden;padding:0;text-align:start;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);border:0;border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-soft);cursor:pointer}",
			".dts-swatch:hover{box-shadow:var(--dsw-elevation-prominent)}",
			".dts-swatch[aria-pressed=\"true\"]{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary),var(--dsw-elevation-soft)}",
			".dts-swatch-art{display:block;height:44px}",
			".dts-swatch-name{padding:6px 8px 2px;font-size:12px}",
			".dts-swatch-note{padding:0 8px 7px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dts-library{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}",
			".dts-card{display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1);border:0;border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-soft)}",
			".dts-thumb{display:block;width:100%;height:82px;object-fit:cover;background:var(--dsw-alias-bg-skeleton)}",
			".dts-card-body{display:flex;flex-direction:column;gap:4px;padding:8px}",
			".dts-card-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-card-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
			".dts-card-actions{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 8px}",
			".dts-btn--sm{padding:3px 8px;font-size:12px}",
			".dts-profile-list{display:flex;flex-direction:column;gap:6px}",
			".dts-token-row.dts-profile-row{grid-template-columns:minmax(0,auto) minmax(0,1fr) auto;align-items:center}",
			".dts-profile-dot{display:inline-block;width:11px;height:11px;border-radius:50%;corner-shape:round;margin-right:6px;vertical-align:-1px;border:.5px solid var(--dsw-alias-border-l2)}",
			".dts-card-actions button,.dts-card-actions .dts-btn{flex:none;white-space:nowrap}",
			".dts-drop{display:flex;align-items:center;justify-content:center;padding:20px 14px;font-size:13px;color:var(--dsw-alias-label-tertiary);border:.5px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-skeleton);cursor:pointer;text-align:center}",
			".dts-drop[data-hot=\"true\"]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-specific-selector)}",
			".dts-focus{position:relative;width:100%;max-width:230px;aspect-ratio:16/9;overflow:hidden;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-skeleton) center/cover no-repeat;cursor:crosshair}",
			".dts-focus::after{content:\"\";position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid var(--dsw-alias-brand-primary);border-radius:50%;corner-shape:round;box-shadow:0 0 0 999px var(--dsw-alias-bg-mask-2);left:var(--fx,50%);top:var(--fy,50%)}",
			".dts-token-row{display:grid;grid-template-columns:minmax(120px,1.6fr) repeat(2,minmax(120px,1fr)) auto;gap:8px;align-items:center}",
			".dts-token-name{font-family:var(--ds-font-family-code,monospace);font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-profile-row .dts-token-name{font-family:inherit;font-size:13px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary)}",
			".dts-pair{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--dsw-alias-label-tertiary);min-width:0}",
			".dts-pair-label{flex:none;white-space:nowrap}",
			".dts-clear-slot{display:inline-flex}.dts-clear-slot[data-empty=\"true\"]{visibility:hidden}",
			".dts-contrast{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}",
			".dts-dialog-line{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);word-break:break-word}",
			".dts-dialog-line[data-kind=\"path\"]{font-family:var(--ds-font-family-code,monospace);font-size:12px}",
			".dts-dialog-foot{display:flex;justify-content:flex-end;gap:8px}",
			".dts-modal-panel{width:800px;max-width:100%;height:min(800px,100%);gap:0;padding:0;display:flex;flex-direction:column;overflow:hidden}",
			".dts-modal-head{flex:none;height:54px;padding:20px 14px 8px 10px;display:flex;align-items:center;justify-content:flex-end;gap:8px}",
			".dts-modal-close{width:28px;height:28px;padding:0;border:0;flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary)}",
			".dts-modal-close:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dts-modal-close:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}",
			".dts-modal-options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}",
			"body.dts-on [data-composer-stats]{border-radius:16px;padding:4px 12px;" + glass(GLASS_FILL) + "}",
			"body.dts-on span[class$=\"_root\"]:has(button[class$=\"_trigger\"][aria-haspopup=\"dialog\"]){border-radius:16px;padding:4px 8px;" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_card\"],body.dts-on [class*=\"_card \"]{" + glass(GLASS_FILL) + ";border-radius:16px!important}",
			"body.dts-on [class$=\"_card\"]:has([data-placeholder]),body.dts-on [class*=\"_card \"]:has([data-placeholder]){backdrop-filter:none!important}",
			"body.dts-on [class$=\"_card\"]:has([data-placeholder])::before,body.dts-on [class*=\"_card \"]:has([data-placeholder])::before{content:\"\";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:" + GLASS_FILL + "!important;backdrop-filter:" + GLASS_BLUR + "!important}",
			"body.dts-on [class$=\"_card\"]:has([class*=\"search\"]){" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_card\"]:has([class$=\"_path\"],[class$=\"_counts\"],[class$=\"_file\"]),body.dts-on [class*=\"_card \"]:has([class$=\"_path\"],[class$=\"_counts\"],[class$=\"_file\"]){background:transparent!important;backdrop-filter:none!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:16px}",
			"body.dts-on [class$=\"_card\"] [class$=\"_header\"],body.dts-on [class$=\"_card\"] [class$=\"_tile\"],body.dts-on [class$=\"_file\"] [class$=\"_fileIcon\"]{background:transparent!important;border-color:transparent!important}",
			"body.dts-on [class$=\"_file\"]{border:1px solid rgba(255,255,255,.08)!important;border-radius:16px;" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_preview\"]{border:1px solid rgba(255,255,255,.08)!important;border-radius:12px;" + glass(GLASS_FILL) + "}",
			"body > :has([class*=\"hoverTime\"]),[class*=\"_card_\"][class*=\"_copyable_\"]{" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_panel\"]:not(:has([data-sidebar-right-mode=\"push\"])) [class$=\"_entry\"],body.dts-on [class$=\"_panel\"]:not(:has([data-sidebar-right-mode=\"push\"])) [class*=\"_entry \"]{background:transparent!important;backdrop-filter:none!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:16px!important}",
			"body.dts-on [class$=\"_panel\"]:has([data-sidebar-right-mode=\"push\"]) [class$=\"_entry\"],body.dts-on [class$=\"_panel\"]:has([data-sidebar-right-mode=\"push\"]) [class*=\"_entry \"]{" + glass(GLASS_FILL) + ";border:1px solid rgba(255,255,255,.08)!important;border-radius:16px!important}",
			"body.dts-on [data-sidebar-right-panel=\"push\"] [class$=\"_entry\"],body.dts-on [data-sidebar-right-panel=\"push\"] [class*=\"_entry \"]{background:transparent!important;backdrop-filter:none!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:16px!important}",
			"body.dts-on [data-sidebar-right-panel]:not([data-sidebar-right-panel=\"push\"]) [class$=\"_entry\"],body.dts-on [data-sidebar-right-panel]:not([data-sidebar-right-panel=\"push\"]) [class*=\"_entry \"]{" + glass(GLASS_FILL) + ";border:1px solid rgba(255,255,255,.08)!important;border-radius:16px!important}",
			"body.dts-on [class$=\"_panel\"]:has([data-sidebar-right-mode]) [class$=\"_guide\"],body.dts-on [data-sidebar-right-panel] [class$=\"_guide\"]{background:transparent!important;backdrop-filter:none!important}",
			"body.dts-on [class$=\"_loadingFloat\"]{" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_entry\"] button:hover,body.dts-on [class*=\"_entry \"] button:hover,body.dts-on [class$=\"_entry\"] button:active,body.dts-on [class*=\"_entry \"] button:active{background:transparent!important}",
			"body.dts-on [class$=\"_entry\"] button[aria-haspopup],body.dts-on [class*=\"_entry \"] button[aria-haspopup],body.dts-on [class$=\"_entry\"] button[aria-expanded],body.dts-on [class*=\"_entry \"] button[aria-expanded],body.dts-on [class$=\"_entry\"] button:not([class*=\"_main\"]),body.dts-on [class*=\"_entry \"] button:not([class*=\"_main\"]){background:transparent!important;border:0!important;box-shadow:none!important}",
			"body.dts-on [class$=\"_entry\"],body.dts-on [class*=\"_entry \"],body.dts-on [class$=\"_entry\"]:hover,body.dts-on [class*=\"_entry \"]:hover,body.dts-on [class$=\"_entry\"]:active,body.dts-on [class*=\"_entry \"]:active,body.dts-on [class$=\"_entry\"] *,body.dts-on [class*=\"_entry \"] *,body.dts-on [class$=\"_entry\"][role=\"button\"],body.dts-on [class*=\"_entry \"][role=\"button\"]{background:transparent!important;border:0!important;box-shadow:none!important}",
			"body.dts-on button[class$=\"_trigger\"],body.dts-on button[class*=\"_trigger \"],body.dts-on button[class$=\"_trigger\"]:hover,body.dts-on button[class*=\"_trigger \"]:hover,body.dts-on button[class$=\"_trigger\"]:active,body.dts-on button[class*=\"_trigger \"]:active,body.dts-on button[class$=\"_trigger\"] *,body.dts-on button[class*=\"_trigger \"] *,body.dts-on [class*=\"_menu\"] button,body.dts-on [class*=\"_menu\"] button *,body.dts-on span[class*=\"_root_\"]:has(> button),body.dts-on span[class*=\"_root_\"]:has(> button) *,body.dts-on button[class$=\"_trigger\"],body.dts-on button[class*=\"_trigger \"]{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
			"body.dts-on button[aria-label]:not([class*=\"_main\"]):hover,body.dts-on button[aria-label]:not([class*=\"_main\"]):active,body.dts-on button[aria-label]:not([class*=\"_main\"])[aria-expanded=\"true\"],body.dts-on button[aria-label]:not([class*=\"_main\"])[aria-pressed=\"true\"]{background:transparent!important}",
			"NaNbody.dts-on button[aria-expanded] *,body.dts-on [role=\"button\"][aria-expanded],body.dts-on [role=\"button\"][aria-haspopup] *,body.dts-on [role=\"button\"][aria-expanded] *{background:transparent!important}",
			"body.dts-on button:not([class*=\"primary\"]):not([class*=\"_main\"]):hover,body.dts-on button:not([class*=\"primary\"]):not([class*=\"_main\"]):active,body.dts-on button:not([class*=\"primary\"]):not([class*=\"_main\"])[aria-expanded=\"true\"],body.dts-on button:not([class*=\"primary\"]):not([class*=\"_main\"])[aria-pressed=\"true\"],body.dts-on [role=\"button\"]:not([class*=\"primary\"]):hover,body.dts-on [role=\"button\"]:not([class*=\"primary\"]):active{background:transparent!important}",
			"body.dts-on [data-windows-menu],body.dts-on [data-windows-menu] *,body.dts-on [data-windows-menu] button:hover,body.dts-on [data-windows-menu] button:active,body.dts-on [data-windows-menu] [role=\"button\"]:hover,body.dts-on [data-windows-menu] [role=\"button\"]:active{background:transparent!important}",
			"body.dts-on [class$=\"_panel\"]:not(:has([data-sidebar-right-mode=\"push\"])) [data-dockkit-pane],body.dts-on [class$=\"_panel\"]:not(:has([data-sidebar-right-mode=\"push\"])) [data-dockkit-float],body.dts-on [data-sidebar-right-panel=\"push\"] [data-dockkit-pane],body.dts-on [data-sidebar-right-panel=\"push\"] [data-dockkit-float]{background:transparent!important;backdrop-filter:none!important}",
			"body.dts-on [data-dockkit-pane], body.dts-on [data-dockkit-float]{" + glass(GLASS_FILL) + "}",
			"body.dts-on .lc-root .lc-card, body.dts-on .lc-modal-card{" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_overlay\"]:has(> [class$=\"_mask\"]) > [class$=\"_panel\"]{" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"_overlay\"] > [class$=\"_mask\"]{backdrop-filter:none!important}",
			"body.dts-on [class$=\"_overlay\"]:has(> [class$=\"_mask\"]) > [class$=\"_panel\"] :is([role=\"dialog\"],[role=\"alertdialog\"],[role=\"menu\"],[role=\"listbox\"],[role=\"tooltip\"],[class$=\"_dialog\"],[class$=\"_menu\"],[class$=\"_popover\"],[class$=\"_popup\"],[class$=\"_tooltip\"],[class$=\"_dropdown\"],[class$=\"_sheet\"]){" + glass(GLASS_FILL) + "}",
			"body.dts-on :is([role=\"tooltip\"],[role=\"menu\"],[role=\"listbox\"],[role=\"alertdialog\"],[class$=\"_tooltip\"],[class$=\"_popover\"],[class$=\"_dropdown\"],[class$=\"_popup\"]){" + glass(GLASS_FILL) + "}",
			"body.dts-on [role=\"dialog\"],body.dts-on [role=\"alertdialog\"],body.dts-on .dsh-agent-dialog,body.dts-on .dsh-agent-modal-card{" + glass(GLASS_FILL) + "}",
			"body.dts-on .dsh-agent-dialog.dsh-agent-dialog[class~=\"dsh-agent-dialog\"],body.dts-on .dsh-agent-dialog-scrim > .dsh-agent-dialog.dsh-agent-dialog{background-color:rgba(16,20,24,.92)!important}",
			"body.dts-on [class$=\"_backdrop\"],body.dts-on [class$=\"_scrim\"],body.dts-on [class$=\"-backdrop\"],body.dts-on [class$=\"-scrim\"]{background:transparent!important;backdrop-filter:none!important}",
			"body.dts-on [class$=\"_backdrop\"] > *,body.dts-on [class$=\"_scrim\"] > *{border:none!important;border-radius:32px!important;box-shadow:0 12px 32px rgba(0,0,0,.4);" + glass(GLASS_FILL) + "}",
			"body.dts-on [class$=\"-backdrop\"] > *,body.dts-on [class$=\"-scrim\"] > *{border:none!important;border-radius:32px!important;box-shadow:0 12px 32px rgba(0,0,0,.4);" + glass(GLASS_FILL) + "}",
			"[class*=\"buildVersion\"]{background:var(--dsw-alias-button-elevated-fill,rgba(16,20,24,.15))!important}",
			"body.dts-on svg rect:has(+ g[clip-path*=\"badge\"]){fill:transparent!important}",
			"body.dts-on svg g[clip-path*=\"badge\"] path,body.dts-on svg g[clip-path*=\"badge\"] *{fill:currentColor!important}",
			"body.dts-on [class*=\"badge\"],body.dts-on [class*=\"Badge\"],body.dts-on [class*=\"version\"],body.dts-on [class*=\"Version\"],body.dts-on [class*=\"logoMark\"],body.dts-on [class*=\"brandMark\"],body.dts-on [class*=\"brand-mark\"],body.dts-on [class*=\"wordmark\"],body.dts-on [class*=\"harnessBadge\"],body.dts-on [class*=\"productBadge\"],body.dts-on [class*=\"badge\"] *,body.dts-on [class*=\"Badge\"] *,body.dts-on [class*=\"wordmark\"] *,body.dts-on [class*=\"harnessBadge\"] *,body.dts-on [class*=\"productBadge\"] *{background:transparent!important;border-color:transparent!important;box-shadow:none!important}",
			"body.dts-on [class*=\"_tag_\"][data-tone=\"solid\"]{background:var(--dsw-alias-button-elevated-fill,rgba(16,18,22,.82))!important;color:var(--dsw-alias-label-primary)!important;backdrop-filter:" + GLASS_BLUR + "!important}",
			"select{color-scheme:dark}",
			"select option{background:#16181d;color:var(--dsw-alias-label-primary)}",
			"select option:hover{background:#263148}",
			"select option:checked{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}",
			":root{--dts-glass-fill:transparent;--dts-glass-fill-thin:rgba(16,20,24,.28);--dts-glass-blur:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%))}",
			"@media (max-width:720px){.dts-row{flex-direction:column;align-items:stretch;gap:8px}.dts-row-control{justify-content:flex-start}.dts-token-row,.dts-token-row.dts-profile-row{grid-template-columns:1fr}}",
			"@media (prefers-reduced-motion: reduce){.dts-page *,.dts-suggest,.dts-layer{transition-duration:0s!important;animation-duration:0s!important}}",
			"body.dts-on.dts-reduced-transparency,body.dts-on.dts-reduced-transparency *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"
		].join("\n");
		//#endregion
		//#region src/client/caption-menu.ts
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
		/**
		* 记住焦点所在的编辑器：面板是 `body` 上的固定层，点它会把焦点抢走，
		* 而编辑命令必须作用在**编辑器**上 —— 打开时存、执行命令前还回去
		* （与 preload 里 `restoreEditor()` 同一套动作）。
		*/
		function rememberEditor() {
			const el = document.activeElement;
			if (el instanceof HTMLInputElement) return {
				el,
				start: el.selectionStart,
				end: el.selectionEnd
			};
			if (el instanceof HTMLTextAreaElement) return {
				el,
				start: el.selectionStart,
				end: el.selectionEnd
			};
			if (el instanceof HTMLElement && el.isContentEditable) return {
				el,
				start: void 0,
				end: void 0
			};
			return null;
		}
		function restoreEditor(saved) {
			if (saved === null) return;
			const el = saved.el;
			if (!el.isConnected) return;
			try {
				el.focus({ preventScroll: true });
				if (saved.start != null && saved.end != null && typeof el.setSelectionRange === "function") el.setSelectionRange(saved.start, saved.end);
			} catch (err) {}
		}
		/**
		* 执行编辑命令。返回值告诉调用方**这次到底成没成** —— 早先失败是静默的：
		* `undo` 在无撤销栈、`cut/copy` 在无选区时都返回 false，用户点了菜单什么都不发生，
		* 分不清"命令失败"还是"没生效"。现在把成败透出去，由面板给一条可见提示。
		*/
		function runEditCommand(cmd, saved) {
			restoreEditor(saved);
			let done = false;
			try {
				done = document.execCommand(cmd);
			} catch (err) {
				done = false;
			}
			if (done) return true;
			if (cmd !== "paste") return false;
			const active = document.activeElement;
			if (!(active !== null && active !== document.body && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLElement && active.isContentEditable))) return false;
			return active.dispatchEvent(new KeyboardEvent("keydown", {
				key: "v",
				code: "KeyV",
				ctrlKey: true,
				bubbles: true,
				cancelable: true
			})) === false;
		}
		/** 与主进程 edit 菜单逐项对齐（label / 快捷键 / 命令一字不差）。 */
		function editEntries() {
			return [
				{
					kind: "cmd",
					label: t("menu.undo"),
					accel: "Ctrl+Z",
					cmd: "undo"
				},
				{
					kind: "cmd",
					label: t("menu.redo"),
					accel: "Ctrl+Y",
					cmd: "redo"
				},
				{ kind: "sep" },
				{
					kind: "cmd",
					label: t("menu.cut"),
					accel: "Ctrl+X",
					cmd: "cut"
				},
				{
					kind: "cmd",
					label: t("menu.copy"),
					accel: "Ctrl+C",
					cmd: "copy"
				},
				{
					kind: "cmd",
					label: t("menu.paste"),
					accel: "Ctrl+V",
					cmd: "paste"
				},
				{
					kind: "cmd",
					label: t("menu.delete"),
					accel: "Delete",
					cmd: "delete"
				},
				{ kind: "sep" },
				{
					kind: "cmd",
					label: t("menu.selectAll"),
					accel: "Ctrl+A",
					cmd: "selectAll"
				}
			];
		}
		/**
		* 挂载顶条菜单的拦截：返回卸载函数。
		* 找不到 `[data-windows-menu]`（非 Windows / preload 尚未装）时只登记监听、
		* 每次点击现查 —— 菜单条是 MutationObserver 挂上来的，装的时机不归我们管。
		*/
		function installCaptionMenu() {
			/**
			* 挂到**浮层容器**（`shell.overlay` 里的 `#dts-overlay-host`）——
			* 官方 `practices.md:36` 明令「不要在自己组件之外写 DOM、不要 append 到 body」。
			* 容器缺席时（老宿主 / 时序未到）才退回 `document.body`，保证功能不丢。
			*/
			function mountToOverlay(node) {
				var overlay = document.getElementById("dts-overlay-host");
				(overlay === null || overlay === void 0 ? document.body : overlay).appendChild(node);
			}
			let panel = null;
			let saved = null;
			let expandedButton = null;
			let toast = null;
			let toastTimer = 0;
			const close = () => {
				if (panel !== null) {
					panel.remove();
					panel = null;
				}
				if (expandedButton !== null) {
					expandedButton.setAttribute("aria-expanded", "false");
					expandedButton = null;
				}
			};
			/** 撤掉提示条并停掉它的定时器。幂等：没有提示条时是空操作。 */
			const hideToast = () => {
				if (toastTimer !== 0) {
					clearTimeout(toastTimer);
					toastTimer = 0;
				}
				if (toast !== null) {
					toast.remove();
					toast = null;
				}
			};
			/** 面板内的菜单项（不含分隔符）。键盘导航与焦点圈闭都要用。 */
			const itemsOf = (root) => Array.prototype.slice.call(root.querySelectorAll(".dts-cmenu-item"));
			/**
			* 失败提示：`role="status"` + `aria-live="polite"`，读屏与视觉都能拿到。
			* 没有它的话，命令失败 = 界面毫无反应，用户无法区分"失败"和"没点中"。
			* ⚠️ 先 `hideToast()` 再挂新的：连点两次失败**只留一条**提示、**只留一个**
			* 定时器（旧实现每次 notify 都新起一个 setTimeout，句柄谁也不认识）。
			*/
			const notify = (message) => {
				hideToast();
				const node = document.createElement("div");
				node.className = "dts-cmenu-toast";
				node.setAttribute("role", "status");
				node.setAttribute("aria-live", "polite");
				node.textContent = message;
				mountToOverlay(node);
				toast = node;
				toastTimer = window.setTimeout(() => {
					toastTimer = 0;
					if (toast === node) {
						node.remove();
						toast = null;
					}
				}, 2400);
			};
			const open = (anchor, entries) => {
				const rect = anchor.getBoundingClientRect();
				saved = rememberEditor();
				const root = document.createElement("div");
				root.className = "dts-cmenu";
				root.setAttribute("role", "menu");
				root.tabIndex = -1;
				for (const entry of entries) {
					if (entry.kind === "sep") {
						const divider = document.createElement("div");
						divider.className = "dts-cmenu-sep";
						divider.setAttribute("role", "separator");
						root.appendChild(divider);
						continue;
					}
					const button = document.createElement("button");
					button.type = "button";
					button.className = "dts-cmenu-item";
					button.setAttribute("role", "menuitem");
					button.tabIndex = -1;
					const label = document.createElement("span");
					label.textContent = entry.label;
					button.appendChild(label);
					if (entry.kind === "cmd") {
						const key = document.createElement("kbd");
						key.textContent = entry.accel;
						button.appendChild(key);
					}
					button.addEventListener("click", () => {
						const cmd = entry.kind === "cmd" ? entry.cmd : "";
						close();
						if (!runEditCommand(cmd, saved)) notify(t("menu.noop", entry.label));
						else restoreEditor(saved);
					});
					root.appendChild(button);
				}
				mountToOverlay(root);
				const size = root.getBoundingClientRect();
				const gap = 4;
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				let left = rect.left;
				if (left + size.width > vw - gap) left = Math.max(gap, vw - gap - size.width);
				let top = rect.bottom + gap;
				if (top + size.height > vh - gap) {
					const above = rect.top - gap - size.height;
					top = above >= gap ? above : Math.max(gap, vh - gap - size.height);
				}
				root.style.left = `${Math.round(left)}px`;
				root.style.top = `${Math.round(top)}px`;
				panel = root;
				expandedButton = anchor;
				expandedButton.setAttribute("aria-expanded", "true");
				const first = itemsOf(root)[0];
				if (first !== void 0) first.tabIndex = 0;
				try {
					(first ?? root).focus({ preventScroll: true });
				} catch (err) {}
			};
			/**
			* 面板内键盘契约（对齐官方 Menu 与自家 Choice，同一插件不搞两套）：
			* ↑↓ wrap、Home/End 首尾、Enter/Space 执行、Esc 关并把焦点交还锚点、
			* Tab 在面板内圈闭（跑出去就会出现"面板悬空但焦点已在宿主页面"）。
			*/
			const onPanelKey = (event) => {
				if (panel === null) return;
				const items = itemsOf(panel);
				if (items.length === 0) return;
				const at = items.indexOf(document.activeElement);
				const moveTo = (index) => {
					event.preventDefault();
					for (const it of items) it.tabIndex = -1;
					const node = items[(index + items.length) % items.length];
					node.tabIndex = 0;
					node.focus();
				};
				if (event.key === "ArrowDown") return moveTo(at + 1);
				if (event.key === "ArrowUp") return moveTo(at - 1);
				if (event.key === "Home") return moveTo(0);
				if (event.key === "End") return moveTo(items.length - 1);
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					if (at >= 0) items[at].click();
					return;
				}
				if (event.key === "Tab") {
					event.preventDefault();
					event.stopPropagation();
					moveTo(event.shiftKey ? at - 1 : at + 1);
				}
			};
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
				const host = document.querySelector("[data-windows-menu]");
				if (host === null) return null;
				const shadow = host.shadowRoot;
				const bar = shadow === void 0 || shadow === null ? null : shadow.querySelector("[role=\"menubar\"]");
				if (bar === null) return null;
				const items = Array.prototype.slice.call(bar.querySelectorAll("[role=\"menuitem\"][aria-haspopup=\"menu\"]"));
				if (items.length !== 2) return null;
				return {
					application: items[0],
					edit: items[1]
				};
			};
			const onDocumentClick = (event) => {
				const buttons = menuButtons();
				if (buttons === null) return;
				if ((typeof event.composedPath === "function" ? event.composedPath() : []).indexOf(buttons.edit) === -1) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				if (panel !== null) {
					close();
					return;
				}
				open(buttons.edit, editEntries());
			};
			const onDocumentKey = (event) => {
				if (panel === null) return;
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					const back = expandedButton;
					close();
					if (back !== null && typeof back.focus === "function") try {
						back.focus({ preventScroll: true });
					} catch (err) {}
					return;
				}
				onPanelKey(event);
			};
			const onDocumentPointer = (event) => {
				if (panel === null) return;
				if ((typeof event.composedPath === "function" ? event.composedPath() : []).indexOf(panel) !== -1) return;
				close();
			};
			document.addEventListener("click", onDocumentClick, true);
			document.addEventListener("keydown", onDocumentKey, true);
			document.addEventListener("pointerdown", onDocumentPointer, true);
			return () => {
				document.removeEventListener("click", onDocumentClick, true);
				document.removeEventListener("keydown", onDocumentKey, true);
				document.removeEventListener("pointerdown", onDocumentPointer, true);
				close();
				hideToast();
			};
		}
		//#endregion
		//#region src/client/controls/runtime.ts
		/**
		* controls/runtime.ts —— 自写控件层的**内部**运行时垫片。
		*
		* 存在的唯一理由：官方规范禁止插件 `require('@deepseek-ai/dsh-client-ui-primitives')`
		* （references_practices.md:35），控件必须自写。自写之后有四个东西是所有控件共用的，
		* 与其在 19 个控件里各抄一遍，不如集中一份：
		*
		*   1. react 基座 —— 与 src/client/deps.ts 同形（裸 `require('react')`，由 loader 注入）；
		*   2. `e` / `clsx` —— createElement 简写与类名拼接（官方 clsx 的等价最小面）；
		*   3. 宿主 DOM 契约 —— `focusWithoutRing` / `overlayTopMargin` / `observeComposition` /
		*      `isBehindModal` / `useModalLayer` / `useAnchoredPosition`；
		*   4. 输入模态 —— Tooltip 判断"这次聚焦是否来自键盘"。
		*
		* 全部逐字抄自官方产物，来源：
		*   - focusWithoutRing            lib/index.js:3594-3631（lib/types/focus.js）
		*   - useModalLayer/isBehindModal lib/index.js:3632-3719（lib/types/useModalLayer.js）
		*   - observeComposition          lib/index.js:3551-3592（lib/types/keyboard-composition.js）
		*   - overlayTopMargin            lib/index.js:3504-3520（lib/types/overlay-top-margin.js）
		*   - useAnchoredPosition         lib/index.js:4288-4356（lib/types/useAnchoredPosition.js）
		*   - 输入模态语义                lib/index.js:4422-4485（lib/types/input-modality.js）
		*
		* 与官方实现的两处**有意差异**（本层纪律要求，见 ui-align/05-controls-port.md）：
		*   - 输入模态不装模块级常驻监听：官方在 import 期即挂 window 监听且永不卸载；
		*     本层改为**引用计数**订阅（首个订阅者挂、最后一个卸载时摘），既保留
		*     "指针交互后聚焦不弹 Tooltip" 的行为，又不留常驻全局监听。
		*   - 不写 `data-input-modality` 属性：那是宿主（web 壳自带的 ui-primitives）发布的
		*     全局事实，本层只读、不与之争抢写权。
		*/
		/** 与 deps.ts 同形：裸 require 交给 loader。 */
		var React = require("react");
		var createPortal = require("react-dom").createPortal;
		var forwardRef = React.forwardRef;
		var memo = React.memo;
		var Fragment = React.Fragment;
		var cloneElement = React.cloneElement;
		var useCallback = React.useCallback;
		var useEffect = React.useEffect;
		var useId = React.useId;
		var useLayoutEffect = React.useLayoutEffect;
		React.useMemo;
		var useRef = React.useRef;
		var useState = React.useState;
		/**
		* createElement 简写。
		* 与 deps.ts 的 `e` 同形：可变子节点走 rest params（不要改箭头函数 + arguments）。
		*/
		function e(type, props, ...children) {
			return React.createElement.apply(React, [type, props].concat(children));
		}
		/** 官方 clsx 的最小等价面：字符串保留，假值与别的类型丢弃。 */
		function clsx(...parts) {
			var out = [];
			for (var i = 0; i < parts.length; i += 1) {
				var part = parts[i];
				if (typeof part === "string" && part !== "") out.push(part);
			}
			return out.join(" ");
		}
		/** 官方 focus.js 的自动聚焦标记；对应样式由 ui-theme 的 base.css 提供。 */
		var AUTOMATIC_FOCUS_ATTRIBUTE = "data-dsh-automatic-focus";
		/**
		* 浮层距视口顶边的净空。macOS 桌面由框架在根元素发布
		* `--dsh-frame-top-clearance`（红绿灯条下方的恒定步进）；别处该属性缺省，
		* 直接用调用方给的下限。
		* @param min 浮层自己的视口边距（px），作为下限。
		* @returns `min` 与框架发布的顶边净空中的较大者。
		*/
		function overlayTopMargin(min) {
			var clearance = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dsh-frame-top-clearance"));
			return Number.isNaN(clearance) ? min : Math.max(min, clearance);
		}
		/**
		* 把 fixed 定位的浮动面板锚在触发器上（官方 useAnchoredPosition 逐字）。
		* 面板从锚点的视口矩形定位，滚一下就不再成立——这个钩子只管这一件事：
		* 量锚点、按上下偏移、把结果钳进视口，并在滚动（捕获阶段，覆盖嵌套滚动容器）、
		* 缩放、面板自身尺寸变化时重算。
		* @param options 开关状态、两个 ref、placement 与间距。
		* @returns 面板的 `left`/`top`，首次测量前为 null。
		*/
		function useAnchoredPosition(options) {
			var open = options.open;
			var anchorRef = options.anchorRef;
			var panelRef = options.panelRef;
			var side = options.side === void 0 ? "bottom" : options.side;
			var align = options.align === void 0 ? "start" : options.align;
			var gap = options.gap;
			var margin = options.margin;
			var state = useState(null);
			var position = state[0];
			var setPosition = state[1];
			useLayoutEffect(function() {
				if (!open) {
					setPosition(null);
					return;
				}
				var place = function() {
					var rect = anchorRef.current === null || anchorRef.current === void 0 ? void 0 : anchorRef.current.getBoundingClientRect();
					if (rect === void 0) return;
					var panel = panelRef.current;
					var width = panel === null || panel === void 0 ? 0 : panel.offsetWidth;
					var height = panel === null || panel === void 0 ? 0 : panel.offsetHeight;
					var left = align === "end" ? rect.right - width : rect.left;
					var top = side === "top" ? rect.top - gap - height : rect.bottom + gap;
					if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
					if (height > 0) top = Math.min(Math.max(top, margin), window.innerHeight - height - margin);
					setPosition({
						left,
						top
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				var panel = panelRef.current;
				var observer = null;
				if (typeof ResizeObserver !== "undefined" && panel !== null && panel !== void 0) {
					observer = new ResizeObserver(place);
					observer.observe(panel);
				}
				return function() {
					if (observer !== null) observer.disconnect();
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				open,
				anchorRef,
				panelRef,
				side,
				align,
				gap,
				margin
			]);
			return position;
		}
		/** 自动进入与归还焦点时的呈现策略（官方 focus.js releases 表）。 */
		var releases = /* @__PURE__ */ new WeakMap();
		var navigationKeys = /* @__PURE__ */ new Set([
			"Tab",
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight",
			"Home",
			"End"
		]);
		/**
		* 自动目的地聚焦但不画焦点框，直到键盘导航或失焦。
		* 主题在 `data-dsh-automatic-focus` 存在时抑制轮廓；边框与阴影保持。
		* @param element 接收自动聚焦的控件或容器。
		* @param options 浏览器 focus 选项（含 scroll 保持）。
		*/
		function focusWithoutRing(element, options) {
			var existing = releases.get(element);
			if (existing !== void 0) existing();
			var release = function() {
				element.removeAttribute(AUTOMATIC_FOCUS_ATTRIBUTE);
				element.removeEventListener("blur", release);
				element.removeEventListener("keydown", navigate, true);
				releases.delete(element);
			};
			var navigate = function(event) {
				if (!event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey && navigationKeys.has(event.key)) release();
			};
			releases.set(element, release);
			element.setAttribute(AUTOMATIC_FOCUS_ATTRIBUTE, "");
			element.addEventListener("blur", release);
			element.addEventListener("keydown", navigate, true);
			element.focus(options);
			if (!element.matches(":focus")) release();
		}
		/**
		* 观察 composition 直到其结束键被释放或消费（官方 keyboard-composition.js 逐字）。
		* 调用方**必须**在交互生命周期结束时调用 `dispose()`。
		* @param doc 事件归属的 document。
		* @returns 事件守卫与释放器。
		*/
		function observeComposition(doc) {
			var composing = false;
			var ended = false;
			var start = function() {
				composing = true;
			};
			var end = function() {
				composing = false;
				ended = true;
			};
			var release = function() {
				ended = false;
			};
			var blur = function() {
				composing = false;
				ended = false;
			};
			doc.addEventListener("compositionstart", start, true);
			doc.addEventListener("compositionend", end, true);
			doc.addEventListener("keyup", release, true);
			if (doc.defaultView !== null && doc.defaultView !== void 0) doc.defaultView.addEventListener("blur", blur);
			return {
				guards: function(event) {
					var guarded = composing || ended || event.isComposing || event.keyCode === 229;
					ended = false;
					return guarded;
				},
				dispose: function() {
					doc.removeEventListener("compositionstart", start, true);
					doc.removeEventListener("compositionend", end, true);
					doc.removeEventListener("keyup", release, true);
					if (doc.defaultView !== null && doc.defaultView !== void 0) doc.defaultView.removeEventListener("blur", blur);
				}
			};
		}
		/** document → 该文档已注册的模态层栈。 */
		var layers = /* @__PURE__ */ new WeakMap();
		/**
		* 锚点是否位于当前模态之后、必须让出键盘输入。
		* @param anchor 持有输入处理的本地控件。
		* @returns 另一个模态占据前台时为 true。
		*/
		function isBehindModal(anchor) {
			if (anchor === null || anchor === void 0) return false;
			var stack = layers.get(anchor.ownerDocument);
			var top = stack === void 0 ? void 0 : stack[stack.length - 1];
			return top !== void 0 && !top.element.contains(anchor);
		}
		var focusable = "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex=\"0\"]";
		/**
		* 只把 Escape 与 Tab 交给最上层模态，关闭时归还先前的焦点（官方 useModalLayer 逐字）。
		* 自动进入与归还焦点不画轮廓；键盘遍历保留指示器。
		* 用 `data-modal-autofocus` 标记弹窗的初始控件（React autoFocus 会先于本层保存触发控件）。
		* @param dialog 已挂载的 dialog 元素 ref。
		* @param open 本层是否生效。
		* @param onClose 顶层 Escape 或应用关闭动作。
		*/
		function useModalLayer(dialog, open, onClose) {
			var close = useRef(onClose);
			close.current = onClose;
			useLayoutEffect(function() {
				var element = dialog.current;
				if (!open || element === null || element === void 0) return void 0;
				var doc = element.ownerDocument;
				var composition = observeComposition(doc);
				var previous = doc.activeElement;
				var stack = layers.get(doc);
				if (stack === void 0) {
					stack = [];
					layers.set(doc, stack);
				}
				var layer = {
					element,
					close: function() {
						close.current();
					}
				};
				stack.push(layer);
				var initial = element.querySelector("[data-modal-autofocus]") || element.querySelector(focusable) || element;
				if (!element.contains(doc.activeElement)) focusWithoutRing(initial);
				var keydown = function(event) {
					var composing = composition.guards(event);
					if (stack[stack.length - 1] !== layer || event.defaultPrevented || composing || event.ctrlKey || event.altKey || event.metaKey) return;
					if (event.key === "Escape" && !event.shiftKey) {
						event.preventDefault();
						if (!event.repeat) close.current();
					}
					if (event.key !== "Tab") return;
					if (doc.activeElement !== null && doc.activeElement.closest !== void 0 && doc.activeElement.closest("[role=\"menu\"], [role=\"listbox\"]") !== null) return;
					var items = Array.prototype.slice.call(element.querySelectorAll(focusable)).filter(function(item) {
						return item.closest("[inert], [hidden]") === null;
					});
					var first = items.length === 0 ? element : items[0];
					var last = items.length === 0 ? element : items[items.length - 1];
					var atEdge = event.shiftKey ? doc.activeElement === first : doc.activeElement === last;
					if (doc.activeElement === element || !element.contains(doc.activeElement) || atEdge) {
						event.preventDefault();
						(event.shiftKey ? last : first).focus();
					}
				};
				doc.addEventListener("keydown", keydown);
				return function() {
					composition.dispose();
					var wasTop = stack[stack.length - 1] === layer;
					stack.splice(stack.indexOf(layer), 1);
					doc.removeEventListener("keydown", keydown);
					if (stack.length === 0) layers.delete(doc);
					if (wasTop) {
						var target = previous instanceof HTMLElement && previous.isConnected ? previous : stack.length === 0 ? void 0 : stack[stack.length - 1].element;
						if (target !== void 0) focusWithoutRing(target);
					}
				};
			}, [dialog, open]);
		}
		/** `data-input-modality` 的取值（宿主 ui-theme 的焦点样式也读它）。 */
		var INPUT_MODALITY = {
			pointer: "pointer",
			keyboard: "keyboard"
		};
		var pointerLast = false;
		var subscriberCount = 0;
		var detachModality = null;
		function seedModalityFromHost() {
			var published = document.documentElement.getAttribute("data-input-modality");
			if (published === INPUT_MODALITY.pointer) pointerLast = true;
			else if (published === INPUT_MODALITY.keyboard) pointerLast = false;
		}
		/**
		* 最近一次输入是否来自指针（与焦点环是否可见无关）。
		* @returns 指针输入之后为 true；任意按键之后为 false。
		*/
		function pointerModality() {
			return pointerLast;
		}
		/**
		* 按引用计数订阅输入模态：首个订阅者挂 window 监听，最后一个卸载时摘掉。
		* 初值从宿主已发布的 `data-input-modality` 播种（只读，不写回）。
		* @returns 退订函数（务必在 effect 的清理里调用）。
		*/
		function subscribeInputModality() {
			if (subscriberCount === 0 && typeof window !== "undefined") {
				seedModalityFromHost();
				var onPointerDown = function() {
					pointerLast = true;
				};
				var onKeyDown = function() {
					pointerLast = false;
				};
				var onBlur = function() {
					pointerLast = false;
				};
				window.addEventListener("pointerdown", onPointerDown, true);
				window.addEventListener("keydown", onKeyDown, true);
				window.addEventListener("blur", onBlur);
				detachModality = function() {
					window.removeEventListener("pointerdown", onPointerDown, true);
					window.removeEventListener("keydown", onKeyDown, true);
					window.removeEventListener("blur", onBlur);
				};
			}
			subscriberCount += 1;
			var disposed = false;
			return function() {
				if (disposed) return;
				disposed = true;
				subscriberCount -= 1;
				if (subscriberCount === 0 && detachModality !== null) {
					detachModality();
					detachModality = null;
				}
			};
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Button.module.css.mjs
		const css$18 = ".COG2Re_dtsBtn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px;}.COG2Re_dtsBtn:disabled{ cursor:not-allowed; opacity:.4;}.COG2Re_dtsBtnMd{height:36px;}.COG2Re_dtsBtnSm{height:28px;font-size:12px;line-height:18px;padding:0 10px;border-radius:var(--dsw-radius-sm);}.COG2Re_dtsBtnPrimary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}.COG2Re_dtsBtnPrimary:hover:not(:disabled){ background:var(--dsw-alias-button-primary-hover);}.COG2Re_dtsBtnGhost:hover:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover);}.COG2Re_dtsBtnGhost:active:not(:disabled){ background:var(--dsw-alias-interactive-bg-active);}.COG2Re_dtsBtnOutline{border:.5px solid var(--dsw-alias-border-l3);background:transparent;}.COG2Re_dtsBtnOutline:hover:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover);}.COG2Re_dtsBtnToolbar{background:var(--dsw-alias-button-tool-bar-fill);}.COG2Re_dtsBtnToolbar:hover:not(:disabled){ background:var(--dsw-alias-button-tool-bar-hover);}.COG2Re_dtsBtnIcon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;}";
		const tagId$18 = "dsh-theme-studio/src/client/controls/Button.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$18) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$18;
			tag.textContent = css$18;
			document.head.appendChild(tag);
		}
		var src_client_controls_Button_module_css_default = {
			"dtsBtn": "COG2Re_dtsBtn",
			"dtsBtnGhost": "COG2Re_dtsBtnGhost",
			"dtsBtnIcon": "COG2Re_dtsBtnIcon",
			"dtsBtnMd": "COG2Re_dtsBtnMd",
			"dtsBtnOutline": "COG2Re_dtsBtnOutline",
			"dtsBtnPrimary": "COG2Re_dtsBtnPrimary",
			"dtsBtnSm": "COG2Re_dtsBtnSm",
			"dtsBtnToolbar": "COG2Re_dtsBtnToolbar"
		};
		//#endregion
		//#region src/client/controls/Button.ts
		/**
		* controls/Button.ts —— 官方 Button 的自写替代（不 require primitives）。
		*
		* 官方来源：lib/index.js:3170-3190（lib/types/Button.js）+ lib/Button.module.css。
		* 抄了什么：markup 结构（button[type=button] + 可选 16px 前置图标 span）、
		* `variant` 四值 primary/ghost/outline/toolbar（默认 ghost）、`size` md(36px/12px 圆角)
		* / sm(28px/8px 圆角)、`icon`、ref 指向原生 button、其余原生属性透传。
		* 改了什么：官方 `css[variant]` / `css[size]` 的动态查表，在本层换成显式映射
		* （localName 带 dts 前缀后不能再用裸 variant 当键）；类名前缀 dts。
		* 保留的行为：原生 button 语义（Space/Enter 激活）、禁用态不可聚焦、
		* 焦点环由主题的全局 `:focus-visible` 兜底（官方也没有自己的 focus 规则）。
		*/
		var VARIANT_CLASS = {
			primary: src_client_controls_Button_module_css_default.dtsBtnPrimary,
			ghost: src_client_controls_Button_module_css_default.dtsBtnGhost,
			outline: src_client_controls_Button_module_css_default.dtsBtnOutline,
			toolbar: src_client_controls_Button_module_css_default.dtsBtnToolbar
		};
		var SIZE_CLASS = {
			md: src_client_controls_Button_module_css_default.dtsBtnMd,
			sm: src_client_controls_Button_module_css_default.dtsBtnSm
		};
		/**
		* 渲染一个按钮。
		* props.variant - 视觉族（默认 'ghost'）。
		* props.size - 'md' 36px 控件 12px 圆角，或 'sm' 28px 控件 8px 圆角。
		* props.icon - 可选的前置 16px 图标节点。
		* @param ref - 原生 button，供焦点控制与浮层锚定使用。
		* @returns button 元素；原生 button 属性透传。
		*/
		var Button = forwardRef(function Button(props, ref) {
			var variant = props.variant === void 0 ? "ghost" : props.variant;
			var size = props.size === void 0 ? "md" : props.size;
			var rest = {};
			for (var key in props) {
				if (key === "variant" || key === "size" || key === "icon" || key === "className" || key === "children") continue;
				if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
				rest[key] = props[key];
			}
			return e("button", Object.assign({
				ref,
				type: "button",
				className: clsx(src_client_controls_Button_module_css_default.dtsBtn, VARIANT_CLASS[variant], SIZE_CLASS[size], props.className)
			}, rest), props.icon != null ? e("span", {
				className: src_client_controls_Button_module_css_default.dtsBtnIcon,
				key: "icon"
			}, props.icon) : null, props.children);
		});
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Switch.module.css.mjs
		const css$17 = ".MRWT00_dtsSwitch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer;}.MRWT00_dtsSwitch[aria-checked='true']{background:var(--dsw-alias-brand-primary);}.MRWT00_dtsSwitch:disabled{ cursor:default; opacity:.5;}.MRWT00_dtsSwitch:focus-visible{ outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px;}.MRWT00_dtsSwitchThumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform 120ms ease;}.MRWT00_dtsSwitch[aria-checked='true'] .MRWT00_dtsSwitchThumb{transform:translateX(16px);}";
		const tagId$17 = "dsh-theme-studio/src/client/controls/Switch.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$17) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$17;
			tag.textContent = css$17;
			document.head.appendChild(tag);
		}
		var src_client_controls_Switch_module_css_default = {
			"dtsSwitch": "MRWT00_dtsSwitch",
			"dtsSwitchThumb": "MRWT00_dtsSwitchThumb"
		};
		//#endregion
		//#region src/client/controls/Switch.ts
		/**
		* controls/Switch.ts —— 官方 Switch 的自写替代。
		*
		* 官方来源：lib/index.js:3345-3371（lib/types/Switch.js）+ lib/Switch.module.css。
		* 抄了什么：36×20 几何、`role="switch"` + `aria-checked`、`onChange(!checked)` 的
		* 完全受控语义、`label` 必填（官方原话：控件不可能在没有名称的情况下发布）、
		* `disabled` / `title` / `className`、拇指 span 的位移由 CSS 按 aria-checked 驱动。
		* 改了什么：类名前缀 dts；`aria-checked` 仍传布尔值（React 渲染为 "true"/"false"，
		* 与官方产物一致，CSS 选择器 `[aria-checked='true']` 因此成立）。
		* 保留的行为：键盘可达性 —— 控件是原生 `<button>`，Space/Enter 由浏览器转成 click，
		* 官方也没有额外的 keydown 处理器；禁用态不可聚焦。
		*/
		/**
		* 渲染一个开关。
		* props.checked - 当前状态；控件完全受控。
		* props.onChange - 以点击请求的目标状态调用。
		* props.label - 本地化的无障碍名称。
		* props.disabled - 是否拒绝输入。
		* props.title - 本地化的悬停文本。
		* props.className - 布局定位的额外类名。
		* @returns switch 元素。
		*/
		function Switch(props) {
			return e("button", {
				type: "button",
				role: "switch",
				"aria-checked": props.checked,
				"aria-label": props.label,
				title: props.title,
				disabled: props.disabled === void 0 ? false : props.disabled,
				className: clsx(src_client_controls_Switch_module_css_default.dtsSwitch, props.className),
				onClick: function() {
					props.onChange(!props.checked);
				}
			}, e("span", { className: src_client_controls_Switch_module_css_default.dtsSwitchThumb }));
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Checkbox.module.css.mjs
		const css$16 = ".abD3OK_dtsCheckbox{display:inline-flex;align-items:center;gap:6px;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);cursor:pointer;}.abD3OK_dtsCheckbox input{flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:inherit;}.abD3OK_dtsCheckbox input:focus-visible{ outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px;}.abD3OK_dtsCheckbox:has(input:disabled){ cursor:default; opacity:.5;}";
		const tagId$16 = "dsh-theme-studio/src/client/controls/Checkbox.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$16) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$16;
			tag.textContent = css$16;
			document.head.appendChild(tag);
		}
		var src_client_controls_Checkbox_module_css_default = { "dtsCheckbox": "abD3OK_dtsCheckbox" };
		//#endregion
		//#region src/client/controls/Checkbox.ts
		/**
		* controls/Checkbox.ts —— 官方 Checkbox 的自写替代。
		*
		* 官方来源：lib/index.js:3458-3483（lib/types/Checkbox.js）+ lib/Checkbox.module.css。
		* 抄了什么：`<label>` 包住原生 `<input type="checkbox">` 加一个文案 span —— 可见文案
		* 同时就是无障碍名称（原生 label 关联，不需要额外的 aria 属性）；受控 `checked`、
		* `onChange(event.target.checked)`、`disabled` / `title` / `className`（落在 label 上）；
		* 16px 方框用 `accent-color: var(--dsw-alias-brand-primary)` 上色。
		* 改了什么：类名前缀 dts。
		* 保留的行为：键盘（Tab 进入、Space 切换）与表单语义全部来自原生 checkbox；
		* 禁用态由 `:has(input:disabled)` 降透明并改光标。
		*/
		/**
		* 渲染一个带文案的原生复选框。
		* props.checked - 当前勾选状态。
		* props.onChange - 以请求的勾选状态调用。
		* props.label - 本地化的可见且无障碍文案。
		* props.disabled - 是否拒绝更改。
		* props.title - 可选悬停文本。
		* props.className - label 的定位类名。
		* @returns 包住自身复选框的 label。
		*/
		function Checkbox(props) {
			return e("label", {
				className: clsx(src_client_controls_Checkbox_module_css_default.dtsCheckbox, props.className),
				title: props.title
			}, e("input", {
				type: "checkbox",
				checked: props.checked,
				disabled: props.disabled === void 0 ? false : props.disabled,
				onChange: function(event) {
					props.onChange(event.target.checked);
				}
			}), e("span", null, props.label));
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Pill.module.css.mjs
		const css$15 = ".c3RekS_dtsPill{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border:none;border-radius:999px;corner-shape:round;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);}.c3RekS_dtsPillInteractive{cursor:pointer;}.c3RekS_dtsPillInteractive:hover{ background:var(--dsw-alias-interactive-bg-hover);}.c3RekS_dtsPillActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-ghost-active-fill);box-shadow:inset 0 0 0 1px var(--dsw-alias-button-ghost-active-border);}";
		const tagId$15 = "dsh-theme-studio/src/client/controls/Pill.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$15) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$15;
			tag.textContent = css$15;
			document.head.appendChild(tag);
		}
		var src_client_controls_Pill_module_css_default = {
			"dtsPill": "c3RekS_dtsPill",
			"dtsPillActive": "c3RekS_dtsPillActive",
			"dtsPillInteractive": "c3RekS_dtsPillInteractive"
		};
		//#endregion
		//#region src/client/controls/Pill.ts
		/**
		* controls/Pill.ts —— 官方 Pill 的自写替代。
		*
		* 官方来源：lib/index.js:3192-3211（lib/types/Pill.js）+ lib/Pill.module.css。
		* 抄了什么：`onClick` 存在时渲染 `<button>`（可选中胶囊），否则渲染静态 `<span>`——
		* 这是官方的关键判据，不是装饰；`active` 默认 false；`...rest` **在 onClick 之后**展开
		* （官方顺序也如此，SegmentedTabs 正是靠这一点把 role/aria-selected/tabIndex/id/onKeyDown
		* 灌进来，且这套顺序必须原样保留）。
		* 改了什么：类名前缀 dts。
		* 保留的行为：`active` 是"已选中"的视觉态；可交互形态的键盘可达性来自原生 button。
		*/
		/**
		* 渲染一枚胶囊 chip。给出 `onClick` 时可交互（渲染 button）；否则是静态 span。
		* props.active - 选中/激活的视觉态。
		* @returns 胶囊元素。
		*/
		function Pill(props) {
			if (!props.onClick) return e("span", { className: clsx(src_client_controls_Pill_module_css_default.dtsPill, props.active && src_client_controls_Pill_module_css_default.dtsPillActive, props.className) }, props.children);
			var rest = {};
			for (var key in props) {
				if (key === "active" || key === "className" || key === "children" || key === "onClick") continue;
				if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
				rest[key] = props[key];
			}
			return e("button", Object.assign({
				type: "button",
				className: clsx(src_client_controls_Pill_module_css_default.dtsPill, src_client_controls_Pill_module_css_default.dtsPillInteractive, props.active && src_client_controls_Pill_module_css_default.dtsPillActive, props.className),
				onClick: props.onClick
			}, rest), props.children);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Tag.module.css.mjs
		const css$14 = ".SGEdgs_dtsTag{display:inline-flex;align-items:center;border-radius:999px;corner-shape:round;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;}.SGEdgs_dtsTag[data-tone='outline']{border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary);}.SGEdgs_dtsTag[data-tone='solid']{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);}.SGEdgs_dtsTag[data-tone='neutral']{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);}.SGEdgs_dtsTag[data-tone='quiet']{color:var(--dsw-alias-label-tertiary);}.SGEdgs_dtsTag[data-tone='success']{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary);}.SGEdgs_dtsTag[data-tone='info']{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary);}.SGEdgs_dtsTag[data-tone='warning']{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-primary);}.SGEdgs_dtsTag[data-tone='danger']{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);}";
		const tagId$14 = "dsh-theme-studio/src/client/controls/Tag.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$14) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$14;
			tag.textContent = css$14;
			document.head.appendChild(tag);
		}
		var src_client_controls_Tag_module_css_default = { "dtsTag": "SGEdgs_dtsTag" };
		//#endregion
		//#region src/client/controls/Tag.ts
		/**
		* controls/Tag.ts —— 官方 Tag 的自写替代。
		*
		* 官方来源：lib/index.js:3282-3296（lib/types/Tag.js）+ lib/Tag.module.css。
		* 抄了什么：只读徽章 `<span data-tone>`，tone 默认 `outline`，八种取值全部保留：
		* outline / solid / neutral / quiet / success / info / warning / danger
		* （官方 README.zh.md:51「`tone` 选择八种配色之一」；产物 CSS 里正好八条规则）。
		* 改了什么：类名前缀 dts；tone 用联合类型写死在 props 上（官方是 JSDoc，无从校验）。
		* 保留的行为：`Tag` 与 `Pill` **不可互换**（README.zh.md:76）——Tag 是 11px 只读徽章，
		* 没有 onClick/active，也没有交互态样式；需要可选中就用 Pill。
		*/
		/**
		* 渲染一枚只读标签。
		* props.tone - 使用哪套配色（默认 `outline`）。
		* props.className - 布局定位的额外类名。
		* props.children - 本地化文案。
		* @returns tag 元素。
		*/
		function Tag(props) {
			return e("span", {
				className: clsx(src_client_controls_Tag_module_css_default.dtsTag, props.className),
				"data-tone": props.tone === void 0 ? "outline" : props.tone
			}, props.children);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/StateDot.module.css.mjs
		const css$13 = ".fST0iN_dtsDot{position:relative;display:inline-block;flex:none;}.fST0iN_dtsDot::after{ content:''; position:absolute; inset:20%; border-radius:50%; corner-shape:round; background:currentColor;}.fST0iN_dtsDot[data-state='done']{color:var(--dsw-alias-state-success-primary);}.fST0iN_dtsDot[data-state='warning']{color:var(--dsw-alias-state-warn-primary);}.fST0iN_dtsDot[data-state='error']{color:var(--dsw-alias-state-error-primary);}.fST0iN_dtsDot[data-state='idle']{color:var(--dsw-alias-state-idle-primary);}.fST0iN_dtsSpinner{flex:none;color:var(--dsw-alias-label-tertiary);}.fST0iN_dtsSpinnerMotion{transform-origin:center;animation:fST0iN_dtsStateDotSpin 1.5s linear infinite;}.fST0iN_dtsSpinnerTrack,.fST0iN_dtsSpinnerArc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;}.fST0iN_dtsSpinnerTrack{opacity:.25;}.fST0iN_dtsSpinnerArc{stroke-dasharray:12 150;animation:fST0iN_dtsStateDotDash 1.5s ease-in-out infinite;}@keyframes fST0iN_dtsStateDotSpin{to{transform:rotate(360deg);}}@keyframes fST0iN_dtsStateDotDash{0%{stroke-dasharray:12 150;stroke-dashoffset:0;}50%{stroke-dasharray:24 150;stroke-dashoffset:-6;}100%{stroke-dasharray:12 150;stroke-dashoffset:0;}}@media(prefers-reduced-motion:reduce){ .fST0iN_dtsSpinnerMotion,.fST0iN_dtsSpinnerArc{ animation:none;} .fST0iN_dtsSpinnerArc{ stroke-dasharray:18 150; stroke-dashoffset:-3;}}.fST0iN_dtsStep{display:inline-flex;flex:none;align-items:center;justify-content:center;box-sizing:border-box;border-radius:50%;corner-shape:round;border:1.5px solid var(--dsw-alias-label-tertiary);color:var(--dsw-alias-label-primary-foreground);}.fST0iN_dtsStep[data-state='done']{border-color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-primary);}.fST0iN_dtsStep[data-state='error']{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary);}.fST0iN_dtsStep[data-state='warning']{border-color:var(--dsw-alias-state-warn-primary);}";
		const tagId$13 = "dsh-theme-studio/src/client/controls/StateDot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$13) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$13;
			tag.textContent = css$13;
			document.head.appendChild(tag);
		}
		var src_client_controls_StateDot_module_css_default = {
			"dtsDot": "fST0iN_dtsDot",
			"dtsSpinner": "fST0iN_dtsSpinner",
			"dtsSpinnerArc": "fST0iN_dtsSpinnerArc",
			"dtsSpinnerMotion": "fST0iN_dtsSpinnerMotion",
			"dtsSpinnerTrack": "fST0iN_dtsSpinnerTrack",
			"dtsStep": "fST0iN_dtsStep"
		};
		//#endregion
		//#region src/client/controls/StateDot.ts
		/**
		* controls/StateDot.ts —— 官方 StateDot 的自写替代。
		*
		* 官方来源：lib/index.js:3040-3094（lib/types/StateDot.js，含 `syncSpinner`）+
		* lib/StateDot.module.css。
		* 抄了什么：`state` 五态 done / warning / error / idle / ongoing；`size` 缺省时
		* ongoing 14px、实心态 10px；实心态是 10px 槽 + `::after` inset 20% 的 6px 圆核；
		* ongoing 是 24 viewBox 的 SVG（整环 + 呼吸弧，共用 1.5s 周期）且**把动画起始时间
		* 钉到文档时间零点**（`animation.startTime = 0`，官方注释：不同时刻挂载的 loader
		* 否则会错相旋转）；`aria-hidden="true"` —— 名称由渲染点提供；`appearance="step"` 变体。
		* 改了什么：类名前缀 dts；官方用的 `IconCheckOutlineRegular` 图标不能 require，
		* 这里把它 16 viewBox 的路径原样内联（Step 完成态的实心勾），尺寸仍按官方 `edge - 2`。
		* 保留的行为：ongoing 的 `getAnimations({ subtree: true })` 在 ref 回调里同步，
		* 卸载时 ref 收到 null 直接返回；无 `getAnimations` 的宿主（jsdom）静默降级。
		*/
		/**
		* 把 loader 的 CSS 动画钉到文档时间零点。
		* CSS 动画在元素插入时开始，不同时刻挂载的 loader 会错相；共用一个起始时间
		* 才能让所有可见 loader 同步。
		* @param element 已挂载的 loader，卸载时为 null。
		*/
		function syncSpinner(element) {
			if (element === null || element === void 0) return;
			var animations = typeof element.getAnimations === "function" ? element.getAnimations({ subtree: true }) : [];
			if (animations === void 0 || animations === null) return;
			for (var i = 0; i < animations.length; i += 1) animations[i].startTime = 0;
		}
		/** Step 完成态的实心勾（官方 IconCheckOutlineRegular 的 16 viewBox 路径，1px 描边）。 */
		function CheckGlyph$2(props) {
			return e("svg", {
				width: props.size,
				height: props.size,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4",
				stroke: "currentColor"
			}));
		}
		/**
		* 渲染一个状态点。
		* props.state - 显示 done、warning、ongoing、error、idle 中的哪一种。
		* props.size - 外径 px；缺省 ongoing 14，实心态 10。
		* props.className - 布局定位的额外类名。
		* props.appearance - 紧凑圆点（默认）或 step 变体。
		* @returns 圆点元素（aria-hidden；可访问名称请由渲染点提供）。
		*/
		function StateDot(props) {
			var edge = props.size === void 0 ? props.state === "ongoing" ? 14 : 10 : props.size;
			if (props.state === "ongoing") return e("svg", {
				ref: syncSpinner,
				className: clsx(src_client_controls_StateDot_module_css_default.dtsSpinner, props.className),
				"data-state": "ongoing",
				width: edge,
				height: edge,
				viewBox: "0 0 24 24",
				"aria-hidden": "true"
			}, e("g", { className: src_client_controls_StateDot_module_css_default.dtsSpinnerMotion }, e("circle", {
				className: src_client_controls_StateDot_module_css_default.dtsSpinnerTrack,
				cx: "12",
				cy: "12",
				r: "9.5"
			}), e("circle", {
				className: src_client_controls_StateDot_module_css_default.dtsSpinnerArc,
				cx: "12",
				cy: "12",
				r: "9.5"
			})));
			var appearance = props.appearance === void 0 ? "dot" : props.appearance;
			return e("span", {
				className: clsx(appearance === "step" ? src_client_controls_StateDot_module_css_default.dtsStep : src_client_controls_StateDot_module_css_default.dtsDot, props.className),
				"data-state": props.state,
				style: {
					width: edge,
					height: edge
				},
				"aria-hidden": "true"
			}, appearance === "step" && props.state === "done" ? e(CheckGlyph$2, {
				size: edge - 2,
				key: "check"
			}) : null);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/DisclosureRow.module.css.mjs
		const css$12 = ".P0tLG6_dtsDisclosureRoot{display:flex;flex-direction:column;width:100%;min-width:0;}.P0tLG6_dtsDisclosureRow{position:relative;overflow:hidden;display:flex;align-items:center;height:calc(24px + var(--dsh-content-font-delta,0));min-width:0;}.P0tLG6_dtsDisclosureRow[data-expandable]{cursor:pointer;}.P0tLG6_dtsDisclosureLeading{position:relative;flex:none;width:calc(16px + var(--dsh-content-font-delta,0));height:calc(16px + var(--dsh-content-font-delta,0));display:inline-flex;align-items:center;justify-content:center;margin-right:6px;padding:0;border:none;background:none;color:var(--dsw-alias-label-tertiary);}.P0tLG6_dtsDisclosureLeading svg:not([data-state]){ width:calc(14px + var(--dsh-content-font-delta,0)); height:calc(14px + var(--dsh-content-font-delta,0));}button.P0tLG6_dtsDisclosureLeading{cursor:pointer;}.P0tLG6_dtsDisclosureIconIdle{display:inline-flex;opacity:1;transition:opacity 100ms ease;}.P0tLG6_dtsDisclosureChevronHover{position:absolute;inset:0;margin:auto;opacity:0;transition:opacity 100ms ease;}.P0tLG6_dtsDisclosureRow:hover .P0tLG6_dtsDisclosureIconIdle{ opacity:0;}.P0tLG6_dtsDisclosureRow:hover .P0tLG6_dtsDisclosureChevronHover{ opacity:1;}.P0tLG6_dtsDisclosureTitle{flex:none;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0));color:var(--dsw-alias-label-secondary);}";
		const tagId$12 = "dsh-theme-studio/src/client/controls/DisclosureRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$12) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$12;
			tag.textContent = css$12;
			document.head.appendChild(tag);
		}
		var src_client_controls_DisclosureRow_module_css_default = {
			"dtsDisclosureChevronHover": "P0tLG6_dtsDisclosureChevronHover",
			"dtsDisclosureIconIdle": "P0tLG6_dtsDisclosureIconIdle",
			"dtsDisclosureLeading": "P0tLG6_dtsDisclosureLeading",
			"dtsDisclosureRoot": "P0tLG6_dtsDisclosureRoot",
			"dtsDisclosureRow": "P0tLG6_dtsDisclosureRow",
			"dtsDisclosureTitle": "P0tLG6_dtsDisclosureTitle"
		};
		//#endregion
		//#region src/client/controls/DisclosureRow.ts
		/**
		* controls/DisclosureRow.ts —— 官方 DisclosureRow 的自写替代。
		*
		* 官方来源：lib/index.js:3113-3168（lib/types/DisclosureRow.js）+ lib/DisclosureRow.module.css。
		* 抄了什么：24px 紧凑行（高度/前导盒/字形都跟着 `--dsh-content-font-delta` 走）；
		* 标题与内容左右排列（`root` 竖排：行 + 展开内容）；两条展开路径 ——
		* `expandOnRowClick` 时整行成为 `role="button"` + `tabIndex=0` + `aria-expanded`
		* 并吃 Enter/Space，否则只有前导是 `<button aria-expanded>`；`previewChevron` 决定
		* 折叠时前导是否在悬停时从图标切成 chevron；`keepContentWhenOpen` 决定展开时是否
		* 保留 collapsedContent；`memo` + 浅比较（官方要求调用方保持回调与 React 节点的引用稳定）。
		* 改了什么：类名前缀 dts；官方标题经 `TextShimmer` 渲染，本层不引该组件（它的样式表
		* 与 `--dsh-text-shimmer-spread` 不在本层范围内），改为一个 span 并**保留官方发布的
		* `data-text-shimmer` 钩子**（running 为真时置上，宿主若有 shimmer 样式即可生效）；
		* 官方用的 chevron 图标改为内联同路径 SVG。
		* 保留的行为：前导点击 `stopPropagation` 后 toggle（不会和整行点击叠加触发两次）；
		* 键盘只在 `rowExpands` 时拦截 Enter/Space 并 preventDefault。
		*/
		/** 官方 IconChevronDownOutlineRegular 的路径（16 viewBox / 1px 描边 / 默认 14px）。 */
		function ChevronDown$1(props) {
			return e("svg", {
				width: 14,
				height: 14,
				className: props.className,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6",
				stroke: "currentColor"
			}));
		}
		/** 官方 IconChevronUpOutlineRegular 的路径。 */
		function ChevronUp(props) {
			return e("svg", {
				width: 14,
				height: 14,
				className: props.className,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10",
				stroke: "currentColor"
			}));
		}
		/**
		* 渲染一个折叠头及其受控展开内容。
		* 浅层 prop 比较要求稳定的回调与 React 节点引用，未变化的行才会跳过重渲染。
		* @param props - 视觉内容、受控状态与交互策略。
		* @returns 折叠行。
		*/
		var DisclosureRow = memo(function DisclosureRow(props) {
			var rowExpands = props.expandable === true && props.expandOnRowClick === true;
			var previewChevron = props.previewChevron === void 0 ? props.expandable === true : props.previewChevron;
			var toggleFromLeading = function(event) {
				event.stopPropagation();
				props.onToggle();
			};
			var toggleFromKeyboard = function(event) {
				if (!rowExpands || event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				props.onToggle();
			};
			var collapsedLeading = previewChevron ? [e("span", {
				className: src_client_controls_DisclosureRow_module_css_default.dtsDisclosureIconIdle,
				key: "icon"
			}, props.icon), e(ChevronDown$1, {
				className: clsx(props.chevronClassName, src_client_controls_DisclosureRow_module_css_default.dtsDisclosureChevronHover),
				key: "chevron"
			})] : props.icon;
			var leading = props.open ? e(ChevronUp, { className: props.chevronClassName }) : collapsedLeading;
			return e("div", {
				className: clsx(src_client_controls_DisclosureRow_module_css_default.dtsDisclosureRoot, props.className),
				"data-open": props.open || void 0
			}, e("div", {
				className: clsx(src_client_controls_DisclosureRow_module_css_default.dtsDisclosureRow, props.rowClassName),
				"data-disclosure-row": true,
				"data-expandable": rowExpands || void 0,
				role: rowExpands ? "button" : void 0,
				tabIndex: rowExpands ? 0 : void 0,
				"aria-expanded": rowExpands ? props.open : void 0,
				onClick: rowExpands ? props.onToggle : void 0,
				onKeyDown: rowExpands ? toggleFromKeyboard : void 0
			}, props.expandable === true && !rowExpands ? e("button", {
				type: "button",
				className: clsx(src_client_controls_DisclosureRow_module_css_default.dtsDisclosureLeading, props.leadingClassName),
				"aria-expanded": props.open,
				onClick: toggleFromLeading,
				key: "leading"
			}, leading) : e("span", {
				className: clsx(src_client_controls_DisclosureRow_module_css_default.dtsDisclosureLeading, props.leadingClassName),
				key: "leading"
			}, leading), e("span", {
				className: clsx(src_client_controls_DisclosureRow_module_css_default.dtsDisclosureTitle, props.titleClassName),
				"data-text-shimmer": props.running === true ? true : void 0,
				key: "title"
			}, props.title), (props.keepContentWhenOpen === true || !props.open) && props.collapsedContent), props.open && props.children);
		});
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/SegmentedControl.module.css.mjs
		const css$11 = ".O4hgDV_dtsSegmentedControl{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;padding:4px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover);}.O4hgDV_dtsSegmentedIndicator{position:absolute;top:4px;left:4px;width:calc((100% - 8px - 2px *(var(--dsh-segment-count) - 1)) / var(--dsh-segment-count));height:calc(100% - 8px);border:0;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-soft);transform:translateX(calc(var(--dsh-segment-index) *(100% + 2px)));transition:transform 160ms ease;pointer-events:none;}.O4hgDV_dtsSegmentedTab{box-sizing:border-box;position:relative;z-index:1;height:28px;padding:0 16px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;font-weight:500;white-space:nowrap;cursor:pointer;transition:color 120ms ease;}.O4hgDV_dtsSegmentedTab:hover:not(:disabled),.O4hgDV_dtsSegmentedTab[aria-selected='true']{ color:var(--dsw-alias-label-primary);}.O4hgDV_dtsSegmentedTab:disabled{ cursor:default; opacity:.4;}.O4hgDV_dtsSegmentedTab:focus-visible{ outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:-2px;}@media(prefers-reduced-motion:reduce){ .O4hgDV_dtsSegmentedIndicator,.O4hgDV_dtsSegmentedTab{ transition:none;}}";
		const tagId$11 = "dsh-theme-studio/src/client/controls/SegmentedControl.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$11) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$11;
			tag.textContent = css$11;
			document.head.appendChild(tag);
		}
		var src_client_controls_SegmentedControl_module_css_default = {
			"dtsSegmentedControl": "O4hgDV_dtsSegmentedControl",
			"dtsSegmentedIndicator": "O4hgDV_dtsSegmentedIndicator",
			"dtsSegmentedTab": "O4hgDV_dtsSegmentedTab"
		};
		//#endregion
		//#region src/client/controls/SegmentedControl.ts
		/**
		* controls/SegmentedControl.ts —— 官方 SegmentedControl 的自写替代。
		*
		* 官方来源：lib/index.js:3373-3456（lib/types/SegmentedControl.js）+ lib/SegmentedControl.module.css。
		* 抄了什么：`role="tablist"` + `aria-label`；每段是 `role="tab"`，`id` 派生
		* `<id>-<value>`，`aria-controls` 指向 `<id>-<value>-panel`（面板由调用方渲染并用
		* aria-labelledby 指回 tab），只有选中段在 Tab 序列里（`tabIndex` 0/-1）；
		* `walk()` 的走位语义（方向键走到最近的可选邻居并环绕，Home/End 跳到首/末个**可选**段）；
		* 选中项由调用方持有，`onChange` 只会在真的换了值时才被调用；
		* 值变化后若焦点还在控件内，把焦点交给新选中段（官方 useEffect）；
		* 指示块靠 `--dsh-segment-count` / `--dsh-segment-index` 算术定位。
		* 改了什么：类名前缀 dts（官方那种 `css$9[someKey]` 式动态查表在本层没有余地，改显式常量）。
		* 保留的行为：控件级 `disabled` 锁住全部分段（官方：当前面板有进行中的写入/取数时用）；
		* 分段各自可 `disabled` 并带 `title`。
		*/
		function isWalkKey(key) {
			return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown" || key === "Home" || key === "End";
		}
		/**
		* 从选中项出发，走位键落到的那个可选段：方向键步进到最近的可选邻居并环绕，
		* Home/End 跳到首/末个可选段。
		*/
		function walk(options, from, key) {
			var enabled = options.filter(function(option) {
				return option.disabled !== true;
			});
			if (key === "Home") return enabled[0];
			if (key === "End") return enabled[enabled.length - 1];
			var step = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
			var count = options.length;
			for (var offset = 1; offset < count; offset += 1) {
				var candidate = options[((from + step * offset) % count + count) % count];
				if (candidate !== void 0 && candidate.disabled !== true) return candidate;
			}
		}
		/**
		* 渲染一个分段控件。
		* props.id - 拥有者的基础 id。
		* props.value - 选中项的值；控件完全受控。
		* props.options - 按显示顺序的分段。
		* props.onChange - 以点击或走位键请求的值调用。
		* props.label - tablist 的本地化无障碍名称。
		* props.disabled - 锁住全部分段。
		* props.className - 布局定位的额外类名。
		* @returns tablist 元素。
		*/
		function SegmentedControl(props) {
			var list = useRef(null);
			var selected = -1;
			for (var i = 0; i < props.options.length; i += 1) if (props.options[i].value === props.value) {
				selected = i;
				break;
			}
			useEffect(function() {
				var root = list.current;
				if (root === null || root === void 0) return;
				if (!root.contains(document.activeElement)) return;
				var active = root.querySelector("[role=\"tab\"][aria-selected=\"true\"]");
				if (active !== null) active.focus();
			}, [props.value]);
			var onKeyDown = function(event) {
				if (!isWalkKey(event.key)) return;
				event.preventDefault();
				var target = walk(props.options, selected, event.key);
				if (target !== void 0 && target.value !== props.value) props.onChange(target.value);
			};
			var indicator = {
				"--dsh-segment-count": String(props.options.length),
				"--dsh-segment-index": String(selected)
			};
			return e("div", {
				ref: list,
				role: "tablist",
				"aria-label": props.label,
				className: clsx(src_client_controls_SegmentedControl_module_css_default.dtsSegmentedControl, props.className),
				style: indicator
			}, e("span", {
				"aria-hidden": "true",
				className: src_client_controls_SegmentedControl_module_css_default.dtsSegmentedIndicator,
				key: "indicator"
			}), props.options.map(function(option) {
				var active = option.value === props.value;
				return e("button", {
					key: option.value,
					id: props.id + "-" + option.value,
					type: "button",
					role: "tab",
					"aria-selected": active,
					"aria-controls": props.id + "-" + option.value + "-panel",
					tabIndex: active ? 0 : -1,
					disabled: props.disabled === true || option.disabled === true,
					title: option.title,
					className: src_client_controls_SegmentedControl_module_css_default.dtsSegmentedTab,
					onClick: function() {
						if (!active) props.onChange(option.value);
					},
					onKeyDown
				}, option.label);
			}));
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/SegmentedTabs.module.css.mjs
		const css$10 = ".rj1p6S_dtsSegmentedTabs{position:relative;display:grid;padding:4px;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);}.rj1p6S_dtsSegmentedTabsIndicator{position:absolute;inset:4px auto 4px 4px;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);transition:transform 180ms ease;pointer-events:none;}.rj1p6S_dtsSegmentedTabsTab{position:relative;justify-content:center;height:34px;padding:0 12px;border-radius:var(--dsw-radius-md);font-size:14px;line-height:20px;background:transparent;color:var(--dsw-alias-label-secondary);transition:color 180ms ease;}.rj1p6S_dtsSegmentedTabsTab:hover,.rj1p6S_dtsSegmentedTabsTab[aria-selected='true']{ background:transparent; color:var(--dsw-alias-label-primary);}.rj1p6S_dtsSegmentedTabsTab[aria-selected='true']{font-weight:600;}.rj1p6S_dtsSegmentedTabsTab:focus-visible{ outline:none; text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:4px;}@media(prefers-reduced-motion:reduce){ .rj1p6S_dtsSegmentedTabsIndicator,.rj1p6S_dtsSegmentedTabsTab{ transition:none;}}";
		const tagId$10 = "dsh-theme-studio/src/client/controls/SegmentedTabs.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$10) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$10;
			tag.textContent = css$10;
			document.head.appendChild(tag);
		}
		var src_client_controls_SegmentedTabs_module_css_default = {
			"dtsSegmentedTabs": "rj1p6S_dtsSegmentedTabs",
			"dtsSegmentedTabsIndicator": "rj1p6S_dtsSegmentedTabsIndicator",
			"dtsSegmentedTabsTab": "rj1p6S_dtsSegmentedTabsTab"
		};
		//#endregion
		//#region src/client/controls/SegmentedTabs.ts
		/**
		* controls/SegmentedTabs.ts —— 官方 SegmentedTabs 的自写替代。
		*
		* 官方来源：lib/index.js:3213-3280（lib/types/SegmentedTabs.js）+ lib/SegmentedTabs.module.css。
		* 抄了什么：受控等宽分段标签 —— 轨道是 grid，列数由 `style.gridTemplateColumns =
		* repeat(n, minmax(0,1fr))` 内联写死（等宽是"一个指示块按百分比平移"的前提）；
		* 指示块宽度 `calc((100% - 8px) / n)`、位移 `translateX(selectedIndex * 100%)`；
		* 每段经 `Pill` 渲染并带上 `id` / `role="tab"` / `aria-selected` / `aria-controls={panelId}`
		* / `tabIndex`（只有选中项在 Tab 序列里）/ `onClick` / `onKeyDown`；
		* 键盘左右方向键环绕、Home/End 跳首末，**按键同时移动焦点**
		* （`tablist.querySelectorAll('[role="tab"]').item(next).focus()`），并
		* preventDefault + stopPropagation。
		* 改了什么：类名前缀 dts。
		* 保留的行为：面板归调用方所有（tag 只给 `aria-controls` 的 id，不渲染面板）。
		*
		* 与 SegmentedControl 的官方判据（README.zh.md:45/50/77）：两者都是 tablist，
		* 但 SegmentedControl 用在"在几种互斥模式间切换一张卡片/面板"，`id` 派生面板名、
		* 支持控件级 disabled 与逐段 disabled/title；SegmentedTabs 用在"等宽分段标签 + 滑动
		* 指示条"，由调用方提供文案、标签与面板 id。本层两个都给出，按此判据选用。
		*/
		/**
		* 渲染受控等宽分段标签与滑动选中指示块。
		* props.items - 非空有序标签，value 与 DOM id 唯一。
		* props.value - 选中的值，必须属于 items。
		* props.onChange - 点击、左右方向键或 Home/End 请求的选择；键盘选择同时移动焦点，只有选中 tab 是 tab stop。
		* props.label - tablist 的本地化无障碍名称。
		* props.className - 布局定位的额外类名。
		* @returns tab 列表，不含它的面板。
		*/
		function SegmentedTabs(props) {
			var selectedIndex = -1;
			for (var i = 0; i < props.items.length; i += 1) if (props.items[i].value === props.value) {
				selectedIndex = i;
				break;
			}
			var onKeyDown = function(event, index) {
				var next;
				switch (event.key) {
					case "ArrowLeft":
						next = (index + props.items.length - 1) % props.items.length;
						break;
					case "ArrowRight":
						next = (index + 1) % props.items.length;
						break;
					case "Home":
						next = 0;
						break;
					case "End":
						next = props.items.length - 1;
						break;
					default: return;
				}
				event.preventDefault();
				event.stopPropagation();
				var tablist = event.currentTarget.parentElement;
				var nextItem = props.items[next];
				if (tablist === null || tablist === void 0 || nextItem === void 0) return;
				tablist.querySelectorAll("[role=\"tab\"]").item(next).focus();
				props.onChange(nextItem.value);
			};
			return e("div", {
				role: "tablist",
				"aria-label": props.label,
				className: clsx(src_client_controls_SegmentedTabs_module_css_default.dtsSegmentedTabs, props.className),
				style: { gridTemplateColumns: "repeat(" + props.items.length + ", minmax(0, 1fr))" }
			}, e("span", {
				key: "indicator",
				className: src_client_controls_SegmentedTabs_module_css_default.dtsSegmentedTabsIndicator,
				"aria-hidden": "true",
				style: {
					width: "calc((100% - 8px) / " + props.items.length + ")",
					transform: "translateX(" + selectedIndex * 100 + "%)"
				}
			}), props.items.map(function(item, index) {
				return e(Pill, {
					key: item.value,
					id: item.id,
					role: "tab",
					className: src_client_controls_SegmentedTabs_module_css_default.dtsSegmentedTabsTab,
					"aria-selected": props.value === item.value,
					"aria-controls": item.panelId,
					tabIndex: props.value === item.value ? 0 : -1,
					onClick: function() {
						props.onChange(item.value);
					},
					onKeyDown: function(event) {
						onKeyDown(event, index);
					}
				}, item.label);
			}));
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Input.module.css.mjs
		const css$9 = ".tAl7WO_dtsInputWrap{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);}.tAl7WO_dtsInputWrap:focus-within{ border-color:var(--dsw-alias-state-business-primary);}.tAl7WO_dtsInputIcon{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);}.tAl7WO_dtsInput{flex:1;min-width:0;border:none;outline:none;background:transparent;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);}.tAl7WO_dtsInput::placeholder{ color:var(--dsw-alias-label-dimmed);}.tAl7WO_dtsInputWrap:has(.tAl7WO_dtsInput:disabled){ opacity:.5; cursor:default;}";
		const tagId$9 = "dsh-theme-studio/src/client/controls/Input.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var src_client_controls_Input_module_css_default = {
			"dtsInput": "tAl7WO_dtsInput",
			"dtsInputIcon": "tAl7WO_dtsInputIcon",
			"dtsInputWrap": "tAl7WO_dtsInputWrap"
		};
		//#endregion
		//#region src/client/controls/Input.ts
		/**
		* controls/Input.ts —— 官方 Input 的自写替代。
		*
		* 官方来源：lib/index.js:3485-3502（lib/types/Input.js）+ lib/Input.module.css。
		* 抄了什么：wrapper `span` 承载 `className` 与几何（H32 / R12 / 0.5px border-l4 /
		* bg-layer-1 / focus-within 换 business 描边），可选 16px 前置图标，内层原生 input
		* 承接其余全部属性（`flex:1` 无边框无轮廓，14/22 主标签色，placeholder 用 label-dimmed）。
		* 改了什么：类名前缀 dts；**追加**可选的 `label` prop —— 官方把命名权完全交给调用方，
		* 本层按纪律「面向用户的控件必须有名称」把它落到内层 input 的 aria-label 上
		* （调用方已显式传 `aria-label` 时不覆盖）。
		* 保留的行为：原生 input 的全部键盘与表单语义（透传）。
		*/
		/**
		* 渲染一个带可选前置图标的文本输入。
		* props.icon - 可选的前置 16px 图标节点。
		* props.className - 落在 wrapper 上的布局类名。
		* props.label - 无障碍名称（落到内层 input 的 aria-label）。
		* @returns 包住原生 input 的 wrapper span；input 属性透传。
		*/
		function Input(props) {
			var rest = {};
			for (var key in props) {
				if (key === "icon" || key === "className" || key === "label") continue;
				if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
				rest[key] = props[key];
			}
			if (props.label !== void 0 && rest["aria-label"] === void 0) rest["aria-label"] = props.label;
			return e("span", { className: clsx(src_client_controls_Input_module_css_default.dtsInputWrap, props.className) }, props.icon != null ? e("span", {
				className: src_client_controls_Input_module_css_default.dtsInputIcon,
				key: "icon"
			}, props.icon) : null, e("input", Object.assign({ className: src_client_controls_Input_module_css_default.dtsInput }, rest)));
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/TextField.module.css.mjs
		const css$8 = ".UeTXIC_dtsTextField{display:flex;flex-direction:column;gap:6px;padding:12px 0;}.UeTXIC_dtsTextFieldHead{display:flex;align-items:center;gap:8px;}.UeTXIC_dtsTextFieldLabel{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary);}.UeTXIC_dtsTextFieldInput{height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);}.UeTXIC_dtsTextFieldInput::placeholder{ color:var(--dsw-alias-label-dimmed);}.UeTXIC_dtsTextFieldInput:focus-visible{ outline:none; border-color:var(--dsw-alias-state-business-primary);}.UeTXIC_dtsTextFieldInput:disabled{ color:var(--dsw-alias-label-tertiary); cursor:default;}.UeTXIC_dtsTextFieldInput[aria-invalid='true']{border-color:var(--dsw-alias-state-error-primary);}.UeTXIC_dtsTextFieldInvalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary);}.UeTXIC_dtsTextFieldHint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);}";
		const tagId$8 = "dsh-theme-studio/src/client/controls/TextField.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var src_client_controls_TextField_module_css_default = {
			"dtsTextField": "UeTXIC_dtsTextField",
			"dtsTextFieldHead": "UeTXIC_dtsTextFieldHead",
			"dtsTextFieldHint": "UeTXIC_dtsTextFieldHint",
			"dtsTextFieldInput": "UeTXIC_dtsTextFieldInput",
			"dtsTextFieldInvalid": "UeTXIC_dtsTextFieldInvalid",
			"dtsTextFieldLabel": "UeTXIC_dtsTextFieldLabel"
		};
		//#endregion
		//#region src/client/controls/TextField.ts
		/**
		* controls/TextField.ts —— NumberField 的文本孪生：同一份官方字段几何
		* （lib/settings-form/fields.module.css），换成 `type="text"` 的受控输入。
		*
		* 与 NumberField 的差别只在语义：文本没有 min/max/step，也不做数值回退；
		* 校验状态由调用方驱动（`invalid` + `invalidLabel`），因为"什么算非法文本"
		* 只有调用方知道（例如导入主题档时要看它是不是合法 JSON）。
		* `Input` 与本控件的分工：`Input` 是官方那个无标签的行内输入（H32，用于搜索框这类
		* 就地控件）；本控件是设置页字段形状（H34 + 可见标签 + 说明 + 错误行）。
		*/
		/**
		* 渲染一个带标签的文本输入。
		* @param props - 见 {@link TextFieldProps}。
		* @returns 标签行、文本输入与可选错误/说明行。
		*/
		function TextField(props) {
			var generatedId = useId();
			var id = props.id === void 0 ? "dts-text-" + String(generatedId).replace(/:/g, "") : props.id;
			var rest = {};
			for (var key in props) {
				if (key === "label" || key === "value" || key === "onChange" || key === "type" || key === "placeholder" || key === "hint" || key === "invalid" || key === "invalidLabel" || key === "disabled" || key === "id" || key === "className") continue;
				if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
				rest[key] = props[key];
			}
			return e("div", { className: clsx(src_client_controls_TextField_module_css_default.dtsTextField, props.className) }, e("div", {
				className: src_client_controls_TextField_module_css_default.dtsTextFieldHead,
				key: "head"
			}, e("label", {
				className: src_client_controls_TextField_module_css_default.dtsTextFieldLabel,
				htmlFor: id,
				key: "label"
			}, props.label)), e("input", Object.assign({}, rest, {
				key: "input",
				id,
				className: src_client_controls_TextField_module_css_default.dtsTextFieldInput,
				type: props.type === void 0 ? "text" : props.type,
				value: props.value,
				placeholder: props.placeholder,
				disabled: props.disabled === true,
				"aria-invalid": props.invalid === true ? true : void 0,
				onChange: function(event) {
					props.onChange(event.target.value);
				}
			})), props.invalid === true && props.invalidLabel !== void 0 && props.invalidLabel !== "" ? e("p", {
				className: src_client_controls_TextField_module_css_default.dtsTextFieldInvalid,
				key: "invalid",
				role: "status"
			}, props.invalidLabel) : null, props.hint !== void 0 && props.hint !== "" ? e("p", {
				className: src_client_controls_TextField_module_css_default.dtsTextFieldHint,
				key: "hint"
			}, props.hint) : null);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/NumberField.module.css.mjs
		const css$7 = ".MMLtCL_dtsNumberField{display:flex;flex-direction:column;gap:6px;padding:12px 0;}.MMLtCL_dtsNumberFieldHead{display:flex;align-items:center;gap:8px;}.MMLtCL_dtsNumberFieldLabel{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary);}.MMLtCL_dtsNumberFieldInput{height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);}.MMLtCL_dtsNumberFieldInput:focus-visible{ outline:none; border-color:var(--dsw-alias-state-business-primary);}.MMLtCL_dtsNumberFieldInput:disabled{ color:var(--dsw-alias-label-tertiary); cursor:default;}.MMLtCL_dtsNumberFieldInput[aria-invalid='true']{border-color:var(--dsw-alias-state-error-primary);}.MMLtCL_dtsNumberFieldInvalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary);}.MMLtCL_dtsNumberFieldHint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);}";
		const tagId$7 = "dsh-theme-studio/src/client/controls/NumberField.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var src_client_controls_NumberField_module_css_default = {
			"dtsNumberField": "MMLtCL_dtsNumberField",
			"dtsNumberFieldHead": "MMLtCL_dtsNumberFieldHead",
			"dtsNumberFieldHint": "MMLtCL_dtsNumberFieldHint",
			"dtsNumberFieldInput": "MMLtCL_dtsNumberFieldInput",
			"dtsNumberFieldInvalid": "MMLtCL_dtsNumberFieldInvalid",
			"dtsNumberFieldLabel": "MMLtCL_dtsNumberFieldLabel"
		};
		//#endregion
		//#region src/client/controls/NumberField.ts
		/**
		* controls/NumberField.ts —— 官方 primitives 没有"有边界的数字输入"（设置页字段由
		* settings-form 的字段族渲染成裸 `<input>`），本文件按那份字段的几何与令牌自写。
		*
		* 几何/令牌来源：lib/settings-form/fields.module.css 的 .field / .head / .label /
		* .input / .input:focus-visible / .input:disabled / .input[aria-invalid] / .invalid / .hint。
		*
		* 有界语义：`min` / `max` / `step` 同时给原生 `<input type="number">`（浏览器的步进器与
		* 原生校验）与本控件的提交处理。非法输入回退规则（本控件自有，官方无同类控件）：
		*   - 草稿为空        → 回退到当前值，不标错；
		*   - 非有限数        → 回退到当前值，并置 `aria-invalid` + 显示调用方给的 `invalidLabel`；
		*   - 有限但越界      → **钳到边界**后提交（面板要的是"别把我写到区间外"，而不是拒绝输入）；
		*   - 提交时机        → blur 与 Enter；改动中的草稿不写回拥有者，避免每个按键都触发一次重绘/落盘。
		* 可访问名：可见 `<label htmlFor>`；错误文案由调用方本地化（控件不持有任何语言）。
		*/
		/**
		* 渲染一个有边界的数字输入。
		* @param props - 见 {@link NumberFieldProps}。
		* @returns 标签行、number 输入与可选说明。
		*/
		function NumberField(props) {
			var generatedId = useId();
			var id = props.id === void 0 ? "dts-number-" + String(generatedId).replace(/:/g, "") : props.id;
			var draftState = useState(null);
			var draft = draftState[0];
			var setDraft = draftState[1];
			var invalidState = useState(false);
			var invalid = invalidState[0];
			var setInvalid = invalidState[1];
			useEffect(function() {
				setDraft(null);
				setInvalid(false);
			}, [props.value]);
			function commit() {
				if (draft === null) return;
				var raw = draft.trim();
				if (raw === "") {
					setDraft(null);
					setInvalid(false);
					return;
				}
				var parsed = Number(raw);
				if (!Number.isFinite(parsed)) {
					setDraft(null);
					setInvalid(true);
					return;
				}
				var next = parsed;
				if (props.min !== void 0 && next < props.min) next = props.min;
				if (props.max !== void 0 && next > props.max) next = props.max;
				setDraft(null);
				setInvalid(false);
				if (next !== props.value) props.onChange(next);
			}
			var text = draft === null ? String(props.value) : draft;
			return e("div", { className: clsx(src_client_controls_NumberField_module_css_default.dtsNumberField, props.className) }, e("div", {
				className: src_client_controls_NumberField_module_css_default.dtsNumberFieldHead,
				key: "head"
			}, e("label", {
				className: src_client_controls_NumberField_module_css_default.dtsNumberFieldLabel,
				htmlFor: id,
				key: "label"
			}, props.label)), e("input", {
				key: "input",
				id,
				className: src_client_controls_NumberField_module_css_default.dtsNumberFieldInput,
				type: "number",
				min: props.min,
				max: props.max,
				step: props.step,
				value: text,
				disabled: props.disabled === true,
				"aria-invalid": invalid ? true : void 0,
				onChange: function(event) {
					setDraft(event.target.value);
					if (invalid) setInvalid(false);
				},
				onBlur: function() {
					commit();
				},
				onKeyDown: function(event) {
					if (event.key !== "Enter") return;
					event.preventDefault();
					commit();
				}
			}), invalid && props.invalidLabel !== void 0 && props.invalidLabel !== "" ? e("p", {
				className: src_client_controls_NumberField_module_css_default.dtsNumberFieldInvalid,
				key: "invalid",
				role: "status"
			}, props.invalidLabel) : null, props.hint !== void 0 && props.hint !== "" ? e("p", {
				className: src_client_controls_NumberField_module_css_default.dtsNumberFieldHint,
				key: "hint"
			}, props.hint) : null);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Slider.module.css.mjs
		const css$6 = ".SskS0U_dtsSlider{display:flex;flex-direction:column;gap:6px;padding:12px 0;}.SskS0U_dtsSliderHead{display:flex;align-items:center;gap:8px;}.SskS0U_dtsSliderLabel{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary);}.SskS0U_dtsSliderOutput{flex:none;font-variant-numeric:tabular-nums;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary);}.SskS0U_dtsSliderInput{appearance:none;width:100%;height:20px;margin:0;background:transparent;cursor:pointer;}.SskS0U_dtsSliderInput:disabled{ cursor:default; opacity:.5;}.SskS0U_dtsSliderInput:focus-visible{ outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; border-radius:999px; corner-shape:round;}.SskS0U_dtsSliderInput::-webkit-slider-runnable-track{ height:4px; border-radius:999px; corner-shape:round; background:linear-gradient(to right,var(--dsw-alias-brand-primary) 0 var(--dts-slider-fill,0%),var(--dsw-alias-interactive-bg-hover) var(--dts-slider-fill,0%) 100%);}.SskS0U_dtsSliderInput::-webkit-slider-thumb{ appearance:none; width:16px; height:16px; margin-top:-6px; border:0; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-primary-foreground); box-shadow:var(--dsw-elevation-soft);}.SskS0U_dtsSliderInput::-moz-range-track{ height:4px; border-radius:999px; corner-shape:round; background:var(--dsw-alias-interactive-bg-hover);}.SskS0U_dtsSliderInput::-moz-range-progress{ height:4px; border-radius:999px; corner-shape:round; background:var(--dsw-alias-brand-primary);}.SskS0U_dtsSliderInput::-moz-range-thumb{ width:16px; height:16px; border:0; border-radius:50%; corner-shape:round; background:var(--dsw-alias-label-primary-foreground); box-shadow:var(--dsw-elevation-soft);}.SskS0U_dtsSliderHint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);}";
		const tagId$6 = "dsh-theme-studio/src/client/controls/Slider.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var src_client_controls_Slider_module_css_default = {
			"dtsSlider": "SskS0U_dtsSlider",
			"dtsSliderHead": "SskS0U_dtsSliderHead",
			"dtsSliderHint": "SskS0U_dtsSliderHint",
			"dtsSliderInput": "SskS0U_dtsSliderInput",
			"dtsSliderLabel": "SskS0U_dtsSliderLabel",
			"dtsSliderOutput": "SskS0U_dtsSliderOutput"
		};
		//#endregion
		//#region src/client/controls/Slider.ts
		/**
		* controls/Slider.ts —— ★ 官方 primitives **没有 Slider**（面板里有 12 个滑块），
		* 本文件是自写件。几何与令牌依据见 Slider.module.css 顶部的逐条出处。
		*
		* 语义：原生 `<input type="range">` —— 方向键（←/→/↑/↓）、Home/End、PageUp/PageDown
		* 全部由浏览器提供，不需要自写 keydown；`aria-label`／关联可见 `<label>` 给出可访问名；
		* `<output>` 通过 `htmlFor` 关联到同一个 input，既显示数值又表达"这个数字属于哪条滑块"。
		* 数值展示用官方设置页的排版（tabular-nums + 13/1.5），与主题插件自己的数值步进器一致。
		* 越界与 NaN 在 onChange 里钳制（原生 range 一般不会给出越界值，但受控写入可能）。
		*
		* 本控件自有而官方无从参考的两个决定（记在 05-controls-port.md）：
		*   - 可见标签行 + 右侧数值（`showValue` 默认 true）；
		*   - 给出 `unit` 时同时写入 `aria-valuetext`（否则读屏只念一个裸数字）。
		*/
		function clamp(value, min, max) {
			if (Number.isNaN(value)) return min;
			if (value < min) return min;
			if (value > max) return max;
			return value;
		}
		/**
		* 渲染一条带数值展示的滑块。
		* @param props - 见 {@link SliderProps}。
		* @returns 标签行、range 输入与数值输出。
		*/
		function Slider(props) {
			var generatedId = useId();
			var id = props.id === void 0 ? "dts-slider-" + String(generatedId).replace(/:/g, "") : props.id;
			var min = props.min === void 0 ? 0 : props.min;
			var max = props.max === void 0 ? 100 : props.max;
			var step = props.step === void 0 ? 1 : props.step;
			var showValue = props.showValue === void 0 ? true : props.showValue;
			var unit = props.unit === void 0 ? "" : props.unit;
			var span = max - min;
			var percent = span === 0 ? 0 : (props.value - min) / span * 100;
			if (!(percent >= 0)) percent = 0;
			if (percent > 100) percent = 100;
			var text = String(props.value) + unit;
			return e("div", { className: clsx(src_client_controls_Slider_module_css_default.dtsSlider, props.className) }, e("div", {
				className: src_client_controls_Slider_module_css_default.dtsSliderHead,
				key: "head"
			}, e("label", {
				className: src_client_controls_Slider_module_css_default.dtsSliderLabel,
				htmlFor: id,
				key: "label"
			}, props.label), showValue ? e("output", {
				className: src_client_controls_Slider_module_css_default.dtsSliderOutput,
				htmlFor: id,
				key: "output"
			}, text) : null), e("input", {
				key: "input",
				id,
				className: src_client_controls_Slider_module_css_default.dtsSliderInput,
				type: "range",
				min,
				max,
				step,
				value: props.value,
				disabled: props.disabled === true,
				style: { "--dts-slider-fill": percent + "%" },
				"aria-valuetext": unit === "" ? void 0 : text,
				onChange: function(event) {
					var next = Number(event.target.value);
					props.onChange(clamp(next, min, max));
				}
			}), props.hint !== void 0 && props.hint !== "" ? e("p", {
				className: src_client_controls_Slider_module_css_default.dtsSliderHint,
				key: "hint"
			}, props.hint) : null);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/MenuSurface.module.css.mjs
		const css$5 = ".l7C4I7_dtsMenuSurface,.l7C4I7_dtsMenuBacking{border-radius:var(--dsw-radius-lg);}.l7C4I7_dtsMenuSurfaceCompact{border-radius:var(--dsw-radius-md);}:where(.l7C4I7_dtsMenuSurface){ position:relative;}.l7C4I7_dtsMenuSurface{anchor-name:var(--dsh-menu-anchor);isolation:isolate;}.l7C4I7_dtsMenuMaterial{position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--dsw-menu-surface-fill);backdrop-filter:var(--dsw-menu-backdrop-filter);pointer-events:none;}.l7C4I7_dtsMenuBacking{display:none;}html[data-platform='darwin'] .l7C4I7_dtsMenuBacking{display:block;position:fixed;position-anchor:var(--dsh-menu-anchor);top:anchor(top);left:anchor(left);width:anchor-size(width,0);height:anchor-size(height,0);z-index:-1;background:var(--dsw-alias-bg-base);pointer-events:none;}";
		const tagId$5 = "dsh-theme-studio/src/client/controls/MenuSurface.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var src_client_controls_MenuSurface_module_css_default = {
			"dtsMenuBacking": "l7C4I7_dtsMenuBacking",
			"dtsMenuMaterial": "l7C4I7_dtsMenuMaterial",
			"dtsMenuSurface": "l7C4I7_dtsMenuSurface",
			"dtsMenuSurfaceCompact": "l7C4I7_dtsMenuSurfaceCompact"
		};
		//#endregion
		//#region src/client/controls/MenuSurface.ts
		/**
		* controls/MenuSurface.ts —— 官方 MenuSurface 的自写替代。
		*
		* 官方来源：lib/index.js:3738-3777（lib/types/MenuSurface.js）+ lib/MenuSurface.module.css。
		* 抄了什么：`forwardRef` 的 div、`data-menu-material="translucent"`、内部一层
		* `aria-hidden` 的 `.material`（透明填充 + `backdrop-filter`，即菜单材质）、
		* `compact` 变体（较小圆角）、div 属性与 style 原样转发、以及 `--dsh-menu-anchor`
		* 这道 CSS 锚点名（`useId()` 生成后去掉冒号）。
		* 改了什么：类名前缀 dts；**macOS 底层改用 React portal 而不是 `document.body.appendChild`**
		* —— 本层纪律禁止控件手工 append 到 body（卸载路径必须由 React 统一负责）。
		* 用 portal 渲染同一个 `aria-hidden` 底层，行为等价（CSS 锚点仍把它对齐到卡片范围、
		* 随卡片一起卸载），但不再有"自己挂、自己摘"的裸 DOM 生命周期。
		* 保留的行为：只做材质与外圆角，布局与层级归调用方（官方 README.zh.md:118）。
		*/
		/**
		* 绘制一块菜单，并在 macOS 上于页面内容之后补一层不透明底衬。
		* CSS 锚点让每层底衬在放置、缩放与嵌套菜单移动时保持对齐。
		* @param props - div 内容与放置方式，以及紧凑几何。
		* @param ref - 可见的菜单 div（不含不可交互的底衬）。
		* @returns 菜单内容，外加随菜单一起移除的底衬 portal。
		*/
		var MenuSurface = forwardRef(function MenuSurface(props, ref) {
			var id = useId();
			var anchorStyle = { "--dsh-menu-anchor": "--dsh-menu-" + String(id).replace(/:/g, "") };
			var rest = {};
			for (var key in props) {
				if (key === "compact" || key === "className" || key === "style" || key === "children") continue;
				if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
				rest[key] = props[key];
			}
			return e(Fragment, null, e("div", Object.assign({}, rest, {
				key: "surface",
				ref,
				"data-menu-material": "translucent",
				className: clsx(src_client_controls_MenuSurface_module_css_default.dtsMenuSurface, props.compact === true && src_client_controls_MenuSurface_module_css_default.dtsMenuSurfaceCompact, props.className),
				style: Object.assign({}, props.style, anchorStyle)
			}), e("div", {
				"aria-hidden": "true",
				className: src_client_controls_MenuSurface_module_css_default.dtsMenuMaterial,
				key: "material"
			}), props.children), createPortal(e("div", {
				"aria-hidden": "true",
				"data-menu-backing": "",
				className: clsx(src_client_controls_MenuSurface_module_css_default.dtsMenuBacking, props.compact === true && src_client_controls_MenuSurface_module_css_default.dtsMenuSurfaceCompact),
				style: Object.assign({}, anchorStyle, { visibility: props.style === void 0 ? void 0 : props.style.visibility })
			}), document.body, "backing"));
		});
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Select.module.css.mjs
		const css$4 = ".w8jPB0_dtsSelectRoot{position:relative;display:inline-flex;max-width:100%;}.w8jPB0_dtsSelectTrigger{display:inline-flex;align-items:center;gap:6px;width:100%;height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;}.w8jPB0_dtsSelectTrigger:focus-visible{ outline:none; border-color:var(--dsw-alias-state-business-primary);}.w8jPB0_dtsSelectTrigger:disabled{ color:var(--dsw-alias-label-tertiary); cursor:default;}.w8jPB0_dtsSelectValue{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.w8jPB0_dtsSelectPlaceholder{color:var(--dsw-alias-label-tertiary);}.w8jPB0_dtsSelectCaret{flex:none;display:inline-flex;width:14px;height:14px;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);}.w8jPB0_dtsSelectList{box-sizing:border-box;padding:4px;display:flex;flex-direction:column;gap:0;border:0;min-width:144px;max-width:360px;max-height:calc(100vh - 12px - max(12px,var(--dsh-frame-top-clearance,12px)));--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}.w8jPB0_dtsSelectListInPlace{position:absolute;top:calc(100% + 4px);left:0;z-index:100;}.w8jPB0_dtsSelectPortal{position:fixed;top:auto;left:auto;z-index:1100;}.w8jPB0_dtsSelectViewport{display:flex;flex-direction:column;min-height:0;overflow-y:auto;}.w8jPB0_dtsSelectOption{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;cursor:pointer;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left;}.w8jPB0_dtsSelectOption:hover:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover);}.w8jPB0_dtsSelectOption:focus-visible:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover); outline:none;}.w8jPB0_dtsSelectOption:disabled{ opacity:.4; cursor:not-allowed;}.w8jPB0_dtsSelectOption[aria-selected='true']{background:var(--dsw-alias-interactive-bg-hover);}.w8jPB0_dtsSelectOptionLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.w8jPB0_dtsSelectCheck{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-primary);}.w8jPB0_dtsSelectEmpty{padding:6px 8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);}";
		const tagId$4 = "dsh-theme-studio/src/client/controls/Select.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var src_client_controls_Select_module_css_default = {
			"dtsSelectCaret": "w8jPB0_dtsSelectCaret",
			"dtsSelectCheck": "w8jPB0_dtsSelectCheck",
			"dtsSelectEmpty": "w8jPB0_dtsSelectEmpty",
			"dtsSelectList": "w8jPB0_dtsSelectList",
			"dtsSelectListInPlace": "w8jPB0_dtsSelectListInPlace",
			"dtsSelectOption": "w8jPB0_dtsSelectOption",
			"dtsSelectOptionLabel": "w8jPB0_dtsSelectOptionLabel",
			"dtsSelectPlaceholder": "w8jPB0_dtsSelectPlaceholder",
			"dtsSelectPortal": "w8jPB0_dtsSelectPortal",
			"dtsSelectRoot": "w8jPB0_dtsSelectRoot",
			"dtsSelectTrigger": "w8jPB0_dtsSelectTrigger",
			"dtsSelectValue": "w8jPB0_dtsSelectValue",
			"dtsSelectViewport": "w8jPB0_dtsSelectViewport"
		};
		//#endregion
		//#region src/client/controls/Select.ts
		/**
		* controls/Select.ts —— ★ 官方 primitives **没有下拉控件**（宿主用原生 `<select>` 或 Menu），
		* 本文件是自写件，官方风格来自两处现成事实：
		*   - 材质与视口几何：`MenuSurface`（透明填充 + `--dsw-menu-backdrop-filter` 模糊 +
		*     外圆角）与 `lib/Menu.module.css` 的卡片/行几何（min-width 144、padding 4、
		*     elevation-prominent、行 min-height 34 / padding 6 8 / radius-md / 13-20、
		*     l2 滚动条令牌、`max-height: calc(100vh - 12px - max(12px, var(--dsh-frame-top-clearance,12px)))`）；
		*   - 触发器几何：`lib/settings-form/fields.module.css` 的 `.input`（H34 / pad 0 12 /
		*     0.5px border-l4 / radius-md / bg-layer-3 / 13px），即官方设置页字段的形状。
		* 键盘范式逐条对齐 `lib/index.js:4022-4077` 的 Menu：↑/↓ 走位（环绕）、Home/End 跳首末、
		* Enter/Space 激活聚焦行（原生 button 语义）、Esc 关闭并归还焦点、Tab 提交聚焦行并归还焦点、
		* 外部 pointerdown 关闭。焦点归还用官方 `focusWithoutRing`。
		* 官方没有的判据由本控件自己定（已逐条记在 05-controls-port.md）：
		*   - 语义用 `listbox`/`option`（"在 N 个互斥值里选一个"的 ARIA 正道），不是 menu/menuitem；
		*   - 打开状态由控件自持（原生 select 也是自持 popup），不设受控 `open` prop；
		*   - 打开后把焦点放到当前选中项（原生 select 的行为）；选中行同时用 `aria-selected`
		*     与官方 Menu 的 `selection='fill'` 填充表达；
		*   - `portal` 默认 **true**：面板里的下拉位于可滚动容器内，就地列表会被祖先 overflow 裁掉；
		*     官方 Menu 默认 false 是因为它多挂在顶级工具栏上。
		* 官方 Menu 的嵌套子菜单 / 快捷键键帽 / closeOnPointerLeave 不适用于下拉，未移植。
		*
		* 监听器纪律：文档级 pointerdown/keydown 只在 `open` 期间存在，随 effect 清理成对摘除；
		* 所有会随渲染变化的输入都走 ref，避免每按一次方向键就重挂监听。
		*/
		/** 未放置的 portal 列表：隐藏但按固定原点布局，offsetWidth/offsetHeight 因此是真实值。 */
		var MEASURE_STYLE$1 = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/** 官方 IconChevronDownOutlineRegular 的路径（16 viewBox / 1px 描边 / 默认 14px）。 */
		function ChevronDown(props) {
			return e("svg", {
				width: 14,
				height: 14,
				className: props.className,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6",
				stroke: "currentColor"
			}));
		}
		/** 官方 IconCheckOutlineRegular 的路径，用作选中标记。 */
		function CheckGlyph$1(props) {
			return e("svg", {
				width: 14,
				height: 14,
				className: props.className,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4",
				stroke: "currentColor"
			}));
		}
		/**
		* 渲染一个受控下拉选择。
		* @param props - 见 {@link SelectProps}。
		* @returns 触发器与条件渲染的 listbox。
		*/
		function Select(props) {
			var rootRef = useRef(null);
			var triggerRef = useRef(null);
			var listRef = useRef(null);
			var openState = useState(false);
			var open = openState[0];
			var setOpen = openState[1];
			var activeState = useState(0);
			var activeIndex = activeState[0];
			var setActiveIndex = activeState[1];
			var options = props.options === void 0 ? [] : props.options;
			var selectedIndex = -1;
			for (var i = 0; i < options.length; i += 1) if (options[i].value === props.value) {
				selectedIndex = i;
				break;
			}
			var selected = selectedIndex >= 0 ? options[selectedIndex] : void 0;
			var latest = useRef(null);
			latest.current = {
				options,
				value: props.value,
				activeIndex,
				onChange: props.onChange
			};
			var activeRef = useRef(activeIndex);
			activeRef.current = activeIndex;
			/** 列表里可聚焦的行下标（禁用行不参与走位，同官方 Menu 的 `button:not(:disabled)`）。 */
			function enabledIndexes(list) {
				var out = [];
				for (var k = 0; k < list.length; k += 1) if (list[k].disabled !== true) out.push(k);
				return out;
			}
			/** 把真实焦点放到第 index 个选项上（禁用行会被跳过）。 */
			function focusOption(index) {
				var list = listRef.current;
				if (list === null || list === void 0) return;
				var rows = list.querySelectorAll("button[role=\"option\"]:not(:disabled)");
				if (rows.length === 0) return;
				var slot = enabledIndexes(latest.current.options).indexOf(index);
				var target = rows[slot >= 0 ? slot : 0];
				if (target !== void 0 && target !== null) target.focus();
				if (slot >= 0) setActiveIndex(index);
			}
			/** 关闭；默认把键盘还给触发器（官方 Menu 的 refocusAnchor）。 */
			function close(refocus) {
				setOpen(false);
				if (refocus === false) return;
				var trigger = triggerRef.current;
				if (trigger !== null && trigger !== void 0 && document.contains(trigger)) focusWithoutRing(trigger);
			}
			function openList() {
				if (props.disabled === true) return;
				var enabled = enabledIndexes(options);
				if (enabled.length === 0) {
					setOpen(true);
					return;
				}
				setActiveIndex(selectedIndex >= 0 && options[selectedIndex].disabled !== true ? selectedIndex : enabled[0]);
				setOpen(true);
			}
			useEffect(function() {
				if (!open) return;
				focusOption(activeRef.current);
			}, [open]);
			var position = useAnchoredPosition({
				open: open && props.portal !== false,
				anchorRef: triggerRef,
				panelRef: listRef,
				side: props.side === void 0 ? "bottom" : props.side,
				align: props.align === void 0 ? "start" : props.align,
				gap: 4,
				margin: 12
			});
			useEffect(function() {
				if (!open) return void 0;
				var composition = observeComposition(document);
				var root = rootRef.current;
				var onPointerDown = function(event) {
					if (!(event.target instanceof Node)) return;
					if (root !== null && root !== void 0 && root.contains(event.target)) return;
					if (listRef.current !== null && listRef.current.contains(event.target)) return;
					setOpen(false);
				};
				var onKeyDown = function(event) {
					if (composition.guards(event) || isBehindModal(root) || event.ctrlKey || event.altKey || event.metaKey) return;
					var focused = document.activeElement;
					var insideList = listRef.current !== null && listRef.current.contains(focused);
					var onTrigger = triggerRef.current !== null && triggerRef.current === focused;
					if (!insideList && !onTrigger) return;
					if (event.key === "Escape" && !event.shiftKey) {
						event.preventDefault();
						if (event.repeat) return;
						close(true);
						return;
					}
					if (onTrigger && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
						event.preventDefault();
						openList();
						return;
					}
					if (event.key === "Tab") {
						if (insideList) {
							event.preventDefault();
							if (focused instanceof HTMLElement && focused.getAttribute("role") === "option") focused.click();
							else close(true);
							return;
						}
						close(false);
						return;
					}
					if ([
						"ArrowDown",
						"ArrowUp",
						"Home",
						"End"
					].indexOf(event.key) < 0) return;
					if (!insideList) return;
					var enabled = enabledIndexes(latest.current.options);
					if (enabled.length === 0) return;
					event.preventDefault();
					var slot = enabled.indexOf(activeRef.current);
					var nextSlot;
					if (event.key === "Home") nextSlot = 0;
					else if (event.key === "End") nextSlot = enabled.length - 1;
					else if (slot < 0) nextSlot = event.key === "ArrowDown" ? 0 : enabled.length - 1;
					else nextSlot = (slot + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
					focusOption(enabled[nextSlot]);
				};
				document.addEventListener("pointerdown", onPointerDown);
				var onEscape = function(event) {
					if (event.key === "Escape") onKeyDown(event);
				};
				var onOtherKey = function(event) {
					if (event.key !== "Escape") onKeyDown(event);
				};
				document.addEventListener("keydown", onOtherKey);
				document.addEventListener("keydown", onEscape, true);
				return function() {
					composition.dispose();
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onOtherKey);
					document.removeEventListener("keydown", onEscape, true);
				};
			}, [open, props.disabled]);
			var list = open ? e(MenuSurface, {
				compact: props.compact === true,
				ref: listRef,
				className: clsx(src_client_controls_Select_module_css_default.dtsSelectList, props.listClassName, props.portal === false ? src_client_controls_Select_module_css_default.dtsSelectListInPlace : src_client_controls_Select_module_css_default.dtsSelectPortal),
				style: props.portal === false ? void 0 : position === null ? MEASURE_STYLE$1 : position,
				role: "listbox",
				"aria-label": props.label,
				onClick: function(event) {
					event.stopPropagation();
				}
			}, e("div", {
				className: src_client_controls_Select_module_css_default.dtsSelectViewport,
				role: "presentation",
				key: "viewport"
			}, options.length === 0 ? e("div", {
				className: src_client_controls_Select_module_css_default.dtsSelectEmpty,
				key: "empty"
			}, props.emptyLabel) : options.map(function(option, index) {
				var isSelected = option.value === props.value;
				return e("button", {
					key: option.value,
					type: "button",
					role: "option",
					"aria-selected": isSelected,
					tabIndex: index === activeIndex ? 0 : -1,
					disabled: option.disabled === true,
					className: src_client_controls_Select_module_css_default.dtsSelectOption,
					onMouseEnter: function() {
						if (option.disabled !== true) setActiveIndex(index);
					},
					onClick: function() {
						setOpen(false);
						latest.current.onChange(option.value);
						var trigger = triggerRef.current;
						if (trigger !== null && trigger !== void 0 && document.contains(trigger)) focusWithoutRing(trigger);
					}
				}, e("span", {
					className: src_client_controls_Select_module_css_default.dtsSelectOptionLabel,
					key: "label"
				}, option.label), isSelected ? e(CheckGlyph$1, {
					className: src_client_controls_Select_module_css_default.dtsSelectCheck,
					key: "check"
				}) : null);
			}))) : null;
			return e("span", {
				ref: rootRef,
				className: clsx(src_client_controls_Select_module_css_default.dtsSelectRoot, props.className)
			}, e("button", {
				ref: triggerRef,
				type: "button",
				className: src_client_controls_Select_module_css_default.dtsSelectTrigger,
				disabled: props.disabled === true,
				title: props.title,
				"aria-label": props.label,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				onClick: function() {
					if (open) close(true);
					else openList();
				}
			}, e("span", { className: clsx(src_client_controls_Select_module_css_default.dtsSelectValue, selected === void 0 && src_client_controls_Select_module_css_default.dtsSelectPlaceholder) }, selected === void 0 ? props.placeholder : selected.label), e(ChevronDown, { className: src_client_controls_Select_module_css_default.dtsSelectCaret })), props.portal === false ? list : list !== null ? createPortal(list, document.body) : null);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Menu.module.css.mjs
		const css$3 = ".OtPIRL_dtsMenuRoot{position:relative;display:inline-flex;}.OtPIRL_dtsMenuList{box-sizing:border-box;padding:4px;display:flex;flex-direction:column;gap:0;border:0;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);}.OtPIRL_dtsMenuList{position:absolute;top:calc(100% + 4px);left:0;z-index:100;min-width:144px;max-width:360px;}.OtPIRL_dtsMenuPortal{position:fixed;top:auto;left:auto;z-index:1100;}.OtPIRL_dtsMenuSideTop{top:auto;bottom:calc(100% + 4px);}.OtPIRL_dtsMenuAlignEnd{left:auto;right:0;}.OtPIRL_dtsMenuScrollable{max-height:calc(100vh - 12px - max(12px,var(--dsh-frame-top-clearance,12px)));}.OtPIRL_dtsMenuViewport{display:flex;flex-direction:column;min-height:0;}.OtPIRL_dtsMenuScrollable .OtPIRL_dtsMenuViewport{overflow-y:auto;}.OtPIRL_dtsMenuFooter{flex:none;display:flex;flex-direction:column;margin-top:3px;padding-top:3px;border-top:.5px solid var(--dsw-alias-border-l2);}.OtPIRL_dtsMenuItemWrap{position:relative;}.OtPIRL_dtsMenuItem{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;cursor:pointer;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left;}.OtPIRL_dtsMenuItem:hover:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover);}.OtPIRL_dtsMenuItem:focus-visible:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover); outline:none;}.OtPIRL_dtsMenuDenseList .OtPIRL_dtsMenuItem{min-height:30px;padding-block:4px;}.OtPIRL_dtsMenuDenseList .OtPIRL_dtsMenuLabel{padding-block:3px;}.OtPIRL_dtsMenuCompactList{min-width:156px;padding:4px;}.OtPIRL_dtsMenuCompactList .OtPIRL_dtsMenuItem{min-height:24px;gap:5px;padding:2px 6px;border-radius:var(--dsw-radius-sm);font-size:11px;line-height:17px;}.OtPIRL_dtsMenuCompactList .OtPIRL_dtsMenuItemIcon{width:12px;height:12px;}.OtPIRL_dtsMenuCompactList .OtPIRL_dtsMenuSeparator{margin:2px;}.OtPIRL_dtsMenuCompactList .OtPIRL_dtsMenuLabel{padding:3px 6px;font-size:10px;line-height:15px;}.OtPIRL_dtsMenuItem:disabled{ opacity:.4; cursor:not-allowed;}.OtPIRL_dtsMenuItemIcon{display:inline-flex;flex:none;width:14px;height:14px;align-items:center;justify-content:center;color:var(--dsw-alias-menu-icon);}.OtPIRL_dtsMenuItemIcon svg,.OtPIRL_dtsMenuCheck{width:14px;height:14px;}.OtPIRL_dtsMenuCompactList .OtPIRL_dtsMenuItemIcon svg,.OtPIRL_dtsMenuCompactList .OtPIRL_dtsMenuCheck{width:12px;height:12px;}.OtPIRL_dtsMenuItemLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.OtPIRL_dtsMenuCheck{flex:none;color:var(--dsw-alias-label-primary);}.OtPIRL_dtsMenuSelected{background:transparent;}.OtPIRL_dtsMenuSelectedFill{background:var(--dsw-alias-interactive-bg-hover);}.OtPIRL_dtsMenuDanger{color:var(--dsw-alias-state-error-primary);}.OtPIRL_dtsMenuDanger .OtPIRL_dtsMenuItemIcon{color:var(--dsw-alias-state-error-primary);}.OtPIRL_dtsMenuDanger:hover:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover-danger);}.OtPIRL_dtsMenuDanger:focus-visible:not(:disabled){ background:var(--dsw-alias-interactive-bg-hover-danger); outline:none;}.OtPIRL_dtsMenuLabel{padding:6px 8px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary);}.OtPIRL_dtsMenuSeparator{height:.5px;margin:3px 2px;background:var(--dsw-alias-border-l2);}.OtPIRL_dtsMenuSeparator + .OtPIRL_dtsMenuSeparator,.OtPIRL_dtsMenuSeparator + .OtPIRL_dtsMenuItemWrap>.OtPIRL_dtsMenuSeparator:first-child,.OtPIRL_dtsMenuItemWrap:first-child > .OtPIRL_dtsMenuSeparator:first-child{ display:none;}";
		const tagId$3 = "dsh-theme-studio/src/client/controls/Menu.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var src_client_controls_Menu_module_css_default = {
			"dtsMenuAlignEnd": "OtPIRL_dtsMenuAlignEnd",
			"dtsMenuCheck": "OtPIRL_dtsMenuCheck",
			"dtsMenuCompactList": "OtPIRL_dtsMenuCompactList",
			"dtsMenuDanger": "OtPIRL_dtsMenuDanger",
			"dtsMenuDenseList": "OtPIRL_dtsMenuDenseList",
			"dtsMenuFooter": "OtPIRL_dtsMenuFooter",
			"dtsMenuItem": "OtPIRL_dtsMenuItem",
			"dtsMenuItemIcon": "OtPIRL_dtsMenuItemIcon",
			"dtsMenuItemLabel": "OtPIRL_dtsMenuItemLabel",
			"dtsMenuItemWrap": "OtPIRL_dtsMenuItemWrap",
			"dtsMenuLabel": "OtPIRL_dtsMenuLabel",
			"dtsMenuList": "OtPIRL_dtsMenuList",
			"dtsMenuPortal": "OtPIRL_dtsMenuPortal",
			"dtsMenuRoot": "OtPIRL_dtsMenuRoot",
			"dtsMenuScrollable": "OtPIRL_dtsMenuScrollable",
			"dtsMenuSelected": "OtPIRL_dtsMenuSelected",
			"dtsMenuSelectedFill": "OtPIRL_dtsMenuSelectedFill",
			"dtsMenuSeparator": "OtPIRL_dtsMenuSeparator",
			"dtsMenuSideTop": "OtPIRL_dtsMenuSideTop",
			"dtsMenuViewport": "OtPIRL_dtsMenuViewport"
		};
		//#endregion
		//#region src/client/controls/Menu.ts
		/**
		* controls/Menu.ts —— 官方 Menu / MenuItemButton 的自写替代。
		*
		* 官方来源：lib/index.js:3779-4239（lib/types/Menu.js）+ lib/Menu.module.css。
		*
		* 抄了什么（逐条对照官方 JSDoc 与实现）：
		*   - 结构：外层 `<span class=root>` 承载锚点与就地列表；列表本身是 `MenuSurface`
		*     并带 `role="menu"`；行分三种数据条目（选项 / `{type:'separator'}` / `{type:'label'}`）
		*     加 `children` 组件行；`footer` 的行钉在滚动区下方，用 hairline 分隔。
		*   - 键盘范式：列表打开期间 `↑`/`↓`（以及 Home/End）在列表中走位、Tab 选定聚焦行
		*     （从触发器按下 Tab 则进入列表）、Escape 或 Shift+Tab 关闭并把焦点还给锚点
		*     （打开时握住键盘的那个控件，取不到就退回锚点的第一个可用 button）；
		*     选定一行同样把键盘还给它 —— 除非拥有者自己移动了焦点。
		*     只拦截位于锚点或列表内的键盘，页面上别处的 Tab 仍归浏览器。
		*   - 走位细节：`walkIndex` 记住方向键最后落点，焦点离开行后按方向键从那里续走；
		*     行集合按 `button:not(:disabled)` 实时取，`Home`/`End` 跳首末行。
		*   - 关闭时机：外部 pointerdown、Escape、以及"焦点落进跨源 iframe 时唯一能收到的
		*     信号" window blur。
		*   - 焦点归还的两种路径：`refocusAnchor`（Esc / Shift+Tab，`navigation` 决定是否
		*     保留焦点指示器，走 `focusWithoutRing`）与 `refocusAfterSelection`
		*     （选完即随列表卸载，用 queueMicrotask 判断键盘是否被留在了正在关闭的列表上）。
		*   - 干扰保护：`observeComposition`（IME）、`isBehindModal`（嵌套在模态之后时不抢键盘）、
		*     `e.defaultPrevented` / 修饰键不拦截、`e.repeat` 不重复关闭。
		*   - portal 模式：从锚点矩形 fixed 定位，MARGIN=12，跟随滚动（捕获阶段）/缩放，
		*     每帧 rAF 跟踪嵌套滚动；测量期间用 visibility:hidden 的就地样式量真实尺寸。
		*   - 选中标记：`selection='check'`（尾部勾，默认）或 `'fill'`（行握 hover 填充）。
		*
		* 有意**未移植**（本层不需要，删掉比留空壳更诚实；逐条记在 05-controls-port.md）：
		*   - 嵌套子菜单（`submenu` 字段、`openSubmenuId`、`collapseSubmenuFrom` 与 .submenu 样式）；
		*   - `closeOnPointerLeave` + `usePointerGrace`（本层面板里的菜单都由点击开合）；
		*   - `shortcut` 键帽显示（需要 ShortcutKeys 组件，不在本层控件清单里）。
		* 因此这里也把官方的 "有子菜单就不加 .scrollable" 判据简化为恒真：官方在无子菜单时
		* 同样恒真，行为一致。
		*/
		/** 未放置的 portal 列表：隐藏但按固定原点布局，offsetWidth/offsetHeight 因此是真实值。 */
		var MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		function isSeparator(entry) {
			return entry.type === "separator";
		}
		function isLabel(entry) {
			return entry.type === "label";
		}
		/** 官方 IconCheckOutlineRegular 的路径（16 viewBox / 1px 描边），用作选中标记。 */
		function CheckGlyph(props) {
			return e("svg", {
				width: 16,
				height: 16,
				className: props.className,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4",
				stroke: "currentColor"
			}));
		}
		/**
		* 渲染一个 `role="menuitem"` 行，供行本身是组件而不在 `items` 数据里的 Menu 使用：
		* 与数据行同一套 markup 与样式，因此共享列表的键盘走位与选后焦点归还，不需要任何共享状态。
		* props.children - 可见的行文案。
		* props.icon - 可选的前置图标。
		* props.disabled - 该行是否不可激活。
		* props.danger - 是否使用破坏性行配色。
		* props.separatorBefore - 该行是否开启新分组（其上方画 hairline）。
		* props.onSelect - 行激活回调。
		* @returns 一个菜单行。
		*/
		function MenuItemButton(props) {
			return e("div", { className: src_client_controls_Menu_module_css_default.dtsMenuItemWrap }, props.separatorBefore === true ? e("div", {
				className: src_client_controls_Menu_module_css_default.dtsMenuSeparator,
				role: "separator",
				key: "sep"
			}) : null, e("button", {
				type: "button",
				role: "menuitem",
				className: clsx(src_client_controls_Menu_module_css_default.dtsMenuItem, props.danger === true && src_client_controls_Menu_module_css_default.dtsMenuDanger),
				disabled: props.disabled === true,
				onClick: props.onSelect
			}, props.icon !== void 0 ? e("span", {
				className: src_client_controls_Menu_module_css_default.dtsMenuItemIcon,
				key: "icon"
			}, props.icon) : null, e("span", {
				className: src_client_controls_Menu_module_css_default.dtsMenuItemLabel,
				key: "label"
			}, props.children)));
		}
		/**
		* 渲染一个锚定的下拉菜单。
		* @param props - 见 {@link MenuProps}。
		* @returns 锚点 wrapper 与条件渲染的列表。
		*/
		function Menu(props) {
			var rootRef = useRef(null);
			var listRef = useRef(null);
			/** 方向键最后聚焦的下标；焦点离开行后的续走起点。 */
			var walkIndex = useRef(null);
			/**
			* 打开这个菜单时握住键盘的控件 —— 它自己的触发器。锚点如果包住多个控件
			* （分裂按钮），按位置就点不出是哪一个。
			*/
			var triggerRef = useRef(null);
			var selectingWithTab = useRef(false);
			var openRef = useRef(props.open);
			openRef.current = props.open;
			var items = props.items === void 0 ? [] : props.items;
			var footer = props.footer === void 0 ? [] : props.footer;
			/**
			* 把键盘交还给打开菜单的触发器；锚点从未握住键盘时退给它内部第一个 button。
			* 否则焦点会落在被移除的行上、掉到页面 body，下一次 Tab 就从页面顶部重来。
			* @param navigation 显式键盘遍历是否保留焦点指示器。
			*/
			var refocusAnchor = function(navigation) {
				var trigger = triggerRef.current;
				var target = trigger !== null && document.contains(trigger) && !trigger.disabled ? trigger : rootRef.current === null ? null : rootRef.current.querySelector("button:not(:disabled)");
				if (target === null || target === void 0) return;
				if (navigation === true) target.focus();
				else focusWithoutRing(target);
			};
			/**
			* 行随列表一起卸载的那些路径上的选后焦点。拥有者选择保持菜单打开时不干预；
			* 自己移动了焦点的拥有者（例如把焦点交给预览按钮）同样不干预：只有键盘留在
			* 正在关闭的列表上（或留在列表移除后产生的 body 上）时才回到触发器。
			*/
			var refocusAfterSelection = function() {
				var navigation = selectingWithTab.current === true;
				queueMicrotask(function() {
					if (openRef.current) return;
					var active = document.activeElement;
					if (active === null || active === document.body || listRef.current !== null && listRef.current.contains(active)) refocusAnchor(navigation);
				});
			};
			var fixedPosState = useState(null);
			var fixedPos = fixedPosState[0];
			var setFixedPos = fixedPosState[1];
			useLayoutEffect(function() {
				if (!props.open || props.portal !== true) {
					setFixedPos(null);
					return;
				}
				var place = function() {
					var r;
					if (props.getAnchorRect !== void 0) r = props.getAnchorRect();
					else r = rootRef.current === null ? null : rootRef.current.getBoundingClientRect();
					if (r === null || r === void 0) return;
					var MARGIN = 12;
					var vw = window.innerWidth;
					var vh = window.innerHeight;
					var listEl = listRef.current;
					var lw = listEl === null || listEl === void 0 ? 0 : listEl.offsetWidth;
					var lh = listEl === null || listEl === void 0 ? 0 : listEl.offsetHeight;
					var x;
					var y;
					if (props.side === "right") {
						x = r.right + 4;
						y = r.top;
					} else if (props.align !== "end") {
						x = r.left;
						y = props.side === "bottom" || props.side === void 0 ? r.bottom + 4 : r.top - lh - 4;
					} else {
						x = r.right - lw;
						y = props.side === "bottom" || props.side === void 0 ? r.bottom + 4 : r.top - lh - 4;
					}
					if (lw > 0) x = Math.min(Math.max(x, MARGIN), vw - lw - MARGIN);
					if (lh > 0) y = Math.min(Math.max(y, overlayTopMargin(MARGIN)), vh - lh - MARGIN);
					setFixedPos(function(current) {
						if (current !== null && current !== void 0 && current.left === x && current.top === y) return current;
						return {
							left: x,
							top: y
						};
					});
				};
				place();
				var frame = requestAnimationFrame(function track() {
					place();
					frame = requestAnimationFrame(track);
				});
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				return function() {
					cancelAnimationFrame(frame);
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				props.open,
				props.portal,
				props.align,
				props.side,
				props.getAnchorRect
			]);
			useEffect(function() {
				if (!props.open) {
					triggerRef.current = null;
					return;
				}
				var active = document.activeElement;
				triggerRef.current = active instanceof HTMLElement && rootRef.current !== null && rootRef.current.contains(active) ? active : null;
			}, [props.open]);
			useEffect(function() {
				if (!props.open || props.autoFocus !== true) return;
				var first = listRef.current === null ? null : listRef.current.querySelector("button:not(:disabled)");
				walkIndex.current = first === void 0 || first === null ? null : 0;
				if (first !== null && first !== void 0) focusWithoutRing(first);
			}, [props.open, props.autoFocus]);
			useEffect(function() {
				if (!props.open) {
					walkIndex.current = null;
					return;
				}
				var composition = observeComposition(document);
				var onPointerDown = function(event) {
					if (!(event.target instanceof Node)) return;
					if (rootRef.current !== null && rootRef.current.contains(event.target)) return;
					if (listRef.current !== null && listRef.current.contains(event.target)) return;
					props.onClose();
				};
				var onKeyDown = function(event) {
					if (composition.guards(event) || isBehindModal(rootRef.current) || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
					var focused = document.activeElement;
					var insideList = listRef.current !== null && listRef.current.contains(focused);
					var anchored = rootRef.current !== null && rootRef.current.contains(focused) || insideList;
					if (event.key === "Escape" && !event.shiftKey) {
						event.preventDefault();
						if (event.repeat) return;
						props.onClose();
						if (anchored || props.autoFocus === true) refocusAnchor();
					}
					if (event.key === "Tab") {
						var list = listRef.current;
						if (list === null || !anchored) return;
						if (event.shiftKey) {
							event.preventDefault();
							props.onClose();
							refocusAnchor(true);
							return;
						}
						if (insideList) {
							if (focused instanceof HTMLElement && focused.getAttribute("role") === "menuitem") {
								event.preventDefault();
								selectingWithTab.current = true;
								try {
									focused.click();
								} finally {
									selectingWithTab.current = false;
								}
							}
							return;
						}
						var row = list.querySelector("button:not(:disabled)");
						if (row === null) return;
						event.preventDefault();
						row.focus();
						walkIndex.current = 0;
						return;
					}
					if ([
						"ArrowDown",
						"ArrowUp",
						"Home",
						"End"
					].indexOf(event.key) < 0) return;
					var target = listRef.current;
					if (target === null || !anchored) return;
					var buttons = Array.prototype.slice.call(target.querySelectorAll("button:not(:disabled)"));
					if (buttons.length === 0) return;
					var index = buttons.indexOf(focused);
					var from = index >= 0 ? index : walkIndex.current;
					var next;
					if (event.key === "Home") next = 0;
					else if (event.key === "End") next = buttons.length - 1;
					else if (from === null) next = event.key === "ArrowDown" ? 0 : buttons.length - 1;
					else next = (from + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
					event.preventDefault();
					walkIndex.current = next;
					if (buttons[next] !== void 0) buttons[next].focus();
				};
				var onWindowBlur = function() {
					if (document.activeElement instanceof HTMLIFrameElement) props.onClose();
				};
				document.addEventListener("pointerdown", onPointerDown);
				var onEscape = function(event) {
					if (event.key === "Escape") onKeyDown(event);
				};
				var onOtherKey = function(event) {
					if (event.key !== "Escape") onKeyDown(event);
				};
				document.addEventListener("keydown", onOtherKey);
				document.addEventListener("keydown", onEscape, true);
				window.addEventListener("blur", onWindowBlur);
				return function() {
					composition.dispose();
					document.removeEventListener("pointerdown", onPointerDown);
					document.removeEventListener("keydown", onOtherKey);
					document.removeEventListener("keydown", onEscape, true);
					window.removeEventListener("blur", onWindowBlur);
				};
			}, [
				props.open,
				props.onClose,
				props.autoFocus
			]);
			var renderEntry = function(entry) {
				if (isSeparator(entry)) return e("div", {
					className: src_client_controls_Menu_module_css_default.dtsMenuSeparator,
					role: "separator",
					key: entry.id
				});
				if (isLabel(entry)) return e("div", {
					className: src_client_controls_Menu_module_css_default.dtsMenuLabel,
					role: "presentation",
					key: entry.id
				}, entry.text);
				var selected = entry.id === props.selectedId || props.selectedIds !== void 0 && props.selectedIds.indexOf(entry.id) >= 0;
				return e("div", {
					className: src_client_controls_Menu_module_css_default.dtsMenuItemWrap,
					key: entry.id
				}, e("button", {
					type: "button",
					role: "menuitem",
					className: clsx(src_client_controls_Menu_module_css_default.dtsMenuItem, selected && (props.selection === "fill" ? src_client_controls_Menu_module_css_default.dtsMenuSelectedFill : src_client_controls_Menu_module_css_default.dtsMenuSelected), entry.danger === true && src_client_controls_Menu_module_css_default.dtsMenuDanger),
					disabled: entry.disabled === true,
					onClick: function() {
						if (props.onSelect !== void 0) props.onSelect(entry.id);
					}
				}, entry.icon !== void 0 ? e("span", {
					className: src_client_controls_Menu_module_css_default.dtsMenuItemIcon,
					key: "icon"
				}, entry.icon) : null, e("span", {
					className: src_client_controls_Menu_module_css_default.dtsMenuItemLabel,
					key: "label"
				}, entry.label), selected && props.selection !== "fill" ? e(CheckGlyph, {
					className: src_client_controls_Menu_module_css_default.dtsMenuCheck,
					key: "check"
				}) : null));
			};
			var list = props.open ? e(MenuSurface, {
				compact: props.compact === true,
				ref: listRef,
				className: clsx(src_client_controls_Menu_module_css_default.dtsMenuList, props.listClassName, props.dense === true && src_client_controls_Menu_module_css_default.dtsMenuDenseList, props.compact === true && src_client_controls_Menu_module_css_default.dtsMenuCompactList, src_client_controls_Menu_module_css_default.dtsMenuScrollable, props.portal === true && src_client_controls_Menu_module_css_default.dtsMenuPortal, props.side === "top" && props.portal !== true && src_client_controls_Menu_module_css_default.dtsMenuSideTop, props.align === "end" && props.portal !== true && src_client_controls_Menu_module_css_default.dtsMenuAlignEnd),
				style: props.portal === true ? fixedPos === null ? MEASURE_STYLE : fixedPos : void 0,
				role: "menu",
				onClick: function(event) {
					event.stopPropagation();
					if ((event.target instanceof Element ? event.target.closest("button[role=\"menuitem\"]") : null) !== null) refocusAfterSelection();
				}
			}, e("div", {
				className: src_client_controls_Menu_module_css_default.dtsMenuViewport,
				role: "presentation",
				key: "viewport"
			}, items.map(renderEntry), props.children), footer.length > 0 ? e("div", {
				className: src_client_controls_Menu_module_css_default.dtsMenuFooter,
				role: "presentation",
				key: "footer"
			}, footer.map(renderEntry)) : null) : null;
			return e("span", {
				ref: rootRef,
				className: clsx(src_client_controls_Menu_module_css_default.dtsMenuRoot, props.className)
			}, props.anchor, props.portal === true ? list !== null ? createPortal(list, document.body) : null : list);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Modal.module.css.mjs
		const css$2 = ".FayZay_dtsModalRoot{pointer-events:auto;position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:max(24px,var(--dsh-frame-top-clearance,24px)) 24px;}.FayZay_dtsModalMask{position:absolute;inset:0;backdrop-filter:var(--dsw-mask-blur);}.FayZay_dtsModalMask::after{ content:''; position:absolute; inset:0; background:var(--dsw-alias-bg-mask-1); animation:FayZay_dtsModalEnter var(--ds-transition-duration) var(--ds-ease-in-out);}.FayZay_dtsModalDialog{position:relative;z-index:1;display:flex;flex-direction:column;gap:20px;width:min(380px,100%);padding:0 0 24px;overflow:hidden;border:0;border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);animation:FayZay_dtsModalEnter var(--ds-transition-duration) var(--ds-ease-in-out);}@keyframes FayZay_dtsModalEnter{from{opacity:0;}to{opacity:1;}}@media(prefers-reduced-motion:reduce){ .FayZay_dtsModalMask::after,.FayZay_dtsModalDialog{ animation:none;}}.FayZay_dtsModalDialog:focus{ outline:none;}.FayZay_dtsModalContent{display:flex;flex-direction:column;width:100%;}.FayZay_dtsModalHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 12px 24px;}.FayZay_dtsModalTitle{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary);}.FayZay_dtsModalClose{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);}.FayZay_dtsModalClose:hover{ background:var(--dsw-alias-interactive-bg-hover);}.FayZay_dtsModalDescription{margin:0;padding:0 24px;font-size:14px;line-height:22px;font-weight:400;color:var(--dsw-alias-label-primary);}.FayZay_dtsModalBody{display:flex;flex-direction:column;min-width:0;margin-top:20px;padding:0 24px;}.FayZay_dtsModalFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 24px;}";
		const tagId$2 = "dsh-theme-studio/src/client/controls/Modal.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var src_client_controls_Modal_module_css_default = {
			"dtsModalBody": "FayZay_dtsModalBody",
			"dtsModalClose": "FayZay_dtsModalClose",
			"dtsModalContent": "FayZay_dtsModalContent",
			"dtsModalDescription": "FayZay_dtsModalDescription",
			"dtsModalDialog": "FayZay_dtsModalDialog",
			"dtsModalFooter": "FayZay_dtsModalFooter",
			"dtsModalHeader": "FayZay_dtsModalHeader",
			"dtsModalMask": "FayZay_dtsModalMask",
			"dtsModalRoot": "FayZay_dtsModalRoot",
			"dtsModalTitle": "FayZay_dtsModalTitle"
		};
		//#endregion
		//#region src/client/controls/Modal.ts
		/**
		* controls/Modal.ts —— 官方 Modal 的自写替代。
		*
		* 官方来源：lib/index.js:4989-5062（lib/types/Modal.js）+ lib/Modal.module.css
		* + lib/index.js:3632-3719（lib/types/useModalLayer.js，焦点与 Escape 的生命周期，
		* 已逐字移植到 ./runtime.ts 的 useModalLayer）。
		* 抄了什么（官方点名要保的行为全在）：
		*   - 结构与语义：`createPortal(..., document.body)`；根层 `role="presentation"` 且把
		*     `onKeyDownCapture` 挂在**根**上（嵌套对话框因此能在文档级 Escape 之前拦到按键）；
		*     遮罩 `aria-hidden` 且**点击即关**（不吃穿透：遮罩自己就是那一层，点击不会落到页面）；
		*     卡片 `role="dialog"` + `aria-modal="true"` + `aria-label={title}` + `tabIndex=-1`；
		*   - 焦点：`useModalLayer` 保存打开前的 activeElement，初始焦点取 `[data-modal-autofocus]`
		*     → 第一个可聚焦控件 → 容器本身（**必须用 data 属性而不是 React autoFocus**，
		*     否则 autoFocus 会先于本层保存触发控件执行）；关闭（Escape / 应用关闭 / 遮罩点击）
		*     且本层在最顶时把焦点**归还**给先前元素（`focusWithoutRing`，不画焦点环）；
		*   - Escape：仅最顶层模态吃掉，`shift+Escape` 不吃，`event.repeat` 不重复关闭；
		*   - Tab 陷阱：容器聚焦时 Tab/Shift+Tab 分别进首/末个可聚焦控件，在边缘环绕；
		*     `[inert]` / `[hidden]` 子树被排除；
		*   - `headless`：只保留遮罩/卡片/Escape/aria-label，不画默认头与关闭按钮；
		*   - `backdropBlur`：默认 true，走 CSS 的 `backdrop-filter: var(--dsw-mask-blur)`。
		* 改了什么：类名前缀 dts；官方用的关闭图标不能 require，改为内联同一份路径（16 viewBox / 1px）。
		*
		* **核实过的官方事实（任务书里的说法需要更正）**：官方 `backdropBlur` 默认值是 **true**，
		* 不是 false（lib/index.js:5010）。默认形态下遮罩的模糊来自 `var(--dsw-mask-blur)`，而
		* ui-theme 把这个令牌定义为 `none`（ui-theme/lib/client.js:1160），所以**默认效果确实是不模糊背景**
		* —— 与 README.zh.md:118「模态遮罩保留黑色半透明填充，不模糊背景」一致；
		* `backdropBlur={false}` 则是硬写 `backdrop-filter: none`，供重绑过该令牌的宿主显式关掉。
		*/
		/** 官方 IconCloseOutlineRegular 的路径（16 viewBox / 1px 描边），用作关闭按钮图形。 */
		function CloseGlyph$1() {
			return e("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				d: "M2.5 2.5L13.5 13.5",
				stroke: "currentColor",
				key: "a"
			}), e("path", {
				d: "M13.5 2.5L2.5 13.5",
				stroke: "currentColor",
				key: "b"
			}));
		}
		/**
		* 渲染一个居中的、portal 到 body 的模态对话框。
		* @param props - 见 {@link ModalProps}。
		* @returns 关闭时为 null；否则整棵浮层树。
		*/
		function Modal(props) {
			var dialog = useRef(null);
			useModalLayer(dialog, props.open, props.onClose);
			if (!props.open) return null;
			return createPortal(e("div", {
				className: src_client_controls_Modal_module_css_default.dtsModalRoot,
				role: "presentation",
				onKeyDownCapture: props.onKeyDownCapture
			}, e("div", {
				key: "mask",
				className: src_client_controls_Modal_module_css_default.dtsModalMask,
				style: props.backdropBlur === false ? { backdropFilter: "none" } : void 0,
				"aria-hidden": "true",
				onClick: props.onClose
			}), e("div", {
				key: "dialog",
				ref: dialog,
				tabIndex: -1,
				"data-shortcut-modal": props.shortcutModal,
				className: clsx(src_client_controls_Modal_module_css_default.dtsModalDialog, props.className),
				role: "dialog",
				"aria-modal": "true",
				"aria-label": props.title
			}, props.headless === true ? props.children : [e("div", {
				className: clsx(src_client_controls_Modal_module_css_default.dtsModalContent, props.contentClassName),
				key: "content"
			}, e("div", {
				className: src_client_controls_Modal_module_css_default.dtsModalHeader,
				key: "header"
			}, e("h2", {
				className: src_client_controls_Modal_module_css_default.dtsModalTitle,
				key: "title"
			}, props.title), e("button", {
				key: "close",
				type: "button",
				className: src_client_controls_Modal_module_css_default.dtsModalClose,
				"aria-label": props.closeLabel,
				onClick: props.onClose
			}, e(CloseGlyph$1, null))), props.description !== void 0 && props.description !== "" ? e("p", {
				className: src_client_controls_Modal_module_css_default.dtsModalDescription,
				key: "description"
			}, props.description) : null, props.children !== void 0 ? e("div", {
				className: src_client_controls_Modal_module_css_default.dtsModalBody,
				key: "body"
			}, props.children) : null), props.footer !== void 0 ? e("div", {
				className: src_client_controls_Modal_module_css_default.dtsModalFooter,
				key: "footer"
			}, props.footer) : null])), document.body);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Toast.module.css.mjs
		const css$1 = ".L4ok7n_dtsToast{position:fixed;top:40px;left:50%;z-index:1100;pointer-events:none;display:flex;align-items:center;gap:10px;width:max-content;max-width:min(640px,calc(100vw - 48px));padding:12px 16px;border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);font-size:14px;line-height:22px;box-shadow:var(--dsw-shadow-lv3);transform:translateX(-50%);animation:L4ok7n_dtsToastIn 160ms ease-out,L4ok7n_dtsToastFade 1000ms ease var(--dsh-toast-hold,3000ms) forwards;}.L4ok7n_dtsToastIcon{display:grid;place-items:center;flex:none;color:var(--dsw-alias-state-warn-label);}.L4ok7n_dtsToastIconSuccess{color:var(--dsw-alias-state-success-primary);}.L4ok7n_dtsToastText{min-width:0;}.L4ok7n_dtsToastAction{display:inline;padding:0;border:0;background:none;color:var(--dsw-static-deepseek-400);font:inherit;cursor:pointer;margin-inline:3px;pointer-events:auto;}.L4ok7n_dtsToastAction:hover{ opacity:.8;}@keyframes L4ok7n_dtsToastIn{from{opacity:0;transform:translate(-50%,-6px);}to{opacity:1;transform:translate(-50%,0);}}@keyframes L4ok7n_dtsToastFade{to{opacity:0;visibility:hidden;}}@media(prefers-reduced-motion:reduce){ .L4ok7n_dtsToast{ animation:L4ok7n_dtsToastFade 1000ms ease var(--dsh-toast-hold,3000ms) forwards;}}";
		const tagId$1 = "dsh-theme-studio/src/client/controls/Toast.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var src_client_controls_Toast_module_css_default = {
			"dtsToast": "L4ok7n_dtsToast",
			"dtsToastAction": "L4ok7n_dtsToastAction",
			"dtsToastIcon": "L4ok7n_dtsToastIcon",
			"dtsToastIconSuccess": "L4ok7n_dtsToastIconSuccess",
			"dtsToastText": "L4ok7n_dtsToastText"
		};
		//#endregion
		//#region src/client/controls/Toast.ts
		/**
		* controls/Toast.ts —— 官方 Toast 的自写替代。
		*
		* 官方来源：lib/index.js:6592-6682（lib/types/Toast.js）+ lib/Toast.module.css。
		* 抄了什么：顶部居中、portal 到 body（拥有者在有 transform/filter 的祖先里也困不住它）、
		* `role="alert"`、`holdMs` 默认 3000，**保持 `holdMs` 之后才开始淡出**，
		* 卸载定时器是 `holdMs + FADE_MS(1000)`，与样式表的淡出时长共用一个真源
		* （`--dsh-toast-hold` 由组件内联写入）；`onDone` 在淡出结束后回调一次，
		* 且始终调用**最新的** onDone（ref 保存，父组件重渲染不会延长生命周期也不会用旧闭包）；
		* `holdMs` 不变时父组件重渲染不重置计时（effect 依赖只有 holdMs）；
		* `anchor` 给定时横幅跟随该元素水平中心（并监听 resize），否则以视口居中；
		* `actions` 以 "前缀 + 可点动作文字" 续在正文后面成一句，只有动作文字吃指针。
		* 改了什么：类名前缀 dts；官方在 `tone="success"` 时用的
		* `IconCheckCircleOutlineRegular` 不能 require，改为内联同一份 16 viewBox 路径。
		*
		* **核实结论（任务书要求核实 `tone` 的取值）**：官方产物里 `tone` 只有一个被识别的值 ——
		* `'success'`（渲染自带的对勾圈图形，并把图标座染成 success 色）。
		* 省略 `tone` 时图标座保持 **warning** 色（官方图标座样式的 `--dsw-alias-state-warn-label`），
		* 而不是灰色或继承色。没有任何 error/info/warning/neutral 之类的其他 tone 分支
		* （lib/index.js:6664 是唯一的 tone 判断）。
		*/
		/** 满不透明度保持时长；拥有者未给时使用的默认值。 */
		var HOLD_MS = 3e3;
		/** 淡出时长。必须与样式表里的 toast-fade 时长一致。 */
		var FADE_MS = 1e3;
		/** 官方 IconCheckCircleOutlineRegular 的路径（16 viewBox），tone='success' 的图形。 */
		function CheckCircleGlyph() {
			return e("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e("path", {
				key: "check",
				d: "M12.5303 6.53027L8.80273 10.2578C8.54967 10.5109 8.31796 10.7439 8.10645 10.9141C7.88375 11.0932 7.616 11.2602 7.27344 11.3145C7.09229 11.3431 6.90771 11.3431 6.72656 11.3145C6.384 11.2602 6.11625 11.0932 5.89355 10.9141C5.68204 10.7439 5.45033 10.5109 5.19727 10.2578L3.46973 8.53027L4.53027 7.46973L6.25781 9.19727C6.53457 9.47402 6.70036 9.63859 6.83398 9.74609C6.95637 9.84453 6.98241 9.83644 6.96094 9.83301C6.98679 9.83709 7.01321 9.83709 7.03906 9.83301C7.01759 9.83644 7.04363 9.84453 7.16602 9.74609C7.29964 9.63859 7.46543 9.47402 7.74219 9.19727L11.4697 5.46973L12.5303 6.53027Z",
				fill: "currentColor"
			}), e("path", {
				key: "ring",
				d: "M14.5996 8C14.5996 4.35492 11.6451 1.40039 8 1.40039C4.35492 1.40039 1.40039 4.35492 1.40039 8C1.40039 11.6451 4.35492 14.5996 8 14.5996C11.6451 14.5996 14.5996 11.6451 14.5996 8ZM15.9004 8C15.9004 12.363 12.363 15.9004 8 15.9004C3.63695 15.9004 0.0996094 12.363 0.0996094 8C0.0996094 3.63695 3.63695 0.0996094 8 0.0996094C12.363 0.0996094 15.9004 3.63695 15.9004 8Z",
				fill: "currentColor"
			}));
		}
		/**
		* 顶部居中的瞬时横幅：滑入、满不透明度保持、淡出，然后报告完成让拥有者卸载它。
		* 同一段文字再次显示时（拥有者按每次显示的序号 remount），周期重新开始。
		* @param props - 见 {@link ToastProps}。
		* @returns 浮动横幅。
		*/
		function Toast(props) {
			var holdMs = props.holdMs === void 0 ? HOLD_MS : props.holdMs;
			var latestOnDone = useRef(props.onDone);
			useLayoutEffect(function() {
				latestOnDone.current = props.onDone;
			}, [props.onDone]);
			useEffect(function() {
				var timer = setTimeout(function() {
					latestOnDone.current();
				}, holdMs + FADE_MS);
				return function() {
					clearTimeout(timer);
				};
			}, [holdMs]);
			var leftState = useState(null);
			var left = leftState[0];
			var setLeft = leftState[1];
			useLayoutEffect(function() {
				if (props.anchor === null || props.anchor === void 0) return void 0;
				var measure = function() {
					var rect = props.anchor.getBoundingClientRect();
					setLeft(rect.left + rect.width / 2);
				};
				measure();
				window.addEventListener("resize", measure);
				return function() {
					window.removeEventListener("resize", measure);
				};
			}, [props.anchor]);
			var style = { "--dsh-toast-hold": String(holdMs) + "ms" };
			if (left !== null) style.left = left;
			return createPortal(e("div", {
				className: src_client_controls_Toast_module_css_default.dtsToast,
				role: "alert",
				style
			}, props.tone === "success" ? e("span", {
				key: "icon",
				className: clsx(src_client_controls_Toast_module_css_default.dtsToastIcon, src_client_controls_Toast_module_css_default.dtsToastIconSuccess),
				"aria-hidden": true
			}, e(CheckCircleGlyph, null)) : props.icon !== void 0 ? e("span", {
				key: "icon",
				className: src_client_controls_Toast_module_css_default.dtsToastIcon,
				"aria-hidden": true
			}, props.icon) : null, e("span", {
				className: src_client_controls_Toast_module_css_default.dtsToastText,
				key: "text"
			}, props.text, props.actions === void 0 ? null : props.actions.map(function(action) {
				return e(Fragment, { key: action.label }, action.prefix, e("button", {
					type: "button",
					className: src_client_controls_Toast_module_css_default.dtsToastAction,
					onClick: action.onClick
				}, action.label));
			}))), document.body);
		}
		//#endregion
		//#region \0dts-css:D:/agent/dsh-plugin/myself_plugin/dsh-theme-studio/src/client/controls/Tooltip.module.css.mjs
		const css = ".Be0917_dtsTooltipBubble{display:inline-flex;align-items:center;gap:8px;position:fixed;z-index:100;width:max-content;max-width:50vw;padding:3px 7px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-tooltip-bg);color:var(--dsw-static-neutral-bluish-00);font-size:13px;line-height:20px;white-space:pre-line;overflow-wrap:break-word;pointer-events:none;animation:Be0917_dtsTooltipIn 150ms var(--ds-ease-in-out);}.Be0917_dtsTooltipBubble[data-portal]{z-index:1100;}.Be0917_dtsTooltipLabel{min-width:0;}.Be0917_dtsTooltipBubble[data-side='right']{transform:translateY(-50%);}.Be0917_dtsTooltipBubble[data-side='bottom']{transform:translateX(-50%);}.Be0917_dtsTooltipBubble[data-side='top']{transform:translate(-50%,-100%);}.Be0917_dtsTooltipBubble[data-side='bottom'][data-align='end']{transform:translateX(-100%);}.Be0917_dtsTooltipBubble[data-side='top'][data-align='end']{transform:translate(-100%,-100%);}@keyframes Be0917_dtsTooltipIn{from{opacity:0;}}@media(prefers-reduced-motion:reduce){ .Be0917_dtsTooltipBubble{ animation:none;}}";
		const tagId = "dsh-theme-studio/src/client/controls/Tooltip.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-theme-studio";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var src_client_controls_Tooltip_module_css_default = {
			"dtsTooltipBubble": "Be0917_dtsTooltipBubble",
			"dtsTooltipLabel": "Be0917_dtsTooltipLabel"
		};
		//#endregion
		//#region src/client/controls/Tooltip.ts
		/**
		* controls/Tooltip.ts —— 官方 Tooltip 的自写替代。
		*
		* 官方来源：lib/index.js:4486-4689（lib/types/Tooltip.js）+ lib/Tooltip.module.css
		* + lib/index.js:4422-4485（lib/types/input-modality.js 的语义）。
		* 抄了什么（官方点名要保的"定位不触发 React 渲染"就在这里）：
		*   - **锚定克隆子元素**：`cloneElement(children, { ref: mergedRef, onMouseEnter/Leave/Click/Focus/Blur })`，
		*     子元素自己的 ref（callback 或对象）与 tooltip 的 ref 一起转发，子元素原有同名处理器先被调用
		*     再执行 tooltip 逻辑；
		*   - **定位不触发 React 渲染**：位置只在 `show()` 时算一次矩形写进 state，之后气泡的
		*     横向视口钳制、上下翻转、`data-side` 的改写全部直接写 DOM（`el.style.left/top`、
		*     `el.dataset.side`），并由 `ResizeObserver(box: 'border-box')` + window resize 驱动；
		*     首帧没有尺寸前气泡 `visibility: hidden`（不闪现在错误位置）；
		*   - **聚焦按输入模态决定**：`onFocus` 时若最近一次输入来自指针（`pointerModality()`）则**不弹**，
		*     键盘聚焦立即弹出（不受 `delayMs` 影响）；`onClick` 收起并把 focus 标记清掉；
		*     指针离开、失焦都会收起，show 定时器成对清理；
		*   - `portal`：把气泡渲染到 document.body，逃出祖先的裁剪与层叠上下文；默认 false（就地）。
		* 改了什么：类名前缀 dts；不引 `ShortcutKeys`（键帽不在本层控件清单），因此没有
		* `shortcutKeys` prop、没有 `[data-has-shortcut]` 样式、也不写只有键帽才需要的那条
		* `aria-label`；不引 `TooltipSuppression` 上下文（官方用它让嵌套的 HoverCard/灯箱让位，
		* 本层没有这两个组件）。`label` 因此成为必填。
		* 监听器纪律：`ResizeObserver` + window resize 随 effect 成对摘除；
		* 输入模态走 runtime 的**引用计数订阅**（首个 Tooltip 挂、最后一个摘），不留常驻全局监听。
		*/
		/**
		* 给锚点元素挂一个悬停/聚焦提示。
		* @param props - 见 {@link TooltipProps}。
		* @returns 克隆后的锚点，外加可选的 fixed 定位气泡。
		*/
		function Tooltip(props) {
			var anchor = useRef(null);
			var childRef = props.children === null || props.children === void 0 ? void 0 : props.children.ref;
			var mergedRef = useCallback(function(el) {
				anchor.current = el;
				if (typeof childRef === "function") childRef(el);
				else if (childRef !== null && childRef !== void 0) childRef.current = el;
			}, [childRef]);
			var posState = useState(null);
			var pos = posState[0];
			var setPos = posState[1];
			var bubble = useRef(null);
			var side = props.side === void 0 ? "right" : props.side;
			var align = props.align === void 0 ? "center" : props.align;
			var gap = props.gap === void 0 ? 8 : props.gap;
			var disabled = props.disabled === true;
			var portal = props.portal === true;
			var resolvedLabel = pos === null ? null : typeof props.label === "function" ? props.label() : props.label;
			var y = pos === null ? 0 : side === "right" ? pos.top + (pos.bottom - pos.top) / 2 : side === "top" ? pos.top - gap : pos.bottom + gap;
			var showTimer = useRef(null);
			var triggers = useRef({
				hover: false,
				focus: false
			});
			var visible = pos !== null && !disabled;
			useEffect(function() {
				return subscribeInputModality();
			}, []);
			useEffect(function() {
				var el = bubble.current;
				if (pos === null || !visible || el === null || el === void 0) return void 0;
				var edgeMargin = 12;
				var size;
				var placement = side;
				var fit = function() {
					if (size === void 0) return;
					var width = size.inlineSize;
					var height = size.blockSize;
					var offset = side === "right" ? 0 : align === "end" ? width : width / 2;
					var left = Math.max(edgeMargin, Math.min(pos.x - offset, window.innerWidth - edgeMargin - width));
					var fitsBelow = pos.bottom + gap + height <= window.innerHeight - edgeMargin;
					var fitsAbove = pos.top - gap - height >= edgeMargin;
					if (placement === "bottom" && !fitsBelow && fitsAbove) placement = "top";
					else if (placement === "top" && !fitsAbove && fitsBelow) placement = "bottom";
					el.style.left = String(left + offset) + "px";
					el.style.top = String(placement === "right" ? (pos.top + pos.bottom) / 2 : placement === "top" ? pos.top - gap : pos.bottom + gap) + "px";
					el.dataset.side = placement;
					el.style.visibility = "visible";
				};
				var observer = new ResizeObserver(function(entries) {
					size = entries[0].borderBoxSize[0];
					fit();
				});
				observer.observe(el, { box: "border-box" });
				window.addEventListener("resize", fit);
				return function() {
					observer.disconnect();
					window.removeEventListener("resize", fit);
				};
			}, [
				align,
				gap,
				pos,
				side,
				visible
			]);
			var cancelShow = useCallback(function() {
				if (showTimer.current === null || showTimer.current === void 0) return;
				clearTimeout(showTimer.current);
				showTimer.current = null;
			}, []);
			useEffect(function() {
				if (disabled) {
					cancelShow();
					triggers.current = {
						hover: false,
						focus: false
					};
					setPos(null);
				}
				return cancelShow;
			}, [cancelShow, disabled]);
			var show = function() {
				if (disabled) return;
				var el = anchor.current;
				if (el === null || el === void 0) return;
				var r = el.getBoundingClientRect();
				setPos({
					x: side === "right" ? r.right + 10 : align === "end" ? r.right : r.left + r.width / 2,
					top: r.top,
					bottom: r.bottom
				});
			};
			var showAfterHoverDelay = function() {
				cancelShow();
				if (props.delayMs === void 0 || props.delayMs <= 0) {
					show();
					return;
				}
				showTimer.current = setTimeout(function() {
					showTimer.current = null;
					show();
				}, props.delayMs);
			};
			var hide = function() {
				cancelShow();
				if (!triggers.current.hover && !triggers.current.focus) setPos(null);
			};
			var content = visible ? e("span", {
				ref: bubble,
				className: src_client_controls_Tooltip_module_css_default.dtsTooltipBubble,
				"data-side": side,
				"data-portal": portal || void 0,
				"data-align": align,
				style: Object.assign({
					left: pos.x,
					top: y,
					visibility: "hidden"
				}, props.maxWidth === void 0 ? {} : { maxWidth: props.maxWidth }),
				role: "tooltip"
			}, resolvedLabel ? e("span", {
				className: src_client_controls_Tooltip_module_css_default.dtsTooltipLabel,
				key: "label"
			}, resolvedLabel) : null) : null;
			var child = props.children;
			var cloned = cloneElement(child, {
				ref: mergedRef,
				onMouseEnter: function(event) {
					if (child.props.onMouseEnter !== void 0) child.props.onMouseEnter(event);
					triggers.current.hover = true;
					showAfterHoverDelay();
				},
				onMouseLeave: function(event) {
					if (child.props.onMouseLeave !== void 0) child.props.onMouseLeave(event);
					triggers.current.hover = false;
					cancelShow();
					setPos(null);
				},
				onClick: function(event) {
					if (child.props.onClick !== void 0) child.props.onClick(event);
					triggers.current.focus = false;
					cancelShow();
					setPos(null);
				},
				onFocus: function(event) {
					if (child.props.onFocus !== void 0) child.props.onFocus(event);
					if (pointerModality()) return;
					triggers.current.focus = true;
					cancelShow();
					show();
				},
				onBlur: function(event) {
					if (child.props.onBlur !== void 0) child.props.onBlur(event);
					triggers.current.focus = false;
					hide();
				}
			});
			if (!portal) return e(Fragment, null, cloned, content);
			return e(Fragment, null, cloned, content !== null ? createPortal(content, document.body) : null);
		}
		//#endregion
		//#region src/client/primitives.ts
		function uiButton(props) {
			return e$1(Button, {
				variant: props.variant === "primary" ? "primary" : "ghost",
				className: props.variant === "danger" ? "dts-btn-danger" : void 0,
				size: props.size,
				disabled: props.disabled,
				title: props.title,
				"aria-label": props.ariaLabel,
				"data-modal-autofocus": props.autofocus === true ? "" : void 0,
				onClick: props.onClick
			}, props.children);
		}
		/** Switch 的 label 只做无障碍名称（官方实现不画文字），可见标签由 Row 给。 */
		function uiSwitch(props) {
			return e$1(Switch, {
				checked: !!props.checked,
				disabled: props.disabled,
				title: props.title,
				label: props.label,
				onChange: props.onChange
			});
		}
		function uiPill(props) {
			return e$1(Pill, {
				active: !!props.active,
				title: props.title,
				onClick: props.onClick
			}, props.children);
		}
		/** 状态点：控件的 prop 是 `state`（done/warning/error/idle/ongoing）。 */
		function uiStateDot(props) {
			return e$1(StateDot, { state: props.state });
		}
		/**
		* Tooltip 的 children 必须能接 ref ⇒ **只包原生元素**。
		* 控件靠 `cloneElement(child, { ref })` 定位锚点，函数式/类组件不转发 ref
		* 就永远量不到矩形、气泡永不出现（旧适配层踩过同一个坑）。
		* label 为空时直接返回 children：不挂一个没有文案的气泡。
		*/
		function uiTooltip(label, child) {
			if (!label) return child;
			return e$1(Tooltip, {
				label,
				side: "top"
			}, child);
		}
		//#endregion
		//#region src/client/tabs.ts
		/**
		* 面板图标。导航项图标无法自定义（ui-settings-general 的 navIcon 是硬编码表，
		* settings.section 注册项也没有 icon 字段），所以只画在标题与浮动按钮上。
		*/
		var ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 1.9a6.1 6.1 0 1 0 0 12.2c1 0 1.6-.7 1.6-1.5 0-.4-.2-.7-.4-1-.2-.3-.3-.5-.3-.9 0-.8.6-1.4 1.5-1.4h1.2a2.5 2.5 0 0 0 2.5-2.5c0-2.7-2.6-4.9-6.1-4.9Z\"/><circle cx=\"4.6\" cy=\"6.6\" r=\".95\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"7.6\" cy=\"4.4\" r=\".95\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"10.9\" cy=\"6.2\" r=\".95\" fill=\"currentColor\" stroke=\"none\"/></svg>";
		function Svg() {
			return e$1("span", {
				"aria-hidden": "true",
				style: { display: "inline-flex" },
				dangerouslySetInnerHTML: { __html: ICON }
			});
		}
		/** 数组 children 统一补 key 并剔除 null 分支。 */
		function keyed(children) {
			if (!Array.isArray(children)) return children;
			var out = [];
			for (var i = 0; i < children.length; i += 1) {
				var child = children[i];
				if (child === null || child === void 0 || child === false) continue;
				if (Array.isArray(child)) {
					out = out.concat(keyed(child));
					continue;
				}
				out.push(child.key === null || child.key === void 0 ? React$1.cloneElement(child, { key: "k" + i }) : child);
			}
			return out;
		}
		/**
		* 设置页分组 —— 官方范式：**普通 div 撑满列宽，没有卡片壳**。
		* 官方 `DeveloperToolsRow` 与 `PluginsSettingsSection`（ui-settings-general / ui-settings-plugins）
		* 都用"页面级 h2 18/600 + 分组 h3 15/600 + 引言 13/tertiary + 行分割线"分层，
		* 没有自绘卡片边框。旧实现是 12px 内边距 + 圆角 + `bg-layer-2` + `elevation-soft`
		* 的卡片壳 —— 与官方设置页并排看就是两套语言。
		*/
		function Group(props) {
			return e$1("div", { className: "dts-group" }, props.title ? e$1("h3", { className: "dts-group-title" }, props.title) : null, props.hint ? e$1("p", { className: "dts-group-desc" }, props.hint) : null, keyed(props.children));
		}
		/**
		* 设置页行 —— 官方 `DeveloperToolsRow.module.css` 逐字：
		*   `display:flex; justify-content:space-between; align-items:center; gap:24px;
		*    padding:16px 0; border-bottom:.5px solid var(--dsw-alias-border-l2)`
		* 标题 `14px/20`、描述 `12px/18 var(--dsw-alias-label-secondary)` + `margin-top:4px`。
		* 旧实现是 grid 三列（`minmax(96px,168px) 1fr auto`）+ 12.5px 标签。
		*
		* ⚠️ 行**自己**不判断"我是不是最后一个" —— 行末分割线由**容器**用后代选择器收尾，
		*   这是官方写法（`section>[data-slot="settings.general.item"]>:last-child{border-bottom:none}`），
		*   见 chrome.ts 的 `.dts-group>.dts-row:last-child`。
		*
		* 入参：`label` 行标题（必填、已本地化）、`hint` 行描述（可选）、
		* `children` 右侧控件区、`tail` 最右侧附加物（按钮/读数）。
		*/
		function Row(props) {
			return e$1("div", { className: "dts-row" }, e$1("div", { className: "dts-row-text" }, e$1("div", { className: "dts-row-title" }, props.label), props.hint ? e$1("div", { className: "dts-row-desc" }, props.hint) : null), e$1("div", { className: "dts-row-control" }, keyed(props.children)), props.tail ? e$1("div", { className: "dts-row-tail" }, keyed(props.tail)) : null);
		}
		/**
		* 滑块 —— 直接转发到自写控件层的 `Slider`。
		*
		* 旧实现是本文件里的原生 `<input type=range>` + `<output>`（`.dts-range` 一族），
		* 几何/字号/数值排版全是自造值；控件层那份是"官方没有 Slider，按官方设置页
		* 字段几何与排版令牌自写"的版本（可见标签 + 右侧 tabular-nums 数值 +
		* `aria-valuetext` + 越界钳制），并且已经过真机渲染冒烟。
		*
		* 参数换名：旧的 `suffix` → 控件的 `unit`；旧的 `format(v)` 回调**不保留**
		* （控件只做 `String(value) + unit`）—— 需要百分数显示的地方改为在调用点把
		* 值域折成百分数（如 `dim 0.3` → 滑块值 `30` + `unit:'%'`），语义不变。
		*/
		function Range(props) {
			return e$1(Slider, {
				label: props.label,
				value: props.value,
				onChange: props.onChange,
				min: props.min,
				max: props.max,
				step: props.step,
				unit: props.unit === void 0 ? props.suffix : props.unit,
				showValue: props.showValue,
				hint: props.hint,
				disabled: props.disabled,
				id: props.id
			});
		}
		/**
		* 下拉选择 —— 直接转发到自写控件层的 `Select`。
		*
		* 旧实现是本文件里的 `Choice`（约 190 行：自绘触发器 + 自绘弹层 + 手写
		* ↑↓/Home/End/Enter/Space/Tab/Esc 键盘 + 视口翻转测量 + 文档级 mousedown），
		* 整段已删除。控件层那份是"官方 primitives 没有下拉，按官方 Menu 的键盘范式
		* + 官方 `fields.module.css` 的触发器几何 + `MenuSurface` 材质自写"的版本，
		* 语义用 `listbox`/`option`（"在 N 个互斥值里选一个"的 ARIA 正道），
		* `portal` 默认 true（面板在可滚动容器里，就地列表会被祖先 overflow 裁掉）。
		*/
		function Choice(props) {
			return e$1(Select, {
				label: props.label,
				value: props.value,
				options: props.options,
				onChange: props.onChange,
				placeholder: props.placeholder,
				disabled: props.disabled,
				className: props.className
			});
		}
		/** 开关一律用 Switch（官方缺失时退回自绘），文字标签由外层 Row 给。 */
		function Toggle(props) {
			return uiSwitch({
				checked: props.checked,
				label: props.label,
				title: props.title,
				onChange: props.onChange
			});
		}
		function ColorField(props) {
			var value = props.value || "";
			return e$1("div", { className: "dts-color" }, e$1("input", {
				type: "color",
				value: value === "" ? "#808080" : toHex(value),
				"aria-label": props.label,
				onChange: function(event) {
					props.onChange(event.target.value);
				}
			}), uiInput({
				style: { flex: 1 },
				value,
				placeholder: "#rrggbb",
				spellCheck: false,
				"aria-label": props.label,
				onChange: function(event) {
					props.onChange(event.target.value.trim());
				}
			}), value !== "" ? uiButton({
				variant: "ghost",
				ariaLabel: props.label,
				title: props.clearLabel,
				onClick: function() {
					props.onChange("");
				},
				children: "×"
			}) : null);
		}
		/**
		* 自写控件层的 Input：className 落外层 wrapper、其余属性透传给内层 input，
		* 直接把 style 透进去只作用到内层、flex 布局吃不到 —— 包一层承接布局样式。
		* 形状与旧「官方 Input 在位」那条路径逐字一致（wrapper span + 控件自身 wrapper），
		* 只是实现换成了 ./controls/Input.ts，不再 require 官方包。
		*/
		function uiInput(props) {
			var inner = Object.assign({}, props);
			delete inner.style;
			return e$1("span", {
				className: "dts-input-flex",
				style: props.style
			}, e$1(Input, inner));
		}
		/**
		* 确认框 —— 走自写控件层的 `Modal`（官方 `useModalLayer` 契约）。
		*
		* 旧实现是自造 `.dts-scrim` + `.dts-dialog` 与一套手写键盘：Esc=取消、
		* Enter=确认、document 捕获阶段的 Tab 焦点陷阱、30ms 后把焦点放到最后一个按钮。
		* 现在这些**全部由 Modal 提供**，且都是官方契约：
		*   · Esc 只归**最顶层**模态（栈语义；不再需要 `engine.get().dialog !== null` 那种手写让位）；
		*   · 遮罩点击即关、`aria-hidden`、不吃穿透；
		*   · Tab 焦点陷阱（容器聚焦时进首/末项、边缘环绕、排除 `[inert]/[hidden]`）；
		*   · 关闭时把焦点归还给打开前的元素（`focusWithoutRing`）；
		*   · 初始焦点取 `[data-modal-autofocus]` —— **必须用 data 属性而不是 React autoFocus**
		*     （autoFocus 会先于本层保存触发元素执行）。这里给确认键打这个标记。
		* Enter=确认不属官方契约（官方 Modal 只认 Esc / 应用关闭 / 遮罩点击），
		* 保留在根层的 `onKeyDownCapture` 里 —— 捕获阶段先于文档级监听，不会被 Esc 抢走。
		*/
		function ConfirmDialog(props) {
			return e$1(Modal, {
				open: true,
				title: props.title,
				closeLabel: props.cancelLabel,
				className: "dts-dialog-modal",
				onClose: function() {
					props.onDone(false);
				},
				onKeyDownCapture: function(event) {
					if (event.key !== "Enter") return;
					event.preventDefault();
					props.onDone(true);
				},
				footer: e$1("div", { className: "dts-dialog-foot" }, uiButton({
					variant: "ghost",
					onClick: function() {
						props.onDone(false);
					},
					children: props.cancelLabel
				}), uiButton({
					variant: props.tone === "danger" ? "danger" : "primary",
					autofocus: true,
					onClick: function() {
						props.onDone(true);
					},
					children: props.confirmLabel
				}))
			}, (props.lines || []).filter(function(line) {
				return line !== "";
			}).map(function(line, index) {
				return e$1("div", {
					key: index,
					className: "dts-dialog-line",
					"data-kind": /[\\/]/.test(line) ? "path" : "text"
				}, line);
			}));
		}
		function FocusPad(props) {
			var boxRef = useRef$1(null);
			/**
			* 拖动合帧：每个 pointermove 都 patch 会深拷贝整份 doc 并重渲整棵活动
			* 页签（store 是单例订阅、全文件无 memo）。与 layer.ts 的视差同款 rAF 门：
			* 一帧最多落地一次 —— 视觉仍是跟手的 60fps，重渲次数从"事件频率"降到"帧率"。
			* ⚠️ 暂存的是**数值**不是事件对象：React 16 会回收合成事件，延后取
			* clientX/clientY 会取到 null。
			*/
			var frameRaf = 0;
			var pendingPoint = null;
			function flushFrame() {
				frameRaf = 0;
				var point = pendingPoint;
				pendingPoint = null;
				if (point === null) return;
				pickAt(point.x, point.y);
			}
			function pickAt(clientX, clientY) {
				var box = boxRef.current;
				if (box === null) return;
				var rect = box.getBoundingClientRect();
				props.onChange(Math.round(clamp$1((clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100)), Math.round(clamp$1((clientY - rect.top) / Math.max(1, rect.height) * 100, 0, 100)));
			}
			function pick(event) {
				pickAt(event.clientX, event.clientY);
			}
			useEffect$1(function() {
				return function() {
					if (frameRaf !== 0 && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frameRaf);
					frameRaf = 0;
					pendingPoint = null;
				};
			}, []);
			return e$1("div", {
				ref: boxRef,
				className: "dts-focus",
				style: Object.assign({}, props.src ? { backgroundImage: "url(\"" + props.src + "\")" } : null, {
					"--fx": props.x + "%",
					"--fy": props.y + "%"
				}),
				onPointerDown: function(event) {
					event.preventDefault();
					if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
					pick(event);
				},
				onPointerMove: function(event) {
					if (event.buttons !== 1) return;
					pendingPoint = {
						x: event.clientX,
						y: event.clientY
					};
					if (frameRaf !== 0) return;
					frameRaf = window.requestAnimationFrame(flushFrame);
				}
			});
		}
		/** 预设/渐变缩略图：只画小卡片，真样式一律来自宿主投影。 */
		var THUMBS = {
			midnight: "linear-gradient(160deg,#05070f,#0f1b3d,#25264a)",
			aurora: "linear-gradient(135deg,#0b1b3a,#123a5c,#1d6f6a,#7ad0c1)",
			sunset: "linear-gradient(180deg,#1a0b2e,#7b2d58,#e0763c,#f5c26b)",
			ink: "linear-gradient(145deg,#0d0d10,#1c1f26,#2b3040)",
			paper: "linear-gradient(160deg,#f7f2e7,#ece2cf,#e3d6bd)",
			sakura: "linear-gradient(150deg,#2a1020,#743057,#d98a9c,#f7d9d9)",
			forest: "linear-gradient(155deg,#04120c,#0d3b2a,#2f7a52,#8fc98f)",
			cyber: "linear-gradient(120deg,#05010f,#1b0b3a,#4a0f6b,#00e5ff)",
			ember: "linear-gradient(150deg,#150606,#3d1010,#8c2f18,#e0a24c)",
			orchid: "linear-gradient(140deg,#0a0714,#1e1140,#43237a,#8b6ff0)"
		};
		function gradientThumb(name, fallback) {
			if (Object.hasOwn(THUMBS, name)) return THUMBS[name];
			if (!fallback || !Array.isArray(fallback.stops)) return THUMBS.midnight;
			return "linear-gradient(" + (fallback.angle || 135) + "deg, " + fallback.stops.join(", ") + ")";
		}
		function PresetTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var presets = env.state.presets || [];
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("base.scheme"),
				hint: tt("base.hint"),
				children: [Row({
					label: tt("base.scheme"),
					children: e$1(SegmentedControl, {
						id: "dts-scheme",
						label: tt("base.scheme"),
						value: doc.base.scheme,
						options: [
							{
								value: "system",
								label: tt("base.system")
							},
							{
								value: "light",
								label: tt("base.light")
							},
							{
								value: "dark",
								label: tt("base.dark")
							}
						],
						onChange: function(value) {
							env.patch(function(d) {
								d.base.scheme = value;
							});
						}
					})
				}), Row({
					label: tt("base.fontSize"),
					children: Range({
						label: tt("base.fontSize"),
						min: 12,
						max: 17,
						value: doc.base.fontSize,
						unit: "px",
						onChange: function(value) {
							env.patch(function(d) {
								d.base.fontSize = value;
							});
						}
					})
				})]
			}), Group({
				title: tt("preset.groupTitle"),
				hint: tt("preset.note"),
				children: e$1("div", { className: "dts-swatches" }, presets.map(function(preset) {
					var art = preset.accent === "" ? "linear-gradient(135deg,#f5f6f7,#dfe3e8)" : gradientThumb(preset.gradient);
					return e$1("button", {
						key: preset.id,
						type: "button",
						className: "dts-swatch",
						"aria-pressed": doc.preset === preset.id ? "true" : "false",
						onClick: function() {
							env.applyPreset(preset.id);
						}
					}, e$1("span", {
						className: "dts-swatch-art",
						style: {
							background: art,
							boxShadow: preset.accent === "" ? void 0 : "inset 0 -3px 0 0 " + preset.accent
						}
					}), e$1("span", { className: "dts-swatch-name" }, preset.name), e$1("span", { className: "dts-swatch-note" }, preset.note || preset.id));
				}))
			}));
		}
		function Uploader(props) {
			var env = props.env, tt = props.t;
			var inputRef = useRef$1(null);
			var hot = useState$1(false);
			var busy = useState$1("");
			function pick() {
				if (inputRef.current) inputRef.current.click();
			}
			function handle(files) {
				var list = Array.prototype.slice.call(files || []);
				if (list.length === 0) return;
				busy[1]("uploading");
				var done = 0;
				list.reduce(function(chain, file) {
					return chain.then(function() {
						return env.upload(file).then(function(value) {
							done += 1;
							return value;
						}, function() {});
					});
				}, Promise.resolve()).then(function() {
					busy[1]("");
					if (done > 0) env.notify(tt("common.uploaded") + " ×" + done, "ok");
				});
			}
			return e$1("div", null, e$1("div", {
				className: "dts-drop",
				"data-hot": hot[0] ? "true" : "false",
				role: "button",
				tabIndex: 0,
				onClick: pick,
				onKeyDown: function(event) {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						pick();
					}
				},
				onDragOver: function(event) {
					event.preventDefault();
					hot[1](true);
				},
				onDragLeave: function() {
					hot[1](false);
				},
				onDrop: function(event) {
					event.preventDefault();
					hot[1](false);
					handle(event.dataTransfer && event.dataTransfer.files);
				}
			}, busy[0] === "uploading" ? tt("common.uploading") : tt("common.dropHere")), e$1("input", {
				ref: inputRef,
				type: "file",
				multiple: true,
				hidden: true,
				accept: props.accept,
				onChange: function(event) {
					handle(event.target.files);
					event.target.value = "";
				}
			}));
		}
		function BackdropTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var b = doc.backdrop;
			var media = env.state.media || {};
			var meta = mediaLookup(media, b.mediaId);
			var src = meta ? env.mediaUrl(meta) : "";
			var isMedia = b.mode === "image" || b.mode === "video";
			function set(field, value) {
				env.patch(function(d) {
					d.backdrop[field] = value;
				});
			}
			function setVideo(field, value) {
				env.patch(function(d) {
					d.backdrop.video[field] = value;
				});
			}
			/** 字段滑块（走控件层 Slider）。`unit` 是显示后缀，也是 aria-valuetext 的内容。 */
			function range(labelKey, min, max, field, unit, step) {
				return Row({
					label: tt(labelKey),
					children: Range({
						label: tt(labelKey),
						min,
						max,
						value: b[field],
						unit,
						step: step === void 0 ? unit ? 1 : .05 : step,
						onChange: function(v) {
							set(field, v);
						}
					})
				});
			}
			/**
			* 分数值滑块（文档里存 0..1，界面显示百分数）。
			* 控件层 Slider 只做 `String(value) + unit`，没有 format 回调 —— 于是把
			* **值域折成百分数**再交给它：语义不变（写回时 ÷100），读数与旧 format 逐字相同。
			*/
			function percentRange(labelKey, minPercent, maxPercent, read, write) {
				return Row({
					label: tt(labelKey),
					children: Range({
						label: tt(labelKey),
						min: minPercent,
						max: maxPercent,
						step: 1,
						unit: "%",
						value: Math.round(read() * 100),
						onChange: function(v) {
							write(v / 100);
						}
					})
				});
			}
			var options = [{
				value: "",
				label: tt("color.noToken")
			}];
			var want = b.mode === "video" ? "video" : "image";
			Object.keys(media).forEach(function(id) {
				if (media[id].kind === want) options.push({
					value: id,
					label: media[id].name
				});
			});
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("backdrop.mode"),
				hint: tt("backdrop.hint"),
				children: [
					Row({
						label: tt("backdrop.mode"),
						children: e$1(SegmentedControl, {
							id: "dts-backdrop-mode",
							label: tt("backdrop.mode"),
							value: b.mode,
							options: [
								{
									value: "none",
									label: tt("common.none")
								},
								{
									value: "image",
									label: tt("common.image")
								},
								{
									value: "video",
									label: tt("common.video")
								},
								{
									value: "gradient",
									label: tt("common.gradient")
								}
							],
							onChange: function(v) {
								env.setBackdropMode(v);
							}
						})
					}),
					isMedia ? options.length === 1 ? e$1("p", {
						className: "dts-note",
						"data-tone": "warn"
					}, tt("common.empty")) : Row({
						label: tt("backdrop.pick"),
						children: e$1(Choice, {
							label: tt("backdrop.pick"),
							value: b.mediaId,
							options,
							onChange: function(v) {
								set("mediaId", v);
							}
						})
					}) : null,
					b.mode === "gradient" ? e$1("div", { className: "dts-swatches" }, Object.keys(env.state.gradients || {}).map(function(name) {
						var gradient = env.state.gradients[name];
						return e$1("button", {
							key: name,
							type: "button",
							className: "dts-swatch",
							"aria-pressed": b.gradient === name ? "true" : "false",
							onClick: function() {
								set("gradient", name);
							}
						}, e$1("span", {
							className: "dts-swatch-art",
							style: { background: gradientThumb(name, gradient) }
						}), e$1("span", { className: "dts-swatch-name" }, gradient.label || name));
					})) : null,
					isMedia ? e$1(Uploader, {
						env,
						t: tt,
						accept: want + "/*"
					}) : null
				]
			}), b.mode === "image" ? Group({
				title: tt("backdrop.fit"),
				children: [
					Row({
						label: tt("backdrop.fit"),
						children: e$1(Choice, {
							label: tt("backdrop.fit"),
							value: b.fit,
							options: [{
								value: "cover",
								label: tt("backdrop.cover")
							}, {
								value: "contain",
								label: tt("backdrop.contain")
							}],
							onChange: function(v) {
								set("fit", v);
							}
						})
					}),
					Row({
						label: tt("backdrop.tile"),
						children: Toggle({
							checked: b.tile,
							label: tt("backdrop.tile"),
							onChange: function(v) {
								set("tile", v);
							}
						})
					}),
					range("backdrop.scale", .5, 4, "scale", "×", .05),
					Row({
						label: tt("backdrop.focus"),
						hint: tt("backdrop.focusHint"),
						tail: [e$1(NumberField, {
							label: "X %",
							min: 0,
							max: 100,
							step: 1,
							value: b.focusX,
							className: "dts-focus-num",
							onChange: function(v) {
								env.patch(function(d) {
									d.backdrop.focusX = v;
								});
							}
						}), e$1(NumberField, {
							label: "Y %",
							min: 0,
							max: 100,
							step: 1,
							value: b.focusY,
							className: "dts-focus-num",
							onChange: function(v) {
								env.patch(function(d) {
									d.backdrop.focusY = v;
								});
							}
						})],
						children: e$1(FocusPad, {
							src,
							x: b.focusX,
							y: b.focusY,
							onChange: function(x, y) {
								env.patch(function(d) {
									d.backdrop.focusX = x;
									d.backdrop.focusY = y;
								});
							}
						})
					})
				]
			}) : null, isMedia ? Group({
				title: tt("backdrop.filters"),
				children: [
					range("backdrop.blur", 0, 40, "blur", "px"),
					range("backdrop.brightness", 20, 220, "brightness", "%"),
					range("backdrop.saturate", 0, 300, "saturate", "%"),
					range("backdrop.contrast", 20, 300, "contrast", "%"),
					range("backdrop.grayscale", 0, 100, "grayscale", "%"),
					range("backdrop.sepia", 0, 100, "sepia", "%"),
					range("backdrop.hueRotate", -180, 180, "hueRotate", "°")
				]
			}) : null, b.mode !== "none" ? Group({
				title: tt("backdrop.veil"),
				children: [
					Row({
						label: tt("backdrop.dim"),
						children: Range({
							label: tt("backdrop.dim"),
							min: 0,
							max: 95,
							step: 1,
							unit: "%",
							value: Math.round(b.dim * 100),
							onChange: function(v) {
								set("dim", v / 100);
							}
						})
					}),
					Row({
						label: tt("backdrop.veilColor"),
						children: ColorField({
							label: tt("backdrop.veilColor"),
							value: b.veilColor,
							clearLabel: tt("color.clear"),
							onChange: function(v) {
								set("veilColor", v);
							}
						})
					}),
					Row({
						label: tt("backdrop.veilGradient"),
						children: Toggle({
							checked: b.veilGradient,
							label: tt("backdrop.veilGradient"),
							onChange: function(v) {
								set("veilGradient", v);
							}
						})
					})
				]
			}) : null, b.mode !== "none" ? Group({
				title: tt("backdrop.motion"),
				children: [
					Row({
						label: tt("backdrop.kenBurns"),
						children: Toggle({
							checked: b.kenBurns,
							label: tt("backdrop.kenBurns"),
							onChange: function(v) {
								set("kenBurns", v);
							}
						}),
						tail: Range({
							label: tt("backdrop.kenBurnsSeconds"),
							min: 8,
							max: 240,
							step: 2,
							unit: "s",
							value: b.kenBurnsSeconds,
							onChange: function(v) {
								set("kenBurnsSeconds", v);
							}
						})
					}),
					range("backdrop.parallax", 0, 60, "parallax", ""),
					Row({
						label: tt("backdrop.fadeOnFocus"),
						children: Toggle({
							checked: b.fadeOnFocus,
							label: tt("backdrop.fadeOnFocus"),
							onChange: function(v) {
								set("fadeOnFocus", v);
							}
						})
					})
				]
			}) : null, b.mode === "video" ? Group({
				title: tt("backdrop.videoTitle"),
				children: [
					Row({
						label: tt("backdrop.muted"),
						children: Toggle({
							checked: b.video.muted,
							label: tt("backdrop.muted"),
							onChange: function(v) {
								setVideo("muted", v);
							}
						})
					}),
					Row({
						label: tt("backdrop.loop"),
						children: Toggle({
							checked: b.video.loop,
							label: tt("backdrop.loop"),
							onChange: function(v) {
								setVideo("loop", v);
							}
						})
					}),
					Row({
						label: tt("backdrop.autoplay"),
						children: Toggle({
							checked: b.video.autoplay,
							label: tt("backdrop.autoplay"),
							onChange: function(v) {
								setVideo("autoplay", v);
							}
						})
					}),
					Row({
						label: tt("backdrop.playbackRate"),
						children: Range({
							label: tt("backdrop.playbackRate"),
							min: .25,
							max: 2,
							step: .05,
							unit: "×",
							value: b.video.playbackRate,
							onChange: function(v) {
								setVideo("playbackRate", v);
							}
						})
					})
				]
			}) : null, b.mode !== "none" ? Group({
				title: tt("glass.enabled"),
				hint: tt("glass.hint"),
				children: [
					Row({
						label: tt("glass.enabled"),
						children: Toggle({
							checked: doc.glass.enabled,
							label: tt("glass.enabled"),
							onChange: function(v) {
								env.patch(function(d) {
									d.glass.enabled = v;
								});
							}
						})
					}),
					percentRange("glass.alpha", 15, 100, function() {
						return doc.glass.alpha;
					}, function(v) {
						env.patch(function(d) {
							d.glass.alpha = v;
						});
					}),
					Row({
						label: tt("glass.blur"),
						children: Range({
							label: tt("glass.blur"),
							min: 0,
							max: 60,
							value: doc.glass.blur,
							unit: "px",
							onChange: function(v) {
								env.patch(function(d) {
									d.glass.blur = v;
								});
							}
						})
					}),
					Row({
						label: tt("glass.saturate"),
						children: Range({
							label: tt("glass.saturate"),
							min: 100,
							max: 300,
							step: 5,
							value: doc.glass.saturate,
							unit: "%",
							onChange: function(v) {
								env.patch(function(d) {
									d.glass.saturate = v;
								});
							}
						})
					})
				]
			}) : null);
		}
		function LibraryTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var media = env.state.media || {};
			var list = Object.keys(media).map(function(id) {
				return media[id];
			}).sort(function(a, b) {
				return (b.addedAt || 0) - (a.addedAt || 0);
			});
			return e$1("div", { className: "dts-body" }, e$1(Uploader, {
				env,
				t: tt,
				accept: "image/*,video/*,.woff,.woff2,.ttf,.otf"
			}), list.length === 0 ? e$1("p", { className: "dts-note" }, tt("common.empty")) : e$1("div", { className: "dts-library" }, list.map(function(item) {
				var active = doc.backdrop.mediaId === item.id;
				return e$1("div", {
					key: item.id,
					className: "dts-card"
				}, item.kind === "video" ? e$1("video", {
					className: "dts-thumb",
					src: env.mediaUrl(item),
					muted: true,
					playsInline: true,
					preload: "metadata"
				}) : item.kind === "font" ? e$1("div", {
					className: "dts-thumb",
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 22
					}
				}, "Ag 字") : e$1("img", {
					className: "dts-thumb",
					src: env.mediaUrl(item),
					alt: item.name,
					loading: "lazy",
					decoding: "async"
				}), e$1("div", { className: "dts-card-body" }, e$1("div", {
					className: "dts-card-name",
					title: item.name
				}, item.name), e$1("div", { className: "dts-card-meta" }, e$1(Tag, { tone: "quiet" }, item.kind), e$1("span", null, humanBytes(item.bytes) + (item.width ? " · " + item.width + "×" + item.height : "")))), e$1("div", { className: "dts-card-actions" }, item.kind === "font" ? uiButton({
					variant: "ghost",
					size: "sm",
					onClick: function() {
						env.useAsFont(item);
					},
					children: tt("type.useFamily")
				}) : uiButton({
					variant: active ? "primary" : "ghost",
					size: "sm",
					onClick: function() {
						env.activateBackdrop(item.kind, item.id);
					},
					children: tt("common.use")
				}), uiButton({
					variant: "ghost",
					size: "sm",
					onClick: function() {
						env.askDelete(item);
					},
					children: tt("common.delete")
				})));
			})));
		}
		function ContrastReadout(props) {
			var ratio = props.env.textContrast(props.scheme);
			var tone = ratio >= 7 ? "success" : ratio >= 4.5 ? "neutral" : "danger";
			return e$1("div", { className: "dts-contrast" }, e$1("span", null, props.t("color.contrast")), e$1(Tag, { tone }, Math.round(ratio * 100) / 100 + ":1"));
		}
		function ColorTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var groups = env.state.tokenGroups || [];
			var filter = useState$1("");
			var scheme = doc.base.scheme === "light" ? "light" : doc.base.scheme === "dark" ? "dark" : env.liveScheme();
			var tokens = doc.palette.tokens || {};
			var extras = Object.keys(tokens).filter(function(name) {
				return !env.isKnownToken(name);
			});
			function setValue(name, side, value) {
				env.patch(function(d) {
					var current = d.palette.tokens[name] || {
						light: "",
						dark: ""
					};
					var next = {
						light: current.light || "",
						dark: current.dark || ""
					};
					next[side] = value;
					if (next.light === "" && next.dark === "") delete d.palette.tokens[name];
					else d.palette.tokens[name] = next;
				});
			}
			function addCustom(name) {
				if (name === "") return;
				env.patch(function(d) {
					if (!d.palette.tokens[name]) d.palette.tokens[name] = {
						light: "",
						dark: ""
					};
				});
			}
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("color.accent"),
				hint: tt("color.accentHint"),
				children: [Row({
					label: tt("color.accent"),
					children: ColorField({
						label: tt("color.accent"),
						value: doc.palette.accent,
						clearLabel: tt("color.clear"),
						onChange: function(v) {
							env.patch(function(d) {
								d.palette.accent = v;
							});
						}
					})
				}), Row({
					label: tt("color.autoAccent"),
					children: Toggle({
						checked: doc.palette.autoAccent,
						label: tt("color.autoAccent"),
						onChange: function(v) {
							env.patch(function(d) {
								d.palette.autoAccent = v;
							});
						}
					}),
					tail: uiButton({
						variant: "ghost",
						onClick: function() {
							env.sampleAccent();
						},
						children: tt("color.fromImage")
					})
				})]
			}), Group({
				title: tt("color.groups"),
				hint: tt("color.contrastHint"),
				children: e$1("div", { className: "dts-token-groups" }, e$1("div", { className: "dts-filter-row" }, e$1(TextField, {
					className: "dts-field-grow",
					label: tt("color.groups"),
					placeholder: "--dsw-…",
					value: filter[0],
					spellCheck: false,
					onChange: function(v) {
						filter[1](v);
					}
				}), ContrastReadout({
					env,
					t: tt,
					scheme
				})), groups.map(function(group) {
					var needle = filter[0].trim().toLowerCase();
					var rows = group.tokens.filter(function(item) {
						if (needle === "") return true;
						return item.name.toLowerCase().indexOf(needle) >= 0 || String(item.label || "").toLowerCase().indexOf(needle) >= 0;
					});
					if (rows.length === 0) return null;
					return e$1("div", { key: group.id }, e$1("h4", {
						className: "dts-card-meta",
						style: { margin: "8px 0 6px" }
					}, group.label), rows.map(function(item) {
						var pair = tokens[item.name];
						return e$1("div", {
							key: item.name,
							className: "dts-token-row",
							style: { marginBottom: 6 }
						}, e$1("div", {
							className: "dts-token-name",
							title: item.name
						}, item.label || item.name), e$1("div", { className: "dts-pair" }, e$1("span", { className: "dts-pair-label" }, tt("color.light")), ColorField({
							label: item.name + " " + tt("color.light"),
							value: pair && pair.light || "",
							clearLabel: tt("color.clear"),
							onChange: function(v) {
								setValue(item.name, "light", v);
							}
						})), e$1("div", { className: "dts-pair" }, e$1("span", { className: "dts-pair-label" }, tt("color.dark")), ColorField({
							label: item.name + " " + tt("color.dark"),
							value: pair && pair.dark || "",
							clearLabel: tt("color.clear"),
							onChange: function(v) {
								setValue(item.name, "dark", v);
							}
						})), e$1("span", {
							className: "dts-clear-slot",
							"data-empty": pair ? void 0 : "true"
						}, uiButton({
							variant: "ghost",
							onClick: function() {
								env.patch(function(d) {
									delete d.palette.tokens[item.name];
								});
							},
							children: tt("color.clear")
						})));
					}));
				}), e$1("div", { className: "dts-extras" }, extras.map(function(name) {
					return e$1("div", {
						key: name,
						className: "dts-token-row"
					}, e$1("div", {
						className: "dts-token-name",
						title: name
					}, name), e$1("div", { className: "dts-pair" }, e$1("span", { className: "dts-pair-label" }, tt("color.light")), ColorField({
						label: name + " " + tt("color.light"),
						value: tokens[name].light || "",
						clearLabel: "×",
						onChange: function(v) {
							setValue(name, "light", v);
						}
					})), e$1("div", { className: "dts-pair" }, e$1("span", { className: "dts-pair-label" }, tt("color.dark")), ColorField({
						label: name + " " + tt("color.dark"),
						value: tokens[name].dark || "",
						clearLabel: "×",
						onChange: function(v) {
							setValue(name, "dark", v);
						}
					})), uiButton({
						variant: "ghost",
						onClick: function() {
							env.patch(function(d) {
								delete d.palette.tokens[name];
							});
						},
						children: tt("color.clear")
					}));
				}), e$1(CustomTokenAdder, {
					env,
					t: tt,
					onAdd: addCustom
				})))
			}));
		}
		/**
		* 自定义令牌添加行。
		* 草稿必须是**组件内状态**：设置页与模态同时打开时就是两个实例，
		* 放模块级共享对象会互相串字；而且原先 `value: ''` 写死，
		* 输入框根本显示不出用户敲的字。
		*
		* ★ 令牌名建议弹层走自写控件层的 `MenuSurface`（材质/圆角/模糊/暗色兜底全在它
		*   内部），替掉原来的原生 `<datalist>`：后者是**系统 UI**，主题令牌一条都够不着
		*   —— 与"原生 `<select>` 弹层吃不到毛玻璃"完全同一个根因（主人实测
		*   「选项这里没同步」）。语义用 `listbox`/`option`（"在候选里选一个"）。
		* ⚠️ 键盘契约只做最小面：Escape 收起、（未做）↑↓ 走位 —— 见 13 报告 §4 的说明。
		*   弹层向上展开：本行位于色彩页最底部，向下弹会被祖先滚动容器裁掉。
		*/
		function CustomTokenAdder(props) {
			var env = props.env, tt = props.t;
			var draft = useState$1("");
			var openState = useState$1(false);
			var open = openState[0];
			function add(value) {
				var name = String(value === void 0 ? draft[0] || "" : value).trim();
				if (name === "") return;
				props.onAdd(name);
				draft[1]("");
				openState[1](false);
			}
			var needle = String(draft[0] || "").trim().toLowerCase();
			var matches = needle === "" ? [] : env.tokenNames().filter(function(name) {
				return name.toLowerCase().indexOf(needle) >= 0;
			}).slice(0, 8);
			useEffect$1(function() {
				if (!open) return void 0;
				function onDocDown(event) {
					var field = document.getElementById("dts-token-adder");
					if (field !== null && event.target instanceof Node && field.contains(event.target)) return;
					openState[1](false);
				}
				document.addEventListener("pointerdown", onDocDown);
				return function() {
					document.removeEventListener("pointerdown", onDocDown);
				};
			}, [open]);
			return e$1("div", {
				className: "dts-adder",
				id: "dts-token-adder"
			}, e$1("div", { className: "dts-adder-field" }, e$1(TextField, {
				className: "dts-field-grow",
				label: tt("color.custom"),
				placeholder: tt("color.customName"),
				value: draft[0],
				spellCheck: false,
				autoComplete: "off",
				"aria-expanded": open ? "true" : "false",
				"aria-controls": "dts-token-suggest",
				onChange: function(v) {
					draft[1](v);
					openState[1](true);
				},
				onFocus: function() {
					openState[1](true);
				},
				onKeyDown: function(event) {
					if (event.key === "Enter") {
						event.preventDefault();
						add();
					} else if (event.key === "Escape") openState[1](false);
				}
			}), open && matches.length > 0 ? e$1(MenuSurface, {
				id: "dts-token-suggest",
				className: "dts-suggest",
				role: "listbox",
				"aria-label": tt("color.custom")
			}, matches.map(function(name) {
				return e$1("button", {
					key: name,
					type: "button",
					role: "option",
					className: "dts-suggest-row",
					onClick: function() {
						add(name);
					}
				}, name);
			})) : null), uiButton({
				variant: "ghost",
				onClick: function() {
					add();
				},
				children: tt("color.customAdd")
			}));
		}
		/** 字体采用 pill 的开合语义：已采用再点 = 恢复宿主默认（曾会重复前置同名族）。 */
		function toggleFamily(doc, family, field) {
			var quoted = "\"" + family + "\"";
			if (String(doc.type[field]).indexOf(family) >= 0) {
				doc.type[field] = "";
				return;
			}
			doc.type[field] = quoted + ", " + (field === "codeFont" ? "monospace" : doc.type[field] || "sans-serif");
		}
		function TypeTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var families = doc.type.families || [];
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("type.uiFont"),
				hint: tt("type.hint"),
				children: [
					Row({
						label: tt("type.uiFont"),
						children: e$1(TextField, {
							className: "dts-field-grow",
							label: tt("type.uiFont"),
							value: doc.type.uiFont,
							spellCheck: false,
							onChange: function(v) {
								env.patch(function(d) {
									d.type.uiFont = v;
								});
							}
						})
					}),
					Row({
						label: tt("type.codeFont"),
						children: e$1(TextField, {
							className: "dts-field-grow",
							label: tt("type.codeFont"),
							value: doc.type.codeFont,
							spellCheck: false,
							onChange: function(v) {
								env.patch(function(d) {
									d.type.codeFont = v;
								});
							}
						})
					}),
					Row({
						label: tt("type.letterSpacing"),
						children: Range({
							label: tt("type.letterSpacing"),
							min: -1,
							max: 4,
							step: .05,
							unit: "em",
							value: doc.type.letterSpacing,
							onChange: function(v) {
								env.patch(function(d) {
									d.type.letterSpacing = v;
								});
							}
						})
					})
				]
			}), Group({
				title: tt("type.uploadFont"),
				hint: tt("type.hint"),
				children: e$1(Uploader, {
					env,
					t: tt,
					accept: ".woff,.woff2,.ttf,.otf,font/*"
				})
			}), families.length > 0 ? Group({
				title: tt("type.families"),
				children: families.map(function(family) {
					return e$1("div", {
						key: family.id,
						className: "dts-token-row"
					}, e$1("div", {
						className: "dts-token-name",
						title: family.family
					}, family.family), e$1("div", { style: {
						fontSize: 15,
						fontFamily: "\"" + family.family + "\", var(--dsw-font-family,inherit)"
					} }, "永字八法 AaBb 0123 " + (family.weight || 400)), e$1("div", null), e$1("div", { style: {
						display: "flex",
						gap: 4
					} }, uiPill({
						active: doc.type.uiFont.indexOf(family.family) >= 0,
						onClick: function() {
							env.patch(function(d) {
								toggleFamily(d, family.family, "uiFont");
							});
						},
						children: tt("type.useFamily")
					}), uiPill({
						active: doc.type.codeFont.indexOf(family.family) >= 0,
						onClick: function() {
							env.patch(function(d) {
								toggleFamily(d, family.family, "codeFont");
							});
						},
						children: tt("type.useCodeFamily")
					})));
				})
			}) : null);
		}
		function ShapeTab(props) {
			var env = props.env, tt = props.t, s = props.doc.shape;
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("shape.groupTitle"),
				hint: tt("shape.cornerHint"),
				children: [
					Row({
						label: tt("shape.corner"),
						hint: tt("shape.cornerHint"),
						children: Range({
							label: tt("shape.corner"),
							min: 1,
							max: 3,
							step: .05,
							value: s.cornerShape,
							onChange: function(v) {
								env.patch(function(d) {
									d.shape.cornerShape = v;
								});
							}
						})
					}),
					Row({
						label: tt("shape.motion"),
						children: Range({
							label: tt("shape.motion"),
							min: 0,
							max: 4,
							step: .1,
							unit: "×",
							value: s.motionSpeed,
							hint: s.motionSpeed === 0 ? tt("shape.motionOff") : void 0,
							onChange: function(v) {
								env.patch(function(d) {
									d.shape.motionSpeed = v;
								});
							}
						})
					}),
					Row({
						label: tt("shape.reduceMotion"),
						children: Toggle({
							checked: s.reduceMotion,
							label: tt("shape.reduceMotion"),
							onChange: function(v) {
								env.patch(function(d) {
									d.shape.reduceMotion = v;
								});
							}
						})
					}),
					Row({
						label: tt("shape.scrollbar"),
						children: e$1(Choice, {
							label: tt("shape.scrollbar"),
							value: s.scrollbar,
							options: [
								{
									value: "native",
									label: tt("shape.native")
								},
								{
									value: "auto",
									label: tt("shape.auto")
								},
								{
									value: "slim",
									label: tt("shape.slim")
								},
								{
									value: "hidden",
									label: tt("shape.hidden")
								}
							],
							onChange: function(v) {
								env.patch(function(d) {
									d.shape.scrollbar = v;
								});
							}
						})
					})
				]
			}));
		}
		/**
		* 方案 = 整份主题文档（配色+背景+玻璃+字体）的命名快照，一键互切。
		* 保存/应用走主题档路由；覆盖同名与删除都要过官方确认框。
		* 本组件用了 hooks，只能经 e(Current, …) 渲染 —— 禁止直调（有回归锁测试）。
		*/
		function ProfileTab(props) {
			var env = props.env, tt = props.t;
			var nameState = useState$1("");
			var rowsState = useState$1(null);
			var activeState = useState$1("");
			/** 打开着「⋯」菜单的那一行（slug）；空串 = 全关。 */
			var menuState = useState$1("");
			/** 卸载门闩：切页签/关模态后在飞的主题档列表响应不得再写 state
			*  （同文件 AdvancedTab 已有同款，这里补上，行为对齐）。 */
			var alive = true;
			function refresh() {
				return env.api.themes().then(function(value) {
					if (alive) rowsState[1](value);
				}, function() {});
			}
			useEffect$1(function() {
				refresh();
				return function() {
					alive = false;
				};
			}, []);
			var rows = rowsState[0] === null ? null : rowsState[0].themes || [];
			function saveAs(name, force) {
				var clean = String(name || "").trim();
				if (clean === "") clean = "theme-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
				var dup = (rows || []).some(function(r) {
					return r.name === clean || r.slug === clean;
				});
				var proceed = function(overwrite) {
					return env.api.saveTheme(clean, overwrite === true).then(function() {
						nameState[1]("");
						activeState[1](clean);
						env.notify(tt("profile.saved") + "「" + clean + "」", "ok");
						return refresh();
					}, function(error) {
						if (error.status === 409) return env.confirmDialog({
							title: tt("profile.existsTitle"),
							lines: [tt("profile.existsBody")],
							confirmLabel: tt("common.confirm"),
							cancelLabel: tt("common.cancel"),
							tone: "danger"
						}).then(function(yes) {
							return yes ? proceed(true) : void 0;
						});
						env.notify(tt("common.failed") + "：" + String(error.message || error), "error");
					});
				};
				if (!dup || force) {
					proceed(force);
					return;
				}
				env.confirmDialog({
					title: tt("profile.existsTitle"),
					lines: [tt("profile.existsBody")],
					confirmLabel: tt("common.confirm"),
					cancelLabel: tt("common.cancel"),
					tone: "danger"
				}).then(function(yes) {
					if (yes) proceed(true);
				});
			}
			function apply(row) {
				env.api.loadTheme(row.slug).then(function(projection) {
					env.accept(projection);
					activeState[1](row.name || row.slug);
					env.notify(tt("profile.applied") + "「" + (row.name || row.slug) + "」", "ok");
				}, function(error) {
					env.notify(tt("common.failed") + "：" + String(error.message || error), "error");
				});
			}
			function remove(row) {
				env.confirmDialog({
					title: tt("profile.deleteTitle"),
					lines: [tt("profile.deleteBody")],
					confirmLabel: tt("common.delete"),
					cancelLabel: tt("common.cancel"),
					tone: "danger"
				}).then(function(yes) {
					if (!yes) return;
					return env.api.removeTheme(row.slug).then(refresh, function(error) {
						env.notify(tt("common.failed") + "：" + String(error.message || error), "error");
					});
				});
			}
			function metaOf(row) {
				var bits = [];
				if (row.mode && row.mode !== "none") bits.push(tt("profile.background") + "：" + (row.mediaName || row.mode));
				if (row.scheme === "dark" || row.scheme === "light") bits.push(row.scheme);
				if (row.exportedAt > 0) try {
					bits.push(new Date(row.exportedAt).toLocaleString());
				} catch (err) {}
				return bits.join(" · ");
			}
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("profile.groupTitle"),
				hint: tt("profile.hint"),
				children: e$1("div", { className: "dts-field-row" }, e$1(TextField, {
					className: "dts-field-grow",
					label: tt("tab.profile"),
					value: nameState[0],
					placeholder: tt("profile.namePh"),
					onChange: function(v) {
						nameState[1](v);
					},
					onKeyDown: function(event) {
						if (event.key === "Enter") saveAs(nameState[0], false);
					}
				}), uiButton({
					variant: "primary",
					size: "sm",
					onClick: function() {
						saveAs(nameState[0], false);
					},
					children: tt("profile.saveNew")
				}))
			}), rows === null ? e$1("p", { className: "dts-hint" }, tt("profile.hint")) : rows.length === 0 ? e$1("p", { className: "dts-hint" }, tt("profile.empty")) : e$1("div", { className: "dts-profile-list" }, rows.map(function(row) {
				var on = activeState[0] !== "" && (row.name === activeState[0] || row.slug === activeState[0]);
				return e$1("div", {
					key: row.slug,
					className: "dts-token-row dts-profile-row",
					"data-active": on ? "true" : void 0
				}, e$1("div", {
					className: "dts-token-name",
					title: row.slug
				}, row.accent ? e$1("span", {
					className: "dts-profile-dot",
					style: { background: row.accent }
				}) : null, (row.name || row.slug) + (on ? " ✓" : "")), e$1("div", { className: "dts-hint" }, metaOf(row)), e$1("div", { className: "dts-row-actions" }, uiButton({
					variant: "primary",
					size: "sm",
					disabled: on,
					onClick: function() {
						apply(row);
					},
					children: tt("profile.apply")
				}), e$1(Menu, {
					open: menuState[0] === row.slug,
					portal: true,
					align: "end",
					onClose: function() {
						menuState[1]("");
					},
					anchor: uiButton({
						variant: "ghost",
						size: "sm",
						ariaLabel: tt("tab.profile"),
						title: tt("tab.profile"),
						onClick: function() {
							menuState[1](menuState[0] === row.slug ? "" : row.slug);
						},
						children: "⋯"
					})
				}, e$1(MenuItemButton, {
					key: "overwrite",
					onSelect: function() {
						menuState[1]("");
						saveAs(row.name || row.slug, true);
					}
				}, tt("profile.overwrite")), e$1(MenuItemButton, {
					key: "delete",
					danger: true,
					separatorBefore: true,
					onSelect: function() {
						menuState[1]("");
						remove(row);
					}
				}, tt("profile.del")))));
			})));
		}
		function AdvancedTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var usageState = useState$1(null);
			/**
			* 导入的合并开关。宿主 `/api/import?mode=merge` 与 api.importDoc 的第二参
			* 早就实现了"按字段合并"，但此前**没有任何 UI 能传这个参** —— 功能有、按钮缺。
			* 默认关（保持"整份替换"这个既有语义），勾上才走合并。
			*/
			var mergeState = useState$1(false);
			var merge = mergeState[0], setMerge = mergeState[1];
			/** 「素材占用」折叠行的开合（DisclosureRow 是受控组件）。 */
			var usageOpen = useState$1(false);
			useEffect$1(function() {
				var alive = true;
				env.api.usage().then(function(value) {
					if (alive) usageState[1](value);
				}, function() {});
				return function() {
					alive = false;
				};
			}, []);
			return e$1("div", { className: "dts-body" }, Group({
				title: tt("adv.css"),
				hint: tt("adv.cssHint"),
				children: e$1("textarea", {
					className: "dts-textarea",
					value: doc.advanced.css,
					spellCheck: false,
					"aria-label": tt("adv.css"),
					onChange: function(event) {
						env.patch(function(d) {
							d.advanced.css = event.target.value;
						}, { debounce: 700 });
					}
				})
			}), Group({
				title: "JSON",
				children: [Row({
					label: tt("adv.merge"),
					hint: tt("adv.mergeHint"),
					children: e$1(Checkbox, {
						checked: merge,
						label: tt("adv.merge"),
						title: tt("adv.mergeHint"),
						onChange: function(next) {
							setMerge(next);
						}
					})
				}), e$1("div", { className: "dts-json-actions" }, e$1("a", {
					className: "dts-btn",
					href: env.api.exportUrl(),
					download: "dsh-theme.json"
				}, tt("adv.export")), e$1("label", {
					className: "dts-btn",
					style: { cursor: "pointer" }
				}, tt("adv.import"), e$1("input", {
					type: "file",
					accept: "application/json,.json",
					hidden: true,
					onChange: function(event) {
						var file = event.target.files && event.target.files[0];
						event.target.value = "";
						if (!file) return;
						file.text().then(function(text) {
							return env.api.importDoc(JSON.parse(text), merge ? "merge" : "");
						}).then(function(projection) {
							env.accept(projection);
							env.notify(tt("common.saved"), "ok");
						}, function(error) {
							env.notify(tt("common.failed") + "：" + String(error.message || error), "error");
						});
					}
				})))]
			}), usageState[0] ? e$1(DisclosureRow, {
				key: "usage",
				title: tt("adv.usage"),
				open: usageOpen[0],
				expandable: true,
				expandOnRowClick: true,
				onToggle: function() {
					usageOpen[1](!usageOpen[0]);
				},
				className: "dts-disclosure"
			}, e$1("p", { className: "dts-hint" }, String(usageState[0].files) + " files · " + humanBytes(usageState[0].bytes))) : null);
		}
		//#endregion
		//#region src/client/app.ts
		var TABS = [
			{
				id: "presets",
				key: "tab.presets",
				view: PresetTab
			},
			{
				id: "profile",
				key: "tab.profile",
				view: ProfileTab
			},
			{
				id: "backdrop",
				key: "tab.backdrop",
				view: BackdropTab
			},
			{
				id: "library",
				key: "tab.library",
				view: LibraryTab
			},
			{
				id: "color",
				key: "tab.color",
				view: ColorTab
			},
			{
				id: "type",
				key: "tab.type",
				view: TypeTab
			},
			{
				id: "shape",
				key: "tab.shape",
				view: ShapeTab
			},
			{
				id: "advanced",
				key: "tab.advanced",
				view: AdvancedTab
			}
		];
		/** 页签的 DOM id 对（`SegmentedTabs` 契约要求每个 item 带唯一 id 与它控制的 panelId）。 */
		function tabDomIds(id) {
			return {
				id: "dts-tab-" + id,
				panelId: "dts-tabpanel-" + id
			};
		}
		/** 官方 `IconCloseOutlineRegular` 的路径（16 viewBox / 1px 描边）。 */
		function CloseGlyph() {
			return e$1("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				strokeWidth: 1
			}, e$1("path", {
				d: "M2.5 2.5L13.5 13.5",
				stroke: "currentColor",
				key: "a"
			}), e$1("path", {
				d: "M13.5 2.5L2.5 13.5",
				stroke: "currentColor",
				key: "b"
			}));
		}
		/**
		* 面板主体。**两条路径共用同一棵"内容列"**，区别只在外面套什么：
		*
		*   · 主路径（注进 `settings.section`）：宿主已经给了 overlay + mask + 800px panel
		*     + 188px 导航列 + **唯一滚动容器**（`settings-general/lib/client.js:60` 的
		*     `.y7bFDa_overlay/.mask/.panel/.nav/.content/.options`，`SettingsPanel` 把我们
		*     渲染进 `.options`，见 `:333`）。所以我们**只渲染内容列**：
		*       ✗ 不画遮罩、不画卡片、不画导航列、不自带滚动容器
		*         —— 再画一层就是双层遮罩 + 双层卡片（第 1 步专门核验过这一点）。
		*     ✅ 内容列形状对齐官方 `PluginsSettingsSection`（`ui-settings-plugins/lib/client.js:11`）：
		*        页面根 `max-width:760px; flex-direction:column; gap:12px`
		*        + `h2 18/600` + 引言 `13/--dsw-alias-label-tertiary` + 页签 + 面板。
		*   · 兜底模态路径（宿主没把条目收进 ledger）：宿主什么都没给，用自写控件层的
		*     `Modal` 自己当那个设置面板（几何见 chrome.ts 的 `.dts-modal-*` 段落）。
		*/
		function ThemeStudioApp(props) {
			var env = props.env, tt = props.t;
			var state = useSlice(env.engine);
			var isModal = typeof props.onRequestClose === "function";
			var tabState = useState$1(readLocal("dts:active-tab") || "presets");
			var active = TABS.some(function(item) {
				return item.id === tabState[0];
			}) ? tabState[0] : "presets";
			var Current = TABS.find(function(item) {
				return item.id === active;
			}).view;
			var statusLabel = state.status === "saving" ? tt("common.saving") : state.status === "error" ? state.error || tt("common.failed") : state.status === "ready" ? tt("common.saved") : "…";
			var statusDot = state.status === "saving" ? "ongoing" : state.status === "error" ? "error" : state.status === "ready" ? "done" : "idle";
			function chooseTab(id) {
				tabState[1](id);
				writeLocal(TAB_STORAGE_KEY, id);
			}
			var items = TABS.map(function(item) {
				var dom = tabDomIds(item.id);
				return {
					value: item.id,
					label: tt(item.key),
					id: dom.id,
					panelId: dom.panelId
				};
			});
			var panelDom = tabDomIds(active);
			var content = e$1("div", {
				className: "dts-page",
				"data-variant": isModal ? "modal" : "page"
			}, e$1("div", { className: "dts-page-head" }, e$1("div", { className: "dts-page-text" }, e$1("h2", { className: "dts-page-title" }, Svg(), tt("section.title")), e$1("p", { className: "dts-page-intro" }, tt("section.intro"))), e$1("div", { className: "dts-page-actions" }, uiButton({
				variant: "ghost",
				onClick: function() {
					env.askReset();
				},
				children: tt("common.reset")
			}), e$1("span", {
				className: "dts-status",
				"data-state": state.status === "error" ? "error" : "idle"
			}, uiStateDot({ state: statusDot }), statusLabel))), e$1(SegmentedTabs, {
				items,
				value: active,
				onChange: chooseTab,
				label: tt("section.title"),
				className: "dts-page-tabs"
			}), state.status === "error" && state.doc === null ? e$1("p", {
				className: "dts-note",
				"data-tone": "error"
			}, state.error || tt("common.failed")) : null, state.doc ? e$1("div", {
				className: "dts-body",
				role: "tabpanel",
				key: active,
				tabIndex: -1,
				id: panelDom.panelId,
				"aria-labelledby": panelDom.id
			}, e$1(Current, {
				env,
				t: tt,
				doc: state.doc
			})) : null, state.dialog ? e$1(ConfirmDialog, {
				title: state.dialog.title,
				lines: state.dialog.lines,
				confirmLabel: state.dialog.confirmLabel,
				cancelLabel: state.dialog.cancelLabel,
				tone: state.dialog.tone,
				onDone: function(answer) {
					env.answerDialog(answer);
				}
			}) : null);
			if (!isModal) return content;
			return e$1(Modal, {
				open: true,
				title: tt("section.title"),
				closeLabel: tt("common.close"),
				headless: true,
				className: "dts-modal-panel",
				onClose: function() {
					props.onRequestClose();
				}
			}, e$1("div", {
				className: "dts-modal-head",
				key: "head"
			}, e$1("button", {
				type: "button",
				className: "dts-modal-close",
				key: "close",
				"aria-label": tt("common.close"),
				title: tt("common.close"),
				onClick: function() {
					props.onRequestClose();
				}
			}, e$1(CloseGlyph, null))), e$1("div", {
				className: "dts-modal-options",
				key: "options"
			}, content));
		}
		/** 语言变化后设置页条目要用新文案重新注册，这里给一个不依赖 slot 的兜底行。 */
		function ThemeStudioGeneralRow(props) {
			var env = props.env, tt = props.t;
			return e$1("div", { className: "dts-row" }, e$1("label", null, tt("section.title")), uiButton({
				variant: "ghost",
				onClick: function() {
					env.openModal();
				},
				children: tt("common.openPanel")
			}));
		}
		/**
		* 同源路由前缀白名单：只收 `/xxx/yyy` 这种同源绝对路径。
		* `//attacker` 与 `http://…` 会被拼进 fetch / EventSource / 导出链接 ——
		* 一旦前缀被污染，`x-dts-key` 就跟着发到异源去。值来自自家 Host，但不
		* 假设它永远干净：形态不合就整个退回默认前缀（仍指向本插件的路由）。
		*/
		function safePrefix(value) {
			return typeof value === "string" && /^\/(?!\/)[A-Za-z0-9_\-/]*$/.test(value) ? value.replace(/\/+$/, "") : "";
		}
		/**
		* Cordis 入口。
		* @param {import('@deepseek-ai/cordis').Context} ctx
		*/
		function apply(ctx) {
			var reduceTransparency = false;
			try {
				var mqReduce = window.matchMedia("(prefers-reduced-transparency: reduce)");
				reduceTransparency = mqReduce.matches === true;
				ctx.effect(function() {
					var onChange = function(event) {
						reduceTransparency = event.matches === true;
						try {
							if (reduceTransparency) document.body.classList.add("dts-reduced-transparency");
							else document.body.classList.remove("dts-reduced-transparency");
						} catch (err) {}
					};
					mqReduce.addEventListener("change", onChange);
					return function() {
						mqReduce.removeEventListener("change", onChange);
					};
				}, "theme-studio: reduced transparency");
			} catch (err) {}
			var boot = window.__DTS_BOOT__ || {};
			var prefix = safePrefix(boot.prefix) || "/dsh-theme-studio";
			var writeToken = typeof boot.writeToken === "string" ? boot.writeToken : "";
			var probe = createTokenProbe({ theme: function() {
				return ctx.theme;
			} });
			var layer = createLayerManager();
			var commitTimer = 0;
			var lastAppliedRevision = -1;
			var dialogAnswer = null;
			var styles = [];
			/** `shell.overlay` 注册的 disposer（`registerOverlaySurface` 里赋值）。 */
			var overlayDisposer = null;
			/** 浮层宿主容器的状态源（提示/模态/全屏键都 `createPortal` 进它）。 */
			var overlayEffects = createOverlayEffects();
			/** 一次性提示的状态源（`notify()` 写、`NoticeViewport` 渲染）。 */
			var notices = createNotices();
			/** 换语言后让**不在 slot 树里**的那几件（全屏键文案）重渲染一次。 */
			var langRevision = createStore({ revision: 0 });
			/**
			* 在飞提交的本地草稿（乐观值 + 乐观锁基准）。
			*
			* ⚠️ 注释更正（本轮）：它曾经被写成"跨组件重建保留的未保存草稿 —— 换语言时
			* 重新注册会卸载并重建组件，草稿只活在组件里就会跟着丢"。那只是它**顺带**
			* 起到的作用；换语言重注册这条链已经删掉了（label thunk + locale），
			* 而它本身**是提交管线的核心状态**，删不得：
			*   · `patch()` 写入草稿并把 status 置为 saving；
			*   · `commit()` 只提交草稿，成功后才按 `draft === inflight` 收口；
			*   · 409/401/403 时按"草稿是不是被打回的那一版"分流（新草稿不作废、
			*     只换基准重发），暂态失败时草稿保留并指数退避重试；
			*   · `accept()` 在投影到达时用它保证"用户正在改的值不被服务端旧值盖掉"。
			*/
			var draft = null;
			/**
			* locale 是可选依赖（不声明进 exports.inject）：接上模块级句柄，取不到就走降级链。
			* 顺带把 ctx 交给 i18n —— 服务若在本插件 apply 之后才挂载，它还能按需重取一次。
			*/
			var localeAtBoot = null;
			try {
				localeAtBoot = typeof ctx.get === "function" ? ctx.get("locale") ?? null : ctx.locale ?? null;
			} catch (err) {
				localeAtBoot = null;
			}
			setLocaleService(localeAtBoot, ctx);
			var engine = createStore({
				status: "loading",
				error: "",
				doc: null,
				media: {},
				css: "",
				revision: 0,
				presets: [],
				gradients: {},
				tokenGroups: [],
				glassSurfaces: [],
				layerAvailable: false,
				dialog: null
			});
			var api = createApi(function() {
				return prefix;
			}, function() {
				return writeToken;
			});
			/** 在飞提交的中止句柄，**按代次登记**（Map），不是一个可被覆盖的槽。
			*  单槽的坏处：并发两次提交时后一个覆盖前一个，而前一个的成功回调无条件
			*  `commitAbort = null`，会连带丢掉更新那次的句柄 —— 于是 acceptRemote
			*  调 cancelPendingCommit() 时已无东西可 abort，旧草稿的 PUT 仍会落到
			*  服务端，把刚载入的文档盖回去（epoch 只能作废客户端响应，作废不了
			*  服务端写入）。 */
			var commitControllers = /* @__PURE__ */ new Map();
			var commitEpoch = 0;
			/**
			* 卸载门闩：teardown 之后到达的在飞响应回调一律作废。
			* 没有它，dispose 瞬间的 getState/saveDoc/upload 的 `.then(accept)` 会在
			* 清场之后执行 —— 样式标签、背景层、令牌层又被重新长回来（僵尸主题）。
			*/
			var disposed = false;
			function cancelPendingCommit() {
				commitEpoch += 1;
				window.clearTimeout(commitTimer);
				commitControllers.forEach(function(controller) {
					try {
						controller.abort();
					} catch (err) {}
				});
				commitControllers.clear();
			}
			function liveSchemeNow() {
				return document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
			}
			function mediaUrl(item) {
				return prefix + "/media/" + encodeURIComponent(item.id) + "/" + encodeURIComponent(item.name || "");
			}
			/**
			* 把一份投影落到界面：样式 → 令牌 → theme 服务 → 背景层。
			* 顺序有讲究：写完令牌层才会触发 theme/change，由 Presenter 落 inline 变量。
			* 用户正在改（draft 在飞）时继续显示草稿，样式与令牌仍来自服务端投影。
			*/
			function accept(projection) {
				if (disposed) return;
				if (!projection || !projection.doc) return;
				prefix = safePrefix(projection.prefix) || prefix;
				if (typeof projection.writeToken === "string" && projection.writeToken !== "") writeToken = projection.writeToken;
				var doc = projection.doc;
				var pairs = fillTokenPairs(projection.tokenLayers || {}, probe);
				var surfaces = (projection.glassSurfaces || []).filter(function(name) {
					return isGlassSurfaceAllowed(name);
				});
				EXTRA_GLASS_SURFACES.forEach(function(name) {
					if (!isGlassSurfaceAllowed(name)) return;
					if (surfaces.indexOf(name) === -1) surfaces.push(name);
				});
				var glass = composeGlass(surfaces, doc, probe, doc.palette.tokens || {});
				var merged = Object.assign({}, glass, pairs);
				if (reduceTransparency) merged["--dsw-menu-backdrop-filter"] = {
					light: "none",
					dark: "none"
				};
				fixTextFamily(merged, doc.palette.tokens || {}, probe);
				fixDiffFamily(merged, doc.palette.tokens || {}, probe);
				var styleEl = upsertStyle(STYLE_ID, projection.css || "");
				if (styles.indexOf(styleEl) === -1) styles.push(styleEl);
				if (ctx.theme && typeof ctx.theme.overrideTokens === "function") ctx.theme.overrideTokens(TOKEN_SOURCE, merged);
				if (ctx.theme && typeof ctx.theme.setTheme === "function") try {
					ctx.theme.setTheme(doc.base.scheme);
				} catch (err) {}
				if (ctx.theme && typeof ctx.theme.setFontSize === "function") try {
					ctx.theme.setFontSize(doc.base.fontSize);
				} catch (err) {}
				setLiveScheme(liveSchemeNow());
				layer.sync(doc, prefix, projection.media || {});
				engine.update({
					status: "ready",
					error: "",
					doc: draft === null ? doc : draft.doc,
					media: projection.media || {},
					css: projection.css || "",
					revision: projection.revision,
					presets: projection.presets || engine.get().presets,
					gradients: projection.gradients || engine.get().gradients,
					tokenGroups: projection.tokenGroups || engine.get().tokenGroups,
					glassSurfaces: projection.glassSurfaces || engine.get().glassSurfaces,
					layerAvailable: doc.backdrop.mode !== "none"
				});
				lastAppliedRevision = projection.revision;
			}
			/**
			* 整份文档替换（预设/载入方案/导入/重置）的唯一入口：先作废本地草稿
			* 与在飞提交。直接调 accept 的话，~220ms 后 commit 会把旧草稿
			* PUT 回服务端，刚载入的主题被打回原形（实测）。
			*/
			function acceptRemote(projection) {
				cancelPendingCommit();
				draft = null;
				accept(projection);
			}
			function patch(mutate, options) {
				var current = engine.get().doc;
				if (current === null) return;
				var next = JSON.parse(JSON.stringify(current));
				mutate(next);
				draft = {
					doc: next,
					baseRevision: engine.get().revision
				};
				engine.update({
					doc: next,
					status: "saving"
				});
				scheduleCommit(options);
			}
			function scheduleCommit(options) {
				window.clearTimeout(commitTimer);
				var delay = options && options.debounce ? options.debounce : 220;
				commitTimer = window.setTimeout(commit, delay);
			}
			/** 暂态失败（网络闪断/5xx）的自动重试：指数退避，给上限，不让编辑悄悄蒸发。 */
			var commitRetries = 0;
			function commitFailure(epoch, inflight, error) {
				if (epoch !== commitEpoch) return;
				commitControllers.delete(epoch);
				engine.update({
					status: "error",
					error: String(error.message || error)
				});
				if (error.status === 409 || error.status === 401 || error.status === 403) {
					if (draft !== null && draft !== inflight) reload().then(function() {
						if (draft !== null) {
							draft.baseRevision = engine.get().revision;
							scheduleCommit({ debounce: 50 });
						}
					});
					else {
						draft = null;
						commitRetries = 0;
						if (error.status === 409) notify(t("err.conflict"), "error");
						reload();
					}
					return;
				}
				commitRetries += 1;
				if (commitRetries <= 5) scheduleCommit({ debounce: 800 * commitRetries });
			}
			function commit() {
				if (disposed || draft === null) return;
				var inflight = draft;
				var epoch = commitEpoch;
				var controller = typeof AbortController === "function" ? new AbortController() : null;
				if (controller !== null) commitControllers.set(epoch, controller);
				api.saveDoc(inflight.doc, inflight.baseRevision, controller === null ? void 0 : controller.signal).then(function(projection) {
					if (epoch !== commitEpoch) return;
					commitControllers.delete(epoch);
					commitRetries = 0;
					var stale = lastAppliedRevision >= 0 && projection.revision < lastAppliedRevision;
					if (draft === inflight) {
						draft = null;
						if (stale) {
							engine.update({
								status: "ready",
								error: ""
							});
							return;
						}
						accept(projection);
						return;
					}
					if (draft !== null) draft.baseRevision = stale ? lastAppliedRevision : projection.revision;
					if (!stale) accept(projection);
					scheduleCommit();
				}, function(error) {
					commitFailure(epoch, inflight, error);
				});
			}
			/**
			* 自检快照：随 GET /api/state 回传给 Host，只读 ` /api/state ` 就能看到。
			*
			* 为什么要有：皮肤问题的第一现场永远在 DOM 里（"我的样式注进去了吗"
			* "dts-on 在不在"），而外部没有任何通道能读到它 —— 结果就是一轮轮靠截图猜。
			* 把这几个事实打成快照回传，一次查询就能分辨"客户端没跑 / 样式没注 /
			* 设置项没落地"三种完全不同的病。字段全部白名单收敛、逐个截断，不含任何
			* 令牌或路径。
			*
			* ⚠️ **阶段 C/D 删除**：原实现还有 5 个**读宿主 DOM**的探针 ——
			*   `[class*="card" i]`（把宿主卡片的类名打回给 Host）、
			*   `[style*="hover-preview-fade"]`、`[class*="_card_"]`、
			*   `.dsh-agent-dialog`、`[role="dialog"]`。
			* 它们存在的唯一目的是"分辨宿主用的是哪套类名命名约定"，也就是
			* `references_ui-plugin.md:13` 明文禁止的那件事（按别人的 DOM 猜结构），
			* 而且宿主侧白名单里根本没有 `overlays` 那类字段（`lib/http.js`
			* 的 `sanitizeDiag()` 只透传 body/chrome/chromeLen/layer/section/cards/hit）——
			* 诊断数据本身也是半丢失的。删掉它们**不丢任何用户可见功能**。
			* 保留的 `cards` / `hit` 两个键位改报**插件自己的**事实（键位由宿主侧
			* 只读白名单固定，新增字段会被 `sanitizeDiag` 丢掉，故不复用不了的名字）。
			*/
			function buildDiag() {
				try {
					var chrome = document.getElementById(CHROME_STYLE_ID);
					return {
						body: typeof document.body.className === "string" ? document.body.className.slice(0, 200) : "",
						chrome: chrome !== null,
						chromeLen: chrome !== null && typeof chrome.textContent === "string" ? chrome.textContent.length : 0,
						layer: document.getElementById(LAYER_ID) !== null,
						section: landed(),
						cards: [],
						hit: { dts: document.querySelectorAll(".dts-cmenu,.dts-cmenu-toast,.dts-suggest").length }
					};
				} catch (error) {
					return { error: String(error?.message ?? error) };
				}
			}
			function reload() {
				if (disposed) return Promise.resolve();
				var diag = "";
				try {
					diag = encodeURIComponent(JSON.stringify(buildDiag()));
				} catch (err) {
					diag = "";
				}
				return api.getState(diag === "" ? void 0 : diag).then(function(projection) {
					if (disposed) return;
					if (lastAppliedRevision >= 0 && projection.revision < lastAppliedRevision) return;
					accept(projection);
				}, function(error) {
					if (disposed) return;
					var message = error && error.status === 401 ? t("err.writeToken") : error && error.status ? String(error.message || error) : t("err.offline");
					engine.update({
						status: "error",
						error: message
					});
				});
			}
			function openDialog(spec) {
				return new Promise(function(resolve) {
					if (typeof dialogAnswer === "function") dialogAnswer(false);
					dialogAnswer = resolve;
					engine.update({ dialog: spec });
				});
			}
			function answerDialog(answer) {
				var resolve = dialogAnswer;
				dialogAnswer = null;
				engine.update({ dialog: null });
				if (typeof resolve === "function") resolve(answer === true);
			}
			function askDelete(item) {
				var lines = [
					item.name,
					item.kind + " · " + humanBytes(item.bytes) + (item.width ? " · " + item.width + "×" + item.height : ""),
					t("dialog.deleteBody")
				];
				var doc = engine.get().doc;
				if (doc !== null && item.kind === "font" && (doc.type.families || []).some(function(f) {
					return f.id === item.id;
				})) lines.push(t("dialog.forceFontBody"));
				else if (doc !== null && doc.backdrop.mediaId === item.id) lines.push(t("dialog.forceBody"));
				return openDialog({
					title: t("dialog.deleteTitle"),
					lines,
					confirmLabel: t("common.delete"),
					cancelLabel: t("common.cancel"),
					tone: "danger"
				}).then(function(yes) {
					if (yes) return removeMedia(item.id, true);
				});
			}
			function askReset() {
				return openDialog({
					title: t("dialog.resetTitle"),
					lines: [t("dialog.resetBody")],
					confirmLabel: t("common.confirm"),
					cancelLabel: t("common.cancel"),
					tone: "danger"
				}).then(function(yes) {
					if (!yes) return void 0;
					cancelPendingCommit();
					draft = null;
					return api.saveDoc({}, engine.get().revision).then(acceptRemote, function(error) {
						notify(t("common.failed") + "：" + String(error.message || error), "error");
					});
				});
			}
			function removeMedia(id, force) {
				return api.removeMedia(id, force).then(function() {
					probe.invalidate();
					return reload();
				}, function(error) {
					notify(t("common.failed") + "：" + String(error.message || error), "error");
				});
			}
			/**
			* 改造前这里是**三处 `document.body` 写入**里的两处：
			*   · `document.body.appendChild(toastHost)`（`#dts-toast-host` + `createRoot`）
			*   · `document.body.appendChild(noticeEl)`（`#dts-notice` 自绘提示条）
			* 现在两者都走 React：提示进 `notices` 状态 → `OverlaySurface` 交出的容器由
			* `NoticeViewport` 渲染（`Toast` 控件自身 portal 到 body，是控件层与官方
			* `Toast` 逐字同构的行为）。这里只保留**命令式入口** `notify()`
			* （引擎回调、上传、错误处理都从它发），不再有任何节点创建。
			*/
			function notify(message, tone) {
				notices.push(message, tone === "error" ? "error" : "ok");
			}
			/**
			* 提示区：`Toast` 控件 + `OverlaySurface` 交出的容器。
			* `tone` 的取舍照旧（控件 `tone` 只有 `'success'` 一个合法值，
			* 错误态是"省略 tone"的警示座）—— 与改造前逐字一致。
			*/
			function NoticeViewport() {
				var slice = useSlice(notices.store);
				var host = useSlice(overlayEffects.store).host;
				if (host === null || host === void 0) return null;
				return createPortal(slice.items.map(function(item) {
					return e$1(Toast, {
						key: "dts-notice-" + item.id,
						text: item.text,
						tone: item.tone === "error" ? void 0 : "success",
						holdMs: item.tone === "error" ? 4200 : void 0,
						onDone: function() {
							notices.drop(item.id);
						}
					});
				}), host);
			}
			function sampleAccent() {
				var state = engine.get();
				var doc = state.doc;
				if (doc === null || doc.backdrop.mode !== "image") {
					notify(t("color.fromImage") + "：" + t("common.empty"), "error");
					return Promise.resolve();
				}
				var item = mediaLookup(state.media, doc.backdrop.mediaId);
				if (item === void 0) return Promise.resolve();
				return sampleFromImage(mediaUrl(item)).then(function(hex) {
					if (hex === null) {
						notify(t("common.failed"), "error");
						return;
					}
					patch(function(d) {
						d.palette.accent = hex;
						d.palette.autoAccent = true;
					});
				});
			}
			/** 缩样 + 饱和度/亮度加权取主色；素材同源，canvas 不会被污染。 */
			function sampleFromImage(url) {
				return new Promise(function(resolve) {
					var img = new Image();
					img.crossOrigin = "anonymous";
					var settle = function(value) {
						img.removeEventListener("load", onLoad);
						img.removeEventListener("error", onError);
						resolve(value);
					};
					var onLoad = function() {
						try {
							var size = 32;
							var canvas = document.createElement("canvas");
							canvas.width = size;
							canvas.height = size;
							var c2d = canvas.getContext("2d");
							if (c2d === null) {
								settle(null);
								return;
							}
							c2d.drawImage(img, 0, 0, size, size);
							var data = c2d.getImageData(0, 0, size, size).data;
							var best = null;
							var bestScore = -1;
							for (var i = 0; i < data.length; i += 4) {
								if (data[i + 3] < 128) continue;
								var hsl = rgbToHsl({
									r: data[i],
									g: data[i + 1],
									b: data[i + 2]
								});
								var score = hsl.s * (1 - Math.abs(hsl.l - 52) / 60);
								if (score > bestScore) {
									bestScore = score;
									best = hsl;
								}
							}
							if (best === null) {
								settle(null);
								return;
							}
							settle(hslToHex(best.h, clamp$1(best.s, 45, 88), clamp$1(best.l < 24 ? 52 : best.l, 34, 62)));
						} catch (err) {
							settle(null);
						}
					};
					var onError = function() {
						settle(null);
					};
					img.addEventListener("load", onLoad);
					img.addEventListener("error", onError);
					img.src = url;
				});
			}
			/**
			* 改造前这里是**第三处 `document.body` 写入**：
			*   `modalHost = document.createElement('div'); document.body.appendChild(modalHost)`
			*   + `ReactDOMClient.createRoot(modalHost)`（另含一条 `require('react-dom')` 退路）。
			* 现在模态是**声明式**的：`modalOpen` 一个布尔 → `ModalHost` 组件渲染到
			* `OverlaySurface` 交出的容器里。宿主容器由 React 渲染、随组件卸载自动消失，
			* 因此**没有任何节点创建**，`require('react-dom')` 的那条退路也一并消失
			* （`react-dom` 现在只剩控件层 `runtime.ts` 的 `createPortal` 一处 require）。
			*/
			var modalOpen = createStore({ open: false });
			/** 打开模态前记住焦点所在，关闭时归还，不让焦点掉回 body。 */
			var lastFocused = null;
			function openModal() {
				ensureChromeStyle();
				if (modalOpen.get().open) return;
				lastFocused = document.activeElement || null;
				modalOpen.update({ open: true });
			}
			/**
			* 关闭兜底模态。
			*
			* ⚠️ 这里**不再**手写焦点接管与 Escape 归属 —— 那两件事现在归 `Modal` 控件里的
			* 官方 `useModalLayer`（初始焦点取 `[data-modal-autofocus]` → 首个可聚焦控件 →
			* 容器；Tab 陷阱；Esc 只归最顶层；关闭时 `focusWithoutRing(previous)`）。
			* 原实现里的 `focusIntoModal()`（querySelector 抓第一个 input/button）与
			* `watchModalEscape()`（document 捕获阶段 + `.dts-select-menu` 特判让位）
			* **整条链删除**：`watchModalEscape` 那套"下拉开着时让 Esc 归下拉"其实是
			* 手写版 `event.defaultPrevented` 协议 —— 自写控件层的 Menu/Select 已经在
			* 捕获阶段 `preventDefault()`，官方 `useModalLayer` 又逐字检查 `defaultPrevented`，
			* 于是优先级天然正确，不需要我们再加一层。
			*
			* `lastFocused` 归还保留：真运行时 `useModalLayer` 的清理已经做过一次（同一个
			* 目标，重复聚焦无副作用），而测试夹具里的 `useLayoutEffect` 是缺省的
			* （只遍历元素树、不跑组件树），这一行是那时唯一的归还有点。
			*/
			function closeModal() {
				if (!modalOpen.get().open) return;
				modalOpen.update({ open: false });
				if (lastFocused !== null && typeof lastFocused.focus === "function" && document.body.contains(lastFocused)) try {
					lastFocused.focus();
				} catch (err) {}
				lastFocused = null;
			}
			/**
			* 兜底模态：`OverlaySurface` 容器里的常驻宿主节点（关闭时 `display:none`），
			* 打开时才把 `ThemeStudioApp` 的模态变体 `createPortal` 进去。
			*
			* 常驻而不是按需创建 —— 少一个"什么时候建、什么时候摘"的状态，
			* 也免掉"节点还没建好就渲染"的竞态；`#dts-modal-host` 这个 id 同时是
			* 兜底入口的幂等键（旧实现靠 `document.getElementById(MODAL_HOST_ID)` 判重）。
			*/
			function ModalHost() {
				var slice = useSlice(modalOpen);
				var host = useSlice(overlayEffects.store).modalHost;
				if (host === null || host === void 0) return null;
				var box = e$1("div", {
					id: MODAL_HOST_ID,
					style: { display: slice.open ? void 0 : "none" }
				});
				var node = document.getElementById(MODAL_HOST_ID);
				if (!slice.open || node === null) return createPortal(box, host);
				return [createPortal(box, host), createPortal(e$1(ThemeStudioApp, {
					env,
					t: tt,
					onRequestClose: closeModal
				}), node)];
			}
			function toggleFullscreen() {
				if (fullscreenElement() !== null) return exitFullscreen();
				return requestFullscreen(document.documentElement).catch(function() {});
			}
			var env = {
				engine,
				api,
				/** 组件每次渲染现读：外层 useSlice 订阅后整棵子树跟着重渲染。 */
				get state() {
					return engine.get();
				},
				patch,
				accept: acceptRemote,
				liveScheme: liveSchemeNow,
				mediaUrl,
				tokenNames: function() {
					return probe.names();
				},
				isKnownToken: function(name) {
					var groups = engine.get().tokenGroups || [];
					for (var i = 0; i < groups.length; i += 1) {
						var tokens = groups[i].tokens || [];
						for (var j = 0; j < tokens.length; j += 1) if (tokens[j].name === name) return true;
					}
					return false;
				},
				textContrast: function(scheme) {
					var doc = engine.get().doc;
					if (doc === null) return 21;
					var tokens = doc.palette.tokens || {};
					return contrastRatio(tokens["--dsw-alias-bg-base"] && tokens["--dsw-alias-bg-base"][scheme] || probe.of("--dsw-alias-bg-base", scheme) || (scheme === "dark" ? "#151517" : "#ffffff"), tokens["--dsw-alias-label-primary"] && tokens["--dsw-alias-label-primary"][scheme] || probe.of("--dsw-alias-label-primary", scheme) || (scheme === "dark" ? "#f2f4f8" : "#0f1115"));
				},
				applyPreset: function(id) {
					return api.preset(id).then(function(projection) {
						acceptRemote(projection);
						notify(t("preset.applied"), "ok");
					}, function(error) {
						notify(t("common.failed") + "：" + String(error.message || error), "error");
					});
				},
				upload: function(file) {
					return api.upload(file).then(function(value) {
						probe.invalidate();
						return reload().then(function() {
							return value;
						});
					}, function(error) {
						notify(t("common.failed") + "：" + String(error.message || error), "error");
						throw error;
					});
				},
				useAsFont: function(item) {
					var family = "DTS-" + String(item.id).slice(0, 8);
					patch(function(d) {
						if (!d.type.families.some(function(f) {
							return f.id === item.id;
						})) d.type.families.push({
							id: item.id,
							family,
							weight: 400,
							style: "normal"
						});
						d.type.uiFont = "\"" + family + "\", " + (d.type.uiFont || "sans-serif");
					});
				},
				activateBackdrop: function(kind, id) {
					var doc = engine.get().doc;
					if (doc === null) return;
					var turnedGlassOn = !doc.glass.enabled;
					patch(function(d) {
						d.backdrop.mode = kind;
						d.backdrop.mediaId = id;
						if (turnedGlassOn) {
							d.glass.enabled = true;
							if (d.glass.alpha > .6) d.glass.alpha = .45;
						}
					});
					if (turnedGlassOn) notify(t("backdrop.glassOn"), "ok");
				},
				setBackdropMode: function(v) {
					var doc = engine.get().doc;
					if (doc === null) return;
					var turnedGlassOn = v !== "none" && !doc.glass.enabled;
					patch(function(d) {
						d.backdrop.mode = v;
						if (v === "image" || v === "video") {
							var item = mediaLookup(engine.get().media, d.backdrop.mediaId);
							if (d.backdrop.mediaId !== "" && (item === void 0 || item.kind !== v)) d.backdrop.mediaId = "";
						} else d.backdrop.mediaId = "";
						if (turnedGlassOn) {
							d.glass.enabled = true;
							if (d.glass.alpha > .6) d.glass.alpha = .45;
						}
					});
					if (turnedGlassOn) notify(t("backdrop.glassOn"), "ok");
				},
				confirmDialog: openDialog,
				askDelete,
				askReset,
				answerDialog,
				sampleAccent,
				notify,
				openModal,
				closeModal,
				toggleFullscreen
			};
			function ensureChromeStyle() {
				var el = upsertStyle(CHROME_STYLE_ID, CHROME_CSS);
				if (styles.indexOf(el) === -1) styles.push(el);
			}
			function tt(key) {
				var args = Array.prototype.slice.call(arguments, 1);
				return t.apply(null, [key].concat(args));
			}
			var settingsDisposer = null;
			var fallbackDisposer = null;
			var entryMode = "";
			/** 回退判定的 setTimeout 句柄：卸载前要能取消，否则会在已 dispose 的 ctx 上注册。 */
			var entryTimer = 0;
			/**
			* ★ 官方注册签名（产物逐字，`settings-general/lib/client.js:1169-1172`）：
			*   `{ id: 'general', order: 0, label: () => t('general.nav'), locale: NS }`
			*
			* 两个要点，缺一不成：
			*   · `label` 必须传 **thunk**（不是字符串）—— 官方外壳投影导航时调的是
			*     `resolveSlotLabel(e.options.label)`（`ui-slots/lib/index.js:27`），
			*     字符串会被原样用掉，thunk 才会在每次投影时现取当前语言；
			*   · 声明 `locale: NS` —— 外壳把 `ctx.locale.getSnapshot().revision` 纳入
			*     `useSections` 的比较键（`settings-general/lib/client.js:1020-1021`），
			*     revision 一变就重解析 label **并重渲染 outlet**
			*     （`ui-renderer/lib/client.js:1097-1098`）。
			* 于是"换语言 → dispose + 重注册 + 组件整棵重建"这整条链不再需要 ——
			* 连带消掉了"重注册会丢组件内草稿"的那个坑（见下面 `draft` 的说明）。
			*
			* ⚠️ **有意偏离官方一处**：`locale` 只在拿得到 locale 服务时才声明。
			* 官方页面的 `inject` 数组里含 `locale`，服务必在；本插件把 locale 当**可选**依赖
			* （`exports.inject = ['slots','theme']`，Electron 壳可能没有 locale 插件），
			* 而 renderer 对"声明了 locale 却没有 locale face"的处理是**抛
			* `SlotAssemblyError`**（`ui-renderer/lib/client.js:721-724`）——
			* 那会让整个 slot 条目白屏（正是 SKILL.md:21 点名要避免的
			* `slot entry crashed`）。所以这里按"服务在不在"决定要不要声明：
			* 有服务 = 官方形态（换语言自动重渲染）；没服务 = 不声明，界面走本地词典降级链，
			* 只是换语言要刷新页面 —— 好过整个面板消失。
			*/
			function registerSettingsSection() {
				if (settingsDisposer !== null) return;
				settingsDisposer = ctx.slots.inject("settings.section", function() {
					var options = {
						name: "settings.section",
						id: PLUGIN_ID,
						order: 60,
						priority: 60,
						label: function() {
							return t("section.title");
						},
						inject: function() {
							return {
								env,
								t: tt
							};
						}
					};
					if (getLocaleService() !== null) options.locale = LOCALE_NS;
					return ctx.slots.register(options, ThemeStudioApp);
				});
			}
			function registerFallbackRow() {
				if (fallbackDisposer !== null) return;
				fallbackDisposer = ctx.slots.inject("settings.general.item", function() {
					var options = {
						name: "settings.general.item",
						id: PLUGIN_ID,
						order: 60,
						inject: function() {
							return {
								env,
								t: tt
							};
						}
					};
					if (getLocaleService() !== null) options.locale = LOCALE_NS;
					return ctx.slots.register(options, ThemeStudioGeneralRow);
				});
			}
			/** ledger 自省：条目是否真的进了设置导航。官方外壳就是读这张表投影导航的。 */
			function landed() {
				try {
					if (typeof ctx.slots.entries !== "function") return true;
					var rows = ctx.slots.entries("settings.section") || [];
					for (var i = 0; i < rows.length; i += 1) {
						var options = rows[i] && rows[i].options;
						if (options && options.id === "dsh-theme-studio") return true;
					}
					return false;
				} catch (err) {
					return true;
				}
			}
			/**
			* 设置页入口。首选官方 settings.section；没进 ledger 就回退到「通用设置」一行。
			* 无论 slot 契约怎么变都要有入口 —— 入口消失就是功能退化。
			*/
			function mountSettingsEntry() {
				if (!ctx.slots || typeof ctx.slots.inject !== "function") {
					console.info("[dsh-theme-studio] 环境未提供 slots 服务，跳过设置页入口");
					return;
				}
				try {
					registerSettingsSection();
					entryMode = "section";
				} catch (err) {
					console.warn("[dsh-theme-studio] settings.section 注册失败：", err);
					entryMode = "none";
				}
				window.clearTimeout(entryTimer);
				entryTimer = window.setTimeout(function() {
					if (disposed) return;
					if (entryMode === "section" && landed()) {
						if (fallbackDisposer !== null) {
							try {
								fallbackDisposer();
							} catch (err) {}
							fallbackDisposer = null;
						}
						return;
					}
					if (entryMode !== "fallback") {
						console.warn("[dsh-theme-studio] settings.section 未进 ledger，回退到「通用设置」行");
						entryMode = "fallback";
						try {
							registerFallbackRow();
						} catch (err) {
							console.warn("[dsh-theme-studio] 回退入口注册失败：", err);
						}
					}
				}, 0);
			}
			/**
			* 语言来源变化的唯一漏斗：只有解析出来的语言真的变了才刷新。
			* 两个来源各判一次会行为不一致（一个改了文案另一个没跟）。
			*
			* ⚠️ 这里**不再重注册设置页条目**（`label` 改 thunk + 声明 `locale` 之后，
			* 重渲染由官方外壳负责，见 registerSettingsSection 的注释）。重注册曾是
			* "换语言丢草稿"的唯一成因：dispose + 重注册会让组件整棵重建。
			*/
			var lang = currentLang();
			function onLangSourceChanged() {
				var next = currentLang();
				if (next === lang) return;
				lang = next;
				langRevision.update({ revision: langRevision.get().revision + 1 });
			}
			/**
			* 「整窗全屏」原来挂在面板头里（标题右边），按主人指定挪进**窗口顶条**、
			* 紧挨原生最小化键左侧。Windows 是 `titleBarStyle:"hidden"` +
			* `titleBarOverlay:{height:40}` —— — □ × 由系统画在右上角，页面这一侧能用的
			* 只剩它们左边的自由区，所以右偏移必须实测：
			*   WCO 给出自由区矩形 → 视口右沿减去自由区右沿 = 三键总宽；
			*   拿不到（非 Windows / WCO 关闭）按 Win11 三键 46×3=138 兜底，
			*   macOS 红绿灯在左、右边是空的 → 12。
			*/
			/**
			* 改造前这里是**第四处 `document.body` 写入**：
			*   `document.body.appendChild(fsButton)`（`<button class="dts-fs">` 浮在窗口顶条）
			*   + `window.addEventListener('resize', syncFsInset)`（注册点也不在 effect 内）。
			* 现在它同时是 §3 的 `Tooltip` 唯一接线点（见 `FullscreenButton`）。
			*/
			function captionInset() {
				try {
					var overlay = navigator.windowControlsOverlay;
					if (overlay && typeof overlay.getTitlebarAreaRect === "function") {
						var rect = overlay.getTitlebarAreaRect();
						var inset = window.innerWidth - (rect.x + rect.width);
						if (Number.isFinite(inset) && inset >= 0 && inset <= 480) return inset;
					}
				} catch (err) {}
				return document.documentElement.hasAttribute("data-windows-titlebar") ? 138 : 12;
			}
			/**
			* 窗口顶条的全屏键。**声明式**渲染在 `OverlaySurface` 的容器里：
			*   · 换语言：`langRevision` 由 `onLangSourceChanged` 推进 ⇒ 文案跟着变，
			*     不再需要 `setFsLabel()` 那种"抓到节点再改属性"的命令式刷新；
			*   · `resize` 监听：注册在 `useEffect` 里（组件级 effect，随卸载摘除）——
			*     与旧实现"在 mountFsButton 里挂、在 unmountFsButton 里摘"等价但更严。
			*/
			function FullscreenButton() {
				useSlice(langRevision);
				var insetState = useState$1(captionInset);
				useEffect$1(function() {
					function onResize() {
						insetState[1](captionInset());
					}
					window.addEventListener("resize", onResize);
					return function() {
						window.removeEventListener("resize", onResize);
					};
				}, []);
				var label = tt("common.fullscreen");
				return uiTooltip(tt("common.fullscreen"), e$1("button", {
					type: "button",
					className: "dts-fs",
					style: { "--dts-caption-inset": String(insetState[0]) + "px" },
					"aria-label": label,
					title: label,
					onClick: function() {
						toggleFullscreen();
					}
				}, "⤢"));
			}
			/**
			* 把插件在**框架级浮层**里的一切注到官方 `shell.overlay` 槽（`OverlaySurface`）。
			*
			* 官方依据（`dsh-client-ui-layout` 产物逐字）：
			*   `{ key: 'shell.overlay', kind: 'list', scope: 'root',
			*      summary: 'Frame-wide floating layer, above every column and outside their
			*                scroll containers.' }`
			* 且该层 **click-through**（`[data-shell-overlay]{position:absolute;inset:0;
			* z-index:20;pointer-events:none}`）—— 条目自己决定哪一块吃指针。
			* 官方自己的 8 个条目（`chat.quota-notice` / `schedule.delete-toast` / …）都注在这里。
			*
			* 我们说得出"为什么需要浮层"（`references_ui-plugin.md:5` 的判据）：
			* 壁纸要盖住整个框架（不属于任何一列）、一次性提示要跨面板存活、
			* 全屏键要贴在窗口顶条上 —— 三者都不是某列内部的东西。
			*
			* ⚠️ 注册失败（宿主没有这个槽 / 槽契约变了）不改入口模式：只是浮层那几件
			* （背景层、提示、兜底模态、全屏键）暂时不出现，设置页入口照常。
			*/
			/**
			* 浮层宿主的**内容**：三件挂在框架级浮层上的东西 —— 一次性提示、兜底模态、全屏键。
			*
			* ⚠️ 这里是**元素**而不是"调三个组件函数"：本夹具（node 侧）不跑 React 调度器，
			* 直接把组件函数当普通函数调会让它们内部的 hooks 抛 `Invalid hook call` ——
			* 返回元素则与真运行时同构（React 负责调用）。
			*/
			function OverlayContent() {
				return [
					e$1(NoticeViewport, { key: "notices" }),
					e$1(ModalHost, { key: "modal" }),
					e$1(FullscreenButton, { key: "fs" })
				];
			}
			function registerOverlaySurface() {
				if (overlayDisposer !== null) return;
				if (!ctx.slots || typeof ctx.slots.inject !== "function") return;
				try {
					overlayDisposer = ctx.slots.inject("shell.overlay", function() {
						var options = {
							name: "shell.overlay",
							id: PLUGIN_ID,
							order: 60
						};
						if (getLocaleService() !== null) options.locale = LOCALE_NS;
						return ctx.slots.register(options, function OverlayEntry() {
							return e$1(OverlaySurface, {
								effects: overlayEffects,
								attachStage: function(node) {
									layer.attachStage(node);
								},
								detachStage: function() {
									layer.detachStage();
								},
								content: OverlayContent
							});
						});
					});
				} catch (err) {
					overlayDisposer = null;
					console.warn("[dsh-theme-studio] shell.overlay 注册失败（浮层不出现，面板照常）：", err);
				}
			}
			/**
			* 视差监听的注册点（`references_ui-plugin.md:13`：注册一律在 `ctx.effect` 内）。
			* 改造前 `window.addEventListener('pointermove')` 是在 `sync()`（网络回调）里挂的，
			* 现在业务侧只翻开关，真正的注册/摘除在这里成对发生。
			*/
			layer.createBackdropEffect(ctx);
			ctx.effect(function() {
				if (!ctx.theme) console.warn("[dsh-theme-studio] 环境未提供 theme 服务，配色改动将只落在背景层");
				ensureChromeStyle();
				registerOverlaySurface();
				mountSettingsEntry();
				var disposeCaptionMenu = installCaptionMenu();
				reload();
				var settle = window.setTimeout(function() {
					probe.invalidate();
					reload();
				}, 400);
				return function() {
					window.clearTimeout(settle);
					disposeCaptionMenu();
					closeModal();
					notices.clear();
					layer.detachStage();
					if (overlayDisposer !== null) {
						try {
							overlayDisposer();
						} catch (err) {}
						overlayDisposer = null;
					}
				};
			}, "theme-studio: boot");
			/**
			* 词典注册进官方 locale 服务 —— 官方写法（ui-theme:1583 / ui-settings-general:969
			* / ui-chat:12234 同一形态）：`ctx.effect(() => locale.register(NS, {zh,en}), '<reason>')`。
			* `register` 返回撤销本次注册的 disposer，由 effect 在卸载时回收。
			* 与自研 t() 共用同一个 MESSAGES 对象，同源不漂移；locale 缺席（Electron 壳）
			* 则安静跳过，界面走本地词典降级链。
			*/
			ctx.effect(function() {
				return registerLocaleDictionary(getLocaleService());
			}, "theme-studio: locale dictionaries");
			ctx.effect(function() {
				/**
				* 语言变化的订阅面 —— **只剩官方两个来源**（本轮删掉了第三档）：
				*   ① locale.subscribe —— 官方推荐面，换语言与词典注册都会撞 revision；
				*   ② ctx.on('locale/change') —— 官方事件（只在真的换语言时发）。
				*
				* ⚠️ 这条链**不再负责设置页条目**：条目的 `label` 是 thunk + 声明了 `locale`，
				*    官方外壳自己在 locale revision 变化时重解析并重渲染
				*    （`settings-general/lib/client.js:1022-1023` 的 `resolveSlotLabel(e.options.label)`
				*     外面套着 `ctx.locale.getSnapshot().revision` 比较；
				*     `ui-renderer/lib/client.js:1097-1098` 的每个 outlet 都订了 `useLocaleRevision`）。
				*    它现在只服务**不在 slot 树里**的那样东西：窗口顶条的全屏按钮
				*    （`setFsLabel()` 刷 title/aria-label）。
				*
				* ★ 已删除的第三档：`MutationObserver(<html lang>)`。
				*   它当初存在的理由是"两个官方来源都没有时，靠 <html lang> 变化触发
				*   **重新注册设置页条目**"。重注册整条链已经不存在（label thunk + locale 声明），
				*   于是这一档只剩下"locale 服务缺席时，让全屏按钮的文案跟着 <html lang> 变"
				*   这点残余作用 —— 而 locale 服务缺席时本插件的文案本来就在启动时定死
				*   （面板内容也靠外壳重渲染，没有外壳就没有重渲染信号），
				*   留它反而是一处"看起来在自愈、其实只救了半件事"的假象。
				*   代价如实记在 `ui-align/13-panel-official-paradigm.md` §5/§7：
				*   无 locale 服务的组合里，切 `<html lang>` 不再刷新全屏按钮的 title。
				*/
				var offService = null;
				var offEvent = null;
				try {
					var localeSvc = getLocaleService();
					offService = subscribeLocaleChanges(localeSvc, function() {
						onLangSourceChanged();
					});
					if (offService === null && typeof ctx.on === "function" && localeSvc) offEvent = ctx.on("locale/change", function() {
						onLangSourceChanged();
					});
				} catch (err) {
					offService = null;
					offEvent = null;
				}
				return function() {
					if (typeof offService === "function") try {
						offService();
					} catch (err) {}
					if (typeof offEvent === "function") try {
						offEvent();
					} catch (err) {}
				};
			}, "theme-studio: language watch");
			ctx.effect(function() {
				function onKey(event) {
					if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
					if (String(event.key).toLowerCase() === "f") {
						event.preventDefault();
						toggleFullscreen();
					}
				}
				window.addEventListener("keydown", onKey);
				return function() {
					window.removeEventListener("keydown", onKey);
				};
			}, "theme-studio: hotkeys");
			ctx.effect(function() {
				if (!ctx.theme) return void 0;
				if (typeof ctx.on !== "function") return void 0;
				var off = ctx.on("theme/change", function() {
					setLiveScheme(liveSchemeNow());
					var doc = engine.get().doc;
					if (doc !== null) layer.sync(doc, prefix, engine.get().media);
				});
				return typeof off === "function" ? off : void 0;
			}, "theme-studio: theme/change");
			ctx.effect(function() {
				var closed = false;
				var stream = null;
				try {
					stream = new EventSource(prefix + "/api/events");
					stream.addEventListener("message", function(event) {
						var payload = null;
						try {
							payload = JSON.parse(event.data);
						} catch (err) {
							payload = null;
						}
						if (payload && payload.revision === lastAppliedRevision) return;
						if (draft !== null) return;
						reload();
					});
					stream.addEventListener("error", function() {});
				} catch (err) {}
				function onVisible() {
					if (document.visibilityState === "visible" && !closed && draft === null) reload();
				}
				document.addEventListener("visibilitychange", onVisible);
				return function() {
					closed = true;
					document.removeEventListener("visibilitychange", onVisible);
					if (stream !== null) stream.close();
				};
			}, "theme-studio: live sync");
			ctx.effect(function() {
				return function() {
					disposed = true;
					cancelPendingCommit();
					window.clearTimeout(entryTimer);
					if (settingsDisposer !== null) {
						try {
							settingsDisposer();
						} catch (err) {}
						settingsDisposer = null;
					}
					if (fallbackDisposer !== null) {
						try {
							fallbackDisposer();
						} catch (err) {}
						fallbackDisposer = null;
					}
					if (overlayDisposer !== null) {
						try {
							overlayDisposer();
						} catch (err) {}
						overlayDisposer = null;
					}
					window.clearTimeout(commitTimer);
					styles.forEach(function(el) {
						el.remove();
					});
					notices.clear();
					closeModal();
					layer.dispose();
					if (ctx.theme && typeof ctx.theme.overrideTokens === "function") try {
						ctx.theme.overrideTokens(TOKEN_SOURCE, {});
					} catch (err) {}
				};
			}, "theme-studio: teardown");
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* src/client/index.ts —— 浏览器半入口：装配 Cordis 客户端契约。
		*
		* 与官方源码交叉核验过的事实（逐条对过 harness，不是照抄注释）：
		*   - ctx.slots.register(options, component) 只有两个参数；slot 未被父节点声明时
		*     直接 throw（ui-slots/src/index.ts:1205-1207）⇒ 注册一律包 try/catch 并备回退入口。
		*   - list 槽"同 id + 同 priority"重复注册会 throw（同文件 :1231）⇒ 换语言重新注册前
		*     必须先 dispose 旧注册，否则第二次必炸。
		*   - ctx.locale.getSnapshot().active 是语言的权威源（locale/src/client/index.ts:581
		*     provide、:227 getSnapshot）。⚠️ 不能只认 <html lang>：服务端 HTML 写死 lang="en"，
		*     要等 locale 插件激活后才异步改写；观察器若挂在写入之后，界面会永久停在英文。
		*   - Switch 的 label 只作 aria-label、不渲染可见文字；Tooltip 的 children 必须能接 ref；
		*     react-dom/client 与 ui-primitives 都在 PLATFORM_MODULES 基座表里（client/web/src/platform.ts）。
		*
		* 产物契约（tools/tsdown.theme-studio.config.ts 的 banner/intro/footer 三件套包装）：
		* 本模块的导出即 closure-factory 的 module.exports。bare require() 取基座模块
		* （现行生产验证过的运行时形态，r1-probe 实测打包原样透传、两种 react 形态都兼容）。
		*/
		const name = PLUGIN_ID;
		/**
		* ⚠️ 这是 **cordis 服务注入表**：要用 ctx.slots 就得写 'slots'。
		* 与 package.json 里的 dsh.client.inject（包级声明）不是一回事。
		* locale 故意不声明：它是可选依赖，用 ctx.get 取，拿不到就走降级链。
		*/
		const inject = ["slots", "theme"];
		//#endregion
		exports.__internals = {
			MESSAGES,
			t,
			normalizeLang,
			LOCALE_NS,
			setLocaleService,
			getLocaleService,
			registerLocaleDictionary,
			subscribeLocaleChanges,
			createStore,
			createApi,
			createTokenProbe,
			fillTokenPairs,
			composeGlass,
			fixTextFamily,
			fixDiffFamily,
			createLayerManager,
			upsertStyle,
			keyed,
			withAlphaCss,
			toHex,
			contrastRatio,
			humanBytes,
			mediaLookup,
			clamp: clamp$1,
			CHROME_CSS,
			TABS,
			requestFullscreen,
			exitFullscreen,
			fullscreenElement,
			COMMIT_DEBOUNCE_MS: 220,
			LAYER_ID,
			STYLE_ID,
			MODAL_HOST_ID,
			DEFAULT_PREFIX,
			relativeLuminance,
			rgbToHsl
		};
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map