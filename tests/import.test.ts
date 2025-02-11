import { CoreDB, FieldType } from "../src/core-db";
import {
  importFromJSON,
  SchemaAndDataImport,
  DataOnlyImport,
} from "../src/core-db-utils";
import fs from "fs";
import path from "path";

describe("Import Functionality", () => {
  const TEST_DB = "test-import.sqlite";
  let db: CoreDB;

  beforeEach(() => {
    db = new CoreDB(TEST_DB);
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  describe("Schema-only Import", () => {
    it("should import schema definitions correctly", async () => {
      // Load and parse the schema-only example
      const schemaData = JSON.parse(
        fs.readFileSync(path.join("examples", "schema-only.json"), "utf8")
      );

      // Import the schema
      await importFromJSON(db, schemaData);

      // Verify Product table
      const productResult = await db.query({
        table: [{ table: "Product" }],
      });
      expect(productResult).toBeDefined();

      // Verify Order table
      const orderResult = await db.query({
        table: [{ table: "Order" }],
      });
      expect(orderResult).toBeDefined();

      // Verify OrderItem table and its relations
      const orderItemResult = await db.query({
        table: [{ table: "OrderItem" }],
      });
      expect(orderItemResult).toBeDefined();
    });
  });

  describe("Data-only Import", () => {
    it("should import data into existing tables", async () => {
      // First create the tables using schema-only import
      const schemaData = JSON.parse(
        fs.readFileSync(path.join("examples", "schema-only.json"), "utf8")
      );
      await importFromJSON(db, schemaData);

      // Then import the data
      const dataOnlyImport = JSON.parse(
        fs.readFileSync(path.join("examples", "data-only.json"), "utf8")
      );
      await importFromJSON(db, dataOnlyImport);

      // Verify Product data
      const products = await db.query({
        table: [{ table: "Product" }],
      });
      expect(products).toHaveLength(2);
      expect(products[0].name).toBe("Laptop Pro X");
      expect(products[1].name).toBe("Wireless Mouse");

      // Verify Order data
      const orders = await db.query({
        table: [{ table: "Order" }],
      });
      expect(orders).toHaveLength(2);
      expect(orders[0].orderNumber).toBe("ORD-2023-001");
      expect(orders[1].orderNumber).toBe("ORD-2023-002");

      // Verify OrderItem data and relationships
      const orderItems = await db.query({
        table: [{ table: "OrderItem" }],
      });
      expect(orderItems).toHaveLength(3);
      expect(orderItems[0].order).toBe(1);
      expect(orderItems[0].product).toBe(1);
    });
  });

  describe("Combined Schema and Data Import", () => {
    it("should import both schema and data in one operation", async () => {
      // Load and import the combined schema and data
      const combinedData = JSON.parse(
        fs.readFileSync(path.join("examples", "schema-and-data.json"), "utf8")
      );
      await importFromJSON(db, combinedData);

      // Verify User schema and data
      const users = await db.query({
        table: [{ table: "User" }],
      });
      expect(users).toHaveLength(2);
      expect(users[0].email).toBe("admin@example.com");
      expect(users[0].role).toBe("Admin");
      expect(users[1].email).toBe("user@example.com");
      expect(users[1].role).toBe("User");

      // Verify Post schema and data
      const posts = await db.query({
        table: [{ table: "Post" }],
      });
      expect(posts).toHaveLength(3);
      expect(posts[0].title).toBe("Welcome to Our Platform");
      expect(posts[0].author).toBe(1); // References admin user
      expect(posts[2].author).toBe(2); // References regular user
    });

    it("should maintain referential integrity", async () => {
      const combinedData = JSON.parse(
        fs.readFileSync(path.join("examples", "schema-and-data.json"), "utf8")
      );
      await importFromJSON(db, combinedData);

      // Query posts
      const posts = await db.query({
        table: [{ table: "Post" }],
      });

      // Get the authors
      const users = await db.query({
        table: [{ table: "User" }],
      });

      // Verify relationships
      const adminPosts = posts.filter((p) => p.author === users[0].id);
      const userPosts = posts.filter((p) => p.author === users[1].id);

      expect(
        adminPosts.some((p) => p.title === "Welcome to Our Platform")
      ).toBe(true);
      expect(userPosts.some((p) => p.title === "My First Post")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid import format", async () => {
      const invalidData = { foo: "bar" } as any;
      await expect(importFromJSON(db, invalidData)).rejects.toThrow(
        "Invalid import format"
      );
    });

    it("should handle missing required fields in data", async () => {
      // Import schema first
      const schemaData = JSON.parse(
        fs.readFileSync(path.join("examples", "schema-only.json"), "utf8")
      );
      await importFromJSON(db, schemaData);

      // Try to import invalid data
      const invalidData: DataOnlyImport = {
        Product: [
          {
            // Missing required 'name' field
            sku: "TEST-001",
            price: 99.99,
          },
        ],
      };

      await expect(importFromJSON(db, invalidData)).rejects.toThrow();
    });

    it("should handle invalid foreign key references", async () => {
      // Create User table
      const userSchema: SchemaAndDataImport = {
        schema: [
          {
            name: "User",
            implementation: "Static" as const,
            fields: [
              {
                name: "name",
                type: "Text" as FieldType,
                required: true,
              },
            ],
          },
        ],
        data: {},
      };
      await importFromJSON(db, userSchema);

      // Create Post schema with foreign key to User
      const postSchema: SchemaAndDataImport = {
        schema: [
          {
            name: "Post",
            implementation: "Static" as const,
            fields: [
              {
                name: "title",
                type: "Text" as FieldType,
                required: true,
              },
              {
                name: "UserId",
                type: "ReferenceManyToOne" as FieldType,
                required: true,
                foreignTable: "User",
                indexed: "Foreign",
                indexedFields: ["UserId"],
              },
            ],
          },
        ],
        data: {},
      };

      // Create tables and connect them
      await importFromJSON(db, postSchema);

      await db.schemaConnect("User", "Post");

      // Check table schema and foreign keys
      const tableInfo = await db.query({
        table: [{ table: "sqlite_master" }],
        query: {
          And: [
            {
              left: "type",
              leftType: "Field",
              cmp: "eq",
              right: "table",
              rightType: "Value",
            },
            // {
            //   left: "name",
            //   leftType: "Field",
            //   cmp: "eq",
            //   right: "User",
            //   rightType: "Value",
            // },
          ],
        },
      });
      // console.log("Table schema:", tableInfo);

      // Try to insert data with invalid foreign key
      const invalidData: DataOnlyImport = {
        Post: [
          {
            title: "Test Post",
            UserId: 999, // Non-existent user ID
          },
        ],
      };

      await expect(db.insert("Post", invalidData.Post[0])).rejects.toThrow(
        "Foreign key constraint failed"
      );
    });
  });
});
