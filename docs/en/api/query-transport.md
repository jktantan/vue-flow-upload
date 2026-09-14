# File query transport

`FileQueryTransport` reads file metadata independently from upload and download. The business query is `context.query`: `belongId` and `belongType` identify the scope, while `extra` carries project-specific matching conditions.

| Mode          | Request pagination                         | Response pagination                               |
| ------------- | ------------------------------------------ | ------------------------------------------------- |
| Not paginated | `{ enabled: false }`                       | `{ enabled: false }`                              |
| Paginated     | `{ enabled: true, currentPage, pageSize }` | `{ enabled: true, currentPage, pageSize, total }` |

`createHttpFileQueryTransport` POSTs this shape to `queryUrl`:

```json
{
  "query": { "belongId": "order-1", "belongType": "order", "extra": { "status": "success" } },
  "pagination": { "enabled": true, "currentPage": 1, "pageSize": 20 }
}
```

Custom adapters implement `queryFiles(input, context)`. They must pass `context.signal` to the network layer and return a result whose pagination mode matches the input. `context.urlQuery` is reserved for shared URL authentication parameters.
