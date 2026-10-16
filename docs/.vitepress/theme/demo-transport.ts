import type {
  ArchiveTask,
  DownloadResource,
  DownloadTransport,
  UploadSuccessResult,
  UploadTransport,
} from 'vue-flow-upload'

/**
 * 文档示例使用的浏览器内上传适配器及其清理句柄。
 * Browser-only upload adapter used by documentation demos, together with its cleanup handle.
 */
export interface DemoUploadTransportHandle {
  /** 传给 FlowUpload 的上传协议实现。 Upload protocol implementation passed to FlowUpload. */
  transport: UploadTransport
  /** 停止仍然排队的模拟请求与计时器。 Stops simulated requests and timers that are still queued. */
  dispose: () => void
}

/** 模拟上传两次进度更新之间的间隔（毫秒）。 Interval between two simulated upload progress ticks in milliseconds. */
const DEMO_PROGRESS_INTERVAL_MS = 130
/** 每次进度更新推进的占比分母；数值越小进度增长越快。 Divisor controlling how much one progress tick advances; smaller values advance faster. */
const DEMO_PROGRESS_STEPS = 8
/** 模拟远端清理的耗时（毫秒）。 Duration of the simulated remote cleanup in milliseconds. */
const DEMO_DELETE_DELAY_MS = 120
/** 模拟归档轮询的耗时上限（毫秒）。 Upper bound of the simulated archive polling delay in milliseconds. */
const DEMO_ARCHIVE_DELAY_MS = 420

/**
 * 创建仅在浏览器内模拟的上传适配器：按计时器推进进度、支持取消，并在结束时返回稳定的 `fileId`。
 * Creates a browser-only upload adapter that advances progress on a timer, supports cancellation, and returns a stable `fileId`.
 */
export function createDemoUploadTransport(): DemoUploadTransportHandle {
  // 仍在推进进度的上传计时器；示例卸载时统一停止。
  // Upload timers still advancing progress; the demo stops them together on unmount.
  const progressTimers = new Set<number>()
  // 尚未完成的模拟远端清理；与上传计时器分开记录，便于按各自 API 清理。
  // Simulated remote cleanups that have not finished; tracked separately from upload timers so each is cleared with its own API.
  const cleanupTimers = new Set<number>()

  const transport: UploadTransport = {
    uploadFile({ file }, { onProgress, signal }) {
      return new Promise<UploadSuccessResult>((resolve, reject) => {
        // 模拟上传的已完成字节数，确保进度按文件尺寸计算。
        // Simulated uploaded byte count, ensuring progress is calculated against the file size.
        let uploadedBytes = 0
        // 零字节文件也视为一次可完成的上传，避免除零或永久等待。
        // Treats zero-byte files as completable uploads too, avoiding division by zero or an endless wait.
        const totalBytes = Math.max(file.size, 1)
        // 用短间隔展示连续进度，既易观察又不拖慢文档浏览。
        // A short interval shows continuous progress without slowing documentation browsing.
        const timer = window.setInterval(() => {
          uploadedBytes = Math.min(
            totalBytes,
            uploadedBytes + Math.max(1, Math.ceil(totalBytes / DEMO_PROGRESS_STEPS)),
          )
          onProgress(uploadedBytes, totalBytes)
          if (uploadedBytes === totalBytes) {
            window.clearInterval(timer)
            progressTimers.delete(timer)
            resolve({
              fileId: `demo-${Date.now()}`,
              name: file.name,
              size: file.size,
              mimeType: file.type,
              status: 'success',
            })
          }
        }, DEMO_PROGRESS_INTERVAL_MS)
        progressTimers.add(timer)
        signal.addEventListener(
          'abort',
          () => {
            window.clearInterval(timer)
            progressTimers.delete(timer)
            reject({ code: 'ABORTED', message: '上传已取消', retriable: false })
          },
          { once: true },
        )
      })
    },
    deleteFile() {
      // 删除同样在浏览器内模拟；缺少它时，示例里已上传文件的远端清理会失败。
      // Deletion is simulated in the browser too; without it, remote cleanup of uploaded demo files fails.
      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => {
          cleanupTimers.delete(timer)
          resolve()
        }, DEMO_DELETE_DELAY_MS)
        cleanupTimers.add(timer)
      })
    },
  }

  return {
    transport,
    dispose() {
      progressTimers.forEach((timer) => window.clearInterval(timer))
      cleanupTimers.forEach((timer) => window.clearTimeout(timer))
      progressTimers.clear()
      cleanupTimers.clear()
    },
  }
}

/**
 * 创建仅在浏览器内模拟的下载与归档适配器，使下载相关权限与事件在示例中可观察。
 * Creates a browser-only download and archive adapter so download-related permissions and events stay observable in demos.
 */
export function createDemoDownloadTransport(): DownloadTransport {
  // 每个归档任务已完成的轮询次数，用于演示“处理中 → 成功”的真实轮询路径。
  // Completed poll count per archive task, used to demonstrate the real “processing → success” polling path.
  const archivePollCounts = new Map<string, number>()

  return {
    downloadFile({ fileName }): Promise<DownloadResource> {
      // 单文件下载返回内存 Blob，示例因此完全离线且可立即保存。
      // Single-file downloads return an in-memory Blob, keeping the demo offline and immediately saveable.
      return Promise.resolve({
        blob: new window.Blob([`demo download: ${fileName}`], { type: 'text/plain' }),
        fileName,
      })
    },
    createArchive(): Promise<ArchiveTask> {
      return new Promise<ArchiveTask>((resolve) => {
        const taskId = `demo-archive-${Date.now()}`
        window.setTimeout(() => {
          archivePollCounts.set(taskId, 0)
          resolve({ taskId, status: 'processing', progress: 40, fileName: 'demo-files.zip' })
        }, DEMO_ARCHIVE_DELAY_MS)
      })
    },
    getArchiveTask(taskId): Promise<ArchiveTask> {
      const pollCount = (archivePollCounts.get(taskId) ?? 0) + 1
      archivePollCounts.set(taskId, pollCount)
      // 第一次轮询仍为处理中，第二次才成功，使归档进度与成功事件都能被观察到。
      // The first poll stays processing and only the second succeeds, so both archive-progress and archive-success are observable.
      if (pollCount < 2)
        return Promise.resolve({
          taskId,
          status: 'processing',
          progress: 70,
          fileName: 'demo-files.zip',
        })
      return Promise.resolve({
        taskId,
        status: 'success',
        progress: 100,
        fileName: 'demo-files.zip',
        downloadUrl: 'data:text/plain,demo archive',
      })
    },
  }
}
