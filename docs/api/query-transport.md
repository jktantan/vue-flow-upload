# 文件查询传输适配器

`query-transport` 独立于上传和下载适配器，负责读取文件元数据列表。传入后，`FlowUpload` 可在挂载时加载列表，并在筛选条件或分页变更时自动查询；未传入时仍完全由宿主通过 `v-model` 提供文件列表。

## 分页协议

查询请求必须携带 `pagination`，以避免后端猜测是否分页：

| 场景   | 请求 `pagination`                          | 返回 `pagination`                                 |
| ------ | ------------------------------------------ | ------------------------------------------------- |
| 不分页 | `{ enabled: false }`                       | `{ enabled: false }`                              |
| 分页   | `{ enabled: true, currentPage, pageSize }` | `{ enabled: true, currentPage, pageSize, total }` |

分页响应中的 `currentPage` 和 `pageSize` 是后端实际采用的值，可用于纠正越界页；`total` 是符合当前筛选条件的全部记录数。两种模式都必须返回 `files`。

## HTTP 查询适配器

`createHttpFileQueryTransport` 使用 JSON `POST` 调用 `queryUrl`。该地址的职责是根据业务归属、筛选条件和明确的分页模式返回文件元数据；它不是上传或下载二进制的地址。

```ts
import { createHttpFileQueryTransport } from 'vue-flow-upload'

const queryTransport = createHttpFileQueryTransport({
  // 接收 data、filters、pagination 并返回文件元数据列表。
  // Receives data, filters, and pagination and returns a file metadata list.
  queryUrl: '/files/query',
})
```

默认 HTTP 请求体和分页响应如下：

```json
{
  "data": { "belongId": "order-1", "belongType": "order" },
  "filters": { "keyword": "invoice", "status": "success" },
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

使用组件时，`query-filters` 深度变化会中止旧请求并从第一页加载。`query-on-mount` 默认为 `true`；设为 `false` 后可通过组件实例的 `refreshQuery()` 手动加载。

```vue
<FlowUpload
  v-model="files"
  belong-id="order-1"
  belong-type="order"
  :pagination="pagination"
  :query-transport="queryTransport"
  :query-filters="{ keyword, status: 'success' }"
  @update:pagination="(value) => (pagination = value)"
  @query-error="handleQueryError"
/>
```

自定义协议实现 `FileQueryTransport.queryFiles(input, context)`。`context.data` 包含 `belongId`、`belongType` 和 `extra`；`context.signal` 必须传给网络层，以便组件在筛选、翻页或卸载时取消过期请求。
