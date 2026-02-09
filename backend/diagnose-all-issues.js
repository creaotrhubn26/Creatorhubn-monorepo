#!/usr/bin/env node
/**
 * Comprehensive Diagnostic Script
 * Checks all systems and identifies failures
 */

import pg from 'pg';

const { Pool } = pg;

const OLD_DB_URL = 'postgresql://neondb_owner:npg_RIFOSAo81mLc@ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_SM7AZYxyvK4L@ep-weathered-grass-abixeqb0-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

async function testConnection(pool, name) {
  try {
    await pool.query('SELECT NOW()');
    return { success: true, message: `✅ ${name}: Connected` };
  } catch (error) {
    return { success: false, message: `❌ ${name}: ${error.message}` };
  }
}

async function checkTable(pool, tableName) {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    `, [tableName]);
    return result.rows[0].count === '1';
  } catch (error) {
    return false;
  }
}

async function getRowCount(pool, tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return -1;
  }
}

async function main() {
  console.log('🔍 Comprehensive System Diagnostic');
  console.log('==================================\n');
  
  const issues = [];
  const oldPool = new Pool({
    connectionString: OLD_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  
  const newPool = new Pool({
    connectionString: NEW_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  
  try {
    // 1. Test database connections
    console.log('1. Database Connections:');
    const oldConn = await testConnection(oldPool, 'Old DB');
    console.log(`   ${oldConn.message}`);
    if (!oldConn.success) issues.push('Old database connection failed');
    
    const newConn = await testConnection(newPool, 'New DB');
    console.log(`   ${newConn.message}`);
    if (!newConn.success) issues.push('New database connection failed');
    
    if (!oldConn.success || !newConn.success) {
      console.log('\n❌ Cannot proceed - database connections failed');
      return;
    }
    
    // 2. Check critical tables
    console.log('\n2. Critical Tables Status:');
    const criticalTables = ['projects', 'users', 'profession_types', 'notes'];
    
    for (const table of criticalTables) {
      const oldExists = await checkTable(oldPool, table);
      const newExists = await checkTable(newPool, table);
      
      if (!oldExists) {
        console.log(`   ⚠️  ${table}: Not in old DB`);
        issues.push(`${table} missing in old DB`);
        continue;
      }
      
      if (!newExists) {
        console.log(`   ❌ ${table}: Not in new DB`);
        issues.push(`${table} missing in new DB`);
        continue;
      }
      
      const oldCount = await getRowCount(oldPool, table);
      const newCount = await getRowCount(newPool, table);
      
      if (oldCount === -1) {
        console.log(`   ❌ ${table}: Cannot read from old DB`);
        issues.push(`Cannot read ${table} from old DB`);
      } else if (newCount === -1) {
        console.log(`   ❌ ${table}: Cannot read from new DB`);
        issues.push(`Cannot read ${table} from new DB`);
      } else if (oldCount > 0 && newCount === 0) {
        console.log(`   ⚠️  ${table}: ${oldCount} rows in old, 0 in new (NOT MIGRATED)`);
        issues.push(`${table} not migrated (${oldCount} rows missing)`);
      } else if (oldCount > newCount) {
        console.log(`   ⚠️  ${table}: ${oldCount} in old, ${newCount} in new (PARTIAL)`);
        issues.push(`${table} partially migrated (${oldCount - newCount} rows missing)`);
      } else {
        console.log(`   ✅ ${table}: ${oldCount} rows (migrated)`);
      }
    }
    
    // 3. Check schema differences for projects
    console.log('\n3. Schema Analysis (projects table):');
    try {
      const [oldCols, newCols] = await Promise.all([
        oldPool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'projects' 
          AND table_schema = 'public'
          ORDER BY ordinal_position
        `),
        newPool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'projects' 
          AND table_schema = 'public'
          ORDER BY ordinal_position
        `)
      ]);
      
      const oldColNames = oldCols.rows.map(r => r.column_name);
      const newColNames = newCols.rows.map(r => r.column_name);
      
      console.log(`   Old DB: ${oldColNames.length} columns`);
      console.log(`   New DB: ${newColNames.length} columns`);
      
      const onlyInOld = oldColNames.filter(c => !newColNames.includes(c));
      const onlyInNew = newColNames.filter(c => !oldColNames.includes(c));
      const common = oldColNames.filter(c => newColNames.includes(c));
      
      if (onlyInOld.length > 0) {
        console.log(`   ⚠️  Only in old: ${onlyInOld.slice(0, 5).join(', ')}${onlyInOld.length > 5 ? '...' : ''}`);
      }
      if (onlyInNew.length > 0) {
        console.log(`   ⚠️  Only in new: ${onlyInNew.slice(0, 5).join(', ')}${onlyInNew.length > 5 ? '...' : ''}`);
      }
      console.log(`   ✅ Common: ${common.length} columns`);
      
      if (onlyInOld.length > 0 || onlyInNew.length > 0) {
        issues.push('Schema mismatch in projects table');
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      issues.push('Cannot analyze schema');
    }
    
    // 4. Summary
    console.log('\n📊 Summary:');
    if (issues.length === 0) {
      console.log('   ✅ No issues found!');
    } else {
      console.log(`   ❌ Found ${issues.length} issues:`);
      issues.forEach((issue, i) => {
        console.log(`      ${i + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
  } finally {
    await oldPool.end();
    await newPool.end();
  }
}

main().catch(console.error);

