/**
 * Tests for list_views tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/schemaService.js', () => ({
  listViews: vi.fn(),
}));

import { listViews } from '../../src/schemaService.js';
import { name, config, handler } from '../../src/tools/listViews.js';

describe('listViews tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('list_views');
    });

    it('has title and description', () => {
      expect(config.title).toBe('List Views');
      expect(config.description).toContain('List all views');
    });

    it('has optional schema_name parameter', () => {
      expect(config.inputSchema.schema_name).toBeDefined();
    });
  });

  describe('handler', () => {
    it('returns list of views for default schema', async () => {
      vi.mocked(listViews).mockResolvedValue(dbResults.views);

      const response = await handler({});

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Found 2 views');
      expect(getResponseText(response)).toContain("in schema 'public'");
    });

    it('queries specified schema', async () => {
      vi.mocked(listViews).mockResolvedValue([]);

      await handler({ schema_name: 'analytics' });

      expect(listViews).toHaveBeenCalledWith('analytics');
    });

    it('uses public schema when not specified', async () => {
      vi.mocked(listViews).mockResolvedValue([]);

      await handler({ schema_name: undefined });

      expect(listViews).toHaveBeenCalledWith('public');
    });

    it('lists each view name', async () => {
      vi.mocked(listViews).mockResolvedValue(dbResults.views);

      const response = await handler({});
      const text = getResponseText(response);

      expect(text).toContain('active_users');
      expect(text).toContain('user_stats');
    });

    it('formats as markdown list', async () => {
      vi.mocked(listViews).mockResolvedValue(dbResults.views);

      const response = await handler({});
      const text = getResponseText(response);

      expect(text).toContain('- active_users');
      expect(text).toContain('- user_stats');
    });

    it('handles empty result', async () => {
      vi.mocked(listViews).mockResolvedValue([]);

      const response = await handler({ schema_name: 'empty_schema' });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain("No views found in schema 'empty_schema'");
    });

    it('uses correct singular form', async () => {
      vi.mocked(listViews).mockResolvedValue([dbResults.views[0]!]);

      const response = await handler({});

      expect(getResponseText(response)).toContain('Found 1 view');
    });

    it('uses correct plural form', async () => {
      vi.mocked(listViews).mockResolvedValue(dbResults.views);

      const response = await handler({});

      expect(getResponseText(response)).toContain('Found 2 views');
    });

    it('handles database errors', async () => {
      vi.mocked(listViews).mockRejectedValue(new Error('Permission denied'));

      const response = await handler({});

      expectErrorResponse(response, 'Permission denied');
    });
  });
});
