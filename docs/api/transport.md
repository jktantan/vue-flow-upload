# 上传传输适配器

`transport` 是组件唯一的上传协议边界：它描述“如何创建、上传、校验、分片和删除文件”，而不限定具体的 HTTP 客户端。它可以使用 XHR、Fetch、Axios、项目请求封装，或直接上传到对象存储。

`action` 不是另一套传输机制，而是内置 `createHttpUploadTransport({ url: action })` 的普通上传快捷写法。标准 `multipart/form-data` 接口可用 `action` 少写配置；响应转换、签名上传、秒传、分片或续传等场景应直接传入 `transport`。两者同时提供时，`transport` 优先，因此一个组件实例只应维护一种协议入口。

## HTTP 上传适配器

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

| 配置地址                | 请求            | 地址作用                                               |
| ----------------------- | --------------- | ------------------------------------------------------ |
| `url`                   | `POST` 或 `PUT` | 上传普通文件的二进制与业务数据。                       |
| `createUrl`             | `POST`          | 上传前创建或确认文件记录，返回稳定的 `fileId`。        |
| `deleteUrl`             | `DELETE`        | 删除 `{fileId}` 指向的远端文件和临时上传会话。         |
| `checkUrl`              | `POST`          | 根据文件名、大小和 SHA-256 检查是否可秒传。            |
| `multipart.initUrl`     | `POST`          | 创建或恢复分片上传会话，返回 `uploadId` 与已上传分片。 |
| `multipart.chunkUrl`    | `PUT`           | 上传 `{uploadId}` 会话中的第 `{index}` 个分片。        |
| `multipart.completeUrl` | `POST`          | 合并 `{uploadId}` 的已上传分片并返回文件结果。         |
| `multipart.cancelUrl`   | `DELETE`        | 取消 `{uploadId}` 对应的未完成分片会话。               |

`{fileId}`、`{uploadId}` 和 `{index}` 是模板占位符；动态 ID 会由内置适配器编码后写入 URL。

## 自定义实现

最小适配器只需要实现普通上传的 `uploadFile`；需要秒传、分片与断点续传时，额外实现 `checkFile`、`initMultipart`、`uploadChunk`、`completeMultipart` 和 `cancelMultipart`。

每个方法都会收到 `AbortSignal` 与进度回调。应将取消信号传给网络层，并在失败时抛出或 reject 含有 `code`、`message`、`retriable` 的错误，以便组件正确处理取消和重试。
