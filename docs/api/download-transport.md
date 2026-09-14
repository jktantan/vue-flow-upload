# 下载传输适配器

`download-transport` 是 `FlowUpload` 的下载协议边界，独立于上传 `transport`。它负责下载已持久化文件，以及创建、轮询和取消服务端归档任务；上传地址不能复用于下载地址。

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
