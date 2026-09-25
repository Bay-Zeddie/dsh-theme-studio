// src/client/i18n.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。
import { e } from './deps.ts'

        /* ============================================================ */
        /* 文案：语言跟随 dsh 自身设置                                     */
        /* ============================================================ */

        export var MESSAGES = {
          zh: {
            'section.title': '主题工坊',
            'tab.presets': '预设', 'tab.backdrop': '背景', 'tab.library': '素材库',
            'tab.color': '色彩', 'tab.type': '文字', 'tab.shape': '形状与动效', 'tab.advanced': '高级', 'tab.profile': '我的方案',
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
            'shape.motion': '动效时长倍率', 'shape.reduceMotion': '减少动态效果', 'shape.scrollbar': '滚动条',
            'shape.native': '宿主默认', 'shape.auto': '胶囊描边', 'shape.slim': '极细', 'shape.hidden': '隐藏',
            'adv.css': '追加自定义 CSS',
            'adv.cssHint': '最后注入，可覆盖上面的一切；只影响你自己的界面。',
            'adv.export': '导出主题 JSON', 'adv.import': '导入主题 JSON',
            'adv.usage': '素材占用',
            'dialog.resetTitle': '恢复默认主题？',
            'dialog.resetBody': '当前配色、背景与素材引用会被重置；已上传的素材文件不会删除。',
            'dialog.deleteTitle': '删除这个素材？',
            'dialog.deleteBody': '文件会从磁盘移除，使用该素材的主题会失去背景。',
            'dialog.forceBody': '该素材正被当前主题引用，删除后背景会变空。',
            'dialog.forceFontBody': '该字体正被字体栈使用，删除后相关文字回退默认字体。',
            'err.offline': '连不上主题工坊的本地接口：确认宿主正在运行且主题工坊已加载，然后刷新页面重试。',
            'err.writeToken': '写口令缺失：刷新页面即可恢复。',
          },
          en: {
            'section.title': 'Theme Studio',
            'tab.presets': 'Presets', 'tab.backdrop': 'Backdrop', 'tab.library': 'Library',
            'tab.color': 'Colors', 'tab.type': 'Type', 'tab.shape': 'Shape & Motion', 'tab.advanced': 'Advanced', 'tab.profile': 'Profiles',
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
            'shape.motion': 'Motion duration scale', 'shape.reduceMotion': 'Reduce motion', 'shape.scrollbar': 'Scrollbar',
            'shape.native': 'Host default', 'shape.auto': 'Pill border', 'shape.slim': 'Slim', 'shape.hidden': 'Hidden',
            'adv.css': 'Extra custom CSS',
            'adv.cssHint': 'Injected last, so it overrides everything above; affects your own shell only.',
            'adv.export': 'Export theme JSON', 'adv.import': 'Import theme JSON',
            'adv.usage': 'Material usage',
            'dialog.resetTitle': 'Reset to the default theme?',
            'dialog.resetBody': 'Colors, backdrop and media references reset; uploaded material files are kept.',
            'dialog.deleteTitle': 'Delete this material?',
            'dialog.deleteBody': 'The file is removed from disk and any theme using it loses its backdrop.',
            'dialog.forceBody': 'The active theme references this material; the backdrop goes empty after deletion.',
            'dialog.forceFontBody': 'This font is used by a font stack; affected text falls back to defaults after deletion.',
            'err.offline': 'Cannot reach the local Theme Studio API: make sure the host is running with Theme Studio loaded, then reload the page.',
            'err.writeToken': 'Missing write token: reload the page to restore it.',
          },
        };

        export function normalizeLang(value) {
          var tag = String(value || '').toLowerCase();
          if (tag.indexOf('zh') === 0) return 'zh';
          if (tag.indexOf('en') === 0) return 'en';
          return '';
        }

        /**
         * 官方 locale 服务句柄。**由 apply() 装配时赋值，但必须住在工厂作用域**：
         * 模块级 t() 要调 currentLang()，而 currentLang 要读这个句柄 ——
         * 把它关在 apply() 里会让 apply 之外的一切 t() 调用直接 ReferenceError。
         * 它是可选依赖，所以不写进 exports.inject，取不到就走降级链。
         */
        var localeService = null;
        /** 跨模块可变：apply() 装配时句柄赋值（ESM import 绑定只读，走存取器）。 */
        export function setLocaleService(next) { localeService = next }
        export function getLocaleService() { return localeService }

        /**
         * 当前语言。**权威源是官方 locale 服务，不是 <html lang>。**
         * 服务端 HTML 写死 lang="en"，要等 locale 插件激活后才异步改写；
         * 只认 <html lang> 会在早于改写时永远拿到 en，观察器若挂在写入之后
         * 就再也收不到那一次变化 —— 界面永久停在英文且无自愈通道。
         * 顺序：locale 服务 → <html lang> → navigator.language，且必须每次现读。
         */
        export function currentLang() {
          try {
            var snapshot = localeService && typeof localeService.getSnapshot === 'function'
              ? localeService.getSnapshot()
              : null;
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
         * 取文案。
         * ⚠️ 参数是可变的：带占位的文案按顺序多传 t('key', a, b)。
         * 只收一个参数会让占位渲染成 undefined，静态检查抓不到。
         */
        export function t(key) {
          var args = Array.prototype.slice.call(arguments, 1);
          var dict = MESSAGES[currentLang()] || MESSAGES.zh;
          var value = dict[key] !== undefined ? dict[key] : MESSAGES.zh[key];
          return typeof value === 'function' ? value.apply(null, args) : value;
        }

