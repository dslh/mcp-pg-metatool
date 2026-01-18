/**
 * Tests for PostgreSQL client configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env values
const originalEnv = { ...process.env };

describe('client configuration', () => {
  beforeEach(() => {
    // Reset modules to allow reimporting with different env vars
    vi.resetModules();

    // Clear all PG-related env vars
    delete process.env['DATABASE_URL'];
    delete process.env['PGDATABASE'];
    delete process.env['PGHOST'];
    delete process.env['PGPORT'];
    delete process.env['PGUSER'];
    delete process.env['PGPASSWORD'];
    delete process.env['PG_POOL_MAX'];
    delete process.env['PGSSLMODE'];
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('DATABASE_URL configuration', () => {
    it('uses DATABASE_URL when provided', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['DATABASE_URL'] = 'postgresql://user:pass@host:5432/db';

      // Dynamic import to pick up mocked module
      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@host:5432/db',
        })
      );
    });

    it('uses default pool max of 10', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['DATABASE_URL'] = 'postgresql://localhost/test';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 10,
        })
      );
    });

    it('uses custom PG_POOL_MAX when provided', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['DATABASE_URL'] = 'postgresql://localhost/test';
      process.env['PG_POOL_MAX'] = '25';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 25,
        })
      );
    });
  });

  describe('SSL configuration', () => {
    it('enables SSL when PGSSLMODE is set', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['DATABASE_URL'] = 'postgresql://localhost/test';
      process.env['PGSSLMODE'] = 'require';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        })
      );
    });

    it('disables SSL when PGSSLMODE is "disable"', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['DATABASE_URL'] = 'postgresql://localhost/test';
      process.env['PGSSLMODE'] = 'disable';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: undefined,
        })
      );
    });
  });

  describe('individual PG variables configuration', () => {
    it('uses individual env vars when DATABASE_URL not provided', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['PGDATABASE'] = 'mydb';
      process.env['PGHOST'] = 'myhost';
      process.env['PGPORT'] = '5433';
      process.env['PGUSER'] = 'myuser';
      process.env['PGPASSWORD'] = 'mypass';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'myhost',
          port: 5433,
          database: 'mydb',
          user: 'myuser',
          password: 'mypass',
        })
      );
    });

    it('uses default host when PGHOST not provided', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['PGDATABASE'] = 'mydb';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
        })
      );
    });

    it('uses default port when PGPORT not provided', async () => {
      const mockPool = vi.fn();
      vi.doMock('pg', () => ({
        Pool: mockPool.mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['PGDATABASE'] = 'mydb';

      await import('../../src/client.js');

      expect(mockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5432,
        })
      );
    });
  });

  describe('error handling', () => {
    it('throws error when no database configuration provided', async () => {
      vi.doMock('pg', () => ({
        Pool: vi.fn().mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      // No DATABASE_URL and no PGDATABASE
      await expect(import('../../src/client.js')).rejects.toThrow(
        'DATABASE_URL or PGDATABASE environment variable is required'
      );
    });

    it('throws error when DATABASE_URL is empty string', async () => {
      vi.doMock('pg', () => ({
        Pool: vi.fn().mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['DATABASE_URL'] = '   '; // whitespace only

      await expect(import('../../src/client.js')).rejects.toThrow(
        'DATABASE_URL or PGDATABASE environment variable is required'
      );
    });

    it('throws error when PGDATABASE is empty string', async () => {
      vi.doMock('pg', () => ({
        Pool: vi.fn().mockImplementation(() => ({
          query: vi.fn(),
          end: vi.fn(),
        })),
      }));

      process.env['PGDATABASE'] = '   '; // whitespace only

      await expect(import('../../src/client.js')).rejects.toThrow(
        'DATABASE_URL or PGDATABASE environment variable is required'
      );
    });
  });
});
