#!/usr/bin/env node

/**
 * CreatorHub Norge - Branding Validation Script
 * Validates that all components use centralized branding
 */

const fs = require('fs');
const path = require('path');

// Brand colors that should NOT be hardcoded
const FORBIDDEN_COLORS = [
  '#ff8c00', '#FF8C00', 'ff8c00',
  '#e74c3c', '#E74C3C', 'e74c3c', 
  '#9b59b6', '#9B59B6', '9b59b6',
  '#27ae60', '#27AE60', '27ae60',
  '#1976d2', '#1976D2', '1976d2',
  '#d32f2f', '#D32F2F', 'd32f2f',
];

// Files to exclude from validation
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'migrate-icons.cjs',
  'updateBranding.cjs',
  'validateBranding.cjs',
  'CreatorHubBranding.ts', // The branding file itself
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];
    
    // Check for forbidden hardcoded colors
    FORBIDDEN_COLORS.forEach(color => {
      const patterns = [
        new RegExp(`color:\\s*['"]${color}['"]`, 'g'),
        new RegExp(`'${color}'`, 'g'),
        new RegExp(`"${color}"`, 'g'),
        new RegExp(`\\b${color}\\b`, 'g'),
      ];
      
      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            violations.push({
              type: 'hardcoded_color',
              color: color,
              match: match,
              line: getLineNumber(content, match),
            });
          });
        }
      });
    });
    
    // Check if file imports CREATOR_HUB_BRANDING
    const hasBrandingImport = content.includes('CREATOR_HUB_BRANDING');
    
    // Check if file uses CREATOR_HUB_BRANDING.colors
    const usesBrandingColors = content.includes('CREATOR_HUB_BRANDING.colors');
    
    return {
      filePath,
      violations,
      hasBrandingImport,
      usesBrandingColors,
      isValid: violations.length === 0,
    };
  } catch (error) {
    return {
      filePath,
      violations: [],
      hasBrandingImport: false,
      usesBrandingColors: false,
      isValid: false,
      error: error.message,
    };
  }
}

function getLineNumber(content, match) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      return i + 1;
    }
  }
  return 0;
}

function findFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js']) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !shouldExcludeFile(fullPath)) {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        if (!shouldExcludeFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function main() {
  const clientDir = path.join(__dirname, '..', '..', '..', 'client', 'src');
  const files = findFiles(clientDir);
  
  console.log(`🔍 Validating ${files.length} files for branding consistency...\n`);
  
  const results = files.map(validateFile);
  const validFiles = results.filter(r => r.isValid);
  const invalidFiles = results.filter(r => !r.isValid);
  const filesWithViolations = results.filter(r => r.violations.length > 0);
  
  // Summary
  console.log('📊 Branding Validation Summary');
  console.log('=' .repeat(50));
  console.log(`✅ Valid files: ${validFiles.length}`);
  console.log(`❌ Invalid files: ${invalidFiles.length}`);
  console.log(`🚨 Files with violations: ${filesWithViolations.length}`);
  console.log('');
  
  // Show violations
  if (filesWithViolations.length > 0) {
    console.log('🚨 Branding Violations Found:');
    console.log('=' .repeat(50));
    
    filesWithViolations.forEach(result => {
      console.log(`\n📁 ${result.filePath}`);
      result.violations.forEach(violation => {
        console.log(`   Line ${violation.line}: ${violation.type} - ${violation.color}`);
        console.log(`   Match: ${violation.match}`);
      });
    });
  }
  
  // Show files without branding imports
  const filesWithoutBranding = results.filter(r => 
    r.isValid && !r.hasBrandingImport && r.usesBrandingColors
  );
  
  if (filesWithoutBranding.length > 0) {
    console.log('\n⚠️  Files using branding colors without import:');
    console.log('=' .repeat(50));
    filesWithoutBranding.forEach(result => {
      console.log(`   ${result.filePath}`);
    });
  }
  
  // Overall status
  console.log('\n🎯 Overall Status:');
  console.log('=' .repeat(50));
  
  if (filesWithViolations.length === 0) {
    console.log('🎉 All files pass branding validation!');
    console.log('✅ CreatorHub Norge branding is consistent across the platform.');
  } else {
    console.log('❌ Branding validation failed!');
    console.log('🔧 Please fix the violations above to ensure consistent branding.');
  }
  
  return filesWithViolations.length === 0;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { validateFile, findFiles };



