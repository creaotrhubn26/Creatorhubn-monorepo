/**
 * Video Generation Workflow Modal
 *
 * Unified modal orchestrating: * Journey → Video Generation → StoryArc Editing → Analysis → Journey Update
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Divider,
} from '@mui/material';
import {
  MovieCreation,
  SmartDisplay,
  Analytics,
  CheckCircle,
  ArrowForward,
  Close,
  VideoLibrary,
} from '@mui/icons-material';
import AIVideoGenerator from './AIVideoGenerator';
import { AdminButton, StatusChip, useIsMobile } from './design-system';
import { useVideoJourneyBridge } from '@/hooks/useVideoJourneyBridge';
import { useNavigate } from 'react-router-dom';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface WorkflowStep {
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface GeneratedVideoResult {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  cost?: number;
  metadata?: unknown;
  error?: string;
}

interface VideoGenerationWorkflowModalProps {
  open: boolean;
  onClose: () => void;
  journeyId: string;
  stepId: string;
  initialPrompt?: string;
  onComplete?: (result: {
    videoUrl: string;
    analysisData?: any;
    storyArcProjectId?: string;
  }) => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function VideoGenerationWorkflowModal({
  open,
  onClose,
  journeyId,
  stepId,
  initialPrompt = '',
  onComplete,
}: VideoGenerationWorkflowModalProps) {
  const navigate = useNavigate();
  const videoJourneyBridge = useVideoJourneyBridge();
  const isMobile = useIsMobile();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const [activeStep, setActiveStep] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideoResult | null>(null);
  const [analysisData, setAnalysisData] = useState<unknown>(null);
  const [storyArcProjectId, setStoryArcProjectId] = useState<string | null>(null);
  const [showVideoGenerator, setShowVideoGenerator] = useState(false);

  const steps: WorkflowStep[] = [
    {
      label: 'Generate Video',
      description: 'Create AI video from journey step',
      status: activeStep === 0 ? 'active' : activeStep > 0 ? 'completed' : 'pending',
    },
    {
      label: 'Edit in StoryArc',
      description: 'Refine video in StoryArc Studio',
      status: activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : 'pending',
    },
    {
      label: 'AI Analysis',
      description: 'Analyze video quality & metrics',
      status: activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : 'pending',
    },
    {
      label: 'Update Journey',
      description: 'Link results back to journey',
      status: activeStep === 3 ? 'active' : activeStep > 3 ? 'completed' : 'pending',
    },
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EFFECTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Listen for workflow events
  useEffect(() => {
    if (!open) return;

    // Reset when opened
    setActiveStep(0);
    setGeneratedVideo(null);
    setAnalysisData(null);
    setStoryArcProjectId(null);
    setShowVideoGenerator(true);
  }, [open]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleVideoGenerated = (result: GeneratedVideoResult) => {
    setGeneratedVideo(result);
    setShowVideoGenerator(false);
    setActiveStep(1);

    // Notify bridge
    videoJourneyBridge.requestVideoGeneration({
      source: 'customer-journey',
      journeyId,
      journeyStepId: stepId,
      prompt: initialPrompt,
    });
  };

  const handleOpenStoryArc = () => {
    if (!generatedVideo?.videoUrl) return;

    // Send video to StoryArc Studio
    videoJourneyBridge.openInStoryArc(
      {
        id: generatedVideo.id,
        videoUrl: generatedVideo.videoUrl,
        thumbnailUrl: generatedVideo.thumbnailUrl,
        duration: generatedVideo.duration ?? 0,
        cost: generatedVideo.cost,
        metadata: generatedVideo.metadata ?? {},
      },
      {
      journeyId,
      stepId,
      },
    );

    // Navigate to StoryArc Studio
    navigate('/storyarc-studio', {
      state: {
        videoUrl: generatedVideo.videoUrl,
        videoId: generatedVideo.id,
        linkedJourneyId: journeyId,
        linkedStepId: stepId,
      },
    });

    // Close modal - user will return when done editing
    onClose();
  };

  const handleSkipStoryArc = () => {
    setActiveStep(2);
    // Trigger analysis
    if (generatedVideo?.videoUrl) {
      videoJourneyBridge.triggerVideoAnalysis(generatedVideo.videoUrl, {
        journeyId,
        stepId,
        videoId: generatedVideo.id,
      });
    }
  };

  const handleAnalysisComplete = (data: unknown) => {
    setAnalysisData(data);
    setActiveStep(3);
  };

  const handleComplete = () => {
    if (onComplete && generatedVideo?.videoUrl) {
      onComplete({
        videoUrl: generatedVideo.videoUrl,
        analysisData,
        storyArcProjectId: storyArcProjectId || undefined,
      });
    }
    onClose();
  };

  const getStepIcon = (index: number) => {
    const icons = [MovieCreation, SmartDisplay, Analytics, CheckCircle];
    const Icon = icons[index];
    return <Icon />;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <VideoLibrary color="primary" />
              <Typography variant="h6">Video Generation Workflow</Typography>
            </Box>
            <IconButton onClick={onClose} size="small" aria-label="Lukk">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ py: 2 }}>
            {/* Progress Indicator */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Journey-to-Video Workflow:</strong> This guided process will help you
                generate, refine, analyze, and integrate video content into your customer journey.
              </Typography>
            </Alert>

            {/* Stepper */}
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: step.status === 'completed'
                              ? 'success.main'
                              : step.status === 'active'
                                ? 'primary.main'
                                : 'grey.300',
                          color: step.status === 'pending' ? 'grey.700' : 'white'}}>
                        {getStepIcon(index)}
                      </Box>
                    )}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      {step.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                  </StepLabel>

                  <StepContent>
                    <Box sx={{ pl: 5, pr: 2, pb: 2 }}>
                      {/* Step 0: Generate Video */}
                      {index === 0 && (
                        <Card variant="outlined">
                          <CardContent>
                            {!generatedVideo ? (
                              <Stack spacing={2}>
                                <Typography variant="body2">
                                  Click the button below to open the AI Video Generator. Create a
                                  video based on your journey step content.
                                </Typography>
                                <AdminButton
                                  tone="primary"
                                  startIcon={<MovieCreation />}
                                  onClick={() => setShowVideoGenerator(true)}
                                >
                                  Open Video Generator
                                </AdminButton>
                              </Stack>
                            ) : (
                              <Stack spacing={2}>
                                <Alert severity="success" icon={<CheckCircle />}>
                                  Video generated successfully!
                                </Alert>
                                <video
                                  src={generatedVideo.videoUrl}
                                  controls
                                  aria-label="Generert video – forhåndsvisning"
                                  style={{ width: '100%', maxHeight: 300, borderRadius: 8 }} />
                                <AdminButton
                                  tone="primary"
                                  endIcon={<ArrowForward />}
                                  onClick={() => setActiveStep(1)}
                                >
                                  Next: Edit in StoryArc
                                </AdminButton>
                              </Stack>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Step 1: Edit in StoryArc */}
                      {index === 1 && generatedVideo && (
                        <Card variant="outlined">
                          <CardContent>
                            <Stack spacing={2}>
                              <Typography variant="body2">
                                Refine your video in StoryArc Studio with professional editing
                                tools, transitions, color grading, and more.
                              </Typography>
                              <Stack direction="row" spacing={2}>
                                <AdminButton
                                  tone="primary"
                                  startIcon={<SmartDisplay />}
                                  onClick={handleOpenStoryArc}
                                >
                                  Open in StoryArc Studio
                                </AdminButton>
                                <AdminButton tone="ghost" onClick={handleSkipStoryArc}>
                                  Skip Editing
                                </AdminButton>
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                Note: You'll be navigated to StoryArc Studio. Return here when done
                                editing.
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      )}

                      {/* Step 2: AI Analysis */}
                      {index === 2 && (
                        <Card variant="outlined">
                          <CardContent>
                            <Stack spacing={2}>
                              {!analysisData ? (
                                <>
                                  <Stack direction="row" spacing={2} alignItems="center">
                                    <CircularProgress size={24} />
                                    <Typography variant="body2">
                                      Analyzing video quality, pacing, and engagement metrics...
                                    </Typography>
                                  </Stack>
                                  <AdminButton
                                    tone="ghost"
                                    onClick={() => handleAnalysisComplete({})}
                                  >
                                    Skip Analysis
                                  </AdminButton>
                                </>
                              ) : (
                                <>
                                  <Alert severity="success">Analysis complete!</Alert>
                                  <Stack direction="row" spacing={1} flexWrap="wrap">
                                    <StatusChip tone="success" label="Quality: 87%" />
                                    <StatusChip tone="success" label="Pacing: Good" />
                                    <StatusChip tone="neutral" label="5 Scenes" />
                                  </Stack>
                                  <AdminButton
                                    tone="primary"
                                    onClick={() => setActiveStep(3)}
                                    endIcon={<ArrowForward />}
                                  >
                                    Next: Update Journey
                                  </AdminButton>
                                </>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      )}

                      {/* Step 3: Update Journey */}
                      {index === 3 && (
                        <Card variant="outlined">
                          <CardContent>
                            <Stack spacing={2}>
                              <Alert severity="success" icon={<CheckCircle />}>
                                Workflow complete! Your video is ready to be linked to the journey
                                step.
                              </Alert>
                              <Typography variant="body2">
                                The video, analysis data, and any StoryArc edits will be
                                automatically synced to your customer journey.
                              </Typography>
                              <AdminButton
                                tone="primary"
                                onClick={handleComplete}
                                startIcon={<CheckCircle />}
                              >
                                Complete & Update Journey
                              </AdminButton>
                            </Stack>
                          </CardContent>
                        </Card>
                      )}
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </Box>
        </DialogContent>
      </Dialog>

      {/* AI Video Generator Modal */}
      <AIVideoGenerator
        open={showVideoGenerator}
        onClose={() => setShowVideoGenerator(false)}
        initialPrompt={initialPrompt}
        onVideoGenerated={handleVideoGenerated}
      />
    </>
  );
}
