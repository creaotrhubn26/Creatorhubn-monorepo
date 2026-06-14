/**
 * Market Intelligence — felles typer.
 *
 * Disse matcher 1:1 spec'et (TypeScript-typene Daniel sendte) for å gjøre
 * det enkelt å bruke fra frontend uten ekstra mapping.
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type FunnelStageKey =
  | 'awareness'
  | 'landing_page'
  | 'lead_magnet'
  | 'signup'
  | 'demo_booking'
  | 'email_nurture'
  | 'retargeting'
  | 'checkout'
  | 'upsell'
  | 'community'
  | 'referral';

export const ALL_FUNNEL_STAGES: FunnelStageKey[] = [
  'awareness', 'landing_page', 'lead_magnet', 'signup', 'demo_booking',
  'email_nurture', 'retargeting', 'checkout', 'upsell', 'community', 'referral',
];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  awareness: 'Oppmerksomhet',
  landing_page: 'Landingsside',
  lead_magnet: 'Lead magnet',
  signup: 'Påmelding',
  demo_booking: 'Demo-booking',
  email_nurture: 'E-postserie',
  retargeting: 'Retargeting',
  checkout: 'Kasse',
  upsell: 'Mer-salg',
  community: 'Community',
  referral: 'Anbefaling',
};

export const FUNNEL_STAGE_EXPLAIN: Record<FunnelStageKey, string> = {
  awareness: 'Når folk hører om merket for første gang — annonser, søk, sosiale medier.',
  landing_page: 'Selve siden besøkende lander på. Bestemmer om de blir eller forsvinner.',
  lead_magnet: 'Gratis guide, sjekkliste eller quiz som brukes for å samle kontakt-info.',
  signup: 'Når besøkende oppretter konto eller sender inn skjema.',
  demo_booking: 'Når noen booker en demo eller møte med selger.',
  email_nurture: 'Automatisk e-postserie som varmer opp leads til de er klare til å kjøpe.',
  retargeting: 'Annonser vist på nytt til personer som allerede har besøkt nettstedet.',
  checkout: 'Betalingsflyten — der penger faktisk skifter eier.',
  upsell: 'Tilbud om noe ekstra/dyrere etter første kjøp.',
  community: 'Privat gruppe (Discord/Slack/forum) der kunder snakker sammen og blir værende.',
  referral: 'Når eksisterende kunder anbefaler nye — ofte med belønning.',
};

// Marketing techniques (26 stk fra spec'et)
export type TechniqueKey =
  | 'testimonials' | 'logo_wall' | 'reviews' | 'case_studies'
  | 'limited_time_offer' | 'scarcity' | 'urgency' | 'sticky_cta'
  | 'exit_intent_popup' | 'newsletter_capture' | 'quiz_funnel'
  | 'calculator_funnel' | 'free_audit' | 'free_trial' | 'demo_booking'
  | 'checklist_download' | 'webinar_signup' | 'comparison_page'
  | 'alternative_to_page' | 'pricing_anchor' | 'guarantee' | 'faq'
  | 'social_proof' | 'local_seo_pages' | 'founder_content'
  | 'customer_stories' | 'tutorials';

export interface TechniqueSpec {
  key: TechniqueKey;
  label: string;
  simpleExplanation: string;
  whyItMatters: string;
}

export const TECHNIQUE_CATALOG: TechniqueSpec[] = [
  {
    key: 'testimonials',
    label: 'Testimonials',
    simpleExplanation: 'Korte sitater fra fornøyde kunder vist på nettstedet.',
    whyItMatters: 'Bygger tillit fra dag én — fremmede gjenkjenner seg selv i andres ord.',
  },
  {
    key: 'logo_wall',
    label: 'Logo-vegg',
    simpleExplanation: 'En rad med kjente kunde-logoer som viser "disse stoler på oss".',
    whyItMatters: 'Visuell autoritet på 2 sekunder — kvalifiserer raskere enn tekst.',
  },
  {
    key: 'reviews',
    label: 'Anmeldelser m/ stjerner',
    simpleExplanation: 'Stjerne-rating + tall (f.eks. "4.7★ av 312 anmeldelser").',
    whyItMatters: 'Sosial bevis fra mange = mer overbevisende enn ett enkelt sitat.',
  },
  {
    key: 'case_studies',
    label: 'Case-studier',
    simpleExplanation: 'Lengre historier om hvordan en spesifikk kunde lyktes.',
    whyItMatters: 'Beviser at produktet faktisk fungerer — ikke bare påstander.',
  },
  {
    key: 'limited_time_offer',
    label: 'Tids-begrenset tilbud',
    simpleExplanation: 'Rabatt eller bonus som forsvinner etter en bestemt dato.',
    whyItMatters: 'Skaper handlings-trang — uten frist utsetter de fleste.',
  },
  {
    key: 'scarcity',
    label: 'Knapphet',
    simpleExplanation: '"Bare 3 plasser igjen" — viser at tilbudet er begrenset.',
    whyItMatters: 'FOMO-effekt: vi vil ikke gå glipp av noe andre får.',
  },
  {
    key: 'urgency',
    label: 'Hastverk',
    simpleExplanation: 'Nedtellings-klokke eller "siste sjanse"-melding.',
    whyItMatters: 'Beslutninger som ikke blir tatt nå, blir aldri tatt.',
  },
  {
    key: 'sticky_cta',
    label: 'Sticky CTA',
    simpleExplanation: 'Knapp som "henger" øverst eller nederst når du scroller.',
    whyItMatters: 'Knappen er alltid synlig — fjerner steget "finn knappen".',
  },
  {
    key: 'exit_intent_popup',
    label: 'Exit-intent popup',
    simpleExplanation: 'Popup som dukker opp når musen beveger seg mot å lukke fanen.',
    whyItMatters: 'Siste sjanse til å fange noen som var i ferd med å forsvinne.',
  },
  {
    key: 'newsletter_capture',
    label: 'Nyhetsbrev-skjema',
    simpleExplanation: 'Skjema som ber om e-post for nyhetsbrev eller oppdateringer.',
    whyItMatters: 'Eier kontakten direkte — uavhengig av algoritmer.',
  },
  {
    key: 'quiz_funnel',
    label: 'Quiz-trakt',
    simpleExplanation: 'En quiz som anbefaler riktig produkt basert på svarene.',
    whyItMatters: 'Engasjerer + personaliserer = mye høyere konvertering.',
  },
  {
    key: 'calculator_funnel',
    label: 'Kalkulator-trakt',
    simpleExplanation: 'Verktøy som regner ut spare-/kostnad/ROI basert på input.',
    whyItMatters: 'Selger seg selv via tall — besøkende ser verdien i kroner.',
  },
  {
    key: 'free_audit',
    label: 'Gratis audit',
    simpleExplanation: '"Gratis sjekk av nettstedet/SEO/regnskap" som lead magnet.',
    whyItMatters: 'Demonstrerer ekspertise + samler kvalifiserte leads.',
  },
  {
    key: 'free_trial',
    label: 'Gratis prøveperiode',
    simpleExplanation: 'X dager gratis tilgang før betalingen begynner.',
    whyItMatters: 'Lar produktet selge seg selv — fjerner risikoen for kunden.',
  },
  {
    key: 'demo_booking',
    label: 'Demo-booking',
    simpleExplanation: 'Direktelink til kalender der besøkende booker demo.',
    whyItMatters: 'Frikobler salgsteamet fra "ring tilbake"-loopen.',
  },
  {
    key: 'checklist_download',
    label: 'Sjekkliste-nedlasting',
    simpleExplanation: 'Gratis PDF/sjekkliste som besøkende får mot e-post.',
    whyItMatters: 'Lav-friksjon lead magnet — krever lite men gir nytte.',
  },
  {
    key: 'webinar_signup',
    label: 'Webinar-påmelding',
    simpleExplanation: 'Påmelding til live eller forhåndsinnspilt webinar.',
    whyItMatters: 'Lengre engasjement = sterkere kvalifisering enn en PDF.',
  },
  {
    key: 'comparison_page',
    label: 'Sammenligningsside',
    simpleExplanation: 'Side som sammenligner produktet med konkurrenter.',
    whyItMatters: 'Fanger søk som "X vs Y" — høyt kjøpsintent-trafikk.',
  },
  {
    key: 'alternative_to_page',
    label: '"Alternativ til X"-side',
    simpleExplanation: 'Side optimalisert for søk som "alternativ til Mailchimp".',
    whyItMatters: 'Misnøyde kunder hos konkurrenter er gull verdt.',
  },
  {
    key: 'pricing_anchor',
    label: 'Pris-anker',
    simpleExplanation: 'En dyr "Enterprise"-plan som gjør de andre planene virke rimelige.',
    whyItMatters: 'Påvirker hva besøkende mener er en "fair" pris.',
  },
  {
    key: 'guarantee',
    label: 'Garanti',
    simpleExplanation: '"Pengene tilbake innen 30 dager" — fjerner kjøps-risiko.',
    whyItMatters: 'Senker terskelen til å si ja drastisk.',
  },
  {
    key: 'faq',
    label: 'FAQ-seksjon',
    simpleExplanation: 'Vanlige spørsmål + svar — håndterer innvendinger direkte.',
    whyItMatters: 'Selger uten å trenge selger — på besøkendes premisser.',
  },
  {
    key: 'social_proof',
    label: 'Sosial bevis',
    simpleExplanation: '"X kunder", "Y omtaler i media", "Z aktive brukere".',
    whyItMatters: 'Tall fjerner usikkerhet — flokk-mentalitet er kraftig.',
  },
  {
    key: 'local_seo_pages',
    label: 'Lokal SEO-sider',
    simpleExplanation: 'Egne sider per by/region ("Fotograf Oslo", "Fotograf Bergen").',
    whyItMatters: 'Lokale søk konverterer 4–5× høyere enn generiske.',
  },
  {
    key: 'founder_content',
    label: 'Gründer-innhold',
    simpleExplanation: 'Innhold/video fra grunderen som ansikt utad.',
    whyItMatters: 'Mennesker bygger tillit til mennesker, ikke til logoer.',
  },
  {
    key: 'customer_stories',
    label: 'Kunde-historier',
    simpleExplanation: 'Lengre fortellinger om kunders reise — ofte med video.',
    whyItMatters: 'Levende bevis at produktet løser ekte problemer.',
  },
  {
    key: 'tutorials',
    label: 'Tutorials',
    simpleExplanation: 'Step-by-step-guider som lærer besøkende noe nyttig.',
    whyItMatters: 'Bygger autoritet + tiltrekker organisk trafikk via søk.',
  },
];

// Tech-stack-kategorier (Wappalyzer-light)
export type TechStackCategory =
  | 'cms' | 'frontend' | 'analytics' | 'tag_manager' | 'crm' | 'email'
  | 'ad_pixels' | 'chat_widget' | 'booking' | 'payment' | 'form_builder'
  | 'automation' | 'cdn' | 'hosting' | 'seo_tools' | 'ab_testing' | 'heatmap';

export const TECH_STACK_CATEGORY_LABELS: Record<TechStackCategory, string> = {
  cms: 'CMS / Sideverktøy',
  frontend: 'Frontend-rammeverk',
  analytics: 'Analyse',
  tag_manager: 'Tag manager',
  crm: 'CRM',
  email: 'E-postplattform',
  ad_pixels: 'Annonse-piksler',
  chat_widget: 'Chat-widget',
  booking: 'Booking-verktøy',
  payment: 'Betalingsverktøy',
  form_builder: 'Skjema-bygger',
  automation: 'Automatisering',
  cdn: 'CDN',
  hosting: 'Hosting',
  seo_tools: 'SEO-verktøy',
  ab_testing: 'A/B-testing',
  heatmap: 'Heatmap-verktøy',
};

// ─────────────────────────────────────────────────────────────────────
// Domain objects (matches spec)
// ─────────────────────────────────────────────────────────────────────

export interface MarketScan {
  id: string;
  workspaceOwnerUserId: string;
  projectId?: string;
  brandKitId?: string | null;
  name: string;
  marketQuery: string;
  region?: string | null;
  industry?: string | null;
  targetAudience?: string | null;
  goal?: string | null;
  status: 'draft' | 'running' | 'completed' | 'failed';
  confidenceSummary: ConfidenceLevel;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  totalCompetitors: number;
  totalOpportunities: number;
  createdAt: string;
  updatedAt: string;
}

export interface Competitor {
  id: string;
  marketScanId: string;
  name: string;
  domain: string;
  category?: string | null;
  positioning?: string | null;
  primaryOffer?: string | null;
  primaryCTA?: string | null;
  pricingSignal?: string | null;
  socialProofSignal?: string | null;
  confidence: ConfidenceLevel;
  sourceUrls: string[];
  lastScannedAt: string;
}

export interface FunnelStage {
  id: string;
  marketScanId: string;
  competitorId?: string | null;
  stage: FunnelStageKey;
  detected: boolean;
  explanation: string;
  evidence?: string | null;
  confidence: ConfidenceLevel;
  recommendedAction?: string | null;
}

export interface MarketingTechnique {
  id: string;
  marketScanId: string;
  competitorId?: string | null;
  technique: TechniqueKey;
  label: string;
  simpleExplanation: string;
  detected: boolean;
  confidence: ConfidenceLevel;
  evidence?: string | null;
  whyItMatters?: string | null;
  recommendedNextStep?: string | null;
}

export interface TechStackSignal {
  id: string;
  marketScanId: string;
  competitorId: string;
  category: TechStackCategory;
  toolName: string;
  confidence: ConfidenceLevel;
  evidence?: string | null;
}

export interface ContentSignalBatch {
  id: string;
  marketScanId: string;
  competitorId?: string | null;
  signals: Record<string, { value: string; confidence: ConfidenceLevel; evidence?: string }>;
  summary?: string | null;
  confidence: ConfidenceLevel;
}

export interface OpportunityRecommendation {
  id: string;
  marketScanId: string;
  title: string;
  simpleSummary: string;
  whyItMatters: string;
  evidenceSummary: string;
  recommendedAction: string;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
  confidence: ConfidenceLevel;
  canCreateCampaign: boolean;
  canCreateContentPack: boolean;
  canCreateFunnelMap: boolean;
  sourceCompetitorIds: string[];
  sourceTechniqueIds: string[];
}
