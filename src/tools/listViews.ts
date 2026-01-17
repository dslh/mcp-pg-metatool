import { z } from 'zod';

import { withErrorHandling, type Logger } from '../responses.js';
import { listViews } from '../schemaService.js';

export const name = 'list_views';

export const config = {
  title: 'List Views',
  description: 'List all views in a schema',
  inputSchema: {
    schema_name: z
      .string()
      .default('public')
      .describe('The schema name to list views from (default: public)'),
  },
};

export function handler({
  schema_name,
}: {
  schema_name?: string | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const schemaToQuery = schema_name ?? 'public';
  return withErrorHandling(`listing views in schema '${schemaToQuery}'`, async (log: Logger) => {
    log('querying views');
    const views = await listViews(schemaToQuery);

    if (views.length === 0) {
      return `No views found in schema '${schemaToQuery}'.`;
    }

    const viewList = views.map(v => `- ${v.table_name}`).join('\n');
    return `Found ${String(views.length)} view${views.length === 1 ? '' : 's'} in schema '${schemaToQuery}':\n\n${viewList}`;
  });
}
