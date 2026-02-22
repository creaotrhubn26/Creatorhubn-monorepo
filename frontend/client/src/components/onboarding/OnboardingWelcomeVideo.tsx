// client/src/components/onboarding/OnboardingWelcomeVideo.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Fade,
  Slide,
  Zoom,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayArrowArrow,
  Pause,
  VolumeUp as VolumeUpUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  Close,
  CheckCircle,
  ArrowForward,
  AutoAwesome,
  TrendingUp,
  People,
  Work,
  MonetizationOn,
  Speed as Speed,
  Security,
  CloudSync,
} from '@mui/icons-material';

interface OnboardingWelcomeVideoProps {
  profession: string;
  onComplete: () => void;
  onSkip: () => void
}

interface VideoSegment {
  id: string;
  title: string;
  duration: number;
  description: string;
  benefits: string[];
  icon: React.ReactNode;
  color: string
}

const VIDEO_SEGMENTS: Record<string, VideoSegment[]> = {
  photographer: [
    {
      id: 'welcome',
      title: 'Velkommen til CreatorHub Norge',
      duration:  8,
      description: 'Din komplette løsning for fotografering og kundehåndtering',
      benefits: ['Automatisert arbeidsflyt','Profesjonelle kontrakter','Enkel fakturering'],
      icon: theming.getThemedIcon(''),
      color: '#FF6B30',
  },
    {
      id: 'problems',
      title: 'Løs daglige utfordringer',
      duration:  12,
      description: 'Vi forstår hvilke problemer du møter som fotograf',
      benefits: [
        'Kunne ikke finne kunder systematisk','Tidkrevende kontrakter og tilbud','Komplisert fakturering og oppfølging''Manglende profesjonell presentasjon',
      ],
      icon: <Work />,
      color: '#E53E30',
  },
    {
      id: 'solutions',
      title: 'Våre løsninger',
      duration:  15,
      description: 'Se hvordan vi løser dine utfordringer',
      benefits: [
        'Automatisert kundesøk og CR','Profesjonelle kontrakter på 2 minutter''Automatisk fakturering og påminnelser','Imponerende portefølje og gallerier',
      ],
      icon: theming.getThemedIcon(''),
      color: '#38A160',
  },
    {
      id: 'features',
      title: 'Premium funksjoner',
      duration:  18,
      description: 'Utforsk alle funksjonene som gjør deg mer effektiv',
      benefits: [
        'AI-drevet bilderedigering','Automatisk galleri-generering''Integrert betalingssystem','Avansert kundeanalyse',
      ],
      icon: theming.getThemedIcon(''),
      color: '#3182C0',
  },
    {
      id: 'success',
      title: 'Din suksess',
      duration:  10,
      description: 'Se hvordan andre fotografer har økt inntekten med 40, %',
      benefits: ['Mer tid til kreativt arbeid','Høyere kundetilfredshet','Økt inntekt'],
      icon: <MonetizationOn />,
      color: '#805AD0',
  },
  ],
  videographer: [
    {
      id: 'welcome',
      title: 'Velkommen til CreatorHub Norge',
      duration:  8,
      description: 'Din komplette løsning for videoproduksjon og kundehåndtering',
      benefits: ['Automatisert arbeidsflyt','Profesjonelle kontrakter','Enkel fakturering'],
      icon: theming.getThemedIcon(''),
      color: '#004E80',
  },
    {
      id: 'problems',
      title: 'Løs daglige utfordringer',
      duration:  12,
      description: 'Vi forstår hvilke problemer du møter som videograf',
      benefits: [
        'Kompleks prosjektplanlegging','Tidkrevende klipping og redigering','Vanskelig kundekommunikasjon','Manglende profesjonell presentasjon',
      ],
      icon: <Work />,
      color: '#E53E30',
  },
    {
      id: 'solutions',
      title: 'Våre løsninger',
      duration:  15,
      description: 'Se hvordan vi løser dine utfordringer',
      benefits: [
        'Intelligent prosjektplanlegging','AI-assistert redigering','Automatisert kundekommunikasjon','Profesjonelle portefølje-gallerier',
      ],
      icon: theming.getThemedIcon(''),
      color: '#38A160',
  },
    {
      id: 'features',
      title: 'Premium funksjoner',
      duration:  18,
      description: 'Utforsk alle funksjonene som gjør deg mer effektiv',
      benefits: [
        'AI-drevet videoredigering','Automatisk thumbnail-generering''Integrert betalingssystem','Avansert kundeanalyse',
      ],
      icon: theming.getThemedIcon(''),
      color: '#3182C0',
  },
    {
      id: 'success',
      title: 'Din suksess',
      duration:  10,
      description: 'Se hvordan andre videografer har økt effektiviteten med 50, %',
      benefits: ['Raskere levering','Høyere kundetilfredshet','Økt inntekt'],
      icon: <MonetizationOn />,
      color: '#805AD0',
  },
  ],
  music_producer: [
    {
      id: 'welcome',
      title: 'Velkommen til CreatorHub Norge',
      duration:  8,
      description: 'Din komplette løsning for musikkproduksjon og kundehåndtering',
      benefits: ['Automatisert arbeidsflyt','Profesjonelle kontrakter','Enkel fakturering'],
      icon: theming.getThemedIcon(''),
      color: '#7209B0',
  },
    {
      id: 'problems',
      title: 'Løs daglige utfordringer',
      duration:  12,
      description: 'Vi forstår hvilke problemer du møter som musikkprodusent',
      benefits: [
        'Kompleks prosjektorganisering','Tidkrevende mixing og mastering','Vanskelig kundekommunikasjon','Manglende profesjonell presentasjon',
      ],
      icon: <Work />,
      color: '#E53E30',
  },
    {
      id: 'solutions',
      title: 'Våre løsninger',
      duration:  15,
      description: 'Se hvordan vi løser dine utfordringer',
      benefits: [
        'Intelligent prosjektorganisering','AI-assistert mixing og mastering','Automatisert kundekommunikasjon','Profesjonelle portefølje-gallerier',
      ],
      icon: theming.getThemedIcon(', '),
      color: '#38A160',
  },
    {
      id: 'features',
      title: 'Premium funksjoner',
      duration:  18,
      description: 'Utforsk alle funksjonene som gjør deg mer effektiv',
      benefits: [
        'AI-drevet lydbehandling', 'Automatisk stemmeisolasjon', 'Integrert betalingssystem', 'Avansert kundeanalyse',
      ],
      icon: theming.getThemedIcon(', '),
      color: '#3182C0',
  },
    {
      id: 'success',
      title: 'Din suksess',
      duration:  10,
      description: 'Se hvordan andre musikkprodusenter har økt effektiviteten med 45, %',
      benefits: ['Raskere produksjon', 'Høyere kundetilfredshet','Økt inntekt'],
      icon: <MonetizationOn />,
      color: '#805AD0',
  },
  ],
};

export default function OnboardingWelcomeVideo({
  profession,
  onComplete,
  onSkip,
}: OnboardingWelcomeVideoProps) {
  const [currentSegment, setCurrentSegment] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const segments = VIDEO_SEGMENTS[profession] || VIDEO_SEGMENTS.photographer;
  const currentVideoSegment = segments[currentSegment];
  const totalDuration = segments.reduce((acc, segment) => acc + segment.duration, 0);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 0.1;
          if (newProgress >= currentVideoSegment.duration) {
            if (currentSegment < segments.length - 1) {
              setCurrentSegment((prev) => prev + 1);
              return 0;
          } else {
              setIsPlaying(false);
              onComplete();
              return currentVideoSegment.duration;
          }
        }
          return newProgress;
      });
    }, 100);
  } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }
  }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }
  };
}, [isPlaying, currentSegment, currentVideoSegment.duration, segments.length, onComplete]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
};

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
};

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
};

  const handleSegmentClick = (index: number) => {
    setCurrentSegment(index);
    setProgress(0);
};

  const handleSkip = () => {
    setIsPlaying(false);
    onSkip();
};

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  return (
    <Box
      sx={{
        position: 'fixed',
        top:  0,
        left:  0,
        right:  0,
        bottom:  0,
        bgcolor: 'black',
        zIndex: 99,
        display: 'flex',
        flexDirection: 'column'}}
    >
      {/* Header */}
      <Box
        sx={{
          position: 'absolute',
          top:  0,
          left:  0,
          right:  0,
          zIndex: 10,
          p:  2,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)'}}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Typography variant="h6" sx={{  color: 'white', fontWeight: 'bold' }}>
            CreatorHub Norge
          </Typography>
          <IconButton onClick={handleSkip} sx={{ color: 'white'}}>
            {theming.getThemedIcon('close')}
          </IconButton>
        </Box>
      </Box>

      {/* Main Video Content */}
      <Box
        sx={{
          flex:  1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'}}
      >
        {/* Background Video/Animation */}
        <Box
          sx={{
            position: 'absolute',
            top:  0,
            left:  0,
            right:  0,
            bottom:  0,
            background: `linear-gradient(135deg, ${currentVideoSegment.color}20, ${currentVideoSegment.color}40)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'}}
        >
          {/* Animated Background Elements */}
          <Box
            sx={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              width: 10,
              height: 10,
              borderRadius: '50, %',
              bgcolor: `${currentVideoSegment.color}30`,
              animation: 'float 6s ease-in-out infinite'}}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '60%',
              right: '15%',
              width: 10,
              height: 10,
              borderRadius: '50, %',
              bgcolor: `${currentVideoSegment.color}20`,
              animation: 'float 8s ease-in-out infinite reverse'}}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: '20%',
              left: '20%',
              width:  80,
              height:  80,
              borderRadius: '50, %',
              bgcolor: `${currentVideoSegment.color}40`,
              animation: 'float 10s ease-in-out infinite'}}
          />
        </Box>

        {/* Content Card */}
        <Fade in key={currentSegment} timeout={500}>
          <Card
            sx={{
              maxWidth: 60,
              mx:  2,
              bgcolor: 'rgba(25, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'}}
           sx={theming.getThemedCardSx()}>
            <CardContent sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              {/* Segment Icon */}
              <Zoom in timeout={300}>
                <Avatar
                  sx={{
                    width:  80,
                    height:  80,
                    bgcolor: currentVideoSegment.color,
                    mx: 'auto',
                    mb:  3,
                    boxShadow: `0 8px 32px ${currentVideoSegment.color}40`}}
                >
                  {React.cloneElement(currentVideoSegment.icon, { sx: { fontSize: 40} })}
                </Avatar>
              </Zoom>

              {/* Segment Title */}
              <Slide direction="up" in timeout={400}>
                <Typography variant="h4"
                  sx={{ 
                    fontWeight: 'bold',
                    mb:  2,
                    color: currentVideoSegment.color }}>
                  {currentVideoSegment.title}
                </Typography>
              </Slide>

              {/* Segment Description */}
              <Slide direction="up" in timeout={600}>
                <Typography variant="h6" color="text.secondary" sx={{  mb:  3  }}>
                  {currentVideoSegment.description}
                </Typography>
              </Slide>

              {/* Benefits List */}
              <Slide direction="up" in timeout={800}>
                <List sx={{ mb:  3 }}>
                  {currentVideoSegment.benefits.map((benefit, index) => (
                    <ListItem key={index} sx={{ px:  0 }}>
                      <ListItemIcon>
                        <CheckCircle sx={{ color: currentVideoSegment.color }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={benefit}
                        primaryTypographyProps={{
                          variant: 'body',
                          fontWeight: 5}}
                      />
                    </ListItem>
                  ))}
                </List>
              </Slide>

              {/* Progress Bar */}
              <Box sx={{ mb:  3 }}>
                <LinearProgress
                  variant="determinate"
                  value={(progress / currentVideoSegment.duration) * 100}
                  sx={{
                    height:  8,
                    borderRadius:  4,
                    bgcolor: `${currentVideoSegment.color}20`'& .MuiLinearProgress-bar': {
                      bgcolor: currentVideoSegment.color,
                      borderRadius:  4,
                  }}}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt:  1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(progress)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(currentVideoSegment.duration)}
                  </Typography>
                </Box>
              </Box>

              {/* Controls */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center'}}>
                <Button variant="contained"
                  startIcon={isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
                  onClick={handlePlayPause}
                  sx={{
                    bgcolor: currentVideoSegment.color'&:hover': { bgcolor: currentVideoSegment.color },
                    px:  4}}
                 sx={theming.getThemedButtonSx()}>
                  {isPlaying ? 'Pause' : 'Spill av'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ArrowForward />}
                  onClick={() => {
                    if (currentSegment < segments.length - 1) {
                      setCurrentSegment((prev) => prev + 1);
                      setProgress(0);
                  } else {
                      onComplete();
                  }
                }}
                  sx={{ px:  4 }}
                >
                  {currentSegment < segments.length - 1 ? 'Neste' : 'Fullfør'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Box>

      {/* Bottom Navigation */}
      <Box
        sx={{
          position: 'absolute',
          bottom:  0,
          left:  0,
          right:  0,
          p:  2,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'}}
      >
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb:  2 }}>
          {segments.map((_, index) => (
            <Chip
              key={index}
              label={`${index + 1}`}
              onClick={() => handleSegmentClick(index)}
              sx={{
                bgcolor: index === currentSegment ? currentVideoSegment.color : 'rgba(25,255,255,0.3)',
                color: index === currentSegment ? 'white' : 'rgba(25,255,255,0.7)',
                cursor: 'pointer', '&:hover': {
                  bgcolor: index === currentSegment ? currentVideoSegment.color : 'rgba(25,255,255,0.5)',
              }}}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap:  2 }}>
          <IconButton onClick={handleMuteToggle} sx={{ color: 'white'}}>
            {isMuted ? theming.getThemedIcon('volumeOff') : theming.getThemedIcon('volumeUp')}
          </IconButton>
          <IconButton onClick={handleFullscreenToggle} sx={{ color: 'white'}}>
            {isFullscreen ? theming.getThemedIcon('fullscreenExit') : theming.getThemedIcon('fullscreen')}
          </IconButton>
        </Box>
      </Box>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) }
          50% { transform: translateY(-20px) }
      }
      `}</style>
    </Box>
  );
}
