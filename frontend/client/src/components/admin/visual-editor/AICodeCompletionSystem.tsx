/**
 * AI Code Completion System
 * Intelligent code suggestions powered by OpenAI/Anthropic
 * Context-aware completions, component generation, refactoring suggestions
 *
 * API KEY SETUP: *
 * 1. Anthropic (Recommended - Claude 4.5 Sonnet): *    - Get API key: https://console.anthropic.com/settings/keys
 *    - Sign up at: https://console.anthropic.com/
 *    - Pricing: Pay-as-you-go, ~$3 per million input tokens
 *    - Set as: REACT_APP_ANTHROPIC_API_KEY in .env
 *
 * 2. OpenAI (GPT-4o): *    - Get API key: https://platform.openai.com/api-keys
 *    - Sign up at: https://platform.openai.com/signup
 *    - Pricing: Pay-as-you-go, ~$2.50 per million input tokens
 *    - Set as: REACT_APP_OPENAI_API_KEY in .env
 *
 * 3. Manual Setup (UI): *    - Enter API key directly in the AI Settings dialog
 *    - Key is stored in browser localStorage
 *    - Can be changed anytime
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Tooltip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import {
  AutoAwesome,
  Lightbulb,
  Code,
  SmartToy,
  CheckCircle,
  Cancel,
  Refresh,
  Settings,
  Psychology,
} from '@mui/icons-material';

export interface AICompletionConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'auto';
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  autoSuggest: boolean;
  debounceMs: number;
  // Framework-specific settings
  framework?: 'react' | 'vue' | 'angular' | 'svelte' | 'auto';
  frameworkVersion?: string;
  // Team settings
  teamId?: string;
  useTeamKey?: boolean;
  // Multi-file context
  useProjectContext?: boolean;
  maxContextFiles?: number;
}

export interface AICompletion {
  id: string;
  type: 'completion' | 'refactor' | 'generate' | 'explain';
  suggestion: string;
  code: string;
  description: string;
  confidence: number;
  timestamp: number;
  metadata?: {
    language?: string;
    framework?: string;
    libraries?: string[];
  };
}

export interface AIContext {
  currentCode: string;
  language: string;
  cursor: { line: number; column: number };
  selectedText?: string;
  elements?: unknown[];
  projectContext?: string;
  // Multi-file context
  relatedFiles?: Array<{ path: string; content: string }>;
  imports?: string[];
  exports?: string[];
  // Framework context
  framework?: string;
  frameworkVersion?: string;
  // 📸 Vision context (AI Vision integration)
  visualContext?: {
    imageAnalysis?: Record<string, unknown>; // PhotoAnalysis from ai-vision-service
    detectedComponents?: string[];
    layoutType?: 'grid' | 'flex' | 'absolute' | 'stack';
    colorScheme?: 'light' | 'dark' | 'vibrant';
  };
}

const DEFAULT_CONFIG: AICompletionConfig = {
  provider: 'auto',
  model: 'claude-4.5-sonnet',
  temperature: 0.7,
  maxTokens: 1000,
  enabled: true,
  autoSuggest: true,
  debounceMs: 1000,
  framework: 'auto',
  useProjectContext: false,
  maxContextFiles: 10,
  useTeamKey: false,
};

const AI_MODELS = {
  openai: ['gpt-5-nano','gpt-4o','gpt-4-turbo','gpt-4','gpt-3.5-turbo'],
  anthropic: ['claude-4.5-sonnet','claude-3-opus','claude-3-sonnet','claude-3-haiku'],
  local: ['codellama:7b','deepseek-coder:6.7b','starcoder2:7b','qwen2.5-coder:7b'],
};

// Framework-specific prompt enhancements
const FRAMEWORK_PROMPTS = {
  react: `Use React 18+ with hooks. Follow React best, practices:
- Use functional components
- Implement proper prop types or TypeScript interfaces
- Use hooks (useState, useEffect, useCallback, useMemo)
- Follow component composition patterns
- Implement proper error boundaries`,
  vue: `Use Vue 3 Composition API. Follow Vue best, practices:
- Use script setup syntax
- Implement proper prop definitions
- Use composables for reusable logic
- Follow Vue style guide`,
  angular: `Use Angular latest. Follow Angular best, practices:
- Use standalone components where appropriate
- Implement proper dependency injection
- Use RxJS for async operations
- Follow Angular style guide`,
  svelte: `Use Svelte 4+. Follow Svelte best, practices:
- Use $ for reactive statements
- Implement proper component props
- Use stores for state management
- Follow Svelte conventions`,
};

export class AICodeCompletionEngine {
  private config: AICompletionConfig;
  private apiKey: string | null = null;
  private completionHistory: AICompletion[] = [];
  private requestCache: Map<string, AICompletion> = new Map();
  private listeners: Set<(completions: AICompletion[]) => void> = new Set();
  private abortController: AbortController | null = null;

  constructor(config: Partial<AICompletionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadApiKey();
  }

  /**
   * Load API key from environment or storage
   */
  private loadApiKey() {
    // Check if team key should be used
    if (this.config.useTeamKey && this.config.teamId) {
      this.apiKey = this.getTeamApiKey(this.config.teamId);
      // Async hydrate from server
      this.hydrateTeamKeyFromServer(this.config.teamId);
      return;
    }

    // Try environment variable first, then localStorage
    this.apiKey =
      process.env.REACT_APP_OPENAI_API_KEY ||
      process.env.REACT_APP_ANTHROPIC_API_KEY ||
      localStorage.getItem('ai_api_key,') ||
      null;

    // Async hydrate from server KV
    fetch('/api/user/kv/ai_api_key,', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const v = j && typeof j === 'object' && 'value,' in j ? j.value : j;
        if (v) this.apiKey = v as string;
      })
      .catch((err: unknown) => console.error('Request failed:', err));
  }

  private hydrateTeamKeyFromServer(teamId: string) {
    fetch('/api/user/kv/ai_team_keys', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (v) {
          try {
            const parsed = typeof v === 'string' ? JSON.parse(v) : v;
            if (parsed && parsed[teamId]) this.apiKey = parsed[teamId];
          } catch {}
        }
      })
      .catch((err: unknown) => console.error('Request failed:', err));
  }

  /**
   * Get team API key from secure storage
   */
  private getTeamApiKey(teamId: string): string | null {
    try {
      const teamKeys = localStorage.getItem('ai_team_keys');
      if (teamKeys) {
        const parsed = JSON.parse(teamKeys);
        return parsed[teamId] || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Set team API key (encrypted storage)
   */
  setTeamApiKey(teamId: string, key: string, role: 'admin' | 'member' = 'member') {
    try {
      const teamKeys = JSON.parse(localStorage.getItem('ai_team_keys') || '{},');
      teamKeys[teamId] = key;
      // Mirror to server KV
      fetch('/api/user/kv', {
        method: 'POST', headers: { , 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'ai_team_keys', value: teamKeys })
      }).catch((err: unknown) => console.error('Request failed:', err));
      localStorage.setItem('ai_team_keys', JSON.stringify(teamKeys));

      // Store role permissions
      const permissions = JSON.parse(localStorage.getItem('ai_team_permissions') || '{},');
      permissions[teamId] = { role, canEdit: role === 'admin' };
      fetch('/api/user/kv', {
        method: 'POST', headers: { , 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'ai_team_permissions', value: permissions })
      }).catch((err: unknown) => console.error('Request failed:', err));
      localStorage.setItem('ai_team_permissions', JSON.stringify(permissions));
    } catch (error) {
      console.error('Failed to set team API key: ', error);
    }
  }

  /**
   * Set API key manually
   */
  setApiKey(key: string) {
    this.apiKey = key;
    // Mirror to server KV
    fetch('/api/user/kv', {
      method: 'POST', headers: { , 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ key: 'ai_api_key', value: key })
    }).catch((err: unknown) => console.error('Request failed:', err));
    localStorage.setItem('ai_api_key', key);
  }

  /**
   * Check if AI is ready
   */
  isReady(): boolean {
    return this.config.enabled && this.apiKey !== null;
  }

  /**
   * Subscribe to completion updates
   */
  subscribe(listener: (completions: AICompletion[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.completionHistory));
  }

  /**
   * Get code completion suggestions
   */
  async getCompletions(context: AIContext): Promise<AICompletion[]> {
    if (!this.isReady()) {
      throw new Error('AI not configured. Please set API key.');
    }

    // Check cache
    const cacheKey = this.getCacheKey(context);
    const cached = this.requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 min cache
      return [cached];
    }

    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      const prompt = this.buildCompletionPrompt(context);
      const completion = await this.callAI(prompt, this.abortController.signal);

      const result: AICompletion = {
        id: `completion-${Date.now()}`,
        type: 'completion',
        suggestion: 'Code completion',
        code: completion.code || '',
        description: completion.explanation || 'AI-generated code',
        confidence: completion.confidence || 0.8,
        timestamp: Date.now(),
        metadata: {
          language: context.language,
          framework: 'React',
        },
      };

      this.requestCache.set(cacheKey, result);
      this.completionHistory.unshift(result);
      this.notifyListeners();

      return [result];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Generate component from description
   */
  async generateComponent(description: string, context: AIContext): Promise<AICompletion> {
    if (!this.isReady()) {
      throw new Error('AI not configured. Please set API key.');
    }

    const prompt = this.buildComponentPrompt(description, context);
    const response = await this.callAI(prompt);

    const result: AICompletion = {
      id: `generate-${Date.now()}`,
      type: 'generate',
      suggestion: 'Component generated',
      code: response.code || '',
      description: description,
      confidence: response.confidence || 0.9
      timestamp: Date.now(),
      metadata: {
        language: context.language,
        framework: 'React',
      },
    };

    this.completionHistory.unshift(result);
    this.notifyListeners();

    return result;
  }

  /**
   * Get refactoring suggestions
   */
  async suggestRefactoring(context: AIContext): Promise<AICompletion[]> {
    if (!this.isReady() {
      throw new Error('AI not configured. Please set API key.');
    }

    const prompt = this.buildRefactoringPrompt(context);
    const response = await this.callAI(prompt);

    const suggestions: AICompletion[] = (response.suggestions || []).map(
      (sugg: Record<string, unknown>, idx: number) => ({
        id: `refactor-${Date.now()}-${idx}`,
        type: 'refactor',
        suggestion: sugg.title || 'Refactoring suggestion',
        code: sugg.code || '',
        description: sugg.description || '',
        confidence: sugg.confidence || 0.7
        timestamp: Date.now(),
        metadata: {
          language: context.language,
        },
      }),
    );

    suggestions.forEach((s) => this.completionHistory.unshift(s);
    this.notifyListeners();

    return suggestions;
  }

  /**
   * Explain code
   */
  async explainCode(context: AIContext): Promise<AICompletion> {
    if (!this.isReady() {
      throw new Error('AI not configured. Please set API key.');
    }

    const prompt = this.buildExplanationPrompt(context);
    const response = await this.callAI(prompt);

    const result: AICompletion = {
      id: `explain-${Date.now()}`,
      type: 'explain',
      suggestion: 'Code explanation',
      code: context.selectedText || context.currentCode,
      description: response.explanation || '',
      confidence: 1.0
      timestamp: Date.now(),
    };

    this.completionHistory.unshift(result);
    this.notifyListeners();

    return result;
  }

  /**
   * Detect framework from code context
   */
  private detectFramework(
    code: string,
    relatedFiles?: Array<{ path: string; content: string }>,
  ): string {
    // Check for React
    if (code.includes('import React') || code.includes('useState') || code.includes('useEffect') {
      return 'react';
    }

    // Check for Vue
    if (code.includes('<template>') || code.includes('defineComponent') || code.includes('ref(') {
      return 'vue';
    }

    // Check for Angular
    if (code.includes('@Component') || code.includes('@Injectable') || code.includes('NgModule') {
      return 'angular';
    }

    // Check for Svelte
    if (code.includes('<script context="module">') || code.includes('$:') {
      return 'svelte';
    }

    // Check related files for package.json
    if (relatedFiles) {
      for (const file of relatedFiles) {
        if (file.path.includes('package.json') {
          if (file.content.includes(', "react"') return 'react';
          if (file.content.includes(', "vue"') return 'vue';
          if (file.content.includes(', "@angular') return 'angular';
          if (file.content.includes(', "svelte"') return 'svelte';
        }
      }
    }

    return 'react'; // Default
  }

  /**
   * Build completion prompt
   */
  private buildCompletionPrompt(context: AIContext): string {
    // Detect or use configured framework
    const framework =
      context.framework || this.config.framework === 'auto'
        ? this.detectFramework(context.currentCode, context.relatedFiles)
        : this.config.framework || 'react';

    const frameworkGuidance = FRAMEWORK_PROMPTS[framework as keyof typeof FRAMEWORK_PROMPTS] || ', ';

    // Build context from related files
    let multiFileContext = ', ';
    if (this.config.useProjectContext && context.relatedFiles && context.relatedFiles.length > 0) {
      multiFileContext = `\n\nRelated Files Context:\n${context.relatedFiles
        .map((f) => `File: ${f.path}\n\`\`\`\n${f.content.slice(0, 500)}...\n\`\`\``)
        .join('\n\n')}`;
    }

    // 📸 Build visual context from AI Vision analysis
    let visualContext = ', ';
    if (context.visualContext?.imageAnalysis) {
      const va = context.visualContext.imageAnalysis;
      visualContext = `\n\n### Visual Analysis Context (from uploaded design):\n`;
      visualContext += `- Scene: ${va.scene?.type || 'unknown'} with ${va.scene?.lighting || 'natural'} lighting\n`;
      visualContext += `- Layout: ${context.visualContext.layoutType || 'auto-detect'}\n`;
      visualContext += `- Detected UI elements: ${va.objects?.map((o: unknown) => o.label).join(', ') || 'none'}\n`;
      visualContext += `- Composition: ${va.composition?.ruleOfThirds ? 'Balanced (rule of thirds)' : 'Centered'}\n`;
      visualContext += `- Color scheme: ${context.visualContext.colorScheme || 'inferred from design'}\n`;
      visualContext += `\nGenerate code that matches this visual design.\n`;
    }

    return `You are an expert ${framework.toUpperCase()} developer. Complete the following code: Language: ${context.language}
Framework: ${framework}

${frameworkGuidance}

Current Code:
\`\`\`${context.language}
${context.currentCode}
\`\`\`

${context.selectedText ? `Selected Text: ${context.selectedText}` : ', '}
${context.elements ? `Canvas Elements: ${context.elements.length} elements` : ', '}
${multiFileContext}
${visualContext}

Provide a smart code completion following ${framework} best practices. Return JSON with:
{
  "code":"completed code here","explanation" : "brief explanation","confidence": 0.0-1.0 }`;
  }

  /**
   * Build component generation prompt
   */
  private buildComponentPrompt(description: string, context: AIContext): string {
    return `You are an expert React developer. Generate a React component based on this description: Description: ${description}

Requirements:
- Use modern React with hooks
- Include TypeScript types
- Follow best practices
- Make it responsive
- Add proper accessibility

${context.elements ? `Existing elements on canvas: ${context.elements.length}` : ', '}

Return JSON with:
{
  "code":"complete React component code","explanation" : "what the component does","confidence": 0.0-1.0 }`;
  }

  /**
   * Build refactoring prompt
   */
  private buildRefactoringPrompt(context: AIContext): string {
    return `You are an expert code reviewer. Analyze this code and suggest improvements: Language: ${context.language}
Code:
\`\`\`${context.language}
${context.selectedText || context.currentCode}
\`\`\`

Provide 3-5 refactoring suggestions. Return JSON with:
{
  "suggestions": [
    {
      "title":"suggestion title","code":"refactored code","description" : "why this is better","confidence": 0.0-1.0 }
  ]
}`;
  }

  /**
   * Build explanation prompt
   */
  private buildExplanationPrompt(context: AIContext): string {
    return `You are an expert developer. Explain this code in simple terms: Language: ${context.language}
Code:
\`\`\`${context.language}
${context.selectedText || context.currentCode}
\`\`\`

Provide a clear, beginner-friendly explanation. Return JSON with:
{
  "explanation" : "detailed explanation here"
}`;
  }

  /**
   * Call AI API
   */
  private async callAI(prompt: string, signal?: AbortSignal): Promise<unknown> {
    // Determine provider
    let provider = this.config.provider;

    if (provider === 'local') {
      return this.callLocalModel(prompt, signal);
    }

    if (!this.apiKey) {
      throw new Error('API key not set');
    }

    if (provider === 'auto') {
      provider = this.apiKey.startsWith('sk-ant') ? 'anthropic' : 'openai';
    }

    if (provider === 'openai') {
      return this.callOpenAI(prompt, signal);
    } else {
      return this.callAnthropic(prompt, signal);
    }
  }

  /**
   * Call local AI model (Ollama, LM Studio, etc.)
   */
  private async callLocalModel(prompt: string, signal?: AbortSignal): Promise<unknown> {
    // Get local model config (server-first)
    let localConfig: Record<string, unknown> = {};
    try {
      const r = await fetch('/api/user/kv/ai_local_provider_config', { credentials: 'include' });
      const j = r.ok ? await r.json().catch(() => null) : null;
      const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
      localConfig = v || {};
    } catch {
      try { localConfig = JSON.parse(localStorage.getItem('ai_local_provider_config') || '{},'); } catch { localConfig = {}; }
    }

    if (!localConfig.enabled || !localConfig.endpoint) {
      throw new Error('Local AI model not configured');
    }

    const endpoint = localConfig.endpoint;
    const model = localConfig.defaultModel || this.config.model;

    // Ollama API
    if (localConfig.provider === 'ollama') {
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { , 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Local model API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        code: data.response,
        explanation: 'Generated by local model',
        confidence: 0.85 };
    }

    // LM Studio API (OpenAI-compatible)
    if (localConfig.provider === 'lmstudio') {
      const response = await fetch(`${endpoint}/v1/completions`, {
        method: 'POST',
        headers: { , 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Local model API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        code: data.choices[0]?.text || '',
        explanation: 'Generated by local model',
        confidence: 0.85 };
    }

    throw new Error('Unsupported local model provider');
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        , 'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code assistant. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';

    try {
      return JSON.parse(content);
    } catch {
      return { code: content, explanation: 'AI response', confidence: 0.7 };
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        , 'Content-Type': 'application/json', 'x-api-key': this.apiKey as string'anthropic-version' : '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '{}';

    try {
      return JSON.parse(content);
    } catch {
      return { code: content, explanation: 'AI response', confidence: 0.7 };
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(context: AIContext): string {
    return `${context.language}:${context.currentCode.substring(0, 100)}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.requestCache.clear();
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.completionHistory = [];
    this.notifyListeners();
  }

  /**
   * Get history
   */
  getHistory(): AICompletion[] {
    return [...this.completionHistory];
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<AICompletionConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get config
   */
  getConfig(): AICompletionConfig {
    return { ...this.config };
  }
}

/**
 * React Hook for AI Code Completion
 */
export function useAICodeCompletion(config: Partial<AICompletionConfig> = {}) {
  const engineRef = useRef(new AICodeCompletionEngine(config);
  const [completions, setCompletions] = useState<AICompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(engineRef.current.isReady();

  useEffect(() => {
    const unsubscribe = engineRef.current.subscribe(setCompletions);
    return unsubscribe;
  }, []);

  const getCompletions = useCallback(async (context: AIContext) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await engineRef.current.getCompletions(context);
      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateComponent = useCallback(async (description: string, context: AIContext) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await engineRef.current.generateComponent(description, context);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Component generation failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const suggestRefactoring = useCallback(async (context: AIContext) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await engineRef.current.suggestRefactoring(context);
      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refactoring suggestions failed';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const explainCode = useCallback(async (context: AIContext) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await engineRef.current.explainCode(context);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message :'Code explanation failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setApiKey = useCallback((key: string) => {
    engineRef.current.setApiKey(key);
    setIsConfigured(engineRef.current.isReady();
  }, []);

  const updateConfig = useCallback((newConfig: Partial<AICompletionConfig>) => {
    engineRef.current.updateConfig(newConfig);
  }, []);

  const clearHistory = useCallback(() => {
    engineRef.current.clearHistory();
  }, []);

  const clearCache = useCallback(() => {
    engineRef.current.clearCache();
  }, []);

  return {
    completions,
    isLoading,
    error,
    isConfigured,
    getCompletions,
    generateComponent,
    suggestRefactoring,
    explainCode,
    setApiKey,
    updateConfig,
    clearHistory,
    clearCache,
  };
}

/**
 * Singleton instance
 */
export const aiCodeCompletionEngine = new AICodeCompletionEngine();
