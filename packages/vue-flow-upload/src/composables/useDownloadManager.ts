import type { ComputedRef } from 'vue'
import type {
  ArchiveTask,
  DownloadScope,
  DownloadTransport,
  RequestContext,
  UploadError,
  UploadFileItem,
} from '../types'
import { isAbortError, makeUploadError, normalizeUploadError } from '../utils/error'

interface DownloadManagerOptions {
  files: ComputedRef<UploadFileItem[]>
  transport: ComputedRef<DownloadTransport | undefined>
  canDownload: ComputedRef<boolean>
  canDownloadAll: ComputedRef<boolean>
  allDownloadScope?: DownloadScope
  archivePollingInterval: number
  archivePollingTimeout: number
  requestMeta: () => Promise<RequestContext>
  onDownloadStart: (file: UploadFileItem) => void
  onDownloadSuccess: (file: UploadFileItem) => void
  onDownloadError: (file: UploadFileItem, error: UploadError) => void
  onArchiveStart: (taskId: string, fileIds: string[]) => void
  onArchiveProgress: (taskId: string, percent?: number) => void
  onArchiveSuccess: (taskId: string) => void
  onArchiveError: (taskId: string, error: UploadError) => void
}

function triggerDownload(url?: string, blob?: Blob, fileName = 'download') {
  // Use a transient anchor because it works for both remote URLs and in-memory archive blobs.
  const objectUrl = blob ? window.URL.createObjectURL(blob) : url
  if (!objectUrl) throw makeUploadError('INVALID_DOWNLOAD', '下载资源为空', false)
  const anchor = window.document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.style.display = 'none'
  window.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  if (blob) window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0)
}

function delay(milliseconds: number, signal: AbortSignal) {
  // 轮询等待支持取消，且正常完成时移除监听器，避免长期任务累积过期闭包。
  // Make polling waits abortable and remove the listener after normal completion to avoid stale closures in long tasks.
  if (signal.aborted) return Promise.reject(makeUploadError('ABORTED', '下载任务已取消', false))
  return new Promise<void>((resolve, reject) => {
    /** 轮询计时器到期后先解除取消监听再继续下一次请求。 Clears the cancellation listener before proceeding to the next polling request. */
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, milliseconds)
    /** 归档取消会立即停止当前等待。 Archive cancellation immediately stops the current wait. */
    function handleAbort() {
      window.clearTimeout(timer)
      reject(makeUploadError('ABORTED', '下载任务已取消', false))
    }
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

/** Handles direct downloads and the lifecycle of server-side archive jobs. */
export function useDownloadManager(options: DownloadManagerOptions) {
  // One controller per archive task allows independent cancellation and cleanup.
  const archiveControllers = new Map<string, AbortController>()
  /** 单次轮询请求允许的最大尝试次数，超过后视为不可恢复错误。 Maximum attempts allowed for a single poll request before a non-recoverable error is raised. */
  const ARCHIVE_POLL_MAX_ATTEMPTS = 3
  /** 轮询失败后的初始退避时间（毫秒）；后续按指数增长。 Base backoff after a poll failure in milliseconds; subsequent waits grow exponentially. */
  const ARCHIVE_POLL_BACKOFF_MS = 1_000

  function successfulFileIds(uids: string[]) {
    // Archives may contain only persisted successful files; local rows have no usable server id.
    return options.files.value
      .filter((file) => uids.includes(file.uid) && file.status === 'success' && file.fileId)
      .map((file) => file.fileId!)
  }

  async function download(uid: string) {
    // Direct download delegates resource creation to the transport, then triggers the browser save.
    const file = options.files.value.find((item) => item.uid === uid)
    const transport = options.transport.value
    if (!file?.fileId || !transport || !options.canDownload.value) return
    options.onDownloadStart(file)
    try {
      const resource = await transport.downloadFile(
        { fileId: file.fileId, fileName: file.name },
        await options.requestMeta(),
      )
      triggerDownload(resource.url, resource.blob, resource.fileName ?? file.name)
      options.onDownloadSuccess(file)
    } catch (cause) {
      options.onDownloadError(file, normalizeUploadError(cause))
    }
  }

  async function followArchive(initialTask: ArchiveTask) {
    // Poll an asynchronous server archive until it produces a URL, fails, times out, or is cancelled.
    const transport = options.transport.value
    if (!transport) return
    const controller = new AbortController()
    archiveControllers.set(initialTask.taskId, controller)
    const deadline = Date.now() + options.archivePollingTimeout
    let task = initialTask
    try {
      while (task.status === 'pending' || task.status === 'processing') {
        options.onArchiveProgress(task.taskId, task.progress)
        if (Date.now() >= deadline)
          throw makeUploadError('ARCHIVE_TIMEOUT', '打包下载任务超时', true)
        await delay(options.archivePollingInterval, controller.signal)
        if (controller.signal.aborted) return
        task = await pollArchiveTask(transport, task.taskId, controller)
      }
      if (controller.signal.aborted) return
      if (task.status === 'success' && task.downloadUrl) {
        triggerDownload(task.downloadUrl, undefined, task.fileName ?? 'download.zip')
        options.onArchiveSuccess(task.taskId)
      } else if (task.status !== 'canceled') {
        throw makeUploadError('ARCHIVE_FAILED', task.errorMessage ?? '打包下载失败', false)
      }
    } catch (cause) {
      if (!isAbortError(cause))
        options.onArchiveError(initialTask.taskId, normalizeUploadError(cause))
    } finally {
      archiveControllers.delete(initialTask.taskId)
    }
  }

  /**
   * 轮询归档任务，单请求失败后按指数退避重试。轮询周期是稳定的，不被退避叠加。
   * Polls an archive task and retries a single failure with exponential backoff so transient errors do not abort the polling loop.
   */
  async function pollArchiveTask(
    transport: DownloadTransport,
    taskId: string,
    controller: AbortController,
  ): Promise<ArchiveTask> {
    let attempt = 0
    while (true) {
      if (controller.signal.aborted) throw makeUploadError('ABORTED', '下载任务已取消', false)
      try {
        const context = await options.requestMeta()
        if (controller.signal.aborted) throw makeUploadError('ABORTED', '下载任务已取消', false)
        return await transport.getArchiveTask(taskId, context)
      } catch (cause) {
        // 用户取消或非瞬态错误立即放弃；退避前再次确认未被中止。
        // User cancellation or a non-transient error gives up immediately; recheck cancellation before sleeping.
        if (isAbortError(cause)) throw cause
        const error = normalizeUploadError(cause)
        if (!error.retriable || attempt >= ARCHIVE_POLL_MAX_ATTEMPTS) throw cause
        attempt += 1
        await delay(ARCHIVE_POLL_BACKOFF_MS * 2 ** (attempt - 1), controller.signal)
      }
    }
  }

  /** 创建阶段尚无 taskId，使用该占位符区分轮询期错误。 Distinct placeholder used when an error occurs before a taskId has been issued. */
  const ARCHIVE_BEGIN_PLACEHOLDER = '__begin__'
  async function createArchive(input: { fileIds?: string[]; scope?: DownloadScope }) {
    // Start the server job and surface failures that happen before polling begins.
    const transport = options.transport.value
    if (!transport || !options.canDownloadAll.value) return
    let taskId: string = ARCHIVE_BEGIN_PLACEHOLDER
    try {
      const task = await transport.createArchive(input, await options.requestMeta())
      taskId = task.taskId
      const ids = input.fileIds ?? (input.scope?.type === 'file-ids' ? input.scope.fileIds : [])
      options.onArchiveStart(task.taskId, ids)
      await followArchive(task)
    } catch (cause) {
      options.onArchiveError(taskId, normalizeUploadError(cause))
    }
  }

  async function downloadSelected(uids: string[]) {
    // Convert selected UI ids into persisted file ids before creating the archive.
    const fileIds = successfulFileIds(uids)
    if (fileIds.length) await createArchive({ fileIds })
  }

  async function downloadAll(scope = options.allDownloadScope) {
    // A server-query scope lets the backend archive files beyond the currently loaded page.
    if (!options.canDownloadAll.value) return
    if (scope?.type === 'server-query') await createArchive({ scope })
    else
      await createArchive({
        fileIds: scope?.fileIds ?? successfulFileIds(options.files.value.map((file) => file.uid)),
      })
  }

  /**
   * 用户请求取消归档的对外 API；先中止本地轮询再尽力通知服务端。
   * Public API to cancel an archive. Aborts local polling first, then asks the server to cancel.
   * 取消请求失败仍然只发出一个标准化错误事件，避免静默失败或未处理拒绝。
   * A cancellation failure still emits a single normalized error event, avoiding silent failures or unhandled rejections.
   */
  async function cancelArchive(taskId: string) {
    archiveControllers.get(taskId)?.abort()
    const transport = options.transport.value
    if (!transport?.cancelArchive) return
    try {
      await transport.cancelArchive(taskId, await options.requestMeta())
    } catch (cause) {
      // 已中止的轮询仍需让上游看到一次失败；区分用户主动取消与服务器拒绝。
      // A canceled polling loop must still surface the failure; distinguish user-initiated cancellation from a server rejection.
      if (!isAbortError(cause)) options.onArchiveError(taskId, normalizeUploadError(cause))
    }
  }

  function clear() {
    // Teardown must stop every outstanding polling loop to prevent callbacks after unmount.
    for (const controller of archiveControllers.values()) controller.abort()
    archiveControllers.clear()
  }

  return { download, downloadSelected, downloadAll, cancelArchive, clear }
}
