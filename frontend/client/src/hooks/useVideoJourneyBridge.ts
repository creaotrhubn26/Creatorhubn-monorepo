/**
 * Video Journey Bridge Hook
 *
 * Manages bi-directional communication between:
 * - CustomerJourneyBuilder
 * - AIVideoGenerator
 * - StoryArcStudio
 * - AIVideoAnalysisPanel
 */

import { useState, useEffect, useCallback } from 'react';
import { communication } from '@/services/communication-service';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface VideoGenerationRequest {
  source: 'customer-journey' | 'storyarc-studio' | 'direct';
  journeyId?: string;
  journeyStepId?: string;
  projectId?: string;
  prompt: string;
  style?: string;
  duration?: number;
  aspectRatio?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoGenerationResult {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  cost?: number;
  metadata: unknown;
  analysisData?: VideoAnalysisData;
}

export interface VideoAnalysisData {
  scenes: unknown[];
  chapters: Array<{ title: string; timestamp: number }>;
  highlights: number[];
  culturalMoments: Array<{ type: string; timestamp: number }>;
  overallScore?: number;
  recommendations?: unknown[];
}

export interface StoryArcProject {
  id: string;
  name: string;
  videos: Array<{ id: string; url: string; name: string }>;
  linkedJourneyId?: string;
  linkedJourneyStepId?: string;
}

export interface JourneyVideoSync {
  journeyId: string;
  stepId: string;
  videoId?: string;
  videoUrl?: string;
  analysisData?: VideoAnalysisData;
  storyArcProjectId?: string;
  lastUpdated: number;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function toVideoAnalysisData(value: unknown): VideoAnalysisData | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const chapters = Array.isArray(record.chapters)
    ? record.chapters
        .map((chapter) => {
          const chapterRecord = toRecord(chapter);
          const title = readString(chapterRecord, 'title');
          const timestamp = readNumber(chapterRecord, 'timestamp');
          if (!title || typeof timestamp !== 'number') return null;
          return { title, timestamp };
        })
        .filter((chapter): chapter is { title: string; timestamp: number } => chapter !== null)
    : [];

  const culturalMoments = Array.isArray(record.culturalMoments)
    ? record.culturalMoments
        .map((moment) => {
          const momentRecord = toRecord(moment);
          const type = readString(momentRecord, 'type');
          const timestamp = readNumber(momentRecord, 'timestamp');
          if (!type || typeof timestamp !== 'number') return null;
          return { type, timestamp };
        })
        .filter((moment): moment is { type: string; timestamp: number } => moment !== null)
    : [];

  const highlights = Array.isArray(record.highlights)
    ? record.highlights.filter((highlight): highlight is number => typeof highlight === 'number')
    : [];

  return {
    scenes: Array.isArray(record.scenes) ? record.scenes : [],
    chapters,
    highlights,
    culturalMoments,
    overallScore: readNumber(record, 'overallScore'),
    recommendations: Array.isArray(record.recommendations) ? record.recommendations : [],
  };
}

function toVideoGenerationResult(value: unknown): VideoGenerationResult | null {
  const record = toRecord(value);
  const id = readString(record, 'id');
  const videoUrl = readString(record, 'videoUrl');
  const duration = readNumber(record, 'duration');

  if (!id || !videoUrl || typeof duration !== 'number') {
    return null;
  }

  const metadata = toRecord(record.metadata);
  return {
    id,
    videoUrl,
    duration,
    metadata,
    thumbnailUrl: readString(record, 'thumbnailUrl'),
    cost: readNumber(record, 'cost'),
    analysisData: toVideoAnalysisData(record.analysisData),
  };
}

function toStoryArcProject(value: unknown): StoryArcProject | null {
  const record = toRecord(value);
  const id = readString(record, 'id');
  const name = readString(record, 'name');
  if (!id || !name) {
    return null;
  }

  const videos = Array.isArray(record.videos)
    ? record.videos
        .map((video) => {
          const videoRecord = toRecord(video);
          const videoId = readString(videoRecord, 'id');
          const url = readString(videoRecord, 'url');
          const videoName = readString(videoRecord, 'name');
          if (!videoId || !url || !videoName) return null;
          return { id: videoId, url, name: videoName };
        })
        .filter((video): video is { id: string; url: string; name: string } => video !== null)
    : [];

  return {
    id,
    name,
    videos,
    linkedJourneyId: readString(record, 'linkedJourneyId'),
    linkedJourneyStepId: readString(record, 'linkedJourneyStepId'),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useVideoJourneyBridge() {
  const [activeRequest, setActiveRequest] = useState<VideoGenerationRequest | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<VideoGenerationResult | null>(null);
  const [linkedProjects, setLinkedProjects] = useState<Map<string, StoryArcProject>>(new Map());
  const [syncData, setSyncData] = useState<Map<string, JourneyVideoSync>>(new Map());

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMMUNICATION LISTENERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    // Listen for video generation requests from Customer Journey
    const unsubGenRequest = communication.subscribe(
      'journey-request-video-generation',
      (message) => {
        const data = toRecord(message.data);
        const prompt = readString(data, 'prompt');
        if (!prompt) return;

        const request: VideoGenerationRequest = {
          source: 'customer-journey',
          journeyId: readString(data, 'journeyId'),
          journeyStepId: readString(data, 'stepId'),
          prompt,
          style: readString(data, 'style'),
          duration: readNumber(data, 'duration'),
          metadata: toRecord(data.metadata),
        };
        setActiveRequest(request);
      },
    );

    // Listen for video generation completion
    const unsubGenComplete = communication.subscribe('video-generation-completed', (message) => {
      const result = toVideoGenerationResult(message.data);
      if (!result) return;
      setGeneratedVideo(result);

      // If linked to journey, sync back
      if (activeRequest?.journeyId && activeRequest?.journeyStepId) {
        const syncKey = `${activeRequest.journeyId}-${activeRequest.journeyStepId}`;
        setSyncData((prev) =>
          new Map(prev).set(syncKey, {
            journeyId: activeRequest.journeyId!,
            stepId: activeRequest.journeyStepId!,
            videoId: result.id,
            videoUrl: result.videoUrl,
            analysisData: result.analysisData,
            lastUpdated: Date.now(),
          }),
        );

        // Notify journey of video completion
        communication.sendMessage({
          type: 'video-ready-for-journey',
          from: 'video-journey-bridge',
          to: 'customer-journey-builder',
          priority: 'high',
          data: {
            journeyId: activeRequest.journeyId,
            stepId: activeRequest.journeyStepId,
            videoUrl: result.videoUrl,
            videoId: result.id,
            analysisData: result.analysisData,
          },
        });
      }
    });

    // Listen for StoryArc project links
    const unsubStoryArc = communication.subscribe('storyarc-linked-to-journey', (message) => {
      const project = toStoryArcProject(message.data);
      if (!project) return;
      if (project.linkedJourneyId) {
        setLinkedProjects((prev) => new Map(prev).set(project.linkedJourneyId!, project));
      }
    });

    // Listen for video analysis completion
    const unsubAnalysis = communication.subscribe('video-analysis-completed', (message) => {
      const data = toRecord(message.data);
      const journeyId = readString(data, 'journeyId');
      const stepId = readString(data, 'stepId');
      const analysisData = toVideoAnalysisData(data.analysisData);

      if (journeyId && stepId) {
        const syncKey = `${journeyId}-${stepId}`;
        setSyncData((prev) => {
          const existing = prev.get(syncKey);
          return new Map(prev).set(syncKey, {
            ...existing!,
            analysisData,
            lastUpdated: Date.now(),
          });
        });

        // Send analysis back to journey
        communication.sendMessage({
          type: 'video-analysis-ready',
          from: 'video-journey-bridge',
          to: 'customer-journey-builder',
          priority: 'medium',
          data: {
            journeyId,
            stepId,
            analysisData,
          },
        });
      }
    });

    // Listen for StoryArc edits that should update journey
    const unsubStoryArcEdit = communication.subscribe('storyarc-video-edited', (message) => {
      const data = toRecord(message.data);
      const projectId = readString(data, 'projectId');
      const videoUrl = readString(data, 'videoUrl');
      const journeyId = readString(data, 'journeyId');
      const stepId = readString(data, 'stepId');
      const changes = data.changes;

      if (journeyId && stepId) {
        communication.sendMessage({
          type: 'storyarc-changes-available',
          from: 'video-journey-bridge',
          to: 'customer-journey-builder',
          priority: 'low',
          data: {
            journeyId,
            stepId,
            projectId,
            videoUrl,
            changes,
          },
        });
      }
    });

    return () => {
      unsubGenRequest();
      unsubGenComplete();
      unsubStoryArc();
      unsubAnalysis();
      unsubStoryArcEdit();
    };
  }, [activeRequest]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Request video generation from journey
   */
  const requestVideoGeneration = useCallback((request: VideoGenerationRequest) => {
    setActiveRequest(request);

    communication.sendMessage({
      type: 'request-video-generation',
      from: request.source,
      to: 'ai-video-generator',
      priority: 'high',
      data: request,
    });
  }, []);

  /**
   * Open StoryArcStudio with generated video
   */
  const openInStoryArc = useCallback(
    (
      video: VideoGenerationResult,
      metadata?: {
        journeyId?: string;
        stepId?: string;
      },
    ) => {
      communication.sendMessage({
        type: 'open-storyarc-with-video',
        from: 'video-journey-bridge',
        to: 'storyarc-studio',
        priority: 'high',
        data: {
          videoUrl: video.videoUrl,
          videoId: video.id,
          linkedJourneyId: metadata?.journeyId,
          linkedStepId: metadata?.stepId,
          analysisData: video.analysisData,
        },
      });
    },
    [],
  );

  /**
   * Link StoryArc project to journey step
   */
  const linkProjectToJourney = useCallback(
    (projectId: string, journeyId: string, stepId: string) => {
      communication.sendMessage({
        type: 'link-storyarc-to-journey',
        from: 'video-journey-bridge',
        to: 'all',
        priority: 'medium',
        data: {
          projectId,
          journeyId,
          stepId,
          timestamp: Date.now(),
        },
      });
    },
    [],
  );

  /**
   * Get sync data for a journey step
   */
  const getSyncData = useCallback(
    (journeyId: string, stepId: string): JourneyVideoSync | null => {
      const syncKey = `${journeyId}-${stepId}`;
      return syncData.get(syncKey) || null;
    },
    [syncData],
  );

  /**
   * Get linked StoryArc project for journey
   */
  const getLinkedProject = useCallback(
    (journeyId: string): StoryArcProject | null => {
      return linkedProjects.get(journeyId) || null;
    },
    [linkedProjects],
  );

  /**
   * Clear active request
   */
  const clearRequest = useCallback(() => {
    setActiveRequest(null);
    setGeneratedVideo(null);
  }, []);

  /**
   * Trigger video analysis
   */
  const triggerVideoAnalysis = useCallback(
    (
      videoUrl: string,
      metadata?: {
        journeyId?: string;
        stepId?: string;
        videoId?: string;
      },
    ) => {
      communication.sendMessage({
        type: 'analyze-video',
        from: 'video-journey-bridge',
        to: 'ai-video-analysis-panel',
        priority: 'medium',
        data: {
          videoUrl,
          ...metadata,
        },
      });
    },
    [],
  );

  return {
    // State
    activeRequest,
    generatedVideo,
    linkedProjects: Array.from(linkedProjects.values()),
    syncData: Array.from(syncData.values()),

    // Actions
    requestVideoGeneration,
    openInStoryArc,
    linkProjectToJourney,
    getSyncData,
    getLinkedProject,
    clearRequest,
    triggerVideoAnalysis,
  };
}
