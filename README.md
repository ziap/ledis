# Ledis

A lightweight, in-memory KV-store and a command-line interface within a web browser.

Live demo: <https://ziap.github.io/ledis>.

## Features

- **In-Memory Storage**: All data is stored in memory for rapid data access and manipulation.
- **Supported Environments**: The key-value store is designed to run entirely within a web browser, in-memory and is fully self-contained. Its modular design also allows it to be adapted for use in other JavaScript runtimes.
- **Multiple Data Structures**: The store supports different data types:
  - **Strings**: Store simple string values.
  - **Lists**: Manage ordered collections of strings.
  - **Sets**: Handle unordered collections of unique strings.
- **Key Expiration**: Keys can be set with a time-to-live (TTL), after which they will automatically be deleted.
- **Data Persistence**: The entire database can be serialized to a string and later restored, providing a way to save and load data.
- **Efficient Memory Management**: A string pool with custom garbage collection is used to ensure that each unique string is stored only once, reducing memory overhead and improving some operations.
- **Custom Storage Back-end**: The system is designed for extensibility, allowing for custom storage back-ends and integration with various storage solutions like file systems, databases, or cloud services.
- **CI/CD for Testing and Deployment**: The repository is configured with a (CI/CD) pipeline to automate the testing and deployment processes.

## Quick Start

This project uses [Deno](https://deno.com/) as the JavaScript runtime and TypeScript transpiler. Output of `deno --version` on the development environment:

```
deno 2.4.5 (stable, release, x86_64-unknown-linux-gnu)
v8 13.7.152.14-rusty
typescript 5.8.3
```

Building the JavaScript files for the web CLI:

```bash
deno task build
```

View the web CLI locally using any HTTP file server and browser, for example:

```bash
python -m http.server 3000
chromium http://localhost:3000/
```

Running the tests (optionally add `--coverage` to get test coverage information):

```bash
deno test
```

## Commands

The key-value store can be controlled through a set of commands:

#### String Commands

- `SET <key> <value>`: Sets a string value for a given key.
- `GET <key>`: Retrieves the string value of a key.

#### List Commands

- `RPUSH <key> <value1> [<value2> ...]`: Appends one or more values to the end of a list.
- `RPOP <key>`: Removes and returns the last element of a list.
- `LRANGE <key> <start> <end>`: Returns a range of elements from a list.

#### Set Commands

- `SADD <key> <member1> [<member2> ...]`: Adds one or more members to a set.
- `SREM <key> <member1> [<member2> ...]`: Removes one or more members from a set.
- `SMEMBERS <key>`: Returns all members of a set.
- `SINTER <key1> [<key2> ...]`: Returns the intersection of multiple sets.
- `SUNION <key1> [<key2> ...]`: Returns the union of multiple sets.

#### Key Management Commands

- `KEYS`: Returns all keys in the store.
- `DEL <key>`: Deletes a key and its associated value.
- `EXPIRE <key> <seconds>`: Sets a time-to-live on a key.
- `TTL <key>`: Returns the remaining time-to-live of a key.

#### Persistence Commands

- `SAVE`: Serializes the current state of the store.
- `RESTORE`: Restores the store from a serialized state.

## License

This project is licensed under the [MIT License](LICENSE).
