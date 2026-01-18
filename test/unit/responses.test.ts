/**
 * Tests for MCP response formatting utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
} from '../../src/responses.js';
import { expectSuccessResponse, expectErrorResponse, getResponseText } from '../helpers/mcpTestUtils.js';

describe('createSuccessResponse', () => {
  it('creates response with text content', () => {
    const response = createSuccessResponse('Operation completed');

    expectSuccessResponse(response);
    expect(getResponseText(response)).toBe('Operation completed');
  });

  it('creates response without isError flag', () => {
    const response = createSuccessResponse('Success');

    expect(response.isError).toBeUndefined();
  });

  it('handles empty string message', () => {
    const response = createSuccessResponse('');

    expect(response.content[0]?.text).toBe('');
  });

  it('handles message with special characters', () => {
    const message = 'Result: {"count": 10, "items": ["a", "b"]}';
    const response = createSuccessResponse(message);

    expect(getResponseText(response)).toBe(message);
  });

  it('handles multiline message', () => {
    const message = 'Line 1\nLine 2\nLine 3';
    const response = createSuccessResponse(message);

    expect(getResponseText(response)).toBe(message);
  });
});

describe('createErrorResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('creates response with isError flag', () => {
    const response = createErrorResponse('test operation', new Error('Something went wrong'));

    expectErrorResponse(response);
    expect(response.isError).toBe(true);
  });

  it('includes operation name in error message', () => {
    const response = createErrorResponse('saving data', new Error('Database error'));

    expect(getResponseText(response)).toContain('saving data');
  });

  it('includes error message in response', () => {
    const response = createErrorResponse('operation', new Error('Specific error message'));

    expect(getResponseText(response)).toContain('Specific error message');
  });

  it('handles Error objects', () => {
    const error = new Error('Test error');
    const response = createErrorResponse('operation', error);

    expect(getResponseText(response)).toContain('Test error');
  });

  it('handles string errors', () => {
    const response = createErrorResponse('operation', 'String error');

    expect(getResponseText(response)).toContain('Unknown error');
  });

  it('handles null errors', () => {
    const response = createErrorResponse('operation', null);

    expect(getResponseText(response)).toContain('Unknown error');
  });

  it('handles undefined errors', () => {
    const response = createErrorResponse('operation', undefined);

    expect(getResponseText(response)).toContain('Unknown error');
  });

  it('logs error to console.error', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    createErrorResponse('test', new Error('logged error'));

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('logged error'));
  });
});

describe('withErrorHandling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('synchronous functions', () => {
    it('wraps successful sync function in success response', () => {
      const response = withErrorHandling('sync operation', () => 'Success result');

      expectSuccessResponse(response);
      expect(getResponseText(response)).toBe('Success result');
    });

    it('wraps sync errors in error response', () => {
      const response = withErrorHandling('failing operation', () => {
        throw new Error('Sync error');
      });

      expectErrorResponse(response, 'Sync error');
    });

    it('includes stage in error message when logger is used', () => {
      const response = withErrorHandling('operation', (log) => {
        log('processing data');
        throw new Error('Failed during processing');
      });

      expect(getResponseText(response)).toContain('while processing data');
    });

    it('updates stage as logger is called multiple times', () => {
      const response = withErrorHandling('operation', (log) => {
        log('step 1');
        log('step 2');
        log('step 3');
        throw new Error('Failed');
      });

      // Should contain the last logged stage
      expect(getResponseText(response)).toContain('while step 3');
    });
  });

  describe('asynchronous functions', () => {
    it('wraps successful async function in success response', async () => {
      const response = await withErrorHandling('async operation', async () => {
        return 'Async result';
      });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toBe('Async result');
    });

    it('wraps async errors in error response', async () => {
      const response = await withErrorHandling('async operation', async () => {
        throw new Error('Async error');
      });

      expectErrorResponse(response, 'Async error');
    });

    it('handles rejected promises', async () => {
      const response = await withErrorHandling('async operation', () => {
        return Promise.reject(new Error('Rejected'));
      });

      expectErrorResponse(response, 'Rejected');
    });

    it('includes stage in async error message', async () => {
      const response = await withErrorHandling('async operation', async (log) => {
        log('fetching data');
        throw new Error('Network error');
      });

      expect(getResponseText(response)).toContain('while fetching data');
    });

    it('handles async functions that use await', async () => {
      const response = await withErrorHandling('async operation', async (log) => {
        log('starting');
        await Promise.resolve();
        log('completed');
        return 'Done';
      });

      expectSuccessResponse(response);
      expect(getResponseText(response)).toBe('Done');
    });
  });

  describe('logging behavior', () => {
    it('logs start of operation', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      withErrorHandling('test operation', () => 'result');

      expect(consoleSpy).toHaveBeenCalledWith('Started test operation');
    });

    it('logs end of successful sync operation', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      withErrorHandling('test operation', () => 'result');

      expect(consoleSpy).toHaveBeenCalledWith('Finished test operation');
    });

    it('logs end of failed sync operation', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      withErrorHandling('test operation', () => {
        throw new Error('error');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Finished test operation');
    });

    it('logs messages from logger function', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      withErrorHandling('test', (log) => {
        log('custom log message');
        return 'result';
      });

      expect(consoleSpy).toHaveBeenCalledWith('custom log message');
    });

    it('logs end of successful async operation', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      await withErrorHandling('async test', async () => 'result');

      expect(consoleSpy).toHaveBeenCalledWith('Finished async test');
    });

    it('logs end of failed async operation', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      await withErrorHandling('async test', async () => {
        throw new Error('error');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Finished async test');
    });
  });
});
