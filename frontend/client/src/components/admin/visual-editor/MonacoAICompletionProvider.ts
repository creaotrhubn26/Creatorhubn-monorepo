/**
 * Monaco Editor AI Inline Completion Provider
 * Integrates AI code completion directly into Monaco Editor
 */

import * as monaco from 'monaco-editor';
import { AICodeCompletionEngine, AIContext } from './AICodeCompletionSystem';

export class MonacoAICompletionProvider implements monaco.languages.InlineCompletionsProvider {
  private aiEngine: AICodeCompletionEngine;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastRequest: number = 0;
  private minRequestInterval: number = 1000; // Minimum 1 second between requests

  constructor(aiEngine: AICodeCompletionEngine) {
    this.aiEngine = aiEngine;
  }

  /**
   * Provide inline completions for Monaco Editor
   */
  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken,
  ): Promise<monaco.languages.InlineCompletions | undefined> {
    // Check if AI is ready
    if (!this.aiEngine.isReady()) {
      return undefined;
    }

    // Throttle requests
    const now = Date.now();
    if (now - this.lastRequest < this.minRequestInterval) {
      return undefined;
    }
    this.lastRequest = now;

    // Only trigger on typing, not on explicit invoke
    if (context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Automatic) {
      return undefined;
    }

    try {
      // Get current code and context
      const fullCode = model.getValue();
      const lineContent = model.getLineContent(position.lineNumber);
      const cursorColumn = position.column;

      // Build AI context
      const aiContext: AIContext = {
        currentCode: fullCode,
        language: this.getLanguageFromModel(model),
        cursor: {
          line: position.lineNumber,
          column: cursorColumn,
        },
        selectedText: undefined,
        elements: [],
      };

      // Request completion from AI
      const completions = await this.aiEngine.getCompletions(aiContext);

      if (token.isCancellationRequested || completions.length === 0) {
        return undefined;
      }

      // Convert AI completions to Monaco inline completions
      const items: monaco.languages.InlineCompletion[] = completions.map((completion) => {
        // Extract the completion text
        const completionText = this.extractCompletionText(completion.code, lineContent, cursorColumn);

        return {
          insertText: completionText,
          range: new monaco.Range(
            position.lineNumber,
            cursorColumn,
            position.lineNumber,
            cursorColumn,
          ),
          command: {
            id: 'ai-completion-accepted',
            title: 'AI Completion Accepted',
          },
        };
      });

      return {
        items,
        enableForwardStability: true,
      };
    } catch (error) {
      console.error('AI inline completion error: ', error);
      return undefined;
    }
  }

  /**
   * Free resources
   */
  freeInlineCompletions(completions: monaco.languages.InlineCompletions): void {
    // Cleanup if needed
  }

  /**
   * Extract language from model
   */
  private getLanguageFromModel(model: monaco.editor.ITextModel): string {
    const languageId = model.getLanguageId();

    switch (languageId) {
      case 'javascript': case 'typescript': case 'javascriptreact': case 'typescriptreact': return 'typescript';
      case 'html': return 'html';
      case 'css': case 'scss': case 'less': return 'css';
      default: return languageId;
    }
  }

  /**
   * Extract relevant completion text from AI response
   */
  private extractCompletionText(aiCode: string, currentLine: string, cursorColumn: number): string {
    // If AI returned complete code, try to extract just the next line or completion
    const lines = aiCode.split('\n');

    // Find the most relevant line to complete
    const currentLinePrefix = currentLine.substring(0, cursorColumn - 1).trim();

    // Look for a line that starts with similar content
    for (const line of lines) {
      if (line.trim().startsWith(currentLinePrefix)) {
        // Return the rest of the line
        const completion = line.trim().substring(currentLinePrefix.length);
        if (completion) {
          return completion;
        }
      }
    }

    // If no match, return the first non-empty line
    const firstLine = lines.find((l) => l.trim().length > 0);
    return firstLine?.trim() || aiCode.trim();
  }
}

/**
 * Register AI completion provider for Monaco Editor
 */
export function registerAICompletionProvider(
  aiEngine: AICodeCompletionEngine,
  languages: string[] = [
    'typescript','javascript','typescriptreact','javascriptreact','html','css',
  ],
): monaco.IDisposable[] {
  const provider = new MonacoAICompletionProvider(aiEngine);
  const disposables: monaco.IDisposable[] = [];

  for (const language of languages) {
    const disposable = monaco.languages.registerInlineCompletionsProvider(language, provider);
    disposables.push(disposable);
  }

  return disposables;
}

/**
 * Configure Monaco Editor for AI completions
 */
export function configureMonacoForAI(editor: monaco.editor.IStandaloneCodeEditor) {
  // Enable inline suggestions
  editor.updateOptions({
    inlineSuggest: {
      enabled: true,
      mode: 'prefix',
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: true,
    // AI-specific settings
    suggest: {
      preview: true,
      showInlineDetails: true,
      insertMode: 'insert',
    },
  });

  // Add keybindings for AI completions
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
    // Manually trigger inline suggestions
    editor.trigger('ai', 'editor.action.inlineSuggest.trigger', {});
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period, () => {
    // Show AI assistant panel
    editor.trigger('ai', 'editor.action.quickFix', {});
  });
}
