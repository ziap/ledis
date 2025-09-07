/// <reference lib="dom" />

import IDBContext from './idb-context.ts'
import { assertClass, assertNever, assertNonNull } from './utils.ts'

const form = assertClass(HTMLFormElement, document.getElementById('input-form'))
const input = assertClass(
	HTMLInputElement,
	document.getElementById('input-query'),
)

const resultTemplate = assertClass(
	HTMLTemplateElement,
	document.getElementById('result-template'),
)

const valueTemplate = assertClass(
	HTMLTemplateElement,
	document.getElementById('result-value'),
)

const terminal = document.getElementById('terminal') ?? assertNonNull()

const ctx = await IDBContext.new()

try {
	await ctx.executeQuery('RESTORE')
} catch {
	// The database is loaded for the first time
}

form.addEventListener('submit', (e) => {
	const cloned = assertClass(
		DocumentFragment,
		resultTemplate.content.cloneNode(true),
	)

	const query = cloned.querySelector('.result-query') ?? assertNonNull()
	query.textContent = input.value
	const container = cloned.querySelector('.result') ?? assertNonNull()
	const body = cloned.querySelector('.result-body') ?? assertNonNull()
	terminal.appendChild(cloned)

	ctx.executeQuery(input.value).then((value) => {
		switch (value.kind) {
			case 'info':
				{
					body.textContent = value.message
				}
				break
			case 'error':
				{
					body.textContent = `ERROR: ${value.message}`
				}
				break
			case 'result':
				{
					if (value.data.length === 0) {
						body.textContent = '<empty>'
					} else {
						const ol = document.createElement('ol')
						ol.classList.add('result-values')
						for (const item of value.data) {
							const valueCloned = assertClass(
								DocumentFragment,
								valueTemplate.content.cloneNode(true),
							)

							const elem = valueCloned.querySelector('.result-item') ??
								assertNonNull()

							if (item !== '') {
								elem.textContent = item
							} else {
								elem.remove()
							}
							ol.appendChild(valueCloned)
						}
						body.appendChild(ol)
					}
				}
				break
			default:
				assertNever(value)
		}

		container.scrollIntoView({
			behavior: 'smooth',
			block: 'nearest',
			inline: 'nearest',
		})
	})

	e.preventDefault()
	form.reset()
})
