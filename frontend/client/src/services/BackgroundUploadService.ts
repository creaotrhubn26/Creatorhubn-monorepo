// @ts-nocheck
/**
 * Background Upload Service
 * Håndterer file uploads i bakgrunnen med persistent progress tracking
 */

import { EventEmitter } from 'events';
import { apiRequest } from '@/lib/queryClient';

export interface UploadTask {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'failed' | 'paused' | 'retrying';
  error?: string;
  result?: any;
  endpoint: string;
  metadata?: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  startTime?: number;
  completedTime?: number;
  uploadSpeed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
}

export interface UploadStats {
  totalTasks: number;
  completed: number;
  failed: number;
  uploading: number;
  queued: number;
  totalBytes: number;
  uploadedBytes: number;
  overallProgress: number; 
}

class BackgroundUploadService extends EventEmitter {
  private tasks: Map<string, UploadTask> = new Map();
  private activeUploads: Set<string> = new Set();
  private maxConcurrentUploads = 3; // Independent of downloads
  private isRunning = false;

  constructor() {
    super();
    this.loadPersistedTasks();
    this.startProcessing();
  }

  // Add files to upload queue
  addFiles(
    files: File[],
    endpoint: string,
    metadata: Record<string, any> = {},
    maxRetries: number = 3
  ): string[] {
    const taskIds: string[] = [];

    files.forEach((file) => {
      const taskId = this.generateTaskId();
      const task: UploadTask = {
        id: taskd,
        file,
        fileName: file.name,
        fileSize: file.size,
        progress:  0,
        status: 'queued',
        endpoint,
        metadata,
        retryCount:  0,
        maxRetries,
    };

      this.tasks.set(taskId, task);
      taskIds.push(taskId);
  });

    this.persistTasks();
    this.emit('tasksAdded', taskIds);
    this.processQueue();

    return taskIds;
}

  // Get all tasks
  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
}

  // Get task by ID
  getTask(taskId: string): UploadTask | undefined {
    return this.tasks.get(taskId);
  }

  // Get upload statistics
  getStats(): UploadStats {
    const tasks = this.getAllTasks();
    const stats: UploadStats = {
      totalTasks: tasks.length,
      completed:  0,
      failed:  0,
      uploading:  0,
      queued:  0,
      totalBytes:  0,
      uploadedBytes:  0,
      overallProgress:  0,
  };

    tasks.forEach((task) => {
      stats.totalBytes += task.fileSize;
      stats.uploadedBytes += (task.fileSize * task.progress) / 100;

      switch (task.status) {
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'uploading':
        case 'retrying':
          stats.uploading++;
          break;
        case 'queued':
        case 'paused':
          stats.queued++;
          break;
    }
  });

    stats.overallProgress =
      stats.totalBytes > 0 ? Math.round((stats.uploadedBytes / stats.totalBytes) * 100) : 0;

    return stats;
}

  // Retry failed upload
  retryTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && (task.status === 'failed' || task.status === 'paused')) {
      task.status = 'queued';
      task.error = undefined;
      task.progress = 0;
      this.persistTasks();
      this.emit('taskRetried', taskId);
      this.processQueue();
  }
}

  // Pause upload
  pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'uploading') {
      task.status = 'paused';
      this.activeUploads.delete(taskId);
      this.persistTasks();
      this.emit('taskPaused', taskId);
  }
}

  // Resume upload
  resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'paused') {
      task.status = 'queued';
      this.persistTasks();
      this.emit('taskResumed', taskId);
      this.processQueue();
  }
}

  // Cancel upload
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      this.activeUploads.delete(taskId);
      this.tasks.delete(taskId);
      this.persistTasks();
      this.emit('taskCancelled', taskId);
  }
}

  // Clear completed tasks
  clearCompleted(): void {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed')
      .map(([id, _]) => id);

    completedTasks.forEach((id) => this.tasks.delete(id));
    this.persistTasks();
    this.emit('completedTasksCleared', completedTasks);
}

  // Process upload queue with automatic continuation
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    // Process all queued uploads up to concurrent limit
    while (this.activeUploads.size < this.maxConcurrentUploads) {
      const nextTask = Array.from(this.tasks.values())
        .filter((task) => task.status === 'queued')
        .sort((a, b) => a.fileSize - b.fileSize)[0]; // Små filer først

      if (!nextTask) {
        break; // No more queued tasks
    }

      this.uploadTask(nextTask);
  }
}

  // Upload single task
  private async uploadTask(task: UploadTask): Promise<void> {
    this.activeUploads.add(task.id);
    task.status = 'uploading';
    task.startTime = Date.now();
    this.persistTasks();
    this.emit('taskStarted', task.id);

    try {
      const formData = new FormData();
      formData.append('file', task.file);

      if (task.metadata) {
        Object.entries(task.metadata).forEach(([key, value]) => {
          formData.append(key, JSON.stringify(value));
      });
    }

      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          task.progress = progress;

          // Calculate upload speed
          if (task.startTime) {
            const elapsed = (Date.now() - task.startTime) / 1000;
            task.uploadSpeed = event.loaded / elapsed;

            if (progress > 0) {
              const remaining = (event.total - event.loaded) / task.uploadSpeed;
              task.estimatedTimeRemaining = remaining;
          }
        }

          this.persistTasks();
          this.emit('taskProgress', task.id, progress);
      }
    });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          task.status = 'completed';
          task.progress = 100;
          task.completedTime = Date.now();

          try {
            task.result = JSON.parse(xhr.responseText);
        } catch {
            task.result = xhr.responseText;
        }

          this.activeUploads.delete(task.id);
          this.persistTasks();
          this.emit('taskCompleted', task.id, task.result);

          // Immediately process next upload in queue
          setTimeout(() => this.processQueue(), 0);
      } else {
          this.handleUploadError(task, `HTTP ${xhr.status}: ${xhr.statusText}`);
      }
    });

      // Handle errors
      xhr.addEventListener('error', () => {
        this.handleUploadError(task, 'Network error occurred');
    });

      xhr.addEventListener('timeout', () => {
        this.handleUploadError(task, 'Upload timeout');
    });

      // Start upload
      xhr.open('POST', task.endpoint);
      xhr.timeout = 300000; // 5 minutes timeout
      xhr.send(formData);
  } catch (error: any) {
      this.handleUploadError(task, error.message);
  }
}

  // Handle upload errors with retry logic
  private handleUploadError(task: UploadTask, error: string): void {
    task.error = error;
    task.retryCount++;
    this.activeUploads.delete(task.id);

    if (task.retryCount <= task.maxRetries) {
      task.status = 'retrying';
      this.persistTasks();
      this.emit('taskRetrying', task.id, task.retryCount);

      // Exponential backoff retry
      const delay = Math.min(1000 * Math.pow(2, task.retryCount - 1), 30000);
      setTimeout(() => {
        if (this.tasks.has(task.id)) {
          task.status = 'queued';
          this.processQueue();
      }
    }, delay);
  } else {
      task.status = 'failed';
      this.persistTasks();
      this.emit('taskFailed', task.id, error);

      // Continue with next upload
      setTimeout(() => this.processQueue(), 0);
  }
}

  // Start processing service
  private startProcessing(): void {
    this.isRunning = true;
    this.processQueue();
}

  // Stop processing service
  stopProcessing(): void {
    this.isRunning = false;
    this.activeUploads.clear();
}

  // Generate unique task ID
  private generateTaskId(): string {
    return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

  // Persist tasks to localStorage
  private persistTasks(): void {
    try {
      const tasksData = Array.from(this.tasks.entries()).map(([id, task]) => [
        id,
        {
          ...task,
          file: task.file ? {
            name: task.file.name,
            size: task.file.size,
            type: task.file.type,
            lastModified: task.file.lastModified,
          } : undefined,
        },
      ]);
      apiRequest('/api/user/kv', {
        method: 'POST',
        body: JSON.stringify({ key: 'background_uploads', value: tasksData }),
      }).catch(() => {});
      localStorage.setItem('backgroundUploads', JSON.stringify(tasksData));
    } catch (error) {
      console.warn('Failed to persist upload tasks: ', error);
    }
  }

  // Load persisted tasks from localStorage
  private loadPersistedTasks(): void {
    const applyLocal = () => {
      try {
        const data = localStorage.getItem('backgroundUploads');
        if (data) {
          const tasksData = JSON.parse(data);
          tasksData.forEach(([id, taskData]: [string, any]) => {
            if (taskData.status !== 'uploading') {
              if (taskData.file && typeof taskData.file === 'object') {
                taskData.status = 'paused';
              }
              this.tasks.set(id, taskData);
            }
          });
        }
      } catch (error) {
        console.warn('Failed to load persisted upload tasks:', error);
      }
    };

    apiRequest('/api/user/kv/background_uploads')
      .then((j) => {
        if (j?.data) {
          const tasksData = j.data;
          tasksData.forEach(([id, taskData]: [string, any]) => {
            if (taskData.status !== 'uploading') {
              if (taskData.file && typeof taskData.file === 'object') {
                taskData.status = 'paused';
              }
              this.tasks.set(id, taskData);
            }
          });
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }

  // Format time remaining
  formatTimeRemaining(seconds: number): string {
    if (!seconds || seconds === Infinity) return 'Ukjent';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}t ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

  // Format upload speed
  formatSpeed(bytesPerSecond: number): string {
    if (!bytesPerSecond) return '0 B/s';

      const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
  }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
}

// Export singleton instance
export const backgroundUploadService = new BackgroundUploadService();
export default backgroundUploadService;
