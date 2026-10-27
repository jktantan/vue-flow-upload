import assert from 'node:assert/strict'
import { createRenderer, h, nextTick, ref } from 'vue'
import test from 'node:test'
import { FlowUpload, createFlowUploadI18n } from '../dist/index.js'

// 组件挂载期会注册键盘监听；Node 测试环境用空实现代替浏览器 window。
// The component registers keyboard listeners on mount; Node tests use no-op browser window stand-ins.
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
}

/**
 * 创建内存节点，让 Vue 运行时可以挂载完整组件树而无需浏览器 DOM。
 * Creates in-memory nodes so Vue can mount the full component tree without a browser DOM.
 */
function createNode(kind, text = '') {
  return { kind, text, children: [] }
}

/**
 * 使用最小自定义渲染器挂载上传组件，并暴露语言切换入口。
 * Mounts the uploader with a minimal custom renderer and exposes a locale switcher.
 */
function mountUpload(locale) {
  // Teleport 目标在测试中复用同一个内存节点，避免真实查询 body。
  // Teleport targets reuse one in-memory node so no real body lookup is required.
  const teleportTarget = createNode('#teleport')
  const renderer = createRenderer({
    createElement: (tag) => createNode(tag),
    createText: (text) => createNode('#text', text),
    createComment: (text) => createNode('#comment', text),
    setText: (node, text) => {
      node.text = text
    },
    setElementText: (element, text) => {
      element.text = text
    },
    insert: (child, parent) => {
      parent.children.push(child)
    },
    remove: () => {},
    parentNode: () => null,
    nextSibling: () => null,
    patchProp: () => {},
    querySelector: () => teleportTarget,
  })
  const host = renderer.createApp({
    setup() {
      // 读取响应式语言值，使语言变化触发 FlowUpload 重新渲染。
      // Reads the reactive locale so changing it re-renders FlowUpload.
      return () =>
        h(FlowUpload, {
          locale: locale.value,
          pagination: { total: 42, currentPage: 1, pageSize: 10 },
        })
    },
  })
  // 提供宿主级 i18n 以消除缺少全局实例的告警；组件仍优先使用 locale prop 生成的实例。
  // Provide a host-level i18n to avoid missing-instance warnings; the component still prefers its locale-prop instance.
  host.use(createFlowUploadI18n())
  const root = createNode('#root')
  host.mount(root)
  return { host, root }
}

/**
 * 汇总内存节点树中的可见文本，用于断言分页实际渲染的文案。
 * Collects visible text from the in-memory node tree to assert rendered pagination copy.
 */
function collectText(node) {
  if (node.text) return node.text
  return node.children.map(collectText).join(' ')
}

/**
 * 在虚拟节点树中查找指定名称的组件实例。
 * Finds a component instance by name in the virtual node tree.
 */
function findComponentInstance(vnode, name) {
  if (!vnode || typeof vnode !== 'object') return undefined
  if (vnode.type?.__name === name) return vnode.component
  const fromSubTree = vnode.component?.subTree
    ? findComponentInstance(vnode.component.subTree, name)
    : undefined
  if (fromSubTree) return fromSubTree
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      const found = findComponentInstance(child, name)
      if (found) return found
    }
  }
  return undefined
}

test('pagination copy follows locale changes from the uploader', async () => {
  const locale = ref('zh-CN')
  const { host, root } = mountUpload(locale)

  const findPagination = () => findComponentInstance(host._instance.subTree, 'UploadPagination')

  assert.ok(findPagination(), 'pagination should render when pagination options are provided')
  assert.match(collectText(root), /共 42 项/)
  assert.match(collectText(root), /10 \/ 页/)

  locale.value = 'en-US'
  await nextTick()

  assert.match(collectText(root), /Total 42/)
  assert.match(collectText(root), /10 \/ page/)
  assert.doesNotMatch(collectText(root), /共 42 项/)

  host.unmount()
})
