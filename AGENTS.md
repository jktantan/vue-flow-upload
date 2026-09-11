# AGENTS.md

## 项目定位 / Project scope

本仓库是一个基于 Vue 3、TypeScript、Vite 和 pnpm workspace 的上传组件库：

- `packages/vue-flow-upload/`：可发布的组件库和公共类型。
- `playground/`：组件的本地演示与手工验证入口，不应承载可复用业务逻辑。
- `docs/`：用户接入、后端协议和开发说明；公共 API 变化必须同步更新。

修改前先阅读相关类型、现有测试和使用文档。优先采用仓库已有的模式与命名，不无故引入依赖、框架或新的状态管理方案。

## 通用原则 / General principles

- 使用 TypeScript；不使用 `any`。未知异常、外部响应和动态数据使用 `unknown`，并在边界处收窄类型。
- 保持单一职责、最小改动和向后兼容。公共 prop、event、slot、expose、类型和传输协议的变更属于 API 变更，必须评估兼容性并更新文档与测试。
- 业务常量使用具名常量或配置项，避免魔法数字、字符串和隐式行为。
- 异步流程必须处理取消、竞态、加载态和失败态；网络请求要保留错误上下文，不能静默吞掉异常。
- 不提交密钥、令牌、个人路径、构建产物、依赖目录或与任务无关的格式化结果。

## 代码拆分与目录职责 / Code splitting and directory responsibilities

- 以职责和变化原因拆分，而不是机械按行数拆分。一个文件同时承担视图渲染、状态编排、协议转换、网络请求或复杂算法中两类及以上职责时，应优先拆分。
- 以下情况必须评估拆分：SFC 的 `<script>` 或模板难以在一个屏内理解；文件超过约 300 行且仍在增长；单个函数超过约 50 行或拥有超过 3 层嵌套；同一逻辑可被两个以上调用方复用；修改一个功能经常牵动不相关代码；或独立逻辑无法单测。
- 行数只是预警值，不是规避规则的目标：为压缩行数牺牲可读性、抽出只被调用一次且没有独立职责的“跳板函数”，或制造过深目录，均不属于有效拆分。
- Vue 组件保留组件协调职责：模板、props/emits、展示状态与少量交互编排。可复用状态和副作用抽到 `composables/useXxx.ts`；传输、队列、并发、哈希等领域逻辑放在 `core/`；无状态纯函数放在 `utils/`；公共契约放在 `types/`。
- 拆分后依赖方向应为组件/组合式函数 → `core`/`utils`/`types`。低层模块不得导入 Vue 组件、页面或 playground；避免循环依赖。只有跨模块复用的内容才从 `index.ts` 导出。
- 每个新模块先定义清晰输入、输出、错误和资源所有权；拆分不得改变已有公共行为。被拆出的复杂逻辑应获得直接测试。

## 命名规范 / Naming conventions

- 名称应表达业务含义和单位，避免 `data`、`info`、`handle`、`temp`、`flag`、`obj` 等泛化命名。布尔值以 `is`、`has`、`can`、`should` 或 `needs` 开头；集合使用复数；毫秒、字节、百分比等单位写入名称，例如 `retryDelayMs`、`chunkSizeBytes`、`progressPercent`。
- 变量、函数、prop、event payload、slot prop 使用 `camelCase`；类型、接口、类、Vue 组件、枚举使用 `PascalCase`；常量使用 `UPPER_SNAKE_CASE`，仅用于模块级不变业务常量。不要把可变配置伪装为全大写常量。
- 函数以动词开头并准确表达副作用：查询用 `get`/`find`/`resolve`，转换用 `to`/`normalize`/`parse`，创建用 `create`，更新用 `update`，布尔判断用 `is`/`has`/`can`，事件回调用 `handleXxx`。异步函数同样以实际动作命名，不以无意义的 `async` 前缀命名。
- 文件名使用 `kebab-case`，且反映唯一主导出：Vue 组件例外使用 `PascalCase.vue`，composable 必须为 `useXxx.ts`，测试为 `*.test.ts` 或现有测试运行器约定的等价名称。避免 `common.ts`、`helpers.ts`、`misc.ts` 等无职责文件。
- Vue 组件名使用至少两个有业务含义的 PascalCase 单词，避免与原生 HTML 标签、Vue 保留名和含糊缩写冲突。模板中的 prop 与 event 使用 kebab-case；事件名使用 `kebab-case` 的事实语义（如 `upload-success`），双向绑定仅使用 `update:propName`。
- 类型命名表达角色而不是实现细节：对象契约使用名词（`UploadTransport`），配置使用 `XxxOptions`/`XxxConfig`，回调使用 `XxxHandler`，结果使用 `XxxResult`，错误使用 `XxxError`。不使用 `I`、`T`、`Impl` 等无信息后缀，泛型参数除外。

## 双语注释 / Bilingual comments

所有新增或修改的**自定义代码**必须配有内容等价、完整且有意义的中英文注释。中文在前、英文在后，推荐用同一条 JSDoc：

```ts
/**
 * 将外部文件记录补全为组件内部状态，避免受控模式缺少可选字段。
 * Normalizes external file records into component state so controlled mode has all optional fields.
 */
function normalizeFileList(files: UploadUserFile[]): UploadFileItem[] {
  // 已规范化的文件列表，用于替换内部状态。
  // Normalized file list used to replace internal state.
  const normalizedFiles = []
}
```

- **方法、函数、类、接口、类型、组件、composable、props、emits、slots、expose 和所有自定义变量/常量**都要注释其用途、关键输入/输出或状态含义。
- 对导出 API、复杂控制流、并发/取消、边界条件、单位、默认值原因和副作用，使用多行 JSDoc 说明“为什么”和“如何使用”；仅解释语法的注释不合格。
- 变量声明紧邻上一行使用双行 `//` 注释；对象字段、类型字段和 Vue prop 使用紧邻的双语 `/** ... */` 注释。解构项、循环索引和明显的临时局部变量可由其来源变量的注释覆盖，避免机械重复。
- 导入项、框架保留字、纯类型字面量的重复字段、HTML 标签、CSS 属性和显而易见的 getter/setter 不要求逐项注释；不得为凑数量写空泛注释。
- 修改已有代码时，补齐所触及范围内缺失或已失真的注释；注释必须随实现和行为变化同步更新。
- 文案、错误信息和用户可见提示必须走现有 i18n 机制；注释双语不等于界面文案双语。

## Vue 3 规范 / Vue 3 conventions

- 新建 SFC 默认使用 `<script setup lang="ts">`；块顺序固定为 `<script setup>`、`<template>`、`<style scoped lang="scss">`（确有全局样式需求时说明原因）。
- 组件中**禁止使用 Options API**，包括 `data`、`methods`、`computed`、`watch`、`props`、`emits`、`mixins`、`extends` 和 Options API 生命周期钩子。统一使用 Composition API、`<script setup lang="ts">`、composable 与 `onMounted` 等组合式生命周期钩子；改动旧代码时同步迁移所触及的 Options API 范围。
- 组件名、文件名使用 PascalCase；composable 使用 `useXxx.ts`；普通工具文件使用 `kebab-case.ts`；模板事件和 prop 在模板中使用 kebab-case。
- **Props/Emits：必须为 `defineProps` 和 `defineEmits` 提供 TypeScript 类型声明。** 使用泛型类型参数或独立的 `interface`/`type`，禁止仅依赖运行时对象推断，也禁止 `any`；复杂公共契约优先提取为可导出的类型。`defineSlots` 与 `defineExpose` 同样必须显式标注类型。

```ts
/** 上传组件的输入配置。 Upload component input configuration. */
interface FlowUploadProps {
  /** 单个文件最大字节数。 Maximum size in bytes for one file. */
  maxSizeBytes?: number
}

/** 组件向宿主报告的事件契约。 Events reported by the component to its host. */
interface FlowUploadEmits {
  /** 上传完成后携带文件及服务端结果。 Carries the file and server result when an upload finishes. */
  (event: 'upload-success', file: UploadFileItem, result: UploadSuccessResult): void
}

/** 经过 TypeScript 约束的组件输入。 TypeScript-constrained component inputs. */
const props = withDefaults(defineProps<FlowUploadProps>(), { maxSizeBytes: 20 * 1024 * 1024 })
/** 经过 TypeScript 约束的组件事件发送器。 TypeScript-constrained component event emitter. */
const emit = defineEmits<FlowUploadEmits>()
```

- props 必须说明默认值、可选性、单位和受控/非受控语义；events 必须说明触发时机、payload 和是否表示成功完成。运行时校验仅用于 JavaScript 消费者或必要的运行时边界，不能替代 TypeScript 类型。
- 受控 `v-model` 值是外部事实来源：不要直接修改 prop；通过 emit 更新，并清晰处理外部更新覆盖内部临时状态的规则。
- 可推导的派生状态使用 `computed`，副作用使用 `watch`/生命周期钩子；不要用 `watch` 同步本可计算的状态。watch 要指明来源、为何需要副作用，并在异步回调中防止过期结果写回。
- DOM、定时器、事件监听、AbortController、Worker、预览 URL 等资源必须在 `onBeforeUnmount` 或对应清理回调中释放。仅在确实需要时使用 `ref` 访问 DOM 或子组件实例。
- 模板保持声明式与轻量：复杂判断、格式化、请求和状态转换放入 script 中的命名函数或 composable；`v-for` 必须使用稳定且唯一的 `:key`，不得使用数组索引作为会变动列表的 key。
- 子组件以 props 向下、events 向上传递数据；避免跨层修改、直接操作子组件内部状态或滥用 `provide/inject`。注入值需定义 `InjectionKey` 和明确的默认/缺失行为。
- 公共组件应支持 `disabled`、键盘操作、可访问名称和必要的 ARIA 属性；图片需有有意义的 `alt`，纯装饰图片使用空 `alt`。

## TypeScript 与模块边界 / TypeScript and module boundaries

- 在 `src/types/` 定义并从入口显式导出公共类型；内部实现类型不要意外暴露到公共 API。
- 使用 `type` 导入纯类型；公共 API 的联合类型要可读且可扩展。优先使用 `interface` 描述可扩展对象，使用 `type` 表示联合、映射或计算类型。
- 所有网络、文件和 Worker 边界数据都要验证最小必要字段。错误统一通过现有错误工具规范化，并保留 `cause`、错误码和是否可重试的信息。
- 不在组件内散落协议拼装、文件分片或重试策略；这类逻辑应位于 `core/`、`utils/` 或 composable，并有独立测试。

## 样式与界面 / Styles and UI

- 使用现有主题变量、BEM 风格类名和 SCSS 文件结构；不要硬编码可复用的颜色、间距、层级或断点。
- `scoped` 样式中谨慎使用深度选择器；不使用 `!important`，除非为兼容第三方样式且在注释中解释原因。
- 支持窄屏、长文件名、加载/空状态和错误状态。视觉改动要在 playground 中手工检查。

## 测试、文档与验证 / Tests, docs, and verification

- 修复缺陷必须添加回归测试；新增状态转换、上传协议、并发、重试、取消或公共 API 时必须覆盖成功、失败和边界路径。
- API、默认值、事件、插槽、配置或后端请求变更时，更新 `packages/vue-flow-upload/README.md` 和相关 `docs/` 文档；必要时更新 playground 示例。
- 提交前按改动范围运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- 不能运行的检查必须说明原因和未验证的范围；不得以关闭 lint/typecheck 规则代替修复实现。

## 交付检查 / Delivery checklist

- 新增或改动的自定义代码是否有准确的中英文方法与变量注释？
- Vue props、事件、响应式状态、资源清理和可访问性是否符合上述规范？
- 公共行为是否有类型、测试、文档和示例支撑？
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 是否通过，或已明确未运行原因？
