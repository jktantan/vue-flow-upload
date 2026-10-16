# Ручная загрузка

При выключенной автозагрузке файлы сначала попадают в список ожидания; хост может вызвать `submit()` экземпляра после успешной проверки формы.

<script setup lang="ts">
import UploadDemo from '../../.vitepress/theme/components/UploadDemo.vue'
</script>

<UploadDemo manual />

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload } from 'vue-flow-upload'

// 组件实例仅保存公开方法，便于由表单提交动作统一触发上传。
// The component instance stores only public methods so a form submit action can start uploads together.
const uploader = ref<{ submit: () => Promise<void> }>()

// 启动当前队列中所有待上传文件。
// Starts every pending file in the current queue.
function submitFiles(): void {
  void uploader.value?.submit()
}
</script>

<template>
  <FlowUpload ref="uploader" v-model="files" belong-id="order-1" :auto-upload="false" :transport="transport" />
  <button type="button" @click="submitFiles">Начать загрузку</button>
</template>
```
