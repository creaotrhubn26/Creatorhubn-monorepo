/**
 * Read and minimally validate a PostgreSQL connection URL without ever
 * printing it. Migration/diagnostic scripts use this helper so credentials
 * must be supplied through the process environment instead of source code.
 */
export function requireDatabaseUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set in the environment`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username) {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  return value;
}

export function requireDistinctDatabaseUrls(sourceName, targetName) {
  const source = requireDatabaseUrl(sourceName);
  const target = requireDatabaseUrl(targetName);
  if (source === target) {
    throw new Error(`${sourceName} and ${targetName} must reference different databases`);
  }
  return { source, target };
}
