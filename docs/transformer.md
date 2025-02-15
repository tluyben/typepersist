# TypeScript Schema Transformer

The TypePersist schema transformer provides a type-safe way to define database schemas with runtime validation. It uses TypeScript's transformer API to convert schema definitions into runtime-validated database operations.

## Schema Definition

Schemas are defined using a fluent API with field constructors and constraint decorators:

```typescript
import { 
  defineSchema, string, number, boolean, date, enum_,
  unique, required, foreignKey
} from '../src/types';

const UserSchema = defineSchema({
  id: unique(number()),
  email: unique(string()),
  name: required(string()),
  age: number(),
  isActive: boolean(),
  createdAt: date()
});

const OrderSchema = defineSchema({
  id: unique(number()),
  userId: foreignKey(number(), 'users'),
  amount: number(),
  status: enum_('pending', 'completed', 'cancelled'),
  createdAt: date()
});
```

## Field Types

The following field types are supported:

- `string()` - String fields
- `number()` - Numeric fields
- `boolean()` - Boolean fields
- `date()` - Date fields
- `enum_(...values)` - Enum fields with predefined values

## Constraints

Fields can have the following constraints:

- `unique(field)` - Field must have unique values
- `required(field)` - Field is required (cannot be null)
- `defaultValue(field, value)` - Field has a default value
- `foreignKey(field, tableName)` - Field references another table

## Runtime Validation

The transformer automatically generates Zod schemas for runtime validation:

```typescript
// Original code
const users: DB<typeof UserSchema> = null!;

// Transformed to
const users = new Wrapper(db)
  .schema('users')
  .withZodSchema(z.object({
    id: z.number().int().refine(() => true, { message: 'Must be unique' }),
    email: z.string().refine(() => true, { message: 'Must be unique' }),
    name: z.string().required(),
    age: z.number(),
    isActive: z.boolean(),
    createdAt: z.date()
  }));
```

## Type Safety

The transformer provides full type safety:

```typescript
// This compiles
await users.insert({
  email: 'test@example.com',
  name: 'Test User',
  age: 25,
  isActive: true,
  createdAt: new Date()
});

// These don't compile
await users.insert({ email: 'test@example.com' }); // Missing required fields
await users.update(1, { age: 'twenty six' }); // Wrong type
await orders.insert({ status: 'invalid' }); // Invalid enum value
```

## Metadata Storage

Schema metadata is stored in a non-enumerable `__metadata` property:

```typescript
const metadata = (schema as any).__metadata;
// {
//   id: { type: 'number', isUnique: true },
//   email: { type: 'string', isUnique: true },
//   name: { type: 'string', isRequired: true },
//   ...
// }
```

This metadata is used by the transformer to:
1. Generate Zod schemas
2. Create database tables
3. Set up constraints
4. Handle foreign key relationships

## Auto-Generated IDs

The type system handles auto-generated IDs by:
1. Excluding 'id' from insert operations
2. Preventing 'id' updates
3. Maintaining type safety for queries

```typescript
// ID is auto-generated
const userId = await users.insert({
  email: 'test@example.com',
  name: 'Test User'
});

// Can query by ID
const user = await users.query()
  .where('id', '=', userId)
  .first();
```

## Implementation Details

The transformer:
1. Uses TypeScript's transformer API to analyze schema definitions
2. Extracts type information and constraints
3. Generates appropriate Zod schemas
4. Creates wrapper code for runtime validation
5. Preserves type safety throughout

The type system:
1. Uses discriminated unions for field types
2. Separates metadata from runtime types
3. Provides helper types for schema manipulation
4. Ensures type safety for all operations
5. Maintains runtime type information

## Using the Transformer

### CLI Usage

The transformer can be run using the CLI:

```bash
# Transform a single file
npx typepersist-transform src/schema.ts

# Transform multiple files
npx typepersist-transform "src/**/*.ts"

# Watch mode
npx typepersist-transform --watch "src/**/*.ts"
```

The transformer will:
1. Find all schema definitions in the source files
2. Generate runtime validation code
3. Create database tables if they don't exist
4. Set up indexes and constraints
5. Preserve your original type definitions

### Configuration

You can configure the transformer in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "typepersist-transform",
        "autoCreateTables": true,
        "validateOnInsert": true,
        "validateOnUpdate": true
      }
    ]
  }
}
```

Or use a separate config file:

```json
// typepersist.config.json
{
  "databaseUrl": "sqlite://:memory:",
  "schemaPath": "src/schema",
  "outputDir": "dist",
  "validateOnInsert": true,
  "validateOnUpdate": true,
  "autoCreateTables": true
}
```

## Future Improvements

Planned enhancements:
1. Support for computed fields
2. More advanced validation rules
3. Custom type validators
4. Schema migration helpers
5. Better error messages
6. Schema diffing and auto-migration
7. Integration with popular ORMs
8. GraphQL schema generation
