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
import { ContextualNudgeBanner } from '../ContextualNudgeBanner';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Chip,
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
  Grid,
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
  ContentCopy as CopyIcon,
  ArrowForward as ArrowForwardIcon,
  GpsFixed as GpsFixedIcon,
  ReportProblem as ContradictionIcon,
} from '@mui/icons-material';
import { storyLogicService } from '../../services/storyLogicService';

// ============================================================================
// Energy-Aware UX Helpers
// ============================================================================

// Mentor-tone status labels — no "Error", no "Incomplete" (#3 energy-aware)
const STATUS_LABELS: Record<string, string> = {
  incomplete: 'Not clear yet',
  weak: 'Let\u2019s sharpen this',
  ready: 'Ready',
};

// Confidence tier labels — "Story Engine Confidence" not percentages (#4)
function getConfidenceTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High', color: '#10b981' };
  if (score >= 60) return { label: 'Growing', color: '#60a5fa' };
  if (score >= 40) return { label: 'Medium', color: '#f59e0b' };
  if (score >= 20) return { label: 'Emerging', color: '#fb923c' };
  return { label: 'Just started', color: '#9ca3af' };
}

// Energy-aware colors — no red when score is low, use neutral/warm tones (#3)
function getEnergyColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#9ca3af'; // neutral gray, NOT red
}

// Reality Check Prompts — human questions after each phase (#6)
const REALITY_CHECK_PROMPTS: Record<string, string> = {
  concept: 'If a friend asked "What is your movie about?" — could you answer in one breath?',
  logline: 'If someone asked "Why should I care?" — what would you answer in one sentence?',
  theme: 'If the audience leaves the cinema — what\'s the one feeling they carry home?',
};

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
    description: 'High-stakes tension with a ticking clock',
    data: {
      concept: { corePremise: '', genre: 'Thriller', subGenre: 'Psychological', tone: ['Suspenseful', 'Dark'], targetAudience: '', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Fear', 'Anticipation', 'Surprise', 'Relief'], moralArgument: '' },
    },
  },
  {
    id: 'character-drama',
    name: 'Character-Driven Drama',
    description: 'Internal transformation and emotional depth',
    data: {
      concept: { corePremise: '', genre: 'Drama', subGenre: 'Family Drama', tone: ['Serious', 'Melancholic'], targetAudience: '', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Hope', 'Sadness', 'Anger', 'Relief', 'Triumph'], moralArgument: '' },
    },
  },
  {
    id: 'commercial-pitch',
    name: 'Commercial Pitch',
    description: 'High-concept with clear market positioning',
    data: {
      concept: { corePremise: '', genre: 'Action', subGenre: 'Superhero', tone: ['Intense', 'Hopeful'], targetAudience: '', audienceAge: 'Young Adult (18-25)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Anticipation', 'Fear', 'Anger', 'Triumph'], moralArgument: '' },
    },
  },
  {
    id: 'indie-arthouse',
    name: 'Indie Arthouse',
    description: 'Atmospheric, ambiguous, visually driven',
    data: {
      concept: { corePremise: '', genre: 'Drama', subGenre: '', tone: ['Surreal', 'Melancholic'], targetAudience: 'Cinephiles and festival audiences', audienceAge: 'Adult (26-45)', whyNow: '', uniqueAngle: '', marketComparables: '' },
      logline: { protagonist: '', protagonistTrait: '', goal: '', antagonisticForce: '', stakes: '', fullLogline: '', loglineScore: 0 },
      theme: { centralTheme: '', themeStatement: '', protagonistFlaw: '', flawOrigin: '', whatMustChange: '', transformationArc: '', emotionalJourney: ['Sadness', 'Anticipation', 'Surprise', 'Despair'], moralArgument: '' },
    },
  },
];

// Start-with modes for non-linear entry (#10)
type StartMode = 'idea' | 'character' | 'theme';
const START_MODES: { id: StartMode; label: string; icon: string; description: string; initialPhase: number }[] = [
  { id: 'idea', label: 'Start with Idea', icon: '💡', description: 'I have a concept or premise', initialPhase: 0 },
  { id: 'character', label: 'Start with Character', icon: '🎭', description: 'I have a character in mind', initialPhase: 1 },
  { id: 'theme', label: 'Start with Theme', icon: '🧠', description: 'I know the message first', initialPhase: 2 },
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
  { label: 'Mood', tones: ['Dark', 'Light', 'Melancholic', 'Hopeful', 'Nostalgic'] },
  { label: 'Energy', tones: ['Intense', 'Suspenseful', 'Gritty', 'Whimsical', 'Surreal'] },
  { label: 'Style', tones: ['Serious', 'Comedic', 'Satirical', 'Romantic', 'Cynical', 'Inspirational'] },
];

const AUDIENCE_AGES = [
  'Children (Under 12)', 'Teen (13-17)', 'Young Adult (18-25)',
  'Adult (26-45)', 'Mature Adult (46-65)', 'Senior (65+)', 'All Ages'
];

const _EMOTIONAL_JOURNEY_BEATS = [
  'Hope', 'Fear', 'Joy', 'Sadness', 'Anger', 'Surprise', 
  'Disgust', 'Trust', 'Anticipation', 'Love', 'Shame', 
  'Pride', 'Guilt', 'Relief', 'Despair', 'Triumph'
];

// Grouped emotions by story act (#7)
const EMOTION_GROUPS: { label: string; emotions: string[] }[] = [
  { label: 'Act 1 — Setup', emotions: ['Hope', 'Fear', 'Anticipation', 'Trust'] },
  { label: 'Act 2 — Conflict', emotions: ['Anger', 'Sadness', 'Surprise', 'Shame', 'Guilt', 'Disgust'] },
  { label: 'Act 3 — Resolution', emotions: ['Joy', 'Love', 'Pride', 'Relief', 'Triumph', 'Despair'] },
];

// Genre-specific examples library (#4)
const FIELD_EXAMPLES: Record<string, Record<string, string[]>> = {
  uniqueAngle: {
    Drama: [
      'Told entirely through security camera footage',
      'The antagonist is the narrator — and unreliable',
      'Set in a single room over one night',
    ],
    Thriller: [
      'The detective IS the killer — revealed through dual timelines',
      'Entire story unfolds in real-time during a 2-hour flight',
      'Victim and captor switch perspectives each chapter',
    ],
    Comedy: [
      'A mockumentary about the worst wedding planner alive',
      'Told backwards — we see the mess before the setup',
      'Every character believes they\'re the main character',
    ],
    Fantasy: [
      'Magic has an economic cost — spells cause inflation',
      'The "chosen one" is a fraud, the sidekick is the real hero',
      'Dragons are sentient diplomats, not beasts',
    ],
    _default: [
      'Subvert expectations by changing WHO tells the story',
      'Use an unconventional structure (non-linear, epistolary)',
      'Combine genres that rarely mix (e.g., horror + romance)',
    ],
  },
  whyNow: {
    Drama: [
      'Post-pandemic isolation redefines family bonds',
      'AI-driven job loss mirrors Industrial Revolution anxieties',
    ],
    Thriller: [
      'Deepfakes make identity theft a universal fear',
      'Surveillance capitalism gives "being watched" new meaning',
    ],
    _default: [
      'Connect to a social movement or trending concern',
      'Reference a technological shift changing daily life',
      'Tie to a generational experience (Gen Z burnout, boomer legacy)',
    ],
  },
  themeStatement: {
    Drama: [
      'This story argues that forgiveness is not for the offender — it\'s liberation for the wounded.',
      'True strength isn\'t endurance — it\'s knowing when to ask for help.',
    ],
    Thriller: [
      'This story argues that obsession with justice becomes indistinguishable from the crime itself.',
      'The safest lies are the ones we tell ourselves.',
    ],
    _default: [
      'This story argues that [BELIEF] only leads to [CONSEQUENCE], and true [VALUE] requires [SACRIFICE].',
      'Frame as: "The film argues that…" to keep it active and debatable.',
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
    contradictions.push('Target audience "Children" conflicts with dark/gritty tone or Horror genre — reconsider audience or tone.');
  }
  if (isChildren && tones.includes('cynical')) {
    contradictions.push('Cynical tone is unusual for children\'s content — intentional subversion or mismatch?');
  }
  if (concept.whyNow.length > 20 && concept.uniqueAngle.length > 10) {
    const whyGeneric = /relevant|important|timely/i.test(concept.whyNow) && !/because|specifically|unlike/i.test(concept.whyNow);
    const angleGeneric = /unique|different|special|new/i.test(concept.uniqueAngle) && concept.uniqueAngle.length < 40;
    if (whyGeneric && angleGeneric) {
      contradictions.push('"Why Now" and "Unique Angle" are both generic — add specifics to at least one.');
    }
  }
  if (theme.themeStatement.length > 20 && theme.moralArgument.length > 20) {
    const themeWords = new Set(theme.themeStatement.toLowerCase().split(/\s+/));
    const moralWords = new Set(theme.moralArgument.toLowerCase().split(/\s+/));
    const overlap = [...themeWords].filter(w => moralWords.has(w) && w.length > 4).length;
    if (overlap < 2) {
      contradictions.push('Theme statement and moral argument seem disconnected — they should reinforce each other.');
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
    corePremise: 'An ancient troll awakens in modern Norway, forcing a paleontologist to bridge the gap between myth and reality before the military destroys the last remnant of Norse legend.',
    genre: 'Fantasy',
    subGenre: 'Monster/Creature Feature',
    tone: ['Intense', 'Suspenseful', 'Nostalgic'],
    targetAudience: 'Families and fantasy enthusiasts who love Nordic mythology',
    audienceAge: '12+',
    whyNow: 'Rising interest in Scandinavian mythology (Vikings, God of War), climate anxiety awakening dormant threats, and the universal theme of humanity\'s relationship with nature and forgotten traditions.',
    uniqueAngle: 'Unlike typical monster movies where creatures are purely antagonistic, the troll is a sympathetic being seeking home - making the real conflict about preservation vs. destruction of cultural heritage.',
    marketComparables: 'Godzilla (2014) meets The Water Horse, with themes similar to Princess Mononoke. Norwegian kaiju with heart.',
  },
  logline: {
    protagonist: 'Nora Tidemann',
    protagonistTrait: 'brilliant but skeptical',
    goal: 'must protect and guide the ancient troll back to Dovre',
    antagonisticForce: 'a military determined to destroy it and her own disbelief in folklore',
    stakes: 'lose the last living connection to Norway\'s mythological past forever',
    fullLogline: 'When a brilliant but skeptical paleontologist Nora Tidemann must protect and guide the ancient troll back to Dovre, she faces a military determined to destroy it and her own disbelief in folklore—or else lose the last living connection to Norway\'s mythological past forever.',
    loglineScore: 85,
  },
  theme: {
    centralTheme: 'Reconnecting with cultural heritage and the power of belief',
    themeStatement: 'Only by embracing the wisdom of our ancestors can we find our way home.',
    protagonistFlaw: 'Rational skepticism that blinds her to wonder and her estranged relationship with her father who believed in folklore',
    flawOrigin: 'Nora rejected her father\'s stories about trolls as a child, choosing science over tradition, leading to years of distance between them.',
    whatMustChange: 'She must reconcile scientific rationalism with folkloric wisdom, and heal her relationship with her father before it\'s too late.',
    transformationArc: 'From dismissive skeptic who mocks tradition → to reluctant believer who witnesses the impossible → to active protector who bridges past and present',
    emotionalJourney: ['Skepticism', 'Fear', 'Wonder', 'Determination', 'Grief', 'Hope', 'Triumph'],
    moralArgument: 'The film argues that progress without respect for the past leads to destruction, while embracing our heritage gives us the wisdom to face the future.',
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
      suggestions.push('Expand your core premise to include a character and a central conflict.');
    }
  } else {
    warnings.push({ message: 'Core premise is too short or missing.', fieldId: 'corePremise', impact: 'Without a premise, there is no story to develop.', pointsLost: 1 });
  }

  // Genre
  if (concept.genre) {
    score += 1;
  } else {
    warnings.push({ message: 'Select a primary genre.', fieldId: 'genre', impact: 'Genre defines audience expectations and market positioning.', pointsLost: 1 });
  }

  // Tone
  if (concept.tone.length > 0) {
    score += 1;
    if (concept.tone.length > 3) {
      suggestions.push('Consider narrowing your tones to 2-3 for a more focused story.');
    }
  } else {
    warnings.push({ message: 'Select at least one tone for your story.', fieldId: 'tone', impact: 'Tone guides every creative decision — dialogue, visuals, pacing.', pointsLost: 1 });
  }

  // Target audience — signal check for specificity
  if (concept.targetAudience.length > 10) {
    score += 1;
    const isGeneric = /everyone|all people|general audience/i.test(concept.targetAudience);
    if (isGeneric) suggestions.push('"Everyone" is not an audience. Be specific: who will champion this story?');
  } else {
    warnings.push({ message: 'Define your target audience more specifically.', fieldId: 'targetAudience', impact: 'Vague audience = unfocused marketing = no traction.', pointsLost: 1 });
  }

  // Why now — signal check for concrete references
  if (concept.whyNow.length > 20) {
    score += 2;
    const hasConcreteRef = /\b(20\d{2}|pandemic|AI|climate|social media|movement|generation|trend|technology|law|election)\b/i.test(concept.whyNow);
    if (concept.whyNow.length < 50 || !hasConcreteRef) {
      suggestions.push('"Why Now" should reference specific cultural moments, trends, or events.');
    }
  } else {
    warnings.push({ message: '"Why this story now?" needs more thought.', fieldId: 'whyNow', impact: 'Without timely relevance, gatekeepers ask "why should I care?"', pointsLost: 2 });
    coaching.push({ example: 'Climate anxiety + Gen Z activism gives eco-thrillers urgency.', template: 'Because of [CURRENT EVENT/TREND], audiences are primed for stories about [YOUR THEME].', avoid: 'Avoid "it\'s always been relevant" — that\'s a non-answer.' });
  }

  // Unique angle — signal check for specificity (not just "different")
  if (concept.uniqueAngle.length > 20) {
    score += 2;
    const isGenericAngle = /^(it'?s )?(?:unique|different|special|new|fresh|original)\b/i.test(concept.uniqueAngle.trim());
    if (isGenericAngle) {
      suggestions.push('Your unique angle starts with a generic claim. Show HOW it\'s different, don\'t just say it.');
    }
  } else {
    warnings.push({ message: 'What makes YOUR take unique? This is essential.', fieldId: 'uniqueAngle', impact: 'Without a clear differentiator, your story drowns in similar projects.', pointsLost: 2 });
    coaching.push({ example: 'Unlike typical heist films, the crew is all senior citizens with nothing to lose.', template: 'Unlike [CONVENTIONAL APPROACH], this story [SPECIFIC DIFFERENCE] which creates [UNIQUE RESULT].', avoid: 'Avoid "it\'s a unique take" — that tells us nothing.' });
  }

  // Market comparables — signal check for "X meets Y" pattern
  if (concept.marketComparables.length > 10) {
    score += 1;
    const hasPattern = /\b(meets?|cross|like|but|with|plus|×|x)\b/i.test(concept.marketComparables);
    if (!hasPattern) suggestions.push('Use the "X meets Y" formula for comparables (e.g., "Inception meets The Office").');
  } else {
    warnings.push({ message: 'Add market comparables to position your story.', fieldId: 'marketComparables', impact: 'Comparables help producers instantly understand your pitch.', pointsLost: 1 });
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 6;
  const affirmations: string[] = [];
  if (isValid) {
    if (concept.marketComparables.length > 10) affirmations.push('Comparables help position your story in the market.');
    if (concept.whyNow.length >= 50) affirmations.push('"Why Now" is well-articulated — strong relevance angle.');
    if (concept.uniqueAngle.length >= 50) affirmations.push('Unique angle is clearly defined — great differentiator.');
  }

  // Next best action: pick the warning with highest pointsLost
  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Strengthen: ${sorted[0].fieldId === 'whyNow' ? 'Why Now' : sorted[0].fieldId === 'uniqueAngle' ? 'Unique Angle' : sorted[0].fieldId === 'corePremise' ? 'Core Premise' : sorted[0].fieldId === 'marketComparables' ? 'Market Comparables' : sorted[0].fieldId}` : null;

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
    warnings.push({ message: 'Define your protagonist.', fieldId: 'protagonist', impact: 'No protagonist = no one to root for.', pointsLost: 1 });
  }

  // Goal — signal check for action verb
  if (logline.goal.length > 10) {
    score += 1;
    const hasActionVerb = /\b(stop|save|escape|expose|find|destroy|protect|prevent|recover|solve|uncover|survive|win|defeat|rescue|build|prove|convince)\b/i.test(logline.goal);
    if (!hasActionVerb) suggestions.push('Goal should start with an action verb (stop, save, escape, expose, protect…).');
  } else {
    warnings.push({ message: 'What does your protagonist want?', fieldId: 'goal', impact: 'Without a clear goal, the story has no engine.', pointsLost: 1 });
    coaching.push({ example: '"must expose the corruption before the election"', template: 'must [ACTION VERB] the [SPECIFIC OBJECTIVE] before [DEADLINE]', avoid: 'Avoid vague goals like "find themselves" or "figure things out".' });
  }

  // Antagonistic force
  if (logline.antagonisticForce.length > 5) {
    score += 1;
  } else {
    warnings.push({ message: 'Define the antagonistic force.', fieldId: 'antagonisticForce', impact: 'No opposition = no tension = boring story.', pointsLost: 1 });
  }

  // Stakes — signal check for concrete consequences
  if (logline.stakes.length > 10) {
    score += 1.5;
    const hasConcrete = /\b(die|death|lose|destroy|war|prison|homeless|alone|fired|betray|forgotten|extinct|collapse)\b/i.test(logline.stakes);
    if (!hasConcrete) suggestions.push('Stakes feel abstract. Name the specific loss: life, love, freedom, identity?');
  } else {
    warnings.push({ message: 'What happens if the protagonist fails?', fieldId: 'stakes', impact: 'Stakes missing → tension engine collapses.', pointsLost: 1.5 });
    coaching.push({ example: '"or else the entire village will be destroyed"', template: 'or else [SPECIFIC PERSON/THING] will [IRREVERSIBLE CONSEQUENCE]', avoid: 'Avoid "bad things will happen" — name the consequence.' });
  }

  // Full logline quality
  if (logline.fullLogline.length > 30) {
    score += 1.5;
    const hasWhen = /when|after|before/i.test(logline.fullLogline);
    const hasMust = /must|needs to|has to|tries to/i.test(logline.fullLogline);
    const hasOr = /or else|otherwise|before|unless/i.test(logline.fullLogline);
    if (!hasWhen) suggestions.push('Start with "When…" to set up the inciting incident.');
    if (!hasMust) suggestions.push('Include what the protagonist "must" do.');
    if (!hasOr) suggestions.push('Add stakes: "or else…" / "before…" to raise tension.');
  } else {
    warnings.push({ message: 'Write your complete logline (25-50 words).', fieldId: 'fullLogline', impact: 'The logline IS your pitch. No logline = no greenlight.', pointsLost: 1.5 });
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 4.5;
  const affirmations: string[] = [];
  if (isValid && logline.fullLogline.length > 30) {
    const allBeats = /when|after|before/i.test(logline.fullLogline)
      && /must|needs to|has to|tries to/i.test(logline.fullLogline)
      && /or else|otherwise|before|unless/i.test(logline.fullLogline);
    if (allBeats) affirmations.push('Logline hits all structural beats — strong foundation.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Add: ${sorted[0].fieldId === 'fullLogline' ? 'Complete Logline' : sorted[0].fieldId === 'antagonisticForce' ? 'Antagonistic Force' : sorted[0].fieldId.charAt(0).toUpperCase() + sorted[0].fieldId.slice(1)}` : null;

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
    warnings.push({ message: 'Define your central theme.', fieldId: 'centralTheme', impact: 'Theme is the soul — without it, scenes feel random.', pointsLost: 1 });
  }

  if (theme.themeStatement.length > 20) {
    score += 1.5;
    if (!theme.themeStatement.includes('...') && !/argues? that/i.test(theme.themeStatement)) {
      suggestions.push('Frame as: "This story argues that…" to keep it active and debatable.');
    }
  } else {
    warnings.push({ message: 'Write a theme statement.', fieldId: 'themeStatement', impact: 'Without a thesis, the story has no argument.', pointsLost: 1.5 });
    coaching.push({ example: 'This story argues that true courage is admitting vulnerability, not hiding it.', template: 'This story argues that [BELIEF] is/requires [INSIGHT], not [COMMON ASSUMPTION].', avoid: 'Avoid platitudes like "love conquers all" — make it debatable.' });
  }

  if (theme.protagonistFlaw.length > 10) {
    score += 1.5;
  } else {
    warnings.push({ message: 'Define protagonist\'s core flaw.', fieldId: 'protagonistFlaw', impact: 'No flaw = no growth = flat character.', pointsLost: 1.5 });
  }

  if (theme.whatMustChange.length > 15) {
    score += 1.5;
  } else {
    warnings.push({ message: 'Clarify what must change.', fieldId: 'whatMustChange', impact: 'Transformation is the payoff — audience needs to see the shift.', pointsLost: 1.5 });
    coaching.push({ example: 'She must stop blaming others and take ownership of her choices.', template: 'The protagonist must abandon [OLD BELIEF] and embrace [NEW TRUTH].', avoid: 'Avoid "they need to grow" — specify WHAT changes.' });
  }

  if (theme.transformationArc.length > 20) {
    score += 1.5;
    // Signal check: look for progression markers
    const hasProgression = /→|to|from|becomes|evolves|realizes|learns/i.test(theme.transformationArc);
    if (!hasProgression) suggestions.push('Show the arc as "From [X] → to [Y]" to make the transformation concrete.');
  } else {
    warnings.push({ message: 'Describe the transformation arc.', fieldId: 'transformationArc', impact: 'Without a clear arc, the ending feels unearned.', pointsLost: 1.5 });
  }

  if (theme.emotionalJourney.length >= 3) {
    score += 1;
  } else {
    suggestions.push('Map at least 3-5 key emotional beats in your story.');
  }

  const pct = Math.round((score / maxScore) * 100);
  const isValid = score >= 6;
  const affirmations: string[] = [];
  if (isValid) {
    if (theme.transformationArc.length > 50) affirmations.push('Transformation arc is detailed — character journey is clear.');
    if (theme.emotionalJourney.length >= 4) affirmations.push('Rich emotional journey mapped — story will resonate deeply.');
  }

  const sorted = [...warnings].sort((a, b) => b.pointsLost - a.pointsLost);
  const nextBestAction = sorted.length > 0 ? `Clarify: ${sorted[0].fieldId === 'whatMustChange' ? 'What Must Change' : sorted[0].fieldId === 'protagonistFlaw' ? 'Protagonist Flaw' : sorted[0].fieldId === 'themeStatement' ? 'Theme Statement' : sorted[0].fieldId === 'transformationArc' ? 'Transformation Arc' : sorted[0].fieldId}` : null;

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
            Phase {number}: {title}
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
            <Chip size="small" icon={<LockIcon sx={{ fontSize: 14 }} />} label="Locked" sx={{ bgcolor: '#f59e0b20', color: '#f59e0b', '& .MuiChip-icon': { color: '#f59e0b' } }} />
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
      <Tooltip title={locked ? `Unlock ${title}` : status === 'ready' ? `Lock ${title} (ready)` : `Lock ${title}`}>
        <IconButton
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          size="small"
          sx={{ color: locked ? '#f59e0b' : '#6b7280', flexShrink: 0 }}
        >
          {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
        </IconButton>
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
          {title} Confidence
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
            <Typography sx={{ fontSize: '1.1rem', mt: 0.25 }}>🔍</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" sx={{ color: '#9ca3af', fontWeight: 600, letterSpacing: 0.5 }}>
                BIGGEST OPPORTUNITY
              </Typography>
              <Typography variant="body2" sx={{ color: '#e5e7eb', fontWeight: 500, mt: 0.25 }}>
                {topWarning.message}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9ca3af', mt: 0.5, display: 'block', lineHeight: 1.4 }}>
                {topWarning.impact}
              </Typography>
            </Box>
            {onJumpToField && (
              <Tooltip title={`Go to ${topWarning.fieldId}`}>
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
            {showAllFeedback ? 'Focus mode' : `See all feedback (${remainingCount})`}
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
                    <Typography sx={{ fontSize: '0.85rem', mt: 0.1 }}>💡</Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: '#d4d4d8' }}>{w.message}</Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>{w.impact}</Typography>
                    </Box>
                    {onJumpToField && (
                      <IconButton size="small" onClick={() => onJumpToField(w.fieldId)} sx={{ color: '#60a5fa' }}>
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
            {showCoaching ? 'Hide' : 'Show'} mentor tips ({result.coaching.length})
          </Button>
          <Collapse in={showCoaching}>
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(139, 92, 246, 0.06)', borderRadius: 1.5, border: '1px solid rgba(139, 92, 246, 0.15)' }}>
              {result.coaching.map((tip, idx) => (
                <Box key={idx} sx={{ mb: idx < result.coaching.length - 1 ? 2 : 0 }}>
                  <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600 }}>Example:</Typography>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 0.5, fontStyle: 'italic' }}>"{tip.example}"</Typography>
                  <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 600 }}>Template:</Typography>
                  <Typography variant="body2" sx={{ color: '#d4d4d8', mb: 0.5 }}>{tip.template}</Typography>
                  <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>Watch out:</Typography>
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
}

export const StoryLogicPanel: React.FC<StoryLogicPanelProps> = ({
  projectId,
  onSave,
  initialData,
}) => {
  const [state, setState] = useState<StoryLogicState>(initialData || DEFAULT_STATE);
  const [expandedPhase, setExpandedPhase] = useState<number>(0);
  const [showValidation, _setShowValidation] = useState<boolean>(true);
  const [_isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'offline'>('saved');
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [startMode, setStartMode] = useState<StartMode | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [premiseChangeAlert, setPremiseChangeAlert] = useState<string | null>(null);
  const prevPremiseRef = useRef(state.concept.corePremise);

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
        const savedData = await storyLogicService.getStoryLogic(projectId);
        if (savedData) {
          // Migrate old isLocked → locks if needed
          const migrated = {
            ...savedData,
            locks: savedData.locks || { concept: false, logline: false, theme: false },
            versions: savedData.versions || [],
          };
          setState(migrated);
          lastSavedSnapshot.current = JSON.stringify(migrated);
          setSaveStatus('saved');
          console.log('✓ Loaded story logic from database for project:', projectId);
        } else if (projectId.toLowerCase().includes('troll')) {
          setState(TROLL_DEMO_STATE);
          await storyLogicService.saveStoryLogic(projectId, TROLL_DEMO_STATE);
          lastSavedSnapshot.current = JSON.stringify(TROLL_DEMO_STATE);
          console.log('🎬 Initialized TROLL story logic demo data');
        }
      } catch (error) {
        console.error('Failed to load story logic data:', error);
        setSaveStatus('offline');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId, initialData]);

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
      try {
        const dataToSave = { ...state, lastSaved: new Date().toISOString() };
        await storyLogicService.saveStoryLogic(projectId, dataToSave);
        lastSavedSnapshot.current = JSON.stringify(dataToSave);
        setState(prev => ({ ...prev, lastSaved: dataToSave.lastSaved }));
        setSaveStatus('saved');
      } catch {
        setSaveStatus('offline');
      }
    }, 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [state, projectId]);

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
        setPremiseChangeAlert('You changed your core premise significantly. Save as a new version?');
      }
    }
    prevPremiseRef.current = curr;
  }, [state.concept.corePremise]);

  // Apply template (#9)
  const applyTemplate = useCallback((template: StoryTemplate) => {
    if (state.concept.corePremise.length > 20) {
      if (!window.confirm('This will overwrite your current setup with the template. Continue?')) return;
      saveVersion('Before template');
    }
    setState(prev => ({
      ...prev,
      concept: { ...DEFAULT_STATE.concept, ...template.data.concept },
      logline: { ...DEFAULT_STATE.logline, ...template.data.logline },
      theme: { ...DEFAULT_STATE.theme, ...template.data.theme },
    }));
    setShowTemplates(false);
  }, [state.concept.corePremise, saveVersion]);

  // Handle start mode selection (#10 non-linear start)
  const handleStartMode = useCallback((mode: StartMode) => {
    setStartMode(mode);
    const modeConfig = START_MODES.find(m => m.id === mode);
    if (modeConfig) setExpandedPhase(modeConfig.initialPhase);
  }, []);

  // Save to database
  const saveToStorage = useCallback(async () => {
    if (!projectId) return;
    
    setIsSaving(true);
    const dataToSave = { ...state, lastSaved: new Date().toISOString() };
    
    try {
      await storyLogicService.saveStoryLogic(projectId, dataToSave);
      setState(dataToSave);
      onSave?.(dataToSave);
      console.log('✓ Story logic saved for project:', projectId);
    } catch (error) {
      console.error('Failed to save story logic:', error);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, state, onSave]);

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
    if (!state.logline.protagonist) missing.push('Protagonist');
    if (!state.logline.goal) missing.push('Goal');
    if (!state.logline.antagonisticForce) missing.push('Antagonistic Force');
    if (!state.logline.stakes) missing.push('Stakes');
    return missing;
  }, [state.logline.protagonist, state.logline.goal, state.logline.antagonisticForce, state.logline.stakes]);

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

  // Generate logline from components — best-effort with placeholders for missing fields (D)
  const generateLogline = useCallback(() => {
    if (state.locks.logline) return;
    setState(prev => {
      const { protagonist, protagonistTrait, goal, antagonisticForce, stakes } = prev.logline;
      const prot = protagonist || '[PROTAGONIST]';
      const g = goal || '[DEFINE GOAL]';
      const ant = antagonisticForce || '[ANTAGONISTIC FORCE]';
      const st = stakes || '[DEFINE STAKES]';
      const trait = protagonistTrait ? `a ${protagonistTrait} ` : '';
      const generated = `When ${trait}${prot} must ${g}, they face ${ant}—or else ${st}.`;
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

  // Restore version (#11)
  const restoreVersion = useCallback((version: StoryVersion) => {
    if (!window.confirm(`Restore "${version.label}"? Current work will be saved as a version first.`)) return;
    saveVersion('Before restore');
    try {
      const snap = JSON.parse(version.snapshot);
      setState(prev => ({ ...prev, concept: snap.concept, logline: snap.logline, theme: snap.theme }));
    } catch { /* invalid snapshot */ }
  }, [saveVersion]);

  // Export as JSON (#10)
  const exportJSON = useCallback(() => {
    const data = { concept: state.concept, logline: state.logline, theme: state.theme, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'story-logic.json'; a.click();
    URL.revokeObjectURL(url);
  }, [state.concept, state.logline, state.theme]);

  // Export as Markdown writer's card (#10)
  const exportMarkdown = useCallback(() => {
    const md = [
      '# Story Logic — Writer\'s Card',
      '',
      `**Genre:** ${state.concept.genre} ${state.concept.subGenre ? `(${state.concept.subGenre})` : ''}`,
      `**Tone:** ${state.concept.tone.join(', ')}`,
      `**Audience:** ${state.concept.targetAudience} (${state.concept.audienceAge})`,
      '',
      '## Concept',
      state.concept.corePremise,
      '',
      `**Why Now:** ${state.concept.whyNow}`,
      `**Unique Angle:** ${state.concept.uniqueAngle}`,
      `**Comparables:** ${state.concept.marketComparables}`,
      '',
      '## Logline',
      `> ${state.logline.fullLogline}`,
      '',
      `**Protagonist:** ${state.logline.protagonist} (${state.logline.protagonistTrait})`,
      `**Goal:** ${state.logline.goal}`,
      `**Antagonist:** ${state.logline.antagonisticForce}`,
      `**Stakes:** ${state.logline.stakes}`,
      '',
      '## Theme & Character',
      `**Theme:** ${state.theme.centralTheme}`,
      `**Statement:** ${state.theme.themeStatement}`,
      `**Moral Argument:** ${state.theme.moralArgument}`,
      `**Flaw:** ${state.theme.protagonistFlaw} (${state.theme.flawOrigin})`,
      `**Must Change:** ${state.theme.whatMustChange}`,
      `**Arc:** ${state.theme.transformationArc}`,
      `**Emotional Journey:** ${state.theme.emotionalJourney.join(' → ')}`,
      '',
      `---`,
      `*Exported ${new Date().toLocaleString()}*`,
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'story-logic-card.md'; a.click();
    URL.revokeObjectURL(url);
  }, [state.concept, state.logline, state.theme]);

  // Reset all data
  const resetAll = async () => {
    if (window.confirm('Are you sure you want to reset all Story Logic data?')) {
      setState(DEFAULT_STATE);
      if (projectId) {
        await storyLogicService.deleteStoryLogic(projectId);
      }
    }
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <ContextualNudgeBanner context="story-logic" accentColor="#ec4899" />
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
            Story Logic System
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              Validate your story foundation before writing
            </Typography>
            {/* Save status indicator (#5) */}
            <Chip
              size="small"
              label={saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : 'Offline'}
              sx={{
                height: 20, fontSize: '0.65rem',
                bgcolor: saveStatus === 'saved' ? 'rgba(16,185,129,0.15)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.15)' : saveStatus === 'unsaved' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'saving' ? '#60a5fa' : saveStatus === 'unsaved' ? '#f59e0b' : '#ef4444',
              }}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Version history (#11) */}
          <Tooltip title="Version history">
            <IconButton
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              sx={{ color: '#6b7280' }}
            >
              <Badge badgeContent={state.versions.length} color="primary" max={9}>
                <HistoryIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          {/* Export buttons (#10) */}
          <Tooltip title="Export as Markdown">
            <IconButton onClick={exportMarkdown} sx={{ color: '#6b7280' }}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export as JSON">
            <IconButton onClick={exportJSON} sx={{ color: '#6b7280' }}>
              <CopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset all">
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
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>

      {/* Version history panel (#11) */}
      <Collapse in={showVersionHistory}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#fff' }}>Version History</Typography>
            <Button size="small" onClick={() => saveVersion()} startIcon={<SaveIcon />} sx={{ color: '#60a5fa', textTransform: 'none' }}>
              Save Snapshot
            </Button>
          </Box>
          {state.versions.length === 0 ? (
            <Typography variant="caption" sx={{ color: '#6b7280' }}>No versions saved yet.</Typography>
          ) : (
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {[...state.versions].reverse().map((v) => (
                <Box key={v.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#d4d4d8' }}>{v.label}</Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>{new Date(v.timestamp).toLocaleString()}</Typography>
                  </Box>
                  <Button size="small" onClick={() => restoreVersion(v)} sx={{ color: '#a78bfa', textTransform: 'none', fontSize: '0.7rem' }}>
                    Restore
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
            <Button size="small" onClick={() => { saveVersion('Before premise change'); setPremiseChangeAlert(null); }} sx={{ color: '#60a5fa', textTransform: 'none' }}>
              Save version
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
            Where do you want to begin?
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {START_MODES.map((mode) => (
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
                  px: 2, py: 1.5,
                  '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(59,130,246,0.05)' },
                }}
              >
                <Typography sx={{ fontSize: '1.2rem', mb: 0.5 }}>{mode.icon} {mode.label}</Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>{mode.description}</Typography>
              </Button>
            ))}
          </Box>
          <Button
            size="small"
            onClick={() => setShowTemplates(!showTemplates)}
            endIcon={showTemplates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ color: '#a78bfa', textTransform: 'none', mt: 1.5, fontSize: '0.8rem' }}
          >
            Or start from a template
          </Button>
          <Collapse in={showTemplates}>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
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
            Story Engine Confidence
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
            label={`Concept: ${STATUS_LABELS[state.phaseStatus.concept]}`}
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
            label={`Theme: ${STATUS_LABELS[state.phaseStatus.theme]}`}
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
            Last saved: {new Date(state.lastSaved).toLocaleString()}
          </Typography>
        )}
      </Paper>

      {/* Phase 1: Concept */}
      <Accordion
        expanded={expandedPhase === 0}
        onChange={() => setExpandedPhase(expandedPhase === 0 ? -1 : 0)}
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
            title="Concept"
            purpose="Validate the idea before any writing. Is this worth months of work?"
            icon={<LightbulbIcon sx={{ color: '#fbbf24' }} />}
            status={state.phaseStatus.concept}
            locked={state.locks.concept}
            onToggleLock={() => togglePhaseLock('concept')}
            nextBestAction={state.phaseStatus.concept !== 'ready' && !state.locks.concept ? conceptValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Core Premise */}
            <Grid size={12}>
              <Box ref={registerFieldRef('corePremise')} sx={{ ...getFieldHighlightSx('corePremise') }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Core Premise"
                placeholder="What is your story about in 2-3 sentences? The fundamental idea."
                value={state.concept.corePremise}
                onChange={(e) => updateConcept('corePremise', e.target.value)}
                disabled={state.locks.concept}
                inputProps={{ 'aria-label': 'Core Premise' }}
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
            </Grid>

            {/* Genre & Sub-Genre */}
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Primary Genre</InputLabel>
                <Select
                  value={state.concept.genre}
                  label="Primary Genre"
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
                    <MenuItem key={genre} value={genre}>{genre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Sub-Genre</InputLabel>
                <Select
                  value={state.concept.subGenre}
                  label="Sub-Genre"
                  onChange={(e) => updateConcept('subGenre', e.target.value)}
                  disabled={state.locks.concept || !state.concept.genre}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                  }}
                >
                  {(SUB_GENRES[state.concept.genre] || []).map((sub) => (
                    <MenuItem key={sub} value={sub}>{sub}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Tone Selection */}
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1 }}>
                Tone (select 1-3)
              </Typography>
              {/* Genre-based tone presets (C) */}
              {state.concept.genre && GENRE_TONE_PRESETS[state.concept.genre] && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Suggested for {state.concept.genre}:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {GENRE_TONE_PRESETS[state.concept.genre].map((combo, i) => (
                      <Chip
                        key={i}
                        label={combo.join(' + ')}
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
                        label={tone}
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
            </Grid>

            {/* Target Audience */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Target Audience"
                placeholder="Who is this story for? Be specific."
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9ca3af' }}>Audience Age Range</InputLabel>
                <Select
                  value={state.concept.audienceAge}
                  label="Audience Age Range"
                  onChange={(e) => updateConcept('audienceAge', e.target.value)}
                  disabled={state.locks.concept}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  {AUDIENCE_AGES.map((age) => (
                    <MenuItem key={age} value={age}>{age}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Why Now — with field ref and genre examples (#4) */}
            <Grid size={12}>
              <Box ref={registerFieldRef('whyNow')} sx={{ ...getFieldHighlightSx('whyNow') }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Why This Story Now?"
                placeholder="What makes this story relevant today? Why should audiences care RIGHT NOW?"
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
            </Grid>

            {/* Unique Angle — with field ref and genre examples (#4) */}
            <Grid size={12}>
              <Box ref={registerFieldRef('uniqueAngle')} sx={{ ...getFieldHighlightSx('uniqueAngle') }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Unique Angle"
                placeholder="What makes YOUR take on this concept different from everything else?"
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
            </Grid>

            {/* Market Comparables */}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Market Comparables"
                placeholder="e.g., 'Inception meets The Matrix' or 'Breaking Bad in the fashion industry'"
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
            </Grid>
          </Grid>

          {showValidation && <ValidationDisplay result={conceptValidation} title="Concept" onJumpToField={jumpToField} />}

          {/* Reality Check Prompt — concept (#6) */}
          {conceptValidation.score >= 20 && conceptValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)' }}>
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                🧠 {REALITY_CHECK_PROMPTS.concept[Math.floor(Math.random() * REALITY_CHECK_PROMPTS.concept.length) % REALITY_CHECK_PROMPTS.concept.length]}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Phase 2: Logline */}
      <Accordion
        expanded={expandedPhase === 1}
        onChange={() => setExpandedPhase(expandedPhase === 1 ? -1 : 1)}
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
            purpose="Define story DNA in one sentence. If it's weak, do not proceed."
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
            <strong>Logline Formula:</strong> When [PROTAGONIST] must [GOAL], they face [ANTAGONISTIC FORCE]—or else [STAKES].
          </Alert>

          <Grid container spacing={2}>
            {/* Protagonist */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Protagonist"
                placeholder="Who is your main character? (role/occupation)"
                value={state.logline.protagonist}
                onChange={(e) => updateLogline('protagonist', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.protagonist}
                helperText={loglineHasPlaceholders && !state.logline.protagonist ? 'Required for complete logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Defining Trait"
                placeholder="e.g., 'burnt-out', 'naive', 'ruthless'"
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
            </Grid>

            {/* Goal */}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Goal"
                placeholder="What must the protagonist achieve? (action verb + objective)"
                value={state.logline.goal}
                onChange={(e) => updateLogline('goal', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.goal}
                helperText={loglineHasPlaceholders && !state.logline.goal ? 'Required for complete logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Grid>

            {/* Antagonistic Force */}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Antagonistic Force"
                placeholder="Person, system, internal struggle, or force of nature"
                value={state.logline.antagonisticForce}
                onChange={(e) => updateLogline('antagonisticForce', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.antagonisticForce}
                helperText={loglineHasPlaceholders && !state.logline.antagonisticForce ? 'Required for complete logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Grid>

            {/* Stakes */}
            <Grid size={12}>
              <TextField
                fullWidth
                label="Stakes"
                placeholder="What happens if the protagonist fails? (consequences)"
                value={state.logline.stakes}
                onChange={(e) => updateLogline('stakes', e.target.value)}
                disabled={state.locks.logline}
                error={loglineHasPlaceholders && !state.logline.stakes}
                helperText={loglineHasPlaceholders && !state.logline.stakes ? 'Required for complete logline' : undefined}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: '#9ca3af' },
                }}
              />
            </Grid>

            {/* Generate Button */}
            <Grid size={12}>
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
                Generate Logline from Components
              </Button>
            </Grid>

            {/* Full Logline */}
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Complete Logline"
                placeholder="Write your complete logline here (25-50 words ideal)"
                value={state.logline.fullLogline}
                onChange={(e) => updateLogline('fullLogline', e.target.value)}
                disabled={state.locks.logline}
                helperText={(() => {
                  const wordCount = state.logline.fullLogline.split(/\s+/).filter((w: string) => w).length;
                  const inRange = wordCount >= 25 && wordCount <= 45;
                  const rangeLabel = inRange ? '✓ ideal range' : wordCount < 25 ? 'keep going' : 'consider trimming';
                  const missing = missingLoglineFields.length > 0 && loglineHasPlaceholders
                    ? ` — Missing: ${missingLoglineFields.join(', ')}`
                    : '';
                  return `${wordCount} words (ideal: 25–45 · ${rangeLabel})${missing}`;
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
            </Grid>

            {/* Logline Score */}
            <Grid size={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#9ca3af' }}>
                  Logline Strength:
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
            </Grid>
          </Grid>

          {showValidation && <ValidationDisplay result={loglineValidation} title="Logline" onJumpToField={jumpToField} />}

          {/* Reality Check Prompt — logline (#6) */}
          {loglineValidation.score >= 20 && loglineValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)' }}>
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                🧠 {REALITY_CHECK_PROMPTS.logline[Math.floor(Math.random() * REALITY_CHECK_PROMPTS.logline.length) % REALITY_CHECK_PROMPTS.logline.length]}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Phase 3: Theme & Character Intent */}
      <Accordion
        expanded={expandedPhase === 2}
        onChange={() => setExpandedPhase(expandedPhase === 2 ? -1 : 2)}
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
            title="Theme & Character Intent"
            purpose="Give the story meaning. This prevents hollow or episodic scripts."
            icon={<PsychologyIcon sx={{ color: '#a78bfa' }} />}
            status={state.phaseStatus.theme}
            locked={state.locks.theme}
            onToggleLock={() => togglePhaseLock('theme')}
            nextBestAction={state.phaseStatus.theme !== 'ready' && !state.locks.theme ? themeValidation.nextBestAction : null}
          />
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Central Theme */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Central Theme"
                placeholder="e.g., redemption, identity, power, love, sacrifice"
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Moral Argument"
                placeholder="What is the story's stance on the theme?"
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
            </Grid>

            {/* Theme Statement — with field ref and genre examples (#4) */}
            <Grid size={12}>
              <Box ref={registerFieldRef('themeStatement')} sx={{ ...getFieldHighlightSx('themeStatement') }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Theme Statement"
                placeholder="This story argues that... (complete the sentence)"
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
            </Grid>

            <Grid size={12}>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />
              <Typography variant="subtitle1" sx={{ color: '#fff', mt: 1, mb: 1 }}>
                Character Transformation
              </Typography>
            </Grid>

            {/* Protagonist Flaw */}
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Protagonist's Core Flaw"
                placeholder="What internal weakness holds them back?"
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
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Flaw Origin"
                placeholder="Where did this flaw come from? (backstory)"
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
            </Grid>

            {/* What Must Change */}
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="What Must Change by the End"
                placeholder="What belief, behavior, or worldview must the protagonist abandon or embrace?"
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
            </Grid>

            {/* Transformation Arc */}
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Transformation Arc"
                placeholder="Describe the journey from flawed beginning to transformed end. How do they change?"
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
            </Grid>

            {/* Emotional Journey */}
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ color: '#9ca3af', mb: 1 }}>
                Emotional Journey Beats (select 3-5 key emotions)
              </Typography>
              {/* Genre-based emotion presets (C) */}
              {state.concept.genre && GENRE_EMOTION_PRESETS[state.concept.genre] && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} /> Suggested arc for {state.concept.genre}:
                  </Typography>
                  <Chip
                    label={GENRE_EMOTION_PRESETS[state.concept.genre].join(' → ')}
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
                        label={emotion}
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
                    Emotional Arc: {state.theme.emotionalJourney.join(' → ')}
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>

          {showValidation && <ValidationDisplay result={themeValidation} title="Theme" onJumpToField={jumpToField} />}

          {/* Reality Check Prompt — theme (#6) */}
          {themeValidation.score >= 20 && themeValidation.score < 70 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(139,92,246,0.06)', borderRadius: 2, borderLeft: '3px solid rgba(139,92,246,0.3)' }}>
              <Typography variant="caption" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>
                🧠 {REALITY_CHECK_PROMPTS.theme[Math.floor(Math.random() * REALITY_CHECK_PROMPTS.theme.length) % REALITY_CHECK_PROMPTS.theme.length]}
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
                    Ready to Write
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                    You are unlikely to waste draft pages.
                  </Typography>
                </Box>
              </Box>

              {/* Exit-with-Confidence Checklist */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {[
                  { label: 'Conflict clear', check: (state.concept.antagonisticForce || '').length > 5 },
                  { label: 'Stakes concrete', check: (state.logline.stakes || '').length > 10 },
                  { label: 'Character arc defined', check: (state.theme.transformationArc || '').length > 20 },
                  { label: 'Theme grounded', check: (state.theme.themeStatement || '').length > 20 },
                  { label: 'Logline complete', check: (state.logline.fullLogline || '').length > 20 },
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
                Summary
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Genre:</strong> {state.concept.genre} {state.concept.subGenre && `(${state.concept.subGenre})`}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Tone:</strong> {state.concept.tone.join(', ')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                <strong>Theme:</strong> {state.theme.centralTheme}
              </Typography>
              {state.logline.fullLogline && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontStyle: 'italic' }}>
                    "{state.logline.fullLogline}"
                  </Typography>
                </Box>
              )}
              {/* Export & Handoff buttons (#10) */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={exportMarkdown}
                  sx={{ color: '#10b981', borderColor: '#10b981', textTransform: 'none' }}
                  variant="outlined"
                >
                  Writer's Card (.md)
                </Button>
                <Button
                  size="small"
                  startIcon={<CopyIcon />}
                  onClick={exportJSON}
                  sx={{ color: '#10b981', borderColor: '#10b981', textTransform: 'none' }}
                  variant="outlined"
                >
                  Export JSON
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
