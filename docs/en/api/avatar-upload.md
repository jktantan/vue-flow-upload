# AvatarUpload

`AvatarUpload` is a single-avatar component: it crops a selected image to 1:1 and uploads a 512 × 512 result. Only the first `v-model` entry is rendered. A circle is a visual mask for the card and crop box only, and the file sent to the server always stays square.

| Prop               | Type                                    | Default      | Description                                                                                          |
| ------------------ | --------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `v-model`          | `UploadUserFile[]`                      | —            | Single-entry avatar list; only the first item is rendered.                                            |
| `belong-id`        | `string \| number`                      | required     | Business record id, written to the upload request's JSON `data.belongId`.                              |
| `belong-type`      | `string`                                | `default`    | Business record type, written to the JSON `data.belongType`.                                           |
| `extra`            | `Record<string, unknown>`               | —            | Extension attributes written to the JSON `data.extra`.                                                 |
| `action`           | `string`                                | —            | Built-in endpoint for the initial upload.                                                              |
| `update-action`    | `string`                                | —            | PUT endpoint for replacing an existing avatar; supports the `{fileId}` placeholder.                    |
| `delete-action`    | `string`                                | —            | Built-in endpoint that deletes an existing avatar.                                                     |
| `transport`        | `UploadTransport`                       | —            | Custom upload and delete transport.                                                                   |
| `data`             | `UploadData`                            | —            | Business data sent with every upload; may be an async factory.                                         |
| `accept`           | `string \| string[]`                    | —            | Accepted source-image extensions or MIME types.                                                        |
| `max-size`         | `number`                                | —            | Maximum source-image size in bytes.                                                                   |
| `width` / `height` | `string \| number`                      | `300`        | Avatar-card dimensions; numeric values are pixels.                                                     |
| `disabled`         | `boolean`                               | `false`      | Disables every interaction.                                                                            |
| `read-only`        | `boolean`                               | `false`      | Blocks selection, replacement, and deletion while preserving preview when `preview` allows it.          |
| `shape`            | `'square' \| 'circle'`                  | `'square'`   | Visual outline of the card and crop box; use equal width and height for a circle.                       |
| `preview`          | `boolean`                               | `true`       | Allows previewing the current avatar.                                                                  |
| `permissions`      | `UploadPermissions`                     | `{}`         | Per-operation restrictions for selection, removal, and preview; omitted operations stay allowed.        |
| `before-upload`    | `(file) => boolean \| Promise<boolean>` | —            | Runs after client validation and before the cropper opens; `false` or a rejection aborts.               |
| `locale`           | `string`                                | host locale  | Language for component-owned copy.                                                                     |

The initial upload uses `action` or `transport.uploadFile`. When an avatar already exists and `update-action` is configured, the component sends a `PUT` with the multipart fields `file` and `fileId`; the first successful response must return `fileId`.

`belong-id` is required and `belong-type` defaults to `default`. Both, together with `extra`, are merged into the multipart JSON `data` field and describe the owning business record, its type, and extension attributes; the `update-action` request carries the same field.

Read-only display is available through `read-only`. It locks selection, replacement, and deletion but never closes preview:

```vue
<AvatarUpload v-model="avatarFiles" belong-id="profile-1" read-only shape="circle" />
```

## Events

| Event               | Payload            | When it fires                                                                          |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `update:modelValue` | `(files)`          | The controlled list changed; carries the full normalized list.                          |
| `change`            | `(file, files)`    | After a local avatar change, carries the changed record and the complete list.           |
| `success`           | `(file, response)` | After the server confirms the upload, carries the record and the response.               |
| `error`             | `(file, error)`    | The upload failed; `file` is the cropped `File` and `error` is an `Error` instance.      |
| `remove`            | `(file)`           | After a successful avatar deletion, carries the removed record.                          |

Try the [avatar upload demo](/en/demos/avatar-upload).
