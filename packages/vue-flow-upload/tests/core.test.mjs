import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createFlowUploadI18n,
  ChunkScheduler,
  hashFile,
  resolveMessages,
  resolveTheme,
} from '../dist/index.js'

test('scheduler observes request and file concurrency limits', async () => {
  const scheduler = new ChunkScheduler({
    maxConcurrentChunksPerFile: 1,
    maxConcurrentFiles: 1,
    maxConcurrentRequests: 1,
  })
  let running = 0
  let peak = 0
  const run = () =>
    scheduler.schedule('one', async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => globalThis.setTimeout(resolve, 5))
      running -= 1
    })
  await Promise.all([run(), run()])
  assert.equal(peak, 1)
})

test('messages and built-in themes resolve without UI library dependencies', () => {
  assert.equal(resolveMessages('en-US').downloadAll, 'Download all')
  const i18n = createFlowUploadI18n({
    locale: 'en-US',
    messages: { 'en-US': { VueFlowUpload: { downloadAll: 'Get every file' } } },
  })
  assert.equal(i18n.t('VueFlowUpload.downloadAll'), 'Get every file')
  assert.equal(i18n.t('VueFlowUpload.fileCount', { count: 3 }), '3 files total')
  assert.equal(resolveTheme('element-plus').variables['--vfu-signal'], '#409eff')
})

test('scheduler rejects queued work for a canceled file without interrupting active work', async () => {
  const scheduler = new ChunkScheduler({
    maxConcurrentChunksPerFile: 1,
    maxConcurrentFiles: 1,
    maxConcurrentRequests: 1,
  })
  let release
  const active = scheduler.schedule(
    'one',
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  const queued = scheduler.schedule('one', async () => 'must not run')
  scheduler.cancel('one')
  await assert.rejects(queued, { name: 'AbortError' })
  release('done')
  assert.equal(await active, 'done')
})

test('hashFile hashes incrementally and reports final progress outside worker environments', async () => {
  const file = new File(['abc'], 'sample.txt', { type: 'text/plain' })
  const progress = []
  const digest = await hashFile(file, {
    chunkSize: 1,
    onProgress: (loaded) => progress.push(loaded),
  })
  assert.equal(digest, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.deepEqual(progress, [1, 2, 3])
})
