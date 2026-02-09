import React, { useState, useEffect } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { logger } from '../core/services/logger';

const log = logger.module('CustomerJourney, ');
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Dialog,
  DialogContent,
  TextField,
  DialogTitle,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  CameraAlt,
  Videocam,
  CheckCircle,
  TrendingUp,
  Speed,
  AttachMoney,
  EmojiObjects,
  Timeline as TimelineIcon,
  CloudUpload,
  Palette,
  ThreeDRotation,
  Movie,
  Share,
  AutoAwesome,
  Psychology,
  Add,
} from '@mui/icons-material';
import { brandColors } from '../assets/brandkit';
import { useVideoJourneyBridge } from '@/hooks/useVideoJourneyBridge';
import AIVideoGenerator from '@/components/admin/AIVideoGenerator';
import AIJourneyChatDialog from './AIJourneyChatDialog';
import { MovieCreation, SmartDisplay, VideoLibrary } from '@mui/icons-material';

interface JourneyStage {
  title: string;
  problem: string;
  solution: string;
  features: string[];
  benefits: string[];
  timeEstimate: string;
  icon: React.ReactNode;
}

interface Persona {
  name: string;
  role: string;
  avatar: string;
  goals: string[];
  painPoints: string[];
  journey: JourneyStage[];
}

const photographerJourney: JourneyStage[] = [
  {
    title: 'Pre-Production Planning',
    problem:
      'Spending hours setting up physical studios, testing lighting, and planning shoots. Expensive location scouting and setup costs.',
    solution:
      'Plan everything virtually before the actual shoot. Test different lighting setups, backgrounds, and camera angles in minutes.',
    features: [
      'Virtual studio environments','Lighting simulation','Camera angle preview','Equipment inventory planning',
    ],
    benefits: [
      'Save 5-8 hours per shoot','Reduce location costs by 60%','Test unlimited setups','Share previews with clients',
    ],
    timeEstimate: '30 mins vs 4-6 hours traditional',
    icon: <EmojiObjects />,
  },
  {
    title: 'Scene Composition',
    problem:
      'Difficult to visualize final composition. Multiple trial-and-error iterations waste time and client patience.',
    solution:
      'Create perfect compositions in 3D. See exactly how your shot will look before pressing the shutter.',
    features: [
      '3D scene builder','Real-time camera preview','Rule of thirds overlay','Golden ratio guides',
    ],
    benefits: [
      'Perfect composition every time','Reduce shoot time by 40%','Impress clients with previews','Save on reshoot costs',
    ],
    timeEstimate: '15 mins vs 1-2 hours on location',
    icon: <ThreeDRotation />,
  },
  {
    title: 'Lighting Design',
    problem:
      'Expensive lighting equipment. Complex setups. Inconsistent results. Need professional gaffer for complex scenes.',
    solution:
      'Design and test lighting virtually. Export exact specifications for real-world setup.',
    features: [
      '627 professional LUTs','Virtual lighting tools','Light meter simulation','HDRI environments',
    ],
    benefits: [
      'Test lighting before buying gear','Reproduce setups consistently','No gaffer needed','Professional color grading',
    ],
    timeEstimate: 'Instant vs 2-3 hours setup',
    icon: <Palette />,
  },
  {
    title: 'Client Presentation',
    problem:
      "Hard to explain vision to clients. Mood boards don't capture the exact look. Miscommunication leads to revisions.",
    solution:
      "Show clients exactly what they're getting. Interactive 3D previews they can explore.",
    features: [
      'Real-time scene preview','Export preview images','Share links with clients','Collaborative feedback',
    ],
    benefits: [
      'Get approval 2x faster','Reduce revision requests by 70%','Win more projects','Higher client satisfaction',
    ],
    timeEstimate: '10 mins vs multiple revision rounds',
    icon: <Share />,
  },
  {
    title: 'Post-Production',
    problem: 'Hours of editing. Color grading guesswork. Inconsistent look across series.',
    solution:
      'Apply professional LUTs and color grades. Export with watermarks. Maintain consistency.',
    features: [
      'GPU-accelerated LUT processing','Batch export','Watermark branding','Cloud backup',
    ],
    benefits: [
      'Reduce editing time by 50%','Consistent professional look','Branded exports','Never lose work',
    ],
    timeEstimate: '30 mins vs 3-4 hours',
    icon: <AutoAwesome />,
  },
];

const videographerJourney: JourneyStage[] = [
  {
    title: 'Pre-Visualization',
    problem:
      "Storyboards don't show exact camera movements. Hard to plan complex shots. Expensive to rent equipment for testing.",
    solution:
      'Create animated previsualization with exact camera paths. Test movements before the shoot.',
    features: [
      'Camera path recording','Timeline animation','Keyframe editor','Movement preview',
    ],
    benefits: [
      'Plan perfect camera moves','Share animatics with team','Reduce shoot days by 30%','Test before renting gear',
    ],
    timeEstimate: '1 hour vs 1-2 shoot days',
    icon: <Videocam />,
  },
  {
    title: 'Shot List Creation',
    problem:
      'Static shot lists miss crucial details. Hard to communicate with crew. Shots get missed on set.',
    solution:
      'Build interactive 3D shot list. Every shot is a saved scene with exact specifications.',
    features: [
      'Scene templates','Shot list management','Equipment requirements','Time estimates per shot',
    ],
    benefits: [
      'Never miss a shot','Efficient crew communication','Accurate time estimates','Professional organization',
    ],
    timeEstimate: '45 mins vs day-of confusion',
    icon: <TimelineIcon />,
  },
  {
    title: 'Camera Movement Planning',
    problem:
      'Complex moves require expensive motion control. Multiple takes waste time and budget. Difficult to replicate shots.',
    solution: 'Record perfect camera paths. Export motion data. Replay exact movements.',
    features: [
      'Smooth camera paths','Curve editor for precision','Path replay','Export to motion control',
    ],
    benefits: [
      'Perfect moves every time','Reduce takes by 60%','Replicate shots easily','Save motion control costs',
    ],
    timeEstimate: 'One-take perfection vs 10+ takes',
    icon: <Movie />,
  },
  {
    title: 'Multi-Angle Setup',
    problem:
      'Planning multi-camera shoots is complex. Expensive to rent multiple cameras. Coverage gaps discovered too late.',
    solution: 'Plan all camera angles virtually. Ensure complete coverage. Optimize camera count.',
    features: [
      'Multiple camera preview','Coverage analysis','Optimal positioning','Real-time switching',
    ],
    benefits: [
      'Optimize camera count','Ensure complete coverage','Reduce camera rental costs','Faster multi-cam setup',
    ],
    timeEstimate: '20 mins vs 2-3 hours on set',
    icon: <CameraAlt />,
  },
  {
    title: 'Color Grading & Export',
    problem:
      'Inconsistent color across clips. Time-consuming grading. Client revisions slow delivery.',
    solution: 'Apply professional LUTs. Real-time preview. Export with branding.',
    features: [
      '627 cinema-grade LUTs','Real-time color preview','Batch processing','Branded watermarks',
    ],
    benefits: [
      'Cinematic look instantly','Consistent color palette','Deliver 2x faster','Professional branding',
    ],
    timeEstimate: '1 hour vs 8-12 hours grading',
    icon: <Palette />,
  },
  {
    title: 'Collaboration & Delivery',
    problem: 'Sharing large files is slow. Client feedback is scattered. Version control issues.',
    solution: 'Cloud sync projects. Share preview links. Track changes automatically.',
    features: [
      'Google Drive integration','Project versioning','Share links with clients','Automatic backups',
    ],
    benefits: [
      'Seamless collaboration','Faster client approvals','Never lose work','Professional delivery',
    ],
    timeEstimate: 'Instant sharing vs file transfer delays',
    icon: <CloudUpload />,
  },
];

// Default personas (will be combined with AI-generated ones)
const defaultPersonas: Persona[] = [
  {
    name: 'Ingrid Solberg',
    role: 'Profesjonell Fotograf (Professional Photographer)',
    avatar: '📸',
    goals: [
      'Øke bookingrate (Increase booking rate)','Redusere forberedelsestid (Reduce preparation time)','Levere konsekvent kvalitet (Deliver consistent quality)','Skalere til flere kunder (Scale to more clients)',
    ],
    painPoints: [
      'Studiooppsett tar for lang tid (Studio setup takes too long)','Dyre lokasjonsbesøk (Expensive location scouting)','Kunderevisjon tar tid (Client revisions waste time)','Inkonsistent lysresultat (Inconsistent lighting results)',
    ],
    journey: photographerJourney,
  },
  {
    name: 'Lars Andersen',
    role: 'Kommersiell Videograf (Commercial Videographer)',
    avatar: '🎬',
    goals: [
      'Vinne større produksjoner (Win bigger productions)','Redusere produksjonskostnader (Reduce production costs)','Perfeksjonere komplekse kamerabevegelser (Perfect complex camera moves)','Raskere postproduksjon (Faster post-production)',
    ],
    painPoints: [
      'Pre-visualisering er tidkrevende (Pre-visualization is time-consuming)','Dyrt utstyrtest (Expensive equipment testing)','Tapte opptak under produksjon (Missed shots during production)','Lang fargegradingsprosess (Long color grading process)',
    ],
    journey: videographerJourney,
  },
];

export const CustomerJourneyBuilder: React.FC = () => {
  const [activePersona, setActivePersona] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [showVideoGenerator, setShowVideoGenerator] = useState(false);
  const [videoContext, setVideoContext] = useState<{
    stageTitle: string;
    stageContent: string;
    personaName: string;
  } | null>(null);

  // AI Journey Generation
  const [showJourneyDialog, setShowJourneyDialog] = useState(false);
  const [generatingJourney, setGeneratingJourney] = useState(false);
  const [customPersonaInput, setCustomPersonaInput] = useState({
    name: ',',
    role: '',
    goals: ', ',
    painPoints: ', ',
    industry: 'photography',
  });
  const [aiGeneratedPersonas, setAiGeneratedPersonas] = useState<Persona[]>([]);

  // Video Journey Bridge Integration
  const videoJourneyBridge = useVideoJourneyBridge();

  // Combine default and AI-generated personas
  const personas = [...defaultPersonas, ...aiGeneratedPersonas];

  const currentPersona = personas[activePersona];
  const currentStage = currentPersona.journey[activeStage];

  /**
   * Generate custom journey using Claude AI
   */
  const handleGenerateAIJourney = async () => {
    if (!customPersonaInput.name || !customPersonaInput.role) {
      alert('Please provide at least a name and role, ');
      return;
    }

    setGeneratingJourney(true);
    try {
      const prompt = `You are a customer journey expert. Generate a detailed 5-stage customer journey for CreatorHub Virtual Studio.

**Persona Details:**
- Name: ${customPersonaInput.name}
- Role: ${customPersonaInput.role}
- Industry: ${customPersonaInput.industry}
- Goals: ${customPersonaInput.goals || 'Improve workflow efficiency, deliver professional results'}
- Pain Points: ${customPersonaInput.painPoints || 'Time-consuming manual processes, inconsistent quality'}

**Context:**
CreatorHub Virtual Studio is a 3D virtual photography/videography platform with:
- Virtual studio environments
- Real-time lighting simulation
- 627 professional LUTs
- Camera angle preview
- GPU-accelerated rendering
- AI-powered tools

**Generate JSON with this structure:**
\`\`\`json
{
  "name":"${customPersonaInput.name}, ","role":"${customPersonaInput.role}, ","avatar" : "[appropriate emoji]","goals": ["goal1","goal2","goal3","goal4"]"painPoints": ["pain1","pain2","pain3","pain4"]"journey": [
    {
      "title":"Stage Name","problem":"Specific problem this persona faces at this stage","solution":"How Virtual Studio solves it","features": ["feature1","feature2","feature3","feature4"]"benefits": ["benefit1","benefit2","benefit3","benefit4"]"timeEstimate":"X mins vs Y hours traditional","icon" : "EmojiObjects"
    }
  ]
}
\`\`\`

**Requirements:**
1. Create 5 journey stages that flow logically (pre-production → execution → post-production)
2. Each problem should be specific and relatable
3. Solutions should reference actual Virtual Studio features
4. Benefits should include time/cost savings with realistic numbers
5. Icon should be one of: EmojiObjects, ThreeDRotation, Palette, Share, AutoAwesome, Videocam, CameraAlt
6. Make it personal and compelling

Return ONLY valid JSON, no explanations.`;

      // Call Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages, ', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-api-key':
            import.meta.env.VITE_ANTHROPIC_API_KEY ||
            import.meta.env.REACT_APP_ANTHROPIC_API_KEY ||
            ', ','anthropic-version' : '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const jsonText = data.content[0].text;

      // Extract JSON from markdown code blocks if present
      const jsonMatch =
        jsonText.match(/```json\s*([\s\S]*?)```/) || jsonText.match(/```\s*([\s\S]*?)```/);
      const cleanJson = jsonMatch ? jsonMatch[1] : jsonText;

      const personaData = JSON.parse(cleanJson);

      // Convert icon strings to React components
      const iconMap: Record<string, React.ReactNode> = {
        EmojiObjects: <EmojiObjects />,
        ThreeDRotation: <ThreeDRotation />,
        Palette: <Palette />,
        Share: <Share />,
        AutoAwesome: <AutoAwesome />,
        Videocam: <Videocam />,
        CameraAlt: <CameraAlt />,
      };

      personaData.journey = personaData.journey.map((stage: unknown) => ({
        ...stage,
        icon: iconMap[stage.icon] || <EmojiObjects />,
      }));

      // Add to personas list
      setAiGeneratedPersonas((prev) => [...prev, personaData]);
      setActivePersona(personas.length); // Switch to new persona
      setActiveStage(0);
      setShowJourneyDialog(false);

      // Reset form
      setCustomPersonaInput({
        name: ',',
        role: ', ',
        goals: ', ',
        painPoints: '',
        industry: 'photography',
      });
    } catch (error) {
      log.error('AI journey generation failed: ', error);
      alert(
        `Failed to generate journey: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setGeneratingJourney(false);
    }
  };

  const handleNext = () => {
    setActiveStage((prev) => Math.min(prev + 1, currentPersona.journey.length - 1));
  };

  const handleBack = () => {
    setActiveStage((prev) => Math.max(prev - 1, 0));
  };

  const calculateROI = () => {
    const timeSaved = currentPersona.journey.reduce((acc, stage) => {
      const match = stage.timeEstimate.match(/(\d+)/);
      return acc + (match ? parseInt(match[0]) : 0);
    }, 0);

    const hourlyRate = activePersona === 0 ? 150 : 250; // Photographer vs Videographer
    const monthlySavings = timeSaved * hourlyRate * 4; // 4 shoots per month

    return {
      timeSaved,
      monthlySavings,
      yearlyROI: monthlySavings * 12,
    };
  };

  const roi = calculateROI();

  const handleGenerateVideo = (stage: JourneyStage, personaName: string) => {
    setVideoContext({
      stageTitle: stage.title,
      stageContent: `${stage.problem}\n\n${stage.solution}\n\nFeatures: ${stage.features.join('')}`,
      personaName,
    });
    setShowVideoGenerator(true);
  };

  const handleVideoGenerated = (videoData: unknown) => {
    log.debug('Video generated:', videoData);
    // Track video generation
    analytics?.trackEvent('virtual-studio-video-generated', {
      stage: videoContext?.stageTitle,
      persona: videoContext?.personaName,
      timestamp: new Date().toISOString(),
    });
    setShowVideoGenerator(false);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
          Hvordan CreatorHub Virtual Studio
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 3, color: brandColors.primary.main }}>
          Transformerer Din Arbeidsflyt
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 800, mx: 'auto' }}>
          Se nøyaktig hvordan fotografer og videografer sparer tid, reduserer kostnader, og leverer
          bedre resultater med Virtual Studio
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Psychology />}
            onClick={() => setShowJourneyDialog(true)}
            sx={{
              background: 'linear-gradient(135deg, #8B5CF6, 0%, #6366F1, 100%)',
              color: '#fff',
              mt: 2}}
          >
            💬 Chat with AI to Create Journey
          </Button>
        </Box>
      </Box>

      {/* Persona Selector */}
      <Paper elevation={3} sx={{ mb: 4 }}>
        <Tabs
          value={activePersona}
          onChange={(_, v) => {
            setActivePersona(v);
            setActiveStage(0);
          }}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {personas.map((persona, index) => (
            <Tab
              key={index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                  <Avatar sx={{ bgcolor: brandColors.primary.main, width: 40, height: 40 }}>
                    {persona.avatar}
                  </Avatar>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                      {persona.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {persona.role}
                    </Typography>
                  </Box>
                </Box>
              }
            />
          ))}
        </Tabs>

        {/* Persona Overview */}
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <TrendingUp color="primary" /> Goals
              </Typography>
              <List dense>
                {currentPersona.goals.map((goal, i) => (
                  <ListItem key={i}>
                    <ListItemIcon>
                      <CheckCircle sx={{ color: brandColors.accent.green }} />
                    </ListItemIcon>
                    <ListItemText primary={goal} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Speed color="error" /> Pain Points
              </Typography>
              <List dense>
                {currentPersona.painPoints.map((pain, i) => (
                  <ListItem key={i}>
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: brandColors.functional.error}}
                      />
                    </ListItemIcon>
                    <ListItemText primary={pain} />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Journey Stages */}
      <Grid container spacing={4}>
        {/* Stepper */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, position: 'sticky', top: 20 }}>
            <Typography variant="h6" gutterBottom>
              Reisestadier (Journey Stages)
            </Typography>
            <Stepper activeStep={activeStage} orientation="vertical">
              {currentPersona.journey.map((stage, index) => (
                <Step key={index}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Avatar
                        sx={{
                          bgcolor:
                            index === activeStage
                              ? brandColors.primary.main
                              : index < activeStage
                                ? brandColors.accent.green
                                : brandColors.neutral.gray,
                          width: 32,
                          height: 32}}
                      >
                        {stage.icon}
                      </Avatar>
                    )}
                    onClick={() => setActiveStage(index)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: ndex === activeStage ? 700 : 400,
                        color: index === activeStage ? brandColors.primary.main : 'inherit'}}
                    >
                      {stage.title}
                    </Typography>
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            <Divider sx={{ my: 3 }} />

            {/* ROI Summary */}
            <Card sx={{ bgcolor: brandColors.alpha.light }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <AttachMoney /> Din ROI
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tid Spart Per Måned
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: brandColors.accent.green, fontWeight: 700}}
                  >
                    {roi.timeSaved} timer
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Inntektspotensial
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: brandColors.accent.green, fontWeight: 700}}
                  >
                    {roi.monthlySavings.toLocaleString()} kr/mnd
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Årlig Gevinst
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ color: brandColors.accent.green, fontWeight: 700}}
                  >
                    {roi.yearlyROI.toLocaleString()} kr
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Paper>
        </Grid>

        {/* Stage Details */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 4 }}>
            {/* Stage Header */}
            <Box sx={{ mb: 4 }}>
              <Chip
                label={`Stage ${activeStage + 1} of ${currentPersona.journey.length}`}
                size="small"
                sx={{ mb: 2 }}
              />
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700}}>
                {currentStage.title}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={((activeStage + 1) / currentPersona.journey.length) * 100}
                sx={{ height: 8, borderRadius: 4, mb: 3 }}
              />
            </Box>

            {/* Problem */}
            <Card
              sx={{
                mb: 3,
                bgcolor: '#FEF2F2',
                borderLeft: `4px solid ${brandColors.functional.error}`}}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: brandColors.functional.error }}>
                  ❌ The Problem
                </Typography>
                <Typography variant="body1">{currentStage.problem}</Typography>
              </CardContent>
            </Card>

            {/* Solution */}
            <Card
              sx={{
                mb: 3,
                bgcolor: '#F0FDF4',
                borderLeft: `4px solid ${brandColors.accent.green}`}}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: brandColors.accent.green }}>
                  ✅ Virtual Studio Solution
                </Typography>
                <Typography variant="body1">{currentStage.solution}</Typography>
              </CardContent>
            </Card>

            {/* Features & Benefits */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  🛠️ Features You'll Use
                </Typography>
                <List>
                  {currentStage.features.map((feature, i) => (
                    <ListItem key={i}>
                      <ListItemIcon>
                        <CheckCircle sx={{ color: brandColors.primary.main }} />
                      </ListItemIcon>
                      <ListItemText primary={feature} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  💎 Benefits You'll Get
                </Typography>
                <List>
                  {currentStage.benefits.map((benefit, i) => (
                    <ListItem key={i}>
                      <ListItemIcon>
                        <TrendingUp sx={{ color: brandColors.accent.green }} />
                      </ListItemIcon>
                      <ListItemText primary={benefit} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>

            {/* Time Comparison */}
            <Card sx={{ bgcolor: brandColors.alpha.medium, mb: 4 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Speed /> Time Comparison
                </Typography>
                <Typography variant="h5" sx={{ color: brandColors.accent.green, fontWeight: 700}}>
                  {currentStage.timeEstimate}
                </Typography>
              </CardContent>
            </Card>

            {/* AI Video Generation */}
            <Card
              sx={{
                bgcolor: '#F3E5F5',
                borderLeft: `4px solid ${brandColors.secondary.main}`,
                mb: 4}}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: brandColors.secondary.main}}
                >
                  <MovieCreation /> Generer AI Video (Generate AI Video)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Lag en profesjonell video som viser denne fasen av reisen din.
                  <br />
                  Create a professional video showcasing this journey stage.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<VideoLibrary />}
                  onClick={() => handleGenerateVideo(currentStage, currentPersona.name)}
                  sx={{
                    background: 'linear-gradient(135deg, #8B5CF6, 0%, #6366F1, 100%)',
                    color: '#fff'}}
                >
                  Generer Video for Denne Fasen
                </Button>
              </CardContent>
            </Card>

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} disabled={activeStage === 0} variant="outlined">
                Previous Stage
              </Button>
              <Button
                onClick={handleNext}
                disabled={activeStage === currentPersona.journey.length - 1}
                variant="contained"
                sx={{
                  background: brandColors.primary.gradient,
                  color: '#fff'}}
              >
                {activeStage === currentPersona.journey.length - 1
                  ? 'Journey Complete!' : 'Next Stage'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* AI Video Generator Dialog */}
      {showVideoGenerator && videoContext && (
        <AIVideoGenerator
          open={showVideoGenerator}
          onClose={() => setShowVideoGenerator(false)}
          initialPrompt={`Create a professional video for ${videoContext.personaName} showing: ${videoContext.stageTitle}\n\n${videoContext.stageContent}`}
          onVideoGenerated={handleVideoGenerated}
        />
      )}

      {/* AI Journey Chat Dialog */}
      <AIJourneyChatDialog
        open={showJourneyDialog}
        onClose={() => setShowJourneyDialog(false)}
        onJourneyGenerated={(journey) => {
          setAiGeneratedPersonas((prev) => [...prev, journey]);
          setActivePersona(personas.length); // Switch to new persona
          setActiveStage(0);
        }}
      />

      {/* Success Story */}
      {activeStage === currentPersona.journey.length - 1 && (
        <Paper elevation={3} sx={{ p: 4, mt: 4, bgcolor: brandColors.alpha.light }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, textAlign: 'center' }}>
            🎉 Suksess! {currentPersona.name} Transformerer Sin Virksomhet
          </Typography>
          <Typography
            variant="body1"
            sx={{ textAlign: 'center', mb: 3, maxWidth: 800, mx: 'auto' }}
          >
            Ved å bruke CreatorHub Virtual Studio gjennom hele arbeidsflyten, sparer{' '}
            {currentPersona.name} <strong>{roi.timeSaved} timer per måned</strong>, genererer{', '}
            <strong>{roi.monthlySavings.toLocaleString()} kr mer månedlig inntekt</strong>, og
            leverer konsekvent profesjonelle resultater som gleder kunder.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              size="large"
              sx={{ background: brandColors.primary.gradient, color:'#fff' }}
            >
              Start Din Reise (Start Your Journey)
            </Button>
            <Button variant="outlined" size="large" onClick={() => setActiveStage(0)}>
              Se Reisen Igjen (Replay Journey)
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default CustomerJourneyBuilder;
