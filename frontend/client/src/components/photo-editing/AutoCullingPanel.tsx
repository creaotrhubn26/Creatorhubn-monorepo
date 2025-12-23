/**
 * AUTO CULLING PANEL
 * AI-powered photo culling with quality analysis
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  Cancel,
  HelpOutline,
  Delete,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

export interface PhotoForCulling {
  id: string;
  url: string;
  thumbnailUrl?: string;
}

interface CullingResult {
  keepers: Array<{ id: string; score: number; reasons: string[] }>;
  rejected: Array<{ id: string; score: number; reasons: string[] }>;
  maybes: Array<{ id: string; score: number; reasons: string[] }>;
  statistics: {
    total: number;
    keeperPercentage: number;
    averageQuality: number;
    processingTime: number;
  };
}

interface AutoCullingPanelProps {
  photos: PhotoForCulling[];
  onCullingComplete?: (result: CullingResult) => void;
  onPhotosFiltered?: (keepers: string[], rejected: string[], maybes: string[]) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function AutoCullingPanel({
  photos,
  onCullingComplete,
  onPhotosFiltered,
  profession = 'photographer',
}: AutoCullingPanelProps) {
  const theming = useTheming(profession);
  const [isCulling, setIsCulling] = useState(false);
  const [cullResult, setCullResult] = useState<CullingResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [keepPercentage, setKeepPercentage] = useState(25);
  const [criteria, setCriteria] = useState({
    composition: 0.3,
    sharpness: 0.4,
    exposure: 0.2,
    expression: 0.1,
  });
  const [autoApply, setAutoApply] = useState(false);
  const [useSubjectDetection, setUseSubjectDetection] = useState(true);
  const [subjectDetectionResults, setSubjectDetectionResults] = useState<Record<string, { subjectCount: number; confidence: number }>>({});

  // Subject detection mutation
  const detectSubjectsMutation = useMutation({
    mutationFn: async (photoUrls: string[]) => {
      const results: Record<string, { subjectCount: number; confidence: number }> = {};
      
      for (const url of photoUrls.slice(0, 20)) { // Limit to 20 for performance
        try {
          const segmentation = await sam2Service.segmentImageFromUrl(url, undefined, 'auto', 'tiny');
          const subjectCount = segmentation.masks.length;
          const avgConfidence = segmentation.masks.reduce((sum, m) => sum + m.confidence, 0) / segmentation.masks.length;
          results[url] = { subjectCount, confidence: avgConfidence };
        } catch (error) {
          console.warn(`Subject detection failed for ${url}:`, error);
          results[url] = { subjectCount: 0, confidence: 0 };
        }
      }
      
      setSubjectDetectionResults(results);
      return results;
    },
  });

  const handleStartCulling = async () => {
    if (photos.length === 0) return;

    setIsCulling(true);
    try {
      // Optionally detect subjects first
      if (useSubjectDetection) {
        await detectSubjectsMutation.mutateAsync(photos.map(p => p.url));
      }
      
      const result = await apiRequest('/api/ai/cull-photos', {
        method: 'POST',
        body: JSON.stringify({
          photos: photos.map(p => ({ 
            id: p.id, 
            url: p.url,
            subjectInfo: subjectDetectionResults[p.url] || null,
          })),
          keepPercentage,
          criteria,
          useSubjectDetection,
        }),
      }) as CullingResult;

      setCullResult(result);
      onCullingComplete?.(result);

      if (autoApply) {
        handleApplyResults(result);
      } else {
        setShowResultDialog(true);
      }
    } catch (error) {
      console.error('Auto-culling failed: ', error);
    } finally {
      setIsCulling(false);
    }
  };

  const handleApplyResults = (result?: CullingResult) => {
    const finalResult = result || cullResult;
    if (!finalResult) return;

    const keepers = finalResult.keepers.map(k => k.id);
    const rejected = finalResult.rejected.map(r => r.id);
    const maybes = finalResult.maybes.map(m => m.id);

    onPhotosFiltered?.(keepers, rejected, maybes);
    setShowResultDialog(false);
  };

  const getQualityColor = (score: number): string => {
    if (score >= 0.8) return '#4CAF50';
    if (score >= 0.6) return '#FFC107';
    if (score >= 0.4) return '#FF9800';
    return '#F44336';
  };

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            AI Auto Culling
          </Typography>
          <Chip
            label={`${photos.length} photos`}
            size="small"
            color="primary"
          />
        </Box>

        <Typography variant="body2" color="text.secondary">
          Automatically analyze and select the best photos from your collection
        </Typography>
        
        {/* Subject Detection Option */}
        <FormControlLabel
          control={
            <Switch
              checked={useSubjectDetection}
              onChange={(e) => setUseSubjectDetection(e.target.checked)}
            />
          }
          label="Use Subject Detection (SAM 2) - Better culling for event photography"
        />

        {/* Keep Percentage */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Keep Percentage</Typography>
            <Typography variant="body2" color="text.secondary">
              {keepPercentage}%
            </Typography>
          </Box>
          <Slider
            value={keepPercentage}
            onChange={(_, v) => setKeepPercentage(v as number)}
            min={10}
            max={50}
            marks={[
              { value: 10, label: '10%' },
              { value: 25, label: '25%' },
              { value: 50, label: '50%' },
            ]}
          />
          <Typography variant="caption" color="text.secondary">
            Keep approximately {Math.round(photos.length * keepPercentage / 100)} of {photos.length} photos
          </Typography>
        </Box>

        {/* Criteria Weights */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Quality Criteria Weights
          </Typography>
          <Stack spacing={2}>
            {[
              { key: 'sharpness', label: 'Sharpness', value: criteria.sharpness },
              { key: 'composition', label: 'Composition', value: criteria.composition },
              { key: 'exposure', label: 'Exposure', value: criteria.exposure },
              { key: 'expression', label: 'Expression', value: criteria.expression },
            ].map((item) => (
              <Box key={item.key}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(item.value * 100)}%
                  </Typography>
                </Box>
                <Slider
                  value={item.value}
                  onChange={(_, v) =>
                    setCriteria(prev => ({ ...prev, [item.key]: v as number }))
                  }
                  min={0}
                  max={1}
                  step={0.1}
                  size="small"
                />
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Auto Apply */}
        <FormControlLabel
          control={
            <Switch
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
            />
          }
          label="Auto-apply results after culling"
        />

        {/* Start Culling Button */}
        <Button
          variant="contained"
          startIcon={<AutoAwesome />}
          onClick={handleStartCulling}
          disabled={isCulling || photos.length === 0}
          fullWidth
          sx={{ py: 1.5 }}
        >
          {isCulling ? 'Analyzing Photos...' : 'Start AI Culling'}
        </Button>

        {isCulling && (
          <Box>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Analyzing {photos.length} photos...
            </Typography>
          </Box>
        )}

        {/* Results Dialog */}
        <Dialog
          open={showResultDialog}
          onClose={() => setShowResultDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Stack direction="row" spacing={2} alignItems="center">
              <AutoAwesome />
              <Typography variant="h6">Culling Results</Typography>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {cullResult && (
              <Stack spacing={3}>
                {/* Statistics */}
                <Paper sx={{ p: 2, bgcolor: '#1f1f1f' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Statistics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Total Photos
                      </Typography>
                      <Typography variant="h6">{cullResult.statistics.total}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Keepers
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#4CAF50' }}>
                        {cullResult.keepers.length} ({cullResult.statistics.keeperPercentage.toFixed(1)}%)
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Average Quality
                      </Typography>
                      <Typography variant="h6">
                        {(cullResult.statistics.averageQuality * 100).toFixed(0)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Processing Time
                      </Typography>
                      <Typography variant="h6">
                        {cullResult.statistics.processingTime.toFixed(0)}ms
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Keepers */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#4CAF50' }}>
                    Keepers ({cullResult.keepers.length})
                  </Typography>
                  <Grid container spacing={1}>
                    {cullResult.keepers.slice(0, 12).map((item) => {
                      const photo = photos.find(p => p.id === item.id);
                      return (
                        <Grid item xs={3} key={item.id}>
                          <Card
                            sx={{
                              position: 'relative',
                              border: '2px solid #4CAF50'}}
                          >
                            {photo && (
                              <Box
                                sx={{
                                  width: '100%',
                                  paddingTop: '100%',
                                  backgroundImage: `url(${photo.thumbnailUrl || photo.url})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center'}}
                              />
                            )}
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                bgcolor: 'rgba(0, 0, 0, 0.7)',
                                p: 0.5}}
                            >
                              <Typography variant="caption" sx={{ color: '#fff', fontSize: '10px' }}>
                                {(item.score * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>

                {/* Rejected */}
                {cullResult.rejected.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: '#F44336' }}>
                      Rejected ({cullResult.rejected.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cullResult.rejected.length} photos were automatically rejected due to low quality
                    </Typography>
                  </Box>
                )}

                {/* Maybes */}
                {cullResult.maybes.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom sx={{ color:'#FF9800' }}>
                      Review ({cullResult.maybes.length})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cullResult.maybes.length} photos need manual review
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowResultDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => handleApplyResults()}
              startIcon={<CheckCircle />}
            >
              Apply Results
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}

