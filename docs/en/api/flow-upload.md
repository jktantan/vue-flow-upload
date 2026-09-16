# FlowUpload

`FlowUpload` is the multi-file component. `action` is a shortcut for the built-in XHR upload transport; a supplied `transport` takes precedence.

## Key props

| Prop                                         | Type                                  | Default                  | Description                                                               |
| -------------------------------------------- | ------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `v-model`                                    | `UploadUserFile[]`                    | —                        | Controlled file list.                                                     |
| `belong-id`                                  | `string \| number`                    | required                 | Business owner ID, sent as `query.belongId` / upload data.                |
| `belong-type`                                | `string`                              | `default`                | Business owner type.                                                      |
| `extra`                                      | `Record<string, unknown>`             | —                        | Project-specific upload metadata and query matching conditions.           |
| `action` / `transport`                       | `string` / `UploadTransport`          | —                        | Built-in endpoint shortcut or custom upload protocol.                     |
| `download-transport`                         | `DownloadTransport`                   | —                        | Direct download and archive protocol.                                     |
| `query-transport`                            | `FileQueryTransport`                  | —                        | File-list loading and pagination protocol.                                |
| `query-on-mount`                             | `boolean`                             | `true`                   | Load through the query transport after mount.                             |
| `pagination`                                 | `false \| UploadPagination`           | `false`                  | Enables pagination; query transport loads the selected page.              |
| `accept`, `max-size`, `max-count`            | —                                     | —                        | Browser file restrictions.                                                |
| `auto-upload`                                | `boolean`                             | `true`                   | Starts upload immediately after selection.                                |
| `multiple`, `drag`, `directory`              | `boolean`                             | `true`, `true`, `false`  | Allows multi-select, dropping files, or folder selection where supported. |
| `show-file-list`, `show-operation`           | `boolean`                             | `true`                   | Shows the file area and its toolbar/row actions.                          |
| `list-type`                                  | `'list' \| 'picture'`                 | `'list'`                 | Renders normal rows or a picture wall.                                    |
| `preview`, `selectable`, `loading`           | `boolean`                             | `true`, `false`, `false` | Enables image preview, batch selection, or a list loading mask.           |
| `disabled`, `permissions`                    | `boolean`, `UploadPermissions`        | `false`, `{}`            | Disables all actions or controls them individually.                       |
| `data`, `file-field-name`, `data-field-name` | `UploadData`, `string`, `string`      | —, `'file'`, `'data'`    | Business payload and multipart field names.                               |
| `create-action`, `delete-action`, `method`   | `string`, `string`, `'POST' \| 'PUT'` | —, —, `'POST'`           | Built-in transport endpoints and normal-upload HTTP method.               |

## Large-file and archive options

| Prop                                                                   | Default           | Description                                                                   |
| ---------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `normal-upload-threshold`, `chunk-size`                                | `10 MiB`, `1 MiB` | Files above the threshold use chunks of this byte size.                       |
| `chunk-concurrency`, `max-concurrent-files`, `max-concurrent-requests` | `3`, `2`, `6`     | Per-file chunk, active-file, and shared-request limits.                       |
| `retry-count`, `retry-base-delay`                                      | `3`, `500 ms`     | Additional retry attempts and initial exponential-backoff delay.              |
| `resume`, `instant-upload`                                             | `true`, `true`    | Resumes an eligible multipart session and checks SHA-256 instant upload.      |
| `archive-polling-interval`, `archive-polling-timeout`                  | `2 s`, `10 min`   | Server archive polling cadence and maximum wait time.                         |
| `all-download-scope`                                                   | —                 | Optional server-query scope for **Download all** instead of visible file IDs. |

## Events and instance methods

| Event                                           | Payload                              | When it fires                                                  |
| ----------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `update:modelValue`                             | `(files)`                            | The complete controlled list changes.                          |
| `change`                                        | `(file, files)`                      | A file's state or metadata changes.                            |
| `progress`                                      | `(file, percent)`                    | Hashing or transfer progress changes; percent is 0–100.        |
| `success` / `error`                             | `(file, response)` / `(file, error)` | The server confirms upload or client validation/upload fails.  |
| `remove` / `exceed`                             | `(file)` / `(files)`                 | A file is removed, or a selection exceeds `max-count`.         |
| `download-*`, `archive-*`                       | See `DownloadTransport`              | Single-download and server-archive lifecycle events.           |
| `query-loading`, `query-success`, `query-error` | `(boolean)`, `(result)`, `(error)`   | File-query lifecycle; cancelled requests do not emit an error. |
| `update:pagination`, `pagination-change`        | `(value)`, `(currentPage, pageSize)` | Controlled pagination changes.                                 |

The component instance exposes `submit()`, `abort()`, `retry()`, `pause()`, `resume()`, `remove()`, `clear()`, `download()`, `downloadAll()`, and `refreshQuery()`.

`hashStrategy` on an `UploadFileItem` records the client implementation that completed SHA-256 (`web-crypto`, `wasm`, or `local`). It is diagnostic only and never changes the digest or server protocol.
