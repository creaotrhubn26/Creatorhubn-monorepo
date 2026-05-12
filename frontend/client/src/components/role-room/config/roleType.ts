/**
 * Role-type config — kanoniske rolletyper for casting i Role Room.
 *
 * Paralleltt til `roleWorkflow.ts` som dekker status (Åpen/Casting/Besatt).
 * Mens status er en lukket enum-shape, er `roleType` lagret som fritekst i
 * data-modellen (poolRole.roleType: string). Denne modulen mapper
 * fritekst-verdier (norsk + engelsk + aliaser) til en kanonisk type med
 * label + farge + ikon-hint, slik at UI får konsistent visuell behandling
 * uansett hvilken verdi som ligger i basen.
 *
 * Aliaser dekker både eldre data (Bistandsrolle) og industri-standard
 * (Birolle), pluss engelske ekvivalenter for internasjonale prosjekter.
 */

export type RoleTypeCanonical = 'lead' | 'supporting' | 'minor' | 'extra' | 'unknown';

export interface RoleTypeMeta {
  canonical: RoleTypeCanonical;
  label: string;
  /** Hex-farge brukt på chip-background/text */
  color: string;
  /** Sortering — viktigste først */
  order: number;
}

const ROLE_TYPE_META: Record<RoleTypeCanonical, RoleTypeMeta> = {
  lead: {
    canonical: 'lead',
    label: 'Hovedrolle',
    color: '#10b981',
    order: 0,
  },
  supporting: {
    canonical: 'supporting',
    label: 'Birolle',
    color: '#f59e0b',
    order: 1,
  },
  minor: {
    canonical: 'minor',
    label: 'Liten rolle',
    color: '#60a5fa',
    order: 2,
  },
  extra: {
    canonical: 'extra',
    label: 'Statist',
    color: '#9ca3af',
    order: 3,
  },
  unknown: {
    canonical: 'unknown',
    label: '',
    color: '#6b7280',
    order: 99,
  },
};

const ALIAS_MAP: Record<string, RoleTypeCanonical> = {
  // lead
  'hovedrolle': 'lead',
  'hovedroller': 'lead',
  'lead': 'lead',
  'leads': 'lead',
  'main role': 'lead',
  'main character': 'lead',
  'protagonist': 'lead',

  // supporting
  'birolle': 'supporting',
  'biroller': 'supporting',
  'bistandsrolle': 'supporting',
  'bistandsroller': 'supporting',
  'supporting': 'supporting',
  'supporting role': 'supporting',
  'support': 'supporting',
  'medvirkende': 'supporting',

  // minor
  'liten rolle': 'minor',
  'små roller': 'minor',
  'small role': 'minor',
  'minor': 'minor',
  'minor role': 'minor',
  'bit part': 'minor',

  // extra
  'statist': 'extra',
  'statister': 'extra',
  'extra': 'extra',
  'extras': 'extra',
  'background': 'extra',
  'background actor': 'extra',
};

/**
 * Normaliserer en fritekst-rolletype til kanonisk meta. Returnerer 'unknown'
 * med fritekst-verdien intakt som label hvis ingen alias matcher — dette
 * sikrer at uventede verdier fortsatt vises (graceful degradation).
 */
export function getRoleTypeMeta(roleType: string | null | undefined): RoleTypeMeta {
  if (!roleType || typeof roleType !== 'string') return ROLE_TYPE_META.unknown;
  const normalized = roleType.trim().toLowerCase();
  const canonical = ALIAS_MAP[normalized];
  if (canonical) return ROLE_TYPE_META[canonical];
  return {
    ...ROLE_TYPE_META.unknown,
    label: roleType.trim(),
  };
}

export const ROLE_TYPE_ORDER: RoleTypeCanonical[] = ['lead', 'supporting', 'minor', 'extra'];
