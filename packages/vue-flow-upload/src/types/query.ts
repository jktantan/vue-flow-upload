import type { UploadUserFile } from './upload'

/** 查询已持久化文件时使用的非分页请求参数。 Non-paginated request parameters used to query persisted files. */
export interface FileQueryWithoutPagination {
  /** 明确告知后端返回完整列表而非一页记录。 Explicitly tells the backend to return the complete list rather than one page. */
  enabled: false
}

/** 查询已持久化文件时使用的分页请求参数。 Paginated request parameters used to query persisted files. */
export interface FileQueryWithPagination {
  /** 明确告知后端按页返回记录及总数。 Explicitly tells the backend to return one page of records and a total. */
  enabled: true
  /** 从 1 开始的请求页码。 One-based page number to request. */
  currentPage: number
  /** 每页请求的文件数量。 Number of files requested per page. */
  pageSize: number
}

/** 文件查询是否使用分页的可辨识联合。 Discriminated union describing whether a file query uses pagination. */
export type FileQueryPagination = FileQueryWithoutPagination | FileQueryWithPagination

/** 组件传给文件查询适配器的请求内容。 Request content passed from the component to a file-query adapter. */
export interface FileQueryInput {
  /** 后端必须据此决定返回完整列表或分页结果。 Directs the backend to return a complete list or a paginated result. */
  pagination: FileQueryPagination
}

/** 文件查询适配器收到的认证、归属与取消上下文。 Authentication, ownership, and cancellation context received by a file-query adapter. */
export interface FileQueryRequestContext {
  /** 组件和插件解析后的认证请求头。 Authentication request headers resolved by the component and plugin. */
  headers: Record<string, string>
  /** 包含 belongId、belongType 与项目特定匹配条件 extra 的业务查询对象。 Business query containing belongId, belongType, and project-specific match conditions in extra. */
  query: Record<string, unknown>
  /** 每个请求附加到 URL 的公共认证查询参数。 Shared authentication query parameters appended to every request URL. */
  urlQuery?: Record<string, string | number | boolean>
  /** 新 extra、翻页或卸载时中止旧请求的信号。 Signal that aborts stale requests on new extra, pagination, or unmount. */
  signal: AbortSignal
}

/** 非分页文件查询的标准化结果。 Normalized result of a non-paginated file query. */
export interface FileQueryResultWithoutPagination {
  /** 与请求保持一致的非分页标识。 Non-paginated marker matching the request. */
  pagination: FileQueryWithoutPagination
  /** 服务端返回的完整文件列表。 Complete file list returned by the server. */
  files: UploadUserFile[]
}

/** 分页文件查询的标准化结果。 Normalized result of a paginated file query. */
export interface FileQueryResultWithPagination {
  /** 后端实际返回的页码、页大小和总数，可纠正越界页。 Actual page, size, and total returned by the backend; may correct an out-of-range page. */
  pagination: FileQueryWithPagination & { total: number }
  /** 服务端返回的当前页文件列表。 Current page of files returned by the server. */
  files: UploadUserFile[]
}

/** 文件查询的分页或非分页标准化结果。 Standardized paginated or non-paginated file-query result. */
export type FileQueryResult = FileQueryResultWithoutPagination | FileQueryResultWithPagination

/** 组件和任意文件列表后端协议之间的查询适配器边界。 Query adapter boundary between the component and any file-list backend protocol. */
export interface FileQueryTransport {
  /** 查询文件元数据；适配器必须传播取消信号，并返回与请求分页模式一致的结果。 Queries file metadata; adapters must propagate cancellation and return a result matching the requested pagination mode. */
  queryFiles(input: FileQueryInput, context: FileQueryRequestContext): Promise<FileQueryResult>
}
