/**
 * Utility functions for converting between named parameters (:param_name)
 * and PostgreSQL positional parameters ($1, $2, etc.)
 */

export interface ParameterMapping {
  sql: string;
  parameterOrder: string[];
}

/**
 * Converts SQL with :named parameters to PostgreSQL $N positional syntax.
 *
 * Input:  "SELECT * FROM users WHERE id = :user_id AND status = :status"
 * Output: {
 *   sql: "SELECT * FROM users WHERE id = $1 AND status = $2",
 *   parameterOrder: ["user_id", "status"]
 * }
 *
 * Note: Uses negative lookbehind to avoid matching PostgreSQL :: type casts.
 */
export function parseNamedParameters(sqlWithNamedParams: string): ParameterMapping {
  const parameterOrder: string[] = [];
  const paramMap = new Map<string, number>();

  // Match :param_name (alphanumeric and underscore, not preceded by :: for type casts)
  const namedParamRegex = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g;

  const sql = sqlWithNamedParams.replace(namedParamRegex, (_match, paramName: string) => {
    if (!paramMap.has(paramName)) {
      paramMap.set(paramName, parameterOrder.length + 1);
      parameterOrder.push(paramName);
    }
    const position = paramMap.get(paramName);
    return `$${String(position)}`;
  });

  return { sql, parameterOrder };
}

/**
 * Maps named parameter values to a positional array for PostgreSQL query execution.
 *
 * @param params - Object with named parameters
 * @param parameterOrder - Array of parameter names in order
 * @returns Array of parameter values in order
 */
export function mapToPositional(
  params: Record<string, unknown>,
  parameterOrder: string[]
): unknown[] {
  return parameterOrder.map(name => params[name]);
}

/**
 * Extracts unique parameter names from SQL with :named syntax.
 *
 * @param sql - SQL string with :named parameters
 * @returns Array of unique parameter names
 */
export function extractNamedParameters(sql: string): string[] {
  const namedParamRegex = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const matches = sql.matchAll(namedParamRegex);
  return [...new Set([...matches].map(m => m[1]).filter((p): p is string => p !== undefined))];
}
