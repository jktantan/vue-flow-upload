# Common usage

## Controlled file list

With `v-model`, the host list is the source of truth. The component emits `update:modelValue` rather than mutating a prop.

```vue
<FlowUpload v-model="files" belong-id="order-1" action="/files" />
```

## Restrict type, size, and count

```vue
<FlowUpload
  v-model="files"
  belong-id="order-1"
  action="/files"
  accept="image/*,.pdf"
  :max-size="20 * 1024 * 1024"
  :max-count="5"
  drag
/>
```

`accept` guides the browser picker only. The server must still validate file type and size.

## Manual upload

Set `auto-upload="false"` to keep selected files pending. Call the instance `submit()` after your form passes validation; see the [manual upload demo](/en/demos/manual-upload).

## Avatars

`AvatarUpload` crops selected images to 1:1 before upload. See the [avatar demo](/en/demos/avatar-upload).
