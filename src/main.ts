import NumberList from './number-list.ts'
import StringTable from './string-table.ts'

class KVEntry {
	constructor(
		public value: number | NumberList | null,
	) {}
}

class KVStore {
	stringTable = new StringTable()
	data = new Array<KVEntry>()

	delete(key: string): void {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) return

		const entry = this.data[idx]
		const value = entry.value
		if (value === null) return

		this.stringTable.delete(key)
		if (typeof value === 'number') {
			const valueString = this.stringTable.indexToString(value)
			if (valueString === null) throw new Error('Implementation error')
			this.stringTable.delete(valueString)
			return
		}

		if (value instanceof NumberList) {
			for (const item of value.data.subarray(0, value.len)) {
				const itemString = this.stringTable.indexToString(item)
				if (itemString === null) throw new Error('Implementation error')
				this.stringTable.delete(itemString)
			}
			return
		}

		throw new Error('Not implemented')
	}

	setString(key: string, value: string): void {
		const idx = this.stringTable.add(key)
		this.delete(key)
		while (this.data.length <= idx) {
			this.data.push(new KVEntry(null))
		}
		this.data[idx].value = this.stringTable.add(value)
	}

	getString(key: string): string {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		const entry = this.data[idx]

		const value = entry.value
		if (value === null) {
			throw new Error('Key does not exists')
		}

		if (typeof value === 'number') {
			const valueString = this.stringTable.indexToString(value)
			if (valueString === null) {
				throw new Error('Implementation error')
			}
			return valueString
		}

		throw new Error('Key holds a value that is not a string')
	}

	pushArray(key: string, values: string[]): void {
		const idx = this.stringTable.add(key)

		while (this.data.length <= idx) {
			this.data.push(new KVEntry(null))
		}

		const entry = this.data[idx]
		const value = entry.value

		if (value !== null) {
			this.stringTable.delete(key)

			if (value instanceof NumberList) {
				for (const item of values) {
					value.push(this.stringTable.add(item))
				}
			} else {
				throw new Error('Key holds a value that is not a list')
			}

			return
		}

		entry.value = new NumberList()
		for (const item of values) {
			entry.value.push(this.stringTable.add(item))
		}
	}

	popArray(key: string): string | null {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		const entry = this.data[idx]

		const value = entry.value
		if (value === null) {
			throw new Error('Key does not exists')
		}

		if (value instanceof NumberList) {
			const item = value.pop()
			if (item === null) return null
			const itemString = this.stringTable.indexToString(item)
			if (itemString === null) throw new Error('Implementation error')
			this.stringTable.delete(itemString)
			return itemString
		}

		throw new Error('Key holds a value that is not a list')
	}

	sliceArray(key: string, start: number, end: number) {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		const entry = this.data[idx]

		const value = entry.value
		if (value === null) {
			throw new Error('Key does not exists')
		}

		if (value instanceof NumberList) {
			if (start < 0 || end >= value.len) throw new Error('Index out of bound')
			const resultLen = end - start + 1
			const result = new Array<string>(resultLen)
			for (let i = 0; i < resultLen; ++i) {
				const item = value.data[i + start]
				const itemString = this.stringTable.indexToString(item)
				if (itemString === null) throw new Error('Implementation error')
				result[i] = itemString
			}
			return result
		}

		throw new Error('Key holds a value that is not a list')
	}
}

const store = new KVStore()

store.setString('hello', 'world')
console.log(store.getString('hello'))
store.delete('hello')
store.pushArray('hello', ['world1', 'world2'])
store.pushArray('hello', ['world3', 'world4'])
console.log(store.sliceArray('hello', 0, 3))
console.log(store.sliceArray('hello', 0, 2))
console.log(store.sliceArray('hello', 1, 2))
console.log(store.stringTable.values)
console.log(store.popArray('hello'))
console.log(store.popArray('hello'))
console.log(store.stringTable.values)
store.delete('hello')
console.log(store.stringTable.values)
