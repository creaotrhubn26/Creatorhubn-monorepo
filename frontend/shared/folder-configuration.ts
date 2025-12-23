/**
 * CENTRALIZED FOLDER CONFIGURATION
 * Single source of truth for all Google Drive folders
 * Change folder names/descriptions here and they update everywhere automatically
 */

export interface FolderConfig {
  id: string;
  name: string;
  description: string;
  requiredFeatures: string[];
  professions: string[];
  plan: 'basic' | 'pro' | 'enterprise' | 'marketplace';
  category: 'default' | 'story-arc' | 'davinci' | 'video' | 'audio' | 'photo' | 'business' | 'academy' | 'admin';
}

/**
 * MASTER FOLDER CONFIGURATION
 * ✅ SINGLE SOURCE OF TRUTH - Change folder names/descriptions here only!
 */
export const MASTER_FOLDER_CONFIG: FolderConfig[] = [
  // ========================================
  // DEFAULT FOLDERS (Core 8-Folder Structure)
  // Available to ALL users, ALL professions, ALL plans
  // ========================================
  {
    id: '01_Raw',
    name: 'Raw',
    description: 'Raw files and original content',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '02_Edited',
    name: 'Edited',
    description: 'Edited and processed files',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '03_Proofing',
    name: 'Proofing',
    description: 'Files for client review and approval',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '04_Deliverables',
    name: 'Deliverables',
    description: 'Final deliverables for clients',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '05_Archive',
    name: 'Archive',
    description: 'Archived projects and files',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '06_Client_Communication',
    name: 'Client Communication',
    description: 'Client emails and messages',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '07_Project_Documents',
    name: 'Project Documents',
    description: 'Contracts, invoices, and documents',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },
  {
    id: '08_Showcase',
    name: 'Showcase',
    description: 'Portfolio and showcase content',
    requiredFeatures: ['universal-showcase'],
    professions: ['all'],
    plan: 'basic',
    category: 'default',
  },

  // ========================================
  // STORY ARC STUDIO (9-16)
  // Requires: story-arc-studio feature
  // ========================================
  {
    id: '09_Raw_Footage',
    name: 'Raw Footage',
    description: 'Original video recordings for story arcs',
    requiredFeatures: ['story-arc-studio'],
    professions: ['videographer', 'photographer'],
    plan: 'pro',
    category: 'story-arc',
  },
  {
    id: '10_Edited_Files',
    name: 'Edited Files',
    description: 'Edited video files',
    requiredFeatures: ['story-arc-studio'],
    professions: ['videographer', 'photographer'],
    plan: 'pro',
    category: 'story-arc',
  },
  {
    id: '11_Client_Review',
    name: 'Client Review',
    description: 'Files for client review',
    requiredFeatures: ['story-arc-studio'],
    professions: ['videographer', 'photographer'],
    plan: 'pro',
    category: 'story-arc',
  },
  {
    id: '12_Final_Delivery',
    name: 'Final Delivery',
    description: 'Final video deliverables',
    requiredFeatures: ['story-arc-studio'],
    professions: ['videographer', 'photographer'],
    plan: 'pro',
    category: 'story-arc',
  },

  // ========================================
  // DAVINCI RESOLVE INTEGRATION (17-24)
  // Requires: davinci-resolve-integration feature
  // ========================================
  {
    id: '17_Resolve_Projects',
    name: 'Resolve Projects',
    description: 'DaVinci Resolve project files',
    requiredFeatures: ['davinci-resolve-integration'],
    professions: ['videographer'],
    plan: 'pro',
    category: 'davinci',
  },
  {
    id: '18_Resolve_Timelines',
    name: 'Resolve Timelines',
    description: 'DaVinci Resolve timelines',
    requiredFeatures: ['davinci-resolve-integration'],
    professions: ['videographer'],
    plan: 'pro',
    category: 'davinci',
  },
  {
    id: '19_Resolve_Clips',
    name: 'Resolve Clips',
    description: 'DaVinci Resolve clips',
    requiredFeatures: ['davinci-resolve-integration'],
    professions: ['videographer'],
    plan: 'pro',
    category: 'davinci',
  },
  {
    id: '20_Resolve_Transitions',
    name: 'Resolve Transitions',
    description: 'DaVinci Resolve transitions',
    requiredFeatures: ['davinci-resolve-integration'],
    professions: ['videographer'],
    plan: 'pro',
    category: 'davinci',
  },

  // ========================================
  // VIDEO PRODUCTION (25-40)
  // Requires: video-enhancement-suite feature
  // ========================================
  {
    id: '25_Video_Projects',
    name: 'Video Projects',
    description: 'Video project files',
    requiredFeatures: ['video-enhancement-suite'],
    professions: ['videographer'],
    plan: 'basic',
    category: 'video',
  },
  {
    id: '26_Raw_Footage',
    name: 'Raw Footage',
    description: 'Raw video footage',
    requiredFeatures: ['video-enhancement-suite'],
    professions: ['videographer'],
    plan: 'basic',
    category: 'video',
  },
  {
    id: '27_Edited_Videos',
    name: 'Edited Videos',
    description: 'Edited video files',
    requiredFeatures: ['video-enhancement-suite'],
    professions: ['videographer'],
    plan: 'basic',
    category: 'video',
  },

  // ========================================
  // MUSIC PRODUCTION (41-60)
  // Requires: audio-enhancement-suite feature
  // ========================================
  {
    id: '41_Music_Projects',
    name: 'Music Projects',
    description: 'Music production projects',
    requiredFeatures: ['audio-enhancement-suite'],
    professions: ['music_producer'],
    plan: 'basic',
    category: 'audio',
  },
  {
    id: '42_Audio_Samples',
    name: 'Audio Samples',
    description: 'Audio samples and loops',
    requiredFeatures: ['audio-enhancement-suite'],
    professions: ['music_producer'],
    plan: 'basic',
    category: 'audio',
  },
  {
    id: '43_Mastering',
    name: 'Mastering',
    description: 'Mastered audio files',
    requiredFeatures: ['audio-enhancement-suite'],
    professions: ['music_producer'],
    plan: 'pro',
    category: 'audio',
  },

  // ========================================
  // PHOTOGRAPHY (61-80)
  // Requires: photo-enhancement-suite feature
  // ========================================
  {
    id: '61_Photo_Enhancement',
    name: 'Photo Enhancement',
    description: 'Enhanced photos',
    requiredFeatures: ['photo-enhancement-suite'],
    professions: ['photographer'],
    plan: 'pro',
    category: 'photo',
  },
  {
    id: '62_Composition_Analysis',
    name: 'Composition Analysis',
    description: 'Photo composition analysis',
    requiredFeatures: ['photo-enhancement-suite'],
    professions: ['photographer'],
    plan: 'pro',
    category: 'photo',
  },
  {
    id: '63_Moodboards',
    name: 'Moodboards',
    description: 'Photo moodboards and inspiration',
    requiredFeatures: ['photo-enhancement-suite'],
    professions: ['photographer'],
    plan: 'basic',
    category: 'photo',
  },

  // ========================================
  // BUSINESS ADMINISTRATION (101-120)
  // ========================================
  {
    id: '101_Financial_Records',
    name: 'Financial Records',
    description: 'Financial records and accounting',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'business',
  },
  {
    id: '102_Business_Analytics',
    name: 'Business Analytics',
    description: 'Business analytics and reports',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'pro',
    category: 'business',
  },
  {
    id: '103_Lead_Management',
    name: 'Lead Management',
    description: 'Lead tracking and management',
    requiredFeatures: [],
    professions: ['all'],
    plan: 'basic',
    category: 'business',
  },

  // ========================================
  // ACADEMY & EDUCATION (161-170)
  // Requires: academy-course-creation feature
  // ========================================
  {
    id: '161_Photography_Courses',
    name: 'Photography Courses',
    description: 'Photography course content',
    requiredFeatures: ['academy-course-creation'],
    professions: ['photographer'],
    plan: 'pro',
    category: 'academy',
  },
  {
    id: '162_Videography_Courses',
    name: 'Videography Courses',
    description: 'Videography course content',
    requiredFeatures: ['academy-course-creation'],
    professions: ['videographer'],
    plan: 'pro',
    category: 'academy',
  },
  {
    id: '163_Music_Production_Courses',
    name: 'Music Production Courses',
    description: 'Music production course content',
    requiredFeatures: ['academy-course-creation'],
    professions: ['music_producer'],
    plan: 'pro',
    category: 'academy',
  },

  // ========================================
  // ADMIN (BI Reports)
  // ========================================
  {
    id: 'BI_Reports',
    name: 'BI Reports',
    description: 'Business Intelligence reports',
    requiredFeatures: [],
    professions: ['admin'],
    plan: 'basic',
    category: 'admin',
  },
];

/**
 * HELPER FUNCTIONS - Auto-generated from MASTER_FOLDER_CONFIG
 */

// Get all default folders
export function getDefaultFolders(): string[] {
  return MASTER_FOLDER_CONFIG
    .filter(folder => folder.category === 'default')
    .map(folder => folder.id);
}

// Get feature folder mapping
export function getFeatureFolderMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  MASTER_FOLDER_CONFIG
    .filter(folder => folder.requiredFeatures.length > 0)
    .forEach(folder => {
      folder.requiredFeatures.forEach(featureId => {
        if (!map[featureId]) {
          map[featureId] = [];
        }
        map[featureId].push(folder.id);
      });
    });

  return map;
}

// Get folder by ID
export function getFolderById(folderId: string): FolderConfig | undefined {
  return MASTER_FOLDER_CONFIG.find(folder => folder.id === folderId);
}

// Get all folders for a profession
export function getFoldersForProfession(profession: string): FolderConfig[] {
  return MASTER_FOLDER_CONFIG.filter(folder =>
    folder.professions.includes('all') || folder.professions.includes(profession)
  );
}

// Get folder names dictionary
export function getFolderNamesDictionary(): Record<string, { name: string; description: string }> {
  const dict: Record<string, { name: string; description: string }> = {};

  MASTER_FOLDER_CONFIG.forEach(folder => {
    dict[folder.id] = {
      name: folder.name,
      description: folder.description,
    };
  });

  return dict;
}

// Get folders by category
export function getFoldersByCategory(category: FolderConfig['category']): FolderConfig[] {
  return MASTER_FOLDER_CONFIG.filter(folder => folder.category === category);
}

