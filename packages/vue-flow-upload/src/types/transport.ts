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
  /** 共享分片会话的稳定服务端标识；同一内容的并发上传者可得到相同值。 Stable server identifier for a shared multipart session; concurrent uploaders of the same content may receive the same value. */
  uploadId: string
  /** 会话当前状态；省略时按 `uploading` 兼容旧服务端。 Current session state; omitted values are treated as `uploading` for backward compatibility. */
  state?: 'uploading' | 'merging' | 'processing'
  /** 已被服务端持久化且无需重传的 0 开始分片序号。 Zero-based chunk indexes already persisted by the server and not sent again. */
  uploadedChunks?: number[]
}
/**
 * 秒传检查的服务端状态；`ready` 代表字节已可用，其他状态绝不能作为上传成功处理。
 * Server state returned by an instant-upload check; only `ready` means bytes are available and every other state must not be treated as success.
 */
export type FileCheckResult =
  /** 内容已完成且当前调用方已获得可访问的文件引用。 Content is complete and the caller has received an accessible file reference. */
  | { state: 'ready'; file: UploadSuccessResult }
  /** 内容不存在，客户端应创建或恢复分片会话。 Content is absent and the client should create or resume a multipart session. */
  | { state: 'missing' }
  /** 内容正在接收分片；客户端可经幂等初始化接口补传缺片。 Content is receiving chunks; the client may fill missing chunks through idempotent initialization. */
  | { state: 'uploading'; uploadId?: string; uploadedChunks?: number[]; retryAfterMs?: number }
  /** 内容已由其他请求合并或后处理；客户端应等待完成接口的幂等结果。 Content is being merged or post-processed by another request; the client should await the idempotent completion result. */
  | { state: 'merging' | 'processing'; uploadId?: string; retryAfterMs?: number }
/**
 * 旧版秒传检查响应；保留该形状以便现有服务端平滑升级。
 * Legacy instant-upload check response; retained so existing servers can upgrade gradually.
 */
export interface LegacyFileCheckResult {
  /** 是否命中已完成文件；`true` 时必须同时提供 `file`。 Whether a completed file was found; `file` must also be present when true. */
  exists: boolean
  /** 旧版命中时返回的文件记录。 File record returned for a legacy hit. */
  file?: UploadSuccessResult
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
  createFile?(
    input: FileMeta & { data: Record<string, unknown> },
    context: RequestContext,
  ): Promise<{ fileId: string }>
  uploadFile(
    input: { file: File; fileId: string; data: Record<string, unknown> },
    context: UploadRequestContext,
  ): Promise<UploadSuccessResult>
  checkFile?(
    input: FileMeta,
    context: RequestContext,
  ): Promise<FileCheckResult | LegacyFileCheckResult>
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
