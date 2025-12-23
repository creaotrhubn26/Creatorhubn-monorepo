/**
 * Meshy.ai Frontend Service
 * 
 * Client-side service for AI-powered 3D model generation
 */

export interface TextTo3DRequest {
  prompt: string;
  artStyle?: 'realistic, ' | 'cartoon' | 'low-poly' | 'sculpture' | 'pbr';
  negativePrompt?: string;
  resolution?: '1024' | '2048' | '4096';
}

export interface ImageTo3DRequest {
  imageUrl: string;
  enablePBR?: boolean;
  resolution?: '1024' | '2048' | '4096';
}

export interface MeshyTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  modelUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export class MeshyService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/meshy';
  }

  /**
   * Generate 3D model from text prompt
   */
  async textTo3D(request: TextTo3DRequest): Promise<MeshyTask> {
    const response = await fetch(`${this.baseUrl}/text-to-3d`, {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate 3D model');
    }

    const data = await response.json();
    return data.task;
  }

  /**
   * Generate 3D model from image
   */
  async imageTo3D(request: ImageTo3DRequest): Promise<MeshyTask> {
    const response = await fetch(`${this.baseUrl}/image-to-3d`, {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate 3D model');
    }

    const data = await response.json();
    return data.task;
  }

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<MeshyTask> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get task status');
    }

    const data = await response.json();
    return data.task;
  }

  /**
   * Poll task until completion
   */
  async waitForCompletion(
    taskId: string,
    onProgress?: (progress: number) => void,
    maxWaitMs: number = 300000
  ): Promise<MeshyTask> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const task = await this.getTask(taskId);

      if (onProgress) {
        onProgress(task.progress);
      }

      if (task.status === 'completed') {
        return task;
      }

      if (task.status === 'failed') {
        throw new Error(task.error ||'Model generation failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Model generation timeout');
  }
}

export default new MeshyService();

