#!/usr/bin/env node
/**
 * Smart Migration - Handles Data Type Conversions and Constraints
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
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);
  return result.rows;
}

async function getRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

function convertValue(value, oldType, newType, isNullable, columnName) {
  // Skip ID columns - let new DB auto-generate them
  if (columnName === 'id') {
    const oldIsString = oldType.includes('uuid') || oldType.includes('varchar') || oldType.includes('character');
    const newIsInteger = newType.includes('integer');
    if (oldIsString && newIsInteger) {
      return null; // Will be excluded from insert
    }
  }
  
  if (value === null || value === undefined) {
    // For NOT NULL columns, return null to skip the row (we'll filter these out)
    if (!isNullable) {
      return null; // Signal to skip this row
    }
    return null;
  }
  
  // Handle UUID/varchar to integer conversion (for non-ID columns)
  if ((oldType.includes('uuid') || oldType.includes('varchar') || oldType.includes('character')) && newType.includes('integer')) {
    const str = String(value);
    // If it's a UUID format, skip it (can't convert meaningfully)
    if (str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return null; // Signal to skip this row
    }
    // Try to parse as integer
    const parsed = parseInt(str, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
    return null; // Signal to skip this row
  }
  
  // Handle string to integer (for notes table)
  if (oldType.includes('varchar') || oldType.includes('text') && newType.includes('integer')) {
    const str = String(value);
    // If it's not a number, skip
    if (!str.match(/^-?[0-9]+$/)) {
      return null; // Signal to skip
    }
    return parseInt(str, 10);
  }
  
  // Handle integer to UUID (convert to string)
  if (oldType.includes('integer') && newType.includes('uuid')) {
    return String(value);
  }
  
  // Handle JSON validation
  if (newType.includes('json')) {
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return '{}'; // Invalid JSON, return empty object
      }
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return '{}';
  }
  
  return value;
}

async function migrateTableSmart(oldPool, newPool, tableName) {
  console.log(`\n📦 Migrating: ${tableName}`);
  
  try {
    const oldCols = await getTableColumns(oldPool, tableName);
    const newCols = await getTableColumns(newPool, tableName);
    
    const oldColMap = new Map(oldCols.map(c => [c.column_name, c]));
    const newColMap = new Map(newCols.map(c => [c.column_name, c]));
    
    // Find common columns with type info, excluding ID columns that need auto-generation
    const common = oldCols
      .filter(c => {
        const newCol = newColMap.get(c.column_name);
        if (!newCol) return false;
        // Skip ID column if old is UUID/varchar and new is serial/integer
        if (c.column_name === 'id') {
          const oldIsString = c.data_type.includes('uuid') || c.data_type.includes('varchar') || c.data_type.includes('character');
          const newIsInteger = newCol.data_type.includes('integer') || newCol.column_default?.includes('nextval');
          if (oldIsString && newIsInteger) {
            return false; // Let new DB auto-generate
          }
        }
        return true;
      })
      .map(c => ({
        name: c.column_name,
        oldType: c.data_type,
        newType: newColMap.get(c.column_name).data_type,
        isNullable: newColMap.get(c.column_name).is_nullable === 'YES',
        hasDefault: !!newColMap.get(c.column_name).column_default,
      }));
    
    if (common.length === 0) {
      console.log(`   ⚠️  No common columns`);
      return { migrated: 0, reason: 'no_common_columns' };
    }
    
    const oldCount = await getRowCount(oldPool, tableName);
    if (oldCount === 0) {
      console.log(`   ⏭️  No data`);
      return { migrated: 0, reason: 'no_data' };
    }
    
    console.log(`   Common columns: ${common.length}`);
    console.log(`   Rows: ${oldCount}`);
    
    // Clear existing
    const newCount = await getRowCount(newPool, tableName);
    if (newCount > 0) {
      await newPool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }
    
    // Migrate row by row to handle conversions
    let totalMigrated = 0;
    let totalSkipped = 0;
    let errors = 0;
    const batchSize = 50;
    let offset = 0;
    
    while (offset < oldCount && errors < 10) {
      try {
        // Get batch from old DB
        const selectQuery = `SELECT ${common.map(c => `"${c.name}"`).join(', ')} FROM "${tableName}" LIMIT $1 OFFSET $2`;
        const oldData = await oldPool.query(selectQuery, [batchSize, offset]);
        
        if (oldData.rows.length === 0) break;
        
        // Process each row individually to handle conversions
        const errorLog = [];
        for (const row of oldData.rows) {
          try {
            // Convert values based on type differences
            const convertedValues = [];
            const columnsToInsert = [];
            
            for (const col of common) {
              const value = row[col.name];
              const converted = convertValue(value, col.oldType, col.newType, col.isNullable, col.name);
              
              // If conversion returned null for NOT NULL column, skip this entire row
              if (converted === null && !col.isNullable) {
                throw new Error(`NULL value for required column: ${col.name}`);
              }
              
              // Only include non-null values (or nullable nulls)
              if (converted !== null || col.isNullable) {
                columnsToInsert.push(col);
                convertedValues.push(converted);
              }
            }
            
            // Skip if no valid columns
            if (columnsToInsert.length === 0) {
              totalSkipped++;
              continue;
            }
            
            // Build insert for single row
            const insertQuery = `INSERT INTO "${tableName}" (${columnsToInsert.map(c => `"${c.name}"`).join(', ')}) VALUES (${columnsToInsert.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`;
            
            await newPool.query(insertQuery, convertedValues);
            totalMigrated++;
          } catch (rowError) {
            totalSkipped++;
            // Log first 5 errors to understand what's failing
            if (errorLog.length < 5 && !rowError.message.includes('NULL value for required')) {
              errorLog.push({
                error: rowError.message.substring(0, 100),
                code: rowError.code,
                constraint: rowError.constraint,
              });
            }
            // Skip this row and continue
            if (totalSkipped % 10 === 0) {
              process.stdout.write(`   Skipped: ${totalSkipped} rows\r`);
            }
          }
        }
        
        // Show errors if any
        if (errorLog.length > 0 && totalSkipped <= 50) {
          console.log(`\n   ⚠️  Sample errors:`);
          errorLog.forEach((err, i) => {
            console.log(`      ${i + 1}. ${err.code || 'ERROR'}: ${err.error}`);
            if (err.constraint) console.log(`         Constraint: ${err.constraint}`);
          });
        }
        
        offset += batchSize;
        process.stdout.write(`   Progress: ${Math.min(offset, oldCount)}/${oldCount} (${totalMigrated} migrated)\r`);
      } catch (batchError) {
        errors++;
        offset += batchSize;
        if (errors < 3) {
          console.error(`\n   ⚠️  Batch error: ${batchError.message.substring(0, 60)}`);
        }
      }
    }
    
    const finalCount = await getRowCount(newPool, tableName);
    console.log(`\n   ${totalMigrated > 0 ? '✅' : '⚠️'} Migrated: ${totalMigrated} rows (skipped: ${totalSkipped}) → ${finalCount} in new DB`);
    
    return { migrated: totalMigrated, skipped: totalSkipped, finalCount };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { migrated: 0, reason: error.message };
  }
}

async function main() {
  console.log('🚀 Smart Migration (Handles Data Type Conversions)');
  console.log('====================================================\n');
  
  // Migrate in order to handle foreign keys: users first, then projects
  const criticalTables = [
    'users',           // First - no dependencies
    'profession_types', // Second - usually independent
    'projects',        // Third - may reference users
    'notes',           // Last - may reference projects/users
  ];
  
  try {
    await oldPool.query('SELECT NOW()');
    console.log('✅ Old DB: Connected');
    await newPool.query('SELECT NOW()');
    console.log('✅ New DB: Connected\n');
    
    const results = {};
    for (const table of criticalTables) {
      results[table] = await migrateTableSmart(oldPool, newPool, table);
    }
    
    console.log('\n📊 Final Summary:');
    let total = 0;
    for (const [table, result] of Object.entries(results)) {
      if (result.migrated > 0) {
        console.log(`✅ ${table}: ${result.migrated} rows (skipped: ${result.skipped}) → ${result.finalCount} in new DB`);
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

