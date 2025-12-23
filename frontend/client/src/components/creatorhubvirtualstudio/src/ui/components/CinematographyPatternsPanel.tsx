/**
 * Cinematography Patterns Panel
 * 
 * Browse and apply 22+ Hollywood lighting patterns
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CardActions,
  Divider,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Movie as FilmIcon,
  Portrait as PortraitIcon,
  Lightbulb as LightIcon,
  Star as StarIcon,
  CheckCircle as ApplyIcon,
} from '@mui/icons-material';
import { cinematographyPatternsService, type CinematographyPattern } from '@/core/services/cinematographyPatternsService';

interface CinematographyPatternsPanelProps {
  onApplyPattern: (pattern: CinematographyPattern) => void;
}

export function CinematographyPatternsPanel({ onApplyPattern }: CinematographyPatternsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  const allPatterns = useMemo(() => {
    return cinematographyPatternsService.getAllPatterns();
  }, []);

  const filteredPatterns = useMemo(() => {
    let patterns = allPatterns;

    if (selectedCategory !== 'all') {
      patterns = patterns.filter(p => p.category === selectedCategory);
    }

    if (selectedDifficulty !== 'all') {
      patterns = patterns.filter(p => p.difficulty === selectedDifficulty);
    }

    return patterns;
  }, [allPatterns, selectedCategory, selectedDifficulty]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'portrait':
        return <PortraitIcon fontSize="small" />;
      case 'dramatic':
      case 'film-noir':
        return <FilmIcon fontSize="small" />;
      case 'beauty':
        return <StarIcon fontSize="small" />;
      default:
        return <LightIcon fontSize="small" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FF9800';
      case 'advanced':
        return '#F44336';
      case 'expert':
        return '#9C27B0';
      default:
        return '#9E9E9E';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'bright':
      case 'high-key':
        return '#FFF9C4';
      case 'neutral':
        return '#E0E0E0';
      case 'dramatic':
        return '#BCAAA4';
      case 'dark':
      case 'low-key':
        return '#616161';
      default:
        return '#E0E0E0';
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
        🎬 Cinematography Patterns ({filteredPatterns.length})
      </Typography>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            label="Category"
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <MenuItem value="all">All Categories</MenuItem>
            <MenuItem value="portrait">Portrait</MenuItem>
            <MenuItem value="dramatic">Dramatic</MenuItem>
            <MenuItem value="commercial">Commercial</MenuItem>
            <MenuItem value="film-noir">Film Noir</MenuItem>
            <MenuItem value="beauty">Beauty</MenuItem>
            <MenuItem value="interview">Interview</MenuItem>
            <MenuItem value="product">Product</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Difficulty</InputLabel>
          <Select
            value={selectedDifficulty}
            label="Difficulty"
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            <MenuItem value="all">All Levels</MenuItem>
            <MenuItem value="beginner">Beginner</MenuItem>
            <MenuItem value="intermediate">Intermediate</MenuItem>
            <MenuItem value="advanced">Advanced</MenuItem>
            <MenuItem value="expert">Expert</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Patterns Grid */}
      <Box sx={{ maxHeight: 600, overflowY: 'auto' }}>
        <Grid container spacing={2}>
          {filteredPatterns.map((pattern) => (
            <Grid item xs={12} key={pattern.id}>
              <Card variant="outlined" sx={{ bgcolor: 'white' }}>
                <CardContent sx={{ pb: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    {getCategoryIcon(pattern.category)}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                      {pattern.name}
                    </Typography>
                    <Chip
                      label={pattern.difficulty}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        bgcolor: getDifficultyColor(pattern.difficulty),
                        color: 'white'}}
                    />
                  </Stack>

                  <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#666' }}>
                    {pattern.description}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip
                      label={`${pattern.keyToFillRatio}:1 ratio`}
                      size="small"
                      sx={{ height: 18, fontSize: 9 }}
                    />
                    <Chip
                      label={pattern.mood}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 9,
                        bgcolor: getMoodColor(pattern.mood)}}
                    />
                    <Chip
                      label={`${pattern.lights.length} lights`}
                      size="small"
                      sx={{ height: 18, fontSize: 9 }}
                    />
                  </Stack>

                  <Typography variant="caption" sx={{ display: 'block', fontSize: 9, color: '#999', fontStyle: 'italic' }}>
                    Used in: {pattern.usedIn.slice(0, 2).join('')}
                  </Typography>

                  <Typography variant="caption" sx={{ display: 'block', fontSize: 8, color: '#999', mt: 0.5 }}>
                    📚 {pattern.reference}
                  </Typography>
                </CardContent>

                <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ApplyIcon />}
                    onClick={() => onApplyPattern(pattern)}
                    sx={{ textTransform: 'none', fontSize: 11 }}
                  >
                    Apply Pattern
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Summary */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ color: '#1976d2', display: 'block', fontWeight: 600}}>
          📚 Research-Validated Patterns
        </Typography>
        <Typography variant="caption" sx={{ color: '#1976d2', display: 'block', fontSize: 9 }}>
          All patterns based on ASC standards"Film Lighting" by Malkiewicz, and"Painting with Light" by Alton
        </Typography>
      </Box>
    </Paper>
  );
}

