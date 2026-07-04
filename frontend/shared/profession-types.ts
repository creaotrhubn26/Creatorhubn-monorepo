/**
 * profession-types.ts — ÉN kilde til sannhet for profesjons-identiteter.
 *
 * Avhengighetsfri (ingen drizzle, ingen MUI) så den kan importeres av BÅDE
 * backend (`../../frontend/shared/profession-types.ts`, samme mønster som
 * camera-database) og frontend/shared.
 *
 * Rollefordeling:
 *  - Denne fila eier de KANONISKE id-ene (underscore-form: `music_producer`),
 *    alias-normalisering og kode-baseline-listen.
 *  - DB-tabellen `profession_types` kan utvide/overstyre baselinen i runtime
 *    (admin legger til profesjoner) — se GET /api/admin/profession-types som
 *    merger DB over denne listen.
 *  - `profession-type-registry.ts` beholder rik markeds-metadata (frontend).
 *  - Workspace-kategorier (visual/music/vendor/…) bor i workspaceTheme.ts og
 *    er robuste mot alias-varianter uavhengig av denne fila.
 */

export interface CanonicalProfession {
  /** Kanonisk id (lowercase, underscore) — verdien som skal stå i users.profession. */
  name: string;
  displayName: string;
  iconColor: string;
  category:
    | 'creative'
    | 'service'
    | 'education'
    | 'health'
    | 'lifestyle'
    | 'business'
    | 'entertainment';
  isActive: boolean;
  sortOrder: number;
}

/**
 * Kode-baseline: profesjonene plattformen alltid kjenner, selv med tom/utilgjengelig
 * DB. Speiler registry-ets aktive profesjoner + enterprise (rolle-profesjon brukt
 * av gating og admin-fallbacks). Farger fra registry/branding.
 */
export const CANONICAL_PROFESSIONS: CanonicalProfession[] = [
  { name: 'photographer', displayName: 'Fotograf', iconColor: '#ff8c00', category: 'creative', isActive: true, sortOrder: 0 },
  { name: 'videographer', displayName: 'Videograf', iconColor: '#e74c3c', category: 'creative', isActive: true, sortOrder: 1 },
  { name: 'music_producer', displayName: 'Musikkprodusent', iconColor: '#9b59b6', category: 'creative', isActive: true, sortOrder: 2 },
  { name: 'pet_groomer', displayName: 'Dyrepleier', iconColor: '#27ae60', category: 'service', isActive: true, sortOrder: 3 },
  { name: 'vendor', displayName: 'Leverandør', iconColor: '#3498db', category: 'business', isActive: true, sortOrder: 4 },
  { name: 'enterprise', displayName: 'Enterprise Team', iconColor: '#6c3483', category: 'business', isActive: true, sortOrder: 5 },
];

/**
 * Strip til sammenlignings-nøkkel: lowercase, norske tegn translittereres
 * (ø→o, å→a, æ→ae) og alt utenom a-z0-9 fjernes — 'music_producer'/
 * 'music-producer'/'MusicProducer' og 'Leverandør'/'leverandor' blir like.
 */
const stripKey = (s: string): string =>
  s.toLowerCase().replace(/ø/g, 'o').replace(/å/g, 'a').replace(/æ/g, 'ae').replace(/[^a-z0-9]/g, '');

/**
 * Alias → kanonisk id. Nøkler slås opp i strippet form, så én linje dekker
 * alle skilletegns-varianter. KUN stavevarianter og norske synonymer — ingen
 * semantiske sammenslåinger (f.eks. mapper vi IKKE 'musician' hit).
 */
const PROFESSION_ALIASES: Record<string, string> = {
  musicproducer: 'music_producer',
  musikkprodusent: 'music_producer',
  fotograf: 'photographer',
  videograf: 'videographer',
  leverandor: 'vendor', // dekker 'leverandør' etter stripping
  dyrepleier: 'pet_groomer',
};

const CANONICAL_BY_STRIPPED: Record<string, string> = Object.fromEntries(
  CANONICAL_PROFESSIONS.map((p) => [stripKey(p.name), p.name]),
);

/**
 * Normaliser en rå profesjonsverdi til kanonisk form. PERMISSIV: ukjente
 * verdier returneres lowercase/trimmet i stedet for å forkastes (plattformen
 * har ~20 registry-profesjoner + DB-utvidbare typer). Bruk canonicalizeProfession()
 * der du trenger whitelisting.
 *
 *   normalizeProfession('MusicProducer') → 'music_producer'
 *   normalizeProfession('Fotograf')      → 'photographer'
 *   normalizeProfession('hairdresser')   → 'hairdresser' (ukjent, beholdes)
 */
export function normalizeProfession(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!v) return '';
  const stripped = stripKey(v);
  return PROFESSION_ALIASES[stripped] || CANONICAL_BY_STRIPPED[stripped] || v;
}

/**
 * STRENG variant: normaliser og krev at resultatet er en kjent kanonisk
 * profesjon — ellers null. For whitelisting-kontekster (team-invite o.l.).
 */
export function canonicalizeProfession(raw: unknown): string | null {
  const n = normalizeProfession(raw);
  if (!n) return null;
  return CANONICAL_BY_STRIPPED[stripKey(n)] || null;
}

/** Er verdien (etter normalisering) en kjent, aktiv kanonisk profesjon? */
export function isValidProfession(profession: unknown): boolean {
  const canonical = canonicalizeProfession(profession);
  if (!canonical) return false;
  return CANONICAL_PROFESSIONS.some((p) => p.name === canonical && p.isActive);
}

export function getProfessionTypes(): CanonicalProfession[] {
  return CANONICAL_PROFESSIONS.filter((p) => p.isActive);
}

export function getProfessionDisplayName(profession: unknown): string {
  const canonical = canonicalizeProfession(profession);
  const found = canonical ? CANONICAL_PROFESSIONS.find((p) => p.name === canonical) : null;
  return found?.displayName || normalizeProfession(profession) || '';
}

export function getProfessionIconColor(profession: unknown): string {
  const canonical = canonicalizeProfession(profession);
  const found = canonical ? CANONICAL_PROFESSIONS.find((p) => p.name === canonical) : null;
  return found?.iconColor || '#ff8c00';
}

/** @deprecated Bruk CANONICAL_PROFESSIONS. Beholdt for form-kompatibilitet. */
export const DEFAULT_PROFESSION_TYPES = CANONICAL_PROFESSIONS.map(
  ({ name, displayName, iconColor }) => ({ name, displayName, iconColor }),
);

/** @deprecated Kompatibilitets-alias for gammelt interface-navn. */
export type DynamicProfessionConfig = CanonicalProfession;
