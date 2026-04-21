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

  describe('describeSafetyConfig', () => {
    it('summarizes the effective state', async () => {
      process.env['READONLY_MODE'] = 'true';
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn,public.users.email';
      const { describeSafetyConfig } = await import('../../src/safetyConfig.js');
      expect(describeSafetyConfig()).toBe(
        'read-only mode ENABLED, field blacklist: 2 entries'
      );
    });

    it('uses singular "entry" for size 1', async () => {
      process.env['FIELD_BLACKLIST'] = 'public.users.ssn';
      const { describeSafetyConfig } = await import('../../src/safetyConfig.js');
      expect(describeSafetyConfig()).toBe(
        'read-only mode disabled, field blacklist: 1 entry'
      );
    });
  });
});
