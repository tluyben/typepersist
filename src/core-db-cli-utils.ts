import { CoreDB, TableDefinition, FieldDef } from "./core-db";

interface TableData extends TableDefinition {
  data?: Record<string, any>[];
}

interface ImportExportData {
  tables: TableData[];
}

export async function importFromJSON(db: CoreDB, data: ImportExportData): Promise<void> {
  if (!Array.isArray(data.tables)) {
    throw new Error("Invalid JSON format: expected 'tables' array");
  }

  for (const table of data.tables) {
    const { data: tableData, ...tableDefinition } = table;
    await db.schemaCreateOrUpdate(tableDefinition);

    if (tableData && Array.isArray(tableData)) {
      for (const row of tableData) {
        await db.insert(table.name, row);
      }
    }
  }
}

export async function importFromSQL(db: CoreDB, sql: string): Promise<void> {
  const statements = sql
    .split(";")
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (const statement of statements) {
    await db.query({
      table: [{ table: "sqlite_master" }],
      query: {
        And: [{
          left: "sql",
          leftType: "Field",
          cmp: "eq",
          right: statement,
          rightType: "Value"
        }]
      }
    });
  }
}

export async function exportTables(
  db: CoreDB,
  tableNames: string[],
  includeData: boolean
): Promise<ImportExportData> {
  const result: ImportExportData = {
    tables: []
  };

  for (const tableName of tableNames) {
    const definition = await getTableDefinition(db, tableName);
    if (definition) {
      const tableExport: TableData = {
        ...definition
      };

      if (includeData) {
        const data = await db.query({
          table: [{ table: tableName }]
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
        if (field.defaultValue !== undefined) def += ` DEFAULT ${field.defaultValue}`;
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
          const values = Object.values(row).map(v => typeof v === "string" ? `'${v}'` : v).join(", ");
          sql += `INSERT INTO ${table.name} (${fields}) VALUES (${values});\n`;
        });
        sql += "\n";
      }
    }
  }

  return sql;
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
