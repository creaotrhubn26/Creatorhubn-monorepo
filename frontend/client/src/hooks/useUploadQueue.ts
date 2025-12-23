// Advanced upload queue with rate limiting and batch processing
import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessingOptions } from '@shared/photo-enhancement-contracts';

type BatchProcessingOptions = ProcessingOptions;

interface QueuedUpload {
  id: string;
  file: File;
  hash?: string;
  priority: 'low' | 'normal' | 'high';
  status: 'queued' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  retryCount: number;
  maxRetries: number
}

interface UploadQueueOptions {
  maxConcurrentUploads: number;
  maxRetries: number;
  rateLimitDelay: number;
  chunkSize: number
}

export const useUploadQueue = (
  options: UploadQueueOptions = {
    maxConcurrentUploads: 3,
    maxRetries: 3,
    rateLimitDelay: 100,
    chunkSize: 5 * 1024 * 1024, // 5MB chunks
  }
) => {
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);

  const rateLimitRef = useRef<Map<string, number>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Generate unique ID for queued upload
  const generateId = useCallback(() => {
    return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Add files to queue
  const addToQueue = useCallback(
    (
      files: File[],
      _processingOptions: BatchProcessingOptions,
      priority: 'low' | 'normal' | 'high' = 'normal',
    ) => {
      const newUploads: QueuedUpload[] = files.map((file) => ({
        id: generateId(),
        file,
        priority,
        status: 'queued',
        progress: 0,
        retryCount: 0,
        maxRetries: options.maxRetries,
      }));

      setQueue((prev) => {
        // Sort by priority: high > normal > low
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const updated = [...prev, ...newUploads];

        return updated.sort((a, b) => {
          if (a.status === 'uploading' && b.status !== 'uploading') return -1;
          if (b.status === 'uploading' && a.status !== 'uploading') return 1;
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
      });

      return newUploads.map((upload) => upload.id);
    },
    [generateId, options.maxRetries],
  );

  // Remove from queue
  const removeFromQueue = useCallback((uploadId: string) => {
    // Cancel if actively uploading
    const controller = abortControllersRef.current.get(uploadId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(uploadId);
}

    setQueue((prev) => prev.filter((upload) => upload.id !== uploadId));
    setActiveUploads((prev) => {
      const updated = new Set(prev);
      updated.delete(uploadId);
      return updated;
  });
}, []);

  // Update upload progress
  const updateUploadProgress = useCallback((uploadId: string, progress: number) => {
    setQueue((prev) =>
      prev.map((upload) =>
        upload.id === uploadId ? { ...upload, progress: Math.min(progress, 100) } : upload,
      ),
    );
}, []);

  // Mark upload as completed
  const markUploadCompleted = useCallback((uploadId: string) => {
    setQueue((prev) =>
      prev.map((upload) =>
        upload.id === uploadId ? { ...upload, status: 'completed', progress: 100 } : upload,
      ),
    );

    setActiveUploads((prev) => {
      const updated = new Set(prev);
      updated.delete(uploadId);
      return updated;
    });
  }, []);

  // Mark upload as error and handle retry
  const markUploadError = useCallback((uploadId: string, error: string) => {
    setQueue((prev) =>
      prev.map((upload) => {
        if (upload.id !== uploadId) return upload;

        const newRetryCount = upload.retryCount + 1;
        const shouldRetry = newRetryCount <= upload.maxRetries;

        return {
          ...upload,
          status: shouldRetry ? 'queued' : 'error',
          error: shouldRetry ? undefined : error,
          retryCount: newRetryCount,
        };
      }),
    );

    setActiveUploads((prev) => {
      const updated = new Set(prev);
      updated.delete(uploadId);
      return updated;
    });
  }, []);

  // Check rate limiting
  const canUpload = useCallback(
    (_uploadId: string): boolean => {
      const lastUpload = rateLimitRef.current.get('global') || 0;
      const timeSinceLastUpload = Date.now() - lastUpload;
      return timeSinceLastUpload >= options.rateLimitDelay;
    },
    [options.rateLimitDelay],
  );

  // Process upload (simplified - actual implementation would handle chunks)
  const processUpload = useCallback(
    async (
      upload: QueuedUpload,
      processingOptions: BatchProcessingOptions,
      userId: string,
      projectId?: string,
    ): Promise<void> => {
      if (!canUpload(upload.id)) {
        // Delay and retry
        setTimeout(
          () => processUpload(upload, processingOptions, userId, projectId),
          options.rateLimitDelay,
        );
        return;
      }

      // Mark as actively uploading
      setActiveUploads((prev) => new Set(prev).add(upload.id));
      setQueue((prev) => prev.map((u) => (u.id === upload.id ? { ...u, status: 'uploading' } : u)));

      // Create abort controller
      const controller = new AbortController();
      abortControllersRef.current.set(upload.id, controller);

      try {
        // Update rate limiting
        rateLimitRef.current.set('global', Date.now());

        // Create FormData
        const formData = new FormData();
        formData.append('files', upload.file);
        formData.append('enhancementType', processingOptions.enhancementType);
        formData.append('options', JSON.stringify(processingOptions));
        formData.append('userId', userId);
        if (projectId) formData.append('projectId', projectId);

        // Upload with progress tracking
        const response = await fetch('/api/photo-enhancement/start', {
          method: 'POS',
          body: formData,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${localStorage.getItem(', ')}`,
        },
      });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

        await response.json();
        markUploadCompleted(upload.id);
    } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`Upload cancelled: ${upload.id}`);
          return;
        }

        console.error(`Upload failed: ${upload.id}`, error);
        markUploadError(upload.id, error.message);
    } finally {
        abortControllersRef.current.delete(upload.id);
    }
  },
    [canUpload, options.rateLimitDelay, markUploadCompleted, markUploadError],
  );

  // Process queue automatically
  useEffect(() => {
    if (isPaused) return;

    const queuedUploads = queue.filter((upload) => upload.status === 'queued');
    const availableSlots = options.maxConcurrentUploads - activeUploads.size;

    if (queuedUploads.length > 0 && availableSlots > 0) {
      const uploadsToStart = queuedUploads.slice(0, availableSlots);

      uploadsToStart.forEach((_upload) => {
        // This would normally be called with the actual processing options
        // processUpload(_upload, processingOptions, userId, projectId);
      });
    }
  }, [queue, activeUploads.size, isPaused, options.maxConcurrentUploads]);

  // Pause/resume queue
  const pauseQueue = useCallback(() => setIsPaused(true), []);
  const resumeQueue = useCallback(() => setIsPaused(false), []);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((upload) => upload.status !=='completed'));
}, []);

  // Clear all uploads
  const clearAll = useCallback(() => {
    // Cancel all active uploads
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();

    setQueue([]);
    setActiveUploads(new Set());
  }, []);

  // Get queue statistics
  const getQueueStats = useCallback(() => {
    const stats = queue.reduce(
      (acc, upload) => {
        acc[upload.status] = (acc[upload.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: queue.length,
      queued: stats.queued || 0,
      uploading: stats.uploading || 0,
      completed: stats.completed || 0,
      error: stats.error || 0,
      progress: queue.length > 0
        ? queue.reduce((sum, upload) => sum + upload.progress, 0) / queue.length
        : 0,
    };
  }, [queue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    updateUploadProgress,
    markUploadCompleted,
    markUploadError,
    pauseQueue,
    resumeQueue,
    clearCompleted,
    clearAll,
    getQueueStats,
    isPaused,
    activeUploads: Array.from(activeUploads),
    processUpload,
  };
};
