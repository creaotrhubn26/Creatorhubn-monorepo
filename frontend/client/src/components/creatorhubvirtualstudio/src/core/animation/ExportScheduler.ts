/**
 * ExportScheduler - Queue and schedule video exports
 * 
 * Features:
 * - Export queue management
 * - Scheduled exports (delay, specific time)
 * - Batch exports to multiple formats
 * - Priority queue
 * - Auto-retry on failure
 * - Notification callbacks
 * - Google Drive auto-upload
 * - Export history persistence
 */

import { logger } from '../services/logger';

const log = logger.module('ExportScheduler');

import {
  type VideoExportConfig,
  type ExportProgress,
  type ExportResult,
  videoExportService
} from './VideoExportService';
import {
  type ExportPreset,
  type GoogleDriveUploadProgress,
  googleDriveExportService,
  EXPORT_PRESETS
} from './GoogleDriveExportService';
import { exportJobsApi, type ExportJobDB } from '../api/virtualStudioApi';

// ============================================================================
// Types
// ============================================================================

export type ExportJobStatus =
  | 'pending'
  | 'scheduled'
  | 'queued'
  | 'exporting'
  | 'uploading'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type ExportJobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ExportJob {
  id: string;
  name: string;
  config: VideoExportConfig;
  preset?: ExportPreset;
  status: ExportJobStatus;
  priority: ExportJobPriority;
  
  // Scheduling
  scheduledTime?: Date;
  delaySeconds?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Progress
  exportProgress?: ExportProgress;
  uploadProgress?: GoogleDriveUploadProgress;
  
  // Results
  result?: ExportResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
  
  // Google Drive
  uploadToDrive: boolean;
  driveConfig?: {
    userId: string;
    projectId?: string;
    projectName?: string;
    folderId?: string;
  };
  driveResult?: {
    fileId: string;
    webViewLink: string;
  };
  
  // Callbacks
  onProgress?: (job: ExportJob) => void;
  onComplete?: (job: ExportJob) => void;
  onError?: (job: ExportJob, error: string) => void;
}

export interface BatchExportConfig {
  name: string;
  presets: string[]; // Preset IDs
  uploadToDrive: boolean;
  driveConfig?: {
    userId: string;
    projectId?: string;
    projectName?: string;
    folderId?: string;
  };
}

export interface SchedulerState {
  isRunning: boolean;
  currentJob: ExportJob | null;
  queue: ExportJob[];
  history: ExportJob[];
  totalExported: number;
  totalFailed: number;
}

export type SchedulerStateCallback = (state: SchedulerState) => void;

function normalizeExportQuality(
  quality: string,
): VideoExportConfig['quality'] {
  switch (quality) {
    case 'low':
    case 'medium':
    case 'high':
    case 'ultra':
      return quality;
    default:
      return 'high';
  }
}

// ============================================================================
// Priority Order
// ============================================================================

const PRIORITY_ORDER: Record<ExportJobPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ============================================================================
// Export Scheduler Service
// ============================================================================

class ExportSchedulerService {
  private queue: ExportJob[] = [];
  private history: ExportJob[] = [];
  private currentJob: ExportJob | null = null;
  private isProcessing = false;
  private scheduledTimers: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Set<SchedulerStateCallback> = new Set();
  private totalExported = 0;
  private totalFailed = 0;
  private frameRenderCallback?: (time: number, frameIndex: number) => void;

  // -------------------------------------------------------------------------
  // State Management
  // -------------------------------------------------------------------------

  getState(): SchedulerState {
    return {
      isRunning: this.isProcessing,
      currentJob: this.currentJob,
      queue: [...this.queue],
      history: [...this.history],
      totalExported: this.totalExported,
      totalFailed: this.totalFailed,
    };
  }

  subscribe(callback: SchedulerStateCallback): () => void {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach((cb) => cb(state));
  }

  // -------------------------------------------------------------------------
  // Frame Render Callback
  // -------------------------------------------------------------------------

  setFrameRenderCallback(callback: (time: number, frameIndex: number) => void): void {
    this.frameRenderCallback = callback;
  }

  // -------------------------------------------------------------------------
  // Job Creation
  // -------------------------------------------------------------------------

  createJob(
    config: VideoExportConfig,
    options: Partial<Omit<ExportJob, 'id' | 'config' | 'status' | 'createdAt' | 'retryCount'>> = {}
  ): ExportJob {
    const job: ExportJob = {
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: options.name || `Export ${new Date().toLocaleString()}`,
      config,
      status: 'pending',
      priority: options.priority || 'normal',
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? 2,
      uploadToDrive: options.uploadToDrive ?? false,
      ...options,
    };

    return job;
  }

  createJobFromPreset(
    presetId: string,
    duration: number,
    options: Partial<Omit<ExportJob, 'id' | 'config' | 'status' | 'createdAt' | 'retryCount'>> = {}
  ): ExportJob | null {
    const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return null;

    const config: VideoExportConfig = {
      format: preset.config.format,
      width: preset.config.width,
      height: preset.config.height,
      fps: preset.config.fps,
      bitrate: preset.config.bitrate,
      duration,
      quality: 'high',
    };

    return this.createJob(config, {
      ...options,
      name: options.name || `${preset.name} Export`,
      preset,
    });
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  addToQueue(job: ExportJob): string {
    job.status = 'queued';
    this.queue.push(job);
    this.sortQueue();
    this.notifySubscribers();
    this.processNextInQueue();
    // Persist to database
    this.saveJobToDb(job);
    return job.id;
  }

  scheduleJob(job: ExportJob, scheduledTime: Date): string {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      // Time has passed, add immediately
      return this.addToQueue(job);
    }

    job.status = 'scheduled';
    job.scheduledTime = scheduledTime;
    this.queue.push(job);
    this.sortQueue();
    this.notifySubscribers();

    // Set timer
    const timer = setTimeout(() => {
      job.status = 'queued';
      this.scheduledTimers.delete(job.id);
      this.sortQueue();
      this.notifySubscribers();
      this.processNextInQueue();
      // Update status in database
      this.updateJobInDb(job);
    }, delay);

    this.scheduledTimers.set(job.id, timer);
    
    // Persist to database
    this.saveJobToDb(job);
    return job.id;
  }

  scheduleJobWithDelay(job: ExportJob, delaySeconds: number): string {
    const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
    job.delaySeconds = delaySeconds;
    return this.scheduleJob(job, scheduledTime);
  }

  cancelJob(jobId: string): boolean {
    // Check if it's the current job
    if (this.currentJob?.id === jobId) {
      videoExportService.cancelExport();
      this.currentJob.status = 'cancelled';
      this.moveToHistory(this.currentJob);
      this.currentJob = null;
      this.isProcessing = false;
      this.notifySubscribers();
      this.processNextInQueue();
      return true;
    }

    // Check queue
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index >= 0) {
      const job = this.queue[index];
      job.status = 'cancelled';
      
      // Clear timer if scheduled
      const timer = this.scheduledTimers.get(jobId);
      if (timer) {
        clearTimeout(timer);
        this.scheduledTimers.delete(jobId);
      }
      
      this.queue.splice(index, 1);
      this.moveToHistory(job);
      this.notifySubscribers();
      return true;
    }

    return false;
  }

  clearQueue(): void {
    // Cancel all scheduled timers
    this.scheduledTimers.forEach((timer) => clearTimeout(timer));
    this.scheduledTimers.clear();

    // Mark all as cancelled
    this.queue.forEach((job) => {
      job.status = 'cancelled';
      this.moveToHistory(job);
    });

    this.queue = [];
    this.notifySubscribers();
  }

  reorderJob(jobId: string, newPriority: ExportJobPriority): void {
    const job = this.queue.find((j) => j.id === jobId);
    if (job && job.status === 'queued') {
      job.priority = newPriority;
      this.sortQueue();
      this.notifySubscribers();
    }
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Scheduled jobs go after queued jobs
      if (a.status === 'scheduled' && b.status !== 'scheduled') return 1;
      if (a.status !== 'scheduled' && b.status === 'scheduled') return -1;
      
      // For scheduled jobs, sort by scheduled time
      if (a.status === 'scheduled' && b.status === 'scheduled') {
        return (a.scheduledTime?.getTime() || 0) - (b.scheduledTime?.getTime() || 0);
      }
      
      // For queued jobs, sort by priority then creation time
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  // -------------------------------------------------------------------------
  // Batch Export
  // -------------------------------------------------------------------------

  createBatchExport(
    duration: number,
    batchConfig: BatchExportConfig
  ): string[] {
    const jobIds: string[] = [];

    for (const presetId of batchConfig.presets) {
      const job = this.createJobFromPreset(presetId, duration, {
        name: `${batchConfig.name} - ${presetId}`,
        uploadToDrive: batchConfig.uploadToDrive,
        driveConfig: batchConfig.driveConfig,
      });

      if (job) {
        const id = this.addToQueue(job);
        jobIds.push(id);
      }
    }

    return jobIds;
  }

  // -------------------------------------------------------------------------
  // Processing
  // -------------------------------------------------------------------------

  private async processNextInQueue(): Promise<void> {
    if (this.isProcessing) return;

    // Find next queued job (not scheduled)
    const nextJob = this.queue.find((j) => j.status === 'queued');
    if (!nextJob) return;

    this.isProcessing = true;
    this.currentJob = nextJob;

    // Remove from queue
    const index = this.queue.indexOf(nextJob);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }

    try {
      await this.processJob(nextJob);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.handleJobError(nextJob, errorMessage);
    }

    this.currentJob = null;
    this.isProcessing = false;
    this.notifySubscribers();

    // Process next
    this.processNextInQueue();
  }

  private async processJob(job: ExportJob): Promise<void> {
    job.status = 'exporting';
    job.startedAt = new Date();
    this.notifySubscribers();

    // Export video
    const result = await videoExportService.exportVideo(
      job.config,
      (progress) => {
        job.exportProgress = progress;
        job.onProgress?.(job);
        this.notifySubscribers();
      },
      this.frameRenderCallback
    );

    job.result = result;

    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }

    // Upload to Google Drive if configured
    if (job.uploadToDrive && job.driveConfig && result.blob) {
      job.status = 'uploading';
      this.notifySubscribers();

      const uploadResult = await googleDriveExportService.uploadVideo(
        result,
        {
          userId: job.driveConfig.userId,
          projectId: job.driveConfig.projectId,
          projectName: job.driveConfig.projectName,
          folderId: job.driveConfig.folderId,
          createFolder: !job.driveConfig.folderId && !!job.driveConfig.projectName,
        },
        (progress) => {
          job.uploadProgress = progress;
          job.onProgress?.(job);
          this.notifySubscribers();
        }
      );

      if (uploadResult.success) {
        job.driveResult = {
          fileId: uploadResult.fileId!,
          webViewLink: uploadResult.webViewLink!,
        };
      }
    }

    // Success
    job.status = 'complete';
    job.completedAt = new Date();
    job.onComplete?.(job);
    this.totalExported++;
    this.moveToHistory(job);
    this.notifySubscribers();
  }

  private handleJobError(job: ExportJob, error: string): void {
    job.error = error;
    job.retryCount++;

    if (job.retryCount < job.maxRetries) {
      // Retry with delay
      job.status = 'queued';
      this.queue.unshift(job);
      this.sortQueue();
      job.onError?.(job, `Retry ${job.retryCount}/${job.maxRetries}: ${error}`);
    } else {
      // Max retries reached
      job.status = 'failed';
      job.completedAt = new Date();
      this.totalFailed++;
      this.moveToHistory(job);
      job.onError?.(job, error);
    }

    this.notifySubscribers();
  }

  private moveToHistory(job: ExportJob): void {
    // Keep last 50 jobs in history
    this.history.unshift(job);
    if (this.history.length > 50) {
      this.history.pop();
    }
    // Persist to database
    this.updateJobInDb(job);
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  getJob(jobId: string): ExportJob | undefined {
    if (this.currentJob?.id === jobId) return this.currentJob;
    return this.queue.find((j) => j.id === jobId) || this.history.find((j) => j.id === jobId);
  }

  getQueuedJobs(): ExportJob[] {
    return this.queue.filter((j) => j.status === 'queued');
  }

  getScheduledJobs(): ExportJob[] {
    return this.queue.filter((j) => j.status === 'scheduled');
  }

  getEstimatedWaitTime(jobId: string): number {
    const job = this.queue.find((j) => j.id === jobId);
    if (!job || job.status === 'scheduled') return 0;

    let totalTime = 0;
    for (const queuedJob of this.queue) {
      if (queuedJob.id === jobId) break;
      if (queuedJob.status !== 'queued') continue;
      // Estimate based on duration and resolution
      const frames = queuedJob.config.fps * queuedJob.config.duration;
      const msPerFrame = 50; // Rough estimate
      totalTime += frames * msPerFrame;
    }

    // Add current job time
    if (this.currentJob) {
      const progress = this.currentJob.exportProgress?.percentage || 0;
      const remainingPercent = 100 - progress;
      const frames = this.currentJob.config.fps * this.currentJob.config.duration;
      const msPerFrame = 50;
      totalTime += (frames * msPerFrame * remainingPercent) / 100;
    }

    return totalTime / 1000; // Return in seconds
  }

  formatWaitTime(seconds: number): string {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
  }

  // -------------------------------------------------------------------------
  // Persistence - Database Operations
  // -------------------------------------------------------------------------

  /**
   * Convert internal job to database format
   */
  private jobToDbFormat(job: ExportJob): Omit<ExportJobDB, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
    return {
      name: job.name,
      presetId: job.preset?.id || 'custom',
      config: {
        format: job.config.format,
        width: job.config.width,
        height: job.config.height,
        fps: job.config.fps,
        bitrate: job.config.bitrate,
        duration: job.config.duration,
        quality: job.config.quality,
      },
      status: job.status,
      priority: job.priority,
      scheduledTime: job.scheduledTime?.toISOString(),
      delaySeconds: job.delaySeconds,
      progress: job.exportProgress?.percentage || 0,
      currentFrame: job.exportProgress?.currentFrame,
      totalFrames: job.exportProgress?.totalFrames,
      outputUrl: job.result?.blob ? URL.createObjectURL(job.result.blob) : undefined,
      outputFormat: job.config.format,
      fileSize: job.result?.fileSize,
      renderTime: job.result?.duration ? job.result.duration / 1000 : undefined,
      uploadToDrive: job.uploadToDrive,
      driveFileId: job.driveResult?.fileId,
      driveWebViewLink: job.driveResult?.webViewLink,
      driveFolderId: job.driveConfig?.folderId,
      errorMessage: job.error,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  /**
   * Save job to database
   */
  private async saveJobToDb(job: ExportJob): Promise<void> {
    try {
      const dbData = this.jobToDbFormat(job);
      await exportJobsApi.create(dbData);
    } catch (e) {
      log.warn('Failed to save job to database: ', e);
    }
  }

  /**
   * Update job in database
   */
  private async updateJobInDb(job: ExportJob): Promise<void> {
    try {
      await exportJobsApi.update(job.id, {
        status: job.status,
        progress: job.exportProgress?.percentage || 0,
        currentFrame: job.exportProgress?.currentFrame,
        errorMessage: job.error,
        outputUrl: job.result?.blob ? URL.createObjectURL(job.result.blob) : undefined,
        fileSize: job.result?.fileSize,
        driveFileId: job.driveResult?.fileId,
        driveWebViewLink: job.driveResult?.webViewLink,
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      });
    } catch (e) {
      log.warn('Failed to update job in database:', e);
    }
  }

  /**
   * Load history from database
   */
  async loadHistoryFromDb(): Promise<void> {
    try {
      const dbJobs = await exportJobsApi.getHistory(50);
      // Merge with in-memory history
      for (const dbJob of dbJobs) {
        if (!this.history.find((j) => j.id === dbJob.id)) {
          this.history.push(this.dbToJob(dbJob));
        }
      }
      this.notifySubscribers();
    } catch (e) {
      log.warn('Failed to load history from database:', e);
    }
  }

  /**
   * Load scheduled jobs from database
   */
  async loadScheduledFromDb(): Promise<void> {
    try {
      const dbJobs = await exportJobsApi.getQueue();
      for (const dbJob of dbJobs) {
        if (!this.queue.find((j) => j.id === dbJob.id) && dbJob.status === 'scheduled') {
          const job = this.dbToJob(dbJob);
          if (job.scheduledTime && job.scheduledTime > new Date()) {
            this.queue.push(job);
            this.setupScheduledTimer(job);
          }
        }
      }
      this.notifySubscribers();
    } catch (e) {
      log.warn('Failed to load scheduled jobs from database:', e);
    }
  }

  /**
   * Convert database format to internal job
   */
  private dbToJob(dbJob: ExportJobDB): ExportJob {
    const preset = EXPORT_PRESETS.find((p) => p.id === dbJob.presetId);
    return {
      id: dbJob.id,
      name: dbJob.name,
      config: {
        format: dbJob.config.format as 'webm' | 'mp4',
        width: dbJob.config.width,
        height: dbJob.config.height,
        fps: dbJob.config.fps,
        bitrate: dbJob.config.bitrate,
        duration: dbJob.config.duration,
        quality: normalizeExportQuality(dbJob.config.quality),
      },
      preset,
      status: dbJob.status as ExportJobStatus,
      priority: dbJob.priority as ExportJobPriority,
      createdAt: new Date(dbJob.createdAt),
      startedAt: dbJob.startedAt ? new Date(dbJob.startedAt) : undefined,
      completedAt: dbJob.completedAt ? new Date(dbJob.completedAt) : undefined,
      scheduledTime: dbJob.scheduledTime ? new Date(dbJob.scheduledTime) : undefined,
      delaySeconds: dbJob.delaySeconds || undefined,
      exportProgress: dbJob.progress ? {
        percentage: dbJob.progress,
        currentFrame: dbJob.currentFrame || 0,
        totalFrames: dbJob.totalFrames || 0,
        elapsedTime: 0,
        estimatedTimeRemaining: 0,
        status: dbJob.status === 'complete' ? 'complete' : 'encoding',
      } : undefined,
      error: dbJob.errorMessage || undefined,
      retryCount: dbJob.retryCount,
      maxRetries: dbJob.maxRetries,
      uploadToDrive: dbJob.uploadToDrive,
      driveConfig: dbJob.driveFolderId ? {
        userId: ', ',
        folderId: dbJob.driveFolderId,
      } : undefined,
      driveResult: dbJob.driveFileId ? {
        fileId: dbJob.driveFileId,
        webViewLink: dbJob.driveWebViewLink || ', ',
      } : undefined,
    };
  }

  /**
   * Setup timer for scheduled job
   */
  private setupScheduledTimer(job: ExportJob): void {
    if (!job.scheduledTime) return;
    const delay = job.scheduledTime.getTime() - Date.now();
    if (delay <= 0) {
      this.startJob(job.id);
    } else {
      const timer = setTimeout(() => {
        this.startJob(job.id);
      }, delay);
      this.scheduledTimers.set(job.id, timer);
    }
  }

  startJob(jobId: string): boolean {
    const job = this.queue.find((candidate) => candidate.id === jobId);
    if (!job) {
      return false;
    }

    const timer = this.scheduledTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.scheduledTimers.delete(jobId);
    }

    job.status = 'queued';
    job.scheduledTime = undefined;
    this.sortQueue();
    this.notifySubscribers();
    void this.updateJobInDb(job);
    void this.processNextInQueue();
    return true;
  }

  exportHistory(): string {
    return JSON.stringify(this.history, null, 2);
  }

  clearHistory(): void {
    this.history = [];
    this.notifySubscribers();
  }

  /**
   * Initialize - load from database
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.loadHistoryFromDb(),
      this.loadScheduledFromDb(),
    ]);
  }
}

// Export singleton
export const exportScheduler = new ExportSchedulerService();

// Initialize from database
if (typeof window !=='undefined') {
  exportScheduler.initialize();
}

export default exportScheduler;
