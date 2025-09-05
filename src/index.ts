import Context from './context.ts'
import { assertClass, assertNever } from './utils.ts'

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

const template = assertClass(
	HTMLTemplateElement,
	document.getElementById('result-template'),
)
const terminal = document.getElementById('terminal')!

const ctx = new TestContext()

form.addEventListener('submit', (e) => {
	const cloned = assertClass(DocumentFragment, template.content.cloneNode(true))
	cloned.querySelector('.result-query')!.textContent = input.value
	const container = cloned.querySelector('.result')!
	const body = cloned.querySelector('.result-body')!
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
						for (const item of value.data) {
							const li = document.createElement('li')
							li.textContent = item
							ol.appendChild(li)
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
