/**
 * Tool-level safety configuration.
 *
 * Sources opt-in env vars — all default to disabled so existing deployments
 * behave unchanged. DB-level controls (role privileges, column GRANTs) remain
 * the authoritative defense; this module adds defense-in-depth at the tool layer.
 */

export interface SafetyConfig {
  readOnly: boolean;
  /** Fully-qualified `schema.table.column` strings, for exact matching against resolved fields. */
  blacklistFull: Set<string>;
  /** Bare column names from the blacklist, for fallback matching on aliased/computed outputs. */
  blacklistedColumnNames: Set<string>;
  /** Per-statement timeout in milliseconds, or null for no timeout. */
  queryTimeoutMs: number | null;
}

function parseBool(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function parseBlacklist(raw: string | undefined): {
  full: Set<string>;
  columns: Set<string>;
} {
  const full = new Set<string>();
  const columns = new Set<string>();
  if (raw === undefined) return { full, columns };

  for (const piece of raw.split(',')) {
    const trimmed = piece.trim();
    if (trimmed === '') continue;

    const parts = trimmed.split('.');
    if (parts.length !== 3 || parts.some(p => p.trim() === '')) {
      console.error(
        `[safetyConfig] Ignoring malformed FIELD_BLACKLIST entry: "${trimmed}" (expected schema.table.column)`
      );
      continue;
    }

    full.add(trimmed);
    columns.add(parts[2] as string);
  }

  return { full, columns };
}

function parseTimeoutMs(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0 || String(n) !== raw.trim()) {
    console.error(
      `[safetyConfig] Ignoring malformed QUERY_TIMEOUT_MS value: "${raw}" (expected a non-negative integer)`
    );
    return null;
  }
  return n === 0 ? null : n;
}

function loadConfig(): SafetyConfig {
  const { full, columns } = parseBlacklist(process.env['FIELD_BLACKLIST']);
  return {
    readOnly: parseBool(process.env['READONLY_MODE']),
    blacklistFull: full,
    blacklistedColumnNames: columns,
    queryTimeoutMs: parseTimeoutMs(process.env['QUERY_TIMEOUT_MS']),
  };
}

export const safetyConfig: SafetyConfig = loadConfig();

export function describeSafetyConfig(): string {
  const ro = safetyConfig.readOnly ? 'ENABLED' : 'disabled';
  const bl = safetyConfig.blacklistFull.size;
  const timeout =
    safetyConfig.queryTimeoutMs === null
      ? 'none'
      : `${String(safetyConfig.queryTimeoutMs)}ms`;
  return `read-only mode ${ro}, field blacklist: ${String(bl)} ${bl === 1 ? 'entry' : 'entries'}, query timeout: ${timeout}`;
}
