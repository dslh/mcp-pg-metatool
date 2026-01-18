/**
 * Tests for delete_saved_query tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/storage.js', () => ({
  deleteToolFile: vi.fn(),
}));

vi.mock('../../src/server.js', () => ({
  registeredTools: new Map(),
}));

import { deleteToolFile } from '../../src/storage.js';
import { registeredTools } from '../../src/server.js';
import { name, config, handler } from '../../src/tools/deleteSavedQuery.js';

describe('deleteSavedQuery tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registeredTools.clear();
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('delete_saved_query');
    });

    it('has title and description', () => {
      expect(config.title).toBe('Delete Saved Query');
      expect(config.description).toContain('Remove a saved query');
    });

    it('requires tool_name parameter', () => {
      expect(config.inputSchema.tool_name).toBeDefined();
    });
  });

  describe('handler - successful deletion', () => {
    it('deletes existing saved query', () => {
      const mockTool = { remove: vi.fn() };
      registeredTools.set('my_query', mockTool as never);

      const response = handler({ tool_name: 'my_query' });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Successfully deleted');
      expect(getResponseText(response)).toContain('my_query');
    });

    it('removes tool from MCP server', () => {
      const mockTool = { remove: vi.fn() };
      registeredTools.set('my_query', mockTool as never);

      handler({ tool_name: 'my_query' });

      expect(mockTool.remove).toHaveBeenCalled();
    });

    it('removes tool from registered tools map', () => {
      const mockTool = { remove: vi.fn() };
      registeredTools.set('my_query', mockTool as never);

      handler({ tool_name: 'my_query' });

      expect(registeredTools.has('my_query')).toBe(false);
    });

    it('deletes tool file from storage', () => {
      const mockTool = { remove: vi.fn() };
      registeredTools.set('my_query', mockTool as never);

      handler({ tool_name: 'my_query' });

      expect(deleteToolFile).toHaveBeenCalledWith('my_query');
    });
  });

  describe('handler - protected tools', () => {
    const protectedTools = [
      'execute_sql_query',
      'save_query',
      'delete_saved_query',
      'list_saved_queries',
      'show_saved_query',
      'list_schemas',
      'list_tables',
      'describe_table',
      'list_views',
      'describe_view',
    ];

    protectedTools.forEach((toolName) => {
      it(`rejects deletion of protected tool: ${toolName}`, () => {
        const response = handler({ tool_name: toolName });

        expectErrorResponse(response, 'Cannot delete core tool');
      });
    });

    it('does not call remove on protected tools', () => {
      const mockTool = { remove: vi.fn() };
      registeredTools.set('execute_sql_query', mockTool as never);

      handler({ tool_name: 'execute_sql_query' });

      expect(mockTool.remove).not.toHaveBeenCalled();
    });

    it('does not delete file for protected tools', () => {
      handler({ tool_name: 'list_tables' });

      expect(deleteToolFile).not.toHaveBeenCalled();
    });
  });

  describe('handler - non-existent tools', () => {
    it('returns error for non-existent query', () => {
      const response = handler({ tool_name: 'nonexistent_query' });

      expectErrorResponse(response, 'not found');
    });

    it('does not call deleteToolFile for non-existent query', () => {
      handler({ tool_name: 'nonexistent_query' });

      expect(deleteToolFile).not.toHaveBeenCalled();
    });
  });

  describe('handler - error handling', () => {
    it('handles file deletion errors', () => {
      const mockTool = { remove: vi.fn() };
      registeredTools.set('my_query', mockTool as never);

      vi.mocked(deleteToolFile).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const response = handler({ tool_name: 'my_query' });

      expectErrorResponse(response, 'Permission denied');
    });

    it('handles server removal errors', () => {
      const mockTool = {
        remove: vi.fn().mockImplementation(() => {
          throw new Error('Server error');
        }),
      };
      registeredTools.set('my_query', mockTool as never);

      const response = handler({ tool_name: 'my_query' });

      expectErrorResponse(response, 'Server error');
    });
  });
});
