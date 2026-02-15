/**
 * AI Shot Suggestion Service
 * 
 * Analyzes a reference image and generates alternative shot suggestions
 * including camera angles, lighting setups, and composition variations.
 * Uses the backend AI endpoint for image analysis.
 */

export interface LightingAdjustment {
  lightId: string;
  position?: number[];
  intensity?: number;
}

export interface ShotSuggestion {
  id: string;
  name: string;
  type: 'angle' | 'lighting' | 'composition' | 'general';
  description: string;
  expectedScore: number;
  cameraPosition: number[];
  cameraRotation: number[];
  lightingAdjustments?: LightingAdjustment[];
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  composition?: string;
  reasoning?: string;
  confidence: number;
}

interface GenerateSuggestionsRequest {
  imageUrl: string;
  context?: string;
  maxSuggestions?: number;
}

interface GenerateSuggestionsResponse {
  success: boolean;
  suggestions: ShotSuggestion[];
  error?: string;
}

// Default shot suggestions library for offline/fallback usage
const SHOT_SUGGESTION_TEMPLATES: Record<string, Omit<ShotSuggestion, 'id'>[]> = {
  angle: [
    {
      name: 'Low Angle Hero Shot',
      type: 'angle',
      description: 'Camera positioned below subject eye-line, looking up. Creates a sense of power and dominance.',
      expectedScore: 85,
      cameraPosition: [0, -1.2, 3],
      cameraRotation: [15, 0, 0],
      confidence: 0.82,
      shotType: 'Low Angle',
      cameraAngle: 'low',
    },
    {
      name: 'Dutch Angle Tension',
      type: 'angle',
      description: 'Tilted camera creating diagonal lines. Adds psychological tension and unease.',
      expectedScore: 78,
      cameraPosition: [1, 0, 3],
      cameraRotation: [0, -10, 25],
      confidence: 0.75,
      shotType: 'Dutch Angle',
      cameraAngle: 'dutch',
    },
    {
      name: "Bird's Eye Overview",
      type: 'angle',
      description: 'Overhead shot looking straight down. Reveals spatial relationships and patterns.',
      expectedScore: 72,
      cameraPosition: [0, 5, 0],
      cameraRotation: [90, 0, 0],
      confidence: 0.70,
      shotType: 'Overhead',
      cameraAngle: 'overhead',
    },
    {
      name: 'Over-the-Shoulder',
      type: 'angle',
      description: 'Camera positioned behind one subject looking at another. Creates depth and connection.',
      expectedScore: 88,
      cameraPosition: [-0.5, 0.2, 1.5],
      cameraRotation: [0, 15, 0],
      confidence: 0.85,
      shotType: 'OTS',
      cameraAngle: 'over-shoulder',
    },
  ],
  lighting: [
    {
      name: 'Rembrandt Lighting',
      type: 'lighting',
      description: 'Key light at 45° creating a triangle of light on the shadow side of the face.',
      expectedScore: 90,
      cameraPosition: [0, 0, 3],
      cameraRotation: [0, 0, 0],
      lightingAdjustments: [
        { lightId: 'key', position: [2, 2, 1], intensity: 0.8 },
        { lightId: 'fill', position: [-1.5, 1, 2], intensity: 0.3 },
      ],
      confidence: 0.88,
    },
    {
      name: 'Silhouette Backlight',
      type: 'lighting',
      description: 'Strong backlight with minimal fill. Creates dramatic silhouette effect.',
      expectedScore: 82,
      cameraPosition: [0, 0, 3],
      cameraRotation: [0, 0, 0],
      lightingAdjustments: [
        { lightId: 'key', position: [0, 1, -3], intensity: 1.0 },
        { lightId: 'fill', position: [0, 0, 2], intensity: 0.05 },
      ],
      confidence: 0.80,
    },
    {
      name: 'Split Lighting',
      type: 'lighting',
      description: 'Light from the side illuminating exactly half the face. Creates duality and mystery.',
      expectedScore: 85,
      cameraPosition: [0, 0, 3],
      cameraRotation: [0, 0, 0],
      lightingAdjustments: [
        { lightId: 'key', position: [3, 0.5, 0], intensity: 0.9 },
      ],
      confidence: 0.83,
    },
  ],
  composition: [
    {
      name: 'Rule of Thirds',
      type: 'composition',
      description: 'Subject placed at intersection of thirds grid. Creates balanced, dynamic framing.',
      expectedScore: 92,
      cameraPosition: [0.5, 0, 3],
      cameraRotation: [0, -5, 0],
      confidence: 0.90,
      composition: 'thirds',
    },
    {
      name: 'Leading Lines',
      type: 'composition',
      description: "Use environmental lines to guide viewer's eye toward the subject.",
      expectedScore: 87,
      cameraPosition: [-1, -0.5, 4],
      cameraRotation: [5, 10, 0],
      confidence: 0.84,
      composition: 'leading-lines',
    },
    {
      name: 'Frame Within Frame',
      type: 'composition',
      description: 'Use doorways, windows, or other elements to create a natural frame around the subject.',
      expectedScore: 83,
      cameraPosition: [0, 0, 5],
      cameraRotation: [0, 0, 0],
      confidence: 0.78,
      composition: 'frame-in-frame',
    },
    {
      name: 'Symmetrical Center',
      type: 'composition',
      description: 'Subject centered with symmetrical elements. Creates formality and authority.',
      expectedScore: 80,
      cameraPosition: [0, 0, 3],
      cameraRotation: [0, 0, 0],
      confidence: 0.82,
      composition: 'centered',
    },
  ],
};

class AIShotSuggestionService {
  private cache = new Map<string, { suggestions: ShotSuggestion[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate shot suggestions by analyzing a reference image.
   * Tries the backend AI endpoint first, falls back to template-based suggestions.
   */
  async generateSuggestions(imageUrl: string, context?: string): Promise<ShotSuggestion[]> {
    // Check cache
    const cacheKey = `${imageUrl}:${context || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.suggestions;
    }

    // Try backend AI endpoint first
    try {
      const response = await fetch('/api/shot-suggestions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          context,
          maxSuggestions: 8,
        } satisfies GenerateSuggestionsRequest),
      });

      if (response.ok) {
        const data: GenerateSuggestionsResponse = await response.json();
        if (data.success && data.suggestions.length > 0) {
          this.cache.set(cacheKey, { suggestions: data.suggestions, timestamp: Date.now() });
          return data.suggestions;
        }
      }
    } catch (error) {
      console.warn('[AIShotSuggestion] Backend unavailable, using template suggestions:', error);
    }

    // Fallback: generate template-based suggestions with scoring
    const suggestions = this.generateTemplateSuggestions(imageUrl);
    this.cache.set(cacheKey, { suggestions, timestamp: Date.now() });
    return suggestions;
  }

  /**
   * Generate suggestions from built-in templates with deterministic selection.
   * Provides a useful set of suggestions even without a backend AI model.
   */
  private generateTemplateSuggestions(imageUrl: string): ShotSuggestion[] {
    const suggestions: ShotSuggestion[] = [];
    let idCounter = 0;

    // Deterministic seed based on imageUrl for consistent results per image
    const seed = this.hashString(imageUrl);

    // Select 2 angle suggestions
    const angleTemplates = SHOT_SUGGESTION_TEMPLATES.angle;
    const angleIndices = this.selectIndices(angleTemplates.length, 2, seed);
    for (const idx of angleIndices) {
      const template = angleTemplates[idx];
      suggestions.push({
        ...template,
        id: `suggestion-${++idCounter}`,
        expectedScore: this.varyScore(template.expectedScore, seed + idCounter),
      });
    }

    // Select 2 lighting suggestions
    const lightingTemplates = SHOT_SUGGESTION_TEMPLATES.lighting;
    const lightingIndices = this.selectIndices(lightingTemplates.length, 2, seed + 100);
    for (const idx of lightingIndices) {
      const template = lightingTemplates[idx];
      suggestions.push({
        ...template,
        id: `suggestion-${++idCounter}`,
        expectedScore: this.varyScore(template.expectedScore, seed + idCounter),
      });
    }

    // Select 2 composition suggestions
    const compTemplates = SHOT_SUGGESTION_TEMPLATES.composition;
    const compIndices = this.selectIndices(compTemplates.length, 2, seed + 200);
    for (const idx of compIndices) {
      const template = compTemplates[idx];
      suggestions.push({
        ...template,
        id: `suggestion-${++idCounter}`,
        expectedScore: this.varyScore(template.expectedScore, seed + idCounter),
      });
    }

    // Sort by expected score descending
    suggestions.sort((a, b) => b.expectedScore - a.expectedScore);

    return suggestions;
  }

  /**
   * Rate a suggestion for feedback learning
   */
  async rateSuggestion(suggestionId: string, rating: number): Promise<void> {
    try {
      await fetch('/api/shot-suggestions/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, rating }),
      });
    } catch (error) {
      console.warn('[AIShotSuggestion] Failed to submit rating:', error);
    }
  }

  /**
   * Check if the AI suggestion service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/shot-suggestions/health', { method: 'GET' });
      return response.ok;
    } catch {
      // Even without backend, template suggestions always work
      return true;
    }
  }

  /**
   * Clear the suggestion cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // Utility: simple string hash for deterministic seeding
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Utility: select N indices from a range using a seed
  private selectIndices(total: number, count: number, seed: number): number[] {
    const indices: number[] = [];
    const available = Array.from({ length: total }, (_, i) => i);
    let s = seed;

    for (let i = 0; i < Math.min(count, total); i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const idx = s % available.length;
      indices.push(available[idx]);
      available.splice(idx, 1);
    }

    return indices;
  }

  // Utility: vary a score slightly based on seed
  private varyScore(baseScore: number, seed: number): number {
    const variation = ((seed * 1103515245 + 12345) & 0x7fffffff) % 11 - 5; // -5 to +5
    return Math.max(0, Math.min(100, baseScore + variation));
  }
}

export const aiShotSuggestionService = new AIShotSuggestionService();
export default aiShotSuggestionService;
