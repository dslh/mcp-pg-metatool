/**
 * Tests for database schema introspection service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbResults, createQueryResult } from '../helpers/fixtures.js';

// Mock the client module
vi.mock('../../src/client.js', () => ({
  pool: {
    query: vi.fn(),
    end: vi.fn(),
  },
}));

import { pool } from '../../src/client.js';
import {
  listSchemas,
  listTables,
  getTableColumns,
  getTableConstraints,
  listViews,
  getViewDefinition,
  getTypeNames,
} from '../../src/schemaService.js';

describe('schemaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSchemas', () => {
    it('returns schemas excluding system schemas', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult(dbResults.schemas) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await listSchemas();

      expect(result).toEqual(dbResults.schemas);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.schemata')
      );
    });

    it('excludes pg_catalog, information_schema, and pg_toast', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await listSchemas();

      const query = vi.mocked(pool.query).mock.calls[0]?.[0] as string;
      expect(query).toContain("'pg_catalog'");
      expect(query).toContain("'information_schema'");
      expect(query).toContain("'pg_toast'");
    });

    it('returns empty array when no schemas found', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await listSchemas();

      expect(result).toEqual([]);
    });
  });

  describe('listTables', () => {
    it('returns tables for default public schema', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult(dbResults.tables) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await listTables();

      expect(result).toEqual(dbResults.tables);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.tables'),
        ['public']
      );
    });

    it('filters by specified schema', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await listTables('custom_schema');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['custom_schema']
      );
    });

    it('only returns BASE TABLE type', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await listTables();

      const query = vi.mocked(pool.query).mock.calls[0]?.[0] as string;
      expect(query).toContain("table_type = 'BASE TABLE'");
    });

    it('returns empty array when no tables found', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await listTables('empty_schema');

      expect(result).toEqual([]);
    });
  });

  describe('getTableColumns', () => {
    it('returns column info for specified table', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult(dbResults.columns) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await getTableColumns('users');

      expect(result).toEqual(dbResults.columns);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.columns'),
        ['public', 'users']
      );
    });

    it('uses specified schema', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await getTableColumns('users', 'auth');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['auth', 'users']
      );
    });

    it('returns columns ordered by ordinal_position', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await getTableColumns('users');

      const query = vi.mocked(pool.query).mock.calls[0]?.[0] as string;
      expect(query).toContain('ORDER BY ordinal_position');
    });
  });

  describe('getTableConstraints', () => {
    it('returns constraints for specified table', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult(dbResults.constraints) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await getTableConstraints('users');

      expect(result).toEqual(dbResults.constraints);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('table_constraints'),
        ['public', 'users']
      );
    });

    it('uses specified schema', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await getTableConstraints('users', 'auth');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['auth', 'users']
      );
    });

    it('joins with key_column_usage for column names', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await getTableConstraints('users');

      const query = vi.mocked(pool.query).mock.calls[0]?.[0] as string;
      expect(query).toContain('key_column_usage');
    });
  });

  describe('listViews', () => {
    it('returns views for default public schema', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult(dbResults.views) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await listViews();

      expect(result).toEqual(dbResults.views);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.views'),
        ['public']
      );
    });

    it('filters by specified schema', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await listViews('analytics');

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['analytics']
      );
    });
  });

  describe('getViewDefinition', () => {
    it('returns view definition with columns', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([dbResults.viewDefinition]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult(dbResults.columns.slice(0, 3)) as Awaited<ReturnType<typeof pool.query>>
        );

      const result = await getViewDefinition('active_users');

      expect(result).not.toBeNull();
      expect(result?.table_name).toBe('active_users');
      expect(result?.view_definition).toContain('SELECT');
      expect(result?.columns).toHaveLength(3);
    });

    it('returns null for non-existent view', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await getViewDefinition('nonexistent');

      expect(result).toBeNull();
    });

    it('queries pg_views for definition', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await getViewDefinition('test_view', 'test_schema');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_views'),
        ['test_schema', 'test_view']
      );
    });
  });

  describe('getTypeNames', () => {
    it('returns empty map for empty OID array', async () => {
      const result = await getTypeNames([]);

      expect(result.size).toBe(0);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('returns type name map for given OIDs', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult(dbResults.typeNames) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await getTypeNames([23, 25, 1043]);

      expect(result.get(23)).toBe('int4');
      expect(result.get(25)).toBe('text');
      expect(result.get(1043)).toBe('varchar');
    });

    it('queries pg_type table', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
      );

      await getTypeNames([23]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_type'),
        [[23]]
      );
    });

    it('handles multiple OIDs', async () => {
      vi.mocked(pool.query).mockResolvedValue(
        createQueryResult([
          { oid: 16, typname: 'bool' },
          { oid: 23, typname: 'int4' },
        ]) as Awaited<ReturnType<typeof pool.query>>
      );

      const result = await getTypeNames([16, 23]);

      expect(result.size).toBe(2);
    });
  });
});
