# Manual upload

With automatic upload off, files enter a pending list. The host can call `submit()` after form validation succeeds.

<script setup lang="ts">
import UploadDemo from '../../.vitepress/theme/components/UploadDemo.vue'
</script>

<UploadDemo manual />

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload } from 'vue-flow-upload'

const uploader = ref<{ submit: () => Promise<void> }>()

function submitFiles(): void {
  void uploader.value?.submit()
}
</script>

<template>
  <FlowUpload
    ref="uploader"
    v-model="files"
    belong-id="order-1"
    :auto-upload="false"
    :transport="transport"
  />
  <button type="button" @click="submitFiles">Start upload</button>
</template>
```
