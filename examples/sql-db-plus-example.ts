import { FieldType, QueryPlus, TableDefinitionPlus } from "../src/core-db-plus";
import { SQLDBPlus } from "../src/sql-db-plus";
import { SQLiteAdapter } from "../src/sqlite-adapter";

async function main() {
  // Create a SQLite adapter
  const sqliteAdapter = new SQLiteAdapter("example.sqlite");

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

  // Insert some data
  const userId1 = await db.insert("users", {
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  });
  const userId2 = await db.insert("users", {
    name: "Jane Smith",
    email: "jane@example.com",
    age: 25,
  });

  console.log("Inserted users with IDs:", userId1, userId2);

  // Query the data
  const query: QueryPlus = {
    table: [{ table: "users" }],
    sort: [{ fieldId: "name", direction: "asc" }],
  };

  const users = await db.query(query);
  console.log("Users:", users);

  // Update a user
  await db.update("users", userId1, { age: 31 });

  // Query with a filter
  const filteredQuery: QueryPlus = {
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
  };

  const olderUsers = await db.query(filteredQuery);
  console.log("Users older than 25:", olderUsers);

  // Delete a user
  await db.delete("users", [userId2]);

  // Query again to see the changes
  const remainingUsers = await db.query(query);
  console.log("Remaining users:", remainingUsers);

  // Close the database
  await db.close();
  await sqliteAdapter.close();
}

main().catch(console.error);
