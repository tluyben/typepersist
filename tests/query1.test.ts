import { Wrapper, Cmp } from "../src/core-js-wrapper";
import {
  dumpRecords,
  dumpRecordsStdout,
  dumpTableStdout,
} from "../src/core-db-utils";

describe("Query Builder Extended Tests", () => {
  let db: Wrapper;

  beforeAll(async () => {
    db = new Wrapper(":memory:");
    // db = new Wrapper("./flop.db");

    // Create test table with primary key
    const schema = db
      .schema("items")
      .field("name")
      .type("Text")
      .required()
      .primaryKey()
      .done()
      .field("value")
      .type("Integer")
      .required()
      .done()
      .field("score")
      .type("Float")
      .required()
      .done()
      .field("expiry")
      .type("Datetime")
      .required()
      .done();

    await db.createTable(schema);

    // Insert test data
    await db.insert("items", {
      name: "item1",
      value: 100,
      score: 95.5,
      expiry: new Date("2024-04-01"),
    });

    await db.insert("items", {
      name: "item2",
      value: 200,
      score: 85.0,
      expiry: new Date("2024-05-01"),
    });

    await db.insert("items", {
      name: "item3",
      value: 300,
      score: 75.5,
      expiry: new Date("2024-08-01"),
    });
  }, 30000);

  afterAll(async () => {
    await db.close();
  }, 30000);

  test("sum() calculates total complete", async () => {
    // Should only have item2 remaining with value 200
    const sum = await db.query("items").sum("value");
    expect(sum).toBe(600);
  }, 30000);

  test("expiry comparison with delete", async () => {
    const now = new Date("2024-06-01");
    // await dumpTableStdout(db.coreDb(), "items");
    const pdelete = db
      .query("items")
      .where("expiry", Cmp.Lt, now)
      .orderBy("name", "asc");
    // console.log(pdelete.dump());
    const deleted = await pdelete.delete();

    expect(deleted.length).toBe(2);
    expect(deleted[0].name).toBe("item1");
    expect(deleted[1].name).toBe("item2");

    const remaining = await db.query("items").execute();
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe("item3");
  }, 30000);

  test("first() returns first result", async () => {
    await db.insert("items", {
      name: "item1",
      value: 100,
      score: 95.5,
      expiry: new Date("2024-04-01"),
    });

    await db.insert("items", {
      name: "item2",
      value: 200,
      score: 85.0,
      expiry: new Date("2024-05-01"),
    });
    const result = await db
      .query("items")
      .where("value", Cmp.Gte, 300)
      .orderBy("value", "asc")
      .first();

    expect(result).not.toBeNull();
    expect(result.name).toBe("item3");
  }, 30000);

  test("exists() checks for records", async () => {
    const exists = await db.query("items").where("value", Cmp.Eq, 200).exists();

    expect(exists).toBe(true);

    const notExists = await db
      .query("items")
      .where("value", Cmp.Eq, 999)
      .exists();

    expect(notExists).toBe(false);
  }, 30000);

  test("count() returns number of records", async () => {
    // Should only have item2 remaining after delete test
    const count = await db.query("items").count();
    expect(count).toBe(3);
  }, 30000);

  test("sum() calculates total", async () => {
    // Should only have item2 remaining with value 200
    const sum = await db.query("items").sum("value");
    expect(sum).toBe(600);
  }, 30000);

  test("avg() calculates average", async () => {
    // Should only have item2 remaining with score 85.0
    const avg = await db.query("items").avg("score");
    expect(avg).toBeCloseTo(85.3, 1);
  }, 30000);

  test("transaction support", async () => {
    let tx: Wrapper | null = null;
    try {
      tx = await db.startTransaction();

      // Insert using transaction
      await tx.insert("items", {
        name: "item4",
        value: 400,
        score: 90.0,
        expiry: new Date("2026-01-01"),
      });

      // Verify record exists
      const beforeCommit = await tx.query("items").count();
      expect(beforeCommit).toBe(4);

      await tx.commitTransaction();

      // Verify record persists after commit
      const afterCommit = await db.query("items").count();
      expect(afterCommit).toBe(4);
    } catch (error) {
      if (tx) await tx.rollbackTransaction();
      throw error;
    } finally {
      if (tx) await tx.releaseTransaction();
    }
  }, 2000);

  test("unique key constraint from primaryKey()", async () => {
    // Try to insert a record with an existing name (which is set as primaryKey)
    // console.log(await dumpTableStdout(db.coreDb(), "items"));
    await expect(async () => {
      await db.insert("items", {
        name: "item2", // This name already exists
        value: 500,
        score: 95.0,
        expiry: new Date("2026-01-01"),
      });
    }).rejects.toThrow(); // Should throw due to unique constraint
  }, 30000);
});
