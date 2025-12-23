/**
 * Dynamic Profession Types System
 * Helper functions and types for managing dynamic profession types
 */

// Import required types for server environment
import { sql, asc } from 'drizzle-orm';

// Default profession types for fallback
export const DEFAULT_PROFESSION_TYPES = [
  { name: 'photographer', displayName: 'Fotograf', iconColor: '#ff8c00' },
  { name: 'videographer', displayName: 'Videograf', iconColor: '#e74c3c' },
  {
    name: 'musicproducer',
    displayName: 'Musikkprodusent',
    iconColor: '#9b59b6',
  },
  { name: 'vendor', displayName: 'Leverandør', iconColor: '#27ae60' },
] as const;

// Dynamic profession type helper
export interface DynamicProfessionConfig {
  name: string;
  displayName: string;
  iconColor: string;
  isActive: boolean;
  sortOrder: number;
}

// Cache for profession types to avoid repeated DB calls
let cachedProfessionTypes: DynamicProfessionConfig[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get profession types (will be used by server)
export async function getProfessionTypes(): Promise<DynamicProfessionConfig[]> {
  // Return cached if still valid
  const now = Date.now();
  if (cachedProfessionTypes && now - cacheTimestamp < CACHE_DURATION) {
    return cachedProfessionTypes;
  }

  // For now, always return defaults to avoid circular dependency issues
  // TODO: Implement proper database fetching when needed
  cachedProfessionTypes = DEFAULT_PROFESSION_TYPES.map((type, index) => ({
    name: type.name,
    displayName: type.displayName,
    iconColor: type.iconColor,
    isActive: true,
    sortOrder: index,
  }));

  cacheTimestamp = now;
  return cachedProfessionTypes;
}

// Helper to invalidate cache
export function invalidateProfessionTypesCache(): void {
  cachedProfessionTypes = null;
  cacheTimestamp = 0;
}

// Helper to check if a profession is valid
export async function isValidProfession(profession: string): Promise<boolean> {
  const types = await getProfessionTypes();
  return types.some((type) => type.name === profession && type.isActive);
}

// Helper to get profession display name
export async function getProfessionDisplayName(profession: string): Promise<string> {
  const types = await getProfessionTypes();
  const found = types.find((type) => type.name === profession);
  return found?.displayName || profession;
}

// Helper to get profession icon color
export async function getProfessionIconColor(profession: string): Promise<string> {
  const types = await getProfessionTypes();
  const found = types.find((type) => type.name === profession);
  return found?.iconColor || '#ff8c00';
}
