/**
 * blockSchema.ts
 *
 * Block-fundament for Webflow-paritet CMS (Fase 1).
 * Lagres som `content.blocks: Block[]` i `cms_pages.content`-jsonb.
 *
 * Hver blokk er et diskriminert union basert på `type`. Når content
 * inneholder en blokk-liste, renderer frontend BlockRenderer; ellers
 * faller den tilbake til hardkodet default-layout.
 *
 * Fase 2 introduserer TipTap rik-tekst som erstatter `text: string`
 * i RichTextBlock — schema-versjon vil bumpes når dette skjer.
 */

export type BlockKind =
  | 'hero'
  | 'richText'
  | 'faq'
  | 'comparison'
  | 'cta'
  | 'featureList'
  | 'relatedStudies'
  | 'usageExamples'
  | 'image';

export type Locale = 'no' | 'en';
export const SUPPORTED_LOCALES: Locale[] = ['no', 'en'];
export const DEFAULT_LOCALE: Locale = 'no';

interface BlockBase {
  id: string;
  type: BlockKind;
  /**
   * Lokaliserte overrides. Norsk er kanonisk og lever i hovedfeltene.
   * Engelsk (eller fremtidig andre språk) lever som partial-overrides.
   * Tom override-objekt = bruk norsk fallback.
   */
  i18n?: {
    en?: Record<string, unknown>;
  };
}

export interface HeroBlock extends BlockBase {
  type: 'hero';
  audienceChip?: string;
  h1: string;
  subtitle?: string;
  intro?: string;
  primaryCtaLabel?: string;
  primaryCtaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
}

export interface RichTextBlock extends BlockBase {
  type: 'richText';
  // TipTap-generert HTML. Sanitiseres med DOMPurify ved render.
  text: string;
  heading?: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface FaqBlock extends BlockBase {
  type: 'faq';
  heading?: string;
  items: FaqEntry[];
}

export type ComparisonSupport = 'yes' | 'no' | 'partial' | 'unknown';

export interface ComparisonRow {
  feature: string;
  roleRoom: ComparisonSupport;
  competitor: ComparisonSupport;
  note?: string;
}

export interface ComparisonBlock extends BlockBase {
  type: 'comparison';
  heading?: string;
  competitorLabel: string;
  rows: ComparisonRow[];
}

export interface CtaBlock extends BlockBase {
  type: 'cta';
  heading: string;
  body?: string;
  buttonLabel: string;
  buttonUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
}

export interface FeatureListBlock extends BlockBase {
  type: 'featureList';
  heading?: string;
  items: string[];
  style?: 'chips' | 'bullets';
}

export interface RelatedStudy {
  name: string;
  institution: string;
  note?: string;
}

export interface RelatedStudiesBlock extends BlockBase {
  type: 'relatedStudies';
  heading?: string;
  items: RelatedStudy[];
}

export interface UsageExample {
  title: string;
  body: string;
}

export interface UsageExamplesBlock extends BlockBase {
  type: 'usageExamples';
  heading?: string;
  items: UsageExample[];
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  maxWidth?: number;
}

export type Block =
  | HeroBlock
  | RichTextBlock
  | FaqBlock
  | ComparisonBlock
  | CtaBlock
  | FeatureListBlock
  | RelatedStudiesBlock
  | UsageExamplesBlock
  | ImageBlock;

export const BLOCK_LABELS: Record<BlockKind, string> = {
  hero: 'Hero',
  richText: 'Rik tekst',
  faq: 'FAQ',
  comparison: 'Sammenligning',
  cta: 'CTA-knapp',
  featureList: 'Funksjons-liste',
  relatedStudies: 'Relaterte studier',
  usageExamples: 'Bruks-eksempler',
  image: 'Bilde',
};

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createBlock(type: BlockKind): Block {
  const id = nextId(type);
  switch (type) {
    case 'hero':
      return {
        id,
        type: 'hero',
        audienceChip: '',
        h1: 'Tittel her',
        subtitle: '',
        intro: '',
        primaryCtaLabel: 'Kom i gang',
        primaryCtaUrl: '/',
      };
    case 'richText':
      return { id, type: 'richText', text: '' };
    case 'faq':
      return { id, type: 'faq', heading: 'Spørsmål og svar', items: [{ q: '', a: '' }] };
    case 'comparison':
      return {
        id,
        type: 'comparison',
        heading: 'Sammenligning',
        competitorLabel: 'Konkurrent',
        rows: [{ feature: '', roleRoom: 'yes', competitor: 'no' }],
      };
    case 'cta':
      return {
        id,
        type: 'cta',
        heading: 'Klar til å prøve?',
        body: '',
        buttonLabel: 'Kom i gang',
        buttonUrl: '/',
      };
    case 'featureList':
      return { id, type: 'featureList', heading: '', items: [''], style: 'chips' };
    case 'relatedStudies':
      return { id, type: 'relatedStudies', heading: 'Relaterte studier', items: [{ name: '', institution: '' }] };
    case 'usageExamples':
      return { id, type: 'usageExamples', heading: 'Bruks-eksempler', items: [{ title: '', body: '' }] };
    case 'image':
      return { id, type: 'image', src: '', alt: '' };
  }
}

export function isBlockArray(value: unknown): value is Block[] {
  return Array.isArray(value) && value.every((b) => {
    if (!b || typeof b !== 'object') return false;
    const candidate = b as Record<string, unknown>;
    return typeof candidate.id === 'string' && typeof candidate.type === 'string' && candidate.type in BLOCK_LABELS;
  });
}

export interface BlocksContent {
  blocks: Block[];
  // Versjonering for å kunne migrere skjema senere uten å bryte eksisterende data
  schemaVersion?: number;
}

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Slår sammen kanonisk (norsk) blokk-innhold med locale-overrides.
 * Tomme override-felter (undefined, '') bevarer kanonisk verdi —
 * editoren markerer felt som "ikke oversatt" når dette skjer.
 */
export function applyLocale<T extends Block>(block: T, locale: Locale): T {
  if (locale === DEFAULT_LOCALE) return block;
  const overrides = block.i18n?.[locale];
  if (!overrides || typeof overrides !== 'object') return block;

  const merged: Record<string, unknown> = { ...block };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'id' || key === 'type' || key === 'i18n') continue;
    // Tom string / undefined / tom array betyr "behold kanonisk"
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    merged[key] = value;
  }
  return merged as T;
}
