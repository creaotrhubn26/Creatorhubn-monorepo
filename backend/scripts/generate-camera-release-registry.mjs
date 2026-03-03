#!/usr/bin/env node

import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const MIN_YEAR = 2020;
const MAX_YEAR = 2026;

const BRAND_ALIASES = new Map([
  ['Canon Inc.', 'Canon'],
  ['Fujifilm Holdings Corporation', 'Fujifilm'],
  ['Leica Camera', 'Leica'],
  ['Nikon', 'Nikon'],
  ['OM Digital Solutions', 'OM System'],
  ['Olympus Corporation', 'Olympus'],
  ['Panasonic Holdings Corporation', 'Panasonic'],
  ['Ricoh', 'Ricoh'],
  ['Sigma Corporation', 'Sigma'],
  ['Sony Group', 'Sony'],
  ['Xiaomi', 'Xiaomi'],
  ['Logitech', 'Logitech'],
]);

const ACCEPTED_WIKIDATA_BRANDS = new Set([
  'Canon',
  'Fujifilm',
  'Leica',
  'Nikon',
  'OM System',
  'Olympus',
  'Panasonic',
  'Ricoh',
  'Sigma',
  'Sony',
  'Xiaomi',
  'Logitech',
]);

const MANUAL_ENTRIES = [
  // Canon Cine
  { brand: 'Canon', model: 'EOS C300 Mark III', releaseDate: '2020-04-20', category: 'cine-camera' },
  { brand: 'Canon', model: 'EOS C70', releaseDate: '2020-09-24', category: 'cine-camera' },
  { brand: 'Canon', model: 'EOS C400', releaseDate: '2024-06-05', category: 'cine-camera' },
  { brand: 'Canon', model: 'EOS C80', releaseDate: '2024-09-09', category: 'cine-camera' },
  { brand: 'Canon', model: 'EOS C50', releaseDate: '2025-09-01', category: 'cine-camera' },

  // Sony Cine
  { brand: 'Sony', model: 'FX3', releaseDate: '2021-02-23', category: 'cine-camera' },
  { brand: 'Sony', model: 'FX6', releaseDate: '2020-11-17', category: 'cine-camera' },
  { brand: 'Sony', model: 'FX30', releaseDate: '2022-09-28', category: 'cine-camera' },
  { brand: 'Sony', model: 'BURANO', releaseDate: '2023-09-12', category: 'cine-camera' },
  { brand: 'Sony', model: 'VENICE 2', releaseDate: '2021-11-15', category: 'cine-camera' },

  // Panasonic Cine/Hybrid
  { brand: 'Panasonic', model: 'Lumix GH6', releaseDate: '2022-03-25', category: 'cine-camera' },
  { brand: 'Panasonic', model: 'Lumix GH7', releaseDate: '2024-06-05', category: 'cine-camera' },
  { brand: 'Panasonic', model: 'Lumix BS1H', releaseDate: '2020-11-05', category: 'cine-camera' },

  // Blackmagic
  {
    brand: 'Blackmagic',
    model: 'Pocket Cinema Camera 6K Pro',
    releaseDate: '2021-02-17',
    category: 'cine-camera',
  },
  {
    brand: 'Blackmagic',
    model: 'Studio Camera 4K Pro',
    releaseDate: '2021-10-01',
    category: 'cine-camera',
  },
  {
    brand: 'Blackmagic',
    model: 'Studio Camera 6K Pro',
    releaseDate: '2022-09-09',
    category: 'cine-camera',
  },
  { brand: 'Blackmagic', model: 'Cinema Camera 6K', releaseDate: '2023-09-14', category: 'cine-camera' },
  { brand: 'Blackmagic', model: 'PYXIS 6K', releaseDate: '2024-04-12', category: 'cine-camera' },
  { brand: 'Blackmagic', model: 'URSA Cine 12K', releaseDate: '2024-04-12', category: 'cine-camera' },

  // RED
  { brand: 'RED', model: 'KOMODO 6K', releaseDate: '2020-10-15', category: 'cine-camera' },
  { brand: 'RED', model: 'V-RAPTOR 8K VV', releaseDate: '2021-09-09', category: 'cine-camera' },
  { brand: 'RED', model: 'V-RAPTOR XL 8K VV', releaseDate: '2022-09-08', category: 'cine-camera' },
  { brand: 'RED', model: 'KOMODO-X 6K', releaseDate: '2023-08-17', category: 'cine-camera' },

  // ARRI
  { brand: 'ARRI', model: 'ALEXA 35', releaseDate: '2022-05-31', category: 'cine-camera' },
  { brand: 'ARRI', model: 'ALEXA 265', releaseDate: '2023-04-18', category: 'cine-camera' },

  // Drone cameras
  { brand: 'DJI', model: 'Mini 2', releaseDate: '2020-11-04', category: 'drone-camera' },
  { brand: 'DJI', model: 'Air 2S', releaseDate: '2021-04-15', category: 'drone-camera' },
  { brand: 'DJI', model: 'Mavic 3', releaseDate: '2021-11-05', category: 'drone-camera' },
  { brand: 'DJI', model: 'Mini 3 Pro', releaseDate: '2022-05-10', category: 'drone-camera' },
  { brand: 'DJI', model: 'Avata', releaseDate: '2022-08-25', category: 'drone-camera' },
  { brand: 'DJI', model: 'Inspire 3', releaseDate: '2023-04-13', category: 'drone-camera' },
  { brand: 'DJI', model: 'Air 3', releaseDate: '2023-07-25', category: 'drone-camera' },
  { brand: 'DJI', model: 'Mini 4 Pro', releaseDate: '2023-09-25', category: 'drone-camera' },
  { brand: 'DJI', model: 'Avata 2', releaseDate: '2024-04-11', category: 'drone-camera' },
  { brand: 'DJI', model: 'Mavic 4 Pro', releaseDate: '2025-05-13', category: 'drone-camera' },
  { brand: 'Autel', model: 'EVO Nano+', releaseDate: '2021-09-28', category: 'drone-camera' },
  { brand: 'Autel', model: 'EVO Lite+', releaseDate: '2021-09-28', category: 'drone-camera' },
  { brand: 'Skydio', model: 'Skydio 2+', releaseDate: '2022-02-22', category: 'drone-camera' },
  { brand: 'Parrot', model: 'Anafi Ai', releaseDate: '2021-06-30', category: 'drone-camera' },

  // Action cameras
  { brand: 'GoPro', model: 'HERO9 Black', releaseDate: '2020-09-16', category: 'action-camera' },
  { brand: 'GoPro', model: 'HERO10 Black', releaseDate: '2021-09-16', category: 'action-camera' },
  { brand: 'GoPro', model: 'HERO11 Black', releaseDate: '2022-09-14', category: 'action-camera' },
  { brand: 'GoPro', model: 'HERO12 Black', releaseDate: '2023-09-06', category: 'action-camera' },
  { brand: 'GoPro', model: 'HERO13 Black', releaseDate: '2024-09-04', category: 'action-camera' },
  { brand: 'Insta360', model: 'ONE RS', releaseDate: '2022-03-22', category: 'action-camera' },
  { brand: 'Insta360', model: 'X3', releaseDate: '2022-09-08', category: 'action-camera' },
  { brand: 'Insta360', model: 'GO 3', releaseDate: '2023-06-27', category: 'action-camera' },
  { brand: 'Insta360', model: 'Ace Pro', releaseDate: '2023-11-21', category: 'action-camera' },
  { brand: 'Insta360', model: 'X4', releaseDate: '2024-04-16', category: 'action-camera' },
  { brand: 'Insta360', model: 'GO 3S', releaseDate: '2024-06-13', category: 'action-camera' },
  { brand: 'DJI', model: 'Osmo Action 4', releaseDate: '2023-08-02', category: 'action-camera' },
  { brand: 'DJI', model: 'Osmo Action 5 Pro', releaseDate: '2024-09-19', category: 'action-camera' },

  // Mobile camera platforms
  { brand: 'Apple', model: 'iPhone 12 Pro Max', releaseDate: '2020-11-13', category: 'mobile-device' },
  { brand: 'Apple', model: 'iPhone 13 Pro Max', releaseDate: '2021-09-24', category: 'mobile-device' },
  { brand: 'Apple', model: 'iPhone 14 Pro Max', releaseDate: '2022-09-16', category: 'mobile-device' },
  { brand: 'Apple', model: 'iPhone 15 Pro Max', releaseDate: '2023-09-22', category: 'mobile-device' },
  { brand: 'Apple', model: 'iPhone 16 Pro Max', releaseDate: '2024-09-20', category: 'mobile-device' },
  { brand: 'Apple', model: 'iPhone 17 Pro Max', releaseDate: '2025-09-19', category: 'mobile-device' },
  { brand: 'Samsung', model: 'Galaxy S20 Ultra', releaseDate: '2020-03-06', category: 'mobile-device' },
  { brand: 'Samsung', model: 'Galaxy S21 Ultra', releaseDate: '2021-01-29', category: 'mobile-device' },
  { brand: 'Samsung', model: 'Galaxy S22 Ultra', releaseDate: '2022-02-25', category: 'mobile-device' },
  { brand: 'Samsung', model: 'Galaxy S23 Ultra', releaseDate: '2023-02-17', category: 'mobile-device' },
  { brand: 'Samsung', model: 'Galaxy S24 Ultra', releaseDate: '2024-01-31', category: 'mobile-device' },
  { brand: 'Samsung', model: 'Galaxy S25 Ultra', releaseDate: '2025-01-22', category: 'mobile-device' },
  { brand: 'Google', model: 'Pixel 6 Pro', releaseDate: '2021-10-28', category: 'mobile-device' },
  { brand: 'Google', model: 'Pixel 7 Pro', releaseDate: '2022-10-13', category: 'mobile-device' },
  { brand: 'Google', model: 'Pixel 8 Pro', releaseDate: '2023-10-12', category: 'mobile-device' },
  { brand: 'Google', model: 'Pixel 9 Pro', releaseDate: '2024-09-04', category: 'mobile-device' },
  { brand: 'Google', model: 'Pixel 10 Pro', releaseDate: '2025-08-28', category: 'mobile-device' },
  { brand: 'Xiaomi', model: '13 Ultra', releaseDate: '2023-04-21', category: 'mobile-device' },
  { brand: 'Xiaomi', model: '14 Ultra', releaseDate: '2024-02-22', category: 'mobile-device' },
  { brand: 'Xiaomi', model: '15 Ultra', releaseDate: '2025-03-02', category: 'mobile-device' },

  // Tablets with relevant camera workflows
  { brand: 'Apple', model: 'iPad Pro 11 (4th gen)', releaseDate: '2022-10-26', category: 'tablet-device' },
  { brand: 'Apple', model: 'iPad Pro 13 (M4)', releaseDate: '2024-05-15', category: 'tablet-device' },
  { brand: 'Apple', model: 'iPad Air (M2)', releaseDate: '2024-05-15', category: 'tablet-device' },
  { brand: 'Samsung', model: 'Galaxy Tab S9 Ultra', releaseDate: '2023-08-11', category: 'tablet-device' },
  { brand: 'Samsung', model: 'Galaxy Tab S10 Ultra', releaseDate: '2024-10-03', category: 'tablet-device' },
  { brand: 'Xiaomi', model: 'Pad 6', releaseDate: '2023-04-18', category: 'tablet-device' },
];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeBrand = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return BRAND_ALIASES.get(trimmed) || trimmed.replace(/\s+Corporation$/i, '').replace(/\s+Inc\.?$/i, '');
};

const normalizeDate = (value) => {
  if (typeof value !== 'string') return '';
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const year = Number.parseInt(date.slice(0, 4), 10);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return '';
  return date;
};

const inferCategory = (brand, model) => {
  const b = brand.toLowerCase();
  const m = model.toLowerCase();
  const text = `${b} ${m}`;

  if (
    m.includes('mavic') ||
    m.includes('inspire') ||
    m.includes('phantom') ||
    m.includes('mini ') ||
    m.includes('air ') ||
    m.includes('avata') ||
    m.includes('anafi') ||
    b.includes('autel') ||
    b.includes('skydio') ||
    text.includes('drone')
  ) {
    return 'drone-camera';
  }

  if (
    text.includes('gopro') ||
    text.includes('insta360') ||
    text.includes('hero') ||
    text.includes('osmo action') ||
    text.includes('action')
  ) {
    return 'action-camera';
  }

  if (
    m.includes('iphone') ||
    m.includes('galaxy s') ||
    m.includes('pixel') ||
    (b.includes('xiaomi') && /\d+\s*ultra/.test(m))
  ) {
    return 'mobile-device';
  }

  if (m.includes('ipad') || m.includes('tab ') || m.includes('pad ')) {
    return 'tablet-device';
  }

  if (
    m.includes('eos c') ||
    m.includes('fx') ||
    m.includes('burano') ||
    m.includes('venice') ||
    m.includes('komodo') ||
    m.includes('v-raptor') ||
    m.includes('alexa ') ||
    m.includes('ursa') ||
    m.includes('cinema')
  ) {
    return 'cine-camera';
  }

  if (b.includes('logitech')) return 'webcam';

  return 'photo-camera';
};

const inferType = (category) =>
  category === 'cine-camera' ||
  category === 'drone-camera' ||
  category === 'action-camera' ||
  category === 'mobile-device'
    ? 'video'
    : 'photo';

const fetchWikidataReleases = async () => {
  const query = `
SELECT ?item ?itemLabel ?manufacturerLabel ?date WHERE {
  ?item wdt:P31/wdt:P279* wd:Q20888659 .
  ?item wdt:P176 ?manufacturer .
  {
    ?item wdt:P571 ?date .
  } UNION {
    ?item wdt:P577 ?date .
  }
  FILTER(YEAR(?date) >= ${MIN_YEAR} && YEAR(?date) <= ${MAX_YEAR})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?manufacturerLabel ?date ?itemLabel
`;

  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'creatorhub-camera-registry-generator/1.0 (development)',
      Accept: 'application/sparql-results+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const bindings = payload?.results?.bindings ?? [];

  return bindings
    .map((row) => {
      const model = String(row.itemLabel?.value || '').trim();
      const brand = normalizeBrand(row.manufacturerLabel?.value);
      const releaseDate = normalizeDate(String(row.date?.value || ''));
      if (!model || !brand || !releaseDate) return null;
      if (!ACCEPTED_WIKIDATA_BRANDS.has(brand)) return null;
      if (/^Q\d+$/i.test(model)) return null;

      const category = inferCategory(brand, model);
      const type = inferType(category);
      return {
        id: slugify(`${brand}-${model}-${releaseDate}`),
        externalId: slugify(`${brand}:${model}`),
        brand,
        model,
        category,
        type,
        releaseDate,
        source: 'wikidata',
      };
    })
    .filter(Boolean);
};

const sanitizeManualEntries = () =>
  MANUAL_ENTRIES.map((entry) => {
    const releaseDate = normalizeDate(entry.releaseDate);
    if (!releaseDate) return null;
    const brand = entry.brand.trim();
    const model = entry.model.trim();
    const category = entry.category;
    const type = inferType(category);
    return {
      id: slugify(`${brand}-${model}-${releaseDate}`),
      externalId: slugify(`${brand}:${model}`),
      brand,
      model,
      category,
      type,
      releaseDate,
      source: 'manual',
    };
  }).filter(Boolean);

const buildRegistry = async () => {
  const wikidataEntries = await fetchWikidataReleases();
  const manualEntries = sanitizeManualEntries();

  const deduped = new Map();
  for (const entry of [...wikidataEntries, ...manualEntries]) {
    const key = entry.externalId;
    const previous = deduped.get(key);
    if (!previous) {
      deduped.set(key, entry);
      continue;
    }

    // Prefer manual overrides when both exist.
    if (entry.source === 'manual') {
      deduped.set(key, entry);
      continue;
    }

    // Keep earliest releaseDate if both are auto-sourced for stability.
    if (entry.releaseDate < previous.releaseDate) {
      deduped.set(key, entry);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand, 'en');
    return a.model.localeCompare(b.model, 'en');
  });
};

const renderFile = (entries) => {
  const lines = [];
  lines.push('/**');
  lines.push(' * Auto-generated camera release registry (2020-2026).');
  lines.push(' * Sources: Wikidata camera-model snapshot + curated manual additions.');
  lines.push(' * Generated by backend/scripts/generate-camera-release-registry.mjs');
  lines.push(' */');
  lines.push('');
  lines.push("export type CameraReleaseCategory =");
  lines.push("  | 'photo-camera'");
  lines.push("  | 'cine-camera'");
  lines.push("  | 'drone-camera'");
  lines.push("  | 'action-camera'");
  lines.push("  | 'mobile-device'");
  lines.push("  | 'tablet-device'");
  lines.push("  | 'webcam';");
  lines.push('');
  lines.push('export interface CameraReleaseRegistryEntry {');
  lines.push('  id: string;');
  lines.push('  externalId: string;');
  lines.push('  brand: string;');
  lines.push('  model: string;');
  lines.push('  category: CameraReleaseCategory;');
  lines.push("  type: 'photo' | 'video';");
  lines.push('  releaseDate: string;');
  lines.push("  source: 'wikidata' | 'manual';");
  lines.push('}');
  lines.push('');
  lines.push('export const CAMERA_RELEASE_REGISTRY_2020_2026: CameraReleaseRegistryEntry[] = [');

  for (const entry of entries) {
    lines.push('  {');
    lines.push(`    id: '${entry.id}',`);
    lines.push(`    externalId: '${entry.externalId}',`);
    lines.push(`    brand: '${entry.brand.replace(/'/g, "\\'")}',`);
    lines.push(`    model: '${entry.model.replace(/'/g, "\\'")}',`);
    lines.push(`    category: '${entry.category}',`);
    lines.push(`    type: '${entry.type}',`);
    lines.push(`    releaseDate: '${entry.releaseDate}',`);
    lines.push(`    source: '${entry.source}',`);
    lines.push('  },');
  }

  lines.push('];');
  lines.push('');
  return `${lines.join('\n')}`;
};

const main = async () => {
  const registry = await buildRegistry();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.resolve(__dirname, '../../frontend/shared/camera-release-registry.ts');

  await writeFile(outputPath, renderFile(registry), 'utf8');

  const stats = registry.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byCategory[item.category] = (acc.byCategory[item.category] || 0) + 1;
      return acc;
    },
    { total: 0, byCategory: {} }
  );

  console.log(`Wrote ${stats.total} camera releases to ${outputPath}`);
  console.log('Category distribution:', stats.byCategory);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
