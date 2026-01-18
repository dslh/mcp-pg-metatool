/**
 * Tests for list_saved_queries tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSavedToolConfig } from '../helpers/fixtures.js';
import { expectSuccessResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/storage.js', () => ({
  loadAllTools: vi.fn(),
}));

vi.mock('../../src/server.js', () => ({
  registeredTools: new Map(),
}));

import { loadAllTools } from '../../src/storage.js';
import { registeredTools } from '../../src/server.js';
import { name, config, handler } from '../../src/tools/listSavedQueries.js';

describe('listSavedQueries tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registeredTools.clear();
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('list_saved_queries');
    });

    it('has title and description', () => {
      expect(config.title).toBe('List Saved Queries');
      expect(config.description).toContain('List all saved query tools');
    });

    it('has empty input schema', () => {
      expect(config.inputSchema).toEqual({});
    });
  });

  describe('handler - no saved queries', () => {
    it('returns message when no queries exist', () => {
      const response = handler();

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('No saved queries found');
    });
  });

  describe('handler - listing queries', () => {
    it('lists single saved query', () => {
      registeredTools.set('my_query', {} as never);
      vi.mocked(loadAllTools).mockReturnValue(
        new Map([['my_query', createSavedToolConfig({ name: 'my_query', description: 'My Query Description' })]])
      );

      const response = handler();

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Found 1 saved query');
      expect(getResponseText(response)).toContain('my_query');
      expect(getResponseText(response)).toContain('My Query Description');
    });

    it('lists multiple saved queries', () => {
      registeredTools.set('query1', {} as never);
      registeredTools.set('query2', {} as never);
      registeredTools.set('query3', {} as never);

      vi.mocked(loadAllTools).mockReturnValue(
        new Map([
          ['query1', createSavedToolConfig({ name: 'query1', description: 'First query' })],
          ['query2', createSavedToolConfig({ name: 'query2', description: 'Second query' })],
          ['query3', createSavedToolConfig({ name: 'query3', description: 'Third query' })],
        ])
      );

      const response = handler();

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Found 3 saved queries');
      expect(getResponseText(response)).toContain('query1');
      expect(getResponseText(response)).toContain('query2');
      expect(getResponseText(response)).toContain('query3');
    });

    it('uses correct plural form for multiple queries', () => {
      registeredTools.set('q1', {} as never);
      registeredTools.set('q2', {} as never);
      vi.mocked(loadAllTools).mockReturnValue(new Map());

      const response = handler();

      expect(getResponseText(response)).toContain('queries');
    });

    it('uses correct singular form for one query', () => {
      registeredTools.set('q1', {} as never);
      vi.mocked(loadAllTools).mockReturnValue(new Map());

      const response = handler();

      expect(getResponseText(response)).toContain('query:');
    });

    it('shows "No description" for tools without description in storage', () => {
      registeredTools.set('my_query', {} as never);
      vi.mocked(loadAllTools).mockReturnValue(new Map()); // No config in storage

      const response = handler();

      expect(getResponseText(response)).toContain('No description');
    });

    it('formats output as markdown list', () => {
      registeredTools.set('my_query', {} as never);
      vi.mocked(loadAllTools).mockReturnValue(
        new Map([['my_query', createSavedToolConfig({ description: 'Test' })]])
      );

      const response = handler();
      const text = getResponseText(response);

      expect(text).toContain('**my_query**');
      expect(text).toContain('-');
    });
  });
});
