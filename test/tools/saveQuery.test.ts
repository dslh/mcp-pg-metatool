/**
 * Tests for save_query tool handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schemas } from '../helpers/fixtures.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

// Mock dependencies
vi.mock('../../src/storage.js', () => ({
  saveToolToFile: vi.fn(),
  loadToolFromFile: vi.fn(),
}));

vi.mock('../../src/server.js', () => ({
  server: {
    registerTool: vi.fn().mockReturnValue({
      update: vi.fn(),
      remove: vi.fn(),
    }),
  },
  registeredTools: new Map(),
}));

import { saveToolToFile } from '../../src/storage.js';
import { server, registeredTools } from '../../src/server.js';
import { name, config, handler } from '../../src/tools/saveQuery.js';

describe('saveQuery tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    registeredTools.clear();
  });

  describe('tool configuration', () => {
    it('has correct name', () => {
      expect(name).toBe('save_query');
    });

    it('has title and description', () => {
      expect(config.title).toBe('Save Query Tool');
      expect(config.description).toContain('Create or update');
    });

    it('requires tool_name parameter', () => {
      expect(config.inputSchema.tool_name).toBeDefined();
    });

    it('requires description parameter', () => {
      expect(config.inputSchema.description).toBeDefined();
    });

    it('requires sql_query parameter', () => {
      expect(config.inputSchema.sql_query).toBeDefined();
    });

    it('requires parameter_schema parameter', () => {
      expect(config.inputSchema.parameter_schema).toBeDefined();
    });

    it('has optional overwrite parameter', () => {
      expect(config.inputSchema.overwrite).toBeDefined();
    });
  });

  describe('handler - creating new tools', () => {
    it('creates new tool successfully', async () => {
      const response = await handler({
        tool_name: 'my_query',
        description: 'Get users by ID',
        sql_query: 'SELECT * FROM users WHERE id = :user_id',
        parameter_schema: schemas.singleInteger,
      });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Successfully created');
      expect(getResponseText(response)).toContain('my_query');
    });

    it('saves tool to file', async () => {
      await handler({
        tool_name: 'my_query',
        description: 'Test query',
        sql_query: 'SELECT 1',
        parameter_schema: schemas.empty,
      });

      expect(saveToolToFile).toHaveBeenCalledWith(
        'my_query',
        expect.objectContaining({
          name: 'my_query',
          description: 'Test query',
          sql_query: 'SELECT 1',
        })
      );
    });

    it('registers tool with server', async () => {
      await handler({
        tool_name: 'my_query',
        description: 'Test query',
        sql_query: 'SELECT 1',
        parameter_schema: schemas.empty,
      });

      expect(server.registerTool).toHaveBeenCalledWith(
        'my_query',
        expect.objectContaining({
          description: 'Test query',
        }),
        expect.any(Function)
      );
    });

    it('parses named parameters from SQL', async () => {
      await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT * FROM t WHERE a = :first AND b = :second',
        parameter_schema: schemas.empty,
      });

      expect(saveToolToFile).toHaveBeenCalledWith(
        'my_query',
        expect.objectContaining({
          sql_prepared: 'SELECT * FROM t WHERE a = $1 AND b = $2',
          parameter_order: ['first', 'second'],
        })
      );
    });

    it('reports number of parameters', async () => {
      const response = await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT * FROM t WHERE a = :x AND b = :y AND c = :z',
        parameter_schema: schemas.empty,
      });

      expect(getResponseText(response)).toContain('3 parameters');
      expect(getResponseText(response)).toContain('x, y, z');
    });

    it('handles single parameter grammar', async () => {
      const response = await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT * FROM t WHERE id = :id',
        parameter_schema: schemas.singleInteger,
      });

      expect(getResponseText(response)).toContain('1 parameter');
    });

    it('handles no parameters', async () => {
      const response = await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT * FROM t',
        parameter_schema: schemas.empty,
      });

      expect(getResponseText(response)).toContain('0 parameters');
      expect(getResponseText(response)).toContain('none');
    });
  });

  describe('handler - updating existing tools', () => {
    it('fails without overwrite flag when tool exists', async () => {
      const mockTool = { update: vi.fn(), remove: vi.fn() };
      registeredTools.set('existing_tool', mockTool as never);

      const response = await handler({
        tool_name: 'existing_tool',
        description: 'Test',
        sql_query: 'SELECT 1',
        parameter_schema: schemas.empty,
        overwrite: false,
      });

      expectErrorResponse(response, 'already exists');
    });

    it('updates tool with overwrite flag', async () => {
      const mockTool = { update: vi.fn(), remove: vi.fn() };
      registeredTools.set('existing_tool', mockTool as never);

      const response = await handler({
        tool_name: 'existing_tool',
        description: 'Updated description',
        sql_query: 'SELECT 2',
        parameter_schema: schemas.empty,
        overwrite: true,
      });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toContain('Successfully updated');
      expect(mockTool.update).toHaveBeenCalled();
    });
  });

  describe('handler - validation', () => {
    it('validates parameter schema is valid JSON Schema', async () => {
      const response = await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT 1',
        parameter_schema: { type: 'invalid_type' },
      });

      expectErrorResponse(response, 'Invalid parameter_schema');
    });

    it('accepts valid JSON Schema', async () => {
      const response = await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT * FROM t WHERE id = :id',
        parameter_schema: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'User ID' },
          },
          required: ['id'],
        },
      });

      expectSuccessResponse(response);
    });
  });

  describe('handler - error handling', () => {
    it('handles file save errors', async () => {
      vi.mocked(saveToolToFile).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const response = await handler({
        tool_name: 'my_query',
        description: 'Test',
        sql_query: 'SELECT 1',
        parameter_schema: schemas.empty,
      });

      expectErrorResponse(response, 'Disk full');
    });
  });
});
