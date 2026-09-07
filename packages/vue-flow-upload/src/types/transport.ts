import type { UploadSuccessResult } from './upload'

/** 调用传输适配器前即时解析的公共请求元数据。 Common request metadata resolved just before a transport call. */
export interface RequestContext {
  /** Authentication and caller-specified HTTP headers. */
  headers: Record<string, string>
  /** Serializable business metadata sent as JSON/form data. */
  data: Record<string, unknown>
  /** Multipart field name for the binary File/Blob. */
  fileFieldName: string
  /** Multipart field name for serialized data. */
  dataFieldName: string
  /** Global query parameters appended by the built-in HTTP transport. */
  query?: Record<string, string | number | boolean>
}
/** 附加取消信号和字节进度回调的 RequestContext。 RequestContext plus per-request cancellation and byte progress hooks. */
export interface UploadRequestContext extends RequestContext {
  signal: AbortSignal
  onProgress: (loaded: number, total: number) => void
}
/** 发送二进制内容前使用的可序列化文件身份信息。 Serializable file identity used before binary data is sent. */
export interface FileMeta {
  fileId?: string
  name: string
  size: number
  mimeType: string
  lastModified: number
  sha256?: string
}
/** 创建或恢复分片上传会话所需的元数据。 Metadata required to create or resume a multipart upload session. */
export interface MultipartInitInput extends FileMeta {
  chunkSize: number
  totalChunks: number
  data: Record<string, unknown>
}
/** 标识分片会话及已持久化分片的服务端响应。 Server response identifying a multipart session and chunks already persisted. */
export interface MultipartSession {
  uploadId: string
  uploadedChunks?: number[]
}
/** 单个分片请求的字节范围及其位置元数据。 One byte range and its placement metadata for a multipart request. */
export interface UploadChunkInput {
  uploadId: string
  chunkIndex: number
  totalChunks: number
  chunk: Blob
  chunkSize: number
  file: FileMeta
}
/** 组件与任意上传后端/协议之间的适配器边界。 Adapter boundary between components and any upload backend/protocol. */
export interface UploadTransport {
  /** Creates or confirms the server-side file record before bytes are uploaded. */
  createFile?(input: FileMeta, context: RequestContext): Promise<{ fileId: string }>
  uploadFile(
    input: { file: File; fileId: string; data: Record<string, unknown> },
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
    input: { fileId?: string; sha256?: string; data: Record<string, unknown> },
    context: RequestContext,
  ): Promise<UploadSuccessResult>
  cancelMultipart?(uploadId: string, context: RequestContext): Promise<void>
  /** Idempotently removes a file and every temporary upload session associated with it. */
  deleteFile?(fileId: string, context: RequestContext): Promise<void>
}
