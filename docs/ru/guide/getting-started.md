# Быстрый старт

Установите пакет:

```bash
pnpm add vue-flow-upload
```

Подключите стили и установите плагин в точке входа приложения. Аутентификация, базовый адрес и прочие настройки встроенных запросов задаются здесь один раз.

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { vueFlowUpload } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

createApp(App).use(vueFlowUpload, { baseUrl: '/api' }).mount('#app')
```

Затем используйте `FlowUpload`:

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
    belong-id="order-1"
    action="/files"
    accept="image/*,.pdf"
    :max-size="20 * 1024 * 1024"
    drag
  >
    <template #tip>Изображения и PDF, не более 20 МБ на файл</template>
  </FlowUpload>
</template>
```

`action` подходит для стандартного интерфейса загрузки `multipart/form-data`: внутри он создаёт `transport` на основе XHR, а не второй механизм загрузки. Для частей, мгновенной загрузки, докачки, преобразования ответа или обёртки запросов проекта используйте [`transport`](/ru/api/transport). Аутентификация, префикс адреса, общие заголовки, значения по умолчанию очереди и подключение Nuxt описаны в разделе [Глобальная конфигурация и Nuxt](/ru/guide/global-config).
