/**
 * Export Presets Manager
 * Manages export presets for different platforms and formats
 */

export interface ExportPresetConfig {
  enablePresets: boolean;
  enablePlatforms: boolean;
  enableFormats: boolean;
  enableOptimization: boolean;
  enableCompression: boolean;
  enableValidation: boolean;
  enablePreview: boolean;
  enableBatch: boolean;
  enableScheduling: boolean;
  enableCloud: boolean;
  enableLocal: boolean;
  enableCustom: boolean;
  enableTemplates: boolean;
  enableMetadata: boolean;
  enableWatermarking: boolean;
  enableEncryption: boolean;
  enableAnalytics: boolean;
  enableDebugging: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
  debug: boolean
}

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  platform: ExportPlatform;
  format: ExportFormat;
  settings: ExportSettings;
  optimization: OptimizationSettings;
  compression: CompressionSettings;
  validation: ValidationSettings;
  metadata: ExportMetadata;
  permissions: ExportPermissions;
  version: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
  status: 'active, ' | 'archived' | 'deleted' | 'pending' | 'processing';
  usage: ExportUsage;
  config: Record<string, any>;
}

export interface ExportPlatform {
  id: string;
  name: string;
  type: 'web' | 'mobile' | 'desktop' | 'print' | 'social' | 'video' | 'audio' | 'document' | 'custom';
  description: string;
  icon: string;
  supportedFormats: string[];
  requirements: PlatformRequirements;
  capabilities: PlatformCapabilities;
  limitations: PlatformLimitations;
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

export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'code' | 'data' | 'archive' | 'custom';
  supportedPlatforms: string[];
  capabilities: FormatCapabilities;
  limitations: FormatLimitations;
  compression: boolean;
  quality: boolean;
  metadata: boolean;
  transparency: boolean;
  animation: boolean;
  vector: boolean;
  raster: boolean;
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

export interface ExportSettings {
  width?: number;
  height?: number;
  quality?: number;
  compression?: number;
  format?: string;
  colorSpace?: string;
  backgroundColor?: string;
  transparent?: boolean;
  dpi?: number;
  bitrate?: number;
  framerate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  profile?: string;
  level?: string;
  preset?: string;
  tune?: string;
  crf?: number;
  maxrate?: number;
  bufsize?: number;
  gop?: number;
  bframes?: number;
  refs?: number;
  subme?: number;
  me?: string;
  me_range?: number;
  trellis?: number;
  aq_mode?: number;
  aq_strength?: number;
  psy?: number;
  psy_rd?: number;
  deblock?: string;
  custom?: Record<string, any>;
}

export interface OptimizationSettings {
  enableOptimization: boolean;
  targetSize?: number;
  targetQuality?: number;
  targetSpeed?: number;
  algorithms: string[];
  parameters: Record<string, any>;
  preview: boolean;
  batch: boolean;
  parallel: boolean;
  cache: boolean;
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

export interface CompressionSettings {
  enableCompression: boolean;
  algorithm: string;
  level: number;
  dictionary: number;
  strategy: string;
  windowBits: number;
  memLevel: number;
  chunkSize: number;
  parallel: boolean;
  streaming: boolean;
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

export interface ValidationSettings {
  enableValidation: boolean;
  rules: ValidationRule[];
  strict: boolean;
  warnings: boolean;
  errors: boolean;
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

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'size' | 'format' | 'quality' | 'dimension' | 'color' | 'metadata' | 'custom';
  condition: string;
  value: any;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'regex' | 'custom';
  severity: 'error' | 'warning' | 'info';
  message: string;
  fix?: string;
  enabled: boolean;
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

export interface ExportMetadata {
  title?: string;
  description?: string;
  author?: string;
  copyright?: string;
  license?: string;
  keywords?: string[];
  version?: string;
  created?: number;
  modified?: number;
  platform?: string;
  format?: string;
  size?: number;
  duration?: number;
  dimensions?: {
    width: number;
    height: number;
};
  quality?: number;
  compression?: number;
  custom?: Record<string, any>;
}

export interface ExportPermissions {
  canView: boolean;
  canUse: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canClone: boolean;
  canCustomize: boolean;
  canExport: boolean;
  canImport: boolean;
  canComment: boolean;
  canRate: boolean;
  canTag: boolean;
  canCategorize: boolean;
  canVersion: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canCollaborate: boolean;
  canManage: boolean;
  canAdmin: boolean
}

export interface ExportUsage {
  viewCount: number;
  useCount: number;
  exportCount: number;
  successCount: number;
  errorCount: number;
  lastUsed: number;
  usedInProjects: string[];
  popularity: number;
  rating: number;
  reviews: ExportReview[];
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

export interface ExportReview {
  id: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: number;
  helpful: number
}

export interface PlatformRequirements {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minFileSize?: number;
  maxFileSize?: number;
  supportedFormats: string[];
  requiredMetadata: string[];
  optionalMetadata: string[];
  custom?: Record<string, any>;
}

export interface PlatformCapabilities {
  compression: boolean;
  optimization: boolean;
  metadata: boolean;
  transparency: boolean;
  animation: boolean;
  vector: boolean;
  raster: boolean;
  streaming: boolean;
  progressive: boolean;
  responsive: boolean;
  custom?: Record<string, any>;
}

export interface PlatformLimitations {
  maxFileSize?: number;
  maxDimensions?: {
    width: number;
    height: number;
};
  maxDuration?: number;
  unsupportedFeatures: string[];
  custom?: Record<string, any>;
}

export interface FormatCapabilities {
  compression: boolean;
  optimization: boolean;
  metadata: boolean;
  transparency: boolean;
  animation: boolean;
  vector: boolean;
  raster: boolean;
  streaming: boolean;
  progressive: boolean;
  responsive: boolean;
  custom?: Record<string, any>;
}

export interface FormatLimitations {
  maxFileSize?: number;
  maxDimensions?: {
    width: number;
    height: number;
};
  maxDuration?: number;
  unsupportedFeatures: string[];
  custom?: Record<string, any>;
}

export interface ExportPresetManagerState {
  isEnabled: boolean;
  isInitialized: boolean;
  hasError: boolean;
  error: string | null;
  presets: Map<string, ExportPreset>;
  platforms: Map<string, ExportPlatform>;
  formats: Map<string, ExportFormat>;
  lastExport: ExportPreset | null;
  lastUpdate: number;
  totalPresets: number;
  totalPlatforms: number;
  totalFormats: number;
  totalExports: number;
  totalErrors: number;
  totalConflicts: number;
  totalOverrides: number
}

class ExportPresetsManager {
  private config: ExportPresetConfig;
  private state: ExportPresetManagerState;
  private eventListeners: Map<string, Function[]> = new Map();
  private isInitialized = false;

  constructor(config: Partial<ExportPresetConfig> = {}) {
    this.config = {
      enablePresets: true,
      enablePlatforms: true,
      enableFormats: true,
      enableOptimization: true,
      enableCompression: true,
      enableValidation: true,
      enablePreview: true,
      enableBatch: true,
      enableScheduling: true,
      enableCloud: true,
      enableLocal: true,
      enableCustom: true,
      enableTemplates: true,
      enableMetadata: true,
      enableWatermarking: true,
      enableEncryption: true,
      enableAnalytics: true,
      enableDebugging: false,
      enableLogging: true,
      enableMetrics: true,
      debug: false,
      ...config
};

    this.state = {
      isEnabled: false,
      isInitialized: false,
      hasError: false,
      error: null,
      presets: new Map(),
      platforms: new Map(),
      formats: new Map(),
      lastExport: null,
      lastUpdate:  0,
      totalPresets:  0,
      totalPlatforms:  0,
      totalFormats:  0,
      totalExports:  0,
      totalErrors:  0,
      totalConflicts:  0,
      totalOverrides: 0
};

    this.initializeExportPresetsManager();
}

  /**
   * Initialize export presets manager
   */
  private initializeExportPresetsManager(): void {
    if (!this.config.enablePresets) return;

    try {
      // Enable manager first so load methods can work
      this.state.isEnabled = true;
      this.setupEventListeners();
      this.loadDefaultPlatforms();
      this.loadDefaultFormats();
      this.loadDefaultPresets();
      this.state.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.state.isEnabled = false;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: this.state.error });
    }
}

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.config.enablePresets) return;
    // Implementation depends on event handling strategy
}

  /**
   * Load default platforms
   */
  private loadDefaultPlatforms(): void {
    const defaultPlatforms: Partial<ExportPlatform>[] = [
      {
        id: 'web',
        name: 'Web',
        type: 'web',
        description: 'Web platform for browsers',
        icon: '🌐',
        supportedFormats: ['html','css','js','png','jpg','gif','svg','webp'],
        requirements: {
          minWidth: 1,
          maxWidth: 4096,
          minHeight: 1,
          maxHeight: 4096,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          supportedFormats: ['html','css','js','png','jpg','gif','svg','webp'],
          requiredMetadata: ['title','description'],
          optionalMetadata: ['keywords','author','copyright']
        },
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: true,
          animation: true,
          vector: true,
          raster: true,
          streaming: true,
          progressive: true,
          responsive: true
        },
        limitations: {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxDimensions: { width: 4096, height: 4096 },
          unsupportedFeatures: ['native-app-features']
        }
      },
      {
        id: 'mobile',
        name: 'Mobile',
        type: 'mobile',
        description: 'Mobile platform for iOS and Android',
        icon: '📱',
        supportedFormats: ['png','jpg','gif','svg','webp','mp4','mov','avi'],
        requirements: {
          minWidth: 1,
          maxWidth: 2048,
          minHeight: 1,
          maxHeight: 2048,
          maxFileSize: 5 * 1024 * 1024, // 5MB
          supportedFormats: ['png','jpg','gif','svg','webp','mp4','mov','avi'],
          requiredMetadata: ['title','description'],
          optionalMetadata: ['keywords','author','copyright']
        },
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: true,
          animation: true,
          vector: true,
          raster: true,
          streaming: false,
          progressive: true,
          responsive: true
        },
        limitations: {
          maxFileSize: 5 * 1024 * 1024, // 5MB
          maxDimensions: { width: 2048, height: 2048 },
          unsupportedFeatures: ['desktop-features']
        }
      },
      {
        id: 'desktop',
        name: 'Desktop',
        type: 'desktop',
        description: 'Desktop platform for Windows, macOS, and Linux',
        icon: '🖥️',
        supportedFormats: ['png','jpg','gif','svg','webp','mp4','mov','avi','pdf','doc','docx'],
        requirements: {
          minWidth: 1,
          maxWidth: 8192,
          minHeight: 1,
          maxHeight: 8192,
          maxFileSize: 100 * 1024 * 1024, // 100MB
          supportedFormats: ['png','jpg','gif','svg','webp','mp4','mov','avi','pdf','doc','docx'],
          requiredMetadata: ['title','description'],
          optionalMetadata: ['keywords','author','copyright']
        },
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: true,
          animation: true,
          vector: true,
          raster: true,
          streaming: true,
          progressive: true,
          responsive: true
        },
        limitations: {
          maxFileSize: 100 * 1024 * 1024, // 100MB
          maxDimensions: { width: 8192, height: 8192 },
          unsupportedFeatures: ['mobile-features']
        }
      },
      {
        id: 'print',
        name: 'Print',
        type: 'print',
        description: 'Print platform for physical media',
        icon: '🖨️',
        supportedFormats: ['pdf','png','jpg','tiff','eps','svg'],
        requirements: {
          minWidth: 72, // 1 inch at 72 DPI
          maxWidth: 8640, // 120 inches at 72 DPI
          minHeight: 72, // 1 inch at 72 DPI
          maxHeight: 8640, // 120 inches at 72 DPI
          maxFileSize: 500 * 1024 * 1024, // 500MB
          supportedFormats: ['pdf','png','jpg','tiff','eps','svg'],
          requiredMetadata: ['title','description','copyright'],
          optionalMetadata: ['keywords','author','license']
        },
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: false,
          animation: false,
          vector: true,
          raster: true,
          streaming: false,
          progressive: false,
          responsive: false
        },
        limitations: {
          maxFileSize: 500 * 1024 * 1024, // 500MB
          maxDimensions: { width: 8640, height: 8640 },
          unsupportedFeatures: ['animation','transparency','streaming','progressive','responsive']
        }
      },
      {
        id: 'social',
        name: 'Social Media',
        type: 'social',
        description: 'Social media platform for sharing',
        icon: '📱',
        supportedFormats: ['png','jpg','gif','mp4','mov','avi'],
        requirements: {
          minWidth: 1,
          maxWidth: 4096,
          minHeight: 1,
          maxHeight: 4096,
          maxFileSize: 50 * 1024 * 1024, // 50MB
          supportedFormats: ['png','jpg','gif','mp4','mov','avi'],
          requiredMetadata: ['title','description'],
          optionalMetadata: ['keywords','author','copyright']
        },
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: false,
          animation: true,
          vector: false,
          raster: true,
          streaming: true,
          progressive: true,
          responsive: true
        },
        limitations: {
          maxFileSize: 50 * 1024 * 1024, // 50MB
          maxDimensions: { width: 4096, height: 4096 },
          unsupportedFeatures: ['vector','transparency']
        }
      }
    ];

    defaultPlatforms.forEach(platformData => {
      this.addPlatform(platformData);
    });
  }

  /**
   * Load default formats
   */
  private loadDefaultFormats(): void {
    const defaultFormats: Partial<ExportFormat>[] = [
      {
        id: 'png',
        name: 'PNG',
        extension: 'png',
        mimeType: 'image/png',
        description: 'Portable Network Graphics',
        category: 'image',
        supportedPlatforms: ['web','mobile','desktop','print'],
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: true,
          animation: false,
          vector: false,
          raster: true,
          streaming: false,
          progressive: false,
          responsive: false
        },
        limitations: {
          maxFileSize: 50 * 1024 * 1024, // 50MB
          maxDimensions: { width: 8192, height: 8192 },
          unsupportedFeatures: ['animation','vector','streaming','progressive','responsive']
        },
        compression: true,
        quality: true,
        metadata: true,
        transparency: true,
        animation: false,
        vector: false,
        raster: true
      },
      {
        id: 'jpg',
        name: 'JPEG',
        extension: 'jpg',
        mimeType: 'image/jpeg',
        description: 'Joint Photographic Experts Group',
        category: 'image',
        supportedPlatforms: ['web','mobile','desktop','print','social'],
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: false,
          animation: false,
          vector: false,
          raster: true,
          streaming: false,
          progressive: true,
          responsive: false
        },
        limitations: {
          maxFileSize: 50 * 1024 * 1024, // 50MB
          maxDimensions: { width: 8192, height: 8192 },
          unsupportedFeatures: ['transparency','animation','vector','streaming','responsive']
        },
        compression: true,
        quality: true,
        metadata: true,
        transparency: false,
        animation: false,
        vector: false,
        raster: true
      },
      {
        id: 'svg',
        name: 'SVG',
        extension: 'svg',
        mimeType: 'image/svg+xml',
        description: 'Scalable Vector Graphics',
        category: 'image',
        supportedPlatforms: ['web','mobile','desktop','print'],
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: true,
          animation: true,
          vector: true,
          raster: false,
          streaming: false,
          progressive: false,
          responsive: true
        },
        limitations: {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxDimensions: { width: 8192, height: 8192 },
          unsupportedFeatures: ['raster','streaming','progressive']
        },
        compression: true,
        quality: false,
        metadata: true,
        transparency: true,
        animation: true,
        vector: true,
        raster: false
      },
      {
        id: 'webp',
        name: 'WebP',
        extension: 'webp',
        mimeType: 'image/webp',
        description: 'WebP Image Format',
        category: 'image',
        supportedPlatforms: ['web','mobile','desktop'],
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: true,
          animation: true,
          vector: false,
          raster: true,
          streaming: false,
          progressive: false,
          responsive: false
        },
        limitations: {
          maxFileSize: 50 * 1024 * 1024, // 50MB
          maxDimensions: { width: 8192, height: 8192 },
          unsupportedFeatures: ['vector','streaming','progressive','responsive']
        },
        compression: true,
        quality: true,
        metadata: true,
        transparency: true,
        animation: true,
        vector: false,
        raster: true
      },
      {
        id: 'mp4',
        name: 'MP4',
        extension: 'mp4',
        mimeType: 'video/mp4',
        description: 'MPEG-4 Video',
        category: 'video',
        supportedPlatforms: ['web','mobile','desktop','social'],
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: false,
          animation: true,
          vector: false,
          raster: true,
          streaming: true,
          progressive: true,
          responsive: false
        },
        limitations: {
          maxFileSize: 500 * 1024 * 1024, // 500MB
          maxDimensions: { width: 4096, height: 4096 },
          maxDuration: 3600, // 1 hour
          unsupportedFeatures: ['transparency','vector','responsive']
        },
        compression: true,
        quality: true,
        metadata: true,
        transparency: false,
        animation: true,
        vector: false,
        raster: true
      },
      {
        id: 'pdf',
        name: 'PDF',
        extension: 'pdf',
        mimeType: 'application/pdf',
        description: 'Portable Document Format',
        category: 'document',
        supportedPlatforms: ['desktop','print'],
        capabilities: {
          compression: true,
          optimization: true,
          metadata: true,
          transparency: false,
          animation: false,
          vector: true,
          raster: true,
          streaming: false,
          progressive: false,
          responsive: false
        },
        limitations: {
          maxFileSize: 100 * 1024 * 1024, // 100MB
          maxDimensions: { width: 8640, height: 8640 },
          unsupportedFeatures: ['transparency','animation','streaming','progressive','responsive']
        },
        compression: true,
        quality: true,
        metadata: true,
        transparency: false,
        animation: false,
        vector: true,
        raster: true
      }
    ];

    defaultFormats.forEach(formatData => {
      this.addFormat(formatData);
    });
  }

  /**
   * Load default presets
   */
  private loadDefaultPresets(): void {
    const defaultPresets: Partial<ExportPreset>[] = [
      {
        id: 'web-optimized',
        name: 'Web Optimized',
        description: 'Optimized for web performance',
        platform: {
          id: 'web',
          name: 'Web',
          type: 'web',
          description: 'Web platform for browsers',
          icon: '🌐',
          supportedFormats: ['html','css','js','png','jpg','gif','svg','webp'],
          requirements: {
            minWidth: 1,
            maxWidth: 4096,
            minHeight: 1,
            maxHeight: 4096,
            maxFileSize: 10 * 1024 * 1024,
            supportedFormats: ['html','css','js','png','jpg','gif','svg','webp'],
            requiredMetadata: ['title','description'],
            optionalMetadata: ['keywords','author','copyright']
          },
          capabilities: {
            compression: true,
            optimization: true,
            metadata: true,
            transparency: true,
            animation: true,
            vector: true,
            raster: true,
            streaming: true,
            progressive: true,
            responsive: true
          },
          limitations: {
            maxFileSize: 10 * 1024 * 1024,
            maxDimensions: { width: 4096, height: 4096 },
            unsupportedFeatures: ['native-app-features']
          }
        },
        format: {
          id: 'webp',
          name: 'WebP',
          extension: 'webp',
          mimeType: 'image/webp',
          description: 'WebP Image Format',
          category: 'image',
          supportedPlatforms: ['web','mobile','desktop'],
          capabilities: {
            compression: true,
            optimization: true,
            metadata: true,
            transparency: true,
            animation: true,
            vector: false,
            raster: true,
            streaming: false,
            progressive: false,
            responsive: false
          },
          limitations: {
            maxFileSize: 50 * 1024 * 1024,
            maxDimensions: { width: 8192, height: 8192 },
            unsupportedFeatures: ['vector','streaming','progressive','responsive']
          },
          compression: true,
          quality: true,
          metadata: true,
          transparency: true,
          animation: true,
          vector: false,
          raster: true
        },
        settings: {
          quality: 80,
          compression: 6,
          format: 'webp',
          colorSpace: 'sRGB',
          transparent: true,
          dpi: 72
        },
        optimization: {
          enableOptimization: true,
          targetSize: 500 * 1024, // 500KB
          targetQuality: 80,
          targetSpeed: 5,
          algorithms: ['mozjpeg','pngquant','webp'],
          parameters: {
            mozjpeg: { quality: 80 },
            pngquant: { quality: [50, 80] },
            webp: { quality: 80 }
          },
          preview: true,
          batch: true,
          parallel: true,
          cache: true
        },
        compression: {
          enableCompression: true,
          algorithm: 'gzip',
          level: 6,
          dictionary: 32768,
          strategy: 'default',
          windowBits: 15,
          memLevel: 8,
          chunkSize: 16384,
          parallel: true,
          streaming: true
        },
        validation: {
          enableValidation: true,
          rules: [
            {
              id: 'file-size',
              name: 'File Size',
              description: 'Check file size is within limits',
              type: 'size',
              condition: 'fileSize',
              value: 10 * 1024 * 1024, // 10MB
              operator: 'less_than',
              severity: 'error',
              message: 'File size exceeds maximum allowed size',
              fix: 'Reduce file size or use compression',
              enabled: true
            },
            {
              id: 'dimensions',
              name: 'Dimensions',
              description: 'Check dimensions are within limits',
              type: 'dimension',
              condition: 'dimensions',
              value: { width: 4096, height: 4096 },
              operator: 'less_than',
              severity: 'error',
              message: 'Dimensions exceed maximum allowed size',
              fix: 'Reduce dimensions or use different format',
              enabled: true
            }
          ],
          strict: true,
          warnings: true,
          errors: true
        },
        metadata: {
          title: 'Web Optimized Export',
          description: 'Optimized for web performance',
          author: 'Export Presets Manager',
          copyright: '© 2024',
          license: 'MIT',
          keywords: ['web','optimized','performance'],
          version: '1.0.0',
          created: Date.now(),
          modified: Date.now(),
          platform: 'web',
          format: 'webp',
          size: 0,
          quality: 80,
          compression: 6
        },
        permissions: {
          canView: true,
          canUse: true,
          canEdit: false,
          canDelete: false,
          canShare: true,
          canClone: true,
          canCustomize: true,
          canExport: true,
          canImport: false,
          canComment: true,
          canRate: true,
          canTag: true,
          canCategorize: false,
          canVersion: false,
          canArchive: false,
          canRestore: false,
          canCollaborate: false,
          canManage: false,
          canAdmin: false
        },
        usage: {
          viewCount: 0,
          useCount: 0,
          exportCount: 0,
          successCount: 0,
          errorCount: 0,
          lastUsed: 0,
          usedInProjects: [],
          popularity: 0,
          rating: 0,
          reviews: []
        }
      }
    ];

    defaultPresets.forEach(presetData => {
      this.addPreset(presetData);
    });
  }

  /**
   * Add platform
   */
  async addPlatform(platformData: Partial<ExportPlatform>): Promise<ExportPlatform> {
    if (!this.state.isEnabled) throw new Error('Export presets manager is not enabled');

    const platform: ExportPlatform = {
      id: platformData.id || this.generateId(),
      name: platformData.name || 'Untitled Platform',
      type: platformData.type || 'custom',
      description: platformData.description || ', ',
      icon: platformData.icon || '📦',
      supportedFormats: platformData.supportedFormats || [],
      requirements: platformData.requirements || {
        minWidth: 1,
        maxWidth: 4096,
        minHeight: 1,
        maxHeight: 4096,
        maxFileSize: 10 * 1024 * 1024,
        supportedFormats: [],
        requiredMetadata: [],
        optionalMetadata: []
      },
      capabilities: platformData.capabilities || {
        compression: false,
        optimization: false,
        metadata: false,
        transparency: false,
        animation: false,
        vector: false,
        raster: false,
        streaming: false,
        progressive: false,
        responsive: false
      },
      limitations: platformData.limitations || {
        maxFileSize: 10 * 1024 * 1024,
        maxDimensions: { width: 4096, height: 4096 },
        unsupportedFeatures: []
      },
      metadata: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        tags: [],
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0
      },
      config: platformData.config || {}
    };

    try {
      this.state.platforms.set(platform.id, platform);
      this.state.totalPlatforms++;
      this.state.lastUpdate = Date.now();

      this.emit('platform_added', { platform });
      return platform;
    } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';

      this.emit('platform_add_failed', { platform, error: this.state.error });
      throw error;
    }
  }

  /**
   * Add format
   */
  async addFormat(formatData: Partial<ExportFormat>): Promise<ExportFormat> {
    if (!this.state.isEnabled) throw new Error('Export presets manager is not enabled');

    const format: ExportFormat = {
      id: formatData.id || this.generateId(),
      name: formatData.name || 'Untitled Format',
      extension: formatData.extension || 'txt',
      mimeType: formatData.mimeType || 'text/plain',
      description: formatData.description || ', ',
      category: formatData.category || 'custom',
      supportedPlatforms: formatData.supportedPlatforms || [],
      capabilities: formatData.capabilities || {
        compression: false,
        optimization: false,
        metadata: false,
        transparency: false,
        animation: false,
        vector: false,
        raster: false,
        streaming: false,
        progressive: false,
        responsive: false
      },
      limitations: formatData.limitations || {
        maxFileSize: 10 * 1024 * 1024,
        maxDimensions: { width: 4096, height: 4096 },
        unsupportedFeatures: []
      },
      compression: formatData.compression || false,
      quality: formatData.quality || false,
      metadata: formatData.metadata || false,
      transparency: formatData.transparency || false,
      animation: formatData.animation || false,
      vector: formatData.vector || false,
      raster: formatData.raster || false,
      metadataInfo: {
        created: Date.now(),
        modified: Date.now(),
        version: '1.0.0',
        author: 'User',
        tags: [],
        usageCount: 0,
        lastUsed: 0,
        successCount: 0,
        errorCount: 0
      },
      config: formatData.config || {}
    };

    try {
      this.state.formats.set(format.id, format);
      this.state.totalFormats++;
      this.state.lastUpdate = Date.now();

      this.emit('format_added', { format });
      return format;
    } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message : 'Unknown error';

      this.emit('format_add_failed', { format, error: this.state.error });
      throw error;
    }
  }

  /**
   * Add preset
   */
  async addPreset(presetData: Partial<ExportPreset>): Promise<ExportPreset> {
    if (!this.state.isEnabled) throw new Error('Export presets manager is not enabled');

    const preset: ExportPreset = {
      id: presetData.id || this.generateId(),
      name: presetData.name || 'Untitled Preset',
      description: presetData.description || ', ',
      platform: presetData.platform || this.state.platforms.get('web')!,
      format: presetData.format || this.state.formats.get('png')!,
      settings: presetData.settings || {},
      optimization: presetData.optimization || {
        enableOptimization: true,
        targetSize: 500 * 1024,
        targetQuality: 80,
        targetSpeed: 5,
        algorithms: [],
        parameters: {},
        preview: true,
        batch: true,
        parallel: true,
        cache: true
      },
      compression: presetData.compression || {
        enableCompression: true,
        algorithm: 'gzip',
        level: 6,
        dictionary: 32768,
        strategy: 'default',
        windowBits: 15,
        memLevel: 8,
        chunkSize: 16384,
        parallel: true,
        streaming: true
      },
      validation: presetData.validation || {
        enableValidation: true,
        rules: [],
        strict: true,
        warnings: true,
        errors: true
      },
      metadata: presetData.metadata || {},
      permissions: presetData.permissions || {
        canView: true,
        canUse: true,
        canEdit: false,
        canDelete: false,
        canShare: true,
        canClone: true,
        canCustomize: true,
        canExport: true,
        canImport: false,
        canComment: true,
        canRate: true,
        canTag: true,
        canCategorize: false,
        canVersion: false,
        canArchive: false,
        canRestore: false,
        canCollaborate: false,
        canManage: false,
        canAdmin: false
      },
      usage: presetData.usage || {
        viewCount: 0,
        useCount: 0,
        exportCount: 0,
        successCount: 0,
        errorCount: 0,
        lastUsed: 0,
        usedInProjects: [],
        popularity: 0,
        rating: 0,
        reviews: []
      },
      version: presetData.version || '1.0.0',
      createdAt: presetData.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: presetData.createdBy || 'user',
      updatedBy: presetData.updatedBy || 'user',
      status: presetData.status || 'active',
      config: presetData.config || {}
    };

    try {
      this.state.presets.set(preset.id, preset);
      this.state.totalPresets++;
      this.state.lastUpdate = Date.now();

      this.emit('preset_added', { preset });
      return preset;
    } catch (error) {
      this.state.totalErrors++;
      this.state.hasError = true;
      this.state.error = error instanceof Error ? error.message :'Unknown error';

      this.emit('preset_add_failed', { preset, error: this.state.error });
      throw error;
    }
  }

  /**
   * Get preset by ID
   */
  getPreset(id: string): ExportPreset | null {
    return this.state.presets.get(id) || null;
}

  /**
   * Get platform by ID
   */
  getPlatform(id: string): ExportPlatform | null {
    return this.state.platforms.get(id) || null;
}

  /**
   * Get format by ID
   */
  getFormat(id: string): ExportFormat | null {
    return this.state.formats.get(id) || null;
}

  /**
   * Get all presets
   */
  getAllPresets(): ExportPreset[] {
    return Array.from(this.state.presets.values());
}

  /**
   * Get all platforms
   */
  getAllPlatforms(): ExportPlatform[] {
    return Array.from(this.state.platforms.values());
}

  /**
   * Get all formats
   */
  getAllFormats(): ExportFormat[] {
    return Array.from(this.state.formats.values());
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
          console.error('Error in export presets manager event listener:', error);
    }
  });
}
}

  /**
   * Get state
   */
  getState(): ExportPresetManagerState {
    return { ...this.state };
}

  /**
   * Get configuration
   */
  getConfig(): ExportPresetConfig {
    return { ...this.config };
}

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExportPresetConfig>): void {
    this.config = { ...this.config, ...newConfig };
}

  /**
   * Cleanup
   */
  destroy(): void {
    this.state.presets.clear();
    this.state.platforms.clear();
    this.state.formats.clear();
    this.eventListeners.clear();
    this.state.isEnabled = false;
}
}

// Create singleton instance
export const exportPresetsManager = new ExportPresetsManager();

export default exportPresetsManager;





