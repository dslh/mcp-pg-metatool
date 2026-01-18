/**
 * Tests for show_saved_query tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSavedToolConfig } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText, parseResponseJsonFromCodeBlock } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/storage.js', () => ({
  loadToolFromFile: vi.fn(),
}));

vi.mock('../../src/server.js', () => ({
  registeredTools: new Map(),
}));

import { loadToolFromFile } from '../../src/storage.js';
import { registeredTools } from '../../src/server.js';
import { name, config, handler } from '../../src/tools/showSavedQuery.js';
import type { SavedToolConfig } from '../../src/types.js';

describe('showSavedQuery tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registeredTools.clear();
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('show_saved_query');
    });

    it('has title and description', () => {
      expect(config.title).toBe('Show Saved Query');
      expect(config.description).toContain('full tool definition');
    });

    it('requires tool_name parameter', () => {
      expect(config.inputSchema.tool_name).toBeDefined();
    });
  });

  describe('handler - showing query', () => {
    it('shows saved query definition', () => {
      const toolConfig = createSavedToolConfig({
        name: 'my_query',
        description: 'Test description',
        sql_query: 'SELECT * FROM users WHERE id = :user_id',
        sql_prepared: 'SELECT * FROM users WHERE id = $1',
        parameter_order: ['user_id'],
      });

      registeredTools.set('my_query', {} as never);
      vi.mocked(loadToolFromFile).mockReturnValue(toolConfig);

      const response = handler({ tool_name: 'my_query' });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain("Tool definition for 'my_query'");
    });

    it('returns full tool configuration as JSON', () => {
      const toolConfig = createSavedToolConfig({
        name: 'my_query',
        description: 'Get user by ID',
        sql_query: 'SELECT * FROM users WHERE id = :user_id',
        sql_prepared: 'SELECT * FROM users WHERE id = $1',
        parameter_schema: {
          type: 'object',
          properties: { user_id: { type: 'integer' } },
          required: ['user_id'],
        },
        parameter_order: ['user_id'],
      });

      registeredTools.set('my_query', {} as never);
      vi.mocked(loadToolFromFile).mockReturnValue(toolConfig);

      const response = handler({ tool_name: 'my_query' });
      const result = parseResponseJsonFromCodeBlock<SavedToolConfig>(response);

      expect(result.name).toBe('my_query');
      expect(result.description).toBe('Get user by ID');
      expect(result.sql_query).toBe('SELECT * FROM users WHERE id = :user_id');
      expect(result.sql_prepared).toBe('SELECT * FROM users WHERE id = $1');
      expect(result.parameter_order).toEqual(['user_id']);
    });

    it('includes parameter schema in output', () => {
      const toolConfig = createSavedToolConfig({
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
          required: ['id'],
        },
      });

      registeredTools.set('my_query', {} as never);
      vi.mocked(loadToolFromFile).mockReturnValue(toolConfig);

      const response = handler({ tool_name: 'my_query' });
      const result = parseResponseJsonFromCodeBlock<SavedToolConfig>(response);

      expect(result.parameter_schema).toEqual(toolConfig.parameter_schema);
    });

    it('formats output as markdown code block', () => {
      registeredTools.set('my_query', {} as never);
      vi.mocked(loadToolFromFile).mockReturnValue(createSavedToolConfig());

      const response = handler({ tool_name: 'my_query' });
      const text = getResponseText(response);

      expect(text).toContain('```json');
      expect(text).toContain('```');
    });
  });

  describe('handler - error cases', () => {
    it('returns error for non-existent query', () => {
      const response = handler({ tool_name: 'nonexistent' });

      expectErrorResponse(response, 'not found');
    });

    it('returns error when query is registered but file not found', () => {
      registeredTools.set('my_query', {} as never);
      vi.mocked(loadToolFromFile).mockReturnValue(null);

      const response = handler({ tool_name: 'my_query' });

      expectErrorResponse(response, 'could not be loaded');
    });

    it('handles file load errors', () => {
      registeredTools.set('my_query', {} as never);
      vi.mocked(loadToolFromFile).mockImplementation(() => {
        throw new Error('Read error');
      });

      const response = handler({ tool_name: 'my_query' });

      expectErrorResponse(response, 'Read error');
    });
  });
});
