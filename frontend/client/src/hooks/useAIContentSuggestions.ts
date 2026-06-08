import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export type ContentType = 'social' | 'email_subject' | 'email_body' | 'announcement' | 'headline' | 'description';
export type ToneType = 'professional' | 'casual' | 'friendly' | 'enthusiastic' | 'formal' | 'playful';
export type LengthType = 'short' | 'medium' | 'long';

interface AISuggestion {
  id: string;
  content: string;
  score: number;
  reasoning: string;
  keywords: string[];
}

interface AIGenerateOptions {
  contentType: ContentType;
  prompt: string;
  tone?: ToneType;
  length?: LengthType;
  keywords?: string[];
  targetAudience?: string;
  context?: string;
  count?: number; // Number of suggestions to generate
}

interface AIImproveOptions {
  contentType: ContentType;
  content: string;
  improvements?: ('grammar' | 'clarity' | 'engagement' | 'seo' | 'tone' | 'length')[];
  targetTone?: ToneType;
  targetLength?: LengthType;
}

interface AIAnalysisResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  readabilityScore: number;
  seoScore?: number;
}

interface UseAIContentSuggestionsReturn {
  // Generation
  generateContent: (options: AIGenerateOptions) => Promise<AISuggestion[]>;
  isGenerating: boolean;
  generatedSuggestions: AISuggestion[];
  
  // Improvement
  improveContent: (options: AIImproveOptions) => Promise<AISuggestion[]>;
  isImproving: boolean;
  improvedSuggestions: AISuggestion[];
  
  // Analysis
  analyzeContent: (content: string, contentType: ContentType) => Promise<AIAnalysisResult>;
  isAnalyzing: boolean;
  analysis: AIAnalysisResult | null;
  
  // Utilities
  clearSuggestions: () => void;
  applySuggestion: (suggestion: AISuggestion) => string;
}

export function useAIContentSuggestions(): UseAIContentSuggestionsReturn {
  const [generatedSuggestions, setGeneratedSuggestions] = useState<AISuggestion[]>([]);
  const [improvedSuggestions, setImprovedSuggestions] = useState<AISuggestion[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);

  // Generate content mutation
  const generateMutation = useMutation({
    mutationFn: async (options: AIGenerateOptions) => {
      return await apiRequest('/api/ai/generate-content', {
        method: 'POST',
        body: JSON.stringify(options),
      }) as { suggestions: AISuggestion[] };
    },
    onSuccess: (data) => {
      setGeneratedSuggestions(data.suggestions);
    }
  });

  // Improve content mutation
  const improveMutation = useMutation({
    mutationFn: async (options: AIImproveOptions) => {
      return await apiRequest('/api/ai/improve-content', {
        method: 'POST',
        body: JSON.stringify(options),
      }) as { suggestions: AISuggestion[] };
    },
    onSuccess: (data) => {
      setImprovedSuggestions(data.suggestions);
    }
  });

  // Analyze content mutation
  const analyzeMutation = useMutation({
    mutationFn: async ({ content, contentType }: { content: string; contentType: ContentType }) => {
      return await apiRequest('/api/ai/analyze-content', {
        method: 'POST',
        body: JSON.stringify({ content, contentType }),
      }) as AIAnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysis(data);
    }
  });

  // Generate content
  const generateContent = useCallback(async (options: AIGenerateOptions): Promise<AISuggestion[]> => {
    const result = await generateMutation.mutateAsync(options);
    return result.suggestions;
  }, [generateMutation]);

  // Improve content
  const improveContent = useCallback(async (options: AIImproveOptions): Promise<AISuggestion[]> => {
    const result = await improveMutation.mutateAsync(options);
    return result.suggestions;
  }, [improveMutation]);

  // Analyze content
  const analyzeContent = useCallback(async (content: string, contentType: ContentType): Promise<AIAnalysisResult> => {
    const result = await analyzeMutation.mutateAsync({ content, contentType });
    return result;
  }, [analyzeMutation]);

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setGeneratedSuggestions([]);
    setImprovedSuggestions([]);
    setAnalysis(null);
  }, []);

  // Apply suggestion (returns the suggestion content)
  const applySuggestion = useCallback((suggestion: AISuggestion): string => {
    return suggestion.content;
  }, []);

  return {
    generateContent,
    isGenerating: generateMutation.isPending,
    generatedSuggestions,
    
    improveContent,
    isImproving: improveMutation.isPending,
    improvedSuggestions,
    
    analyzeContent,
    isAnalyzing: analyzeMutation.isPending,
    analysis,
    
    clearSuggestions,
    applySuggestion
  };
}

// Preset prompts for common content types
export const AI_PROMPTS = {
  social: {
    engagement: 'Create an engaging social media post that encourages interaction and shares',
    promotional: 'Write a promotional social media post highlighting key benefits',
    announcement: 'Draft an announcement post for social media with clear call-to-action',
    storytelling: 'Create a storytelling post that connects emotionally with the audience'
  },
  email: {
    welcome: 'Write a welcoming email subject and body for new subscribers',
    promotional: 'Create a promotional email highlighting product/service benefits',
    newsletter: 'Draft a newsletter email with engaging content',
    followUp: 'Write a follow-up email to re-engage inactive subscribers'
  },
  announcement: {
    product: 'Create an announcement for a new product or feature launch',
    update: 'Draft an update announcement about changes or improvements',
    event: 'Write an event announcement with key details and registration info',
    achievement: 'Create an announcement celebrating a milestone or achievement'
  }
};

// Tone presets
export const TONE_DESCRIPTIONS = {
  professional: 'Clear, authoritative, and business-focused',
  casual: 'Relaxed, conversational, and approachable',
  friendly: 'Warm, inviting, and personal',
  enthusiastic: 'Energetic, exciting, and motivational',
  formal: 'Traditional, respectful, and structured',
  playful: 'Fun, creative, and lighthearted'
};

// Content best practices
export const CONTENT_BEST_PRACTICES = {
  social: {
    maxLength: 280,
    recommended: {
      hashtags: 2-3,
      emojis: 1-2,
      questions: 'End with a question to encourage engagement',
      cta: 'Include a clear call-to-action'
    }
  },
  email_subject: {
    maxLength: 60,
    recommended: {
      personalization: 'Use recipient name or relevant details',
      urgency: 'Create sense of urgency when appropriate',
      clarity: 'Be clear about email content',
      avoid: 'Spam trigger words (FREE, ACT NOW, etc.)'
    }
  },
  email_body: {
    maxLength: 500,
    recommended: {
      structure: 'Clear introduction, body, and conclusion',
      paragraphs: 'Short paragraphs (2-3 sentences)',
      links: 'Include relevant links with clear anchor text',
      cta: 'Single, prominent call-to-action'
    }
  }
};
