/**
 * Background Analysis Service
 * 
 * Uses SAM 2 to analyze background elements and detect distracting elements
 */

import { sam2Service } from '@/services/SAM2Service';

export interface BackgroundAnalysis {
  distractingElements: Array<{
    bbox: [number, number, number, number];
    center: [number, number];
    confidence: number;
    type: 'object' | 'texture' | 'color';
    suggestion: string;
  }>;
  backgroundQuality: number;
  suggestions: Array<{
    type: 'remove' | 'blur' | 'replace' | 'adjust';
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export class BackgroundAnalysisService {
  /**
   * Analyze background for distracting elements
   */
  async analyzeBackground(imageUrl: string): Promise<BackgroundAnalysis> {
    // Detect all objects in the scene
    const segmentation = await sam2Service.segmentImageFromUrl(
      imageUrl,
      undefined,
      'auto',
      'small',
    );

    // Identify background vs foreground
    const [width, height] = segmentation.image_size;
    const centerX = width / 2;
    const centerY = height / 2;

    // Objects near center are likely subjects (foreground)
    // Objects away from center are likely background
    const distractingElements: BackgroundAnalysis['distractingElements'] = [];
    const subjectAreas: Array<{ bbox: [number, number, number, number] }> = [];

    segmentation.masks.forEach(mask => {
      const [x, y, w, h] = mask.bbox;
      const center = mask.center;
      const distanceFromCenter = Math.sqrt(
        Math.pow(center[0] - centerX, 2) + Math.pow(center[1] - centerY, 2)
      );
      const maxDistance = Math.sqrt(width * width + height * height);

      // If object is far from center, it's likely background
      if (distanceFromCenter > maxDistance * 0.4) {
        distractingElements.push({
          bbox: mask.bbox,
          center: mask.center,
          confidence: mask.confidence,
          type: 'object',
          suggestion: 'Consider removing or blurring this background element',
        });
      } else {
        subjectAreas.push({ bbox: mask.bbox });
      }
    });

    // Calculate background quality
    const backgroundQuality = calculateBackgroundQuality(
      distractingElements,
      subjectAreas,
      width,
      height
    );

    // Generate suggestions
    const suggestions = generateBackgroundSuggestions(distractingElements, backgroundQuality);

    return {
      distractingElements,
      backgroundQuality,
      suggestions,
    };
  }

  /**
   * Get background replacement suggestions
   */
  async getBackgroundSuggestions(imageUrl: string): Promise<string[]> {
    const analysis = await this.analyzeBackground(imageUrl);
    return analysis.suggestions.map(s => s.message);
  }
}

function calculateBackgroundQuality(
  distractingElements: BackgroundAnalysis['distractingElements'],
  subjectAreas: Array<{ bbox: [number, number, number, number] }>,
  width: number,
  height: number
): number {
  if (distractingElements.length === 0) {
    return 100; // Perfect background
  }

  // Calculate total distracting area
  const distractingArea = distractingElements.reduce((sum, elem) => {
    const [x, y, w, h] = elem.bbox;
    return sum + (w * h);
  }, 0);

  const totalArea = width * height;
  const distractingRatio = distractingArea / totalArea;

  // Quality decreases with more distracting elements
  const quality = Math.max(0, 100 - (distractingRatio * 200));

  return Math.round(quality);
}

function generateBackgroundSuggestions(
  distractingElements: BackgroundAnalysis['distractingElements'],
  backgroundQuality: number
): BackgroundAnalysis['suggestions'] {
  const suggestions: BackgroundAnalysis['suggestions'] = [];

  if (distractingElements.length > 0) {
    suggestions.push({
      type: 'remove',
      message: `${distractingElements.length} distracting element(s) detected. Consider removing or blurring them`,
      priority: backgroundQuality < 50 ? 'high' : 'medium',
    });
  }

  if (backgroundQuality < 40) {
    suggestions.push({
      type: 'replace',
      message: 'Background quality is poor. Consider replacing with a clean backdrop',
      priority: 'high',
    });
  } else if (backgroundQuality >= 80) {
    suggestions.push({
      type: 'adjust',
      message: 'Background is clean and well-composed',
      priority: 'low',
    });
  }

  return suggestions;
}

export const backgroundAnalysisService = new BackgroundAnalysisService();

























