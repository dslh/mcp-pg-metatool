import { z } from 'zod';

import { withErrorHandling, type Logger } from '../responses.js';
import { getTableColumns, getTableConstraints } from '../schemaService.js';

export const name = 'describe_table';

export const config = {
  title: 'Describe Table',
  description: 'Get detailed schema information for a table including columns, types, and constraints',
  inputSchema: {
    table_name: z
      .string()
      .describe('The name of the table to describe'),
    schema_name: z
      .string()
      .default('public')
      .describe('The schema name (default: public)'),
  },
};

export function handler({
  table_name,
  schema_name,
}: {
  table_name: string;
  schema_name?: string | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const schemaToQuery = schema_name ?? 'public';
  return withErrorHandling(`describing table '${schemaToQuery}.${table_name}'`, async (log: Logger) => {
    log('querying columns');
    const columns = await getTableColumns(table_name, schemaToQuery);

    if (columns.length === 0) {
      throw new Error(`Table '${schemaToQuery}.${table_name}' not found`);
    }

    log('querying constraints');
    const constraints = await getTableConstraints(table_name, schemaToQuery);

    // Format columns
    const columnLines = columns.map(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default !== null ? ` DEFAULT ${col.column_default}` : '';
      const maxLen = col.character_maximum_length !== null ? `(${String(col.character_maximum_length)})` : '';
      return `  ${col.column_name}: ${col.data_type}${maxLen} ${nullable}${defaultVal}`;
    });

    // Group constraints by type
    const constraintsByType = new Map<string, string[]>();
    for (const c of constraints) {
      const existing = constraintsByType.get(c.constraint_type) ?? [];
      existing.push(`${c.constraint_name} (${c.column_name})`);
      constraintsByType.set(c.constraint_type, existing);
    }

    let result = `Table: ${schemaToQuery}.${table_name}\n\nColumns:\n${columnLines.join('\n')}`;

    if (constraintsByType.size > 0) {
      result += '\n\nConstraints:';
      for (const [type, names] of constraintsByType) {
        result += `\n  ${type}:`;
        for (const name of names) {
          result += `\n    - ${name}`;
        }
      }
    }

    return result;
  });
}
