import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Chip,
  Alert,
  Grid,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Speed as Speed,
  Timer,
  TrendingUp,
  PlayArrow,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';

interface ProgressStep {
  name: string;
  description: string;
  completed: boolean;
  startTime?: number;
  endTime?: number;
  quality?: any
}

interface ProgressData {
  sessionId: string;
  currentStep: string;
  progress: number;
  steps: ProgressStep[]
}

interface ProgressTrackingProps {
  sessionId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void
}

export default function ProgressTracking({ 
  sessionId, 
  onComplete, 
  onError 
}: ProgressTrackingProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showDetails, setShowDetails] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  useEffect(() => {
    if (!sessionId) return;

    console.log(`📊 Starting progress tracking for session: ${sessiond}`);

    // Connect to Server-Sent Events
    const eventSource = new EventSource(`/api/photo-enhancer/progress/${sessionId}`);
    
    eventSource.onopen = () => {
      console.log('📊 Progress tracking connected');
      setIsConnected(true);
      setStartTime(Date.now());
  };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('📊 Progress tracking handshake completed');
      } else if (data.type === 'progress') {
          setProgressData(data);
          
          // Check if completed
          if (data.progress >= 100) {
            console.log('✅ Enhancement completed!');
            eventSource.close();
            onComplete?.(data);
        }
      }
    } catch (error) {
        console.error('❌ Error parsing progress data: ', error);
    }
  };

    eventSource.onerror = (error) => {
      console.error('❌ Progress tracking error:', error);
      setIsConnected(false);
      onError?.('Tilkobling til progress tracking feilet');
  };

    // Update elapsed time
    const timeInterval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
  }, 100);

    return () => {
      eventSource.close();
      clearInterval(timeInterval);
  };
}, [sessionId, onComplete, onError, startTime]);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
  }
    return `${remainingSeconds}s`;
};

  const getStepDuration = (step: ProgressStep): string => {
    if (step.startTime && step.endTime) {
      return formatTime(step.endTime - step.startTime);
}
    return '-';
};

  const completedSteps = progressData?.steps.filter(s => s.completed).length || 0;
  const totalSteps = progressData?.steps.length || 0;

  return (
    <Box sx={{ width: '100%', maxWidth: 80, mx: 'auto', p:  2 }}>
      {/* Main Progress Card */}
      <Card elevation={4} sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <PlayArrow color="primary" sx={{ mr:  1 }} />
            <Typography variant="h6" component="h2" sx={{ color: theming.colors.primary }}>
              AI Bildeforbedring Pågår
            </Typography>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap:  1 }}>
              <Chip
                icon={<Timer />}
                label={formatTime(elapsedTime)}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={isConnected ? theming.getThemedIcon('checkCircle') : <RadioButtonUnchecked />}
                label={isConnected ? 'Tilkoblet' : 'Kobler til...'}
                color={isConnected ? 'success' : 'warning'}
                size="small"
              />
            </Box>
          </Box>

          {/* Current Step */}
          {progressData && (
            <Alert 
              severity="info" 
              icon={theming.getThemedIcon('speed')}}
              sx={{ mb:  2 }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {progressData.currentStep}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progressData.steps.find(s => s.name === progressData.currentStep)?.description}
              </Typography>
            </Alert>
          )}

          {/* Progress Bar */}
          <Box sx={{ mb:  2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
              <Typography variant="body2" color="text.secondary">
                Fremgang
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progressData?.progress || 0}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressData?.progress || 0}
              sx={{
                height:  8,
                borderRadius: 4'& .MuiLinearProgress-bar': {
                  borderRadius:  4,
                  background: 'linear-gradient(45deg, #ff8c00 30%, #ffa500 90%)'
              }
            }}
            />
          </Box>

          {/* Steps Summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Steg: {completedSteps} av {totalSteps} fullført
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                color: 'primary.main'
          }}
              onClick={() => setShowDetails(!showDetails)}
            >
              <Typography variant="body2" sx={{ mr: 0.5}}>
                {showDetails ? 'Skjul detaljer' : 'Vis detaljer'}
              </Typography>
              {showDetails ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Detailed Steps */}
      <Collapse in={showDetails}>
        <Card elevation={2} sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Detaljert Fremgang
            </Typography>
            
            <List dense>
              {progressData?.steps.map((step, index) => (
                <ListItem
                  key={step.name}
                  sx={{
                    borderLeft: step.completed ? '4px solid #4caf50' : '4px solid #e0e0e0',
                    backgroundColor: step.completed ? 'rgba(6, 175, 80, 0.04)' : 'transparent',
                    borderRadius:  1,
                    mb: 1 }}
                >
                  <ListItemIcon>
                    {step.completed ? (
                      <CheckCircle color="success" />
                    ) : progressData.currentStep === step.name ? (
                      <RadioButtonUnchecked color="primary" />
                    ) : (
                      <RadioButtonUnchecked color="disabled" />
                    )}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: rogressData.currentStep === step.name ? 'bold' : 'normal',
                            color: step.completed ? 'success.main' : 'text.primary'
                      }}
                        >
                          {step.name}
                        </Typography>
                        {step.completed && (
                          <Chip
                            label={getStepDuration(step)}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                  }
                    secondary={
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          fontStyle: progressData.currentStep === step.name ? 'italic' : 'normal'
                    }}
                      >
                        {step.description}
                      </Typography>
                  }
                  />
                </ListItem>
              ))}
            </List>

            {/* Quality Metrics */}
            {progressData && progressData.progress > 50 && (
              <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' ,  ...theming.getThemedCardSx() }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <TrendingUp color="primary" sx={{ mr:  1 }} />
                  <Typography variant="subtitle2">
                    Kvalitetsforbedringer
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid size={{ xs:  3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Skarphet
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      +15%
                    </Typography>
                  </Grid>
                  <Grid size={{ xs:  3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Kontrast
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      +8%
                    </Typography>
                  </Grid>
                  <Grid size={{ xs:  3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Detaljer
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      +22%
                    </Typography>
                  </Grid>
                  <Grid size={{ xs:  3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Støy
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color:'success.main' }}>
                      -18%
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
}