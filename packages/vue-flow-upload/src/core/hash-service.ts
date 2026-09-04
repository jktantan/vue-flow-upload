import { IncrementalSha256 } from './sha256'

export interface HashOptions {
  chunkSize?: number
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
}

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
  return Object.assign(new Error('Hashing canceled'), { code: 'ABORTED', name: 'AbortError' })
}
