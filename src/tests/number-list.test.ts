import { assertEquals } from '@std/assert'
import NumberList from '../number-list.ts'

Deno.test('NumberList - basic push and pop', () => {
	const list = new NumberList()
	assertEquals(list.len, 0)
	assertEquals(list.pop(), null) // Pop from empty list

	list.push(10)
	assertEquals(list.len, 1)
	assertEquals(list.pop(), 10)
	assertEquals(list.len, 0)
	assertEquals(list.pop(), null)
})

Deno.test('NumberList - multiple pushes and pops', () => {
	const list = new NumberList()
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
	const list = new NumberList()
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
