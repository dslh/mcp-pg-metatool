/**
 * Tests for describe_table tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/schemaService.js', () => ({
  getTableColumns: vi.fn(),
  getTableConstraints: vi.fn(),
}));

import { getTableColumns, getTableConstraints } from '../../src/schemaService.js';
import { name, config, handler } from '../../src/tools/describeTable.js';

describe('describeTable tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('describe_table');
    });

    it('has title and description', () => {
      expect(config.title).toBe('Describe Table');
      expect(config.description).toContain('detailed schema information');
    });

    it('requires table_name parameter', () => {
      expect(config.inputSchema.table_name).toBeDefined();
    });

    it('has optional schema_name parameter', () => {
      expect(config.inputSchema.schema_name).toBeDefined();
    });
  });

  describe('handler - column formatting', () => {
    it('displays table name with schema', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Table: public.users');
    });

    it('lists all columns', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('id:');
      expect(text).toContain('name:');
      expect(text).toContain('email:');
      expect(text).toContain('created_at:');
    });

    it('shows column data types', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('integer');
      expect(text).toContain('character varying');
      expect(text).toContain('timestamp with time zone');
    });

    it('shows character maximum length when applicable', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('(255)');
    });

    it('shows nullable status', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('NOT NULL');
    });

    it('shows default values', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('DEFAULT now()');
    });
  });

  describe('handler - constraint formatting', () => {
    it('shows constraints section when constraints exist', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue(dbResults.constraints);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('Constraints:');
    });

    it('groups constraints by type', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue(dbResults.constraints);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('PRIMARY KEY:');
      expect(text).toContain('UNIQUE:');
    });

    it('shows constraint names with column names', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue(dbResults.constraints);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).toContain('users_pkey (id)');
      expect(text).toContain('users_email_key (email)');
    });

    it('omits constraints section when none exist', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      const response = await handler({ table_name: 'users' });
      const text = getResponseText(response);

      expect(text).not.toContain('Constraints:');
    });
  });

  describe('handler - schema handling', () => {
    it('uses public schema by default', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      await handler({ table_name: 'users', schema_name: undefined });

      expect(getTableColumns).toHaveBeenCalledWith('users', 'public');
    });

    it('uses specified schema', async () => {
      vi.mocked(getTableColumns).mockResolvedValue(dbResults.columns);
      vi.mocked(getTableConstraints).mockResolvedValue([]);

      await handler({ table_name: 'users', schema_name: 'auth' });

      expect(getTableColumns).toHaveBeenCalledWith('users', 'auth');
      expect(getTableConstraints).toHaveBeenCalledWith('users', 'auth');
    });
  });

  describe('handler - error cases', () => {
    it('returns error when table not found', async () => {
      vi.mocked(getTableColumns).mockResolvedValue([]);

      const response = await handler({ table_name: 'nonexistent' });

      expectErrorResponse(response, 'not found');
    });

    it('handles database errors', async () => {
      vi.mocked(getTableColumns).mockRejectedValue(new Error('Connection lost'));

      const response = await handler({ table_name: 'users' });

      expectErrorResponse(response, 'Connection lost');
    });
  });
});
