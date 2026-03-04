/**
 * Dynamic Camera Discovery System
 * Automatically discovers and adds new cameras to the database
 */

import type { VideoCamera } from './video-camera-database';
import { VIDEO_CAMERA_DATABASE } from './video-camera-database';

interface CameraDiscoverySource {
  name: string;
  url: string;
  parser: (data: any) => VideoCamera[];
  lastChecked: Date;
  enabled: boolean;
}

interface CameraDiscoveryConfig {
  autoUpdate: boolean;
  updateInterval: number; // in hours
  sources: CameraDiscoverySource[];
  maxNewCameras: number;
  requireApproval: boolean;
}

// Camera discovery sources
const DISCOVERY_SOURCES: CameraDiscoverySource[] = [
  {
    name: 'Sony Product AP',
    url: 'https://api.sony.com/cameras',
    parser: parseSonyCameras,
    lastChecked: new Date(),
    enabled: true
  },
  {
    name: 'Canon Product AP',
    url: 'https://api.canon.com/cameras',
    parser: parseCanonCameras,
    lastChecked: new Date(),
    enabled: true
  },
  {
    name: 'Panasonic Product AP',
    url: 'https://api.panasonic.com/cameras',
    parser: parsePanasonicCameras,
    lastChecked: new Date(),
    enabled: true
  },
  {
    name: 'Fujifilm Product AP',
    url: 'https://api.fujifilm.com/cameras',
    parser: parseFujifilmCameras,
    lastChecked: new Date(),
    enabled: true
  },
  {
    name: 'Nikon Product AP',
    url: 'https://api.nikon.com/cameras',
    parser: parseNikonCameras,
    lastChecked: new Date(),
    enabled: true
  },
  {
    name: 'Blackmagic Product AP',
    url: 'https://api.blackmagicdesign.com/cameras',
    parser: parseBlackmagicCameras,
    lastChecked: new Date(),
    enabled: true
  },
  {
    name: 'RED Product AP',
    url: 'https://api.red.com/cameras',
    parser: parseREDCameras,
    lastChecked: new Date(),
    enabled: true
,},
  {
    name: 'ARRI Product AP',
    url: 'https://api.arri.com/cameras',
    parser: parseARRICameras,
    lastChecked: new Date(),
    enabled: true
,},
  {
    name: 'DJI Product AP',
    url: 'https://api.dji.com/cameras',
    parser: parseDJICameras,
    lastChecked: new Date(),
    enabled: true
,},
  {
    name: 'Apple Product AP',
    url: 'https://api.apple.com/iphone-cameras',
    parser: parseAppleCameras,
    lastChecked: new Date(),
    enabled: true
,},
  {
    name: 'Samsung Product AP',
    url: 'https://api.samsung.com/galaxy-cameras',
    parser: parseSamsungCameras,
    lastChecked: new Date(),
    enabled: true
,},
  {
    name: 'Leica Product AP',
    url: 'https://api.leica.com/cameras',
    parser: parseLeicaCameras,
    lastChecked: new Date(),
    enabled: true
  }
];

// Parser functions for each brand
function parseSonyCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `sony-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Sony',
    model: camera.model,
    category: camera.category || 'mirrorless',
    logFormats: camera.logFormats || ['S-Log','S-Log3'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'Sony camera with video capabilities',
    features: camera.features || ['4K 60fps','S-Log3'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseCanonCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `canon-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Canon',
    model: camera.model,
    category: camera.category || 'mirrorless',
    logFormats: camera.logFormats || ['C-Log','C-Log2','C-Log3'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['Canon Log','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'Canon camera with video capabilities',
    features: camera.features || ['4K 60fps','C-Log3'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parsePanasonicCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `panasonic-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Panasonic',
    model: camera.model,
    category: camera.category || 'mirrorless',
    logFormats: camera.logFormats || ['V-Log','V-LogL'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'Panasonic camera with video capabilities',
    features: camera.features || ['4K 60fps','V-Log'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseFujifilmCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `fujifilm-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Fujifilm',
    model: camera.model,
    category: camera.category || 'mirrorless',
    logFormats: camera.logFormats || ['F-Log','F-Log2'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'Fujifilm camera with video capabilities',
    features: camera.features || ['4K 60fps','F-Log2'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseNikonCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `nikon-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Nikon',
    model: camera.model,
    category: camera.category || 'mirrorless',
    logFormats: camera.logFormats || ['N-Log'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'Nikon camera with video capabilities',
    features: camera.features || ['4K 60fps','N-Log'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseBlackmagicCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `blackmagic-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Blackmagic',
    model: camera.model,
    category: camera.category || 'cinema',
    logFormats: camera.logFormats || ['BMD Film'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'Blackmagic camera with video capabilities',
    features: camera.features || ['4K 60fps','BMD Film'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseREDCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `red-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'RED',
    model: camera.model,
    category: camera.category || 'cinema',
    logFormats: camera.logFormats || ['RED LogFilm','RED IPP2'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'professional',
    description: camera.description || 'RED camera with video capabilities',
    features: camera.features || ['4K 60fps','RED LogFilm'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseARRICameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `arri-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'ARRI',
    model: camera.model,
    category: camera.category || 'cinema',
    logFormats: camera.logFormats || ['LogC'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'cinema',
    description: camera.description || 'ARRI camera with video capabilities',
    features: camera.features || ['4K 60fps','LogC'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseDJICameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `dji-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'DJI',
    model: camera.model,
    category: camera.category || 'drone',
    logFormats: camera.logFormats || ['D-Log','D-LogM'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['D-Gamut','Rec.709'],
    priceRange: camera.priceRange || 'budget',
    description: camera.description || 'DJI camera with video capabilities',
    features: camera.features || ['4K 60fps','D-Log'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseAppleCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `apple-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Apple',
    model: camera.model,
    category: camera.category || 'phone',
    logFormats: camera.logFormats || ['Apple Log'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'budget',
    description: camera.description || 'Apple camera with video capabilities',
    features: camera.features || ['4K 60fps','Apple Log'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseSamsungCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `samsung-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Samsung',
    model: camera.model,
    category: camera.category || 'phone',
    logFormats: camera.logFormats || ['HDR10'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['S-Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'budget',
    description: camera.description || 'Samsung camera with video capabilities',
    features: camera.features || ['4K 60fps','S-Log'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

function parseLeicaCameras(data: any): VideoCamera[] {
  return data.cameras?.map((camera: any) => ({
    id: `leica-${camera.model.toLowerCase().replace(/\s+/g, '-')}`,
    brand: 'Leica',
    model: camera.model,
    category: camera.category || 'mirrorless',
    logFormats: camera.logFormats || ['Leica Log'],
    resolution: camera.resolution || ['4K','1080p'],
    frameRates: camera.frameRates || ['24fps','25fps','30fps','60fps'],
    colorSpace: camera.colorSpace || ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: camera.priceRange || 'cinema',
    description: camera.description ||'Leica camera with video capabilities',
    features: camera.features || ['4K 60fps','Leica Log'],
    isVideoOptimized: camera.isVideoOptimized || true
  })) || [];
}

// Camera Discovery Service
export class CameraDiscoveryService {
  private config: CameraDiscoveryConfig;
  private discoveredCameras: VideoCamera[] = [];
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CameraDiscoveryConfig> = {}) {
    this.config = {
      autoUpdate: true,
      updateInterval:  24, // 24 hours
      sources: DISCOVERY_SOURCES,
      maxNewCameras:  50,
      requireApproval: true,
      ...config
  };

    if (this.config.autoUpdate) {
      this.startAutoUpdate();
  }
}

  // Start automatic updates
  private startAutoUpdate() {
    this.updateTimer = setInterval(() => {
      this.discoverNewCameras();
  }, this.config.updateInterval * 60 * 60 * 1000); // Convert hours to milliseconds
}

  // Stop automatic updates
  public stopAutoUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
  }
}

  // Discover new cameras from all sources
  public async discoverNewCameras(): Promise<VideoCamera[]> {
    const newCameras: VideoCamera[] = [];
    
    for (const source of this.config.sources) {
      if (!source.enabled) continue;

      try {
        console.log(`🔍 Discovering cameras from ${source.name}...`);
        
        // Fetch data from source
        const response = await fetch(source.url);
        const data = await response.json();
        
        // Parse cameras
        const cameras = source.parser(data);
        
        // Filter out cameras we already have
        const existingModels = VIDEO_CAMERA_DATABASE.map(c => c.model);
        const newCamerasFromSource = cameras.filter(camera => 
          !existingModels.includes(camera.model)
        );

        newCameras.push(...newCamerasFromSource);
        source.lastChecked = new Date();
        
        console.log(`✅ Found ${newCamerasFromSource.length} new cameras from ${source.name}`);
        
    } catch (error) {
        console.error(`❌ Error discovering cameras from ${source.name}:`, error);
    }
  }

    // Limit new cameras
    const limitedNewCameras = newCameras.slice(0, this.config.maxNewCameras);
    this.discoveredCameras = limitedNewCameras;

    return limitedNewCameras;
}

  // Get discovered cameras
  public getDiscoveredCameras(): VideoCamera[] {
    return this.discoveredCameras;
}

  // Approve and add cameras to database
  public approveCameras(cameraIds: string[]): VideoCamera[] {
    const approvedCameras = this.discoveredCameras.filter(camera => 
      cameraIds.includes(camera.id)
    );

    // In a real implementation, this would update the database
    console.log(`✅ Approved ${approvedCameras.length} cameras for database`);
    
    return approvedCameras;
}

  // Reject cameras
  public rejectCameras(cameraIds: string[]): void {
    this.discoveredCameras = this.discoveredCameras.filter(camera => 
      !cameraIds.includes(camera.id)
    );
    
    console.log(`❌ Rejected ${cameraIds.length} cameras`);
}

  // Get discovery statistics
  public getDiscoveryStats() {
    return {
      totalSources: this.config.sources.length,
      enabledSources: this.config.sources.filter(s => s.enabled).length,
      discoveredCameras: this.discoveredCameras.length,
      lastUpdate: new Date(),
      nextUpdate: new Date(Date.now() + this.config.updateInterval * 60 * 60 * 1000)
  ,};
}
}

// Export singleton instance
export const cameraDiscoveryService = new CameraDiscoveryService();

// Export types
export type { CameraDiscoveryConfig, CameraDiscoverySource };














