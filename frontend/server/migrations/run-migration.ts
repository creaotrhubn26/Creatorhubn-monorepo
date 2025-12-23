/**
 * Database Migration Runner
 * Runs SQL migration files against the Neon PostgreSQL database
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Neon PostgreSQL connection string
const connectionString = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration(filename: string) {
  const client = await pool.connect();
  
  try {
    console.log(`\n🔄 Running migration: ${filename}`);
    
    // Read SQL file
    const sqlPath = path.join(__dirname, filename);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log(`✅ Migration completed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Starting database migrations...');
    console.log('📦 Database: Neon PostgreSQL');
    
    // Run migrations in order
    await runMigration('001_business_intelligence.sql');
    
    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

