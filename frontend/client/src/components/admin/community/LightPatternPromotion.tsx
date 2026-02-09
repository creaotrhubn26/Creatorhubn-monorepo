/**
 * Light Pattern Promotion System
 * 
 * Automatically promotes user-created light patterns to the professional library
 * based on community engagement metrics:
 * - Like threshold (e.g., 50+ likes)
 * - Usage count (e.g., 100+ applications)
 * - Rating average (e.g., 4.5+ stars)
 * - Admin manual promotion
 * 
 * When promoted, patterns move from "Community" to"Professional" library
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  LinearProgress,
  Divider,
  Snackbar,
} from '@mui/material';
import {
  TrendingUp,
  Star,
  Favorite,
  Visibility,
  Settings,
  Lightbulb,
  ArrowUpward,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface LightPattern {
  id: string;
  user_id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  difficulty: string;
  like_count: number;
  usage_count: number;
  view_count: number;
  rating: number;
  rating_count: number;
  is_promoted: boolean;
  created_at: string;
  creator_name: string;
}

interface PromotionThresholds {
  like_threshold: number;
  usage_threshold: number;
  rating_threshold: number;
  min_rating_count: number;
  auto_promote_enabled: boolean;
}

export default function LightPatternPromotion() {
  const [patterns, setPatterns] = useState<LightPattern[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null);
  const [eligiblePatterns, setEligiblePatterns] = useState<LightPattern[]>([]);
  const [promotedPatterns, setPromotedPatterns] = useState<LightPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<LightPattern | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [thresholds, setThresholds] = useState<PromotionThresholds>({
    like_threshold: 50,
    usage_threshold: 100,
    rating_threshold: 4.5,
    min_rating_count: 10,
    auto_promote_enabled: true,
  });

  useEffect(() => {
    fetchPatterns();
    fetchThresholds();
  }, []);

  const fetchPatterns = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/community/admin/light-patterns/promotion-candidates', {
        method: 'GET',
      }) as { success: boolean; patterns: LightPattern[]; eligible: LightPattern[]; promoted: LightPattern[] };

      if (response.success) {
        setPatterns(response.patterns);
        setEligiblePatterns(response.eligible);
        setPromotedPatterns(response.promoted);
      }
    } catch (error) {
      console.error('Error fetching patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchThresholds = async () => {
    try {
      const response = await apiRequest('/api/community/admin/light-patterns/promotion-thresholds', {
        method: 'GET',
      }) as { success: boolean; thresholds: PromotionThresholds };

      if (response.success) {
        setThresholds(response.thresholds);
      }
    } catch (error) {
      console.error('Error fetching thresholds: ', error);
    }
  };

  const handleSaveThresholds = async () => {
    try {
      const response = await apiRequest('/api/community/admin/light-patterns/promotion-thresholds', {
        method: 'PUT',
        body: JSON.stringify(thresholds),
      }) as { success: boolean; message: string };

      if (response.success) {
        setSnackbar({ open: true, message: response.message, severity: 'success' });
        setSettingsOpen(false);
        fetchPatterns();
      }
    } catch (error) {
      console.error('Error saving thresholds:', error);
      setSnackbar({ open: true, message: 'Failed to save thresholds', severity: 'error' });
    }
  };

  const handlePromotePattern = async (patternId: string) => {
    setConfirmPromoteId(patternId);
  };

  const executePromotePattern = async () => {
    if (!confirmPromoteId) return;

    try {
      const response = await apiRequest(`/api/community/admin/light-patterns/${confirmPromoteId}/promote`, {
        method: 'POST',
      }) as { success: boolean; message: string };

      if (response.success) {
        setSnackbar({ open: true, message: response.message, severity: 'success' });
        fetchPatterns();
      }
    } catch (error) {
      console.error('Error promoting pattern:', error);
      setSnackbar({ open: true, message: 'Failed to promote pattern', severity: 'error' });
    }
    setConfirmPromoteId(null);
  };

  const calculateEligibilityScore = (pattern: LightPattern): number => {
    let score = 0;
    
    // Like score (0-33 points)
    if (pattern.like_count >= thresholds.like_threshold) {
      score += 33;
    } else {
      score += (pattern.like_count / thresholds.like_threshold) * 33;
    }

    // Usage score (0-33 points)
    if (pattern.usage_count >= thresholds.usage_threshold) {
      score += 33;
    } else {
      score += (pattern.usage_count / thresholds.usage_threshold) * 33;
    }

    // Rating score (0-34 points)
    if (pattern.rating_count >= thresholds.min_rating_count) {
      if (pattern.rating >= thresholds.rating_threshold) {
        score += 34;
      } else {
        score += (pattern.rating / thresholds.rating_threshold) * 34;
      }
    }

    return Math.round(score);
  };

  const isEligible = (pattern: LightPattern): boolean => {
    return (
      pattern.like_count >= thresholds.like_threshold &&
      pattern.usage_count >= thresholds.usage_threshold &&
      pattern.rating >= thresholds.rating_threshold &&
      pattern.rating_count >= thresholds.min_rating_count
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp /> Light Pattern Promotion System
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Settings />}
          onClick={() => setSettingsOpen(true)}
        >
          Configure Thresholds
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Eligible for Promotion</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, my: 1 }}>
                {eligiblePatterns.length}
              </Typography>
              <Typography variant="body2">Patterns meeting all criteria</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Already Promoted</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, my: 1 }}>
                {promotedPatterns.length}
              </Typography>
              <Typography variant="body2">In Professional Library</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Total Community Patterns</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, my: 1 }}>
                {patterns.length}
              </Typography>
              <Typography variant="body2">User-created patterns</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Thresholds */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Current Promotion Criteria:
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip icon={<Favorite />} label={`${thresholds.like_threshold}+ likes`} size="small" />
          <Chip icon={<Visibility />} label={`${thresholds.usage_threshold}+ uses`} size="small" />
          <Chip icon={<Star />} label={`${thresholds.rating_threshold}+ rating`} size="small" />
          <Chip label={`${thresholds.min_rating_count}+ ratings`} size="small" />
          <Chip
            label={thresholds.auto_promote_enabled ? 'Auto-promote ON' : 'Manual only'}
            color={thresholds.auto_promote_enabled ? 'success' : 'default'}
            size="small"
          />
        </Box>
      </Alert>

      {/* Eligible Patterns */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Eligible Patterns
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pattern</TableCell>
                  <TableCell>Creator</TableCell>
                  <TableCell align="center">Likes</TableCell>
                  <TableCell align="center">Uses</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligiblePatterns.map((pattern) => (
                  <TableRow key={pattern.id} hover>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600}}>
                        {pattern.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pattern.description}
                      </Typography>
                    </TableCell>
                    <TableCell>{pattern.creator_name}</TableCell>
                    <TableCell align="center">{pattern.like_count}</TableCell>
                    <TableCell align="center">{pattern.usage_count}</TableCell>
                    <TableCell align="center">
                      {pattern.rating.toFixed(1)} ({pattern.rating_count})
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <LinearProgress
                        variant="determinate"
                        value={calculateEligibilityScore(pattern)}
                        sx={{ height: 8, borderRadius: 999 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {calculateEligibilityScore(pattern)} / 100
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => {
                          setSelectedPattern(pattern);
                          setPreviewOpen(true);
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="small"
                        startIcon={<ArrowUpward />}
                        color="success"
                        onClick={() => handlePromotePattern(pattern.id)}
                        sx={{ ml: 1 }}
                      >
                        Promote
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {eligiblePatterns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No patterns meet the current criteria yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Already promoted */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Promoted Patterns
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pattern</TableCell>
                  <TableCell>Creator</TableCell>
                  <TableCell align="center">Likes</TableCell>
                  <TableCell align="center">Uses</TableCell>
                  <TableCell align="center">Rating</TableCell>
                  <TableCell align="center">Promoted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {promotedPatterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600}}>
                        {pattern.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pattern.description}
                      </Typography>
                    </TableCell>
                    <TableCell>{pattern.creator_name}</TableCell>
                    <TableCell align="center">{pattern.like_count}</TableCell>
                    <TableCell align="center">{pattern.usage_count}</TableCell>
                    <TableCell align="center">
                      {pattern.rating.toFixed(1)} ({pattern.rating_count})
                    </TableCell>
                    <TableCell align="center">
                      <Chip label="Promoted" color="success" size="small" />
                    </TableCell>
                  </TableRow>
                ))}
                {promotedPatterns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No patterns have been promoted yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Threshold settings */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Promotion Thresholds</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <Box>
              <Typography variant="subtitle2">Likes needed</Typography>
              <Slider
                value={thresholds.like_threshold}
                min={10}
                max={500}
                step={10}
                valueLabelDisplay="on"
                onChange={(_, value) =>
                  setThresholds((prev) => ({ ...prev, like_threshold: value as number }))
                }
              />
            </Box>
            <Box>
              <Typography variant="subtitle2">Uses needed</Typography>
              <Slider
                value={thresholds.usage_threshold}
                min={10}
                max={500}
                step={10}
                valueLabelDisplay="on"
                onChange={(_, value) =>
                  setThresholds((prev) => ({ ...prev, usage_threshold: value as number }))
                }
              />
            </Box>
            <TextField
              label="Minimum rating"
              type="number"
              inputProps={{ step: 0.1, min: 1, max: 5 }}
              value={thresholds.rating_threshold}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, rating_threshold: Number(e.target.value) }))
              }
            />
            <TextField
              label="Minimum ratings count"
              type="number"
              value={thresholds.min_rating_count}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, min_rating_count: Number(e.target.value) }))
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={thresholds.auto_promote_enabled}
                  onChange={(e) =>
                    setThresholds((prev) => ({
                      ...prev,
                      auto_promote_enabled: e.target.checked,
                    }))
                  }
                />
              }
              label="Auto-promote when criteria met"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveThresholds} sx={{ bgcolor: '#ff8c00' }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pattern preview */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedPattern?.name}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" gutterBottom>
            {selectedPattern?.creator_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {selectedPattern?.description}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Chip icon={<Favorite />} label={`${selectedPattern?.like_count} likes`} />
            </Grid>
            <Grid item xs={6}>
              <Chip icon={<Visibility />} label={`${selectedPattern?.usage_count} uses`} />
            </Grid>
            <Grid item xs={6}>
              <Chip
                icon={<Star />}
                label={`${
                  selectedPattern ? selectedPattern.rating.toFixed(1) :'0.0'
                } (${selectedPattern?.rating_count ?? 0})`}
              />
            </Grid>
            <Grid item xs={6}>
              <Chip
                icon={<Lightbulb />}
                label={`Score ${selectedPattern ? calculateEligibilityScore(selectedPattern) : 0}`}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          {selectedPattern && !selectedPattern.is_promoted && (
            <Button
              variant="contained"
              startIcon={<ArrowUpward />}
              onClick={() => handlePromotePattern(selectedPattern.id)}
            >
              Promote
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirm Promote Dialog */}
      <Dialog
        open={!!confirmPromoteId}
        onClose={() => setConfirmPromoteId(null)}
      >
        <DialogTitle>Promote Pattern</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Promote this pattern to the Professional Library? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmPromoteId(null)}>Cancel</Button>
          <Button onClick={executePromotePattern} color="primary" variant="contained">
            Promote
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
