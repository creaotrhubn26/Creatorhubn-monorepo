/**
 * Script Word Bank Database Service
 * 
 * Database-backed vocabulary service for screenplay analysis.
 * Provides shared learning across all users with admin curation.
 * Falls back to settings-backed word bank when database unavailable.
 * 
 * Uses the existing FastAPI backend with Neon PostgreSQL.
 * API endpoints: /api/wordbank/*
 */

import type { WordCategory, WordEntry } from './scriptWordBank';
import { scriptWordBank } from './scriptWordBank';

// API base URL - matches existing backend pattern
const API_BASE = '/api/wordbank';

// Database row types
interface WordBankRow {
  id: number;
  word: string;
  category: string;
  language: string;
  weight: string;
  is_builtin: boolean;
  is_approved: boolean;
  created_by: string | null;
  created_at: string;
  usage_count: number;
}

interface SuggestionRow {
  id: number;
  word: string;
  category: string;
  language: string;
  suggested_weight: string;
  reason: string | null;
  suggested_by: string | null;
  suggested_at: string;
  status: string;
}

interface FeedbackRow {
  detected_purpose: string;
  correct_purpose: string;
}

// Helper for API calls
async function apiCall<T>(
  endpoint: string, 
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { data: null, error: error || `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export interface DbWordEntry extends WordEntry {
  id: number;
  isBuiltin: boolean;
  isApproved: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface WordSuggestion {
  id: number;
  word: string;
  category: WordCategory;
  language: 'en' | 'no' | 'both';
  suggestedWeight: number;
  reason?: string;
  suggestedBy?: string;
  suggestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface WordBankDbStats {
  totalWords: number;
  builtinWords: number;
  learnedWords: number;
  pendingSuggestions: number;
  totalFeedback: number;
  topCategories: { category: string; count: number }[];
}

class ScriptWordBankDbService {
  private cache: Map<WordCategory, DbWordEntry[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private isDbAvailable: boolean | null = null;

  /**
   * Check if database API is available
   */
  async checkDbAvailability(): Promise<boolean> {
    if (this.isDbAvailable !== null) {
      return this.isDbAvailable;
    }

    try {
      const { data, error } = await apiCall<{ available: boolean }>('/health');
      this.isDbAvailable = !error && data?.available === true;
      return this.isDbAvailable;
    } catch {
      this.isDbAvailable = false;
      return false;
    }
  }

  /**
   * Get all words for a category from database
  * Falls back to settings-backed word bank if db unavailable
   */
  async getWordsForCategory(category: WordCategory): Promise<WordEntry[]> {
    // Check cache first
    if (Date.now() < this.cacheExpiry && this.cache.has(category)) {
      return this.cache.get(category) || [];
    }

    // Try database API
    if (await this.checkDbAvailability()) {
      try {
        const { data, error } = await apiCall<WordBankRow[]>(`/words/${category}`);

        if (!error && data) {
          const words: DbWordEntry[] = data.map((row: WordBankRow) => ({
            id: row.id,
            word: row.word,
            language: row.language as 'en' | 'no' | 'both',
            weight: parseFloat(String(row.weight)),
            isBuiltin: row.is_builtin,
            isApproved: row.is_approved,
            createdBy: row.created_by || undefined,
            createdAt: row.created_at,
            usageCount: row.usage_count
          }));

          this.cache.set(category, words);
          this.cacheExpiry = Date.now() + this.CACHE_TTL;
          return words;
        }
      } catch (e) {
        console.warn('Database query failed, falling back to settings cache', e);
      }
    }

    // Fallback to settings-backed word bank
    return scriptWordBank.getWordsForCategory(category);
  }

  /**
   * Add a word to the database
   */
  async addWord(
    category: WordCategory,
    word: string,
    language: 'en' | 'no' | 'both' = 'both',
    weight: number = 0.7,
    userId?: string
  ): Promise<{ success: boolean; wordId?: number; message: string }> {
    if (!(await this.checkDbAvailability())) {
      // Fall back to settings-backed word bank
      const success = scriptWordBank.addWord(category, word, language, weight);
      return {
        success,
        message: success ? 'Added to local cache' : 'Word already exists locally'
      };
    }

    try {
      const { data, error } = await apiCall<{ success: boolean; word_id?: number; message: string }>(
        '/words',
        {
          method: 'POST',
          body: JSON.stringify({
            word: word.toLowerCase().trim(),
            category,
            language,
            weight,
            user_id: userId
          })
        }
      );

      if (error) throw new Error(error);

      // Invalidate cache
      this.cache.delete(category);

      return {
        success: data?.success || false,
        wordId: data?.word_id,
        message: data?.message || 'Unknown error'
      };
    } catch (e) {
      console.error('Failed to add word to database:', e);
      // Fall back to settings-backed word bank
      const success = scriptWordBank.addWord(category, word, language, weight);
      return {
        success,
        message: success ? 'Added to local cache (db unavailable)' : 'Failed to add'
      };
    }
  }

  /**
   * Submit a word suggestion for admin review
   */
  async suggestWord(
    word: string,
    category: WordCategory,
    language: 'en' | 'no' | 'both' = 'both',
    weight: number = 0.7,
    reason?: string,
    userId?: string
  ): Promise<{ success: boolean; suggestionId?: number }> {
    if (!(await this.checkDbAvailability())) {
      // Can't suggest without database - add directly to local
      const success = scriptWordBank.addWord(category, word, language, weight);
      return { success };
    }

    try {
      const { data, error } = await apiCall<{ success: boolean; suggestion_id?: number }>(
        '/suggestions',
        {
          method: 'POST',
          body: JSON.stringify({
            word: word.toLowerCase().trim(),
            category,
            language,
            suggested_weight: weight,
            reason,
            suggested_by: userId
          })
        }
      );

      if (error) throw new Error(error);

      return { success: true, suggestionId: data?.suggestion_id };
    } catch (e) {
      console.error('Failed to submit suggestion:', e);
      return { success: false };
    }
  }

  /**
   * Record feedback when user corrects a scene purpose
   * This data is used for machine learning and admin review
   */
  async recordFeedback(
    sceneText: string,
    detectedPurpose: WordCategory,
    correctPurpose: WordCategory,
    projectId?: string,
    userId?: string
  ): Promise<{ success: boolean; learnedWords: string[] }> {
    // Always learn locally first
    const localResult = scriptWordBank.learnFromFeedback(sceneText, correctPurpose, detectedPurpose);
    
    if (!(await this.checkDbAvailability())) {
      return { success: true, learnedWords: localResult.learnedWords };
    }

    try {
      // Record feedback in database
      const { error } = await apiCall('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          user_id: userId,
          scene_text: sceneText.substring(0, 2000),
          detected_purpose: detectedPurpose,
          correct_purpose: correctPurpose,
          learned_words: localResult.learnedWords
        })
      });

      if (error) throw new Error(error);

      // Also add learned words to database (pending approval for global use)
      for (const learnedWord of localResult.learnedWords) {
        await this.suggestWord(
          learnedWord,
          correctPurpose,
          'both',
          0.6,
          `Auto-learned from feedback: was ${detectedPurpose}, should be ${correctPurpose}`,
          userId
        );
      }

      return { success: true, learnedWords: localResult.learnedWords };
    } catch (e) {
      console.error('Failed to record feedback:', e);
      return { success: true, learnedWords: localResult.learnedWords };
    }
  }

  /**
   * Track word usage in database
   */
  async trackUsage(
    word: string,
    category: WordCategory,
    projectId?: string,
    userId?: string,
    sceneContext?: string
  ): Promise<void> {
    if (!(await this.checkDbAvailability())) {
      scriptWordBank.trackWordUsage(word);
      return;
    }

    try {
      await apiCall('/usage', {
        method: 'POST',
        body: JSON.stringify({
          word: word.toLowerCase(),
          category,
          project_id: projectId,
          user_id: userId,
          scene_context: sceneContext?.substring(0, 200)
        })
      });
    } catch (e) {
      console.warn('Failed to track usage:', e);
      scriptWordBank.trackWordUsage(word);
    }
  }

  /**
   * Get word bank statistics
   */
  async getStats(): Promise<WordBankDbStats> {
    if (!(await this.checkDbAvailability())) {
      const localStats = scriptWordBank.getStats();
      return {
        totalWords: localStats.totalWords,
        builtinWords: localStats.totalWords - localStats.userAddedWords,
        learnedWords: localStats.userAddedWords,
        pendingSuggestions: 0,
        totalFeedback: 0,
        topCategories: []
      };
    }

    try {
      const { data, error } = await apiCall<WordBankDbStats>('/stats');

      if (error || !data) {
        throw new Error(error || 'No data');
      }

      return data;
    } catch (e) {
      console.error('Failed to get stats:', e);
      const localStats = scriptWordBank.getStats();
      return {
        totalWords: localStats.totalWords,
        builtinWords: localStats.totalWords,
        learnedWords: 0,
        pendingSuggestions: 0,
        totalFeedback: 0,
        topCategories: []
      };
    }
  }

  /**
   * Get pending word suggestions (admin only)
   */
  async getPendingSuggestions(): Promise<WordSuggestion[]> {
    if (!(await this.checkDbAvailability())) {
      return [];
    }

    try {
      const { data, error } = await apiCall<SuggestionRow[]>('/suggestions/pending');

      if (error) throw new Error(error);

      return (data || []).map((row: SuggestionRow) => ({
        id: row.id,
        word: row.word,
        category: row.category as WordCategory,
        language: row.language as 'en' | 'no' | 'both',
        suggestedWeight: parseFloat(String(row.suggested_weight)),
        reason: row.reason || undefined,
        suggestedBy: row.suggested_by || undefined,
        suggestedAt: row.suggested_at,
        status: row.status as 'pending' | 'approved' | 'rejected'
      }));
    } catch (e) {
      console.error('Failed to get suggestions:', e);
      return [];
    }
  }

  /**
   * Approve a word suggestion (admin only)
   */
  async approveSuggestion(
    suggestionId: number,
    reviewerId: string
  ): Promise<boolean> {
    if (!(await this.checkDbAvailability())) {
      return false;
    }

    try {
      const { error } = await apiCall(`/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewer_id: reviewerId })
      });

      if (error) throw new Error(error);

      return true;
    } catch (e) {
      console.error('Failed to approve suggestion:', e);
      return false;
    }
  }

  /**
   * Reject a word suggestion (admin only)
   */
  async rejectSuggestion(
    suggestionId: number,
    reviewerId: string
  ): Promise<boolean> {
    if (!(await this.checkDbAvailability())) {
      return false;
    }

    try {
      const { error } = await apiCall(`/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewer_id: reviewerId })
      });

      if (error) throw new Error(error);

      return true;
    } catch (e) {
      console.error('Failed to reject suggestion:', e);
      return false;
    }
  }

  /**
   * Seed database with built-in words from the static word bank
   */
  async seedBuiltinWords(): Promise<{ added: number; skipped: number }> {
    if (!(await this.checkDbAvailability())) {
      return { added: 0, skipped: 0 };
    }

    try {
      const { data, error } = await apiCall<{ added: number; skipped: number }>('/seed', {
        method: 'POST'
      });

      if (error) throw new Error(error);

      return data || { added: 0, skipped: 0 };
    } catch (e) {
      console.error('Failed to seed words:', e);
      return { added: 0, skipped: 0 };
    }
  }

  /**
   * Get misclassification patterns for analysis
   */
  async getMisclassificationPatterns(): Promise<{
    from: WordCategory;
    to: WordCategory;
    count: number;
  }[]> {
    if (!(await this.checkDbAvailability())) {
      const patterns = scriptWordBank.analyzeFeedbackPatterns();
      return patterns.commonMistakes;
    }

    try {
      const { data, error } = await apiCall<{ from: WordCategory; to: WordCategory; count: number }[]>(
        '/patterns/misclassification'
      );

      if (error) throw new Error(error);

      return data || [];
    } catch (e) {
      console.error('Failed to get patterns:', e);
      return [];
    }
  }

  /**
   * Clear cache (useful after bulk operations)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}

// Export singleton instance
export const scriptWordBankDb = new ScriptWordBankDbService();