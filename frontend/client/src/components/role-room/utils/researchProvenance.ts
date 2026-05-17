/**
 * Field-provenance helpers — backs items #5 (AI vs user-input heatmap),
 * #6 (confidence badges per field), #7 (source attribution), #16
 * (confidence inheritance), and #17 ("Why this conclusion?" rationale).
 *
 * We don't have native per-field provenance from Claude yet (that needs
 * a prompt-engineering change so synthesis returns `{value, confidence,
 * rationale, source}` per field — separate work). Instead, this module
 * computes provenance heuristically from signals already in the
 * bootstrap result: which deterministic stage filled the field, what
 * the underlying status signals look like, and which fallbacks fired.
 *
 * The heuristic is intentionally conservative: when we can't pin a
 * source down, we say "ai_synthesis" rather than overclaiming Brreg
 * verification we don't actually have. False low-confidence beats false
 * high-confidence in a UI that drives user trust.
 */

import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

export type ProvenanceSource =
  | 'user_input'
  | 'brreg'
  | 'website'
  | 'google_places'
  | 'logo_palette'
  | 'ai_synthesis'
  | 'fallback_rules';

export interface FieldProvenance {
  field: string;
  label: string;
  value: string | number | null;
  source: ProvenanceSource;
  /** 0–100. Derived from the source's reliability signals. */
  confidence: number;
  /** Free-text "Why this conclusion?" rationale for the #17 modal. */
  rationale: string;
  /** When chain length > 1, the value was inherited through multiple
   *  stages (e.g. brreg → website-cross-check → claude). UI uses this
   *  for the #16 inheritance breadcrumb. */
  chain: ProvenanceSource[];
}

const SOURCE_LABELS: Record<ProvenanceSource, string> = {
  user_input: 'Brukerinput',
  brreg: 'Brønnøysundregistrene',
  website: 'Nettsidescraping',
  google_places: 'Google Places',
  logo_palette: 'Logo-palett',
  ai_synthesis: 'AI-syntese',
  fallback_rules: 'Fallback-regler',
};

const SOURCE_COLORS: Record<ProvenanceSource, string> = {
  user_input: '#a78bfa',
  brreg: '#34d399',
  website: '#60a5fa',
  google_places: '#fbbf24',
  logo_palette: '#f472b6',
  ai_synthesis: '#22d3ee',
  fallback_rules: '#94a3b8',
};

export function getSourceLabel(source: ProvenanceSource): string {
  return SOURCE_LABELS[source];
}

export function getSourceColor(source: ProvenanceSource): string {
  return SOURCE_COLORS[source];
}

/** Heuristic: which source most likely produced this scalar string?
 *  Walks signals from most-trusted (verified Brreg) to least (rules). */
function inferStringSource(
  result: RoleRoomAgentProducerBootstrapResult,
  field: 'companyName' | 'industry' | 'organizationNumber' | 'logoUrl' | 'probableLocationAddress' | 'summary',
): { source: ProvenanceSource; chain: ProvenanceSource[]; rationale: string } {
  const profile = result.companyProfile;
  switch (field) {
    case 'organizationNumber': {
      if (result.brregCompany?.lookupStatus === 'verified') {
        return {
          source: 'brreg',
          chain: ['brreg'],
          rationale: 'Verifisert org.nr fra Enhetsregisteret. Matchet med kundens nettside/navn.',
        };
      }
      return {
        source: 'user_input',
        chain: ['user_input'],
        rationale: 'Org.nr ble lagt inn manuelt; ikke verifisert mot Brreg.',
      };
    }
    case 'companyName': {
      if (result.brregCompany?.lookupStatus === 'verified' && result.brregCompany.name === profile?.companyName) {
        return {
          source: 'brreg',
          chain: ['brreg'],
          rationale: 'Navnet er hentet fra Enhetsregisteret og matcher juridisk enhet.',
        };
      }
      return {
        source: 'user_input',
        chain: ['user_input'],
        rationale: 'Navnet kom fra brukerinput eller nettsidens og:site_name.',
      };
    }
    case 'industry': {
      const brregIndustry = result.brregCompany?.industryCode?.description;
      if (brregIndustry && profile?.industry === brregIndustry) {
        return {
          source: 'brreg',
          chain: ['brreg'],
          rationale: `Bransje hentet fra Brreg NACE-kode (${result.brregCompany?.industryCode?.code ?? '—'}).`,
        };
      }
      return {
        source: 'ai_synthesis',
        chain: ['website', 'ai_synthesis'],
        rationale: 'Bransje utledet av AI fra nettside-tekst, Google Places-kategori og brukerinput. Brreg ga ingen direkte match.',
      };
    }
    case 'logoUrl': {
      if (profile?.logoUrl) {
        return {
          source: 'website',
          chain: ['website', 'logo_palette'],
          rationale: 'Logo hentet fra nettsiden via prioritert scoring (JSON-LD Organization.logo → <link rel="image_src"> → img alt/class="logo" → favicon).',
        };
      }
      return {
        source: 'fallback_rules',
        chain: ['fallback_rules'],
        rationale: 'Ingen logo funnet på nettsiden. Bruker fallback (initialer).',
      };
    }
    case 'probableLocationAddress': {
      if (result.businessSignals?.formattedAddress === profile?.probableLocationAddress) {
        return {
          source: 'google_places',
          chain: ['google_places'],
          rationale: 'Adresse fra Google Places-oppslag på bedriftsnavn + nettside.',
        };
      }
      if (result.brregCompany?.businessAddress === profile?.probableLocationAddress) {
        return {
          source: 'brreg',
          chain: ['brreg'],
          rationale: 'Forretningsadresse fra Brreg.',
        };
      }
      return {
        source: 'fallback_rules',
        chain: ['fallback_rules'],
        rationale: 'Ingen verifisert adresse — falt tilbake til generisk.',
      };
    }
    case 'summary': {
      // Summary is almost always AI-synthesized from website meta + Brreg.
      return {
        source: 'ai_synthesis',
        chain: ['website', 'brreg', 'ai_synthesis'],
        rationale: 'Sammendrag generert av AI fra nettside-meta-description, Brreg-bransjekode og brukerens extraContext.',
      };
    }
    default:
      return { source: 'ai_synthesis', chain: ['ai_synthesis'], rationale: 'Generert av AI.' };
  }
}

function confidenceForSource(source: ProvenanceSource, status?: string): number {
  switch (source) {
    case 'user_input':
      return 95; // user typed it, but unverified
    case 'brreg':
      return 100; // verified legal entity
    case 'google_places':
      return status === 'verified' ? 90 : 75;
    case 'website':
      return 80;
    case 'logo_palette':
      return 70;
    case 'ai_synthesis':
      return 65;
    case 'fallback_rules':
      return 35;
    default:
      return 50;
  }
}

/** Maps a frontend field name to the dot-path the synthesis model
 *  returns in fieldMetadata. */
const FIELD_TO_METADATA_KEY: Record<string, string[]> = {
  companyName: ['companyProfile.companyName'],
  organizationNumber: ['companyProfile.organizationNumber'],
  industry: ['companyProfile.industry'],
  logoUrl: ['companyProfile.logoUrl', 'planningDraft.brandGuide.logoUrl'],
  address: ['companyProfile.probableLocationAddress'],
  summary: ['companyProfile.summary'],
  offerings: ['companyProfile.offerings'],
  targetAudience: ['companyProfile.targetAudience'],
  brandColors: ['planningDraft.brandGuide.colors'],
};

/** Reads the synthesis-model-supplied provenance for a field if present,
 *  returning null when no metadata exists for any of the candidate keys. */
function readModelProvenance(
  result: RoleRoomAgentProducerBootstrapResult,
  field: string,
): { source: ProvenanceSource; chain: ProvenanceSource[]; rationale: string; confidence: number } | null {
  const metadata = result.fieldMetadata;
  if (!metadata) return null;
  const candidates = FIELD_TO_METADATA_KEY[field] ?? [];
  for (const key of candidates) {
    const entry = metadata[key];
    if (!entry) continue;
    const chain = (entry.sourceChain ?? []) as ProvenanceSource[];
    const source: ProvenanceSource = chain[chain.length - 1] ?? 'ai_synthesis';
    return {
      source,
      chain: chain.length > 0 ? chain : [source],
      rationale: entry.rationale ?? 'Modellen ga ingen rationale for dette feltet.',
      confidence: typeof entry.confidence === 'number' ? entry.confidence : 60,
    };
  }
  return null;
}

/** Builds a full provenance list for the top-level fields shown in the
 *  research overlay. UI renders this as a heatmap (item #5) + per-field
 *  confidence badges (#6) + click-to-explain modal (#17). Prefers
 *  synthesis-model provenance (item #6 proper-fix) when present, falls
 *  back to heuristic inference when the model didn't fill it in. */
export function buildResearchProvenance(
  result: RoleRoomAgentProducerBootstrapResult,
): FieldProvenance[] {
  const profile = result.companyProfile;
  if (!profile) return [];

  const fields: Array<{
    field: string;
    label: string;
    value: string | number | null;
    inferred: ReturnType<typeof inferStringSource>;
  }> = [
    {
      field: 'companyName',
      label: 'Bedriftsnavn',
      value: profile.companyName,
      inferred: inferStringSource(result, 'companyName'),
    },
    {
      field: 'organizationNumber',
      label: 'Organisasjonsnummer',
      value: profile.organizationNumber ?? null,
      inferred: inferStringSource(result, 'organizationNumber'),
    },
    {
      field: 'industry',
      label: 'Bransje',
      value: profile.industry,
      inferred: inferStringSource(result, 'industry'),
    },
    {
      field: 'logoUrl',
      label: 'Logo',
      value: profile.logoUrl ?? null,
      inferred: inferStringSource(result, 'logoUrl'),
    },
    {
      field: 'address',
      label: 'Adresse',
      value: profile.probableLocationAddress ?? null,
      inferred: inferStringSource(result, 'probableLocationAddress'),
    },
    {
      field: 'summary',
      label: 'Sammendrag',
      value: profile.summary,
      inferred: inferStringSource(result, 'summary'),
    },
    {
      field: 'offerings',
      label: 'Tilbud',
      value: `${profile.offerings?.length ?? 0} stk`,
      inferred: {
        source: 'ai_synthesis',
        chain: ['website', 'ai_synthesis'],
        rationale: 'Tilbud utledet av AI fra website-snippets og Google Places service-signaler.',
      },
    },
    {
      field: 'targetAudience',
      label: 'Målgruppe',
      value: `${profile.targetAudience?.length ?? 0} segmenter`,
      inferred: {
        source: 'ai_synthesis',
        chain: ['ai_synthesis'],
        rationale: 'Målgruppe-segmenter generert av AI basert på bransjeklassifisering og forretningsmodell.',
      },
    },
    {
      field: 'brandColors',
      label: 'Brand-farger',
      value: `${result.planningDraft?.brandGuide?.colors?.length ?? 0} farger`,
      inferred: {
        source: 'logo_palette',
        chain: ['website', 'logo_palette'],
        rationale: 'Brand-farger ekstrahert fra logo med node-vibrant (Vibrant → DarkVibrant → LightVibrant).',
      },
    },
  ];

  return fields.map((entry) => {
    // Prefer model-supplied provenance when present (the "real" item #6
    // path); otherwise fall back to the heuristic computed from data
    // signals. Heuristic is intentionally lower-confidence so model
    // values out-vote it where they exist.
    const modelProvenance = readModelProvenance(result, entry.field);
    if (modelProvenance) {
      return {
        field: entry.field,
        label: entry.label,
        value: entry.value,
        source: modelProvenance.source,
        chain: modelProvenance.chain,
        rationale: modelProvenance.rationale,
        confidence: modelProvenance.confidence,
      };
    }
    return {
      field: entry.field,
      label: entry.label,
      value: entry.value,
      source: entry.inferred.source,
      chain: entry.inferred.chain,
      rationale: entry.inferred.rationale,
      confidence: confidenceForSource(entry.inferred.source),
    };
  });
}
