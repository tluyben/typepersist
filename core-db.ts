import { Knex, knex } from "knex-fork";

export type Sort = {
  fieldId: string;
  direction: "asc" | "desc";
};

export type WhereCmp = {
  left: string | number;
  leftType: "Field" | "Array" | "Variable" | "SearchString" | "Value";
  cmp:
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
  right: string | number | Date | number[];
  rightType: "Field" | "Array" | "Variable" | "SearchString" | "Value";
};

export type WhereBoolOr = {
  Or: Where[];
};

export type WhereBoolAnd = {
  And: Where[];
};

export type Where = WhereBoolOr | WhereBoolAnd | WhereCmp;

export type Query = {
  table: string[];  // At least one table is required
  field?: { [table: string]: string[] };
  query?: Where;
  sort?: Sort[];
  page?: number;
  limit?: number;
  groupFields?: string[];
};

export type FieldDef = {
  name: string;
  type: string;
  minimum?: number;
  maximum?: number;
  indexed?: string;
  precision?: number;
  required?: boolean;
  ordering?: number;
  defaultValue?: string;
  system?: boolean;
  referenceName?: string;
  options?: string[];
  indexName?: string;
};

export type TableDefinition = {
  name: string;
  implementation: "Static" | "Dynamic";
  description?: string;
  fields: FieldDef[];
};

export class CoreDB {
  private knexInstance: Knex;
  private currentDB?: string;

  constructor(connectionString: string) {
    if (!connectionString) {
      throw new Error('Connection string cannot be empty');
    }
    this.knexInstance = knex({
      client: "sqlite3",
      connection: {
        filename: connectionString,
      },
      useNullAsDefault: true,
    });
  }

  private getKnexFieldType(fieldDef: FieldDef): string {
    switch (fieldDef.type) {
      case "Text":
      case "Choice":
        return "text";
      case "Integer":
        return "integer";
      case "Float":
        return "float";
      case "Boolean":
        return "boolean";
      case "Date":
      case "DateTime":
        return "datetime";
      case "Time":
        return "time";
      default:
        throw new Error(`Unsupported field type: ${fieldDef.type}`);
    }
  }

  async useDB(name: string): Promise<void> {
    // For SQLite, we don't actually need to create/switch databases
    // as each database is a separate file
    this.currentDB = name;
  }

  async schemaCreateOrUpdate(tableDefinition: TableDefinition): Promise<void> {
    const exists = await this.knexInstance.schema.hasTable(
      tableDefinition.name
    );

    if (!exists) {
      await this.knexInstance.schema.createTable(
        tableDefinition.name,
        (table) => {
          // Always create id as primary key
          table.increments("id").primary();

          for (const field of tableDefinition.fields) {
            const knexType = this.getKnexFieldType(field);
            let column;
            switch (knexType) {
              case "text":
                column = table.text(field.name);
                break;
              case "integer":
                column = table.integer(field.name);
                break;
              case "float":
                column = table.float(field.name);
                break;
              case "boolean":
                column = table.boolean(field.name);
                break;
              case "datetime":
                column = table.datetime(field.name);
                break;
              case "time":
                column = table.time(field.name);
                break;
              default:
                throw new Error(`Invalid column type: ${knexType}`);
            }

            if (field.required) {
              column.notNullable();
            } else {
              column.nullable();
            }

            if (field.defaultValue !== undefined) {
              column.defaultTo(field.defaultValue);
            }

            if (field.indexed) {
              column.index(
                field.indexName || `idx_${tableDefinition.name}_${field.name}`
              );
            }
          }
        }
      );
    } else {
      // Get existing columns
      const existingColumns = await this.knexInstance(
        tableDefinition.name
      ).columnInfo();

      // Add new columns
      await this.knexInstance.schema.alterTable(
        tableDefinition.name,
        (table) => {
          for (const field of tableDefinition.fields) {
            if (!existingColumns[field.name]) {
              const knexType = this.getKnexFieldType(field);
              let column;
              switch (knexType) {
                case "text":
                  column = table.text(field.name);
                  break;
                case "integer":
                  column = table.integer(field.name);
                  break;
                case "float":
                  column = table.float(field.name);
                  break;
                case "boolean":
                  column = table.boolean(field.name);
                  break;
                case "datetime":
                  column = table.datetime(field.name);
                  break;
                case "time":
                  column = table.time(field.name);
                  break;
                default:
                  throw new Error(`Invalid column type: ${knexType}`);
              }

              if (field.required) {
                column.notNullable();
              } else {
                column.nullable();
              }

              if (field.defaultValue !== undefined) {
                column.defaultTo(field.defaultValue);
              }

              if (field.indexed) {
                column.index(
                  field.indexName || `idx_${tableDefinition.name}_${field.name}`
                );
              }
            }
          }
        }
      );
    }
  }

  async schemaDrop(name: string): Promise<void> {
    await this.knexInstance.schema.dropTableIfExists(name);
  }

  async schemaDropField(tableName: string, fieldName: string): Promise<void> {
    await this.knexInstance.schema.alterTable(tableName, (table) => {
      table.dropColumn(fieldName);
    });
  }

  async schemaRename(oldName: string, newName: string): Promise<void> {
    await this.knexInstance.schema.renameTable(oldName, newName);
  }

  async schemaRenameField(
    schema: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    await this.knexInstance.schema.alterTable(schema, (table) => {
      table.renameColumn(oldName, newName);
    });
  }

  async startTransaction(): Promise<Knex.Transaction> {
    return await this.knexInstance.transaction();
  }

  async insert(
    tableName: string,
    data: Record<string, any>,
    tx?: Knex.Transaction
  ): Promise<number> {
    const queryBuilder = tx || this.knexInstance;
    
    // Get column info for type validation
    const columns = await queryBuilder(tableName).columnInfo();
    
    // Validate data types
    for (const [field, value] of Object.entries(data)) {
      const column = columns[field];
      if (column) {
        if (value === null || value === undefined) {
          if (column.nullable === false) {
            throw new Error(`Field '${field}' cannot be null`);
          }
          continue;
        }

        switch (column.type) {
          case 'integer':
            if (!Number.isInteger(Number(value))) {
              throw new Error(`Field '${field}' must be an integer`);
            }
            break;
          case 'float':
          case 'double':
            if (isNaN(Number(value))) {
              throw new Error(`Field '${field}' must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
              throw new Error(`Field '${field}' must be a boolean`);
            }
            break;
          case 'datetime':
          case 'date':
            if (!(value instanceof Date) && isNaN(Date.parse(value))) {
              throw new Error(`Field '${field}' must be a valid date`);
            }
            break;
        }
      }
    }

    const [id] = await queryBuilder(tableName).insert(data);
    return id;
  }

  async update(
    tableName: string,
    id: number,
    data: Record<string, any>,
    tx?: Knex.Transaction
  ): Promise<void> {
    const queryBuilder = tx || this.knexInstance;
    await queryBuilder(tableName).where("id", id).update(data);
  }

  async upsert(
    tableName: string,
    data: Record<string, any>,
    tx?: Knex.Transaction
  ): Promise<number> {
    const queryBuilder = tx || this.knexInstance;
    if (data.id) {
      await queryBuilder(tableName).where("id", data.id).update(data);
      return data.id;
    } else {
      const [id] = await queryBuilder(tableName).insert(data);
      return id;
    }
  }

  async delete(
    tableName: string,
    ids: number[],
    tx?: Knex.Transaction
  ): Promise<void> {
    const queryBuilder = tx || this.knexInstance;
    await queryBuilder(tableName).whereIn("id", ids).delete();
  }

  // Query builder method that accepts Query type
  async query(query: Query): Promise<any[]> {
    if (!query.table || query.table.length === 0) {
      throw new Error('At least one table must be specified in the query');
    }

    let builder = this.knexInstance(query.table[0]); // Start with first table

    if (query.query) {
      builder = builder.where((builder) => {
        this.buildWhereClause(builder, query.query!);
      });
    }

    if (query.sort) {
      for (const sort of query.sort) {
        builder = builder.orderBy(sort.fieldId, sort.direction);
      }
    }

    if (query.limit) {
      builder = builder.limit(query.limit);
      if (query.page) {
        builder = builder.offset((query.page - 1) * query.limit);
      }
    }

    return builder;
  }

  private buildWhereClause(
    builder: Knex.QueryBuilder,
    where: Where
  ): Knex.QueryBuilder {
    let result = builder;
    if ("Or" in where) {
      result = builder.where((builder) => {
        for (const condition of where.Or) {
          builder.orWhere((builder) => {
            this.buildWhereClause(builder, condition);
          });
        }
      });
    } else if ("And" in where) {
      result = builder.where((builder) => {
        for (const condition of where.And) {
          builder.where((builder) => {
            this.buildWhereClause(builder, condition);
          });
        }
      });
    } else {
      const { left, right, cmp } = where;
      let operator: string;

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
          builder.whereIn(left as string, right as any[]);
          return builder;
        case "nin":
          builder.whereNotIn(left as string, right as any[]);
          return builder;
        case "not":
          operator = "!=";
          break;
        default:
          throw new Error(`Unsupported operator: ${cmp}`);
      }

      if (cmp === "like" || cmp === "nlike") {
        result = builder.where(left as string, operator, `%${right}%`);
      } else {
        result = builder.where(left as string, operator, right);
      }
    }
    return result;
  }

  async close(): Promise<void> {
    await this.knexInstance.destroy();
  }
}
