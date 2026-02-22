/**
 * Find all default imports that point to files without default exports
 */
const fs = require('fs');
const path = require('path');

const srcDir = '/workspaces/Creatorhubn-monorepo/frontend/client/src';

function findFiles(dir, exts) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          results.push(...findFiles(full, exts));
        } else if (exts.some(e => item.endsWith(e))) {
          results.push(full);
        }
      } catch { /* intentionally empty - file may not exist */ }
    }
  } catch { /* intentionally empty - file may not exist */ }
  return results;
}

const files = findFiles(srcDir, ['.tsx', '.ts']);

// Default import regex: import Name from './relative/path'
// Must NOT match: import { Name } from or import type { Name } from
const defaultImportRegex = /import\s+([A-Z]\w+)\s+from\s+['"](\.[^'"]+)['"]/g;

let issueCount = 0;
let fixCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  defaultImportRegex.lastIndex = 0;
  
  while ((match = defaultImportRegex.exec(content)) !== null) {
    const importName = match[1];
    const importPath = match[2];
    
    // Resolve the import path
    const dir = path.dirname(file);
    let resolvedPath = path.resolve(dir, importPath);
    
    // Try extensions
    let targetFile = null;
    for (const ext of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']) {
      const candidate = resolvedPath + ext;
      if (fs.existsSync(candidate)) {
        targetFile = candidate;
        break;
      }
    }
    if (!targetFile && fs.existsSync(resolvedPath)) {
      targetFile = resolvedPath;
    }
    
    if (!targetFile) continue;
    
    // Check if target has default export
    const targetContent = fs.readFileSync(targetFile, 'utf8');
    const hasDefaultExport = /export\s+default\s/.test(targetContent);
    
    if (!hasDefaultExport) {
      const relFile = path.relative('/workspaces/Creatorhubn-monorepo/frontend', file);
      const relTarget = path.relative('/workspaces/Creatorhubn-monorepo/frontend', targetFile);
      
      // Check if the named export exists
      const namedExportRegex = new RegExp(`export\\s+(const|function|class|let|var)\\s+${importName}\\b`);
      const hasNamedExport = namedExportRegex.test(targetContent);
      
      if (hasNamedExport) {
        issueCount++;
        // Auto-fix: append default export
        const fixLine = `\nexport default ${importName};\n`;
        fs.appendFileSync(targetFile, fixLine);
        fixCount++;
        console.log(`FIXED: ${relTarget} (added default export for ${importName})`);
      } else {
        issueCount++;
        console.log(`ISSUE: ${relFile} imports default "${importName}" from ${relTarget}, but no matching export found`);
      }
    }
  }
}

console.log(`\nTotal issues: ${issueCount}, Auto-fixed: ${fixCount}`);
