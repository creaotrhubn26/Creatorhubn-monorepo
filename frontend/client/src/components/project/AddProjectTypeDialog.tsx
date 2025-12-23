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
} from '@mui/material';
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
  { value: 'photography', label: 'Photography' },
  { value: 'videography', label: 'Videography' },
  { value: 'music', label: 'Music' },
  { value: 'event', label: 'Event' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'education', label: 'Education' },
  { value: 'creative', label: 'Creative & Design' },
  { value: 'technology', label: 'Technology' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'quality', label: 'Quality & Performance' },
  { value: 'security', label: 'Security & Privacy' },
  { value: 'interactive', label: 'Interactive' },
  { value: 'other', label: 'Other' },
  { value: 'custom', label: 'Custom' },
];

const AddProjectTypeDialog: React.FC<AddProjectTypeDialogProps> = ({ open, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('PhotographyIcon');
  const [category, setCategory] = useState('custom');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconFilter, setIconFilter] = useState<string>('all');

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

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Custom Project Type</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="Project Type Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            sx={{ mb: 3 }}
            placeholder="e.g., Real Estate, Fashion, Sports"
          />

          <Typography variant="subtitle2" gutterBottom>
            Select Icon ({AVAILABLE_ICONS.length} custom SVG icons available)
          </Typography>

          {/* Icon Category Filter */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Filter by Category</InputLabel>
            <Select value={iconFilter} onChange={(e) => setIconFilter(e.target.value)} label="Filter by Category">
              <MenuItem value="all">All Icons</MenuItem>
              <MenuItem value="wedding">Wedding & Events</MenuItem>
              <MenuItem value="photography">Photography</MenuItem>
              <MenuItem value="videography">Videography</MenuItem>
              <MenuItem value="music">Music & Audio</MenuItem>
              <MenuItem value="commercial">Commercial & Business</MenuItem>
              <MenuItem value="education">Education & Academy</MenuItem>
              <MenuItem value="creative">Creative & Design</MenuItem>
              <MenuItem value="technology">Technology & Development</MenuItem>
              <MenuItem value="collaboration">Collaboration & Management</MenuItem>
              <MenuItem value="documentation">Documentation & Notes</MenuItem>
              <MenuItem value="quality">Quality & Performance</MenuItem>
              <MenuItem value="security">Security & Privacy</MenuItem>
              <MenuItem value="interactive">Interactive Elements</MenuItem>
              <MenuItem value="other">Miscellaneous</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mb: 3, maxHeight: 300, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 1, p: 2, bgcolor: '#f9f9f9' }}>
            <Grid container spacing={1}>
              {AVAILABLE_ICONS
                .filter(icon => iconFilter === 'all' || icon.category === iconFilter)
                .map((icon) => {
                  const IconComponent = icon.component;
                  return (
                    <Grid item key={icon.name}>
                      <IconButton
                        onClick={() => setSelectedIcon(icon.name)}
                        title={icon.label}
                        sx={{
                          border: selectedIcon === icon.name ? '3px solid' : '1px solid',
                          borderColor: selectedIcon === icon.name ? 'primary.main' : '#ddd',
                          borderRadius: 1,
                          bgcolor: selectedIcon === icon.name ? 'primary.light' : 'white', '&:hover': {
                            bgcolor: selectedIcon === icon.name ? 'primary.light' : '#f0f0f0',
                            borderColor: 'primary.main',
                          }}}
                      >
                        <IconComponent sx={{ fontSize: 28 }} />
                      </IconButton>
                    </Grid>
                  );
                })}
            </Grid>
            {AVAILABLE_ICONS.filter(icon => iconFilter === 'all' || icon.category === iconFilter).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No icons found in this category
              </Typography>
            )}
          </Box>

          {/* Show selected icon name */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
            Selected: {AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.label || selectedIcon}
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Category</InputLabel>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Category">
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Describe what this project type is for..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={isSaving || !name.trim()}>
          {isSaving ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddProjectTypeDialog;

