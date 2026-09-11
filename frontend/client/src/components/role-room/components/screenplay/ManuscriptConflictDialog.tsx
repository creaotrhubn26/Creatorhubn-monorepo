import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { Manuscript } from '../../models/casting';

interface ManuscriptConflictDialogProps {
  open: boolean;
  localManuscript: Manuscript;
  cloudManuscript: Manuscript | null;
  currentVersion: number | null;
  resolving?: boolean;
  onContinueLocally: () => void;
  onKeepLocal: () => void;
  onUseCloud: () => void;
  onRefreshCloud: () => void;
}

const lineCount = (content: string | undefined): number => (content || '').split('\n').length;

const ManuscriptPane: React.FC<{
  title: string;
  detail: string;
  content: string | undefined;
  accent: string;
}> = ({ title, detail, content, accent }) => (
  <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden', borderColor: accent }}>
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      spacing={1}
      sx={{ px: 1.5, py: 1, bgcolor: `${accent}18` }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Chip size="small" label={detail} />
    </Stack>
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        maxHeight: '46vh',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        fontFamily: 'Courier New, monospace',
        fontSize: '0.82rem',
        lineHeight: 1.55,
        bgcolor: 'rgba(2, 6, 23, 0.6)',
      }}
    >
      {content || 'Tomt manus'}
    </Box>
  </Paper>
);

export const ManuscriptConflictDialog: React.FC<ManuscriptConflictDialogProps> = ({
  open,
  localManuscript,
  cloudManuscript,
  currentVersion,
  resolving = false,
  onContinueLocally,
  onKeepLocal,
  onUseCloud,
  onRefreshCloud,
}) => (
  <Dialog
    open={open}
    onClose={resolving ? undefined : onContinueLocally}
    fullWidth
    maxWidth="lg"
    aria-labelledby="manuscript-conflict-title"
  >
    <DialogTitle id="manuscript-conflict-title">Lagringskonflikt i manuset</DialogTitle>
    <DialogContent>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Skyversjonen ble endret etter at du åpnet manuset. Ingenting er overskrevet.
        Sammenlign versjonene og velg eksplisitt hva som skal beholdes.
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
        <ManuscriptPane
          title="Din lokale versjon"
          detail={`${lineCount(localManuscript.content)} linjer`}
          content={localManuscript.content}
          accent="#f59e0b"
        />
        {cloudManuscript ? (
          <ManuscriptPane
            title="Nyeste skyversjon"
            detail={`v${currentVersion ?? cloudManuscript.version ?? '?'} · ${lineCount(cloudManuscript.content)} linjer`}
            content={cloudManuscript.content}
            accent="#3b82f6"
          />
        ) : (
          <Paper
            variant="outlined"
            sx={{ p: 3, display: 'grid', placeItems: 'center', textAlign: 'center', minHeight: 220 }}
          >
            <Stack spacing={1.5} alignItems="center">
              <Typography variant="subtitle2">Kunne ikke hente skyinnholdet</Typography>
              <Typography variant="body2" color="text.secondary">
                Konflikten er registrert{currentVersion !== null ? ` mot versjon ${currentVersion}` : ''},
                men innholdet må lastes før du kan velge.
              </Typography>
              <Button variant="outlined" onClick={onRefreshCloud} disabled={resolving}>
                Prøv å hente på nytt
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>
    </DialogContent>
    <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
      <Button onClick={onContinueLocally} disabled={resolving}>Fortsett lokalt</Button>
      <Button onClick={onUseCloud} disabled={resolving || !cloudManuscript} color="info">
        Bruk skyversjonen
      </Button>
      <Button
        onClick={onKeepLocal}
        disabled={resolving || !cloudManuscript || currentVersion === null}
        variant="contained"
        color="warning"
      >
        {resolving ? 'Løser konflikten…' : 'Behold min versjon'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ManuscriptConflictDialog;
