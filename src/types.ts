// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SaveQueryToolParams {
  tool_name: string;
  description: string;
  sql_query: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameter_schema: Record<string, any>;
  overwrite?: boolean;
}

export interface DeleteSavedQueryToolParams {
  tool_name: string;
}

export interface ListSavedQueriesToolParams {
  // No parameters required
}

export interface ShowSavedQueryToolParams {
  tool_name: string;
}

export interface SavedToolConfig {
  name: string;
  description: string;
  sql_query: string;
  sql_prepared: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameter_schema: Record<string, any>;
  parameter_order: string[];
}
