import { assert, assertEquals, assertThrows } from '@std/assert'
import { delay } from '@std/async/delay'

import KVStore from '../kvstore.ts'

Deno.test('KVStore: setString and getString', () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	assertEquals(kv.getString('name'), 'Deno')
})

Deno.test('KVStore: getString throws error for non-string type', () => {
	const kv = new KVStore()
	kv.pushArray('list', ['1', '2'])
	assertThrows(
		() => kv.getString('list'),
		Error,
		'Key holds a value that is not a string',
	)
})

Deno.test('KVStore: delete string key', () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	assertEquals(kv.getString('name'), 'Deno')
	kv.delete('name')
	kv.delete('non-existent')
	assertThrows(() => kv.getString('name'), Error, 'Key does not exists')
})

Deno.test('KVStore: pushArray and popArray', () => {
	const kv = new KVStore()
	kv.pushArray('myList', ['a', 'b'])
	kv.pushArray('myList', ['c'])
	assertEquals(kv.popArray('myList'), 'c')
	assertEquals(kv.popArray('myList'), 'b')
	assertEquals(kv.popArray('myList'), 'a')
	assertEquals(kv.popArray('myList'), null)
})

Deno.test('KVStore: popArray throws error for non-list type', () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	assertThrows(
		() => kv.popArray('name'),
		Error,
		'Key holds a value that is not a list',
	)
})

Deno.test('KVStore: sliceArray', () => {
	const kv = new KVStore()
	kv.pushArray('myList', ['a', 'b', 'c', 'd', 'e'])
	assertEquals(kv.sliceArray('myList', 1, 3), ['b', 'c', 'd'])
})

Deno.test('KVStore: sliceArray throws error for out of bounds', () => {
	const kv = new KVStore()
	kv.pushArray('myList', ['a', 'b'])
	assertThrows(
		() => kv.sliceArray('myList', -1, 1),
		Error,
		'Index out of bound',
	)
	assertThrows(() => kv.sliceArray('myList', 0, 2), Error, 'Index out of bound')
})

Deno.test('KVStore: addSet and getSet', () => {
	const kv = new KVStore()
	kv.addSet('mySet', ['apple', 'banana'])
	kv.addSet('mySet', ['orange', 'banana'])
	assertEquals(kv.getSet('mySet').sort(), ['apple', 'banana', 'orange'].sort())
})

Deno.test('KVStore: removeSet', () => {
	const kv = new KVStore()
	kv.addSet('mySet', ['apple', 'banana', 'orange'])
	kv.removeSet('mySet', ['banana'])
	assertEquals(kv.getSet('mySet').sort(), ['apple', 'orange'].sort())
	kv.removeSet('mySet', ['grape']) // Remove non-existent item
	assertEquals(kv.getSet('mySet').sort(), ['apple', 'orange'].sort())
})

Deno.test('KVStore: getSet throws error for non-set type', () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	assertThrows(
		() => kv.getSet('name'),
		Error,
		'Key holds a value that is not a set',
	)
})

Deno.test('KVStore: unionSet', () => {
	const kv = new KVStore()
	kv.addSet('set1', ['a', 'b'])
	kv.addSet('set2', ['b', 'c'])
	assertEquals(kv.unionSet(['set1', 'set2']).sort(), ['a', 'b', 'c'].sort())
})

Deno.test('KVStore: intersectSet', () => {
	const kv = new KVStore()
	kv.addSet('set1', ['a', 'b', 'c'])
	kv.addSet('set2', ['b', 'c', 'd'])
	assertEquals(kv.intersectSet(['set1', 'set2']).sort(), ['b', 'c'].sort())
})

Deno.test('KVStore: keys', () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	kv.pushArray('list', ['1'])
	kv.addSet('set', ['a'])
	assertEquals(kv.keys().sort(), ['name', 'list', 'set'].sort())
	kv.delete('name')
	assertEquals(kv.keys().sort(), ['list', 'set'].sort())
})

Deno.test('KVStore: expireKey and ttl', async () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	kv.expireKey('name', 1) // expires in 1 second

	const ttl1 = kv.ttl('name')
	assert(ttl1 !== null && ttl1 > 0.5 && ttl1 <= 1)

	await delay(1100) // wait for expiry

	const ttl2 = kv.ttl('name')
	assertEquals(ttl2, null) // Should be expired

	assertThrows(() => kv.getString('name'), Error, 'Key does not exists')
	assertEquals(kv.keys().length, 0)
})

Deno.test('KVStore: update expiry', async () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	kv.expireKey('name', 1)
	await delay(500)
	kv.expireKey('name', 2) // Extend expiry
	const ttl1 = kv.ttl('name')
	assert(ttl1 !== null && ttl1 > 1.5 && ttl1 <= 2)
	await delay(1600) // Original expiry would have passed
	assert(kv.getString('name') === 'Deno')
	const ttl2 = kv.ttl('name')
	assert(ttl2 !== null && ttl2 < 0.5)

	await delay(500) // Wait for new expiry
	assertThrows(() => kv.getString('name'), Error, 'Key does not exists')
})

Deno.test('KVStore: clearExpired is called by operations', async () => {
	const kv = new KVStore()
	kv.setString('key1', 'value1')
	kv.expireKey('key1', 0.1)
	await delay(200)
	kv.setString('key2', 'value2') // This operation should trigger clearExpired
	assertEquals(kv.keys(), ['key2'])
})

Deno.test('KVStore: delete for different types', () => {
	const kv = new KVStore()

	// String
	kv.setString('myString', 'hello')
	kv.delete('myString')
	assertThrows(() => kv.getString('myString'))

	// NumberList
	kv.pushArray('myList', ['a', 'b'])
	kv.delete('myList')
	assertThrows(() => kv.popArray('myList'))

	// BitSet
	kv.addSet('mySet', ['x', 'y'])
	kv.delete('mySet')
	assertThrows(() => kv.getSet('mySet'))
})

Deno.test('KVStore: stringTable cleanup on delete', () => {
	const kv = new KVStore()
	kv.setString('key1', 'value1')
	kv.pushArray('key2', ['item1', 'item2'])
	kv.addSet('key3', ['setitem1', 'setitem2'])

	kv.delete('key1')
	kv.delete('key2')
	kv.delete('key3')

	const size = kv['stringTable']['values'].length

	// The string table should be smaller after deleting keys and their values
	// Exact count is hard to assert without internal knowledge of StringTable.
	// We can at least check that the keys themselves are gone from StringTable.
	assertEquals(kv['stringTable'].stringToIndex('key1'), null)
	assertEquals(kv['stringTable'].stringToIndex('value1'), null)
	assertEquals(kv['stringTable'].stringToIndex('key2'), null)
	assertEquals(kv['stringTable'].stringToIndex('item1'), null)
	assertEquals(kv['stringTable'].stringToIndex('item2'), null)
	assertEquals(kv['stringTable'].stringToIndex('key3'), null)
	assertEquals(kv['stringTable'].stringToIndex('setitem1'), null)
	assertEquals(kv['stringTable'].stringToIndex('setitem2'), null)

	// The string table correctly clean up all strings and mark them for reuse
	assertEquals(kv['stringTable']['freeIndices'].len, size)
})

Deno.test('KVStore: deleting a key with expiry removes it from heap', async () => {
	const kv = new KVStore()
	kv.setString('key1', 'value1')
	kv.expireKey('key1', 1)
	assertEquals(kv['heap'].len, 1) // Key should be in heap
	kv.delete('key1')
	assertEquals(kv['heap'].len, 0) // Key should be removed from heap
	await delay(1100) // Ensure clearExpired won't find it
	assertEquals(kv.keys().length, 0)
})

Deno.test('KVStore: complex expiry interaction (siftUp/siftDown)', async () => {
	const kv = new KVStore()
	kv.setString('k1', 'v1')
	kv.setString('k2', 'v2')
	kv.setString('k3', 'v3')

	kv.expireKey('k1', 3) // will expire last
	kv.expireKey('k2', 1) // will expire first
	kv.expireKey('k3', 2) // will expire second

	assertEquals(kv.getString('k1'), 'v1')
	assertEquals(kv.getString('k2'), 'v2')
	assertEquals(kv.getString('k3'), 'v3')

	await delay(1100) // k2 should expire
	assertEquals(kv.ttl('k2'), null)
	assertEquals(kv.getString('k1'), 'v1')
	assertEquals(kv.getString('k3'), 'v3')
	assertThrows(() => kv.getString('k2'))
	assertEquals(kv.keys().sort(), ['k1', 'k3'].sort())

	await delay(1000) // k3 should expire
	assertEquals(kv.ttl('k3'), null)
	assertEquals(kv.getString('k1'), 'v1')
	assertThrows(() => kv.getString('k3'))
	assertEquals(kv.keys().sort(), ['k1'].sort())

	await delay(1000) // k1 should expire
	assertEquals(kv.ttl('k1'), null)
	assertThrows(() => kv.getString('k1'))
	assertEquals(kv.keys().length, 0)
})

Deno.test('KVStore: pushing to an existing list without deleting the original values', () => {
	const kv = new KVStore()
	kv.pushArray('myList', ['a', 'b'])
	kv.pushArray('myList', ['c', 'd']) // Appends to existing list
	assertEquals(kv.sliceArray('myList', 0, 3), ['a', 'b', 'c', 'd'])
})

Deno.test('KVStore: adding to an existing set without deleting the original values', () => {
	const kv = new KVStore()
	kv.addSet('mySet', ['apple', 'banana'])
	kv.addSet('mySet', ['orange', 'grape']) // Adds to existing set
	assertEquals(
		kv.getSet('mySet').sort(),
		['apple', 'banana', 'grape', 'orange'].sort(),
	)
})

Deno.test('KVStore: trying to pushArray on a string key should throw', () => {
	const kv = new KVStore()
	kv.setString('myKey', 'hello')
	assertThrows(
		() => kv.pushArray('myKey', ['world']),
		Error,
		'Key holds a value that is not a list',
	)
})

Deno.test('KVStore: trying to addSet on a string key should throw', () => {
	const kv = new KVStore()
	kv.setString('myKey', 'hello')
	assertThrows(
		() => kv.addSet('myKey', ['world']),
		Error,
		'Key holds a value that is not a set',
	)
})

Deno.test('KVStore: trying to setString on a list key should overwrite', () => {
	const kv = new KVStore()
	kv.pushArray('myKey', ['hello'])
	kv.setString('myKey', 'world')
	assertEquals(kv.getString('myKey'), 'world')
	assertThrows(
		() => kv.popArray('myKey'),
		Error,
		'Key holds a value that is not a list',
	)
})

Deno.test('KVStore: trying to setString on a set key should overwrite', () => {
	const kv = new KVStore()
	kv.addSet('myKey', ['hello'])
	kv.setString('myKey', 'world')
	assertEquals(kv.getString('myKey'), 'world')
	assertThrows(
		() => kv.getSet('myKey'),
		Error,
		'Key holds a value that is not a set',
	)
})

Deno.test('KVStore: expireKey on a non-existent key throws an error', () => {
	const kv = new KVStore()
	assertThrows(
		() => kv.expireKey('nonExistentKey', 10),
		Error,
		'Key does not exists',
		'expireKey should throw an error for a non-existent key',
	)
	assertEquals(
		kv['heap'].len,
		0,
		'Heap should remain empty if key did not exist',
	)
})

Deno.test('KVStore: ttl on a key without expiry returns null', () => {
	const kv = new KVStore()
	kv.setString('myKey', 'someValue')
	assertEquals(
		kv.ttl('myKey'),
		null,
		'TTL for a non-expiring key should be null',
	)
	kv.pushArray('anotherKey', ['item1'])
	assertEquals(
		kv.ttl('anotherKey'),
		null,
		'TTL for a non-expiring list key should be null',
	)
})

Deno.test('KVStore: serialize and deserialize an empty store', () => {
	const kv = new KVStore()
	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	assertEquals(deserializedKv.keys(), [])
	assertEquals(deserializedKv['stringTable']['values'].length, 0)
	assertEquals(deserializedKv['heap'].len, 0)
})

Deno.test('KVStore: serialize/deserialize with string values', () => {
	const kv = new KVStore()
	kv.setString('name', 'Deno')
	kv.setString('greeting', 'Hello World')

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	assertEquals(deserializedKv.getString('name'), 'Deno')
	assertEquals(deserializedKv.getString('greeting'), 'Hello World')
	assertEquals(deserializedKv.keys().sort(), ['greeting', 'name'].sort())
})

Deno.test('KVStore: serialize/deserialize with list values', () => {
	const kv = new KVStore()
	kv.pushArray('myList', ['a', 'b', 'c'])
	kv.pushArray('anotherList', ['x', 'y'])

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	assertEquals(deserializedKv.sliceArray('myList', 0, 2), ['a', 'b', 'c'])
	assertEquals(deserializedKv.sliceArray('anotherList', 0, 1), ['x', 'y'])
	assertEquals(deserializedKv.keys().sort(), ['anotherList', 'myList'].sort())
})

Deno.test('KVStore: serialize/deserialize with set values', () => {
	const kv = new KVStore()
	kv.addSet('mySet', ['apple', 'banana'])
	kv.addSet('anotherSet', ['red', 'green'])

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	assertEquals(
		deserializedKv.getSet('mySet').sort(),
		['apple', 'banana'].sort(),
	)
	assertEquals(
		deserializedKv.getSet('anotherSet').sort(),
		['green', 'red'].sort(),
	)
	assertEquals(deserializedKv.keys().sort(), ['anotherSet', 'mySet'].sort())
})

Deno.test('KVStore: serialize/deserialize with mixed data types', () => {
	const kv = new KVStore()
	kv.setString('strKey', 'stringValue')
	kv.pushArray('listKey', ['listVal1', 'listVal2'])
	kv.addSet('setKey', ['setValA', 'setValB'])

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	assertEquals(deserializedKv.getString('strKey'), 'stringValue')
	assertEquals(deserializedKv.sliceArray('listKey', 0, 1), [
		'listVal1',
		'listVal2',
	])
	assertEquals(
		deserializedKv.getSet('setKey').sort(),
		['setValA', 'setValB'].sort(),
	)
	assertEquals(
		deserializedKv.keys().sort(),
		['listKey', 'setKey', 'strKey'].sort(),
	)
})

Deno.test('KVStore: serialize/deserialize with expiry preserving heap invariant', async () => {
	const kv = new KVStore()
	kv.setString('key1', 'value1')
	kv.expireKey('key1', 3) // Expires in 3 seconds

	kv.setString('key2', 'value2')
	kv.expireKey('key2', 1) // Expires in 1 second

	kv.setString('key3', 'value3')
	kv.expireKey('key3', 2) // Expires in 2 seconds

	// Capture initial TTLs (approximate)
	const initialTtl1 = kv.ttl('key1')
	const initialTtl2 = kv.ttl('key2')
	const initialTtl3 = kv.ttl('key3')

	assert(initialTtl1 !== null && initialTtl1 > 2.5)
	assert(initialTtl2 !== null && initialTtl2 > 0.5)
	assert(initialTtl3 !== null && initialTtl3 > 1.5)

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	// Verify data
	assertEquals(deserializedKv.getString('key1'), 'value1')
	assertEquals(deserializedKv.getString('key2'), 'value2')
	assertEquals(deserializedKv.getString('key3'), 'value3')

	// Verify TTLs are still decreasing as expected
	const deserializedTtl1 = deserializedKv.ttl('key1')
	const deserializedTtl2 = deserializedKv.ttl('key2')
	const deserializedTtl3 = deserializedKv.ttl('key3')

	// TTLs should be close to their original values (minus time taken for serialization/deserialization)
	assert(deserializedTtl1 !== null && deserializedTtl1 <= initialTtl1!)
	assert(deserializedTtl2 !== null && deserializedTtl2 <= initialTtl2!)
	assert(deserializedTtl3 !== null && deserializedTtl3 <= initialTtl3!)

	// Advance time to check expiry order
	await delay(1100) // key2 should expire

	// An operation on deserializedKv should trigger clearExpired
	deserializedKv.setString('tempKey', 'tempValue')

	assertEquals(deserializedKv.ttl('key2'), null)
	assertThrows(() => deserializedKv.getString('key2'))
	assertEquals(deserializedKv.keys().sort(), ['key1', 'key3', 'tempKey'].sort())

	await delay(1000) // key3 should expire

	deserializedKv.setString('anotherTemp', 'anotherValue')

	assertEquals(deserializedKv.ttl('key3'), null)
	assertThrows(() => deserializedKv.getString('key3'))
	assertEquals(
		deserializedKv.keys().sort(),
		['key1', 'anotherTemp', 'tempKey'].sort(),
	)

	await delay(1000) // key1 should expire

	deserializedKv.setString('finalTemp', 'finalValue')

	assertEquals(deserializedKv.ttl('key1'), null)
	assertThrows(() => deserializedKv.getString('key1'))
	assertEquals(
		deserializedKv.keys().sort(),
		['anotherTemp', 'finalTemp', 'tempKey'].sort(),
	)
})

Deno.test('KVStore: serialize/deserialize with a key that had expiry but was deleted', () => {
	const kv = new KVStore()
	kv.setString('key1', 'value1')
	kv.expireKey('key1', 1)
	kv.delete('key1') // Delete before serializing

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	assertThrows(() => deserializedKv.getString('key1'))
	assertEquals(deserializedKv.keys().length, 0)
	assertEquals(deserializedKv['heap'].len, 0)
})

Deno.test('KVStore: stringTable consistency after serialize/deserialize', () => {
	const kv = new KVStore()
	kv.setString('k1', 'v1')
	kv.pushArray('k2', ['a', 'b'])
	kv.addSet('k3', ['x', 'y'])
	kv.setString('k4', 'v1') // 'v1' is reused

	const serialized = kv.serialize()
	const deserializedKv = KVStore.deserialize(serialized)

	// Check if string table indices are consistent for retrieval
	assertEquals(deserializedKv.getString('k1'), 'v1')
	assertEquals(deserializedKv.getString('k4'), 'v1')
	assertEquals(deserializedKv.sliceArray('k2', 0, 1), ['a', 'b'])
	assertEquals(deserializedKv.getSet('k3').sort(), ['x', 'y'].sort())

	// Add new string to verify stringTable reuse works
	deserializedKv.setString('k5', 'new_value')
	assertEquals(deserializedKv.getString('k5'), 'new_value')
})
