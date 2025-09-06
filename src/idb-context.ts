/// <reference lib="dom" />

import Context from './context.ts'

export default class IDBContext extends Context {
	private constructor(private db: IDBDatabase) {
		super()
	}

	private static idbStore = 'object-store'
	private static idbKey = 'snapshot'

	static new(): Promise<IDBContext> {
		return new Promise((resolve, reject) => {
			const openRequest = indexedDB.open('ledis-store', 1)

			openRequest.addEventListener('upgradeneeded', () => {
				const db = openRequest.result
				if (!db.objectStoreNames.contains(IDBContext.idbStore)) {
					db.createObjectStore(IDBContext.idbStore)
				}
			})

			openRequest.addEventListener('success', () => {
				resolve(new IDBContext(openRequest.result))
			})

			openRequest.addEventListener('error', () => reject(openRequest.error))
			openRequest.addEventListener('blocked', () => {
				reject(new Error('IndexedDB open blocked'))
			})
		})
	}

	load(): Promise<string> {
		const read = this.db.transaction(IDBContext.idbStore, 'readonly')
		const readStore = read.objectStore(IDBContext.idbStore)
		const request = readStore.get(IDBContext.idbKey)

		return new Promise((resolve, reject) => {
			request.addEventListener('success', () => {
				const result = request.result
				if (typeof result !== 'string') {
					reject(new TypeError('Stored snapshot is not of type string'))
				} else {
					resolve(result)
				}
			})

			request.addEventListener('error', () => reject(request.error))
		})
	}

	save(data: string): Promise<void> {
		const write = this.db.transaction(IDBContext.idbStore, 'readwrite')
		const writeStore = write.objectStore(IDBContext.idbStore)
		const request = writeStore.put(data, IDBContext.idbKey)

		return new Promise((resolve, reject) => {
			request.addEventListener('success', () => resolve())
			request.addEventListener('error', () => reject(request.error))
		})
	}
}
