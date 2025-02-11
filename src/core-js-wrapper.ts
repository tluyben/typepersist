import { Knex } from "knex-fork";
import {
  CoreDB,
  FieldDef,
  FieldType,
  Query,
  Sort,
  TableDefinition,
  Where,
  WhereCmp,
} from "./core-db";

export enum Cmp {
  Eq = "eq",
  Neq = "neq",
  Ne = "ne",
  Gt = "gt",
  Gte = "gte",
  Lt = "lt",
  Lte = "lte",
  Like = "like",
  NotLike = "nlike",
  In = "in",
  NotIn = "nin",
  Not = "not",
}

export class SchemaWrapper {
  private fields: FieldDef[] = [];
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  field(name: string): SchemaFieldBuilder {
    return new SchemaFieldBuilder(this, name);
  }

  addField(field: FieldDef) {
    this.fields.push(field);
    return this;
  }

  build(): TableDefinition {
    return {
      name: this.tableName,
      implementation: "Static",
      fields: this.fields,
    };
  }

  dump(): TableDefinition {
    return this.build();
  }
}

class SchemaFieldBuilder {
  private field: FieldDef;
  private schema: SchemaWrapper;

  constructor(schema: SchemaWrapper, name: string) {
    this.schema = schema;
    this.field = { name, type: "Text" };
  }

  type(type: FieldType) {
    this.field.type = type;
    return this;
  }

  required() {
    this.field.required = true;
    return this;
  }

  default(value: string) {
    this.field.defaultValue = value;
    return this;
  }

  index(type: "Default" | "Unique" | "Foreign" = "Default") {
    this.field.indexed = type;
    return this;
  }

  primaryKey() {
    this.field.indexed = "Unique";
    return this;
  }

  precision(value: number) {
    this.field.precision = value;
    return this;
  }

  reference(table: string) {
    this.field.foreignTable = table;
    return this;
  }

  done() {
    this.schema.addField(this.field);
    return this.schema;
  }
}

export class QueryWrapper {
  private query: Query;
  private db: CoreDB;

  constructor(db: CoreDB, tableName: string) {
    this.db = db;
    this.query = {
      table: [{ table: tableName }],
    };
  }

  private lastJoinedTable: string | null = null;

  join(tableName: string): QueryWrapper {
    this.query.table.push({ table: tableName });
    this.lastJoinedTable = tableName;
    return this;
  }

  where(field: string, cmp: Cmp, value: any): QueryWrapper {
    const whereCmp: WhereCmp = {
      left: field,
      leftType: "Field",
      cmp,
      right: value,
      rightType: "Value",
    };

    if (this.lastJoinedTable) {
      // Add query to the last joined table
      const joinedTable = this.query.table.find(
        (t) => t.table === this.lastJoinedTable
      );
      if (joinedTable) {
        joinedTable.query = whereCmp;
      }
      this.lastJoinedTable = null; // Reset after use
    } else {
      // Add to root query
      if (!this.query.query) {
        this.query.query = whereCmp;
      } else {
        this.query.query = {
          And: [this.query.query, whereCmp],
        };
      }
    }

    return this;
  }

  and(field: string, cmp: Cmp, value: any): QueryWrapper {
    return this.where(field, cmp, value);
  }

  or(field: string, cmp: Cmp, value: any): QueryWrapper {
    const whereCmp: WhereCmp = {
      left: field,
      leftType: "Field",
      cmp,
      right: value,
      rightType: "Value",
    };

    if (this.lastJoinedTable) {
      // Add query to the last joined table
      const joinedTable = this.query.table.find(
        (t) => t.table === this.lastJoinedTable
      );
      if (joinedTable) {
        if (!joinedTable.query) {
          joinedTable.query = whereCmp;
        } else {
          joinedTable.query = {
            Or: [joinedTable.query, whereCmp],
          };
        }
      }
      this.lastJoinedTable = null; // Reset after use
    } else {
      // Add to root query
      if (!this.query.query) {
        this.query.query = whereCmp;
      } else {
        this.query.query = {
          Or: [this.query.query, whereCmp],
        };
      }
    }
    return this;
  }

  limit(value: number): QueryWrapper {
    this.query.limit = value;
    return this;
  }

  page(value: number): QueryWrapper {
    this.query.page = value;
    return this;
  }

  orderBy(field: string, direction: "asc" | "desc" = "asc"): QueryWrapper {
    const sort: Sort = {
      fieldId: field,
      direction,
    };

    if (!this.query.sort) {
      this.query.sort = [sort];
    } else {
      this.query.sort.push(sort);
    }

    return this;
  }

  async execute(): Promise<any[]> {
    return await this.db.query(this.query);
  }

  async first(): Promise<any | null> {
    const results = await this.limit(1).execute();
    return results.length > 0 ? results[0] : null;
  }

  async exists(): Promise<boolean> {
    const result = await this.first();
    return result !== null;
  }

  // TODO: Implement this with count(*) instead as this si
  // slow af
  async count(): Promise<number> {
    const results = await this.execute();
    return results.length;
  }

  // TODO: Implement this with sum(x) instead as this si
  // slow af
  async sum(field: string): Promise<number> {
    const results = await this.execute();
    return results.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);
  }

  // TODO: Implement this with avg(x) instead as this si
  // slow af
  async avg(field: string): Promise<number> {
    const results = await this.execute();
    if (results.length === 0) return 0;
    const sum = results.reduce(
      (sum, row) => sum + (parseFloat(row[field]) || 0),
      0
    );
    return sum / results.length;
  }

  async delete(): Promise<any[]> {
    const results = await this.execute();
    const recordsToDelete = [...results]; // Make a copy before deleting

    if (results.length > 0) {
      const ids = results.map((r) => r.id);
      await this.db.delete(this.query.table[0].table, ids);
    }

    // Return the deleted records without their IDs
    return recordsToDelete.map((r) => {
      const record = { ...r };
      delete record.id;
      return record;
    });
  }

  dump(): Query {
    return this.query;
  }
}

export class Wrapper {
  private db: CoreDB;

  constructor(connectionString: string | CoreDB) {
    if (typeof connectionString === "string") {
      this.db = new CoreDB(connectionString);
    } else {
      this.db = connectionString;
    }
  }

  schema(tableName: string): SchemaWrapper {
    return new SchemaWrapper(tableName);
  }

  query(tableName: string): QueryWrapper {
    return new QueryWrapper(this.db, tableName);
  }

  coreDb(): CoreDB {
    return this.db;
  }

  async createTable(schema: SchemaWrapper | TableDefinition) {
    const tableDef = schema instanceof SchemaWrapper ? schema.build() : schema;
    await this.db.schemaCreateOrUpdate(tableDef);
  }

  async dropTable(tableName: string) {
    await this.db.schemaDrop(tableName);
  }

  async dropField(tableName: string, fieldName: string) {
    await this.db.schemaDropField(tableName, fieldName);
  }

  async insert(tableName: string, data: Record<string, any>): Promise<number> {
    return await this.db.insert(tableName, data);
  }

  async update(
    tableName: string,
    id: number,
    data: Record<string, any>
  ): Promise<void> {
    await this.db.update(tableName, id, data);
  }

  async delete(tableName: string, ids: number | number[]): Promise<void> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    await this.db.delete(tableName, idArray);
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  async startTransaction(): Promise<Wrapper> {
    const trx = await this.db.startTransaction();
    return new Wrapper(trx);
  }

  async commitTransaction(): Promise<void> {
    await this.db.commitTransaction();
  }

  async rollbackTransaction(): Promise<void> {
    await this.db.rollbackTransaction();
  }
  async releaseTransaction(): Promise<void> {
    await this.db.releaseTransaction();
  }
}
