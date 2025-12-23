/**
 * Test if db methods are available
 */

import { db } from './server/db';
import { mlModelPaths } from './shared/database-persistence-schema';

async function test() {
  console.log('🔍 Checking db methods...\n');
  
  console.log('db type:', typeof db);
  console.log('db.insert:', typeof db.insert);
  console.log('db.select:', typeof db.select);
  console.log('db.update:', typeof db.update);
  console.log('db.delete:', typeof db.delete);
  console.log('db.execute:', typeof db.execute);
  
  console.log('\n📋 db object keys (first 20):');
  console.log(Object.keys(db).slice(0, 20));
  
  if (typeof db.insert !== 'function') {
    console.error('\n❌ db.insert is not a function!');
    console.error('This means Object.assign did not preserve drizzle methods.');
    process.exit(1);
  }
  
  console.log('\n✅ db.insert is available, testing insert...');
  
  try {
    const result = await db
      .insert(mlModelPaths)
      .values({
        modelType: 'test-check-' + Date.now(),
        storageType: 'r2',
        r2Key: 'test/key.pt',
        basePath: 'test/key.pt',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: mlModelPaths.modelType,
        set: {
          storageType: 'r2',
          r2Key: 'test/key.pt',
          basePath: 'test/key.pt',
          updatedAt: new Date(),
        },
      })
      .returning();
    
    console.log('✅ Insert successful:', result[0].modelType);
    
    // Cleanup
    await db.delete(mlModelPaths).where(eq(mlModelPaths.modelType, result[0].modelType));
    console.log('✅ Cleanup successful');
    
  } catch (error: any) {
    console.error('\n❌ Insert failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    process.exit(1);
  }
}

import { eq } from 'drizzle-orm';
test();




























