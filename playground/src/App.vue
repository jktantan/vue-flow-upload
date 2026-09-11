<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  FlowUpload,
  AvatarUpload,
  createHttpUploadTransport,
  type DownloadTransport,
  type UploadFileItem,
  type UploadPermissions,
  type UploadTransport,
} from 'vue-flow-upload'

/** 演示台中的受控分页状态。 Controlled pagination state used by the workbench. */
type PlaygroundPagination = {
  total?: number
  currentPage?: number
  pageSize?: number
  pageSizes?: number[]
}

/** 本地头像读取接口返回的最小响应结构。 Minimal response structure returned by the local avatar read endpoint. */
interface LocalAvatarResponse {
  /** 当前头像；未设置时服务端返回 null。 Current avatar; the server returns null when none has been set. */
  avatar: {
    /** 持久化文件标识。 Persistent file identifier. */
    fileId: string
    /** 文件显示名称。 File display name. */
    name: string
    /** 文件大小，单位字节。 File size in bytes. */
    size: number
    /** 文件 MIME 类型。 File MIME type. */
    mimeType: string
    /** 可访问的本地预览地址。 Accessible local preview URL. */
    url: string
  } | null
}

/**
 * Playground 预置网络失败的本地化文案；文件名保留为用户数据，不随界面语言转换。
 * Localized text for the playground's seeded network failure; file names remain user data and are not translated with the interface.
 */
const PLAYGROUND_NETWORK_ERROR_MESSAGES = {
  /** 简体中文错误提示。 Simplified Chinese error message. */
  'zh-CN': '网络连接中断，请重试',
  /** 英文错误提示。 English error message. */
  'en-US': 'Network connection interrupted. Please retry.',
} as const

const files = ref<UploadFileItem[]>([
  {
    uid: 'sample-pending',
    name: '待上传的产品合作协议（用于展示超长文件名在列表模式中的截断效果）.pdf',
    size: 2.4 * 1024 * 1024,
    type: 'application/pdf',
    status: 'idle',
    percent: 0,
  },
  {
    uid: 'sample-uploading',
    name: '正在上传的项目资料压缩包.zip',
    size: 8.6 * 1024 * 1024,
    type: 'application/zip',
    status: 'uploading',
    percent: 62,
  },
  {
    uid: 'sample-contract',
    name: '已上传的产品合作协议.pdf',
    size: 2.4 * 1024 * 1024,
    type: 'application/pdf',
    status: 'success',
    percent: 100,
    fileId: 'sample-contract',
  },
  {
    uid: 'sample-failed',
    name: '上传失败的营业执照扫描件.pdf',
    size: 1.2 * 1024 * 1024,
    type: 'application/pdf',
    status: 'failed',
    percent: 48,
    error: {
      code: 'NETWORK_ERROR',
      message: '网络连接中断，请重试',
      retriable: true,
    },
  },
])
/** 是否在选择后立即启动上传队列。 Whether the upload queue starts immediately after file selection. */
const autoUpload = ref(true)
const mode = ref<'mock' | 'local'>('mock')
const clearing = ref(false)
/** 是否启用文件拖入区域。 Whether the file drag-and-drop area is enabled. */
const drag = ref(true)
/** 是否允许原生文件选择器多选。 Whether the native file picker allows multiple selections. */
const multiple = ref(true)
/** 是否请求浏览器提供目录选择。 Whether the browser is asked to provide directory selection. */
const directory = ref(false)
/** 是否渲染文件列表。 Whether the file list is rendered. */
const showFileList = ref(true)
/** 是否渲染工具栏和文件行操作。 Whether toolbars and file-row actions are rendered. */
const showOperation = ref(true)
/** 是否允许图片预览。 Whether image preview is allowed. */
const preview = ref(true)
/** 是否显示用于批量操作的选择框。 Whether selection checkboxes for batch actions are shown. */
const selectable = ref(true)
/** 是否禁用上传组件的所有交互。 Whether all uploader interactions are disabled. */
const disabled = ref(false)
/** 文件选择接受条件，直接映射到组件 accept prop。 File-picker acceptance rule mapped directly to the component accept prop. */
const accept = ref('image/*,.pdf,.zip')
/** 单个文件允许的最大尺寸，单位为 MiB。 Maximum allowed size for a single file in MiB. */
const maxSizeMiB = ref(20)
/** 文件列表中允许保留的最大条数。 Maximum number of rows retained in the file list. */
const maxCount = ref(5)
/** 根容器宽度；数字或 CSS 尺寸均可输入。 Root container width; accepts a number or CSS size. */
const uploadWidth = ref('auto')
/** 根容器高度；auto 会填满拥有明确高度的父级。 Root container height; auto fills a parent with an explicit height. */
const uploadHeight = ref('600px')
/** 普通上传与分片上传的分界大小，单位为 MiB。 Size boundary between normal and multipart upload in MiB. */
const normalUploadThresholdMiB = ref(1)
/** 单个分片大小，单位为 KiB。 Size of one multipart chunk in KiB. */
const chunkSizeKiB = ref(256)
/** 单个文件可同时传输的分片数。 Number of chunks one file may transfer concurrently. */
const chunkConcurrency = ref(2)
/** 同时占用上传队列的最大文件数。 Maximum files occupying upload queue slots at once. */
const maxConcurrentFiles = ref(2)
/** 所有文件共享的最大网络请求数。 Maximum network requests shared across all files. */
const maxConcurrentRequests = ref(3)
/** 可重试失败的额外尝试次数。 Additional attempts allowed for retryable failures. */
const retryCount = ref(3)
/** 重试退避的首个等待时间，单位毫秒。 First retry backoff duration in milliseconds. */
const retryBaseDelayMs = ref(500)
/** 是否恢复未过期的分片会话。 Whether unexpired multipart sessions are resumed. */
const resume = ref(true)
/** 是否计算哈希并尝试秒传。 Whether to calculate a hash and attempt instant upload. */
const instantUpload = ref(true)
/** 上传组件使用的内置主题名称。 Built-in theme name used by the upload component. */
const theme = ref<'default' | 'element-plus' | 'ant-design-vue'>('default')
/** 单组件语言；用于验证语言资源和布局变化。 Per-component locale used to verify language resources and layout changes. */
const locale = ref<'zh-CN' | 'en-US'>('zh-CN')
/** 上传前回调是否主动拒绝文件。 Whether the before-upload callback actively rejects files. */
const rejectBeforeUpload = ref(false)
/** 删除前回调是否主动保留文件。 Whether the before-remove callback actively keeps files. */
const rejectBeforeRemove = ref(false)
/** 自定义预览回调是否替代内置预览器。 Whether a custom preview callback replaces the built-in previewer. */
const useCustomPreview = ref(false)
/** 按操作粒度开关上传组件权限。 Per-operation permissions toggled for the upload component. */
const permissions = ref<UploadPermissions>({})
/** 服务端归档任务的轮询间隔，单位毫秒。 Server archive-task polling interval in milliseconds. */
const archivePollingIntervalMs = ref(2_000)
/** 服务端归档任务的最长等待时间，单位毫秒。 Maximum server archive-task wait time in milliseconds. */
const archivePollingTimeoutMs = ref(10 * 60_000)
const loading = ref(false)
/** 文件列表的视觉布局类型。 Visual layout type for the file list. */
const listType = ref<'list' | 'picture' | 'picture-card'>('list')
const paginationEnabled = ref(true)
/** 上传组件的分页配置；宿主负责根据分页事件加载对应数据。 Upload component pagination configuration; the host loads corresponding data after pagination events. */
const pagination = ref({
  total: files.value.length,
  currentPage: 1,
  pageSize: 10,
  pageSizes: [10, 20, 50, 100],
})
const eventLog = ref<string[]>([])
const avatar = ref<UploadFileItem[]>([])
/** 头像更新端点模板；现有头像会将 {fileId} 替换为服务端标识。 Avatar update endpoint template; an existing avatar replaces {fileId} with its server identifier. */
const avatarUpdateAction = ref('/api/avatar/{fileId}')
/** 头像卡片宽度，单位像素。 Avatar-card width in pixels. */
const avatarWidthPx = ref(240)
/** 头像卡片高度，单位像素。 Avatar-card height in pixels. */
const avatarHeightPx = ref(240)
/** 头像源文件允许的最大尺寸，单位为 MiB。 Maximum allowed avatar source-file size in MiB. */
const avatarMaxSizeMiB = ref(5)
let loadingTimer: number | undefined
let listRequestId = 0

function testLoading() {
  if (loadingTimer !== undefined) window.clearTimeout(loadingTimer)
  loading.value = true
  loadingTimer = window.setTimeout(() => {
    loading.value = false
    loadingTimer = undefined
  }, 3_000)
}

onBeforeUnmount(() => {
  if (loadingTimer !== undefined) window.clearTimeout(loadingTimer)
})

const mockTransport: UploadTransport = {
  createFile({ fileId, name }) {
    eventLog.value.unshift(`创建文件记录：${name}`)
    return Promise.resolve({ fileId: fileId ?? `demo-file-${Date.now()}` })
  },
  deleteFile(fileId) {
    eventLog.value.unshift(`清理文件及上传会话：${fileId}`)
    return Promise.resolve()
  },
  checkFile({ name }) {
    const exists = name.startsWith('instant-')
    eventLog.value.unshift(exists ? `秒传命中：${name}` : `秒传未命中：${name}`)
    return Promise.resolve({
      exists,
      file: exists ? { fileId: `instant-${name}`, name } : undefined,
    })
  },
  uploadFile({ file }, { onProgress, signal, headers, data }) {
    eventLog.value.unshift(
      `开始上传：${file.name}（headers ${Object.keys(headers).length} 项，data ${Object.keys(data).length} 项）`,
    )
    return new Promise((resolve, reject) => {
      let loaded = 0
      const timer = window.setInterval(() => {
        loaded = Math.min(file.size, loaded + Math.max(1, Math.ceil(file.size / 8)))
        onProgress(loaded, file.size)
        if (loaded >= file.size) {
          window.clearInterval(timer)
          eventLog.value.unshift(`上传完成：${file.name}`)
          resolve({
            fileId: `demo-${file.name}`,
            name: file.name,
            size: file.size,
            mimeType: file.type,
          })
        }
      }, 180)
      signal.addEventListener(
        'abort',
        () => {
          window.clearInterval(timer)
          reject({ code: 'ABORTED', message: '上传已取消', retriable: false })
        },
        { once: true },
      )
    })
  },
  initMultipart({ name, totalChunks }) {
    eventLog.value.unshift(`创建分片会话：${name}（${totalChunks} 块）`)
    return Promise.resolve({ uploadId: `demo-session-${name}` })
  },
  uploadChunk({ chunkIndex, chunk }, { onProgress, signal }) {
    return new Promise((resolve, reject) => {
      let loaded = 0
      const timer = window.setInterval(() => {
        loaded = Math.min(chunk.size, loaded + Math.max(1, Math.ceil(chunk.size / 5)))
        onProgress(loaded, chunk.size)
        if (loaded === chunk.size) {
          window.clearInterval(timer)
          eventLog.value.unshift(`分片 ${chunkIndex + 1} 上传完成`)
          resolve()
        }
      }, 120)
      signal.addEventListener(
        'abort',
        () => {
          window.clearInterval(timer)
          reject({ code: 'ABORTED', message: '上传已取消', retriable: false })
        },
        { once: true },
      )
    })
  },
  completeMultipart(uploadId, { data }) {
    eventLog.value.unshift(`合并分片：${uploadId}（业务参数 ${Object.keys(data).length} 项）`)
    return Promise.resolve({ fileId: uploadId })
  },
}

const localTransport = createHttpUploadTransport({
  url: '/api/files/upload',
  createUrl: '/api/files',
  deleteUrl: (fileId) => `/api/files/${encodeURIComponent(fileId)}`,
  checkUrl: '/api/files/check',
  multipart: {
    initUrl: '/api/multipart/init',
    chunkUrl: (uploadId, index) => `/api/multipart/${encodeURIComponent(uploadId)}/chunks/${index}`,
    completeUrl: (uploadId) => `/api/multipart/${encodeURIComponent(uploadId)}/complete`,
  },
})
/** 当前传输适配器；Mock 用于观察状态，本地 SQLite 用于验证真实请求。 Active transport adapter; Mock visualizes state while local SQLite validates real requests. */
const activeTransport = computed(() => (mode.value === 'local' ? localTransport : mockTransport))

const downloadTransport: DownloadTransport = {
  downloadFile({ fileName }) {
    return Promise.resolve({ blob: new window.Blob([`Mock download: ${fileName}`]), fileName })
  },
  createArchive() {
    return Promise.resolve({
      taskId: `archive-${Date.now()}`,
      status: 'success',
      downloadUrl: 'data:text/plain,Mock archive',
    })
  },
  getArchiveTask(taskId) {
    return Promise.resolve({
      taskId,
      status: 'success',
      downloadUrl: 'data:text/plain,Mock archive',
    })
  },
}

const localDownloadTransport: DownloadTransport = {
  async downloadFile({ fileId, fileName }) {
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`)
    if (!response.ok) throw new Error(`下载失败（${response.status}）`)
    return { blob: await response.blob(), fileName }
  },
  async createArchive({ fileIds }) {
    const response = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    })
    if (!response.ok) throw new Error(`创建打包下载失败（${response.status}）`)
    return response.json()
  },
  async getArchiveTask(taskId) {
    const response = await fetch(`/api/archives/${encodeURIComponent(taskId)}`)
    if (!response.ok) throw new Error(`读取打包下载状态失败（${response.status}）`)
    return response.json()
  },
}
const activeDownloadTransport = computed(() =>
  mode.value === 'local' ? localDownloadTransport : downloadTransport,
)

async function loadLocalFiles(
  currentPage = pagination.value.currentPage,
  pageSize = pagination.value.pageSize,
) {
  const requestId = ++listRequestId
  const query = new window.URLSearchParams({
    pagination: String(paginationEnabled.value),
    currentPage: String(currentPage),
    pageSize: String(pageSize),
  })
  loading.value = true
  try {
    const response = await fetch(`/api/files?${query}`)
    if (!response.ok) throw new Error(`加载本地文件失败（${response.status}）`)
    const result = (await response.json()) as {
      files: Array<{ fileId: string; name: string; size: number; mimeType: string; url: string }>
      total: number
    }
    // A slower, earlier request must not overwrite the latest page.
    if (requestId !== listRequestId) return
    files.value = result.files.map((file) => ({
      uid: file.fileId,
      fileId: file.fileId,
      name: file.name,
      size: file.size,
      type: file.mimeType,
      status: 'success',
      percent: 100,
      url: file.url,
    }))
    pagination.value = { ...pagination.value, currentPage, pageSize, total: result.total }
    eventLog.value.unshift(
      paginationEnabled.value
        ? `已加载第 ${currentPage} 页，共 ${result.total} 个本地文件`
        : `已加载全部 ${result.total} 个本地文件`,
    )
  } catch (error) {
    if (requestId !== listRequestId) return
    const message = error instanceof Error ? error.message : '加载本地文件失败'
    eventLog.value.unshift(message)
    window.alert(message)
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

/**
 * 从本地 SQLite 对应的头像接口回读当前记录，使刷新后的演示仍能验证替换结果。
 * Reloads the current record from the avatar endpoint backed by local SQLite so a refresh can still verify replacement results.
 */
async function loadLocalAvatar(): Promise<void> {
  try {
    // 本地接口显式返回 null，区分“尚无头像”与网络或解析失败。
    // The local endpoint explicitly returns null, distinguishing "no avatar yet" from a network or parsing failure.
    const response = await fetch('/api/avatar/current')
    if (!response.ok) throw new Error(`加载本地头像失败（${response.status}）`)
    const result = (await response.json()) as LocalAvatarResponse
    if (!result.avatar) {
      avatar.value = []
      return
    }
    avatar.value = [
      {
        uid: result.avatar.fileId,
        fileId: result.avatar.fileId,
        name: result.avatar.name,
        size: result.avatar.size,
        type: result.avatar.mimeType,
        status: 'success',
        percent: 100,
        url: result.avatar.url,
      },
    ]
    eventLog.value.unshift(`已从 SQLite 回读头像：${result.avatar.name}`)
  } catch (error) {
    // 头像读取失败不阻塞文件列表验证，但必须保留错误上下文供维护者排查。
    // Avatar read failures must not block file-list verification, but retain context for maintainers to diagnose.
    const message = error instanceof Error ? error.message : '加载本地头像失败'
    eventLog.value.unshift(message)
  }
}

/**
 * 将已由组件上传成功的文件设为 SQLite 中的当前头像；仅本地模式执行此额外关联写入。
 * Marks a component-uploaded file as the current avatar in SQLite; this extra association write runs only in local mode.
 */
async function persistLocalAvatar(file: UploadFileItem): Promise<void> {
  if (mode.value !== 'local' || !file.fileId) return
  try {
    // 文件字节已在上传流程中落盘，此请求只建立单头像槽位与文件记录的关联。
    // File bytes were already stored by the upload flow; this request only associates the single-avatar slot with that record.
    const response = await fetch('/api/avatar/current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file.fileId }),
    })
    if (!response.ok) throw new Error(`保存本地头像关联失败（${response.status}）`)
    eventLog.value.unshift(`头像已写入 SQLite：${file.name}`)
  } catch (error) {
    // 关联失败必须可见，否则 UI 成功状态会掩盖刷新后丢失头像的问题。
    // Association failures must be visible; otherwise a successful UI state would hide an avatar lost after refresh.
    const message = error instanceof Error ? error.message : '保存本地头像关联失败'
    eventLog.value.unshift(message)
  }
}

async function clearLocalData() {
  if (!window.confirm('将永久删除本地 SQLite 记录、已上传文件和未完成分片会话，是否继续？')) return
  clearing.value = true
  try {
    const response = await fetch('/api/test/reset', { method: 'POST' })
    if (!response.ok) throw new Error(`清空失败（${response.status}）`)
    files.value = []
    pagination.value = { ...pagination.value, total: 0 }
    avatar.value = []
    eventLog.value.unshift('已清空本地 SQLite 与上传目录')
  } catch (error) {
    eventLog.value.unshift(error instanceof Error ? error.message : '清空本地数据失败')
  } finally {
    clearing.value = false
  }
}

watch(mode, (value) => {
  if (value === 'local') {
    void loadLocalFiles()
    void loadLocalAvatar()
  }
})

/**
 * 仅更新 playground 注入的示例错误，使其与组件 locale 一致；真实服务端错误仍原样保留。
 * Updates only the playground-injected sample error to match the component locale; real server errors remain untouched.
 */
function synchronizeSampleErrorLocale(): void {
  files.value = files.value.map((file) => {
    if (file.uid !== 'sample-failed' || !file.error) return file
    return {
      ...file,
      error: {
        ...file.error,
        message: PLAYGROUND_NETWORK_ERROR_MESSAGES[locale.value],
      },
    }
  })
}

/**
 * locale 变化时同步预置失败文案，避免演示数据与组件内置文本显示不同语言。
 * Synchronizes seeded failure text when locale changes, preventing demo data from displaying a different language than component text.
 */
watch(locale, synchronizeSampleErrorLocale)

watch(paginationEnabled, () => {
  pagination.value = { ...pagination.value, currentPage: 1 }
  if (mode.value === 'local') void loadLocalFiles(1, pagination.value.pageSize)
})

function handlePaginationChange(currentPage: number, pageSize: number) {
  if (mode.value === 'local') {
    void loadLocalFiles(currentPage, pageSize)
    return
  }
  eventLog.value.unshift(`分页切换：第 ${currentPage} 页，每页 ${pageSize} 条`)
}

function updatePagination(value: PlaygroundPagination) {
  pagination.value = {
    total: value.total ?? pagination.value.total,
    currentPage: value.currentPage ?? pagination.value.currentPage,
    pageSize: value.pageSize ?? pagination.value.pageSize,
    pageSizes: value.pageSizes ?? pagination.value.pageSizes,
  }
}

/**
 * 以可切换的拦截器验证 before-upload 的拒绝路径，并记录触发原因。
 * Uses a switchable guard to verify the before-upload rejection path and records why it fired.
 */
function validateBeforeUpload(file: File): boolean {
  if (!rejectBeforeUpload.value) return true
  eventLog.value.unshift(`before-upload 拒绝：${file.name}`)
  return false
}

/**
 * 以可切换的拦截器验证 before-remove 的保留路径，并记录触发原因。
 * Uses a switchable guard to verify the before-remove keep path and records why it fired.
 */
function validateBeforeRemove(file: UploadFileItem): boolean {
  if (!rejectBeforeRemove.value) return true
  eventLog.value.unshift(`before-remove 保留：${file.name}`)
  return false
}

/**
 * 记录自定义预览回调，便于确认 onPreview 已取代内置预览器。
 * Records the custom preview callback so it is clear that onPreview replaced the built-in previewer.
 */
function handleCustomPreview(file: UploadFileItem): void {
  eventLog.value.unshift(`自定义预览：${file.name}`)
}

/**
 * 头像上传成功后持久化当前头像槽位，并记录组件事件。
 * Persists the current avatar slot after a successful upload and records the component event.
 */
function handleAvatarSuccess(file: UploadFileItem): void {
  eventLog.value.unshift(`头像上传成功：${file.name}`)
  void persistLocalAvatar(file)
}
</script>

<template>
  <main class="workbench">
    <header class="workbench__header">
      <div>
        <p class="eyebrow">Vue Flow Upload · 验证台</p>
        <h1>改一个参数，立刻看结果</h1>
        <p class="workbench__intro">左侧配置始终映射到真实组件 props；右侧预览不使用另一套演示实现。</p>
      </div>
      <div class="workbench__status" :data-mode="mode">
        <span class="status-dot" aria-hidden="true"></span>
        {{ mode === 'local' ? '本地 SQLite 已连接' : 'Mock transport' }}
      </div>
    </header>

    <div class="workbench__grid">
      <aside class="control-panel" aria-label="上传组件配置">
        <div class="control-panel__head">
          <h2>参数面板</h2>
          <p>按组件 API 分类。所有修改即时应用。</p>
        </div>

        <details open class="control-group">
          <summary>传输与数据</summary>
          <div class="control-group__content">
            <fieldset class="choice-fieldset">
              <legend>传输模式</legend>
              <label><input v-model="mode" type="radio" value="mock" /> Mock</label>
              <label><input v-model="mode" type="radio" value="local" /> 本地 SQLite</label>
            </fieldset>
            <p class="control-hint">SQLite 模式会真实写入 `.playground/upload.sqlite` 和上传目录。</p>
            <button type="button" class="action-button" :disabled="loading" @click="testLoading">
              {{ loading ? '加载中…' : '触发 loading（3 秒）' }}
            </button>
            <button
              v-if="mode === 'local'"
              type="button"
              class="danger-button"
              :disabled="clearing"
              @click="clearLocalData"
            >
              {{ clearing ? '清空中…' : '清空本地测试数据' }}
            </button>
          </div>
        </details>

        <details open class="control-group">
          <summary>选择、校验与展示</summary>
          <div class="control-group__content">
            <label class="field-label">accept <input v-model="accept" type="text" /></label>
            <div class="field-grid">
              <label class="field-label">最大尺寸 MiB <input v-model.number="maxSizeMiB" min="0" type="number" /></label>
              <label class="field-label">最大数量 <input v-model.number="maxCount" min="1" type="number" /></label>
              <label class="field-label">宽度 <input v-model="uploadWidth" type="text" /></label>
              <label class="field-label">高度 <input v-model="uploadHeight" type="text" /></label>
            </div>
            <fieldset class="choice-fieldset">
              <legend>列表类型</legend>
              <label><input v-model="listType" type="radio" value="list" /> 列表</label>
              <label><input v-model="listType" type="radio" value="picture" /> 图片墙</label>
              <label><input v-model="listType" type="radio" value="picture-card" /> 图片卡片</label>
            </fieldset>
            <div class="switch-grid">
              <label class="switch"><input v-model="autoUpload" type="checkbox" /> 自动上传</label>
              <label class="switch"><input v-model="drag" type="checkbox" /> 拖拽上传</label>
              <label class="switch"><input v-model="multiple" type="checkbox" /> 允许多选</label>
              <label class="switch"><input v-model="directory" type="checkbox" /> 选择目录</label>
              <label class="switch"><input v-model="showFileList" type="checkbox" /> 显示文件列表</label>
              <label class="switch"><input v-model="showOperation" type="checkbox" /> 显示操作项</label>
              <label class="switch"><input v-model="preview" type="checkbox" /> 允许预览</label>
              <label class="switch"><input v-model="selectable" type="checkbox" /> 支持批量选择</label>
              <label class="switch"><input v-model="disabled" type="checkbox" /> 禁用组件</label>
            </div>
          </div>
        </details>

        <details class="control-group">
          <summary>队列、分片与重试</summary>
          <div class="control-group__content field-grid">
            <label class="field-label">普通上传阈值 MiB <input v-model.number="normalUploadThresholdMiB" min="0" type="number" /></label>
            <label class="field-label">分片大小 KiB <input v-model.number="chunkSizeKiB" min="1" type="number" /></label>
            <label class="field-label">单文件分片并发 <input v-model.number="chunkConcurrency" min="1" type="number" /></label>
            <label class="field-label">文件并发 <input v-model.number="maxConcurrentFiles" min="1" type="number" /></label>
            <label class="field-label">请求并发 <input v-model.number="maxConcurrentRequests" min="1" type="number" /></label>
            <label class="field-label">重试次数 <input v-model.number="retryCount" min="0" type="number" /></label>
            <label class="field-label">首个退避 ms <input v-model.number="retryBaseDelayMs" min="0" type="number" /></label>
            <label class="field-label">归档轮询 ms <input v-model.number="archivePollingIntervalMs" min="1" type="number" /></label>
            <label class="field-label">归档超时 ms <input v-model.number="archivePollingTimeoutMs" min="1" type="number" /></label>
            <label class="switch"><input v-model="resume" type="checkbox" /> 断点续传</label>
            <label class="switch"><input v-model="instantUpload" type="checkbox" /> SHA-256 秒传</label>
          </div>
        </details>

        <details class="control-group">
          <summary>主题、语言、分页与回调</summary>
          <div class="control-group__content">
            <div class="field-grid">
              <label class="field-label">主题
                <select v-model="theme"><option value="default">default</option><option value="element-plus">element-plus</option><option value="ant-design-vue">ant-design-vue</option></select>
              </label>
              <label class="field-label">语言
                <select v-model="locale"><option value="zh-CN">zh-CN</option><option value="en-US">en-US</option></select>
              </label>
            </div>
            <div class="switch-grid">
              <label class="switch"><input v-model="paginationEnabled" type="checkbox" /> 启用分页</label>
              <label class="switch"><input v-model="rejectBeforeUpload" type="checkbox" /> before-upload 拒绝</label>
              <label class="switch"><input v-model="rejectBeforeRemove" type="checkbox" /> before-remove 拦截</label>
              <label class="switch"><input v-model="useCustomPreview" type="checkbox" /> 自定义预览回调</label>
            </div>
          </div>
        </details>

        <details class="control-group">
          <summary>操作权限</summary>
          <div class="control-group__content switch-grid">
            <label class="switch"><input v-model="permissions.select" type="checkbox" /> 选择</label>
            <label class="switch"><input v-model="permissions.upload" type="checkbox" /> 上传</label>
            <label class="switch"><input v-model="permissions.remove" type="checkbox" /> 删除</label>
            <label class="switch"><input v-model="permissions.retry" type="checkbox" /> 重试</label>
            <label class="switch"><input v-model="permissions.preview" type="checkbox" /> 预览</label>
            <label class="switch"><input v-model="permissions.download" type="checkbox" /> 下载</label>
            <label class="switch"><input v-model="permissions.downloadAll" type="checkbox" /> 全部下载</label>
          </div>
        </details>

        <details class="control-group">
          <summary>AvatarUpload</summary>
          <div class="control-group__content">
            <p class="control-hint">本地 SQLite 模式下，首次上传、替换、删除和刷新回读均走本地 API。</p>
            <div class="field-grid">
              <label class="field-label">宽度 px <input v-model.number="avatarWidthPx" min="1" type="number" /></label>
              <label class="field-label">高度 px <input v-model.number="avatarHeightPx" min="1" type="number" /></label>
              <label class="field-label">最大尺寸 MiB <input v-model.number="avatarMaxSizeMiB" min="1" type="number" /></label>
            </div>
            <label class="field-label">更新端点 <input v-model="avatarUpdateAction" type="text" /></label>
          </div>
        </details>
      </aside>

      <section class="preview-panel" aria-label="实时组件预览">
        <div class="preview-panel__head"><span>实时预览</span><code>{{ files.length }} files</code></div>
        <FlowUpload
          v-model="files"
          :pagination="paginationEnabled ? pagination : false"
          :transport="activeTransport"
          :download-transport="activeDownloadTransport"
          :accept="accept"
          :max-size="maxSizeMiB * 1024 * 1024"
          :max-count="maxCount"
          :auto-upload="autoUpload"
          :drag="drag"
          :multiple="multiple"
          :directory="directory"
          :show-file-list="showFileList"
          :show-operation="showOperation"
          :preview="preview"
          :selectable="selectable"
          :disabled="disabled"
          :width="uploadWidth"
          :height="uploadHeight"
          :loading="loading"
          :normal-upload-threshold="normalUploadThresholdMiB * 1024 * 1024"
          :chunk-size="chunkSizeKiB * 1024"
          :chunk-concurrency="chunkConcurrency"
          :max-concurrent-files="maxConcurrentFiles"
          :max-concurrent-requests="maxConcurrentRequests"
          :retry-count="retryCount"
          :retry-base-delay="retryBaseDelayMs"
          :resume="resume"
          :instant-upload="instantUpload"
          :list-type="listType"
          :theme="theme"
          :locale="locale"
          :permissions="permissions"
          :before-upload="validateBeforeUpload"
          :before-remove="validateBeforeRemove"
          :on-preview="useCustomPreview ? handleCustomPreview : undefined"
          :archive-polling-interval="archivePollingIntervalMs"
          :archive-polling-timeout="archivePollingTimeoutMs"
          @update:pagination="updatePagination"
          @error="(_, error) => eventLog.unshift(`错误：${error.message}`)"
          @archive-success="(taskId) => eventLog.unshift(`打包下载已开始：${taskId}`)"
          @archive-error="(_, error) => eventLog.unshift(`打包下载错误：${error.message}`)"
          @pagination-change="handlePaginationChange"
        />

        <section class="avatar-demo">
          <div><h2>头像上传</h2><p>裁剪后上传；本地模式切回或刷新会从 SQLite 回读。</p></div>
          <AvatarUpload
            v-model="avatar"
            :transport="activeTransport"
            :update-action="mode === 'local' ? avatarUpdateAction : undefined"
            accept="image/*"
            :max-size="avatarMaxSizeMiB * 1024 * 1024"
            :width="avatarWidthPx"
            :height="avatarHeightPx"
            :disabled="disabled"
            :preview="preview"
            :permissions="permissions"
            @success="handleAvatarSuccess"
            @remove="() => eventLog.unshift('头像已删除')"
          />
        </section>

        <aside v-if="eventLog.length" class="log">
          <strong>事件记录</strong>
          <p v-for="entry in eventLog.slice(0, 6)" :key="entry">{{ entry }}</p>
        </aside>
      </section>
    </div>
  </main>
</template>

<style scoped lang="scss">
main {
  width: min(896px, calc(100% - 32px));
  margin: 64px auto;
  padding: 32px;
  background: #f7f8fa;
}

.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  text-align: left;
}
.eyebrow {
  margin: 0;
  color: #748094;
  font-size: 12px;
  font-weight: 500;
}
h1 {
  margin: 3px 0 0;
  color: #202938;
  font-size: 18px;
  font-weight: 600;
}
.switch {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: #748094;
  font-size: 13px;
  cursor: pointer;
}
.loading-test {
  border: 1px solid #c9d2e3;
  border-radius: 4px;
  padding: 6px 10px;
  background: #fff;
  color: #2f6bff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.loading-test:hover:not(:disabled) {
  border-color: #2f6bff;
}
.clear-test {
  border: 1px solid #f0a9a9;
  border-radius: 4px;
  padding: 6px 10px;
  background: #fff;
  color: #c0392b;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.clear-test:disabled {
  color: #aeb8c8;
  cursor: wait;
}
.loading-test:disabled {
  color: #aeb8c8;
  cursor: wait;
}
.demo-controls {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}
.layout-choice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px 10px;
  background: #fff;
  color: #606266;
  font-size: 13px;
}
.layout-choice legend {
  float: left;
  margin-right: 6px;
  padding: 0;
  color: #909399;
  font-size: 12px;
}
.layout-choice label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.layout-choice input {
  accent-color: #409eff;
}
.log {
  margin-top: 20px;
  padding: 14px;
  border-left: 3px solid #2f6bff;
  background: #fff;
  color: #748094;
  font-size: 12px;
}
.avatar-demo {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #e5e7eb;
}
.avatar-demo h2 {
  margin: 0;
  color: #202938;
  font-size: 16px;
}
.avatar-demo p {
  color: #748094;
  font-size: 13px;
}
.pagination-demo {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #e5e7eb;
}
.pagination-demo h2 {
  margin: 0;
  color: #202938;
  font-size: 16px;
}
.pagination-demo p {
  margin: 8px 0 16px;
  color: #748094;
  font-size: 13px;
}
.pagination-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  color: #748094;
  font-size: 13px;
}
.pagination-controls label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pagination-controls select {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 4px 8px;
  color: #606266;
  background: #fff;
}
.pagination-demo :deep(.el-pagination) {
  justify-content: center;
}
.log strong {
  color: #202938;
}
.log p {
  margin: 5px 0 0;
}

@media (max-width: 560px) {
  main {
    width: auto;
    margin: 0;
    padding: 20px 16px;
  }
  .demo-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .demo-controls {
    justify-content: flex-start;
  }
}

.workbench {
  width: min(1440px, calc(100% - 40px));
  margin: 28px auto;
  padding: 0;
  background: transparent;
}

.workbench__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 4px 28px;
  text-align: left;
}

.workbench__header h1 {
  margin: 5px 0 8px;
  font-size: clamp(25px, 3vw, 38px);
  letter-spacing: -0.06em;
}

.workbench__intro {
  max-width: 640px;
  color: #748094;
  font-size: 14px;
}

.workbench__status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: 1px solid #d7dce8;
  border-radius: 999px;
  color: #5d6678;
  background: #fff;
  font-size: 12px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8a94a6;
}

.workbench__status[data-mode='local'] .status-dot {
  background: #12836f;
  box-shadow: 0 0 0 4px rgba(18, 131, 111, 0.14);
}

.workbench__grid {
  display: grid;
  grid-template-columns: minmax(270px, 330px) minmax(0, 1fr);
  align-items: start;
  gap: 20px;
}

.control-panel,
.preview-panel {
  border: 1px solid #dce2eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(40, 53, 78, 0.07);
}

.control-panel {
  position: sticky;
  top: 16px;
  overflow: auto;
  max-height: calc(100vh - 32px);
}

.control-panel__head,
.preview-panel__head {
  padding: 18px 20px;
  border-bottom: 1px solid #e5e9f0;
}

.control-panel__head h2 {
  margin: 0 0 4px;
  font-size: 15px;
}

.control-panel__head p {
  color: #7d8798;
  font-size: 12px;
}

.control-group {
  border-bottom: 1px solid #e8ebf1;
}

.control-group:last-child {
  border-bottom: 0;
}

.control-group summary {
  padding: 14px 20px;
  color: #27334a;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.control-group__content {
  display: grid;
  gap: 12px;
  padding: 0 20px 18px;
}

.field-grid,
.switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-label {
  display: grid;
  gap: 5px;
  color: #647086;
  font-size: 11px;
}

.field-label input,
.field-label select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #cdd5e2;
  border-radius: 6px;
  padding: 7px 8px;
  color: #27334a;
  background: #fff;
  font: inherit;
  font-size: 12px;
}

.field-label input:focus,
.field-label select:focus {
  border-color: #348a7d;
  outline: 2px solid rgba(52, 138, 125, 0.15);
}

.choice-fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 10px;
  margin: 0;
  border: 0;
  padding: 0;
  color: #5e697c;
  font-size: 12px;
}

.choice-fieldset legend {
  width: 100%;
  margin-bottom: 3px;
  padding: 0;
  color: #647086;
  font-size: 11px;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #5e697c;
  font-size: 12px;
  cursor: pointer;
}

.switch input,
.choice-fieldset input {
  accent-color: #16786b;
}

.control-hint {
  color: #7d8798;
  font-size: 11px;
  line-height: 1.55;
}

.action-button,
.danger-button {
  border: 1px solid #bfcbdc;
  border-radius: 6px;
  padding: 8px 10px;
  background: #fff;
  color: #216e65;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}

.danger-button {
  border-color: #efc0bc;
  color: #b9473c;
}

.preview-panel {
  min-width: 0;
  padding-bottom: 20px;
}

.preview-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #27334a;
  font-size: 13px;
  font-weight: 650;
}

.preview-panel__head code {
  padding: 3px 6px;
  color: #16786b;
  background: #e8f5f1;
  font-size: 11px;
}

.preview-panel > :deep(.vfu-upload) {
  margin: 20px;
}

.avatar-demo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  margin: 24px 20px 0;
  padding-top: 22px;
  border-top: 1px solid #e5e9f0;
}

.avatar-demo h2 {
  margin: 0 0 5px;
  color: #27334a;
  font-size: 16px;
}

.avatar-demo p {
  color: #748094;
  font-size: 12px;
}

.log {
  margin: 20px 20px 0;
  border-left-color: #16786b;
  border-radius: 0 8px 8px 0;
  background: #f5fbf9;
}

@media (max-width: 920px) {
  .workbench__grid {
    grid-template-columns: 1fr;
  }

  .control-panel {
    position: static;
    max-height: none;
  }
}

@media (max-width: 560px) {
  .workbench {
    width: auto;
    margin: 0;
    padding: 16px;
  }

  .workbench__header,
  .avatar-demo {
    align-items: flex-start;
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .field-grid,
  .switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
