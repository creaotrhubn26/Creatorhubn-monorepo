/**
 * tester-program-terms.ts — Slice 9X.53
 *
 * Single source of truth for prototype-tester-programmets forpliktelser
 * og belønninger. Brukes i:
 *   - InviteRequestForm (sammendrag på steg 1)
 *   - E-post-kvittering (full versjon)
 *   - AcceptPrototypeTesterInvite (NDA-flow, før signering)
 *   - WelcomeTesterModal (etter signering)
 *   - TesterStatusBanner (i header når innlogget)
 *   - Ukentlig digest-e-post (cron)
 *
 * Hvis vilkårene endres må PROGRAM_TERMS_VERSION bumpes.
 * Da må eksisterende testere re-signere før de fortsetter.
 */

export const PROGRAM_TERMS_VERSION = '1.0';

export const TESTER_PROGRAM_TERMS = {
  durationWeeks: 12,
  expectedHoursPerWeek: 2,
  feedbackMinimumPerMonth: 4,
  criticalBugResponseHours: 24,

  benefits: [
    '12 måneder gratis Creatorhubn Professional-plan etter testperioden',
    '«Early supporter»-badge på profilen din',
    'Direkte tilgang til produkt-team via prioritert kanal',
    'Tidlig tilgang til alle nye funksjoner under utvikling',
  ],

  obligations: [
    'Test minst 1 ny funksjon eller flyt per uke',
    'Logg minst 4 feedback-items per måned (via in-app feedback-knapp)',
    'Svar på korte spørreundersøkelser innen 7 dager',
    'Rapporter kritiske feil innen 24 timer',
    'Respekter NDA-en (ikke del skjermbilder eller funksjons-detaljer offentlig)',
  ],

  feedbackChannels: {
    primary: {
      label: 'In-app feedback-knapp',
      description: 'Klikk på "Gi feedback"-ikonet (synlig overalt i appen for testere). Foretrukket kanal.',
      icon: 'feedback',
    },
    monthlySurvey: {
      label: 'Månedlig spørreundersøkelse',
      description: 'Du får e-post første uke i hver måned med 5–10 strukturerte spørsmål.',
      icon: 'poll',
    },
    emergency: {
      label: 'Direkte e-post for kritiske feil',
      description: 'daniel@creatorhubn.com — bare for blokkerende feil som hindrer videre testing.',
      icon: 'email',
    },
  },

  exitClause:
    'Du kan trekke deg fra programmet når som helst med 7 dagers varsel. Vi spør om en kort exit-survey (5 minutter) for å lære av tilbakemeldingen din.',

  whatYouGetAccess: [
    'Hele Creatorhubn-plattformen, inkl. ikke-frigjorte funksjoner',
    'Privat «Testers»-kanal med produkt-team',
    'Månedlig 30 min onboarding/check-in-call (frivillig)',
  ],

  whatYouDoNotGet: [
    'Tilgang til Role Room (eget tester-program)',
    'Kompensasjon i kroner (belønningen er gratis Pro-tilgang etter)',
    'SLA på response-tid fra produkt-team (de er ikke support)',
  ],
} as const;

export type TesterProgramTerms = typeof TESTER_PROGRAM_TERMS;

/**
 * Generates a plain-text version of the program terms, brukt i e-post.
 */
export function programTermsAsText(): string {
  const t = TESTER_PROGRAM_TERMS;
  return [
    `Prototype-tester-program — versjon ${PROGRAM_TERMS_VERSION}`,
    '',
    `Varighet: ${t.durationWeeks} uker`,
    `Forventet innsats: ~${t.expectedHoursPerWeek} timer per uke, minst ${t.feedbackMinimumPerMonth} feedback-items per måned`,
    '',
    'HVA DU FORPLIKTER DEG TIL:',
    ...t.obligations.map((o) => `  • ${o}`),
    '',
    'HVA DU FÅR:',
    ...t.benefits.map((b) => `  • ${b}`),
    '',
    'HVA DU FÅR TILGANG TIL:',
    ...t.whatYouGetAccess.map((a) => `  • ${a}`),
    '',
    'HVA DU IKKE FÅR:',
    ...t.whatYouDoNotGet.map((a) => `  • ${a}`),
    '',
    'EXIT-KLAUSUL:',
    `  ${t.exitClause}`,
  ].join('\n');
}

/**
 * Compact summary for in-form preview (1–2 sentences).
 */
export function programTermsShortSummary(): string {
  const t = TESTER_PROGRAM_TERMS;
  return `${t.durationWeeks} uker, ~${t.expectedHoursPerWeek} t/uke, minst ${t.feedbackMinimumPerMonth} feedback/mnd. Belønning: 12 mnd gratis Professional etter perioden.`;
}
