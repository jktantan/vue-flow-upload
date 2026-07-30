import assert from 'node:assert/strict'
import test from 'node:test'
import { ChunkScheduler, resolveMessages, resolveTheme } from '../dist/index.js'

test('scheduler observes request and file concurrency limits', async () => {
  const scheduler = new ChunkScheduler({
    concurrency: 1,
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
  assert.equal(resolveTheme('element-plus').variables['--vfu-signal'], '#409eff')
})
