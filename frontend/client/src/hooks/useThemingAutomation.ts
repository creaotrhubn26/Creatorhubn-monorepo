// @ts-nocheck
/**
 * Theming Automation Hook
 * Zero-work AI-powered theme generation with manual override option
 */

import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { ProfessionBranding } from '@/utils/theming-helper';

interface ProfessionThemeGeneration {
  color: string;
  icon: string;
  label: string;
  labelEn: string;
  description: string;
  reasoning?: string;
}

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  light: string;
  dark: string;
}

export function useThemingAutomation() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneration, setLastGeneration] = useState<ProfessionThemeGeneration | null>(null);

  /**
   * 1. Auto-generate complete profession theme from name
   * Uses AI to determine best colors, emojis, labels, and descriptions
   */
  const generateProfessionAutomagically = useCallback(
    async (
      professionName: string,
      options?: {
        targetMarket?: string;
        mood?: string;
        keywords?: string[];
      },
    ): Promise<ProfessionThemeGeneration | null> => {
      setIsGenerating(true);

      try {
        const response = await apiRequest<ProfessionThemeGeneration>(
          '/api/ai/generate-profession-theme',
          {
            method: 'POST',
            body: {
              professionName,
              targetMarket: options?.targetMarket || 'Norway',
              mood: options?.mood || 'professional, trustworthy, creative',
              keywords: options?.keywords || [],
            },
          },
        );

        setLastGeneration(response);
        return response;
      } catch (error) {
        console.error('AI profession generation failed: ', error);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  /**
   * 2. Generate profession-specific color palette
   * Returns full color scheme (primary, secondary, accent, light, dark)
   */
  const generateProfessionColors = useCallback(
    async (profession: string, baseColor?: string): Promise<ColorPalette | null> => {
      try {
        const response = await apiRequest<ColorPalette>('/api/ai/generate-profession-colors', {
          method: 'POST',
          body: {
            profession,
            baseColor,
            generateShades: true,
          },
        });

        return response;
      } catch (error) {
        console.error('AI color generation failed:', error);
        return null;
      }
    },
    [],
  );

  /**
   * 3. Generate Norwegian/English labels from profession name
   */
  const generateLabels = useCallback(
    async (professionName: string): Promise<{ no: string; en: string } | null> => {
      try {
        const response = await apiRequest<{ no: string; en: string }>('/api/ai/generate-labels', {
          method: 'POST',
          body: {
            profession: professionName,
            languages: ['no', 'en'],
          },
        });

        return response;
      } catch (error) {
        console.error('AI label generation failed:', error);
        return null;
      }
    },
    [],
  );

  /**
   * 4. Get available icons (Material + CreatorHub custom)
   * Note: For real-time data, use useCreatorHubIcons() hook instead
   */
  const getAvailableIcons = useCallback(async (): Promise<string[] | null> => {
    try {
      const response = await apiRequest<{
        icons: string[];
        categories: Record<string, string[]>;
        creatorHubIcons?: string[];
        total?: number;
      }>('/api/ai/available-icons', {
        method: 'GET',
      });

      // Return all icons (Material + CreatorHub custom)
      return response.icons;
    } catch (error) {
      console.error('Failed to fetch available icons:', error);
      return null;
    }
  }, []);

  /**
   * 5. Suggest best icon from available library
   */
  const suggestIcon = useCallback(
    async (
      profession: string,
      availableIcons: string[],
    ): Promise<{ icon: string; reason: string } | null> => {
      try {
        const response = await apiRequest<{ icon: string; reason: string }>(
          '/api/ai/suggest-icon',
          {
            method: 'POST',
            body: {
              profession,
              availableIcons,
            },
          },
        );

        return response;
      } catch (error) {
        console.error('AI icon suggestion failed:', error);
        return null;
      }
    },
    [],
  );

  /**
   * 6. Improve existing theme with AI suggestions
   */
  const improveTheme = useCallback(
    async (
      currentTheme: Partial<ProfessionBranding>,
    ): Promise<{
      suggestions: Array<{ field: string; current: string; suggested: string; reason: string }>;
    } | null> => {
      try {
        const response = await apiRequest<any>('/api/ai/improve-theme', {
          method: 'POST',
          body: { currentTheme },
        });

        return response;
      } catch (error) {
        console.error('AI theme improvement failed:', error);
        return null;
      }
    },
    [],
  );

  /**
   * 7. Generate description from profession details
   */
  const generateDescription = useCallback(
    async (profession: string, language: 'no' | 'en' = 'no'): Promise<string | null> => {
      try {
        const response = await apiRequest<{ description: string }>('/api/ai/generate-description', {
          method: 'POST',
          body: {
            profession,
            language,
            length: 'medium',
          },
        });

        return response.description;
      } catch (error) {
        console.error('AI description generation failed:', error);
        return null;
      }
    },
    [],
  );

  /**
   * 8. Quick color harmonies from base color
   * Useful when user picks a color manually but wants AI to complete the palette
   */
  const generateColorHarmonies = useCallback(
    async (
      baseColor: string,
      type: 'complementary' | 'analogous' | 'triadic' | 'monochromatic' = 'analogous',
    ): Promise<ColorPalette | null> => {
      try {
        const response = await apiRequest<ColorPalette>('/api/ai/color-harmonies', {
          method:'POST',
          body: {
            baseColor,
            harmonyType: type,
          },
        });

        return response;
      } catch (error) {
        console.error('Color harmony generation failed:', error);
        return null;
      }
    },
    [],
  );

  return {
    // Full automation
    generateProfessionAutomagically,

    // Partial automation (individual fields)
    generateProfessionColors,
    generateLabels,
    getAvailableIcons,
    suggestIcon,
    generateDescription,
    generateColorHarmonies,

    // Improvement
    improveTheme,

    // State
    isGenerating,
    lastGeneration,
  };
}

export default useThemingAutomation;
