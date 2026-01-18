/**
 * Tests for JSON Schema validation and Zod conversion
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateJsonSchema,
  convertJsonSchemaToZod,
  convertJsonSchemaToMcpZod,
} from '../../src/jsonSchemaValidator.js';
import { schemas } from '../helpers/fixtures.js';

describe('validateJsonSchema', () => {
  describe('valid schemas', () => {
    it('accepts empty object schema', () => {
      expect(validateJsonSchema(schemas.empty)).toBe(true);
    });

    it('accepts schema with string property', () => {
      expect(validateJsonSchema(schemas.singleString)).toBe(true);
    });

    it('accepts schema with integer property', () => {
      expect(validateJsonSchema(schemas.singleInteger)).toBe(true);
    });

    it('accepts schema with multiple properties', () => {
      expect(validateJsonSchema(schemas.multipleParams)).toBe(true);
    });

    it('accepts schema with defaults', () => {
      expect(validateJsonSchema(schemas.withDefaults)).toBe(true);
    });

    it('accepts schema with nested objects', () => {
      expect(validateJsonSchema(schemas.nestedObject)).toBe(true);
    });

    it('accepts schema with arrays', () => {
      expect(validateJsonSchema(schemas.withArray)).toBe(true);
    });

    it('accepts complex real-world schema', () => {
      const schema = {
        type: 'object',
        properties: {
          user_id: { type: 'integer', description: 'The user ID' },
          include_inactive: { type: 'boolean', default: false },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        },
        required: ['user_id'],
      };
      expect(validateJsonSchema(schema)).toBe(true);
    });
  });

  describe('invalid schemas', () => {
    it('rejects null', () => {
      expect(validateJsonSchema(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(validateJsonSchema(undefined)).toBe(false);
    });

    it('rejects string', () => {
      expect(validateJsonSchema('not a schema')).toBe(false);
    });

    it('rejects number', () => {
      expect(validateJsonSchema(42)).toBe(false);
    });

    it('rejects array', () => {
      expect(validateJsonSchema([1, 2, 3])).toBe(false);
    });

    it('rejects schema with invalid type', () => {
      const schema = {
        type: 'invalid_type',
        properties: {},
      };
      expect(validateJsonSchema(schema)).toBe(false);
    });
  });
});

describe('convertJsonSchemaToZod', () => {
  describe('type conversion', () => {
    it('converts string type', () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } } };
      const zodSchema = convertJsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ name: 'test' });
      expect(result.success).toBe(true);

      const invalidResult = zodSchema.safeParse({ name: 123 });
      expect(invalidResult.success).toBe(false);
    });

    it('converts number type', () => {
      const schema = { type: 'object', properties: { value: { type: 'number' } } };
      const zodSchema = convertJsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ value: 3.14 });
      expect(result.success).toBe(true);
    });

    it('converts integer type', () => {
      const schema = { type: 'object', properties: { count: { type: 'integer' } } };
      const zodSchema = convertJsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ count: 42 });
      expect(result.success).toBe(true);
    });

    it('converts boolean type', () => {
      const schema = { type: 'object', properties: { active: { type: 'boolean' } } };
      const zodSchema = convertJsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ active: true });
      expect(result.success).toBe(true);
    });

    it('converts array type', () => {
      const schema = {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'string' } },
        },
      };
      const zodSchema = convertJsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ items: ['a', 'b', 'c'] });
      expect(result.success).toBe(true);
    });
  });

  describe('required fields', () => {
    it('validates required fields', () => {
      const zodSchema = convertJsonSchemaToZod(schemas.singleString);

      const validResult = zodSchema.safeParse({ name: 'test' });
      expect(validResult.success).toBe(true);

      const invalidResult = zodSchema.safeParse({});
      expect(invalidResult.success).toBe(false);
    });

    it('allows optional fields to be missing', () => {
      const schema = {
        type: 'object',
        properties: {
          required_field: { type: 'string' },
          optional_field: { type: 'string' },
        },
        required: ['required_field'],
      };
      const zodSchema = convertJsonSchemaToZod(schema);

      const result = zodSchema.safeParse({ required_field: 'test' });
      expect(result.success).toBe(true);
    });
  });

  describe('default values', () => {
    it('applies default values for missing optional fields', () => {
      const zodSchema = convertJsonSchemaToZod(schemas.withDefaults);

      const result = zodSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ limit: 10, offset: 0 });
      }
    });
  });
});

describe('convertJsonSchemaToZod - edge cases', () => {
  it('handles schema with unknown type (fallback)', () => {
    const schema = {
      type: 'object',
      properties: {
        custom: { type: 'custom_type' },  // Unknown type
      },
    };
    const zodSchema = convertJsonSchemaToZod(schema);

    // Should still create a schema (uses z.any() for unknown type)
    const result = zodSchema.safeParse({ custom: 'anything' });
    expect(result.success).toBe(true);
  });

  it('handles array without items definition', () => {
    const schema = {
      type: 'object',
      properties: {
        list: { type: 'array' },  // No items specified
      },
    };
    const zodSchema = convertJsonSchemaToZod(schema);

    const result = zodSchema.safeParse({ list: [1, 'two', true] });
    expect(result.success).toBe(true);
  });

  it('handles deeply nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
            },
          },
        },
      },
    };
    const zodSchema = convertJsonSchemaToZod(schema);

    const result = zodSchema.safeParse({
      level1: { level2: { value: 'test' } },
    });
    expect(result.success).toBe(true);
  });

  it('handles schema without type property', () => {
    const schema = {
      properties: {
        value: { type: 'string' },
      },
    };
    const zodSchema = convertJsonSchemaToZod(schema);

    // Should still parse without error
    expect(zodSchema).toBeDefined();
  });

  it('handles empty properties', () => {
    const schema = {
      type: 'object',
    };
    const zodSchema = convertJsonSchemaToZod(schema);

    const result = zodSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('convertJsonSchemaToMcpZod', () => {
  it('returns empty object for empty schema', () => {
    const result = convertJsonSchemaToMcpZod(schemas.empty);
    expect(result).toEqual({});
  });

  it('converts single string property', () => {
    const result = convertJsonSchemaToMcpZod(schemas.singleString);
    expect(result).toHaveProperty('name');
    expect(result.name).toBeInstanceOf(z.ZodString);
  });

  it('converts single integer property', () => {
    const result = convertJsonSchemaToMcpZod(schemas.singleInteger);
    expect(result).toHaveProperty('id');
  });

  it('converts multiple properties', () => {
    const result = convertJsonSchemaToMcpZod(schemas.multipleParams);
    expect(Object.keys(result)).toEqual(['id', 'name', 'active']);
  });

  it('applies required constraint', () => {
    const result = convertJsonSchemaToMcpZod(schemas.singleString);
    const nameSchema = result.name as z.ZodString;

    // Required fields should not be optional
    const parseResult = nameSchema.safeParse(undefined);
    expect(parseResult.success).toBe(false);
  });

  it('applies optional constraint for non-required fields', () => {
    const schema = {
      type: 'object',
      properties: {
        optional_field: { type: 'string' },
      },
      // No required array, so field is optional
    };
    const result = convertJsonSchemaToMcpZod(schema);

    // Optional fields should accept undefined
    const parseResult = result.optional_field?.safeParse(undefined);
    expect(parseResult?.success).toBe(true);
  });

  it('applies default values', () => {
    const result = convertJsonSchemaToMcpZod(schemas.withDefaults);

    const limitSchema = result.limit;
    const parseResult = limitSchema?.safeParse(undefined);
    expect(parseResult?.success).toBe(true);
    if (parseResult?.success) {
      expect(parseResult.data).toBe(10);
    }
  });

  it('handles non-object schemas gracefully', () => {
    const schema = { type: 'string' };
    const result = convertJsonSchemaToMcpZod(schema);
    expect(result).toEqual({});
  });

  it('handles array type properties', () => {
    const result = convertJsonSchemaToMcpZod(schemas.withArray);
    expect(result).toHaveProperty('ids');
  });

  it('handles number type property', () => {
    const schema = {
      type: 'object',
      properties: {
        price: { type: 'number' },
      },
      required: ['price'],
    };
    const result = convertJsonSchemaToMcpZod(schema);
    expect(result).toHaveProperty('price');

    const parseResult = result.price?.safeParse(3.14);
    expect(parseResult?.success).toBe(true);
  });

  it('handles boolean type property', () => {
    const schema = {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
      },
      required: ['active'],
    };
    const result = convertJsonSchemaToMcpZod(schema);
    expect(result).toHaveProperty('active');

    const parseResult = result.active?.safeParse(true);
    expect(parseResult?.success).toBe(true);
  });

  it('handles unknown type as any', () => {
    const schema = {
      type: 'object',
      properties: {
        custom: { type: 'custom' },
      },
    };
    const result = convertJsonSchemaToMcpZod(schema);
    expect(result).toHaveProperty('custom');

    // Unknown types become z.any() which accepts anything
    const parseResult = result.custom?.safeParse({ anything: true });
    expect(parseResult?.success).toBe(true);
  });

  it('handles array without items', () => {
    const schema = {
      type: 'object',
      properties: {
        list: { type: 'array' },
      },
    };
    const result = convertJsonSchemaToMcpZod(schema);
    expect(result).toHaveProperty('list');
  });

  it('handles array with nested items', () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'integer' },
        },
      },
    };
    const result = convertJsonSchemaToMcpZod(schema);
    expect(result).toHaveProperty('items');
  });
});
