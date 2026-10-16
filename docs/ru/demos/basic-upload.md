# Базовая загрузка

Ниже минимальный интерактивный пример с перетаскиванием, ограничением типов и максимальным количеством. После выбора файлов отображаются реальная очередь, прогресс и состояния результата.

<script setup lang="ts">
import UploadDemo from '../../.vitepress/theme/components/UploadDemo.vue'
</script>

<UploadDemo />

```vue
<FlowUpload v-model="files" :transport="transport" accept="image/*,.pdf,.zip" :max-count="3" drag />
```
