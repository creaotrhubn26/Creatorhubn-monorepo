/**
 * Video Profession Camera Database
 * Cameras with LOG support for professional video production
 */

export interface Camera {
  id: string;
  brand: string;
  model: string;
  category: 'cinema' | 'mirrorless' | 'dslr' | 'action' | 'phone' | 'drone' | 'medium-format' | 'point-and-shoot' | 'instant' | 'film';
  logFormats: string[];
  resolution: string[];
  frameRates: string[];
  colorSpace: string[];
  priceRange: 'budget' | 'mid-range' | 'professional' | 'cinema';
  description: string;
  features: string[];
  isVideoOptimized: boolean;
  isPhotoOptimized: boolean;
  // Photo-specific properties
  megapixels?: number;
  sensorSize?: string;
  isoRange?: string;
  shutterSpeed?: string;
  burstMode?: string;
  autofocusPoints?: number;
  imageStabilization?: boolean;
  weatherSealing?: boolean;
  batteryLife?: string;
  // Video-specific properties
  videoResolution?: string[];
  videoFrameRates?: string[];
  videoCodecs?: string[];
  // Common properties
  mount?: string;
  weight?: string;
  dimensions?: string;
  releaseDate?: string;
  // Dynamic update properties
  addedDate: string; // When this camera was added to the database
  lastUpdated: string; // When this camera was last updated
  isNew: boolean; // True if added within last 30 days
  isRecentlyUpdated: boolean; // True if updated within last 7 days
  source: 'manual' | 'api' | 'discovery'; // How this camera was added
  version: number; // Version number for tracking updates
}

// Legacy type alias for backward compatibility
export type VideoCamera = Camera;

export const VIDEO_CAMERA_DATABASE: Camera[] = [
  // SONY CAMERAS
  {
    id: 'sony-a7s',
    brand: 'Sony',
    model: 'A7S II',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'professional',
    description: 'Full-frame mirrorless with exceptional low-light performance',
    features: ['4K 120fps','10-bit recording','S-Log3','S-Cinetone'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-a7r',
    brand: 'Sony',
    model: 'A7R',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'professional',
    description: 'High-resolution full-frame mirrorless with 8K video',
    features: ['8K 24fps','4K 60fps','10-bit recording','S-Log3'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-a7c',
    brand: 'Sony',
    model: 'A7C I',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'mid-range',
    description: 'Compact full-frame mirrorless with excellent video',
    features: ['4K 60fps','10-bit recording','S-Log3','S-Cinetone'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-a7c-',
    brand: 'Sony',
    model: 'A7C',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'professional',
    description: 'Compact high-resolution full-frame mirrorless',
    features: ['8K 24fps','4K 60fps','10-bit recording','S-Log3'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx30',
    brand: 'Sony',
    model: 'FX3',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'professional',
    description: 'Cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','S-Log3','XAVC-I'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx',
    brand: 'Sony',
    model: 'FX',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with full-frame sensor',
    features: ['6K 30fps','4K 120fps','16-bit RAW','S-Log3'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx',
    brand: 'Sony',
    model: 'FX',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with full-frame sensor',
    features: ['4K 120fps','16-bit RAW','S-Log3','XAVC-I','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx',
    brand: 'Sony',
    model: 'FX',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'cinema',
    description: 'Cinema camera with A7S III sensor and professional features',
    features: ['4K 120fps','16-bit RAW','S-Log3','XAVC-I'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-a7iv',
    brand: 'Sony',
    model: 'A7 I',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'mid-range',
    description: 'Versatile full-frame mirrorless with excellent video capabilities',
    features: ['4K 60fps','10-bit recording','S-Log3','S-Cinetone'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-a670',
    brand: 'Sony',
    model: 'A670',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'mid-range',
    description: 'APS-C mirrorless with professional video features',
    features: ['4K 120fps','10-bit recording','S-Log3','S-Cinetone'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-zv-e',
    brand: 'Sony',
    model: 'ZV-E',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'mid-range',
    description: 'Content creator focused full-frame mirrorless',
    features: ['4K 120fps','10-bit recording','S-Log3','S-Cinetone'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx',
    brand: 'Sony',
    model: 'FX',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with full-frame sensor',
    features: ['4K 120fps','16-bit RAW','S-Log3','XAVC-I','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx',
    brand: 'Sony',
    model: 'FX',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'cinema',
    description: 'Cinema camera with A7S III sensor and professional features',
    features: ['4K 120fps','16-bit RAW','S-Log3','XAVC-I'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-fx',
    brand: 'Sony',
    model: 'FX',
    category: 'cinema',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with full-frame sensor',
    features: ['4K 120fps','16-bit RAW','S-Log3','XAVC-I','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'sony-a7iv',
    brand: 'Sony',
    model: 'A7 I',
    category: 'mirrorless',
    logFormats: ['S-Log','S-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','S-Gamut3.Cine','Rec.709'],
    priceRange: 'mid-range',
    description: 'Versatile full-frame mirrorless with excellent video capabilities',
    features: ['4K 60fps','10-bit recording','S-Log3','S-Cinetone'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // CANON CAMERAS
  {
    id: 'canon-r',
    brand: 'Canon',
    model: 'EOS R',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: '8K capable mirrorless with professional video features',
    features: ['8K RA','4K 120fps','C-Log3','Canon Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r5-mkii',
    brand: 'Canon',
    model: 'EOS R5 Mark I',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Latest 8K mirrorless with enhanced video capabilities',
    features: ['8K 60fps','4K 120fps','C-Log3','Canon Log','Pre-roll recording'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r6-mkii',
    brand: 'Canon',
    model: 'EOS R6 Mark I',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Enhanced full-frame mirrorless with 6K video',
    features: ['6K 60fps','4K 120fps','C-Log3','Canon Log','Pre-roll recording'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c40',
    brand: 'Canon',
    model: 'EOS C40',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with RF mount',
    features: ['6K 60fps','4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c50',
    brand: 'Canon',
    model: 'EOS C5',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Compact cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c80',
    brand: 'Canon',
    model: 'EOS C8',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with full-frame sensor',
    features: ['6K 60fps','4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c300-mkiii',
    brand: 'Canon',
    model: 'EOS C300 Mark II',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c500-mkii',
    brand: 'Canon',
    model: 'EOS C500 Mark I',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with full-frame sensor',
    features: ['6K 60fps','4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c70',
    brand: 'Canon',
    model: 'EOS C7',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with RF mount',
    features: ['4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r',
    brand: 'Canon',
    model: 'EOS R',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Full-frame mirrorless with excellent video performance',
    features: ['4K 60fps','10-bit recording','C-Log3','Canon Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r',
    brand: 'Canon',
    model: 'EOS R',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Professional mirrorless with 6K video and eye control',
    features: ['6K 60fps','4K 120fps','C-Log3','Canon Log','Eye Control AF'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r',
    brand: 'Canon',
    model: 'EOS R',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Entry-level full-frame mirrorless with video capabilities',
    features: ['4K 60fps','10-bit recording','C-Log3','Canon Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r10',
    brand: 'Canon',
    model: 'EOS R1',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'APS-C mirrorless with video capabilities',
    features: ['4K 60fps','10-bit recording','C-Log3','Canon Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r',
    brand: 'Canon',
    model: 'EOS R',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'APS-C mirrorless with professional video features',
    features: ['4K 120fps','10-bit recording','C-Log3','Canon Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-r',
    brand: 'Canon',
    model: 'EOS R',
    category: 'mirrorless',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Full-frame mirrorless with excellent video performance',
    features: ['4K 60fps','10-bit recording','C-Log3','Canon Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c70',
    brand: 'Canon',
    model: 'EOS C7',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with RF mount',
    features: ['4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'canon-c30',
    brand: 'Canon',
    model: 'EOS C300 Mark II',
    category: 'cinema',
    logFormats: ['C-Log','C-Log2','C-Log3'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Canon Log','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','C-Log3','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // PANASONIC CAMERAS
  {
    id: 'panasonic-gh',
    brand: 'Panasonic',
    model: 'Lumix GH',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['5.7','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Micro Four Thirds camera with exceptional video capabilities',
    features: ['5.7K 60fps','10-bit recording','V-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-s5-ii',
    brand: 'Panasonic',
    model: 'Lumix S5 I',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Full-frame mirrorless with phase detection AF and 6K video',
    features: ['6K 30fps','4K 120fps','V-Log','ProRes','Phase Detection AF'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-s5-iix',
    brand: 'Panasonic',
    model: 'Lumix S5 II',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Full-frame mirrorless with ProRes recording and 6K video',
    features: ['6K 30fps','4K 120fps','V-Log','ProRes','SSD Recording'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-s',
    brand: 'Panasonic',
    model: 'Lumix S',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Full-frame mirrorless with professional video features',
    features: ['4K 60fps','10-bit recording','V-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-gh5-ii',
    brand: 'Panasonic',
    model: 'Lumix GH5 I',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Micro Four Thirds camera with enhanced video capabilities',
    features: ['4K 120fps','10-bit recording','V-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-gh5',
    brand: 'Panasonic',
    model: 'Lumix GH5',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Micro Four Thirds camera optimized for video and low light',
    features: ['4K 120fps','10-bit recording','V-Log','ProRes','Dual Native ISO'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-bgh',
    brand: 'Panasonic',
    model: 'Lumix BGH',
    category: 'cinema',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Box-style cinema camera for professional workflows',
    features: ['4K 60fps','10-bit recording','V-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-varicam-lt',
    brand: 'Panasonic',
    model: 'Varicam L',
    category: 'cinema',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','V-Log','ProRes','Dual Native ISO'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-varicam-3',
    brand: 'Panasonic',
    model: 'Varicam 3',
    category: 'cinema',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','V-Log','ProRes','Dual Native ISO'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-g9-ii',
    brand: 'Panasonic',
    model: 'Lumix G9 I',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['5.7','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Micro Four Thirds camera with phase detection A',
    features: ['5.7K 30fps','4K 120fps','V-Log','ProRes','Phase Detection AF'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-s',
    brand: 'Panasonic',
    model: 'Lumix S',
    category: 'mirrorless',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Full-frame mirrorless with professional video features',
    features: ['4K 60fps','10-bit recording','V-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'panasonic-bgh',
    brand: 'Panasonic',
    model: 'Lumix BGH',
    category: 'cinema',
    logFormats: ['V-Log','V-LogL'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['V-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Box-style cinema camera for professional workflows',
    features: ['4K 60fps','10-bit recording','V-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // ARRI CAMERAS
  {
    id: 'arri-alexa-mini',
    brand: 'ARR',
    model: 'Alexa Mini L',
    category: 'cinema',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with large format sensor',
    features: ['4K 120fps','16-bit RAW','LogC','ARRI Color Science'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'arri-alexa-3',
    brand: 'ARR',
    model: 'Alexa 3',
    category: 'cinema',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Latest ARRI cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','LogC','ARRI Color Science'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'arri-alexa-mini',
    brand: 'ARR',
    model: 'Alexa Mini',
    category: 'cinema',
    logFormats: [''],
    resolution: ['3.2','2K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Compact professional cinema camera with Super 35mm sensor',
    features: ['3.2K 120fps','16-bit RAW','LogC','ARRI Color Science'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'arri-alexa-lf',
    brand: 'ARR',
    model: 'Alexa L',
    category: 'cinema',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with large format sensor',
    features: ['4K 120fps','16-bit RAW','LogC','ARRI Color Science'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'arri-alexa-sxt',
    brand: 'ARR',
    model: 'Alexa SX',
    category: 'cinema',
    logFormats: [''],
    resolution: ['3.2','2K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with Super 35mm sensor',
    features: ['3.2K 120fps','16-bit RAW','LogC','ARRI Color Science'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'arri-alexa-3',
    brand: 'ARR',
    model: 'Alexa 3',
    category: 'cinema',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['ARRI Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Latest ARRI cinema camera with Super 35mm sensor',
    features: ['4K 120fps','16-bit RAW','LogC','ARRI Color Science'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // BLACKMAGIC CAMERAS
  {
    id: 'blackmagic-pocket-6',
    brand: 'Blackmagic',
    model: 'Pocket Cinema Camera 6',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Affordable cinema camera with 6K recording',
    features: ['6K RA','4K 120fps','BMD Film','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-pocket-6k-pro',
    brand: 'Blackmagic',
    model: 'Pocket Cinema Camera 6K Pro',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Professional cinema camera with 6K recording and built-in N',
    features: ['6K RA','4K 120fps','BMD Film','ProRes','Built-in ND'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-pocket-4',
    brand: 'Blackmagic',
    model: 'Pocket Cinema Camera 4',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Entry-level cinema camera with 4K recording',
    features: ['4K RA','4K 120fps','BMD Film','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-ursa-12',
    brand: 'Blackmagic',
    model: 'URSA Mini Pro 12',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['12','8K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Professional cinema camera with 12K recording',
    features: ['12K RA','8K 60fps','BMD Film','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-ursa-4',
    brand: 'Blackmagic',
    model: 'URSA Mini Pro 4.6',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['4.6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Professional cinema camera with 4.6K recording',
    features: ['4.6K RA','4K 120fps','BMD Film','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-studio-camera-4',
    brand: 'Blackmagic',
    model: 'Studio Camera 4K Plus',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Studio camera with 4K recording and live streaming',
    features: ['4K RA','4K 60fps','BMD Film','ProRes','Live Streaming'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-pyxis-6',
    brand: 'Blackmagic',
    model: 'Pyxis 6',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Compact cinema camera with 6K recording',
    features: ['6K RA','4K 120fps','BMD Film','ProRes','Compact Design'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'blackmagic-ursa-12',
    brand: 'Blackmagic',
    model: 'URSA Mini Pro 12',
    category: 'cinema',
    logFormats: ['BMD Film, ', ],
    resolution: ['12','8K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Blackmagic Film','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Professional cinema camera with 12K recording',
    features: ['12K RA','8K 60fps','BMD Film','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // RED CAMERAS
  {
    id: 'red-komodo',
    brand: 'RE',
    model: 'Komodo',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Compact cinema camera with RED quality',
    features: ['6K RA','4K 120fps','RED LogFilm','RED IPP2'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'red-komodo-',
    brand: 'RE',
    model: 'Komodo-',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Enhanced compact cinema camera with RED quality',
    features: ['6K RA','4K 120fps','RED LogFilm','RED IPP2','Global Shutter'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'red-raptor',
    brand: 'RE',
    model: 'Raptor',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['8','6K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with 8K recording',
    features: ['8K RA','6K 120fps','RED LogFilm','RED IPP2'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'red-raptor-xl',
    brand: 'RE',
    model: 'Raptor X',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['8','6K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with 8K recording and XL features',
    features: ['8K RA','6K 120fps','RED LogFilm','RED IPP2','XL Features'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'red-ranger',
    brand: 'RE',
    model: 'Ranger',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['8','6K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with 8K recording',
    features: ['8K RA','6K 120fps','RED LogFilm','RED IPP2'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'red-gemini',
    brand: 'RE',
    model: 'Gemini',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['5','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Professional cinema camera with 5K recording',
    features: ['5K RA','4K 120fps','RED LogFilm','RED IPP2'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'red-raptor',
    brand: 'RE',
    model: 'Raptor',
    category: 'cinema',
    logFormats: ['RED LogFilm','RED IPP2'],
    resolution: ['8','6K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['RED Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with 8K recording',
    features: ['8K RA','6K 120fps','RED LogFilm','RED IPP2'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // FUJIFILM CAMERAS
  {
    id: 'fujifilm-xh2',
    brand: 'Fujifilm',
    model: 'X-H2',
    category: 'mirrorless',
    logFormats: ['F-Log','F-Log2'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'APS-C mirrorless with professional video features',
    features: ['6K 30fps','4K 120fps','F-Log2','ProRes','Phase Detection AF'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-xh',
    brand: 'Fujifilm',
    model: 'X-H',
    category: 'mirrorless',
    logFormats: ['F-Log','F-Log2'],
    resolution: ['8','6K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'High-resolution APS-C mirrorless with 8K video',
    features: ['8K 30fps','6K 30fps','4K 60fps','F-Log2','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-xt',
    brand: 'Fujifilm',
    model: 'X-T',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Versatile mirrorless with excellent video capabilities',
    features: ['4K 60fps','10-bit recording','F-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-xt',
    brand: 'Fujifilm',
    model: 'X-T',
    category: 'mirrorless',
    logFormats: ['F-Log','F-Log2'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'High-resolution mirrorless with 6K video',
    features: ['6K 30fps','4K 60fps','F-Log2','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-x-s20',
    brand: 'Fujifilm',
    model: 'X-S2',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Content creator focused APS-C mirrorless',
    features: ['6K 30fps','4K 60fps','F-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-x-s10',
    brand: 'Fujifilm',
    model: 'X-S1',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Entry-level APS-C mirrorless with video capabilities',
    features: ['4K 30fps','10-bit recording','F-Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-x-t30-ii',
    brand: 'Fujifilm',
    model: 'X-T30 I',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Compact APS-C mirrorless with video features',
    features: ['4K 30fps','10-bit recording','F-Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-gfx100',
    brand: 'Fujifilm',
    model: 'GFX 100',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Medium format mirrorless with video capabilities',
    features: ['4K 30fps','10-bit recording','F-Log','Medium Format'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-gfx100-ii',
    brand: 'Fujifilm',
    model: 'GFX 100 I',
    category: 'mirrorless',
    logFormats: ['F-Log','F-Log2'],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Medium format mirrorless with 8K video',
    features: ['8K 30fps','4K 60fps','F-Log2','ProRes','Medium Format'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-gfx-eterna-5',
    brand: 'Fujifilm',
    model: 'GFX Eterna 5',
    category: 'cinema',
    logFormats: ['F-Log','F-Log2'],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Professional cinema camera with medium format sensor',
    features: ['6K 60fps','4K 120fps','F-Log2','ProRes','Medium Format'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'fujifilm-xt',
    brand: 'Fujifilm',
    model: 'X-T',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['F-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Versatile mirrorless with excellent video capabilities',
    features: ['4K 60fps','10-bit recording','F-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // NIKON CAMERAS
  {
    id: 'nikon-z',
    brand: 'Nikon',
    model: 'Z',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Flagship mirrorless with 8K video recording',
    features: ['8K 30fps','4K 120fps','N-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z',
    brand: 'Nikon',
    model: 'Z',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Compact flagship mirrorless with 8K video',
    features: ['8K 30fps','4K 120fps','N-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z6-iii',
    brand: 'Nikon',
    model: 'Z6 II',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['6','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Enhanced full-frame mirrorless with 6K video',
    features: ['6K 60fps','4K 120fps','N-Log','ProRes','Phase Detection AF'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z6-ii',
    brand: 'Nikon',
    model: 'Z6 I',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Full-frame mirrorless with professional video',
    features: ['4K 60fps','10-bit recording','N-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z7-ii',
    brand: 'Nikon',
    model: 'Z7 I',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'High-resolution full-frame mirrorless with video',
    features: ['4K 60fps','10-bit recording','N-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z',
    brand: 'Nikon',
    model: 'Z',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Entry-level full-frame mirrorless with video',
    features: ['4K 30fps','10-bit recording','N-Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z50',
    brand: 'Nikon',
    model: 'Z5',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'APS-C mirrorless with video capabilities',
    features: ['4K 30fps','10-bit recording','N-Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z30',
    brand: 'Nikon',
    model: 'Z3',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Content creator focused APS-C mirrorless',
    features: ['4K 30fps','10-bit recording','N-Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-zfc',
    brand: 'Nikon',
    model: 'Zfc',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Retro-styled APS-C mirrorless with video',
    features: ['4K 30fps','10-bit recording','N-Log'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'nikon-z',
    brand: 'Nikon',
    model: 'Z6 I',
    category: 'mirrorless',
    logFormats: [''],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['N-Gamut','Rec.709','Rec.2020'],
    priceRange: 'mid-range',
    description: 'Full-frame mirrorless with professional video',
    features: ['4K 60fps','10-bit recording','N-Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // DJI CAMERAS
  {
    id: 'dji-mini',
    brand: 'DJ',
    model: 'Mini 3 Pro',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'budget',
    description: 'Compact drone with 4K video and LOG recording',
    features: ['4K 60fps','D-Log','HDR','Gimbal stabilization'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-mini',
    brand: 'DJ',
    model: 'Mini 4 Pro',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'budget',
    description: 'Latest compact drone with 4K video and LOG recording',
    features: ['4K 60fps','D-Log','HDR','Gimbal stabilization','ActiveTrack 5.0'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-air2',
    brand: 'DJ',
    model: 'Air 2',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['5.4','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'mid-range',
    description: 'Professional drone with 5.4K video recording',
    features: ['5.4K 30fps','4K 60fps','D-Log','HDR'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-air',
    brand: 'DJ',
    model: 'Air 3',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'mid-range',
    description: 'Professional drone with dual camera system',
    features: ['4K 60fps','D-Log','HDR','Dual Camera System'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-mavic',
    brand: 'DJ',
    model: 'Mavic 3',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['5.1','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'professional',
    description: 'Professional drone with 5.1K video recording',
    features: ['5.1K 50fps','4K 120fps','D-Log','HDR','Dual Camera'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-mavic3-pro',
    brand: 'DJ',
    model: 'Mavic 3 Pro',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['5.1','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'professional',
    description: 'Professional drone with triple camera system',
    features: ['5.1K 50fps','4K 120fps','D-Log','HDR','Triple Camera'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-inspire',
    brand: 'DJ',
    model: 'Inspire 3',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['8','6K','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'cinema',
    description: 'Professional cinema drone with 8K video recording',
    features: ['8K 25fps','6K 50fps','D-Log','HDR','Cinema Grade'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'dji-air2',
    brand: 'DJ',
    model: 'Air 2',
    category: 'drone',
    logFormats: ['D-Log','D-LogM'],
    resolution: ['5.4','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['D-Gamut','Rec.709'],
    priceRange: 'mid-range',
    description: 'Professional drone with 5.4K video recording',
    features: ['5.4K 30fps','4K 60fps','D-Log','HDR'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // APPLE CAMERAS
  {
    id: 'apple-iphone15',
    brand: 'Apple',
    model: 'iPhone 15 Pro',
    category: 'phone',
    logFormats: ['Apple Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with professional video capabilities',
    features: ['4K 60fps','Apple Log','ProRes','Cinematic mode'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'apple-iphone15-pro-max',
    brand: 'Apple',
    model: 'iPhone 15 Pro Max',
    category: 'phone',
    logFormats: ['Apple Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Large smartphone with professional video capabilities',
    features: ['4K 60fps','Apple Log','ProRes','Cinematic mode','5x Telephoto'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'apple-iphone14',
    brand: 'Apple',
    model: 'iPhone 14 Pro',
    category: 'phone',
    logFormats: ['Apple Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with Apple Log recording',
    features: ['4K 60fps','Apple Log','ProRes','Cinematic mode'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'apple-iphone13',
    brand: 'Apple',
    model: 'iPhone 13 Pro',
    category: 'phone',
    logFormats: ['Apple Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with Apple Log recording',
    features: ['4K 60fps','Apple Log','ProRes','Cinematic mode'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'apple-ipad-pro',
    brand: 'Apple',
    model: 'iPad Pro',
    category: 'phone',
    logFormats: ['Apple Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Tablet with professional video capabilities',
    features: ['4K 60fps','Apple Log','ProRes','Cinematic mode'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'apple-iphone14',
    brand: 'Apple',
    model: 'iPhone 14 Pro',
    category: 'phone',
    logFormats: ['Apple Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Apple Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with Apple Log recording',
    features: ['4K 60fps','Apple Log','ProRes','Cinematic mode'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // SAMSUNG CAMERAS
  {
    id: 'samsung-s23',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    category: 'phone',
    logFormats: [''],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with 8K video and LOG recording',
    features: ['8K 30fps','4K 60fps','S-Log','HDR10+'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'samsung-s24',
    brand: 'Samsung',
    model: 'Galaxy S24 Ultra',
    category: 'phone',
    logFormats: [''],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Latest smartphone with 8K video and LOG recording',
    features: ['8K 30fps','4K 60fps','S-Log','HDR10+','AI Video'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'samsung-s22',
    brand: 'Samsung',
    model: 'Galaxy S22 Ultra',
    category: 'phone',
    logFormats: [''],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with 8K video and LOG recording',
    features: ['8K 30fps','4K 60fps','S-Log','HDR10+'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'samsung-note20',
    brand: 'Samsung',
    model: 'Galaxy Note20 Ultra',
    category: 'phone',
    logFormats: [', '],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['S-Gamut','Rec.709','Rec.2020'],
    priceRange: 'budget',
    description: 'Smartphone with 8K video and LOG recording',
    features: ['8K 30fps','4K 60fps','S-Log','HDR10+'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },

  // LEICA CAMERAS
  {
    id: 'leica-sl',
    brand: 'Leica',
    model: 'SL',
    category: 'mirrorless',
    logFormats: ['Leica Log, ', ],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Premium full-frame mirrorless with 8K video',
    features: ['8K 30fps','4K 60fps','Leica Log','ProRes','Maestro IV'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'leica-sl2-',
    brand: 'Leica',
    model: 'SL2-',
    category: 'mirrorless',
    logFormats: ['Leica Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps','120fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Premium full-frame mirrorless optimized for video',
    features: ['4K 120fps','10-bit recording','Leica Log','ProRes','Maestro IV'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'leica-sl',
    brand: 'Leica',
    model: 'SL',
    category: 'mirrorless',
    logFormats: ['Leica Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Premium full-frame mirrorless with video capabilities',
    features: ['4K 60fps','10-bit recording','Leica Log','ProRes'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'leica-q',
    brand: 'Leica',
    model: 'Q',
    category: 'mirrorless',
    logFormats: ['Leica Log, ', ],
    resolution: ['8','4K','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Premium fixed-lens camera with 8K video',
    features: ['8K 30fps','4K 60fps','Leica Log','ProRes','Fixed 28mm'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'leica-q',
    brand: 'Leica',
    model: 'Q',
    category: 'mirrorless',
    logFormats: ['Leica Log, ', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps','60fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'professional',
    description: 'Premium fixed-lens camera with video capabilities',
    features: ['4K 30fps','10-bit recording','Leica Log','Fixed 28mm'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'leica-m11',
    brand: 'Leica',
    model: 'M1',
    category: 'mirrorless',
    logFormats: ['Leica Log', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Premium rangefinder camera with video capabilities',
    features: ['4K 30fps','10-bit recording','Leica Log','Rangefinder'],
    isVideoOptimized: true
, isPhotoOptimized: false, addedDate: "2024-01-01", lastUpdated: "2024-01-01", isNew: false, isRecentlyUpdated: false, source: "manual" as const, version: 1 },
  {
    id: 'leica-m10-',
    brand: 'Leica',
    model: 'M10-',
    category: 'mirrorless',
    logFormats: ['Leica Log', ],
    resolution: ['4','1080p'],
    frameRates: ['24fps','25fps','30fps'],
    colorSpace: ['Leica Wide Gamut','Rec.709','Rec.2020'],
    priceRange: 'cinema',
    description: 'Premium rangefinder camera with video capabilities',
    features: ['4K 30fps','10-bit recording','Leica Log','Rangefinder'],
    isVideoOptimized: true
,}
];

// Helper functions
export const getCamerasByProfession = (profession: string): VideoCamera[] => {
  switch (profession.toLowerCase()) {
    case 'videographer':
    case 'cinematographer':
    case 'filmmaker':
      return VIDEO_CAMERA_DATABASE.filter(camera => 
        camera.category === 'cinema' || 
        camera.category === 'mirrorless' ||
        camera.priceRange === 'professional' ||
        camera.priceRange === 'cinema'
    );
    case 'content_creator':
    case 'youtuber':
      return VIDEO_CAMERA_DATABASE.filter(camera => 
        camera.priceRange === 'budget' || 
        camera.priceRange === 'mid-range' ||
        camera.category === 'phone' ||
        camera.category === 'action'
    );
    case 'wedding_videographer':
      return VIDEO_CAMERA_DATABASE.filter(camera => 
        camera.category === 'mirrorless' || 
        camera.category === 'cinema' ||
        (camera.priceRange === 'mid-range' || camera.priceRange ==='professional')
    );
    default:
      return VIDEO_CAMERA_DATABASE;
  }
};

export const getCameraByModel = (model: string): VideoCamera | undefined => {
  return VIDEO_CAMERA_DATABASE.find(camera => 
    camera.model.toLowerCase().includes(model.toLowerCase()) ||
    model.toLowerCase().includes(camera.model.toLowerCase())
  );
};

export const getLogFormatsByCamera = (cameraModel: string): string[] => {
  const camera = getCameraByModel(cameraModel);
  return camera ? camera.logFormats : [];
};

export const getCameraBrand = (cameraModel: string): string | undefined => {
  const camera = getCameraByModel(cameraModel);
  return camera ? camera.brand : undefined;
};
