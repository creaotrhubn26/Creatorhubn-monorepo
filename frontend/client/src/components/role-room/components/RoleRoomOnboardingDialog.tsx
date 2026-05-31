/**
 * RoleRoomOnboardingDialog — sentral første-gangs-onboarding for alle
 * Role Room-medlemmer. Bygger profil stegvis og lagrer per steg.
 *
 * Trigger-flow:
 *   1. Bruker logger inn / går til Role Room
 *   2. Parent-komponent (RoleRoomDashboardPanel) sjekker
 *      roleRoomMemberProfileService.getOnboardingStatus()
 *   3. Hvis requiresOnboarding=true → mount denne dialogen
 *   4. Bruker kan ikke dismisse uten å fullføre (kun "minimer" som lagrer
 *      progress for senere)
 *
 * 6 steg:
 *   0. Velkommen + navn
 *   1. Profilbilde
 *   2. Profesjon + ferdigheter
 *   3. Bio + lokasjon
 *   4. Lenker (web/sosial)
 *   5. Personvern + fullfør
 */

import React, { useEffect, useState } from 'react';
import {
  Avatar, Box, Button, Chip, Dialog, DialogContent, IconButton,
  LinearProgress, MenuItem, Select, Stack, TextField, Typography,
  CircularProgress, FormControl, InputLabel,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, Check, Close, CloudUpload, Person,
} from '@mui/icons-material';
import { roleRoomMemberProfileService } from '../services/roleRoomMemberProfileService';
import type { RoleRoomMemberProfile, ProfileVisibility, OnboardingConfig } from '../services/roleRoomMemberProfileService';

export interface RoleRoomOnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
  /** Lar bruker minimere — lagrer progress men holder onboarding-flag aktivt. */
  onMinimize?: () => void;
  /** 'edit' lar bruker lukke og redigere fritt; setter ikke onboarding-completed. */
  mode?: 'onboarding' | 'edit';
  /** Lukk uten å fullføre (kun edit-modus). */
  onClose?: () => void;
}

interface FormState {
  displayName: string;
  professions: string[];
  companyName: string;
  bio: string;
  locationCity: string;
  locationCountry: string;
  website: string;
  socialLinks: Record<string, string>;
  showreelUrl: string;
  skills: string[];
  languages: string[];
  visibility: ProfileVisibility;
}

const DEFAULT_CONFIG: OnboardingConfig = {
  welcomeMessage: 'Velkommen til The Role Room. La oss bygge profilen din slik at andre medlemmer kan finne deg og du kan vise hva du gjør.',
  professionsOptions: [
    'Fotograf', 'Videograf', 'Editor', 'Colorist', 'Sound Designer',
    'Producer', 'Director', 'DOP', 'Skuespiller', 'Modell',
    'Brudefotograf', 'Bryllups-editor', 'Dancer', 'Choreograph',
    'Makeup-artist', 'Stylist', 'Annet',
  ],
  skillsOptions: [
    'Color Grading', 'Multi-cam editing', 'Live event', 'Wedding cinematography',
    'Documentary', 'Music video', 'Corporate film', 'Audio mixing',
    'Drone (DJI)', 'Lighting', 'Motion graphics', 'VFX',
    'DaVinci Resolve', 'Premiere Pro', 'Final Cut Pro', 'After Effects',
  ],
  languageOptions: [
    { code: 'no', name: 'Norsk' },
    { code: 'sv', name: 'Svenska' },
    { code: 'da', name: 'Dansk' },
    { code: 'en', name: 'English' },
  ],
  stepsEnabled: { welcome: true, image: true, profession: true, about: true, links: true, privacy: true },
  requiredFields: { displayName: true, professions: true, bio: false, profileImage: false },
};

const STEP_KEYS = ['welcome', 'image', 'profession', 'about', 'links', 'privacy'] as const;
type StepKey = typeof STEP_KEYS[number];

const STEP_LABELS: Record<StepKey, string> = {
  welcome: 'Velkommen',
  image: 'Profilbilde',
  profession: 'Profesjon',
  about: 'Om meg',
  links: 'Lenker',
  privacy: 'Personvern',
};

const EMPTY_FORM: FormState = {
  displayName: '',
  professions: [],
  companyName: '',
  bio: '',
  locationCity: '',
  locationCountry: 'Norge',
  website: '',
  socialLinks: {},
  showreelUrl: '',
  skills: [],
  languages: ['no'],
  visibility: 'connections',
};

function profileToForm(profile: RoleRoomMemberProfile): FormState {
  return {
    displayName: profile.displayName ?? '',
    professions: profile.professions ?? [],
    companyName: profile.companyName ?? '',
    bio: profile.bio ?? '',
    locationCity: profile.locationCity ?? '',
    locationCountry: profile.locationCountry ?? 'Norge',
    website: profile.website ?? '',
    socialLinks: profile.socialLinks ?? {},
    showreelUrl: profile.showreelUrl ?? '',
    skills: profile.skills ?? [],
    languages: profile.languages?.length ? profile.languages : ['no'],
    visibility: profile.visibility ?? 'connections',
  };
}

export const RoleRoomOnboardingDialog: React.FC<RoleRoomOnboardingDialogProps> = ({
  open, onComplete, onMinimize, mode = 'onboarding', onClose,
}) => {
  const isEditMode = mode === 'edit';
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OnboardingConfig>(DEFAULT_CONFIG);

  // Aktive steg (filtrert av admin-config)
  const activeSteps: StepKey[] = STEP_KEYS.filter(
    (k) => config.stepsEnabled?.[k] !== false,
  );
  const totalSteps = activeSteps.length || 1;
  const currentKey: StepKey = activeSteps[step] ?? 'welcome';

  // Last eksisterende profil + onboarding-config ved mount
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [profile, loadedConfig] = await Promise.all([
          roleRoomMemberProfileService.getMyProfile(),
          roleRoomMemberProfileService
            .getOnboardingConfig()
            .catch(() => DEFAULT_CONFIG),
        ]);
        if (cancelled) return;
        setConfig({ ...DEFAULT_CONFIG, ...loadedConfig });
        setForm(profileToForm(profile));
        setProfileImage(profile.profileImageUrl);
        const progress = (profile.onboardingProgress || {}) as { currentStep?: number };
        if (typeof progress.currentStep === 'number') {
          const enabledCount = STEP_KEYS.filter(
            (k) => loadedConfig.stepsEnabled?.[k] !== false,
          ).length || 1;
          setStep(Math.min(progress.currentStep, enabledCount - 1));
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const saveStep = async (nextStep: number, partial?: Partial<FormState>) => {
    setSaving(true);
    setError(null);
    try {
      // Filtre tomme felter slik at vi ikke null'er ut eksisterende
      const updates: Record<string, unknown> = {};
      const merged = { ...form, ...(partial ?? {}) };
      for (const [k, v] of Object.entries(merged)) {
        if (v === '' || v === null || (Array.isArray(v) && v.length === 0)) continue;
        updates[k] = v;
      }
      if (Object.keys(updates).length > 0) {
        await roleRoomMemberProfileService.updateMyProfile(updates as Partial<RoleRoomMemberProfile>);
      }
      await roleRoomMemberProfileService.updateOnboarding({
        progress: { currentStep: nextStep, completedSteps: Array.from({ length: nextStep }, (_, i) => i) },
      });
      setStep(nextStep);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === '' || v === null || (Array.isArray(v) && v.length === 0)) continue;
        updates[k] = v;
      }
      if (Object.keys(updates).length > 0) {
        await roleRoomMemberProfileService.updateMyProfile(updates as Partial<RoleRoomMemberProfile>);
      }
      if (!isEditMode) {
        await roleRoomMemberProfileService.updateOnboarding({ complete: true });
      }
      onComplete();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const url = await roleRoomMemberProfileService.uploadProfileImage(file);
      setProfileImage(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingImage(false);
    }
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: 'professions' | 'skills' | 'languages', item: string) => {
    setForm((prev) => {
      const current = prev[field];
      const next = current.includes(item)
        ? current.filter((x) => x !== item)
        : [...current, item];
      return { ...prev, [field]: next };
    });
  };

  const isLastStep = step === totalSteps - 1;
  const canProgressFromCurrent = (): boolean => {
    if (currentKey === 'welcome') {
      return config.requiredFields?.displayName === false
        || form.displayName.trim().length >= 2;
    }
    if (currentKey === 'image') {
      return config.requiredFields?.profileImage !== true || !!profileImage;
    }
    if (currentKey === 'profession') {
      return config.requiredFields?.professions === false
        || form.professions.length > 0;
    }
    if (currentKey === 'about') {
      return config.requiredFields?.bio !== true || form.bio.trim().length > 0;
    }
    return true;
  };

  return (
    <Dialog open={open} fullWidth maxWidth="sm"
            disableEscapeKeyDown={!isEditMode}
            onClose={isEditMode ? onClose : undefined}
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ position: 'relative' }}>
        {(isEditMode ? onClose : onMinimize) && (
          <IconButton onClick={isEditMode ? onClose : onMinimize}
                       sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, color: 'white' }}
                       size="small">
            <Close fontSize="small" />
          </IconButton>
        )}

        <Box sx={{ p: 3, pb: 1, background: 'linear-gradient(135deg, #1e1a2e, #2d1b4e)' }}>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
            Steg {step + 1} av {totalSteps}
          </Typography>
          <Typography variant="h5" sx={{ color: 'white', mt: 0.5, fontWeight: 600 }}>
            {STEP_LABELS[currentKey]}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((step + 1) / totalSteps) * 100}
            sx={{ mt: 2, height: 4, borderRadius: 2,
                   '& .MuiLinearProgress-bar': { backgroundColor: '#a030c0' } }}
          />
        </Box>

        <DialogContent sx={{ p: 3, minHeight: 320 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && currentKey === 'welcome' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {config.welcomeMessage}
              </Typography>
              <TextField label="Visningsnavn" required={config.requiredFields?.displayName !== false} autoFocus
                          value={form.displayName}
                          onChange={(e) => updateField('displayName', e.target.value)}
                          helperText="Slik vises navnet ditt for andre" />
              <TextField label="Bedrift / studio (valgfri)"
                          value={form.companyName}
                          onChange={(e) => updateField('companyName', e.target.value)} />
            </Stack>
          )}

          {!loading && currentKey === 'image' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
              <Avatar src={profileImage ?? undefined}
                       sx={{ width: 120, height: 120, fontSize: 48,
                              bgcolor: 'rgba(160, 48, 192, 0.2)' }}>
                {profileImage ? null : <Person sx={{ fontSize: 60 }} />}
              </Avatar>
              <Button variant="outlined" component="label"
                       disabled={uploadingImage}
                       startIcon={uploadingImage ? <CircularProgress size={16} /> : <CloudUpload />}>
                {profileImage ? 'Endre bilde' : 'Last opp bilde'}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }} />
              </Button>
              <Typography variant="caption" color="text.secondary" align="center">
                JPG, PNG, WebP eller GIF · maks 4 MB
              </Typography>
              {!profileImage && (
                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 2 }}>
                  Du kan hoppe over dette nå og legge til bilde senere.
                </Typography>
              )}
            </Stack>
          )}

          {!loading && currentKey === 'profession' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Hvilken rolle har du? Velg én eller flere.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {config.professionsOptions.map((p) => (
                  <Chip key={p} label={p} clickable
                         color={form.professions.includes(p) ? 'primary' : 'default'}
                         variant={form.professions.includes(p) ? 'filled' : 'outlined'}
                         onClick={() => toggleArrayItem('professions', p)} />
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Ferdigheter (valgfri)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {config.skillsOptions.map((s) => (
                  <Chip key={s} label={s} clickable size="small"
                         color={form.skills.includes(s) ? 'secondary' : 'default'}
                         variant={form.skills.includes(s) ? 'filled' : 'outlined'}
                         onClick={() => toggleArrayItem('skills', s)} />
                ))}
              </Box>
            </Stack>
          )}

          {!loading && currentKey === 'about' && (
            <Stack spacing={2}>
              <TextField label="Om meg" multiline rows={4}
                          value={form.bio}
                          onChange={(e) => updateField('bio', e.target.value)}
                          placeholder="Skriv litt om hva du gjør, stil, erfaring …"
                          helperText="Synlig for andre medlemmer" />
              <Stack direction="row" spacing={1}>
                <TextField label="By" fullWidth
                            value={form.locationCity}
                            onChange={(e) => updateField('locationCity', e.target.value)} />
                <TextField label="Land" fullWidth
                            value={form.locationCountry}
                            onChange={(e) => updateField('locationCountry', e.target.value)} />
              </Stack>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Språk
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {config.languageOptions.map((lang) => (
                    <Chip key={lang.code} label={lang.name} clickable size="small"
                           color={form.languages.includes(lang.code) ? 'primary' : 'default'}
                           variant={form.languages.includes(lang.code) ? 'filled' : 'outlined'}
                           onClick={() => toggleArrayItem('languages', lang.code)} />
                  ))}
                </Box>
              </Box>
            </Stack>
          )}

          {!loading && currentKey === 'links' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Legg til lenker til portefølje og sosiale medier (alt valgfritt).
              </Typography>
              <TextField label="Nettside"
                          value={form.website}
                          onChange={(e) => updateField('website', e.target.value)}
                          placeholder="https://…" />
              <TextField label="Showreel (Vimeo, YouTube …)"
                          value={form.showreelUrl}
                          onChange={(e) => updateField('showreelUrl', e.target.value)}
                          placeholder="https://vimeo.com/…" />
              <TextField label="Instagram"
                          value={form.socialLinks.instagram ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, instagram: e.target.value })}
                          placeholder="@brukernavn" />
              <TextField label="LinkedIn"
                          value={form.socialLinks.linkedin ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, linkedin: e.target.value })}
                          placeholder="https://linkedin.com/in/…" />
            </Stack>
          )}

          {!loading && currentKey === 'privacy' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Hvem skal kunne se profilen din?
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Synlighet</InputLabel>
                <Select label="Synlighet"
                         value={form.visibility}
                         onChange={(e) => updateField('visibility', e.target.value as ProfileVisibility)}>
                  <MenuItem value="public">Offentlig — synlig for alle (også uten konto)</MenuItem>
                  <MenuItem value="connections">Innloggede medlemmer — anbefalt</MenuItem>
                  <MenuItem value="private">Privat — bare jeg ser den</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                Du kan endre dette når som helst senere i Innstillinger.
              </Typography>
              <Box sx={{ background: 'rgba(160, 48, 192, 0.08)', p: 2, borderRadius: 2, mt: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Oppsummering
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  <strong>{form.displayName || '(uten navn)'}</strong>
                  {form.companyName && ` · ${form.companyName}`}
                  <br />
                  {form.professions.length > 0 && (
                    <>Rolle: {form.professions.join(', ')}<br /></>
                  )}
                  {form.skills.length > 0 && (
                    <>Ferdigheter: {form.skills.length}<br /></>
                  )}
                  {(form.locationCity || form.locationCountry) && (
                    <>{[form.locationCity, form.locationCountry].filter(Boolean).join(', ')}<br /></>
                  )}
                </Typography>
              </Box>
            </Stack>
          )}

          {error && (
            <Box sx={{ mt: 2, background: 'rgba(239, 79, 111, 0.10)',
                        borderLeft: '3px solid #ef4f6f', p: 1.5, borderRadius: 1 }}>
              <Typography variant="caption" color="error">{error}</Typography>
            </Box>
          )}
        </DialogContent>

        <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          {step > 0 ? (
            <Button onClick={() => setStep((s) => s - 1)} disabled={saving}
                     startIcon={<ArrowBack />}>
              Tilbake
            </Button>
          ) : <Box />}
          {isLastStep ? (
            <Button onClick={finishOnboarding} disabled={saving || loading}
                     variant="contained" endIcon={saving ? <CircularProgress size={14} /> : <Check />}>
              {isEditMode ? 'Lagre endringer' : 'Fullfør profil'}
            </Button>
          ) : (
            <Button onClick={() => void saveStep(step + 1)}
                     disabled={!canProgressFromCurrent() || saving || loading}
                     variant="contained" endIcon={saving ? <CircularProgress size={14} /> : <ArrowForward />}>
              Neste
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default RoleRoomOnboardingDialog;
