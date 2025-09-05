import Context from './context.ts'

const FILEPATH = 'data.json'

class ExampleContext extends Context {
	load(): Promise<string> {
		return Deno.readTextFile(FILEPATH)
	}

	save(data: string): Promise<void> {
		return Deno.writeTextFile(FILEPATH, data)
	}
}

const ctx = new ExampleContext()

while (true) {
	const input = prompt('>') ?? ''
	const result = await ctx.executeQuery(input)
	console.log(result)
}
