/**
 * Tool-level safety configuration.
 *
 * Sources two opt-in env vars — both default to disabled so existing deployments
 * behave unchanged. DB-level controls (role privileges, column GRANTs) remain
 * the authoritative defense; this module adds defense-in-depth at the tool layer.
 */

export interface SafetyConfig {
  readOnly: boolean;
  /** Fully-qualified `schema.table.column` strings, for exact matching against resolved fields. */
  blacklistFull: Set<string>;
  /** Bare column names from the blacklist, for fallback matching on aliased/computed outputs. */
  blacklistedColumnNames: Set<string>;
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

function loadConfig(): SafetyConfig {
  const { full, columns } = parseBlacklist(process.env['FIELD_BLACKLIST']);
  return {
    readOnly: parseBool(process.env['READONLY_MODE']),
    blacklistFull: full,
    blacklistedColumnNames: columns,
  };
}

export const safetyConfig: SafetyConfig = loadConfig();

export function describeSafetyConfig(): string {
  const ro = safetyConfig.readOnly ? 'ENABLED' : 'disabled';
  const bl = safetyConfig.blacklistFull.size;
  return `read-only mode ${ro}, field blacklist: ${String(bl)} ${bl === 1 ? 'entry' : 'entries'}`;
}
