<script setup lang="ts">
/* eslint-disable vue/require-default-prop -- omitted values are semantically distinct in the public API */
import { computed, getCurrentInstance, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n-lite'
import { ChunkScheduler } from './core/chunk-scheduler'
import { createFlowUploadI18n, getUploadMessages, type FlowUploadI18nOptions } from './i18n'
import { resolveTheme } from './themes'
import { createHttpUploadTransport } from './core/http-transport'
import { vueFlowUploadConfigKey } from './config'
import 'viewerjs/dist/viewer.css'
import UploadFileList from './components/UploadFileList.vue'
import UploadPictureWall from './components/UploadPictureWall.vue'
import UploadFooter from './components/UploadFooter.vue'
import UploadRemoveDialog from './components/UploadRemoveDialog.vue'
import UploadToolbars from './components/UploadToolbars.vue'
import UploadTrigger from './components/UploadTrigger.vue'
import loadingSvg from './assets/loading.svg'
import { useDownloadManager } from './composables/useDownloadManager'
import { useFilePreview } from './composables/useFilePreview'
import { useFileSelectionState } from './composables/useFileSelectionState'
import { useUploadQueue } from './composables/useUploadQueue'
import { createUid, matchesAccept, normalizeFileList, toCssSize } from './utils/file'
import { makeUploadError } from './utils/error'
import type {
  UploadData,
  DownloadScope,
  DownloadTransport,
  UploadError,
  UploadFileItem,
  UploadPermissions,
  UploadSuccessResult,
  UploadMessages,
  UploadTheme,
  UploadTransport,
  UploadUserFile,
  UploadPagination,
  UploadPaginationConfig,
} from './types'

const props = withDefaults(
  defineProps<{
    /** 受控文件列表；传入后会覆盖内部状态。 Controlled file list; when supplied it replaces internal state. */
    modelValue?: UploadUserFile[]
    /** 非受控模式的初始文件列表。 Initial file list for uncontrolled mode. */
    defaultFileList?: UploadUserFile[]
    /** 自定义传输适配器；省略它并提供 `action` 时使用标准 XHR 上传。 Custom transport adapter; omit it and provide `action` for standard XHR upload. */
    transport?: UploadTransport
    /** 内置普通上传端点。 Built-in normal-upload endpoint. */
    action?: string
    /** 可选的预建文件记录端点，需返回 `fileId`。 Optional endpoint that pre-creates a server file record and returns its `fileId`. */
    createAction?: string
    /** 按 fileId 幂等删除文件及其上传会话的端点。 Endpoint that idempotently deletes a file and all of its upload sessions by fileId. */
    deleteAction?: string
    /** 内置普通上传使用的 HTTP 方法。 HTTP method used by the built-in normal upload. */
    method?: 'POST' | 'PUT'
    /** 下载与服务端打包下载的适配器。 Adapter for direct downloads and server-side archive downloads. */
    downloadTransport?: DownloadTransport
    /** 每次上传附带的业务数据，可为异步工厂。 Business data sent with each upload; may be an async factory. */
    data?: UploadData
    /** multipart 中二进制文件字段名。 Multipart binary-file field name. */
    fileFieldName?: string
    /** multipart 中 JSON 业务数据字段名。 Multipart JSON business-data field name. */
    dataFieldName?: string
    /** 接受的扩展名或 MIME 类型过滤器。 Accepted extension or MIME-type filter. */
    accept?: string | string[]
    /** 单个文件允许的最大字节数。 Maximum allowed size in bytes for one file. */
    maxSize?: number
    /** 允许保留在列表中的最大文件数。 Maximum number of files retained in the list. */
    maxCount?: number
    /** 原生文件选择器是否允许多选。 Whether the native picker permits multiple selection. */
    multiple?: boolean
    /** 选择/拖入后是否立即开始上传。 Whether to start upload immediately after selection/drop. */
    autoUpload?: boolean
    /** 超过该字节数时改用分片上传。 Files larger than this byte threshold use multipart upload. */
    normalUploadThreshold?: number
    /** 单个分片的字节大小。 Byte size of one upload chunk. */
    chunkSize?: number
    /** 每个活动文件同时上传的最大分片数。 Maximum chunks uploaded concurrently for each active file. */
    chunkConcurrency?: number
    /** 同时活动的最大文件数。 Maximum number of active files. */
    maxConcurrentFiles?: number
    /** 全部文件共享的最大请求数。 Maximum requests shared by all files. */
    maxConcurrentRequests?: number
    /** 可重试请求的最大额外尝试次数。 Maximum additional attempts for a retryable request. */
    retryCount?: number
    /** 指数退避的初始等待时间（毫秒）。 Initial exponential-backoff delay in milliseconds. */
    retryBaseDelay?: number
    /** 是否恢复服务端未过期的分片会话。 Whether to resume an unexpired server multipart session. */
    resume?: boolean
    /** 是否先计算 SHA-256 并尝试秒传。 Whether to calculate SHA-256 and attempt instant upload first. */
    instantUpload?: boolean
    /** 是否渲染文件列表。 Whether to render the file list. */
    showFileList?: boolean
    /** 是否渲染工具栏和行操作。 Whether to render the toolbar and row actions. */
    showOperation?: boolean
    /** 设为 false 或省略即隐藏分页；页面数据由宿主加载。 Set to false or omit to hide pagination; the host loads page data. */
    pagination?: UploadPaginationConfig
    /** 是否启用拖入文件。 Whether file drag-and-drop is enabled. */
    drag?: boolean
    /** 是否允许选择文件夹（浏览器支持时）。 Whether directory selection is allowed when the browser supports it. */
    directory?: boolean
    /** 列表、图片墙或图片卡片的展示模式。 Display mode: list, picture wall, or picture card. */
    listType?: 'list' | 'picture' | 'picture-card'
    /** 是否允许图片预览。 Whether image preview is allowed. */
    preview?: boolean
    /** 是否显示用于批量操作的选择框。 Whether to show selection controls for batch operations. */
    selectable?: boolean
    /** 在列表/图片区域显示加载遮罩。 Shows a loading mask over the list/picture display area. */
    loading?: boolean
    /** CSS 宽度；数字按像素处理。 CSS width; numbers are treated as pixels. */
    width?: string | number
    /** CSS 高度；`auto` 表示填满有明确高度的父容器。 CSS height; use `auto` to fill a parent with an explicit height. */
    height?: string | number
    /** 服务端归档任务的轮询间隔（毫秒）。 Polling interval in milliseconds for a server archive task. */
    archivePollingInterval?: number
    /** 服务端归档任务的最长等待时间（毫秒）。 Maximum wait time in milliseconds for a server archive task. */
    archivePollingTimeout?: number
    /** “全部下载”时提交给服务端的文件范围或查询范围。 File or query scope submitted for “download all”. */
    allDownloadScope?: DownloadScope
    /** 自定义预览处理；提供后替代内置图片查看器。 Custom preview handler; replaces the built-in image viewer when provided. */
    onPreview?: (file: UploadFileItem) => void | Promise<void>
    /** 内置主题名或自定义主题适配器。 Built-in theme name or custom theme adapter. */
    theme?: UploadTheme
    /** 推荐的国际化配置，文案使用 `VueFlowUpload` 命名空间。 Preferred i18n configuration; messages use the `VueFlowUpload` namespace. */
    i18n?: FlowUploadI18nOptions
    /** 已废弃，请使用 `i18n.locale`。 @deprecated Use `i18n.locale` instead. */
    locale?: string
    /** 已废弃，请使用 `i18n.messages[locale].VueFlowUpload`。 @deprecated Use `i18n.messages[locale].VueFlowUpload` instead. */
    messages?: Partial<UploadMessages>
    /** 总开关；禁用后所有交互能力均关闭。 Master switch; disables every interactive capability. */
    disabled?: boolean
    /** 按操作粒度控制选择、上传、删除、预览和下载能力。 Per-operation controls for selection, upload, removal, preview, and download. */
    permissions?: UploadPermissions
    /** 客户端校验通过后、创建上传任务前调用；返回 false 会拒绝文件。 Called after client validation and before queueing; false rejects the file. */
    beforeUpload?: (file: File) => boolean | Promise<boolean>
    /** 删除前调用；返回 false 会保留文件。 Called before removal; false keeps the file. */
    beforeRemove?: (file: UploadFileItem, files: UploadFileItem[]) => boolean | Promise<boolean>
  }>(),
  {
    defaultFileList: () => [],
    fileFieldName: 'file',
    dataFieldName: 'data',
    maxCount: Number.POSITIVE_INFINITY,
    multiple: true,
    method: 'POST',
    autoUpload: true,
    normalUploadThreshold: 10 * 1024 * 1024,
    chunkSize: 1 * 1024 * 1024,
    chunkConcurrency: 3,
    maxConcurrentFiles: 2,
    maxConcurrentRequests: 6,
    retryCount: 3,
    retryBaseDelay: 500,
    resume: true,
    instantUpload: true,
    listType: 'list',
    showFileList: true,
    showOperation: true,
    drag: true,
    directory: false,
    preview: true,
    selectable: false,
    loading: false,
    width: 'auto',
    height: '600px',
    archivePollingInterval: 2_000,
    archivePollingTimeout: 10 * 60_000,
    theme: 'default',
    locale: 'zh-CN',
    disabled: false,
    permissions: () => ({}),
  },
)

/** 向宿主同步文件/分页状态，并报告上传、下载、归档各阶段事件。 Emits file/pagination synchronization plus upload, download, and archive lifecycle events to the host. */
const emit = defineEmits<{
  'update:modelValue': [files: UploadFileItem[]]
  change: [file: UploadFileItem, files: UploadFileItem[]]
  progress: [file: UploadFileItem, percent: number]
  success: [file: UploadFileItem, response: UploadSuccessResult]
  error: [file: UploadFileItem, error: UploadError]
  remove: [file: UploadFileItem]
  exceed: [files: File[]]
  'download-start': [file: UploadFileItem]
  'download-success': [file: UploadFileItem]
  'download-error': [file: UploadFileItem, error: UploadError]
  'archive-start': [taskId: string, fileIds: string[]]
  'archive-progress': [taskId: string, percent?: number]
  'archive-success': [taskId: string]
  'archive-error': [taskId: string, error: UploadError]
  'update:pagination': [value: UploadPagination]
  'pagination-change': [currentPage: number, pageSize: number]
}>()

/** v-model/defaultFileList 的本地副本；队列状态变化均以不可变方式更新它。 Local copy of v-model/defaultFileList; all queue transitions update this list immutably. */
const internalFiles = ref<UploadFileItem[]>(
  normalizeFileList(props.modelValue ?? props.defaultFileList),
)
// Uids created by this instance identify transient upload work. Server pages
// supplied through v-model are merged with these rows instead of replacing them.
const localUploadUids = new Set<string>()
/** 插件提供的 URL、认证和上传默认配置。 Plugin-provided URL, auth, and upload-default configuration. */
const globalConfig = inject(vueFlowUploadConfigKey, {})
/** 合并实例分页参数和应用默认值，但不负责加载服务端页面数据。 Merges per-instance pagination with application defaults without owning server data loading. */
const pagination = computed<UploadPagination | undefined>(() => {
  if (!props.pagination) return undefined
  const defaults = globalConfig.defaults?.pagination
  return {
    pageSize: defaults?.pageSize ?? 10,
    pageSizes: defaults?.pageSizes ?? [10, 20, 30, 40],
    ...props.pagination,
  }
})
// 向工具栏按钮和组件使用者暴露隐藏原生 input 的文件选择器。 Exposes the hidden native input's file picker to toolbar buttons and consumers.
const uploadTrigger = ref<{ browse: () => void }>()
// 在文件间共享请求槽位，使文件并发和分片并发限制同时生效。 Shares request slots between files so file and chunk concurrency limits both apply.
/** 规范化并发/尺寸参数，避免零、NaN 或小数破坏调度。 Normalizes concurrency/size inputs so zero, NaN, and fractions cannot break scheduling. */
const positiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : fallback
const scheduler = new ChunkScheduler({
  maxConcurrentChunksPerFile: positiveInteger(
    props.chunkConcurrency ?? globalConfig.defaults?.chunkConcurrency ?? 3,
    3,
  ),
  maxConcurrentFiles: positiveInteger(
    props.maxConcurrentFiles ?? globalConfig.defaults?.maxConcurrentFiles ?? 2,
    2,
  ),
  maxConcurrentRequests: positiveInteger(
    props.maxConcurrentRequests ?? globalConfig.defaults?.maxConcurrentRequests ?? 6,
    6,
  ),
})

/** 将运行时并发 prop 变化应用于待执行任务，不中断已发出的请求。 Applies runtime concurrency-prop changes to queued work without interrupting active requests. */
watch(
  () => [props.chunkConcurrency, props.maxConcurrentFiles, props.maxConcurrentRequests],
  () => {
    scheduler.update({
      maxConcurrentChunksPerFile: positiveInteger(
        props.chunkConcurrency ?? globalConfig.defaults?.chunkConcurrency ?? 3,
        3,
      ),
      maxConcurrentFiles: positiveInteger(
        props.maxConcurrentFiles ?? globalConfig.defaults?.maxConcurrentFiles ?? 2,
        2,
      ),
      maxConcurrentRequests: positiveInteger(
        props.maxConcurrentRequests ?? globalConfig.defaults?.maxConcurrentRequests ?? 6,
        6,
      ),
    })
  },
)

watch(
  () => props.modelValue,
  (value) => {
    // 受控模式由外部模型覆盖本地状态，先补全可选字段。 A controlled model replaces local state; normalize optional fields first.
    if (value === undefined) return
    const incomingFiles = normalizeFileList(value)
    const isLocalPending = (file: UploadFileItem) =>
      localUploadUids.has(file.uid) && !['processing', 'success'].includes(file.status)
    const serverFiles = incomingFiles.filter((file) => !isLocalPending(file))
    const incomingTransient = incomingFiles.filter(isLocalPending)
    const serverIds = new Set(
      serverFiles.map((file) => file.fileId).filter((fileId): fileId is string => !!fileId),
    )
    const transient = [...internalFiles.value, ...incomingTransient].filter(
      (file) => isLocalPending(file) && (!file.fileId || !serverIds.has(file.fileId)),
    )
    const byUid = new Map<string, UploadFileItem>()
    for (const file of [...transient, ...serverFiles]) byUid.set(file.uid, file)
    internalFiles.value = [...byUid.values()]
  },
)

/** 传给队列、预览、选择和下载组合式函数的只读文件视图。 Read-only view passed to queue, preview, selection, and download composables. */
const files = computed(() => internalFiles.value)
/**
 * 已完成文件保持服务端顺序，本地上传任务优先显示；同组保留原始顺序。
 * Completed files retain server order; local work appears first; order stays stable within a group.
 */
const displayedFiles = computed(() => {
  const local = files.value
    .filter((file) => localUploadUids.has(file.uid) && !['processing', 'success'].includes(file.status))
    .map((file, index) => ({ file, index }))
    .sort((left, right) => {
      const priority = (status: UploadFileItem['status']) => {
        if (['uploading', 'hashing', 'checking', 'preparing', 'merging'].includes(status)) return 0
        if (['idle', 'queued', 'paused', 'validating'].includes(status)) return 1
        if (['failed', 'rejected'].includes(status)) return 2
        return 3
      }
      return priority(left.file.status) - priority(right.file.status) || left.index - right.index
    })
    .map(({ file }) => file)
  const localUids = new Set(local.map((file) => file.uid))
  return [...local, ...files.value.filter((file) => !localUids.has(file.uid))]
})
/** 由 disabled 与 permissions 推导、供子控件和组合式函数共享的能力。 Permission-derived capabilities shared by child controls and composables. */
const canSelect = computed(() => !props.disabled && props.permissions.select !== false)
const canUpload = computed(() => !props.disabled && props.permissions.upload !== false)
const canRemove = computed(() => !props.disabled && props.permissions.remove !== false)
const canRetry = computed(() => !props.disabled && props.permissions.retry !== false)
const canPreview = computed(
  () => !props.disabled && props.preview && props.permissions.preview !== false,
)
const canDownload = computed(
  () => !props.disabled && !!props.downloadTransport && props.permissions.download !== false,
)
/** “全部下载”在单文件下载可用且未被单独禁止时才可用。 “Download all” is enabled only when downloads are available and it is not separately denied. */
const canDownloadAll = computed(() => canDownload.value && props.permissions.downloadAll !== false)
/** 将主题预设名或调用方主题适配器解析为 CSS 变量。 Resolves named theme presets or a caller-supplied theme adapter to CSS variables. */
const resolvedTheme = computed(() => resolveTheme(props.theme))
/** 宿主注入的 i18n 实例；不存在时使用下方本地实例。 Host-injected i18n instance; the local instance below is used when absent. */
const inheritedI18n = useI18n()
/** 检测已废弃的 locale/messages prop，确保显式旧用法仍优先于注入 i18n。 Detects deprecated locale/messages props so explicit legacy usage still wins over injected i18n. */
const declaredProps = getCurrentInstance()?.vnode.props
const hasLegacyI18nOptions =
  !!declaredProps && ('locale' in declaredProps || 'messages' in declaredProps)
/** 根据当前 prop 生成隔离的内置语言实例，避免跨组件污染文案。 Isolated built-in i18n instance derived from current props, avoiding cross-component message mutation. */
const localI18n = computed(() =>
  createFlowUploadI18n(
    { locale: props.i18n?.locale ?? props.locale, messages: props.i18n?.messages },
    props.messages,
  ),
)
const i18n = computed(() =>
  props.i18n || hasLegacyI18nOptions ? localI18n.value : (inheritedI18n ?? localI18n.value),
)
/** 解析成模板可直接读取的完整消息字典。 Complete resolved message dictionary for direct template consumption. */
const text = computed(() => getUploadMessages(i18n.value))
/** 翻译组件文案并插入变量的简写函数。 Shorthand for translating component-owned messages with interpolation values. */
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.value.t(`VueFlowUpload.${key}`, values)
/** 当前主题提供的 CSS 自定义属性，绑定到组件根节点。 CSS custom properties provided by the current theme and bound to the component root. */
const themeStyle = computed(() => resolvedTheme.value.variables ?? {})
/** 控制拖放目标的视觉状态；它本身不接收或入队文件。 Controls the visual drop-target state; it does not itself accept or queue files. */
const dragActive = ref(false)
function handleSelectedFiles(selected: File[]) {
  // 原生选择器与拖放均进入同一校验和入队路径。 Native picker and drag/drop both enter the same validation-and-queue path.
  void addFiles(selected)
}
/** 工具栏无效操作时的短暂反馈，例如没有待上传文件。 Ephemeral feedback used for invalid toolbar actions, for example when no pending files exist. */
const toastMessage = ref('')
/** 当前提示的计时器；清理它可防止旧消息隐藏新消息。 Timer for the current toast; clearing it prevents an earlier message from hiding a newer one. */
let toastTimer: number | undefined
/** 等待用户确认、尚未开始远程清理/删除的文件。 Files awaiting user confirmation before remote cleanup/removal begins. */
const pendingRemoval = ref<UploadFileItem[]>([])
/** 串行远程删除期间锁定对话框按钮。 Locks dialog buttons while sequential remote deletion is underway. */
const removalBusy = ref(false)
/** 在确认对话框中保留远程清理失败信息，供用户重试或取消。 Preserves a remote cleanup failure in the confirmation dialog for retry/cancellation. */
const removalError = ref('')
/** 上传面板根节点的尺寸样式。 Size style for the root upload panel. */
const layoutStyle = computed(() => ({
  width: toCssSize(props.width),
  // CSS `auto` 通常按内容定高；本组件特意将其解释为填满父容器高度。
  // CSS `auto` normally sizes to content; this component intentionally treats it as the parent height.
  height: props.height === 'auto' ? '100%' : toCssSize(props.height),
}))
/** 优先使用调用方 transport，否则根据 action props 创建内置 XHR 适配器。 Chooses caller transport first, otherwise creates the built-in XHR adapter from action props. */
const uploadTransport = computed(
  () =>
    props.transport ??
    (props.action
      ? createHttpUploadTransport({
          url: props.action,
          baseUrl: globalConfig.baseUrl,
          createUrl: props.createAction,
          deleteUrl: props.deleteAction,
          method: props.method,
          credentials: globalConfig.auth?.credentials ?? 'same-origin',
        })
      : undefined),
)
function updateFiles(next: UploadFileItem[], changed?: UploadFileItem) {
  // 同步内部列表与 v-model，再上报引发变更的文件。 Keep internal list and v-model in sync, then report the changed file.
  internalFiles.value = next
  emit('update:modelValue', next)
  if (changed) emit('change', changed, next)
}

function updatePagination(value: UploadPagination) {
  // UploadFooter 已合并部分变更；此处将完整值向上转发为 pagination v-model。
  // UploadFooter already merged the partial change; forward it as the pagination v-model value.
  emit('update:pagination', value)
}

function handlePaginationChange(currentPage: number, pageSize: number) {
  // 此事件通知宿主应从自身数据源加载新页。
  // This event tells the host when it should load a new page from its own data source.
  emit('pagination-change', currentPage, pageSize)
}

function updateFile(uid: string, patch: Partial<UploadFileItem>) {
  // 使用不可变替换，确保 Vue 更新依赖此列表的所有组合逻辑和行。 Use immutable replacement so Vue updates all dependent composables and rows.
  const next = files.value.map((file) => (file.uid === uid ? { ...file, ...patch } : file))
  const changed = next.find((file) => file.uid === uid)
  if (changed) updateFiles(next, changed)
  return changed
}

/** 由当前组件 props 和向外事件适配器配置的上传状态机。 Upload state machine configured with this component's props and outward event adapters. */
const uploadQueue = useUploadQueue({
  files,
  canUpload,
  transport: uploadTransport,
  scheduler,
  normalUploadThreshold:
    props.normalUploadThreshold ?? globalConfig.defaults?.normalUploadThreshold ?? 10 * 1024 * 1024,
  chunkSize: positiveInteger(
    props.chunkSize ?? globalConfig.defaults?.chunkSize ?? 1 * 1024 * 1024,
    1 * 1024 * 1024,
  ),
  retryCount: props.retryCount ?? globalConfig.defaults?.retryCount ?? 3,
  retryBaseDelay: props.retryBaseDelay ?? globalConfig.defaults?.retryBaseDelay ?? 500,
  resume: props.resume ?? globalConfig.defaults?.resume ?? true,
  instantUpload: props.instantUpload ?? globalConfig.defaults?.instantUpload ?? true,
  fileFieldName: props.fileFieldName,
  dataFieldName: props.dataFieldName,
  resolveData,
  resolveHeaders,
  resolveQuery,
  updateFile,
  onProgress: (file, percent) => emit('progress', file, percent),
  onSuccess: (file, response) => emit('success', file, response),
  onError: (file, error) => emit('error', file, error),
})
/** 暴露给行操作、工具栏及组件公开 API 的队列命令。 Queue commands exposed to row actions, toolbar actions, and the public component API. */
const {
  upload,
  submit,
  retry,
  pause,
  resume: resumeUpload,
  abort,
  clear: clearUploads,
  requestMeta,
} = uploadQueue
/** 委托给可选下载 transport 的下载/打包命令。 Download/archive commands delegated to the optional download transport. */
const {
  download,
  downloadSelected,
  downloadAll,
  cancelArchive,
  clear: clearDownloads,
} = useDownloadManager({
  files,
  transport: computed(() => props.downloadTransport),
  canDownload,
  canDownloadAll,
  allDownloadScope: props.allDownloadScope,
  archivePollingInterval: props.archivePollingInterval,
  archivePollingTimeout: props.archivePollingTimeout,
  requestMeta: async () =>
    requestMeta(await resolveData(), await resolveHeaders(), await resolveQuery()),
  onDownloadStart: (file) => emit('download-start', file),
  onDownloadSuccess: (file) => emit('download-success', file),
  onDownloadError: (file, error) => {
    emit('download-error', file, error)
    emit('error', file, error)
  },
  onArchiveStart: (taskId, fileIds) => emit('archive-start', taskId, fileIds),
  onArchiveProgress: (taskId, percent) => emit('archive-progress', taskId, percent),
  onArchiveSuccess: (taskId) => emit('archive-success', taskId),
  onArchiveError: (taskId, error) => emit('archive-error', taskId, error),
})
/** 预览辅助函数持有本地对象 URL，并在删除/卸载时释放。 Preview helpers own local object URLs and release them on removal/unmount. */
const {
  imageUrl,
  previewFile,
  revoke: revokePreviewUrl,
  clear: clearPreviews,
} = useFilePreview({ files, canPreview, onPreview: props.onPreview })
/** 批量选择状态仅包含拥有服务端 fileId 的行。 Batch-selection state only includes rows backed by a server file id. */
const {
  selected,
  selectableFiles,
  allSelected: allSelectableFilesSelected,
  toggle: toggleSelected,
  toggleAll: toggleAllSelected,
  remove: removeSelection,
  clear: clearSelection,
} = useFileSelectionState(files)

async function addFiles(selected: File[]) {
  // 逐个处理文件，异步校验完成后才可自动上传。 Process one file at a time so validation finishes before auto-upload.
  if (!selected.length || !canSelect.value) return
  const available = Math.max(0, props.maxCount - files.value.length)
  const accepted = selected.slice(0, available)
  const exceeded = selected.slice(available)
  if (exceeded.length) emit('exceed', exceeded)

  for (const file of accepted) {
    const item: UploadFileItem = {
      uid: createUid(),
      fileId: createUid(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'validating',
      percent: 0,
      file,
    }
    localUploadUids.add(item.uid)
    updateFiles([...files.value, item], item)
    const error = await validate(file)
    if (error) {
      const rejected = updateFile(item.uid, { status: 'rejected', error })
      if (rejected) emit('error', rejected, error)
      continue
    }
    const idle = updateFile(item.uid, { status: 'idle' })
    if (idle && props.autoUpload) void upload(idle.uid)
  }
}

function showToast(message: string) {
  // 替换而非排队显示短提示，并重置过期计时器。
  // Replace, rather than queue, short toolbar feedback and reset its expiration timer.
  toastMessage.value = message
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
    toastTimer = undefined
  }, 1800)
}

async function handleUpload() {
  // 任一文件正在状态机中推进时，不允许重复手动提交。
  // Manual submit is disabled while any file is already progressing through the state machine.
  const active = files.value.some((file) =>
    ['uploading', 'hashing', 'checking', 'preparing', 'queued', 'merging', 'processing'].includes(
      file.status,
    ),
  )
  if (active) {
    showToast(text.value.uploadingToast)
    return
  }
  const pending = files.value.some((file) => file.status === 'idle')
  if (!pending) {
    showToast(text.value.noUploadFilesToast)
    return
  }
  await submit()
}

async function validate(file: File): Promise<UploadError | undefined> {
  // 校验失败保留为 rejected 行，用户可以看到失败原因。 Keep validation failures as rejected rows so users can see why.
  if (props.maxSize !== undefined && file.size > props.maxSize) {
    return makeUploadError('FILE_TOO_LARGE', t('fileTooLarge', { name: file.name }), false)
  }
  if (!matchesAccept(file, props.accept)) {
    return makeUploadError(
      'FILE_TYPE_NOT_ALLOWED',
      t('fileTypeNotAllowed', { name: file.name }),
      false,
    )
  }
  if (props.beforeUpload && !(await props.beforeUpload(file))) {
    return makeUploadError(
      'BEFORE_UPLOAD_REJECTED',
      t('beforeUploadRejected', { name: file.name }),
      false,
    )
  }
}

async function removeSelected() {
  // 根据当前列表解析选中 id，弹窗期间文件可能已变化。 Resolve selected ids against the current list because files may change while dialog is open.
  const targets = files.value.filter((file) => selected.value.has(file.uid))
  if (!targets.length) {
    showToast(text.value.noRemoveFilesToast)
    return
  }
  const direct = targets.filter((file) => !requiresRemovalConfirmation(file))
  for (const file of direct) await removeImmediately(file)
  const confirmed = targets.filter(requiresRemovalConfirmation)
  if (confirmed.length) openRemovalConfirmation(confirmed)
}

function handleDownloadSelected(uids: string[]) {
  if (!uids.length) {
    showToast(text.value.noDownloadFilesToast)
    return
  }
  void downloadSelected(uids)
}

async function remove(uid: string) {
  // 已完成远端文件需要确认；本地或未完成文件可立即移除。 Completed remote files need confirmation; local/incomplete files remove immediately.
  const target = files.value.find((file) => file.uid === uid)
  if (!target || !canRemove.value) return false
  if (requiresRemovalConfirmation(target)) {
    openRemovalConfirmation([target])
    return false
  }
  return removeImmediately(target)
}

function requiresRemovalConfirmation(file: UploadFileItem) {
  // 仅已持久化的成功文件可能需要确认服务端清理。 Only persisted successful files may need server cleanup confirmation.
  return !['idle', 'validating', 'rejected'].includes(file.status)
}

function openRemovalConfirmation(targets: UploadFileItem[]) {
  // 保存删除目标快照，使弹窗内容保持稳定。 Store a target snapshot so dialog content stays stable.
  pendingRemoval.value = targets
  removalError.value = ''
}

function closeRemovalConfirmation() {
  // 关闭不修改文件，只丢弃待确认状态。 Closing never mutates files; it only discards pending confirmation.
  if (removalBusy.value) return
  pendingRemoval.value = []
  removalError.value = ''
}

async function confirmRemoval() {
  // 串行处理目标，使远端清理和报错顺序可预测。 Process targets serially for deterministic cleanup and errors.
  removalBusy.value = true
  removalError.value = ''
  try {
    for (const file of pendingRemoval.value) await removeImmediately(file)
    pendingRemoval.value = []
  } catch {
    removalError.value = text.value.removeCleanupFailed
  } finally {
    removalBusy.value = false
  }
}

async function removeImmediately(target: UploadFileItem) {
  // 本地删除前先取消进行中的任务；存在时 deleteFile 清理服务端记录。 Cancel in-flight work first; deleteFile clears the server record when present.
  try {
    if (props.beforeRemove && !(await props.beforeRemove(target, files.value))) return false
  } catch {
    return false
  }
  const cleanupRequired = requiresRemovalConfirmation(target)
  if (cleanupRequired) {
    if (!target.fileId || !uploadTransport.value?.deleteFile)
      throw new Error('DELETE_FILE_NOT_CONFIGURED')
    uploadQueue.abort(target.uid)
    await uploadTransport.value.deleteFile(
      target.fileId,
      requestMeta(await resolveData(), await resolveHeaders(), await resolveQuery()),
    )
  }
  revokePreviewUrl(target.uid)
  removeSelection(target.uid)
  localUploadUids.delete(target.uid)
  updateFiles(
    files.value.filter((file) => file.uid !== target.uid),
    target,
  )
  emit('remove', target)
  return true
}

function handleStart(file: File) {
  // 触发器一次发出一个文件，中心 add 路径则接受批量文件。
  // The trigger emits one file at a time, while the central add path accepts batches.
  return addFiles([file])
}

function handleRemove(file: string | UploadFileItem) {
  // 同时支持公开 uid API 与传入完整文件项的插槽回调。
  // Support both the exposed uid API and slot callbacks that pass the full item.
  return remove(typeof file === 'string' ? file : file.uid)
}

function clear() {
  // 清空模型前取消后台任务，并释放选择/预览资源。
  // Abort background work and release selection/preview resources before emptying the model.
  clearUploads()
  clearPreviews()
  clearSelection()
  clearDownloads()
  localUploadUids.clear()
  updateFiles([])
}

async function resolveData() {
  // data 可以是静态值或异步函数，使调用方能为每次请求附加最新凭据/元数据。
  // Data may be static or async so callers can attach fresh credentials/metadata per request.
  return typeof props.data === 'function' ? await props.data() : (props.data ?? {})
}

async function resolveHeaders() {
  const headers = globalConfig.auth?.headers
  return typeof headers === 'function' ? await headers() : (headers ?? {})
}

async function resolveQuery() {
  const query = globalConfig.auth?.query
  return typeof query === 'function' ? await query() : (query ?? {})
}

function statusText(status: UploadFileItem['status']) {
  // 集中维护状态到文案的映射，确保列表行和自定义插槽使用相同文本。
  // Centralize status-to-copy mapping so list rows and custom slots use identical language.
  return {
    idle: text.value.waiting,
    validating: text.value.validating,
    hashing: text.value.hashing,
    checking: text.value.checking,
    uploading: text.value.uploading,
    preparing: text.value.waiting,
    queued: text.value.waiting,
    paused: text.value.paused,
    merging: text.value.uploading,
    processing: text.value.processing,
    success: text.value.completed,
    failed: text.value.uploadFailed,
    canceled: text.value.canceled,
    rejected: text.value.rejected,
  }[status]
}

function isFileDrag(event: DragEvent) {
  // 忽略文本/URL 拖拽；只有文件载荷可激活上传拖放区。
  // Ignore text/URL drags; only file payloads should activate the upload drop zone.
  const transfer = event.dataTransfer
  return !!transfer && (transfer.files.length > 0 || Array.from(transfer.types).includes('Files'))
}

function onDragEnter(event: DragEvent) {
  // 阻止浏览器导航，并在文件拖入时显示激活态。
  // Prevent browser navigation and show the active drop affordance for file drags.
  if (!props.drag || !canSelect.value || !isFileDrag(event)) return
  event.preventDefault()
  dragActive.value = true
}

function onDragOver(event: DragEvent) {
  // 浏览器要求在 dragover 中重复 preventDefault，才允许随后 drop。
  // Repeating preventDefault is required for browsers to permit a subsequent drop.
  if (!props.drag || !canSelect.value || !isFileDrag(event)) return
  event.preventDefault()
}

function onDragLeave(event: DragEvent) {
  // 仅离开组件时重置，不在子节点间移动时重置。
  // Reset only when leaving the component, not when moving between its children.
  if (!props.drag || !dragActive.value) return
  const container = event.currentTarget as HTMLElement | null
  const nextTarget = event.relatedTarget as Node | null
  if (!nextTarget || !container?.contains(nextTarget)) dragActive.value = false
}

function onDrop(event: DragEvent) {
  // 一次读取拖入文件，清除视觉状态，并走常规校验路径。
  // Read dropped files once, clear visual state, and route them through normal validation.
  if (!props.drag || !canSelect.value || !isFileDrag(event)) return
  event.preventDefault()
  dragActive.value = false
  const dropped = Array.from(event.dataTransfer?.files ?? [])
  void addFiles(dropped)
}

onBeforeUnmount(clear)

/** 组件实例公开的方法；供 ref 调用上传、暂停、重试、删除与下载操作。 Public instance methods for refs to upload, pause, retry, remove, and download. */
defineExpose({
  submit,
  abort,
  pause,
  resume: resumeUpload,
  retry,
  remove,
  clear,
  clearFiles: clear,
  handleStart,
  handleRemove,
  download,
  downloadSelected,
  downloadAll,
  cancelArchive,
})
</script>

<template>
  <section
    class="vfu-upload"
    :class="resolvedTheme.className"
    :style="[themeStyle, layoutStyle]"
    :aria-label="text.selectFile"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <UploadTrigger
      ref="uploadTrigger"
      :directory="directory"
      :multiple="multiple"
      :accept="accept"
      :can-select="canSelect"
      @files="handleSelectedFiles"
    />
    <slot name="tip" />

    <div v-if="showOperation" class="vfu-upload__operation">
      <UploadToolbars
        :files="files"
        :selectable="selectable"
        :selected="selected"
        :selectable-count="selectableFiles.length"
        :all-selected="allSelectableFilesSelected"
        :can-select="canSelect"
        :can-remove="canRemove"
        :can-download-all="canDownloadAll"
        :drag="drag"
        :accept="accept"
        :max-size="maxSize"
        :text="text"
        :auto-upload="autoUpload"
        :can-upload="canUpload"
        @select="uploadTrigger?.browse()"
        @upload="handleUpload"
        @toggle-all="toggleAllSelected"
        @download-selected="handleDownloadSelected"
        @download-all="downloadAll"
        @remove-selected="removeSelected"
      />
    </div>

    <div class="vfu-upload__display" :aria-busy="loading || undefined">
      <UploadPictureWall
        v-if="listType === 'picture' || listType === 'picture-card'"
        :files="displayedFiles"
        :show="showFileList"
        :list-type="listType"
        :selectable="selectable"
        :selected="selected"
        :can-upload="canUpload"
        :can-retry="canRetry"
        :can-preview="canPreview"
        :can-download="canDownload"
        :can-remove="canRemove"
        :text="text"
        :status-text="statusText"
        :image-url="imageUrl"
        :toggle-selected="toggleSelected"
        :remove="remove"
        :preview="previewFile"
        :download="download"
        :pause="pause"
        :resume="resumeUpload"
        :retry="retry"
      >
        <template v-if="$slots.file" #file="slotProps">
          <slot name="file" v-bind="slotProps" />
        </template>
      </UploadPictureWall>
      <UploadFileList
        v-else
        :files="displayedFiles"
        :show="showFileList"
        list-type="list"
        :selectable="selectable"
        :selected="selected"
        :can-upload="canUpload"
        :can-retry="canRetry"
        :can-preview="canPreview"
        :can-download="canDownload"
        :can-remove="canRemove"
        :text="text"
        :status-text="statusText"
        :image-url="imageUrl"
        :toggle-selected="toggleSelected"
        :remove="remove"
        :preview="previewFile"
        :download="download"
        :pause="pause"
        :resume="resumeUpload"
        :retry="retry"
      >
        <template v-if="$slots.file" #file="slotProps">
          <slot name="file" v-bind="slotProps" />
        </template>
      </UploadFileList>
      <div v-if="loading" class="vfu-upload__loading-mask" role="status" aria-live="polite">
        <img :src="loadingSvg" alt="" aria-hidden="true" />
      </div>
    </div>
    <UploadFooter
      :visible="showFileList && !!pagination"
      :pagination="pagination"
      @update:pagination="updatePagination"
      @pagination-change="handlePaginationChange"
    />

    <UploadRemoveDialog
      :files="pendingRemoval"
      :busy="removalBusy"
      :error="removalError"
      :title="text.removeConfirmTitle"
      :message="text.removeConfirmMessage"
      :cancel-text="text.cancel"
      :confirm-text="text.remove"
      :processing-text="text.removeConfirmProcessing"
      @cancel="closeRemovalConfirmation"
      @confirm="confirmRemoval"
    />

    <div v-if="drag && dragActive" class="vfu-upload__drop-mask" aria-live="polite">
      <span class="vfu-upload__drop-message">{{ text.dropToUpload }}</span>
    </div>
    <div v-if="toastMessage" class="vfu-upload__toast" role="status" aria-live="polite">
      {{ toastMessage }}
    </div>
  </section>
</template>

<style lang="scss">
@use './styles/flow-upload.scss';
</style>
