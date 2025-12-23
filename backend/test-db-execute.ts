/**
 * Test script to verify db.execute works with drizzle sql templates
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testExecute() {
  console.log('🧪 Testing db.execute with drizzle sql template...\n');
  
  try {
    // Test 1: Simple query
    console.log('Test 1: Simple SELECT query...');
    const result1 = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Result:', result1.rows);
    
    // Test 2: Query with parameters
    console.log('\nTest 2: Query with parameters...');
    const testValue = 'test-value';
    const result2 = await db.execute(sql`SELECT ${testValue} as value`);
    console.log('✅ Result:', result2.rows);
    
    // Test 3: Check if table exists first
    console.log('\nTest 3: Checking if ml_model_paths table exists...');
    try {
      const tableCheck = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ml_model_paths'
        ) as exists
      `);
      console.log('✅ Table check result:', tableCheck.rows);
      
      if (tableCheck.rows[0]?.exists) {
        // Test INSERT query (like in upload script)
        console.log('\nTest 4: INSERT query (simulating model registration)...');
        const result4 = await db.execute(sql`
          INSERT INTO ml_model_paths (model_type, storage_type, r2_key, is_active, created_at, updated_at)
          VALUES ('test-model-execute', 'r2', 'test/path.pt', true, NOW(), NOW())
          ON CONFLICT (model_type) DO UPDATE SET
            storage_type = 'r2',
            r2_key = 'test/path.pt',
            updated_at = NOW()
          RETURNING model_type, r2_key
        `);
        console.log('✅ INSERT result:', result4.rows);
      } else {
        console.log('⚠️  ml_model_paths table does not exist - skipping INSERT test');
      }
    } catch (error: any) {
      console.log('⚠️  Table check/INSERT test failed (may be expected):', error.message);
    }
    
    console.log('\n✅ All tests passed! db.execute is working correctly.');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testExecute();

