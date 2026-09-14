import type {
  ArchiveTask,
  DownloadResource,
  DownloadScope,
  DownloadTransport,
  RequestContext,
  UploadError,
} from '../types'
import { appendQuery, resolveRequestUrl } from './http-transport'

/** 可使用 `{fileId}` 或 `{taskId}` 占位符的 HTTP 下载端点。 HTTP download endpoint that may use a `{fileId}` or `{taskId}` placeholder. */
export type HttpDownloadUrl = string | ((identifier: string) => string)

/** 服务端归档任务端点的 HTTP 映射配置。 HTTP endpoint mapping for server-side archive tasks. */
export interface HttpArchiveTransportOptions {
  /** 创建归档任务的端点，适配器会以 JSON POST 提交范围。 Endpoint that creates an archive task; the adapter POSTs the scope as JSON. */
  createUrl: string
  /** 查询归档任务的端点，可包含 `{taskId}`。 Endpoint that gets an archive task and may include `{taskId}`. */
  taskUrl: HttpDownloadUrl
  /** 可选取消端点，可包含 `{taskId}`。 Optional cancellation endpoint that may include `{taskId}`. */
  cancelUrl?: HttpDownloadUrl
}

/** 内置 XHR 下载传输适配器的配置。 Configuration for the built-in XHR download transport adapter. */
export interface HttpDownloadTransportOptions {
  /** 单文件下载端点，可包含 `{fileId}`。 Single-file download endpoint that may include `{fileId}`. */
  downloadUrl: HttpDownloadUrl
  /** 创建、查询和可选取消归档任务的端点。 Endpoints for creating, querying, and optionally cancelling archive tasks. */
  archive: HttpArchiveTransportOptions
  /** 相对端点前附加的 API 根路径或源站。 API base path or origin prepended to relative endpoints. */
  baseUrl?: string
  /** 是否随跨域请求发送 Cookie。 Whether cross-origin requests send cookies. */
  credentials?: RequestCredentials
  /** 单次下载或归档请求的超时毫秒数，默认 60 秒。 Timeout in milliseconds for one download or archive request; defaults to 60 seconds. */
  timeout?: number
  /** 将下载响应转换为资源；默认读取 Blob 和 Content-Disposition 文件名。 Converts a download response into a resource; defaults to Blob plus Content-Disposition filename. */
  parseDownloadResponse?: (response: XMLHttpRequest, fallbackFileName: string) => DownloadResource
  /** 将归档端点 JSON 响应转换为任务；默认要求 taskId 与合法 status。 Converts archive-endpoint JSON into a task; defaults to requiring taskId and a valid status. */
  parseArchiveResponse?: (response: XMLHttpRequest) => ArchiveTask
}

/**
 * 创建单文件下载与异步归档任务的默认 XHR 传输适配器。
 * Creates the default XHR transport adapter for single-file downloads and asynchronous archive tasks.
 */
export function createHttpDownloadTransport(
  options: HttpDownloadTransportOptions,
): DownloadTransport {
  /** 将文件下载、归档创建、轮询和取消映射到配置的 HTTP 端点。 Maps file download, archive creation, polling, and cancellation to configured HTTP endpoints. */
  return {
    downloadFile(input, context) {
      /** 使用文件 ID 解析端点，以保证特殊字符不会破坏路径。 Resolves the endpoint with the file ID so special characters cannot break the path. */
      const url = resolveEndpointUrl(options.downloadUrl, input.fileId, options.baseUrl)
      return requestDownload(options, url, input.fileName, context)
    },
    createArchive(input, context) {
      /** 归档范围保持 JSON 原样，避免 adapter 对业务查询条件作出假设。 Keeps the archive scope as JSON without the adapter assuming business-query semantics. */
      return requestArchive(
        options,
        resolveRequestUrl(options.archive.createUrl, options.baseUrl),
        'POST',
        input,
        context,
      )
    },
    getArchiveTask(taskId, context) {
      /** 任务 ID 同时支持回调 URL 和模板 URL。 The task ID supports both callback URLs and template URLs. */
      const url = resolveEndpointUrl(options.archive.taskUrl, taskId, options.baseUrl)
      return requestArchive(options, url, 'GET', undefined, context)
    },
    cancelArchive: options.archive.cancelUrl
      ? (taskId, context) => {
          /** 取消请求不解析正文，服务端可返回 204。 Cancellation does not parse a body, allowing the server to return 204. */
          const url = resolveEndpointUrl(options.archive.cancelUrl!, taskId, options.baseUrl)
          return requestEmpty(options, url, 'DELETE', context)
        }
      : undefined,
  }
}

/** 将模板或回调端点解析为完整请求地址。 Resolves a template or callback endpoint into a complete request URL. */
function resolveEndpointUrl(endpoint: HttpDownloadUrl, identifier: string, baseUrl?: string) {
  /** 动态标识符编码后替换，防止路径参数注入额外分段。 Replaces the dynamic identifier after encoding to prevent extra path segments. */
  const path =
    typeof endpoint === 'function'
      ? endpoint(identifier)
      : endpoint
          .replace('{fileId}', encodeURIComponent(identifier))
          .replace('{taskId}', encodeURIComponent(identifier))
  return resolveRequestUrl(path, baseUrl)
}

/** 发送二进制下载请求，并返回可由下载管理器保存的 Blob 资源。 Sends a binary download request and returns a Blob resource saveable by the download manager. */
function requestDownload(
  options: HttpDownloadTransportOptions,
  url: string,
  fallbackFileName: string,
  context: RequestContext,
) {
  return new Promise<DownloadResource>((resolve, reject) => {
    /** 下载请求使用 Blob 响应，避免将任意二进制内容错误解析为文本。 The download request uses a Blob response so arbitrary binary content is not parsed as text. */
    const request = createRequest(options, url, 'GET', context)
    request.responseType = 'blob'
    request.onerror = () => reject(toDownloadError('NETWORK_ERROR', '下载请求失败', true))
    request.ontimeout = () => reject(toDownloadError('TIMEOUT', '下载请求超时', true))
    request.onabort = () => reject(toDownloadError('ABORTED', '下载请求已取消', false))
    request.onload = () => {
      if (!isSuccessfulStatus(request.status)) {
        reject(toHttpError(request.status, '下载请求失败'))
        return
      }
      try {
        /** 自定义解析器可适配非标准响应或后端指定的资源地址。 A custom parser supports nonstandard responses or backend-provided resource URLs. */
        const resource =
          options.parseDownloadResponse?.(request, fallbackFileName) ??
          toBlobResource(request, fallbackFileName)
        if (!resource.url && !resource.blob) throw new Error('下载响应未提供资源')
        resolve(resource)
      } catch (cause) {
        reject(
          toDownloadError('INVALID_RESPONSE', '下载响应无法解析', false, request.status, cause),
        )
      }
    }
    request.send()
  })
}

/** 发送创建或查询归档的 JSON 请求并验证最小任务契约。 Sends a JSON archive creation/query request and validates the minimum task contract. */
function requestArchive(
  options: HttpDownloadTransportOptions,
  url: string,
  method: 'GET' | 'POST',
  payload: { fileIds?: string[]; scope?: DownloadScope; archiveName?: string } | undefined,
  context: RequestContext,
) {
  return new Promise<ArchiveTask>((resolve, reject) => {
    /** 仅 POST 附带 JSON body，GET 查询条件仍来自受控的公共 query。 Only POST carries a JSON body; GET query parameters remain in the controlled shared query. */
    const request = createRequest(options, url, method, context, method === 'POST')
    request.onerror = () => reject(toDownloadError('NETWORK_ERROR', '归档请求失败', true))
    request.ontimeout = () => reject(toDownloadError('TIMEOUT', '归档请求超时', true))
    request.onabort = () => reject(toDownloadError('ABORTED', '归档请求已取消', false))
    request.onload = () => {
      if (!isSuccessfulStatus(request.status)) {
        reject(toHttpError(request.status, '归档请求失败'))
        return
      }
      try {
        /** 默认解析器验证任务 ID 和状态，以防无效响应进入轮询循环。 The default parser validates task ID and status so invalid responses cannot enter the polling loop. */
        resolve(options.parseArchiveResponse?.(request) ?? parseArchiveTask(request))
      } catch (cause) {
        reject(
          toDownloadError('INVALID_RESPONSE', '归档响应无法解析', false, request.status, cause),
        )
      }
    }
    request.send(method === 'POST' ? JSON.stringify(payload) : null)
  })
}

/** 发送不需响应正文的归档取消请求。 Sends an archive-cancellation request that does not require a response body. */
function requestEmpty(
  options: HttpDownloadTransportOptions,
  url: string,
  method: 'DELETE',
  context: RequestContext,
) {
  return new Promise<void>((resolve, reject) => {
    /** 删除请求不写 Content-Type，兼容拒绝空 JSON body 的 HTTP 服务端。 The DELETE request omits Content-Type for servers that reject an empty JSON body. */
    const request = createRequest(options, url, method, context)
    request.onerror = () => reject(toDownloadError('NETWORK_ERROR', '取消归档请求失败', true))
    request.ontimeout = () => reject(toDownloadError('TIMEOUT', '取消归档请求超时', true))
    request.onabort = () => reject(toDownloadError('ABORTED', '归档请求已取消', false))
    request.onload = () =>
      isSuccessfulStatus(request.status)
        ? resolve()
        : reject(toHttpError(request.status, '取消归档请求失败'))
    request.send()
  })
}

/** 创建带有公共认证、查询参数和超时策略的 XHR。 Creates an XHR with shared authentication, query parameters, and timeout policy. */
function createRequest(
  options: HttpDownloadTransportOptions,
  url: string,
  method: 'GET' | 'POST' | 'DELETE',
  context: RequestContext,
  sendsJson = false,
) {
  /** 所有端点都追加相同 query，和上传 HTTP 适配器保持认证行为一致。 All endpoints append the same query, matching the upload HTTP adapter's authentication behavior. */
  const request = new XMLHttpRequest()
  request.open(method, appendQuery(url, context.query))
  request.timeout = options.timeout ?? 60_000
  request.withCredentials = options.credentials === 'include'
  for (const [key, value] of Object.entries(context.headers)) request.setRequestHeader(key, value)
  if (sendsJson && !hasHeader(context.headers, 'content-type'))
    request.setRequestHeader('Content-Type', 'application/json')
  return request
}

/** 判断调用方是否已经指定某个不区分大小写的请求头。 Checks whether the caller already supplied a case-insensitive request header. */
function hasHeader(headers: Record<string, string>, expectedName: string) {
  /** HTTP 头名称不区分大小写。 HTTP header names are case-insensitive. */
  return Object.keys(headers).some((name) => name.toLowerCase() === expectedName)
}

/** 将默认 XHR Blob 响应和 Content-Disposition 转换为下载资源。 Converts the default XHR Blob response and Content-Disposition into a download resource. */
function toBlobResource(request: XMLHttpRequest, fallbackFileName: string): DownloadResource {
  /** XHR 在 responseType 为 blob 时应返回 Blob；仍显式检查以保护外部实现边界。 XHR should return Blob for blob responseType; explicitly check it to protect the external boundary. */
  if (!(request.response instanceof Blob)) throw new Error('响应内容不是 Blob')
  /** 服务端指定文件名优先，缺失或不合法时回退到列表文件名。 Server-provided file names take precedence, falling back to the list file name when absent or invalid. */
  return {
    blob: request.response,
    fileName: parseFileName(request.getResponseHeader('Content-Disposition')) ?? fallbackFileName,
  }
}

/** 从标准 Content-Disposition 头提取 RFC 5987 或普通文件名。 Extracts an RFC 5987 or ordinary file name from a standard Content-Disposition header. */
function parseFileName(contentDisposition: string | null) {
  /** 扩展 filename* 可正确表达 UTF-8 名称，普通 filename 是兼容性回退。 Extended filename* correctly represents UTF-8 names, while ordinary filename is a compatibility fallback. */
  const encodedMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch {
      return undefined
    }
  }
  const plainMatch = contentDisposition?.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1]
}

/** 解析并验证归档任务的最小运行时契约。 Parses and validates the minimum runtime contract for an archive task. */
function parseArchiveTask(request: XMLHttpRequest): ArchiveTask {
  /** 空响应不能驱动归档轮询，因此明确拒绝。 An empty response cannot drive archive polling and is explicitly rejected. */
  const value: unknown = request.responseText ? JSON.parse(request.responseText) : undefined
  if (!isArchiveTask(value)) throw new Error('归档任务缺少 taskId 或 status')
  return value
}

/** 判断未知 JSON 是否满足归档任务的必要字段和状态枚举。 Determines whether unknown JSON has required archive-task fields and a valid status enum. */
function isArchiveTask(value: unknown): value is ArchiveTask {
  /** 仅接受已知状态，防止拼写错误导致轮询永不停止。 Accepts only known states so typos cannot cause polling never to stop. */
  const statuses = ['pending', 'processing', 'success', 'failed', 'canceled'] as const
  return (
    typeof value === 'object' &&
    value !== null &&
    'taskId' in value &&
    typeof value.taskId === 'string' &&
    'status' in value &&
    typeof value.status === 'string' &&
    (statuses as readonly string[]).includes(value.status)
  )
}

/** 判断 HTTP 状态是否属于成功范围。 Determines whether an HTTP status belongs to the successful range. */
function isSuccessfulStatus(status: number) {
  return status >= 200 && status < 300
}

/** 将 HTTP 状态转换为保留重试语义的下载错误。 Converts an HTTP status into a download error that preserves retry semantics. */
function toHttpError(status: number, message: string) {
  return toDownloadError(
    `HTTP_${status}`,
    `${message}（${status}）`,
    status === 408 || status === 429 || status >= 500,
    status,
  )
}

/** 创建下载流程可消费的标准错误对象，并保留外部失败原因。 Creates the standard error object consumed by download flows while preserving the external failure cause. */
function toDownloadError(
  code: string,
  message: string,
  retriable: boolean,
  status?: number,
  cause?: unknown,
): UploadError {
  return { code, message, retriable, status, cause }
}
