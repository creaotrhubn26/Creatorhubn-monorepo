/**
 * Pricing Import Service
 * Imports recommended pricing from Creo and NJ for Norwegian creatives
 */

export interface PricingRecommendation {
  id: string;
  category: string;
  name: string;
  description: string;
  minPrice: number;
  maxPrice: number;
  recommendedPrice: number;
  unit: string; // 'per hour', 'per day','per project','per photo', etc.
  source: 'creo' | 'nj';
  profession: 'photographer' | 'videographer' | 'music_producer';
  notes?: string;
  lastUpdated: string;
}

/**
 * Creo (Forbundet for kunst og kultur) pricing recommendations
 * Based on industry standards for creative professionals in Norway
 */
const CREO_PRICING: Record<string, PricingRecommendation[]> = {
  photographer: [
    {
      id: 'creo-photo-hourly',
      category: 'Timebasert',
      name: 'Timepris fotografering',
      description: 'Standard timepris for profesjonell fotografering',
      minPrice: 1200,
      maxPrice: 2500,
      recommendedPrice: 1800,
      unit: 'per time',
      source: 'creo',
      profession: 'photographer',
      notes: 'Inkluderer fotografering, ikke redigering',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-photo-wedding',
      category: 'Bryllup',
      name: 'Bryllupsfotografering heldag',
      description: 'Full bryllupsdag (10-12 timer)',
      minPrice: 15000,
      maxPrice: 35000,
      recommendedPrice: 25000,
      unit: 'per dag',
      source: 'creo',
      profession: 'photographer',
      notes: 'Inkluderer fotografering, redigering og leveranse av 300-500 bilder',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-photo-portrait',
      category: 'Portrett',
      name: 'Portrettfotografering',
      description: 'Standard portrettsesjon (1-2 timer)',
      minPrice: 2500,
      maxPrice: 6000,
      recommendedPrice: 4000,
      unit: 'per sesjon',
      source: 'creo',
      profession: 'photographer',
      notes: 'Inkluderer 10-20 redigerte bilder',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-photo-commercial',
      category: 'Kommersielt',
      name: 'Kommersiell fotografering',
      description: 'Kommersielt oppdrag (bedrift, produkt, marked)',
      minPrice: 3000,
      maxPrice: 8000,
      recommendedPrice: 5000,
      unit: 'per halvdag',
      source: 'creo',
      profession: 'photographer',
      notes: 'Pris avhenger av bruksrettigheter og omfang',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-photo-editing',
      category: 'Redigering',
      name: 'Bilderedigering',
      description: 'Profesjonell bilderedigering',
      minPrice: 150,
      maxPrice: 500,
      recommendedPrice: 250,
      unit: 'per bilde',
      source: 'creo',
      profession: 'photographer',
      notes: 'Avansert retusjering og fargekorrigering',
      lastUpdated: '2025-01-01',
    },
  ],
  videographer: [
    {
      id: 'creo-video-hourly',
      category: 'Timebasert',
      name: 'Timepris video',
      description: 'Standard timepris for videoproduksjon',
      minPrice: 1500,
      maxPrice: 3000,
      recommendedPrice: 2000,
      unit: 'per time',
      source: 'creo',
      profession: 'videographer',
      notes: 'Inkluderer filming, ikke redigering',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-video-wedding',
      category: 'Bryllup',
      name: 'Bryllupsvideo heldag',
      description: 'Full bryllupsdag med video (10-12 timer)',
      minPrice: 20000,
      maxPrice: 45000,
      recommendedPrice: 32000,
      unit: 'per dag',
      source: 'creo',
      profession: 'videographer',
      notes: 'Inkluderer filming, redigering og ferdig video (10-20 min)',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-video-commercial',
      category: 'Kommersielt',
      name: 'Kommersiell video',
      description: 'Bedriftsvideo eller reklamevideo',
      minPrice: 15000,
      maxPrice: 50000,
      recommendedPrice: 30000,
      unit: 'per prosjekt',
      source: 'creo',
      profession: 'videographer',
      notes: 'Pris avhenger av lengde, kompleksitet og bruksrettigheter',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-video-editing',
      category: 'Redigering',
      name: 'Videoredigering',
      description: 'Profesjonell videoredigering',
      minPrice: 800,
      maxPrice: 2000,
      recommendedPrice: 1200,
      unit: 'per time',
      source: 'creo',
      profession: 'videographer',
      notes: 'Inkluderer klipp, fargekorrigering, lyd og grafikk',
      lastUpdated: '2025-01-01',
    },
  ],
  music_producer: [
    {
      id: 'creo-music-hourly',
      category: 'Timebasert',
      name: 'Timepris studio',
      description: 'Standard timepris for studioarbeid',
      minPrice: 800,
      maxPrice: 2000,
      recommendedPrice: 1200,
      unit: 'per time',
      source: 'creo',
      profession: 'music_producer',
      notes: 'Inkluderer studio og produsent',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-music-production',
      category: 'Produksjon',
      name: 'Låtproduksjon',
      description: 'Full produksjon av én låt',
      minPrice: 5000,
      maxPrice: 20000,
      recommendedPrice: 12000,
      unit: 'per låt',
      source: 'creo',
      profession: 'music_producer',
      notes: 'Inkluderer opptak, produksjon, mixing og mastering',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-music-mixing',
      category: 'Mixing',
      name: 'Mixing',
      description: 'Profesjonell mixing av én låt',
      minPrice: 2000,
      maxPrice: 8000,
      recommendedPrice: 4000,
      unit: 'per låt',
      source: 'creo',
      profession: 'music_producer',
      notes: 'Kun mixing, ikke mastering',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'creo-music-mastering',
      category: 'Mastering',
      name: 'Mastering',
      description: 'Profesjonell mastering av én låt',
      minPrice: 1000,
      maxPrice: 3000,
      recommendedPrice: 1800,
      unit: 'per låt',
      source: 'creo',
      profession: 'music_producer',
      notes: 'Mastering for digital og fysisk distribusjon',
      lastUpdated: '2025-01-01',
    },
  ],
};

/**
 * NJ (Norsk Journalistlag) pricing recommendations
 * Primarily for journalists/photographers working in media
 */
const NJ_PRICING: Record<string, PricingRecommendation[]> = {
  photographer: [
    {
      id: 'nj-photo-day-rate',
      category: 'Dagssats',
      name: 'Dagssats frilans fotograf',
      description: 'Standard dagssats for frilans fotojournalist',
      minPrice: 3500,
      maxPrice: 6000,
      recommendedPrice: 4500,
      unit: 'per dag',
      source: 'nj',
      profession: 'photographer',
      notes: 'Basert på NJs minstesatser for frilansere',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'nj-photo-assignment',
      category: 'Oppdrag',
      name: 'Fotojournalistisk oppdrag',
      description: 'Enkeltstående oppdrag for media',
      minPrice: 1500,
      maxPrice: 4000,
      recommendedPrice: 2500,
      unit: 'per oppdrag',
      source: 'nj',
      profession: 'photographer',
      notes: 'Avhenger av kompleksitet og tidsbruk',
      lastUpdated: '2025-01-01',
    },
    {
      id: 'nj-photo-usage-rights',
      category: 'Bruksrettigheter',
      name: 'Tilleggsbruk av bilder',
      description: 'Ekstrabetaling for utvidet bruk',
      minPrice: 500,
      maxPrice: 3000,
      recommendedPrice: 1200,
      unit: 'per bilde',
      source: 'nj',
      profession: 'photographer',
      notes: 'Ved bruk utover opprinnelig avtale',
      lastUpdated: '2025-01-01',
    },
  ],
  videographer: [
    {
      id: 'nj-video-day-rate',
      category: 'Dagssats',
      name: 'Dagssats frilans videojournalist',
      description: 'Standard dagssats for frilans videojournalist',
      minPrice: 4000,
      maxPrice: 7000,
      recommendedPrice: 5500,
      unit: 'per dag',
      source: 'nj',
      profession: 'videographer',
      notes: 'Basert på NJs minstesatser for frilansere',
      lastUpdated: '2025-01-01',
    },
  ],
  music_producer: [],
};

export class PricingImportService {
  /**
   * Get all pricing recommendations for a profession from a source
   */
  static getPricingRecommendations(
    profession: 'photographer' | 'videographer' | 'music_producer',
    source: 'creo' | 'nj',
  ): PricingRecommendation[] {
    const pricingData = source === 'creo' ? CREO_PRICING : NJ_PRICING;
    return pricingData[profession] || [];
  }

  /**
   * Get all available sources for a profession
   */
  static getAvailableSources(
    profession: 'photographer' | 'videographer' | 'music_producer',
  ): Array<'creo' | 'nj'> {
    const sources: Array<'creo' | 'nj'> = [];

    if (CREO_PRICING[profession]?.length > 0) {
      sources.push('creo');
    }

    if (NJ_PRICING[profession]?.length > 0) {
      sources.push('nj');
    }

    return sources;
  }

  /**
   * Get categories for a profession and source
   */
  static getCategories(
    profession: 'photographer' | 'videographer' | 'music_producer',
    source: 'creo' | 'nj',
  ): string[] {
    const recommendations = this.getPricingRecommendations(profession, source);
    const categories = new Set(recommendations.map((r) => r.category));
    return Array.from(categories);
  }

  /**
   * Format currency in NOK
   */
  static formatPrice(amount: number): string {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Get source display name
   */
  static getSourceName(source: 'creo' | 'nj'): string {
    return source === 'creo' ? 'Creo - Forbundet for kunst og kultur' : 'NJ - Norsk Journalistlag';
  }

  /**
   * Get source URL
   */
  static getSourceUrl(source: 'creo' | 'nj'): string {
    return source === 'creo' ? 'https://creokultur.no/' : 'https://www.nj.no/';
  }
}
