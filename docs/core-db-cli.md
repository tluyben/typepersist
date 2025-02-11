# CoreDB CLI

A command-line interface for CoreDB that provides a REPL environment for database management and schema operations.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/TypePersist.git
cd TypePersist

# Install dependencies
npm install

# Build the project
npm run build
```

## Command Line Options

The CLI supports several command line options for non-interactive operations:

```bash
node src/core-db-cli.ts [options]
```

### Options

- `-connection <string>`: Specify the database connection string
  - Default: SQLite in-memory database (":memory:")
  - Example: `-connection "mydb.sqlite"`

- `-import <file>`: Import schema and data from a file
  - Supports JSON and SQL formats
  - Example: `-import schema.json` or `-import dump.sql`

- `-export <tables...>`: Export specified tables
  - Can list multiple tables
  - Example: `-export users posts comments`

- `-include-data`: Include table data in exports (optional)
  - Example: `-export users -include-data`

- `-format <type>`: Specify export format (optional)
  - Values: `json` (default) or `sql`
  - Example: `-export users -format sql`

### Examples

```bash
# Start with a new SQLite database
node src/core-db-cli.ts -connection "mydb.sqlite"

# Import a schema with data
node src/core-db-cli.ts -connection "mydb.sqlite" -import schema.json

# Export specific tables as SQL
node src/core-db-cli.ts -connection "mydb.sqlite" -export users posts -format sql -include-data
```

## REPL Commands

The CLI provides an interactive REPL with the following commands:

### Table Operations

#### /tables [format]
List all tables in the database.
```bash
> /tables             # Default tabular format
> /tables json        # JSON format
> /tables sql         # SQL CREATE statements
```

#### /describe <table> [format]
Show table definition including fields and their types.
```bash
> /describe users             # Default tabular format
> /describe users json        # JSON format
> /describe users sql         # SQL CREATE statement
```

#### /create-table <name>
Create a new table.
```bash
> /create-table users
```

#### /drop-table <table>
Drop an existing table.
```bash
> /drop-table users
```

#### /rename-table <old> <new>
Rename an existing table.
```bash
> /rename-table users customers
```

### Field Operations

#### /create-field <table> <field> <type> [index]
Add a new field to a table. Optionally specify an index type.
```bash
> /create-field users name Text
> /create-field users email Text unique
> /create-field users age Integer
> /create-field users created_at DateTime default
```

Available field types:
- Text
- Integer
- Float
- Boolean
- Date
- DateTime
- Time
- Choice

Index options:
- `default`: Creates a standard index
- `unique`: Creates a unique index

#### /drop-field <table> <field>
Remove a field from a table.
```bash
> /drop-field users age
```

#### /rename-field <table> <old> <new>
Rename a field in a table.
```bash
> /rename-field users name full_name
```

### Table Relationships

#### /join-table <parent> <child>
Create a foreign key relationship between tables.
```bash
> /join-table users posts        # Creates posts.usersId foreign key
```

## Import/Export Formats

### JSON Format

The JSON import/export format follows this structure:

```json
{
  "tables": [
    {
      "name": "users",
      "implementation": "Dynamic",
      "fields": [
        {
          "name": "name",
          "type": "Text",
          "required": true
        },
        {
          "name": "email",
          "type": "Text",
          "indexed": "unique"
        },
        {
          "name": "age",
          "type": "Integer"
        }
      ],
      "data": [
        {
          "name": "John Doe",
          "email": "john@example.com",
          "age": 30
        }
      ]
    }
  ]
}
```

### SQL Format

The SQL export format generates standard SQL statements:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  age INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

INSERT INTO users (name, email, age) VALUES ('John Doe', 'john@example.com', 30);
```

## Example Workflow

Here's a complete example of setting up a blog database:

```bash
# Start the CLI
node src/core-db-cli.ts -connection "blog.sqlite"

# Create tables
> /create-table users
> /create-field users username Text unique
> /create-field users email Text unique
> /create-field users created_at DateTime default

> /create-table posts
> /create-field posts title Text
> /create-field posts content Text
> /create-field posts published_at DateTime

# Create relationship
> /join-table users posts

# Verify schema
> /tables
> /describe users
> /describe posts

# Export schema
> /tables sql > schema.sql
```

## Error Handling

The CLI provides clear error messages for common issues:

- Table/field already exists
- Invalid field type
- Missing required parameters
- Database connection errors
- SQL syntax errors
- Foreign key constraint violations

Example error messages:
```bash
> /create-table users
Error creating table: Table 'users' already exists

> /create-field users age Text123
Error creating field: Invalid field type: Text123

> /join-table users posts
Error joining tables: Table 'posts' does not exist
