const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

export function requireDatabaseUrl(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be provided via the environment`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${name} must use the postgres or postgresql protocol`);
  }
  return value;
}

export function requireMigrationDatabaseUrls(env = process.env) {
  const source = requireDatabaseUrl('LEGACY_DATABASE_URL', env);
  const destination = requireDatabaseUrl('DATABASE_URL', env);
  if (new URL(source).href === new URL(destination).href) {
    throw new Error('LEGACY_DATABASE_URL and DATABASE_URL must be different');
  }
  return { source, destination };
}
