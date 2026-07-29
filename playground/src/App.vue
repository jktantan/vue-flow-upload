<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem } from 'vue-flow-upload'

const files = ref<UploadFileItem[]>([])
</script>

<template>
  <main>
    <p class="eyebrow">PLAYGROUND</p>
    <h1>Vue Flow Upload</h1>
    <p class="intro">本地手工测试入口。当前可验证组件加载、文件选择与列表状态；上传能力将按设计文档逐步接入。</p>
    <FlowUpload v-model="files" />
    <p class="count">已选择 {{ files.length }} 个文件</p>
  </main>
</template>

<style scoped>
main {
  width: min(720px, calc(100% - 32px));
  margin: 72px auto;
  padding: 36px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg);
  box-shadow: var(--shadow);
}

.eyebrow { margin: 0; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; }
h1 { margin: 8px 0 12px; }
.intro { margin: 0 0 28px; color: var(--text); line-height: 1.7; }
.count { margin: 16px 0 0; color: var(--text); font-size: 13px; }
</style>
