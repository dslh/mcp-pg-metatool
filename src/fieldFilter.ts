/**
 * GDPR/PII field blacklist filtering.
 *
 * Works on PostgreSQL result metadata: each field carries `tableID` (pg_class OID)
 * and `columnID` (attnum) for real columns, or both 0 for computed/aliased outputs.
 * Resolved columns match exactly against the `schema.table.column` blacklist;
 * computed outputs fall back to bare column-name matching and are surfaced as
 * `unresolvedRedactions` so the caller knows the filter was best-effort.
 */

import { pool } from './client.js';
import { safetyConfig } from './safetyConfig.js';

export interface QueryField {
  name: string;
  tableID?: number;
  columnID?: number;
  dataTypeID: number;
}

export interface FilteredResult<Row extends Record<string, unknown>> {
  rows: Row[];
  fields: QueryField[];
  redactedColumns: string[];
  unresolvedRedactions: string[];
}

const resolvedCache = new Map<string, string>();

function cacheKey(tableID: number, columnID: number): string {
  return `${String(tableID)}:${String(columnID)}`;
}

async function resolveFieldPairs(
  pairs: Array<{ tableID: number; columnID: number }>
): Promise<void> {
  const unresolved = pairs.filter(
    (p) => !resolvedCache.has(cacheKey(p.tableID, p.columnID))
  );
  if (unresolved.length === 0) return;

  const tableIDs = unresolved.map((p) => p.tableID);
  const columnIDs = unresolved.map((p) => p.columnID);

  const res = await pool.query<{
    table_id: number;
    column_id: number;
    schema_name: string;
    table_name: string;
    column_name: string;
  }>(
    `WITH inputs AS (
       SELECT * FROM unnest($1::oid[], $2::int[]) AS t(table_id, column_id)
     )
     SELECT
       c.oid::int AS table_id,
       a.attnum::int AS column_id,
       n.nspname AS schema_name,
       c.relname AS table_name,
       a.attname AS column_name
     FROM inputs i
     JOIN pg_class c ON c.oid = i.table_id
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.column_id`,
    [tableIDs, columnIDs]
  );

  for (const row of res.rows) {
    resolvedCache.set(
      cacheKey(row.table_id, row.column_id),
      `${row.schema_name}.${row.table_name}.${row.column_name}`
    );
  }
}

function isBlacklistActive(): boolean {
  return safetyConfig.blacklistFull.size > 0;
}

export async function filterResult<Row extends Record<string, unknown>>(
  result: { rows: Row[]; fields: QueryField[] }
): Promise<FilteredResult<Row>> {
  if (!isBlacklistActive()) {
    return {
      rows: result.rows,
      fields: result.fields,
      redactedColumns: [],
      unresolvedRedactions: [],
    };
  }

  const realPairs = result.fields
    .filter((f) => (f.tableID ?? 0) !== 0 && (f.columnID ?? 0) !== 0)
    .map((f) => ({ tableID: f.tableID as number, columnID: f.columnID as number }));

  if (realPairs.length > 0) {
    await resolveFieldPairs(realPairs);
  }

  const redactedColumns: string[] = [];
  const unresolvedRedactions: string[] = [];
  const droppedFieldNames = new Set<string>();
  const keptFields: QueryField[] = [];

  for (const field of result.fields) {
    const tableID = field.tableID ?? 0;
    const columnID = field.columnID ?? 0;
    let drop = false;

    if (tableID !== 0 && columnID !== 0) {
      const fqn = resolvedCache.get(cacheKey(tableID, columnID));
      if (fqn !== undefined && safetyConfig.blacklistFull.has(fqn)) {
        redactedColumns.push(fqn);
        drop = true;
      }
    } else if (safetyConfig.blacklistedColumnNames.has(field.name)) {
      unresolvedRedactions.push(field.name);
      drop = true;
    }

    if (drop) {
      droppedFieldNames.add(field.name);
    } else {
      keptFields.push(field);
    }
  }

  const filteredRows: Row[] =
    droppedFieldNames.size === 0
      ? result.rows
      : result.rows.map((row) => {
          const clean: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (!droppedFieldNames.has(k)) clean[k] = v;
          }
          return clean as Row;
        });

  return {
    rows: filteredRows,
    fields: keptFields,
    redactedColumns,
    unresolvedRedactions,
  };
}

export function filterColumnList<T extends { column_name: string }>(
  columns: T[],
  schema: string,
  table: string
): T[] {
  if (!isBlacklistActive()) return columns;
  return columns.filter(
    (c) => !safetyConfig.blacklistFull.has(`${schema}.${table}.${c.column_name}`)
  );
}

export function __clearResolvedCacheForTests(): void {
  resolvedCache.clear();
}
