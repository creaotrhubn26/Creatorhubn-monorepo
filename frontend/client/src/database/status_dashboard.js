#!/usr/bin/env node

/**
 * CreatorHub Norge Database Status Dashboard
 * 
 * This script provides a comprehensive status dashboard for the database
 * showing all phases, components, icons, and system statistics.
 * 
 * Usage: node status_dashboard.js [--json] [--export]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
const outputJson = args.includes('--json');
const exportData = args.includes('--export');

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
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgRed: '\x1b[41m',
};

function log(message, color = 'reset') {
  if (!outputJson) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }
}

function logHeader(title, color = 'cyan') {
  if (!outputJson) {
    log('\n' + '='.repeat(60), color);
    log(`  ${title}`, color);
    log('='.repeat(60), color);
  }
}

function logSection(title, color = 'magenta') {
  if (!outputJson) {
    log(`\n📊 ${title}`, color);
    log('-'.repeat(40), color);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatPercentage(value, total) {
  const percentage = ((value / total) * 100).toFixed(1);
  return `${value}/${total} (${percentage}%)`;
}

function getStatusIcon(status) {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'pending': return '⏳';
    case 'cancelled': return '❌';
    default: return '❓';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'completed': return 'green';
    case 'in_progress': return 'yellow';
    case 'pending': return 'blue';
    case 'cancelled': return 'red';
    default: return 'white';
  }
}

async function generateStatusReport() {
  const pool = new Pool(config);
  const report = {
    timestamp: new Date().toISOString(),
    database: config.database,
    host: config.host,
    port: config.port,
    phases: [],
    components: [],
    icons: [],
    systemStats: {},
    health: {
      status: 'unknown',
      issues: [],
      recommendations: []
    }
  };
  
  try {
    log('📊 CreatorHub Norge Database Status Dashboard', 'cyan');
    log('=' .repeat(60), 'cyan');
    
    // Test connection
    await pool.query('SELECT NOW()');
    log('✅ Database connection successful', 'green');
    
    // Get system overview
    logHeader('System Overview', 'cyan');
    const systemOverview = await pool.query('SELECT * FROM system_overview');
    report.systemStats = systemOverview.rows[0];
    
    if (!outputJson) {
      Object.entries(report.systemStats).forEach(([key, value]) => {
        log(`  • ${key}: ${value}`, 'cyan');
      });
    }
    
    // Get phases summary
    logHeader('Phases Summary', 'magenta');
    const phasesResult = await pool.query('SELECT * FROM phase_summary ORDER BY phase_id');
    report.phases = phasesResult.rows;
    
    if (!outputJson) {
      phasesResult.rows.forEach(phase => {
        const icon = getStatusIcon(phase.status);
        const color = getStatusColor(phase.status);
        log(`  ${icon} ${phase.name}`, color);
        log(`     Status: ${phase.status} | Progress: ${phase.progress}% | Components: ${phase.component_count}`, 'white');
        if (phase.components && phase.components.length > 0) {
          log(`     Components: ${phase.components.join(', ')}`, 'cyan');
        }
      });
    }
    
    // Get components by type
    logHeader('Components by Type', 'blue');
    const componentsByType = await pool.query(`
      SELECT 
        component_type,
        COUNT(*) as count,
        array_agg(name ORDER BY name) as components
      FROM components 
      GROUP BY component_type 
      ORDER BY count DESC
    `);
    
    if (!outputJson) {
      componentsByType.rows.forEach(type => {
        log(`  📦 ${type.component_type}: ${type.count} components`, 'cyan');
        if (type.components && type.components.length > 0) {
          type.components.forEach(component => {
            log(`     • ${component}`, 'white');
          });
        }
      });
    }
    
    // Get icons summary
    logHeader('Icons Summary', 'yellow');
    const iconsByType = await pool.query(`
      SELECT 
        icon_type,
        category,
        COUNT(*) as count
      FROM icons 
      GROUP BY icon_type, category 
      ORDER BY icon_type, category
    `);
    
    if (!outputJson) {
      iconsByType.rows.forEach(icon => {
        log(`  🎨 ${icon.icon_type} - ${icon.category}: ${icon.count} icons`, 'cyan');
      });
    }
    
    // Get documentation sections
    logHeader('Documentation Sections', 'green');
    const docSections = await pool.query(`
      SELECT 
        section_id,
        title,
        category,
        level,
        estimated_time,
        status
      FROM documentation_sections 
      ORDER BY order_index
    `);
    
    if (!outputJson) {
      docSections.rows.forEach(section => {
        const statusIcon = section.status === 'active' ? '✅' : '⏸️';
        log(`  ${statusIcon} ${section.title}`, 'cyan');
        log(`     Category: ${section.category} | Level: ${section.level} | Time: ${section.estimated_time}`, 'white');
      });
    }
    
    // Health check
    logHeader('Health Check', 'red');
    const healthIssues = [];
    const recommendations = [];
    
    // Check for missing data
    const phaseCount = report.systemStats.total_phases || 0;
    const componentCount = report.systemStats.total_components || 0;
    const iconCount = report.systemStats.total_icons || 0;
    
    if (phaseCount < 7) {
      healthIssues.push(`Expected 7 phases, found ${phaseCount}`);
      recommendations.push('Run database update script to sync phases');
    }
    
    if (componentCount < 17) {
      healthIssues.push(`Expected 17 components, found ${componentCount}`);
      recommendations.push('Run database update script to sync components');
    }
    
    if (iconCount < 37) {
      healthIssues.push(`Expected 37 icons, found ${iconCount}`);
      recommendations.push('Run database update script to sync icons');
    }
    
    // Check for orphaned components
    const orphanedComponents = await pool.query(`
      SELECT COUNT(*) FROM components 
      WHERE phase_id NOT IN (SELECT phase_id FROM phases)
    `);
    
    if (parseInt(orphanedComponents.rows[0].count) > 0) {
      healthIssues.push(`Found ${orphanedComponents.rows[0].count} orphaned components`);
      recommendations.push('Clean up orphaned components');
    }
    
    // Check database size
    const dbSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size($1)) as size
    `, [config.database]);
    
    if (!outputJson) {
      log(`  💾 Database size: ${dbSize.rows[0].size}`, 'cyan');
    }
    
    // Set health status
    if (healthIssues.length === 0) {
      report.health.status = 'healthy';
      log('✅ Database is healthy - no issues found', 'green');
    } else {
      report.health.status = 'issues';
      log('⚠️  Database has issues that need attention', 'yellow');
      healthIssues.forEach(issue => {
        log(`  ❌ ${issue}`, 'red');
      });
    }
    
    report.health.issues = healthIssues;
    report.health.recommendations = recommendations;
    
    // Performance metrics
    logHeader('Performance Metrics', 'blue');
    const startTime = Date.now();
    await pool.query('SELECT * FROM phase_summary');
    const queryTime = Date.now() - startTime;
    
    if (!outputJson) {
      log(`  ⚡ Query performance: ${queryTime}ms`, queryTime < 1000 ? 'green' : 'yellow');
      log(`  📊 Database connections: Active`, 'cyan');
    }
    
    // Export data if requested
    if (exportData) {
      const exportPath = path.join(__dirname, `status_report_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(exportPath, JSON.stringify(report, null, 2));
      log(`\n📁 Status report exported to: ${exportPath}`, 'green');
    }
    
    // Output JSON if requested
    if (outputJson) {
      console.log(JSON.stringify(report, null, 2));
    }
    
    // Final summary
    if (!outputJson) {
      logHeader('Summary', 'magenta');
      log(`  • Total Phases: ${phaseCount}`, 'cyan');
      log(`  • Total Components: ${componentCount}`, 'cyan');
      log(`  • Total Icons: ${iconCount}`, 'cyan');
      log(`  • Health Status: ${report.health.status}`, report.health.status === 'healthy' ? 'green' : 'yellow');
      
      if (recommendations.length > 0) {
        log('\n🔧 Recommendations:', 'yellow');
        recommendations.forEach(rec => {
          log(`  • ${rec}`, 'yellow');
        });
      }
      
      log('\n🎉 Status dashboard completed!', 'green');
    }
    
  } catch (error) {
    log(`❌ Error generating status report: ${error.message}`, 'red');
    report.health.status = 'error';
    report.health.issues.push(error.message);
    
    if (outputJson) {
      console.log(JSON.stringify(report, null, 2));
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the status dashboard
generateStatusReport().catch(console.error);

