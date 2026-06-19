// @ts-nocheck
/**
 * SplitSheetRoleWizard — Slice 9X.70
 *
 * Stines feedback: "Split Sheet kan være bedre. Hvis vi er 3-5 personer som
 * jobber sammen, vil jeg kunne velge mellom likedelt, eller vekt etter
 * rolle. Foto+rediger tjener jo mer enn bare foto. Video+rediger enda mer."
 *
 * Visuell tilnærming: dark-mode-matching dashboard. Wizard med 4 steg.
 * Live forhåndsvisning i hvert steg. Tydelig vekt-indikator per rolle.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { splitSheetEvents } from '@/utils/creatorhub-events';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Chip,
  Card,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  Slider,
  LinearProgress,
  RadioGroup,
  Radio,
  FormControlLabel,
  Alert,
  InputAdornment,
  Divider,
  alpha,
  Switch,
  Select,
  MenuItem,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Close as CloseIcon,
  Group as TeamIcon,
  WorkOutline as RoleIcon,
  Tune as ModelIcon,
  CheckCircle as DoneIcon,
  AttachMoney as MoneyIcon,
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';
import TeamMembersDirectory, { loadTeamMembers, type TeamMember } from './TeamMembersDirectory';

// ─── Rolle-katalog ───────────────────────────────────────────────────
// Vekt-tall basert på Stines feedback. Admin kan flytte disse til DB
// senere. 1.0 er referansevekt (foto alene).
interface RoleDef {
  id: string;
  label: string;
  description: string;
  weight: number;
  category: 'capture' | 'edit' | 'support' | 'lead';
  emoji?: string;
}

// Foto/video — Stine (bryllup), Bjarne (individuell videograf)
const ROLE_CATALOG_VISUAL: RoleDef[] = [
  { id: 'photo',         label: 'Foto (kamera)',          description: 'Hovedkamera-arbeid på lokasjon',           weight: 1.0, category: 'capture' },
  { id: 'photo-edit',    label: 'Foto + redigering',      description: 'Skyter OG editerer egne bilder',           weight: 1.5, category: 'lead' },
  { id: 'video',         label: 'Video (kamera)',         description: 'Hovedkamera video',                        weight: 1.2, category: 'capture' },
  { id: 'video-edit',    label: 'Video + redigering',     description: 'Skyter OG klipper video',                  weight: 2.0, category: 'lead' },
  { id: 'edit-only',     label: 'Bare redigering',        description: 'Editerer andres materiale i postpro',      weight: 0.6, category: 'edit' },
  { id: 'second-shooter',label: 'Second shooter',         description: 'Sekundærkamera-støtte',                    weight: 0.8, category: 'capture' },
  { id: 'assistant',     label: 'Assistent',              description: 'Bærer utstyr, lyssetting, koordinering',   weight: 0.5, category: 'support' },
  { id: 'logistics',     label: 'Logistikk / koordinering', description: 'Pre-prod, kunde-kontakt, planlegging',  weight: 0.4, category: 'support' },
];

// Musikkprodusent — Arne. Vekter speiler bransje-standard for studio-arbeid.
const ROLE_CATALOG_MUSIC: RoleDef[] = [
  { id: 'producer',       label: 'Produsent',             description: 'Helhetlig produksjons-ansvar',             weight: 2.0, category: 'lead' },
  { id: 'songwriter',     label: 'Låtskriver',            description: 'Melodi, tekst, akkord-struktur',           weight: 1.5, category: 'lead' },
  { id: 'beatmaker',      label: 'Beatmaker',             description: 'Beats og instrumental',                    weight: 1.2, category: 'capture' },
  { id: 'vocalist',       label: 'Vokalist',              description: 'Hoved-vokal',                              weight: 1.3, category: 'capture' },
  { id: 'mix-engineer',   label: 'Mix-engineer',          description: 'Miksing av spor',                          weight: 1.0, category: 'edit' },
  { id: 'master-engineer',label: 'Master-engineer',       description: 'Mastering for distribusjon',               weight: 0.7, category: 'edit' },
  { id: 'session-musician',label: 'Session-musiker',      description: 'Bidrag på instrument',                     weight: 0.5, category: 'support' },
  { id: 'feature-artist', label: 'Feature-artist',        description: 'Gjeste-vokal eller -instrument',           weight: 0.8, category: 'capture' },
];

const ROLE_CATALOG_BY_PROFESSION: Record<string, RoleDef[]> = {
  photographer: ROLE_CATALOG_VISUAL,
  videographer: ROLE_CATALOG_VISUAL,
  enterprise: ROLE_CATALOG_VISUAL,
  vendor: ROLE_CATALOG_VISUAL,
  admin: ROLE_CATALOG_VISUAL,
  music_producer: ROLE_CATALOG_MUSIC,
};

// Default-eksport for bakoverkompatibilitet (TeamMembersDirectory leser denne).
export const ROLE_CATALOG = ROLE_CATALOG_VISUAL;

const CATEGORY_COLORS = {
  lead: '#ffba6c',
  capture: '#4cc9f0',
  edit: '#9b87f5',
  support: '#a8dadc',
};

type SplitModel = 'equal' | 'weighted' | 'manual' | 'hybrid';

interface ExternalLine {
  serviceName: string;
  pricePerImage: number; // fra vendorens katalog
  currency: string;
  qty: number; // antall bilder
}
interface Participant {
  id: string; // local id
  name: string;
  email?: string;
  roleId: string;
  manualPct?: number; // brukes i manual + hybrid
  // Eksternt firma (kostnad av-toppen, hentet fra vendorens katalog):
  isExternal?: boolean;
  vendorUserId?: string;
  vendorName?: string;
  vendorIsForeign?: boolean;
  vendorCurrency?: string;
  externalLines?: ExternalLine[];
}

// Sum av en ekstern deltakers katalog-linjer (pris/bilde × antall).
function externalCostOf(p: Participant): number {
  if (!p.isExternal || !p.externalLines) return 0;
  return p.externalLines.reduce((s, l) => s + (Number(l.pricePerImage) || 0) * (Number(l.qty) || 0), 0);
}

interface VendorCatalog {
  vendorUserId: string;
  vendorName: string;
  isInternational: boolean;
  services: Array<{ name: string | null; price: number | null; currency: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectAmount?: number; // brutto-beløp som skal splittes
  projectName?: string;
  profession?: string; // styrer hvilken rolle-katalog som vises
  /**
   * Slice 9X.74 — pre-fylte deltakere (typisk fra TeamMembersDirectory)
   * når wizard åpnes som forslag etter inquiry-konvertering.
   */
  initialParticipants?: Array<{
    id?: string;
    name: string;
    email?: string;
    roleId?: string;
  }>;
  /** Hvor wizarden ble åpnet fra — vises i headeren ("Foreslått fra forespørsel"). */
  source?: 'manual' | 'inquiry-suggestion' | 'team-onboarding';
  onSave: (data: {
    projectName: string;
    projectAmount: number;
    model: SplitModel;
    participants: Array<Participant & { sharePct: number; shareKr: number; roleLabel: string }>;
  }) => void;
}

const STEPS = ['Hvem', 'Roller', 'Modell', 'Forhåndsvis & signer'] as const;

const SplitSheetRoleWizard: React.FC<Props> = ({
  open,
  onClose,
  projectAmount: initialAmount = 25_000,
  projectName: initialName = '',
  profession = 'photographer',
  initialParticipants = [],
  source = 'manual',
  onSave,
}) => {
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState(initialName);
  const [projectAmount, setProjectAmount] = useState<number>(initialAmount);
  const [participants, setParticipants] = useState<Participant[]>(() =>
    initialParticipants.map((p, idx) => ({
      id: p.id || `p-init-${idx}`,
      name: p.name,
      email: p.email || '',
      roleId: p.roleId || 'photo',
      manualPct: initialParticipants.length > 0 ? Math.floor(100 / initialParticipants.length) : 100,
    })),
  );
  const [model, setModel] = useState<SplitModel>('weighted');
  const [hybridBasePct, setHybridBasePct] = useState(20); // base for hybrid
  const [pickerOpen, setPickerOpen] = useState(false);

  // Re-init participants når nye initial-deltakere kommer (f.eks. fra inquiry-event)
  useEffect(() => {
    if (initialParticipants.length > 0 && open) {
      setParticipants(initialParticipants.map((p, idx) => ({
        id: p.id || `p-init-${idx}`,
        name: p.name,
        email: p.email || '',
        roleId: p.roleId || 'photo',
        manualPct: Math.floor(100 / initialParticipants.length),
      })));
      // Hopp direkte til steg 2 (roller) hvis deltakere er pre-fylt
      setStep(1);
    }
  }, [open, initialParticipants]);

  // Re-init projectName + amount fra props
  useEffect(() => {
    if (open) {
      if (initialName) setProjectName(initialName);
      if (initialAmount) setProjectAmount(initialAmount);
    }
  }, [open, initialName, initialAmount]);

  const activeRoleCatalog = useMemo(
    () => ROLE_CATALOG_BY_PROFESSION[profession] || ROLE_CATALOG_VISUAL,
    [profession],
  );
  const defaultRoleId = activeRoleCatalog[0]?.id || 'photo';

  // GA4 — wizard opened
  useEffect(() => {
    if (open) splitSheetEvents.wizardOpened(profession);
  }, [open, profession]);

  // GA4 — step changed
  useEffect(() => {
    if (!open) return;
    splitSheetEvents.wizardStepCompleted(step, STEPS[step]);
  }, [step, open]);

  // GA4 — model selected
  useEffect(() => {
    if (open) splitSheetEvents.modelSelected(model);
  }, [model, open]);

  // Vendor-katalog (samme kilde som discovery) — for eksterne deltakere.
  const { data: vendorsData } = useQuery<{ vendors: VendorCatalog[] }>({
    queryKey: ["/api/editing/vendors"],
    queryFn: () => apiRequest("/api/editing/vendors"),
    enabled: open,
  });
  const vendorCatalog: VendorCatalog[] = vendorsData?.vendors ?? [];

  // Valutakurs → NOK. Backend /api/fx/nok: Norges Bank offisiell daglig referansekurs
  // (primær), open.er-api.com (fallback). rates[X] = NOK per 1 enhet av X.
  const { data: fxData, dataUpdatedAt: fxFetchedAt, isFetching: fxFetching, refetch: refetchFx } = useQuery<{
    rates?: Record<string, number>;
    source?: string;
    asOf?: string | null;
  }>({
    queryKey: ["fx-nok"],
    queryFn: () => apiRequest("/api/fx/nok"),
    enabled: open,
    staleTime: 60 * 60 * 1000, // 1t: kursen refetches automatisk når den blir stale
    refetchOnWindowFocus: true,
  });
  const fxRates = fxData?.rates || {};
  const fxSource = fxData?.source || "";
  const fxAsOf = fxData?.asOf || (fxFetchedAt ? new Date(fxFetchedAt).toISOString().slice(0, 10) : null);
  const toNok = (amount: number, currency: string): number => {
    if (!currency || currency === "NOK") return amount;
    const r = fxRates[currency.toUpperCase()]; // NOK per enhet
    return r && r > 0 ? amount * r : amount; // fallback: anta NOK om kurs mangler
  };
  // Ekstern deltakers kostnad i NOK (konvertert fra katalog-valuta).
  const costNok = (p: Participant): number => {
    if (!p.isExternal || !p.externalLines) return 0;
    return p.externalLines.reduce((s, l) => s + toNok((Number(l.pricePerImage) || 0) * (Number(l.qty) || 0), l.currency), 0);
  };

  // ─── Beregn shares (ekstern vendor-kostnad av-toppen i NOK, så splitt resten) ──
  const externalTotal = participants.reduce((s, p) => s + costNok(p), 0);
  const splittable = Math.max(0, projectAmount - externalTotal);

  const computedSplits = useMemo(() => {
    if (participants.length === 0) return [];
    const internals = participants.filter((p) => !p.isExternal);
    const n = internals.length;
    const totalWeight = internals.reduce(
      (sum, q) => sum + (activeRoleCatalog.find((r) => r.id === q.roleId)?.weight || 1), 0,
    );
    // Intern andel (% av splittable) per intern deltaker, basert på modell.
    const internalPct = (p: Participant): number => {
      if (n === 0) return 0;
      const w = activeRoleCatalog.find((r) => r.id === p.roleId)?.weight || 1;
      if (model === 'equal') return 100 / n;
      if (model === 'manual') return p.manualPct ?? 100 / n;
      if (model === 'weighted') return totalWeight > 0 ? (w / totalWeight) * 100 : 0;
      // hybrid: base + vekt på resten
      const remainingPct = Math.max(0, 100 - hybridBasePct * n);
      return hybridBasePct + (totalWeight > 0 ? (w / totalWeight) * remainingPct : 0);
    };
    const pctOfTotal = (kr: number) => (projectAmount > 0 ? (kr / projectAmount) * 100 : 0);
    return participants.map((p) => {
      if (p.isExternal) {
        const cost = costNok(p); // i NOK (konvertert fra katalog-valuta)
        return { ...p, sharePct: pctOfTotal(cost), shareKr: cost, roleLabel: p.vendorName || 'Eksternt firma' };
      }
      const role = activeRoleCatalog.find((r) => r.id === p.roleId);
      const kr = (internalPct(p) / 100) * splittable;
      return { ...p, sharePct: pctOfTotal(kr), shareKr: kr, roleLabel: role?.label || '—' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, model, projectAmount, splittable, hybridBasePct, activeRoleCatalog, fxData]);

  const totalPct = computedSplits.reduce((s, p) => s + p.sharePct, 0);

  // ─── Handlers ──────────────────────────────────────────────────
  const addParticipant = () => {
    splitSheetEvents.participantAdded('manual', defaultRoleId);
    setParticipants((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}-${prev.length}`,
        name: '',
        email: '',
        roleId: defaultRoleId,
        manualPct: prev.length > 0 ? Math.floor(100 / (prev.length + 1)) : 100,
      },
    ]);
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const updateParticipant = (id: string, patch: Partial<Participant>) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const canProceed = (() => {
    if (step === 0) return participants.length >= 2 && participants.every((p) => p.name.trim().length > 0);
    if (step === 1) return participants.every((p) => p.roleId);
    if (step === 2) {
      if (model === 'manual') return Math.abs(totalPct - 100) < 0.5;
      return true;
    }
    return true;
  })();

  const handleSave = () => {
    splitSheetEvents.saved({
      model,
      participantCount: computedSplits.length,
      totalAmount: projectAmount,
      profession,
    });
    onSave({
      projectName: projectName.trim() || 'Uten navn',
      projectAmount,
      model,
      participants: computedSplits,
    });
    onClose();
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: 'radial-gradient(circle at top, rgba(255,186,108,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
          color: '#fff5e8',
          border: '1px solid rgba(255,186,108,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          minHeight: '70vh',
          '& .MuiInputLabel-root': { color: 'rgba(246,242,234,0.72)' },
          '& .MuiInputLabel-root.Mui-focused': { color: '#ffba6c' },
          '& .MuiOutlinedInput-root': {
            color: '#fff5e8',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
            '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
          },
          '& .MuiStepLabel-label': { color: 'rgba(246,242,234,0.62)' },
          '& .MuiStepLabel-label.Mui-active': { color: '#ffba6c', fontWeight: 700 },
          '& .MuiStepLabel-label.Mui-completed': { color: '#fff5e8' },
          '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.22)' },
          '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': { color: '#ffba6c' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3,
        pt: 3,
        pb: 2,
        background: 'linear-gradient(135deg, rgba(255,186,108,0.16), rgba(255,186,108,0.02))',
        borderBottom: '1px solid rgba(255,186,108,0.18)',
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,186,108,0.18)', color: '#ffba6c' }}>
              <MoneyIcon />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>
                {source === 'inquiry-suggestion' ? 'Forslag fra forespørsel' : 'Split Sheet'}
              </Typography>
              <Typography variant="h5" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Fordel honorar i team
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(246,242,234,0.72)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Slice 9X.74 — banner når wizarden åpnes som inquiry-forslag */}
        {source === 'inquiry-suggestion' && (
          <Alert
            severity="info"
            sx={{
              mb: 2,
              bgcolor: 'rgba(76,201,240,0.10)',
              color: '#fff5e8',
              border: '1px solid rgba(76,201,240,0.32)',
              '& .MuiAlert-icon': { color: '#4cc9f0' },
            }}
          >
            Vi har pre-fylt dette med budsjettet fra forespørselen og dine vanlige team-medlemmer.
            Sjekk rollene og tilpass om nødvendig.
          </Alert>
        )}

        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label, i) => (
            <Step key={label}>
              <StepLabel
                StepIconComponent={({ active, completed }) => {
                  const Icon = [TeamIcon, RoleIcon, ModelIcon, DoneIcon][i];
                  return (
                    <Box sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: active || completed ? '#ffba6c' : 'rgba(255,255,255,0.10)',
                      color: active || completed ? '#150d05' : 'rgba(246,242,234,0.5)',
                      transition: 'all 0.3s',
                    }}>
                      <Icon fontSize="small" />
                    </Box>
                  );
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {/* STEG 1: Hvem */}
        {step === 0 && (
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Prosjekt-navn"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                fullWidth
                placeholder="F.eks. Bryllup Anna & Bob"
              />
              <TextField
                label="Brutto-beløp"
                type="number"
                value={projectAmount || ''}
                onChange={(e) => setProjectAmount(Number(e.target.value) || 0)}
                sx={{ minWidth: 200 }}
                InputProps={{ endAdornment: <InputAdornment position="end" sx={{ color: 'rgba(246,242,234,0.72)' }}>kr</InputAdornment> }}
              />
            </Stack>

            <Box sx={{ pt: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Team-medlemmer ({participants.length})
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    startIcon={<TeamIcon />}
                    onClick={() => setPickerOpen(true)}
                    variant="outlined"
                    sx={{
                      borderRadius: '999px',
                      px: 2,
                      py: 0.75,
                      textTransform: 'none',
                      color: '#fff5e8',
                      borderColor: 'rgba(255,186,108,0.32)',
                      '&:hover': { borderColor: '#ffba6c', bgcolor: 'rgba(255,186,108,0.08)' },
                    }}
                  >
                    Velg fra team
                  </Button>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addParticipant}
                    sx={{
                      borderRadius: '999px',
                      px: 2,
                      py: 0.75,
                      bgcolor: '#ffba6c',
                      color: '#150d05',
                      fontWeight: 700,
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#ffc788' },
                    }}
                  >
                    Engangs-person
                  </Button>
                </Stack>
              </Stack>

              {participants.length === 0 ? (
                <Card sx={{
                  p: 4,
                  textAlign: 'center',
                  border: '1px dashed rgba(255,186,108,0.32)',
                  bgcolor: 'rgba(255,186,108,0.03)',
                  borderRadius: 3,
                  boxShadow: 'none',
                  color: 'rgba(246,242,234,0.72)',
                }}>
                  <TeamIcon sx={{ fontSize: 48, color: 'rgba(255,186,108,0.4)', mb: 1 }} />
                  <Typography variant="body2">
                    Legg til minst 2 personer for å starte
                  </Typography>
                </Card>
              ) : (
                <Stack spacing={1.5}>
                  {participants.map((p, idx) => (
                    <Card
                      key={p.id}
                      sx={{
                        p: 2,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        boxShadow: 'none',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'rgba(255,186,108,0.32)' },
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{
                          bgcolor: alpha('#ffba6c', 0.18),
                          color: '#ffba6c',
                          fontSize: 14,
                          fontWeight: 700,
                        }}>
                          {idx + 1}
                        </Avatar>
                        <TextField
                          size="small"
                          placeholder="Navn"
                          value={p.name}
                          onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          size="small"
                          placeholder="E-post (valgfri)"
                          value={p.email}
                          onChange={(e) => updateParticipant(p.id, { email: e.target.value })}
                          sx={{ flex: 1 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => removeParticipant(p.id)}
                          sx={{ color: 'rgba(246,242,234,0.5)', '&:hover': { color: '#f44336' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>

                      {/* Eksternt firma: velg vendor + flere produkter fra katalogen × antall (kostnad av-toppen). */}
                      <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                          <Switch
                            size="small"
                            checked={!!p.isExternal}
                            onChange={(e) =>
                              updateParticipant(p.id, e.target.checked
                                ? { isExternal: true }
                                : { isExternal: false, vendorUserId: undefined, externalLines: [] })}
                          />
                        }
                        label={<Typography variant="caption">Eksternt firma (kostnad av-toppen)</Typography>}
                      />
                      {p.isExternal && (
                        <Stack spacing={1} sx={{ mt: 0.5, pl: 1 }}>
                          <Select
                            size="small"
                            displayEmpty
                            value={p.vendorUserId || ''}
                            onChange={(e) => {
                              const v = vendorCatalog.find((x) => x.vendorUserId === e.target.value);
                              updateParticipant(p.id, {
                                vendorUserId: v?.vendorUserId,
                                vendorName: v?.vendorName,
                                name: p.name || v?.vendorName || '',
                                vendorIsForeign: !!v?.isInternational,
                                vendorCurrency: v?.services?.[0]?.currency || 'NOK',
                                externalLines: [],
                              });
                            }}
                          >
                            <MenuItem value=""><em>Velg leverandør…</em></MenuItem>
                            {vendorCatalog.map((v) => (
                              <MenuItem key={v.vendorUserId} value={v.vendorUserId}>
                                {v.vendorName}{v.isInternational ? ' (utland)' : ''}
                              </MenuItem>
                            ))}
                          </Select>
                          {p.vendorUserId && (() => {
                            const v = vendorCatalog.find((x) => x.vendorUserId === p.vendorUserId);
                            const services = v?.services || [];
                            const lines = p.externalLines || [];
                            return (
                              <>
                                {lines.map((l, li) => (
                                  <Stack key={li} direction="row" spacing={1} alignItems="center">
                                    <Select
                                      size="small"
                                      value={l.serviceName}
                                      sx={{ flex: 1 }}
                                      onChange={(e) => {
                                        const svc = services.find((s) => (s.name || '') === e.target.value);
                                        const next = [...lines];
                                        next[li] = { ...l, serviceName: String(e.target.value), pricePerImage: svc?.price || 0, currency: svc?.currency || p.vendorCurrency || 'NOK' };
                                        updateParticipant(p.id, { externalLines: next });
                                      }}
                                    >
                                      {services.map((s, si) => (
                                        <MenuItem key={si} value={s.name || ''}>
                                          {s.name} ({s.price ?? '—'} {s.currency}/bilde)
                                        </MenuItem>
                                      ))}
                                    </Select>
                                    <TextField
                                      size="small"
                                      type="number"
                                      placeholder="Antall"
                                      value={l.qty || ''}
                                      sx={{ width: 90 }}
                                      InputProps={{ endAdornment: <InputAdornment position="end">stk</InputAdornment> }}
                                      onChange={(e) => {
                                        const next = [...lines];
                                        next[li] = { ...l, qty: Number(e.target.value) || 0 };
                                        updateParticipant(p.id, { externalLines: next });
                                      }}
                                    />
                                    <Typography variant="caption" sx={{ minWidth: 84, textAlign: 'right' }}>
                                      {((l.pricePerImage || 0) * (l.qty || 0)).toLocaleString('nb-NO')} {l.currency}
                                    </Typography>
                                    <IconButton size="small" onClick={() => updateParticipant(p.id, { externalLines: lines.filter((_, i) => i !== li) })}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                ))}
                                <Button
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => updateParticipant(p.id, {
                                    externalLines: [...lines, { serviceName: services[0]?.name || '', pricePerImage: services[0]?.price || 0, currency: services[0]?.currency || 'NOK', qty: 1 }],
                                  })}
                                  sx={{ alignSelf: 'flex-start' }}
                                >
                                  Legg til produkt
                                </Button>
                                <Typography variant="caption" sx={{ color: p.vendorIsForeign ? '#ffb74d' : 'rgba(246,242,234,0.6)' }}>
                                  Kostnad: {externalCostOf(p).toLocaleString('nb-NO')} {p.vendorCurrency}
                                  {p.vendorCurrency && p.vendorCurrency !== 'NOK' && (
                                    <> · ≈ {Math.round(costNok(p)).toLocaleString('nb-NO')} kr (1 {p.vendorCurrency} = {fxRates[p.vendorCurrency.toUpperCase()] ? fxRates[p.vendorCurrency.toUpperCase()].toFixed(2) : '—'} kr)</>
                                  )}
                                  {' · '}{p.vendorIsForeign ? 'utland → snudd avregning (ingen norsk MVA på andelen)' : 'innenlands → 25 % MVA'}
                                </Typography>
                              </>
                            );
                          })()}
                        </Stack>
                      )}
                    </Card>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        )}

        {/* STEG 2: Roller */}
        {step === 1 && (
          <Stack spacing={2}>
            <Alert
              severity="info"
              icon={<AutoIcon />}
              sx={{
                bgcolor: 'rgba(76,201,240,0.10)',
                color: '#fff5e8',
                border: '1px solid rgba(76,201,240,0.32)',
                '& .MuiAlert-icon': { color: '#4cc9f0' },
              }}
            >
              Hver rolle har en vekt som reflekterer typisk arbeidsmengde. Foto + redigering tjener mer enn bare foto, video + redigering enda mer.
            </Alert>

            {participants.map((p) => {
              const role = activeRoleCatalog.find((r) => r.id === p.roleId);
              return (
                <Card
                  key={p.id}
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    boxShadow: 'none',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: alpha('#ffba6c', 0.18), color: '#ffba6c' }}>
                      {p.name.charAt(0).toUpperCase() || '?'}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>{p.name || 'Uten navn'}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)' }}>
                        {role ? `Vekt: ${role.weight.toFixed(1)}` : 'Velg rolle nedenfor'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1 }}>
                    {activeRoleCatalog.map((r) => {
                      const active = p.roleId === r.id;
                      const color = CATEGORY_COLORS[r.category];
                      return (
                        <Card
                          key={r.id}
                          onClick={() => updateParticipant(p.id, { roleId: r.id })}
                          sx={{
                            p: 1.25,
                            cursor: 'pointer',
                            bgcolor: active ? alpha(color, 0.18) : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 1.5,
                            boxShadow: 'none',
                            transition: 'all 0.15s',
                            '&:hover': { borderColor: color, transform: 'translateY(-1px)' },
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: active ? color : '#fff5e8' }}>
                              {r.label}
                            </Typography>
                            <Chip
                              size="small"
                              label={`×${r.weight}`}
                              sx={{
                                height: 18,
                                fontSize: '0.66rem',
                                bgcolor: alpha(color, 0.25),
                                color,
                                fontWeight: 700,
                              }}
                            />
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)', display: 'block', lineHeight: 1.4 }}>
                            {r.description}
                          </Typography>
                        </Card>
                      );
                    })}
                  </Box>
                </Card>
              );
            })}
          </Stack>
        )}

        {/* STEG 3: Modell */}
        {step === 2 && (
          <Stack spacing={2}>
            <RadioGroup value={model} onChange={(e) => setModel(e.target.value as SplitModel)}>
              {([
                { v: 'weighted', label: 'Vekt-basert (anbefalt)', desc: 'Hver person får andel proporsjonalt til rolle-vekten' },
                { v: 'equal', label: 'Lik splitt', desc: 'Alle får samme prosent uansett rolle' },
                { v: 'hybrid', label: 'Hybrid: base + vekt-bonus', desc: 'Alle får like base, deretter ekstra etter rolle' },
                { v: 'manual', label: 'Manuelt', desc: 'Du setter prosentene selv (må summere til 100)' },
              ] as const).map((opt) => {
                const active = model === opt.v;
                return (
                  <Card
                    key={opt.v}
                    onClick={() => setModel(opt.v)}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      bgcolor: active ? 'rgba(255,186,108,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? '#ffba6c' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 2,
                      boxShadow: 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <FormControlLabel
                      value={opt.v}
                      control={<Radio sx={{ color: 'rgba(246,242,234,0.5)', '&.Mui-checked': { color: '#ffba6c' } }} />}
                      label={
                        <Box sx={{ ml: 0.5 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: active ? '#ffba6c' : '#fff5e8' }}>
                            {opt.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)' }}>
                            {opt.desc}
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Card>
                );
              })}
            </RadioGroup>

            {model === 'hybrid' && (
              <Card sx={{ p: 2.5, bgcolor: 'rgba(255,186,108,0.06)', border: '1px solid rgba(255,186,108,0.18)', boxShadow: 'none' }}>
                <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Base per person: {hybridBasePct}%
                </Typography>
                <Slider
                  value={hybridBasePct}
                  onChange={(_, v) => setHybridBasePct(Math.min(100 / participants.length, v as number))}
                  min={0}
                  max={Math.floor(100 / Math.max(1, participants.length))}
                  step={1}
                  sx={{
                    color: '#ffba6c',
                    '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.12)' },
                  }}
                />
                <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)' }}>
                  Resterende {100 - hybridBasePct * participants.length}% fordeles etter rolle-vekt.
                </Typography>
              </Card>
            )}

            {model === 'manual' && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Sett prosenter manuelt:</Typography>
                {participants.map((p) => (
                  <Card key={p.id} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none' }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Typography sx={{ flex: 1 }}>{p.name}</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={p.manualPct ?? 0}
                        onChange={(e) => updateParticipant(p.id, { manualPct: Number(e.target.value) })}
                        InputProps={{ endAdornment: <InputAdornment position="end" sx={{ color: 'rgba(246,242,234,0.72)' }}>%</InputAdornment> }}
                        sx={{ width: 120 }}
                      />
                    </Stack>
                  </Card>
                ))}
                <Box sx={{
                  p: 1.5,
                  bgcolor: Math.abs(totalPct - 100) < 0.5 ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                  border: `1px solid ${Math.abs(totalPct - 100) < 0.5 ? 'rgba(76,175,80,0.4)' : 'rgba(244,67,54,0.4)'}`,
                  borderRadius: 1.5,
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Total: {totalPct.toFixed(1)}% {Math.abs(totalPct - 100) < 0.5 ? '✓' : '— må summere til 100'}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Stack>
        )}

        {/* STEG 4: Forhåndsvisning + signering */}
        {step === 3 && (
          <Stack spacing={2.5}>
            <Card sx={{
              p: 3,
              background: 'linear-gradient(135deg, rgba(255,186,108,0.16), rgba(255,186,108,0.04))',
              border: '1px solid rgba(255,186,108,0.32)',
              borderRadius: 2,
              boxShadow: 'none',
            }}>
              <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>Total</Typography>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h3" sx={{ fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif' }}>
                  {projectAmount.toLocaleString('nb-NO')}
                </Typography>
                <Typography variant="h6" sx={{ color: 'rgba(246,242,234,0.62)' }}>kr</Typography>
              </Stack>
              {/* MVA-oppdeling (samme modell som editing-marketplace + Fiken). */}
              {(() => {
                // Utenlandske eksterne andeler = snudd avregning (ingen norsk MVA).
                const foreignExternal = participants
                  .filter((p) => p.isExternal && p.vendorIsForeign)
                  .reduce((s, p) => s + externalCostOf(p), 0);
                const mvaBase = Math.max(0, projectAmount - foreignExternal);
                const mva = Math.round(mvaBase * 0.25);
                return (
                  <Box sx={{ mt: 1, mb: 1, color: 'rgba(246,242,234,0.82)' }}>
                    {foreignExternal > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>Snudd avregning (utland)</span><span>{foreignExternal.toLocaleString('nb-NO')} kr</span>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>+ 25 % MVA (MVA-grunnlag {mvaBase.toLocaleString('nb-NO')})</span><span>{mva.toLocaleString('nb-NO')} kr</span>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.12)', mt: 0.5, pt: 0.5 }}>
                      <span>Totalt inkl. MVA</span><span>{(projectAmount + mva).toLocaleString('nb-NO')} kr</span>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'rgba(246,242,234,0.55)' }}>
                      Utenlandsk eksternt firma: snudd avregning — andelen utbetales uten norsk MVA; mottaker selv-avregner. Innenlands andel + provisjon: 25 % MVA.
                    </Typography>
                  </Box>
                );
              })()}
              <Typography variant="body2" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                {projectName || 'Uten prosjektnavn'} · {participants.length} personer · {model === 'weighted' ? 'Vekt-basert' : model === 'equal' ? 'Lik splitt' : model === 'hybrid' ? 'Hybrid' : 'Manuelt'}
              </Typography>
              {/* Valutakurs-info — vises når en ekstern vendor har annen valuta enn NOK. */}
              {participants.some((p) => p.isExternal && p.vendorCurrency && p.vendorCurrency !== 'NOK') && (
                <Chip
                  size="small"
                  variant="outlined"
                  onClick={() => refetchFx()}
                  label={fxFetching
                    ? 'Henter kurs…'
                    : `Kurs: ${fxSource === 'norges-bank' ? 'Norges Bank' : (fxSource || '—')} · ${fxAsOf || '—'} · trykk for å oppdatere`}
                  sx={{ mt: 1, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5, fontSize: 11 } }}
                />
              )}
            </Card>

            {/* Pie chart visualisering */}
            <Card sx={{
              p: 2.5,
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              boxShadow: 'none',
            }}>
              <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.14em', mb: 1, display: 'block' }}>
                Fordeling
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={computedSplits.map((s) => ({ name: s.name || 'Uten navn', value: s.shareKr, pct: s.sharePct, role: s.roleLabel }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="rgba(15,10,7,0.95)"
                      strokeWidth={2}
                      label={({ name, pct }) => `${name} · ${pct.toFixed(1)}%`}
                      labelLine={{ stroke: 'rgba(246,242,234,0.4)' }}
                    >
                      {computedSplits.map((_, idx) => {
                        const palette = ['#ffba6c', '#4cc9f0', '#9b87f5', '#a8dadc', '#f4a261', '#e76f51', '#80ed99', '#ffd166'];
                        return <Cell key={idx} fill={palette[idx % palette.length]} />;
                      })}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        background: 'rgba(15,10,7,0.96)',
                        border: '1px solid rgba(255,186,108,0.32)',
                        borderRadius: 8,
                        color: '#fff5e8',
                      }}
                      formatter={(value: any, _name: any, props: any) => [
                        `${Number(value).toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr (${props.payload.pct.toFixed(1)}%)`,
                        props.payload.role,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Card>

            <Stack spacing={1}>
              {computedSplits.map((split, idx) => (
                <Card
                  key={split.id}
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    boxShadow: 'none',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: alpha('#ffba6c', 0.18), color: '#ffba6c', fontWeight: 700 }}>
                      {split.name.charAt(0).toUpperCase() || (idx + 1).toString()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>{split.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)' }}>
                        {split.roleLabel}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#ffba6c', fontFamily: '"Space Grotesk", sans-serif' }}>
                        {split.shareKr.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)' }}>
                        {split.sharePct.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, split.sharePct)}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: '#ffba6c',
                        borderRadius: 3,
                      },
                    }}
                  />
                </Card>
              ))}
            </Stack>

            <Alert
              severity="info"
              sx={{
                bgcolor: 'rgba(255,186,108,0.08)',
                color: '#fff5e8',
                border: '1px solid rgba(255,186,108,0.22)',
                '& .MuiAlert-icon': { color: '#ffba6c' },
              }}
            >
              Etter "Opprett & send" får hvert team-medlem en e-post med signerings-lenke. Splitt-en aktiveres når alle har signert.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{
        px: 3,
        py: 2.5,
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
              borderRadius: '999px',
              px: 3,
              py: 1.1,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: '#ffba6c',
              color: '#150d05',
              '&:hover': { bgcolor: '#ffc788' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,186,108,0.3)', color: 'rgba(21,13,5,0.5)' },
            }}
          >
            Fortsett
          </Button>
        ) : (
          <Button
            endIcon={<DoneIcon />}
            variant="contained"
            onClick={handleSave}
            sx={{
              borderRadius: '999px',
              px: 3,
              py: 1.1,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: '#ffba6c',
              color: '#150d05',
              '&:hover': { bgcolor: '#ffc788' },
            }}
          >
            Opprett & send for signering
          </Button>
        )}
      </DialogActions>

      {/* Team-picker overlay */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            background: 'radial-gradient(circle at top, rgba(255,186,108,0.10) 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)',
            color: '#fff5e8',
            border: '1px solid rgba(255,186,108,0.18)',
            maxHeight: '85vh',
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>
                Velg medlemmer
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Fra team-direktoratet</Typography>
            </Box>
            <IconButton onClick={() => setPickerOpen(false)} sx={{ color: 'rgba(246,242,234,0.72)' }}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <TeamMembersDirectory
            mode="picker"
            profession={profession}
            initialPickedIds={[]}
            onPick={(picked) => {
              const newOnes: Participant[] = picked
                .filter((m) => !participants.some((p) => p.name === m.name && p.email === m.email))
                .map((m) => ({
                  id: `p-${Date.now()}-${m.id}`,
                  name: m.name,
                  email: m.email,
                  roleId: activeRoleCatalog.find((r) => r.id === m.defaultRoleId) ? m.defaultRoleId! : defaultRoleId,
                  manualPct: 0,
                }));
              splitSheetEvents.participantAdded('team_picker', defaultRoleId);
              setParticipants((prev) => [...prev, ...newOnes]);
              setPickerOpen(false);
            }}
          />
        </Box>
      </Dialog>
    </Dialog>
  );
};

export default SplitSheetRoleWizard;
