<script setup lang="ts">
import { computed, ref } from 'vue'
import type { UploadFileItem } from './types'

const props = withDefaults(
  defineProps<{
    modelValue?: UploadFileItem[]
    accept?: string
    multiple?: boolean
  }>(),
  { modelValue: () => [], multiple: true },
)

const emit = defineEmits<{
  'update:modelValue': [files: UploadFileItem[]]
  change: [files: UploadFileItem[]]
}>()

const input = ref<HTMLInputElement>()
const files = computed(() => props.modelValue)

function selectFiles(event: Event) {
  const selected = Array.from((event.target as HTMLInputElement).files ?? [])
  const next = [
    ...files.value,
    ...selected.map((file) => ({
      uid: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'idle' as const,
      percent: 0,
      file,
    })),
  ]
  emit('update:modelValue', next)
  emit('change', next)
  if (input.value) input.value.value = ''
}

function remove(uid: string) {
  const next = files.value.filter((file) => file.uid !== uid)
  emit('update:modelValue', next)
  emit('change', next)
}

function formatSize(size: number) {
  return `${(size / 1024).toFixed(1)} KB`
}
</script>

<template>
  <section class="vfu-upload">
    <label class="vfu-dropzone">
      <input ref="input" type="file" :accept="accept" :multiple="multiple" @change="selectFiles" />
      <strong>选择文件</strong>
      <span>当前为组件开发预览；上传传输能力将按设计文档逐步接入。</span>
    </label>
    <ul v-if="files.length" class="vfu-list">
      <li v-for="file in files" :key="file.uid">
        <span>{{ file.name }}</span>
        <small>{{ formatSize(file.size) }}</small>
        <button type="button" @click="remove(file.uid)">移除</button>
      </li>
    </ul>
  </section>
</template>

<style>
.vfu-upload { color: #1f2937; font: 14px/1.5 system-ui, sans-serif; }
.vfu-dropzone { display: grid; gap: 8px; padding: 28px; border: 1px dashed #7c3aed; border-radius: 12px; background: #faf8ff; cursor: pointer; text-align: center; }
.vfu-dropzone input { display: none; }
.vfu-dropzone strong { color: #6d28d9; font-size: 16px; }
.vfu-dropzone span { color: #6b7280; }
.vfu-list { display: grid; gap: 8px; margin: 12px 0 0; padding: 0; list-style: none; }
.vfu-list li { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
.vfu-list small { color: #6b7280; }
.vfu-list button { margin-left: auto; border: 0; background: none; color: #dc2626; cursor: pointer; }
</style>
