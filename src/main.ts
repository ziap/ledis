// import KVStore from './kvstore.ts'

function tokenize(input: string): string[] {
	const tokens: string[] = []
	let currentToken = ''
	let quoteOpen = false
	let escaping = false

	for (const char of input) {
		if (escaping) {
			currentToken += char
			escaping = false
		} else if (char === '\\' && !escaping) {
			escaping = true
		} else if (char === '"') {
			quoteOpen = !quoteOpen
		} else if (' \t\n\r\x0b\x0c'.includes(char) && !quoteOpen) {
			if (currentToken.length > 0) {
				tokens.push(currentToken)
				currentToken = ''
			}
		} else {
			currentToken += char
		}
	}

	if (currentToken.length > 0) {
		tokens.push(currentToken)
	}

	if (quoteOpen || escaping) {
		throw new Error('Unterminated string input')
	}

	return tokens
}

type QueryResult = {
	kind: 'info'
	message: string
} | {
	kind: 'error'
	message: string
} | {
	kind: 'result'
	data: string[]
}

// function getParam(params: string[], idx: number, name: string) {
//   if (idx >= params.length) {
//     throw new Error(`Parameter '${name}' not provided`)
//   }
//
//   return params[idx]
// }
//
// function executeQuery(query: string, store: KVStore): QueryResult {
//   try {
//     const tokens = tokenize(query)
//     if (tokens.length < 1) {
//       return { kind: "error", message: "Empty query" }
//     }
//
//     const cmd = tokens[0]
//     const params = tokens.slice(1)
//
//     switch (cmd) {
//       case "SET":
//         if (params.length
//     }
//   }
// }

console.log(tokenize('SET   hello world'))
console.log(tokenize('SET   hello\\ world'))
console.log(tokenize('SET "hello world"'))
console.log(tokenize('SET "hello \\"world\\""'))
