class BitSet {
  constructor(
    private data = new Uint32Array(32),
  ) {}

  add(value: number): void {
    const idx = value >> 5
    if (this.data.length <= idx) {
      const oldData = this.data
      this.data = new Uint32Array(1 << (32 - Math.clz32(idx)))
      this.data.set(oldData)
    }

    this.data[idx] |= 1 << (value & 31)
  }

  delete(value: number): void {
    const idx = value >> 5
    if (this.data.length <= idx) return
    this.data[idx] &= ~(1 << (value & 31))
  }

  count(): number {
    let count = 0
    for (const item of this.data) {
      let n = item
      n = n - ((n >> 1) & 0x55555555)
      n = (n & 0x33333333) + ((n >> 2) & 0x33333333)
      count += ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24
    }
    return count
  }

  items(): Uint32Array {
    const result = new Uint32Array(this.count())
    let resultPtr = 0
    let shift = 0

    for (const item of this.data) {
      let n = item
      while (n) {
        const bit = n & -n
        n ^= bit
        result[resultPtr] = (31 - Math.clz32(bit)) | shift
        resultPtr += 1
      }

      shift += 32
    }

    return result
  }

  static union(sets: BitSet[]): BitSet {
    if (sets.length === 0) return new BitSet()

    let len = 0
    for (const set of sets) {
      len = Math.max(len, set.data.length)
    }

    const data = new Uint32Array(len)
    for (const set of sets) {
      for (let i = 0; i < set.data.length; ++i) {
        data[i] |= set.data[i]
      }
    }

    return new BitSet(data)
  }

  static intersect(sets: BitSet[]): BitSet {
    const max = (-1) >>> 0
    let len = max
    for (const set of sets) {
      len = Math.min(len, set.data.length)
    }

    const data = new Uint32Array(len).fill(max)
    for (const set of sets) {
      for (let i = 0; i < data.length; ++i) {
        data[i] &= set.data[i]
      }
    }

    return new BitSet(data)
  }
}

class StringTableEntry {
  constructor(
    public value: string,
    public refcount: number,
  ) {}
}

class NumberList {
  data = new Uint32Array(4)
  len  = 0

  push(value: number) {
    if (this.data.length === this.len) {
      const oldData = this.data
      this.data = new Uint32Array(this.data.length << 1)
      this.data.set(oldData)
    }

    this.data[this.len] = value
    this.len += 1
  }

  pop(): number | null {
    if (this.len === 0) return null

    const value = this.data[this.len]
    this.len -= 1
    return value
  }
}

class StringTable {
  index       = new Map<string, number>()
  values      = new Array<StringTableEntry>()
  freeIndices = new NumberList()

  add(value: string): number {
    if (value === "") return -1

    const idx = this.index.get(value)
    if (idx === undefined) {
      const newIdx = this.freeIndices.pop()

      if (newIdx === null) {
        const len = this.values.length
        this.values.push(new StringTableEntry(value, 1))
        this.index.set(value, len)
        return len
      }

      const entry = this.values[newIdx]
      entry.value = value
      entry.refcount = 1
      return newIdx
    }

    this.values[idx].refcount += 1
    return idx
  }

  get(value: string): number | null {
    if (value === "") return -1
    return this.index.get(value) ?? null
  }

  delete(value: string): void {
    if (value === "") return

    const idx = this.index.get(value)
    if (idx === undefined) return

    const entry = this.values[idx]
    entry.refcount -= 1

    if (entry.refcount <= 0) {
      this.index.delete(value)
      entry.value = ""
      this.freeIndices.push(idx)
    }
  }
}
