# 下载传输适配器

`download-transport` 是 `FlowUpload` 的下载协议边界，独立于上传 `transport`。它负责下载已持久化文件，以及创建、轮询和取消服务端归档任务；上传地址不能复用于下载地址。

后端联调时，请参阅[后端接口协议](/guide/backend-api-contract#下载与服务端打包)，其中说明了二进制下载响应、`Content-Disposition`、归档创建 body 及轮询响应。

## HTTP 下载适配器

`createHttpDownloadTransport` 会使用组件解析的认证头和公共 query；`baseUrl`、Cookie 策略与超时在创建适配器时配置。

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

| 配置地址            | 请求     | 地址作用                                                                                                                        |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `downloadUrl`       | `GET`    | 下载 `{fileId}` 对应的一个已完成文件。适配器将响应读取为 Blob，并优先使用 `Content-Disposition`（含 `filename*`）提供的保存名。 |
| `archive.createUrl` | `POST`   | 根据选中的 `fileIds` 或 `server-query` 范围创建异步归档任务，响应必须至少包含 `taskId` 和 `status`。                            |
| `archive.taskUrl`   | `GET`    | 轮询 `{taskId}` 的状态；成功时必须提供 `downloadUrl`，供浏览器开始归档下载。                                                    |
| `archive.cancelUrl` | `DELETE` | 取消 `{taskId}` 对应的未完成归档任务；可省略，省略后组件仅停止本地轮询。                                                        |

将适配器传给组件的 `download-transport`：

```vue
<FlowUpload :download-transport="downloadTransport" />
```

归档状态只接受 `pending`、`processing`、`success`、`failed` 或 `canceled`。后端响应结构不同可提供 `parseArchiveResponse`；下载响应不直接返回 Blob 时可提供 `parseDownloadResponse`。

## 开发自定义下载适配器

当下载需要短期签名 URL、对象存储 SDK、公司请求层或非标准归档协议时，实现 `DownloadTransport` 并传给 `download-transport`。

| 方法             | 何时调用                                 | 必须返回                                          |
| ---------------- | ---------------------------------------- | ------------------------------------------------- |
| `downloadFile`   | 用户下载单个成功文件                     | 至少包含 `blob` 或 `url` 的 `DownloadResource`。  |
| `createArchive`  | 下载选中项或全部文件                     | 初始 `ArchiveTask`，必须包含 `taskId`、`status`。 |
| `getArchiveTask` | 初始任务仍为 `pending` / `processing` 时 | 最新 `ArchiveTask`；成功时必须含 `downloadUrl`。  |
| `cancelArchive`  | 用户取消未完成归档时                     | `void`；可选。                                    |

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

`DownloadTransport` 现有契约没有取消信号；归档轮询由组件停止。自定义实现仍应保留 HTTP 状态与原始失败原因，并抛出 `{ code, message, retriable, status?, cause? }` 结构，便于 `download-error` 与 `archive-error` 正确报告。
