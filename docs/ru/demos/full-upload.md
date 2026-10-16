# Полная загрузка

Этот пример превращает основные параметры в элементы управления: измените любой из них, и компонент сразу перерисуется с новыми props — так можно комбинировать список и галерею, пооперационные права, перетаскивание, ограничения выбора, темы и языки.

Загрузка, скачивание и упаковка имитируются в браузере, реальные запросы никуда не отправляются.

<script setup lang="ts">
import FlowUploadDemo from '../../.vitepress/theme/components/FlowUploadDemo.vue'
</script>

<FlowUploadDemo />

## Как элементы управления соответствуют props

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

Возможности, не охваченные этим примером, требуют собственного адаптера: части, докачка и мгновенная загрузка опираются на методы частей в `transport`, а серверная пагинация — на `query-transport`. См. [Адаптер загрузки](/ru/api/transport) и [Адаптер запроса файлов](/ru/api/query-transport), либо возьмите за основу [минимальный пример](/ru/demos/basic-upload) и [ручную загрузку](/ru/demos/manual-upload).
