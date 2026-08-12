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

import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../../../i18n';
import {
  Autocomplete, Avatar, Box, Button, Chip, Dialog, DialogContent, IconButton,
  LinearProgress, MenuItem, Select, Stack, TextField, Typography,
  CircularProgress, FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, Check, Close, CloudUpload, Person, Business,
  Add, DeleteOutline,
} from '@mui/icons-material';
import { roleRoomMemberProfileService } from '../services/roleRoomMemberProfileService';
import type {
  RoleRoomMemberProfile, ProfileVisibility, OnboardingConfig, EarlierProject,
  PortfolioItem, MemberReference, AvailabilityStatus,
} from '../services/roleRoomMemberProfileService';
import {
  EQUIPMENT_CATALOG, EQUIPMENT_CATEGORY_LABELS, categoryForEquipment,
  type EquipmentCatalogItem,
} from '../utils/equipmentCatalog';
import { EquipmentCategoryIcon } from './EquipmentCategoryIcon';
import {
  searchBrregCompanies, toBrregSelection, type BrregCompany,
} from '../utils/brregLookup';
import { AvatarFocalPointEditor } from './AvatarFocalPointEditor';
import { focalToObjectPosition } from '../utils/avatarFocalPoint';
import { AvailabilityCalendar } from './AvailabilityCalendar';

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
  organizationNumber: string;
  businessAddress: string;
  bio: string;
  locationCity: string;
  locationCountry: string;
  website: string;
  socialLinks: Record<string, string>;
  showreelUrl: string;
  skills: string[];
  languages: string[];
  visibility: ProfileVisibility;
  yearsExperience: number | null;
  earlierProjects: EarlierProject[];
  portfolioItems: PortfolioItem[];
  availabilityStatus: AvailabilityStatus | '';
  workPreferences: string[];
  equipment: string[];
  certifications: string[];
  memberReferences: MemberReference[];
  expertiseAreas: string[];
  profileImageFocalX: number | null;
  profileImageFocalY: number | null;
}

const DEFAULT_CONFIG: OnboardingConfig = {
  welcomeMessage: 'Velkommen til The Role Room. La oss bygge profilen din slik at andre medlemmer kan finne deg og du kan vise hva du gjør.',
  professionsOptions: [
    'Prosjektleder', 'Produsent', 'Regissør', 'Fotograf', 'Videograf', 'Editor',
    'Colorist', 'Sound Designer', 'Producer', 'Director', 'DOP', 'Skuespiller',
    'Modell', 'Brudefotograf', 'Bryllups-editor', 'Dancer', 'Choreograph',
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
  stepsEnabled: { welcome: true, image: true, profession: true, about: true, links: true, availability: true, privacy: true },
  requiredFields: { displayName: true, professions: true, bio: false, profileImage: true },
};

const STEP_KEYS = ['welcome', 'image', 'profession', 'about', 'links', 'availability', 'privacy'] as const;
type StepKey = typeof STEP_KEYS[number];

// Step labels, bio prompts, work preferences, expertise areas og availability-
// options er språkavhengige — bygges som t()-maps inne i komponenten (se
// stepLabels/bioPrompts/workPreferenceOptions/expertiseAreaOptions/availabilityOptions).

const EMPTY_FORM: FormState = {
  displayName: '',
  professions: [],
  companyName: '',
  organizationNumber: '',
  businessAddress: '',
  bio: '',
  locationCity: '',
  locationCountry: 'Norge',
  website: '',
  socialLinks: {},
  showreelUrl: '',
  skills: [],
  languages: ['no'],
  visibility: 'connections',
  yearsExperience: null,
  earlierProjects: [],
  portfolioItems: [],
  availabilityStatus: '',
  workPreferences: [],
  equipment: [],
  certifications: [],
  memberReferences: [],
  expertiseAreas: [],
  profileImageFocalX: null,
  profileImageFocalY: null,
};

function profileToForm(profile: RoleRoomMemberProfile): FormState {
  return {
    displayName: profile.displayName ?? '',
    professions: profile.professions ?? [],
    companyName: profile.companyName ?? '',
    organizationNumber: profile.organizationNumber ?? '',
    businessAddress: profile.businessAddress ?? '',
    bio: profile.bio ?? '',
    locationCity: profile.locationCity ?? '',
    locationCountry: profile.locationCountry ?? 'Norge',
    website: profile.website ?? '',
    socialLinks: profile.socialLinks ?? {},
    showreelUrl: profile.showreelUrl ?? '',
    skills: profile.skills ?? [],
    languages: profile.languages?.length ? profile.languages : ['no'],
    visibility: profile.visibility ?? 'connections',
    yearsExperience: profile.yearsExperience ?? null,
    earlierProjects: profile.earlierProjects ?? [],
    portfolioItems: profile.portfolioItems ?? [],
    availabilityStatus: profile.availabilityStatus ?? '',
    workPreferences: profile.workPreferences ?? [],
    equipment: profile.equipment ?? [],
    certifications: profile.certifications ?? [],
    memberReferences: profile.memberReferences ?? [],
    expertiseAreas: profile.expertiseAreas ?? [],
    profileImageFocalX: profile.profileImageFocalX ?? null,
    profileImageFocalY: profile.profileImageFocalY ?? null,
  };
}

export const RoleRoomOnboardingDialog: React.FC<RoleRoomOnboardingDialogProps> = ({
  open, onComplete, onMinimize, mode = 'onboarding', onClose,
}) => {
  const { t } = useT();
  const isEditMode = mode === 'edit';
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<OnboardingConfig>(DEFAULT_CONFIG);
  // Brønnøysund firma-søk (samme mønster som hovedflyten)
  const [brregQuery, setBrregQuery] = useState('');
  const [brregOptions, setBrregOptions] = useState<BrregCompany[]>([]);
  const [brregLoading, setBrregLoading] = useState(false);
  const [certInput, setCertInput] = useState('');

  const stepLabels: Record<StepKey, string> = useMemo(() => ({
    welcome: t('rrOnboard.step.welcome'),
    image: t('rrOnboard.step.image'),
    profession: t('rrOnboard.step.profession'),
    about: t('rrOnboard.aboutMe'),
    links: t('rrOnboard.step.links'),
    availability: t('rrOnboard.step.availability'),
    privacy: t('rrOnboard.step.privacy'),
  }), [t]);

  // Starter-avsnitt for «Om meg» — hjelper brukeren i gang med å skrive.
  const bioPrompts: Array<{ label: string; template: string }> = useMemo(() => [
    { label: t('rrOnboard.bioPrompt.whatIDo.label'), template: t('rrOnboard.bioPrompt.whatIDo.template') },
    { label: t('rrOnboard.bioPrompt.experience.label'), template: t('rrOnboard.bioPrompt.experience.template') },
    { label: t('rrOnboard.bioPrompt.style.label'), template: t('rrOnboard.bioPrompt.style.template') },
    { label: t('rrOnboard.bioPrompt.equipment.label'), template: t('rrOnboard.bioPrompt.equipment.template') },
    { label: t('rrOnboard.bioPrompt.lookingFor.label'), template: t('rrOnboard.bioPrompt.lookingFor.template') },
  ], [t]);

  const workPreferenceOptions: string[] = useMemo(() => [
    t('rrOnboard.workPref.available'), t('rrOnboard.workPref.freelance'),
    t('rrOnboard.workPref.fullTime'), t('rrOnboard.workPref.onSet'),
    t('rrOnboard.workPref.remote'), t('rrOnboard.workPref.canTravel'),
    t('rrOnboard.workPref.shortTerm'), t('rrOnboard.workPref.longTerm'),
  ], [t]);

  // Fagområder / spesialiseringer for foto/video- OG film/TV-bransjen.
  const expertiseAreaOptions: string[] = useMemo(() => [
    // Film & TV
    t('rrOnboard.expertise.featureFilm'), t('rrOnboard.expertise.shortFilm'),
    t('rrOnboard.expertise.tvSeries'), t('rrOnboard.expertise.tvDrama'),
    t('rrOnboard.expertise.tvProduction'), t('rrOnboard.expertise.commercial'),
    t('rrOnboard.expertise.documentary'), t('rrOnboard.expertise.streaming'),
    t('rrOnboard.expertise.entertainment'), t('rrOnboard.expertise.news'),
    t('rrOnboard.expertise.kidsTv'), t('rrOnboard.expertise.reality'),
    // Foto / video / kommersielt
    t('rrOnboard.expertise.wedding'), t('rrOnboard.expertise.musicVideo'),
    t('rrOnboard.expertise.advertising'), t('rrOnboard.expertise.corporate'),
    t('rrOnboard.expertise.event'), t('rrOnboard.expertise.portrait'),
    t('rrOnboard.expertise.fashion'), t('rrOnboard.expertise.product'),
    t('rrOnboard.expertise.socialMedia'), t('rrOnboard.expertise.drone'),
    t('rrOnboard.expertise.liveProduction'), t('rrOnboard.expertise.podcast'),
    t('rrOnboard.expertise.concert'), t('rrOnboard.expertise.sport'),
    t('rrOnboard.expertise.food'), t('rrOnboard.expertise.realEstate'),
    t('rrOnboard.expertise.travel'),
  ], [t]);

  const availabilityOptions: Array<{ value: AvailabilityStatus; label: string }> = useMemo(() => [
    { value: 'available', label: t('rrOnboard.workPref.available') },
    { value: 'busy', label: t('rrOnboard.availability.busy') },
    { value: 'unavailable', label: t('rrOnboard.availability.unavailable') },
  ], [t]);

  // Debounced Brreg-søk når brukeren skriver firmanavn/org.nr
  useEffect(() => {
    const term = brregQuery.trim();
    if (term.length < 2) {
      setBrregOptions([]);
      return;
    }
    let cancelled = false;
    setBrregLoading(true);
    const timer = setTimeout(() => {
      void searchBrregCompanies(term).then((results) => {
        if (cancelled) return;
        setBrregOptions(results);
        setBrregLoading(false);
      });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [brregQuery]);

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
      // Nytt bilde → nullstill fokuspunkt slik at auto-ansiktsgjenkjenning kjører på nytt.
      setForm((prev) => ({ ...prev, profileImageFocalX: null, profileImageFocalY: null }));
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingImage(false);
    }
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Legg til et starter-avsnitt i «Om meg» (på ny linje hvis det alt er tekst).
  const appendBioPrompt = (template: string) => {
    setForm((prev) => {
      const existing = prev.bio.trimEnd();
      const separator = existing.length > 0 ? '\n\n' : '';
      return { ...prev, bio: `${existing}${separator}${template}` };
    });
  };

  // Tidligere prosjekter (CV-historikk)
  const addEarlierProject = () => {
    setForm((prev) => ({
      ...prev,
      earlierProjects: [...prev.earlierProjects, { title: '', role: '', year: '' }],
    }));
  };
  const updateEarlierProject = (index: number, field: keyof EarlierProject, value: string) => {
    setForm((prev) => ({
      ...prev,
      earlierProjects: prev.earlierProjects.map((p, i) =>
        i === index ? { ...p, [field]: value } : p),
    }));
  };
  const removeEarlierProject = (index: number) => {
    setForm((prev) => ({
      ...prev,
      earlierProjects: prev.earlierProjects.filter((_, i) => i !== index),
    }));
  };

  // Portfolio / arbeidsprøver
  const addPortfolioItem = () => {
    setForm((prev) => ({
      ...prev,
      portfolioItems: [...prev.portfolioItems, { title: '', url: '' }],
    }));
  };
  const updatePortfolioItem = (index: number, field: keyof PortfolioItem, value: string) => {
    setForm((prev) => ({
      ...prev,
      portfolioItems: prev.portfolioItems.map((p, i) =>
        i === index ? { ...p, [field]: value } : p),
    }));
  };
  const removePortfolioItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      portfolioItems: prev.portfolioItems.filter((_, i) => i !== index),
    }));
  };

  // Referanser / attester
  const addReference = () => {
    setForm((prev) => ({
      ...prev,
      memberReferences: [...prev.memberReferences, { name: '', role: '', quote: '' }],
    }));
  };
  const updateReference = (index: number, field: keyof MemberReference, value: string) => {
    setForm((prev) => ({
      ...prev,
      memberReferences: prev.memberReferences.map((r, i) =>
        i === index ? { ...r, [field]: value } : r),
    }));
  };
  const removeReference = (index: number) => {
    setForm((prev) => ({
      ...prev,
      memberReferences: prev.memberReferences.filter((_, i) => i !== index),
    }));
  };

  // Legg til / fjern et fritt tag-element (utstyr, sertifiseringer)
  const addTag = (field: 'equipment' | 'certifications', value: string) => {
    const v = value.trim();
    if (!v) return;
    setForm((prev) => (prev[field].includes(v)
      ? prev
      : { ...prev, [field]: [...prev[field], v] }));
  };
  const removeTag = (field: 'equipment' | 'certifications', value: string) => {
    setForm((prev) => ({ ...prev, [field]: prev[field].filter((x) => x !== value) }));
  };

  const toggleArrayItem = (
    field: 'professions' | 'skills' | 'languages' | 'workPreferences' | 'expertiseAreas',
    item: string,
  ) => {
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
      const nameOk = config.requiredFields?.displayName === false
        || form.displayName.trim().length >= 2;
      // Firma-info er påkrevd (fylles fra Brønnøysund-oppslag).
      const companyOk = form.companyName.trim().length >= 2;
      return nameOk && companyOk;
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

  // Fullfør-knappen (siste steg) skal aldri kunne omgå påkrevd avatar — dekker
  // brukere som gjenopptar onboarding forbi bilde-steget (lagret currentStep).
  const canFinish = config.requiredFields?.profileImage !== true || !!profileImage;

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
            {t('rrOnboard.stepCounter', { current: step + 1, total: totalSteps })}
          </Typography>
          <Typography variant="h5" sx={{ color: 'white', mt: 0.5, fontWeight: 600 }}>
            {stepLabels[currentKey]}
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
              <TextField label={t('rrOnboard.displayNameLabel')} required={config.requiredFields?.displayName !== false} autoFocus
                          value={form.displayName}
                          onChange={(e) => updateField('displayName', e.target.value)}
                          helperText={t('rrOnboard.displayNameHelper')} />
              <Autocomplete
                freeSolo
                options={brregOptions}
                loading={brregLoading}
                filterOptions={(x) => x}
                getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.navn)}
                inputValue={form.companyName}
                onInputChange={(_e, value, reason) => {
                  if (reason === 'input') {
                    updateField('companyName', value);
                    setBrregQuery(value);
                    // Manuell redigering nullstiller tidligere valgt org.nr/adresse.
                    if (form.organizationNumber || form.businessAddress) {
                      setForm((prev) => ({ ...prev, organizationNumber: '', businessAddress: '' }));
                    }
                  }
                }}
                onChange={(_e, value) => {
                  if (value && typeof value !== 'string') {
                    const sel = toBrregSelection(value);
                    setForm((prev) => ({
                      ...prev,
                      companyName: sel.companyName,
                      organizationNumber: sel.organizationNumber,
                      businessAddress: sel.businessAddress,
                    }));
                    setBrregQuery('');
                    setBrregOptions([]);
                  }
                }}
                renderOption={(props, opt) => (
                  <li {...props} key={opt.organisasjonsnummer}>
                    <Box>
                      <Typography variant="body2">{opt.navn}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('rrOnboard.orgNrInline', { n: opt.organisasjonsnummer })}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('rrOnboard.companyLabel')}
                    required
                    helperText={t('rrOnboard.companyHelper')}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Business fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <>
                          {brregLoading ? <CircularProgress size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              {form.organizationNumber && (
                <TextField label={t('rrOnboard.orgNumberLabel')} value={form.organizationNumber}
                            size="small" InputProps={{ readOnly: true }} />
              )}
              {form.businessAddress && (
                <TextField label={t('rrOnboard.businessAddressLabel')} value={form.businessAddress}
                            size="small" InputProps={{ readOnly: true }} />
              )}
            </Stack>
          )}

          {!loading && currentKey === 'image' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
              {profileImage ? (
                <AvatarFocalPointEditor
                  imageUrl={profileImage}
                  focalX={form.profileImageFocalX}
                  focalY={form.profileImageFocalY}
                  onChange={(x, y) => setForm((prev) => ({
                    ...prev, profileImageFocalX: x, profileImageFocalY: y,
                  }))}
                />
              ) : (
                <Avatar sx={{ width: 120, height: 120, fontSize: 48,
                              bgcolor: 'rgba(160, 48, 192, 0.2)' }}>
                  <Person sx={{ fontSize: 60 }} />
                </Avatar>
              )}
              <Button variant="outlined" component="label"
                       disabled={uploadingImage}
                       startIcon={uploadingImage ? <CircularProgress size={16} /> : <CloudUpload />}>
                {profileImage ? t('rrOnboard.changeImage') : t('rrOnboard.uploadImage')}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }} />
              </Button>
              <Typography variant="caption" color="text.secondary" align="center">
                {t('rrOnboard.imageFormatsHelper')}
              </Typography>
              {!profileImage && config.requiredFields?.profileImage === true && (
                <Typography variant="caption" color="error" align="center" sx={{ mt: 2 }}>
                  {t('rrOnboard.imageRequiredHelper')}
                </Typography>
              )}
              {!profileImage && config.requiredFields?.profileImage !== true && (
                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 2 }}>
                  {t('rrOnboard.imageSkipHelper')}
                </Typography>
              )}
            </Stack>
          )}

          {!loading && currentKey === 'profession' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {t('rrOnboard.professionIntro')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {config.professionsOptions.map((p) => (
                  <Chip key={p} label={p} clickable
                         color={form.professions.includes(p) ? 'primary' : 'default'}
                         variant={form.professions.includes(p) ? 'filled' : 'outlined'}
                         onClick={() => toggleArrayItem('professions', p)} />
                ))}
              </Box>
              <TextField
                label={t('rrOnboard.yearsExperienceLabel')}
                type="number"
                size="small"
                value={form.yearsExperience ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = raw === '' ? null : Math.max(0, Math.min(80, parseInt(raw, 10) || 0));
                  updateField('yearsExperience', n);
                }}
                inputProps={{ min: 0, max: 80 }}
                sx={{ mt: 1, maxWidth: 220 }}
                helperText={t('rrOnboard.yearsExperienceHelper')}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('rrOnboard.skillsLabel')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {config.skillsOptions.map((s) => (
                  <Chip key={s} label={s} clickable size="small"
                         color={form.skills.includes(s) ? 'secondary' : 'default'}
                         variant={form.skills.includes(s) ? 'filled' : 'outlined'}
                         onClick={() => toggleArrayItem('skills', s)} />
                ))}
              </Box>

              {/* Fagområder / spesialiseringer (film/TV + foto/video) */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('rrOnboard.expertiseAreasLabel')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {expertiseAreaOptions.map((a) => (
                  <Chip key={a} label={a} clickable size="small"
                         color={form.expertiseAreas.includes(a) ? 'primary' : 'default'}
                         variant={form.expertiseAreas.includes(a) ? 'filled' : 'outlined'}
                         onClick={() => toggleArrayItem('expertiseAreas', a)} />
                ))}
              </Box>

              {/* Utstyr / gear — fra foto/video-katalog, med kategori-ikon */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('rrOnboard.equipmentLabel')}
              </Typography>
              <Autocomplete<EquipmentCatalogItem, true, false, true>
                multiple
                freeSolo
                size="small"
                options={EQUIPMENT_CATALOG}
                value={form.equipment}
                groupBy={(opt) =>
                  (typeof opt === 'string'
                    ? EQUIPMENT_CATEGORY_LABELS[categoryForEquipment(opt)]
                    : EQUIPMENT_CATEGORY_LABELS[opt.category])}
                getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name)}
                isOptionEqualToValue={(opt, val) =>
                  (typeof opt === 'string' ? opt : opt.name)
                    === (typeof val === 'string' ? val : val.name)}
                onChange={(_e, value) => {
                  const names = value.map((v) =>
                    (typeof v === 'string' ? v.trim() : v.name)).filter(Boolean);
                  updateField('equipment', Array.from(new Set(names)));
                }}
                renderOption={(props, opt) => {
                  const item = opt as EquipmentCatalogItem | string;
                  const name = typeof item === 'string' ? item : item.name;
                  const cat = typeof item === 'string' ? categoryForEquipment(item) : item.category;
                  return (
                    <li {...props} key={name}>
                      <EquipmentCategoryIcon category={cat}
                        sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                      {name}
                    </li>
                  );
                }}
                renderTags={(value, getTagProps) =>
                  value.map((opt, index) => {
                    const name = typeof opt === 'string' ? opt : opt.name;
                    return (
                      <Chip
                        {...getTagProps({ index })}
                        key={name}
                        size="small"
                        icon={<EquipmentCategoryIcon category={categoryForEquipment(name)}
                          sx={{ fontSize: 16 }} />}
                        label={name}
                      />
                    );
                  })}
                renderInput={(params) => (
                  <TextField {...params} placeholder={t('rrOnboard.equipmentSearchPlaceholder')}
                    helperText={t('rrOnboard.equipmentHelper')} />
                )}
              />

              {/* Sertifiseringer & lisenser */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {t('rrOnboard.certificationsLabel')}
              </Typography>
              {form.certifications.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {form.certifications.map((c) => (
                    <Chip key={c} label={c} size="small"
                           onDelete={() => removeTag('certifications', c)} />
                  ))}
                </Box>
              )}
              <TextField
                size="small"
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('certifications', certInput);
                    setCertInput('');
                  }
                }}
                placeholder={t('rrOnboard.certificationsPlaceholder')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label={t('rrOnboard.addCertificationAria')}
                        onClick={() => { addTag('certifications', certInput); setCertInput(''); }}>
                        <Add fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

            </Stack>
          )}

          {!loading && currentKey === 'about' && (
            <Stack spacing={2}>
              <TextField label={t('rrOnboard.aboutMe')} multiline rows={4}
                          value={form.bio}
                          onChange={(e) => updateField('bio', e.target.value)}
                          placeholder={t('rrOnboard.bioPlaceholder')}
                          helperText={t('rrOnboard.bioHelper')} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('rrOnboard.bioPromptIntro')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {bioPrompts.map((p) => (
                    <Chip key={p.label} label={p.label} clickable size="small" variant="outlined"
                           onClick={() => appendBioPrompt(p.template)} />
                  ))}
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <TextField label={t('rrOnboard.cityLabel')} fullWidth
                            value={form.locationCity}
                            onChange={(e) => updateField('locationCity', e.target.value)} />
                <TextField label={t('rrOnboard.countryLabel')} fullWidth
                            value={form.locationCountry}
                            onChange={(e) => updateField('locationCountry', e.target.value)} />
              </Stack>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('rrOnboard.languagesLabel')}
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

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('rrOnboard.earlierProjectsLabel')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t('rrOnboard.earlierProjectsHelper')}
                </Typography>
                <Stack spacing={1.5}>
                  {form.earlierProjects.map((proj, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Stack spacing={1} sx={{ flex: 1 }}>
                        <TextField label={t('rrOnboard.projectTitleLabel')} size="small" value={proj.title}
                                    onChange={(e) => updateEarlierProject(i, 'title', e.target.value)}
                                    placeholder={t('rrOnboard.projectTitlePlaceholder')} />
                        <Stack direction="row" spacing={1}>
                          <TextField label={t('rrOnboard.projectRoleLabel')} size="small" fullWidth value={proj.role}
                                      onChange={(e) => updateEarlierProject(i, 'role', e.target.value)}
                                      placeholder={t('rrOnboard.projectRolePlaceholder')} />
                          <TextField label={t('rrOnboard.projectYearLabel')} size="small" value={proj.year}
                                      onChange={(e) => updateEarlierProject(i, 'year', e.target.value)}
                                      placeholder="2024" sx={{ maxWidth: 96 }} />
                        </Stack>
                      </Stack>
                      <IconButton size="small" onClick={() => removeEarlierProject(i)}
                                   sx={{ mt: 0.5 }} aria-label={t('rrOnboard.removeProjectAria')}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button startIcon={<Add />} onClick={addEarlierProject} size="small"
                           variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                    {t('rrOnboard.addProjectButton')}
                  </Button>
                </Stack>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('rrOnboard.referencesLabel')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t('rrOnboard.referencesHelper')}
                </Typography>
                <Stack spacing={1.5}>
                  {form.memberReferences.map((ref, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Stack spacing={1} sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1}>
                          <TextField label={t('rrOnboard.referenceNameLabel')} size="small" fullWidth value={ref.name}
                                      onChange={(e) => updateReference(i, 'name', e.target.value)}
                                      placeholder={t('rrOnboard.referenceNamePlaceholder')} />
                          <TextField label={t('rrOnboard.referenceRoleLabel')} size="small" fullWidth value={ref.role}
                                      onChange={(e) => updateReference(i, 'role', e.target.value)}
                                      placeholder={t('rrOnboard.referenceRolePlaceholder')} />
                        </Stack>
                        <TextField label={t('rrOnboard.referenceQuoteLabel')} size="small" multiline rows={2}
                                    value={ref.quote}
                                    onChange={(e) => updateReference(i, 'quote', e.target.value)}
                                    placeholder={t('rrOnboard.referenceQuotePlaceholder')} />
                      </Stack>
                      <IconButton size="small" onClick={() => removeReference(i)}
                                   sx={{ mt: 0.5 }} aria-label={t('rrOnboard.removeReferenceAria')}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button startIcon={<Add />} onClick={addReference} size="small"
                           variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                    {t('rrOnboard.addReferenceButton')}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          )}

          {!loading && currentKey === 'links' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {t('rrOnboard.linksIntro')}
              </Typography>
              <TextField label={t('rrOnboard.websiteLabel')}
                          value={form.website}
                          onChange={(e) => updateField('website', e.target.value)}
                          placeholder="https://…" />
              <TextField label={t('rrOnboard.showreelLabel')}
                          value={form.showreelUrl}
                          onChange={(e) => updateField('showreelUrl', e.target.value)}
                          placeholder="https://vimeo.com/…" />
              <TextField label="Instagram"
                          value={form.socialLinks.instagram ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, instagram: e.target.value })}
                          placeholder={t('rrOnboard.usernamePlaceholder')} />
              <TextField label="LinkedIn"
                          value={form.socialLinks.linkedin ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, linkedin: e.target.value })}
                          placeholder="https://linkedin.com/in/…" />
              <TextField label="TikTok"
                          value={form.socialLinks.tiktok ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, tiktok: e.target.value })}
                          placeholder={t('rrOnboard.usernamePlaceholder')} />
              <TextField label="YouTube"
                          value={form.socialLinks.youtube ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, youtube: e.target.value })}
                          placeholder="https://youtube.com/@…" />
              <TextField label="Facebook"
                          value={form.socialLinks.facebook ?? ''}
                          onChange={(e) => updateField('socialLinks',
                            { ...form.socialLinks, facebook: e.target.value })}
                          placeholder="https://facebook.com/…" />

              {/* Portfolio / arbeidsprøver — flere lenker, hver med egen tittel */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('rrOnboard.portfolioLabel')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t('rrOnboard.portfolioHelper')}
                </Typography>
                <Stack spacing={1.5}>
                  {form.portfolioItems.map((item, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Stack spacing={1} sx={{ flex: 1 }}>
                        <TextField label={t('rrOnboard.portfolioTitleLabel')} size="small" value={item.title}
                                    onChange={(e) => updatePortfolioItem(i, 'title', e.target.value)}
                                    placeholder={t('rrOnboard.portfolioTitlePlaceholder')} />
                        <TextField label={t('rrOnboard.portfolioUrlLabel')} size="small" value={item.url}
                                    onChange={(e) => updatePortfolioItem(i, 'url', e.target.value)}
                                    placeholder="https://vimeo.com/…" />
                      </Stack>
                      <IconButton size="small" onClick={() => removePortfolioItem(i)}
                                   sx={{ mt: 0.5 }} aria-label={t('rrOnboard.removePortfolioAria')}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button startIcon={<Add />} onClick={addPortfolioItem} size="small"
                           variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                    {t('rrOnboard.addPortfolioButton')}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          )}

          {!loading && currentKey === 'availability' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {t('rrOnboard.availabilityIntro')}
              </Typography>

              <FormControl size="small" fullWidth>
                <InputLabel>{t('rrOnboard.generalStatusLabel')}</InputLabel>
                <Select label={t('rrOnboard.generalStatusLabel')}
                         value={form.availabilityStatus}
                         onChange={(e) => updateField('availabilityStatus',
                           e.target.value as AvailabilityStatus | '')}>
                  <MenuItem value=""><em>{t('rrOnboard.notSpecified')}</em></MenuItem>
                  {availabilityOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  {t('rrOnboard.workPreferencesLabel')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {workPreferenceOptions.map((w) => (
                    <Chip key={w} label={w} clickable size="small"
                           color={form.workPreferences.includes(w) ? 'secondary' : 'default'}
                           variant={form.workPreferences.includes(w) ? 'filled' : 'outlined'}
                           onClick={() => toggleArrayItem('workPreferences', w)} />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  {t('rrOnboard.calendarLabel')}
                </Typography>
                <AvailabilityCalendar editable months={2} />
              </Box>
            </Stack>
          )}

          {!loading && currentKey === 'privacy' && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {t('rrOnboard.visibilityIntro')}
              </Typography>
              <FormControl fullWidth>
                <InputLabel>{t('rrOnboard.visibilityLabel')}</InputLabel>
                <Select label={t('rrOnboard.visibilityLabel')}
                         value={form.visibility}
                         onChange={(e) => updateField('visibility', e.target.value as ProfileVisibility)}>
                  <MenuItem value="public">{t('rrOnboard.visibilityPublic')}</MenuItem>
                  <MenuItem value="connections">{t('rrOnboard.visibilityConnections')}</MenuItem>
                  <MenuItem value="private">{t('rrOnboard.visibilityPrivate')}</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                {t('rrOnboard.visibilityChangeLaterHelper')}
              </Typography>
              <Box sx={{ background: 'rgba(160, 48, 192, 0.08)', p: 2, borderRadius: 2, mt: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <Avatar
                    src={profileImage ?? undefined}
                    imgProps={{ style: { objectPosition: focalToObjectPosition(
                      form.profileImageFocalX, form.profileImageFocalY) } }}
                    sx={{ width: 44, height: 44, bgcolor: 'rgba(160, 48, 192, 0.2)' }}
                  >
                    {profileImage ? null : <Person />}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('rrOnboard.summaryLabel')}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">
                  <strong>{form.displayName || t('rrOnboard.noNamePlaceholder')}</strong>
                  {form.companyName && ` · ${form.companyName}`}
                  <br />
                  {form.professions.length > 0 && (
                    <>{t('rrOnboard.roleSummaryPrefix')}{form.professions.join(', ')}<br /></>
                  )}
                  {form.skills.length > 0 && (
                    <>{t('rrOnboard.skillsSummaryPrefix')}{form.skills.length}<br /></>
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
              {t('rrOnboard.backButton')}
            </Button>
          ) : <Box />}
          {isLastStep ? (
            <Button onClick={finishOnboarding} disabled={saving || loading || !canFinish}
                     variant="contained" endIcon={saving ? <CircularProgress size={14} /> : <Check />}>
              {isEditMode ? t('rrOnboard.saveChangesButton') : t('rrOnboard.finishProfileButton')}
            </Button>
          ) : (
            <Button onClick={() => void saveStep(step + 1)}
                     disabled={!canProgressFromCurrent() || saving || loading}
                     variant="contained" endIcon={saving ? <CircularProgress size={14} /> : <ArrowForward />}>
              {t('rrOnboard.nextButton')}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default RoleRoomOnboardingDialog;
