#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { CoreDB, FieldType } from "./core-db";
import {
  importFromJSON,
  importFromSQL,
  exportTables,
  generateSQL,
  listTables,
  getTableDefinition,
  dumpRecords,
} from "./core-db-utils";

// Command line argument parsing
const args = process.argv.slice(2);

let connectionString: string | undefined;
let importFile: string | undefined;
let tablesToExport: string[] = [];
let includeData = false;
let exportFormat: "json" | "sql" = "json";

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "-connection":
      connectionString = args[++i];
      break;
    case "-import":
      importFile = args[++i];
      break;
    case "-export":
      while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        tablesToExport.push(args[++i]);
      }
      break;
    case "-include-data":
      includeData = true;
      break;
    case "-format":
      exportFormat = args[++i] as "json" | "sql";
      break;
  }
}

async function main() {
  // Initialize the CoreDB instance
  if (!connectionString) {
    throw new Error("Connection string is required");
  }
  const db = new CoreDB(connectionString);

  // Import data if specified
  if (importFile) {
    const fileExt = path.extname(importFile).toLowerCase();
    const fileData = fs.readFileSync(importFile, "utf8");

    if (fileExt === ".json") {
      await importFromJSON(db, JSON.parse(fileData));
    } else if (fileExt === ".sql") {
      await importFromSQL(db, fileData);
    } else {
      console.error(`Unsupported file extension: ${fileExt}`);
      process.exit(1);
    }
  }

  // Export data if specified
  if (tablesToExport.length > 0) {
    const exportData = await exportTables(db, tablesToExport, includeData);

    if (exportFormat === "json") {
      console.log(JSON.stringify(exportData, null, 2));
    } else {
      console.log(generateSQL(db, exportData));
    }

    process.exit(0);
  }

  return db;
}

// REPL input handler
const handleInput = async (input: string, db: CoreDB) => {
  const [command, ...args] = input.split(" ");

  switch (command) {
    case "/tables":
      const tableList = await listTables(db);
      const format = args[0] || "default";

      switch (format.toLowerCase()) {
        case "json":
          console.log(JSON.stringify(tableList, null, 2));
          break;
        case "sql":
          console.log(generateSQL(db, { tables: tableList }));
          break;
        default:
          console.table(tableList);
      }
      break;

    case "/describe":
      if (args.length === 0) {
        console.log("Please provide a table name");
        break;
      }

      const tableName = args[0];
      const tableDefinition = await getTableDefinition(db, tableName);
      const describeFormat = args[1] || "default";

      if (!tableDefinition) {
        console.log(`Table '${tableName}' not found`);
        break;
      }

      switch (describeFormat.toLowerCase()) {
        case "json":
          console.log(JSON.stringify(tableDefinition, null, 2));
          break;
        case "sql":
          console.log(generateSQL(db, { tables: [tableDefinition] }));
          break;
        default:
          console.table(tableDefinition.fields);
      }
      break;
    case "/dump":
      if (args.length === 0) {
        console.log("Please provide a table name");
        break;
      }

      console.table(dumpRecords(db, args[0]));
      break;
    case "/create-table":
      if (args.length === 0) {
        console.log("Please provide a table name");
        break;
      }

      const newTableName = args[0];
      try {
        await db.schemaCreateOrUpdate({
          name: newTableName,
          implementation: "Dynamic",
          fields: [],
        });
        console.log(`Table '${newTableName}' created successfully`);
      } catch (error) {
        console.error(
          `Error creating table: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;
    case "/create-field":
      if (args.length < 3) {
        console.log(
          "Usage: /create-field <table> <field> <type> [index: Default|Unique|Foreign]"
        );
        break;
      }

      const [targetTable, fieldName, fieldType] = args;
      const indexType = args[3];

      try {
        const existingTable = await getTableDefinition(db, targetTable);
        if (!existingTable) {
          console.error(`Table '${targetTable}' not found`);
          break;
        }

        const newField = {
          name: fieldName,
          type: fieldType as FieldType,
          indexed:
            indexType === "Unique" ||
            indexType === "Default" ||
            indexType === "Foreign"
              ? (indexType as "Unique" | "Default" | "Foreign")
              : undefined,
        };

        const updatedFields = [...existingTable.fields, newField];
        await db.schemaCreateOrUpdate({
          ...existingTable,
          fields: updatedFields,
        });

        console.log(
          `Field '${fieldName}' added to table '${targetTable}' successfully`
        );
      } catch (error) {
        console.error(
          `Error creating field: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;
    case "/join-table":
      if (args.length < 2) {
        console.log("Usage: /join-table <parent-table> <child-table>");
        break;
      }

      const [parentTable, childTable] = args;
      try {
        await db.schemaConnect(parentTable, childTable);
        console.log(
          `Tables joined successfully: '${parentTable}' -> '${childTable}'`
        );
      } catch (error) {
        console.error(
          `Error joining tables: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;
    case "/drop-table":
      if (args.length === 0) {
        console.log("Usage: /drop-table <table>");
        break;
      }

      try {
        await db.schemaDrop(args[0]);
        console.log(`Table '${args[0]}' dropped successfully`);
      } catch (error) {
        console.error(
          `Error dropping table: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;

    case "/drop-field":
      if (args.length < 2) {
        console.log("Usage: /drop-field <table> <field>");
        break;
      }

      try {
        await db.schemaDropField(args[0], args[1]);
        console.log(
          `Field '${args[1]}' dropped from table '${args[0]}' successfully`
        );
      } catch (error) {
        console.error(
          `Error dropping field: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;

    case "/rename-table":
      if (args.length < 2) {
        console.log("Usage: /rename-table <old-name> <new-name>");
        break;
      }

      try {
        await db.schemaRename(args[0], args[1]);
        console.log(
          `Table renamed from '${args[0]}' to '${args[1]}' successfully`
        );
      } catch (error) {
        console.error(
          `Error renaming table: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;

    case "/rename-field":
      if (args.length < 3) {
        console.log("Usage: /rename-field <table> <old-name> <new-name>");
        break;
      }

      try {
        await db.schemaRenameField(args[0], args[1], args[2]);
        console.log(
          `Field renamed from '${args[1]}' to '${args[2]}' in table '${args[0]}' successfully`
        );
      } catch (error) {
        console.error(
          `Error renaming field: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      break;

    case "/help":
      console.log(`
Available commands:

/tables [format]                    List all tables (format: json, sql, default)
/describe <table> [format]         Show table definition (format: json, sql, default)
/dump <table>                      Dump table data
/create-table <name>               Create a new table
/create-field <table> <field> <type> [index]  Add field to table (index: Default|Unique|Foreign)
/join-table <parent> <child>       Create foreign key relationship between tables
/drop-table <table>                Drop a table
/drop-field <table> <field>        Drop a field from a table
/rename-table <old> <new>          Rename a table
/rename-field <table> <old> <new>  Rename a field in a table

Field types:
- Text (standard text)
- Password (secure text)
- UUID (unique identifier)
- Integer (whole numbers)
- Currency (monetary values)
- Float (decimal numbers)
- Double (high-precision decimals)
- Decimal (exact decimals)
- Datetime (date and time)
- Time (time only)
- Date (date only)
- CreatedAt (automatic timestamp)
- UpdatedAt (automatic timestamp)
- Boolean (true/false)
- Binary (binary data)
- ID (primary key type)
- Enum (predefined options)
- ReferenceOneToOne (1:1 relation)
- ReferenceManyToOne (n:1 relation)
- ReferenceOneToMany (1:n relation)
- ReferenceManyToMany (n:n relation)

Examples:
/create-table users
/create-field users name Text
/create-field users age Integer Default
/create-field users email Text Unique
/join-table users posts
`);
      break;

    default:
      console.log(
        `Unknown command: ${command}. Type /help for available commands.`
      );
  }
};

// Start the application
main()
  .then((db) => {
    // Start the REPL
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("CoreDB REPL started. Type /help for available commands.");

    rl.on("line", async (input) => {
      await handleInput(input, db);
      rl.prompt();
    });

    rl.prompt();
  })
  .catch((error) => {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  });
