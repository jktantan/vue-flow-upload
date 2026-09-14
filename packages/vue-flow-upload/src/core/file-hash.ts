import { createSHA256 } from 'hash-wasm'
import { IncrementalSha256 } from './sha256'
import type { HashStrategy } from '../types'

/** 原生摘要的最大文件大小，限制整文件读取造成的内存峰值。 Maximum native-digest file size, limiting memory peaks caused by whole-file reads. */
export const NATIVE_DIGEST_MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024

/** 文件哈希执行时的内部控制参数。 Internal control parameters used while hashing a file. */
export interface FileHashOptions {
  /** 每次从 File 读取的最大字节数。 Maximum bytes read from the File at a time. */
  chunkSize: number
  /** 调用方的取消信号；每个分块之间检查。 Caller cancellation signal checked between chunks. */
  signal?: AbortSignal
  /** 每个完成分块的已读字节数回调。 Callback receiving bytes read after each completed chunk. */
  onProgress?: (loaded: number, total: number) => void
  /** 当前实现已确定为本次哈希路径时的诊断回调。 Diagnostic callback fired when an implementation is selected for this hash. */
  onStrategy?: (strategy: HashStrategy) => void
  /** 是否在分块后让出主线程事件循环。 Whether to yield the main-thread event loop after each chunk. */
  shouldYieldAfterChunk?: boolean
}

/**
 * 小文件优先使用浏览器原生 SHA-256；API 不可用、超出内存阈值或执行失败时返回 undefined。
 * Prefers browser-native SHA-256 for small files; returns undefined when unavailable, over the memory threshold, or unsuccessful.
 */
export async function hashSmallFileWithWebCrypto(file: File): Promise<string | undefined> {
  // 原生摘要实现；在非安全上下文、旧浏览器或受限 Worker 中可能不存在。
  // Native digest implementation, which can be absent in insecure contexts, older browsers, or restricted Workers.
  const subtleCrypto = globalThis.crypto?.subtle
  if (!subtleCrypto || file.size > NATIVE_DIGEST_MAX_FILE_SIZE_BYTES) return undefined
  try {
    // 原生 API 不支持流式输入，因此仅在明确的内存上限内读取完整文件。
    // The native API does not support streaming input, so read the complete file only within the explicit memory limit.
    const fileBuffer = await file.arrayBuffer()
    // SHA-256 的二进制摘要，转换为与传输协议一致的小写十六进制字符串。
    // Binary SHA-256 digest, converted to the lowercase hexadecimal string used by the transport protocol.
    const digestBuffer = await subtleCrypto.digest('SHA-256', fileBuffer)
    return Array.from(new Uint8Array(digestBuffer), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    // 原生路径失败不能破坏上传；调用方将尝试 WASM 和本地回退实现。
    // A native-path failure must not break uploads; the caller will try WASM and local fallback implementations.
    return undefined
  }
}

/**
 * 使用 hash-wasm 增量计算 SHA-256，供大文件及原生实现不可用时使用。
 * Incrementally calculates SHA-256 with hash-wasm for large files and when the native implementation is unavailable.
 */
export async function hashFileWithWasm(file: File, options: FileHashOptions): Promise<string> {
  // 独立的 WASM 哈希实例，避免并发文件共享可变摘要状态。
  // Independent WASM hasher instance, preventing concurrent files from sharing mutable digest state.
  const hash = await createSHA256()
  hash.init()
  options.onStrategy?.('wasm')
  for (let offset = 0; offset < file.size; offset += options.chunkSize) {
    throwIfHashingAborted(options.signal)
    // 当前分块的结束偏移，始终不超过文件总大小。
    // End offset of the current chunk, never exceeding total file size.
    const end = Math.min(offset + options.chunkSize, file.size)
    hash.update(new Uint8Array(await file.slice(offset, end).arrayBuffer()))
    options.onProgress?.(end, file.size)
    if (options.shouldYieldAfterChunk) await yieldToEventLoop()
  }
  throwIfHashingAborted(options.signal)
  return hash.digest('hex') as string
}

/**
 * 使用本地 TypeScript 增量实现计算 SHA-256，作为 WASM 失败时的兼容性回退。
 * Calculates SHA-256 with the local TypeScript incremental implementation as a compatibility fallback when WASM fails.
 */
export async function hashFileWithLocalImplementation(
  file: File,
  options: FileHashOptions,
): Promise<string> {
  // 本地增量哈希器，不依赖 Web Crypto 或 WebAssembly。
  // Local incremental hasher independent of Web Crypto and WebAssembly.
  const hash = new IncrementalSha256()
  options.onStrategy?.('local')
  for (let offset = 0; offset < file.size; offset += options.chunkSize) {
    throwIfHashingAborted(options.signal)
    // 当前分块的结束偏移，始终不超过文件总大小。
    // End offset of the current chunk, never exceeding total file size.
    const end = Math.min(offset + options.chunkSize, file.size)
    hash.update(new Uint8Array(await file.slice(offset, end).arrayBuffer()))
    options.onProgress?.(end, file.size)
    if (options.shouldYieldAfterChunk) await yieldToEventLoop()
  }
  throwIfHashingAborted(options.signal)
  return hash.digest()
}

/**
 * 在读取下一分块前中止已取消的任务，保持与上传队列一致的错误形状。
 * Aborts a canceled task before reading the next chunk, preserving the error shape used by the upload queue.
 */
export function throwIfHashingAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createHashAbortError()
}

/**
 * 创建可由上传队列统一识别的哈希取消错误。
 * Creates a hash cancellation error that the upload queue can recognize consistently.
 */
export function createHashAbortError(): Error & { code: string; name: string } {
  return Object.assign(new Error('Hashing canceled'), { code: 'ABORTED', name: 'AbortError' })
}

/**
 * 让主线程在分块之间处理渲染和用户交互；Worker 不需要调用此函数。
 * Lets the main thread process rendering and user input between chunks; Workers do not need to call this function.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}
