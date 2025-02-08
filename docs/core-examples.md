// Initialize database
const db = new CoreDB('path/to/database.sqlite');

// Create table
const tableDef: TableDefinition = {
name: 'users',
implementation: 'Static',
fields: [
{ name: 'name', type: 'Text', required: true },
{ name: 'age', type: 'Integer' },
{ name: 'email', type: 'Text', indexed: true }
]
};
await db.schemaCreateOrUpdate(tableDef);

// Insert with transaction
const tx = db.startTransaction();
try {
await db.insert('users', { name: 'John', age: 30 }, tx);
await db.insert('users', { name: 'Jane', age: 25 }, tx);
await tx.commit();
} catch (error) {
await tx.rollback();
throw error;
}

// Query example
const result = await db.query({
  table: ['users'],
  query: {
    Or: [
      {
        left: 'name',
        leftType: 'Field',
        cmp: 'like',
        right: 'Jo',
        rightType: 'SearchString'
      },
      {
        left: 'age',
        leftType: 'Field',
        cmp: 'gt',
        right: 25,
        rightType: 'SearchString'
      }
    ]
  },
  sort: [{ fieldId: 'name', direction: 'asc' }],
  limit: 10,
  page: 1
});

// Table Relationships Example
const authorTableDef: TableDefinition = {
  name: 'authors',
  implementation: 'Static',
  fields: [
    { name: 'name', type: 'Text', required: true },
    { name: 'email', type: 'Text', indexed: true }
  ]
};

const bookTableDef: TableDefinition = {
  name: 'books',
  implementation: 'Static',
  fields: [
    { name: 'title', type: 'Text', required: true },
    { name: 'publishYear', type: 'Integer' }
  ]
};

// Create tables and establish relationship
await db.schemaCreateOrUpdate(authorTableDef);
await db.schemaCreateOrUpdate(bookTableDef);
await db.schemaConnect('authors', 'books'); // Creates authorsId in books table

// Insert related data with transaction
const tx = await db.startTransaction();
try {
  // Create author
  const authorId = await db.insert('authors', {
    name: 'J.K. Rowling',
    email: 'jk@example.com'
  }, tx);

  // Create books by this author
  await db.insert('books', {
    title: 'Harry Potter and the Philosopher\'s Stone',
    publishYear: 1997,
    authorsId: authorId  // Foreign key reference
  }, tx);

  await db.insert('books', {
    title: 'Harry Potter and the Chamber of Secrets',
    publishYear: 1998,
    authorsId: authorId  // Foreign key reference
  }, tx);

  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}

// Query books by author
const books = await db.query({
  table: ['books'],
  query: {
    left: 'authorsId',
    leftType: 'Field',
    cmp: 'eq',
    right: authorId,
    rightType: 'Value'
  },
  sort: [{ fieldId: 'publishYear', direction: 'asc' }]
});
