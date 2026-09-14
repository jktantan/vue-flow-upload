/** SHA-256 初始状态常量，创建哈希器时复制以避免跨实例污染。 SHA-256 initial state copied for each hasher to prevent cross-instance mutation. */
const INITIAL_HASH = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

/** SHA-256 的 64 个轮常量。 SHA-256's 64 round constants. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** 可增量追加数据的 SHA-256 实现，供主线程和 Worker 共用。 Incremental SHA-256 implementation shared by the main thread and Worker. */
export class IncrementalSha256 {
  /** 当前哈希状态，会在每个完整块压缩后更新。 Current hash state updated after each full block is compressed. */
  private readonly hash = new Uint32Array(INITIAL_HASH)
  /** 未填满的 64 字节输入块。 Incomplete 64-byte input block. */
  private readonly block = new Uint8Array(64)
  /** 可复用的消息调度表，避免每 64 字节分配一次数组。 Reusable message schedule that avoids an allocation for every 64-byte block. */
  private readonly words = new Uint32Array(64)
  /** 当前未填满输入块中的有效字节数。 Number of valid bytes in the current incomplete input block. */
  private blockLength = 0
  /** 已接收的输入字节总数，用于 SHA-256 末尾长度填充。 Total input bytes received, used by SHA-256's final length padding. */
  private length = 0

  /**
   * 增量吸收输入字节，直接压缩完整块以减少复制与逐字节循环。
   * Incrementally absorbs input bytes, compressing complete blocks directly to reduce copies and byte-by-byte loops.
   */
  update(input: Uint8Array) {
    // 已处理的输入偏移，始终指向尚未吸收的字节。
    // Input offset that always points at the next byte not yet absorbed.
    let inputOffset = 0
    // 当前输入的总字节数，用于更新最终填充所需长度。
    // Total bytes in the current input, used to update the length required for final padding.
    const inputLength = input.length
    this.length += inputLength
    while (inputOffset < inputLength) {
      // 块为空时直接读取完整的 64 字节视图，避免先复制到暂存块。
      // When the block is empty, read a full 64-byte view directly instead of copying it to the staging block.
      if (this.blockLength === 0 && inputLength - inputOffset >= 64) {
        this.transform(input.subarray(inputOffset, inputOffset + 64))
        inputOffset += 64
        continue
      }
      // 本轮填入暂存块的字节数，确保跨分块输入仍连续。
      // Number of bytes staged this iteration, preserving continuity across input chunks.
      const copyLength = Math.min(64 - this.blockLength, inputLength - inputOffset)
      this.block.set(input.subarray(inputOffset, inputOffset + copyLength), this.blockLength)
      this.blockLength += copyLength
      inputOffset += copyLength
      if (this.blockLength === 64) {
        this.transform(this.block)
        this.blockLength = 0
      }
    }
  }

  digest() {
    // 写入 SHA-256 填充与原始位长度，压缩最后一块后输出十六进制摘要。 Pad with bit length, compress the final block, and return a hex digest.
    const bitLengthHigh = Math.floor(this.length / 0x20000000)
    const bitLengthLow = (this.length << 3) >>> 0
    this.block[this.blockLength++] = 0x80
    if (this.blockLength > 56) {
      this.block.fill(0, this.blockLength)
      this.transform(this.block)
      this.blockLength = 0
    }
    this.block.fill(0, this.blockLength, 56)
    const view = new DataView(this.block.buffer)
    view.setUint32(56, bitLengthHigh)
    view.setUint32(60, bitLengthLow)
    this.transform(this.block)
    return Array.from(this.hash, (word) => word.toString(16).padStart(8, '0')).join('')
  }

  private transform(block: Uint8Array) {
    // 执行标准 SHA-256 的 64 轮消息扩展与状态压缩。 Perform SHA-256's standard 64-round message expansion and state compression.
    // 可复用的消息调度表，避免大文件哈希期间产生海量短生命周期数组。
    // Reusable message schedule prevents huge numbers of short-lived arrays while hashing large files.
    const words = this.words
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength)
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(index * 4)
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15]
      const b = words[index - 2]
      words[index] =
        (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) +
        words[index - 16] +
        (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)) +
        words[index - 7]
    }
    let [a, b, c, d, e, f, g, h] = this.hash
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const choice = (e & f) ^ (~e & g)
      const t1 = (h + s1 + choice + K[index] + words[index]) >>> 0
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    this.hash[0] = (this.hash[0] + a) >>> 0
    this.hash[1] = (this.hash[1] + b) >>> 0
    this.hash[2] = (this.hash[2] + c) >>> 0
    this.hash[3] = (this.hash[3] + d) >>> 0
    this.hash[4] = (this.hash[4] + e) >>> 0
    this.hash[5] = (this.hash[5] + f) >>> 0
    this.hash[6] = (this.hash[6] + g) >>> 0
    this.hash[7] = (this.hash[7] + h) >>> 0
  }
}
