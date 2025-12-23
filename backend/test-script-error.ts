/**
 * Test to reproduce the exact error from the upload script
 */

import { db } from './server/db';
import { mlModelPaths } from './shared/database-persistence-schema';

async function test() {
  console.log('Testing db.insert method...');
  console.log('db type:', typeof db);
  console.log('db.insert type:', typeof db.insert);
  console.log('db keys:', Object.keys(db).slice(0, 10));
  
  try {
    const result = await db
      .insert(mlModelPaths)
      .values({
        modelType: 'test-model',
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
      });
    console.log('✅ Success');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();




























