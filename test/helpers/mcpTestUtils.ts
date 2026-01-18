/**
 * MCP response assertion helpers
 */

import { expect } from 'vitest';
import type { MCPResponse } from '../../src/responses.js';

/**
 * Asserts that a response is a success response (no isError flag)
 */
export function expectSuccessResponse(response: MCPResponse): void {
  expect(response.isError).toBeFalsy();
  expect(response.content).toHaveLength(1);
  expect(response.content[0]).toHaveProperty('type', 'text');
  expect(response.content[0]).toHaveProperty('text');
}

/**
 * Asserts that a response is an error response
 */
export function expectErrorResponse(response: MCPResponse, expectedError?: string | RegExp): void {
  expect(response.isError).toBe(true);
  expect(response.content).toHaveLength(1);
  expect(response.content[0]).toHaveProperty('type', 'text');

  if (expectedError) {
    const text = response.content[0]?.text ?? '';
    if (typeof expectedError === 'string') {
      expect(text).toContain(expectedError);
    } else {
      expect(text).toMatch(expectedError);
    }
  }
}

/**
 * Extracts the text content from an MCP response
 */
export function getResponseText(response: MCPResponse): string {
  return response.content[0]?.text ?? '';
}

/**
 * Parses JSON from an MCP response text
 */
export function parseResponseJson<T = unknown>(response: MCPResponse): T {
  const text = getResponseText(response);
  return JSON.parse(text) as T;
}

/**
 * Extracts JSON from a response that includes markdown code blocks
 */
export function parseResponseJsonFromCodeBlock<T = unknown>(response: MCPResponse): T {
  const text = getResponseText(response);
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch || !jsonMatch[1]) {
    throw new Error('No JSON code block found in response');
  }
  return JSON.parse(jsonMatch[1]) as T;
}

/**
 * Asserts response contains expected text content
 */
export function expectResponseContains(response: MCPResponse, expectedText: string): void {
  const text = getResponseText(response);
  expect(text).toContain(expectedText);
}

/**
 * Asserts response text matches a pattern
 */
export function expectResponseMatches(response: MCPResponse, pattern: RegExp): void {
  const text = getResponseText(response);
  expect(text).toMatch(pattern);
}

/**
 * Creates a mock MCP success response for testing
 */
export function createMockSuccessResponse(text: string): MCPResponse {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Creates a mock MCP error response for testing
 */
export function createMockErrorResponse(text: string): MCPResponse {
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}
