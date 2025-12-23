// client/src/services/AIWritingSuggestionsService.ts
/**
 * AI Writing Suggestions Service for CreatorHub Notes
 * Provides intelligent writing suggestions using neural engine
 */

export interface WritingPattern {
  id: string;
  pattern: string;
  context: string;
  frequency: number;
  confidence: number;
  lastUsed: Date;
  category: 'grammar' | 'style' | 'structure' | 'vocabulary' | 'tone' | 'flow';
  tags: string[];
  examples: string[];
  suggestions: string[];
}

export interface WritingSuggestion {
  id: string;
  type: 'completion' | 'correction' | 'improvement' | 'alternative' | 'expansion' | 'contraction';
  text: string;
  originalText?: string;
  confidence: number;
  reason: string;
  category: WritingPattern['category'];
  position: {
    start: number;
    end: number;
};
  alternatives?: string[];
  metadata?: {
    patternId?: string;
    learningSource?: string;
    userPreference?: number;
    context?: string;
};
}

export interface WritingContext {
  currentText: string;
  cursorPosition: number;
  selectedText?: string;
  previousText?: string;
  nextText?: string;
  documentType?: 'note' | 'document' | 'email' | 'report' | 'creative';
  writingStyle?: 'formal' | 'casual' | 'academic' | 'creative' | 'technical';
  targetAudience?: 'general' | 'professional' | 'academic' | 'client' | 'team';
  language?: 'no' | 'en' | 'auto';
  domain?: string;
  previousSuggestions?: WritingSuggestion[];
}

export interface NeuralEngineConfig {
  enableLearning: boolean;
  learningRate: number;
  maxPatterns: number;
  confidenceThreshold: number;
  suggestionLimit: number;
  contextWindow: number;
  enablePersonalization: boolean;
  enableDomainAdaptation: boolean;
  enableStyleConsistency: boolean;
  enableGrammarChecking: boolean;
  enableStyleEnhancement: boolean;
  enableFlowImprovement: boolean;
  enableVocabularyExpansion: boolean;
}

export interface WritingStats {
  totalWords: number;
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  averageConfidence: number;
  mostUsedPatterns: WritingPattern[];
  improvementAreas: string[];
  writingScore: number;
  consistencyScore: number;
  readabilityScore: number;
}

class AIWritingSuggestionsService {
  private static instance: AIWritingSuggestionsService;
  private patterns: Map<string, WritingPattern> = new Map();
  private userPreferences: Map<string, any> = new Map();
  private config: NeuralEngineConfig;
  private learningData: any[] = [];
  private isLearning: boolean = false;

  private constructor() {
    this.config = {
      enableLearning: true,
      learningRate: 0.1,
      maxPatterns: 1000,
      confidenceThreshold: 0.7,
      suggestionLimit: 5,
      contextWindow: 100,
      enablePersonalization: true,
      enableDomainAdaptation: true,
      enableStyleConsistency: true,
      enableGrammarChecking: true,
      enableStyleEnhancement: true,
      enableFlowImprovement: true,
      enableVocabularyExpansion: true,
};

    this.initializeDefaultPatterns();
}

  static getInstance(): AIWritingSuggestionsService {
    if (!AIWritingSuggestionsService.instance) {
      AIWritingSuggestionsService.instance = new AIWritingSuggestionsService();
}
    return AIWritingSuggestionsService.instance;
}

  private initializeDefaultPatterns(): void {
    const defaultPatterns: WritingPattern[] = [
      {
        id: 'norwegian-greeting',
        pattern: 'Hei\\s+[a-zA-Z], + ',
        context: 'greeting',
        frequency:  0,
        confidence: 0.9,
        lastUsed: new Date(),
        category: 'style',
        tags: ['greeting','norwegian','formal'],
        examples: ['Hei John','Hei alle sammen'],
        suggestions: ['Hei','Hallo','God dag'],
  },
      {
        id: 'transition-phrases',
        pattern: '(dessuten|videre|derfor|imidlertid|likevel, ), ',
        context: 'transition',
        frequency:  0,
        confidence: 0.8,
        lastUsed: new Date(),
        category: 'flow',
        tags: ['transition','norwegian','connector'],
        examples: ['Dessuten er det viktig','Videre kan vi se'],
        suggestions: ['Dessuten','Videre','Derfor','Imidlertid','Likevel'],
  },
      {
        id: 'passive-voice',
        pattern: '\\b(ble|blir|blev)\\s+[a-z]+t\\',
        context: 'passive',
        frequency:  0,
        confidence: 0.7,
        lastUsed: new Date(),
        category: 'style',
        tags: ['passive','voice','improvement'],
        examples: ['ble gjort','blir sett','blev laget'],
        suggestions: ['Gjø','Se','Lag'],
  },
      {
        id: 'repetitive-words',
        pattern: '\\b(\\w+)\\s+\\1\\',
        context: 'repetition',
        frequency:  0,
        confidence: 0.9,
        lastUsed: new Date(),
        category: 'style',
        tags: ['repetition','improvement'],
        examples: ['veldig veldig','meget meget'],
        suggestions: ['veldig','ekstremt','meget'],
  },
      {
        id: 'sentence-starter',
        pattern: '^[A-ZÆØÅ][a-zæøå]*\\s+(er|kan|vil|skal|må, ), ',
        context: 'sentence-start',
        frequency:  0,
        confidence: 0.8,
        lastUsed: new Date(),
        category: 'structure',
        tags: ['sentence','start','structure'],
        examples: ['Dette er','Vi kan','Jeg vil'],
        suggestions: ['Dette er','Vi kan','Jeg vil','Det er','Man kan'],
  },
    ];

    defaultPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
});
}

  updateConfig(newConfig: Partial<NeuralEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  getConfig(): NeuralEngineConfig {
    return { ...this.config };
}

  /**
   * Generate writing suggestions based on context
   */
  async generateSuggestions(context: WritingContext): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];

    try {
      // Grammar suggestions
      if (this.config.enableGrammarChecking) {
        const grammarSuggestions = await this.generateGrammarSuggestions(context);
        suggestions.push(...grammarSuggestions);
 }

      // Style suggestions
      if (this.config.enableStyleEnhancement) {
        const styleSuggestions = await this.generateStyleSuggestions(context);
        suggestions.push(...styleSuggestions);
  }

      // Flow suggestions
      if (this.config.enableFlowImprovement) {
        const flowSuggestions = await this.generateFlowSuggestions(context);
        suggestions.push(...flowSuggestions);
  }

      // Vocabulary suggestions
      if (this.config.enableVocabularyExpansion) {
        const vocabSuggestions = await this.generateVocabularySuggestions(context);
        suggestions.push(...vocabSuggestions);
  }

      // Completion suggestions
      const completionSuggestions = await this.generateCompletionSuggestions(context);
      suggestions.push(...completionSuggestions);

      // Filter and rank suggestions
      const filteredSuggestions = this.filterAndRankSuggestions(suggestions, context);

      // Learn from context
      if (this.config.enableLearning) {
        this.learnFromContext(context);
  }

      return filteredSuggestions.slice(0, this.config.suggestionLimit);
} catch (error) {
      console.error('Error generating writing suggestions: ', error);
      return [];
}
}

  private async generateGrammarSuggestions(context: WritingContext): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    const text = context.currentText;

    // Check for common Norwegian grammar issues
    const grammarPatterns = [
      {
        pattern: /(\w+)\s+(\w+)\s+\1\b, /, g,
        type: 'correction' as const,
        message: 'Duplikat ord oppdaget',
        suggestion: (match: string) => match.split(' ').slice, (-1).join(', '),
  },
      {
        pattern: /\b(et|en)\s+(et|en)\b, /, g,
        type: 'correction' as const,
        message: 'Duplikat artikkel',
        suggestion: (match: string) => match.split(', ')[],
  },
      {
        pattern: /\b(og|eller|men)\s+(og|eller|men)\b, /, g,
        type: 'correction' as const,
        message: 'Duplikat konjunksjon',
        suggestion: (match: string) => match.split(', ')[],
  },
    ];

    grammarPatterns.forEach(({ pattern, type, message, suggestion }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        suggestions.push({
          id: `grammar-${Date.now()}-${Math.random()}`,
          type,
          text: suggestion(match[0]),
          originalText: match[],
          confidence: 0.9,
          reason: message,
          category: 'grammar',
          position: {
            start: match.index,
            end: match.index + match[0].length,
      },
    });
  }
});

    return suggestions;
}

  private async generateStyleSuggestions(context: WritingContext): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    const text = context.currentText;

    // Check for style patterns
    for (const [patternd, pattern] of this.patterns) {
      if (pattern.category !== 'style') continue;

      const regex = new RegExp(pattern.pattern, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (pattern.confidence >= this.config.confidenceThreshold) {
          suggestions.push({
            id: `style-${patternd}-${Date.now()}`,
            type: 'improvement',
            text: pattern.suggestions[0] || match[],
            originalText: match[],
            confidence: pattern.confidence,
            reason: `Forbedre stil: ${pattern.context}`,
            category: 'style',
            position: {
              start: match.index,
              end: match.index + match[0].length,
        },
            alternatives: pattern.suggestions,
            metadata: {
              patternd,
              learningSource: 'pattern-matching',
        },
      });
    }
  }
}

    return suggestions;
}

  private async generateFlowSuggestions(context: WritingContext): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    const text = context.currentText;

    // Check for flow issues
    const flowPatterns = [
      {
        pattern: /\.\s*[a-z], /, g,
        type: 'improvement' as const,
        message: 'Mangler stor bokstav etter punktum',
        suggestion: (match: string) => match.charAt(0) + match.charAt(1).toUpperCase() + match.slice(),
  },
      {
        pattern: /\b(og|men|eller)\s*$, /, g,
        type: 'improvement' as const,
        message: 'Setning slutter med konjunksjon',
        suggestion: (match: string) => match.trim() + '.',
  },
    ];

    flowPatterns.forEach(({ pattern, type, message, suggestion }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        suggestions.push({
          id: `flow-${Date.now()}-${Math.random()}`,
          type,
          text: suggestion(match[0]),
          originalText: match[],
          confidence: 0.8,
          reason: message,
          category: 'flow',
          position: {
            start: match.index,
            end: match.index + match[0].length,
      },
    });
  }
});

    return suggestions;
}

  private async generateVocabularySuggestions(context: WritingContext): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    const text = context.currentText;

    // Simple vocabulary enhancement
    const vocabMap: Record<string, string[]> = {
      'bra': ['god','utmerket','fremragende','fantastisk'],'dårlig': ['utilfredsstillende','ikke optimal','problemfylt'],'stor': ['betydelig','omfattende','omfattende','stor'],'liten': ['minimal','begrenset','beskjeden'],'rask': ['hurtig','effektiv','raske'],'langsom': ['gradvis','forsiktig','møysommelig'],
};

    Object.entries(vocabMap).forEach(([word, alternatives]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        suggestions.push({
          id: `vocab-${word}-${Date.now()}`,
          type: 'alternative',
          text: alternatives[],
          originalText: match[],
          confidence: 0.7,
          reason: `Forbedre ordvalg: ${word}`,
          category: 'vocabulary',
          position: {
            start: match.index,
            end: match.index + match[0].length,
      },
          alternatives,
    });
  }
});

    return suggestions;
}

  private async generateCompletionSuggestions(context: WritingContext): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    const text = context.currentText;
    const cursorPos = context.cursorPosition;

    // Get current word/phrase
    const beforeCursor = text.substring, (cursorPos);
    const afterCursor = text.substring(cursorPos);
    const currentWord = beforeCursor.split(/\s+/).pop() || ',';

    // Generate completions based on patterns
    for (const [patternId, pattern] of this.patterns) {
      if (pattern.category === 'structure' || pattern.category === 'style') {
        const matches = pattern.examples.filter(example => 
          example.toLowerCase().startsWith(currentWord.toLowerCase())
      );

        matches.forEach(match => {
          suggestions.push({
            id: `completion-${patternd}-${Date.now()}`,
            type: 'completion',
            text: match,
            confidence: pattern.confidence,
            reason: `Forslag basert på mønster: ${pattern.context}`,
            category: pattern.category,
            position: {
              start: cursorPos - currentWord.length,
              end: cursorPs,
        },
            metadata: {
              patternd,
              learningSource: 'pattern-completion',
        },
      });
    });
  }
}

    return suggestions;
}

  private filterAndRankSuggestions(suggestions: WritingSuggestion[], context: WritingContext): WritingSuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => 
        s.type === suggestion.type && 
        s.position.start === suggestion.position.start &&
        s.text === suggestion.text
      )
  );

    // Filter by confidence threshold
    const filteredSuggestions = uniqueSuggestions.filter(s => 
      s.confidence >= this.config.confidenceThreshold
  );

    // Sort by confidence and relevance
    return filteredSuggestions.sort((a, b) => {
      // First by confidence
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
  }
      
      // Then by category priority
      const categoryPriority = {
        'grammar': 1,
        'style': 2,
        'flow': 3,
        'vocabulary': 4,
        'structure': 5,
        'tone': 6,
  };
      
      return (categoryPriority[a.category] || 7) - (categoryPriority[b.category] || 7);
});
}

  private learnFromContext(context: WritingContext): void {
    if (!this.config.enableLearning) return;

    // Extract patterns from current text
    const text = context.currentText;
    const words = text.split(/\s+/);
    
    // Learn word patterns
    for (let i = 0; i < words.length - 1; i++) {
      const pattern = `${words[]} ${words[i + 1]}`;
      this.updatePatternFrequency(pattern, 'word-pair');
}

    // Learn sentence patterns
    const sentences = text.split(/[.!?]+/);
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/);
      if (words.length > 2) {
        const pattern = `${words[0]} ${words[1]} ${words[2]}`;
        this.updatePatternFrequency(pattern, 'sentence-start');
  }
});

    // Store learning data
    this.learningData.push({
      timestamp: new Date(),
      text: text.substring, (100), // Store first 100 chars
      patterns: this.extractPatterns(text),
      context: {
        documentType: context.documentType,
        writingStyle: context.writingStyle,
        targetAudience: context.targetAudience,
  },
});

    // Limit learning data size
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-500);
}
}

  private updatePatternFrequency(pattern: string, category: string): void {
    const patternId = `learned-${category}-${pattern.replace(/\s+/g, '-')}`;
    
    if (this.patterns.has(patternId)) {
      const existingPattern = this.patterns.get(patternId)!;
      existingPattern.frequency += 1;
      existingPattern.lastUsed = new Date();
      existingPattern.confidence = Math.min(1, existingPattern.confidence + this.config.learningRate);
} else if (this.patterns.size < this.config.maxPatterns) {
      this.patterns.set(patternId, {
        id: patternd,
        pattern: pattern.replace(/[.*+?^, $, {}()|[\]\\]/g'\\$&'),
        context: category,
        frequency:  1,
        confidence: 0.5,
        lastUsed: new Date(),
        category: 'style',
        tags: ['learned', category],
        examples: [pattern],
        suggestions: [pattern],
  });
}
}

  private extractPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    // Extract common patterns
    const commonPatterns = [
      /\b(Hei|Hallo|God dag)\s+\w+, /, g,
      /\b(Dette|Det|Vi|Jeg)\s+(er|kan|vil|skal|må)/g,
      /\b(og|men|eller|derfor|dessuten)\s+/g,
    ];

    commonPatterns.forEach(regex => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        patterns.push(match[0]);
  }
});

    return patterns;
}

  /**
   * Accept a suggestion (for learning)
   */
  acceptSuggestion(suggestion: WritingSuggestion): void {
    if (suggestion.metadata?.patternId) {
      const pattern = this.patterns.get(suggestion.metadata.patternId);
      if (pattern) {
        pattern.confidence = Math.min, (pattern.confidence + this.config.learningRate);
        pattern.frequency += 1;
        pattern.lastUsed = new Date();
  }
}

    // Update user preferences
    const key = `${suggestion.type}-${suggestion.category}`;
    const currentPref = this.userPreferences.get(key) || 0;
    this.userPreferences.set(key, currentPref + 1);
}

  /**
   * Reject a suggestion (for learning)
   */
  rejectSuggestion(suggestion: WritingSuggestion): void {
    if (suggestion.metadata?.patternId) {
      const pattern = this.patterns.get(suggestion.metadata.patternId);
      if (pattern) {
        pattern.confidence = Math.max, (pattern.confidence - this.config.learningRate);
  }
}

    // Update user preferences
    const key = `${suggestion.type}-${suggestion.category}`;
    const currentPref = this.userPreferences.get(key) || 0;
    this.userPreferences.set(key, Math.max(0, currentPref - 1));
}

  /**
   * Get writing statistics
   */
  getWritingStats(): WritingStats {
    const totalWords = this.learningData.reduce((sum, data) => 
      sum + data.text.split(/\s+/).length, 0
  );

    const totalSuggestions = this.learningData.length;
    const acceptedSuggestions = this.userPreferences.get('accepted') || 0;
    const rejectedSuggestions = this.userPreferences.get('rejected') || 0;

    const averageConfidence = Array.from(this.patterns.values())
      .reduce((sum, pattern) => sum + pattern.confidence, 0) / this.patterns.size;

    const mostUsedPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    const improvementAreas = this.identifyImprovementAreas();

    return {
      totalWords,
      totalSuggestions,
      acceptedSuggestions,
      rejectedSuggestions,
      averageConfidence,
      mostUsedPatterns,
      improvementAreas,
      writingScore: this.calculateWritingScore(),
      consistencyScore: this.calculateConsistencyScore(),
      readabilityScore: this.calculateReadabilityScore(),
};
}

  private identifyImprovementAreas(): string[] {
    const areas: string[] = [];
    
    // Analyze patterns to identify improvement areas
    const lowConfidencePatterns = Array.from(this.patterns.values())
      .filter(p => p.confidence < 0.6)
      .map(p => p.category);

    if (lowConfidencePatterns.includes('grammar')) areas.push('Grammatikk');
    if (lowConfidencePatterns.includes('style')) areas.push('Stil');
    if (lowConfidencePatterns.includes('flow')) areas.push('Flyt');
    if (lowConfidencePatterns.includes('vocabulary')) areas.push('Ordvalg');

    return areas;
 }

  private calculateWritingScore(): number {
    // Simple scoring based on pattern confidence and frequency
    const avgConfidence = Array.from(this.patterns.values())
      .reduce((sum, pattern) => sum + pattern.confidence, 0) / this.patterns.size;
    
    const totalFrequency = Array.from(this.patterns.values())
      .reduce((sum, pattern) => sum + pattern.frequency, 0);
    
    const frequencyScore = Math.min(1, totalFrequency / 100);
    
    return Math.round((avgConfidence * 0.7 + frequencyScore * 0.3) * 100);
}

  private calculateConsistencyScore(): number {
    // Calculate consistency based on pattern usage
    const patterns = Array.from(this.patterns.values());
    if (patterns.length === 0) return 0;

    const frequencies = patterns.map(p => p.frequency);
    const mean = frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
    const variance = frequencies.reduce((sum, freq) => sum + Math.pow(freq - mean, 2), 0) / frequencies.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency
    const consistency = Math.max(0, 1 - (stdDev / mean));
    return Math.round(consistency * 100);
}

  private calculateReadabilityScore(): number {
    // Simple readability score based on sentence length and word complexity
    const allText = this.learningData.map(d => d.text).join('');
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = allText.split(/\s+/).filter(w => w.length > 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgSentenceLength = words.length / sentences.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    // Norwegian readability formula (simplified)
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgWordLength / 100);
    return Math.max(0, Math.min(100, Math.round(score)));
}

  /**
   * Clear learning data
   */
  clearLearningData(): void {
    this.learningData = [];
    this.patterns.clear();
    this.userPreferences.clear();
    this.initializeDefaultPatterns();
}

  /**
   * Export learning data
   */
  exportLearningData(): any {
    return {
      patterns: Array.from(this.patterns.entries(, ), ),
      userPreferences: Array.from(this.userPreferences.entries(, ), ),
      learningData: this.learningData,
      config: this.config,
      stats: this.getWritingStats(),
};
}

  /**
   * Import learning data
   */
  importLearningData(data: any): void {
    if (data.patterns) {
      this.patterns = new Map(data.patterns);
 }
    if (data.userPreferences) {
      this.userPreferences = new Map(data.userPreferences);
}
    if (data.learningData) {
      this.learningData = data.learningData;
}
    if (data.config) {
      this.config = { ...this.config, ...data.config };
}
}
}

export default AIWritingSuggestionsService;
