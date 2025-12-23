/**
 * useCreatorHubIcons Hook
 * Provides access to all CreatorHub custom icons + Material Icons
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import * as CreatorHubIcons from '@/components/shared/CreatorHubIcons';

interface IconCategory {
  name: string;
  icons: string[];
}

interface IconsData {
  materialIcons: string[];
  creatorHubIcons: string[];
  allIcons: string[];
  categorized: {
    material: Record<string, string[]>;
    custom: string[];
  };
  total: number;
}

/**
 * Get all CreatorHub custom icon names from the module
 */
export function getCreatorHubIconNames(): string[] {
  return Object.keys(CreatorHubIcons).filter((key) => {
    // Only include function exports that end with "Icon"
    return typeof (CreatorHubIcons as any)[key] === 'function' && key.endsWith('Icon');
  });
}

/**
 * Hook to fetch all available icons (Material + CreatorHub custom)
 */
export function useCreatorHubIcons() {
  return useQuery({
    queryKey: ['creatorhub-icons'],
    queryFn: async (): Promise<IconsData> => {
      // Fetch Material Icons from backend
      const materialData = await apiRequest<{
        icons: string[];
        categories: Record<string, string[]>;
      }>('/api/ai/available-icons', { method: 'GET' });

      // Get CreatorHub custom icons
      const creatorHubIconNames = getCreatorHubIconNames();

      return {
        materialIcons: materialData.icons,
        creatorHubIcons: creatorHubIconNames,
        allIcons: [...materialData.icons, ...creatorHubIconNames],
        categorized: {
          material: materialData.categories,
          custom: creatorHubIconNames,
        },
        total: materialData.icons.length + creatorHubIconNames.length,
      };
    },
    staleTime: 1000 * 60 * 60, // 1 hour (icons don't change often)
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}

/**
 * Get icon component by name (works for both Material and CreatorHub icons)
 */
export function getIconComponent(iconName: string): React.ComponentType<any> | null {
  // Check if it's a CreatorHub icon
  if ((CreatorHubIcons as any)[iconName]) {
    return (CreatorHubIcons as any)[iconName];
  }

  // For Material Icons, return null (they're imported differently)
  return null;
}

/**
 * Check if icon is a Material Icon or CreatorHub icon
 */
export function getIconType(iconName: string): 'material' | 'creatorhub' | 'unknown' {
  if ((CreatorHubIcons as any)[iconName]) {
    return 'creatorhub';
  }

  // Basic check for Material Icon naming pattern
  if (/^[A-Z][a-zA-Z]*$/.test(iconName)) {
    return 'material';
  }

  return'unknown';
}

export default useCreatorHubIcons;
