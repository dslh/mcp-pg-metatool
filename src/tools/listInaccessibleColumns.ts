import { z } from 'zod';

import { withErrorHandling, type Logger } from '../responses.js';
import { getInaccessibleColumns } from '../schemaService.js';

export const name = 'list_inaccessible_columns';

export const config = {
  title: 'List Inaccessible Columns',
  description:
    'List columns that the current database user lacks SELECT privilege on. ' +
    'Useful for avoiding `SELECT *` queries that PostgreSQL would reject at column level.',
  inputSchema: {
    schema_name: z
      .string()
      .optional()
      .describe('Optional schema name to filter by; omit to scan all user schemas'),
  },
};

export function handler({
  schema_name,
}: {
  schema_name?: string | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const scope = schema_name === undefined ? 'all user schemas' : `schema '${schema_name}'`;
  return withErrorHandling(`listing inaccessible columns in ${scope}`, async (log: Logger) => {
    log('querying column privileges');
    const rows = await getInaccessibleColumns(schema_name);

    if (rows.length === 0) {
      return `The current database user has SELECT on every column in ${scope}.`;
    }

    const lines = rows.map(
      r => `- ${r.table_schema}.${r.table_name}.${r.column_name}`
    );
    return `Found ${String(rows.length)} inaccessible column${rows.length === 1 ? '' : 's'} in ${scope}:\n\n${lines.join('\n')}`;
  });
}
