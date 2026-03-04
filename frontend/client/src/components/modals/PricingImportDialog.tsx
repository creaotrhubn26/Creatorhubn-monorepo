/**
 * Pricing Import Dialog
 * Import recommended pricing from Creo or NJ
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Link,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Download,
  Info,
} from '@mui/icons-material';
import type { PricingRecommendation } from '@/services/PricingImportService';
import { PricingImportService } from '@/services/PricingImportService';

interface PricingImportDialogProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'music_producer';
  onImport: (recommendations: PricingRecommendation[]) => void;
}

function sourceTabToIndex(source: 'creo' | 'nj'): number {
  return source === 'creo' ? 0 : 1;
}

function indexToSource(index: number): 'creo' | 'nj' {
  return index === 1 ? 'nj' : 'creo';
}

export default function PricingImportDialog({
  open,
  onClose,
  profession,
  onImport,
}: PricingImportDialogProps) {
  const [selectedSource, setSelectedSource] = useState<'creo' | 'nj'>('creo');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const availableSources = useMemo(() => PricingImportService.getAvailableSources(profession), [profession]);

  const recommendations = useMemo(
    () => PricingImportService.getPricingRecommendations(profession, selectedSource),
    [profession, selectedSource],
  );

  const groupedRecommendations = useMemo(() => {
    const groups = new Map<string, PricingRecommendation[]>();

    for (const recommendation of recommendations) {
      if (!groups.has(recommendation.category)) {
        groups.set(recommendation.category, []);
      }
      groups.get(recommendation.category)?.push(recommendation);
    }

    return groups;
  }, [recommendations]);

  const selectedCount = selectedItems.size;

  const handleToggleItem = (id: string) => {
    setSelectedItems((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === recommendations.length) {
      setSelectedItems(new Set());
      return;
    }

    setSelectedItems(new Set(recommendations.map((recommendation) => recommendation.id)));
  };

  const handleImport = () => {
    const selectedRecommendations = recommendations.filter((recommendation) =>
      selectedItems.has(recommendation.id),
    );

    onImport(selectedRecommendations);
    setSelectedItems(new Set());
    onClose();
  };

  const sourceName = PricingImportService.getSourceName(selectedSource);
  const sourceUrl = PricingImportService.getSourceUrl(selectedSource);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Typography variant="h5">Importer prisanbefalinger</Typography>
        <Typography variant="caption" color="text.secondary">
          {PricingImportService.getProfessionDisplayName(profession)} • Norske bransjestandarder
        </Typography>
      </DialogTitle>

      <DialogContent>
        {availableSources.length === 0 ? (
          <Alert severity="info">
            Ingen prisanbefalinger tilgjengelig for denne profesjonen akkurat nå.
          </Alert>
        ) : (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
              <Tabs
                value={sourceTabToIndex(selectedSource)}
                onChange={(_, nextIndex) => {
                  const nextSource = indexToSource(nextIndex);
                  setSelectedSource(nextSource);
                  setSelectedItems(new Set());
                }}
              >
                <Tab label="Creo" disabled={!availableSources.includes('creo')} />
                <Tab label="NJ" disabled={!availableSources.includes('nj')} />
              </Tabs>
            </Box>

            <Alert severity="info" icon={<Info fontSize="small" />} sx={{ mb: 2 }}>
              Prisene er hentet fra{' '}
              <Link href={sourceUrl} target="_blank" rel="noopener">
                {sourceName}
              </Link>{' '}
              og kan justeres etter import.
            </Alert>

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedItems.size === recommendations.length && recommendations.length > 0}
                    indeterminate={selectedItems.size > 0 && selectedItems.size < recommendations.length}
                    onChange={handleSelectAll}
                  />
                }
                label={`Velg alle (${selectedCount} av ${recommendations.length})`}
              />
              <Typography variant="caption" color="text.secondary">
                Sist oppdatert: {recommendations[0]?.lastUpdated ?? 'Ukjent'}
              </Typography>
            </Box>

            {Array.from(groupedRecommendations.entries()).map(([category, items]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {category}
                  <Chip label={`${items.length} priser`} size="small" />
                </Typography>

                <Grid container spacing={2}>
                  {items.map((recommendation) => {
                    const selected = selectedItems.has(recommendation.id);
                    return (
                      <Grid item xs={12} md={6} key={recommendation.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderColor: selected ? 'primary.main' : 'divider',
                            borderWidth: selected ? 2 : 1,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleToggleItem(recommendation.id)}
                        >
                          <CardContent>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                mb: 1,
                              }}
                            >
                              <Typography variant="h6">{recommendation.name}</Typography>
                              {selected && <CheckCircle color="primary" fontSize="small" />}
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {recommendation.description}
                            </Typography>

                            <Divider sx={{ my: 1 }} />

                            <Box sx={{ display: 'grid', gap: 0.5 }}>
                              <Typography variant="body2">
                                Minimum: <strong>{PricingImportService.formatPrice(recommendation.minPrice)}</strong>
                              </Typography>
                              <Typography variant="body2">
                                Anbefalt:{' '}
                                <strong>{PricingImportService.formatPrice(recommendation.recommendedPrice)}</strong>
                              </Typography>
                              <Typography variant="body2">
                                Maksimum: <strong>{PricingImportService.formatPrice(recommendation.maxPrice)}</strong>
                              </Typography>
                            </Box>

                            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip label={recommendation.unit} size="small" variant="outlined" />
                              <Chip label={recommendation.source.toUpperCase()} size="small" variant="outlined" />
                            </Box>

                            {recommendation.notes && (
                              <Alert severity="info" icon={<Info fontSize="small" />} sx={{ mt: 1.5 }}>
                                <Typography variant="caption">{recommendation.notes}</Typography>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            ))}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleImport}
          disabled={selectedCount === 0}
        >
          Importer {selectedCount > 0 ? `(${selectedCount})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
