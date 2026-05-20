/**
 * PublicCvAnalyticsDialog — Eier-only-statistikk for offentlig CV.
 *
 * Viser:
 *   • Total visninger + unike viewers
 *   • Daglig trend siste 30 dager (sparkline-aktig)
 *   • Top 10 land
 *   • Siste 25 visninger med land/by/referrer/UA
 *
 * Lukket dialog under "Mine CV-er" → "Vis statistikk" pr CV når den er
 * offentlig publisert.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Paper, Chip, IconButton,
  CircularProgress, Alert, Divider, LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  TrendingUp as TrendingUpIcon,
  Public as PublicIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface Analytics {
  totalViews: number;
  uniqueViewers: number;
  bots: number;
  byCountry: { countryCode: string; count: number }[];
  last30Days: { date: string; count: number }[];
  recent: {
    viewedAt: string;
    countryCode: string | null;
    city: string | null;
    referrer: string | null;
    userAgent: string;
  }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  resumeId: string | null;
  resumeTitle?: string;
}

// Norske + nordiske land får full label, ellers ISO-koden
const COUNTRY_LABELS: Record<string, string> = {
  NO: 'Norge', SE: 'Sverige', DK: 'Danmark', FI: 'Finland', IS: 'Island',
  US: 'USA', GB: 'Storbritannia', DE: 'Tyskland', FR: 'Frankrike', NL: 'Nederland',
  PL: 'Polen', ES: 'Spania', IT: 'Italia', LT: 'Litauen',
};

function flagEmoji(cc: string): string {
  // ISO-kode (2 bokstaver) → flagg-emoji (regional indicators)
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return cc
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

export const PublicCvAnalyticsDialog: React.FC<Props> = ({
  open, onClose, resumeId, resumeTitle,
}) => {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery<Analytics>({
    queryKey: ['public-cv-analytics', resumeId],
    queryFn: async () => {
      if (!resumeId) throw new Error('no_resume');
      return (await apiRequest(`/api/resumes/${resumeId}/analytics`, {
        headers: { 'x-user-id': user?.id || '' },
      })) as Analytics;
    },
    enabled: open && !!resumeId && !!user?.id,
  });

  const maxDayCount = Math.max(1, ...(data?.last30Days ?? []).map((d) => d.count));
  const totalCountryViews = (data?.byCountry ?? []).reduce((a, b) => a + b.count, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PublicIcon sx={{ color: '#F5B82E' }} />
          <Box>
            <Typography variant="h6" component="span">CV-statistikk</Typography>
            {resumeTitle && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                {resumeTitle}
              </Typography>
            )}
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">Kunne ikke hente statistikk.</Alert>}
        {data && (
          <Stack spacing={3}>
            {/* Hovedtall */}
            <Stack direction="row" spacing={2}>
              <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#1F2937' }}>
                  {data.totalViews}
                </Typography>
                <Typography variant="caption" color="text.secondary">Totale visninger</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: '#FFF8E1' }}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: '#7A5A0B' }}>
                  {data.uniqueViewers}
                </Typography>
                <Typography variant="caption" color="text.secondary">Unike personer</Typography>
              </Paper>
              {data.bots > 0 && (
                <Paper variant="outlined" sx={{ flex: 1, p: 2, textAlign: 'center', bgcolor: '#F9FAFB' }}>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: '#6B7280' }}>
                    {data.bots}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Bots (ekskl.)</Typography>
                </Paper>
              )}
            </Stack>

            {/* Trend siste 30 dager */}
            {data.last30Days.length > 0 && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TrendingUpIcon sx={{ fontSize: 18 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Siste 30 dager
                  </Typography>
                </Stack>
                <Box sx={{
                  display: 'flex', alignItems: 'flex-end', gap: 0.4,
                  height: 100, p: 1,
                  bgcolor: '#FAFAFA', borderRadius: 1,
                }}>
                  {data.last30Days.map((d) => (
                    <Box
                      key={d.date}
                      title={`${d.date}: ${d.count} visninger`}
                      sx={{
                        flex: 1,
                        height: `${Math.max(8, (d.count / maxDayCount) * 100)}%`,
                        bgcolor: '#F5B82E',
                        borderRadius: '2px 2px 0 0',
                        minWidth: 6,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Land */}
            {data.byCountry.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Visninger per land
                </Typography>
                <Stack spacing={0.7}>
                  {data.byCountry.slice(0, 10).map((c) => {
                    const pct = totalCountryViews > 0
                      ? (c.count / totalCountryViews) * 100
                      : 0;
                    return (
                      <Stack key={c.countryCode} direction="row" spacing={1} alignItems="center">
                        <Box sx={{ fontSize: 18, lineHeight: 1 }}>{flagEmoji(c.countryCode)}</Box>
                        <Typography variant="caption" sx={{ minWidth: 120, fontWeight: 600 }}>
                          {COUNTRY_LABELS[c.countryCode] ?? c.countryCode}
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{ height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#F5B82E' } }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
                          {c.count}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Divider />

            {/* Siste visninger */}
            {data.recent.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Siste visninger
                </Typography>
                <Stack spacing={0.5}>
                  {data.recent.slice(0, 15).map((r, i) => (
                    <Stack
                      key={i}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ py: 0.5, px: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <VisibilityIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" sx={{ minWidth: 110 }}>
                        {new Date(r.viewedAt).toLocaleString('no-NO', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Typography>
                      <Typography variant="caption">
                        {flagEmoji(r.countryCode ?? '')} {COUNTRY_LABELS[r.countryCode ?? ''] ?? r.countryCode ?? '—'}
                      </Typography>
                      {r.referrer && (
                        <Chip
                          label={
                            (() => {
                              try { return new URL(r.referrer).hostname; }
                              catch { return r.referrer.slice(0, 30); }
                            })()
                          }
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 10 }}
                        />
                      )}
                      <Box sx={{ flex: 1 }} />
                      <Typography variant="caption" color="text.disabled">
                        {r.userAgent}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : (
              <Alert severity="info">
                Ingen visninger ennå. Del CV-en for å begynne å samle statistikk.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublicCvAnalyticsDialog;
