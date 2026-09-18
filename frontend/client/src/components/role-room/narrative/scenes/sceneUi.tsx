/**
 * Små, delte byggeklosser for scenekortet: felt med autosave ved blur,
 * statuschip, lagret-indikator og seksjonsoverskrift. Samme fargetokens som
 * resten av Story Graph (konsistens > variasjon).
 */

import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Menu, MenuItem, TextField, Typography } from '@mui/material';
import { CheckCircleOutline as SavedIcon, ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import { NARRATIVE_SCENE_STATUSES, type NarrativeSceneStatus } from '../narrativeTypes';
import { SCENE_STATUS_COLORS, SCENE_STATUS_LABELS, formatTime } from './sceneOps';
import type { SaveState } from './useNarrativeScenes';

export const sceneFieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)', fontSize: 13 },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
  '& .MuiFormHelperText-root': { color: narrativeColors.textDim },
} as const;

export interface AutosaveFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
  testId?: string;
  type?: 'text' | 'date';
  helperText?: string;
  maxLength?: number;
}

/**
 * Tekstfelt som lagrer ved blur (og Enter for enlinje) — kun når verdien
 * faktisk er endret. Utkastet beholdes ved feil så ingenting går tapt.
 */
export function AutosaveField({ label, value, onSave, multiline, minRows = 3, placeholder, testId, type = 'text', helperText, maxLength }: AutosaveFieldProps) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ny verdi fra serveren (annen bruker / reload) → oppdater feltet hvis det ikke redigeres.
  useEffect(() => { if (!dirty) setDraft(value); }, [value, dirty]);

  const commit = async () => {
    if (!dirty || draft === value) { setDirty(false); return; }
    try {
      await onSave(draft);
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre');
    }
  };

  return (
    <TextField
      size="small"
      fullWidth
      type={type}
      label={label}
      value={draft}
      placeholder={placeholder}
      multiline={multiline}
      minRows={multiline ? minRows : undefined}
      error={!!error}
      helperText={error ? `${error} — endringen er ikke lagret. Klikk utenfor feltet for å prøve igjen.` : helperText}
      onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
      onBlur={() => void commit()}
      onKeyDown={(e) => { if (!multiline && e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      inputProps={{ 'data-testid': testId, maxLength }}
      InputLabelProps={type === 'date' ? { shrink: true } : undefined}
      sx={sceneFieldSx}
    />
  );
}

export function SceneStatusChip({ status, onChange, testId, size = 'small' }: { status: NarrativeSceneStatus; onChange?: (next: NarrativeSceneStatus) => void; testId?: string; size?: 'small' | 'medium' }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const color = SCENE_STATUS_COLORS[status];
  return (
    <>
      <Chip
        size={size}
        label={SCENE_STATUS_LABELS[status]}
        onClick={onChange ? (e) => setAnchor(e.currentTarget) : undefined}
        data-testid={testId}
        data-status={status}
        sx={{ bgcolor: `${color}22`, color, fontWeight: 700, border: `1px solid ${color}55`, cursor: onChange ? 'pointer' : 'default', height: size === 'small' ? 22 : undefined, fontSize: size === 'small' ? 11 : undefined }}
      />
      {onChange ? (
        <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
          {NARRATIVE_SCENE_STATUSES.map((s) => (
            <MenuItem key={s} selected={s === status} onClick={() => { setAnchor(null); if (s !== status) onChange(s); }} data-testid={testId ? `${testId}-option-${s}` : undefined} sx={{ fontSize: 13 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SCENE_STATUS_COLORS[s], mr: 1 }} />
              {SCENE_STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </Menu>
      ) : null}
    </>
  );
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'saving') {
    return <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="narrative-scene-saving"><CircularProgress size={10} sx={{ color: narrativeColors.textDim }} /> Lagrer…</Typography>;
  }
  if (state.kind === 'saved') {
    return <Typography sx={{ fontSize: 11, color: narrativeColors.accent, display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="narrative-scene-saved"><SavedIcon sx={{ fontSize: 14 }} /> Lagret {formatTime(state.at)}</Typography>;
  }
  return (
    <Typography sx={{ fontSize: 11, color: narrativeColors.error, display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="narrative-scene-save-error">
      <ErrorIcon sx={{ fontSize: 14 }} /> {state.message}
      <Button size="small" onClick={() => void state.retry()} sx={{ color: narrativeColors.error, fontSize: 11, minWidth: 0, p: 0, ml: 0.5 }}>Prøv igjen</Button>
    </Typography>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography sx={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: narrativeColors.textDim, textTransform: 'uppercase', flex: 1 }}>{children}</Typography>
      {action}
    </Box>
  );
}

export function EmptyHint({ title, body, action, testId }: { title: string; body?: string; action?: React.ReactNode; testId?: string }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center', border: `1px dashed ${narrativeColors.borderSoft}`, borderRadius: 2, color: narrativeColors.textDim }} data-testid={testId}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: narrativeColors.text }}>{title}</Typography>
      {body ? <Typography sx={{ fontSize: 12, mt: 0.5 }}>{body}</Typography> : null}
      {action ? <Box sx={{ mt: 1.5 }}>{action}</Box> : null}
    </Box>
  );
}
