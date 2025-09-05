import Context from './context.ts'
import { assertClass } from './utils.ts'

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

const ctx = new TestContext()
console.log(await ctx.executeQuery('SET hello world'))
console.log(await ctx.executeQuery('GET hello'))

const form = assertClass(HTMLFormElement, document.getElementById('input-form'))
const input = assertClass(
	HTMLInputElement,
	document.getElementById('input-query'),
)

form.addEventListener('submit', (e) => {
	console.log(input.value)
	e.preventDefault()
	form.reset()
})
