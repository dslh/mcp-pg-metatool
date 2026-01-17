import { withErrorHandling, type Logger } from '../responses.js';
import { listSchemas } from '../schemaService.js';

export const name = 'list_schemas';

export const config = {
  title: 'List Schemas',
  description: 'List all schemas in the database (excluding system schemas)',
  inputSchema: {},
};

export function handler(): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  return withErrorHandling('listing schemas', async (log: Logger) => {
    log('querying schemas');
    const schemas = await listSchemas();

    if (schemas.length === 0) {
      return 'No user schemas found.';
    }

    const schemaList = schemas.map(s => `- ${s.schema_name}`).join('\n');
    return `Found ${String(schemas.length)} schema${schemas.length === 1 ? '' : 's'}:\n\n${schemaList}`;
  });
}
