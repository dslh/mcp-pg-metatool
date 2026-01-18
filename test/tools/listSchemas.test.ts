/**
 * Tests for list_schemas tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/schemaService.js', () => ({
  listSchemas: vi.fn(),
}));

import { listSchemas } from '../../src/schemaService.js';
import { name, config, handler } from '../../src/tools/listSchemas.js';

describe('listSchemas tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('list_schemas');
    });

    it('has title and description', () => {
      expect(config.title).toBe('List Schemas');
      expect(config.description).toContain('List all schemas');
    });

    it('has empty input schema', () => {
      expect(config.inputSchema).toEqual({});
    });
  });

  describe('handler', () => {
    it('returns list of schemas', async () => {
      vi.mocked(listSchemas).mockResolvedValue(dbResults.schemas);

      const response = await handler();

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Found 3 schemas');
    });

    it('lists each schema name', async () => {
      vi.mocked(listSchemas).mockResolvedValue(dbResults.schemas);

      const response = await handler();
      const text = getResponseText(response);

      expect(text).toContain('public');
      expect(text).toContain('auth');
      expect(text).toContain('analytics');
    });

    it('formats as markdown list', async () => {
      vi.mocked(listSchemas).mockResolvedValue(dbResults.schemas);

      const response = await handler();
      const text = getResponseText(response);

      expect(text).toContain('- public');
      expect(text).toContain('- auth');
    });

    it('handles empty result', async () => {
      vi.mocked(listSchemas).mockResolvedValue([]);

      const response = await handler();

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('No user schemas found');
    });

    it('uses correct singular form', async () => {
      vi.mocked(listSchemas).mockResolvedValue([{ schema_name: 'public' }]);

      const response = await handler();

      expect(getResponseText(response)).toContain('Found 1 schema:');
    });

    it('uses correct plural form', async () => {
      vi.mocked(listSchemas).mockResolvedValue(dbResults.schemas);

      const response = await handler();

      expect(getResponseText(response)).toContain('Found 3 schemas:');
    });

    it('handles database errors', async () => {
      vi.mocked(listSchemas).mockRejectedValue(new Error('Connection failed'));

      const response = await handler();

      expectErrorResponse(response, 'Connection failed');
    });
  });
});
