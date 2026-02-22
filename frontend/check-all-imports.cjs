/**
 * Find ALL import/export mismatches by checking named imports against actual exports
 * Handles: import { X } from './path' and import X from './path'  
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = '/workspaces/Creatorhubn-monorepo/frontend/client/src';
const sharedDir = '/workspaces/Creatorhubn-monorepo/frontend/shared';

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

function resolveImportPath(importPath, fromFile) {
  const dir = path.dirname(fromFile);
  
  // Handle @shared alias
  let basePath;
  if (importPath.startsWith('@shared/')) {
    basePath = path.resolve(sharedDir, importPath.replace('@shared/', ''));
  } else if (importPath.startsWith('@/')) {
    // Try creatorhubvirtualstudio first, then client/src  
    const cvs = path.resolve(srcDir, 'components/creatorhubvirtualstudio/src', importPath.replace('@/', ''));
    if (fs.existsSync(cvs) || fs.existsSync(cvs + '.ts') || fs.existsSync(cvs + '.tsx')) {
      basePath = cvs;
    } else {
      basePath = path.resolve(srcDir, importPath.replace('@/', ''));
    }
  } else if (importPath.startsWith('.')) {
    basePath = path.resolve(dir, importPath);
  } else {
    return null; // node_modules import
  }
  
  // Try extensions
  for (const ext of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate)) {
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) return candidate;
      } catch { /* intentionally empty - file may not exist */ }
    }
  }
  return null;
}

function getExports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const exports = { named: new Set(), hasDefault: false };
  
  // export default
  if (/export\s+default\s/.test(content)) {
    exports.hasDefault = true;
  }
  
  // export const/function/class/let/var Name
  const namedRegex = /export\s+(?:const|function|class|let|var|enum|type|interface)\s+(\w+)/g;
  let m;
  while ((m = namedRegex.exec(content)) !== null) {
    exports.named.add(m[1]);
  }
  
  // export { Name, Name2 }
  const reexportRegex = /export\s*\{([^}]+)\}/g;
  while ((m = reexportRegex.exec(content)) !== null) {
    const names = m[1].split(',').map(s => {
      const asMatch = s.trim().match(/(\w+)\s+as\s+(\w+)/);
      return asMatch ? asMatch[2] : s.trim();
    });
    names.forEach(n => { if (n) exports.named.add(n); });
  }
  
  return exports;
}

const files = [...findFiles(srcDir, ['.tsx', '.ts']), ...findFiles(sharedDir, ['.tsx', '.ts'])];

// Named import regex: import { X, Y } from './path'
const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"]/g;
// Default import regex
const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

const issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relFile = path.relative('/workspaces/Creatorhubn-monorepo/frontend', file);
  
  // Check named imports from local files
  let match;
  namedImportRegex.lastIndex = 0;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const importPath = match[2];
    if (!importPath.startsWith('.') && !importPath.startsWith('@shared/') && !importPath.startsWith('@/')) continue;
    if (importPath.includes('@mui/') || importPath.includes('@emotion/') || importPath.includes('@tanstack/')) continue;
    
    const targetFile = resolveImportPath(importPath, file);
    if (!targetFile) continue;
    
    const exports = getExports(targetFile);
    const names = match[1].split(',').map(s => {
      const trimmed = s.trim();
      // Handle type keyword
      const typeMatch = trimmed.match(/^type\s+(\w+)/);
      if (typeMatch) return typeMatch[1];
      const asMatch = trimmed.match(/^(\w+)\s+as\s+\w+/);
      return asMatch ? asMatch[1] : trimmed;
    }).filter(Boolean);
    
    for (const name of names) {
      if (!exports.named.has(name) && name !== 'default') {
        issues.push({
          file: relFile,
          target: path.relative('/workspaces/Creatorhubn-monorepo/frontend', targetFile),
          name,
          type: 'named',
        });
      }
    }
  }
  
  // Check default imports
  defaultImportRegex.lastIndex = 0;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    // Skip if it's part of destructured import like: import React, { useState } from 'react'
    const importName = match[1];
    const importPath = match[2];
    if (importName === 'React' || importName === 'type') continue;
    if (!importPath.startsWith('.') && !importPath.startsWith('@shared/') && !importPath.startsWith('@/')) continue;
    
    const targetFile = resolveImportPath(importPath, file);
    if (!targetFile) continue;
    
    const exports = getExports(targetFile);
    if (!exports.hasDefault) {
      issues.push({
        file: relFile,
        target: path.relative('/workspaces/Creatorhubn-monorepo/frontend', targetFile),
        name: importName,
        type: 'default',
        hasNamed: exports.named.has(importName),
      });
    }
  }
}

if (issues.length === 0) {
  console.log('No import/export mismatches found!');
} else {
  console.log(`Found ${issues.length} import/export mismatches:\n`);
  for (const issue of issues) {
    if (issue.type === 'default') {
      console.log(`DEFAULT: ${issue.file} imports default "${issue.name}" from ${issue.target}${issue.hasNamed ? ' [HAS NAMED]' : ''}`);
    } else {
      console.log(`NAMED: ${issue.file} imports "${issue.name}" from ${issue.target}`);
    }
  }
}

// Cross-check scanned file count against git-tracked TypeScript files
try {
  const gitCount = execSync(
    'git ls-files "client/src/**/*.ts" "client/src/**/*.tsx" "shared/**/*.ts" "shared/**/*.tsx" | wc -l',
    { encoding: 'utf8', cwd: '/workspaces/Creatorhubn-monorepo/frontend' }
  ).trim();
  console.log(`\nScanned ${files.length} files (git tracks ${gitCount} TypeScript files)`);
} catch {
  console.log(`\nScanned ${files.length} files`);
}
