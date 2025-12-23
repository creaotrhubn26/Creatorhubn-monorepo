/**
 * Publish Virtual Studio Dialog
 * 
 * Helps users publish their virtual studio projects with detailed information.
 * Automatically detects and displays setup configuration (cameras, lights, objects).
 * Guides users to add context and tips for the community.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Stack,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  CameraAlt,
  Lightbulb,
  Category,
  Landscape,
  Info,
  Close,
  CheckCircle,
  Edit,
  Add,
  Save,
} from '@mui/icons-material';
import { CreateCustomPatternDialog } from './CreateCustomPatternDialog';

interface LightPatternMatch {
  patternName: string;
  patternSlug: string;
  confidence: number;
  matchedCharacteristics: string[];
  differences: string[];
}

interface SetupAnalysis {
  cameraCount: number;
  lightCount: number;
  objectCount: number;
  cameraDetails: any[];
  lightingDetails: any[];
  objectDetails: any[];
  environmentDetails: any;
  equipmentSummary: string;
  lightingSetupType: string;
  keyTechniques: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedSetupTime: number;
  detectedLightPattern?: LightPatternMatch;
  suggestedLightPatterns?: LightPatternMatch[];
}

interface PublishVirtualStudioDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  sceneData: any;
  onPublish: (publishData: any) => Promise<void>;
}

export const PublishVirtualStudioDialog: React.FC<PublishVirtualStudioDialogProps> = ({
  open,
  onClose,
  projectId,
  projectName,
  sceneData,
  onPublish,
}) => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [setupAnalysis, setSetupAnalysis] = useState<SetupAnalysis | null>(null);

  // Form state
  const [title, setTitle] = useState(projectName);
  const [description, setDescription] = useState('');
  const [setupStory, setSetupStory] = useState('');
  const [tipsAndTricks, setTipsAndTricks] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [targetUseCases, setTargetUseCases] = useState<string[]>([]);
  const [difficultyLevel, setDifficultyLevel] = useState<string>('intermediate');

  // Custom pattern dialog
  const [createPatternDialogOpen, setCreatePatternDialogOpen] = useState(false);

  // Analyze setup when dialog opens
  useEffect(() => {
    if (open && sceneData) {
      analyzeSetup();
    }
  }, [open, sceneData]);

  const analyzeSetup = async () => {
    setAnalyzing(true);
    try {
      // Call backend to analyze setup
      const response = await fetch('/api/virtual-studio/analyze-setup', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ sceneData }),
      });
      
      const analysis = await response.json();
      setSetupAnalysis(analysis);
      setDifficultyLevel(analysis.difficultyLevel);
      
      // Pre-fill tags with key techniques
      setTags(analysis.keyTechniques || []);
    } catch (error) {
      console.error('Error analyzing setup: ', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag(', ');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleToggleUseCase = (useCase: string) => {
    if (targetUseCases.includes(useCase)) {
      setTargetUseCases(targetUseCases.filter(uc => uc !== useCase));
    } else {
      setTargetUseCases([...targetUseCases, useCase]);
    }
  };

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please fill in title and description');
      return;
    }

    setLoading(true);
    try {
      await onPublish({
        projectId,
        title,
        description,
        setupStory,
        tipsAndTricks,
        tags,
        targetUseCases,
        difficultyLevel,
        setupAnalysis,
      });
      onClose();
    } catch (error) {
      console.error('Error publishing:', error);
      alert('Failed to publish. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Publish Your Virtual Studio</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {analyzing ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Analyzing your setup...
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Setup Analysis Summary */}
            {setupAnalysis && (
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Your Setup: {setupAnalysis.equipmentSummary}
                </Typography>
                <Typography variant="caption">
                  {setupAnalysis.lightingSetupType} • {setupAnalysis.difficultyLevel} level • ~{setupAnalysis.estimatedSetupTime} min setup time
                </Typography>
              </Alert>
            )}

            {/* Detected Equipment */}
            {setupAnalysis && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detected Equipment
                </Typography>

                <Stack spacing={2}>
                  {/* Cameras */}
                  {setupAnalysis.cameraCount > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CameraAlt fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" fontWeight="bold">
                          {setupAnalysis.cameraCount} Camera{setupAnalysis.cameraCount > 1 ? 's' : ', '}
                        </Typography>
                      </Box>
                      <List dense>
                        {setupAnalysis.cameraDetails.map((camera: any, index: number) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={camera.name}
                              secondary={`${camera.focalLength}mm • f/${camera.aperture} • ISO ${camera.iso} • ${camera.angle}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {/* Lighting */}
                  {setupAnalysis.lightCount > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Lightbulb fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />
                        <Typography variant="body2" fontWeight="bold">
                          {setupAnalysis.lightCount} Light{setupAnalysis.lightCount > 1 ? 's' : ', '}
                        </Typography>
                      </Box>

                      {/* Detected Light Pattern */}
                      {setupAnalysis.detectedLightPattern && setupAnalysis.detectedLightPattern.confidence >= 60 && (
                        <Alert severity="success" sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                            {/* Thumbnail */}
                            {setupAnalysis.detectedLightPattern.thumbnailUrl && (
                              <Box
                                sx={{
                                  width: 120,
                                  height: 120,
                                  flexShrink: 0,
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  bgcolor: '#1a1a1a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'}}
                              >
                                <img
                                  src={setupAnalysis.detectedLightPattern.thumbnailUrl}
                                  alt={setupAnalysis.detectedLightPattern.patternName}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'}}
                                />
                              </Box>
                            )}

                            {/* Pattern Info */}
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight="bold" gutterBottom>
                                ✨ Detected: {setupAnalysis.detectedLightPattern.patternName}
                              </Typography>
                              <Typography variant="caption" display="block" gutterBottom>
                                Confidence: {setupAnalysis.detectedLightPattern.confidence}%
                              </Typography>
                              {setupAnalysis.detectedLightPattern.matchedCharacteristics.length > 0 && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="caption" fontWeight="bold" display="block">
                                    Matched characteristics:
                                  </Typography>
                                  {setupAnalysis.detectedLightPattern.matchedCharacteristics.slice(0, 3).map((char, idx) => (
                                    <Typography key={idx} variant="caption" display="block" sx={{ ml: 1 }}>
                                      • {char}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Alert>
                      )}

                      {/* Suggested Patterns (if no strong match) */}
                      {setupAnalysis.detectedLightPattern && setupAnalysis.detectedLightPattern.confidence < 60 && setupAnalysis.suggestedLightPatterns && setupAnalysis.suggestedLightPatterns.length > 0 && (
                        <Alert severity="info" sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight="bold" gutterBottom>
                            💡 Similar to these patterns:
                          </Typography>
                          {setupAnalysis.suggestedLightPatterns.slice(0, 3).map((pattern, idx) => (
                            <Typography key={idx} variant="caption" display="block">
                              • {pattern.patternName} ({pattern.confidence}% match)
                            </Typography>
                          ))}
                        </Alert>
                      )}

                      {/* Save as Custom Pattern Button */}
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Save />}
                          onClick={() => setCreatePatternDialogOpen(true)}
                          fullWidth
                        >
                          Save as Custom Pattern
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                          Create a reusable pattern from this setup
                        </Typography>
                      </Box>

                      <List dense>
                        {setupAnalysis.lightingDetails.map((light: any, index: number) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={light.name}
                              secondary={`${light.modifier} ${light.modifierSize} • ${light.role} light • Power: ${Math.round(light.power * 100)}%`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {/* Objects */}
                  {setupAnalysis.objectCount > 0 && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Category fontSize="small" sx={{ mr: 1, color: 'success.main' }} />
                        <Typography variant="body2" fontWeight="bold">
                          {setupAnalysis.objectCount} Object{setupAnalysis.objectCount > 1 ? 's' : ','}
                        </Typography>
                      </Box>
                      <List dense>
                        {setupAnalysis.objectDetails.map((obj: any, index: number) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={obj.name}
                              secondary={`${obj.type} • ${obj.category}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {/* Environment */}
                  {setupAnalysis.environmentDetails && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Landscape fontSize="small" sx={{ mr: 1, color: 'info.main' }} />
                        <Typography variant="body2" fontWeight="bold">
                          Environment
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {setupAnalysis.environmentDetails.hdriName && `HDRI: ${setupAnalysis.environmentDetails.hdriName}`}
                        {setupAnalysis.environmentDetails.background && ` • Background: ${setupAnalysis.environmentDetails.background}`}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>
            )}

            <Divider />

            {/* Publishing Information */}
            <Typography variant="h6">Publishing Information</Typography>

            {/* Title */}
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              helperText="Give your setup a catchy, descriptive title"
            />

            {/* Description */}
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              helperText="Describe what this setup is for and what makes it special"
            />

            {/* Setup Story */}
            <TextField
              label="Your Story (Optional)"
              value={setupStory}
              onChange={(e) => setSetupStory(e.target.value)}
              fullWidth
              multiline
              rows={3}
              helperText="Share why you created this setup and what inspired you"
            />

            {/* Tips and Tricks */}
            <TextField
              label="Tips & Tricks (Optional)"
              value={tipsAndTricks}
              onChange={(e) => setTipsAndTricks(e.target.value)}
              fullWidth
              multiline
              rows={3}
              helperText="Share advice for others using this setup"
              placeholder="e.g.'Position the key light at 45° for best results' or 'Use a reflector on the opposite side to fill shadows', "
            />

            {/* Difficulty Level */}
            <FormControl fullWidth>
              <InputLabel>Difficulty Level</InputLabel>
              <Select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
                label="Difficulty Level"
              >
                <MenuItem value="beginner">Beginner - Easy to set up</MenuItem>
                <MenuItem value="intermediate">Intermediate - Some experience needed</MenuItem>
                <MenuItem value="advanced">Advanced - Requires skill</MenuItem>
                <MenuItem value="expert">Expert - Professional level</MenuItem>
              </Select>
            </FormControl>

            {/* Target Use Cases */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Target Use Cases
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                What is this setup best for?
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                {['portrait','product','commercial','wedding','event','fashion','food', 'automotive'].map((useCase) => (
                  <Chip
                    key={useCase}
                    label={useCase}
                    onClick={() => handleToggleUseCase(useCase)}
                    color={targetUseCases.includes(useCase) ? 'primary' : 'default'}
                    variant={targetUseCases.includes(useCase) ? 'filled' : 'outlined'}
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Box>

            {/* Tags */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Tags
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                {tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Add a tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddTag}
                  startIcon={<Add />}
                >
                  Add
                </Button>
              </Box>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handlePublish}
          disabled={loading || analyzing || !title.trim() || !description.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
        >
          {loading ? 'Publishing...' : 'Publish to Community'}
        </Button>
      </DialogActions>

      {/* Create Custom Pattern Dialog */}
      {setupAnalysis && (
        <CreateCustomPatternDialog
          open={createPatternDialogOpen}
          onClose={() => setCreatePatternDialogOpen(false)}
          currentSetup={{
            lights: setupAnalysis.lightingDetails || [],
            hdri: setupAnalysis.hdri,
            background: setupAnalysis.background}}
          projectId={projectId}
          sceneId={sceneId}
          onPatternCreated={(pattern) => {
            console.log('Custom pattern created:', pattern);
            setCreatePatternDialogOpen(false);
          }}
        />
      )}
    </Dialog>
  );
};

