/**
 * 2D Asset Library
 * 
 * Pre-built asset definitions for the shot planner including:
 * - Furniture (sofas, tables, chairs, beds)
 * - Props (TVs, plants, lamps)
 * - Vehicles
 * - Characters/Actors
 * - Architectural elements
 */

import { Asset2DDefinition, AssetType, Point2D } from './types';

// =============================================================================
// SVG Icon Paths for Assets
// =============================================================================

export const ASSET_ICONS = {
  // Cameras
  camera: `M3 4v12h18V4H3zm16 10H5V6h14v8zm-7-1l3-3-3-3v6zm-5-3h4v2H7v-2z`,
  cameraTop: `M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z`,
  
  // Furniture
  sofa: `M2 9v6h2v-3h16v3h2V9c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2H8c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2z`,
  chair: `M7 13h10V7c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v6zm12 5h-2v-3H7v3H5v-5h14v5z`,
  table: `M3 10h18v2H3v-2zm2 4v4h2v-4H5zm12 0v4h2v-4h-2z`,
  coffeeTable: `M4 10h16v1H4v-1zm2 2v3H4v1h16v-1h-2v-3H6z`,
  bed: `M2 17h20v-5c0-1.1-.9-2-2-2h-4V7c0-1.1-.9-2-2-2H6C4.9 5 4 5.9 4 7v3H2v7zm4-10h8v3H6V7z`,
  desk: `M3 8h18v2H3V8zm4 4v6H5v-6h2zm12 0v6h-2v-6h2z`,
  shelf: `M4 3h16v2H4V3zm0 6h16v2H4V9zm0 6h16v2H4v-2z`,
  
  // Props
  tv: `M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z`,
  lamp: `M12 2C9.79 2 8 3.79 8 6v5h8V6c0-2.21-1.79-4-4-4zm0 16c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2zm-4-4h8v-2H8v2zm1-8h6v6H9V6z`,
  plant: `M12 22c4.97 0 9-4.03 9-9-4.97 0-9 4.03-9 9zM5.6 10.25c0 1.38 1.12 2.5 2.5 2.5.53 0 1.01-.16 1.42-.44l-.02.19c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5l-.02-.19c.4.28.89.44 1.42.44 1.38 0 2.5-1.12 2.5-2.5 0-1-.59-1.85-1.43-2.25.84-.4 1.43-1.25 1.43-2.25 0-1.38-1.12-2.5-2.5-2.5-.53 0-1.01.16-1.42.44l.02-.19C14.5 4.12 13.38 3 12 3S9.5 4.12 9.5 5.5l.02.19c-.4-.28-.89-.44-1.42-.44-1.38 0-2.5 1.12-2.5 2.5 0 1 .59 1.85 1.43 2.25-.84.4-1.43 1.25-1.43 2.25z`,
  
  // Characters
  person: `M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z`,
  personStanding: `M12 2C13.1 2 14 2.9 14 4S13.1 6 12 6 10 5.1 10 4 10.9 2 12 2zM10.5 7h3c.83 0 1.5.67 1.5 1.5V22h-2v-7h-2v7H9V8.5c0-.83.67-1.5 1.5-1.5z`,
  personSitting: `M12 2C13.1 2 14 2.9 14 4S13.1 6 12 6 10 5.1 10 4 10.9 2 12 2zM4 18v-4h2v4h2v-9h3v5h6v-5h3v9h2v4H4z`,
  group: `M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z`,
  
  // Vehicles
  car: `M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z`,
  
  // Architectural
  door: `M6 2v20h12V2H6zm10 11h-2v-2h2v2z`,
  window: `M3 5v14h18V5H3zm8 12H5v-5h6v5zm0-7H5V7h6v3zm8 7h-6v-5h6v5zm0-7h-6V7h6v3z`,
  stairs: `M3 21h6v-3H3v3zm8 0h6v-6h-6v6zm8 0h6v-9h-6v9zM3 18h6v-3H3v3zm8 0h6v-3h-6v3zm8 0h6v-3h-6v3z`,
  wall: `M3 3v18h18V3H3zm16 16H5V5h14v14z`,
  
  // Equipment
  tripod: `M12 2l-5 18h2l2-6h2l2 6h2l-5-18zm0 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z`,
  light: `M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm-1-5v3h2V2h-2zm0 17v3h2v-3h-2zM5.64 7.05L4.22 5.64 6.34 3.52l1.42 1.41-2.12 2.12zM4.22 18.36l1.42-1.41 2.12 2.12-1.41 1.42-2.13-2.13zm13.44-2.12l1.41 1.41-2.12 2.13-1.42-1.42 2.13-2.12zM20 11v2h-3v-2h3zM7 11v2H4v-2h3zm10.66-5.95l-2.12 2.12-1.42-1.41 2.13-2.13 1.41 1.42z`,
  reflector: `M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z`,
  
  // Nature
  tree: `M12 2L4 14h5v8h6v-8h5L12 2z`,
  bush: `M12 3C9.79 3 8 4.79 8 7c0 1.48.81 2.77 2 3.46V22h4v-11.54c1.19-.69 2-1.98 2-3.46 0-2.21-1.79-4-4-4z`,
};

// =============================================================================
// Asset Library Definitions
// =============================================================================

export const FURNITURE_ASSETS: Asset2DDefinition[] = [
  {
    id: 'sofa-3seat',
    name: '3-Seat Sofa',
    type: 'furniture',
    category: 'Seating',
    thumbnailUrl: '',
    defaultSize: { width: 200, height: 80 },
    defaultColor: '#6B7280',
    tags: ['sofa', 'couch', 'seating', 'living room'],
  },
  {
    id: 'sofa-2seat',
    name: '2-Seat Sofa',
    type: 'furniture',
    category: 'Seating',
    thumbnailUrl: '',
    defaultSize: { width: 140, height: 80 },
    defaultColor: '#6B7280',
    tags: ['sofa', 'couch', 'seating', 'living room'],
  },
  {
    id: 'armchair',
    name: 'Armchair',
    type: 'furniture',
    category: 'Seating',
    thumbnailUrl: '',
    defaultSize: { width: 70, height: 70 },
    defaultColor: '#8B7355',
    tags: ['chair', 'armchair', 'seating'],
  },
  {
    id: 'dining-chair',
    name: 'Dining Chair',
    type: 'furniture',
    category: 'Seating',
    thumbnailUrl: '',
    defaultSize: { width: 45, height: 45 },
    defaultColor: '#A0522D',
    tags: ['chair', 'dining', 'seating'],
  },
  {
    id: 'office-chair',
    name: 'Office Chair',
    type: 'furniture',
    category: 'Seating',
    thumbnailUrl: '',
    defaultSize: { width: 55, height: 55 },
    defaultColor: '#2C3E50',
    tags: ['chair', 'office', 'seating'],
  },
  {
    id: 'dining-table',
    name: 'Dining Table',
    type: 'furniture',
    category: 'Tables',
    thumbnailUrl: '',
    defaultSize: { width: 160, height: 90 },
    defaultColor: '#8B4513',
    tags: ['table', 'dining', 'eating'],
  },
  {
    id: 'coffee-table',
    name: 'Coffee Table',
    type: 'furniture',
    category: 'Tables',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 50 },
    defaultColor: '#654321',
    tags: ['table', 'coffee', 'living room'],
  },
  {
    id: 'side-table',
    name: 'Side Table',
    type: 'furniture',
    category: 'Tables',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 40 },
    defaultColor: '#8B7355',
    tags: ['table', 'side', 'end table'],
  },
  {
    id: 'desk',
    name: 'Office Desk',
    type: 'furniture',
    category: 'Tables',
    thumbnailUrl: '',
    defaultSize: { width: 150, height: 75 },
    defaultColor: '#4A4A4A',
    tags: ['desk', 'office', 'work'],
  },
  {
    id: 'bed-double',
    name: 'Double Bed',
    type: 'furniture',
    category: 'Bedroom',
    thumbnailUrl: '',
    defaultSize: { width: 160, height: 200 },
    defaultColor: '#E8D4B8',
    tags: ['bed', 'bedroom', 'double'],
  },
  {
    id: 'bed-single',
    name: 'Single Bed',
    type: 'furniture',
    category: 'Bedroom',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 200 },
    defaultColor: '#E8D4B8',
    tags: ['bed', 'bedroom', 'single'],
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    type: 'furniture',
    category: 'Storage',
    thumbnailUrl: '',
    defaultSize: { width: 120, height: 60 },
    defaultColor: '#5D4E37',
    tags: ['wardrobe', 'closet', 'storage'],
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    type: 'furniture',
    category: 'Storage',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 30 },
    defaultColor: '#8B4513',
    tags: ['shelf', 'books', 'storage'],
  },
  {
    id: 'kitchen-counter',
    name: 'Kitchen Counter',
    type: 'furniture',
    category: 'Kitchen',
    thumbnailUrl: '',
    defaultSize: { width: 200, height: 60 },
    defaultColor: '#D3D3D3',
    tags: ['kitchen', 'counter', 'cooking'],
  },
  {
    id: 'kitchen-island',
    name: 'Kitchen Island',
    type: 'furniture',
    category: 'Kitchen',
    thumbnailUrl: '',
    defaultSize: { width: 150, height: 80 },
    defaultColor: '#E8E8E8',
    tags: ['kitchen', 'island', 'cooking'],
  },
  {
    id: 'bar-stool',
    name: 'Bar Stool',
    type: 'furniture',
    category: 'Seating',
    thumbnailUrl: '',
    defaultSize: { width: 35, height: 35 },
    defaultColor: '#4A4A4A',
    tags: ['stool', 'bar', 'seating'],
  },
];

export const PROP_ASSETS: Asset2DDefinition[] = [
  {
    id: 'tv-flatscreen',
    name: 'Flatscreen TV',
    type: 'prop',
    category: 'Electronics',
    thumbnailUrl: '',
    defaultSize: { width: 120, height: 10 },
    defaultColor: '#1A1A2E',
    tags: ['tv', 'television', 'screen', 'electronics'],
  },
  {
    id: 'computer-monitor',
    name: 'Computer Monitor',
    type: 'prop',
    category: 'Electronics',
    thumbnailUrl: '',
    defaultSize: { width: 50, height: 15 },
    defaultColor: '#2C2C2C',
    tags: ['monitor', 'computer', 'screen'],
  },
  {
    id: 'laptop',
    name: 'Laptop',
    type: 'prop',
    category: 'Electronics',
    thumbnailUrl: '',
    defaultSize: { width: 35, height: 25 },
    defaultColor: '#C0C0C0',
    tags: ['laptop', 'computer', 'electronics'],
  },
  {
    id: 'phone',
    name: 'Phone',
    type: 'prop',
    category: 'Electronics',
    thumbnailUrl: '',
    defaultSize: { width: 8, height: 15 },
    defaultColor: '#1A1A2E',
    tags: ['phone', 'mobile', 'electronics'],
  },
  {
    id: 'lamp-floor',
    name: 'Floor Lamp',
    type: 'prop',
    category: 'Lighting',
    thumbnailUrl: '',
    defaultSize: { width: 30, height: 30 },
    defaultColor: '#FFD700',
    tags: ['lamp', 'light', 'floor'],
  },
  {
    id: 'lamp-table',
    name: 'Table Lamp',
    type: 'prop',
    category: 'Lighting',
    thumbnailUrl: '',
    defaultSize: { width: 25, height: 25 },
    defaultColor: '#F4A460',
    tags: ['lamp', 'light', 'table'],
  },
  {
    id: 'plant-potted',
    name: 'Potted Plant',
    type: 'prop',
    category: 'Decor',
    thumbnailUrl: '',
    defaultSize: { width: 30, height: 30 },
    defaultColor: '#228B22',
    tags: ['plant', 'decor', 'nature'],
  },
  {
    id: 'plant-large',
    name: 'Large Plant',
    type: 'prop',
    category: 'Decor',
    thumbnailUrl: '',
    defaultSize: { width: 50, height: 50 },
    defaultColor: '#2E8B57',
    tags: ['plant', 'decor', 'nature', 'large'],
  },
  {
    id: 'rug-rectangular',
    name: 'Rectangular Rug',
    type: 'prop',
    category: 'Decor',
    thumbnailUrl: '',
    defaultSize: { width: 200, height: 150 },
    defaultColor: '#8B4513',
    tags: ['rug', 'carpet', 'floor'],
  },
  {
    id: 'rug-round',
    name: 'Round Rug',
    type: 'prop',
    category: 'Decor',
    thumbnailUrl: '',
    defaultSize: { width: 120, height: 120 },
    defaultColor: '#CD853F',
    tags: ['rug', 'carpet', 'floor', 'round'],
  },
  {
    id: 'fireplace',
    name: 'Fireplace',
    type: 'prop',
    category: 'Decor',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 30 },
    defaultColor: '#8B0000',
    tags: ['fireplace', 'decor', 'heating'],
  },
  {
    id: 'gun-pistol',
    name: 'Pistol',
    type: 'prop',
    category: 'Weapons',
    thumbnailUrl: '',
    defaultSize: { width: 20, height: 15 },
    defaultColor: '#2F2F2F',
    tags: ['gun', 'weapon', 'pistol'],
  },
  {
    id: 'briefcase',
    name: 'Briefcase',
    type: 'prop',
    category: 'Accessories',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 30 },
    defaultColor: '#8B4513',
    tags: ['briefcase', 'bag', 'business'],
  },
  {
    id: 'bottle-wine',
    name: 'Wine Bottle',
    type: 'prop',
    category: 'Food & Drink',
    thumbnailUrl: '',
    defaultSize: { width: 10, height: 30 },
    defaultColor: '#722F37',
    tags: ['bottle', 'wine', 'drink'],
  },
  {
    id: 'glass-wine',
    name: 'Wine Glass',
    type: 'prop',
    category: 'Food & Drink',
    thumbnailUrl: '',
    defaultSize: { width: 8, height: 15 },
    defaultColor: '#E0E0E0',
    tags: ['glass', 'wine', 'drink'],
  },
];

export const VEHICLE_ASSETS: Asset2DDefinition[] = [
  {
    id: 'car-sedan',
    name: 'Sedan',
    type: 'vehicle',
    category: 'Cars',
    thumbnailUrl: '',
    defaultSize: { width: 180, height: 80 },
    defaultColor: '#4A4A4A',
    tags: ['car', 'sedan', 'vehicle'],
  },
  {
    id: 'car-suv',
    name: 'SUV',
    type: 'vehicle',
    category: 'Cars',
    thumbnailUrl: '',
    defaultSize: { width: 200, height: 90 },
    defaultColor: '#2F4F4F',
    tags: ['car', 'suv', 'vehicle'],
  },
  {
    id: 'car-sports',
    name: 'Sports Car',
    type: 'vehicle',
    category: 'Cars',
    thumbnailUrl: '',
    defaultSize: { width: 180, height: 75 },
    defaultColor: '#FF0000',
    tags: ['car', 'sports', 'vehicle'],
  },
  {
    id: 'van',
    name: 'Van',
    type: 'vehicle',
    category: 'Vans',
    thumbnailUrl: '',
    defaultSize: { width: 220, height: 100 },
    defaultColor: '#F5F5F5',
    tags: ['van', 'vehicle'],
  },
  {
    id: 'truck-pickup',
    name: 'Pickup Truck',
    type: 'vehicle',
    category: 'Trucks',
    thumbnailUrl: '',
    defaultSize: { width: 220, height: 90 },
    defaultColor: '#8B4513',
    tags: ['truck', 'pickup', 'vehicle'],
  },
  {
    id: 'motorcycle',
    name: 'Motorcycle',
    type: 'vehicle',
    category: 'Bikes',
    thumbnailUrl: '',
    defaultSize: { width: 90, height: 40 },
    defaultColor: '#1A1A2E',
    tags: ['motorcycle', 'bike', 'vehicle'],
  },
  {
    id: 'bicycle',
    name: 'Bicycle',
    type: 'vehicle',
    category: 'Bikes',
    thumbnailUrl: '',
    defaultSize: { width: 70, height: 40 },
    defaultColor: '#4169E1',
    tags: ['bicycle', 'bike', 'vehicle'],
  },
];

export const ACTOR_ASSETS: Asset2DDefinition[] = [
  {
    id: 'actor-standing',
    name: 'Standing Actor',
    type: 'actor',
    category: 'Poses',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 40 },
    defaultColor: '#4A5568',
    tags: ['actor', 'person', 'standing'],
  },
  {
    id: 'actor-sitting',
    name: 'Sitting Actor',
    type: 'actor',
    category: 'Poses',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 40 },
    defaultColor: '#4A5568',
    tags: ['actor', 'person', 'sitting'],
  },
  {
    id: 'actor-walking',
    name: 'Walking Actor',
    type: 'actor',
    category: 'Poses',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 40 },
    defaultColor: '#4A5568',
    tags: ['actor', 'person', 'walking'],
  },
  {
    id: 'actor-group-2',
    name: 'Two People',
    type: 'actor',
    category: 'Groups',
    thumbnailUrl: '',
    defaultSize: { width: 70, height: 40 },
    defaultColor: '#4A5568',
    tags: ['actor', 'people', 'group', 'two'],
  },
  {
    id: 'actor-group-3',
    name: 'Three People',
    type: 'actor',
    category: 'Groups',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 40 },
    defaultColor: '#4A5568',
    tags: ['actor', 'people', 'group', 'three'],
  },
];

export const CAMERA_ASSETS: Asset2DDefinition[] = [
  {
    id: 'camera-standard',
    name: 'Standard Camera',
    type: 'camera',
    category: 'Cameras',
    thumbnailUrl: '',
    defaultSize: { width: 30, height: 30 },
    defaultColor: '#4FC3F7',
    tags: ['camera', 'standard'],
  },
  {
    id: 'camera-dolly',
    name: 'Dolly Camera',
    type: 'camera',
    category: 'Cameras',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 30 },
    defaultColor: '#81C784',
    tags: ['camera', 'dolly', 'track'],
  },
  {
    id: 'camera-crane',
    name: 'Crane Camera',
    type: 'camera',
    category: 'Cameras',
    thumbnailUrl: '',
    defaultSize: { width: 50, height: 40 },
    defaultColor: '#FFD54F',
    tags: ['camera', 'crane', 'jib'],
  },
  {
    id: 'camera-steadicam',
    name: 'Steadicam',
    type: 'camera',
    category: 'Cameras',
    thumbnailUrl: '',
    defaultSize: { width: 35, height: 35 },
    defaultColor: '#E57373',
    tags: ['camera', 'steadicam', 'stabilizer'],
  },
];

export const NATURE_ASSETS: Asset2DDefinition[] = [
  {
    id: 'tree-deciduous',
    name: 'Deciduous Tree',
    type: 'nature',
    category: 'Trees',
    thumbnailUrl: '',
    defaultSize: { width: 80, height: 80 },
    defaultColor: '#228B22',
    tags: ['tree', 'nature', 'outdoor'],
  },
  {
    id: 'tree-conifer',
    name: 'Conifer Tree',
    type: 'nature',
    category: 'Trees',
    thumbnailUrl: '',
    defaultSize: { width: 60, height: 100 },
    defaultColor: '#006400',
    tags: ['tree', 'pine', 'nature', 'outdoor'],
  },
  {
    id: 'bush',
    name: 'Bush',
    type: 'nature',
    category: 'Vegetation',
    thumbnailUrl: '',
    defaultSize: { width: 50, height: 40 },
    defaultColor: '#32CD32',
    tags: ['bush', 'shrub', 'nature'],
  },
  {
    id: 'rock-large',
    name: 'Large Rock',
    type: 'nature',
    category: 'Rocks',
    thumbnailUrl: '',
    defaultSize: { width: 60, height: 50 },
    defaultColor: '#808080',
    tags: ['rock', 'stone', 'nature'],
  },
  {
    id: 'water-pond',
    name: 'Pond',
    type: 'nature',
    category: 'Water',
    thumbnailUrl: '',
    defaultSize: { width: 120, height: 80 },
    defaultColor: '#4169E1',
    tags: ['water', 'pond', 'lake'],
  },
];

export const ARCHITECTURAL_ASSETS: Asset2DDefinition[] = [
  {
    id: 'door-single',
    name: 'Single Door',
    type: 'prop',
    category: 'Architectural',
    thumbnailUrl: '',
    defaultSize: { width: 90, height: 15 },
    defaultColor: '#8B4513',
    tags: ['door', 'entry', 'architectural'],
  },
  {
    id: 'door-double',
    name: 'Double Door',
    type: 'prop',
    category: 'Architectural',
    thumbnailUrl: '',
    defaultSize: { width: 150, height: 15 },
    defaultColor: '#8B4513',
    tags: ['door', 'entry', 'architectural', 'double'],
  },
  {
    id: 'window-standard',
    name: 'Standard Window',
    type: 'prop',
    category: 'Architectural',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 10 },
    defaultColor: '#87CEEB',
    tags: ['window', 'architectural'],
  },
  {
    id: 'stairs-straight',
    name: 'Straight Stairs',
    type: 'prop',
    category: 'Architectural',
    thumbnailUrl: '',
    defaultSize: { width: 100, height: 200 },
    defaultColor: '#A0522D',
    tags: ['stairs', 'steps', 'architectural'],
  },
  {
    id: 'column',
    name: 'Column',
    type: 'prop',
    category: 'Architectural',
    thumbnailUrl: '',
    defaultSize: { width: 30, height: 30 },
    defaultColor: '#D3D3D3',
    tags: ['column', 'pillar', 'architectural'],
  },
];

export const EQUIPMENT_ASSETS: Asset2DDefinition[] = [
  {
    id: 'light-key',
    name: 'Key Light',
    type: 'prop',
    category: 'Lighting Equipment',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 40 },
    defaultColor: '#FFD700',
    tags: ['light', 'key', 'equipment'],
  },
  {
    id: 'light-fill',
    name: 'Fill Light',
    type: 'prop',
    category: 'Lighting Equipment',
    thumbnailUrl: '',
    defaultSize: { width: 40, height: 40 },
    defaultColor: '#FFA500',
    tags: ['light', 'fill', 'equipment'],
  },
  {
    id: 'light-back',
    name: 'Back Light',
    type: 'prop',
    category: 'Lighting Equipment',
    thumbnailUrl: '',
    defaultSize: { width: 35, height: 35 },
    defaultColor: '#FF6347',
    tags: ['light', 'back', 'rim', 'equipment'],
  },
  {
    id: 'reflector',
    name: 'Reflector',
    type: 'prop',
    category: 'Lighting Equipment',
    thumbnailUrl: '',
    defaultSize: { width: 80, height: 60 },
    defaultColor: '#F5F5DC',
    tags: ['reflector', 'bounce', 'equipment'],
  },
  {
    id: 'c-stand',
    name: 'C-Stand',
    type: 'prop',
    category: 'Grip',
    thumbnailUrl: '',
    defaultSize: { width: 20, height: 20 },
    defaultColor: '#2F2F2F',
    tags: ['c-stand', 'grip', 'equipment'],
  },
  {
    id: 'dolly-track',
    name: 'Dolly Track',
    type: 'prop',
    category: 'Camera Equipment',
    thumbnailUrl: '',
    defaultSize: { width: 200, height: 20 },
    defaultColor: '#4A4A4A',
    tags: ['dolly', 'track', 'equipment'],
  },
  {
    id: 'boom-mic',
    name: 'Boom Mic',
    type: 'prop',
    category: 'Audio',
    thumbnailUrl: '',
    defaultSize: { width: 15, height: 100 },
    defaultColor: '#1A1A2E',
    tags: ['boom', 'mic', 'audio', 'equipment'],
  },
];

// =============================================================================
// Combined Asset Library
// =============================================================================

export const ASSET_LIBRARY = {
  furniture: FURNITURE_ASSETS,
  props: PROP_ASSETS,
  vehicles: VEHICLE_ASSETS,
  actors: ACTOR_ASSETS,
  cameras: CAMERA_ASSETS,
  nature: NATURE_ASSETS,
  architectural: ARCHITECTURAL_ASSETS,
  equipment: EQUIPMENT_ASSETS,
};

export const ALL_ASSETS = [
  ...FURNITURE_ASSETS,
  ...PROP_ASSETS,
  ...VEHICLE_ASSETS,
  ...ACTOR_ASSETS,
  ...CAMERA_ASSETS,
  ...NATURE_ASSETS,
  ...ARCHITECTURAL_ASSETS,
  ...EQUIPMENT_ASSETS,
];

// =============================================================================
// Asset Search & Filter Helpers
// =============================================================================

export const searchAssets = (query: string): Asset2DDefinition[] => {
  const lowerQuery = query.toLowerCase();
  return ALL_ASSETS.filter(asset =>
    asset.name.toLowerCase().includes(lowerQuery) ||
    asset.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    asset.category.toLowerCase().includes(lowerQuery)
  );
};

export const getAssetsByType = (type: AssetType): Asset2DDefinition[] => {
  return ALL_ASSETS.filter(asset => asset.type === type);
};

export const getAssetsByCategory = (category: string): Asset2DDefinition[] => {
  return ALL_ASSETS.filter(asset => asset.category === category);
};

export const getAssetCategories = (type?: AssetType): string[] => {
  const assets = type ? getAssetsByType(type) : ALL_ASSETS;
  return [...new Set(assets.map(asset => asset.category))];
};

export const getAssetById = (id: string): Asset2DDefinition | undefined => {
  return ALL_ASSETS.find(asset => asset.id === id);
};
