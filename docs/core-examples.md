// Initialize database
const db = new CoreDB('path/to/database.sqlite');

// Create table
const tableDef: TableDefinition = {
id: 1,
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

// Query with the same format as before
const result = await db.query('users', {
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
