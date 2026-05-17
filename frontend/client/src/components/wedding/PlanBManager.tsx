// @ts-nocheck
/**
 * PlanBManager — Slice 9X.37
 *
 * Inline-komponent som vises under en værsensitiv primær-location.
 * Brudeparet kan:
 *   - Se eksisterende plan B-alternativer
 *   - Legge til ny plan B (label, adresse, indoor-flagg)
 *   - Aktivere én plan B (= alle timeline-events flyttes hit)
 *   - Deaktivere aktivert plan B
 */

import React, { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  Chip,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  AddBox as AddIcon,
  Home as IndoorIcon,
  Bolt as ActivateIcon,
  Restore as DeactivateIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Alternative {
  id: string;
  label: string;
  address: string | null;
  city: string | null;
  isIndoor: boolean | null;
  activationStatus: 'standby' | 'active' | 'used';
}

interface PlanBManagerProps {
  weddingId: string;
  primaryLocationId: string;
  alternatives: Alternative[];
  onChanged: () => void;
}

const PlanBManager: React.FC<PlanBManagerProps> = ({
  weddingId,
  primaryLocationId,
  alternatives,
  onChanged,
}) => {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/locations/${primaryLocationId}/alternatives`, {
        method: 'POST',
        body: {
          label: newLabel.trim(),
          address: newAddress.trim() || null,
          city: newCity.trim() || null,
          isIndoor: true,
        },
      });
      setNewLabel('');
      setNewAddress('');
      setNewCity('');
      setAdding(false);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke lagre plan B');
    } finally {
      setSubmitting(false);
    }
  };

  const activate = async (altId: string) => {
    setBusyId(altId);
    setError(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/locations/${altId}/activate`, {
        method: 'POST',
        body: { triggeredBy: 'couple' },
      });
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke aktivere plan B');
    } finally {
      setBusyId(null);
    }
  };

  const deactivate = async (altId: string) => {
    setBusyId(altId);
    setError(null);
    try {
      await apiRequest(`/api/wedding/${weddingId}/locations/${altId}/deactivate`, {
        method: 'POST',
      });
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke deaktivere plan B');
    } finally {
      setBusyId(null);
    }
  };

  const hasActive = alternatives.some((a) => a.activationStatus === 'active');

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        bgcolor: hasActive ? 'warning.50' : 'action.hover',
        borderColor: hasActive ? 'warning.main' : 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Plan B ved dårlig vær</Typography>
        {hasActive && <Chip size="small" color="warning" label="Plan B aktivert" />}
      </Stack>

      {alternatives.length === 0 && !adding && (
        <Typography variant="caption" color="text.secondary">
          Ingen plan B lagt til. Foreslås for utendørs seremoni hvis det melder regn.
        </Typography>
      )}

      <Stack spacing={1} sx={{ mb: 1 }}>
        {alternatives.map((a) => (
          <Stack key={a.id} direction="row" alignItems="center" spacing={1}>
            {a.isIndoor && <Tooltip title="Innendørs"><IndoorIcon fontSize="small" color="action" /></Tooltip>}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2"><b>{a.label}</b></Typography>
              {a.address && (
                <Typography variant="caption" color="text.secondary">
                  {a.address}{a.city ? `, ${a.city}` : ''}
                </Typography>
              )}
            </Box>
            {a.activationStatus === 'active' ? (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={busyId === a.id ? <CircularProgress size={14} /> : <DeactivateIcon fontSize="small" />}
                onClick={() => deactivate(a.id)}
                disabled={busyId === a.id}
              >
                Tilbake til primary
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                color="warning"
                startIcon={busyId === a.id ? <CircularProgress size={14} color="inherit" /> : <ActivateIcon fontSize="small" />}
                onClick={() => activate(a.id)}
                disabled={busyId === a.id || hasActive}
              >
                Aktiver plan B
              </Button>
            )}
          </Stack>
        ))}
      </Stack>

      {adding ? (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Navn på plan B"
            placeholder="F.eks. Innendørs sal, paviljong med tak"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Adresse (valgfri)" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} fullWidth />
            <TextField size="small" label="Sted" value={newCity} onChange={(e) => setNewCity(e.target.value)} sx={{ width: 140 }} />
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => { setAdding(false); setNewLabel(''); }}>Avbryt</Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleAdd}
              disabled={submitting || !newLabel.trim()}
            >
              {submitting ? 'Lagrer…' : 'Lagre plan B'}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAdding(true)}
        >
          Legg til plan B
        </Button>
      )}

      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Paper>
  );
};

export default PlanBManager;
