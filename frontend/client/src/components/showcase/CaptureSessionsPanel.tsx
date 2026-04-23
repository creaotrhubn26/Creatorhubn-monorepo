import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Send as SendIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { friendlyDeliveryErrorMessage } from './captureSessionDeliveryErrors';

/**
 * Lists the photographer's Capture sessions + exposes a "Deliver to
 * client" action per session. Closes the loop with the iPad:
 * sessions created on the iPad show up here; the desktop is where
 * the photographer usually prefers to compose the client message
 * and watch the delivery land.
 *
 * Scope:
 *   * ``GET /api/capture/sessions`` — paged list.
 *   * ``POST /api/capture/sessions/:id/deliver-to-showcase`` —
 *     mints a client gallery; same endpoint the iPad
 *     ``QuickTeaserService`` uses, so desktop + iPad deliveries
 *     converge on the same server path.
 *
 * Out of scope (on purpose): editing sessions, merging sessions,
 * culling. Those happen on the iPad during the shoot; this panel
 * is read-mostly + one write (deliver).
 */

interface CaptureSessionRow {
  id: string;
  name: string;
  clientId: string | null;
  startsAt: string;
  endsAt: string | null;
  status: 'active' | 'paused' | 'closed' | string;
  createdAt: string;
}

interface DeliveryResult {
  galleryId: string;
  accessToken: string;
  shareUrl: string;
  uploadedImageCount: number;
  reusedExisting: boolean;
}

type DeliverFilter = 'flagged' | 'ratingAtLeast4' | 'picksOr4Plus' | 'allNonRejected';

const FILTER_LABELS: Record<DeliverFilter, string> = {
  flagged: 'Bare hero-markerte bilder',
  ratingAtLeast4: 'Bare 4★ og 5★',
  picksOr4Plus: 'Hero eller 4★+',
  allNonRejected: 'Alle ikke-forkastede',
};

export default function CaptureSessionsPanel() {
  const queryClient = useQueryClient();

  const query = useQuery<{ sessions: CaptureSessionRow[] }>({
    queryKey: ['/api/capture/sessions'],
    queryFn: async () => apiRequest('/api/capture/sessions?limit=50&offset=0'),
  });

  const [deliverFor, setDeliverFor] = useState<CaptureSessionRow | null>(null);

  const sessions = useMemo(
    () => (query.data?.sessions ?? []).slice().sort((a, b) => {
      // Active sessions bubble up so the photographer sees the
      // currently-shooting one without scrolling.
      if (a.status !== b.status) {
        if (a.status === 'active') return -1;
        if (b.status === 'active') return 1;
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }),
    [query.data],
  );

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Capture-økter</Typography>
          <Typography variant="body2" color="text.secondary">
            Shoots startet fra iPaden. Velg en og send en kvikk-teaser eller full levering til klienten.
          </Typography>
        </Box>
        <Tooltip title="Oppdater">
          <IconButton
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/capture/sessions'] })}
            disabled={query.isFetching}
            aria-label="Oppdater capture-økter"
          >
            {query.isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      {query.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : query.error ? (
        <Alert severity="error">Kunne ikke hente capture-øktene. Prøv igjen om et øyeblikk.</Alert>
      ) : sessions.length === 0 ? (
        <Alert severity="info">
          Ingen capture-økter ennå. Start en på iPaden — den dukker opp her i løpet av sekunder.
        </Alert>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={0}>
          {sessions.map((session) => (
            <Box
              key={session.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                py: 1.5,
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {session.name || 'Uten navn'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Startet {new Date(session.startsAt).toLocaleString('nb-NO')}
                  {session.endsAt ? ` · Ferdig ${new Date(session.endsAt).toLocaleString('nb-NO')}` : ''}
                </Typography>
              </Box>
              <Chip
                label={session.status}
                size="small"
                color={session.status === 'active' ? 'success' : 'default'}
                variant={session.status === 'active' ? 'filled' : 'outlined'}
              />
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => setDeliverFor(session)}
                disabled={session.status === 'paused'}
              >
                Lever
              </Button>
            </Box>
          ))}
        </Stack>
      )}

      {deliverFor && (
        <DeliverDialog
          session={deliverFor}
          onClose={() => setDeliverFor(null)}
          onDelivered={() => {
            // The delivered gallery isn't part of /api/capture/sessions,
            // but other lists (client galleries, showcases) may be
            // affected — invalidate broadly rather than guess.
            queryClient.invalidateQueries();
          }}
        />
      )}
    </Paper>
  );
}

function DeliverDialog({
  session,
  onClose,
  onDelivered,
}: {
  session: CaptureSessionRow;
  onClose: () => void;
  onDelivered: () => void;
}) {
  const [filter, setFilter] = useState<DeliverFilter>('picksOr4Plus');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState(session.name || '');
  const [result, setResult] = useState<DeliveryResult | null>(null);

  const mutation = useMutation<DeliveryResult, Error, void>({
    mutationFn: async () => {
      return apiRequest(
        `/api/capture/sessions/${session.id}/deliver-to-showcase`,
        {
          method: 'POST',
          body: JSON.stringify({
            filter,
            clientName: clientName.trim(),
            clientEmail: clientEmail.trim(),
            projectTitle: projectTitle.trim() || null,
          }),
        },
      );
    },
    onSuccess: (data) => {
      setResult(data);
      onDelivered();
    },
  });

  const canSubmit =
    clientName.trim().length > 0 &&
    /.+@.+\..+/.test(clientEmail.trim()) &&
    !mutation.isPending;

  const errorMessage = friendlyDeliveryErrorMessage(mutation.error);

  return (
    <Dialog open onClose={result ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>Lever "{session.name || 'Uten navn'}"</DialogTitle>
      <DialogContent>
        {result ? (
          <DeliverySuccess result={result} />
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Serveren plukker bilder fra økten basert på filteret nedenfor og lager et klient-galleri. Klienten får en egen lenke.
            </Typography>
            <TextField
              select
              label="Filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as DeliverFilter)}
              helperText="``Hero eller 4★+`` passer de fleste leveranser."
            >
              {(Object.keys(FILTER_LABELS) as DeliverFilter[]).map((key) => (
                <MenuItem key={key} value={key}>{FILTER_LABELS[key]}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Klientnavn"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
            <TextField
              label="Klient e-post"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
              error={clientEmail.length > 0 && !/.+@.+\..+/.test(clientEmail)}
              helperText={
                clientEmail.length > 0 && !/.+@.+\..+/.test(clientEmail)
                  ? 'Ugyldig e-postadresse'
                  : undefined
              }
            />
            <TextField
              label="Prosjekttittel"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              helperText="Vises øverst i klientens galleri."
            />
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={onClose}>Ferdig</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={mutation.isPending}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              startIcon={mutation.isPending ? <CircularProgress size={16} /> : <SendIcon />}
            >
              {mutation.isPending ? 'Leverer…' : 'Lever'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function DeliverySuccess({ result }: { result: DeliveryResult }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.shareUrl); } catch { /* noop */ }
  };
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Alert severity="success">
        {result.reusedExisting
          ? `Galleriet finnes fra før — lenken er oppdatert med ${result.uploadedImageCount} bilder.`
          : `Galleri opprettet med ${result.uploadedImageCount} bilder.`}
      </Alert>
      <TextField
        label="Klient-lenke"
        value={result.shareUrl}
        InputProps={{ readOnly: true }}
      />
      <Stack direction="row" spacing={1}>
        <Button
          startIcon={<CopyIcon />}
          onClick={copy}
          variant="outlined"
        >
          Kopier lenke
        </Button>
        <Button
          startIcon={<OpenInNewIcon />}
          component="a"
          href={result.shareUrl}
          target="_blank"
          rel="noreferrer"
          variant="outlined"
        >
          Åpne galleriet
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Klienten får en egen e-post med lenken automatisk fra CreatorHub.
      </Typography>
    </Stack>
  );
}

