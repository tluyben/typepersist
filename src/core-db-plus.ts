import { CoreDB, FieldDef, Query, TableDefinition } from "./core-db";

export type Sort = {
  fieldId: string;
  direction: "asc" | "desc";
};

export type WhereCmpPlus = {
  field: string;
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
  value: string | number | Date | number[];
};

export type WhereBoolOr = {
  Or: WherePlus[];
};

export type WhereBoolAnd = {
  And: WherePlus[];
};

export type WherePlus = WhereBoolOr | WhereBoolAnd | WhereCmpPlus;

export type TableQueryPlus = {
  table: string;
  query?: WherePlus;
};

export type QueryPlus = {
  table: TableQueryPlus[]; // At least one table is required
  field?: { [table: string]: string[] };
  sort?: Sort[];
  page?: number;
  limit?: number;
  groupFields?: string[];
};

export type FieldType =
  | "Text"
  | "Password"
  | "UUID"
  | "Integer"
  | "Currency"
  | "Float"
  | "Double"
  | "Decimal"
  | "Datetime"
  | "Time"
  | "Date"
  | "CreatedAt"
  | "UpdatedAt"
  | "Boolean"
  | "Binary"
  | "ID"
  | "Enum"
  | "ReferenceOneToOne"
  | "ReferenceManyToOne"
  | "ReferenceOneToMany"
  | "ReferenceManyToMany";

export type TableDefinitionPlus = {
  name: string;
  description?: string;
  compoundIndexes?: { fields: string[]; type: "Unique" | "Default" }[];
  fields: FieldDef[];
};

export class CoreDBPlus extends CoreDB {
  constructor(connectionString: string) {
    super(connectionString);
  }

  async createTable(tableDefinition: TableDefinitionPlus) {
    const t = tableDefinition as any;
    t.implementation = "Static";
    await super.schemaCreateOrUpdate(t as TableDefinition);
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

  async query(query: QueryPlus | Query) {
    const q = query as any;

    // Transform the query if it's a QueryPlus
    if (q.table && q.table.length > 0) {
      // Transform each table query
      for (const t of q.table) {
        if (t.query) {
          t.query = this.rewriteQuery(t.query, t.table);
        }
      }
    }

    return await super.query(q as Query);
  }
}
