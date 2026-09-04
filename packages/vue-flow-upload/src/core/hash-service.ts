import { IncrementalSha256 } from './sha256'

export interface HashOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
}

/** 分块计算文件 SHA-256，优先使用 Worker，失败时回退到主线程。 Calculates chunked SHA-256 in a Worker first, then falls back to the main thread. */
export async function hashFile(file: File, options: HashOptions = {}) {
  const chunkSize = options.chunkSize ?? 2 * 1024 * 1024
  if (typeof Worker !== 'undefined') {
    try {
      return await hashInWorker(file, chunkSize, options)
    } catch (error) {
      if (options.signal?.aborted) throw error
    }
  }
  return hashOnMainThread(file, chunkSize, options)
}

function hashInWorker(file: File, chunkSize: number, options: HashOptions) {
  // Worker 可避免大文件哈希阻塞界面，并把进度消息转发给调用方。 A Worker avoids blocking the UI and forwards progress to the caller.
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('./sha256.worker.ts', import.meta.url), { type: 'module' })
    const abort = () => {
      worker.terminate()
      reject(abortError())
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') options.onProgress?.(data.loaded, data.total)
      if (data.type === 'complete') {
        options.signal?.removeEventListener('abort', abort)
        worker.terminate()
        resolve(data.sha256)
      }
    }
    worker.onerror = (event) => {
      options.signal?.removeEventListener('abort', abort)
      worker.terminate()
      reject(event.error ?? new Error('SHA-256 worker failed'))
    }
    worker.postMessage({ file, chunkSize })
  })
}

async function hashOnMainThread(file: File, chunkSize: number, options: HashOptions) {
  // 回退模式每块后让出事件循环，降低对交互渲染的影响。 Yield after each chunk in fallback mode to reduce UI impact.
  const hash = new IncrementalSha256()
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    if (options.signal?.aborted) throw abortError()
    const end = Math.min(offset + chunkSize, file.size)
    hash.update(new Uint8Array(await file.slice(offset, end).arrayBuffer()))
    options.onProgress?.(end, file.size)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  return hash.digest()
}

function abortError() {
  // 保持与上传取消相同的错误标识，供统一错误处理识别。 Match upload cancellation's error shape for shared error handling.
  return Object.assign(new Error('Hashing canceled'), { code: 'ABORTED', name: 'AbortError' })
}
