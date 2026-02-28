import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  VideoLibrary,
  EditNote,
  MovieCreation,
  Notes,
  CloudDone,
  CloudSync,
  CloudOff,
  Refresh,
  ColorLens,
  AutoFixHigh,
  PlayArrow,
  Stop,
  CheckCircle,
  Error,
  Code,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../utils/theming-helper';
import { useProject } from '../contexts/ProjectContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { useRealTime } from '../contexts/RealTimeContext';
import { useVisualEditor } from '../components/admin/visual-editor/VisualEditorContext';
import StoryArcStudio from '@/components/StoryArcStudio';
import NoteEditor from '@/components/notes/NoteEditor';
import ResolveProjectCreator from '@/components/davinci-resolve/ResolveProjectCreator';
import VideoAIEnhancementPanel from '@/components/video-editing/VideoAIEnhancementPanel';
import ScriptManager from '@/components/davinci-resolve/ScriptManager';
import { CREATOR_HUB_BRANDING } from '../constants/CreatorHubBranding';


export default function StoryArcStudioPage() {
  const [, setLocation] = useLocation();
  const [projectId, setProjectId] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Context hooks
  const { currentProject, updateProject, getProjectSettings } = useProject();
  const { settings, updateSetting, getSetting } = useSettings();
  const { getProfessionTheme } = useCustomTheme();
  const { isConnected, emitEvent, onEvent, offEvent } = useRealTime();
  const { addNotification } = useVisualEditor();
  
  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');
  const professionTheme = getProfessionTheme('videographer');
  const accentColor = professionTheme?.primaryColor || CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY;
  
  // Feature flags + integration access (fallback allows local/dev route usage)
  const storyArcFeatureFlag = useFeatureFlag('story-arc-studio');
  const scriptManagerFeatureFlag = useFeatureFlag('script-manager');

  // Comprehensive Feature System
  const storyArcAccess = features.checkFeatureAccess('story-arc-studio');
  const scriptManagerAccess = features.checkFeatureAccess('script-manager');
  const isStoryArcStudioEnabled =
    storyArcAccess.hasAccess || storyArcFeatureFlag.isEnabled || import.meta.env.DEV;
  const isScriptManagerEnabled =
    scriptManagerAccess.hasAccess || scriptManagerFeatureFlag.isEnabled || import.meta.env.DEV;
  const canTrackStoryArcUsage = storyArcAccess.hasAccess;
  const canTrackScriptManagerUsage = scriptManagerAccess.hasAccess;
  const isFeatureLoading = storyArcFeatureFlag.isLoading || scriptManagerFeatureFlag.isLoading;

  // Toast notification helpers
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    addNotification({
      message,
      type,
      title: type.charAt(0).toUpperCase() + type.slice(1) + ' Notification',
      read: false
});
};

  const showSuccessToast = (message: string) => showToast(message, 'success');
  const showErrorToast = (message: string) => showToast(message, 'error');
  const showWarningToast = (message: string) => showToast(message, 'warning');
  const showInfoToast = (message: string) => showToast(message, 'info');
  
  // NoteEditor integration state
  const [activeTab, setActiveTab] = useState(0);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // ✅ DaVinci Resolve API integration state
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [storyArcData, setStoryArcData] = useState<any>(null);
  const [resolveStatus, setResolveStatus] = useState<{
    connected: boolean;
    projectId?: string;
    timelineId?: string;
    isCreating: boolean;
    error?: string;
}>({ connected: false, isCreating: false });
  
  // ✅ Video AI Enhancement state
  const [showVideoAIDialog, setShowVideoAIDialog] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  
  // ✅ Script Manager state
  const [showScriptManager, setShowScriptManager] = useState(false);
  
  // Google Drive integration state
  const [googleDriveFolder, setGoogleDriveFolder] = useState<{
    folderId?: string;
    folderUrl?: string;
    folderPath?: string;
    isCreating?: boolean;
    error?: string;
}>({});

  // Unified callback system for workflow integration
  interface ResolveConnectionStatus {
    connected?: boolean;
  }

  interface DriveInitResponse {
    success?: boolean;
    folderId?: string;
    folderUrl?: string;
    folderPath?: string;
    message?: string;
  }

  const unifiedCallbacks = {
    onProjectUpdate: (project: any) => {
      console.log('🎬 Story Arc Project Updated, :', project);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
  },
    onWorklogCreate: (worklog: any) => {
      console.log('📝 Story Arc Worklog Created: ', worklog);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'worklog'] });
    },
    onShowcaseCreate: (showcase: any) => {
      console.log('🎨 Story Arc Showcase Created:', showcase);
      queryClient.invalidateQueries({ queryKey: ['/api/showcases'] });
  },
    onFileUpload: (file: any) => {
      console.log('📁 Story Arc File Uploaded, :', file);
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
  }
};

  // Get project ID from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('projectId');
    if (id) {
      setProjectId(id);
  }
}, []);

  // Load project settings from context
  useEffect(() => {
    if (currentProject) {
      const storyArcSettings = getProjectSettings('storyArc');
      if (storyArcSettings) {
        console.log('🎬 Loaded story arc settings from project:', storyArcSettings);
    }
  }

    // Load user story arc preferences
    const storyArcPreferences = getSetting('general','notifications');
    if (storyArcPreferences) {
      console.log('🎬 Loaded user story arc preferences:', storyArcPreferences);
  }
}, [currentProject, getProjectSettings, getSetting]);

  // Ensure Story Arc editing uses autosave defaults for note/script workflows.
  useEffect(() => {
    if (!settings.projectCreation.autoSave || settings.projectCreation.autoSaveInterval > 120) {
      updateSetting('projectCreation', {
        autoSave: true,
        autoSaveInterval: 60,
      });
    }
  }, [settings.projectCreation.autoSave, settings.projectCreation.autoSaveInterval, updateSetting]);

  // Real-time event handling
  useEffect(() => {
    if (!isConnected) return;

    const handleStoryArcUpdate = (data: any) => {
      console.log('🎬 Real-time story arc update received, :', data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
  };

    const handleStoryArcCreate = (data: any) => {
      console.log('🎬 Real-time story arc create received, :', data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
  };

    const handleStoryArcPublish = (data: any) => {
      console.log('🎬 Real-time story arc publish received, :', data);
      queryClient.invalidateQueries({ queryKey: ['/api/showcases'] });
  };

    onEvent('project_updated', handleStoryArcUpdate);
    onEvent('item_updated', handleStoryArcCreate);
    onEvent('status_changed', handleStoryArcPublish);

    return () => {
      offEvent('project_updated', handleStoryArcUpdate);
      offEvent('item_updated', handleStoryArcCreate);
      offEvent('status_changed', handleStoryArcPublish);
  };
}, [isConnected, onEvent, offEvent, queryClient, projectId]);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'StoryArcStudioPage',
      name: 'Story Arc Studio Page',
      type: 'page',
      category: 'video-editing',
      capabilities: ['story-creation','video-editing','davinci-resolve','script-writing'],
      dependencies: [],
      props: [],
      events: ['story-arc:generate','story-arc:publish'],
      dataKeys: ['story-arc-data','project-data','script-content']
  });

    // Track feature usage only when the feature is available (or local dev mode).
    if (canTrackStoryArcUsage) {
      features.trackFeatureUsage('story-arc-studio','opened', {
        timestamp: Date.now(),
        projectId,
        userAgent: navigator.userAgent
      });
    }

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'StoryArcStudioPage',
      dataKey: 'story-arc-data'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'StoryArcStudioPage',
      dataKey: 'project-data'
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'StoryArcStudioPage',
      dataKey: 'script-content'
});

    // Listen for story arc events
    const storyArcUnsubscribe = communication.onMessageType('story-arc:generate', (data: any) => {
      if (data.storyData) {
        handleStoryArcGenerated(data.storyData);
  }
  });

    const publishUnsubscribe = communication.onMessageType('story-arc:publish', (data: any) => {
      if (data.storyData) {
        handlePublishToShowcase(data.storyData);
  }
  });

    return () => {
      componentRegistry.unregisterComponent('StoryArcStudioPage');
      dataFlow.unregisterNode('story-arc-data');
      dataFlow.unregisterNode('project-data');
      dataFlow.unregisterNode('script-content');
      if (typeof storyArcUnsubscribe === 'function') storyArcUnsubscribe();
      if (typeof publishUnsubscribe === 'function') publishUnsubscribe();
  };
}, [
  storyArcData,
  scriptContent,
  projectNotes,
  componentRegistry,
  dataFlow,
  communication,
  features,
  projectId,
  canTrackStoryArcUsage,
]);

  // Fetch project data
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}`),
    enabled: !!projectId,
});

  // Fetch project notes and script
  const { data: projectContent } = useQuery({
    queryKey: ['/api/projects/notes', projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}/content`),
    enabled: !!projectId,
});

  // ✅ DaVinci Resolve API integration queries
  const { data: resolveConnectionStatus, refetch: checkResolveConnection } = useQuery<ResolveConnectionStatus>({
    queryKey: ['/api/davinci-resolve/status'],
    queryFn: () => apiRequest('/api/davinci-resolve/status'),
    refetchInterval: 3000, // Check every 30 seconds
});

  // Handle resolve connection status updates
  useEffect(() => {
    if (resolveConnectionStatus) {
      setResolveStatus(prev => ({ ...prev, connected: resolveConnectionStatus.connected }));
  }
}, [resolveConnectionStatus]);

  // Mutation for creating DaVinci Resolve projects
  const createResolveProject = useMutation({
    mutationFn: (projectConfig: any) => apiRequest('/api/davinci-resolve/projects', {
      method: 'POST',
      body: JSON.stringify(projectConfig),
  }),
    onSuccess: (data: Record<string, unknown>) => {
      const createdProjectId =
        typeof data.projectId === 'string' ? data.projectId : undefined;
      setResolveStatus(prev => ({ 
        ...prev, 
        projectId: createdProjectId, 
        isCreating: false,
        error: undefined 
  }));
      showSuccessToast('DaVinci Resolve project created successfully!');
      console.log('✅ DaVinci Resolve project created:', createdProjectId);
      if (createdProjectId) {
        handleResolveProjectCreated({ projectId: createdProjectId });
      }
  },
    onError: (error) => {
      setResolveStatus(prev => ({ 
        ...prev, 
        isCreating: false, 
        error: error instanceof Error ? error.message : String(error) 
  }));
      showErrorToast('Failed to create DaVinci Resolve project');
      console.error('❌ Failed to create DaVinci Resolve project:', error);
  },
});

  // Mutation for creating timelines
  const createResolveTimeline = useMutation({
    mutationFn: ({ projectId, timelineConfig }: { projectId: string; timelineConfig: any }) => 
      apiRequest(`/api/davinci-resolve/projects/${projectId}/timelines`, {
        method: 'POST',
        body: JSON.stringify(timelineConfig),
    }),
    onSuccess: (data: Record<string, unknown>) => {
      const createdTimelineId =
        typeof data.timelineId === 'string' ? data.timelineId : undefined;
      setResolveStatus(prev => ({ 
        ...prev, 
        timelineId: createdTimelineId,
        error: undefined 
  }));
      showSuccessToast('DaVinci Resolve timeline created successfully!');
      console.log('✅ DaVinci Resolve timeline created:', createdTimelineId);
  },
    onError: (error) => {
      setResolveStatus(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : String(error) 
  }));
      showErrorToast('Failed to create DaVinci Resolve timeline');
      console.error('❌ Failed to create DaVinci Resolve timeline:', error);
  },
});

  // Update content when project data loads
  useEffect(() => {
    if (projectContent) {
      setScriptContent(projectContent.script || '');
      setProjectNotes(projectContent.notes || '');
  }
}, [projectContent]);

  // Pull a default video URL into the AI dialog context when present.
  useEffect(() => {
    if (!projectData || typeof projectData !== 'object') return;
    const record = projectData as Record<string, unknown>;
    const candidate =
      (typeof record.videoUrl === 'string' && record.videoUrl) ||
      (typeof record.previewUrl === 'string' && record.previewUrl) ||
      '';
    if (candidate) {
      setCurrentVideoUrl(candidate);
    }
  }, [projectData]);

  // Auto-create Google Drive folder when project loads
  useEffect(() => {
    if (projectData && projectId && !googleDriveFolder.folderId && !googleDriveFolder.isCreating && !googleDriveFolder.error) {
      handleCreateGoogleDriveFolder();
  }
}, [projectData, projectId]);

  const handleBackToDashboard = () => {
    setLocation('/dashboard');
};

  const handlePublishToShowcase = async (storyArcData: any) => {
    try {
      const response = await apiRequest('/api/showcase/publish-story-arc', {
        method: 'POST',
        body: JSON.stringify(storyArcData),
    });
      
      if (response.success) {
        console.log('✅ Story arc published to showcase:', response);
        
        // Show success toast
        showSuccessToast('Story arc published to showcase!');
        
        // Trigger unified workflow event
        if (unifiedCallbacks.onShowcaseCreate) {
          const showcaseData = {
            id: response.showcaseId || `showcase_${Date.now()}`,
            title: storyArcData.title || 'Story Arc Showcase',
            description: storyArcData.description,
            projectId,
            type: 'story_arc',
            scenes: storyArcData.scenes?.length || 0,
            timestamp: new Date().toISOString(),
            source: 'story_arc_studio'
          };
          unifiedCallbacks.onShowcaseCreate(showcaseData);
        }

        emitEvent('status_changed', {
          source: 'story-arc-studio',
          projectId,
          status: 'published',
        });
        integration.emit('story-arc:published', {
          projectId,
          showcaseId: response.showcaseId,
        });

        // Optionally redirect to showcase or show success message
        setLocation(`/showcase/${projectId}`);
      }
    } catch (error: unknown) {
      console.error('❌ Error publishing to showcase:', error);
      showErrorToast('Failed to publish story arc to showcase');
      throw error;
  }
};

  // ✅ Enhanced story arc handler with automatic DaVinci Resolve integration
  const handleStoryArcGenerated = async (arcData: any) => {
    setStoryArcData(arcData);
    console.log('📝 Story arc data captured for DaVinci Resolve:', arcData);

    // Track feature usage
    if (canTrackStoryArcUsage) {
      features.trackFeatureUsage('story-arc-studio','story_arc_generated', {
        timestamp: Date.now(),
        projectId,
        sceneCount: arcData.scenes?.length || 0,
        estimatedDuration: arcData.estimatedDuration,
        eventType: arcData.eventType
      });
    }

    // Broadcast story arc generation event
    communication.sendBroadcast('story-arc:generated', {
      type: 'story_arc_generated',
      data: arcData,
      component: 'StoryArcStudioPage'
    });
    emitEvent('item_updated', {
      source: 'story-arc-studio',
      projectId,
      storyArc: arcData,
    });
    integration.emit('story-arc:generated', {
      projectId,
      sceneCount: arcData.scenes?.length || 0,
    });
    
    // Trigger unified workflow events
    if (unifiedCallbacks.onProjectUpdate) {
      const projectUpdate = {
        id: projectId,
        type: 'story_arc_generated',
        title: arcData.title || 'Story Arc',
        description: arcData.description,
        scenes: arcData.scenes?.length || 0,
        estimatedDuration: arcData.estimatedDuration,
        timestamp: new Date().toISOString(),
        source: 'story_arc_studio'
      };
      unifiedCallbacks.onProjectUpdate(projectUpdate);
    }

    // Create worklog entry for story arc generation
    if (unifiedCallbacks.onWorklogCreate) {
      const worklogEntry = {
        id: `worklog_${Date.now()}`,
        projectId,
        type: 'story_arc',
        title: `Story Arc Generated: ${arcData.title || 'Untitled'}`,
        description: `Created story arc with ${arcData.scenes?.length || 0} scenes`,
        duration: 30, // Estimated 30 minutes for story arc creation
        timestamp: new Date().toISOString(),
        source: 'story_arc_studio'
  };
      unifiedCallbacks.onWorklogCreate(worklogEntry);
  }
    
    // Automatically create DaVinci Resolve project if connected
    if (resolveStatus.connected && !resolveStatus.projectId) {
      await createDaVinciResolveProject(arcData);
  }

    // Persist short summary to project context so related modules can consume it.
    if (projectId) {
      try {
        await updateProject(projectId, {
          description: arcData.description || currentProject?.description || '',
        });
      } catch (error) {
        console.warn('Unable to sync project summary after story arc generation:', error);
      }
    }
};

  // ✅ Automatic DaVinci Resolve project creation
  const createDaVinciResolveProject = async (arcData: any) => {
    if (!resolveStatus.connected || resolveStatus.isCreating) return;
    
    setResolveStatus(prev => ({ ...prev, isCreating: true, error: undefined }));

    // Track feature usage
    if (canTrackScriptManagerUsage) {
      features.trackFeatureUsage('script-manager','davinci_project_created', {
        timestamp: Date.now(),
        projectId,
        projectName: `${arcData.title || 'Story Arc'} - ${projectData?.name || 'Project'}`,
        eventType: arcData.eventType || 'bryllup',
        frameRate: arcData.frameRate || 25,
        resolution: arcData.resolution || '1920x1080'
      });
    }

    try {
      const projectConfig = {
        projectName: `${arcData.title || 'Story Arc'} - ${projectData?.name || 'Project'}`,
        clientName: projectData?.clientName || 'Unknown Client',
        eventType: arcData.eventType || 'bryllup',
        cultureType: arcData.cultureType,
        frameRate: arcData.frameRate || 25,
        resolution: arcData.resolution || '1920x1080',
        colorSpace: arcData.colorSpace || 'Rec.709',
        projectNotes: arcData.description || scriptContent,
        estimatedDuration: arcData.estimatedDuration || 30,
        priority: 'medium',
      };

      await createResolveProject.mutateAsync(projectConfig);
    } catch (error: unknown) {
      console.error('❌ Failed to create DaVinci Resolve project:', error);
      // Track error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (canTrackScriptManagerUsage) {
        features.trackFeatureUsage('script-manager','davinci_project_error', {
          timestamp: Date.now(),
          projectId,
          error: errorMessage
        });
      }
    }
  };

  // ✅ Enhanced timeline creation from story arc
  const createTimelineFromStoryArc = async (projectId: string, arcData: any) => {
    if (!arcData || !arcData.scenes) return;
    
    try {
      const timelineConfig = {
        timelineName: `${arcData.title || 'Story Arc'} Timeline`,
        frameRate: arcData.frameRate || 25,
        resolution: arcData.resolution || '1920x1080',
        colorSpace: arcData.colorSpace || 'Rec.709',
        clips: arcData.scenes.map((scene: any, index: number) => ({
          id: `scene_${index}`,
          name: scene.title || `Scene ${index + 1}`,
          filePath: scene.mediaPath || '', // Placeholder for actual media
          startTime: index * 10, // 10 seconds per scene
          endTime: (index + 1) * 10,
          track: 1,
        })),
        transitions: arcData.scenes.map((scene: any, index: number) => ({
          id: `transition_${index}`,
          name: 'Dissolve',
          type: 'dissolve',
          duration: 1,
          startClip: `scene_${index}`,
          endClip: `scene_${index + 1}`,
        })).slice(0, -1), // No transition after last scene
      };

      await createResolveTimeline.mutateAsync({ projectId, timelineConfig });
    } catch (error: unknown) {
      console.error('❌ Failed to create timeline:', error);
    }
  };

  const handleResolveProjectCreated = (resolveProject: any) => {
    console.log('🎬 DaVinci Resolve project created:', resolveProject);

    // Automatically create timeline if story arc data is available
    if (storyArcData && resolveProject.projectId) {
      createTimelineFromStoryArc(resolveProject.projectId, storyArcData);
    }

    setShowResolveDialog(false);
  };

  // NoteEditor handlers
  const handleSaveNotes = async () => {
    if (!projectId) return;
    
    try {
      await apiRequest(`/api/projects/${projectId}/content`, {
        method: 'PUT',
        body: JSON.stringify({
          script: scriptContent,
          notes: projectNotes,
      }),
    });
      
      setLastSaved(new Date());
      setIsDirty(false);
      showSuccessToast('Notes saved successfully!');
      console.log('✅ Notes saved successfully');
  } catch (error: unknown) {
      console.error('❌ Error saving notes, :', error);
      showErrorToast('Failed to save notes');
  }
};

  const handleScriptChange = (value: string) => {
    setScriptContent(value);
    setIsDirty(true);
};

  const handleNotesChange = (value: string) => {
    setProjectNotes(value);
    setIsDirty(true);
};

  const handleAIEnhance = (type: 'improve' | 'summarize' | 'translate' | 'grammar') => {
    const sourceContent = activeTab === 0 ? scriptContent : projectNotes;
    const plainText = sourceContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    if (!plainText) {
      showWarningToast('No content available to enhance.');
      return;
    }

    const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
    const toSentenceCase = (value: string) =>
      value.replace(/(^\s*[a-zæøå])|([.!?]\s+[a-zæøå])/g, (m) => m.toUpperCase());

    let transformed = plainText;

    if (type === 'improve') {
      transformed = toSentenceCase(normalizeWhitespace(plainText));
      showInfoToast('Improved readability and sentence casing.');
    }

    if (type === 'summarize') {
      const sentences = plainText
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .slice(0, 4);
      transformed = sentences.join(' ');
      showInfoToast('Created a short summary.');
    }

    if (type === 'translate') {
      // Local fallback: language markers + normalized text for consistent output.
      const startsNorwegian = /[æøå]/i.test(plainText) || /(?:\bog\b|\bikke\b|\bmed\b)/i.test(plainText);
      transformed = startsNorwegian
        ? `[EN draft]\n${plainText}`
        : `[NO draft]\n${plainText}`;
      showInfoToast('Prepared draft translation (local fallback).');
    }

    if (type === 'grammar') {
      transformed = plainText
        .replace(/\bteh\b/gi, 'the')
        .replace(/\bi\b/g, 'I')
        .replace(/\bdet var ikke noe\b/gi, 'det var ingen')
        .replace(/\s+([,.!?;:])/g, '$1');
      transformed = toSentenceCase(transformed);
      showInfoToast('Applied grammar and punctuation corrections.');
    }

    const enhancedHtml = `<p>${transformed.replace(/\n/g, '<br/>')}</p>`;
    if (activeTab === 0) {
      setScriptContent(enhancedHtml);
    } else {
      setProjectNotes(enhancedHtml);
    }
    setIsDirty(true);
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'html' | 'txt') => {
    const sourceContent = activeTab === 0 ? scriptContent : projectNotes;
    const plainText = sourceContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const section = activeTab === 0 ? 'script' : 'notes';
    const baseFileName = `${projectData?.name || 'story-arc'}-${section}`;

    if (!plainText && !sourceContent) {
      showWarningToast('Nothing to export yet.');
      return;
    }

    const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    };

    if (format === 'txt') {
      downloadBlob(new Blob([plainText], { type: 'text/plain;charset=utf-8' }), `${baseFileName}.txt`);
      showSuccessToast('TXT export ready.');
      return;
    }

    if (format === 'html') {
      const htmlDocument = `<!doctype html><html><head><meta charset="utf-8"/><title>${baseFileName}</title></head><body>${sourceContent}</body></html>`;
      downloadBlob(new Blob([htmlDocument], { type: 'text/html;charset=utf-8' }), `${baseFileName}.html`);
      showSuccessToast('HTML export ready.');
      return;
    }

    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      const lines = pdf.splitTextToSize(plainText, 180);
      pdf.text(lines, 14, 20);
      pdf.save(`${baseFileName}.pdf`);
      showSuccessToast('PDF export ready.');
      return;
    }

    if (format === 'docx') {
      const { Document, Paragraph, Packer } = await import('docx');
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: projectData?.name || 'Story Arc Project' }),
            new Paragraph({ text: '' }),
            new Paragraph({ text: plainText }),
          ],
        }],
      });
      const docBlob = await Packer.toBlob(doc);
      downloadBlob(
        new Blob([docBlob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        `${baseFileName}.docx`
      );
      showSuccessToast('DOCX export ready.');
    }
  };

  // Google Drive folder creation
  const handleCreateGoogleDriveFolder = async () => {
    if (!projectData || !projectId) return;

    setGoogleDriveFolder(prev => ({ ...prev, isCreating: true, error: undefined }));

    try {
      console.log('🚀 Creating Google Drive folder for StoryArc project...');
      
      const response = await apiRequest(`/api/projects/${projectId}/google-drive/initialize`, {
        method: 'POST',
        body: JSON.stringify({
          userId: user?.id || projectData.userId || 'current-user',
          projectName: projectData.name || 'Story Arc Project',
          projectType: 'video-story-arc',
          folderStructure: [
            'Raw Footage','Edited Files','Client Review','Final Delivery','Scripts & Notes','Moodboards & Inspiration','Contracts & Documents','Communication'
          ]
        }),
      }) as DriveInitResponse;

      if (response.success) {
        setGoogleDriveFolder({
          folderId: response.folderId,
          folderUrl: response.folderUrl,
          folderPath: response.folderPath,
          isCreating: false,
        });

        showSuccessToast('Google Drive folder created successfully!');
        console.log('✅ Google Drive folder created successfully:', response.folderPath);
      } else {
        const errorMessage =
          response && typeof response === 'object' && 'message' in response
            ? String(response.message)
            : 'Failed to create Google Drive folder';
        const error = { message: errorMessage, name: 'Error' } as Error;
        throw error;
      }
  } catch (error: unknown) {
      console.error('❌ Error creating Google Drive folder, :', error);
      let errorMessage = 'Unknown error occurred';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
    }
      setGoogleDriveFolder(prev => ({
        ...prev,
        isCreating: false,
        error: errorMessage
  }));
      showErrorToast('Failed to create Google Drive folder');
  }
};

  // Show loading state while checking feature flag
  if (isFeatureLoading) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'column',
        gap: 2 }}>
        <CircularProgress size={60} sx={{ color: accentColor }} />
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          Loading Story Arc Studio...
        </Typography>
      </Box>
    );
}

  // Show feature disabled message if not enabled
  if (!isStoryArcStudioEnabled) {
    const disabledInfo = {
      title: 'Feature Unavailable',
      message: storyArcAccess.reason || 'Story Arc Studio is currently unavailable for this account.',
      action: 'Contact Support',
    };

    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'column',
        gap:  3,
        p: 4 }}>
        <VideoLibrary sx={{ fontSize:  80, color: 'text.secondary',}} />
        <Typography variant="h4" color="text.secondary" textAlign="center" sx={{ color: theming.colors.primary }}>
          {disabledInfo.title}
        </Typography>
        <Typography variant="h6" color="text.secondary" textAlign="center" sx={{ color: theming.colors.primary }}>
          Story Arc Studio
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ maxWidth: 600,}}>
          {disabledInfo.message}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={handleBackToDashboard}
            sx={{
              ...theming.getThemedButtonSx(),
              bgcolor: accentColor,
              '&:hover': { bgcolor: '#e67e00' },
            }}
          >
            Back to Dashboard
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              // Track feature access attempt
              if (canTrackStoryArcUsage) {
                features.trackFeatureUsage('story-arc-studio','access_denied', {
                  reason: storyArcAccess.reason,
                  timestamp: Date.now()
                });
              }
              // Handle action based on reason
              console.log('Feature access action:', disabledInfo.action);
            }}
          >
            {disabledInfo.action}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' },
      }
  }}>
      {/* Header */}
      <Paper
        elevation={1}
        sx={{
          ...theming.getThemedCardSx(),
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="xl">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button
              startIcon={<ArrowBack />}
              onClick={handleBackToDashboard}
              variant="outlined"
              size="small"
            >
              Back to Dashboard
            </Button>
            <VideoLibrary color="primary" />
            <Typography variant="h5" fontWeight={600} sx={{ color: theming.colors.primary }}>
              Story Arc Studio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Professional Video Story Creation
            </Typography>
            
            {/* Real-time connection status */}
            {isConnected && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                <Box sx={{ 
                  width:  8, 
                  height:  8, 
                  borderRadius: '50%', 
                  bgcolor: 'success.main',
                  animation: 'pulse 2s infinite'
            }} />
                <Typography variant="caption" color="success.main">
                  Live
                </Typography>
              </Box>
            )}
            
            <Box sx={{ flex:  1 }} />
            
            {/* Feature Analytics Display */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip 
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 20,}}
              />
            </Box>
            
            {/* ✅ DaVinci Resolve Status */}
            {resolveStatus.isCreating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <CircularProgress size={16} sx={{ color: '#3b82f6',}} />
                <Typography variant="caption" color="text.secondary">
                  Creating Resolve project...
                </Typography>
              </Box>
            )}
            
            {resolveStatus.connected && resolveStatus.projectId && !resolveStatus.isCreating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <CheckCircle sx={{ color: 'success.main',}} />
                <Typography variant="caption" color="success.main">
                  Resolve project ready
                </Typography>
                <Chip 
                  label={`Project: ${resolveStatus.projectId.slice(0, 8)}...`} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontSize: '10px', height: 20,}}
                />
              </Box>
            )}
            
            {resolveStatus.connected && !resolveStatus.projectId && !resolveStatus.isCreating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <ColorLens sx={{ color: '#3b82f6',}} />
                <Typography variant="caption" color="text.secondary">
                  DaVinci Resolve connected
                </Typography>
              </Box>
            )}
            
            {!resolveStatus.connected && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <Error sx={{ color: 'warning.main',}} />
                <Typography variant="caption" color="warning.main">
                  DaVinci Resolve not connected
                </Typography>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={() => checkResolveConnection()}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  Check
                </Button>
              </Box>
            )}

            {/* Google Drive Status */}
            {googleDriveFolder.isCreating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <CloudSync sx={{ color: CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY, animation: 'spin 2s linear infinite' }} />
                <Typography variant="caption" color="text.secondary">
                  Creating Google Drive folder...
                </Typography>
              </Box>
            )}

            {googleDriveFolder.folderId && !googleDriveFolder.isCreating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <CloudDone sx={{ color: 'success.main' }} />
                <Typography variant="caption" color="success.main">
                  Drive folder ready
                </Typography>
              </Box>
            )}

            {googleDriveFolder.error && !googleDriveFolder.isCreating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <CloudOff sx={{ color: 'error.main' }} />
                <Typography variant="caption" color="error.main">
                  Drive folder failed
                </Typography>
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={handleCreateGoogleDriveFolder}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  Retry
                </Button>
              </Box>
            )}

            {/* ✅ Enhanced Professional Tools */}
            <Button
              startIcon={<EditNote />}
              onClick={() => setShowNotesDialog(true)}
              variant="contained"
              size="small"
              sx={{
                bgcolor: accentColor,
                '&:hover': { bgcolor: '#e67e00' },
                mr: 1,
              }}
            >
              Script & Notes
            </Button>

            <Button
              startIcon={theming.getThemedIcon('autoFixHigh')}
              onClick={() => setShowVideoAIDialog(true)}
              variant="contained"
              size="small"
              sx={{
                bgcolor: accentColor,
                '&:hover': { bgcolor: '#e67e00' },
                mr: 1,
              }}
            >
              Video AI Enhancement
            </Button>
            
            {isScriptManagerEnabled && (
              <Button
                startIcon={<Code />}
                onClick={() => {
                  // Track feature usage
                  if (canTrackScriptManagerUsage) {
                    features.trackFeatureUsage('script-manager','opened', {
                      timestamp: Date.now(),
                      projectId,
                      source: 'story-arc-studio'
                    });
                  }
                  setShowScriptManager(true);
                }}
                variant="contained"
                size="small"
                sx={{
                  bgcolor: CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY,
                  '&:hover': { bgcolor: '#e67e00' },
                  mr: 1,
                }}
              >
                Script Manager
              </Button>
            )}

            <Button
              startIcon={resolveStatus.projectId ? <PlayArrow /> : <ColorLens />}
              onClick={() => {
                // Track feature usage
                if (canTrackScriptManagerUsage) {
                  features.trackFeatureUsage('script-manager', 'davinci_dialog_opened', {
                    timestamp: Date.now(),
                    projectId,
                    hasProject: !!resolveStatus.projectId,
                    isConnected: resolveStatus.connected,
                    source: 'story-arc-studio'
                  });
                }
                setShowResolveDialog(true);
              }}
              variant="contained"
              size="small"
              disabled={!resolveStatus.connected}
              sx={{
                background: resolveStatus.connected 
                  ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
                  : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)', '&:hover': { 
                  background: resolveStatus.connected
                    ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                    : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
                  transform: resolveStatus.connected ? 'translateY(-1px)' : 'none',
                  boxShadow: resolveStatus.connected ? '0 4px 12px rgba(0, 58, 138, 0.4)' : 'none',
              },
              boxShadow: resolveStatus.connected ? '0 2px 8px rgba(0, 58, 138, 0.3)' : 'none',
              textTransform: 'none',
              fontWeight: 600,
              position: 'relative',
            }}
            >
              {resolveStatus.projectId ? 'Open in Resolve' : 'DaVinci Resolve'}
              {resolveStatus.projectId && (
                <Chip
                  label="Live"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    fontSize: '8px',
                    height: 16,
                    backgroundColor: 'success.main',
                    color: 'white','& .MuiChip-label': { px: 0.5 }
                  }}
                />
              )}
            </Button>
          </Stack>
        </Container>
      </Paper>

      {/* ✅ DaVinci Resolve Error Alert */}
      {resolveStatus.error && (
        <Alert
          severity="warning"
          sx={{ m: 2, mb: 0 }}
          action={
            <Button
              size="small"
              onClick={() => checkResolveConnection()}
              sx={{ color: 'inherit' }}
            >
              Retry
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>DaVinci Resolve Error:</strong> {resolveStatus.error}
          </Typography>
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {isLoadingProject ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography>Loading project data...</Typography>
          </Box>
        ) : (
          <StoryArcStudio
            storyArcId={projectId ?? undefined}
            onProjectUpdate={unifiedCallbacks.onProjectUpdate}
            onWorklogCreate={unifiedCallbacks.onWorklogCreate}
            onShowcaseCreate={unifiedCallbacks.onShowcaseCreate}
            onFileUpload={unifiedCallbacks.onFileUpload}
            selectedProject={projectData}
            onProjectSelect={(project) => {
              if (!project || typeof project !== 'object') {
                return;
              }

              const projectValue = project as { id?: string | number };
              if (projectValue.id !== undefined) {
                setProjectId(String(projectValue.id));
              }
            }}
          />
        )}
      </Box>

      {/* NoteEditor Dialog */}
      <Dialog
        open={showNotesDialog}
        onClose={() => setShowNotesDialog(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <EditNote sx={{ color: accentColor }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Script & Project Notes</Typography>
            <Typography variant="body2" color="text.secondary">
              {projectData?.name || 'Unnamed Project'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(100vh - 120px)',}}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                <Tab
                  icon={<MovieCreation />}
                  label="Video Script"
                  iconPosition="start"
                />
                <Tab
                  icon={<Notes />}
                  label="Project Notes"
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              {activeTab === 0 && (
                <NoteEditor
                  value={scriptContent}
                  onChange={handleScriptChange}
                  placeholder="Skriv video scriptet her... Bruk formatering for struktur og lesbarhet."
                />
              )}

              {activeTab === 1 && (
                <NoteEditor
                  value={projectNotes}
                  onChange={handleNotesChange}
                  placeholder="Skriv prosjektnotater her... Organiser tanker, ideer og planer for prosjektet."
                />
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          {lastSaved && (
            <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
              Last saved: {lastSaved.toLocaleTimeString()}
            </Typography>
          )}
          <Button startIcon={<Stop />} onClick={() => setShowNotesDialog(false)}>
            Close
          </Button>
          <Button onClick={() => handleAIEnhance('improve')}>
            Improve
          </Button>
          <Button onClick={() => handleAIEnhance('summarize')}>
            Summarize
          </Button>
          <Button onClick={() => handleAIEnhance('grammar')}>
            Grammar
          </Button>
          <Button onClick={() => handleExport('txt')}>
            Export TXT
          </Button>
          <Button onClick={() => handleExport('pdf')}>
            Export PDF
          </Button>
          <Button onClick={() => handleExport('docx')}>
            Export DOCX
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveNotes}
            disabled={!isDirty}
            sx={{
              ...theming.getThemedButtonSx(),
              bgcolor: accentColor,
              '&:hover': { bgcolor: '#e67e00' },
            }}
          >
            Save Notes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ DaVinci Resolve Integration Dialog */}
      <Dialog
        open={showResolveDialog}
        onClose={() => setShowResolveDialog(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          color: 'white',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '6px',
                background: 'rgba(25, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'white',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  fontSize: '12px',
              }}
              >
                DR
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                DaVinci Resolve Project Creator
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
                {projectData?.name || 'Unnamed Project'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(100vh - 120px)',}}>
          <Box sx={{ height: '100%', overflow: 'auto',}}>
            <ResolveProjectCreator />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 2, borderTop: 1, borderColor: '#e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      }}>
          <Button 
            onClick={() => setShowResolveDialog(false)}
            sx={{
              color: '#647480','&:hover': {
                background: 'rgba(10, 116, 139, 0.08)',
              },
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={theming.getThemedIcon('autoFixHigh')}
            sx={{
              ...theming.getThemedButtonSx(),
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)','&:hover': {
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0, 58, 138, 0.4)',
              },
              boxShadow: '0 2px 8px rgba(0, 58, 138, 0.3)',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Generate Project Package
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ Video AI Enhancement Dialog */}
      <Dialog
        open={showVideoAIDialog}
        onClose={() => setShowVideoAIDialog(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
      >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY} 0%, #e67e00 100%)`,
          color: 'white',
          py:  2,
      }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Box
              sx={{
                width:  32,
                height:  32,
                borderRadius: '6px',
                background: 'rgba(25, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            >
              <AutoFixHigh sx={{ color: 'white',}} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                Video AI Enhancement Studio
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
                {projectData?.name || 'Story Arc Project'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(100vh - 120px)',}}>
          <Box sx={{ height: '100%', overflow: 'auto',}}>
            <VideoAIEnhancementPanel
              videoUrl={currentVideoUrl}
              onVideoProcessed={(processedVideo) => {
                console.log('Video processed:', processedVideo);
                showSuccessToast('Video enhancement completed!');
                setShowVideoAIDialog(false);
            }}
              onStoryArcAnalyzed={(analysis) => {
                console.log('Story arc analyzed:', analysis);
                showSuccessToast('Story arc analysis completed!');
                setStoryArcData(analysis);
            }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 2, borderTop: 1, borderColor: '#e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        }}
      >
          <Button
            onClick={() => setShowVideoAIDialog(false)}
            sx={{
              color: '#647480','&:hover': {
                background: 'rgba(10, 116, 139, 0.08)',
              },
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={theming.getThemedIcon('autoFixHigh')}
            sx={{
              ...theming.getThemedButtonSx(),
              background: `linear-gradient(135deg, ${CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY} 0%, #e67e00 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, #e67e00 0%, ${CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY} 100%)`,
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(20, 126, 0, 0.4)',
              },
              boxShadow: '0 2px 8px rgba(20, 126, 0, 0.3)',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Generate AI Enhancement
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ Script Manager Dialog */}
      {isScriptManagerEnabled && (
        <Dialog
          open={showScriptManager}
          onClose={() => setShowScriptManager(false)}
          maxWidth="xl"
          fullWidth
          fullScreen
        >
        <DialogTitle sx={{ 
          background: `linear-gradient(135deg, ${CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY} 0%, #e67e00 100%)`,
          color: 'white',
          py:  2,
      }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Box
              sx={{
                width:  32,
                height:  32,
                borderRadius: '6px',
                background: 'rgba(25, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            >
              <Code sx={{ color: 'white',}} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                DaVinci Resolve Script Manager
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(25, 255, 255, 0.8)' }}>
                Interactive installation guide and script management
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(100vh - 120px)',}}>
          <Box sx={{ height: '100%', overflow: 'auto',}}>
            <ScriptManager />
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          p: 2, borderTop: 1, borderColor: '#e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      }}>
          <Button 
            onClick={() => setShowScriptManager(false)}
            sx={{
              color: '#647480', '&:hover': {
                background:'rgba(10, 116, 139, 0.08)',
            },
          }}
          >
            Close
          </Button>
        </DialogActions>
        </Dialog>
      )}
      </Box>
    );
}
