/**
 * Simple Split Sheet Editor
 * Simplified split sheet editor for project creation modal
 * Inspired by the existing SplitSheetEditor but without complex dependencies
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { SplitSheetContributor, ContributorRole } from '../split-sheets/types';
import { ROLE_DISPLAY_NAMES } from '../split-sheets/types';

interface SimpleSplitSheetEditorProps {
  contributors: SplitSheetContributor[];
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  onChange: (contributors: SplitSheetContributor[]) => void;
}

// Role mappings based on profession
const getAvailableRoles = (profession: string): ContributorRole[] => {
  switch (profession) {
    case 'music_producer':
      return ['producer', 'artist', 'songwriter', 'composer', 'vocalist', 'mix_engineer', 'collaborator', 'other'];
    case 'photographer':
      return ['second_shooter', 'photo_editor', 'retoucher', 'assistant', 'stylist', 'makeup_artist', 'collaborator', 'other'];
    case 'videographer':
      return ['video_editor', 'colorist', 'sound_engineer', 'cinematographer', 'grip', 'gaffer', 'collaborator', 'other'];
    default:
      return ['collaborator', 'other'];
  }
};

export default function SimpleSplitSheetEditor({
  contributors,
  profession = 'photographer',
  onChange,
}: SimpleSplitSheetEditorProps) {
  const availableRoles = useMemo(() => getAvailableRoles(profession), [profession]);

  // Calculate total percentage
  const totalPercentage = useMemo(() => {
    return contributors.reduce((sum, c) => sum + (c.percentage || 0), 0);
  }, [contributors]);

  const isValid = useMemo(() => {
    return Math.abs(totalPercentage - 100) < 0.01 && 
           contributors.length > 0 &&
           contributors.every(c => c.name && c.name.trim().length > 0 && c.percentage > 0);
  }, [totalPercentage, contributors]);

  const handleAddContributor = useCallback(() => {
    const newContributor: SplitSheetContributor = {
      name: '',
      email: '',
      role: 'collaborator',
      percentage: 0,
      order_index: contributors.length,
      custom_fields: {},
    };
    onChange([...contributors, newContributor]);
  }, [contributors, onChange]);

  const handleRemoveContributor = useCallback((index: number) => {
    onChange(contributors.filter((_, i) => i !== index));
  }, [contributors, onChange]);

  const handleContributorChange = useCallback((index: number, field: keyof SplitSheetContributor, value: any) => {
    const updated = [...contributors];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }, [contributors, onChange]);

  const handleDistributeEvenly = useCallback(() => {
    if (contributors.length === 0) return;
    const evenPercentage = 100 / contributors.length;
    const updated = contributors.map((c, i) => ({ ...c, percentage: evenPercentage, order_index: i }));
    onChange(updated);
  }, [contributors, onChange]);

  const percentageError = Math.abs(totalPercentage - 100) >= 0.01;
  const percentageWarning = Math.abs(totalPercentage - 100) < 0.01 && Math.abs(totalPercentage - 100) > 0;

  return (
    <Box>
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Bidragsytere
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddContributor}
            variant="outlined"
            size="small"
          >
            Legg til
          </Button>
        </Box>

        {/* Percentage Summary */}
        <Alert 
          severity={percentageError ? 'error' : percentageWarning ? 'warning' : 'success'}
          sx={{ mb: 2 }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">
              Totalt: {totalPercentage.toFixed(2)}% {percentageError && '(må være 100%)'}
            </Typography>
            {contributors.length > 1 && (
              <Button size="small" onClick={handleDistributeEvenly}>
                Fordel jevnt
              </Button>
            )}
          </Box>
        </Alert>

        {/* Contributors List */}
        {contributors.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                Ingen bidragsytere lagt til. Klikk "Legg til" for å legge til en bidragsyter.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {contributors.map((contributor, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ color: 'text.secondary' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Bidragsyter {index + 1}
                      </Typography>
                    </Box>
                    {contributors.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveContributor(index)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <Stack spacing={2}>
                    {/* Name */}
                    <TextField
                      label="Navn"
                      fullWidth
                      size="small"
                      value={contributor.name}
                      onChange={(e) => handleContributorChange(index, 'name', e.target.value)}
                      required
                    />

                    {/* Email */}
                    <TextField
                      label="E-post (valgfritt)"
                      fullWidth
                      size="small"
                      type="email"
                      value={contributor.email || ''}
                      onChange={(e) => handleContributorChange(index, 'email', e.target.value)}
                    />

                    {/* Role */}
                    <FormControl fullWidth size="small">
                      <InputLabel>Rolle</InputLabel>
                      <Select
                        value={contributor.role}
                        label="Rolle"
                        onChange={(e) => handleContributorChange(index, 'role', e.target.value)}
                      >
                        {availableRoles.map((role) => (
                          <MenuItem key={role} value={role}>
                            {ROLE_DISPLAY_NAMES[role] || role}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Percentage */}
                    <TextField
                      label="Prosentandel (%)"
                      fullWidth
                      size="small"
                      type="number"
                      inputProps={{ min: 0, max: 100, step: 0.01 }}
                      value={contributor.percentage || 0}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        handleContributorChange(index, 'percentage', Math.min(100, Math.max(0, value)));
                      }}
                      error={contributor.percentage < 0 || contributor.percentage > 100}
                      helperText={contributor.percentage < 0 || contributor.percentage > 100 ? 'Må være mellom 0 og 100' : ''}
                      required
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {/* Validation Message */}
        {!isValid && contributors.length > 0 && (
          <Alert severity="error">
            Alle bidragsytere må ha navn og prosentandeler, og totalen må være 100%.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

