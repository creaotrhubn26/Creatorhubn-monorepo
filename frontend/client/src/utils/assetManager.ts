/**
 * Asset Manager
 * Manages asset library with search, filtering, and organization
 */

export interface AssetManagerConfig {
  enableAssetManagement: boolean;
  enableSearch: boolean;
  enableFiltering: boolean;
  enableOrganization: boolean;
  enableCategorization: boolean;
  enableTagging: boolean;
  enableMetadata: boolean;
  enableThumbnails: boolean;
  enablePreview: boolean;
  enableUpload: boolean;
  enableDownload: boolean;
  enableSharing: boolean;
  enableVersioning: boolean;
  enableBackup: boolean;
  enableSync: boolean;
  enableCompression: boolean;
  enableOptimization: boolean;
  enableValidation: boolean;
  enableSecurity: boolean;
  enableAnalytics: boolean;
  enableDebugging: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
  enableExport: boolean;
  enableImport: boolean;
  enableCollaboration: boolean;
  enableDocumentation: boolean;
  enableExamples: boolean;
  enablePlayground: boolean;
  enableCodeGeneration: boolean;
  enableTypeScript: boolean;
  enableCompliance: boolean;
  enableAccessibility: boolean;
  enableResponsive: boolean;
  enableCustomization: boolean;
  enableTemplates: boolean;
  enablePresets: boolean;
  enableAutoOrganization: boolean;
  enableSmartSearch: boolean;
  enableAICategorization: boolean;
  enableDuplicateDetection: boolean;
  enableUsageTracking: boolean;
  enablePerformanceOptimization: boolean;
  debug: boolean
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'font' | 'icon' | 'template' | 'component' | 'other';
  category: string;
  subcategory?: string;
  tags: string[];
  url: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  size: number;
  format: string;
  dimensions?: {
    width: number;
    height: number;
};
  duration?: number; // For video/audio
  metadata: AssetMetadata;
  usage: AssetUsage;
  permissions: AssetPermissions;
  version: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
  status: 'active' | 'archived' | 'deleted' | 'pending' | 'processing';
  config: Record<string, any>;
}

export interface AssetMetadata {
  title?: string;
  alt?: string;
  caption?: string;
  author?: string;
  copyright?: string;
  license?: string;
  keywords?: string[];
  description?: string;
  colorPalette?: string[];
  dominantColors?: string[];
  exifData?: Record<string, any>;
  technicalData?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface AssetUsage {
  viewCount: number;
  downloadCount: number;
  shareCount: number;
  lastUsed: number;
  usedInProjects: string[];
  usedInComponents: string[];
  usageFrequency: number;
  popularity: number;
  rating: number;
  reviews: AssetReview[]
}

export interface AssetReview {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: number;
  helpful: number
}

export interface AssetPermissions {
  canView: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canComment: boolean;
  canRate: boolean;
  canTag: boolean;
  canCategorize: boolean;
  canVersion: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canExport: boolean;
  canImport: boolean;
  canCollaborate: boolean;
  canManage: boolean;
  canAdmin: boolean
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  children: string[];
  assets: string[];
  metadata: {
    created: number;
    modified: number;
    version: string;
    author: string;
    tags: string[];
    usageCount: number;
    lastUsed: number;
    successCount: number;
    errorCount: number;
};
  config: Record<string, any>;
}

export interface AssetTag {
  id: string;
  name: string;
  description: string;
  color: string;
  category: string;
  assets: string[];
  metadata: {
    created: number;
    modified: number;
    version: string;
    author: string;
    usageCount: number;
    lastUsed: number;
    successCount: number;
    errorCount: number;
};
  config: Record<string, any>;
}

export interface AssetSearchQuery {
  query?: string;
  type?: string;
  category?: string;
  tags?: string[];
  size?: {
    min?: number;
    max?: number;
};
  dimensions?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
};
  dateRange?: {
    start?: number;
    end?: number;
};
  author?: string;
  license?: string;
  rating?: {
    min?: number;
    max?: number;
};
  usage?: {
    minViews?: number;
    minDownloads?: number;
    minShares?: number;
};
  status?: string;
  sortBy?: 'name' | 'size' | 'createdAt' | 'updatedAt' | 'viewCount' | 'downloadCount' | 'rating' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface AssetManagerState {
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  assets: Map<string, Asset>;
  categories: Map<string, AssetCategory>;
  tags: Map<string, AssetTag>;
  searchResults: Asset[];
  lastSearchQuery: AssetSearchQuery | null;
  lastUpdate: number;
  totalAssets: number;
  totalCategories: number;
  totalTags: number;
  totalSize: number;
  totalUsage: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number
}

class AssetManager {
  private config: AssetManagerConfig;
  private state: AssetManagerState;
  private eventListeners: Map<string, Function[]> = new Map();
  private isInitialized = false;
  private searchIndex: Map<string, string[]> = new Map();

  constructor(config: Partial<AssetManagerConfig> = {}) {
    this.config = {
      enableAssetManagement: true,
      enableSearch: true,
      enableFiltering: true,
      enableOrganization: true,
      enableCategorization: true,
      enableTagging: true,
      enableMetadata: true,
      enableThumbnails: true,
      enablePreview: true,
      enableUpload: true,
      enableDownload: true,
      enableSharing: true,
      enableVersioning: true,
      enableBackup: true,
      enableSync: true,
      enableCompression: true,
      enableOptimization: true,
      enableValidation: true,
      enableSecurity: true,
      enableAnalytics: true,
      enableDebugging: false,
      enableLogging: true,
      enableMetrics: true,
      enableExport: true,
      enableImport: true,
      enableCollaboration: true,
      enableDocumentation: true,
      enableExamples: true,
      enablePlayground: true,
      enableCodeGeneration: true,
      enableTypeScript: true,
      enableCompliance: true,
      enableAccessibility: true,
      enableResponsive: true,
      enableCustomization: true,
      enableTemplates: true,
      enablePresets: true,
      enableAutoOrganization: true,
      enableSmartSearch: true,
      enableAICategorization: true,
      enableDuplicateDetection: true,
      enableUsageTracking: true,
      enablePerformanceOptimization: true,
      debug: false,
      ...config
  };

    this.state = {
      isEnabled: false,
      isInitialized: false,
      hasError: false,
      error: null,
      assets: new Map(),
      categories: new Map(),
      tags: new Map(),
      searchResults:  [],
      lastSearchQuery: null,
      lastUpdate:  0,
      totalAssets:  0,
      totalCategories:  0,
      totalTags:  0,
      totalSize:  0,
      totalUsage:  0,
      totalErrors:  0,
      totalConflicts:  0,
      totalOverrides: 0
};

    this.initializeAssetManager();
}

  /**
   * Initialize asset manager
   */
  private initializeAssetManager(): void {
    if (!this.config.enableAssetManagement) return;

    try {
      this.setupEventListeners();
      this.loadDefaultCategories();
      this.loadDefaultTags();
      this.buildSearchIndex();
      this.state.isEnabled = true;
      this.state.isInitialized = true;
      this.emit('initialized');
  } catch (error) {
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: this.state.error });
  }
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.config.enableAssetManagement) return;

    // Implementation depends on event handling strategy
}

  /**
   * Load default categories
   */
  private loadDefaultCategories(): void {
    const defaultCategories: Partial<AssetCategory>[] = [
      {
        id: 'images',
        name: 'Images',
        description: 'Image assets including photos, graphics, and illustrations',
        children: ['photos','graphics','illustrations'],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['images','visual'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'photos',
        name: 'Photos',
        description: 'Photographic images',
        parentId: 'images',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['photos','images'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'graphics',
        name: 'Graphics',
        description: 'Graphic design elements and icons',
        parentId: 'images',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['graphics','images'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'videos',
        name: 'Videos',
        description: 'Video assets including clips, animations, and presentations',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['videos','media'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'audio',
        name: 'Audio',
        description: 'Audio assets including music, sound effects, and voice recordings',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['audio','media'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'documents',
        name: 'Documents',
        description: 'Document assets including PDs, text files, and presentations',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['documents','files'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'fonts',
        name: 'Fonts',
        description: 'Font assets including typefaces and font files',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['fonts','typography'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'icons',
        name: 'Icons',
        description: 'Icon assets including UI icons and symbols',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['icons','ui'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'templates',
        name: 'Templates',
        description: 'Template assets including design templates and layouts',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['templates','layouts'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'components',
        name: 'Components',
        description: 'Component assets including UI components and widgets',
        children:  [],
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          tags: ['components','ui'],
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    }
    ];

    defaultCategories.forEach(categoryData => {
      this.addCategory(categoryData);
  });
}

  /**
   * Load default tags
   */
  private loadDefaultTags(): void {
    const defaultTags: Partial<AssetTag>[] = [
      {
        id: 'popular',
        name: 'Popular',
        description: 'Popular and frequently used assets',
        color: '#ff6b6',
        category: 'general',
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'recent',
        name: 'Recent',
        description: 'Recently added or updated assets',
        color: '#4ecdc',
        category: 'general',
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'favorite',
        name: 'Favorite',
        description: 'User favorite assets',
        color: '#ffe66',
        category: 'general',
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'high-quality',
        name: 'High Quality',
        description: 'High quality assets with excellent resolution',
        color: '#95e1d',
        category: 'quality',
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'vector',
        name: 'Vector',
        description: 'Vector graphics and scalable assets',
        color: '#a8e6cf',
        category: 'type',
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    },
      {
        id: 'raster',
        name: 'Raster',
        description: 'Raster images and pixel-based assets',
        color: '#ffd3a',
        category: 'type',
        assets:  [],
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          version: '1.0.0',
          author: 'System',
          usageCount: 0,
          lastUsed: 0,
          successCount: 0,
          errorCount: 0
    }
    }
    ];

    defaultTags.forEach(tagData => {
      this.addTag(tagData);
  });
}

  /**
   * Build search index
   */
  private buildSearchIndex(): void {
    if (!this.config.enableSearch) return;

    this.searchIndex.clear();
    
    for (const [id, asset] of this.state.assets) {
      const searchableText = [
        asset.name,
        asset.description,
        asset.type,
        asset.category,
        asset.subcategory || '',
        ...asset.tags,
        ...(asset.metadata.keywords || []),
        asset.metadata.title || '',
        asset.metadata.alt || '',
        asset.metadata.caption || '',
        asset.metadata.author || '',
        asset.metadata.description || ''
      ].join('').toLowerCase();

      this.searchIndex.set(id, searchableText.split(/\s+/));
  }
}

  /**
   * Add asset
   */
  async addAsset(assetData: Partial<Asset>): Promise<Asset> {
    if (!this.state.isEnabled) throw new Error('Asset manager is not enabled');

    const asset: Asset = {
      id: assetData.id || this.generateId(),
      name: assetData.name || 'Untitled Asset',
      description: assetData.description ||'',
      type: assetData.type || 'other',
      category: assetData.category || 'uncategorized',
      subcategory: assetData.subcategory,
      tags: assetData.tags || [],
      url: assetData.url || '',
      thumbnailUrl: assetData.thumbnailUrl,
      previewUrl: assetData.previewUrl,
      size: assetData.size || 0,
      format: assetData.format || '',
      dimensions: assetData.dimensions,
      duration: assetData.duration,
      metadata: assetData.metadata || {},
      usage: assetData.usage || {
        viewCount: 0,
        downloadCount: 0,
        shareCount: 0,
        lastUsed: 0,
        usedInProjects: [],
        usedInComponents: [],
        usageFrequency: 0,
        popularity: 0,
        rating: 0,
        reviews: []
      },
      permissions: assetData.permissions || {
        canView: true,
        canDownload: true,
        canEdit: false,
        canDelete: false,
        canShare: true,
        canComment: true,
        canRate: true,
        canTag: true,
        canCategorize: false,
        canVersion: false,
        canArchive: false,
        canRestore: false,
        canExport: true,
        canImport: false,
        canCollaborate: false,
        canManage: false,
        canAdmin: false
      },
      version: assetData.version || '1.0.0',
      createdAt: assetData.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: assetData.createdBy || 'user',
      updatedBy: assetData.updatedBy || 'user',
      status: assetData.status || 'active',
      config: assetData.config || {}
    };

    try {
      // Validate asset
      if (this.config.enableValidation) {
        await this.validateAsset(asset);
    }

      // Update state
      this.state.assets.set(asset.id, asset);
      this.state.totalAssets++;
      this.state.totalSize += asset.size;
      this.state.lastUpdate = Date.now();

      // Update search index
      if (this.config.enableSearch) {
        this.buildSearchIndex();
    }

      this.emit('asset_added', { asset });
      return asset;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('asset_add_failed', { asset, error: this.state.error });
      throw error;
  }
}

  /**
   * Add category
   */
  async addCategory(categoryData: Partial<AssetCategory>): Promise<AssetCategory> {
    if (!this.state.isEnabled) throw new Error('Asset manager is not enabled');

    const category: AssetCategory = {
      id: categoryData.id || this.generateId(),
      name: categoryData.name || 'Untitled Category',
      description: categoryData.description ||', ',
      parentId: categoryData.parentd,
      children: categoryData.children || [],
      assets: categoryData.assets || [],
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        tags: ['category'],
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0
  },
      config: categoryData.config || {}
  };

    try {
      // Update state
      this.state.categories.set(category.id, category);
      this.state.totalCategories++;
      this.state.lastUpdate = Date.now();

      this.emit('category_added', { category });
      return category;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('category_add_failed', { category, error: this.state.error });
      throw error;
  }
}

  /**
   * Add tag
   */
  async addTag(tagData: Partial<AssetTag>): Promise<AssetTag> {
    if (!this.state.isEnabled) throw new Error('Asset manager is not enabled');

    const tag: AssetTag = {
      id: tagData.id || this.generateId(),
      name: tagData.name || 'Untitled Tag',
      description: tagData.description ||', ',
      color: tagData.color || '#00000',
      category: tagData.category || 'general',
      assets: tagData.assets || [],
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0
  },
      config: tagData.config || {}
  };

    try {
      // Update state
      this.state.tags.set(tag.id, tag);
      this.state.totalTags++;
      this.state.lastUpdate = Date.now();

      this.emit('tag_added', { tag });
      return tag;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('tag_add_failed', { tag, error: this.state.error });
      throw error;
  }
}

  /**
   * Search assets
   */
  async searchAssets(query: AssetSearchQuery): Promise<Asset[]> {
    if (!this.state.isEnabled) throw new Error('Asset manager is not enabled');

    try {
      let results = Array.from(this.state.assets.values());

      // Apply filters
      if (query.type) {
        results = results.filter(asset => asset.type === query.type);
  }

      if (query.category) {
        results = results.filter(asset => asset.category === query.category);
    }

      if (query.tags && query.tags.length > 0) {
        results = results.filter(asset => 
          query.tags!.some(tag => asset.tags.includes(tag))
        );
    }

      if (query.size) {
        if (query.size.min !== undefined) {
          results = results.filter(asset => asset.size >= query.size!.min!);
      }
        if (query.size.max !== undefined) {
          results = results.filter(asset => asset.size <= query.size!.max!);
      }
    }

      if (query.dimensions) {
        results = results.filter(asset => {
          if (!asset.dimensions) return false;
          if (query.dimensions!.minWidth && asset.dimensions.width < query.dimensions!.minWidth) return false;
          if (query.dimensions!.maxWidth && asset.dimensions.width > query.dimensions!.maxWidth) return false;
          if (query.dimensions!.minHeight && asset.dimensions.height < query.dimensions!.minHeight) return false;
          if (query.dimensions!.maxHeight && asset.dimensions.height > query.dimensions!.maxHeight) return false;
          return true;
      });
    }

      if (query.dateRange) {
        if (query.dateRange.start) {
          results = results.filter(asset => asset.createdAt >= query.dateRange!.start!);
      }
        if (query.dateRange.end) {
          results = results.filter(asset => asset.createdAt <= query.dateRange!.end!);
      }
    }

      if (query.author) {
        results = results.filter(asset => asset.createdBy === query.author);
    }

      if (query.license) {
        results = results.filter(asset => asset.metadata.license === query.license);
    }

      if (query.rating) {
        if (query.rating.min !== undefined) {
          results = results.filter(asset => asset.usage.rating >= query.rating!.min!);
      }
        if (query.rating.max !== undefined) {
          results = results.filter(asset => asset.usage.rating <= query.rating!.max!);
      }
    }

      if (query.usage) {
        if (query.usage.minViews !== undefined) {
          results = results.filter(asset => asset.usage.viewCount >= query.usage!.minViews!);
      }
        if (query.usage.minDownloads !== undefined) {
          results = results.filter(asset => asset.usage.downloadCount >= query.usage!.minDownloads!);
      }
        if (query.usage.minShares !== undefined) {
          results = results.filter(asset => asset.usage.shareCount >= query.usage!.minShares!);
      }
    }

      if (query.status) {
        results = results.filter(asset => asset.status === query.status);
    }

      // Apply text search
      if (query.query) {
        const searchTerms = query.query.toLowerCase().split(/\s+/);
        results = results.filter(asset => {
          const searchableText = [
            asset.name,
            asset.description,
            asset.type,
            asset.category,
            asset.subcategory || ', ',
            ...asset.tags,
            ...(asset.metadata.keywords || []),
            asset.metadata.title || ', ',
            asset.metadata.alt || ', ',
            asset.metadata.caption || ', ',
            asset.metadata.author || ', ',
            asset.metadata.description || ', '
          ].join(', ').toLowerCase();

          return searchTerms.every(term => searchableText.includes(term));
      });
    }

      // Apply sorting
      if (query.sortBy) {
        results.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (query.sortBy) {
            case 'name':
              aValue = a.name.toLowerCase();
              bValue = b.name.toLowerCase();
              break;
            case 'size':
              aValue = a.size;
              bValue = b.size;
              break;
            case 'createdAt':
              aValue = a.createdAt;
              bValue = b.createdAt;
              break;
            case 'updatedAt':
              aValue = a.updatedAt;
              bValue = b.updatedAt;
              break;
            case 'viewCount':
              aValue = a.usage.viewCount;
              bValue = b.usage.viewCount;
              break;
            case 'downloadCount':
              aValue = a.usage.downloadCount;
              bValue = b.usage.downloadCount;
              break;
            case 'rating':
              aValue = a.usage.rating;
              bValue = b.usage.rating;
              break;
            case 'popularity':
              aValue = a.usage.popularity;
              bValue = b.usage.popularity;
              break;
            default:
              aValue = a.name.toLowerCase();
              bValue = b.name.toLowerCase();
      }

          if (aValue < bValue) return query.sortOrder === 'desc' ? 1 : -1;
          if (aValue > bValue) return query.sortOrder === 'desc' ? -1 : 1;
          return 0;
      });
    }

      // Apply pagination
      if (query.limit) {
        const offset = query.offset || 0;
        results = results.slice(offset, offset + query.limit);
    }

      // Update state
      this.state.searchResults = results;
      this.state.lastSearchQuery = query;
      this.state.lastUpdate = Date.now();

      this.emit('search_completed', { query, results });
      return results;

  } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message :'Unknown error';
      
      this.emit('search_failed', { query, error: this.state.error });
      throw error;
  }
}

  /**
   * Get asset by ID
   */
  getAsset(id: string): Asset | null {
    return this.state.assets.get(id) || null;
}

  /**
   * Get assets by type
   */
  getAssetsByType(type: string): Asset[] {
    return Array.from(this.state.assets.values()).filter(asset => asset.type === type);
}

  /**
   * Get assets by category
   */
  getAssetsByCategory(category: string): Asset[] {
    return Array.from(this.state.assets.values()).filter(asset => asset.category === category);
}

  /**
   * Get category by ID
   */
  getCategory(id: string): AssetCategory | null {
    return this.state.categories.get(id) || null;
}

  /**
   * Get tag by ID
   */
  getTag(id: string): AssetTag | null {
    return this.state.tags.get(id) || null;
}

  /**
   * Validate asset
   */
  private async validateAsset(asset: Asset): Promise<void> {
    // Implementation depends on validation strategy
}

  /**
   * Generate ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
  }
    this.eventListeners.get(event)!.push(callback);
}

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
    }
  }
}

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
      } catch (error) {
          console.error('Error in asset manager event listener:', error);
      }
    });
  }
}

  /**
   * Get state
   */
  getState(): AssetManagerState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): AssetManagerConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AssetManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  /**
   * Get all assets
   */
  getAllAssets(): Asset[] {
    return Array.from(this.state.assets.values());
}

  /**
   * Get all categories
   */
  getAllCategories(): AssetCategory[] {
    return Array.from(this.state.categories.values());
}

  /**
   * Get all tags
   */
  getAllTags(): AssetTag[] {
    return Array.from(this.state.tags.values());
}

  /**
   * Cleanup
   */
  destroy(): void {
    this.state.assets.clear();
    this.state.categories.clear();
    this.state.tags.clear();
    this.searchIndex.clear();
    this.eventListeners.clear();
    this.state.isEnabled = false;
}
}

// Create singleton instance
export const assetManager = new AssetManager();

export default assetManager;





