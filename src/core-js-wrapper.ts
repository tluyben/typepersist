import { CoreDB, FieldDef, FieldType, Query, Sort, TableDefinition, Where, WhereCmp } from './core-db';

export enum Cmp {
  Eq = 'eq',
  Neq = 'neq',
  Ne = 'ne',
  Gt = 'gt',
  Gte = 'gte',
  Lt = 'lt',
  Lte = 'lte',
  Like = 'like',
  NotLike = 'nlike',
  In = 'in',
  NotIn = 'nin',
  Not = 'not'
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
      implementation: 'Static',
      fields: this.fields
    };
  }
}

class SchemaFieldBuilder {
  private field: FieldDef;
  private schema: SchemaWrapper;

  constructor(schema: SchemaWrapper, name: string) {
    this.schema = schema;
    this.field = { name, type: 'Text' };
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

  index(type: 'Default' | 'Unique' | 'Foreign' = 'Default') {
    this.field.indexed = type;
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
      table: [{ table: tableName }]
    };
  }

  where(field: string, cmp: Cmp, value: any): QueryWrapper {
    const whereCmp: WhereCmp = {
      left: field,
      leftType: 'Field',
      cmp,
      right: value,
      rightType: 'Value'
    };

    if (!this.query.query) {
      this.query.query = whereCmp;
    } else {
      this.query.query = {
        And: [this.query.query, whereCmp]
      };
    }

    return this;
  }

  and(field: string, cmp: Cmp, value: any): QueryWrapper {
    return this.where(field, cmp, value);
  }

  or(field: string, cmp: Cmp, value: any): QueryWrapper {
    const whereCmp: WhereCmp = {
      left: field,
      leftType: 'Field',
      cmp,
      right: value,
      rightType: 'Value'
    };

    if (!this.query.query) {
      this.query.query = whereCmp;
    } else {
      this.query.query = {
        Or: [this.query.query, whereCmp]
      };
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

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryWrapper {
    const sort: Sort = {
      fieldId: field,
      direction
    };

    if (!this.query.sort) {
      this.query.sort = [sort];
    } else {
      this.query.sort.push(sort);
    }

    return this;
  }

  join(tableName: string): QueryWrapper {
    this.query.table.push({ table: tableName });
    return this;
  }

  async execute(): Promise<any[]> {
    return await this.db.query(this.query);
  }
}

export class Wrapper {
  private db: CoreDB;

  constructor(connectionString: string) {
    this.db = new CoreDB(connectionString);
  }

  schema(tableName: string): SchemaWrapper {
    return new SchemaWrapper(tableName);
  }

  query(tableName: string): QueryWrapper {
    return new QueryWrapper(this.db, tableName);
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

  async update(tableName: string, id: number, data: Record<string, any>): Promise<void> {
    await this.db.update(tableName, id, data);
  }

  async delete(tableName: string, ids: number | number[]): Promise<void> {
    const idArray = Array.isArray(ids) ? ids : [ids];
    await this.db.delete(tableName, idArray);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
