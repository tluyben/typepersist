# CoreDB Documentation

## Overview

CoreDB is a TypeScript database abstraction layer built on top of Knex.js. It provides a simple, consistent interface for database operations with built-in support for schema management, transactions, and a flexible query builder.

## Installation

```bash
npm install knex sqlite3
```

## Basic Usage

```typescript
import { CoreDB } from "./CoreDB";

// Initialize database
const db = new CoreDB("path/to/database.sqlite");

// Create or update schema
await db.schemaCreateOrUpdate({
  name: "users",
  implementation: "Static",
  fields: [
    { name: "name", type: "Text", required: true },
    { name: "email", type: "Text", indexed: true },
  ],
});

// Insert data
await db.insert("users", {
  name: "John Doe",
  email: "john@example.com",
});
```

## API Reference

### Constructor

```typescript
const db = new CoreDB(connectionString: string)
```

Creates a new CoreDB instance with the specified connection string.

### Schema Management

#### useDB

```typescript
await db.useDB(name: string): Promise<void>
```

Switches to or creates a new database. For SQLite, this is mostly a no-op as databases are separate files.

#### schemaCreateOrUpdate

```typescript
await db.schemaCreateOrUpdate(tableDefinition: TableDefinition): Promise<void>
```

Creates a new table or updates an existing one based on the provided definition.

TableDefinition structure:

```typescript
type TableDefinition = {
  name: string;
  implementation: "Static" | "Dynamic";
  description?: string;
  fields: FieldDef[];
};
```

FieldDef structure:

```typescript
type FieldDef = {
  name: string;
  type: string;
  minimum?: number;
  maximum?: number;
  indexed?: string;
  precision?: number;
  required?: boolean;
  ordering?: number;
  defaultValue?: string;
  system?: boolean;
  referenceName?: string;
  options?: string[];
  indexName?: string;
};
```

Supported field types:

- Text
- Integer
- Float
- Boolean
- Date
- DateTime
- Time
- Choice

#### schemaDrop

```typescript
await db.schemaDrop(name: string): Promise<void>
```

Drops a table if it exists.

#### schemaDropField

```typescript
await db.schemaDropField(tableName: string, fieldName: string): Promise<void>
```

Removes a field from a table.

#### schemaRename

```typescript
await db.schemaRename(oldName: string, newName: string): Promise<void>
```

Renames a table.

#### schemaRenameField

```typescript
await db.schemaRenameField(schema: string, oldName: string, newName: string): Promise<void>
```

Renames a field in a table.

#### schemaConnect

```typescript
await db.schemaConnect(parentName: string, childName: string): Promise<void>
```

Creates a foreign key relationship between two tables. This method:

- Creates a foreign key column named `{parentName}Id` in the child table
- Makes it reference the `id` field of the parent table
- Adds ON DELETE CASCADE behavior for automatic cleanup of child records
- Creates an index on the foreign key for better query performance
- Is idempotent (safe to call multiple times)

Example:

```typescript
// Create a foreign key relationship between authors and books
await db.schemaConnect("authors", "books"); // Creates authorsId in books table
```

### Data Operations

#### insert

```typescript
await db.insert(tableName: string, data: Record<string, any>, tx?: Knex.Transaction): Promise<number>
```

Inserts a new record and returns the inserted ID.

#### update

```typescript
await db.update(tableName: string, id: number, data: Record<string, any>, tx?: Knex.Transaction): Promise<void>
```

Updates an existing record by ID.

#### upsert

```typescript
await db.upsert(tableName: string, data: Record<string, any>, tx?: Knex.Transaction): Promise<number>
```

Updates an existing record or inserts a new one if it doesn't exist.

#### delete

```typescript
await db.delete(tableName: string, ids: number[], tx?: Knex.Transaction): Promise<void>
```

Deletes records by their IDs.

### Query Builder

The query method supports a flexible query structure for complex queries:

```typescript
await db.query(query: Query): Promise<any[]>
```

Query structure:

```typescript
type TableQuery = {
  table: string;
  query?: Where; // Optional query specific to this table
};

type Query = {
  table: TableQuery[]; // At least one table is required
  field?: { [table: string]: string[] };
  query?: Where; // Main query that applies to all tables
  sort?: Sort[];
  page?: number;
  limit?: number;
  groupFields?: string[];
};
```

When using multiple tables in a query, they must have foreign key relationships established using `schemaConnect`. Each table after the first one must have a foreign key reference to one of the previous tables in the list. The results will be returned in a nested structure where child records are included as arrays under their parent record.

For example, if you have authors and books tables connected with a foreign key, the results would look like:

```typescript
[
  {
    id: 1,
    name: "Stephen King",
    books: [
      { id: 1, title: "The Shining", genre: "horror" },
      { id: 2, title: "IT", genre: "horror" },
    ],
  },
];
```

Where conditions can be:

```typescript
type Where = WhereBoolOr | WhereBoolAnd | WhereCmp;

type WhereCmp = {
  left: number | string;
  leftType: "Field" | "Array" | "Variable" | "SearchString" | "Value";
  cmp:
    | "eq"
    | "neq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "like"
    | "nlike"
    | "in"
    | "nin"
    | "not";
  right: number | string | Date | number[];
  rightType: CmpValueType;
};
```

### Transactions

```typescript
// Start transaction
const tx = db.startTransaction();

try {
  await db.insert("users", { name: "John" }, tx);
  await db.insert("profiles", { userId: 1 }, tx);
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

## Examples

### Basic CRUD Operations

```typescript
// Create table
await db.schemaCreateOrUpdate({
  id: 1,
  name: "users",
  implementation: "Static",
  fields: [
    { name: "name", type: "Text", required: true },
    { name: "email", type: "Text", indexed: true },
    { name: "age", type: "Integer" },
  ],
});

// Insert
const userId = await db.insert("users", {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Update
await db.update("users", userId, {
  age: 31,
});

// Delete
await db.delete("users", [userId]);
```

### Table Relationships and Joins

```typescript
// Define tables
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
    { name: "genre", type: "Text" },
  ],
});

// Create foreign key relationship
await db.schemaConnect("authors", "books");

// Insert data
const authorId = await db.insert("authors", { name: "Stephen King" });
await db.insert("books", {
  title: "The Shining",
  genre: "horror",
  authorsId: authorId,
});
await db.insert("books", {
  title: "IT",
  genre: "horror",
  authorsId: authorId,
});

// Query authors with their horror books
const results = await db.query({
  table: [
    { table: "authors" },
    {
      table: "books",
      query: {
        left: "genre",
        leftType: "Field",
        cmp: "eq",
        right: "horror",
        rightType: "Value",
      },
    },
  ],
});

// Results will be nested:
// [
//   {
//     id: 1,
//     name: "Stephen King",
//     books: [
//       { id: 1, title: "The Shining", genre: "horror" },
//       { id: 2, title: "IT", genre: "horror" }
//     ]
//   }
// ]
```

### Complex Queries with Joins

```typescript
// First establish the relationship
await db.schemaConnect("authors", "books");

// Query authors and their horror books
const results = await db.query({
  table: [
    { table: "authors" },
    {
      table: "books",
      query: {
        left: "genre",
        leftType: "Field",
        cmp: "eq",
        right: "horror",
        rightType: "Value",
      },
    },
  ],
  query: {
    And: [
      {
        left: "age",
        leftType: "Field",
        cmp: "gt",
        right: 25,
        rightType: "SearchString",
      },
      {
        Or: [
          {
            left: "name",
            leftType: "Field",
            cmp: "like",
            right: "John",
            rightType: "SearchString",
          },
          {
            left: "email",
            leftType: "Field",
            cmp: "like",
            right: "@example.com",
            rightType: "SearchString",
          },
        ],
      },
    ],
  },
  sort: [{ fieldId: "name", direction: "asc" }],
  limit: 10,
  page: 1,
});
```

### Transaction Example

```typescript
const tx = db.startTransaction();

try {
  // Create user
  const userId = await db.insert(
    "users",
    {
      name: "John Doe",
      email: "john@example.com",
    },
    tx
  );

  // Create profile
  await db.insert(
    "profiles",
    {
      userId: userId,
      bio: "Software Developer",
    },
    tx
  );

  await tx.commit();
} catch (error) {
  await tx.rollback();
  console.error("Transaction failed:", error);
  throw error;
}
```

## Error Handling

CoreDB throws errors in the following cases:

- Invalid connection string
- Invalid table definition
- Invalid field type
- Database operation failures
- Transaction failures

Example error handling:

```typescript
try {
  await db.schemaCreateOrUpdate(tableDefinition);
} catch (error) {
  if (error instanceof Error) {
    console.error("Schema creation failed:", error.message);
  }
  throw error;
}
```

## Best Practices

1. Always use transactions for related operations
2. Close the database connection when done:
   ```typescript
   await db.close();
   ```
3. Use proper error handling with try-catch blocks
4. Define schemas with appropriate field types and constraints
5. Use indexes for frequently queried fields
6. Set appropriate field constraints (required, default values)

## Limitations

1. Currently optimized for SQLite
2. Limited support for advanced SQL features
3. No built-in migration system

## Future Improvements

1. Support for more database types
2. Migration system
3. Query optimization
4. Advanced join operations
5. Better type safety
6. Connection pooling
7. Improved error handling
8. Support for more complex queries
