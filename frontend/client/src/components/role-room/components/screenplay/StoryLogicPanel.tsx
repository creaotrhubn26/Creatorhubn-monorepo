/**
 * StoryLogicPanel.tsx
 * 
 * Story Logic System - A structured approach to validate and develop story foundations
 * before writing begins.
 * 
 * Three phases:
 * 1. Concept - Validate the idea before any writing
 * 2. Logline - Define story DNA
 * 3. Theme & Character Intent - Give the story meaning
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
  Badge,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  Tooltip,
  IconButton,
  Divider,
  Card,
  CardContent,
  Fade,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lightbulb as LightbulbIcon,
  Create as CreateIcon,
  Psychology as PsychologyIcon,
  Check as CheckIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AutoAwesomeIcon,
  TipsAndUpdates as TipsIcon,
  Star as StarIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  School as SchoolIcon,
  ArrowForward as ArrowForwardIcon,
  GpsFixed as GpsFixedIcon,
  ReportProblem as ContradictionIcon,
  TheaterComedy as TheaterComedyIcon,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import jsPDF from 'jspdf';
import { useBrandingSettings } from '../../hooks/useBrandingSettings';
import { storyLogicService, type StoryLogicSyncMeta } from '../../services/storyLogicService';
import {
  CONTENT_PRODUCER_DEMO_PROJECT_ID,
  TROLL_DEMO_PROJECT_ID,
  PRODUCER_DEMO_CLIENT_COMPANY,
  containsLegacyProducerDemoMarker,
  isRoleRoomDemoSeedAllowed,
} from '../../constants/producerDemo';

// ============================================================================
// Energy-Aware UX Helpers
// ============================================================================

// Mentor-tone status labels — no "Error", no "Incomplete" (#3 energy-aware)
const STATUS_LABELS: Record<string, string> = {
  incomplete: 'Ikke tydelig ennå',
  weak: 'La oss spisse dette',
  ready: 'Klar',
};

// Confidence tier labels — "Story Engine Confidence" not percentages (#4)
function getConfidenceTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Høy', color: '#10b981' };
  if (score >= 60) return { label: 'På vei opp', color: '#60a5fa' };
  if (score >= 40) return { label: 'Middels', color: '#f59e0b' };
  if (score >= 20) return { label: 'Tidlig fase', color: '#fb923c' };
  return { label: 'Nettopp startet', color: '#9ca3af' };
}

// Energy-aware colors — no red when score is low, use neutral/warm tones (#3)
function getEnergyColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#9ca3af'; // neutral gray, NOT red
}

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  if (!hex) return fallback;
  const normalized = hex.trim().replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return fallback;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return fallback;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to convert blob to data URL'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read blob'));
    reader.readAsDataURL(blob);
  });
}

function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        reject(new Error('Invalid image dimensions'));
      }
    };
    img.onerror = () => reject(new Error('Unable to read image dimensions'));
    img.src = dataUrl;
  });
}

const phaseRoadmapGridSx = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: '1fr',
    md: 'repeat(3, minmax(0, 1fr))',
  },
};

const phaseFormGridSx = {
  display: 'grid',
  gap: 2,
  gridTemplateColumns: {
    xs: '1fr',
    md: 'repeat(2, minmax(0, 1fr))',
  },
};

const phaseFullSpanSx = {
  gridColumn: '1 / -1',
};

const starterCardsGridSx = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(3, minmax(0, 1fr))',
  },
};

const templateCardsGridSx = {
  display: 'grid',
  gap: 1,
  mt: 1,
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(3, minmax(0, 1fr))',
  },
};

type StoryPhaseKey = 'concept' | 'logline' | 'theme';

// Reality Check Prompts — human questions after each phase (#6)
const REALITY_CHECK_PROMPTS: Record<StoryPhaseKey, string[]> = {
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

function getStableRealityCheckPrompt(phase: StoryPhaseKey, seedSource: string): string {
  const prompts = REALITY_CHECK_PROMPTS[phase];
  if (!prompts.length) return '';

  const seed = Array.from(seedSource).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return prompts[seed % prompts.length];
}

// Project templates for quick-start (#9)
interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  data: Partial<StoryLogicState>;
}

const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'thriller',
    name: 'Thriller',
    description: 'Høye stakes og stigende tidspress',
    data: {
      concept: { corePremise: '', genre: 'Thriller', subGenre: 'Psychological', tone: ['Suspenseful', 'Dark'], targetAudience: '', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Fear', 'Anticipation', 'Surprise', 'Relief'], moralArgument: '' },
    },
  },
  {
    id: 'character-drama',
    name: 'Karakterdrevet drama',
    description: 'Indre transformasjon og emosjonell dybde',
    data: {
      concept: { corePremise: '', genre: 'Drama', subGenre: 'Family Drama', tone: ['Serious', 'Melancholic'], targetAudience: '', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Hope', 'Sadness', 'Anger', 'Relief', 'Triumph'], moralArgument: '' },
    },
  },
  {
    id: 'commercial-pitch',
    name: 'Kommersiell pitch',
    description: 'High-concept med tydelig markedsposisjon',
    data: {
      concept: { corePremise: '', genre: 'Action', subGenre: 'Superhero', tone: ['Intense', 'Hopeful'], targetAudience: '', audienceAge: 'Young Adult (18-25)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Anticipation', 'Fear', 'Anger', 'Triumph'], moralArgument: '' },
    },
  },
  {
    id: 'indie-arthouse',
    name: 'Indie arthouse',
    description: 'Atmosfærisk, tvetydig og visuelt drevet',
    data: {
      concept: { corePremise: '', genre: 'Drama', subGenre: '', tone: ['Surreal', 'Melancholic'], targetAudience: 'Cinefile og festivalpublikum', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Sadness', 'Anticipation', 'Surprise', 'Despair'], moralArgument: '' },
    },
  },
];

// Start-with modes for non-linear entry (#10)
type StartMode = 'idea' | 'character' | 'theme';
// Icon-konfig matchende memory.md-spec (emoji → MUI):
//   💡 → Lightbulb, 🎭 → TheaterComedy, 🧠 → Psychology
const START_MODES: { id: StartMode; label: string; Icon: SvgIconComponent; iconColor: string; description: string; initialPhase: number }[] = [
  { id: 'idea',      label: 'Start med idé',     Icon: LightbulbIcon,    iconColor: '#fbbf24', description: 'Jeg har et konsept eller premiss', initialPhase: 0 },
  { id: 'character', label: 'Start med karakter', Icon: TheaterComedyIcon, iconColor: '#f472b6', description: 'Jeg har en karakter i tankene',   initialPhase: 1 },
  { id: 'theme',     label: 'Start med tema',    Icon: PsychologyIcon,   iconColor: '#a78bfa', description: 'Jeg vet budskapet først',           initialPhase: 2 },
];

const PHASE_META: Array<{ key: StoryPhaseKey; index: number; title: string }> = [
  { key: 'concept', index: 0, title: 'Konsept' },
  { key: 'logline', index: 1, title: 'Logline' },
  { key: 'theme', index: 2, title: 'Tema og karakterintensjon' },
];

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ConceptData {
  corePremise: string;
  genre: string;
  subGenre: string;
  tone: string[];
  targetAudience: string;
  audienceAge: string;
  whyNow: string;
  uniqueAngle: string;
  marketComparables: string;
}

interface LoglineData {
  protagonist: string;
  protagonistTrait: string;
  goal: string;
  antagonisticForce: string;
  stakes: string;
  fullLogline: string;
  loglineScore: number;
}

interface ThemeData {
  centralTheme: string;
  themeStatement: string;
  protagonistFlaw: string;
  flawOrigin: string;
  whatMustChange: string;
  transformationArc: string;
  emotionalJourney: string[];
  moralArgument: string;
}

interface PhaseLocks {
  concept: boolean;
  logline: boolean;
  theme: boolean;
}

interface StoryVersion {
  id: string;
  label: string;
  timestamp: string;
  snapshot: string; // JSON-stringified state snapshot
}

interface StoryLogicState {
  concept: ConceptData;
  logline: LoglineData;
  theme: ThemeData;
  currentPhase: number;
  phaseStatus: {
    concept: 'incomplete' | 'weak' | 'ready';
    logline: 'incomplete' | 'weak' | 'ready';
    theme: 'incomplete' | 'weak' | 'ready';
  };
  lastSaved: string | null;
  locks: PhaseLocks;
  versions: StoryVersion[];
}

interface ValidationWarning {
  message: string;
  fieldId: string;
  impact: string;
  pointsLost: number;
}

interface CoachingTip {
  example: string;
  template: string;
  avoid: string;
}

interface ValidationResult {
  isValid: boolean;
  score: number;
  warnings: ValidationWarning[];
  suggestions: string[];
  affirmations: string[];
  coaching: CoachingTip[];
  contradictions: string[];
  nextBestAction: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const GENRES = [
  'Drama', 'Comedy', 'Action', 'Thriller', 'Horror', 'Sci-Fi', 
  'Fantasy', 'Romance', 'Mystery', 'Crime', 'Documentary', 
  'Animation', 'Musical', 'Western', 'War', 'Biography'
];

const SUB_GENRES: Record<string, string[]> = {
  'Drama': ['Family Drama', 'Legal Drama', 'Medical Drama', 'Political Drama', 'Sports Drama'],
  'Comedy': ['Romantic Comedy', 'Dark Comedy', 'Satire', 'Slapstick', 'Parody'],
  'Action': ['Martial Arts', 'Spy Action', 'Heist', 'Disaster', 'Superhero'],
  'Thriller': ['Psychological', 'Political', 'Legal', 'Techno', 'Conspiracy'],
  'Horror': ['Supernatural', 'Slasher', 'Psychological', 'Body Horror', 'Found Footage'],
  'Sci-Fi': ['Space Opera', 'Cyberpunk', 'Post-Apocalyptic', 'Time Travel', 'Alien Invasion'],
  'Fantasy': ['Epic Fantasy', 'Urban Fantasy', 'Dark Fantasy', 'Fairy Tale', 'Mythological'],
  'Romance': ['Period Romance', 'Contemporary', 'Paranormal Romance', 'Tragic Romance'],
  'Mystery': ['Whodunit', 'Noir', 'Cozy Mystery', 'Procedural'],
  'Crime': ['Gangster', 'Heist', 'True Crime', 'Neo-Noir'],
};

const _TONES = [
  'Dark', 'Light', 'Serious', 'Comedic', 'Suspenseful', 'Hopeful',
  'Melancholic', 'Satirical', 'Gritty', 'Whimsical', 'Intense',
  'Romantic', 'Cynical', 'Inspirational', 'Surreal', 'Nostalgic'
];

// Grouped tones for semantic selection (#7)
const TONE_GROUPS: { label: string; tones: string[] }[] = [
  { label: 'Stemning', tones: ['Dark', 'Light', 'Melancholic', 'Hopeful', 'Nostalgic'] },
  { label: 'Energi', tones: ['Intense', 'Suspenseful', 'Gritty', 'Whimsical', 'Surreal'] },
  { label: 'Stil', tones: ['Serious', 'Comedic', 'Satirical', 'Romantic', 'Cynical', 'Inspirational'] },
];

const AUDIENCE_AGES = [
  'Children (Under 12)', 'Teen (13-17)', 'Young Adult (18-25)',
  'Adult (26-45)', 'Mature Adult (46-65)', 'Senior (65+)', 'All Ages'
];

const GENRE_LABELS_NB: Record<string, string> = {
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

const SUB_GENRE_LABELS_NB: Record<string, string> = {
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

const TONE_LABELS_NB: Record<string, string> = {
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

const AUDIENCE_AGE_LABELS_NB: Record<string, string> = {
  'Children (Under 12)': 'Barn (under 12)',
  'Teen (13-17)': 'Ungdom (13-17)',
  'Young Adult (18-25)': 'Unge voksne (18-25)',
  'Adult (26-45)': 'Voksne (26-45)',
  'Mature Adult (46-65)': 'Modne voksne (46-65)',
  'Senior (65+)': 'Senior (65+)',
  'All Ages': 'Alle aldre',
};

const EMOTION_LABELS_NB: Record<string, string> = {
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

function nbLabel(value: string, labels: Record<string, string>): string {
  return labels[value] || value;
}

function normalizeLegacyLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’`]/g, '\'')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9æøå\-'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFieldLabelNb(fieldId: string): string {
  const map: Record<string, string> = {
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
  return map[fieldId] || fieldId;
}

const LEGACY_SUBGENRE_MAP: Record<string, string> = {
  'Monster/Creature Feature': 'Mythological',
};

const LEGACY_AUDIENCE_AGE_MAP: Record<string, string> = {
  '12+': 'Teen (13-17)',
};

const LEGACY_TROLL_TEXT_NB_MAP: Record<string, string> = {
  'An ancient troll awakens in modern Norway, forcing a paleontologist to bridge the gap between myth and reality before the military destroys the last remnant of Norse legend.':
    'Et urgammelt troll våkner i moderne Norge og tvinger en paleontolog til å bygge bro mellom myte og virkelighet før militæret utsletter den siste resten av norrøn legende.',
  'Families and fantasy enthusiasts who love Nordic mythology':
    'Familier og fantasy-entusiaster som elsker nordisk mytologi',
  'Rising interest in Scandinavian mythology (Vikings, God of War), climate anxiety awakening dormant threats, and the universal theme of humanity\'s relationship with nature and forgotten traditions.':
    'Økt interesse for skandinavisk mytologi (Vikings, God of War), klimaangst som vekker sovende trusler, og et universelt tema om menneskets forhold til naturen og glemte tradisjoner.',
  'Unlike typical monster movies where creatures are purely antagonistic, the troll is a sympathetic being seeking home - making the real conflict about preservation vs. destruction of cultural heritage.':
    'I motsetning til typiske monsterfilmer der skapningen bare er fienden, er trollet et sympatisk vesen som søker hjemmet sitt. Konflikten handler derfor om bevaring kontra ødeleggelse av kulturarv.',
  'Godzilla (2014) meets The Water Horse, with themes similar to Princess Mononoke. Norwegian kaiju with heart.':
    'Godzilla (2014) møter The Water Horse, med tematiske likheter til Princess Mononoke. Norsk kaiju med hjerte.',
  'brilliant but skeptical':
    'briljant, men skeptisk',
  'must protect and guide the ancient troll back to Dovre':
    'må beskytte og lede det urgamle trollet tilbake til Dovre',
  'a military determined to destroy it and her own disbelief in folklore':
    'et militær som er fast bestemt på å ødelegge det, samt hennes egen vantro til folketro',
  'lose the last living connection to Norway\'s mythological past forever':
    'miste den siste levende forbindelsen til Norges mytologiske fortid for alltid',
  'When a brilliant but skeptical paleontologist Nora Tidemann must protect and guide the ancient troll back to Dovre, she faces a military determined to destroy it and her own disbelief in folklore—or else lose the last living connection to Norway\'s mythological past forever.':
    'Når den briljante, men skeptiske paleontologen Nora Tidemann må beskytte og lede det urgamle trollet tilbake til Dovre, møter hun et militær som vil ødelegge det og sin egen vantro til folketro — ellers mister hun den siste levende forbindelsen til Norges mytologiske fortid for alltid.',
  'Reconnecting with cultural heritage and the power of belief':
    'Gjenforbindelse med kulturarv og troens kraft',
  'Only by embracing the wisdom of our ancestors can we find our way home.':
    'Først når vi omfavner visdommen fra våre forfedre, kan vi finne veien hjem.',
  'Rational skepticism that blinds her to wonder and her estranged relationship with her father who believed in folklore':
    'Rasjonell skepsis som gjør henne blind for undring, og et brutt forhold til faren som trodde på folketro',
  'Nora rejected her father\'s stories about trolls as a child, choosing science over tradition, leading to years of distance between them.':
    'Nora avviste farens historier om troll som barn og valgte vitenskap over tradisjon, noe som skapte år med avstand mellom dem.',
  'She must reconcile scientific rationalism with folkloric wisdom, and heal her relationship with her father before it\'s too late.':
    'Hun må forene vitenskapelig rasjonalitet med folkelig visdom, og reparere forholdet til faren før det er for sent.',
  'From dismissive skeptic who mocks tradition → to reluctant believer who witnesses the impossible → to active protector who bridges past and present':
    'Fra avvisende skeptiker som håner tradisjon → til nølende troende som er vitne til det umulige → til aktiv beskytter som bygger bro mellom fortid og nåtid',
  'The film argues that progress without respect for the past leads to destruction, while embracing our heritage gives us the wisdom to face the future.':
    'Filmen argumenterer for at fremskritt uten respekt for fortiden fører til ødeleggelse, mens omfavnelse av kulturarven gir oss visdommen til å møte fremtiden.',
  'Cinephiles and festival audiences':
    'Cinefile og festivalpublikum',
};

const LEGACY_TROLL_TEXT_NB_NORMALIZED_MAP: Record<string, string> = Object.entries(LEGACY_TROLL_TEXT_NB_MAP)
  .reduce<Record<string, string>>((acc, [english, norwegian]) => {
    acc[normalizeLegacyLookup(english)] = norwegian;
    return acc;
  }, {});

const LEGACY_TROLL_TEXT_NB_FALLBACK_FRAGMENTS: Array<{ fragment: string; translation: string }> = [
  {
    fragment: 'ancient troll awakens in modern norway',
    translation: LEGACY_TROLL_TEXT_NB_MAP['An ancient troll awakens in modern Norway, forcing a paleontologist to bridge the gap between myth and reality before the military destroys the last remnant of Norse legend.'],
  },
  {
    fragment: 'families and fantasy enthusiasts who love nordic mythology',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Families and fantasy enthusiasts who love Nordic mythology'],
  },
  {
    fragment: 'rising interest in scandinavian mythology',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Rising interest in Scandinavian mythology (Vikings, God of War), climate anxiety awakening dormant threats, and the universal theme of humanity\'s relationship with nature and forgotten traditions.'],
  },
  {
    fragment: 'unlike typical monster movies where creatures are purely antagonistic',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Unlike typical monster movies where creatures are purely antagonistic, the troll is a sympathetic being seeking home - making the real conflict about preservation vs. destruction of cultural heritage.'],
  },
  {
    fragment: 'godzilla (2014) meets the water horse',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Godzilla (2014) meets The Water Horse, with themes similar to Princess Mononoke. Norwegian kaiju with heart.'],
  },
  {
    fragment: 'brilliant but skeptical',
    translation: LEGACY_TROLL_TEXT_NB_MAP['brilliant but skeptical'],
  },
  {
    fragment: 'must protect and guide the ancient troll back to dovre',
    translation: LEGACY_TROLL_TEXT_NB_MAP['must protect and guide the ancient troll back to Dovre'],
  },
  {
    fragment: 'a military determined to destroy it and her own disbelief in folklore',
    translation: LEGACY_TROLL_TEXT_NB_MAP['a military determined to destroy it and her own disbelief in folklore'],
  },
  {
    fragment: 'lose the last living connection to norway',
    translation: LEGACY_TROLL_TEXT_NB_MAP['lose the last living connection to Norway\'s mythological past forever'],
  },
  {
    fragment: 'when a brilliant but skeptical paleontologist nora tidemann must protect and guide the ancient troll back to dovre',
    translation: LEGACY_TROLL_TEXT_NB_MAP['When a brilliant but skeptical paleontologist Nora Tidemann must protect and guide the ancient troll back to Dovre, she faces a military determined to destroy it and her own disbelief in folklore—or else lose the last living connection to Norway\'s mythological past forever.'],
  },
  {
    fragment: 'reconnecting with cultural heritage and the power of belief',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Reconnecting with cultural heritage and the power of belief'],
  },
  {
    fragment: 'only by embracing the wisdom of our ancestors can we find our way home',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Only by embracing the wisdom of our ancestors can we find our way home.'],
  },
  {
    fragment: 'rational skepticism that blinds her to wonder',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Rational skepticism that blinds her to wonder and her estranged relationship with her father who believed in folklore'],
  },
  {
    fragment: 'nora rejected her father\'s stories about trolls as a child',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Nora rejected her father\'s stories about trolls as a child, choosing science over tradition, leading to years of distance between them.'],
  },
  {
    fragment: 'she must reconcile scientific rationalism with folkloric wisdom',
    translation: LEGACY_TROLL_TEXT_NB_MAP['She must reconcile scientific rationalism with folkloric wisdom, and heal her relationship with her father before it\'s too late.'],
  },
  {
    fragment: 'from dismissive skeptic who mocks tradition',
    translation: LEGACY_TROLL_TEXT_NB_MAP['From dismissive skeptic who mocks tradition → to reluctant believer who witnesses the impossible → to active protector who bridges past and present'],
  },
  {
    fragment: 'the film argues that progress without respect for the past leads to destruction',
    translation: LEGACY_TROLL_TEXT_NB_MAP['The film argues that progress without respect for the past leads to destruction, while embracing our heritage gives us the wisdom to face the future.'],
  },
  {
    fragment: 'cinephiles and festival audiences',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Cinephiles and festival audiences'],
  },
];

function translateLegacyTextToNb(value: string): string {
  if (!value) return value;

  const trimmed = value.trim();
  const exact = LEGACY_TROLL_TEXT_NB_MAP[trimmed];
  if (exact) return exact;

  const normalized = normalizeLegacyLookup(trimmed);
  const normalizedHit = LEGACY_TROLL_TEXT_NB_NORMALIZED_MAP[normalized];
  if (normalizedHit) return normalizedHit;

  const lowered = normalized;
  for (const item of LEGACY_TROLL_TEXT_NB_FALLBACK_FRAGMENTS) {
    if (lowered.includes(item.fragment)) {
      return item.translation;
    }
  }

  return value;
}

function normalizeConceptSelections(concept: ConceptData): ConceptData {
  const normalizedGenre = GENRES.includes(concept.genre) ? concept.genre : '';
  const validSubGenres = normalizedGenre ? (SUB_GENRES[normalizedGenre] || []) : [];
  const mappedSubGenre = LEGACY_SUBGENRE_MAP[concept.subGenre] ?? concept.subGenre;
  const normalizedSubGenre = mappedSubGenre && validSubGenres.includes(mappedSubGenre) ? mappedSubGenre : '';
  const mappedAudienceAge = LEGACY_AUDIENCE_AGE_MAP[concept.audienceAge] ?? concept.audienceAge;
  const normalizedAudienceAge = AUDIENCE_AGES.includes(mappedAudienceAge) ? mappedAudienceAge : '';

  return {
    ...concept,
    genre: normalizedGenre,
    subGenre: normalizedSubGenre,
    audienceAge: normalizedAudienceAge,
  };
}

function normalizeStoryLogicState(input: StoryLogicState): StoryLogicState {
  const concept = normalizeConceptSelections(input.concept);

  return {
    ...input,
    concept: {
      ...concept,
      corePremise: translateLegacyTextToNb(concept.corePremise),
      targetAudience: translateLegacyTextToNb(concept.targetAudience),
      whyNow: translateLegacyTextToNb(concept.whyNow),
      uniqueAngle: translateLegacyTextToNb(concept.uniqueAngle),
      marketComparables: translateLegacyTextToNb(concept.marketComparables),
    },
    logline: {
      ...input.logline,
      protagonistTrait: translateLegacyTextToNb(input.logline.protagonistTrait),
      goal: translateLegacyTextToNb(input.logline.goal),
      antagonisticForce: translateLegacyTextToNb(input.logline.antagonisticForce),
      stakes: translateLegacyTextToNb(input.logline.stakes),
      fullLogline: translateLegacyTextToNb(input.logline.fullLogline),
    },
    theme: {
      ...input.theme,
      centralTheme: translateLegacyTextToNb(input.theme.centralTheme),
      themeStatement: translateLegacyTextToNb(input.theme.themeStatement),
      protagonistFlaw: translateLegacyTextToNb(input.theme.protagonistFlaw),
      flawOrigin: translateLegacyTextToNb(input.theme.flawOrigin),
      whatMustChange: translateLegacyTextToNb(input.theme.whatMustChange),
      transformationArc: translateLegacyTextToNb(input.theme.transformationArc),
      moralArgument: translateLegacyTextToNb(input.theme.moralArgument),
    },
  };
}

const _EMOTIONAL_JOURNEY_BEATS = [
  'Hope', 'Fear', 'Joy', 'Sadness', 'Anger', 'Surprise', 
  'Disgust', 'Trust', 'Anticipation', 'Love', 'Shame', 
  'Pride', 'Guilt', 'Relief', 'Despair', 'Triumph'
];

// Grouped emotions by story act (#7)
const EMOTION_GROUPS: { label: string; emotions: string[] }[] = [
  { label: 'Akt 1 — Oppsett', emotions: ['Hope', 'Fear', 'Anticipation', 'Trust'] },
  { label: 'Akt 2 — Konflikt', emotions: ['Anger', 'Sadness', 'Surprise', 'Shame', 'Guilt', 'Disgust'] },
  { label: 'Akt 3 — Løsning', emotions: ['Joy', 'Love', 'Pride', 'Relief', 'Triumph', 'Despair'] },
];

// Genre-specific examples library (#4)
const FIELD_EXAMPLES: Record<string, Record<string, string[]>> = {
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

// Contradiction rules (#8)
function detectContradictions(concept: ConceptData, theme: ThemeData): string[] {
  const contradictions: string[] = [];
  const audience = concept.targetAudience.toLowerCase() + ' ' + concept.audienceAge.toLowerCase();
  const isChildren = audience.includes('child') || audience.includes('under 12');
  const tones = concept.tone.map(t => t.toLowerCase());
  const genre = concept.genre.toLowerCase();

  if (isChildren && (genre === 'horror' || tones.includes('gritty') || tones.includes('dark'))) {
    contradictions.push('Målgruppen "Barn" kolliderer med mørk/rå tone eller horrorsjanger — vurder målgruppe eller tone på nytt.');
  }
  if (isChildren && tones.includes('cynical')) {
    contradictions.push('Kynisk tone er uvanlig for innhold rettet mot barn — bevisst brudd eller mismatch?');
  }
  if (concept.whyNow.length > 20 && concept.uniqueAngle.length > 10) {
    const whyGeneric = /relevant|important|timely/i.test(concept.whyNow) && !/because|specifically|unlike/i.test(concept.whyNow);
    const angleGeneric = /unique|different|special|new/i.test(concept.uniqueAngle) && concept.uniqueAngle.length < 40;
    if (whyGeneric && angleGeneric) {
      contradictions.push('"Hvorfor nå" og "Unik vinkel" er begge for generiske — gjør minst én av dem mer konkret.');
    }
  }
  if (theme.themeStatement.length > 20 && theme.moralArgument.length > 20) {
    const themeWords = new Set(theme.themeStatement.toLowerCase().split(/\s+/));
    const moralWords = new Set(theme.moralArgument.toLowerCase().split(/\s+/));
    const overlap = [...themeWords].filter(w => moralWords.has(w) && w.length > 4).length;
    if (overlap < 2) {
      contradictions.push('Temapåstand og moralsk argument virker frakoblet — de bør forsterke hverandre.');
    }
  }
  return contradictions;
}

// Genre-based tone preset combos (C)
const GENRE_TONE_PRESETS: Record<string, string[][]> = {
  'Drama': [['Serious', 'Melancholic'], ['Hopeful', 'Intense']],
  'Comedy': [['Light', 'Comedic'], ['Satirical', 'Whimsical']],
  'Action': [['Intense', 'Gritty'], ['Dark', 'Suspenseful']],
  'Thriller': [['Suspenseful', 'Gritty'], ['Dark', 'Intense']],
  'Horror': [['Dark', 'Intense'], ['Suspenseful', 'Gritty']],
  'Sci-Fi': [['Surreal', 'Intense'], ['Dark', 'Suspenseful']],
  'Fantasy': [['Whimsical', 'Hopeful'], ['Dark', 'Intense']],
  'Romance': [['Romantic', 'Hopeful'], ['Light', 'Nostalgic']],
  'Mystery': [['Suspenseful', 'Dark'], ['Cynical', 'Gritty']],
  'Crime': [['Gritty', 'Dark'], ['Cynical', 'Intense']],
  'Documentary': [['Serious', 'Inspirational'], ['Cynical', 'Hopeful']],
  'Animation': [['Whimsical', 'Light'], ['Hopeful', 'Comedic']],
  'Musical': [['Romantic', 'Light'], ['Inspirational', 'Nostalgic']],
  'Western': [['Gritty', 'Melancholic'], ['Dark', 'Intense']],
  'War': [['Gritty', 'Intense'], ['Melancholic', 'Hopeful']],
  'Biography': [['Inspirational', 'Serious'], ['Hopeful', 'Melancholic']],
};

// Genre-based emotional journey presets (C)
const GENRE_EMOTION_PRESETS: Record<string, string[]> = {
  'Drama': ['Hope', 'Sadness', 'Anger', 'Relief', 'Triumph'],
  'Comedy': ['Joy', 'Surprise', 'Anticipation', 'Relief'],
  'Action': ['Anticipation', 'Fear', 'Anger', 'Triumph'],
  'Thriller': ['Fear', 'Anticipation', 'Surprise', 'Relief'],
  'Horror': ['Fear', 'Disgust', 'Surprise', 'Despair'],
  'Sci-Fi': ['Anticipation', 'Surprise', 'Fear', 'Hope'],
  'Fantasy': ['Hope', 'Anticipation', 'Joy', 'Triumph'],
  'Romance': ['Love', 'Hope', 'Sadness', 'Joy'],
  'Mystery': ['Anticipation', 'Surprise', 'Fear', 'Relief'],
  'Crime': ['Anger', 'Fear', 'Guilt', 'Despair'],
  'Documentary': ['Surprise', 'Anger', 'Hope', 'Pride'],
  'Animation': ['Joy', 'Surprise', 'Hope', 'Triumph'],
  'Musical': ['Joy', 'Love', 'Hope', 'Triumph'],
  'Western': ['Anticipation', 'Anger', 'Despair', 'Triumph'],
  'War': ['Fear', 'Anger', 'Despair', 'Hope'],
  'Biography': ['Hope', 'Pride', 'Sadness', 'Triumph'],
};

// TROLL Demo Data for Story Logic
const TROLL_DEMO_STATE: StoryLogicState = {
  concept: {
    corePremise: 'Et urgammelt troll våkner i moderne Norge og tvinger en paleontolog til å bygge bro mellom myte og virkelighet før militæret utsletter den siste resten av norrøn legende.',
    genre: 'Fantasy',
    subGenre: 'Mythological',
    tone: ['Intense', 'Suspenseful', 'Nostalgic'],
    targetAudience: 'Familier og fantasy-entusiaster som elsker nordisk mytologi',
    audienceAge: 'Teen (13-17)',
    whyNow: 'Økt interesse for skandinavisk mytologi (Vikings, God of War), klimaangst som vekker sovende trusler, og et universelt tema om menneskets forhold til naturen og glemte tradisjoner.',
    uniqueAngle: 'I motsetning til typiske monsterfilmer der skapningen bare er fienden, er trollet et sympatisk vesen som søker hjemmet sitt. Konflikten handler derfor om bevaring kontra ødeleggelse av kulturarv.',
    marketComparables: 'Godzilla (2014) møter The Water Horse, med tematiske likheter til Princess Mononoke. Norsk kaiju med hjerte.',
  },
  logline: {
    protagonist: 'Nora Tidemann',
    protagonistTrait: 'briljant, men skeptisk',
    goal: 'må beskytte og lede det urgamle trollet tilbake til Dovre',
    antagonisticForce: 'et militær som er fast bestemt på å ødelegge det, samt hennes egen vantro til folketro',
    stakes: 'miste den siste levende forbindelsen til Norges mytologiske fortid for alltid',
    fullLogline: 'Når den briljante, men skeptiske paleontologen Nora Tidemann må beskytte og lede det urgamle trollet tilbake til Dovre, møter hun et militær som vil ødelegge det og sin egen vantro til folketro — ellers mister hun den siste levende forbindelsen til Norges mytologiske fortid for alltid.',
    loglineScore: 85,
  },
  theme: {
    centralTheme: 'Gjenforbindelse med kulturarv og troens kraft',
    themeStatement: 'Først når vi omfavner visdommen fra våre forfedre, kan vi finne veien hjem.',
    protagonistFlaw: 'Rasjonell skepsis som gjør henne blind for undring, og et brutt forhold til faren som trodde på folketro',
    flawOrigin: 'Nora avviste farens historier om troll som barn og valgte vitenskap over tradisjon, noe som skapte år med avstand mellom dem.',
    whatMustChange: 'Hun må forene vitenskapelig rasjonalitet med folkelig visdom, og reparere forholdet til faren før det er for sent.',
    transformationArc: 'Fra avvisende skeptiker som håner tradisjon → til nølende troende som er vitne til det umulige → til aktiv beskytter som bygger bro mellom fortid og nåtid',
    emotionalJourney: ['Skepticism', 'Fear', 'Wonder', 'Determination', 'Grief', 'Hope', 'Triumph'],
    moralArgument: 'Filmen argumenterer for at fremskritt uten respekt for fortiden fører til ødeleggelse, mens omfavnelse av kulturarven gir oss visdommen til å møte fremtiden.',
  },
  currentPhase: 2,
  phaseStatus: {
    concept: 'ready',
    logline: 'ready',
    theme: 'ready',
  },
  lastSaved: new Date().toISOString(),
  locks: { concept: false, logline: false, theme: false },
  versions: [],
};

const DEFAULT_STATE: StoryLogicState = {
  concept: {
    corePremise: '',
    genre: '',
    subGenre: '',
    tone: [],
    targetAudience: '',
    audienceAge: '',
    whyNow: '',
    uniqueAngle: '',
    marketComparables: '',
  },
  logline: {
    protagonist: '',
    protagonistTrait: '',
    goal: '',
    antagonisticForce: '',
    stakes: '',
    fullLogline: '',
    loglineScore: 0,
  },
  theme: {
    centralTheme: '',
    themeStatement: '',
    protagonistFlaw: '',
    flawOrigin: '',
    whatMustChange: '',
    transformationArc: '',
    emotionalJourney: [],
    moralArgument: '',
  },
  currentPhase: 0,
  phaseStatus: {
    concept: 'incomplete',
    logline: 'incomplete',
    theme: 'incomplete',
  },
  lastSaved: null,
  locks: { concept: false, logline: false, theme: false },
  versions: [],
};

const CONTENT_PRODUCER_DEMO_STATE: StoryLogicState = {
  concept: {
    corePremise: `Et produksjonsteam utvikler en filmserie for ${PRODUCER_DEMO_CLIENT_COMPANY} og må gjøre kompliserte HMS-rutiner konkrete, menneskelige og godkjennbare uten å miste tempoet i leveransen.`,
    genre: 'Corporate',
    subGenre: 'Industrial Training Drama',
    tone: ['Confident', 'Grounded', 'Professional'],
    targetAudience: 'Nye teknikere, skiftledere og HR-/HMS-ansvarlige som trenger tydelig opplæring med høy troverdighet.',
    audienceAge: 'Adult (25-44)',
    whyNow: 'Industri- og energibedrifter må kombinere rask onboarding, sikkerhetskultur og rekruttering i samme innholdspakke.',
    uniqueAngle: 'Prosjektet forteller en konkret første arbeidsdag og gjør prosedyrene filmatiske uten å miste faglig presisjon.',
    marketComparables: 'Moderne onboarding-filmer, HMS-kampanjer og employer-branding med dokumentarisk troverdighet.',
  },
  logline: {
    protagonist: 'En ny tekniker',
    protagonistTrait: 'fokusert, men uerfaren offshore-ansatt',
    goal: 'må forstå sikker oppstart, kommunikasjon og avvikshåndtering før første skift',
    antagonisticForce: 'tidspress, ukjente rutiner og et miljø der små feil kan få store konsekvenser',
    stakes: 'skape utrygghet i teamet, bryte kritiske rutiner og miste tillit på første arbeidsdag',
    fullLogline: 'Når en fokusert, men uerfaren tekniker skal gjennom sin første oppstart hos Northwind Drilling, må hun mestre sikker oppstart, kommunikasjon og avvikshåndtering før første skift, mens tidspress, ukjente rutiner og et risikofylt miljø truer med å gjøre små feil kostbare.',
    loglineScore: 86,
  },
  theme: {
    centralTheme: 'Tydelige rutiner skaper trygg handling',
    themeStatement: 'Når komplekse prosedyrer oversettes til konkrete valg, blir sikkerhetskultur noe folk faktisk kan leve ut i arbeidshverdagen.',
    protagonistFlaw: 'Hun tror fart er viktigere enn å stoppe opp og dobbeltsjekke.',
    flawOrigin: 'Tidligere har hun blitt premiert for rask levering og antar at samme logikk gjelder i et høy-risiko-miljø.',
    whatMustChange: 'Hun må forstå at profesjonell trygghet handler om presisjon, kommunikasjon og å be om bekreftelse i tide.',
    transformationArc: 'Fra å ville bevise at hun er rask nok → til å forstå at hun blir verdifull når hun arbeider sikkert og tydelig sammen med andre.',
    emotionalJourney: ['Anticipation', 'Pressure', 'Uncertainty', 'Clarity', 'Trust', 'Readiness'],
    moralArgument: 'God opplæring handler ikke om å informere mest mulig, men om å gjøre riktige valg enkle å forstå og huske.',
  },
  currentPhase: 2,
  phaseStatus: {
    concept: 'ready',
    logline: 'ready',
    theme: 'ready',
  },
  lastSaved: new Date().toISOString(),
  locks: { concept: false, logline: false, theme: false },
  versions: [],
};

function looksLikeLegacyContentProducerStoryLogicState(state: StoryLogicState): boolean {
  return containsLegacyProducerDemoMarker(
    state.concept.corePremise,
    state.logline.protagonist,
    state.logline.fullLogline,
    state.theme.themeStatement,
    state.theme.transformationArc
  );
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateConcept(concept: ConceptData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const coaching: CoachingTip[] = [];
  let score = 0;
  const maxScore = 9;

  // Core premise — signal check: look for character + conflict indicators
  if (concept.corePremise.length > 20) {
    score += 1;
    const hasCharacter = /\b(a|an|the)\s+\w+/i.test(concept.corePremise);
    const hasConflict = /\b(must|forces?|against|between|struggle|threat|discover|secrets?|hidden)\b/i.test(concept.corePremise);
    if (concept.corePremise.length < 50 || (!hasCharacter && !hasConflict)) {
      suggestions.push('Utvid kjernepremisset så det inkluderer en karakter og en tydelig hovedkonflikt.');
    }
  } else {
    warnings.push({ message: 'Kjernepremisset er for kort eller mangler.', fieldId: 'corePremise', impact: 'Uten premiss har du ingen historie å utvikle.', pointsLost: 1 });
  }

  // Genre
  if (concept.genre) {
    score += 1;
  } else {
    warnings.push({ message: 'Velg en hovedsjanger.', fieldId: 'genre', impact: 'Sjanger styrer publikumsforventning og markedsposisjonering.', pointsLost: 1 });
  }

  // Tone
  if (concept.tone.length > 0) {
    score += 1;
    if (concept.tone.length > 3) {
      suggestions.push('Vurder å snevre inn tonevalget til 2-3 for en mer fokusert historie.');
    }
  } else {
    warnings.push({ message: 'Velg minst én tone for historien.', fieldId: 'tone', impact: 'Tone styrer alle kreative valg: dialog, visuelt uttrykk og tempo.', pointsLost: 1 });
  }

  // Target audience — signal check for specificity
  if (concept.targetAudience.length > 10) {
    score += 1;
    const isGeneric = /everyone|all people|general audience/i.test(concept.targetAudience);
    if (isGeneric) suggestions.push('"Alle" er ikke en målgruppe. Vær konkret: hvem kommer til å heie frem denne historien?');
  } else {
    warnings.push({ message: 'Definer målgruppen mer presist.', fieldId: 'targetAudience', impact: 'Utydelig målgruppe gir ufokusert markedsføring og lav effekt.', pointsLost: 1 });
  }

  // Why now — signal check for concrete references
  if (concept.whyNow.length > 20) {
    score += 2;
    const hasConcreteRef = /\b(20\d{2}|pandemic|AI|climate|social media|movement|generation|trend|technology|law|election)\b/i.test(concept.whyNow);
    if (concept.whyNow.length < 50 || !hasConcreteRef) {
      suggestions.push('"Hvorfor nå" bør vise til konkrete kulturelle øyeblikk, trender eller hendelser.');
    }
  } else {
    warnings.push({ message: '"Hvorfor denne historien nå?" trenger mer presisjon.', fieldId: 'whyNow', impact: 'Uten tidsrelevans spør beslutningstakere: "hvorfor skal jeg bry meg?"', pointsLost: 2 });
    coaching.push({ example: 'Klimaangst + Gen Z-aktivisme gir økothriller høy relevans.', template: 'På grunn av [AKTUELL HENDELSE/TREND] er publikum ekstra åpne for historier om [DITT TEMA].', avoid: 'Unngå "det har alltid vært relevant" — det svarer ikke på spørsmålet.' });
  }

  // Unique angle — signal check for specificity (not just "different")
  if (concept.uniqueAngle.length > 20) {
    score += 2;
    const isGenericAngle = /^(it'?s )?(?:unique|different|special|new|fresh|original)\b/i.test(concept.uniqueAngle.trim());
    if (isGenericAngle) {
      suggestions.push('Unik vinkel starter for generisk. Vis HVORDAN den er annerledes, ikke bare si at den er det.');
    }
  } else {
    warnings.push({ message: 'Hva gjør DIN versjon unik? Dette er avgjørende.', fieldId: 'uniqueAngle', impact: 'Uten en tydelig differensiator drukner historien blant lignende prosjekter.', pointsLost: 2 });
    coaching.push({ example: 'I motsetning til klassiske kuppfilmer består teamet av pensjonister uten noe å tape.', template: 'I motsetning til [KONVENSJONELL TILNÆRMING] gjør denne historien [SPESIFIKK FORSKJELL], som skaper [UNIKT RESULTAT].', avoid: 'Unngå "det er en unik take" — det sier ingenting konkret.' });
  }

  // Market comparables — signal check for "X meets Y" pattern
  if (concept.marketComparables.length > 10) {
    score += 1;
    const hasPattern = /\b(meets?|cross|like|but|with|plus|×|x)\b/i.test(concept.marketComparables);
    if (!hasPattern) suggestions.push('Bruk "X møter Y"-formelen for sammenligninger (f.eks. "Inception møter The Office").');
  } else {
    warnings.push({ message: 'Legg til markedssammenligninger for å posisjonere historien.', fieldId: 'marketComparables', impact: 'Sammenligninger hjelper produsenter å forstå pitchen umiddelbart.', pointsLost: 1 });
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 6;
  const affirmations: string[] = [];
  if (isValid) {
    if (concept.marketComparables.length > 10) affirmations.push('Sammenligninger posisjonerer historien godt i markedet.');
    if (concept.whyNow.length >= 50) affirmations.push('"Hvorfor nå" er tydelig formulert med sterk relevansvinkel.');
    if (concept.uniqueAngle.length >= 50) affirmations.push('Den unike vinkelen er tydelig definert og skiller seg godt ut.');
  }

  // Next best action: pick the warning with highest pointsLost
  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Forsterk: ${getFieldLabelNb(sorted[0].fieldId)}` : null;

  return { isValid, score: pct, warnings, suggestions, affirmations, coaching, contradictions: [], nextBestAction };
}

function validateLogline(logline: LoglineData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const coaching: CoachingTip[] = [];
  let score = 0;
  const maxScore = 6;

  // Protagonist — signal check for role/occupation
  if (logline.protagonist.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Definer protagonisten.', fieldId: 'protagonist', impact: 'Ingen protagonist betyr ingen å heie på.', pointsLost: 1 });
  }

  // Goal — signal check for action verb
  if (logline.goal.length > 10) {
    score += 1;
    const hasActionVerb = /\b(stop|save|escape|expose|find|destroy|protect|prevent|recover|solve|uncover|survive|win|defeat|rescue|build|prove|convince)\b/i.test(logline.goal);
    if (!hasActionVerb) suggestions.push('Målet bør starte med et handlingsverb (stoppe, redde, rømme, avsløre, beskytte …).');
  } else {
    warnings.push({ message: 'Hva vil protagonisten oppnå?', fieldId: 'goal', impact: 'Uten et tydelig mål mangler historien fremdriftsmotor.', pointsLost: 1 });
    coaching.push({ example: '"må avsløre korrupsjonen før valget"', template: 'må [HANDLINGSVERB] [KONKRET MÅL] før [DEADLINE]', avoid: 'Unngå vage mål som "finne seg selv" eller "finne ut av ting".' });
  }

  // Antagonistic force
  if (logline.antagonisticForce.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Definer den antagonistiske kraften.', fieldId: 'antagonisticForce', impact: 'Ingen motstand gir ingen spenning.', pointsLost: 1 });
  }

  // Stakes — signal check for concrete consequences
  if (logline.stakes.length > 10) {
    score += 1.5;
    const hasConcrete = /\b(die|death|lose|destroy|war|prison|homeless|alone|fired|betray|forgotten|extinct|collapse)\b/i.test(logline.stakes);
    if (!hasConcrete) suggestions.push('Konsekvensene oppleves abstrakte. Navngi konkret tap: liv, kjærlighet, frihet eller identitet.');
  } else {
    warnings.push({ message: 'Hva skjer hvis protagonisten feiler?', fieldId: 'stakes', impact: 'Uten stakes kollapser spenningsmotoren.', pointsLost: 1.5 });
    coaching.push({ example: '"ellers blir hele landsbyen utslettet"', template: 'ellers vil [KONKRET PERSON/OBJEKT] [IRREVERSIBEL KONSEKVENS]', avoid: 'Unngå "det skjer noe dårlig" — navngi konsekvensen.' });
  }

  // Full logline quality
  if (logline.fullLogline.length > 30) {
    score += 1.5;
    const hasWhen = /when|after|before/i.test(logline.fullLogline);
    const hasMust = /must|needs to|has to|tries to/i.test(logline.fullLogline);
    const hasOr = /or else|otherwise|before|unless/i.test(logline.fullLogline);
    if (!hasWhen) suggestions.push('Start med "Når …" for å etablere utløsende hendelse.');
    if (!hasMust) suggestions.push('Inkluder hva protagonisten "må" gjøre.');
    if (!hasOr) suggestions.push('Legg inn stakes: "ellers …" / "før …" for å øke spenningen.');
  } else {
    warnings.push({ message: 'Skriv komplett logline (25-50 ord).', fieldId: 'fullLogline', impact: 'Loglinen ER pitchen din. Uten logline blir det ingen greenlight.', pointsLost: 1.5 });
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 4.5;
  const affirmations: string[] = [];
  if (isValid && logline.fullLogline.length > 30) {
    const allBeats = /when|after|before/i.test(logline.fullLogline)
      && /must|needs to|has to|tries to/i.test(logline.fullLogline)
      && /or else|otherwise|before|unless/i.test(logline.fullLogline);
    if (allBeats) affirmations.push('Loglinen treffer alle strukturelle beats og gir et sterkt grunnlag.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Legg til: ${getFieldLabelNb(sorted[0].fieldId)}` : null;

  return { isValid, score: pct, warnings, suggestions, affirmations, coaching, contradictions: [], nextBestAction };
}

function validateTheme(theme: ThemeData): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];
  const coaching: CoachingTip[] = [];
  let score = 0;
  const maxScore = 8;

  if (theme.centralTheme.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Definer sentralt tema.', fieldId: 'centralTheme', impact: 'Tema er historiens sjel — uten det føles scener tilfeldige.', pointsLost: 1 });
  }

  if (theme.themeStatement.length > 20) {
    score += 1.5;
    if (!theme.themeStatement.includes('...') && !/argues? that/i.test(theme.themeStatement)) {
      suggestions.push('Formuler som: "Denne historien argumenterer for at …" for å gjøre den aktiv og diskuterbar.');
    }
  } else {
    warnings.push({ message: 'Skriv en temapåstand.', fieldId: 'themeStatement', impact: 'Uten en tydelig tese mangler historien argument.', pointsLost: 1.5 });
    coaching.push({ example: 'Denne historien argumenterer for at ekte mot er å vise sårbarhet, ikke skjule den.', template: 'Denne historien argumenterer for at [TRO] er/krever [INNSIKT], ikke [VANLIG ANTAGELSE].', avoid: 'Unngå klisjeer som "kjærlighet overvinner alt" — gjør påstanden diskuterbar.' });
  }

  if (theme.protagonistFlaw.length > 10) {
    score += 1.5;
  } else {
    warnings.push({ message: 'Definer protagonistens kjernefeil.', fieldId: 'protagonistFlaw', impact: 'Ingen feil gir ingen vekst og en flat karakter.', pointsLost: 1.5 });
  }

  if (theme.whatMustChange.length > 15) {
    score += 1.5;
  } else {
    warnings.push({ message: 'Presiser hva som må endres.', fieldId: 'whatMustChange', impact: 'Transformasjon er utbetalingen — publikum må se skiftet.', pointsLost: 1.5 });
    coaching.push({ example: 'Hun må slutte å skylde på andre og ta ansvar for egne valg.', template: 'Protagonisten må forlate [GAMMEL TRO] og omfavne [NY SANNHET].', avoid: 'Unngå "de må vokse" — spesifiser HVA som endres.' });
  }

  if (theme.transformationArc.length > 20) {
    score += 1.5;
    // Signal check: look for progression markers
    const hasProgression = /→|to|from|becomes|evolves|realizes|learns/i.test(theme.transformationArc);
    if (!hasProgression) suggestions.push('Vis buen som "Fra [X] → til [Y]" for å gjøre transformasjonen konkret.');
  } else {
    warnings.push({ message: 'Beskriv transformasjonsbuen.', fieldId: 'transformationArc', impact: 'Uten en tydelig bue føles slutten ufortjent.', pointsLost: 1.5 });
  }

  if (theme.emotionalJourney.length >= 3) {
    score += 1;
  } else {
    suggestions.push('Kartlegg minst 3-5 sentrale emosjonelle beats i historien.');
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 6;
  const affirmations: string[] = [];
  if (isValid) {
    if (theme.transformationArc.length > 50) affirmations.push('Transformasjonsbuen er detaljert og karakterreisen tydelig.');
    if (theme.emotionalJourney.length >= 4) affirmations.push('Den emosjonelle reisen er godt kartlagt og gir dyp resonans.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Avklar: ${getFieldLabelNb(sorted[0].fieldId)}` : null;

  return { isValid, score: pct, warnings, suggestions, affirmations, coaching, contradictions: [], nextBestAction };
}

// ============================================================================
// Helper Components
// ============================================================================

interface PhaseHeaderProps {
  number: number;
  title: string;
  purpose: string;
  icon: React.ReactNode;
  status: 'incomplete' | 'weak' | 'ready';
  locked: boolean;
  onToggleLock: () => void;
  nextBestAction: string | null;
}

const PhaseHeader: React.FC<PhaseHeaderProps> = ({ number, title, purpose, icon, status, locked, onToggleLock, nextBestAction }) => {
  const statusColors = {
    incomplete: '#9ca3af',  // neutral gray, not red (#3 energy-aware)
    weak: '#f59e0b',
    ready: '#10b981',
  };

  const statusIcons = {
    incomplete: <PsychologyIcon fontSize="small" />,  // thinking icon, not error (#3)
    weak: <AutoAwesomeIcon fontSize="small" />,  // sparkle, not warning (#3)
    ready: <CheckIcon fontSize="small" />,
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, width: '100%' }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${statusColors[status]}40, ${statusColors[status]}20)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${statusColors[status]}`,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
            Fase {number}: {title}
          </Typography>
          <Chip
            size="small"
            icon={statusIcons[status]}
            label={STATUS_LABELS[status]}
            sx={{
              bgcolor: `${statusColors[status]}15`,
              color: statusColors[status],
              '& .MuiChip-icon': { color: statusColors[status] },
            }}
          />
          {locked && (
            <Chip size="small" icon={<LockIcon sx={{ fontSize: 14 }} />} label="Låst" sx={{ bgcolor: '#f59e0b20', color: '#f59e0b', '& .MuiChip-icon': { color: '#f59e0b' } }} />
          )}
          {nextBestAction && !locked && status !== 'ready' && (
            <Chip
              size="small"
              icon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              label={nextBestAction}
              sx={{ bgcolor: '#3b82f620', color: '#60a5fa', '& .MuiChip-icon': { color: '#3b82f6' }, cursor: 'default' }}
            />
          )}
        </Box>
        <Typography variant="body2" sx={{ color: '#9ca3af' }}>
          {purpose}
        </Typography>
      </Box>
      <Tooltip title={locked ? `Lås opp ${title}` : status === 'ready' ? `Lås ${title} (klar)` : `Lås ${title}`}>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          aria-label={locked ? `Lås opp ${title}` : `Lås ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onToggleLock();
            }
          }}
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: locked ? '#f59e0b' : '#6b7280',
            flexShrink: 0,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            '&:focus-visible': { outline: '2px solid #60a5fa', outlineOffset: 2 },
          }}
        >
          {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
        </Box>
      </Tooltip>
    </Box>
  );
};

interface ValidationDisplayProps {
  result: ValidationResult;
  title: string;
  onJumpToField?: (fieldId: string) => void;
}

const ValidationDisplay: React.FC<ValidationDisplayProps> = ({ result, title, onJumpToField }) => {
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);
  const confidence = getConfidenceTier(result.score);
  const energyColor = getEnergyColor(result.score);

  // One Insight at a Time: pick the single biggest structural weakness (#2)
  const topWarning = result.warnings.length > 0
    ? [...result.warnings].sort((a, b) => b.pointsLost - a.pointsLost)[0]
    : null;
  const totalFeedbackCount = result.warnings.length + result.suggestions.length;
  const remainingCount = totalFeedbackCount - (topWarning ? 1 : 0);

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(0,0,0,0.3)',
        border: `1px solid ${result.score >= 70 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 2,
        mt: 2,
      }}
    >
      {/* Confidence header — mentor tone, not judge (#4) */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#d4d4d8' }}>
          {title} selvtillit
        </Typography>
        <Chip
          size="small"
          label={confidence.label}
          sx={{ bgcolor: `${confidence.color}20`, color: confidence.color, fontWeight: 600 }}
        />
      </Box>
      <LinearProgress
        variant="determinate"
        value={result.score}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': {
            bgcolor: energyColor, // Never red when low — uses neutral gray
            borderRadius: 3,
          },
        }}
      />

      {/* One Insight at a Time — biggest structural weakness only (#2) */}
      {topWarning && (
        <Box sx={{
          mt: 1.5, p: 1.5,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 1.5,
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <GpsFixedIcon sx={{ fontSize: '1.1rem', color: '#60a5fa', mt: 0.25 }} aria-hidden />
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600, letterSpacing: 0.5 }}>
                STØRSTE MULIGHET
              </Typography>
              <Typography variant="body2" sx={{ color: '#e5e7eb', fontWeight: 500, mt: 0.25 }}>
                {topWarning.message}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9ca3af', mt: 0.5, display: 'block', lineHeight: 1.4 }}>
                {topWarning.impact}
              </Typography>
            </Box>
            {onJumpToField && (
              <Tooltip title={`Gå til ${getFieldLabelNb(topWarning.fieldId)}`}>
                <IconButton size="small" onClick={() => onJumpToField(topWarning.fieldId)} sx={{ color: '#60a5fa' }}>
                  <GpsFixedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      )}

      {/* "See all feedback" — progressive disclosure (#2, #12) */}
      {remainingCount > 0 && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            onClick={() => setShowAllFeedback(!showAllFeedback)}
            endIcon={showAllFeedback ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#6b7280', textTransform: 'none', fontSize: '0.75rem' }}
          >
            {showAllFeedback ? 'Fokusmodus' : `Vis all tilbakemelding (${remainingCount})`}
          </Button>
          <Collapse in={showAllFeedback}>
            <Box sx={{ mt: 0.5 }}>
              {result.warnings
                .filter(w => w !== topWarning)
                .map((w, idx) => (
                  <Box
                    key={`w-${idx}`}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1,
                      p: 1, mb: 0.5,
                      bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1,
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <TipsIcon sx={{ fontSize: '0.95rem', color: '#fbbf24', mt: 0.1 }} aria-hidden />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: '#d4d4d8' }}>{w.message}</Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>{w.impact}</Typography>
                    </Box>
                    {onJumpToField && (
                      <IconButton size="small" onClick={() => onJumpToField(w.fieldId)} aria-label={`Gå til ${getFieldLabelNb(w.fieldId)}`} sx={{ color: '#60a5fa' }}>
                        <GpsFixedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              {result.suggestions.map((s, idx) => (
                <Box
                  key={`s-${idx}`}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1,
                    p: 1, mb: 0.5,
                    bgcolor: 'rgba(59, 130, 246, 0.04)', borderRadius: 1,
                  }}
                >
                  <TipsIcon sx={{ fontSize: 16, color: '#60a5fa', mt: 0.2 }} />
                  <Typography variant="body2" sx={{ color: '#93c5fd' }}>{s}</Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Affirmations — warm, not clinical */}
      {result.affirmations.length > 0 && result.score >= 70 && (
        <Box sx={{ mt: 1.5 }}>
          {result.affirmations.map((a, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CheckIcon sx={{ fontSize: 16, color: '#10b981' }} />
              <Typography variant="body2" sx={{ color: '#6ee7b7' }}>{a}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Contradiction flags — soft amber, not red (#8) */}
      {result.contradictions.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          {result.contradictions.map((c, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1, mb: 0.5, bgcolor: 'rgba(251,191,36,0.06)', borderRadius: 1, border: '1px solid rgba(251,191,36,0.15)' }}>
              <ContradictionIcon sx={{ fontSize: 16, color: '#fbbf24', mt: 0.2 }} />
              <Typography variant="body2" sx={{ color: '#fcd34d' }}>{c}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Coaching — mentor mode (#3) */}
      {result.coaching.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            startIcon={<SchoolIcon />}
            onClick={() => setShowCoaching(!showCoaching)}
            endIcon={showCoaching ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#a78bfa', textTransform: 'none', fontSize: '0.75rem' }}
          >
            {showCoaching ? 'Skjul' : 'Vis'} mentor-tips ({result.coaching.length})
          </Button>
          <Collapse in={showCoaching}>
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(139, 92, 246, 0.06)', borderRadius: 1.5, border: '1px solid rgba(139, 92, 246, 0.15)' }}>
              {result.coaching.map((tip, idx) => (
                <Box key={idx} sx={{ mb: idx < result.coaching.length - 1 ? 2 : 0 }}>
                  <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600 }}>Eksempel:</Typography>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 0.5, fontStyle: 'italic' }}>"{tip.example}"</Typography>
                  <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600 }}>Mal:</Typography>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 0.5 }}>{tip.template}</Typography>
                  <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>Pass på:</Typography>
                  <Typography variant="body2" sx={{ color: '#a1a1aa' }}>{tip.avoid}</Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Paper>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface StoryLogicPanelProps {
  projectId?: string;
  onSave?: (data: StoryLogicState) => void;
  initialData?: StoryLogicState;
  onUnsavedStateChange?: (hasUnsaved: boolean, reason?: string) => void;
}

export const StoryLogicPanel: React.FC<StoryLogicPanelProps> = ({
  projectId,
  onSave,
  initialData,
  onUnsavedStateChange,
}) => {
  const branding = useBrandingSettings();
  const [state, setState] = useState<StoryLogicState>(initialData || DEFAULT_STATE);
  const [expandedPhase, setExpandedPhase] = useState<number>(0);
  const [showValidation, _setShowValidation] = useState<boolean>(true);
  const [_isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'offline'>('saved');
  const [syncMeta, setSyncMeta] = useState<StoryLogicSyncMeta | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [startMode, setStartMode] = useState<StartMode | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [premiseChangeAlert, setPremiseChangeAlert] = useState<string | null>(null);
  const prevPremiseRef = useRef(state.concept.corePremise);

  const refreshSyncMeta = useCallback(() => {
    if (!projectId) {
      setSyncMeta(null);
      return;
    }

    try {
      setSyncMeta(storyLogicService.getStoryLogicSyncMeta(projectId));
    } catch (error) {
      setSyncMeta({
        projectId,
        status: 'error',
        source: 'server',
        lastError: error instanceof Error ? error.message : 'Kunne ikke lese sync-status.',
      });
    }
  }, [projectId]);

  const syncStatusLabel = useMemo(() => {
    const status = syncMeta?.status ?? 'idle';
    const versionSuffix = syncMeta?.version ? ` v${syncMeta.version}` : '';
    if (status === 'synced') return `Synket${versionSuffix}`;
    if (status === 'saving') return 'Synker';
    if (status === 'loading') return 'Henter';
    if (status === 'conflict') return 'Konflikt';
    if (status === 'local_only') return 'Kun lokalt';
    if (status === 'error') return 'Sync-feil';
    return 'Ikke synket';
  }, [syncMeta]);

  const syncStatusColor = useMemo(() => {
    const status = syncMeta?.status ?? 'idle';
    if (status === 'synced') return '#10b981';
    if (status === 'saving' || status === 'loading') return '#60a5fa';
    if (status === 'conflict') return '#f59e0b';
    if (status === 'local_only') return '#a78bfa';
    if (status === 'error') return '#ef4444';
    return '#9ca3af';
  }, [syncMeta]);

  useEffect(() => {
    onUnsavedStateChange?.(
      saveStatus === 'unsaved' || saveStatus === 'offline' || saveStatus === 'saving',
      saveStatus === 'saved' ? undefined : 'story logic',
    );

    return () => {
      onUnsavedStateChange?.(false);
    };
  }, [onUnsavedStateChange, saveStatus]);

  // Refs for autosave + jump-to-field (#1, #5)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshot = useRef<string>(JSON.stringify(initialData || DEFAULT_STATE));

  // Register field ref callback (#1)
  const registerFieldRef = useCallback((fieldId: string) => (el: HTMLElement | null) => {
    fieldRefs.current[fieldId] = el;
  }, []);

  // Jump to field (#1)
  const jumpToField = useCallback((fieldId: string) => {
    const el = fieldRefs.current[fieldId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedField(fieldId);
      const input = el.querySelector('input, textarea') as HTMLElement | null;
      if (input) input.focus();
      setTimeout(() => setHighlightedField(null), 2500);
    }
  }, []);

  // Highlight style for jump-to-field (#1)
  const getFieldHighlightSx = useCallback((fieldId: string) => {
    if (highlightedField !== fieldId) return {};
    return {
      '& .MuiOutlinedInput-root': {
        '& fieldset': {
          borderColor: '#3b82f6 !important',
          borderWidth: '2px !important',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)',
        },
      },
      transition: 'all 0.3s ease',
    };
  }, [highlightedField]);

  // Load from database or initialize with TROLL demo data
  useEffect(() => {
    if (!projectId || initialData) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const normalizedProjectId = projectId.toLowerCase();
        const demoSeedAllowed = isRoleRoomDemoSeedAllowed();
        const isTrollDemoProject = demoSeedAllowed && normalizedProjectId === TROLL_DEMO_PROJECT_ID;
        const isContentProducerDemoProject = demoSeedAllowed && normalizedProjectId === CONTENT_PRODUCER_DEMO_PROJECT_ID;
        const savedData = await storyLogicService.getStoryLogic(projectId);
        refreshSyncMeta();
        if (savedData) {
          // Migrate old isLocked → locks if needed
          const migrated = {
            ...savedData,
            locks: savedData.locks || { concept: false, logline: false, theme: false },
            versions: savedData.versions || [],
          };
          const normalized = normalizeStoryLogicState(migrated);
          const looksLikeLegacyTrollProducerState = isContentProducerDemoProject && (
            normalized.concept.corePremise.toLowerCase().includes('troll') ||
            normalized.logline.fullLogline.toLowerCase().includes('troll')
          );
          const looksLikeLegacyProducerRoleState = isContentProducerDemoProject &&
            looksLikeLegacyContentProducerStoryLogicState(normalized);

          if (looksLikeLegacyTrollProducerState || looksLikeLegacyProducerRoleState) {
            const normalizedProducerDemo = normalizeStoryLogicState(CONTENT_PRODUCER_DEMO_STATE);
            setState(normalizedProducerDemo);
            await storyLogicService.saveStoryLogic(projectId, normalizedProducerDemo);
            refreshSyncMeta();
            lastSavedSnapshot.current = JSON.stringify(normalizedProducerDemo);
            setSaveStatus('saved');
            console.log('🧹 Replaced legacy producer demo story logic with business project data');
          } else {
            setState(normalized);
            lastSavedSnapshot.current = JSON.stringify(normalized);
            setSaveStatus('saved');
            console.log('✓ Loaded story logic from database for project:', projectId);
          }
        } else if (isContentProducerDemoProject) {
          const normalizedProducerDemo = normalizeStoryLogicState(CONTENT_PRODUCER_DEMO_STATE);
          setState(normalizedProducerDemo);
          await storyLogicService.saveStoryLogic(projectId, normalizedProducerDemo);
          refreshSyncMeta();
          lastSavedSnapshot.current = JSON.stringify(normalizedProducerDemo);
          console.log('🎬 Initialized producer story logic demo data');
        } else if (isTrollDemoProject) {
          const normalizedDemo = normalizeStoryLogicState(TROLL_DEMO_STATE);
          setState(normalizedDemo);
          await storyLogicService.saveStoryLogic(projectId, normalizedDemo);
          refreshSyncMeta();
          lastSavedSnapshot.current = JSON.stringify(normalizedDemo);
          console.log('🎬 Initialized TROLL story logic demo data');
        }
      } catch (error) {
        console.error('Failed to load story logic data:', error);
        refreshSyncMeta();
        setSaveStatus('offline');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId, initialData, refreshSyncMeta]);

  // Autosave with debounce (#5)
  useEffect(() => {
    const currentSnapshot = JSON.stringify(state);
    if (currentSnapshot === lastSavedSnapshot.current) {
      setSaveStatus('saved');
      return;
    }
    setSaveStatus('unsaved');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (!projectId) return;
      setSaveStatus('saving');
      refreshSyncMeta();
      try {
        const dataToSave = { ...state, lastSaved: new Date().toISOString() };
        await storyLogicService.saveStoryLogic(projectId, dataToSave);
        refreshSyncMeta();
        lastSavedSnapshot.current = JSON.stringify(dataToSave);
        setState(prev => ({ ...prev, lastSaved: dataToSave.lastSaved }));
        setSaveStatus('saved');
      } catch {
        refreshSyncMeta();
        setSaveStatus('offline');
      }
    }, 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [state, projectId, refreshSyncMeta]);

  // Soft version history — detect significant premise changes (#5 Recovery Design)
  useEffect(() => {
    const prev = prevPremiseRef.current;
    const curr = state.concept.corePremise;
    if (prev.length > 30 && curr.length > 10) {
      // Check if the premise changed significantly (>50% different words)
      const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const currWords = new Set(curr.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const overlap = [...prevWords].filter(w => currWords.has(w)).length;
      const total = Math.max(prevWords.size, currWords.size);
      if (total > 0 && overlap / total < 0.5) {
        setPremiseChangeAlert('Du har endret kjernepremisset betydelig. Vil du lagre en ny versjon?');
      }
    }
    prevPremiseRef.current = curr;
  }, [state.concept.corePremise]);

  // Save version snapshot (#11)
  const saveVersion = useCallback((label?: string) => {
    setState(prev => {
      const version: StoryVersion = {
        id: Date.now().toString(36),
        label: label || `v${prev.versions.length + 1}`,
        timestamp: new Date().toISOString(),
        snapshot: JSON.stringify({ concept: prev.concept, logline: prev.logline, theme: prev.theme }),
      };
      return { ...prev, versions: [...prev.versions, version] };
    });
  }, []);

  // Apply template (#9)
  const applyTemplate = useCallback((template: StoryTemplate) => {
    if (state.concept.corePremise.length > 20) {
      if (!window.confirm('Dette overskriver nåværende oppsett med malen. Fortsette?')) return;
      saveVersion('Før mal');
    }
    setState(prev => ({
      ...prev,
      concept: { ...DEFAULT_STATE.concept, ...template.data.concept },
      logline: { ...DEFAULT_STATE.logline, ...template.data.logline },
      theme: { ...DEFAULT_STATE.theme, ...template.data.theme },
    }));
    setShowTemplates(false);
  }, [state.concept.corePremise, saveVersion]);

  const goToPhase = useCallback((phaseIndex: number) => {
    setExpandedPhase(phaseIndex);
    setState(prev => (
      prev.currentPhase === phaseIndex
        ? prev
        : { ...prev, currentPhase: phaseIndex }
    ));
  }, []);

  // Handle start mode selection (#10 non-linear start)
  const handleStartMode = useCallback((mode: StartMode) => {
    setStartMode(mode);
    const modeConfig = START_MODES.find(m => m.id === mode);
    if (modeConfig) goToPhase(modeConfig.initialPhase);
  }, [goToPhase]);

  // Save to database
  const saveToStorage = useCallback(async () => {
    if (!projectId) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    refreshSyncMeta();
    const dataToSave = { ...state, lastSaved: new Date().toISOString() };
    
    try {
      await storyLogicService.saveStoryLogic(projectId, dataToSave);
      refreshSyncMeta();
      setState(dataToSave);
      lastSavedSnapshot.current = JSON.stringify(dataToSave);
      setSaveStatus('saved');
      onSave?.(dataToSave);
      console.log('✓ Story logic saved for project:', projectId);
    } catch (error) {
      console.error('Failed to save story logic:', error);
      refreshSyncMeta();
      setSaveStatus('offline');
    } finally {
      setIsSaving(false);
    }
  }, [projectId, state, onSave, refreshSyncMeta]);

  // Memoize all validation results — single source of truth (A: eliminates duplicate computation)
  const conceptValidation = useMemo(() => validateConcept(state.concept), [state.concept]);
  const loglineValidation = useMemo(() => validateLogline(state.logline), [state.logline]);
  const themeValidation = useMemo(() => validateTheme(state.theme), [state.theme]);

  const validationResults = useMemo(() => ({
    concept: conceptValidation.score >= 70 ? 'ready' as const : conceptValidation.score >= 40 ? 'weak' as const : 'incomplete' as const,
    logline: loglineValidation.score >= 70 ? 'ready' as const : loglineValidation.score >= 40 ? 'weak' as const : 'incomplete' as const,
    theme: themeValidation.score >= 70 ? 'ready' as const : themeValidation.score >= 40 ? 'weak' as const : 'incomplete' as const,
  }), [conceptValidation.score, loglineValidation.score, themeValidation.score]);

  // Update validation status - only when memoized results change
  useEffect(() => {
    setState(prev => {
      if (prev.phaseStatus.concept === validationResults.concept &&
          prev.phaseStatus.logline === validationResults.logline &&
          prev.phaseStatus.theme === validationResults.theme) {
        return prev; // Return same reference to prevent re-render
      }
      return {
        ...prev,
        phaseStatus: validationResults,
      };
    });
  }, [validationResults]);

  // Track missing logline fields for best-effort generation feedback (D)
  const missingLoglineFields = useMemo(() => {
    const missing: string[] = [];
    if (!state.logline.protagonist) missing.push('Hovedperson');
    if (!state.logline.goal) missing.push('Mål');
    if (!state.logline.antagonisticForce) missing.push('Antagonistisk kraft');
    if (!state.logline.stakes) missing.push('Konsekvenser');
    return missing;
  }, [state.logline.protagonist, state.logline.goal, state.logline.antagonisticForce, state.logline.stakes]);

  const missingConceptFields = useMemo(() => {
    const missing: string[] = [];
    if (state.concept.corePremise.trim().length < 20) missing.push('Kjernepremiss');
    if (!state.concept.genre) missing.push('Sjanger');
    if (state.concept.tone.length === 0) missing.push('Tone');
    if (state.concept.targetAudience.trim().length < 10) missing.push('Målgruppe');
    if (state.concept.whyNow.trim().length < 20) missing.push('Hvorfor nå');
    if (state.concept.uniqueAngle.trim().length < 20) missing.push('Unik vinkel');
    if (state.concept.marketComparables.trim().length < 10) missing.push('Sammenligninger');
    return missing;
  }, [
    state.concept.corePremise,
    state.concept.genre,
    state.concept.tone,
    state.concept.targetAudience,
    state.concept.whyNow,
    state.concept.uniqueAngle,
    state.concept.marketComparables,
  ]);

  const missingThemeFields = useMemo(() => {
    const missing: string[] = [];
    if (state.theme.centralTheme.trim().length < 5) missing.push('Sentralt tema');
    if (state.theme.themeStatement.trim().length < 20) missing.push('Temapåstand');
    if (state.theme.protagonistFlaw.trim().length < 10) missing.push('Karakterfeil');
    if (state.theme.whatMustChange.trim().length < 15) missing.push('Hva må endres');
    if (state.theme.transformationArc.trim().length < 20) missing.push('Transformasjonsbue');
    return missing;
  }, [
    state.theme.centralTheme,
    state.theme.themeStatement,
    state.theme.protagonistFlaw,
    state.theme.whatMustChange,
    state.theme.transformationArc,
  ]);

  const missingLoglineRoadmapFields = useMemo(() => {
    const missing = [...missingLoglineFields];
    if (state.logline.fullLogline.trim().length < 25) missing.push('Komplett logline');
    return missing;
  }, [missingLoglineFields, state.logline.fullLogline]);

  const conceptRealityPrompt = useMemo(() => getStableRealityCheckPrompt(
    'concept',
    `${state.concept.corePremise}|${state.concept.whyNow}|${state.concept.uniqueAngle}`
  ), [state.concept.corePremise, state.concept.whyNow, state.concept.uniqueAngle]);

  const loglineRealityPrompt = useMemo(() => getStableRealityCheckPrompt(
    'logline',
    `${state.logline.protagonist}|${state.logline.goal}|${state.logline.stakes}|${state.logline.fullLogline}`
  ), [state.logline.protagonist, state.logline.goal, state.logline.stakes, state.logline.fullLogline]);

  const themeRealityPrompt = useMemo(() => getStableRealityCheckPrompt(
    'theme',
    `${state.theme.centralTheme}|${state.theme.themeStatement}|${state.theme.transformationArc}`
  ), [state.theme.centralTheme, state.theme.themeStatement, state.theme.transformationArc]);

  const phaseRoadmap = useMemo(() => (
    PHASE_META.map((phase) => {
      if (phase.key === 'concept') {
        return {
          ...phase,
          status: state.phaseStatus.concept,
          score: conceptValidation.score,
          missingFields: missingConceptFields,
          nextBestAction: conceptValidation.nextBestAction,
        };
      }
      if (phase.key === 'logline') {
        return {
          ...phase,
          status: state.phaseStatus.logline,
          score: loglineValidation.score,
          missingFields: missingLoglineRoadmapFields,
          nextBestAction: loglineValidation.nextBestAction,
        };
      }
      return {
        ...phase,
        status: state.phaseStatus.theme,
        score: themeValidation.score,
        missingFields: missingThemeFields,
        nextBestAction: themeValidation.nextBestAction,
      };
    })
  ), [
    state.phaseStatus.concept,
    state.phaseStatus.logline,
    state.phaseStatus.theme,
    conceptValidation.score,
    conceptValidation.nextBestAction,
    loglineValidation.score,
    loglineValidation.nextBestAction,
    themeValidation.score,
    themeValidation.nextBestAction,
    missingConceptFields,
    missingLoglineRoadmapFields,
    missingThemeFields,
  ]);

  const loglineHasPlaceholders = state.logline.fullLogline.includes('[');

  // Contradiction detection (#8)
  const contradictions = useMemo(
    () => detectContradictions(state.concept, state.theme),
    [state.concept, state.theme]
  );

  // Weighted overall progress: 30% concept + 40% logline + 30% theme (#15)
  const overallProgress = useMemo(() => {
    let raw = Math.round(
      conceptValidation.score * 0.3 +
      loglineValidation.score * 0.4 +
      themeValidation.score * 0.3
    );
    // Cap at 60 if logline is below 40 — logline is the DNA gate
    if (loglineValidation.score < 40) raw = Math.min(raw, 60);
    return raw;
  }, [conceptValidation.score, loglineValidation.score, themeValidation.score]);

  const availableSubGenres = useMemo(
    () => SUB_GENRES[state.concept.genre] || [],
    [state.concept.genre]
  );
  const safeSubGenreValue = availableSubGenres.includes(state.concept.subGenre) ? state.concept.subGenre : '';
  const safeAudienceAgeValue = AUDIENCE_AGES.includes(state.concept.audienceAge) ? state.concept.audienceAge : '';

  // Generate logline from components — best-effort with placeholders for missing fields (D)
  const generateLogline = useCallback(() => {
    if (state.locks.logline) return;
    setState(prev => {
      const { protagonist, protagonistTrait, goal, antagonisticForce, stakes } = prev.logline;
      const prot = protagonist || '[HOVEDPERSON]';
      const g = goal || '[DEFINER MÅL]';
      const ant = antagonisticForce || '[ANTAGONISTISK KRAFT]';
      const st = stakes || '[DEFINER KONSEKVENSER]';
      const trait = protagonistTrait ? `${protagonistTrait} ` : '';
      const generated = `Når ${trait}${prot} må ${g}, møter hen ${ant} — ellers ${st}.`;
      return {
        ...prev,
        logline: { ...prev.logline, fullLogline: generated },
      };
    });
  }, [state.locks.logline]);

  // Update concept field
  const updateConcept = (field: keyof ConceptData, value: string | string[]) => {
    setState(prev => ({
      ...prev,
      concept: { ...prev.concept, [field]: value },
    }));
  };

  // Update logline field
  const updateLogline = (field: keyof LoglineData, value: string | number) => {
    setState(prev => ({
      ...prev,
      logline: { ...prev.logline, [field]: value },
    }));
  };

  // Update theme field
  const updateTheme = (field: keyof ThemeData, value: string | string[]) => {
    setState(prev => ({
      ...prev,
      theme: { ...prev.theme, [field]: value },
    }));
  };

  // Per-phase lock toggle (#6)
  const togglePhaseLock = useCallback((phase: keyof PhaseLocks) => {
    setState(prev => ({
      ...prev,
      locks: { ...prev.locks, [phase]: !prev.locks[phase] },
    }));
  }, []);

  // Restore version (#11)
  const restoreVersion = useCallback((version: StoryVersion) => {
    if (!window.confirm(`Gjenopprette "${version.label}"? Nåværende arbeid lagres først som egen versjon.`)) return;
    saveVersion('Før gjenoppretting');
    try {
      const snap = JSON.parse(version.snapshot);
      setState(prev => ({ ...prev, concept: snap.concept, logline: snap.logline, theme: snap.theme }));
    } catch { /* invalid snapshot */ }
  }, [saveVersion]);

  const loadBrandImageAsset = useCallback(async (source?: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    if (!source || typeof window === 'undefined') return null;
    try {
      const resolved = source.startsWith('http://') || source.startsWith('https://')
        ? source
        : new URL(source, window.location.origin).toString();
      const response = await fetch(resolved, { cache: 'force-cache' });
      if (!response.ok) return null;
      const imageBlob = await response.blob();
      const dataUrl = await blobToDataUrl(imageBlob);
      const dimensions = await readImageDimensions(dataUrl);
      return { dataUrl, width: dimensions.width, height: dimensions.height };
    } catch (error) {
      console.warn('Could not load branding logo for story logic PDF export:', error);
      return null;
    }
  }, []);

  // Export as PDF
  const exportPDF = useCallback(async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 5;
    const now = new Date();
    const projectLabel = projectId || 'Ikke satt';

    const primaryRgb = hexToRgb(branding.colors.primary, [59, 130, 246]);
    const secondaryRgb = hexToRgb(branding.colors.secondary, [30, 64, 175]);
    const backgroundRgb = hexToRgb(branding.colors.background, [12, 17, 28]);
    const surfaceRgb = hexToRgb(branding.colors.surface, [248, 250, 252]);
    const borderRgb = hexToRgb(branding.colors.border, [203, 213, 225]);

    let y = 18;
    const logoAsset = await loadBrandImageAsset(branding.logoUrl || branding.iconUrl);

    doc.setProperties({
      title: 'Storylogikk rapport',
      subject: 'Story Logic',
      creator: branding.appName,
      author: branding.appName,
      keywords: 'storylogikk, manus, rolle room, eksport',
    });

    const safeValue = (value: string) => (value && value.trim().length > 0 ? value : '—');
    const ensureSpace = (needed = 10) => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = 24;
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.line(margin, 16, pageWidth - margin, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text('Storylogikk rapport', margin, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`${branding.appName} • ${projectLabel}`, pageWidth - margin, 12, { align: 'right' });
    };

    const addHeading = (text: string) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(text, margin, y);
      y += 8;
    };

    const addSection = (title: string, subtitle?: string) => {
      ensureSpace(subtitle ? 15 : 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text(title, margin, y);
      y += 6;
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const lines = doc.splitTextToSize(subtitle, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 1;
      }
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    const addBodyText = (text: string, indent = 0) => {
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      ensureSpace(lines.length * lineHeight + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      doc.text(lines, margin + indent, y);
      y += lines.length * lineHeight + 1.5;
    };

    const addField = (label: string, value: string, indent = 0) => {
      ensureSpace(9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(51, 65, 85);
      doc.text(label, margin + indent, y);
      y += 4.8;
      addBodyText(safeValue(value), indent + 1);
    };

    const drawMetricCard = (x: number, cardY: number, width: number, height: number, label: string, value: string, status: string) => {
      doc.setFillColor(surfaceRgb[0], surfaceRgb[1], surfaceRgb[2]);
      doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.roundedRect(x, cardY, width, height, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(label, x + 4, cardY + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(value, x + 4, cardY + 14.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(status, x + 4, cardY + 20.5);
    };

    const addLogo = (x: number, logoY: number, width: number, height: number) => {
      if (!logoAsset) return;
      const naturalAspect = logoAsset.width / logoAsset.height;
      let drawWidth = width;
      let drawHeight = drawWidth / naturalAspect;
      if (drawHeight > height) {
        drawHeight = height;
        drawWidth = drawHeight * naturalAspect;
      }
      const drawX = x + (width - drawWidth) / 2;
      const drawY = logoY + (height - drawHeight) / 2;
      try {
        doc.addImage(logoAsset.dataUrl, 'PNG', drawX, drawY, drawWidth, drawHeight, undefined, 'SLOW');
      } catch {
        try {
          doc.addImage(logoAsset.dataUrl, 'JPEG', drawX, drawY, drawWidth, drawHeight, undefined, 'SLOW');
        } catch {
          // Ignore logo format errors and continue export.
        }
      }
    };

    // Cover page
    doc.setFillColor(backgroundRgb[0], backgroundRgb[1], backgroundRgb[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.rect(0, 0, pageWidth, 58, 'F');
    doc.setFillColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
    doc.rect(0, 58, pageWidth, 4, 'F');

    // Cover logo card: strong contrast + larger area for better readability.
    const coverLogoCardW = 140;
    const coverLogoCardH = 40;
    const coverLogoCardX = (pageWidth - coverLogoCardW) / 2;
    const coverLogoCardY = 7;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(coverLogoCardX, coverLogoCardY, coverLogoCardW, coverLogoCardH, 2.5, 2.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(coverLogoCardX, coverLogoCardY, coverLogoCardW, coverLogoCardH, 2.5, 2.5, 'S');
    addLogo(coverLogoCardX + 4, coverLogoCardY + 4, coverLogoCardW - 8, coverLogoCardH - 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text('Storylogikk', margin, 82);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(15);
    doc.text('Presentasjonsrapport', margin, 92);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(226, 232, 240);
    doc.text(`Prosjekt: ${projectLabel}`, margin, 106);
    doc.text(`Eksportert: ${now.toLocaleString('nb-NO')}`, margin, 113);
    doc.text(`Generert av: ${branding.appName}`, margin, 120);

    const cardsY = 136;
    const cardGap = 4;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    drawMetricCard(margin, cardsY, cardWidth, 24, 'Konsept', `${conceptValidation.score}%`, STATUS_LABELS[state.phaseStatus.concept]);
    drawMetricCard(margin + cardWidth + cardGap, cardsY, cardWidth, 24, 'Logline', `${loglineValidation.score}%`, STATUS_LABELS[state.phaseStatus.logline]);
    drawMetricCard(margin + (cardWidth + cardGap) * 2, cardsY, cardWidth, 24, 'Tema', `${themeValidation.score}%`, STATUS_LABELS[state.phaseStatus.theme]);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 168, contentWidth, 28, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Samlet progresjon', margin + 4, 176);
    doc.setFontSize(22);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`${overallProgress}%`, margin + 4, 189);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Basert på konsept, logline og tema/karakterintensjon.', margin + 34, 189);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text('Konfidensiell arbeidsrapport for kreativ utvikling.', margin, pageHeight - 14);

    // Content pages
    doc.addPage();
    y = 24;
    doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
    doc.line(margin, 16, pageWidth - margin, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('Storylogikk rapport', margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`${branding.appName} • ${projectLabel}`, pageWidth - margin, 12, { align: 'right' });

    // Header logo card on content pages.
    const headerLogoCardW = 72;
    const headerLogoCardH = 16;
    const headerLogoCardX = (pageWidth - headerLogoCardW) / 2;
    const headerLogoCardY = 16.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(headerLogoCardX, headerLogoCardY, headerLogoCardW, headerLogoCardH, 1.8, 1.8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(headerLogoCardX, headerLogoCardY, headerLogoCardW, headerLogoCardH, 1.8, 1.8, 'S');
    addLogo(headerLogoCardX + 2, headerLogoCardY + 2, headerLogoCardW - 4, headerLogoCardH - 4);

    addHeading('Storylogikk - Skrivekort');
    addBodyText(`Eksportert: ${now.toLocaleString('nb-NO')}`);
    y += 1;

    addSection('Konsept', 'Fase 1 • Validerer ideen før skriving.');
    addField(
      'Sjanger',
      `${nbLabel(state.concept.genre, GENRE_LABELS_NB)}${state.concept.subGenre ? ` (${nbLabel(state.concept.subGenre, SUB_GENRE_LABELS_NB)})` : ''}`
    );
    addField('Tone', state.concept.tone.map((tone) => nbLabel(tone, TONE_LABELS_NB)).join(', '));
    addField(
      'Målgruppe',
      `${safeValue(state.concept.targetAudience)}${state.concept.audienceAge ? ` (${nbLabel(state.concept.audienceAge, AUDIENCE_AGE_LABELS_NB)})` : ''}`
    );
    addField('Kjernepremiss', state.concept.corePremise);
    addField('Hvorfor nå', state.concept.whyNow);
    addField('Unik vinkel', state.concept.uniqueAngle);
    addField('Markedssammenligninger', state.concept.marketComparables);
    y += 1;

    addSection('Logline', 'Fase 2 • Definerer historiens DNA i én sterk pitchlinje.');
    addField('Komplett logline', state.logline.fullLogline);
    addField('Hovedperson', `${safeValue(state.logline.protagonist)} (${safeValue(state.logline.protagonistTrait)})`);
    addField('Mål', state.logline.goal);
    addField('Antagonistisk kraft', state.logline.antagonisticForce);
    addField('Konsekvenser', state.logline.stakes);
    y += 1;

    addSection('Tema og karakterintensjon', 'Fase 3 • Sikrer emosjonell og tematisk retning.');
    addField('Sentralt tema', state.theme.centralTheme);
    addField('Temapåstand', state.theme.themeStatement);
    addField('Moralsk argument', state.theme.moralArgument);
    addField('Protagonistens kjernefeil', state.theme.protagonistFlaw);
    addField('Opprinnelse til feil', state.theme.flawOrigin);
    addField('Hva må endres', state.theme.whatMustChange);
    addField('Transformasjonsbue', state.theme.transformationArc);
    addField(
      'Emosjonell reise',
      state.theme.emotionalJourney.map((emotion) => nbLabel(emotion, EMOTION_LABELS_NB)).join(' -> ')
    );

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 131, 148);
      doc.text(`${branding.appName} • Side ${page}/${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    doc.save(`storylogikk-rapport-${now.toISOString().split('T')[0]}.pdf`);
  }, [
    branding.appName,
    branding.colors.background,
    branding.colors.border,
    branding.colors.primary,
    branding.colors.secondary,
    branding.colors.surface,
    branding.iconUrl,
    branding.logoUrl,
    conceptValidation.score,
    loglineValidation.score,
    overallProgress,
    projectId,
    state.concept,
    state.logline,
    state.phaseStatus.concept,
    state.phaseStatus.logline,
    state.phaseStatus.theme,
    state.theme,
    themeValidation.score,
    loadBrandImageAsset,
  ]);

  // Reset all data
  const resetAll = async () => {
    if (window.confirm('Er du sikker på at du vil nullstille all storylogikkdata?')) {
      setState(DEFAULT_STATE);
      if (projectId) {
        await storyLogicService.deleteStoryLogic(projectId);
        refreshSyncMeta();
      }
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
            Storylogikk-system
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              Valider historiefundamentet før du begynner å skrive
            </Typography>
            {/* Save status indicator (#5) */}
            <Chip
              size="small"
              label={saveStatus === 'saved' ? 'Lagret' : saveStatus === 'saving' ? 'Lagrer…' : saveStatus === 'unsaved' ? 'Ulagret' : 'Frakoblet'}
              sx={{
                height: 20, fontSize: '0.65rem',
                bgcolor: saveStatus === 'saved' ? 'rgba(16,185,129,0.15)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.15)' : saveStatus === 'unsaved' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'saving' ? '#60a5fa' : saveStatus === 'unsaved' ? '#f59e0b' : '#ef4444',
              }}
            />
            <Tooltip title={syncMeta?.lastError || 'Story Logic er bundet til server og prosjekt-session.'}>
              <Chip
                size="small"
                label={syncStatusLabel}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: `${syncStatusColor}22`,
                  color: syncStatusColor,
                  border: `1px solid ${syncStatusColor}55`,
                }}
              />
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Version history (#11) */}
          <Tooltip title="Versjonshistorikk">
            <IconButton
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              sx={{ color: '#6b7280' }}
            >
              <Badge badgeContent={state.versions.length} color="primary" max={9}>
                <HistoryIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          {/* Export button */}
          <Tooltip title="Eksporter som PDF">
            <IconButton onClick={exportPDF} sx={{ color: '#6b7280' }}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Nullstill alt">
            <span>
              <IconButton onClick={resetAll} sx={{ color: '#6b7280' }}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveToStorage}
            disabled={isSaving}
            sx={{
              bgcolor: '#3b82f6',
              '&:hover': { bgcolor: '#2563eb' },
            }}
          >
            {isSaving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </Box>
      </Box>

      {/* Version history panel (#11) */}
      <Collapse in={showVersionHistory}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#fff' }}>Versjonshistorikk</Typography>
            <Button size="small" onClick={() => saveVersion()} startIcon={<SaveIcon />} sx={{ color: '#60a5fa', textTransform: 'none' }}>
              Lagre øyeblikksbilde
            </Button>
          </Box>
          {state.versions.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#6b7280' }}>Ingen versjoner lagret ennå.</Typography>
          ) : (
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {[...state.versions].reverse().map((v) => (
                <Box key={v.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#d4d4d8' }}>{v.label}</Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>{new Date(v.timestamp).toLocaleString()}</Typography>
                  </Box>
                  <Button size="small" onClick={() => restoreVersion(v)} sx={{ color: '#a78bfa', textTransform: 'none', fontSize: '0.7rem' }}>
                    Gjenopprett
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Collapse>

      {/* Premise change alert — soft versioning (#5) */}
      {premiseChangeAlert && (
        <Alert
          severity="info"
          onClose={() => setPremiseChangeAlert(null)}
          action={
            <Button size="small" onClick={() => { saveVersion('Før premissendring'); setPremiseChangeAlert(null); }} sx={{ color: '#60a5fa', textTransform: 'none' }}>
              Lagre versjon
            </Button>
          }
          sx={{ mb: 2, bgcolor: 'rgba(59,130,246,0.08)', color: '#93c5fd', '& .MuiAlert-icon': { color: '#3b82f6' } }}
        >
          {premiseChangeAlert}
        </Alert>
      )}

      {/* Start-With Mode selector — non-linear entry (#10) */}
      {!startMode && overallProgress < 10 && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#d4d4d8', mb: 1.5 }}>
            Hvor vil du starte?
          </Typography>
          <Box sx={starterCardsGridSx}>
            {START_MODES.map((mode) => {
              const Icon = mode.Icon;
              return (
                <Button
                  key={mode.id}
                  variant="outlined"
                  onClick={() => handleStartMode(mode.id)}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: '#d4d4d8',
                    textTransform: 'none',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    width: '100%',
                    minHeight: 92,
                    px: 2, py: 1.5,
                    '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(59,130,246,0.05)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Icon sx={{ fontSize: '1.4rem', color: mode.iconColor }} />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>{mode.label}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#6b7280' }}>{mode.description}</Typography>
                </Button>
              );
            })}
          </Box>
          <Button
            size="small"
            onClick={() => setShowTemplates(!showTemplates)}
            endIcon={showTemplates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#a78bfa', textTransform: 'none', mt: 1.5, fontSize: '0.8rem' }}
          >
            Eller start fra en mal
          </Button>
          <Collapse in={showTemplates}>
            <Box sx={templateCardsGridSx}>
              {STORY_TEMPLATES.map((tpl) => (
                <Chip
                  key={tpl.id}
                  label={tpl.name}
                  onClick={() => applyTemplate(tpl)}
                  onDelete={() => applyTemplate(tpl)}
                  deleteIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    bgcolor: 'rgba(139,92,246,0.08)',
                    color: '#c084fc',
                    border: '1px solid rgba(139,92,246,0.2)',
                    width: '100%',
                    justifyContent: 'space-between',
                    '&:hover': { bgcolor: 'rgba(139,92,246,0.15)' },
                  }}
                />
              ))}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Overall Progress — Confidence Score, not percentage police (#4) */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          bgcolor: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ color: '#d4d4d8' }}>
            Historie-selvtillit
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={getConfidenceTier(overallProgress).label}
              sx={{ bgcolor: `${getConfidenceTier(overallProgress).color}20`, color: getConfidenceTier(overallProgress).color, fontWeight: 600 }}
            />
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              {overallProgress}%
            </Typography>
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={overallProgress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': {
              bgcolor: getEnergyColor(overallProgress),
              borderRadius: 4,
            },
          }}
        />
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Chip
            label={`Konsept: ${STATUS_LABELS[state.phaseStatus.concept]}`}
            size="small"
            sx={{
              bgcolor: `${state.phaseStatus.concept === 'ready' ? '#10b981' : state.phaseStatus.concept === 'weak' ? '#f59e0b' : '#9ca3af'}15`,
              color: state.phaseStatus.concept === 'ready' ? '#10b981' : state.phaseStatus.concept === 'weak' ? '#f59e0b' : '#9ca3af',
            }}
          />
          <Chip
            label={`Logline: ${STATUS_LABELS[state.phaseStatus.logline]}`}
            size="small"
            sx={{
              bgcolor: `${state.phaseStatus.logline === 'ready' ? '#10b981' : state.phaseStatus.logline === 'weak' ? '#f59e0b' : '#9ca3af'}15`,
              color: state.phaseStatus.logline === 'ready' ? '#10b981' : state.phaseStatus.logline === 'weak' ? '#f59e0b' : '#9ca3af',
            }}
          />
          <Chip
            label={`Tema: ${STATUS_LABELS[state.phaseStatus.theme]}`}
            size="small"
            sx={{
              bgcolor: `${state.phaseStatus.theme === 'ready' ? '#10b981' : state.phaseStatus.theme === 'weak' ? '#f59e0b' : '#9ca3af'}15`,
              color: state.phaseStatus.theme === 'ready' ? '#10b981' : state.phaseStatus.theme === 'weak' ? '#f59e0b' : '#9ca3af',
            }}
          />
        </Box>
        {/* Contradiction alerts (#8) */}
        {contradictions.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            {contradictions.map((c, i) => (
              <Alert key={i} severity="warning" icon={<ContradictionIcon />} sx={{ mb: 0.5, bgcolor: 'rgba(245,158,11,0.08)', color: '#fbbf24', py: 0, '& .MuiAlert-icon': { color: '#f59e0b' } }}>
                <Typography variant="caption">{c}</Typography>
              </Alert>
            ))}
          </Box>
        )}
        {state.lastSaved && (
          <Typography variant="caption" sx={{ color: '#6b7280', mt: 1, display: 'block' }}>
            Sist lagret: {new Date(state.lastSaved).toLocaleString()}
          </Typography>
        )}
      </Paper>

      {/* Phase roadmap: clearer structure across all phases */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle1" sx={{ color: '#f4f4f5', mb: 1.5, fontWeight: 600 }}>
          Faseoversikt
        </Typography>
        <Box sx={phaseRoadmapGridSx}>
          {phaseRoadmap.map((phase) => (
            <Box key={phase.key}>
              <Card
                sx={{
                  bgcolor: expandedPhase === phase.index ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)',
                  border: expandedPhase === phase.index ? '1px solid rgba(59,130,246,0.45)' : '1px solid rgba(255,255,255,0.09)',
                  height: '100%',
                }}
              >
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                      Fase {phase.index + 1}
                    </Typography>
                    <Chip
                      size="small"
                      label={STATUS_LABELS[phase.status]}
                      sx={{
                        bgcolor: `${phase.status === 'ready' ? '#10b981' : phase.status === 'weak' ? '#f59e0b' : '#9ca3af'}20`,
                        color: phase.status === 'ready' ? '#10b981' : phase.status === 'weak' ? '#f59e0b' : '#9ca3af',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 1 }}>
                    {phase.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block' }}>
                    Selvtillit: {phase.score}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mb: 1.25 }}>
                    Mangler: {phase.missingFields.length}
                    {phase.missingFields.length > 0 ? ` (${phase.missingFields.slice(0, 2).join(', ')})` : ''}
                  </Typography>
                  {phase.nextBestAction && phase.status !== 'ready' && (
                    <Typography variant="caption" sx={{ color: '#93c5fd', display: 'block', mb: 1.25 }}>
                      Neste: {phase.nextBestAction}
                    </Typography>
                  )}
                  <Button
                    size="small"
                    variant={expandedPhase === phase.index ? 'contained' : 'outlined'}
                    onClick={() => goToPhase(phase.index)}
                    sx={{
                      textTransform: 'none',
                      ...(expandedPhase === phase.index
                        ? { bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }
                        : { color: '#93c5fd', borderColor: 'rgba(147,197,253,0.5)' }),
                    }}
                  >
                    Åpne fase
                  </Button>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Fase 1: Konsept */}
      <Accordion
        expanded={expandedPhase === 0}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            goToPhase(0);
            return;
          }
          setExpandedPhase(-1);
        }}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px !important',
          mb: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
          <PhaseHeader
            number={1}
            title="Konsept"
            purpose="Valider ideen før skriving. Er dette verdt måneders arbeid?"
            icon={<LightbulbIcon sx={{ color: '#fbbf24' }} />}
            status={state.phaseStatus.concept}
            locked={state.locks.concept}
            onToggleLock={() => togglePhaseLock('concept')}
            nextBestAction={state.phaseStatus.concept !== 'ready' && !state.locks.concept ? conceptValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={phaseFormGridSx}>
            {/* Kjernepremiss */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('corePremise')} sx={{ ...getFieldHighlightSx('corePremise') }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Kjernepremiss"
                placeholder="Hva handler historien om i 2-3 setninger? Den grunnleggende ideen."
                value={state.concept.corePremise}
                onChange={(e) => updateConcept('corePremise', e.target.value)}
                disabled={state.locks.concept}
                inputProps={{ 'aria-label': 'Kjernepremiss' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
              </Box>
            </Box>

            {/* Sjanger og undersjanger */}
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Hovedsjanger</InputLabel>
                <Select
                  value={state.concept.genre}
                  label="Hovedsjanger"
                  onChange={(e) => {
                    updateConcept('genre', e.target.value);
                    updateConcept('subGenre', '');
                  }}
                  disabled={state.locks.concept}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                  }}
                >
                  {GENRES.map((genre) => (
                    <MenuItem key={genre} value={genre}>{nbLabel(genre, GENRE_LABELS_NB)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Undersjanger</InputLabel>
                <Select
                  value={safeSubGenreValue}
                  label="Undersjanger"
                  onChange={(e) => updateConcept('subGenre', e.target.value)}
                  disabled={state.locks.concept || !state.concept.genre}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                  }}
                >
                  {availableSubGenres.map((sub) => (
                    <MenuItem key={sub} value={sub}>{nbLabel(sub, SUB_GENRE_LABELS_NB)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Tone Selection */}
            <Box sx={phaseFullSpanSx}>
              <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1 }}>
                Tone (velg 1-3)
              </Typography>
              {/* Genre-based tone presets (C) */}
              {state.concept.genre && GENRE_TONE_PRESETS[state.concept.genre] && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Forslag for {nbLabel(state.concept.genre, GENRE_LABELS_NB)}:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {GENRE_TONE_PRESETS[state.concept.genre].map((combo, i) => (
                      <Chip
                        key={i}
                        label={combo.map((tone) => nbLabel(tone, TONE_LABELS_NB)).join(' + ')}
                        size="small"
                        icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          if (!state.locks.concept) updateConcept('tone', combo);
                        }}
                        disabled={state.locks.concept}
                        sx={{
                          bgcolor: 'rgba(139, 92, 246, 0.1)',
                          color: '#a78bfa',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          '& .MuiChip-icon': { color: '#a78bfa' },
                          '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {/* Grouped tone selection (#7) */}
              {TONE_GROUPS.map((group) => (
                <Box key={group.label} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    {group.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {group.tones.map((tone) => (
                      <Chip
                        key={tone}
                        label={nbLabel(tone, TONE_LABELS_NB)}
                        tabIndex={0}
                        role="checkbox"
                        aria-checked={state.concept.tone.includes(tone)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!state.locks.concept) {
                              const current = state.concept.tone;
                              if (current.includes(tone)) {
                                updateConcept('tone', current.filter(t => t !== tone));
                              } else if (current.length < 3) {
                                updateConcept('tone', [...current, tone]);
                              }
                            }
                          }
                        }}
                        onClick={() => {
                          if (state.locks.concept) return;
                          const current = state.concept.tone;
                          if (current.includes(tone)) {
                            updateConcept('tone', current.filter(t => t !== tone));
                          } else if (current.length < 3) {
                            updateConcept('tone', [...current, tone]);
                          }
                        }}
                        sx={{
                          bgcolor: state.concept.tone.includes(tone) ? '#3b82f620' : 'rgba(255,255,255,0.05)',
                          color: state.concept.tone.includes(tone) ? '#60a5fa' : '#9ca3af',
                          border: state.concept.tone.includes(tone) ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                          cursor: state.locks.concept ? 'not-allowed' : 'pointer',
                          '&:hover': {
                            bgcolor: state.locks.concept ? undefined : '#3b82f610',
                          },
                          '&:focus-visible': { outline: '2px solid #60a5fa', outlineOffset: 2 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Målgruppe */}
            <Box>
              <TextField
                fullWidth
                label="Målgruppe"
                placeholder="Hvem er historien for? Vær konkret."
                value={state.concept.targetAudience}
                onChange={(e) => updateConcept('targetAudience', e.target.value)}
                disabled={state.locks.concept}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Aldersgruppe</InputLabel>
                <Select
                  value={safeAudienceAgeValue}
                  label="Aldersgruppe"
                  onChange={(e) => updateConcept('audienceAge', e.target.value)}
                  disabled={state.locks.concept}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  {AUDIENCE_AGES.map((age) => (
                    <MenuItem key={age} value={age}>{nbLabel(age, AUDIENCE_AGE_LABELS_NB)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Why Now — with field ref and genre examples (#4) */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('whyNow')} sx={{ ...getFieldHighlightSx('whyNow') }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Hvorfor denne historien nå?"
                placeholder="Hva gjør historien relevant i dag? Hvorfor skal publikum bry seg NÅ?"
                value={state.concept.whyNow}
                onChange={(e) => updateConcept('whyNow', e.target.value)}
                disabled={state.locks.concept}
                helperText={FIELD_EXAMPLES.whyNow[state.concept.genre] || FIELD_EXAMPLES.whyNow._default}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': { color: '#6b7280', fontStyle: 'italic' },
                }}
              />
              </Box>
            </Box>

            {/* Unik vinkel — med feltreferanse og sjangereksempler (#4) */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('uniqueAngle')} sx={{ ...getFieldHighlightSx('uniqueAngle') }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Unik vinkel"
                placeholder="Hva gjør DIN versjon av dette konseptet annerledes enn alt annet?"
                value={state.concept.uniqueAngle}
                onChange={(e) => updateConcept('uniqueAngle', e.target.value)}
                disabled={state.locks.concept}
                helperText={FIELD_EXAMPLES.uniqueAngle[state.concept.genre] || FIELD_EXAMPLES.uniqueAngle._default}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': { color: '#6b7280', fontStyle: 'italic' },
                }}
              />
              </Box>
            </Box>

            {/* Markedssammenligninger */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Markedssammenligninger"
                placeholder="f.eks. 'Inception møter The Matrix' eller 'Breaking Bad i motebransjen'"
                value={state.concept.marketComparables}
                onChange={(e) => updateConcept('marketComparables', e.target.value)}
                disabled={state.locks.concept}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
          </Box>

          {showValidation && <ValidationDisplay result={conceptValidation} title="Konsept" onJumpToField={jumpToField} />}

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Fase 1 har {missingConceptFields.length} nøkkelfelt igjen.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => goToPhase(1)}
              sx={{ textTransform: 'none', color: '#93c5fd', borderColor: 'rgba(147,197,253,0.45)' }}
            >
              Neste: Logline
            </Button>
          </Box>

          {/* Reality Check Prompt — concept (#6) */}
          {conceptValidation.score >= 20 && conceptValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <PsychologyIcon sx={{ fontSize: '1rem', color: '#a78bfa', mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                {conceptRealityPrompt}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Fase 2: Logline */}
      <Accordion
        expanded={expandedPhase === 1}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            goToPhase(1);
            return;
          }
          setExpandedPhase(-1);
        }}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px !important',
          mb: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
          <PhaseHeader
            number={2}
            title="Logline"
            purpose="Definer historiens DNA i én setning. Er den svak, bør du ikke gå videre."
            icon={<CreateIcon sx={{ color: '#60a5fa' }} />}
            status={state.phaseStatus.logline}
            locked={state.locks.logline}
            onToggleLock={() => togglePhaseLock('logline')}
            nextBestAction={state.phaseStatus.logline !== 'ready' && !state.locks.logline ? loglineValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Alert
            severity="info"
            sx={{
              mb: 2,
              bgcolor: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              '& .MuiAlert-icon': { color: '#3b82f6' },
            }}
          >
            <strong>Logline-formel:</strong> Når [HOVEDPERSON] må [MÅL], møter hen [ANTAGONISTISK KRAFT] — ellers [KONSEKVENSER].
          </Alert>

          <Box sx={phaseFormGridSx}>
            {/* Hovedperson */}
            <Box>
              <TextField
                fullWidth
                label="Hovedperson"
                placeholder="Hvem er hovedkarakteren? (rolle/yrke)"
                value={state.logline.protagonist}
                onChange={(e) => updateLogline('protagonist', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.protagonist}
                helperText={loglineHasPlaceholders && !state.logline.protagonist ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Definerende trekk"
                placeholder="f.eks. 'utbrent', 'naiv', 'nådeløs'"
                value={state.logline.protagonistTrait}
                onChange={(e) => updateLogline('protagonistTrait', e.target.value)}
                disabled={state.locks.logline}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Goal */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Mål"
                placeholder="Hva må protagonisten oppnå? (handlingsverb + mål)"
                value={state.logline.goal}
                onChange={(e) => updateLogline('goal', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.goal}
                helperText={loglineHasPlaceholders && !state.logline.goal ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Antagonistic Force */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Antagonistisk kraft"
                placeholder="Person, system, indre konflikt eller naturkraft"
                value={state.logline.antagonisticForce}
                onChange={(e) => updateLogline('antagonisticForce', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.antagonisticForce}
                helperText={loglineHasPlaceholders && !state.logline.antagonisticForce ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Stakes */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                label="Konsekvenser"
                placeholder="Hva skjer hvis protagonisten feiler? (konsekvenser)"
                value={state.logline.stakes}
                onChange={(e) => updateLogline('stakes', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.stakes}
                helperText={loglineHasPlaceholders && !state.logline.stakes ? 'Påkrevd for komplett logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Generer-knapp */}
            <Box sx={phaseFullSpanSx}>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={generateLogline}
                disabled={state.locks.logline}
                sx={{
                  borderColor: '#8b5cf6',
                  color: '#a78bfa',
                  '&:hover': {
                    borderColor: '#a78bfa',
                    bgcolor: 'rgba(139, 92, 246, 0.1)',
                  },
                }}
              >
                Generer logline fra komponenter
              </Button>
            </Box>

            {/* Full Logline */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Komplett logline"
                placeholder="Skriv komplett logline her (ideelt 25-50 ord)"
                value={state.logline.fullLogline}
                onChange={(e) => updateLogline('fullLogline', e.target.value)}
                disabled={state.locks.logline}
                helperText={(() => {
                  const wordCount = state.logline.fullLogline.split(/\s+/).filter((w: string) => w).length;
                  const inRange = wordCount >= 25 && wordCount <= 45;
                  const rangeLabel = inRange ? '✓ ideelt område' : wordCount < 25 ? 'fortsett' : 'vurder å korte ned';
                  const missing = missingLoglineFields.length > 0 && loglineHasPlaceholders
                    ? ` — Mangler: ${missingLoglineFields.join(', ')}`
                    : '';
                  return `${wordCount} ord (ideelt: 25–45 · ${rangeLabel})${missing}`;
                })()}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': {
                    color: (() => {
                      const wc = state.logline.fullLogline.split(/\s+/).filter((w: string) => w).length;
                      if (loglineHasPlaceholders && missingLoglineFields.length > 0) return '#f59e0b';
                      if (wc >= 25 && wc <= 45) return '#10b981';
                      return '#9ca3af';
                    })(),
                  },
                }}
              />
            </Box>

            {/* Logline Score */}
            <Box sx={phaseFullSpanSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af' }}>
                  Logline-styrke:
                </Typography>
                <Rating
                  value={Math.round(loglineValidation.score / 20)}
                  readOnly
                  icon={<StarIcon sx={{ color: '#fbbf24' }} />}
                  emptyIcon={<StarIcon sx={{ color: 'rgba(255,255,255,0.2)' }} />}
                />
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  ({loglineValidation.score}%)
                </Typography>
              </Box>
            </Box>
          </Box>

          {showValidation && <ValidationDisplay result={loglineValidation} title="Logline" onJumpToField={jumpToField} />}

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Fase 2 har {missingLoglineRoadmapFields.length} nøkkelfelt igjen.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              onClick={() => goToPhase(2)}
              sx={{ textTransform: 'none', color: '#93c5fd', borderColor: 'rgba(147,197,253,0.45)' }}
            >
              Neste: Tema
            </Button>
          </Box>

          {/* Reality Check Prompt — logline (#6) */}
          {loglineValidation.score >= 20 && loglineValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <PsychologyIcon sx={{ fontSize: '1rem', color: '#a78bfa', mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                {loglineRealityPrompt}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Fase 3: Tema og karakterintensjon */}
      <Accordion
        expanded={expandedPhase === 2}
        onChange={(_, isExpanded) => {
          if (isExpanded) {
            goToPhase(2);
            return;
          }
          setExpandedPhase(-1);
        }}
        sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px !important',
          mb: 2,
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#fff' }} />}>
          <PhaseHeader
            number={3}
            title="Tema og karakterintensjon"
            purpose="Gi historien mening. Dette hindrer at manuset blir hult eller episodisk."
            icon={<PsychologyIcon sx={{ color: '#a78bfa' }} />}
            status={state.phaseStatus.theme}
            locked={state.locks.theme}
            onToggleLock={() => togglePhaseLock('theme')}
            nextBestAction={state.phaseStatus.theme !== 'ready' && !state.locks.theme ? themeValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={phaseFormGridSx}>
            {/* Sentralt tema */}
            <Box>
              <TextField
                fullWidth
                label="Sentralt tema"
                placeholder="f.eks. forsoning, identitet, makt, kjærlighet, offer"
                value={state.theme.centralTheme}
                onChange={(e) => updateTheme('centralTheme', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Moralsk argument"
                placeholder="Hva er historiens standpunkt til temaet?"
                value={state.theme.moralArgument}
                onChange={(e) => updateTheme('moralArgument', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Temapåstand — med feltreferanse og sjangereksempler (#4) */}
            <Box sx={phaseFullSpanSx}>
              <Box ref={registerFieldRef('themeStatement')} sx={{ ...getFieldHighlightSx('themeStatement') }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Temapåstand"
                placeholder="Denne historien argumenterer for at ... (fullfør setningen)"
                value={state.theme.themeStatement}
                onChange={(e) => updateTheme('themeStatement', e.target.value)}
                disabled={state.locks.theme}
                helperText={FIELD_EXAMPLES.themeStatement[state.concept.genre] || FIELD_EXAMPLES.themeStatement._default}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                  '& .MuiFormHelperText-root': { color: '#6b7280', fontStyle: 'italic' },
                }}
              />
              </Box>
            </Box>

            <Box sx={phaseFullSpanSx}>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />
              <Typography variant="subtitle1" sx={{ color: '#fff', mt: 1, mb: 1 }}>
                Karaktertransformasjon
              </Typography>
            </Box>

            {/* Protagonist Flaw */}
            <Box>
              <TextField
                fullWidth
                label="Protagonistens kjernefeil"
                placeholder="Hvilken indre svakhet holder dem tilbake?"
                value={state.theme.protagonistFlaw}
                onChange={(e) => updateTheme('protagonistFlaw', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Opprinnelse til feil"
                placeholder="Hvor kommer denne feilen fra? (bakgrunnshistorie)"
                value={state.theme.flawOrigin}
                onChange={(e) => updateTheme('flawOrigin', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* What Must Change */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Hva må endres innen slutten"
                placeholder="Hvilken tro, atferd eller verdensforståelse må protagonisten forlate eller omfavne?"
                value={state.theme.whatMustChange}
                onChange={(e) => updateTheme('whatMustChange', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Transformasjonsbue */}
            <Box sx={phaseFullSpanSx}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Transformasjonsbue"
                placeholder="Beskriv reisen fra mangelfull start til transformert slutt. Hvordan endrer de seg?"
                value={state.theme.transformationArc}
                onChange={(e) => updateTheme('transformationArc', e.target.value)}
                disabled={state.locks.theme}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Box>

            {/* Emotional Journey */}
            <Box sx={phaseFullSpanSx}>
              <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1 }}>
                Emosjonell reise (velg 3-5 nøkkelfølelser)
              </Typography>
              {/* Genre-based emotion presets (C) */}
              {state.concept.genre && GENRE_EMOTION_PRESETS[state.concept.genre] && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Foreslått bue for {nbLabel(state.concept.genre, GENRE_LABELS_NB)}:
                  </Typography>
                  <Chip
                    label={GENRE_EMOTION_PRESETS[state.concept.genre].map((emotion) => nbLabel(emotion, EMOTION_LABELS_NB)).join(' → ')}
                    size="small"
                    icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      if (!state.locks.theme) updateTheme('emotionalJourney', GENRE_EMOTION_PRESETS[state.concept.genre]);
                    }}
                    disabled={state.locks.theme}
                    sx={{
                      bgcolor: 'rgba(139, 92, 246, 0.1)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      '& .MuiChip-icon': { color: '#a78bfa' },
                      '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                    }}
                  />
                </Box>
              )}
              {/* Grouped emotion selection by act structure (#7) */}
              {EMOTION_GROUPS.map((group) => (
                <Box key={group.label} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600, mb: 0.5, display: 'block' }}>
                    {group.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {group.emotions.map((emotion) => (
                      <Chip
                        key={emotion}
                        label={nbLabel(emotion, EMOTION_LABELS_NB)}
                        tabIndex={0}
                        role="checkbox"
                        aria-checked={state.theme.emotionalJourney.includes(emotion)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (!state.locks.theme) {
                              const current = state.theme.emotionalJourney;
                              if (current.includes(emotion)) {
                                updateTheme('emotionalJourney', current.filter(em => em !== emotion));
                              } else if (current.length < 5) {
                                updateTheme('emotionalJourney', [...current, emotion]);
                              }
                            }
                          }
                        }}
                        onClick={() => {
                          if (state.locks.theme) return;
                          const current = state.theme.emotionalJourney;
                          if (current.includes(emotion)) {
                            updateTheme('emotionalJourney', current.filter(em => em !== emotion));
                          } else if (current.length < 5) {
                            updateTheme('emotionalJourney', [...current, emotion]);
                          }
                        }}
                        sx={{
                          bgcolor: state.theme.emotionalJourney.includes(emotion) ? '#8b5cf620' : 'rgba(255,255,255,0.05)',
                          color: state.theme.emotionalJourney.includes(emotion) ? '#a78bfa' : '#9ca3af',
                          border: state.theme.emotionalJourney.includes(emotion) ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                          cursor: state.locks.theme ? 'not-allowed' : 'pointer',
                          '&:hover': {
                            bgcolor: state.locks.theme ? undefined : '#8b5cf610',
                          },
                          '&:focus-visible': { outline: '2px solid #a78bfa', outlineOffset: 2 },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
              {state.theme.emotionalJourney.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139, 92, 246, 0.1)', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ color: '#a78bfa' }}>
                    Emosjonell bue: {state.theme.emotionalJourney.map((emotion) => nbLabel(emotion, EMOTION_LABELS_NB)).join(' → ')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {showValidation && <ValidationDisplay result={themeValidation} title="Tema" onJumpToField={jumpToField} />}

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9ca3af' }}>
              Fase 3 har {missingThemeFields.length} nøkkelfelt igjen.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => goToPhase(0)}
              sx={{ textTransform: 'none', color: '#93c5fd', borderColor: 'rgba(147,197,253,0.45)' }}
            >
              Se gjennom fase 1
            </Button>
          </Box>

          {/* Reality Check Prompt — theme (#6) */}
          {themeValidation.score >= 20 && themeValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <PsychologyIcon sx={{ fontSize: '1rem', color: '#a78bfa', mt: 0.25, flexShrink: 0 }} aria-hidden />
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                {themeRealityPrompt}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Summary Card — Exit with Confidence (#7) */}
      {overallProgress >= 70 && (
        <Fade in>
          <Card
            sx={{
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CheckIcon sx={{ color: '#10b981', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#10b981' }}>
                    Klar til å skrive
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                    Du er mindre utsatt for å kaste bort sider i førsteutkastet.
                  </Typography>
                </Box>
              </Box>

              {/* Exit-with-Confidence Checklist */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {[
                  { label: 'Konflikt er tydelig', check: (state.logline.antagonisticForce || '').length > 5 },
                  { label: 'Konsekvenser er konkrete', check: (state.logline.stakes || '').length > 10 },
                  { label: 'Karakterbue er definert', check: (state.theme.transformationArc || '').length > 20 },
                  { label: 'Tema er forankret', check: (state.theme.themeStatement || '').length > 20 },
                  { label: 'Logline er komplett', check: (state.logline.fullLogline || '').length > 20 },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {item.check ? (
                      <CheckIcon sx={{ color: '#10b981', fontSize: 18 }} />
                    ) : (
                      <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #4b5563' }} />
                    )}
                    <Typography variant="body2" sx={{ color: item.check ? '#d4d4d8' : '#6b7280' }}>
                      {item.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 2 }} />
              <Typography variant="subtitle2" sx={{ color: '#d4d4d8', mb: 1 }}>
                Oppsummering
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Sjanger:</strong> {nbLabel(state.concept.genre, GENRE_LABELS_NB)} {state.concept.subGenre && `(${nbLabel(state.concept.subGenre, SUB_GENRE_LABELS_NB)})`}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Tone:</strong> {state.concept.tone.map((tone) => nbLabel(tone, TONE_LABELS_NB)).join(', ')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Tema:</strong> {state.theme.centralTheme}
              </Typography>
              {state.logline.fullLogline && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic' }}>
                    "{state.logline.fullLogline}"
                  </Typography>
                </Box>
              )}
              {/* Export button */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={exportPDF}
                  sx={{ color: '#10b981', borderColor: '#10b981', textTransform: 'none' }}
                  variant="outlined"
                >
                  Eksporter PDF
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      )}
    </Box>
  );
};

export default StoryLogicPanel;
