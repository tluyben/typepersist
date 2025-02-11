# Import Functionality

TypePersist supports multiple import formats for schema and data:

## Import Formats

### Schema-only Import
Used to define table structures without data:
```json
[
  {
    "name": "User",
    "implementation": "Static",
    "fields": [
      {
        "name": "email",
        "type": "Text",
        "required": true,
        "indexed": "Unique"
      }
    ]
  }
]
```

### Data-only Import
Used to import data into existing tables:
```json
{
  "User": [
    {
      "email": "user@example.com",
      "name": "Test User"
    }
  ]
}
```

### Combined Schema and Data Import

#### Flat Format
The traditional format with separate schema and data sections:
```json
{
  "schema": [
    {
      "name": "User",
      "implementation": "Static",
      "fields": [
        {
          "name": "email",
          "type": "Text",
          "required": true
        }
      ]
    },
    {
      "name": "Post",
      "implementation": "Static",
      "fields": [
        {
          "name": "title",
          "type": "Text",
          "required": true
        },
        {
          "name": "authorId",
          "type": "ReferenceManyToOne",
          "required": true,
          "foreignTable": "User",
          "indexed": "Foreign",
          "indexedFields": ["authorId"]
        }
      ]
    }
  ],
  "data": {
    "User": [
      {
        "id": 1,
        "email": "user@example.com"
      }
    ],
    "Post": [
      {
        "title": "First Post",
        "authorId": 1
      }
    ]
  }
}
```

#### Nested Format
A format that mirrors the nested query results, where related data is nested within parent records:
```json
{
  "schema": [
    {
      "name": "Publisher",
      "implementation": "Static",
      "fields": [
        {
          "name": "name",
          "type": "Text",
          "required": true
        }
      ]
    },
    {
      "name": "Author",
      "implementation": "Static",
      "fields": [
        {
          "name": "name",
          "type": "Text",
          "required": true
        },
        {
          "name": "publisherId",
          "type": "ReferenceManyToOne",
          "required": true,
          "foreignTable": "Publisher",
          "indexed": "Foreign",
          "indexedFields": ["publisherId"]
        }
      ]
    },
    {
      "name": "Book",
      "implementation": "Static",
      "fields": [
        {
          "name": "title",
          "type": "Text",
          "required": true
        },
        {
          "name": "authorId",
          "type": "ReferenceManyToOne",
          "required": true,
          "foreignTable": "Author",
          "indexed": "Foreign",
          "indexedFields": ["authorId"]
        }
      ]
    }
  ],
  "data": {
    "Publisher": [
      {
        "id": 1,
        "name": "Viking Press",
        "Author": [
          {
            "id": 1,
            "name": "Stephen King",
            "publisherId": 1,
            "Book": [
              {
                "title": "The Shining",
                "authorId": 1
              }
            ]
          }
        ]
      }
    ]
  }
}
```

The nested format allows you to represent relationships in a more natural way that matches how the data is queried. When using nested format:

1. Each record can contain nested arrays of related records using the table name as the key
2. Foreign key fields (e.g., `publisherId`, `authorId`) are automatically handled
3. The order of tables in the schema must follow the relationship hierarchy (parent tables before children)
4. IDs are optional - if not provided, they will be auto-generated while maintaining relationships

## Import Process

1. Schema Creation
   - Tables are created in the order specified in the schema
   - Foreign key relationships are established automatically based on field definitions

2. Data Import
   - For flat format: Data is imported table by table
   - For nested format: Parent records are inserted first, followed by their children, with foreign keys automatically managed
   - IDs are preserved if provided, otherwise auto-generated
   - Foreign key constraints are enforced during import

## Examples

See the `examples/` directory for complete examples of each import format:
- `schema-only.json`: Schema-only import example
- `data-only.json`: Data-only import example
- `schema-and-data.json`: Combined import with flat format
- `nested-data.json`: Combined import with nested format
