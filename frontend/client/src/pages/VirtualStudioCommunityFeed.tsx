/**
 * Virtual Studio Community Feed
 * 
 * Browse and clone published virtual studio setups from the community
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Rating,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search,
  FilterList,
  CameraAlt,
  Lightbulb,
  Category,
  ContentCopy,
  Visibility,
  ThumbUp,
  Star,
  TrendingUp,
  Person,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';

interface PublishedStudio {
  id: string;
  title: string;
  description: string;
  equipmentSummary: string;
  difficultyLevel: string;
  cameraCount: number;
  lightCount: number;
  objectCount: number;
  targetUseCases: string[];
  tags: string[];
  averageRating: number;
  ratingCount: number;
  viewCount: number;
  likeCount: number;
  cloneCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  userId: string;
  publishedAt: string;
  // Author info
  authorName?: string;
  authorEmail?: string;
}

export const VirtualStudioCommunityFeed: React.FC = () => {
  const [studios, setStudios] = useState<PublishedStudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [useCaseFilter, setUseCaseFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [minRating, setMinRating] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchStudios();
  }, [difficultyFilter, useCaseFilter, sortBy, minRating]);

  const fetchStudios = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (difficultyFilter !== 'all') params.append('difficulty', difficultyFilter);
      if (useCaseFilter !== 'all') params.append('useCase', useCaseFilter);
      if (minRating > 0) params.append('minRating', minRating.toString());
      params.append('sort', sortBy);
      params.append('limit', '50');
      
      const response = await apiRequest<{ published: PublishedStudio[] }>(
        `/api/virtual-studio/published?${params.toString()}`,
        { method: 'GET' }
      );
      
      setStudios(response.published);
    } catch (error) {
      console.error('Error fetching studios: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (studio: PublishedStudio) => {
    setCloning(studio.id);
    try {
      const response = await apiRequest<{ clonedProjectId: string }>(
        '/api/virtual-studio/clone',
        {
          method: 'POST',
          body: JSON.stringify({
            publishedStudioId: studio.id,
            cloneSource: 'community',
          }),
        }
      );
      
      setSnackbar({ open: true, message: `Successfully cloned "${studio.title}"! Opening your new project...`, severity: 'success' });
      
      // Navigate to the cloned project
      setTimeout(() => {
        window.location.href = `/virtual-studio/project/${response.clonedProjectId}`;
      }, 1500);
    } catch (error) {
      console.error('Error cloning studio:', error);
      setSnackbar({ open: true, message: 'Failed to clone studio. Please try again.', severity: 'error' });
    } finally {
      setCloning(null);
    }
  };

  const filteredStudios = studios.filter(studio => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        studio.title.toLowerCase().includes(query) ||
        studio.description.toLowerCase().includes(query) ||
        studio.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Community Virtual Studios
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse and clone professional virtual studio setups shared by the community
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {/* Search */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search setups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Difficulty Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  label="Difficulty"
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                  <MenuItem value="expert">Expert</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Use Case Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Use Case</InputLabel>
                <Select
                  value={useCaseFilter}
                  onChange={(e) => setUseCaseFilter(e.target.value)}
                  label="Use Case"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="product">Product</MenuItem>
                  <MenuItem value="commercial">Commercial</MenuItem>
                  <MenuItem value="wedding">Wedding</MenuItem>
                  <MenuItem value="event">Event</MenuItem>
                  <MenuItem value="fashion">Fashion</MenuItem>
                  <MenuItem value="food">Food</MenuItem>
                  <MenuItem value="automotive">Automotive</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Rating Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Min Rating</InputLabel>
                <Select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  label="Min Rating"
                >
                  <MenuItem value={0}>All Ratings</MenuItem>
                  <MenuItem value={4}>4+ Stars</MenuItem>
                  <MenuItem value={4.5}>4.5+ Stars</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="recent">Most Recent</MenuItem>
                  <MenuItem value="popular">Most Popular</MenuItem>
                  <MenuItem value="cloned">Most Cloned</MenuItem>
                  <MenuItem value="rating">Highest Rated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!loading && filteredStudios.length === 0 && (
        <Alert severity="info">
          No virtual studios found matching your filters. Try adjusting your search criteria.
        </Alert>
      )}

      {/* Studios Grid */}
      {!loading && filteredStudios.length > 0 && (
        <Grid container spacing={3}>
          {filteredStudios.map((studio) => (
            <Grid item xs={12} md={6} lg={4} key={studio.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Badges */}
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    {studio.isFeatured && (
                      <Chip
                        label="Featured"
                        size="small"
                        color="primary"
                        icon={<Star />}
                      />
                    )}
                    {studio.isTrending && (
                      <Chip
                        label="Trending"
                        size="small"
                        color="secondary"
                        icon={<TrendingUp />}
                      />
                    )}
                  </Stack>

                  {/* Title */}
                  <Typography variant="h6" gutterBottom>
                    {studio.title}
                  </Typography>

                  {/* Rating */}
                  {studio.ratingCount > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Rating value={studio.averageRating} precision={0.1} size="small" readOnly />
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        {studio.averageRating.toFixed(1)} ({studio.ratingCount})
                      </Typography>
                    </Box>
                  )}

                  {/* Description */}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {studio.description.length > 120
                      ? `${studio.description.substring(0, 120)}...`
                      : studio.description}
                  </Typography>

                  {/* Equipment Summary */}
                  <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                    {studio.equipmentSummary}
                  </Typography>

                  {/* Equipment Details */}
                  <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Tooltip title="Cameras">
                      <Chip
                        icon={<CameraAlt />}
                        label={studio.cameraCount}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title="Lights">
                      <Chip
                        icon={<Lightbulb />}
                        label={studio.lightCount}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title="Objects">
                      <Chip
                        icon={<Category />}
                        label={studio.objectCount}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                  </Stack>

                  {/* Difficulty */}
                  <Chip
                    label={studio.difficultyLevel}
                    size="small"
                    color={
                      studio.difficultyLevel === 'beginner' ? 'success' :
                      studio.difficultyLevel === 'intermediate' ? 'info' :
                      studio.difficultyLevel === 'advanced' ? 'warning' : 'error'
                    }
                    sx={{ mb: 2 }}
                  />

                  {/* Tags */}
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 2 }}>
                    {studio.tags.slice(0, 3).map((tag, index) => (
                      <Chip key={index} label={tag} size="small" sx={{ mb: 0.5 }} />
                    ))}
                    {studio.tags.length > 3 && (
                      <Chip label={`+${studio.tags.length - 3}`} size="small" sx={{ mb: 0.5 }} />
                    )}
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  {/* Stats */}
                  <Stack direction="row" spacing={2}>
                    <Tooltip title="Views">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Visibility fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {studio.viewCount}
                        </Typography>
                      </Box>
                    </Tooltip>
                    <Tooltip title="Likes">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ThumbUp fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {studio.likeCount}
                        </Typography>
                      </Box>
                    </Tooltip>
                    <Tooltip title="Clones">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ContentCopy fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {studio.cloneCount}
                        </Typography>
                      </Box>
                    </Tooltip>
                  </Stack>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    href={`/virtual-studio/published/${studio.id}`}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={cloning === studio.id ? <CircularProgress size={16} /> : <ContentCopy />}
                    onClick={() => handleClone(studio)}
                    disabled={cloning === studio.id}
                  >
                    {cloning === studio.id ? 'Cloning...' : 'Clone Setup'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

