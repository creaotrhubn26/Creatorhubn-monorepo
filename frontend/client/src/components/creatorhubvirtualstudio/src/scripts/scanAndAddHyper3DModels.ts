/**
 * Standalone script to scan for Hyper3D models and add them to the library
 * 
 * This script can be run from the browser console or imported in the Virtual Studio
 * 
 * Usage in browser console:
 *   import('/src/components/creatorhubvirtualstudio/src/scripts/scanAndAddHyper3DModels.ts').then(m => m.scanAndAddAllModels())
 */

import { addHyper3DModel, addHyper3DModels } from './addHyper3DModelsToLibrary';

/**
 * Known Hyper3D model locations based on the generation scripts
 * Update this list as you generate more models
 */
/**
 * Known Hyper3D model locations
 * 
 * Based on actual file system structure:
 * - 3D Models (GLB): public/models/modifiers/[name]/[name].glb
 * 
 * Currently, only 6 modifier models exist in the file system.
 * This list will be updated as more models are generated.
 */
const KNOWN_HYPER3D_MODELS = [
  // Modifiers (actual structure: /models/modifiers/[name]/[name].glb)
  // These are the 6 models that actually exist in the file system
  {
    url: '/models/modifiers/beauty-dish/beauty-dish.glb',
    title: 'Beauty Dish Modifier',
    type: 'light' as const,
    tags: ['beauty-dish', 'modifier', 'hyper3d'],
  },
  {
    url: '/models/modifiers/softbox/softbox.glb',
    title: 'Softbox Modifier',
    type: 'light' as const,
    tags: ['softbox', 'modifier', 'hyper3d'],
  },
  {
    url: '/models/modifiers/stripbox/stripbox.glb',
    title: 'Stripbox Modifier',
    type: 'light' as const,
    tags: ['stripbox', 'modifier', 'hyper3d'],
  },
  {
    url: '/models/modifiers/octabox/octabox.glb',
    title: 'Octabox Modifier',
    type: 'light' as const,
    tags: ['octabox', 'modifier', 'hyper3d'],
  },
  {
    url: '/models/modifiers/reflector/reflector.glb',
    title: 'Reflector Modifier',
    type: 'light' as const,
    tags: ['reflector', 'modifier', 'hyper3d'],
  },
  {
    url: '/models/modifiers/standard-reflector/standard-reflector.glb',
    title: 'Standard Reflector Modifier',
    type: 'light' as const,
    tags: ['reflector', 'modifier', 'hyper3d'],
  },
];

/**
 * Check if a model file exists by trying to fetch it
 */
async function checkModelExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Scan for existing models and add them to the library
 * 
 * The script will now:
 * 1. Find the 6 existing modifier models in /models/modifiers/[name]/[name].glb
 * 2. Add them to the library if not already there
 * 3. Check for other models in the expected locations
 */
export async function scanAndAddAllModels(): Promise<{
  checked: number;
  added: number;
  failed: number;
  skipped: number;
  notFound: number;
  results: Array<{ url: string; status: 'added' | 'failed' | 'skipped' | 'not-found'; assetId?: string; error?: string }>;
}> {
  console.log('🔍 Scanning for Hyper3D models...');
  console.log(`📋 Checking ${KNOWN_HYPER3D_MODELS.length} known models...`);
  console.log('💡 Note: Only models that exist in the file system will be added.');

  const results = {
    checked: 0,
    added: 0,
    failed: 0,
    skipped: 0,
    notFound: 0,
    results: [] as Array<{ url: string; status: 'added' | 'failed' | 'skipped' | 'not-found'; assetId?: string; error?: string }>,
  };

  for (const model of KNOWN_HYPER3D_MODELS) {
    results.checked++;
    console.log(`\n[${results.checked}/${KNOWN_HYPER3D_MODELS.length}] Checking: ${model.url}`);

    // Check if file exists
    const exists = await checkModelExists(model.url);
    if (!exists) {
      console.log(`  ⚠️  File not found, skipping...`);
      results.notFound++;
      results.results.push({ url: model.url, status: 'not-found' });
      continue;
    }

    console.log(`  ✅ File exists, adding to library...`);

    // Try to add to library
    const result = await addHyper3DModel(model.url, {
      title: model.title,
      type: model.type,
      tags: model.tags,
    });

    if (result.success) {
      results.added++;
      results.results.push({ url: model.url, status: 'added', assetId: result.assetId });
      console.log(`  ✅ Successfully added: ${model.title}`);
    } else if (result.error === 'Model already exists') {
      results.skipped++;
      results.results.push({ url: model.url, status: 'skipped' });
      console.log(`  ⏭️  Already in library, skipping...`);
    } else {
      results.failed++;
      results.results.push({ url: model.url, status: 'failed', error: result.error });
      console.log(`  ❌ Failed: ${result.error}`);
    }

    // Small delay to avoid overwhelming the browser
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SCAN RESULTS:');
  console.log(`  ✅ Added: ${results.added}`);
  console.log(`  ⏭️  Skipped (already exists): ${results.skipped}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log(`  ⚠️  Not found: ${results.notFound}`);
  console.log(`  📋 Total checked: ${results.checked}`);
  console.log('='.repeat(70));

  if (results.added > 0) {
    console.log('\n💡 Models have been added to your library!');
    console.log('   Refresh the Virtual Studio to see them in the library panel.');
  }

  return results;
}

/**
 * Add a custom model by URL
 */
export async function addCustomModel(
  url: string,
  title: string,
  type: 'light' | 'model' | 'prop' = 'prop',
  tags: string[] = []
): Promise<{ success: boolean; assetId?: string; error?: string }> {
  return addHyper3DModel(url, { title, type, tags });
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).scanAndAddAllModels = scanAndAddAllModels;
  (window as any).addCustomHyper3DModel = addCustomModel;
  console.log('💡 Hyper3D Library Scripts loaded!');
  console.log('   Available functions:');
  console.log('   - scanAndAddAllModels() - Scan and add all known Hyper3D models');
  console.log('   - addCustomHyper3DModel(url, title, type, tags) - Add a custom model');
}

