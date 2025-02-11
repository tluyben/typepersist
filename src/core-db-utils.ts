import _ from "lodash";
import { CoreDB, TableDefinition, FieldDef } from "./core-db";

export interface TableData extends TableDefinition {
  data?: Record<string, any>[];
}

export interface ImportExportData {
  tables: TableData[];
}

// New types for the different import formats
export type SchemaOnlyImport = TableDefinition[];

export interface DataOnlyImport {
  [tableName: string]: Record<string, any>[];
}

export interface SchemaAndDataImport {
  schema: TableDefinition[];
  data: {
    [tableName: string]: (Record<string, any> & {
      [childTable: string]: Record<string, any>[];
    })[];
  };
}

export type ImportFormat =
  | ImportExportData
  | SchemaOnlyImport
  | DataOnlyImport
  | SchemaAndDataImport;

function isSchemaOnlyImport(data: any): data is SchemaOnlyImport {
  return (
    Array.isArray(data) &&
    data.every(
      (table) =>
        typeof table === "object" &&
        "name" in table &&
        "fields" in table &&
        Array.isArray(table.fields)
    )
  );
}

function isDataOnlyImport(data: any): data is DataOnlyImport {
  return (
    typeof data === "object" &&
    !Array.isArray(data) &&
    !("schema" in data) &&
    !("tables" in data) &&
    Object.values(data).every((value) => Array.isArray(value))
  );
}

function isSchemaAndDataImport(data: any): data is SchemaAndDataImport {
  return (
    typeof data === "object" &&
    "schema" in data &&
    "data" in data &&
    Array.isArray(data.schema) &&
    typeof data.data === "object"
  );
}

function isLegacyImport(data: any): data is ImportExportData {
  return (
    typeof data === "object" && "tables" in data && Array.isArray(data.tables)
  );
}

async function connectRelatedTables(
  db: CoreDB,
  schema: TableDefinition[]
): Promise<void> {
  for (const table of schema) {
    for (const field of table.fields) {
      if (field.type === "ReferenceManyToOne" && field.foreignTable) {
        await db.schemaConnect(field.foreignTable, table.name);
      }
    }
  }
}

export async function importFromJSON(
  db: CoreDB,
  data: ImportFormat
): Promise<void> {
  try {
    // console.log("Import format:", JSON.stringify(data, null, 2));

    // Handle schema-only import (array of table definitions)
    if (isSchemaOnlyImport(data)) {
      for (const tableDefinition of data) {
        await db.schemaCreateOrUpdate(tableDefinition);
      }
      await connectRelatedTables(db, data);
      return;
    }

    // Handle data-only import (object with table names as keys)
    if (isDataOnlyImport(data)) {
      for (const [tableName, records] of Object.entries(data)) {
        for (const record of records) {
          try {
            await db.insert(tableName, record);
          } catch (error) {
            if (error instanceof Error) {
              throw new Error(
                `Failed to insert data into ${tableName}: ${error.message}`
              );
            }
            throw error;
          }
        }
      }
      return;
    }

    // Handle combined schema and data import
    if (isSchemaAndDataImport(data)) {
      // First create all tables
      for (const tableDefinition of data.schema) {
        await db.schemaCreateOrUpdate(tableDefinition);
      }
      await connectRelatedTables(db, data.schema);

      // Then import all data
      for (const [tableName, records] of Object.entries(data.data)) {
        for (const record of records) {
          try {
            // Extract nested data before inserting
            const { id, ...recordData } = record;
            const nestedTables = Object.keys(recordData).filter(
              (key) =>
                Array.isArray(recordData[key]) &&
                data.schema.some((s) => s.name === key)
            );

            // Remove nested data before inserting parent
            const parentData = { ...recordData };
            nestedTables.forEach((table) => delete parentData[table]);

            // Insert parent record
            const parentId = id || (await db.insert(tableName, parentData));

            // Insert nested records
            for (const childTable of nestedTables) {
              const childRecords = recordData[childTable];
              for (const childRecord of childRecords) {
                const { id: childId, ...childData } = childRecord;
                // Add foreign key reference
                childData[`${_.camelCase(tableName)}Id`] = parentId;
                await importRecord(db, childTable, childData, data.schema);
              }
            }
          } catch (error) {
            if (error instanceof Error) {
              throw new Error(
                `Failed to insert data into ${tableName}: ${error.message}`
              );
            }
            throw error;
          }
        }
      }
      return;
    }

    // Handle legacy format
    if (isLegacyImport(data)) {
      for (const table of data.tables) {
        const { data: tableData, ...tableDefinition } = table;
        await db.schemaCreateOrUpdate(tableDefinition);

        if (tableData && Array.isArray(tableData)) {
          for (const row of tableData) {
            try {
              await db.insert(table.name, row);
            } catch (error) {
              if (error instanceof Error) {
                throw new Error(
                  `Failed to insert data into ${table.name}: ${error.message}`
                );
              }
              throw error;
            }
          }
        }
      }
      return;
    }

    throw new Error("Invalid import format");
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.log(error);
    throw new Error("Import failed with unknown error");
  }
}

async function importRecord(
  db: CoreDB,
  tableName: string,
  record: Record<string, any>,
  schema: TableDefinition[]
): Promise<number> {
  try {
    // Extract nested data before inserting
    const { id, ...recordData } = record;
    const nestedTables = Object.keys(recordData).filter(
      (key) =>
        Array.isArray(recordData[key]) && schema.some((s) => s.name === key)
    );

    // Remove nested data before inserting parent
    const parentData = { ...recordData };
    nestedTables.forEach((table) => delete parentData[table]);

    // Insert parent record
    // console.log("my records", await dumpRecords(db, "Publisher"));
    const insertedId = id || (await db.insert(tableName, parentData));
    // console.log(`Successfully inserted ${tableName} with id:`, insertedId);

    // Insert nested records
    for (const childTable of nestedTables) {
      const childRecords = recordData[childTable];
      for (const childRecord of childRecords) {
        const { id: childId, ...childData } = childRecord;
        // Add foreign key reference
        childData[`${tableName}Id`] = insertedId;
        await importRecord(db, childTable, childData, schema);
      }
    }

    return insertedId;
  } catch (error) {
    console.error(`Error importing record for ${tableName}:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to insert ${tableName}: ${error.message}`);
    }
    throw error;
  }
}

export async function importFromSQL(db: CoreDB, sql: string): Promise<void> {
  const statements = sql
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  for (const statement of statements) {
    await db.query({
      table: [{ table: "sqlite_master" }],
      query: {
        And: [
          {
            left: "sql",
            leftType: "Field",
            cmp: "eq",
            right: statement,
            rightType: "Value",
          },
        ],
      },
    });
  }
}

export async function exportTables(
  db: CoreDB,
  tableNames: string[],
  includeData: boolean
): Promise<ImportExportData> {
  const result: ImportExportData = {
    tables: [],
  };

  for (const tableName of tableNames) {
    const definition = await getTableDefinition(db, tableName);
    if (definition) {
      const tableExport: TableData = {
        ...definition,
      };

      if (includeData) {
        const data = await db.query({
          table: [{ table: tableName }],
        });
        tableExport.data = data;
      }

      result.tables.push(tableExport);
    }
  }

  return result;
}

export function generateSQL(db: CoreDB, data: ImportExportData): string {
  if (!data) return "";

  let sql = "";

  // Handle table definitions
  if (data.tables) {
    for (const table of data.tables) {
      // Create table
      sql += `CREATE TABLE IF NOT EXISTS ${table.name} (\n`;
      sql += "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n";

      // Add fields
      const fieldDefs = table.fields.map((field: FieldDef) => {
        let def = `  ${field.name} ${field.type}`;
        if (field.required) def += " NOT NULL";
        if (field.defaultValue !== undefined)
          def += ` DEFAULT ${field.defaultValue}`;
        if (field.indexed === "Unique") def += " UNIQUE";
        return def;
      });

      sql += fieldDefs.join(",\n");
      sql += "\n);\n\n";

      // Create indexes
      table.fields.forEach((field: FieldDef) => {
        if (field.indexed === "Default" || field.indexed === "Foreign") {
          sql += `CREATE INDEX IF NOT EXISTS idx_${table.name}_${field.name} ON ${table.name}(${field.name});\n`;
        }
      });

      // Insert data if present
      if (table.data) {
        table.data.forEach((row: Record<string, any>) => {
          const fields = Object.keys(row).join(", ");
          const values = Object.values(row)
            .map((v) => (typeof v === "string" ? `'${v}'` : v))
            .join(", ");
          sql += `INSERT INTO ${table.name} (${fields}) VALUES (${values});\n`;
        });
        sql += "\n";
      }
    }
  }

  return sql;
}

export async function dumpRecords(
  db: CoreDB,
  tableName: string
): Promise<Record<string, any>[]> {
  try {
    const records = await db.query({
      table: [{ table: tableName }],
    });

    return records;
  } catch (error) {
    console.error(`Error dumping records from ${tableName}:`, error);
    return [];
  }
}

export async function listTables(db: CoreDB): Promise<TableDefinition[]> {
  try {
    const query = await db.query({
      table: [{ table: "sqlite_master" }],
      query: {
        And: [
          {
            left: "type",
            leftType: "Field",
            cmp: "eq",
            right: "table",
            rightType: "Value",
          },
        ],
      },
    });

    return query.map((row) => ({
      name: row.name,
      implementation: "Dynamic",
      fields: [], // We'll populate this in getTableDefinition
    }));
  } catch (error) {
    console.error("Error listing tables:", error);
    return [];
  }
}

export async function getTableDefinition(
  db: CoreDB,
  tableName: string
): Promise<TableDefinition | undefined> {
  try {
    const tableInfo = await db.query({
      table: [{ table: "sqlite_master" }],
      query: {
        And: [
          {
            left: "type",
            leftType: "Field",
            cmp: "eq",
            right: "table",
            rightType: "Value",
          },
          {
            left: "name",
            leftType: "Field",
            cmp: "eq",
            right: tableName,
            rightType: "Value",
          },
        ],
      },
    });

    if (tableInfo.length === 0) {
      return undefined;
    }

    const columnsQuery = await db.query({
      table: [{ table: "pragma_table_info('" + tableName + "')" }],
    });

    const fields: FieldDef[] = columnsQuery.map((col) => ({
      name: col.name,
      type: col.type.toUpperCase(),
      required: !col.notnull,
      defaultValue: col.dflt_value,
    }));

    return {
      name: tableName,
      implementation: "Dynamic",
      fields,
    };
  } catch (error) {
    console.error(`Error getting table definition for ${tableName}:`, error);
    return undefined;
  }
}
