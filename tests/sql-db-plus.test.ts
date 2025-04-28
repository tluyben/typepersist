import fs from "fs";
import { FieldType, QueryPlus, TableDefinitionPlus } from "../src/core-db-plus";
import { SQLDBPlus } from "../src/sql-db-plus";
import { SQLiteAdapter } from "../src/sqlite-adapter";

describe("SQLDBPlus", () => {
  const TEST_DB = "test-sql-plus.sqlite";
  let sqliteAdapter: SQLiteAdapter;
  let db: SQLDBPlus;

  beforeEach(() => {
    // Create new database instance before each test
    sqliteAdapter = new SQLiteAdapter(TEST_DB);
    db = new SQLDBPlus(sqliteAdapter);
  });

  afterEach(async () => {
    // Clean up after each test
    await db.close();
    await sqliteAdapter.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  describe("Database Initialization", () => {
    it("should create a new database connection", () => {
      expect(db).toBeInstanceOf(SQLDBPlus);
    });
  });

  describe("Schema Management", () => {
    const userTableDef: TableDefinitionPlus = {
      name: "users",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    it("should create a new table", async () => {
      await expect(db.createTable(userTableDef)).resolves.not.toThrow();
    });

    it("should update existing table with new fields", async () => {
      await db.createTable(userTableDef);

      // Add a new field to the table definition
      const updatedTableDef: TableDefinitionPlus = {
        ...userTableDef,
        fields: [
          ...userTableDef.fields,
          { name: "phone", type: "Text" as FieldType },
        ],
      };

      // This should not throw an error
      await expect(db.createTable(updatedTableDef)).resolves.not.toThrow();
    });
  });

  describe("Data Operations", () => {
    const userTableDef: TableDefinitionPlus = {
      name: "users",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.createTable(userTableDef);
    });

    it("should insert data", async () => {
      const userId = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });

      expect(userId).toBeGreaterThan(0);
    });

    it("should update data", async () => {
      const userId = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });

      await db.update("users", userId, { age: 31 });

      const query: QueryPlus = {
        table: [{ table: "users" }],
      };

      const results = await db.query(query);
      expect(results[0].age).toBe(31);
    });

    it("should delete data", async () => {
      const userId = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });

      await db.delete("users", [userId]);

      const query: QueryPlus = {
        table: [{ table: "users" }],
      };

      const results = await db.query(query);
      expect(results.length).toBe(0);
    });
  });

  describe("Query Operations", () => {
    const userTableDef: TableDefinitionPlus = {
      name: "users",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.createTable(userTableDef);

      // Insert some test data
      await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });
      await db.insert("users", {
        name: "Jane Smith",
        email: "jane@example.com",
        age: 25,
      });
      await db.insert("users", {
        name: "Bob Johnson",
        email: "bob@example.com",
        age: 35,
      });
    });

    it("should query all data", async () => {
      const query: QueryPlus = {
        table: [{ table: "users" }],
      };

      const results = await db.query(query);
      expect(results.length).toBe(3);
    });

    it("should query with sorting", async () => {
      const query: QueryPlus = {
        table: [{ table: "users" }],
        sort: [{ fieldId: "name", direction: "asc" }],
      };

      const results = await db.query(query);
      expect(results.length).toBe(3);
      expect(results[0].name).toBe("Bob Johnson");
      expect(results[1].name).toBe("Jane Smith");
      expect(results[2].name).toBe("John Doe");
    });

    it("should query with filtering", async () => {
      const query: QueryPlus = {
        table: [
          {
            table: "users",
            query: {
              field: "age",
              cmp: "gt",
              value: 30,
            },
          },
        ],
      };

      const results = await db.query(query);
      expect(results.length).toBe(2);
      expect(results[0].name).toBe("John Doe");
      expect(results[1].name).toBe("Bob Johnson");
    });

    it("should query with complex filtering", async () => {
      const query: QueryPlus = {
        table: [
          {
            table: "users",
            query: {
              And: [
                { field: "age", cmp: "gt", value: 25 },
                { field: "age", cmp: "lt", value: 35 },
              ],
            },
          },
        ],
      };

      const results = await db.query(query);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("John Doe");
    });

    it("should query with field selection", async () => {
      const query: QueryPlus = {
        table: [{ table: "users" }],
        field: {
          users: ["name", "age"],
        },
      };

      const results = await db.query(query);
      expect(results.length).toBe(3);
      expect(results[0].name).toBeDefined();
      expect(results[0].age).toBeDefined();
      expect(results[0].email).toBeUndefined();
    });
  });

  describe("Transaction Management", () => {
    const userTableDef: TableDefinitionPlus = {
      name: "users",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.createTable(userTableDef);
    });

    it("should commit a transaction", async () => {
      await db.startTransaction();

      await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });
      await db.insert("users", {
        name: "Jane Smith",
        email: "jane@example.com",
        age: 25,
      });

      await db.commitTransaction();

      const query: QueryPlus = {
        table: [{ table: "users" }],
      };

      const results = await db.query(query);
      expect(results.length).toBe(2);
    });

    it("should rollback a transaction", async () => {
      await db.startTransaction();

      await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });
      await db.insert("users", {
        name: "Jane Smith",
        email: "jane@example.com",
        age: 25,
      });

      await db.rollbackTransaction();

      const query: QueryPlus = {
        table: [{ table: "users" }],
      };

      const results = await db.query(query);
      expect(results.length).toBe(0);
    });
  });
});
