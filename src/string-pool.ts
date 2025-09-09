import NumberList from './number-list.ts'

export default class StringPool {
	private index = new Map<string, number>()
	private freeIndices = NumberList.empty()

	constructor(
		readonly values = new Array<string>(),
		private refcount = NumberList.empty(),
	) {
		if (values.length !== refcount.len) {
			throw new Error('Length mismatch between values and refcount')
		}

		for (let i = 0; i < values.length; ++i) {
			if (refcount.view[i] > 0) {
				this.index.set(values[i], i)
			} else {
				this.freeIndices.push(i)
			}
		}
	}

	add(value: string): number {
		const idx = this.index.get(value)
		if (idx === undefined) {
			const newIdx = this.freeIndices.pop()

			if (newIdx === null) {
				const len = this.values.length
				this.values.push(value)
				this.refcount.push(1)
				this.index.set(value, len)
				return len
			}

			this.values[newIdx] = value
			this.refcount.view[newIdx] = 1
			this.index.set(value, newIdx)
			return newIdx
		}

		this.refcount.view[idx] += 1
		return idx
	}

	delete(value: string): void {
		const idx = this.index.get(value)
		if (idx === undefined) return

		this.refcount.view[idx] -= 1

		if (this.refcount.view[idx] <= 0) {
			this.index.delete(value)
			this.values[idx] = ''
			this.freeIndices.push(idx)
		}
	}

	stringToIndex(value: string): number | null {
		return this.index.get(value) ?? null
	}

	indexToString(idx: number): string {
		return this.values[idx]
	}
}
