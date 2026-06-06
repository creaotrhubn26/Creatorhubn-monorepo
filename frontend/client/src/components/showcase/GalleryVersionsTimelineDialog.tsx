/**
 * GalleryVersionsTimelineDialog — admin-vy for versjons-historikk +
 * leveranse-progress-timeline. Brukes av fotograf/videograf for å:
 *
 *   1. Opprette + publisere nye versjoner ("R1", "R2", "Final")
 *      med valgfri notat om hva som er endret.
 *   2. Se klientens avgjørelse per versjon (approved /
 *      changes_requested + note).
 *   3. Redigere milestone-status (mark "Color grade" som completed,
 *      sette ETA på "R1", osv.). Endringene reflekteres umiddelbart
 *      i klient-galleriets timeline.
 *
 * To tabber: "Versjoner" og "Leveranseplan".
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Tabs,
  Tab,
  Button,
  Stack,
  Typography,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  Publish as PublishIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Decision {
  decision: 'approved' | 'changes_requested' | 'in_review' | 'rejected';
  decision_note: string | null;
  decided_by_email: string;
  decided_by_label: string | null;
  decided_at: string;
}

interface Version {
  id: string;
  label: string;
  order: number;
  isPublished: boolean;
  publishedAt: string | null;
  notes: string | null;
  imageCount: number;
  decision: Decision | null;
}

interface Milestone {
  id: string;
  stage: string;
  order: number;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  estimatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  isClientVisible: boolean;
}

interface Props {
  galleryId: string;
  galleryTitle: string;
  onClose: () => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const decisionChip = (d: Decision | null) => {
  if (!d) return <Chip label="Ingen review" size="small" />;
  switch (d.decision) {
    case 'approved':
      return (
        <Chip
          icon={<CheckIcon sx={{ fontSize: 14 }} />}
          label="Godkjent"
          size="small"
          sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 600 }}
        />
      );
    case 'changes_requested':
      return (
        <Chip
          icon={<EditIcon sx={{ fontSize: 14 }} />}
          label="Endringer ønsket"
          size="small"
          sx={{ bgcolor: '#fecaca', color: '#991b1b', fontWeight: 600 }}
        />
      );
    default:
      return <Chip label={d.decision} size="small" />;
  }
};

const VersionsTab: React.FC<{ galleryId: string }> = ({ galleryId }) => {
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState('R1');
  const [newNotes, setNewNotes] = useState('');

  const versionsKey = ['/api/photographer/galleries', galleryId, 'versions'];
  const { data, isLoading, error } = useQuery<{ versions: Version[] }>({
    queryKey: versionsKey,
    queryFn: () =>
      apiRequest(`/api/photographer/galleries/${galleryId}/versions`),
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/photographer/galleries/${galleryId}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          versionLabel: newLabel,
          notes: newNotes || null,
          // imageIds utelates → backend snapshot-er alle bilder i galleriet
        }),
      }),
    onSuccess: () => {
      setNewLabel('');
      setNewNotes('');
      queryClient.invalidateQueries({ queryKey: versionsKey });
    },
  });

  const publishMut = useMutation({
    mutationFn: (versionId: string) =>
      apiRequest(
        `/api/photographer/galleries/${galleryId}/versions/${versionId}/visibility`,
        { method: 'PUT', body: JSON.stringify({ publish: true }) },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: versionsKey }),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error">Kunne ikke laste versjoner: {String((error as Error)?.message)}</Alert>
    );
  }

  const versions = data?.versions ?? [];

  return (
    <Stack spacing={2}>
      <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Opprett ny versjon
        </Typography>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Versjons-navn"
              placeholder="R1, R2, Final, Sosial-versjon"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              sx={{ width: 200 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={!newLabel.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? 'Lager…' : 'Opprett'}
            </Button>
          </Stack>
          <TextField
            size="small"
            label="Notat til klient (hva er endret)"
            multiline
            minRows={2}
            placeholder="Lagt til drone-shots. Trimmet ned tale fra Per."
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
        </Stack>
      </Box>

      {versions.length === 0 ? (
        <Alert severity="info">
          Ingen versjoner opprettet ennå. Lag R1 når første utkast er klart.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {versions.map((v) => (
            <Box
              key={v.id}
              sx={{
                border: '1px solid rgba(15,23,42,0.08)',
                borderRadius: 1,
                p: 2,
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {v.label}
                    </Typography>
                    {v.isPublished ? (
                      <Chip label="Publisert" size="small" color="success" />
                    ) : (
                      <Chip label="Utkast" size="small" />
                    )}
                    {decisionChip(v.decision)}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {v.imageCount} fil(er)
                    {v.publishedAt
                      ? ` · publisert ${formatDate(v.publishedAt)}`
                      : ''}
                  </Typography>
                </Box>
                {!v.isPublished && (
                  <Button
                    size="small"
                    startIcon={<PublishIcon />}
                    onClick={() => publishMut.mutate(v.id)}
                    disabled={publishMut.isPending}
                  >
                    Publiser
                  </Button>
                )}
              </Stack>
              {v.notes && (
                <Typography
                  variant="body2"
                  sx={{ mt: 1, fontStyle: 'italic', color: '#475569' }}
                >
                  Notat: "{v.notes}"
                </Typography>
              )}
              {v.decision?.decision === 'changes_requested' && v.decision.decision_note && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    Klient {v.decision.decided_by_label || v.decision.decided_by_email}{' '}
                    ba om endringer {formatDate(v.decision.decided_at)}:
                  </Typography>
                  <Typography variant="body2">"{v.decision.decision_note}"</Typography>
                </Alert>
              )}
              {v.decision?.decision === 'approved' && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#166534' }}>
                  ✓ Godkjent av {v.decision.decided_by_label || v.decision.decided_by_email}{' '}
                  {formatDate(v.decision.decided_at)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

const TimelineTab: React.FC<{ galleryId: string }> = ({ galleryId }) => {
  const queryClient = useQueryClient();
  const timelineKey = ['/api/photographer/galleries', galleryId, 'timeline'];
  const { data, isLoading, error } = useQuery<{ milestones: Milestone[] }>({
    queryKey: timelineKey,
    queryFn: () =>
      apiRequest(`/api/photographer/galleries/${galleryId}/timeline`),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { milestoneId: string; patch: Partial<Milestone> }) =>
      apiRequest(
        `/api/photographer/galleries/${galleryId}/timeline/${vars.milestoneId}`,
        { method: 'PUT', body: JSON.stringify(vars.patch) },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });

  const seedMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/photographer/galleries/${galleryId}/timeline/seed`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error">
        Kunne ikke laste timeline: {String((error as Error)?.message)}
      </Alert>
    );
  }

  const milestones = data?.milestones ?? [];

  if (milestones.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ingen leveranse-milepæler satt opp. Klikk under for å opprette standard
          12-stegs prosess (Booking → Arkivert).
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => seedMut.mutate()}
          disabled={seedMut.isPending}
        >
          {seedMut.isPending ? 'Oppretter…' : 'Sett opp standard leveranseplan'}
        </Button>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        Klient ser kun milepæler som har "Synlig for klient" på. Endringer her
        oppdaterer klient-galleriet umiddelbart.
      </Typography>
      <Divider />
      {milestones.map((m) => (
        <Box
          key={m.id}
          sx={{
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 1,
            p: 1.5,
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {m.order}. {m.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {m.stage}
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={m.status}
                onChange={(e) =>
                  updateMut.mutate({
                    milestoneId: m.id,
                    patch: { status: e.target.value as Milestone['status'] },
                  })
                }
              >
                <MenuItem value="pending">Ikke startet</MenuItem>
                <MenuItem value="in_progress">Pågår</MenuItem>
                <MenuItem value="completed">Ferdig</MenuItem>
                <MenuItem value="blocked">Venter</MenuItem>
                <MenuItem value="skipped">Hoppes over</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Forventet"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={
                m.estimatedAt
                  ? new Date(m.estimatedAt).toISOString().slice(0, 10)
                  : ''
              }
              onChange={(e) =>
                updateMut.mutate({
                  milestoneId: m.id,
                  patch: {
                    estimatedAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  },
                })
              }
              sx={{ width: 160 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={m.isClientVisible}
                  onChange={(e) =>
                    updateMut.mutate({
                      milestoneId: m.id,
                      patch: { isClientVisible: e.target.checked },
                    })
                  }
                />
              }
              label="Synlig"
              sx={{ ml: 0 }}
            />
          </Stack>
          {m.status === 'blocked' && (
            <TextField
              size="small"
              fullWidth
              placeholder="Hvorfor venter denne? (vises til klient)"
              value={m.blockedReason || ''}
              onChange={(e) =>
                updateMut.mutate({
                  milestoneId: m.id,
                  patch: { blockedReason: e.target.value },
                })
              }
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      ))}
    </Stack>
  );
};

export const GalleryVersionsTimelineDialog: React.FC<Props> = ({
  galleryId,
  galleryTitle,
  onClose,
}) => {
  const [tab, setTab] = useState(0);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Versjoner & leveranseplan
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {galleryTitle}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as number)}
        sx={{ borderBottom: '1px solid rgba(15,23,42,0.08)', px: 3 }}
      >
        <Tab label="Versjoner" />
        <Tab label="Leveranseplan" />
      </Tabs>
      <DialogContent dividers sx={{ minHeight: 400 }}>
        {tab === 0 ? (
          <VersionsTab galleryId={galleryId} />
        ) : (
          <TimelineTab galleryId={galleryId} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GalleryVersionsTimelineDialog;
