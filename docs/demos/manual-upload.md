# 手动上传

关闭自动上传时，文件先进入待上传列表；宿主可在表单校验通过后再调用实例 `submit()`。

<script setup lang="ts">
import UploadDemo from '../.vitepress/theme/components/UploadDemo.vue'
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
  <FlowUpload ref="uploader" v-model="files" :auto-upload="false" :transport="transport" />
  <button type="button" @click="submitFiles">开始上传</button>
</template>
```
