export interface StoryArcClipMeta {
  camera?: string;
  shotName?: string;
  scene?: string;
  take?: string;
  tags?: string[];
  syncGroup?: string;
  faceDetection?: {
    hasFace: boolean;
    faceCount: number;
    confidence: number;
    analyzedAt: number;
    comprehensiveAnalysis?: {
      parsing?: {
        mask?: string;
        visualization?: string;
      };
      landmarks?: {
        points: Array<{ x: number; y: number }>;
        count: number;
        visualization?: string;
      };
      headpose?: {
        pitch: number;
        yaw: number;
        roll: number;
        visualization?: string;
      };
      attributes?: {
        values: number[];
        count: number;
      };
    };
    bestTimestamp?: number;
    scanMetadata?: {
      totalFramesAnalyzed: number;
      framesWithFaces: number;
      faceDetectionRate: number;
      timestamps: Array<{ timestamp: number; hasFace: boolean }>;
    };
  };
  [key: string]: unknown;
}
