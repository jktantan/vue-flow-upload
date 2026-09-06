import type {
  MultipartSession,
  RequestContext,
  UploadChunkInput,
  UploadError,
  UploadRequestContext,
  UploadSuccessResult,
  UploadTransport,
} from '../types'

export interface HttpUploadTransportOptions {
  url: string
  method?: 'POST' | 'PUT'
  credentials?: RequestCredentials
  timeout?: number
  parseResponse?: (response: XMLHttpRequest) => UploadSuccessResult
  createUrl?: string
  deleteUrl?: string | ((fileId: string) => string)
  checkUrl?: string
  multipart?: {
    initUrl: string
    chunkUrl: string | ((uploadId: string, chunkIndex: number) => string)
    completeUrl: string | ((uploadId: string) => string)
    cancelUrl?: string | ((uploadId: string) => string)
  }
}

/** 创建普通上传与可选分片上传的默认 XHR 传输适配器。 Creates the default XHR transport for normal and optional multipart uploads. */
export function createHttpUploadTransport(options: HttpUploadTransportOptions): UploadTransport {
  const transport: UploadTransport = {
    uploadFile({ file, fileId, data }, context) {
      // FormData 的 multipart boundary 由浏览器设置，因此不透传调用方 Content-Type。 The browser owns FormData's multipart boundary, so caller Content-Type is not forwarded.
      return new Promise<UploadSuccessResult>((resolve, reject) => {
        if (context.signal.aborted) {
          reject(toError('ABORTED', '上传已取消', false))
          return
        }
        const request = new XMLHttpRequest()
        const formData = new FormData()
        const method = options.method ?? 'POST'

        formData.append(context.fileFieldName, file)
        formData.append('fileId', fileId)
        formData.append(context.dataFieldName, JSON.stringify(data))
        request.open(method, appendQuery(options.url, context.query))
        request.timeout = options.timeout ?? 60_000
        request.withCredentials = options.credentials === 'include'

        for (const [key, value] of Object.entries(context.headers)) {
          if (key.toLowerCase() !== 'content-type') request.setRequestHeader(key, value)
        }

        request.upload.onprogress = (event) => {
          if (event.lengthComputable) context.onProgress(event.loaded, event.total)
        }
        request.onerror = () => reject(toError('NETWORK_ERROR', '上传请求失败', true))
        request.ontimeout = () => reject(toError('TIMEOUT', '上传请求超时', true))
        request.onabort = () => reject(toError('ABORTED', '上传已取消', false))
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            reject(
              toError(
                `HTTP_${request.status}`,
                `上传请求失败（${request.status}）`,
                request.status === 408 || request.status === 429 || request.status >= 500,
                request.status,
              ),
            )
            return
          }
          try {
            resolve(options.parseResponse?.(request) ?? parseJsonResponse(request))
          } catch (cause) {
            reject(toError('INVALID_RESPONSE', '上传响应无法解析', false, request.status, cause))
          }
        }

        context.signal.addEventListener('abort', () => request.abort(), { once: true })
        request.send(formData)
      })
    },
  }
  if (options.createUrl) {
    transport.createFile = (input, context) =>
      sendJson<{ fileId: string }>(options, options.createUrl!, 'POST', input, context)
  }
  if (options.deleteUrl) {
    transport.deleteFile = (fileId, context) =>
      request<void>(
        options,
        resolveFileUrl(options.deleteUrl!, fileId),
        'DELETE',
        null,
        context,
        'application/json',
      )
  }
  if (options.checkUrl) {
    transport.checkFile = (input, context) =>
      sendJson<{ exists: boolean; file?: UploadSuccessResult }>(
        options,
        options.checkUrl!,
        'POST',
        input,
        context,
      )
  }
  if (!options.multipart) return transport

  const multipart = options.multipart
  return {
    ...transport,
    initMultipart(input, context) {
      return sendJson<MultipartSession>(options, multipart.initUrl, 'POST', input, context)
    },
    uploadChunk(input, context) {
      return sendChunk(
        options,
        resolveChunkUrl(multipart.chunkUrl, input.uploadId, input.chunkIndex),
        input,
        context,
      )
    },
    completeMultipart(uploadId, input, context) {
      return sendJson<UploadSuccessResult>(
        options,
        resolveUrl(multipart.completeUrl, uploadId),
        'POST',
        input,
        context,
      )
    },
    cancelMultipart: multipart.cancelUrl
      ? (uploadId, context) =>
          sendJson<void>(
            options,
            resolveUrl(multipart.cancelUrl!, uploadId),
            'DELETE',
            undefined,
            context,
          )
      : undefined,
  }
}

function sendJson<T>(
  options: HttpUploadTransportOptions,
  url: string,
  method: string,
  payload: unknown,
  context: RequestContext & { signal?: AbortSignal },
) {
  // 所有 JSON 控制面请求共用基础 XHR 错误、超时和取消处理。 All JSON control-plane requests share XHR error, timeout, and abort handling.
  return request<T>(options, url, method, JSON.stringify(payload), context, 'application/json')
}

function sendChunk(
  options: HttpUploadTransportOptions,
  url: string,
  input: UploadChunkInput,
  context: UploadRequestContext,
) {
  // 分片字节放在请求体，重组所需元数据放在约定的请求头。 Send chunk bytes in the body and reassembly metadata in agreed headers.
  return request<void>(
    options,
    appendQuery(url, context.query),
    'PUT',
    input.chunk,
    context,
    'application/octet-stream',
    context.onProgress,
    {
      'X-Upload-Id': input.uploadId,
      'X-Chunk-Index': String(input.chunkIndex),
      'X-Total-Chunks': String(input.totalChunks),
      'X-Chunk-Size': String(input.chunkSize),
      'X-File-Name': encodeURIComponent(input.file.name),
      'X-File-Size': String(input.file.size),
      ...(input.file.fileId ? { 'X-File-Id': input.file.fileId } : {}),
      ...(input.file.sha256 ? { 'X-File-Sha256': input.file.sha256 } : {}),
    },
  )
}

function request<T>(
  options: HttpUploadTransportOptions,
  url: string,
  method: string,
  body: XMLHttpRequestBodyInit | null,
  context: RequestContext & { signal?: AbortSignal },
  contentType: string,
  onProgress?: (loaded: number, total: number) => void,
  extraHeaders: Record<string, string> = {},
) {
  // 统一处理非 FormData 请求，确保所有端点错误语义一致。 Centralize non-FormData requests for consistent endpoint errors.
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, appendQuery(url, context.query))
    request.timeout = options.timeout ?? 60_000
    request.withCredentials = options.credentials === 'include'
    for (const [key, value] of Object.entries({ ...context.headers, ...extraHeaders })) {
      request.setRequestHeader(key, value)
    }
    request.setRequestHeader('Content-Type', contentType)
    context.signal?.addEventListener('abort', () => request.abort(), { once: true })
    if (onProgress)
      request.upload.onprogress = (event) =>
        event.lengthComputable && onProgress(event.loaded, event.total)
    request.onerror = () => reject(toError('NETWORK_ERROR', '上传请求失败', true))
    request.ontimeout = () => reject(toError('TIMEOUT', '上传请求超时', true))
    request.onabort = () => reject(toError('ABORTED', '上传已取消', false))
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(
          toError(
            `HTTP_${request.status}`,
            `上传请求失败（${request.status}）`,
            request.status === 408 || request.status === 429 || request.status >= 500,
            request.status,
          ),
        )
        return
      }
      try {
        resolve((request.responseText ? JSON.parse(request.responseText) : undefined) as T)
      } catch (cause) {
        reject(toError('INVALID_RESPONSE', '上传响应无法解析', false, request.status, cause))
      }
    }
    request.send(body)
  })
}

function resolveUrl(value: string | ((uploadId: string) => string), uploadId: string) {
  // 支持回调 URL 或 {uploadId} 模板，并对动态值编码。 Support callback URLs or {uploadId} templates and encode dynamic values.
  return typeof value === 'function'
    ? value(uploadId)
    : value.replace('{uploadId}', encodeURIComponent(uploadId))
}

function resolveFileUrl(value: string | ((fileId: string) => string), fileId: string) {
  // 文件删除 URL 的模板替换与分片会话 URL 使用同一规则。 Apply the same template substitution rule to deletion URLs.
  return typeof value === 'function'
    ? value(fileId)
    : value.replace('{fileId}', encodeURIComponent(fileId))
}

function resolveChunkUrl(
  value: string | ((uploadId: string, chunkIndex: number) => string),
  uploadId: string,
  chunkIndex: number,
) {
  // 分片地址可同时依赖上传会话和分片序号。 Chunk URLs may depend on both session and chunk index.
  return typeof value === 'function'
    ? value(uploadId, chunkIndex)
    : value
        .replace('{uploadId}', encodeURIComponent(uploadId))
        .replace('{index}', String(chunkIndex ?? ''))
}

function appendQuery(url: string, query?: Record<string, string | number | boolean>) {
  if (!query || !Object.keys(query).length) return url
  const target = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
  for (const [key, value] of Object.entries(query)) target.searchParams.set(key, String(value))
  return target.toString()
}

function parseJsonResponse(request: XMLHttpRequest): UploadSuccessResult {
  // 空成功响应视为合法，适配仅通过 HTTP 状态表示成功的服务端。 Treat empty successful bodies as valid for status-only backends.
  if (!request.responseText) return {}
  return JSON.parse(request.responseText) as UploadSuccessResult
}

function toError(
  code: string,
  message: string,
  retriable: boolean,
  status?: number,
  cause?: unknown,
): UploadError {
  // 保留 HTTP 状态和原始原因，调用方可据此展示或决定是否重试。 Preserve status and cause for display and retry decisions.
  return { code, message, retriable, status, cause }
}
