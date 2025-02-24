import { CoreDB, TableDefinition, FieldType } from "../src/core-db";
import fs from "fs";
import path from "path";

describe("CoreDB", () => {
  const TEST_DB = "test.sqlite";
  let db: CoreDB;

  beforeEach(() => {
    // Create new database instance before each test
    db = new CoreDB(TEST_DB);
  });

  afterEach(async () => {
    // Clean up after each test
    await db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  describe("Database Initialization", () => {
    it("should create a new database connection", () => {
      expect(db).toBeInstanceOf(CoreDB);
    });

    it("should throw error with invalid connection string", () => {
      expect(() => new CoreDB("")).toThrow();
    });
  });

  describe("Schema Management", () => {
    const userTableDef: TableDefinition = {
      name: "users",
      implementation: "Static",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    it("should create a new table", async () => {
      await expect(
        db.schemaCreateOrUpdate(userTableDef)
      ).resolves.not.toThrow();
    });

    it("should update existing table with new fields", async () => {
      await db.schemaCreateOrUpdate(userTableDef);

      const updatedTableDef = {
        ...userTableDef,
        fields: [
          ...userTableDef.fields,
          { name: "address", type: "Text" as FieldType },
        ],
      };

      await expect(
        db.schemaCreateOrUpdate(updatedTableDef)
      ).resolves.not.toThrow();
    });

    it("should drop a table", async () => {
      await db.schemaCreateOrUpdate(userTableDef);
      await expect(db.schemaDrop("users")).resolves.not.toThrow();
    });

    it("should rename a table", async () => {
      await db.schemaCreateOrUpdate(userTableDef);
      await expect(db.schemaRename("users", "people")).resolves.not.toThrow();
    });

    it("should drop a field", async () => {
      await db.schemaCreateOrUpdate(userTableDef);
      await expect(db.schemaDropField("users", "age")).resolves.not.toThrow();
    });

    it("should rename a field", async () => {
      await db.schemaCreateOrUpdate(userTableDef);
      await expect(
        db.schemaRenameField("users", "email", "emailAddress")
      ).resolves.not.toThrow();
    });

    it("should handle all supported field types", async () => {
      const allTypesDef: TableDefinition = {
        name: "all_types",
        implementation: "Static",
        fields: [
          { name: "textField", type: "Text" as FieldType },
          { name: "integerField", type: "Integer" as FieldType },
          { name: "floatField", type: "Float" as FieldType },
          { name: "booleanField", type: "Boolean" as FieldType },
          { name: "dateField", type: "Date" as FieldType },
          { name: "dateTimeField", type: "Datetime" as FieldType },
          { name: "timeField", type: "Time" as FieldType },
          {
            name: "enumField",
            type: "Enum" as FieldType,
            options: ["A", "B", "C"],
          },
        ],
      };

      await expect(db.schemaCreateOrUpdate(allTypesDef)).resolves.not.toThrow();
    });

    it("should throw error for unsupported field type", async () => {
      const invalidTableDef: TableDefinition = {
        name: "invalid",
        implementation: "Static",
        fields: [{ name: "field", type: "InvalidType" as any }],
      };

      await expect(db.schemaCreateOrUpdate(invalidTableDef)).rejects.toThrow();
    });

    it("should create table with compound indexes", async () => {
      const tableDef: TableDefinition = {
        name: "products",
        implementation: "Static",
        fields: [
          { name: "name", type: "Text" as FieldType },
          { name: "category", type: "Text" as FieldType },
          { name: "sku", type: "Text" as FieldType },
        ],
        compoundIndexes: [
          { fields: ["name", "category"], type: "Default" },
          { fields: ["category", "sku"], type: "Unique" },
        ],
      };

      await expect(db.schemaCreateOrUpdate(tableDef)).resolves.not.toThrow();

      // Insert a record to test unique compound index
      await db.insert("products", {
        name: "Product 1",
        category: "Category 1",
        sku: "SKU1",
      });

      // Try to insert a record that violates the unique compound index
      await expect(
        db.insert("products", {
          name: "Product 2",
          category: "Category 1", // Same category
          sku: "SKU1", // Same SKU
        })
      ).rejects.toThrow();

      // Should allow same SKU in different category
      await expect(
        db.insert("products", {
          name: "Product 3",
          category: "Category 2", // Different category
          sku: "SKU1", // Same SKU
        })
      ).resolves.not.toThrow();
    });

    describe("Table Relationships", () => {
      const authorTableDef: TableDefinition = {
        name: "authors",
        implementation: "Static",
        fields: [{ name: "name", type: "Text" as FieldType, required: true }],
      };

      const bookTableDef: TableDefinition = {
        name: "books",
        implementation: "Static",
        fields: [{ name: "title", type: "Text" as FieldType, required: true }],
      };

      it("should create a foreign key relationship between tables", async () => {
        await db.schemaCreateOrUpdate(authorTableDef);
        await db.schemaCreateOrUpdate(bookTableDef);
        await expect(
          db.schemaConnect("authors", "books")
        ).resolves.not.toThrow();
      });

      it("should throw error when parent table does not exist", async () => {
        await db.schemaCreateOrUpdate(bookTableDef);
        await expect(db.schemaConnect("nonexistent", "books")).rejects.toThrow(
          "Parent table 'nonexistent' does not exist"
        );
      });

      it("should throw error when child table does not exist", async () => {
        await db.schemaCreateOrUpdate(authorTableDef);
        await expect(
          db.schemaConnect("authors", "nonexistent")
        ).rejects.toThrow("Child table 'nonexistent' does not exist");
      });

      it("should be idempotent", async () => {
        await db.schemaCreateOrUpdate(authorTableDef);
        await db.schemaCreateOrUpdate(bookTableDef);

        // First connection
        await expect(
          db.schemaConnect("authors", "books")
        ).resolves.not.toThrow();

        // Second connection should not throw
        await expect(
          db.schemaConnect("authors", "books")
        ).resolves.not.toThrow();
      });
    });
  });

  describe("CRUD Operations", () => {
    const userTableDef: TableDefinition = {
      name: "users",
      implementation: "Static",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.schemaCreateOrUpdate(userTableDef);
    });

    it("should insert a new record", async () => {
      const userData = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };

      const id = await db.insert("users", userData);
      expect(id).toBeDefined();
      expect(typeof id).toBe("number");
    });

    it("should update an existing record", async () => {
      const id = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });

      await expect(db.update("users", id, { age: 31 })).resolves.not.toThrow();
    });

    it("should upsert a record", async () => {
      const userData = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };

      // Insert
      const id = await db.upsert("users", userData);
      expect(id).toBeDefined();

      // Update
      const updatedId = await db.upsert("users", { ...userData, id, age: 31 });
      expect(updatedId).toBe(id);
    });

    it("should delete records", async () => {
      const id1 = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });

      const id2 = await db.insert("users", {
        name: "Jane Doe",
        email: "jane@example.com",
        age: 25,
      });

      await expect(db.delete("users", [id1, id2])).resolves.not.toThrow();
    });
  });

  describe("Query Builder", () => {
    const userTableDef: TableDefinition = {
      name: "users",
      implementation: "Static",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
        { name: "age", type: "Integer" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.schemaCreateOrUpdate(userTableDef);
      await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });
      await db.insert("users", {
        name: "Jane Doe",
        email: "jane@example.com",
        age: 25,
      });
      await db.insert("users", {
        name: "Bob Smith",
        email: "bob@example.com",
        age: 35,
      });
    });

    it("should query with simple where clause", async () => {
      const result = await db.query({
        table: [{ table: "users" }],
        query: {
          left: "age",
          leftType: "Field",
          cmp: "gt",
          right: 30,
          rightType: "SearchString",
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob Smith");
    });

    it("should query with OR condition", async () => {
      const result = await db.query({
        table: [{ table: "users" }],
        query: {
          Or: [
            {
              left: "name",
              leftType: "Field",
              cmp: "like",
              right: "John",
              rightType: "SearchString",
            },
            {
              left: "name",
              leftType: "Field",
              cmp: "like",
              right: "Jane",
              rightType: "SearchString",
            },
          ],
        },
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name)).toContain("John Doe");
      expect(result.map((r) => r.name)).toContain("Jane Doe");
    });

    it("should query with AND condition", async () => {
      const result = await db.query({
        table: [{ table: "users" }],
        query: {
          And: [
            {
              left: "age",
              leftType: "Field",
              cmp: "gt",
              right: 20,
              rightType: "SearchString",
            },
            {
              left: "age",
              leftType: "Field",
              cmp: "lt",
              right: 30,
              rightType: "SearchString",
            },
          ],
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Jane Doe");
    });

    it("should sort results", async () => {
      const result = await db.query({
        table: [{ table: "users" }],
        sort: [{ fieldId: "age", direction: "desc" }],
      });

      expect(result).toHaveLength(3);
      expect(result[0].age).toBe(35);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(25);
    });

    it("should handle pagination", async () => {
      const result = await db.query({
        table: [{ table: "users" }],
        sort: [{ fieldId: "age", direction: "asc" }],
        limit: 2,
        page: 1,
      });

      expect(result).toHaveLength(2);
      expect(result[0].age).toBe(25);
      expect(result[1].age).toBe(30);
    });
  });

  describe("Transactions", () => {
    const userTableDef: TableDefinition = {
      name: "users",
      implementation: "Static",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
      ],
    };

    const profileTableDef: TableDefinition = {
      name: "profiles",
      implementation: "Static",
      fields: [
        { name: "userId", type: "Integer" as FieldType, required: true },
        { name: "bio", type: "Text" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.schemaCreateOrUpdate(userTableDef);
      await db.schemaCreateOrUpdate(profileTableDef);
    });

    it("should commit transaction successfully", async () => {
      const tx = await db.startTransaction();

      try {
        const userId = await tx.insert(
          "users",
          {
            name: "John Doe",
            email: "john@example.com",
          }
          // tx
        );

        await tx.insert(
          "profiles",
          {
            userId,
            bio: "Software Developer",
          }
          // tx
        );

        await tx.commitTransaction();

        // Verify data was saved
        const result = await db.query({ table: [{ table: "users" }] });
        expect(result).toHaveLength(1);
      } catch (error) {
        await tx.rollbackTransaction();
        throw error;
      }
    });

    it("should rollback transaction on error", async () => {
      const tx = await db.startTransaction();

      try {
        const userId = await tx.insert(
          "users",
          {
            name: "John Doe",
            email: "john@example.com",
          }
          // tx
        );

        // This should fail due to missing required field
        await tx.insert(
          "profiles",
          {
            bio: "Software Developer",
          }
          // tx
        );

        await tx.commitTransaction();
      } catch (error) {
        await tx.rollbackTransaction();
      }

      // Verify no data was saved
      const result = await db.query({ table: [{ table: "users" }] });
      expect(result).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const tableDef: TableDefinition = {
        name: "users",
        implementation: "Static",
        fields: [{ name: "name", type: "Text" as FieldType, required: true }],
      };

      await db.schemaCreateOrUpdate(tableDef);

      await expect(db.insert("users", {})).rejects.toThrow();
    });

    it("should handle invalid field values", async () => {
      const tableDef: TableDefinition = {
        name: "users",
        implementation: "Static",
        fields: [{ name: "age", type: "Integer" as FieldType }],
      };

      await db.schemaCreateOrUpdate(tableDef);

      await expect(
        db.insert("users", { age: "not a number" })
      ).rejects.toThrow();
    });

    it("should handle non-existent tables", async () => {
      await expect(
        db.query({ table: [{ table: "non_existent_table" }] })
      ).rejects.toThrow();
    });

    it("should handle non-existent fields in queries", async () => {
      const tableDef: TableDefinition = {
        name: "users",
        implementation: "Static",
        fields: [{ name: "name", type: "Text" as FieldType }],
      };

      await db.schemaCreateOrUpdate(tableDef);

      await expect(
        db.query({
          table: [{ table: "users" }],
          query: {
            left: "non_existent_field",
            leftType: "Field",
            cmp: "eq",
            right: "value",
            rightType: "SearchString",
          },
        })
      ).rejects.toThrow();
    });
  });
});
