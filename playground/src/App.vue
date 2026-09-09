<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  FlowUpload,
  AvatarUpload,
  createHttpUploadTransport,
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
const mode = ref<'mock' | 'local'>('mock')
const clearing = ref(false)
const drag = ref(true)
const loading = ref(false)
const listType = ref<'list' | 'picture'>('list')
const pagination = ref({
  total: files.value.length,
  currentPage: 1,
  pageSize: 10,
  pageSizes: [10, 20, 50, 100],
})
const eventLog = ref<string[]>([])
const avatar = ref<UploadFileItem[]>([])
const avatarUpdateAction = '/api/avatar/{fileId}'
let loadingTimer: number | undefined

function testLoading() {
  if (loadingTimer !== undefined) window.clearTimeout(loadingTimer)
  loading.value = true
  loadingTimer = window.setTimeout(() => {
    loading.value = false
    loadingTimer = undefined
  }, 3_000)
}

onBeforeUnmount(() => {
  if (loadingTimer !== undefined) window.clearTimeout(loadingTimer)
})

const mockTransport: UploadTransport = {
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

const localTransport = createHttpUploadTransport({
  url: '/api/files/upload',
  createUrl: '/api/files',
  deleteUrl: (fileId) => `/api/files/${encodeURIComponent(fileId)}`,
  checkUrl: '/api/files/check',
  multipart: {
    initUrl: '/api/multipart/init',
    chunkUrl: (uploadId, index) => `/api/multipart/${encodeURIComponent(uploadId)}/chunks/${index}`,
    completeUrl: (uploadId) => `/api/multipart/${encodeURIComponent(uploadId)}/complete`,
  },
})
const activeTransport = computed(() => (mode.value === 'local' ? localTransport : mockTransport))

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

const localDownloadTransport: DownloadTransport = {
  async downloadFile({ fileId, fileName }) {
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`)
    if (!response.ok) throw new Error(`下载失败（${response.status}）`)
    return { blob: await response.blob(), fileName }
  },
  async createArchive({ fileIds }) {
    const response = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    })
    if (!response.ok) throw new Error(`创建打包下载失败（${response.status}）`)
    return response.json()
  },
  async getArchiveTask(taskId) {
    const response = await fetch(`/api/archives/${encodeURIComponent(taskId)}`)
    if (!response.ok) throw new Error(`读取打包下载状态失败（${response.status}）`)
    return response.json()
  },
}
const activeDownloadTransport = computed(() =>
  mode.value === 'local' ? localDownloadTransport : downloadTransport,
)

async function loadLocalFiles() {
  const response = await fetch('/api/files')
  if (!response.ok) throw new Error(`加载本地文件失败（${response.status}）`)
  const result = (await response.json()) as {
    files: Array<{ fileId: string; name: string; size: number; mimeType: string; url: string }>
    total: number
  }
  files.value = result.files.map((file) => ({
    uid: file.fileId,
    fileId: file.fileId,
    name: file.name,
    size: file.size,
    type: file.mimeType,
    status: 'success',
    percent: 100,
    url: file.url,
  }))
  pagination.value = { ...pagination.value, total: result.total }
  eventLog.value.unshift(`已加载 ${result.total} 个本地文件`)
}

async function clearLocalData() {
  if (!window.confirm('将永久删除本地 SQLite 记录、已上传文件和未完成分片会话，是否继续？')) return
  clearing.value = true
  try {
    const response = await fetch('/api/test/reset', { method: 'POST' })
    if (!response.ok) throw new Error(`清空失败（${response.status}）`)
    files.value = []
    pagination.value = { ...pagination.value, total: 0 }
    avatar.value = []
    eventLog.value.unshift('已清空本地 SQLite 与上传目录')
  } catch (error) {
    eventLog.value.unshift(error instanceof Error ? error.message : '清空本地数据失败')
  } finally {
    clearing.value = false
  }
}

watch(mode, (value) => {
  if (value === 'local')
    void loadLocalFiles().catch((error) => eventLog.value.unshift(error.message))
})
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
        <fieldset class="layout-choice">
          <legend>传输模式</legend>
          <label><input v-model="mode" type="radio" value="mock" /> Mock</label>
          <label><input v-model="mode" type="radio" value="local" /> 本地 SQLite</label>
        </fieldset>
        <label class="switch"><input v-model="autoUpload" type="checkbox" /> 选择后自动上传</label>
        <label class="switch"><input v-model="drag" type="checkbox" /> 启用拖拽上传</label>
        <button type="button" class="loading-test" :disabled="loading" @click="testLoading">
          {{ loading ? '加载中...' : '测试 loading（3秒）' }}
        </button>
        <button
          v-if="mode === 'local'"
          type="button"
          class="clear-test"
          :disabled="clearing"
          @click="clearLocalData"
        >
          {{ clearing ? '清空中...' : '清空本地测试数据' }}
        </button>
      </div>
    </header>
    <FlowUpload
      v-model="files"
      v-model:pagination="pagination"
      :transport="activeTransport"
      :download-transport="activeDownloadTransport"
      accept="image/*,.pdf"
      :max-size="20 * 1024 * 1024"
      :data="{ source: 'playground', scene: 'm3' }"
      :headers="{ Authorization: 'Bearer playground-token' }"
      :auto-upload="autoUpload"
      :drag="drag"
      :loading="loading"
      :normal-upload-threshold="1024 * 1024"
      :chunk-size="256 * 1024"
      :chunk-concurrency="2"
      :max-concurrent-files="2"
      :max-concurrent-requests="3"
      :list-type="listType"
      selectable
      @error="(_, error) => eventLog.unshift(`错误：${error.message}`)"
      @archive-success="(taskId) => eventLog.unshift(`打包下载已开始：${taskId}`)"
      @archive-error="(_, error) => eventLog.unshift(`打包下载错误：${error.message}`)"
      @pagination-change="
        (page, size) => eventLog.unshift(`分页切换：第 ${page} 页，每页 ${size} 条`)
      "
    />
    <section class="avatar-demo">
      <h2>头像上传</h2>
      <p>支持点击或拖拽选择，选中后先裁剪再上传。</p>
      <AvatarUpload
        v-model="avatar"
        :transport="activeTransport"
        :update-action="avatarUpdateAction"
        accept="image/*"
        :data="{ source: 'playground', scene: 'avatar' }"
        :headers="{ Authorization: 'Bearer playground-token' }"
        :drag="drag"
        @update:model-value="eventLog.unshift('头像已更新')"
      />
    </section>
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
.loading-test {
  border: 1px solid #c9d2e3;
  border-radius: 4px;
  padding: 6px 10px;
  background: #fff;
  color: #2f6bff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.loading-test:hover:not(:disabled) {
  border-color: #2f6bff;
}
.clear-test {
  border: 1px solid #f0a9a9;
  border-radius: 4px;
  padding: 6px 10px;
  background: #fff;
  color: #c0392b;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.clear-test:disabled {
  color: #aeb8c8;
  cursor: wait;
}
.loading-test:disabled {
  color: #aeb8c8;
  cursor: wait;
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
.avatar-demo {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #e5e7eb;
}
.avatar-demo h2 {
  margin: 0;
  color: #202938;
  font-size: 16px;
}
.avatar-demo p {
  color: #748094;
  font-size: 13px;
}
.pagination-demo {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid #e5e7eb;
}
.pagination-demo h2 {
  margin: 0;
  color: #202938;
  font-size: 16px;
}
.pagination-demo p {
  margin: 8px 0 16px;
  color: #748094;
  font-size: 13px;
}
.pagination-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  color: #748094;
  font-size: 13px;
}
.pagination-controls label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pagination-controls select {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 4px 8px;
  color: #606266;
  background: #fff;
}
.pagination-demo :deep(.el-pagination) {
  justify-content: center;
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
