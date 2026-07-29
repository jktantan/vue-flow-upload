# Vue Flow Upload 开发文档

本文档面向本仓库的组件开发者。产品范围、前后端传输契约和功能设计请参阅 [上传组件设计文档](./upload-component-design.md)。

## 1. 仓库结构

```text
packages/vue-flow-upload/  # 将发布至 npm 的 Vue 3 组件包
├── src/                   # 组件、composable、核心上传逻辑、类型与样式
├── dist/                  # 构建产物，不直接编辑
├── package.json           # npm 包元数据、exports 与构建脚本
└── vite.config.ts         # library mode 构建配置

playground/                # 本地可视化手工测试页面，不发布
├── src/
└── vite.config.ts         # 开发时将 vue-flow-upload 指向组件包源码

docs/                      # 设计与开发文档
```

组件库源码只放在 `packages/vue-flow-upload/src`；不要将 Playground 页面、Mock 服务或演示资源打进 npm 包。

## 2. 本地开发

要求：Node.js LTS、pnpm 11 或兼容版本。

```bash
pnpm install
pnpm dev
```

`pnpm dev` 启动 Playground。终端输出的 Vite URL 即为手工测试页面。Playground 通过 Vite alias 引用组件包源码，因此修改组件后可使用 HMR 立即观察结果。

常用命令：

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Playground。 |
| `pnpm build` | 先构建组件包，再构建 Playground。 |
| `pnpm build:lib` | 仅构建 npm 组件包。 |
| `pnpm build:playground` | 仅构建 Playground。 |
| `pnpm typecheck` | 对所有 workspace 执行类型检查。 |
| `pnpm lint` | 检查组件包与 Playground。 |
| `pnpm format:check` | 校验代码格式。 |

## 3. 组件开发约束

- 使用 Vue 3 Composition API、`<script setup lang="ts">` 和严格 TypeScript 类型。
- 所有公共组件、类型、composable 和默认主题入口从 `src/index.ts` 导出。
- Vue 必须保持为 `peerDependency`，不得打入库产物。
- 上传任务、分片调度、哈希、请求适配放在 `core/` 或 `composables/`；视图组件不得直接耦合具体 HTTP URL 或后端 SDK。
- 前后端只通过 `UploadTransport`、`DownloadTransport` 及设计文档中的类型契约交互；不在组件内实现服务端策略。
- 默认主题不依赖 Element Plus 或 Ant Design Vue；第三方主题必须以可选 peer dependency 和按需导入方式实现。
- 所有长生命周期资源必须释放：`AbortController`、Web Worker、对象 URL、轮询定时器和事件监听器。

## 4. 功能开发顺序

按以下顺序实现，保持每个阶段都可在 Playground 独立验证：

1. 文件选择、拖拽、粘贴、校验与受控/非受控列表。
2. 普通上传、请求头、JSON 数据、进度和错误展示。
3. 分片、全局队列、暂停、取消、重试与进度聚合。
4. Worker 增量 SHA-256、秒传与服务端会话续传。
5. 图片墙、预览、排序、批量删除、下载与国际化。
6. Element Plus、Ant Design Vue 主题适配及无障碍优化。

新增功能时，先补充公共类型与设计文档，再实现核心逻辑，最后在 Playground 增加可手工验证的场景。

## 5. Playground 手工测试

Playground 是组件的开发验证页面，不是生产示例。每项能力至少应有一个独立测试区域和可见的事件日志。

建议维护以下场景：

- 普通上传：自定义 `headers`、JSON `data`、自动与手动上传。
- 大文件：分片、并发上限、暂停、继续、取消、重试。
- 秒传与断点续传：使用 Mock `UploadTransport` 模拟命中、已上传分片、会话过期等响应。
- 视图：列表、图片墙、预览、拖拽、粘贴、排序、国际化。
- 权限：只读、禁止删除、禁止下载等组合。
- 下载：单文件、已选文件打包、当前列表全部、异步任务成功/失败。

Mock 仅实现组件契约返回值，不模拟或规定真实服务端的存储、鉴权和业务逻辑。

## 6. 测试与质量门禁

建议测试层次：

- 单元测试：策略决策、分片切分、全局调度、进度聚合、重试、哈希一致性、国际化。
- 组件测试：Props、事件、`v-model`、权限、粘贴、排序、批量删除和资源清理。
- 端到端测试：普通上传、分片、秒传、续传、下载任务的主路径和异常路径。
- 性能测试：使用至少 1 GiB 文件验证增量哈希不将完整文件读入主线程内存。

提交前至少执行：

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## 7. npm 发版

仅发布 `packages/vue-flow-upload`，不要从仓库根目录发布。

1. 确认 `packages/vue-flow-upload/package.json` 中的 `name`、`version`、`license`、`exports` 和 README。
2. 执行 `pnpm build`。
3. 在组件包目录预检内容：`npm pack --dry-run`。产物应仅包含 `dist`、README、LICENSE 和 `package.json`。
4. 登录目标 npm 账号后，在组件包目录执行 `npm publish`；首次或 scoped 包按 npm 的访问级别配置发布。
5. 发布后在干净项目中安装对应版本，验证 ESM、CJS、类型声明和 `vue-flow-upload/style.css` 入口。

版本遵循 SemVer：修复为 patch，向后兼容功能为 minor，破坏性 Props、事件或传输契约变更为 major。

## 8. 文档同步规则

- 改变功能范围、行为或服务端契约：同步更新 `upload-component-design.md`。
- 改变目录、脚本、开发流程或发版方式：同步更新本文档和根目录 README。
- 新增公共 API：在组件包 README 中补充最小可运行示例与类型说明。
