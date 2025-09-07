import { assert, assertEquals } from '@std/assert'
import { delay } from '@std/async/delay'
import Context from '../context.ts' // Assuming the module to test is in the same directory.

/**
 * A concrete implementation of the abstract Context class for testing purposes.
 * This mock allows us to intercept the saved data and preload data for restoration.
 */
class TestContext extends Context {
	public savedData: string | null = null

	save(data: string): Promise<void> {
		this.savedData = data
		return Promise.resolve()
	}

	load(): Promise<string> {
		if (this.savedData === null) {
			return Promise.reject(new Error('No data has been saved to this context'))
		}
		return Promise.resolve(this.savedData)
	}
}

Deno.test('executeQuery - indirectly tests tokenizer with valid SET/GET commands', async () => {
	const ctx = new TestContext()

	// handles basic commands with multiple spaces
	await ctx.executeQuery('SET   key1   value1')
	let result = await ctx.executeQuery('  GET   key1  ')
	assertEquals(result, { kind: 'result', data: ['value1'] })

	// handles values with spaces using quotes
	await ctx.executeQuery('SET key2 "hello world"')
	result = await ctx.executeQuery('GET key2')
	assertEquals(result, { kind: 'result', data: ['hello world'] })

	await ctx.executeQuery('SET "my key" "my value"')
	result = await ctx.executeQuery('GET "my key"')
	assertEquals(result, { kind: 'result', data: ['my value'] })

	// handles empty string values
	await ctx.executeQuery('SET emptykey ""')
	result = await ctx.executeQuery('GET emptykey')
	assertEquals(result, { kind: 'result', data: [''] })

	// handles quoted values with leading and trailing spaces
	await ctx.executeQuery('SET paddedkey "  padded value  "')
	result = await ctx.executeQuery('GET paddedkey')
	assertEquals(result, { kind: 'result', data: ['  padded value  '] })

	// handles escaped quotes within a quoted value
	await ctx.executeQuery('SET quote "He said \\"Hello!\\""')
	result = await ctx.executeQuery('GET quote')
	assertEquals(result, { kind: 'result', data: ['He said "Hello!"'] })

	// handles escaped backslashes
	await ctx.executeQuery('SET path "C:\\\\Users\\\\Test"')
	result = await ctx.executeQuery('GET path')
	assertEquals(result, { kind: 'result', data: ['C:\\Users\\Test'] })
})

Deno.test('executeQuery - indirectly tests tokenizer error handling', async () => {
	const ctx = new TestContext()

	// fails on an unterminated quoted string
	let result = await ctx.executeQuery('SET key "this string never ends')
	assertEquals(result, {
		kind: 'error',
		message: 'Unterminated string input',
	})

	// fails on a trailing escape character
	result = await ctx.executeQuery('SET key some-value\\')
	assertEquals(result, {
		kind: 'error',
		message: 'Unterminated string input',
	})

	// fails on an unterminated quote with a trailing escape
	result = await ctx.executeQuery('SET key "end with escape\\')
	assertEquals(result, {
		kind: 'error',
		message: 'Unterminated string input',
	})
})

Deno.test('executeQuery - handles too many arguments', async () => {
	const ctx = new TestContext()

	// Setup a key for commands that need one
	await ctx.executeQuery('SET mykey myvalue')
	await ctx.executeQuery('RPUSH mylist myvalue')
	await ctx.executeQuery('SADD myset myvalue')

	const commands = [
		'SET mykey myvalue extra',
		'GET mykey extra',
		'RPOP mylist extra',
		'LRANGE mylist 0 1 extra',
		'SMEMBERS myset extra',
		'KEYS extra',
		'DEL mykey extra',
		'EXPIRE mykey 10 extra',
		'TTL mykey extra',
		'SAVE extra',
		'RESTORE extra',
	]

	for (const query of commands) {
		const result = await ctx.executeQuery(query)
		assertEquals(result, {
			kind: 'error',
			message: 'Too many arguments provided',
		})
	}
})

// Test suite for the main executeQuery method
Deno.test('executeQuery - basic error handling', async () => {
	const ctx = new TestContext()

	// Empty query
	let result = await ctx.executeQuery('')
	assertEquals(result, {
		kind: 'error',
		message: "Parameter 'command' not provided",
	})

	// Unsupported command
	result = await ctx.executeQuery('NONEXISTENT_COMMAND arg1')
	assertEquals(result, {
		kind: 'error',
		message: 'Unsupported command: NONEXISTENT_COMMAND',
	})
})

Deno.test('executeQuery - SET and GET commands', async () => {
	const ctx = new TestContext()

	// Set and get a simple key-value pair
	let result = await ctx.executeQuery('SET mykey myvalue')
	assertEquals(result, { kind: 'info', message: 'OK' })

	result = await ctx.executeQuery('GET mykey')
	assertEquals(result, { kind: 'result', data: ['myvalue'] })

	// Overwrite an existing key
	result = await ctx.executeQuery('SET mykey "a new value"')
	assertEquals(result, { kind: 'info', message: 'OK' })

	result = await ctx.executeQuery('GET mykey')
	assertEquals(result, { kind: 'result', data: ['a new value'] })

	// Test missing parameters
	result = await ctx.executeQuery('SET mykey')
	assertEquals(result, {
		kind: 'error',
		message: "Parameter 'value' not provided",
	})

	result = await ctx.executeQuery('GET')
	assertEquals(result, {
		kind: 'error',
		message: "Parameter 'key' not provided",
	})

	// Test getting a non-existent key
	result = await ctx.executeQuery('GET nonkey')
	assertEquals(result, { kind: 'error', message: 'Key does not exists' })
})

Deno.test('executeQuery - list commands (RPUSH, RPOP, LRANGE)', async () => {
	const ctx = new TestContext()

	await ctx.executeQuery('RPUSH mylist a b c')
	let result = await ctx.executeQuery('LRANGE mylist 0 2')
	assertEquals(result, { kind: 'result', data: ['a', 'b', 'c'] })

	// Get a sub-range
	result = await ctx.executeQuery('LRANGE mylist 1 2')
	assertEquals(result, { kind: 'result', data: ['b', 'c'] })

	// Pop from the right
	result = await ctx.executeQuery('RPOP mylist')
	assertEquals(result, { kind: 'result', data: ['c'] })
	result = await ctx.executeQuery('RPOP mylist')
	assertEquals(result, { kind: 'result', data: ['b'] })

	// Push again and check state
	await ctx.executeQuery('RPUSH mylist d')
	result = await ctx.executeQuery('LRANGE mylist 0 1')
	assertEquals(result, { kind: 'result', data: ['a', 'd'] })

	// Pop until empty
	await ctx.executeQuery('RPOP mylist') // pops 'd'
	await ctx.executeQuery('RPOP mylist') // pops 'a'
	result = await ctx.executeQuery('RPOP mylist')
	assertEquals(result, { kind: 'result', data: [] })

	// Test parameter and bounds errors for LRANGE
	result = await ctx.executeQuery('LRANGE mylist 0')
	assertEquals(result, {
		kind: 'error',
		message: "Parameter 'end' not provided",
	})

	result = await ctx.executeQuery('LRANGE mylist a 2')
	assertEquals(result, {
		kind: 'error',
		message: "Parameter 'start' is not a number",
	})

	await ctx.executeQuery('RPUSH anotherlist x y')
	result = await ctx.executeQuery('LRANGE anotherlist 0 2')
	assertEquals(result, { kind: 'error', message: 'Index out of bound' })
})

Deno.test('executeQuery - set commands (SADD, SREM, SMEMBERS)', async () => {
	const ctx = new TestContext()

	await ctx.executeQuery('SADD myset a b c')
	let result = await ctx.executeQuery('SMEMBERS myset')
	// Sets are unordered, so sort the result for stable comparison
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['a', 'b', 'c'] })

	// Add existing and new members
	await ctx.executeQuery('SADD myset c d')
	result = await ctx.executeQuery('SMEMBERS myset')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['a', 'b', 'c', 'd'] })

	// Remove members, including a non-existent one
	await ctx.executeQuery('SREM myset b d e') // 'e' does not exist
	result = await ctx.executeQuery('SMEMBERS myset')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['a', 'c'] })
})

Deno.test('executeQuery - set operations (SINTER, SUNION)', async () => {
	const ctx = new TestContext()
	await ctx.executeQuery('SADD set1 a b c d')
	await ctx.executeQuery('SADD set2 c d e f')
	await ctx.executeQuery('SADD set3 d g')

	// Test intersection
	let result = await ctx.executeQuery('SINTER set1 set2')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['c', 'd'] })

	// Test intersection with multiple sets
	result = await ctx.executeQuery('SINTER set1 set2 set3')
	assertEquals(result, { kind: 'result', data: ['d'] })

	// Test union
	result = await ctx.executeQuery('SUNION set1 set2')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['a', 'b', 'c', 'd', 'e', 'f'] })

	// Test type error
	await ctx.executeQuery('SET notaset "hello"')
	result = await ctx.executeQuery('SINTER set1 notaset')
	assertEquals(result, {
		kind: 'error',
		message: "Key 'notaset' holds a value that is not a set",
	})
})

Deno.test('executeQuery - general commands (KEYS, DEL)', async () => {
	const ctx = new TestContext()
	let result = await ctx.executeQuery('KEYS')
	assertEquals(result, { kind: 'result', data: [] }) // Initially empty

	await ctx.executeQuery('SET key1 val1')
	await ctx.executeQuery('RPUSH list1 a')
	await ctx.executeQuery('SADD set1 x')

	result = await ctx.executeQuery('KEYS')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['key1', 'list1', 'set1'] })

	// Delete a key and check again
	await ctx.executeQuery('DEL list1')
	result = await ctx.executeQuery('KEYS')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['key1', 'set1'] })

	// Deleting a non-existent key should be successful
	result = await ctx.executeQuery('DEL non-existent')
	assertEquals(result, { kind: 'info', message: 'OK' })
})

Deno.test('executeQuery - expiration commands (EXPIRE, TTL)', async () => {
	const ctx = new TestContext()
	await ctx.executeQuery('SET mykey "hello"')

	// TTL on a key without an expiry should be -1
	let result = await ctx.executeQuery('TTL mykey')
	assertEquals(result.kind, 'result')
	if (result.kind === 'result') assertEquals(parseInt(result.data[0]), -1)

	// TTL on a non-existent key should be -2
	result = await ctx.executeQuery('TTL nonkey')
	assertEquals(result.kind, 'result')
	if (result.kind === 'result') assertEquals(parseInt(result.data[0]), -2)

	// Set an expiry
	await ctx.executeQuery('EXPIRE mykey 1')
	result = await ctx.executeQuery('TTL mykey')
	assertEquals(result.kind, 'result')
	if (result.kind === 'result') {
		const ttl = parseFloat(result.data[0])
		assert(ttl > 0 && ttl <= 1, `TTL should be between 0 and 1, but was ${ttl}`)
	}

	// Wait for the key to expire
	await delay(1100)

	// Verify the key is gone
	result = await ctx.executeQuery('GET mykey')
	assertEquals(result, { kind: 'error', message: 'Key does not exists' })
	result = await ctx.executeQuery('KEYS')
	assertEquals(result, { kind: 'result', data: [] })
})

Deno.test('executeQuery - SAVE and RESTORE commands', async () => {
	const ctx1 = new TestContext()
	await ctx1.executeQuery('SET key1 "value 1"')
	await ctx1.executeQuery('RPUSH list1 a b')
	await ctx1.executeQuery('SADD set1 x y')
	await ctx1.executeQuery('EXPIRE list1 100') // Test expiry serialization

	const saveResult = await ctx1.executeQuery('SAVE')
	assertEquals(saveResult, { kind: 'info', message: 'OK' })
	assert(ctx1.savedData !== null, 'Save command did not populate savedData')

	// Simulate restoring into a new instance
	const ctx2 = new TestContext()
	ctx2.savedData = ctx1.savedData // Manually provide the saved data

	const restoreResult = await ctx2.executeQuery('RESTORE')
	assertEquals(restoreResult, { kind: 'info', message: 'OK' })

	// Verify data in the new context
	let result = await ctx2.executeQuery('GET key1')
	assertEquals(result, { kind: 'result', data: ['value 1'] })

	result = await ctx2.executeQuery('LRANGE list1 0 1')
	assertEquals(result, { kind: 'result', data: ['a', 'b'] })

	result = await ctx2.executeQuery('SMEMBERS set1')
	if (result.kind === 'result') result.data.sort()
	assertEquals(result, { kind: 'result', data: ['x', 'y'] })

	// Verify expiry was restored
	result = await ctx2.executeQuery('TTL list1')
	assertEquals(result.kind, 'result')
	if (result.kind === 'result') {
		const ttl = parseFloat(result.data[0])
		assert(
			ttl > 98 && ttl <= 100,
			`Restored TTL should be ~100s, but was ${ttl}`,
		)
	}
})

Deno.test('executeQuery - handles type errors for commands', async () => {
	const ctx = new TestContext()
	await ctx.executeQuery('SET stringkey "i am a string"')
	await ctx.executeQuery('RPUSH listkey "i am in a list"')

	// Trying list operations on a string
	let result = await ctx.executeQuery('RPOP stringkey')
	assertEquals(result, {
		kind: 'error',
		message: 'Key holds a value that is not a list',
	})

	// Trying string operations on a list
	result = await ctx.executeQuery('GET listkey')
	assertEquals(result, {
		kind: 'error',
		message: 'Key holds a value that is not a string',
	})

	// Trying set operations on a string
	result = await ctx.executeQuery('SMEMBERS stringkey')
	assertEquals(result, {
		kind: 'error',
		message: 'Key holds a value that is not a set',
	})
})
