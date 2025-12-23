import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Tabs,
  Tab,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Star as StarIcon,
  Landscape as LandscapeIcon,
  Home as HomeIcon,
  Palette as PaletteIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { hdriEnvironmentService, type HDRIEnvironment } from '@/core/services/hdriEnvironmentService';

interface HDRIBrowserPanelProps {
  currentEnvironmentId: string | null;
  intensity: number;
  rotation: number;
  visible: boolean;
  onLoadEnvironment: (environmentId: string) => void;
  onUpdateIntensity: (intensity: number) => void;
  onUpdateRotation: (rotation: number) => void;
  onToggleVisible: (visible: boolean) => void;
  onClearEnvironment: () => void;
}

export function HDRIBrowserPanel({
  currentEnvironmentId,
  intensity,
  rotation,
  visible,
  onLoadEnvironment,
  onUpdateIntensity,
  onUpdateRotation,
  onToggleVisible,
  onClearEnvironment,
}: HDRIBrowserPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<HDRIEnvironment['category'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allEnvironments = hdriEnvironmentService.getAllEnvironments();

  const filteredEnvironments = useMemo(() => {
    let envs = allEnvironments;

    // Filter by category
    if (selectedCategory !== 'all') {
      envs = hdriEnvironmentService.getEnvironmentsByCategory(selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      envs = hdriEnvironmentService.searchEnvironments(searchQuery);
    }

    return envs;
  }, [selectedCategory, searchQuery, allEnvironments]);

  const currentEnvironment = currentEnvironmentId
    ? hdriEnvironmentService.getEnvironment(currentEnvironmentId)
    : null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'studio':
        return <BusinessIcon fontSize="small" />;
      case 'outdoor':
        return <LandscapeIcon fontSize="small" />;
      case 'interior':
        return <HomeIcon fontSize="small" />;
      case 'creative':
        return <PaletteIcon fontSize="small" />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600}}>
        HDRI Environment:
      </Typography>

      {/* Current Environment Controls */}
      {currentEnvironment && (
        <Paper elevation={1} sx={{ p: 1.5, mb: 1.5, bgcolor: '#f5f5f5' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600}}>
              {currentEnvironment.name}
            </Typography>
            <Button size="small" onClick={onClearEnvironment} variant="outlined" color="error">
              Clear
            </Button>
          </Box>

          <FormControlLabel
            control={
              <Switch checked={visible} onChange={(e) => onToggleVisible(e.target.checked)} size="small" />
            }
            label={<Typography variant="caption">Show as Background</Typography>}
            sx={{ mb: 1 }}
          />

          <Typography variant="caption" color="text.secondary" gutterBottom>
            Intensity: {intensity.toFixed(1)}
          </Typography>
          <Slider
            value={intensity}
            onChange={(_, value) => onUpdateIntensity(value as number)}
            min={0}
            max={2}
            step={0.1}
            size="small"
            sx={{ mb: 1 }}
          />

          <Typography variant="caption" color="text.secondary" gutterBottom>
            Rotation: {rotation}°
          </Typography>
          <Slider
            value={rotation}
            onChange={(_, value) => onUpdateRotation(value as number)}
            min={0}
            max={360}
            step={15}
            size="small"
          />
        </Paper>
      )}

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search environments..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )}}
        sx={{ mb: 1.5 }}
      />

      {/* Category Tabs */}
      <Tabs
        value={selectedCategory}
        onChange={(_, value) => setSelectedCategory(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1.5, minHeight: 36 }}
      >
        <Tab label="All" value="all" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Studio" value="studio" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Outdoor" value="outdoor" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Interior" value="interior" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Creative" value="creative" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {/* Environment Grid */}
      <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
        <Stack spacing={1}>
          {filteredEnvironments.map((env) => (
            <Card
              key={env.id}
              elevation={currentEnvironmentId === env.id ? 3 : 1}
              sx={{
                border: currentEnvironmentId === env.id ? '2px solid #1976d2' : 'none'}}
            >
              <CardContent sx={{ p: 1.5, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {env.name}
                  </Typography>
                  {env.isPremium && <Chip label="Premium" size="small" color="warning" icon={<StarIcon />} />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {env.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={env.category}
                    size="small"
                    icon={getCategoryIcon(env.category)}
                    sx={{ fontSize: 10 }}
                  />
                  <Chip label={env.resolution} size="small" sx={{ fontSize: 10 }} />
                </Box>
              </CardContent>
              <CardActions sx={{ p: 1.5, pt: 0 }}>
                <Button
                  size="small"
                  variant={currentEnvironmentId === env.id ? 'contained' : 'outlined'}
                  onClick={() => onLoadEnvironment(env.id)}
                  fullWidth
                >
                  {currentEnvironmentId === env.id ? 'Active' : 'Load'}
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      </Box>

      {filteredEnvironments.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>
          No environments found
        </Typography>
      )}
    </Box>
  );
}

