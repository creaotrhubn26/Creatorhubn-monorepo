/**
 * StorageProvidersPanel — listing + admin av brukerens
 * storage-providers (Backblaze B2 i v1, flere senere).
 *
 * Vises i UniversalSettings + tilgjengelig som standalone for
 * alle profesjoner (foto, video, musikk, vendor). En provider
 * kan brukes på tvers av prosjekter, så onboarding-stiget setter
 * den opp én gang og denne panelen administrerer den videre.
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import {
  deleteStorageProvider,
  listStorageProviders,
  StorageProvider,
} from '@/api/storageProviders';
import StorageProviderStep from '@/components/onboarding/StorageProviderStep';

export default function StorageProvidersPanel() {
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listStorageProviders();
      if (r.success) {
        setProviders(r.providers);
      } else {
        setError(r.error ?? 'Kunne ikke hente providers');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDelete = async (p: StorageProvider) => {
    if (
      !window.confirm(
        `Fjerne "${p.account_label}" fra Creatorhub?\n\n` +
          'Eksisterende filer i Backblaze-bucketen slettes IKKE. ' +
          'Du må slette dem manuelt fra Backblaze-konsollen eller via ' +
          'right-to-erasure-flyten (Fase 3).',
      )
    ) {
      return;
    }
    try {
      const result = await deleteStorageProvider(p.id);
      if (!result.success) {
        setError(result.error ?? 'Sletting feilet');
        return;
      }
      setInfo(result.warning ?? 'Provider fjernet');
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Ekstern backup (offsite)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Backblaze B2-konti tilgjengelig for prosjekt-backup. Du eier
              kontoen og betaler Backblaze direkte (~$6/TB/mnd).
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Last inn på nytt">
              <IconButton onClick={refresh} size="small" disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
            >
              Legg til
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {info && (
          <Alert severity="info" onClose={() => setInfo(null)} sx={{ mb: 1 }}>
            {info}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={20} />
          </Box>
        ) : providers.length === 0 ? (
          <Stack
            spacing={1.5}
            sx={{
              alignItems: 'center',
              py: 4,
              color: 'text.secondary',
              textAlign: 'center',
            }}
          >
            <CloudOutlinedIcon sx={{ fontSize: 40, opacity: 0.5 }} />
            <Typography variant="body2">
              Ingen offsite-konti satt opp ennå. Klikk «Legg til» for å
              koble en Backblaze-konto til Creatorhub.
            </Typography>
          </Stack>
        ) : (
          <List dense disablePadding>
            {providers.map((p) => (
              <ListItem
                key={p.id}
                divider
                secondaryAction={
                  <Tooltip title="Fjern fra Creatorhub">
                    <IconButton onClick={() => handleDelete(p)} edge="end">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {p.account_label}
                      </Typography>
                      <Chip
                        size="small"
                        label={p.provider.toUpperCase()}
                        color="primary"
                        variant="outlined"
                      />
                      {p.validated_at && (
                        <Chip
                          size="small"
                          label="Validert"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      Opprettet {new Date(p.created_at).toLocaleDateString('nb-NO')}
                      {p.last_used_at && (
                        <>
                          {' · sist brukt '}
                          {new Date(p.last_used_at).toLocaleDateString('nb-NO')}
                        </>
                      )}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            Legg til offsite-konto
            <IconButton onClick={() => setAddOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <StorageProviderStep
              variant="settings"
              onCompleted={() => {
                setAddOpen(false);
                void refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
