# Vue Flow Upload 开发文档

本文档面向仓库开发者，API 和行为以源码与 [组件设计文档](./upload-component-design.md) 为准。

## 1. 仓库结构

```text
packages/vue-flow-upload/  # npm 包源码与构建产物
  src/                     # FlowUpload、AvatarUpload、composables、core、types、样式
  tests/                   # Node 测试
  package.json
playground/                # Vite 手工验证页面，不发布
docs/                      # 项目文档
```

包入口由 `src/index.ts` 导出组件、类型、主题、国际化工厂和 `createHttpUploadTransport`；Nuxt 入口为 `src/nuxt.ts`。Vue 是 peer dependency。

## 2. 环境与命令

需要 Node.js LTS、pnpm 11（或兼容版本）。

```bash
pnpm install
pnpm dev
pnpm build
pnpm build:lib
pnpm build:playground
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```

`pnpm dev` 启动 playground；`pnpm test` 运行 `packages/vue-flow-upload/tests/*.test.mjs`。

## 3. 开发约束

- 使用 Vue 3 `<script setup lang="ts">`、Composition API 和严格 TypeScript。
- 源码样式使用 Sass；公共类型从 `src/types/index.ts` 导出。
- 网络协议只能通过 `UploadTransport`/`DownloadTransport` 接入，视图组件不得硬编码后端业务协议。
- 修改 Props、事件、状态、传输字段或 URL 模板时，必须同步更新设计文档、本文档、后台 API 文档和包 README。
- 请求、Worker、对象 URL、归档轮询和事件监听必须在完成、取消、删除和卸载时释放。
- `FormData` 请求不得手动设置 `Content-Type`；XHR 会自动生成 boundary。

## 4. 实现要点

`useUploadQueue.ts` 负责创建文件记录（可选 `createFile`）、哈希、秒传检查、普通上传、分片初始化/上传/合并、暂停、重试和状态更新。`ChunkScheduler` 共享文件和请求并发槽位。`hash-service.ts` 使用 Worker 增量计算 SHA-256。`useDownloadManager.ts` 负责单文件下载和归档任务轮询。

当前 `FlowUpload` 没有粘贴上传、排序、`removeSelected` 暴露方法或 `getMultipartStatus` 传输方法；如需新增，先扩展类型、实现测试，再更新文档。

## 5. Playground 与质量门禁

至少覆盖普通 `action` 上传、自定义 transport 的秒传/分片、暂停继续、失败重试、远程删除、列表与图片墙、预览、权限、国际化和归档下载。Mock 只模拟公共传输接口，不规定真实后端存储或鉴权。

提交前运行 `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build`。只在 `packages/vue-flow-upload` 目录发布：构建后执行 `npm pack --dry-run`，确认仅包含 `dist`、README、LICENSE、package.json，再执行 `npm publish`。版本遵循 SemVer。
