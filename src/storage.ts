import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { SavedToolConfig } from './types.js';

const DATA_DIR = process.env['MCP_PG_DATA_DIR'] ?? './data';
const TOOLS_DIR = join(DATA_DIR, 'tools');

export function ensureDataDirectory(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(TOOLS_DIR)) {
    mkdirSync(TOOLS_DIR, { recursive: true });
  }
}

export function saveToolToFile(toolName: string, config: SavedToolConfig): void {
  ensureDataDirectory();

  const filePath = join(TOOLS_DIR, `${toolName}.json`);

  try {
    const jsonData = JSON.stringify(config, null, 2);
    writeFileSync(filePath, jsonData, 'utf8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save tool '${toolName}' to file: ${errorMessage}`);
  }
}

export function loadToolFromFile(toolName: string): SavedToolConfig | null {
  const filePath = join(TOOLS_DIR, `${toolName}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const jsonData = readFileSync(filePath, 'utf8');
    const config = JSON.parse(jsonData) as SavedToolConfig;

    if (!isValidToolConfig(config)) {
      throw new Error(`Invalid tool configuration in file: ${filePath}`);
    }

    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load tool '${toolName}' from file: ${errorMessage}`);
  }
}

export function loadAllTools(): Map<string, SavedToolConfig> {
  const tools = new Map<string, SavedToolConfig>();

  if (!existsSync(TOOLS_DIR)) {
    return tools;
  }

  try {
    const files = readdirSync(TOOLS_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const toolName = file.replace('.json', '');
        const config = loadToolFromFile(toolName);

        if (config) {
          tools.set(toolName, config);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load tools from directory: ${errorMessage}`);
  }

  return tools;
}

export function deleteToolFile(toolName: string): void {
  const filePath = join(TOOLS_DIR, `${toolName}.json`);

  if (!existsSync(filePath)) {
    return;
  }

  try {
    unlinkSync(filePath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete tool file '${toolName}': ${errorMessage}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isValidToolConfig(config: any): config is SavedToolConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.name === 'string' &&
    typeof config.description === 'string' &&
    typeof config.sql_query === 'string' &&
    typeof config.sql_prepared === 'string' &&
    typeof config.parameter_schema === 'object' &&
    Array.isArray(config.parameter_order) &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.parameter_order.every((v: any) => typeof v === 'string')
  );
}
