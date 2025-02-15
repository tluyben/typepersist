import {
  DB,
  string,
  number,
  boolean,
  date,
  enum_,
  unique,
  required,
  foreignKey,
  defineSchema,
} from "../src/types";

describe("TypeScript Type System", () => {
  it("should provide type safety for schemas", () => {
    // Define schemas
    const UserSchema = defineSchema({
      id: unique(number()),
      email: unique(string()),
      name: required(string()),
      age: number(),
      isActive: boolean(),
      createdAt: date(),
    });

    const OrderSchema = defineSchema({
      id: unique(number()),
      userId: foreignKey(number(), "users"),
      amount: number(),
      status: enum_("pending", "completed", "cancelled"),
      createdAt: date(),
    });

    // Create table instances (these would normally be created by the transformer)
    const users: DB<typeof UserSchema> = null!;
    const orders: DB<typeof OrderSchema> = null!;

    // Type checking - these should all compile
    async function typeCheck() {
      // Insert with all required fields (id is auto-generated)
      type UserInsert = Omit<typeof UserSchema, "id">;
      const userId = await users.insert({
        email: "test@example.com",
        name: "Test User",
        age: 25,
        isActive: true,
        createdAt: new Date(),
      } as UserInsert);

      // Insert with foreign key reference (id is auto-generated)
      type OrderInsert = Omit<typeof OrderSchema, "id">;
      await orders.insert({
        userId,
        amount: 100,
        status: "pending",
        createdAt: new Date(),
      } as OrderInsert);

      // Update with partial data
      await users.update(userId, {
        age: 26,
        isActive: false,
      });

      // Query builder with type-safe fields
      const activeUsers = await users
        .query()
        .where("isActive", "=", true)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      const userOrders = await orders
        .query()
        .where("userId", "=", userId)
        .where("status", "=", "pending")
        .get();

      // These should not compile
      // @ts-expect-error
      users.query().where("invalid", "=", true);

      // @ts-expect-error
      await users.update(userId, { age: "twenty six" });

      await users.insert({ email: "test@example.com" } as UserInsert);

      // @ts-expect-error
      await orders.insert({
        userId,
        amount: 100,
        status: "invalid", // Invalid enum value
        createdAt: new Date(),
      } as OrderInsert);
    }
  });

  it("should preserve metadata for the transformer", () => {
    const schema = defineSchema({
      id: unique(number()),
      email: unique(required(string())),
      status: enum_("active", "inactive"),
    });

    // Access metadata (normally only used by transformer)
    const metadata = (schema as any).__metadata;

    expect(metadata.id.type).toBe("number");
    expect(metadata.id.isUnique).toBe(true);

    expect(metadata.email.type).toBe("string");
    expect(metadata.email.isUnique).toBe(true);
    expect(metadata.email.isRequired).toBe(true);

    expect(metadata.status.type).toBe("enum");
    expect(metadata.status.values).toEqual(["active", "inactive"]);
  });
});
