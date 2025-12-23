/**
 * Interaktivt Tutorial-system - Video/Bilde Veiledninger
 * Lar brukere lage omfattende tutorials med sanntids kommentarsystem
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Rating,
  LinearProgress,
  Divider,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  VideoCall as VideoIcon,
  PhotoCamera as PhotoIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  BugReport as BugIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Share as ShareIcon,
  Publish as PublishIcon,
  Quiz as FAQIcon,
  Star as StarIcon,
  Timer as TimerIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

// Import badge system
import { CompactBadgeDisplay } from '../gamification/CompactBadgeDisplay';

interface TutorialStep {
  id: string;
  type: 'video' | 'screenshot';
  title: string;
  description: string;
  mediaUrl?: string;
  timestamp?: number;
  comments: TutorialComment[];
  codeIssues?: any[]
}

interface TutorialComment {
  id: string;
  timestamp: number;
  x: number;
  y: number;
  text: string;
  type: 'feedback' | 'bug' | 'improvement' | 'question';
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  authorId: string;
  createdAt: string
}

interface TutorialSession {
  id: string;
  title: string;
  description: string;
  targetUrl: string;
  steps: TutorialStep[];
  rating: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  estimatedDuration: number;
  status: 'draft' | 'recording' | 'review' | 'published' | 'faq';
  createdAt: string;
  publishedToFAQ?: boolean
}

interface InteractiveTutorialCreatorProps {
  open?: boolean;
  onClose?: () => void;
  targetUrl?: string;
  initialTitle?: string;
  userPoints?: number;
  onPointsEarned?: (points: number, reason: string) => void;
  // Integration props for universal workflow connectivity
  profession?: string;
  userId?: string;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export const InteractiveTutorialCreator: React.FC<InteractiveTutorialCreatorProps> = ({
  open = false,
  onClose = () => {},
  targetUrl = window.location.href,
  initialTitle = '',
  userPoints = 150,
  onPointsEarned,
  profession,
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  const [session, setSession] = useState<TutorialSession>({
    id: `tutorial_${Date.now()}`,
    title: initialTitle,
    description: '',
    targetUrl,
    steps:  [],
    rating:  0,
    difficulty: 'beginner',
    category: 'general',
    estimatedDuration:  0,
    status: 'draft',
    createdAt: new Date().toISOString()
});

  const [currentStep, setCurrentStep] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [recording, setRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'video' | 'screenshot'>('video');
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState(', ');
  const [selectedTab, setSelectedTab] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording) {
      interval = setInterval(() => {
        setRecordingTimer(prev => prev + 1);
  }, 1000);
  }
    return () => clearInterval(interval);
}, [recording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart, ('0')}:${secs.toString().padStart(2,'0')}`;
};

  const steps = [
    'Tutorial Setup', 'Recording/Screenshots', 'Kommentarer & Analyse', 'Review & Rating', 'Publisering'
  ];

  const startRecording = useCallback(async () => {
    try {
      if (recordingType === 'video') {
        // Start video recording
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen',},
          audio: true
    });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
      }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
    });

        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
        }
      };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, {
            type: 'video/webm'
      });
          
          const step: TutorialStep = {
            id: `step_${Date.now()}`,
            type: 'video',
            title: `Video Step ${session.steps.length +, 1}`,
            description: 'Video tutorial step',
            mediaUrl: URL.createObjectURL(blob),
            timestamp: Date.now(),
            comments: []
      };

          setSession(prev => ({
            ...prev,
            steps: [...prev.steps, step]
        }));
      };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
    }

      setRecording(true);
      setRecordingTimer(0);
      setSession(prev => ({ ...prev, status: 'recording',}));

  } catch (error) {
      console.error('❌ Failed to start recording: ', error);
  }
}, [recordingType, session.steps.length]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
  }
    
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
  }

    setRecording(false);
    setSession(prev => ({ ...prev, status: 'review',}));
}, []);

  const takeScreenshot = useCallback(() => {
    // Integrate with ScreenshotCapture component
    const step: TutorialStep = {
      id: `step_${Date.now()}`,
      type: 'screenshot',
      title: `Screenshot Step ${session.steps.length +, 1}`,
      description: 'Screenshot with analysis',
      timestamp: Date.now(),
      comments: []
};

    setSession(prev => ({
      ...prev,
      steps: [...prev.steps, step]
  }));
}, [session.steps.length]);

  const addComment = useCallback((x: number, y: number, type: TutorialComment['type'] = 'feedback') => {
    if (!newComment.trim()) return;

    const comment: TutorialComment = {
      id: `comment_${Date.now()}`,
      timestamp: Date.now(),
      x,
      y,
      text: newComment,
      type,
      severity: 'medium',
      resolved: false,
      authorId: 'current_user',
      createdAt: new Date().toISOString()
};

    const currentStepIndex = session.steps.length - 1;
    if (currentStepIndex >= 0) {
      setSession(prev => ({
        ...prev,
        steps: prev.steps.map((step, idx) =>
          idx === currentStepIndex
            ? { ...step, comments: [...step.comments, comment] }
            : step
        )
    }));
  }

    setNewComment(', ');
}, [newComment, session.steps.length]);

  const publishToFAQ = useCallback(async () => {
    try {
      // Calculate points earned
      const videoSteps = session.steps.filter(s => s.type === 'video').length;
      const screenshotSteps = session.steps.filter(s => s.type === 'screenshot').length;
      const qualityMultiplier = session.rating / 5;
      
      const basePoints = (videoSteps * 25) + (screenshotSteps * 10);
      const qualityBonus = Math.floor(basePoints * qualityMultiplier);
      const faqBonus = 50; // Extra points for FAQ publication
      const totalPoints = basePoints + qualityBonus + faqBonus;
      
      console.log('📚 Publishing tutorial to FAQ system...', session);
      console.log('💰 Points breakdown:', {
        videoSteps: videoSteps * 25,
        screenshotSteps: screenshotSteps * 10,
        qualityBonus,
        faqBonus,
        total: totalPoints
  });
      
      setSession(prev => ({
        ...prev,
        status: 'faq',
        publishedToFAQ: true
  }));

      // Award points
      if (onPointsEarned) {
        onPointsEarned(totalPoints, `Tutorial "${session.title}" publisert til FAQ`);
    }

      // Show motivational success message with points
      const motivationalMessage = `🎉 Tusen takk for at du laget en veiledning! 
      
CreatorHub Norge setter veldig stor pris på ditt bidrag til fellesskapet! 

✅ Tutorial publisert til FAQ-system
💰 Du tjente ${totalPoints} poeng!

💡 Lag flere veiledninger så får du en CreatorHub Badge når du når over 70% til neste nivå!`;

      alert(motivationalMessage);
      
  } catch (error) {
      console.error('❌ Failed to publish to FAQ:', error);
  }
}, [session, onPointsEarned]);

  const getPriorityScore = (): number => {
    let score = 0;
    
    // Video gets higher priority than screenshots
    const videoSteps = session.steps.filter(s => s.type === 'video').length;
    const screenshotSteps = session.steps.filter(s => s.type === 'screenshot').length;
    
    score += videoSteps * 10; // Video worth 10 points each
    score += screenshotSteps * 5; // Screenshots worth 5 points each
    
    // Quality factors
    score += session.rating * 5;
    score += session.steps.reduce((sum, step) => sum + step.comments.length, 0) * 2;
    
    return Math.min(score, 100);
};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          background: 'linear-gradient(135deg, rgba(33,150,243,0.1) 0%, rgba(1, 5, 6,39,176,0.1) 100%)',
          backdropFilter: 'blur(10px)'
    }
    }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <VideoIcon color="primary" />
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>Interaktiv Tutorial Creator</Typography>
          <Chip 
            label={`Prioritet: ${getPriorityScore()}%`}
            color={getPriorityScore() > 70 ? "success" : getPriorityScore() > 40 ? "warning" : "default"}
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          {recording && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main'}}>
              <Box
                sx={{
                  width:  12,
                  height:  12,
                  borderRadius: '50, %',
                  backgroundColor: 'error.main',
                  animation: 'pulse 1s infinite'
            }}
              />
              <Typography variant="body2">REC {formatTime(recordingTimer)}</Typography>
            </Box>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%'}}>
        {/* Progress Stepper */}
        <Stepper activeStep={currentStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', gap:  2 }}>
          {/* Left Panel - Tutorial Setup & Recording */}
          <Card sx={{ flex:  1 ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              {currentStep === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Tutorial Setup</Typography>
                  
                  <TextField
                    label="Tutorial Tittel"
                    value={session.title}
                    onChange={(e) => setSession(prev => ({ ...prev, title: e.target.value }))}
                    fullWidth
                  />
                  
                  <TextField
                    label="Beskrivelse"
                    value={session.description}
                    onChange={(e) => setSession(prev => ({ ...prev, description: e.target.value }))}
                    multiline
                    rows={3}
                    fullWidth
                  />
                  
                  <Box sx={{ display: 'flex', gap:  2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={recordingType === 'video'}
                          onChange={(e) => setRecordingType(e.target.checked ? 'video' : 'screenshot')}
                        />
                    }
                      label={recordingType === 'video' ? '🎥 Video (Anbefalt)' : '📸 Screenshots'}
                    />
                    
                    <Chip
                      label={recordingType === 'video' ? 'Høy prioritet' : 'Medium prioritet'}
                      color={recordingType === 'video' ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>

                  <Alert severity="info">
                    💡 <strong>Tips: </strong> Video-tutorials får høyere prioritet i FAQ-systemet og er mer verdifulle for brukere.
                  </Alert>
                </Box>
             )}

              {currentStep === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Recording & Screenshots</Typography>
                  
                  <Box sx={{ display: 'flex', gap:  2 }}>
                    {!recording ? (
                      <Button variant="contained"
                        startIcon={recordingType === 'video' ? <VideoIcon sx={theming.getThemedButtonSx()}> : <PhotoIcon />}
                        onClick={startRecording}
                        color={recordingType === 'video' ? 'primary' : 'secondary'}
                      >
                        Start {recordingType === 'video' ? 'Video' : 'Screenshot'} Recording
                      </Button>
                    ) : (
                      <Button variant="contained"
                        color="error"
                        startIcon={<StopIcon />}
                        onClick={stopRecording}
                      >
                        Stop Recording
                      </Button>
                    )}

                    {recordingType === 'screenshot' && (
                      <Button
                        variant="outlined"
                        startIcon={<PhotoIcon />}
                        onClick={takeScreenshot}
                      >
                        Ta Screenshot
                      </Button>
                    )}
                  </Box>

                  {/* Video Preview */}
                  {recordingType === 'video' && (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      style={{
                        width: '100%',
                        maxHeight: '300px',
                        borderRadius: '8px',
                        backgroundColor: '#000'}}
                    />
                  )}

                  {/* Steps Overview */}
                  <Typography variant="subtitle1">Opptak Status ({session.steps.length} steps)</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((session.steps.length / 5) * 100, 100)}
                  />
                  
                  {session.steps.map((step, idx) => (
                    <Chip
                      key={step.id}
                      icon={step.type === 'video' ? <VideoIcon /> : <PhotoIcon />}
                      label={`${step.type === 'video' ? '🎥' : '📸'} Step ${idx + 1}: ${step.title}`}
                      color={step.type === 'video' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}

              {currentStep === 2 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kommentarer & Analyse</Typography>
                  
                  <TextField
                    label="Legg til kommentar"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    multiline
                    rows={2}
                    fullWidth
                  />
                  
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CommentIcon />}
                      onClick={() => addComment(0, 'feedback')}
                    >
                      Feedback
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<BugIcon />}
                      onClick={() => addComment(0'bug')}
                      color="error"
                    >
                      Bug Report
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<StarIcon />}
                      onClick={() => addComment(0'improvement')}
                      color="warning"
                    >
                      Forbedring
                    </Button>
                  </Box>

                  {/* Code Analysis Integration */}
                  <Alert severity="info">
                    <Typography variant="body2">
                      🔍 <strong>Smart Analyse: </strong> Screenshots analyseres automatisk for kode-feil og forbedringsmuligheter.
                    </Typography>
                  </Alert>
                </Box>
             )}

              {currentStep === 3 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Review & Rating</Typography>
                  
                  <Box>
                    <Typography component="legend">Rate tutorial kvalitet: </Typography>
                    <Rating
                      value={session.rating}
                      onChange={(_, newValue) => {
                        setSession(prev => ({ ...prev, rating: newValue || 0 }));
                    }}
                      size="large"
                    />
                  </Box>

                  <Alert severity={session.rating >= 4 ? "success" : "warning"}>
                    {session.rating >= 4 
                      ? "✅ Høy kvalitet! Anbefales for FAQ publisering." : "⚠️ Vurder å forbedre tutorial før publisering til FAQ."
                  }
                  </Alert>
                </Box>
              )}

              {currentStep === 4 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Publisering</Typography>
                  
                  <Card sx={{ p: 2, bgcolor: 'background.paper',  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Tutorial Sammendrag
                    </Typography>
                    <Typography><strong>Tittel: </strong> {session.title}</Typography>
                    <Typography><strong>Steps: </strong> {session.steps.length}</Typography>
                    <Typography><strong>Video Steps: </strong> {session.steps.filter(s => s.type === 'video').length}</Typography>
                    <Typography><strong>Screenshots: </strong> {session.steps.filter(s => s.type === 'screenshot').length}</Typography>
                    <Typography><strong>Rating: </strong> {session.rating}/5</Typography>
                    <Typography><strong>Prioritet Score: </strong> {getPriorityScore()}%</Typography>
                  </Card>

                  <Box sx={{ display: 'flex', gap:  2 }}>
                    <Button variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={() => console.log('Saving draft...')}
                    >
                      Lagre Draft
                    </Button>
                    
                    <Button variant="contained"
                      color="success"
                      startIcon={<FAQIcon />}
                      onClick={publishToFAQ}
                      disabled={session.rating < 3}
                    >
                      Publiser til FAQ
                    </Button>
                  </Box>

                  {session.publishedToFAQ && (
                    <Alert severity="success">
                      🎉 Tutorial publisert til FAQ-system! Den er nå tilgjengelig for alle brukere.
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Right Panel - Comments & Analysis */}
          <Card sx={{ width: 350,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Tabs 
                value={selectedTab}
                onChange={(_, newValue) => setSelectedTab(newValue)}
                variant="fullWidth"
              >
                <Tab label="Kommentarer" />
                <Tab label="Analyse" />
              </Tabs>

              {selectedTab === 0 && (
                <Box sx={{ mt:  2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Tutorial Kommentarer
                  </Typography>
                  
                  <List dense>
                    {session.steps.flatMap(step => step.comments).map((comment) => (
                      <ListItem key={comment.id}>
                        <ListItemIcon>
                          {comment.type === 'bug' && <BugIcon color="error" />}
                          {comment.type === 'feedback' && <CommentIcon color="primary" />}
                          {comment.type === 'improvement' && <StarIcon color="warning" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={comment.text}
                          secondary={`${comment.type} - ${new Date(comment.createdAt).toLocaleString()}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  {session.steps.flatMap(step => step.comments).length === 0 && (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', mt:  4 }}>
                      Ingen kommentarer ennå
                    </Typography>
                  )}
                </Box>
              )}

              {selectedTab === 1 && (
                <Box sx={{ mt:  2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Tutorial Analyse
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                    <Chip
                      label={`${getPriorityScore()}% Prioritet Score`}
                      color={getPriorityScore() > 70 ? "success" : "warning"}
                    />
                    
                    <Typography variant="body2">
                      <strong>Video fordel: </strong> +{session.steps.filter(s => s.type === 'video').length * 10} poeng
                    </Typography>
                    
                    <Typography variant="body2">
                      <strong>Screenshot bonus: </strong> +{session.steps.filter(s => s.type === 'screenshot').length *, 5} poeng
                    </Typography>
                    
                    <Typography variant="body2">
                      <strong>Kvalitet bonus: </strong> +{session.rating *, 5} poeng
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent:'space-between', pt:  2 }}>
          <Button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(prev => prev - 1)}
          >
            Tilbake
          </Button>
          <Button variant="contained"
            onClick={() => setCurrentStep(prev => prev + 1)}
            disabled={currentStep === steps.length - 1}
          >
            Neste
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};