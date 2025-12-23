/**
 * Comprehensive Profession Configuration System
 * Centralizes all profession-specific settings, workflows, and behaviors
 */

export interface ProfessionConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  
  // Profession-specific terminology
  terminology: {
    showcase: string;
    project: string;
    collection: string;
    media: string;
    portfolio: string;
    client: string;
    session: string;
    selection: string;
    proofing: string;
    delivery: string;
    overage: string;
};
  
  // Profession-specific settings
  settings: {
    defaultFileTypes: string[];
    supportedFileTypes: string[];
    maxFileSize: number; // in MB
    allowedCategories: string[];
    defaultCategories: string[];
    pricingModel: 'per_item' | 'per_package' | 'subscription' | 'custom';
    defaultPricing: {
      perImage?: number;
      perPackage?: number;
      subscriptionFee?: number;
      overagePrice?: number;
  };
    watermarkSettings: {
      enabled: boolean;
      defaultPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
      defaultOpacity: number;
      defaultSize: 'small' | 'medium' | 'large';
  };
};
  
  // Workflow configurations
  workflows: {
    clientProofing: {
      enabled: boolean;
      maxSelections: number;
      defaultDeadline: number; // days
      allowComments: boolean;
      allowRatings: boolean;
      allowRevisions: boolean;
      maxRevisions: number;
  };
    overageManagement: {
      enabled: boolean;
      defaultLimit: number;
      defaultPricePerOverage: number;
      autoDetection: boolean;
      emailNotifications: boolean;
  };
    sharing: {
      enabled: boolean;
      defaultEmailTemplate: string;
      allowCustomMessages: boolean;
      requireApproval: boolean;
      allowPublicLinks: boolean;
  };
    delivery: {
      enabled: boolean;
      defaultFormat: string[];
      allowMultipleFormats: boolean;
      compressionSettings: {
        enabled: boolean;
        quality: number;
        maxResolution: string;
    };
  };
};
  
  // UI/UX configurations
  ui: {
    layout: 'grid' | 'masonry' | 'list' | 'carousel' | 'timeline';
    defaultView: 'gallery' | 'proofing' | 'admin' | 'client';
    showMetadata: boolean;
    showExifData: boolean;
    showPricing: boolean;
    showWatermarks: boolean;
    showRatings: boolean;
    showComments: boolean;
    enableLightbox: boolean;
    enableFullscreen: boolean;
    enableDownload: boolean;
    enableShare: boolean;
    hoverEffects: {
      enabled: boolean;
      type: 'zoom' | 'fade' | 'slide' | 'flip' | 'none';
      duration: number;
  };
};
  
  // Integration settings
  integrations: {
    googlePhotos: {
      enabled: boolean;
      autoSync: boolean;
      syncInterval: number; // minutes
      defaultAlbum: string;
  };
    googleDrive: {
      enabled: boolean;
      defaultFolder: string;
      autoBackup: boolean;
      backupInterval: number; // hours
  };
    ai: {
      enabled: boolean;
      autoTagging: boolean;
      smartCollections: boolean;
      duplicateDetection: boolean;
      faceRecognition: boolean;
      objectDetection: boolean;
  };
    email: {
      enabled: boolean;
      defaultProvider: 'gmail' | 'outlook' | 'custom';
      templates: {
        sharing: string;
        overage: string;
        delivery: string;
        reminder: string;
    };
  };
};
  
  // Metadata schemas
  metadataSchema: {
    required: string[];
    optional: string[];
    custom: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'date' | 'array';
      label: string;
      validation?: any;
  }>;
};
  
  // Enhancement presets
  enhancementPresets: {
    [key: string]: {
      name: string;
      description: string;
      settings: {
        brightness?: number;
        contrast?: number;
        saturation?: number;
        sharpening?: number;
        noiseReduction?: boolean;
        autoTone?: boolean;
        colorCorrection?: any;
    };
  };
};
  
  // Batch operations
  batchOperations: {
    enabled: boolean;
    availableOperations: string[];
    defaultOperations: string[];
};
  
  // Analytics and reporting
  analytics: {
    enabled: boolean;
    trackViews: boolean;
    trackDownloads: boolean;
    trackShares: boolean;
    trackComments: boolean;
    generateReports: boolean;
    reportFrequency: 'daily' | 'weekly' | 'monthly';
};
  
  // Version and lifecycle
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface ProfessionShowcase {
  id: string;
  professionId: string;
  title: string;
  description?: string;
  
  // Profession-specific data
  professionData: {
    [key: string]: any; // Dynamic based on profession
};
  
  // Standard showcase data
  items: any[]; // ShowcaseItem[]
  categories: any[]; // ShowcaseCategory[]
  sets: any[]; // ShowcaseSet[]
  collections: any[]; // ShowcaseCollection[]
  
  // Profession-specific settings
  settings: {
    pricing: any;
    workflow: any;
    ui: any;
    integrations: any;
};
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}

// Default profession configurations
export const DEFAULT_PROFESSION_CONFIGS: Record<string, Partial<ProfessionConfig>> = {
  photographer: {
    id: 'photographer',
    name: 'photographer',
    displayName: 'Photographer',
    description: 'Professional photography showcase and client management',
    icon: 'camera_alt',
    color: '#ff8c0',
    
    terminology: {
      showcase: 'Fotogalleri',
      project: 'Fotoprosjekt',
      collection: 'Bildesamling',
      media: 'Bilder',
      portfolio: 'Portefølje',
      client: 'Kunde',
      session: 'Fotoshoot',
      selection: 'Bildevalg',
      proofing: 'Bildebevis',
      delivery: 'Bildelevering',
      overage: 'Ekstra bilder'
  },
    
    settings: {
      defaultFileTypes: ['jpg','jpeg','png','tiff','raw'],
      supportedFileTypes: ['jpg','jpeg','png','tiff','raw','heic','webp'],
      maxFileSize: 50,
      allowedCategories: ['portrait','wedding','event','commercial','artistic','family'],
      defaultCategories: ['portrait','wedding','event'],
      pricingModel: 'per_item',
      defaultPricing: {
        perImage: 150,
        overagePrice: 200
    },
      watermarkSettings: {
        enabled: true,
        defaultPosition: 'bottom-right',
        defaultOpacity: 0.7,
        defaultSize: 'medium'
    }
  },
    
    workflows: {
      clientProofing: {
        enabled: true,
        maxSelections: 50,
        defaultDeadline: 14,
        allowComments: true,
        allowRatings: true,
        allowRevisions: true,
        maxRevisions: 3
    },
      overageManagement: {
        enabled: true,
        defaultLimit: 50,
        defaultPricePerOverage: 200,
        autoDetection: true,
        emailNotifications: true
    },
      sharing: {
        enabled: true,
        defaultEmailTemplate: 'photography_showcase',
        allowCustomMessages: true,
        requireApproval: false,
        allowPublicLinks: true
    },
      delivery: {
        enabled: true,
        defaultFormat: ['jpg','png'],
        allowMultipleFormats: true,
        compressionSettings: {
          enabled: true,
          quality: 95,
          maxResolution: '4K'
      }
    }
  },
    
    ui: {
      layout: 'grid',
      defaultView: 'gallery',
      showMetadata: true,
      showExifData: true,
      showPricing: true,
      showWatermarks: true,
      showRatings: true,
      showComments: true,
      enableLightbox: true,
      enableFullscreen: true,
      enableDownload: true,
      enableShare: true,
      hoverEffects: {
        enabled: true,
        type: 'zoom',
        duration: 300
    }
  },
    
    integrations: {
      googlePhotos: {
        enabled: true,
        autoSync: false,
        syncInterval: 60,
        defaultAlbum: 'Photography Showcase'
    },
      googleDrive: {
        enabled: true,
        defaultFolder: 'Photography Projects',
        autoBackup: true,
        backupInterval: 24
    },
      ai: {
        enabled: true,
        autoTagging: true,
        smartCollections: true,
        duplicateDetection: true,
        faceRecognition: true,
        objectDetection: true
    },
      email: {
        enabled: true,
        defaultProvider: 'gmail',
        templates: {
          sharing: 'photography_showcase_template',
          overage: 'photography_overage_template',
          delivery: 'photography_delivery_template',
          reminder: 'photography_reminder_template'
      }
    }
  },
    
    metadataSchema: {
      required: ['title','clientName','shootDate'],
      optional: ['location','camera','lens','tags','notes'],
      custom: {
        shootType: { type: 'string', label: 'Shoot Type' },
        weather: { type: 'string', label: 'Weather Conditions' },
        equipment: { type: 'array', label: 'Equipment Used' }
    }
  },
    
    enhancementPresets: {
      portrait: {
        name: 'Portrait Enhancement',
        description: 'Optimized for portrait photography',
        settings: {
          brightness: 0.1,
          contrast: 1.1,
          saturation: 1.05,
          sharpening: 1.2,
          noiseReduction: true,
          autoTone: true
      }
    },
      wedding: {
        name: 'Wedding Enhancement',
        description: 'Optimized for wedding photography',
        settings: {
          brightness: 0.05,
          contrast: 1.05,
          saturation: 1.1,
          sharpening: 1.1,
          noiseReduction: true,
          autoTone: false
      }
    },
      commercial: {
        name: 'Commercial Enhancement',
        description: 'Optimized for commercial photography',
        settings: {
          brightness: 0,
          contrast: 1.15,
          saturation: 1.0,
          sharpening: 1.3,
          noiseReduction: true,
          autoTone: false
      }
    }
  },
    
    batchOperations: {
      enabled: true,
      availableOperations: ['enhance','watermark','resize','convert','metadata'],
      defaultOperations: ['enhance','watermark']
  },
    
    analytics: {
      enabled: true,
      trackViews: true,
      trackDownloads: true,
      trackShares: true,
      trackComments: true,
      generateReports: true,
      reportFrequency: 'weekly'
  }
},
  
  videographer: {
    id: 'videographer',
    name: 'videographer',
    displayName: 'Videographer',
    description: 'Professional video production and client management',
    icon: 'videocam',
    color: '#e91e6',
    
    terminology: {
      showcase: 'Videogalleri',
      project: 'Videoprosjekt',
      collection: 'Videosamling',
      media: 'Videoer',
      portfolio: 'Showreel',
      client: 'Kunde',
      session: 'Filming',
      selection: 'Videovalg',
      proofing: 'Videobevis',
      delivery: 'Videolevering',
      overage: 'Ekstra videoer'
  },
    
    settings: {
      defaultFileTypes: ['mp4','mov','avi','mkv'],
      supportedFileTypes: ['mp4','mov','avi','mkv','wmv','flv','webm'],
      maxFileSize: 500,
      allowedCategories: ['wedding','corporate','event','music','documentary','commercial'],
      defaultCategories: ['wedding','corporate','event'],
      pricingModel: 'per_package',
      defaultPricing: {
        perPackage: 5000,
        overagePrice: 1000
    },
      watermarkSettings: {
        enabled: true,
        defaultPosition: 'bottom-right',
        defaultOpacity: 0.8,
        defaultSize: 'large'
    }
  },
    
    workflows: {
      clientProofing: {
        enabled: true,
        maxSelections: 20,
        defaultDeadline: 21,
        allowComments: true,
        allowRatings: true,
        allowRevisions: true,
        maxRevisions: 2
    },
      overageManagement: {
        enabled: true,
        defaultLimit: 10,
        defaultPricePerOverage: 1000,
        autoDetection: true,
        emailNotifications: true
    },
      sharing: {
        enabled: true,
        defaultEmailTemplate: 'video_showcase',
        allowCustomMessages: true,
        requireApproval: false,
        allowPublicLinks: true
    },
      delivery: {
        enabled: true,
        defaultFormat: ['mp4','mov'],
        allowMultipleFormats: true,
        compressionSettings: {
          enabled: true,
          quality: 90,
          maxResolution: '4K'
      }
    }
  },
    
    ui: {
      layout: 'grid',
      defaultView: 'gallery',
      showMetadata: true,
      showExifData: false,
      showPricing: true,
      showWatermarks: true,
      showRatings: true,
      showComments: true,
      enableLightbox: true,
      enableFullscreen: true,
      enableDownload: true,
      enableShare: true,
      hoverEffects: {
        enabled: true,
        type: 'fade',
        duration: 200
    }
  },
    
    integrations: {
      googlePhotos: {
        enabled: false,
        autoSync: false,
        syncInterval: 60,
        defaultAlbum: 'Video Showcase'
    },
      googleDrive: {
        enabled: true,
        defaultFolder: 'Video Projects',
        autoBackup: true,
        backupInterval: 12
    },
      ai: {
        enabled: true,
        autoTagging: true,
        smartCollections: true,
        duplicateDetection: false,
        faceRecognition: true,
        objectDetection: true
    },
      email: {
        enabled: true,
        defaultProvider: 'gmail',
        templates: {
          sharing: 'video_showcase_template',
          overage: 'video_overage_template',
          delivery: 'video_delivery_template',
          reminder: 'video_reminder_template'
      }
    }
  },
    
    metadataSchema: {
      required: ['title','clientName','shootDate','duration'],
      optional: ['location','camera','lens','tags','notes'],
      custom: {
        videoType: { type: 'string', label: 'Video Type' },
        resolution: { type: 'string', label: 'Resolution' },
        frameRate: { type: 'number', label: 'Frame Rate' },
        audioTrack: { type: 'string', label: 'Audio Track' }
    }
  },
    
    enhancementPresets: {
      wedding: {
        name: 'Wedding Video Enhancement',
        description: 'Optimized for wedding videos',
        settings: {
          brightness: 0.5,
          contrast: 1.1,
          saturation: 1.1,
          sharpening: 1.1,
          noiseReduction: true,
          autoTone: true
      }
    },
      corporate: {
        name: 'Corporate Video Enhancement',
        description: 'Optimized for corporate videos',
        settings: {
          brightness: 0,
          contrast: 1.5,
          saturation: 1.0,
          sharpening: 1.2,
          noiseReduction: true,
          autoTone: false
      }
    }
  },
    
    batchOperations: {
      enabled: true,
      availableOperations: ['enhance','watermark','compress','convert','metadata'],
      defaultOperations: ['enhance','compress']
  },
    
    analytics: {
      enabled: true,
      trackViews: true,
      trackDownloads: true,
      trackShares: true,
      trackComments: true,
      generateReports: true,
      reportFrequency: 'weekly'
  }
},
  
  music_producer: {
    id: 'music_producer',
    name: 'music_producer',
    displayName: 'Music Producer',
    description: 'Music production and client collaboration',
    icon: 'music_note',
    color: '#9c27b0',
    
    terminology: {
      showcase: 'Musikkgalleri',
      project: 'Låt/Album',
      collection: 'Spilleliste',
      media: 'Musikk',
      portfolio: 'Diskografi',
      client: 'Artist',
      session: 'Innspilling',
      selection: 'Låtvalg',
      proofing: 'Lydbevis',
      delivery: 'Musikkelevering',
      overage: 'Ekstra låter'
  },
    
    settings: {
      defaultFileTypes: ['mp3','wav','flac','aac'],
      supportedFileTypes: ['mp3','wav','flac','aac','ogg','m4a'],
      maxFileSize: 10,
      allowedCategories: ['pop','rock','hip-hop','electronic','classical','jazz'],
      defaultCategories: ['pop','rock','electronic'],
      pricingModel: 'per_package',
      defaultPricing: {
        perPackage: 200,
        overagePrice: 500
    },
      watermarkSettings: {
        enabled: true,
        defaultPosition: 'center',
        defaultOpacity: 0.5,
        defaultSize: 'small'
    }
  },
    
    workflows: {
      clientProofing: {
        enabled: true,
        maxSelections:  15,
        defaultDeadline:  10,
        allowComments: true,
        allowRatings: true,
        allowRevisions: true,
        maxRevisions: 5
    },
      overageManagement: {
        enabled: true,
        defaultLimit:  8,
        defaultPricePerOverage: 50,
        autoDetection: true,
        emailNotifications: true
    },
      sharing: {
        enabled: true,
        defaultEmailTemplate: 'music_showcase',
        allowCustomMessages: true,
        requireApproval: false,
        allowPublicLinks: true
    },
      delivery: {
        enabled: true,
        defaultFormat: ['wav','mp3'],
        allowMultipleFormats: true,
        compressionSettings: {
          enabled: true,
          quality: 30,
          maxResolution: 'CD Quality'
      }
    }
  },
    
    ui: {
      layout: 'list',
      defaultView: 'gallery',
      showMetadata: true,
      showExifData: false,
      showPricing: true,
      showWatermarks: false,
      showRatings: true,
      showComments: true,
      enableLightbox: false,
      enableFullscreen: false,
      enableDownload: true,
      enableShare: true,
      hoverEffects: {
        enabled: true,
        type: 'fade',
        duration: 200
    }
  },
    
    integrations: {
      googlePhotos: {
        enabled: false,
        autoSync: false,
        syncInterval: 60,
        defaultAlbum: 'Music Showcase'
    },
      googleDrive: {
        enabled: true,
        defaultFolder: 'Music Projects',
        autoBackup: true,
        backupInterval: 6
    },
      ai: {
        enabled: true,
        autoTagging: true,
        smartCollections: true,
        duplicateDetection: true,
        faceRecognition: false,
        objectDetection: false
    },
      email: {
        enabled: true,
        defaultProvider: 'gmail',
        templates: {
          sharing: 'music_showcase_template',
          overage: 'music_overage_template',
          delivery: 'music_delivery_template',
          reminder: 'music_reminder_template'
      }
    }
  },
    
    metadataSchema: {
      required: ['title','artistName','recordingDate','duration'],
      optional: ['genre','bpm','key','tags','notes'],
      custom: {
        trackType: { type: 'string', label: 'Track Type' },
        tempo: { type: 'number', label: 'Tempo (BPM)' },
        key: { type: 'string', label: 'Musical Key' },
        instruments: { type: 'array', label: 'Instruments Used' }
    }
  },
    
    enhancementPresets: {
      mastering: {
        name: 'Mastering Enhancement',
        description: 'Optimized for final mastering',
        settings: {
          brightness: 0,
          contrast: 1.2,
          saturation: 1.0,
          sharpening: 1.1,
          noiseReduction: true,
          autoTone: false
      }
    },
      mixing: {
        name: 'Mixing Enhancement',
        description: 'Optimized for mixing',
        settings: {
          brightness: 0.5,
          contrast: 1.1,
          saturation: 1.5,
          sharpening: 1.0,
          noiseReduction: false,
          autoTone: true
      }
    }
  },
    
    batchOperations: {
      enabled: true,
      availableOperations: ['enhance','normalize','convert','metadata'],
      defaultOperations: ['enhance','normalize']
  },
    
    analytics: {
      enabled: true,
      trackViews: true,
      trackDownloads: true,
      trackShares: true,
      trackComments: true,
      generateReports: true,
      reportFrequency: 'monthly'
  }
},
  
  vendor: {
    id: 'vendor',
    name: 'vendor',
    displayName: 'Vendor',
    description: 'Product showcase and inventory management',
    icon: 'store',
    color: '#4caf5',
    
    terminology: {
      showcase: 'Produktgalleri',
      project: 'Produktlinje',
      collection: 'Produktsamling',
      media: 'Produktbilder',
      portfolio: 'Katalog',
      client: 'Kunde',
      session: 'Produksjon',
      selection: 'Produktvalg',
      proofing: 'Produktbevis',
      delivery: 'Produktlevering',
      overage: 'Ekstra produkter'
  },
    
    settings: {
      defaultFileTypes: ['jpg','jpeg','png','webp'],
      supportedFileTypes: ['jpg','jpeg','png','webp','svg','gif'],
      maxFileSize:  25,
      allowedCategories: ['clothing','electronics','home','beauty','sports','automotive'],
      defaultCategories: ['clothing','electronics','home'],
      pricingModel: 'per_package',
      defaultPricing: {
        perPackage: 100,
        overagePrice: 100
    },
      watermarkSettings: {
        enabled: false,
        defaultPosition: 'bottom-right',
        defaultOpacity: 0.5,
        defaultSize: 'small'
    }
  },
    
    workflows: {
      clientProofing: {
        enabled: false,
        maxSelections: 10,
        defaultDeadline:  7,
        allowComments: true,
        allowRatings: false,
        allowRevisions: false,
        maxRevisions: 0
    },
      overageManagement: {
        enabled: false,
        defaultLimit: 10,
        defaultPricePerOverage: 10,
        autoDetection: false,
        emailNotifications: false
    },
      sharing: {
        enabled: true,
        defaultEmailTemplate: 'product_showcase',
        allowCustomMessages: true,
        requireApproval: false,
        allowPublicLinks: true
    },
      delivery: {
        enabled: true,
        defaultFormat: ['jpg','png'],
        allowMultipleFormats: true,
        compressionSettings: {
          enabled: true,
          quality:  85,
          maxResolution: '2K'
      }
    }
  },
    
    ui: {
      layout: 'grid',
      defaultView: 'gallery',
      showMetadata: false,
      showExifData: false,
      showPricing: true,
      showWatermarks: false,
      showRatings: false,
      showComments: false,
      enableLightbox: true,
      enableFullscreen: true,
      enableDownload: false,
      enableShare: true,
      hoverEffects: {
        enabled: true,
        type: 'zoom',
        duration: 300
    }
  },
    
    integrations: {
      googlePhotos: {
        enabled: false,
        autoSync: false,
        syncInterval: 60,
        defaultAlbum: 'Product Showcase'
    },
      googleDrive: {
        enabled: true,
        defaultFolder: 'Product Catalog',
        autoBackup: false,
        backupInterval: 48
    },
      ai: {
        enabled: true,
        autoTagging: true,
        smartCollections: true,
        duplicateDetection: true,
        faceRecognition: false,
        objectDetection: true
    },
      email: {
        enabled: true,
        defaultProvider: 'gmail',
        templates: {
          sharing: 'product_showcase_template',
          overage: 'product_overage_template',
          delivery: 'product_delivery_template',
          reminder: 'product_reminder_template'
      }
    }
  },
    
    metadataSchema: {
      required: ['title','productName','category'],
      optional: ['price','description','tags','notes'],
      custom: {
        productType: { type: 'string', label: 'Product Type' },
        brand: { type: 'string', label: 'Brand' },
        size: { type: 'string', label: 'Size' },
        color: { type: 'string', label: 'Color' },
        material: { type: 'string', label: 'Material' }
    }
  },
    
    enhancementPresets: {
      product: {
        name: 'Product Enhancement',
        description: 'Optimized for product photography',
        settings: {
          brightness: 0.1,
          contrast: 1.1,
          saturation: 1.1,
          sharpening: 1.2,
          noiseReduction: true,
          autoTone: true
      }
    }
  },
    
    batchOperations: {
      enabled: true,
      availableOperations: ['enhance','resize','convert','metadata'],
      defaultOperations: ['enhance','resize']
  },
    
    analytics: {
      enabled: true,
      trackViews: true,
      trackDownloads: false,
      trackShares: true,
      trackComments: false,
      generateReports: true,
      reportFrequency: 'monthly'
  }
}
};

// Profession configuration management functions
export class ProfessionConfigManager {
  private static configs: Map<string, ProfessionConfig> = new Map();
  
  static async loadProfessionConfig(profession: string): Promise<ProfessionConfig> {
    if (this.configs.has(profession)) {
      return this.configs.get(profession)!;
  }
    
    // Try to load from API first
    try {
      const response = await fetch(`/api/profession/config/${profession}`);
      if (response.ok) {
        const config = await response.json();
        this.configs.set(profession, config);
        return config;
    }
  } catch (error) {
      console.warn(`Failed to load profession config from API for ${profession}:`, error);
  }
    
    // Fallback to default config
    const defaultConfig = DEFAULT_PROFESSION_CONFIGS[profession];
    if (!defaultConfig) {
      throw new Error(`No profession configuration found for: ${profession}`);
  }
    
    const config: ProfessionConfig = {
      ...defaultConfig,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      isActive: true,
      isDefault: true
  } as ProfessionConfig;
    
    this.configs.set(profession, config);
    return config;
}
  
  static async saveProfessionConfig(config: ProfessionConfig): Promise<void> {
    try {
      const response = await fetch(`/api/profession/config/${config.id}`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json'
      },
        body: JSON.stringify({
          ...config,
          updatedAt: new Date()
      })
    });
      
      if (!response.ok) {
        throw new Error(`Failed to save profession config: ${response.statusText}`);
    }
      
      this.configs.set(config.id, config);
  } catch (error) {
      console.error('Failed to save profession config:', error);
      throw error;
  }
}
  
  static getProfessionTerminology(profession: string): Record<string, string> {
    const config = this.configs.get(profession);
    return config?.terminology || DEFAULT_PROFESSION_CONFIGS[profession]?.terminology || {};
}
  
  static getProfessionSettings(profession: string): any {
    const config = this.configs.get(profession);
    return config?.settings || DEFAULT_PROFESSION_CONFIGS[profession]?.settings || {};
}
  
  static getProfessionWorkflows(profession: string): any {
    const config = this.configs.get(profession);
    return config?.workflows || DEFAULT_PROFESSION_CONFIGS[profession]?.workflows || {};
}
  
  static getProfessionUI(profession: string): any {
    const config = this.configs.get(profession);
    return config?.ui || DEFAULT_PROFESSION_CONFIGS[profession]?.ui || {};
}
  
  static getProfessionIntegrations(profession: string): any {
    const config = this.configs.get(profession);
    return config?.integrations || DEFAULT_PROFESSION_CONFIGS[profession]?.integrations || {};
}
  
  static clearCache(): void {
    this.configs.clear();
}
}

export default ProfessionConfigManager;
