import { IncrementalSha256 } from './sha256'

self.onmessage = async ({ data }: MessageEvent<{ file: File; chunkSize: number }>) => {
  const hash = new IncrementalSha256()
  for (let offset = 0; offset < data.file.size; offset += data.chunkSize) {
    const end = Math.min(offset + data.chunkSize, data.file.size)
    hash.update(new Uint8Array(await data.file.slice(offset, end).arrayBuffer()))
    self.postMessage({ type: 'progress', loaded: end, total: data.file.size })
  }
  self.postMessage({ type: 'complete', sha256: hash.digest() })
}
