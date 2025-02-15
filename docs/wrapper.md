# TypePersist Wrapper API Documentation

The TypePersist Wrapper provides a fluent, chainable API for interacting with the CoreDB database. It simplifies database operations through an intuitive interface for schema definition, querying, and data manipulation.

## Table of Contents
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Schema Management](#schema-management)
  - [Creating Tables](#creating-tables)
  - [Field Types](#field-types)
  - [Indexes](#indexes)
  - [Compound Indexes](#compound-indexes)
- [Querying Data](#querying-data)
  - [Basic Queries](#basic-queries)
  - [Comparison Operators](#comparison-operators)
  - [Combining Conditions](#combining-conditions)
  - [Sorting and Pagination](#sorting-and-pagination)
  - [Aggregation Methods](#aggregation-methods)
- [Relationships and Joins](#relationships-and-joins)
- [Data Manipulation](#data-manipulation)
- [Transactions](#transactions)
- [Advanced Features](#advanced-features)

## Installation

```typescript
import { Wrapper, Cmp } from './core-js-wrapper';
```

## Basic Setup

Create a new database instance:

```typescript
// In-memory database
const db = new Wrapper(":memory:");

// File-based database
const db = new Wrapper("path/to/database.db");

// Using existing CoreDB instance
const db = new Wrapper(existingCoreDBInstance);
```

## Schema Management

### Creating Tables

The wrapper provides a fluent API for defining table schemas:

```typescript
await db.schema("users")
    .field("name").type("Text").required().done()
    .field("age").type("Integer").done()
    .field("email").type("Text").index("Unique").done()
    .execute();
```

### Field Types

Available field types:
- `Text`: String data
- `Integer`: Whole numbers
- `Float`: Decimal numbers
- `Boolean`: True/false values
- `Date`: Date/time values
- `ReferenceManyToOne`: Foreign key reference
- `ReferenceOneToMany`: Inverse relationship reference

Field modifiers:
- `required()`: Makes the field mandatory
- `default(value)`: Sets a default value
- `precision(value)`: Sets precision for numeric fields
- `index(type)`: Creates an index (Default/Unique/Foreign)

```typescript
db.schema("products")
    .field("name")
        .type("Text")
        .required()
        .done()
    .field("price")
        .type("Float")
        .precision(2)
        .done()
    .field("inStock")
        .type("Boolean")
        .default("true")
        .done()
```

### Indexes

Individual field indexes:
```typescript
.field("email")
    .type("Text")
    .index("Unique")  // or .uniqueKey()
    .done()

.field("category")
    .type("Text")
    .index("Default") // or .defaultKey()
    .done()
```

### Compound Indexes

Create indexes across multiple fields:

```typescript
db.schema("products")
    .field("category").type("Text").done()
    .field("sku").type("Text").done()
    // Create compound indexes
    .compoundUniqueKey(["category", "sku"])
    .compoundDefaultKey(["name", "category"])
    .execute();
```

## Querying Data

### Basic Queries

```typescript
// Simple query
const users = await db.query("users")
    .where("age", Cmp.Gte, 25)
    .execute();

// Get first result
const user = await db.query("users")
    .where("email", Cmp.Eq, "john@example.com")
    .first();

// Check existence
const exists = await db.query("users")
    .where("id", Cmp.Eq, 1)
    .exists();
```

### Comparison Operators

Available operators (Cmp enum):
- `Eq`: Equal to
- `Neq`/`Ne`: Not equal to
- `Gt`: Greater than
- `Gte`: Greater than or equal
- `Lt`: Less than
- `Lte`: Less than or equal
- `Like`: Pattern matching
- `NotLike`: Negative pattern matching
- `In`: In array
- `NotIn`: Not in array
- `Not`: Negation

```typescript
// Pattern matching
.where("name", Cmp.Like, "John%")

// Range comparison
.where("age", Cmp.Gte, 18)
.where("age", Cmp.Lte, 65)

// In array
.where("status", Cmp.In, ["active", "pending"])
```

### Combining Conditions

```typescript
// AND conditions
db.query("users")
    .where("age", Cmp.Gte, 25)
    .and("age", Cmp.Lte, 35)
    .execute();

// OR conditions
db.query("users")
    .where("age", Cmp.Gte, 65)
    .or("status", Cmp.Eq, "premium")
    .execute();

// Complex combinations
db.query("users")
    .where("age", Cmp.Gte, 18)
    .and("country", Cmp.Eq, "US")
    .or("status", Cmp.Eq, "verified")
    .execute();
```

### Sorting and Pagination

```typescript
// Sorting
db.query("users")
    .orderBy("age", "desc")
    .orderBy("name", "asc")
    .execute();

// Pagination
db.query("users")
    .limit(10)    // Results per page
    .page(2)      // Page number
    .execute();
```

### Aggregation Methods

```typescript
// Count results
const count = await db.query("users")
    .where("status", Cmp.Eq, "active")
    .count();

// Sum values
const total = await db.query("orders")
    .where("status", Cmp.Eq, "completed")
    .sum("amount");

// Average values
const avgAge = await db.query("users")
    .avg("age");
```

## Relationships and Joins

Define relationships using reference fields:

```typescript
// Create authors table with publisher reference
await db.schema("authors")
    .field("name").type("Text").required().done()
    .field("publishersId")
        .type("ReferenceManyToOne")
        .reference("publishers")
        .done()
    .execute();

// Query with joins
const results = await db.query("publishers")
    .join("authors")
    .where("name", Cmp.Like, "Stephen%")
    .join("books")
    .execute();
```

## Data Manipulation

```typescript
// Insert data
const id = await db.insert("users", {
    name: "John Doe",
    age: 30,
    email: "john@example.com"
});

// Update data
await db.update("users", id, {
    age: 31
});

// Delete data
await db.delete("users", id);

// Delete multiple records
await db.delete("users", [1, 2, 3]);

// Delete based on query
await db.query("users")
    .where("status", Cmp.Eq, "inactive")
    .delete();
```

## Transactions

```typescript
// Start a transaction
const trx = await db.startTransaction();

try {
    // Perform operations
    await trx.insert("users", { name: "John" });
    await trx.insert("profiles", { userId: 1 });
    
    // Commit the transaction
    await trx.commitTransaction();
} catch (error) {
    // Rollback on error
    await trx.rollbackTransaction();
} finally {
    // Release transaction resources
    await trx.releaseTransaction();
}
```

## Advanced Features

### Schema Dumping

Dump schema definition for inspection or migration:

```typescript
const schema = db.schema("users")
    .field("name").type("Text").required().done()
    .field("age").type("Integer").done();

const definition = schema.dump();
```

### Query Dumping

Inspect the generated query structure:

```typescript
const query = db.query("users")
    .where("age", Cmp.Gte, 25)
    .and("name", Cmp.Like, "John%")
    .orderBy("age", "desc");

const definition = query.dump();
```

### Table Management

```typescript
// Drop table
await db.dropTable("users");

// Drop field
await db.dropField("users", "age");

// Close database connection
await db.close();
```
