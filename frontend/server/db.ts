/**
 * Database Connection
 * Drizzle ORM setup for Neon PostgreSQL
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/database-persistence-schema';

// Neon PostgreSQL connection string
const connectionString = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize Drizzle ORM
export const db = drizzle(pool, { schema });

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully to Neon PostgreSQL');
});

pool.on('error', (err: Error) => {
  console.error('❌ Database connection error:', err);
});

export default db;

