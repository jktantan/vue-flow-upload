/**
 * 文档示例自身文案与其三语支持；组件内置文案由各自的 locale prop 负责，本模块只覆盖示例外壳。
 * Copy of the documentation demos themselves and their three-language support; component-internal copy is handled by each component's locale prop, so this module only covers the demo shell.
 */

/** 文档示例支持的语言；与 VitePress locale 的 lang 值保持一致。 Languages supported by the docs demos; kept identical to the VitePress locale lang values. */
export type DemoLocale = 'zh-CN' | 'en-US' | 'ru-RU'

/** 未知语言时的回退值，避免示例文案为空。 Fallback used for unknown languages so demo copy is never empty. */
const FALLBACK_DEMO_LOCALE: DemoLocale = 'zh-CN'

/**
 * 把 VitePress 的 lang 归一化为示例支持的语言。
 * Normalizes a VitePress lang value into a demo-supported locale.
 */
export function resolveDemoLocale(lang: string): DemoLocale {
  return lang === 'en-US' || lang === 'ru-RU' ? lang : FALLBACK_DEMO_LOCALE
}

/** 基础上传 / 手动上传示例的文案。 Copy for the basic and manual upload demos. */
export interface UploadDemoCopy {
  ariaLabel: string
  captionAuto: string
  captionManual: string
  startUpload: string
  tip: string
}

/** 头像上传示例的文案。 Copy for the avatar upload demo. */
export interface AvatarDemoCopy {
  ariaLabel: string
  settingsLabel: string
  shape: string
  shapeCircle: string
  shapeSquare: string
  readOnly: string
  preview: string
  caption: string
}

/** 完整版上传示例的文案。 Copy for the full-featured upload demo. */
export interface FullUploadDemoCopy {
  ariaLabel: string
  groupOperation: string
  groupPermissions: string
  groupLimits: string
  groupState: string
  listType: string
  listTypeList: string
  listTypePicture: string
  drag: string
  batchSelect: string
  fileList: string
  toolbar: string
  permissionSelect: string
  permissionUpload: string
  permissionRemove: string
  permissionRetry: string
  permissionPreview: string
  permissionDownload: string
  permissionDownloadAll: string
  disableAll: string
  acceptedTypes: string
  acceptAll: string
  acceptImage: string
  acceptMedia: string
  maxSize: string
  maxCount: string
  autoUpload: string
  theme: string
  componentLanguage: string
  startUpload: string
  clearList: string
  caption: string
  tip: string
}

/** 一种语言的完整示例文案与它对应的组件 locale。 Complete demo copy for one language together with the component locale it implies. */
export interface DemoCopy {
  upload: UploadDemoCopy
  avatar: AvatarDemoCopy
  full: FullUploadDemoCopy
}

/** 三个示例在三种语言下的文案字典。 Copy dictionary for the three demos across the three supported languages. */
export const DEMO_COPY: Record<DemoLocale, DemoCopy> = {
  'zh-CN': {
    upload: {
      ariaLabel: '文件上传交互示例',
      captionAuto: '选择或拖入文件，查看组件的真实上传状态变化。',
      captionManual: '选择文件后，点击“开始上传”触发队列。',
      startUpload: '开始上传',
      tip: '支持图片、PDF、ZIP；此示例不会发送网络请求。',
    },
    avatar: {
      ariaLabel: '头像上传交互示例',
      settingsLabel: '头像示例配置',
      shape: '形状',
      shapeCircle: '圆形',
      shapeSquare: '方形',
      readOnly: '只读',
      preview: '允许预览',
      caption: '选择一张图片，在裁剪框中调整后确认；上传过程仅在浏览器内模拟。',
    },
    full: {
      ariaLabel: '完整功能上传示例',
      groupOperation: '操作',
      groupPermissions: '权限',
      groupLimits: '选择限制',
      groupState: '状态、主题与语言',
      listType: '列表形态',
      listTypeList: '列表',
      listTypePicture: '照片墙',
      drag: '拖拽上传',
      batchSelect: '批量选择',
      fileList: '显示文件列表',
      toolbar: '显示工具栏',
      permissionSelect: '选择',
      permissionUpload: '上传',
      permissionRemove: '删除',
      permissionRetry: '重试',
      permissionPreview: '预览',
      permissionDownload: '下载',
      permissionDownloadAll: '全部下载',
      disableAll: '全部禁用',
      acceptedTypes: '接受类型',
      acceptAll: '全部文件',
      acceptImage: '仅图片',
      acceptMedia: '图片、PDF、ZIP',
      maxSize: '单文件上限 MB（0 不限）',
      maxCount: '数量上限（0 不限）',
      autoUpload: '自动上传',
      theme: '主题',
      componentLanguage: '组件语言',
      startUpload: '开始上传',
      clearList: '清空列表',
      caption: '改动任意控件，观察组件如何禁用或改变形态。上传、下载与打包均在浏览器内模拟。',
      tip: '权限、布局与选择限制即时生效；此示例不会发送任何网络请求。',
    },
  },
  'en-US': {
    upload: {
      ariaLabel: 'Interactive file upload demo',
      captionAuto: 'Select or drop files to see the component’s real upload states.',
      captionManual: 'Select files, then choose “Start upload” to run the queue.',
      startUpload: 'Start upload',
      tip: 'Images, PDFs, and ZIP files; this demo sends no network request.',
    },
    avatar: {
      ariaLabel: 'Interactive avatar upload demo',
      settingsLabel: 'Avatar demo settings',
      shape: 'Shape',
      shapeCircle: 'Circle',
      shapeSquare: 'Square',
      readOnly: 'Read only',
      preview: 'Enable preview',
      caption:
        'Select an image, adjust it in the crop box, and confirm. Upload is simulated entirely in the browser.',
    },
    full: {
      ariaLabel: 'Full-featured upload demo',
      groupOperation: 'Operation',
      groupPermissions: 'Permissions',
      groupLimits: 'Selection limits',
      groupState: 'State, theme and language',
      listType: 'List type',
      listTypeList: 'List',
      listTypePicture: 'Picture wall',
      drag: 'Drag and drop',
      batchSelect: 'Batch select',
      fileList: 'File list',
      toolbar: 'Toolbar',
      permissionSelect: 'Select',
      permissionUpload: 'Upload',
      permissionRemove: 'Remove',
      permissionRetry: 'Retry',
      permissionPreview: 'Preview',
      permissionDownload: 'Download',
      permissionDownloadAll: 'Download all',
      disableAll: 'Disable all',
      acceptedTypes: 'Accepted types',
      acceptAll: 'Any file',
      acceptImage: 'Images',
      acceptMedia: 'Images, PDF, ZIP',
      maxSize: 'Max size MB (0 = none)',
      maxCount: 'Max count (0 = none)',
      autoUpload: 'Auto upload',
      theme: 'Theme',
      componentLanguage: 'Component language',
      startUpload: 'Start upload',
      clearList: 'Clear list',
      caption:
        'Change any control to see how the component disables or reshapes itself. Uploads, downloads, and archives are simulated in the browser.',
      tip: 'Permission, layout, and selection limits apply immediately; nothing is sent to a server.',
    },
  },
  'ru-RU': {
    upload: {
      ariaLabel: 'Интерактивная демонстрация загрузки файлов',
      captionAuto:
        'Выберите или перетащите файлы, чтобы увидеть реальные состояния загрузки в компоненте.',
      captionManual: 'Выберите файлы и нажмите «Начать загрузку», чтобы запустить очередь.',
      startUpload: 'Начать загрузку',
      tip: 'Изображения, PDF и ZIP; эта демонстрация не отправляет сетевых запросов.',
    },
    avatar: {
      ariaLabel: 'Интерактивная демонстрация загрузки аватара',
      settingsLabel: 'Настройки демонстрации аватара',
      shape: 'Форма',
      shapeCircle: 'Круг',
      shapeSquare: 'Квадрат',
      readOnly: 'Только чтение',
      preview: 'Разрешить просмотр',
      caption:
        'Выберите изображение, настройте его в рамке обрезки и подтвердите. Загрузка полностью имитируется в браузере.',
    },
    full: {
      ariaLabel: 'Полнофункциональная демонстрация загрузки',
      groupOperation: 'Операции',
      groupPermissions: 'Права',
      groupLimits: 'Ограничения выбора',
      groupState: 'Состояние, тема и язык',
      listType: 'Вид списка',
      listTypeList: 'Список',
      listTypePicture: 'Галерея',
      drag: 'Перетаскивание',
      batchSelect: 'Массовый выбор',
      fileList: 'Список файлов',
      toolbar: 'Панель инструментов',
      permissionSelect: 'Выбор',
      permissionUpload: 'Загрузка',
      permissionRemove: 'Удаление',
      permissionRetry: 'Повтор',
      permissionPreview: 'Просмотр',
      permissionDownload: 'Скачивание',
      permissionDownloadAll: 'Скачать всё',
      disableAll: 'Отключить всё',
      acceptedTypes: 'Допустимые типы',
      acceptAll: 'Любые файлы',
      acceptImage: 'Только изображения',
      acceptMedia: 'Изображения, PDF, ZIP',
      maxSize: 'Макс. размер, МБ (0 — без ограничений)',
      maxCount: 'Макс. количество (0 — без ограничений)',
      autoUpload: 'Автозагрузка',
      theme: 'Тема',
      componentLanguage: 'Язык компонента',
      startUpload: 'Начать загрузку',
      clearList: 'Очистить список',
      caption:
        'Меняйте любые параметры и смотрите, как компонент отключает или меняет своё поведение. Загрузка, скачивание и упаковка имитируются в браузере.',
      tip: 'Права, раскладка и ограничения выбора применяются сразу; данные никуда не отправляются.',
    },
  },
}
