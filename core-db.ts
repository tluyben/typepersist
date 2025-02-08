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

export type TableQuery = {
  table: string;
  query?: Where;
};

export type Query = {
  table: TableQuery[]; // At least one table is required
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
      throw new Error("Connection string cannot be empty");
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

  async schemaConnect(parentName: string, childName: string): Promise<void> {
    const foreignKeyField = `${parentName}Id`;
    
    // Check if tables exist
    const parentExists = await this.knexInstance.schema.hasTable(parentName);
    const childExists = await this.knexInstance.schema.hasTable(childName);
    
    if (!parentExists) {
      throw new Error(`Parent table '${parentName}' does not exist`);
    }
    if (!childExists) {
      throw new Error(`Child table '${childName}' does not exist`);
    }

    // Check if foreign key column already exists
    const childColumns = await this.knexInstance(childName).columnInfo();
    
    // Add foreign key column and constraint if it doesn't exist
    if (!childColumns[foreignKeyField]) {
      await this.knexInstance.schema.alterTable(childName, (table) => {
        table.integer(foreignKeyField)
          .unsigned()
          .references('id')
          .inTable(parentName)
          .onDelete('CASCADE')
          .index(`idx_${childName}_${foreignKeyField}`);
      });
    }
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
          case "integer":
            if (!Number.isInteger(Number(value))) {
              throw new Error(`Field '${field}' must be an integer`);
            }
            break;
          case "float":
          case "double":
            if (isNaN(Number(value))) {
              throw new Error(`Field '${field}' must be a number`);
            }
            break;
          case "boolean":
            if (typeof value !== "boolean" && value !== 0 && value !== 1) {
              throw new Error(`Field '${field}' must be a boolean`);
            }
            break;
          case "datetime":
          case "date":
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
  private async validateForeignKeyConnection(tables: TableQuery[]): Promise<void> {
    if (tables.length <= 1) return;

    for (let i = 1; i < tables.length; i++) {
      const parentTable = tables[i - 1].table;
      const childTable = tables[i].table;
      
      // Check if foreign key exists
      const childColumns = await this.knexInstance(childTable).columnInfo();
      const expectedForeignKey = `${parentTable}Id`;
      
      if (!childColumns[expectedForeignKey]) {
        throw new Error(
          `No foreign key connection found: Table '${childTable}' must have a foreign key '${expectedForeignKey}' referencing '${parentTable}'`
        );
      }
    }
  }

  async query(query: Query): Promise<any[]> {
    if (!query.table || query.table.length === 0) {
      throw new Error("At least one table must be specified in the query");
    }

    // Validate foreign key connections
    await this.validateForeignKeyConnection(query.table);

    // Start with parent table query
    const parentTable = query.table[0].table;
    let parentQuery = this.knexInstance(parentTable).select('*');

    // Apply parent table filters
    if (query.table[0].query) {
      const prefixedQuery = this.addTablePrefixToWhere(query.table[0].query!, parentTable);
      parentQuery = this.buildWhereClause(parentQuery, prefixedQuery);
    }

    // Apply main query if it exists
    if (query.query) {
      const prefixedQuery = this.addTablePrefixToWhere(query.query!, parentTable);
      parentQuery = this.buildWhereClause(parentQuery, prefixedQuery);
    }

    // Apply sorting and pagination
    if (query.sort) {
      for (const sort of query.sort) {
        parentQuery = parentQuery.orderBy(sort.fieldId, sort.direction);
      }
    }

    if (query.limit) {
      parentQuery = parentQuery.limit(query.limit);
      if (query.page) {
        parentQuery = parentQuery.offset((query.page - 1) * query.limit);
      }
    }

    // Execute parent query
    const parentResults = await parentQuery;

    // For each parent record, fetch its children
    const results = await Promise.all(
      parentResults.map(parent => this.fetchChildren(parent, query.table, 1))
    );

    return results;
  }

  private async fetchChildren(parent: any, tables: TableQuery[], depth: number): Promise<any> {
    if (depth >= tables.length) {
      return parent;
    }

    const result = { ...parent };
    const childTable = tables[depth].table;
    const foreignKey = `${tables[depth-1].table}Id`;
    
    let childQuery = this.knexInstance(childTable)
      .where(foreignKey, parent.id);

    // Apply child table filters
    if (tables[depth].query) {
      const prefixedQuery = this.addTablePrefixToWhere(tables[depth].query!, childTable);
      childQuery = this.buildWhereClause(childQuery, prefixedQuery);
    }

    const children = await childQuery;
    
    // Recursively fetch children for each child
    const nestedChildren = await Promise.all(
      children.map(child => this.fetchChildren(child, tables, depth + 1))
    );

    result[childTable] = nestedChildren;
    return result;
  }

  private addTablePrefixToWhere(where: Where, tableName: string): Where {
    if ('Or' in where) {
      return {
        Or: where.Or.map(w => this.addTablePrefixToWhere(w, tableName))
      };
    } else if ('And' in where) {
      return {
        And: where.And.map(w => this.addTablePrefixToWhere(w, tableName))
      };
    } else {
      return {
        ...where,
        left: `${tableName}.${where.left}`
      };
    }
  }

  private buildWhereClause(builder: Knex.QueryBuilder, where: Where): Knex.QueryBuilder {
    if ("Or" in where) {
      return builder.where((qb) => {
        where.Or.forEach((condition, idx) => {
          const method = idx === 0 ? 'where' : 'orWhere';
          qb[method]((subQb) => this.buildWhereClause(subQb, condition));
        });
      });
    } else if ("And" in where) {
      return builder.where((qb) => {
        where.And.forEach((condition) => {
          qb.where((subQb) => this.buildWhereClause(subQb, condition));
        });
      });
    } else {
      const { left, right, cmp } = where;
      switch (cmp) {
        case "eq":
          return builder.where(left as string, '=', right);
        case "neq":
        case "ne":
          return builder.where(left as string, '!=', right);
        case "gt":
          return builder.where(left as string, '>', right);
        case "gte":
          return builder.where(left as string, '>=', right);
        case "lt":
          return builder.where(left as string, '<', right);
        case "lte":
          return builder.where(left as string, '<=', right);
        case "like":
          return builder.where(left as string, 'LIKE', `%${right}%`);
        case "nlike":
          return builder.where(left as string, 'NOT LIKE', `%${right}%`);
        case "in":
          return builder.whereIn(left as string, right as any[]);
        case "nin":
          return builder.whereNotIn(left as string, right as any[]);
        case "not":
          return builder.where(left as string, '!=', right);
        default:
          throw new Error(`Unsupported operator: ${cmp}`);
      }
    }
  }

  async close(): Promise<void> {
    await this.knexInstance.destroy();
  }
}
