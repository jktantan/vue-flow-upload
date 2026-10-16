# 完整上传

下面这个示例把常用参数都做成了控件：改动任意一项，组件会立刻按新的 props 重新渲染，可以组合出列表与照片墙、逐项权限、拖拽开关、选择限制、主题与语言等各种状态。

上传、下载与打包都在浏览器内模拟，不会发送真实请求。

<script setup lang="ts">
import FlowUploadDemo from '../.vitepress/theme/components/FlowUploadDemo.vue'
</script>

<FlowUploadDemo />

## 控件与 props 的对应关系

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

示例里没有覆盖的能力，需要相应的适配器才能开启：分片、续传、秒传依赖 `transport` 的分片方法，服务端分页依赖 `query-transport`。分别见[上传传输适配器](/api/transport)与[文件查询传输适配器](/api/query-transport)，也可以用[最小示例](/demos/basic-upload)和[手动上传](/demos/manual-upload)作为起点。
