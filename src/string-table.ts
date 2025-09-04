import NumberList from './number-list.ts'
import * as serialize from './serialize.ts'

class StringTableEntry {
	refcount = 1

	constructor(
		public value: string,
	) {}
}

export default class StringTable {
	private index = new Map<string, number>()
	private values = new Array<StringTableEntry>()
	private freeIndices = new NumberList()

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

	indexToString(idx: number): string {
		return this.values[idx].value
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

	serialize(): serialize.StringTable {
		const result: serialize.StringTable = new Array(this.values.length)
		for (let i = 0; i < this.values.length; ++i) {
			if (this.values[i].refcount > 0) {
				result[i] = {
					value: this.values[i].value,
					refcount: this.values[i].refcount,
				}
			} else {
				result[i] = null
			}
		}

		return result
	}

	static deserialize(data: serialize.StringTable): StringTable {
		const result = new StringTable()
		for (let i = 0; i < data.length; ++i) {
			const item = data[i]

			if (item === null) {
				const entry = new StringTableEntry('')
				entry.refcount = 0

				result.values.push(entry)
				result.freeIndices.push(i)
			} else {
				const entry = new StringTableEntry(item.value)
				entry.refcount = item.refcount

				result.values.push(entry)
				result.index.set(item.value, i)
			}
		}
		return result
	}
}
