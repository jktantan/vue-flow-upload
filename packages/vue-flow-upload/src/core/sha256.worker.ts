import { IncrementalSha256 } from './sha256'

/** 原生摘要的最大文件大小，限制整文件读取造成的 Worker 内存峰值。 Maximum native-digest file size, limiting Worker memory peaks caused by whole-file reads. */
const NATIVE_DIGEST_MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024

self.onmessage = async ({ data }: MessageEvent<{ file: File; chunkSize: number }>) => {
  // 小文件使用浏览器原生摘要；大文件保留流式路径，以便提供进度且避免整文件驻留内存。
  // Small files use the browser-native digest; large files retain the streaming path for progress and bounded memory.
  const nativeSha256 = await hashSmallFileWithWebCrypto(data.file)
  if (nativeSha256) {
    self.postMessage({ type: 'progress', loaded: data.file.size, total: data.file.size })
    self.postMessage({ type: 'complete', sha256: nativeSha256 })
    return
  }
  // Worker 逐块读取文件，避免将整个大文件一次性复制到内存。 Read the file chunk by chunk to avoid copying a whole large file into memory.
  const hash = new IncrementalSha256()
  for (let offset = 0; offset < data.file.size; offset += data.chunkSize) {
    const end = Math.min(offset + data.chunkSize, data.file.size)
    hash.update(new Uint8Array(await data.file.slice(offset, end).arrayBuffer()))
    self.postMessage({ type: 'progress', loaded: end, total: data.file.size })
  }
  self.postMessage({ type: 'complete', sha256: hash.digest() })
}

/**
 * 在可安全整文件读取时调用浏览器原生 SHA-256；不可用或失败时返回 undefined，让调用方回退到增量实现。
 * Runs browser-native SHA-256 when whole-file reading is safe; returns undefined when unavailable or failed so the caller can fall back incrementally.
 */
async function hashSmallFileWithWebCrypto(file: File): Promise<string | undefined> {
  // 原生摘要实现；在非安全上下文、旧浏览器或受限 Worker 中可能不存在。
  // Native digest implementation, which can be absent in insecure contexts, older browsers, or restricted Workers.
  const subtleCrypto = globalThis.crypto?.subtle
  if (!subtleCrypto || file.size > NATIVE_DIGEST_MAX_FILE_SIZE_BYTES) return undefined
  try {
    // 原生 API 不支持流式输入，因此仅在明确的内存上限内读取完整文件。
    // The native API does not support streaming input, so read the complete file only within the explicit memory limit.
    const fileBuffer = await file.arrayBuffer()
    // SHA-256 的二进制摘要，随后转换为与传输协议一致的小写十六进制字符串。
    // Binary SHA-256 digest, subsequently converted to the lowercase hexadecimal string used by the transport protocol.
    const digestBuffer = await subtleCrypto.digest('SHA-256', fileBuffer)
    return Array.from(new Uint8Array(digestBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    // 原生路径失败不能破坏上传；增量实现仍可处理兼容性和瞬态错误。
    // A native-path failure must not break uploads; the incremental implementation still handles compatibility and transient errors.
    return undefined
  }
}
