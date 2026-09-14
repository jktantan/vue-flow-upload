import assert from 'node:assert/strict'
import test from 'node:test'
import { AvatarUpload } from '../dist/index.js'

test('AvatarUpload exposes read-only and shape props with compatible defaults', () => {
  // 运行时 props 供 JavaScript 使用者使用，必须保留只读和轮廓配置的默认行为。
  // Runtime props serve JavaScript consumers and must retain the defaults for read-only and shape configuration.
  assert.equal(AvatarUpload.props.readOnly.default, false)
  assert.equal(AvatarUpload.props.shape.default, 'square')
})
