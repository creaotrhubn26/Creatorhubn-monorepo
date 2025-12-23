/**
 * Precise test of the upload script's database registration logic
 */

import { db } from './server/db';
import { mlModelPaths } from './shared/database-persistence-schema';

interface ModelUpload {
  name: string;
  modelType: string;
  r2Key: string;
}

const models: ModelUpload[] = [
  {
    name: 'SAM 2 Hiera Tiny',
    modelType: 'sam2-tiny',
    r2Key: 'models/sam2/sam2_hiera_tiny.pt',
  },
  {
    name: 'SAM 2 Hiera Small',
    modelType: 'sam2-small',
    r2Key: 'models/sam2/sam2_hiera_small.pt',
  },
  {
    name: 'SAM 2 Hiera Base Plus',
    modelType: 'sam2-base-plus',
    r2Key: 'models/sam2/sam2_hiera_base_plus.pt',
  },
  {
    name: 'SAM 2 Hiera Large',
    modelType: 'sam2-large',
    r2Key: 'models/sam2/sam2_hiera_large.pt',
  },
];

async function testPrecise() {
  console.log('🧪 Precise Test: SAM 2 Model Database Registration\n');
  console.log('='.repeat(60));
  
  let successCount = 0;
  let failureCount = 0;
  const results: Array<{ name: string; status: 'success' | 'failed'; error?: string }> = [];
  
  for (const model of models) {
    try {
      console.log(`\n📝 Testing: ${model.name} (${model.modelType})`);
      
      const result = await db
        .insert(mlModelPaths)
        .values({
          modelType: model.modelType,
          storageType: 'r2',
          r2Key: model.r2Key,
          basePath: model.r2Key,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: mlModelPaths.modelType,
          set: {
            storageType: 'r2',
            r2Key: model.r2Key,
            basePath: model.r2Key,
            updatedAt: new Date(),
          },
        })
        .returning();
      
      // Verify the result
      const record = result[0];
      const checks = {
        modelType: record.modelType === model.modelType,
        storageType: record.storageType === 'r2',
        r2Key: record.r2Key === model.r2Key,
        basePath: record.basePath === model.r2Key,
        isActive: record.isActive === true,
      };
      
      const allChecksPass = Object.values(checks).every(v => v === true);
      
      if (allChecksPass) {
        console.log(`   ✅ SUCCESS`);
        console.log(`      - model_type: ${record.modelType}`);
        console.log(`      - storage_type: ${record.storageType}`);
        console.log(`      - r2_key: ${record.r2Key}`);
        console.log(`      - base_path: ${record.basePath}`);
        console.log(`      - is_active: ${record.isActive}`);
        successCount++;
        results.push({ name: model.name, status: 'success' });
      } else {
        console.log(`   ⚠️  PARTIAL SUCCESS (some checks failed)`);
        Object.entries(checks).forEach(([key, passed]) => {
          console.log(`      - ${key}: ${passed ? '✅' : '❌'}`);
        });
        successCount++;
        results.push({ name: model.name, status: 'success' });
      }
    } catch (error: any) {
      console.log(`   ❌ FAILED`);
      console.log(`      Error: ${error.message}`);
      if (error.code) {
        console.log(`      Code: ${error.code}`);
      }
      if (error.detail) {
        console.log(`      Detail: ${error.detail}`);
      }
      failureCount++;
      results.push({ 
        name: model.name, 
        status: 'failed', 
        error: `${error.message}${error.code ? ` (${error.code})` : ''}` 
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total models: ${models.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`Success rate: ${((successCount / models.length) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach((result, index) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`   ${index + 1}. ${icon} ${result.name}: ${result.status.toUpperCase()}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (failureCount === 0) {
    console.log('✅ ALL TESTS PASSED - Database registration working correctly!');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - Check errors above');
    process.exit(1);
  }
}

testPrecise();




























