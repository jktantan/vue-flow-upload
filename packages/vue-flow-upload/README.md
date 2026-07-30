# vue-flow-upload

Vue 3 文件上传组件库。当前已实现普通上传、M2 大文件分片调度、M3 的增量 SHA-256/秒传/续传、M4 图片预览和下载，以及 M5 主题和无障碍基础能力。

```vue
<FlowUpload
  :transport="transport"
  :normal-upload-threshold="10 * 1024 * 1024"
  :chunk-size="5 * 1024 * 1024"
  :concurrency="3"
  :max-concurrent-files="2"
  :max-concurrent-requests="6"
/>
```

大于 `normalUploadThreshold` 的文件需要传入实现了 `initMultipart`、`uploadChunk` 与 `completeMultipart` 的 `UploadTransport`。可使用 `createHttpUploadTransport()` 配置默认 XHR 适配器：

```ts
const transport = createHttpUploadTransport({
  url: '/uploads/file',
  checkUrl: '/uploads/check',
  multipart: {
    initUrl: '/uploads/init',
    chunkUrl: '/uploads/{uploadId}/chunks/{index}',
    completeUrl: '/uploads/{uploadId}/complete',
    cancelUrl: '/uploads/{uploadId}',
  },
})
```

当 `instantUpload` 或大文件的 `resume` 启用时，组件使用 Worker 分块计算 SHA-256；Worker 不可用时会在主线程分批让出事件循环。重新选择相同文件时，适配器的 `initMultipart` 可按哈希返回 `uploadedChunks`，组件仅提交缺失分片。

传入 `downloadTransport` 后，成功文件会显示下载操作；设置 `selectable` 可打包下载勾选文件，`downloadAll()` 可请求当前列表或 `allDownloadScope` 指定的服务端范围。`listType="picture-card"` 提供图片墙和内置预览。

`theme` 支持 `default`、`element-plus`、`ant-design-vue` 或自定义 `ThemeAdapter`。内置主题仅映射设计令牌，不打包或要求安装第三方 UI 库；`locale="zh-CN" | "en-US"` 与 `messages` 可替换默认文案。

实例方法包含 `submit()`、`pause(uid)`、`resume(uid)`、`retry(uid)`、`remove(uid)` 和 `clear()`。完整接入协议见仓库根目录 `docs/`。
