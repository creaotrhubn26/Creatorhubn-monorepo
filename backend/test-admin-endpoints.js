#!/usr/bin/env node

/**
 * End-to-End Admin Endpoint Testing Script
 * Tests all admin endpoints to verify authentication and authorization
 */

const BASE_URL = 'http://localhost:5050';

// Admin endpoints to test (from security dashboard)
const ADMIN_ENDPOINTS = [
  { method: 'GET', path: '/api/admin/users' },
  { method: 'GET', path: '/api/admin/users/recently-approved' },
  { method: 'GET', path: '/api/admin/platform-stats' },
  { method: 'GET', path: '/api/admin/profession-stats' },
  { method: 'GET', path: '/api/admin/projects-detailed' },
  { method: 'GET', path: '/api/admin/system-health' },
  { method: 'GET', path: '/api/admin/automations' },
  { method: 'GET', path: '/api/admin/automation-stats' },
  { method: 'GET', path: '/api/admin/reports' },
  { method: 'GET', path: '/api/admin/system-logs' },
  { method: 'GET', path: '/api/admin/security/dashboard' },
  { method: 'POST', path: '/api/admin/naming-convention/check' },
  { method: 'GET', path: '/api/admin/auto-sync/integrity' },
  { method: 'POST', path: '/api/admin/auto-sync/start' },
  { method: 'POST', path: '/api/admin/auto-sync/stop' },
];

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

async function testEndpoint(method, path) {
  try {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add body for POST requests
    if (method === 'POST') {
      options.body = JSON.stringify({});
    }

    const response = await fetch(url, options);
    const status = response.status;
    
    // For admin endpoints without auth, we expect 401 or 403
    const isExpectedUnauthorized = status === 401 || status === 403;
    
    return {
      method,
      path,
      status,
      success: isExpectedUnauthorized,
      message: isExpectedUnauthorized 
        ? `✅ Correctly requires authentication (${status})`
        : `❌ Unexpected status: ${status}`
    };
  } catch (error) {
    return {
      method,
      path,
      status: 'ERROR',
      success: false,
      message: `❌ Error: ${error.message}`
    };
  }
}

async function runTests() {
  console.log('🚀 Starting End-to-End Admin Endpoint Tests\n');
  console.log(`Testing ${ADMIN_ENDPOINTS.length} admin endpoints...\n`);

  for (const endpoint of ADMIN_ENDPOINTS) {
    results.total++;
    const result = await testEndpoint(endpoint.method, endpoint.path);
    
    if (result.success) {
      results.passed++;
      console.log(`${result.message}`);
      console.log(`   ${result.method} ${result.path}\n`);
    } else {
      results.failed++;
      results.errors.push(result);
      console.log(`${result.message}`);
      console.log(`   ${result.method} ${result.path}\n`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total endpoints tested: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed endpoints:');
    results.errors.forEach(error => {
      console.log(`   ${error.method} ${error.path} - ${error.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

