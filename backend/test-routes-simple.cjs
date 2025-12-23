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
    // Handle routes with path parameters - replace with test values
    let testPath = path;
    if (testPath.includes(':id')) {
      testPath = testPath.replace(':id', 'test-id-123');
    }
    if (testPath.includes(':userId')) {
      testPath = testPath.replace(':userId', 'test-user-123');
    }
    if (testPath.includes(':profession')) {
      testPath = testPath.replace(':profession', 'photographer');
    }
    
    const url = new URL(testPath, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 5050,
      path: url.pathname,
      method: method,
      timeout: 10000, // Increased timeout to 10 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode === 200,
        });
      });
    });

    req.on('error', (error) => {
      let errorMsg = error.message || 'Unknown error';
      const errorCode = error.code || '';
      
      // Better error classification
      if (errorCode === 'ECONNREFUSED') {
        errorMsg = 'Connection refused';
      } else if (errorCode === 'ETIMEDOUT') {
        errorMsg = 'Connection timeout';
      } else if (errorCode === 'ECONNRESET') {
        errorMsg = 'Connection reset by server';
      } else if (errorCode === 'EPIPE') {
        errorMsg = 'Broken pipe (server closed)';
      } else if (error.message && error.message.includes('socket hang up')) {
        errorMsg = 'Socket hang up';
      }
      
      resolve({
        status: 0,
        ok: false,
        error: errorMsg,
        errorCode: errorCode,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        ok: false,
        error: 'Request timeout (10s)',
      });
    });

    // For POST/PUT/PATCH requests, send empty JSON body
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      req.write(JSON.stringify({}));
    }

    req.end();
  });
}

function checkServerRunning(port = 5050) {
  return new Promise((resolve) => {
    const testReq = http.request({
      hostname: 'localhost',
      port: port,
      path: '/api/auth/public-session',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      resolve(true);
      res.on('data', () => {});
      res.on('end', () => {});
    });

    testReq.on('error', () => {
      resolve(false);
    });

    testReq.on('timeout', () => {
      testReq.destroy();
      resolve(false);
    });

    testReq.end();
  });
}

async function main() {
  // Check if server is running first
  console.log('🔍 Checking if server is running on port 5050...');
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.log('❌ Server is not running on port 5050');
    console.log('💡 Please start the server with: npm run dev');
    process.exit(1);
  }
  console.log('✅ Server is running\n');

  const routesFile = join(__dirname, 'server', 'routes.ts');
  console.log('📋 Extracting routes from:', routesFile);
  
  const routes = extractRoutes(routesFile);
  console.log(`✅ Found ${routes.length} routes\n`);
  
  // Test a sample of routes (first 30 to get a good sample)
  const sampleRoutes = routes.slice(0, 30);
  
  console.log('🧪 Testing routes (sample of 30)...\n');
  console.log('Note: Many routes require authentication and may return 401/403');
  console.log('Note: Routes with parameters (e.g., :id) are tested with placeholder values\n');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (const route of sampleRoutes) {
    process.stdout.write(`Testing ${route.method} ${route.path.padEnd(50)} ... `);
    
    // Retry logic for connection errors
    let result = await testRoute(route.method, route.path);
    let retries = 0;
    const maxRetries = 2;
    
    // Retry on connection errors (but not auth errors)
    // Also check if server is still running before retrying
    while (result.status === 0 && retries < maxRetries && 
           (result.errorCode === 'ECONNRESET' || result.errorCode === 'EPIPE' || 
            result.error?.includes('hang up') || result.error?.includes('reset') ||
            result.error?.includes('Connection refused'))) {
      retries++;
      console.log(`\n   ⏳ Retry ${retries}/${maxRetries}...`);
      
      // Check if server is still running
      const serverStillRunning = await checkServerRunning();
      if (!serverStillRunning) {
        console.log(`   ⚠️  Server appears to have stopped`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      result = await testRoute(route.method, route.path);
    }
    
    results.push({ ...route, ...result });
    
    if (result.ok) {
      console.log(`✅ 200 OK`);
    } else if (result.status === 401 || result.status === 403) {
      console.log(`🔒 ${result.status} (Auth required - expected)`);
    } else if (result.status === 404) {
      console.log(`❌ ${result.status} (Not found)`);
    } else if (result.status === 0) {
      const errorDisplay = result.error || 'Connection failed';
      // Truncate long error messages
      const shortError = errorDisplay.length > 40 ? errorDisplay.substring(0, 37) + '...' : errorDisplay;
      console.log(`⚠️  ${shortError}`);
    } else {
      console.log(`⚠️  ${result.status}`);
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 200));
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
  
  // Show routes with connection errors (most important to fix)
  if (connectionErrors > 0) {
    console.log('\n🔌 Routes with connection errors:');
    const connectionErrorRoutes = results.filter(r => r.status === 0);
    
    // Group by error type
    const errorGroups = {};
    connectionErrorRoutes.forEach(r => {
      const errorType = r.error || 'Unknown error';
      if (!errorGroups[errorType]) {
        errorGroups[errorType] = [];
      }
      errorGroups[errorType].push(r);
    });
    
    // Show summary by error type
    Object.keys(errorGroups).forEach(errorType => {
      const routes = errorGroups[errorType];
      console.log(`\n   ${errorType} (${routes.length} routes):`);
      routes.slice(0, 5).forEach(r => {
        console.log(`      ${r.method} ${r.path}`);
      });
      if (routes.length > 5) {
        console.log(`      ... and ${routes.length - 5} more`);
      }
    });
    
    console.log('\n💡 Connection errors may indicate:');
    console.log('   - Server crashing on certain routes');
    console.log('   - Server overwhelmed by requests');
    console.log('   - Routes requiring authentication (should return 401/403)');
    console.log('   - Network/timeout issues');
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

