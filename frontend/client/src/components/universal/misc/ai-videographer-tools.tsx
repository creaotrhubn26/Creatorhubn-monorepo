import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  SmartToy,
  CameraAlt,
  VideoLibrary,
  AutoFixHigh,
  ColorLens,
  Speed as Speed,
  PlayArrow,
  Stop,
  Download,
  Refresh,
} from '@mui/icons-material';

interface AiTool {
  id: string;
  name: string;
  description: string;
  category: 'editing' | 'color' | 'audio' | 'effects' | 'analysis' | 'automation';
  icon: React.ReactNode;
  isActive: boolean;
  processingTime: number;
  confidence: number;
  lastUsed?: string
}

interface AiVideographerToolsProps {
  projectId?: string;
  onToolActivated?: (tool: AiTool) => void;
  onToolResult?: (tool: AiTool, result: any) => void
}

export default function AiVideographerTools({ 
  projectId,
  onToolActivated,
  onToolResult 
}: AiVideographerToolsProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [activeTool, setActiveTool] = useState<AiTool | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // AI Tools configuration
  const aiTools: AiTool[] = [
    {
      id: 'auto-color-grading',
      name: 'Auto Color Grading',
      description: 'AI-powered color correction and grading for consistent look',
      category: 'color',
      icon: <ColorLens />,
      isActive: false,
      processingTime:  30,
      confidence: 0.85 },
    {
      id: 'smart-cuts',
      name: 'Smart Cut Detection',
      description: 'Automatically detect and suggest optimal cut points',
      category: 'editing',
      icon: <AutoFixHigh />,
      isActive: false,
      processingTime:  15,
      confidence: 0.92 },
    {
      id: 'audio-enhancement',
      name: 'Audio Enhancement',
      description: 'AI noise reduction and audio quality improvement',
      category: 'audio',
      icon: <SmartToy />,
      isActive: false,
      processingTime:  45,
      confidence: 0.78 },
    {
      id: 'motion-stabilization',
      name: 'Motion Stabilization',
      description: 'Automatically stabilize shaky footage',
      category: 'effects',
      icon: <CameraAlt />,
      isActive: false,
      processingTime:  60,
      confidence: 0.88 },
    {
      id: 'scene-analysis',
      name: 'Scene Analysis',
      description: 'Analyze scenes for composition, lighting, and quality',
      category: 'analysis',
      icon: <VideoLibrary />,
      isActive: false,
      processingTime:  20,
      confidence: 0.91 },
    {
      id: 'auto-subtitles',
      name: 'Auto Subtitle Generation',
      description: 'Generate accurate subtitles with timing',
      category: 'automation',
      icon: <Speed />,
      isActive: false,
      processingTime:  25,
      confidence: 0.82 }
  ];

  // Process AI tool
  const processAiTool = useMutation({
    mutationFn: async (tool: AiTool) => {
      return apiRequest(`/api/ai-tools/${tool.id}/process`, {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify({ 
          projectId,
          toolId: tool.id,
          parameters: {
            confidence: tool.confidence,
            processingTime: tool.processingTime
          }
        })
      });
    },
    onSuccess: (data) => {
      onToolResult?.(activeTool!, data);
      setIsProcessing(false);
      setActiveTool(null);
  },
    onError: () => {
      setIsProcessing(false);
      setActiveTool(null);
}
});

  const handleToolActivation = useCallback(async (tool: AiTool) => {
    setActiveTool(tool);
    setIsProcessing(true);
    onToolActivated?.(tool);
    
    try {
      await processAiTool.mutateAsync(tool);
} catch (error) {
      console.error('Failed to process AI tool: ', error);
  }
}, [processAiTool, onToolActivated]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'editing': return 'primary';
      case 'color': return 'secondary';
      case 'audio': return 'success';
      case 'effects': return 'warning';
      case 'analysis': return 'info';
      case 'automation': return 'default';
      default: return 'default';
}
};

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.8) return 'warning';
    return 'error';
};

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Excellent';
    if (confidence >= 0.8) return 'Good';
    return 'Fair';
};

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <SmartToy color="primary" />
          AI Videographer Tools
        </Typography>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={() => {
            // Refresh all tools
            queryClient.invalidateQueries({ queryKey: ["/api/ai-tools", ],});
        }}
        >
          Refresh
        </Button>
      </Box>

      {/* Processing Status */}
      {isProcessing && activeTool && (
        <Alert severity="info" sx={{ mb:  3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">
              Processing {activeTool.name}... This may take up to {activeTool.processingTime} seconds.
            </Typography>
          </Box>
        </Alert>
      )}

      {/* AI Tools Grid */}
      <Grid container spacing={3}>
        {aiTools.map((tool) => (
          <Grid item xs={12} sm={6} md={4} key={tool.id}>
            <Card 
              sx={{ 
                height: '100%',
                cursor: 'pointer', '&:hover': { 
                  transform: 'translateY(-4px)',
                  boxShadow: 4 },
                transition: 'all 0.2s ease-in-out',
                opacity: isProcessing && activeTool?.id !== tool.id ? 0.6 : 1 }}
              onClick={() => !isProcessing && handleToolActivation(tool)}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    <Box sx={{ 
                      p: 1, borderRadius: 1
                     , bgcolor: `${getCategoryColor(tool.category)}.light`,
                      color: `${getCategoryColor(tool.category)}.contrastText`
                  }}>
                      {tool.icon}
                    </Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {tool.name}
                    </Typography>
                  </Box>
                  <Chip 
                    label={tool.category} 
                    size="small" 
                    color={getCategoryColor(tool.category) as any}
                    variant="outlined"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {tool.description}
                </Typography>

                {/* Stats */}
                <Stack direction="row" spacing={2} sx={{ mb:  2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Processing Time
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {tool.processingTime}s
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Confidence
                    </Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold"
                      color={`${getConfidenceColor(tool.confidence)}.main`}
                    >
                      {getConfidenceLabel(tool.confidence)}
                    </Typography>
                  </Box>
                </Stack>

                {/* Action Button */}
                <Button fullWidth
                  variant="contained"
                  startIcon={isProcessing && activeTool?.id === tool.id ? theming.getThemedIcon('stop') : theming.getThemedIcon('play')}
                  disabled={isProcessing}
                  sx={{
                    bgcolor: `${getCategoryColor(tool.category)}.main`, '&:hover': {
                      bgcolor: `${getCategoryColor(tool.category)}.dark`
                  }
                }}
                 sx={theming.getThemedButtonSx()}>
                  {isProcessing && activeTool?.id === tool.id ? 'Processing...' : 'Activate Tool'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* AI Tools Status */}
      <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            AI Tools Status
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  {aiTools.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Tools
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  {Math.round(aiTools.reduce((acc, tool) => acc + tool.confidence, 0) / aiTools.length * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Average Confidence
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center'}}>
                <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                  {Math.round(aiTools.reduce((acc, tool) => acc + tool.processingTime, 0) / aiTools.length)}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Processing Time
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign:'center'}}>
                <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                  {aiTools.filter(tool => tool.isActive).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Tools
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
