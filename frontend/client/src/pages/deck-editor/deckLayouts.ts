/**
 * Layout-registry for branded deck-templates.
 *
 * Hver layout-ID matcher en seed-layout i
 * backend/server/role-room-branded-deck-templates.ts. Frontend bruker dette
 * registeret for å:
 *   1. Vite hvilke felt som skal redigeres for en gitt slide.
 *   2. Velge riktig render-komponent i SlideRenderer.
 *   3. Vise et menneskelig navn i layout-velgeren.
 *
 * Hold dette i sync med backend-templates.
 */

export type DeckLayoutId =
  | 'standard'
  | 'title'
  | 'cta'
  | 'hero_pillars'
  | 'problem_centered'
  | 'solution_split'
  | 'traction_stats'
  | 'team_grid'
  | 'ask_cta';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'string_list'
  | 'pillars'
  | 'stats'
  | 'team_members'
  | 'use_of_funds';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  helper?: string;
}

export interface LayoutDef {
  id: DeckLayoutId;
  label: string;
  shortDescription: string;
  fields: FieldSpec[];
}

export const LAYOUTS: LayoutDef[] = [
  {
    id: 'standard',
    label: 'Standard (heading + body)',
    shortDescription: 'Klassisk tekst-slide.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'body', label: 'Brødtekst', kind: 'textarea' },
    ],
  },
  {
    id: 'title',
    label: 'Forside (heading + body)',
    shortDescription: 'Enkel tittel-slide.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'body', label: 'Undertittel', kind: 'textarea' },
    ],
  },
  {
    id: 'cta',
    label: 'Avslutning (heading + body)',
    shortDescription: 'Enkel CTA-slide.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'body', label: 'CTA-tekst', kind: 'textarea' },
    ],
  },
  {
    id: 'hero_pillars',
    label: 'Hero med trust-pillars',
    shortDescription:
      'Stor hero med headline, 3 pillars, primær + sekundær CTA og mockup-slot.',
    fields: [
      { key: 'heading', label: 'Headline', kind: 'text', placeholder: 'The professional casting platform' },
      { key: 'subheading', label: 'Underlinje', kind: 'textarea', placeholder: 'for film, TV & theatre in Norway.' },
      { key: 'tagline', label: 'Tagline (over logoen)', kind: 'text', placeholder: 'Casting. Roles. Together.' },
      { key: 'pillars', label: 'Trust-pillars (3 stk)', kind: 'pillars' },
      { key: 'primaryCta', label: 'Primær CTA-tekst', kind: 'text', placeholder: 'Start casting' },
      { key: 'secondaryCta', label: 'Sekundær CTA-tekst', kind: 'text', placeholder: 'Book a demo' },
      { key: 'footer', label: 'Footer-tekst', kind: 'text', placeholder: 'Made for Norway. Built for the industry.' },
    ],
  },
  {
    id: 'problem_centered',
    label: 'Problem (sentrert + bullets)',
    shortDescription: 'Stor headline, kort tekst, 3-4 pain-points i grid.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'body', label: 'Brødtekst (1-2 setninger)', kind: 'textarea' },
      { key: 'points', label: 'Pain-points (1-5 stk)', kind: 'string_list' },
    ],
  },
  {
    id: 'solution_split',
    label: 'Løsning (split: tekst + mockup)',
    shortDescription: 'Tekst venstre, mockup-slot høyre.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'body', label: 'Brødtekst', kind: 'textarea' },
      { key: 'bullets', label: 'Bullet-punkter (1-5 stk)', kind: 'string_list' },
      {
        key: 'mockupCaption',
        label: 'Mockup-bildetekst (vises i placeholder)',
        kind: 'text',
        helper: 'Bildet selv lastes opp i en senere iterasjon — nå vises bare en stilet placeholder.',
      },
    ],
  },
  {
    id: 'traction_stats',
    label: 'Traction (4-stats-stripe)',
    shortDescription: 'Stor headline + 4 store stats med kontekst.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'stats', label: 'Stats (1-6 stk)', kind: 'stats' },
      { key: 'footnote', label: 'Fotnote (valgfri)', kind: 'textarea' },
    ],
  },
  {
    id: 'team_grid',
    label: 'Team (portrett-grid)',
    shortDescription: 'Headline + 1-4 medlemmer i grid.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'members', label: 'Medlemmer (1-4 stk)', kind: 'team_members' },
    ],
  },
  {
    id: 'ask_cta',
    label: 'Ask / CTA',
    shortDescription:
      'Finansiering med use-of-funds, eller bare CTA. Tomme felt skjules.',
    fields: [
      { key: 'heading', label: 'Tittel', kind: 'text' },
      { key: 'useOfFunds', label: 'Use of funds (valgfri)', kind: 'use_of_funds' },
      { key: 'runway', label: 'Runway-tekst (valgfri)', kind: 'text', placeholder: '12 måneder runway' },
      { key: 'ctaPrimary', label: 'Primær CTA', kind: 'text', placeholder: 'Book a demo' },
      { key: 'ctaSecondary', label: 'Sekundær CTA / kontakt', kind: 'text', placeholder: 'daniel@creatorhubn.com' },
    ],
  },
];

export function getLayout(id: string): LayoutDef {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export const BRANDED_LAYOUT_IDS: DeckLayoutId[] = [
  'hero_pillars',
  'problem_centered',
  'solution_split',
  'traction_stats',
  'team_grid',
  'ask_cta',
];

export function isBrandedLayout(id: string): boolean {
  return (BRANDED_LAYOUT_IDS as string[]).includes(id);
}
