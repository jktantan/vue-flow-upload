# 上传与下载传输适配器

`transport` 是组件唯一的上传协议边界：它描述“如何创建、上传、校验、分片和删除文件”，而不限定具体的 HTTP 客户端。它可以使用 XHR、Fetch、Axios、项目请求封装，或直接上传到对象存储。

`action` 不是另一套传输机制，而是内置 `createHttpUploadTransport({ url: action })` 的普通上传快捷写法。标准 `multipart/form-data` 接口可用 `action` 少写配置；响应转换、签名上传、秒传、分片或续传等场景应直接传入 `transport`。两者同时提供时，`transport` 优先，因此一个组件实例只应维护一种协议入口。

## HTTP 适配器

`createHttpUploadTransport` 可生成常见 HTTP 接口的映射：

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

## 自定义实现

最小适配器只需要实现普通上传的 `uploadFile`；需要秒传、分片与断点续传时，额外实现 `checkFile`、`initMultipart`、`uploadChunk`、`completeMultipart` 和 `cancelMultipart`。

每个方法都会收到 `AbortSignal` 与进度回调。应将取消信号传给网络层，并在失败时抛出或 reject 含有 `code`、`message`、`retriable` 的错误，以便组件正确处理取消和重试。

## 下载 HTTP 适配器

`createHttpDownloadTransport` 会使用组件解析的认证头和公共 query；`baseUrl`、Cookie 策略与超时在创建适配器时配置。它以 `GET` 请求取得单文件 Blob，并按 `Content-Disposition`（优先 `filename*`）确定保存名；归档创建使用 JSON `POST`，任务查询使用 `GET`，取消使用 `DELETE`。

```ts
import { createHttpDownloadTransport } from 'vue-flow-upload'

// `{fileId}` 和 `{taskId}` 会自动 URL 编码。
// `{fileId}` and `{taskId}` are URL encoded automatically.
const downloadTransport = createHttpDownloadTransport({
  downloadUrl: '/files/{fileId}/download',
  archive: {
    createUrl: '/archives',
    taskUrl: '/archives/{taskId}',
    cancelUrl: '/archives/{taskId}',
  },
})
```

将它传给组件的 `download-transport`。归档端点默认需返回 `{ taskId, status }`，其中 `status` 为 `pending`、`processing`、`success`、`failed` 或 `canceled`；成功任务还需返回 `downloadUrl`。若后端 JSON 结构不同，可使用 `parseArchiveResponse`；下载响应结构不同则使用 `parseDownloadResponse`。
