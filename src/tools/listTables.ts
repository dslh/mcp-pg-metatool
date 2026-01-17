import { z } from 'zod';

import { withErrorHandling, type Logger } from '../responses.js';
import { listTables } from '../schemaService.js';

export const name = 'list_tables';

export const config = {
  title: 'List Tables',
  description: 'List all tables in a schema',
  inputSchema: {
    schema_name: z
      .string()
      .default('public')
      .describe('The schema name to list tables from (default: public)'),
  },
};

export function handler({
  schema_name,
}: {
  schema_name?: string | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const schemaToQuery = schema_name ?? 'public';
  return withErrorHandling(`listing tables in schema '${schemaToQuery}'`, async (log: Logger) => {
    log('querying tables');
    const tables = await listTables(schemaToQuery);

    if (tables.length === 0) {
      return `No tables found in schema '${schemaToQuery}'.`;
    }

    const tableList = tables.map(t => `- ${t.table_name}`).join('\n');
    return `Found ${String(tables.length)} table${tables.length === 1 ? '' : 's'} in schema '${schemaToQuery}':\n\n${tableList}`;
  });
}
