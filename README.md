# vue-flow-upload workspace

Vue 3 文件上传组件库与本地 Playground。

## 目录

- `packages/vue-flow-upload`：未来发布到 npm 的组件包。
- `docs`：面向组件使用者的 VitePress 文档站，提供接入说明、配置/API 与可操作 DEMO。
- `playground`：本地可视化手工测试页面，不发布到 npm，也不作为用户文档站。
- `internal-docs`：面向维护者和后端协作的协议、设计与开发资料，不纳入用户文档站导航。

## 开发

```bash
pnpm install
pnpm dev
```

运行后访问终端输出的 Vite 地址，即可使用 Playground 手工测试组件。

## 使用文档站

```bash
pnpm docs:dev
```

文档站用于展示组件的接入方式、接口配置和可操作示例；其中 DEMO 使用浏览器内 mock transport，不会上传文件到服务器。

## Playground 本地真实上传模式

Playground 默认使用 Mock transport。页面切换为“本地 SQLite”后，Vite 开发服务器会提供本地 API，真实保存普通上传、分片会话、秒传哈希和文件记录。

默认数据目录为 `.playground/uploads`，数据库为 `.playground/upload.sqlite`，均已忽略 Git。可在启动前覆盖：

```bash
PLAYGROUND_UPLOAD_DIR=/private/tmp/vfu-files PLAYGROUND_DB_PATH=/private/tmp/vfu.sqlite pnpm dev
```

“清空本地测试数据”会要求确认，并清除 SQLite 记录、已上传文件及未完成分片会话；仅在本地 SQLite 模式显示。

## 构建

```bash
pnpm build
```

组件包构建产物位于 `packages/vue-flow-upload/dist`。发布前请确认 npm 包名、版本和组织 scope，并在该目录执行 `npm publish`。
