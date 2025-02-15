import { createTransformer } from "../src/transformer";
import ts from "typescript";
import { z } from "zod";
import { CoreDB } from "../src/core-db";
import { Wrapper } from "../src/core-js-wrapper";

describe("TypeScript Transformer", () => {
  const db = new CoreDB(":memory:");

  // Helper function to transform TypeScript code
  function transformCode(code: string): string {
    // Create a source file
    const sourceFile = ts.createSourceFile(
      "test.ts",
      code,
      ts.ScriptTarget.Latest,
      true
    );

    // Create a transformer
    const transformer = createTransformer();

    // Transform the code
    const result = ts.transform(sourceFile, [transformer]);
    const transformedSourceFile = result.transformed[0];

    // Print the transformed code
    const printer = ts.createPrinter();
    return printer.printFile(transformedSourceFile);
  }

  it("should transform basic DB type definitions", () => {
    const code = `
      const users: DB<{
        email: DBUnique<string>;
        name: string;
        age: number;
      }> = null!;
    `;

    const result = transformCode(code);

    // The transformed code should include Zod schema and wrapper setup
    expect(result).toContain("z.object");
    expect(result).toContain("string");
    expect(result).toContain("refine");
    expect(result).toContain("required");
  });

  it("should handle enum types", () => {
    const code = `
      const orders: DB<{
        status: 'pending' | 'shipped' | 'delivered';
      }> = null!;
    `;

    const result = transformCode(code);

    // Should generate a Zod enum validator
    expect(result).toContain("z.enum");
    expect(result).toContain("pending");
    expect(result).toContain("shipped");
    expect(result).toContain("delivered");
  });

  it("should handle optional fields", () => {
    const code = `
      const products: DB<{
        sku: DBUnique<string>;
        description?: string;
      }> = null!;
    `;

    const result = transformCode(code);

    // Required field should have .required()
    expect(result).toContain("refine");
    // Optional field should not have .required()
    expect(result).not.toContain("description: z.string().required()");
  });

  it("should handle foreign key relationships", () => {
    const code = `
      const orders: DB<{
        orderId: DBUnique<string>;
        userId: DBForeignKey<number, 'users'>;
        productId: DBForeignKey<number, 'products'>;
      }> = null!;
    `;

    const result = transformCode(code);

    // Foreign keys should be validated as integers
    expect(result).toContain("z.number().int()");
    expect(result).toContain("required");
  });

  it("should handle complex schemas with multiple constraints", () => {
    const code = `
      const orders: DB<{
        orderId: DBUnique<string>;
        userId: DBRequired<number>;
        productId: DBRequired<number>;
        quantity: number;
        orderDate: Date;
        status: 'pending' | 'shipped' | 'delivered';
      }> = null!;
    `;

    const result = transformCode(code);

    // Check for all the different types and constraints
    expect(result).toContain("z.object");
    expect(result).toContain("string");
    expect(result).toContain("number");
    expect(result).toContain("date");
    expect(result).toContain("enum");
    expect(result).toContain("refine");
    expect(result).toContain("required");
  });

  it("should generate code that creates valid Zod schemas", () => {
    const code = `
      const users: DB<{
        email: DBUnique<string>;
        name: string;
        age: number;
        isActive: boolean;
      }> = null!;
    `;

    const result = transformCode(code);

    // Execute the generated code to verify it creates valid schemas
    const wrapper = new Wrapper(db);
    const schema = eval(`
      const z = require('zod');
      const db = wrapper;
      ${result}
    `);

    // Verify schema validation works
    const validData = {
      email: "test@example.com",
      name: "Test User",
      age: 25,
      isActive: true,
    };
    expect(() => schema.parse(validData)).not.toThrow();

    const invalidData = {
      email: "not-an-email",
      name: 123, // Wrong type
      age: "not-a-number", // Wrong type
      isActive: "not-a-boolean", // Wrong type
    };
    expect(() => schema.parse(invalidData)).toThrow();
  });

  it("should preserve field order", () => {
    const code = `
      const users: DB<{
        id: DBUnique<number>;
        email: string;
        referralId: DBForeignKey<number, 'users'>;
      }> = null!;
    `;

    const result = transformCode(code);

    // Check field order in the transformed code
    const idIndex = result.indexOf("id");
    const emailIndex = result.indexOf("email");
    const referralIndex = result.indexOf("referralId");

    expect(idIndex).toBeLessThan(emailIndex);
    expect(emailIndex).toBeLessThan(referralIndex);
  });
});
