/**
 * Scene Composition Service
 * 
 * Provides composition analysis using SAM 2 segmentation
 */

import { sam2Service, type SAM2SegmentationResult } from '@/services/SAM2Service';

export interface CompositionAnalysis {
  score: {
    overall: number;
    ruleOfThirds: number;
    symmetry: number;
    balance: number;
    leadingLines: number;
    subjectPlacement: number;
  };
  suggestions: Array<{
    type: 'improvement' | 'tip' | 'warning';
    category: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    action?: string;
  }>;
  objects: Array<{
    bbox: [number, number, number, number];
    center: [number, number];
    confidence: number;
  }>;
}

export class SceneCompositionService {
  /**
   * Analyze composition of an image
   */
  async analyzeComposition(imageUrl: string): Promise<CompositionAnalysis> {
    // Segment image to detect objects
    const segmentation = await sam2Service.segmentImageFromUrl(
      imageUrl,
      undefined,
      'auto',
      'small',
    );

    const objects = segmentation.masks.map(mask => ({
      bbox: mask.bbox,
      center: mask.center,
      confidence: mask.confidence,
    }));

    // Calculate composition scores
    const score = this.calculateCompositionScore(segmentation, objects);

    // Generate suggestions
    const suggestions = this.generateSuggestions(score, objects, segmentation.image_size);

    return {
      score,
      suggestions,
      objects,
    };
  }

  private calculateCompositionScore(
    segmentation: SAM2SegmentationResult,
    objects: Array<{ bbox: [number, number, number, number]; center: [number, number]; confidence: number }>
  ) {
    const [width, height] = segmentation.image_size;

    const ruleOfThirds = this.calculateRuleOfThirdsScore(objects, width, height);
    const symmetry = this.calculateSymmetryScore(objects, width, height);
    const balance = this.calculateBalanceScore(objects, width, height);
    const subjectPlacement = this.calculateSubjectPlacementScore(objects, width, height);
    const leadingLines = 75; // Placeholder - would need edge detection

    const overall = Math.round(
      ruleOfThirds * 0.3 +
      symmetry * 0.2 +
      balance * 0.2 +
      subjectPlacement * 0.2 +
      leadingLines * 0.1
    );

    return {
      overall,
      ruleOfThirds,
      symmetry,
      balance,
      leadingLines,
      subjectPlacement,
    };
  }

  private calculateRuleOfThirdsScore(
    objects: Array<{ center: [number, number] }>,
    width: number,
    height: number
  ): number {
    if (objects.length === 0) return 50;

    const thirdX = width / 3;
    const thirdY = height / 3;
    const twoThirdsX = (width * 2) / 3;
    const twoThirdsY = (height * 2) / 3;
    const tolerance = Math.min(width, height) * 0.1;

    let score = 0;
    objects.forEach(obj => {
      const [x, y] = obj.center;
      const distToThirdX = Math.min(
        Math.abs(x - thirdX),
        Math.abs(x - twoThirdsX)
      );
      const distToThirdY = Math.min(
        Math.abs(y - thirdY),
        Math.abs(y - twoThirdsY)
      );

      if (distToThirdX < tolerance && distToThirdY < tolerance) {
        score += 100;
      } else if (distToThirdX < tolerance || distToThirdY < tolerance) {
        score += 70;
      } else {
        score += 30;
      }
    });

    return Math.min(100, Math.round(score / objects.length));
  }

  private calculateSymmetryScore(
    objects: Array<{ center: [number, number] }>,
    width: number,
    height: number
  ): number {
    if (objects.length === 0) return 50;

    const centerX = width / 2;
    let symmetryScore = 0;

    objects.forEach(obj => {
      const [x] = obj.center;
      const distanceFromCenter = Math.abs(x - centerX);
      const maxDistance = width / 2;
      const symmetry = 1 - (distanceFromCenter / maxDistance);
      symmetryScore += symmetry * 100;
    });

    return Math.min(100, Math.round(symmetryScore / objects.length));
  }

  private calculateBalanceScore(
    objects: Array<{ bbox: [number, number, number, number]; center: [number, number] }>,
    width: number,
    height: number
  ): number {
    if (objects.length === 0) return 50;

    let leftWeight = 0;
    let rightWeight = 0;
    let topWeight = 0;
    let bottomWeight = 0;

    objects.forEach(obj => {
      const [x, y, w, h] = obj.bbox;
      const area = w * h;
      const weight = area / (width * height);

      if (x < width / 2) {
        leftWeight += weight;
      } else {
        rightWeight += weight;
      }

      if (y < height / 2) {
        topWeight += weight;
      } else {
        bottomWeight += weight;
      }
    });

    const horizontalBalance = Math.abs(0.5 - (leftWeight / (leftWeight + rightWeight || 1)));
    const verticalBalance = Math.abs(0.5 - (topWeight / (topWeight + bottomWeight || 1)));

    const balanceScore = (1 - (horizontalBalance + verticalBalance)) * 100;
    return Math.max(0, Math.round(balanceScore));
  }

  private calculateSubjectPlacementScore(
    objects: Array<{ center: [number, number] }>,
    width: number,
    height: number
  ): number {
    if (objects.length === 0) return 50;

    const mainSubject = objects[0];
    const [x, y] = mainSubject.center;

    const idealX = width * 0.4;
    const idealY = height * 0.4;

    const distance = Math.sqrt(
      Math.pow(x - idealX, 2) + Math.pow(y - idealY, 2)
    );
    const maxDistance = Math.sqrt(width * width + height * height);
    const placementScore = (1 - distance / maxDistance) * 100;

    return Math.max(0, Math.round(placementScore));
  }

  private generateSuggestions(
    score: CompositionAnalysis['score'],
    objects: Array<{ bbox: [number, number, number, number]; center: [number, number] }>,
    imageSize: [number, number]
  ): CompositionAnalysis['suggestions'] {
    const suggestions: CompositionAnalysis['suggestions'] = [];

    if (score.ruleOfThirds < 60) {
      suggestions.push({
        type: 'improvement',
        category: 'composition',
        message: 'Consider aligning main subjects with rule of thirds grid lines',
        priority: 'high',
        action: 'Show rule of thirds grid',
      });
    }

    if (score.balance < 50) {
      suggestions.push({
        type: 'improvement',
        category: 'balance',
        message: 'Scene appears unbalanced. Consider repositioning subjects',
        priority: 'medium',
      });
    }

    if (score.subjectPlacement < 60) {
      suggestions.push({
        type: 'tip',
        category: 'placement',
        message: 'Main subject could be better positioned',
        priority: 'medium',
      });
    }

    if (objects.length > 1) {
      suggestions.push({
        type: 'tip',
        category: 'group',
        message: `Detected ${objects.length} subjects. Ensure proper spacing`,
        priority: 'low',
      });
    }

    if (score.overall >= 80) {
      suggestions.push({
        type: 'tip',
        category: 'quality',
        message: 'Excellent composition!',
        priority: 'low',
      });
    }

    return suggestions;
  }
}

export const sceneCompositionService = new SceneCompositionService();

























