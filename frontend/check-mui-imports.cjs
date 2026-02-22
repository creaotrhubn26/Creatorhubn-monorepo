const fs = require('fs');
const path = require('path');

// Load valid exports
const materialExports = new Set(fs.readFileSync('/tmp/mui-material-exports.txt', 'utf8').trim().split('\n'));
const iconsExports = new Set(fs.readFileSync('/tmp/mui-icons-exports.txt', 'utf8').trim().split('\n'));

// Find all TSX/TS files
function findFiles(dir, ext) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          results.push(...findFiles(full, ext));
        } else if (ext.some(e => item.endsWith(e))) {
          results.push(full);
        }
      } catch { /* intentionally empty - file may not exist */ }
    }
  } catch { /* intentionally empty - file may not exist */ }
  return results;
}

const srcDir = '/workspaces/Creatorhubn-monorepo/frontend/client/src';
const files = findFiles(srcDir, ['.tsx', '.ts']);

const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"](@mui\/material|@mui\/icons-material)['"]/g;

const issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  importRegex.lastIndex = 0;
  
  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1];
    const pkg = match[2];
    const exports = pkg === '@mui/material' ? materialExports : iconsExports;
    
    // Parse import names (handle "Name as Alias" syntax)
    const names = imports.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    
    for (const name of names) {
      if (!exports.has(name)) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNum = beforeMatch.split('\n').length;
        
        const relPath = path.relative('/workspaces/Creatorhubn-monorepo/frontend', file);
        issues.push({ file: relPath, line: lineNum, name, pkg });
      }
    }
  }
}

if (issues.length === 0) {
  console.log('No invalid MUI imports found!');
} else {
  console.log(`Found ${issues.length} invalid MUI imports:\n`);
  for (const { file, line, name, pkg } of issues) {
    console.log(`${file}:${line} - "${name}" not in ${pkg}`);
  }
}
