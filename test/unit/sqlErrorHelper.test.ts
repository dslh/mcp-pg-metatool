/**
 * Tests for SQL error augmentation
 */

import { describe, it, expect } from 'vitest';

import { augmentSqlError } from '../../src/sqlErrorHelper.js';

describe('augmentSqlError', () => {
  it('passes through errors without a known SQLSTATE', () => {
    const original = new Error('syntax error at or near "SELEC"');
    const result = augmentSqlError(original);
    expect(result).toBe(original);
  });

  it('passes through PG errors whose code is not 42501', () => {
    const original = new Error('relation does not exist');
    (original as Error & { code?: string }).code = '42P01';
    const result = augmentSqlError(original);
    expect(result).toBe(original);
  });

  it('augments 42501 errors with a SELECT * recovery hint', () => {
    const original = new Error('permission denied for column "ssn" of relation "users"');
    (original as Error & { code?: string }).code = '42501';

    const result = augmentSqlError(original);

    expect(result).not.toBe(original);
    expect(result.message).toContain('permission denied for column "ssn"');
    expect(result.message).toContain('describe_table');
    expect(result.message).toContain('SELECT *');
  });

  it('preserves the original stack on augmented errors', () => {
    const original = new Error('permission denied');
    (original as Error & { code?: string }).code = '42501';

    const result = augmentSqlError(original);

    expect(result.stack).toBe(original.stack);
  });

  it('wraps non-Error values into an Error', () => {
    const result = augmentSqlError('something weird');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('something weird');
  });
});
