#!/usr/bin/env node
/**
 * Schema-Aware Migration Script
 * Handles schema differences between old and new databases
 */

import pg from 'pg';

const { Pool } = pg;

const OLD_DB_URL = 'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Column mappings for tables with schema differences
const COLUMN_MAPPINGS = {
  projects: {
    // Map old column names to new column names
    'name': 'client_name', // or handle differently
    // Skip columns that don't exist in new schema
    skip: ['wedding_id', 'profession', 'original_filename']
  }
};

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
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows;
}

async function getTableRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

async function migrateTableWithMapping(oldPool, newPool, tableName) {
  console.log(`\n📦 Migrating: ${tableName}`);
  
  try {
    const oldCount = await getTableRowCount(oldPool, tableName);
    if (oldCount === 0) {
      console.log(`   ⏭️  No data (0 rows)`);
      return { migrated: 0, skipped: 0, errors: 0 };
    }
    
    const oldColumns = await getTableColumns(oldPool, tableName);
    const newColumns = await getTableColumns(newPool, tableName);
    
    const oldColumnNames = oldColumns.map(c => c.column_name);
    const newColumnNames = newColumns.map(c => c.column_name);
    
    // Get column mapping if exists
    const mapping = COLUMN_MAPPINGS[tableName] || {};
    const skipColumns = mapping.skip || [];
    
    // Filter out columns to skip
    const filteredOldColumns = oldColumnNames.filter(col => !skipColumns.includes(col));
    
    // Map old column names to new column names
    const mappedColumns = filteredOldColumns.map(oldCol => {
      if (mapping[oldCol]) {
        return { old: oldCol, new: mapping[oldCol] };
      }
      // If column exists in new schema, use it
      if (newColumnNames.includes(oldCol)) {
        return { old: oldCol, new: oldCol };
      }
      return null;
    }).filter(Boolean);
    
    const sourceColumns = mappedColumns.map(m => m.old);
    const targetColumns = mappedColumns.map(m => m.new);
    
    if (sourceColumns.length === 0) {
      console.log(`   ⚠️  No mappable columns`);
      return { migrated: 0, skipped: oldCount, errors: 0 };
    }
    
    console.log(`   Mapping ${sourceColumns.length} columns`);
    console.log(`   Source: ${sourceColumns.slice(0, 5).join(', ')}${sourceColumns.length > 5 ? '...' : ''}`);
    console.log(`   Target: ${targetColumns.slice(0, 5).join(', ')}${targetColumns.length > 5 ? '...' : ''}`);
    
    // Migrate in small batches
    let offset = 0;
    let totalMigrated = 0;
    let totalErrors = 0;
    const batchSize = 50; // Smaller batches for problematic tables
    
    while (offset < oldCount) {
      try {
        // Select from old with source columns
        const selectQuery = `SELECT ${sourceColumns.map(c => `"${c}"`).join(', ')} FROM "${tableName}" ORDER BY (SELECT NULL) LIMIT $1 OFFSET $2`;
        const oldData = await oldPool.query(selectQuery, [batchSize, offset]);
        
        if (oldData.rows.length === 0) break;
        
        // Build insert with target columns
        const insertColumns = targetColumns.map(c => `"${c}"`).join(', ');
        const values = oldData.rows.flatMap(row => 
          mappedColumns.map(m => row[m.old])
        );
        
        const placeholders = oldData.rows.map((_, i) => {
          return `(${mappedColumns.map((_, j) => `$${i * mappedColumns.length + j + 1}`).join(', ')})`;
        }).join(', ');
        
        const insertQuery = `INSERT INTO "${tableName}" (${insertColumns}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
        
        await newPool.query(insertQuery, values);
        
        totalMigrated += oldData.rows.length;
        offset += batchSize;
        
        process.stdout.write(`   Progress: ${Math.min(offset, oldCount)}/${oldCount}\r`);
      } catch (error) {
        console.error(`\n   ❌ Batch error: ${error.message.substring(0, 100)}`);
        totalErrors++;
        offset += batchSize;
        
        if (totalErrors > 5) {
          console.log(`   ⚠️  Too many errors, stopping`);
          break;
        }
      }
    }
    
    const finalCount = await getTableRowCount(newPool, tableName);
    console.log(`\n   ${totalMigrated > 0 ? '✅' : '⚠️'} ${totalMigrated} rows migrated → ${finalCount} in new DB`);
    
    return { migrated: totalMigrated, skipped: oldCount - totalMigrated, errors: totalErrors };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { migrated: 0, skipped: 0, errors: 1 };
  }
}

async function main() {
  console.log('🔧 Schema-Aware Migration for Failed Tables');
  console.log('===========================================\n');
  
  // Critical tables that failed
  const criticalTables = [
    'projects',
    'users',
    'profession_types',
    'proposal_templates',
    'showcase_galleries',
    'showcase_templates',
    'notes',
  ];
  
  try {
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old DB: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New DB: Connected\n');
    
    console.log(`Migrating ${criticalTables.length} critical tables...\n`);
    
    const results = {};
    for (const table of criticalTables) {
      results[table] = await migrateTableWithMapping(oldPool, newPool, table);
    }
    
    console.log('\n📊 Results:');
    for (const [table, result] of Object.entries(results)) {
      if (result.migrated > 0) {
        console.log(`✅ ${table}: ${result.migrated} rows`);
      } else {
        console.log(`❌ ${table}: ${result.errors} errors`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(console.error);

