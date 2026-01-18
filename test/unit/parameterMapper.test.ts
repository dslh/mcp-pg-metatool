/**
 * Tests for SQL parameter mapping utilities
 * Covers :named to $N positional parameter conversion
 */

import { describe, it, expect } from 'vitest';
import {
  parseNamedParameters,
  mapToPositional,
  extractNamedParameters,
} from '../../src/parameterMapper.js';
import { sqlPatterns } from '../helpers/fixtures.js';

describe('parseNamedParameters', () => {
  describe('basic parameter conversion', () => {
    it('returns unchanged SQL when no parameters present', () => {
      const result = parseNamedParameters(sqlPatterns.noParams);
      expect(result.sql).toBe('SELECT * FROM users');
      expect(result.parameterOrder).toEqual([]);
    });

    it('converts single parameter to $1', () => {
      const result = parseNamedParameters(sqlPatterns.singleParam);
      expect(result.sql).toBe('SELECT * FROM users WHERE id = $1');
      expect(result.parameterOrder).toEqual(['user_id']);
    });

    it('converts multiple parameters to sequential positions', () => {
      const result = parseNamedParameters(sqlPatterns.multipleParams);
      expect(result.sql).toBe('SELECT * FROM users WHERE id = $1 AND status = $2');
      expect(result.parameterOrder).toEqual(['user_id', 'status']);
    });
  });

  describe('duplicate parameter handling', () => {
    it('reuses the same positional parameter for duplicates', () => {
      const result = parseNamedParameters(sqlPatterns.duplicateParam);
      expect(result.sql).toBe('SELECT * FROM users WHERE id = $1 OR other_id = $1');
      expect(result.parameterOrder).toEqual(['id']);
    });

    it('handles mixed duplicate and unique parameters', () => {
      const sql = 'SELECT * FROM t WHERE a = :x AND b = :y AND c = :x AND d = :z';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $1 AND d = $3');
      expect(result.parameterOrder).toEqual(['x', 'y', 'z']);
    });
  });

  describe('PostgreSQL type cast handling', () => {
    it('does not match :: type casts as parameters', () => {
      const result = parseNamedParameters(sqlPatterns.typeCast);
      expect(result.sql).toBe('SELECT created_at::date FROM users WHERE id = $1');
      expect(result.parameterOrder).toEqual(['user_id']);
    });

    it('handles multiple type casts in same query', () => {
      const result = parseNamedParameters(sqlPatterns.multipleTypeCasts);
      expect(result.sql).toBe('SELECT created_at::date, updated_at::timestamp FROM users WHERE id = $1::int');
      expect(result.parameterOrder).toEqual(['id']);
    });

    it('handles type cast immediately after parameter', () => {
      const sql = 'SELECT * FROM users WHERE id = :user_id::integer';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT * FROM users WHERE id = $1::integer');
      expect(result.parameterOrder).toEqual(['user_id']);
    });

    it('handles array type casts', () => {
      const sql = 'SELECT * FROM users WHERE id = ANY(:ids::int[])';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT * FROM users WHERE id = ANY($1::int[])');
      expect(result.parameterOrder).toEqual(['ids']);
    });
  });

  describe('parameter name edge cases', () => {
    it('handles underscore prefix in parameter names', () => {
      const result = parseNamedParameters(sqlPatterns.underscorePrefix);
      expect(result.sql).toBe('SELECT * FROM users WHERE id = $1');
      expect(result.parameterOrder).toEqual(['_private_id']);
    });

    it('handles numbers in parameter names', () => {
      const result = parseNamedParameters(sqlPatterns.numbersInName);
      expect(result.sql).toBe('SELECT * FROM users WHERE type = $1 AND subtype = $2');
      expect(result.parameterOrder).toEqual(['type1', 'type2']);
    });

    it('handles long parameter names', () => {
      const sql = 'SELECT * FROM t WHERE col = :very_long_parameter_name_with_many_underscores';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT * FROM t WHERE col = $1');
      expect(result.parameterOrder).toEqual(['very_long_parameter_name_with_many_underscores']);
    });

    it('handles single letter parameter names', () => {
      const sql = 'SELECT * FROM t WHERE a = :x AND b = :y';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT * FROM t WHERE a = $1 AND b = $2');
      expect(result.parameterOrder).toEqual(['x', 'y']);
    });

    it('rejects parameters starting with numbers', () => {
      const sql = 'SELECT * FROM t WHERE a = :123abc';
      const result = parseNamedParameters(sql);
      // Should not match :123abc since it starts with a number
      expect(result.sql).toBe('SELECT * FROM t WHERE a = :123abc');
      expect(result.parameterOrder).toEqual([]);
    });
  });

  describe('complex queries', () => {
    it('handles multi-line queries with mixed parameters and type casts', () => {
      const result = parseNamedParameters(sqlPatterns.complexQuery);
      expect(result.sql).toContain('WHERE u.status = $1');
      expect(result.sql).toContain('AND o.created_at >= $2::date');
      expect(result.sql).toContain('AND o.total > $3');
      expect(result.sql).toContain('LIMIT $4');
      expect(result.parameterOrder).toEqual(['status', 'start_date', 'min_total', 'limit']);
    });

    it('handles parameters in subqueries', () => {
      const sql = 'SELECT * FROM t WHERE id IN (SELECT id FROM s WHERE status = :status) AND type = :type';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT * FROM t WHERE id IN (SELECT id FROM s WHERE status = $1) AND type = $2');
      expect(result.parameterOrder).toEqual(['status', 'type']);
    });

    it('handles parameters in CASE expressions', () => {
      const sql = 'SELECT CASE WHEN status = :active THEN 1 WHEN status = :inactive THEN 0 END FROM t';
      const result = parseNamedParameters(sql);
      expect(result.sql).toBe('SELECT CASE WHEN status = $1 THEN 1 WHEN status = $2 THEN 0 END FROM t');
      expect(result.parameterOrder).toEqual(['active', 'inactive']);
    });
  });

  describe('edge cases with strings and comments', () => {
    it('treats parameters inside single quotes as regular parameters', () => {
      // Note: The regex doesn't handle string literals specially
      // This tests the actual behavior, not necessarily ideal behavior
      const sql = "SELECT * FROM t WHERE id = :id AND name = ':not_a_param'";
      const result = parseNamedParameters(sql);
      // Both get replaced - the regex doesn't handle quoted strings
      expect(result.parameterOrder).toContain('id');
    });
  });
});

describe('mapToPositional', () => {
  it('returns empty array for empty parameter order', () => {
    const result = mapToPositional({ x: 1, y: 2 }, []);
    expect(result).toEqual([]);
  });

  it('maps parameters in specified order', () => {
    const params = { user_id: 123, status: 'active' };
    const order = ['user_id', 'status'];
    const result = mapToPositional(params, order);
    expect(result).toEqual([123, 'active']);
  });

  it('handles different order than object keys', () => {
    const params = { a: 1, b: 2, c: 3 };
    const order = ['c', 'a', 'b'];
    const result = mapToPositional(params, order);
    expect(result).toEqual([3, 1, 2]);
  });

  it('returns undefined for missing parameters', () => {
    const params = { a: 1 };
    const order = ['a', 'b'];
    const result = mapToPositional(params, order);
    expect(result).toEqual([1, undefined]);
  });

  it('handles various value types', () => {
    const params = {
      num: 42,
      str: 'hello',
      bool: true,
      arr: [1, 2, 3],
      obj: { nested: 'value' },
      nullVal: null,
    };
    const order = ['num', 'str', 'bool', 'arr', 'obj', 'nullVal'];
    const result = mapToPositional(params, order);
    expect(result).toEqual([42, 'hello', true, [1, 2, 3], { nested: 'value' }, null]);
  });
});

describe('extractNamedParameters', () => {
  it('returns empty array for SQL without parameters', () => {
    const result = extractNamedParameters(sqlPatterns.noParams);
    expect(result).toEqual([]);
  });

  it('extracts single parameter', () => {
    const result = extractNamedParameters(sqlPatterns.singleParam);
    expect(result).toEqual(['user_id']);
  });

  it('extracts multiple unique parameters', () => {
    const result = extractNamedParameters(sqlPatterns.multipleParams);
    expect(result).toEqual(['user_id', 'status']);
  });

  it('returns unique parameters only (no duplicates)', () => {
    const result = extractNamedParameters(sqlPatterns.duplicateParam);
    expect(result).toEqual(['id']);
  });

  it('ignores type casts', () => {
    const result = extractNamedParameters(sqlPatterns.typeCast);
    expect(result).toEqual(['user_id']);
  });

  it('extracts parameters with underscores and numbers', () => {
    const sql = 'SELECT * FROM t WHERE a = :param_1 AND b = :_param2 AND c = :p3';
    const result = extractNamedParameters(sql);
    expect(result).toEqual(['param_1', '_param2', 'p3']);
  });

  it('extracts all parameters from complex query', () => {
    const result = extractNamedParameters(sqlPatterns.complexQuery);
    expect(result).toEqual(['status', 'start_date', 'min_total', 'limit']);
  });
});
