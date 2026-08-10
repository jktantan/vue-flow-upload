# Vue Flow Upload 后端接口文档

本文档供后端开发实现 `vue-flow-upload` 默认 HTTP 传输适配器时使用。接口以组件库的 `createHttpUploadTransport()` 为准；URL 可按项目网关规范调整，但请求字段、响应结构和分片序号约定应保持一致。

## 1. 接入约定

默认前端配置：

```ts
const transport = createHttpUploadTransport({
  url: '/uploads/file',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

- 所有接口由业务方的认证体系鉴权，例如 `Authorization: Bearer <token>`；前端会透传配置的自定义请求头。
- 除普通上传和分片上传外，请求体均为 `application/json`。JSON 字段使用 camelCase。
- 默认适配器直接读取整个响应 JSON，**不识别** `{ code, message, data }` 等业务包装。若后端必须使用包装结构，请在前端注入自定义 `UploadTransport` 或通过 `parseResponse` / 适配层拆包。
- HTTP 成功状态为 `2xx`。普通上传、秒传检查、初始化和完成接口均应返回 JSON；取消接口可返回空响应。分片上传可返回空响应，或返回任意合法 JSON。
- 分片索引从 `0` 开始。服务端合并时必须按索引升序，而不是按分片到达时间拼接。
- `data` 是业务附加参数，前端会整体 JSON 序列化；由业务服务解析并用于归属、关联记录或权限隔离。

## 2. 公共模型

### 2.1 文件成功结果 `UploadSuccessResult`

以下字段直接位于响应根节点：

```json
{
  "fileId": "file_01J...",
  "name": "report.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "url": "https://cdn.example.com/files/file_01J...",
  "thumbnailUrl": "https://cdn.example.com/thumbs/file_01J...jpg"
}
```

`fileId` 是后续下载和业务关联使用的稳定文件标识。`url` 与 `thumbnailUrl` 可选，建议返回具备权限控制或短有效期的 URL。

### 2.2 错误响应

组件默认会把非 `2xx` 响应统一识别为 `HTTP_<status>`；因此至少应使用准确的 HTTP 状态码。推荐同时返回以下 JSON，供自定义适配器、日志和其他客户端使用：

```json
{
  "code": "SESSION_EXPIRED",
  "message": "上传会话已过期",
  "retriable": false,
  "requestId": "req_..."
}
```

建议状态码：`400` 参数或分片不合法、`401` 未认证、`403` 无权限、`404` 文件/会话不存在、`409` 分片冲突、`413` 文件过大、`415` 类型不支持、`429` 限流、`5xx` 服务端异常。前端默认将 `408`、`429` 和 `5xx` 判定为可重试。

## 3. 上传接口

### 3.1 普通文件上传

`POST /uploads/file`

适用于不大于前端 `normalUploadThreshold`（默认 10 MiB）的文件。

请求使用 `multipart/form-data`，浏览器自动生成 `boundary`，后端不要要求客户端手动指定 `Content-Type`。

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| `file` | form-data | File | 是 | 字段名可由前端 `fileFieldName` 配置，默认 `file`。 |
| `data` | form-data | string | 是 | JSON 字符串；字段名可由 `dataFieldName` 配置，默认 `data`。 |

`data` 示例：`{"bizType":"contract","recordId":"123"}`。

成功响应：`200 OK` 或 `201 Created`，响应为 [文件成功结果](#21-文件成功结果-uploadsuccessresult)。服务端应完成文件校验、持久化及业务记录创建后再返回成功。

### 3.2 秒传检查

`POST /uploads/check`

前端仅在启用 `instantUpload` 且配置了 `checkUrl` 时调用。应按“当前用户/租户 + SHA-256 + 文件大小 + 业务隔离条件”判断是否可复用；即使物理文件存在，也不得绕过访问权限或业务关联创建。

请求：

```json
{
  "name": "report.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "lastModified": 1722470400000,
  "sha256": "4e07408562bedb8b60ce05c1decfe3ad16b722309..."
}
```

命中响应：

```json
{
  "exists": true,
  "file": {
    "fileId": "file_01J...",
    "name": "report.pdf",
    "size": 1048576,
    "mimeType": "application/pdf",
    "url": "https://cdn.example.com/files/file_01J..."
  }
}
```

未命中响应：

```json
{ "exists": false }
```

当 `exists` 为 `true` 时，`file` 必须存在；前端不会再上传文件内容。

### 3.3 创建或恢复分片会话

`POST /uploads/init`

适用于超过 `normalUploadThreshold` 的文件。前端在启用续传时会先计算 SHA-256；后端应根据当前身份、`sha256`、文件大小及必要业务隔离条件复用未过期会话。

请求：

```json
{
  "name": "video.mp4",
  "size": 26214400,
  "mimeType": "video/mp4",
  "lastModified": 1722470400000,
  "sha256": "...",
  "chunkSize": 5242880,
  "totalChunks": 5,
  "data": { "bizType": "video", "recordId": "123" }
}
```

响应：

```json
{
  "uploadId": "upl_01J...",
  "uploadedChunks": [0, 1],
  "expiresAt": "2026-08-08T12:00:00Z"
}
```

`uploadedChunks` 可省略，省略时等同于空数组。它只应包含已完整、可用于合并的索引，范围必须是 `0` 至 `totalChunks - 1`。`uploadId` 必须对当前用户可访问，并应具备过期和清理策略。

### 3.4 上传单个分片

`PUT /uploads/{uploadId}/chunks/{index}`

路径参数：

| 参数 | 说明 |
| --- | --- |
| `uploadId` | 初始化接口返回的会话标识。 |
| `index` | 当前分片索引，从 `0` 开始。 |

请求体为原始二进制字节流，`Content-Type: application/octet-stream`。前端同时发送以下请求头：

| 请求头 | 示例 | 说明 |
| --- | --- | --- |
| `X-Upload-Id` | `upl_01J...` | 与路径中的会话标识一致。 |
| `X-Chunk-Index` | `0` | 当前分片索引。 |
| `X-Total-Chunks` | `5` | 文件总分片数。 |
| `X-Chunk-Size` | `5242880` | 前端配置的分片大小；最后一片可能小于此值。 |
| `X-File-Name` | `video.mp4` | 使用 `encodeURIComponent` 编码，服务端读取后应 URL 解码。 |
| `X-File-Size` | `26214400` | 原始文件总字节数。 |
| `X-File-Sha256` | `...` | 文件完整 SHA-256；未启用哈希时可能不存在。 |

成功时返回 `200 OK`、`201 Created` 或 `204 No Content`。重复提交同一索引且内容一致时必须视为成功（幂等）；内容不一致时应返回 `409 Conflict`。服务端应校验会话归属、索引范围、实际字节数以及必要的文件策略，不能仅信任请求头。

### 3.5 合并分片

`POST /uploads/{uploadId}/complete`

请求：

```json
{
  "sha256": "...",
  "data": { "bizType": "video", "recordId": "123" }
}
```

响应为 [文件成功结果](#21-文件成功结果-uploadsuccessresult)。服务端应先确认所有分片均存在，按索引顺序合并，并校验合并后的文件大小及（存在时）SHA-256；校验通过后再将文件置为可用状态。已经完成的同一会话再次调用应返回同一文件结果，保证幂等。

若分片缺失，推荐返回 `409 Conflict`，例如：

```json
{ "code": "CHUNKS_MISSING", "message": "存在未上传的分片", "missingChunks": [3] }
```

### 3.6 取消上传会话

`DELETE /uploads/{uploadId}`

用于用户明确取消。暂停只会中止浏览器请求，不调用该接口。成功可返回 `204 No Content`；重复取消或会话已不存在时建议仍返回成功，以简化客户端处理。后端可立即删除临时分片，或标记后由定时任务清理。

## 4. 可选：查询分片会话

组件当前默认 HTTP 适配器不会调用该接口，但服务端可提供给管理端、自定义传输适配器或排障使用。

`GET /uploads/{uploadId}`

```json
{
  "uploadId": "upl_01J...",
  "status": "uploading",
  "uploadedChunks": [0, 1],
  "totalChunks": 5,
  "expiresAt": "2026-08-08T12:00:00Z"
}
```

## 5. 下载接口（自定义适配器契约）

下载未包含在 `createHttpUploadTransport()` 中，业务前端需要按 `DownloadTransport` 实现请求。以下 URL 是推荐 REST 设计。

### 5.1 单文件下载

`POST /downloads/file`

请求：`{ "fileId": "file_01J...", "fileName": "report.pdf" }`。

响应可返回短时效 URL：

```json
{ "fileName": "report.pdf", "url": "https://download.example.com/signature..." }
```

也可直接返回二进制流，由适配器转换为 `Blob`。服务端必须按 `fileId` 重新鉴权，不能信任 `fileName`。

### 5.2 创建打包任务

`POST /downloads/archives`

按 ID 打包：

```json
{ "fileIds": ["file_a", "file_b"], "archiveName": "materials.zip" }
```

按服务端筛选条件打包：

```json
{
  "scope": {
    "type": "server-query",
    "queryKey": "order-attachments",
    "query": { "orderId": "123" }
  },
  "archiveName": "order-123.zip"
}
```

响应：

```json
{ "taskId": "arc_01J...", "status": "pending", "progress": 0 }
```

### 5.3 查询或取消打包任务

`GET /downloads/archives/{taskId}` 返回：

```json
{
  "taskId": "arc_01J...",
  "status": "success",
  "progress": 100,
  "fileName": "materials.zip",
  "downloadUrl": "https://download.example.com/signature..."
}
```

`status` 取值：`pending`、`processing`、`success`、`failed`、`canceled`。失败时可返回 `errorMessage`。可选 `DELETE /downloads/archives/{taskId}` 取消未完成任务。

## 6. 服务端实现要求

- 对普通上传、`check`、`init`、分片上传和 `complete` 实现幂等处理，避免网络重试产生重复记录或重复拼接。
- 文件名、MIME、扩展名和前端 SHA-256 都是不可信输入；在服务端执行大小、类型、内容、病毒扫描和权限校验。
- 分片和临时合并文件放在非公开路径；成功文件的访问应通过鉴权下载接口、签名 URL 或受控 CDN 提供。
- 会话必须绑定用户/租户及业务隔离条件，设置过期时间，并定期清理过期会话和临时分片。
- 限制单用户并发会话、分片大小和总文件大小；对 `429` 返回合理的 `Retry-After`。
- 记录 `uploadId`、`fileId`、用户标识和请求追踪 ID，日志中不得记录认证令牌、签名 URL 或文件二进制内容。

## 7. 联调验收

1. 小文件请求为一次 `multipart/form-data`，字段名和 `data` JSON 均正确。
2. 大文件先调用 `init`，只上传 `uploadedChunks` 中不存在的索引，随后调用 `complete`。
3. 相同文件重新选择后，`init` 能返回同一未完成会话及已完成索引，实现续传。
4. `check` 命中时不产生普通上传或分片上传请求，直接返回文件结果。
5. 重复分片 PUT、重复 `complete` 和重复取消均不会造成重复文件或错误合并。
6. 401/403、413、409、429、5xx 及会话过期均能返回可识别的状态码和错误信息。
