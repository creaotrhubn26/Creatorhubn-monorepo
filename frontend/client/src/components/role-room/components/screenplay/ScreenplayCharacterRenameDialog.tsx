import React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type { ScreenplayCharacterRenamePreview } from './screenplaySmartType';

interface ScreenplayCharacterRenameDialogProps {
  open: boolean;
  characterNames: string[];
  targetSuggestions: string[];
  oldName: string;
  newName: string;
  preview: ScreenplayCharacterRenamePreview;
  onOldNameChange: (value: string) => void;
  onNewNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const ScreenplayCharacterRenameDialog: React.FC<ScreenplayCharacterRenameDialogProps> = ({
  open,
  characterNames,
  targetSuggestions,
  oldName,
  newName,
  preview,
  onOldNameChange,
  onNewNameChange,
  onClose,
  onConfirm,
}) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="character-rename-title">
    <DialogTitle id="character-rename-title">Endre karakternavn i manuset</DialogTitle>
    <DialogContent>
      <Alert severity="info" sx={{ mb: 2 }}>
        Bare bekreftede Character-linjer endres. Dialog, actionslinjer og prosjektrollen endres ikke automatisk.
      </Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          fullWidth
          label="Fra"
          value={oldName}
          onChange={(event) => onOldNameChange(event.target.value)}
          inputProps={{ 'data-testid': 'character-rename-from' }}
        >
          {characterNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
        <Autocomplete
          freeSolo
          fullWidth
          options={targetSuggestions.filter((name) => name !== oldName)}
          value={newName}
          onInputChange={(_, value) => onNewNameChange(value)}
          onChange={(_, value) => onNewNameChange(value ?? '')}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Til"
              inputProps={{ ...params.inputProps, 'data-testid': 'character-rename-to' }}
            />
          )}
        />
      </Stack>

      {preview.occurrences.length > 0 ? (
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            Forhåndsvisning · {preview.occurrences.length} forekomst{preview.occurrences.length === 1 ? '' : 'er'}
          </Typography>
          {preview.occurrences.slice(0, 8).map((occurrence) => (
            <Paper key={occurrence.lineIndex} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 58 }}>
                  Linje {occurrence.lineNumber}
                </Typography>
                <Box component="code" sx={{ color: '#fca5a5' }}>{occurrence.before}</Box>
                <Typography aria-hidden="true">→</Typography>
                <Box component="code" sx={{ color: '#86efac' }}>{occurrence.after}</Box>
              </Stack>
            </Paper>
          ))}
          {preview.occurrences.length > 8 && (
            <Typography variant="caption" color="text.secondary">
              + {preview.occurrences.length - 8} flere forekomster
            </Typography>
          )}
        </Stack>
      ) : (
        <Alert severity="warning">
          Velg to forskjellige, gyldige navn for å se nøyaktig hva som blir endret.
        </Alert>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Avbryt</Button>
      <Button
        data-testid="character-rename-confirm"
        variant="contained"
        onClick={onConfirm}
        disabled={preview.occurrences.length === 0}
      >
        Endre alle {preview.occurrences.length || ''} forekomster
      </Button>
    </DialogActions>
  </Dialog>
);

export default ScreenplayCharacterRenameDialog;
