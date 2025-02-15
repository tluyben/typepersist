# TypeScript Schema Transformer

The TypePersist schema transformer automatically converts TypeScript type definitions into runtime-validated database operations. It uses TypeScript's transformer API to analyze your schema types and generate the necessary runtime code.

## Schema Definition

Schemas are defined using simple TypeScript types with constraint markers:

```typescript
import { DB, DBUnique, DBRequired } from '../src/types';

// Just define the tables with their types - the transformer handles everything else
const users: DB<{
    email: DBUnique<string>;
    name: string;
    age: number;
    isActive: boolean;
}> = null!; // The transformer will replace this

const orders: DB<{
    orderId: DBUnique<string>;
    userId: DBRequired<number>;
    productId: DBRequired<number>;
    quantity: number;
    orderDate: Date;
    status: 'pending' | 'shipped' | 'delivered';
}> = null!; // The transformer will replace this
```

## Type Constraints

The following type constraints are supported:

- `DBUnique<T>` - Field must have unique values
- `DBRequired<T>` - Field is required (cannot be null)
- `DBDefault<T, D>` - Field has a default value
- `DBForeignKey<T, TableName>` - Field references another table

## What the Transformer Does

The transformer automatically:
1. Analyzes your type definitions
2. Creates database tables with proper schemas
3. Sets up Zod validation
4. Creates type-safe query builders
5. Handles all CRUD operations with runtime checks

For example, this code:
```typescript
const users: DB<{
    email: DBUnique<string>;
    name: string;
}> = null!;
```

Is transformed into:
```typescript
const users = new Wrapper(db)
  .schema('users')
  .withZodSchema(z.object({
    email: z.string().refine(() => true, { message: 'Must be unique' }),
    name: z.string()
  }));
```

## Project Setup

1. Install the package:
```bash
npm install typepersist
```

2. Add the transformer to your `tsconfig.json`:
```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "typepersist-transform" }
    ]
  }
}
```

3. Initialize the wrapper in a shared file:
```typescript
// db.ts - Wrapper initialization
import { Wrapper } from 'typepersist';

// Initialize the wrapper with a database connection
export const db = new Wrapper(':memory:');
```

4. Define your schemas in separate files:
```typescript
// schema/users.ts
import { DB, DBUnique } from 'typepersist';
import { db } from '../db';  // Import the shared wrapper instance

// The transformer will use the 'db' variable in scope
export const users: DB<{
    id: DBUnique<number>;
    email: DBUnique<string>;
    name: string;
}> = null!;

// The transformer will:
// 1. Create the users table if it doesn't exist
// 2. Set up unique constraints on id and email
// 3. Add runtime validation
// 4. Make the table available for querying
```

5. Import and use your schemas:
```typescript
// main.ts
import { db } from './db';
import './schema/users';
import './schema/orders';

// The wrapper handles all database operations
async function main() {
    await users.insert({ email: 'test@example.com', name: 'Test' });
    // ...
}
```

## How the Transformer Finds the Wrapper

The transformer looks for a variable named `db` in scope that is an instance of `Wrapper`. When it finds this variable, it uses it to create the runtime implementation. This means:

1. The variable must be named `db`
2. It must be imported or defined in the same file as your schema
3. It must be an instance of `Wrapper`

For example:
```typescript
// This works - 'db' is imported and in scope
import { db } from '../db';
const users: DB<...> = null!;

// This also works - 'db' is defined in the same file
const db = new Wrapper(':memory:');
const users: DB<...> = null!;

// This doesn't work - wrong variable name
import { wrapper } from '../db';
const users: DB<...> = null!;  // Error: Cannot find 'db' in scope

// This doesn't work - wrong type
import { db } from '../db';  // db is CoreDB, not Wrapper
const users: DB<...> = null!;  // Error: 'db' must be instance of Wrapper
```

This design ensures that all tables in a file use the same database connection while keeping the code simple and explicit.

## Type Safety

The transformer ensures full type safety:

```typescript
// This compiles and is validated at runtime
await users.insert({
    email: 'test@example.com',
    name: 'Test User',
    age: 25,
    isActive: true
});

// These don't compile
await users.insert({ email: 'test@example.com' }); // Missing required fields
await users.update(1, { age: 'twenty six' }); // Wrong type
await orders.insert({ status: 'invalid' }); // Invalid enum value
```

## Query Builder

The transformer also provides a type-safe query builder:

```typescript
const activeUsers = await users.query()
    .where('isActive', 'eq', true)
    .orderBy('name', 'asc')
    .limit(10)
    .get();

const userOrders = await orders.query()
    .where('userId', 'eq', userId)
    .where('status', 'eq', 'pending')
    .get();
```

## Table Relationships

The transformer automatically handles table relationships through foreign keys:

```typescript
// Define related tables
const users: DB<{
    id: DBUnique<number>;
    email: DBUnique<string>;
    name: string;
}> = null!;

const orders: DB<{
    id: DBUnique<number>;
    userId: DBForeignKey<number, 'users'>;  // References users table
    amount: number;
}> = null!;

const orderItems: DB<{
    id: DBUnique<number>;
    orderId: DBForeignKey<number, 'orders'>;  // References orders table
    productId: number;
    quantity: number;
}> = null!;

// The transformer ensures referential integrity
await users.insert({ email: 'test@example.com', name: 'Test' });
const userId = await users.query()
    .where('email', 'eq', 'test@example.com')
    .first()
    .then(user => user!.id);

// This works - valid foreign key
await orders.insert({ userId, amount: 100 });

// This fails - invalid foreign key
await orders.insert({ userId: 999, amount: 100 }); // Runtime error: Invalid foreign key
```

The transformer:
1. Sets up proper foreign key constraints in the database
2. Validates foreign keys at runtime
3. Maintains referential integrity
4. Provides type safety for relationships
5. Enables type-safe joins in queries

## Implementation Details

The transformer:
1. Uses TypeScript's transformer API to analyze type definitions
2. Extracts constraint information from type markers
3. Generates appropriate Zod schemas for validation
4. Creates wrapper code for database operations
5. Maintains full type safety throughout

## Error Handling and Debugging

The transformer provides helpful error messages in several situations:

### Compile-Time Errors

```typescript
// Missing 'db' variable in scope
const users: DB<...> = null!;
// Error: Could not find 'db' variable of type Wrapper in scope

// Wrong wrapper type
import { db } from './db';  // db is CoreDB
const users: DB<...> = null!;
// Error: Variable 'db' must be an instance of Wrapper

// Invalid foreign key reference
const orders: DB<{
    userId: DBForeignKey<number, 'invalid_table'>;
}> = null!;
// Error: Could not find table 'invalid_table' in scope
```

### Runtime Validation

```typescript
// Unique constraint violation
await users.insert({ email: 'test@example.com' });
await users.insert({ email: 'test@example.com' });
// Error: Unique constraint violation on field 'email'

// Foreign key constraint
await orders.insert({ userId: 999 });
// Error: Foreign key constraint violation: userId=999 not found in users.id

// Type validation
await users.insert({ age: 'twenty five' });
// Error: Invalid type for field 'age'. Expected number, got string
```

### Debugging Tips

1. Check the generated code:
   ```typescript
   // Add debug logging to tsconfig.json
   {
     "compilerOptions": {
       "plugins": [{
         "transform": "typepersist-transform",
         "debug": true  // Logs generated code
       }]
     }
   }
   ```

2. Verify wrapper initialization:
   ```typescript
   // db.ts
   import { Wrapper } from 'typepersist';
   
   export const db = new Wrapper(':memory:');
   console.log('Wrapper initialized:', db.isInitialized());  // Debug check
   ```

3. Check table creation:
   ```typescript
   // After importing schemas
   import './schema/users';
   import './schema/orders';
   
   console.log('Tables:', await db.listTables());  // Shows created tables
   ```

## Limitations and Best Practices

### Limitations

1. Single Database Connection
   - Each file must have one `db` variable in scope
   - Cannot use multiple database connections in the same file
   - Cannot dynamically switch databases

2. Schema Definition
   - Must use `null!` initializer for tables
   - Cannot use computed or dynamic types
   - Cannot extend or implement interfaces
   - Type constraints must be direct (no type aliases)

3. Runtime Behavior
   - Tables are created on first access
   - No automatic migrations (yet)
   - No transaction support across tables
   - No circular foreign key references

### Best Practices

1. Schema Organization
   ```typescript
   // ✅ Good: One table per file
   // users.ts
   export const users: DB<{...}> = null!;
   
   // orders.ts
   export const orders: DB<{...}> = null!;
   
   // ❌ Bad: Multiple tables in one file
   export const users: DB<{...}> = null!;
   export const orders: DB<{...}> = null!;
   ```

2. Type Constraints
   ```typescript
   // ✅ Good: Direct type constraints
   type User = {
       email: DBUnique<string>;
       name: string;
   };
   const users: DB<User> = null!;
   
   // ❌ Bad: Indirect constraints
   type Email = DBUnique<string>;
   type User = {
       email: Email;  // Won't work
       name: string;
   };
   ```

3. Foreign Keys
   ```typescript
   // ✅ Good: Reference table by string name
   const orders: DB<{
       userId: DBForeignKey<number, 'users'>;
   }> = null!;
   
   // ❌ Bad: Using type reference
   const orders: DB<{
       userId: DBForeignKey<number, typeof users>;  // Won't work
   }> = null!;
   ```

4. Initialization
   ```typescript
   // ✅ Good: Single wrapper instance
   // db.ts
   export const db = new Wrapper(':memory:');
   
   // ❌ Bad: Multiple instances
   // users.ts
   const db = new Wrapper(':memory:');
   // orders.ts
   const db = new Wrapper(':memory:');
   ```

5. Imports
   ```typescript
   // ✅ Good: Import wrapper first
   import { db } from '../db';
   import { DB, DBUnique } from 'typepersist';
   
   // ❌ Bad: Missing wrapper import
   import { DB, DBUnique } from 'typepersist';
   // No db in scope!
   ```

## Future Improvements

Planned enhancements:
1. Support for computed fields
2. More advanced validation rules
3. Custom type validators
4. Schema migration helpers
5. Better error messages
6. Schema diffing and auto-migration
7. Improved relationship handling:
   - Many-to-many relationships
   - Eager loading
   - Cascading deletes
   - Composite foreign keys
8. Enhanced debugging tools:
   - Schema visualization
   - Query logging
   - Performance profiling
