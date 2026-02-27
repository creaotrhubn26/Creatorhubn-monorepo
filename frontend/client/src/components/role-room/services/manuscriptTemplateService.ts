/**
 * Manuscript Template Service
 * Manages screenplay templates and auto-completion
 */

import {
  Template,
  TemplateLibrary,
  AutoCompleteSuggestion,
  buildTemplateLibrary,
  AUTO_COMPLETE_SUGGESTIONS,
  STRUCTURE_TEMPLATES,
  StructureTemplate
} from '../data/manuscriptTemplates';
import settingsService, { getCurrentUserId } from './settingsService';

const STORAGE_KEY = 'virtualStudio_manuscriptTemplates';
const RECENT_KEY = 'virtualStudio_recentTemplates';
const MAX_RECENT = 10;

class ManuscriptTemplateService {
  private userTemplates: Template[] = [];
  private recentTemplates: Template[] = [];

  constructor() {
    void this.hydrateFromDb();
  }

  private async hydrateFromDb(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const userId = getCurrentUserId();
      const [templates, recents] = await Promise.all([
        settingsService.getSetting<Template[]>(STORAGE_KEY, { userId }),
        settingsService.getSetting<Template[]>(RECENT_KEY, { userId }),
      ]);

      if (templates) {
        this.userTemplates = templates;
      }
      if (recents) {
        this.recentTemplates = recents;
      }
    } catch {
      // Ignore hydration errors
    }
  }
  
  /**
   * Get all available templates
   */
  getTemplates(): TemplateLibrary {
    const library = buildTemplateLibrary();
    library.userTemplates = this.getUserTemplates();
    library.recentlyUsed = this.getRecentTemplates();
    return library;
  }
  
  /**
   * Get template by ID
   */
  getTemplate(templateId: string): Template | null {
    const library = this.getTemplates();
    
    // Search in all categories
    for (const category of library.categories) {
      const template = category.templates.find(t => t.id === templateId);
      if (template) return template;
    }
    
    // Search in user templates
    const userTemplate = library.userTemplates.find(t => t.id === templateId);
    if (userTemplate) return userTemplate;
    
    return null;
  }
  
  /**
   * Apply template to manuscript content
   */
  applyTemplate(currentContent: string, template: Template, cursorPosition?: number): string {
    switch (template.type) {
      case 'full-manuscript':
        // Replace entire content
        return template.content;
        
      case 'scene':
      case 'character':
      case 'dialogue':
      case 'action':
        // Insert at cursor position or append
        if (cursorPosition !== undefined) {
          return this.insertAtCursor(currentContent, template.content, cursorPosition);
        } else {
          return this.appendTemplate(currentContent, template.content);
        }
        
      default:
        return currentContent;
    }
  }
  
  /**
   * Insert template at cursor position
   */
  private insertAtCursor(content: string, templateContent: string, position: number): string {
    const before = content.substring(0, position);
    const after = content.substring(position);
    
    // Add spacing if needed
    const needsSpaceBefore = before.trim().length > 0 && !before.endsWith('\n\n');
    const needsSpaceAfter = after.trim().length > 0 && !after.startsWith('\n\n');
    
    const spacing = needsSpaceBefore ? '\n\n' : '';
    const afterSpacing = needsSpaceAfter ? '\n\n' : '';
    
    return before + spacing + templateContent + afterSpacing + after;
  }
  
  /**
   * Append template to end of content
   */
  private appendTemplate(content: string, templateContent: string): string {
    const trimmed = content.trim();
    if (!trimmed) return templateContent;
    
    return trimmed + '\n\n' + templateContent;
  }
  
  /**
   * Get auto-complete suggestions based on context
   */
  getSuggestions(content: string, cursorPosition: number): AutoCompleteSuggestion[] {
    const context = this.analyzeContext(content, cursorPosition);
    
    switch (context.type) {
      case 'scene-heading':
        return AUTO_COMPLETE_SUGGESTIONS.SCENE_HEADING;
      
      case 'time-of-day':
        return AUTO_COMPLETE_SUGGESTIONS.TIME_OF_DAY;
      
      case 'transition':
        return AUTO_COMPLETE_SUGGESTIONS.TRANSITIONS;
      
      default:
        return [];
    }
  }
  
  /**
   * Analyze context at cursor position
   */
  private analyzeContext(content: string, cursorPosition: number): { type: string; context: string } {
    const before = content.substring(0, cursorPosition);
    const lines = before.split('\n');
    const currentLine = lines[lines.length - 1];
    const trimmed = currentLine.trim();
    
    // Scene heading detection
    if (trimmed.match(/^(INT|EXT|INT\/EXT)\.?$/i)) {
      return { type: 'scene-heading', context: trimmed };
    }
    
    // Time of day detection
    if (trimmed.match(/^(INT|EXT|INT\/EXT)\..+\s-\s?$/i)) {
      return { type: 'time-of-day', context: trimmed };
    }
    
    // Transition detection
    if (trimmed.match(/^[A-Z\s]+$/)) {
      return { type: 'transition', context: trimmed };
    }
    
    return { type: 'none', context: '' };
  }
  
  /**
   * Save user-created template
   */
  saveUserTemplate(template: Omit<Template, 'id' | 'createdAt' | 'isUserTemplate'>): Template {
    const userTemplates = this.getUserTemplates();
    
    const newTemplate: Template = {
      ...template,
      id: `user-template-${Date.now()}`,
      isUserTemplate: true,
      createdAt: new Date().toISOString(),
      usageCount: 0
    };
    
    userTemplates.push(newTemplate);
    this.saveUserTemplates(userTemplates);
    
    return newTemplate;
  }
  
  /**
   * Delete user template
   */
  deleteUserTemplate(templateId: string): void {
    const userTemplates = this.getUserTemplates();
    const filtered = userTemplates.filter(t => t.id !== templateId);
    this.saveUserTemplates(filtered);
  }
  
  /**
   * Get user templates from storage
   */
  private getUserTemplates(): Template[] {
    return this.userTemplates;
  }
  
  /**
   * Save user templates to storage
   */
  private saveUserTemplates(templates: Template[]): void {
    try {
      this.userTemplates = templates;
      void settingsService.setSetting(STORAGE_KEY, templates, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Error saving user templates:', error);
    }
  }
  
  /**
   * Track template usage
   */
  trackTemplateUsage(templateId: string): void {
    const recent = this.getRecentTemplates();
    
    // Remove if already in recent
    const filtered = recent.filter(t => t.id !== templateId);
    
    // Get the template
    const template = this.getTemplate(templateId);
    if (!template) return;
    
    // Add to front
    const updated: Template = {
      ...template,
      usageCount: (template.usageCount || 0) + 1
    };
    
    filtered.unshift(updated);
    
    // Keep only MAX_RECENT
    const trimmed = filtered.slice(0, MAX_RECENT);
    
    this.saveRecentTemplates(trimmed);
  }
  
  /**
   * Get recently used templates
   */
  private getRecentTemplates(): Template[] {
    return this.recentTemplates;
  }
  
  /**
   * Save recently used templates
   */
  private saveRecentTemplates(templates: Template[]): void {
    try {
      this.recentTemplates = templates;
      void settingsService.setSetting(RECENT_KEY, templates, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Error saving recent templates:', error);
    }
  }
  
  /**
   * Get story structure templates
   */
  getStructureTemplates(): StructureTemplate[] {
    return STRUCTURE_TEMPLATES;
  }
  
  /**
   * Get structure template by ID
   */
  getStructureTemplate(structureId: string): StructureTemplate | null {
    return STRUCTURE_TEMPLATES.find(s => s.id === structureId) || null;
  }
  
  /**
   * Create template from selection
   */
  createTemplateFromSelection(
    name: string,
    description: string,
    selectedContent: string,
    type: Template['type'],
    tags: string[] = []
  ): Template {
    return this.saveUserTemplate({
      name,
      description,
      type,
      content: selectedContent,
      tags: [...tags, 'user-created'],
      preview: selectedContent.substring(0, 100) + '...'
    });
  }
  
  /**
   * Search templates
   */
  searchTemplates(query: string): Template[] {
    const library = this.getTemplates();
    const allTemplates: Template[] = [];
    
    // Collect all templates
    library.categories.forEach(cat => {
      allTemplates.push(...cat.templates);
    });
    allTemplates.push(...library.userTemplates);
    
    if (!query.trim()) return allTemplates;
    
    const lowerQuery = query.toLowerCase();
    
    return allTemplates.filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * Get templates by category
   */
  getTemplatesByCategory(categoryId: string): Template[] {
    const library = this.getTemplates();
    const category = library.categories.find(c => c.id === categoryId);
    return category ? category.templates : [];
  }
  
  /**
   * Get templates by type
   */
  getTemplatesByType(type: Template['type']): Template[] {
    const library = this.getTemplates();
    const allTemplates: Template[] = [];
    
    library.categories.forEach(cat => {
      allTemplates.push(...cat.templates.filter(t => t.type === type));
    });
    
    allTemplates.push(...library.userTemplates.filter(t => t.type === type));
    
    return allTemplates;
  }
}

export const manuscriptTemplateService = new ManuscriptTemplateService();
