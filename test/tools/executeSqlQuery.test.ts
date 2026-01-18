/**
 * Tests for execute_sql_query tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQueryResult, dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, parseResponseJson } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/client.js', () => ({
  pool: {
    query: vi.fn(),
    end: vi.fn(),
  },
}));

import { pool } from '../../src/client.js';
import { name, config, handler } from '../../src/tools/executeSqlQuery.js';

describe('executeSqlQuery tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('execute_sql_query');
    });

    it('has title and description', () => {
      expect(config.title).toBe('Execute SQL Query');
      expect(config.description).toContain('Execute arbitrary SQL');
    });

    it('has query parameter', () => {
      expect(config.inputSchema.query).toBeDefined();
    });

    it('has optional params parameter', () => {
      expect(config.inputSchema.params).toBeDefined();
    });
  });

  describe('handler - basic queries', () => {
    it('executes query without parameters', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([{ id: 1 }, { id: 2 }], [{ name: 'id', dataTypeID: 23 }]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult(dbResults.typeNames) as Awaited<ReturnType<typeof pool.query>>
        );

      const response = await handler({ query: 'SELECT id FROM users' });

      expectSuccessResponse(response);
      expect(pool.query).toHaveBeenCalledWith('SELECT id FROM users', []);
    });

    it('returns rows and metadata', async () => {
      const rows = [{ id: 1, name: 'Test' }];
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult(rows, [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 25 },
          ]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([
            { oid: 23, typname: 'int4' },
            { oid: 25, typname: 'text' },
          ]) as Awaited<ReturnType<typeof pool.query>>
        );

      const response = await handler({ query: 'SELECT * FROM users' });
      const result = parseResponseJson<{
        rows: typeof rows;
        rowCount: number;
        fields: Array<{ name: string; dataType: string }>;
      }>(response);

      expect(result.rows).toEqual(rows);
      expect(result.rowCount).toBe(1);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0]).toEqual(expect.objectContaining({
        name: 'id',
        dataType: 'int4',
      }));
    });
  });

  describe('handler - named parameters', () => {
    it('converts named parameters to positional', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      await handler({
        query: 'SELECT * FROM users WHERE id = :user_id',
        params: { user_id: 123 },
      });

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [123]
      );
    });

    it('handles multiple parameters', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      await handler({
        query: 'SELECT * FROM users WHERE id = :id AND status = :status',
        params: { id: 1, status: 'active' },
      });

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND status = $2',
        [1, 'active']
      );
    });

    it('handles duplicate parameters', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      await handler({
        query: 'SELECT * FROM users WHERE id = :id OR other_id = :id',
        params: { id: 42 },
      });

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 OR other_id = $1',
        [42]
      );
    });

    it('does not match type casts as parameters', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      await handler({
        query: 'SELECT created_at::date FROM users WHERE id = :id',
        params: { id: 1 },
      });

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT created_at::date FROM users WHERE id = $1',
        [1]
      );
    });
  });

  describe('handler - type name resolution', () => {
    it('resolves PostgreSQL OIDs to type names', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([{ value: 42 }], [{ name: 'value', dataTypeID: 23 }]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([{ oid: 23, typname: 'int4' }]) as Awaited<ReturnType<typeof pool.query>>
        );

      const response = await handler({ query: 'SELECT 42 as value' });
      const result = parseResponseJson<{
        fields: Array<{ name: string; dataType: string; dataTypeID: number }>;
      }>(response);

      expect(result.fields[0]?.dataType).toBe('int4');
      expect(result.fields[0]?.dataTypeID).toBe(23);
    });

    it('falls back to "unknown" for unresolved types', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([{ value: 'test' }], [{ name: 'value', dataTypeID: 99999 }]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      const response = await handler({ query: 'SELECT 1' });
      const result = parseResponseJson<{
        fields: Array<{ name: string; dataType: string }>;
      }>(response);

      expect(result.fields[0]?.dataType).toBe('unknown');
    });
  });

  describe('handler - error cases', () => {
    it('handles database connection errors', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection refused'));

      const response = await handler({ query: 'SELECT 1' });

      expectErrorResponse(response, 'Connection refused');
    });

    it('handles SQL syntax errors', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('syntax error at or near "SELEC"'));

      const response = await handler({ query: 'SELEC 1' });

      expectErrorResponse(response, 'syntax error');
    });

    it('handles missing table errors', async () => {
      vi.mocked(pool.query).mockRejectedValue(
        new Error('relation "nonexistent" does not exist')
      );

      const response = await handler({ query: 'SELECT * FROM nonexistent' });

      expectErrorResponse(response, 'does not exist');
    });
  });

  describe('handler - edge cases', () => {
    it('handles empty result set', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      const response = await handler({ query: 'SELECT * FROM users WHERE 1=0' });
      const result = parseResponseJson<{ rows: unknown[]; rowCount: number }>(response);

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('handles undefined params', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      await handler({ query: 'SELECT 1', params: undefined });

      expect(pool.query).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('handles INSERT/UPDATE/DELETE queries', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 5,
          fields: [],
        } as Awaited<ReturnType<typeof pool.query>>)
        .mockResolvedValueOnce(createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>);

      const response = await handler({
        query: 'UPDATE users SET active = true WHERE status = :status',
        params: { status: 'pending' },
      });
      const result = parseResponseJson<{ rowCount: number }>(response);

      expect(result.rowCount).toBe(5);
    });
  });
});
