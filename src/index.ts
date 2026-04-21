#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { describeSafetyConfig, mergeBlacklistEntries, safetyConfig } from './safetyConfig.js';
import { getInaccessibleColumns } from './schemaService.js';
import { server, registeredTools, coreToolsStatus } from './server.js';

async function hydrateBlacklistFromGrants(): Promise<void> {
  try {
    const rows = await getInaccessibleColumns();
    const added = mergeBlacklistEntries(rows);
    console.error(`Safety: loaded ${String(added)} column${added === 1 ? '' : 's'} from DB GRANTs into blacklist`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Safety: failed to load blacklist from DB GRANTs: ${message}`);
  }
}

async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    console.error(`Starting PostgreSQL MCP Metatool: ${coreToolsStatus}, ${String(registeredTools.size)} saved tools loaded`);

    if (safetyConfig.autoFromGrants) {
      await hydrateBlacklistFromGrants();
    }

    console.error(`Safety: ${describeSafetyConfig()}`);
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start PostgreSQL MCP server:', error);
    process.exit(1);
  }
}

await main();
