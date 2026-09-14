import {
  createHashAbortError,
  hashFileWithLocalImplementation,
  hashFileWithWasm,
  hashSmallFileWithWebCrypto,
  throwIfHashingAborted,
} from './file-hash'
import type { HashStrategy } from '../types'

declare const __VFU_ENABLE_HASH_WORKER__: boolean

export interface HashOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
  /** 实际完成哈希的客户端实现；用于开发诊断，不影响摘要结果。 Client implementation that completes hashing; used for diagnostics and does not affect the digest result. */
  onStrategy?: (strategy: HashStrategy) => void
}

/** 分块计算文件 SHA-256，优先使用 Worker，失败时回退到主线程。 Calculates chunked SHA-256 in a Worker first, then falls back to the main thread. */
export async function hashFile(file: File, options: HashOptions = {}) {
  const chunkSize = options.chunkSize ?? 2 * 1024 * 1024
  if (
    typeof __VFU_ENABLE_HASH_WORKER__ !== 'undefined' &&
    __VFU_ENABLE_HASH_WORKER__ &&
    typeof Worker !== 'undefined'
  ) {
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
    // 信号已取消时不能再创建 Worker，否则不会收到一次性 abort 事件而泄漏后台任务。
    // Do not create a Worker for an already-aborted signal because its one-time abort event would never arrive.
    if (options.signal?.aborted) {
      reject(abortError())
      return
    }
    const worker = new Worker(new URL('./sha256.worker.ts', import.meta.url), { type: 'module' })
    const abort = () => {
      worker.terminate()
      reject(abortError())
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') options.onProgress?.(data.loaded, data.total)
      if (data.type === 'strategy') options.onStrategy?.(data.strategy)
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
  // 主线程同样优先原生摘要；完成后再次检查取消，避免取消任务写回完成结果。
  // The main thread also prefers native digest; check cancellation again afterward to prevent a canceled task from reporting completion.
  throwIfHashingAborted(options.signal)
  const nativeSha256 = await hashSmallFileWithWebCrypto(file)
  throwIfHashingAborted(options.signal)
  if (nativeSha256) {
    options.onStrategy?.('web-crypto')
    options.onProgress?.(file.size, file.size)
    return nativeSha256
  }
  try {
    // 大文件使用 WASM 增量路径；每个分块后让出事件循环以维持回退模式的交互性。
    // Large files use the incremental WASM path and yield after each chunk to preserve fallback-mode responsiveness.
    return await hashFileWithWasm(file, { ...options, chunkSize, shouldYieldAfterChunk: true })
  } catch (error) {
    if (options.signal?.aborted) throw error
    // CSP 或 WASM 初始化失败时回退本地实现，保证浏览器兼容性不影响上传。
    // Fall back locally on CSP or WASM initialization failure so browser compatibility does not prevent uploads.
    return hashFileWithLocalImplementation(file, {
      ...options,
      chunkSize,
      shouldYieldAfterChunk: true,
    })
  }
}

function abortError() {
  // 保持与上传取消相同的错误标识，供统一错误处理识别。 Match upload cancellation's error shape for shared error handling.
  return createHashAbortError()
}
