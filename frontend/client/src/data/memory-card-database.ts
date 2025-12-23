/**
 * CreatorHub Norge - Enhanced Memory Card Database
 * Camera-aware memory card recommendations based on selected cameras
 * Supports NOK pricing and currency conversion
 */

// Import client service pricing service
import { clientServicePricingService, type Currency } from '../services/ClientServicePricingService';

// Currency conversion rates - now connected to centralized pricing system
export const CURRENCY_RATES = {
  // Base rates (NOK = 1.0) - fallback values, will be overridden by centralized service
  NOK_TO_NOK: 1.0,
  NOK_TO_SEK: 1.05, // 1 NOK = 1.05 SEK
  NOK_TO_DKK: 0.75, // 1 NOK = 0.75 DKK
  NOK_TO_USD: 0.095, // 1 NOK = 0.095 USD
  
  // Inverse rates
  SEK_TO_NOK: 0.95, // 1 SEK = 0.95 NOK
  DKK_TO_NOK: 1.33, // 1 DKK = 1.33 NOK
  USD_TO_NOK: 10.5, // 1 USD = 10.5 NOK
  
  // Cross rates
  SEK_TO_DKK: 0.71, // 1 SEK = 0.71 DKK
  DKK_TO_SEK: 1.40, // 1 DKK = 1.40 SEK
  SEK_TO_USD: 0.090, // 1 SEK = 0.090 USD
  DKK_TO_USD: 0.127, // 1 DKK = 0.127 USD
};

// Supported currencies
export type Currency = 'NOK' | 'SEK' | 'DKK' | 'USD';

// Currency conversion utilities - now using centralized pricing service
export const convertCurrency = async (amount: number, from: Currency, to: Currency): Promise<number> => {
  try {
    // Use client service pricing service for currency conversion
    return await clientServicePricingService.convertCurrency(amount, from, to);
} catch (error) {
    console.warn('Failed to use centralized currency conversion, using fallback: ', error);
    
    // Fallback to hardcoded conversion
    if (from === to) return amount;
    
    let amountInNOK = amount;
    switch (from) {
      case 'NOK': amountInNOK = amount; break;
      case 'SEK': amountInNOK = amount * CURRENCY_RATES.SEK_TO_NOK; break;
      case 'DKK': amountInNOK = amount * CURRENCY_RATES.DKK_TO_NOK; break;
      case 'USD': amountInNOK = amount * CURRENCY_RATES.USD_TO_NOK; break;
}
    
    switch (to) {
      case 'NOK': return Math.round(amountInNOK * 100) / 100;
      case 'SEK': return Math.round(amountInNOK * CURRENCY_RATES.NOK_TO_SEK * 100) / 100;
      case 'DKK': return Math.round(amountInNOK * CURRENCY_RATES.NOK_TO_DKK * 100) / 100;
      case 'USD': return Math.round(amountInNOK * CURRENCY_RATES.NOK_TO_USD * 100) / 100;
      default: return amountInNOK;
}
}
};

export const formatCurrency = (amount: number, currency: Currency): string => {
  try {
    // Use client service pricing service for currency formatting
    return clientServicePricingService.formatCurrency(amount, currency);
} catch (error) {
    console.warn('Failed to use centralized currency formatting, using fallback:', error);
    
    // Fallback to hardcoded formatting
    switch (currency) {
      case 'NOK':
        return `${Math.round(amount)} NOK`;
      case 'SEK':
        return `${Math.round(amount)} SEK`;
      case 'DKK':
        return `${Math.round(amount)} DKK`;
      case 'USD':
        return `$${amount.toFixed(2)}`;
      default: return `${Math.round(amount)} ${currency}`;
}
}
};

// Get Scandinavian currency references - now using centralized pricing service
export const getScandinavianReferences = async (amountNOK: number) => {
  try {
    const [sekAmount, dkkAmount, usdAmount] = await Promise.all([
      convertCurrency(amountNOK, 'NOK','SEK'),
      convertCurrency(amountNOK, 'NOK','DKK'),
      convertCurrency(amountNOK, 'NOK','USD')
    ]);

    return {
      NOK: formatCurrency(amountNOK, 'NOK'),
      SEK: formatCurrency(sekAmount, 'SEK'),
      DKK: formatCurrency(dkkAmount, 'DKK'),
      USD: formatCurrency(usdAmount, 'USD')
};
} catch (error) {
    console.warn('Failed to get Scandinavian currency references:', error);
    
    // Fallback to hardcoded conversion
    return {
      NOK: formatCurrency(amountNOK, 'NOK'),
      SEK: formatCurrency(amountNOK * CURRENCY_RATES.NOK_TO_SEK, 'SEK'),
      DKK: formatCurrency(amountNOK * CURRENCY_RATES.NOK_TO_DKK, 'DKK'),
      USD: formatCurrency(amountNOK * CURRENCY_RATES.NOK_TO_USD, 'USD')
};
}
};

export interface MemoryCardType {
  id: string;
  name: string;
  fullName: string;
  category: 'SD' | 'CF' | 'XQD' | 'CFexpress' | 'microSD';
  subType?: string; // e.., 'Type A','Type B' for CFexpress
  maxCapacity: string;
  commonCapacities: string[];
  readSpeed: number; // MB/s
  writeSpeed: number; // MB/s
  videoClass?: string; // V0, V60, V90, etc.
  uhsClass?: string; // UHS-I, UHS-II, UHS-III
  profession: 'photographer' | 'videographer' | 'both';
  cameraCompatibility: string[]; // Camera brands/models that support this card type
  recommendedFor: string[]; // Use cases
  priceRange: 'budget' | 'mid' | 'premium' | 'professional';
  reliability: 'good' | 'excellent' | 'professional';
  description: string;
  icon: string;
  color: string;
  // Pricing in NOK
  pricePerGB: {
    budget: number; // NOK per GB
   mid: number;
   premium: number;
   professional: number;
  };
}

export interface MemoryCardRecommendation {
  cardType: MemoryCardType;
  capacity: string;
  quantity: number;
  reasoning: string;
  priority: 'essential' | 'recommended' | 'optional';
  estimatedCost: number;
  estimatedCostNOK: number;
  currency: Currency;
  scandinavianReferences: {
    NOK: string;
    SEK: string;
    DKK: string;
    USD: string;
  };
}

export interface CameraMemoryCardCompatibility {
  cameraId: string;
  cameraBrand: string;
  cameraModel: string;
  supportedCardTypes: string[];
  recommendedCardTypes: string[];
  maxCapacity: Record<string, string>; // cardType -> maxCapacity
  dualSlot: boolean;
  slot1Type: string;
  slot2Type?: string;
  simultaneousRecording: boolean;
  backupMode: boolean;
  profession: 'photographer' | 'videographer' | 'both';
}

// Memory Card Types Database
export const MEMORY_CARD_TYPES: MemoryCardType[] = [
  // SD Cards
  {
    id: 'sd-standard',
    name: 'S',
    fullName: 'Secure Digital',
    category: 'S',
    maxCapacity: '2G',
    commonCapacities: ['512M','1GB','2GB'],
    readSpeed:  25,
    writeSpeed:  10,
    profession: 'photographer',
    cameraCompatibility: ['canon','nikon','sony','panasonic','olympus'],
    recommendedFor: ['basic-photography','backup'],
    priceRange: 'budget',
    reliability: 'good',
    description: 'Standard SD card for basic photography needs',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5, // ~$0.50/GB in NOK
      mid: 10.0,   // ~$1.00/GB in NOK
      premium: 21.0, // ~$2.00/GB in NOK
      professional: 42.00 // ~$4.00/GB in NOK
  }
},
  {
    id: 'sd-hc',
    name: 'SDH',
    fullName: 'Secure Digital High Capacity',
    category: 'S',
    maxCapacity: '32G',
    commonCapacities: ['4G','8GB','16GB','32GB'],
    readSpeed:  25,
    writeSpeed:  10,
    videoClass: 'V1',
    profession: 'photographer',
    cameraCompatibility: ['canon','nikon','sony','panasonic','olympus','fujifilm'],
    recommendedFor: ['photography','basic-video'],
    priceRange: 'budget',
    reliability: 'good',
    description: 'High capacity SD card for photography and basic video',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},
  {
    id: 'sd-xc',
    name: 'SDX',
    fullName: 'Secure Digital eXtended Capacity',
    category: 'S',
    maxCapacity: '2T',
    commonCapacities: ['64G','128GB','256GB','512GB','1TB'],
    readSpeed:  95,
    writeSpeed:  90,
    videoClass: 'V9',
    uhsClass: 'UHS-I',
    profession: 'both',
    cameraCompatibility: ['canon','nikon','sony','panasonic','olympus','fujifilm','leica'],
    recommendedFor: ['high-resolution-photography','4k-video','burst-photography'],
    priceRange: 'premium',
    reliability: 'excellent',
    description: 'Extended capacity SD card for high-resolution photography and 4K video',
    icon: '�, �, ',
    color: '#4caf50',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},
  {
    id: 'sd-xc-uhs-ii',
    name: 'SDXC UHS-I',
    fullName: 'SDXC Ultra High Speed I',
    category: 'S',
    maxCapacity: '2T',
    commonCapacities: ['64G','128GB','256GB','512GB','1TB'],
    readSpeed: 30,
    writeSpeed: 20,
    videoClass: 'V9',
    uhsClass: 'UHS-I',
    profession: 'both',
    cameraCompatibility: ['sony','panasonic','olympus','fujifilm','leica'],
    recommendedFor: ['professional-photography','4k-video','8k-video','burst-photography'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'Ultra high speed SD card for professional photography and video',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},

  // CF Cards
  {
    id: 'cf-type-',
    name: 'CF Type ',
    fullName: 'CompactFlash Type ',
    category: 'C',
    maxCapacity: '512G',
    commonCapacities: ['32G','64GB','128GB','256GB','512GB'],
    readSpeed: 17,
    writeSpeed: 10,
    profession: 'photographer',
    cameraCompatibility: ['canon','nikon'],
    recommendedFor: ['professional-photography','high-resolution'],
    priceRange: 'premium',
    reliability: 'excellent',
    description: 'CompactFlash card for professional photography',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},

  // XQD Cards
  {
    id: 'xqd',
    name: 'XQ',
    fullName: 'XQD Memory Card',
    category: 'XQ',
    maxCapacity: '1T',
    commonCapacities: ['32G','64GB','128GB','256GB','512GB','1TB'],
    readSpeed: 40,
    writeSpeed: 40,
    profession: 'both',
    cameraCompatibility: ['sony','nikon'],
    recommendedFor: ['professional-video','4k-video','8k-video','high-speed-photography'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'XQD card for professional video and high-speed photography',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},

  // CFexpress Cards
  {
    id: 'cfexpress-type-',
    name: 'CFexpress Type ',
    fullName: 'CFexpress Type ',
    category: 'CFexpress',
    subType: 'Type',
    maxCapacity: '1T',
    commonCapacities: ['80G','160GB','320GB','640GB','1TB'],
    readSpeed: 80,
    writeSpeed: 70,
    profession: 'both',
    cameraCompatibility: [', '],
    recommendedFor: ['professional-video','8k-video','high-speed-photography','ai-features'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'CFexpress Type A for Sony cameras with advanced features',
    icon: '�, �, ',
    color: '#e91e63',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},
  {
    id: 'cfexpress-type-',
    name: 'CFexpress Type ',
    fullName: 'CFexpress Type ',
    category: 'CFexpress',
    subType: 'Type',
    maxCapacity: '2T',
    commonCapacities: ['128G','256GB','512GB','1TB','2TB'],
    readSpeed: 170,
    writeSpeed: 150,
    profession: 'both',
    cameraCompatibility: ['canon','nikon','panasonic','red','blackmagic'],
    recommendedFor: ['professional-video','8k-video','raw-video','cinema'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'CFexpress Type B for professional cinema and video production',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
},

  // microSD Cards
  {
    id: 'microsd',
    name: 'microS',
    fullName: 'microS',
    category: 'microS',
    maxCapacity: '1T',
    commonCapacities: ['32G','64GB','128GB','256GB','512GB','1TB'],
    readSpeed: 10,
    writeSpeed:  90,
    videoClass: 'V3',
    profession: 'both',
    cameraCompatibility: ['dji','gopro','action-cameras'],
    recommendedFor: ['drones','action-cameras','backup'],
    priceRange: 'mid',
    reliability: 'good',
    description: 'microSD card for drones and action cameras',
    icon: '�, �, ',
    color: '#',
    pricePerGB: {
      budget: 5.5,
      mid: 10.0,
      premium: 21.0,
      professional: 42.00
  }
}
];

// Camera Memory Card Compatibility Database
export const CAMERA_MEMORY_CARD_COMPATIBILITY: CameraMemoryCardCompatibility[] = [
  // Sony Cameras
  {
    cameraId: 'sony-a7-iv',
    cameraBrand: 'Sony',
    cameraModel: 'A7 I',
    supportedCardTypes: ['S','SDHC','SDXC','SDXC UHS-II','CFexpress Type A'],
    recommendedCardTypes: ['SDXC UHS-I','CFexpress Type A'],
    maxCapacity: {
      'SD':'2T','SDHC':'32GB','SDXC':'2TB','SDXC UHS-II':'2TB','CFexpress Type A' : '1TB'
},
    dualSlot: true,
    slot1Type: 'CFexpress Type ',
    slot2Type: 'S',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both'
  },
  {
    cameraId: 'sony-fx',
    cameraBrand: 'Sony',
    cameraModel: 'FX',
    supportedCardTypes: ['S','SDHC','SDXC','SDXC UHS-II','CFexpress Type A'],
    recommendedCardTypes: ['CFexpress Type A, ', ],
    maxCapacity: {
      'SD':'2T','SDHC':'32GB','SDXC':'2TB','SDXC UHS-II':'2TB','CFexpress Type A' : '1TB'
},
    dualSlot: true,
    slot1Type: 'CFexpress Type ',
    slot2Type: 'S',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer'
  },

  // Canon Cameras
  {
    cameraId: 'canon-eos-r',
    cameraBrand: 'Canon',
    cameraModel: 'EOS R',
    supportedCardTypes: ['S','SDHC','SDXC','SDXC UHS-II','CFexpress Type B'],
    recommendedCardTypes: ['CFexpress Type ','SDXC UHS-II'],
    maxCapacity: {
      'SD':'2G','SDHC':'32GB','SDXC':'2TB','SDXC UHS-II':'2TB','CFexpress Type B' : '2TB'
},
    dualSlot: true,
    slot1Type: 'CFexpress Type ',
    slot2Type: 'S',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both'
  },
  {
    cameraId: 'canon-eos-r',
    cameraBrand: 'Canon',
    cameraModel: 'EOS R',
    supportedCardTypes: ['S','SDHC','SDXC','SDXC UHS-II'],
    recommendedCardTypes: ['SDXC UHS-II, ', ],
    maxCapacity: {
      'SD':'2G','SDHC':'32GB','SDXC':'2TB','SDXC UHS-II' : '2TB'
},
    dualSlot: true,
    slot1Type: 'S',
    slot2Type: 'S',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both'
  },

  // Nikon Cameras
  {
    cameraId: 'nikon-z',
    cameraBrand: 'Nikon',
    cameraModel: 'Z',
    supportedCardTypes: ['XQ','CFexpress Type B'],
    recommendedCardTypes: ['CFexpress Type B, ', ],
    maxCapacity: {
      'XQD':'1T','CFexpress Type B' : '2TB'
},
    dualSlot: true,
    slot1Type: 'CFexpress Type ',
    slot2Type: 'CFexpress Type ',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both'
  },

  // Panasonic Cameras
  {
    cameraId: 'panasonic-gh',
    cameraBrand: 'Panasonic',
    cameraModel: 'GH',
    supportedCardTypes: ['S','SDHC','SDXC','SDXC UHS-II','CFexpress Type B'],
    recommendedCardTypes: ['CFexpress Type ','SDXC UHS-II'],
    maxCapacity: {
      'SD':'2G','SDHC':'32GB','SDXC':'2TB','SDXC UHS-II':'2TB','CFexpress Type B' : '2TB'
},
    dualSlot: true,
    slot1Type: 'CFexpress Type ',
    slot2Type: 'S',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both'
  },

  // DJI Drones
  {
    cameraId: 'dji-mini-3-pro',
    cameraBrand: 'DJ',
    cameraModel: 'Mini 3 Pro',
    supportedCardTypes: [', '],
    recommendedCardTypes: [', '],
    maxCapacity: {
      'microSD' : '1TB'
  ,},
    dualSlot: false,
    slot1Type: 'microS',
    simultaneousRecording: false,
    backupMode: false,
    profession: 'both'
  }
];

// Memory Card Recommendation Engine
export class MemoryCardRecommendationEngine {
  /**
   * Get memory card recommendations based on selected cameras and project requirements
   */
  static getRecommendations(
    selectedCameras: any[],
    projectType: string,
    profession: 'photographer' | 'videographer' | 'both',
    budget: 'budget' | 'mid' | 'premium' | 'professional' = 'mid',
    totalDays: number = 1
  ): MemoryCardRecommendation[] {
    const recommendations: MemoryCardRecommendation[] = [];
    const usedCardTypes = new Set<string>();

    for (const camera of selectedCameras) {
      const compatibility = this.getCameraCompatibility(camera.id);
      if (!compatibility) continue;

      // Get recommended card types for this camera
      const recommendedTypes = compatibility.recommendedCardTypes;
      
      for (const cardTypeId of recommendedTypes) {
        if (usedCardTypes.has(cardTypeId)) continue;
        
        const cardType = MEMORY_CARD_TYPES.find(ct => ct.id === cardTypeId);
        if (!cardType) continue;

        // Filter by budget
        if (this.isWithinBudget(cardType.priceRange, budget)) {
          const recommendation = this.createRecommendation(
            cardType,
            compatibility,
            projectType,
            profession,
            totalDays
        );
          
          if (recommendation) {
            recommendations.push(recommendation);
            usedCardTypes.add(cardTypeId);
      }
    }
  }
}

    // Sort by priority and cost
    return recommendations.sort((a, b) => {
      const priorityOrder = { essential: 0, recommended: 1, optional: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
  }
      return a.estimatedCost - b.estimatedCost;
});
}

  /**
   * Get camera compatibility information
   */
  private static getCameraCompatibility(cameraId: string): CameraMemoryCardCompatibility | undefined {
    return CAMERA_MEMORY_CARD_COMPATIBILITY.find(comp => comp.cameraId === cameraId);
  }

  /**
   * Check if card type is within budget - now using centralized pricing service
   */
  private static async isWithinBudget(cardPriceRange: string, budget: string): Promise<boolean> {
    try {
      const memoryCardPricing = await clientServicePricingService.getMemoryCardPricing();
      return memoryCardPricing.priceOrder[cardPriceRange as keyof typeof memoryCardPricing.priceOrder] <= 
             memoryCardPricing.priceOrder[budget as keyof typeof memoryCardPricing.priceOrder];
} catch (error) {
      console.warn('Failed to use centralized pricing for budget check, using fallback:', error);
      
      // Fallback to hardcoded price order
      const priceOrder = { budget: 0, mid: 1, premium: 2, professional: 3 };
      return priceOrder[cardPriceRange as keyof typeof priceOrder] <= priceOrder[budget as keyof typeof priceOrder];
}
}

  /**
   * Create memory card recommendation
   */
  private static createRecommendation(
    cardType: MemoryCardType,
    compatibility: CameraMemoryCardCompatibility,
    projectType: string,
    profession: 'photographer' | 'videographer' | 'both',
    totalDays: number
  ): MemoryCardRecommendation | null {
    // Determine capacity based on project type and profession
    let capacity = '128GB';
    let quantity = 2; // Default: 2 cards per day
    let priority: 'essential' | 'recommended' | 'optional' = 'recommended';
    let reasoning = ', ';

    // Capacity recommendations based on project type and profession
    if (profession === 'videographer' || profession === 'both') {
      if (projectType === 'wedding') {
        capacity = '256GB';
        quantity = 3; // Extra cards for wedding video
        priority = 'essential';
        reasoning = 'Wedding video requires high capacity and multiple cards for safety';
    } else if (projectType === 'commercial') {
        capacity = '512GB';
        quantity = 2;
        priority = 'essential';
        reasoning = 'Commercial video production needs high capacity for 4K/8K recording';
  } else {
        capacity = '256GB';
        quantity = 2;
        priority = 'recommended';
        reasoning = 'Video production requires high capacity cards';
  }
} else {
      // Photographer
      if (projectType === 'wedding') {
        capacity = '128GB';
        quantity = 4; // More cards for wedding photography
        priority = 'essential';
        reasoning = 'Wedding photography needs multiple cards for safety and organization';
  } else if (projectType === 'portrait') {
        capacity = '64GB';
        quantity = 2;
        priority = 'recommended';
        reasoning = 'Portrait photography needs reliable, fast cards';
  } else {
        capacity = '128GB';
        quantity = 2;
        priority = 'recommended';
        reasoning = 'Professional photography requires reliable storage';
  }
}

    // Adjust for multi-day events
    if (totalDays > 1) {
      quantity = Math.ceil(quantity * totalDays);
      reasoning += ` (${totalDays} days)`;
}

    // Calculate estimated cost in NOK
    const baseCostNOK = this.getBaseCost(cardType, capacity, budget);
    const estimatedCostNOK = baseCostNOK * quantity;
    const estimatedCostUSD = convertCurrency(estimatedCostNOK, 'NOK','USD');
    const scandinavianReferences = getScandinavianReferences(estimatedCostNOK);

    return {
      cardType,
      capacity,
      quantity,
      reasoning,
      priority,
      estimatedCost: estimatedCostUD,
      estimatedCostNOK,
      currency: 'NO',
      scandinavianReferences
};
}

  /**
   * Get base cost for card type and capacity in NOK
   */
  private static getBaseCost(cardType: MemoryCardType, capacity: string, budget: string = 'mid'): number {
    const capacityGB = parseInt(capacity.replace('G', ', '));
    const pricePerGB = cardType.pricePerGB[budget as keyof typeof cardType.pricePerGB];
    return Math.round(capacityGB * pricePerGB);
}

  /**
   * Get memory card types compatible with selected cameras
   */
  static getCompatibleCardTypes(selectedCameras: any[]): MemoryCardType[] {
    const compatibleTypes = new Set<string>();

    for (const camera of selectedCameras) {
      const compatibility = this.getCameraCompatibility(camera.id);
      if (compatibility) {
        compatibility.supportedCardTypes.forEach(type => {
          const cardType = MEMORY_CARD_TYPES.find(ct => ct.name === type || ct.fullName === type);
          if (cardType) {
            compatibleTypes.add(cardType.id);
        }
    });
  }
}

    return MEMORY_CARD_TYPES.filter(ct => compatibleTypes.has(ct.id));
}

  /**
   * Get optimal memory card configuration for project
   */
  static getOptimalConfiguration(
    selectedCameras: any[],
    projectData: any
  ): {
    totalCards: number;
    totalCapacity: string;
    estimatedCost: number;
    recommendations: MemoryCardRecommendation[];
} {
    const recommendations = this.getRecommendations(
      selectedCameras,
      projectData.projectType,
      projectData.profession,
      projectData.budget || 'mid',
      projectData.totalDays || 1
  );

    const totalCards = recommendations.reduce((sum, rec) => sum + rec.quantity, 0);
    const totalCapacityGB = recommendations.reduce((sum, rec) => {
      const capacityGB = parseInt(rec.capacity.replace('GB', ', '));
      return sum + (capacityGB * rec.quantity);
}, 0);
    const totalCapacity = `${totalCapacityGB}GB`;
    const estimatedCost = recommendations.reduce((sum, rec) => sum + rec.estimatedCostNOK, 0);

    return {
      totalCards,
      totalCapacity,
      estimatedCost,
      recommendations
};
}
}

// Export utility functions
export const getMemoryCardTypesByProfession = (profession: 'photographer' | 'videographer' | 'both') => {
  return MEMORY_CARD_TYPES.filter(card => 
    card.profession === profession || card.profession ==='both'
  );
};

export const getMemoryCardTypesByCamera = (cameraId: string) => {
  const compatibility = CAMERA_MEMORY_CARD_COMPATIBILITY.find(comp => comp.cameraId === cameraId);
  if (!compatibility) return [];

  return MEMORY_CARD_TYPES.filter(card => 
    compatibility.supportedCardTypes.includes(card.name) || 
    compatibility.supportedCardTypes.includes(card.fullName)
  );
};

export const getMemoryCardTypeById = (id: string) => {
  return MEMORY_CARD_TYPES.find(card => card.id === id);
};

export const getCameraCompatibility = (cameraId: string) => {
  return CAMERA_MEMORY_CARD_COMPATIBILITY.find(comp => comp.cameraId === cameraId);
};
