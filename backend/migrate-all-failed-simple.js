#!/usr/bin/env node
/**
 * Simple Migration for All Failed Tables
 * Migrates only common columns, skips schema differences
 */

import pg from 'pg';

const { Pool } = pg;

const OLD_DB_URL = 'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

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
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
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

async function getRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

async function tableExists(pool, tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function migrateTableSimple(oldPool, newPool, tableName) {
  try {
    // Check if tables exist
    const oldExists = await tableExists(oldPool, tableName);
    const newExists = await tableExists(newPool, tableName);
    
    if (!oldExists) {
      return { migrated: 0, skipped: 0, errors: 0, reason: 'not_in_old' };
    }
    
    if (!newExists) {
      return { migrated: 0, skipped: 0, errors: 0, reason: 'not_in_new' };
    }
    
    // Get columns
    const oldColumns = await getTableColumns(oldPool, tableName);
    const newColumns = await getTableColumns(newPool, tableName);
    
    const oldColNames = oldColumns.map(c => c.column_name);
    const newColNames = newColumns.map(c => c.column_name);
    
    // Find common columns (exact name match)
    const commonColumns = oldColNames.filter(col => newColNames.includes(col));
    
    if (commonColumns.length === 0) {
      return { migrated: 0, skipped: 0, errors: 0, reason: 'no_common_columns' };
    }
    
    const oldCount = await getRowCount(oldPool, tableName);
    if (oldCount === 0) {
      return { migrated: 0, skipped: 0, errors: 0, reason: 'no_data' };
    }
    
    // Check if already migrated
    const newCount = await getRowCount(newPool, tableName);
    if (newCount >= oldCount) {
      return { migrated: 0, skipped: oldCount, errors: 0, reason: 'already_migrated' };
    }
    
    // Migrate in small batches
    let offset = 0;
    let totalMigrated = 0;
    let totalErrors = 0;
    const batchSize = 50;
    
    while (offset < oldCount && totalErrors < 5) {
      try {
        const selectQuery = `SELECT ${commonColumns.map(c => `"${c}"`).join(', ')} FROM "${tableName}" LIMIT $1 OFFSET $2`;
        const oldData = await oldPool.query(selectQuery, [batchSize, offset]);
        
        if (oldData.rows.length === 0) break;
        
        // Build insert
        const values = oldData.rows.flatMap(row => commonColumns.map(col => row[col]));
        const placeholders = oldData.rows.map((_, i) => {
          return `(${commonColumns.map((_, j) => `$${i * commonColumns.length + j + 1}`).join(', ')})`;
        }).join(', ');
        
        const insertQuery = `INSERT INTO "${tableName}" (${commonColumns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
        
        await newPool.query(insertQuery, values);
        
        totalMigrated += oldData.rows.length;
        offset += batchSize;
        
        process.stdout.write(`   ${tableName}: ${Math.min(offset, oldCount)}/${oldCount}\r`);
      } catch (error) {
        totalErrors++;
        offset += batchSize;
        // Skip this batch and continue
      }
    }
    
    return { migrated: totalMigrated, skipped: oldCount - totalMigrated, errors: totalErrors };
  } catch (error) {
    return { migrated: 0, skipped: 0, errors: 1, reason: error.message };
  }
}

async function main() {
  console.log('🚀 Simple Migration for All Failed Tables');
  console.log('=========================================\n');
  
  // Get all failed tables from the migration output
  const failedTables = [
    'projects', 'users', 'profession_types', 'proposal_templates',
    'showcase_galleries', 'showcase_templates', 'notes', 'wedding_timelines',
    'sales_activities', 'sales_analytics', 'sales_conversations', 'sales_leads',
    // Add more as needed
  ];
  
  try {
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old DB: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New DB: Connected\n');
    
    console.log(`Migrating ${failedTables.length} critical tables...\n`);
    
    const results = {};
    for (const table of failedTables) {
      const result = await migrateTableSimple(oldPool, newPool, table);
      results[table] = result;
      
      if (result.migrated > 0) {
        console.log(`\n✅ ${table}: ${result.migrated} rows migrated`);
      } else if (result.reason) {
        console.log(`\n⚠️  ${table}: ${result.reason}`);
      }
    }
    
    console.log('\n📊 Summary:');
    let totalMigrated = 0;
    for (const [table, result] of Object.entries(results)) {
      if (result.migrated > 0) {
        console.log(`✅ ${table}: ${result.migrated} rows`);
        totalMigrated += result.migrated;
      }
    }
    console.log(`\n🎉 Total migrated: ${totalMigrated} rows`);
    
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(console.error);

