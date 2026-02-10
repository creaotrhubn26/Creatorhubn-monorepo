/**
 * Workflow Executor Component
 * Executes predefined one-click workflows for different professions
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Grid,
  Stack,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert
} from '@mui/material';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Close,
  PlayArrow,
  CheckCircle,
  HourglassEmpty,
  Email,
  CloudUpload,
  Payment,
  PhotoLibrary,
  VideoLibrary,
  LibraryMusic,
  Business,
  AutoFixHigh,
  Share,
  Download,
  Favorite
} from '@mui/icons-material';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  icon?: React.ReactNode;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  profession: string;
  steps: Omit<WorkflowStep, 'status, '>[];
  estimatedTime: string;
  icon: React.ReactNode;
  color: string;
}

interface WorkflowExecutorProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  selectedItems: string[];
  onWorkflowComplete?: (workflowId: string) => void;
}

export const WorkflowExecutor: React.FC<WorkflowExecutorProps> = ({
  open,
  onClose,
  profession,
  selectedItems,
  onWorkflowComplete
}) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executing, setExecuting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = profession || professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';

  // Define workflows for each profession
  const photographerWorkflows: Workflow[] = [
    {
      id: 'wedding-complete',
      name: 'Wedding Complete Package',
      description: 'Create client proofing gallery, send email, and generate invoice',
      profession: 'photographer',
      estimatedTime: '2 min',
      color: '#FF6B35',
      icon: <Favorite />,
      steps: [
        { id: 'create-gallery', title: 'Create client proofing gallery', description: 'Setting up gallery with selected images', icon: <PhotoLibrary /> },
        { id: 'send-email', title: 'Send email with custom message', description: 'Sending personalized email to client', icon: <Email /> },
        { id: 'generate-invoice', title: 'Generate invoice for extras', description: 'Creating invoice for additional images', icon: <Payment /> },
        { id: 'set-deadline', title: 'Set deadline (7 days)', description: 'Configuring selection deadline', icon: <HourglassEmpty /> },
        { id: 'enable-protection', title: 'Enable download protection', description: 'Activating watermark and security', icon: <CheckCircle /> }
      ]
    },
    {
      id: 'social-media-blast',
      name: 'Social Media Blast',
      description: 'Select best images, crop for Instagram, watermark and export',
      profession: 'photographer',
      estimatedTime: '3 min',
      color: '#E74C3C',
      icon: <Share />,
      steps: [
        { id: 'ai-select', title: 'Select 9 best images (AI)', description: 'AI analyzing and selecting top images', icon: <AutoFixHigh /> },
        { id: 'crop-instagram', title: 'Apply Instagram crop (1:1)', description: 'Cropping to square format', icon: <PhotoLibrary /> },
        { id: 'watermark', title: 'Light watermark', description: 'Adding watermark', icon: <CheckCircle /> },
        { id: 'export', title: 'Export optimized', description: 'Exporting web-optimized images', icon: <Download /> },
        { id: 'captions', title: 'Generate caption suggestions', description: 'AI creating caption suggestions', icon: <Email /> }
      ]
    },
    {
      id: 'client-delivery',
      name: 'Client Delivery',
      description: 'Watermark, export, upload to Drive, and send delivery email',
      profession: 'photographer',
      estimatedTime: '4 min',
      color: '#4CAF50',
      icon: <CloudUpload />,
      steps: [
        { id: 'watermark', title: 'Watermark selected images', description: 'Applying professional watermark', icon: <CheckCircle /> },
        { id: 'export-highres', title: 'Export high-res', description: 'Exporting full resolution images', icon: <Download /> },
        { id: 'upload-drive', title: 'Upload to Google Drive folder', description: 'Uploading to client folder', icon: <CloudUpload /> },
        { id: 'send-email', title: 'Send delivery email', description: 'Notifying client of delivery', icon: <Email /> },
        { id: 'request-testimonial', title: 'Request testimonial', description: 'Sending testimonial request', icon: <Favorite /> }
      ]
    }
  ];

  const videographerWorkflows: Workflow[] = [
    {
      id: 'wedding-delivery',
      name: 'Wedding Delivery Package',
      description: 'Export all wedding video packages and send to client',
      profession: 'videographer',
      estimatedTime: '15 min',
      color: '#E74C3C',
      icon: <Favorite />,
      steps: [
        { id: 'export-highlight', title: 'Export Highlight Reel (3-5 min)', description: 'Rendering highlight video', icon: <VideoLibrary /> },
        { id: 'export-feature', title: 'Export Feature Film (20-30 min)', description: 'Rendering feature film', icon: <VideoLibrary /> },
        { id: 'export-ceremony', title: 'Export Ceremony Full', description: 'Rendering full ceremony', icon: <VideoLibrary /> },
        { id: 'export-speeches', title: 'Export Speeches', description: 'Rendering speeches', icon: <VideoLibrary /> },
        { id: 'upload-email', title: 'Upload to Drive and send email', description: 'Finalizing delivery', icon: <CloudUpload /> }
      ]
    },
    {
      id: 'social-media-kit',
      name: 'Social Media Kit',
      description: 'Export video in multiple formats for social platforms',
      profession: 'videographer',
      estimatedTime: '10 min',
      color: '#3498DB',
      icon: <Share />,
      steps: [
        { id: 'export-stories', title: 'Export 9:16 (Instagram Stories/Reels)', description: 'Rendering vertical format', icon: <VideoLibrary /> },
        { id: 'export-feed', title: 'Export 1:1 (Instagram Feed)', description: 'Rendering square format', icon: <VideoLibrary /> },
        { id: 'export-youtube', title: 'Export 16:9 (YouTube)', description: 'Rendering horizontal format', icon: <VideoLibrary /> },
        { id: 'thumbnails', title: 'Generate thumbnails', description: 'AI generating thumbnails', icon: <AutoFixHigh /> },
        { id: 'captions', title: 'Create caption templates', description: 'Generating caption suggestions', icon: <Email /> }
      ]
    },
    {
      id: 'client-review',
      name: 'Client Review Round',
      description: 'Set up client review with timecoded comments and deadline',
      profession: 'videographer',
      estimatedTime: '2 min',
      color: '#9B59B6',
      icon: <PlayArrow />,
      steps: [
        { id: 'set-version', title: 'Set version to R2', description: 'Updating version', icon: <CheckCircle /> },
        { id: 'enable-comments', title: 'Enable timecode comments', description: 'Activating comment system', icon: <CheckCircle /> },
        { id: 'send-link', title: 'Send review link to client', description: 'Sending secure review link', icon: <Email /> },
        { id: 'set-deadline', title: 'Set 3-day deadline', description: 'Configuring deadline', icon: <HourglassEmpty /> },
        { id: 'notify', title: 'Email notification on feedback', description: 'Setting up notifications', icon: <Email /> }
      ]
    }
  ];

  const musicProducerWorkflows: Workflow[] = [
    {
      id: 'client-preview',
      name: 'Client Preview Package',
      description: 'Create watermarked preview with shareable link',
      profession: 'music_producer',
      estimatedTime: '3 min',
      color: '#9B59B6',
      icon: <LibraryMusic />,
      steps: [
        { id: 'watermark', title: 'Apply demo watermark', description: 'Adding audio watermark', icon: <CheckCircle /> },
        { id: 'export-mp3', title: 'Export 128kbps MP3', description: 'Exporting preview quality', icon: <Download /> },
        { id: 'create-link', title: 'Create shareable link', description: 'Generating secure link', icon: <Share /> },
        { id: 'set-expiration', title: 'Set expiration (7 days)', description: 'Configuring expiration', icon: <HourglassEmpty /> },
        { id: 'analytics', title: 'Track listen analytics', description: 'Enabling analytics', icon: <CheckCircle /> }
      ]
    },
    {
      id: 'master-delivery',
      name: 'Master Delivery',
      description: 'Export masters, stems, and metadata for client',
      profession: 'music_producer',
      estimatedTime: '8 min',
      color: '#27AE60',
      icon: <CloudUpload />,
      steps: [
        { id: 'export-wav', title: 'Export WAV masters', description: 'Exporting lossless masters', icon: <LibraryMusic /> },
        { id: 'export-mp3', title: 'Export MP3 320kbps', description: 'Exporting high-quality MP3', icon: <LibraryMusic /> },
        { id: 'metadata', title: 'Apply metadata (ISRC, etc.)', description: 'Adding metadata tags', icon: <CheckCircle /> },
        { id: 'stems', title: 'Generate stems', description: 'Extracting individual stems', icon: <AutoFixHigh /> },
        { id: 'upload-invoice', title: 'Upload to Drive and invoice', description: 'Finalizing delivery', icon: <CloudUpload /> }
      ]
    }
  ];

  const vendorWorkflows: Workflow[] = [
    {
      id: 'product-publish',
      name: 'Product Publishing',
      description: 'Optimize images, set pricing, and publish to catalog',
      profession: 'vendor',
      estimatedTime: '2 min',
      color: '#3498DB',
      icon: <Business />,
      steps: [
        { id: 'optimize', title: 'Optimize product images', description: 'Compressing and optimizing', icon: <AutoFixHigh /> },
        { id: 'watermark', title: 'Add branding watermark', description: 'Adding company watermark', icon: <CheckCircle /> },
        { id: 'pricing', title: 'Set pricing tiers', description: 'Configuring pricing', icon: <Payment /> },
        { id: 'publish', title: 'Publish to catalog', description: 'Publishing products', icon: <CloudUpload /> },
        { id: 'notify', title: 'Notify subscribers', description: 'Sending notifications', icon: <Email /> }
      ]
    }
  ];

  // Get workflows based on profession
  const workflows = 
    profession === 'photographer' ? photographerWorkflows :
    profession === 'videographer' ? videographerWorkflows :
    profession === 'music_producer' ? musicProducerWorkflows :
    vendorWorkflows;

  // Execute workflow
  const executeWorkflow = async (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setExecuting(true);
    setCurrentStepIndex(0);
    
    // Initialize steps with pending status
    const initialSteps: WorkflowStep[] = workflow.steps.map(step => ({
      ...step,
      status: 'pending' as const
    }));
    setWorkflowSteps(initialSteps);

    // Execute each step
    for (let i = 0; i < workflow.steps.length; i++) {
      setCurrentStepIndex(i);
      
      // Update step to running
      setWorkflowSteps(prev => prev.map((step, idx) => 
        idx === i ? { ...step, status: 'running' as const } : step
      ));

      // Simulate step execution (replace with actual API calls)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update step to complete
      setWorkflowSteps(prev => prev.map((step, idx) => 
        idx === i ? { ...step, status: 'complete' as const } : step
      ));
    }

    setExecuting(false);
    onWorkflowComplete?.(workflow.id);
    
    // Auto-close after 2 seconds
    setTimeout(() => {
      onClose();
      setSelectedWorkflow(null);
      setWorkflowSteps([]);
    }, 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f1419',
          backgroundImage: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #2a1810 100%)',
          color: 'white',
          borderRadius: 3
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PlayArrow sx={{ fontSize: 32, color: '#4CAF50' }} />
          {professionIcon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: professionColor,
                fontSize: '1.5rem'
              }}
            >
              {professionIcon}
            </Box>
          )}
          <Box>
            <Typography variant="h5" fontWeight="700" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {enhancedProfessionConfig?.displayName ? `${enhancedProfessionConfig.displayName} Workflows` : 'One-Click Workflows'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {selectedItems.length} items selected
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {!selectedWorkflow ? (
          // Workflow Selection
          <Box>
            <Alert severity="info" sx={{ mb: 3, bgcolor: 'rgba(66, 133, 244, 0.1)', color: 'white' }}>
              Select a workflow to automate common tasks. All steps will execute automatically.
            </Alert>
            
            <Grid container spacing={2}>
              {workflows.map((workflow) => (
                <Grid item xs={12} sm={6} key={workflow.id}>
                  <Card 
                    sx={{ 
                      bgcolor: `${workflow.color}10`,
                      border: `2px solid ${workflow.color}40`,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        border: `2px solid ${workflow.color}`,
                        transform: 'translateY(-4px)',
                        boxShadow: `0 8px 25px ${workflow.color}40`
                      }
                    }}
                    onClick={() => executeWorkflow(workflow)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Box sx={{ 
                          color: workflow.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: `${workflow.color}20`
                        }}>
                          {workflow.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight="600" sx={{ color: workflow.color }}>
                            {workflow.name}
                          </Typography>
                          <Chip 
                            label={workflow.estimatedTime} 
                            size="small" 
                            sx={{ 
                              mt: 0.5,
                              height: 18,
                              bgcolor: `${workflow.color}20`,
                              color: workflow.color,
                              fontSize: '0.65rem'
                            }} 
                          />
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 2 }}>
                        {workflow.description}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {workflow.steps.length} steps
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : (
          // Workflow Execution
          <Box>
            <Box sx={{ 
              p: 2, 
              mb: 3, 
              bgcolor: `${selectedWorkflow.color}10`, 
              border: `1px solid ${selectedWorkflow.color}40`,
              borderRadius: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: selectedWorkflow.color, display: 'flex' }}>
                  {selectedWorkflow.icon}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="600" sx={{ color: selectedWorkflow.color }}>
                    {selectedWorkflow.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Executing {workflowSteps.filter(s => s.status === 'complete').length} of {workflowSteps.length} steps
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Progress Bar */}
            {executing && (
              <Box sx={{ mb: 3 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={(currentStepIndex / workflowSteps.length) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: selectedWorkflow.color,
                      borderRadius: 4
                    }
                  }}
                />
              </Box>
            )}

            {/* Stepper */}
            <Stepper activeStep={currentStepIndex} orientation="vertical">
              {workflowSteps.map((step, index) => (
                <Step key={step.id} expanded>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box sx={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 
                          step.status === 'complete' ? selectedWorkflow.color :
                          step.status === 'running' ? `${selectedWorkflow.color}80` :
                          'rgba(255,255,255,0.1)',
                        color: 'white'
                      }}>
                        {step.status === 'complete' ? (
                          <CheckCircle sx={{ fontSize: 18 }} />
                        ) : step.status === 'running' ? (
                          <HourglassEmpty sx={{ fontSize: 16 }} />
                        ) : (
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600}}>{index + 1}</Typography>
                        )}
                      </Box>
                    )}
                  >
                    <Typography sx={{ 
                      color: step.status === 'complete' ? selectedWorkflow.color : 
                             step.status === 'running' ? 'white' : 'rgba(255,255,255,0.5)',
                      fontWeight: tep.status === 'running' ? 600 : 400
                    }}>
                      {step.title}
                    </Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {step.description}
                    </Typography>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            {/* Success Message */}
            {!executing && workflowSteps.every(s => s.status === 'complete') && (
              <Alert severity="success" sx={{ mt: 3, bgcolor: 'rgba(76, 175, 80, 0.1)', color: 'white' }}>
                <Typography variant="body2" fontWeight="600">
                  ✅ Workflow completed successfully!
                </Typography>
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      {!selectedWorkflow && (
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={onClose} sx={{ color: 'white' }}>
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default WorkflowExecutor;

