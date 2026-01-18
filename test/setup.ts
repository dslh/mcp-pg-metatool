/**
 * Test setup file for vitest
 * Configures global test environment and mocks
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Set test environment variables
process.env['PGDATABASE'] = 'test_db';
process.env['PGHOST'] = 'localhost';
process.env['PGPORT'] = '5432';
process.env['PGUSER'] = 'test_user';
process.env['PGPASSWORD'] = 'test_password';
process.env['MCP_PG_DATA_DIR'] = '/tmp/mcp-pg-test-data';

// Mock console.error to prevent logging noise during tests
// You can still inspect calls using vi.mocked(console.error) in tests if needed
vi.spyOn(console, 'error').mockImplementation(() => {});

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
