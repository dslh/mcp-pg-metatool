import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { pool } from './client.js';
import { convertJsonSchemaToZod, convertJsonSchemaToMcpZod } from './jsonSchemaValidator.js';
import { mapToPositional } from './parameterMapper.js';
import { withErrorHandling, type Logger } from './responses.js';
import { getTypeNames } from './schemaService.js';
import { loadAllTools } from './storage.js';
import type { SavedToolConfig } from './types.js';

export function registerAllTools(server: McpServer): Map<string, RegisteredTool> {
  const savedTools = loadAllTools();
  const registeredTools = new Map<string, RegisteredTool>();

  // Register all loaded saved tools
  for (const [toolName, toolConfig] of savedTools) {
    const dynamicHandler = createDynamicToolHandler(toolConfig);

    const dynamicToolConfig = {
      title: toolConfig.description,
      description: toolConfig.description,
      inputSchema: convertJsonSchemaToMcpZod(toolConfig.parameter_schema),
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const registeredTool = server.registerTool(toolName, dynamicToolConfig as any, dynamicHandler as any);
    registeredTools.set(toolName, registeredTool);
  }

  return registeredTools;
}

export function createDynamicToolHandler(toolConfig: SavedToolConfig): (params: Record<string, unknown>) => Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const paramSchema = convertJsonSchemaToZod(toolConfig.parameter_schema);

  return async (params: Record<string, unknown>): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> => {
    return withErrorHandling(`executing tool '${toolConfig.name}'`, async (log: Logger) => {
      log('validating parameters');
      let validatedParams: Record<string, unknown>;
      try {
        validatedParams = paramSchema.parse(params) as Record<string, unknown>;
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new TypeError(`Parameter validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        throw error;
      }

      log('executing SQL query');
      const positionalParams = mapToPositional(validatedParams, toolConfig.parameter_order);
      const result = await pool.query(toolConfig.sql_prepared, positionalParams);

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
}
