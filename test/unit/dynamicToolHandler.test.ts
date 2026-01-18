/**
 * Tests for dynamic tool handler creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSavedToolConfig, createQueryResult, dbResults } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, parseResponseJson } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/client.js', () => ({
  pool: {
    query: vi.fn(),
    end: vi.fn(),
  },
}));

vi.mock('../../src/storage.js', () => ({
  loadAllTools: vi.fn(),
}));

import { pool } from '../../src/client.js';
import { loadAllTools } from '../../src/storage.js';
import { createDynamicToolHandler, registerAllTools } from '../../src/dynamicToolHandler.js';

describe('createDynamicToolHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('parameter validation', () => {
    it('validates required parameters', async () => {
      const config = createSavedToolConfig({
        parameter_schema: {
          type: 'object',
          properties: { user_id: { type: 'integer' } },
          required: ['user_id'],
        },
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({});

      expectErrorResponse(response, 'Parameter validation error');
    });

    it('validates parameter types', async () => {
      const config = createSavedToolConfig({
        parameter_schema: {
          type: 'object',
          properties: { user_id: { type: 'integer' } },
          required: ['user_id'],
        },
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({ user_id: 'not a number' });

      expectErrorResponse(response, 'Parameter validation error');
    });

    it('accepts valid parameters', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([{ id: 1, name: 'Test' }], [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 25 },
          ]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult(dbResults.typeNames) as Awaited<ReturnType<typeof pool.query>>
        );

      const config = createSavedToolConfig({
        parameter_schema: {
          type: 'object',
          properties: { user_id: { type: 'integer' } },
          required: ['user_id'],
        },
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({ user_id: 123 });

      expectSuccessResponse(response);
    });
  });

  describe('SQL execution', () => {
    it('executes prepared SQL with positional parameters', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([], []) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
        );

      const config = createSavedToolConfig({
        sql_prepared: 'SELECT * FROM users WHERE id = $1',
        parameter_order: ['user_id'],
        parameter_schema: {
          type: 'object',
          properties: { user_id: { type: 'integer' } },
          required: ['user_id'],
        },
      });

      const handler = createDynamicToolHandler(config);
      await handler({ user_id: 42 });

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [42]
      );
    });

    it('maps parameters in correct order', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([], []) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([]) as Awaited<ReturnType<typeof pool.query>>
        );

      const config = createSavedToolConfig({
        sql_prepared: 'SELECT * FROM t WHERE a = $1 AND b = $2',
        parameter_order: ['first', 'second'],
        parameter_schema: {
          type: 'object',
          properties: {
            first: { type: 'string' },
            second: { type: 'integer' },
          },
          required: ['first', 'second'],
        },
      });

      const handler = createDynamicToolHandler(config);
      await handler({ second: 456, first: 'hello' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['hello', 456]
      );
    });
  });

  describe('response formatting', () => {
    it('returns rows, rowCount, and fields', async () => {
      const rows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      const fields = [
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 25 },
      ];

      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult(rows, fields) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([
            { oid: 23, typname: 'int4' },
            { oid: 25, typname: 'text' },
          ]) as Awaited<ReturnType<typeof pool.query>>
        );

      const config = createSavedToolConfig({
        parameter_schema: { type: 'object', properties: {} },
        parameter_order: [],
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({});

      const result = parseResponseJson<{
        rows: typeof rows;
        rowCount: number;
        fields: Array<{ name: string; dataType: string }>;
      }>(response);

      expect(result.rows).toEqual(rows);
      expect(result.rowCount).toBe(2);
      expect(result.fields).toHaveLength(2);
    });

    it('resolves type names for fields', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([{ value: 42 }], [{ name: 'value', dataTypeID: 23 }]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([{ oid: 23, typname: 'int4' }]) as Awaited<ReturnType<typeof pool.query>>
        );

      const config = createSavedToolConfig({
        parameter_schema: { type: 'object', properties: {} },
        parameter_order: [],
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({});

      const result = parseResponseJson<{
        fields: Array<{ name: string; dataType: string }>;
      }>(response);

      expect(result.fields[0]?.dataType).toBe('int4');
    });

    it('uses "unknown" for unresolved type names', async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce(
          createQueryResult([{ value: 42 }], [{ name: 'value', dataTypeID: 99999 }]) as Awaited<ReturnType<typeof pool.query>>
        )
        .mockResolvedValueOnce(
          createQueryResult([]) as Awaited<ReturnType<typeof pool.query>> // No type found
        );

      const config = createSavedToolConfig({
        parameter_schema: { type: 'object', properties: {} },
        parameter_order: [],
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({});

      const result = parseResponseJson<{
        fields: Array<{ name: string; dataType: string }>;
      }>(response);

      expect(result.fields[0]?.dataType).toBe('unknown');
    });
  });

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      vi.mocked(pool.query).mockRejectedValue(new Error('Connection refused'));

      const config = createSavedToolConfig({
        parameter_schema: { type: 'object', properties: {} },
        parameter_order: [],
      });

      const handler = createDynamicToolHandler(config);
      const response = await handler({});

      expectErrorResponse(response, 'Connection refused');
    });
  });
});

describe('registerAllTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when no saved tools exist', () => {
    vi.mocked(loadAllTools).mockReturnValue(new Map());

    const mockServer = {
      registerTool: vi.fn(),
    };

    const result = registerAllTools(mockServer as never);

    expect(result.size).toBe(0);
    expect(mockServer.registerTool).not.toHaveBeenCalled();
  });

  it('registers all loaded tools with server', () => {
    const tools = new Map([
      ['tool1', createSavedToolConfig({ name: 'tool1', description: 'Tool 1' })],
      ['tool2', createSavedToolConfig({ name: 'tool2', description: 'Tool 2' })],
    ]);
    vi.mocked(loadAllTools).mockReturnValue(tools);

    const mockRegisteredTool = { update: vi.fn(), remove: vi.fn() };
    const mockServer = {
      registerTool: vi.fn().mockReturnValue(mockRegisteredTool),
    };

    const result = registerAllTools(mockServer as never);

    expect(result.size).toBe(2);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'tool1',
      expect.objectContaining({ description: 'Tool 1' }),
      expect.any(Function)
    );
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'tool2',
      expect.objectContaining({ description: 'Tool 2' }),
      expect.any(Function)
    );
  });

  it('creates dynamic handlers with correct config', () => {
    const toolConfig = createSavedToolConfig({
      name: 'my_tool',
      sql_prepared: 'SELECT 1',
    });
    vi.mocked(loadAllTools).mockReturnValue(new Map([['my_tool', toolConfig]]));

    const mockRegisteredTool = { update: vi.fn(), remove: vi.fn() };
    const mockServer = {
      registerTool: vi.fn().mockReturnValue(mockRegisteredTool),
    };

    registerAllTools(mockServer as never);

    // Verify handler was passed
    const handlerArg = mockServer.registerTool.mock.calls[0]?.[2];
    expect(typeof handlerArg).toBe('function');
  });
});
