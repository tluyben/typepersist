#!/usr/bin/env ts-node

import { execSync } from "child_process";
import * as path from "path";
import * as readline from "readline";
import { CoreDBPlus } from "./core-db-plus";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt user for input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to transform type definitions to CoreDBPlus schema
async function transformTypes(inputPath: string, outputPath: string) {
  console.log(
    `Transforming type definitions from ${inputPath} to ${outputPath}...`
  );

  try {
    // Execute the transformer script
    execSync(
      `npx tsx${path.join(
        __dirname,
        "core-db-plus-convertts.ts"
      )} ${inputPath} --output-file ${outputPath}`
    );
    console.log("Transformation completed successfully!");
  } catch (error) {
    console.error("Error during transformation:", error);
  }
}

// Function to execute a query
async function executeQuery(db: CoreDBPlus, query: string) {
  try {
    // Parse the query string into a QueryPlus object
    const queryObj = JSON.parse(query);
    const result = await db.query(queryObj);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

// Function to insert data
async function insertData(db: CoreDBPlus, table: string, data: string) {
  try {
    // Parse the data string into an object
    const dataObj = JSON.parse(data);
    const result = await db.insert(table, dataObj);
    console.log("Data inserted successfully:", result);
  } catch (error) {
    console.error("Error inserting data:", error);
  }
}

// Function to update data
async function updateData(
  db: CoreDBPlus,
  table: string,
  query: string,
  data: string
) {
  try {
    // Parse the query and data strings into objects
    const queryObj = JSON.parse(query);
    const dataObj = JSON.parse(data);
    const result = await db.update(table, queryObj, dataObj);
    console.log("Data updated successfully:", result);
  } catch (error) {
    console.error("Error updating data:", error);
  }
}

// Function to delete data
async function deleteData(db: CoreDBPlus, table: string, query: string) {
  try {
    // Parse the query string into an object
    const queryObj = JSON.parse(query);
    const result = await db.delete(table, queryObj);
    console.log("Data deleted successfully:", result);
  } catch (error) {
    console.error("Error deleting data:", error);
  }
}

// Function to display help
function displayHelp() {
  console.log(`
CoreDBPlus CLI - Command Line Interface for CoreDBPlus

Commands:
  transform <input> <output>  - Transform type definitions to CoreDBPlus schema
  query <query>               - Execute a query
  insert <table> <data>      - Insert data into a table
  update <table> <query> <data> - Update data in a table
  delete <table> <query>     - Delete data from a table
  help                       - Display this help message
  exit                       - Exit the CLI

Examples:
  transform ./types/*.ts ./schema.ts
  query {"table":[{"table":"users"}]}
  insert users {"name":"John","email":"john@example.com"}
  update users {"field":"id","cmp":"eq","value":1} {"name":"John Doe"}
  delete users {"field":"id","cmp":"eq","value":1}
  `);
}

// Main function
async function main() {
  console.log("Welcome to CoreDBPlus CLI!");
  console.log('Type "help" for available commands or "exit" to quit.');

  // Initialize database
  const dbPath = await prompt(
    "Enter database path (default: ./database.sqlite): "
  );
  const db = new CoreDBPlus(dbPath || "./database.sqlite");

  // Main loop
  while (true) {
    const command = await prompt("> ");

    if (command === "exit") {
      break;
    } else if (command === "help") {
      displayHelp();
    } else {
      const parts = command.split(" ");
      const cmd = parts[0];

      if (cmd === "transform") {
        if (parts.length < 3) {
          console.log("Usage: transform <input> <output>");
        } else {
          await transformTypes(parts[1], parts[2]);
        }
      } else if (cmd === "query") {
        if (parts.length < 2) {
          console.log("Usage: query <query>");
        } else {
          const query = parts.slice(1).join(" ");
          await executeQuery(db, query);
        }
      } else if (cmd === "insert") {
        if (parts.length < 3) {
          console.log("Usage: insert <table> <data>");
        } else {
          const table = parts[1];
          const data = parts.slice(2).join(" ");
          await insertData(db, table, data);
        }
      } else if (cmd === "update") {
        if (parts.length < 4) {
          console.log("Usage: update <table> <query> <data>");
        } else {
          const table = parts[1];
          const query = parts[2];
          const data = parts.slice(3).join(" ");
          await updateData(db, table, query, data);
        }
      } else if (cmd === "delete") {
        if (parts.length < 3) {
          console.log("Usage: delete <table> <query>");
        } else {
          const table = parts[1];
          const query = parts.slice(2).join(" ");
          await deleteData(db, table, query);
        }
      } else {
        console.log('Unknown command. Type "help" for available commands.');
      }
    }
  }

  rl.close();
  console.log("Goodbye!");
}

// Run the main function
main().catch(console.error);
