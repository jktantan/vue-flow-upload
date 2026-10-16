# Full-featured upload

This demo turns the common parameters into controls: change any of them and the component re-renders with the new props, so you can combine list and picture walls, per-operation permissions, the drop zone, selection limits, themes, and languages.

Uploads, downloads, and archives are simulated in the browser; no request leaves the page.

<script setup lang="ts">
import FlowUploadDemo from '../../.vitepress/theme/components/FlowUploadDemo.vue'
</script>

<FlowUploadDemo />

## How the controls map to props

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'

// 受控文件列表；组件通过 update:modelValue 回写完整状态。
// Controlled file list; the component writes the complete state back through update:modelValue.
const files = ref<UploadFileItem[]>([])
// 下载与打包需要单独的适配器；缺失时 download、downloadAll 权限不会产生可见效果。
// Download and archive need their own adapter; without it the download permissions have no visible effect.
const downloadTransport = createHttpDownloadTransport({ /* ... */ })
</script>

<template>
  <!--
    权限对象只写需要关闭的项：未填写的操作默认为允许，因此这里只禁用删除与全部下载。
    Only switched-off permissions are listed: omitted operations stay allowed, so this only disables removal and download-all.
  -->
  <FlowUpload
    v-model="files"
    belong-id="order-1"
    :transport="transport"
    :download-transport="downloadTransport"
    list-type="picture"
    drag
    selectable
    :permissions="{ remove: false, downloadAll: false }"
    accept="image/*,.pdf,.zip"
    :max-size="20 * 1024 * 1024"
    :max-count="5"
    :theme="'default'"
    locale="zh-CN"
  />
</template>
```

Capabilities this demo does not cover need an adapter of their own: chunks, resume, and instant upload rely on the multipart methods of `transport`, while server-side pagination relies on `query-transport`. See [upload transport](/en/api/transport) and [file query transport](/en/api/query-transport), or start from the [basic example](/en/demos/basic-upload) and [manual upload](/en/demos/manual-upload).
