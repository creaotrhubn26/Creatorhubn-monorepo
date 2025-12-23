/**
 * AI STORY GENERATOR DIALOG
 * Upload video → AI analyzes → Auto-generates story arc → Creates timeline
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
  TextField
} from '@mui/material';
import {
  CloudUpload,
  AutoAwesome,
  Movie,
  Timeline as TimelineIcon,
  CheckCircle,
  Psychology
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AIStoryGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  onStoryGenerated: (data: {
    scenes: any[];
    storyArc: any;
    timeline: any;
  }) => void;
}

export default function AIStoryGeneratorDialog({
  open,
  onClose,
  onStoryGenerated
}: AIStoryGeneratorDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [settings, setSettings] = useState({
    targetDuration: 300, // 5 minutes
    structure: '3-act' as '3-act' | '5-act',
    analysisSpeed: 'balanced' as 'fast' | 'balanced' | 'detailed'
  });
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  
  // Upload video
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData
      });
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Video uploaded: ', data);
      setActiveStep(1);
      // Start analysis automatically
      analyzeVideoMutation.mutate(data.filePath);
    }
  });
  
  // Analyze video with AI
  const analyzeVideoMutation = useMutation({
    mutationFn: async (videoPath: string) => {
      const fps = settings.analysisSpeed === 'fast' ? 0.5 : 
                  settings.analysisSpeed === 'detailed' ? 2 : 1;
      
      return await apiRequest('/api/ai-story/analyze-video', {
        method: 'POST',
        body: JSON.stringify({ videoPath, fps })
      });
    },
    onSuccess: (data) => {
      console.log('✅ Video analyzed:', data.sceneCount, 'scenes');
      setAnalysisResult(data);
      setActiveStep(2);
      // Auto-generate story arc
      generateArcMutation.mutate(data.scenes);
    }
  });
  
  // Generate story arc
  const generateArcMutation = useMutation({
    mutationFn: async (scenes: any[]) => {
      return await apiRequest('/api/ai-story/generate-arc', {
        method: 'POST',
        body: JSON.stringify({
          scenes,
          targetDuration: settings.targetDuration,
          structure: settings.structure
        })
      });
    },
    onSuccess: (data) => {
      console.log('✅ Story arc generated:', data.storyArc.beats.length, 'beats');
      setActiveStep(3);
      // Auto-build timeline
      buildTimelineMutation.mutate({
        storyArc: data.storyArc,
        scenes: analysisResult.scenes
      });
    }
  });
  
  // Build timeline
  const buildTimelineMutation = useMutation({
    mutationFn: async ({ storyArc, scenes }: any) => {
      return await apiRequest('/api/ai-story/build-timeline', {
        method: 'POST',
        body: JSON.stringify({
          storyArc,
          scenes,
          videoPath: (uploadMutation.data as any)?.filePath
        })
      });
    },
    onSuccess: (data) => {
      console.log('✅ Timeline built:', data.clipCount, 'clips');
      setActiveStep(4);
      
      // Return complete result to parent
      onStoryGenerated({
        scenes: analysisResult.scenes,
        storyArc: generateArcMutation.data?.storyArc,
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
      uploadMutation.mutate(selectedFile);
    }
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
      label: 'Auto-Timeline Building',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            AI is arranging clips into timeline...
          </Typography>
          
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
          {steps.map((step, index) => (
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
          }}>
            Generate Another
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}


