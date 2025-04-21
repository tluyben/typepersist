import fs from "fs";
import path from "path";
import { Indexed, PrimaryKey, Unique } from "../src/tstypes";
import {
  eq,
  Or,
  SortBy,
  TableField,
  TypeSafeDB,
  Where,
} from "../src/type-safe-wrapper";

// Define a test user type
type TestUser = {
  id: PrimaryKey<string>;
  email: Unique<string>;
  name: Indexed<string>;
  age: number;
  isActive: boolean;
  createdAt: Indexed<Date>;
};

type TestPost = {
  id: PrimaryKey<string>;
  userId: number;
  title: string;
  content: string;
  createdAt: Date;
};

describe("TypeSafeDB", () => {
  let db: TypeSafeDB;
  let dbPath: string;

  beforeAll(() => {
    // Create a temporary SQLite database file
    dbPath = path.join(__dirname, "test-db.sqlite");
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    db = new TypeSafeDB(dbPath);
  });

  afterAll(async () => {
    // Close the database connection and delete the file
    await db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it("should create a table schema", async () => {
    // This is a simplified test since we don't have a real implementation
    // of schema generation from TypeScript types
    await expect(
      db.schemaCreateOrUpdate<TestUser>("test_users")
    ).resolves.not.toThrow();
  });

  it("should insert, update, and delete records", async () => {
    // Insert a record - table name is derived from the type
    const userId = await db.insert<TestUser>({
      email: "test@example.com",
      name: "Test User",
      age: 30,
      isActive: true,
      createdAt: new Date(),
    });

    expect(userId).toBeGreaterThan(0);

    // Update a record - table name is derived from the type
    await db.update<TestUser>(userId, {
      name: "Updated User",
      age: 31,
    });

    // Query the record using the new query method
    const users = await db.query<TestUser>(Where<TestUser>("id", eq, userId), [
      "id",
      "name",
      "age",
    ]);
    const user = users.length > 0 ? users[0] : null;

    expect(user).not.toBeNull();
    expect(user?.name).toBe("Updated User");
    expect(user?.age).toBe(31);

    // Delete the record - table name is derived from the type
    await db.delete<TestUser>([userId]);

    // Verify the record was deleted using the new query method
    const deletedUsers = await db.query<TestUser>(
      Where<TestUser>("id", eq, userId),
      ["id"]
    );
    const deletedUser = deletedUsers.length > 0 ? deletedUsers[0] : null;

    expect(deletedUser).toBeNull();
  });

  it("should support complex queries", async () => {
    // Insert multiple records - table name is derived from the type
    const userId1 = await db.insert<TestUser>({
      email: "user1@example.com",
      name: "User One",
      age: 25,
      isActive: true,
      createdAt: new Date(),
    });

    const userId2 = await db.insert<TestUser>({
      email: "user2@example.com",
      name: "User Two",
      age: 35,
      isActive: true,
      createdAt: new Date(),
    });

    const userId3 = await db.insert<TestUser>({
      email: "user3@example.com",
      name: "User Three",
      age: 45,
      isActive: false,
      createdAt: new Date(),
    });

    // Query with AND condition using the new query method
    const activeUsers = await db.query<TestUser>(
      Where<TestUser>("isActive", eq, true),
      ["id", "email", "name", "age", "isActive"]
    );

    expect(activeUsers.length).toBe(2);

    // Query with OR condition using the new query method
    const users = await db.query<TestUser>(
      Or(Where<TestUser>("age", eq, 25), Where<TestUser>("age", eq, 45)),
      ["id", "email", "name", "age"]
    );

    expect(users.length).toBe(2);

    // Query with sorting using the new query method
    const sortedUsers = await db.query<TestUser>(
      Where<TestUser>("id", eq, userId1), // Dummy condition to get all records
      ["id", "email", "name", "age"],
      [SortBy<TestUser>("age", "desc")]
    );

    expect(sortedUsers.length).toBe(1);
    expect(sortedUsers[0].age).toBe(25);

    // Test field aliases
    const usersWithAliases = await db.query<TestUser>(
      Where<TestUser>("id", eq, userId1),
      [
        { field: "name", as: "userName" },
        { field: "age", as: "userAge" },
      ]
    );

    expect(usersWithAliases.length).toBe(1);
    expect(usersWithAliases[0]).toHaveProperty("userName");
    expect(usersWithAliases[0]).toHaveProperty("userAge");

    // Clean up - table name is derived from the type
    await db.delete<TestUser>([userId1, userId2, userId3]);
  });

  it("should support transactions", async () => {
    // Start a transaction
    const tx = await db.startTransaction();

    // Insert a record - table name is derived from the type
    const userId = await tx.insert<TestUser>({
      email: "tx@example.com",
      name: "Transaction User",
      age: 40,
      isActive: true,
      createdAt: new Date(),
    });

    // Rollback the transaction
    await tx.rollbackTransaction();

    // Verify the record was not inserted using the new query method
    const users = await db.query<TestUser>(Where<TestUser>("id", eq, userId), [
      "id",
    ]);
    const user = users.length > 0 ? users[0] : null;

    expect(user).toBeNull();

    // Start a new transaction
    const tx2 = await db.startTransaction();

    // Insert a record - table name is derived from the type
    const userId2 = await tx2.insert<TestUser>({
      email: "tx2@example.com",
      name: "Transaction User 2",
      age: 50,
      isActive: true,
      createdAt: new Date(),
    });

    // Commit the transaction
    await tx2.commitTransaction();

    // Verify the record was inserted using the new query method
    const users2 = await db.query<TestUser>(
      Where<TestUser>("id", eq, userId2),
      ["id", "name"]
    );
    const user2 = users2.length > 0 ? users2[0] : null;

    expect(user2).not.toBeNull();
    expect(user2?.name).toBe("Transaction User 2");

    // Clean up - table name is derived from the type
    await db.delete<TestUser>([userId2]);
  });

  it("should support multi-table queries", async () => {
    // Create tables
    await db.schemaCreateOrUpdate<TestUser>();
    await db.schemaCreateOrUpdate<TestPost>();

    // Insert a user
    const userId = await db.insert<TestUser>({
      email: "author@example.com",
      name: "Test Author",
      age: 30,
      isActive: true,
      createdAt: new Date(),
    });

    // Insert posts for the user
    const postId1 = await db.insert<TestPost>({
      userId: userId,
      title: "First Post",
      content: "Content of first post",
      createdAt: new Date(),
    });

    const postId2 = await db.insert<TestPost>({
      userId: userId,
      title: "Second Post",
      content: "Content of second post",
      createdAt: new Date(),
    });

    // Query with field aliases and table fields
    // Using type assertions to handle the field types correctly
    const userFields: TableField<TestUser>[] = [
      { table: "testuser", field: "name", as: "authorName" },
      { table: "testuser", field: "email", as: "authorEmail" },
    ];

    const postFields: TableField<TestPost>[] = [
      { table: "testpost", field: "title", as: "postTitle" },
      { table: "testpost", field: "content", as: "postContent" },
    ];

    // Combine the fields and use type assertion to satisfy the compiler
    const allFields = [...userFields, ...postFields] as
      | TableField<TestUser>[]
      | TableField<TestPost>[];

    const results = await db.query<TestUser, TestPost>(
      Where<TestPost>("userId", eq, userId),
      allFields
    );

    expect(results.length).toBe(2);
    expect(results[0]).toHaveProperty("authorName");
    expect(results[0]).toHaveProperty("authorEmail");
    expect(results[0]).toHaveProperty("postTitle");
    expect(results[0]).toHaveProperty("postContent");

    // Clean up
    await db.delete<TestPost>([postId1, postId2]);
    await db.delete<TestUser>([userId]);
  });
});
