/**
 * Photogrammetry Service
 * 
 * Handles photogrammetry pipeline for converting photos to 3D models.
 * Supports integration with external photogrammetry engines.
 */

import * as THREE from 'three';

export interface PhotogrammetryJob {
  id: string;
  name: string;
  status: 'uploading' | 'processing' | 'meshing' | 'texturing' | 'complete' | 'failed';
  progress: number;
  images: string[];
  pointCloud?: PointCloud;
  mesh?: PhotogrammetryMesh;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface PointCloud {
  points: number;
  boundingBox: { min: THREE.Vector3; max: THREE.Vector3 };
  density: number;
  previewUrl?: string;
}

export interface PhotogrammetryMesh {
  vertices: number;
  faces: number;
  textureResolution: number;
  modelUrl: string;
  textureUrl: string;
  normalMapUrl?: string;
  aoMapUrl?: string;
}

export interface PhotogrammetrySettings {
  quality: 'draft' | 'medium' | 'high' | 'ultra';
  meshTarget: number; // Target polygon count
  textureSize: 1024 | 2048 | 4096 | 8192;
  generateNormalMap: boolean;
  generateAO: boolean;
  alignmentMethod: 'sparse' | 'dense';
  featureMatching: 'sift' | 'orb' | 'akaze';
}

const DEFAULT_SETTINGS: PhotogrammetrySettings = {
  quality: 'high',
  meshTarget: 100000,
  textureSize: 4096,
  generateNormalMap: true,
  generateAO: true,
  alignmentMethod: 'dense',
  featureMatching: 'sift',
};

class PhotogrammetryService {
  private jobs: Map<string, PhotogrammetryJob> = new Map();
  private settings: PhotogrammetrySettings = DEFAULT_SETTINGS;

  /**
   * Create a new photogrammetry job from images
   */
  async createJob(name: string, imageFiles: File[]): Promise<PhotogrammetryJob> {
    const jobId = `pg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: PhotogrammetryJob = {
      id: jobId,
      name,
      status: 'uploading',
      progress: 0,
      images: [],
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);

    // Simulate image upload
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const dataUrl = await this.fileToDataUrl(file);
      job.images.push(dataUrl);
      job.progress = ((i + 1) / imageFiles.length) * 20;
      this.notifyProgress(job);
    }

    // Start processing pipeline
    this.processJob(jobId);

    return job;
  }

  /**
   * Process photogrammetry job through pipeline stages
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      // Stage 1: Feature Detection
      job.status = 'processing';
      job.progress = 20;
      this.notifyProgress(job);
      await this.simulateProcessing(2000);

      // Stage 2: Point Cloud Generation
      job.progress = 40;
      this.notifyProgress(job);
      await this.simulateProcessing(3000);
      
      job.pointCloud = {
        points: Math.floor(Math.random() * 500000) + 100000,
        boundingBox: {
          min: new THREE.Vector3(-1, -1, -1),
          max: new THREE.Vector3(1, 1, 1),
        },
        density: 0.85,
      };

      // Stage 3: Mesh Reconstruction
      job.status = 'meshing';
      job.progress = 60;
      this.notifyProgress(job);
      await this.simulateProcessing(4000);

      // Stage 4: Texture Generation
      job.status = 'texturing';
      job.progress = 80;
      this.notifyProgress(job);
      await this.simulateProcessing(3000);

      // Complete
      job.status = 'complete';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.mesh = {
        vertices: this.settings.meshTarget,
        faces: Math.floor(this.settings.meshTarget * 0.6),
        textureResolution: this.settings.textureSize,
        modelUrl: `/api/photogrammetry/${jobId}/model.glb`,
        textureUrl: `/api/photogrammetry/${jobId}/texture.png`,
        normalMapUrl: this.settings.generateNormalMap ? `/api/photogrammetry/${jobId}/normal.png` : undefined,
        aoMapUrl: this.settings.generateAO ? `/api/photogrammetry/${jobId}/ao.png` : undefined,
      };
      this.notifyProgress(job);

    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message || 'Processing failed';
      this.notifyProgress(job);
    }
  }

  /**
   * Get job status
   */
  getJob(jobId: string): PhotogrammetryJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): PhotogrammetryJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status !== 'complete' && job.status !== 'failed') {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      return true;
    }
    return false;
  }

  /**
   * Delete a job
   */
  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<PhotogrammetrySettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): PhotogrammetrySettings {
    return { ...this.settings };
  }

  /**
   * Export mesh to Virtual Studio scene
   */
  async exportToScene(jobId: string): Promise<THREE.Group | null> {
    const job = this.jobs.get(jobId);
    if (!job || !job.mesh) return null;

    // Create a placeholder group (in production, this would load the actual mesh)
    const group = new THREE.Group();
    group.name = `photogrammetry_${job.name}`;

    // Placeholder geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    return group;
  }

  /**
   * Estimate processing time based on image count and settings
   */
  estimateProcessingTime(imageCount: number): number {
    const baseTime = 30; // seconds
    const perImageTime = 5; // seconds per image
    const qualityMultiplier = {
      draft: 0.5,
      medium: 1.0,
      high: 2.0,
      ultra: 4.0,
    };

    return (baseTime + imageCount * perImageTime) * qualityMultiplier[this.settings.quality];
  }

  /**
   * Get recommended image count for object size
   */
  getRecommendedImageCount(objectType: 'small' | 'medium' |  'large' |'room'): { min: number; ideal: number; max: number } {
    const recommendations = {
      small: { min: 20, ideal: 40, max: 60 },
      medium: { min: 40, ideal: 80, max: 150 },
      large: { min: 80, ideal: 150, max: 300 },
      room: { min: 150, ideal: 300, max: 500 },
    };
    return recommendations[objectType];
  }

  // Helper methods
  private async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private notifyProgress(job: PhotogrammetryJob): void {
    window.dispatchEvent(new CustomEvent('photogrammetry-progress', { detail: job }));
  }
}

export const photogrammetryService = new PhotogrammetryService();
export default photogrammetryService;

