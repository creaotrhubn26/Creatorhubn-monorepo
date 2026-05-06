/**
 * ClientGalleriesManager — photographer's control panel for client
 * galleries (Slice 9D dashboard integration).
 *
 * Wires four backend routes from Slice 9D into one component:
 *   GET    /api/photographer/galleries           — list with engagement counts
 *   POST   /api/photographer/galleries           — create empty gallery
 *   PATCH  /api/photographer/galleries/:id/settings — configure password,
 *           pricing, watermark, screenshot-protection, expiration, branding
 *   GET    /api/photographer/galleries/:id/events — comments + selections +
 *           payments timeline
 *
 * Without this, Slice 9-10's backend infrastructure is invisible to the
 * photographer — they can't create, configure, or monitor galleries via
 * the web dashboard. Wired into ShowcaseAdmin as a "Klient-galleri" tab.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Grid,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenInNewIcon,
  Lock as LockIcon,
  AttachMoney as MoneyIcon,
  Comment as CommentIcon,
  Favorite as FavoriteIcon,
  CheckCircle as CheckCircleIcon,
  Payment as PaymentIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  getShowcaseTerminology,
  capitalise,
  type ShowcaseProfession,
  type ShowcaseTerminology,
} from '@/utils/showcaseTerminology';

interface GallerySettings {
  maxSelections?: number;
  pricePerImage?: number;
  currency?: string;
  contractedImages?: number;
  allowDownload?: boolean;
  allowComments?: boolean;
  watermarkEnabled?: boolean;
  expiresAt?: string;
  requiresPassword?: boolean;
  screenshotProtection?: boolean;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

interface PhotographerGallery {
  id: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string | null;
  accessToken: string;
  shareUrl: string;
  /** 'active' | 'completed' | other status strings the backend may set. */
  status: string;
  gallerySettings: GallerySettings;
  requiresPassword: boolean;
  createdAt: string;
  /** Slice 9X.7 — set when the photographer marks the gallery
   *  delivered. UI uses presence (not just status string) for its
   *  "marker som ferdig"-button gating. */
  completedAt?: string | null;
  imageCount: number;
  commentCount: number;
  selectionCount: number;
  favoriteCount: number;
  paidCount: number;
  /** Slice 9X.3 — linked project ID (stored in gallery_settings.projectId
   *  but surfaced top-level for UI convenience). */
  projectId?: string | null;
  /** Slice 9X.3 — title resolved from projects.title via correlated
   *  subquery; null when projectId references a deleted/missing row. */
  linkedProjectTitle?: string | null;
  /** Slice 9X.5 — pricing-package linkage. packageId is the FK; the
   *  resolved name + included-images count come from the backend
   *  correlated subquery. Used to drive auto-fill of contractedImages. */
  packageId?: string | null;
  linkedPackageName?: string | null;
  linkedPackageImagesIncluded?: number | null;
}

interface GalleryEvent {
  id: string;
  type: 'comment' | 'selection' | 'payment';
  imageId: string | null;
  clientName: string | null;
  clientEmail: string;
  detail: string;
  amount: number | null;
  currency: string | null;
  paymentStatus: string | null;
  timestamp: string;
}

export interface ClientGalleriesManagerProps {
  /** Photographer's profession for terminology — falls back to photo-flavoured copy. */
  profession?: ShowcaseProfession | null;
}

export const ClientGalleriesManager: React.FC<ClientGalleriesManagerProps> = ({ profession }) => {
  const queryClient = useQueryClient();
  const terms = useMemo(() => getShowcaseTerminology(profession), [profession]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  // Slice 9X.2 — projectId carried through the create-flow when the
  // user arrived via the "Opprett prosjekt + klient-galleri" deep-link
  // from ProjectCreationWithMemoryCards. Sent on POST so 9X.3 can
  // persist the project↔gallery linkage in gallery_settings.projectId.
  const [createProjectId, setCreateProjectId] = useState<string | null>(null);
  const [settingsOpenFor, setSettingsOpenFor] = useState<PhotographerGallery | null>(null);
  const [eventsOpenFor, setEventsOpenFor] = useState<PhotographerGallery | null>(null);

  // Slice 9X.2 — read prefill params from the URL once on mount. When
  // the deep-link sets autoCreate=1, open the dialog pre-populated
  // with clientName/clientEmail/projectTitle/projectId, then strip the
  // params so a refresh doesn't re-trigger the dialog.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoCreate') !== '1') return;
    const name = params.get('clientName') ?? '';
    const email = params.get('clientEmail') ?? '';
    const title = params.get('projectTitle') ?? '';
    const projId = params.get('projectId') ?? '';
    if (name) setCreateName(name);
    if (email) setCreateEmail(email);
    if (title) setCreateTitle(title);
    if (projId) setCreateProjectId(projId);
    setCreateOpen(true);
    // Clean up the URL so reload won't re-pop the dialog.
    const cleaned = new URLSearchParams(window.location.search);
    ['autoCreate', 'clientName', 'clientEmail', 'projectTitle', 'projectId'].forEach((k) =>
      cleaned.delete(k),
    );
    const newSearch = cleaned.toString();
    const next = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }, []);

  // Slice 9D backend route — photographer's gallery list with counts.
  const { data, isLoading, error } = useQuery<{ galleries: PhotographerGallery[] }>({
    queryKey: ['/api/photographer/galleries'],
    queryFn: () => apiRequest('/api/photographer/galleries') as Promise<{ galleries: PhotographerGallery[] }>,
    refetchInterval: 30_000, // poll every 30s so engagement counts feel live
  });

  const galleries = data?.galleries ?? [];

  const createMutation = useMutation({
    mutationFn: async () => apiRequest('/api/photographer/galleries', {
      method: 'POST',
      body: JSON.stringify({
        clientName: createName,
        clientEmail: createEmail,
        projectTitle: createTitle || undefined,
        ...(createProjectId ? { projectId: createProjectId } : {}),
      }),
    }),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateName('');
      setCreateEmail('');
      setCreateTitle('');
      setCreateProjectId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
    },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {capitalise(`klient-${terms.collection}`)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Lever {terms.itemPlural} til {terms.client}er med passord-beskyttelse, prising og innsamlede valg.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          {`Nytt ${terms.collection}`}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {`Kunne ikke laste ${terms.collection}-listen.`} {String((error as Error)?.message ?? error)}
        </Alert>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && galleries.length === 0 && (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {`Ingen ${terms.collectionPlural} ennå`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {`Opprett ditt første klient-${terms.collection} for å levere ${terms.itemPlural} til en ${terms.client}.`}
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              {`Opprett ${terms.collection}`}
            </Button>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {galleries.map((g) => (
          <Grid item xs={12} md={6} lg={4} key={g.id}>
            <GalleryCard
              gallery={g}
              terms={terms}
              onSettings={() => setSettingsOpenFor(g)}
              onEvents={() => setEventsOpenFor(g)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{`Nytt klient-${terms.collection}`}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={`${capitalise(terms.client)} navn`}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={`${capitalise(terms.client)} e-post`}
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Prosjekt-tittel (valgfritt)"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="f.eks. Bryllup Ola og Kari"
              fullWidth
            />
          </Stack>
          {createMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {String((createMutation.error as Error)?.message ?? 'Feilet')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={
              !createName ||
              !createEmail ||
              !createEmail.includes('@') ||
              createMutation.isPending
            }
          >
            {createMutation.isPending ? 'Oppretter…' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {settingsOpenFor && (
        <GallerySettingsDialog
          gallery={settingsOpenFor}
          terms={terms}
          onClose={() => setSettingsOpenFor(null)}
        />
      )}
      {eventsOpenFor && (
        <GalleryEventsDialog
          gallery={eventsOpenFor}
          terms={terms}
          onClose={() => setEventsOpenFor(null)}
        />
      )}
    </Box>
  );
};

const GalleryCard: React.FC<{
  gallery: PhotographerGallery;
  terms: ShowcaseTerminology;
  onSettings: () => void;
  onEvents: () => void;
}> = ({ gallery, terms, onSettings, onEvents }) => {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const totalEvents =
    gallery.commentCount + gallery.selectionCount + gallery.paidCount;
  const isCompleted = gallery.status === 'completed' || Boolean(gallery.completedAt);

  // Slice 9X.7 — mark gallery as delivered + trigger project callback.
  // Idempotent on the backend so a double-click won't error.
  const completeMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/photographer/galleries/${gallery.id}/mark-complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
    },
  });

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
              {gallery.projectTitle || gallery.clientName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {gallery.clientName} · {gallery.clientEmail}
            </Typography>
          </Box>
          {gallery.requiresPassword && (
            <Tooltip title="Passordbeskyttet">
              <LockIcon fontSize="small" color="action" />
            </Tooltip>
          )}
          {isCompleted && (
            <Tooltip title={gallery.completedAt ? `Levert ${new Date(gallery.completedAt).toLocaleDateString('nb-NO')}` : 'Markert som ferdig'}>
              <CheckCircleIcon fontSize="small" color="success" />
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <Chip
            size="small"
            icon={<CommentIcon />}
            label={gallery.commentCount}
            color={gallery.commentCount > 0 ? 'primary' : 'default'}
          />
          <Chip
            size="small"
            icon={<FavoriteIcon />}
            label={gallery.favoriteCount}
            color={gallery.favoriteCount > 0 ? 'secondary' : 'default'}
          />
          <Chip
            size="small"
            icon={<CheckCircleIcon />}
            label={gallery.selectionCount}
            color={gallery.selectionCount > 0 ? 'success' : 'default'}
          />
          {gallery.paidCount > 0 && (
            <Chip size="small" icon={<PaymentIcon />} label={gallery.paidCount} color="warning" />
          )}
        </Stack>

        {/* Slice 9X.3 — project linkage chip. Click navigates to the
            linked project. Hidden when no projectId is set. */}
        {gallery.projectId && (
          <Tooltip
            title={
              gallery.linkedProjectTitle
                ? `Tilknyttet prosjekt: ${gallery.linkedProjectTitle}`
                : 'Tilknyttet prosjekt (ikke funnet — kanskje slettet)'
            }
          >
            <Chip
              size="small"
              icon={<FolderIcon />}
              label={gallery.linkedProjectTitle || 'Prosjekt slettet'}
              color={gallery.linkedProjectTitle ? 'info' : 'default'}
              variant={gallery.linkedProjectTitle ? 'filled' : 'outlined'}
              onClick={() => {
                if (typeof window !== 'undefined' && gallery.projectId) {
                  window.location.href = `/universal-dashboard?projectId=${encodeURIComponent(gallery.projectId)}`;
                }
              }}
              sx={{ mb: 1, maxWidth: '100%' }}
            />
          </Tooltip>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {gallery.imageCount} {terms.itemPlural} · opprettet{' '}
          {new Date(gallery.createdAt).toLocaleDateString('nb-NO')}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            p: 1,
            mb: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              flex: 1,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {gallery.shareUrl}
          </Typography>
          <Tooltip title={copied ? 'Kopiert' : 'Kopier link'}>
            <IconButton
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(gallery.shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Åpne i ny fane">
            <IconButton size="small" onClick={() => window.open(gallery.shareUrl, '_blank')}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<SettingsIcon />}
            onClick={onSettings}
            fullWidth
          >
            Innstillinger
          </Button>
          <Button
            size="small"
            startIcon={<HistoryIcon />}
            onClick={onEvents}
            fullWidth
            variant={totalEvents > 0 ? 'contained' : 'outlined'}
          >
            Hendelser ({totalEvents})
          </Button>
        </Stack>
        {/* Slice 9X.7 — explicit completion action. Disabled when
            already completed (idempotent on backend, but visual cue). */}
        <Button
          size="small"
          startIcon={<CheckCircleIcon />}
          onClick={() => completeMutation.mutate()}
          disabled={isCompleted || completeMutation.isPending}
          fullWidth
          color="success"
          variant={isCompleted ? 'outlined' : 'contained'}
          sx={{ mt: 1 }}
        >
          {isCompleted
            ? 'Markert som ferdig'
            : completeMutation.isPending
              ? 'Markerer…'
              : 'Marker som ferdig'}
        </Button>
        {completeMutation.isError && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
            {String((completeMutation.error as Error)?.message ?? 'Feilet')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const GallerySettingsDialog: React.FC<{
  gallery: PhotographerGallery;
  terms: ShowcaseTerminology;
  onClose: () => void;
}> = ({ gallery, terms, onClose }) => {
  const queryClient = useQueryClient();
  const s = gallery.gallerySettings || {};
  const [contractedImages, setContractedImages] = useState<number>(Number(s.contractedImages ?? 0));
  const [pricePerImage, setPricePerImage] = useState<number>(Number(s.pricePerImage ?? 0));
  const [currency, setCurrency] = useState<string>(s.currency ?? 'NOK');
  const [allowDownload, setAllowDownload] = useState<boolean>(s.allowDownload !== false);
  const [allowComments, setAllowComments] = useState<boolean>(s.allowComments !== false);
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(s.watermarkEnabled === true);
  const [screenshotProtection, setScreenshotProtection] = useState<boolean>(s.screenshotProtection === true);
  const [expiresAt, setExpiresAt] = useState<string>(s.expiresAt ? s.expiresAt.slice(0, 10) : '');
  const [password, setPassword] = useState<string>('');
  const [clearPassword, setClearPassword] = useState(false);
  // Slice 9X.3 — link / unlink projectId.
  const [projectId, setProjectId] = useState<string>(gallery.projectId ?? '');
  // Slice 9X.5 — pricing-package linkage. Empty = unlinked. Backend
  // auto-fills contractedImages from the package when this changes
  // unless the photographer also edits contractedImages manually in
  // the same save (so the manual override always wins).
  const [packageId, setPackageId] = useState<string>(gallery.packageId ?? '');
  const { data: packagesList } = useQuery<{
    id: string | number;
    name?: string;
    package_name?: string;
    inclusions?: { images?: number; hours?: number };
    basePrice?: number;
  }[]>({
    // Source of truth = PricingAdministration (Administrasjon-fanen i
    // UniversalDashboard). Same /api/pricing/packages?userId=… endpoint
    // that the admin UI writes to, so changes there propagate here.
    queryKey: ['/api/pricing/packages', 'gallery-settings'],
    queryFn: async () => {
      // Photographer userId — comes from session, exposed via the
      // pricing-routes endpoint that doesn't require explicit param.
      // Falls back to empty array on auth fail.
      const me = await apiRequest('/api/auth/user').catch(() => null);
      const uid = (me as { id?: string } | null)?.id;
      if (!uid) return [];
      const res = await apiRequest(`/api/pricing/packages?userId=${encodeURIComponent(uid)}`);
      return Array.isArray(res) ? res : [];
    },
  });

  const patchMutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        contractedImages,
        pricePerImage,
        currency,
        allowDownload,
        allowComments,
        watermarkEnabled,
        screenshotProtection,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        projectId: projectId.trim() ? projectId.trim() : null,
        // Slice 9X.5 — sending packageId triggers backend auto-fill
        // of contractedImages from package.inclusions.images.
        packageId: packageId.trim() ? packageId.trim() : null,
      };
      if (clearPassword) {
        patch.password = null;
      } else if (password.length > 0) {
        patch.password = password;
      }
      return apiRequest(`/api/photographer/galleries/${gallery.id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Innstillinger — {gallery.projectTitle || gallery.clientName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <MoneyIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Prising
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label={`Inkluderte ${terms.itemPlural}`}
                type="number"
                value={contractedImages}
                onChange={(e) => setContractedImages(Math.max(0, Number(e.target.value) || 0))}
                helperText={`Antall ${terms.itemPlural} ${terms.client} får uten ekstra-betaling`}
                fullWidth
                size="small"
              />
              <TextField
                label={`Pris per ekstra-${terms.item}`}
                type="number"
                value={pricePerImage}
                onChange={(e) => setPricePerImage(Math.max(0, Number(e.target.value) || 0))}
                fullWidth
                size="small"
              />
              <TextField
                label="Valuta"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                size="small"
                sx={{ width: 100 }}
              />
            </Stack>
          </Box>

          <Divider />

          {/* Slice 9X.3 — project linkage. Plain text-input for now;
              an autocomplete/picker is a follow-up if the photographer
              accumulates lots of projects. Empty string clears the
              link on save. */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <FolderIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Tilknyttet prosjekt
            </Typography>
            <TextField
              label="Prosjekt-ID (la stå tom for å koble fra)"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              fullWidth
              size="small"
              helperText={
                gallery.linkedProjectTitle
                  ? `Nåværende: ${gallery.linkedProjectTitle}`
                  : gallery.projectId
                    ? 'Nåværende ID peker på et prosjekt som ikke finnes lenger.'
                    : 'Ikke tilknyttet noe prosjekt.'
              }
            />
          </Box>

          <Divider />

          {/* Slice 9X.5 — pricing-package linkage. Photographer's
              packages come from PricingAdministration (Administrasjon-
              fanen i UniversalDashboard); selecting one auto-fills
              contractedImages from package.inclusions.images. */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <MoneyIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Pris-pakke (fra Administrasjon)
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Velg pakke</InputLabel>
              <Select
                label="Velg pakke"
                value={packageId}
                onChange={(e) => setPackageId(String(e.target.value || ''))}
              >
                <MenuItem value="">Ingen pakke (manuelt)</MenuItem>
                {(packagesList ?? []).map((p) => {
                  const id = String(p.id);
                  const name = p.package_name || p.name || `Pakke ${id}`;
                  const imgs = p.inclusions?.images;
                  const label = imgs ? `${name} — ${imgs} bilder inkludert` : name;
                  return (
                    <MenuItem key={id} value={id}>
                      {label}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {gallery.linkedPackageName && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Nåværende: {gallery.linkedPackageName}
                {gallery.linkedPackageImagesIncluded != null
                  ? ` · ${gallery.linkedPackageImagesIncluded} bilder inkludert`
                  : ''}
              </Typography>
            )}
            {packageId && packageId !== gallery.packageId && (
              <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
                Lagring auto-fyller "Inkluderte bilder" fra pakkens inclusions.
                Endre tallet manuelt etterpå hvis kontrakten avviker.
              </Alert>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <LockIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Sikkerhet
            </Typography>
            <Stack spacing={1.5}>
              {gallery.requiresPassword && !clearPassword && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  {`${capitalise(terms.collection)} er passordbeskyttet. Skriv nytt passord under for å endre, eller kryss av for å fjerne passord.`}
                </Alert>
              )}
              <TextField
                label={gallery.requiresPassword ? 'Nytt passord (la stå tom for å beholde)' : 'Sett passord (4-128 tegn)'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                size="small"
                disabled={clearPassword}
              />
              {gallery.requiresPassword && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={clearPassword}
                      onChange={(e) => setClearPassword(e.target.checked)}
                    />
                  }
                  label="Fjern passordbeskyttelse"
                />
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={screenshotProtection}
                    onChange={(e) => setScreenshotProtection(e.target.checked)}
                  />
                }
                label="Skjermbilde-beskyttelse (best-effort, deterring)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={watermarkEnabled}
                    onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  />
                }
                label={terms.watermarkLabel}
              />
              <TextField
                label="Utløpsdato (valgfri)"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                size="small"
              />
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {`${capitalise(terms.client)}-tillatelser`}
            </Typography>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                  />
                }
                label="Tillat nedlasting (zip av valgte)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={allowComments}
                    onChange={(e) => setAllowComments(e.target.checked)}
                  />
                }
                label={`Tillat kommentarer på ${terms.itemPlural}`}
              />
            </Stack>
          </Box>

          {patchMutation.isError && (
            <Alert severity="error">
              {String((patchMutation.error as Error)?.message ?? 'Feilet')}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => patchMutation.mutate()}
          disabled={patchMutation.isPending}
        >
          {patchMutation.isPending ? 'Lagrer…' : 'Lagre'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const GalleryEventsDialog: React.FC<{
  gallery: PhotographerGallery;
  terms: ShowcaseTerminology;
  onClose: () => void;
}> = ({ gallery, terms, onClose }) => {
  const { data, isLoading } = useQuery<{ events: GalleryEvent[] }>({
    queryKey: ['/api/photographer/galleries', gallery.id, 'events'],
    queryFn: () => apiRequest(`/api/photographer/galleries/${gallery.id}/events`) as Promise<{ events: GalleryEvent[] }>,
  });
  const events = data?.events ?? [];
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Hendelser — {gallery.projectTitle || gallery.clientName}</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {isLoading && <CircularProgress />}
        {!isLoading && events.length === 0 && (
          <Typography color="text.secondary">Ingen aktivitet ennå.</Typography>
        )}
        <Stack spacing={1}>
          {events.map((e) => (
            <EventRow key={`${e.type}-${e.id}`} event={e} terms={terms} />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

const EventRow: React.FC<{ event: GalleryEvent; terms: ShowcaseTerminology }> = ({ event, terms }) => {
  const icon = useMemo(() => {
    switch (event.type) {
      case 'comment':
        return <CommentIcon color="primary" fontSize="small" />;
      case 'selection':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'payment':
        return <PaymentIcon color="warning" fontSize="small" />;
    }
  }, [event.type]);

  const label = useMemo(() => {
    switch (event.type) {
      case 'comment':
        return `${event.clientName ?? event.clientEmail} kommenterte: "${event.detail.slice(0, 80)}${event.detail.length > 80 ? '…' : ''}"`;
      case 'selection':
        return `${event.clientEmail} markerte ${terms.item} som ${event.detail}`;
      case 'payment':
        return `${event.clientEmail} betalte ${event.amount} ${event.currency} (${event.paymentStatus})`;
    }
  }, [event, terms.item]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Box sx={{ pt: 0.25 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(event.timestamp).toLocaleString('nb-NO')}
        </Typography>
      </Box>
    </Box>
  );
};

export default ClientGalleriesManager;
