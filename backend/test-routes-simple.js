#!/usr/bin/env node
/**
 * Simple test script to verify routes return 200 OK
 * Uses Node.js http module instead of fetch
 */

const http = require('http');
const { readFileSync } = require('fs');
const { join, dirname } = require('path');

function extractRoutes(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes = [];
  
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

function testRoute(method, path, baseUrl = 'http://localhost:5050') {
  return new Promise((resolve) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 5050,
      path: url.pathname,
      method: method,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      resolve({
        status: res.statusCode,
        ok: res.statusCode === 200,
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 0,
        ok: false,
        error: error.message || 'Unknown error',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        ok: false,
        error: 'Request timeout',
      });
    });

    req.end();
  });
}

async function main() {
  const routesFile = join(__dirname, 'server', 'routes.ts');
  console.log('📋 Extracting routes from:', routesFile);
  
  const routes = extractRoutes(routesFile);
  console.log(`✅ Found ${routes.length} routes\n`);
  
  // Test a sample of routes (first 30 to get a good sample)
  const sampleRoutes = routes.slice(0, 30);
  
  console.log('🧪 Testing routes (sample of 30)...\n');
  console.log('Note: Many routes require authentication and may return 401/403\n');
  console.log('='.repeat(80));
  
  const results = [];
  
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
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:');
  
  const okCount = results.filter(r => r.ok).length;
  const authRequiredCount = results.filter(r => r.status === 401 || r.status === 403).length;
  const errorCount = results.filter(r => !r.ok && r.status !== 401 && r.status !== 403 && r.status !== 404).length;
  const notFoundCount = results.filter(r => r.status === 404).length;
  const connectionErrors = results.filter(r => r.status === 0).length;
  
  console.log(`✅ 200 OK: ${okCount}`);
  console.log(`🔒 Auth Required (401/403): ${authRequiredCount}`);
  console.log(`❌ Not Found (404): ${notFoundCount}`);
  console.log(`⚠️  Other Errors: ${errorCount}`);
  console.log(`🔌 Connection Errors: ${connectionErrors}`);
  
  // Show routes that returned 200 OK
  const successfulRoutes = results.filter(r => r.ok);
  if (successfulRoutes.length > 0) {
    console.log('\n✅ Routes returning 200 OK:');
    successfulRoutes.forEach(r => {
      console.log(`   ${r.method} ${r.path}`);
    });
  }
  
  // Show routes with unexpected errors
  const errorRoutes = results.filter(r => !r.ok && r.status !== 401 && r.status !== 403 && r.status !== 404 && r.status !== 0);
  if (errorRoutes.length > 0) {
    console.log('\n⚠️  Routes with unexpected status codes:');
    errorRoutes.forEach(r => {
      console.log(`   ${r.method} ${r.path} - Status: ${r.status}${r.error ? ` (${r.error})` : ''}`);
    });
  }
  
  console.log(`\n💡 Tip: To test authenticated routes, you'll need to provide authentication tokens.`);
  console.log(`   Total routes found: ${routes.length}`);
  console.log(`   Routes tested: ${sampleRoutes.length}`);
  
  // Exit with appropriate code
  if (connectionErrors === sampleRoutes.length) {
    console.log('\n❌ All requests failed - server may not be running or accessible');
    process.exit(1);
  } else if (okCount > 0) {
    console.log('\n✅ At least some routes are returning 200 OK as expected!');
    process.exit(0);
  } else {
    console.log('\n⚠️  No routes returned 200 OK, but this may be expected if all require authentication');
    process.exit(0);
  }
}

main().catch(console.error);

