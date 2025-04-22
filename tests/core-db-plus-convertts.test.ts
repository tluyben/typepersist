import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("CoreDBPlus Transformer", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typepersist-test-"));
  const transformerScript = path.join(
    __dirname,
    "../src/core-db-plus-convertts.ts"
  );
  const outputPath = path.join(tempDir, "schema.ts");

  afterAll(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTempTypeFile(content: string): string {
    const filePath = path.join(tempDir, `test-${Date.now()}.ts`);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  function runTransformer(inputFile: string): string {
    console.log(
      "execsync",
      execSync(
        `tsx ${transformerScript} ${inputFile} --output-file ${outputPath}`
      ).toString()
    );
    return fs.readFileSync(outputPath, "utf-8");
  }

  describe("Basic Type Handling", () => {
    it("should handle primitive types correctly", () => {
      const content = `
        export type User = {
          id: string;
          name: string;
          age: number;
          isActive: boolean;
          createdAt: Date;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "user"');
      expect(schema).toContain('type: "Text"'); // for id
      expect(schema).toContain('type: "Text"'); // for name
      expect(schema).toContain('type: "Integer"'); // for age
      expect(schema).toContain('type: "Boolean"'); // for isActive
      expect(schema).toContain('type: "Datetime"'); // for createdAt
    });

    it("should handle optional fields", () => {
      const content = `
        export type Product = {
          id: string;
          name: string;
          description?: string;
          price: number;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "description"');
      expect(schema).toContain("required: false");
      expect(schema).toContain('name: "price"');
      expect(schema).toContain("required: true");
    });
  });

  describe("Relationship Handling", () => {
    it("should create all necessary tables for relationships", () => {
      const content = `
        import { ManyToOne, OneToMany, OneToOne } from "../src/tstypes";

        export type User = {
          id: string;
          name: string;
          profile: OneToOne<Profile>;
          posts: OneToMany<Post>;
        };

        export type Profile = {
          id: string;
          userId: OneToOne<User>;
          bio: string;
        };

        export type Post = {
          id: string;
          userId: ManyToOne<User>;
          title: string;
          content: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Check if all tables are created
      expect(schema).toContain('name: "user"');
      expect(schema).toContain('name: "profile"');
      expect(schema).toContain('name: "post"');

      // Check relationships
      expect(schema).toContain('await db.schemaConnect("user", "profile")');
      expect(schema).toContain('await db.schemaConnect("user", "post")');
    });

    it("should handle circular relationships", () => {
      const content = `
        import { ManyToOne, OneToMany } from "../src/tstypes";

        export type User = {
          id: string;
          name: string;
          friends: OneToMany<Friendship>;
        };

        export type Friendship = {
          id: string;
          user1Id: ManyToOne<User>;
          user2Id: ManyToOne<User>;
          status: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "user"');
      expect(schema).toContain('name: "friendship"');
      expect(schema).toContain('await db.schemaConnect("user", "friendship")');
    });

    it("should handle many-to-many relationships", () => {
      const content = `
        import { ManyToMany } from "../src/tstypes";

        export type User = {
          id: string;
          name: string;
          roles: ManyToMany<Role>;
        };

        export type Role = {
          id: string;
          name: string;
          users: ManyToMany<User>;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "user"');
      expect(schema).toContain('name: "role"');
      expect(schema).toContain('await db.schemaConnect("user", "role")');
    });
  });

  describe("Decorator Handling", () => {
    it("should handle PrimaryKey decorator", () => {
      const content = `
        import { PrimaryKey } from "../src/tstypes";

        export type User = {
          id: PrimaryKey<string>;
          name: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "name"');
    });

    it("should handle Indexed decorator", () => {
      const content = `
        import { Indexed } from "../src/tstypes";

        export type User = {
          id: string;
          email: Indexed<string>;
          name: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "email"');
      expect(schema).toContain('indexed: "Default"');
    });
  });

  describe("Error Cases", () => {
    it("should handle missing type references gracefully", () => {
      const content = `
        import { ManyToOne } from "../src/tstypes";

        export type Post = {
          id: string;
          userId: ManyToOne<NonExistentType>;
          title: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Should still create the Post table
      expect(schema).toContain('name: "post"');
      // Should handle the relationship as a text field
      expect(schema).toContain('type: "Text"');
    });

    it("should handle invalid type definitions", () => {
      const content = `
        export type Invalid = {
          id: string;
          data: any; // Invalid type
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      expect(schema).toContain('name: "invalid"');
      expect(schema).toContain('type: "Text"'); // Should default to Text
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle a complete e-commerce schema", () => {
      const content = `
        import { PrimaryKey, Indexed, ManyToOne, OneToMany, OneToOne } from "../src/tstypes";

        export type User = {
          id: PrimaryKey<string>;
          email: Indexed<string>;
          name: string;
          profile: OneToOne<Profile>;
          orders: OneToMany<Order>;
        };

        export type Profile = {
          id: PrimaryKey<string>;
          userId: OneToOne<User>;
          address: string;
          phone: string;
        };

        export type Product = {
          id: PrimaryKey<string>;
          name: Indexed<string>;
          price: number;
          stock: number;
          categoryId: ManyToOne<Category>;
          orderItems: OneToMany<OrderItem>;
        };

        export type Category = {
          id: PrimaryKey<string>;
          name: Indexed<string>;
          products: OneToMany<Product>;
        };

        export type Order = {
          id: PrimaryKey<string>;
          userId: ManyToOne<User>;
          status: Indexed<string>;
          total: number;
          items: OneToMany<OrderItem>;
          createdAt: Date;
        };

        export type OrderItem = {
          id: PrimaryKey<string>;
          orderId: ManyToOne<Order>;
          productId: ManyToOne<Product>;
          quantity: number;
          price: number;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Check all tables are created
      expect(schema).toContain('name: "user"');
      expect(schema).toContain('name: "profile"');
      expect(schema).toContain('name: "product"');
      expect(schema).toContain('name: "category"');
      expect(schema).toContain('name: "order"');
      expect(schema).toContain('name: "orderitem"');

      // Check field types
      // expect(schema).toContain('type: "ID"'); // For primary keys
      expect(schema).toContain('type: "Integer"'); // For numeric fields
      expect(schema).toContain('type: "Datetime"'); // For date fields
      expect(schema).toContain('await db.schemaConnect("user", "profile")');
      expect(schema).toContain('await db.schemaConnect("user", "order")');
      expect(schema).toContain('await db.schemaConnect("category", "product")');

      // Check indexes
      expect(schema).toContain('indexed: "Default"'); // For email
      // expect(schema).toContain('indexed: "Default"'); // For product name
      // expect(schema).toContain('indexed: "Default"'); // For category name
      // expect(schema).toContain('indexed: "Default"'); // For order status
    });
  });
});
