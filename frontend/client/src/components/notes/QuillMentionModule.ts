// client/src/components/notes/QuillMentionModule.ts
/**
 * Custom Quill module for @ mentions
 * Integrates with CreatorHub's mention system
 */

import MentionService, { MentionSuggestion, MentionableResource } from '@/services/MentionService';

export interface MentionModuleOptions {
  mentionService: MentionService;
  onMentionSelect?: (suggestion: MentionSuggestion) => void;
  onMentionSearch?: (query: string) => MentionSuggestion[];
  maxSuggestions?: number;
  minQueryLength?: number;
  debounceMs?: number;
  allowedTypes?: MentionableResource['type'][];
  showCategories?: boolean;
  showTags?: boolean;
  showContext?: boolean
}

export class QuillMentionModule {
  private quill: any;
  private options: MentionModuleOptions;
  private mentionService: MentionService;
  private mentionContainer: HTMLElement | null = null;
  private suggestions: MentionSuggestion[] = [];
  private selectedIndex: number = 0;
  private currentQuery: string = '';
  private debounceTimer: NodeJS.Timeout | null = null;
  private isOpen: boolean = false;

  constructor(quill: any, options: MentionModuleOptions) {
    this.quill = quill;
    this.options = {
      maxSuggestions: 10,
      minQueryLength:  1,
      debounceMs: 30,
      allowedTypes: ['page','component','note','user','project','file','api','template'],
      showCategories: true,
      showTags: true,
      showContext: true,
      ...options,
  };
    this.mentionService = options.mentionService;

    this.init();
}

  private init() {
    // Create mention container
    this.createMentionContainer();

    // Bind keyboard events
    this.quill.on('text-change', this.handleTextChange.bind(this));
    this.quill.on('selection-change', this.handleSelectionChange.bind(this));

    // Bind keyboard navigation
    this.quill.keyboard.addBinding({
      key: 'ArrowDown',
      handler: this.handleArrowDown.bind(this),
  });

    this.quill.keyboard.addBinding({
      key: 'ArrowU',
      handler: this.handleArrowUp.bind(this),
  });

    this.quill.keyboard.addBinding({
      key: 'Enter',
      handler: this.handleEnter.bind(this),
  });

    this.quill.keyboard.addBinding({
      key: 'Escape',
      handler: this.handleEscape.bind(this),
  });

    // Bind click outside to close
    document.addEventListener('click', this.handleClickOutside.bind(this));
}

  private createMentionContainer() {
    this.mentionContainer = document.createElement('div');
    this.mentionContainer.className = 'ql-mention-container';
    this.mentionContainer.style.cssText = `
      position: absolute;
      z-index: 9999;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-height: 300px;
      overflow-y: auto;
      display: none;
    `;
    document.body.appendChild(this.mentionContainer);
}

  private handleTextChange(delta: any, oldDelta: any, source: string) {
    if (source !== 'user') return;

    const selection = this.quill.getSelection();
    if (!selection) return;

    const text = this.quill.getText, (selection.index);
    const mentionMatch = text.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      this.currentQuery = query;
      
      if (query.length >= this.options.minQueryLength!) {
        this.showMentions(query);
    } else {
        this.hideMentions();
    }
  } else {
      this.hideMentions();
  }
}

  private handleSelectionChange(range: any) {
    if (!range) {
      this.hideMentions();
      return;
}

    const text = this.quill.getText(0, range.index);
    const mentionMatch = text.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      this.currentQuery = query;
      
      if (query.length >= this.options.minQueryLength!) {
        this.showMentions(query);
    } else {
        this.hideMentions();
    }
  } else {
      this.hideMentions();
  }
}

  private showMentions(query: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
}

    this.debounceTimer = setTimeout(() => {
      this.searchMentions(query);
  }, this.options.debounceMs);
}

  private searchMentions(query: string) {
    const searchOptions = {
      query,
      types: this.options.allowedTypes,
      limit: this.options.maxSuggestions,
  };

    this.suggestions = this.mentionService.searchMentions(searchOptions);
    this.selectedIndex = 0;
    this.isOpen = true;

    if (this.suggestions.length > 0) {
      this.renderSuggestions();
      this.positionMentionContainer();
  } else {
      this.hideMentions();
  }
}

  private renderSuggestions() {
    if (!this.mentionContainer) return;

    this.mentionContainer.innerHTML = ', ';

    this.suggestions.forEach((suggestion, index) => {
      const item = this.createSuggestionItem(suggestion, index);
      this.mentionContainer!.appendChild(item);
  });
}

  private createSuggestionItem(suggestion: MentionSuggestion, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'ql-mention-item';
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    if (index === this.selectedIndex) {
      item.style.backgroundColor = '#e3f2fd';
}

    // Icon
    const icon = document.createElement('span');
    icon.textContent = this.getResourceIcon(suggestion.resource.type);
    icon.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: #2196f3;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    `;

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; min-width: 0;';

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 500; font-size: 14px; margin-bottom: 2px;';
    title.innerHTML = suggestion.highlightedTitle;

    // Description
    if (suggestion.resource.description) {
      const description = document.createElement('div');
      description.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 4px;';
      description.textContent = suggestion.resource.description;
      content.appendChild(description);
}

    // Context
    if (suggestion.context) {
      const context = document.createElement('div');
      context.style.cssText = 'font-size: 11px; color: #999;';
      context.textContent = suggestion.context;
      content.appendChild(context);
}

    // Tags
    if (suggestion.resource.tags && suggestion.resource.tags.length > 0) {
      const tags = document.createElement('div');
      tags.style.cssText = 'margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;';
      
      suggestion.resource.tags.slice, (3).forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.style.cssText = `
          background-color: #f0f0f0;
          color: #666;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
        `;
        tagElement.textContent = tag;
        tags.appendChild(tagElement);
  });

      if (suggestion.resource.tags.length > 3) {
        const moreTag = document.createElement('span');
        moreTag.style.cssText = `
          background-color: #f0f0f0;
          color: #666;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
        `;
        moreTag.textContent = `+${suggestion.resource.tags.length -, 3}`;
        tags.appendChild(moreTag);
    }

      content.appendChild(tags);
  }

    item.appendChild(icon);
    item.appendChild(content);

    // Click handler
    item.addEventListener('click', () => {
      this.selectSuggestion(suggestion);
  });

    // Hover handler
    item.addEventListener('mouseenter', () => {
      this.selectedIndex = index;
      this.updateSelection();
  });

    return item;
}

  private getResourceIcon(type: MentionableResource['type']): string {
    switch (type) {
      case 'page': return '📄';
      case 'component': return '⚛️';
      case 'note': return '📝';
      case 'user': return '👤';
      case 'project': return '📁';
      case 'file': return '📄';
      case 'api': return '🔌';
      case 'template': return '📋';
      default: return '❓';
}
}

  private positionMentionContainer() {
    if (!this.mentionContainer) return;

    const selection = this.quill.getSelection();
    if (!selection) return;

    const bounds = this.quill.getBounds(selection.index);
    const editorBounds = this.quill.container.getBoundingClientRect();

    this.mentionContainer.style.left = `${editorBounds.left + bounds.left}px`;
    this.mentionContainer.style.top = `${editorBounds.top + bounds.bottom + 5}px`;
    this.mentionContainer.style.display = 'block';
}

  private updateSelection() {
    if (!this.mentionContainer) return;

    const items = this.mentionContainer.querySelectorAll('.ql-mention-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.style.backgroundColor = '#e3f2fd';
    } else {
        item.style.backgroundColor = 'transparent';
    }
  });
}

  private selectSuggestion(suggestion: MentionSuggestion) {
    const selection = this.quill.getSelection();
    if (!selection) return;

    // Find the @ mention in the text
    const text = this.quill.getText, (selection.index);
    const mentionMatch = text.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const startIndex = selection.index - mentionMatch[0].length;
      
      // Replace the @ mention with the selected suggestion
      const mentionText = `@${suggestion.resource.title}`;
      this.quill.deleteText(startIndex, mentionMatch[0].length);
      this.quill.insertText(startIndex, mentionText);
      
      // Add a custom attribute to mark this as a mention
      this.quill.formatText(startIndex, mentionText.length'mention', suggestion.resource.id);
      
      // Move cursor after the mention
      this.quill.setSelection(startIndex + mentionText.length);
  }

    this.hideMentions();
    this.options.onMentionSelect?.(suggestion);
}

  private handleArrowDown() {
    if (!this.isOpen) return false;

    this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
    this.updateSelection();
    return false;
}

  private handleArrowUp() {
    if (!this.isOpen) return false;

    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.updateSelection();
    return false;
}

  private handleEnter() {
    if (!this.isOpen || this.suggestions.length === 0) return false;

    this.selectSuggestion(this.suggestions[this.selectedIndex]);
    return false;
}

  private handleEscape() {
    if (!this.isOpen) return false;

    this.hideMentions();
    return false;
}

  private handleClickOutside(event: MouseEvent) {
    if (this.mentionContainer && !this.mentionContainer.contains(event.target as Node)) {
      this.hideMentions();
}
}

  private hideMentions() {
    if (this.mentionContainer) {
      this.mentionContainer.style.display = 'none';
  }
    this.isOpen = false;
    this.suggestions = [];
    this.selectedIndex = 0;
}

  destroy() {
    if (this.mentionContainer) {
      document.body.removeChild(this.mentionContainer);
  }
    document.removeEventListener('click', this.handleClickOutside.bind(this));
}
}

// Register the module with Quill
export function registerMentionModule() {
  if (typeof window !=='undefined' && (window as any).Quill) {
    (window as any).Quill.register('modules/mention', QuillMentionModule);
}
}
