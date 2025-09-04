import NumberList from './number-list.ts'
import StringTable from './string-table.ts'
import BitSet from './bitset.ts'

class Expiry {
	constructor(
		public expireTime: number,
		public heapPosition: number,
	) {}
}

class KVEntry {
	expiry: Expiry | null = null

	constructor(
		public value: number | NumberList | BitSet | null,
	) {}
}

export default class KVStore {
	stringTable = new StringTable()
	data = new Array<KVEntry>()
	heap = new NumberList()

	private getEntry(key: string): KVEntry {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		return this.data[idx]
	}

	private addEntry(key: string): KVEntry {
		const idx = this.stringTable.add(key)
		while (this.data.length <= idx) {
			this.data.push(new KVEntry(null))
		}
		return this.data[idx]
	}

	delete(key: string): void {
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) return

		const entry = this.data[idx]
		const value = entry.value
		if (value === null) return

		entry.value = null
		entry.expiry = null

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

		if (value instanceof BitSet) {
			for (const item of value.items()) {
				const itemString = this.stringTable.indexToString(item)
				if (itemString === null) throw new Error('Implementation error')
				this.stringTable.delete(itemString)
			}
			return
		}

		throw new Error('Not implemented')
	}

	private heapCmp(idx1: number, idx2: number) {
		const entry1 = this.data[idx1]
		const entry2 = this.data[idx2]
		const expiry1 = entry1.expiry
		const expiry2 = entry2.expiry

		if (expiry1 === null || expiry2 === null) {
			throw new Error('Implementation error')
		}

		return expiry1.expireTime < expiry2.expireTime
	}

	private siftUp(idx: number) {
		const val = this.heap.data[idx]

		let p = (idx - 1) >> 1
		let pVal = this.heap.data[p]
		while (idx > 0 && !this.heapCmp(pVal, val)) {
			this.heap.data[idx] = pVal
			const expiry = this.data[pVal].expiry
			if (expiry === null) throw new Error('Implementation error')
			expiry.heapPosition = idx

			idx = p
			p = (idx - 1) >> 1
			pVal = this.heap.data[p]
		}

		this.heap.data[idx] = val
		const expiry = this.data[val].expiry
		if (expiry === null) throw new Error('Implementation error')
		expiry.heapPosition = idx
	}

	private siftDown(idx: number) {
		const val = this.heap.data[idx]
		let childIdx = (idx << 1) | 1
		while (childIdx < this.heap.len) {
			let childVal = this.heap.data[childIdx]
			if (childIdx + 1 < this.heap.len) {
				const otherVal = this.heap.data[childIdx + 1]
				if (this.heapCmp(otherVal, childVal)) {
					childIdx += 1
					childVal = otherVal
				}
			}

			if (this.heapCmp(val, childVal)) continue

			this.heap.data[idx] = childVal
			const expiry = this.data[childVal].expiry
			if (expiry === null) throw new Error('Implementation error')
			expiry.heapPosition = idx

			idx = childIdx
			childIdx = (idx << 1) | 1
		}

		this.heap.data[idx] = val
		const expiry = this.data[val].expiry
		if (expiry === null) throw new Error('Implementation error')
		expiry.heapPosition = idx
	}

	expireKey(key: string, seconds: number): void {
		this.clearExpired()
		const expireTime = Date.now() / 1000 + seconds
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		const entry = this.data[idx]

		if (entry.expiry === null) {
			entry.expiry = new Expiry(expireTime, this.heap.len)
			this.heap.push(idx)
			this.siftUp(this.heap.len - 1)
		} else {
			const oldExpireTime = entry.expiry.expireTime
			entry.expiry.expireTime = expireTime

			if (expireTime <= oldExpireTime) {
				this.siftUp(entry.expiry.heapPosition)
			} else {
				this.siftDown(entry.expiry.heapPosition)
			}
		}
	}

	private clearExpired(): void {
		const currentTime = Date.now() / 1000
		while (this.heap.len > 0) {
			const top = this.heap.data[0]
			const expiry = this.data[top].expiry
			if (expiry === null) throw new Error('Implementation error')
			if (expiry.expireTime > currentTime) break

			const key = this.stringTable.indexToString(top)
			if (key === null) throw new Error('Implementation error')
			this.delete(key)
			const newTop = this.heap.pop()
			if (newTop === null) break

			if (this.heap.len > 0) {
				this.heap.data[0] = newTop
				this.siftDown(0)
			}
		}
	}

	setString(key: string, value: string): void {
		this.clearExpired()
		const entry = this.addEntry(key)
		this.delete(key)
		entry.value = this.stringTable.add(value)
	}

	getString(key: string): string {
		this.clearExpired()
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
		this.clearExpired()
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
		this.clearExpired()
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
		this.clearExpired()
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
		this.clearExpired()
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
		this.clearExpired()
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

	private itemsToStrings(items: Uint32Array): string[] {
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
		this.clearExpired()
		const entry = this.getEntry(key)
		const value = entry.value

		if (value instanceof BitSet) {
			const items = value.items()
			return this.itemsToStrings(items)
		}

		throw new Error('Key holds a value that is not a set')
	}

	private collectSets(keys: string[]): BitSet[] {
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
		this.clearExpired()
		const sets = this.collectSets(keys)
		const items = BitSet.union(sets).items()
		return this.itemsToStrings(items)
	}

	intersectSet(keys: string[]) {
		this.clearExpired()
		const sets = this.collectSets(keys)
		const items = BitSet.intersect(sets).items()
		return this.itemsToStrings(items)
	}

	keys(): string[] {
		this.clearExpired()
		const result = new Array<string>()
		for (let i = 0; i < this.data.length; ++i) {
			if (this.data[i].value !== null) {
				const key = this.stringTable.indexToString(i)
				if (key === null) throw new Error('Implementation error')
				result.push(key)
			}
		}
		return result
	}

	ttl(key: string): number | null {
		this.clearExpired()
		const entry = this.getEntry(key)
		const currentTime = Date.now() / 1000

		if (entry.expiry === null) return null
		return entry.expiry.expireTime - currentTime
	}
}
