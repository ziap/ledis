import NumberList from './number-list.ts'
import StringTable from './string-table.ts'
import BitSet from './bitset.ts'

class KVEntry {
	constructor(
		public value: number | NumberList | BitSet | null,
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

	getEntry(key: string): KVEntry {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		return this.data[idx]
	}

	addEntry(key: string): KVEntry {
		const idx = this.stringTable.add(key)
		while (this.data.length <= idx) {
			this.data.push(new KVEntry(null))
		}
		return this.data[idx]
	}

	setString(key: string, value: string): void {
		const entry = this.addEntry(key)
		this.delete(key)
		entry.value = this.stringTable.add(value)
	}

	getString(key: string): string {
		const entry = this.getEntry(key)
		const value = entry.value

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
		const entry = this.addEntry(key)
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
		const entry = this.getEntry(key)
		const value = entry.value

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

	sliceArray(key: string, start: number, end: number): string[] {
		const entry = this.getEntry(key)
		const value = entry.value

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

	addSet(key: string, values: string[]): void {
		const entry = this.addEntry(key)
		const value = entry.value

		if (value !== null) {
			this.stringTable.delete(key)

			if (value instanceof BitSet) {
				for (const item of values) {
					value.add(this.stringTable.add(item))
				}
			} else {
				throw new Error('Key holds a value that is not a set')
			}

			return
		}

		entry.value = new BitSet()
		for (const item of values) {
			entry.value.add(this.stringTable.add(item))
		}
	}

	removeSet(key: string, values: string[]): void {
		const entry = this.getEntry(key)
		const value = entry.value

		if (value instanceof BitSet) {
			for (const item of values) {
				const idx = this.stringTable.stringToIndex(item)
				if (idx !== null && value.delete(idx)) {
					this.stringTable.delete(item)
				}
			}

			return
		}

		throw new Error('Key holds a value that is not a set')
	}

	itemsToStrings(items: Uint32Array): string[] {
		const result = new Array<string>(items.length)

		for (let i = 0; i < items.length; ++i) {
			const item = items[i]
			const itemString = this.stringTable.indexToString(item)
			if (itemString === null) throw new Error('Implementation error')
			result[i] = itemString
		}

		return result
	}

	getSet(key: string): string[] {
		const entry = this.getEntry(key)
		const value = entry.value

		if (value instanceof BitSet) {
			const items = value.items()
			return this.itemsToStrings(items)
		}

		throw new Error('Key holds a value that is not a set')
	}

	collectSets(keys: string[]): BitSet[] {
		const sets = new Array<BitSet>(keys.length)

		for (let i = 0; i < keys.length; ++i) {
			const key = keys[i]
			const entry = this.getEntry(key)
			const value = entry.value

			if (value instanceof BitSet) {
				sets[i] = value
			} else {
				throw new Error(`Key '${key}' holds a value that is not a set`)
			}
		}

		return sets
	}

	unionSet(keys: string[]) {
		const sets = this.collectSets(keys)
		const items = BitSet.union(sets).items()
		return this.itemsToStrings(items)
	}

	intersectSet(keys: string[]) {
		const sets = this.collectSets(keys)
		const items = BitSet.intersect(sets).items()
		return this.itemsToStrings(items)
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
store.addSet('set1', ['apple', 'orange', 'banana'])
store.addSet('set2', ['google', 'microsoft', 'apple'])
console.log(store.intersectSet(['set1', 'set2']))
console.log(store.unionSet(['set1', 'set2']))
