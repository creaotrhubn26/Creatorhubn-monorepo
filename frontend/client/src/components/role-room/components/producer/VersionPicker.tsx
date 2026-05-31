/**
 * VersionPicker — gjenbrukbar dropdown for intake-versjoner og
 * markedsplan-versjoner. Aktivere bytter live-versjon.
 *
 * Komponenten er generisk: tar en list-funksjon + activate-funksjon
 * fra parent, så den passer både research (snapshot per intake-save)
 * og plan (snapshot per aktivering).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Menu, MenuItem, Button, Chip, CircularProgress,
  Divider,
} from '@mui/material';
import {
  History as HistoryIcon,
  Check as CheckIcon,
  Person as PersonIcon,
  AutoAwesome as AgentIcon,
} from '@mui/icons-material';

export interface VersionItem {
  id: string;
  versionNumber: number;
  label: string | null;
  generatedByKind: 'user' | 'agent';
  /** Navn (eller email-fallback) på personen som genererte versjonen. */
  generatedByName?: string | null;
  isActive: boolean;
  createdAt: string;
  /** Valgfri ekstra-tekst per type — for research: goal-preview, for plan: valueProp. */
  previewText?: string | null;
  /** Valgfri counts — for plan: pillars + posts. */
  counts?: Array<{ label: string; value: number }>;
}

interface Props {
  title: string;
  versions: VersionItem[];
  loading?: boolean;
  onActivate: (versionId: string) => Promise<void>;
  /** Kalt etter aktivering — typisk for å refreshe parent-data. */
  onAfterActivate?: () => void;
  /** Tema-farge. Default lila for markedsplan. */
  accentColor?: string;
}

export function VersionPicker({
  title, versions, loading, onActivate, onAfterActivate,
  accentColor = '#ec4899',
}: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = Boolean(anchorEl);

  const active = versions.find(v => v.isActive);

  const handleActivate = useCallback(async (versionId: string) => {
    setActivatingId(versionId);
    setError(null);
    try {
      await onActivate(versionId);
      setAnchorEl(null);
      onAfterActivate?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActivatingId(null);
    }
  }, [onActivate, onAfterActivate]);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  return (
    <>
      <Button onClick={(e) => setAnchorEl(e.currentTarget)}
              startIcon={<HistoryIcon />}
              size="small"
              variant="outlined"
              disabled={loading || versions.length === 0}
              sx={{
                borderColor: `${accentColor}40`,
                color: accentColor,
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { borderColor: accentColor, bgcolor: `${accentColor}10` },
              }}>
        {loading ? 'Laster …'
          : versions.length === 0 ? 'Ingen versjoner'
          : active ? `v${active.versionNumber}${active.label ? ` · ${active.label}` : ''}`
          : `${versions.length} versjoner`}
      </Button>

      <Menu anchorEl={anchorEl}
            open={open}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              sx: {
                bgcolor: 'rgba(15,23,42,0.96)',
                border: `1px solid ${accentColor}30`,
                color: '#e2e8f0',
                minWidth: 320, maxWidth: 480,
              },
            }}>
        <Box sx={{ px: 2, py: 1.4 }}>
          <Typography sx={{ color: accentColor, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {title}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.78rem', mt: 0.2 }}>
            Velg en versjon for å aktivere den
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />
        {error && (
          <Box sx={{ p: 1.4, bgcolor: 'rgba(239,79,111,0.10)', color: '#ef4f6f', fontSize: 12 }}>
            {error}
          </Box>
        )}
        {versions.map(v => {
          const isActivating = activatingId === v.id;
          return (
            <MenuItem key={v.id}
                      onClick={() => !v.isActive && !isActivating && void handleActivate(v.id)}
                      disabled={v.isActive || isActivating}
                      sx={{
                        flexDirection: 'column', alignItems: 'flex-start',
                        py: 1, px: 2,
                        borderBottom: '1px solid rgba(148,163,184,0.08)',
                        '&:hover': {
                          bgcolor: !v.isActive ? `${accentColor}10` : undefined,
                        },
                      }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
                  v{v.versionNumber}
                </Typography>
                {v.label && (
                  <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.78)' }}>
                    · {v.label}
                  </Typography>
                )}
                <Chip size="small"
                      icon={v.generatedByKind === 'agent'
                        ? <AgentIcon sx={{ fontSize: 11 }} />
                        : <PersonIcon sx={{ fontSize: 11 }} />}
                      label={v.generatedByKind === 'agent'
                        ? 'Agent'
                        : (v.generatedByName?.split('@')[0] ?? 'Bruker')}
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        bgcolor: v.generatedByKind === 'agent'
                          ? 'rgba(168,85,247,0.18)' : 'rgba(34,211,238,0.18)',
                        color: v.generatedByKind === 'agent' ? '#c084fc' : '#67e8f9',
                        ml: 'auto',
                      }} />
                {v.isActive && (
                  <Chip size="small"
                        icon={<CheckIcon sx={{ fontSize: 11 }} />}
                        label="Aktiv"
                        sx={{
                          height: 18,
                          fontSize: '0.62rem',
                          bgcolor: 'rgba(74,212,138,0.20)',
                          color: '#4ad48a',
                        }} />
                )}
                {isActivating && <CircularProgress size={12} sx={{ color: accentColor }} />}
              </Stack>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.55)', mt: 0.4 }}>
                {new Date(v.createdAt).toLocaleString('nb', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Typography>
              {v.previewText && (
                <Typography sx={{ fontSize: '0.76rem', color: 'rgba(226,232,240,0.72)', mt: 0.4, fontStyle: 'italic' }}>
                  "{v.previewText}"
                </Typography>
              )}
              {v.counts && v.counts.length > 0 && (
                <Stack direction="row" spacing={1.4} sx={{ mt: 0.4 }}>
                  {v.counts.map(c => (
                    <Typography key={c.label} sx={{ fontSize: '0.7rem', color: 'rgba(226,232,240,0.62)' }}>
                      {c.value} {c.label}
                    </Typography>
                  ))}
                </Stack>
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export default VersionPicker;
