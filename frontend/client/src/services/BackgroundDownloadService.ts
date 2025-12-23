/**
 * Background Download Service
 * Håndterer nedlasting av filer i bakgrunnen med progress tracking,
 * retry-logikk og persistent lagring på samme måte som upload-systemet
 */

export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  totalSize?: number;
  downloadedSize: number;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled';
  error?: string;
  retryCount: number;
  maxRetries: number;
  startTime: number;
  endTime?: number;
  estimatedTimeRemaining?: number;
  downloadSpeed?: number; // bytes per second
  profession?: string;
  category?: string; 
}

export interface DownloadStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalDownloaded: number;
  averageSpeed: number;
}

class BackgroundDownloadService {
  private static instance: BackgroundDownloadService;
  private tasks: Map<string, DownloadTask> = new Map();
  private activeDownloads: Set<string> = new Set();
  private maxConcurrentDownloads = 3; // Independent of uploads
  private listeners: Map<string, (task: DownloadTask) => void> = new Map();
  private globalListeners: ((tasks: DownloadTask[]) => void)[] = [];
  private storageKey = 'creatorhub_background_downloads';

  static getInstance(): BackgroundDownloadService {
    if (!BackgroundDownloadService.instance) {
      BackgroundDownloadService.instance = new BackgroundDownloadService();
    }
    return BackgroundDownloadService.instance;
  }

  constructor() {
    this.loadFromStorage();
    this.resumePendingDownloads();

    // Cleanup completed downloads after 24 hours
    setInterval(() => this.cleanupOldTasks(), 60 * 60 * 1000);
}

  // Start download med samme interface som upload
  async startDownload(
    url: string,
    filename: string,
    options: {
      maxRetries?: number;
      profession?: string;
      category?: string;
      headers?: Record<string, string>;
  } = {},
  ): Promise<string> {
    const taskId = this.generateId();

    const task: DownloadTask = {
      id: taskd,
      url,
      filename,
      downloadedSize:  0,
      progress:  0,
      status: 'pending',
      retryCount:  0,
      maxRetries: options.maxRetries || 3,
      startTime: Date.now(),
      profession: options.profession,
      category: options.category,
  };

    this.tasks.set(taskId, task);
    this.saveToStorage();
    this.notifyListeners();

    // Start download if we have capacity
    this.processDownloadQueue();

    return taskId;
}

  // Process download queue with automatic continuation
  private async processDownloadQueue(): Promise<void> {
    // Process all pending downloads up to concurrent limit
    while (this.activeDownloads.size < this.maxConcurrentDownloads) {
      const pendingTask = Array.from(this.tasks.values())
        .filter((task) => task.status === 'pending')
        .sort((a, b) => a.startTime - b.startTime)[0];

      if (!pendingTask) {
        break; // No more pending tasks
    }

      this.executeDownload(pendingTask.id);
  }
}

  // Execute actual download
  private async executeDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeDownloads.add(taskId);
    task.status = 'downloading';
    task.startTime = Date.now();

    this.updateTask(task);

    try {
      // Use fetch with progress tracking
      const response = await fetch(task.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

      const totalSize = parseInt(response.headers.get('content-length') || '0');
      task.totalSize = totalSize;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response body');
    }

      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloadedSize += value.length;

        const now = Date.now();
        if (now - lastUpdateTime > 100) {
          // Update every 100ms
          task.downloadedSize = downloadedSize;
          task.progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;

          // Calculate download speed
          const timeElapsed = (now - task.startTime) / 1000;
          task.downloadSpeed = downloadedSize / timeElapsed;

          // Estimate time remaining
          if (totalSize > 0 && task.downloadSpeed > 0) {
            const remainingBytes = totalSize - downloadedSize;
            task.estimatedTimeRemaining = remainingBytes / task.downloadSpeed;
        }

          this.updateTask(task);
          lastUpdateTime = now;
      }

        // Check if paused or cancelled
        if (task.status === 'paused' || task.status === 'cancelled') {
          reader.cancel();
          break;
      }
    }

      if (task.status === 'downloading') {
        // Create blob and trigger download
        const blob = new Blob(chunks);
        const downloadUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = task.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(downloadUrl);

        task.status = 'completed';
        task.endTime = Date.now();
        task.progress = 100;
        this.updateTask(task);
    }
  } catch (error) {
      console.error(`Download failed for ${taskId}:`, error);

      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.status = 'pending';
        task.error = `Attempt ${task.retryCount}: ${error.message}`;

        // Exponential backoff
        setTimeout(
          () => {
            this.processDownloadQueue();
        },
          Math.pow(2, task.retryCount) * 1000,
        );
    } else {
        task.status = 'failed';
        task.error = error.message;
        task.endTime = Date.now();
    }

      this.updateTask(task);
  } finally {
      this.activeDownloads.delete(taskId);

      // Immediately start next download if available
      setTimeout(() => this.processDownloadQueue(), 0);
  }
}

  // Control methods (same as upload service)
  pauseDownload(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'downloading') {
      task.status = 'paused';
      this.updateTask(task);
    }
  }

  resumeDownload(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'paused') {
      task.status = 'pending';
      this.updateTask(task);
      setTimeout(() => this.processDownloadQueue(), 0);
    }
  }

  cancelDownload(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'cancelled';
      task.endTime = Date.now();
      this.activeDownloads.delete(taskId);
      this.updateTask(task);
      setTimeout(() => this.processDownloadQueue(), 0);
    }
  }

  retryDownload(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'failed') {
      task.status = 'pending';
      task.retryCount = 0;
      task.error = undefined;
      this.updateTask(task);
      this.processDownloadQueue();
    }
  }

  // Get download statistics
  getStats(): DownloadStats {
    const tasks = Array.from(this.tasks.values());
    const activeTasks = tasks.filter((t) =>
      ['pending','downloading', 'paused'].includes(t.status),
    );
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const failedTasks = tasks.filter((t) => t.status === 'failed');

    const totalDownloaded = tasks.reduce((sum, task) => sum + task.downloadedSize, 0);
    const avgSpeed =
      activeTasks.reduce((sum, task) => sum + (task.downloadSpeed || 0), 0) /
      Math.max(activeTasks.length, 1);

    return {
      totalTasks: tasks.length,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      totalDownloaded,
      averageSpeed: avgSpeed,
  };
}

  // Listener management (same pattern as upload)
  addTaskListener(taskId: string, callback: (task: DownloadTask) => void): () => void {
    this.listeners.set(taskd, callback);
    return () => this.listeners.delete(taskId);
}

  addGlobalListener(callback: (tasks: DownloadTask[]) => void): () => void {
    this.globalListeners.push(callback);
    return () => {
      const index = this.globalListeners.indexOf(callback);
      if (index > -1) this.globalListeners.splice(index, 1);
  };
}

  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startTime - a.startTime);
  }

  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  clearCompleted(): void {
    const toRemove = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed')
      .map(([id, _]) => id);

    toRemove.forEach((id) => this.tasks.delete(id));
    this.saveToStorage();
    this.notifyListeners();
  }

  // Private helper methods
  private updateTask(task: DownloadTask): void {
    this.tasks.set(task.id, { ...task });
    this.saveToStorage();
    this.notifyListeners(task);
  }

  private notifyListeners(task?: DownloadTask): void {
    if (task) {
      const listener = this.listeners.get(task.id);
      if (listener) listener(task);
  }

    this.globalListeners.forEach((callback) => callback(this.getAllTasks()));
}

  private generateId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

  private saveToStorage(): void {
    try {
      const data = {
        tasks: Array.from(this.tasks.entries()),
        timestamp: Date.now(),
      };
      fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'background_downloads', value: data })
      }).catch(() => {});
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save download tasks to storage: ', error);
    }
  }

  private loadFromStorage(): void {
    const applyLocal = () => {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          this.tasks = new Map(data.tasks || []);
          this.tasks.forEach((task) => { if (task.status === 'downloading') { task.status = 'pending'; } });
        }
      } catch (error) {
        console.warn('Failed to load download tasks from storage:', error);
        this.tasks = new Map();
      }
    };

    fetch('/api/user/kv/background_downloads', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.tasks) {
          this.tasks = new Map(j.data.tasks || []);
          this.tasks.forEach((task) => { if (task.status === 'downloading') { task.status = 'pending'; } });
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }

  private resumePendingDownloads(): void {
    setTimeout(() => this.processDownloadQueue(), 1000);
}

  private cleanupOldTasks(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    let cleaned = false;

    this.tasks.forEach((task, id) => {
      if (task.status ==='completed' && (task.endTime || 0) < oneDayAgo) {
        this.tasks.delete(id);
        cleaned = true;
    }
  });

    if (cleaned) {
      this.saveToStorage();
      this.notifyListeners();
  }
}
}

export const backgroundDownloadService = BackgroundDownloadService.getInstance();
