import {
  CoreDB,
  Where as CoreWhere,
  FieldDef,
  FieldType,
  Query,
  Sort,
  TableDefinition,
  WhereBoolAnd,
  WhereBoolOr,
  WhereCmp,
} from "./core-db";

/**
 * Field definition for queries
 *
 * @template T The table type
 * @template K The field key type (defaults to keyof T)
 */
export type Field<T, K extends keyof T = keyof T> = {
  field: K;
  as?: string;
};

/**
 * Field definition for multi-table queries
 *
 * @template T The table type
 * @template K The field key type (defaults to keyof T)
 */
export type TableField<T, K extends keyof T = keyof T> = {
  table: string;
  field: K;
  as?: string;
};

/**
 * Type-safe wrapper for CoreDB
 *
 * This wrapper provides type-safe query building and schema creation
 * on top of the CoreDB class.
 */
export class TypeSafeDB {
  private db: CoreDB;

  constructor(connectionString: string | CoreDB) {
    if (typeof connectionString === "string") {
      this.db = new CoreDB(connectionString);
    } else {
      this.db = connectionString;
    }
  }

  /**
   * Get the underlying CoreDB instance
   */
  getCoreDB(): CoreDB {
    return this.db;
  }

  /**
   * Create or update a table schema based on a TypeScript type
   *
   * @param tableName The name of the table to create or update
   */
  async schemaCreateOrUpdate<T>(tableName?: string): Promise<void> {
    const tableDefinition = this.generateTableDefinition<T>();

    // If a table name is provided, override the one derived from the type
    if (tableName) {
      tableDefinition.name = tableName;
    }

    await this.db.schemaCreateOrUpdate(tableDefinition);
  }

  /**
   * Generate a table definition from a TypeScript type
   *
   * This method extracts field information from the type T and creates
   * a table definition that can be used with CoreDB.
   */
  private generateTableDefinition<T>(): TableDefinition {
    // Get the type name as the table name
    const typeName = this.getTypeName<T>();
    const tableName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    // Extract field information from the type T
    const fields: FieldDef[] = this.extractFieldsFromType<T>();

    return {
      name: tableName,
      implementation: "Static",
      fields: fields,
    };
  }

  /**
   * Get the name of a TypeScript type
   *
   * This method extracts the name of the type T using TypeScript's type system.
   */
  private getTypeName<T>(): string {
    // In TypeScript, we can't directly get the name of a type at runtime
    // because types are erased during compilation. We need to use a workaround.

    // Create a sample instance of the type to get its constructor name
    const sample = {} as T;
    // Use type assertion to access constructor property
    const constructorName = (sample as any).constructor?.name;

    // If we can't get the constructor name, use a fallback
    if (!constructorName || constructorName === "Object") {
      // Try to extract from the type itself using a regex on the type string
      const typeString = Object.prototype.toString.call(sample);
      const match = typeString.match(/\[object (\w+)\]/);
      if (match && match[1]) {
        return match[1];
      }

      // If all else fails, use a default name
      return "UnknownType";
    }

    return constructorName;
  }

  /**
   * Extract field information from a TypeScript type
   *
   * This method extracts field information from the type T and creates
   * field definitions that can be used with CoreDB.
   */
  private extractFieldsFromType<T>(): FieldDef[] {
    // In TypeScript, we can't directly inspect the type at runtime
    // because types are erased during compilation. We need to use a workaround.

    // Create a sample instance of the type
    const sample = {} as T;
    const fields: FieldDef[] = [];

    // Get all properties of the object, including those from the prototype chain
    const allProps = new Set<string>();

    // Get own properties
    Object.getOwnPropertyNames(sample).forEach((prop) => allProps.add(prop));

    // Get properties from prototype chain
    let proto = Object.getPrototypeOf(sample);
    while (proto && proto !== Object.prototype) {
      Object.getOwnPropertyNames(proto).forEach((prop) => allProps.add(prop));
      proto = Object.getPrototypeOf(proto);
    }

    // Convert to array and filter out non-enumerable properties
    const props = Array.from(allProps).filter((prop) => {
      try {
        return (
          Object.getOwnPropertyDescriptor(sample, prop)?.enumerable !== false
        );
      } catch {
        return false;
      }
    });

    // Create field definitions for each property
    for (const prop of props) {
      // Skip internal properties
      if (prop.startsWith("_") || prop === "constructor") {
        continue;
      }

      // Get the value to determine its type
      const value = (sample as any)[prop];

      // Determine the field type based on the value
      let fieldType: FieldType = "Text"; // Default to Text

      if (value === null || value === undefined) {
        // Can't determine type from null/undefined, default to Text
        fieldType = "Text";
      } else if (typeof value === "number") {
        // Check if it's an integer or float
        fieldType = Number.isInteger(value) ? "Integer" : "Float";
      } else if (typeof value === "boolean") {
        fieldType = "Boolean";
      } else if (value instanceof Date) {
        fieldType = "Datetime"; // Note: Corrected from 'DateTime' to 'Datetime'
      } else if (Array.isArray(value)) {
        fieldType = "Text"; // Arrays are stored as JSON strings
      } else if (typeof value === "object") {
        fieldType = "Text"; // Objects are stored as JSON strings
      }

      // Create a field definition
      const fieldDef: FieldDef = {
        name: prop,
        type: fieldType,
        required: false, // Default to not required
      };

      // Check for decorators or metadata that might indicate additional properties
      // This is a simplified approach - in a real implementation, you would
      // use TypeScript's reflection capabilities or a transformer

      // For now, we'll use a simple naming convention to determine if a field
      // should be indexed or unique
      if (prop.toLowerCase().includes("id") && prop.toLowerCase() !== "id") {
        fieldDef.indexed = "Default";
      }

      if (
        prop.toLowerCase().includes("email") ||
        prop.toLowerCase().includes("username")
      ) {
        fieldDef.indexed = "Unique";
      }

      fields.push(fieldDef);
    }

    // If no fields were found, add a default 'id' field
    if (fields.length === 0) {
      fields.push({
        name: "id",
        type: "Integer",
        required: true,
        indexed: "Unique",
      });
    }

    return fields;
  }

  /**
   * Insert a record into a table
   *
   * @param data The data to insert
   */
  async insert<T>(data: Omit<T, "id">): Promise<number> {
    // Get the type name as the table name
    const typeName = this.getTypeName<T>();
    const tableName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    return await this.db.insert(tableName, data as Record<string, any>);
  }

  /**
   * Update a record in a table
   *
   * @param id The ID of the record to update
   * @param data The data to update
   */
  async update<T>(id: number, data: Partial<T>): Promise<void> {
    // Get the type name as the table name
    const typeName = this.getTypeName<T>();
    const tableName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    await this.db.update(tableName, id, data as Record<string, any>);
  }

  /**
   * Delete records from a table
   *
   * @param ids The IDs of the records to delete
   */
  async delete<T>(ids: number[]): Promise<void> {
    // Get the type name as the table name
    const typeName = this.getTypeName<T>();
    const tableName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    await this.db.delete(tableName, ids);
  }

  /**
   * Upsert a record in a table
   *
   * @param data The data to upsert
   */
  async upsert<T>(data: T & { id?: number }): Promise<number> {
    // Get the type name as the table name
    const typeName = this.getTypeName<T>();
    const tableName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    return await this.db.upsert(tableName, data as Record<string, any>);
  }

  /**
   * Create a query builder for a table
   *
   * @param tableName The name of the table
   */
  _query<T>(tableName: string): TypeSafeQueryBuilder<T> {
    return new TypeSafeQueryBuilder<T>(this, tableName);
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.db.close();
  }

  /**
   * Start a transaction
   */
  async startTransaction(autoCommit = false): Promise<TypeSafeDB> {
    const tx = await this.db.startTransaction(autoCommit);
    return new TypeSafeDB(tx);
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(): Promise<void> {
    await this.db.commitTransaction();
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(): Promise<void> {
    await this.db.rollbackTransaction();
  }

  /**
   * Release a transaction
   */
  async releaseTransaction(): Promise<void> {
    await this.db.releaseTransaction();
  }

  /**
   * Query records from a table with type safety
   *
   * @param where The where condition
   * @param fields The fields to select (optional)
   * @param sort The sort conditions (optional)
   * @param page The page number (optional)
   * @param limit The limit (optional)
   */
  async query<T>(
    where: Where,
    fields?: (keyof T)[] | Field<T>[],
    sort?: Sort[],
    page?: number,
    limit?: number
  ): Promise<T[]>;

  /**
   * Query records from multiple tables with type safety (joins)
   *
   * @param where The where condition
   * @param fields The fields to select (optional)
   * @param sort The sort conditions (optional)
   * @param page The page number (optional)
   * @param limit The limit (optional)
   */
  async query<T1, T2>(
    where: Where,
    fields?: TableField<T1>[] | TableField<T2>[],
    sort?: Sort[],
    page?: number,
    limit?: number
  ): Promise<(T1 & T2)[]>;

  /**
   * Query records from multiple tables with type safety (joins)
   *
   * @param where The where condition
   * @param fields The fields to select (optional)
   * @param sort The sort conditions (optional)
   * @param page The page number (optional)
   * @param limit The limit (optional)
   */
  async query<T1, T2, T3>(
    where: Where,
    fields?: TableField<T1>[] | TableField<T2>[] | TableField<T3>[],
    sort?: Sort[],
    page?: number,
    limit?: number
  ): Promise<(T1 & T2 & T3)[]>;

  /**
   * Implementation of the query method
   */
  async query<T1, T2 = never, T3 = never>(
    where: Where,
    fields?:
      | (keyof T1)[]
      | Field<T1>[]
      | TableField<T1>[]
      | TableField<T2>[]
      | TableField<T3>[],
    sort?: Sort[],
    page?: number,
    limit?: number
  ): Promise<T1[] | (T1 & T2)[] | (T1 & T2 & T3)[]> {
    // Get the type name as the table name
    const typeName = this.getTypeName<T1>();
    const tableName = typeName.charAt(0).toLowerCase() + typeName.slice(1);

    // Create the query
    const query: Query = {
      table: [{ table: tableName }],
      query: where,
    };

    // Add fields if provided
    if (fields && fields.length > 0) {
      // Type guard functions
      const isTableField = (field: any): field is TableField<any> =>
        field && typeof field === "object" && "table" in field;

      const isField = (field: any): field is Field<any> =>
        field &&
        typeof field === "object" &&
        "field" in field &&
        !("table" in field);

      // Check the type of the first field
      const firstField = fields[0];

      if (isTableField(firstField)) {
        // Handle TableField[] (multi-table query)
        const tableFields: Record<string, string[]> = {};

        (fields as TableField<any>[]).forEach((field) => {
          if (!tableFields[field.table]) {
            tableFields[field.table] = [];
          }

          if (field.as) {
            tableFields[field.table].push(
              `${String(field.field)} as ${field.as}`
            );
          } else {
            tableFields[field.table].push(String(field.field));
          }
        });

        query.field = tableFields;
      } else if (isField(firstField)) {
        // Handle Field[] (single table with aliases)
        const fieldList = (fields as Field<T1>[]).map((field) =>
          field.as
            ? `${String(field.field)} as ${field.as}`
            : String(field.field)
        );

        query.field = {
          [tableName]: fieldList,
        };
      } else {
        // Handle simple string[] (backward compatibility)
        query.field = {
          [tableName]: (fields as (keyof T1)[]).map((field) => String(field)),
        };
      }
    }

    // Add sort if provided
    if (sort && sort.length > 0) {
      query.sort = sort;
    }

    // Add pagination if provided
    if (page !== undefined) {
      query.page = page;
    }

    if (limit !== undefined) {
      query.limit = limit;
    }

    // Execute the query
    return (await this.db.query(query)) as
      | T1[]
      | (T1 & T2)[]
      | (T1 & T2 & T3)[];
  }
}

/**
 * Type-safe query builder
 */
export class TypeSafeQueryBuilder<T> {
  private db: TypeSafeDB;
  private tableName: string;
  private query: Query;

  constructor(db: TypeSafeDB, tableName: string) {
    this.db = db;
    this.tableName = tableName;
    this.query = {
      table: [{ table: this.tableName }],
    };
  }

  /**
   * Add a where condition to the query
   *
   * @param field The field to filter on
   * @param operator The comparison operator
   * @param value The value to compare against
   */
  where<K extends keyof T>(
    field: K,
    operator: CmpOperator,
    value: any
  ): TypeSafeQueryBuilder<T> {
    const whereCmp: WhereCmp = {
      left: field as string,
      leftType: "Field",
      cmp: operator,
      right: value,
      rightType: "Value",
    };

    if (!this.query.query) {
      this.query.query = whereCmp;
    } else {
      // If there's already a query, wrap it in an AND condition
      const existingQuery = this.query.query;
      this.query.query = {
        And: [existingQuery, whereCmp],
      } as WhereBoolAnd;
    }

    return this;
  }

  /**
   * Add an AND condition to the query
   *
   * @param conditions The conditions to AND together
   */
  and(...conditions: Where[]): TypeSafeQueryBuilder<T> {
    if (conditions.length === 0) {
      return this;
    }

    if (!this.query.query) {
      this.query.query = {
        And: conditions,
      } as WhereBoolAnd;
    } else {
      // If there's already a query, wrap it in an AND condition
      const existingQuery = this.query.query;
      this.query.query = {
        And: [existingQuery, ...conditions],
      } as WhereBoolAnd;
    }

    return this;
  }

  /**
   * Add an OR condition to the query
   *
   * @param conditions The conditions to OR together
   */
  or(...conditions: Where[]): TypeSafeQueryBuilder<T> {
    if (conditions.length === 0) {
      return this;
    }

    if (!this.query.query) {
      this.query.query = {
        Or: conditions,
      } as WhereBoolOr;
    } else {
      // If there's already a query, wrap it in an OR condition
      const existingQuery = this.query.query;
      this.query.query = {
        Or: [existingQuery, ...conditions],
      } as WhereBoolOr;
    }

    return this;
  }

  /**
   * Add a sort to the query
   *
   * @param field The field to sort by
   * @param direction The sort direction
   */
  orderBy<K extends keyof T>(
    field: K,
    direction: "asc" | "desc" = "asc"
  ): TypeSafeQueryBuilder<T> {
    if (!this.query.sort) {
      this.query.sort = [];
    }

    this.query.sort.push({
      fieldId: field as string,
      direction,
    });

    return this;
  }

  /**
   * Set the page number for pagination
   *
   * @param page The page number
   */
  page(page: number): TypeSafeQueryBuilder<T> {
    this.query.page = page;
    return this;
  }

  /**
   * Set the limit for pagination
   *
   * @param limit The limit
   */
  limit(limit: number): TypeSafeQueryBuilder<T> {
    this.query.limit = limit;
    return this;
  }

  /**
   * Execute the query and return the results
   */
  async execute(): Promise<T[]> {
    return (await this.db.getCoreDB().query(this.query)) as T[];
  }

  /**
   * Execute the query and return the first result
   */
  async first(): Promise<T | null> {
    this.query.limit = 1;
    const results = await this.execute();
    return results.length > 0 ? results[0] : null;
  }
}

/**
 * Comparison operator type
 */
export type CmpOperator =
  | "eq"
  | "neq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "nlike"
  | "in"
  | "nin"
  | "not";

/**
 * Where condition type
 */
export type Where = CoreWhere;

/**
 * Create a new TypeSafeDB instance
 *
 * @param connectionString The database connection string
 */
export function createTypeSafeDB(
  connectionString: string | CoreDB
): TypeSafeDB {
  return new TypeSafeDB(connectionString);
}

/**
 * Field accessor function
 *
 * @param fieldName The name of the field
 */
export function Field<T>(fieldName: keyof T): string {
  return fieldName as string;
}

/**
 * Comparison operator constants
 */
export const eq = "eq" as const;
export const neq = "neq" as const;
export const gt = "gt" as const;
export const gte = "gte" as const;
export const lt = "lt" as const;
export const lte = "lte" as const;
export const like = "like" as const;
export const inOp = "in" as const;

/**
 * Where condition builder
 */
export function Where<T>(
  leftField: keyof T,
  operator: CmpOperator,
  rightValue: any
): WhereCmp {
  return {
    left: leftField as string,
    leftType: "Field",
    cmp: operator,
    right: rightValue,
    rightType: "Value",
  };
}

/**
 * Logical operators
 */
export function And(...conditions: Where[]): WhereBoolAnd {
  return { And: conditions };
}

export function Or(...conditions: Where[]): WhereBoolOr {
  return { Or: conditions };
}

/**
 * Sort builder
 */
export function SortBy<T>(
  field: keyof T,
  direction: "asc" | "desc" = "asc"
): Sort {
  return {
    fieldId: field as string,
    direction,
  };
}
