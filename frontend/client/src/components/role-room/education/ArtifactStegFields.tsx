/**
 * ArtifactStegFields.tsx — delt Artefakt + betinget Steg-par for oppgaveautorering.
 *
 * Artefakt velger produksjons-fane (ARTIFACT_OPTIONS). Når artefakt = 'story-arc'
 * glir et sekundært Steg-felt inn (STEG_OPTIONS) for view-nivå targeting inne i
 * Story Arc Studio (student lander rett i Story Logic/Story Writer). Delt av
 * AssignmentsTab (faglærer-autorering) og DeepLinkPicker (LMS-autorering) — én
 * kilde til visuell + logisk sannhet.
 *
 * Design: docs/superpowers/specs/2026-08-09-edu-artifact-ui-design.md §1, §4.3.
 * Bans: ingen side-stripe — kobling Artefakt↔Steg vises som delt accent-ring +
 * lav-alfa vask (chunking), aldri en farget kant.
 */

import { useMemo } from 'react';
import { Box, Collapse, MenuItem, TextField, useMediaQuery, useTheme } from '@mui/material';

export const ARTIFACT_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Fri leveranse' },
  { key: 'story-arc', label: 'Story Arc' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'shotlist', label: 'Shot list' },
  { key: 'callsheet', label: 'Call sheet' },
  { key: 'roles', label: 'Roller' },
  { key: 'candidates', label: 'Kandidater' },
  { key: 'delivery', label: 'Levering' },
];
export const artifactLabel = (k: string | null) => ARTIFACT_OPTIONS.find((o) => o.key === k)?.label ?? null;

export const STEG_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Hele Story Arc' },
  { key: 'story-logic', label: 'Story Logic' },
  { key: 'story-writer', label: 'Story Writer' },
];
export const stegLabel = (k: string | null) => STEG_OPTIONS.find((o) => o.key === k)?.label ?? null;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface ArtifactStegFieldsProps {
  artifactKind: string;
  artifactView: string;
  disabled?: boolean;
  onArtifactKindChange: (kind: string) => void;
  onArtifactViewChange: (view: string) => void;
}

/** Artefakt-select + betinget Steg-select. Steg finnes kun i DOM når
 *  artifactKind === 'story-arc'; bytte bort fra Story Arc nullstiller
 *  artifactView i samme handling (ingen skjult view-verdi henger igjen). */
export function ArtifactStegFields({
  artifactKind, artifactView, disabled, onArtifactKindChange, onArtifactViewChange,
}: ArtifactStegFieldsProps) {
  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const showSteg = artifactKind === 'story-arc';
  const reduceMotion = useMemo(prefersReducedMotion, []);

  const ringSx = { '& .MuiOutlinedInput-notchedOutline': { transition: 'border-color 160ms ease-out', borderColor: showSteg ? 'rgba(139,92,246,0.35)' : undefined } };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5,
        borderRadius: 2,
        p: showSteg ? 0.5 : 0,
        bgcolor: showSteg ? 'rgba(139,92,246,0.05)' : 'transparent',
        transition: 'background-color 160ms ease-out',
      }}
    >
      <TextField
        size="small" select label="Artefakt" value={artifactKind}
        onChange={(e) => {
          const v = e.target.value;
          onArtifactKindChange(v);
          if (v !== 'story-arc') onArtifactViewChange('');
        }}
        disabled={disabled}
        helperText={disabled ? 'Velg produksjon først' : undefined}
        sx={{ minWidth: 150, '& .MuiInputBase-root': { minHeight: { xs: 44 } }, ...ringSx }}
      >
        {ARTIFACT_OPTIONS.map((o) => <MenuItem key={o.key || 'free'} value={o.key}>{o.label}</MenuItem>)}
      </TextField>
      <Collapse
        in={showSteg}
        orientation={isSmUp ? 'horizontal' : 'vertical'}
        timeout={reduceMotion ? 0 : { enter: 200, exit: 140 }}
        easing="cubic-bezier(0.23,1,0.32,1)"
      >
        <TextField
          size="small" select label="Steg" value={artifactView}
          onChange={(e) => onArtifactViewChange(e.target.value)}
          disabled={disabled}
          helperText={!artifactView ? 'Lander studenten i studio-hubben' : undefined}
          sx={{
            minWidth: 150, whiteSpace: 'nowrap',
            opacity: showSteg ? 1 : 0,
            transition: reduceMotion ? 'none' : 'opacity 180ms ease-out',
            '& .MuiInputBase-root': { minHeight: { xs: 44 } },
            ...ringSx,
          }}
        >
          {STEG_OPTIONS.map((o) => <MenuItem key={o.key || 'all'} value={o.key}>{o.label}</MenuItem>)}
        </TextField>
      </Collapse>
    </Box>
  );
}

export default ArtifactStegFields;
