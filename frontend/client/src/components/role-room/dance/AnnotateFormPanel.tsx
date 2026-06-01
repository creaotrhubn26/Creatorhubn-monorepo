/**
 * AnnotateFormPanel — Annotation Details edit-form i DanceAnnotate-mockup
 * (bottom-left). Strukturert form med 4 felter (Label · Start Time · End
 * Time · Dancer) + multi-line Notes.
 *
 * Brukes både for:
 *   - Redigere valgt annotation (active != null) → endringer committes
 *     via onPatch
 *   - Forberede neste annotation (active == null) → endringer holdes
 *     lokalt i draft og committes via onCreate(draft) når 'A' eller
 *     '+ Add'-knapp trykkes
 *
 * Speil til AnnotationDetailsPanel (Selected Annotation), men matched
 * mockupens bottom-strip-layout i stedet for stack.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

import type { VideoAnnotation } from './danceVideoService';
import { categoryById } from './danceMovementCategories';
import { formatTimecode, parseTimecode } from './timecode';
import { danceFlowColors } from './danceFlowTheme';

export interface AnnotateFormPanelProps {
  annotation: VideoAnnotation | null;
  dancerOptions: Array<{ id: string; label: string }>;
  fps?: number;
  /** Endre felter på den valgte annotation — debounced commit via parent. */
  onPatch: (patch: {
    body?: string;
    timestampSec?: number;
    endSec?: number | null;
    targetDancerIds?: string[];
  }) => void;
}

export default function AnnotateFormPanel({
  annotation,
  dancerOptions,
  fps = 30,
  onPatch,
}: AnnotateFormPanelProps): React.ReactElement {
  // Lokal draft mens brukeren skriver — committer ved blur (timecode)
  // eller change (select). Bevares ved annotation-ID-bytte.
  const [labelDraft, setLabelDraft] = React.useState<string>('');
  const [startDraft, setStartDraft] = React.useState<string>('');
  const [endDraft, setEndDraft] = React.useState<string>('');
  const [notesDraft, setNotesDraft] = React.useState<string>('');

  React.useEffect(() => {
    if (!annotation) {
      setLabelDraft(''); setStartDraft(''); setEndDraft(''); setNotesDraft('');
      return;
    }
    setLabelDraft(annotation.body);
    setStartDraft(formatTimecode(annotation.timestampSec, fps));
    setEndDraft(
      annotation.endSec != null
        ? formatTimecode(annotation.endSec, fps)
        : formatTimecode(annotation.timestampSec + 2, fps),
    );
    // Body brukes både som label + notes — splitt på første linje
    setNotesDraft(annotation.body);
  }, [annotation, fps]);

  const cat = annotation ? categoryById(annotation.category) : null;
  const disabled = annotation == null;

  const commitTime = (which: 'start' | 'end', value: string): void => {
    const parsed = parseTimecode(value);
    if (parsed == null) return;
    if (which === 'start') onPatch({ timestampSec: parsed });
    else onPatch({ endSec: parsed });
  };

  return (
    <Box
      data-testid="annotate-form-panel"
      sx={{
        p: 1.5,
        bgcolor: danceFlowColors.bgPanel,
        border: `1px solid ${danceFlowColors.borderStrong}`,
        borderRadius: 1,
      }}
    >
      <Typography
        variant="overline"
        sx={{
          display: 'block', mb: 1,
          color: danceFlowColors.textMuted,
          fontWeight: 700, letterSpacing: 1.2, fontSize: 11,
        }}
      >
        Annotation Details
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          size="small"
          label="Label"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => annotation && onPatch({ body: labelDraft })}
          disabled={disabled}
          data-testid="annotate-form-label"
          InputProps={{
            startAdornment: cat ? (
              <Box
                sx={{
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: cat.color, mr: 1, flexShrink: 0,
                }}
              />
            ) : undefined,
          }}
          sx={{
            flex: 1.5,
            '& .MuiInputBase-input': { fontSize: 12, color: '#e5e7eb' },
            '& .MuiInputLabel-root': { fontSize: 11 },
          }}
        />
        <TextField
          size="small"
          label="Start Time"
          value={startDraft}
          onChange={(e) => setStartDraft(e.target.value)}
          onBlur={() => commitTime('start', startDraft)}
          disabled={disabled}
          data-testid="annotate-form-start"
          placeholder="00:00:00:00"
          sx={{
            flex: 1,
            '& .MuiInputBase-input': {
              fontSize: 12, color: '#e5e7eb', fontVariantNumeric: 'tabular-nums',
            },
            '& .MuiInputLabel-root': { fontSize: 11 },
          }}
        />
        <TextField
          size="small"
          label="End Time"
          value={endDraft}
          onChange={(e) => setEndDraft(e.target.value)}
          onBlur={() => commitTime('end', endDraft)}
          disabled={disabled}
          data-testid="annotate-form-end"
          placeholder="00:00:00:00"
          sx={{
            flex: 1,
            '& .MuiInputBase-input': {
              fontSize: 12, color: '#e5e7eb', fontVariantNumeric: 'tabular-nums',
            },
            '& .MuiInputLabel-root': { fontSize: 11 },
          }}
        />
        <TextField
          select
          size="small"
          label="Dancer"
          value={annotation?.targetDancerIds[0] ?? ''}
          onChange={(e) => onPatch({
            targetDancerIds: e.target.value ? [e.target.value] : [],
          })}
          disabled={disabled}
          data-testid="annotate-form-dancer"
          sx={{
            flex: 1,
            '& .MuiInputBase-input': { fontSize: 12, color: '#e5e7eb' },
            '& .MuiInputLabel-root': { fontSize: 11 },
          }}
        >
          <MenuItem value="" sx={{ fontSize: 12 }}>— ingen —</MenuItem>
          {dancerOptions.map((d) => (
            <MenuItem key={d.id} value={d.id} sx={{ fontSize: 12 }}>{d.label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <TextField
        size="small"
        fullWidth
        multiline
        minRows={1}
        maxRows={3}
        label="Notes"
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        onBlur={() => annotation && onPatch({ body: notesDraft })}
        disabled={disabled}
        data-testid="annotate-form-notes"
        placeholder="F.eks. «Travels to the right»"
        sx={{
          '& .MuiInputBase-input': { fontSize: 12, color: '#e5e7eb' },
          '& .MuiInputLabel-root': { fontSize: 11 },
        }}
      />
    </Box>
  );
}
