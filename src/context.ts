import KVStore from './kvstore.ts'

function tokenize(input: string): string[] {
	const tokens = new Array<string>()
	let currentToken = ''
	let quoteOpen = false
	let escaping = false
	let force = false

	for (const char of input) {
		if (escaping) {
			currentToken += char
			escaping = false
			continue
		}

		if (char === '\\') {
			escaping = true
			continue
		}

		if (char === '"') {
			quoteOpen = !quoteOpen
			force = true
			continue
		}

		if (' \t\n\r\x0b\x0c'.includes(char) && !quoteOpen) {
			if (currentToken.length > 0 || force) {
				tokens.push(currentToken)
				currentToken = ''
				force = false
			}
		} else {
			currentToken += char
		}
	}

	if (currentToken.length > 0 || force) {
		tokens.push(currentToken)
	}

	if (quoteOpen || escaping) {
		throw new Error('Unterminated string input')
	}

	return tokens
}

class ParamStream {
	private iterator: number = 0

	constructor(private readonly tokens: string[]) {}

	next(name: string): string {
		if (this.iterator >= this.tokens.length) {
			throw new Error(`Parameter '${name}' not provided`)
		}

		const param = this.tokens[this.iterator]
		this.iterator += 1

		return param
	}

	nextInt(name: string): number {
		const param = parseInt(this.next(name))
		if (isNaN(param)) {
			throw new Error(`Parameter '${name}' is not a number`)
		}

		return param
	}

	rest(): string[] {
		const result = this.tokens.slice(this.iterator)
		this.iterator = this.tokens.length
		return result
	}

	done(): void {
		if (this.iterator < this.tokens.length) {
			throw new Error('Too many arguments provided')
		}
	}
}

type QueryResult = {
	kind: 'info'
	message: string
} | {
	kind: 'error'
	message: string
} | {
	kind: 'result'
	data: string[]
}

export default abstract class Context {
	private store = new KVStore()

	abstract save(data: string): Promise<void>
	abstract load(): Promise<string>

	async executeQuery(query: string): Promise<QueryResult> {
		try {
			const tokens = tokenize(query)
			const stream = new ParamStream(tokens)

			const cmd = stream.next('command').toUpperCase()

			switch (cmd) {
				case 'SET': {
					const key = stream.next('key')
					const value = stream.next('value')
					stream.done()

					this.store.setString(key, value)
					return { kind: 'info', message: 'OK' }
				}
				case 'GET': {
					const key = stream.next('key')
					stream.done()

					const value = this.store.getString(key)
					return { kind: 'result', data: [value] }
				}
				case 'RPUSH': {
					const key = stream.next('key')
					const args = stream.rest()
					stream.done()

					this.store.pushArray(key, args)
					return { kind: 'info', message: 'OK' }
				}
				case 'RPOP': {
					const key = stream.next('key')
					stream.done()

					const result = this.store.popArray(key)
					if (result === null) {
						return { kind: 'result', data: [] }
					} else {
						return { kind: 'result', data: [result] }
					}
				}
				case 'LRANGE': {
					const key = stream.next('key')
					const start = stream.nextInt('start')
					const end = stream.nextInt('end')
					stream.done()

					const result = this.store.sliceArray(key, start, end)
					return { kind: 'result', data: result }
				}
				case 'SADD': {
					const key = stream.next('key')
					const args = stream.rest()
					stream.done()

					this.store.addSet(key, args)
					return { kind: 'info', message: 'OK' }
				}
				case 'SREM': {
					const key = stream.next('key')
					const args = stream.rest()
					stream.done()

					this.store.removeSet(key, args)
					return { kind: 'info', message: 'OK' }
				}
				case 'SMEMBERS': {
					const key = stream.next('key')
					stream.done()

					const result = this.store.getSet(key)
					return { kind: 'result', data: result }
				}
				case 'SINTER': {
					const params = stream.rest()
					stream.done()

					const result = this.store.intersectSet(params)
					return { kind: 'result', data: result }
				}
				case 'SUNION': {
					const params = stream.rest()
					stream.done()

					const result = this.store.unionSet(params)
					return { kind: 'result', data: result }
				}
				case 'KEYS': {
					stream.done()

					const result = this.store.keys()
					return { kind: 'result', data: result }
				}
				case 'DEL': {
					const key = stream.next('key')
					stream.done()

					this.store.delete(key)
					return { kind: 'info', message: 'OK' }
				}
				case 'EXPIRE': {
					const key = stream.next('key')
					const seconds = stream.nextInt('seconds')
					stream.done()

					this.store.expireKey(key, seconds)
					return { kind: 'info', message: 'OK' }
				}
				case 'TTL': {
					const key = stream.next('key')
					stream.done()

					const result = this.store.ttl(key)
					return { kind: 'result', data: [result.toFixed()] }
				}
				case 'SAVE': {
					stream.done()

					const data = this.store.serialize()
					await this.save(JSON.stringify(data))
					return { kind: 'info', message: 'OK' }
				}
				case 'RESTORE': {
					stream.done()

					const data = await this.load()
					this.store = KVStore.deserialize(JSON.parse(data))
					return { kind: 'info', message: 'OK' }
				}
				default: {
					return { kind: 'error', message: `Unsupported command: ${cmd}` }
				}
			}
		} catch (e: unknown) {
			if (e instanceof Error) {
				return {
					kind: 'error',
					message: e.message,
				}
			} else {
				return {
					kind: 'error',
					message: 'An unknown error occurred',
				}
			}
		}
	}
}
