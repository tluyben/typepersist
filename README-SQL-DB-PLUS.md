# SQLDBPlus

SQLDBPlus is a lightweight database abstraction layer specifically designed for SQLite. It provides a CoreDBPlus/CoreDB compatible interface without using Knex, making it ideal for environments where you want to avoid the Knex dependency.

## Features

- Compatible with CoreDBPlus/CoreDB interface
- No Knex dependency
- Direct SQLite operations
- Support for complex queries
- Transaction management
- Schema management

## Installation

```bash
npm install typepersist
```

## Basic Usage

```typescript
import { SQLDBPlus } from "typepersist";
import { SQLiteAdapter } from "typepersist";
import { FieldType, TableDefinitionPlus, QueryPlus } from "typepersist";

// Create a SQLite adapter
const sqliteAdapter = new SQLiteAdapter("path/to/database.sqlite");

// Create a SQLDBPlus instance
const db = new SQLDBPlus(sqliteAdapter);

// Define a table
const userTableDef: TableDefinitionPlus = {
  name: "users",
  fields: [
    { name: "name", type: "Text" as FieldType, required: true },
    { name: "email", type: "Text" as FieldType, indexed: "Unique" },
    { name: "age", type: "Integer" as FieldType },
  ],
};

// Create the table
await db.createTable(userTableDef);

// Insert data
const userId = await db.insert("users", {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Query data
const query: QueryPlus = {
  table: [{ table: "users" }],
  sort: [{ fieldId: "name", direction: "asc" }],
};

const users = await db.query(query);
console.log(users);

// Update data
await db.update("users", userId, { age: 31 });

// Delete data
await db.delete("users", [userId]);

// Close the database
await db.close();
await sqliteAdapter.close();
```

## Creating a Custom SQLite Interface

You can create your own SQLite interface by implementing the `SQLiteInterface` interface:

```typescript
import { SQLiteInterface } from "typepersist";

class MySQLiteAdapter implements SQLiteInterface {
  async execSql(sql: string, params: any[] = []): Promise<void> {
    // Implement SQL execution
  }

  async querySql(sql: string, params: any[] = []): Promise<any[]> {
    // Implement SQL querying
  }
}
```

## Advanced Query Examples

### Complex Filtering

```typescript
const query: QueryPlus = {
  table: [
    {
      table: "users",
      query: {
        And: [
          { field: "age", cmp: "gt", value: 25 },
          { field: "email", cmp: "like", value: "@gmail.com" },
        ],
      },
    },
  ],
};

const results = await db.query(query);
```

### Field Selection

```typescript
const query: QueryPlus = {
  table: [{ table: "users" }],
  field: {
    users: ["name", "email"],
  },
};

const results = await db.query(query);
```

### Sorting and Pagination

```typescript
const query: QueryPlus = {
  table: [{ table: "users" }],
  sort: [{ fieldId: "name", direction: "asc" }],
  page: 1,
  limit: 10,
};

const results = await db.query(query);
```

## Transaction Management

```typescript
// Start a transaction
await db.startTransaction();

try {
  // Perform operations
  await db.insert("users", {
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  });
  await db.insert("users", {
    name: "Jane Smith",
    email: "jane@example.com",
    age: 25,
  });

  // Commit the transaction
  await db.commitTransaction();
} catch (error) {
  // Rollback the transaction on error
  await db.rollbackTransaction();
  throw error;
}
```

## Limitations

- Currently optimized for SQLite
- Some schema operations (like dropping columns) are not fully implemented due to SQLite limitations
- No built-in migration system

## Differences from CoreDBPlus

SQLDBPlus is designed to be compatible with CoreDBPlus but has some differences:

1. It doesn't use Knex, so it's more lightweight
2. It directly generates SQL for SQLite operations
3. Some schema operations are simplified or not implemented due to SQLite limitations
4. It requires a SQLite interface implementation (like SQLiteAdapter)

## License

MIT
