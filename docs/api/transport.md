# 上传传输适配器

当接口不只是普通上传，或后端响应需要转换时，使用 `transport`。它优先于 `action`，因此一个组件实例只需要维护一种协议入口。

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
