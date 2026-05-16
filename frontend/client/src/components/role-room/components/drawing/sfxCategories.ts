/**
 * sfxCategories — kuratert katalog over SFX-typer som vi prøver å
 * detektere i frame-beskrivelser. Hver kategori har:
 *
 *   - id: stabil nøkkel for matching (kebab-case)
 *   - label: norsk visningsnavn for UI
 *   - keywords: norsk + engelsk-tokens som indikerer kategorien
 *   - defaultIntensity: rimelig default når ingen modifier finnes
 *   - layer: 'event' = kort lyd ved start | 'ambient' = bakgrunn for
 *     hele scenen | 'music' = stemnings-musikk
 *
 * Lista er bevisst rundt 35 kategorier — nok til å dekke vanlige
 * storyboard-scenarier, lite nok til å lett vedlikeholdes.
 */

export type SfxIntensity = 'low' | 'medium' | 'high';
export type SfxLayer = 'event' | 'ambient' | 'music';

export interface SfxCategory {
  id: string;
  label: string;
  keywords: string[];
  defaultIntensity: SfxIntensity;
  layer: SfxLayer;
}

export const SFX_CATEGORIES: SfxCategory[] = [
  // === Dører / inngang ===
  { id: 'door-open', label: 'Dør åpnes', keywords: ['åpner døra', 'åpner dør', 'door opens', 'åpner porten'], defaultIntensity: 'low', layer: 'event' },
  { id: 'door-close', label: 'Dør lukkes', keywords: ['lukker døra', 'lukker dør', 'door closes'], defaultIntensity: 'low', layer: 'event' },
  { id: 'door-slam', label: 'Dør smelles', keywords: ['smeller døra', 'slammer døra', 'dør slår', 'door slam', 'slamming'], defaultIntensity: 'high', layer: 'event' },
  { id: 'knock', label: 'Banking', keywords: ['banker på', 'knock', 'banker på døra'], defaultIntensity: 'medium', layer: 'event' },

  // === Fotsteg / bevegelse ===
  { id: 'footsteps-walking', label: 'Fotsteg (gående)', keywords: ['går', 'fotsteg', 'walking', 'footsteps', 'tråkk'], defaultIntensity: 'low', layer: 'event' },
  { id: 'footsteps-running', label: 'Løping', keywords: ['løper', 'running', 'sprinter', 'kommer løpende'], defaultIntensity: 'high', layer: 'event' },

  // === Vær / natur ===
  { id: 'thunder', label: 'Torden', keywords: ['torden', 'thunder', 'tordenklap', 'lyn slår'], defaultIntensity: 'high', layer: 'event' },
  { id: 'rain', label: 'Regn', keywords: ['regn', 'pøsregn', 'rain', 'regnvær'], defaultIntensity: 'medium', layer: 'ambient' },
  { id: 'wind', label: 'Vind', keywords: ['vind', 'storm', 'wind', 'vinden'], defaultIntensity: 'medium', layer: 'ambient' },

  // === Trafikk / kjøretøy ===
  { id: 'car-pass', label: 'Bil passerer', keywords: ['bil passerer', 'car passes', 'kjører forbi'], defaultIntensity: 'medium', layer: 'event' },
  { id: 'car-start', label: 'Bil starter', keywords: ['starter bilen', 'starter motoren', 'engine starts'], defaultIntensity: 'medium', layer: 'event' },
  { id: 'car-crash', label: 'Bilkollisjon', keywords: ['kolliderer', 'krasj', 'crash', 'kollisjon'], defaultIntensity: 'high', layer: 'event' },
  { id: 'traffic', label: 'Trafikk', keywords: ['trafikk', 'traffic', 'gatestøy'], defaultIntensity: 'low', layer: 'ambient' },
  { id: 'siren', label: 'Sirene', keywords: ['sirene', 'siren', 'utrykning'], defaultIntensity: 'high', layer: 'event' },

  // === Vold / konflikt ===
  { id: 'gunshot', label: 'Skudd', keywords: ['skyter', 'skudd', 'gunshot', 'pistol', 'avfyrer'], defaultIntensity: 'high', layer: 'event' },
  { id: 'explosion', label: 'Eksplosjon', keywords: ['eksplosjon', 'explosion', 'sprenger', 'detonerer'], defaultIntensity: 'high', layer: 'event' },
  { id: 'punch', label: 'Slag', keywords: ['slår til', 'punch', 'nevedrag', 'slag mot'], defaultIntensity: 'high', layer: 'event' },
  { id: 'fight', label: 'Slosskamp', keywords: ['slåss', 'slåsskamp', 'fight', 'kjemper'], defaultIntensity: 'high', layer: 'ambient' },

  // === Glass / objekter ===
  { id: 'glass-break', label: 'Glass knuser', keywords: ['knuser glass', 'glass breaks', 'vindu knuser', 'shatter'], defaultIntensity: 'high', layer: 'event' },
  { id: 'glass-clink', label: 'Glass klinger', keywords: ['skåler', 'glass klinger', 'cheers', 'klinker'], defaultIntensity: 'low', layer: 'event' },

  // === Vann ===
  { id: 'water-splash', label: 'Vannskvulp', keywords: ['plumper', 'splash', 'plonker'], defaultIntensity: 'medium', layer: 'event' },
  { id: 'water-running', label: 'Rennende vann', keywords: ['rennende vann', 'kran', 'fossen', 'water running'], defaultIntensity: 'low', layer: 'ambient' },

  // === Telefon / elektronikk ===
  { id: 'phone-ring', label: 'Telefon ringer', keywords: ['ringer', 'telefonen ringer', 'phone rings', 'ringe-tone'], defaultIntensity: 'medium', layer: 'event' },
  { id: 'phone-hangup', label: 'Legger på', keywords: ['legger på', 'hangs up', 'klikker av'], defaultIntensity: 'low', layer: 'event' },
  { id: 'beep', label: 'Pip / varsling', keywords: ['piper', 'beep', 'varsler', 'alarm-pip'], defaultIntensity: 'low', layer: 'event' },
  { id: 'click', label: 'Klikk', keywords: ['klikker', 'click', 'knappetrykk'], defaultIntensity: 'low', layer: 'event' },

  // === Mennesker / sosiale ===
  { id: 'crowd-murmur', label: 'Mengde-murring', keywords: ['mengde', 'folk snakker', 'crowd', 'murring'], defaultIntensity: 'low', layer: 'ambient' },
  { id: 'crowd-cheer', label: 'Jubel', keywords: ['jubler', 'cheers', 'applauderer', 'roper hurra'], defaultIntensity: 'high', layer: 'event' },
  { id: 'scream', label: 'Skrik', keywords: ['skriker', 'scream', 'hyler'], defaultIntensity: 'high', layer: 'event' },
  { id: 'gasp', label: 'Gisp', keywords: ['gisp', 'gasp', 'gisper'], defaultIntensity: 'medium', layer: 'event' },
  { id: 'laugh', label: 'Latter', keywords: ['ler', 'latter', 'laugh', 'humrer'], defaultIntensity: 'medium', layer: 'event' },

  // === Stemning / musikk ===
  { id: 'music-tense', label: 'Spent musikk', keywords: ['spent', 'thriller', 'mystisk', 'tense'], defaultIntensity: 'medium', layer: 'music' },
  { id: 'music-soft', label: 'Rolig musikk', keywords: ['rolig', 'soft', 'kjærlig', 'tender', 'soft music'], defaultIntensity: 'low', layer: 'music' },
  { id: 'music-action', label: 'Action-musikk', keywords: ['action', 'forfølger', 'chase', 'tempo'], defaultIntensity: 'high', layer: 'music' },

  // === Ambient ===
  { id: 'ambient-indoor', label: 'Innendørs-ambient', keywords: ['kontoret', 'rommet', 'hjemme', 'inne'], defaultIntensity: 'low', layer: 'ambient' },
  { id: 'ambient-outdoor', label: 'Utendørs-ambient', keywords: ['utenfor', 'gata', 'park', 'utendørs'], defaultIntensity: 'low', layer: 'ambient' },
  { id: 'ambient-night', label: 'Natt-ambient', keywords: ['natt', 'kveld', 'night', 'mørket'], defaultIntensity: 'low', layer: 'ambient' },
];

/** Modifier-ord som hever eller senker default-intensitet. */
export const INTENSITY_BOOSTERS = ['voldsomt', 'kraftig', 'sterkt', 'plutselig', 'hardt'];
export const INTENSITY_DAMPENERS = ['svakt', 'fjernt', 'rolig', 'dempet', 'i bakgrunnen'];
