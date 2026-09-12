// Slice 9X.21 — settings-overview for fotograf. Konsoliderer profil,
// logo, abonnement, Google Drive-folder-struktur, lagring og integrasjoner
// i én side så Stine slipper å navigere gjennom 7 forskjellige tabs.

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, Button, TextField, IconButton, Chip,
  CircularProgress, Alert, LinearProgress, Snackbar, Avatar, Divider,
  Grid2, List, ListItem, ListItemText, ListItemIcon,
} from '@mui/material';
import {
  ArrowBack, Settings, Person, AccountBalance, CloudUpload as CloudUploadIcon,
  Save, OpenInNew, CheckCircle, Warning, Edit, Image as ImageIcon,
  Storage, FolderSpecial, Receipt, Email, AccountBalanceWallet, Folder,
} from '@mui/icons-material';
import { apiRequest, apiFetch } from '@/lib/queryClient';
import MyContributionsPanel from '@/components/photographer/MyContributionsPanel';
import PushSettingsCard from '@/components/wedding/PushSettingsCard';
import GoogleWorkspaceSessionBadge from '@/components/universal/GoogleWorkspaceSessionBadge';
import UserAIUsageCard from '@/components/settings/UserAIUsageCard';
import UserB2Panel from '@/components/settings/UserB2Panel';

interface PhotographerProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  companyName: string | null;
  organizationNumber: string | null;
  businessAddress: string | null;
  website: string | null;
  vatNumber: string | null;
  profileImageUrl: string | null;
  profession: string | null;
  createdAt: string;
}

interface SettingsOverview {
  profile: PhotographerProfile | null;
  google: {
    workspaceConnected: boolean;
    driveConnected: boolean;
    gmailConnected: boolean;
    calendarConnected: boolean;
  };
  counts: { projects: number; clients: number; galleries: number };
  integrations: {
    poweroffice: { connected: boolean; status: string | null };
  };
}

interface StorageInfo {
  totalStorageGB: number;
  usedStorageGB: number;
  availableGB: number;
  usagePercentage: number;
  dataSource: string;
  driveUsageGB?: number;
  photosUsageGB?: number;
  gmailUsageGB?: number;
}

interface SubscriptionStatus {
  status: string;
  plan?: string;
  tier?: string;
  renewsAt?: string | null;
  cancelAt?: string | null;
}

interface FolderSetupResult {
  rootFolderId: string;
  rootFolderUrl: string;
  subfolders: { name: string; id: string }[];
}

export default function PhotographerSettings() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<PhotographerProfile>>({});
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [driveFolders, setDriveFolders] = useState<FolderSetupResult | null>(null);

  const { data, isLoading } = useQuery<SettingsOverview>({
    queryKey: ['/api/photographer/settings/overview'],
    queryFn: () => apiRequest('/api/photographer/settings/overview'),
  });

  const { data: storage } = useQuery<StorageInfo>({
    queryKey: [`/api/google-workspace/storage/${data?.profile?.id ?? 'me'}`],
    queryFn: () => apiRequest(`/api/google-workspace/storage/${data?.profile?.id ?? 'me'}`),
    enabled: !!data?.profile?.id,
  });

  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/user/subscription-status'],
    queryFn: () => apiRequest('/api/user/subscription-status'),
  });

  // Init profile draft når data laster
  useEffect(() => {
    if (data?.profile && !editingProfile) {
      setProfileDraft(data.profile);
    }
    if (data?.profile?.profileImageUrl && !logoPreview) {
      setLogoPreview(data.profile.profileImageUrl);
    }
  }, [data, editingProfile, logoPreview]);

  const updateProfile = useMutation<unknown, Error, Partial<PhotographerProfile>>({
    mutationFn: (body) => apiRequest('/api/photographer/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/photographer/settings/overview'] });
      setEditingProfile(false);
      setSnackbar({ msg: 'Profil oppdatert', severity: 'success' });
    },
  });

  const uploadLogo = useMutation<unknown, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append('logo', file);
      const res = await apiFetch('/api/branding/upload-logo', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/photographer/settings/overview'] });
      setLogoFile(null);
      setSnackbar({ msg: 'Logo lastet opp', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ msg: 'Kunne ikke laste opp logo', severity: 'error' });
    },
  });

  const setupDriveFolders = useMutation<FolderSetupResult, Error, void>({
    mutationFn: () => apiRequest('/api/photographer/google-drive/setup-folders', {
      method: 'POST',
    }),
    onSuccess: (result) => {
      setDriveFolders(result);
      setSnackbar({
        msg: `Folder-struktur opprettet i Google Drive (${result.subfolders.length} mapper)`,
        severity: 'success',
      });
    },
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try { const p = JSON.parse(msg); msg = p.message || p.error || msg; } catch { /* */ }
      setSnackbar({ msg, severity: 'error' });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data?.profile) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Kunne ikke laste profil-data.</Alert>
      </Box>
    );
  }

  const p = data.profile;
  const storageWarning = storage && storage.usagePercentage > 80;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/dashboard')}>
          <ArrowBack />
        </IconButton>
        <Settings color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">Innstillinger</Typography>
          <Typography variant="caption" color="text.secondary">
            Profil, logo, abonnement, Google Drive og integrasjoner
          </Typography>
        </Box>
      </Stack>

      <Grid2 container spacing={3}>
        {/* PROFIL */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person /> Profil
              </Typography>
              {!editingProfile ? (
                <Button size="small" startIcon={<Edit />} onClick={() => setEditingProfile(true)}>
                  Rediger
                </Button>
              ) : (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => { setEditingProfile(false); setProfileDraft(p); }}>
                    Avbryt
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Save />}
                    onClick={() => updateProfile.mutate(profileDraft)}
                    disabled={updateProfile.isPending}
                  >
                    Lagre
                  </Button>
                </Stack>
              )}
            </Stack>

            {!editingProfile ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Navn</Typography>
                  <Typography>{[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">E-post</Typography>
                  <Typography>{p.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Telefon</Typography>
                  <Typography>{p.phoneNumber ?? '—'}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary">Firmanavn</Typography>
                  <Typography>{p.companyName ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Organisasjonsnr</Typography>
                  <Typography sx={{ fontFamily: 'monospace' }}>{p.organizationNumber ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Adresse</Typography>
                  <Typography>{p.businessAddress ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Nettside</Typography>
                  <Typography>{p.website ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">MVA-nummer</Typography>
                  <Typography>{p.vatNumber ?? '—'}</Typography>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Fornavn" size="small" fullWidth
                    value={profileDraft.firstName ?? ''}
                    onChange={(e) => setProfileDraft((s) => ({ ...s, firstName: e.target.value }))}
                  />
                  <TextField
                    label="Etternavn" size="small" fullWidth
                    value={profileDraft.lastName ?? ''}
                    onChange={(e) => setProfileDraft((s) => ({ ...s, lastName: e.target.value }))}
                  />
                </Stack>
                <TextField
                  label="Telefon" size="small" fullWidth
                  value={profileDraft.phoneNumber ?? ''}
                  onChange={(e) => setProfileDraft((s) => ({ ...s, phoneNumber: e.target.value }))}
                />
                <Divider />
                <TextField
                  label="Firmanavn" size="small" fullWidth
                  value={profileDraft.companyName ?? ''}
                  onChange={(e) => setProfileDraft((s) => ({ ...s, companyName: e.target.value }))}
                />
                <TextField
                  label="Organisasjonsnr" size="small" fullWidth
                  value={profileDraft.organizationNumber ?? ''}
                  onChange={(e) => setProfileDraft((s) => ({ ...s, organizationNumber: e.target.value }))}
                  helperText="Brønnøysund-org.nr (9 sifre)"
                />
                <TextField
                  label="MVA-nummer" size="small" fullWidth
                  value={profileDraft.vatNumber ?? ''}
                  onChange={(e) => setProfileDraft((s) => ({ ...s, vatNumber: e.target.value }))}
                  helperText="F.eks. NO123456789MVA"
                />
                <TextField
                  label="Adresse" size="small" fullWidth multiline rows={2}
                  value={profileDraft.businessAddress ?? ''}
                  onChange={(e) => setProfileDraft((s) => ({ ...s, businessAddress: e.target.value }))}
                  helperText="Hentes automatisk fra BRREG basert på organisasjonsnummer. Brukes som startpunkt for kjøregodtgjørelse."
                />
                <TextField
                  label="Nettside" size="small" fullWidth
                  value={profileDraft.website ?? ''}
                  onChange={(e) => setProfileDraft((s) => ({ ...s, website: e.target.value }))}
                />
              </Stack>
            )}
          </Paper>
        </Grid2>

        {/* LOGO + BRANDING */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImageIcon /> Logo & branding
            </Typography>
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 3 }}>
              <Avatar
                src={logoPreview ?? undefined}
                sx={{
                  width: 96, height: 96,
                  bgcolor: 'grey.100',
                  fontSize: 24,
                  border: 1, borderColor: 'divider',
                }}
              >
                {p.companyName?.[0]?.toUpperCase() ?? p.firstName?.[0]?.toUpperCase() ?? 'S'}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Vises i header, klient-eposter og delbare gallerier.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  component="label"
                >
                  Velg fil
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setSnackbar({ msg: 'Maks 5MB', severity: 'error' });
                        return;
                      }
                      setLogoFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setLogoPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </Button>
                {logoFile && (
                  <Button
                    sx={{ ml: 1 }}
                    variant="contained"
                    onClick={() => uploadLogo.mutate(logoFile)}
                    disabled={uploadLogo.isPending}
                  >
                    {uploadLogo.isPending ? 'Laster opp…' : 'Lagre logo'}
                  </Button>
                )}
              </Box>
            </Stack>
            <Alert severity="info" sx={{ mb: 1 }}>
              PNG/JPG/SVG/WEBP · maks 5MB · anbefalt 512×512px transparent.
            </Alert>
          </Paper>
        </Grid2>

        {/* ABONNEMENT */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceWallet /> Abonnement
              </Typography>
              <Button
                size="small"
                endIcon={<OpenInNew />}
                onClick={() => navigate('/subscription?profession=photographer')}
              >
                Endre plan
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">Aktiv plan</Typography>
                <Typography variant="h5">
                  {subscription?.plan ?? subscription?.tier ?? subscription?.status ?? '—'}
                </Typography>
              </Box>
              {subscription?.renewsAt && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Fornyes</Typography>
                  <Typography>{new Date(subscription.renewsAt).toLocaleDateString('nb-NO')}</Typography>
                </Box>
              )}
              {subscription?.cancelAt && (
                <Alert severity="warning">
                  Abonnementet sies opp {new Date(subscription.cancelAt).toLocaleDateString('nb-NO')}.
                </Alert>
              )}
              <Divider />
              <Stack direction="row" spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Prosjekter</Typography>
                  <Typography variant="h6">{data.counts.projects}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Klienter</Typography>
                  <Typography variant="h6">{data.counts.clients}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Gallerier</Typography>
                  <Typography variant="h6">{data.counts.galleries}</Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Grid2>

        {/* WORKSPACE LAGRING */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Storage /> Google Workspace lagring
            </Typography>
            {!storage ? (
              <Alert severity="info">Henter lagrings-status…</Alert>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="body2">
                      <strong>{storage.usedStorageGB.toFixed(1)} GB</strong> brukt av{' '}
                      {storage.totalStorageGB.toFixed(0)} GB
                    </Typography>
                    <Typography variant="body2" color={storageWarning ? 'error.main' : 'text.secondary'}>
                      {storage.usagePercentage.toFixed(1)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={storage.usagePercentage}
                    color={storageWarning ? 'error' : storage.usagePercentage > 60 ? 'warning' : 'primary'}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {storage.availableGB.toFixed(1)} GB ledig
                  </Typography>
                </Box>
                {storageWarning && (
                  <Alert severity="warning">
                    Du nærmer deg grensen. Vurder å slette gamle RAW-filer eller oppgradere lagringsplassen i Google One.
                  </Alert>
                )}
                {(storage.driveUsageGB !== undefined || storage.photosUsageGB !== undefined) && (
                  <Stack direction="row" spacing={2}>
                    {storage.driveUsageGB !== undefined && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Drive</Typography>
                        <Typography variant="body2">{storage.driveUsageGB.toFixed(1)} GB</Typography>
                      </Box>
                    )}
                    {storage.photosUsageGB !== undefined && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Photos</Typography>
                        <Typography variant="body2">{storage.photosUsageGB.toFixed(1)} GB</Typography>
                      </Box>
                    )}
                    {storage.gmailUsageGB !== undefined && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Gmail</Typography>
                        <Typography variant="body2">{storage.gmailUsageGB.toFixed(1)} GB</Typography>
                      </Box>
                    )}
                  </Stack>
                )}
                <Typography variant="caption" color="text.secondary">
                  Kilde: {storage.dataSource === 'live-drive' ? 'Live fra Google Drive' : 'Database-estimat'}
                </Typography>
              </Stack>
            )}
          </Paper>
        </Grid2>

        {/* GOOGLE DRIVE FOLDER-STRUKTUR */}
        <Grid2 size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderSpecial /> Google Drive folder-struktur
              </Typography>
              <Stack direction="row" spacing={1}>
                {data.google.driveConnected ? (
                  <Chip color="success" icon={<CheckCircle />} label="Drive tilkoblet" size="small" />
                ) : (
                  <Chip color="warning" icon={<Warning />} label="Drive ikke koblet" size="small" />
                )}
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<FolderSpecial />}
                  onClick={() => setupDriveFolders.mutate()}
                  disabled={setupDriveFolders.isPending || !data.google.driveConnected}
                >
                  {setupDriveFolders.isPending ? 'Oppretter…' : 'Sett opp standard struktur'}
                </Button>
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Oppretter mappe-strukturen "<strong>Creatorhubn Photographer</strong>" i din Google Drive med 5 standard undermapper:
            </Typography>
            <List dense>
              {['01-RAW', '02-Selected', '03-Edited', '04-Delivery', '05-Contracts'].map((name) => (
                <ListItem key={name}>
                  <ListItemIcon><Folder fontSize="small" color="action" /></ListItemIcon>
                  <ListItemText
                    primary={name}
                    secondary={
                      name === '01-RAW' ? 'Originalfiler fra kameraet (full-størrelse, ikke-redigerte)'
                      : name === '02-Selected' ? 'Utvalgte bilder etter culling'
                      : name === '03-Edited' ? 'Redigerte JPEG-er'
                      : name === '04-Delivery' ? 'Web-optimaliserte filer for klient-leveranse'
                      : 'Signerte kontrakter og fakturaer'
                    }
                  />
                </ListItem>
              ))}
            </List>
            {driveFolders && (
              <Alert
                severity="success"
                sx={{ mt: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    endIcon={<OpenInNew />}
                    onClick={() => window.open(driveFolders.rootFolderUrl, '_blank')}
                  >
                    Åpne i Drive
                  </Button>
                }
              >
                Mappe-struktur opprettet — {driveFolders.subfolders.length} undermapper klare
              </Alert>
            )}
            {!data.google.driveConnected && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Koble til Google Workspace først for å aktivere folder-strukturen.
              </Alert>
            )}
          </Paper>
        </Grid2>

        {/* INTEGRASJONER */}
        <Grid2 size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalance /> Integrasjoner
                </Typography>
                {/* Slice 9X.64 — Google-SSO status-pill (flyttet fra dashboard).
                    Real-time: refetchInterval 30s + refetchOnWindowFocus. */}
                {data?.profile?.id && (
                  <GoogleWorkspaceSessionBadge
                    userId={String(data.profile.id)}
                    tone="creatorhub"
                    compact
                  />
                )}
              </Stack>
              <Button
                size="small"
                endIcon={<OpenInNew />}
                onClick={() => navigate('/photographer/settings/integrations')}
              >
                Administrer
              </Button>
            </Stack>
            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Email color={data.google.gmailConnected ? 'success' : 'action'} />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Gmail</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {data.google.gmailConnected ? 'Tilkoblet' : 'Ikke koblet'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Folder color={data.google.driveConnected ? 'success' : 'action'} />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Google Drive</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {data.google.driveConnected ? 'Tilkoblet' : 'Ikke koblet'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Receipt color={data.integrations.poweroffice.connected ? 'success' : 'action'} />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>PowerOffice</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {data.integrations.poweroffice.connected
                          ? `Status: ${data.integrations.poweroffice.status}`
                          : 'Ikke koblet'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Settings color={data.google.calendarConnected ? 'success' : 'action'} />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Calendar</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {data.google.calendarConnected ? 'Tilkoblet' : 'Ikke koblet'}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grid2>
            </Grid2>
          </Paper>
        </Grid2>

        {/* Slice 9X.35 — Stines bidrag til lokasjons-katalogen */}
        <Grid2 size={{ xs: 12 }}>
          <MyContributionsPanel />
        </Grid2>

        {/* Slice 9X.43 — Push-varsler */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <PushSettingsCard />
        </Grid2>

        {/* Slice 9X.71 — Brukerens AI-forbruk */}
        <Grid2 size={{ xs: 12 }}>
          <UserAIUsageCard />
        </Grid2>

        {/* Mitt B2-arkiv — brukerens egne Backblaze B2-credentials,
            fil-utforsker, upload/download/slett og kostnadsoversikt. */}
        <Grid2 size={{ xs: 12 }} id="b2">
          <UserB2Panel />
        </Grid2>
      </Grid2>

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
