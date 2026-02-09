#!/usr/bin/env node
/**
 * Automated Database Migration Script
 * Migrates all data from old database to new database without prompts
 */

import pg from 'pg';

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
  console.log(`\n📦 Migrating: ${tableName}`);
  
  try {
    const oldCount = await getTableRowCount(oldPool, tableName);
    if (oldCount === 0) {
      console.log(`   ⏭️  No data (0 rows)`);
      return { migrated: 0, skipped: 0, errors: 0 };
    }
    
    const newTables = await getTables(newPool);
    if (!newTables.includes(tableName)) {
      console.log(`   ⚠️  Table not in new DB, skipping`);
      return { migrated: 0, skipped: oldCount, errors: 0 };
    }
    
    const oldColumns = await getTableColumns(oldPool, tableName);
    const newColumns = await getTableColumns(newPool, tableName);
    
    const oldColumnNames = oldColumns.map(c => c.column_name);
    const newColumnNames = newColumns.map(c => c.column_name);
    const commonColumns = oldColumnNames.filter(col => newColumnNames.includes(col));
    
    if (commonColumns.length === 0) {
      console.log(`   ⚠️  No common columns, skipping`);
      return { migrated: 0, skipped: oldCount, errors: 0 };
    }
    
    // Clear existing data in new table
    const newCount = await getTableRowCount(newPool, tableName);
    if (newCount > 0) {
      await newPool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      console.log(`   🗑️  Cleared ${newCount} existing rows`);
    }
    
    // Migrate in batches
    let offset = 0;
    let totalMigrated = 0;
    let totalErrors = 0;
    
    while (offset < oldCount) {
      try {
        const selectQuery = `SELECT ${commonColumns.map(c => `"${c}"`).join(', ')} FROM "${tableName}" ORDER BY (SELECT NULL) LIMIT $1 OFFSET $2`;
        const oldData = await oldPool.query(selectQuery, [batchSize, offset]);
        
        if (oldData.rows.length === 0) break;
        
        // Insert batch
        const insertColumns = commonColumns.map(c => `"${c}"`).join(', ');
        const placeholders = oldData.rows.map((_, i) => {
          const rowPlaceholders = commonColumns.map((_, j) => `$${i * commonColumns.length + j + 1}`).join(', ');
          return `(${rowPlaceholders})`;
        }).join(', ');
        
        const insertQuery = `INSERT INTO "${tableName}" (${insertColumns}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
        const values = oldData.rows.flatMap(row => commonColumns.map(col => row[col]));
        
        await newPool.query(insertQuery, values);
        
        totalMigrated += oldData.rows.length;
        offset += batchSize;
        
        process.stdout.write(`   Progress: ${Math.min(offset, oldCount)}/${oldCount} (${Math.round((Math.min(offset, oldCount) / oldCount) * 100)}%)\r`);
      } catch (error) {
        console.error(`\n   ❌ Batch error at offset ${offset}:`, error.message);
        totalErrors++;
        offset += batchSize;
      }
    }
    
    const finalCount = await getTableRowCount(newPool, tableName);
    console.log(`\n   ✅ ${totalMigrated} rows migrated → ${finalCount} rows in new DB`);
    
    return { migrated: totalMigrated, skipped: oldCount - totalMigrated, errors: totalErrors };
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    return { migrated: 0, skipped: 0, errors: 1 };
  }
}

async function main() {
  console.log('🚀 Automated Database Migration');
  console.log('================================\n');
  
  try {
    console.log('🔍 Testing connections...');
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old DB: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New DB: Connected\n');
    
    console.log('📋 Discovering tables...');
    const oldTables = await getTables(oldPool);
    const newTables = await getTables(newPool);
    const common = oldTables.filter(t => newTables.includes(t));
    
    console.log(`   Old DB: ${oldTables.length} tables`);
    console.log(`   New DB: ${newTables.length} tables`);
    console.log(`   Common: ${common.length} tables\n`);
    
    console.log('🚀 Starting migration...\n');
    const results = {};
    
    for (const table of common) {
      results[table] = await migrateTable(oldPool, newPool, table);
    }
    
    // Summary
    console.log('\n📊 Migration Summary');
    console.log('====================');
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const [table, result] of Object.entries(results)) {
      if (result.migrated > 0 || result.errors > 0) {
        console.log(`${table}: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors} errors`);
      }
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }
    
    console.log(`\n🎉 Complete!`);
    console.log(`   Total: ${totalMigrated} rows migrated`);
    console.log(`   Skipped: ${totalSkipped} rows`);
    if (totalErrors > 0) {
      console.log(`   Errors: ${totalErrors} batches`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(console.error);

