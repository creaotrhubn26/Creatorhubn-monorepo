#!/usr/bin/env node
/**
 * Comprehensive Schema and Migration Checker
 * Compares schema files, migration files, and actual database
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cb9HrCJxwg6U@ep-broad-surf-abadxt78-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

async function getDatabaseTables() {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return new Set(result.rows.map(r => r.table_name));
}

async function getDatabaseColumns(tableName) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    return result.rows;
  } catch (error) {
    return [];
  }
}

function extractTableNamesFromSchema(content) {
  const tables = new Set();
  // Match pgTable('table_name', ...) or pgTable("table_name", ...)
  const pgTableRegex = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pgTableRegex.exec(content)) !== null) {
    tables.add(match[1]);
  }
  return tables;
}

async function scanSchemaFiles() {
  const schemaFiles = [
    'shared/database-persistence-schema.ts',
    'shared/schema.ts',
    'shared/schema-simple.ts',
    'shared/schema-extensions.ts',
    'shared/schema-clean.ts',
    'shared/schema-backup.ts',
    'migrations/schema.ts',
  ];
  
  const allTables = new Set();
  const fileTables = new Map();
  
  for (const file of schemaFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const tables = extractTableNamesFromSchema(content);
      fileTables.set(file, tables);
      tables.forEach(t => allTables.add(t));
    } catch (error) {
      // File doesn't exist, skip
    }
  }
  
  return { allTables, fileTables };
}

async function scanMigrationFiles() {
  const migrationDirs = [
    'server/migrations',
    'server/db/migrations',
  ];
  
  const migrationTables = new Set();
  const migrationFiles = [];
  
  for (const dir of migrationDirs) {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.js')) {
          try {
            const content = readFileSync(join(dir, file), 'utf-8');
            const tables = extractTableNamesFromSchema(content);
            tables.forEach(t => migrationTables.add(t));
            if (tables.size > 0) {
              migrationFiles.push({ file: join(dir, file), tables });
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }
  
  return { migrationTables, migrationFiles };
}

async function main() {
  console.log('🔍 Comprehensive Schema & Migration Checker\n');
  console.log('='.repeat(60));
  
  // Get database tables
  console.log('\n📊 Step 1: Scanning database...');
  const dbTables = await getDatabaseTables();
  console.log(`   Found ${dbTables.size} tables in database`);
  
  // Get schema tables
  console.log('\n📋 Step 2: Scanning schema files...');
  const { allTables: schemaTables, fileTables } = await scanSchemaFiles();
  console.log(`   Found ${schemaTables.size} tables in schemas`);
  
  fileTables.forEach((tables, file) => {
    console.log(`   - ${file}: ${tables.size} tables`);
  });
  
  // Get migration tables
  console.log('\n🔄 Step 3: Scanning migration files...');
  const { migrationTables, migrationFiles } = await scanMigrationFiles();
  console.log(`   Found ${migrationTables.size} tables in migrations`);
  console.log(`   Scanned ${migrationFiles.length} migration files`);
  
  // Compare
  console.log('\n📊 Step 4: Comparing...');
  
  const inSchemaNotInDb = [...schemaTables].filter(t => !dbTables.has(t));
  const inDbNotInSchema = [...dbTables].filter(t => !schemaTables.has(t));
  const inMigrationsNotInDb = [...migrationTables].filter(t => !dbTables.has(t));
  const inDbNotInMigrations = [...dbTables].filter(t => !migrationTables.has(t));
  
  console.log(`\n✅ Tables in schema: ${schemaTables.size}`);
  console.log(`✅ Tables in database: ${dbTables.size}`);
  console.log(`✅ Tables in migrations: ${migrationTables.size}`);
  
  console.log(`\n⚠️  Tables in schema but NOT in database: ${inSchemaNotInDb.length}`);
  if (inSchemaNotInDb.length > 0 && inSchemaNotInDb.length <= 50) {
    inSchemaNotInDb.slice(0, 20).forEach(t => console.log(`   - ${t}`));
    if (inSchemaNotInDb.length > 20) {
      console.log(`   ... and ${inSchemaNotInDb.length - 20} more`);
    }
  }
  
  console.log(`\n⚠️  Tables in database but NOT in schema: ${inDbNotInSchema.length}`);
  if (inDbNotInSchema.length > 0 && inDbNotInSchema.length <= 50) {
    inDbNotInSchema.slice(0, 20).forEach(t => console.log(`   - ${t}`));
    if (inDbNotInSchema.length > 20) {
      console.log(`   ... and ${inDbNotInSchema.length - 20} more`);
    }
  }
  
  console.log(`\n⚠️  Tables in migrations but NOT in database: ${inMigrationsNotInDb.length}`);
  if (inMigrationsNotInDb.length > 0 && inMigrationsNotInDb.length <= 20) {
    inMigrationsNotInDb.forEach(t => console.log(`   - ${t}`));
  }
  
  // Sample column check for critical tables
  console.log(`\n📋 Step 5: Checking critical tables...`);
  const criticalTables = ['users', 'projects', 'profession_types', 'notes', 'clients', 'contracts'];
  
  for (const table of criticalTables) {
    if (dbTables.has(table)) {
      const cols = await getDatabaseColumns(table);
      console.log(`   ✅ ${table}: ${cols.length} columns`);
    } else {
      console.log(`   ❌ ${table}: NOT FOUND in database`);
    }
  }
  
  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Database tables: ${dbTables.size}`);
  console.log(`   Schema tables: ${schemaTables.size}`);
  console.log(`   Migration tables: ${migrationTables.size}`);
  console.log(`   Missing from DB: ${inSchemaNotInDb.length}`);
  console.log(`   Extra in DB: ${inDbNotInSchema.length}`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

