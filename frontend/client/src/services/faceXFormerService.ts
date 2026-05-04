/**
 * FaceXFormer Frontend Service
 *
 * Client-side service for FaceXFormer face analysis.
 * Provides unified face analysis: parsing, landmarks, headpose, attributes.
 *
 * Originally lived inside the now-removed creatorhubvirtualstudio module
 * but is still consumed by the StoryArc face-detection flow, so it lives
 * in shared services.
 */

export type FaceAnalysisTask = 'parsing' | 'landmarks' | 'headpose' | 'attributes' | 'all';

export interface FaceAnalysisResult {
  success: boolean;
  task: string;
  results: {
    face?: string;
    parsing?: string;
    parsing_visualization?: string;
    landmarks?: Array<{ x: number; y: number }>;
    landmarks_visualization?: string;
    headpose?: {
      pitch: number;
      yaw: number;
      roll: number;
    };
    headpose_visualization?: string;
    attributes?: number[];
    sam2_mask?: string;
    sam2_bbox?: [number, number, number, number];
  };
}

export interface FaceParsingResult {
  face: string;
  parsing: string;
  parsing_visualization: string;
}

export interface LandmarksResult {
  face: string;
  landmarks: Array<{ x: number; y: number }>;
  landmarks_visualization: string;
}

export interface HeadPoseResult {
  face: string;
  headpose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  headpose_visualization: string;
}

export interface AttributesResult {
  face: string;
  attributes: number[];
}

export class FaceXFormerService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/face-analysis';
  }

  async analyzeFace(
    imageFile: File | string,
    task: FaceAnalysisTask = 'all',
    modelVersion: string = 'trained',
  ): Promise<FaceAnalysisResult> {
    const formData = new FormData();

    if (typeof imageFile === 'string') {
      formData.append('imageUrl', imageFile);
    } else {
      formData.append('image', imageFile);
    }

    formData.append('task', task);
    if (modelVersion) {
      formData.append('modelVersion', modelVersion);
    }

    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Face analysis failed: ${response.statusText}`);
    }

    return response.json();
  }

  async parseFace(imageFile: File | string, modelVersion: string = 'trained'): Promise<FaceParsingResult> {
    const result = await this.analyzeFace(imageFile, 'parsing', modelVersion);
    if (!result.results.face || !result.results.parsing) {
      throw new Error('Face parsing failed: missing results');
    }
    return {
      face: result.results.face,
      parsing: result.results.parsing,
      parsing_visualization: result.results.parsing_visualization || result.results.parsing,
    };
  }

  async detectLandmarks(imageFile: File | string, modelVersion: string = 'trained'): Promise<LandmarksResult> {
    const result = await this.analyzeFace(imageFile, 'landmarks', modelVersion);
    if (!result.results.face || !result.results.landmarks) {
      throw new Error('Landmark detection failed: missing results');
    }
    return {
      face: result.results.face,
      landmarks: result.results.landmarks,
      landmarks_visualization: result.results.landmarks_visualization || result.results.face,
    };
  }

  async estimateHeadPose(imageFile: File | string, modelVersion: string = 'trained'): Promise<HeadPoseResult> {
    const result = await this.analyzeFace(imageFile, 'headpose', modelVersion);
    if (!result.results.face || !result.results.headpose) {
      throw new Error('Head pose estimation failed: missing results');
    }
    return {
      face: result.results.face,
      headpose: result.results.headpose,
      headpose_visualization: result.results.headpose_visualization || result.results.face,
    };
  }

  async recognizeAttributes(imageFile: File | string, modelVersion: string = 'trained'): Promise<AttributesResult> {
    const result = await this.analyzeFace(imageFile, 'attributes', modelVersion);
    if (!result.results.face || !result.results.attributes) {
      throw new Error('Attribute recognition failed: missing results');
    }
    return {
      face: result.results.face,
      attributes: result.results.attributes,
    };
  }

  async analyzeAll(imageFile: File | string): Promise<FaceAnalysisResult> {
    return this.analyzeFace(imageFile, 'all');
  }
}

export const faceXFormerService = new FaceXFormerService();
