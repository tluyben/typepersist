#!/usr/bin/env ts-node

/**
 * This example demonstrates how to use the TypePersist transformer and CLI tools.
 *
 * It shows how to:
 * 1. Transform TypeScript type definitions to CoreDBPlus schema
 * 2. Use the CLI to interact with the database
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Path to the transformer script
const transformerScript = path.join(
  __dirname,
  "../src/core-db-plus-convertts.ts"
);

// Path to the CLI script
const cliScript = path.join(__dirname, "../src/core-db-plus-cli.ts");

// Path to the example type definition
const typeDefinitionPath = path.join(__dirname, "card-pairing.ts");

// Path to the output schema
const outputSchemaPath = path.join(__dirname, "schema.ts");

// Function to transform type definitions to CoreDBPlus schema
function transformTypes() {
  console.log("Transforming type definitions to CoreDBPlus schema...");

  try {
    // Execute the transformer script
    execSync(
      `npx tsx ${transformerScript} ${typeDefinitionPath} --output-file ${outputSchemaPath}`
    );
    console.log("Transformation completed successfully!");

    // Display the generated schema
    const schema = fs.readFileSync(outputSchemaPath, "utf-8");
    console.log("\nGenerated Schema:");
    console.log(schema);
  } catch (error) {
    console.error("Error during transformation:", error);
  }
}

// Function to demonstrate CLI usage
function demonstrateCLI() {
  console.log("\nDemonstrating CLI usage...");
  console.log("To use the CLI, run:");
  console.log(`ts-node ${cliScript}`);
  console.log("\nThen you can use the following commands:");
  console.log("  transform ./examples/card-pairing.ts ./examples/schema.ts");
  console.log('  query {"table":[{"table":"cardpairing"}]}');
  console.log(
    '  insert cardpairing {"id":"1","userId":"user1","cardId":"card1","status":"pending","createdAt":"2023-01-01T00:00:00Z","updatedAt":"2023-01-01T00:00:00Z"}'
  );
  console.log(
    '  update cardpairing {"field":"id","cmp":"eq","value":"1"} {"status":"success"}'
  );
  console.log('  delete cardpairing {"field":"id","cmp":"eq","value":"1"}');
}

// Main function
function main() {
  console.log("TypePersist Example");
  console.log("==================");

  // Transform type definitions
  transformTypes();

  // Demonstrate CLI usage
  demonstrateCLI();
}

// Run the main function
main();
