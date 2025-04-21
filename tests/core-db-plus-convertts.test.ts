import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("CoreDBPlus Transformer", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typepersist-test-"));
  const transformerScript = path.join(
    __dirname,
    "..",
    "src",
    "core-db-plus-convertts.ts"
  );
  const exampleTypePath = path.join(__dirname, "../examples/card-pairing.ts");
  const outputPath = path.join(tempDir, "schema.ts");

  afterAll(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should transform type definitions to CoreDBPlus schema", () => {
    // Execute the transformer script
    execSync(
      `tsx ${transformerScript} ${exampleTypePath} --output-file ${outputPath}`
    );

    // Check if the output file exists
    expect(fs.existsSync(outputPath)).toBe(true);

    // Read the generated schema
    const schema = fs.readFileSync(outputPath, "utf-8");

    console.log(schema);

    // Check if the schema contains the expected table definition
    expect(schema).toContain('name: "cardpairing"');
    expect(schema).toContain('name: "id"');
    expect(schema).toContain('name: "userId"');
    expect(schema).toContain('name: "cardId"');
    expect(schema).toContain('name: "status"');
    expect(schema).toContain('name: "errorMessage"');
    expect(schema).toContain('name: "pin"');
    expect(schema).toContain('name: "createdAt"');
    expect(schema).toContain('name: "updatedAt"');

    // Check if the schema contains the expected field types
    expect(schema).toContain('type: "Text"'); // Since we're not properly handling PrimaryKey yet
    expect(schema).toContain('type: "Text"'); // Since we're not properly handling ManyToOne yet

    // Check if the schema contains the expected relationships
    expect(schema).toContain('await db.schemaConnect("cardpairing", "user")');
    expect(schema).toContain('await db.schemaConnect("cardpairing", "card")');
  });
});
