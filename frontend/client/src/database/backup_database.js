#!/usr/bin/env node

/**
 * CreatorHub Norge Database Backup Script
 * 
 * This script creates a backup of the CreatorHub Norge database
 * with timestamp and optional compression.
 * 
 * Usage: node backup_database.js [--compress] [--verbose]
 */

const { exec } = require('child_process');
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
const shouldCompress = args.includes('--compress');
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function createBackup() {
  try {
    log('💾 Starting CreatorHub Norge Database Backup...', 'cyan');
    
    const timestamp = getTimestamp();
    const backupDir = path.join(__dirname, 'backups');
    const backupFile = `creatorhub_norge_backup_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFile);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      log(`📁 Created backup directory: ${backupDir}`, 'green');
    }
    
    // Build pg_dump command
    const pgDumpCmd = [
      'pg_dump',
      `-U ${config.user}`,
      `-h ${config.host}`,
      `-p ${config.port}`,
      `-d ${config.database}`,
      '--verbose',
      '--no-password',
      '--format=plain',
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      '--create',
      `--file=${backupPath}`
    ].join(' ');
    
    if (isVerbose) {
      log(`🔧 Running command: ${pgDumpCmd}`, 'blue');
    }
    
    // Set password environment variable
    const env = { ...process.env, PGPASSWORD: config.password };
    
    // Execute backup
    const startTime = Date.now();
    await new Promise((resolve, reject) => {
      exec(pgDumpCmd, { env }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`pg_dump failed: ${error.message}`));
          return;
        }
        
        if (stderr && isVerbose) {
          log(`📝 pg_dump output: ${stderr}`, 'yellow');
        }
        
        resolve();
      });
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Check if backup file was created
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file was not created');
    }
    
    // Get backup file size
    const stats = fs.statSync(backupPath);
    const fileSize = stats.size;
    
    log(`✅ Backup completed successfully!`, 'green');
    log(`📁 Backup file: ${backupPath}`, 'cyan');
    log(`📊 File size: ${formatBytes(fileSize)}`, 'cyan');
    log(`⏱️  Duration: ${duration}ms`, 'cyan');
    
    // Compress if requested
    if (shouldCompress) {
      log(`🗜️  Compressing backup...`, 'blue');
      
      const compressedFile = `${backupFile}.gz`;
      const compressedPath = path.join(backupDir, compressedFile);
      
      await new Promise((resolve, reject) => {
        exec(`gzip -c "${backupPath}" > "${compressedPath}"`, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Compression failed: ${error.message}`));
            return;
          }
          resolve();
        });
      });
      
      // Get compressed file size
      const compressedStats = fs.statSync(compressedPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = ((fileSize - compressedSize) / fileSize * 100).toFixed(1);
      
      log(`✅ Compression completed!`, 'green');
      log(`📁 Compressed file: ${compressedPath}`, 'cyan');
      log(`📊 Compressed size: ${formatBytes(compressedSize)}`, 'cyan');
      log(`📈 Compression ratio: ${compressionRatio}%`, 'cyan');
      
      // Remove original file
      fs.unlinkSync(backupPath);
      log(`🗑️  Removed original file`, 'yellow');
    }
    
    // Show backup summary
    log('\n📋 Backup Summary:', 'magenta');
    log(`  • Database: ${config.database}`, 'cyan');
    log(`  • Host: ${config.host}:${config.port}`, 'cyan');
    log(`  • User: ${config.user}`, 'cyan');
    log(`  • Timestamp: ${timestamp}`, 'cyan');
    log(`  • Compressed: ${shouldCompress ? 'Yes' : 'No'}`, 'cyan');
    
    // List recent backups
    if (isVerbose) {
      log('\n📚 Recent Backups:', 'magenta');
      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('creatorhub_norge_backup_'))
        .sort()
        .slice(-5); // Show last 5 backups
      
      files.forEach(file => {
        const filePath = path.join(backupDir, file);
        const fileStats = fs.statSync(filePath);
        const size = formatBytes(fileStats.size);
        const date = fileStats.mtime.toISOString().slice(0, 19);
        log(`  • ${file} (${size}) - ${date}`, 'cyan');
      });
    }
    
    log('\n🎉 Backup process completed successfully!', 'green');
    
  } catch (error) {
    log(`❌ Backup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the backup
createBackup().catch(console.error);

