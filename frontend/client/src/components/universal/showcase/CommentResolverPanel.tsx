// @ts-nocheck
/**
 * CommentResolverPanel
 *
 * Lar Fredrik gå gjennom klient-kommentarer per galleri og:
 *  - Markere som addressert (status: open → resolved → archived)
 *  - Legge til photographer_response (vises i klient-galleri)
 *
 * Backend:
 *   GET   /api/photographer/galleries
 *   GET   /api/photographer/galleries/:id/activity   (henter comments)
 *   PATCH /api/photographer/galleries/:id/comments/:commentId
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Alert,
  Snackbar,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircleOutline as ResolveIcon,
  ReplyOutlined as ReplyIcon,
  ArchiveOutlined as ArchiveIcon,
  ImageOutlined as ImageIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

interface PhotographerGallery {
  id: string;
  projectTitle: string;
  clientName: string;
  clientEmail: string;
  status: string;
}

interface CommentRow {
  id: string;
  imageId: string;
  imageTitle: string | null;
  imageThumbnail: string | null;
  clientName: string;
  clientEmail: string;
  comment: string;
  commentType: string | null;
  status: 'open' | 'resolved' | 'archived' | string;
  photographerResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface ActivityResponse {
  comments: CommentRow[];
  selections: any[];
}

interface CommentResolverPanelProps {
  open: boolean;
  onClose: () => void;
}

function statusColor(status: string): 'warning' | 'success' | 'default' {
  if (status === 'open') return 'warning';
  if (status === 'resolved') return 'success';
  return 'default';
}

function statusLabel(status: string): string {
  if (status === 'open') return 'Åpen';
  if (status === 'resolved') return 'Adressert';
  if (status === 'archived') return 'Arkivert';
  return status;
}

function formatTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: nb });
  } catch {
    return '—';
  }
}

export default function CommentResolverPanel({ open, onClose }: CommentResolverPanelProps) {
  const queryClient = useQueryClient();
  const [selectedGalleryId, setSelectedGalleryId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'archived'>('open');
  const [toast, setToast] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const galleriesQuery = useQuery<{ galleries: PhotographerGallery[] }>({
    queryKey: ['/api/photographer/galleries'],
    queryFn: () => apiRequest('/api/photographer/galleries'),
    enabled: open,
    refetchOnWindowFocus: false,
  });
  const galleries = galleriesQuery.data?.galleries ?? [];

  const activityQuery = useQuery<ActivityResponse>({
    queryKey: ['/api/photographer/galleries', selectedGalleryId, 'activity'],
    queryFn: () => apiRequest(`/api/photographer/galleries/${selectedGalleryId}/activity`),
    enabled: open && !!selectedGalleryId,
    refetchOnWindowFocus: false,
  });

  const patchMutation = useMutation({
    mutationFn: async ({
      commentId,
      status,
      photographerResponse,
    }: {
      commentId: string;
      status?: string;
      photographerResponse?: string;
    }) => {
      const body: Record<string, unknown> = {};
      if (status) body.status = status;
      if (photographerResponse !== undefined) body.photographerResponse = photographerResponse;
      return apiRequest(
        `/api/photographer/galleries/${selectedGalleryId}/comments/${commentId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      ) as Promise<any>;
    },
    onSuccess: (_result, vars) => {
      setToast('Kommentar oppdatert.');
      queryClient.invalidateQueries({
        queryKey: ['/api/photographer/galleries', selectedGalleryId, 'activity'],
      });
      setReplyDraft((prev) => {
        const next = { ...prev };
        delete next[vars.commentId];
        return next;
      });
    },
    onError: (err: any) => {
      setToast(`Kunne ikke oppdatere kommentar: ${err?.message ?? 'ukjent feil'}`);
    },
  });

  const filteredComments = useMemo(() => {
    const all = activityQuery.data?.comments ?? [];
    if (statusFilter === 'all') return all;
    return all.filter((c) => c.status === statusFilter);
  }, [activityQuery.data, statusFilter]);

  const openCount = useMemo(() => {
    return (activityQuery.data?.comments ?? []).filter((c) => c.status === 'open').length;
  }, [activityQuery.data]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">Klient-kommentarer</Typography>
            <Typography variant="caption" color="text.secondary">
              Marker som adressert eller svar klienten direkte
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Galleri</InputLabel>
              <Select
                value={selectedGalleryId}
                label="Galleri"
                onChange={(e) => setSelectedGalleryId(e.target.value)}
              >
                <MenuItem value="">— Velg galleri —</MenuItem>
                {galleries.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.projectTitle} ({g.clientName})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="open">Åpne ({openCount})</MenuItem>
                <MenuItem value="resolved">Adresserte</MenuItem>
                <MenuItem value="archived">Arkiverte</MenuItem>
                <MenuItem value="all">Alle</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {galleriesQuery.isLoading && <LinearProgress sx={{ mb: 2 }} />}
          {(galleriesQuery.error || activityQuery.error) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Kunne ikke laste data: {((galleriesQuery.error || activityQuery.error) as Error)?.message ?? 'ukjent feil'}
            </Alert>
          )}

          {!selectedGalleryId && !galleriesQuery.isLoading && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Velg et galleri for å se kommentarene.
              </Typography>
            </Box>
          )}

          {selectedGalleryId && activityQuery.isLoading && <LinearProgress sx={{ mb: 2 }} />}

          {selectedGalleryId && !activityQuery.isLoading && filteredComments.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Ingen kommentarer i denne kategorien.
              </Typography>
            </Box>
          )}

          <Stack spacing={1.5}>
            {filteredComments.map((c) => {
              const draft = replyDraft[c.id] ?? c.photographerResponse ?? '';
              return (
                <Box
                  key={c.id}
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', mb: 1 }}>
                    <Avatar
                      src={c.imageThumbnail ?? undefined}
                      variant="rounded"
                      sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}
                    >
                      <ImageIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {c.clientName || c.clientEmail}
                        </Typography>
                        <Tooltip title={new Date(c.createdAt).toLocaleString('nb-NO')}>
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(c.createdAt)}
                          </Typography>
                        </Tooltip>
                        <Chip
                          size="small"
                          label={statusLabel(c.status)}
                          color={statusColor(c.status)}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {c.imageTitle && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            på {c.imageTitle}
                          </Typography>
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word', mb: 1 }}>
                        {c.comment}
                      </Typography>

                      {c.photographerResponse && c.status !== 'open' && (
                        <Box
                          sx={{
                            mt: 1,
                            mb: 1,
                            p: 1.5,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            borderLeft: '3px solid',
                            borderColor: 'primary.main',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                            Mitt svar
                            {c.respondedAt && ` · ${formatTime(c.respondedAt)}`}
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                            {c.photographerResponse}
                          </Typography>
                        </Box>
                      )}

                      <TextField
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        maxRows={6}
                        placeholder="Svar til klient (vises i klient-galleriet)…"
                        value={draft}
                        onChange={(e) =>
                          setReplyDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        sx={{ mb: 1 }}
                      />

                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ReplyIcon />}
                          onClick={() =>
                            patchMutation.mutate({
                              commentId: c.id,
                              photographerResponse: draft.trim(),
                            })
                          }
                          disabled={!draft.trim() || patchMutation.isPending}
                        >
                          Lagre svar
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={<ResolveIcon />}
                          onClick={() =>
                            patchMutation.mutate({
                              commentId: c.id,
                              status: 'resolved',
                              photographerResponse: draft.trim() || undefined,
                            })
                          }
                          disabled={patchMutation.isPending || c.status === 'resolved'}
                        >
                          Marker som adressert
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ArchiveIcon />}
                          onClick={() =>
                            patchMutation.mutate({ commentId: c.id, status: 'archived' })
                          }
                          disabled={patchMutation.isPending || c.status === 'archived'}
                        >
                          Arkiver
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
