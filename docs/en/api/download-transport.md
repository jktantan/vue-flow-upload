# Download transport

`download-transport` is `FlowUpload`'s download protocol boundary and is independent of the upload `transport`. It downloads persisted files and creates, polls, and cancels server-side archive tasks; upload addresses must never be reused for downloads.

For backend integration, see the [backend API contract](/en/guide/backend-api-contract#download-and-server-side-archives), which documents the binary download response, `Content-Disposition`, the archive creation body, and polling responses.

## HTTP download adapter

`createHttpDownloadTransport` uses the authentication headers and shared query that the component resolves; `baseUrl`, the cookie policy, and the timeout are configured when creating the adapter.

```ts
import { createHttpDownloadTransport } from 'vue-flow-upload'

// `{fileId}` 和 `{taskId}` 会自动 URL 编码。
// `{fileId}` and `{taskId}` are URL encoded automatically.
const downloadTransport = createHttpDownloadTransport({
  // 返回一个文件的二进制内容。
  // Returns binary content for one persisted file.
  downloadUrl: '/files/{fileId}/download',
  archive: {
    // 根据已选文件或服务端查询范围创建归档任务。
    // Creates an archive task from selected files or a server-query scope.
    createUrl: '/archives',
    // 查询异步归档任务的状态和最终下载地址。
    // Gets asynchronous archive status and its final download URL.
    taskUrl: '/archives/{taskId}',
    // 取消尚未完成的归档任务。
    // Cancels an archive task that has not completed.
    cancelUrl: '/archives/{taskId}',
  },
})
```

| Endpoint            | Request  | Responsibility                                                                                                                                                        |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `downloadUrl`       | `GET`    | Downloads one finished file behind `{fileId}`. The adapter reads the response as a Blob and prefers the `Content-Disposition` save name, including `filename*`.        |
| `archive.createUrl` | `POST`   | Creates an asynchronous archive task from the selected `fileIds` or a `server-query` scope; the response must contain at least `taskId` and `status`.                   |
| `archive.taskUrl`   | `GET`    | Polls the state of `{taskId}`; on success it must provide `downloadUrl` so the browser can start the archive download.                                                 |
| `archive.cancelUrl` | `DELETE` | Cancels the unfinished archive task `{taskId}`; optional, and without it the component only stops local polling.                                                        |

Pass the adapter to the component's `download-transport`:

```vue
<FlowUpload :download-transport="downloadTransport" />
```

Archive status accepts only `pending`, `processing`, `success`, `failed`, or `canceled`. Provide `parseArchiveResponse` when the backend shape differs, and `parseDownloadResponse` when the download response is not already a Blob.

### Creation options

Beyond the endpoints above, `createHttpDownloadTransport` accepts:

| Option                  | Default  | Description                                                                                                                            |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`               | —        | API prefix or origin prepended to relative endpoints; absolute `http(s)` URLs are unchanged.                                            |
| `credentials`           | —        | Set to `'include'` to send cookies on cross-origin requests.                                                                            |
| `timeout`               | `60000`  | Timeout for one download or archive request, in milliseconds.                                                                            |
| `parseDownloadResponse` | —        | `(response, fallbackFileName) => DownloadResource`; defaults to reading the Blob and the `Content-Disposition` file name.                |
| `parseArchiveResponse`  | —        | `(response) => ArchiveTask`; defaults to requiring `taskId` and a valid `status`.                                                        |

## Developing a custom download adapter

When downloads need short-lived signed URLs, an object-storage SDK, a company request layer, or a nonstandard archive protocol, implement `DownloadTransport` and pass it as `download-transport`.

| Method           | When it is called                              | What it must return                                          |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `downloadFile`   | The user downloads one successful file         | A `DownloadResource` with at least `blob` or `url`.           |
| `createArchive`  | Downloading the selection or every file        | An initial `ArchiveTask` with `taskId` and `status`.          |
| `getArchiveTask` | The initial task is still `pending`/`processing` | The latest `ArchiveTask`; include `downloadUrl` on success.   |
| `cancelArchive`  | The user cancels an unfinished archive         | `void`; optional.                                            |

```ts
import type { ArchiveTask, DownloadTransport } from 'vue-flow-upload'

// 解析器应校验 taskId、status 等字段；不要将未知 JSON 直接断言为 ArchiveTask。
// The parser should validate taskId, status, and related fields; do not directly assert unknown JSON as ArchiveTask.
async function parseArchiveTask(response: Response): Promise<ArchiveTask> {
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('归档响应不是对象')
  if (!('taskId' in payload) || typeof payload.taskId !== 'string')
    throw new Error('归档响应缺少 taskId')
  if (!('status' in payload) || typeof payload.status !== 'string')
    throw new Error('归档响应缺少 status')
  return payload as ArchiveTask
}

const downloadTransport: DownloadTransport = {
  async downloadFile({ fileId, fileName }, context) {
    // 单文件接口返回二进制，因此读取 Blob 而不是 JSON。
    // The single-file endpoint returns binary content, so read Blob rather than JSON.
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`, {
      headers: context.headers,
    })
    if (!response.ok) throw new Error(`下载失败（${response.status}）`)
    return { blob: await response.blob(), fileName }
  },
  async createArchive(input, context) {
    const response = await fetch('/api/archives', {
      method: 'POST',
      headers: { ...context.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error(`创建归档失败（${response.status}）`)
    return parseArchiveTask(response)
  },
  async getArchiveTask(taskId, context) {
    const response = await fetch(`/api/archives/${encodeURIComponent(taskId)}`, {
      headers: context.headers,
    })
    if (!response.ok) throw new Error(`查询归档失败（${response.status}）`)
    return parseArchiveTask(response)
  },
}
```

The current `DownloadTransport` contract has no cancellation signal; the component stops archive polling. A custom implementation should still preserve the HTTP status and the original failure cause and throw the `{ code, message, retriable, status?, cause? }` shape so `download-error` and `archive-error` report it correctly.
