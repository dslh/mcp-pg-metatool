import { z } from 'zod';

import { withErrorHandling, type Logger } from '../responses.js';
import { getViewDefinition } from '../schemaService.js';

export const name = 'describe_view';

export const config = {
  title: 'Describe View',
  description: 'Get detailed information for a view including columns and definition',
  inputSchema: {
    view_name: z
      .string()
      .describe('The name of the view to describe'),
    schema_name: z
      .string()
      .default('public')
      .describe('The schema name (default: public)'),
  },
};

export function handler({
  view_name,
  schema_name,
}: {
  view_name: string;
  schema_name?: string | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const schemaToQuery = schema_name ?? 'public';
  return withErrorHandling(`describing view '${schemaToQuery}.${view_name}'`, async (log: Logger) => {
    log('querying view definition');
    const viewDef = await getViewDefinition(view_name, schemaToQuery);

    if (!viewDef) {
      throw new Error(`View '${schemaToQuery}.${view_name}' not found`);
    }

    // Format columns
    const columnLines = viewDef.columns.map(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const maxLen = col.character_maximum_length !== null ? `(${String(col.character_maximum_length)})` : '';
      return `  ${col.column_name}: ${col.data_type}${maxLen} ${nullable}`;
    });

    let result = `View: ${schemaToQuery}.${view_name}\n\nColumns:\n${columnLines.join('\n')}`;
    result += `\n\nDefinition:\n\`\`\`sql\n${viewDef.view_definition}\`\`\``;

    return result;
  });
}
