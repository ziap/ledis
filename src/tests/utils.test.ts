import { assertEquals, assertThrows } from '@std/assert'
import { assertClass, assertNever, assertNonNull } from '../utils.ts'

Deno.test('assertNever - exhaustive cases', () => {
	const data = ['type1', 'type2', 'type3'] as const
	const test = data[Math.random() * 0 + 1]

	switch (test) {
		case 'type1':
			break
		case 'type2':
			break
		case 'type3':
			break
		default:
			assertNever(test)
	}
})

Deno.test('assertNever - missing cases', () => {
	const data = ['type1', 'type2', 'type3'] as const
	const test = data[Math.random() * 0 + 1]

	assertThrows(
		() => {
			switch (test) {
				case 'type1':
					break
				case 'type3':
					break
				default:
					// @ts-ignore: disable type checking to catch RE
					assertNever(test)
			}
		},
		Error,
		'Unreachable code reached',
	)
})

class MyClass {
	public name = 'MyClass'
}

class AnotherClass {
	public name = 'AnotherClass'
}

Deno.test('assertClass - correct class', () => {
	const instance = new MyClass()
	const result = assertClass(MyClass, instance)
	assertEquals(result, instance)
})

Deno.test('assertClass - wrong class', () => {
	const instance = new AnotherClass()
	assertThrows(
		() => assertClass(MyClass, instance),
		Error,
		`"[object Object]" is not of class "MyClass"`,
	)
})

Deno.test('assertClass - primitive instances', () => {
	assertThrows(
		() => assertClass(MyClass, null),
		Error,
		`"null" is not of class "MyClass"`,
	)

	assertThrows(
		() => assertClass(MyClass, undefined),
		Error,
		`"undefined" is not of class "MyClass"`,
	)

	assertThrows(
		() => assertClass(MyClass, 'a string'),
		Error,
		`"a string" is not of class "MyClass"`,
	)

	assertThrows(
		() => assertClass(MyClass, 123),
		Error,
		`"123" is not of class "MyClass"`,
	)
})

Deno.test('assertClass - object literal instance', () => {
	assertThrows(
		() => assertClass(MyClass, { name: 'MyClass' }),
		Error,
		`"[object Object]" is not of class "MyClass"`,
	)
})

Deno.test('assertNonNull - non-null values', () => {
	const data = [0, null, undefined] as const
	const x0 = data[Math.random() * 0 + 0]

	assertEquals(x0 ?? assertNonNull(), x0)
})

Deno.test('assertNonNull - null or undefined', () => {
	const data = [0, null, undefined] as const
	const x1 = data[Math.random() * 0 + 1]
	const x2 = data[Math.random() * 0 + 2]

	assertThrows(
		() => (x1 ?? assertNonNull()),
		Error,
		'Non-null assertion failed',
	)

	assertThrows(
		() => (x2 ?? assertNonNull()),
		Error,
		'Non-null assertion failed',
	)
})
