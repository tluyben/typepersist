# TypePersist 🚀

> ⚠️ **WARNING: This project is a Work in Progress (WIP) and far from finished. Use at your own risk in production environments.**

## What is TypePersist? 🤔

TypePersist is a powerful TypeScript database abstraction layer that lets you persist and query data as easily as working with TypeScript arrays. Built on top of Knex.js, it provides a simple, type-safe interface for database operations with built-in support for:

- 📊 Schema management
- 🔄 Transactions
- 🔍 Flexible query builder
- 🔗 Table relationships
- 🎯 Type safety

## Features ✨

- 🛠️ **Simple Schema Management**: Create, update, and modify database schemas using TypeScript interfaces
- 🔒 **Type-Safe Operations**: Leverage TypeScript's type system for database operations
- 📝 **Flexible Querying**: Build complex queries with a simple, chainable API
- 🤝 **Relationship Support**: Easily manage and query related data with foreign key relationships
- ⚡ **Transaction Support**: Built-in transaction management for data integrity
- 🎨 **Clean API**: Intuitive API design that feels natural to TypeScript developers

## Installation 📦

```bash
npm install typepersist
```

## Quick Start 🚀

TypePersist provides two ways to interact with your database:

### 1. Using CoreDB (Low-level API) 💪

```typescript
import { CoreDB } from "typepersist";

// Initialize database
const db = new CoreDB("path/to/database.sqlite");

// Define schema
await db.schemaCreateOrUpdate({
  name: "users",
  implementation: "Static",
  fields: [
    { name: "name", type: "Text", required: true },
    { name: "email", type: "Text", indexed: true },
    { name: "age", type: "Integer" },
  ],
});

// Insert data
const userId = await db.insert("users", {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Query data
const results = await db.query({
  table: [{ table: "users" }],
  query: {
    left: "age",
    leftType: "Field",
    cmp: "gt",
    right: 25,
    rightType: "Value",
  },
});

// Define schema with compound indexes
await db.schemaCreateOrUpdate({
  name: "products",
  implementation: "Static",
  fields: [
    { name: "name", type: "Text" },
    { name: "category", type: "Text" },
    { name: "sku", type: "Text" },
  ],
  compoundIndexes: [
    { fields: ["name", "category"], type: "Default" },
    { fields: ["category", "sku"], type: "Unique" }
  ]
});
```

### 2. Using DB (Fluent Wrapper API) 🎯

```typescript
import { DB } from "typepersist";

// Initialize database
const db = new DB("path/to/database.sqlite");

// Define schema using fluent API
await db.createTable(
  db
    .schema("users")
    .field("name")
    .type("Text")
    .required()
    .done()
    .field("email")
    .type("Text")
    .index()
    .done()
    .field("age")
    .type("Integer")
    .done()
);

// Create table with compound indexes
await db.createTable(
  db
    .schema("products")
    .field("name")
    .type("Text")
    .done()
    .field("category")
    .type("Text")
    .done()
    .field("sku")
    .type("Text")
    .done()
    .compoundDefaultKey(["name", "category"]) // Create a default compound index
    .compoundUniqueKey(["category", "sku"]) // Create a unique compound index
);

// Insert data
const userId = await db.insert("users", {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Query data using fluent API
const results = await db
  .query("users")
  .where("age", Cmp.Gt, 25)
  .orderBy("name", "asc")
  .limit(10)
  .execute();

// Aggregation functions
const count = await db.query("users").count(); // Count all records
const sum = await db.query("users").sum("age"); // Sum of ages
const avg = await db.query("users").avg("age"); // Average age
const exists = await db.query("users").exists(); // Check if any records exist
const first = await db.query("users").first(); // Get first record
```

Choose the API that best fits your needs:

- Use `CoreDB` for direct, low-level database operations
- Use `DB` for a more fluent, chainable API with TypeScript-friendly methods

## Working with Relationships 🔗

```typescript
// Define related tables
await db.schemaCreateOrUpdate({
  name: "authors",
  implementation: "Static",
  fields: [{ name: "name", type: "Text", required: true }],
});

await db.schemaCreateOrUpdate({
  name: "books",
  implementation: "Static",
  fields: [
    { name: "title", type: "Text", required: true },
    { name: "publishYear", type: "Integer" },
  ],
});

// Create relationship
await db.schemaConnect("authors", "books");

// Query related data
const results = await db.query({
  table: [{ table: "authors" }, { table: "books" }],
  sort: [{ fieldId: "publishYear", direction: "asc" }],
});
```

## Current Limitations ⚠️

1. 🎯 Currently optimized for SQLite only
2. 🏗️ No built-in migration system
3. 🔍 Limited support for advanced SQL features
4. 📊 Basic query optimization

## Roadmap 🗺️

- [ ] Support for additional database types (PostgreSQL, MySQL)
- [ ] Migration system
- [ ] Query optimization improvements
- [ ] Advanced join operations
- [ ] Enhanced type safety
- [ ] Connection pooling
- [ ] Improved error handling
- [ ] Complex query support
- [ ] Documentation improvements
- [ ] More examples and use cases

## Contributing 🤝

As this project is still in early development, we welcome contributions but please note that APIs and functionality may change significantly. Feel free to:

- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📖 Improve documentation

## License 📄

MIT

## Support 💬

This is an active WIP project. For questions, bug reports, or feature requests, please open an issue on GitHub.

---

Made with ❤️ for TypeScript developers who want database operations to feel natural and type-safe.
