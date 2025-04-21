/**
 * @fileoverview ORM utility types
 *
 * This file contains utility types for defining relationships between database tables.
 */

/**
 * Relation type for defining relationships between tables
 * 
 * @template T - The type of the foreign key
 * @template R - The related entity type
 * @template C - The cardinality of the relationship (1_1, 1_n, n_1, n_n)
 * @template A - The action to take on the related entity (CASCADE, SET_NULL, etc.)
 */
export type Relation<T, R, C, A> = T;

/**
 * Common cardinality types for relationships
 */
export type Cardinality = '1_1' | '1_n' | 'n_1' | 'n_n';

/**
 * Common action types for relationships
 */
export type Action = 'CASCADE' | 'SET_NULL' | 'RESTRICT' | 'NO_ACTION';

/**
 * Helper type for one-to-one relationships
 */
export type OneToOne<T, R> = Relation<T, R, '1_1', 'CASCADE'>;

/**
 * Helper type for one-to-many relationships
 */
export type OneToMany<T, R> = Relation<T, R, '1_n', 'CASCADE'>;

/**
 * Helper type for many-to-one relationships
 */
export type ManyToOne<T, R> = Relation<T, R, 'n_1', 'CASCADE'>;

/**
 * Helper type for many-to-many relationships
 */
export type ManyToMany<T, R> = Relation<T, R, 'n_n', 'CASCADE'>; 

export type PrimaryKey<T> = T; 
export type Unique<T> = T; 
export type Indexed<T> = T; 