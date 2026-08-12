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
  Autocomplete, Avatar, Box, Button, Chip, Dialog, DialogContent, IconButton,
  LinearProgress, MenuItem, Select, Stack, TextField, Typography,
  CircularProgress, FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, Check, Close, CloudUpload, Person, Business,
  Add, AddAPhoto, DeleteOutline, ErrorOutline, InfoOutlined,
  Badge, History, StarOutline, Category, CameraAlt, Verified,
  PersonOutline, Place, Language, FormatQuote, Public, Share, FolderOpen,
  Instagram, LinkedIn, YouTube, Facebook, MusicNote, EventAvailable, WorkOutline,
  CalendarMonth, Lock, FactCheck,
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

// ── Design-tokens (matcher steg 2 / AvatarFocalPointEditor) ───────────────
const ACCENT_GRADIENT = 'linear-gradient(135deg,#a030c0,#7c3aed)';

/** Gruppert seksjonskort med ikon + tittel — bryter opp lang scroll i steg 3-7. */
function StepSection({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Box sx={{
      borderRadius: 2.5,
      border: '1px solid rgba(160,48,192,0.18)',
      bgcolor: 'rgba(160,48,192,0.05)',
      p: 1.75,
    }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <Box sx={{
          width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgba(160,48,192,0.16)', color: '#c084fc',
        }}>
          {icon}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
          {title}
        </Typography>
      </Stack>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25, lineHeight: 1.45 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Box>
  );
}

/** Konsekvent valgbar chip (lilla 999-pille) — matcher steg 2. */
function OptionChip({ label, selected, onClick, size = 'small' }: {
  label: string; selected: boolean; onClick: () => void; size?: 'small' | 'medium';
}) {
  return (
    <Chip
      label={label}
      size={size}
      clickable
      onClick={onClick}
      sx={{
        borderRadius: 999,
        border: selected ? '1px solid rgba(160,48,192,0.65)' : '1px solid rgba(255,255,255,0.14)',
        bgcolor: selected ? 'rgba(160,48,192,0.9)' : 'rgba(255,255,255,0.045)',
        color: selected ? '#fff' : 'rgba(255,255,255,0.78)',
        fontWeight: selected ? 600 : 400,
        '&:hover': { bgcolor: selected ? 'rgba(160,48,192,0.8)' : 'rgba(255,255,255,0.1)' },
      }}
    />
  );
}

/** Gradient «legg til»-pille — matcher steg 2 sine 999-piller. */
function AddPill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button startIcon={<Add />} onClick={onClick} size="small"
      sx={{
        alignSelf: 'flex-start', borderRadius: 999,
        background: ACCENT_GRADIENT, color: '#fff',
        px: 1.75, textTransform: 'none', fontWeight: 600,
        '&:hover': { opacity: 0.92, background: ACCENT_GRADIENT },
      }}>
      {children}
    </Button>
  );
}

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

const STEP_LABELS: Record<StepKey, string> = {
  welcome: 'Velkommen',
  image: 'Profilbilde',
  profession: 'Profesjon',
  about: 'Om meg',
  links: 'Lenker',
  availability: 'Tilgjengelighet',
  privacy: 'Personvern',
};

// Starter-avsnitt for «Om meg» — hjelper brukeren i gang med å skrive.
const BIO_PROMPTS: Array<{ label: string; template: string }> = [
  { label: 'Hva jeg gjør', template: 'Jeg jobber med ' },
  { label: 'Erfaring', template: 'Jeg har jobbet med dette i … år, blant annet med ' },
  { label: 'Stil / signatur', template: 'Stilen min kjennetegnes av ' },
  { label: 'Utstyr', template: 'Jeg jobber med utstyr som ' },
  { label: 'Hva jeg ser etter', template: 'Jeg er interessert i prosjekter som ' },
];

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

const WORK_PREFERENCE_OPTIONS = [
  'Tilgjengelig for oppdrag', 'Frilans', 'Heltid', 'På sett', 'Remote',
  'Kan reise', 'Kortoppdrag', 'Langtidsprosjekt',
];

// Fagområder / spesialiseringer for foto/video- OG film/TV-bransjen.
const EXPERTISE_AREA_OPTIONS = [
  // Film & TV
  'Spillefilm', 'Kortfilm', 'TV-serie', 'TV-drama', 'TV-produksjon',
  'Reklamefilm', 'Dokumentar', 'Streaming / OTT', 'Underholdning',
  'Nyheter / aktualitet', 'Barne-TV', 'Realityproduksjon',
  // Foto / video / kommersielt
  'Bryllup', 'Musikkvideo', 'Reklame', 'Bedriftsfilm',
  'Event', 'Portrett', 'Mote', 'Produkt', 'Sosiale medier',
  'Drone / luftfoto', 'Live-produksjon', 'Podcast',
  'Konsert', 'Sport', 'Mat', 'Eiendom', 'Reise',
];

const AVAILABILITY_OPTIONS: Array<{ value: AvailabilityStatus; label: string }> = [
  { value: 'available', label: 'Tilgjengelig for oppdrag' },
  { value: 'busy', label: 'Delvis opptatt' },
  { value: 'unavailable', label: 'Ikke tilgjengelig nå' },
];

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
            PaperProps={{ sx: {
              borderRadius: 3, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              maxHeight: 'min(92vh, 860px)',
            } }}>
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column',
                 minHeight: 0, flex: 1, overflow: 'hidden' }}>
        {(isEditMode ? onClose : onMinimize) && (
          <IconButton onClick={isEditMode ? onClose : onMinimize}
                       sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, color: 'white' }}
                       size="small">
            <Close fontSize="small" />
          </IconButton>
        )}

        <Box sx={{ p: 3, pb: 1, flexShrink: 0, background: 'linear-gradient(135deg, #1e1a2e, #2d1b4e)' }}>
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

        <DialogContent sx={{ p: 3, minHeight: 0, overflowY: 'auto' }}>
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
                        Org.nr {opt.organisasjonsnummer}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Bedrift / studio"
                    required
                    helperText="Søk på firmanavn eller org.nr — henter fra Brønnøysundregistrene"
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
                <TextField label="Organisasjonsnummer" value={form.organizationNumber}
                            size="small" InputProps={{ readOnly: true }} />
              )}
              {form.businessAddress && (
                <TextField label="Forretningsadresse" value={form.businessAddress}
                            size="small" InputProps={{ readOnly: true }} />
              )}
            </Stack>
          )}

          {!loading && currentKey === 'image' && (
            <Stack spacing={2.5} alignItems="center" sx={{ py: 0.5 }}>
              {profileImage ? (
                <>
                  <AvatarFocalPointEditor
                    imageUrl={profileImage}
                    focalX={form.profileImageFocalX}
                    focalY={form.profileImageFocalY}
                    onChange={(x, y) => setForm((prev) => ({
                      ...prev, profileImageFocalX: x, profileImageFocalY: y,
                    }))}
                  />
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={uploadingImage}
                    startIcon={uploadingImage ? <CircularProgress size={16} /> : <CloudUpload />}
                    sx={{
                      borderRadius: 999,
                      px: 3,
                      py: 0.8,
                      textTransform: 'none',
                      fontWeight: 700,
                      borderColor: 'rgba(160,48,192,0.42)',
                      color: '#c084fc',
                      '&:hover': {
                        borderColor: '#a030c0',
                        bgcolor: 'rgba(160,48,192,0.08)',
                      },
                    }}
                  >
                    {uploadingImage ? 'Laster opp…' : 'Endre bilde'}
                    <input
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageUpload(file);
                      }}
                    />
                  </Button>
                </>
              ) : (
                <Box
                  component="label"
                  sx={{
                    display: 'block',
                    width: '100%',
                    cursor: 'pointer',
                    borderRadius: 3.5,
                    border: '1.5px dashed rgba(160,48,192,0.5)',
                    background: 'linear-gradient(180deg, rgba(160,48,192,0.10) 0%, rgba(160,48,192,0.02) 100%)',
                    p: { xs: 3, sm: 4 },
                    textAlign: 'center',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                    '&:hover': {
                      borderColor: '#a030c0',
                      background: 'linear-gradient(180deg, rgba(160,48,192,0.16) 0%, rgba(160,48,192,0.05) 100%)',
                    },
                  }}
                >
                  <input
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload(file);
                    }}
                  />
                  <Stack spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 80, height: 80, borderRadius: '50%',
                      display: 'grid', placeItems: 'center',
                      bgcolor: 'rgba(160,48,192,0.16)',
                      border: '1px solid rgba(160,48,192,0.38)',
                      color: '#c084fc',
                    }}>
                      <AddAPhoto sx={{ fontSize: 36 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.08rem', color: '#f8fafc', lineHeight: 1.3 }}>
                        Last opp profilbilde
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        JPG, PNG, WebP eller GIF · maks 4 MB
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      component="span"
                      disabled={uploadingImage}
                      startIcon={uploadingImage ? <CircularProgress size={18} /> : <CloudUpload />}
                      sx={{
                        mt: 0.5,
                        borderRadius: 999,
                        px: 3.5,
                        py: 0.9,
                        textTransform: 'none',
                        fontWeight: 800,
                        color: '#fff',
                        background: 'linear-gradient(135deg, #a030c0 0%, #7c3aed 100%)',
                        boxShadow: '0 6px 18px rgba(160,48,192,0.35)',
                        '&:hover': { background: 'linear-gradient(135deg, #b33dd0 0%, #8b5cf6 100%)' },
                        '&:disabled': { background: 'rgba(160,48,192,0.4)' },
                      }}
                    >
                      {uploadingImage ? 'Laster opp…' : 'Velg bilde'}
                    </Button>
                  </Stack>
                </Box>
              )}
              {!profileImage && config.requiredFields?.profileImage === true ? (
                <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: -0.5 }}>
                  <InfoOutlined sx={{ fontSize: 15, color: 'error.main' }} />
                  <Typography variant="caption" color="error" align="center">
                    Profilbilde er påkrevd for å fullføre profilen.
                  </Typography>
                </Stack>
              ) : !profileImage ? (
                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: -0.5 }}>
                  Du kan hoppe over dette nå og legge til bilde senere.
                </Typography>
              ) : null}
            </Stack>
          )}

          {!loading && currentKey === 'profession' && (
            <Stack spacing={1.75}>
              <StepSection icon={<Badge sx={{ fontSize: 17 }} />} title="Hovedrolle"
                subtitle="Hva er hovedrollen din i prosjektet? Velg gjerne en tilleggsprofesjon også (f.eks. Regissør).">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {config.professionsOptions.map((p) => (
                    <OptionChip key={p} label={p} selected={form.professions.includes(p)}
                      onClick={() => toggleArrayItem('professions', p)} />
                  ))}
                </Box>
              </StepSection>

              <StepSection icon={<History sx={{ fontSize: 17 }} />} title="Erfaring">
                <TextField
                  label="År med erfaring (valgfri)"
                  type="number"
                  size="small"
                  value={form.yearsExperience ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw === '' ? null : Math.max(0, Math.min(80, parseInt(raw, 10) || 0));
                    updateField('yearsExperience', n);
                  }}
                  inputProps={{ min: 0, max: 80 }}
                  sx={{ maxWidth: 220 }}
                  helperText="Hvor lenge har du jobbet i faget?"
                />
              </StepSection>

              <StepSection icon={<StarOutline sx={{ fontSize: 17 }} />} title="Ferdigheter">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {config.skillsOptions.map((s) => (
                    <OptionChip key={s} label={s} selected={form.skills.includes(s)}
                      onClick={() => toggleArrayItem('skills', s)} />
                  ))}
                </Box>
              </StepSection>

              <StepSection icon={<Category sx={{ fontSize: 17 }} />} title="Fagområder"
                subtitle="Hva spesialiserer du deg på?">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {EXPERTISE_AREA_OPTIONS.map((a) => (
                    <OptionChip key={a} label={a} selected={form.expertiseAreas.includes(a)}
                      onClick={() => toggleArrayItem('expertiseAreas', a)} />
                  ))}
                </Box>
              </StepSection>

              <StepSection icon={<CameraAlt sx={{ fontSize: 17 }} />} title="Utstyr & gear"
                subtitle="Velg fra katalogen eller skriv inn eget utstyr.">
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
                    <TextField {...params} placeholder="Søk kamera, objektiv, drone, lys …"
                      helperText="Velg fra katalogen eller skriv inn eget utstyr" />
                  )}
                />
              </StepSection>

              <StepSection icon={<Verified sx={{ fontSize: 17 }} />} title="Sertifiseringer & lisenser">
                {form.certifications.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                    {form.certifications.map((c) => (
                      <Chip key={c} label={c} size="small" sx={{ borderRadius: 999 }}
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
                  placeholder="F.eks. Dronesertifikat A1/A3, HMS-kort — trykk Enter"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" aria-label="Legg til sertifisering"
                          onClick={() => { addTag('certifications', certInput); setCertInput(''); }}>
                          <Add fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </StepSection>
            </Stack>
          )}

          {!loading && currentKey === 'about' && (
            <Stack spacing={1.75}>
              <StepSection icon={<PersonOutline sx={{ fontSize: 17 }} />} title="Om meg"
                subtitle="Synlig for andre medlemmer.">
                <TextField label="Om meg" multiline rows={4}
                            value={form.bio}
                            onChange={(e) => updateField('bio', e.target.value)}
                            placeholder="Skriv litt om hva du gjør, stil, erfaring …"
                            helperText="Synlig for andre medlemmer" />
                <Box sx={{ mt: 1.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Trenger du hjelp i gang? Legg til et avsnitt:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {BIO_PROMPTS.map((p) => (
                      <Chip key={p.label} label={p.label} clickable size="small" variant="outlined"
                             sx={{ borderRadius: 999 }}
                             onClick={() => appendBioPrompt(p.template)} />
                    ))}
                  </Box>
                </Box>
              </StepSection>

              <StepSection icon={<Place sx={{ fontSize: 17 }} />} title="Lokasjon">
                <Stack direction="row" spacing={1}>
                  <TextField label="By" fullWidth
                              value={form.locationCity}
                              onChange={(e) => updateField('locationCity', e.target.value)} />
                  <TextField label="Land" fullWidth
                              value={form.locationCountry}
                              onChange={(e) => updateField('locationCountry', e.target.value)} />
                </Stack>
              </StepSection>

              <StepSection icon={<Language sx={{ fontSize: 17 }} />} title="Språk">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {config.languageOptions.map((lang) => (
                    <OptionChip key={lang.code} label={lang.name}
                      selected={form.languages.includes(lang.code)}
                      onClick={() => toggleArrayItem('languages', lang.code)} />
                  ))}
                </Box>
              </StepSection>

              <StepSection icon={<History sx={{ fontSize: 17 }} />} title="Tidligere prosjekter"
                subtitle="Vis hva du har jobbet med før — det hjelper andre å se erfaringen din.">
                <Stack spacing={1.5}>
                  {form.earlierProjects.map((proj, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Stack spacing={1} sx={{ flex: 1 }}>
                        <TextField label="Prosjekt / tittel" size="small" value={proj.title}
                                    onChange={(e) => updateEarlierProject(i, 'title', e.target.value)}
                                    placeholder="F.eks. musikkvideo for …" />
                        <Stack direction="row" spacing={1}>
                          <TextField label="Din rolle" size="small" fullWidth value={proj.role}
                                      onChange={(e) => updateEarlierProject(i, 'role', e.target.value)}
                                      placeholder="F.eks. Regissør" />
                          <TextField label="År" size="small" value={proj.year}
                                      onChange={(e) => updateEarlierProject(i, 'year', e.target.value)}
                                      placeholder="2024" sx={{ maxWidth: 96 }} />
                        </Stack>
                      </Stack>
                      <IconButton size="small" onClick={() => removeEarlierProject(i)}
                                   sx={{ mt: 0.5 }} aria-label="Fjern prosjekt">
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <AddPill onClick={addEarlierProject}>Legg til prosjekt</AddPill>
                </Stack>
              </StepSection>

              <StepSection icon={<FormatQuote sx={{ fontSize: 17 }} />} title="Referanser & attester"
                subtitle="Kort attest fra tidligere kunder eller samarbeidspartnere.">
                <Stack spacing={1.5}>
                  {form.memberReferences.map((ref, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Stack spacing={1} sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1}>
                          <TextField label="Navn" size="small" fullWidth value={ref.name}
                                      onChange={(e) => updateReference(i, 'name', e.target.value)}
                                      placeholder="F.eks. Kari Nordmann" />
                          <TextField label="Rolle / firma" size="small" fullWidth value={ref.role}
                                      onChange={(e) => updateReference(i, 'role', e.target.value)}
                                      placeholder="F.eks. Produsent, NRK" />
                        </Stack>
                        <TextField label="Sitat / attest" size="small" multiline rows={2}
                                    value={ref.quote}
                                    onChange={(e) => updateReference(i, 'quote', e.target.value)}
                                    placeholder="«Leverte over forventning …»" />
                      </Stack>
                      <IconButton size="small" onClick={() => removeReference(i)}
                                   sx={{ mt: 0.5 }} aria-label="Fjern referanse">
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <AddPill onClick={addReference}>Legg til referanse</AddPill>
                </Stack>
              </StepSection>
            </Stack>
          )}

          {!loading && currentKey === 'links' && (
            <Stack spacing={1.75}>
              <StepSection icon={<Public sx={{ fontSize: 17 }} />} title="Nett & portefølje"
                subtitle="Legg til nettside og showreel.">
                <Stack spacing={1.5}>
                  <TextField label="Nettside"
                              value={form.website}
                              onChange={(e) => updateField('website', e.target.value)}
                              placeholder="https://…" />
                  <TextField label="Showreel (Vimeo, YouTube …)"
                              value={form.showreelUrl}
                              onChange={(e) => updateField('showreelUrl', e.target.value)}
                              placeholder="https://vimeo.com/…" />
                </Stack>
              </StepSection>

              <StepSection icon={<Share sx={{ fontSize: 17 }} />} title="Sosiale medier"
                subtitle="Alt valgfritt.">
                <Stack spacing={1.5}>
                  <TextField label="Instagram"
                              value={form.socialLinks.instagram ?? ''}
                              onChange={(e) => updateField('socialLinks',
                                { ...form.socialLinks, instagram: e.target.value })}
                              placeholder="@brukernavn"
                              InputProps={{ startAdornment: (
                                <InputAdornment position="start"><Instagram sx={{ fontSize: 18, color: '#c084fc' }} /></InputAdornment>
                              ) }} />
                  <TextField label="LinkedIn"
                              value={form.socialLinks.linkedin ?? ''}
                              onChange={(e) => updateField('socialLinks',
                                { ...form.socialLinks, linkedin: e.target.value })}
                              placeholder="https://linkedin.com/in/…"
                              InputProps={{ startAdornment: (
                                <InputAdornment position="start"><LinkedIn sx={{ fontSize: 18, color: '#c084fc' }} /></InputAdornment>
                              ) }} />
                  <TextField label="TikTok"
                              value={form.socialLinks.tiktok ?? ''}
                              onChange={(e) => updateField('socialLinks',
                                { ...form.socialLinks, tiktok: e.target.value })}
                              placeholder="@brukernavn"
                              InputProps={{ startAdornment: (
                                <InputAdornment position="start"><MusicNote sx={{ fontSize: 18, color: '#c084fc' }} /></InputAdornment>
                              ) }} />
                  <TextField label="YouTube"
                              value={form.socialLinks.youtube ?? ''}
                              onChange={(e) => updateField('socialLinks',
                                { ...form.socialLinks, youtube: e.target.value })}
                              placeholder="https://youtube.com/@…"
                              InputProps={{ startAdornment: (
                                <InputAdornment position="start"><YouTube sx={{ fontSize: 18, color: '#c084fc' }} /></InputAdornment>
                              ) }} />
                  <TextField label="Facebook"
                              value={form.socialLinks.facebook ?? ''}
                              onChange={(e) => updateField('socialLinks',
                                { ...form.socialLinks, facebook: e.target.value })}
                              placeholder="https://facebook.com/…"
                              InputProps={{ startAdornment: (
                                <InputAdornment position="start"><Facebook sx={{ fontSize: 18, color: '#c084fc' }} /></InputAdornment>
                              ) }} />
                </Stack>
              </StepSection>

              <StepSection icon={<FolderOpen sx={{ fontSize: 17 }} />} title="Portfolio / arbeidsprøver"
                subtitle="Legg til så mange arbeidsprøver du vil — hver med tittel og lenke.">
                <Stack spacing={1.5}>
                  {form.portfolioItems.map((item, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Stack spacing={1} sx={{ flex: 1 }}>
                        <TextField label="Tittel" size="small" value={item.title}
                                    onChange={(e) => updatePortfolioItem(i, 'title', e.target.value)}
                                    placeholder="F.eks. Reklamefilm for …" />
                        <TextField label="Lenke" size="small" value={item.url}
                                    onChange={(e) => updatePortfolioItem(i, 'url', e.target.value)}
                                    placeholder="https://vimeo.com/…" />
                      </Stack>
                      <IconButton size="small" onClick={() => removePortfolioItem(i)}
                                   sx={{ mt: 0.5 }} aria-label="Fjern arbeidsprøve">
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <AddPill onClick={addPortfolioItem}>Legg til arbeidsprøve</AddPill>
                </Stack>
              </StepSection>
            </Stack>
          )}

          {!loading && currentKey === 'availability' && (
            <Stack spacing={1.75}>
              <StepSection icon={<EventAvailable sx={{ fontSize: 17 }} />} title="Tilgjengelighet"
                subtitle="Vis når du er ledig for oppdrag. Produsenter ser dette når de setter sammen team — så du slipper unødvendige forespørsler på datoer du er opptatt.">
                <FormControl size="small" fullWidth>
                  <InputLabel>Generell status</InputLabel>
                  <Select label="Generell status"
                           value={form.availabilityStatus}
                           onChange={(e) => updateField('availabilityStatus',
                             e.target.value as AvailabilityStatus | '')}>
                    <MenuItem value=""><em>Ikke oppgitt</em></MenuItem>
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </StepSection>

              <StepSection icon={<WorkOutline sx={{ fontSize: 17 }} />} title="Arbeidspreferanser">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {WORK_PREFERENCE_OPTIONS.map((w) => (
                    <OptionChip key={w} label={w} selected={form.workPreferences.includes(w)}
                      onClick={() => toggleArrayItem('workPreferences', w)} />
                  ))}
                </Box>
              </StepSection>

              <StepSection icon={<CalendarMonth sx={{ fontSize: 17 }} />} title="Kalender"
                subtitle="Marker konkrete datoer (auto-lagres).">
                <AvailabilityCalendar editable months={2} />
              </StepSection>
            </Stack>
          )}

          {!loading && currentKey === 'privacy' && (
            <Stack spacing={1.75}>
              <StepSection icon={<Lock sx={{ fontSize: 17 }} />} title="Synlighet"
                subtitle="Hvem skal kunne se profilen din?">
                <FormControl fullWidth>
                  <InputLabel>Synlighet</InputLabel>
                  <Select label="Synlighet"
                           value={form.visibility}
                           onChange={(e) => updateField('visibility', e.target.value as ProfileVisibility)}>
                    <MenuItem value="public">Offentlig — synlig for alle (også uten konto)</MenuItem>
                    <MenuItem value="connections">Innloggede medlemmer — anbefalt</MenuItem>
                    <MenuItem value="project_team">Kun produksjonsteamet — bare mitt team ser den</MenuItem>
                    <MenuItem value="private">Privat — bare jeg ser den</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                  Du kan endre dette når som helst senere i Innstillinger.
                </Typography>
              </StepSection>

              <StepSection icon={<FactCheck sx={{ fontSize: 17 }} />} title="Oppsummering">
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.25 }}>
                  <Avatar
                    src={profileImage ?? undefined}
                    imgProps={{ style: { objectPosition: focalToObjectPosition(
                      form.profileImageFocalX, form.profileImageFocalY) } }}
                    sx={{ width: 44, height: 44, bgcolor: 'rgba(160, 48, 192, 0.2)' }}
                  >
                    {profileImage ? null : <Person />}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {form.displayName || '(uten navn)'}
                    </Typography>
                    {form.companyName && (
                      <Typography variant="caption" color="text.secondary">{form.companyName}</Typography>
                    )}
                  </Box>
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">
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
              </StepSection>
            </Stack>
          )}

          {error && (
            <Box sx={{
              mt: 2,
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
              p: 1.75,
              borderRadius: 2.5,
              bgcolor: 'rgba(239,79,111,0.08)',
              border: '1px solid rgba(239,79,111,0.28)',
            }}>
              <ErrorOutline sx={{ fontSize: 20, color: '#ef4f6f', mt: 0.1, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: '#fda4af', fontWeight: 700 }}>
                  Noe gikk galt
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.66)', display: 'block', mt: 0.25, lineHeight: 1.45, wordBreak: 'break-word' }}
                >
                  {error}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>

        <Box sx={{ p: 2, pt: 0, flexShrink: 0, display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          {step > 0 ? (
            <Button onClick={() => setStep((s) => s - 1)} disabled={saving}
                     startIcon={<ArrowBack />}>
              Tilbake
            </Button>
          ) : <Box />}
          {isLastStep ? (
            <Button onClick={finishOnboarding} disabled={saving || loading || !canFinish}
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
