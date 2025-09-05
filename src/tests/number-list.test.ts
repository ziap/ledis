import { assertEquals } from '@std/assert'
import NumberList from '../number-list.ts'

Deno.test('NumberList - basic push and pop', () => {
	const list = NumberList.empty()
	assertEquals(list.len, 0)
	assertEquals(list.pop(), null) // Pop from empty list

	list.push(10)
	assertEquals(list.len, 1)
	assertEquals(list.pop(), 10)
	assertEquals(list.len, 0)
	assertEquals(list.pop(), null)
})

Deno.test('NumberList - multiple pushes and pops', () => {
	const list = NumberList.empty()
	list.push(1)
	list.push(2)
	list.push(3)
	assertEquals(list.len, 3)
	assertEquals(list.pop(), 3)
	assertEquals(list.pop(), 2)
	list.push(4)
	assertEquals(list.len, 2) // 1, 4
	assertEquals(list.pop(), 4)
	assertEquals(list.pop(), 1)
	assertEquals(list.len, 0)
	assertEquals(list.pop(), null)
})

Deno.test('NumberList - growth mechanism', () => {
	const list = NumberList.empty()
	const initialCapacity = list['data'].length
	for (let i = 0; i < initialCapacity; i++) {
		list.push(i)
	}
	assertEquals(list.len, initialCapacity)
	assertEquals(list['data'].length, initialCapacity)

	list.push(initialCapacity) // This should trigger growth
	assertEquals(list.len, initialCapacity + 1)
	assertEquals(list['data'].length, initialCapacity * 2) // Check if capacity doubled

	for (let i = 0; i < initialCapacity + 1; ++i) {
		assertEquals(list.pop(), initialCapacity - i) // Pop in reverse order
	}
	assertEquals(list.len, 0)
})

Deno.test('NumberList - fromArray', () => {
	// Test with an empty array
	const emptyList = NumberList.fromArray([])
	assertEquals(emptyList.len, 0)
	assertEquals(emptyList.pop(), null)

	// Test with a non-empty array
	const values = [10, 20, 30, 40, 50]
	const list = NumberList.fromArray(values)
	assertEquals(list.len, values.length)

	// Verify content using the view getter
	assertEquals(list.view, new Uint32Array(values))

	// Verify content by popping elements
	assertEquals(list.pop(), 50)
	assertEquals(list.pop(), 40)
	assertEquals(list.len, 3)

	list.push(60)
	assertEquals(list.view, new Uint32Array([10, 20, 30, 60]))
})

Deno.test('NumberList - withCapacity', () => {
	// Capacity of 0 should default to a minimum capacity (4)
	const list1 = NumberList.withCapacity(0)
	assertEquals(list1.len, 0)
	assertEquals(list1['data'].length, 4)
	assertEquals(list1.pop(), null)

	// Capacity that is not a power of two should align to the next power of two
	const list2 = NumberList.withCapacity(5)
	assertEquals(list2.len, 0)
	assertEquals(list2['data'].length, 8) // Next power of 2 after 5

	// Fill up to capacity without triggering growth
	for (let i = 0; i < 8; i++) {
		list2.push(i)
	}
	assertEquals(list2.len, 8)
	assertEquals(list2['data'].length, 8)

	// Pushing one more item should trigger growth
	list2.push(8)
	assertEquals(list2.len, 9)
	assertEquals(list2['data'].length, 16)
})

Deno.test('NumberList - zeros', () => {
	// Test creating a list with zero length
	const emptyList = NumberList.zeros(0)
	assertEquals(emptyList.len, 0)
	assertEquals(emptyList.pop(), null)
	// Even with length 0, it should allocate the default internal capacity
	assertEquals(emptyList['data'].length, 4)
	assertEquals(emptyList.view, new Uint32Array([]))

	// Test creating a list with a positive length
	const length = 5
	const list = NumberList.zeros(length)
	assertEquals(list.len, length)
	// The internal capacity should be the next power of two (8)
	assertEquals(list['data'].length, 8)

	// Verify that the contents are all zeros. [2, 3]
	assertEquals(list.view, new Uint32Array([0, 0, 0, 0, 0]))

	// Popping from the list should return a zero
	assertEquals(list.pop(), 0)
	assertEquals(list.len, length - 1)
	assertEquals(list.view, new Uint32Array([0, 0, 0, 0]))

	// Pushing a new value should work as expected
	list.push(42)
	assertEquals(list.len, length)
	assertEquals(list.view, new Uint32Array([0, 0, 0, 0, 42]))
	assertEquals(list.pop(), 42)
	assertEquals(list.pop(), 0)
})

Deno.test('NumberList - view getter', () => {
	const list = NumberList.fromArray([5, 15, 25])
	const view1 = list.view
	assertEquals(view1.length, 3)
	assertEquals(view1, new Uint32Array([5, 15, 25]))

	list.pop()
	const view2 = list.view
	assertEquals(view2.length, 2)
	assertEquals(view2, new Uint32Array([5, 15]))

	// Ensure the view is a subarray and does not expose the full internal buffer
	list.push(100)
	list.push(200)
	list.push(300) // This will likely cause a resize
	list.pop() // Internal buffer is now larger than len
	const view3 = list.view
	assertEquals(list.len, 4)
	assertEquals(view3.length, 4)
	assertEquals(list['data'].length > list.len, true) // Internal buffer is larger
	assertEquals(view3, new Uint32Array([5, 15, 100, 200]))
})
