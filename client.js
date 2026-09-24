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
		var FAB_ID = "dts-fab";
		var MODAL_HOST_ID = "dts-modal-host";
		var DEFAULT_PREFIX = "/dsh-theme-studio";
		/**
		* 玻璃表面兜底清单：Host 的 glassSurfaces 是权威源，但随 dsh web 启动装载
		* （改它要重启）。这几位"有底不好"的高频表面在浏览器半自带一份补集，
		* 刷新即生效：新会话条（button-elevated-fill）与聊天气泡（specific-bubble）。
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
				"tab.presets": "预设",
				"tab.backdrop": "背景",
				"tab.library": "素材库",
				"tab.color": "色彩",
				"tab.type": "文字",
				"tab.shape": "形状与动效",
				"tab.advanced": "高级",
				"tab.profile": "我的方案",
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
				"adv.usage": "素材占用",
				"dialog.resetTitle": "恢复默认主题？",
				"dialog.resetBody": "当前配色、背景与素材引用会被重置；已上传的素材文件不会删除。",
				"dialog.deleteTitle": "删除这个素材？",
				"dialog.deleteBody": "文件会从磁盘移除，使用该素材的主题会失去背景。",
				"dialog.forceBody": "该素材正被当前主题引用，删除后背景会变空。",
				"dialog.forceFontBody": "该字体正被字体栈使用，删除后相关文字回退默认字体。",
				"err.offline": "连不上主题工坊的本地接口：确认界面由 dsh web 提供（Electron 外壳没有 HTTP 载体）。",
				"err.writeToken": "写口令缺失：刷新页面即可恢复。"
			},
			en: {
				"section.title": "Theme Studio",
				"tab.presets": "Presets",
				"tab.backdrop": "Backdrop",
				"tab.library": "Library",
				"tab.color": "Colors",
				"tab.type": "Type",
				"tab.shape": "Shape & Motion",
				"tab.advanced": "Advanced",
				"tab.profile": "Profiles",
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
				"adv.usage": "Material usage",
				"dialog.resetTitle": "Reset to the default theme?",
				"dialog.resetBody": "Colors, backdrop and media references reset; uploaded material files are kept.",
				"dialog.deleteTitle": "Delete this material?",
				"dialog.deleteBody": "The file is removed from disk and any theme using it loses its backdrop.",
				"dialog.forceBody": "The active theme references this material; the backdrop goes empty after deletion.",
				"dialog.forceFontBody": "This font is used by a font stack; affected text falls back to defaults after deletion.",
				"err.offline": "Cannot reach the local Theme Studio API: make sure this UI is served by dsh web (the Electron shell has no HTTP carrier).",
				"err.writeToken": "Missing write token: reload the page to restore it."
			}
		};
		function normalizeLang(value) {
			var tag = String(value || "").toLowerCase();
			if (tag.indexOf("zh") === 0) return "zh";
			if (tag.indexOf("en") === 0) return "en";
			return "";
		}
		/**
		* 官方 locale 服务句柄。**由 apply() 装配时赋值，但必须住在工厂作用域**：
		* 模块级 t() 要调 currentLang()，而 currentLang 要读这个句柄 ——
		* 把它关在 apply() 里会让 apply 之外的一切 t() 调用直接 ReferenceError。
		* 它是可选依赖，所以不写进 exports.inject，取不到就走降级链。
		*/
		var localeService = null;
		/** 跨模块可变：apply() 装配时句柄赋值（ESM import 绑定只读，走存取器）。 */
		function setLocaleService(next) {
			localeService = next;
		}
		function getLocaleService() {
			return localeService;
		}
		/**
		* 当前语言。**权威源是官方 locale 服务，不是 <html lang>。**
		* 服务端 HTML 写死 lang="en"，要等 locale 插件激活后才异步改写；
		* 只认 <html lang> 会在早于改写时永远拿到 en，观察器若挂在写入之后
		* 就再也收不到那一次变化 —— 界面永久停在英文且无自愈通道。
		* 顺序：locale 服务 → <html lang> → navigator.language，且必须每次现读。
		*/
		function currentLang() {
			try {
				var snapshot = localeService && typeof localeService.getSnapshot === "function" ? localeService.getSnapshot() : null;
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
		* 取文案。
		* ⚠️ 参数是可变的：带占位的文案按顺序多传 t('key', a, b)。
		* 只收一个参数会让占位渲染成 undefined，静态检查抓不到。
		*/
		function t(key) {
			var args = Array.prototype.slice.call(arguments, 1);
			var dict = MESSAGES[currentLang()] || MESSAGES.zh;
			var value = dict[key] !== void 0 ? dict[key] : MESSAGES.zh[key];
			return typeof value === "function" ? value.apply(null, args) : value;
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
		function clamp(v, lo, hi) {
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
			const nums = parts.slice(0, 3).map((token) => Number.parseFloat(token));
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
		var React = require("react");
		var ReactDOMClient = null;
		/** 官方 ui-primitives 句柄（缺失时为空对象，适配层逐个降级）。 */
		var P = {};
		try {
			ReactDOMClient = require("react-dom/client") || null;
		} catch (err) {
			ReactDOMClient = null;
		}
		try {
			P = require("@deepseek-ai/dsh-client-ui-primitives") || {};
		} catch (err) {
			P = {};
		}
		/**
		* createElement 简写。
		* ⚠️ 必须是函数声明而不是箭头 —— 要用 arguments 收可变子节点，
		* 箭头函数没有自己的 arguments（node --check 抓不到，只在运行时炸）。
		*/
		function e(type, props, ..._children) {
			var children = Array.prototype.slice.call(arguments, 2);
			return React.createElement.apply(React, [type, props].concat(children));
		}
		const useState = React.useState;
		const useEffect = React.useEffect;
		const useRef = React.useRef;
		const useCallback = React.useCallback;
		const useSyncExternalStore = React.useSyncExternalStore;
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
			var read = useCallback(store.get, [store]);
			return useSyncExternalStore(useCallback(store.subscribe, [store]), read, read);
		}
		//#endregion
		//#region src/client/probe-glass.ts
		/**
		* ui-theme 的令牌表是激活时注入的同源 <style>，cssRules 可枚举。
		* 一次扫出 body 与 body[data-ds-dark-theme] 两条规则里的全部自定义属性，
		* 就拿到"两套模式的基准值"——比临时切 data 属性再 getComputedStyle 可靠：
		* 不闪屏、不依赖当前模式。扫不到时退回现值，只保证当前模式准确。
		*/
		function createTokenProbe() {
			var cache = null;
			var nameCache = null;
			function safeRules(sheet) {
				try {
					return sheet.cssRules || null;
				} catch (err) {
					return null;
				}
			}
			function scan() {
				if (cache !== null) return cache;
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
				cache = {
					light,
					dark
				};
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
		/** 玻璃基准 × alpha；与文字对比不足 4.5:1 就翻到对比侧。 */
		function glassColor(bg, fg, alpha) {
			if (typeof bg !== "string" || bg === "") return bg;
			if (fg !== "" && contrastRatio(bg, fg) >= 4.5) return withAlphaCss(bg, alpha);
			return withAlphaCss((fg === "" ? true : relativeLuminance(fg) > .36) ? "rgb(16, 20, 24)" : "rgb(250, 250, 252)", alpha);
		}
		/** 文字族对比自愈涉及的次级文字令牌（按层级给半透明度）。
		*  caption 是输入框 placeholder 的底色来源：0.62 太淡（输入字看不清实测），
		*  提到 0.82 保 placeholder 可读；其余档保持层次差。
		*  ⚠️ primary-dimmed / primary-bluish 是漏网暗字：白字主题下基准仍是
		*  #151517 / #0e3074 暗字，压深玻璃底看不见（排队消息预览"选择才看清"实测）。 */
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
				return response.json().then(function(body) {
					if (body && body.ok === true) return body.value;
					var message = body && body.error && body.error.message || "HTTP " + response.status;
					var error = new Error(message);
					error.status = body && body.error && body.error.status || response.status;
					throw error;
				});
			}
			return {
				getState: function() {
					return fetch(url("/api/state"), { cache: "no-store" }).then(unwrap);
				},
				saveDoc: function(doc, expectRevision) {
					return fetch(url("/api/state"), {
						method: "PUT",
						headers: headers({ "content-type": "application/json" }),
						body: JSON.stringify({
							doc,
							expectRevision
						})
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
		function createLayerManager() {
			var layer = null;
			var cssInner = null;
			var video = null;
			var parallaxBound = false;
			var parallaxRaf = 0;
			function ensureLayer() {
				if (layer !== null && document.body.contains(layer)) return layer;
				layer = document.getElementById(LAYER_ID);
				if (layer === null) {
					layer = document.createElement("div");
					layer.id = LAYER_ID;
					layer.className = "dts-layer";
					layer.setAttribute("aria-hidden", "true");
					document.body.insertBefore(layer, document.body.firstChild);
				}
				return layer;
			}
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
			function attachParallax() {
				if (parallaxBound) return;
				parallaxBound = true;
				window.addEventListener("pointermove", onPointerMove, { passive: true });
			}
			function detachParallax() {
				if (!parallaxBound) return;
				parallaxBound = false;
				window.removeEventListener("pointermove", onPointerMove);
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
				detachParallax();
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
				var rate = clamp(v.playbackRate, .25, 2);
				if (video.playbackRate !== rate) video.playbackRate = rate;
				if (v.autoplay) {
					var attempt = video.play();
					if (attempt && typeof attempt.catch === "function") attempt.catch(function() {});
				} else video.pause();
				detachParallax();
			}
			function sync(doc, prefix, media) {
				var b = doc.backdrop;
				if (b.mode === "none") {
					if (layer !== null) {
						if (video !== null) try {
							video.pause();
						} catch (err) {}
						layer.remove();
						layer = null;
						cssInner = null;
						video = null;
					}
					detachParallax();
					document.body.classList.remove("dts-on");
					return;
				}
				document.body.classList.add("dts-on");
				setLiveScheme(document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light");
				var meta = mediaLookup(media, b.mediaId);
				if (b.mode === "video" && b.mediaId !== "" && meta !== void 0) showVideoLayer(prefix + "/media/" + encodeURIComponent(meta.id) + "/" + encodeURIComponent(meta.name || ""), doc);
				else showCssLayer();
				if (b.parallax > 0) attachParallax();
				else detachParallax();
			}
			function element() {
				return document.getElementById(LAYER_ID);
			}
			function dispose() {
				detachParallax();
				if (video !== null) try {
					video.pause();
				} catch (err) {}
				if (layer !== null) layer.remove();
				layer = null;
				cssInner = null;
				video = null;
			}
			return {
				sync,
				dispose,
				element
			};
		}
		/** 注入或替换一段样式；带 data-plugin* 标记，交给宿主按插件生命周期回收。 */
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
		var CHROME_CSS = [
			"body.dts-on .dts-layer{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;contain:paint}",
			"body.dts-on #root{position:relative;z-index:1}",
			".dts-panel,.dts-row,.dts-head,.dts-tabs,.dts-body,.dts-group,.dts-btn,.dts-pill,.dts-switch,.dts-card,.dts-card-body,.dts-card-actions,.dts-drop,.dts-focus,.dts-color,.dts-range,.dts-fab,.dts-modal-mask,.dts-modal-card,.dts-scrim,.dts-dialog,.dts-btnwrap,.dts-note,.dts-tab,.dts-status{box-sizing:border-box}",
			".dts-panel{display:flex;flex-direction:column;gap:14px;font-family:var(--dsw-font-family,inherit);color:var(--dsw-alias-label-primary,#101418)}",
			".dts-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dts-title{display:flex;align-items:center;gap:7px;margin:0;font-size:15px;font-weight:600}",
			".dts-status{display:inline-flex;align-items:center;gap:5px;margin-inline-start:auto;font-size:12px;color:var(--dsw-alias-label-tertiary,#6d7480)}",
			".dts-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary,#d4d6d8)}",
			".dts-dot[data-state=\"done\"]{background:var(--dsw-alias-state-success-primary,#22c55e)}",
			".dts-dot[data-state=\"error\"]{background:var(--dsw-alias-state-error-primary,#ec1313)}",
			".dts-dot[data-state=\"ongoing\"]{background:var(--dsw-alias-brand-primary,#0f1115);animation:dts-pulse 1.2s var(--ds-ease-in-out,ease) infinite}",
			"@keyframes dts-pulse{0%,100%{opacity:1}50%{opacity:.35}}",
			".dts-status[data-state=\"error\"]{color:var(--dsw-alias-state-error-primary,#ec1313)}",
			".dts-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));overflow-x:auto;scrollbar-width:none}",
			".dts-tab{appearance:none;border:0;background:transparent;padding:7px 11px;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,#353638);border-radius:8px 8px 0 0;cursor:pointer;white-space:nowrap}",
			".dts-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));color:var(--dsw-alias-label-primary,#101418)}",
			".dts-tab[aria-selected=\"true\"]{color:var(--dsw-alias-brand-primary,#0f1115);box-shadow:inset 0 -2px 0 0 var(--dsw-alias-brand-primary,#0f1115)}",
			".dts-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}",
			".dts-body{display:flex;flex-direction:column;gap:14px}",
			".dts-group{display:flex;flex-direction:column;gap:9px;padding:12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,#f5f6f7);box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}",
			".dts-group>h4{margin:0;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary,#6d7480)}",
			".dts-hint{margin:0;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#6d7480)}",
			".dts-note{margin:0;padding:6px 9px;font-size:12px;border-radius:9px;background:var(--dsw-specific-tip,#f1f3f5);color:var(--dsw-alias-label-secondary,#353638)}",
			".dts-note[data-tone=\"warn\"]{background:var(--dsw-alias-state-warn-tertiary,#fef5e7);color:var(--dsw-alias-state-warn-label,#dd8629)}",
			".dts-note[data-tone=\"error\"]{background:var(--dsw-alias-code-diff-deleted,rgba(236,19,19,.08));color:var(--dsw-alias-state-error-primary,#ec1313)}",
			".dts-row{display:grid;grid-template-columns:minmax(96px,168px) 1fr auto;align-items:center;gap:10px}",
			".dts-row>label{font-size:12.5px;color:var(--dsw-alias-label-secondary,#353638)}",
			".dts-input{width:100%;min-width:0;padding:5px 8px;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary,#101418);background:var(--dsw-specific-input-major,#fff);border:0;border-radius:8px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}",
			".dts-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:1px}",
			"body.dts-on .dts-input{background:rgba(16,20,24,.35)!important}",
			"body.dts-on .dts-select-trigger,body.dts-on .dts-textarea{background:rgba(16,20,24,.15)!important;backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			".dts-textarea{min-height:132px;font-family:var(--ds-font-family-code,monospace);font-size:11.5px;line-height:1.6;resize:vertical}",
			".dts-range{display:flex;align-items:center;gap:8px}",
			".dts-range input[type=\"range\"]{flex:1;accent-color:var(--dsw-alias-brand-primary,#0f1115)}",
			".dts-range output{min-width:48px;font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#6d7480);text-align:right}",
			".dts-color{display:flex;align-items:center;gap:6px;min-width:0}",
			".dts-color input[type=\"color\"]{width:30px;height:26px;padding:0;border:0;background:transparent;cursor:pointer;flex:none}",
			".dts-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--dsw-alias-label-secondary,#353638);cursor:pointer}",
			".dts-switch{width:36px;height:20px;padding:0;border:0;border-radius:999px;cursor:pointer;position:relative;background:var(--dsw-alias-state-idle-primary,#d4d6d8)}",
			".dts-switch::after{content:\"\";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}",
			".dts-switch[aria-checked=\"true\"]{background:var(--dsw-alias-state-success-primary,#22c55e)}",
			".dts-switch[aria-checked=\"true\"]::after{transform:translateX(16px)}",
			".dts-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary,#101418);background:var(--dsw-alias-button-elevated-fill,#fff);border:0;border-radius:9px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03));cursor:pointer;text-decoration:none}",
			".dts-btn:hover{background:var(--dsw-alias-button-floating-hover,#f1f3f5)}",
			".dts-btn:disabled{opacity:.5;cursor:not-allowed}",
			".dts-btn:focus-visible,.dts-pill:focus-visible,.dts-switch:focus-visible,.dts-swatch:focus-visible,.dts-drop:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}",
			".dts-btn[data-tone=\"primary\"]{color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--dsw-alias-button-primary-fill,#0f1115)}",
			".dts-btn[data-tone=\"danger\"]{color:var(--dsw-alias-state-error-primary,#ec1313)}",
			".dts-btn-danger{color:var(--dsw-alias-state-error-primary,#ec1313)}",
			".dts-input-flex{flex:1;min-width:36px;display:flex}",
			"[class*=\"buildVersion\"]{background:var(--dsw-alias-button-elevated-fill,rgba(16,20,24,.15))!important}",
			"[class*=\"_tag_\"][data-tone=\"solid\"]{background:rgba(16,20,24,.55)!important;color:var(--dsw-alias-label-primary,#fff)!important;backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			"select,.dts-select-trigger{color-scheme:dark}",
			"select option{background:#16181d;color:var(--dsw-alias-label-primary,#fff)}",
			"select option:hover{background:#263148}",
			"select option:checked{background:var(--dsw-alias-brand-primary,#0bcb81);color:var(--dsw-alias-label-primary-foreground,#fff)}",
			"[class$=\"_file\"]{background:rgba(16,20,24,.5)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:16px;backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			"[class$=\"_card\"],[class*=\"_card \"]{background:rgba(16,20,24,.15)!important;border-radius:16px!important;backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			"[class$=\"_card\"]:has([class$=\"_path\"],[class$=\"_counts\"],[class$=\"_file\"]),[class*=\"_card \"]:has([class$=\"_path\"],[class$=\"_counts\"],[class$=\"_file\"]){background:transparent!important;backdrop-filter:none!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:16px}",
			"[class$=\"_preview\"]{background:rgba(16,20,24,.5)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:12px;backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			"[class$=\"_card\"] [class$=\"_header\"],[class$=\"_card\"] [class$=\"_tile\"],[class$=\"_file\"] [class$=\"_fileIcon\"]{background:transparent!important;border-color:transparent!important}",
			"[class$=\"_backdrop\"],[class$=\"_scrim\"],[class$=\"-backdrop\"],[class$=\"-scrim\"]{background:transparent!important;backdrop-filter:none!important}",
			"[class$=\"_backdrop\"] > *,[class$=\"_scrim\"] > *{background:rgba(16,20,24,.15)!important;border:none!important;border-radius:32px!important;box-shadow:0 12px 32px rgba(0,0,0,.4);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			"[class$=\"-backdrop\"] > *,[class$=\"-scrim\"] > *{background:rgba(16,20,24,.15)!important;border:none!important;border-radius:32px!important;box-shadow:0 12px 32px rgba(0,0,0,.4);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important}",
			".dts-panel button,.dts-panel .dts-btn{white-space:nowrap;flex:none}",
			".dts-panel button:not(.dts-tab){font-size:12.5px}",
			".dts-select{position:relative;min-width:0}",
			".dts-select-trigger{display:flex;align-items:center;gap:6px;cursor:pointer;text-align:start}",
			".dts-select-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-select-caret{flex:none;opacity:.7;font-size:10px;line-height:1}",
			".dts-select-menu{position:absolute;z-index:2147482100;top:calc(100% + 6px);left:0;right:0;min-width:140px;padding:6px;display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));border-radius:16px;background:rgba(16,20,24,.88)!important;box-shadow:0 12px 32px rgba(0,0,0,.4);color-scheme:dark;backdrop-filter:var(--dsw-menu-backdrop-filter,blur(50px) saturate(150%))!important;animation:dts-menu-in var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			"@keyframes dts-menu-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
			".dts-panel button,.dts-panel .dts-btn{transition:background-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}",
			".dts-select-option{appearance:none;border:0;background:transparent;text-align:start;font:inherit;font-size:12.5px;padding:6px 10px;border-radius:9px;cursor:pointer;color:var(--dsw-alias-label-primary,#fff);transition:background-color var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			".dts-select-option:hover{background:rgba(38,49,72,.55)}",
			".dts-select-option[data-selected=\"true\"]{background:var(--dsw-alias-brand-primary,#0bcb81);color:var(--dsw-alias-label-primary-foreground,#fff)}",
			".dts-select-option:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}",
			".dts-pill{padding:3px 10px;font:inherit;font-size:12px;border:0;border-radius:999px;cursor:pointer;background:var(--dsw-specific-selector,#f1f3f5);color:var(--dsw-alias-label-secondary,#353638)}",
			".dts-pill[aria-pressed=\"true\"]{background:var(--dsw-alias-brand-primary,#0f1115);color:var(--dsw-alias-label-primary-foreground,#fff)}",
			".dts-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));gap:9px}",
			".dts-swatch{display:flex;flex-direction:column;overflow:hidden;padding:0;text-align:start;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1,#fff);border:0;border-radius:11px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03));cursor:pointer}",
			".dts-swatch:hover{box-shadow:var(--dsw-elevation-prominent,0 3px 8px rgba(0,0,0,.04))}",
			".dts-swatch[aria-pressed=\"true\"]{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary,#0f1115),var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}",
			".dts-swatch-art{display:block;height:44px}",
			".dts-swatch-name{padding:6px 8px 2px;font-size:12px}",
			".dts-swatch-note{padding:0 8px 7px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6d7480)}",
			".dts-library{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}",
			".dts-card{display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fff);border:0;border-radius:11px;box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.03))}",
			".dts-thumb{display:block;width:100%;height:82px;object-fit:cover;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04))}",
			".dts-card-body{display:flex;flex-direction:column;gap:2px;padding:7px 8px}",
			".dts-card-name{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-card-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6d7480);font-variant-numeric:tabular-nums}",
			".dts-card-actions{display:flex;flex-wrap:wrap;gap:4px;padding:0 8px 8px}",
			".dts-btn--sm{padding:3px 8px;font-size:11.5px}",
			".dts-profile-list{display:flex;flex-direction:column;gap:6px}",
			".dts-profile-row{align-items:center}",
			".dts-profile-dot{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:-1px;border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15))}",
			".dts-card-actions button,.dts-card-actions .dts-btn{flex:none;white-space:nowrap}",
			".dts-drop{display:flex;align-items:center;justify-content:center;padding:20px 14px;font-size:12.5px;color:var(--dsw-alias-label-tertiary,#6d7480);border:1px dashed var(--dsw-alias-border-l3,rgba(0,0,0,.12));border-radius:12px;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04));cursor:pointer;text-align:center}",
			".dts-drop[data-hot=\"true\"]{border-color:var(--dsw-alias-brand-primary,#0f1115);color:var(--dsw-alias-brand-primary,#0f1115);background:var(--dsw-specific-selector,#f1f3f5)}",
			".dts-focus{position:relative;width:100%;max-width:230px;aspect-ratio:16/9;overflow:hidden;border-radius:10px;background:var(--dsw-alias-bg-skeleton,rgba(0,0,0,.04)) center/cover no-repeat;cursor:crosshair}",
			".dts-focus::after{content:\"\";position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid var(--dsw-alias-brand-primary,#0f1115);border-radius:50%;box-shadow:0 0 0 999px rgba(0,0,0,.12);left:var(--fx,50%);top:var(--fy,50%)}",
			".dts-token-row{display:grid;grid-template-columns:minmax(120px,1.6fr) repeat(2,minmax(120px,1fr)) auto;gap:8px;align-items:center}",
			".dts-token-name{font-family:var(--ds-font-family-code,monospace);font-size:11px;color:var(--dsw-alias-label-secondary,#353638);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dts-pair{display:flex;gap:6px;align-items:center;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#6d7480);min-width:0}",
			".dts-pair-label{flex:none;white-space:nowrap}",
			".dts-clear-slot{display:inline-flex}.dts-clear-slot[data-empty=\"true\"]{visibility:hidden}",
			".dts-contrast{display:inline-flex;gap:6px;align-items:center;font-size:11.5px;font-variant-numeric:tabular-nums}",
			".dts-badge{padding:1px 6px;border-radius:999px;font-size:10.5px;background:var(--dsw-specific-selector,#f1f3f5);color:var(--dsw-alias-label-secondary,#353638)}",
			".dts-badge[data-level=\"ok\"]{background:var(--dsw-alias-state-success-tertiary,#e6faed);color:var(--dsw-alias-state-success-primary,#22c55e)}",
			".dts-badge[data-level=\"bad\"]{background:var(--dsw-alias-code-diff-deleted,rgba(236,19,19,.08));color:var(--dsw-alias-state-error-primary,#ec1313)}",
			".dts-fab{position:fixed;right:16px;bottom:16px;z-index:2147482000;display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;cursor:pointer;color:var(--dsw-alias-label-primary,#101418);background:var(--dsw-alias-button-elevated-fill,#fff);box-shadow:var(--dsw-elevation-prominent,0 3px 8px rgba(0,0,0,.04));transition:opacity var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease),transform var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease)}",
			".dts-fab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));transform:translateY(-1px)}",
			".dts-fab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#0f1115);outline-offset:2px}",
			".dts-fab svg{flex:none}",
			".dts-fab[data-hidden=\"true\"]{opacity:0;pointer-events:none}",
			".dts-modal-mask{position:fixed;inset:0;z-index:2147482001;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.24));backdrop-filter:var(--dsw-mask-blur,blur(2px))}",
			".dts-modal-card{display:flex;flex-direction:column;width:min(980px,100%);max-height:min(88vh,900px);overflow:auto;padding:18px 20px 16px;border-radius:16px;background:var(--dsw-alias-bg-layer-2,#f5f6f7);box-shadow:var(--dsw-elevation-prominent,0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.08))}",
			".dts-scrim{position:fixed;inset:0;z-index:2147482010;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-3,rgba(0,0,0,.48))}",
			".dts-dialog{width:min(440px,100%);display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--dsw-elevation-prominent,0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.08))}",
			".dts-dialog h3{margin:0;font-size:14px}",
			".dts-dialog-line{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,#353638);word-break:break-word}",
			".dts-dialog-line[data-kind=\"path\"]{font-family:var(--ds-font-family-code,monospace);font-size:11px}",
			".dts-dialog-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}",
			"@media (max-width:720px){.dts-row{grid-template-columns:1fr;gap:4px}.dts-token-row{grid-template-columns:1fr}}"
		].join("\n");
		//#endregion
		//#region src/client/primitives.ts
		function uiButton(props) {
			if (P.Button) return e(P.Button, {
				variant: props.variant === "primary" ? "primary" : "ghost",
				className: props.variant === "danger" ? "dts-btn-danger" : void 0,
				size: props.size,
				disabled: props.disabled,
				title: props.title,
				"aria-label": props.ariaLabel,
				onClick: props.onClick
			}, props.children);
			return e("button", {
				type: "button",
				className: props.size === "sm" ? "dts-btn dts-btn--sm" : "dts-btn",
				"data-tone": props.variant === "primary" ? "primary" : props.variant === "danger" ? "danger" : void 0,
				disabled: props.disabled,
				title: props.title,
				"aria-label": props.ariaLabel,
				onClick: props.onClick
			}, props.children);
		}
		/** Switch 的 label 只做无障碍名称（官方实现不画文字），可见标签由 Row 给。 */
		function uiSwitch(props) {
			if (P.Switch) return e(P.Switch, {
				checked: !!props.checked,
				disabled: props.disabled,
				title: props.title,
				label: props.label,
				onChange: props.onChange
			});
			return e("button", {
				type: "button",
				className: "dts-switch",
				role: "switch",
				"aria-checked": !!props.checked,
				"aria-label": props.label,
				title: props.title,
				disabled: props.disabled,
				onClick: function() {
					props.onChange(!props.checked);
				}
			});
		}
		function uiPill(props) {
			if (P.Pill) return e(P.Pill, {
				active: !!props.active,
				title: props.title,
				onClick: props.onClick
			}, props.children);
			return e("button", {
				type: "button",
				className: "dts-pill",
				"aria-pressed": props.active ? "true" : "false",
				title: props.title,
				onClick: props.onClick
			}, props.children);
		}
		/** 状态点：官方 StateDot 的 prop 是 `state`（done/warning/error/idle/ongoing）。 */
		function uiStateDot(props) {
			if (P.StateDot) return e(P.StateDot, { state: props.state });
			return e("span", {
				"aria-hidden": "true",
				className: "dts-dot",
				"data-state": props.state
			});
		}
		/**
		* Tooltip 的 children 必须能接 ref ⇒ 只包原生元素；
		* 包官方控件时先套一层 span，避免 ref 转发告警与错位。
		*/
		function uiTooltip(label, child) {
			if (!P.Tooltip || !label) return child;
			try {
				return e(P.Tooltip, {
					label,
					side: "top"
				}, child);
			} catch (err) {
				return child;
			}
		}
		function wrapForTooltip(label, element) {
			return uiTooltip(label, e("span", { className: "dts-btnwrap" }, element));
		}
		//#endregion
		//#region src/client/tabs.ts
		/**
		* 面板图标。导航项图标无法自定义（ui-settings-general 的 navIcon 是硬编码表，
		* settings.section 注册项也没有 icon 字段），所以只画在标题与浮动按钮上。
		*/
		var ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 1.9a6.1 6.1 0 1 0 0 12.2c1 0 1.6-.7 1.6-1.5 0-.4-.2-.7-.4-1-.2-.3-.3-.5-.3-.9 0-.8.6-1.4 1.5-1.4h1.2a2.5 2.5 0 0 0 2.5-2.5c0-2.7-2.6-4.9-6.1-4.9Z\"/><circle cx=\"4.6\" cy=\"6.6\" r=\".95\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"7.6\" cy=\"4.4\" r=\".95\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"10.9\" cy=\"6.2\" r=\".95\" fill=\"currentColor\" stroke=\"none\"/></svg>";
		function Svg() {
			return e("span", {
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
				out.push(child.key === null || child.key === void 0 ? React.cloneElement(child, { key: "k" + i }) : child);
			}
			return out;
		}
		function Group(props) {
			return e("div", { className: "dts-group" }, props.title ? e("h4", null, props.title) : null, keyed(props.children), props.hint ? e("p", { className: "dts-hint" }, props.hint) : null);
		}
		function Row(props) {
			return e("div", { className: "dts-row" }, e("label", null, props.label), e("div", { style: { minWidth: 0 } }, keyed(props.children)), props.tail ? e("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 6
			} }, keyed(props.tail)) : null);
		}
		function Slider(props) {
			return e("div", { className: "dts-range" }, e("input", {
				type: "range",
				min: props.min,
				max: props.max,
				step: props.step === void 0 ? 1 : props.step,
				value: props.value,
				"aria-label": props.label,
				onChange: function(event) {
					props.onChange(Number(event.target.value));
				}
			}), e("output", null, props.format ? props.format(props.value) : props.value + (props.suffix || "")));
		}
		/**
		* 下拉选择（自绘）：原生 <select> 弹层是系统 UI，吃不到毛玻璃，主题里很突兀
		* （主人实测「选项这里没同步」）。弹层用设置弹窗同款毛玻璃自绘，质感全局统一。
		* 键盘契约对齐官方 Menu（ui-primitives/Menu.tsx 就地核验）：↑↓ wrap 移动、
		* Home/End 首尾、Enter/Space 选中、Esc/Shift+Tab 关闭并把焦点交还触发器、
		* Tab 确认当前项收起（“Tab settles like Enter”）。
		* ⚠️ 本组件有 hooks：调用一律 e(Choice, {…})，禁止直调（有回归锁）。
		*/
		function Choice(props) {
			var openState = useState(false);
			var open = openState[0], setOpen = openState[1];
			var activeState = useState(0);
			var active = activeState[0], setActive = activeState[1];
			var rootRef = useRef(null);
			var triggerRef = useRef(null);
			var options = props.options || [];
			var count = options.length;
			/** @type {any} 初值 null + 回调赋值：不标注会被 CFA 推断成 never。 */
			var current = null;
			options.forEach(function(option) {
				if (option.value === props.value) current = option;
			});
			function closeToTrigger(back) {
				setOpen(false);
				if (back && triggerRef.current && typeof triggerRef.current.focus === "function") triggerRef.current.focus();
			}
			function commitAt(index) {
				var option = options[index];
				if (!option) return;
				setOpen(false);
				if (option.value !== props.value) props.onChange(option.value);
			}
			function focusIndex(index) {
				setActive(index);
				var node = rootRef.current && typeof rootRef.current.querySelector === "function" ? rootRef.current.querySelector("[data-index=\"" + String(index) + "\"]") : null;
				if (node && typeof node.focus === "function") node.focus();
			}
			useEffect(function() {
				if (!open) return void 0;
				function onDocDown(event) {
					var node = rootRef.current;
					if (node && event.target && !node.contains(event.target)) setOpen(false);
				}
				document.addEventListener("mousedown", onDocDown);
				return function() {
					document.removeEventListener("mousedown", onDocDown);
				};
			}, [open]);
			function onRootKey(event) {
				if (!open) {
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						var from = 0;
						options.forEach(function(option, i) {
							if (option.value === props.value) from = i;
						});
						setActive(from);
						setOpen(true);
						window.setTimeout(function() {
							focusIndex(from);
						}, 0);
					}
					return;
				}
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					closeToTrigger(true);
					return;
				}
				if (event.key === "Tab") {
					if (event.shiftKey) {
						event.preventDefault();
						closeToTrigger(true);
					} else if (options[active]) commitAt(active);
					return;
				}
				if (count === 0) return;
				if (event.key === "ArrowDown") {
					event.preventDefault();
					focusIndex((active + 1) % count);
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					focusIndex((active - 1 + count) % count);
				} else if (event.key === "Home") {
					event.preventDefault();
					focusIndex(0);
				} else if (event.key === "End") {
					event.preventDefault();
					focusIndex(count - 1);
				} else if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					commitAt(active);
				}
			}
			return e("div", {
				className: "dts-select",
				ref: rootRef,
				onKeyDown: onRootKey
			}, e("button", {
				type: "button",
				className: "dts-input dts-select-trigger",
				"aria-haspopup": "listbox",
				"aria-expanded": open ? "true" : "false",
				"aria-label": props.label,
				title: current ? current.label : props.label,
				ref: triggerRef,
				onClick: function() {
					if (open) {
						closeToTrigger(false);
						return;
					}
					var from = 0;
					options.forEach(function(option, i) {
						if (option.value === props.value) from = i;
					});
					setActive(from);
					setOpen(true);
				}
			}, e("span", { className: "dts-select-text" }, current ? current.label : ""), e("span", {
				className: "dts-select-caret",
				"aria-hidden": "true"
			}, "⌄")), open ? e("div", {
				className: "dts-select-menu",
				role: "listbox",
				"aria-label": props.label
			}, options.map(function(option, index) {
				var selected = option.value === props.value;
				return e("button", {
					key: option.value,
					type: "button",
					role: "option",
					"data-index": String(index),
					"aria-selected": selected ? "true" : "false",
					className: "dts-select-option",
					"data-selected": selected ? "true" : "false",
					onFocus: function() {
						setActive(index);
					},
					onClick: function() {
						commitAt(index);
					}
				}, option.label);
			})) : null);
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
			return e("div", { className: "dts-color" }, e("input", {
				type: "color",
				value: value === "" ? "#808080" : toHex(value),
				"aria-label": props.label,
				onChange: function(event) {
					props.onChange(event.target.value);
				}
			}), uiInput({
				className: "dts-input",
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
		* 官方 Input 的 className 落外层 wrapper、其余属性透传给内层 input（Input.tsx），
		* 直接把 style 透进去只作用到内层、flex 布局吃不到 —— 包一层承接布局样式。
		*/
		function uiInput(props) {
			if (P.Input) {
				var inner = Object.assign({}, props);
				delete inner.style;
				return e("span", {
					className: "dts-input-flex",
					style: props.style
				}, e(P.Input, inner));
			}
			return e("input", props);
		}
		/** 确认框：Esc = 取消，Enter = 确认，焦点落在最后一个（确认）按钮上。 */
		function ConfirmDialog(props) {
			var cardRef = useRef(null);
			useEffect(function() {
				var onKey = function(event) {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						props.onDone(false);
					} else if (event.key === "Enter") {
						event.preventDefault();
						props.onDone(true);
					} else if (event.key === "Tab") {
						event.preventDefault();
						var nodes = cardRef.current && typeof cardRef.current.querySelectorAll === "function" ? Array.prototype.slice.call(cardRef.current.querySelectorAll("button")) : [];
						if (nodes.length === 0) return;
						var at = nodes.indexOf(document.activeElement);
						var nextAt = event.shiftKey ? at <= 0 ? nodes.length - 1 : at - 1 : at === nodes.length - 1 || at === -1 ? 0 : at + 1;
						if (typeof nodes[nextAt].focus === "function") nodes[nextAt].focus();
					}
				};
				document.addEventListener("keydown", onKey, true);
				var timer = setTimeout(function() {
					var buttons = cardRef.current ? cardRef.current.querySelectorAll("button") : [];
					var last = buttons[buttons.length - 1];
					if (last && last.focus) last.focus();
				}, 30);
				return function() {
					document.removeEventListener("keydown", onKey, true);
					clearTimeout(timer);
				};
			}, []);
			return e("div", {
				className: "dts-scrim",
				onClick: function(event) {
					if (event.target === event.currentTarget) props.onDone(false);
				}
			}, e("div", {
				className: "dts-dialog",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": props.title,
				ref: cardRef
			}, e("h3", null, props.title), (props.lines || []).filter(function(line) {
				return line !== "";
			}).map(function(line, index) {
				return e("div", {
					key: index,
					className: "dts-dialog-line",
					"data-kind": /[\\/]/.test(line) ? "path" : "text"
				}, line);
			}), e("div", { className: "dts-dialog-foot" }, uiButton({
				variant: "ghost",
				onClick: function() {
					props.onDone(false);
				},
				children: props.cancelLabel
			}), uiButton({
				variant: props.tone === "danger" ? "danger" : "primary",
				onClick: function() {
					props.onDone(true);
				},
				children: props.confirmLabel
			}))));
		}
		function FocusPad(props) {
			var boxRef = useRef(null);
			function pick(event) {
				var box = boxRef.current;
				if (box === null) return;
				var rect = box.getBoundingClientRect();
				props.onChange(Math.round(clamp((event.clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100)), Math.round(clamp((event.clientY - rect.top) / Math.max(1, rect.height) * 100, 0, 100)));
			}
			return e("div", {
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
					if (event.buttons === 1) pick(event);
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
			return e("div", { className: "dts-body" }, Group({
				title: tt("base.scheme"),
				hint: tt("base.hint"),
				children: [Row({
					label: tt("base.scheme"),
					children: e(Choice, {
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
					children: Slider({
						label: tt("base.fontSize"),
						min: 12,
						max: 17,
						value: doc.base.fontSize,
						suffix: "px",
						onChange: function(value) {
							env.patch(function(d) {
								d.base.fontSize = value;
							});
						}
					})
				})]
			}), Group({
				title: tt("tab.presets"),
				hint: tt("preset.note"),
				children: e("div", { className: "dts-swatches" }, presets.map(function(preset) {
					var art = preset.accent === "" ? "linear-gradient(135deg,#f5f6f7,#dfe3e8)" : gradientThumb(preset.gradient);
					return e("button", {
						key: preset.id,
						type: "button",
						className: "dts-swatch",
						"aria-pressed": doc.preset === preset.id ? "true" : "false",
						onClick: function() {
							env.applyPreset(preset.id);
						}
					}, e("span", {
						className: "dts-swatch-art",
						style: {
							background: art,
							boxShadow: preset.accent === "" ? void 0 : "inset 0 -3px 0 0 " + preset.accent
						}
					}), e("span", { className: "dts-swatch-name" }, preset.name), e("span", { className: "dts-swatch-note" }, preset.note || preset.id));
				}))
			}));
		}
		function Uploader(props) {
			var env = props.env, tt = props.t;
			var inputRef = useRef(null);
			var hot = useState(false);
			var busy = useState("");
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
						return env.upload(file).then(function() {
							done += 1;
						}, function(error) {
							env.notify(tt("common.failed") + "：" + String(error.message || error), "error");
						});
					});
				}, Promise.resolve()).then(function() {
					busy[1]("");
					if (done > 0) env.notify(tt("common.uploaded") + " ×" + done, "ok");
				});
			}
			return e("div", null, e("div", {
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
			}, busy[0] === "uploading" ? tt("common.uploading") : tt("common.dropHere")), e("input", {
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
			function range(labelKey, min, max, field, suffix, step, format) {
				return Row({
					label: tt(labelKey),
					children: Slider({
						label: tt(labelKey),
						min,
						max,
						value: b[field],
						suffix,
						step: step === void 0 ? suffix ? 1 : .05 : step,
						format,
						onChange: function(v) {
							set(field, v);
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
			return e("div", { className: "dts-body" }, Group({
				title: tt("backdrop.mode"),
				hint: tt("backdrop.hint"),
				children: [
					Row({
						label: tt("backdrop.mode"),
						children: e(Choice, {
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
					isMedia ? options.length === 1 ? e("p", {
						className: "dts-note",
						"data-tone": "warn"
					}, tt("common.empty")) : Row({
						label: tt("backdrop.pick"),
						children: e(Choice, {
							label: tt("backdrop.pick"),
							value: b.mediaId,
							options,
							onChange: function(v) {
								set("mediaId", v);
							}
						})
					}) : null,
					b.mode === "gradient" ? e("div", { className: "dts-swatches" }, Object.keys(env.state.gradients || {}).map(function(name) {
						var gradient = env.state.gradients[name];
						return e("button", {
							key: name,
							type: "button",
							className: "dts-swatch",
							"aria-pressed": b.gradient === name ? "true" : "false",
							onClick: function() {
								set("gradient", name);
							}
						}, e("span", {
							className: "dts-swatch-art",
							style: { background: gradientThumb(name, gradient) }
						}), e("span", { className: "dts-swatch-name" }, gradient.label || name));
					})) : null,
					isMedia ? e(Uploader, {
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
						children: e(Choice, {
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
					range("backdrop.scale", .5, 4, "scale", "", .05, function(v) {
						return Math.round(v * 100) / 100 + "×";
					}),
					Row({
						label: tt("backdrop.focus"),
						tail: e("span", { className: "dts-card-meta" }, "X " + b.focusX + "% · Y " + b.focusY + "%"),
						children: e(FocusPad, {
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
					}),
					e("p", { className: "dts-hint" }, tt("backdrop.focusHint"))
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
						children: Slider({
							label: tt("backdrop.dim"),
							min: 0,
							max: .95,
							step: .01,
							value: b.dim,
							format: function(v) {
								return Math.round(v * 100) + "%";
							},
							onChange: function(v) {
								set("dim", v);
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
						tail: Slider({
							label: tt("backdrop.kenBurnsSeconds"),
							min: 8,
							max: 240,
							step: 2,
							value: b.kenBurnsSeconds,
							format: function(v) {
								return v + "s";
							},
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
						children: Slider({
							label: tt("backdrop.playbackRate"),
							min: .25,
							max: 2,
							step: .05,
							value: b.video.playbackRate,
							format: function(v) {
								return Math.round(v * 100) / 100 + "×";
							},
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
					Row({
						label: tt("glass.alpha"),
						children: Slider({
							label: tt("glass.alpha"),
							min: .15,
							max: 1,
							step: .01,
							value: doc.glass.alpha,
							format: function(v) {
								return Math.round(v * 100) + "%";
							},
							onChange: function(v) {
								env.patch(function(d) {
									d.glass.alpha = v;
								});
							}
						})
					}),
					Row({
						label: tt("glass.blur"),
						children: Slider({
							label: tt("glass.blur"),
							min: 0,
							max: 60,
							value: doc.glass.blur,
							suffix: "px",
							onChange: function(v) {
								env.patch(function(d) {
									d.glass.blur = v;
								});
							}
						})
					}),
					Row({
						label: tt("glass.saturate"),
						children: Slider({
							label: tt("glass.saturate"),
							min: 100,
							max: 300,
							step: 5,
							value: doc.glass.saturate,
							suffix: "%",
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
			return e("div", { className: "dts-body" }, e(Uploader, {
				env,
				t: tt,
				accept: "image/*,video/*,.woff,.woff2,.ttf,.otf"
			}), list.length === 0 ? e("p", { className: "dts-note" }, tt("common.empty")) : e("div", { className: "dts-library" }, list.map(function(item) {
				var active = doc.backdrop.mediaId === item.id;
				return e("div", {
					key: item.id,
					className: "dts-card"
				}, item.kind === "video" ? e("video", {
					className: "dts-thumb",
					src: env.mediaUrl(item),
					muted: true,
					playsInline: true,
					preload: "metadata"
				}) : item.kind === "font" ? e("div", {
					className: "dts-thumb",
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 22
					}
				}, "Ag 字") : e("img", {
					className: "dts-thumb",
					src: env.mediaUrl(item),
					alt: item.name,
					loading: "lazy",
					decoding: "async"
				}), e("div", { className: "dts-card-body" }, e("div", {
					className: "dts-card-name",
					title: item.name
				}, item.name), e("div", { className: "dts-card-meta" }, item.kind + " · " + humanBytes(item.bytes) + (item.width ? " · " + item.width + "×" + item.height : ""))), e("div", { className: "dts-card-actions" }, item.kind === "font" ? uiButton({
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
			var level = ratio >= 7 ? "ok" : ratio >= 4.5 ? "" : "bad";
			return e("div", { className: "dts-contrast" }, e("span", null, props.t("color.contrast")), e("span", {
				className: "dts-badge",
				"data-level": level
			}, Math.round(ratio * 100) / 100 + ":1"));
		}
		function ColorTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var groups = env.state.tokenGroups || [];
			var filter = useState("");
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
			return e("div", { className: "dts-body" }, Group({
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
				children: e("div", { style: {
					display: "flex",
					flexDirection: "column",
					gap: 10
				} }, e("div", { style: {
					display: "flex",
					gap: 8,
					alignItems: "center"
				} }, e("input", {
					className: "dts-input",
					placeholder: "--dsw-…",
					value: filter[0],
					"aria-label": tt("color.groups"),
					onChange: function(event) {
						filter[1](event.target.value.trim());
					}
				}), ContrastReadout({
					env,
					t: tt,
					scheme
				})), groups.map(function(group) {
					var rows = group.tokens.filter(function(item) {
						if (filter[0] === "") return true;
						return item.name.indexOf(filter[0]) >= 0 || String(item.label || "").indexOf(filter[0]) >= 0;
					});
					if (rows.length === 0) return null;
					return e("div", { key: group.id }, e("h4", {
						className: "dts-card-meta",
						style: { margin: "8px 0 6px" }
					}, group.label), rows.map(function(item) {
						var pair = tokens[item.name];
						return e("div", {
							key: item.name,
							className: "dts-token-row",
							style: { marginBottom: 6 }
						}, e("div", {
							className: "dts-token-name",
							title: item.name
						}, item.label || item.name), e("div", { className: "dts-pair" }, e("span", { className: "dts-pair-label" }, tt("color.light")), ColorField({
							label: item.name + " " + tt("color.light"),
							value: pair && pair.light || "",
							clearLabel: tt("color.clear"),
							onChange: function(v) {
								setValue(item.name, "light", v);
							}
						})), e("div", { className: "dts-pair" }, e("span", { className: "dts-pair-label" }, tt("color.dark")), ColorField({
							label: item.name + " " + tt("color.dark"),
							value: pair && pair.dark || "",
							clearLabel: tt("color.clear"),
							onChange: function(v) {
								setValue(item.name, "dark", v);
							}
						})), e("span", {
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
				}), e("div", { style: {
					display: "flex",
					flexDirection: "column",
					gap: 6,
					marginTop: 6
				} }, extras.map(function(name) {
					return e("div", {
						key: name,
						className: "dts-token-row"
					}, e("div", {
						className: "dts-token-name",
						title: name
					}, name), e("div", { className: "dts-pair" }, e("span", { className: "dts-pair-label" }, tt("color.light")), ColorField({
						label: name + " " + tt("color.light"),
						value: tokens[name].light || "",
						clearLabel: "×",
						onChange: function(v) {
							setValue(name, "light", v);
						}
					})), e("div", { className: "dts-pair" }, e("span", { className: "dts-pair-label" }, tt("color.dark")), ColorField({
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
				}), e(CustomTokenAdder, {
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
		*/
		function CustomTokenAdder(props) {
			var env = props.env, tt = props.t;
			var draft = useState("");
			function add() {
				var name = String(draft[0] || "").trim();
				if (name === "") return;
				props.onAdd(name);
				draft[1]("");
			}
			return e("div", { style: {
				display: "flex",
				gap: 8,
				alignItems: "center"
			} }, e("input", {
				className: "dts-input",
				placeholder: tt("color.customName"),
				value: draft[0],
				list: "dts-token-list",
				"aria-label": tt("color.custom"),
				spellCheck: false,
				onChange: function(event) {
					draft[1](event.target.value);
				},
				onKeyDown: function(event) {
					if (event.key === "Enter") {
						event.preventDefault();
						add();
					}
				}
			}), uiButton({
				variant: "ghost",
				onClick: add,
				children: tt("color.customAdd")
			}), e("datalist", { id: "dts-token-list" }, env.tokenNames().slice(0, 600).map(function(name) {
				return e("option", {
					key: name,
					value: name
				});
			})));
		}
		function TypeTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var families = doc.type.families || [];
			return e("div", { className: "dts-body" }, Group({
				title: tt("type.uiFont"),
				hint: tt("type.hint"),
				children: [
					Row({
						label: tt("type.uiFont"),
						children: e("input", {
							className: "dts-input",
							value: doc.type.uiFont,
							spellCheck: false,
							"aria-label": tt("type.uiFont"),
							onChange: function(event) {
								env.patch(function(d) {
									d.type.uiFont = event.target.value;
								});
							}
						})
					}),
					Row({
						label: tt("type.codeFont"),
						children: e("input", {
							className: "dts-input",
							value: doc.type.codeFont,
							spellCheck: false,
							"aria-label": tt("type.codeFont"),
							onChange: function(event) {
								env.patch(function(d) {
									d.type.codeFont = event.target.value;
								});
							}
						})
					}),
					Row({
						label: tt("type.letterSpacing"),
						children: Slider({
							label: tt("type.letterSpacing"),
							min: -1,
							max: 4,
							step: .05,
							value: doc.type.letterSpacing,
							format: function(v) {
								return Math.round(v * 100) / 100 + "em";
							},
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
				children: e(Uploader, {
					env,
					t: tt,
					accept: ".woff,.woff2,.ttf,.otf,font/*"
				})
			}), families.length > 0 ? Group({
				title: tt("type.families"),
				children: families.map(function(family) {
					return e("div", {
						key: family.id,
						className: "dts-token-row"
					}, e("div", {
						className: "dts-token-name",
						title: family.family
					}, family.family), e("div", { style: {
						fontSize: 15,
						fontFamily: "\"" + family.family + "\", var(--dsw-font-family,inherit)"
					} }, "永字八法 AaBb 0123 " + (family.weight || 400)), e("div", null), e("div", { style: {
						display: "flex",
						gap: 4
					} }, uiPill({
						active: doc.type.uiFont.indexOf(family.family) >= 0,
						onClick: function() {
							env.patch(function(d) {
								d.type.uiFont = "\"" + family.family + "\", " + (d.type.uiFont || "sans-serif");
							});
						},
						children: tt("type.useFamily")
					}), uiPill({
						active: doc.type.codeFont.indexOf(family.family) >= 0,
						onClick: function() {
							env.patch(function(d) {
								d.type.codeFont = "\"" + family.family + "\", monospace";
							});
						},
						children: tt("type.useCodeFamily")
					})));
				})
			}) : null);
		}
		function ShapeTab(props) {
			var env = props.env, tt = props.t, s = props.doc.shape;
			return e("div", { className: "dts-body" }, Group({
				title: tt("tab.shape"),
				hint: tt("shape.cornerHint"),
				children: [
					Row({
						label: tt("shape.corner"),
						children: Slider({
							label: tt("shape.corner"),
							min: 1,
							max: 3,
							step: .05,
							value: s.cornerShape,
							format: function(v) {
								return "superellipse(" + Math.round(v * 100) / 100 + ")";
							},
							onChange: function(v) {
								env.patch(function(d) {
									d.shape.cornerShape = v;
								});
							}
						})
					}),
					Row({
						label: tt("shape.motion"),
						children: Slider({
							label: tt("shape.motion"),
							min: 0,
							max: 4,
							step: .1,
							value: s.motionSpeed,
							format: function(v) {
								return v === 0 ? "off" : Math.round(v * 100) / 100 + "×";
							},
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
						children: e(Choice, {
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
			var nameState = useState("");
			var rowsState = useState(null);
			var activeState = useState("");
			function refresh() {
				return env.api.themes().then(function(value) {
					rowsState[1](value);
				}, function() {});
			}
			useEffect(function() {
				refresh();
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
			return e("div", { className: "dts-body" }, Group({
				title: tt("tab.profile"),
				hint: tt("profile.hint"),
				children: e("div", { style: {
					display: "flex",
					gap: 8
				} }, e("input", {
					className: "dts-input",
					value: nameState[0],
					placeholder: tt("profile.namePh"),
					"aria-label": tt("profile.namePh"),
					onChange: function(event) {
						nameState[1](event.target.value);
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
			}), rows === null ? e("p", { className: "dts-hint" }, tt("profile.hint")) : rows.length === 0 ? e("p", { className: "dts-hint" }, tt("profile.empty")) : e("div", { className: "dts-profile-list" }, rows.map(function(row) {
				var on = activeState[0] !== "" && (row.name === activeState[0] || row.slug === activeState[0]);
				return e("div", {
					key: row.slug,
					className: "dts-token-row dts-profile-row",
					"data-active": on ? "true" : void 0
				}, e("div", {
					className: "dts-token-name",
					title: row.slug
				}, row.accent ? e("span", {
					className: "dts-profile-dot",
					style: { background: row.accent }
				}) : null, (row.name || row.slug) + (on ? " ✓" : "")), e("div", { className: "dts-hint" }, metaOf(row)), e("div", { style: {
					display: "flex",
					gap: 4,
					flexWrap: "wrap",
					justifyContent: "flex-end"
				} }, uiButton({
					variant: "primary",
					size: "sm",
					disabled: on,
					onClick: function() {
						apply(row);
					},
					children: tt("profile.apply")
				}), uiButton({
					variant: "ghost",
					size: "sm",
					onClick: function() {
						saveAs(row.name || row.slug, true);
					},
					children: tt("profile.overwrite")
				}), uiButton({
					variant: "ghost",
					size: "sm",
					onClick: function() {
						remove(row);
					},
					children: tt("profile.del")
				})));
			})));
		}
		function AdvancedTab(props) {
			var env = props.env, tt = props.t, doc = props.doc;
			var usageState = useState(null);
			useEffect(function() {
				var alive = true;
				env.api.usage().then(function(value) {
					if (alive) usageState[1](value);
				}, function() {});
				return function() {
					alive = false;
				};
			}, []);
			return e("div", { className: "dts-body" }, Group({
				title: tt("adv.css"),
				hint: tt("adv.cssHint"),
				children: e("textarea", {
					className: "dts-input dts-textarea",
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
				children: e("div", { style: {
					display: "flex",
					gap: 8,
					flexWrap: "wrap",
					alignItems: "center"
				} }, e("a", {
					className: "dts-btn",
					href: env.api.exportUrl(),
					download: "dsh-theme.json"
				}, tt("adv.export")), e("label", {
					className: "dts-btn",
					style: { cursor: "pointer" }
				}, tt("adv.import"), e("input", {
					type: "file",
					accept: "application/json,.json",
					hidden: true,
					onChange: function(event) {
						var file = event.target.files && event.target.files[0];
						event.target.value = "";
						if (!file) return;
						file.text().then(function(text) {
							return env.api.importDoc(JSON.parse(text));
						}).then(function(projection) {
							env.accept(projection);
							env.notify(tt("common.saved"), "ok");
						}, function(error) {
							env.notify(tt("common.failed") + "：" + String(error.message || error), "error");
						});
					}
				})))
			}), usageState[0] ? Group({
				title: tt("adv.usage"),
				children: e("p", { className: "dts-hint" }, String(usageState[0].files) + " files · " + humanBytes(usageState[0].bytes))
			}) : null);
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
		function ThemeStudioApp(props) {
			var env = props.env, tt = props.t;
			var state = useSlice(env.engine);
			var isModal = typeof props.onRequestClose === "function";
			var tabState = useState(readLocal("dts:active-tab") || "presets");
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
			function onTabKey(event, index) {
				var group = event.currentTarget && event.currentTarget.parentElement;
				var tabs = group && typeof group.querySelectorAll === "function" ? group.querySelectorAll(".dts-tab") : [];
				var count = tabs.length;
				if (count === 0) return;
				var next = -1;
				if (event.key === "ArrowRight") next = (index + 1) % count;
				else if (event.key === "ArrowLeft") next = (index - 1 + count) % count;
				else if (event.key === "Home") next = 0;
				else if (event.key === "End") next = count - 1;
				else if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					chooseTab(TABS[index].id);
					return;
				}
				if (next >= 0) {
					event.preventDefault();
					var node = tabs[next];
					if (node && typeof node.focus === "function") node.focus();
				}
			}
			var tree = e("div", {
				className: "dts-panel",
				"data-variant": isModal ? "modal" : "page"
			}, e("div", { className: "dts-head" }, e("h3", { className: "dts-title" }, Svg(), tt("section.title")), wrapForTooltip(tt("common.fullscreen"), uiButton({
				variant: "ghost",
				onClick: function() {
					env.toggleFullscreen();
				},
				children: "⤢"
			})), uiButton({
				variant: "ghost",
				onClick: function() {
					env.askReset();
				},
				children: tt("common.reset")
			}), isModal ? uiButton({
				variant: "ghost",
				onClick: function() {
					props.onRequestClose();
				},
				children: tt("common.close")
			}) : null, e("span", {
				className: "dts-status",
				"data-state": state.status === "error" ? "error" : "idle"
			}, uiStateDot({ state: statusDot }), statusLabel)), e("div", {
				className: "dts-tabs",
				role: "tablist"
			}, TABS.map(function(item, index) {
				return e("button", {
					key: item.id,
					type: "button",
					role: "tab",
					className: "dts-tab",
					"aria-selected": active === item.id ? "true" : "false",
					tabIndex: active === item.id ? 0 : -1,
					onKeyDown: function(event) {
						onTabKey(event, index);
					},
					onClick: function() {
						chooseTab(item.id);
					}
				}, tt(item.key));
			})), state.status === "error" && state.doc === null ? e("p", {
				className: "dts-note",
				"data-tone": "error"
			}, state.error || tt("common.failed")) : null, state.doc ? e("div", {
				role: "tabpanel",
				key: active
			}, e(Current, {
				env,
				t: tt,
				doc: state.doc
			})) : null, state.dialog ? e(ConfirmDialog, {
				title: state.dialog.title,
				lines: state.dialog.lines,
				confirmLabel: state.dialog.confirmLabel,
				cancelLabel: state.dialog.cancelLabel,
				tone: state.dialog.tone,
				onDone: function(answer) {
					env.answerDialog(answer);
				}
			}) : null);
			if (!isModal) return tree;
			return e("div", {
				className: "dts-modal-mask",
				onClick: function(event) {
					if (event.target === event.currentTarget) props.onRequestClose();
				}
			}, e("div", {
				className: "dts-modal-card",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": tt("section.title"),
				onKeyDown: function(event) {
					if (event.key !== "Tab") return;
					var card = event.currentTarget;
					var nodes = typeof card.querySelectorAll === "function" ? Array.prototype.slice.call(card.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])")) : [];
					if (nodes.length === 0) return;
					var at = nodes.indexOf(document.activeElement);
					var nextAt = event.shiftKey ? at <= 0 ? nodes.length - 1 : at - 1 : at === nodes.length - 1 || at === -1 ? 0 : at + 1;
					event.preventDefault();
					if (typeof nodes[nextAt].focus === "function") nodes[nextAt].focus();
				}
			}, tree));
		}
		/** 语言变化后设置页条目要用新文案重新注册，这里给一个不依赖 slot 的兜底行。 */
		function ThemeStudioGeneralRow(props) {
			var env = props.env, tt = props.t;
			return e("div", { className: "dts-row" }, e("label", null, tt("section.title")), uiButton({
				variant: "ghost",
				onClick: function() {
					env.openModal();
				},
				children: tt("common.openPanel")
			}));
		}
		/**
		* Cordis 入口。
		* @param {import('@deepseek-ai/cordis').Context} ctx
		*/
		function apply(ctx) {
			var boot = window.__DTS_BOOT__ || {};
			var prefix = typeof boot.prefix === "string" && boot.prefix !== "" ? boot.prefix : DEFAULT_PREFIX;
			var writeToken = typeof boot.writeToken === "string" ? boot.writeToken : "";
			var probe = createTokenProbe();
			var layer = createLayerManager();
			var commitTimer = 0;
			var lastAppliedRevision = -1;
			var dialogAnswer = null;
			var styles = [];
			/**
			* 跨组件重建保留的未保存草稿：换语言时官方契约要求用新文案重新注册设置页条目，
			* 重新注册会卸载并重建组件 —— 草稿只活在组件里就会跟着丢。
			*/
			var draft = null;
			/** locale 是可选依赖：接上模块级句柄，取不到就走降级链（不声明进 inject）。 */
			setLocaleService(typeof ctx.get === "function" ? ctx.get("locale") ?? null : ctx.locale ?? null);
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
				if (!projection || !projection.doc) return;
				prefix = projection.prefix || prefix;
				if (typeof projection.writeToken === "string" && projection.writeToken !== "") writeToken = projection.writeToken;
				var doc = projection.doc;
				var pairs = fillTokenPairs(projection.tokenLayers || {}, probe);
				var surfaces = (projection.glassSurfaces || []).slice();
				EXTRA_GLASS_SURFACES.forEach(function(name) {
					if (surfaces.indexOf(name) === -1) surfaces.push(name);
				});
				var glass = composeGlass(surfaces, doc, probe, doc.palette.tokens || {});
				var merged = Object.assign({}, glass, pairs);
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
				fixFabContrast(document.getElementById(FAB_ID));
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
			function commit() {
				if (draft === null) return;
				var inflight = draft;
				api.saveDoc(inflight.doc, inflight.baseRevision).then(function(projection) {
					if (draft === inflight) {
						draft = null;
						accept(projection);
						return;
					}
					if (draft !== null) draft.baseRevision = projection.revision;
					accept(projection);
					scheduleCommit();
				}, function(error) {
					engine.update({
						status: "error",
						error: String(error.message || error)
					});
					if (error.status === 409 || error.status === 401) {
						draft = null;
						reload();
					}
				});
			}
			function reload() {
				return api.getState().then(accept, function(error) {
					var message = error && error.status === 401 ? t("err.writeToken") : error && error.status ? String(error.message || error) : t("err.offline");
					engine.update({
						status: "error",
						error: message
					});
				});
			}
			function openDialog(spec) {
				return new Promise(function(resolve) {
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
					draft = null;
					return api.saveDoc({}).then(accept, function(error) {
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
			var noticeTimer = 0;
			var noticeEl = null;
			var toastHost = null;
			var toastRoot = null;
			function notify(message, tone) {
				if (!message) return;
				if (P.Toast && ReactDOMClient && typeof ReactDOMClient.createRoot === "function") try {
					if (toastHost === null || !document.body.contains(toastHost)) {
						toastHost = document.createElement("div");
						toastHost.id = "dts-toast-host";
						document.body.appendChild(toastHost);
						toastRoot = ReactDOMClient.createRoot(toastHost);
					}
					toastRoot.render(e(P.Toast, {
						text: message,
						tone: tone === "error" ? void 0 : "success",
						holdMs: tone === "error" ? 4200 : void 0,
						onDone: function() {
							try {
								toastRoot.render(null);
							} catch (err) {}
						}
					}));
					return;
				} catch (err) {}
				if (noticeEl === null || !document.body.contains(noticeEl)) {
					noticeEl = document.createElement("div");
					noticeEl.id = "dts-notice";
					noticeEl.setAttribute("role", "status");
					noticeEl.className = "dts-note";
					noticeEl.style.cssText = "position:fixed;right:16px;bottom:58px;z-index:2147482002;max-width:60vw;word-break:break-word;padding:7px 12px;border-radius:10px;font-size:12.5px;background:var(--dsw-alias-toast-bg,#151517);color:var(--dsw-alias-label-primary-inverted,#fff);box-shadow:var(--dsw-elevation-prominent,0 3px 8px rgba(0,0,0,.04));transition:opacity .25s var(--ds-ease-in-out,ease)";
					document.body.appendChild(noticeEl);
				}
				noticeEl.textContent = message;
				noticeEl.setAttribute("data-tone", tone === "error" ? "error" : "ok");
				noticeEl.style.opacity = "1";
				window.clearTimeout(noticeTimer);
				noticeTimer = window.setTimeout(function() {
					if (noticeEl !== null) noticeEl.style.opacity = "0";
				}, tone === "error" ? 5200 : 2400);
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
					img.addEventListener("load", function() {
						try {
							var size = 32;
							var canvas = document.createElement("canvas");
							canvas.width = size;
							canvas.height = size;
							var c2d = canvas.getContext("2d");
							if (c2d === null) {
								resolve(null);
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
								resolve(null);
								return;
							}
							resolve(hslToHex(best.h, clamp(best.s, 45, 88), clamp(best.l < 24 ? 52 : best.l, 34, 62)));
						} catch (err) {
							resolve(null);
						}
					});
					img.addEventListener("error", function() {
						resolve(null);
					});
					img.src = url;
				});
			}
			var modalHost = null;
			var modalRoot = null;
			/** 打开模态前记住焦点所在，关闭时归还，不让焦点掉回 body。 */
			var lastFocused = null;
			/** 碰撞检测 interval 句柄：0 = 未启动。单所有者，start/stop 幂等。 */
			var fabTimer = 0;
			/**
			* 只在几何上确实与聊天输入区抢右下角时才让位。
			* 判定只看"主输入框有没有伸进视口底部这条带子"：
			* 新会话输入框居中（离底远）⇒ 按钮常显；有对话时输入区延伸到底部 ⇒ 隐藏。
			* 不用 dsh 的内部 class（哈希会变），也不猜祖先容器宽度。
			*/
			function pokeFabCollision() {
				var BOTTOM_ZONE = 200;
				var fab = document.getElementById(FAB_ID);
				if (!fab) return;
				var collide = false;
				try {
					var nodes = document.querySelectorAll("[contenteditable], textarea");
					for (var i = 0; i < nodes.length; i += 1) {
						var rect = nodes[i].getBoundingClientRect();
						if (rect.width === 0 || rect.height === 0) continue;
						if (rect.width < window.innerWidth * .5) continue;
						if (rect.bottom > window.innerHeight - BOTTOM_ZONE) {
							collide = true;
							break;
						}
					}
				} catch (err) {}
				var next = collide ? "true" : "false";
				if (fab.getAttribute("data-hidden") !== next) fab.setAttribute("data-hidden", next);
			}
			function startFabCollision() {
				pokeFabCollision();
				if (fabTimer !== 0) return;
				fabTimer = setInterval(pokeFabCollision, 500);
			}
			function stopFabCollision() {
				if (fabTimer === 0) return;
				clearInterval(fabTimer);
				fabTimer = 0;
			}
			/**
			* FAB 图标对比自愈：图标走 currentColor（= label-primary）、背景是
			* button-elevated-fill —— 主题把两者调成同色时按钮整个隐形（实测白底白图标）。
			* 按背景亮度二值定图标深浅，任何主题下都保底可见。
			*/
			function fixFabContrast(fab) {
				if (!fab) return;
				try {
					var bg = getComputedStyle(fab).backgroundColor;
					if (typeof bg !== "string" || bg === "") return;
					fab.style.color = relativeLuminance(bg) < .36 ? "#ffffff" : "#101418";
				} catch (err) {}
			}
			function setFabLabel(fab) {
				if (!fab) return;
				fab.title = t("section.title");
				fab.setAttribute("aria-label", t("section.title"));
			}
			function mountFab() {
				ensureChromeStyle();
				var existing = document.getElementById(FAB_ID);
				if (existing !== null) {
					setFabLabel(existing);
					fixFabContrast(existing);
					startFabCollision();
					return;
				}
				var fab = document.createElement("button");
				fab.id = FAB_ID;
				fab.className = "dts-fab";
				fab.type = "button";
				fab.innerHTML = ICON;
				setFabLabel(fab);
				fixFabContrast(fab);
				fab.addEventListener("click", function() {
					openModal();
				});
				document.body.appendChild(fab);
				startFabCollision();
			}
			function openModal() {
				if (document.getElementById("dts-modal-host") !== null) return;
				ensureChromeStyle();
				lastFocused = document.activeElement || null;
				modalHost = document.createElement("div");
				modalHost.id = MODAL_HOST_ID;
				document.body.appendChild(modalHost);
				try {
					if (ReactDOMClient && typeof ReactDOMClient.createRoot === "function") modalRoot = ReactDOMClient.createRoot(modalHost);
					else {
						var ReactDOM = require("react-dom");
						modalRoot = {
							render: function(node) {
								ReactDOM.render(node, modalHost);
							},
							unmount: function() {
								ReactDOM.unmountComponentAtNode(modalHost);
							}
						};
					}
					modalRoot.render(e(ThemeStudioApp, {
						env,
						t: tt,
						onRequestClose: closeModal
					}));
					focusIntoModal();
				} catch (err) {
					console.warn("[dsh-theme-studio] 模态渲染失败：", err);
					closeModal();
				}
			}
			/**
			* 打开时把焦点移进模态：只声明 aria-modal 而不接管焦点，Tab 仍会跑到
			* 遮罩背后的界面上。取不到焦点就跳过，不阻断鼠标操作 —— 降级而非抛错。
			*/
			function focusIntoModal() {
				try {
					if (modalHost === null || typeof modalHost.querySelector !== "function") return;
					var target = modalHost.querySelector("input, button, select, textarea, [tabindex]");
					if (target !== null && typeof target.focus === "function") target.focus();
				} catch (err) {}
			}
			function closeModal() {
				if (modalRoot !== null) {
					try {
						modalRoot.unmount();
					} catch (err) {}
					modalRoot = null;
				}
				if (modalHost !== null) modalHost.remove();
				modalHost = null;
				if (lastFocused !== null && typeof lastFocused.focus === "function" && document.body.contains(lastFocused)) try {
					lastFocused.focus();
				} catch (err) {}
				lastFocused = null;
				pokeFabCollision();
			}
			/** 浮动按钮与设置页在模态里渲染时，Escape 一律关闭。 */
			function watchModalEscape() {
				var onKey = function(event) {
					if (event.key !== "Escape") return;
					if (typeof document.querySelector === "function" ? document.querySelector(".dts-select-menu") !== null : false) return;
					if (engine.get().dialog !== null) return;
					if (document.getElementById("dts-modal-host") !== null) closeModal();
				};
				document.addEventListener("keydown", onKey, true);
				return function() {
					document.removeEventListener("keydown", onKey, true);
				};
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
				accept,
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
					draft = null;
					return api.preset(id).then(function(projection) {
						accept(projection);
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
			/**
			* 注册（或按新文案**重新**注册）设置页独立页。
			* ⚠️ 必须先 dispose 旧注册：list 槽同 id + 同 priority 重复注册会 throw。
			*/
			function registerSettingsSection() {
				if (settingsDisposer !== null) {
					try {
						settingsDisposer();
					} catch (err) {}
					settingsDisposer = null;
				}
				settingsDisposer = ctx.slots.inject("settings.section", function() {
					return ctx.slots.register({
						name: "settings.section",
						id: PLUGIN_ID,
						order: 60,
						priority: 60,
						label: tt("section.title"),
						inject: function() {
							return {
								env,
								t: tt
							};
						}
					}, ThemeStudioApp);
				});
			}
			function registerFallbackRow() {
				if (fallbackDisposer !== null) return;
				fallbackDisposer = ctx.slots.inject("settings.general.item", function() {
					return ctx.slots.register({
						name: "settings.general.item",
						id: PLUGIN_ID,
						order: 60,
						inject: function() {
							return {
								env,
								t: tt
							};
						}
					}, ThemeStudioGeneralRow);
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
				setTimeout(function() {
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
			*/
			var lang = currentLang();
			function onLangSourceChanged() {
				var next = currentLang();
				if (next === lang) return;
				lang = next;
				setFabLabel(document.getElementById(FAB_ID));
				if (entryMode === "section") try {
					registerSettingsSection();
				} catch (err) {
					console.warn("[dsh-theme-studio] 语言切换后重新注册失败：", err);
				}
			}
			ctx.effect(function() {
				if (!ctx.theme) console.warn("[dsh-theme-studio] 环境未提供 theme 服务，配色改动将只落在背景层");
				ensureChromeStyle();
				mountFab();
				mountSettingsEntry();
				reload();
				var settle = window.setTimeout(function() {
					probe.invalidate();
					reload();
				}, 400);
				return function() {
					window.clearTimeout(settle);
					closeModal();
					stopFabCollision();
					var fab = document.getElementById(FAB_ID);
					if (fab !== null) fab.remove();
				};
			}, "theme-studio: boot");
			ctx.effect(function() {
				var offDict = null;
				try {
					var localeSvc = getLocaleService();
					if (localeSvc && typeof localeSvc.register === "function") offDict = localeSvc.register(PLUGIN_ID, {
						zh: MESSAGES.zh,
						en: MESSAGES.en
					});
				} catch (err) {
					console.info("[dsh-theme-studio] locale 词典注册跳过：", err && err.message);
				}
				var observer = null;
				try {
					observer = new MutationObserver(function() {
						onLangSourceChanged();
					});
					observer.observe(document.documentElement, {
						attributes: true,
						attributeFilter: ["lang"]
					});
				} catch (err) {
					observer = null;
				}
				var offService = null;
				try {
					if (typeof ctx.on === "function" && getLocaleService()) offService = ctx.on("locale/change", function() {
						onLangSourceChanged();
					});
				} catch (err) {
					offService = null;
				}
				return function() {
					if (typeof offDict === "function") try {
						offDict();
					} catch (err) {}
					if (observer !== null) observer.disconnect();
					if (typeof offService === "function") try {
						offService();
					} catch (err) {}
				};
			}, "theme-studio: language watch");
			ctx.effect(function() {
				var offEscape = watchModalEscape();
				function onKey(event) {
					if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
					if (String(event.key).toLowerCase() === "f") {
						event.preventDefault();
						toggleFullscreen();
					}
				}
				window.addEventListener("keydown", onKey);
				return function() {
					offEscape();
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
					window.clearTimeout(commitTimer);
					window.clearTimeout(noticeTimer);
					styles.forEach(function(el) {
						el.remove();
					});
					var notice = document.getElementById("dts-notice");
					if (notice !== null) notice.remove();
					if (toastRoot !== null) {
						try {
							toastRoot.unmount();
						} catch (err) {}
						toastRoot = null;
						toastHost = null;
					}
					var toast = document.getElementById("dts-toast-host");
					if (toast !== null) toast.remove();
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
			clamp,
			CHROME_CSS,
			TABS,
			requestFullscreen,
			exitFullscreen,
			fullscreenElement,
			COMMIT_DEBOUNCE_MS: 220,
			LAYER_ID,
			STYLE_ID,
			FAB_ID,
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
