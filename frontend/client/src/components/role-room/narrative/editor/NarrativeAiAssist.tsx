/**
 * NarrativeAiAssist — «Foreslå med KI» i element-skuffen: velg modus
 * (neste element / forbedre tekst / forgrening), gi instruks, generer via
 * narrative-element-agent, og godta/avvis i AISuggestionsPanel (forslag,
 * aldri handlinger — apply skjer server-side ved «Godta»).
 *
 * Panelet mountes først når seksjonen åpnes, så skuffen gjør ingen
 * KI-kall i vanlig redigering.
 */

import React, { useState } from 'react';
import { Box, Button, Collapse, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { AutoAwesome as AiIcon, ExpandLess as CollapseIcon } from '@mui/icons-material';
import AISuggestionsPanel from '../../components/AISuggestionsPanel';
import { generateSuggestions } from '../../services/aiSuggestionsClient';
import type { NarrativeElement } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

export type NarrativeAiMode = 'next' | 'enhance' | 'branches';

const MODE_LABELS: Record<NarrativeAiMode, string> = {
  next: 'Neste element + valg',
  enhance: 'Forbedre teksten',
  branches: 'Foreslå forgrening',
};

export interface NarrativeAiAssistProps {
  projectId: string;
  element: NarrativeElement;
  /** Kalles etter at et forslag er godtatt og materialisert (grafen lastes på nytt). */
  onApplied: () => void;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: narrativeColors.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: narrativeColors.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: narrativeColors.borderStrong },
  '& .MuiSvgIcon-root': { color: narrativeColors.textDim },
};

export function NarrativeAiAssist({ projectId, element, onApplied }: NarrativeAiAssistProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NarrativeAiMode>('next');
  const [instructions, setInstructions] = useState('');

  return (
    <Box data-testid="narrative-ai-assist">
      <Button
        size="small"
        startIcon={open ? <CollapseIcon /> : <AiIcon />}
        onClick={() => setOpen((v) => !v)}
        sx={{ color: narrativeColors.accent, textTransform: 'none' }}
        data-testid="narrative-ai-toggle"
      >
        {open ? 'Skjul KI-forslag' : 'Foreslå med KI'}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <FormControl size="small" sx={fieldSx}>
            <InputLabel id="narrative-ai-mode-label">Hva skal KI foreslå?</InputLabel>
            <Select labelId="narrative-ai-mode-label" label="Hva skal KI foreslå?" value={mode} onChange={(e) => setMode(e.target.value as NarrativeAiMode)} data-testid="narrative-ai-mode">
              {(Object.keys(MODE_LABELS) as NarrativeAiMode[]).map((m) => <MenuItem key={m} value={m}>{MODE_LABELS[m]}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Instruks (valgfritt)"
            placeholder="F.eks. «mørkere tone», «la Kjøpmannen lyve»"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            sx={fieldSx}
            inputProps={{ maxLength: 600, 'data-testid': 'narrative-ai-instructions' }}
          />
          <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
            Forslag bruker elementets tekst, festede komponenter (stemme), variabler og utganger. Ingenting endres før du godtar.
          </Typography>
          <AISuggestionsPanel
            projectId={projectId}
            title="KI-forslag for elementet"
            filter={{ sourceType: 'narrative_element', sourceId: element.id, suggestionType: 'narrative.element' }}
            hideUncertainToggle
            onGenerate={async () => {
              await generateSuggestions(projectId, {
                agentName: 'narrative-element-agent',
                sourceType: 'narrative_element',
                sourceId: element.id,
                payload: { mode, instructions: instructions.trim() || undefined },
              });
            }}
            onAccepted={() => onApplied()}
          />
        </Stack>
      </Collapse>
    </Box>
  );
}
