/**
 * Hair Models Inspector Script
 * 
 * Run this script to inspect downloaded hair GLB files and extract mesh names.
 * This helps us update hairStyles.ts with correct meshName values.
 * 
 * Usage (in browser console):
 * ```typescript
 * import { inspectAllHairModels } from './scripts/inspectHairModels';
 * await inspectAllHairModels();
 * ```
 */

import { inspectGLB, printGLBInfo } from '../src/core/utils/glbInspector';

/**
 * Inspect the Male Fashion Hair Collection
 */
export async function inspectMaleFashionCollection(): Promise<void> {
  const path = '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb';
  
  console.log('🔍 Inspecting Male Fashion Hair Collection...\n , ');
  
  try {
    const info = await inspectGLB(path);
    printGLBInfo(info);
    
    // Generate hairStyles.ts entries
    console.log('\n📝 Suggested hairStyles.ts entries: ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n,');
    
    info.meshes.forEach((mesh, index) => {
      const id = mesh.name.toLowerCase().replace(/[^a-z0-9]/g'_');
      console.log(`{
  id: 'male_${id}',
  name: '${mesh.name}',
  description: 'TODO: Add description',
  gender: 'male',
  ageRange: 'adult',
  length: 'short', // TODO: Adjust
  style: 'straight', // TODO: Adjust
  modelPath: '${path}',
  meshName: '${mesh.name}',
  polyCount: ${mesh.triangles},
  tags: ['TODO'],
},\n`);
    });
    
  } catch (error) {
    console.error('❌ Failed to inspect GLB: ', error);
  }
}

/**
 * Inspect all downloaded hair models
 */
export async function inspectAllHairModels(): Promise<void> {
  const models = [
    '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb',
    // Add more as they're downloaded
  ];
  
  for (const modelPath of models) {
    try {
      const info = await inspectGLB(modelPath);
      printGLBInfo(info);
    } catch (error) {
      console.error(`❌ Failed to inspect ${modelPath}:`, error);
    }
  }
}

/**
 * Quick test to verify GLB file exists and is loadable
 */
export async function testHairModelLoading(): Promise<void> {
  const path = '/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb';
  
  console.log('🧪 Testing hair model loading...\n');
  
  try {
    const info = await inspectGLB(path);
    
    if (info.totalMeshes === 0) {
      console.error('❌ No meshes found in GLB file!');
      return;
    }
    
    console.log(`✅ GLB file loaded successfully!`);
    console.log(`   Meshes: ${info.totalMeshes}`);
    console.log(`   Vertices: ${info.totalVertices.toLocaleString()}`);
    console.log(`   Triangles: ${info.totalTriangles.toLocaleString()}`);
    
    if (info.totalMeshes === 21) {
      console.log('\n✅ Expected 21 hairstyles found!');
    } else {
      console.warn(`\n⚠️ Expected 21 hairstyles, found ${info.totalMeshes}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to load GLB file:', error);
    console.log('\n💡 Possible issues:');
    console.log('   1. File path is incorrect');
    console.log('   2. File is not in public folder');
    console.log('   3. File is corrupted');
    console.log('   4. CORS issue (check server configuration)');
  }
}

// Export for use in browser console
if (typeof window !=='undefined') {
  (window as any).inspectHairModels = {
    inspectMaleFashionCollection,
    inspectAllHairModels,
    testHairModelLoading,
  };
  
  console.log('🔧 Hair model inspector loaded!');
  console.log('   Run: inspectHairModels.testHairModelLoading()');
  console.log('   Run: inspectHairModels.inspectMaleFashionCollection()');
}

