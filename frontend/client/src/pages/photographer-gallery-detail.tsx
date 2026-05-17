// Slice 9X.10 — galleri-detaljside for fotograf.
// Image-grid + klient-aktivitetsfeed (kommentarer, favoritter) + share-tools.
// Stine bruker denne for å monitorere klient-aktivitet etter levering og
// markere ferdig når klient har godkjent.

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, Chip, CircularProgress, Alert,
  Tabs, Tab, IconButton, Snackbar, Divider, Avatar, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  ImageList, ImageListItem, ImageListItemBar, Badge, LinearProgress,
} from '@mui/material';
import {
  ArrowBack, Collections, Comment, Favorite, ContentCopy, Send,
  OpenInNew, CheckCircle, Person, Gavel, Download, Warning,
  LinkOff, Link as LinkIcon, VpnKey, Add, Delete,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface GalleryDetail {
  id: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  accessToken: string;
  shareUrl: string;
  settings: Record<string, unknown>;
  status: string;
  projectId: string | null;
  contractId: string | null;
  imageCount: number;
  commentCount: number;
  selectionCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface ContractSummary {
  id: string;
  title: string;
  clientName: string | null;
  clientEmail: string | null;
  status: string | null;
  signatureStatus: string | null;
  signedAt: string | null;
  createdAt: string;
}

interface DownloadAuditEntry {
  id: string;
  imageId: string;
  imageTitle: string | null;
  imageThumbnail: string | null;
  clientEmail: string;
  clientIp: string | null;
  downloadMethod: string;
  downloadedAt: string;
  userAgent: string | null;
}

interface DownloadSummaryPerClient {
  clientEmail: string;
  uniqueImages: number;
  totalDownloads: number;
  firstDownload: string;
  lastDownload: string;
  remainingSlots: number | null;
}

interface AccessCode {
  id: string;
  code: string;
  label: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  portalUrl: string;
}

interface AuditResponse {
  gallery: {
    id: string;
    clientEmail: string;
    contractedImages: number;
    pricePerImage: number;
  };
  contract: {
    contractId: string;
    status: string | null;
    signatureStatus: string | null;
    signedAt: string | null;
    title: string | null;
  } | null;
  perClient: DownloadSummaryPerClient[];
  audit: DownloadAuditEntry[];
}

interface GalleryImage {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  fullSizeUrl: string;
  tags: string[];
  sortOrder: number;
  createdAt: string;
}

interface ActivityComment {
  id: string;
  imageId: string;
  imageTitle: string | null;
  imageThumbnail: string | null;
  clientName: string;
  clientEmail: string;
  comment: string;
  commentType: string;
  status: string;
  photographerResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface ActivitySelection {
  id: string;
  imageId: string;
  imageTitle: string | null;
  imageThumbnail: string | null;
  clientEmail: string;
  selectionType: string;
  priority: number;
  clientNotes: string | null;
  createdAt: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMs = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diffMs < min) return 'akkurat nå';
  if (diffMs < hour) return `${Math.floor(diffMs / min)} min siden`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} timer siden`;
  return `${Math.floor(diffMs / day)} dager siden`;
}

export default function PhotographerGalleryDetail() {
  const params = useParams<{ galleryId: string }>();
  const galleryId = params.galleryId;
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [linkContractOpen, setLinkContractOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState({ label: '', expiresInDays: '', maxUses: '' });

  const { data: detailData, isLoading: detailLoading, error: detailError } = useQuery<{
    gallery: GalleryDetail;
    images: GalleryImage[];
  }>({
    queryKey: [`/api/photographer/galleries/${galleryId}`],
    queryFn: () => apiRequest(`/api/photographer/galleries/${galleryId}`),
    enabled: !!galleryId,
  });

  const { data: activityData } = useQuery<{
    comments: ActivityComment[];
    selections: ActivitySelection[];
  }>({
    queryKey: [`/api/photographer/galleries/${galleryId}/activity`],
    queryFn: () => apiRequest(`/api/photographer/galleries/${galleryId}/activity`),
    enabled: !!galleryId,
    refetchInterval: 30000,
  });

  const notifyClient = useMutation<unknown, Error, string>({
    mutationFn: (customMessage) => apiRequest(`/api/photographer/galleries/${galleryId}/notify-client`, {
      method: 'POST',
      body: JSON.stringify({ customMessage }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      setSnackbar({ msg: 'Galleri sendt på epost', severity: 'success' });
      setNotifyOpen(false);
      setNotifyMessage('');
    },
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.message || parsed.error || msg;
      } catch { /* not JSON */ }
      setSnackbar({ msg, severity: 'error' });
    },
  });

  const markComplete = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest(`/api/photographer/galleries/${galleryId}/mark-complete`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/galleries/${galleryId}`] });
      setSnackbar({ msg: 'Galleri markert som ferdig', severity: 'success' });
    },
  });

  const { data: auditData } = useQuery<AuditResponse>({
    queryKey: [`/api/photographer/galleries/${galleryId}/download-audit`],
    queryFn: () => apiRequest(`/api/photographer/galleries/${galleryId}/download-audit`),
    enabled: !!galleryId,
    refetchInterval: 60000,
  });

  const { data: contractsData } = useQuery<{ contracts: ContractSummary[] }>({
    queryKey: ['/api/photographer/contracts'],
    queryFn: () => apiRequest('/api/photographer/contracts'),
    enabled: linkContractOpen,
  });

  const { data: codesData } = useQuery<{ codes: AccessCode[] }>({
    queryKey: [`/api/photographer/galleries/${galleryId}/access-codes`],
    queryFn: () => apiRequest(`/api/photographer/galleries/${galleryId}/access-codes`),
    enabled: !!galleryId,
  });

  const createCode = useMutation<AccessCode, Error, typeof codeDraft>({
    mutationFn: (body) => apiRequest(`/api/photographer/galleries/${galleryId}/access-codes`, {
      method: 'POST',
      body: JSON.stringify({
        label: body.label.trim() || null,
        expiresInDays: body.expiresInDays ? Number(body.expiresInDays) : null,
        maxUses: body.maxUses ? Number(body.maxUses) : null,
      }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/galleries/${galleryId}/access-codes`] });
      setCreateCodeOpen(false);
      setCodeDraft({ label: '', expiresInDays: '', maxUses: '' });
      try { navigator.clipboard.writeText(created.code); } catch { /* */ }
      setSnackbar({
        msg: `Kode ${created.code} opprettet — kopiert til utklippstavlen`,
        severity: 'success',
      });
    },
  });

  const revokeCode = useMutation<unknown, Error, string>({
    mutationFn: (codeId) => apiRequest(`/api/photographer/galleries/${galleryId}/access-codes/${codeId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/galleries/${galleryId}/access-codes`] });
      setSnackbar({ msg: 'Kode revokert', severity: 'info' });
    },
  });

  const copyPortalUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setSnackbar({ msg: 'Portal-URL kopiert', severity: 'info' });
    } catch {
      setSnackbar({ msg: url, severity: 'info' });
    }
  };

  const linkContract = useMutation<unknown, Error, string | null>({
    mutationFn: (contractId) => apiRequest(`/api/photographer/galleries/${galleryId}/link-contract`, {
      method: 'POST',
      body: JSON.stringify({ contractId }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: (_, contractId) => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/galleries/${galleryId}`] });
      qc.invalidateQueries({ queryKey: [`/api/photographer/galleries/${galleryId}/download-audit`] });
      setLinkContractOpen(false);
      setSnackbar({
        msg: contractId ? 'Kontrakt linket — nedlasting krever nå signert kontrakt' : 'Kontrakt-link fjernet',
        severity: 'success',
      });
    },
  });

  const copyShareUrl = async () => {
    if (!detailData?.gallery.shareUrl) return;
    try {
      await navigator.clipboard.writeText(detailData.gallery.shareUrl);
      setSnackbar({ msg: 'Share-link kopiert', severity: 'info' });
    } catch {
      setSnackbar({ msg: detailData.gallery.shareUrl, severity: 'info' });
    }
  };

  // Aggreger favoritter per bilde for sortering
  const favoritesByImage = useMemo(() => {
    const map = new Map<string, number>();
    for (const sel of activityData?.selections ?? []) {
      if (sel.selectionType === 'favorite') {
        map.set(sel.imageId, (map.get(sel.imageId) ?? 0) + 1);
      }
    }
    return map;
  }, [activityData]);

  if (detailLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (detailError || !detailData) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => window.history.back()}>Tilbake</Button>
        <Alert severity="error" sx={{ mt: 2 }}>Kunne ikke laste galleri.</Alert>
      </Box>
    );
  }

  const g = detailData.gallery;
  const isCompleted = g.status === 'completed';

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => {
          if (g.projectId) navigate(`/photographer/projects/${g.projectId}`);
          else navigate('/photographer/projects');
        }}>
          <ArrowBack />
        </IconButton>
        <Collections color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5">{g.projectTitle}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              color={isCompleted ? 'success' : 'primary'}
              icon={isCompleted ? <CheckCircle /> : undefined}
              label={isCompleted ? 'Ferdig levert' : 'Aktiv'}
            />
            <Typography variant="caption" color="text.secondary">
              Klient: {g.clientName} ({g.clientEmail})
            </Typography>
          </Stack>
        </Box>
      </Stack>

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary">Delbar URL</Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                bgcolor: 'action.hover',
                px: 1.5, py: 1, borderRadius: 1,
                overflow: 'auto', whiteSpace: 'nowrap',
              }}
            >
              {g.shareUrl}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ContentCopy />} variant="outlined" onClick={copyShareUrl}>
              Kopier
            </Button>
            <Button
              startIcon={<OpenInNew />}
              variant="outlined"
              onClick={() => window.open(`/client-gallery/${g.accessToken}`, '_blank')}
            >
              Klient-visning
            </Button>
            <Button
              startIcon={<Send />}
              variant="contained"
              onClick={() => setNotifyOpen(true)}
            >
              Send på epost
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography variant="caption" color="text.secondary">Bilder</Typography>
          <Typography variant="h5">{g.imageCount}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography variant="caption" color="text.secondary">Favoritter</Typography>
          <Typography variant="h5" color={g.favoriteCount > 0 ? 'error.main' : 'text.primary'}>
            ♥ {g.favoriteCount}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography variant="caption" color="text.secondary">Kommentarer</Typography>
          <Typography variant="h5">{g.commentCount}</Typography>
        </Paper>
        <Paper sx={{ p: 2, minWidth: 140 }}>
          <Typography variant="caption" color="text.secondary">Status</Typography>
          <Typography variant="body1" fontWeight={500}>
            {isCompleted ? `Ferdig ${formatRelative(g.completedAt)}` : 'Venter på godkjenning'}
          </Typography>
        </Paper>
        {!isCompleted && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => markComplete.mutate()}
              disabled={markComplete.isPending}
            >
              Marker som ferdig
            </Button>
          </Box>
        )}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab label={`Bilder (${detailData.images.length})`} />
        <Tab label={
          <Badge badgeContent={activityData?.comments.length ?? 0} color="primary">
            <Box sx={{ pr: 1 }}>Kommentarer</Box>
          </Badge>
        } />
        <Tab label={
          <Badge badgeContent={activityData?.selections.length ?? 0} color="primary">
            <Box sx={{ pr: 1 }}>Klient-valg</Box>
          </Badge>
        } />
        <Tab
          icon={<Gavel sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={
            <Badge badgeContent={auditData?.audit.length ?? 0} color="warning">
              <Box sx={{ pr: 1 }}>Kontrakt & nedlastinger</Box>
            </Badge>
          }
        />
      </Tabs>

      {/* TAB: Bilder */}
      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          {detailData.images.length === 0 ? (
            <Alert severity="info">
              Ingen bilder lastet opp ennå. Last opp via iPad-appen — bilder med "deliver to showcase"-tag dukker opp her.
            </Alert>
          ) : (
            <ImageList cols={4} gap={8} sx={{ overflow: 'visible' }}>
              {detailData.images.map((img) => {
                const favCount = favoritesByImage.get(img.id) ?? 0;
                return (
                  <ImageListItem key={img.id} sx={{ borderRadius: 1, overflow: 'hidden' }}>
                    <img
                      src={img.thumbnailUrl}
                      alt={img.title}
                      loading="lazy"
                      style={{ aspectRatio: '4/3', objectFit: 'cover' }}
                    />
                    {favCount > 0 && (
                      <Box sx={{
                        position: 'absolute', top: 8, right: 8,
                        bgcolor: 'rgba(0,0,0,0.6)', color: 'error.light',
                        px: 1, py: 0.25, borderRadius: 1, fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 0.5,
                      }}>
                        ♥ {favCount}
                      </Box>
                    )}
                    <ImageListItemBar
                      title={img.title}
                      subtitle={img.tags.length > 0 ? img.tags.slice(0, 3).join(' · ') : null}
                      sx={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
                    />
                  </ImageListItem>
                );
              })}
            </ImageList>
          )}
        </Paper>
      )}

      {/* TAB: Kommentarer */}
      {tab === 1 && (
        <Stack spacing={1.5}>
          {(activityData?.comments ?? []).length === 0 ? (
            <Alert severity="info">Ingen kommentarer fra klient ennå.</Alert>
          ) : (
            (activityData?.comments ?? []).map((c) => (
              <Paper key={c.id} sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  {c.imageThumbnail && (
                    <Box
                      component="img"
                      src={c.imageThumbnail}
                      alt={c.imageTitle ?? ''}
                      sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                    />
                  )}
                  <Box sx={{ flexGrow: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                        <Person sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Typography variant="body2" fontWeight={500}>{c.clientName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatRelative(c.createdAt)}
                      </Typography>
                      {c.commentType !== 'general' && (
                        <Chip size="small" label={c.commentType} variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ mb: 1 }}>{c.comment}</Typography>
                    {c.imageTitle && (
                      <Typography variant="caption" color="text.secondary">
                        På bilde: {c.imageTitle}
                      </Typography>
                    )}
                    {c.photographerResponse && (
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: 'action.hover' }}>
                        <Typography variant="caption" color="primary">
                          Ditt svar {c.respondedAt ? `· ${formatRelative(c.respondedAt)}` : ''}:
                        </Typography>
                        <Typography variant="body2">{c.photographerResponse}</Typography>
                      </Paper>
                    )}
                  </Box>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      )}

      {/* TAB: Klient-valg */}
      {tab === 2 && (
        <Stack spacing={1.5}>
          {(activityData?.selections ?? []).length === 0 ? (
            <Alert severity="info">Klienten har ikke markert noen bilder ennå.</Alert>
          ) : (
            (activityData?.selections ?? []).map((s) => (
              <Paper key={s.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                {s.imageThumbnail && (
                  <Box
                    component="img"
                    src={s.imageThumbnail}
                    alt={s.imageTitle ?? ''}
                    sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                  />
                )}
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {s.selectionType === 'favorite'
                      ? <Favorite sx={{ color: 'error.main', fontSize: 18 }} />
                      : <Chip size="small" label={s.selectionType} variant="outlined" />}
                    <Typography variant="body2" fontWeight={500}>{s.imageTitle ?? s.imageId}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {formatRelative(s.createdAt)} · {s.clientEmail}
                    </Typography>
                  </Stack>
                  {s.clientNotes && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      "{s.clientNotes}"
                    </Typography>
                  )}
                </Box>
              </Paper>
            ))
          )}
        </Stack>
      )}

      {/* TAB: Kontrakt & nedlastinger */}
      {tab === 3 && (
        <Stack spacing={2}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Gavel /> Kontrakt-status
              </Typography>
              <Button
                size="small"
                startIcon={auditData?.contract ? <LinkOff /> : <LinkIcon />}
                onClick={() => { setSelectedContractId(g.contractId); setLinkContractOpen(true); }}
              >
                {auditData?.contract ? 'Endre/fjern kontrakt' : 'Link kontrakt'}
              </Button>
            </Stack>

            {auditData?.contract ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Kontrakt</Typography>
                  <Typography variant="body1">{auditData.contract.title ?? 'Uten tittel'}</Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  <Chip
                    color={
                      auditData.contract.signatureStatus === 'signed' ? 'success'
                        : auditData.contract.signatureStatus === 'sent' || auditData.contract.signatureStatus === 'viewed' ? 'warning'
                        : 'error'
                    }
                    icon={auditData.contract.signatureStatus === 'signed' ? <CheckCircle /> : <Warning />}
                    label={`Signatur: ${auditData.contract.signatureStatus ?? 'ukjent'}`}
                  />
                  {auditData.contract.signedAt && (
                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                      Signert {formatDateTime(auditData.contract.signedAt)}
                    </Typography>
                  )}
                </Stack>
                {auditData.contract.signatureStatus !== 'signed' && (
                  <Alert severity="warning">
                    <strong>Klient kan IKKE laste ned</strong> før kontrakten er signert.
                    Send signering-link via Google Sign-flow.
                  </Alert>
                )}
              </Stack>
            ) : (
              <Alert severity="info">
                Ingen kontrakt er linket til dette galleriet. Klient kan laste ned uten signering.
                Link en kontrakt for å aktivere signatur-gate.
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Download /> Nedlastings-grense (contracted images)
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">Avtalt antall</Typography>
                <Typography variant="h4">
                  {auditData?.gallery.contractedImages ?? 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sett via Pris-administrasjon eller dialog ved publisering
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Ekstra-pris/bilde</Typography>
                <Typography variant="h4">
                  {Number(auditData?.gallery.pricePerImage ?? 0).toLocaleString('nb-NO')} kr
                </Typography>
              </Box>
            </Stack>
            {auditData?.gallery.contractedImages === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Ingen grense satt — klient kan laste ned alle bilder.
                Sett <code>contractedImages</code> på galleriet for å aktivere telling.
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Klient-bruk
            </Typography>
            {(auditData?.perClient ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ingen nedlastinger ennå.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {auditData!.perClient.map((c) => {
                  const limit = auditData!.gallery.contractedImages;
                  const pct = limit > 0 ? Math.min(100, (c.uniqueImages / limit) * 100) : 0;
                  return (
                    <Box key={c.clientEmail}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={500}>{c.clientEmail}</Typography>
                        <Typography variant="body2">
                          <strong>{c.uniqueImages}</strong>
                          {limit > 0 ? ` / ${limit}` : ''} unike bilder
                          {c.remainingSlots !== null && c.remainingSlots <= 5 && c.remainingSlots > 0 && (
                            <Chip
                              size="small" color="warning"
                              label={`${c.remainingSlots} igjen`}
                              sx={{ ml: 1, height: 18, fontSize: 11 }}
                            />
                          )}
                          {c.remainingSlots === 0 && (
                            <Chip
                              size="small" color="error"
                              label="Limit nådd"
                              sx={{ ml: 1, height: 18, fontSize: 11 }}
                            />
                          )}
                        </Typography>
                      </Stack>
                      {limit > 0 && (
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'primary'}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Først {formatRelative(c.firstDownload)} · Sist {formatRelative(c.lastDownload)}
                        {' · '}{c.totalDownloads} totalt (inkl. re-download)
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKey /> Access-koder
              </Typography>
              <Button
                size="small"
                startIcon={<Add />}
                variant="contained"
                onClick={() => setCreateCodeOpen(true)}
              >
                Generer kode
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Korte 6-tegns koder klienten skriver inn på <code>/portal</code> for å åpne galleriet.
              Lettere å dele muntlig eller på SMS enn lange URL-er.
            </Typography>
            {(codesData?.codes ?? []).length === 0 ? (
              <Alert severity="info">Ingen koder ennå. Generer én så klienten slipper å huske en lang URL.</Alert>
            ) : (
              <Stack spacing={1}>
                {(codesData?.codes ?? []).map((c) => (
                  <Paper key={c.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box sx={{ flexGrow: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontFamily: 'monospace', letterSpacing: '0.2em',
                              color: c.isActive ? 'primary.main' : 'text.disabled',
                              textDecoration: c.isActive ? 'none' : 'line-through',
                            }}
                          >
                            {c.code}
                          </Typography>
                          {c.label && (
                            <Typography variant="body2" color="text.secondary">
                              · {c.label}
                            </Typography>
                          )}
                          {!c.isActive && <Chip size="small" label="Revokert" color="default" sx={{ height: 18, fontSize: 11 }} />}
                          {c.isActive && c.expiresAt && new Date(c.expiresAt).getTime() < Date.now() && (
                            <Chip size="small" label="Utløpt" color="warning" sx={{ height: 18, fontSize: 11 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {c.useCount} bruk
                          {c.maxUses !== null ? ` / ${c.maxUses}` : ''}
                          {c.expiresAt ? ` · utløper ${formatDateTime(c.expiresAt)}` : ' · ingen utløp'}
                          {c.lastUsedAt && ` · sist brukt ${formatRelative(c.lastUsedAt)}`}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {c.isActive && (
                          <Tooltip title="Kopier kode">
                            <IconButton size="small" onClick={() => {
                              navigator.clipboard.writeText(c.code).then(() =>
                                setSnackbar({ msg: `Kode ${c.code} kopiert`, severity: 'info' }),
                              );
                            }}>
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {c.isActive && (
                          <Tooltip title="Kopier portal-URL">
                            <IconButton size="small" onClick={() => copyPortalUrl(c.portalUrl)}>
                              <LinkIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {c.isActive && (
                          <Tooltip title="Revoker kode">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => revokeCode.mutate(c.id)}
                              disabled={revokeCode.isPending}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Audit-log (siste 500)
            </Typography>
            {(auditData?.audit ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ingen audit-data ennå.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {(auditData?.audit ?? []).slice(0, 50).map((a) => (
                  <Paper key={a.id} variant="outlined" sx={{ p: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}>
                    {a.imageThumbnail && (
                      <Box
                        component="img"
                        src={a.imageThumbnail}
                        alt=""
                        sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }}
                      />
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {a.imageTitle ?? a.imageId.slice(0, 8)}
                        <Chip
                          size="small" label={a.downloadMethod} variant="outlined"
                          sx={{ ml: 1, height: 18, fontSize: 11 }}
                        />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.clientEmail}
                        {a.clientIp ? ` · ${a.clientIp}` : ''}
                        {' · '}{formatDateTime(a.downloadedAt)}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
                {(auditData?.audit.length ?? 0) > 50 && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                    Viser 50 av {auditData!.audit.length} totalt
                  </Typography>
                )}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}

      <Dialog open={createCodeOpen} onClose={() => setCreateCodeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <VpnKey color="primary" /> Ny access-kode
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              6-tegns kode genereres automatisk (uten 0/O/I/1 så den er lett å diktere).
              Klienten skriver inn på <code>/portal</code>.
            </Alert>
            <TextField
              label="Etikett (valgfritt)"
              fullWidth size="small"
              placeholder={`f.eks. ${detailData.gallery.clientName}`}
              value={codeDraft.label}
              onChange={(e) => setCodeDraft((s) => ({ ...s, label: e.target.value }))}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Utløp om (dager)" type="number" size="small" fullWidth
                placeholder="tom = ingen utløp"
                value={codeDraft.expiresInDays}
                onChange={(e) => setCodeDraft((s) => ({ ...s, expiresInDays: e.target.value }))}
              />
              <TextField
                label="Maks bruk" type="number" size="small" fullWidth
                placeholder="tom = ubegrenset"
                value={codeDraft.maxUses}
                onChange={(e) => setCodeDraft((s) => ({ ...s, maxUses: e.target.value }))}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateCodeOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={createCode.isPending}
            onClick={() => createCode.mutate(codeDraft)}
          >
            Generer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkContractOpen} onClose={() => setLinkContractOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Link kontrakt til galleri</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Når en kontrakt er linket, må den være <strong>signert</strong> (status: signed)
              før klienten får lastet ned noe. Bruk Google Sign-flow for å hente signatur.
            </Alert>
            {(contractsData?.contracts ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ingen kontrakter funnet. Opprett en kontrakt først.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {contractsData!.contracts.map((c) => (
                  <Paper
                    key={c.id}
                    variant="outlined"
                    sx={{
                      p: 2, cursor: 'pointer',
                      borderColor: selectedContractId === c.id ? 'primary.main' : 'divider',
                      borderWidth: selectedContractId === c.id ? 2 : 1,
                    }}
                    onClick={() => setSelectedContractId(c.id)}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{c.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.clientName} · {c.clientEmail}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={c.signatureStatus === 'signed' ? 'success'
                          : c.signatureStatus === 'sent' || c.signatureStatus === 'viewed' ? 'warning' : 'default'}
                        label={c.signatureStatus ?? c.status ?? 'draft'}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {auditData?.contract && (
            <Button
              color="error"
              onClick={() => linkContract.mutate(null)}
              disabled={linkContract.isPending}
              sx={{ mr: 'auto' }}
            >
              Fjern link
            </Button>
          )}
          <Button onClick={() => setLinkContractOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!selectedContractId || linkContract.isPending}
            onClick={() => selectedContractId && linkContract.mutate(selectedContractId)}
          >
            Link kontrakt
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={notifyOpen} onClose={() => setNotifyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Send galleri til {g.clientName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Sendes til <strong>{g.clientEmail}</strong>.
            </Typography>
            <TextField
              label="Personlig melding (valgfritt)"
              fullWidth multiline rows={4}
              placeholder={`Hei ${g.clientName}, bildene fra ${g.projectTitle} er klare!`}
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotifyOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={notifyClient.isPending}
            onClick={() => notifyClient.mutate(notifyMessage.trim())}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4500}
        onClose={() => setSnackbar(null)}
      >
        <Alert
          severity={snackbar?.severity ?? 'info'}
          onClose={() => setSnackbar(null)}
          sx={{ width: '100%' }}
        >
          {snackbar?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
