import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { createDynamicToolHandler } from '../dynamicToolHandler.js';
import { validateJsonSchema, convertJsonSchemaToMcpZod } from '../jsonSchemaValidator.js';
import { parseNamedParameters, extractNamedParameters } from '../parameterMapper.js';
import { withErrorHandling, type Logger } from '../responses.js';
import { server, registeredTools } from '../server.js';
import { saveToolToFile } from '../storage.js';
import type { SaveQueryToolParams, SavedToolConfig } from '../types.js';

export const name = 'save_query';

export const config = {
  title: 'Save Query Tool',
  description: 'Create or update an MCP tool from a SQL query',
  inputSchema: {
    tool_name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case starting with a letter')
      .describe('The unique name for this tool in snake_case format'),
    description: z
      .string()
      .min(1, 'Description is required')
      .describe('A human-readable description of what this tool does'),
    sql_query: z
      .string()
      .min(1, 'SQL query is required')
      .describe('The SQL query with :named parameters (e.g., SELECT * FROM users WHERE id = :user_id)'),
    parameter_schema: z.record(z.unknown()).describe('JSON Schema defining tool parameters'),
    overwrite: z.boolean().default(false).describe('Whether to overwrite an existing tool with the same name'),
  },
};

function registerToolWithServer(
  toolName: string,
  toolConfig: SavedToolConfig
): RegisteredTool {
  const dynamicHandler = createDynamicToolHandler(toolConfig);

  const dynamicToolConfig = {
    title: toolConfig.description,
    description: toolConfig.description,
    inputSchema: convertJsonSchemaToMcpZod(toolConfig.parameter_schema),
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  const registeredTool = server.registerTool(toolName, dynamicToolConfig as any, dynamicHandler as any);
  registeredTools.set(toolName, registeredTool);
  return registeredTool;
}

function updateExistingTool(
  toolName: string,
  toolConfig: SavedToolConfig
): void {
  const existingTool = registeredTools.get(toolName);
  if (!existingTool) {
    throw new Error(`Registered tool '${toolName}' not found for update`);
  }

  const dynamicHandler = createDynamicToolHandler(toolConfig);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  existingTool.update({
    title: toolConfig.description,
    description: toolConfig.description,
    paramsSchema: convertJsonSchemaToMcpZod(toolConfig.parameter_schema),
    callback: dynamicHandler,
  } as any);
}

export function handler(params: SaveQueryToolParams): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  return withErrorHandling(`saving tool '${params.tool_name}'`, async (log: Logger) => {
    // Check if tool already exists
    const toolExists = registeredTools.has(params.tool_name);
    const isUpdate = toolExists && (params.overwrite ?? false);
    const isCreate = !toolExists;

    if (toolExists && !(params.overwrite ?? false)) {
      throw new Error(`Tool with name '${params.tool_name}' already exists. Set overwrite=true to update it.`);
    }

    log('validating parameter schema');
    if (!validateJsonSchema(params.parameter_schema)) {
      throw new Error('Invalid parameter_schema: must be a valid JSON Schema object');
    }

    log('parsing SQL parameters');
    const { sql: sqlPrepared, parameterOrder } = parseNamedParameters(params.sql_query);
    const namedParams = extractNamedParameters(params.sql_query);

    const toolConfig: SavedToolConfig = {
      name: params.tool_name,
      description: params.description,
      sql_query: params.sql_query,
      sql_prepared: sqlPrepared,
      parameter_schema: params.parameter_schema,
      parameter_order: parameterOrder,
    };

    // Persist first for atomicity
    log('persisting tool to file');
    saveToolToFile(params.tool_name, toolConfig);

    // Then register or update with server
    if (isCreate) {
      log('registering new tool in MCP server');
      registerToolWithServer(params.tool_name, toolConfig);
      return `Successfully created tool '${params.tool_name}' with ${namedParams.length} parameter${namedParams.length === 1 ? '' : 's'}: ${namedParams.join(', ') || 'none'}`;
    } else if (isUpdate) {
      log('updating existing tool in MCP server');
      updateExistingTool(params.tool_name, toolConfig);
      return `Successfully updated tool '${params.tool_name}' with ${namedParams.length} parameter${namedParams.length === 1 ? '' : 's'}: ${namedParams.join(', ') || 'none'}`;
    }

    // This should never happen due to the logic above, but keeping for safety
    throw new Error('Unexpected state in save_query handler');
  });
}
