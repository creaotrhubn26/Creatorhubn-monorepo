#!/usr/bin/env node
// CH-ARCH-009 — lockfil-koherens-validator (se docs/architecture-rules.md).
//
// Fanger af5a596-klassen: en committet package-lock.json som har MISTET en
// transitiv pakke (loupe-hullet). `npm install --package-lock-only` oppdager
// ikke dette (npm stoler på eksisterende tre), og `npm ci` installerer
// hull-treet uten feil — krasjen kommer først ved runtime i CI.
//
// To sjekker, begge offline og deterministiske (<1s, ingen nettverk):
//  1. Manifest-avtale: package.json-seksjonene (deps/devDeps/optional) er
//     identiske med lockfilens rot-/workspace-oppføringer.
//  2. Kant-koherens: hver `dependencies`-kant i hver lockfil-pakke kan
//     resolves til en faktisk oppføring via node_modules-oppslagsreglene
//     (nærmeste node_modules oppover i stien).
//
// Bruk: node scripts/lint/check-lockfile-coherence.mjs <lockfil> [flere…]
//   node scripts/lint/check-lockfile-coherence.mjs package-lock.json backend/package-lock.json

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let failed = false;
const err = (m) => { console.error(`  ✖ ${m}`); failed = true; };

for (const lockPath of process.argv.slice(2)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const pkgs = lock.packages ?? {};
  console.log(`Sjekker ${lockPath} (${Object.keys(pkgs).length} oppføringer)…`);

  // ── 1: manifest ↔ lock-avtale for rot + workspaces ──────────────────────
  const manifestEntries = Object.keys(pkgs).filter((k) => !k.includes('node_modules'));
  for (const key of manifestEntries) {
    const manifestPath = join(dirname(lockPath), key, 'package.json');
    let manifest;
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { continue; }
    for (const sec of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      const want = manifest[sec] ?? {};
      const have = pkgs[key][sec] ?? {};
      for (const [name, range] of Object.entries(want)) {
        if (have[name] !== range) err(`${manifestPath}: ${sec}.${name} = ${JSON.stringify(range)} men lockfilen sier ${JSON.stringify(have[name])}`);
      }
      for (const name of Object.keys(have)) {
        if (!(name in want)) err(`${lockPath}[${key || 'rot'}].${sec}.${name} finnes ikke i ${manifestPath} (stale lock)`);
      }
    }
  }

  // ── 2: kant-koherens — hver dependencies-kant må kunne resolves ────────
  // Oppslag: fra pakkens sti, prøv <sti>/node_modules/<dep>, kutt så av
  // siste node_modules-segment og prøv igjen, ned til rot.
  const resolvable = (fromKey, dep) => {
    let base = fromKey;
    for (;;) {
      if (`${base}${base ? '/' : ''}node_modules/${dep}` in pkgs) return true;
      const i = base.lastIndexOf('/node_modules/');
      if (i === -1) {
        // workspace-nivå (f.eks. "frontend") → siste forsøk på rot
        if (base && `node_modules/${dep}` in pkgs) return true;
        return false;
      }
      base = base.slice(0, i);
    }
  };

  for (const [key, meta] of Object.entries(pkgs)) {
    if (!key || meta.link) continue; // rot håndteres av workspaces; links peker ut av treet
    for (const dep of Object.keys(meta.dependencies ?? {})) {
      if (!resolvable(key, dep)) err(`${lockPath}: ${key} avhenger av «${dep}» men ingen oppføring resolver — npm ci installerer et hull-tre (loupe-klassen)`);
    }
  }
}

if (failed) {
  console.error('\nLockfil-inkoherens funnet (CH-ARCH-009). Full sanering:');
  console.error('  rm -rf node_modules */node_modules package-lock.json && npm install --package-lock-only');
  process.exit(1);
}
console.log('✓ Lockfiler koherente.');
