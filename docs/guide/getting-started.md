# 快速开始

安装组件：

```bash
pnpm add vue-flow-upload
```

在应用入口引入样式并安装插件。认证、基础地址等内置请求配置只需在这里设置一次。

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { vueFlowUpload } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

createApp(App).use(vueFlowUpload, { baseUrl: '/api' }).mount('#app')
```

然后使用 `FlowUpload`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'

// 受控文件列表；上传组件通过 update:modelValue 写回完整状态。
// Controlled file list; the upload component writes the complete state back through update:modelValue.
const files = ref<UploadFileItem[]>([])
</script>

<template>
  <FlowUpload
    v-model="files"
    action="/files"
    accept="image/*,.pdf"
    :max-size="20 * 1024 * 1024"
    drag
  >
    <template #tip>支持图片和 PDF，单个文件不超过 20 MB</template>
  </FlowUpload>
</template>
```

`action` 适合一个标准的 `multipart/form-data` 上传接口。需要分片、秒传、续传或响应转换时，改用 [`transport` 配置](/api/transport)。
