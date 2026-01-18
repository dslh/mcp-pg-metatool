/**
 * Tests for list_tables tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/schemaService.js', () => ({
  listTables: vi.fn(),
}));

import { listTables } from '../../src/schemaService.js';
import { name, config, handler } from '../../src/tools/listTables.js';

describe('listTables tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('list_tables');
    });

    it('has title and description', () => {
      expect(config.title).toBe('List Tables');
      expect(config.description).toContain('List all tables');
    });

    it('has optional schema_name parameter with default', () => {
      expect(config.inputSchema.schema_name).toBeDefined();
    });
  });

  describe('handler', () => {
    it('returns list of tables for default schema', async () => {
      vi.mocked(listTables).mockResolvedValue(dbResults.tables);

      const response = await handler({});

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Found 3 tables');
      expect(getResponseText(response)).toContain("in schema 'public'");
    });

    it('queries specified schema', async () => {
      vi.mocked(listTables).mockResolvedValue([]);

      await handler({ schema_name: 'custom_schema' });

      expect(listTables).toHaveBeenCalledWith('custom_schema');
    });

    it('uses public schema when not specified', async () => {
      vi.mocked(listTables).mockResolvedValue([]);

      await handler({ schema_name: undefined });

      expect(listTables).toHaveBeenCalledWith('public');
    });

    it('lists each table name', async () => {
      vi.mocked(listTables).mockResolvedValue(dbResults.tables);

      const response = await handler({});
      const text = getResponseText(response);

      expect(text).toContain('users');
      expect(text).toContain('orders');
      expect(text).toContain('products');
    });

    it('formats as markdown list', async () => {
      vi.mocked(listTables).mockResolvedValue(dbResults.tables);

      const response = await handler({});
      const text = getResponseText(response);

      expect(text).toContain('- users');
      expect(text).toContain('- orders');
    });

    it('handles empty result', async () => {
      vi.mocked(listTables).mockResolvedValue([]);

      const response = await handler({ schema_name: 'empty_schema' });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain("No tables found in schema 'empty_schema'");
    });

    it('uses correct singular form', async () => {
      vi.mocked(listTables).mockResolvedValue([dbResults.tables[0]!]);

      const response = await handler({});

      expect(getResponseText(response)).toContain('Found 1 table');
    });

    it('uses correct plural form', async () => {
      vi.mocked(listTables).mockResolvedValue(dbResults.tables);

      const response = await handler({});

      expect(getResponseText(response)).toContain('Found 3 tables');
    });

    it('handles database errors', async () => {
      vi.mocked(listTables).mockRejectedValue(new Error('Schema not found'));

      const response = await handler({});

      expectErrorResponse(response, 'Schema not found');
    });
  });
});
