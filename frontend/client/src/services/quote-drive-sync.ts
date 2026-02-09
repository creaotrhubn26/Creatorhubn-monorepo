/**
 * Quote Drive Sync Service
 * Handles automatic upload of quotes to Google Drive with retry logic
 * Supports year-based folder organization and retention policies
 */

import { quoteArchiveConfig } from './document-archive-config';

export type SyncStatus = 'idle' | 'pending' | 'uploading' | 'success' | 'error';

export interface QuoteSyncJob {
  id: string;
  quoteId: string;
  quoteNumber: string;
  clientName: string;
  quotePdfUrl?: string;
  projectId?: string;
  folderName: string;
  quoteDate?: Date;
  quoteStatus?: string;
  isFinal?: boolean; // Mark if this is the final version
  status: SyncStatus;
  progress: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  webViewLink?: string;
  webContentLink?: string;
  fileId?: string;
}

class QuoteDriveSyncService {
  private jobs: Map<string, QuoteSyncJob> = new Map();
  private listeners: Set<(jobs: QuoteSyncJob[]) => void> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Add a quote to the upload queue
   * @param quoteId Quote ID
   * @param quoteNumber Quote number
   * @param clientName Client name for filename
   * @param quotePdfUrl URL to quote PDF
   * @param projectId Project ID
   * @param folderName Base folder name (will be organized by year if enabled)
   * @param quoteDate Date of quote for year-based organization
   * @param quoteStatus Quote status for folder organization
   * @param isFinal Mark if this is the final version
   */
  queueUpload(
    quoteId: string,
    quoteNumber: string,
    clientName: string,
    quotePdfUrl?: string,
    projectId?: string,
    folderName?: string,
    quoteDate?: Date,
    quoteStatus?: string,
    isFinal?: boolean,
  ): string {
    const jobId = `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get archive config and determine folder path
    const config = quoteArchiveConfig.getConfig();
    const date = quoteDate || new Date();

    // Use configured folder path with year-based organization
    const targetFolder =
      config.enabled && config.retentionPolicy.yearBasedFolders
        ? quoteArchiveConfig.getFolderPath(date, quoteStatus)
        : folderName || config.baseFolderName;

    const job: QuoteSyncJob = {
      id: jobId,
      quoteId,
      quoteNumber,
      clientName,
      quotePdfUrl,
      projectId,
      folderName: targetFolder,
      quoteDate: date,
      quoteStatus,
      isFinal,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
    };

    this.jobs.set(jobId, job);
    this.notifyListeners();

    // Start upload immediately
    this.startUpload(jobId);

    return jobId;
  }

  /**
   * Start uploading a job
   */
  private async startUpload(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'uploading';
    job.progress = 10;
    this.notifyListeners();

    try {
      // If we have a PDF URL, download and upload it
      let fileBlob: Blob | null = null;

      if (job.quotePdfUrl) {
        const response = await fetch(job.quotePdfUrl);
        fileBlob = await response.blob();
      }

      // Generate filename with client name
      const sanitizedClientName = job.clientName
        .replace(/[^a-zA-Z0-9æøåÆØÅ\s]/g, '')
        .replace(/\s+/g, '_');
      const finalSuffix = job.isFinal ? '_GODKJENT' : '';
      const filename = `${sanitizedClientName}_${job.quoteNumber}${finalSuffix}.pdf`;

      const formData = new FormData();
      if (fileBlob) {
        formData.append('file', fileBlob, filename);
      }
      formData.append('quoteId', job.quoteId);
      formData.append('quoteNumber', job.quoteNumber);
      formData.append('clientName', job.clientName);
      formData.append('filename', filename);
      if (job.projectId) {
        formData.append('projectId', job.projectId);
      }
      formData.append('folderName', job.folderName);
      if (job.quoteDate) {
        formData.append('quoteDate', job.quoteDate.toISOString());
      }
      if (job.quoteStatus) {
        formData.append('quoteStatus', job.quoteStatus);
      }
      if (job.isFinal !== undefined) {
        formData.append('isFinal', String(job.isFinal));
      }

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          job.progress = Math.round((e.loaded / e.total) * 90) + 10; // 10-100%
          this.notifyListeners();
        }
      });

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
      });

      xhr.open('POST', '/api/google-drive/upload-quote');
      xhr.send(formData);

      const response = await uploadPromise;

      if (response.success) {
        job.status = 'success';
        job.progress = 100;
        job.webViewLink = response.webViewLink;
        job.webContentLink = response.webContentLink;
        job.fileId = response.fileId;
        this.notifyListeners();

        // Auto-remove successful jobs after 5 seconds
        setTimeout(() => {
          this.removeJob(jobId);
        }, 5000);
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      await this.handleUploadError(jobId, error);
    }
  }

  /**
   * Handle upload error with retry logic
   */
  private async handleUploadError(jobId: string, error: unknown) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.retryCount++;
    job.error = error instanceof Error ? error.message : 'Upload failed';

    if (job.retryCount < job.maxRetries) {
      // Exponential backoff: 2^retryCount seconds
      const backoffMs = Math.pow(2, job.retryCount) * 1000;

      job.status = 'pending';
      job.progress = 0;
      this.notifyListeners();

      console.log(
        `⏳ Retrying quote upload ${jobId} in ${backoffMs}ms (attempt ${job.retryCount + 1}/${job.maxRetries})`,
      );

      const timeout = setTimeout(() => {
        this.retryTimeouts.delete(jobId);
        this.startUpload(jobId);
      }, backoffMs);

      this.retryTimeouts.set(jobId, timeout);
    } else {
      job.status = 'error';
      job.progress = 0;
      this.notifyListeners();
      console.error(`❌ Quote upload failed after ${job.maxRetries} retries:`, job.error);
    }
  }

  /**
   * Retry a failed job manually
   */
  retryJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.retryCount = 0;
    job.status = 'pending';
    job.progress = 0;
    job.error = undefined;
    this.notifyListeners();

    this.startUpload(jobId);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string) {
    const timeout = this.retryTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(jobId);
    }
    this.removeJob(jobId);
  }

  /**
   * Remove a job from the queue
   */
  private removeJob(jobId: string) {
    this.jobs.delete(jobId);
    this.notifyListeners();
  }

  /**
   * Get all jobs
   */
  getJobs(): QuoteSyncJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a specific job
   */
  getJob(jobId: string): QuoteSyncJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Subscribe to job updates
   */
  subscribe(listener: (jobs: QuoteSyncJob[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getJobs()); // Send initial state

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    const jobs = this.getJobs();
    this.listeners.forEach((listener) => listener(jobs));
  }

  /**
   * Clear all completed and failed jobs
   */
  clearCompleted() {
    const toRemove: string[] = [];
    this.jobs.forEach((job, id) => {
      if (job.status === 'success' || job.status ==='error') {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => this.removeJob(id));
  }
}

// Export singleton instance
export const quoteDriveSync = new QuoteDriveSyncService();
