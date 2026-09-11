# 基础上传

下面是启用拖拽、类型限制与最大数量的最小交互示例。选择文件后会显示真实的队列、进度和结果状态。

<script setup lang="ts">
import UploadDemo from '../.vitepress/theme/components/UploadDemo.vue'
</script>

<UploadDemo />

```vue
<FlowUpload v-model="files" :transport="transport" accept="image/*,.pdf,.zip" :max-count="3" drag />
```
