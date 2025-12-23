#!/usr/bin/env node

/**
 * CreatorHub Norge Database Health Check
 * 
 * This script performs a comprehensive health check of the database
 * to ensure all data is consistent and up to date.
 * 
 * Usage: node health_check.js [--verbose]
 */

const { Pool } = require('pg');

// Configuration
const config = {
  user: process.env.DB_USER || 'creatorhub',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'creatorhub_norge',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
};

// Command line arguments
const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStatus(test, status, details = '') {
  const icon = status ? '✅' : '❌';
  const color = status ? 'green' : 'red';
  log(`${icon} ${test}`, color);
  if (details && isVerbose) {
    log(`   ${details}`, 'cyan');
  }
}

async function healthCheck() {
  const pool = new Pool(config);
  let allTestsPassed = true;
  
  try {
    log('🏥 Starting CreatorHub Norge Database Health Check...', 'cyan');
    log('=' .repeat(60), 'blue');
    
    // Test 1: Database Connection
    try {
      await pool.query('SELECT NOW()');
      logStatus('Database Connection', true, 'Successfully connected to PostgreSQL');
    } catch (error) {
      logStatus('Database Connection', false, error.message);
      allTestsPassed = false;
      return;
    }
    
    // Test 2: Check if tables exist
    const requiredTables = ['phases', 'components', 'icons', 'documentation_sections', 'system_stats', 'user_activity'];
    for (const table of requiredTables) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);
        
        const exists = result.rows[0].exists;
        logStatus(`Table: ${table}`, exists, exists ? 'Table exists' : 'Table missing');
        if (!exists) allTestsPassed = false;
      } catch (error) {
        logStatus(`Table: ${table}`, false, error.message);
        allTestsPassed = false;
      }
    }
    
    // Test 3: Check data integrity
    try {
      const phaseCount = await pool.query('SELECT COUNT(*) FROM phases');
      const componentCount = await pool.query('SELECT COUNT(*) FROM components');
      const iconCount = await pool.query('SELECT COUNT(*) FROM icons');
      
      logStatus('Data Integrity', true, `Phases: ${phaseCount.rows[0].count}, Components: ${componentCount.rows[0].count}, Icons: ${iconCount.rows[0].count}`);
      
      // Check for expected minimum counts
      if (parseInt(phaseCount.rows[0].count) < 7) {
        logStatus('Phase Count', false, `Expected at least 7 phases, found ${phaseCount.rows[0].count}`);
        allTestsPassed = false;
      } else {
        logStatus('Phase Count', true, `Found ${phaseCount.rows[0].count} phases`);
      }
      
      if (parseInt(componentCount.rows[0].count) < 17) {
        logStatus('Component Count', false, `Expected at least 17 components, found ${componentCount.rows[0].count}`);
        allTestsPassed = false;
      } else {
        logStatus('Component Count', true, `Found ${componentCount.rows[0].count} components`);
      }
      
      if (parseInt(iconCount.rows[0].count) < 37) {
        logStatus('Icon Count', false, `Expected at least 37 icons, found ${iconCount.rows[0].count}`);
        allTestsPassed = false;
      } else {
        logStatus('Icon Count', true, `Found ${iconCount.rows[0].count} icons`);
      }
    } catch (error) {
      logStatus('Data Integrity', false, error.message);
      allTestsPassed = false;
    }
    
    // Test 4: Check for orphaned records
    try {
      const orphanedComponents = await pool.query(`
        SELECT COUNT(*) FROM components 
        WHERE phase_id NOT IN (SELECT phase_id FROM phases)
      `);
      
      const orphanedCount = parseInt(orphanedComponents.rows[0].count);
      logStatus('Orphaned Components', orphanedCount === 0, orphanedCount === 0 ? 'No orphaned components' : `Found ${orphanedCount} orphaned components`);
      if (orphanedCount > 0) allTestsPassed = false;
    } catch (error) {
      logStatus('Orphaned Components', false, error.message);
      allTestsPassed = false;
    }
    
    // Test 5: Check system stats
    try {
      const statsResult = await pool.query('SELECT * FROM system_stats ORDER BY stat_name');
      const stats = {};
      statsResult.rows.forEach(row => {
        stats[row.stat_name] = row.stat_value;
      });
      
      const expectedStats = {
        total_phases: 7,
        completed_phases: 7,
        total_components: 17,
        total_icons: 37
      };
      
      let statsValid = true;
      for (const [statName, expectedValue] of Object.entries(expectedStats)) {
        const actualValue = stats[statName];
        if (actualValue !== expectedValue) {
          logStatus(`System Stat: ${statName}`, false, `Expected ${expectedValue}, got ${actualValue}`);
          statsValid = false;
          allTestsPassed = false;
        }
      }
      
      if (statsValid) {
        logStatus('System Stats', true, 'All system stats are correct');
      }
    } catch (error) {
      logStatus('System Stats', false, error.message);
      allTestsPassed = false;
    }
    
    // Test 6: Check indexes
    try {
      const indexResult = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename IN ('phases', 'components', 'icons', 'documentation_sections', 'user_activity')
        AND schemaname = 'public'
      `);
      
      const indexCount = indexResult.rows.length;
      logStatus('Database Indexes', indexCount > 0, `Found ${indexCount} indexes`);
    } catch (error) {
      logStatus('Database Indexes', false, error.message);
      allTestsPassed = false;
    }
    
    // Test 7: Check views
    try {
      const viewResult = await pool.query(`
        SELECT viewname FROM pg_views 
        WHERE viewname IN ('phase_summary', 'system_overview')
        AND schemaname = 'public'
      `);
      
      const viewCount = viewResult.rows.length;
      logStatus('Database Views', viewCount >= 2, `Found ${viewCount} views (expected 2)`);
      if (viewCount < 2) allTestsPassed = false;
    } catch (error) {
      logStatus('Database Views', false, error.message);
      allTestsPassed = false;
    }
    
    // Test 8: Performance check
    try {
      const startTime = Date.now();
      await pool.query('SELECT * FROM phase_summary');
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      const performanceGood = queryTime < 1000; // Less than 1 second
      logStatus('Query Performance', performanceGood, `Phase summary query took ${queryTime}ms`);
      if (!performanceGood) allTestsPassed = false;
    } catch (error) {
      logStatus('Query Performance', false, error.message);
      allTestsPassed = false;
    }
    
    // Summary
    log('=' .repeat(60), 'blue');
    if (allTestsPassed) {
      log('🎉 All health checks passed! Database is healthy.', 'green');
      log('✅ CreatorHub Norge database is ready for production.', 'green');
    } else {
      log('⚠️  Some health checks failed. Please review the issues above.', 'yellow');
      log('🔧 Run "node update_database.js --verbose" to fix issues.', 'yellow');
    }
    
    // Show system overview
    if (isVerbose) {
      log('\n📊 System Overview:', 'magenta');
      try {
        const overview = await pool.query('SELECT * FROM system_overview');
        overview.rows.forEach(row => {
          log(`  • ${row.stat_name}: ${row.stat_value}`, 'cyan');
        });
      } catch (error) {
        log(`  Error fetching system overview: ${error.message}`, 'red');
      }
    }
    
  } catch (error) {
    log(`❌ Health check failed: ${error.message}`, 'red');
    allTestsPassed = false;
  } finally {
    await pool.end();
  }
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Run the health check
healthCheck().catch(console.error);

