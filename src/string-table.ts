import NumberList from './number-list.ts'

class StringTableEntry {
	refcount = 1

	constructor(
		public value: string,
	) {}
}

export default class StringTable {
	index = new Map<string, number>()
	values = new Array<StringTableEntry>()
	freeIndices = new NumberList()

	add(value: string): number {
		const idx = this.index.get(value)
		if (idx === undefined) {
			const newIdx = this.freeIndices.pop()

			if (newIdx === null) {
				const len = this.values.length
				this.values.push(new StringTableEntry(value))
				this.index.set(value, len)
				return len
			}

			const entry = this.values[newIdx]
			entry.value = value
			entry.refcount = 1
			this.index.set(value, newIdx)
			return newIdx
		}

		this.values[idx].refcount += 1
		return idx
	}

	stringToIndex(value: string): number | null {
		return this.index.get(value) ?? null
	}

	indexToString(idx: number): string | null {
		return this.values[idx]?.value ?? null
	}

	delete(value: string): void {
		const idx = this.index.get(value)
		if (idx === undefined) return

		const entry = this.values[idx]
		entry.refcount -= 1

		if (entry.refcount <= 0) {
			this.index.delete(value)
			entry.value = ''
			this.freeIndices.push(idx)
		}
	}
}
