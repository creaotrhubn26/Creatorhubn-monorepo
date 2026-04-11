// Minimal config without importing drizzle-kit so it works in production environments
// where devDependencies might not be installed.

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

export default {
  out: './migrations',
  schema: '../frontend/shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
} as any;
