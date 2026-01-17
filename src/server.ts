import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerAllTools } from './dynamicToolHandler.js';
import { ensureDataDirectory } from './storage.js';
import * as deleteSavedQuery from './tools/deleteSavedQuery.js';
import * as describeTable from './tools/describeTable.js';
import * as describeView from './tools/describeView.js';
import * as executeSqlQuery from './tools/executeSqlQuery.js';
import * as listSavedQueries from './tools/listSavedQueries.js';
import * as listSchemas from './tools/listSchemas.js';
import * as listTables from './tools/listTables.js';
import * as listViews from './tools/listViews.js';
import * as saveQuery from './tools/saveQuery.js';
import * as showSavedQuery from './tools/showSavedQuery.js';

function createServer(): { server: McpServer; registeredTools: Map<string, RegisteredTool>; coreToolsStatus: string } {
  ensureDataDirectory();

  const server = new McpServer({
    name: 'pg-metatool',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
  });

  // Check environment variable for disabling core tools
  const disableSetting = process.env['DISABLE_CORE_TOOLS']?.toLowerCase() ?? 'none';
  let coreToolsStatus: string;

  // Helper to register tools with type assertion to avoid excessive type instantiation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registerTool = (name: string, config: any, handler: any): void => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    server.registerTool(name, config, handler);
  };

  // Register core tools based on settings
  if (disableSetting === 'all') {
    // Disable all core tools
    coreToolsStatus = 'all core tools disabled';
  } else if (disableSetting === 'management') {
    // Keep execute_sql_query and introspection, disable management tools
    registerTool(executeSqlQuery.name, executeSqlQuery.config, executeSqlQuery.handler);
    registerTool(listSchemas.name, listSchemas.config, listSchemas.handler);
    registerTool(listTables.name, listTables.config, listTables.handler);
    registerTool(describeTable.name, describeTable.config, describeTable.handler);
    registerTool(listViews.name, listViews.config, listViews.handler);
    registerTool(describeView.name, describeView.config, describeView.handler);
    coreToolsStatus = 'management tools disabled, query and introspection tools enabled';
  } else {
    // Default: register all core tools
    registerTool(executeSqlQuery.name, executeSqlQuery.config, executeSqlQuery.handler);
    registerTool(saveQuery.name, saveQuery.config, saveQuery.handler);
    registerTool(deleteSavedQuery.name, deleteSavedQuery.config, deleteSavedQuery.handler);
    registerTool(listSavedQueries.name, listSavedQueries.config, listSavedQueries.handler);
    registerTool(showSavedQuery.name, showSavedQuery.config, showSavedQuery.handler);
    registerTool(listSchemas.name, listSchemas.config, listSchemas.handler);
    registerTool(listTables.name, listTables.config, listTables.handler);
    registerTool(describeTable.name, describeTable.config, describeTable.handler);
    registerTool(listViews.name, listViews.config, listViews.handler);
    registerTool(describeView.name, describeView.config, describeView.handler);
    coreToolsStatus = 'all core tools enabled';
  }

  // Register all saved tools and get the registeredTools map
  const registeredTools = registerAllTools(server);

  return { server, registeredTools, coreToolsStatus };
}

const { server, registeredTools, coreToolsStatus } = createServer();

export { server, registeredTools, coreToolsStatus };
