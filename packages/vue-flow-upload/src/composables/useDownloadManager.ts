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
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(makeUploadError('ABORTED', '下载任务已取消', false))
      },
      { once: true },
    )
  })
}

/** Handles direct downloads and the lifecycle of server-side archive jobs. */
export function useDownloadManager(options: DownloadManagerOptions) {
  const archiveControllers = new Map<string, AbortController>()

  function successfulFileIds(uids: string[]) {
    return options.files.value
      .filter((file) => uids.includes(file.uid) && file.status === 'success' && file.fileId)
      .map((file) => file.fileId!)
  }

  async function download(uid: string) {
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
        task = await transport.getArchiveTask(task.taskId, await options.requestMeta())
      }
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

  async function createArchive(input: { fileIds?: string[]; scope?: DownloadScope }) {
    const transport = options.transport.value
    if (!transport || !options.canDownloadAll.value) return
    try {
      const task = await transport.createArchive(input, await options.requestMeta())
      const ids = input.fileIds ?? (input.scope?.type === 'file-ids' ? input.scope.fileIds : [])
      options.onArchiveStart(task.taskId, ids)
      await followArchive(task)
    } catch (cause) {
      options.onArchiveError('', normalizeUploadError(cause))
    }
  }

  async function downloadSelected(uids: string[]) {
    const fileIds = successfulFileIds(uids)
    if (fileIds.length) await createArchive({ fileIds })
  }

  async function downloadAll(scope = options.allDownloadScope) {
    if (!options.canDownloadAll.value) return
    if (scope?.type === 'server-query') await createArchive({ scope })
    else
      await createArchive({
        fileIds: scope?.fileIds ?? successfulFileIds(options.files.value.map((file) => file.uid)),
      })
  }

  async function cancelArchive(taskId: string) {
    archiveControllers.get(taskId)?.abort()
    const transport = options.transport.value
    if (transport?.cancelArchive) await transport.cancelArchive(taskId, await options.requestMeta())
  }

  function clear() {
    for (const controller of archiveControllers.values()) controller.abort()
    archiveControllers.clear()
  }

  return { download, downloadSelected, downloadAll, cancelArchive, clear }
}
