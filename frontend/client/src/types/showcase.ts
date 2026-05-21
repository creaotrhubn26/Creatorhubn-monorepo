export type ProfessionType = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';

export interface SearchQuery {
  text?: string;
  categories?: string[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  camera?: string;
  lens?: string;
  location?: string;
  person?: string[];
  minRating?: number;
  fileType?: string[];
  customFilters?: Record<string, any>;
}

export interface ShowcaseCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ShowcaseSet {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  items: string[];
  coverImageId?: string;
  sortOrder: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ShowcaseCollection {
  id: string;
  name: string;
  description?: string;
  items: string[];
  visibility: 'private' | 'team' | 'public';
  dynamic: boolean;
  savedQuery?: SearchQuery;
  tags?: string[];
  coverImageId?: string;
  collaborators?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}

export interface ItemAnnotation {
  id: string;
  itemId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  type: 'note' | 'marker' | 'region';
  color?: string;
  createdAt: Date;
  createdBy: string;
  version: number;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileType: 'video' | 'photo' | 'audio' | 'document' | 'design';
  tags?: string[];
  clientName?: string;
  projectType?: string;
  category?: string;
  createdAt?: string;
  /**
   * @deprecated Bruk isFeatured i stedet. Beholdt for bakoverkompatibilitet med
   * eldre data i DB. Slice 9X.81 — alle lesninger bør gå via isShowcaseItemFeatured().
   */
  featured?: boolean;
  isFeatured?: boolean;
  type?: string;
  stats?: {
    views?: number;
    likes?: number;
    downloads?: number;
  };
  brandLogoUrl?: string;
  lqipDataUrl?: string;
  dominantColor?: string;
  checksum?: string;
  googlePhotosData?: any;
  categoryId?: string;
  setId?: string;
  collectionIds?: string[];
  annotations?: ItemAnnotation[];
  exif?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: string;
    dateTime?: Date;
    gps?: { lat: number; lng: number };
    orientation?: number;
    colorSpace?: string;
    iccProfile?: string;
  };
  focalPoint?: { x: number; y: number };
  similarityHash?: string;
  aiTags?: string[];
  exportPresets?: Record<string, any>;
  projectId?: string;
  duration?: number;
  cropData?: { x: number; y: number; width: number; height: number };
  downloadPassword?: string;
  fileSize?: number;
  size?: number;
}

export interface ClientSession {
  id: string;
  sessionName: string;
  clientName: string;
  maxSelections: number;
  minSelections: number;
  selectionDeadline: string;
  status: 'setup' | 'active' | 'selections_made' | 'approved' | 'delivered' | 'expired';
  proofingRound: number;
  selectedCount: number;
  description?: string;
}

export interface UniversalShowcaseProps {
  profession: ProfessionType;
  userId?: string;
  compact?: boolean;
  maxItems?: number;
  isOwner?: boolean;
  adminMode?: boolean;
  clientMode?: boolean;
  sessionIdd?: string;
  clientEmail?: string;
  isPublic?: boolean;
  proofingToken?: string;
  maxSelections?: number;
  deadline?: Date;
  round?: number;
  enableGoogleDriveSync?: boolean;
  onGoogleDriveSync?: (items: any[]) => void;
  googleDriveFolderId?: string;
  integrationContext?: any;
  onItemSelect?: (item: any) => void;
  onItemUpdate?: (item: any) => void;
  onItemDelete?: (item: any) => void;
  enableRealTimeSync?: boolean;
  collaborationSessionId?: string;
  enableAIAnalysis?: boolean;
  enableAutoTagging?: boolean;
  enableSmartCollections?: boolean;
}
