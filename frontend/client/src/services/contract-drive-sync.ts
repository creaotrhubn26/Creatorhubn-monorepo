/**
 * Contract Drive Sync Service
 * Handles automatic upload of contracts to Google Drive with retry logic
 * Supports year and month-based folder organization and retention policies
 */

import { contractArchiveConfig } from './document-archive-config';

export type SyncStatus = 'idle' | 'pending' | 'uploading' | 'success' | 'error';

export interface SyncJob {
  id: string;
  file: File;
  clientName?: string; // Client name for filename
  projectId: string;
  folderName: string;
  contractDate?: Date; // Date of contract for year-based organization
  contractStatus?: string; // Status for folder organization (draft/signed/expired)
  isSigned?: boolean; // Mark if contract is signed (final)
  status: SyncStatus;
  progress: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  webViewLink?: string;
  webContentLink?: string;
  fileId?: string;
}

class ContractDriveSyncService {
  private jobs: Map<string, SyncJob> = new Map();
  private listeners: Set<(jobs: SyncJob[]) => void> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Add a file to the upload queue
   * @param file File to upload
   * @param projectId Project ID
   * @param folderName Base folder name (will be organized by year if enabled)
   * @param contractDate Date of contract for year-based organization
   * @param contractStatus Contract status for folder organization
   * @param clientName Client name for filename
   * @param isSigned Whether contract is signed (adds SIGNERT suffix)
   */
  queueUpload(
    file: File,
    projectId: string,
    folderName?: string,
    contractDate?: Date,
    contractStatus?: string,
    clientName?: string,
    isSigned?: boolean,
  ): string {
    const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get archive config and determine folder path
    const config = contractArchiveConfig.getConfig();
    const date = contractDate || new Date();

    // Use configured folder path with year-based organization
    const targetFolder =
      config.enabled && config.retentionPolicy.yearBasedFolders
        ? contractArchiveConfig.getFolderPath(date, contractStatus)
        : folderName || config.baseFolderName;

    const job: SyncJob = {
      id: jobId,
      file,
      clientName,
      projectId,
      folderName: targetFolder,
      contractDate: date,
      contractStatus,
      isSigned,
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
      // Generate filename with client name if provided
      let fileName = job.file.name;
      if (job.clientName) {
        const sanitizedClientName = job.clientName
          .replace(/[^a-zA-Z0-9æøåÆØÅ\s]/g, '')
          .replace(/\s+/g, '_');
        const signedSuffix = job.isSigned ? '_SIGNERT' : ',';
        const fileExtension = job.file.name.split('.').pop();
        const contractNumber = job.file.name.replace(/\.[^/.]+$/, ', '); // Remove extension
        fileName = `${sanitizedClientName}_${contractNumber}${signedSuffix}.${fileExtension}`;
      }

      const formData = new FormData();
      formData.append('file', new File([job.file], fileName, { type: job.file.type }));
      formData.append('projectId', job.projectId);
      formData.append('folderName', job.folderName);
      if (job.clientName) {
        formData.append('clientName', job.clientName);
      }
      if (job.contractDate) {
        formData.append('contractDate', job.contractDate.toISOString());
      }
      if (job.contractStatus) {
        formData.append('contractStatus', job.contractStatus);
      }
      if (job.isSigned !== undefined) {
        formData.append('isSigned', String(job.isSigned));
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

      xhr.open('POST', '/api/google/drive/upload-contract');
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
        `⏳ Retrying upload ${jobId} in ${backoffMs}ms (attempt ${job.retryCount + 1}/${job.maxRetries})`,
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
      console.error(`❌ Upload failed after ${job.maxRetries} retries:`, job.error);
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
  getJobs(): SyncJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a specific job
   */
  getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Subscribe to job updates
   */
  subscribe(listener: (jobs: SyncJob[]) => void): () => void {
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
export const contractDriveSync = new ContractDriveSyncService();
