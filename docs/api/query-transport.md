# 文件查询传输适配器

`query-transport` 独立于上传和下载适配器，负责读取文件元数据列表。它复用上传的 `belongId`、`belongType` 与 `extra`：前两者定位业务范围，`extra` 承载每个项目不同的精细匹配条件。传入后，`FlowUpload` 可在挂载、`extra` 变化或分页变更时自动查询；未传入时仍完全由宿主通过 `v-model` 提供文件列表。

后端联调时，请参阅[后端接口协议](/guide/backend-api-contract#文件查询)，其中给出了准确的 POST body、分页联合结构和完整的文件列表响应示例。

## 分页协议

列表删除成功后，组件会等待当前范围的后台查询结束再完成删除交互。删除请求失败时不会查询；回读失败通过 `query-error` 报告，已成功的删除不会回滚。

Playground 的“本地 SQLite”模式通过 `createHttpFileQueryTransport` 调用 `POST /api/files/query`，由组件负责加载、翻页、上传后刷新和取消请求；分页开关通过公开的 `refreshQuery()` 刷新。Mock 模式继续使用演示文件。当前本地数据库共用一个演示数据集，尚不按 `query.belongId`、`query.belongType` 或 `query.extra` 隔离筛选；生产后端必须实现业务范围匹配。

查询请求必须携带 `pagination`，以避免后端猜测是否分页：

| 场景   | 请求 `pagination`                          | 返回 `pagination`                                 |
| ------ | ------------------------------------------ | ------------------------------------------------- |
| 不分页 | `{ enabled: false }`                       | `{ enabled: false }`                              |
| 分页   | `{ enabled: true, currentPage, pageSize }` | `{ enabled: true, currentPage, pageSize, total }` |

分页响应中的 `currentPage` 和 `pageSize` 是后端实际采用的值，可用于纠正越界页；`total` 是符合当前筛选条件的全部记录数。两种模式都必须返回 `files`。

## HTTP 查询适配器

`createHttpFileQueryTransport` 使用 JSON `POST` 调用 `queryUrl`。该地址的职责是根据业务归属、`extra` 匹配条件和明确的分页模式返回文件元数据；它不是上传或下载二进制的地址。

```ts
import { createHttpFileQueryTransport } from 'vue-flow-upload'

const queryTransport = createHttpFileQueryTransport({
  // 接收 query（含 extra）和 pagination，并返回文件元数据列表。
  // Receives query (including extra) and pagination and returns a file metadata list.
  queryUrl: '/files/query',
})
```

默认 HTTP 请求体和分页响应如下：

```json
{
  "query": {
    "belongId": "order-1",
    "belongType": "order",
    "extra": { "keyword": "invoice", "status": "success" }
  },
  "pagination": { "enabled": true, "currentPage": 1, "pageSize": 20 }
}
```

```json
{
  "files": [
    { "name": "invoice.pdf", "size": 1024, "type": "application/pdf", "status": "success" }
  ],
  "pagination": { "enabled": true, "currentPage": 1, "pageSize": 20, "total": 42 }
}
```

使用组件时，`extra` 深度变化会中止旧请求并从第一页加载。`query-on-mount` 默认为 `true`；设为 `false` 后可通过组件实例的 `refreshQuery()` 手动加载。

```vue
<FlowUpload
  v-model="files"
  belong-id="order-1"
  belong-type="order"
  :pagination="pagination"
  :query-transport="queryTransport"
  :extra="{ keyword, status: 'success' }"
  @update:pagination="(value) => (pagination = value)"
  @query-error="handleQueryError"
/>
```

自定义协议实现 `FileQueryTransport.queryFiles(input, context)`。`context.query` 包含 `belongId`、`belongType` 和 `extra`；后端必须使用 `query.extra` 处理项目特定匹配。`context.urlQuery` 仅用于认证等 URL 参数。`context.signal` 必须传给网络层，以便组件在 `extra`、翻页或卸载时取消过期请求。

## 开发自定义查询适配器

当项目使用 GET 查询、GraphQL、RPC 或统一请求封装时，实现 `FileQueryTransport` 并传给 `query-transport`。适配器必须让返回结果的分页模式与 `input.pagination.enabled` 一致。

```ts
import type { FileQueryResult, FileQueryTransport } from 'vue-flow-upload'

// 解析器必须验证 files 数组与 pagination.enabled；分页模式不一致应抛出错误。
// The parser must validate the files array and pagination.enabled; a mismatched pagination mode must throw.
async function parseFileQueryResult(response: Response): Promise<FileQueryResult> {
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') throw new Error('查询响应不是对象')
  if (!('files' in payload) || !Array.isArray(payload.files)) throw new Error('查询响应缺少 files')
  if (!('pagination' in payload) || typeof payload.pagination !== 'object' || !payload.pagination)
    throw new Error('查询响应缺少 pagination')
  return payload as FileQueryResult
}

const queryTransport: FileQueryTransport = {
  async queryFiles(input, context) {
    // 业务查询条件始终放在 query；公共认证参数仅附加到 URL。
    // Business query conditions always belong in query; shared auth parameters are appended only to the URL.
    const url = new URL('/api/files/query', window.location.origin)
    for (const [key, value] of Object.entries(context.urlQuery ?? {}))
      url.searchParams.set(key, String(value))
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...context.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: context.query, pagination: input.pagination }),
      signal: context.signal,
    })
    if (!response.ok) throw new Error(`查询失败（${response.status}）`)
    return parseFileQueryResult(response)
  },
}
```

若接口只支持 GET，可将 `context.query` 和 `input.pagination` 序列化为后端约定的 URL 参数；但不要省略 `pagination.enabled`。新 `extra`、翻页或卸载会中止 `context.signal`，适配器必须透传它，且不能将已取消或过期结果写回其他状态。
