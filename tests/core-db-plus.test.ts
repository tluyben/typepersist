import fs from "fs";
import {
  CoreDBPlus,
  FieldType,
  TableDefinitionPlus,
} from "../src/core-db-plus";

describe("CoreDBPlus", () => {
  const TEST_DB = "test-plus.sqlite";
  let db: CoreDBPlus;

  beforeEach(() => {
    // Create new database instance before each test
    db = new CoreDBPlus(TEST_DB);
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
      expect(db).toBeInstanceOf(CoreDBPlus);
    });

    it("should throw error with invalid connection string", () => {
      expect(() => new CoreDBPlus("")).toThrow();
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

      const updatedTableDef = {
        ...userTableDef,
        fields: [
          ...userTableDef.fields,
          { name: "address", type: "Text" as FieldType },
        ],
      };

      await expect(db.createTable(updatedTableDef)).resolves.not.toThrow();
    });

    it("should drop a table", async () => {
      await db.createTable(userTableDef);
      await expect(db.schemaDrop("users")).resolves.not.toThrow();
    });

    it("should rename a table", async () => {
      await db.createTable(userTableDef);
      await expect(db.schemaRename("users", "people")).resolves.not.toThrow();
    });

    it("should drop a field", async () => {
      await db.createTable(userTableDef);
      await expect(db.schemaDropField("users", "age")).resolves.not.toThrow();
    });

    it("should rename a field", async () => {
      await db.createTable(userTableDef);
      await expect(
        db.schemaRenameField("users", "email", "emailAddress")
      ).resolves.not.toThrow();
    });

    it("should handle all supported field types", async () => {
      const allTypesDef: TableDefinitionPlus = {
        name: "all_types",
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

      await expect(db.createTable(allTypesDef)).resolves.not.toThrow();
    });

    it("should create table with compound indexes", async () => {
      const tableDef: TableDefinitionPlus = {
        name: "products",
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

      await expect(db.createTable(tableDef)).resolves.not.toThrow();

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
      const authorTableDef: TableDefinitionPlus = {
        name: "authors",
        fields: [{ name: "name", type: "Text" as FieldType, required: true }],
      };

      const bookTableDef: TableDefinitionPlus = {
        name: "books",
        fields: [{ name: "title", type: "Text" as FieldType, required: true }],
      };

      it("should create a foreign key relationship between tables", async () => {
        await db.createTable(authorTableDef);
        await db.createTable(bookTableDef);
        await expect(
          db.schemaConnect("authors", "books")
        ).resolves.not.toThrow();
      });

      it("should throw error when parent table does not exist", async () => {
        await db.createTable(bookTableDef);
        await expect(db.schemaConnect("nonexistent", "books")).rejects.toThrow(
          "Parent table 'nonexistent' does not exist"
        );
      });

      it("should throw error when child table does not exist", async () => {
        await db.createTable(authorTableDef);
        await expect(
          db.schemaConnect("authors", "nonexistent")
        ).rejects.toThrow("Child table 'nonexistent' does not exist");
      });

      it("should be idempotent", async () => {
        await db.createTable(authorTableDef);
        await db.createTable(bookTableDef);

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

  describe("Query Builder with Plus Interface", () => {
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

    it("should query with simple where clause using Plus interface", async () => {
      const result = await db.query({
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
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Bob Smith");
    });

    it("should query with OR condition using Plus interface", async () => {
      const result = await db.query({
        table: [
          {
            table: "users",
            query: {
              Or: [
                {
                  field: "name",
                  cmp: "like",
                  value: "John",
                },
                {
                  field: "name",
                  cmp: "like",
                  value: "Jane",
                },
              ],
            },
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name)).toContain("John Doe");
      expect(result.map((r) => r.name)).toContain("Jane Doe");
    });

    it("should query with AND condition using Plus interface", async () => {
      const result = await db.query({
        table: [
          {
            table: "users",
            query: {
              And: [
                {
                  field: "age",
                  cmp: "gt",
                  value: 20,
                },
                {
                  field: "age",
                  cmp: "lt",
                  value: 30,
                },
              ],
            },
          },
        ],
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

  describe("Table Joins with Plus Interface", () => {
    const authorTableDef: TableDefinitionPlus = {
      name: "authors",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "country", type: "Text" as FieldType },
      ],
    };

    const bookTableDef: TableDefinitionPlus = {
      name: "books",
      fields: [
        { name: "title", type: "Text" as FieldType, required: true },
        { name: "genre", type: "Text" as FieldType },
        { name: "year", type: "Integer" as FieldType },
      ],
    };

    beforeEach(async () => {
      // Create tables and relationship
      await db.createTable(authorTableDef);
      await db.createTable(bookTableDef);
      await db.schemaConnect("authors", "books");

      // Insert test data
      const stephenKingId = await db.insert("authors", {
        name: "Stephen King",
        country: "USA",
      });
      await db.insert("books", {
        title: "The Shining",
        genre: "horror",
        year: 1977,
        authorsId: stephenKingId,
      });
      await db.insert("books", {
        title: "IT",
        genre: "horror",
        year: 1986,
        authorsId: stephenKingId,
      });
      await db.insert("books", {
        title: "The Stand",
        genre: "post-apocalyptic",
        year: 1978,
        authorsId: stephenKingId,
      });

      const jrrTolkienId = await db.insert("authors", {
        name: "J.R.R. Tolkien",
        country: "UK",
      });
      await db.insert("books", {
        title: "The Hobbit",
        genre: "fantasy",
        year: 1937,
        authorsId: jrrTolkienId,
      });
      await db.insert("books", {
        title: "The Fellowship of the Ring",
        genre: "fantasy",
        year: 1954,
        authorsId: jrrTolkienId,
      });
    });

    it("should join tables and return nested results", async () => {
      const results = await db.query({
        table: [{ table: "authors" }, { table: "books" }],
      });

      expect(results).toHaveLength(2);
      expect(results[0].books).toBeDefined();
      expect(results[1].books).toBeDefined();

      const stephenKing = results.find(
        (author) => author.name === "Stephen King"
      );
      expect(stephenKing.books).toHaveLength(3);

      const tolkien = results.find(
        (author) => author.name === "J.R.R. Tolkien"
      );
      expect(tolkien.books).toHaveLength(2);
    });

    it("should filter parent records", async () => {
      const results = await db.query({
        table: [
          {
            table: "authors",
            query: {
              field: "country",
              cmp: "eq",
              value: "USA",
            },
          },
          { table: "books" },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Stephen King");
      expect(results[0].books).toHaveLength(3);
    });

    it("should filter child records", async () => {
      const results = await db.query({
        table: [
          { table: "authors" },
          {
            table: "books",
            query: {
              field: "genre",
              cmp: "eq",
              value: "horror",
            },
          },
        ],
      });

      expect(results).toHaveLength(2);

      const stephenKing = results.find(
        (author) => author.name === "Stephen King"
      );
      expect(stephenKing.books).toHaveLength(2);
      expect(
        stephenKing.books.every(
          (book: { genre: string }) => book.genre === "horror"
        )
      ).toBe(true);

      const tolkien = results.find(
        (author) => author.name === "J.R.R. Tolkien"
      );
      expect(tolkien.books).toHaveLength(0);
    });

    it("should filter both parent and child records", async () => {
      const results = await db.query({
        table: [
          {
            table: "authors",
            query: {
              field: "country",
              cmp: "eq",
              value: "USA",
            },
          },
          {
            table: "books",
            query: {
              field: "genre",
              cmp: "eq",
              value: "horror",
            },
          },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Stephen King");
      expect(results[0].books).toHaveLength(2);
      expect(
        results[0].books.every(
          (book: { genre: string }) => book.genre === "horror"
        )
      ).toBe(true);
    });
  });

  describe("Three Table Joins with Plus Interface", () => {
    const publisherTableDef: TableDefinitionPlus = {
      name: "publishers",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "country", type: "Text" as FieldType },
      ],
    };

    const authorTableDef: TableDefinitionPlus = {
      name: "authors",
      fields: [{ name: "name", type: "Text" as FieldType, required: true }],
    };

    const bookTableDef: TableDefinitionPlus = {
      name: "books",
      fields: [
        { name: "title", type: "Text" as FieldType, required: true },
        { name: "genre", type: "Text" as FieldType },
      ],
    };

    beforeEach(async () => {
      // Create tables and relationships
      await db.createTable(publisherTableDef);
      await db.createTable(authorTableDef);
      await db.createTable(bookTableDef);

      await db.schemaConnect("publishers", "authors");
      await db.schemaConnect("authors", "books");

      // Insert test data
      const vikingId = await db.insert("publishers", {
        name: "Viking Press",
        country: "USA",
      });

      const stephenKingId = await db.insert("authors", {
        name: "Stephen King",
        publishersId: vikingId,
      });

      await db.insert("books", {
        title: "The Shining",
        genre: "horror",
        authorsId: stephenKingId,
      });
      await db.insert("books", {
        title: "IT",
        genre: "horror",
        authorsId: stephenKingId,
      });
    });

    it("should join three tables with nested results", async () => {
      const results = await db.query({
        table: [
          { table: "publishers" },
          { table: "authors" },
          { table: "books" },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Viking Press");
      expect(results[0].authors).toHaveLength(1);
      expect(results[0].authors[0].name).toBe("Stephen King");
      expect(results[0].authors[0].books).toHaveLength(2);
    });

    it("should filter records at any level", async () => {
      const results = await db.query({
        table: [
          {
            table: "publishers",
            query: {
              field: "country",
              cmp: "eq",
              value: "USA",
            },
          },
          { table: "authors" },
          {
            table: "books",
            query: {
              field: "genre",
              cmp: "eq",
              value: "horror",
            },
          },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Viking Press");
      expect(results[0].authors).toHaveLength(1);
      expect(results[0].authors[0].books).toHaveLength(2);
      expect(
        results[0].authors[0].books.every(
          (book: { genre: string }) => book.genre === "horror"
        )
      ).toBe(true);
    });

    it("should filter authors by name starting with Stephen", async () => {
      const results = await db.query({
        table: [
          { table: "publishers" },
          {
            table: "authors",
            query: {
              field: "name",
              cmp: "like",
              value: "Stephen%",
            },
          },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Viking Press");
      expect(results[0].authors).toHaveLength(1);
      expect(results[0].authors[0].name).toBe("Stephen King");
    });
  });

  describe("Transactions", () => {
    const userTableDef: TableDefinitionPlus = {
      name: "users",
      fields: [
        { name: "name", type: "Text" as FieldType, required: true },
        { name: "email", type: "Text" as FieldType, indexed: "Unique" },
      ],
    };

    const profileTableDef: TableDefinitionPlus = {
      name: "profiles",
      fields: [
        { name: "userId", type: "Integer" as FieldType, required: true },
        { name: "bio", type: "Text" as FieldType },
      ],
    };

    beforeEach(async () => {
      await db.createTable(userTableDef);
      await db.createTable(profileTableDef);
    });

    it("should commit transaction successfully", async () => {
      const tx = await db.startTransaction();

      try {
        const userId = await tx.insert("users", {
          name: "John Doe",
          email: "john@example.com",
        });

        await tx.insert("profiles", {
          userId,
          bio: "Software Developer",
        });

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
        const userId = await tx.insert("users", {
          name: "John Doe",
          email: "john@example.com",
        });

        // This should fail due to missing required field
        await tx.insert("profiles", {
          bio: "Software Developer",
        });

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
      const tableDef: TableDefinitionPlus = {
        name: "users",
        fields: [{ name: "name", type: "Text" as FieldType, required: true }],
      };

      await db.createTable(tableDef);

      await expect(db.insert("users", {})).rejects.toThrow();
    });

    it("should handle invalid field values", async () => {
      const tableDef: TableDefinitionPlus = {
        name: "users",
        fields: [{ name: "age", type: "Integer" as FieldType }],
      };

      await db.createTable(tableDef);

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
      const tableDef: TableDefinitionPlus = {
        name: "users",
        fields: [{ name: "name", type: "Text" as FieldType }],
      };

      await db.createTable(tableDef);

      await expect(
        db.query({
          table: [
            {
              table: "users",
              query: {
                field: "non_existent_field",
                cmp: "eq",
                value: "value",
              },
            },
          ],
        })
      ).rejects.toThrow();
    });
  });
});
