import type {
  MultipartSession,
  RequestContext,
  UploadChunkInput,
  UploadError,
  UploadRequestContext,
  UploadSuccessResult,
  UploadTransport,
} from './types'

export interface HttpUploadTransportOptions {
  url: string
  method?: 'POST' | 'PUT'
  credentials?: RequestCredentials
  timeout?: number
  parseResponse?: (response: XMLHttpRequest) => UploadSuccessResult
  checkUrl?: string
  multipart?: {
    initUrl: string
    chunkUrl: string | ((uploadId: string, chunkIndex: number) => string)
    completeUrl: string | ((uploadId: string) => string)
    cancelUrl?: string | ((uploadId: string) => string)
  }
}

/** Creates the default XHR transport for normal and optional multipart uploads. */
export function createHttpUploadTransport(options: HttpUploadTransportOptions): UploadTransport {
  const transport: UploadTransport = {
    uploadFile({ file, data }, context) {
      return new Promise<UploadSuccessResult>((resolve, reject) => {
        if (context.signal.aborted) {
          reject(toError('ABORTED', '上传已取消', false))
          return
        }
        const request = new XMLHttpRequest()
        const formData = new FormData()
        const method = options.method ?? 'POST'

        formData.append(context.fileFieldName, file)
        formData.append(context.dataFieldName, JSON.stringify(data))
        request.open(method, options.url)
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
  return request<T>(options, url, method, JSON.stringify(payload), context, 'application/json')
}

function sendChunk(
  options: HttpUploadTransportOptions,
  url: string,
  input: UploadChunkInput,
  context: UploadRequestContext,
) {
  return request<void>(
    options,
    url,
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
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
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
  return typeof value === 'function'
    ? value(uploadId)
    : value.replace('{uploadId}', encodeURIComponent(uploadId))
}

function resolveChunkUrl(
  value: string | ((uploadId: string, chunkIndex: number) => string),
  uploadId: string,
  chunkIndex: number,
) {
  return typeof value === 'function'
    ? value(uploadId, chunkIndex)
    : value
        .replace('{uploadId}', encodeURIComponent(uploadId))
        .replace('{index}', String(chunkIndex ?? ''))
}

function parseJsonResponse(request: XMLHttpRequest): UploadSuccessResult {
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
  return { code, message, retriable, status, cause }
}
