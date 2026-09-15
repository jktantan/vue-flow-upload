<script setup lang="ts">
/** 文件视觉区域上的操作遮罩插槽；显示时机与具体业务操作均由父组件决定。 Action-mask slot over a file visual; the parent owns visibility timing and concrete business actions. */
defineSlots<{ default(): unknown }>()
</script>

<template>
  <div class="vfu-action-mask"><slot /></div>
</template>
