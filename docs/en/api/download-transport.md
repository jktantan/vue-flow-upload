# Download transport

`DownloadTransport` is independent of upload transport. It downloads a persisted file and manages server-side archive jobs.

| Method           | Responsibility                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `downloadFile`   | Return a `DownloadResource` containing a `blob` or direct `url`. |
| `createArchive`  | Create an archive task and return `{ taskId, status }`.          |
| `getArchiveTask` | Return latest task state; successful tasks need `downloadUrl`.   |
| `cancelArchive`  | Optionally cancel an unfinished server task.                     |

`createHttpDownloadTransport` maps these operations to `downloadUrl`, `archive.createUrl`, `archive.taskUrl`, and optional `archive.cancelUrl`. Custom implementations should preserve error code, retryability, HTTP status, and original cause.
