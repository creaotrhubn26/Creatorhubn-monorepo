/**
 * Grammar ML Service
 * 
 * Machine learning-based grammar correction system with:
 * - Grammar correction (syntax, agreement, tense)
 * - Spelling & punctuation
 * - Learning from user corrections (edited vs unedited text)
 * - Adaptive aggressiveness based on user preferences
 * - Real-time suggestions
 * 
 * Architecture:
 * - Pattern-based rules for common grammar mistakes
 * - Statistical language model for confidence scoring
 * - User preference learning via correction history
 * - Parallel corpora tracking (before → after)
 */

import settingsService, { getCurrentUserId } from './settingsService';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GrammarError {
  id: string;
  type: 'grammar' | 'spelling' | 'punctuation' | 'style' | 'agreement' | 'tense';
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  shortMessage: string;
  context: string;
  offset: number;
  length: number;
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  originalText: string;
  suggestions: GrammarSuggestion[];
  ruleId: string;
  confidence: number; // 0-1, affects whether to show based on aggressiveness
}

export interface GrammarSuggestion {
  text: string;
  confidence: number;
  source: 'rule' | 'ml' | 'learned';
}

export interface CorrectionRecord {
  id: string;
  timestamp: number;
  originalText: string;
  correctedText: string;
  ruleId: string;
  errorType: GrammarError['type'];
  accepted: boolean; // true if user accepted suggestion, false if ignored
  context: string; // surrounding text for learning
}

export interface UserPreferences {
  aggressiveness: number; // 0-1, higher = more suggestions
  enabledCategories: {
    grammar: boolean;
    spelling: boolean;
    punctuation: boolean;
    style: boolean;
    agreement: boolean;
    tense: boolean;
  };
  ignoredRules: string[];
  customPatterns: PatternRule[];
  confidenceThreshold: number; // Only show suggestions above this confidence
}

export interface PatternRule {
  id: string;
  pattern: RegExp | string;
  replacement: string | ((match: RegExpMatchArray) => string);
  message: string;
  type: GrammarError['type'];
  severity: GrammarError['severity'];
  enabled: boolean;
  language: 'no' | 'en' | 'both';
}

export interface GrammarCheckResult {
  errors: GrammarError[];
  stats: {
    totalErrors: number;
    grammarErrors: number;
    spellingErrors: number;
    punctuationErrors: number;
    styleIssues: number;
    agreementErrors: number;
    tenseErrors: number;
    processingTime: number;
  };
  confidence: number;
}

export interface LanguageModel {
  ngramFrequencies: Map<string, number>;
  wordFrequencies: Map<string, number>;
  totalWords: number;
  bigramTransitions: Map<string, Map<string, number>>;
}

// ============================================================================
// Grammar Rules Database
// ============================================================================

const NORWEGIAN_GRAMMAR_RULES: PatternRule[] = [
  // Subject-verb agreement
  {
    id: 'no-agreement-han-hun',
    pattern: /\b(han|hun)\s+(er|var|har|hadde)\s+(\w+e)\b/gi,
    replacement: (m) => `${m[1]} ${m[2]} ${m[3].slice(0, -1)}`,
    message: 'Subjekt-verb samsvar: entall form trengs',
    type: 'agreement',
    severity: 'error',
    enabled: true,
    language: 'no',
  },
  {
    id: 'no-agreement-de-vi',
    pattern: /\b(de|vi)\s+(er|var)\s+(\w+[^e])\b(?!\s+til|\s+i|\s+på)/gi,
    replacement: (m) => `${m[1]} ${m[2]} ${m[3]}e`,
    message: 'Subjekt-verb samsvar: flertall form trengs',
    type: 'agreement',
    severity: 'warning',
    enabled: true,
    language: 'no',
  },
  // Tense consistency
  {
    id: 'no-tense-mixing',
    pattern: /\b(han|hun|de|vi)\s+(er)\s+(\w+te)\b/gi,
    replacement: (m) => `${m[1]} ${m[2]} ${m[3].slice(0, -2)}r`,
    message: 'Inkonsistent tempus: blanding av nåtid og fortid',
    type: 'tense',
    severity: 'warning',
    enabled: true,
    language: 'no',
  },
  // Common spelling mistakes
  {
    id: 'no-spelling-og-å',
    pattern: /\bfor\s+og\s+(\w+e)\b/gi,
    replacement: 'for å $1',
    message: 'Bruk "å" foran infinitiv, ikke "og"',
    type: 'grammar',
    severity: 'error',
    enabled: true,
    language: 'no',
  },
  {
    id: 'no-spelling-da-når',
    pattern: /\bnår\s+(han|hun|de|vi)\s+(var|hadde|kom)\b/gi,
    replacement: 'da $1 $2',
    message: 'Bruk "da" for fortid, "når" for nåtid/fremtid',
    type: 'grammar',
    severity: 'warning',
    enabled: true,
    language: 'no',
  },
  // Double consonants
  {
    id: 'no-double-consonant',
    pattern: /\b(kom|løp|sat|tok|gik)\b/gi,
    replacement: (m) => {
      const fixes: Record<string, string> = { kom: 'kom', løp: 'løp', sat: 'satt', tok: 'tok', gik: 'gikk' };
      return fixes[m[1].toLowerCase()] || m[1];
    },
    message: 'Mulig stavefeil med dobbel konsonant',
    type: 'spelling',
    severity: 'warning',
    enabled: true,
    language: 'no',
  },
  // Punctuation
  {
    id: 'no-comma-before-og',
    pattern: /,\s+og\s+(?!så\b|derfor\b)/gi,
    replacement: ' og ',
    message: 'Komma før "og" er vanligvis unødvendig på norsk',
    type: 'punctuation',
    severity: 'suggestion',
    enabled: true,
    language: 'no',
  },
  // Det/de confusion
  {
    id: 'no-det-de',
    pattern: /\bdet\s+(er|var)\s+mange\b/gi,
    replacement: 'de $1 mange',
    message: 'Bruk "de" med flertall',
    type: 'agreement',
    severity: 'error',
    enabled: true,
    language: 'no',
  },
];

const ENGLISH_GRAMMAR_RULES: PatternRule[] = [
  // Subject-verb agreement
  {
    id: 'en-agreement-he-she',
    pattern: /\b(he|she|it)\s+(are|were|have)\b/gi,
    replacement: (m) => {
      const fixes: Record<string, string> = { are: 'is', were: 'was', have: 'has' };
      return `${m[1]} ${fixes[m[2].toLowerCase()]}`;
    },
    message: 'Subject-verb agreement: singular subject requires singular verb',
    type: 'agreement',
    severity: 'error',
    enabled: true,
    language: 'en',
  },
  {
    id: 'en-agreement-they-we',
    pattern: /\b(they|we)\s+(is|was|has)\b/gi,
    replacement: (m) => {
      const fixes: Record<string, string> = { is: 'are', was: 'were', has: 'have' };
      return `${m[1]} ${fixes[m[2].toLowerCase()]}`;
    },
    message: 'Subject-verb agreement: plural subject requires plural verb',
    type: 'agreement',
    severity: 'error',
    enabled: true,
    language: 'en',
  },
  // Tense errors
  {
    id: 'en-tense-did-base',
    pattern: /\bdid\s+(\w+ed)\b/gi,
    replacement: (m) => `did ${m[1].replace(/ed$/, '')}`,
    message: 'Use base form after "did", not past tense',
    type: 'tense',
    severity: 'error',
    enabled: true,
    language: 'en',
  },
  {
    id: 'en-tense-has-past',
    pattern: /\b(has|have)\s+(\w+)\s+(?!been\b)(\w+ed)\b/gi,
    replacement: (m) => `${m[1]} ${m[2]} ${m[3]}`,
    message: 'Check tense consistency with present perfect',
    type: 'tense',
    severity: 'warning',
    enabled: true,
    language: 'en',
  },
  // Common confusions
  {
    id: 'en-their-there-theyre',
    pattern: /\b(their)\s+(is|are|was|were)\b/gi,
    replacement: "there $2",
    message: '"their" is possessive, use "there" with "is/are"',
    type: 'grammar',
    severity: 'error',
    enabled: true,
    language: 'en',
  },
  {
    id: 'en-your-youre',
    pattern: /\b(your)\s+(a|an|the|very|so|really)\b/gi,
    replacement: "you're $2",
    message: '"your" is possessive, use "you\'re" (you are)',
    type: 'grammar',
    severity: 'error',
    enabled: true,
    language: 'en',
  },
  {
    id: 'en-its-its',
    pattern: /\b(it's)\s+(own|self)\b/gi,
    replacement: 'its $2',
    message: '"it\'s" means "it is", use "its" for possession',
    type: 'grammar',
    severity: 'error',
    enabled: true,
    language: 'en',
  },
  // Article usage
  {
    id: 'en-article-a-an',
    pattern: /\ba\s+([aeiouAEIOU]\w+)\b/gi,
    replacement: 'an $1',
    message: 'Use "an" before words starting with a vowel sound',
    type: 'grammar',
    severity: 'warning',
    enabled: true,
    language: 'en',
  },
  {
    id: 'en-article-an-consonant',
    pattern: /\ban\s+([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]\w+)\b/gi,
    replacement: (m) => {
      // Exception for silent h and some special cases
      const exceptions = ['hour', 'honor', 'honest', 'heir'];
      if (exceptions.some(e => m[1].toLowerCase().startsWith(e))) {
        return `an ${m[1]}`;
      }
      return `a ${m[1]}`;
    },
    message: 'Use "a" before words starting with a consonant sound',
    type: 'grammar',
    severity: 'warning',
    enabled: true,
    language: 'en',
  },
  // Punctuation
  {
    id: 'en-comma-splice',
    pattern: /[a-z],\s+[a-z]/g,
    replacement: '', // Complex - needs manual review
    message: 'Possible comma splice - consider using a semicolon or conjunction',
    type: 'punctuation',
    severity: 'suggestion',
    enabled: true,
    language: 'en',
  },
  {
    id: 'en-double-space',
    pattern: /\s{2,}/g,
    replacement: ' ',
    message: 'Remove extra spaces',
    type: 'punctuation',
    severity: 'warning',
    enabled: true,
    language: 'en',
  },
  // Style suggestions
  {
    id: 'en-passive-voice',
    pattern: /\b(was|were|is|are|been|being)\s+(\w+ed)\s+by\b/gi,
    replacement: '', // Suggestion only, no auto-fix
    message: 'Consider using active voice for stronger writing',
    type: 'style',
    severity: 'suggestion',
    enabled: true,
    language: 'en',
  },
];

// ============================================================================
// N-gram Language Model
// ============================================================================

class SimpleLanguageModel {
  private unigrams: Map<string, number> = new Map();
  private bigrams: Map<string, Map<string, number>> = new Map();
  private trigrams: Map<string, Map<string, number>> = new Map();
  private totalWords = 0;
  private vocabulary = new Set<string>();

  // Train on text corpus
  train(text: string): void {
    const words = this.tokenize(text);
    this.totalWords += words.length;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      this.vocabulary.add(word);

      // Unigrams
      this.unigrams.set(word, (this.unigrams.get(word) || 0) + 1);

      // Bigrams
      if (i > 0) {
        const prev = words[i - 1].toLowerCase();
        if (!this.bigrams.has(prev)) {
          this.bigrams.set(prev, new Map());
        }
        const bigramMap = this.bigrams.get(prev)!;
        bigramMap.set(word, (bigramMap.get(word) || 0) + 1);
      }

      // Trigrams
      if (i > 1) {
        const prevPrev = words[i - 2].toLowerCase();
        const prev = words[i - 1].toLowerCase();
        const key = `${prevPrev} ${prev}`;
        if (!this.trigrams.has(key)) {
          this.trigrams.set(key, new Map());
        }
        const trigramMap = this.trigrams.get(key)!;
        trigramMap.set(word, (trigramMap.get(word) || 0) + 1);
      }
    }
  }

  // Get probability of a word given context
  getWordProbability(word: string, context: string[]): number {
    word = word.toLowerCase();
    
    if (context.length >= 2) {
      // Try trigram
      const key = `${context[context.length - 2]} ${context[context.length - 1]}`.toLowerCase();
      const trigramMap = this.trigrams.get(key);
      if (trigramMap) {
        const total = Array.from(trigramMap.values()).reduce((a, b) => a + b, 0);
        const count = trigramMap.get(word) || 0;
        if (count > 0) {
          return count / total;
        }
      }
    }

    if (context.length >= 1) {
      // Try bigram
      const prev = context[context.length - 1].toLowerCase();
      const bigramMap = this.bigrams.get(prev);
      if (bigramMap) {
        const total = Array.from(bigramMap.values()).reduce((a, b) => a + b, 0);
        const count = bigramMap.get(word) || 0;
        if (count > 0) {
          return count / total * 0.8; // Slightly lower confidence
        }
      }
    }

    // Fall back to unigram
    const count = this.unigrams.get(word) || 0;
    return (count / this.totalWords) * 0.5;
  }

  // Suggest likely words given context
  suggestWords(context: string[], topN: number = 5): string[] {
    const candidates = new Map<string, number>();

    if (context.length >= 2) {
      const key = `${context[context.length - 2]} ${context[context.length - 1]}`.toLowerCase();
      const trigramMap = this.trigrams.get(key);
      if (trigramMap) {
        for (const [word, count] of trigramMap) {
          candidates.set(word, (candidates.get(word) || 0) + count * 3);
        }
      }
    }

    if (context.length >= 1) {
      const prev = context[context.length - 1].toLowerCase();
      const bigramMap = this.bigrams.get(prev);
      if (bigramMap) {
        for (const [word, count] of bigramMap) {
          candidates.set(word, (candidates.get(word) || 0) + count * 2);
        }
      }
    }

    return Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);
  }

  // Score a sentence
  scoreSentence(sentence: string): number {
    const words = this.tokenize(sentence);
    if (words.length === 0) return 0;

    let logProb = 0;
    for (let i = 0; i < words.length; i++) {
      const context = words.slice(Math.max(0, i - 2), i);
      const prob = this.getWordProbability(words[i], context);
      logProb += Math.log(prob + 1e-10);
    }

    return Math.exp(logProb / words.length);
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\sæøåÆØÅ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  // Export model for persistence
  export(): object {
    return {
      unigrams: Object.fromEntries(this.unigrams),
      bigrams: Object.fromEntries(
        Array.from(this.bigrams.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
      trigrams: Object.fromEntries(
        Array.from(this.trigrams.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
      totalWords: this.totalWords,
      vocabulary: Array.from(this.vocabulary),
    };
  }

  // Import model from persistence
  import(data: any): void {
    if (data.unigrams) {
      this.unigrams = new Map(Object.entries(data.unigrams));
    }
    if (data.bigrams) {
      this.bigrams = new Map(
        Object.entries(data.bigrams).map(([k, v]: [string, any]) => [k, new Map(Object.entries(v))])
      );
    }
    if (data.trigrams) {
      this.trigrams = new Map(
        Object.entries(data.trigrams).map(([k, v]: [string, any]) => [k, new Map(Object.entries(v))])
      );
    }
    if (data.totalWords) {
      this.totalWords = data.totalWords;
    }
    if (data.vocabulary) {
      this.vocabulary = new Set(data.vocabulary);
    }
  }
}

// ============================================================================
// User Preference Learning System
// ============================================================================

class PreferenceLearner {
  private corrections: CorrectionRecord[] = [];
  private ruleAcceptanceRates: Map<string, { accepted: number; ignored: number }> = new Map();
  private typePreferences: Map<GrammarError['type'], number> = new Map();
  private learnedPatterns: Map<string, string> = new Map(); // original → corrected

  constructor() {
    void this.hydrateFromDb();
  }

  // Record a user correction
  recordCorrection(record: CorrectionRecord): void {
    this.corrections.push(record);

    // Update rule acceptance rate
    const ruleStats = this.ruleAcceptanceRates.get(record.ruleId) || { accepted: 0, ignored: 0 };
    if (record.accepted) {
      ruleStats.accepted++;
    } else {
      ruleStats.ignored++;
    }
    this.ruleAcceptanceRates.set(record.ruleId, ruleStats);

    // Update type preferences
    const currentPref = this.typePreferences.get(record.errorType) || 0.5;
    const adjustment = record.accepted ? 0.05 : -0.05;
    this.typePreferences.set(record.errorType, Math.max(0, Math.min(1, currentPref + adjustment)));

    // Learn from before → after patterns
    if (record.accepted && record.originalText !== record.correctedText) {
      this.learnedPatterns.set(
        record.originalText.toLowerCase(),
        record.correctedText
      );
    }

    this.saveToStorage();
  }

  // Get adjusted confidence for a rule based on user history
  getAdjustedConfidence(ruleId: string, baseConfidence: number): number {
    const stats = this.ruleAcceptanceRates.get(ruleId);
    if (!stats) return baseConfidence;

    const total = stats.accepted + stats.ignored;
    if (total < 3) return baseConfidence; // Need more data

    const acceptanceRate = stats.accepted / total;
    return baseConfidence * (0.5 + acceptanceRate * 0.5);
  }

  // Get user's preference for error type
  getTypePreference(type: GrammarError['type']): number {
    return this.typePreferences.get(type) || 0.5;
  }

  // Check if we've learned a correction for this text
  getLearnedCorrection(text: string): string | null {
    return this.learnedPatterns.get(text.toLowerCase()) || null;
  }

  // Get suggested aggressiveness based on user behavior
  getSuggestedAggressiveness(): number {
    const totalAccepted = Array.from(this.ruleAcceptanceRates.values())
      .reduce((sum, s) => sum + s.accepted, 0);
    const totalIgnored = Array.from(this.ruleAcceptanceRates.values())
      .reduce((sum, s) => sum + s.ignored, 0);
    const total = totalAccepted + totalIgnored;

    if (total < 10) return 0.5; // Default

    // Higher acceptance rate → higher aggressiveness
    return 0.3 + (totalAccepted / total) * 0.6;
  }

  // Export parallel corpora (before → after)
  exportParallelCorpora(): Array<{ before: string; after: string; context: string }> {
    return this.corrections
      .filter(c => c.accepted && c.originalText !== c.correctedText)
      .map(c => ({
        before: c.originalText,
        after: c.correctedText,
        context: c.context,
      }));
  }

  private async hydrateFromDb(): Promise<void> {
    try {
      const userId = getCurrentUserId();
      const remote = await settingsService.getSetting<any>('grammarML_preferences', { userId });
      if (!remote) return;
      this.corrections = remote.corrections || [];
      this.ruleAcceptanceRates = new Map(Object.entries(remote.ruleAcceptanceRates || {}));
      this.typePreferences = new Map(
        Object.entries(remote.typePreferences || {}) as Array<[GrammarError['type'], number]>
      );
      this.learnedPatterns = new Map(Object.entries(remote.learnedPatterns || {}));

    } catch (e) {
      console.warn('Failed to hydrate grammar preferences:', e);
    }
  }

  private saveToStorage(): void {
    try {
      // Keep only last 1000 corrections
      if (this.corrections.length > 1000) {
        this.corrections = this.corrections.slice(-1000);
      }

      const data = {
        corrections: this.corrections,
        ruleAcceptanceRates: Object.fromEntries(this.ruleAcceptanceRates),
        typePreferences: Object.fromEntries(this.typePreferences),
        learnedPatterns: Object.fromEntries(this.learnedPatterns),
      };
      void settingsService.setSetting('grammarML_preferences', data, { userId: getCurrentUserId() });
    } catch (e) {
      console.warn('Failed to save grammar preferences:', e);
    }
  }

  // Get stats for display
  getStats(): {
    totalCorrections: number;
    acceptanceRate: number;
    learnedPatterns: number;
    topAcceptedRules: string[];
    topIgnoredRules: string[];
  } {
    const totalAccepted = Array.from(this.ruleAcceptanceRates.values())
      .reduce((sum, s) => sum + s.accepted, 0);
    const totalIgnored = Array.from(this.ruleAcceptanceRates.values())
      .reduce((sum, s) => sum + s.ignored, 0);

    const rulesByAcceptance = Array.from(this.ruleAcceptanceRates.entries())
      .map(([id, stats]) => ({
        id,
        rate: stats.accepted / (stats.accepted + stats.ignored),
        total: stats.accepted + stats.ignored,
      }))
      .filter(r => r.total >= 3);

    return {
      totalCorrections: this.corrections.length,
      acceptanceRate: totalAccepted / (totalAccepted + totalIgnored) || 0,
      learnedPatterns: this.learnedPatterns.size,
      topAcceptedRules: rulesByAcceptance
        .filter(r => r.rate > 0.7)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5)
        .map(r => r.id),
      topIgnoredRules: rulesByAcceptance
        .filter(r => r.rate < 0.3)
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 5)
        .map(r => r.id),
    };
  }
}

// ============================================================================
// Real-time Grammar Checker
// ============================================================================

class RealTimeChecker {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastContent: string = '';
  private cache: Map<string, GrammarError[]> = new Map();
  private subscribers: Array<(errors: GrammarError[]) => void> = [];

  // Subscribe to real-time updates
  subscribe(callback: (errors: GrammarError[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const idx = this.subscribers.indexOf(callback);
      if (idx >= 0) this.subscribers.splice(idx, 1);
    };
  }

  // Notify subscribers
  private notify(errors: GrammarError[]): void {
    this.subscribers.forEach(cb => cb(errors));
  }

  // Check content with debouncing for real-time feel
  checkRealTime(
    content: string,
    checker: (text: string) => Promise<GrammarCheckResult>,
    debounceMs: number = 300
  ): void {
    if (content === this.lastContent && this.cache.has(content)) {
      this.notify(this.cache.get(content) || []);
      return;
    }

    this.lastContent = content;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Immediate check for cached content
    const cached = this.cache.get(content);
    if (cached) {
      this.notify(cached);
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const result = await checker(content);
        this.cache.set(content, result.errors);
        
        // Limit cache size
        if (this.cache.size > 100) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }

        this.notify(result.errors);
        this.lastContent = content;
      } catch (e) {
        console.error('Real-time check failed:', e);
      }
    }, debounceMs);
  }

  // Get errors near cursor for inline suggestions
  getErrorsNearPosition(
    errors: GrammarError[],
    lineNumber: number,
    column: number,
    range: number = 50
  ): GrammarError[] {
    return errors.filter(e => {
      if (e.lineNumber !== lineNumber) return false;
      return Math.abs(e.columnStart - column) < range;
    });
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Main Grammar ML Service
// ============================================================================

class GrammarMLServiceClass {
  private languageModel: SimpleLanguageModel;
  private preferenceLearner: PreferenceLearner;
  private realTimeChecker: RealTimeChecker;
  private preferences: UserPreferences;
  private allRules: PatternRule[];

  constructor() {
    this.languageModel = new SimpleLanguageModel();
    this.preferenceLearner = new PreferenceLearner();
    this.realTimeChecker = new RealTimeChecker();
    this.allRules = [...NORWEGIAN_GRAMMAR_RULES, ...ENGLISH_GRAMMAR_RULES];
    
    this.preferences = this.loadPreferences();
    this.initializeBaseTraining();
    void this.hydrateFromDb();
  }

  // ============================================================================
  // Core Grammar Checking
  // ============================================================================

  async checkDocument(content: string): Promise<GrammarCheckResult> {
    const startTime = performance.now();
    const errors: GrammarError[] = [];
    const lines = content.split('\n');

    // Detect primary language
    const language = this.detectLanguage(content);

    // Apply pattern rules
    let offset = 0;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNumber = lineIdx + 1;

      for (const rule of this.allRules) {
        if (!rule.enabled) continue;
        if (rule.language !== 'both' && rule.language !== language) continue;
        if (this.preferences.ignoredRules.includes(rule.id)) continue;
        if (!this.preferences.enabledCategories[rule.type]) continue;

        const pattern = typeof rule.pattern === 'string' 
          ? new RegExp(rule.pattern, 'gi') 
          : rule.pattern;

        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(line)) !== null) {
          const baseConfidence = this.calculateBaseConfidence(rule, match[0], line);
          const adjustedConfidence = this.preferenceLearner.getAdjustedConfidence(
            rule.id,
            baseConfidence
          );

          // Apply aggressiveness filter
          if (adjustedConfidence < this.preferences.confidenceThreshold) continue;
          if (adjustedConfidence < (1 - this.preferences.aggressiveness)) continue;

          const suggestions = this.generateSuggestions(rule, match, line);

          errors.push({
            id: `${rule.id}-${lineNumber}-${match.index}`,
            type: rule.type,
            severity: rule.severity,
            message: rule.message,
            shortMessage: rule.message.split(':')[0] || rule.message,
            context: line,
            offset: offset + match.index,
            length: match[0].length,
            lineNumber,
            columnStart: match.index,
            columnEnd: match.index + match[0].length,
            originalText: match[0],
            suggestions,
            ruleId: rule.id,
            confidence: adjustedConfidence,
          });
        }
      }

      // Check for learned patterns
      const learnedErrors = this.checkLearnedPatterns(line, lineNumber, offset);
      errors.push(...learnedErrors);

      offset += line.length + 1;
    }

    // Sort by confidence (highest first) then by position
    errors.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.offset - b.offset;
    });

    const processingTime = performance.now() - startTime;

    return {
      errors,
      stats: {
        totalErrors: errors.length,
        grammarErrors: errors.filter(e => e.type === 'grammar').length,
        spellingErrors: errors.filter(e => e.type === 'spelling').length,
        punctuationErrors: errors.filter(e => e.type === 'punctuation').length,
        styleIssues: errors.filter(e => e.type === 'style').length,
        agreementErrors: errors.filter(e => e.type === 'agreement').length,
        tenseErrors: errors.filter(e => e.type === 'tense').length,
        processingTime,
      },
      confidence: errors.length > 0 
        ? errors.reduce((sum, e) => sum + e.confidence, 0) / errors.length 
        : 1,
    };
  }

  // Check in real-time with debouncing
  checkRealTime(content: string, debounceMs: number = 300): void {
    this.realTimeChecker.checkRealTime(
      content,
      (text) => this.checkDocument(text),
      debounceMs
    );
  }

  // Subscribe to real-time updates
  subscribeToUpdates(callback: (errors: GrammarError[]) => void): () => void {
    return this.realTimeChecker.subscribe(callback);
  }

  // ============================================================================
  // Learning & Adaptation
  // ============================================================================

  // Record user accepting a suggestion
  acceptSuggestion(
    error: GrammarError,
    suggestion: GrammarSuggestion,
    context: string
  ): void {
    this.preferenceLearner.recordCorrection({
      id: `correction-${Date.now()}`,
      timestamp: Date.now(),
      originalText: error.originalText,
      correctedText: suggestion.text,
      ruleId: error.ruleId,
      errorType: error.type,
      accepted: true,
      context,
    });

    // Train language model on correction
    this.languageModel.train(context.replace(error.originalText, suggestion.text));
    this.saveLanguageModel();
  }

  // Record user ignoring a suggestion
  ignoreSuggestion(error: GrammarError, context: string): void {
    this.preferenceLearner.recordCorrection({
      id: `correction-${Date.now()}`,
      timestamp: Date.now(),
      originalText: error.originalText,
      correctedText: error.originalText,
      ruleId: error.ruleId,
      errorType: error.type,
      accepted: false,
      context,
    });
  }

  // Add user's own correction (not from suggestions)
  recordManualCorrection(
    originalText: string,
    correctedText: string,
    context: string,
    errorType: GrammarError['type'] = 'grammar'
  ): void {
    this.preferenceLearner.recordCorrection({
      id: `manual-${Date.now()}`,
      timestamp: Date.now(),
      originalText,
      correctedText,
      ruleId: 'manual-correction',
      errorType,
      accepted: true,
      context,
    });

    // Train on the correction
    this.languageModel.train(context.replace(originalText, correctedText));
    this.saveLanguageModel();
  }

  // Train on a document (good for learning style)
  trainOnDocument(content: string): void {
    this.languageModel.train(content);
    this.saveLanguageModel();
  }

  // ============================================================================
  // Preferences Management
  // ============================================================================

  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<UserPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  setAggressiveness(level: number): void {
    this.preferences.aggressiveness = Math.max(0, Math.min(1, level));
    this.savePreferences();
  }

  ignoreRule(ruleId: string): void {
    if (!this.preferences.ignoredRules.includes(ruleId)) {
      this.preferences.ignoredRules.push(ruleId);
      this.savePreferences();
    }
  }

  enableRule(ruleId: string): void {
    this.preferences.ignoredRules = this.preferences.ignoredRules.filter(id => id !== ruleId);
    this.savePreferences();
  }

  toggleCategory(category: keyof UserPreferences['enabledCategories'], enabled: boolean): void {
    this.preferences.enabledCategories[category] = enabled;
    this.savePreferences();
  }

  // ============================================================================
  // Statistics & Insights
  // ============================================================================

  getStats(): {
    learningStats: ReturnType<PreferenceLearner['getStats']>;
    suggestedAggressiveness: number;
    modelSize: number;
    preferences: UserPreferences;
  } {
    const exported = this.languageModel.export() as { totalWords: number };
    return {
      learningStats: this.preferenceLearner.getStats(),
      suggestedAggressiveness: this.preferenceLearner.getSuggestedAggressiveness(),
      modelSize: exported.totalWords,
      preferences: this.preferences,
    };
  }

  // Export parallel corpora for external training
  exportParallelCorpora(): Array<{ before: string; after: string; context: string }> {
    return this.preferenceLearner.exportParallelCorpora();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private detectLanguage(text: string): 'no' | 'en' {
    const norwegianIndicators = [
      /\bå\b/i, /\bæ/i, /\bø/i, /\bdet\s+er\b/i, /\bjeg\b/i, /\bhun\b/i, /\bhan\b/i,
      /\bfor\s+å\b/i, /\bmed\b/i, /\bog\b/i, /\bsom\b/i, /\bpå\b/i,
    ];
    const englishIndicators = [
      /\bthe\b/i, /\bis\b/i, /\bare\b/i, /\bwas\b/i, /\bwere\b/i,
      /\bhave\b/i, /\bhas\b/i, /\bwould\b/i, /\bcould\b/i, /\bshould\b/i,
    ];

    let noScore = 0;
    let enScore = 0;

    for (const pattern of norwegianIndicators) {
      if (pattern.test(text)) noScore++;
    }
    for (const pattern of englishIndicators) {
      if (pattern.test(text)) enScore++;
    }

    return noScore > enScore ? 'no' : 'en';
  }

  private calculateBaseConfidence(rule: PatternRule, match: string, line: string): number {
    let confidence = 0.8;

    // Adjust based on severity
    if (rule.severity === 'error') confidence += 0.1;
    if (rule.severity === 'suggestion') confidence -= 0.2;

    // Adjust based on context (language model)
    const words = line.split(/\s+/);
    const matchIdx = words.findIndex(w => w.includes(match.split(/\s+/)[0]));
    if (matchIdx > 0) {
      const context = words.slice(Math.max(0, matchIdx - 2), matchIdx);
      const prob = this.languageModel.getWordProbability(match.split(/\s+/)[0], context);
      if (prob > 0.1) confidence -= 0.1; // Common pattern, might be intentional
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  private generateSuggestions(
    rule: PatternRule,
    match: RegExpExecArray,
    line: string
  ): GrammarSuggestion[] {
    const suggestions: GrammarSuggestion[] = [];

    // Check for learned correction first
    const learned = this.preferenceLearner.getLearnedCorrection(match[0]);
    if (learned) {
      suggestions.push({
        text: learned,
        confidence: 0.95,
        source: 'learned',
      });
    }

    // Apply rule replacement
    if (rule.replacement) {
      let replacement: string;
      if (typeof rule.replacement === 'function') {
        replacement = rule.replacement(match);
      } else {
        replacement = match[0].replace(
          typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'gi') : rule.pattern,
          rule.replacement
        );
      }
      
      if (replacement && replacement !== match[0]) {
        suggestions.push({
          text: replacement,
          confidence: 0.8,
          source: 'rule',
        });
      }
    }

    // Add ML-based suggestions from language model
    const words = line.split(/\s+/);
    const matchWords = match[0].split(/\s+/);
    const matchIdx = words.findIndex(w => w === matchWords[0]);
    if (matchIdx >= 0) {
      const context = words.slice(Math.max(0, matchIdx - 2), matchIdx);
      const mlSuggestions = this.languageModel.suggestWords(context, 3);
      for (const suggestion of mlSuggestions) {
        if (!suggestions.some(s => s.text.toLowerCase() === suggestion.toLowerCase())) {
          suggestions.push({
            text: suggestion,
            confidence: 0.5,
            source: 'ml',
          });
        }
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, 5);
  }

  private checkLearnedPatterns(
    line: string,
    lineNumber: number,
    offset: number
  ): GrammarError[] {
    const errors: GrammarError[] = [];
    const corpora = this.preferenceLearner.exportParallelCorpora();

    for (const { before, after } of corpora) {
      const idx = line.toLowerCase().indexOf(before.toLowerCase());
      if (idx >= 0) {
        errors.push({
          id: `learned-${lineNumber}-${idx}`,
          type: 'grammar',
          severity: 'suggestion',
          message: `Du har tidligere rettet dette til "${after}"`,
          shortMessage: 'Lært korrektur',
          context: line,
          offset: offset + idx,
          length: before.length,
          lineNumber,
          columnStart: idx,
          columnEnd: idx + before.length,
          originalText: line.substring(idx, idx + before.length),
          suggestions: [{
            text: after,
            confidence: 0.9,
            source: 'learned',
          }],
          ruleId: 'learned-pattern',
          confidence: 0.85,
        });
      }
    }

    return errors;
  }

  private loadPreferences(): UserPreferences {
    return {
      aggressiveness: 0.5,
      enabledCategories: {
        grammar: true,
        spelling: true,
        punctuation: true,
        style: true,
        agreement: true,
        tense: true,
      },
      ignoredRules: [],
      customPatterns: [],
      confidenceThreshold: 0.3,
    };
  }

  private async hydrateFromDb(): Promise<void> {
    try {
      const userId = getCurrentUserId();
      const prefs = await settingsService.getSetting<UserPreferences>('grammarML_userPrefs', { userId });
      if (prefs) {
        this.preferences = prefs;
      }

      const model = await settingsService.getSetting<any>('grammarML_languageModel', { userId });
      if (model) {
        this.languageModel.import(model);
      }
    } catch (e) {
      console.warn('Failed to hydrate grammar settings:', e);
    }
  }

  private savePreferences(): void {
    try {
      void settingsService.setSetting('grammarML_userPrefs', this.preferences, { userId: getCurrentUserId() });
    } catch (e) {
      console.warn('Failed to save grammar preferences:', e);
    }
  }

  private saveLanguageModel(): void {
    try {
      const exported = this.languageModel.export();
      void settingsService.setSetting('grammarML_languageModel', exported, { userId: getCurrentUserId() });
    } catch (e) {
      console.warn('Failed to save language model:', e);
    }
  }

  private initializeBaseTraining(): void {
    // Train on sample Norwegian screenplay text
    const norwegianSample = `
      INT. STUE - DAG
      ERIK sitter ved bordet. Han ser på ANNA som kommer inn.
      
      ERIK
      Hvor har du vært? Jeg har ventet i timer.
      
      ANNA
      Det var mye trafikk. Jeg kom så fort jeg kunne.
      
      Hun setter seg ned. De ser på hverandre.
      
      ERIK
      Vi må snakke om fremtiden. Om hva vi skal gjøre.
      
      ANNA
      Jeg vet. Men ikke nå. Kan vi bare sitte her litt?
    `;

    const englishSample = `
      INT. LIVING ROOM - DAY
      JOHN sits at the table. He looks at MARY as she enters.
      
      JOHN
      Where have you been? I've been waiting for hours.
      
      MARY
      There was a lot of traffic. I came as fast as I could.
      
      She sits down. They look at each other.
      
      JOHN
      We need to talk about the future. About what we're going to do.
      
      MARY
      I know. But not now. Can we just sit here for a while?
    `;

    this.languageModel.train(norwegianSample);
    this.languageModel.train(englishSample);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const grammarMLService = new GrammarMLServiceClass();

// ============================================================================
// React Hook for Real-time Grammar Checking
// ============================================================================

export function useGrammarCheck(content: string, debounceMs: number = 300) {
  const [errors, setErrors] = React.useState<GrammarError[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const unsubscribe = grammarMLService.subscribeToUpdates((newErrors) => {
      setErrors(newErrors);
      setLoading(false);
    });

    grammarMLService.checkRealTime(content, debounceMs);

    return unsubscribe;
  }, [content, debounceMs]);

  return { errors, loading };
}

// Need to import React for the hook
import React from 'react';
