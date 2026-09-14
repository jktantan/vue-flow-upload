# AvatarUpload

`AvatarUpload` is a single-avatar component. It crops an image to 1:1 and uploads a 512 × 512 result. Only the first `v-model` entry is rendered; a circle is a visual mask only.

| Prop            | Type                   | Default     | Description                                                           |
| --------------- | ---------------------- | ----------- | --------------------------------------------------------------------- |
| `v-model`       | `UploadUserFile[]`     | —           | Single-entry avatar list.                                             |
| `belong-id`     | `string \| number`     | required    | Business owner ID.                                                    |
| `belong-type`   | `string`               | `default`   | Business owner type.                                                  |
| `action`        | `string`               | —           | Built-in endpoint for the initial upload.                             |
| `update-action` | `string`               | —           | PUT endpoint for replacement; supports `{fileId}`.                    |
| `delete-action` | `string`               | —           | Built-in deletion endpoint.                                           |
| `transport`     | `UploadTransport`      | —           | Custom upload/delete transport.                                       |
| `read-only`     | `boolean`              | `false`     | Blocks selection, replacement, and deletion while preserving preview. |
| `shape`         | `'square' \| 'circle'` | `'square'`  | Card and cropper outline.                                             |
| `locale`        | `string`               | host locale | Language for component-owned action copy.                             |

The initial upload uses `action` or `transport.uploadFile`. A replacement uses `update-action` and sends `file` plus `fileId`. `belong-id`, `belong-type`, and `extra` are included in the JSON business payload.
