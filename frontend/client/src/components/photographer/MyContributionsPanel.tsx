// @ts-nocheck
/**
 * MyContributionsPanel — Slice 9X.35
 *
 * Stine ser status på sine bidrag til foto-lokasjons-katalogen.
 * Pending, godkjent (med lenke til levende venue), avslått (med admin-note).
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  HourglassEmpty as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface Contribution {
  id: string;
  proposalKind: 'new' | 'diff';
  targetVenueId: string | null;
  targetVenueName: string | null;
  proposedData: Record<string, any>;
  contributorNote: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const statusChip = (status: string) => {
  if (status === 'approved') {
    return <Chip size="small" icon={<ApprovedIcon fontSize="small" />} label="Godkjent" color="success" />;
  }
  if (status === 'rejected') {
    return <Chip size="small" icon={<RejectedIcon fontSize="small" />} label="Avslått" color="error" />;
  }
  return <Chip size="small" icon={<PendingIcon fontSize="small" />} label="Til gjennomgang" color="default" />;
};

const MyContributionsPanel: React.FC = () => {
  const [list, setList] = useState<Contribution[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest('/api/photo-venues/contributions/mine')
      .then((r: any) => setList(r.contributions || []))
      .catch((e: any) => setError(e?.message || 'Kunne ikke laste bidrag'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <LocationIcon color="primary" />
          <Typography variant="h6">Mine bidrag til lokasjons-katalogen</Typography>
        </Stack>

        {loading && <CircularProgress size={24} />}
        {error && <Alert severity="error">{error}</Alert>}

        {!loading && list && list.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Du har ikke sendt inn forslag ennå. Når du støter på en lokasjon som ikke er i katalogen
            (eller har utdatert info), bruk "Foreslå denne / korrigering"-knappen i lokasjons-kortet.
          </Typography>
        )}

        {!loading && list && list.length > 0 && (
          <Stack spacing={1.5}>
            {list.map((c) => {
              const venueName =
                c.targetVenueName ||
                (typeof c.proposedData?.name === 'string' ? c.proposedData.name : 'Ukjent venue');
              return (
                <Box
                  key={c.id}
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">{venueName}</Typography>
                      <Chip
                        size="small"
                        label={c.proposalKind === 'new' ? 'Ny venue' : 'Korrigering'}
                        variant="outlined"
                      />
                    </Stack>
                    {statusChip(c.status)}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(c.createdAt).toLocaleDateString('nb-NO')}
                    {c.reviewedAt && ` · gjennomgått ${new Date(c.reviewedAt).toLocaleDateString('nb-NO')}`}
                  </Typography>
                  {c.contributorNote && (
                    <Typography variant="caption" component="div" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                      Din kommentar: {c.contributorNote}
                    </Typography>
                  )}
                  {c.adminNote && (
                    <>
                      <Divider sx={{ my: 0.5 }} />
                      <Typography
                        variant="caption"
                        component="div"
                        color={c.status === 'rejected' ? 'error.main' : 'text.secondary'}
                      >
                        Admin: {c.adminNote}
                      </Typography>
                    </>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default MyContributionsPanel;
