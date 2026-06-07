// @ts-nocheck
/**
 * IndividualOnboardingWizard — Slice 9X.77
 *
 * Velkomst for solo-brukere (fotograf, videograf, music_producer, vendor).
 * Komplementerer TeamOnboardingWizard som er for enterprise-team.
 *
 * Steg:
 *   1. Velkomst — navn + business-navn
 *   2. Profesjon — auto-valgt hvis kjent, ellers velger brukeren
 *   3. Brand-farge — fra profesjon-defaults eller egen hex
 *   4. Anbefalt marketplace-tier — basert på profesjon
 *   5. Ferdig — tar deg til dashboardet
 *
 * Skriver til /api/branding/business-info (eksisterende endpoint) + localStorage-flag.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography, Button,
  IconButton, TextField, Stepper, Step, StepLabel, Avatar, Chip, Alert,
  Card, Link, alpha,
} from '@mui/material';
import {
  Close as CloseIcon, ArrowBack as BackIcon, ArrowForward as NextIcon,
  CheckCircle as DoneIcon, PhotoCamera as CameraIcon, EmojiPeople as WelcomeIcon,
  Palette as PaletteIcon, Store as StoreIcon, Person as PersonIcon,
  Videocam as VideoIcon, LibraryMusic as MusicIcon, Storefront as VendorIcon,
  Backup as BackupIcon,
  Cloud as CloudIcon, Storage as StorageIcon, OpenInNew as OpenInNewIcon,
  Verified as VerifiedIcon, ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import StorageProviderStep from '@/components/onboarding/StorageProviderStep';
import OneDeskDownloadCard from '@/components/storage/OneDeskDownloadCard';

const PROFESSIONS = [
  { id: 'photographer', label: 'Fotograf', icon: <CameraIcon />, color: '#ffba6c', tagline: 'Bryllup, portrett, kommersielt' },
  { id: 'videographer', label: 'Videograf', icon: <VideoIcon />, color: '#e74c3c', tagline: 'Reklame, musikkvideo, dokumentar' },
  { id: 'music_producer', label: 'Musikkprodusent', icon: <MusicIcon />, color: '#1976d2', tagline: 'Studio, beats, miksing' },
  { id: 'vendor', label: 'Leverandør', icon: <VendorIcon />, color: '#27ae60', tagline: 'Utleie, salg, service' },
];

const TIER_RECOMMENDATIONS: Record<string, { name: string; price: string; reason: string }> = {
  photographer: {
    name: 'Innholdsprodusent (The Role Room)',
    price: '495 kr / mnd',
    reason: 'Brief + storyboard + leveranse-tracker. Perfekt for solo-fotograf med 1-3 prosjekter samtidig.',
  },
  videographer: {
    name: 'Innholdsprodusent (The Role Room)',
    price: '495 kr / mnd',
    reason: 'Storyboard + shotlists + post-prod-flyt. Designet for video-skapere.',
  },
  music_producer: {
    name: 'Innholdsprodusent (The Role Room)',
    price: '495 kr / mnd',
    reason: 'Session-planlegging + samarbeids-flyt. Bra for studio-producers.',
  },
  vendor: {
    name: 'CreatorHub Standard',
    price: 'Inkludert',
    reason: 'Som leverandør har du allerede ordrer + lager-styring inkludert.',
  },
};

const STEPS = ['Velkomst', 'Profesjon', 'Brand', 'Marketplace', 'Backup', 'B2 Cloud', 'Ferdig'] as const;

const B2_REGION_OPTIONS = [
  { value: 'us-west-001', label: 'US West (us-west-001)' },
  { value: 'us-east-005', label: 'US East (us-east-005)' },
  { value: 'eu-central-003', label: 'EU Central (eu-central-003)' },
];

const BACKBLAZE_SIGNUP_URL = 'https://www.backblaze.com/cloud-storage';

const DRAFT_KEY = 'individual-onboarding-draft';
const PENDING_SAVE_KEY = 'individual-onboarding-pending-save';
const MAX_SAVE_ATTEMPTS = 3;
const BACKOFF_MS = [0, 1500, 3500];

interface DraftData {
  firstName?: string;
  businessName?: string;
  profession?: string;
  brandColor?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const persistWithRetry = async (
  payload: DraftData,
  attempts: number = MAX_SAVE_ATTEMPTS,
): Promise<void> => {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (BACKOFF_MS[i] > 0) await sleep(BACKOFF_MS[i]);
    try {
      await apiRequest('/api/branding/business-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Lagring feilet etter flere forsøk');
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialProfession?: string;
  ownerEmail?: string;
  onComplete?: (data: { profession: string; businessName: string }) => void;
}

const IndividualOnboardingWizard: React.FC<Props> = ({
  open, onClose, initialProfession, ownerEmail, onComplete,
}) => {
  const queryClient = useQueryClient();

  const initialDraft: DraftData = (() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as DraftData) : {};
    } catch {
      return {};
    }
  })();

  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(initialDraft.firstName || '');
  const [businessName, setBusinessName] = useState(initialDraft.businessName || '');
  const [profession, setProfession] = useState(
    initialDraft.profession || initialProfession || 'photographer',
  );
  const [brandColor, setBrandColor] = useState(() => {
    if (initialDraft.brandColor) return initialDraft.brandColor;
    const found = PROFESSIONS.find((p) => p.id === (initialProfession || 'photographer'));
    return found?.color || '#ffba6c';
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resumingFromPending, setResumingFromPending] = useState(false);
  const flushedPendingRef = useRef(false);

  // ─── B2 Cloud Storage (steg 5) ────────────────────────────────────
  // Brukerne KJØPER egen Backblaze-avtale; vi lagrer kun deres
  // credentials kryptert i `user_b2_credentials`-tabellen. Admin's
  // bucket eksponeres ALDRI til vanlige brukere.
  const [b2KeyId, setB2KeyId] = useState('');
  const [b2AppKey, setB2AppKey] = useState('');
  const [b2BucketName, setB2BucketName] = useState('');
  const [b2Region, setB2Region] = useState('us-west-001');
  const [b2Saving, setB2Saving] = useState(false);
  const [b2Testing, setB2Testing] = useState(false);
  const [b2Status, setB2Status] = useState<
    | { kind: 'idle' }
    | { kind: 'saved'; isVerified: boolean; verifyError: string | null }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const activeProfession = PROFESSIONS.find((p) => p.id === profession) || PROFESSIONS[0];
  const recommendedTier = TIER_RECOMMENDATIONS[profession] || TIER_RECOMMENDATIONS.photographer;

  // Auto-persist draft til localStorage så data ikke mistes om bruker lukker fanen
  useEffect(() => {
    if (!open) return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ firstName, businessName, profession, brandColor }),
      );
    } catch {}
  }, [open, firstName, businessName, profession, brandColor]);

  // På mount: hvis det finnes pending save fra forrige forsøk, prøv å flushe den
  useEffect(() => {
    if (!open || flushedPendingRef.current) return;
    flushedPendingRef.current = true;
    let cancelled = false;
    (async () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(PENDING_SAVE_KEY);
      } catch {}
      if (!raw) return;
      try {
        const pending = JSON.parse(raw) as DraftData;
        setResumingFromPending(true);
        await persistWithRetry(pending);
        if (cancelled) return;
        try {
          window.localStorage.removeItem(PENDING_SAVE_KEY);
        } catch {}
        queryClient.invalidateQueries({ queryKey: ['/api/branding/business-info'] });
      } catch {
        // beholdes for neste forsøk
      } finally {
        if (!cancelled) setResumingFromPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, queryClient]);

  const canProceed = (() => {
    if (step === 0) return firstName.trim().length > 0;
    if (step === 1) return !!profession;
    return true;
  })();

  const handleFinish = async () => {
    setSaveError(null);
    setSaving(true);
    const payload: DraftData = { firstName, businessName, profession, brandColor };
    try {
      await persistWithRetry(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukjent feil';
      try {
        window.localStorage.setItem(
          PENDING_SAVE_KEY,
          JSON.stringify({ ...payload, savedAt: new Date().toISOString() }),
        );
      } catch {}
      setSaveError(
        `Kunne ikke lagre bedriftsinfo (${message}). Vi har lagret det lokalt og forsøker igjen automatisk neste gang. Prøv på nytt nå hvis du vil.`,
      );
      setSaving(false);
      return;
    }
    try {
      window.localStorage.setItem('individual-onboarding-completed', '1');
      window.localStorage.removeItem(DRAFT_KEY);
      window.localStorage.removeItem(PENDING_SAVE_KEY);
    } catch {}
    queryClient.invalidateQueries({ queryKey: ['/api/branding/business-info'] });
    setSaving(false);
    onComplete?.({ profession, businessName });
    onClose();
  };

  // Når profesjon endres, oppdater brand-farge automatisk
  const handleProfessionChange = (id: string) => {
    setProfession(id);
    const p = PROFESSIONS.find((x) => x.id === id);
    if (p) setBrandColor(p.color);
  };

  // ─── B2 Cloud Storage handlers ────────────────────────────────────
  const b2CanSave =
    b2KeyId.trim().length >= 8 &&
    b2AppKey.trim().length >= 16 &&
    b2BucketName.trim().length > 0;

  const handleB2Save = async () => {
    if (!b2CanSave) return;
    setB2Saving(true);
    setB2Status({ kind: 'idle' });
    try {
      const response = await apiRequest('/api/user/b2-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: b2KeyId.trim(),
          appKey: b2AppKey.trim(),
          bucketName: b2BucketName.trim(),
          region: b2Region,
        }),
      });
      const payload = await (response.json?.() ?? Promise.resolve({}));
      if (!payload?.success) {
        setB2Status({ kind: 'error', message: payload?.message || payload?.error || 'Lagring feilet' });
      } else {
        setB2Status({
          kind: 'saved',
          isVerified: !!payload.isVerified,
          verifyError: payload.verifyError ?? null,
        });
        // Tøm key-felter umiddelbart fra UI-state — vi har dem ikke i klartekst lenger
        setB2KeyId('');
        setB2AppKey('');
      }
    } catch (err) {
      setB2Status({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Ukjent feil ved lagring',
      });
    } finally {
      setB2Saving(false);
    }
  };

  const handleB2Verify = async () => {
    setB2Testing(true);
    try {
      const response = await apiRequest('/api/user/b2-credentials/verify', {
        method: 'POST',
      });
      const payload = await (response.json?.() ?? Promise.resolve({}));
      if (payload?.success) {
        setB2Status({ kind: 'saved', isVerified: true, verifyError: null });
      } else {
        setB2Status({
          kind: 'saved',
          isVerified: false,
          verifyError: payload?.error || 'Verifisering feilet',
        });
      }
    } catch (err) {
      setB2Status({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Ukjent feil ved verifisering',
      });
    } finally {
      setB2Testing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: `radial-gradient(circle at top, ${alpha(brandColor, 0.10)} 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)`,
          color: '#fff5e8',
          border: `1px solid ${alpha(brandColor, 0.18)}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          minHeight: '72vh',
          '& .MuiInputLabel-root': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiInputLabel-root.Mui-focused': { color: brandColor },
          '& .MuiOutlinedInput-root': {
            color: '#fff5e8',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
            '&:hover fieldset': { borderColor: alpha(brandColor, 0.4) },
            '&.Mui-focused fieldset': { borderColor: brandColor },
          },
          '& .MuiStepLabel-label': { color: 'rgba(246,242,234,0.62)' },
          '& .MuiStepLabel-label.Mui-active': { color: brandColor, fontWeight: 700 },
          '& .MuiStepLabel-label.Mui-completed': { color: '#fff5e8' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, pt: 3, pb: 2,
        background: `linear-gradient(135deg, ${alpha(brandColor, 0.16)}, ${alpha(brandColor, 0.02)})`,
        borderBottom: `1px solid ${alpha(brandColor, 0.18)}`,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: alpha(brandColor, 0.18), color: brandColor }}>
              <WelcomeIcon />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: brandColor, letterSpacing: '0.18em' }}>
                Velkomst
              </Typography>
              <Typography variant="h5" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 }}>
                Sett opp CreatorHub
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(246,242,234,0.72)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label, i) => (
            <Step key={label}>
              <StepLabel StepIconComponent={({ active, completed }) => {
                // One icon per STEPS entry: Velkomst, Profesjon, Brand,
                // Marketplace, Backup, Cloud Storage, Ferdig (7 steg).
                // Defensiv || DoneIcon-fallback hindrer "Element type is
                // invalid"-krasj hvis STEPS skulle vokse uten matching ikon.
                const Icon = [WelcomeIcon, PersonIcon, PaletteIcon, StoreIcon, BackupIcon, CloudIcon, DoneIcon][i] || DoneIcon;
                return (
                  <Box sx={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: active || completed ? brandColor : 'rgba(255,255,255,0.10)',
                    color: active || completed ? '#150d05' : 'rgba(246,242,234,0.5)',
                    transition: 'all 0.3s',
                  }}>
                    <Icon fontSize="small" />
                  </Box>
                );
              }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* STEG 1: Velkomst */}
        {step === 0 && (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif', mb: 1 }}>
                Velkommen til CreatorHub
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(246,242,234,0.72)', maxWidth: 500, mx: 'auto' }}>
                Vi bruker 2 minutter på å sette opp profilen din slik at alt er klart når du logger inn første gang.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Hva heter du?" required autoFocus fullWidth
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Fornavn"
              />
              <TextField
                label="Firmanavn (valgfri)" fullWidth
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="F.eks. Lysverkene Foto"
              />
            </Stack>
            {ownerEmail && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                  Konto: <strong style={{ color: '#fff5e8' }}>{ownerEmail}</strong>
                </Typography>
              </Box>
            )}
          </Stack>
        )}

        {/* STEG 2: Profesjon */}
        {step === 1 && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Hva slags arbeid gjør du?</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                Vi tilpasser CreatorHub basert på dette — kan endres senere i innstillinger.
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
              {PROFESSIONS.map((p) => {
                const active = profession === p.id;
                return (
                  <Card
                    key={p.id}
                    onClick={() => handleProfessionChange(p.id)}
                    sx={{
                      p: 2, cursor: 'pointer',
                      bgcolor: active ? alpha(p.color, 0.18) : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${active ? p.color : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 2, boxShadow: 'none',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: p.color, transform: 'translateY(-2px)' },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Avatar sx={{ bgcolor: alpha(p.color, 0.18), color: p.color }}>
                        {p.icon}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: active ? p.color : '#fff5e8' }}>
                          {p.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                          {p.tagline}
                        </Typography>
                      </Box>
                      {active && <DoneIcon sx={{ color: p.color }} />}
                    </Stack>
                  </Card>
                );
              })}
            </Box>
          </Stack>
        )}

        {/* STEG 3: Brand */}
        {step === 2 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Velg din brand-farge</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                Brukes som accent-farge i dashboardet, knapper, gradients osv.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {PROFESSIONS.map((p) => (
                <Box
                  key={p.color}
                  onClick={() => setBrandColor(p.color)}
                  sx={{
                    width: 64, height: 64, borderRadius: 2, cursor: 'pointer',
                    bgcolor: p.color,
                    border: `3px solid ${brandColor === p.color ? '#fff5e8' : 'transparent'}`,
                    transition: 'all 0.2s',
                    boxShadow: brandColor === p.color ? `0 0 0 4px ${alpha(p.color, 0.3)}` : 'none',
                    '&:hover': { transform: 'scale(1.05)' },
                  }}
                />
              ))}
            </Stack>

            <TextField
              label="Eller egen hex-farge"
              size="small" sx={{ maxWidth: 240 }}
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              InputProps={{
                startAdornment: (
                  <Box sx={{
                    width: 24, height: 24, borderRadius: 1, mr: 1,
                    bgcolor: brandColor, border: '1px solid rgba(255,255,255,0.18)',
                  }} />
                ),
              }}
            />

            <Box sx={{
              p: 3, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(brandColor, 0.12)}, rgba(15,10,7,0.86))`,
              border: `1px solid ${alpha(brandColor, 0.32)}`,
            }}>
              <Typography variant="caption" sx={{ color: brandColor, letterSpacing: '0.1em', fontWeight: 700 }}>
                FORHÅNDSVISNING
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff5e8', fontFamily: '"Space Grotesk", sans-serif', mb: 1 }}>
                Velkommen tilbake, {firstName || 'Stine'}
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  sx={{
                    borderRadius: '999px', px: 2.5, py: 1,
                    bgcolor: brandColor, color: '#150d05',
                    fontWeight: 700, textTransform: 'none',
                    '&:hover': { bgcolor: alpha(brandColor, 0.88) },
                  }}
                >
                  Ny booking
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderRadius: '999px', px: 2.5, py: 1,
                    borderColor: alpha(brandColor, 0.32), color: '#fff5e8',
                    textTransform: 'none', fontWeight: 700,
                    '&:hover': { borderColor: brandColor, bgcolor: alpha(brandColor, 0.08) },
                  }}
                >
                  Se kalender
                </Button>
              </Stack>
            </Box>
          </Stack>
        )}

        {/* STEG 4: Marketplace-anbefaling */}
        {step === 3 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Anbefalt for deg
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                Basert på at du er {activeProfession.label.toLowerCase()} — du kan installere når som helst senere.
              </Typography>
            </Box>

            <Card sx={{
              p: 3,
              background: `linear-gradient(135deg, ${alpha(brandColor, 0.12)}, rgba(15,10,7,0.86))`,
              border: `2px solid ${brandColor}`,
              borderRadius: 3,
              boxShadow: 'none',
            }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: alpha(brandColor, 0.18), color: brandColor, width: 56, height: 56 }}>
                  <StoreIcon />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Chip
                    label="Anbefalt for deg"
                    size="small"
                    sx={{
                      bgcolor: brandColor, color: '#150d05',
                      fontWeight: 700, fontSize: '0.66rem', mb: 0.5,
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff5e8' }}>
                    {recommendedTier.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: brandColor, fontWeight: 700 }}>
                    {recommendedTier.price}
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: 'rgba(246,242,234,0.85)', mb: 2, lineHeight: 1.6 }}>
                {recommendedTier.reason}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)', fontStyle: 'italic' }}>
                Du kan installere fra Marketplace når du er klar — ingen forpliktelse nå.
              </Typography>
            </Card>
          </Stack>
        )}

        {/* STEG 5: Backup-provider (offsite) — valgfritt for alle profesjoner */}
        {step === 4 && (
          <Stack spacing={3}>
            <StorageProviderStep
              variant="wizard"
              onCompleted={() => setStep((s) => s + 1)}
              onSkip={() => setStep((s) => s + 1)}
            />
            <OneDeskDownloadCard />
          </Stack>
        )}

        {/* STEG 6: B2 Cloud Storage — bruker oppgir EGEN Backblaze-avtale */}
        {step === 5 && (
          <Stack spacing={3}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: alpha(brandColor, 0.18), color: brandColor, width: 40, height: 40 }}>
                  <CloudIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Eget skylagring (valgfritt)
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                    Lagre originalene direkte til DIN egen Backblaze B2-bucket
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: 'rgba(246,242,234,0.85)', lineHeight: 1.7, mt: 1 }}>
                CreatorHub anbefaler at du kobler din egen Backblaze B2-konto for å lagre originalene
                dine. Vi tar oss av leveransen til kundene, men du eier kopiene direkte. Pris:
                ca <strong>0.005 USD/GB/måned</strong> (40–50 NOK/TB). Du kan hoppe over dette nå
                og legge til senere i Innstillinger.
              </Typography>
              <Link
                href={BACKBLAZE_SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.5,
                  color: brandColor, textDecorationColor: alpha(brandColor, 0.5),
                  fontWeight: 600, fontSize: '0.875rem',
                }}
              >
                Lag konto hos Backblaze
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Link>
            </Box>

            <Stack spacing={2}>
              <TextField
                label="Key ID"
                fullWidth
                value={b2KeyId}
                onChange={(e) => setB2KeyId(e.target.value)}
                placeholder="K001abc…"
                disabled={b2Saving}
                InputProps={{ startAdornment: <StorageIcon sx={{ mr: 1, color: 'rgba(246,242,234,0.5)' }} /> }}
              />
              <TextField
                label="Application Key"
                type="password"
                fullWidth
                value={b2AppKey}
                onChange={(e) => setB2AppKey(e.target.value)}
                placeholder="K001…"
                disabled={b2Saving}
                autoComplete="new-password"
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Bucket-navn"
                  fullWidth
                  value={b2BucketName}
                  onChange={(e) => setB2BucketName(e.target.value)}
                  placeholder="creatorhub-mine-originaler"
                  disabled={b2Saving}
                />
                <TextField
                  label="Region"
                  select
                  fullWidth
                  SelectProps={{ native: true }}
                  value={b2Region}
                  onChange={(e) => setB2Region(e.target.value)}
                  disabled={b2Saving}
                  sx={{ maxWidth: { sm: 240 } }}
                >
                  {B2_REGION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: '#0a0807', color: '#fff5e8' }}>
                      {opt.label}
                    </option>
                  ))}
                </TextField>
              </Stack>
            </Stack>

            {/* Status-feedback */}
            {b2Status.kind === 'saved' && (
              <Box sx={{
                p: 2, borderRadius: 2,
                bgcolor: b2Status.isVerified ? 'rgba(16,185,129,0.10)' : 'rgba(255,186,108,0.10)',
                border: `1px solid ${b2Status.isVerified ? 'rgba(16,185,129,0.32)' : 'rgba(255,186,108,0.32)'}`,
              }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {b2Status.isVerified
                    ? <VerifiedIcon sx={{ color: '#10b981' }} />
                    : <ErrorIcon sx={{ color: '#ffba6c' }} />}
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {b2Status.isVerified
                      ? 'Credentials lagret og verifisert mot bucket'
                      : 'Credentials lagret, men test mot bucket feilet'}
                  </Typography>
                </Stack>
                {!b2Status.isVerified && b2Status.verifyError && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'rgba(246,242,234,0.72)' }}>
                    {b2Status.verifyError}
                  </Typography>
                )}
              </Box>
            )}
            {b2Status.kind === 'error' && (
              <Alert severity="error" onClose={() => setB2Status({ kind: 'idle' })}>
                {b2Status.message}
              </Alert>
            )}

            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button
                onClick={() => setStep((s) => s + 1)}
                sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}
              >
                Hopp over
              </Button>
              <Button
                variant="outlined"
                onClick={handleB2Verify}
                disabled={b2Testing || b2Status.kind !== 'saved'}
                startIcon={<VerifiedIcon />}
                sx={{
                  borderRadius: '999px', px: 2.5, textTransform: 'none',
                  borderColor: alpha(brandColor, 0.4), color: '#fff5e8',
                  '&:hover': { borderColor: brandColor, bgcolor: alpha(brandColor, 0.08) },
                }}
              >
                {b2Testing ? 'Tester…' : 'Test forbindelse'}
              </Button>
              <Button
                variant="contained"
                onClick={handleB2Save}
                disabled={!b2CanSave || b2Saving}
                sx={{
                  borderRadius: '999px', px: 2.5, textTransform: 'none', fontWeight: 700,
                  bgcolor: brandColor, color: '#150d05',
                  '&:hover': { bgcolor: alpha(brandColor, 0.88) },
                }}
              >
                {b2Saving ? 'Lagrer…' : 'Lagre'}
              </Button>
            </Stack>
          </Stack>
        )}

        {/* STEG 7: Ferdig */}
        {step === 6 && (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <DoneIcon sx={{ fontSize: 72, color: '#10b981', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>
                Alt klart, {firstName}!
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(246,242,234,0.72)', mt: 1, maxWidth: 500, mx: 'auto' }}>
                CreatorHub er nå satt opp som <strong>{activeProfession.label.toLowerCase()}</strong>
                {businessName && <> for <strong>{businessName}</strong></>}.
                Du blir tatt til dashboardet ditt.
              </Typography>
            </Box>

            <Box sx={{
              p: 2.5, borderRadius: 2,
              bgcolor: 'rgba(16,185,129,0.10)',
              border: '1px solid rgba(16,185,129,0.32)',
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#10b981', mb: 1 }}>
                Hva du kan gjøre nå:
              </Typography>
              <Stack spacing={0.75}>
                {[
                  'Opprette ditt første prosjekt',
                  'Legge til klient og sende første tilbud',
                  'Utforske marketplace for verktøy som passer deg',
                  'Invitere team-medlemmer hvis du vokser',
                ].map((text) => (
                  <Stack key={text} direction="row" spacing={1} alignItems="center">
                    <DoneIcon sx={{ fontSize: 16, color: '#10b981' }} />
                    <Typography variant="body2">{text}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      {resumingFromPending && (
        <Alert severity="info" sx={{ mx: 3, mb: 1 }}>
          Forsøker å lagre bedriftsinfo fra forrige forsøk…
        </Alert>
      )}

      {saveError && (
        <Alert
          severity="error"
          onClose={() => setSaveError(null)}
          sx={{ mx: 3, mb: 1 }}
        >
          {saveError}
        </Alert>
      )}

      <DialogActions sx={{
        px: 3, py: 2.5,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.02)',
        justifyContent: 'space-between',
      }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          sx={{ color: 'rgba(246,242,234,0.72)', textTransform: 'none' }}
        >
          Tilbake
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            endIcon={<NextIcon />}
            variant="contained"
            disabled={!canProceed}
            onClick={() => setStep((s) => s + 1)}
            sx={{
              borderRadius: '999px', px: 3, py: 1.1,
              fontWeight: 700, textTransform: 'none',
              bgcolor: brandColor, color: '#150d05',
              '&:hover': { bgcolor: alpha(brandColor, 0.88) },
              '&.Mui-disabled': { bgcolor: alpha(brandColor, 0.3), color: 'rgba(21,13,5,0.5)' },
            }}
          >
            Fortsett
          </Button>
        ) : (
          <Button
            endIcon={<DoneIcon />}
            variant="contained"
            disabled={saving}
            onClick={handleFinish}
            sx={{
              borderRadius: '999px', px: 3, py: 1.1,
              fontWeight: 700, textTransform: 'none',
              bgcolor: '#10b981', color: '#fff',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {saving ? 'Lagrer…' : 'Ta meg til dashboardet'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default IndividualOnboardingWizard;
