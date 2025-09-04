type StringTableEntry = {
	value: string
	refcount: number
} | null

export type StringTable = StringTableEntry[]

type KVEntry = {
	value: {
		kind: 'string'
		data: number
	} | {
		kind: 'list'
		data: number[]
	} | {
		kind: 'set'
		data: number[]
	} | null
	expireTime?: number
}

export type KVStore = {
	stringTable: StringTable
	data: KVEntry[]
}
