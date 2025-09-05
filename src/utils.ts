export function assertNever(_: never): never {
	throw new Error('Unreachable code reached')
}

export function assertClass<T>(
	cls: { new (...args: unknown[]): T },
	instance: unknown,
): T {
	if (instance instanceof cls) {
		return instance
	}

	throw new Error(`"${instance}" is not of class "${cls}"`)
}
