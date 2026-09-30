# Backend API contract

This page defines the protocol used by `createHttpUploadTransport` for instant, normal, and multipart uploads. All control-plane endpoints use JSON. Chunk requests send raw binary bytes with the documented `X-Upload-*` headers. A `2xx` response is successful; the server must return JSON for check, initialization, and completion.

## Content and business references

Store deduplicated content separately from user-facing business file references. A content record is identified by `sha256`, `size`, hash algorithm, and storage-policy version. A business reference records the user or tenant, business ownership, and download authorization. Never expose another tenant's `fileId`, URL, or content-existence information just because its hash matches.

## Instant and concurrent upload states

`POST checkUrl` receives `FileMeta`. Use a discriminated `state` response:

```json
{ "state": "ready", "file": { "fileId": "file_123", "status": "success" } }
```

Return `ready` only for complete content that the caller may reference. Use `{ "state": "missing" }` for absent content. When another client is uploading the same content, return:

```json
{ "state": "uploading", "uploadId": "upload_123", "uploadedChunks": [0, 1], "retryAfterMs": 1000 }
```

Use `merging` or `processing` when a different request owns finalization. `uploadId`, `uploadedChunks`, and `retryAfterMs` are optional check hints: `initUrl` remains the source of truth. The component also accepts legacy `{ "exists": false }` and `{ "exists": true, "file": ... }` responses.

The component checks instant availability before `createUrl`, preventing orphaned business records for a hit. After a miss, `createUrl` must be idempotent and create or confirm the caller's business reference at completion.

## Multipart session and chunks

`POST multipart.initUrl` must atomically get or create an active session for the content identity. Use a database uniqueness constraint or a short transaction/distributed lock; do not implement this as a separate read and insert.

```json
{
  "uploadId": "upload_123",
  "state": "uploading",
  "uploadedChunks": [0, 1]
}
```

`state` may be `uploading`, `merging`, or `processing`; omitted state means `uploading` for compatibility. The component uploads only missing zero-based indexes. Add a unique constraint on `(uploadId, chunkIndex)` and use conditional object-storage writes. A duplicate byte-identical chunk succeeds; an index, length, or digest conflict fails.

## Completion, failure, and cleanup

`POST multipart.completeUrl` is the authoritative completion decision and must be idempotent. Acquire a per-session merge lock (or atomically transition `uploading` to `merging`), then verify every expected index, each chunk length, and the full SHA-256 after ordered assembly. Publish the final object and mark content ready atomically before returning `UploadSuccessResult`.

If chunks are missing, return `409` with `MISSING_CHUNKS`. A full-hash mismatch should be non-retriable `422 HASH_MISMATCH`. A concurrent merge returns `{ "status": "processing" }` or the already-completed result. Network failures, `408`, `429`, and `5xx` may be retried; authorization, metadata conflicts, and checksum errors must not be blindly retried. Before retrying a chunk, call `initUrl` again because the previous request may have persisted bytes despite a lost response.

Cancellation releases only the caller's lease; it must not delete a shared session. Persist diagnostic data including the upload ID, content identity, chunk index, error code, retry count, and state timestamps. Remove temporary chunks asynchronously only after all leases have expired.
