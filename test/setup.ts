/**
 * Test setup file for vitest
 * Configures global test environment and mocks
 */

import { vi } from 'vitest';

// Mock console.error to prevent logging noise during tests
// You can still inspect calls using vi.mocked(console.error) in tests if needed
vi.spyOn(console, 'error').mockImplementation(() => {});
