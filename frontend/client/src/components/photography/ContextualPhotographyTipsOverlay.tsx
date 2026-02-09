import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Tooltip,
  Fab,
  Slide,
  Paper
} from '@mui/material';
import {
  PhotoCamera,
  Lightbulb,
  Settings,
  Close,
  WbSunny,
  NightsStay,
  Cloud,
  Landscape,
  Portrait,
  CameraAlt,
  Timer,
  Iso,
  CameraRoll,
  FlashOn,
  FlashOff,
  Tune,
  Help,
  Star,
  BookmarkAdd,
  Share
} from '@mui/icons-material';

interface PhotographyTip {
  id: string;
  title: string;
  description: string;
  category: 'exposure' | 'composition' | 'lighting' | 'equipment' | 'technique';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  context: string[];
  cameraSettings?: {
    aperture?: string;
    shutter?: string;
    iso?: string;
    focus?: string;
};
  relevanceScore: number
}

interface ShootingContext {
  lightCondition: 'bright_sunlight' | 'overcast' | 'golden_hour' | 'blue_hour' | 'indoor' | 'low_light';
  subject: 'portrait' | 'landscape' | 'macro' | 'street' | 'event' | 'product' | 'architecture';
  camera: string;
  lens: string;
  experience: 'beginner' | 'intermediate' | 'advanced'
}

interface ContextualPhotographyTipsOverlayProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const ContextualPhotographyTipsOverlay: React.FC<ContextualPhotographyTipsOverlayProps> = ({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate,
  profession = 'photographer'
}) => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const [currentTips, setCurrentTips] = useState<PhotographyTip[]>([]);
  const [context, setContext] = useState<ShootingContext>({
    lightCondition: 'bright_sunlight',
    subject: 'portrait',
    camera: 'Canon EOS R',
    lens: '85mm f/1.',
    experience: 'intermediate'
});
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [savedTips, setSavedTips] = useState<string[]>([]);

  // Listen for SpeedDial trigger
  useEffect(() => {
    const handleOpenTips = () => {
      setIsOverlayOpen(true);
  };

    window.addEventListener('openPhotographyTips, ', handleOpenTips);

    return () => {
      window.removeEventListener('openPhotographyTips,', handleOpenTips);
  };
}, []);

  const photographyTips: PhotographyTip[] = [
    {
      id: 'portrait-shallow-dof',
      title: 'Bruk lav blenderverdi for portrettfokus',
      description: 'Ved f/1.4-f/2.8 får du en vakker bakgrunnsunnskarphet som fremhever motivet',
      category: 'technique',
      difficulty: 'beginner',
      context: ['portrait','bright_sunlight','golden_hour'],
      cameraSettings: {
        aperture: 'f/1.4 - f/2.8',
        shutter: '1/125s eller raskere',
        focus: 'Single point AF på øyet'
  },
      relevanceScore: 95 },
    {
      id: 'golden-hour-warmth',
      title: 'Utnytt gylden time for varme toner',
      description: 'En time før solnedgang gir perfekt varmt lys for portretter og landskap',
      category: 'lighting',
      difficulty: 'beginner',
      context: ['golden_hour','portrait','landscape'],
      cameraSettings: {
        iso: 'ISO 100-40',
        aperture: 'f/5.6 - f/8 for landskap'
  },
      relevanceScore: 90 },
    {
      id: 'low-light-stabilization',
      title: 'Bildestabilisering og høy ISO for svakt lys',
      description: 'Bruk bildestabilisering og ISO 1600-6400 for håndholdt fotografering i svakt lys',
      category: 'technique',
      difficulty: 'intermediate',
      context: ['low_light','blue_hour','indoor'],
      cameraSettings: {
        iso: 'ISO 1600-6400',
        shutter: '1/60s med stabilisering',
        aperture: 'Største blender (lavest f-tall)'
      },
      relevanceScore: 85
    },
    {
      id: 'rule-of-thirds',
      title: 'Tredjedelsregelen for sterkere komposisjon',
      description: 'Plasser viktige elementer langs 1/3-linjene for mer dynamiske bilder',
      category: 'composition',
      difficulty: 'beginner',
      context: ['landscape','portrait','street','architecture'],
      relevanceScore: 80
    },
    {
      id: 'macro-focus-stacking',
      title: 'Fokusering for makrofotografering',
      description: 'Bruk manual fokus og eventuelt focus stacking for skarp makro',
      category: 'technique',
      difficulty: 'advanced',
      context: ['macro'],
      cameraSettings: {
        aperture: 'f/8 - f/11',
        focus: 'Manual fokus',
        shutter: 'Bruk stativ'
      },
      relevanceScore: 88
    },
    {
      id: 'overcast-soft-light',
      title: 'Overskyet vær gir mykt lys',
      description: 'Skyer fungerer som en naturlig softbox - perfekt for portretter',
      category: 'lighting',
      difficulty: 'beginner',
      context: ['overcast','portrait'],
      cameraSettings: {
        iso: 'ISO 200-800',
        aperture: 'f/2.8 - f/4'
      },
      relevanceScore: 75
    }
  ];

  const getContextualTips = (currentContext: ShootingContext): PhotographyTip[] => {
    return photographyTips
      .filter(tip => {
        return tip.context.some(ctx => 
          ctx === currentContext.lightCondition || 
          ctx === currentContext.subject
        );
  })
      .filter(tip => {
        if (currentContext.experience === 'beginner') {
          return tip.difficulty !== 'advanced';
      }
        return true;
    })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 4);
};

  useEffect(() => {
    if (autoSuggest) {
      const tips = getContextualTips(context);
      setCurrentTips(tips);
  }
}, [context, autoSuggest]);

  const handleSaveTip = (tipId: string) => {
    if (!savedTips.includes(tipId)) {
      setSavedTips([...savedTips, tipId]);
      
      // Trigger unified workflow callbacks
      const tip = photographyTips.find(t => t.id === tipId);
      if (tip) {
        onProjectUpdate?.({
          type: 'photography_tip_saved',
          tip: tip,
          context: context,
          timestamp: new Date().toISOString()
    });
        onNotificationCreate?.({
          type: 'tip_saved',
          message: `Photography tip "${tip.title}" saved to your collection`,
          timestamp: new Date().toISOString()
    });
    }
  }
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'exposure': return <CameraAlt />;
      case 'composition': return <CameraRoll />;
      case 'lighting': return theming.getThemedIcon(',');
      case 'equipment': return theming.getThemedIcon('settings');
      case 'technique': return theming.getThemedIcon('tune');
      default: return theming.getThemedIcon(', ');
  }
};

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
}
};

  const getLightConditionIcon = (condition: string) => {
    switch (condition) {
      case 'bright_sunlight': return theming.getThemedIcon(', ');
      case 'overcast': return <Cloud />;
      case 'golden_hour': return <WbSunny style={{ color: '#ffa726' }} />;
      case 'blue_hour': return <NightsStay />;
      case 'indoor': return theming.getThemedIcon('settings');
      case 'low_light': return <NightsStay />;
      default: return theming.getThemedIcon(', ');
  }
};

  return (
    <Box>
      {/* Main Overlay Dialog */}
      <Dialog
        open={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '80vh',
            bgcolor: 'background.default'
      }
      }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Lightbulb />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Kontekstuelle Fotograferingstips`
                : 'Kontekstuelle Fotograferingstips'}
            </Typography>
          </Box>
          <IconButton onClick={() => setIsOverlayOpen(false)}>
            {theming.getThemedIcon('close')}
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={3}>
            {/* Context Configuration */}
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                    {theming.getThemedIcon('settings')}
                    Fotograferingskontekst
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControl fullWidth>
                        <InputLabel>Lysforhold</InputLabel>
                        <Select
                          value={context.lightCondition}
                          onChange={(e) => setContext({...context, lightCondition: e.target.value as any})}
                        >
                          <MenuItem value="bright_sunlight">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              {theming.getThemedIcon('wbSunny')}
                              Sterkt sollys
                            </Box>
                          </MenuItem>
                          <MenuItem value="overcast">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Cloud />
                              Overskyet
                            </Box>
                          </MenuItem>
                          <MenuItem value="golden_hour">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <WbSunny style={{ color: '#ffa726' }} />
                              Gylden time
                            </Box>
                          </MenuItem>
                          <MenuItem value="blue_hour">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <NightsStay />
                              Blå time
                            </Box>
                          </MenuItem>
                          <MenuItem value="indoor">Innendørs</MenuItem>
                          <MenuItem value="low_light">Svakt lys</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControl fullWidth>
                        <InputLabel>Motiv</InputLabel>
                        <Select
                          value={context.subject}
                          onChange={(e) => setContext({...context, subject: e.target.value as any})}
                        >
                          <MenuItem value="portrait">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Portrait />
                              Portrett
                            </Box>
                          </MenuItem>
                          <MenuItem value="landscape">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Landscape />
                              Landskap
                            </Box>
                          </MenuItem>
                          <MenuItem value="macro">Makro</MenuItem>
                          <MenuItem value="street">Gate</MenuItem>
                          <MenuItem value="event">Event</MenuItem>
                          <MenuItem value="product">Produkt</MenuItem>
                          <MenuItem value="architecture">Arkitektur</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControl fullWidth>
                        <InputLabel>Kamera</InputLabel>
                        <Select
                          value={context.camera}
                          onChange={(e) => setContext({...context, camera: e.target.value})}
                        >
                          <MenuItem value="Canon EOS R5">Canon EOS R5</MenuItem>
                          <MenuItem value="Sony A7R V">Sony A7R V</MenuItem>
                          <MenuItem value="Nikon Z9">Nikon Z9</MenuItem>
                          <MenuItem value="Fujifilm X-T5">Fujifilm X-T5</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <FormControl fullWidth>
                        <InputLabel>Erfaring</InputLabel>
                        <Select
                          value={context.experience}
                          onChange={(e) => setContext({...context, experience: e.target.value as any})}
                        >
                          <MenuItem value="beginner">Nybegynner</MenuItem>
                          <MenuItem value="intermediate">Middels</MenuItem>
                          <MenuItem value="advanced">Avansert</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt:  2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoSuggest}
                          onChange={(e) => setAutoSuggest(e.target.checked)}
                        />
                    }
                      label="Automatiske forslag basert på kontekst"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Current Context Tips */}
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                {getLightConditionIcon(context.lightCondition)}
                Tips for gjeldende situasjon
              </Typography>

              <Grid container spacing={2}>
                {currentTips.map((tip) => (
                  <Grid size={{ xs: 12 }} md={6} key={tip.id}>
                    <Card variant="outlined" sx={{ ...theming.getThemedCardSx(), height: '100%' }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                            {getCategoryIcon(tip.category)}
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {tip.title}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5}}>
                            <Chip
                              label={tip.difficulty}
                              color={getDifficultyColor(tip.difficulty)}
                              size="small"
                            />
                            <Chip
                              icon={theming.getThemedIcon('star')}
                              label={tip.relevanceScore}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        </Box>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {tip.description}
                        </Typography>

                        {tip.cameraSettings && (
                          <Paper variant="outlined" sx={{ ...theming.getThemedCardSx(), p: 1, mb: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                              Anbefalte innstillinger:
                            </Typography>
                            {tip.cameraSettings.aperture && (
                              <Typography variant="caption" sx={{ display: 'block' }}>
                                📷 Blender: {tip.cameraSettings.aperture}
                              </Typography>
                            )}
                            {tip.cameraSettings.shutter && (
                              <Typography variant="caption" sx={{ display: 'block' }}>
                                ⚡ Lukkertid: {tip.cameraSettings.shutter}
                              </Typography>
                            )}
                            {tip.cameraSettings.iso && (
                              <Typography variant="caption" sx={{ display: 'block' }}>
                                📊 ISO: {tip.cameraSettings.iso}
                              </Typography>
                            )}
                            {tip.cameraSettings.focus && (
                              <Typography variant="caption" sx={{ display: 'block' }}>
                                🎯 Fokus: {tip.cameraSettings.focus}
                              </Typography>
                            )}
                          </Paper>
                        )}

                        <Box sx={{ display: 'flex', gap:  1 }}>
                          <Button
                            size="small"
                            startIcon={<BookmarkAdd />}
                            onClick={() => handleSaveTip(tip.id)}
                            disabled={savedTips.includes(tip.id)}
                          >
                            {savedTips.includes(tip.id) ? 'Lagret' : 'Lagre'}
                          </Button>
                          <Button
                            size="small"
                            startIcon={theming.getThemedIcon('share')}
                          >
                            Del
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {/* Quick Tips */}
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  💡 Tips endres automatisk basert på valgt lysforhold, motiv og erfaringsnivå. 
                  Bruk lagre-funksjonen for å samle dine favoritt-tips.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setIsOverlayOpen(false)}>
            Lukk
          </Button>
          <Button variant="contained" startIcon={<Help />}>
            Mer hjelp
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContextualPhotographyTipsOverlay;