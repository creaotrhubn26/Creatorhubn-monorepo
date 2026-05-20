#!/usr/bin/env node
/**
 * Slice 9X.72 — bulk-replace inline hvite bakgrunner i dashboard-komponenter.
 * Bruker bare TRYGGE pattern-matches som ikke kan ødelegge syntax.
 */

import fs from 'fs';
import path from 'path';

const ROOT = '/Users/danielqazi/Creatorhubn-monorepo/frontend/client/src/components/universal';
const FILES = [
  'UniversalShowcase.tsx',
  'UniversalSettingsPanel.tsx',
  'HelpdeskSystem.tsx',
  'DriveOperationsWorkspacePanel.tsx',
  'IntegratedToolsOverview.tsx',
  'AdministrationHub.tsx',
];

const REPLACEMENTS = [
  // bgcolor: 'white' / "white"
  { pattern: /bgcolor:\s*['"]white['"]/g,                replace: "bgcolor: 'rgba(255,255,255,0.04)'" },
  // bgcolor: '#fff' / '#ffffff' / '#FFF' (med eller uten quotes)
  { pattern: /bgcolor:\s*['"]#fff['"]/g,                 replace: "bgcolor: 'rgba(255,255,255,0.04)'" },
  { pattern: /bgcolor:\s*['"]#ffffff['"]/gi,             replace: "bgcolor: 'rgba(255,255,255,0.04)'" },
  // bgcolor: 'rgba(255,255,255,0.X)' for X = 7,8,9
  { pattern: /bgcolor:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.[789]\)['"]/g,
    replace: "bgcolor: 'rgba(255,255,255,0.04)'" },
  // background: 'white' / "white"
  { pattern: /background:\s*['"]white['"]/g,             replace: "background: 'rgba(255,255,255,0.04)'" },
  // background: '#fff' / '#ffffff'
  { pattern: /background:\s*['"]#fff['"]/g,              replace: "background: 'rgba(255,255,255,0.04)'" },
  { pattern: /background:\s*['"]#ffffff['"]/gi,          replace: "background: 'rgba(255,255,255,0.04)'" },
  // background: 'rgba(255,255,255,0.7-0.9)'
  { pattern: /background:\s*['"]rgba\(255,\s*255,\s*255,\s*0\.[789]\)['"]/g,
    replace: "background: 'rgba(255,255,255,0.04)'" },
  // Soft pastels som '#fff3e0' (light orange paper)
  { pattern: /bgcolor:\s*['"]#fff3e0['"]/g,              replace: "bgcolor: 'rgba(255,186,108,0.08)'" },
];

let totalEdits = 0;
let filesEdited = 0;

for (const fileName of FILES) {
  const full = path.join(ROOT, fileName);
  if (!fs.existsSync(full)) {
    console.log(`  ✗ ${fileName} finnes ikke`);
    continue;
  }
  let src = fs.readFileSync(full, 'utf8');
  let count = 0;

  for (const { pattern, replace } of REPLACEMENTS) {
    const matches = src.match(pattern);
    if (matches) {
      src = src.replace(pattern, replace);
      count += matches.length;
    }
  }

  if (count > 0) {
    fs.writeFileSync(full, src);
    console.log(`  ✓ ${fileName}: ${count} replacements`);
    totalEdits += count;
    filesEdited++;
  } else {
    console.log(`  ⊘ ${fileName}: ingen replacements (allerede ren?)`);
  }
}

console.log(`\nTotalt: ${totalEdits} replacements i ${filesEdited} filer`);
