import type { UploadSuccessResult } from './upload'

export interface RequestContext {
  headers: Record<string, string>
  data: Record<string, unknown>
  fileFieldName: string
  dataFieldName: string
}
export interface UploadRequestContext extends RequestContext {
  signal: AbortSignal
  onProgress: (loaded: number, total: number) => void
}
export interface FileMeta {
  name: string
  size: number
  mimeType: string
  lastModified: number
  sha256?: string
}
export interface MultipartInitInput extends FileMeta {
  chunkSize: number
  totalChunks: number
  data: Record<string, unknown>
}
export interface MultipartSession {
  uploadId: string
  uploadedChunks?: number[]
}
export interface UploadChunkInput {
  uploadId: string
  chunkIndex: number
  totalChunks: number
  chunk: Blob
  chunkSize: number
  file: FileMeta
}
export interface UploadTransport {
  uploadFile(
    input: { file: File; data: Record<string, unknown> },
    context: UploadRequestContext,
  ): Promise<UploadSuccessResult>
  checkFile?(
    input: FileMeta,
    context: RequestContext,
  ): Promise<{ exists: boolean; file?: UploadSuccessResult }>
  initMultipart?(input: MultipartInitInput, context: RequestContext): Promise<MultipartSession>
  uploadChunk?(input: UploadChunkInput, context: UploadRequestContext): Promise<void>
  completeMultipart?(
    uploadId: string,
    input: { sha256?: string; data: Record<string, unknown> },
    context: RequestContext,
  ): Promise<UploadSuccessResult>
  cancelMultipart?(uploadId: string, context: RequestContext): Promise<void>
}
