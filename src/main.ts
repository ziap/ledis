// import StringTable from './string-table.ts'
//
// class KVEntry {
// 	constructor(
// 		public value: number,
// 		public expireTime: number,
// 	) {}
// }
//
// const EMPTY = (-1) >>> 0
//
// class KVStore {
// 	stringTable = new StringTable()
// 	capacityBits = 5
// 	capacity = 1 << this.capacityBits
// 	maxEntries = (this.capacity * 3) >> 2
// 	liveEntries = 0
//
// 	keys = new Uint32Array(this.capacity).fill(EMPTY)
// 	entries = Array.from<KVEntry, KVEntry>(
// 		{ length: this.capacity },
// 		() => new KVEntry(EMPTY, 0),
// 	)
//
// 	hash(stringTableIndex: number): number {
// 		const shift = 32 - this.capacityBits
// 		return Math.imul(stringTableIndex, 0x93d765dd) >>> shift
// 	}
// }
