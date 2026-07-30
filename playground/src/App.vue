<script setup lang="ts">
import { ref } from 'vue'
import {
  FlowUpload,
  type DownloadTransport,
  type UploadFileItem,
  type UploadTransport,
} from 'vue-flow-upload'

const files = ref<UploadFileItem[]>([])
const autoUpload = ref(true)
const eventLog = ref<string[]>([])

const transport: UploadTransport = {
  checkFile({ name }) {
    const exists = name.startsWith('instant-')
    eventLog.value.unshift(exists ? `秒传命中：${name}` : `秒传未命中：${name}`)
    return Promise.resolve({
      exists,
      file: exists ? { fileId: `instant-${name}`, name } : undefined,
    })
  },
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
  initMultipart({ name, totalChunks }) {
    eventLog.value.unshift(`创建分片会话：${name}（${totalChunks} 块）`)
    return Promise.resolve({ uploadId: `demo-session-${name}` })
  },
  uploadChunk({ chunkIndex, chunk }, { onProgress, signal }) {
    return new Promise((resolve, reject) => {
      let loaded = 0
      const timer = window.setInterval(() => {
        loaded = Math.min(chunk.size, loaded + Math.max(1, Math.ceil(chunk.size / 5)))
        onProgress(loaded, chunk.size)
        if (loaded === chunk.size) {
          window.clearInterval(timer)
          eventLog.value.unshift(`分片 ${chunkIndex + 1} 上传完成`)
          resolve()
        }
      }, 120)
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
  completeMultipart(uploadId, { data }) {
    eventLog.value.unshift(`合并分片：${uploadId}（业务参数 ${Object.keys(data).length} 项）`)
    return Promise.resolve({ fileId: uploadId })
  },
}

const downloadTransport: DownloadTransport = {
  downloadFile({ fileName }) {
    return Promise.resolve({ blob: new window.Blob([`Mock download: ${fileName}`]), fileName })
  },
  createArchive() {
    return Promise.resolve({
      taskId: `archive-${Date.now()}`,
      status: 'success',
      downloadUrl: 'data:text/plain,Mock archive',
    })
  },
  getArchiveTask(taskId) {
    return Promise.resolve({
      taskId,
      status: 'success',
      downloadUrl: 'data:text/plain,Mock archive',
    })
  },
}
</script>

<template>
  <main>
    <p class="eyebrow">PLAYGROUND</p>
    <h1>Vue Flow Upload</h1>
    <p class="intro">
      M4 手工测试：支持图片墙预览、单文件下载和勾选打包下载；文件会增量计算 SHA-256，以 instant-
      开头的文件名模拟秒传命中。超过 1 MiB 的文件进入可恢复分片队列。
    </p>
    <label class="switch"><input v-model="autoUpload" type="checkbox" /> 选择后自动上传</label>
    <FlowUpload
      v-model="files"
      :transport="transport"
      :download-transport="downloadTransport"
      accept="image/*,.pdf"
      :max-size="20 * 1024 * 1024"
      :data="{ source: 'playground', scene: 'm3' }"
      :headers="{ Authorization: 'Bearer playground-token' }"
      :auto-upload="autoUpload"
      :normal-upload-threshold="1024 * 1024"
      :chunk-size="256 * 1024"
      :concurrency="2"
      :max-concurrent-files="2"
      :max-concurrent-requests="3"
      list-type="picture-card"
      selectable
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
