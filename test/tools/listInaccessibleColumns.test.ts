/**
 * Tests for list_inaccessible_columns tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

vi.mock('../../src/schemaService.js', () => ({
  getInaccessibleColumns: vi.fn(),
}));

import { getInaccessibleColumns } from '../../src/schemaService.js';
import { name, config, handler } from '../../src/tools/listInaccessibleColumns.js';

describe('listInaccessibleColumns tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('list_inaccessible_columns');
    });

    it('describes the purpose', () => {
      expect(config.title).toBe('List Inaccessible Columns');
      expect(config.description).toContain('SELECT privilege');
    });

    it('has optional schema_name parameter', () => {
      expect(config.inputSchema.schema_name).toBeDefined();
    });
  });

  describe('handler', () => {
    it('returns a friendly message when nothing is inaccessible', async () => {
      vi.mocked(getInaccessibleColumns).mockResolvedValue([]);

      const response = await handler({});

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('has SELECT on every column');
      expect(getResponseText(response)).toContain('all user schemas');
    });

    it('lists inaccessible columns as fully-qualified names', async () => {
      vi.mocked(getInaccessibleColumns).mockResolvedValue([
        { table_schema: 'public', table_name: 'users', column_name: 'ssn' },
        { table_schema: 'public', table_name: 'payments', column_name: 'cc_number' },
      ]);

      const response = await handler({});
      const text = getResponseText(response);

      expect(text).toContain('- public.users.ssn');
      expect(text).toContain('- public.payments.cc_number');
      expect(text).toContain('Found 2 inaccessible columns');
    });

    it('uses singular form for a single result', async () => {
      vi.mocked(getInaccessibleColumns).mockResolvedValue([
        { table_schema: 'public', table_name: 'users', column_name: 'ssn' },
      ]);

      const response = await handler({});
      expect(getResponseText(response)).toContain('Found 1 inaccessible column ');
    });

    it('forwards the schema filter', async () => {
      vi.mocked(getInaccessibleColumns).mockResolvedValue([]);

      const response = await handler({ schema_name: 'auth' });

      expect(getInaccessibleColumns).toHaveBeenCalledWith('auth');
      expect(getResponseText(response)).toContain("schema 'auth'");
    });

    it('handles database errors', async () => {
      vi.mocked(getInaccessibleColumns).mockRejectedValue(new Error('catalog unavailable'));

      const response = await handler({});

      expectErrorResponse(response, 'catalog unavailable');
    });
  });
});
