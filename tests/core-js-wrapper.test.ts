import { Wrapper, Cmp } from "../src/core-js-wrapper";

describe("CoreJS Wrapper", () => {
  let db: Wrapper;

  beforeAll(async () => {
    db = new Wrapper(":memory:");
  });

  afterAll(async () => {
    await db.close();
  });

  it("should create a table with schema builder", async () => {
    const schema = db
      .schema("users")
      .field("name")
      .type("Text")
      .required()
      .done()
      .field("age")
      .type("Integer")
      .done()
      .field("email")
      .type("Text")
      .index("Unique")
      .done();

    await db.createTable(schema);

    // Insert test data
    const id = await db.insert("users", {
      name: "John Doe",
      age: 30,
      email: "john@example.com",
    });

    // Query the data
    const results = await db
      .query("users")
      .where("age", Cmp.Gte, 25)
      .and("name", Cmp.Like, "John")
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("John Doe");
    expect(results[0].age).toBe(30);
  });

  it("should create table with compound indexes", async () => {
    const schema = db
      .schema("products")
      .field("name")
      .type("Text")
      .done()
      .field("category")
      .type("Text")
      .done()
      .field("sku")
      .type("Text")
      .done()
      .compoundDefaultKey(["name", "category"])
      .compoundUniqueKey(["category", "sku"]);

    await db.createTable(schema);

    // Insert a record
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

    // Verify the schema dump includes compound indexes
    const definition = schema.dump();
    expect(definition.compoundIndexes).toEqual([
      { fields: ["name", "category"], type: "Default" },
      { fields: ["category", "sku"], type: "Unique" },
    ]);
  });

  it("should support table joins", async () => {
    // Create posts table with foreign key
    const postsSchema = db
      .schema("posts")
      .field("title")
      .type("Text")
      .required()
      .done()
      .field("usersId")
      .type("ReferenceManyToOne")
      .reference("users")
      .done();

    await db.createTable(postsSchema);

    // Insert test post
    const postId = await db.insert("posts", {
      title: "Test Post",
      usersId: 1, // References John Doe from previous test
    });

    // Query with join
    const results = await db
      .query("users")
      .where("name", Cmp.Eq, "John Doe")
      .join("posts")
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0].posts).toHaveLength(1);
    expect(results[0].posts[0].title).toBe("Test Post");
  });

  it("should support complex queries", async () => {
    // Insert more test data
    await db.insert("users", {
      name: "Jane Smith",
      age: 25,
      email: "jane@example.com",
    });

    const results = await db
      .query("users")
      .where("age", Cmp.Gte, 25)
      .and("age", Cmp.Lte, 35)
      .or("name", Cmp.Like, "Smith")
      .orderBy("age", "desc")
      .limit(10)
      .execute();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].age).toBeGreaterThanOrEqual(25);
    expect(results[0].age).toBeLessThanOrEqual(35);
  });

  it("should support filtering nested data with like patterns", async () => {
    // Create publishers table
    const publisherSchema = db
      .schema("publishers")
      .field("name")
      .type("Text")
      .required()
      .done()
      .field("country")
      .type("Text")
      .done();
    await db.createTable(publisherSchema);

    // Create authors table with publisher reference
    const authorSchema = db
      .schema("authors")
      .field("name")
      .type("Text")
      .required()
      .done()
      .field("publishersId")
      .type("ReferenceManyToOne")
      .reference("publishers")
      .done();
    await db.createTable(authorSchema);

    // Create books table with author reference
    const bookSchema = db
      .schema("books")
      .field("title")
      .type("Text")
      .required()
      .done()
      .field("genre")
      .type("Text")
      .done()
      .field("authorsId")
      .type("ReferenceManyToOne")
      .reference("authors")
      .done();
    await db.createTable(bookSchema);

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

    // Query publishers with nested authors filtered by name
    const results = await db
      .query("publishers")
      .join("authors")
      .where("name", Cmp.Like, "Stephen%")
      .join("books")
      .execute();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Viking Press");
    expect(results[0].authors).toHaveLength(1);
    expect(results[0].authors[0].name).toBe("Stephen King");
    expect(results[0].authors[0].books).toHaveLength(2);
  });

  it("should dump schema definition", () => {
    const schema = db
      .schema("test_table")
      .field("name")
      .type("Text")
      .required()
      .done()
      .field("age")
      .type("Integer")
      .done();

    const definition = schema.dump();

    expect(definition).toEqual({
      name: "test_table",
      implementation: "Static",
      compoundIndexes: [],
      fields: [
        { name: "name", type: "Text", required: true },
        { name: "age", type: "Integer" },
      ],
    });
  });

  it("should dump query definition", () => {
    const query = db
      .query("users")
      .where("age", Cmp.Gte, 25)
      .and("name", Cmp.Like, "John%")
      .orderBy("age", "desc")
      .limit(10);

    const definition = query.dump();

    expect(definition).toEqual({
      table: [{ table: "users" }],
      query: {
        And: [
          {
            left: "age",
            leftType: "Field",
            cmp: "gte",
            right: 25,
            rightType: "Value",
          },
          {
            left: "name",
            leftType: "Field",
            cmp: "like",
            right: "John%",
            rightType: "Value",
          },
        ],
      },
      sort: [{ fieldId: "age", direction: "desc" }],
      limit: 10,
    });
  });
});
