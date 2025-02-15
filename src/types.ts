import { z } from 'zod';

// Base type for database tables
export type DB<T extends Record<string, any>> = {
  insert(data: Omit<T, 'id'>): Promise<number>;
  update(id: number, data: Partial<Omit<T, 'id'>>): Promise<void>;
  delete(id: number): Promise<void>;
  query(): QueryBuilder<T>;
};

// Query builder interface
export interface QueryBuilder<T> {
  where(field: keyof T, operator: string, value: any): QueryBuilder<T>;
  orderBy(field: keyof T, direction?: 'asc' | 'desc'): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  get(): Promise<T[]>;
  first(): Promise<T | null>;
}

// Schema field types
export type FieldType = 
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: Date }
  | { type: 'enum'; values: string[]; value: string };

// Field constraints
export interface FieldConstraints {
  isUnique?: boolean;
  isRequired?: boolean;
  defaultValue?: any;
  foreignKey?: {
    table: string;
    field: string;
  };
}

// Schema field with metadata
export type SchemaField<T> = {
  __type: T;
  __meta: FieldType & FieldConstraints;
};

// Type constraints
export type DBUnique<T> = T;
export type DBRequired<T> = T;
export type DBDefault<T, D extends T> = T;
export type DBForeignKey<T extends number, TableName extends string> = T;

// Field constructors
export const string = (): SchemaField<string> => ({
  __type: '' as string,
  __meta: { type: 'string', value: '' }
});

export const number = (): SchemaField<number> => ({
  __type: 0 as number,
  __meta: { type: 'number', value: 0 }
});

export const boolean = (): SchemaField<boolean> => ({
  __type: false as boolean,
  __meta: { type: 'boolean', value: false }
});

export const date = (): SchemaField<Date> => ({
  __type: new Date() as Date,
  __meta: { type: 'date', value: new Date() }
});

// Enum constructor
export function enum_<T extends string>(...values: T[]): SchemaField<T> {
  return {
    __type: values[0] as T,
    __meta: { type: 'enum', values, value: values[0] }
  };
}

// Constraint decorators
export function unique<T>(field: SchemaField<T>): SchemaField<DBUnique<T>> {
  return {
    ...field,
    __meta: { ...field.__meta, isUnique: true }
  };
}

export function required<T>(field: SchemaField<T>): SchemaField<DBRequired<T>> {
  return {
    ...field,
    __meta: { ...field.__meta, isRequired: true }
  };
}

export function defaultValue<T>(field: SchemaField<T>, value: T): SchemaField<DBDefault<T, T>> {
  return {
    ...field,
    __meta: { ...field.__meta, defaultValue: value }
  };
}

export function foreignKey<T extends number, N extends string>(
  field: SchemaField<T>,
  tableName: N
): SchemaField<DBForeignKey<T, N>> {
  return {
    ...field,
    __meta: {
      ...field.__meta,
      foreignKey: { table: tableName, field: 'id' }
    }
  };
}

// Helper type to extract the schema from a DB type
export type Schema<T> = T extends DB<infer U> ? U : never;

// Helper type to make all properties in a schema optional
export type PartialSchema<T> = {
  [P in keyof T]?: T[P];
};

// Helper type to get the ID type of a table
export type ID<T> = T extends DB<infer U> ? U extends { id: infer I } ? I : number : number;

// Helper type to get the foreign key type for a table
export type ForeignKey<T, N extends string> = DBForeignKey<ID<T>, N>;

// Zod schema types
export type ZodSchema<T> = z.ZodType<T>;
export type ZodSchemaFor<T> = T extends DB<infer U> ? ZodSchema<U> : never;

// Schema definition helper
export function defineSchema<T extends Record<string, SchemaField<any>>>(
  schema: T
): { [K in keyof T]: T[K]['__type'] } {
  // Extract runtime metadata for the transformer
  const metadata = Object.entries(schema).reduce((acc, [key, field]) => {
    acc[key] = field.__meta;
    return acc;
  }, {} as Record<string, FieldType & FieldConstraints>);

  // Store metadata on the schema object
  const result = {} as { [K in keyof T]: T[K]['__type'] };
  Object.defineProperty(result, '__metadata', {
    value: metadata,
    enumerable: false
  });

  return result;
}
