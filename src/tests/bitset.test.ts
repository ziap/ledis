import { assertEquals, assertNotEquals } from '@std/assert'
import BitSet from '../bitset.ts'

Deno.test('BitSet: constructor initializes correctly', () => {
	const bs = BitSet.empty()
	assertEquals(bs['data'].length, 4) // Accessing private property for test
	assertEquals(Array.from(bs['data']), new Array(4).fill(0))

	// Bypass private constructor to construct with some initial data
	const initialData = new Uint32Array([1, 2, 4])

	const B = BitSet as unknown as { new (data: Uint32Array): BitSet }
	const bs2 = new B(initialData)
	assertEquals(bs2['data'].length, 3)
	assertEquals(Array.from(bs2['data']), [1, 2, 4])
})

Deno.test('BitSet: add works for various values', () => {
	const bs = BitSet.empty()

	// Add a small value
	bs.add(0)
	assertEquals(bs['data'][0], 1) // 1 << 0
	assertEquals(bs.count(), 1)

	// Add another value in the same word
	bs.add(5)
	assertEquals(bs['data'][0], 1 | (1 << 5)) // 1 | 32 = 33
	assertEquals(bs.count(), 2)

	// Add a value in the next word (index 1)
	bs.add(32) // 32 >> 5 = 1, 32 & 31 = 0
	assertEquals(bs['data'][1], 1) // 1 << 0
	assertEquals(bs.count(), 3)

	// Add a value that causes growth
	bs.add(1023) // (1023 >> 5) = 31. This is the last bit in the 32nd word (index 31).
	assertEquals(bs['data'].length, 32) // Should not have grown yet
	assertEquals(bs['data'][31], (1 << 31) >>> 0)
	assertEquals(bs.count(), 4)

	// Add a value beyond current capacity to trigger growth
	bs.add(1024) // (1024 >> 5) = 32. This needs a new word (index 32).
	assertNotEquals(bs['data'].length, 32) // Should have grown
	assertEquals(bs['data'][32], 1)
	assertEquals(bs.count(), 5)
	// Test the new size based on growth logic
	// Original was 32. New idx is 32.
	// 32 - Math.clz32(32) = 32 - 26 = 6. 1 << 6 = 64.
	assertEquals(bs['data'].length, 64)

	// Add a duplicate value, count should not change
	const initialCount = bs.count()
	bs.add(5)
	assertEquals(bs.count(), initialCount)
})

Deno.test('BitSet: delete works for various values', () => {
	const bs = BitSet.empty()
	bs.add(0)
	bs.add(5)
	bs.add(32)
	bs.add(1024) // Ensures capacity for idx 32

	assertEquals(bs.count(), 4)

	// Delete an existing value
	assertEquals(bs.delete(5), true)
	assertEquals(bs['data'][0], 1) // Only bit 0 remains
	assertEquals(bs.count(), 3)

	// Delete a non-existent value (should do nothing)
	assertEquals(bs.delete(10), false)
	assertEquals(bs.count(), 3)

	// Delete a value from a word that doesn't exist yet (beyond capacity)
	assertEquals(bs.delete(2000), false) // idx = 2000 >> 5 = 62. Current array length is 64. So this is within bounds
	assertEquals(bs.count(), 3)

	// Delete the last remaining bit in a word
	assertEquals(bs.delete(0), true)
	assertEquals(bs['data'][0], 0)
	assertEquals(bs.count(), 2)

	// Delete a value that would be in an index beyond the current data array length
	const initialLength = bs['data'].length
	assertEquals(bs.delete(initialLength * 32 + 5), false) // Some value far beyond current capacity
	assertEquals(bs['data'].length, initialLength) // Should not change length or throw
})

Deno.test('BitSet: count returns correct number of set bits', () => {
	const bs = BitSet.empty()
	assertEquals(bs.count(), 0)

	bs.add(0)
	assertEquals(bs.count(), 1)

	bs.add(1)
	bs.add(2)
	bs.add(3)
	assertEquals(bs.count(), 4) // 0, 1, 2, 3

	bs.delete(1)
	assertEquals(bs.count(), 3) // 0, 2, 3

	bs.add(31) // In same word
	assertEquals(bs.count(), 4)

	bs.add(32) // In next word
	assertEquals(bs.count(), 5)

	bs.add(100)
	assertEquals(bs.count(), 6)

	// Clear all bits and check count
	bs.delete(0)
	bs.delete(2)
	bs.delete(3)
	bs.delete(31)
	bs.delete(32)
	bs.delete(100)
	assertEquals(bs.count(), 0)
})

Deno.test('BitSet: items returns all set bits in order', () => {
	const bs = BitSet.empty()
	assertEquals(Array.from(bs.items()), [])

	bs.add(1)
	assertEquals(Array.from(bs.items()), [1])

	bs.add(5)
	bs.add(0)
	bs.add(33)
	bs.add(32)
	bs.add(100)
	assertEquals(Array.from(bs.items()), [0, 1, 5, 32, 33, 100])

	bs.delete(32)
	bs.delete(0)
	assertEquals(Array.from(bs.items()), [1, 5, 33, 100])
})

Deno.test('BitSet: static union combines multiple sets', () => {
	const bs1 = BitSet.empty()
	bs1.add(0)
	bs1.add(1)
	bs1.add(5)

	const bs2 = BitSet.empty()
	bs2.add(1)
	bs2.add(3)
	bs2.add(32)

	const bs3 = BitSet.empty()
	bs3.add(5)
	bs3.add(33)
	bs3.add(64)

	const emptySet = BitSet.empty()

	// Union with empty array
	let result = BitSet.union([])
	assertEquals(Array.from(result.items()), [])
	assertEquals(result.count(), 0)

	// Union with single set
	result = BitSet.union([bs1])
	assertEquals(Array.from(result.items()), [0, 1, 5])
	assertEquals(result.count(), 3)

	// Union of two sets
	result = BitSet.union([bs1, bs2])
	assertEquals(Array.from(result.items()), [0, 1, 3, 5, 32])
	assertEquals(result.count(), 5)

	// Union of multiple sets, including an empty one
	result = BitSet.union([bs1, bs2, bs3, emptySet])
	assertEquals(Array.from(result.items()), [0, 1, 3, 5, 32, 33, 64])
	assertEquals(result.count(), 7)
})

Deno.test('BitSet: static intersect finds common bits in multiple sets', () => {
	const bs1 = BitSet.empty()
	bs1.add(0)
	bs1.add(1)
	bs1.add(5)
	bs1.add(32)
	bs1.add(33)

	const bs2 = BitSet.empty()
	bs2.add(1)
	bs2.add(3)
	bs2.add(5)
	bs2.add(33)
	bs2.add(64)

	const bs3 = BitSet.empty()
	bs3.add(1)
	bs3.add(5)
	bs3.add(33)
	bs3.add(100)

	const emptySet = BitSet.empty()

	// Intersect with empty array
	let result = BitSet.intersect([])
	assertEquals(Array.from(result.items()), [])
	assertEquals(result.count(), 0)

	// Intersect with single set
	result = BitSet.intersect([bs1])
	assertEquals(Array.from(result.items()), [0, 1, 5, 32, 33])
	assertEquals(result.count(), 5)

	// Intersect of two sets
	result = BitSet.intersect([bs1, bs2])
	assertEquals(Array.from(result.items()), [1, 5, 33])
	assertEquals(result.count(), 3)

	// Intersect of multiple sets
	result = BitSet.intersect([bs1, bs2, bs3])
	assertEquals(Array.from(result.items()), [1, 5, 33])
	assertEquals(result.count(), 3)

	// Intersect where one set is empty (should result in empty set)
	result = BitSet.intersect([bs1, bs2, emptySet, bs3])
	assertEquals(Array.from(result.items()), [])
	assertEquals(result.count(), 0)
})
