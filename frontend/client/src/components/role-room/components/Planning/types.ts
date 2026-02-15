/**
 * Type definitions for ProjectCreationModal and related components
 */

export type ProjectType = 
  | 'wedding' 
  | 'portrait' 
  | 'event' 
  | 'commercial'
  | 'video'
  | 'music'
  | 'family'
  | 'product'
  | 'fashion'
  | 'documentary'
  | 'corporate'
  | 'interview'
  | 'photoshoot'
  | 'promo'
  | 'workshop'
  | 'testshoot'
  | 'headshots'
  | 'editorial'
  | 'theater'
  | 'sports'
  | string; // Allow custom types

export type LabelingKey = 'ABCD' | 'EFGH' | 'NUMERIC';

export type MemoryCardBudget = 'budget' | 'mid' | 'premium' | 'professional';

export type ProjectPhase = 'pre-planning' | 'pre-production' | 'production' | 'post-production';

export type AccessLevel = 'public' | 'restricted' | 'private';

export type DownloadProtectionLevel = 'none' | 'watermark' | 'disabled';

export type ClientAccess = 'full' | 'limited' | 'readonly';

export type Watermark = 'none' | 'text' | 'logo' | 'both';

export type DownloadProtection = 'none' | 'password' | 'timelimit';

export type BackupStrategy = 'automatic' | 'manual';

export type BackupFrequency = 'realtime' | 'hourly' | 'daily';

export interface MemoryCardConfig {
  label: string;
  type: string;
  capacity: string;
  dayNumber: number;
  dayName: string;
  count?: number;
  estimatedPhotos?: number;
}

export interface SelectedMemoryCard {
  type: string;
  capacity: string;
  brand?: string;
  model?: string;
  count?: number;
  estimatedPhotos?: number;
}

export interface CustomPricing {
  basePrice: number;
  hourlyRate: number;
  travelCosts: number;
  additionalCosts: any[];
  discounts: any[];
  totalEstimate: number;
}

export interface ShowcaseGallerySecurity {
  pinRequired: boolean;
  pin: string;
  passwordRequired: boolean;
  password: string;
  accessLevel: AccessLevel;
  enableIpRestrictions: boolean;
  allowedIpRanges: string[];
  enableDownloadProtection: boolean;
  downloadProtectionLevel: DownloadProtectionLevel;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export interface WeddingTimelineSecurity {
  useShowcasePassword: boolean;
  customPassword: boolean;
  pin: string;
  password: string;
  accessLevel: AccessLevel;
}

export interface ScriptParameters {
  projectName: string;
  resolution: string;
  frameRate: number;
  colorSpace: string;
  timelineStructure: string;
  audioChannels: number;
  customSettings: Record<string, any>;
}

export interface PhaseHistoryItem {
  phase: string;
  timestamp: string;
  notes?: string;
}

export interface ProjectData {
  projectName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventDate: string;
  eventDates: Record<number, string>;
  location: string;
  projectType: ProjectType;
  weddingCulture: string;
  totalDays: number;
  activeDays: number[];
  memoryCardConfigs: MemoryCardConfig[];
  selectedMemoryCards: SelectedMemoryCard[];
  selectedCameras: any[];
  enhancedMemoryCardSelection: any | null;
  memoryCardBudget: MemoryCardBudget;
  editingSoftware: string;
  driveIntegration: boolean;
  profession: string;
  createShowcaseGallery: boolean;
  meetingOption: 'none' | 'now' | 'later';
  meetingDate: string;
  meetingTime: string;
  meetingDuration: number;
  shotList: any[];
  shotListTemplate: string;
  shotListCulture: string;
  saveAsDefault: boolean;
  budget: string;
  specialRequests: string;
  estimatedDuration: string;
  dailyHours: Record<number, number>;
  customDayNames: string[] | null;
  customCategories: string[];
  memoryCardLabeling: LabelingKey;
  perImagePrice: number;
  contractedImages: number;
  selectedPackage: any | null;
  customPricing: CustomPricing;
  automaticPricing: boolean;
  showcaseGallerySecurity: ShowcaseGallerySecurity;
  createWeddingTimeline: boolean;
  weddingTimelineShared: boolean;
  weddingTimelineUrl: string;
  weddingTimelineSecurity: WeddingTimelineSecurity;
  collaborators: any[];
  enableSplitSheet: boolean;
  splitSheetData: any | null;
  description: string;
  venue: string;
  guestCount: string;
  primaryCamera: string;
  backupCamera: string;
  estimatedPhotos: string;
  fileFormat: string;
  equipmentNotes: string;
  backupStrategy: BackupStrategy;
  backupFrequency: BackupFrequency;
  downloadProtection: DownloadProtection;
  watermark: Watermark;
  clientAccess: ClientAccess;
  meetingPreferences: Record<string, any>;
  currentPhase: ProjectPhase;
  phaseHistory: PhaseHistoryItem[];
  davinciIntegrationEnabled: boolean;
  scriptParameters: ScriptParameters;
  cameraBrand: string;
  logFormat: string;
  detectedLogFormats: string[];
}












