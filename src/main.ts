import KVStore from './kvstore.ts'

const store = new KVStore()

store.setString('hello', 'world')
store.pushArray('list', ['apple', 'orange', 'banana'])
store.addSet('set', ['apple', 'orange', 'banana'])
store.addSet('set', ['google', 'microsoft', 'apple'])
store.delete('hello')
const data = store.serialize()

const store1 = KVStore.deserialize(data)
console.log(store1.sliceArray('list', 0, 2))
console.log(store1.getSet('set'))

console.log(store1)

store1.delete('list')
store1.delete('set')
console.log(JSON.stringify(store1.serialize(), null, 2))
