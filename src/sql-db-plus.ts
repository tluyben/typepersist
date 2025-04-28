import _ from "lodash";

// Import types from core-db-plus
import {
  FieldType,
  QueryPlus,
  TableDefinitionPlus,
  WherePlus,
} from "./basetypes";

// SQLite interface that provides execSql and querySql methods
export interface SQLiteInterface {
  execSql(sql: string, params?: any[]): Promise<void>;
  querySql(sql: string, params?: any[]): Promise<any[]>;
}

export class SQLDBPlus {
  private sqliteInterface: SQLiteInterface;
  private currentDB?: string;
  private transactionOpen = false;
  private autoCommit = false;

  constructor(sqliteInterface: SQLiteInterface) {
    this.sqliteInterface = sqliteInterface;
  }

  async useDB(name: string): Promise<void> {
    this.currentDB = name;
  }

  async createTable(tableDefinition: TableDefinitionPlus) {
    const sql = this.generateCreateTableSQL(tableDefinition);
    await this.sqliteInterface.execSql(sql);
  }

  private generateCreateTableSQL(tableDefinition: TableDefinitionPlus): string {
    const { name, fields, compoundIndexes } = tableDefinition;

    // Start with CREATE TABLE statement
    let sql = `CREATE TABLE IF NOT EXISTS ${name} (`;

    // Add id column as primary key
    sql += `id INTEGER PRIMARY KEY AUTOINCREMENT`;

    // Add fields
    for (const field of fields) {
      sql += `, ${this.getSQLiteFieldDefinition(field)}`;
    }

    // Close the CREATE TABLE statement
    sql += `)`;

    return sql;
  }

  private getSQLiteFieldDefinition(field: any): string {
    const { name, type, required, indexed, defaultValue } = field;

    // Map FieldType to SQLite type
    let sqliteType = this.getSQLiteType(type);

    // Add NOT NULL if required
    if (required) {
      sqliteType += " NOT NULL";
    }

    // Add DEFAULT value if provided
    if (defaultValue !== undefined) {
      sqliteType += ` DEFAULT ${this.formatDefaultValue(defaultValue, type)}`;
    }

    // Add UNIQUE or INDEX if specified
    if (indexed === "Unique") {
      sqliteType += " UNIQUE";
    }

    return `${name} ${sqliteType}`;
  }

  private getSQLiteType(fieldType: FieldType): string {
    switch (fieldType) {
      case "Text":
      case "Password":
      case "UUID":
      case "Enum":
        return "TEXT";
      case "Integer":
      case "ID":
        return "INTEGER";
      case "Currency":
      case "Float":
      case "Double":
      case "Decimal":
        return "REAL";
      case "Datetime":
      case "Time":
      case "Date":
      case "CreatedAt":
      case "UpdatedAt":
        return "TEXT";
      case "Boolean":
        return "INTEGER";
      case "Binary":
        return "BLOB";
      case "ReferenceOneToOne":
      case "ReferenceManyToOne":
        return "INTEGER";
      case "ReferenceOneToMany":
      case "ReferenceManyToMany":
        return ""; // These are handled through separate junction tables
      default:
        return "TEXT";
    }
  }

  private formatDefaultValue(value: any, type: FieldType): string {
    if (typeof value === "string") {
      return `'${value.replace(/'/g, "''")}'`;
    }
    return value;
  }

  async schemaDrop(name: string): Promise<void> {
    const sql = `DROP TABLE IF EXISTS ${name}`;
    await this.sqliteInterface.execSql(sql);
  }

  async schemaDropField(tableName: string, fieldName: string): Promise<void> {
    // SQLite now supports DROP COLUMN directly
    const sql = `ALTER TABLE ${tableName} DROP COLUMN ${fieldName}`;
    await this.sqliteInterface.execSql(sql);
  }

  async schemaRename(oldName: string, newName: string): Promise<void> {
    const sql = `ALTER TABLE ${oldName} RENAME TO ${newName}`;
    await this.sqliteInterface.execSql(sql);
  }

  async schemaRenameField(
    schema: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    // SQLite now supports RENAME COLUMN directly
    const sql = `ALTER TABLE ${schema} RENAME COLUMN ${oldName} TO ${newName}`;
    await this.sqliteInterface.execSql(sql);
  }

  async schemaConnect(parentName: string, childName: string): Promise<void> {
    const foreignKeyField = `${_.camelCase(parentName)}Id`;

    // Check if the foreign key column exists
    const tableInfo = await this.sqliteInterface.querySql(
      `PRAGMA table_info(${childName})`
    );

    const columnExists = tableInfo.some(
      (col: any) => col.name === foreignKeyField
    );

    if (!columnExists) {
      // Add the foreign key column
      const sql = `ALTER TABLE ${childName} ADD COLUMN ${foreignKeyField} INTEGER REFERENCES ${parentName}(id)`;
      await this.sqliteInterface.execSql(sql);
    }
  }

  async getForeignKeys(tableName: string): Promise<any[]> {
    const sql = `PRAGMA foreign_key_list(${tableName})`;
    return await this.sqliteInterface.querySql(sql);
  }

  async startTransaction(autoCommit = false): Promise<SQLDBPlus> {
    if (this.transactionOpen) {
      return this;
    }

    await this.sqliteInterface.execSql("BEGIN TRANSACTION");
    this.transactionOpen = true;
    this.autoCommit = autoCommit;
    return this;
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionOpen) {
      throw new Error("Not in a transaction");
    }

    await this.sqliteInterface.execSql("COMMIT");
    this.transactionOpen = false;
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionOpen) {
      throw new Error("Not in a transaction");
    }

    await this.sqliteInterface.execSql("ROLLBACK");
    this.transactionOpen = false;
  }

  async releaseTransaction(): Promise<void> {
    if (!this.transactionOpen) {
      return;
    }

    if (this.autoCommit) {
      await this.commitTransaction();
    } else {
      await this.rollbackTransaction();
    }
  }

  async rawQuery(query: string, args: any[]): Promise<any> {
    return await this.sqliteInterface.querySql(query, args);
  }

  async insert(tableName: string, data: Record<string, any>): Promise<number> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => "?").join(", ");

    const sql = `INSERT INTO ${tableName} (${columns.join(
      ", "
    )}) VALUES (${placeholders})`;

    await this.sqliteInterface.execSql(sql, values);

    // Get the last inserted ID
    const result = await this.sqliteInterface.querySql(
      "SELECT last_insert_rowid() as id"
    );
    return result[0].id;
  }

  async update(
    tableName: string,
    id: number,
    data: Record<string, any>
  ): Promise<void> {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = [...Object.values(data), id];

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;

    await this.sqliteInterface.execSql(sql, values);
  }

  async upsert(tableName: string, data: Record<string, any>): Promise<number> {
    if (data.id) {
      await this.update(tableName, data.id, data);
      return data.id;
    } else {
      return await this.insert(tableName, data);
    }
  }

  async delete(tableName: string, ids: number[]): Promise<void> {
    const placeholders = ids.map(() => "?").join(", ");
    const sql = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;

    await this.sqliteInterface.execSql(sql, ids);
  }

  private rewriteQuery(query: WherePlus, tableName?: string): any {
    if (!query) return null;

    // Handle OR conditions
    if ("Or" in query) {
      return {
        Or: query.Or.map((condition) =>
          this.rewriteQuery(condition, tableName)
        ),
      };
    }

    // Handle AND conditions
    if ("And" in query) {
      return {
        And: query.And.map((condition) =>
          this.rewriteQuery(condition, tableName)
        ),
      };
    }

    // Handle comparison conditions
    if ("field" in query && "cmp" in query && "value" in query) {
      // Don't add table prefix if it's already prefixed
      const field = query.field.includes(".")
        ? query.field
        : tableName
        ? `${tableName}.${query.field}`
        : query.field;
      return {
        left: field,
        leftType: "Field",
        cmp: query.cmp,
        right: query.value,
        rightType: "SearchString",
      };
    }

    return query;
  }

  async query(query: QueryPlus): Promise<any[]> {
    // Transform the query if it's a QueryPlus
    if (query.table && query.table.length > 0) {
      // Transform each table query
      for (const t of query.table) {
        if (t.query) {
          t.query = this.rewriteQuery(t.query, t.table);
        }
      }
    }

    // Build the SQL query
    const { sql, params } = this.buildQuerySQL(query);

    // Execute the query
    return await this.sqliteInterface.querySql(sql, params);
  }

  private buildQuerySQL(query: QueryPlus): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = "SELECT ";

    // Handle field selection
    if (query.field) {
      const fields: string[] = [];
      for (const [table, tableFields] of Object.entries(query.field)) {
        for (const field of tableFields) {
          fields.push(`${table}.${field}`);
        }
      }
      sql += fields.join(", ");
    } else {
      sql += "*";
    }

    // Handle table joins
    sql += " FROM ";
    const tables: string[] = [];
    for (const t of query.table) {
      tables.push(t.table);
    }
    sql += tables.join(", ");

    // Handle WHERE conditions
    if (query.table.length > 0 && query.table[0].query) {
      const { whereSql, whereParams } = this.buildWhereSQL(
        query.table[0].query,
        query.table[0].table
      );
      sql += ` WHERE ${whereSql}`;
      params.push(...whereParams);
    }

    // Handle sorting
    if (query.sort && query.sort.length > 0) {
      sql += " ORDER BY ";
      const sortClauses = query.sort.map((sort) => {
        return `${sort.fieldId} ${sort.direction.toUpperCase()}`;
      });
      sql += sortClauses.join(", ");
    }

    // Handle pagination
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
      if (query.page) {
        sql += ` OFFSET ${(query.page - 1) * query.limit}`;
      }
    }

    return { sql, params };
  }

  private buildWhereSQL(
    where: WherePlus,
    tableName: string
  ): { whereSql: string; whereParams: any[] } {
    const params: any[] = [];
    let whereSql = "";

    if ("Or" in where) {
      const orConditions = where.Or.map((condition) => {
        const { whereSql, whereParams } = this.buildWhereSQL(
          condition,
          tableName
        );
        params.push(...whereParams);
        return `(${whereSql})`;
      });
      whereSql = orConditions.join(" OR ");
    } else if ("And" in where) {
      const andConditions = where.And.map((condition) => {
        const { whereSql, whereParams } = this.buildWhereSQL(
          condition,
          tableName
        );
        params.push(...whereParams);
        return `(${whereSql})`;
      });
      whereSql = andConditions.join(" AND ");
    } else if ("field" in where && "cmp" in where && "value" in where) {
      const { field, cmp, value } = where;

      // Map comparison operators to SQL
      let operator = "";
      switch (cmp) {
        case "eq":
          operator = "=";
          break;
        case "neq":
        case "ne":
          operator = "!=";
          break;
        case "gt":
          operator = ">";
          break;
        case "gte":
          operator = ">=";
          break;
        case "lt":
          operator = "<";
          break;
        case "lte":
          operator = "<=";
          break;
        case "like":
          operator = "LIKE";
          break;
        case "nlike":
          operator = "NOT LIKE";
          break;
        case "in":
          operator = "IN";
          break;
        case "nin":
          operator = "NOT IN";
          break;
        case "not":
          operator = "!=";
          break;
        default:
          throw new Error(`Unsupported operator: ${cmp}`);
      }

      // Handle different value types
      if (operator === "IN" || operator === "NOT IN") {
        if (Array.isArray(value)) {
          const placeholders = value.map(() => "?").join(", ");
          whereSql = `${field} ${operator} (${placeholders})`;
          params.push(...value);
        } else {
          throw new Error("IN operator requires an array value");
        }
      } else if (operator === "LIKE" || operator === "NOT LIKE") {
        whereSql = `${field} ${operator} ?`;
        params.push(`%${value}%`);
      } else {
        whereSql = `${field} ${operator} ?`;
        params.push(value);
      }
    }

    return { whereSql, whereParams: params };
  }

  async close(): Promise<void> {
    // Nothing to close in this implementation
  }
}
