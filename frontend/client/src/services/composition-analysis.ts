// @ts-nocheck
import { GuideType } from '@/components/photo-enhancer/CompositionGuides';
import { mat4, vec2 } from 'gl-matrix';

export interface CompositionAnalysisResult {
  overall_score: number;
  rule_of_thirds_score: number;
  golden_ratio_score: number;
  balance_score: number;
  focus_points: Array<{
    x: number;
    y: number;
    strength: number;
    type: 'subject' | 'eye' | 'intersection';
  }>;
  recommendations: string[];
  dominant_lines: Array<{
    type: 'horizontal' | 'vertical' | 'diagonal';
    strength: number;
    position: number;
  }>;
  color_harmony: {
    dominant_colors: string[];
    contrast_score: number;
    saturation_balance: number;
  };
}

export interface ImageFeatures {
  width: number;
  height: number;
  faces: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  edges: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strength: number;
  }>;
  subjects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
  }>;
}

export class CompositionAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    // willReadFrequently: this analyzer calls getImageData repeatedly
    // (analyzeColorHarmony / composition passes), which is much faster on a
    // CPU-backed canvas — and silences the Canvas2D readback warning.
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Analyze image composition against multiple guide types
   */
  async analyzeImage(
    imageElement: HTMLImageElement,
    activeGuides: Set<GuideType>,
  ): Promise<CompositionAnalysisResult> {
    // Set up canvas
    this.canvas.width = imageElement.naturalWidth;
    this.canvas.height = imageElement.naturalHeight;
    this.ctx.drawImage(imageElement, 0, 0);

    // Extract image features
    const features = await this.extractImageFeatures();

    // Analyze composition for each active guide
    const scores: Record<string, number> = {};
    const recommendations: string[] = [];

    if (activeGuides.has(GuideType.RULE_OF_THIRDS)) {
      scores.rule_of_thirds = this.analyzeRuleOfThirds(features);
      if (scores.rule_of_thirds < 60) {
        recommendations.push('Vurder å plassere hovedmotivet på en tredjedels-linje');
      }
    }

    if (activeGuides.has(GuideType.GOLDEN_RATIO)) {
      scores.golden_ratio = this.analyzeGoldenRatio(features);
      if (scores.golden_ratio < 50) {
        recommendations.push('Hovedmotivet kan plasseres bedre i henhold til det gylne snitt');
      }
    }

    // Overall balance analysis
    scores.balance = this.analyzeBalance(features);
    if (scores.balance < 40) {
      recommendations.push('Bildet virker visuelt ubalansert - vurder omkomponering');
    }

    // Detect focus points using intersection analysis
    const focusPoints = this.detectFocusPoints(features, activeGuides);

    // Analyze dominant lines
    const dominantLines = this.analyzeDominantLines(features);

    // Color harmony analysis
    const colorHarmony = this.analyzeColorHarmony();

    // Calculate overall score
    const overall_score = this.calculateOverallScore(scores);

    return {
      overall_score,
      rule_of_thirds_score: scores.rule_of_thirds || 0,
      golden_ratio_score: scores.golden_ratio || 0,
      balance_score: scores.balance || 0,
      focus_points: focusPoints,
      recommendations,
      dominant_lines: dominantLines,
      color_harmony: colorHarmony,
    };
  }

  /**
   * Extract key visual features from the image
   */
  private async extractImageFeatures(): Promise<ImageFeatures> {
    const { width, height } = this.canvas;
    const imageData = this.ctx.getImageData(0, 0, width, height);

    // Simplified feature extraction - in production, use more sophisticated algorithms
    const faces = await this.detectFaces(imageData);
    const edges = this.detectEdges(imageData);
    const subjects = this.detectSubjects(imageData);

    return {
      width,
      height,
      faces,
      edges,
      subjects,
    };
  }

  /**
   * Analyze rule of thirds compliance
   */
  private analyzeRuleOfThirds(features: ImageFeatures): number {
    const { width, height, faces, subjects } = features;

    // Rule of thirds intersection points
    const intersections = [
      { x: width / 3, y: height / 3 },
      { x: (width * 2) / 3, y: height / 3 },
      { x: width / 3, y: (height * 2) / 3 },
      { x: (width * 2) / 3, y: (height * 2) / 3 }
    ];

    let totalScore = 0;
    let totalElements = 0;

    // Check faces alignment with intersection points
    faces.forEach((face) => {
      const faceCenterX = face.x + face.width / 2;
      const faceCenterY = face.y + face.height / 2;

      const closestIntersection = intersections.reduce(
        (closest, intersection) => {
          const distance = Math.sqrt(
            Math.pow(faceCenterX - intersection.x, 2) + Math.pow(faceCenterY - intersection.y, 2),
          );
          return distance < closest.distance ? { ...intersection, distance } : closest;
        },
        { x: 0, y: 0, distance: Infinity }
      );

      // Score based on proximity to intersection (closer = higher score)
      const maxDistance = Math.sqrt(width * width + height * height) / 4;
      const score = Math.max(0, 100 - (closestIntersection.distance / maxDistance) * 100);
      totalScore += score;
      totalElements++;
    });

    // Check subjects alignment
    subjects.forEach((subject) => {
      const subjectCenterX = subject.x + subject.width / 2;
      const subjectCenterY = subject.y + subject.height / 2;

      // Check alignment with thirds lines
      const verticalThirds = [width / 3, (width * 2) / 3];
      const horizontalThirds = [height / 3, (height * 2) / 3];

      const verticalAlignment = Math.min(
        ...verticalThirds.map((line) => Math.abs(subjectCenterX - line)),
      );
      const horizontalAlignment = Math.min(
        ...horizontalThirds.map((line) => Math.abs(subjectCenterY - line)),
      );

      const alignmentScore = Math.max(
        Math.max(0, 100 - (verticalAlignment / width) * 300),
        Math.max(0, 100 - (horizontalAlignment / height) * 300),
      );

      totalScore += alignmentScore;
      totalElements++;
    });

    return totalElements > 0 ? totalScore / totalElements : 50;
  }

  /**
   * Analyze golden ratio compliance
   */
  private analyzeGoldenRatio(features: ImageFeatures): number {
    const { width, height, faces, subjects } = features;
    const phi = 1.618033988749;

    // Golden ratio points
    const goldenPoints = [
      { x: width / phi, y: height / phi },
      { x: width - width / phi, y: height / phi },
      { x: width / phi, y: height - height / phi },
      { x: width - width / phi, y: height - height / phi },
    ];

    let totalScore = 0;
    let totalElements = 0;

    [...faces, ...subjects].forEach((element) => {
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;

      const closestGoldenPoint = goldenPoints.reduce(
        (closest, point) => {
          const distance = Math.sqrt(
            Math.pow(centerX - point.x, 2) + Math.pow(centerY - point.y, 2),
          );
          return distance < closest.distance ? { ...point, distance } : closest;
        },
        { x: 0, y: 0, distance: Infinity }
      );

      const maxDistance = Math.sqrt(width * width + height * height) / 3;
      const score = Math.max(0, 100 - (closestGoldenPoint.distance / maxDistance) * 100);
      totalScore += score;
      totalElements++;
    });

    return totalElements > 0 ? totalScore / totalElements : 50;
  }

  /**
   * Analyze visual balance
   */
  private analyzeBalance(features: ImageFeatures): number {
    const { width, height, subjects } = features;

    // Calculate visual weight distribution
    let leftWeight = 0;
    let rightWeight = 0;
    let topWeight = 0;
    let bottomWeight = 0;

    subjects.forEach((subject) => {
      const area = subject.width * subject.height;
      const centerX = subject.x + subject.width / 2;
      const centerY = subject.y + subject.height / 2;

      // Distribute weight based on position
      if (centerX < width / 2) {
        leftWeight += area;
      } else {
        rightWeight += area;
      }

      if (centerY < height / 2) {
        topWeight += area;
      } else {
        bottomWeight += area;
      }
    });

    // Calculate balance scores
    const horizontalBalance =
      leftWeight + rightWeight > 0
        ? 100 - (Math.abs(leftWeight - rightWeight) / (leftWeight + rightWeight)) * 100
        : 100;

    const verticalBalance =
      topWeight + bottomWeight > 0
        ? 100 - (Math.abs(topWeight - bottomWeight) / (topWeight + bottomWeight)) * 100
        : 100;

    return (horizontalBalance + verticalBalance) / 2;
  }

  /**
   * Detect focus points using guide intersections and subject positions
   */
  private detectFocusPoints(
    features: ImageFeatures,
    activeGuides: Set<GuideType>,
  ): Array<{
    x: number;
    y: number;
    strength: number;
    type: 'subject' | 'eye' | 'intersection';
  }> {
    const focusPoints: Array<{
      x: number;
      y: number;
      strength: number;
      type: 'subject' | 'eye' | 'intersection';
    }> = [];
    const { width, height, faces, subjects } = features;

    // Add rule of thirds intersections if active
    if (activeGuides.has(GuideType.RULE_OF_THIRDS)) {
      [
        { x: width / 3, y: height / 3 },
        { x: (width * 2) / 3, y: height / 3 },
        { x: width / 3, y: (height * 2) / 3 },
        { x: (width * 2) / 3, y: (height * 2) / 3 }
      ].forEach((point) => {
        focusPoints.push({
          ...point,
          strength: 0.6,
          type: 'intersection'
        });
      });
    }

    // Add golden ratio points if active
    if (activeGuides.has(GuideType.GOLDEN_RATIO)) {
      const phi = 1.618033988749;
      [
        { x: width / phi, y: height / phi },
        { x: width - width / phi, y: height / phi },
        { x: width / phi, y: height - height / phi },
        { x: width - width / phi, y: height - height / phi }
      ].forEach((point) => {
        focusPoints.push({
          ...point,
          strength: 0.7,
          type: 'intersection'
        });
      });
    }

    // Add face centers with high strength
    faces.forEach((face) => {
      focusPoints.push({
        x: face.x + face.width / 2,
        y: face.y + face.height / 2,
        strength: 0.9,
        type: 'eye'
      });
    });

    // Add subject centers
    subjects.forEach((subject) => {
      focusPoints.push({
        x: subject.x + subject.width / 2,
        y: subject.y + subject.height / 2,
        strength: 0.8,
        type: 'subject'
      });
    });

    return focusPoints;
  }

  /**
   * Analyze dominant lines in the image
   */
  private analyzeDominantLines(features: ImageFeatures): Array<{
    type: 'horizontal' | 'vertical' | 'diagonal';
    strength: number;
    position: number;
  }> {
    const { edges, width, height } = features;
    const lines: Array<{
      type: 'horizontal' | 'vertical' | 'diagonal';
      strength: number;
      position: number;
    }> = [];

    // Group edges by orientation
    const horizontalEdges = edges.filter(
      (edge) => Math.abs(edge.y1 - edge.y2) < Math.abs(edge.x1 - edge.x2) / 4,
    );
    const verticalEdges = edges.filter(
      (edge) => Math.abs(edge.x1 - edge.x2) < Math.abs(edge.y1 - edge.y2) / 4,
    );
    const diagonalEdges = edges.filter(
      (edge) => !horizontalEdges.includes(edge) && !verticalEdges.includes(edge),
    );

    // Analyze horizontal lines
    if (horizontalEdges.length > 0) {
      const avgStrength =
        horizontalEdges.reduce((sum, edge) => sum + edge.strength, 0) / horizontalEdges.length;
      const avgPosition =
        horizontalEdges.reduce((sum, edge) => sum + (edge.y1 + edge.y2) / 2, 0) /
        horizontalEdges.length;
      lines.push({
        type: 'horizontal',
        strength: avgStrength,
        position: avgPosition / height,
      });
    }

    // Analyze vertical lines
    if (verticalEdges.length > 0) {
      const avgStrength =
        verticalEdges.reduce((sum, edge) => sum + edge.strength, 0) / verticalEdges.length;
      const avgPosition =
        verticalEdges.reduce((sum, edge) => sum + (edge.x1 + edge.x2) / 2, 0) /
        verticalEdges.length;
      lines.push({
        type: 'vertical',
        strength: avgStrength,
        position: avgPosition / width,
      });
    }

    // Analyze diagonal lines
    if (diagonalEdges.length > 0) {
      const avgStrength =
        diagonalEdges.reduce((sum, edge) => sum + edge.strength, 0) / diagonalEdges.length;
      lines.push({
        type: 'diagonal',
        strength: avgStrength,
        position: 0.5 // Center for diagonals
      });
    }

    return lines.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Analyze color harmony
   */
  private analyzeColorHarmony(): {
    dominant_colors: string[];
    contrast_score: number;
    saturation_balance: number;
  } {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const colorCounts: Record<string, number> = {};
    let totalBrightness = 0;
    let totalSaturation = 0;
    let pixelCount = 0;

    // Sample every 10th pixel for performance
    for (let i = 0; i < imageData.data.length; i += 40) {
      // 4 * 10 = 40
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      // Convert to HSL for better analysis
      const [h, s, l] = this.rgbToHsl(r, g, b);

      totalBrightness += l;
      totalSaturation += s;
      pixelCount++;

      // Group similar colors
      const hueGroup = Math.floor(h / 30) * 30;
      const colorKey = `hsl(${hueGroup}, ${Math.floor(s * 100)}%, ${Math.floor(l * 100)}%)`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
  }

    // Find dominant colors
    const sortedColors = Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([color]) => color);

    // Calculate contrast score (simplified)
    const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 0;
    const contrast_score = Math.min(100, avgBrightness * 200); // Higher brightness variation = better contrast

    // Calculate saturation balance
    const avgSaturation = pixelCount > 0 ? totalSaturation / pixelCount : 0;
    const saturation_balance = Math.min(100, avgSaturation * 150);

    return {
      dominant_colors: sortedColors,
      contrast_score,
      saturation_balance,
    };
  }

  /**
   * Convert RGB to HSL
   */
  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
        default:
          h = 0;
      }
      h /= 6;
    }

    return [h * 360, s, l];
  }

  /**
   * Calculate overall composition score
   */
  private calculateOverallScore(scores: Record<string, number>): number {
    const weights = {
      rule_of_thirds: 0.3,
      golden_ratio: 0.2,
      balance: 0.3,
      focus: 0.2,
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(scores).forEach(([key, score]) => {
      const weight = weights[key as keyof typeof weights] || 0.1;
      totalScore += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 50;
  }

  /**
   * Simplified face detection (placeholder - use MediaPipe in production)
   */
  private async detectFaces(imageData: ImageData): Promise<
    Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      confidence: number;
    }>
  > {
    // Placeholder implementation
    // In production, integrate with MediaPipe Face Detection
    return [];
  }

  /**
   * Simplified edge detection
   */
  private detectEdges(imageData: ImageData): Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strength: number;
  }> {
    // Placeholder implementation
    // In production, use Sobel operator or Canny edge detection
    return [];
  }

  /**
   * Simplified subject detection
   */
  private detectSubjects(imageData: ImageData): Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
  }> {
    // Placeholder implementation
    // In production, use object detection models
    return [];
  }
}

export const compositionAnalyzer = new CompositionAnalyzer();
