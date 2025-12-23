#!/usr/bin/env node
/**
 * Migrate Critical Tables - Handles Schema Differences
 * Migrates projects, users, and other critical tables
 */

import pg from 'pg';

const { Pool } = pg;

const OLD_DB_URL = 'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_cb9HrCJxwg6U@ep-broad-surf-abadxt78-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

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

async function getTableColumns(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function getRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

async function migrateTable(oldPool, newPool, tableName) {
  console.log(`\n📦 Migrating: ${tableName}`);
  
  try {
    const oldCols = await getTableColumns(oldPool, tableName);
    const newCols = await getTableColumns(newPool, tableName);
    
    // Find common columns
    const common = oldCols.filter(c => newCols.includes(c));
    
    if (common.length === 0) {
      console.log(`   ⚠️  No common columns`);
      return { migrated: 0, reason: 'no_common_columns' };
    }
    
    const oldCount = await getRowCount(oldPool, tableName);
    if (oldCount === 0) {
      console.log(`   ⏭️  No data`);
      return { migrated: 0, reason: 'no_data' };
    }
    
    console.log(`   Common columns: ${common.length}/${oldCols.length}`);
    console.log(`   Rows to migrate: ${oldCount}`);
    
    // Clear existing data in new table
    const newCount = await getRowCount(newPool, tableName);
    if (newCount > 0) {
      await newPool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      console.log(`   🗑️  Cleared ${newCount} existing rows`);
    }
    
    // Migrate in batches
    let offset = 0;
    let totalMigrated = 0;
    let errors = 0;
    const batchSize = 100;
    
    while (offset < oldCount && errors < 3) {
      try {
        const selectQuery = `SELECT ${common.map(c => `"${c}"`).join(', ')} FROM "${tableName}" LIMIT $1 OFFSET $2`;
        const data = await oldPool.query(selectQuery, [batchSize, offset]);
        
        if (data.rows.length === 0) break;
        
        const values = data.rows.flatMap(row => common.map(col => row[col]));
        const placeholders = data.rows.map((_, i) => {
          return `(${common.map((_, j) => `$${i * common.length + j + 1}`).join(', ')})`;
        }).join(', ');
        
        const insertQuery = `INSERT INTO "${tableName}" (${common.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
        
        await newPool.query(insertQuery, values);
        
        totalMigrated += data.rows.length;
        offset += batchSize;
        
        process.stdout.write(`   Progress: ${Math.min(offset, oldCount)}/${oldCount}\r`);
      } catch (error) {
        console.error(`\n   ❌ Batch error: ${error.message.substring(0, 80)}`);
        errors++;
        offset += batchSize;
      }
    }
    
    const finalCount = await getRowCount(newPool, tableName);
    console.log(`\n   ${totalMigrated > 0 ? '✅' : '⚠️'} Migrated: ${totalMigrated} → ${finalCount} in new DB`);
    
    return { migrated: totalMigrated, finalCount };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { migrated: 0, reason: error.message };
  }
}

async function main() {
  console.log('🚀 Migrate Critical Tables');
  console.log('==========================\n');
  
  const criticalTables = [
    'projects',
    'users', 
    'profession_types',
    'notes',
    'proposal_templates',
    'showcase_galleries',
    'showcase_templates',
  ];
  
  try {
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old DB: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New DB: Connected\n');
    
    const results = {};
    for (const table of criticalTables) {
      results[table] = await migrateTable(oldPool, newPool, table);
    }
    
    console.log('\n📊 Final Summary:');
    let total = 0;
    for (const [table, result] of Object.entries(results)) {
      if (result.migrated > 0) {
        console.log(`✅ ${table}: ${result.migrated} rows → ${result.finalCount} in new DB`);
        total += result.migrated;
      } else {
        console.log(`❌ ${table}: Failed (${result.reason || 'unknown'})`);
      }
    }
    console.log(`\n🎉 Total: ${total} rows migrated`);
    
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(console.error);

