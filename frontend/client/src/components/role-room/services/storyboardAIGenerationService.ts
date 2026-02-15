/**
 * Storyboard AI Generation Service
 * 
 * Service for generating storyboard frames using OpenAI gpt-image-1.
 * Uses Replit AI Integrations - charges are billed to your Replit credits.
 */

export interface StoryboardTemplate {
  id: string;
  name: string;
  description: string;
}

export interface GenerateFrameRequest {
  prompt: string;
  template?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  additionalNotes?: string;
  size?: string;
  frameId?: string;
  storyboardId?: string;
  projectId?: string;
}

export interface GenerateFrameResponse {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  imageKey?: string;
  prompt: string;
  template?: string;
  model: string;
  error?: string;
}

export class StoryboardAIGenerationService {
  private templatesCache: Record<string, StoryboardTemplate> | null = null;
  private cameraAnglesCache: Record<string, string> | null = null;
  private cameraMovementsCache: Record<string, string> | null = null;

  async getTemplates(): Promise<Record<string, StoryboardTemplate>> {
    if (this.templatesCache) {
      return this.templatesCache;
    }
    
    try {
      const response = await fetch('/api/storyboards/templates');
      if (response.ok) {
        this.templatesCache = await response.json();
        return this.templatesCache!;
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
    
    return {
      cinematic: { id: 'cinematic', name: 'Filmisk', description: 'Dramatisk kinolook' },
      documentary: { id: 'documentary', name: 'Dokumentar', description: 'Naturlig stil' },
      commercial: { id: 'commercial', name: 'Reklame', description: 'Profesjonelt reklameutseende' },
      drama: { id: 'drama', name: 'Drama/TV-serie', description: 'Varme toner, intimt' },
    };
  }

  async getCameraAngles(): Promise<Record<string, string>> {
    if (this.cameraAnglesCache) {
      return this.cameraAnglesCache;
    }
    
    try {
      const response = await fetch('/api/storyboards/camera-angles');
      if (response.ok) {
        this.cameraAnglesCache = await response.json();
        return this.cameraAnglesCache!;
      }
    } catch (error) {
      console.error('Error fetching camera angles:', error);
    }
    
    return {
      wide: 'Totalbilde',
      medium: 'Halvtotalt',
      'close-up': 'Nærbilde',
      'over-shoulder': 'Over skulder',
    };
  }

  async getCameraMovements(): Promise<Record<string, string>> {
    if (this.cameraMovementsCache) {
      return this.cameraMovementsCache;
    }
    
    try {
      const response = await fetch('/api/storyboards/camera-movements');
      if (response.ok) {
        this.cameraMovementsCache = await response.json();
        return this.cameraMovementsCache!;
      }
    } catch (error) {
      console.error('Error fetching camera movements:', error);
    }
    
    return {
      static: 'Statisk',
      pan: 'Panorering',
      tracking: 'Tracking',
    };
  }

  async generateFrame(request: GenerateFrameRequest): Promise<GenerateFrameResponse> {
    try {
      const response = await fetch('/api/storyboards/generate-frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          template: request.template || 'cinematic',
          camera_angle: request.cameraAngle,
          camera_movement: request.cameraMovement,
          additional_notes: request.additionalNotes,
          size: request.size || '1536x1024',
          frame_id: request.frameId,
          storyboard_id: request.storyboardId,
          project_id: request.projectId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        
        if (response.status === 402) {
          throw new Error('Kredittgrensen er nådd. Vennligst oppgrader din Replit-plan.');
        }
        
        throw new Error(error.detail || `Bildegenerering feilet: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        imageUrl: data.imageUrl,
        imageBase64: data.imageBase64,
        imageKey: data.imageKey,
        prompt: data.prompt,
        template: data.template,
        model: data.model || 'gpt-image-1',
      };
    } catch (error) {
      console.error('Error generating frame:', error);
      return {
        success: false,
        prompt: request.prompt,
        model: 'gpt-image-1',
        error: error instanceof Error ? error.message : 'Ukjent feil',
      };
    }
  }
  
  async generateFrameFromShotDescription(
    description: string,
    shotType: string,
    projectId: string,
    storyboardId: string,
    frameId: string,
    options?: {
      template?: string;
      cameraAngle?: string;
      cameraMovement?: string;
      additionalNotes?: string;
      size?: string;
    }
  ): Promise<GenerateFrameResponse> {
    const cameraAngle = this.mapShotTypeToCameraAngle(shotType);
    
    return this.generateFrame({
      prompt: description,
      template: options?.template || 'cinematic',
      cameraAngle: options?.cameraAngle || cameraAngle,
      cameraMovement: options?.cameraMovement,
      additionalNotes: options?.additionalNotes,
      size: options?.size || '1536x1024',
      projectId,
      storyboardId,
      frameId,
    });
  }
  
  private mapShotTypeToCameraAngle(shotType: string): string | undefined {
    const mapping: Record<string, string> = {
      'Establishing': 'wide',
      'Wide': 'wide',
      'Full': 'full',
      'Medium': 'medium',
      'Medium Close-up': 'medium-close',
      'Close-up': 'close-up',
      'Extreme Close-up': 'extreme-close-up',
      'Over-the-shoulder': 'over-shoulder',
      'POV': 'pov',
      'Two-shot': 'two-shot',
      'Insert': 'extreme-close-up',
    };
    return mapping[shotType];
  }
  
  async generateFramesBatch(
    requests: GenerateFrameRequest[]
  ): Promise<GenerateFrameResponse[]> {
    const results: GenerateFrameResponse[] = [];
    
    for (const request of requests) {
      const result = await this.generateFrame(request);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }
}

export const storyboardAIGenerationService = new StoryboardAIGenerationService();

