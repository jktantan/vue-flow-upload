# FlowUpload

`FlowUpload` uploads multiple files. `action` is the shortcut for the built-in XHR `transport`'s normal upload; supplying `transport` puts the host fully in charge of the request protocol and takes precedence over `action`.

## Key props

| Prop                 | Type                                               | Default          | Description                                                                                                                                                        |
| -------------------- | -------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `v-model`            | `UploadUserFile[]`                                 | —                | Controlled file list; the external source of truth.                                                                                                                |
| `default-file-list`  | `UploadUserFile[]`                                 | `[]`             | Initial file list for uncontrolled mode.                                                                                                                           |
| `belong-id`          | `string \| number`                                 | required         | Business record id, written to the upload request's JSON `data.belongId`.                                                                                          |
| `belong-type`        | `string`                                           | `default`        | Business record type, written to the JSON `data.belongType`.                                                                                                       |
| `extra`              | `Record<string, unknown>`                          | —                | Extension attributes written to the JSON `data.extra`; query-transport uses them for project-specific matching, and a deep change reloads from the first page.       |
| `action`             | `string`                                           | —                | Shortcut URL for the built-in XHR `transport`'s normal upload.                                                                                                     |
| `create-action`      | `string`                                           | —                | Endpoint that creates or confirms the server file record before upload and returns `fileId`.                                                                       |
| `delete-action`      | `string`                                           | —                | Endpoint that idempotently deletes a file and its upload sessions by `fileId`.                                                                                     |
| `method`             | `'POST' \| 'PUT'`                                  | `'POST'`         | HTTP method used by the built-in normal upload.                                                                                                                     |
| `transport`          | `UploadTransport`                                  | —                | Upload protocol adapter; any HTTP client or direct-upload SDK works.                                                                                               |
| `download-transport` | `DownloadTransport`                                | —                | Adapter for single-file downloads and server-side archive tasks.                                                                                                    |
| `query-transport`    | `FileQueryTransport`                               | —                | File-list query adapter; once supplied, the component loads, filters, and paginates on its own.                                                                    |
| `query-on-mount`     | `boolean`                                          | `true`           | Whether to load the file list through the query adapter on mount.                                                                                                  |
| `data`               | `UploadData`                                       | —                | Business data sent with every upload; may be an async factory. `belong-id`, `belong-type`, and `extra` override same-named fields.                                  |
| `file-field-name`    | `string`                                           | `'file'`         | Multipart field name for the binary file.                                                                                                                          |
| `data-field-name`    | `string`                                           | `'data'`         | Multipart field name for the JSON business data.                                                                                                                   |
| `accept`             | `string \| string[]`                               | —                | Extension or MIME-type filter.                                                                                                                                     |
| `max-size`           | `number`                                           | —                | Maximum size in bytes for one file.                                                                                                                                |
| `max-count`          | `number`                                           | unlimited        | Maximum number of files kept in the list; rejected extras arrive through the `exceed` event.                                                                        |
| `multiple`           | `boolean`                                          | `true`           | Whether multiple selection is allowed.                                                                                                                             |
| `auto-upload`        | `boolean`                                          | `true`           | Whether uploads start right after selection; when off, the instance method `submit()` starts the queue.                                                             |
| `before-upload`      | `(file) => boolean \| Promise<boolean>`            | —                | Called after client validation and before queuing; `false` or a rejection rejects the file.                                                                         |
| `before-remove`      | `(file, files) => boolean \| Promise<boolean>`     | —                | Called before removal; `false` or a rejection keeps the file.                                                                                                       |

## Large-file props

| Prop                      | Unit   | Default  | Description                                              |
| ------------------------- | ------ | -------- | -------------------------------------------------------- |
| `normal-upload-threshold` | bytes  | `10 MiB` | Files above this size use the multipart workflow.        |
| `chunk-size`              | bytes  | `1 MiB`  | Byte size of one chunk.                                  |
| `chunk-concurrency`       | count  | `3`      | Chunks uploaded concurrently for one file.               |
| `max-concurrent-files`    | count  | `2`      | Files uploading at the same time.                        |
| `max-concurrent-requests` | count  | `6`      | Maximum requests shared by all files.                    |
| `retry-count`             | times  | `3`      | Additional attempts for a retryable error.               |
| `retry-base-delay`        | ms     | `500`    | Initial exponential-backoff delay.                       |
| `resume`                  | —      | `true`   | Whether to resume an unexpired multipart session.        |
| `instant-upload`          | —      | `true`   | Whether to compute SHA-256 and check instant upload.     |

## Display and interaction props

| Prop                       | Type                             | Default     | Description                                                                                                     |
| -------------------------- | -------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `list-type`                | `'list' \| 'picture'`            | `'list'`    | File-list layout; `picture` renders a picture wall.                                                             |
| `show-file-list`           | `boolean`                        | `true`      | Whether to render the file list or picture wall.                                                                |
| `show-operation`           | `boolean`                        | `true`      | Whether to render the toolbar and row actions.                                                                  |
| `drag`                     | `boolean`                        | `true`      | Whether dropping files is allowed.                                                                              |
| `directory`                | `boolean`                        | `false`     | Whether folder selection is allowed where the browser supports it.                                              |
| `preview`                  | `boolean`                        | `true`      | Whether image preview is allowed.                                                                               |
| `selectable`               | `boolean`                        | `false`     | Whether batch-selection controls are shown; only `success` rows with a `fileId` can be selected.                 |
| `loading`                  | `boolean`                        | `false`     | Shows a loading mask over the list or picture wall; it also turns on automatically during a query-adapter request. |
| `pagination`               | `false \| UploadPagination`      | not set     | Controlled pagination; `false` or omitted hides the paginator and leaves page loading to the host.               |
| `disabled`                 | `boolean`                        | `false`     | Disables every interaction.                                                                                     |
| `permissions`              | `UploadPermissions`              | `{}`        | Per-operation control over selection, upload, removal, retry, preview, download, and download-all; omitted operations stay allowed. |
| `width`                    | `string \| number`               | `'auto'`    | CSS width; numbers are treated as pixels.                                                                       |
| `height`                   | `string \| number`               | `'600px'`   | CSS height; `'auto'` fills a parent that has an explicit height.                                                |
| `on-preview`               | `(file) => void \| Promise<void>` | —          | Custom preview handler; replaces the built-in image viewer when provided.                                        |
| `theme`                    | `UploadTheme`                    | `'default'` | Built-in theme name (`default`, `element-plus`, `ant-design-vue`) or a custom theme adapter.                     |
| `archive-polling-interval` | `number` (ms)                    | `2000`      | Polling interval for a server archive task.                                                                     |
| `archive-polling-timeout`  | `number` (ms)                    | `600000`    | Maximum wait time for a server archive task.                                                                    |
| `all-download-scope`       | `DownloadScope`                  | —           | File range or server-query scope submitted for "download all"; without it the persisted files of the current list are used. |

## Internationalization props

| Prop       | Type                      | Default  | Description                                                                                |
| ---------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `i18n`     | `FlowUploadI18nOptions`   | —        | Recommended i18n configuration; messages use the `VueFlowUpload` namespace.                 |
| `locale`   | `string`                  | `'zh-CN'` | Deprecated, use `i18n.locale` instead.                                                      |
| `messages` | `Partial<UploadMessages>` | —        | Deprecated, use `i18n.messages[locale].VueFlowUpload` instead.                              |

## Events

| Event                                     | Payload                                  | When it fires                                                                                |
| ----------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `update:modelValue`                       | `(files)`                                | The file list changed.                                                                       |
| `change`                                  | `(file, files)`                          | A file was added, or its state or metadata changed.                                          |
| `progress`                                | `(file, percent)`                        | Transfer or hashing progress changed; percent ranges from 0 to 100.                           |
| `success`                                 | `(file, response)`                       | The server confirmed success.                                                                |
| `error`                                   | `(file, error)`                          | Client validation or upload failed; also emitted when a single-file download fails.           |
| `remove`                                  | `(file)`                                 | A file was removed successfully.                                                             |
| `exceed`                                  | `(files)`                                | The current selection exceeded `max-count`.                                                   |
| `download-start` / `download-success`     | `(file)`                                 | A single-file download started or succeeded.                                                  |
| `download-error`                          | `(file, error)`                          | A single-file download failed.                                                               |
| `archive-start`                           | `(taskId, fileIds)`                      | A server archive task was created.                                                            |
| `archive-progress`                        | `(taskId, percent?)`                     | Archive polling reported progress; `percent` is undefined when the server sends none.          |
| `archive-success`                         | `(taskId)`                               | The archive is ready and its download started.                                                |
| `archive-error`                           | `(taskId, error)`                        | Archive creation or polling failed; `taskId` is an empty string when creation failed.          |
| `query-loading`                           | `(isLoading)`                            | The query adapter's loading state changed.                                                    |
| `query-success`                           | `(result)`                               | The file query succeeded and wrote the list.                                                  |
| `query-error`                             | `(error)`                                | The file query failed, except for cancelled requests.                                         |
| `update:pagination`                       | `(value)`                                | The controlled pagination value changed.                                                      |
| `pagination-change`                       | `(currentPage, pageSize)`                | The user changed the page; with a query transport configured, the component then loads that page. |

## File-state diagnostic field

When a file needs a SHA-256 digest, `hashStrategy` on the matching `UploadFileItem` in `v-model` records which implementation completed the digest: `web-crypto` (native browser API), `wasm` (`hash-wasm`), or `local` (local TypeScript fallback). The field is diagnostic only and never changes the digest or the server protocol.

## Slots and instance methods

`#tip` renders below the selection area; `#file` fully replaces one file row and receives the slot props `file`, `remove`, `preview`, `download`, `pause`, `resume`, and `retry`.

The component instance exposes:

| Method                       | Description                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `submit()`                   | Starts uploads for every file in the `idle` state.                                |
| `abort(file?)`               | Pauses one file, or every file when called without an argument.                    |
| `pause(uid)` / `resume(uid)` | Pauses or resumes the given file.                                                  |
| `retry(uid)`                 | Uploads the given file again.                                                      |
| `remove(uid \| file)`        | Removes the given file, asking for confirmation when needed; returns whether it was removed. |
| `clear()` / `clearFiles()`   | Clears the file list and releases the related resources.                            |
| `handleStart(file)`          | Runs one `File` through the full select, validate, and queue path.                  |
| `handleRemove(uid \| file)`  | Convenience wrapper around `remove` that also accepts a full file item.             |
| `download(uid)`              | Downloads one persisted file.                                                      |
| `downloadSelected(uids)`     | Creates a server archive task for the given files and downloads it.                 |
| `downloadAll()`              | Downloads every file per `all-download-scope` or the current list.                  |
| `cancelArchive(taskId)`      | Cancels an unfinished archive task.                                                |
| `refreshQuery()`             | Re-queries the server file list immediately for the current `extra` and pagination. |

See the [manual upload demo](/en/demos/manual-upload) for a complete manual-call example.
