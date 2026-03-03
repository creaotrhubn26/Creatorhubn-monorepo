
// aiAssistant.ts
// Utilities for AI-powered assistance: suggestions, conversations, simple workflows,
// lightweight code/design generation records. Pure TypeScript—no framework deps.

export type AISuggestionType =
  | 'design'
  | 'code'
  | 'content'
  | 'performance'
  | 'accessibility'
  | 'seo';

export type AISuggestionPriority = 'low' | 'medium' | 'high' | 'critical';

export type AISuggestionStatus =
  | 'new'
  | 'reviewed'
  | 'accepted'
  | 'rejected'
  | 'implemented';

export interface AISuggestion {
  id: string;
  type: AISuggestionType;
  title: string;
  description: string;
  priority: AISuggestionPriority;
  confidence: number; // 0..1
  category: string;
  suggestions: string[];
  codeExample?: string;
  visualExample?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  status: AISuggestionStatus;
}

export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface AIConversationContext {
  projectId?: string;
  elementId?: string;
  currentView?: string;
  userIntent?: string;
  [key: string]: any;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  context: AIConversationContext;
  createdAt: Date;
  updatedAt: Date;
}

export type AIWorkflowStepType =
  | 'prompt'
  | 'analysis'
  | 'generation'
  | 'validation'
  | 'action';

export interface AIWorkflowStep {
  id: string;
  name: string;
  type: AIWorkflowStepType;
  prompt?: string;
  parameters: Record<string, any>;
  dependencies: string[];
  output: Record<string, any>;
}

export type AIWorkflowStatus = 'draft' | 'running' | 'succeeded' | 'failed';

export interface AIWorkflow {
  id: string;
  name: string;
  description?: string;
  steps: AIWorkflowStep[];
  triggers: string[];
  isActive: boolean;
  status: AIWorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AICodeGeneration {
  id: string;
  prompt: string;
  context: {
    projectType: string;
    framework: string;
    language: string;
    requirements: string[];
  };
  language: 'typescript' | 'javascript' | 'python' | 'bash' | 'go' | 'other';
  targetPath?: string;
  snippet: string;
  quality: {
    score: number;
    rationale: string;
  };
  notes?: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface AIDesignSuggestion {
  id: string;
  elementId: string;
  area:
    | 'layout'
    | 'typography'
    | 'color'
    | 'component'
    | 'accessibility'
    | 'motion'
    | 'other';
  title: string;
  description: string;
  suggestions: string[];
  alternatives: string[];
  beforeAfter?: {
    before?: string;
    after?: string;
};
  tokens?: Record<string, string | number>;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface AIAssistantState {
  suggestions: AISuggestion[];
  conversations: AIConversation[];
  workflows: AIWorkflow[];
  codeGenerations: AICodeGeneration[];
  designSuggestions: AIDesignSuggestion[];
}

/** In-memory assistant; can be wired to persistence later */
export class AIAssistant implements AIAssistantState {
  suggestions: AISuggestion[] = [];
  conversations: AIConversation[] = [];
  workflows: AIWorkflow[] = [];
  codeGenerations: AICodeGeneration[] = [];
  designSuggestions: AIDesignSuggestion[] = [];

  constructor(seed: Partial<AIAssistantState> = {}) {
    if (seed.suggestions) this.suggestions = seed.suggestions;
    if (seed.conversations) this.conversations = seed.conversations;
    if (seed.workflows) this.workflows = seed.workflows;
    if (seed.codeGenerations) this.codeGenerations = seed.codeGenerations;
    if (seed.designSuggestions) this.designSuggestions = seed.designSuggestions;

    // Provide a tiny, clean default dataset if nothing was passed in.
    if (
      !seed.suggestions &&
      !seed.conversations &&
      !seed.workflows &&
      !seed.codeGenerations &&
      !seed.designSuggestions
    ) {
      this.bootstrapSamples();
  }
}

  /** --- Suggestions ------------------------------------------------------ */
  addSuggestion(
    s: Omit<AISuggestion, 'createdAt' | 'status'> & { status?: AISuggestionStatus }
  ): AISuggestion {
    const suggestion: AISuggestion = {
      ...s,
      createdAt: new Date(),
      status: s.status ?? 'new',
  };
    this.suggestions.push(suggestion);
    return suggestion;
}

  updateSuggestionStatus(id: string, status: AISuggestionStatus): AISuggestion | null {
    const it = this.suggestions.find((s) => s.id === id);
    if (!it) return null;
    it.status = status;
    return it;
  }

  getSuggestionsByType(type: AISuggestionType): AISuggestion[] {
    return this.suggestions.filter((s) => s.type === type);
}

  getTopSuggestions(limit = 5): AISuggestion[] {
    return [...this.suggestions]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  getSuggestions(filter?: { type?: string; status?: string; priority?: string }): AISuggestion[] {
    return this.suggestions.filter((suggestion) => {
      if (filter?.type && suggestion.type !== filter.type) {
        return false;
      }
      if (filter?.status && suggestion.status !== filter.status) {
        return false;
      }
      if (filter?.priority && suggestion.priority !== filter.priority) {
        return false;
      }
      return true;
    });
  }

  generateSuggestions(context: Record<string, any>): AISuggestion[] {
    const contextLabel = typeof context.currentView === 'string' ? context.currentView : 'workspace';
    const generated = this.addSuggestion({
      id: `sg_${Date.now()}`,
      type: 'performance',
      title: `Optimize ${contextLabel} rendering`,
      description: `AI detected optimization opportunities for ${contextLabel}.`,
      priority: 'medium',
      confidence: 0.74,
      category: 'auto-analysis',
      suggestions: ['Reduce expensive re-renders', 'Memoize derived selectors', 'Virtualize long lists'],
      metadata: { context },
    });
    return [generated];
  }

  /** --- Conversations ---------------------------------------------------- */
  startConversation(title: string, context: AIConversationContext = {}): AIConversation {
    const now = new Date();
    const conv: AIConversation = {
      id: `conv_${now.getTime()}`,
      title,
      messages: [],
      context,
      createdAt: now,
      updatedAt: now,
  };
    this.conversations.push(conv);
    return conv;
  }

  getConversations(): AIConversation[] {
    return [...this.conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  createConversation(title: string, context: AIConversationContext = {}): AIConversation {
    return this.startConversation(title, context);
  }

  getConversation(id: string): AIConversation | undefined {
    return this.conversations.find((conversation) => conversation.id === id);
  }

  addConversationMessage(conversationId: string, msg: Omit<AIMessage, 'createdAt' | 'id'> & { id?: string }): AIMessage | null {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv) return null;
    const message: AIMessage = {
      id: msg.id ?? `msg_${Date.now()}`,
      role: msg.role,
      content: msg.content,
      createdAt: new Date(),
      metadata: msg.metadata,
  };
    conv.messages.push(message);
    conv.updatedAt = new Date();
    return message;
  }

  addMessage(conversationId: string, role: 'user' | 'assistant', content: string, metadata?: AIMessage['metadata']): AIMessage | null {
    return this.addConversationMessage(conversationId, {
      role,
      content,
      metadata,
    });
  }

  generateAIResponse(conversationId: string, userMessage: string): AIMessage | null {
    const lowerMessage = userMessage.toLowerCase();
    const responseContent = lowerMessage.includes('color')
      ? 'Try consolidating your palette into semantic tokens to keep color usage consistent.'
      : lowerMessage.includes('performance')
      ? 'Use memoization for expensive computations and defer non-critical rendering.'
      : 'I analyzed your request and prepared a practical next step. Ask for code if you want a generated implementation.';

    return this.addConversationMessage(conversationId, {
      role: 'assistant',
      content: responseContent,
      metadata: {
        suggestions: [
          { title: 'Apply recommendation' },
          { title: 'Generate patch' },
        ],
      },
    });
  }

  /** --- Workflows -------------------------------------------------------- */
  startWorkflow(name: string, steps: AIWorkflowStep[], description?: string, metadata?: Record<string, any>): AIWorkflow {
    const now = new Date();
    const wf: AIWorkflow = {
      id: `wf_${now.getTime()}`,
      name,
      description,
      steps,
      triggers: ['manual'],
      isActive: true,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      metadata,
  };
    this.workflows.push(wf);
    return wf;
  }

  getWorkflows(): AIWorkflow[] {
    return [...this.workflows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  createWorkflow(data: Omit<AIWorkflow, 'id' | 'createdAt' | 'updatedAt'>): AIWorkflow {
    const now = new Date();
    const workflow: AIWorkflow = {
      id: `wf_${now.getTime()}`,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    this.workflows.push(workflow);
    return workflow;
  }

  finishWorkflow(id: string, ok: boolean): boolean {
    const wf = this.workflows.find((w) => w.id === id);
    if (!wf) return false;
    wf.status = ok ? 'succeeded' : 'failed';
    wf.updatedAt = new Date();
    return true;
}

  /** --- Code Generation -------------------------------------------------- */
  addCodeGeneration(entry: Omit<AICodeGeneration, 'createdAt' | 'id'> & { id?: string }): AICodeGeneration {
    const now = new Date();
    const cg: AICodeGeneration = {
      id: entry.id ?? `code_${now.getTime()}`,
      createdAt: now,
      ...entry,
  };
    this.codeGenerations.push(cg);
    return cg;
  }

  private buildCodeSnippet(prompt: string, context: AICodeGeneration['context']): string {
    const componentName = prompt
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join('') || 'GeneratedComponent';
    return `export function ${componentName}() {\n  return (\n    <div>${context.framework} generated: ${prompt}</div>\n  );\n}\n`;
  }

  generateCode(prompt: string, context: AICodeGeneration['context']): AICodeGeneration {
    const normalizedLanguage = context.language.toLowerCase();
    const language: AICodeGeneration['language'] =
      normalizedLanguage === 'typescript' || normalizedLanguage === 'javascript' || normalizedLanguage === 'python' || normalizedLanguage === 'bash' || normalizedLanguage === 'go'
        ? (normalizedLanguage as AICodeGeneration['language'])
        : 'other';
    const qualityScore = Math.min(0.98, 0.65 + Math.min(context.requirements.length, 5) * 0.05);

    return this.addCodeGeneration({
      prompt,
      context,
      language,
      targetPath: 'src/generated/ai-snippet.tsx',
      snippet: this.buildCodeSnippet(prompt, context),
      quality: {
        score: qualityScore,
        rationale: 'Score based on requirement coverage and context specificity.',
      },
      notes: `Generated for ${context.projectType}`,
      metadata: {
        framework: context.framework,
      },
    });
  }

  /** --- Design Suggestions ----------------------------------------------- */
  addDesignSuggestion(s: Omit<AIDesignSuggestion, 'createdAt'>): AIDesignSuggestion {
    const ds: AIDesignSuggestion = { ...s, createdAt: new Date() };
    this.designSuggestions.push(ds);
    return ds;
  }

  getCodeGenerations(): AICodeGeneration[] {
    return [...this.codeGenerations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getDesignSuggestions(): AIDesignSuggestion[] {
    return [...this.designSuggestions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  generateDesignSuggestions(elementId: string, currentDesign: Record<string, any>): AIDesignSuggestion {
    const keys = Object.keys(currentDesign);
    return this.addDesignSuggestion({
      id: `ds_${Date.now()}`,
      elementId,
      area: 'component',
      title: `Enhance ${elementId} styling`,
      description: 'AI generated refinements for hierarchy and readability.',
      suggestions: [
        'Increase contrast between background and text',
        'Tighten vertical rhythm for readability',
      ],
      alternatives: [
        'Compact variant',
        'Spacious variant',
      ],
      tokens: {
        '--ai-element-key-count': keys.length,
      },
      metadata: { currentDesign },
    });
  }

  /** --- Serialization ---------------------------------------------------- */
  toJSON(): AIAssistantState {
    return {
      suggestions: this.suggestions,
      conversations: this.conversations,
      workflows: this.workflows,
      codeGenerations: this.codeGenerations,
      designSuggestions: this.designSuggestions,
  };
}

  loadFromJSON(data: Partial<AIAssistantState>): void {
    if (data.suggestions) this.suggestions = data.suggestions.map((s) => ({ ...s, createdAt: new Date(s.createdAt) }));
    if (data.conversations)
      this.conversations = data.conversations.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map((m) => ({ ...m, createdAt: new Date(m.createdAt) })),
    }));
    if (data.workflows)
      this.workflows = data.workflows.map((w) => ({
        ...w,
        createdAt: new Date(w.createdAt),
        updatedAt: new Date(w.updatedAt),
    }));
    if (data.codeGenerations)
      this.codeGenerations = data.codeGenerations.map((cg) => ({
        ...cg,
        createdAt: new Date(cg.createdAt),
    }));
    if (data.designSuggestions)
      this.designSuggestions = data.designSuggestions.map((ds) => ({
        ...ds,
        createdAt: new Date(ds.createdAt),
    }));
  }

  exportData(): Record<string, any> {
    return this.toJSON();
  }

  importData(data: Record<string, any>): void {
    this.loadFromJSON(data as Partial<AIAssistantState>);
  }

  /** Sample content to keep the UI from being empty during development */
  private bootstrapSamples(): void {
    const now = new Date();

    this.suggestions = [
      {
        id: 'sg_001',
        type: 'performance',
        title: 'Enable lazy loading for dashboard widgets',
        description:
          'Defer heavy widget initialization until they are within the viewport to reduce initial TTI.',
        priority: 'high',
        confidence: 0.86,
        category: 'runtime',
        suggestions: ['Use IntersectionObserver','Split vendor chunks','Prefetch routes'],
        metadata: { route: '/dashboard' },
        createdAt: now,
        status: 'new',
    },
      {
        id: 'sg_002',
        type: 'accessibility',
        title: 'Improve color contrast for muted text',
        description:
          'Muted text fails WCAG 2.2 contrast ratio on light theme; bump contrast tokens.',
        priority: 'medium',
        confidence: 0.78,
        category: 'a11y',
        suggestions: ['Update semantic token --text-muted', 'Re-test with axe-core'],
        metadata: { token: '--text-muted' },
        createdAt: now,
        status: 'reviewed',
    },
    ];

    const convId = `conv_${now.getTime()}`;
    this.conversations = [
      {
        id: convId,
        title: 'Design System Help',
        context: { projectId: 'demo', currentView: 'DesignSystem' },
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: 'msg_001',
            role: 'user',
            content: 'How can I tighten the spacing scale without breaking pages?',
            createdAt: now,
        },
          {
            id: 'msg_002',
            role: 'assistant',
            content:
              'Introduce a compact spacing mode and map old tokens to the closest values; ship behind a flag.',
            createdAt: now,
        },
        ],
    },
    ];

    this.workflows = [
      {
        id: `wf_${now.getTime()}`,
        name: 'Create Feature Spec',
        description: 'From user prompt to a concise, actionable feature spec.',
        steps: [
          {
            id: 'step_1',
            name: 'Understand intent',
            type: 'analysis',
            parameters: {},
            dependencies: [],
            output: {},
        },
          {
            id: 'step_2',
            name: 'Draft spec',
            type: 'generation',
            prompt: 'Create a one-pager including problem, scope, acceptance criteria.',
            parameters: { bullets: true },
            dependencies: ['step_1'],
            output: {},
        },
        ],
        triggers: ['manual'],
        isActive: true,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
    },
    ];

    this.codeGenerations = [
      {
        id: `code_${now.getTime()}`,
        prompt: 'Create a React card component with title, body, and actions.',
        context: {
          projectType: 'react-ui',
          framework: 'react',
          language: 'typescript',
          requirements: ['responsive', 'accessible'],
        },
        language: 'typescript',
        targetPath: 'client/src/components/ui/Card.tsx',
        snippet:
          `export function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <div className="mb-2 font-medium">{title}</div>
      <div className="text-sm">{children}</div>
      {actions ? <div className="mt-3 flex gap-2">{actions}</div> : null}
    </div>
  );
}`,
        quality: {
          score: 0.88,
          rationale: 'Baseline sample quality score for starter snippet.',
        },
        notes: 'Minimal styling; wire to your design system tokens.',
        createdAt: now,
        metadata: { framework: 'react' },
    },
    ];

    this.designSuggestions = [
      {
        id: 'ds_001',
        elementId: 'hero-title',
        area: 'typography',
        title: 'Use optical size for display fonts',
        description:
          'At large sizes, enable optical size axis for better contrast and letter shape.',
        suggestions: ['Enable optical sizing axis', 'Adjust letter spacing at large sizes'],
        alternatives: ['Use a display font family', 'Use dynamic clamp() typography scale'],
        tokens: {'--font-display-size': 64 },
        createdAt: now,
    },
    ];
}
}

// Export a singleton instance for convenience
export const aiAssistant = new AIAssistant();
