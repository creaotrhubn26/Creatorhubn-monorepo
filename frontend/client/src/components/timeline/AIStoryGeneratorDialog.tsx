// @ts-nocheck
/**
 * AI STORY GENERATOR DIALOG
 * Upload video → AI analyzes → Auto-generates story arc → Creates timeline
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CloudUpload,
  AutoAwesome,
  Timeline as TimelineIcon,
  CheckCircle,
  Psychology,
  ArrowUpward,
  ArrowDownward,
  Lock,
  LockOpen,
  Refresh,
  Block,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  editStoryArcV2Script,
  evaluateStoryArcV2Quality,
  generateStoryArcV2Script,
  listStoryArcV2CulturalProfiles,
  planStoryArcV2Timeline,
  pollStoryArcV2AnalyzeJob,
  startStoryArcV2AnalyzeJob,
  type StoryArcV2CulturalProfile,
  type StoryArcV2CulturalProfileDescriptor,
  type StoryArcV2QualityScorecard,
  type StoryArcV2ScriptEditOperation,
  type StoryArcV2StoryScript,
} from '@/services/story-arc-v2-server';

interface AIStoryGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onStoryGenerated: (data: {
    scenes: any[];
    storyArc: any;
    timeline: any;
  }) => void;
}

interface StoryArcAnalyzeUiResult {
  analysisId: string;
  sceneCount: number;
  totalDuration: number;
  scenes: unknown[];
  warnings: string[];
}

const buildStoryArcPreview = (script: StoryArcV2StoryScript): Record<string, unknown> => ({
  id: `story-${script.scriptId}`,
  title: script.title,
  beats: script.nodes.map((node) => ({
    id: node.id,
    beat: node.beat,
    text: node.text,
    start: node.start,
    end: node.end,
    confidence: node.confidence,
    locked: node.locked,
  })),
  transitionPoints: script.nodes
    .slice(0, Math.max(0, script.nodes.length - 1))
    .map((node) => ({
      at: Number((node.start + node.duration).toFixed(3)),
      type: 'cross_dissolve',
  })),
});

const DEFAULT_MIXED_MODULES: StoryArcV2CulturalProfile[] = ['sikh', 'pakistani', 'norwegian'];

const FALLBACK_CULTURAL_PROFILES: StoryArcV2CulturalProfileDescriptor[] = [
  {
    profile: 'mixed',
    label: 'Mixed Wedding',
    mustIncludeDefaults: ['vows', 'ring exchange', 'speeches', 'family moments'],
    noCutEventTypes: ['vow', 'ring_exchange'],
    sacredEventTypes: ['vow'],
    minClipLenByEventType: { vow: 4, ring_exchange: 3.6 },
    pacing: {},
    eventTaxonomy: [],
  },
  {
    profile: 'sikh',
    label: 'Sikh',
    mustIncludeDefaults: ['anand karaj', 'laavan', 'ardaas', 'waheguru'],
    noCutEventTypes: ['vow', 'ring_exchange'],
    sacredEventTypes: ['vow'],
    minClipLenByEventType: { vow: 4.5 },
    pacing: {},
    eventTaxonomy: [],
  },
  {
    profile: 'pakistani',
    label: 'Pakistani',
    mustIncludeDefaults: ['nikah', 'qubool hai', 'rukhsati', 'walima'],
    noCutEventTypes: ['vow'],
    sacredEventTypes: ['vow'],
    minClipLenByEventType: { vow: 4.3 },
    pacing: {},
    eventTaxonomy: [],
  },
  {
    profile: 'norwegian',
    label: 'Norwegian',
    mustIncludeDefaults: ['vows', 'ring exchange', 'taler', 'første dans'],
    noCutEventTypes: ['vow', 'ring_exchange'],
    sacredEventTypes: ['vow', 'ring_exchange'],
    minClipLenByEventType: { vow: 3.8 },
    pacing: {},
    eventTaxonomy: [],
  },
  {
    profile: 'generic_wedding',
    label: 'Generic Wedding',
    mustIncludeDefaults: ['vows', 'ring exchange', 'kiss', 'speeches', 'first dance'],
    noCutEventTypes: ['vow', 'ring_exchange'],
    sacredEventTypes: ['vow', 'ring_exchange'],
    minClipLenByEventType: { vow: 4, ring_exchange: 3.8 },
    pacing: {},
    eventTaxonomy: [],
  },
];

const resolveCulturalModules = (
  profile: StoryArcV2CulturalProfile
): StoryArcV2CulturalProfile[] => {
  if (profile === 'mixed') {
    return DEFAULT_MIXED_MODULES;
  }
  if (profile === 'generic_wedding') {
    return [];
  }
  return [profile];
};

export default function AIStoryGeneratorDialog({
  open,
  onClose,
  onStoryGenerated
}: AIStoryGeneratorDialogProps) {
  const ANALYZE_JOB_STORAGE_KEY = 'storyarc-v2:last-analyze-job-id';
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [settings, setSettings] = useState({
    targetDuration: 300, // 5 minutes
    structure: '3-act' as '3-act' | '5-act',
    analysisSpeed: 'balanced' as 'fast' | 'balanced' | 'detailed',
    culturalProfile: 'mixed' as StoryArcV2CulturalProfile,
  });
  const [analysisResult, setAnalysisResult] = useState<StoryArcAnalyzeUiResult | null>(null);
  const [scriptDraft, setScriptDraft] = useState<StoryArcV2StoryScript | null>(null);
  const [serverStoryArcDraft, setServerStoryArcDraft] = useState<Record<string, unknown> | null>(null);
  const [scriptEditError, setScriptEditError] = useState<string | null>(null);
  const [qualityScorecard, setQualityScorecard] = useState<StoryArcV2QualityScorecard | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const culturalProfilesQuery = useQuery({
    queryKey: ['storyarc-v2-cultural-profiles'],
    queryFn: listStoryArcV2CulturalProfiles,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const culturalProfiles = culturalProfilesQuery.data && culturalProfilesQuery.data.length > 0
    ? culturalProfilesQuery.data
    : FALLBACK_CULTURAL_PROFILES;
  const selectedCulturalProfile =
    culturalProfiles.find((entry) => entry.profile === settings.culturalProfile) ||
    culturalProfiles[0] ||
    FALLBACK_CULTURAL_PROFILES[0];
  
  // Upload video
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);

      return await apiRequest('/api/video-analysis/upload-source', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      console.log('✅ Video uploaded: ', data);
      setScriptDraft(null);
      setServerStoryArcDraft(null);
      setScriptEditError(null);
      setQualityScorecard(null);
      setActiveStep(1);
      // Start analysis automatically
      const uploadedVideoPath =
        typeof data?.video_path === 'string'
          ? data.video_path
          : typeof data?.filePath === 'string'
            ? data.filePath
            : '';
      analyzeVideoMutation.mutate({ videoPath: uploadedVideoPath });
    }
  });
  
  // Analyze video with AI
  const analyzeVideoMutation = useMutation({
    mutationFn: async (input: { videoPath?: string; resumeJobId?: string }) => {
      if (input.resumeJobId) {
        return await pollStoryArcV2AnalyzeJob(input.resumeJobId, {
          intervalMs: 1500,
          timeoutMs: settings.analysisSpeed === 'detailed' ? 12 * 60 * 1000 : 8 * 60 * 1000,
        });
      }
      if (!input.videoPath) {
        throw new Error('Missing video path after upload');
      }
      const jobId = await startStoryArcV2AnalyzeJob({
        projectId: null,
        media: [
          {
            id: 'primary-video',
            type: 'video',
            path: input.videoPath,
          },
        ],
        intentProfileId: 'balanced-story',
        projectProfile: 'wedding',
        editingMode: 'highlight_music_sync',
        culturalProfile: settings.culturalProfile,
        culturalModules: resolveCulturalModules(settings.culturalProfile),
        mustIncludeMoments: selectedCulturalProfile?.mustIncludeDefaults || [],
      });
      try {
        window.localStorage.setItem(ANALYZE_JOB_STORAGE_KEY, jobId);
      } catch {
        // Ignore storage errors.
      }
      return await pollStoryArcV2AnalyzeJob(jobId, {
        intervalMs: 1500,
        timeoutMs: settings.analysisSpeed === 'detailed' ? 12 * 60 * 1000 : 8 * 60 * 1000,
      });
    },
    onSuccess: (data) => {
      console.log('✅ Video analyzed:', data.summary.sceneCount, 'scenes');
      try {
        window.localStorage.removeItem(ANALYZE_JOB_STORAGE_KEY);
      } catch {
        // Ignore storage errors.
      }
      const uiResult: StoryArcAnalyzeUiResult = {
        analysisId: data.analysisId,
        sceneCount: data.summary.sceneCount,
        totalDuration: data.summary.totalDuration,
        scenes: data.scenes,
        warnings: data.warnings,
      };
      setAnalysisResult(uiResult);
      setActiveStep(2);
      // Auto-generate story arc
      generateArcMutation.mutate(uiResult.analysisId);
    },
  });
  
  // Generate story arc
  const generateArcMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      return await generateStoryArcV2Script({
        analysisId,
        targetDuration: settings.targetDuration,
        styleProfile: {
          structure: settings.structure,
          analysisSpeed: settings.analysisSpeed,
          qualityTier: 'best',
        },
      });
    },
    onSuccess: (data) => {
      console.log('✅ Story arc generated:', data.storyArc.beats.length, 'beats');
      setScriptDraft(data.script);
      setServerStoryArcDraft(data.storyArc as Record<string, unknown>);
      setScriptEditError(null);
      setActiveStep(3);
    }
  });

  const editScriptMutation = useMutation({
    mutationFn: async (payload: {
      scriptId: string;
      operations: StoryArcV2ScriptEditOperation[];
    }) => {
      return await editStoryArcV2Script(payload);
    },
    onSuccess: (nextScript) => {
      setScriptDraft(nextScript);
      setScriptEditError(null);
    },
    onError: (error) => {
      setScriptEditError(error instanceof Error ? error.message : 'Failed to edit script');
    },
  });
  
  // Build timeline
  const buildTimelineMutation = useMutation({
    mutationFn: async (script: StoryArcV2StoryScript) => {
      const proposal = await planStoryArcV2Timeline({
        scriptId: script.scriptId,
        variant: 'balanced',
        constraints: {
          shotMin: 1.2,
          shotMax: 8,
          noOverlap: true,
          beatCoverageRequired: true,
        },
        musicPolicy: {
          mode: 'follow-energy',
          smoothTransitions: true,
        },
      });
      const selectedVariant = proposal.variants[proposal.selectedVariant] || proposal.variants.balanced;
      let quality: StoryArcV2QualityScorecard | null = null;
      try {
        quality = await evaluateStoryArcV2Quality({
          proposalId: proposal.proposalId,
        });
      } catch {
        quality = null;
      }
      const baseStoryArcPreview = buildStoryArcPreview(script);
      const mergedStoryArc = {
        ...(serverStoryArcDraft || {}),
        ...baseStoryArcPreview,
        events: Array.isArray((serverStoryArcDraft as { events?: unknown[] } | null)?.events)
          ? ((serverStoryArcDraft as { events?: unknown[] }).events || [])
          : [],
      };
      return {
        storyArc: mergedStoryArc,
        proposal,
        timeline: selectedVariant.timeline,
        clipCount: selectedVariant.timeline.clips.length,
        totalDuration: selectedVariant.timeline.totalDuration,
        qualityScorecard: quality,
      };
    },
    onSuccess: (data) => {
      console.log('✅ Timeline built:', data.clipCount, 'clips');
      setQualityScorecard(data.qualityScorecard || null);
      setActiveStep(4);
      
      // Return complete result to parent
      onStoryGenerated({
        scenes: analysisResult?.scenes || [],
        storyArc: data.storyArc,
        timeline: data.timeline
      });
    }
  });
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };
  
  const handleStartGeneration = () => {
    if (selectedFile) {
      setScriptDraft(null);
      setServerStoryArcDraft(null);
      setScriptEditError(null);
      setQualityScorecard(null);
      setAnalysisResult(null);
      try {
        window.localStorage.removeItem(ANALYZE_JOB_STORAGE_KEY);
      } catch {
        // Ignore storage errors.
      }
      uploadMutation.mutate(selectedFile);
    }
  };

  useEffect(() => {
    if (!open) {
      setResumeChecked(false);
      return;
    }
    if (resumeChecked || analyzeVideoMutation.isPending || analysisResult) return;

    setResumeChecked(true);
    try {
      const savedJobId = window.localStorage.getItem(ANALYZE_JOB_STORAGE_KEY);
      if (savedJobId) {
        setActiveStep(1);
        analyzeVideoMutation.mutate({ resumeJobId: savedJobId });
      }
    } catch {
      // Ignore storage errors.
    }
  }, [analysisResult, analyzeVideoMutation.isPending, open, resumeChecked]);

  const applyScriptOperations = (operations: StoryArcV2ScriptEditOperation[]) => {
    if (!scriptDraft || operations.length === 0 || editScriptMutation.isPending) return;
    setScriptEditError(null);
    editScriptMutation.mutate({
      scriptId: scriptDraft.scriptId,
      operations,
    });
  };

  const handleMoveNode = (index: number, direction: 'up' | 'down') => {
    if (!scriptDraft) return;
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    if (toIndex < 0 || toIndex >= scriptDraft.nodes.length) return;
    applyScriptOperations([
      {
        op: 'reorder',
        fromIndex: index,
        toIndex,
      },
    ]);
  };

  const handleBuildTimeline = () => {
    if (!scriptDraft || buildTimelineMutation.isPending) return;
    buildTimelineMutation.mutate(scriptDraft);
  };
  
  const steps = [
    {
      label: 'Upload Video',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload the raw video footage for AI analysis
          </Typography>
          
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="video-upload-input"
          />
          <label htmlFor="video-upload-input">
            <Button
              component="span"
              variant="outlined"
              startIcon={<CloudUpload />}
              fullWidth
              sx={{ mb: 2 }}
            >
              Select Video File
            </Button>
          </label>
          
          {selectedFile && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Selected:</strong> {selectedFile.name}
              </Typography>
              <Typography variant="caption">
                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
            </Alert>
          )}
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Target Duration</InputLabel>
            <Select
              value={settings.targetDuration}
              label="Target Duration"
              onChange={(e) => setSettings({ ...settings, targetDuration: Number(e.target.value) })}
            >
              <MenuItem value={180}>3 minutes (Short highlight)</MenuItem>
              <MenuItem value={300}>5 minutes (Standard)</MenuItem>
              <MenuItem value={600}>10 minutes (Extended)</MenuItem>
              <MenuItem value={900}>15 minutes (Full story)</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Story Structure</InputLabel>
            <Select
              value={settings.structure}
              label="Story Structure"
              onChange={(e) => setSettings({ ...settings, structure: e.target.value as any })}
            >
              <MenuItem value="3-act">3-Act (Setup, Confrontation, Resolution)</MenuItem>
              <MenuItem value="5-act">5-Act (Exposition, Rising, Climax, Falling, Denouement)</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Analysis Speed</InputLabel>
            <Select
              value={settings.analysisSpeed}
              label="Analysis Speed"
              onChange={(e) => setSettings({ ...settings, analysisSpeed: e.target.value as any })}
            >
              <MenuItem value="fast">Fast (0.5 fps - 2 min)</MenuItem>
              <MenuItem value="balanced">Balanced (1 fps - 5 min) ✅ Recommended</MenuItem>
              <MenuItem value="detailed">Detailed (2 fps - 10 min)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Cultural Profile</InputLabel>
            <Select
              value={settings.culturalProfile}
              label="Cultural Profile"
              onChange={(e) =>
                setSettings({
                  ...settings,
                  culturalProfile: e.target.value as StoryArcV2CulturalProfile,
                })
              }
            >
              {culturalProfiles.map((profile) => (
                <MenuItem key={profile.profile} value={profile.profile}>
                  {profile.label}
                  {profile.profile === 'mixed' ? ' (Recommended)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            onClick={handleStartGeneration}
            disabled={!selectedFile || uploadMutation.isPending}
            fullWidth
            startIcon={<AutoAwesome />}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4293 100%)'
              }
            }}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Generate Story with AI'}
          </Button>
        </Box>
      )
    },
    {
      label: 'AI Video Analysis',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            AI is analyzing your video...
          </Typography>
          
          {analyzeVideoMutation.isPending && (
            <>
              <LinearProgress sx={{ mb: 2 }} />
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" display="block">
                  🔍 Extracting frames...
                </Typography>
                <Typography variant="caption" display="block">
                  🤖 Analyzing with GPT-4 Vision...
                </Typography>
                <Typography variant="caption" display="block">
                  🎭 Detecting emotions, scenes, faces...
                </Typography>
                <Typography variant="caption" display="block">
                  💡 Scoring visual quality...
                </Typography>
              </Paper>
            </>
          )}
          
          {analysisResult && (
            <Alert severity="success">
              <Typography variant="body2">
                ✅ Analyzed {analysisResult.sceneCount} scenes in {Math.floor(analysisResult.totalDuration)}s of video
              </Typography>
            </Alert>
          )}
        </Box>
      )
    },
    {
      label: 'Story Arc Generation',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            AI is creating narrative structure...
          </Typography>
          
          {generateArcMutation.isPending && (
            <>
              <LinearProgress sx={{ mb: 2 }} />
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" display="block">
                  🎭 Detecting emotional beats...
                </Typography>
                <Typography variant="caption" display="block">
                  📖 Creating {settings.structure} structure...
                </Typography>
                <Typography variant="caption" display="block">
                  🎵 Planning music cues...
                </Typography>
                <Typography variant="caption" display="block">
                  ✂️ Determining transitions...
                </Typography>
              </Paper>
            </>
          )}
          
          {generateArcMutation.data && (
            <Alert severity="success">
              <Typography variant="body2">
                ✅ Generated {generateArcMutation.data.storyArc.beats.length} story beats
              </Typography>
            </Alert>
          )}
        </Box>
      )
    },
    {
      label: 'Script Review & Timeline Plan',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review and adjust beats before timeline planning.
          </Typography>

          {scriptEditError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {scriptEditError}
            </Alert>
          )}

          {editScriptMutation.isPending && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          {scriptDraft ? (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Script ready: {scriptDraft.nodes.length} beats, revision {scriptDraft.revision}
                </Typography>
              </Alert>

              <Paper sx={{ p: 1.5, mb: 2, maxHeight: 360, overflowY: 'auto' }}>
                <List dense>
                  {scriptDraft.nodes.map((node, index) => {
                    const primaryCandidate = node.candidateClipIds[0];
                    return (
                      <ListItem
                        key={node.id}
                        alignItems="flex-start"
                        sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 1 }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" color="primary" label={`${index + 1}. ${node.beat}`} />
                              <Chip
                                size="small"
                                variant="outlined"
                                color={node.locked ? 'success' : 'default'}
                                label={node.locked ? 'Locked' : 'Editable'}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {node.speaker || 'Unknown speaker'}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="body2">{node.text}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Candidate: {primaryCandidate || 'none'} • {node.duration.toFixed(1)}s
                              </Typography>
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 1 }}>
                          <Button
                            size="small"
                            startIcon={<ArrowUpward />}
                            disabled={index === 0 || editScriptMutation.isPending}
                            onClick={() => handleMoveNode(index, 'up')}
                          >
                            Up
                          </Button>
                          <Button
                            size="small"
                            startIcon={<ArrowDownward />}
                            disabled={index === scriptDraft.nodes.length - 1 || editScriptMutation.isPending}
                            onClick={() => handleMoveNode(index, 'down')}
                          >
                            Down
                          </Button>
                          <Button
                            size="small"
                            startIcon={node.locked ? <LockOpen /> : <Lock />}
                            disabled={editScriptMutation.isPending}
                            onClick={() =>
                              applyScriptOperations([
                                {
                                  op: 'lockNode',
                                  nodeId: node.id,
                                  locked: !node.locked,
                                },
                              ])
                            }
                          >
                            {node.locked ? 'Unlock' : 'Lock'}
                          </Button>
                          <Button
                            size="small"
                            startIcon={<Refresh />}
                            disabled={editScriptMutation.isPending || node.candidateClipIds.length < 2}
                            onClick={() =>
                              applyScriptOperations([
                                {
                                  op: 'regenerateNode',
                                  nodeId: node.id,
                                },
                              ])
                            }
                          >
                            Rotate
                          </Button>
                          <Button
                            size="small"
                            color="success"
                            startIcon={<CheckCircle />}
                            disabled={editScriptMutation.isPending}
                            onClick={() =>
                              applyScriptOperations([
                                {
                                  op: 'approveNode',
                                  nodeId: node.id,
                                  clipId: primaryCandidate,
                                  reason: 'Approved in Story Arc script review',
                                },
                              ])
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<Block />}
                            disabled={editScriptMutation.isPending || !primaryCandidate}
                            onClick={() =>
                              primaryCandidate
                                ? applyScriptOperations([
                                    {
                                      op: 'banClip',
                                      nodeId: node.id,
                                      clipId: primaryCandidate,
                                      reason: 'Rejected in Story Arc script review',
                                    },
                                  ])
                                : undefined
                            }
                          >
                            Ban
                          </Button>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>

              <Button
                variant="contained"
                onClick={handleBuildTimeline}
                disabled={buildTimelineMutation.isPending || editScriptMutation.isPending}
                fullWidth
                startIcon={<TimelineIcon />}
                sx={{ mb: 2 }}
              >
                {buildTimelineMutation.isPending ? 'Building Timeline...' : 'Build Timeline from Script'}
              </Button>
            </>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Waiting for script generation...
            </Alert>
          )}

          {buildTimelineMutation.isPending && (
            <>
              <LinearProgress sx={{ mb: 2 }} />
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="caption" display="block">
                  🎬 Selecting best clips...
                </Typography>
                <Typography variant="caption" display="block">
                  ⏱️ Arranging in timeline...
                </Typography>
                <Typography variant="caption" display="block">
                  🎭 Optimizing pacing...
                </Typography>
                <Typography variant="caption" display="block">
                  🎵 Syncing to emotional beats...
                </Typography>
              </Paper>
            </>
          )}

          {buildTimelineMutation.data && (
            <Alert severity="success">
              <Typography variant="body2" gutterBottom>
                ✅ Timeline created with {buildTimelineMutation.data.clipCount} clips
              </Typography>
              <Typography variant="caption">
                Total duration: {Math.floor(buildTimelineMutation.data.totalDuration / 60)}m {Math.floor(buildTimelineMutation.data.totalDuration % 60)}s
              </Typography>
            </Alert>
          )}
        </Box>
      )
    },
    {
      label: 'Complete',
      content: (
        <Box>
          <Alert severity="success" icon={<AutoAwesome />} sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              🎉 AI Story Generation Complete!
            </Typography>
            <Typography variant="body2">
              Your video has been automatically analyzed, story arc created, and timeline arranged!
            </Typography>
          </Alert>
          
          {qualityScorecard && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                Quality Scorecard
              </Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Overall: {(qualityScorecard.overallScore * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption" display="block">
                Beat coverage: {(qualityScorecard.metrics.beatCoverage * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption" display="block">
                Technical compliance: {(qualityScorecard.metrics.technicalCompliance * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption" display="block">
                Explainability coverage: {(qualityScorecard.metrics.explainabilityCoverage * 100).toFixed(1)}%
              </Typography>
              <Typography variant="caption" display="block">
                Feedback alignment: {(qualityScorecard.metrics.feedbackAlignment * 100).toFixed(1)}%
              </Typography>
            </Paper>
          )}

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              📊 Generation Summary:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${analysisResult?.sceneCount || 0} scenes detected`}
                  secondary="AI analyzed video content"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Psychology color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${generateArcMutation.data?.storyArc?.beats?.length || 0} story beats`}
                  secondary={`${settings.structure} narrative structure`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <TimelineIcon color="secondary" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${buildTimelineMutation.data?.clipCount || 0} clips arranged`}
                  secondary="Auto-arranged in timeline"
                />
              </ListItem>
            </List>
          </Paper>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              💡 The timeline is now loaded in the editor. You can further edit, trim, or rearrange clips as needed!
            </Typography>
          </Alert>
          
          <Button onClick={onClose} variant="contained" fullWidth>
            Open in Editor
          </Button>
        </Box>
      )
    }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems:'center', gap: 2 }}>
          <AutoAwesome />
          <Box>
            <Typography variant="h6">AI Story Generator</Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Upload video → AI creates story arc → Auto-builds timeline
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight={600}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                {step.content}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>
      
      {activeStep === 0 && (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
        </DialogActions>
      )}
      
      {activeStep === 4 && (
        <DialogActions>
          <Button onClick={() => {
            setActiveStep(0);
            setSelectedFile(null);
            setAnalysisResult(null);
            setScriptDraft(null);
            setScriptEditError(null);
            setQualityScorecard(null);
          }}>
            Generate Another
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
