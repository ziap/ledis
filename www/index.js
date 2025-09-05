// src/number-list.ts
var NumberList = class _NumberList {
  data;
  size;
  constructor(data, size) {
    this.data = data;
    this.size = size;
  }
  static empty() {
    return _NumberList.withCapacity(4);
  }
  static withCapacity(capacity) {
    const aligned = 1 << 32 - Math.clz32(capacity - 1);
    const buffer = new Uint32Array(Math.max(aligned, 4));
    return new _NumberList(buffer, 0);
  }
  static zeros(length) {
    const list = _NumberList.withCapacity(length);
    list.size = length;
    return list;
  }
  static fromArray(values) {
    const list = _NumberList.withCapacity(values.length);
    list.data.set(values);
    list.size = values.length;
    return list;
  }
  get len() {
    return this.size;
  }
  push(value) {
    if (this.data.length === this.size) {
      const oldData = this.data;
      this.data = new Uint32Array(this.data.length << 1);
      this.data.set(oldData);
    }
    this.data[this.len] = value;
    this.size += 1;
  }
  pop() {
    if (this.size === 0) return null;
    this.size -= 1;
    const value = this.data[this.len];
    return value;
  }
  get view() {
    return this.data.subarray(0, this.len);
  }
};

// src/string-pool.ts
var StringPool = class {
  values;
  refcount;
  index;
  freeIndices;
  constructor(values = [], refcount = NumberList.empty()) {
    this.values = values;
    this.refcount = refcount;
    this.index = /* @__PURE__ */ new Map();
    this.freeIndices = NumberList.empty();
    if (values.length !== refcount.len) {
      throw new Error("Length mismatch between values and refcount");
    }
    for (let i = 0; i < values.length; ++i) {
      if (refcount.view[i] > 0) {
        this.index.set(values[i], i);
      } else {
        this.freeIndices.push(i);
      }
    }
  }
  add(value) {
    const idx = this.index.get(value);
    if (idx === void 0) {
      const newIdx = this.freeIndices.pop();
      if (newIdx === null) {
        const len = this.values.length;
        this.values.push(value);
        this.refcount.push(1);
        this.index.set(value, len);
        return len;
      }
      this.values[newIdx] = value;
      this.refcount.view[newIdx] = 1;
      this.index.set(value, newIdx);
      return newIdx;
    }
    this.refcount.view[idx] += 1;
    return idx;
  }
  delete(value) {
    const idx = this.index.get(value);
    if (idx === void 0) return;
    this.refcount.view[idx] -= 1;
    if (this.refcount.view[idx] <= 0) {
      this.index.delete(value);
      this.values[idx] = "";
      this.freeIndices.push(idx);
    }
  }
  stringToIndex(value) {
    return this.index.get(value) ?? null;
  }
  indexToString(idx) {
    return this.values[idx];
  }
};

// src/bitset.ts
var BitSet = class _BitSet {
  data;
  constructor(data) {
    this.data = data;
  }
  static empty() {
    return new _BitSet(new Uint32Array(4));
  }
  add(value) {
    const idx = value >> 5;
    if (this.data.length <= idx) {
      const oldData = this.data;
      this.data = new Uint32Array(1 << 32 - Math.clz32(idx));
      this.data.set(oldData);
    }
    const bit = 1 << (value & 31);
    const set = (this.data[idx] & bit) !== 0;
    this.data[idx] |= bit;
    return set;
  }
  delete(value) {
    const idx = value >> 5;
    if (this.data.length <= idx) return false;
    const bit = this.data[idx] & 1 << (value & 31);
    this.data[idx] ^= bit;
    return bit !== 0;
  }
  count() {
    let count = 0;
    for (const item of this.data) {
      let n = item;
      n = n - (n >> 1 & 1431655765);
      n = (n & 858993459) + (n >> 2 & 858993459);
      count += (n + (n >> 4) & 252645135) * 16843009 >> 24;
    }
    return count;
  }
  items() {
    const result = new Uint32Array(this.count());
    let resultPtr = 0;
    let shift = 0;
    for (const item of this.data) {
      let n = item;
      while (n) {
        const bit = n & -n;
        n ^= bit;
        result[resultPtr] = 31 - Math.clz32(bit) | shift;
        resultPtr += 1;
      }
      shift += 32;
    }
    return result;
  }
  static union(sets) {
    if (sets.length === 0) return _BitSet.empty();
    let len = 0;
    for (const set of sets) {
      len = Math.max(len, set.data.length);
    }
    const data = new Uint32Array(len);
    for (const set of sets) {
      for (let i = 0; i < set.data.length; ++i) {
        data[i] |= set.data[i];
      }
    }
    return new _BitSet(data);
  }
  static intersect(sets) {
    if (sets.length === 0) return _BitSet.empty();
    const max = -1 >>> 0;
    let len = max;
    for (const set of sets) {
      len = Math.min(len, set.data.length);
    }
    const data = new Uint32Array(len).fill(max);
    for (const set of sets) {
      for (let i = 0; i < data.length; ++i) {
        data[i] &= set.data[i];
      }
    }
    return new _BitSet(data);
  }
};

// src/utils.ts
function assertNever(_) {
  throw new Error("Unreachable code reached");
}
function assertClass(cls, instance) {
  if (instance instanceof cls) {
    return instance;
  }
  throw new Error(`"${instance}" is not of class "${cls}"`);
}

// src/kvstore.ts
var Expiry = class {
  expireTime;
  heapPosition;
  constructor(expireTime) {
    this.expireTime = expireTime;
    this.heapPosition = -1;
  }
};
var KVEntry = class {
  value;
  expiry;
  constructor(value) {
    this.value = value;
    this.expiry = null;
  }
};
var KVStore = class _KVStore {
  stringPool;
  data;
  heap;
  constructor(stringPool = new StringPool(), data = new Array()) {
    this.stringPool = stringPool;
    this.data = data;
    this.heap = NumberList.empty();
    for (let i = 0; i < data.length; ++i) {
      const expiry = data[i].expiry;
      if (expiry !== null) {
        const heapIdx = this.heap.len;
        this.heap.push(i);
        this.siftUp(heapIdx);
      }
    }
  }
  getEntry(key) {
    const idx = this.stringPool.stringToIndex(key);
    if (idx === null || idx >= this.data.length) {
      throw new Error("Key does not exists");
    }
    return this.data[idx];
  }
  addEntry(key) {
    const idx = this.stringPool.add(key);
    while (this.data.length <= idx) {
      this.data.push(new KVEntry(null));
    }
    return this.data[idx];
  }
  heapCmp(idx1, idx2) {
    const entry1 = this.data[idx1];
    const entry2 = this.data[idx2];
    const expiry1 = entry1.expiry;
    const expiry2 = entry2.expiry;
    if (expiry1 === null || expiry2 === null) {
      throw new Error("Implementation error");
    }
    return expiry1.expireTime < expiry2.expireTime;
  }
  siftUp(idx) {
    const val = this.heap.view[idx];
    let p = idx - 1 >> 1;
    let pVal = this.heap.view[p];
    while (idx > 0 && !this.heapCmp(pVal, val)) {
      this.heap.view[idx] = pVal;
      const expiry2 = this.data[pVal].expiry;
      if (expiry2 === null) throw new Error("Implementation error");
      expiry2.heapPosition = idx;
      idx = p;
      p = idx - 1 >> 1;
      pVal = this.heap.view[p];
    }
    this.heap.view[idx] = val;
    const expiry = this.data[val].expiry;
    if (expiry === null) throw new Error("Implementation error");
    expiry.heapPosition = idx;
  }
  siftDown(idx) {
    const val = this.heap.view[idx];
    let childIdx = idx << 1 | 1;
    while (childIdx < this.heap.len) {
      let childVal = this.heap.view[childIdx];
      if (childIdx + 1 < this.heap.len) {
        const otherVal = this.heap.view[childIdx + 1];
        if (this.heapCmp(otherVal, childVal)) {
          childIdx += 1;
          childVal = otherVal;
        }
      }
      if (this.heapCmp(val, childVal)) break;
      this.heap.view[idx] = childVal;
      const expiry2 = this.data[childVal].expiry;
      if (expiry2 === null) throw new Error("Implementation error");
      expiry2.heapPosition = idx;
      idx = childIdx;
      childIdx = idx << 1 | 1;
    }
    this.heap.view[idx] = val;
    const expiry = this.data[val].expiry;
    if (expiry === null) throw new Error("Implementation error");
    expiry.heapPosition = idx;
  }
  removeFromHeap(heapPos) {
    const itemToRemoveIdx = this.heap.view[heapPos];
    const lastHeapItemIdx = this.heap.pop();
    if (lastHeapItemIdx === null) {
      throw new Error("Implementation error");
    }
    if (heapPos < this.heap.len) {
      this.heap.view[heapPos] = lastHeapItemIdx;
      const movedEntry = this.data[lastHeapItemIdx];
      if (movedEntry.expiry === null) throw new Error("Implementation error");
      movedEntry.expiry.heapPosition = heapPos;
      this.siftDown(heapPos);
    }
    const removedKVEntry = this.data[itemToRemoveIdx];
    if (removedKVEntry.expiry) {
      removedKVEntry.expiry = null;
    }
  }
  delete(key) {
    const idx = this.stringPool.stringToIndex(key);
    if (idx === null || idx >= this.data.length) return;
    const entry = this.data[idx];
    const value = entry.value;
    if (value === null) return;
    entry.value = null;
    if (entry.expiry !== null) {
      this.removeFromHeap(entry.expiry.heapPosition);
    }
    this.stringPool.delete(key);
    if (typeof value === "number") {
      const valueString = this.stringPool.indexToString(value);
      this.stringPool.delete(valueString);
      return;
    }
    if (value instanceof NumberList) {
      for (const item of value.view) {
        const itemString = this.stringPool.indexToString(item);
        this.stringPool.delete(itemString);
      }
      return;
    }
    if (value instanceof BitSet) {
      for (const item of value.items()) {
        const itemString = this.stringPool.indexToString(item);
        this.stringPool.delete(itemString);
      }
      return;
    }
    assertNever(value);
  }
  expireKey(key, seconds) {
    this.clearExpired();
    const expireTime = Date.now() / 1e3 + seconds;
    const idx = this.stringPool.stringToIndex(key);
    if (idx === null || idx >= this.data.length) {
      throw new Error("Key does not exists");
    }
    const entry = this.data[idx];
    if (entry.expiry === null) {
      const heapIdx = this.heap.len;
      entry.expiry = new Expiry(expireTime);
      this.heap.push(idx);
      this.siftUp(heapIdx);
    } else {
      const oldExpireTime = entry.expiry.expireTime;
      entry.expiry.expireTime = expireTime;
      if (expireTime <= oldExpireTime) {
        this.siftUp(entry.expiry.heapPosition);
      } else {
        this.siftDown(entry.expiry.heapPosition);
      }
    }
  }
  clearExpired() {
    const currentTime = Date.now() / 1e3;
    while (this.heap.len > 0) {
      const top = this.heap.view[0];
      const expiry = this.data[top].expiry;
      if (expiry === null) throw new Error("Implementation error");
      if (expiry.expireTime > currentTime) break;
      const key = this.stringPool.indexToString(top);
      this.removeFromHeap(0);
      this.delete(key);
    }
  }
  setString(key, value) {
    this.clearExpired();
    const entry = this.addEntry(key);
    this.delete(key);
    entry.value = this.stringPool.add(value);
  }
  getString(key) {
    this.clearExpired();
    const entry = this.getEntry(key);
    const value = entry.value;
    if (typeof value === "number") {
      return this.stringPool.indexToString(value);
    }
    throw new Error("Key holds a value that is not a string");
  }
  pushArray(key, values) {
    this.clearExpired();
    const entry = this.addEntry(key);
    const value = entry.value;
    if (value !== null) {
      this.stringPool.delete(key);
      if (value instanceof NumberList) {
        for (const item of values) {
          value.push(this.stringPool.add(item));
        }
      } else {
        throw new Error("Key holds a value that is not a list");
      }
      return;
    }
    entry.value = NumberList.empty();
    for (const item of values) {
      entry.value.push(this.stringPool.add(item));
    }
  }
  popArray(key) {
    this.clearExpired();
    const entry = this.getEntry(key);
    const value = entry.value;
    if (value instanceof NumberList) {
      const item = value.pop();
      if (item === null) return null;
      const itemString = this.stringPool.indexToString(item);
      this.stringPool.delete(itemString);
      return itemString;
    }
    throw new Error("Key holds a value that is not a list");
  }
  sliceArray(key, start, end) {
    this.clearExpired();
    const entry = this.getEntry(key);
    const value = entry.value;
    if (value instanceof NumberList) {
      if (start < 0 || end >= value.len) throw new Error("Index out of bound");
      const resultLen = end - start + 1;
      const result = new Array(resultLen);
      for (let i = 0; i < resultLen; ++i) {
        const item = value.view[i + start];
        result[i] = this.stringPool.indexToString(item);
      }
      return result;
    }
    throw new Error("Key holds a value that is not a list");
  }
  addSetItem(item, set) {
    const idx = this.stringPool.stringToIndex(item);
    if (idx === null) {
      set.add(this.stringPool.add(item));
    } else {
      if (!set.add(idx)) {
        this.stringPool.add(item);
      }
    }
  }
  addSet(key, values) {
    this.clearExpired();
    const entry = this.addEntry(key);
    const value = entry.value;
    if (value !== null) {
      this.stringPool.delete(key);
      if (value instanceof BitSet) {
        for (const item of values) {
          this.addSetItem(item, value);
        }
      } else {
        throw new Error("Key holds a value that is not a set");
      }
      return;
    }
    entry.value = BitSet.empty();
    for (const item of values) {
      this.addSetItem(item, entry.value);
    }
  }
  removeSet(key, values) {
    this.clearExpired();
    const entry = this.getEntry(key);
    const value = entry.value;
    if (value instanceof BitSet) {
      for (const item of values) {
        const idx = this.stringPool.stringToIndex(item);
        if (idx !== null && value.delete(idx)) {
          this.stringPool.delete(item);
        }
      }
      return;
    }
    throw new Error("Key holds a value that is not a set");
  }
  itemsToStrings(items) {
    const result = new Array(items.length);
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      result[i] = this.stringPool.indexToString(item);
    }
    return result;
  }
  getSet(key) {
    this.clearExpired();
    const entry = this.getEntry(key);
    const value = entry.value;
    if (value instanceof BitSet) {
      const items = value.items();
      return this.itemsToStrings(items);
    }
    throw new Error("Key holds a value that is not a set");
  }
  collectSets(keys) {
    const sets = new Array(keys.length);
    for (let i = 0; i < keys.length; ++i) {
      const key = keys[i];
      const entry = this.getEntry(key);
      const value = entry.value;
      if (value instanceof BitSet) {
        sets[i] = value;
      } else {
        throw new Error(`Key '${key}' holds a value that is not a set`);
      }
    }
    return sets;
  }
  unionSet(keys) {
    this.clearExpired();
    const sets = this.collectSets(keys);
    const items = BitSet.union(sets).items();
    return this.itemsToStrings(items);
  }
  intersectSet(keys) {
    this.clearExpired();
    const sets = this.collectSets(keys);
    const items = BitSet.intersect(sets).items();
    return this.itemsToStrings(items);
  }
  keys() {
    this.clearExpired();
    const result = new Array();
    for (let i = 0; i < this.data.length; ++i) {
      if (this.data[i].value !== null) {
        result.push(this.stringPool.indexToString(i));
      }
    }
    return result;
  }
  ttl(key) {
    this.clearExpired();
    const idx = this.stringPool.stringToIndex(key);
    if (idx === null || idx >= this.data.length) return -2;
    const entry = this.data[idx];
    const currentTime = Date.now() / 1e3;
    if (entry.expiry === null) return -1;
    return entry.expiry.expireTime - currentTime;
  }
  serialize() {
    const result = {
      stringPool: this.stringPool.values,
      data: []
    };
    for (const entry of this.data) {
      const value = entry.value;
      const expireTime = entry.expiry?.expireTime;
      if (value === null) {
        result.data.push({
          expireTime
        });
        continue;
      }
      if (typeof value === "number") {
        result.data.push({
          value: {
            kind: "string",
            data: value
          },
          expireTime
        });
        continue;
      }
      if (value instanceof NumberList) {
        result.data.push({
          value: {
            kind: "list",
            data: Array.from(value.view)
          },
          expireTime
        });
        continue;
      }
      if (value instanceof BitSet) {
        result.data.push({
          value: {
            kind: "set",
            data: Array.from(value.items())
          },
          expireTime
        });
        continue;
      }
      assertNever(value);
    }
    return result;
  }
  static deserialize({ data, stringPool: stringpool }) {
    const refcount = NumberList.zeros(stringpool.length);
    const entries = new Array();
    for (let i = 0; i < data.length; ++i) {
      const { value, expireTime } = data[i];
      if (value !== void 0) {
        refcount.view[i] += 1;
        let entry;
        switch (value.kind) {
          case "string":
            {
              entry = new KVEntry(value.data);
              refcount.view[value.data] += 1;
            }
            break;
          case "list":
            {
              const list = NumberList.fromArray(value.data);
              for (const item of list.view) {
                refcount.view[item] += 1;
              }
              entry = new KVEntry(list);
            }
            break;
          case "set":
            {
              const set = BitSet.empty();
              for (const item of value.data) {
                if (!set.add(item)) {
                  refcount.view[item] += 1;
                }
              }
              entry = new KVEntry(set);
            }
            break;
          default:
            assertNever(value);
        }
        if (expireTime !== void 0) {
          entry.expiry = new Expiry(expireTime);
        }
        entries.push(entry);
      } else {
        entries.push(new KVEntry(null));
      }
    }
    const pool = new StringPool(stringpool, refcount);
    return new _KVStore(pool, entries);
  }
};

// src/context.ts
function tokenize(input2) {
  const tokens = [];
  let currentToken = "";
  let quoteOpen = false;
  let escaping = false;
  let force = false;
  for (const char of input2) {
    if (escaping) {
      currentToken += char;
      escaping = false;
    } else if (char === "\\" && !escaping) {
      escaping = true;
    } else if (char === '"') {
      quoteOpen = !quoteOpen;
      force = true;
    } else if (" 	\n\r\v\f".includes(char) && !quoteOpen) {
      if (currentToken.length > 0 || force) {
        tokens.push(currentToken);
        currentToken = "";
        force = false;
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken.length > 0 || force) {
    tokens.push(currentToken);
  }
  if (quoteOpen || escaping) {
    throw new Error("Unterminated string input");
  }
  return tokens;
}
function getParam(params, idx, name) {
  if (idx >= params.length) {
    throw new Error(`Parameter '${name}' not provided`);
  }
  return params[idx];
}
function getIntParam(params, idx, name) {
  const param = parseInt(getParam(params, idx, name));
  if (isNaN(param)) {
    throw new Error(`Parameter '${name}' is not a number`);
  }
  return param;
}
var Context = class {
  store = new KVStore();
  async executeQuery(query) {
    try {
      const tokens = tokenize(query);
      if (tokens.length < 1) {
        return {
          kind: "error",
          message: "Empty query"
        };
      }
      const cmd = tokens[0].toUpperCase();
      const params = tokens.slice(1);
      switch (cmd) {
        case "SET": {
          const key = getParam(params, 0, "key");
          const value = getParam(params, 1, "value");
          this.store.setString(key, value);
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "GET": {
          const key = getParam(params, 0, "key");
          const value = this.store.getString(key);
          return {
            kind: "result",
            data: [
              value
            ]
          };
        }
        case "RPUSH": {
          const key = getParam(params, 0, "key");
          const args = params.slice(1);
          this.store.pushArray(key, args);
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "RPOP": {
          const key = getParam(params, 0, "key");
          const result = this.store.popArray(key);
          if (result === null) {
            return {
              kind: "result",
              data: []
            };
          } else {
            return {
              kind: "result",
              data: [
                result
              ]
            };
          }
        }
        case "LRANGE": {
          const key = getParam(params, 0, "key");
          const start = getIntParam(params, 1, "start");
          const end = getIntParam(params, 2, "end");
          const result = this.store.sliceArray(key, start, end);
          return {
            kind: "result",
            data: result
          };
        }
        case "SADD": {
          const key = getParam(params, 0, "key");
          const args = params.slice(1);
          this.store.addSet(key, args);
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "SREM": {
          const key = getParam(params, 0, "key");
          const args = params.slice(1);
          this.store.removeSet(key, args);
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "SMEMBERS": {
          const key = getParam(params, 0, "key");
          const result = this.store.getSet(key);
          return {
            kind: "result",
            data: result
          };
        }
        case "SINTER": {
          const result = this.store.intersectSet(params);
          return {
            kind: "result",
            data: result
          };
        }
        case "SUNION": {
          const result = this.store.unionSet(params);
          return {
            kind: "result",
            data: result
          };
        }
        case "KEYS": {
          const result = this.store.keys();
          return {
            kind: "result",
            data: result
          };
        }
        case "DEL": {
          const key = getParam(params, 0, "key");
          this.store.delete(key);
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "EXPIRE": {
          const key = getParam(params, 0, "key");
          const seconds = getIntParam(params, 1, "seconds");
          this.store.expireKey(key, seconds);
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "TTL": {
          const key = getParam(params, 0, "key");
          const result = this.store.ttl(key);
          return {
            kind: "result",
            data: [
              result.toFixed()
            ]
          };
        }
        case "SAVE": {
          const data = this.store.serialize();
          await this.save(JSON.stringify(data));
          return {
            kind: "info",
            message: "OK"
          };
        }
        case "RESTORE": {
          const data = await this.load();
          this.store = KVStore.deserialize(JSON.parse(data));
          return {
            kind: "info",
            message: "OK"
          };
        }
        default: {
          return {
            kind: "error",
            message: `Unsupported command: ${cmd}`
          };
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        return {
          kind: "error",
          message: e.message
        };
      } else {
        return {
          kind: "error",
          message: "An unknown error occurred"
        };
      }
    }
  }
};

// src/index.ts
var TestContext = class extends Context {
  savedData = null;
  save(data) {
    this.savedData = data;
    return Promise.resolve();
  }
  load() {
    if (this.savedData === null) {
      return Promise.reject(new Error("No data has been saved to this context"));
    }
    return Promise.resolve(this.savedData);
  }
};
var ctx = new TestContext();
console.log(await ctx.executeQuery("SET hello world"));
console.log(await ctx.executeQuery("GET hello"));
var form = assertClass(HTMLFormElement, document.getElementById("input-form"));
var input = assertClass(HTMLInputElement, document.getElementById("input-query"));
form.addEventListener("submit", (e) => {
  console.log(input.value);
  e.preventDefault();
  form.reset();
});
