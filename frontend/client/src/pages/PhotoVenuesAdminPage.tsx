// @ts-nocheck
/**
 * PhotoVenuesAdminPage — Slice 9X.35 admin-UI
 *
 * Køen av Stine-bidrag til foto-lokasjons-katalogen. Admin ser pending,
 * og kan approve (applier diff til photo_venues) eller reject (med note).
 * Filtreres på status; kan også vise hele historikken.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Box,
  Stack,
  Typography,
  Tabs,
  Tab,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Contribution {
  id: string;
  contributorUserId: string;
  contributorEmail: string | null;
  proposalKind: 'new' | 'diff';
  targetVenueId: string | null;
  targetVenueName: string | null;
  proposedData: Record<string, any>;
  contributorNote: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_TABS: Array<{ value: 'pending' | 'approved' | 'rejected' | 'all'; label: string }> = [
  { value: 'pending', label: 'Til gjennomgang' },
  { value: 'approved', label: 'Godkjente' },
  { value: 'rejected', label: 'Avslåtte' },
  { value: 'all', label: 'Alle' },
];

const fieldLabels: Record<string, string> = {
  name: 'Navn',
  venueType: 'Type',
  address: 'Adresse',
  city: 'Sted',
  postalCode: 'Postnr',
  county: 'Fylke',
  contactName: 'Kontaktnavn',
  contactEmail: 'E-post',
  contactPhone: 'Telefon',
  websiteUrl: 'Nettside',
  bookingUrl: 'Booking-URL',
  requiresBooking: 'Krever booking',
  requiresPermit: 'Krever permit',
  feeKr: 'Pris (NOK)',
  feeUnit: 'Pris-enhet',
  openingHours: 'Åpningstider',
  restrictionsText: 'Restriksjoner',
  photographerNotes: 'Fotograf-notater',
  latitude: 'Breddegrad',
  longitude: 'Lengdegrad',
  sourceUrl: 'Kilde-URL',
};

const formatValue = (v: any): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nei';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const PhotoVenuesAdminPage: React.FC = () => {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [list, setList] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{ contribution: Contribution; action: 'approve' | 'reject' } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r: any = await apiRequest(`/api/admin/photo-venues/contributions?status=${tab}`);
      setList(r.contributions || []);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste kø');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [tab]);

  const openReview = (contribution: Contribution, action: 'approve' | 'reject') => {
    setReviewDialog({ contribution, action });
    setAdminNote('');
  };

  const submitReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    try {
      const path = reviewDialog.action === 'approve' ? 'approve' : 'reject';
      await apiRequest(`/api/admin/photo-venues/contributions/${reviewDialog.contribution.id}/${path}`, {
        method: 'POST',
        body: { adminNote: adminNote || undefined },
      });
      setReviewDialog(null);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Operasjon feilet');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContribution = (c: Contribution) => {
    const venueName = c.targetVenueName || (typeof c.proposedData?.name === 'string' ? c.proposedData.name : 'Ukjent');
    const isExpanded = expandedId === c.id;
    return (
      <Paper key={c.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1">{venueName}</Typography>
            <Chip
              size="small"
              label={c.proposalKind === 'new' ? 'Ny venue' : 'Korrigering'}
              color={c.proposalKind === 'new' ? 'primary' : 'default'}
              variant={c.proposalKind === 'new' ? 'filled' : 'outlined'}
            />
            <Chip
              size="small"
              label={
                c.status === 'pending' ? 'Pending'
                  : c.status === 'approved' ? 'Godkjent'
                    : 'Avslått'
              }
              color={
                c.status === 'pending' ? 'warning'
                  : c.status === 'approved' ? 'success'
                    : 'error'
              }
            />
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {c.status === 'pending' && (
              <>
                <Tooltip title="Godkjenn — applier endringer til katalog">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<ApproveIcon />}
                    onClick={() => openReview(c, 'approve')}
                  >
                    Godkjenn
                  </Button>
                </Tooltip>
                <Tooltip title="Avslå — registrer note til bidragsyter">
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<RejectIcon />}
                    onClick={() => openReview(c, 'reject')}
                  >
                    Avslå
                  </Button>
                </Tooltip>
              </>
            )}
            <IconButton size="small" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
              {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Fra <b>{c.contributorEmail || c.contributorUserId}</b> · {new Date(c.createdAt).toLocaleString('nb-NO')}
          {c.reviewedAt && ` · gjennomgått av ${c.reviewedBy} ${new Date(c.reviewedAt).toLocaleDateString('nb-NO')}`}
        </Typography>

        {c.contributorNote && (
          <Alert severity="info" sx={{ mt: 1, py: 0.25 }}>
            <Typography variant="caption">
              <b>Bidragsyterens kommentar:</b> {c.contributorNote}
            </Typography>
          </Alert>
        )}

        {c.adminNote && (
          <Alert severity={c.status === 'rejected' ? 'warning' : 'success'} sx={{ mt: 1, py: 0.25 }}>
            <Typography variant="caption">
              <b>Admin-note:</b> {c.adminNote}
            </Typography>
          </Alert>
        )}

        {isExpanded && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              {c.proposalKind === 'new' ? 'Foreslåtte verdier:' : 'Foreslåtte endringer:'}
            </Typography>
            <Box sx={{ mt: 1, fontFamily: 'monospace', fontSize: 13 }}>
              {Object.entries(c.proposedData || {}).map(([key, val]) => (
                <Stack key={key} direction="row" spacing={1} sx={{ py: 0.25 }}>
                  <Box sx={{ minWidth: 160, color: 'text.secondary' }}>{fieldLabels[key] || key}</Box>
                  <Box>{formatValue(val)}</Box>
                </Stack>
              ))}
            </Box>
          </>
        )}
      </Paper>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Foto-lokasjon-bidrag</Typography>
        <Button startIcon={<RefreshIcon />} onClick={reload} disabled={loading}>
          Oppdater
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {STATUS_TABS.map((t) => <Tab key={t.value} value={t.value} label={t.label} />)}
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}

      {!loading && list.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Ingen bidrag med status "{STATUS_TABS.find((t) => t.value === tab)?.label}".
          </Typography>
        </Paper>
      )}

      {!loading && list.map(renderContribution)}

      {/* Review dialog */}
      <Dialog open={!!reviewDialog} onClose={() => setReviewDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {reviewDialog?.action === 'approve' ? 'Godkjenn bidrag' : 'Avslå bidrag'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {reviewDialog?.action === 'approve'
              ? 'Endringene blir applied på katalogen umiddelbart. Bidragsyter får se godkjenningen i sin "Mine bidrag"-liste.'
              : 'Bidragsyter får se avslaget + din note. Ingen endringer skjer på katalogen.'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Note til bidragsyter (valgfri)"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder={
              reviewDialog?.action === 'approve'
                ? 'F.eks. "Takk! Verifisert mot Losby Gods nettside."'
                : 'F.eks. "Kunne ikke verifisere — pris-info matcher ikke nettside."'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialog(null)}>Avbryt</Button>
          <Button
            variant="contained"
            color={reviewDialog?.action === 'approve' ? 'success' : 'error'}
            startIcon={reviewDialog?.action === 'approve' ? <ApproveIcon /> : <RejectIcon />}
            onClick={submitReview}
            disabled={submitting}
          >
            {submitting ? 'Lagrer…' : (reviewDialog?.action === 'approve' ? 'Godkjenn' : 'Avslå')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PhotoVenuesAdminPage;
