#!/usr/bin/env node
/**
 * Bulk-wire logAIUsage. v2 — paren-balanced closing detection.
 *
 * For hver fil:
 *  1. Finn linje med `messages.create(`
 *  2. Tell parentes-balanse linje for linje til vi treffer matchende `)`
 *  3. Sjekk om uttrykket starter med `const X = await ...` (kan vi referere X?)
 *  4. Sett inn logAIUsage(X, ...) på neste linje etter `;`
 *  5. Legg til import øverst om mangler
 */

import fs from 'fs';
import path from 'path';

const ROOT = '/Users/danielqazi/Creatorhubn-monorepo/backend/server';

const TARGETS = [
  { file: 'ai-audition-sides-agent.ts',         feature: 'role-room/audition-sides' },
  { file: 'ai-breakdown-agent.ts',              feature: 'role-room/script-breakdown' },
  { file: 'ai-casting-stub-agent.ts',           feature: 'role-room/casting-suggest' },
  { file: 'ai-coverage-best-take-agent.ts',     feature: 'role-room/coverage-best-take' },
  { file: 'ai-music-bed-agent.ts',              feature: 'role-room/music-bed' },
  { file: 'ai-sfx-suggestion-agent.ts',         feature: 'role-room/sfx-suggest' },
  { file: 'ai-shot-list-agent.ts',              feature: 'role-room/shot-list' },
  { file: 'ai-story-development-agent.ts',      feature: 'role-room/story-development' },
  { file: 'ai-story-logic-agent.ts',            feature: 'role-room/story-logic' },
  { file: 'capture-analyze-service.ts',         feature: 'role-room/capture-analyze' },
  { file: 'role-room-content-strategist.ts',    feature: 'role-room/content-strategy' },
  { file: 'role-room-feed-recommend.ts',        feature: 'role-room/feed-recommend' },
  { file: 'role-room-feed-strategy.ts',         feature: 'role-room/feed-strategy' },
  { file: 'role-room-investor-deck-claude.ts',  feature: 'role-room/investor-deck' },
  { file: 'role-room-research-summary.ts',      feature: 'role-room/research-summary' },
  { file: 'role-room-research-validation.ts',   feature: 'role-room/research-validation' },
  { file: 'role-room-website-analyzer.ts',      feature: 'role-room/website-analyzer' },
  { file: 'social-publisher-youtube-channel-plan.ts', feature: 'role-room/youtube-plan' },
  { file: 'reference-archive-service.ts',       feature: 'role-room/reference-archive' },
  { file: 'social-events-sentiment-worker.ts',  feature: 'role-room/sentiment-worker' },
];

const IMPORT_LINE = `import { logAIUsage } from './ai-usage-tracker.js';`;

function balancedClosingIndex(lines, startLine) {
  // Find the `(` after messages.create on startLine, then balance parens
  // across lines until we hit 0. Return [closeLine, closeColAfterParen].
  let depth = 0;
  let started = false;
  for (let li = startLine; li < lines.length; li++) {
    const line = lines[li];
    for (let ci = 0; ci < line.length; ci++) {
      const c = line[ci];
      if (c === '(') { depth++; started = true; }
      else if (c === ')') {
        depth--;
        if (started && depth === 0) {
          return { closeLine: li, closeCol: ci };
        }
      }
    }
  }
  return null;
}

let processed = 0;
let alreadyWired = 0;
let failed = [];

for (const { file, feature } of TARGETS) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    failed.push({ file, reason: 'fil finnes ikke' });
    continue;
  }
  let src = fs.readFileSync(fullPath, 'utf8');

  if (src.includes('logAIUsage(')) { alreadyWired++; continue; }

  const lines = src.split('\n');
  let edits = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!/\.messages\.create\s*\(/.test(lines[i])) continue;

    // Pattern: "(const|let|var) <name> = await <whatever>.messages.create("
    const declMatch = lines[i].match(/(?:const|let|var)\s+(\w+)\s*(?::\s*\w+(?:<[^>]*>)?)?\s*=\s*await\s+/);
    if (!declMatch) continue;
    const varName = declMatch[1];

    const close = balancedClosingIndex(lines, i);
    if (!close) continue;

    // Insert log call right after the line containing closing paren
    // (typically `    });` — same indent as parent statement)
    const indent = (lines[i].match(/^(\s*)/) || ['', ''])[1];
    const logLine = `${indent}logAIUsage(${varName} as any, { feature: '${feature}' }).catch(() => undefined);`;
    lines.splice(close.closeLine + 1, 0, logLine);
    edits++;
    break; // én per fil i denne v2 — andre filer som har 2+ håndteres manuelt
  }

  if (edits === 0) {
    failed.push({ file, reason: 'fant ikke matchende messages.create-mønster' });
    continue;
  }

  src = lines.join('\n');

  // Legg til import
  if (!src.includes(IMPORT_LINE)) {
    const importRegex = /^import .+ from .+;$/gm;
    const imports = [...src.matchAll(importRegex)];
    if (imports.length > 0) {
      const last = imports[imports.length - 1];
      const at = last.index + last[0].length;
      src = src.slice(0, at) + '\n' + IMPORT_LINE + src.slice(at);
    } else {
      src = IMPORT_LINE + '\n' + src;
    }
  }

  fs.writeFileSync(fullPath, src);
  processed++;
  console.log(`✓ ${file} → feature='${feature}'`);
}

console.log(`\n${processed} wired, ${alreadyWired} already wired, ${failed.length} failed`);
failed.forEach(({ file, reason }) => console.log(`  ! ${file}: ${reason}`));
