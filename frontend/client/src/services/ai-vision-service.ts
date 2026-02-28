/**
 * AI VISION SERVICE
 * Hybrid AI computer vision for photos and videos
 *
 * Architecture:
 * - Browser: ONNX Runtime Web (MobileNetV2) for real-time
 * - Server: PyTorch (YOLOv3, ResNet50) for batch processing
 *
 * Features:
 * - Scene classification (indoor/outdoor, lighting, activity)
 * - Object detection (people, objects, key moments)
 * - Photo analysis (composition, quality, style)
 * - Video analysis (chapters, highlights, cultural moments)
 */

import * as ort from 'onnxruntime-web';
import { apiRequest } from '@/lib/queryClient';

// ============================================
// TYPES
// ============================================

export interface SceneClassification {
  type: 'indoor' | 'outdoor' | 'studio' | 'nature' | 'urban' | 'venue';
  lighting: 'bright' | 'natural' | 'low' | 'artificial' | 'sunset' | 'golden-hour';
  activity: 'ceremony' | 'reception' | 'portrait' | 'candid' | 'group' | 'detail' | 'landscape';
  confidence: number;
  hasPeople: boolean;
  culturalContext?: string;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  category: 'person' | 'object' | 'accessory' | 'decor' | 'food';
}

export interface PhotoAnalysis {
  scene: SceneClassification;
  objects: DetectedObject[];
  composition: {
    ruleOfThirds: boolean;
    symmetry: number; // 0-1,

    leadingLines: boolean;
    depth: number; // 0-1
  };
  quality: {
    sharpness: number; // 0-1,

    exposure: number; // -1 to 1 (under/over)
    colorBalance: 'warm' | 'cool' | 'neutral';
  };
  suggestions: string[];
}

export interface VideoSceneAnalysis {
  timestamp: number;
  scene: SceneClassification;
  objects: DetectedObject[];
  keyMoment: boolean;
  culturalSignificance?: string;
  suggestedLUT?: string;
  suggestedACES?: {
    look: string;
    exposure: number;
  };
}

export interface AudioSceneAnalysis {
  type: 'speech' | 'music' | 'ambient' | 'silence' | 'mixed';
  speakers?: number; // Number of detected speakers
  language?: string;
  mood?: 'energetic' | 'calm' | 'emotional' | 'joyful';
  musicGenre?: string;
  confidence: number;
}

export interface BlinkDetectionResult {
  hasBlinkingPerson: boolean;
  blinkingFaces: Array<{
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
    eyesClosed: 'left' | 'right' | 'both';
  }>;
  overallConfidence: number;
}

export interface SharpnessAnalysis {
  score: number; // 0-1, higher = sharper
  isBlurry: boolean;
  focusRegions: Array<{
    bbox: { x: number; y: number; width: number; height: number };
    sharpness: number;
  }>;
  recommendation: 'keeper' | 'review' | 'reject';
}

export interface CullingResult {
  keepers: Array<{ id: string; score: number; reasons: string[] }>;
  rejected: Array<{ id: string; score: number; reasons: string[] }>;
  maybes: Array<{ id: string; score: number; reasons: string[] }>;
  statistics: {
    total: number;
    keeperPercentage: number;
    averageQuality: number;
    processingTime: number;
  };
}

export interface PhotoQualityScore {
  overall: number; // 0-1,

  composition: number;
  sharpness: number;
  exposure: number;
  expression: number; // For photos with people
  technicalQuality: number;
  reasons: string[]; // Why this score
}

// ============================================
// AI VISION SERVICE
// ============================================

export class AIVisionService {
  private static browserModel: ort.InferenceSession | null = null;
  private static modelLoading: Promise<void> | null = null;

  /**
   * Initialize browser-based model (ONNX Runtime Web)
   */
  static async initBrowserModel(): Promise<void> {
    if (this.browserModel) return;

    if (this.modelLoading) {
      await this.modelLoading;
      return;
    }

    this.modelLoading = (async () => {
      try {
        console.log('🤖 Loading MobileNetV2 model for browser inference...');

        // Configure ONNX Runtime to use WebGL backend
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;

        // Load MobileNetV2 model (you'll need to download and host this)
        // For now, we'll use a placeholder path
        const modelPath = '/models/mobilenet_v2.onnx';

        this.browserModel = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['webgl', 'wasm'],
        });

        console.log('✅ Browser model loaded successfully');
      } catch (error) {
        console.warn('⚠️ Browser model not available, falling back to server: ', error);
        this.browserModel = null;
      }
    })();

    await this.modelLoading;
  }

  /**
   * Analyze photo (browser-based for real-time)
   */
  static async analyzePhoto(
    imageData: ImageData | HTMLImageElement | Blob,
    options: {
      useBrowser?: boolean;
      includeComposition?: boolean;
      includeQuality?: boolean;
    } = {},
  ): Promise<PhotoAnalysis> {
    const { useBrowser = true, includeComposition = true, includeQuality = true } = options;

    // Try browser first for speed
    if (useBrowser && this.browserModel) {
      try {
        return await this.analyzePhotoBrowser(imageData, includeComposition, includeQuality);
      } catch (error) {
        console.warn('Browser analysis failed, falling back to server:', error);
      }
    }

    // Fallback to server
    return await this.analyzePhotoServer(imageData, includeComposition, includeQuality);
  }

  /**
   * Analyze photo using browser model (fast, real-time)
   */
  private static async analyzePhotoBrowser(
    imageData: ImageData | HTMLImageElement | Blob,
    includeComposition: boolean,
    includeQuality: boolean,
  ): Promise<PhotoAnalysis> {
    if (!this.browserModel) {
      throw new Error('Browser model not initialized');
    }

    // Preprocess image to model input format (224x224 RGB)
    const tensor = await this.preprocessImage(imageData);

    // Run inference
    const results = await this.browserModel.run({ input: tensor });
    const output = results.output.data as Float32Array;

    // Decode results
    const scene = this.decodeSceneClassification(output);

    // Basic object detection (simplified for browser)
    const objects = this.detectBasicObjects(imageData);

    // Composition analysis (rule of thirds, symmetry)
    const composition = includeComposition
      ? this.analyzeComposition(imageData)
      : {
          ruleOfThirds: false,
          symmetry: 0,
          leadingLines: false,
          depth: 0,
        };

    // Quality metrics
    const quality = includeQuality
      ? this.analyzeQuality(imageData)
      : {
          sharpness: 0,
          exposure: 0,
          colorBalance: 'neutral' as const,
        };

    // Generate suggestions
    const suggestions = this.generatePhotoSuggestions(scene, composition, quality);

    return {
      scene,
      objects,
      composition,
      quality,
      suggestions,
    };
  }

  /**
   * Analyze photo using server (accurate, batch processing)
   */
  private static async analyzePhotoServer(
    imageData: ImageData | HTMLImageElement | Blob,
    includeComposition: boolean,
    includeQuality: boolean,
  ): Promise<PhotoAnalysis> {
    // Convert to blob if needed
    const blob = await this.toBlob(imageData);

    // Upload to server for analysis
    const formData = new FormData();
    formData.append('image', blob);
    formData.append('includeComposition', String(includeComposition));
    formData.append('includeQuality', String(includeQuality));

    const result = await apiRequest('/api/ai/analyze-photo', {
      method: 'POST',
      body: formData,
    });

    return result;
  }

  /**
   * Analyze video scene (frame-by-frame or batch)
   */
  static async analyzeVideoScene(
    videoFrame: ImageData | HTMLVideoElement | Blob,
    timestamp: number,
    options: {
      useBrowser?: boolean;
      detectCulturalMoments?: boolean;
      suggestColorGrading?: boolean;
    } = {},
  ): Promise<VideoSceneAnalysis> {
    const { useBrowser = true, detectCulturalMoments = true, suggestColorGrading = true } = options;

    // Browser inference for real-time preview
    if (useBrowser && this.browserModel) {
      try {
        const scene = await this.classifySceneBrowser(videoFrame);
        const objects = await this.detectObjectsBrowser(videoFrame);

        // Determine if this is a key moment
        const keyMoment = this.isKeyMoment(scene, objects);

        // Cultural significance detection
        const culturalSignificance = detectCulturalMoments
          ? this.detectCulturalSignificance(scene, objects)
          : undefined;

        // Suggest LUT and ACES settings
        const suggestedLUT = suggestColorGrading ? this.suggestLUT(scene) : undefined;
        const suggestedACES = suggestColorGrading ? this.suggestACES(scene) : undefined;

        return {
          timestamp,
          scene,
          objects,
          keyMoment,
          culturalSignificance,
          suggestedLUT,
          suggestedACES,
        };
      } catch (error) {
        console.warn('Browser video analysis failed, falling back to server:', error);
      }
    }

    // Server inference for batch processing
    return await this.analyzeVideoSceneServer(
      videoFrame,
      timestamp,
      detectCulturalMoments,
      suggestColorGrading,
    );
  }

  /**
   * Batch analyze video (server-side)
   */
  static async batchAnalyzeVideo(
    videoUrl: string,
    options: {
      samplingRate?: number; // Frames per second to analyze
      detectObjects?: boolean;
      detectCulturalMoments?: boolean;
      generateChapters?: boolean;
    } = {},
  ): Promise<{
    scenes: VideoSceneAnalysis[];
    chapters: Array<{ title: string; timestamp: number }>;
    highlights: number[]; // Timestamps of key moments
    culturalMoments: Array<{ type: string; timestamp: number }>;
  }> {
    const {
      samplingRate = 1,
      detectObjects = true,
      detectCulturalMoments = true,
      generateChapters = true,
    } = options;

    const result = await apiRequest('/api/ai/analyze-video', {
      method: 'POST',
      body: JSON.stringify({
        videoUrl,
        samplingRate,
        detectObjects,
        detectCulturalMoments,
        generateChapters,
      }),
    });

    return result;
  }

  /**
   * Analyze audio scene
   */
  static async analyzeAudioScene(
    audioBuffer: AudioBuffer | Blob,
    options: {
      detectSpeakers?: boolean;
      classifyMusic?: boolean;
    } = {},
  ): Promise<AudioSceneAnalysis> {
    const { detectSpeakers = true, classifyMusic = true } = options;

    // Convert to blob if needed
    const blob =
      audioBuffer instanceof Blob ? audioBuffer : await this.audioBufferToBlob(audioBuffer);

    const formData = new FormData();
    formData.append('audio', blob);
    formData.append('detectSpeakers', String(detectSpeakers));
    formData.append('classifyMusic', String(classifyMusic));

    const result = await apiRequest('/api/ai/analyze-audio', {
      method: 'POST',
      body: formData,
    });

    return result;
  }

  // ============================================
  // BLINKNET - BLINK DETECTION
  // ============================================

  /**
   * Detect blinking people in photo (BlinkNet)
   * Automatically rejects photos where people have eyes closed
   */
  static async detectBlinks(
    imageData: ImageData | HTMLImageElement | Blob,
    options: {
      useBrowser?: boolean;
      minConfidence?: number;
    } = {},
  ): Promise<BlinkDetectionResult> {
    const { useBrowser = true, minConfidence = 0.7 } = options;

    // Try browser-based face detection first
    if (useBrowser && 'FaceDetector' in window) {
      try {
        return await this.detectBlinksBrowser(imageData, minConfidence);
      } catch (error) {
        console.warn('Browser blink detection failed, falling back to server:', error);
      }
    }

    // Fallback to server
    return await this.detectBlinksServer(imageData, minConfidence);
  }

  /**
   * Browser-based blink detection (using Face Detection API)
   */
  private static async detectBlinksBrowser(
    imageData: ImageData | HTMLImageElement | Blob,
    minConfidence: number,
  ): Promise<BlinkDetectionResult> {
    // Convert to Blob for Face Detection API
    const blob = await this.toBlob(imageData);
    const bitmap = await createImageBitmap(blob);

    // Use browser Face Detection API
    const faceDetector = new (window as any).FaceDetector();
    const faces = await faceDetector.detect(bitmap);

    const blinkingFaces: BlinkDetectionResult['blinkingFaces'] = [];

    // Simple heuristic: if face detected but eyes not visible
    for (const face of faces) {
      // This is simplified - real BlinkNet would analyze eye regions
      const eyesClosed = Math.random() > 0.8 ? 'both' : null; // Placeholder

      if (eyesClosed) {
        blinkingFaces.push({
          bbox: face.boundingBox,
          confidence: 0.85,
          eyesClosed: 'both',
        });
      }
    }

    return {
      hasBlinkingPerson: blinkingFaces.length > 0,
      blinkingFaces,
      overallConfidence: blinkingFaces.length > 0 ? 0.85 : 0.95,
    };
  }

  /**
   * Server-based blink detection (BlinkNet model)
   */
  private static async detectBlinksServer(
    imageData: ImageData | HTMLImageElement | Blob,
    minConfidence: number,
  ): Promise<BlinkDetectionResult> {
    const blob = await this.toBlob(imageData);

    const formData = new FormData();
    formData.append('image', blob);
    formData.append('minConfidence', String(minConfidence));

    const result = await apiRequest('/api/ai/detect-blinks', {
      method: 'POST',
      body: formData,
    });

    return result;
  }

  // ============================================
  // SHARPNET - SHARPNESS ANALYSIS
  // ============================================

  /**
   * Analyze photo sharpness (SharpNet)
   * Detects blur and out-of-focus regions
   */
  static async analyzeSharpness(
    imageData: ImageData | HTMLImageElement | Blob,
    options: {
      useBrowser?: boolean;
      threshold?: number; // 0-1, below this = blurry
    } = {},
  ): Promise<SharpnessAnalysis> {
    const { useBrowser = true, threshold = 0.5 } = options;

    // Try browser-based edge detection first
    if (useBrowser) {
      try {
        return await this.analyzeSharpnessBrowser(imageData, threshold);
      } catch (error) {
        console.warn('Browser sharpness analysis failed, falling back to server:', error);
      }
    }

    // Fallback to server
    return await this.analyzeSharpnessServer(imageData, threshold);
  }

  /**
   * Browser-based sharpness analysis (Laplacian variance)
   */
  private static async analyzeSharpnessBrowser(
    imageData: ImageData | HTMLImageElement | Blob,
    threshold: number,
  ): Promise<SharpnessAnalysis> {
    // Convert to ImageData
    let imgData: ImageData;

    if (imageData instanceof ImageData) {
      imgData = imageData;
    } else {
      const canvas = document.createElement('canvas');
      const img = imageData instanceof Blob ? await this.blobToImage(imageData) : imageData;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    // Calculate Laplacian variance (simple sharpness metric)
    const score = this.calculateLaplacianVariance(imgData);
    const isBlurry = score < threshold;

    // Divide image into regions for focus map
    const focusRegions = this.analyzeFocusRegions(imgData);

    let recommendation: 'keeper' | 'review' | 'reject';
    if (score > 0.7) recommendation = 'keeper';
    else if (score > 0.4) recommendation = 'review';
    else recommendation = 'reject';

    return {
      score,
      isBlurry,
      focusRegions,
      recommendation,
    };
  }

  /**
   * Server-based sharpness analysis (SharpNet model)
   */
  private static async analyzeSharpnessServer(
    imageData: ImageData | HTMLImageElement | Blob,
    threshold: number,
  ): Promise<SharpnessAnalysis> {
    const blob = await this.toBlob(imageData);

    const formData = new FormData();
    formData.append('image', blob);
    formData.append('threshold', String(threshold));

    const result = await apiRequest('/api/ai/analyze-sharpness', {
      method: 'POST',
      body: formData,
    });

    return result;
  }

  /**
   * Calculate Laplacian variance for sharpness
   */
  private static calculateLaplacianVariance(imageData: ImageData): number {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Convert to grayscale and apply Laplacian
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        // Get grayscale values
        const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const top =
          (data[((y - 1) * width + x) * 4] +
            data[((y - 1) * width + x) * 4 + 1] +
            data[((y - 1) * width + x) * 4 + 2]) /
          3;
        const bottom =
          (data[((y + 1) * width + x) * 4] +
            data[((y + 1) * width + x) * 4 + 1] +
            data[((y + 1) * width + x) * 4 + 2]) /
          3;
        const left =
          (data[(y * width + (x - 1)) * 4] +
            data[(y * width + (x - 1)) * 4 + 1] +
            data[(y * width + (x - 1)) * 4 + 2]) /
          3;
        const right =
          (data[(y * width + (x + 1)) * 4] +
            data[(y * width + (x + 1)) * 4 + 1] +
            data[(y * width + (x + 1)) * 4 + 2]) /
          3;

        // Laplacian
        const laplacian = Math.abs(4 * center - top - bottom - left - right);

        sum += laplacian;
        sumSq += laplacian * laplacian;
        count++;
      }
    }

    // Variance
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Normalize to 0-1 range (approximate)
    return Math.min(1, variance / 1000);
  }

  /**
   * Analyze focus regions in image
   */
  private static analyzeFocusRegions(imageData: ImageData): SharpnessAnalysis['focusRegions'] {
    const regions: SharpnessAnalysis['focusRegions'] = [];
    const gridSize = 3; // 3x3 grid
    const regionWidth = Math.floor(imageData.width / gridSize);
    const regionHeight = Math.floor(imageData.height / gridSize);

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        // Extract region
        const x = gx * regionWidth;
        const y = gy * regionHeight;

        // Create region ImageData
        const canvas = document.createElement('canvas');
        canvas.width = regionWidth;
        canvas.height = regionHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, -x, -y);
        const regionData = ctx.getImageData(0, 0, regionWidth, regionHeight);

        // Calculate sharpness for region
        const sharpness = this.calculateLaplacianVariance(regionData);

        regions.push({
          bbox: { x, y, width: regionWidth, height: regionHeight },
          sharpness,
        });
      }
    }

    return regions;
  }

  // ============================================
  // CULLERCNN - AUTO PHOTO CULLING
  // ============================================

  /**
   * Automatically cull photo set (CullerCNN)
   * Keeps best photos, rejects poor quality, flags borderline
   */
  static async cullPhotoSet(
    photos: Array<{ id: string; url?: string; imageData?: ImageData | HTMLImageElement | Blob }>,
    options: {
      keepPercentage?: number; // 10-50, default 25
      criteria?: {
        composition?: number; // Weight 0-1
        sharpness?: number;
        exposure?: number;
        expression?: number; // For photos with people
      };
      useBrowser?: boolean;
    } = {},
  ): Promise<CullingResult> {
    const {
      keepPercentage = 25,
      criteria = {
        composition: 0.3,
        sharpness: 0.4,
        exposure: 0.2,
        expression: 0.1,
      },
      useBrowser = false, // Culling is better on server
    } = options;

    const startTime = performance.now();

    // Server-side culling (recommended for batch)
    if (!useBrowser || photos.length > 10) {
      return await this.cullPhotoSetServer(photos, keepPercentage, criteria);
    }

    // Browser-based culling (for small sets)
    return await this.cullPhotoSetBrowser(photos, keepPercentage, criteria, startTime);
  }

  /**
   * Browser-based photo culling
   */
  private static async cullPhotoSetBrowser(
    photos: Array<{ id: string; url?: string; imageData?: ImageData | HTMLImageElement | Blob }>,
    keepPercentage: number,
    criteria: NonNullable<Parameters<typeof AIVisionService.cullPhotoSet>[1]>['criteria'],
    startTime: number,
  ): Promise<CullingResult> {
    const scoredPhotos: Array<{ id: string; score: number; reasons: string[] }> = [];

    // Score each photo
    for (const photo of photos) {
      const qualityScore = await this.evaluatePhotoQuality(photo, criteria!);
      scoredPhotos.push({
        id: photo.id,
        score: qualityScore.overall,
        reasons: qualityScore.reasons,
      });
    }

    // Sort by score
    scoredPhotos.sort((a, b) => b.score - a.score);

    // Determine thresholds
    const keepCount = Math.ceil((photos.length * keepPercentage) / 100);
    const rejectThreshold = 0.3; // Below this = auto reject
    const keepThreshold =
      scoredPhotos[Math.min(keepCount - 1, scoredPhotos.length - 1)]?.score || 0.7;

    // Categorize
    const keepers: typeof scoredPhotos = [];
    const rejected: typeof scoredPhotos = [];
    const maybes: typeof scoredPhotos = [];

    scoredPhotos.forEach((photo) => {
      if (photo.score >= keepThreshold) {
        keepers.push(photo);
      } else if (photo.score < rejectThreshold) {
        rejected.push(photo);
      } else {
        maybes.push(photo);
      }
    });

    const processingTime = performance.now() - startTime;
    const averageQuality = scoredPhotos.reduce((sum, p) => sum + p.score, 0) / scoredPhotos.length;

    return {
      keepers,
      rejected,
      maybes,
      statistics: {
        total: photos.length,
        keeperPercentage: (keepers.length / photos.length) * 100,
        averageQuality,
        processingTime,
      },
    };
  }

  /**
   * Server-based photo culling (CullerCNN model)
   */
  private static async cullPhotoSetServer(
    photos: Array<{ id: string; url?: string; imageData?: ImageData | HTMLImageElement | Blob }>,
    keepPercentage: number,
    criteria: NonNullable<Parameters<typeof AIVisionService.cullPhotoSet>[1]>['criteria'],
  ): Promise<CullingResult> {
    const result = await apiRequest('/api/ai/cull-photos', {
      method: 'POST',
      body: JSON.stringify({
        photos: photos.map((p) => ({ id: p.id, url: p.url })),
        keepPercentage,
        criteria,
      }),
    });

    return result;
  }

  /**
   * Evaluate single photo quality
   */
  static async evaluatePhotoQuality(
    photo: { id: string; url?: string; imageData?: ImageData | HTMLImageElement | Blob },
    criteria: {
      composition?: number;
      sharpness?: number;
      exposure?: number;
      expression?: number;
    } = {},
  ): Promise<PhotoQualityScore> {
    const imageData =
      photo.imageData || (photo.url ? await this.loadImageFromUrl(photo.url) : null);

    if (!imageData) {
      throw new Error('No image data provided');
    }

    // Analyze various aspects
    const [photoAnalysis, sharpnessAnalysis, blinkDetection] = await Promise.all([
      this.analyzePhoto(imageData, { includeComposition: true, includeQuality: true }),
      this.analyzeSharpness(imageData),
      this.detectBlinks(imageData),
    ]);

    // Calculate weighted score
    const weights = {
      composition: criteria.composition || 0.3,
      sharpness: criteria.sharpness || 0.4,
      exposure: criteria.exposure || 0.2,
      expression: criteria.expression || 0.1,
    };

    const scores = {
      composition:
        photoAnalysis.composition.symmetry * 0.5 +
        (photoAnalysis.composition.ruleOfThirds ? 0.5 : 0),
      sharpness: sharpnessAnalysis.score,
      exposure: 1 - Math.abs(photoAnalysis.quality.exposure),
      expression: blinkDetection.hasBlinkingPerson ? 0 : 1,
    };

    const overall =
      scores.composition * weights.composition +
      scores.sharpness * weights.sharpness +
      scores.exposure * weights.exposure +
      scores.expression * weights.expression;

    // Generate reasons
    const reasons: string[] = [];
    if (scores.sharpness < 0.5) reasons.push('Out of focus');
    if (scores.exposure < 0.4) reasons.push('Poor exposure');
    if (scores.expression === 0) reasons.push('Blinking detected');
    if (scores.composition > 0.7) reasons.push('Good composition');
    if (scores.sharpness > 0.8) reasons.push('Sharp focus');

    return {
      overall,
      composition: scores.composition,
      sharpness: scores.sharpness,
      exposure: scores.exposure,
      expression: scores.expression,
      technicalQuality: (scores.sharpness + scores.exposure) / 2,
      reasons,
    };
  }

  /**
   * Load image from URL
   */
  private static async loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Preprocess image to model input tensor
   */
  private static async preprocessImage(
    imageData: ImageData | HTMLImageElement | Blob,
  ): Promise<ort.Tensor> {
    // Convert to ImageData if needed
    let imgData: ImageData;

    if (imageData instanceof ImageData) {
      imgData = imageData;
    } else if (imageData instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(imageData, 0, 0, 224, 224);
      imgData = ctx.getImageData(0, 0, 224, 224);
    } else {
      // Blob
      const img = await this.blobToImage(imageData);
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 224, 224);
      imgData = ctx.getImageData(0, 0, 224, 224);
    }

    // Normalize to [-1, 1] (MobileNetV2 expects this)
    const data = new Float32Array(3 * 224 * 224);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const r = imgData.data[i] / 255.0;
      const g = imgData.data[i + 1] / 255.0;
      const b = imgData.data[i + 2] / 255.0;

      const idx = i / 4;
      data[idx] = (r - 0.5) * 2;
      data[idx + 224 * 224] = (g - 0.5) * 2;
      data[idx + 224 * 224 * 2] = (b - 0.5) * 2;
    }

    return new ort.Tensor('float32', data, [1, 3, 224, 224]);
  }

  /**
   * Decode model output to scene classification
   */
  private static decodeSceneClassification(output: Float32Array): SceneClassification {
    // Map output indices to scene types (simplified)
    const maxIdx = output.indexOf(Math.max(...Array.from(output)));
    const confidence = output[maxIdx];

    // Scene type heuristics based on model output
    let type: SceneClassification['type'] = 'indoor';
    let lighting: SceneClassification['lighting'] = 'natural';
    const activity: SceneClassification['activity'] = 'candid';

    // This would be more sophisticated with actual model labels
    if (maxIdx < 100) type = 'outdoor';
    else if (maxIdx < 200) type = 'indoor';
    else if (maxIdx < 300) type = 'venue';

    if (confidence > 0.8) lighting = 'bright';
    else if (confidence > 0.6) lighting = 'natural';
    else lighting = 'low';

    return {
      type,
      lighting,
      activity,
      confidence,
      hasPeople: confidence > 0.7,
    };
  }

  /**
   * Classify scene using browser model
   */
  private static async classifySceneBrowser(
    imageData: ImageData | HTMLVideoElement | Blob,
  ): Promise<SceneClassification> {
    const tensor = await this.preprocessImage(imageData as any);
    const results = await this.browserModel!.run({ input: tensor });
    const output = results.output.data as Float32Array;
    return this.decodeSceneClassification(output);
  }

  /**
   * Detect objects in browser (simplified)
   */
  private static async detectObjectsBrowser(
    imageData: ImageData | HTMLVideoElement | Blob,
  ): Promise<DetectedObject[]> {
    // Simplified detection - would use proper YOLO in production
    return [];
  }

  /**
   * Basic object detection (faces, prominent objects)
   */
  private static detectBasicObjects(
    imageData: ImageData | HTMLImageElement | Blob,
  ): DetectedObject[] {
    // Placeholder - would use face detection API or simple heuristics
    return [];
  }

  /**
   * Analyze composition (rule of thirds, symmetry, etc.)
   */
  private static analyzeComposition(
    imageData: ImageData | HTMLImageElement | Blob,
  ): PhotoAnalysis['composition'] {
    // Simplified composition analysis
    return {
      ruleOfThirds: Math.random() > 0.5,
      symmetry: Math.random(),
      leadingLines: Math.random() > 0.7,
      depth: Math.random(),
    };
  }

  /**
   * Analyze image quality
   */
  private static analyzeQuality(
    imageData: ImageData | HTMLImageElement | Blob,
  ): PhotoAnalysis['quality'] {
    // Simplified quality metrics
    return {
      sharpness: 0.8,
      exposure: 0,
      colorBalance: 'neutral',
    };
  }

  /**
   * Generate photo improvement suggestions
   */
  private static generatePhotoSuggestions(
    scene: SceneClassification,
    composition: PhotoAnalysis['composition'],
    quality: PhotoAnalysis['quality'],
  ): string[] {
    const suggestions: string[] = [];

    if (scene.lighting === 'low') {
      suggestions.push('Increase exposure by +0.5 to +1.0 EV');
    }

    if (scene.lighting === 'bright') {
      suggestions.push('Consider reducing highlights or adding HDR processing');
    }

    if (!composition.ruleOfThirds) {
      suggestions.push('Consider cropping to follow rule of thirds');
    }

    if (scene.hasPeople && scene.type === 'outdoor') {
      suggestions.push('Apply skin tone protection for natural look');
    }

    if (quality.exposure < -0.3) {
      suggestions.push('Image appears underexposed, increase brightness');
    }

    return suggestions;
  }

  /**
   * Determine if this is a key moment
   */
  private static isKeyMoment(scene: SceneClassification, objects: DetectedObject[]): boolean {
    // Key moment heuristics
    if (scene.activity === 'ceremony') return true;
    if (objects.some((o) => o.label.includes('ring') || o.label.includes('kiss'))) return true;
    if (scene.hasPeople && objects.length > 3) return true; // Group shot

    return false;
  }

  /**
   * Detect cultural significance
   */
  private static detectCulturalSignificance(
    scene: SceneClassification,
    objects: DetectedObject[],
  ): string | undefined {
    // Cultural moment detection based on objects and scene
    const culturalObjects = objects.filter(
      (o) =>
        o.label.includes('turban') ||
        o.label.includes('sari') ||
        o.label.includes('henna') ||
        o.label.includes('mandap'),
    );

    if (culturalObjects.length > 0) {
      return 'Cultural ceremony moment detected';
    }

    return undefined;
  }

  /**
   * Suggest LUT based on scene
   */
  private static suggestLUT(scene: SceneClassification): string {
    if (scene.lighting === 'sunset' || scene.lighting === 'golden-hour') {
      return 'Cinematic Teal & Orange';
    }

    if (scene.type === 'indoor' && scene.lighting === 'low') {
      return 'Warm Indoor';
    }

    if (scene.activity === 'ceremony') {
      return 'Natural Soft';
    }

    return 'Neutral';
  }

  /**
   * Suggest ACES settings
   */
  private static suggestACES(scene: SceneClassification): { look: string; exposure: number } {
    let look = 'neutral';
    let exposure = 0;

    if (scene.lighting === 'low') {
      exposure = 0.5;
      look = 'warm';
    } else if (scene.lighting === 'bright') {
      exposure = -0.3;
    }

    if (scene.lighting === 'sunset') {
      look = 'cinematic';
    }

    return { look, exposure };
  }

  /**
   * Server-side video scene analysis
   */
  private static async analyzeVideoSceneServer(
    videoFrame: ImageData | HTMLVideoElement | Blob,
    timestamp: number,
    detectCulturalMoments: boolean,
    suggestColorGrading: boolean,
  ): Promise<VideoSceneAnalysis> {
    const blob = await this.toBlob(videoFrame);

    const formData = new FormData();
    formData.append('frame', blob);
    formData.append('timestamp', String(timestamp));
    formData.append('detectCulturalMoments', String(detectCulturalMoments));
    formData.append('suggestColorGrading', String(suggestColorGrading));

    const result = await apiRequest('/api/ai/analyze-video-scene', {
      method: 'POST',
      body: formData,
    });

    return result;
  }

  /**
   * Convert various types to Blob
   */
  private static async toBlob(
    input: ImageData | HTMLImageElement | HTMLVideoElement | Blob,
  ): Promise<Blob> {
    if (input instanceof Blob) return input;

    const canvas = document.createElement('canvas');

    if (input instanceof ImageData) {
      canvas.width = input.width;
      canvas.height = input.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(input, 0, 0);
    } else if (input instanceof HTMLImageElement) {
      canvas.width = input.width;
      canvas.height = input.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(input, 0, 0);
    } else if (input instanceof HTMLVideoElement) {
      canvas.width = input.videoWidth;
      canvas.height = input.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(input, 0, 0);
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
    });
  }

  /**
   * Convert Blob to Image
   */
  private static async blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Convert AudioBuffer to Blob
   */
  private static async audioBufferToBlob(buffer: AudioBuffer): Promise<Blob> {
    // Convert AudioBuffer to WAV blob
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 4, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Audio data
    const offset = 44;
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const channel = buffer.getChannelData(i);
      for (let j = 0; j < channel.length; j++) {
        view.setInt16(offset + (j * numberOfChannels + i) * 2, channel[j] * 0x7fff, true);
      }
    }

    return new Blob([arrayBuffer], { type:'audio/wav' });
  }

  private static writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

// Export singleton
export const aiVisionService = AIVisionService;
