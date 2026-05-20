#!/usr/bin/env node
/**
 * Slice 9X.78 — Reset hardkodede mock-tall i marketplace.
 * Admin-DB-data (rating fra reviewSummaryByApp) overstyrer disse, så
 * vi setter dem til 0 slik at "Ny app"-fallback-badgen vises til
 * ekte data fins.
 */

import fs from 'fs';

const FILE = '/Users/danielqazi/Creatorhubn-monorepo/frontend/client/src/components/resume/ResumeBuilderMarketplace.tsx';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;

// Lines som matcher: 'rating: 4.X,' 'reviews: NNN,' 'downloadCount: NNN,'
// 'monthlyGrowth: NN,' 'trending: true,'
const patterns = [
  { regex: /^(\s*)rating:\s*[\d.]+,/gm, replace: '$1rating: 0,' },
  { regex: /^(\s*)reviews:\s*\d+,/gm, replace: '$1reviews: 0,' },
  { regex: /^(\s*)downloadCount:\s*\d+,/gm, replace: '$1downloadCount: 0,' },
  { regex: /^(\s*)monthlyGrowth:\s*\d+,/gm, replace: '$1monthlyGrowth: 0,' },
  { regex: /^(\s*)trending:\s*true,/gm, replace: '$1trending: false,' },
];

for (const { regex, replace } of patterns) {
  const matches = src.match(regex);
  if (matches) {
    src = src.replace(regex, replace);
    edits += matches.length;
  }
}

fs.writeFileSync(FILE, src);
console.log(`✓ ${edits} mock-felt nullet i ResumeBuilderMarketplace.tsx`);
