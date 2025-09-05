export default class BitSet {
	private constructor(
		private data: Uint32Array,
	) {}

	static empty(): BitSet {
		return new BitSet(new Uint32Array(4))
	}

	add(value: number): boolean {
		const idx = value >> 5
		if (this.data.length <= idx) {
			const oldData = this.data
			this.data = new Uint32Array(1 << (32 - Math.clz32(idx)))
			this.data.set(oldData)
		}

		const bit = 1 << (value & 31)
		const set = (this.data[idx] & bit) !== 0
		this.data[idx] |= bit
		return set
	}

	delete(value: number): boolean {
		const idx = value >> 5
		if (this.data.length <= idx) return false
		const bit = this.data[idx] & (1 << (value & 31))
		this.data[idx] ^= bit
		return bit !== 0
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

	static union(sets: readonly BitSet[]): BitSet {
		if (sets.length === 0) return BitSet.empty()

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

	static intersect(sets: readonly BitSet[]): BitSet {
		if (sets.length === 0) return BitSet.empty()

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
