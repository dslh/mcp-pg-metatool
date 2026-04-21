/**
 * Tests for safety configuration parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

describe('safetyConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env['READONLY_MODE'];
    delete process.env['FIELD_BLACKLIST'];
    delete process.env['QUERY_TIMEOUT_MS'];
    delete process.env['AUTO_BLACKLIST_FROM_GRANTS'];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('readOnly parsing', () => {
    it('defaults to false when unset', async () => {
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.readOnly).toBe(false);
    });

    it('accepts "true"', async () => {
      process.env['READONLY_MODE'] = 'true';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.readOnly).toBe(true);
    });

    it('accepts "1", "yes", "on" case-insensitively', async () => {
      for (const v of ['1', 'YES', 'On', '  true  ']) {
        process.env['READONLY_MODE'] = v;
        vi.resetModules();
        const { safetyConfig } = await import('../../src/safetyConfig.js');
        expect(safetyConfig.readOnly).toBe(true);
      }
    });

    it('rejects unrelated strings', async () => {
      process.env['READONLY_MODE'] = 'maybe';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.readOnly).toBe(false);
    });
  });

  describe('FIELD_BLACKLIST parsing', () => {
    it('defaults to empty sets when unset', async () => {
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.blacklistFull.size).toBe(0);
      expect(safetyConfig.blacklistedColumnNames.size).toBe(0);
    });

    it('parses a single entry', async () => {
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.blacklistFull.has('public.users.ssn')).toBe(true);
      expect(safetyConfig.blacklistedColumnNames.has('ssn')).toBe(true);
    });

    it('parses multiple entries with trimming', async () => {
      process.env['FIELD_BLACKLIST'] =
        '  public.users.ssn , public.users.password_hash,public.payments.cc_number ';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.blacklistFull.size).toBe(3);
      expect(safetyConfig.blacklistFull.has('public.users.ssn')).toBe(true);
      expect(safetyConfig.blacklistFull.has('public.users.password_hash')).toBe(true);
      expect(safetyConfig.blacklistFull.has('public.payments.cc_number')).toBe(true);
      expect(safetyConfig.blacklistedColumnNames.has('ssn')).toBe(true);
      expect(safetyConfig.blacklistedColumnNames.has('password_hash')).toBe(true);
      expect(safetyConfig.blacklistedColumnNames.has('cc_number')).toBe(true);
    });

    it('skips empty segments from trailing commas', async () => {
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn,,,';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.blacklistFull.size).toBe(1);
    });

    it('ignores malformed entries and warns', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env['FIELD_BLACKLIST'] = 'users.ssn,public.users.password,..,public.users.';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.blacklistFull.size).toBe(1);
      expect(safetyConfig.blacklistFull.has('public.users.password')).toBe(true);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('QUERY_TIMEOUT_MS parsing', () => {
    it('defaults to null when unset', async () => {
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.queryTimeoutMs).toBeNull();
    });

    it('parses a positive integer', async () => {
      process.env['QUERY_TIMEOUT_MS'] = '30000';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.queryTimeoutMs).toBe(30000);
    });

    it('treats 0 as no timeout', async () => {
      process.env['QUERY_TIMEOUT_MS'] = '0';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.queryTimeoutMs).toBeNull();
    });

    it('rejects negative values', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env['QUERY_TIMEOUT_MS'] = '-5';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.queryTimeoutMs).toBeNull();
      expect(spy).toHaveBeenCalled();
    });

    it('rejects non-numeric values', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env['QUERY_TIMEOUT_MS'] = 'forever';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.queryTimeoutMs).toBeNull();
      expect(spy).toHaveBeenCalled();
    });

    it('rejects values with trailing garbage', async () => {
      process.env['QUERY_TIMEOUT_MS'] = '30000ms';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.queryTimeoutMs).toBeNull();
    });
  });

  describe('AUTO_BLACKLIST_FROM_GRANTS', () => {
    it('defaults to false', async () => {
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.autoFromGrants).toBe(false);
    });

    it('reads truthy values', async () => {
      process.env['AUTO_BLACKLIST_FROM_GRANTS'] = 'true';
      const { safetyConfig } = await import('../../src/safetyConfig.js');
      expect(safetyConfig.autoFromGrants).toBe(true);
    });
  });

  describe('mergeBlacklistEntries', () => {
    it('adds new entries and returns the count', async () => {
      const { safetyConfig, mergeBlacklistEntries } = await import('../../src/safetyConfig.js');
      safetyConfig.blacklistFull.clear();
      safetyConfig.blacklistedColumnNames.clear();

      const added = mergeBlacklistEntries([
        { table_schema: 'public', table_name: 'users', column_name: 'ssn' },
        { table_schema: 'public', table_name: 'users', column_name: 'password_hash' },
      ]);

      expect(added).toBe(2);
      expect(safetyConfig.blacklistFull.has('public.users.ssn')).toBe(true);
      expect(safetyConfig.blacklistFull.has('public.users.password_hash')).toBe(true);
      expect(safetyConfig.blacklistedColumnNames.has('ssn')).toBe(true);
    });

    it('does not double-count existing entries', async () => {
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn';
      const { safetyConfig, mergeBlacklistEntries } = await import('../../src/safetyConfig.js');

      const added = mergeBlacklistEntries([
        { table_schema: 'public', table_name: 'users', column_name: 'ssn' },
        { table_schema: 'public', table_name: 'users', column_name: 'password_hash' },
      ]);

      expect(added).toBe(1);
      expect(safetyConfig.blacklistFull.size).toBe(2);
    });
  });

  describe('describeSafetyConfig', () => {
    it('summarizes the effective state', async () => {
      process.env['READONLY_MODE'] = 'true';
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn,public.users.email';
      process.env['QUERY_TIMEOUT_MS'] = '15000';
      const { describeSafetyConfig } = await import('../../src/safetyConfig.js');
      expect(describeSafetyConfig()).toBe(
        'read-only mode ENABLED, field blacklist: 2 entries, query timeout: 15000ms'
      );
    });

    it('uses singular "entry" for size 1 and "none" for absent timeout', async () => {
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn';
      const { describeSafetyConfig } = await import('../../src/safetyConfig.js');
      expect(describeSafetyConfig()).toBe(
        'read-only mode disabled, field blacklist: 1 entry, query timeout: none'
      );
    });
  });
});
