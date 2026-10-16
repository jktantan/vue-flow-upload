# File query transport

`FileQueryTransport` reads file metadata independently from upload and download. It reuses the upload's `belongId`, `belongType`, and `extra`: the first two locate the business scope, while `extra` carries each project's finer matching conditions. Once supplied, `FlowUpload` can query on mount, on an `extra` change, or on a pagination change; without it the host keeps full control of the list through `v-model`.

For backend integration, see the [backend API contract](/en/guide/backend-api-contract#file-queries), which gives the exact POST body, the pagination union, and a complete file-list response example.

## Pagination protocol

After a list deletion succeeds, the component waits for the background query of the current scope before finishing the removal interaction. A failed delete request triggers no query; a read-back failure is reported through `query-error`, and an already successful deletion is never rolled back.

The Playground's "local SQLite" mode calls `POST /api/files/query` through `createHttpFileQueryTransport`: the component handles loading, paging, post-upload refresh, and request cancellation, and the pagination switch refreshes through the public `refreshQuery()`. Mock mode keeps using demo files. The local database shares one demo dataset and does not separate results by `query.belongId`, `query.belongType`, or `query.extra` yet; a production backend must implement business-scope matching.

A query request must carry `pagination` so the backend never has to guess the mode:

| Scenario       | Request `pagination`                       | Response `pagination`                             |
| -------------- | ------------------------------------------ | ------------------------------------------------- |
| Not paginated  | `{ enabled: false }`                       | `{ enabled: false }`                              |
| Paginated      | `{ enabled: true, currentPage, pageSize }` | `{ enabled: true, currentPage, pageSize, total }` |

In a paginated response, `currentPage` and `pageSize` are the values the backend actually used and can correct an out-of-range page, while `total` is the number of records matching the current filter. Both modes must return `files`.
The built-in HTTP adapter validates the pagination mode and every file record: `name` is required and must be a string; optional `type`, `uid`, `fileId`, `url`, and `thumbnailUrl` must be strings, `size` must be a nonnegative finite number, `percent` must be within 0–100, and `status` must be a known file state; a record carrying a browser-only `file` field is rejected. Pagination numbers must be nonnegative integers, `currentPage` and `pageSize` must also be positive, and `pagination.enabled` must match the request. Invalid responses produce `INVALID_RESPONSE`.

## HTTP query adapter

`createHttpFileQueryTransport` POSTs JSON to `queryUrl`. The endpoint's job is to return file metadata for the business ownership, the `extra` matching conditions, and the explicit pagination mode; it is not an address for uploading or downloading binaries.

Beyond `queryUrl`, the adapter accepts `baseUrl` (relative-address prefix), `credentials` (`'include'` sends cross-origin cookies), `timeout` (60000 ms by default), and `parseResponse(response, input)` (a custom result conversion; the default validates `files` and the pagination structure).

```ts
import { createHttpFileQueryTransport } from 'vue-flow-upload'

const queryTransport = createHttpFileQueryTransport({
  // 接收 query（含 extra）和 pagination，并返回文件元数据列表。
  // Receives query (including extra) and pagination and returns a file metadata list.
  queryUrl: '/files/query',
})
```

Default request body and paginated response:

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

When using the component, a deep `extra` change aborts the old request and loads from the first page. `query-on-mount` defaults to `true`; set it to `false` to load manually through the instance's `refreshQuery()`.

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

A custom protocol implements `FileQueryTransport.queryFiles(input, context)`. `context.query` contains `belongId`, `belongType`, and `extra`; the backend must use `query.extra` for project-specific matching. `context.urlQuery` is reserved for URL parameters such as authentication. Pass `context.signal` to the network layer so the component can cancel stale requests when `extra` changes, the page changes, or the component unmounts.

## Developing a custom query adapter

When a project uses GET queries, GraphQL, RPC, or a unified request wrapper, implement `FileQueryTransport` and pass it as `query-transport`. The adapter must return a result whose pagination mode matches `input.pagination.enabled`.

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

If the endpoint only supports GET, serialize `context.query` and `input.pagination` into the agreed URL parameters, but never omit `pagination.enabled`. A new `extra`, a page change, or unmount aborts `context.signal`; the adapter must forward it and must not write cancelled or stale results into other state.
