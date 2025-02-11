import { CoreDB, TableDefinition } from "../src/core-db";
import fs from "fs";

describe("Table Joins", () => {
  const TEST_DB = "test-joins.sqlite";
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

  describe("Two Table Joins", () => {
    const authorTableDef: TableDefinition = {
      name: "authors",
      implementation: "Static",
      fields: [
        { name: "name", type: "Text", required: true },
        { name: "country", type: "Text" },
      ],
    };

    const bookTableDef: TableDefinition = {
      name: "books",
      implementation: "Static",
      fields: [
        { name: "title", type: "Text", required: true },
        { name: "genre", type: "Text" },
        { name: "year", type: "Integer" },
      ],
    };

    beforeEach(async () => {
      // Create tables and relationship
      await db.schemaCreateOrUpdate(authorTableDef);
      await db.schemaCreateOrUpdate(bookTableDef);
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
        table: [{ table: "authors" }, { table: "books" }],
        query: {
          left: "country",
          leftType: "Field",
          cmp: "eq",
          right: "USA",
          rightType: "Value",
        },
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
              left: "genre",
              leftType: "Field",
              cmp: "eq",
              right: "horror",
              rightType: "Value",
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
              left: "country",
              leftType: "Field",
              cmp: "eq",
              right: "USA",
              rightType: "Value",
            },
          },
          {
            table: "books",
            query: {
              left: "genre",
              leftType: "Field",
              cmp: "eq",
              right: "horror",
              rightType: "Value",
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

  describe("Three Table Joins", () => {
    const publisherTableDef: TableDefinition = {
      name: "publishers",
      implementation: "Static",
      fields: [
        { name: "name", type: "Text", required: true },
        { name: "country", type: "Text" },
      ],
    };

    const authorTableDef: TableDefinition = {
      name: "authors",
      implementation: "Static",
      fields: [{ name: "name", type: "Text", required: true }],
    };

    const bookTableDef: TableDefinition = {
      name: "books",
      implementation: "Static",
      fields: [
        { name: "title", type: "Text", required: true },
        { name: "genre", type: "Text" },
      ],
    };

    beforeEach(async () => {
      // Create tables and relationships
      await db.schemaCreateOrUpdate(publisherTableDef);
      await db.schemaCreateOrUpdate(authorTableDef);
      await db.schemaCreateOrUpdate(bookTableDef);

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
              left: "country",
              leftType: "Field",
              cmp: "eq",
              right: "USA",
              rightType: "Value",
            },
          },
          { table: "authors" },
          {
            table: "books",
            query: {
              left: "genre",
              leftType: "Field",
              cmp: "eq",
              right: "horror",
              rightType: "Value",
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
  });

  describe("Error Cases", () => {
    it("should throw error when tables are not properly connected", async () => {
      await db.schemaCreateOrUpdate({
        name: "authors",
        implementation: "Static",
        fields: [{ name: "name", type: "Text" }],
      });

      await db.schemaCreateOrUpdate({
        name: "books",
        implementation: "Static",
        fields: [{ name: "title", type: "Text" }],
      });

      await expect(
        db.query({
          table: [{ table: "authors" }, { table: "books" }],
        })
      ).rejects.toThrow(/No foreign key connection found/);
    });

    it("should throw error when tables are connected in wrong order", async () => {
      await db.schemaCreateOrUpdate({
        name: "authors",
        implementation: "Static",
        fields: [{ name: "name", type: "Text" }],
      });

      await db.schemaCreateOrUpdate({
        name: "books",
        implementation: "Static",
        fields: [{ name: "title", type: "Text" }],
      });

      await db.schemaConnect("authors", "books");

      // Wrong order: books should come after authors
      await expect(
        db.query({
          table: [{ table: "books" }, { table: "authors" }],
        })
      ).rejects.toThrow(/No foreign key connection found/);
    });
  });
});
