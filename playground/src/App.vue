<script setup lang="ts">
import { ref } from 'vue'
import { FlowUpload, type UploadFileItem, type UploadTransport } from 'vue-flow-upload'

const files = ref<UploadFileItem[]>([])
const autoUpload = ref(true)
const eventLog = ref<string[]>([])

const transport: UploadTransport = {
  uploadFile({ file }, { onProgress, signal, headers, data }) {
    eventLog.value.unshift(
      `开始上传：${file.name}（headers ${Object.keys(headers).length} 项，data ${Object.keys(data).length} 项）`,
    )
    return new Promise((resolve, reject) => {
      let loaded = 0
      const timer = window.setInterval(() => {
        loaded = Math.min(file.size, loaded + Math.max(1, Math.ceil(file.size / 8)))
        onProgress(loaded, file.size)
        if (loaded >= file.size) {
          window.clearInterval(timer)
          eventLog.value.unshift(`上传完成：${file.name}`)
          resolve({
            fileId: `demo-${file.name}`,
            name: file.name,
            size: file.size,
            mimeType: file.type,
          })
        }
      }, 180)
      signal.addEventListener(
        'abort',
        () => {
          window.clearInterval(timer)
          reject({ code: 'ABORTED', message: '上传已取消', retriable: false })
        },
        { once: true },
      )
    })
  },
}
</script>

<template>
  <main>
    <p class="eyebrow">PLAYGROUND</p>
    <h1>Vue Flow Upload</h1>
    <p class="intro">
      M1 手工测试：普通上传、文件校验、动态请求头与 JSON
      业务参数、自动或手动上传、进度动画和文件移除。
    </p>
    <label class="switch"><input v-model="autoUpload" type="checkbox" /> 选择后自动上传</label>
    <FlowUpload
      v-model="files"
      :transport="transport"
      accept="image/*,.pdf"
      :max-size="20 * 1024 * 1024"
      :data="{ source: 'playground', scene: 'm1' }"
      :headers="{ Authorization: 'Bearer playground-token' }"
      :auto-upload="autoUpload"
      @error="(_, error) => eventLog.unshift(`错误：${error.message}`)"
    />
    <p class="count">当前队列 {{ files.length }} 个文件</p>
    <aside v-if="eventLog.length" class="log">
      <strong>事件记录</strong>
      <p v-for="entry in eventLog.slice(0, 4)" :key="entry">{{ entry }}</p>
    </aside>
  </main>
</template>

<style scoped lang="scss">
main {
  width: min(720px, calc(100% - 32px));
  margin: 72px auto;
  padding: 36px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--bg);
  box-shadow: var(--shadow);
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}
h1 {
  margin: 8px 0 12px;
}
.intro {
  margin: 0 0 28px;
  color: var(--text);
  line-height: 1.7;
}
.count {
  margin: 16px 0 0;
  color: var(--text);
  font-size: 13px;
}
.switch {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 14px;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}
.log {
  margin-top: 20px;
  padding: 14px;
  border-left: 3px solid var(--accent);
  background: var(--social-bg);
  color: var(--text);
  font-size: 12px;
}
.log strong {
  color: var(--text-h);
}
.log p {
  margin: 5px 0 0;
}
</style>
