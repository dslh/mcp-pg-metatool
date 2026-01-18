/**
 * Tests for describe_view tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';
import type { ViewDefinition } from '../../src/schemaService.js';

// Mock dependencies
vi.mock('../../src/schemaService.js', () => ({
  getViewDefinition: vi.fn(),
}));

import { getViewDefinition } from '../../src/schemaService.js';
import { name, config, handler } from '../../src/tools/describeView.js';

describe('describeView tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('describe_view');
    });

    it('has title and description', () => {
      expect(config.title).toBe('Describe View');
      expect(config.description).toContain('detailed information');
    });

    it('requires view_name parameter', () => {
      expect(config.inputSchema.view_name).toBeDefined();
    });

    it('has optional schema_name parameter', () => {
      expect(config.inputSchema.schema_name).toBeDefined();
    });
  });

  describe('handler - view formatting', () => {
    const mockViewDef: ViewDefinition = {
      table_schema: 'public',
      table_name: 'active_users',
      view_definition: 'SELECT id, name, email FROM users WHERE active = true;',
      columns: dbResults.columns.slice(0, 3),
    };

    it('displays view name with schema', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('View: public.active_users');
    });

    it('lists all columns', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });
      const text = getResponseText(response);

      expect(text).toContain('Columns:');
      expect(text).toContain('id:');
      expect(text).toContain('name:');
      expect(text).toContain('email:');
    });

    it('shows column data types', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });
      const text = getResponseText(response);

      expect(text).toContain('integer');
      expect(text).toContain('character varying');
    });

    it('shows character maximum length when applicable', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });
      const text = getResponseText(response);

      expect(text).toContain('(255)');
    });

    it('shows nullable status', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });
      const text = getResponseText(response);

      expect(text).toContain('NOT NULL');
    });

    it('shows view definition', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });
      const text = getResponseText(response);

      expect(text).toContain('Definition:');
      expect(text).toContain('SELECT id, name, email FROM users WHERE active = true');
    });

    it('formats definition as SQL code block', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(mockViewDef);

      const response = await handler({ view_name: 'active_users' });
      const text = getResponseText(response);

      expect(text).toContain('```sql');
      expect(text).toContain('```');
    });
  });

  describe('handler - schema handling', () => {
    it('uses public schema by default', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(null);

      await handler({ view_name: 'my_view', schema_name: undefined });

      expect(getViewDefinition).toHaveBeenCalledWith('my_view', 'public');
    });

    it('uses specified schema', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(null);

      await handler({ view_name: 'my_view', schema_name: 'analytics' });

      expect(getViewDefinition).toHaveBeenCalledWith('my_view', 'analytics');
    });
  });

  describe('handler - error cases', () => {
    it('returns error when view not found', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(null);

      const response = await handler({ view_name: 'nonexistent' });

      expectErrorResponse(response, 'not found');
    });

    it('includes schema in not found error', async () => {
      vi.mocked(getViewDefinition).mockResolvedValue(null);

      const response = await handler({ view_name: 'my_view', schema_name: 'custom' });

      expect(getResponseText(response)).toContain("'custom.my_view'");
    });

    it('handles database errors', async () => {
      vi.mocked(getViewDefinition).mockRejectedValue(new Error('Permission denied'));

      const response = await handler({ view_name: 'my_view' });

      expectErrorResponse(response, 'Permission denied');
    });
  });
});
