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
