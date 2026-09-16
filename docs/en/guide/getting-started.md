# Quick start

Install the package:

```bash
pnpm add vue-flow-upload
```

Import its style and install the plugin once at application startup. Configure authentication and the API base URL here.

```ts
import { createApp } from 'vue'
import App from './App.vue'
import { vueFlowUpload } from 'vue-flow-upload'
import 'vue-flow-upload/style.css'

createApp(App).use(vueFlowUpload, { baseUrl: '/api' }).mount('#app')
```

Then render `FlowUpload`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'

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
    <template #tip>Images and PDFs, up to 20 MB each</template>
  </FlowUpload>
</template>
```

`action` is the shortcut for the built-in XHR upload transport. Use a custom [upload transport](/en/api/transport) for chunks, instant upload, response conversion, or an existing project request client. See [global configuration and Nuxt](/en/guide/global-config) for authentication, base URLs, shared request metadata, queue defaults, and Nuxt setup.
