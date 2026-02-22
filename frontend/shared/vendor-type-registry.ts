/**
 * CreatorHub Norge - Scalable Vendor Type Registry
 * Dynamic vendor type management for unlimited expansion
 */

import {
  BusinessIcon as Business,
  StoreIcon as Store,
  SettingsIcon as Settings,
  MusicNoteIcon as MusicNote,
  PaletteIcon as Palette,
  // Settings, // Using alternative icon
  SecurityIcon as Security,
  VideocamIcon as Videocam,
  PhotoCameraIcon as PhotoCamera,
  SettingsIcon as Lightbulb, // Using SettingsIcon as fallback for Lightbulb
  SchoolIcon as School,
  LocalShipping,
  Restaurant,
  DirectionsCar,
  Home,
  HealingIcon as Healing,
  SportsSoccerIcon as SportsSoccer,
  TravelExploreIcon as TravelExplore,
  ShoppingBagIcon as ShoppingBag,
  AgricultureIcon as Agriculture,
} from '../client/src/components/shared/CreatorHubIcons';

export interface VendorTypeConfig {
  id: string;
  name: string;
  nameEnglish: string;
  color: string;
  icon: any;
  category: 'creative' | 'technology' | 'service' | 'physical' | 'education' | 'lifestyle';
  primaryActions: {
    label: string;
    icon: any;
    action: string;
  }[];
  quickStats: {
    label: string;
    key: string;
    icon: any;
  }[];
  supportedFeatures: {
    showcase: boolean;
    pricing: boolean;
    inventory: boolean;
    bookings: boolean;
    subscriptions: boolean;
    downloads: boolean;
    physical_shipping: boolean;
    digital_delivery: boolean;
  };
  marketplaceCategory: string[];
  targetCustomers: string[];
  // Product categories for this vendor type (used in product creation)
  productCategories?: {
    id: string;
    label: string;
    color: string;
  }[];
}

// Core vendor types - always available
export const coreVendorTypes: Record<string, VendorTypeConfig> = {
  print: {
    id: 'print',
    name: 'Settings & Design',
    nameEnglish: 'Settings & Design',
    color: '#e91e63',
    icon: Settings, // Using Settings as fallback for Settings
    category: 'creative',
    primaryActions: [
      { label: 'Nytt Design', icon: Palette, action: 'create_design' },
      { label: 'Upload Template', icon: Settings, action: 'upload_template' },
      { label: 'Produktkatalog', icon: ShoppingBag, action: 'manage_catalog' },
    ],
    quickStats: [
      { label: 'Maler', key: 'templates', icon: Palette },
      { label: 'Fonts', key: 'fonts', icon: Settings },
      { label: 'Grafikk', key: 'graphics', icon: Settings },
      { label: 'Mockups', key: 'mockups', icon: PhotoCamera },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: false,
      subscriptions: true,
      downloads: true,
      physical_shipping: true,
      digital_delivery: true,
    },
    marketplaceCategory: ['design', 'print', 'marketing'],
    targetCustomers: ['photographers', 'businesses', 'marketers'],
  },

  audio: {
    id: 'audio',
    name: 'Audio & Music',
    nameEnglish: 'Audio & Music',
    color: '#9c27b0',
    icon: MusicNote,
    category: 'creative',
    primaryActions: [
      { label: 'Ny Plugin', icon: Settings, action: 'create_plugin' },
      { label: 'Upload Sample', icon: MusicNote, action: 'upload_sample' },
      { label: 'Preset Manager', icon: Lightbulb, action: 'manage_presets' },
    ],
    quickStats: [
      { label: 'Plugins', key: 'plugins', icon: MusicNote },
      { label: 'Samples', key: 'samples', icon: MusicNote },
      { label: 'Presets', key: 'presets', icon: Lightbulb },
      { label: 'Software', key: 'software', icon: Settings },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: false,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['music', 'audio', 'software'],
    targetCustomers: ['music_producers', 'podcasters', 'audio_engineers'],
  },

  design: {
    id: 'design',
    name: 'Design & Creative',
    nameEnglish: 'Design & Creative',
    color: '#ff5722',
    icon: Palette,
    category: 'creative',
    primaryActions: [
      { label: 'Ny Pensel', icon: Palette, action: 'create_brush' },
      { label: 'Upload Tekstur', icon: PhotoCamera, action: 'upload_texture' },
      { label: 'Action Manager', icon: Settings, action: 'manage_actions' },
    ],
    quickStats: [
      { label: 'Pensler', key: 'brushes', icon: Palette },
      { label: 'Teksturer', key: 'textures', icon: PhotoCamera },
      { label: 'Actions', key: 'actions', icon: Settings },
      { label: 'Overlays', key: 'overlays', icon: Palette },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: false,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['design', 'creative', 'photography'],
    targetCustomers: ['photographers', 'designers', 'artists'],
  },

  software: {
    id: 'software',
    name: 'Software & Tools',
    nameEnglish: 'Software & Tools',
    color: '#2196f3',
    icon: Settings,
    category: 'technology',
    primaryActions: [
      { label: 'Ny App', icon: Settings, action: 'create_app' },
      { label: 'Upload Script', icon: Settings, action: 'upload_script' },
      { label: 'Extension Manager', icon: Settings, action: 'manage_extensions' },
    ],
    quickStats: [
      { label: 'Applikasjoner', key: 'applications', icon: Settings },
      { label: 'Scripts', key: 'scripts', icon: Settings },
      { label: 'Utvidelser', key: 'extensions', icon: Settings },
      { label: 'Verktøy', key: 'utilities', icon: Settings },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: false,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['software', 'tools', 'productivity'],
    targetCustomers: ['developers', 'photographers', 'businesses'],
  },

  hardware: {
    id: 'hardware',
    name: 'Hardware & Equipment',
    nameEnglish: 'Hardware & Equipment',
    color: '#795548',
    icon: Security,
    category: 'physical',
    primaryActions: [
      { label: 'Nytt Produkt', icon: PhotoCamera, action: 'create_product' },
      { label: 'Upload Manual', icon: Settings, action: 'upload_manual' },
      {
        label: 'Inventory Manager',
        icon: ShoppingBag,
        action: 'manage_inventory',
      },
    ],
    quickStats: [
      { label: 'Kameraer', key: 'cameras', icon: PhotoCamera },
      { label: 'Objektiver', key: 'lenses', icon: PhotoCamera },
      { label: 'Audio', key: 'audio', icon: MusicNote },
      { label: 'Tilbehør', key: 'accessories', icon: Security },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: false,
      subscriptions: false,
      downloads: false,
      physical_shipping: true,
      digital_delivery: false,
    },
    marketplaceCategory: ['hardware', 'equipment', 'photography'],
    targetCustomers: ['photographers', 'videographers', 'content_creators'],
  },

  photographer: {
    id: 'photographer',
    name: 'Fotograf',
    nameEnglish: 'Photographer',
    color: '#ff8c00',
    icon: PhotoCamera,
    category: 'creative',
    primaryActions: [
      { label: 'Nytt oppdrag', icon: PhotoCamera, action: 'create_booking' },
      { label: 'Last opp showcase', icon: Settings, action: 'upload_showcase' },
      { label: 'Administrer kunder', icon: Business, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Oppdrag', key: 'bookings', icon: Business },
      { label: 'Showcase', key: 'showcase', icon: PhotoCamera },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['photography', 'wedding'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'packages', label: 'Pakker', color: '#ff8c00' },
      { id: 'add-ons', label: 'Tillegg', color: '#ffa726' },
    ],
  },

  videographer: {
    id: 'videographer',
    name: 'Videograf',
    nameEnglish: 'Videographer',
    color: '#e74c3c',
    icon: Videocam,
    category: 'creative',
    primaryActions: [
      { label: 'Nytt prosjekt', icon: Videocam, action: 'create_project' },
      { label: 'Last opp video', icon: Settings, action: 'upload_video' },
      { label: 'Administrer kunder', icon: Business, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Prosjekter', key: 'projects', icon: Videocam },
      { label: 'Leveranser', key: 'deliveries', icon: Store },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['video', 'wedding'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'packages', label: 'Pakker', color: '#e74c3c' },
      { id: 'edits', label: 'Redigering', color: '#ef5350' },
    ],
  },

  florist: {
    id: 'florist',
    name: 'Blomster',
    nameEnglish: 'Florist',
    color: '#43e97b',
    icon: Agriculture,
    category: 'service',
    primaryActions: [
      { label: 'Nytt oppdrag', icon: Store, action: 'create_booking' },
      { label: 'Oppdater katalog', icon: Settings, action: 'manage_catalog' },
      { label: 'Leveranser', icon: LocalShipping, action: 'manage_deliveries' },
    ],
    quickStats: [
      { label: 'Bestillinger', key: 'orders', icon: Store },
      { label: 'Leveranser', key: 'deliveries', icon: LocalShipping },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: true,
      subscriptions: true,
      downloads: false,
      physical_shipping: true,
      digital_delivery: false,
    },
    marketplaceCategory: ['florist', 'decor'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'bouquets', label: 'Buketter', color: '#43e97b' },
      { id: 'decor', label: 'Dekor', color: '#2ecc71' },
    ],
  },

  catering: {
    id: 'catering',
    name: 'Catering',
    nameEnglish: 'Catering',
    color: '#ff9800',
    icon: Restaurant,
    category: 'service',
    primaryActions: [
      { label: 'Ny booking', icon: Restaurant, action: 'create_booking' },
      { label: 'Oppdater meny', icon: Settings, action: 'manage_menu' },
      { label: 'Leveranser', icon: LocalShipping, action: 'manage_deliveries' },
    ],
    quickStats: [
      { label: 'Bookinger', key: 'bookings', icon: Restaurant },
      { label: 'Leveranser', key: 'deliveries', icon: LocalShipping },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: true,
      subscriptions: true,
      downloads: false,
      physical_shipping: true,
      digital_delivery: false,
    },
    marketplaceCategory: ['catering', 'food'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'menus', label: 'Menyer', color: '#ff9800' },
      { id: 'extras', label: 'Tillegg', color: '#ffb74d' },
    ],
  },

  music: {
    id: 'music',
    name: 'Musikk',
    nameEnglish: 'Music',
    color: '#9b59b6',
    icon: MusicNote,
    category: 'creative',
    primaryActions: [
      { label: 'Ny booking', icon: MusicNote, action: 'create_booking' },
      { label: 'Settlister', icon: Settings, action: 'manage_setlists' },
      { label: 'Kunder', icon: Business, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Bookinger', key: 'bookings', icon: MusicNote },
      { label: 'Settlister', key: 'setlists', icon: Settings },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['music', 'entertainment'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'performances', label: 'Opptredener', color: '#9b59b6' },
      { id: 'extras', label: 'Tillegg', color: '#b39ddb' },
    ],
  },

  venue: {
    id: 'venue',
    name: 'Venue',
    nameEnglish: 'Venue',
    color: '#6c5ce7',
    icon: Home,
    category: 'physical',
    primaryActions: [
      { label: 'Ny booking', icon: Home, action: 'create_booking' },
      { label: 'Kapasitet', icon: Settings, action: 'manage_capacity' },
      { label: 'Anmeldelser', icon: Store, action: 'manage_reviews' },
    ],
    quickStats: [
      { label: 'Bookinger', key: 'bookings', icon: Home },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Kapasitet', key: 'capacity', icon: Business },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: true,
      subscriptions: true,
      downloads: false,
      physical_shipping: true,
      digital_delivery: false,
    },
    marketplaceCategory: ['venue', 'location'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'packages', label: 'Pakker', color: '#6c5ce7' },
      { id: 'extras', label: 'Tillegg', color: '#a29bfe' },
    ],
  },

  cake: {
    id: 'cake',
    name: 'Kake',
    nameEnglish: 'Cake',
    color: '#f7b731',
    icon: Restaurant,
    category: 'service',
    primaryActions: [
      { label: 'Ny bestilling', icon: Restaurant, action: 'create_order' },
      { label: 'Smaker', icon: Settings, action: 'manage_flavors' },
      { label: 'Leveranser', icon: LocalShipping, action: 'manage_deliveries' },
    ],
    quickStats: [
      { label: 'Bestillinger', key: 'orders', icon: Restaurant },
      { label: 'Leveranser', key: 'deliveries', icon: LocalShipping },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: true,
      subscriptions: true,
      downloads: false,
      physical_shipping: true,
      digital_delivery: false,
    },
    marketplaceCategory: ['cake', 'dessert'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'designs', label: 'Design', color: '#f7b731' },
      { id: 'flavors', label: 'Smaker', color: '#f8c471' },
    ],
  },

  planner: {
    id: 'planner',
    name: 'Planlegger',
    nameEnglish: 'Planner',
    color: '#00bcd4',
    icon: Business,
    category: 'service',
    primaryActions: [
      { label: 'Ny plan', icon: Business, action: 'create_plan' },
      { label: 'Oppgaver', icon: Settings, action: 'manage_tasks' },
      { label: 'Kunder', icon: Business, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Prosjekter', key: 'projects', icon: Business },
      { label: 'Oppgaver', key: 'tasks', icon: Settings },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['planner', 'coordination'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'packages', label: 'Pakker', color: '#00bcd4' },
      { id: 'consulting', label: 'Rådgivning', color: '#4dd0e1' },
    ],
  },

  beauty: {
    id: 'beauty',
    name: 'Hair & Makeup',
    nameEnglish: 'Hair & Makeup',
    color: '#ec407a',
    icon: Healing,
    category: 'lifestyle',
    primaryActions: [
      { label: 'Ny booking', icon: Healing, action: 'create_booking' },
      { label: 'Pakker', icon: Settings, action: 'manage_packages' },
      { label: 'Kunder', icon: Business, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Bookinger', key: 'bookings', icon: Healing },
      { label: 'Pakker', key: 'packages', icon: Settings },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['beauty', 'styling'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'services', label: 'Tjenester', color: '#ec407a' },
      { id: 'packages', label: 'Pakker', color: '#f06292' },
    ],
  },

  transport: {
    id: 'transport',
    name: 'Transport',
    nameEnglish: 'Transport',
    color: '#4facfe',
    icon: DirectionsCar,
    category: 'physical',
    primaryActions: [
      { label: 'Ny booking', icon: DirectionsCar, action: 'create_booking' },
      { label: 'Ruter', icon: Settings, action: 'manage_routes' },
      { label: 'Kunder', icon: Business, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Bookinger', key: 'bookings', icon: DirectionsCar },
      { label: 'Ruter', key: 'routes', icon: Settings },
      { label: 'Tilbud', key: 'offers', icon: Settings },
      { label: 'Anmeldelser', key: 'reviews', icon: Store },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: true,
      bookings: true,
      subscriptions: true,
      downloads: false,
      physical_shipping: true,
      digital_delivery: false,
    },
    marketplaceCategory: ['transport', 'logistics'],
    targetCustomers: ['couples', 'events'],
    productCategories: [
      { id: 'vehicles', label: 'Kjoretoy', color: '#4facfe' },
      { id: 'packages', label: 'Pakker', color: '#6bb9ff' },
    ],
  },
};

// Expandable vendor types - can be added dynamically
export const expandableVendorTypes: Record<string, VendorTypeConfig> = {
  video: {
    id: 'video',
    name: 'Video & Film',
    nameEnglish: 'Video & Film',
    color: '#f44336',
    icon: Videocam,
    category: 'creative',
    primaryActions: [
      { label: 'Ny Template', icon: Videocam, action: 'create_template' },
      { label: 'Upload Effekt', icon: Lightbulb, action: 'upload_effect' },
      { label: 'Transition Manager', icon: Settings, action: 'manage_transitions' },
    ],
    quickStats: [
      { label: 'Templates', key: 'templates', icon: Videocam },
      { label: 'Effekter', key: 'effects', icon: Lightbulb },
      { label: 'Transitions', key: 'transitions', icon: Settings },
      { label: 'LUTs', key: 'luts', icon: PhotoCamera },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: false,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['video', 'film', 'effects'],
    targetCustomers: ['videographers', 'filmmakers', 'content_creators'],
  },

  education: {
    id: 'education',
    name: 'Utdanning & Kurs',
    nameEnglish: 'Education & Courses',
    color: '#4caf50',
    icon: School,
    category: 'education',
    primaryActions: [
      { label: 'Nytt Kurs', icon: School, action: 'create_course' },
      { label: 'Upload Innhold', icon: Settings, action: 'upload_content' },
      { label: 'Student Manager', icon: Store, action: 'manage_students' },
    ],
    quickStats: [
      { label: 'Kurs', key: 'courses', icon: School },
      { label: 'Studenter', key: 'students', icon: Store },
      { label: 'Sertifikater', key: 'certificates', icon: Security },
      { label: 'Ressurser', key: 'resources', icon: Settings },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: true,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['education', 'training', 'photography'],
    targetCustomers: ['photographers', 'students', 'professionals'],
  },

  services: {
    id: 'services',
    name: 'Tjenester & Service',
    nameEnglish: 'Services & Support',
    color: '#ff9800',
    icon: Store,
    category: 'service',
    primaryActions: [
      { label: 'Ny Tjeneste', icon: Store, action: 'create_service' },
      { label: 'Booking System', icon: Security, action: 'manage_bookings' },
      { label: 'Client Manager', icon: Store, action: 'manage_clients' },
    ],
    quickStats: [
      { label: 'Tjenester', key: 'services', icon: Store },
      { label: 'Bookinger', key: 'bookings', icon: Security },
      { label: 'Klienter', key: 'clients', icon: Store },
      { label: 'Anmeldelser', key: 'reviews', icon: Lightbulb },
    ],
    supportedFeatures: {
      showcase: true,
      pricing: true,
      inventory: false,
      bookings: true,
      subscriptions: true,
      downloads: false,
      physical_shipping: false,
      digital_delivery: true,
    },
    marketplaceCategory: ['services', 'consulting', 'support'],
    targetCustomers: ['all_professions', 'businesses', 'individuals'],
  },
};

// Registry management functions
export class VendorTypeRegistry {
  private static instance: VendorTypeRegistry;
  private vendorTypes: Map<string, VendorTypeConfig> = new Map();

  private constructor() {
    // Initialize with core types
    Object.entries(coreVendorTypes).forEach(([key, config]) => {
      this.vendorTypes.set(key, config);
    });
  }

  public static getInstance(): VendorTypeRegistry {
    if (!VendorTypeRegistry.instance) {
      VendorTypeRegistry.instance = new VendorTypeRegistry();
    }
    return VendorTypeRegistry.instance;
  }

  // Add new vendor type dynamically
  public addVendorType(config: VendorTypeConfig): boolean {
    if (this.vendorTypes.has(config.id)) {
      console.warn(`Vendor type ${config.id} already exists`);
      return false;
    }
    this.vendorTypes.set(config.id, config);
    console.log(`✅ Added vendor type: ${config.name}`);
    return true;
  }

  // Get vendor type config
  public getVendorType(id: string): VendorTypeConfig | undefined {
    return this.vendorTypes.get(id);
  }

  // Get all vendor types
  public getAllVendorTypes(): VendorTypeConfig[] {
    return Array.from(this.vendorTypes.values());
  }

  // Get vendor types by category
  public getVendorTypesByCategory(category: string): VendorTypeConfig[] {
    return Array.from(this.vendorTypes.values()).filter((vendor) => vendor.category === category);
  }

  // Enable expandable vendor type
  public enableExpandableType(typeId: string): boolean {
    if (expandableVendorTypes[typeId]) {
      return this.addVendorType(expandableVendorTypes[typeId]);
    }
    console.error(`Expandable vendor type ${typeId} not found`);
    return false;
  }

  // Remove vendor type (only expandable ones)
  public removeVendorType(id: string): boolean {
    if (coreVendorTypes[id]) {
      console.error(`Cannot remove core vendor type: ${id}`);
      return false;
    }
    const removed = this.vendorTypes.delete(id);
    if (removed) {
      console.log(`🗑️ Removed vendor type: ${id}`);
    }
    return removed;
  }

  // Update vendor type configuration
  public updateVendorType(id: string, updates: Partial<VendorTypeConfig>): boolean {
    const existing = this.vendorTypes.get(id);
    if (!existing) {
      console.error(`Vendor type ${id} not found`);
      return false;
    }

    const updated = { ...existing, ...updates, id }; // Preserve ID
    this.vendorTypes.set(id, updated);
    console.log(`🔄 Updated vendor type: ${id}`);
    return true;
  }

  // Check if vendor type supports feature
  public supportsFeature(
    vendorTypeId: string,
    feature: keyof VendorTypeConfig['supportedFeatures'],
  ): boolean {
    const config = this.getVendorType(vendorTypeId);
    return config?.supportedFeatures[feature] || false;
  }

  // Get marketplace categories
  public getMarketplaceCategories(): string[] {
    const categories = new Set<string>();
    this.vendorTypes.forEach((vendor) => {
      vendor.marketplaceCategory.forEach((cat) => categories.add(cat));
    });
    return Array.from(categories);
  }
}

// Export singleton instance
export const vendorRegistry = VendorTypeRegistry.getInstance();

// Export utility functions
export function getVendorTypeConfig(id: string): VendorTypeConfig | undefined {
  return vendorRegistry.getVendorType(id);
}

export function getAllVendorTypes(): VendorTypeConfig[] {
  return vendorRegistry.getAllVendorTypes();
}

export function enableVendorType(typeId: string): boolean {
  return vendorRegistry.enableExpandableType(typeId);
}

export function getEnabledVendorTypes(): VendorTypeConfig[] {
  return vendorRegistry.getAllVendorTypes();
}

// Get product categories for a vendor type
export function getProductCategories(vendorTypeId: string): { id: string; label: string; color: string }[] {
  const config = vendorRegistry.getVendorType(vendorTypeId);
  return config?.productCategories || [{ id: 'generell', label: 'Generell', color: '#9e9e9e' }];
}

export function supportsFeature(
  vendorTypeId: string,
  feature: keyof VendorTypeConfig['supportedFeatures'],
): boolean {
  return vendorRegistry.supportsFeature(vendorTypeId, feature);
}
