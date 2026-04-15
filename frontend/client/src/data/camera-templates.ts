// @ts-nocheck
/**
 * Camera Template System
 * Allows users to save and reuse camera setups for different project types
 */

import type { Camera } from './video-camera-database';
import type { PhotoCamera } from './photo-camera-database';

export interface CameraTemplate {
  id: string;
  name: string;
  description: string;
  category: 'wedding' | 'event' | 'commercial' | 'portrait' | 'cinema' | 'documentary' | 'sports' | 'travel' | 'custom';
  profession: 'photographer' | 'videographer' | 'both';
  culture?: string; // For culture-specific templates
  phase?: 'pre-production' | 'production' | 'post-production' | 'all';
  
  // Camera setup
  primaryCamera: {
    video?: Camera;
    photo?: PhotoCamera;
  };
  backupCamera?: {
    video?: Camera;
    photo?: PhotoCamera;
  };
  additionalCameras: Array<{
    video?: Camera;
    photo?: PhotoCamera;
    role: 'b-roll' | 'close-up' | 'wide' | 'detail' | 'backup' | 'custom';
    customRole?: string;
  }>;
  
  // Equipment configuration
  lenses: Array<{
    type: 'prime' | 'zoom' | 'macro' | 'telephoto' | 'wide-angle';
    focalLength: string;
    aperture: string;
    brand: string;
    model: string;
    purpose: string;
  }>;
  
  accessories: Array<{
    type: 'tripod' | 'gimbal' | 'monopod' | 'slider' | 'drone' | 'lighting' | 'audio' | 'storage' | 'other';
    brand: string;
    model: string;
    quantity: number;
    purpose: string;
  }>;
  
  // Settings and preferences
  settings: {
    video: {
      resolution: string;
      frameRate: string;
      colorSpace: string;
      logFormat?: string;
      codec: string;
      bitrate?: string;
    };
    photo: {
      fileFormat: 'raw' | 'jpeg' | 'raw+jpeg' | 'heif';
      quality: 'low' | 'medium' | 'high' | 'maximum';
      colorSpace: 'sRGB' | 'Adobe RGB' | 'ProPhoto RGB';
      whiteBalance: 'auto' | 'daylight' | 'tungsten' | 'fluorescent' | 'custom';
    };
  };
  
  // Workflow preferences
  workflow: {
    backupStrategy: 'realtime' | 'interval' | 'manual' | 'end-of-day';
    backupFrequency: number; // minutes
    memoryCardLabeling: 'ABCD' | 'EFGH' | 'NUMERIC' | 'custom';
    customLabels?: string[];
    estimatedPhotos: number;
    estimatedVideoHours: number;
    estimatedStorage: string; // GB
  };
  
  // Template metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isPublic: boolean;
  isDefault: boolean;
  tags: string[];
  usageCount: number;
  lastUsed?: string;
  rating?: number; // 1-5 stars
  reviews?: Array<{
    userId: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
  
  // Template sharing
  shareSettings: {
    isShared: boolean;
    shareToken?: string;
    permissions: 'view' | 'copy' | 'edit';
    expiresAt?: string;
  };
}

export interface CameraTemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultTemplates: string[];
  isSystemCategory: boolean;
}

export interface CameraTemplateSearchFilters {
  category?: string;
  profession?: string;
  culture?: string;
  phase?: string;
  cameraBrand?: string;
  logFormat?: string;
  isPublic?: boolean;
  isDefault?: boolean;
  tags?: string[];
  minRating?: number;
  createdBy?: string;
}

export class CameraTemplateManager {
  private templates: Map<string, CameraTemplate> = new Map();
  private categories: Map<string, CameraTemplateCategory> = new Map();
  private userTemplates: Map<string, string[]> = new Map(); // userId -> templateIds

  constructor() {
    this.initializeDefaultCategories();
    this.initializeDefaultTemplates();
    this.loadFromStorage();
}

  private initializeDefaultCategories() {
    const defaultCategories: CameraTemplateCategory[] = [
      {
        id: 'wedding',
        name: 'Wedding Photography/Videography',
        description: 'Complete camera setups for wedding events',
        icon: 'heart',
        color: '#e91e63',
        defaultTemplates: ['wedding-norwegian-classic','wedding-indian-traditional'],
        isSystemCategory: true
      },
      {
        id: 'event',
        name: 'Event Coverage',
        description: 'Camera setups for corporate events, parties, and celebrations',
        icon: 'calendar',
        color: '#9c27b0',
        defaultTemplates: ['event-corporate','event-party'],
        isSystemCategory: true
      },
      {
        id: 'commercial',
        name: 'Commercial Photography',
        description: 'Professional setups for product and commercial photography',
        icon: 'briefcase',
        color: '#3f51b5',
        defaultTemplates: ['commercial-product','commercial-portrait'],
        isSystemCategory: true
      },
      {
        id: 'cinema',
        name: 'Cinema Production',
        description: 'High-end camera setups for film and cinema production',
        icon: 'film',
        color: '#ff5722',
        defaultTemplates: ['cinema-narrative','cinema-documentary'],
        isSystemCategory: true
      },
      {
        id: 'documentary',
        name: 'Documentary',
        description: 'Mobile and versatile setups for documentary work',
        icon: 'document',
        color: '#4caf50',
        defaultTemplates: ['documentary-travel','documentary-interview'],
        isSystemCategory: true
      },
      {
        id: 'sports',
        name: 'Sports Photography',
        description: 'Fast-action camera setups for sports events',
        icon: 'sports',
        color: '#ff9800',
        defaultTemplates: ['sports-outdoor','sports-indoor'],
        isSystemCategory: true
      },
      {
        id: 'travel',
        name: 'Travel Photography',
        description: 'Lightweight and portable setups for travel',
        icon: 'travel',
        color: '#2196f3',
        defaultTemplates: ['travel-lightweight','travel-adventure'],
        isSystemCategory: true
      },
      {
        id: 'custom',
        name: 'Custom Templates',
        description: 'User-created custom camera setups',
        icon: 'settings',
        color: '#607d8b',
        defaultTemplates:  [],
        isSystemCategory: false
    }
    ];

    defaultCategories.forEach(category => {
      this.categories.set(category.id, category);
});
}

  private initializeDefaultTemplates() {
    const defaultTemplates: CameraTemplate[] = [
      {
        id: 'wedding-norwegian-classic',
        name: 'Norwegian Wedding Classic',
        description: 'Traditional Norwegian wedding setup with Sony cameras',
        category: 'wedding',
        profession: 'both',
        culture: 'norsk',
        phase: 'all',
        primaryCamera: {
          video: {
            id: 'sony-a7s',
            brand: 'Sony',
            model: 'A7S II',
            category: 'mirrorless',
            logFormats: ['S-Log','S-Log3'],
            resolution: ['4','1080p'],
            frameRates: ['24fps','25fps','30fps','60fps','120fps'],
            colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
            priceRange: 'professional',
            description: 'Full-frame mirrorless with exceptional low-light performance',
            features: ['4K 120fps','10-bit recording','S-Log3','S-Cinetone'],
            isVideoOptimized: true,
            isPhotoOptimized: true,
            megapixels:  12,
            sensorSize: 'Full-frame (35.9 x 24.0mm, ), ',
            isoRange: '80-40960',
            shutterSpeed: '1/8000 - 30 sec',
            burstMode: '10 fps continuous',
            autofocusPoints: 79,
            imageStabilization: true,
            weatherSealing: true,
            batteryLife: '600 shots',
            videoResolution: ['4','1080p'],
            videoFrameRates: ['24fps','25fps','30fps','60fps','120fps'],
            videoCodecs: ['XAVC-','XAVC-HS','AVCHD'],
            mount: 'Sony E-mount',
            weight: '699',
            dimensions: '128.9 x 96.9 x 80.8mm',
            releaseDate: '2020-07-2',
            colorSpace: ['sRG','Adobe RGB','Rec.709'],
            addedDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isNew: false,
            isRecentlyUpdated: false,
            source: 'manual',
            version: 1
        , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
          photo: {
            id: 'sony-a7r',
            brand: 'Sony',
            model: 'A7R',
            category: 'mirrorless',
            priceRange: 'professional',
            description: 'High-resolution full-frame mirrorless with 61MP sensor',
            features: ['61MP sensor','8K video','Real-time AF','5-axis stabilization','Dual card slots'],
            isPhotoOptimized: true,
            isVideoOptimized: true,
            megapixels:  61,
            sensorSize: 'Full-frame (35.9 x 24.0mm, ), ',
            isoRange: '100-32000 (expandable to 50-102400, ), ',
            shutterSpeed: '1/8000 - 30 sec',
            burstMode: '10 fps continuous',
            autofocusPoints: 63,
            imageStabilization: true,
            weatherSealing: true,
            batteryLife: '530 shots',
            videoResolution: ['8','4K','1080p'],
            videoFrameRates: ['24fps','25fps','30fps','60fps'],
            videoCodecs: ['XAVC-','XAVC-HS','AVCHD'],
            logFormats: ['S-Log','S-Log3'],
            mount: 'Sony E-mount',
            weight: '723',
            dimensions: '131.3 x 96.9 x 69.7mm',
            releaseDate: '2022-10-2',
            colorSpace: ['sRG','Adobe RGB','Rec.709'],
            addedDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isNew: false,
            isRecentlyUpdated: false,
            source: 'manual',
            version: 1
        }
    },
        backupCamera: {
          video: {
            id: 'sony-a7iv',
            brand: 'Sony',
            model: 'A7 I',
            category: 'mirrorless',
            logFormats: ['S-Log','S-Log3'],
            resolution: ['4','1080p'],
            frameRates: ['24fps','25fps','30fps','60fps'],
            colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
            priceRange: 'professional',
            description: 'Versatile full-frame mirrorless with 33MP sensor',
            features: ['33MP sensor','4K 60fps','Real-time AF','5-axis stabilization','Dual card slots'],
            isVideoOptimized: true,
            isPhotoOptimized: true,
            megapixels:  33,
            sensorSize: 'Full-frame (35.9 x 24.0mm, ), ',
            isoRange: '100-51200 (expandable to 50-204800, )',
            shutterSpeed: '1/8000 - 30 sec',
            burstMode: '10 fps continuous',
            autofocusPoints: 79,
            imageStabilization: true,
            weatherSealing: true,
            batteryLife: '580 shots',
            videoResolution: ['4','1080p'],
            videoFrameRates: ['24fps','25fps','30fps','60fps'],
            videoCodecs: ['XAVC-','XAVC-HS','AVCHD'],
            mount: 'Sony E-mount',
            weight: '658',
            dimensions: '131.3 x 96.4 x 82.1mm',
            releaseDate: '2021-10-2',
            colorSpace: ['sRG','Adobe RGB','Rec.709'],
            addedDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isNew: false,
            isRecentlyUpdated: false,
            source: 'manual',
            version: 1
        }
    },
        additionalCameras:  [],
        lenses: [
          {
            type: 'zoom',
            focalLength: '24-70mm',
            aperture: 'f/2.',
            brand: 'Sony',
            model: 'FE 24-70mm F2.8 G',
            purpose: 'Main wedding lens for ceremonies and portraits'
        , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
          {
            type: 'prime',
            focalLength: '85mm',
            aperture: 'f/1.',
            brand: 'Sony',
            model: 'FE 85mm F1.4 G',
            purpose: 'Portrait and detail shots'
        , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
          {
            type: 'zoom',
            focalLength: '70-200mm',
            aperture: 'f/2.',
            brand: 'Sony',
            model: 'FE 70-200mm F2.8 GM OS',
            purpose: 'Ceremony and candid shots from distance'
        }
        ],
        accessories: [
          {
            type: 'tripod',
            brand: 'Manfrotto',
            model: 'MT055CXPRO',
            quantity:  2,
            purpose: 'Stable shots and time-lapse'
        , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
          {
            type: 'gimbal',
            brand: 'DJ',
            model: 'Ronin-',
            quantity:  1,
            purpose: 'Smooth video movement'
        , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
          {
            type: 'lighting',
            brand: 'Godox',
            model: 'AD600Pro',
            quantity:  2,
            purpose: 'Portrait lighting and fill light'
        }
        ],
        settings: {
          video: {
            resolution: '4',
            frameRate: '25fps',
            colorSpace: 'S-Gamut3.Cine',
            logFormat: 'S-Log',
            codec: 'XAVC-',
            bitrate: '100Mbps'
        , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
          photo: {
            fileFormat: 'raw+jpeg',
            quality: 'maximum',
            colorSpace: 'sRG',
            whiteBalance: 'auto'
        }
    },
        workflow: {
          backupStrategy: 'realtime',
          backupFrequency:  30,
          memoryCardLabeling: 'ABC',
          estimatedPhotos: 200,
          estimatedVideoHours:  8,
          estimatedStorage: '500'
      , isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version:  1,
        isPublic: true,
        isDefault: true,
        tags: ['wedding','norsk','sony','professional','4k'],
        usageCount: 0,
        shareSettings: {
          isShared: false,
          permissions: 'view'
      }
  }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
});
}

  private loadFromStorage() {
    try {
      const storedTemplates = localStorage.getItem('camera-templates');
      if (storedTemplates) {
        const templates = JSON.parse(storedTemplates);
        templates.forEach((template: CameraTemplate) => {
          this.templates.set(template.id, template);
    });
  }

      const storedUserTemplates = localStorage.getItem('user-camera-templates');
      if (storedUserTemplates) {
        this.userTemplates = new Map(JSON.parse(storedUserTemplates));
  }
} catch (error) {
      console.error('Failed to load camera templates from storage: ', error);
}
}

  private saveToStorage() {
    try {
      const templates = Array.from(this.templates.values());
      localStorage.setItem('camera-templates', JSON.stringify(templates));
      localStorage.setItem('user-camera-templates', JSON.stringify(Array.from(this.userTemplates.entries())));
} catch (error) {
      console.error('Failed to save camera templates to storage:', error);
}
}

  // Template CRUD operations
  createTemplate(template: Omit<CameraTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'usageCount'>): CameraTemplate {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newTemplate: CameraTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
      version:  1,
      usageCount: 0
    };

    this.templates.set(id, newTemplate);
    this.saveToStorage();
    return newTemplate;
}

  updateTemplate(id: string, updates: Partial<CameraTemplate>): CameraTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const updatedTemplate: CameraTemplate = {
      ...template,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      version: template.version + 1
    };

    this.templates.set(id, updatedTemplate);
    this.saveToStorage();
    return updatedTemplate;
}

  deleteTemplate(id: string): boolean {
    if (this.templates.has(id)) {
      this.templates.delete(id);
      this.saveToStorage();
      return true;
  }
    return false;
}

  getTemplate(id: string): CameraTemplate | null {
    return this.templates.get(id) || null;
  }

  getAllTemplates(): CameraTemplate[] {
    return Array.from(this.templates.values());
}

  getTemplatesByCategory(category: string): CameraTemplate[] {
    return this.getAllTemplates().filter(template => template.category === category);
  }

  getTemplatesByProfession(profession: string): CameraTemplate[] {
    return this.getAllTemplates().filter(template => 
      template.profession === profession || template.profession === 'both'
  );
  }

  getTemplatesByCulture(culture: string): CameraTemplate[] {
    return this.getAllTemplates().filter(template => template.culture === culture);
  }

  getDefaultTemplates(): CameraTemplate[] {
    return this.getAllTemplates().filter(template => template.isDefault);
}

  getUserTemplates(userId: string): CameraTemplate[] {
    const userTemplateIds = this.userTemplates.get(userId) || [];
    return userTemplateIds.map(id => this.templates.get(id)).filter(Boolean) as CameraTemplate[];
  }

  searchTemplates(filters: CameraTemplateSearchFilters): CameraTemplate[] {
    let templates = this.getAllTemplates();

    if (filters.category) {
      templates = templates.filter(t => t.category === filters.category);
  }
    if (filters.profession) {
      templates = templates.filter(t => t.profession === filters.profession || t.profession === 'both');
}
    if (filters.culture) {
      templates = templates.filter(t => t.culture === filters.culture);
}
    if (filters.phase) {
      templates = templates.filter(t => t.phase === filters.phase || t.phase === 'all');
}
    if (filters.cameraBrand) {
      templates = templates.filter(t => 
        t.primaryCamera.video?.brand === filters.cameraBrand ||
        t.primaryCamera.photo?.brand === filters.cameraBrand
    );
}
    if (filters.logFormat) {
      templates = templates.filter(t => 
        t.primaryCamera.video?.logFormats?.includes(filters.logFormat!)
    );
}
    if (filters.isPublic !== undefined) {
      templates = templates.filter(t => t.isPublic === filters.isPublic);
}
    if (filters.isDefault !== undefined) {
      templates = templates.filter(t => t.isDefault === filters.isDefault);
}
    if (filters.tags && filters.tags.length > 0) {
      templates = templates.filter(t => 
        filters.tags!.some(tag => t.tags.includes(tag))
    );
}
    if (filters.minRating) {
      templates = templates.filter(t => (t.rating || 0) >= filters.minRating!);
}
    if (filters.createdBy) {
      templates = templates.filter(t => t.createdBy === filters.createdBy);
}

    return templates;
}

  // Template usage tracking
  useTemplate(id: string, userId: string): CameraTemplate | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const updatedTemplate = {
      ...template,
      usageCount: template.usageCount + 1,
      lastUsed: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(id, updatedTemplate);
    this.saveToStorage();
    return updatedTemplate;
}

  // Template sharing
  shareTemplate(id: string, permissions: 'view' | 'copy' |'edit', expiresAt?: string): string | null {
    const template = this.templates.get(id);
    if (!template) return null;

    const shareToken = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const updatedTemplate = {
      ...template,
      shareSettings: {
        isShared: true,
        shareToken,
        permissions,
        expiresAt
  },
      updatedAt: new Date().toISOString()
    };

    this.templates.set(id, updatedTemplate);
    this.saveToStorage();
    return shareToken;
}

  getTemplateByShareToken(shareToken: string): CameraTemplate | null {
    return this.getAllTemplates().find(t => t.shareSettings.shareToken === shareToken) || null;
  }

  // Categories
  getCategories(): CameraTemplateCategory[] {
    return Array.from(this.categories.values());
}

  getCategory(id: string): CameraTemplateCategory | null {
    return this.categories.get(id) || null;
  }

  // Template recommendations
  getRecommendedTemplates(userId: string, projectType: string, culture?: string): CameraTemplate[] {
    const userTemplates = this.getUserTemplates(userId);
    const defaultTemplates = this.getDefaultTemplates();
    
    // Combine user and default templates
    const allTemplates = [...userTemplates, ...defaultTemplates];
    
    // Filter by project type and culture
    let recommended = allTemplates.filter(t => t.category === projectType);
    
    if (culture) {
      recommended = recommended.filter(t => t.culture === culture || !t.culture);
}
    
    // Sort by usage count and rating
    return recommended.sort((a, b) => {
      const aScore = a.usageCount + (a.rating || 0) * 10;
      const bScore = b.usageCount + (b.rating || 0) * 10;
      return bScore - aScore;
});
}

  // Export/Import
  exportTemplates(templateIds: string[]): string {
    const templates = templateIds.map(id => this.templates.get(id)).filter(Boolean) as CameraTemplate[];
    return JSON.stringify(templates, null, 2);
}

  importTemplates(jsonData: string): { success: number; failed: number; errors: string[] } {
    try {
      const templates = JSON.parse(jsonData) as CameraTemplate[];
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      templates.forEach(template => {
        try {
          // Generate new ID to avoid conflicts
          const newId = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const importedTemplate = {
            ...template,
            id: newId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false, // Imported templates are private by default
            isDefault: false
          };

          this.templates.set(newId, importedTemplate);
          success++;
    } catch (error) {
          failed++;
          errors.push(`Failed to import template ${template.name}: ${error}`);
    }
  });

      this.saveToStorage();
      return { success, failed, errors };
} catch (error) {
  return { success: 0, failed: 0, errors: [`Invalid JSON data: ${error}`] };
}
}
}

// Export singleton instance
export const cameraTemplateManager = new CameraTemplateManager();














