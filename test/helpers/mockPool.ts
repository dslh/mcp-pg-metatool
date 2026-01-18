/**
 * PostgreSQL pool mock factory for testing
 * Creates mock Pool objects with configurable query responses
 */

import { vi, type MockedFunction } from 'vitest';

export interface MockQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID: number }>;
}

export interface MockPoolQuery {
  <T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<MockQueryResult<T>>;
}

export interface MockPool {
  query: MockedFunction<MockPoolQuery>;
  end: MockedFunction<() => Promise<void>>;
}

/**
 * Creates a mock PostgreSQL pool with configurable responses
 */
export function createMockPool(): MockPool {
  return {
    query: vi.fn<MockPoolQuery>().mockResolvedValue({
      rows: [],
      rowCount: 0,
      fields: [],
    }),
    end: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

/**
 * Creates a mock query result with type inference
 */
export function createMockQueryResult<T = Record<string, unknown>>(
  rows: T[],
  fields: Array<{ name: string; dataTypeID: number }> = []
): MockQueryResult<T> {
  return {
    rows,
    rowCount: rows.length,
    fields,
  };
}

/**
 * Sets up a mock pool to return specific results for queries
 */
export function setupMockPoolResponses(
  mockPool: MockPool,
  responses: Map<string | RegExp, MockQueryResult>
): void {
  mockPool.query.mockImplementation(async (query: string) => {
    for (const [pattern, result] of responses) {
      if (typeof pattern === 'string') {
        if (query.includes(pattern)) {
          return result;
        }
      } else if (pattern.test(query)) {
        return result;
      }
    }
    return { rows: [], rowCount: 0, fields: [] };
  });
}

/**
 * Creates a mock pool that throws errors for specific queries
 */
export function setupMockPoolError(
  mockPool: MockPool,
  errorMessage: string = 'Database error'
): void {
  mockPool.query.mockRejectedValue(new Error(errorMessage));
}
