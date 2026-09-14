# FlowUpload

`FlowUpload` is the multi-file component. `action` is a shortcut for the built-in XHR upload transport; a supplied `transport` takes precedence.

## Key props

| Prop                              | Type                         | Default   | Description                                                     |
| --------------------------------- | ---------------------------- | --------- | --------------------------------------------------------------- |
| `v-model`                         | `UploadUserFile[]`           | —         | Controlled file list.                                           |
| `belong-id`                       | `string \| number`           | required  | Business owner ID, sent as `query.belongId` / upload data.      |
| `belong-type`                     | `string`                     | `default` | Business owner type.                                            |
| `extra`                           | `Record<string, unknown>`    | —         | Project-specific upload metadata and query matching conditions. |
| `action` / `transport`            | `string` / `UploadTransport` | —         | Built-in endpoint shortcut or custom upload protocol.           |
| `download-transport`              | `DownloadTransport`          | —         | Direct download and archive protocol.                           |
| `query-transport`                 | `FileQueryTransport`         | —         | File-list loading and pagination protocol.                      |
| `query-on-mount`                  | `boolean`                    | `true`    | Load through the query transport after mount.                   |
| `pagination`                      | `false \| UploadPagination`  | `false`   | Enables pagination; query transport loads the selected page.    |
| `accept`, `max-size`, `max-count` | —                            | —         | Browser file restrictions.                                      |
| `auto-upload`                     | `boolean`                    | `true`    | Starts upload immediately after selection.                      |

## Events and instance methods

Core events are `update:modelValue`, `change`, `progress`, `success`, `error`, `remove`, and `exceed`. Download/archiving emit `download-*` and `archive-*`; querying emits `query-loading`, `query-success`, and `query-error`.

The component instance exposes `submit()`, `abort()`, `retry()`, `pause()`, `resume()`, `remove()`, `clear()`, `download()`, `downloadAll()`, and `refreshQuery()`.
