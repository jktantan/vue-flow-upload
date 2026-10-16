# Upload transport

`transport` is the component's only upload protocol boundary: it describes how to create, upload, check, chunk, and delete files without fixing the HTTP client. XHR, Fetch, Axios, a project request wrapper, or a direct-to-object-storage upload all work.

For backend integration, read the [backend API contract](/en/guide/backend-api-contract#upload-flow) first: it lists the JSON payloads, `multipart/form-data` fields, chunk headers, and response shapes the built-in HTTP adapter actually sends.

`action` is not a second transfer mechanism but the shortcut for `createHttpUploadTransport({ url: action })`. A standard `multipart/form-data` endpoint can be served with `action` alone; response conversion, signed uploads, instant upload, chunks, and resume need a direct `transport`. When both are supplied, `transport` wins, so one component instance should keep a single protocol entry point.

## HTTP upload adapter

`createHttpUploadTransport` maps the common HTTP endpoints:

```ts
import { createHttpUploadTransport } from 'vue-flow-upload'

// 将组件生命周期映射到项目的普通、秒传和分片端点。
// Maps the component lifecycle to the application's normal, instant, and multipart endpoints.
const transport = createHttpUploadTransport({
  url: '/uploads/file',
  createUrl: '/uploads/files',
  deleteUrl: '/uploads/files/{fileId}',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

| Endpoint                | Request         | Responsibility                                                              |
| ----------------------- | --------------- | --------------------------------------------------------------------------- |
| `url`                   | `POST` or `PUT` | Uploads the binary and business data of a normal file.                      |
| `createUrl`             | `POST`          | Creates or confirms the file record before upload and returns a stable `fileId`. |
| `deleteUrl`             | `DELETE`        | Removes the remote file behind `{fileId}` and its temporary upload sessions. |
| `checkUrl`              | `POST`          | Checks instant-upload availability from the name, size, and SHA-256.         |
| `multipart.initUrl`     | `POST`          | Creates or resumes a multipart session and returns `uploadId` plus stored chunks. |
| `multipart.chunkUrl`    | `PUT`           | Uploads chunk `{index}` of session `{uploadId}`.                             |
| `multipart.completeUrl` | `POST`          | Merges the stored chunks of `{uploadId}` and returns the file result.        |
| `multipart.cancelUrl`   | `DELETE`        | Releases the caller's lease on the unfinished session `{uploadId}`.          |

`{fileId}`, `{uploadId}`, and `{index}` are template placeholders; the built-in adapter encodes dynamic identifiers before writing them into the URL.

### Creation options

Beyond the endpoints above, `createHttpUploadTransport` accepts:

| Option          | Default  | Description                                                                                                     |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `baseUrl`       | —        | API prefix or origin prepended to relative endpoints; absolute `http(s)` URLs are unchanged.                     |
| `method`        | `'POST'` | HTTP method used for the normal upload; may be `'PUT'`.                                                          |
| `credentials`   | —        | Set to `'include'` to send cookies on cross-origin requests.                                                     |
| `timeout`       | `60000`  | Timeout for one request, in milliseconds.                                                                        |
| `parseResponse` | —        | Converts the upload `XMLHttpRequest` into `UploadSuccessResult`; defaults to JSON parsing, treating an empty response as `{}`. |

`deleteUrl`, `multipart.chunkUrl`, `multipart.completeUrl`, and `multipart.cancelUrl` also accept a callback such as `(fileId) => ...` instead of a template string, letting the caller build and encode dynamic values itself.

## Developing a custom upload adapter

When a project uses Axios, a Fetch wrapper, signed direct uploads, or an object-storage SDK, implement `UploadTransport` and pass it as `transport`. A minimal implementation only needs `uploadFile`; add the other methods as the backend supports them.

| Method              | When it is called                     | What it must return                                                                                            |
| ------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `uploadFile`        | Normal file upload                    | `UploadSuccessResult`; a stable `fileId` is recommended.                                                        |
| `createFile`        | Pre-creating the remote record        | `{ fileId }`.                                                                                                   |
| `checkFile`         | SHA-256 instant-upload check          | `{ state: 'ready', file }`, `{ state: 'missing' }`, or a shared-upload state; `{ exists, file? }` stays supported. |
| `initMultipart`     | Creating or resuming a session        | `{ uploadId, state?, uploadedChunks? }`, where `state` is `uploading`, `merging`, or `processing`.              |
| `uploadChunk`       | Uploading one chunk                   | `void`.                                                                                                         |
| `completeMultipart` | Server-side merge of chunks           | `UploadSuccessResult`.                                                                                          |
| `cancelMultipart`   | Cancelling an unfinished session      | `void`.                                                                                                         |
| `deleteFile`        | Deleting a persisted file             | `void`.                                                                                                         |

```ts
import type { UploadSuccessResult, UploadTransport } from 'vue-flow-upload'

// 项目请求层应验证 response.ok，并保留业务错误码与 HTTP 状态。
// The project request layer should validate response.ok and preserve business error codes and HTTP status.
async function parseUploadResult(response: Response): Promise<UploadSuccessResult> {
  // 服务端 JSON 是未知输入，解析器负责验证最小字段。
  // Server JSON is unknown input; the parser validates minimum fields.
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('上传响应不是对象')
  return payload as UploadSuccessResult
}

const uploadTransport: UploadTransport = {
  async uploadFile({ file, fileId, data }, context) {
    // FormData 保持文件与业务数据的既有字段约定。
    // FormData preserves the established fields for file and business data.
    const formData = new FormData()
    formData.append(context.fileFieldName, file)
    formData.append('fileId', fileId)
    formData.append(context.dataFieldName, JSON.stringify(data))
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers: context.headers,
      body: formData,
      signal: context.signal,
    })
    if (!response.ok)
      throw {
        code: `HTTP_${response.status}`,
        message: '上传失败',
        retriable: response.status >= 500,
      }
    // Fetch 不提供稳定上传进度时，至少在完成时报告全部字节。
    // When Fetch has no stable upload progress, report all bytes at completion at minimum.
    context.onProgress(file.size, file.size)
    return parseUploadResult(response)
  },
}
```

Pass `context.signal` to the request layer; with XHR or Axios, convert raw byte progress into `context.onProgress(loaded, total)`. Failures must throw the `{ code, message, retriable, status?, cause? }` shape — never swallow network, cancellation, or server errors. If the example parser does not fit the backend response, replace it with the project's own runtime validator.

For shared deduplicated uploads, `checkFile` returns `state: 'ready'` only when the content is complete and accessible to the caller. On `uploading`, the component calls `initMultipart` for the authoritative missing-chunk list and uploads only those chunks; on `merging` or `processing`, chunk writes stop and the idempotent `completeMultipart` is invoked to await the server result. The full concurrency, authorization, merge-lock, validation, and cleanup requirements are in the [backend API contract](/en/guide/backend-api-contract#instant-and-concurrent-uploads).
