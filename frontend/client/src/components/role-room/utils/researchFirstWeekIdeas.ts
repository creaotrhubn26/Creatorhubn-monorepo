/**
 * First-week content ideas — item #44.
 *
 * Pure-frontend heuristic generator: given the bootstrap result, produce
 * 3 concrete content suggestions for the first week. Designed to be
 * "good enough to be useful, not so good that it replaces a real plan" —
 * the user's marketing plan generator does the proper job. These are
 * conversation starters, not the destination.
 *
 * No backend call, no LLM. Deterministic given the same input. Frontend
 * can show them with a "Send to feed planner"-button (out of scope for
 * this batch — kept as a static suggestion list for now).
 */

import type { RoleRoomAgentProducerBootstrapResult } from '../services/roleRoomAgentService';

export interface FirstWeekIdea {
  id: string;
  hook: string;
  body: string;
  format: 'reel' | 'carousel' | 'image' | 'story';
  rationale: string;
}

/** Industry-specific opening hooks. Falls back to a generic intro post
 *  when industry is unrecognized. The list is intentionally short —
 *  better to nail a few angles than spray-and-pray 30. */
const INDUSTRY_HOOKS: Record<string, string[]> = {
  'Restaurant og servering': [
    'Slik lager vi {signature} fra bunn',
    '5 retter som elskes lokalt',
    'Møt kokken bak {company}',
  ],
  'Frisør og skjønnhet': [
    'Behandlingen som tar 30 min — før/etter',
    'Slik tar du vare på {service} hjemme',
    'Møt teamet på {company}',
  ],
  'Trening og fitness': [
    'Min første uke som medlem',
    '3 øvelser som gir resultat',
    'Slik bygger vi treningsplan for deg',
  ],
};

const DEFAULT_HOOKS = [
  'Hvorfor vi startet {company}',
  'Møt teamet bak {company}',
  '3 ting du ikke visste om {industry}',
];

export function generateFirstWeekIdeas(
  result: RoleRoomAgentProducerBootstrapResult,
): FirstWeekIdea[] {
  const profile = result.companyProfile;
  if (!profile) return [];
  const company = profile.companyName || 'oss';
  const industry = profile.industry || 'bransjen';
  const offering = profile.offerings?.[0] || 'tjenesten vår';
  const audience = profile.targetAudience?.[0] || 'kunden vår';

  const hooks = INDUSTRY_HOOKS[industry] ?? DEFAULT_HOOKS;
  const formats: Array<'reel' | 'carousel' | 'image'> = ['reel', 'carousel', 'image'];
  const rationales = [
    `Sterkt åpningstrekk for ${audience} — viser hvem dere er, ikke bare hva dere gjør.`,
    `Gir bevispunkt og hjelper algoritmen å klassifisere kontoen.`,
    `Lavterskel-post som inviterer til kommentar — øker engagement-raten tidlig.`,
  ];

  return hooks.slice(0, 3).map((rawHook, idx) => {
    const hook = rawHook
      .replace(/\{company\}/g, company)
      .replace(/\{industry\}/g, industry)
      .replace(/\{signature\}/g, offering)
      .replace(/\{service\}/g, offering);
    return {
      id: `first-week-${idx}`,
      hook,
      body: `Dag ${idx + 1}: ${hook}. ${audience}-segmentet vil kjenne seg igjen.`,
      format: formats[idx],
      rationale: rationales[idx],
    };
  });
}
