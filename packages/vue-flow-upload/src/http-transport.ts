import type { UploadError, UploadSuccessResult, UploadTransport } from './types'

export interface HttpUploadTransportOptions {
  url: string
  method?: 'POST' | 'PUT'
  credentials?: RequestCredentials
  timeout?: number
  parseResponse?: (response: XMLHttpRequest) => UploadSuccessResult
}

/** Creates the normal multipart/FormData transport used by M1. */
export function createHttpUploadTransport(options: HttpUploadTransportOptions): UploadTransport {
  return {
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
