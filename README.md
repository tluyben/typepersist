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

TypePersist provides three ways to interact with your database:

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
    { fields: ["category", "sku"], type: "Unique" },
  ],
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

### 3. Using TypeSafeDB (Type-Safe API) 🔒

```typescript
import {
  TypeSafeDB,
  eq,
  And,
  Or,
  Where,
  SortBy,
  Field,
  TableField,
} from "typepersist";
import { User } from "typepersist";

// Initialize database
const db = new TypeSafeDB("path/to/database.sqlite");

// Create or update schema based on TypeScript type
// The table name will be derived from the type name (e.g., "User" -> "user")
await db.schemaCreateOrUpdate<User>();

// You can also specify a custom table name if needed
await db.schemaCreateOrUpdate<User>("custom_users");

// Insert data - table name is derived from the type
const userId = await db.insert<User>({
  email: "john@example.com",
  mobileNumber: "+1234567890",
  countryCode: "+1",
  firstName: "John",
  lastName: "Doe",
  residentialAddress: "123 Main St",
  suburb: "Downtown",
  city: "New York",
  state: "NY",
  postcode: "10001",
  country: "USA",
  passcode: "hashedpasscode",
  isFaceIdEnabled: true,
  isPinEnabled: false,
  pin: "",
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Query data with type safety - Method 1: Using the query builder
const user = await db
  .query<User>("user")
  .where("email", eq, "john@example.com")
  .first();

// Complex queries with type safety - Method 1: Using the query builder
const users = await db
  .query<User>("user")
  .or(
    Where<User>("country", eq, "USA"),
    And(
      Where<User>("isFaceIdEnabled", eq, true),
      Where<User>("isPinEnabled", eq, false)
    )
  )
  .orderBy("lastName", "asc")
  .orderBy("firstName", "asc")
  .execute();

// Query data with type safety - Method 2: Using the query method
// Simple query with field selection
const users1 = await db.query<User>(
  Where<User>("email", eq, "john@example.com"),
  ["email", "id"]
);

// Query with field aliases
const users2 = await db.query<User>(
  Where<User>("email", eq, "john@example.com"),
  [
    { field: "email", as: "userEmail" },
    { field: "firstName", as: "first" },
    { field: "lastName", as: "last" },
  ]
);

// Complex query with AND condition
const users3 = await db.query<User>(
  And(
    Where<User>("email", eq, "john@example.com"),
    Where<User>("isFaceIdEnabled", eq, true)
  ),
  ["email", "id", "firstName", "lastName"],
  [SortBy<User>("createdAt", "desc")],
  1, // page
  10 // limit
);

// Complex query with nested conditions
const users4 = await db.query<User>(
  Or(
    Where<User>("email", like, "%example.com"),
    And(Where<User>("country", eq, "USA"), Where<User>("state", eq, "CA"))
  ),
  ["email", "id", "country", "state"],
  [SortBy<User>("lastName"), SortBy<User>("firstName")]
);

// Multi-table query with field aliases
// Define types for the tables
type User = {
  id: number;
  name: string;
  email: string;
};

type Post = {
  id: number;
  userId: number;
  title: string;
  content: string;
};

// Create tables
await db.schemaCreateOrUpdate<User>();
await db.schemaCreateOrUpdate<Post>();

// Insert data
const userId = await db.insert<User>({
  name: "John Doe",
  email: "john@example.com",
});

const postId = await db.insert<Post>({
  userId: userId,
  title: "My First Post",
  content: "This is the content of my first post.",
});

// Query with table fields and aliases
const results = await db.query<User, Post>(Where<Post>("userId", eq, userId), [
  { table: "user", field: "name", as: "authorName" },
  { table: "user", field: "email", as: "authorEmail" },
  { table: "post", field: "title", as: "postTitle" },
  { table: "post", field: "content", as: "postContent" },
]);

// Update data - table name is derived from the type
await db.update<User>(userId, {
  firstName: "Johnny",
  updatedAt: new Date(),
});

// Delete data - table name is derived from the type
await db.delete<User>([userId]);
```

Choose the API that best fits your needs:

- Use `CoreDB` for direct, low-level database operations
- Use `DB` for a more fluent, chainable API with TypeScript-friendly methods
- Use `TypeSafeDB` for full type safety with TypeScript types

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
