#!/usr/bin/env node

// ESM-aware server bootstrapper for Render
// - Loads env
// - Builds TypeScript entry if dist missing (via esbuild)
// - Runs optional DB migration script before start

import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

async function run() {
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const distEntry = path.join(__dirname, 'dist', 'index.js');
  const tsEntry = path.join(__dirname, 'server', 'index.ts');
  const minimalTsEntry = path.join(__dirname, 'server', 'index-minimal.ts');
  const minimalDistEntry = path.join(__dirname, 'dist', 'minimal.js');
  const migrateScript = path.join(__dirname, 'migrate.sh');
  const isRenderRuntime = String(process.env.RENDER || '').toLowerCase() === 'true';
  const shouldRunRenderBootSeed =
    process.env.RUN_RENDER_BOOT_SEEDING === '1' ||
    process.env.RUN_RENDER_BOOT_SEEDING === 'true';
  const shouldRunRenderBootIntegrity =
    process.env.RUN_RENDER_BOOT_INTEGRITY === '1' ||
    process.env.RUN_RENDER_BOOT_INTEGRITY === 'true';

  async function tryBuild(entry, outFileFriendly) {
    const { build } = await import('esbuild');
    await build({
      entryPoints: [entry],
      platform: 'node',
      bundle: true,
      format: 'esm',
      outdir: path.join(__dirname, 'dist'),
      outbase: path.join(__dirname, 'server'),
      outExtension: { '.js': '.js' },
      packages: 'external',
      splitting: true,
      logLevel: 'info',
    });
    console.log(`✅ Build complete for ${outFileFriendly}`);
  }

  // If dist is missing, try to build the full server. If that fails, build the minimal server.
  if (!existsSync(distEntry)) {
    if (existsSync(tsEntry)) {
      try {
        console.log('📦 dist missing; building full server with esbuild...');
        await tryBuild(tsEntry, 'index.js');
      } catch (err) {
        console.warn('⚠️  Full server build failed; falling back to minimal server:', err?.message || err);
        if (existsSync(minimalTsEntry)) {
          try {
            console.log('📦 Building minimal server...');
            const { build } = await import('esbuild');
            await build({
              entryPoints: [minimalTsEntry],
              platform: 'node',
              bundle: true,
              format: 'esm',
              outfile: minimalDistEntry,
              packages: 'external',
              logLevel: 'info',
            });
            console.log('✅ Minimal server build complete');
          } catch (minErr) {
            console.error('❌ Minimal server build also failed:', minErr);
            process.exit(1);
          }
        } else {
          console.error('❌ No minimal server entry found at server/index-minimal.ts');
          process.exit(1);
        }
      }
    } else {
      console.error('❌ Could not find server/index.ts to build');
      process.exit(1);
    }
  }

  // Optionally run migrate script if present
  try {
    const { spawnSync } = await import('node:child_process');
    if (existsSync(migrateScript)) {
      console.log('🔄 Running migrate.sh before start...');
      const res = spawnSync('bash', [migrateScript], { stdio: 'inherit', env: process.env });
      if (res.status !== 0) {
        console.warn('⚠️  migrate.sh exited with non-zero status; continuing');
      } else {
        console.log('✅ Migration step complete');
      }
    }

    if (isRenderRuntime && !shouldRunRenderBootSeed) {
      console.log('⏭️  Skipping boot seeding on Render to keep zero-downtime deploys promotable');
    } else {
      // Ensure ULTIMATE auto-seeder runs (idempotent)
      try {
        const ultimateSeeder = path.join(__dirname, 'scripts', 'auto-seed-ULTIMATE-476.cjs');
        if (existsSync(ultimateSeeder) && process.env.SKIP_BOOT_SEED !== '1') {
          console.log('🌱 Running ULTIMATE auto-seeder (boot)...');
          const seedRes = spawnSync('node', [ultimateSeeder], { stdio: 'inherit', env: process.env });
          if (seedRes.status !== 0) {
            console.warn('⚠️  ULTIMATE seeder exited with non-zero status; continuing');
            try {
              const { updateSeed } = await import('./server/health-state.ts');
              await updateSeed(new Date(), 'warning');
            } catch {}
          } else {
            console.log('✅ ULTIMATE auto-seeder completed');
            try {
              const { updateSeed } = await import('./server/health-state.ts');
              await updateSeed(new Date(), 'success');
            } catch {}
          }
        }
      } catch (seedErr) {
        console.warn('⚠️  ULTIMATE seeder step skipped:', seedErr?.message || seedErr);
      }
    }

    if (isRenderRuntime && !shouldRunRenderBootIntegrity) {
      console.log('⏭️  Skipping boot integrity check on Render to shorten startup time');
    } else {
      // Run integrity checker (non-fatal)
      try {
        const integrityScript = path.join(__dirname, 'scripts', 'database-integrity-checker.cjs');
        if (existsSync(integrityScript) && process.env.SKIP_BOOT_INTEGRITY !== '1') {
          console.log('🔍 Running database integrity checker (boot)...');
          const intRes = spawnSync('node', [integrityScript], { stdio: 'inherit', env: { ...process.env, FAST_SUMMARY: process.env.FAST_SUMMARY || '1', RUN_VACUUM: process.env.RUN_VACUUM || '0', MIGRATION_INTERACTIVE: '0' } });
          if (intRes.status !== 0) {
            console.warn('⚠️  Integrity checker exited with non-zero status; continuing');
            try {
              const { updateIntegrity } = await import('./server/health-state.ts');
              await updateIntegrity(new Date(), 'warning');
            } catch {}
          } else {
            console.log('✅ Integrity check completed');
            try {
              const { updateIntegrity } = await import('./server/health-state.ts');
              await updateIntegrity(new Date(), 'healthy');
            } catch {}
          }
        }
      } catch (intErr) {
        console.warn('⚠️  Integrity checker step skipped:', intErr?.message || intErr);
      }
    }
  } catch (err) {
    console.warn('⚠️  Migration step skipped:', err?.message || err);
  }

  // Start the compiled server
  if (existsSync(distEntry)) {
    const distUrl = url.pathToFileURL(distEntry).href;
    await import(distUrl);
  } else if (existsSync(minimalDistEntry)) {
    const minimalUrl = url.pathToFileURL(minimalDistEntry).href;
    console.log('🚀 Starting minimal server...');
    await import(minimalUrl);
  } else {
    console.error('❌ No built server artifacts found after build steps');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('❌ Server bootstrap error:', e);
  process.exit(1);
});
