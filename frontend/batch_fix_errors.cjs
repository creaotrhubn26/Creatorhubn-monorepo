#!/usr/bin/env node
/**
 * Batch fix parsing errors in React/TypeScript files
 */

const fs = require('fs');
const { execSync } = require('child_process');

function fixFile(filePath, errorLine) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    
    // Get the error line (1-indexed from ESLint, convert to 0-indexed)
    const lineIdx = errorLine - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) return false;
    
    let line = lines[lineIdx];
    const originalLine = line;
    
    // Fix patterns
    // 1. Missing comma before colon in ternary: "value, : other" -> "value : other"
    line = line.replace(/, *:/g, ' :');
    
    // 2. Missing closing brace in style objects: "{ key: value }" -> "{ key: value }}"
    if (line.includes('sx={{') && !line.includes('}}')) {
      const openCount = (line.match(/\{/g) || []).length;
      const closeCount = (line.match(/\}/g) || []).length;
      if (openCount > closeCount) {
        line = line.replace(/}(\s*)$/, '}}'.concat('$1'));
      }
    }
    
    // 3. Missing comma in function arguments: "func(arg1'arg2')" -> "func(arg1, 'arg2')"
    line = line.replace(/([^,\s])('[^']*')/g, '$1, $2');
    line = line.replace(/([^,\s])("[^"]*")/g, '$1, $2');
    
    // 4. Missing closing paren: "function();" -> "function());"
    if (line.includes('.filter(Boolean),') || line.includes('.map(') && line.includes('),')) {
      line = line.replace(/\),/g, '))');
    }
    
    // 5. Extra comma in arrays/objects: "['item1',,'item2']" -> "['item1', 'item2']"
    line = line.replace(/,,/g, ',');
    
    // 6. Missing comma before property in object: "prop: value'key':" -> "prop: value, 'key':"
    line = line.replace(/([^\s,])(\s*)('[^']*'|"[^"]*")\s*:/g, '$1,$2$3:');
    
    // 7. Fix duplicate sx props: "sx={{ }} sx={{ }}" -> "sx={{ }}"
    if (line.match(/sx=\{[^}]*\}\s+sx=\{/)) {
      line = line.replace(/(sx=\{[^}]*\})\s+sx=\{([^}]*)\}/g, 'sx={{...$1, $2}}');
    }
    
    // 8. Missing comma after spread operator: "...obj'key':" -> "...obj, 'key':"
    line = line.replace(/(\.\.\.[a-zA-Z_$][a-zA-Z0-9_$]*)('[^']*'|"[^"]*")/g, '$1, $2');
    
    if (line !== originalLine) {
      lines[lineIdx] = line;
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      modified = true;
    }
    
    return modified;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Finding files with parsing errors...\n');
  
  try {
    const output = execSync(
      'node_modules/.bin/eslint client/src/components/ --ext .ts,.tsx --format json 2>/dev/null',
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    
    const results = JSON.parse(output);
    const filesWithErrors = results
      .filter(result => result.messages.some(msg => msg.message.includes('Parsing error')))
      .map(result => ({
        filePath: result.filePath,
        errorLine: result.messages.find(msg => msg.message.includes('Parsing error'))?.line || 0
      }))
      .slice(0, 80);
    
    console.log(`📝 Found ${filesWithErrors.length} files to fix\n`);
    
    let fixedCount = 0;
    let processedCount = 0;
    
    for (const { filePath, errorLine } of filesWithErrors) {
      processedCount++;
      if (fixFile(filePath, errorLine)) {
        fixedCount++;
        if (fixedCount % 10 === 0) {
          console.log(`✓ Fixed ${fixedCount} files...`);
        }
      }
    }
    
    console.log(`\n✅ Processed ${processedCount} files, modified ${fixedCount} files`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();















