import type { FileQueryInput, FileQueryResult, FileQueryTransport, UploadError } from '../types'
import { appendQuery, resolveRequestUrl } from './http-transport'

/** 内置 HTTP 文件查询适配器的配置。 Configuration for the built-in HTTP file-query adapter. */
export interface HttpFileQueryTransportOptions {
  /** 接收归属数据（其中 extra 用于项目特定匹配）和分页参数的 JSON POST 地址。 JSON POST endpoint receiving ownership data (with extra for project-specific matching) and pagination. */
  queryUrl: string
  /** 相对查询地址前附加的 API 根路径或源站。 API base path or origin prepended to a relative query URL. */
  baseUrl?: string
  /** 是否随跨域查询请求发送 Cookie。 Whether cross-origin query requests send cookies. */
  credentials?: RequestCredentials
  /** 单次查询请求的超时毫秒数，默认 60 秒。 Timeout in milliseconds for one query request; defaults to 60 seconds. */
  timeout?: number
  /** 将后端 JSON 响应转换为标准查询结果；默认验证 files 和分页结构。 Converts a backend JSON response to the standard result; defaults to validating files and pagination. */
  parseResponse?: (response: XMLHttpRequest, input: FileQueryInput) => FileQueryResult
}

/** 创建以 JSON POST 查询文件列表的默认 XHR 适配器。 Creates the default XHR adapter that queries file lists with JSON POST. */
export function createHttpFileQueryTransport(
  options: HttpFileQueryTransportOptions,
): FileQueryTransport {
  return {
    queryFiles(input, context) {
      /** 查询复用上传数据，但请求字段命名为 query；后端以 query.extra 匹配项目特定条件。 Queries reuse upload data but name the request field query; the backend matches project-specific conditions through query.extra. */
      const payload = { query: context.query, pagination: input.pagination }
      return new Promise<FileQueryResult>((resolve, reject) => {
        /** 已取消的查询不能再创建网络请求，避免旧 extra 条件覆盖新结果。 An aborted query never creates a request, preventing old extra conditions from overwriting newer results. */
        if (context.signal.aborted) {
          reject(toQueryError('ABORTED', '查询请求已取消', false))
          return
        }
        const request = new XMLHttpRequest()
        request.open(
          'POST',
          appendQuery(resolveRequestUrl(options.queryUrl, options.baseUrl), context.urlQuery),
        )
        request.timeout = options.timeout ?? 60_000
        request.withCredentials = options.credentials === 'include'
        for (const [key, value] of Object.entries(context.headers))
          request.setRequestHeader(key, value)
        if (!hasContentType(context.headers))
          request.setRequestHeader('Content-Type', 'application/json')
        /** 查询失败保留网络、超时、取消和 HTTP 语义，供组件事件准确区分。 Query failures preserve network, timeout, abort, and HTTP semantics for accurate component events. */
        request.onerror = () => reject(toQueryError('NETWORK_ERROR', '查询请求失败', true))
        request.ontimeout = () => reject(toQueryError('TIMEOUT', '查询请求超时', true))
        request.onabort = () => reject(toQueryError('ABORTED', '查询请求已取消', false))
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            reject(
              toQueryError(
                `HTTP_${request.status}`,
                `查询请求失败（${request.status}）`,
                request.status === 408 || request.status === 429 || request.status >= 500,
                request.status,
              ),
            )
            return
          }
          try {
            /** 默认解析器在结果进入组件状态前验证分页模式和文件数组。 The default parser validates pagination mode and files before results enter component state. */
            resolve(options.parseResponse?.(request, input) ?? parseResult(request, input))
          } catch (cause) {
            reject(
              toQueryError('INVALID_RESPONSE', '查询响应无法解析', false, request.status, cause),
            )
          }
        }
        /** 控制器拥有本请求 XHR，并在结束时释放监听器。 The controller owns this request XHR and releases its listener at completion. */
        const abortRequest = () => request.abort()
        context.signal.addEventListener('abort', abortRequest, { once: true })
        request.addEventListener(
          'loadend',
          () => context.signal.removeEventListener('abort', abortRequest),
          { once: true },
        )
        request.send(JSON.stringify(payload))
      })
    },
  }
}

/** 判断调用方是否已提供不区分大小写的 Content-Type。 Determines whether the caller supplied a case-insensitive Content-Type. */
function hasContentType(headers: Record<string, string>) {
  return Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
}

/** 解析并校验 HTTP 查询响应的最小公开契约。 Parses and validates the minimum public contract of an HTTP query response. */
function parseResult(request: XMLHttpRequest, input: FileQueryInput): FileQueryResult {
  /** 空响应无法表达查询结果，因此在边界处拒绝。 An empty response cannot express a query result and is rejected at the boundary. */
  const value: unknown = request.responseText ? JSON.parse(request.responseText) : undefined
  if (!isQueryResult(value, input.pagination.enabled))
    throw new Error('查询响应缺少 files 或分页字段')
  return value
}

/** 判断未知响应是否与请求的分页模式匹配。 Determines whether an unknown response matches the pagination mode of its request. */
function isQueryResult(value: unknown, expectsPagination: boolean): value is FileQueryResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('files' in value) ||
    !Array.isArray(value.files)
  )
    return false
  if (!('pagination' in value) || typeof value.pagination !== 'object' || value.pagination === null)
    return false
  const pagination = value.pagination
  if (!('enabled' in pagination) || pagination.enabled !== expectsPagination) return false
  return (
    !expectsPagination ||
    ('currentPage' in pagination &&
      typeof pagination.currentPage === 'number' &&
      'pageSize' in pagination &&
      typeof pagination.pageSize === 'number' &&
      'total' in pagination &&
      typeof pagination.total === 'number')
  )
}

/** 创建保留 HTTP 状态和原始原因的标准查询错误。 Creates a standard query error retaining HTTP status and the original cause. */
function toQueryError(
  code: string,
  message: string,
  retriable: boolean,
  status?: number,
  cause?: unknown,
): UploadError {
  return { code, message, retriable, status, cause }
}
