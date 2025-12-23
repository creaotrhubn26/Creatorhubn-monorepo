import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Chip,
  Divider,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Badge,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  Refresh,
  Settings,
  Add,
  Delete,
  Edit,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error,
  Warning,
  Info,
  Code,
  Image,
  VideoLibrary,
  Description,
  Timeline,
  Assessment,
  AutoFixHigh,
} from '@mui/icons-material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface SimulationStep {
  id: string;
  title: string;
  description: string;
  type: 'instruction' | 'interaction' | 'quiz' | 'code' | 'media' | 'form' | 'navigation';
  content: any;
  validation?: ValidationRule[];
  nextStep?: string;
  previousStep?: string;
  completed: boolean;
  required: boolean;
  estimatedTime: number; // in seconds
  position: { x: number; y: number };
}

interface ValidationRule {
  id: string;
  type: 'required' | 'pattern' | 'custom' | 'code-execution';
  value?: any;
  message: string;
  condition?: string
}

interface SimulationConfig {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // in minutes
  prerequisites: string[];
  learningObjectives: string[];
  steps: SimulationStep[];
  settings: {
    allowSkip: boolean;
    allowBacktrack: boolean;
    showProgress: boolean;
    autoAdvance: boolean;
    autoAdvanceDelay: number;
    retryLimit: number;
    scoringEnabled: boolean;
};
}

interface StepByStepSimulationProps {
  simulation?: SimulationConfig;
  onSimulationChange?: (simulation: SimulationConfig) => void;
  onStepComplete?: (stepId: string, result: any) => void;
  onSimulationComplete?: (results: any) => void;
  className?: string
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simulation-tabpanel-${index}`}
      aria-labelledby={`simulation-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

const StepByStepSimulation: React.FC<StepByStepSimulationProps> = ({
  simulation: initialSimulation,
  onSimulationChange,
  onStepComplete,
  onSimulationComplete,
  className,
}) => {
  const [simulation, setSimulation] = useState<SimulationConfig>(
    initialSimulation || getDefaultSimulation()
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [stepResults, setStepResults] = useState<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [editingStep, setEditingStep] = useState<SimulationStep | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: ', ', severity: 'success' as 'success' | 'error' | 'warning' | 'info',});
  const [progress, setProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [score, setScore] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const getDefaultSimulation = (): SimulationConfig => ({
    id: `sim_${Date.now()}`,
    title: 'New Simulation',
    description: 'Interactive step-by-step simulation',
    category: 'General',
    difficulty: 'beginner',
    estimatedDuration:  10,
    prerequisites:  [],
    learningObjectives:  [],
    steps:  [],
    settings: {
      allowSkip: true,
      allowBacktrack: true,
      showProgress: true,
      autoAdvance: false,
      autoAdvanceDelay:  5,
      retryLimit:  3,
      scoringEnabled: true,
  },
});

  const currentStep = simulation.steps[currentStepIndex];
  const isLastStep = currentStepIndex === simulation.steps.length - 1;
  const isFirstStep = currentStepIndex === 0;
  const totalSteps = simulation.steps.length;
  const completedCount = completedSteps.size;

  const startSimulation = () => {
    setIsPlaying(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setStepResults(new Map());
    setProgress(0);
    setTimeElapsed(0);
    setScore(0);
    startTimeRef.current = Date.now();
    
    if (simulation.settings.autoAdvance) {
      startAutoAdvanceTimer();
  }
    
    setSnackbar({ open: true, message: 'Simulation started', severity: 'info',});
};

  const pauseSimulation = () => {
    setIsPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
  }
    setSnackbar({ open: true, message: 'Simulation paused', severity: 'warning',});
};

  const resumeSimulation = () => {
    setIsPaused(false);
    if (simulation.settings.autoAdvance) {
      startAutoAdvanceTimer();
  }
    setSnackbar({ open: true, message: 'Simulation resumed', severity: 'info',});
};

  const stopSimulation = () => {
    setIsPlaying(false);
    setIsPaused(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
  }
    setSnackbar({ open: true, message: 'Simulation stopped', severity: 'info',});
};

  const nextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
      updateProgress();
  } else {
      completeSimulation();
  }
};

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      updateProgress();
  }
};

  const skipStep = () => {
    if (simulation.settings.allowSkip) {
      nextStep();
  }
};

  const completeStep = (result: any) => {
    if (currentStep) {
      setCompletedSteps(prev => new Set([...prev, currentStep.id]));
      setStepResults(prev => new Map(prev).set(currentStep.id, result));
      
      if (simulation.settings.scoringEnabled) {
        const stepScore = calculateStepScore(currentStep, result);
        setScore(prev => prev + stepScore);
    }
      
      onStepComplete?.(currentStep.id, result);
      
      if (simulation.settings.autoAdvance && !isLastStep) {
        setTimeout(() => nextStep(), simulation.settings.autoAdvanceDelay * 1000);
    } else if (isLastStep) {
        completeSimulation();
    }
      
      setSnackbar({ open: true, message: 'Step completed', severity: 'success',});
  }
};

  const completeSimulation = () => {
    setIsPlaying(false);
    setIsPaused(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
  }
    
    const results = {
      completedSteps: Array.from(completedSteps),
      stepResults: Object.fromEntries(stepResults),
      score,
      timeElapsed: Date.now() - startTimeRef.current,
      completionRate: (completedSteps.size / totalSteps) * 10,
  };
    
    onSimulationComplete?.(results);
    setSnackbar({ open: true, message: 'Simulation completed, !', severity: 'success',});
};

  const startAutoAdvanceTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
  }
    
    timerRef.current = setTimeout(() => {
      if (isPlaying && !isPaused) {
        nextStep();
    }
  }, simulation.settings.autoAdvanceDelay * 1000);
};

  const updateProgress = () => {
    const newProgress = ((currentStepIndex + 1) / totalSteps) * 100;
    setProgress(newProgress);
};

  const calculateStepScore = (step: SimulationStep, result: any): number => {
    if (!simulation.settings.scoringEnabled) return 0;
    
    // Basic scoring logic - can be enhanced
    if (step.type === 'quiz') {
      return result.correct ? 10 : 0;
    } else if (step.type === 'code') {
      return result.passed ? 15 : 0;
    } else if (step.type === 'interaction') {
      return result.completed ? 5 : 0;
    }
    
    return step.completed ? 1 : 0;
};

  const addStep = (type: SimulationStep['type']) => {
    const newStep: SimulationStep = {
      id: `step_${Date.now()}`,
      title: `New ${type} Step`,
      description: `Description for ${type} step`,
      type,
      content: getDefaultStepContent(type),
      completed: false,
      required: true,
      estimatedTime: 30,
      position: { x: 100, y: 100 + simulation.steps.length * 120 },
    };
    
    const updatedSimulation = {
      ...simulation,
      steps: [...simulation.steps, newStep],
    };
    
    setSimulation(updatedSimulation);
    onSimulationChange?.(updatedSimulation);
    setSnackbar({ open: true, message: 'Step added', severity: 'success' });
};

  const editStep = (step: SimulationStep) => {
    setEditingStep(step);
    setShowStepEditor(true);
};

  const updateStep = (stepId: string, updates: Partial<SimulationStep>) => {
    const updatedSimulation = {
      ...simulation,
      steps: simulation.steps.map(step => 
        step.id === stepId ? { ...step, ...updates } : step
      ),
    };
    
    setSimulation(updatedSimulation);
    onSimulationChange?.(updatedSimulation);
};

  const deleteStep = (stepId: string) => {
    const updatedSimulation = {
      ...simulation,
      steps: simulation.steps.filter(step => step.id !== stepId),
    };
    
    setSimulation(updatedSimulation);
    onSimulationChange?.(updatedSimulation);
    setSnackbar({ open: true, message: 'Step deleted', severity: 'info' });
};

  const getDefaultStepContent = (type: SimulationStep['type']) => {
    switch (type) {
      case 'instruction':
        return { text: 'Follow these instructions...', image: null };
      case 'interaction':
        return { action: 'click', target: 'button', description: 'Click the button' };
      case 'quiz':
        return { 
          question: 'What is the correct answer?', 
          options: ['Option A','Option B','Option C','Option D'],
          correctAnswer: 0,
          explanation: 'This is the correct answer because...'
        };
      case 'code':
        return { 
          language: 'javascript', 
          initialCode: '// Write your code here',
          expectedOutput: 'Hello World',
          hints: ['Use console.log()','Make sure to return the correct value']
        };
      case 'media':
        return { 
          type: 'video', 
          url: ', ', 
          autoplay: false, 
          controls: true,
          description: 'Watch this video carefully'
        };
      case 'form':
        return { 
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true }
          ],
          submitText: 'Submit'
        };
      case 'navigation':
        return { 
          action: 'navigate', 
          target: 'next-section', 
          description: 'Navigate to the next section'
        };
      default:
        return {};
    }
  };

  const renderStepContent = (step: SimulationStep) => {
    switch (step.type) {
      case 'instruction':
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {step.title}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {step.content.text}
            </Typography>
            {step.content.image && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <img 
                  src={step.content.image}
                  alt="Instruction" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </Box>
            )}
          </Box>
        );
      
      case 'quiz':
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {step.title}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {step.content.question}
            </Typography>
            <Stack spacing={1}>
              {step.content.options?.map((option: string, index: number) => (
                <Button
                  key={index}
                  variant="outlined"
                  fullWidth
                  onClick={() => completeStep({ selected: index, correct: index === step.content.correctAnswer })}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Button>
              ))}
            </Stack>
          </Box>
        );
      
      case 'code':
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {step.title}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {step.description}
            </Typography>
            <Box sx={{ 
              fontFamily: 'monospace', 
              backgroundColor: '#f5f5f5', 
              p: 2,
              borderRadius: 1,
              mb: 2
            }}>
              <pre>{step.content.initialCode}</pre>
            </Box>
            <Button
              variant="contained"
              startIcon={<CREATOR_HUB_ICONS.code />}
              onClick={() => completeStep({ code: step.content.initialCode, passed: true })}
              sx={theming.getThemedButtonSx()}
            >
              Run Code
            </Button>
          </Box>
        );
      
      case 'interaction':
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {step.title}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {step.content.description}
            </Typography>
            <Button
              variant="contained"
              onClick={() => completeStep({ action: step.content.action, completed: true })}
              sx={theming.getThemedButtonSx()}
            >
              {step.content.action === 'click' ? 'Click Here' : 'Perform Action'}
            </Button>
          </Box>
        );
      
      default: return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {step.title}
            </Typography>
            <Typography variant="body1">
              {step.description}
            </Typography>
          </Box>
        );
  }
};

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const interval = setInterval(() => {
        setTimeElapsed(Date.now() - startTimeRef.current);
    }, 1000);
      
      return () => clearInterval(interval);
  }
}, [isPlaying, isPaused]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
    }
  };
}, []);

  return (
    <Box className={className} sx={{ width: '100%', height: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.timeline />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Step-by-Step Simulation</Typography>
            <Chip 
              label={simulation.difficulty}
              color="primary"
              size="small"
            />
            {isPlaying && (
              <Chip 
                label={isPaused ? "Paused" : "Playing"}
                color={isPaused ? "warning" : "success"}
                size="small" 
                icon={isPaused ? <CREATOR_HUB_ICONS.pause /> : <CREATOR_HUB_ICONS.playArrow />}
              />
            )}
          </Stack>
          
          <Stack direction="row" spacing={1}>
            {!isPlaying ? (
              <Tooltip title="Start Simulation">
                <IconButton onClick={startSimulation} color="primary">
                  <CREATOR_HUB_ICONS.playArrow />
                </IconButton>
              </Tooltip>
            ) : (
              <>
                {isPaused ? (
                  <Tooltip title="Resume">
                    <IconButton onClick={resumeSimulation} color="primary">
                      <CREATOR_HUB_ICONS.playArrow />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Pause">
                    <IconButton onClick={pauseSimulation} color="warning">
                      <CREATOR_HUB_ICONS.pause />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Stop">
                  <IconButton onClick={stopSimulation} color="error">
                    <CREATOR_HUB_ICONS.stop />
                  </IconButton>
                </Tooltip>
              </>
            )}
            
            <Tooltip title="Add Step">
              <IconButton onClick={() => addStep('instruction')}>
                <CREATOR_HUB_ICONS.add />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton onClick={() => setShowSettings(true)}>
                <CREATOR_HUB_ICONS.settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Progress Bar */}
      {simulation.settings.showProgress && (
        <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" sx={{ minWidth: 100 }}>
              Progress: {completedCount}/{totalSteps}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progress}
              sx={{ flex: 1 }}
            />
            <Typography variant="body2" sx={{ minWidth: 60 }}>
              {Math.round(progress)}%
            </Typography>
            {simulation.settings.scoringEnabled && (
              <Chip label={`Score: ${score}`} size="small" color="primary" />
            )}
            <Typography variant="body2" color="text.secondary">
              {Math.floor(timeElapsed / 60000)}:{String(Math.floor((timeElapsed % 60000) / 1000)).padStart(2, '0')}
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Main Content */}
      <Paper elevation={1} sx={{ height: 'calc(100% - 200px)', ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Simulation" icon={<CREATOR_HUB_ICONS.playArrow />} />
            <Tab label="Steps" icon={<CREATOR_HUB_ICONS.assessment />} />
            <Tab label="Settings" icon={<CREATOR_HUB_ICONS.settings />} />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ height: 'calc(100% - 60px)', overflow: 'auto', p: 3 }}>
            {currentStep ? (
              <Box>
                <Stepper activeStep={currentStepIndex} alternativeLabel sx={{ mb: 3 }}>
                  {simulation.steps.map((step, index) => (
                    <Step key={step.id}>
                      <StepLabel
                        optional={
                          <Typography variant="caption">
                            {step.estimatedTime}s
                          </Typography>
                      }
                      >
                        {step.title}
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
                
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    {renderStepContent(currentStep)}
                  </CardContent>
                </Card>
                
                <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={<SkipPrevious />}
                    onClick={previousStep}
                    disabled={isFirstStep || !simulation.settings.allowBacktrack}
                  >
                    Previous
                  </Button>
                  
                  {simulation.settings.allowSkip && (
                    <Button
                      variant="outlined"
                      startIcon={<SkipNext />}
                      onClick={skipStep}
                    >
                      Skip
                    </Button>
                  )}
                  
                  <Button
                    variant="contained"
                    startIcon={<CREATOR_HUB_ICONS.checkCircle />}
                    onClick={() => completeStep({ completed: true })}
                    sx={theming.getThemedButtonSx()}
                  >
                    Complete Step
                  </Button>
                  
                  <Button variant="contained"
                    startIcon={<SkipNext />}
                    onClick={nextStep}
                    disabled={isLastStep}
                  >
                    Next
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary'
              }}>
                <CREATOR_HUB_ICONS.timeline sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>No Steps Available</Typography>
                <Typography>Add steps to create your simulation</Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
            <Stack spacing={2} sx={{ p: 2 }}>
              {simulation.steps.map((step, index) => (
                <Card key={step.id} sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Badge badgeContent={index + 1} color="primary">
                          <CREATOR_HUB_ICONS.assessment />
                        </Badge>
                        <Box>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{step.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {step.type} • {step.estimatedTime}s
                          </Typography>
                        </Box>
                        {step.completed && (
                          <Chip 
                            label="Completed" 
                            size="small" 
                            color="success" 
                            icon={<CREATOR_HUB_ICONS.checkCircle />}
                          />
                        )}
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => editStep(step)}>
                            <CREATOR_HUB_ICONS.edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => deleteStep(step.id)}
                          >
                            <CREATOR_HUB_ICONS.delete />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              
              {simulation.steps.length === 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: 20,
                  color: 'text.secondary'
            }}>
                  <CREATOR_HUB_ICONS.assessment sx={{ fontSize:  48, mb:  2 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>No Steps</Typography>
                  <Typography>Add steps to build your simulation</Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ height: 'calc(100% - 60px, )', overflow: 'auto'}}>
            <SimulationSettings 
              simulation={simulation}
              onUpdate={(updates) => {
                const updated = { ...simulation, ...updates };
                setSimulation(updated);
                onSimulationChange?.(updated);
            }}
            />
          </Box>
        </TabPanel>
      </Paper>

      {/* Step Editor Dialog */}
      <Dialog open={showStepEditor} onClose={() => setShowStepEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Step</DialogTitle>
        <DialogContent>
          {editingStep && (
            <StepEditor
              step={editingStep}
              onUpdate={(updates) => {
                updateStep(editingStep.id, updates);
                setShowStepEditor(false);
                setEditingStep(null);
            }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowStepEditor(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Simulation Settings</DialogTitle>
        <DialogContent>
          <SimulationSettings 
            simulation={simulation}
            onUpdate={(updates) => {
              const updated = { ...simulation, ...updates };
              setSimulation(updated);
              onSimulationChange?.(updated);
          }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Simulation Settings Component
interface SimulationSettingsProps {
  simulation: SimulationConfig;
  onUpdate: (updates: Partial<SimulationConfig>) => void
}

function SimulationSettings({ simulation, onUpdate }: SimulationSettingsProps) {
  return (
    <Stack spacing={3}>
      <TextField
        label="Title"
        value={simulation.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        fullWidth
      />
      
      <TextField
        label="Description"
        multiline
        rows={3}
        value={simulation.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        fullWidth
      />
      
      <FormControl fullWidth>
        <InputLabel>Difficulty</InputLabel>
        <Select
          value={simulation.difficulty}
          onChange={(e) => onUpdate({ difficulty: e.target.value as any })}
        >
          <MenuItem value="beginner">Beginner</MenuItem>
          <MenuItem value="intermediate">Intermediate</MenuItem>
          <MenuItem value="advanced">Advanced</MenuItem>
        </Select>
      </FormControl>
      
      <TextField
        label="Estimated Duration (minutes)"
        type="number"
        value={simulation.estimatedDuration}
        onChange={(e) => onUpdate({ estimatedDuration: parseInt(e.target.value) || 0 })}
        fullWidth
      />
    </Stack>
  );
}

// Step Editor Component
interface StepEditorProps {
  step: SimulationStep;
  onUpdate: (updates: Partial<SimulationStep>) => void
}

function StepEditor({ step, onUpdate }: StepEditorProps) {
  return (
    <Stack spacing={3}>
      <TextField
        label="Step Title"
        value={step.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        fullWidth
      />
      
      <TextField
        label="Description"
        multiline
        rows={3}
        value={step.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        fullWidth
      />
      
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Select
          value={step.type}
          onChange={(e) => onUpdate({ type: e.target.value as any })}
        >
          <MenuItem value="instruction">Instruction</MenuItem>
          <MenuItem value="interaction">Interaction</MenuItem>
          <MenuItem value="quiz">Quiz</MenuItem>
          <MenuItem value="code">Code</MenuItem>
          <MenuItem value="media">Media</MenuItem>
          <MenuItem value="form">Form</MenuItem>
          <MenuItem value="navigation">Navigation</MenuItem>
        </Select>
      </FormControl>
      
      <TextField
        label="Estimated Time (seconds)"
        type="number"
        value={step.estimatedTime}
        onChange={(e) => onUpdate({ estimatedTime: parseInt(e.target.value) || 0 })}
        fullWidth
      />
    </Stack>
  );
}

export default StepByStepSimulation;
