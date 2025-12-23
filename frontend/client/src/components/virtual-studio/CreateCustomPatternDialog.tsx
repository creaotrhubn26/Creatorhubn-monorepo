/**
 * Create Custom Light Pattern Dialog
 * 
 * Allows users to save their current lighting setup as a custom pattern
 * that can be shared with the community or kept private.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Close,
  Add,
  Save,
  Public,
  Lock,
  Info,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface CreateCustomPatternDialogProps {
  open: boolean;
  onClose: () => void;
  currentSetup: {
    lights: any[];
    hdri?: string;
    background?: string;
  };
  projectId?: string;
  sceneId?: string;
  onPatternCreated?: (pattern: any) => void;
}

export const CreateCustomPatternDialog: React.FC<CreateCustomPatternDialogProps> = ({
  open,
  onClose,
  currentSetup,
  projectId,
  sceneId,
  onPatternCreated,
}) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lookDescription, setLookDescription] = useState('');
  const [whenToUse, setWhenToUse] = useState('');
  const [category, setCategory] = useState('portrait');
  const [difficultyLevel, setDifficultyLevel] = useState('intermediate');
  const [isPublic, setIsPublic] = useState(false);
  const [setupInstructions, setSetupInstructions] = useState<string[]>([]);
  const [newInstruction, setNewInstruction] = useState('');
  const [thumbnailDataUri, setThumbnailDataUri] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(', ');
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);

  const handleGenerateThumbnail = async () => {
    if (!name.trim()) {
      alert('Please enter a pattern name first');
      return;
    }

    if (currentSetup.lights.length === 0) {
      alert('Your setup must have at least one light to generate a thumbnail');
      return;
    }

    setGeneratingThumbnail(true);
    try {
      const response = await apiRequest(
        '/api/virtual-studio/custom-patterns/generate-thumbnail',
        {
          method: 'POST',
          body: JSON.stringify({
            lightSetup: currentSetup.lights,
            patternName: name,
          }),
        }
      ) as { success: boolean; thumbnailUrl: string; dataUri: string; message: string };

      if (response.success) {
        setThumbnailUrl(response.thumbnailUrl);
        setThumbnailDataUri(response.dataUri);
        alert(response.message || 'Thumbnail generated successfully!');
      }
    } catch (error) {
      console.error('Error generating thumbnail: ', error);
      alert('Failed to generate thumbnail. Please try again.');
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const handleAddInstruction = () => {
    if (newInstruction.trim()) {
      setSetupInstructions([...setupInstructions, newInstruction.trim()]);
      setNewInstruction(', ');
    }
  };

  const handleRemoveInstruction = (index: number) => {
    setSetupInstructions(setupInstructions.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim() || !description.trim() || !lookDescription.trim()) {
      alert('Please fill in name, description, and look description');
      return;
    }

    if (currentSetup.lights.length === 0) {
      alert('Your setup must have at least one light to create a pattern');
      return;
    }

    if (!thumbnailUrl) {
      alert('Please generate a thumbnail before publishing');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest(
        '/api/virtual-studio/custom-patterns',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            lookDescription,
            whenToUse: whenToUse || null,
            category,
            difficultyLevel,
            lightSetup: currentSetup.lights,
            setupInstructions: setupInstructions.length > 0 ? setupInstructions : null,
            recommendedHdris: currentSetup.hdri ? [currentSetup.hdri] : null,
            recommendedBackgrounds: currentSetup.background ? [currentSetup.background] : null,
            thumbnailUrl,
            isPublic,
            projectId,
            sceneId,
          }),
        }
      ) as { success: boolean; pattern: any; message: string };

      if (response.success) {
        alert(response.message);
        if (onPatternCreated) {
          onPatternCreated(response.pattern);
        }
        onClose();
      }
    } catch (error) {
      console.error('Error creating custom pattern:', error);
      alert('Failed to create custom pattern. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Create Custom Light Pattern</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Info Alert */}
          <Alert severity="info" icon={<Info />}>
            Save your current lighting setup as a reusable pattern. You can keep it private or share it with the community!
          </Alert>

          {/* Generate Thumbnail Section */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Pattern Thumbnail
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Generate a visual thumbnail for your pattern. This is required before publishing.
            </Typography>

            <Button
              variant="contained"
              color="primary"
              onClick={handleGenerateThumbnail}
              disabled={!name.trim() || currentSetup.lights.length === 0 || generatingThumbnail}
              startIcon={generatingThumbnail ? <CircularProgress size={20} /> : <Save />}
              fullWidth
            >
              {generatingThumbnail ? 'Generating Thumbnail...' : thumbnailUrl ? 'Regenerate Thumbnail' : 'Generate Thumbnail'}
            </Button>

            {/* Thumbnail Preview */}
            {thumbnailDataUri && (
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 2,
                mt: 2,
                bgcolor: '#1a1a1a',
                borderRadius: 2,
                position: 'relative'}}>
                <img
                  src={thumbnailDataUri}
                  alt="Pattern Preview"
                  style={{
                    width: '200px',
                    height: '200px'}}
                />
                <Chip
                  label="✓ Thumbnail Generated"
                  color="success"
                  size="small"
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                />
              </Box>
            )}
          </Box>

          {/* Current Setup Info */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Current Setup:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentSetup.lights.length} light{currentSetup.lights.length !== 1 ? 's' : ', '}
              {currentSetup.hdri && ` • HDRI: ${currentSetup.hdri}`}
              {currentSetup.background && ` • Background: ${currentSetup.background}`}
            </Typography>
          </Box>

          {/* Pattern Name */}
          <TextField
            label="Pattern Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            placeholder="e.g., My Custom Rembrandt Setup"
            helperText="Give your pattern a unique, descriptive name"
          />

          {/* Look Description */}
          <TextField
            label="Look Description"
            value={lookDescription}
            onChange={(e) => setLookDescription(e.target.value)}
            fullWidth
            required
            placeholder="e.g., Soft dramatic lighting with subtle shadows"
            helperText="Describe the visual result in one sentence"
          />

          {/* Full Description */}
          <TextField
            label="Full Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder="Explain what makes this pattern unique and how it works..."
            helperText="Provide details about the pattern and its characteristics"
          />

          {/* When to Use */}
          <TextField
            label="When to Use (Optional)"
            value={whenToUse}
            onChange={(e) => setWhenToUse(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g., Portrait photography, commercial headshots, dramatic mood..."
            helperText="Suggest use cases for this pattern"
          />

          {/* Category and Difficulty */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                label="Category"
              >
                <MenuItem value="portrait">Portrait</MenuItem>
                <MenuItem value="product">Product</MenuItem>
                <MenuItem value="commercial">Commercial</MenuItem>
                <MenuItem value="fashion">Fashion</MenuItem>
                <MenuItem value="beauty">Beauty</MenuItem>
                <MenuItem value="editorial">Editorial</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Difficulty Level</InputLabel>
              <Select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
                label="Difficulty Level"
              >
                <MenuItem value="beginner">Beginner</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
                <MenuItem value="expert">Expert</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Setup Instructions */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Setup Instructions (Optional)
            </Typography>
            <Stack spacing={1}>
              {setupInstructions.map((instruction, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`${index + 1}. ${instruction}`}
                    onDelete={() => handleRemoveInstruction(index)}
                    sx={{ flex: 1, justifyContent: 'flex-start' }}
                  />
                </Box>
              ))}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  placeholder="Add a setup step..."
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddInstruction();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={handleAddInstruction}
                  disabled={!newInstruction.trim()}
                >
                  Add
                </Button>
              </Box>
            </Stack>
          </Box>

          {/* Public/Private Toggle */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isPublic ? <Public fontSize="small" /> : <Lock fontSize="small" />}
                  <Typography variant="body2">
                    {isPublic ? 'Share with community (pending review)' : 'Keep private (only you can use it)'}
                  </Typography>
                </Box>
              }
            />
            {isPublic && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Public patterns will be reviewed before appearing in the community library.
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Tooltip
          title={
            !thumbnailUrl
              ? 'Please generate a thumbnail before publishing'
              : !name.trim() || !description.trim() || !lookDescription.trim()
              ? 'Please fill in all required fields'
              : ''
          }
        >
          <span>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={
                loading ||
                !name.trim() ||
                !description.trim() ||
                !lookDescription.trim() ||
                !thumbnailUrl
              }
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            >
              {loading ? 'Publishing...' : 'Publish Pattern'}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};


