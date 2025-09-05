import { assertThrows } from '@std/assert'
import { assertNever } from '../utils.ts'

Deno.test('assertNever: exhaustive cases', () => {
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

Deno.test('assertNever: missing cases', () => {
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
