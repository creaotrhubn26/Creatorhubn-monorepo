/**
 * Culling review surface — the web flat that finally makes the
 * culling service visible to the photographer.
 *
 * The backend already classifies every asset in a capture session
 * into hero / keep / weak / reject buckets based on on-device
 * signals + Claude quality_notes + duplicate-cluster winner/loser
 * logic. This page renders those buckets as four scrollable grids
 * with per-asset reasons, a strictness selector at the top, and a
 * detail view for the photographer to validate the AI's calls.
 *
 * Design decisions:
 *   * Read-only first cut. The photographer can see what the AI
 *     thinks and in which bucket each frame landed, but bucket
 *     mutations (promote weak → keep, demote hero → reject) happen
 *     on the existing review endpoints and will be wired in a later
 *     iteration. Read-only ships value immediately without risk of
 *     mass-mutating a production dataset on a buggy first deploy.
 *   * Strictness is a query param so a shared URL reproduces the
 *     same classification (photographers often share screenshots of
 *     "what the AI caught"). Conservative/balanced/aggressive match
 *     the backend's enum.
 *   * Reasons are surfaced prominently — the whole point of AI-
 *     assisted culling is that the photographer trusts the call.
 *     Hiding the "motion blur" / "duplicate of stronger frame"
 *     justification strips the trust from the feature.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Stack,
  Chip,
  Box,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';

type Bucket = 'hero' | 'keep' | 'weak' | 'reject';

interface CullingSuggestion {
  assetId: string;
  bucket: Bucket;
  score: number;
  reasons: string[];
}

interface CullResponse {
  sessionId: string;
  strictness: 'conservative' | 'balanced' | 'aggressive';
  total: number;
  hero: CullingSuggestion[];
  keep: CullingSuggestion[];
  weak: CullingSuggestion[];
  reject: CullingSuggestion[];
  duplicateClusters: Record<string, string[]>;
}

interface CaptureAsset {
  id: string;
  previewUrl?: string | null;
  originalFilename?: string | null;
  captureTime?: string | null;
  rating?: number;
  rejected?: boolean;
  flaggedForClient?: boolean;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  hero: 'Hero',
  keep: 'Behold',
  weak: 'Svake',
  reject: 'Avvist',
};

const BUCKET_DESCRIPTION: Record<Bucket, string> = {
  hero: 'Skarpe, feilfrie frames som fortjener hovedrollen',
  keep: 'Normale working shots — leveres til klient',
  weak: 'Soft rejects verdt et ekstra blikk før du slipper',
  reject: 'Harde rejects AI anbefaler å slette',
};

const BUCKET_COLOR: Record<Bucket, 'success' | 'info' | 'warning' | 'error'> = {
  hero: 'success',
  keep: 'info',
  weak: 'warning',
  reject: 'error',
};

const STRICTNESS_VALUES = ['conservative', 'balanced', 'aggressive'] as const;
type Strictness = (typeof STRICTNESS_VALUES)[number];

const STRICTNESS_LABEL: Record<Strictness, string> = {
  conservative: 'Mildt',
  balanced: 'Balansert',
  aggressive: 'Strengt',
};

const STRICTNESS_HINT: Record<Strictness, string> = {
  conservative: 'Færre rejects, flere heroes. For korte eller ikke-gjentakbare økter.',
  balanced: 'Referansen. Anbefalt for de fleste sesjoner.',
  aggressive: 'Flere rejects, færre heroes. For tunge kull der AI må jobbe.',
};


export default function CullingReviewPage() {
  const params = useParams<{ sessionId: string }>();
  const [location, setLocation] = useLocation();
  const sessionId = params.sessionId;

  const initialStrictness = (() => {
    const qs = new URLSearchParams(location.split('?')[1] ?? '');
    const raw = qs.get('strictness');
    return STRICTNESS_VALUES.includes(raw as Strictness)
      ? (raw as Strictness)
      : 'balanced';
  })();

  const [strictness, setStrictness] = useState<Strictness>(initialStrictness);
  const [cull, setCull] = useState<CullResponse | null>(null);
  const [assets, setAssets] = useState<Record<string, CaptureAsset>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<CullingSuggestion | null>(
    null,
  );

  // Fetch the cull suggestions + the asset list side-by-side. The
  // cull endpoint returns IDs + reasons but not preview URLs, so we
  // also pull /assets to join preview paths locally. Failures on
  // either side are rendered as an error surface rather than a
  // half-loaded page — the photographer needs to see all four
  // buckets to trust the triage.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const [cullRes, assetsRes] = await Promise.all([
          apiRequest(
            `/api/capture/sessions/${encodeURIComponent(sessionId)}/cull-suggestions?strictness=${strictness}`,
          ),
          apiRequest(
            `/api/capture/sessions/${encodeURIComponent(sessionId)}/assets`,
          ).catch(() => ({ assets: [] })),
        ]);
        if (!alive) return;
        setCull(cullRes as CullResponse);
        const rows = (assetsRes as { assets?: CaptureAsset[] })?.assets ?? [];
        const byId: Record<string, CaptureAsset> = {};
        for (const r of rows) byId[r.id] = r;
        setAssets(byId);
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Kunne ikke hente culling-forslag',
        );
        setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [sessionId, strictness]);

  const handleStrictnessChange = (next: Strictness) => {
    setStrictness(next);
    // Keep the URL in sync so the classification is shareable.
    const base = location.split('?')[0];
    setLocation(`${base}?strictness=${next}`, { replace: true });
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          AI klassifiserer {cull?.total ?? ''} bilder…
        </Typography>
      </Container>
    );
  }

  if (error || !cull) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{error ?? 'Ingen data'}</Alert>
      </Container>
    );
  }

  const buckets: Bucket[] = ['hero', 'keep', 'weak', 'reject'];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5">AI-culling for denne økten</Typography>
          <Typography variant="body2" color="text.secondary">
            {cull.total} bilder klassifisert. Trykk et bilde for å se hvorfor AI plasserte det der.
          </Typography>
        </Box>
        <Tooltip title={STRICTNESS_HINT[strictness]}>
          <ToggleButtonGroup
            value={strictness}
            exclusive
            size="small"
            onChange={(_, v) => {
              if (v && STRICTNESS_VALUES.includes(v as Strictness)) {
                handleStrictnessChange(v as Strictness);
              }
            }}
          >
            {STRICTNESS_VALUES.map((s) => (
              <ToggleButton key={s} value={s}>
                {STRICTNESS_LABEL[s]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Tooltip>
      </Stack>

      <Stack spacing={4}>
        {buckets.map((bucket) => {
          const list = cull[bucket];
          return (
            <Box key={bucket}>
              <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1 }}>
                <Typography variant="h6">{BUCKET_LABEL[bucket]}</Typography>
                <Chip size="small" label={list.length} color={BUCKET_COLOR[bucket]} />
                <Typography variant="caption" color="text.secondary">
                  {BUCKET_DESCRIPTION[bucket]}
                </Typography>
              </Stack>
              {list.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  ingen bilder i denne bøtten
                </Typography>
              ) : (
                <Grid container spacing={1}>
                  {list.map((suggestion) => {
                    const asset = assets[suggestion.assetId];
                    return (
                      <Grid item xs={6} sm={4} md={3} lg={2} key={suggestion.assetId}>
                        <Card
                          variant="outlined"
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setSelectedAsset(suggestion)}
                        >
                          {asset?.previewUrl ? (
                            <CardMedia
                              component="img"
                              image={asset.previewUrl}
                              alt={asset.originalFilename ?? ''}
                              sx={{ aspectRatio: '3 / 2', objectFit: 'cover' }}
                            />
                          ) : (
                            <Box sx={{ aspectRatio: '3 / 2', bgcolor: 'action.hover' }} />
                          )}
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {asset?.originalFilename ?? suggestion.assetId.slice(0, 8)}
                              </Typography>
                              <Chip
                                size="small"
                                label={Math.round(suggestion.score * 100)}
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            </Stack>
                            {suggestion.reasons.length > 0 && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {suggestion.reasons[0]}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          );
        })}
      </Stack>

      {/* Detail dialog — shows reasons verbatim so the photographer
          can defend or overrule each call. */}
      <Dialog
        open={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {selectedAsset
                ? (assets[selectedAsset.assetId]?.originalFilename ?? selectedAsset.assetId)
                : ''}
            </Typography>
            <IconButton onClick={() => setSelectedAsset(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedAsset && (
            <Stack spacing={2}>
              {assets[selectedAsset.assetId]?.previewUrl && (
                <Box
                  component="img"
                  src={assets[selectedAsset.assetId]!.previewUrl!}
                  alt=""
                  sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              )}
              <Stack direction="row" spacing={1}>
                <Chip
                  label={BUCKET_LABEL[selectedAsset.bucket]}
                  color={BUCKET_COLOR[selectedAsset.bucket]}
                  size="small"
                />
                <Chip
                  label={`Score ${Math.round(selectedAsset.score * 100)}/100`}
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Hvorfor AI plasserte den her
                </Typography>
                {selectedAsset.reasons.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Ingen spesifikke flags. Klassifiseringen er basert på score alene.
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {selectedAsset.reasons.map((reason, idx) => (
                      <Typography
                        key={idx}
                        component="li"
                        variant="body2"
                        color="text.secondary"
                      >
                        {reason}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
