import { z } from 'zod';

import { pool } from '../client.js';
import { parseNamedParameters, mapToPositional } from '../parameterMapper.js';
import { withErrorHandling, type Logger } from '../responses.js';
import { getTypeNames } from '../schemaService.js';

export const name = 'execute_sql_query';

export const config = {
  title: 'Execute SQL Query',
  description: 'Execute arbitrary SQL queries against the PostgreSQL database. Use :param_name for parameters.',
  inputSchema: {
    query: z.string().describe('The SQL query to execute (use :param_name for named parameters)'),
    params: z.record(z.unknown()).optional().describe('Named parameters for the query'),
  },
};

export const handler = ({
  query,
  params,
}: {
  query: string;
  params?: Record<string, unknown> | undefined;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
  return withErrorHandling('executing SQL query', async (log: Logger) => {
    log('parsing parameters');
    const { sql, parameterOrder } = parseNamedParameters(query);
    const positionalParams = mapToPositional(params ?? {}, parameterOrder);

    log('executing query');
    const result = await pool.query(sql, positionalParams);

    log('resolving type names');
    const oids = result.fields.map(f => f.dataTypeID);
    const typeNames = await getTypeNames(oids);

    return JSON.stringify({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({
        name: f.name,
        dataType: typeNames.get(f.dataTypeID) ?? 'unknown',
        dataTypeID: f.dataTypeID,
      })),
    }, null, 2);
  });
};
