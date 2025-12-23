#!/usr/bin/env node
/**
 * Script to automatically fix common parsing errors in React/TypeScript files
 */

const fs = require('fs');
const path = require('path');

// Common patterns to fix
const fixes = [
  // Pattern 1: Missing closing paren in function calls
  {
    // e.g., generateMockData(); -> generateMockData();
    pattern: /(\w+\([^)]*);(\s*$)/gm,
    replacement: '$1);$2',
    name: 'Missing closing paren in function calls'
  },
  
  // Pattern 2: Extra comma in ternary operator
  {
    // e.g., test ? value, : other -> test ? value : other
    pattern: /(\?[^:]*),\s*:/g,
    replacement: '$1 :',
    name: 'Extra comma before colon in ternary'
  },
  
  // Pattern 3: Missing closing brace after object literal property
  {
    // e.g., { prop: value, } -> { prop: value }  (before closing of style prop)
    pattern: /,\s*\}/g,
    replacement: ' }',
    name: 'Trailing comma before closing brace'
  },
  
  // Pattern 4: Unclosed JSX self-closing tag (CircularProgress specific)
  {
    pattern: /<CircularProgress([^>]*)>\s*:/g,
    replacement: '<CircularProgress$1 /> :',
    name: 'Unclosed CircularProgress tag'
  },
  
  // Pattern 5: Missing closing brace in style objects
  {
    // e.g., style={{ key: value } -> style={{ key: value }}
    pattern: /style=\{\{([^}]*)\}([^}])/g,
    replacement: 'style={{$1}}$2',
    name: 'Missing closing brace in style prop'
  }
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const appliedFixes = [];
    
    fixes.forEach(fix => {
      const before = content;
      content = content.replace(fix.pattern, fix.replacement);
      if (before !== content) {
        modified = true;
        appliedFixes.push(fix.name);
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed ${filePath}`);
      if (appliedFixes.length > 0) {
        console.log(`  Applied: ${appliedFixes.join(', ')}`);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Get files with parsing errors from eslint
const { execSync } = require('child_process');

try {
  const output = execSync(
    'node_modules/.bin/eslint client/src/components/ --ext .ts,.tsx --format json 2>/dev/null',
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  );
  
  const results = JSON.parse(output);
  const filesWithErrors = results
    .filter(result => result.messages.some(msg => msg.message.includes('Parsing error')))
    .map(result => result.filePath);
  
  console.log(`Found ${filesWithErrors.length} files with parsing errors`);
  console.log(`Attempting to fix common patterns...\n`);
  
  let fixedCount = 0;
  filesWithErrors.slice(0, 50).forEach(file => {
    if (fixFile(file)) {
      fixedCount++;
    }
  });
  
  console.log(`\n✓ Fixed ${fixedCount} files out of ${Math.min(50, filesWithErrors.length)} attempted`);
  
} catch (error) {
  console.error('Error running eslint:', error.message);
  process.exit(1);
}


