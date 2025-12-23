#!/usr/bin/env tsx
/**
 * Test script to verify all routes return 200 OK
 * This script extracts routes from routes.ts and tests them
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface RouteInfo {
  method: string;
  path: string;
  line: number;
}

function extractRoutes(filePath: string): RouteInfo[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes: RouteInfo[] = [];
  
  const routePattern = /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/gi;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = [...line.matchAll(routePattern)];
    
    for (const match of matches) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        line: i + 1,
      });
    }
  }
  
  return routes;
}

async function testRoute(method: string, path: string, baseUrl: string = 'http://localhost:5050'): Promise<{ status: number; ok: boolean; error?: string }> {
  try {
    const url = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeout);
    
    return {
      status: response.status,
      ok: response.status === 200,
    };
  } catch (error: any) {
    return {
      status: 0,
      ok: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function main() {
  const routesFile = join(__dirname, 'server', 'routes.ts');
  console.log('📋 Extracting routes from:', routesFile);
  
  const routes = extractRoutes(routesFile);
  console.log(`✅ Found ${routes.length} routes\n`);
  
  // Test a sample of routes (first 20 to start)
  const sampleRoutes = routes.slice(0, 20);
  
  console.log('🧪 Testing routes (sample of 20)...\n');
  console.log('Note: Many routes require authentication and may return 401/403\n');
  console.log('='.repeat(80));
  
  const results: Array<RouteInfo & { status: number; ok: boolean; error?: string }> = [];
  
  for (const route of sampleRoutes) {
    process.stdout.write(`Testing ${route.method} ${route.path.padEnd(50)} ... `);
    const result = await testRoute(route.method, route.path);
    results.push({ ...route, ...result });
    
    if (result.ok) {
      console.log(`✅ 200 OK`);
    } else if (result.status === 401 || result.status === 403) {
      console.log(`🔒 ${result.status} (Auth required - expected)`);
    } else if (result.status === 404) {
      console.log(`❌ ${result.status} (Not found)`);
    } else if (result.status === 0) {
      console.log(`⚠️  Error: ${result.error || 'Connection failed'}`);
    } else {
      console.log(`⚠️  ${result.status}`);
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:');
  
  const okCount = results.filter(r => r.ok).length;
  const authRequiredCount = results.filter(r => r.status === 401 || r.status === 403).length;
  const errorCount = results.filter(r => !r.ok && r.status !== 401 && r.status !== 403 && r.status !== 404).length;
  const notFoundCount = results.filter(r => r.status === 404).length;
  
  console.log(`✅ 200 OK: ${okCount}`);
  console.log(`🔒 Auth Required (401/403): ${authRequiredCount}`);
  console.log(`❌ Not Found (404): ${notFoundCount}`);
  console.log(`⚠️  Other Errors: ${errorCount}`);
  
  // Show routes that returned 200 OK
  const successfulRoutes = results.filter(r => r.ok);
  if (successfulRoutes.length > 0) {
    console.log('\n✅ Routes returning 200 OK:');
    successfulRoutes.forEach(r => {
      console.log(`   ${r.method} ${r.path}`);
    });
  }
  
  // Show routes with unexpected errors
  const errorRoutes = results.filter(r => !r.ok && r.status !== 401 && r.status !== 403 && r.status !== 404);
  if (errorRoutes.length > 0) {
    console.log('\n⚠️  Routes with unexpected status codes:');
    errorRoutes.forEach(r => {
      console.log(`   ${r.method} ${r.path} - Status: ${r.status}${r.error ? ` (${r.error})` : ''}`);
    });
  }
  
  console.log(`\n💡 Tip: To test authenticated routes, you'll need to provide authentication tokens.`);
  console.log(`   Total routes found: ${routes.length}`);
  console.log(`   Routes tested: ${sampleRoutes.length}`);
}

main().catch(console.error);

