import NumberList from './number-list.ts'
import StringTable from './string-table.ts'
import BitSet from './bitset.ts'

import * as serialize from './serialize.ts'
import { assertNever } from './utils.ts'

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
	private stringTable = new StringTable()
	private data = new Array<KVEntry>()
	private heap = new NumberList()

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
		const val = this.heap.view()[idx]

		let p = (idx - 1) >> 1
		let pVal = this.heap.view()[p]
		while (idx > 0 && !this.heapCmp(pVal, val)) {
			this.heap.view()[idx] = pVal
			const expiry = this.data[pVal].expiry
			if (expiry === null) throw new Error('Implementation error')
			expiry.heapPosition = idx

			idx = p
			p = (idx - 1) >> 1
			pVal = this.heap.view()[p]
		}

		this.heap.view()[idx] = val
		const expiry = this.data[val].expiry
		if (expiry === null) throw new Error('Implementation error')
		expiry.heapPosition = idx
	}

	private siftDown(idx: number) {
		const val = this.heap.view()[idx]
		let childIdx = (idx << 1) | 1
		while (childIdx < this.heap.len) {
			let childVal = this.heap.view()[childIdx]
			if (childIdx + 1 < this.heap.len) {
				const otherVal = this.heap.view()[childIdx + 1]
				if (this.heapCmp(otherVal, childVal)) {
					childIdx += 1
					childVal = otherVal
				}
			}

			if (this.heapCmp(val, childVal)) break

			this.heap.view()[idx] = childVal
			const expiry = this.data[childVal].expiry
			if (expiry === null) throw new Error('Implementation error')
			expiry.heapPosition = idx

			idx = childIdx
			childIdx = (idx << 1) | 1
		}

		this.heap.view()[idx] = val
		const expiry = this.data[val].expiry
		if (expiry === null) throw new Error('Implementation error')
		expiry.heapPosition = idx
	}

	private removeFromHeap(heapPos: number): void {
		const itemToRemoveIdx = this.heap.view()[heapPos]
		const lastHeapItemIdx = this.heap.pop()

		if (lastHeapItemIdx === null) {
			throw new Error('Implementation error')
		}

		if (heapPos < this.heap.len) {
			this.heap.view()[heapPos] = lastHeapItemIdx
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
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) return

		const entry = this.data[idx]
		const value = entry.value
		if (value === null) return

		entry.value = null

		if (entry.expiry !== null) {
			this.removeFromHeap(entry.expiry.heapPosition)
		}

		this.stringTable.delete(key)
		if (typeof value === 'number') {
			const valueString = this.stringTable.indexToString(value)
			this.stringTable.delete(valueString)
			return
		}

		if (value instanceof NumberList) {
			for (const item of value.view()) {
				const itemString = this.stringTable.indexToString(item)
				this.stringTable.delete(itemString)
			}
			return
		}

		if (value instanceof BitSet) {
			for (const item of value.items()) {
				const itemString = this.stringTable.indexToString(item)
				this.stringTable.delete(itemString)
			}
			return
		}

		assertNever(value)
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
			const heapIdx = this.heap.len
			entry.expiry = new Expiry(expireTime, heapIdx)
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
			const top = this.heap.view()[0]
			const expiry = this.data[top].expiry
			if (expiry === null) throw new Error('Implementation error')
			if (expiry.expireTime > currentTime) break

			const key = this.stringTable.indexToString(top)

			this.removeFromHeap(0)
			this.delete(key)
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
			return this.stringTable.indexToString(value)
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
				const item = value.view()[i + start]
				result[i] = this.stringTable.indexToString(item)
			}
			return result
		}

		throw new Error('Key holds a value that is not a list')
	}

	private addSetItem(item: string, set: BitSet) {
		const idx = this.stringTable.stringToIndex(item)
		if (idx === null) {
			set.add(this.stringTable.add(item))
		} else {
			if (!set.add(idx)) {
				this.stringTable.add(item)
			}
		}
	}

	addSet(key: string, values: string[]): void {
		this.clearExpired()
		const entry = this.addEntry(key)
		const value = entry.value

		if (value !== null) {
			this.stringTable.delete(key)

			if (value instanceof BitSet) {
				for (const item of values) {
					this.addSetItem(item, value)
				}
			} else {
				throw new Error('Key holds a value that is not a set')
			}

			return
		}

		entry.value = new BitSet()
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
			result[i] = this.stringTable.indexToString(item)
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
				result.push(this.stringTable.indexToString(i))
			}
		}
		return result
	}

	ttl(key: string): number | null {
		this.clearExpired()
		const idx = this.stringTable.stringToIndex(key)
		if (idx === null || idx >= this.data.length) return null
		const entry = this.data[idx]
		const currentTime = Date.now() / 1000

		if (entry.expiry === null) return null
		return entry.expiry.expireTime - currentTime
	}

	serialize(): serialize.KVStore {
		const result: serialize.KVStore = {
			stringTable: this.stringTable.serialize(),
			data: [],
		}

		for (const entry of this.data) {
			const value = entry.value
			const expireTime = entry.expiry?.expireTime

			if (value === null) {
				result.data.push({
					value: null,
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
						data: Array.from(value.view()),
					},
					expireTime,
				})

				continue
			}

			if (value instanceof BitSet) {
				const data = value.items()

				result.data.push({
					value: {
						kind: 'set',
						data: Array.from(data),
					},
					expireTime,
				})

				continue
			}

			assertNever(value)
		}

		return result
	}

	static deserialize(data: serialize.KVStore): KVStore {
		const result = new KVStore()
		result.stringTable = StringTable.deserialize(data.stringTable)

		for (let i = 0; i < data.data.length; ++i) {
			const item = data.data[i]
			const value = item.value
			let entry: KVEntry
			switch (value?.kind) {
				case 'string':
					{
						entry = new KVEntry(value.data)
					}
					break
				case 'list':
					{
						const list = new NumberList(value.data)
						entry = new KVEntry(list)
					}
					break
				case 'set':
					{
						const set = new BitSet()
						for (const x of value.data) set.add(x)
						entry = new KVEntry(set)
					}
					break
				case undefined:
					{
						entry = new KVEntry(null)
					}
					break
				default:
					assertNever(value)
			}

			result.data.push(entry)

			if (item.expireTime !== undefined) {
				const heapIdx = result.heap.len
				entry.expiry = new Expiry(item.expireTime, heapIdx)
				result.heap.push(i)
				result.siftUp(heapIdx)
			}
		}

		return result
	}
}
