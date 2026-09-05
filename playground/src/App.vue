<script setup lang="ts">
import { ref } from 'vue'
import {
  FlowUpload,
  type DownloadTransport,
  type UploadFileItem,
  type UploadTransport,
} from 'vue-flow-upload'

const files = ref<UploadFileItem[]>([
  {
    uid: 'sample-pending',
    name: '待上传的产品合作协议（用于展示超长文件名在列表模式中的截断效果）.pdf',
    size: 2.4 * 1024 * 1024,
    type: 'application/pdf',
    status: 'idle',
    percent: 0,
  },
  {
    uid: 'sample-uploading',
    name: '正在上传的项目资料压缩包.zip',
    size: 8.6 * 1024 * 1024,
    type: 'application/zip',
    status: 'uploading',
    percent: 62,
  },
  {
    uid: 'sample-contract',
    name: '已上传的产品合作协议.pdf',
    size: 2.4 * 1024 * 1024,
    type: 'application/pdf',
    status: 'success',
    percent: 100,
    fileId: 'sample-contract',
  },
  {
    uid: 'sample-failed',
    name: '上传失败的营业执照扫描件.pdf',
    size: 1.2 * 1024 * 1024,
    type: 'application/pdf',
    status: 'failed',
    percent: 48,
    error: {
      code: 'NETWORK_ERROR',
      message: '网络连接中断，请重试',
      retriable: true,
    },
  },
])
const autoUpload = ref(true)
const drag = ref(true)
const listType = ref<'list' | 'picture'>('list')
const eventLog = ref<string[]>([])

const transport: UploadTransport = {
  createFile({ fileId, name }) {
    eventLog.value.unshift(`创建文件记录：${name}`)
    return Promise.resolve({ fileId: fileId ?? `demo-file-${Date.now()}` })
  },
  deleteFile(fileId) {
    eventLog.value.unshift(`清理文件及上传会话：${fileId}`)
    return Promise.resolve()
  },
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
    <header class="demo-header">
      <div>
        <p class="eyebrow">上传组件</p>
        <h1>列表模式</h1>
      </div>
      <div class="demo-controls">
        <fieldset class="layout-choice">
          <legend>展示模式</legend>
          <label><input v-model="listType" type="radio" value="list" /> 列表</label>
          <label><input v-model="listType" type="radio" value="picture" /> 图片墙</label>
        </fieldset>
        <label class="switch"><input v-model="autoUpload" type="checkbox" /> 选择后自动上传</label>
        <label class="switch"><input v-model="drag" type="checkbox" /> 启用拖拽上传</label>
      </div>
    </header>
    <FlowUpload
      v-model="files"
      :transport="transport"
      :download-transport="downloadTransport"
      accept="image/*,.pdf"
      :max-size="20 * 1024 * 1024"
      :data="{ source: 'playground', scene: 'm3' }"
      :headers="{ Authorization: 'Bearer playground-token' }"
      :auto-upload="autoUpload"
      :drag="drag"
      :normal-upload-threshold="1024 * 1024"
      :chunk-size="256 * 1024"
      :concurrency="2"
      :max-concurrent-files="2"
      :max-concurrent-requests="3"
      :list-type="listType"
      selectable
      @error="(_, error) => eventLog.unshift(`错误：${error.message}`)"
    />
    <aside v-if="eventLog.length" class="log">
      <strong>事件记录</strong>
      <p v-for="entry in eventLog.slice(0, 4)" :key="entry">{{ entry }}</p>
    </aside>
  </main>
</template>

<style scoped lang="scss">
main {
  width: min(896px, calc(100% - 32px));
  margin: 64px auto;
  padding: 32px;
  background: #f7f8fa;
}

.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  text-align: left;
}
.eyebrow {
  margin: 0;
  color: #748094;
  font-size: 12px;
  font-weight: 500;
}
h1 {
  margin: 3px 0 0;
  color: #202938;
  font-size: 18px;
  font-weight: 600;
}
.switch {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: #748094;
  font-size: 13px;
  cursor: pointer;
}
.demo-controls {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}
.layout-choice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px 10px;
  background: #fff;
  color: #606266;
  font-size: 13px;
}
.layout-choice legend {
  float: left;
  margin-right: 6px;
  padding: 0;
  color: #909399;
  font-size: 12px;
}
.layout-choice label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.layout-choice input {
  accent-color: #409eff;
}
.log {
  margin-top: 20px;
  padding: 14px;
  border-left: 3px solid #2f6bff;
  background: #fff;
  color: #748094;
  font-size: 12px;
}
.log strong {
  color: #202938;
}
.log p {
  margin: 5px 0 0;
}

@media (max-width: 560px) {
  main {
    width: auto;
    margin: 0;
    padding: 20px 16px;
  }
  .demo-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .demo-controls {
    justify-content: flex-start;
  }
}
</style>
