// Template Manager for UniversalDashboard and UniversalShowcase
// Provides templates and presets with evented state for hooks.

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'dashboard' | 'showcase' | 'project' | 'workflow' | 'ui';
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'universal';
  version: string;
  tags: string[];
  config: Record<string, unknown>;
  metadata: {
    createdBy: string;
    createdAt: Date;
    downloads: number;
    rating: number;
    featured: boolean;
  };
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: 'export' | 'filter' | 'view' | 'workflow' | 'settings';
  profession: string;
  config: Record<string, unknown>;
  metadata: {
    createdBy: string;
    createdAt: Date;
    usage: number;
  };
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  type: Template['category'];
  templateIds: string[];
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface TemplateSearchQuery {
  text?: string;
  type?: string;
  category?: string;
  tags?: string[];
  profession?: Template['profession'];
  featured?: boolean;
  limit?: number;
}

export interface TemplateConfig {
  enableTemplates: boolean;
  enableCategories: boolean;
  enableFiltering: boolean;
  enableOrganization: boolean;
  enableCategorization: boolean;
  enableTagging: boolean;
  enableMetadata: boolean;
  enableThumbnails: boolean;
  enablePreview: boolean;
  enableCustomization: boolean;
  enableSearch: boolean;
  maxSearchResults: number;
  autoCategorize: boolean;
  debug: boolean;
}

export interface TemplateManagerState {
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  templates: Map<string, Template>;
  categories: Map<string, TemplateCategory>;
  searchResults: Template[];
  lastSearchQuery: TemplateSearchQuery | null;
  lastUpdate: number;
  totalTemplates: number;
  totalCategories: number;
  totalUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number;
}

type TemplateEventMap = {
  template_added: { template: Template };
  category_added: { category: TemplateCategory };
  search_completed: { query: TemplateSearchQuery; results: Template[] };
  search_failed: { query: TemplateSearchQuery; error: string };
  error: { error: string };
  initialized: {};
};

const DEFAULT_CONFIG: TemplateConfig = {
  enableTemplates: true,
  enableCategories: true,
  enableFiltering: true,
  enableOrganization: true,
  enableCategorization: true,
  enableTagging: true,
  enableMetadata: true,
  enableThumbnails: true,
  enablePreview: true,
  enableCustomization: true,
  enableSearch: true,
  maxSearchResults: 50,
  autoCategorize: true,
  debug: false,
};

const DEFAULT_STATE: TemplateManagerState = {
  isEnabled: true,
  isInitialized: false,
  hasError: false,
  error: null,
  templates: new Map(),
  categories: new Map(),
  searchResults: [],
  lastSearchQuery: null,
  lastUpdate: Date.now(),
  totalTemplates: 0,
  totalCategories: 0,
  totalUsage: 0,
  totalErrors: 0,
  totalConflicts: 0,
  totalOverrides: 0,
};

export class TemplateManager {
  private templates: Template[] = [];
  private presets: Preset[] = [];
  private categories: TemplateCategory[] = [];
  private config: TemplateConfig = { ...DEFAULT_CONFIG };
  private state: TemplateManagerState = { ...DEFAULT_STATE };
  private listeners = new Map<keyof TemplateEventMap, Set<(payload: unknown) => void>>();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeDefaultPresets();
    this.initializeDefaultCategories();
    this.rebuildState();
    this.state.isInitialized = true;
    this.emit('initialized', {});
  }

  on<K extends keyof TemplateEventMap>(event: K, handler: (payload: TemplateEventMap[K]) => void) {
    const handlers = this.listeners.get(event) || new Set();
    handlers.add(handler as (payload: unknown) => void);
    this.listeners.set(event, handlers);
  }

  off<K extends keyof TemplateEventMap>(event: K, handler: (payload: TemplateEventMap[K]) => void) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.delete(handler as (payload: unknown) => void);
  }

  private emit<K extends keyof TemplateEventMap>(event: K, payload: TemplateEventMap[K]) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        if (this.config.debug) {
          console.error(`[TemplateManager] listener failed for ${event}`, error);
        }
      }
    });
  }

  private setError(message: string) {
    this.state.hasError = true;
    this.state.error = message;
    this.state.totalErrors += 1;
    this.state.lastUpdate = Date.now();
    this.emit('error', { error: message });
  }

  private clearError() {
    this.state.hasError = false;
    this.state.error = null;
  }

  private rebuildState(searchResults: Template[] = this.state.searchResults, lastSearchQuery: TemplateSearchQuery | null = this.state.lastSearchQuery) {
    const templateMap = new Map(this.templates.map((template) => [template.id, template]));
    const categoryMap = new Map(this.categories.map((category) => [category.id, category]));

    this.state = {
      ...this.state,
      templates: templateMap,
      categories: categoryMap,
      searchResults,
      lastSearchQuery,
      totalTemplates: this.templates.length,
      totalCategories: this.categories.length,
      totalUsage: this.templates.reduce((sum, template) => sum + template.metadata.downloads, 0),
      lastUpdate: Date.now(),
    };
  }

  getState(): TemplateManagerState {
    return {
      ...this.state,
      templates: new Map(this.state.templates),
      categories: new Map(this.state.categories),
      searchResults: [...this.state.searchResults],
      lastSearchQuery: this.state.lastSearchQuery ? { ...this.state.lastSearchQuery } : null,
    };
  }

  updateConfig(config: Partial<TemplateConfig>) {
    const mergedConfig: TemplateConfig = { ...this.config, ...config };
    if (config.enableCategorization !== undefined && config.enableCategories === undefined) {
      mergedConfig.enableCategories = config.enableCategorization;
    }
    if (config.enableCategories !== undefined && config.enableCategorization === undefined) {
      mergedConfig.enableCategorization = config.enableCategories;
    }
    this.config = mergedConfig;
    this.state.isEnabled = this.config.enableTemplates;
    this.state.lastUpdate = Date.now();
  }

  getConfig(): TemplateConfig {
    return { ...this.config };
  }

  private initializeDefaultTemplates(): void {
    this.templates = [
      {
        id: 'dashboard-photographer-pro',
        name: 'Photographer Pro Dashboard',
        description: 'Complete dashboard setup for professional photographers',
        category: 'dashboard',
        profession: 'photographer',
        version: '1.0.0',
        tags: ['photography', 'professional', 'client-management'],
        config: {
          tabState: { main: 0, projects: 0, clients: 0, equipment: 0 },
          uiSettings: { proEditorMode: true, compactMode: false, darkMode: false },
          layout: { sidebarWidth: 280, headerHeight: 64 },
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          downloads: 0,
          rating: 0,
          featured: true,
        },
      },
      {
        id: 'showcase-wedding-photography',
        name: 'Wedding Photography Showcase',
        description: 'Professional wedding showcase with client proofing',
        category: 'showcase',
        profession: 'photographer',
        version: '1.0.0',
        tags: ['wedding', 'photography', 'client-proofing'],
        config: {
          layout: 'masonry',
          features: { clientMode: true, proofing: true, annotations: true },
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          downloads: 0,
          rating: 0,
          featured: true,
        },
      },
      {
        id: 'project-wedding-photography',
        name: 'Wedding Photography Project',
        description: 'Complete wedding project structure',
        category: 'project',
        profession: 'photographer',
        version: '1.0.0',
        tags: ['wedding', 'photography', 'project-management'],
        config: {
          folders: ['raw', 'edited', 'proofs', 'delivery'],
          workflows: ['pre-wedding', 'wedding-day', 'post-processing'],
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          downloads: 0,
          rating: 0,
          featured: false,
        },
      },
    ];
  }

  private initializeDefaultPresets(): void {
    this.presets = [
      {
        id: 'export-web-gallery',
        name: 'Web Gallery Export',
        description: 'Optimized settings for web gallery',
        category: 'export',
        profession: 'photographer',
        config: {
          formats: ['jpeg', 'webp'],
          quality: 85,
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          usage: 0,
        },
      },
      {
        id: 'filter-recent-projects',
        name: 'Recent Projects',
        description: 'Show projects from the last 30 days',
        category: 'filter',
        profession: 'universal',
        config: {
          days: 30,
          status: ['active', 'in-progress'],
        },
        metadata: {
          createdBy: 'system',
          createdAt: new Date(),
          usage: 0,
        },
      },
    ];
  }

  private initializeDefaultCategories(): void {
    const grouped = new Map<Template['category'], Template[]>();
    this.templates.forEach((template) => {
      const collection = grouped.get(template.category) || [];
      collection.push(template);
      grouped.set(template.category, collection);
    });

    this.categories = Array.from(grouped.entries()).map(([type, templates]) => ({
      id: `category-${type}`,
      name: `${type[0].toUpperCase()}${type.slice(1)} Templates`,
      description: `Templates for ${type} workflows`,
      type,
      templateIds: templates.map((template) => template.id),
      metadata: {
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));
  }

  async addTemplate(templateData: Partial<Template>): Promise<Template> {
    try {
      const now = new Date();
      const template: Template = {
        id: templateData.id || `template-${Date.now()}`,
        name: templateData.name || 'Untitled Template',
        description: templateData.description || '',
        category: templateData.category || 'ui',
        profession: templateData.profession || 'universal',
        version: templateData.version || '1.0.0',
        tags: templateData.tags || [],
        config: templateData.config || {},
        metadata: {
          createdBy: templateData.metadata?.createdBy || 'user',
          createdAt: templateData.metadata?.createdAt || now,
          downloads: templateData.metadata?.downloads || 0,
          rating: templateData.metadata?.rating || 0,
          featured: templateData.metadata?.featured || false,
        },
      };

      this.templates.push(template);
      this.rebuildState();
      this.emit('template_added', { template });
      return template;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add template';
      this.setError(message);
      throw error;
    }
  }

  async addCategory(categoryData: Partial<TemplateCategory>): Promise<TemplateCategory> {
    try {
      const now = new Date();
      const category: TemplateCategory = {
        id: categoryData.id || `category-${Date.now()}`,
        name: categoryData.name || 'Untitled Category',
        description: categoryData.description || '',
        type: categoryData.type || 'ui',
        templateIds: categoryData.templateIds || [],
        metadata: {
          createdBy: categoryData.metadata?.createdBy || 'user',
          createdAt: categoryData.metadata?.createdAt || now,
          updatedAt: categoryData.metadata?.updatedAt || now,
        },
      };

      this.categories.push(category);
      this.rebuildState();
      this.emit('category_added', { category });
      return category;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add category';
      this.setError(message);
      throw error;
    }
  }

  async searchTemplates(query: TemplateSearchQuery): Promise<Template[]> {
    try {
      const text = (query.text || '').toLowerCase();
      let results = [...this.templates];

      if (text) {
        results = results.filter(
          (template) =>
            template.name.toLowerCase().includes(text) ||
            template.description.toLowerCase().includes(text) ||
            template.tags.some((tag) => tag.toLowerCase().includes(text)),
        );
      }

      if (query.category) {
        results = results.filter((template) => template.category === query.category);
      }

      if (query.profession) {
        results = results.filter((template) => template.profession === query.profession);
      }

      if (query.featured) {
        results = results.filter((template) => template.metadata.featured);
      }

      if (query.tags && query.tags.length > 0) {
        results = results.filter((template) => query.tags!.every((tag) => template.tags.includes(tag)));
      }

      const limitedResults = results.slice(0, query.limit || this.config.maxSearchResults);
      this.rebuildState(limitedResults, query);
      this.emit('search_completed', { query, results: limitedResults });
      return limitedResults;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Template search failed';
      this.setError(message);
      this.emit('search_failed', { query, error: message });
      return [];
    }
  }

  getTemplatesByType(type: string): Template[] {
    return this.templates.filter((template) => template.category === type);
  }

  getTemplatesByCategory(category: string): Template[] {
    return this.templates.filter((template) => template.category === category);
  }

  getCategory(id: string): TemplateCategory | null {
    return this.categories.find((category) => category.id === id) || null;
  }

  getAllTemplates(): Template[] {
    return [...this.templates];
  }

  getAllCategories(): TemplateCategory[] {
    return [...this.categories];
  }

  getTemplates(filter?: { category?: string; profession?: string; featured?: boolean }): Template[] {
    let filtered = [...this.templates];

    if (filter?.category) {
      filtered = filtered.filter((template) => template.category === filter.category);
    }

    if (filter?.profession) {
      filtered = filtered.filter(
        (template) =>
          template.profession === filter.profession || template.profession === 'universal',
      );
    }

    if (filter?.featured) {
      filtered = filtered.filter((template) => template.metadata.featured);
    }

    return filtered.sort((a, b) => b.metadata.downloads - a.metadata.downloads);
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.find((template) => template.id === id);
  }

  getPresets(filter?: { category?: string; profession?: string }): Preset[] {
    let filtered = [...this.presets];

    if (filter?.category) {
      filtered = filtered.filter((preset) => preset.category === filter.category);
    }

    if (filter?.profession) {
      filtered = filtered.filter(
        (preset) => preset.profession === filter.profession || preset.profession === 'universal',
      );
    }

    return filtered.sort((a, b) => b.metadata.usage - a.metadata.usage);
  }

  getPreset(id: string): Preset | undefined {
    return this.presets.find((preset) => preset.id === id);
  }

  applyTemplate(templateId: string, targetId: string): boolean {
    const template = this.getTemplate(templateId);
    if (!template) {
      this.setError(`Template not found: ${templateId}`);
      return false;
    }

    template.metadata.downloads += 1;
    this.rebuildState();
    if (this.config.debug) {
      console.log(`[TemplateManager] Applied template ${templateId} to ${targetId}`);
    }
    this.clearError();
    return true;
  }

  applyPreset(presetId: string, targetId: string): boolean {
    const preset = this.getPreset(presetId);
    if (!preset) {
      this.setError(`Preset not found: ${presetId}`);
      return false;
    }

    preset.metadata.usage += 1;
    this.rebuildState();
    if (this.config.debug) {
      console.log(`[TemplateManager] Applied preset ${presetId} to ${targetId}`);
    }
    this.clearError();
    return true;
  }
}

export const templateManager = new TemplateManager();
