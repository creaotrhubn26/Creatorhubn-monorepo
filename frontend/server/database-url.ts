const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

export function requireDatabaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('DATABASE_URL must be provided via the environment');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      'DATABASE_URL must use the postgres or postgresql protocol',
    );
  }
  return value;
}
