# Upload transport

`UploadTransport` is the upload protocol boundary. Use `createHttpUploadTransport` for standard HTTP endpoints, or implement it for Axios, signed object-storage uploads, or another project client.

| Option / method            | HTTP responsibility                                                 |
| -------------------------- | ------------------------------------------------------------------- |
| `url` / `uploadFile`       | Upload a normal file.                                               |
| `createUrl` / `createFile` | Create or confirm a file record and return `fileId`.                |
| `checkUrl` / `checkFile`   | Check SHA-256 instant-upload availability.                          |
| `multipart.*`              | Initialize, upload chunks, complete, or cancel a multipart session. |
| `deleteUrl` / `deleteFile` | Remove a persisted file and temporary sessions.                     |

A custom adapter must implement `uploadFile`. Pass `context.signal` to the request client and report byte progress through `context.onProgress(loaded, total)`. Add `createFile`, `checkFile`, multipart methods, and `deleteFile` only when the backend supports those operations. Throw errors shaped as `{ code, message, retriable, status?, cause? }` so the queue can handle retry and cancellation correctly.

For shared deduplicated uploads, `checkFile` returns `{ state: 'ready', file }` only when the content is complete and accessible to the caller. `{ state: 'missing' }` starts a new or resumed upload. `{ state: 'uploading' }` means another client is transferring the same content; the component calls `initMultipart` and uploads only the server-reported missing chunks. `{ state: 'merging' }` or `{ state: 'processing' }` stops chunk writes and invokes idempotent `completeMultipart`. Legacy `{ exists, file? }` responses remain supported during migration. See the [backend API contract](/en/guide/backend-api-contract) for locking, authorization, validation, and cleanup requirements.
