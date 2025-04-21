# CoreDBPlus Guide for LLMs 🤖

This guide provides detailed information about the CoreDBPlus class, which extends CoreDB with enhanced functionality for complex queries and table relationships.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Type Definitions](#type-definitions)
- [Examples](#examples)

## Installation

```bash
npm install typepersist
```

## Basic Usage

```typescript
import { CoreDBPlus } from "typepersist";

// Initialize database
const db = new CoreDBPlus("path/to/database.sqlite");

// Create tables
await db.createTable({
  name: "users",
  fields: [
    { name: "name", type: "Text", required: true },
    { name: "email", type: "Text", indexed: true },
    { name: "age", type: "Integer" },
  ],
});

await db.createTable({
  name: "posts",
  fields: [
    { name: "title", type: "Text", required: true },
    { name: "content", type: "Text" },
    { name: "userId", type: "Integer" },
  ],
});

// Create relationship
await db.schemaConnect("users", "posts");
```

## Advanced Features

### 1. Enhanced Query Interface

CoreDBPlus provides a more intuitive query interface using the `WherePlus` type:

```typescript
// Simple where clause
const results = await db.query({
  table: [
    {
      table: "users",
      query: {
        field: "age",
        cmp: "gt",
        value: 25,
      },
    },
  ],
});

// Complex conditions with AND/OR
const results = await db.query({
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
});
```

### 2. Table Joins

CoreDBPlus supports nested table joins with automatic relationship handling:

```typescript
// Join users with their posts
const results = await db.query({
  table: [{ table: "users" }, { table: "posts" }],
});

// Results will be nested:
// {
//   id: 1,
//   name: "John",
//   posts: [
//     { id: 1, title: "Post 1" },
//     { id: 2, title: "Post 2" }
//   ]
// }
```

### 3. Field Selection

You can specify which fields to return from each table:

```typescript
const results = await db.query({
  table: [{ table: "users" }, { table: "posts" }],
  field: {
    users: ["name", "email"],
    posts: ["title"],
  },
});
```

### 4. Sorting and Pagination

```typescript
const results = await db.query({
  table: [{ table: "users" }],
  sort: [{ fieldId: "name", direction: "asc" }],
  page: 1,
  limit: 10,
});
```

## Type Definitions

### WherePlus Types

```typescript
type WhereCmpPlus = {
  field: string;
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
  value: string | number | Date | number[];
};

type WhereBoolOr = {
  Or: WherePlus[];
};

type WhereBoolAnd = {
  And: WherePlus[];
};

type WherePlus = WhereBoolOr | WhereBoolAnd | WhereCmpPlus;
```

### Query Types

```typescript
type TableQueryPlus = {
  table: string;
  query?: WherePlus;
};

type QueryPlus = {
  table: TableQueryPlus[];
  field?: { [table: string]: string[] };
  sort?: Sort[];
  page?: number;
  limit?: number;
  groupFields?: string[];
};
```

## Examples

### 1. Complex Query with Multiple Conditions

```typescript
const results = await db.query({
  table: [
    {
      table: "users",
      query: {
        And: [
          { field: "age", cmp: "gt", value: 25 },
          {
            Or: [
              { field: "email", cmp: "like", value: "@gmail.com" },
              { field: "email", cmp: "like", value: "@yahoo.com" },
            ],
          },
        ],
      },
    },
  ],
});
```

### 2. Multi-table Join with Field Selection

```typescript
const results = await db.query({
  table: [{ table: "users" }, { table: "posts" }],
  field: {
    users: ["name", "email"],
    posts: ["title", "content"],
  },
  sort: [{ fieldId: "name", direction: "asc" }],
});
```

### 3. Paginated Results with Complex Filtering

```typescript
const results = await db.query({
  table: [
    {
      table: "users",
      query: {
        And: [
          { field: "age", cmp: "gte", value: 18 },
          { field: "age", cmp: "lte", value: 65 },
        ],
      },
    },
  ],
  sort: [{ fieldId: "name", direction: "asc" }],
  page: 1,
  limit: 20,
});
```

### 4. Three-way Table Join

```typescript
// Assuming we have users, posts, and comments tables
const results = await db.query({
  table: [{ table: "users" }, { table: "posts" }, { table: "comments" }],
  field: {
    users: ["name"],
    posts: ["title"],
    comments: ["content"],
  },
});
```

## Best Practices

1. Always use type definitions for better type safety
2. Use field selection to optimize query performance
3. Implement proper error handling
4. Use transactions for data integrity
5. Index frequently queried fields
6. Use appropriate comparison operators
7. Implement pagination for large result sets

## Error Handling

```typescript
try {
  const results = await db.query({
    table: [{ table: "users" }],
  });
} catch (error) {
  if (error instanceof Error) {
    console.error("Query failed:", error.message);
  }
}
```

## Performance Considerations

1. Use field selection to limit returned data
2. Implement proper indexing
3. Use pagination for large datasets
4. Optimize join operations
5. Use appropriate comparison operators
6. Consider query complexity

## Limitations

1. Currently optimized for SQLite
2. Limited support for complex SQL operations
3. No built-in migration system
4. Basic query optimization

## Support

For issues, questions, or contributions, please visit the GitHub repository.
