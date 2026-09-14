import {
  hashFileWithLocalImplementation,
  hashFileWithWasm,
  hashSmallFileWithWebCrypto,
} from './file-hash'

self.onmessage = async ({ data }: MessageEvent<{ file: File; chunkSize: number }>) => {
  // 小文件使用浏览器原生摘要；大文件保留流式路径，以便提供进度且避免整文件驻留内存。
  // Small files use the browser-native digest; large files retain the streaming path for progress and bounded memory.
  const nativeSha256 = await hashSmallFileWithWebCrypto(data.file)
  if (nativeSha256) {
    self.postMessage({ type: 'strategy', strategy: 'web-crypto' })
    self.postMessage({ type: 'progress', loaded: data.file.size, total: data.file.size })
    self.postMessage({ type: 'complete', sha256: nativeSha256 })
    return
  }
  try {
    // 大文件优先使用 WASM 增量实现；Worker 终止会立即取消该计算。
    // Large files prefer the incremental WASM implementation; Worker termination cancels the calculation immediately.
    const wasmSha256 = await hashFileWithWasm(data.file, {
      chunkSize: data.chunkSize,
      onProgress: (loaded, total) => self.postMessage({ type: 'progress', loaded, total }),
      onStrategy: (strategy) => self.postMessage({ type: 'strategy', strategy }),
    })
    self.postMessage({ type: 'complete', sha256: wasmSha256 })
  } catch {
    // CSP 或 WASM 执行失败时使用本地增量实现，保留大文件的低内存特性。
    // Use the local incremental implementation on CSP or WASM execution failure, preserving bounded memory for large files.
    const localSha256 = await hashFileWithLocalImplementation(data.file, {
      chunkSize: data.chunkSize,
      onProgress: (loaded, total) => self.postMessage({ type: 'progress', loaded, total }),
      onStrategy: (strategy) => self.postMessage({ type: 'strategy', strategy }),
    })
    self.postMessage({ type: 'complete', sha256: localSha256 })
  }
}
