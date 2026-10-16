# File query transport

`FileQueryTransport` reads file metadata independently from upload and download. The business query is `context.query`: `belongId` and `belongType` identify the scope, while `extra` carries project-specific matching conditions.

For backend integration, see the [backend API contract](/en/guide/backend-api-contract#file-queries), which gives the exact POST body, the pagination union, and a complete file-list response example.

| Mode          | Request pagination                         | Response pagination                               |
| ------------- | ------------------------------------------ | ------------------------------------------------- |
| Not paginated | `{ enabled: false }`                       | `{ enabled: false }`                              |
| Paginated     | `{ enabled: true, currentPage, pageSize }` | `{ enabled: true, currentPage, pageSize, total }` |

The built-in HTTP adapter validates pagination mode and every file record: `name` is required and must be a string; optional `type`, `uid`, `fileId`, `url`, and `thumbnailUrl` must be strings, `size` must be a nonnegative finite number, and `percent` must be within 0–100 when present. `status` must be a known file state, and a record carrying a browser-only `file` field is rejected. Pagination numbers must be integers; `currentPage` and `pageSize` must also be positive, and `pagination.enabled` must match the request. Invalid responses produce `INVALID_RESPONSE`.

`createHttpFileQueryTransport` POSTs this shape to `queryUrl`:

```json
{
  "query": { "belongId": "order-1", "belongType": "order", "extra": { "status": "success" } },
  "pagination": { "enabled": true, "currentPage": 1, "pageSize": 20 }
}
```

Custom adapters implement `queryFiles(input, context)`. They must pass `context.signal` to the network layer and return a result whose pagination mode matches the input. `context.urlQuery` is reserved for shared URL authentication parameters.
