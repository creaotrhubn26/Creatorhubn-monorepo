import { z } from 'zod';

export const assetStateSchema = z.enum([
  'anticipated',
  'previewPending',
  'previewReady',
  'fullPending',
  'fullReady',
  'rawPending',
  'rawReady',
  'syncPending',
  'syncInProgress',
  'syncComplete',
  'verified',
  'failedTransient',
  'failedPermanent',
]);
export type AssetState = z.infer<typeof assetStateSchema>;

export const colorLabelSchema = z.enum([
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray',
]);
export type ColorLabel = z.infer<typeof colorLabelSchema>;

export const reviewerTypeSchema = z.enum(['photographer', 'client', 'assistant']);
export type ReviewerType = z.infer<typeof reviewerTypeSchema>;

export const sessionStatusSchema = z.enum(['active', 'paused', 'closed']);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const downloadKindSchema = z.enum(['preview', 'full', 'raw']);
export type DownloadKind = z.infer<typeof downloadKindSchema>;

export const assetSignalsSchema = z.object({
  sharpness: z.number().min(0).max(100).optional(),
  eyesOpen: z.boolean().optional(),
  faceCount: z.number().int().nonnegative().optional(),
  duplicateGroupId: z.string().uuid().optional(),
});
export type AssetSignals = z.infer<typeof assetSignalsSchema>;

export const createSessionRequestSchema = z.object({
  name: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const updateSessionRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  endsAt: z.string().datetime().optional(),
  status: sessionStatusSchema.optional(),
});
export type UpdateSessionRequest = z.infer<typeof updateSessionRequestSchema>;

export const registerAssetRequestSchema = z.object({
  originalFilename: z.string().min(1).max(512),
  captureTime: z.string().datetime(),
  mime: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type RegisterAssetRequest = z.infer<typeof registerAssetRequestSchema>;

export const updateAssetRequestSchema = z.object({
  rating: z.number().int().min(0).max(5).optional(),
  colorLabel: colorLabelSchema.nullable().optional(),
  flaggedForClient: z.boolean().optional(),
  rejected: z.boolean().optional(),
});
export type UpdateAssetRequest = z.infer<typeof updateAssetRequestSchema>;

export const uploadPartSchema = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string(),
});

export const uploadCompleteRequestSchema = z.object({
  kind: downloadKindSchema,
  checksumSha256: z.string().length(64),
  sizeBytes: z.number().int().positive(),
  uploadId: z.string(),
  parts: z.array(uploadPartSchema).min(1),
});
export type UploadCompleteRequest = z.infer<typeof uploadCompleteRequestSchema>;

export const createReviewRequestSchema = z
  .object({
    heart: z.boolean().optional(),
    rating: z.number().int().min(0).max(5).optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (data) => data.heart !== undefined || data.rating !== undefined || data.comment !== undefined,
    { message: 'At least one of heart, rating, or comment must be provided' },
  );
export type CreateReviewRequest = z.infer<typeof createReviewRequestSchema>;

export const captureEventTypeSchema = z.enum([
  'captured',
  'preview_ready',
  'full_ready',
  'raw_ready',
  'rated',
  'color_labelled',
  'flagged',
  'rejected',
  'commented',
  'hearted',
  'uploaded',
  'verified',
  'failed',
  'session_opened',
  'session_closed',
  'handoff_triggered',
]);
export type CaptureEventType = z.infer<typeof captureEventTypeSchema>;

export const postEventsRequestSchema = z.object({
  events: z
    .array(
      z.object({
        assetId: z.string().uuid().optional(),
        eventType: captureEventTypeSchema,
        metadata: z.record(z.string(), z.unknown()).optional(),
        occurredAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(500),
});
export type PostEventsRequest = z.infer<typeof postEventsRequestSchema>;
