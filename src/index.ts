#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { server, registeredTools, coreToolsStatus } from './server.js';

async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    console.error(`Starting PostgreSQL MCP Metatool: ${coreToolsStatus}, ${String(registeredTools.size)} saved tools loaded`);
    await server.connect(transport);
  } catch (error) {
    console.error('Failed to start PostgreSQL MCP server:', error);
    process.exit(1);
  }
}

await main();
