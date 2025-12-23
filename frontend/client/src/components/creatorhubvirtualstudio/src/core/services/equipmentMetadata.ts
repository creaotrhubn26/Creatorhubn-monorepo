/**
 * Equipment Metadata Service
 * 
 * Stores physical specifications and metadata for all lighting equipment brands
 */

export interface EquipmentMetadata {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category: 'strobe' | 'continuous' | 'modifier' | 'accessory';
  
  // Physical specifications
  specifications: {
    wattage?: number; // Electrical power (W)
    output?: number; // Light output (Ws or lumens)
    colorTemperature?: number; // Kelvin
    colorRenderingIndex?: number; // CRI (0-100)
    beamAngle?: number; // Degrees
    weight?: number; // kg
    dimensions?: {
      width: number;
      height: number;
      depth: number;
    };
  };
  
  // Photometric data
  photometric?: {
    efficacy?: number; // lm/W
    maxLumens?: number;
    candela?: number;
  };
  
  // Modifier compatibility
  compatibleModifiers?: string[];
  
  // Pricing (optional)
  pricing?: {
    msrp?: number;
    currency?: string;
  };
}

export class EquipmentMetadataService {
  private metadata: Map<string, EquipmentMetadata> = new Map();
  
  constructor() {
    this.initializeMetadata();
  }
  
  /**
   * Initialize with common equipment metadata
   */
  private initializeMetadata(): void {
    // Profoto
    this.addMetadata({
      id: 'profoto_d1_500',
      name: 'Profoto D1 500',
      manufacturer: 'Profoto',
      model: 'D1 500 AirTTL',
      category: 'strobe',
      specifications: {
        wattage: 500,
        output: 500,
        colorTemperature: 5600,
        colorRenderingIndex: 95,
        beamAngle: 60,
        weight: 2.1,
        dimensions: { width: 0.15, height: 0.25, depth: 0.15 },
      },
      photometric: {
        efficacy: 80,
        maxLumens: 40000,
      },
      compatibleModifiers: ['softbox', 'umbrella', 'beauty_dish', 'snoot'],
    });
    
    // Broncolor
    this.addMetadata({
      id: 'broncolor_scoro_a4',
      name: 'Broncolor Scoro A4',
      manufacturer: 'Broncolor',
      model: 'Scoro A4S',
      category: 'strobe',
      specifications: {
        wattage: 4000,
        output: 4000,
        colorTemperature: 5600,
        colorRenderingIndex: 98,
        beamAngle: 55,
        weight: 8.5,
        dimensions: { width: 0.35, height: 0.25, depth: 0.25 },
      },
      photometric: {
        efficacy: 90,
        maxLumens: 45000,
      },
    });
    
    // Elinchrom
    this.addMetadata({
      id: 'elinchrom_d_lite_rx_4',
      name: 'Elinchrom D-Lite RX 4',
      manufacturer: 'Elinchrom',
      model: 'D-Lite RX 4',
      category: 'strobe',
      specifications: {
        wattage: 400,
        output: 400,
        colorTemperature: 5600,
        colorRenderingIndex: 92,
        beamAngle: 70,
        weight: 1.8,
        dimensions: { width: 0.14, height: 0.22, depth: 0.14 },
      },
      photometric: {
        efficacy: 88,
        maxLumens: 35000,
      },
    });
    
    // Godox
    this.addMetadata({
      id: 'godox_ad600',
      name: 'Godox AD600',
      manufacturer: 'Godox',
      model: 'AD600',
      category: 'strobe',
      specifications: {
        wattage: 600,
        output: 600,
        colorTemperature: 5600,
        colorRenderingIndex: 90,
        beamAngle: 60,
        weight: 2.3,
        dimensions: { width: 0.16, height: 0.28, depth: 0.16 },
      },
      photometric: {
        efficacy: 70,
        maxLumens: 42000,
      },
    });
    
    // Modifiers
    this.addMetadata({
      id: 'softbox_60x60',
      name: 'Softbox 60x60cm',
      manufacturer: 'Generic',
      model: 'Softbox 60x60',
      category: 'modifier',
      specifications: {
        dimensions: { width: 0.6, height: 0.6, depth: 0.3 },
        weight: 0.8,
      },
    });
    
    this.addMetadata({
      id: 'beauty_dish_50',
      name: 'Beauty Dish 50cm',
      manufacturer: 'Generic',
      model: 'Beauty Dish 50',
      category: 'modifier',
      specifications: {
        dimensions: { width: 0.5, height: 0.5, depth: 0.15 },
        weight: 0.5,
      },
    });
  }
  
  /**
   * Add equipment metadata
   */
  addMetadata(metadata: EquipmentMetadata): void {
    this.metadata.set(metadata.id, metadata);
  }
  
  /**
   * Get metadata by ID
   */
  getMetadata(id: string): EquipmentMetadata | undefined {
    return this.metadata.get(id);
  }
  
  /**
   * Get all metadata
   */
  getAllMetadata(): EquipmentMetadata[] {
    return Array.from(this.metadata.values());
  }
  
  /**
   * Get metadata by manufacturer
   */
  getMetadataByManufacturer(manufacturer: string): EquipmentMetadata[] {
    return Array.from(this.metadata.values()).filter(
      (m) => m.manufacturer.toLowerCase() === manufacturer.toLowerCase()
    );
  }
  
  /**
   * Get metadata by category
   */
  getMetadataByCategory(category: EquipmentMetadata['category']): EquipmentMetadata[] {
    return Array.from(this.metadata.values()).filter((m) => m.category === category);
  }
  
  /**
   * Search metadata
   */
  searchMetadata(query: string): EquipmentMetadata[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.metadata.values()).filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.model.toLowerCase().includes(lowerQuery) ||
        m.manufacturer.toLowerCase().includes(lowerQuery)
    );
  }
}

// Export singleton instance
export const equipmentMetadataService = new EquipmentMetadataService();


