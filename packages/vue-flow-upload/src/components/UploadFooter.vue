<script setup lang="ts">
defineProps<{
  visible: boolean
  count: number
  t: (key: string, values?: Record<string, string | number>) => string
}>()
</script>

<template>
  <div v-if="visible" class="vfu-upload__footer">
    <footer class="vfu-list-footer">
      {{ t('fileCount', { count }) }}
      <slot />
    </footer>
  </div>
</template>
