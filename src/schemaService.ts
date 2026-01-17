/**
 * PostgreSQL schema introspection service
 * Provides utilities for querying database structure
 */

import { pool } from './client.js';

export interface SchemaInfo {
  schema_name: string;
}

export interface TableInfo {
  table_schema: string;
  table_name: string;
  table_type: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

export interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  column_name: string;
}

export interface ViewInfo {
  table_schema: string;
  table_name: string;
}

export interface ViewDefinition {
  table_schema: string;
  table_name: string;
  view_definition: string;
  columns: ColumnInfo[];
}

/**
 * List all schemas in the database
 */
export async function listSchemas(): Promise<SchemaInfo[]> {
  const query = `
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `;

  const result = await pool.query<SchemaInfo>(query);
  return result.rows;
}

/**
 * List all tables in a schema
 */
export async function listTables(schemaName: string = 'public'): Promise<TableInfo[]> {
  const query = `
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const result = await pool.query<TableInfo>(query, [schemaName]);
  return result.rows;
}

/**
 * Get column information for a table
 */
export async function getTableColumns(
  tableName: string,
  schemaName: string = 'public'
): Promise<ColumnInfo[]> {
  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
  `;

  const result = await pool.query<ColumnInfo>(query, [schemaName, tableName]);
  return result.rows;
}

/**
 * Get constraint information for a table
 */
export async function getTableConstraints(
  tableName: string,
  schemaName: string = 'public'
): Promise<ConstraintInfo[]> {
  const query = `
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY tc.constraint_type, tc.constraint_name
  `;

  const result = await pool.query<ConstraintInfo>(query, [schemaName, tableName]);
  return result.rows;
}

/**
 * List all views in a schema
 */
export async function listViews(schemaName: string = 'public'): Promise<ViewInfo[]> {
  const query = `
    SELECT table_schema, table_name
    FROM information_schema.views
    WHERE table_schema = $1
    ORDER BY table_name
  `;

  const result = await pool.query<ViewInfo>(query, [schemaName]);
  return result.rows;
}

/**
 * Look up human-readable type names for PostgreSQL OIDs
 */
export async function getTypeNames(oids: number[]): Promise<Map<number, string>> {
  if (oids.length === 0) {
    return new Map();
  }

  const query = `
    SELECT oid, typname
    FROM pg_type
    WHERE oid = ANY($1::oid[])
  `;

  const result = await pool.query<{ oid: number; typname: string }>(query, [oids]);

  const typeMap = new Map<number, string>();
  for (const row of result.rows) {
    typeMap.set(row.oid, row.typname);
  }

  return typeMap;
}

/**
 * Get view definition and columns
 */
export async function getViewDefinition(
  viewName: string,
  schemaName: string = 'public'
): Promise<ViewDefinition | null> {
  // Get the view definition from pg_views
  const defQuery = `
    SELECT schemaname as table_schema, viewname as table_name, definition as view_definition
    FROM pg_views
    WHERE schemaname = $1
      AND viewname = $2
  `;

  const defResult = await pool.query<{ table_schema: string; table_name: string; view_definition: string }>(
    defQuery,
    [schemaName, viewName]
  );

  if (defResult.rows.length === 0) {
    return null;
  }

  const row = defResult.rows[0];
  if (row === undefined) {
    return null;
  }

  // Get the columns
  const columns = await getTableColumns(viewName, schemaName);

  return {
    table_schema: row.table_schema,
    table_name: row.table_name,
    view_definition: row.view_definition,
    columns,
  };
}
