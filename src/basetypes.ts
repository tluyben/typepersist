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

export type FieldDef = {
  name: string;
  type: FieldType;
  minimum?: number;
  maximum?: number;
  indexed?: "Default" | "Unique" | "Foreign";
  precision?: number;
  required?: boolean;
  ordering?: number;
  defaultValue?: string;
  system?: boolean;
  referenceName?: string;
  options?: string[]; // Required for Enum type
  indexName?: string;
  foreignTable?: string; // Required for Reference types
  indexedFields?: string[]; // Required for Reference types
};
