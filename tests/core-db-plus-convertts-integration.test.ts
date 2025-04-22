import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CoreDBPlus } from "../src/core-db-plus";

describe("CoreDBPlus Transformer Integration", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typepersist-test-"));
  const transformerScript = path.join(
    __dirname,
    "../src/core-db-plus-convertts.ts"
  );
  const outputPath = path.join(tempDir, "schema.ts");
  const TEST_DB = path.join(tempDir, "test-integration.sqlite");
  let db: CoreDBPlus;

  afterAll(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

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

  function createTempTypeFile(content: string): string {
    const filePath = path.join(tempDir, `test-${Date.now()}.ts`);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  function runTransformer(inputFile: string): string {
    const x = execSync(
      `tsx ${transformerScript} ${inputFile} --output-file ${outputPath}`
    );
    return fs.readFileSync(outputPath, "utf-8");
  }

  describe("Basic Type Integration", () => {
    it("should create and validate a table with primitive types", async () => {
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

      // Execute the generated schema
      await db.rawQuery(schema, []);

      // Insert test data
      const testUser = {
        name: "John Doe",
        age: 30,
        isActive: true,
        createdAt: new Date(),
      };
      const userId = await db.insert("user", testUser);

      // Query and validate
      const result = await db.query({
        table: [{ table: "user" }],
        field: { user: ["*"] },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("John Doe");
      expect(result[0].age).toBe(30);
      expect(result[0].isActive).toBe(true);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it("should handle optional fields in database operations", async () => {
      const content = `
        export type Product = {
          id: string;
          name: string;
          description?: string;
          price: number;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Execute the generated schema
      await db.rawQuery(schema, []);

      // Insert product without description
      const product1 = {
        name: "Basic Product",
        price: 99.99,
      };
      await db.insert("product", product1);

      // Insert product with description
      const product2 = {
        name: "Premium Product",
        description: "A premium product with description",
        price: 199.99,
      };
      await db.insert("product", product2);

      // Query and validate
      const results = await db.query({
        table: [{ table: "product" }],
        field: { product: ["*"] },
      });
      expect(results).toHaveLength(2);
      expect(results[0].description).toBeNull();
      expect(results[1].description).toBe("A premium product with description");
    });
  });

  describe("Relationship Integration", () => {
    it("should handle one-to-one relationships", async () => {
      const content = `
        import { OneToOne } from "../src/tstypes";

        export type User = {
          id: string;
          name: string;
          profile: OneToOne<Profile>;
        };

        export type Profile = {
          id: string;
          userId: OneToOne<User>;
          bio: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Execute the generated schema
      await db.rawQuery(schema, []);

      // Create user and profile
      const userId = await db.insert("user", { name: "John Doe" });
      await db.insert("profile", {
        userId: userId,
        bio: "Software Developer",
      });

      // Query with relationship
      const result = await db.query({
        table: [
          { table: "user" },
          {
            table: "profile",
            query: { field: "userId", cmp: "eq", value: userId },
          },
        ],
        field: {
          user: ["*"],
          profile: ["*"],
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("John Doe");
      expect(result[0].profile.bio).toBe("Software Developer");
    });

    it("should handle one-to-many relationships", async () => {
      const content = `
        import { OneToMany, ManyToOne } from "../src/tstypes";

        export type User = {
          id: string;
          name: string;
          posts: OneToMany<Post>;
        };

        export type Post = {
          id: string;
          userId: ManyToOne<User>;
          title: string;
          content: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Execute the generated schema
      await db.rawQuery(schema, []);

      // Create user and posts
      const userId = await db.insert("user", { name: "John Doe" });
      await db.insert("post", {
        userId: userId,
        title: "First Post",
        content: "Hello World",
      });
      await db.insert("post", {
        userId: userId,
        title: "Second Post",
        content: "Hello Again",
      });

      // Query with relationship
      const result = await db.query({
        table: [
          { table: "user" },
          {
            table: "post",
            query: { field: "userId", cmp: "eq", value: userId },
          },
        ],
        field: {
          user: ["*"],
          post: ["*"],
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("John Doe");
      expect(result[0].post.title).toBe("First Post");
      expect(result[1].post.title).toBe("Second Post");
    });
  });

  describe("Decorator Integration", () => {
    it("should handle indexed fields in queries", async () => {
      const content = `
        import { Indexed } from "../src/tstypes";

        export type User = {
          id: string;
          email: Indexed<string>;
          name: string;
        };
      `;
      const schema = runTransformer(createTempTypeFile(content));

      // Execute the generated schema
      await db.rawQuery(schema, []);

      // Insert test data
      await db.insert("user", {
        email: "john@example.com",
        name: "John Doe",
      });

      // Query using indexed field
      const result = await db.query({
        table: [
          {
            table: "user",
            query: { field: "email", cmp: "eq", value: "john@example.com" },
          },
        ],
        field: { user: ["*"] },
      });

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("john@example.com");
      expect(result[0].name).toBe("John Doe");
    });
  });
});
