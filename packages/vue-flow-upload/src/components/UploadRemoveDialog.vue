<script setup lang="ts">
import { computed } from 'vue'
import type { UploadFileItem } from '../types'

const props = defineProps<{
  files: UploadFileItem[]
  busy: boolean
  error?: string
  title: string
  message: string
  cancelText: string
  confirmText: string
  processingText: string
}>()

const names = computed(() => props.files.map((file) => file.name).join('、'))
</script>

<template>
  <Teleport to="body">
    <div v-if="files.length" class="vfu-confirm" role="presentation">
      <div class="vfu-confirm__backdrop" />
      <section
        class="vfu-confirm__dialog"
        role="alertdialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="vfu-confirm__icon" aria-hidden="true">!</div>
        <div class="vfu-confirm__content">
          <h3>{{ title }}</h3>
          <p>{{ message.replace('{names}', names).replace('{count}', String(files.length)) }}</p>
          <p v-if="error" class="vfu-confirm__error">{{ error }}</p>
        </div>
        <footer>
          <button type="button" :disabled="busy" @click="$emit('cancel')">{{ cancelText }}</button>
          <button class="is-danger" type="button" :disabled="busy" @click="$emit('confirm')">
            {{ busy ? processingText : confirmText }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
