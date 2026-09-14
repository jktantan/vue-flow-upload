# Basic upload

This minimal interactive example enables drag and drop, type restrictions, and a maximum count. It shows the actual queue, progress, and result states.

<script setup lang="ts">
import UploadDemo from '../../.vitepress/theme/components/UploadDemo.vue'
</script>

<UploadDemo />

```vue
<FlowUpload v-model="files" :transport="transport" accept="image/*,.pdf,.zip" :max-count="3" drag />
```
