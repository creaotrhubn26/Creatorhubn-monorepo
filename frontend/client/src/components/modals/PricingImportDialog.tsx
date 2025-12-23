/**
 * Pricing Import Dialog
 * Import recommended pricing from Creo or NJ
 */

import React, { useState, useMemo } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
  Link,
  Grid,
  Checkbox,
  FormControlLabel,
  Divider,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as ImportIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { PricingImportService, PricingRecommendation } from '@/services/PricingImportService';

interface PricingImportDialogProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'music_producer';
  onImport: (recommendations: PricingRecommendation[]) => void;
}

export default function PricingImportDialog({
  open,
  onClose,
  profession,
  onImport,
}: PricingImportDialogProps) {
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [selectedSource, setSelectedSource] = useState<'creo' | 'nj'>('creo');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set();

  const availableSources = useMemo(() => {
    return PricingImportService.getAvailableSources(profession);
  }, [profession]);

  const recommendations = useMemo(() => {
    return PricingImportService.getPricingRecommendations(profession, selectedSource);
  }, [profession, selectedSource]);

  const categories = useMemo(() => {
    const categoryMap = new Map<string, PricingRecommendation[]>();
    recommendations.forEach((rec) => {
      if (!categoryMap.has(rec.category) {
        categoryMap.set(rec.category, []);
      }
      categoryMap.get(rec.category)!.push(rec);
    });
    return categoryMap;
  }, [recommendations]);

  const handleToggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === recommendations.length) {
      setSelectedItems(new Set();
    } else {
      setSelectedItems(new Set(recommendations.map((r) => r.id)));
    }
  };

  const handleImport = () => {
    const selectedRecommendations = recommendations.filter((r) => selectedItems.has(r.id);
    onImport(selectedRecommendations);
    setSelectedItems(new Set();
    onClose();
  };

  const professionName = getProfessionDisplayName(profession);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" component="div">
              Importer prisanbefalinger
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {professionName} - Norske bransjestandarder
            </Typography>
          </Box>
          <Button onClick={onClose} color="inherit">
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {availableSources.length === 0 ? (
          <Alert severity="info">
            Ingen prisanbefalinger tilgjengelig for {professionName.toLowerCase()} akkurat nå.
          </Alert>
        ) : (
          <>
            {/* Source Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={selectedSource}
                onChange={(_, newValue) => {
                  setSelectedSource(newValue);
                  setSelectedItems(new Set();
                }}
              >
                {availableSources.map((source) => (
                  <Tab
                    key={source}
                    value={source}
                    label={
                      <Box
                        sx={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 1 }}>
                        {source === 'creo' ? (
                          <img
                            src="https://creokultur.no/wp-content/uploads/2021/01/CREO_hovedlogo_lys-bakgrunn-RGB-logo-01-kopi.png"
                            alt="Creo logo"
                            style={{ height: 24, objectFit: 'contain' }}
                            onError={(e) => {
                              // Fallback if logo fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <img
                            src="https://commons.wikimedia.org/wiki/File:Norsk_Journalistlag_logo.svg"
                            alt="NJ logo"
                            style={{ height: 24, objectFit: 'contain' }}
                            onError={(e) => {
                              // Fallback if logo fails to load
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <Box>
                          <Typography variant="subtitle2">
                            {source === 'creo' ? 'Creo' : 'NJ'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {source === 'creo' ? 'Kunst og kultur' : 'Journalistforbundet'}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                ))}
              </Tabs>
            </Box>

            {/* Info Alert */}
            <Alert
              severity="info"
              icon={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {selectedSource === 'creo' ? (
                    <img
                      src="https://creokultur.no/wp-content/uploads/2021/01/CREO_hovedlogo_lys-bakgrunn-RGB-logo-01-kopi.png"
                      alt="Creo"
                      style={{ height: 20, marginRight: 8 }}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  ) : (
                    <img
                      src="https://commons.wikimedia.org/wiki/File:Norsk_Journalistlag_logo.svg"
                      alt="NJ"
                      style={{ height: 20, marginRight: 8 }}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                </Box>
              }
              sx={{ mb: 3 }}>
              <Typography variant="body2">
                Prisene er hentet fra{''}
                <Link
                  href={PricingImportService.getSourceUrl(selectedSource)}
                  target="_blank"
                  rel="noopener"
                >
                  {PricingImportService.getSourceName(selectedSource)}
                </Link>{''}
                og er basert på bransjestandarder i Norge. Du kan justere prisene etter import.
              </Typography>
            </Alert>

            {/* Select All */}
            <Box
              sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={
                      selectedItems.size === recommendations.length && recommendations.length > 0 }
                    indeterminate={
                      selectedItems.size > 0 && selectedItems.size < recommendations.length
                    }
                    onChange={handleSelectAll}
                  />
                }
                label={`Velg alle (${selectedItems.size} av ${recommendations.length} valgt)`}
              />
              <Typography variant="caption" color="textSecondary">
                Kilde oppdatert: {recommendations[0]?.lastUpdated || 'Ukjent'}
              </Typography>
            </Box>

            {/* Pricing Cards by Category */}
            {Array.from(categories.entries().map(([category, items]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {category}
                  <Chip label={`${items.length} priser`} size="small" />
                </Typography>
                <Grid container spacing={2}>
                  {items.map((rec) => (
                    <Grid item xs={12} md={6} key={rec.id}>
                      <Card
                        sx={{
                          border: selectedItems.has(rec.id) ? '2px solid' : '1px solid',
                          borderColor: selectedItems.has(rec.id) ? 'primary.main' : 'divider',
                          cursor: 'pointer',
                          transition: 'all 0.2s','&:hover': {
                            boxShadow: 4,
                            borderColor: 'primary.main',
                          }}}
                        onClick={() => handleToggleItem(rec.id)}
                      >
                        <CardContent>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'start',
                              mb: 1}}>
                            <Typography variant="h6" component="div">
                              {rec.name}
                            </Typography>
                            {selectedItems.has(rec.id) && <CheckIcon color="primary" />}
                          </Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                            {rec.description}
                          </Typography>

                          <Divider sx={{ my: 1 }} />

                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="textSecondary">
                                Minimum: </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {PricingImportService.formatPrice(rec.minPrice)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="textSecondary">
                                Anbefalt: </Typography>
                              <Typography variant="body2" fontWeight="bold" color="primary.main">
                                {PricingImportService.formatPrice(rec.recommendedPrice)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="caption" color="textSecondary">
                                Maksimum: </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {PricingImportService.formatPrice(rec.maxPrice)}
                              </Typography>
                            </Box>
                          </Stack>

                          <Box sx={{ mt: 2 }}>
                            <Chip label={rec.unit} size="small" variant="outlined" />
                          </Box>

                          {rec.notes && (
                            <Alert
                              severity="info"
                              sx={{ mt: 2 }}
                              icon={<InfoIcon fontSize="small" />}}

                            >
                              <Typography variant="caption">{rec.notes}</Typography>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
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
          startIcon={<ImportIcon />}
          onClick={handleImport}
          disabled={selectedItems.size === 0}
        >
          Importer {selectedItems.size > 0 && `(${selectedItems.size})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
