#!/usr/bin/env node
/**
 * Comprehensive Schema & Migration Checker
 * Checks ALL schema files and migrations in the entire system
 */

import pg from 'pg';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const { Pool } = pg;

const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_cb9HrCJxwg6U@ep-broad-surf-abadxt78-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

function extractTableNames(content, filePath) {
  const tables = new Map();
  // Match pgTable('table_name', ...) or pgTable("table_name", ...)
  const pgTableRegex = /pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pgTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    if (!tables.has(tableName)) {
      tables.set(tableName, []);
    }
    tables.get(tableName).push({ file: filePath, line: lineNumber });
  }
  return tables;
}

function findSchemaFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other common dirs
        if (!['node_modules', '.git', 'dist', 'build', 'cache', 'logs', 'backups'].includes(file)) {
          findSchemaFiles(filePath, fileList);
        }
      } else if (file.includes('schema') && (file.endsWith('.ts') || file.endsWith('.js'))) {
        fileList.push(filePath);
      }
    } catch (error) {
      // Skip files we can't access
    }
  }
  
  return fileList;
}

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

async function getTableInfo(tableName) {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `, [tableName]);
    
    const count = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    
    return {
      exists: true,
      columns: cols.rows.length,
      rows: parseInt(count.rows[0].count, 10),
    };
  } catch (error) {
    return { exists: false };
  }
}

async function main() {
  console.log('🔍 Comprehensive Schema & Migration Checker\n');
  console.log('='.repeat(70));
  
  // Find all schema files
  console.log('\n📁 Step 1: Finding all schema files...');
  const rootDir = process.cwd();
  const schemaFiles = findSchemaFiles(rootDir);
  console.log(`   Found ${schemaFiles.length} schema files`);
  
  // Also check migrations directory specifically
  const migrationsDir = join(rootDir, 'migrations');
  const migrationsFiles = [];
  try {
    const files = readdirSync(migrationsDir);
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.mjs')) {
        migrationsFiles.push(join(migrationsDir, file));
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not read migrations directory: ${error.message}`);
  }
  
  console.log(`   Found ${migrationsFiles.length} migration files in migrations/`);
  
  // Scan all schema files
  console.log('\n📋 Step 2: Scanning schema files...');
  const allSchemaTables = new Map();
  const fileTableCounts = new Map();
  
  for (const file of schemaFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const tables = extractTableNames(content, file);
      fileTableCounts.set(file, tables.size);
      
      tables.forEach((locations, tableName) => {
        if (!allSchemaTables.has(tableName)) {
          allSchemaTables.set(tableName, []);
        }
        allSchemaTables.get(tableName).push(...locations);
      });
    } catch (error) {
      console.log(`   ⚠️  Could not read ${file}: ${error.message}`);
    }
  }
  
  // Scan migration files
  console.log('\n🔄 Step 3: Scanning migration files...');
  const migrationTables = new Map();
  
  for (const file of migrationsFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const tables = extractTableNames(content, file);
      migrationTables.set(file, tables);
    } catch (error) {
      console.log(`   ⚠️  Could not read ${file}: ${error.message}`);
    }
  }
  
  console.log(`   Scanned ${migrationsFiles.length} migration files`);
  
  // Get database tables
  console.log('\n📊 Step 4: Checking database...');
  const dbTables = await getDatabaseTables();
  console.log(`   Found ${dbTables.size} tables in database`);
  
  // Analyze
  console.log('\n🔍 Step 5: Analyzing...\n');
  
  const schemaTableList = Array.from(allSchemaTables.keys()).sort();
  const inSchemaNotInDb = [];
  const inSchemaAndInDb = [];
  const duplicateDefinitions = [];
  
  // Check for duplicates
  allSchemaTables.forEach((locations, tableName) => {
    if (locations.length > 1) {
      duplicateDefinitions.push({ table: tableName, locations });
    }
  });
  
  // Sample check (first 100 tables)
  const sampleSize = Math.min(100, schemaTableList.length);
  console.log(`   Checking ${sampleSize} tables from schemas...`);
  
  for (const tableName of schemaTableList.slice(0, sampleSize)) {
    const dbInfo = await getTableInfo(tableName);
    if (dbInfo.exists) {
      inSchemaAndInDb.push({
        table: tableName,
        columns: dbInfo.columns,
        rows: dbInfo.rows,
      });
    } else {
      inSchemaNotInDb.push({ table: tableName });
    }
  }
  
  // Report
  console.log('\n📊 RESULTS:\n');
  console.log('='.repeat(70));
  
  console.log(`\n✅ Schema Files Summary:`);
  console.log(`   Total schema files: ${schemaFiles.length}`);
  console.log(`   Total migration files: ${migrationsFiles.length}`);
  console.log(`   Total unique tables in schemas: ${schemaTableList.length}`);
  
  console.log(`\n📋 Top Schema Files by Table Count:`);
  const sortedFiles = Array.from(fileTableCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedFiles.forEach(([file, count]) => {
    const relativePath = file.replace(rootDir + '/', '');
    console.log(`   - ${relativePath}: ${count} tables`);
  });
  
  console.log(`\n✅ Tables in Schema AND Database: ${inSchemaAndInDb.length}/${sampleSize} checked`);
  if (inSchemaAndInDb.length > 0) {
    console.log(`\n   Sample verified tables:`);
    inSchemaAndInDb.slice(0, 10).forEach(t => {
      console.log(`   - ${t.table}: ${t.columns} columns, ${t.rows} rows`);
    });
  }
  
  console.log(`\n❌ Tables in Schema but NOT in Database: ${inSchemaNotInDb.length}`);
  if (inSchemaNotInDb.length > 0 && inSchemaNotInDb.length <= 20) {
    inSchemaNotInDb.forEach(t => {
      console.log(`   - ${t.table}`);
    });
  } else if (inSchemaNotInDb.length > 20) {
    inSchemaNotInDb.slice(0, 10).forEach(t => {
      console.log(`   - ${t.table}`);
    });
    console.log(`   ... and ${inSchemaNotInDb.length - 10} more`);
  }
  
  console.log(`\n⚠️  Tables Defined Multiple Times: ${duplicateDefinitions.length}`);
  if (duplicateDefinitions.length > 0 && duplicateDefinitions.length <= 10) {
    duplicateDefinitions.forEach(({ table, locations }) => {
      console.log(`   - ${table}: defined in ${locations.length} places`);
      locations.forEach(loc => {
        const relativePath = loc.file.replace(rootDir + '/', '');
        console.log(`     • ${relativePath}:${loc.line}`);
      });
    });
  }
  
  // Migration files summary
  console.log(`\n🔄 Migration Files Summary:`);
  migrationsFiles.forEach(file => {
    const relativePath = file.replace(rootDir + '/', '');
    const tables = migrationTables.get(file);
    if (tables) {
      console.log(`   - ${relativePath}: ${tables.size} tables`);
    }
  });
  
  // Critical tables check
  console.log(`\n📋 Critical Tables Status:`);
  const criticalTables = ['users', 'projects', 'profession_types', 'notes', 'clients', 'contracts', 'images'];
  
  for (const table of criticalTables) {
    const dbInfo = await getTableInfo(table);
    if (dbInfo.exists) {
      const inSchema = allSchemaTables.has(table);
      console.log(`   ${inSchema ? '✅' : '⚠️ '} ${table}: ${dbInfo.columns} columns, ${dbInfo.rows} rows ${inSchema ? '(in schema)' : '(NOT in schema)'}`);
    } else {
      console.log(`   ❌ ${table}: NOT IN DATABASE`);
    }
  }
  
  // Final summary
  console.log(`\n📊 Final Summary:`);
  console.log(`   Database tables: ${dbTables.size}`);
  console.log(`   Schema tables: ${schemaTableList.length}`);
  console.log(`   Schema files scanned: ${schemaFiles.length}`);
  console.log(`   Migration files scanned: ${migrationsFiles.length}`);
  console.log(`   Tables checked: ${sampleSize}`);
  console.log(`   In schema AND database: ${inSchemaAndInDb.length}`);
  console.log(`   In schema but NOT in database: ${inSchemaNotInDb.length}`);
  console.log(`   Duplicate definitions: ${duplicateDefinitions.length}`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

