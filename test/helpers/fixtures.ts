/**
 * Test data builders and fixtures
 */

import type { SavedToolConfig } from '../../src/types.js';

/**
 * Creates a valid SavedToolConfig for testing
 */
export function createSavedToolConfig(overrides: Partial<SavedToolConfig> = {}): SavedToolConfig {
  return {
    name: 'test_tool',
    description: 'A test tool for testing',
    sql_query: 'SELECT * FROM users WHERE id = :user_id',
    sql_prepared: 'SELECT * FROM users WHERE id = $1',
    parameter_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'integer' },
      },
      required: ['user_id'],
    },
    parameter_order: ['user_id'],
    ...overrides,
  };
}

/**
 * Creates a JSON Schema for testing
 */
export function createJsonSchema(
  properties: Record<string, { type: string; description?: string; default?: unknown }> = {},
  required: string[] = []
): Record<string, unknown> {
  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Common JSON Schemas for testing
 */
export const schemas = {
  empty: { type: 'object', properties: {} },

  singleString: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
  },

  singleInteger: {
    type: 'object',
    properties: { id: { type: 'integer' } },
    required: ['id'],
  },

  multipleParams: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      active: { type: 'boolean' },
    },
    required: ['id', 'name'],
  },

  withDefaults: {
    type: 'object',
    properties: {
      limit: { type: 'integer', default: 10 },
      offset: { type: 'integer', default: 0 },
    },
  },

  nestedObject: {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      },
    },
  },

  withArray: {
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'integer' },
      },
    },
  },
};

/**
 * SQL patterns for testing parameter conversion
 */
export const sqlPatterns = {
  noParams: 'SELECT * FROM users',
  singleParam: 'SELECT * FROM users WHERE id = :user_id',
  multipleParams: 'SELECT * FROM users WHERE id = :user_id AND status = :status',
  duplicateParam: 'SELECT * FROM users WHERE id = :id OR other_id = :id',
  typeCast: 'SELECT created_at::date FROM users WHERE id = :user_id',
  multipleTypeCasts: 'SELECT created_at::date, updated_at::timestamp FROM users WHERE id = :id::int',
  underscorePrefix: 'SELECT * FROM users WHERE id = :_private_id',
  numbersInName: 'SELECT * FROM users WHERE type = :type1 AND subtype = :type2',
  complexQuery: `
    SELECT u.id, u.name, o.order_id
    FROM users u
    JOIN orders o ON u.id = o.user_id
    WHERE u.status = :status
      AND o.created_at >= :start_date::date
      AND o.total > :min_total
    ORDER BY o.created_at DESC
    LIMIT :limit
  `,
};

/**
 * Database result fixtures for schema introspection
 */
export const dbResults = {
  schemas: [
    { schema_name: 'public' },
    { schema_name: 'auth' },
    { schema_name: 'analytics' },
  ],

  tables: [
    { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE' },
    { table_schema: 'public', table_name: 'orders', table_type: 'BASE TABLE' },
    { table_schema: 'public', table_name: 'products', table_type: 'BASE TABLE' },
  ],

  columns: [
    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: "nextval('users_id_seq'::regclass)", character_maximum_length: null },
    { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null, character_maximum_length: 255 },
    { column_name: 'email', data_type: 'character varying', is_nullable: 'NO', column_default: null, character_maximum_length: 255 },
    { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', character_maximum_length: null },
  ],

  constraints: [
    { constraint_name: 'users_pkey', constraint_type: 'PRIMARY KEY', column_name: 'id' },
    { constraint_name: 'users_email_key', constraint_type: 'UNIQUE', column_name: 'email' },
  ],

  views: [
    { table_schema: 'public', table_name: 'active_users' },
    { table_schema: 'public', table_name: 'user_stats' },
  ],

  viewDefinition: {
    table_schema: 'public',
    table_name: 'active_users',
    view_definition: 'SELECT id, name, email FROM users WHERE active = true;',
  },

  typeNames: [
    { oid: 23, typname: 'int4' },
    { oid: 25, typname: 'text' },
    { oid: 1043, typname: 'varchar' },
    { oid: 1184, typname: 'timestamptz' },
    { oid: 16, typname: 'bool' },
  ],
};

/**
 * Query result with fields for testing execute_sql_query
 */
export function createQueryResult(
  rows: Record<string, unknown>[] = [],
  fieldDefinitions: Array<{ name: string; dataTypeID: number }> = []
): { rows: Record<string, unknown>[]; rowCount: number; fields: Array<{ name: string; dataTypeID: number }> } {
  return {
    rows,
    rowCount: rows.length,
    fields: fieldDefinitions,
  };
}
