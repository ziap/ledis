export default class NumberList {
	data = new Uint32Array(4)
	len = 0

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
}
