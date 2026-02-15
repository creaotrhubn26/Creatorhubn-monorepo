/**
 * Script Word Bank Service
 * 
 * Comprehensive vocabulary database for screenplay analysis.
 * Supports Norwegian (Bokmål/Nynorsk) and English.
 * Learns from user feedback to improve detection accuracy.
 */

import settingsService, { getCurrentUserId } from './settingsService';

export type WordCategory = 
  | 'conflict'
  | 'climax'
  | 'exposition'
  | 'resolution'
  | 'rising_action'
  | 'falling_action'
  | 'transition'
  | 'character_development'
  | 'subplot'
  | 'romance'
  | 'comedy'
  | 'horror'
  | 'thriller'
  | 'action'
  | 'drama'
  | 'mystery';

export type EmotionType = 
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'tense'
  | 'sad'
  | 'happy'
  | 'angry'
  | 'fearful'
  | 'surprised'
  | 'disgusted';

export interface WordEntry {
  word: string;
  language: 'en' | 'no' | 'both';
  weight: number; // 0.1 - 1.0, higher = stronger indicator
  userAdded?: boolean;
  addedAt?: string;
  usageCount?: number;
}

export interface WordBankCategory {
  id: WordCategory;
  name: string;
  nameNo: string;
  description: string;
  words: WordEntry[];
}

export interface EmotionCategory {
  id: EmotionType;
  name: string;
  nameNo: string;
  words: WordEntry[];
}

// ============================================================
// CONFLICT WORDS - Scenes with confrontation, arguments, battles
// ============================================================
const CONFLICT_WORDS: WordEntry[] = [
  // Physical conflict - English
  { word: 'fight', language: 'en', weight: 1.0 },
  { word: 'battle', language: 'en', weight: 1.0 },
  { word: 'attack', language: 'en', weight: 1.0 },
  { word: 'punch', language: 'en', weight: 0.9 },
  { word: 'kick', language: 'en', weight: 0.9 },
  { word: 'hit', language: 'en', weight: 0.8 },
  { word: 'strike', language: 'en', weight: 0.9 },
  { word: 'shove', language: 'en', weight: 0.7 },
  { word: 'push', language: 'en', weight: 0.6 },
  { word: 'tackle', language: 'en', weight: 0.8 },
  { word: 'grapple', language: 'en', weight: 0.8 },
  { word: 'wrestle', language: 'en', weight: 0.8 },
  { word: 'struggle', language: 'en', weight: 0.7 },
  { word: 'brawl', language: 'en', weight: 1.0 },
  { word: 'combat', language: 'en', weight: 1.0 },
  { word: 'duel', language: 'en', weight: 1.0 },
  { word: 'clash', language: 'en', weight: 0.9 },
  { word: 'skirmish', language: 'en', weight: 0.9 },
  { word: 'assault', language: 'en', weight: 1.0 },
  { word: 'ambush', language: 'en', weight: 0.9 },
  
  // Physical conflict - Norwegian
  { word: 'slåss', language: 'no', weight: 1.0 },
  { word: 'slår', language: 'no', weight: 0.9 },
  { word: 'kamp', language: 'no', weight: 1.0 },
  { word: 'angriper', language: 'no', weight: 1.0 },
  { word: 'angrep', language: 'no', weight: 1.0 },
  { word: 'slag', language: 'no', weight: 0.9 },
  { word: 'spark', language: 'no', weight: 0.8 },
  { word: 'dytter', language: 'no', weight: 0.7 },
  { word: 'skyver', language: 'no', weight: 0.6 },
  { word: 'slåsskamp', language: 'no', weight: 1.0 },
  { word: 'kampen', language: 'no', weight: 1.0 },
  { word: 'duell', language: 'no', weight: 1.0 },
  { word: 'overfall', language: 'no', weight: 1.0 },
  { word: 'bakhold', language: 'no', weight: 0.9 },
  { word: 'brytekamp', language: 'no', weight: 0.8 },
  { word: 'knyttneve', language: 'no', weight: 0.9 },
  
  // Verbal conflict - English
  { word: 'argue', language: 'en', weight: 0.9 },
  { word: 'argument', language: 'en', weight: 0.9 },
  { word: 'yell', language: 'en', weight: 0.8 },
  { word: 'scream', language: 'en', weight: 0.8 },
  { word: 'shout', language: 'en', weight: 0.8 },
  { word: 'confront', language: 'en', weight: 0.9 },
  { word: 'confrontation', language: 'en', weight: 1.0 },
  { word: 'accuse', language: 'en', weight: 0.8 },
  { word: 'accusation', language: 'en', weight: 0.8 },
  { word: 'blame', language: 'en', weight: 0.7 },
  { word: 'dispute', language: 'en', weight: 0.8 },
  { word: 'quarrel', language: 'en', weight: 0.8 },
  { word: 'disagree', language: 'en', weight: 0.6 },
  { word: 'disagreement', language: 'en', weight: 0.7 },
  { word: 'heated', language: 'en', weight: 0.7 },
  { word: 'furious', language: 'en', weight: 0.9 },
  { word: 'rage', language: 'en', weight: 0.9 },
  { word: 'outburst', language: 'en', weight: 0.8 },
  { word: 'hostile', language: 'en', weight: 0.8 },
  { word: 'hostility', language: 'en', weight: 0.8 },
  { word: 'antagonize', language: 'en', weight: 0.8 },
  { word: 'provoke', language: 'en', weight: 0.7 },
  { word: 'threaten', language: 'en', weight: 0.9 },
  { word: 'threat', language: 'en', weight: 0.9 },
  { word: 'insult', language: 'en', weight: 0.7 },
  { word: 'mock', language: 'en', weight: 0.6 },
  { word: 'taunt', language: 'en', weight: 0.7 },
  { word: 'defy', language: 'en', weight: 0.8 },
  { word: 'defiance', language: 'en', weight: 0.8 },
  { word: 'resist', language: 'en', weight: 0.7 },
  { word: 'resistance', language: 'en', weight: 0.7 },
  { word: 'oppose', language: 'en', weight: 0.7 },
  { word: 'opposition', language: 'en', weight: 0.7 },
  
  // Verbal conflict - Norwegian
  { word: 'krangler', language: 'no', weight: 0.9 },
  { word: 'krangel', language: 'no', weight: 0.9 },
  { word: 'diskuterer', language: 'no', weight: 0.5 },
  { word: 'roper', language: 'no', weight: 0.8 },
  { word: 'skriker', language: 'no', weight: 0.8 },
  { word: 'sint', language: 'no', weight: 0.8 },
  { word: 'sinne', language: 'no', weight: 0.8 },
  { word: 'rasende', language: 'no', weight: 0.9 },
  { word: 'konfronterer', language: 'no', weight: 0.9 },
  { word: 'konfrontasjon', language: 'no', weight: 1.0 },
  { word: 'anklager', language: 'no', weight: 0.8 },
  { word: 'anklage', language: 'no', weight: 0.8 },
  { word: 'bebreider', language: 'no', weight: 0.7 },
  { word: 'truer', language: 'no', weight: 0.9 },
  { word: 'trussel', language: 'no', weight: 0.9 },
  { word: 'fornærmer', language: 'no', weight: 0.7 },
  { word: 'fornærmelse', language: 'no', weight: 0.7 },
  { word: 'håner', language: 'no', weight: 0.7 },
  { word: 'trosser', language: 'no', weight: 0.8 },
  { word: 'motsetter', language: 'no', weight: 0.7 },
  { word: 'motstand', language: 'no', weight: 0.7 },
  { word: 'fiendtlig', language: 'no', weight: 0.8 },
  { word: 'uvennskap', language: 'no', weight: 0.7 },
  { word: 'uenig', language: 'no', weight: 0.6 },
  { word: 'uenighet', language: 'no', weight: 0.7 },
  { word: 'opprørt', language: 'no', weight: 0.8 },
  { word: 'provoserer', language: 'no', weight: 0.7 },
  
  // Emotional tension
  { word: 'tension', language: 'en', weight: 0.7 },
  { word: 'spenning', language: 'no', weight: 0.7 },
  { word: 'intense', language: 'en', weight: 0.6 },
  { word: 'intenst', language: 'no', weight: 0.6 },
  { word: 'bitter', language: 'both', weight: 0.7 },
  { word: 'resentment', language: 'en', weight: 0.7 },
  { word: 'bitterhet', language: 'no', weight: 0.7 },
  { word: 'betrayal', language: 'en', weight: 0.9 },
  { word: 'svik', language: 'no', weight: 0.9 },
  { word: 'forræderi', language: 'no', weight: 0.9 },
  { word: 'deceive', language: 'en', weight: 0.8 },
  { word: 'lurer', language: 'no', weight: 0.7 },
  { word: 'bedrar', language: 'no', weight: 0.8 },
];

// ============================================================
// CLIMAX WORDS - Peak dramatic moments, revelations, turning points
// ============================================================
const CLIMAX_WORDS: WordEntry[] = [
  // Revelations - English
  { word: 'reveal', language: 'en', weight: 1.0 },
  { word: 'revelation', language: 'en', weight: 1.0 },
  { word: 'truth', language: 'en', weight: 0.9 },
  { word: 'discover', language: 'en', weight: 0.8 },
  { word: 'discovery', language: 'en', weight: 0.9 },
  { word: 'uncover', language: 'en', weight: 0.9 },
  { word: 'expose', language: 'en', weight: 0.9 },
  { word: 'unmask', language: 'en', weight: 1.0 },
  { word: 'confess', language: 'en', weight: 0.9 },
  { word: 'confession', language: 'en', weight: 1.0 },
  { word: 'admit', language: 'en', weight: 0.7 },
  { word: 'realize', language: 'en', weight: 0.8 },
  { word: 'realization', language: 'en', weight: 0.9 },
  { word: 'epiphany', language: 'en', weight: 1.0 },
  { word: 'understand', language: 'en', weight: 0.6 },
  { word: 'comprehend', language: 'en', weight: 0.7 },
  { word: 'secret', language: 'en', weight: 0.8 },
  { word: 'hidden', language: 'en', weight: 0.7 },
  { word: 'shocking', language: 'en', weight: 0.9 },
  { word: 'stunned', language: 'en', weight: 0.8 },
  
  // Revelations - Norwegian
  { word: 'avslører', language: 'no', weight: 1.0 },
  { word: 'avsløring', language: 'no', weight: 1.0 },
  { word: 'sannhet', language: 'no', weight: 0.9 },
  { word: 'sannheten', language: 'no', weight: 0.9 },
  { word: 'oppdager', language: 'no', weight: 0.8 },
  { word: 'oppdagelse', language: 'no', weight: 0.9 },
  { word: 'avdekker', language: 'no', weight: 0.9 },
  { word: 'demaskerer', language: 'no', weight: 1.0 },
  { word: 'tilstår', language: 'no', weight: 0.9 },
  { word: 'tilståelse', language: 'no', weight: 1.0 },
  { word: 'innrømmer', language: 'no', weight: 0.7 },
  { word: 'innser', language: 'no', weight: 0.8 },
  { word: 'innsikt', language: 'no', weight: 0.8 },
  { word: 'hemmelighet', language: 'no', weight: 0.8 },
  { word: 'skjult', language: 'no', weight: 0.7 },
  { word: 'sjokkerende', language: 'no', weight: 0.9 },
  { word: 'lamslått', language: 'no', weight: 0.8 },
  { word: 'forstår', language: 'no', weight: 0.6 },
  
  // Showdown/Final confrontation - English
  { word: 'showdown', language: 'en', weight: 1.0 },
  { word: 'final', language: 'en', weight: 0.8 },
  { word: 'ultimate', language: 'en', weight: 0.8 },
  { word: 'climax', language: 'en', weight: 1.0 },
  { word: 'culmination', language: 'en', weight: 1.0 },
  { word: 'peak', language: 'en', weight: 0.7 },
  { word: 'pinnacle', language: 'en', weight: 0.8 },
  { word: 'decisive', language: 'en', weight: 0.9 },
  { word: 'determining', language: 'en', weight: 0.7 },
  { word: 'fateful', language: 'en', weight: 0.9 },
  { word: 'critical', language: 'en', weight: 0.7 },
  { word: 'crucial', language: 'en', weight: 0.8 },
  { word: 'pivotal', language: 'en', weight: 0.9 },
  { word: 'turning point', language: 'en', weight: 1.0 },
  { word: 'moment of truth', language: 'en', weight: 1.0 },
  { word: 'do or die', language: 'en', weight: 1.0 },
  { word: 'now or never', language: 'en', weight: 0.9 },
  { word: 'all-out', language: 'en', weight: 0.8 },
  { word: 'life or death', language: 'en', weight: 1.0 },
  
  // Showdown - Norwegian
  { word: 'oppgjør', language: 'no', weight: 1.0 },
  { word: 'endelig', language: 'no', weight: 0.8 },
  { word: 'avgjørende', language: 'no', weight: 0.9 },
  { word: 'skjebnesvangert', language: 'no', weight: 0.9 },
  { word: 'kritisk', language: 'no', weight: 0.7 },
  { word: 'avgjørelse', language: 'no', weight: 0.8 },
  { word: 'vendepunkt', language: 'no', weight: 1.0 },
  { word: 'sannhetens øyeblikk', language: 'no', weight: 1.0 },
  { word: 'nå eller aldri', language: 'no', weight: 0.9 },
  { word: 'liv eller død', language: 'no', weight: 1.0 },
  { word: 'alt står på spill', language: 'no', weight: 1.0 },
  { word: 'høydepunkt', language: 'no', weight: 0.9 },
  { word: 'kulminasjon', language: 'no', weight: 1.0 },
  { word: 'toppen', language: 'no', weight: 0.6 },
  
  // Intense emotions at climax
  { word: 'desperate', language: 'both', weight: 0.8 },
  { word: 'desperation', language: 'en', weight: 0.9 },
  { word: 'desperasjon', language: 'no', weight: 0.9 },
  { word: 'frantic', language: 'en', weight: 0.8 },
  { word: 'frenetisk', language: 'no', weight: 0.8 },
  { word: 'panicked', language: 'en', weight: 0.8 },
  { word: 'panic', language: 'en', weight: 0.8 },
  { word: 'panikk', language: 'no', weight: 0.8 },
  { word: 'terror', language: 'both', weight: 0.9 },
  { word: 'horrified', language: 'en', weight: 0.8 },
  { word: 'forferdet', language: 'no', weight: 0.8 },
  { word: 'overwhelmed', language: 'en', weight: 0.7 },
  { word: 'overveldet', language: 'no', weight: 0.7 },
];

// ============================================================
// EXPOSITION WORDS - Scene setup, introductions, world-building
// ============================================================
const EXPOSITION_WORDS: WordEntry[] = [
  // Introductions - English
  { word: 'introduce', language: 'en', weight: 1.0 },
  { word: 'introduction', language: 'en', weight: 1.0 },
  { word: 'meet', language: 'en', weight: 0.8 },
  { word: 'greet', language: 'en', weight: 0.7 },
  { word: 'welcome', language: 'en', weight: 0.7 },
  { word: 'arrive', language: 'en', weight: 0.7 },
  { word: 'arrival', language: 'en', weight: 0.7 },
  { word: 'enter', language: 'en', weight: 0.6 },
  { word: 'first', language: 'en', weight: 0.7 },
  { word: 'begin', language: 'en', weight: 0.8 },
  { word: 'beginning', language: 'en', weight: 0.8 },
  { word: 'start', language: 'en', weight: 0.7 },
  { word: 'open', language: 'en', weight: 0.6 },
  { word: 'opening', language: 'en', weight: 0.7 },
  { word: 'establish', language: 'en', weight: 0.9 },
  { word: 'establishing', language: 'en', weight: 1.0 },
  { word: 'setup', language: 'en', weight: 0.9 },
  { word: 'set up', language: 'en', weight: 0.9 },
  
  // Introductions - Norwegian
  { word: 'presenterer', language: 'no', weight: 1.0 },
  { word: 'presentasjon', language: 'no', weight: 1.0 },
  { word: 'introduserer', language: 'no', weight: 1.0 },
  { word: 'introduksjon', language: 'no', weight: 1.0 },
  { word: 'møter', language: 'no', weight: 0.8 },
  { word: 'hilser', language: 'no', weight: 0.7 },
  { word: 'velkommen', language: 'no', weight: 0.7 },
  { word: 'ankommer', language: 'no', weight: 0.7 },
  { word: 'ankomst', language: 'no', weight: 0.7 },
  { word: 'trer inn', language: 'no', weight: 0.6 },
  { word: 'først', language: 'no', weight: 0.7 },
  { word: 'begynner', language: 'no', weight: 0.8 },
  { word: 'begynnelse', language: 'no', weight: 0.8 },
  { word: 'starter', language: 'no', weight: 0.7 },
  { word: 'åpner', language: 'no', weight: 0.6 },
  { word: 'åpning', language: 'no', weight: 0.7 },
  { word: 'etablerer', language: 'no', weight: 0.9 },
  { word: 'etablerende', language: 'no', weight: 1.0 },
  { word: 'oppsett', language: 'no', weight: 0.9 },
  
  // Explanation/Context - English
  { word: 'explain', language: 'en', weight: 0.8 },
  { word: 'explanation', language: 'en', weight: 0.8 },
  { word: 'describe', language: 'en', weight: 0.7 },
  { word: 'description', language: 'en', weight: 0.7 },
  { word: 'tell', language: 'en', weight: 0.5 },
  { word: 'narrate', language: 'en', weight: 0.9 },
  { word: 'narrator', language: 'en', weight: 0.9 },
  { word: 'narration', language: 'en', weight: 0.9 },
  { word: 'voiceover', language: 'en', weight: 1.0 },
  { word: 'voice over', language: 'en', weight: 1.0 },
  { word: 'v.o.', language: 'en', weight: 1.0 },
  { word: 'background', language: 'en', weight: 0.7 },
  { word: 'backstory', language: 'en', weight: 0.9 },
  { word: 'history', language: 'en', weight: 0.6 },
  { word: 'context', language: 'en', weight: 0.8 },
  { word: 'setting', language: 'en', weight: 0.8 },
  { word: 'location', language: 'en', weight: 0.6 },
  { word: 'world', language: 'en', weight: 0.6 },
  { word: 'universe', language: 'en', weight: 0.7 },
  { word: 'realm', language: 'en', weight: 0.7 },
  
  // Explanation - Norwegian
  { word: 'forklarer', language: 'no', weight: 0.8 },
  { word: 'forklaring', language: 'no', weight: 0.8 },
  { word: 'beskriver', language: 'no', weight: 0.7 },
  { word: 'beskrivelse', language: 'no', weight: 0.7 },
  { word: 'forteller', language: 'no', weight: 0.7 },
  { word: 'fortellerstemme', language: 'no', weight: 1.0 },
  { word: 'bakgrunn', language: 'no', weight: 0.7 },
  { word: 'bakgrunnshistorie', language: 'no', weight: 0.9 },
  { word: 'historie', language: 'no', weight: 0.5 },
  { word: 'kontekst', language: 'no', weight: 0.8 },
  { word: 'miljø', language: 'no', weight: 0.7 },
  { word: 'sted', language: 'no', weight: 0.5 },
  { word: 'verden', language: 'no', weight: 0.6 },
  { word: 'univers', language: 'no', weight: 0.7 },
  { word: 'rike', language: 'no', weight: 0.6 },
  
  // Time references (often in exposition)
  { word: 'years ago', language: 'en', weight: 0.9 },
  { word: 'long ago', language: 'en', weight: 0.9 },
  { word: 'once upon', language: 'en', weight: 1.0 },
  { word: 'in the beginning', language: 'en', weight: 1.0 },
  { word: 'back then', language: 'en', weight: 0.8 },
  { word: 'originally', language: 'en', weight: 0.7 },
  { word: 'previously', language: 'en', weight: 0.7 },
  { word: 'før i tiden', language: 'no', weight: 0.9 },
  { word: 'for lenge siden', language: 'no', weight: 0.9 },
  { word: 'det var en gang', language: 'no', weight: 1.0 },
  { word: 'i begynnelsen', language: 'no', weight: 1.0 },
  { word: 'den gang', language: 'no', weight: 0.8 },
  { word: 'opprinnelig', language: 'no', weight: 0.7 },
  { word: 'tidligere', language: 'no', weight: 0.6 },
  
  // Character establishment
  { word: 'name is', language: 'en', weight: 0.8 },
  { word: 'called', language: 'en', weight: 0.6 },
  { word: 'known as', language: 'en', weight: 0.7 },
  { word: 'this is', language: 'en', weight: 0.7 },
  { word: 'here is', language: 'en', weight: 0.6 },
  { word: 'heter', language: 'no', weight: 0.8 },
  { word: 'kalles', language: 'no', weight: 0.6 },
  { word: 'kjent som', language: 'no', weight: 0.7 },
  { word: 'dette er', language: 'no', weight: 0.7 },
  { word: 'her er', language: 'no', weight: 0.6 },
];

// ============================================================
// RESOLUTION WORDS - Conclusion, peace, closure, endings
// ============================================================
const RESOLUTION_WORDS: WordEntry[] = [
  // Endings - English
  { word: 'end', language: 'en', weight: 0.8 },
  { word: 'ending', language: 'en', weight: 0.9 },
  { word: 'conclude', language: 'en', weight: 0.9 },
  { word: 'conclusion', language: 'en', weight: 1.0 },
  { word: 'final', language: 'en', weight: 0.7 },
  { word: 'finally', language: 'en', weight: 0.8 },
  { word: 'finish', language: 'en', weight: 0.7 },
  { word: 'finished', language: 'en', weight: 0.7 },
  { word: 'complete', language: 'en', weight: 0.7 },
  { word: 'completed', language: 'en', weight: 0.8 },
  { word: 'over', language: 'en', weight: 0.6 },
  { word: 'done', language: 'en', weight: 0.6 },
  { word: 'close', language: 'en', weight: 0.6 },
  { word: 'closing', language: 'en', weight: 0.7 },
  { word: 'closure', language: 'en', weight: 0.9 },
  { word: 'wrap up', language: 'en', weight: 0.8 },
  { word: 'wind down', language: 'en', weight: 0.8 },
  { word: 'aftermath', language: 'en', weight: 0.9 },
  { word: 'epilogue', language: 'en', weight: 1.0 },
  { word: 'denouement', language: 'en', weight: 1.0 },
  
  // Endings - Norwegian
  { word: 'slutt', language: 'no', weight: 0.8 },
  { word: 'slutten', language: 'no', weight: 0.9 },
  { word: 'avslutter', language: 'no', weight: 0.9 },
  { word: 'avslutning', language: 'no', weight: 1.0 },
  { word: 'endelig', language: 'no', weight: 0.7 },
  { word: 'til slutt', language: 'no', weight: 0.9 },
  { word: 'fullført', language: 'no', weight: 0.8 },
  { word: 'ferdig', language: 'no', weight: 0.6 },
  { word: 'over', language: 'no', weight: 0.5 },
  { word: 'gjort', language: 'no', weight: 0.5 },
  { word: 'lukker', language: 'no', weight: 0.6 },
  { word: 'avsluttende', language: 'no', weight: 0.8 },
  { word: 'epilog', language: 'no', weight: 1.0 },
  { word: 'etterspill', language: 'no', weight: 0.9 },
  
  // Peace/Reconciliation - English
  { word: 'peace', language: 'en', weight: 0.9 },
  { word: 'peaceful', language: 'en', weight: 0.8 },
  { word: 'calm', language: 'en', weight: 0.7 },
  { word: 'quiet', language: 'en', weight: 0.5 },
  { word: 'serene', language: 'en', weight: 0.7 },
  { word: 'reconcile', language: 'en', weight: 1.0 },
  { word: 'reconciliation', language: 'en', weight: 1.0 },
  { word: 'forgive', language: 'en', weight: 0.9 },
  { word: 'forgiveness', language: 'en', weight: 0.9 },
  { word: 'forgiven', language: 'en', weight: 0.9 },
  { word: 'apologize', language: 'en', weight: 0.8 },
  { word: 'apology', language: 'en', weight: 0.8 },
  { word: 'sorry', language: 'en', weight: 0.7 },
  { word: 'understand', language: 'en', weight: 0.6 },
  { word: 'understanding', language: 'en', weight: 0.7 },
  { word: 'accept', language: 'en', weight: 0.7 },
  { word: 'acceptance', language: 'en', weight: 0.8 },
  { word: 'heal', language: 'en', weight: 0.8 },
  { word: 'healing', language: 'en', weight: 0.8 },
  { word: 'healed', language: 'en', weight: 0.8 },
  { word: 'mend', language: 'en', weight: 0.7 },
  { word: 'repair', language: 'en', weight: 0.7 },
  { word: 'restore', language: 'en', weight: 0.8 },
  { word: 'restored', language: 'en', weight: 0.8 },
  
  // Peace/Reconciliation - Norwegian
  { word: 'fred', language: 'no', weight: 0.9 },
  { word: 'fredelig', language: 'no', weight: 0.8 },
  { word: 'rolig', language: 'no', weight: 0.6 },
  { word: 'stille', language: 'no', weight: 0.5 },
  { word: 'forsone', language: 'no', weight: 1.0 },
  { word: 'forsoning', language: 'no', weight: 1.0 },
  { word: 'forsonet', language: 'no', weight: 1.0 },
  { word: 'tilgir', language: 'no', weight: 0.9 },
  { word: 'tilgivelse', language: 'no', weight: 0.9 },
  { word: 'tilgitt', language: 'no', weight: 0.9 },
  { word: 'unnskylder', language: 'no', weight: 0.8 },
  { word: 'unnskyldning', language: 'no', weight: 0.8 },
  { word: 'beklager', language: 'no', weight: 0.7 },
  { word: 'aksepterer', language: 'no', weight: 0.7 },
  { word: 'aksept', language: 'no', weight: 0.7 },
  { word: 'helbreder', language: 'no', weight: 0.8 },
  { word: 'helbredelse', language: 'no', weight: 0.8 },
  { word: 'leget', language: 'no', weight: 0.7 },
  { word: 'reparerer', language: 'no', weight: 0.7 },
  { word: 'gjenoppretter', language: 'no', weight: 0.8 },
  
  // Resolution/Solution - English
  { word: 'resolve', language: 'en', weight: 0.9 },
  { word: 'resolved', language: 'en', weight: 0.9 },
  { word: 'resolution', language: 'en', weight: 1.0 },
  { word: 'solve', language: 'en', weight: 0.8 },
  { word: 'solved', language: 'en', weight: 0.8 },
  { word: 'solution', language: 'en', weight: 0.8 },
  { word: 'answer', language: 'en', weight: 0.7 },
  { word: 'answered', language: 'en', weight: 0.7 },
  { word: 'fix', language: 'en', weight: 0.6 },
  { word: 'fixed', language: 'en', weight: 0.7 },
  { word: 'settle', language: 'en', weight: 0.8 },
  { word: 'settled', language: 'en', weight: 0.8 },
  { word: 'agreement', language: 'en', weight: 0.8 },
  { word: 'agree', language: 'en', weight: 0.7 },
  { word: 'compromise', language: 'en', weight: 0.8 },
  { word: 'truce', language: 'en', weight: 0.9 },
  
  // Resolution/Solution - Norwegian
  { word: 'løser', language: 'no', weight: 0.9 },
  { word: 'løst', language: 'no', weight: 0.9 },
  { word: 'løsning', language: 'no', weight: 1.0 },
  { word: 'svar', language: 'no', weight: 0.7 },
  { word: 'fikser', language: 'no', weight: 0.6 },
  { word: 'fikset', language: 'no', weight: 0.7 },
  { word: 'ordner', language: 'no', weight: 0.7 },
  { word: 'ordnet', language: 'no', weight: 0.7 },
  { word: 'avtale', language: 'no', weight: 0.8 },
  { word: 'enighet', language: 'no', weight: 0.8 },
  { word: 'enig', language: 'no', weight: 0.7 },
  { word: 'kompromiss', language: 'no', weight: 0.8 },
  { word: 'våpenhvile', language: 'no', weight: 0.9 },
  
  // Happy endings
  { word: 'happy', language: 'en', weight: 0.7 },
  { word: 'happiness', language: 'en', weight: 0.7 },
  { word: 'happily', language: 'en', weight: 0.8 },
  { word: 'joy', language: 'en', weight: 0.7 },
  { word: 'joyful', language: 'en', weight: 0.7 },
  { word: 'celebrate', language: 'en', weight: 0.8 },
  { word: 'celebration', language: 'en', weight: 0.8 },
  { word: 'triumph', language: 'en', weight: 0.9 },
  { word: 'triumphant', language: 'en', weight: 0.9 },
  { word: 'victory', language: 'en', weight: 0.9 },
  { word: 'victorious', language: 'en', weight: 0.9 },
  { word: 'win', language: 'en', weight: 0.7 },
  { word: 'won', language: 'en', weight: 0.8 },
  { word: 'together', language: 'en', weight: 0.7 },
  { word: 'reunion', language: 'en', weight: 0.9 },
  { word: 'reunited', language: 'en', weight: 0.9 },
  { word: 'embrace', language: 'en', weight: 0.7 },
  { word: 'hug', language: 'en', weight: 0.6 },
  { word: 'kiss', language: 'en', weight: 0.6 },
  { word: 'wedding', language: 'en', weight: 0.8 },
  { word: 'married', language: 'en', weight: 0.7 },
  { word: 'ever after', language: 'en', weight: 1.0 },
  
  // Happy endings - Norwegian
  { word: 'lykkelig', language: 'no', weight: 0.7 },
  { word: 'lykke', language: 'no', weight: 0.7 },
  { word: 'glede', language: 'no', weight: 0.7 },
  { word: 'feirer', language: 'no', weight: 0.8 },
  { word: 'feiring', language: 'no', weight: 0.8 },
  { word: 'triumf', language: 'no', weight: 0.9 },
  { word: 'seier', language: 'no', weight: 0.9 },
  { word: 'vinner', language: 'no', weight: 0.7 },
  { word: 'vant', language: 'no', weight: 0.8 },
  { word: 'sammen', language: 'no', weight: 0.7 },
  { word: 'gjenforening', language: 'no', weight: 0.9 },
  { word: 'gjenforent', language: 'no', weight: 0.9 },
  { word: 'omfavnelse', language: 'no', weight: 0.7 },
  { word: 'klem', language: 'no', weight: 0.6 },
  { word: 'kyss', language: 'no', weight: 0.6 },
  { word: 'bryllup', language: 'no', weight: 0.8 },
  { word: 'gift', language: 'no', weight: 0.7 },
  { word: 'alle sine dager', language: 'no', weight: 1.0 },
];

// ============================================================
// RISING ACTION WORDS - Building tension, complications, stakes
// ============================================================
const RISING_ACTION_WORDS: WordEntry[] = [
  // Building tension - English
  { word: 'tension', language: 'en', weight: 0.9 },
  { word: 'tense', language: 'en', weight: 0.8 },
  { word: 'suspense', language: 'en', weight: 1.0 },
  { word: 'suspenseful', language: 'en', weight: 1.0 },
  { word: 'mounting', language: 'en', weight: 0.8 },
  { word: 'building', language: 'en', weight: 0.7 },
  { word: 'escalate', language: 'en', weight: 0.9 },
  { word: 'escalating', language: 'en', weight: 0.9 },
  { word: 'escalation', language: 'en', weight: 0.9 },
  { word: 'intensify', language: 'en', weight: 0.9 },
  { word: 'intensifying', language: 'en', weight: 0.9 },
  { word: 'increase', language: 'en', weight: 0.6 },
  { word: 'increasing', language: 'en', weight: 0.6 },
  { word: 'grow', language: 'en', weight: 0.5 },
  { word: 'growing', language: 'en', weight: 0.6 },
  { word: 'worsen', language: 'en', weight: 0.8 },
  { word: 'worsening', language: 'en', weight: 0.8 },
  { word: 'deteriorate', language: 'en', weight: 0.8 },
  { word: 'deteriorating', language: 'en', weight: 0.8 },
  { word: 'spiral', language: 'en', weight: 0.8 },
  { word: 'spiraling', language: 'en', weight: 0.8 },
  
  // Building tension - Norwegian
  { word: 'spenning', language: 'no', weight: 0.9 },
  { word: 'spent', language: 'no', weight: 0.8 },
  { word: 'suspens', language: 'no', weight: 1.0 },
  { word: 'eskalerer', language: 'no', weight: 0.9 },
  { word: 'eskalering', language: 'no', weight: 0.9 },
  { word: 'intensiverer', language: 'no', weight: 0.9 },
  { word: 'øker', language: 'no', weight: 0.6 },
  { word: 'økende', language: 'no', weight: 0.7 },
  { word: 'vokser', language: 'no', weight: 0.5 },
  { word: 'voksende', language: 'no', weight: 0.6 },
  { word: 'forverrer', language: 'no', weight: 0.8 },
  { word: 'forverring', language: 'no', weight: 0.8 },
  { word: 'bygger opp', language: 'no', weight: 0.8 },
  { word: 'oppbygging', language: 'no', weight: 0.8 },
  
  // Complications - English
  { word: 'complication', language: 'en', weight: 0.9 },
  { word: 'complicate', language: 'en', weight: 0.9 },
  { word: 'complicated', language: 'en', weight: 0.8 },
  { word: 'problem', language: 'en', weight: 0.7 },
  { word: 'obstacle', language: 'en', weight: 0.9 },
  { word: 'barrier', language: 'en', weight: 0.8 },
  { word: 'challenge', language: 'en', weight: 0.7 },
  { word: 'difficulty', language: 'en', weight: 0.7 },
  { word: 'difficult', language: 'en', weight: 0.6 },
  { word: 'setback', language: 'en', weight: 0.9 },
  { word: 'twist', language: 'en', weight: 0.9 },
  { word: 'unexpected', language: 'en', weight: 0.8 },
  { word: 'surprise', language: 'en', weight: 0.7 },
  { word: 'shocking', language: 'en', weight: 0.8 },
  { word: 'reversal', language: 'en', weight: 0.9 },
  { word: 'betrayal', language: 'en', weight: 0.9 },
  { word: 'trap', language: 'en', weight: 0.8 },
  { word: 'trapped', language: 'en', weight: 0.8 },
  { word: 'cornered', language: 'en', weight: 0.8 },
  { word: 'dilemma', language: 'en', weight: 0.9 },
  { word: 'choice', language: 'en', weight: 0.6 },
  { word: 'decide', language: 'en', weight: 0.6 },
  { word: 'decision', language: 'en', weight: 0.7 },
  
  // Complications - Norwegian
  { word: 'komplikasjon', language: 'no', weight: 0.9 },
  { word: 'kompliserer', language: 'no', weight: 0.9 },
  { word: 'komplisert', language: 'no', weight: 0.8 },
  { word: 'problem', language: 'no', weight: 0.7 },
  { word: 'hinder', language: 'no', weight: 0.9 },
  { word: 'hindring', language: 'no', weight: 0.9 },
  { word: 'barriere', language: 'no', weight: 0.8 },
  { word: 'utfordring', language: 'no', weight: 0.7 },
  { word: 'vanskelighet', language: 'no', weight: 0.7 },
  { word: 'vanskelig', language: 'no', weight: 0.6 },
  { word: 'tilbakeslag', language: 'no', weight: 0.9 },
  { word: 'vending', language: 'no', weight: 0.8 },
  { word: 'overraskelse', language: 'no', weight: 0.7 },
  { word: 'sjokkerende', language: 'no', weight: 0.8 },
  { word: 'omveltning', language: 'no', weight: 0.9 },
  { word: 'svik', language: 'no', weight: 0.9 },
  { word: 'felle', language: 'no', weight: 0.8 },
  { word: 'fanget', language: 'no', weight: 0.8 },
  { word: 'trengt', language: 'no', weight: 0.7 },
  { word: 'dilemma', language: 'no', weight: 0.9 },
  { word: 'valg', language: 'no', weight: 0.6 },
  { word: 'bestemmer', language: 'no', weight: 0.6 },
  { word: 'beslutning', language: 'no', weight: 0.7 },
  
  // Stakes/Urgency - English
  { word: 'stakes', language: 'en', weight: 0.9 },
  { word: 'urgent', language: 'en', weight: 0.8 },
  { word: 'urgency', language: 'en', weight: 0.8 },
  { word: 'hurry', language: 'en', weight: 0.7 },
  { word: 'rush', language: 'en', weight: 0.7 },
  { word: 'time running out', language: 'en', weight: 1.0 },
  { word: 'deadline', language: 'en', weight: 0.8 },
  { word: 'countdown', language: 'en', weight: 0.9 },
  { word: 'tick', language: 'en', weight: 0.6 },
  { word: 'ticking', language: 'en', weight: 0.7 },
  { word: 'race against', language: 'en', weight: 0.9 },
  { word: 'must', language: 'en', weight: 0.6 },
  { word: 'need to', language: 'en', weight: 0.5 },
  { word: 'have to', language: 'en', weight: 0.5 },
  { word: 'before it\'s too late', language: 'en', weight: 1.0 },
  { word: 'running out', language: 'en', weight: 0.9 },
  { word: 'last chance', language: 'en', weight: 1.0 },
  { word: 'only hope', language: 'en', weight: 0.9 },
  { word: 'risk', language: 'en', weight: 0.8 },
  { word: 'risky', language: 'en', weight: 0.7 },
  { word: 'danger', language: 'en', weight: 0.8 },
  { word: 'dangerous', language: 'en', weight: 0.8 },
  { word: 'jeopardy', language: 'en', weight: 0.9 },
  { word: 'peril', language: 'en', weight: 0.9 },
  { word: 'threat', language: 'en', weight: 0.8 },
  { word: 'threaten', language: 'en', weight: 0.8 },
  
  // Stakes/Urgency - Norwegian
  { word: 'haster', language: 'no', weight: 0.8 },
  { word: 'hastverk', language: 'no', weight: 0.8 },
  { word: 'skynder', language: 'no', weight: 0.7 },
  { word: 'tiden renner ut', language: 'no', weight: 1.0 },
  { word: 'tidsfrist', language: 'no', weight: 0.8 },
  { word: 'nedtelling', language: 'no', weight: 0.9 },
  { word: 'kappløp mot', language: 'no', weight: 0.9 },
  { word: 'må', language: 'no', weight: 0.5 },
  { word: 'nødt til', language: 'no', weight: 0.6 },
  { word: 'før det er for sent', language: 'no', weight: 1.0 },
  { word: 'siste sjanse', language: 'no', weight: 1.0 },
  { word: 'eneste håp', language: 'no', weight: 0.9 },
  { word: 'risiko', language: 'no', weight: 0.8 },
  { word: 'risikabelt', language: 'no', weight: 0.7 },
  { word: 'fare', language: 'no', weight: 0.8 },
  { word: 'farlig', language: 'no', weight: 0.8 },
  { word: 'trussel', language: 'no', weight: 0.8 },
  { word: 'truer', language: 'no', weight: 0.8 },
  
  // Planning/Preparation
  { word: 'plan', language: 'both', weight: 0.7 },
  { word: 'prepare', language: 'en', weight: 0.7 },
  { word: 'preparation', language: 'en', weight: 0.7 },
  { word: 'forbereder', language: 'no', weight: 0.7 },
  { word: 'forberedelse', language: 'no', weight: 0.7 },
  { word: 'strategy', language: 'en', weight: 0.7 },
  { word: 'strategi', language: 'no', weight: 0.7 },
  { word: 'gather', language: 'en', weight: 0.6 },
  { word: 'samler', language: 'no', weight: 0.6 },
  { word: 'assemble', language: 'en', weight: 0.7 },
  { word: 'team up', language: 'en', weight: 0.7 },
  { word: 'ally', language: 'en', weight: 0.7 },
  { word: 'alliert', language: 'no', weight: 0.7 },
  { word: 'alliance', language: 'en', weight: 0.7 },
  { word: 'allianse', language: 'no', weight: 0.7 },
];

// ============================================================
// FALLING ACTION WORDS - Aftermath, consequences, winding down
// ============================================================
const FALLING_ACTION_WORDS: WordEntry[] = [
  // Aftermath - English
  { word: 'aftermath', language: 'en', weight: 1.0 },
  { word: 'after', language: 'en', weight: 0.5 },
  { word: 'afterward', language: 'en', weight: 0.7 },
  { word: 'afterwards', language: 'en', weight: 0.7 },
  { word: 'consequence', language: 'en', weight: 0.9 },
  { word: 'consequences', language: 'en', weight: 0.9 },
  { word: 'result', language: 'en', weight: 0.6 },
  { word: 'results', language: 'en', weight: 0.6 },
  { word: 'outcome', language: 'en', weight: 0.8 },
  { word: 'fallout', language: 'en', weight: 0.9 },
  { word: 'repercussion', language: 'en', weight: 0.9 },
  { word: 'repercussions', language: 'en', weight: 0.9 },
  { word: 'effect', language: 'en', weight: 0.5 },
  { word: 'effects', language: 'en', weight: 0.5 },
  { word: 'impact', language: 'en', weight: 0.6 },
  { word: 'wake', language: 'en', weight: 0.6 },
  { word: 'dust settles', language: 'en', weight: 1.0 },
  { word: 'smoke clears', language: 'en', weight: 1.0 },
  
  // Aftermath - Norwegian
  { word: 'etterspill', language: 'no', weight: 1.0 },
  { word: 'etterpå', language: 'no', weight: 0.6 },
  { word: 'konsekvens', language: 'no', weight: 0.9 },
  { word: 'konsekvenser', language: 'no', weight: 0.9 },
  { word: 'resultat', language: 'no', weight: 0.6 },
  { word: 'utfall', language: 'no', weight: 0.8 },
  { word: 'følger', language: 'no', weight: 0.7 },
  { word: 'virkning', language: 'no', weight: 0.6 },
  { word: 'innvirkning', language: 'no', weight: 0.6 },
  { word: 'ringvirkninger', language: 'no', weight: 0.9 },
  { word: 'støvet legger seg', language: 'no', weight: 1.0 },
  { word: 'røyken letter', language: 'no', weight: 1.0 },
  
  // Winding down - English
  { word: 'wind down', language: 'en', weight: 0.9 },
  { word: 'slow', language: 'en', weight: 0.5 },
  { word: 'slower', language: 'en', weight: 0.6 },
  { word: 'calm', language: 'en', weight: 0.7 },
  { word: 'calmer', language: 'en', weight: 0.7 },
  { word: 'quiet', language: 'en', weight: 0.6 },
  { word: 'quieter', language: 'en', weight: 0.7 },
  { word: 'settle', language: 'en', weight: 0.7 },
  { word: 'settling', language: 'en', weight: 0.7 },
  { word: 'ease', language: 'en', weight: 0.6 },
  { word: 'easing', language: 'en', weight: 0.7 },
  { word: 'subside', language: 'en', weight: 0.8 },
  { word: 'subsiding', language: 'en', weight: 0.8 },
  { word: 'diminish', language: 'en', weight: 0.7 },
  { word: 'fade', language: 'en', weight: 0.7 },
  { word: 'fading', language: 'en', weight: 0.7 },
  { word: 'recede', language: 'en', weight: 0.7 },
  { word: 'retreat', language: 'en', weight: 0.7 },
  { word: 'withdraw', language: 'en', weight: 0.7 },
  { word: 'return', language: 'en', weight: 0.6 },
  { word: 'returning', language: 'en', weight: 0.6 },
  { word: 'normal', language: 'en', weight: 0.6 },
  { word: 'normalcy', language: 'en', weight: 0.8 },
  
  // Winding down - Norwegian
  { word: 'roer seg', language: 'no', weight: 0.8 },
  { word: 'sakte', language: 'no', weight: 0.5 },
  { word: 'saktere', language: 'no', weight: 0.6 },
  { word: 'roligere', language: 'no', weight: 0.7 },
  { word: 'stillere', language: 'no', weight: 0.6 },
  { word: 'legger seg', language: 'no', weight: 0.7 },
  { word: 'letter', language: 'no', weight: 0.6 },
  { word: 'avtar', language: 'no', weight: 0.8 },
  { word: 'avtakende', language: 'no', weight: 0.8 },
  { word: 'minker', language: 'no', weight: 0.7 },
  { word: 'blekner', language: 'no', weight: 0.7 },
  { word: 'trekker seg tilbake', language: 'no', weight: 0.7 },
  { word: 'vender tilbake', language: 'no', weight: 0.6 },
  { word: 'normal', language: 'no', weight: 0.6 },
  { word: 'normalitet', language: 'no', weight: 0.8 },
  
  // Processing/Reflection
  { word: 'process', language: 'en', weight: 0.6 },
  { word: 'processing', language: 'en', weight: 0.7 },
  { word: 'reflect', language: 'en', weight: 0.8 },
  { word: 'reflection', language: 'en', weight: 0.8 },
  { word: 'reflecting', language: 'en', weight: 0.8 },
  { word: 'think', language: 'en', weight: 0.4 },
  { word: 'thinking', language: 'en', weight: 0.5 },
  { word: 'consider', language: 'en', weight: 0.5 },
  { word: 'considering', language: 'en', weight: 0.6 },
  { word: 'contemplate', language: 'en', weight: 0.7 },
  { word: 'ponder', language: 'en', weight: 0.7 },
  { word: 'meditate', language: 'en', weight: 0.7 },
  { word: 'reminisce', language: 'en', weight: 0.8 },
  { word: 'remember', language: 'en', weight: 0.6 },
  { word: 'recall', language: 'en', weight: 0.6 },
  { word: 'look back', language: 'en', weight: 0.8 },
  
  // Processing/Reflection - Norwegian
  { word: 'bearbeider', language: 'no', weight: 0.7 },
  { word: 'reflekterer', language: 'no', weight: 0.8 },
  { word: 'refleksjon', language: 'no', weight: 0.8 },
  { word: 'tenker', language: 'no', weight: 0.4 },
  { word: 'vurderer', language: 'no', weight: 0.5 },
  { word: 'kontemplerer', language: 'no', weight: 0.7 },
  { word: 'grubler', language: 'no', weight: 0.7 },
  { word: 'mediterer', language: 'no', weight: 0.7 },
  { word: 'mimrer', language: 'no', weight: 0.8 },
  { word: 'husker', language: 'no', weight: 0.5 },
  { word: 'minnes', language: 'no', weight: 0.7 },
  { word: 'ser tilbake', language: 'no', weight: 0.8 },
];

// ============================================================
// TRANSITION WORDS - Scene changes, time jumps, location shifts
// ============================================================
const TRANSITION_WORDS: WordEntry[] = [
  // Time transitions - English
  { word: 'later', language: 'en', weight: 0.9 },
  { word: 'earlier', language: 'en', weight: 0.9 },
  { word: 'meanwhile', language: 'en', weight: 1.0 },
  { word: 'soon', language: 'en', weight: 0.6 },
  { word: 'next', language: 'en', weight: 0.7 },
  { word: 'then', language: 'en', weight: 0.5 },
  { word: 'now', language: 'en', weight: 0.5 },
  { word: 'before', language: 'en', weight: 0.6 },
  { word: 'after', language: 'en', weight: 0.5 },
  { word: 'morning', language: 'en', weight: 0.6 },
  { word: 'afternoon', language: 'en', weight: 0.6 },
  { word: 'evening', language: 'en', weight: 0.6 },
  { word: 'night', language: 'en', weight: 0.6 },
  { word: 'day', language: 'en', weight: 0.4 },
  { word: 'days later', language: 'en', weight: 1.0 },
  { word: 'weeks later', language: 'en', weight: 1.0 },
  { word: 'months later', language: 'en', weight: 1.0 },
  { word: 'years later', language: 'en', weight: 1.0 },
  { word: 'the next day', language: 'en', weight: 1.0 },
  { word: 'the following', language: 'en', weight: 0.9 },
  { word: 'flashback', language: 'en', weight: 1.0 },
  { word: 'flash forward', language: 'en', weight: 1.0 },
  { word: 'time passes', language: 'en', weight: 1.0 },
  { word: 'time lapse', language: 'en', weight: 1.0 },
  { word: 'intercut', language: 'en', weight: 1.0 },
  { word: 'simultaneously', language: 'en', weight: 0.9 },
  { word: 'at the same time', language: 'en', weight: 0.9 },
  
  // Time transitions - Norwegian
  { word: 'senere', language: 'no', weight: 0.9 },
  { word: 'tidligere', language: 'no', weight: 0.9 },
  { word: 'i mellomtiden', language: 'no', weight: 1.0 },
  { word: 'snart', language: 'no', weight: 0.6 },
  { word: 'neste', language: 'no', weight: 0.7 },
  { word: 'så', language: 'no', weight: 0.4 },
  { word: 'nå', language: 'no', weight: 0.4 },
  { word: 'før', language: 'no', weight: 0.5 },
  { word: 'etter', language: 'no', weight: 0.5 },
  { word: 'morgen', language: 'no', weight: 0.6 },
  { word: 'ettermiddag', language: 'no', weight: 0.6 },
  { word: 'kveld', language: 'no', weight: 0.6 },
  { word: 'natt', language: 'no', weight: 0.6 },
  { word: 'dag', language: 'no', weight: 0.4 },
  { word: 'dager senere', language: 'no', weight: 1.0 },
  { word: 'uker senere', language: 'no', weight: 1.0 },
  { word: 'måneder senere', language: 'no', weight: 1.0 },
  { word: 'år senere', language: 'no', weight: 1.0 },
  { word: 'neste dag', language: 'no', weight: 1.0 },
  { word: 'tilbakeblikk', language: 'no', weight: 1.0 },
  { word: 'tiden går', language: 'no', weight: 1.0 },
  { word: 'samtidig', language: 'no', weight: 0.9 },
  
  // Location transitions - English
  { word: 'elsewhere', language: 'en', weight: 1.0 },
  { word: 'cut to', language: 'en', weight: 1.0 },
  { word: 'smash cut', language: 'en', weight: 1.0 },
  { word: 'match cut', language: 'en', weight: 1.0 },
  { word: 'dissolve to', language: 'en', weight: 1.0 },
  { word: 'fade to', language: 'en', weight: 1.0 },
  { word: 'fade in', language: 'en', weight: 1.0 },
  { word: 'fade out', language: 'en', weight: 1.0 },
  { word: 'wipe to', language: 'en', weight: 1.0 },
  { word: 'iris in', language: 'en', weight: 1.0 },
  { word: 'iris out', language: 'en', weight: 1.0 },
  { word: 'outside', language: 'en', weight: 0.6 },
  { word: 'inside', language: 'en', weight: 0.6 },
  { word: 'ext.', language: 'en', weight: 1.0 },
  { word: 'int.', language: 'en', weight: 1.0 },
  { word: 'exterior', language: 'en', weight: 0.9 },
  { word: 'interior', language: 'en', weight: 0.9 },
  { word: 'across town', language: 'en', weight: 0.9 },
  { word: 'back at', language: 'en', weight: 0.8 },
  { word: 'at the', language: 'en', weight: 0.4 },
  { word: 'in the', language: 'en', weight: 0.3 },
  { word: 'traveling', language: 'en', weight: 0.7 },
  { word: 'driving', language: 'en', weight: 0.6 },
  { word: 'flying', language: 'en', weight: 0.6 },
  { word: 'walking', language: 'en', weight: 0.5 },
  { word: 'montage', language: 'en', weight: 1.0 },
  { word: 'series of shots', language: 'en', weight: 1.0 },
  
  // Location transitions - Norwegian
  { word: 'et annet sted', language: 'no', weight: 1.0 },
  { word: 'kutt til', language: 'no', weight: 1.0 },
  { word: 'fade til', language: 'no', weight: 1.0 },
  { word: 'fade inn', language: 'no', weight: 1.0 },
  { word: 'fade ut', language: 'no', weight: 1.0 },
  { word: 'ute', language: 'no', weight: 0.5 },
  { word: 'inne', language: 'no', weight: 0.5 },
  { word: 'utendørs', language: 'no', weight: 0.7 },
  { word: 'innendørs', language: 'no', weight: 0.7 },
  { word: 'eksteriør', language: 'no', weight: 0.9 },
  { word: 'interiør', language: 'no', weight: 0.9 },
  { word: 'tilbake hos', language: 'no', weight: 0.8 },
  { word: 'hos', language: 'no', weight: 0.4 },
  { word: 'på', language: 'no', weight: 0.3 },
  { word: 'reiser', language: 'no', weight: 0.7 },
  { word: 'kjører', language: 'no', weight: 0.6 },
  { word: 'flyr', language: 'no', weight: 0.6 },
  { word: 'går', language: 'no', weight: 0.4 },
  { word: 'montasje', language: 'no', weight: 1.0 },
  
  // Screenplay formatting terms
  { word: 'continuous', language: 'en', weight: 0.9 },
  { word: 'same', language: 'en', weight: 0.6 },
  { word: 'moments later', language: 'en', weight: 1.0 },
  { word: 'continuous action', language: 'en', weight: 1.0 },
  { word: 'split screen', language: 'en', weight: 1.0 },
  { word: 'superimpose', language: 'en', weight: 0.9 },
  { word: 'super', language: 'en', weight: 0.7 },
  { word: 'title card', language: 'en', weight: 0.9 },
  { word: 'chyron', language: 'en', weight: 0.9 },
  { word: 'kontinuerlig', language: 'no', weight: 0.9 },
  { word: 'samme', language: 'no', weight: 0.5 },
  { word: 'øyeblikk senere', language: 'no', weight: 1.0 },
  { word: 'delt skjerm', language: 'no', weight: 1.0 },
];

// ============================================================
// CHARACTER DEVELOPMENT WORDS - Growth, change, inner journey
// ============================================================
const CHARACTER_DEVELOPMENT_WORDS: WordEntry[] = [
  // Personal growth - English
  { word: 'grow', language: 'en', weight: 0.7 },
  { word: 'growth', language: 'en', weight: 0.8 },
  { word: 'change', language: 'en', weight: 0.7 },
  { word: 'changed', language: 'en', weight: 0.8 },
  { word: 'transform', language: 'en', weight: 0.9 },
  { word: 'transformation', language: 'en', weight: 1.0 },
  { word: 'evolve', language: 'en', weight: 0.9 },
  { word: 'evolution', language: 'en', weight: 0.9 },
  { word: 'mature', language: 'en', weight: 0.8 },
  { word: 'maturity', language: 'en', weight: 0.8 },
  { word: 'develop', language: 'en', weight: 0.7 },
  { word: 'development', language: 'en', weight: 0.8 },
  { word: 'progress', language: 'en', weight: 0.7 },
  { word: 'journey', language: 'en', weight: 0.8 },
  { word: 'path', language: 'en', weight: 0.5 },
  { word: 'arc', language: 'en', weight: 0.9 },
  { word: 'become', language: 'en', weight: 0.6 },
  { word: 'becoming', language: 'en', weight: 0.7 },
  
  // Personal growth - Norwegian
  { word: 'vokser', language: 'no', weight: 0.7 },
  { word: 'vekst', language: 'no', weight: 0.8 },
  { word: 'endrer', language: 'no', weight: 0.7 },
  { word: 'endret', language: 'no', weight: 0.8 },
  { word: 'endring', language: 'no', weight: 0.8 },
  { word: 'forvandler', language: 'no', weight: 0.9 },
  { word: 'forvandling', language: 'no', weight: 1.0 },
  { word: 'utvikler', language: 'no', weight: 0.7 },
  { word: 'utvikling', language: 'no', weight: 0.8 },
  { word: 'modnes', language: 'no', weight: 0.8 },
  { word: 'modenhet', language: 'no', weight: 0.8 },
  { word: 'framgang', language: 'no', weight: 0.7 },
  { word: 'reise', language: 'no', weight: 0.8 },
  { word: 'karakterbue', language: 'no', weight: 1.0 },
  { word: 'bli', language: 'no', weight: 0.5 },
  { word: 'blir', language: 'no', weight: 0.5 },
  
  // Learning/Realization - English
  { word: 'learn', language: 'en', weight: 0.8 },
  { word: 'learning', language: 'en', weight: 0.8 },
  { word: 'lesson', language: 'en', weight: 0.8 },
  { word: 'realize', language: 'en', weight: 0.9 },
  { word: 'realization', language: 'en', weight: 0.9 },
  { word: 'understand', language: 'en', weight: 0.7 },
  { word: 'understanding', language: 'en', weight: 0.8 },
  { word: 'insight', language: 'en', weight: 0.9 },
  { word: 'epiphany', language: 'en', weight: 1.0 },
  { word: 'enlighten', language: 'en', weight: 0.8 },
  { word: 'enlightenment', language: 'en', weight: 0.9 },
  { word: 'discover', language: 'en', weight: 0.7 },
  { word: 'discovery', language: 'en', weight: 0.8 },
  { word: 'self-discovery', language: 'en', weight: 1.0 },
  { word: 'awareness', language: 'en', weight: 0.8 },
  { word: 'awakening', language: 'en', weight: 0.9 },
  { word: 'truth', language: 'en', weight: 0.7 },
  { word: 'wisdom', language: 'en', weight: 0.8 },
  
  // Learning/Realization - Norwegian
  { word: 'lærer', language: 'no', weight: 0.8 },
  { word: 'lærdom', language: 'no', weight: 0.8 },
  { word: 'lekse', language: 'no', weight: 0.7 },
  { word: 'innser', language: 'no', weight: 0.9 },
  { word: 'innsikt', language: 'no', weight: 0.9 },
  { word: 'forstår', language: 'no', weight: 0.7 },
  { word: 'forståelse', language: 'no', weight: 0.8 },
  { word: 'opplysning', language: 'no', weight: 0.8 },
  { word: 'oppdager', language: 'no', weight: 0.7 },
  { word: 'selvoppdagelse', language: 'no', weight: 1.0 },
  { word: 'bevissthet', language: 'no', weight: 0.8 },
  { word: 'oppvåkning', language: 'no', weight: 0.9 },
  { word: 'sannhet', language: 'no', weight: 0.7 },
  { word: 'visdom', language: 'no', weight: 0.8 },
  
  // Emotional depth - English
  { word: 'feel', language: 'en', weight: 0.5 },
  { word: 'feeling', language: 'en', weight: 0.6 },
  { word: 'feelings', language: 'en', weight: 0.7 },
  { word: 'emotion', language: 'en', weight: 0.8 },
  { word: 'emotional', language: 'en', weight: 0.8 },
  { word: 'emotions', language: 'en', weight: 0.8 },
  { word: 'heart', language: 'en', weight: 0.6 },
  { word: 'heartfelt', language: 'en', weight: 0.8 },
  { word: 'soul', language: 'en', weight: 0.7 },
  { word: 'inner', language: 'en', weight: 0.7 },
  { word: 'internal', language: 'en', weight: 0.7 },
  { word: 'introspect', language: 'en', weight: 0.9 },
  { word: 'introspection', language: 'en', weight: 0.9 },
  { word: 'vulnerable', language: 'en', weight: 0.9 },
  { word: 'vulnerability', language: 'en', weight: 0.9 },
  { word: 'open up', language: 'en', weight: 0.8 },
  { word: 'reveal', language: 'en', weight: 0.7 },
  { word: 'confide', language: 'en', weight: 0.8 },
  { word: 'confess', language: 'en', weight: 0.8 },
  { word: 'admit', language: 'en', weight: 0.7 },
  { word: 'acknowledge', language: 'en', weight: 0.7 },
  
  // Emotional depth - Norwegian
  { word: 'føler', language: 'no', weight: 0.5 },
  { word: 'følelse', language: 'no', weight: 0.7 },
  { word: 'følelser', language: 'no', weight: 0.8 },
  { word: 'emosjon', language: 'no', weight: 0.8 },
  { word: 'emosjonell', language: 'no', weight: 0.8 },
  { word: 'hjerte', language: 'no', weight: 0.6 },
  { word: 'sjel', language: 'no', weight: 0.7 },
  { word: 'indre', language: 'no', weight: 0.7 },
  { word: 'innadvendt', language: 'no', weight: 0.7 },
  { word: 'selvransakelse', language: 'no', weight: 0.9 },
  { word: 'sårbar', language: 'no', weight: 0.9 },
  { word: 'sårbarhet', language: 'no', weight: 0.9 },
  { word: 'åpner seg', language: 'no', weight: 0.8 },
  { word: 'betror', language: 'no', weight: 0.8 },
  { word: 'tilstår', language: 'no', weight: 0.8 },
  { word: 'innrømmer', language: 'no', weight: 0.7 },
  { word: 'erkjenner', language: 'no', weight: 0.7 },
  
  // Identity/Self - English
  { word: 'identity', language: 'en', weight: 0.9 },
  { word: 'self', language: 'en', weight: 0.6 },
  { word: 'who am i', language: 'en', weight: 1.0 },
  { word: 'who i am', language: 'en', weight: 1.0 },
  { word: 'true self', language: 'en', weight: 1.0 },
  { word: 'authentic', language: 'en', weight: 0.8 },
  { word: 'authenticity', language: 'en', weight: 0.9 },
  { word: 'destiny', language: 'en', weight: 0.8 },
  { word: 'purpose', language: 'en', weight: 0.8 },
  { word: 'meaning', language: 'en', weight: 0.7 },
  { word: 'calling', language: 'en', weight: 0.8 },
  { word: 'belong', language: 'en', weight: 0.7 },
  { word: 'belonging', language: 'en', weight: 0.8 },
  { word: 'worth', language: 'en', weight: 0.7 },
  { word: 'worthy', language: 'en', weight: 0.7 },
  { word: 'value', language: 'en', weight: 0.6 },
  { word: 'values', language: 'en', weight: 0.7 },
  { word: 'belief', language: 'en', weight: 0.7 },
  { word: 'beliefs', language: 'en', weight: 0.7 },
  
  // Identity/Self - Norwegian
  { word: 'identitet', language: 'no', weight: 0.9 },
  { word: 'selv', language: 'no', weight: 0.5 },
  { word: 'hvem er jeg', language: 'no', weight: 1.0 },
  { word: 'sanne jeg', language: 'no', weight: 1.0 },
  { word: 'ekte', language: 'no', weight: 0.7 },
  { word: 'autentisk', language: 'no', weight: 0.8 },
  { word: 'skjebne', language: 'no', weight: 0.8 },
  { word: 'formål', language: 'no', weight: 0.8 },
  { word: 'mening', language: 'no', weight: 0.7 },
  { word: 'kall', language: 'no', weight: 0.8 },
  { word: 'tilhører', language: 'no', weight: 0.7 },
  { word: 'tilhørighet', language: 'no', weight: 0.8 },
  { word: 'verdi', language: 'no', weight: 0.6 },
  { word: 'verdier', language: 'no', weight: 0.7 },
  { word: 'tro', language: 'no', weight: 0.6 },
  { word: 'overbevisning', language: 'no', weight: 0.7 },
];

// ============================================================
// SUBPLOT WORDS - Secondary storylines, side characters
// ============================================================
const SUBPLOT_WORDS: WordEntry[] = [
  // Secondary elements - English
  { word: 'meanwhile', language: 'en', weight: 0.9 },
  { word: 'elsewhere', language: 'en', weight: 0.8 },
  { word: 'side', language: 'en', weight: 0.5 },
  { word: 'secondary', language: 'en', weight: 0.8 },
  { word: 'subplot', language: 'en', weight: 1.0 },
  { word: 'b-story', language: 'en', weight: 1.0 },
  { word: 'c-story', language: 'en', weight: 1.0 },
  { word: 'parallel', language: 'en', weight: 0.8 },
  { word: 'tangent', language: 'en', weight: 0.7 },
  { word: 'digression', language: 'en', weight: 0.7 },
  { word: 'aside', language: 'en', weight: 0.6 },
  { word: 'interlude', language: 'en', weight: 0.8 },
  { word: 'detour', language: 'en', weight: 0.7 },
  
  // Secondary elements - Norwegian
  { word: 'i mellomtiden', language: 'no', weight: 0.9 },
  { word: 'et annet sted', language: 'no', weight: 0.8 },
  { word: 'side', language: 'no', weight: 0.5 },
  { word: 'sekundær', language: 'no', weight: 0.8 },
  { word: 'sidehandling', language: 'no', weight: 1.0 },
  { word: 'parallell', language: 'no', weight: 0.8 },
  { word: 'mellomspill', language: 'no', weight: 0.8 },
  { word: 'omvei', language: 'no', weight: 0.7 },
  { word: 'sidespor', language: 'no', weight: 0.9 },
  
  // Relationship subplots - English
  { word: 'romance', language: 'en', weight: 0.8 },
  { word: 'romantic', language: 'en', weight: 0.7 },
  { word: 'love interest', language: 'en', weight: 0.9 },
  { word: 'affair', language: 'en', weight: 0.8 },
  { word: 'flirt', language: 'en', weight: 0.6 },
  { word: 'flirting', language: 'en', weight: 0.6 },
  { word: 'date', language: 'en', weight: 0.6 },
  { word: 'dating', language: 'en', weight: 0.6 },
  { word: 'crush', language: 'en', weight: 0.7 },
  { word: 'admire', language: 'en', weight: 0.5 },
  { word: 'attraction', language: 'en', weight: 0.7 },
  { word: 'chemistry', language: 'en', weight: 0.7 },
  { word: 'friendship', language: 'en', weight: 0.7 },
  { word: 'rivalry', language: 'en', weight: 0.8 },
  { word: 'jealousy', language: 'en', weight: 0.7 },
  { word: 'jealous', language: 'en', weight: 0.7 },
  { word: 'envy', language: 'en', weight: 0.6 },
  { word: 'family', language: 'en', weight: 0.6 },
  { word: 'sibling', language: 'en', weight: 0.6 },
  { word: 'parent', language: 'en', weight: 0.5 },
  { word: 'child', language: 'en', weight: 0.5 },
  
  // Relationship subplots - Norwegian
  { word: 'romantikk', language: 'no', weight: 0.8 },
  { word: 'romantisk', language: 'no', weight: 0.7 },
  { word: 'kjærlighetsinteresse', language: 'no', weight: 0.9 },
  { word: 'affære', language: 'no', weight: 0.8 },
  { word: 'flørter', language: 'no', weight: 0.6 },
  { word: 'stevnemøte', language: 'no', weight: 0.6 },
  { word: 'forelskelse', language: 'no', weight: 0.8 },
  { word: 'forelsket', language: 'no', weight: 0.7 },
  { word: 'beundrer', language: 'no', weight: 0.5 },
  { word: 'tiltrekning', language: 'no', weight: 0.7 },
  { word: 'kjemi', language: 'no', weight: 0.7 },
  { word: 'vennskap', language: 'no', weight: 0.7 },
  { word: 'rivalisering', language: 'no', weight: 0.8 },
  { word: 'sjalusi', language: 'no', weight: 0.7 },
  { word: 'sjalu', language: 'no', weight: 0.7 },
  { word: 'misunnelse', language: 'no', weight: 0.6 },
  { word: 'familie', language: 'no', weight: 0.6 },
  { word: 'søsken', language: 'no', weight: 0.6 },
  { word: 'forelder', language: 'no', weight: 0.5 },
  { word: 'barn', language: 'no', weight: 0.4 },
  
  // Work/Professional subplots - English
  { word: 'work', language: 'en', weight: 0.4 },
  { word: 'job', language: 'en', weight: 0.5 },
  { word: 'career', language: 'en', weight: 0.6 },
  { word: 'business', language: 'en', weight: 0.5 },
  { word: 'office', language: 'en', weight: 0.5 },
  { word: 'promotion', language: 'en', weight: 0.7 },
  { word: 'fired', language: 'en', weight: 0.7 },
  { word: 'hired', language: 'en', weight: 0.6 },
  { word: 'boss', language: 'en', weight: 0.5 },
  { word: 'colleague', language: 'en', weight: 0.5 },
  { word: 'coworker', language: 'en', weight: 0.5 },
  { word: 'deal', language: 'en', weight: 0.5 },
  { word: 'contract', language: 'en', weight: 0.6 },
  { word: 'meeting', language: 'en', weight: 0.4 },
  { word: 'project', language: 'en', weight: 0.5 },
  { word: 'deadline', language: 'en', weight: 0.6 },
  { word: 'competition', language: 'en', weight: 0.7 },
  { word: 'competitor', language: 'en', weight: 0.6 },
  
  // Work/Professional subplots - Norwegian
  { word: 'jobb', language: 'no', weight: 0.5 },
  { word: 'arbeid', language: 'no', weight: 0.4 },
  { word: 'karriere', language: 'no', weight: 0.6 },
  { word: 'forretning', language: 'no', weight: 0.5 },
  { word: 'kontor', language: 'no', weight: 0.4 },
  { word: 'forfremmelse', language: 'no', weight: 0.7 },
  { word: 'oppsagt', language: 'no', weight: 0.7 },
  { word: 'ansatt', language: 'no', weight: 0.5 },
  { word: 'sjef', language: 'no', weight: 0.5 },
  { word: 'kollega', language: 'no', weight: 0.5 },
  { word: 'avtale', language: 'no', weight: 0.5 },
  { word: 'kontrakt', language: 'no', weight: 0.6 },
  { word: 'møte', language: 'no', weight: 0.4 },
  { word: 'prosjekt', language: 'no', weight: 0.5 },
  { word: 'konkurranse', language: 'no', weight: 0.7 },
  { word: 'konkurrent', language: 'no', weight: 0.6 },
  
  // Mystery/Investigation subplots
  { word: 'investigate', language: 'en', weight: 0.8 },
  { word: 'investigation', language: 'en', weight: 0.8 },
  { word: 'clue', language: 'en', weight: 0.8 },
  { word: 'evidence', language: 'en', weight: 0.7 },
  { word: 'suspect', language: 'en', weight: 0.7 },
  { word: 'witness', language: 'en', weight: 0.6 },
  { word: 'alibi', language: 'en', weight: 0.8 },
  { word: 'mystery', language: 'en', weight: 0.8 },
  { word: 'mysterious', language: 'en', weight: 0.7 },
  { word: 'secret', language: 'en', weight: 0.7 },
  { word: 'hidden', language: 'en', weight: 0.6 },
  { word: 'uncover', language: 'en', weight: 0.7 },
  { word: 'discover', language: 'en', weight: 0.6 },
  { word: 'trace', language: 'en', weight: 0.6 },
  { word: 'track', language: 'en', weight: 0.5 },
  { word: 'follow', language: 'en', weight: 0.4 },
  
  // Mystery/Investigation - Norwegian
  { word: 'etterforsker', language: 'no', weight: 0.8 },
  { word: 'etterforskning', language: 'no', weight: 0.8 },
  { word: 'ledetråd', language: 'no', weight: 0.8 },
  { word: 'bevis', language: 'no', weight: 0.7 },
  { word: 'mistenkt', language: 'no', weight: 0.7 },
  { word: 'vitne', language: 'no', weight: 0.6 },
  { word: 'alibi', language: 'no', weight: 0.8 },
  { word: 'mysterium', language: 'no', weight: 0.8 },
  { word: 'mystisk', language: 'no', weight: 0.7 },
  { word: 'hemmelighet', language: 'no', weight: 0.7 },
  { word: 'skjult', language: 'no', weight: 0.6 },
  { word: 'avdekker', language: 'no', weight: 0.7 },
  { word: 'sporer', language: 'no', weight: 0.6 },
  { word: 'følger', language: 'no', weight: 0.4 },
];

// Store reference for export
export const WORD_BANK_CATEGORIES: { [key in WordCategory]?: WordEntry[] } = {
  conflict: CONFLICT_WORDS,
  climax: CLIMAX_WORDS,
  exposition: EXPOSITION_WORDS,
  resolution: RESOLUTION_WORDS,
  rising_action: RISING_ACTION_WORDS,
  falling_action: FALLING_ACTION_WORDS,
  transition: TRANSITION_WORDS,
  character_development: CHARACTER_DEVELOPMENT_WORDS,
  subplot: SUBPLOT_WORDS,
};

// ============================================================
// WORD BANK SERVICE CLASS
// Manages vocabulary with learning capabilities
// ============================================================

const STORAGE_KEY = 'virtualstudio_wordbank_custom';
const USAGE_STORAGE_KEY = 'virtualstudio_wordbank_usage';
const FEEDBACK_STORAGE_KEY = 'virtualstudio_wordbank_feedback';


export interface WordBankStats {
  totalWords: number;
  userAddedWords: number;
  categoryCounts: Record<WordCategory, number>;
  languageCounts: { en: number; no: number; both: number };
}

export interface WordMatch {
  word: string;
  category: WordCategory;
  weight: number;
  position: number;
  language: 'en' | 'no' | 'both';
}

export interface FeedbackEntry {
  sceneText: string;
  correctPurpose: WordCategory;
  incorrectPurpose: WordCategory;
  learnedWords: string[];
  timestamp: string;
}

class ScriptWordBankService {
  private customWords: Map<WordCategory, WordEntry[]> = new Map();
  private wordUsage: Map<string, number> = new Map();
  private feedbackHistory: FeedbackEntry[] = [];
  private initialized = false;
  private usageDirty = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.hydrateFromDb();
    this.initialized = true;
    
    // Set up periodic save for usage data (debounced)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushUsageData();
      });
    }
  }

  private async hydrateFromDb(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const userId = getCurrentUserId();
      const custom = await settingsService.getSetting<Record<WordCategory, WordEntry[]>>(STORAGE_KEY, { userId });
      if (custom) {
        this.customWords.clear();
        Object.entries(custom).forEach(([category, words]) => {
          this.customWords.set(category as WordCategory, words);
        });
      }

      const usage = await settingsService.getSetting<Record<string, number>>(USAGE_STORAGE_KEY, { userId });
      if (usage) {
        this.wordUsage.clear();
        Object.entries(usage).forEach(([word, count]) => {
          this.wordUsage.set(word, count);
        });
      }

      const feedback = await settingsService.getSetting<FeedbackEntry[]>(FEEDBACK_STORAGE_KEY, { userId });
      if (feedback) {
        this.feedbackHistory = feedback;
      }
    } catch (error) {
      console.warn('Failed to hydrate word bank:', error);
    }
  }


  /**
   * Save custom words to settings
   */
  private saveCustomWords(): void {
    try {
      const data: Record<string, WordEntry[]> = {};
      this.customWords.forEach((words, category) => {
        data[category] = words;
      });
      void settingsService.setSetting(STORAGE_KEY, data, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Failed to save custom words:', error);
    }
  }

  /**
   * Save usage data to settings (debounced)
   */
  private saveUsageData(): void {
    this.usageDirty = true;
    
    // Debounce saves to avoid too many writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.flushUsageData();
    }, 5000); // Save after 5 seconds of inactivity
  }

  /**
   * Force save usage data immediately
   */
  private flushUsageData(): void {
    if (!this.usageDirty) return;
    
    try {
      const data: Record<string, number> = {};
      this.wordUsage.forEach((count, word) => {
        data[word] = count;
      });
      void settingsService.setSetting(USAGE_STORAGE_KEY, data, { userId: getCurrentUserId() });
      this.usageDirty = false;
    } catch (error) {
      console.error('Failed to save usage data:', error);
    }
  }

  /**
   * Save feedback history
   */
  private saveFeedbackHistory(): void {
    try {
      // Keep only last 100 feedback entries
      const recentFeedback = this.feedbackHistory.slice(-100);
      void settingsService.setSetting(FEEDBACK_STORAGE_KEY, recentFeedback, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Failed to save feedback history:', error);
    }
  }

  /**
   * Get all words for a specific category (built-in + custom)
   */
  getWordsForCategory(category: WordCategory): WordEntry[] {
    const builtIn = WORD_BANK_CATEGORIES[category] || [];
    const custom = this.customWords.get(category) || [];
    return [...builtIn, ...custom];
  }

  /**
   * Get all categories
   */
  getAllCategories(): WordCategory[] {
    return [
      'conflict', 'climax', 'exposition', 'resolution',
      'rising_action', 'falling_action', 'transition',
      'character_development', 'subplot',
      'romance', 'comedy', 'horror', 'thriller', 'action', 'drama', 'mystery'
    ];
  }

  /**
   * Add a new word to a category (user-contributed)
   */
  addWord(
    category: WordCategory,
    word: string,
    language: 'en' | 'no' | 'both' = 'both',
    weight: number = 0.7
  ): boolean {
    // Validate
    if (!word || word.trim().length === 0) return false;
    if (weight < 0.1 || weight > 1.0) weight = 0.7;

    const normalizedWord = word.toLowerCase().trim();

    // Check if word already exists in built-in
    const builtIn = WORD_BANK_CATEGORIES[category] || [];
    if (builtIn.some(w => w.word.toLowerCase() === normalizedWord)) {
      return false; // Already exists in built-in
    }

    // Check if word already exists in custom
    const custom = this.customWords.get(category) || [];
    if (custom.some(w => w.word.toLowerCase() === normalizedWord)) {
      return false; // Already exists in custom
    }

    // Add new word
    const newEntry: WordEntry = {
      word: normalizedWord,
      language,
      weight,
      userAdded: true,
      addedAt: new Date().toISOString(),
      usageCount: 0
    };

    custom.push(newEntry);
    this.customWords.set(category, custom);
    this.saveCustomWords();
    return true;
  }

  /**
   * Add multiple words to a category
   */
  addWords(
    category: WordCategory,
    words: string[],
    language: 'en' | 'no' | 'both' = 'both',
    weight: number = 0.7
  ): number {
    let added = 0;
    words.forEach(word => {
      if (this.addWord(category, word, language, weight)) {
        added++;
      }
    });
    return added;
  }

  /**
   * Remove a user-added word
   */
  removeWord(category: WordCategory, word: string): boolean {
    const custom = this.customWords.get(category);
    if (!custom) return false;

    const normalizedWord = word.toLowerCase().trim();
    const index = custom.findIndex(w => w.word.toLowerCase() === normalizedWord);
    
    if (index === -1) return false;

    custom.splice(index, 1);
    this.customWords.set(category, custom);
    this.saveCustomWords();
    return true;
  }

  /**
   * Update a word's weight
   */
  updateWordWeight(category: WordCategory, word: string, newWeight: number): boolean {
    if (newWeight < 0.1 || newWeight > 1.0) return false;

    const custom = this.customWords.get(category);
    if (!custom) return false;

    const normalizedWord = word.toLowerCase().trim();
    const entry = custom.find(w => w.word.toLowerCase() === normalizedWord);
    
    if (!entry) return false;

    entry.weight = newWeight;
    this.saveCustomWords();
    return true;
  }

  /**
   * Track word usage when detected in scripts
   * This helps improve detection over time
   */
  trackWordUsage(word: string): void {
    const normalizedWord = word.toLowerCase().trim();
    const currentCount = this.wordUsage.get(normalizedWord) || 0;
    this.wordUsage.set(normalizedWord, currentCount + 1);
    this.saveUsageData();
  }

  /**
   * Analyze text and find all matching words with their categories
   */
  analyzeText(text: string): WordMatch[] {
    const matches: WordMatch[] = [];
    const lowerText = text.toLowerCase();
    
    this.getAllCategories().forEach(category => {
      const words = this.getWordsForCategory(category);
      
      words.forEach(entry => {
        const wordLower = entry.word.toLowerCase();
        let position = lowerText.indexOf(wordLower);
        
        while (position !== -1) {
          // Check word boundaries to avoid partial matches
          const beforeChar = position > 0 ? lowerText[position - 1] : ' ';
          const afterChar = position + wordLower.length < lowerText.length 
            ? lowerText[position + wordLower.length] 
            : ' ';
          
          const isWordBoundary = (c: string) => /[\s.,!?;:'"()\-\[\]{}]/.test(c);
          
          if (isWordBoundary(beforeChar) && isWordBoundary(afterChar)) {
            matches.push({
              word: entry.word,
              category,
              weight: entry.weight,
              position,
              language: entry.language
            });
            
            // Track usage
            this.trackWordUsage(entry.word);
          }
          
          position = lowerText.indexOf(wordLower, position + 1);
        }
      });
    });

    // Sort by position
    matches.sort((a, b) => a.position - b.position);
    return matches;
  }

  /**
   * Calculate scene purpose based on word matches
   */
  detectScenePurpose(sceneText: string): {
    purpose: WordCategory;
    confidence: number;
    matches: WordMatch[];
  } {
    const matches = this.analyzeText(sceneText);
    
    // Calculate weighted scores per category
    const scores: Record<string, number> = {};
    const matchesByCategory: Record<string, WordMatch[]> = {};
    
    matches.forEach(match => {
      if (!scores[match.category]) {
        scores[match.category] = 0;
        matchesByCategory[match.category] = [];
      }
      scores[match.category] += match.weight;
      matchesByCategory[match.category].push(match);
    });

    // Find highest scoring category
    let topCategory: WordCategory = 'exposition';
    let topScore = 0;
    
    Object.entries(scores).forEach(([category, score]) => {
      if (score > topScore) {
        topScore = score;
        topCategory = category as WordCategory;
      }
    });

    // Calculate confidence (0-1 based on score vs potential max)
    const maxPossibleScore = matches.length > 0 ? matches.length * 1.0 : 1;
    const confidence = Math.min(topScore / maxPossibleScore, 1);

    return {
      purpose: topCategory,
      confidence,
      matches: matchesByCategory[topCategory] || []
    };
  }

  /**
   * Get statistics about the word bank
   */
  getStats(): WordBankStats {
    if (!this.initialized) {
      this.initialized = true;
    }
    let totalWords = 0;
    let userAddedWords = 0;
    const categoryCounts: Record<string, number> = {};
    const languageCounts = { en: 0, no: 0, both: 0 };

    this.getAllCategories().forEach(category => {
      const words = this.getWordsForCategory(category);
      categoryCounts[category] = words.length;
      totalWords += words.length;
      
      words.forEach(entry => {
        if (entry.userAdded) userAddedWords++;
        languageCounts[entry.language]++;
      });
    });

    return {
      totalWords,
      userAddedWords,
      categoryCounts: categoryCounts as Record<WordCategory, number>,
      languageCounts
    };
  }

  /**
   * Get all user-added words
   */
  getUserAddedWords(): { category: WordCategory; words: WordEntry[] }[] {
    const result: { category: WordCategory; words: WordEntry[] }[] = [];
    
    this.customWords.forEach((words, category) => {
      if (words.length > 0) {
        result.push({ category, words });
      }
    });
    
    return result;
  }

  /**
   * Export all custom words as JSON
   */
  exportCustomWords(): string {
    const data: Record<string, WordEntry[]> = {};
    this.customWords.forEach((words, category) => {
      data[category] = words;
    });
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import custom words from JSON
   */
  importCustomWords(jsonString: string): number {
    try {
      const data = JSON.parse(jsonString) as Record<WordCategory, WordEntry[]>;
      let imported = 0;
      
      Object.entries(data).forEach(([category, words]) => {
        words.forEach(entry => {
          if (this.addWord(
            category as WordCategory,
            entry.word,
            entry.language,
            entry.weight
          )) {
            imported++;
          }
        });
      });
      
      return imported;
    } catch (error) {
      console.error('Failed to import custom words:', error);
      return 0;
    }
  }

  /**
   * Clear all user-added words
   */
  clearCustomWords(): void {
    this.customWords.clear();
    this.saveCustomWords();
  }

  /**
   * Get suggested words based on usage patterns
   * Returns words that are frequently used but not yet in the word bank
   */
  getSuggestedWords(minUsageCount: number = 5): { word: string; count: number }[] {
    const suggestions: { word: string; count: number }[] = [];
    
    this.wordUsage.forEach((count, word) => {
      if (count >= minUsageCount) {
        // Check if word is already in any category
        let exists = false;
        this.getAllCategories().forEach(category => {
          const words = this.getWordsForCategory(category);
          if (words.some(w => w.word.toLowerCase() === word.toLowerCase())) {
            exists = true;
          }
        });
        
        if (!exists) {
          suggestions.push({ word, count });
        }
      }
    });
    
    // Sort by usage count
    suggestions.sort((a, b) => b.count - a.count);
    return suggestions;
  }

  /**
   * Learn from user feedback - when user corrects a scene purpose
   * Records feedback and extracts meaningful words to improve future detection
   */
  learnFromFeedback(
    sceneText: string,
    correctPurpose: WordCategory,
    incorrectPurpose: WordCategory
  ): { learnedWords: string[]; feedbackId: string } {
    const learnedWords: string[] = [];
    
    // Common stop words to ignore (English + Norwegian)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
      'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'into',
      'over', 'after', 'before', 'between', 'under', 'again', 'then', 'here',
      'there', 'about', 'also', 'back', 'been', 'being', 'come', 'even',
      'find', 'first', 'give', 'go', 'got', 'good', 'him', 'her', 'his',
      'its', 'know', 'like', 'look', 'made', 'make', 'me', 'my', 'new',
      'now', 'off', 'old', 'one', 'our', 'out', 'over', 'part', 'see',
      'she', 'take', 'them', 'their', 'time', 'two', 'up', 'us', 'use',
      'want', 'way', 'well', 'your',
      // Norwegian stop words
      'og', 'i', 'jeg', 'det', 'at', 'en', 'et', 'den', 'til', 'er', 'som',
      'på', 'de', 'med', 'han', 'av', 'ikke', 'der', 'så', 'var', 'meg',
      'seg', 'men', 'ett', 'har', 'om', 'vi', 'min', 'mitt', 'ha', 'hadde',
      'hun', 'nå', 'over', 'da', 'ved', 'fra', 'du', 'ut', 'sin', 'dem',
      'oss', 'opp', 'man', 'kan', 'hans', 'hvor', 'eller', 'hva', 'skal',
      'selv', 'sjøl', 'her', 'alle', 'vil', 'bli', 'ble', 'blitt', 'kunne',
      'inn', 'når', 'være', 'kom', 'noen', 'noe', 'ville', 'dere', 'som',
      'deres', 'kun', 'ja', 'etter', 'ned', 'skulle', 'denne', 'for', 'deg',
      'si', 'sine', 'sitt', 'mot', 'å', 'meget', 'hvorfor', 'dette', 'disse',
      'uten', 'hvordan', 'ingen', 'din', 'ditt', 'blir', 'samme', 'hvilken',
      'hvilke', 'sånn', 'inni', 'mellom', 'vår', 'hver', 'hvem', 'vors',
      'hvis', 'både', 'bare', 'fordi', 'før', 'mange', 'også', 'slik',
      'vært', 'være', 'begge', 'siden', 'henne', 'hennar', 'hennes'
    ]);

    // Extract words from the scene
    const words = sceneText.toLowerCase()
      .split(/[\s.,!?;:'"()\-\[\]{}«»""''–—…]+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Count word occurrences
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      // Skip numbers and very common patterns
      if (/^\d+$/.test(word)) return;
      if (/^(int|ext|cont|dag|natt|day|night)$/i.test(word)) return;
      
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    // Find significant words (appear 2+ times or are long/unique)
    const significantWords = Object.entries(wordCounts)
      .filter(([word, count]) => count >= 2 || word.length >= 7)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Limit to top 10 candidates

    // Add significant words to the correct category
    significantWords.forEach(([word]) => {
      // Check if word already exists in any category
      let existsInCategory: WordCategory | null = null;
      this.getAllCategories().forEach(category => {
        const categoryWords = this.getWordsForCategory(category);
        if (categoryWords.some(w => w.word.toLowerCase() === word)) {
          existsInCategory = category;
        }
      });

      // If word exists in incorrect category, we might want to adjust weights
      // For now, only add truly new words
      if (!existsInCategory) {
        // Add with a moderate weight since it's learned from user feedback
        if (this.addWord(correctPurpose, word, 'both', 0.6)) {
          learnedWords.push(word);
        }
      }
    });

    // Record feedback for analytics
    const feedbackEntry: FeedbackEntry = {
      sceneText: sceneText.substring(0, 500), // Store first 500 chars
      correctPurpose,
      incorrectPurpose,
      learnedWords,
      timestamp: new Date().toISOString()
    };
    
    this.feedbackHistory.push(feedbackEntry);
    this.saveFeedbackHistory();

    return {
      learnedWords,
      feedbackId: `feedback_${Date.now()}`
    };
  }

  /**
   * Get feedback history for analysis
   */
  getFeedbackHistory(): FeedbackEntry[] {
    return [...this.feedbackHistory];
  }

  /**
   * Analyze feedback patterns to identify commonly misclassified purposes
   */
  analyzeFeedbackPatterns(): {
    commonMistakes: { from: WordCategory; to: WordCategory; count: number }[];
    mostLearnedCategories: { category: WordCategory; wordCount: number }[];
    totalFeedback: number;
  } {
    const mistakeCounts = new Map<string, number>();
    const categoryWordCounts = new Map<WordCategory, number>();

    this.feedbackHistory.forEach(entry => {
      // Track mistake patterns
      const key = `${entry.incorrectPurpose}->${entry.correctPurpose}`;
      mistakeCounts.set(key, (mistakeCounts.get(key) || 0) + 1);

      // Track learned words per category
      const current = categoryWordCounts.get(entry.correctPurpose) || 0;
      categoryWordCounts.set(entry.correctPurpose, current + entry.learnedWords.length);
    });

    const commonMistakes = Array.from(mistakeCounts.entries())
      .map(([key, count]) => {
        const [from, to] = key.split('->') as [WordCategory, WordCategory];
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const mostLearnedCategories = Array.from(categoryWordCounts.entries())
      .map(([category, wordCount]) => ({ category, wordCount }))
      .sort((a, b) => b.wordCount - a.wordCount);

    return {
      commonMistakes,
      mostLearnedCategories,
      totalFeedback: this.feedbackHistory.length
    };
  }

  /**
   * Boost word weights based on positive feedback
   * Call this when a detection is confirmed as correct
   */
  reinforceWord(category: WordCategory, word: string): boolean {
    const custom = this.customWords.get(category);
    if (!custom) return false;

    const normalizedWord = word.toLowerCase().trim();
    const entry = custom.find(w => w.word.toLowerCase() === normalizedWord);
    
    if (entry && entry.userAdded) {
      // Increase weight slightly, max 0.9 for learned words
      entry.weight = Math.min(entry.weight + 0.05, 0.9);
      entry.usageCount = (entry.usageCount || 0) + 1;
      this.saveCustomWords();
      return true;
    }
    
    return false;
  }

  /**
   * Reduce word weight based on negative feedback
   * Call this when a word leads to incorrect detection
   */
  penalizeWord(category: WordCategory, word: string): boolean {
    const custom = this.customWords.get(category);
    if (!custom) return false;

    const normalizedWord = word.toLowerCase().trim();
    const entryIndex = custom.findIndex(w => w.word.toLowerCase() === normalizedWord);
    
    if (entryIndex !== -1 && custom[entryIndex].userAdded) {
      const entry = custom[entryIndex];
      entry.weight = Math.max(entry.weight - 0.1, 0.1);
      
      // Remove words that have been penalized too much
      if (entry.weight <= 0.2) {
        custom.splice(entryIndex, 1);
        this.customWords.set(category, custom);
      }
      
      this.saveCustomWords();
      return true;
    }
    
    return false;
  }
}

// Export singleton instance
export const scriptWordBank = new ScriptWordBankService();

// Export category info for UI
export const CATEGORY_INFO: Record<WordCategory, { name: string; nameNo: string; description: string }> = {
  conflict: { 
    name: 'Conflict', 
    nameNo: 'Konflikt',
    description: 'Scenes with confrontation, arguments, or physical/verbal disputes'
  },
  climax: { 
    name: 'Climax', 
    nameNo: 'Klimaks',
    description: 'Peak dramatic moments, revelations, and turning points'
  },
  exposition: { 
    name: 'Exposition', 
    nameNo: 'Eksposisjon',
    description: 'Scene setup, introductions, and world-building'
  },
  resolution: { 
    name: 'Resolution', 
    nameNo: 'Oppløsning',
    description: 'Conclusions, peace, closure, and endings'
  },
  rising_action: { 
    name: 'Rising Action', 
    nameNo: 'Stigende handling',
    description: 'Building tension, complications, and increasing stakes'
  },
  falling_action: { 
    name: 'Falling Action', 
    nameNo: 'Fallende handling',
    description: 'Aftermath, consequences, and winding down'
  },
  transition: { 
    name: 'Transition', 
    nameNo: 'Overgang',
    description: 'Scene changes, time jumps, and location shifts'
  },
  character_development: { 
    name: 'Character Development', 
    nameNo: 'Karakterutvikling',
    description: 'Personal growth, change, and inner journey'
  },
  subplot: { 
    name: 'Subplot', 
    nameNo: 'Sidehandling',
    description: 'Secondary storylines and side character arcs'
  },
  romance: { 
    name: 'Romance', 
    nameNo: 'Romantikk',
    description: 'Romantic relationships and love stories'
  },
  comedy: { 
    name: 'Comedy', 
    nameNo: 'Komedie',
    description: 'Humorous and light-hearted scenes'
  },
  horror: { 
    name: 'Horror', 
    nameNo: 'Skrekk',
    description: 'Frightening and suspenseful horror elements'
  },
  thriller: { 
    name: 'Thriller', 
    nameNo: 'Thriller',
    description: 'High-tension suspense and excitement'
  },
  action: { 
    name: 'Action', 
    nameNo: 'Action',
    description: 'Physical action sequences and stunts'
  },
  drama: { 
    name: 'Drama', 
    nameNo: 'Drama',
    description: 'Emotional and serious dramatic scenes'
  },
  mystery: { 
    name: 'Mystery', 
    nameNo: 'Mysterium',
    description: 'Puzzles, investigations, and secrets'
  }
};
