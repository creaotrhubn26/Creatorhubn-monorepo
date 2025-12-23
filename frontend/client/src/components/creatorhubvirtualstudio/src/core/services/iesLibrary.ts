/**
 * IES Profile Library
 * 
 * Extended library of IES profiles for major lighting manufacturers
 * Supports Profoto, Broncolor, Elinchrom, Godox, and more
 */

import { IESProfile } from './ies';
import { logger } from './logger';

const log = logger.module('IESLibrary');

export interface IESLibraryEntry {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category: 'studio' | 'portable' | 'continuous' | 'strobe';
  beamAngle?: number;
  description?: string;
  filePath?: string; // Path to IES file if available
  metadata?: {
    lumens?: number;
    wattage?: number;
    colorTemperature?: number;
  };
}

export class IESLibrary {
  private profiles: Map<string, IESLibraryEntry> = new Map();
  
  constructor() {
    this.initializeLibrary();
  }
  
  /**
   * Initialize library with common IES profiles
   */
  private initializeLibrary(): void {
    // Profoto
    this.addProfile({
      id: 'profoto_d1_500',
      name: 'Profoto D1 500',
      manufacturer: 'Profoto',
      model: 'D1 500',
      category: 'studio',
      beamAngle: 60,
      description: 'Profoto D1 500 AirTTL studio strobe',
      metadata: {
        lumens: 40000,
        wattage: 500,
        colorTemperature: 5600,
      },
    });
    
    this.addProfile({
      id: 'profoto_b1',
      name: 'Profoto B1',
      manufacturer: 'Profoto',
      model: 'B1',
      category: 'portable',
      beamAngle: 65,
      description: 'Profoto B1 portable battery strobe',
      metadata: {
        lumens: 50000,
        wattage: 500,
        colorTemperature: 5600,
      },
    });
    
    // Broncolor
    this.addProfile({
      id: 'broncolor_scoro_a4',
      name: 'Broncolor Scoro A4',
      manufacturer: 'Broncolor',
      model: 'Scoro A4',
      category: 'studio',
      beamAngle: 55,
      description: 'Broncolor Scoro A4S studio pack',
      metadata: {
        lumens: 45000,
        wattage: 4000,
        colorTemperature: 5600,
      },
    });
    
    // Elinchrom
    this.addProfile({
      id: 'elinchrom_d_lite_rx_4',
      name: 'Elinchrom D-Lite RX 4',
      manufacturer: 'Elinchrom',
      model: 'D-Lite RX 4',
      category: 'studio',
      beamAngle: 70,
      description: 'Elinchrom D-Lite RX 4 studio strobe',
      metadata: {
        lumens: 35000,
        wattage: 400,
        colorTemperature: 5600,
      },
    });
    
    // Godox
    this.addProfile({
      id: 'godox_ad600',
      name: 'Godox AD600',
      manufacturer: 'Godox',
      model: 'AD600',
      category: 'portable',
      beamAngle: 60,
      description: 'Godox AD600 portable strobe',
      metadata: {
        lumens: 42000,
        wattage: 600,
        colorTemperature: 5600,
      },
    });
    
    this.addProfile({
      id: 'godox_v1',
      name: 'Godox V1',
      manufacturer: 'Godox',
      model: 'V1',
      category: 'portable',
      beamAngle: 75,
      description: 'Godox V1 speedlight',
      metadata: {
        lumens: 8000,
        wattage: 76,
        colorTemperature: 5600,
      },
    });
    
    // Generic profiles
    this.addProfile({
      id: 'generic_softbox_60',
      name: 'Generic Softbox 60cm',
      manufacturer: 'Generic',
      model: 'Softbox 60cm',
      category: 'studio',
      beamAngle: 90,
      description: 'Generic 60cm softbox modifier',
    });
    
    this.addProfile({
      id: 'generic_spot_10',
      name: 'Generic Spot 10°',
      manufacturer: 'Generic',
      model: 'Spot 10°',
      category: 'studio',
      beamAngle: 10,
      description: 'Generic 10 degree spot modifier',
    });
  }
  
  /**
   * Add a profile to the library
   */
  addProfile(profile: IESLibraryEntry): void {
    this.profiles.set(profile.id, profile);
  }
  
  /**
   * Get profile by ID
   */
  getProfile(id: string): IESLibraryEntry | undefined {
    return this.profiles.get(id);
  }
  
  /**
   * Get all profiles
   */
  getAllProfiles(): IESLibraryEntry[] {
    return Array.from(this.profiles.values());
  }
  
  /**
   * Get profiles by manufacturer
   */
  getProfilesByManufacturer(manufacturer: string): IESLibraryEntry[] {
    return Array.from(this.profiles.values()).filter(
      (p) => p.manufacturer.toLowerCase() === manufacturer.toLowerCase()
    );
  }
  
  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: IESLibraryEntry['category']): IESLibraryEntry[] {
    return Array.from(this.profiles.values()).filter((p) => p.category === category);
  }
  
  /**
   * Search profiles by name or model
   */
  searchProfiles(query: string): IESLibraryEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.profiles.values()).filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.model.toLowerCase().includes(lowerQuery) ||
        p.manufacturer.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Load IES file and add to library
   */
  async loadIESFile(filePath: string, entry: Omit<IESLibraryEntry, 'filePath'>): Promise<boolean> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to load IES file: ${response.statusText}`);
      }
      
      const text = await response.text();
      // Parse IES file would go here
      // For now, just add the entry
      this.addProfile({
        ...entry,
        filePath,
      });
      
      return true;
    } catch (error) {
      log.error(`Failed to load IES file ${filePath}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const iesLibrary = new IESLibrary();


