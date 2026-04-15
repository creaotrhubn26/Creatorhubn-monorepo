// @ts-nocheck
// client/src/services/MentionService.ts
/**
 * Mention Service for CreatorHub Notes
 * Handles @ mentions for pages, components, and other resources
 */

export interface MentionableResource {
  id: string;
  type: 'page' | 'component' | 'note' | 'user' | 'project' | 'file' | 'api' | 'template';
  title: string;
  description?: string;
  path?: string;
  url?: string;
  icon?: string;
  category?: string;
  tags?: string[];
  lastModified?: Date;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface MentionSuggestion {
  resource: MentionableResource;
  matchScore: number;
  highlightedTitle: string;
  context?: string;
}

export interface MentionSearchOptions {
  query: string;
  types?: MentionableResource['type'][];
  limit?: number;
  includeInactive?: boolean;
  category?: string;
  tags?: string[];
}

class MentionService {
  private static instance: MentionService;
  private resources: Map<string, MentionableResource> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map();

  private constructor() {
    this.initializeDefaultResources();
}

  static getInstance(): MentionService {
    if (!MentionService.instance) {
      MentionService.instance = new MentionService();
  }
    return MentionService.instance;
}

  private initializeDefaultResources() {
    // Add default CreatorHub pages
    const defaultPages: MentionableResource[] = [
      {
        id: 'dashboard',
        type: 'page',
        title: 'Dashboard',
        description: 'Hoveddashboard for CreatorHub',
        path: '/dashboard',
        icon: 'dashboard',
        category: 'navigation',
        isActive: true,
    },
      {
        id: 'photographer-suite',
        type: 'page',
        title: 'Fotograf Suite',
        description: 'Komplett verktøysett for fotografer',
        path: '/photographer-suite',
        icon: 'camera_alt',
        category: 'profession',
        tags: ['fotograf','bildebehandling','galleri'],
        isActive: true,
    },
      {
        id: 'videographer-suite',
        type: 'page',
        title: 'Videomaker Suite',
        description: 'Profesjonelle videoverktø',
        path: '/videographer-suite',
        icon: 'videocam',
        category: 'profession',
        tags: ['video','redigering','produksjon'],
        isActive: true,
    },
      {
        id: 'music-producer-suite',
        type: 'page',
        title: 'Musikkprodusent Suite',
        description: 'Musikkproduksjon og lydbehandling',
        path: '/music-producer-suite',
        icon: 'music_note',
        category: 'profession',
        tags: ['musikk','lyd','produksjon'],
        isActive: true,
    },
      {
        id: 'project-management',
        type: 'page',
        title: 'Prosjektstyring',
        description: 'Administrer prosjekter og oppgaver',
        path: '/project-management',
        icon: 'folder',
        category: 'management',
        tags: ['prosjekt','oppgaver','planlegging'],
        isActive: true,
    },
      {
        id: 'client-portal',
        type: 'page',
        title: 'Klientportal',
        description: 'Klientkommunikasjon og samarbeid',
        path: '/client-portal',
        icon: 'people',
        category: 'communication',
        tags: ['klient','kommunikasjon','samarbeid'],
        isActive: true,
    },
    ];

    // Add default components
    const defaultComponents: MentionableResource[] = [
      {
        id: 'universal-download',
        type: 'component',
        title: 'UniversalDownload',
        description: 'Universell nedlastingskomponent med sikkerhet',
        path: '/components/universal/UniversalDownload.tsx',
        icon: 'download',
        category: 'ui',
        tags: ['download','sikkerhet','universell'],
        isActive: true,
    },
      {
        id: 'creator-hub-notes',
        type: 'component',
        title: 'CreatorHubNotes',
        description: 'Avansert notatverktøy med AI-integrasjon',
        path: '/components/admin/CreatorHubNotes.tsx',
        icon: 'notes',
        category: 'admin',
        tags: ['notater','ai','admin'],
        isActive: true,
    },
      {
        id: 'photo-enhancement',
        type: 'component',
        title: 'PhotoEnhancement',
        description: 'AI-drevet bildeforbedring',
        path: '/components/photo/PhotoEnhancement.tsx',
        icon: 'auto_fix_high',
        category: 'ai',
        tags: ['bilde','ai','forbedring'],
        isActive: true,
    },
      {
        id: 'video-editor',
        type: 'component',
        title: 'VideoEditor',
        description: 'Avansert videoredigeringskomponent',
        path: '/components/video/VideoEditor.tsx',
        icon: 'video_library',
        category: 'video',
        tags: ['video','redigering','produksjon'],
        isActive: true,
    },
    ];

    // Add default API endpoints
    const defaultAPIs: MentionableResource[] = [
      {
        id: 'photo-enhancement-api',
        type: 'api',
        title: 'Photo Enhancement AP',
        description: 'API for AI-drevet bildeforbedring',
        path: '/api/photo-enhancement',
        icon: 'api',
        category: 'ai',
        tags: ['api','bilde','ai'],
        isActive: true,
    },
      {
        id: 'notes-api',
        type: 'api',
        title: 'Notes AP',
        description: 'API for notathåndtering',
        path: '/api/notes',
        icon: 'api',
        category: 'data',
        tags: ['api','notater','data'],
        isActive: true,
    },
      {
        id: 'user-management-api',
        type: 'api',
        title: 'User Management AP',
        description: 'API for brukeradministrasjon',
        path: '/api/users',
        icon: 'api',
        category: 'auth',
        tags: ['api','bruker','auth'],
        isActive: true,
    },
    ];

    // Add all resources
    [...defaultPages, ...defaultComponents, ...defaultAPIs].forEach(resource => {
      this.addResource(resource);
  });
}

  addResource(resource: MentionableResource): void {
    this.resources.set(resource.id, resource);
    this.updateSearchIndex(resource);
}


  removeResource(id: string): void {
    this.resources.delete(id);
    // Remove from search index
    for (const [term, resourceIds] of this.searchIndex.entries()) {
      resourceIds.delete(id);
      if (resourceIds.size === 0) {
        this.searchIndex.delete(term);
    }
  }
}

  updateResource(id: string, updates: Partial<MentionableResource>): void {
    const existing = this.resources.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.resources.set(id, updated);
      this.updateSearchIndex(updated);
  }
}

  private updateSearchIndex(resource: MentionableResource): void {
    const searchableText = [
      resource.title,
      resource.description || '',
      resource.category || '',
      ...(resource.tags || []),
    ].join('').toLowerCase();

    const words = searchableText.split(/\s+/).filter(word => word.length > 0);
    
    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
    }
      this.searchIndex.get(word)!.add(resource.id);
  });
}

  searchMentions(options: MentionSearchOptions): MentionSuggestion[] {
    const { query, types, limit = 10, includeInactive = false, category, tags } = options;
    
    if (!query.trim()) {
      return [];
  }

    const queryLower = query.toLowerCase();
    const suggestions: MentionSuggestion[] = [];

    for (const [, resource] of this.resources) {
      // Filter by type
      if (types && !types.includes(resource.type)) {
        continue;
    }

      // Filter by active status
      if (!includeInactive && resource.isActive === false) {
        continue;
    }

      // Filter by category
      if (category && resource.category !== category) {
        continue;
    }

      // Filter by tags
      if (tags && tags.length > 0 && !tags.some(tag => resource.tags?.includes(tag))) {
        continue;
    }

      // Calculate match score
      const titleMatch = resource.title.toLowerCase().includes(queryLower);
      const descriptionMatch = resource.description?.toLowerCase().includes(queryLower);
      const tagMatch = resource.tags?.some(tag => tag.toLowerCase().includes(queryLower));
      const categoryMatch = resource.category?.toLowerCase().includes(queryLower);

      let matchScore = 0;
      if (titleMatch) matchScore += 10;
      if (descriptionMatch) matchScore += 5;
      if (tagMatch) matchScore += 3;
      if (categoryMatch) matchScore += 2;

      if (matchScore > 0) {
        // Create highlighted title
        const highlightedTitle = this.highlightMatch(resource.title, queryLower);
        
        suggestions.push({
          resource,
          matchScore,
          highlightedTitle,
          context: this.getContext(resource),
      });
    }
  }

    // Sort by match score and return limited results
    return suggestions
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
}

  private highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

  private getContext(resource: MentionableResource): string {
    const parts: string[] = [];
    
    if (resource.category) {
      parts.push(resource.category);
 }
    
    if (resource.path) {
      parts.push(resource.path);
  }
    
    if (resource.tags && resource.tags.length > 0) {
      parts.push(resource.tags.slice(0, 3).join(', '));
  }

    return parts.join(' • ');
}

  getResourceById(id: string): MentionableResource | undefined {
    return this.resources.get(id);
 }

  getResourcesByType(type: MentionableResource['type']): MentionableResource[] {
    return Array.from(this.resources.values()).filter(resource => resource.type === type);
 }

  getResourcesByCategory(category: string): MentionableResource[] {
    return Array.from(this.resources.values()).filter(resource => resource.category === category);
 }

  getAllResources(): MentionableResource[] {
    return Array.from(this.resources.values());
}

  // Get mentionable resources for a specific context (e.g., current page)
  getContextualResources(context: {
    currentPage?: string;
    currentUser?: string;
    currentProject?: string;
 }): MentionableResource[] {
    const allResources = this.getAllResources();
    
    // Filter based on context
    return allResources.filter(resource => {
      // Add context-specific filtering logic here
      return resource.isActive !== false;
  });
}

  // Generate mention link
  generateMentionLink(resource: MentionableResource): string {
    switch (resource.type) {
      case 'page':
        return `[${resource.title}](${resource.path})`;
      case 'component':
        return `[${resource.title}](${resource.path})`;
      case 'api':
        return `[${resource.title}](${resource.path})`;
      case 'note':
        return `[${resource.title}](note: ${resource.id})`;
      case 'user':
        return `[@${resource.title}](user: ${resource.id})`;
      case 'project':
        return `[${resource.title}](project: ${resource.id})`;
      case 'file':
        return `[${resource.title}](${resource.path})`;
      case 'template':
        return `[${resource.title}](template: ${resource.id})`;
      default: return `[${resource.title}](${resource.id})`;
  }
}

  // Parse mentions from text
  parseMentions(text: string): Array<{
    mention: string;
    resource: MentionableResource | null;
    startIndex: number;
    endIndex: number;
 }> {
    const mentionRegex = /@(\w+)/g;
    const mentions: Array<{
      mention: string;
      resource: MentionableResource | null;
      startIndex: number;
      endIndex: number;
 }> = [];

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const mention = match[0];
      const resourceId = match[1];
      const resource = this.getResourceById(resourceId);
      
      mentions.push({
        mention,
        resource,
        startIndex: match.index,
        endIndex: match.index + mention.length,
    });
  }

    return mentions;
}

  // Replace mentions with links
  replaceMentionsWithLinks(text: string): string {
    const mentions = this.parseMentions(text);
    let result = text;

    // Process mentions in reverse order to maintain indices
    mentions.reverse().forEach(({ mention, resource, startIndex, endIndex }) => {
      if (resource) {
        const link = this.generateMentionLink(resource);
        result = result.substring(0, startIndex) + link + result.substring(endIndex);
    }
  });

    return result;
}
}

export function scrollToMention(selector: string) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export default MentionService;
