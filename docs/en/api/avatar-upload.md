# AvatarUpload

`AvatarUpload` is a single-avatar component. It crops an image to 1:1 and uploads a 512 × 512 result. Only the first `v-model` entry is rendered; a circle is a visual mask only.

| Prop              | Type                                    | Default      | Description                                                           |
| ----------------- | --------------------------------------- | ------------ | --------------------------------------------------------------------- |
| `v-model`         | `UploadUserFile[]`                      | —            | Single-entry avatar list.                                             |
| `belong-id`       | `string \| number`                      | required     | Business owner ID.                                                    |
| `belong-type`     | `string`                                | `default`    | Business owner type.                                                  |
| `action`          | `string`                                | —            | Built-in endpoint for the initial upload.                             |
| `update-action`   | `string`                                | —            | PUT endpoint for replacement; supports `{fileId}`.                    |
| `delete-action`   | `string`                                | —            | Built-in deletion endpoint.                                           |
| `transport`       | `UploadTransport`                       | —            | Custom upload/delete transport.                                       |
| `accept`          | `string \| string[]`                    | —            | Accepted source-image extensions or MIME types.                       |
| `max-size`        | `number`                                | —            | Maximum source-image size in bytes.                                   |
| `width`, `height` | `string \| number`                      | `300`, `300` | Avatar-card dimensions; numeric values are pixels.                    |
| `disabled`        | `boolean`                               | `false`      | Disables every interaction.                                           |
| `read-only`       | `boolean`                               | `false`      | Blocks selection, replacement, and deletion while preserving preview. |
| `shape`           | `'square' \| 'circle'`                  | `'square'`   | Card and cropper outline.                                             |
| `preview`         | `boolean`                               | `true`       | Allows previewing the current avatar.                                 |
| `permissions`     | `UploadPermissions`                     | `{}`         | Per-action restrictions for selection, removal, and preview.          |
| `before-upload`   | `(file) => boolean \| Promise<boolean>` | —            | Rejects a source image before the cropper opens.                      |
| `locale`          | `string`                                | host locale  | Language for component-owned action copy.                             |

The initial upload uses `action` or `transport.uploadFile`. A replacement uses `update-action` and sends `file` plus `fileId`; the first successful response must include `fileId` for a later replacement URL to be created. `belong-id`, `belong-type`, and `extra` are included in the JSON business payload for both initial and replacement requests.

It emits `update:modelValue`, `change`, `success`, `error`, and `remove`. In read-only mode, preview remains available when both `preview` and the preview permission allow it.
