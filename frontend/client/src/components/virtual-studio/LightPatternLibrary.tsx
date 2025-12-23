/**
 * Light Pattern Library
 * 
 * Browse and apply professional lighting patterns (Rembrandt, Loop, Butterfly, etc.)
 * with one click. Includes setup instructions and recommendations.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Close,
  Lightbulb,
  CheckCircle,
  Info,
  Star,
  TrendingUp,
  Search,
  PlayArrow,
  Visibility,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';

interface LightPattern {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  lookDescription: string;
  whenToUse: string;
  difficultyLevel: string;
  lightSetup: any[];
  setupInstructions: string[];
  recommendedModifiers: string[];
  recommendedHdris: string[];
  recommendedBackgrounds: string[];
  subjectOrientation: string;
  subjectDistance: number;
  shadowRules: string;
  isFeatured: boolean;
  isBeginnerFriendly: boolean;
  usageCount: number;
  ratingAverage: number;
  ratingCount: number;
}

interface LightPatternLibraryProps {
  open: boolean;
  onClose: () => void;
  onApplyPattern: (pattern: LightPattern) => Promise<void>;
}

export const LightPatternLibrary: React.FC<LightPatternLibraryProps> = ({
  open,
  onClose,
  onApplyPattern,
}) => {
  const [patterns, setPatterns] = useState<LightPattern[]>([]);
  const [customPatterns, setCustomPatterns] = useState<LightPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<LightPattern | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Tabs
  const [tabValue, setTabValue] = useState(0); // 0 = Professional, 1 = Community, 2 = My Patterns

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  useEffect(() => {
    if (open) {
      fetchPatterns();
      fetchCustomPatterns();
    }
  }, [open, tabValue]);

  const fetchPatterns = async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ patterns: LightPattern[] }>(
        '/api/virtual-studio/light-patterns',
        { method: 'GET' }
      );
      setPatterns(response.patterns);
    } catch (error) {
      console.error('Error fetching light patterns: ', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomPatterns = async () => {
    setLoading(true);
    try {
      const myPatterns = tabValue === 2;
      const response = await apiRequest<{ patterns: LightPattern[] }>(
        `/api/virtual-studio/custom-patterns?myPatterns=${myPatterns}`,
        { method: 'GET' }
      );
      setCustomPatterns(response.patterns);
    } catch (error) {
      console.error('Error fetching custom patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (pattern: LightPattern) => {
    setApplying(pattern.id);
    try {
      await onApplyPattern(pattern);
      onClose();
    } catch (error) {
      console.error('Error applying pattern:', error);
      alert('Failed to apply lighting pattern. Please try again.');
    } finally {
      setApplying(null);
    }
  };

  const handleViewDetails = (pattern: LightPattern) => {
    setSelectedPattern(pattern);
    setShowDetails(true);
  };

  const filterPatterns = (patternList: LightPattern[]) => {
    return patternList.filter(pattern => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!pattern.name.toLowerCase().includes(query) &&
            !pattern.description.toLowerCase().includes(query) &&
            !pattern.whenToUse?.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (categoryFilter !== 'all' && pattern.category !== categoryFilter) {
        return false;
      }

      if (difficultyFilter !== 'all' && pattern.difficultyLevel !== difficultyFilter) {
        return false;
      }

      return true;
    });
  };

  const filteredPatterns = filterPatterns(tabValue === 0 ? patterns : customPatterns);

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'success';
      case 'intermediate': return 'info';
      case 'advanced': return 'warning';
      case 'expert': return 'error';
      default: return 'default';
    }
  };

  return (
    <>
      {/* Main Library Dialog */}
      <Dialog open={open && !showDetails} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Lightbulb color="primary" />
              <Typography variant="h6">Light Pattern Library</Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Tabs: Professional / Community / My Patterns */}
            <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} variant="fullWidth">
              <Tab label="Professional Patterns" />
              <Tab label="Community Patterns" />
              <Tab label="My Patterns" />
            </Tabs>

            {/* Header Info */}
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                {tabValue === 0 && 'Apply professional lighting patterns with one click. Each pattern includes setup instructions and recommendations.'}
                {tabValue === 1 && 'Browse patterns created by the community. Discover unique lighting setups shared by other creators.'}
                {tabValue === 2 && 'Your custom lighting patterns. Create new patterns from the publishing dialog.'}
              </Typography>
            </Alert>

            {/* Search and Filters */}
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search patterns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      )}}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Tabs
                    value={difficultyFilter}
                    onChange={(_, value) => setDifficultyFilter(value)}
                    variant="scrollable"
                  >
                    <Tab label="All" value="all" />
                    <Tab label="Beginner" value="beginner" />
                    <Tab label="Intermediate" value="intermediate" />
                    <Tab label="Advanced" value="advanced" />
                  </Tabs>
                </Grid>
              </Grid>
            </Box>

            {/* Loading State */}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}

            {/* Patterns Grid */}
            {!loading && (
              <Grid container spacing={2}>
                {filteredPatterns.map((pattern) => (
                  <Grid item xs={12} sm={6} md={4} key={pattern.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {/* Thumbnail Image */}
                      {pattern.thumbnailUrl && (
                        <Box
                          sx={{
                            width: '100%',
                            height: 200,
                            bgcolor: '#1a1a1a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'}}
                        >
                          <img
                            src={pattern.thumbnailUrl}
                            alt={pattern.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'}}
                          />
                          {/* Difficulty Badge Overlay */}
                          <Chip
                            label={pattern.difficultyLevel}
                            size="small"
                            color={
                              pattern.difficultyLevel === 'beginner'
                                ? 'success'
                                : pattern.difficultyLevel === 'intermediate'
                                ? 'warning'
                                : 'error'
                            }
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              textTransform: 'capitalize'}}
                          />
                        </Box>
                      )}

                      <CardContent sx={{ flexGrow: 1 }}>
                        {/* Badges */}
                        <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} flexWrap="wrap">
                          {pattern.isFeatured && (
                            <Chip label="Featured" size="small" color="primary" icon={<Star />} />
                          )}
                          {pattern.isBeginnerFriendly && (
                            <Chip label="Beginner Friendly" size="small" color="success" />
                          )}
                        </Stack>

                        {/* Name */}
                        <Typography variant="h6" gutterBottom>
                          {pattern.name}
                        </Typography>

                        {/* Look Description */}
                        <Typography variant="body2" color="primary" gutterBottom fontWeight="bold">
                          {pattern.lookDescription}
                        </Typography>

                        {/* Description */}
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {pattern.description.length > 100
                            ? `${pattern.description.substring(0, 100)}...`
                            : pattern.description}
                        </Typography>

                        {/* When to Use */}
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            Best for:
                          </Typography>
                          <Typography variant="body2">
                            {pattern.whenToUse}
                          </Typography>
                        </Box>

                        {/* Difficulty */}
                        <Chip
                          label={pattern.difficultyLevel}
                          size="small"
                          color={getDifficultyColor(pattern.difficultyLevel) as any}
                        />

                        {/* Stats */}
                        {pattern.usageCount > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            Used {pattern.usageCount} times
                          </Typography>
                        )}
                      </CardContent>

                      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => handleViewDetails(pattern)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={applying === pattern.id ? <CircularProgress size={16} /> : <PlayArrow />}
                          onClick={() => handleApply(pattern)}
                          disabled={applying === pattern.id}
                        >
                          {applying === pattern.id ? 'Applying...' : 'Apply'}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Empty State */}
            {!loading && filteredPatterns.length === 0 && (
              <Alert severity="info">
                No lighting patterns found matching your filters.
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Pattern Details Dialog */}
      {selectedPattern && (
        <Dialog
          open={showDetails}
          onClose={() => setShowDetails(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">{selectedPattern.name}</Typography>
              <IconButton onClick={() => setShowDetails(false)} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent dividers>
            <Stack spacing={3}>
              {/* Look Description */}
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2" fontWeight="bold">
                  {selectedPattern.lookDescription}
                </Typography>
              </Alert>

              {/* Description */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedPattern.description}
                </Typography>
              </Box>

              {/* When to Use */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  When to Use
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedPattern.whenToUse}
                </Typography>
              </Box>

              <Divider />

              {/* Setup Instructions */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Setup Instructions
                </Typography>
                <List dense>
                  {selectedPattern.setupInstructions.map((instruction, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircle color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={instruction} />
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Light Configuration */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Light Configuration
                </Typography>
                <List dense>
                  {selectedPattern.lightSetup.map((light, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Lightbulb color="warning" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${light.name} (${light.role})`}
                        secondary={`${light.modifier} ${light.modifierSize} • Power: ${Math.round(light.power * 100)}% • Angle: ${light.angle}° • Distance: ${light.distance}m`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              {/* Subject Orientation */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Subject Orientation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedPattern.subjectOrientation}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Distance from camera: {selectedPattern.subjectDistance}m
                </Typography>
              </Box>

              {/* Shadow Rules */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Shadow Characteristics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedPattern.shadowRules}
                </Typography>
              </Box>

              <Divider />

              {/* Recommendations */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Recommended Equipment
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {selectedPattern.recommendedModifiers.map((modifier, index) => (
                    <Chip key={index} label={modifier} size="small" sx={{ mb: 1 }} />
                  ))}
                </Stack>
              </Box>

              {/* HDRI Recommendations */}
              {selectedPattern.recommendedHdris.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Recommended HDRIs
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedPattern.recommendedHdris.map((hdri, index) => (
                      <Chip key={index} label={hdri} size="small" variant="outlined" sx={{ mb: 1 }} />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Note: HDRI will not change automatically, but these are suggested options
                  </Typography>
                </Box>
              )}

              {/* Background Recommendations */}
              {selectedPattern.recommendedBackgrounds.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Recommended Backgrounds
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedPattern.recommendedBackgrounds.map((bg, index) => (
                      <Chip key={index} label={bg} size="small" variant="outlined" sx={{ mb: 1 }} />
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Difficulty */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Difficulty Level
                </Typography>
                <Chip
                  label={selectedPattern.difficultyLevel}
                  color={getDifficultyColor(selectedPattern.difficultyLevel) as any}
                />
              </Box>
            </Stack>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setShowDetails(false)}>
              Back to Library
            </Button>
            <Button
              variant="contained"
              startIcon={applying === selectedPattern.id ? <CircularProgress size={16} /> : <PlayArrow />}
              onClick={() => handleApply(selectedPattern)}
              disabled={applying === selectedPattern.id}
            >
              {applying === selectedPattern.id ? 'Applying...' : 'Apply This Pattern'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

