export default class NumberList {
	private constructor(
		private data: Uint32Array,
		private size: number,
	) {}

	static empty(): NumberList {
		return NumberList.withCapacity(4)
	}

	static withCapacity(capacity: number): NumberList {
		const aligned = 1 << (32 - Math.clz32(capacity - 1))
		const buffer = new Uint32Array(Math.max(aligned, 4))
		return new NumberList(buffer, 0)
	}

	static zeros(length: number): NumberList {
		const list = NumberList.withCapacity(length)
		list.size = length
		return list
	}

	static fromArray(values: number[]): NumberList {
		const list = NumberList.withCapacity(values.length)
		list.data.set(values)
		list.size = values.length
		return list
	}

	get len(): number {
		return this.size
	}

	push(value: number) {
		if (this.data.length === this.size) {
			const oldData = this.data
			this.data = new Uint32Array(this.data.length << 1)
			this.data.set(oldData)
		}

		this.data[this.len] = value
		this.size += 1
	}

	pop(): number | null {
		if (this.size === 0) return null

		this.size -= 1
		const value = this.data[this.len]
		return value
	}

	get view(): Uint32Array {
		return this.data.subarray(0, this.len)
	}
}
