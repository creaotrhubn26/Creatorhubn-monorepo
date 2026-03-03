/**
 * CreatorHub - Memory Card Database
 * Normalized card types + camera compatibility with stable IDs.
 */

import { clientServicePricingService } from '../services/ClientServicePricingService';

export const CURRENCY_RATES = {
  NOK_TO_NOK: 1,
  NOK_TO_SEK: 1.05,
  NOK_TO_DKK: 0.75,
  NOK_TO_USD: 0.095,
  SEK_TO_NOK: 0.95,
  DKK_TO_NOK: 1.33,
  USD_TO_NOK: 10.5,
  SEK_TO_DKK: 0.71,
  DKK_TO_SEK: 1.4,
  SEK_TO_USD: 0.09,
  DKK_TO_USD: 0.127,
} as const;

export type Currency = 'NOK' | 'SEK' | 'DKK' | 'USD';

export const convertCurrency = async (
  amount: number,
  from: Currency,
  to: Currency
): Promise<number> => {
  try {
    return await clientServicePricingService.convertCurrency(amount, from, to);
  } catch {
    if (from === to) return amount;

    let amountInNOK = amount;
    switch (from) {
      case 'SEK':
        amountInNOK = amount * CURRENCY_RATES.SEK_TO_NOK;
        break;
      case 'DKK':
        amountInNOK = amount * CURRENCY_RATES.DKK_TO_NOK;
        break;
      case 'USD':
        amountInNOK = amount * CURRENCY_RATES.USD_TO_NOK;
        break;
      default:
        amountInNOK = amount;
        break;
    }

    switch (to) {
      case 'SEK':
        return Math.round(amountInNOK * CURRENCY_RATES.NOK_TO_SEK * 100) / 100;
      case 'DKK':
        return Math.round(amountInNOK * CURRENCY_RATES.NOK_TO_DKK * 100) / 100;
      case 'USD':
        return Math.round(amountInNOK * CURRENCY_RATES.NOK_TO_USD * 100) / 100;
      default:
        return Math.round(amountInNOK * 100) / 100;
    }
  }
};

export const formatCurrency = (amount: number, currency: Currency = 'NOK'): string => {
  try {
    return clientServicePricingService.formatCurrency(amount, currency);
  } catch {
    if (currency === 'USD') return `$${amount.toFixed(2)}`;
    return `${Math.round(amount)} ${currency}`;
  }
};

export const getScandinavianReferences = async (amountNOK: number) => {
  const [sekAmount, dkkAmount, usdAmount] = await Promise.all([
    convertCurrency(amountNOK, 'NOK', 'SEK'),
    convertCurrency(amountNOK, 'NOK', 'DKK'),
    convertCurrency(amountNOK, 'NOK', 'USD'),
  ]);

  return {
    NOK: formatCurrency(amountNOK, 'NOK'),
    SEK: formatCurrency(sekAmount, 'SEK'),
    DKK: formatCurrency(dkkAmount, 'DKK'),
    USD: formatCurrency(usdAmount, 'USD'),
  };
};

export type MemoryCardCategory = 'SD' | 'CF' | 'XQD' | 'CFexpress' | 'microSD';
export type ProfessionType = 'photographer' | 'videographer' | 'both';
export type MemoryCardPriceRange = 'budget' | 'mid' | 'premium' | 'professional';
export type ReliabilityLevel = 'good' | 'excellent' | 'professional';

export interface MemoryCardType {
  id: string;
  name: string;
  fullName: string;
  category: MemoryCardCategory;
  subType?: string;
  maxCapacity: string;
  commonCapacities: string[];
  readSpeed: number;
  writeSpeed: number;
  videoClass?: string;
  uhsClass?: string;
  profession: ProfessionType;
  cameraCompatibility: string[];
  recommendedFor: string[];
  priceRange: MemoryCardPriceRange;
  reliability: ReliabilityLevel;
  description: string;
  icon: string;
  color: string;
  pricePerGB: {
    budget: number;
    mid: number;
    premium: number;
    professional: number;
  };
  price?: number;
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
  maxCapacity: Record<string, string>;
  dualSlot: boolean;
  slot1Type: string;
  slot2Type?: string;
  simultaneousRecording: boolean;
  backupMode: boolean;
  profession: ProfessionType;
}

export interface CameraMemoryCompatibility {
  cameraId: string;
  cardTypeIds: string[];
}

export interface SimpleMemoryCardCatalogItem {
  id: string;
  cardTypeId: string;
  brand: string;
  model: string;
  capacity: number;
  speedRead: number;
  speedWrite: number;
  priceNOK: number;
}

const memoryCardTypesSeed: MemoryCardType[] = [
  {
    id: 'sdxc-uhs-i-v30',
    name: 'SDXC UHS-I',
    fullName: 'SDXC UHS-I V30',
    category: 'SD',
    maxCapacity: '1TB',
    commonCapacities: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    readSpeed: 200,
    writeSpeed: 90,
    videoClass: 'V30',
    uhsClass: 'UHS-I',
    profession: 'both',
    cameraCompatibility: ['canon', 'sony', 'nikon', 'panasonic', 'fujifilm'],
    recommendedFor: ['photo', '4k-video', 'backup'],
    priceRange: 'mid',
    reliability: 'excellent',
    description: 'Reliable all-round SD card for stills and standard 4K production.',
    icon: '💾',
    color: '#4caf50',
    pricePerGB: { budget: 2.0, mid: 3.2, premium: 4.1, professional: 5.0 },
    price: 599,
  },
  {
    id: 'sdxc-uhs-ii-v60',
    name: 'SDXC UHS-II',
    fullName: 'SDXC UHS-II V60',
    category: 'SD',
    maxCapacity: '512GB',
    commonCapacities: ['64GB', '128GB', '256GB', '512GB'],
    readSpeed: 300,
    writeSpeed: 200,
    videoClass: 'V60',
    uhsClass: 'UHS-II',
    profession: 'both',
    cameraCompatibility: ['canon', 'sony', 'nikon', 'panasonic', 'fujifilm'],
    recommendedFor: ['high-resolution-photography', '4k-video', 'burst-photography'],
    priceRange: 'premium',
    reliability: 'excellent',
    description: 'Fast SD option for burst photo and high bitrate 4K work.',
    icon: '💾',
    color: '#2e7d32',
    pricePerGB: { budget: 2.5, mid: 3.9, premium: 5.6, professional: 7.0 },
    price: 999,
  },
  {
    id: 'sdxc-uhs-ii-v90',
    name: 'SDXC UHS-II',
    fullName: 'SDXC UHS-II V90',
    category: 'SD',
    maxCapacity: '512GB',
    commonCapacities: ['64GB', '128GB', '256GB', '512GB'],
    readSpeed: 300,
    writeSpeed: 260,
    videoClass: 'V90',
    uhsClass: 'UHS-II',
    profession: 'both',
    cameraCompatibility: ['canon', 'sony', 'nikon', 'panasonic', 'fujifilm'],
    recommendedFor: ['8k-video', 'raw-video', 'professional-photography'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'Highest performance SD media for demanding codecs.',
    icon: '💾',
    color: '#1b5e20',
    pricePerGB: { budget: 3.0, mid: 4.6, premium: 6.8, professional: 8.8 },
    price: 1499,
  },
  {
    id: 'cfexpress-type-a',
    name: 'CFexpress Type A',
    fullName: 'CFexpress Type A',
    category: 'CFexpress',
    subType: 'Type A',
    maxCapacity: '960GB',
    commonCapacities: ['80GB', '160GB', '320GB', '640GB', '960GB'],
    readSpeed: 800,
    writeSpeed: 700,
    profession: 'both',
    cameraCompatibility: ['sony'],
    recommendedFor: ['8k-video', 'high-speed-photography', 'cinema'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'Primary high-speed media for Sony cinema and hybrid bodies.',
    icon: '⚡',
    color: '#e91e63',
    pricePerGB: { budget: 4.8, mid: 6.2, premium: 8.5, professional: 10.5 },
    price: 2799,
  },
  {
    id: 'cfexpress-type-b',
    name: 'CFexpress Type B',
    fullName: 'CFexpress Type B',
    category: 'CFexpress',
    subType: 'Type B',
    maxCapacity: '2TB',
    commonCapacities: ['128GB', '256GB', '512GB', '1TB', '2TB'],
    readSpeed: 1800,
    writeSpeed: 1500,
    profession: 'both',
    cameraCompatibility: ['canon', 'nikon', 'panasonic', 'red', 'arri', 'blackmagic', 'dji'],
    recommendedFor: ['8k-video', 'raw-video', 'cinema'],
    priceRange: 'professional',
    reliability: 'professional',
    description: 'High-throughput cinema media for RAW and high frame rate workflows.',
    icon: '⚡',
    color: '#9c27b0',
    pricePerGB: { budget: 4.5, mid: 5.9, premium: 7.9, professional: 9.9 },
    price: 2499,
  },
  {
    id: 'xqd-v90',
    name: 'XQD',
    fullName: 'XQD V90',
    category: 'XQD',
    maxCapacity: '512GB',
    commonCapacities: ['64GB', '120GB', '240GB', '512GB'],
    readSpeed: 440,
    writeSpeed: 400,
    profession: 'both',
    cameraCompatibility: ['nikon', 'sony'],
    recommendedFor: ['burst-photography', '4k-video'],
    priceRange: 'premium',
    reliability: 'excellent',
    description: 'Legacy pro format still used in some Nikon/Sony ecosystems.',
    icon: '🧠',
    color: '#607d8b',
    pricePerGB: { budget: 3.5, mid: 4.4, premium: 5.8, professional: 7.0 },
    price: 1299,
  },
  {
    id: 'microsd-uhs-i-v30',
    name: 'microSD UHS-I',
    fullName: 'microSD UHS-I V30',
    category: 'microSD',
    maxCapacity: '1TB',
    commonCapacities: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    readSpeed: 190,
    writeSpeed: 130,
    videoClass: 'V30',
    uhsClass: 'UHS-I',
    profession: 'both',
    cameraCompatibility: ['dji', 'gopro', 'action'],
    recommendedFor: ['drone', 'action-cameras', 'backup'],
    priceRange: 'mid',
    reliability: 'good',
    description: 'Primary removable media for drones and action cameras.',
    icon: '📱',
    color: '#ff9800',
    pricePerGB: { budget: 1.8, mid: 2.6, premium: 3.5, professional: 4.2 },
    price: 699,
  },
];

export const MEMORY_CARD_TYPES: MemoryCardType[] = memoryCardTypesSeed.map((card) => ({
  ...card,
  commonCapacities: Array.from(new Set(card.commonCapacities.map((value) => value.trim()))),
}));

const buildCapacities = (pairs: Array<[string, string]>): Record<string, string> => {
  const record: Record<string, string> = {};
  pairs.forEach(([cardTypeId, max]) => {
    record[cardTypeId] = max;
  });
  return record;
};

export const CAMERA_MEMORY_CARD_COMPATIBILITY: CameraMemoryCardCompatibility[] = [
  {
    cameraId: 'sony-a7-iv-photo',
    cameraBrand: 'Sony',
    cameraModel: 'A7 IV',
    supportedCardTypes: ['sdxc-uhs-i-v30', 'sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90', 'cfexpress-type-a'],
    recommendedCardTypes: ['sdxc-uhs-ii-v60', 'cfexpress-type-a'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-i-v30', '1TB'],
      ['sdxc-uhs-ii-v60', '512GB'],
      ['sdxc-uhs-ii-v90', '512GB'],
      ['cfexpress-type-a', '960GB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-a',
    slot2Type: 'sdxc-uhs-ii-v60',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'sony-fx3-video',
    cameraBrand: 'Sony',
    cameraModel: 'FX3',
    supportedCardTypes: ['sdxc-uhs-i-v30', 'sdxc-uhs-ii-v90', 'cfexpress-type-a'],
    recommendedCardTypes: ['cfexpress-type-a', 'sdxc-uhs-ii-v90'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-i-v30', '1TB'],
      ['sdxc-uhs-ii-v90', '512GB'],
      ['cfexpress-type-a', '960GB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-a',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'canon-eos-r5-ii-photo',
    cameraBrand: 'Canon',
    cameraModel: 'EOS R5 Mark II',
    supportedCardTypes: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90', 'cfexpress-type-b'],
    recommendedCardTypes: ['cfexpress-type-b', 'sdxc-uhs-ii-v90'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-ii-v60', '512GB'],
      ['sdxc-uhs-ii-v90', '512GB'],
      ['cfexpress-type-b', '2TB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'canon-eos-r6-ii-photo',
    cameraBrand: 'Canon',
    cameraModel: 'EOS R6 Mark II',
    supportedCardTypes: ['sdxc-uhs-i-v30', 'sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90'],
    recommendedCardTypes: ['sdxc-uhs-ii-v60'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-i-v30', '1TB'],
      ['sdxc-uhs-ii-v60', '512GB'],
      ['sdxc-uhs-ii-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'sdxc-uhs-ii-v60',
    slot2Type: 'sdxc-uhs-ii-v60',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'canon-eos-r5-c-video',
    cameraBrand: 'Canon',
    cameraModel: 'EOS R5 C',
    supportedCardTypes: ['sdxc-uhs-ii-v90', 'cfexpress-type-b'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-ii-v90', '512GB'],
      ['cfexpress-type-b', '2TB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'canon-c70-video',
    cameraBrand: 'Canon',
    cameraModel: 'C70',
    supportedCardTypes: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90'],
    recommendedCardTypes: ['sdxc-uhs-ii-v90'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-ii-v60', '512GB'],
      ['sdxc-uhs-ii-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'sdxc-uhs-ii-v90',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'canon-c400-video',
    cameraBrand: 'Canon',
    cameraModel: 'C400',
    supportedCardTypes: ['cfexpress-type-b', 'sdxc-uhs-ii-v90'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([
      ['cfexpress-type-b', '2TB'],
      ['sdxc-uhs-ii-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'nikon-z8-video',
    cameraBrand: 'Nikon',
    cameraModel: 'Z8',
    supportedCardTypes: ['cfexpress-type-b', 'sdxc-uhs-ii-v90', 'xqd-v90'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([
      ['cfexpress-type-b', '2TB'],
      ['sdxc-uhs-ii-v90', '512GB'],
      ['xqd-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'nikon-z9-video',
    cameraBrand: 'Nikon',
    cameraModel: 'Z9',
    supportedCardTypes: ['cfexpress-type-b', 'xqd-v90'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([
      ['cfexpress-type-b', '2TB'],
      ['xqd-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'cfexpress-type-b',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'panasonic-s1h-video',
    cameraBrand: 'Panasonic',
    cameraModel: 'S1H',
    supportedCardTypes: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90'],
    recommendedCardTypes: ['sdxc-uhs-ii-v90'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-ii-v60', '512GB'],
      ['sdxc-uhs-ii-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'sdxc-uhs-ii-v90',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'panasonic-gh7-video',
    cameraBrand: 'Panasonic',
    cameraModel: 'GH7',
    supportedCardTypes: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90'],
    recommendedCardTypes: ['sdxc-uhs-ii-v90'],
    maxCapacity: buildCapacities([
      ['sdxc-uhs-ii-v60', '512GB'],
      ['sdxc-uhs-ii-v90', '512GB'],
    ]),
    dualSlot: true,
    slot1Type: 'sdxc-uhs-ii-v90',
    slot2Type: 'sdxc-uhs-ii-v90',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  },
  {
    cameraId: 'blackmagic-pocket-6k-pro-video',
    cameraBrand: 'Blackmagic',
    cameraModel: 'Pocket 6K Pro',
    supportedCardTypes: ['cfexpress-type-b', 'sdxc-uhs-ii-v90'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([
      ['cfexpress-type-b', '2TB'],
      ['sdxc-uhs-ii-v90', '512GB'],
    ]),
    dualSlot: false,
    slot1Type: 'cfexpress-type-b',
    simultaneousRecording: false,
    backupMode: false,
    profession: 'videographer',
  },
  {
    cameraId: 'blackmagic-ursa-mini-pro-12k-video',
    cameraBrand: 'Blackmagic',
    cameraModel: 'URSA Mini Pro 12K',
    supportedCardTypes: ['cfexpress-type-b'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([['cfexpress-type-b', '2TB']]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'cfexpress-type-b',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'red-komodo-x-video',
    cameraBrand: 'RED',
    cameraModel: 'KOMODO-X',
    supportedCardTypes: ['cfexpress-type-b'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([['cfexpress-type-b', '2TB']]),
    dualSlot: false,
    slot1Type: 'cfexpress-type-b',
    simultaneousRecording: false,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'red-v-raptor-video',
    cameraBrand: 'RED',
    cameraModel: 'V-RAPTOR',
    supportedCardTypes: ['cfexpress-type-b'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([['cfexpress-type-b', '2TB']]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'cfexpress-type-b',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'arri-alexa-35-video',
    cameraBrand: 'ARRI',
    cameraModel: 'ALEXA 35',
    supportedCardTypes: ['cfexpress-type-b'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([['cfexpress-type-b', '2TB']]),
    dualSlot: true,
    slot1Type: 'cfexpress-type-b',
    slot2Type: 'cfexpress-type-b',
    simultaneousRecording: true,
    backupMode: true,
    profession: 'videographer',
  },
  {
    cameraId: 'dji-inspire-3-x9-video',
    cameraBrand: 'DJI',
    cameraModel: 'Inspire 3 (X9)',
    supportedCardTypes: ['cfexpress-type-b', 'microsd-uhs-i-v30'],
    recommendedCardTypes: ['cfexpress-type-b'],
    maxCapacity: buildCapacities([
      ['cfexpress-type-b', '2TB'],
      ['microsd-uhs-i-v30', '1TB'],
    ]),
    dualSlot: false,
    slot1Type: 'cfexpress-type-b',
    simultaneousRecording: false,
    backupMode: false,
    profession: 'videographer',
  },
  {
    cameraId: 'gopro-hero-13-black-video',
    cameraBrand: 'GoPro',
    cameraModel: 'HERO 13 Black',
    supportedCardTypes: ['microsd-uhs-i-v30'],
    recommendedCardTypes: ['microsd-uhs-i-v30'],
    maxCapacity: buildCapacities([['microsd-uhs-i-v30', '1TB']]),
    dualSlot: false,
    slot1Type: 'microsd-uhs-i-v30',
    simultaneousRecording: false,
    backupMode: false,
    profession: 'both',
  },
];

const cardTypeMap = new Map(MEMORY_CARD_TYPES.map((card) => [card.id, card]));
const compatibilityMap = new Map(
  CAMERA_MEMORY_CARD_COMPATIBILITY.map((compatibility) => [compatibility.cameraId, compatibility])
);

const cameraIdFallbackPatterns: Array<{ pattern: RegExp; supported: string[]; recommended: string[]; brand: string }> = [
  {
    pattern: /sony|fx|a7/i,
    supported: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90', 'cfexpress-type-a'],
    recommended: ['cfexpress-type-a'],
    brand: 'Sony',
  },
  {
    pattern: /canon|eos|c70|c400/i,
    supported: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90', 'cfexpress-type-b'],
    recommended: ['cfexpress-type-b'],
    brand: 'Canon',
  },
  {
    pattern: /nikon|z8|z9/i,
    supported: ['cfexpress-type-b', 'xqd-v90', 'sdxc-uhs-ii-v90'],
    recommended: ['cfexpress-type-b'],
    brand: 'Nikon',
  },
  {
    pattern: /panasonic|gh|s1h/i,
    supported: ['sdxc-uhs-ii-v60', 'sdxc-uhs-ii-v90'],
    recommended: ['sdxc-uhs-ii-v90'],
    brand: 'Panasonic',
  },
  {
    pattern: /blackmagic|red|arri|dji|cinema/i,
    supported: ['cfexpress-type-b'],
    recommended: ['cfexpress-type-b'],
    brand: 'Cinema',
  },
  {
    pattern: /gopro|action|drone|iphone|phone/i,
    supported: ['microsd-uhs-i-v30'],
    recommended: ['microsd-uhs-i-v30'],
    brand: 'Mobile',
  },
];

const buildFallbackCompatibility = (cameraId: string): CameraMemoryCardCompatibility | undefined => {
  const fallback = cameraIdFallbackPatterns.find((candidate) => candidate.pattern.test(cameraId));
  if (!fallback) return undefined;

  return {
    cameraId,
    cameraBrand: fallback.brand,
    cameraModel: cameraId,
    supportedCardTypes: fallback.supported,
    recommendedCardTypes: fallback.recommended,
    maxCapacity: Object.fromEntries(fallback.supported.map((cardTypeId) => [cardTypeId, '2TB'])),
    dualSlot: true,
    slot1Type: fallback.recommended[0] ?? fallback.supported[0] ?? 'sdxc-uhs-i-v30',
    slot2Type: fallback.supported[1],
    simultaneousRecording: true,
    backupMode: true,
    profession: 'both',
  };
};

const parseCapacityToGB = (capacity: string): number => {
  const normalized = capacity.trim().toUpperCase();
  if (normalized.endsWith('TB')) {
    const value = Number.parseFloat(normalized.replace('TB', ''));
    return Number.isFinite(value) ? value * 1024 : 0;
  }
  if (normalized.endsWith('GB')) {
    const value = Number.parseFloat(normalized.replace('GB', ''));
    return Number.isFinite(value) ? value : 0;
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
};

const getBaseCostNok = (
  cardType: MemoryCardType,
  capacity: string,
  budget: MemoryCardPriceRange = 'mid'
): number => {
  const capacityGB = parseCapacityToGB(capacity);
  const perGb = cardType.pricePerGB[budget];
  return Math.round(capacityGB * perGb);
};

const getFallbackReferences = (amountNOK: number) => {
  const usdAmount = Math.round(amountNOK * CURRENCY_RATES.NOK_TO_USD * 100) / 100;
  return {
    NOK: formatCurrency(amountNOK, 'NOK'),
    SEK: formatCurrency(amountNOK * CURRENCY_RATES.NOK_TO_SEK, 'SEK'),
    DKK: formatCurrency(amountNOK * CURRENCY_RATES.NOK_TO_DKK, 'DKK'),
    USD: formatCurrency(usdAmount, 'USD'),
  };
};

export class MemoryCardRecommendationEngine {
  static getRecommendations(
    selectedCameras: Array<{ id: string }>,
    projectType: string,
    profession: ProfessionType,
    budget: MemoryCardPriceRange = 'mid',
    totalDays = 1
  ): MemoryCardRecommendation[] {
    const recommendations: MemoryCardRecommendation[] = [];
    const usedCardTypeIds = new Set<string>();

    selectedCameras.forEach((camera) => {
      const compatibility = this.getCameraCompatibility(camera.id);
      if (!compatibility) return;

      compatibility.recommendedCardTypes.forEach((cardTypeId) => {
        if (usedCardTypeIds.has(cardTypeId)) return;

        const cardType = cardTypeMap.get(cardTypeId);
        if (!cardType) return;

        if (!this.isWithinBudget(cardType.priceRange, budget)) return;

        const recommendation = this.createRecommendation(
          cardType,
          projectType,
          profession,
          totalDays,
          budget
        );
        recommendations.push(recommendation);
        usedCardTypeIds.add(cardTypeId);
      });
    });

    return recommendations.sort((a, b) => {
      const priorityOrder: Record<MemoryCardRecommendation['priority'], number> = {
        essential: 0,
        recommended: 1,
        optional: 2,
      };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.estimatedCostNOK - b.estimatedCostNOK;
    });
  }

  static getCompatibleCardTypes(selectedCameras: Array<{ id: string }>): MemoryCardType[] {
    const ids = new Set<string>();

    selectedCameras.forEach((camera) => {
      const compatibility = this.getCameraCompatibility(camera.id);
      if (!compatibility) return;
      compatibility.supportedCardTypes.forEach((cardTypeId) => ids.add(cardTypeId));
    });

    return MEMORY_CARD_TYPES.filter((cardType) => ids.has(cardType.id));
  }

  static getOptimalConfiguration(
    selectedCameras: Array<{ id: string }>,
    projectData: {
      projectType: string;
      profession: ProfessionType;
      budget?: MemoryCardPriceRange;
      totalDays?: number;
    }
  ) {
    const recommendations = this.getRecommendations(
      selectedCameras,
      projectData.projectType,
      projectData.profession,
      projectData.budget ?? 'mid',
      projectData.totalDays ?? 1
    );

    const totalCards = recommendations.reduce((sum, rec) => sum + rec.quantity, 0);
    const totalCapacityGb = recommendations.reduce(
      (sum, rec) => sum + parseCapacityToGB(rec.capacity) * rec.quantity,
      0
    );
    const estimatedCost = recommendations.reduce((sum, rec) => sum + rec.estimatedCostNOK, 0);

    return {
      totalCards,
      totalCapacity: `${Math.round(totalCapacityGb)}GB`,
      estimatedCost,
      recommendations,
    };
  }

  private static isWithinBudget(cardPriceRange: MemoryCardPriceRange, budget: MemoryCardPriceRange): boolean {
    const order: Record<MemoryCardPriceRange, number> = {
      budget: 0,
      mid: 1,
      premium: 2,
      professional: 3,
    };
    return order[cardPriceRange] <= order[budget];
  }

  private static getCameraCompatibility(cameraId: string): CameraMemoryCardCompatibility | undefined {
    const exact = compatibilityMap.get(cameraId);
    if (exact) return exact;
    return buildFallbackCompatibility(cameraId);
  }

  private static createRecommendation(
    cardType: MemoryCardType,
    projectType: string,
    profession: ProfessionType,
    totalDays: number,
    budget: MemoryCardPriceRange
  ): MemoryCardRecommendation {
    let capacity = '128GB';
    let quantity = 2;
    let priority: MemoryCardRecommendation['priority'] = 'recommended';
    let reasoning = 'Standard anbefaling for stabil opptakskjede.';

    if (profession === 'videographer' || profession === 'both') {
      capacity = projectType === 'commercial' ? '512GB' : projectType === 'wedding' ? '256GB' : '256GB';
      quantity = projectType === 'wedding' ? 3 : 2;
      priority = 'essential';
      reasoning = 'Videoproduksjon krever høy og stabil skrivehastighet.';
    } else {
      capacity = projectType === 'wedding' ? '128GB' : '64GB';
      quantity = projectType === 'wedding' ? 4 : 2;
      priority = projectType === 'wedding' ? 'essential' : 'recommended';
      reasoning = 'Fotoworkflow prioriterer redundans og kapasitet.';
    }

    if (totalDays > 1) {
      quantity *= Math.max(1, totalDays);
      reasoning += ` (${totalDays} opptaksdager)`;
    }

    const estimatedCostNOK = getBaseCostNok(cardType, capacity, budget) * quantity;
    const estimatedCost = Math.round(estimatedCostNOK * CURRENCY_RATES.NOK_TO_USD * 100) / 100;

    return {
      cardType,
      capacity,
      quantity,
      reasoning,
      priority,
      estimatedCost,
      estimatedCostNOK,
      currency: 'NOK',
      scandinavianReferences: getFallbackReferences(estimatedCostNOK),
    };
  }
}

export const getMemoryCardTypesByProfession = (profession: ProfessionType): MemoryCardType[] => {
  return MEMORY_CARD_TYPES.filter(
    (cardType) => cardType.profession === profession || cardType.profession === 'both'
  );
};

export const getMemoryCardTypesByCamera = (cameraId: string): MemoryCardType[] => {
  const compatibility = compatibilityMap.get(cameraId) ?? buildFallbackCompatibility(cameraId);
  if (!compatibility) return [];

  return compatibility.supportedCardTypes
    .map((cardTypeId) => cardTypeMap.get(cardTypeId))
    .filter((cardType): cardType is MemoryCardType => Boolean(cardType));
};

export const getMemoryCardTypeById = (id: string): MemoryCardType | undefined => {
  return cardTypeMap.get(id);
};

export const getCameraCompatibility = (
  cameraId: string
): CameraMemoryCardCompatibility | undefined => {
  return compatibilityMap.get(cameraId) ?? buildFallbackCompatibility(cameraId);
};

export const CAMERA_MEMORY_COMPATIBILITY: CameraMemoryCompatibility[] =
  CAMERA_MEMORY_CARD_COMPATIBILITY.map((compatibility) => ({
    cameraId: compatibility.cameraId,
    cardTypeIds: compatibility.supportedCardTypes,
  }));

export const MEMORY_CARD_DATABASE: SimpleMemoryCardCatalogItem[] = [
  {
    id: 'card-sandisk-extremepro-sd-128',
    cardTypeId: 'sdxc-uhs-i-v30',
    brand: 'SanDisk',
    model: 'Extreme Pro SDXC UHS-I',
    capacity: 128,
    speedRead: 200,
    speedWrite: 90,
    priceNOK: 549,
  },
  {
    id: 'card-lexar-pro-sd-v60-128',
    cardTypeId: 'sdxc-uhs-ii-v60',
    brand: 'Lexar',
    model: 'Professional SDXC UHS-II V60',
    capacity: 128,
    speedRead: 300,
    speedWrite: 200,
    priceNOK: 999,
  },
  {
    id: 'card-prograde-sd-v90-128',
    cardTypeId: 'sdxc-uhs-ii-v90',
    brand: 'ProGrade',
    model: 'SDXC UHS-II V90',
    capacity: 128,
    speedRead: 300,
    speedWrite: 260,
    priceNOK: 1499,
  },
  {
    id: 'card-sony-tough-cfa-160',
    cardTypeId: 'cfexpress-type-a',
    brand: 'Sony',
    model: 'TOUGH CFexpress Type A',
    capacity: 160,
    speedRead: 800,
    speedWrite: 700,
    priceNOK: 2799,
  },
  {
    id: 'card-angelbird-cfb-512',
    cardTypeId: 'cfexpress-type-b',
    brand: 'Angelbird',
    model: 'AV PRO CFexpress Type B',
    capacity: 512,
    speedRead: 1800,
    speedWrite: 1500,
    priceNOK: 2499,
  },
  {
    id: 'card-sony-xqd-240',
    cardTypeId: 'xqd-v90',
    brand: 'Sony',
    model: 'XQD G-Series',
    capacity: 240,
    speedRead: 440,
    speedWrite: 400,
    priceNOK: 1299,
  },
  {
    id: 'card-sandisk-extreme-microsd-256',
    cardTypeId: 'microsd-uhs-i-v30',
    brand: 'SanDisk',
    model: 'Extreme microSD UHS-I',
    capacity: 256,
    speedRead: 190,
    speedWrite: 130,
    priceNOK: 699,
  },
];
