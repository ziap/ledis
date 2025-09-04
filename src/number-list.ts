export default class NumberList {
	private data: Uint32Array
	len: number

	constructor(values: number[] = []) {
		const len = values.length
		const capacity = Math.max(1 << (32 - Math.clz32(len - 1)), 4)
		this.data = new Uint32Array(capacity)
		this.data.set(values)
		this.len = len
	}

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

		this.len -= 1
		const value = this.data[this.len]
		return value
	}

	view(): Uint32Array {
		return this.data.subarray(0, this.len)
	}
}
