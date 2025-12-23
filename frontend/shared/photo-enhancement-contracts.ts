import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// Enhanced schemas with discriminated unions and better validation
const EnhancementTypeSchema = z.enum(['upscale', 'face_restore', 'denoise', 'colorize', 'batch']);
const JobStatusSchema = z.enum(['pending', 'processing', 'completed', 'error', 'cancelled']);

const QualityMetricsSchema = z.object({
  psnr: z.number().min(0).max(100),
  ssim: z.number().min(0).max(1),
  lpips: z.number().min(0).max(1),
  originalResolution: z.string().regex(/^\d+x\d+$/),
  enhancedResolution: z.string().regex(/^\d+x\d+$/),
  measurementMethod: z.string().optional(),
  version: z.string().optional(),
});

const ProcessingOptionsSchema = z.object({
  enhancementType: EnhancementTypeSchema,
  upscaleFactor: z.number().int().min(1).max(8).default(4),
  denoiseStrength: z.number().min(0).max(1).default(0.8),
  colorizeStrength: z.number().min(0).max(1).default(0.8),
  outputFormat: z.enum(['jpg', 'png', 'webp', 'tiff', 'tif']).default('png'),
  outputQuality: z.number().int().min(1).max(100).default(95),
  preserveOriginal: z.boolean().default(true),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

const EnhancementJobSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  originalSize: z.number().int().positive(),
  originalUrl: z.string().url(),
  enhancedUrl: z.string().url().optional(),
  enhancementType: EnhancementTypeSchema,
  status: JobStatusSchema,
  progress: z.number().min(0).max(100),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  processingTime: z.number().positive().optional(),
  qualityMetrics: QualityMetricsSchema.optional(),
  errorMessage: z.string().optional(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),
});

const QualityComparisonSchema = z.object({
  jobId: z.string().uuid(),
  originalMetrics: z.object({
    resolution: z.string().regex(/^\d+x\d+$/),
    fileSize: z.number().int().positive(),
    sharpness: z.number().min(0).max(100),
    noise: z.number().min(0).max(100),
    colorBalance: z.number().min(0).max(100),
    overallQuality: z.number().min(0).max(100),
  }),
  enhancedMetrics: z.object({
    resolution: z.string().regex(/^\d+x\d+$/),
    fileSize: z.number().int().positive(),
    sharpness: z.number().min(0).max(100),
    noise: z.number().min(0).max(100),
    colorBalance: z.number().min(0).max(100),
    overallQuality: z.number().min(0).max(100),
    improvementScore: z.number().min(-100).max(100),
  }),
  qualityMetrics: QualityMetricsSchema,
  generatedAt: z.string().datetime(),
});

const SystemTelemetrySchema = z.object({
  gpuUsage: z.number().min(0).max(100),
  memoryUsage: z.string(),
  processingSpeed: z.string(),
  totalJobsCompleted: z.number().int().min(0),
  avgProcessingTime: z.string(),
  qualityImprovement: z.string(),
  activeJobs: z.number().int().min(0),
  queueLength: z.number().int().min(0),
  lastUpdated: z.string().datetime(),
});

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().uuid(),
    timestamp: z.string().datetime(),
  }),
});

// Request/Response schemas
const StartEnhancementRequestSchema = z.object({
  files: z.array(z.instanceof(File)).min(1).max(50),
  options: ProcessingOptionsSchema,
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
});

const StartEnhancementResponseSchema = z.object({
  jobs: z.array(EnhancementJobSchema),
  requestId: z.string().uuid(),
  estimatedCompletionTime: z.number().positive(),
  queuePosition: z.number().int().min(0),
});

const GetJobsRequestSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  status: JobStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'completedAt', 'priority']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const GetJobsResponseSchema = z.object({
  jobs: z.array(EnhancementJobSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
  requestId: z.string().uuid(),
});

const CancelJobResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('cancelled'),
  message: z.string(),
  requestId: z.string().uuid(),
});

const DownloadResponseSchema = z.object({
  signedUrl: z.string().url(),
  filename: z.string(),
  expiresAt: z.string().datetime(),
  fileSize: z.number().int().positive(),
  requestId: z.string().uuid(),
});

// Auth header schema
const AuthHeaderSchema = z.object({
  authorization: z.string().regex(/^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/),
});

export const photoEnhancementContract = initContract().router({
  // Start enhancement job
  startEnhancement: {
    method: 'POST',
    path: '/api/photo-enhancement/start',
    headers: AuthHeaderSchema,
    body: z.object({
      options: ProcessingOptionsSchema,
      userId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
    }),
    // Note: File uploads handled separately due to FormData limitations
    responses: {
      200: StartEnhancementResponseSchema,
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      409: ErrorResponseSchema, // Duplicate job conflict
      413: ErrorResponseSchema, // File too large
      429: ErrorResponseSchema, // Rate limited
      500: ErrorResponseSchema,
    },
  },

  // Get enhancement jobs
  getJobs: {
    method: 'GET',
    path: '/api/photo-enhancement/jobs',
    headers: AuthHeaderSchema,
    query: GetJobsRequestSchema,
    responses: {
      200: GetJobsResponseSchema,
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },

  // Get quality comparison
  getQualityComparison: {
    method: 'GET',
    path: '/api/photo-enhancement/quality-comparison/:jobId',
    headers: AuthHeaderSchema,
    pathParams: z.object({
      jobId: z.string().uuid(),
    }),
    responses: {
      200: QualityComparisonSchema,
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },

  // Cancel enhancement job
  cancelJob: {
    method: 'POST',
    path: '/api/photo-enhancement/cancel/:jobId',
    headers: AuthHeaderSchema,
    pathParams: z.object({
      jobId: z.string().uuid(),
    }),
    body: z.object({}),
    responses: {
      200: CancelJobResponseSchema,
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema, // Job cannot be cancelled (already completed)
      500: ErrorResponseSchema,
    },
  },

  // Download enhanced image
  downloadEnhanced: {
    method: 'GET',
    path: '/api/photo-enhancement/download/:jobId',
    headers: AuthHeaderSchema,
    pathParams: z.object({
      jobId: z.string().uuid(),
    }),
    responses: {
      200: DownloadResponseSchema,
      400: ErrorResponseSchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      404: ErrorResponseSchema,
      410: ErrorResponseSchema, // File expired/deleted
      500: ErrorResponseSchema,
    },
  },

  // Get system telemetry
  getTelemetry: {
    method: 'GET',
    path: '/api/photo-enhancement/telemetry',
    headers: AuthHeaderSchema,
    responses: {
      200: SystemTelemetrySchema,
      401: ErrorResponseSchema,
      403: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
});

// Export types for use in client and server
export type EnhancementJob = z.infer<typeof EnhancementJobSchema>;
export type ProcessingOptions = z.infer<typeof ProcessingOptionsSchema>;
export type QualityComparison = z.infer<typeof QualityComparisonSchema>;
export type SystemTelemetry = z.infer<typeof SystemTelemetrySchema>;
export type EnhancementType = z.infer<typeof EnhancementTypeSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type StartEnhancementRequest = z.infer<typeof StartEnhancementRequestSchema>;
export type StartEnhancementResponse = z.infer<typeof StartEnhancementResponseSchema>;
export type GetJobsRequest = z.infer<typeof GetJobsRequestSchema>;
export type GetJobsResponse = z.infer<typeof GetJobsResponseSchema>;
export type CancelJobResponse = z.infer<typeof CancelJobResponseSchema>;
export type DownloadResponse = z.infer<typeof DownloadResponseSchema>;

// Export schemas for reuse
export {
  EnhancementJobSchema,
  ProcessingOptionsSchema,
  QualityComparisonSchema,
  SystemTelemetrySchema,
  EnhancementTypeSchema,
  JobStatusSchema,
  ErrorResponseSchema,
};
