import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AddOutlined as AddIcon,
  ArrowForwardOutlined as ArrowIcon,
  CalendarMonthOutlined as CalendarIcon,
  DeleteOutline as DeleteIcon,
  ExpandMoreOutlined as ExpandMoreIcon,
  GroupsOutlined as CrewIcon,
  MapOutlined as MapIcon,
  MyLocationOutlined as MyLocationIcon,
  OpenInNewOutlined as OpenInNewIcon,
  PhotoCameraOutlined as PhotoCameraIcon,
  OpenInFullOutlined as FullWorkspaceIcon,
  RefreshOutlined as RefreshIcon,
  SaveOutlined as SaveIcon,
  SyncOutlined as SyncIcon,
  ShieldOutlined as ShieldIcon,
  WarningAmberOutlined as RiskIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  Location,
  LocationDecisionStatus,
  LocationGateStatus,
  LocationManagerOperations,
  LocationWorkflowStage,
} from '../../models/casting';
import { useBeforeUnloadIfDirty } from '../../hooks/useBeforeUnloadIfDirty';
import {
  LocationOperationsConflictError,
  LocationOperationsNetworkError,
  locationManagerService,
  type LocationScoutMedia,
} from '../../services/locationManagerService';
import {
  locationManagerOfflineStore,
} from '../../services/locationManagerOfflineStore';
import {
  buildLocationManagerOperations,
  locationReadiness,
  mergeLocationOperations,
  portfolioReadiness,
} from './locationManagerWorkspaceModel';

interface Props {
  project: CastingProject;
  readOnly?: boolean;
  onOpenLocations: () => void;
  onOpenSchedule: () => void;
  onOpenCrew: () => void;
  onOpenFullWorkspace: () => void;
}

const STAGE_LABELS: Record<LocationWorkflowStage, string> = {
  need: 'Behov',
  scouting: 'Scout',
  recce: 'Recce',
  hold: 'Hold',
  cleared: 'Klarert',
  shoot_ready: 'Opptaksklar',
  wrapped: 'Tilbakestilt',
};

const DECISION_LABELS: Record<LocationDecisionStatus, string> = {
  undecided: 'Ikke avgjort',
  shortlisted: 'Kortlistet',
  primary: 'Primær',
  backup: 'Backup',
  released: 'Frigitt',
};

const GATE_LABELS: Record<LocationGateStatus, string> = {
  missing: 'Mangler',
  requested: 'Forespurt',
  in_progress: 'Pågår',
  verified: 'Verifisert',
  blocked: 'Blokkert',
  not_required: 'Ikke nødvendig',
};

const CONTACT_LABELS: Record<LocationManagerOperations['ownerCommunication']['status'], string> = {
  not_started: 'Ikke kontaktet',
  contacted: 'Kontaktet',
  awaiting_reply: 'Venter svar',
  negotiating: 'Forhandler',
  agreed: 'Avtalt',
  declined: 'Avslått',
};

const RECCE_LABELS: Record<LocationManagerOperations['recce']['status'], string> = {
  not_started: 'Ikke planlagt',
  scheduled: 'Planlagt',
  in_progress: 'Pågår',
  completed: 'Godkjent',
  changes_required: 'Krever endring',
};

const panelSx = {
  bgcolor: 'rgba(7, 17, 31, .88)',
  border: '1px solid rgba(45, 212, 191, .18)',
  color: '#f8fafc',
  borderRadius: 3,
};

const fieldSx = {
  '& .MuiInputBase-root': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,.025)', minHeight: 48 },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& .MuiFormHelperText-root': { color: 'rgba(226,232,240,.55)' },
  '& fieldset': { borderColor: 'rgba(94,234,212,.25)' },
};

const toLocalDateTime = (value?: string): string => value ? value.slice(0, 16) : '';

interface WorkflowSectionProps {
  compact: boolean;
  title: string;
  description: string;
  defaultExpanded?: boolean;
  summary?: ReactNode;
  children: ReactNode;
}

function WorkflowSection({ compact, title, description, defaultExpanded = false, summary, children }: WorkflowSectionProps) {
  if (!compact) {
    return (
      <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
          <Box>
            <Typography component="h3" variant="h6" fontWeight={800}>{title}</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,.56)', fontSize: '.8rem', mb: 2 }}>{description}</Typography>
          </Box>
          {summary}
        </Stack>
        {children}
      </Card>
    );
  }
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      sx={{
        ...panelSx,
        overflow: 'hidden',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { my: 0 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: '#99f6e4' }} />}
        sx={{ minHeight: 64, px: 1.5, '&.Mui-expanded': { minHeight: 64 }, '& .MuiAccordionSummary-content': { my: 1.2, minWidth: 0 } }}
      >
        <Box sx={{ minWidth: 0, width: '100%', pr: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography component="span" variant="subtitle1" fontWeight={850}>{title}</Typography>
            {summary}
          </Stack>
          <Typography noWrap sx={{ color: 'rgba(226,232,240,.54)', fontSize: '.75rem', mt: .2 }}>{description}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 1.5, pt: .5, pb: 1.75 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 55) return '#fbbf24';
  return '#fb7185';
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString('nb-NO')} ${currency}`;
  }
}

export function LocationManagerWorkspace({
  project,
  readOnly = false,
  onOpenLocations,
  onOpenSchedule,
  onOpenCrew,
  onOpenFullWorkspace,
}: Props) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const [locations, setLocations] = useState<Location[]>(() => project.locations ?? []);
  const [selectedLocationId, setSelectedLocationId] = useState(() => project.locations?.[0]?.id ?? '');
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? locations[0];
  const [operations, setOperations] = useState<LocationManagerOperations | null>(
    selectedLocation ? buildLocationManagerOperations(selectedLocation, project) : null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [media, setMedia] = useState<LocationScoutMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const { confirmIfDirty } = useBeforeUnloadIfDirty({
    isDirty: dirty,
    message: 'Lokasjonen har ulagrede feltendringer. Vil du forlate den?',
  });

  const loadOperations = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    const baseLocations = project.locations ?? [];
    try {
      const [records, pending] = await Promise.all([
        locationManagerService.list(project.id),
        locationManagerOfflineStore.list(project.id),
      ]);
      const byLocationId = new Map(records.map((record) => [record.locationId, record]));
      const pendingByLocationId = new Map(pending.map((record) => [record.locationId, record]));
      setLocations(baseLocations.map((location) => {
        const local = pendingByLocationId.get(location.id);
        if (local) {
          return mergeLocationOperations(location, local.operations, local.expectedVersion);
        }
        const record = byLocationId.get(location.id);
        return record
          ? mergeLocationOperations(location, record.operations, record.version, record.updatedAt, record.updatedBy)
          : location;
      }));
      setPendingCount(pending.length);
      if (pending.length > 0) {
        setFeedback({ type: 'warning', text: `${pending.length} lokal endring venter på synkronisering.` });
      }
    } catch (error) {
      setLocations(baseLocations);
      setFeedback({
        type: 'warning',
        text: error instanceof Error
          ? `${error.message} Prosjektets lokasjoner vises fortsatt, men endringer bør ikke lagres før forbindelsen er tilbake.`
          : 'Kunne ikke hente lagret lokasjonsberedskap.',
      });
    } finally {
      setLoading(false);
    }
  }, [project.id, project.locations]);

  useEffect(() => { void loadOperations(); }, [loadOperations]);

  const syncPending = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const pending = await locationManagerOfflineStore.list(project.id);
    if (pending.length === 0) {
      setPendingCount(0);
      return;
    }
    setSyncing(true);
    for (const item of pending) {
      try {
        const saved = await locationManagerService.save(
          item.projectId,
          item.locationId,
          item.expectedVersion,
          item.operations,
        );
        await locationManagerOfflineStore.remove(item.id);
        setLocations((locationsCurrent) => locationsCurrent.map((location) => location.id === saved.locationId
          ? mergeLocationOperations(location, saved.operations, saved.version, saved.updatedAt, saved.updatedBy)
          : location));
        if (item.locationId === selectedLocationId) setOperations(saved.operations);
      } catch (error) {
        await locationManagerOfflineStore.incrementAttempts(item);
        if (error instanceof LocationOperationsConflictError) {
          setFeedback({ type: 'warning', text: 'Den lokale feltversjonen kolliderer med en nyere serverversjon. Den er bevart lokalt og må sammenlignes før den kan synkroniseres.' });
        } else if (!(error instanceof LocationOperationsNetworkError)) {
          setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Synkronisering av feltdata feilet.' });
        }
        break;
      }
    }
    setPendingCount((await locationManagerOfflineStore.list(project.id)).length);
    setSyncing(false);
  }, [project.id, selectedLocationId]);

  useEffect(() => {
    const refreshCount = async () => setPendingCount((await locationManagerOfflineStore.list(project.id)).length);
    void refreshCount();
    const handleOnline = () => {
      setOnline(true);
      void syncPending();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [project.id, syncPending]);

  useEffect(() => {
    if (!selectedLocationId || !online) {
      setMedia([]);
      return;
    }
    let active = true;
    setMediaLoading(true);
    void locationManagerService.listMedia(project.id, selectedLocationId)
      .then((items) => { if (active) setMedia(items); })
      .catch(() => { if (active) setMedia([]); })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, [online, project.id, selectedLocationId]);

  useEffect(() => {
    setSelectedLocationId((current) => locations.some((location) => location.id === current)
      ? current
      : locations[0]?.id ?? '');
  }, [locations]);

  useEffect(() => {
    if (!selectedLocation) {
      setOperations(null);
      setDirty(false);
      return;
    }
    setOperations(buildLocationManagerOperations(selectedLocation, project));
    setDirty(false);
  }, [project, selectedLocation]);

  const updateOperations = (updater: (current: LocationManagerOperations) => LocationManagerOperations) => {
    if (readOnly) return;
    setOperations((current) => current ? updater(current) : current);
    setDirty(true);
    setFeedback(null);
  };

  const selectLocation = (locationId: string) => {
    if (locationId === selectedLocationId || !confirmIfDirty()) return;
    setSelectedLocationId(locationId);
    setFeedback(null);
  };

  const save = async () => {
    if (!selectedLocation || !operations || readOnly) return;
    setSaving(true);
    setFeedback(null);
    const queueLocally = async () => {
      await locationManagerOfflineStore.put({
        projectId: project.id,
        locationId: selectedLocation.id,
        expectedVersion: Number(selectedLocation.locationOperationsVersion ?? 0),
        operations,
      });
      setLocations((items) => items.map((location) => location.id === selectedLocation.id
        ? mergeLocationOperations(location, operations, Number(selectedLocation.locationOperationsVersion ?? 0))
        : location));
      setPendingCount((await locationManagerOfflineStore.list(project.id)).length);
      setDirty(false);
      setFeedback({ type: 'warning', text: 'Lagret lokalt. Endringen synkroniseres automatisk når forbindelsen er tilbake.' });
    };
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueLocally();
        return;
      }
      const saved = await locationManagerService.save(
        project.id,
        selectedLocation.id,
        Number(selectedLocation.locationOperationsVersion ?? 0),
        operations,
      );
      setLocations((items) => items.map((location) => location.id === selectedLocation.id
        ? mergeLocationOperations(location, saved.operations, saved.version, saved.updatedAt, saved.updatedBy)
        : location));
      setOperations(saved.operations);
      setDirty(false);
      setFeedback({ type: 'success', text: `Lokasjonsberedskapen er lagret som versjon ${saved.version}.` });
    } catch (error) {
      if (error instanceof LocationOperationsConflictError && error.locationOperation) {
        const server = error.locationOperation;
        setLocations((items) => items.map((location) => location.id === server.locationId
          ? mergeLocationOperations(location, server.operations, server.version, server.updatedAt, server.updatedBy)
          : location));
        setOperations(server.operations);
        setDirty(false);
        setFeedback({ type: 'warning', text: 'En annen bruker lagret først. Serverversjonen er lastet inn; kontroller den før du fortsetter.' });
      } else if (error instanceof LocationOperationsNetworkError) {
        await queueLocally();
      } else {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke lagre lokasjonsberedskapen.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const capturePosition = () => {
    if (!operations || readOnly || !navigator.geolocation) {
      setFeedback({ type: 'warning', text: 'Posisjon er ikke tilgjengelig på denne enheten.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateOperations((current) => ({
          ...current,
          scoutCapture: {
            ...current.scoutCapture,
            capturedAt: new Date().toISOString(),
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
            },
          },
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setFeedback({ type: 'warning', text: 'Kunne ikke hente posisjonen. Kontroller stedstilgang og prøv igjen.' });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  const uploadScoutPhoto = async (file?: File) => {
    if (!file || !selectedLocation || readOnly) return;
    if (!online) {
      setFeedback({ type: 'warning', text: 'Feltdata kan lagres uten nett, men bilder må lastes til privat S3 når forbindelsen er tilbake.' });
      return;
    }
    if (!file.type.startsWith('image/') || file.size < 1 || file.size > 25 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Velg et gyldig bilde på maksimalt 25 MB.' });
      return;
    }
    setMediaUploading(true);
    try {
      const saved = await locationManagerService.uploadPhoto(project.id, selectedLocation.id, file);
      setMedia((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setFeedback({ type: 'success', text: `${saved.displayName} er lagret privat i Role Room S3.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke laste opp scout-bildet.' });
    } finally {
      setMediaUploading(false);
    }
  };

  const openScoutPhoto = async (item: LocationScoutMedia) => {
    if (!selectedLocation) return;
    try {
      const url = await locationManagerService.getMediaUrl(project.id, selectedLocation.id, item.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke åpne scout-bildet.' });
    }
  };

  const discard = () => {
    if (!selectedLocation) return;
    setOperations(buildLocationManagerOperations(selectedLocation, project));
    setDirty(false);
    setFeedback(null);
  };

  const readiness = useMemo(() => operations ? locationReadiness(operations) : null, [operations]);
  const portfolio = useMemo(() => portfolioReadiness(locations), [locations]);
  const totalBudget = operations
    ? operations.finance.locationFee + operations.finance.permitFees + operations.finance.restorationReserve
    : 0;

  if (loading && locations.length === 0) {
    return (
      <Box data-testid="location-manager-workspace" sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}>
        <Stack alignItems="center" spacing={1.5}><CircularProgress sx={{ color: '#2dd4bf' }} /><Typography>Laster lokasjonsberedskap …</Typography></Stack>
      </Box>
    );
  }

  if (locations.length === 0) {
    return (
      <Card data-testid="location-manager-workspace" variant="outlined" sx={{ ...panelSx, m: { xs: 1, md: 3 }, p: { xs: 2.5, md: 5 }, textAlign: 'center' }}>
        <MapIcon sx={{ fontSize: 54, color: '#2dd4bf', mb: 1 }} />
        <Typography component="h1" variant="h4" fontWeight={800}>Location readiness</Typography>
        <Typography sx={{ color: 'rgba(226,232,240,.68)', maxWidth: 620, mx: 'auto', mt: 1, mb: 3 }}>
          Legg inn første kandidat for å starte scout, recce, eierdialog, tillatelser og opptaksberedskap.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenLocations} sx={{ minHeight: 48, bgcolor: '#14b8a6' }}>
          Legg til lokasjon
        </Button>
      </Card>
    );
  }

  return (
    <Box
      data-testid="location-manager-workspace"
      sx={{
        minWidth: 0,
        color: '#f8fafc',
        background: 'radial-gradient(circle at 18% 0%, rgba(20,184,166,.13), transparent 30%), #050b14',
        p: { xs: 1.25, sm: 2, lg: 3 },
      }}
    >
      <Stack spacing={2.25}>
        <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label="LOCATION DEPARTMENT" sx={{ bgcolor: 'rgba(45,212,191,.14)', color: '#5eead4', fontWeight: 800 }} />
              {loading && <CircularProgress size={16} sx={{ color: '#5eead4' }} />}
            </Stack>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 850, mt: .7, letterSpacing: '-.025em' }}>{project.name}</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,.66)', mt: .4 }}>Fra første scout til signert overlevering — én sannhet for hele location-teamet.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" startIcon={<CalendarIcon />} onClick={onOpenSchedule} sx={{ minHeight: 48, color: '#ccfbf1', borderColor: 'rgba(94,234,212,.3)' }}>Opptaksplan</Button>
            <Button variant="outlined" startIcon={<CrewIcon />} onClick={onOpenCrew} sx={{ minHeight: 48, color: '#ccfbf1', borderColor: 'rgba(94,234,212,.3)' }}>Team</Button>
            <Button variant="contained" startIcon={<MapIcon />} onClick={onOpenLocations} sx={{ minHeight: 48, bgcolor: '#14b8a6', '&:hover': { bgcolor: '#0f9f92' } }}>Kart og lokasjonsbase</Button>
          </Stack>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' }, gap: 1 }}>
          {[
            ['Lokasjoner', portfolio.total, 'Kandidater i prosjektet'],
            ['Opptaksklare', portfolio.shootReady, 'Klarert for opptak'],
            ['Med blokkering', portfolio.blocked, 'Krever handling'],
            ['Hold < 72 t', portfolio.expiringHolds, 'Utløper snart'],
            ['Snittberedskap', `${portfolio.averageScore}%`, 'Hele porteføljen'],
          ].map(([label, value, caption]) => (
            <Card key={String(label)} variant="outlined" sx={{ ...panelSx, p: 1.6 }}>
              <Typography sx={{ color: 'rgba(226,232,240,.6)', fontSize: '.73rem', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 750 }}>{label}</Typography>
              <Typography sx={{ fontSize: '1.65rem', fontWeight: 850, mt: .15 }}>{value}</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,.5)', fontSize: '.72rem' }}>{caption}</Typography>
            </Card>
          ))}
        </Box>

        {feedback && <Alert severity={feedback.type}>{feedback.text}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: '280px minmax(0,1fr)' }, gap: 2, alignItems: 'start' }}>
          <Box
            component="nav"
            aria-label="Lokasjoner"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'row', lg: 'column' },
              gap: 1,
              overflowX: { xs: 'auto', lg: 'visible' },
              pb: { xs: 1, lg: 0 },
              scrollSnapType: { xs: 'x mandatory', lg: 'none' },
            }}
          >
            {locations.map((location) => {
              const itemOperations = buildLocationManagerOperations(location, project);
              const itemReadiness = locationReadiness(itemOperations);
              const selected = location.id === selectedLocation?.id;
              return (
                <Card
                  key={location.id}
                  component="button"
                  type="button"
                  onClick={() => selectLocation(location.id)}
                  aria-pressed={selected}
                  sx={{
                    ...panelSx,
                    appearance: 'none',
                    textAlign: 'left',
                    p: 1.5,
                    minWidth: { xs: 250, lg: 0 },
                    width: { xs: 250, lg: '100%' },
                    minHeight: 96,
                    cursor: 'pointer',
                    scrollSnapAlign: 'start',
                    borderColor: selected ? '#2dd4bf' : 'rgba(45,212,191,.15)',
                    boxShadow: selected ? '0 0 0 1px rgba(45,212,191,.22), 0 14px 30px rgba(0,0,0,.2)' : 'none',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 800, color: '#f8fafc' }}>{location.name}</Typography>
                      <Typography noWrap sx={{ color: 'rgba(226,232,240,.58)', fontSize: '.76rem' }}>{location.address || 'Adresse mangler'}</Typography>
                    </Box>
                    <Typography sx={{ color: scoreColor(itemReadiness.score), fontWeight: 850 }}>{itemReadiness.score}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={itemReadiness.score} sx={{ mt: 1, height: 5, borderRadius: 8, bgcolor: 'rgba(255,255,255,.08)', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(itemReadiness.score) } }} />
                  <Stack direction="row" spacing={.65} sx={{ mt: 1 }}>
                    <Chip size="small" label={STAGE_LABELS[itemOperations.stage]} sx={{ height: 22, bgcolor: 'rgba(45,212,191,.1)', color: '#99f6e4', fontSize: '.68rem' }} />
                    {itemReadiness.blockers.length > 0 && <Chip size="small" label={`${itemReadiness.blockers.length} blokkering`} sx={{ height: 22, bgcolor: 'rgba(251,113,133,.12)', color: '#fda4af', fontSize: '.68rem' }} />}
                  </Stack>
                </Card>
              );
            })}
          </Box>

          {selectedLocation && operations && readiness && (
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              <Card variant="outlined" sx={{ ...panelSx, p: { xs: 1.7, sm: 2.2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="h2" variant="h5" sx={{ fontWeight: 850 }}>{selectedLocation.name}</Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,.62)', mt: .25 }}>{selectedLocation.address || 'Adresse er ikke registrert'}</Typography>
                    <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                      <Chip size="small" label={STAGE_LABELS[operations.stage]} sx={{ bgcolor: 'rgba(45,212,191,.14)', color: '#99f6e4' }} />
                      <Chip size="small" label={DECISION_LABELS[operations.decisionStatus]} sx={{ bgcolor: 'rgba(56,189,248,.12)', color: '#7dd3fc' }} />
                      <Chip size="small" label={`${readiness.verifiedGates}/${readiness.totalMandatoryGates} klareringer`} sx={{ bgcolor: 'rgba(255,255,255,.07)', color: '#e2e8f0' }} />
                    </Stack>
                  </Box>
                  <Box sx={{ minWidth: 145 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography sx={{ color: 'rgba(226,232,240,.6)', fontSize: '.75rem', fontWeight: 750 }}>BEREDSKAP</Typography>
                      <Typography sx={{ color: scoreColor(readiness.score), fontWeight: 900, fontSize: '1.7rem' }}>{readiness.score}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={readiness.score} sx={{ height: 7, borderRadius: 8, bgcolor: 'rgba(255,255,255,.08)', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(readiness.score) } }} />
                  </Box>
                </Box>
                <Box sx={{ mt: 2, p: 1.4, borderRadius: 2, bgcolor: readiness.blockers.length ? 'rgba(251,113,133,.08)' : 'rgba(52,211,153,.07)', border: `1px solid ${readiness.blockers.length ? 'rgba(251,113,133,.22)' : 'rgba(52,211,153,.2)'}` }}>
                  <Typography sx={{ color: readiness.blockers.length ? '#fda4af' : '#6ee7b7', fontSize: '.72rem', fontWeight: 850, letterSpacing: '.07em' }}>NESTE KRITISKE HANDLING</Typography>
                  <TextField
                    fullWidth
                    value={operations.nextAction ?? ''}
                    onChange={(event) => updateOperations((current) => ({ ...current, nextAction: event.target.value }))}
                    placeholder={readiness.nextAction}
                    disabled={readOnly}
                    multiline
                    maxRows={3}
                    sx={{ ...fieldSx, mt: .75 }}
                    inputProps={{ 'aria-label': 'Neste kritiske handling' }}
                  />
                </Box>
                {(readiness.blockers.length > 0 || readiness.warnings.length > 0) && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.2 }}>
                    {readiness.blockers.slice(0, 2).map((blocker) => <Chip key={blocker} icon={<RiskIcon />} label={blocker} sx={{ justifyContent: 'flex-start', bgcolor: 'rgba(251,113,133,.1)', color: '#fecdd3' }} />)}
                    {readiness.warnings.slice(0, 2).map((warning) => <Chip key={warning} label={warning} sx={{ justifyContent: 'flex-start', bgcolor: 'rgba(251,191,36,.1)', color: '#fde68a' }} />)}
                  </Stack>
                )}
              </Card>

              <WorkflowSection
                compact={compact}
                title="Scout Capture"
                description="Registrer observerte feltforhold. Ukjent forblir ukjent til noen bekrefter det på stedet."
                defaultExpanded
                summary={operations.scoutCapture.capturedAt ? <Chip size="small" label="Feltregistrert" sx={{ bgcolor: 'rgba(52,211,153,.12)', color: '#6ee7b7' }} /> : <Chip size="small" label="Ikke registrert" sx={{ bgcolor: 'rgba(251,191,36,.1)', color: '#fde68a' }} />}
              >
                <Stack spacing={1.25}>
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}>
                    <Button
                      variant="outlined"
                      startIcon={locating ? <CircularProgress size={16} color="inherit" /> : <MyLocationIcon />}
                      disabled={readOnly || locating}
                      onClick={capturePosition}
                      sx={{ minHeight: 48, color: '#99f6e4', borderColor: 'rgba(94,234,212,.3)' }}
                    >
                      Bruk posisjonen min
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={readOnly}
                      onClick={() => updateOperations((current) => ({
                        ...current,
                        scoutCapture: { ...current.scoutCapture, capturedAt: new Date().toISOString() },
                      }))}
                      sx={{ minHeight: 48, color: '#e2e8f0', borderColor: 'rgba(148,163,184,.25)' }}
                    >
                      Registrer scout nå
                    </Button>
                    <Typography sx={{ color: 'rgba(226,232,240,.55)', fontSize: '.76rem' }}>
                      {operations.scoutCapture.coordinates
                        ? `${operations.scoutCapture.coordinates.latitude.toFixed(5)}, ${operations.scoutCapture.coordinates.longitude.toFixed(5)} · ±${Math.round(operations.scoutCapture.coordinates.accuracyMeters ?? 0)} m`
                        : 'Ingen posisjon registrert'}
                    </Typography>
                  </Box>

                  <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(56,189,248,.045)', border: '1px solid rgba(56,189,248,.18)' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1}>
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>Scout-bilder</Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,.55)', fontSize: '.75rem' }}>Private originaler · sjekksumverifisert · Role Room AWS S3</Typography>
                      </Box>
                      <Button component="label" variant="outlined" startIcon={mediaUploading ? <CircularProgress size={16} color="inherit" /> : <PhotoCameraIcon />} disabled={readOnly || mediaUploading} sx={{ minHeight: 48, color: '#7dd3fc', borderColor: 'rgba(125,211,252,.3)' }}>
                        Ta eller velg bilde
                        <input
                          hidden
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
                          capture="environment"
                          onChange={(event) => {
                            void uploadScoutPhoto(event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                      </Button>
                    </Stack>
                    {mediaLoading ? <LinearProgress sx={{ mt: 1.1 }} /> : (
                      <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap sx={{ mt: media.length > 0 ? 1 : 0 }}>
                        {media.map((item) => (
                          <Button key={item.id} size="small" endIcon={<OpenInNewIcon />} onClick={() => void openScoutPhoto(item)} sx={{ minHeight: 44, color: '#bae6fd', bgcolor: 'rgba(56,189,248,.08)', maxWidth: '100%' }}>
                            <Typography noWrap component="span" sx={{ maxWidth: 220, fontSize: '.75rem' }}>{item.displayName}</Typography>
                          </Button>
                        ))}
                        {!media.length && <Typography sx={{ color: 'rgba(226,232,240,.45)', fontSize: '.76rem' }}>{online ? 'Ingen scout-bilder lastet opp.' : 'Bildeopplasting venter til du er på nett.'}</Typography>}
                      </Stack>
                    )}
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1 }}>
                    <FormControl sx={fieldSx}><InputLabel>Støynivå</InputLabel><Select label="Støynivå" value={operations.scoutCapture.conditions.ambientNoise} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, conditions: { ...current.scoutCapture.conditions, ambientNoise: event.target.value as typeof current.scoutCapture.conditions.ambientNoise } } }))}><MenuItem value="unknown">Ikke kontrollert</MenuItem><MenuItem value="quiet">Stille</MenuItem><MenuItem value="moderate">Moderat</MenuItem><MenuItem value="loud">Høyt</MenuItem><MenuItem value="unusable">Ikke brukbart</MenuItem></Select></FormControl>
                    <FormControl sx={fieldSx}><InputLabel>Mobildekning</InputLabel><Select label="Mobildekning" value={operations.scoutCapture.conditions.mobileSignal} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, conditions: { ...current.scoutCapture.conditions, mobileSignal: event.target.value as typeof current.scoutCapture.conditions.mobileSignal } } }))}><MenuItem value="unknown">Ikke kontrollert</MenuItem><MenuItem value="none">Ingen</MenuItem><MenuItem value="weak">Svak</MenuItem><MenuItem value="usable">Brukbar</MenuItem><MenuItem value="strong">Sterk</MenuItem></Select></FormControl>
                    <FormControl sx={fieldSx}><InputLabel>Strøm</InputLabel><Select label="Strøm" value={operations.scoutCapture.conditions.power} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, conditions: { ...current.scoutCapture.conditions, power: event.target.value as typeof current.scoutCapture.conditions.power } } }))}><MenuItem value="unknown">Ikke kontrollert</MenuItem><MenuItem value="unavailable">Ikke tilgjengelig</MenuItem><MenuItem value="limited">Begrenset</MenuItem><MenuItem value="production_ready">Produksjonsklar</MenuItem></Select></FormControl>
                    <TextField label="Vær observert" value={operations.scoutCapture.conditions.weather ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, conditions: { ...current.scoutCapture.conditions, weather: event.target.value } } }))} sx={fieldSx} />
                    <TextField label="Temperatur" type="number" value={operations.scoutCapture.conditions.temperatureC ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, conditions: { ...current.scoutCapture.conditions, temperatureC: event.target.value === '' ? undefined : Number(event.target.value) } } }))} InputProps={{ endAdornment: <Typography sx={{ color: 'rgba(226,232,240,.5)', ml: .5 }}>°C</Typography> }} sx={fieldSx} />
                    <TextField label="Vind observert" value={operations.scoutCapture.conditions.wind ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, conditions: { ...current.scoutCapture.conditions, wind: event.target.value } } }))} sx={fieldSx} />
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
                    {operations.scoutCapture.checks.map((check) => (
                      <Box key={check.id} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,1fr) 150px' }, gap: .8, alignItems: 'center', p: 1.1, borderRadius: 2, border: '1px solid rgba(148,163,184,.13)', bgcolor: 'rgba(255,255,255,.02)' }}>
                        <Typography sx={{ fontWeight: 700 }}>{check.title}</Typography>
                        <FormControl size="small" sx={fieldSx}>
                          <Select aria-label={`${check.title} feltstatus`} value={check.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, checks: current.scoutCapture.checks.map((item) => item.id === check.id ? { ...item, status: event.target.value as typeof item.status, updatedAt: new Date().toISOString() } : item) } }))}>
                            <MenuItem value="unchecked">Ikke kontrollert</MenuItem><MenuItem value="pass">OK</MenuItem><MenuItem value="concern">Avvik</MenuItem><MenuItem value="not_applicable">Ikke relevant</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    ))}
                  </Box>
                  <TextField fullWidth label="Feltobservasjoner" helperText="Beskriv bare det som faktisk er observert eller målt." value={operations.scoutCapture.notes ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, scoutCapture: { ...current.scoutCapture, notes: event.target.value } }))} multiline minRows={3} sx={fieldSx} />
                </Stack>
              </WorkflowSection>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', xl: 'repeat(2, minmax(0,1fr))' }, gap: 1.5 }}>
                <WorkflowSection compact={compact} title="Beslutning, eier og dato" description="Hold, eierdialog og opptaksdato samlet." defaultExpanded>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.25 }}>
                    <FormControl sx={fieldSx}><InputLabel>Arbeidsfase</InputLabel><Select label="Arbeidsfase" value={operations.stage} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, stage: event.target.value as LocationWorkflowStage }))}>{Object.entries(STAGE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <FormControl sx={fieldSx}><InputLabel>Beslutning</InputLabel><Select label="Beslutning" value={operations.decisionStatus} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, decisionStatus: event.target.value as LocationDecisionStatus }))}>{Object.entries(DECISION_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <FormControl sx={fieldSx}><InputLabel>Eierdialog</InputLabel><Select label="Eierdialog" value={operations.ownerCommunication.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, ownerCommunication: { ...current.ownerCommunication, status: event.target.value as LocationManagerOperations['ownerCommunication']['status'] } }))}>{Object.entries(CONTACT_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <TextField label="Kontaktperson" value={operations.ownerCommunication.contactName ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, ownerCommunication: { ...current.ownerCommunication, contactName: event.target.value } }))} sx={fieldSx} />
                    <FormControl sx={fieldSx}><InputLabel>Dato-status</InputLabel><Select label="Dato-status" value={operations.dateAvailability.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, dateAvailability: { ...current.dateAvailability, status: event.target.value as LocationGateStatus } }))}>{Object.entries(GATE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <TextField label="Hold utløper" type="datetime-local" value={toLocalDateTime(operations.dateAvailability.holdExpiresAt)} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, dateAvailability: { ...current.dateAvailability, holdExpiresAt: event.target.value || undefined } }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                  </Box>
                  <TextField fullWidth label="Restriksjoner fra eier" value={operations.ownerCommunication.restrictions ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, ownerCommunication: { ...current.ownerCommunication, restrictions: event.target.value } }))} multiline minRows={2} sx={{ ...fieldSx, mt: 1.25 }} />
                </WorkflowSection>

                <WorkflowSection compact={compact} title="Teknisk recce" description="Felles kontroll for kamera, lyd, lys, grip, AD og sikkerhet.">
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.25 }}>
                    <FormControl sx={fieldSx}><InputLabel>Recce-status</InputLabel><Select label="Recce-status" value={operations.recce.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, recce: { ...current.recce, status: event.target.value as LocationManagerOperations['recce']['status'] } }))}>{Object.entries(RECCE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <TextField label="Tidspunkt" type="datetime-local" value={toLocalDateTime(operations.recce.scheduledAt)} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, recce: { ...current.recce, scheduledAt: event.target.value || undefined } }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                  </Box>
                  <TextField fullWidth label="Deltakere" helperText="Skill navn med komma" value={operations.recce.attendees.join(', ')} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, recce: { ...current.recce, attendees: event.target.value.split(',').map((name) => name.trim()).filter(Boolean) } }))} sx={{ ...fieldSx, mt: 1.25 }} />
                  <TextField fullWidth label="Recce-notat" value={operations.recce.notes ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, recce: { ...current.recce, notes: event.target.value } }))} multiline minRows={3} sx={{ ...fieldSx, mt: 1.25 }} />
                </WorkflowSection>
              </Box>

              <WorkflowSection
                compact={compact}
                title="Klareringsporter"
                description="Status og evidens for eier, myndigheter, forsikring og sikkerhet."
                summary={<Chip icon={<ShieldIcon />} size="small" label={`${readiness.verifiedGates}/${readiness.totalMandatoryGates}`} sx={{ bgcolor: 'rgba(45,212,191,.1)', color: '#99f6e4' }} />}
              >
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1, mt: 1.5 }}>
                  {operations.clearanceGates.map((gate) => (
                    <Box key={gate.id} sx={{ p: 1.35, borderRadius: 2, bgcolor: gate.status === 'blocked' ? 'rgba(251,113,133,.07)' : 'rgba(255,255,255,.025)', border: '1px solid rgba(148,163,184,.13)' }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 750 }}>{gate.title}</Typography><Typography sx={{ color: 'rgba(226,232,240,.48)', fontSize: '.7rem' }}>{gate.mandatory ? 'Obligatorisk' : 'Ved behov'}</Typography></Box>
                        <FormControl size="small" sx={{ ...fieldSx, minWidth: 132 }}><Select aria-label={`${gate.title} status`} value={gate.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, clearanceGates: current.clearanceGates.map((item) => item.id === gate.id ? { ...item, status: event.target.value as LocationGateStatus, updatedAt: new Date().toISOString() } : item) }))}>{Object.entries(GATE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                      </Stack>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 165px' }, gap: 1, mt: 1 }}>
                        <TextField size="small" label="Ansvarlig" value={gate.owner ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, clearanceGates: current.clearanceGates.map((item) => item.id === gate.id ? { ...item, owner: event.target.value } : item) }))} sx={fieldSx} />
                        <TextField size="small" label="Frist" type="date" value={gate.dueAt?.slice(0, 10) ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, clearanceGates: current.clearanceGates.map((item) => item.id === gate.id ? { ...item, dueAt: event.target.value || undefined } : item) }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                      </Box>
                      <TextField size="small" fullWidth label="Evidens / referanse" value={gate.evidence ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, clearanceGates: current.clearanceGates.map((item) => item.id === gate.id ? { ...item, evidence: event.target.value } : item) }))} sx={{ ...fieldSx, mt: 1 }} />
                    </Box>
                  ))}
                </Box>
              </WorkflowSection>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
                <WorkflowSection compact={compact} title="Feltlogistikk" description="Ankomst, base, parkering, load-in og nødadkomst.">
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
                    {([
                      ['unitBase', 'Unit base'], ['crewParking', 'Crew-parkering'], ['loadInRoute', 'Load-in-rute'], ['holdingAreas', 'Holding / green room'], ['nearestHospital', 'Nærmeste sykehus'], ['emergencyAccess', 'Nødadkomst'],
                    ] as const).map(([key, label]) => <TextField key={key} label={label} value={operations.logistics[key] ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, logistics: { ...current.logistics, [key]: event.target.value } }))} sx={fieldSx} />)}
                  </Box>
                  <TextField fullWidth label="Teknisk feltplan" value={operations.logistics.technicalNotes ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, logistics: { ...current.logistics, technicalNotes: event.target.value } }))} multiline minRows={3} sx={{ ...fieldSx, mt: 1 }} />
                </WorkflowSection>

                <WorkflowSection compact={compact} title="Risiko og backup" description="Synlig plan B for vær, tilgang og produksjonskritiske avvik.">
                  <Button startIcon={<AddIcon />} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, risks: [...current.risks, { id: `risk-${Date.now()}`, title: 'Ny risiko', severity: 'medium', status: 'open', updatedAt: new Date().toISOString() }] }))} sx={{ minHeight: 44, color: '#5eead4' }}>Legg til risiko</Button>
                  <FormControl fullWidth sx={{ ...fieldSx, mt: 1.5 }}><InputLabel>Backup-lokasjon</InputLabel><Select label="Backup-lokasjon" value={operations.backupLocationId ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, backupLocationId: event.target.value || undefined }))}><MenuItem value="">Ingen valgt</MenuItem>{locations.filter((location) => location.id !== selectedLocation.id).map((location) => <MenuItem key={location.id} value={location.id}>{location.name}</MenuItem>)}</Select></FormControl>
                  <TextField fullWidth label="Vær- og avbruddsplan" value={operations.weatherPlan ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, weatherPlan: event.target.value }))} multiline minRows={2} sx={{ ...fieldSx, mt: 1 }} />
                  <Stack spacing={1} sx={{ mt: 1.2 }}>
                    {operations.risks.length === 0 && <Typography sx={{ color: 'rgba(226,232,240,.46)', fontSize: '.8rem' }}>Ingen registrerte risikoer.</Typography>}
                    {operations.risks.map((risk) => (
                      <Box key={risk.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 44px', sm: 'minmax(0,1fr) 140px 140px 44px' }, gap: .8, alignItems: 'center' }}>
                        <TextField size="small" label="Risiko" value={risk.title} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, title: event.target.value } : item) }))} sx={fieldSx} />
                        <FormControl size="small" sx={fieldSx}><Select aria-label={`${risk.title} alvorlighet`} value={risk.severity} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, severity: event.target.value as typeof item.severity } : item) }))}><MenuItem value="low">Lav</MenuItem><MenuItem value="medium">Middels</MenuItem><MenuItem value="high">Høy</MenuItem><MenuItem value="critical">Kritisk</MenuItem></Select></FormControl>
                        <FormControl size="small" sx={fieldSx}><Select aria-label={`${risk.title} status`} value={risk.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, risks: current.risks.map((item) => item.id === risk.id ? { ...item, status: event.target.value as typeof item.status } : item) }))}><MenuItem value="open">Åpen</MenuItem><MenuItem value="mitigating">Tiltak pågår</MenuItem><MenuItem value="resolved">Løst</MenuItem></Select></FormControl>
                        <IconButton aria-label={`Slett ${risk.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, risks: current.risks.filter((item) => item.id !== risk.id) }))} sx={{ minWidth: 44, minHeight: 44, color: '#fda4af' }}><DeleteIcon /></IconButton>
                      </Box>
                    ))}
                  </Stack>
                </WorkflowSection>
              </Box>

              <WorkflowSection compact={compact} title="Kostnadskontroll" description="Leie, tillatelser, reserve og godkjenningsstatus.">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1, mt: 1.5 }}>
                  {([
                    ['locationFee', 'Lokasjonsleie'], ['permitFees', 'Tillatelser'], ['restorationReserve', 'Tilbakestillingsreserve'],
                  ] as const).map(([key, label]) => <TextField key={key} label={label} type="number" value={operations.finance[key]} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, finance: { ...current.finance, [key]: Math.max(0, Number(event.target.value) || 0) } }))} InputProps={{ endAdornment: <Typography sx={{ color: 'rgba(226,232,240,.5)', ml: .5 }}>{operations.finance.currency}</Typography> }} sx={fieldSx} />)}
                  <FormControl sx={fieldSx}><InputLabel>Kostnadsstatus</InputLabel><Select label="Kostnadsstatus" value={operations.finance.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, finance: { ...current.finance, status: event.target.value as LocationManagerOperations['finance']['status'] } }))}><MenuItem value="estimate">Estimat</MenuItem><MenuItem value="quoted">Tilbud mottatt</MenuItem><MenuItem value="approved">Godkjent</MenuItem><MenuItem value="settled">Oppgjort</MenuItem></Select></FormControl>
                </Box>
                <Typography sx={{ mt: 1.2, color: '#99f6e4', fontWeight: 800 }}>Forventet lokasjonskostnad: {formatMoney(totalBudget, operations.finance.currency)}</Typography>
              </WorkflowSection>

              <Card variant="outlined" sx={{ ...panelSx, position: 'sticky', bottom: 8, zIndex: 4, p: 1.25, backdropFilter: 'blur(18px)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                  <Box>
                    <Stack direction="row" spacing={.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontWeight: 750 }}>{dirty ? 'Ulagrede endringer' : `Versjon ${selectedLocation.locationOperationsVersion ?? 0}`}</Typography>
                      <Chip
                        size="small"
                        icon={syncing ? <SyncIcon /> : undefined}
                        label={!online ? 'Frakoblet' : pendingCount > 0 ? `${pendingCount} venter på synk` : 'Synkronisert'}
                        sx={{ height: 24, bgcolor: !online || pendingCount > 0 ? 'rgba(251,191,36,.12)' : 'rgba(52,211,153,.1)', color: !online || pendingCount > 0 ? '#fde68a' : '#6ee7b7' }}
                      />
                    </Stack>
                    <Typography sx={{ color: 'rgba(226,232,240,.5)', fontSize: '.73rem' }}>{readOnly ? 'Lesetilgang' : 'Feltdata lagres lokalt ved nettbrudd og synkroniseres konfliktbeskyttet.'}</Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="text" startIcon={<RefreshIcon />} onClick={discard} disabled={!dirty || saving} sx={{ minHeight: 48, color: '#cbd5e1' }}>Forkast</Button>
                    <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={onOpenFullWorkspace} sx={{ minHeight: 48, color: '#ccfbf1', borderColor: 'rgba(94,234,212,.3)' }}>Hele Role Room</Button>
                    {online && pendingCount > 0 && <Button variant="outlined" startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />} onClick={() => void syncPending()} disabled={syncing} sx={{ minHeight: 48, color: '#fde68a', borderColor: 'rgba(251,191,36,.35)' }}>Synkroniser</Button>}
                    <Button variant="contained" startIcon={saving ? <CircularProgress size={17} color="inherit" /> : <SaveIcon />} onClick={() => void save()} disabled={!dirty || saving || readOnly} sx={{ minHeight: 48, bgcolor: '#14b8a6', '&:hover': { bgcolor: '#0f9f92' } }}>{online ? 'Lagre beredskap' : 'Lagre lokalt'}</Button>
                  </Stack>
                </Box>
              </Card>

              <Button endIcon={<ArrowIcon />} onClick={onOpenLocations} sx={{ alignSelf: 'flex-start', minHeight: 48, color: '#5eead4' }}>Åpne kart, media, analyse og full lokasjonsbase</Button>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
