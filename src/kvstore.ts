import NumberList from './number-list.ts'
import StringPool from './string-pool.ts'
import BitSet from './bitset.ts'

import { assertNever } from './utils.ts'

type Serialized = {
	stringPool: string[]
	data: {
		value?: {
			kind: 'string'
			data: number
		} | {
			kind: 'list'
			data: number[]
		} | {
			kind: 'set'
			data: number[]
		}
		expireTime?: number
	}[]
}

class Expiry {
	public heapPosition: number = -1
	constructor(
		public expireTime: number,
	) {}
}

class KVEntry {
	expiry: Expiry | null = null

	constructor(
		public value: number | NumberList | BitSet | null,
	) {}
}

export default class KVStore {
	private heap = NumberList.empty()

	constructor(
		private stringPool = new StringPool(),
		private data = new Array<KVEntry>(),
	) {
		for (let i = 0; i < data.length; ++i) {
			const expiry = data[i].expiry
			if (expiry !== null) {
				const heapIdx = this.heap.len
				this.heap.push(i)
				this.siftUp(heapIdx)
			}
		}
	}

	private getEntry(key: string): KVEntry {
		const idx = this.stringPool.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		return this.data[idx]
	}

	private addEntry(key: string): KVEntry {
		const idx = this.stringPool.add(key)
		while (this.data.length <= idx) {
			this.data.push(new KVEntry(null))
		}
		return this.data[idx]
	}

	private heapCmp(idx1: number, idx2: number): boolean {
		const entry1 = this.data[idx1]
		const entry2 = this.data[idx2]
		const expiry1 = entry1.expiry
		const expiry2 = entry2.expiry

		if (expiry1 === null || expiry2 === null) {
			throw new Error('Implementation error')
		}

		return expiry1.expireTime < expiry2.expireTime
	}

	private siftUp(idx: number): void {
		const val = this.heap.view[idx]

		let p = (idx - 1) >> 1
		let pVal = this.heap.view[p]
		while (idx > 0 && !this.heapCmp(pVal, val)) {
			this.heap.view[idx] = pVal
			const expiry = this.data[pVal].expiry
			if (expiry === null) throw new Error('Implementation error')
			expiry.heapPosition = idx

			idx = p
			p = (idx - 1) >> 1
			pVal = this.heap.view[p]
		}

		this.heap.view[idx] = val
		const expiry = this.data[val].expiry
		if (expiry === null) throw new Error('Implementation error')
		expiry.heapPosition = idx
	}

	private siftDown(idx: number): void {
		const val = this.heap.view[idx]
		let childIdx = (idx << 1) | 1
		while (childIdx < this.heap.len) {
			let childVal = this.heap.view[childIdx]
			if (childIdx + 1 < this.heap.len) {
				const otherVal = this.heap.view[childIdx + 1]
				if (this.heapCmp(otherVal, childVal)) {
					childIdx += 1
					childVal = otherVal
				}
			}

			if (this.heapCmp(val, childVal)) break

			this.heap.view[idx] = childVal
			const expiry = this.data[childVal].expiry
			if (expiry === null) throw new Error('Implementation error')
			expiry.heapPosition = idx

			idx = childIdx
			childIdx = (idx << 1) | 1
		}

		this.heap.view[idx] = val
		const expiry = this.data[val].expiry
		if (expiry === null) throw new Error('Implementation error')
		expiry.heapPosition = idx
	}

	private removeFromHeap(heapPos: number): void {
		const itemToRemoveIdx = this.heap.view[heapPos]
		const lastHeapItemIdx = this.heap.pop()

		if (lastHeapItemIdx === null) {
			throw new Error('Implementation error')
		}

		if (heapPos < this.heap.len) {
			this.heap.view[heapPos] = lastHeapItemIdx
			const movedEntry = this.data[lastHeapItemIdx]
			if (movedEntry.expiry === null) throw new Error('Implementation error')
			movedEntry.expiry.heapPosition = heapPos
			this.siftDown(heapPos)
		}

		const removedKVEntry = this.data[itemToRemoveIdx]
		if (removedKVEntry.expiry) {
			removedKVEntry.expiry = null
		}
	}

	delete(key: string): void {
		const idx = this.stringPool.stringToIndex(key)
		if (idx === null || idx >= this.data.length) return

		const entry = this.data[idx]
		const value = entry.value
		if (value === null) return

		entry.value = null

		if (entry.expiry !== null) {
			this.removeFromHeap(entry.expiry.heapPosition)
		}

		this.stringPool.delete(key)
		if (typeof value === 'number') {
			const valueString = this.stringPool.indexToString(value)
			this.stringPool.delete(valueString)
			return
		}

		if (value instanceof NumberList) {
			for (const item of value.view) {
				const itemString = this.stringPool.indexToString(item)
				this.stringPool.delete(itemString)
			}
			return
		}

		if (value instanceof BitSet) {
			for (const item of value.items()) {
				const itemString = this.stringPool.indexToString(item)
				this.stringPool.delete(itemString)
			}
			return
		}

		assertNever(value)
	}

	expireKey(key: string, seconds: number): void {
		this.clearExpired()
		const expireTime = Date.now() / 1000 + seconds
		const idx = this.stringPool.stringToIndex(key)
		if (idx === null || idx >= this.data.length) {
			throw new Error('Key does not exists')
		}
		const entry = this.data[idx]

		if (entry.expiry === null) {
			const heapIdx = this.heap.len
			entry.expiry = new Expiry(expireTime)
			this.heap.push(idx)
			this.siftUp(heapIdx)
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
			const top = this.heap.view[0]
			const expiry = this.data[top].expiry
			if (expiry === null) throw new Error('Implementation error')
			if (expiry.expireTime > currentTime) break

			const key = this.stringPool.indexToString(top)

			this.removeFromHeap(0)
			this.delete(key)
		}
	}

	setString(key: string, value: string): void {
		this.clearExpired()
		const entry = this.addEntry(key)
		this.delete(key)
		entry.value = this.stringPool.add(value)
	}

	getString(key: string): string {
		this.clearExpired()
		const entry = this.getEntry(key)
		const value = entry.value

		if (typeof value === 'number') {
			return this.stringPool.indexToString(value)
		}

		throw new Error('Key holds a value that is not a string')
	}

	pushArray(key: string, values: string[]): void {
		this.clearExpired()
		const entry = this.addEntry(key)
		const value = entry.value

		if (value !== null) {
			this.stringPool.delete(key)

			if (value instanceof NumberList) {
				for (const item of values) {
					value.push(this.stringPool.add(item))
				}
			} else {
				throw new Error('Key holds a value that is not a list')
			}

			return
		}

		entry.value = NumberList.empty()
		for (const item of values) {
			entry.value.push(this.stringPool.add(item))
		}
	}

	popArray(key: string): string | null {
		this.clearExpired()
		const entry = this.getEntry(key)
		const value = entry.value

		if (value instanceof NumberList) {
			const item = value.pop()
			if (item === null) return null
			const itemString = this.stringPool.indexToString(item)
			this.stringPool.delete(itemString)
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
				const item = value.view[i + start]
				result[i] = this.stringPool.indexToString(item)
			}
			return result
		}

		throw new Error('Key holds a value that is not a list')
	}

	private addSetItem(item: string, set: BitSet): void {
		const idx = this.stringPool.stringToIndex(item)
		if (idx === null) {
			set.add(this.stringPool.add(item))
		} else {
			if (!set.add(idx)) {
				this.stringPool.add(item)
			}
		}
	}

	addSet(key: string, values: string[]): void {
		this.clearExpired()
		const entry = this.addEntry(key)
		const value = entry.value

		if (value !== null) {
			this.stringPool.delete(key)

			if (value instanceof BitSet) {
				for (const item of values) {
					this.addSetItem(item, value)
				}
			} else {
				throw new Error('Key holds a value that is not a set')
			}

			return
		}

		entry.value = BitSet.empty()
		for (const item of values) {
			this.addSetItem(item, entry.value)
		}
	}

	removeSet(key: string, values: string[]): void {
		this.clearExpired()
		const entry = this.getEntry(key)
		const value = entry.value

		if (value instanceof BitSet) {
			for (const item of values) {
				const idx = this.stringPool.stringToIndex(item)
				if (idx !== null && value.delete(idx)) {
					this.stringPool.delete(item)
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
			result[i] = this.stringPool.indexToString(item)
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

	unionSet(keys: string[]): string[] {
		this.clearExpired()
		const sets = this.collectSets(keys)
		const items = BitSet.union(sets).items()
		return this.itemsToStrings(items)
	}

	intersectSet(keys: string[]): string[] {
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
				result.push(this.stringPool.indexToString(i))
			}
		}
		return result
	}

	ttl(key: string): number | null {
		this.clearExpired()
		const idx = this.stringPool.stringToIndex(key)
		if (idx === null || idx >= this.data.length) return null
		const entry = this.data[idx]
		const currentTime = Date.now() / 1000

		if (entry.expiry === null) return null
		return entry.expiry.expireTime - currentTime
	}

	serialize(): Serialized {
		const result: Serialized = {
			stringPool: this.stringPool.values,
			data: [],
		}

		for (const entry of this.data) {
			const value = entry.value
			const expireTime = entry.expiry?.expireTime

			if (value === null) {
				result.data.push({
					expireTime,
				})

				continue
			}

			if (typeof value === 'number') {
				result.data.push({
					value: {
						kind: 'string',
						data: value,
					},
					expireTime,
				})

				continue
			}

			if (value instanceof NumberList) {
				result.data.push({
					value: {
						kind: 'list',
						data: Array.from(value.view),
					},
					expireTime,
				})

				continue
			}

			if (value instanceof BitSet) {
				result.data.push({
					value: {
						kind: 'set',
						data: Array.from(value.items()),
					},
					expireTime,
				})

				continue
			}

			assertNever(value)
		}

		return result
	}

	static deserialize({ data, stringPool: stringpool }: Serialized): KVStore {
		const refcount = NumberList.zeros(stringpool.length)
		const entries = new Array<KVEntry>()

		for (let i = 0; i < data.length; ++i) {
			const { value, expireTime } = data[i]

			if (value !== undefined) {
				refcount.view[i] += 1

				let entry: KVEntry
				switch (value.kind) {
					case 'string':
						{
							entry = new KVEntry(value.data)
							refcount.view[value.data] += 1
						}
						break
					case 'list':
						{
							const list = NumberList.fromArray(value.data)
							for (const item of list.view) {
								refcount.view[item] += 1
							}
							entry = new KVEntry(list)
						}
						break
					case 'set':
						{
							const set = BitSet.empty()
							for (const item of value.data) {
								if (!set.add(item)) {
									refcount.view[item] += 1
								}
							}
							entry = new KVEntry(set)
						}
						break
					default:
						assertNever(value)
				}

				if (expireTime !== undefined) {
					entry.expiry = new Expiry(expireTime)
				}

				entries.push(entry)
			} else {
				entries.push(new KVEntry(null))
			}
		}

		const pool = new StringPool(stringpool, refcount)
		return new KVStore(pool, entries)
	}
}
