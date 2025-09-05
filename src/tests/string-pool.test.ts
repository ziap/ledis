import { assertEquals, assertExists } from '@std/assert'

import StringPool from '../string-pool.ts'

Deno.test('StringPool - add new string', () => {
	const pool = new StringPool()
	const idx1 = pool.add('hello')
	assertEquals(idx1, 0)
	assertEquals(pool['index'].get('hello'), 0)
	assertEquals(pool.values[0], 'hello')
	assertEquals(pool['refcount'].view[0], 1)

	const idx2 = pool.add('world')
	assertEquals(idx2, 1)
	assertEquals(pool['index'].get('world'), 1)
	assertEquals(pool.values[1], 'world')
	assertEquals(pool['refcount'].view[1], 1)
})

Deno.test('StringPool - add existing string increments refcount', () => {
	const pool = new StringPool()
	const idx1 = pool.add('hello') // refcount = 1
	const _idx2 = pool.add('world') // refcount = 1
	const idx3 = pool.add('hello') // refcount = 2

	assertEquals(idx1, 0)
	assertEquals(idx3, 0) // Should return the same index
	assertEquals(pool.values[0], 'hello')
	assertEquals(pool['refcount'].view[0], 2)

	assertEquals(pool.values[1], 'world')
	assertEquals(pool['refcount'].view[1], 1)
})

Deno.test('StringPool - stringToIndex and indexToString', () => {
	const pool = new StringPool()
	pool.add('apple') // idx 0
	pool.add('banana') // idx 1
	pool.add('apple') // idx 0, refcount 2

	assertEquals(pool.stringToIndex('apple'), 0)
	assertEquals(pool.stringToIndex('banana'), 1)
	assertEquals(pool.stringToIndex('orange'), null) // Non-existent string

	assertEquals(pool.indexToString(0), 'apple')
	assertEquals(pool.indexToString(1), 'banana')
})

Deno.test('StringPool - delete string decrements refcount', () => {
	const pool = new StringPool()
	pool.add('test') // idx 0, refcount 1
	pool.add('test') // idx 0, refcount 2

	pool.delete('test') // refcount becomes 1
	assertEquals(pool.values[0], 'test')
	assertEquals(pool['refcount'].view[0], 1)
	assertExists(pool['index'].get('test')) // Still in index

	pool.delete('test') // refcount becomes 0
	assertEquals(pool.values[0], '')
	assertEquals(pool['refcount'].view[0], 0)
	assertEquals(pool['index'].get('test'), undefined) // Removed from index map
	assertEquals(pool['freeIndices'].pop(), 0) // Index 0 should be freed
})

Deno.test('StringPool - delete non-existent string does nothing', () => {
	const pool = new StringPool()
	pool.add('existing')
	pool.delete('non-existent') // Should not throw error
	assertEquals(pool['index'].size, 1) // No change
})

Deno.test('StringPool - reuse freed indices', () => {
	const pool = new StringPool()
	const _idxHello = pool.add('hello') // 0
	const _idxWorld = pool.add('world') // 1
	pool.add('hello') // 0 (refcount 2)

	pool.delete('world') // Free index 1
	assertEquals(pool['freeIndices'].pop(), 1) // Confirm 1 is freed
	pool['freeIndices'].push(1) // Put it back for the next add

	const idxDeno = pool.add('deno') // Should reuse index 1
	assertEquals(idxDeno, 1)
	assertEquals(pool.stringToIndex('deno'), 1)
	assertEquals(pool.values[1], 'deno')
	assertEquals(pool['refcount'].view[1], 1)
	assertEquals(pool['freeIndices'].len, 0) // Free list should be empty

	// Verify 'hello' is still there

	assertEquals(pool.stringToIndex('hello'), 0)
	assertEquals(pool.values[0], 'hello')
	assertEquals(pool['refcount'].view[0], 2)
})

Deno.test('StringPool - complex add/delete/reuse scenario', () => {
	const pool = new StringPool()

	// Add initial strings
	assertEquals(pool.add('a'), 0) // refcount 1
	assertEquals(pool.add('b'), 1) // refcount 1
	assertEquals(pool.add('c'), 2) // refcount 1
	assertEquals(pool.add('a'), 0) // refcount 2
	assertEquals(pool.add('b'), 1) // refcount 2

	// Delete 'c'
	pool.delete('c') // refcount 0 for 'c', index 2 freed
	assertEquals(pool.stringToIndex('c'), null)
	assertEquals(pool['freeIndices'].pop(), 2)
	pool['freeIndices'].push(2) // Push back for next op

	// Add 'd' - should reuse index 2
	assertEquals(pool.add('d'), 2) // refcount 1
	assertEquals(pool.stringToIndex('d'), 2)

	assertEquals(pool.values[2], 'd')
	assertEquals(pool['refcount'].view[2], 1)

	// Delete 'b' twice
	pool.delete('b') // refcount 1 for 'b'
	pool.delete('b') // refcount 0 for 'b', index 1 freed
	assertEquals(pool.stringToIndex('b'), null)
	assertEquals(pool['freeIndices'].pop(), 1)
	pool['freeIndices'].push(1) // Push back for next op

	// Add 'e' - should reuse index 1
	assertEquals(pool.add('e'), 1) // refcount 1
	assertEquals(pool.stringToIndex('e'), 1)

	assertEquals(pool.values[1], 'e')
	assertEquals(pool['refcount'].view[1], 1)

	// Delete 'a' twice
	pool.delete('a') // refcount 1 for 'a'
	pool.delete('a') // refcount 0 for 'a', index 0 freed
	assertEquals(pool.stringToIndex('a'), null)
	assertEquals(pool['freeIndices'].pop(), 0)
	pool['freeIndices'].push(0) // Push back for next op

	// Add 'f' - should reuse index 0
	assertEquals(pool.add('f'), 0) // refcount 1
	assertEquals(pool.stringToIndex('f'), 0)
	assertEquals(pool.values[0], 'f')
	assertEquals(pool['refcount'].view[0], 1)

	// Final state checks
	assertEquals(pool.stringToIndex('f'), 0)
	assertEquals(pool.stringToIndex('e'), 1)
	assertEquals(pool.stringToIndex('d'), 2)
	assertEquals(pool.stringToIndex('a'), null)
	assertEquals(pool.stringToIndex('b'), null)
	assertEquals(pool.stringToIndex('c'), null)

	assertEquals(pool.indexToString(0), 'f')
	assertEquals(pool.indexToString(1), 'e')
	assertEquals(pool.indexToString(2), 'd')
	assertEquals(pool['freeIndices'].len, 0)
})
