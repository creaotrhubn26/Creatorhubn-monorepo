#!/usr/bin/env node
/**
 * camera-watch — ukentlig vakt for nye kameralanseringer.
 *
 * Henter årets lanseringsliste fra Camera Decision (stabil, enkel HTML),
 * dedup-er mot repoets kameradatabase (frontend/shared/camera-database.ts)
 * og skriver manglende modeller til stdout som JSON. Workflowen bruker
 * outputen til å opprette/oppdatere et GitHub-issue — et menneske legger
 * inn spesifikasjonene (i Utstyrsdatabase-adminen eller i den statiske
 * fila) siden RAW-størrelser/bitrates må være riktige.
 *
 * Deterministisk og avhengighetsfri (node 18+ fetch). Feiler HØYT ved
 * parse-null-funn så en endret kildeside ikke gir stille «alt er à jour».
 */
import { readFileSync } from 'node:fs';

const YEAR = new Date().getFullYear();
const SOURCES = [
  `https://cameradecision.com/blog/Cameras-that-are-Released-in-${YEAR}-so-far`,
  `https://cameradecision.com/blog/Cameras-that-are-Released-in-${YEAR - 1}-so-far`,
];

// Merkene vi bryr oss om (matcher databasen vår)
const BRANDS = [
  'Canon', 'Sony', 'Nikon', 'Fujifilm', 'Panasonic', 'Leica', 'Hasselblad',
  'OM System', 'Olympus', 'Pentax', 'Ricoh', 'Sigma', 'Blackmagic', 'RED', 'ARRI', 'DJI',
];

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/\b(eos|lumix|alpha)\b/g, ' ') // serieprefiks varierer mellom kilder
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const dbSource = readFileSync(
  new URL('../../frontend/shared/camera-database.ts', import.meta.url),
  'utf8',
);
const known = new Set();
for (const match of dbSource.matchAll(/brand:\s*'([^']+)'[\s\S]{0,80}?model:\s*'([^']+)'/g)) {
  known.add(normalize(`${match[1]} ${match[2]}`));
}
if (known.size < 50) {
  console.error(`Parse-feil: fant bare ${known.size} kameraer i databasen`);
  process.exit(1);
}

const found = new Map(); // normalized -> display name
for (const url of SOURCES) {
  let html = '';
  try {
    const resp = await fetch(url, { headers: { 'user-agent': 'creatorhub-camera-watch/1.0' } });
    if (!resp.ok) { console.error(`Hopper over ${url}: HTTP ${resp.status}`); continue; }
    html = await resp.text();
  } catch (err) {
    console.error(`Hopper over ${url}: ${err?.message || err}`);
    continue;
  }
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const brand of BRANDS) {
    // «Brand Modellnavn» — modell = 1–4 ord av [A-Z0-9/-] o.l., stopper ved vanlige ord
    const re = new RegExp(
      `\\b${brand.replace(' ', '\\s')}\\s+((?:[A-Z0-9][\\w./-]*\\s?){1,4}?)(?=\\s(?:is|was|has|features|camera|announced|released|with|and|the|a|body|[a-z]{4,})\\b|[,.)])`,
      'g',
    );
    for (const match of text.matchAll(re)) {
      let model = match[1].trim().replace(/\s+/g, ' ');
      if (!model || model.length < 2 || /^\d{4}$/.test(model)) continue;
      // Trim ved neste merkenavn («Sony FX2 Fujifilm X» → «FX2»)
      for (const other of BRANDS) {
        const idx = model.indexOf(` ${other}`);
        if (idx > 0) model = model.slice(0, idx).trim();
      }
      // Støy-ord: patent-/nyhetsfraser, måneder, «Fixed lens»-fragmenter
      if (/\b(Patents?|Killed|Fixed|Firmware|Rumors?|January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(model)) continue;
      if (!model || model.length < 2) continue;
      const display = `${brand} ${model}`;
      const key = normalize(display);
      if (!known.has(key) && !found.has(key)) found.set(key, display);
    }
  }
}

const missing = Array.from(found.values()).sort();
console.log(JSON.stringify({ year: YEAR, knownCount: known.size, missing }, null, 2));
