#!/usr/bin/env node
/**
 * Database Migration Script
 * Migrates data from old database to new database
 */

import pg from 'pg';
import readline from 'readline';

const { Pool } = pg;

// Database URLs
const OLD_DB_URL = 'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Create connection pools
const oldPool = new Pool({
  connectionString: OLD_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const newPool = new Pool({
  connectionString: NEW_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function getTables(pool) {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return result.rows.map(row => row.table_name);
}

async function getTableRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error(`Error counting rows in ${tableName}:`, error.message);
    return 0;
  }
}

async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows;
}

async function migrateTable(oldPool, newPool, tableName, batchSize = 1000) {
  console.log(`\n📦 Migrating table: ${tableName}`);
  
  try {
    // Get row count from old database
    const oldCount = await getTableRowCount(oldPool, tableName);
    console.log(`   Old DB: ${oldCount} rows`);
    
    if (oldCount === 0) {
      console.log(`   ⚠️  No data to migrate`);
      return { migrated: 0, skipped: 0, errors: 0 };
    }
    
    // Check if table exists in new database
    const newTables = await getTables(newPool);
    if (!newTables.includes(tableName)) {
      console.log(`   ⚠️  Table ${tableName} does not exist in new database, skipping`);
      return { migrated: 0, skipped: oldCount, errors: 0 };
    }
    
    // Get columns from both databases
    const oldColumns = await getTableColumns(oldPool, tableName);
    const newColumns = await getTableColumns(newPool, tableName);
    
    const oldColumnNames = oldColumns.map(c => c.column_name);
    const newColumnNames = newColumns.map(c => c.column_name);
    
    // Find common columns
    const commonColumns = oldColumnNames.filter(col => newColumnNames.includes(col));
    
    if (commonColumns.length === 0) {
      console.log(`   ⚠️  No common columns found, skipping`);
      return { migrated: 0, skipped: oldCount, errors: 0 };
    }
    
    console.log(`   Common columns: ${commonColumns.length}/${oldColumnNames.length}`);
    
    // Check if new table has data
    const newCount = await getTableRowCount(newPool, tableName);
    if (newCount > 0) {
      const answer = await question(`   ⚠️  New DB already has ${newCount} rows. Clear and replace? (y/N): `);
      if (answer.toLowerCase() === 'y') {
        await newPool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
        console.log(`   ✅ Cleared existing data`);
      } else {
        console.log(`   ⏭️  Skipping (keeping existing data)`);
        return { migrated: 0, skipped: oldCount, errors: 0 };
      }
    }
    
    // Migrate data in batches
    let offset = 0;
    let totalMigrated = 0;
    let totalErrors = 0;
    
    while (offset < oldCount) {
      try {
        // Fetch batch from old database
        const selectQuery = `SELECT ${commonColumns.map(c => `"${c}"`).join(', ')} FROM "${tableName}" ORDER BY (SELECT NULL) LIMIT $1 OFFSET $2`;
        const oldData = await oldPool.query(selectQuery, [batchSize, offset]);
        
        if (oldData.rows.length === 0) break;
        
        // Insert into new database
        const insertColumns = commonColumns.map(c => `"${c}"`).join(', ');
        const placeholders = commonColumns.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO "${tableName}" (${insertColumns}) VALUES ${oldData.rows.map((_, i) => {
          const rowPlaceholders = commonColumns.map((_, j) => `$${i * commonColumns.length + j + 1}`).join(', ');
          return `(${rowPlaceholders})`;
        }).join(', ')} ON CONFLICT DO NOTHING`;
        
        const values = oldData.rows.flatMap(row => commonColumns.map(col => row[col]));
        await newPool.query(insertQuery, values);
        
        totalMigrated += oldData.rows.length;
        offset += batchSize;
        
        process.stdout.write(`   Progress: ${Math.min(offset, oldCount)}/${oldCount} rows (${Math.round((Math.min(offset, oldCount) / oldCount) * 100)}%)\r`);
      } catch (error) {
        console.error(`\n   ❌ Error migrating batch at offset ${offset}:`, error.message);
        totalErrors++;
        offset += batchSize; // Skip this batch and continue
      }
    }
    
    console.log(`\n   ✅ Migrated: ${totalMigrated} rows`);
    if (totalErrors > 0) {
      console.log(`   ⚠️  Errors: ${totalErrors} batches`);
    }
    
    // Verify
    const finalCount = await getTableRowCount(newPool, tableName);
    console.log(`   New DB: ${finalCount} rows`);
    
    return { migrated: totalMigrated, skipped: oldCount - totalMigrated, errors: totalErrors };
  } catch (error) {
    console.error(`   ❌ Error migrating table ${tableName}:`, error.message);
    return { migrated: 0, skipped: 0, errors: 1 };
  }
}

async function main() {
  console.log('🚀 Database Migration Tool');
  console.log('==========================\n');
  
  try {
    // Test connections
    console.log('🔍 Testing database connections...');
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old database: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New database: Connected\n');
    
    // Get tables from old database
    console.log('📋 Discovering tables...');
    const oldTables = await getTables(oldPool);
    console.log(`   Found ${oldTables.length} tables in old database`);
    
    const newTables = await getTables(newPool);
    console.log(`   Found ${newTables.length} tables in new database\n`);
    
    // Show table comparison
    console.log('📊 Table Comparison:');
    const onlyInOld = oldTables.filter(t => !newTables.includes(t));
    const onlyInNew = newTables.filter(t => !oldTables.includes(t));
    const common = oldTables.filter(t => newTables.includes(t));
    
    if (onlyInOld.length > 0) {
      console.log(`   ⚠️  Only in old DB: ${onlyInOld.join(', ')}`);
    }
    if (onlyInNew.length > 0) {
      console.log(`   ℹ️  Only in new DB: ${onlyInNew.join(', ')}`);
    }
    console.log(`   ✅ Common tables: ${common.length}\n`);
    
    // Ask for confirmation
    console.log('⚠️  WARNING: This will migrate data from old database to new database.');
    const confirm = await question('Do you want to proceed? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Migration cancelled.');
      process.exit(0);
    }
    
    // Ask which tables to migrate
    console.log('\n📋 Tables to migrate:');
    const tablesToMigrate = [];
    for (const table of common) {
      const oldCount = await getTableRowCount(oldPool, table);
      const newCount = await getTableRowCount(newPool, table);
      console.log(`   ${table}: ${oldCount} rows (old) → ${newCount} rows (new)`);
      
      if (oldCount > 0) {
        const answer = await question(`   Migrate ${table}? (Y/n): `);
        if (answer.toLowerCase() !== 'n') {
          tablesToMigrate.push(table);
        }
      }
    }
    
    if (tablesToMigrate.length === 0) {
      console.log('\n⚠️  No tables selected for migration.');
      process.exit(0);
    }
    
    // Migrate tables
    console.log(`\n🚀 Starting migration of ${tablesToMigrate.length} tables...\n`);
    const results = {};
    
    for (const table of tablesToMigrate) {
      results[table] = await migrateTable(oldPool, newPool, table);
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('====================');
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const [table, result] of Object.entries(results)) {
      console.log(`\n${table}:`);
      console.log(`   ✅ Migrated: ${result.migrated} rows`);
      if (result.skipped > 0) {
        console.log(`   ⏭️  Skipped: ${result.skipped} rows`);
      }
      if (result.errors > 0) {
        console.log(`   ❌ Errors: ${result.errors} batches`);
      }
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }
    
    console.log('\n🎉 Migration Complete!');
    console.log(`   Total migrated: ${totalMigrated} rows`);
    console.log(`   Total skipped: ${totalSkipped} rows`);
    if (totalErrors > 0) {
      console.log(`   Total errors: ${totalErrors} batches`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
    rl.close();
  }
}

// Run migration
main().catch(console.error);

