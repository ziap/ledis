import { assertEquals, assertExists, assertObjectMatch } from '@std/assert'

import StringTable from '../string-table.ts'

Deno.test('StringTable - add new string', () => {
	const table = new StringTable()
	const idx1 = table.add('hello')
	assertEquals(idx1, 0)
	assertEquals(table.index.get('hello'), 0)
	assertObjectMatch(table.values[0], { value: 'hello', refcount: 1 })

	const idx2 = table.add('world')
	assertEquals(idx2, 1)
	assertEquals(table.index.get('world'), 1)
	assertObjectMatch(table.values[1], { value: 'world', refcount: 1 })
})

Deno.test('StringTable - add existing string increments refcount', () => {
	const table = new StringTable()
	const idx1 = table.add('hello') // refcount = 1
	const _idx2 = table.add('world') // refcount = 1
	const idx3 = table.add('hello') // refcount = 2

	assertEquals(idx1, 0)
	assertEquals(idx3, 0) // Should return the same index
	assertObjectMatch(table.values[0], { value: 'hello', refcount: 2 })
	assertObjectMatch(table.values[1], { value: 'world', refcount: 1 })
})

Deno.test('StringTable - stringToIndex and indexToString', () => {
	const table = new StringTable()
	table.add('apple') // idx 0
	table.add('banana') // idx 1
	table.add('apple') // idx 0, refcount 2

	assertEquals(table.stringToIndex('apple'), 0)
	assertEquals(table.stringToIndex('banana'), 1)
	assertEquals(table.stringToIndex('orange'), null) // Non-existent string

	assertEquals(table.indexToString(0), 'apple')
	assertEquals(table.indexToString(1), 'banana')
	assertEquals(table.indexToString(99), null)
})

Deno.test('StringTable - delete string decrements refcount', () => {
	const table = new StringTable()
	table.add('test') // idx 0, refcount 1
	table.add('test') // idx 0, refcount 2

	table.delete('test') // refcount becomes 1
	assertObjectMatch(table.values[0], { value: 'test', refcount: 1 })
	assertExists(table.index.get('test')) // Still in index

	table.delete('test') // refcount becomes 0
	assertObjectMatch(table.values[0], { value: '', refcount: 0 }) // Entry object still exists
	assertEquals(table.index.get('test'), undefined) // Removed from index map
	assertEquals(table.freeIndices.pop(), 0) // Index 0 should be freed
})

Deno.test('StringTable - delete non-existent string does nothing', () => {
	const table = new StringTable()
	table.add('existing')
	table.delete('non-existent') // Should not throw error
	assertEquals(table.index.size, 1) // No change
})

Deno.test('StringTable - reuse freed indices', () => {
	const table = new StringTable()
	const _idx_hello = table.add('hello') // 0
	const _idx_world = table.add('world') // 1
	table.add('hello') // 0 (refcount 2)

	table.delete('world') // Free index 1
	assertEquals(table.freeIndices.pop(), 1) // Confirm 1 is freed
	table.freeIndices.push(1) // Put it back for the next add

	const idx_deno = table.add('deno') // Should reuse index 1
	assertEquals(idx_deno, 1)
	assertEquals(table.stringToIndex('deno'), 1)
	assertObjectMatch(table.values[1], { value: 'deno', refcount: 1 })
	assertEquals(table.freeIndices.len, 0) // Free list should be empty

	// Verify 'hello' is still there
	assertEquals(table.stringToIndex('hello'), 0)
	assertObjectMatch(table.values[0], { value: 'hello', refcount: 2 })
})

Deno.test('StringTable - complex add/delete/reuse scenario', () => {
	const table = new StringTable()

	// Add initial strings
	assertEquals(table.add('a'), 0) // refcount 1
	assertEquals(table.add('b'), 1) // refcount 1
	assertEquals(table.add('c'), 2) // refcount 1
	assertEquals(table.add('a'), 0) // refcount 2
	assertEquals(table.add('b'), 1) // refcount 2

	// Delete 'c'
	table.delete('c') // refcount 0 for 'c', index 2 freed
	assertEquals(table.stringToIndex('c'), null)
	assertEquals(table.freeIndices.pop(), 2)
	table.freeIndices.push(2) // Push back for next op

	// Add 'd' - should reuse index 2
	assertEquals(table.add('d'), 2) // refcount 1
	assertEquals(table.stringToIndex('d'), 2)
	assertObjectMatch(table.values[2], { value: 'd', refcount: 1 })

	// Delete 'b' twice
	table.delete('b') // refcount 1 for 'b'
	table.delete('b') // refcount 0 for 'b', index 1 freed
	assertEquals(table.stringToIndex('b'), null)
	assertEquals(table.freeIndices.pop(), 1)
	table.freeIndices.push(1) // Push back for next op

	// Add 'e' - should reuse index 1
	assertEquals(table.add('e'), 1) // refcount 1
	assertEquals(table.stringToIndex('e'), 1)
	assertObjectMatch(table.values[1], { value: 'e', refcount: 1 })

	// Delete 'a' twice
	table.delete('a') // refcount 1 for 'a'
	table.delete('a') // refcount 0 for 'a', index 0 freed
	assertEquals(table.stringToIndex('a'), null)
	assertEquals(table.freeIndices.pop(), 0)
	table.freeIndices.push(0) // Push back for next op

	// Add 'f' - should reuse index 0
	assertEquals(table.add('f'), 0) // refcount 1
	assertEquals(table.stringToIndex('f'), 0)
	assertObjectMatch(table.values[0], { value: 'f', refcount: 1 })

	// Final state checks
	assertEquals(table.stringToIndex('f'), 0)
	assertEquals(table.stringToIndex('e'), 1)
	assertEquals(table.stringToIndex('d'), 2)
	assertEquals(table.stringToIndex('a'), null)
	assertEquals(table.stringToIndex('b'), null)
	assertEquals(table.stringToIndex('c'), null)

	assertEquals(table.indexToString(0), 'f')
	assertEquals(table.indexToString(1), 'e')
	assertEquals(table.indexToString(2), 'd')
	assertEquals(table.freeIndices.len, 0)
})
