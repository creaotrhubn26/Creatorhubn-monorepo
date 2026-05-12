/**
 * StoryLogic constants — pure data, no React/MUI imports.
 *
 * Ekstraktert fra StoryLogicPanel.tsx for å redusere panel-størrelsen
 * og gjøre konstantene gjenbrukbare av fase-komponenter (ConceptPhase,
 * LoglinePhase, ThemePhase) når split-arbeidet kommer dit.
 *
 * IKKE inkludert her (forblir i StoryLogicPanel.tsx):
 *   - START_MODES         — refererer til MUI-ikoner
 *   - STORY_TEMPLATES     — lokal-duplikert StoryTemplate-type
 *   - LEGACY_TROLL_TEXT_* — avhenger av normalizeLegacyLookup-funksjon
 *   - TROLL/DEFAULT/CONTENT_PRODUCER demo-states — egen demoStates.ts-splitt
 */

import type { StoryPhaseKey } from './types';

// ----------------------------------------------------------------------------
// Mentor-tone status labels (#3 energy-aware) — ingen "Error" eller "Incomplete"
// ----------------------------------------------------------------------------

export const STATUS_LABELS: Record<string, string> = {
  incomplete: 'Ikke tydelig ennå',
  weak: 'La oss spisse dette',
  ready: 'Klar',
};

// ----------------------------------------------------------------------------
// Score → confidence/farge — energy-aware, ingen rødt for lav score (#3, #4)
// ----------------------------------------------------------------------------

/**
 * Mapper score (0-100) til "Story Engine Confidence"-label + hex-farge.
 * Brukes som en mentor-tone-ekvivalent til prosentvisning.
 */
export function getConfidenceTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Høy', color: '#10b981' };
  if (score >= 60) return { label: 'På vei opp', color: '#60a5fa' };
  if (score >= 40) return { label: 'Middels', color: '#f59e0b' };
  if (score >= 20) return { label: 'Tidlig fase', color: '#fb923c' };
  return { label: 'Nettopp startet', color: '#9ca3af' };
}

/**
 * Energy-aware fargemapping for progress-bars og indikatorer.
 * Returnerer nøytral grå (ikke rød) ved lav score for å holde tonen
 * konstruktiv.
 */
export function getEnergyColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#9ca3af';
}

// ----------------------------------------------------------------------------
// Genre / sub-genre / tone / audience age — canonical keys (english)
// ----------------------------------------------------------------------------

export const GENRES = [
  'Drama', 'Comedy', 'Action', 'Thriller', 'Horror', 'Sci-Fi',
  'Fantasy', 'Romance', 'Mystery', 'Crime', 'Documentary',
  'Animation', 'Musical', 'Western', 'War', 'Biography',
];

export const SUB_GENRES: Record<string, string[]> = {
  Drama: ['Family Drama', 'Legal Drama', 'Medical Drama', 'Political Drama', 'Sports Drama'],
  Comedy: ['Romantic Comedy', 'Dark Comedy', 'Satire', 'Slapstick', 'Parody'],
  Action: ['Martial Arts', 'Spy Action', 'Heist', 'Disaster', 'Superhero'],
  Thriller: ['Psychological', 'Political', 'Legal', 'Techno', 'Conspiracy'],
  Horror: ['Supernatural', 'Slasher', 'Psychological', 'Body Horror', 'Found Footage'],
  'Sci-Fi': ['Space Opera', 'Cyberpunk', 'Post-Apocalyptic', 'Time Travel', 'Alien Invasion'],
  Fantasy: ['Epic Fantasy', 'Urban Fantasy', 'Dark Fantasy', 'Fairy Tale', 'Mythological'],
  Romance: ['Period Romance', 'Contemporary', 'Paranormal Romance', 'Tragic Romance'],
  Mystery: ['Whodunit', 'Noir', 'Cozy Mystery', 'Procedural'],
  Crime: ['Gangster', 'Heist', 'True Crime', 'Neo-Noir'],
};

// Grouped tones for semantic selection (#7)
export const TONE_GROUPS: { label: string; tones: string[] }[] = [
  { label: 'Stemning', tones: ['Dark', 'Light', 'Melancholic', 'Hopeful', 'Nostalgic'] },
  { label: 'Energi', tones: ['Intense', 'Suspenseful', 'Gritty', 'Whimsical', 'Surreal'] },
  { label: 'Stil', tones: ['Serious', 'Comedic', 'Satirical', 'Romantic', 'Cynical', 'Inspirational'] },
];

export const AUDIENCE_AGES = [
  'Children (Under 12)', 'Teen (13-17)', 'Young Adult (18-25)',
  'Adult (26-45)', 'Mature Adult (46-65)', 'Senior (65+)', 'All Ages',
];

// Grouped emotions by story act (#7)
export const EMOTION_GROUPS: { label: string; emotions: string[] }[] = [
  { label: 'Akt 1 — Oppsett', emotions: ['Hope', 'Fear', 'Anticipation', 'Trust'] },
  { label: 'Akt 2 — Konflikt', emotions: ['Anger', 'Sadness', 'Surprise', 'Shame', 'Guilt', 'Disgust'] },
  { label: 'Akt 3 — Løsning', emotions: ['Joy', 'Love', 'Pride', 'Relief', 'Triumph', 'Despair'] },
];

// ----------------------------------------------------------------------------
// Norwegian Bokmål labels (key → nb-NO label)
// ----------------------------------------------------------------------------

export const GENRE_LABELS_NB: Record<string, string> = {
  Drama: 'Drama',
  Comedy: 'Komedie',
  Action: 'Action',
  Thriller: 'Thriller',
  Horror: 'Horror',
  'Sci-Fi': 'Sci-fi',
  Fantasy: 'Fantasy',
  Romance: 'Romantikk',
  Mystery: 'Mysterium',
  Crime: 'Krim',
  Documentary: 'Dokumentar',
  Animation: 'Animasjon',
  Musical: 'Musikal',
  Western: 'Western',
  War: 'Krig',
  Biography: 'Biografi',
};

export const SUB_GENRE_LABELS_NB: Record<string, string> = {
  'Family Drama': 'Familiedrama',
  'Legal Drama': 'Rettsdrama',
  'Medical Drama': 'Medisinsk drama',
  'Political Drama': 'Politisk drama',
  'Sports Drama': 'Sportsdrama',
  'Romantic Comedy': 'Romantisk komedie',
  'Dark Comedy': 'Svart komedie',
  Satire: 'Satire',
  Slapstick: 'Slapstick',
  Parody: 'Parodi',
  'Martial Arts': 'Kampsport',
  'Spy Action': 'Spionaction',
  Heist: 'Kupp',
  Disaster: 'Katastrofe',
  Superhero: 'Superhelt',
  Psychological: 'Psykologisk',
  Political: 'Politisk',
  Legal: 'Juridisk',
  Techno: 'Tekno',
  Conspiracy: 'Konspirasjon',
  Supernatural: 'Overnaturlig',
  Slasher: 'Slasher',
  'Body Horror': 'Body horror',
  'Found Footage': 'Found footage',
  'Space Opera': 'Space opera',
  Cyberpunk: 'Cyberpunk',
  'Post-Apocalyptic': 'Postapokalyptisk',
  'Time Travel': 'Tidsreise',
  'Alien Invasion': 'Alieninvasjon',
  'Epic Fantasy': 'Episk fantasy',
  'Urban Fantasy': 'Urban fantasy',
  'Dark Fantasy': 'Mørk fantasy',
  'Fairy Tale': 'Eventyr',
  Mythological: 'Mytologisk',
  'Period Romance': 'Historisk romantikk',
  Contemporary: 'Samtidsromantikk',
  'Paranormal Romance': 'Paranormal romantikk',
  'Tragic Romance': 'Tragisk romantikk',
  Whodunit: 'Hvem gjorde det',
  Noir: 'Noir',
  'Cozy Mystery': 'Koselig mysterium',
  Procedural: 'Prosedyre',
  Gangster: 'Gangster',
  'True Crime': 'True crime',
  'Neo-Noir': 'Neo-noir',
};

export const TONE_LABELS_NB: Record<string, string> = {
  Dark: 'Mørk',
  Light: 'Lett',
  Serious: 'Alvorlig',
  Comedic: 'Komedisk',
  Suspenseful: 'Spenningsfylt',
  Hopeful: 'Håpefull',
  Melancholic: 'Melankolsk',
  Satirical: 'Satirisk',
  Gritty: 'Rå',
  Whimsical: 'Eventyrlig',
  Intense: 'Intens',
  Romantic: 'Romantisk',
  Cynical: 'Kynisk',
  Inspirational: 'Inspirerende',
  Surreal: 'Surrealistisk',
  Nostalgic: 'Nostalgisk',
};

export const AUDIENCE_AGE_LABELS_NB: Record<string, string> = {
  'Children (Under 12)': 'Barn (under 12)',
  'Teen (13-17)': 'Ungdom (13-17)',
  'Young Adult (18-25)': 'Unge voksne (18-25)',
  'Adult (26-45)': 'Voksne (26-45)',
  'Mature Adult (46-65)': 'Modne voksne (46-65)',
  'Senior (65+)': 'Senior (65+)',
  'All Ages': 'Alle aldre',
};

export const EMOTION_LABELS_NB: Record<string, string> = {
  Hope: 'Håp',
  Fear: 'Frykt',
  Joy: 'Glede',
  Sadness: 'Sorg',
  Anger: 'Sinne',
  Surprise: 'Overraskelse',
  Disgust: 'Avsky',
  Trust: 'Tillit',
  Anticipation: 'Forventning',
  Love: 'Kjærlighet',
  Shame: 'Skam',
  Pride: 'Stolthet',
  Guilt: 'Skyld',
  Relief: 'Lettelse',
  Despair: 'Fortvilelse',
  Triumph: 'Triumf',
  Skepticism: 'Skepsis',
  Wonder: 'Undring',
  Determination: 'Besluttsomhet',
  Grief: 'Savn',
};

// ----------------------------------------------------------------------------
// Field-id → nb-NO display label (brukes i ValidationDisplay og av validators
// for nextBestAction-meldinger)
// ----------------------------------------------------------------------------

export const FIELD_LABELS_NB: Record<string, string> = {
  corePremise: 'Kjernepremiss',
  genre: 'Sjanger',
  subGenre: 'Undersjanger',
  tone: 'Tone',
  targetAudience: 'Målgruppe',
  audienceAge: 'Aldersgruppe',
  whyNow: 'Hvorfor nå',
  uniqueAngle: 'Unik vinkel',
  marketComparables: 'Markedssammenligninger',
  protagonist: 'Hovedperson',
  protagonistTrait: 'Definerende trekk',
  goal: 'Mål',
  antagonisticForce: 'Antagonistisk kraft',
  stakes: 'Konsekvenser',
  fullLogline: 'Komplett logline',
  centralTheme: 'Sentralt tema',
  themeStatement: 'Temapåstand',
  protagonistFlaw: 'Protagonistens kjernefeil',
  flawOrigin: 'Opprinnelse til feil',
  whatMustChange: 'Hva må endres',
  transformationArc: 'Transformasjonsbue',
  emotionalJourney: 'Emosjonell reise',
  moralArgument: 'Moralsk argument',
};

/**
 * Looker upp et felt-id → norsk visningsnavn. Returnerer feltet selv ved miss
 * (fallback til id-string).
 */
export function getFieldLabelNb(fieldId: string): string {
  return FIELD_LABELS_NB[fieldId] || fieldId;
}

/**
 * Generisk lookup-helper: returner labels[value] eller value som fallback.
 * Brukes i hele StoryLogicPanel for å konvertere kanonisk engelsk verdi
 * (genre/tone/emotion/audience-age) til norsk visningstekst.
 */
export function nbLabel(value: string, labels: Record<string, string>): string {
  return labels[value] || value;
}

// ----------------------------------------------------------------------------
// Legacy migration maps — for konverter eldre lagrede states ved load
// ----------------------------------------------------------------------------

export const LEGACY_SUBGENRE_MAP: Record<string, string> = {
  'Monster/Creature Feature': 'Mythological',
};

export const LEGACY_AUDIENCE_AGE_MAP: Record<string, string> = {
  '12+': 'Teen (13-17)',
};

// ----------------------------------------------------------------------------
// Reality Check Prompts (#6) — vises etter hver fase som "human check"
// ----------------------------------------------------------------------------

export const REALITY_CHECK_PROMPTS: Record<StoryPhaseKey, string[]> = {
  concept: [
    'Hvis en venn spør "Hva handler filmen om?" — kan du svare i én setning?',
    'Kan du forklare premisset uten å avsløre vendinger eller slutt?',
    'Vil noen forstå kjerneideen på under 10 sekunder?',
  ],
  logline: [
    'Hvis noen spør "Hvorfor skal jeg bry meg?" — hva svarer du i én setning?',
    'Er protagonist, mål, motkraft og stakes tydelig i én linje?',
    'Kunne en produsent pitchet loglinen etter å ha hørt den én gang?',
  ],
  theme: [
    'Når publikum går ut av kinosalen — hvilken følelse tar de med seg hjem?',
    'Beviser karakterbuen temaet ditt, eller bare sier den det?',
    'Hvis noen er uenig i temapåstanden, står historien fortsatt støtt?',
  ],
};

// ----------------------------------------------------------------------------
// Phase metadata — fasenes navngivning og rekkefølge
// ----------------------------------------------------------------------------

export const PHASE_META: Array<{ key: StoryPhaseKey; index: number; title: string }> = [
  { key: 'concept', index: 0, title: 'Konsept' },
  { key: 'logline', index: 1, title: 'Logline' },
  { key: 'theme', index: 2, title: 'Tema og karakterintensjon' },
];

// ----------------------------------------------------------------------------
// Field examples library — genre-spesifikke eksempler per felt (#4)
// ----------------------------------------------------------------------------

export const FIELD_EXAMPLES: Record<string, Record<string, string[]>> = {
  uniqueAngle: {
    Drama: [
      'Fortalt kun gjennom opptak fra overvåkningskamera',
      'Antagonisten er fortelleren — og upålitelig',
      'Satt til ett rom i løpet av én natt',
    ],
    Thriller: [
      'Etterforskeren ER morderen — avslørt gjennom to tidslinjer',
      'Hele historien skjer i sanntid under en to timers flytur',
      'Offer og fangevokter bytter perspektiv i hvert kapittel',
    ],
    Comedy: [
      'En mockumentary om verdens verste bryllupsplanlegger',
      'Fortalt baklengs — vi ser kaoset før oppbygningen',
      'Alle karakterene tror de er hovedpersonen',
    ],
    Fantasy: [
      'Magi har en økonomisk kostnad — trylleformularer skaper inflasjon',
      '"Den utvalgte" er en svindler, mens sidekarakteren er den ekte helten',
      'Drager er bevisste diplomater, ikke monstre',
    ],
    _default: [
      'Bryt forventningene ved å endre HVEM som forteller historien',
      'Bruk en ukonvensjonell struktur (ikke-lineær, brevform)',
      'Kombiner sjangre som sjelden blandes (f.eks. horror + romantikk)',
    ],
  },
  whyNow: {
    Drama: [
      'Isolasjon etter pandemien redefinerer familiebånd',
      'AI-drevet jobbfortrengning speiler frykten fra den industrielle revolusjon',
    ],
    Thriller: [
      'Deepfakes gjør identitetstyveri til en universell frykt',
      'Overvåkningskapitalisme gir "å bli overvåket" ny betydning',
    ],
    _default: [
      'Knytt historien til en sosial bevegelse eller aktuell bekymring',
      'Vis til et teknologisk skifte som påvirker hverdagen',
      'Koble til en generasjonserfaring (Gen Z-utbrenthet, boomer-arv)',
    ],
  },
  themeStatement: {
    Drama: [
      'Denne historien argumenterer for at tilgivelse ikke er for overgriperen, men frigjøring for den sårede.',
      'Ekte styrke er ikke utholdenhet alene, men å vite når man må be om hjelp.',
    ],
    Thriller: [
      'Denne historien argumenterer for at besettelse av rettferdighet kan bli uatskillelig fra selve forbrytelsen.',
      'De tryggeste løgnene er dem vi forteller oss selv.',
    ],
    _default: [
      'Denne historien argumenterer for at [TRO] fører til [KONSEKVENS], og at ekte [VERDI] krever [OFFER].',
      'Formuler som: "Filmen argumenterer for at …" for å gjøre påstanden aktiv og diskuterbar.',
    ],
  },
};

// ----------------------------------------------------------------------------
// Genre-spesifikke presets — tone og emosjonell reise (C)
// ----------------------------------------------------------------------------

export const GENRE_TONE_PRESETS: Record<string, string[][]> = {
  Drama: [['Serious', 'Melancholic'], ['Hopeful', 'Intense']],
  Comedy: [['Light', 'Comedic'], ['Satirical', 'Whimsical']],
  Action: [['Intense', 'Gritty'], ['Dark', 'Suspenseful']],
  Thriller: [['Suspenseful', 'Gritty'], ['Dark', 'Intense']],
  Horror: [['Dark', 'Intense'], ['Suspenseful', 'Gritty']],
  'Sci-Fi': [['Surreal', 'Intense'], ['Dark', 'Suspenseful']],
  Fantasy: [['Whimsical', 'Hopeful'], ['Dark', 'Intense']],
  Romance: [['Romantic', 'Hopeful'], ['Light', 'Nostalgic']],
  Mystery: [['Suspenseful', 'Dark'], ['Cynical', 'Gritty']],
  Crime: [['Gritty', 'Dark'], ['Cynical', 'Intense']],
  Documentary: [['Serious', 'Inspirational'], ['Cynical', 'Hopeful']],
  Animation: [['Whimsical', 'Light'], ['Hopeful', 'Comedic']],
  Musical: [['Romantic', 'Light'], ['Inspirational', 'Nostalgic']],
  Western: [['Gritty', 'Melancholic'], ['Dark', 'Intense']],
  War: [['Gritty', 'Intense'], ['Melancholic', 'Hopeful']],
  Biography: [['Inspirational', 'Serious'], ['Hopeful', 'Melancholic']],
};

export const GENRE_EMOTION_PRESETS: Record<string, string[]> = {
  Drama: ['Hope', 'Sadness', 'Anger', 'Relief', 'Triumph'],
  Comedy: ['Joy', 'Surprise', 'Anticipation', 'Relief'],
  Action: ['Anticipation', 'Fear', 'Anger', 'Triumph'],
  Thriller: ['Fear', 'Anticipation', 'Surprise', 'Relief'],
  Horror: ['Fear', 'Disgust', 'Surprise', 'Despair'],
  'Sci-Fi': ['Anticipation', 'Surprise', 'Fear', 'Hope'],
  Fantasy: ['Hope', 'Anticipation', 'Joy', 'Triumph'],
  Romance: ['Love', 'Hope', 'Sadness', 'Joy'],
  Mystery: ['Anticipation', 'Surprise', 'Fear', 'Relief'],
  Crime: ['Anger', 'Fear', 'Guilt', 'Despair'],
  Documentary: ['Surprise', 'Anger', 'Hope', 'Pride'],
  Animation: ['Joy', 'Surprise', 'Hope', 'Triumph'],
  Musical: ['Joy', 'Love', 'Hope', 'Triumph'],
  Western: ['Anticipation', 'Anger', 'Despair', 'Triumph'],
  War: ['Fear', 'Anger', 'Despair', 'Hope'],
  Biography: ['Hope', 'Pride', 'Sadness', 'Triumph'],
};
