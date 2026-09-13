const LEGACY_STRICT_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Preserve node-postgres' current strict TLS behavior explicitly.
 *
 * pg-connection-string 2.x treats prefer, require, and verify-ca as aliases
 * for verify-full. Its next major version will adopt the weaker libpq
 * meanings, so production callers must not rely on that legacy aliasing.
 */
export function withExplicitPostgresVerifyFull(connectionString) {
  const candidate = String(connectionString || "").trim();
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("PostgreSQL connection URL must be valid");
  }

  const sslModeEntries = [...parsed.searchParams.entries()].filter(
    ([name]) => name.toLowerCase() === "sslmode",
  );
  if (sslModeEntries.length === 0) return candidate;
  if (sslModeEntries.length > 1) {
    throw new Error("PostgreSQL connection URL must set at most one sslmode");
  }

  const [parameterName, rawMode] = sslModeEntries[0];
  const mode = String(rawMode).toLowerCase();
  if (!LEGACY_STRICT_SSL_MODES.has(mode)) return candidate;

  parsed.searchParams.delete(parameterName);
  parsed.searchParams.append("sslmode", "verify-full");
  return parsed.toString();
}
