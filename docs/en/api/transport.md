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
