# Backend API contract

This page is the single protocol reference for integrating a backend with `FlowUpload`. The requests and responses below match the built-in HTTP adapters: `createHttpUploadTransport`, `createHttpDownloadTransport`, and `createHttpFileQueryTransport`. With a custom `transport`, `download-transport`, or `query-transport`, URLs, field names, and outer response wrapping are yours to map; the adapter must still produce the component contracts listed here.

## Shared conventions before integration

- All control-plane endpoints (create, instant check, multipart init/complete, query, archive) use JSON. Successful responses must be the exact objects shown on this page, not wrapped in an extra `{ code, data }` layer. If your project already wraps responses, unwrap them inside the adapter's `parseResponse` (upload and query), `parseArchiveResponse`, or `parseDownloadResponse`.
- Normal uploads use `multipart/form-data`, and the browser generates the boundary. Never require the client to set `Content-Type` manually.
- `auth.headers` is sent as HTTP request headers; `auth.query` is appended to every built-in upload, download, and query URL. Keep business ownership out of the URL query and send it through `data` or `query`.
- Any `2xx` status counts as success, and an empty body is allowed only for normal upload, deletion, chunk upload, and archive cancellation. Query, instant check, record creation, multipart initialization, completion, and archive creation/query must return JSON.
- `fileId` is the persistent server-side file ID; it must be stable and usable for later deletion, download, and query records. Never use the client `uid`. When no pre-create endpoint is configured, the component generates a UUID as the initial `fileId` and submits it with the upload.
- File sizes, `chunkSize`, and chunk byte lengths are all in bytes; chunk `chunkIndex` is zero-based while `currentPage` is one-based.

## Upload flow

For a normal file (not above `normal-upload-threshold`, 10 MiB by default):

```text
select file
  → POST createUrl (optional; allocate/confirm fileId)
  → POST checkUrl (optional; SHA-256 instant check)
  → POST/PUT url (multipart/form-data binary upload)
  → file result (success or processing)
```

For a large file above the threshold when multipart is configured:

```text
select file
  → POST createUrl (optional)
  → POST checkUrl (optional)
  → POST multipart.initUrl (create or resume uploadId)
  → concurrent PUT multipart.chunkUrl (only missing chunkIndex values)
  → POST multipart.completeUrl (server verifies and merges)
  → file result (success or processing)
```

Pausing, removing, or cancelling a chunked file aborts the HTTP requests the browser has not finished. A shared session must never be deleted by one caller; `multipart.cancelUrl` should release only the current caller's lease, and the server cleans up temporary chunks after the session expires with no remaining leases. Deleting a persisted file calls `deleteUrl`. The client skips the byte upload and adopts the returned `file` only after `checkUrl` returns `state: "ready"` (or the compatible `exists: true`).

### Request and response for each upload endpoint

| Operation | HTTP request | Body / headers | Success response |
| --- | --- | --- | --- |
| Pre-create file | `POST createUrl` | JSON: `FileMeta` + `data` | `{ "fileId": "file_123" }` |
| Instant check | `POST checkUrl` | JSON: `FileMeta` | `{ "state": "missing" }`, `{ "state": "ready", "file": UploadSuccessResult }`, or a shared-upload state |
| Normal upload | `POST` (default) or `PUT url` | `multipart/form-data`: file field, `fileId`, JSON-string data field | `UploadSuccessResult` or an empty body |
| Initialize multipart | `POST multipart.initUrl` | JSON: `FileMeta` + `chunkSize`, `totalChunks`, `data` | `{ "uploadId": "upload_123", "state": "uploading", "uploadedChunks": [0, 1] }` |
| Upload a chunk | `PUT multipart.chunkUrl` | Raw chunk bytes as the body; see the headers below | Empty body or any valid JSON (the body is not read) |
| Complete multipart | `POST multipart.completeUrl` | JSON: `fileId?`, `sha256?`, `data` | `UploadSuccessResult` |
| Cancel multipart | `DELETE multipart.cancelUrl` | No body | May be empty |
| Delete file | `DELETE deleteUrl` | No body | May be empty |

#### `FileMeta`: metadata for pre-create, instant check, and multipart initialization

```json
{
  "fileId": "4cb11903-6b4d-4c84-b988-a7c7d7a9f88f",
  "name": "invoice.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "lastModified": 1722470400000,
  "sha256": "optional 64-character hex digest"
}
```

`sha256` is present only when instant check is enabled, or when `resume` is on for a large file. The pre-create request adds `data` to those fields, and multipart initialization adds `chunkSize`, `totalChunks`, and `data`:

```json
{
  "fileId": "file_123",
  "name": "archive.zip",
  "size": 26214400,
  "mimeType": "application/zip",
  "lastModified": 1722470400000,
  "sha256": "...",
  "chunkSize": 1048576,
  "totalChunks": 25,
  "data": {
    "belongId": "order-1001",
    "belongType": "order",
    "extra": { "category": "invoice" }
  }
}
```

`data` comes from the component's `data` prop, with `belong-id`, `belong-type`, and `extra` overriding same-named fields. The default normal-upload field names are `file` and `data`, configurable through `file-field-name` and `data-field-name`:

```text
Content-Type: multipart/form-data; boundary=…

file: <binary file>
fileId: file_123
data: {"belongId":"order-1001","belongType":"order","extra":{"category":"invoice"}}
```

## Instant and concurrent uploads

The server must separate the **content object** from the **business file reference**. A content object is uniquely identified by `sha256`, `size`, the hash algorithm, and the storage-policy version; a business file reference records the current user, tenant, business ownership, and download authorization. Never return another user's `fileId`, URL, or existence information merely because the hash matches.

The recommended `checkUrl` response uses a discriminated `state`, and `ready` may be returned only when the content is complete and the current caller may create or read a reference:

```json
{ "state": "ready", "file": { "fileId": "file_123", "status": "success" } }
```

Return `{ "state": "missing" }` when the content does not exist. When another user is transferring the same content, return the state below; the client still calls the idempotent `initUrl` for the authoritative missing-chunk list, so `uploadId` and `uploadedChunks` are optional and used only for diagnostics or display:

```json
{ "state": "uploading", "uploadId": "upload_123", "uploadedChunks": [0, 1], "retryAfterMs": 1000 }
```

Return `{ "state": "merging", "uploadId": "upload_123", "retryAfterMs": 1000 }` when another request has already started merging or asynchronous post-processing.

For backward compatibility the component still accepts `{ "exists": false }` and `{ "exists": true, "file": ... }`; new servers should migrate to `state`. The instant check runs before `createUrl`, which prevents orphaned business file records on a shared-content hit. After a miss, `createUrl` must be idempotent and create or confirm the current caller's business reference at completion.

`initUrl` is an atomic "get or create session by content" operation and must not be implemented as a separate read followed by an insert. Prefer a unique constraint on the content key, or complete the creation in a short transaction or distributed lock. It must always return the authoritative state of the same active session:

```json
{
  "uploadId": "upload_123",
  "state": "uploading",
  "uploadedChunks": [0, 1]
}
```

When `state` is omitted the component treats it as `uploading`. If the session is already merging or post-processing, return `merging` or `processing`; the client stops writing chunks and instead calls the idempotent `completeUrl`, and the backend returns `processing` or the final file result.

#### Chunk PUT request

The chunk binary is not wrapped in `FormData` or JSON — the entire HTTP body is that chunk. The `{uploadId}` and `{index}` placeholders in the URL are substituted and URL-encoded. The backend locates and verifies the chunk through these headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `application/octet-stream` |
| `X-Upload-Id` | Current multipart session ID |
| `X-Chunk-Index` | Zero-based chunk index |
| `X-Total-Chunks` | Total number of chunks in the file |
| `X-Chunk-Size` | Configured chunk size in bytes |
| `X-File-Name` | `encodeURIComponent`-encoded original file name |
| `X-File-Size` | Total original file size in bytes |
| `X-File-Id` | Optional persistent file ID |
| `X-File-Sha256` | Optional full-file SHA-256 |

The `uploadedChunks` returned by initialization are the zero-based indexes already persisted successfully; the client uploads only the missing indexes. Chunk storage needs a unique constraint on `(uploadId, chunkIndex)`, and object storage should use fixed keys with conditional writes. Resubmitting a byte-identical chunk should succeed, while a byte-length, digest, or index conflict must be rejected. The backend should let the completion endpoint succeed only after every index is present and the file passes verification.

## Completion, failure, and cleanup

Overall upload completion is decided by the atomic result of the server's `completeUrl`, not by the browser finishing every `PUT`. `completeUrl` must be idempotent and use a per-`uploadId` merge lock or a conditional state update so that exactly one request performs the merge:

1. Inside a transaction, confirm the session is `uploading` and atomically switch it to `merging`; when it is already `ready`, return the existing result, and when it is already `merging`, return `processing`.
2. Verify that every index in `0..totalChunks-1` exists, check each chunk's byte length (except the last one) and any optional chunk digest; return `409` with the stable business code `MISSING_CHUNKS` when chunks are missing.
3. Merge in index order into a temporary object, recompute the full SHA-256, and compare it with `FileMeta.sha256`; return a non-retriable `422 HASH_MISMATCH` on mismatch.
4. Atomically publish the final object, mark the content `ready`, and create or confirm the current caller's business file reference; only then return `UploadSuccessResult`.

Recommended error handling: `408`, `429`, `5xx`, and network failures are retriable; `401`, `403`, `400`, chunk-metadata conflicts, and hash mismatches must not be retried blindly. Before retrying, the client should call `initUrl` again to cover the case where chunks were persisted but the response was lost. On a failed merge, keep the recoverable chunks and record the error code, reason, `uploadId`, content fingerprint, chunk index, and retry count; sessions use a lease or last-active time, and temporary data is cleaned up asynchronously only after every caller's lease has been released and the session has expired.

#### `UploadSuccessResult`: upload, instant-check hit, and merge result

```json
{
  "status": "success",
  "fileId": "file_123",
  "name": "invoice.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "url": "https://cdn.example.com/files/file_123",
  "thumbnailUrl": "https://cdn.example.com/files/file_123/thumb"
}
```

Every field is optional, but a production endpoint should return at least `fileId`; `name`, `size`, `mimeType`, `url`, and `thumbnailUrl` are written into the client file row. When `status` is absent or `success` the component reports upload success; when it is `processing` the component keeps a "server is processing" state until the host refreshes the query result.

## Download and server-side archives

### Single-file download

`GET downloadUrl`, where the `{fileId}` template is replaced by the persistent file ID. The request has no JSON body and a successful response must be the file binary. The built-in adapter reads it as a Blob and resolves the save name in this order:

1. `Content-Disposition: attachment; filename*=UTF-8''...`
2. `Content-Disposition: attachment; filename="..."`
3. The `name` from the file list

Recommended response:

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename*=UTF-8''invoice.pdf

<binary bytes>
```

Do not return JSON Base64 or `{ url }` from this endpoint. When a download requires exchanging a short-lived signed URL first, implement a custom `DownloadTransport.downloadFile` and return `{ url, fileName? }`.

### Bulk archive tasks

Bulk downloads are packaged asynchronously by the backend. The archive endpoints are:

| Operation | HTTP request | Body | Success response |
| --- | --- | --- | --- |
| Create task | `POST archive.createUrl` | `ArchiveCreateInput` JSON | `ArchiveTask` |
| Query task | `GET archive.taskUrl` | No body | `ArchiveTask` |
| Cancel task | `DELETE archive.cancelUrl` | No body | May be empty |

"Download selected" and "Download all" submit only the persisted file ID list by default:

```json
{ "fileIds": ["file_123", "file_456"] }
```

With `all-download-scope` set, the component switches to a server-query scope instead of passing a long list of file IDs:

```json
{
  "scope": {
    "type": "server-query",
    "queryKey": "order-attachments",
    "query": { "orderId": "order-1001", "includeArchived": false }
  }
}
```

The other explicit scope is `{ "type": "file-ids", "fileIds": ["file_123"] }`. `DownloadTransport.createArchive` also accepts an optional `archiveName`, but the component does not set that field today; supply it in a custom adapter or on the server when the archive name must be fixed. The server should accept only files the caller may access; never trust the submitted IDs alone.

An `ArchiveTask` response looks like this, where `status` may only be `pending`, `processing`, `success`, `failed`, or `canceled`:

```json
{
  "taskId": "archive_123",
  "status": "processing",
  "progress": 45,
  "fileName": "order-1001-attachments.zip"
}
```

A successful polling response must include `downloadUrl`:

```json
{
  "taskId": "archive_123",
  "status": "success",
  "progress": 100,
  "fileName": "order-1001-attachments.zip",
  "downloadUrl": "https://storage.example.com/signed/archive_123"
}
```

A failed task should provide a displayable `errorMessage`. The client polls only while the status is `pending` or `processing`; `success` starts the download from `downloadUrl`, and every other terminal state ends the flow.

## File queries

With `createHttpFileQueryTransport({ queryUrl })` configured, the component uses `POST queryUrl`. It queries on first mount, on a deep `extra` change, on pagination, after a successful upload, and when re-reading the list after a successful deletion; a new request cancels the previous one, so the backend should handle client disconnects.

### Query request

```json
{
  "query": {
    "belongId": "order-1001",
    "belongType": "order",
    "extra": {
      "keyword": "invoice",
      "status": "success"
    }
  },
  "pagination": {
    "enabled": true,
    "currentPage": 1,
    "pageSize": 20
  }
}
```

`query` is built exactly like the upload `data`: the `data` prop is the base, and `belongId`, `belongType`, and `extra` override same-named fields. `pagination.enabled` is always present:

| Mode | Request pagination | Response pagination |
| --- | --- | --- |
| Not paginated | `{ "enabled": false }` | `{ "enabled": false }` |
| Paginated | `{ "enabled": true, "currentPage": 1, "pageSize": 20 }` | `{ "enabled": true, "currentPage": 1, "pageSize": 20, "total": 42 }` |

In a paginated response, `currentPage` and `pageSize` should be the values the server actually used (for example after correcting an out-of-range page), and `total` is the total number of records matching the current `query`.

### Query response and file items

A complete paginated response:

```json
{
  "files": [
    {
      "fileId": "file_123",
      "name": "invoice.pdf",
      "size": 1048576,
      "type": "application/pdf",
      "status": "success",
      "percent": 100,
      "url": "https://cdn.example.com/files/file_123",
      "thumbnailUrl": "https://cdn.example.com/files/file_123/thumb"
    }
  ],
  "pagination": {
    "enabled": true,
    "currentPage": 1,
    "pageSize": 20,
    "total": 42
  }
}
```

`files` must be an array, and the response `pagination.enabled` must match the request. Each item maps to `UploadUserFile`: the only hard requirement is `name`, but to make files deletable and downloadable the backend should return at least `fileId`, `name`, `size`, `type`, `status: "success"`, and `percent: 100`. Records loaded from the server must not return the browser-only `file` field (the built-in adapter rejects records that carry it); `uid` is optional because the component fills in a local one.

## Error and idempotency recommendations

- For normal upload, chunks, completion, and archive creation, implement idempotency through `fileId`, `uploadId + chunkIndex`, and `taskId` so a network retry never produces duplicate objects or chunks.
- Make `DELETE deleteUrl`, `DELETE multipart.cancelUrl`, and `DELETE archive.cancelUrl` idempotent: returning `204` or a success status when the resource is already gone keeps a client retry from turning into an error.
- For non-`2xx` responses the component preserves the HTTP status and classifies `408`, `429`, and `5xx` as retriable; a business error that must not be retried should return a suitable `4xx`. Custom adapters may throw `{ code, message, retriable, status?, cause? }` for more precise error semantics.
- The JSON shape of `403`, `404`, `409`, `413`, and similar errors is up to the business; the built-in adapters do not parse their bodies. Correlate `fileId`, `uploadId`, and `taskId` in logs, and never log file binaries or sensitive authentication material.

The frontend configuration for the related APIs is documented in [upload transport](/en/api/transport), [download transport](/en/api/download-transport), and [file query transport](/en/api/query-transport).
