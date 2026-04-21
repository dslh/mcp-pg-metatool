# mcp-pg-metatool

A Model Context Protocol (MCP) server for PostgreSQL that enables AI agents to execute SQL queries and create reusable parameterized query tools.

## Features

- **Execute arbitrary SQL** with named parameter support (`:param_name` syntax)
- **Save parameterized queries** as reusable MCP tools that persist across sessions
- **Database introspection** tools to explore schemas, tables, views, and their structures
- **Connection pooling** for efficient database access

## Installation

```bash
npm install
npm run build
```

## Configuration

### Database Connection

Set one of the following:

```bash
# Option 1: Connection URL (recommended)
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Option 2: Individual variables
export PGHOST="localhost"
export PGPORT="5432"
export PGDATABASE="mydb"
export PGUSER="myuser"
export PGPASSWORD="mypassword"
```

### Optional Settings

```bash
# SSL mode (disable, require, verify-ca, verify-full)
export PGSSLMODE="require"

# Connection pool size (default: 10)
export PG_POOL_MAX="10"

# Data directory for saved queries (default: ./data)
export MCP_PG_DATA_DIR="./data"

# Disable core tools: "none" (default), "management", or "all"
export DISABLE_CORE_TOOLS="none"
```

### Safety Features

Two opt-in controls for limiting what the MCP server exposes to the agent. **These are defense-in-depth, not primary controls.** The authoritative way to restrict what the agent can do is to connect with a dedicated PostgreSQL role whose privileges are scoped appropriately (e.g. `GRANT SELECT ON ... TO readonly_role`, `GRANT SELECT (col1, col2) ON sensitive_table TO readonly_role`).

```bash
# Block mutations at the tool layer. When enabled, every pooled connection
# runs `SET SESSION default_transaction_read_only = on`, so PostgreSQL itself
# rejects INSERT/UPDATE/DELETE/DDL/TRUNCATE — including writes smuggled
# inside CTEs (WITH x AS (UPDATE ...) SELECT ...).
export READONLY_MODE="true"

# Comma-separated list of sensitive columns to redact from tool responses.
# Format: schema.table.column
export FIELD_BLACKLIST="public.users.ssn,public.users.password_hash,public.payments.cc_number"

# Per-statement timeout in milliseconds. Sets `statement_timeout` on every
# pooled connection so PostgreSQL cancels any query that runs too long —
# applies to the agent's queries and to the server's own introspection lookups.
# Unset (or 0) means no timeout.
export QUERY_TIMEOUT_MS="30000"

# Auto-populate the field blacklist from the DB user's column-level GRANTs.
# At startup, runs `has_column_privilege(current_user, ...)` against every
# user-schema column and merges any denials into FIELD_BLACKLIST. Lets the
# tool-level filter track the DB ACL without maintaining two lists.
export AUTO_BLACKLIST_FROM_GRANTS="true"
```

The `list_inaccessible_columns` tool surfaces the same information to the agent on demand, which lets it pick explicit column lists proactively instead of hitting a `SELECT *` permission error.

**Read-only caveats.** PostgreSQL's read-only transaction mode still permits `SET`, `SHOW`, temp tables, and writes to *other* databases via `dblink`/FDW. Use DB role privileges for an authoritative lock-down.

**Blacklist behavior.** For each column returned by a query, the server resolves its origin via `pg_class`/`pg_attribute` and drops any entry whose `schema.table.column` matches the blacklist. Matched columns are reported back to the agent in a `redactedColumns` array. Computed/aliased outputs (e.g. `SELECT ssn AS x FROM users`) can't be resolved to an origin column and fall back to matching by output name; these are reported under `unresolvedRedactions` as a best-effort filter — rely on column-level `GRANT`/`REVOKE` if this edge case matters to you. The blacklist also filters `describe_table` / `describe_view` output so sensitive column names aren't leaked through introspection.

**Blacklist does NOT prevent side-channel probing.** The filter only inspects returned rows, not the query itself. An agent running `SELECT id FROM users WHERE ssn = '123-45-6789'` can still learn whether that SSN exists by observing row count, even though no `ssn` column is ever returned. Column-level `REVOKE SELECT (ssn)` in PostgreSQL blocks both reading *and* filtering/ordering/joining on the column — it is the only way to close this gap. Treat the tool-level blacklist as a display-layer safety net, not an access control.

## Usage

### Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["/path/to/mcp-pg-metatool/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/dbname"
      }
    }
  }
}
```

## Available Tools

### Query Execution

| Tool | Description |
|------|-------------|
| `execute_sql_query` | Execute arbitrary SQL queries with named parameters |

### Query Management

| Tool | Description |
|------|-------------|
| `save_query` | Create a reusable tool from a parameterized SQL query |
| `list_saved_queries` | List all saved query tools |
| `show_saved_query` | View the full definition of a saved query |
| `delete_saved_query` | Remove a saved query tool |

### Database Introspection

| Tool | Description |
|------|-------------|
| `list_schemas` | List all schemas in the database |
| `list_tables` | List tables in a schema |
| `describe_table` | Show columns, types, and constraints for a table |
| `list_views` | List views in a schema |
| `describe_view` | Show view columns and definition |
| `list_inaccessible_columns` | List columns the current DB user lacks SELECT on |

## Examples

### Execute a Query

```
Tool: execute_sql_query
Arguments:
  query: "SELECT * FROM users WHERE status = :status LIMIT :limit"
  params: { "status": "active", "limit": 10 }
```

### Save a Reusable Query

```
Tool: save_query
Arguments:
  tool_name: "get_active_users"
  description: "Get active users with optional limit"
  sql_query: "SELECT id, name, email FROM users WHERE status = 'active' LIMIT :limit"
  parameter_schema: {
    "type": "object",
    "properties": {
      "limit": {
        "type": "integer",
        "default": 100,
        "description": "Maximum number of users to return"
      }
    }
  }
```

After saving, `get_active_users` becomes available as a new tool that persists across sessions.

### Explore Database Structure

```
Tool: list_tables
Arguments:
  schema_name: "public"

Tool: describe_table
Arguments:
  table_name: "users"
  schema_name: "public"
```

## Named Parameters

SQL queries use colon-prefixed named parameters that are converted to PostgreSQL's positional `$1, $2, ...` syntax at execution time:

```sql
-- You write:
SELECT * FROM orders WHERE user_id = :user_id AND status = :status

-- Executed as:
SELECT * FROM orders WHERE user_id = $1 AND status = $2
```

This avoids conflicts with PostgreSQL's `::` type cast syntax.

## Saved Query Format

Saved queries are stored as JSON files in `data/tools/`:

```json
{
  "name": "get_user_orders",
  "description": "Get orders for a specific user",
  "sql_query": "SELECT * FROM orders WHERE user_id = :user_id",
  "sql_prepared": "SELECT * FROM orders WHERE user_id = $1",
  "parameter_schema": {
    "type": "object",
    "properties": {
      "user_id": { "type": "integer" }
    },
    "required": ["user_id"]
  },
  "parameter_order": ["user_id"]
}
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
