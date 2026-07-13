import pg from 'pg';

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(databaseUrl: string): Db {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  return pool;
}

/** Kjører fn i en transaksjon med automatisk COMMIT/ROLLBACK. */
export async function withTransaction<T>(
  db: Db,
  fn: (client: DbClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
