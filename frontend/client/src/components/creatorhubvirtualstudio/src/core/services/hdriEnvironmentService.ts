/**
 * HDRI Environment Service
 * 
 * Manages HDRI environment maps for realistic lighting and reflections.
 * Provides a curated library of professional HDRI environments.
 */

export interface HDRIEnvironment {
  id: string;
  name: string;
  category: 'studio' | 'outdoor' | 'interior' | 'creative';
  description: string;
  thumbnailUrl: string;
  hdriUrl: string;
  resolution: '1K' | '2K' | '4K' | '8K';
  defaultIntensity: number; // 0-2
  defaultRotation: number; // 0-360 degrees
  tags: string[];
  isPremium: boolean;
  author?: string;
  license?: string;
}

export interface HDRISettings {
  environmentId: string | null;
  intensity: number; // 0-2
  rotation: number; // 0-360 degrees
  blur: number; // 0-1 (for background blur)
  visible: boolean; // Show as background
}

class HDRIEnvironmentService {
  private environments: HDRIEnvironment[] = [];
  private currentSettings: HDRISettings = {
    environmentId: null,
    intensity: 1.0,
    rotation: 0,
    blur: 0,
    visible: true,
  };

  constructor() {
    this.initializeEnvironments();
  }

  /**
   * Initialize curated HDRI library
   */
  private initializeEnvironments(): void {
    this.environments = [
      // Studio Environments
      {
        id: 'studio-soft-white',
        name: 'Studio Soft White',
        category: 'studio',
        description: 'Soft white studio lighting with minimal shadows',
        thumbnailUrl: '/hdri/thumbnails/studio-soft-white.jpg',
        hdriUrl: '/hdri/studio-soft-white.hdr',
        resolution: '2K',
        defaultIntensity: 1.0,
        defaultRotation: 0,
        tags: ['studio','soft','white','portrait'],
        isPremium: false,
      },
      {
        id: 'studio-neutral-gray',
        name: 'Studio Neutral Gray',
        category: 'studio',
        description: 'Neutral gray studio with balanced lighting',
        thumbnailUrl: '/hdri/thumbnails/studio-neutral-gray.jpg',
        hdriUrl: '/hdri/studio-neutral-gray.hdr',
        resolution: '2K',
        defaultIntensity: 0.8,
        defaultRotation: 0,
        tags: ['studio','neutral','gray','product'],
        isPremium: false,
      },
      {
        id: 'studio-warm-sunset',
        name: 'Studio Warm Sunset',
        category: 'studio',
        description: 'Warm sunset tones for golden hour look',
        thumbnailUrl: '/hdri/thumbnails/studio-warm-sunset.jpg',
        hdriUrl: '/hdri/studio-warm-sunset.hdr',
        resolution: '4K',
        defaultIntensity: 1.2,
        defaultRotation: 45,
        tags: ['studio','warm','sunset','golden-hour'],
        isPremium: true,
      },

      // Outdoor Environments
      {
        id: 'outdoor-overcast-sky',
        name: 'Overcast Sky',
        category: 'outdoor',
        description: 'Soft diffused lighting from overcast sky',
        thumbnailUrl: '/hdri/thumbnails/outdoor-overcast-sky.jpg',
        hdriUrl: '/hdri/outdoor-overcast-sky.hdr',
        resolution: '4K',
        defaultIntensity: 1.0,
        defaultRotation: 0,
        tags: ['outdoor','overcast','soft','natural'],
        isPremium: false,
      },
      {
        id: 'outdoor-sunny-day',
        name: 'Sunny Day',
        category: 'outdoor',
        description: 'Bright sunny day with strong directional light',
        thumbnailUrl: '/hdri/thumbnails/outdoor-sunny-day.jpg',
        hdriUrl: '/hdri/outdoor-sunny-day.hdr',
        resolution: '8K',
        defaultIntensity: 1.5,
        defaultRotation: 90,
        tags: ['outdoor','sunny','bright','natural'],
        isPremium: true,
      },

      // Interior Environments
      {
        id: 'interior-window-light',
        name: 'Window Light',
        category: 'interior',
        description: 'Natural window light from large windows',
        thumbnailUrl: '/hdri/thumbnails/interior-window-light.jpg',
        hdriUrl: '/hdri/interior-window-light.hdr',
        resolution: '2K',
        defaultIntensity: 0.9,
        defaultRotation: 180,
        tags: ['interior','window','natural','soft'],
        isPremium: false,
      },

      // Creative Environments
      {
        id: 'creative-neon-city',
        name: 'Neon City',
        category: 'creative',
        description: 'Colorful neon lights for creative looks',
        thumbnailUrl: '/hdri/thumbnails/creative-neon-city.jpg',
        hdriUrl: '/hdri/creative-neon-city.hdr',
        resolution: '4K',
        defaultIntensity: 1.3,
        defaultRotation: 270,
        tags: ['creative','neon','colorful','urban'],
        isPremium: true,
      },
    ];
  }

  /**
   * Get all HDRI environments
   */
  getAllEnvironments(): HDRIEnvironment[] {
    return this.environments;
  }

  /**
   * Get environments by category
   */
  getEnvironmentsByCategory(category: HDRIEnvironment['category']): HDRIEnvironment[] {
    return this.environments.filter((env) => env.category === category);
  }

  /**
   * Get environment by ID
   */
  getEnvironment(id: string): HDRIEnvironment | null {
    return this.environments.find((env) => env.id === id) || null;
  }

  /**
   * Search environments by tags or name
   */
  searchEnvironments(query: string): HDRIEnvironment[] {
    const lowerQuery = query.toLowerCase();
    return this.environments.filter(
      (env) =>
        env.name.toLowerCase().includes(lowerQuery) ||
        env.description.toLowerCase().includes(lowerQuery) ||
        env.tags.some((tag) => tag.includes(lowerQuery))
    );
  }

  /**
   * Get current HDRI settings
   */
  getCurrentSettings(): HDRISettings {
    return { ...this.currentSettings };
  }

  /**
   * Update HDRI settings
   */
  updateSettings(settings: Partial<HDRISettings>): HDRISettings {
    this.currentSettings = { ...this.currentSettings, ...settings };
    return this.getCurrentSettings();
  }

  /**
   * Load an HDRI environment
   */
  loadEnvironment(environmentId: string): HDRISettings {
    const env = this.getEnvironment(environmentId);
    if (!env) {
      throw new Error(`HDRI environment not found: ${environmentId}`);
    }

    this.currentSettings = {
      environmentId,
      intensity: env.defaultIntensity,
      rotation: env.defaultRotation,
      blur: 0,
      visible: true,
    };

    return this.getCurrentSettings();
  }

  /**
   * Clear current environment
   */
  clearEnvironment(): void {
    this.currentSettings = {
      environmentId: null,
      intensity: 1.0,
      rotation: 0,
      blur: 0,
      visible: true,
    };
  }
}

export const hdriEnvironmentService = new HDRIEnvironmentService();

