/**
 * Tests for GDPR/PII field blacklist filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/client.js', () => ({
  pool: {
    query: vi.fn(),
    end: vi.fn(),
  },
}));

vi.mock('../../src/safetyConfig.js', () => ({
  safetyConfig: {
    readOnly: false,
    blacklistFull: new Set<string>(),
    blacklistedColumnNames: new Set<string>(),
  },
}));

import { pool } from '../../src/client.js';
import {
  filterResult,
  filterColumnList,
  __clearResolvedCacheForTests,
} from '../../src/fieldFilter.js';
import { safetyConfig } from '../../src/safetyConfig.js';

function setBlacklist(entries: string[]): void {
  safetyConfig.blacklistFull.clear();
  safetyConfig.blacklistedColumnNames.clear();
  for (const e of entries) {
    safetyConfig.blacklistFull.add(e);
    const last = e.split('.').at(-1);
    if (last !== undefined) safetyConfig.blacklistedColumnNames.add(last);
  }
}

describe('filterResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    __clearResolvedCacheForTests();
    setBlacklist([]);
  });

  it('passes rows through unchanged when blacklist is empty', async () => {
    const input = {
      rows: [{ id: 1, ssn: '123-45-6789' }],
      fields: [
        { name: 'id', tableID: 100, columnID: 1, dataTypeID: 23 },
        { name: 'ssn', tableID: 100, columnID: 2, dataTypeID: 25 },
      ],
    };

    const result = await filterResult(input);

    expect(result.rows).toEqual(input.rows);
    expect(result.fields).toEqual(input.fields);
    expect(result.redactedColumns).toEqual([]);
    expect(result.unresolvedRedactions).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('drops blacklisted columns from rows and fields when resolved', async () => {
    setBlacklist(['public.users.ssn']);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        { table_id: 100, column_id: 1, schema_name: 'public', table_name: 'users', column_name: 'id' },
        { table_id: 100, column_id: 2, schema_name: 'public', table_name: 'users', column_name: 'ssn' },
      ],
      rowCount: 2,
      fields: [],
    } as Awaited<ReturnType<typeof pool.query>>);

    const result = await filterResult({
      rows: [{ id: 1, ssn: '123-45-6789' }],
      fields: [
        { name: 'id', tableID: 100, columnID: 1, dataTypeID: 23 },
        { name: 'ssn', tableID: 100, columnID: 2, dataTypeID: 25 },
      ],
    });

    expect(result.rows).toEqual([{ id: 1 }]);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]?.name).toBe('id');
    expect(result.redactedColumns).toEqual(['public.users.ssn']);
    expect(result.unresolvedRedactions).toEqual([]);
  });

  it('caches resolved field lookups across calls', async () => {
    setBlacklist(['public.users.ssn']);
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        { table_id: 100, column_id: 2, schema_name: 'public', table_name: 'users', column_name: 'ssn' },
      ],
      rowCount: 1,
      fields: [],
    } as Awaited<ReturnType<typeof pool.query>>);

    const input = {
      rows: [{ ssn: 'x' }],
      fields: [{ name: 'ssn', tableID: 100, columnID: 2, dataTypeID: 25 }],
    };

    await filterResult(input);
    await filterResult(input);

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('falls back to name matching for computed columns (tableID 0)', async () => {
    setBlacklist(['public.users.ssn']);

    const result = await filterResult({
      rows: [{ ssn: 'leaked' }],
      fields: [{ name: 'ssn', tableID: 0, columnID: 0, dataTypeID: 25 }],
    });

    expect(result.rows).toEqual([{}]);
    expect(result.fields).toHaveLength(0);
    expect(result.unresolvedRedactions).toEqual(['ssn']);
    expect(result.redactedColumns).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('does not redact a computed column whose output name differs from any blacklist entry', async () => {
    setBlacklist(['public.users.ssn']);

    const result = await filterResult({
      rows: [{ x: 'leaked' }],
      fields: [{ name: 'x', tableID: 0, columnID: 0, dataTypeID: 25 }],
    });

    expect(result.rows).toEqual([{ x: 'leaked' }]);
    expect(result.unresolvedRedactions).toEqual([]);
  });

  it('does not redact a resolved column that is not in the blacklist', async () => {
    setBlacklist(['public.users.ssn']);
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        { table_id: 100, column_id: 1, schema_name: 'public', table_name: 'users', column_name: 'email' },
      ],
      rowCount: 1,
      fields: [],
    } as Awaited<ReturnType<typeof pool.query>>);

    const result = await filterResult({
      rows: [{ email: 'a@b.c' }],
      fields: [{ name: 'email', tableID: 100, columnID: 1, dataTypeID: 25 }],
    });

    expect(result.rows).toEqual([{ email: 'a@b.c' }]);
    expect(result.redactedColumns).toEqual([]);
  });

  it('handles missing tableID/columnID gracefully as computed', async () => {
    setBlacklist(['public.users.ssn']);

    const result = await filterResult({
      rows: [{ ssn: 'x' }],
      fields: [{ name: 'ssn', dataTypeID: 25 }],
    });

    expect(result.rows).toEqual([{}]);
    expect(result.unresolvedRedactions).toEqual(['ssn']);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('filterColumnList', () => {
  beforeEach(() => {
    setBlacklist([]);
  });

  it('passes columns through unchanged when blacklist is empty', () => {
    const cols = [{ column_name: 'id' }, { column_name: 'ssn' }];
    expect(filterColumnList(cols, 'public', 'users')).toEqual(cols);
  });

  it('drops blacklisted columns for the matching schema.table', () => {
    setBlacklist(['public.users.ssn']);
    const cols = [{ column_name: 'id' }, { column_name: 'ssn' }, { column_name: 'email' }];
    expect(filterColumnList(cols, 'public', 'users')).toEqual([
      { column_name: 'id' },
      { column_name: 'email' },
    ]);
  });

  it('does not drop the same column name from a different table', () => {
    setBlacklist(['public.users.ssn']);
    const cols = [{ column_name: 'ssn' }];
    expect(filterColumnList(cols, 'public', 'dependents')).toEqual(cols);
  });
});
