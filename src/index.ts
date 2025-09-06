/// <reference lib="dom" />

import Context from './context.ts'
import { assertClass, assertNever, assertNonNull } from './utils.ts'

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

const ctx = new TestContext()

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
							elem.textContent = item
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
