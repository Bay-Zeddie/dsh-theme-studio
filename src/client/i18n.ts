// src/client/i18n.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { e } from './deps.ts'

        /* ============================================================ */
        /* 文案：语言跟随 dsh 自身设置                                     */
        /* ============================================================ */

        export var MESSAGES = {
          zh: {
            'section.title': '主题工坊',
            /* 页面级引言（`.dts-page-intro`，官方 `PluginsSettingsSection` 的 `.intro` 位）。
               **独立成键**而不是借 `base.hint`：后者是「明暗模式」那一行的行描述
               （"切换后所有面板同步"），与"整页一句话说什么"不是同一句 ——
               页面引言借它，就会与紧邻的行描述重复同一句文案。 */
            'section.intro': '给界面换背景图片与视频，逐令牌改配色、字体、圆角与玻璃质感；改动实时生效，随时可恢复默认。',
            'tab.presets': '预设', 'tab.backdrop': '背景', 'tab.library': '素材库',
            'tab.color': '色彩', 'tab.type': '文字', 'tab.shape': '形状与动效', 'tab.advanced': '高级', 'tab.profile': '我的方案',
            /* 分组标题**不能**沿用页签名（`tab.profile` = 「我的方案」），否则页面标题下
               又出现一个同名小标题（主人截图点出的"重复标题"）。 */
            'profile.groupTitle': '保存的方案',
            'profile.hint': '保存"配色 + 背景 + 玻璃 + 字体"的整体快照，随时一键切回。',
            'profile.namePh': '方案名称（如：午夜深蓝）',
            'profile.saveNew': '保存当前方案',
            'profile.apply': '应用', 'profile.overwrite': '覆盖', 'profile.del': '删除',
            'profile.background': '背景',
            'profile.empty': '还没有方案：把界面调成喜欢的样子，取个名字点「保存当前方案」。',
            'profile.saved': '已保存方案', 'profile.applied': '已切换到方案',
            'profile.existsTitle': '覆盖已有方案？',
            'profile.existsBody': '同名方案会被当前配置替换。',
            'profile.deleteTitle': '删除主题档？',
            'profile.deleteBody': '只删除本机主题档，素材与当前界面不受影响。',
            'common.reset': '恢复默认', 'common.saved': '已保存', 'common.saving': '保存中…',
            'common.failed': '操作失败', 'common.uploading': '上传中…', 'common.close': '关闭',
            'common.fullscreen': '整窗全屏',
            // 顶条「编辑」菜单替身的条目（与主进程 edit 菜单逐项对齐）。
            'menu.undo': '撤销', 'menu.redo': '重做',
            'menu.cut': '剪切', 'menu.copy': '复制', 'menu.paste': '粘贴',
            'menu.delete': '删除', 'menu.selectAll': '全选',
            /* 命令没生效时的提示。不猜原因（无选区/无撤销栈分不清），只说结果。 */
            'menu.noop': '「{0}」这次没有可以作用的内容',
            'common.none': '无', 'common.image': '图片', 'common.video': '视频', 'common.gradient': '渐变',
            'common.dropHere': '拖拽图片 / 视频 / 字体到此处上传（原样保存，不压缩）',
            'common.delete': '删除', 'common.use': '设为背景', 'common.uploaded': '上传完成',
            'common.empty': '还没有素材。把图片、视频或字体拖到上面即可。',
            'common.confirm': '确认', 'common.cancel': '取消',
            'common.openPanel': '打开主题工坊',
            'base.scheme': '明暗模式', 'base.system': '跟随系统', 'base.light': '浅色', 'base.dark': '深色',
            'base.fontSize': '对话字号',
            'base.hint': '明暗与字号直接驱动宿主 theme 服务，切换后所有面板同步。',
            'preset.note': '预设一次性写好配色与背景；之后每项仍可微调。',
            'preset.applied': '已套用预设',
            'backdrop.mode': '背景类型', 'backdrop.pick': '选择素材',
            'backdrop.fit': '铺法', 'backdrop.cover': '铺满（裁切）', 'backdrop.contain': '完整显示（留边）',
            'backdrop.tile': '原始像素平铺（1px 都不缩放）', 'backdrop.focus': '焦点位置',
            'backdrop.focusHint': '在画面上拖动决定裁切中心；X/Y 对应横向与纵向。',
            'backdrop.scale': '放大倍率', 'backdrop.filters': '画面滤镜', 'backdrop.blur': '模糊',
            'backdrop.brightness': '亮度', 'backdrop.saturate': '饱和度', 'backdrop.contrast': '对比度',
            'backdrop.grayscale': '去色', 'backdrop.sepia': '复古', 'backdrop.hueRotate': '色相旋转',
            'backdrop.veil': '压暗遮罩（保证正文可读）', 'backdrop.dim': '遮罩浓度',
            'backdrop.veilColor': '遮罩颜色', 'backdrop.veilGradient': '上轻下重渐变',
            'backdrop.motion': '动感', 'backdrop.kenBurns': '缓慢推拉（Ken Burns）',
            'backdrop.kenBurnsSeconds': '推拉周期', 'backdrop.parallax': '鼠标视差',
            'backdrop.videoTitle': '视频播放', 'backdrop.muted': '静音', 'backdrop.loop': '循环',
            'backdrop.autoplay': '自动播放', 'backdrop.playbackRate': '倍速',
            'backdrop.fadeOnFocus': '输入时淡化背景',
            'backdrop.glassOn': '已顺手开启玻璃质感 —— 不透明的面板会把壁纸整个盖住；不需要可在本页关掉',
            'backdrop.hint': '素材按原始字节保存与回吐（HTTP Range），4K 图与视频都不会被重编码。',
            'glass.enabled': '玻璃质感', 'glass.alpha': '面板透明度', 'glass.blur': '面板模糊',
            'glass.saturate': '面板饱和',
            'glass.hint': '把表面令牌按基准色重铸成半透明，壁纸才真正透得出来。',
            'color.accent': '强调色',
            'color.accentHint': '只改主色/链接/选中态等派生令牌，不打乱既有版面层级。',
            'color.autoAccent': '从强调色派生相关令牌', 'color.groups': '分组精修',
            'color.light': '浅色值', 'color.dark': '深色值', 'color.clear': '清除',
            'color.contrast': '正文对比度',
            'color.contrastHint': 'WCAG：≥7 优秀，≥4.5 达标，低于 4.5 建议加深遮罩或调整文字色。',
            'color.custom': '自定义令牌', 'color.customAdd': '添加', 'color.customName': '--dsw-别名',
            'color.noToken': '（未设置）', 'color.fromImage': '从背景图取色',
            'type.uiFont': '界面字体栈', 'type.codeFont': '代码字体栈', 'type.letterSpacing': '字距',
            'type.uploadFont': '上传字体（woff2 / woff / ttf / otf）', 'type.families': '已上传字体',
            'type.useFamily': '用作界面字体', 'type.useCodeFamily': '用作代码字体',
            'type.hint': '字体文件同样原样存储，@font-face 由本机路由供给，不依赖外网。',
            'shape.corner': '圆角曲率（超级椭圆指数）',
            'shape.cornerHint': '1=正圆弧，1.5=宿主默认，越大越方。',
            'shape.motion': '动效时长倍率', 'shape.motionOff': '0 = 关闭动效', 'shape.reduceMotion': '减少动态效果', 'shape.scrollbar': '滚动条',
            'shape.native': '宿主默认', 'shape.auto': '胶囊描边', 'shape.slim': '极细', 'shape.hidden': '隐藏',
            'adv.css': '追加自定义 CSS',
            'adv.cssHint': '最后注入，可覆盖上面的一切；只影响你自己的界面。',
            'adv.export': '导出主题 JSON', 'adv.import': '导入主题 JSON',
            'adv.merge': '合并导入', 'adv.mergeHint': '勾上则只覆盖 JSON 里出现的字段，其余保持现状；不勾则整份替换。',
            'adv.usage': '素材占用',
            'dialog.resetTitle': '恢复默认主题？',
            'dialog.resetBody': '当前配色、背景与素材引用会被重置；已上传的素材文件不会删除。',
            'dialog.deleteTitle': '删除这个素材？',
            'dialog.deleteBody': '文件会从磁盘移除，使用该素材的主题会失去背景。',
            'dialog.forceBody': '该素材正被当前主题引用，删除后背景会变空。',
            'dialog.forceFontBody': '该字体正被字体栈使用，删除后相关文字回退默认字体。',
            'err.offline': '连不上主题工坊的本地接口：确认宿主正在运行且主题工坊已加载，然后刷新页面重试。',
            'err.writeToken': '写口令缺失：刷新页面即可恢复。',
            'err.conflict': '主题刚被其它窗口改动过：已回到最新版本，你这次的修改没有保存。',
          },
          en: {
            'section.title': 'Theme Studio',
            /* Page-level intro (the official `PluginsSettingsSection` `.intro` seat).
               A key of its own rather than `base.hint`: that one is the row description of
               the Color scheme row ("every panel follows"), not a one-line description of
               the whole page — borrowing it repeats the same sentence twice on screen. */
            'section.intro': 'Swap in image and video backdrops, retune colors per token, fonts, corners and glass — changes apply live and reset in one click.',
            'tab.presets': 'Presets', 'tab.backdrop': 'Backdrop', 'tab.library': 'Library',
            'tab.color': 'Colors', 'tab.type': 'Type', 'tab.shape': 'Shape & Motion', 'tab.advanced': 'Advanced', 'tab.profile': 'Profiles',
            'profile.groupTitle': 'Saved profiles',
            'profile.hint': 'A snapshot of colors + backdrop + glass + type — switch back with one click.',
            'profile.namePh': 'Profile name (e.g. Midnight Blue)',
            'profile.saveNew': 'Save current',
            'profile.apply': 'Apply', 'profile.overwrite': 'Overwrite', 'profile.del': 'Delete',
            'profile.background': 'Backdrop',
            'profile.empty': 'No profiles yet: style the UI, name it, then hit "Save current".',
            'profile.saved': 'Profile saved', 'profile.applied': 'Switched to profile',
            'profile.existsTitle': 'Overwrite existing profile?',
            'profile.existsBody': 'The profile with this name will be replaced by the current configuration.',
            'profile.deleteTitle': 'Delete theme file?',
            'profile.deleteBody': 'Only the saved file is removed; media and the live theme stay untouched.',
            'common.reset': 'Reset', 'common.saved': 'Saved', 'common.saving': 'Saving…',
            'common.failed': 'Operation failed', 'common.uploading': 'Uploading…', 'common.close': 'Close',
            'common.fullscreen': 'Fullscreen',
            'menu.undo': 'Undo', 'menu.redo': 'Redo',
            'menu.cut': 'Cut', 'menu.copy': 'Copy', 'menu.paste': 'Paste',
            'menu.delete': 'Delete', 'menu.selectAll': 'Select All',
            'menu.noop': 'Nothing for "{0}" to act on this time',
            'common.none': 'None', 'common.image': 'Image', 'common.video': 'Video', 'common.gradient': 'Gradient',
            'common.dropHere': 'Drop images / videos / fonts here (stored byte-for-byte, never recompressed)',
            'common.delete': 'Delete', 'common.use': 'Set as backdrop', 'common.uploaded': 'Uploaded',
            'common.empty': 'No material yet. Drop an image, video or font above.',
            'common.confirm': 'Confirm', 'common.cancel': 'Cancel',
            'common.openPanel': 'Open Theme Studio',
            'base.scheme': 'Color scheme', 'base.system': 'System', 'base.light': 'Light', 'base.dark': 'Dark',
            'base.fontSize': 'Content font size',
            'base.hint': 'Scheme and font size drive the host theme service, so every panel follows.',
            'preset.note': 'A preset writes colors and backdrop at once; every knob stays adjustable afterwards.',
            'preset.applied': 'Preset applied',
            'backdrop.mode': 'Backdrop type', 'backdrop.pick': 'Pick material',
            'backdrop.fit': 'Fit', 'backdrop.cover': 'Cover (crop)', 'backdrop.contain': 'Contain (letterbox)',
            'backdrop.tile': 'Tile at native pixels (no scaling)', 'backdrop.focus': 'Focus point',
            'backdrop.focusHint': 'Drag on the preview to choose the crop centre; X and Y are horizontal and vertical.',
            'backdrop.scale': 'Zoom', 'backdrop.filters': 'Filters', 'backdrop.blur': 'Blur',
            'backdrop.brightness': 'Brightness', 'backdrop.saturate': 'Saturation', 'backdrop.contrast': 'Contrast',
            'backdrop.grayscale': 'Grayscale', 'backdrop.sepia': 'Sepia', 'backdrop.hueRotate': 'Hue rotate',
            'backdrop.veil': 'Dim veil (keeps text readable)', 'backdrop.dim': 'Veil strength',
            'backdrop.veilColor': 'Veil color', 'backdrop.veilGradient': 'Heavier toward bottom',
            'backdrop.motion': 'Motion', 'backdrop.kenBurns': 'Slow zoom (Ken Burns)',
            'backdrop.kenBurnsSeconds': 'Zoom period', 'backdrop.parallax': 'Pointer parallax',
            'backdrop.videoTitle': 'Video playback', 'backdrop.muted': 'Muted', 'backdrop.loop': 'Loop',
            'backdrop.autoplay': 'Autoplay', 'backdrop.playbackRate': 'Rate',
            'backdrop.fadeOnFocus': 'Fade backdrop while typing',
            'backdrop.glassOn': 'Glass surfaces switched on — opaque panels would cover the backdrop entirely; turn it off here if unwanted',
            'backdrop.hint': 'Materials are stored and served as original bytes over HTTP Range — 4K stills and video are never re-encoded.',
            'glass.enabled': 'Glass surfaces', 'glass.alpha': 'Surface opacity', 'glass.blur': 'Surface blur',
            'glass.saturate': 'Surface saturation',
            'glass.hint': 'Rebuilds surface tokens from their base color with alpha, so the backdrop actually shows through.',
            'color.accent': 'Accent color',
            'color.accentHint': 'Rewrites primary / link / selection tokens only; layout hierarchy stays intact.',
            'color.autoAccent': 'Derive related tokens from accent', 'color.groups': 'Grouped tuning',
            'color.light': 'Light', 'color.dark': 'Dark', 'color.clear': 'Clear',
            'color.contrast': 'Text contrast',
            'color.contrastHint': 'WCAG: ≥7 excellent, ≥4.5 acceptable; below 4.5 add veil or darken text.',
            'color.custom': 'Custom tokens', 'color.customAdd': 'Add', 'color.customName': '--dsw-alias',
            'color.noToken': '(none)', 'color.fromImage': 'Sample from backdrop',
            'type.uiFont': 'UI font stack', 'type.codeFont': 'Code font stack', 'type.letterSpacing': 'Letter spacing',
            'type.uploadFont': 'Upload font (woff2 / woff / ttf / otf)', 'type.families': 'Uploaded fonts',
            'type.useFamily': 'Use as UI font', 'type.useCodeFamily': 'Use as code font',
            'type.hint': 'Fonts are stored verbatim too; @font-face is served by the local route, with no CDN.',
            'shape.corner': 'Corner curvature (superellipse exponent)',
            'shape.cornerHint': '1 = circular arc, 1.5 = host default, larger = squarish.',
            'shape.motion': 'Motion duration scale', 'shape.motionOff': '0 = motion off', 'shape.reduceMotion': 'Reduce motion', 'shape.scrollbar': 'Scrollbar',
            'shape.native': 'Host default', 'shape.auto': 'Pill border', 'shape.slim': 'Slim', 'shape.hidden': 'Hidden',
            'adv.css': 'Extra custom CSS',
            'adv.cssHint': 'Injected last, so it overrides everything above; affects your own shell only.',
            'adv.export': 'Export theme JSON', 'adv.import': 'Import theme JSON',
            'adv.merge': 'Merge import', 'adv.mergeHint': 'When ticked, only fields present in the JSON are overwritten; otherwise the whole document is replaced.',
            'adv.usage': 'Material usage',
            'dialog.resetTitle': 'Reset to the default theme?',
            'dialog.resetBody': 'Colors, backdrop and media references reset; uploaded material files are kept.',
            'dialog.deleteTitle': 'Delete this material?',
            'dialog.deleteBody': 'The file is removed from disk and any theme using it loses its backdrop.',
            'dialog.forceBody': 'The active theme references this material; the backdrop goes empty after deletion.',
            'dialog.forceFontBody': 'This font is used by a font stack; affected text falls back to defaults after deletion.',
            'err.offline': 'Cannot reach the local Theme Studio API: make sure the host is running with Theme Studio loaded, then reload the page.',
            'err.writeToken': 'Missing write token: reload the page to restore it.',
            'err.conflict': 'The theme just changed in another window: back to the latest version, your last edit was not saved.',
          },
        };

        export function normalizeLang(value: unknown) {
          var tag = String(value || '').toLowerCase();
          if (tag.indexOf('zh') === 0) return 'zh';
          if (tag.indexOf('en') === 0) return 'en';
          return '';
        }

        /* ============================================================ */
        /* 官方 locale 服务（@deepseek-ai/dsh-client-locale）接线          */
        /* ============================================================ */
        /*
         * 官方契约（产物取证：_official/dsh-client-locale/lib/client.js）
         *   · 注册   locale.register(ns, { zh, en })           → :1387  返回 disposer :1398
         *   · 取文案 locale.bind(ns) → (key, params) => …      → :1414 / :1417
         *   · 插值   template.replace(/\{(\w+)\}/g, …)         → :1427  **具名**参数
         *   · 订阅   getSnapshot().revision / subscribe(fn)    → :1250 / :1260
         *           `publish()` 每次注册与换语言都 +1 revision  → :1443-1455
         *   · 官方写法一律 ctx.effect(() => ctx.locale.register(NS, {zh,en}), '<reason>')
         *     （ui-theme:1583 / ui-settings-general:969 / ui-chat:12234）
         *
         * 我们的键名（点分）与官方逐字同风格，词典直接进官方目录，不重写文案。
         * 唯一形制差异是占位符：本表用位置式 `{0}`（`menu.noop`，全表唯一带占位键），
         * 官方正则只认 `{(\w+)}` —— 数字属 `\w`，所以官方替换**能**命中 `{0}`，
         * 前提是把位置参数折成 `{ '0': value }` 这样的具名对象（见 t() 与 paramsFor）。
         */

        /** 我们的词典命名空间 = 包名（官方惯例是插件自有名，如 `chat` / `settings.theme`）。 */
        export var LOCALE_NS = 'dsh-theme-studio';

        /**
         * 官方 locale 服务切片。**必须住在工厂作用域**：模块级 t() 要现读它，
         * 关进 apply() 会让 apply 之外的一切 t() 调用直接 ReferenceError。
         * 它是可选依赖（不写进 exports.inject），服务缺席时整条链降级到本地词典。
         */
        var localeService: any = null;
        /** apply() 时的 cordis ctx：服务在 apply 之后才挂载时，靠它按需重取一次。 */
        var localeCtx: any = null;
        var boundT: any = null;
        var boundTNs = '';
        var boundTAt: any = null;

        /**
         * 跨模块可变：apply() 装配时赋值（ESM import 绑定只读，走存取器）。
         * @param next 官方 locale 服务（可空 —— 缺席就走降级链）
         * @param context 取服务用的 cordis ctx（可空）
         */
        export function setLocaleService(next, context) {
          localeService = next || null;
          localeCtx = context || null;
          boundT = null;
          boundTNs = '';
          boundTAt = null;
        }
        /** 取服务：显式句柄优先，其次向 ctx 再问一次（激活顺序未知时自愈）。 */
        export function getLocaleService() {
          if (localeService) return localeService;
          if (!localeCtx || typeof localeCtx.get !== 'function') return null;
          try {
            var late = localeCtx.get('locale') || null;
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
          if (!svc || typeof svc.bind !== 'function') return null;
          var revision = null;
          try {
            var snapshot = typeof svc.getSnapshot === 'function' ? svc.getSnapshot() : null;
            revision = snapshot ? snapshot.revision : null;
          } catch (err) {
            revision = null;
          }
          if (boundT !== null && boundT !== undefined && boundTNs === LOCALE_NS && boundTAt === revision) return boundT;
          var next = null;
          try {
            next = svc.bind(LOCALE_NS);
          } catch (err) {
            return null;
          }
          if (typeof next !== 'function') return null;
          boundT = next;
          boundTNs = LOCALE_NS;
          boundTAt = revision;
          return next;
        }

        /**
         * 位置参数 → 官方具名参数对象。`t('menu.noop', label)` 折成 `{ '0': label }`，
         * 好让官方 `{(\w+)}` 正则命中本表的 `{0}`。
         */
        function paramsFor(args: unknown[]) {
          if (args.length === 0) return null;
          var params: Record<string, unknown> = {};
          for (var i = 0; i < args.length; i += 1) params[String(i)] = args[i];
          return params;
        }

        /** 本地词典查询（降级链与官方未命中时的第二源，与注册进官方的是同一对象）。 */
        function localTemplate(key: string) {
          var dict = MESSAGES[currentLang()] || MESSAGES.zh;
          var value = dict[key] !== undefined ? dict[key] : MESSAGES.zh[key];
          return value;
        }

        /**
         * 当前语言。**权威源是官方 locale 服务，不是 <html lang>。**
         * 服务端 HTML 写死 lang="en"，要等 locale 插件激活后才异步改写；
         * 只认 <html lang> 会在早于改写时永远拿到 en，观察器若挂在写入之后
         * 就再也收不到那一次变化 —— 界面永久停在英文且无自愈通道。
         * 顺序：locale 服务 → <html lang> → navigator.language，且必须每次现读。
         * 降级链只在服务不可用时才是主路径（官方规范里语言权威源就是 locale 服务）。
         */
        export function currentLang() {
          try {
            var svc = getLocaleService();
            var snapshot = svc && typeof svc.getSnapshot === 'function' ? svc.getSnapshot() : null;
            var fromService = normalizeLang(snapshot && snapshot.active);
            if (fromService !== '') return fromService;
            var fromDoc = normalizeLang(document.documentElement.lang);
            if (fromDoc !== '') return fromDoc;
            var fromNav = normalizeLang(navigator.language);
            if (fromNav !== '') return fromNav;
            return 'zh';
          } catch (err) {
            return 'zh';
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
        export function t(key: string, ...args: unknown[]) {
          var params = paramsFor(args);
          var official = boundTranslate();
          if (official !== null) {
            var value: any;
            try {
              value = official(key, args.length > 0 && params ? params : undefined);
            } catch (err) {
              value = undefined;
            }
            if (typeof value === 'string') {
              // 命中：官方已做插值（含 `{0}`）。未命中会原样回吐键名 ——
              // 那时交给下面的本地链再试一次（本地与官方同一个 MESSAGES，同源不漂移）。
              if (value !== key) return value;
            } else if (value !== undefined && value !== null) {
              return value;
            }
          }
          var local = localTemplate(key);
          // 两语言都缺键时回退成键名本身：界面上直接看到 `tab.presets` 这样的线索，
          // 远好过一片空白（按钮无字 / 状态栏空串），新增未翻译键一眼可查。
          if (local === undefined) return String(key);
          if (typeof local === 'function') return (local as any).apply(null, args);
          if (args.length === 0) return local;
          return String(local).replace(/\{(\d+)\}/g, function (whole, index) {
            var at = Number(index);
            return at < args.length ? String(args[at]) : whole;
          });
        }

        /** 官方 locale 不可用时的静默标记（诊断用，不改变行为）。 */
        export function localeDegraded() { return boundTranslate() === null }

        /**
         * 把本模块的词典按官方签名注册进 locale 服务。
         * @param service 官方 locale 服务（可空）
         * @returns 官方 disposer（撤销本次词典注册）或 null
         */
        export function registerLocaleDictionary(service) {
          if (!service || typeof service.register !== 'function') return null;
          return service.register(LOCALE_NS, { zh: MESSAGES.zh, en: MESSAGES.en });
        }

        /**
         * 订阅官方 locale 的 **revision** 变化（换语言与词典注册都会 +1）。
         * 官方订阅者不接收参数，所以回调里现读 getSnapshot()。
         * @param service 官方 locale 服务（可空）
         * @param handler 变化回调（读快照用）
         * @returns unsubscribe 或 null
         */
        export function subscribeLocaleChanges(service, handler) {
          if (!service || typeof service.subscribe !== 'function') return null;
          return service.subscribe(function () { handler() });
        }

