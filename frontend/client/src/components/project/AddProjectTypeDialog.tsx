// @ts-nocheck
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Alert,
  Card,
  Chip,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Close as CloseIcon,
  Lightbulb,
  TrendingUp,
} from '@mui/icons-material';
import {
  RingIcon,
  PhotographyIcon,
  VideographyIcon,
  MusicProductionIcon,
  CorporateIcon,
  PhotographyIconAlt,
  Videocamcam,
  LibraryMusicNote,
  ShoppingDirectionsCart,
  InteractiveDocsIcon,
  AIIcon,
  CollaborationIcon,
  AnalyticsIcon,
  GamificationIcon,
  MobileIcon,
  CodeSandboxIcon,
  DiagramIcon,
  SimulationIcon,
  CustomizationIcon,
  ThemeEngineIcon,
  AnimationIcon,
  VisualEffectsIcon,
  AdvancedCustomizationIcon,
  AccessControlIcon,
  DataEncryptionIcon,
  PrivacyControlsIcon,
  SecurityIcon,
  APIIntegrationIcon,
  AcademyIcon,
  CourseIcon,
  LessonIcon,
  VideoPlayerIcon,
  ProgressIcon,
  BookmarkIcon,
  NoteIcon,
  CertificateIcon,
  QuizIcon,
  InstructorIcon,
  StudentIcon,
  LearningPathIcon,
  XRayIcon,
  QualityIcon,
  SpeedIcon,
  SubtitlesIcon,
  FullscreenIcon,
  VolumeIcon,
  MuteIcon,
  TestingFrameworkIcon,
  PerformanceMonitoringIcon,
  WebhookIcon,
  AnnotationIcon,
  HotspotIcon,
  CalloutIcon,
  ChapterIcon,
  ThumbnailIcon,
  AutoDetectIcon,
  VideoProcessingIcon,
  InteractiveElementIcon,
  VideoMarkerIcon,
  ContentCreationIcon,
  CameraTemplateIcon,
  CameraSetupIcon,
  TemplateManagerIcon,
} from '@/components/shared/CreatorHubIcons';

interface AddProjectTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; category: string; description: string }) => Promise<void>;
}

// Available custom SVG icons for selection (CreatorHub branded icons)
const AVAILABLE_ICONS = [
  // Wedding & Events
  { name: 'RingIcon', component: RingIcon, category: 'wedding', label: 'Wedding Ring' },
  { name: 'GamificationIcon', component: GamificationIcon, category: 'event', label: 'Event Star' },
  { name: 'CertificateIcon', component: CertificateIcon, category: 'event', label: 'Certificate' },

  // Photography
  { name: 'PhotographyIcon', component: PhotographyIcon, category: 'photography', label: 'Camera' },
  { name: 'PhotographyIconAlt', component: PhotographyIconAlt, category: 'photography', label: 'Camera Pro' },
  { name: 'CameraTemplateIcon', component: CameraTemplateIcon, category: 'photography', label: 'Camera Template' },
  { name: 'CameraSetupIcon', component: CameraSetupIcon, category: 'photography', label: 'Camera Setup' },

  // Videography
  { name: 'VideographyIcon', component: VideographyIcon, category: 'videography', label: 'Video Camera' },
  { name: 'Videocamcam', component: Videocamcam, category: 'videography', label: 'Video Pro' },
  { name: 'VideoPlayerIcon', component: VideoPlayerIcon, category: 'videography', label: 'Video Player' },
  { name: 'VideoProcessingIcon', component: VideoProcessingIcon, category: 'videography', label: 'Video Processing' },
  { name: 'SubtitlesIcon', component: SubtitlesIcon, category: 'videography', label: 'Subtitles' },

  // Music & Audio
  { name: 'MusicProductionIcon', component: MusicProductionIcon, category: 'music', label: 'Music Production' },
  { name: 'LibraryMusicNote', component: LibraryMusicNote, category: 'music', label: 'Music Library' },
  { name: 'VolumeIcon', component: VolumeIcon, category: 'music', label: 'Audio' },
  { name: 'MuteIcon', component: MuteIcon, category: 'music', label: 'Mute' },

  // Commercial & Business
  { name: 'CorporateIcon', component: CorporateIcon, category: 'commercial', label: 'Corporate' },
  { name: 'ShoppingDirectionsCart', component: ShoppingDirectionsCart, category: 'commercial', label: 'E-commerce' },
  { name: 'AnalyticsIcon', component: AnalyticsIcon, category: 'commercial', label: 'Analytics' },

  // Education & Academy
  { name: 'AcademyIcon', component: AcademyIcon, category: 'education', label: 'Academy' },
  { name: 'CourseIcon', component: CourseIcon, category: 'education', label: 'Course' },
  { name: 'LessonIcon', component: LessonIcon, category: 'education', label: 'Lesson' },
  { name: 'InstructorIcon', component: InstructorIcon, category: 'education', label: 'Instructor' },
  { name: 'StudentIcon', component: StudentIcon, category: 'education', label: 'Student' },
  { name: 'QuizIcon', component: QuizIcon, category: 'education', label: 'Quiz' },

  // Creative & Design
  { name: 'CustomizationIcon', component: CustomizationIcon, category: 'creative', label: 'Customization' },
  { name: 'ThemeEngineIcon', component: ThemeEngineIcon, category: 'creative', label: 'Theme' },
  { name: 'AnimationIcon', component: AnimationIcon, category: 'creative', label: 'Animation' },
  { name: 'VisualEffectsIcon', component: VisualEffectsIcon, category: 'creative', label: 'Visual Effects' },
  { name: 'ContentCreationIcon', component: ContentCreationIcon, category: 'creative', label: 'Content Creation' },

  // Technology & Development
  { name: 'AIIcon', component: AIIcon, category: 'technology', label: 'AI' },
  { name: 'CodeSandboxIcon', component: CodeSandboxIcon, category: 'technology', label: 'Code' },
  { name: 'APIIntegrationIcon', component: APIIntegrationIcon, category: 'technology', label: 'API' },
  { name: 'WebhookIcon', component: WebhookIcon, category: 'technology', label: 'Webhook' },
  { name: 'TestingFrameworkIcon', component: TestingFrameworkIcon, category: 'technology', label: 'Testing' },

  // Collaboration & Management
  { name: 'CollaborationIcon', component: CollaborationIcon, category: 'collaboration', label: 'Collaboration' },
  { name: 'TemplateManagerIcon', component: TemplateManagerIcon, category: 'collaboration', label: 'Template Manager' },
  { name: 'ProgressIcon', component: ProgressIcon, category: 'collaboration', label: 'Progress' },
  { name: 'LearningPathIcon', component: LearningPathIcon, category: 'collaboration', label: 'Learning Path' },

  // Documentation & Notes
  { name: 'InteractiveDocsIcon', component: InteractiveDocsIcon, category: 'documentation', label: 'Interactive Docs' },
  { name: 'BookmarkIcon', component: BookmarkIcon, category: 'documentation', label: 'Bookmark' },
  { name: 'NoteIcon', component: NoteIcon, category: 'documentation', label: 'Note' },
  { name: 'AnnotationIcon', component: AnnotationIcon, category: 'documentation', label: 'Annotation' },
  { name: 'ChapterIcon', component: ChapterIcon, category: 'documentation', label: 'Chapter' },

  // Quality & Performance
  { name: 'QualityIcon', component: QualityIcon, category: 'quality', label: 'Quality' },
  { name: 'SpeedIcon', component: SpeedIcon, category: 'quality', label: 'Speed' },
  { name: 'PerformanceMonitoringIcon', component: PerformanceMonitoringIcon, category: 'quality', label: 'Performance' },
  { name: 'XRayIcon', component: XRayIcon, category: 'quality', label: 'X-Ray' },
  { name: 'AutoDetectIcon', component: AutoDetectIcon, category: 'quality', label: 'Auto Detect' },

  // Security & Privacy
  { name: 'SecurityIcon', component: SecurityIcon, category: 'security', label: 'Security' },
  { name: 'AccessControlIcon', component: AccessControlIcon, category: 'security', label: 'Access Control' },
  { name: 'DataEncryptionIcon', component: DataEncryptionIcon, category: 'security', label: 'Encryption' },
  { name: 'PrivacyControlsIcon', component: PrivacyControlsIcon, category: 'security', label: 'Privacy' },

  // Interactive Elements
  { name: 'InteractiveElementIcon', component: InteractiveElementIcon, category: 'interactive', label: 'Interactive' },
  { name: 'HotspotIcon', component: HotspotIcon, category: 'interactive', label: 'Hotspot' },
  { name: 'CalloutIcon', component: CalloutIcon, category: 'interactive', label: 'Callout' },
  { name: 'VideoMarkerIcon', component: VideoMarkerIcon, category: 'interactive', label: 'Marker' },

  // Miscellaneous
  { name: 'MobileIcon', component: MobileIcon, category: 'other', label: 'Mobile' },
  { name: 'DiagramIcon', component: DiagramIcon, category: 'other', label: 'Diagram' },
  { name: 'SimulationIcon', component: SimulationIcon, category: 'other', label: 'Simulation' },
  { name: 'ThumbnailIcon', component: ThumbnailIcon, category: 'other', label: 'Thumbnail' },
  { name: 'FullscreenIcon', component: FullscreenIcon, category: 'other', label: 'Fullscreen' },
];

const CATEGORIES = [
  { value: 'photography', label: 'Fotografi', description: 'Fotoshoot, redigering, gallerier', examples: ['Bryllupsfotografering', 'Produktfotografi for E-handel', 'Korporativt Portretter'] },
  { value: 'videography', label: 'Videografi', description: 'Videoproduksjon og redigering', examples: ['Bryllupsdokumentar', 'Bedriftsportrett', 'Reel & Promotering'] },
  { value: 'music', label: 'Musikk', description: 'Musikkproduksjon og opptak', examples: ['EP Produksjon 2025', 'Single Release Kampanje', 'Remix & Mastering'] },
  { value: 'event', label: 'Arrangement', description: 'Arrangementer, show og forestillinger', examples: ['Festival Live Recording', 'Konferanse Direktestream', 'Musikal Produksjon'] },
  { value: 'commercial', label: 'Kommersiell', description: 'Kommersielt arbeid og tjenester', examples: ['TV Reklame Kampanje', 'Sosiale Medier Innhold', 'Influencer Partnership'] },
  { value: 'wedding', label: 'Bryllup', description: 'Bryllupsplanlegging og koordinering', examples: ['Sommerfestival Bryllup', 'Intim Seremont Pakke', 'Tre-dagers Bryllupsretreat'] },
  { value: 'education', label: 'Utdanning', description: 'Pedagogisk innhold og kurs', examples: ['Online Fotografi Kurs', 'Master Class Serie', 'Sertifiseringsprogram'] },
  { value: 'creative', label: 'Kreativ & Design', description: 'Design og kreative prosjekter', examples: ['Fullt Merke System', 'Webdesign Rebranding', 'Animert Illustrasjoner'] },
  { value: 'technology', label: 'Teknologi', description: 'Teknologiprosjekter og utvikling', examples: ['Mobilapp Utvikling', 'E-handel Platform', 'AI Integration Prosjekt'] },
  { value: 'collaboration', label: 'Samarbeid', description: 'Team og gruppeprosjekter', examples: ['Kunstnersamarbeid', 'Kryssfunksjonelt Prosjekt', 'Global Produksjon'] },
  { value: 'documentation', label: 'Dokumentasjon', description: 'Dokumentasjon og ressurser', examples: ['Merkebok & Retningslinjer', 'Mediearkiv Organisering', 'Case Study Samling'] },
  { value: 'quality', label: 'Kvalitet & Ytelse', description: 'Testing og kvalitetskontroll', examples: ['Video Kwalitet Assurance', 'Bruker Testing Rund', 'Ytelse Optimisering'] },
  { value: 'security', label: 'Sikkerhet & Personvern', description: 'Sikkerhet og compliance', examples: ['GDPR Compliance Audit', 'Datavern Policy', 'Sikkerhet Certificering'] },
  { value: 'interactive', label: 'Interaktiv', description: 'Interaktivt og dynamisk innhold', examples: ['Interaktiv Opplæring', 'Virtuell Turné', '360° Immersiv Opplevelse'] },
  { value: 'other', label: 'Annet', description: 'Andre prosjekttyper', examples: ['Spesialistprosjekt', 'Eksperimentell Series', 'Tverrkunstnerisk Initiativ'] },
  { value: 'custom', label: 'Tilpasset', description: 'Tilpasset prosjekttype', examples: ['Ditt Egendefinert Prosjekt', 'Unik Kombinasjon', 'Spesialisert Format'] },
];

const AddProjectTypeDialog: React.FC<AddProjectTypeDialogProps> = ({ open, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('PhotographyIcon');
  const [category, setCategory] = useState('custom');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconFilter, setIconFilter] = useState<string>('all');

  const isFormValid = name.trim().length > 0;
  const completionSteps = [
    { label: 'Name', completed: name.trim().length > 0 },
    { label: 'Icon', completed: selectedIcon !== '' },
    { label: 'Category', completed: category !== '' },
  ];
  const completionPercentage = (completionSteps.filter(s => s.completed).length / completionSteps.length) * 100;

  // Get category info
  const currentCategory = CATEGORIES.find(c => c.value === category);
  const categoryExamples = currentCategory?.examples || [];
  
  // Check if name matches an example
  const suggestedExample = categoryExamples.find(ex => name.toLowerCase().includes(ex.toLowerCase()));
  const showSuggestion = name.length > 0 && !suggestedExample && categoryExamples.length > 0;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Project type name is required');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        icon: selectedIcon,
        category,
        description: description.trim(),
      });
      
      // Reset form
      setName(', ');
      setSelectedIcon('Folder');
      setCategory('custom');
      setDescription(', ');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project type');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setName('');
      setSelectedIcon('Folder');
      setCategory('custom');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      // Ctrl/Cmd + Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isFormValid && !isSaving) {
        handleSave();
      }
      // Escape to close
      if (e.key === 'Escape' && !isSaving) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormValid, isSaving, open]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          background: '#fafbfc',
        }
      }}>
      <DialogTitle sx={{ 
        bgcolor: '#1565c0',
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: 700,
        py: 3,
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Opprett Tilpasset Prosjekttype</span>
        <IconButton 
          size="small" 
          onClick={handleClose}
          disabled={isSaving}
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Progress Bar */}
      <Box sx={{ px: 3, pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#333' }}>
            Fremdrift
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#1565c0' }}>
            {Math.round(completionPercentage)}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={completionPercentage}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: '#e0e0e0',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            }
          }}
        />
      </Box>

      <DialogContent sx={{ pt: 4, pb: 3 }}>
        <Box>
          {/* Error Alert */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderLeft: '4px solid',
                borderRadius: 1,
                bgcolor: 'rgba(211, 47, 47, 0.05)',
              }}>
              {error}
            </Alert>
          )}

          {/* Project Type Name */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600, 
                mb: 1.5,
                color: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
              Prosjekttypenavn
              {name.length > 0 && (
                <Chip 
                  label={`${name.length} tegn`} 
                  size="small" 
                  variant="outlined"
                  sx={{
                    borderColor: '#1565c0',
                    color: '#1565c0',
                    fontWeight: 600,
                  }}
                />
              )}
            </Typography>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              placeholder="f.eks. Eiendom, Mote, Sport"
              variant="outlined"
              size="small"
              autoFocus
              inputProps={{ maxLength: 100 }}
              helperText={`${name.length}/100 tegn • Vær beskrivende og spesifikk`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  transition: 'all 0.3s ease',
                  '&:hover fieldset': {
                    borderColor: '#1565c0',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1565c0',
                    borderWidth: 2,
                  }
                },
                '& .MuiInputBase-input': {
                  color: '#1a1a1a',
                  fontWeight: 500,
                },
                '& .MuiFormHelperText-root': {
                  fontSize: '0.75rem',
                  color: '#666',
                }
              }}
            />
            
            {/* Suggestions */}
            {showSuggestion && categoryExamples.length > 0 && (
              <Paper 
                elevation={0}
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  bgcolor: 'rgba(33, 150, 243, 0.05)',
                  border: '1px solid rgba(33, 150, 243, 0.2)',
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(33, 150, 243, 0.1)',
                    borderColor: 'rgba(33, 150, 243, 0.4)',
                  }
                }}
                onClick={() => setName(categoryExamples[0])}>
                <Lightbulb sx={{ fontSize: 20, color: '#1565c0' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: '#555', display: 'block', mb: 0.25, fontWeight: 500 }}>
                    Populært navn for {currentCategory?.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1565c0' }}>
                    {categoryExamples[0]}
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Icon Selection Section */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600, 
                mb: 2,
                color: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
              Velg Ikon
              <Chip 
                label={`${AVAILABLE_ICONS.length} ikoner`} 
                size="small"
                variant="outlined"
                sx={{ 
                  ml: 'auto',
                  borderColor: '#1565c0',
                  color: '#1565c0',
                  fontWeight: 600,
                }}
              />
            </Typography>

            {/* Icon Category Filter */}
            <FormControl fullWidth sx={{ mb: 2.5 }}>
              <InputLabel size="small">Filtrer etter Kategori</InputLabel>
              <Select 
                value={iconFilter} 
                onChange={(e) => setIconFilter(e.target.value)} 
                label="Filtrer etter Kategori"
                size="small"
                sx={{
                  borderRadius: 1.5,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#ddd',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1565c0',
                  },
                  '& .MuiSelect-select': {
                    color: '#1a1a1a',
                    fontWeight: 500,
                  }
                }}>
                <MenuItem value="all" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Alle Ikoner</MenuItem>
                <MenuItem value="wedding" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Bryllup & Arrangementer</MenuItem>
                <MenuItem value="photography" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Fotografi</MenuItem>
                <MenuItem value="videography" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Videografi</MenuItem>
                <MenuItem value="music" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Musikk & Lyd</MenuItem>
                <MenuItem value="commercial" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Kommersiell & Forretning</MenuItem>
                <MenuItem value="education" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Utdanning & Akademi</MenuItem>
                <MenuItem value="creative" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Kreativ & Design</MenuItem>
                <MenuItem value="technology" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Teknologi & Utvikling</MenuItem>
                <MenuItem value="collaboration" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Samarbeid & Ledelse</MenuItem>
                <MenuItem value="documentation" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Dokumentasjon & Notater</MenuItem>
                <MenuItem value="quality" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Kvalitet & Ytelse</MenuItem>
                <MenuItem value="security" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Sikkerhet & Personvern</MenuItem>
                <MenuItem value="interactive" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Interaktive Elementer</MenuItem>
                <MenuItem value="other" sx={{ color: 'white', fontWeight: 500, fontSize: '0.95rem', bgcolor: '#2c2c2c', '&:hover': { bgcolor: '#1565c0' } }}>Diverse</MenuItem>
              </Select>
            </FormControl>

            {/* Icon Grid */}
            <Card 
              sx={{ 
                maxHeight: 280, 
                overflowY: 'auto', 
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                p: 2, 
                bgcolor: '#fafbfc',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: '#ddd',
                  borderRadius: '4px',
                  '&:hover': {
                    bgcolor: '#bbb',
                  }
                }
              }}>
              <Grid container spacing={1}>
                {AVAILABLE_ICONS
                  .filter(icon => iconFilter === 'all' || icon.category === iconFilter)
                  .map((icon) => {
                    const IconComponent = icon.component;
                    const isSelected = selectedIcon === icon.name;
                    
                    // Color mapping based on category (matching landing page colors)
                    const getCategoryColor = (category: string) => {
                      const colorMap: { [key: string]: string } = {
                        'photography': '#2e7d32',        // Green (Photographer)
                        'videography': '#1565c0',        // Blue (Videographer)
                        'music': '#7b1fa2',              // Dark Purple (Music Producer)
                        'commercial': '#ff8c00',         // Orange (Vendor)
                        'event': '#e65100',              // Orange (Events)
                        'wedding': '#2e7d32',            // Green
                        'education': '#1565c0',          // Blue
                        'creative': '#7b1fa2',           // Dark Purple
                        'technology': '#ff8c00',         // Orange
                        'collaboration': '#2e7d32',      // Green
                        'documentation': '#1565c0',      // Blue
                        'quality': '#7b1fa2',            // Dark Purple
                        'security': '#ff8c00',           // Orange
                        'interactive': '#e65100',        // Orange
                        'other': '#2e7d32'               // Green
                      };
                      return colorMap[category] || '#2e7d32';
                    };
                    
                    const categoryColor = getCategoryColor(icon.category);
                    
                    // Convert hex to RGB for gradients
                    const hexToRgb = (hex: string) => {
                      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                      return result ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16)
                      } : { r: 46, g: 125, b: 50 }; // Default green
                    };
                    
                    const rgb = hexToRgb(categoryColor);
                    
                    return (
                      <Grid item xs={3} sm={2.4} key={icon.name}>
                        <Box
                          onClick={() => setSelectedIcon(icon.name)}
                          title={icon.label}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            aspectRatio: '1',
                            border: isSelected ? '2px solid' : '1px solid',
                            borderColor: isSelected ? categoryColor : '#ddd',
                            borderRadius: 2,
                            bgcolor: isSelected ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)` : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden',
                            '&::before': isSelected ? {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: `radial-gradient(circle at top-left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1), transparent)`,
                              pointerEvents: 'none',
                            } : {},
                            '&:hover': {
                              bgcolor: isSelected ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)` : '#f8f9fa',
                              borderColor: categoryColor,
                              transform: 'scale(1.08) translateY(-2px)',
                              boxShadow: isSelected ? `0 8px 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)` : '0 4px 12px rgba(0, 0, 0, 0.08)',
                            },
                            '&:active': {
                              transform: 'scale(0.96)',
                            }
                          }}>
                          <IconComponent sx={{ 
                            fontSize: 32, 
                            color: categoryColor,
                            transition: 'all 0.3s ease',
                          }} />
                          {isSelected && (
                            <CheckCircle 
                              sx={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                fontSize: 20,
                                color: categoryColor,
                                bgcolor: 'white',
                                borderRadius: '50%',
                              }}
                            />
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
              </Grid>
              {AVAILABLE_ICONS.filter(icon => iconFilter === 'all' || icon.category === iconFilter).length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  Ingen ikoner funnet i denne kategorien
                </Typography>
              )}
            </Card>

            {/* Show selected icon name */}
            {(() => {
              // Get selected icon color for preview
              const selectedIconData = AVAILABLE_ICONS.find(i => i.name === selectedIcon);
              const getCategoryColorForPreview = (category: string) => {
                const colorMap: { [key: string]: string } = {
                  'photography': '#2e7d32',
                  'videography': '#1565c0',
                  'music': '#7b1fa2',
                  'commercial': '#ff8c00',
                  'event': '#e65100',
                  'wedding': '#2e7d32',
                  'education': '#1565c0',
                  'creative': '#7b1fa2',
                  'technology': '#ff8c00',
                  'collaboration': '#2e7d32',
                  'documentation': '#1565c0',
                  'quality': '#7b1fa2',
                  'security': '#ff8c00',
                  'interactive': '#e65100',
                  'other': '#2e7d32'
                };
                return colorMap[category] || '#2e7d32';
              };
              
              const previewColor = selectedIconData ? getCategoryColorForPreview(selectedIconData.category) : '#2e7d32';
              
              // Convert hex to RGB for preview
              const hexToRgbPreview = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16)
                } : { r: 46, g: 125, b: 50 };
              };
              
              const previewRgb = hexToRgbPreview(previewColor);
              
              return (
                <Paper 
                  elevation={0}
                  sx={{ 
                    mt: 2.5, 
                    p: 3,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2.5,
                    bgcolor: `rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.08)`,
                    border: `2px solid rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.2)`,
                    borderRadius: 2.5,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -50,
                      right: -50,
                      width: 200,
                      height: 200,
                      borderRadius: '50%',
                      background: `radial-gradient(circle, rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.08), transparent)`,
                      pointerEvents: 'none',
                    },
                    '&:hover': {
                      borderColor: `rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.4)`,
                      bgcolor: `rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.12)`,
                      boxShadow: `0 8px 24px rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.15)`,
                    }
                  }}>
                  {/* Icon Display Box */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 80,
                      height: 80,
                      borderRadius: 2,
                      background: previewColor,
                      boxShadow: `0 8px 24px rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.35)`,
                      position: 'relative',
                      flexShrink: 0,
                      animation: 'float 3s ease-in-out infinite',
                      '@keyframes float': {
                        '0%, 100%': { transform: 'translateY(0px)' },
                        '50%': { transform: 'translateY(-8px)' },
                      }
                    }}>
                    {(() => {
                      const icon = AVAILABLE_ICONS.find(i => i.name === selectedIcon);
                      const IconComponent = icon?.component;
                      return IconComponent ? <IconComponent sx={{ fontSize: 44, color: 'white' }} /> : null;
                    })()}
                    
                    {/* Glow Effect */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 2,
                        background: 'radial-gradient(circle at top-left, rgba(255,255,255,0.3), transparent)',
                        pointerEvents: 'none',
                      }}
                    />
                  </Box>

                  {/* Text Info */}
                  <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: previewColor, 
                        display: 'block', 
                        mb: 0.75,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                      ✓ Selected Icon
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 700, 
                        color: '#333',
                        mb: 1.5,
                      }}>
                      {AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}
                    </Typography>

                    {/* Preview Summary */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Chip 
                          label={AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.category || 'default'} 
                          size="small" 
                          variant="outlined"
                          sx={{
                            height: 24,
                            fontSize: '0.7rem',
                            textTransform: 'capitalize',
                            borderColor: previewColor,
                            color: previewColor,
                          }}
                        />
                      </Box>
                      {name.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Chip 
                            label={name} 
                            size="small" 
                            variant="filled"
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              bgcolor: `rgba(${previewRgb.r}, ${previewRgb.g}, ${previewRgb.b}, 0.15)`,
                              color: previewColor,
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Decorative Element */}
                  <Box
                    sx={{
                      display: 'none',
                    }}
                  />
                </Paper>
              );
            })()}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Category Selection */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600, 
                mb: 1.5,
                color: '#1a1a1a'
              }}>
              Kategori
            </Typography>
            <FormControl fullWidth>
              <InputLabel size="small">Velg Kategori</InputLabel>
              <Select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                label="Velg Kategori"
                size="small"
                sx={{
                  borderRadius: 1.5,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#ddd',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1565c0',
                  },
                  '& .MuiSelect-select': {
                    color: '#1a1a1a',
                    fontWeight: 500,
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiSelect-select': {
                    color: '#1a1a1a',
                  }
                }}>
                {CATEGORIES.map((cat) => (
                  <MenuItem 
                    key={cat.value} 
                    value={cat.value} 
                    title={cat.description}
                    sx={{
                      bgcolor: '#2c2c2c',
                      color: 'white',
                      '&:hover': {
                        bgcolor: '#1565c0',
                      },
                      py: 1.5,
                    }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>
                        {cat.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 400, fontSize: '0.8rem' }}>
                        {cat.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Category Info */}
            {currentCategory && (
              <Paper 
                elevation={0}
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'rgba(102, 126, 234, 0.05)',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  borderRadius: 1.5,
                }}>
                <Typography variant="caption" sx={{ color: '#555', display: 'block', mb: 0.75, fontWeight: 600 }}>
                  📋 Eksempel på prosjektnavn
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {currentCategory.examples.map((example, idx) => (
                    <Chip
                      key={idx}
                      label={example}
                      size="small"
                      onClick={() => setName(example)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: 'rgba(21, 101, 192, 0.1)',
                        color: '#1565c0',
                        fontWeight: 500,
                        '&:hover': {
                          bgcolor: 'rgba(21, 101, 192, 0.15)',
                        }
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            )}
          </Box>

          {/* Description Field */}
          <Box sx={{ mb: 2 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600, 
                mb: 1.5,
                color: '#333',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
              Beskrivelse
              <Typography variant="caption" sx={{ fontWeight: 400, color: '#666' }}>
                (Valgfritt)
              </Typography>
              {description.length > 0 && <Chip label={`${description.length} tegn`} size="small" variant="outlined" />}
            </Typography>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Beskriv hva denne prosjekttypen er for og bruksområdene..."
              variant="outlined"
              size="small"
              inputProps={{ maxLength: 300 }}
              helperText={`${description.length}/300 tegn • Hjelp teammedlemmer å forstå denne prosjekttypen`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  transition: 'all 0.3s ease',
                  '&:hover fieldset': {
                    borderColor: '#667eea',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#667eea',
                    borderWidth: 2,
                  }
                },
                '& .MuiFormHelperText-root': {
                  fontSize: '0.75rem',
                  color: '#666',
                }
              }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: '#666', ml: 1 }}>
          <kbd style={{ 
            padding: '2px 6px', 
            bgcolor: '#f0f0f0', 
            border: '1px solid #ddd', 
            borderRadius: 3,
            fontSize: '0.7rem',
            fontFamily: 'monospace',
          }}>⌘+↵</kbd> for å lagre
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button 
            onClick={handleClose} 
            disabled={isSaving}
            variant="outlined"
            sx={{ 
              textTransform: 'none', 
              fontWeight: 600,
              borderColor: '#e0e0e0',
              color: '#666',
              borderRadius: 1.5,
              py: 1.2,
              '&:hover': {
                bgcolor: '#f5f5f5',
                borderColor: '#bbb',
              },
              '&:disabled': {
                bgcolor: '#f5f5f5',
              }
            }}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={isSaving || !isFormValid}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '1rem',
              py: 1.2,
              px: 3,
              borderRadius: 1.5,
              background: isFormValid ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc',
              boxShadow: isFormValid ? '0 6px 20px rgba(102, 126, 234, 0.35)' : 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: isFormValid ? '0 8px 28px rgba(102, 126, 234, 0.45)' : 'none',
                transform: isFormValid ? 'translateY(-2px)' : 'none',
              },
              '&:active': {
                transform: isFormValid ? 'translateY(0)' : 'none',
              },
              '&:disabled': {
                background: '#ccc',
                boxShadow: 'none',
              }
            }}>
            {isSaving ? 'Oppretter...' : 'Opprett'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AddProjectTypeDialog;

