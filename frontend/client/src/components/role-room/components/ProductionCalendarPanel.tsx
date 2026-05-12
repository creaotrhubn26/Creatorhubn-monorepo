import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TheatersIcon from '@mui/icons-material/Theaters';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import MovieIcon from '@mui/icons-material/Movie';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import { 
  CalendarCustomIcon as CalendarMonthIcon, 
  TeamIcon as GroupsIcon, 
  LocationsIcon as LocationOnIcon 
} from './icons/CastingIcons';
import { useSnackbar } from 'notistack';
import {
  calendarEventsApi,
  crewConflictsApi,
  crewNotificationsApi,
  candidatesApi,
  crewApi,
  locationsApi,
  equipmentApi,
  equipmentBookingsApi,
  equipmentConflictsApi,
  type CalendarEvent,
  type CrewConflict,
  type Equipment,
  type EquipmentConflict,
} from '../services/castingApiService';
import WarningIcon from '@mui/icons-material/Warning';
import NotificationsIcon from '@mui/icons-material/Notifications';
import globalTagService from '../services/globalTagService';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { getRoleLabel } from './shared/technicalCrew';
import { alpha } from '@mui/material/styles';
import { MonthGridView } from './calendar/MonthGridView';
import { CalendarMonthHeader } from './calendar/CalendarMonthHeader';
import { CalendarStatsBar } from './calendar/CalendarStatsBar';

interface Candidate {
  id: string;
  name: string;
}

interface Crew {
  id: string;
  name: string;
  role?: string;
}

interface Location {
  id: string;
  name: string;
}

interface ProductionCalendarPanelProps {
  projectId: string;
  candidates?: Candidate[];
  crew?: Crew[];
  locations?: Location[];
  onEventCreate?: (event: CalendarEvent) => void;
  onRequestLocationCreate?: () => void;
  onRequestCandidateCreate?: () => void;
  onRequestCrewCreate?: () => void;
  onRequestEquipmentCreate?: () => void;
  reopenDialogSignal?: number;
  preselectedFromCreate?: {
    locationId?: string;
    candidateId?: string;
    crewId?: string;
    equipmentId?: string;
  } | null;
}

const EVENT_TYPES = [
  { value: 'audition', label: 'Audition', icon: <TheatersIcon />, color: '#f59e0b' },
  { value: 'selection', label: 'Utvelgelse', icon: <HowToRegIcon />, color: '#22d3ee' },
  { value: 'fitting', label: 'Kostyme/Fitting', icon: <CheckroomIcon />, color: '#ec4899' },
  { value: 'rehearsal', label: 'Prøve', icon: <GroupsIcon />, color: '#8b5cf6' },
  { value: 'shooting', label: 'Opptak', icon: <MovieIcon />, color: '#10b981' },
  { value: 'general', label: 'Generelt', icon: <EventIcon />, color: '#6b7280' },
];

type WorkflowGapSeverity = 'error' | 'warning';

interface WorkflowGap {
  id: string;
  severity: WorkflowGapSeverity;
  text: string;
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

const sortNamed = <T extends { name: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'nb-NO', { sensitivity: 'base' }));

const mergeNamedLists = <T extends { id: string; name: string }>(
  ...lists: Array<T[] | undefined>
): T[] => {
  const merged = new Map<string, T>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item?.id || !item?.name) continue;
      merged.set(item.id, item);
    }
  }
  return sortNamed(Array.from(merged.values()));
};

const mergeEquipmentLists = (...lists: Array<Equipment[] | undefined>): Equipment[] => {
  const merged = new Map<string, Equipment>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item?.id || !item?.name) continue;
      merged.set(item.id, item);
    }
  }
  return sortNamed(Array.from(merged.values()));
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const resolveCrewRole = (source: unknown): string | undefined => {
  const record = asRecord(source);
  if (!record) return undefined;
  const nested = asRecord(record.crew_data) ?? asRecord(record.crewData);
  const roleCandidates = [
    record.role,
    record.crewRole,
    record.crew_role,
    record.position,
    record.title,
    record.jobTitle,
    record.job_title,
    nested?.role,
    nested?.crewRole,
    nested?.position,
    nested?.title,
    record.department,
  ];
  for (const candidate of roleCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
};

const mergeCrewLists = (...lists: Array<Crew[] | undefined>): Crew[] => {
  const merged = new Map<string, Crew>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item?.id || !item?.name) continue;
      const previous = merged.get(item.id);
      const nextRole =
        item.role && item.role.trim().length > 0
          ? item.role.trim()
          : previous?.role && previous.role.trim().length > 0
            ? previous.role.trim()
            : undefined;
      merged.set(item.id, { ...previous, ...item, role: nextRole });
    }
  }
  return sortNamed(Array.from(merged.values()));
};

const crewLabel = (member: Crew): string =>
  member.role && member.role.trim().length > 0
    ? `${member.name} (${getRoleLabel(member.role)})`
    : `${member.name} (Mangler rolle)`;

const modalFieldSx = {
  '& .MuiInputLabel-root': {
    color: 'rgba(226,232,240,0.82)',
    '&.Mui-focused': {
      color: '#c084fc',
    },
  },
  '& .MuiOutlinedInput-root': {
    color: '#f8fafc',
    background: 'rgba(15,23,42,0.55)',
    borderRadius: 1.5,
    '& fieldset': {
      borderColor: 'rgba(148,163,184,0.34)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(192,132,252,0.58)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#a855f7',
    },
  },
} as const;

const ProductionCalendarPanel: React.FC<ProductionCalendarPanelProps> = ({
  projectId,
  candidates: propCandidates,
  crew: propCrew,
  locations: propLocations,
  onEventCreate,
  onRequestLocationCreate,
  onRequestCandidateCreate,
  onRequestCrewCreate,
  onRequestEquipmentCreate,
  reopenDialogSignal,
  preselectedFromCreate,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('general');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'month' | 'day'>('month');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [candidates, setCandidates] = useState<Candidate[]>(propCandidates || []);
  const [crew, setCrew] = useState<Crew[]>(propCrew || []);
  const [locations, setLocations] = useState<Location[]>(propLocations || []);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [crewConflicts, setCrewConflicts] = useState<Map<string, CrewConflict[]>>(new Map());
  const [equipmentConflicts, setEquipmentConflicts] = useState<Map<string, EquipmentConflict[]>>(new Map());
  const reopenSignalRef = useRef(0);

  const mentionCandidates = useMemo(
    () => [
      ...candidates.map((candidate) => candidate.name),
      ...crew.map((member) => member.name),
    ],
    [candidates, crew],
  );

  const eventTypeConfig = useMemo(
    () => EVENT_TYPES.find((type) => type.value === eventType) || EVENT_TYPES[EVENT_TYPES.length - 1],
    [eventType],
  );

  const isShootingWorkflow = eventType === 'shooting' || eventType === 'rehearsal';
  const isCastingWorkflow = eventType === 'audition' || eventType === 'selection' || eventType === 'fitting';
  const hasInvalidTimeRange = useMemo(() => {
    if (allDay || !startTime || !endTime) return false;
    return new Date(endTime).getTime() <= new Date(startTime).getTime();
  }, [allDay, endTime, startTime]);

  const workflowGaps = useMemo(() => {
    const gaps: WorkflowGap[] = [];
    if (eventType !== 'general' && !selectedLocation) {
      gaps.push({ id: 'location-missing', severity: 'warning', text: 'Lokasjon mangler for denne hendelsen.' });
    }
    if (isCastingWorkflow && selectedCandidates.length === 0) {
      gaps.push({ id: 'candidates-missing', severity: 'warning', text: 'Ingen kandidater valgt.' });
    }
    if (isShootingWorkflow && selectedCrew.length === 0) {
      gaps.push({ id: 'crew-missing', severity: 'warning', text: 'Ingen team-medlemmer valgt.' });
    }
    if (selectedCrew.length > 0) {
      const membersWithoutRole = selectedCrew
        .map((id) => crew.find((member) => member.id === id))
        .filter((member) => member && (!member.role || member.role.trim().length === 0)).length;
      if (membersWithoutRole > 0) {
        gaps.push({
          id: 'crew-role-missing',
          severity: 'warning',
          text: `${membersWithoutRole} team-medlemmer mangler rolle.`,
        });
      }
    }
    if (eventType === 'shooting' && selectedEquipment.length === 0) {
      gaps.push({ id: 'equipment-missing', severity: 'warning', text: 'Ingen utstyrsenheter valgt.' });
    }
    if (hasInvalidTimeRange) {
      gaps.push({ id: 'time-range-invalid', severity: 'error', text: 'Sluttid må være etter starttid.' });
    }
    if (crewConflicts.size > 0) {
      gaps.push({ id: 'crew-conflicts', severity: 'warning', text: `Team-konflikter oppdaget (${crewConflicts.size}).` });
    }
    if (equipmentConflicts.size > 0) {
      gaps.push({ id: 'equipment-conflicts', severity: 'warning', text: `Utstyrskonflikter oppdaget (${equipmentConflicts.size}).` });
    }
    return gaps;
  }, [
    crewConflicts.size,
    equipmentConflicts.size,
    eventType,
    hasInvalidTimeRange,
    isCastingWorkflow,
    isShootingWorkflow,
    selectedCandidates.length,
    selectedCrew.length,
    selectedEquipment.length,
    selectedLocation,
  ]);

  const readinessScore = useMemo(() => {
    const checks = [
      Boolean(title.trim()),
      Boolean(startTime),
      !hasInvalidTimeRange,
      eventType === 'general' ? true : Boolean(selectedLocation),
      isCastingWorkflow ? selectedCandidates.length > 0 : true,
      isShootingWorkflow ? selectedCrew.length > 0 : true,
      eventType === 'shooting' ? selectedEquipment.length > 0 : true,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [
    eventType,
    hasInvalidTimeRange,
    isCastingWorkflow,
    isShootingWorkflow,
    selectedCandidates.length,
    selectedCrew.length,
    selectedEquipment.length,
    selectedLocation,
    startTime,
    title,
  ]);

  const hasBlockingWorkflowGap = workflowGaps.some((gap) => gap.severity === 'error');
  const readinessLabel = hasBlockingWorkflowGap ? 'Blokkert' : workflowGaps.length > 0 ? 'Risiko' : 'Klar';

  useEffect(() => {
    loadEvents();
    loadProjectData();
  }, [projectId]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const eventsData = await calendarEventsApi.getAll(projectId);
      setEvents(eventsData.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
    } catch (error) {
      enqueueSnackbar('Kunne ikke laste kalenderhendelser', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const refreshModalSources = async () => {
    const [candidateResult, crewResult, locationResult, equipmentResult] = await Promise.allSettled([
      candidatesApi.getAll(projectId),
      crewApi.getAll(projectId),
      locationsApi.getAll(projectId),
      equipmentApi.getAll(projectId),
    ]);

    const apiCandidates =
      candidateResult.status === 'fulfilled'
        ? candidateResult.value.map((candidate) => ({ id: candidate.id, name: candidate.name }))
        : [];
    const apiCrew =
      crewResult.status === 'fulfilled'
        ? crewResult.value.map((member) => ({
            id: member.id,
            name: member.name,
            role: resolveCrewRole(member),
          }))
        : [];
    const apiLocations =
      locationResult.status === 'fulfilled'
        ? locationResult.value.map((location) => ({ id: location.id, name: location.name }))
        : [];
    const apiEquipment = equipmentResult.status === 'fulfilled' ? equipmentResult.value : [];

    setCandidates((previous) => mergeNamedLists(previous, propCandidates, apiCandidates));
    setCrew((previous) => mergeCrewLists(previous, propCrew, apiCrew));
    setLocations((previous) => mergeNamedLists(previous, propLocations, apiLocations));
    setEquipment((previous) => mergeEquipmentLists(previous, apiEquipment));
  };

  const loadProjectData = async () => {
    try {
      if (Array.isArray(propCandidates)) {
        setCandidates(sortNamed(propCandidates));
      }
      if (Array.isArray(propCrew)) {
        setCrew(sortNamed(propCrew));
      }
      if (Array.isArray(propLocations)) {
        setLocations(sortNamed(propLocations));
      }
      await refreshModalSources();
    } catch (error) {
      console.error('Failed to load project data:', error);
    }
  };

  useEffect(() => {
    if (Array.isArray(propCandidates)) {
      setCandidates(sortNamed(propCandidates));
    }
  }, [propCandidates]);

  useEffect(() => {
    if (Array.isArray(propCrew)) {
      setCrew(sortNamed(propCrew));
    }
  }, [propCrew]);

  useEffect(() => {
    if (Array.isArray(propLocations)) {
      setLocations(sortNamed(propLocations));
    }
  }, [propLocations]);

  useEffect(() => {
    if (!dialogOpen) return;
    void refreshModalSources();
  }, [dialogOpen, projectId]);

  const fetchEquipmentConflicts = async (equipmentIds: string[], start: string, end: string): Promise<{ conflicts: Map<string, EquipmentConflict[]>; conflictingIds: string[] }> => {
    const conflicts = new Map<string, EquipmentConflict[]>();
    const conflictingIds: string[] = [];
    for (const equipmentId of equipmentIds) {
      try {
        const result = await equipmentConflictsApi.check(equipmentId, start.split('T')[0], end.split('T')[0]);
        if (result.hasConflicts) {
          conflicts.set(equipmentId, result.conflicts);
          conflictingIds.push(equipmentId);
        }
      } catch (error) {
        console.error('Failed to check conflicts for equipment:', equipmentId, error);
      }
    }
    return { conflicts, conflictingIds };
  };

  const fetchCrewConflicts = async (crewIds: string[], start: string, end: string) => {
    const conflicts = new Map<string, CrewConflict[]>();
    for (const crewId of crewIds) {
      try {
        const result = await crewConflictsApi.check(crewId, start.split('T')[0], end.split('T')[0]);
        if (result.hasConflicts) {
          conflicts.set(crewId, result.conflicts);
        }
      } catch (error) {
        console.error('Failed to check conflicts for crew:', crewId, error);
      }
    }
    return conflicts;
  };

  useEffect(() => {
    if (!dialogOpen || !startTime) {
      setCrewConflicts(new Map());
      setEquipmentConflicts(new Map());
      return;
    }
    let isCurrent = true;
    const checkEnd = endTime || startTime;
    const runConflictChecks = async () => {
      const [nextCrewConflicts, nextEquipmentResult] = await Promise.all([
        selectedCrew.length > 0 ? fetchCrewConflicts(selectedCrew, startTime, checkEnd) : Promise.resolve(new Map<string, CrewConflict[]>()),
        selectedEquipment.length > 0
          ? fetchEquipmentConflicts(selectedEquipment, startTime, checkEnd)
          : Promise.resolve({ conflicts: new Map<string, EquipmentConflict[]>(), conflictingIds: [] }),
      ]);
      if (!isCurrent) return;
      setCrewConflicts(nextCrewConflicts);
      setEquipmentConflicts(nextEquipmentResult.conflicts);
    };
    void runConflictChecks();
    return () => {
      isCurrent = false;
    };
  }, [dialogOpen, endTime, selectedCrew, selectedEquipment, startTime]);

  const sendCrewNotifications = async (crewIds: string[], eventTitle: string, eventId: string) => {
    for (const crewId of crewIds) {
      try {
        await crewNotificationsApi.create(crewId, {
          project_id: projectId,
          event_id: eventId,
          notification_type: 'assignment',
          title: 'Ny tildeling',
          message: `Du er tildelt til: ${eventTitle}`,
        });
      } catch (error) {
        console.error('Failed to send notification to crew:', crewId, error);
      }
    }
  };

  const handleOpenDialog = (event?: CalendarEvent) => {
    if (event) {
      setEditingEvent(event);
      setTitle(event.title);
      setDescription(event.description || '');
      setEventType(event.event_type);
      setStartTime(event.start_time ? event.start_time.slice(0, 16) : '');
      setEndTime(event.end_time ? event.end_time.slice(0, 16) : '');
      setSelectedLocation(event.location_id || '');
      setAllDay(event.all_day || false);
      setSelectedCandidates(event.candidate_ids || []);
      setSelectedCrew(event.crew_ids || []);
      setSelectedEquipment(event.equipment_ids || []);
      setNotes(event.notes || '');
    } else {
      resetForm();
    }
    void refreshModalSources();
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setEventType('general');
    setStartTime('');
    setEndTime('');
    setSelectedLocation('');
    setAllDay(false);
    setSelectedCandidates([]);
    setSelectedCrew([]);
    setSelectedEquipment([]);
    setNotes('');
    setCrewConflicts(new Map());
    setEquipmentConflicts(new Map());
  };

  const handleRequestEntityCreate = (
    type: 'location' | 'candidate' | 'crew' | 'equipment',
  ) => {
    setDialogOpen(false);
    if (type === 'location') {
      onRequestLocationCreate?.();
      return;
    }
    if (type === 'candidate') {
      onRequestCandidateCreate?.();
      return;
    }
    if (type === 'crew') {
      onRequestCrewCreate?.();
      return;
    }
    onRequestEquipmentCreate?.();
  };

  useEffect(() => {
    if (!reopenDialogSignal || reopenDialogSignal === reopenSignalRef.current) {
      return;
    }
    reopenSignalRef.current = reopenDialogSignal;

    const applyPrefill = async () => {
      await refreshModalSources();
      resetForm();
      if (preselectedFromCreate?.locationId) {
        setSelectedLocation(preselectedFromCreate.locationId);
      }
      if (preselectedFromCreate?.candidateId) {
        setSelectedCandidates((previous) =>
          previous.includes(preselectedFromCreate.candidateId as string)
            ? previous
            : [...previous, preselectedFromCreate.candidateId as string],
        );
      }
      if (preselectedFromCreate?.crewId) {
        setSelectedCrew((previous) =>
          previous.includes(preselectedFromCreate.crewId as string)
            ? previous
            : [...previous, preselectedFromCreate.crewId as string],
        );
      }
      if (preselectedFromCreate?.equipmentId) {
        setSelectedEquipment((previous) =>
          previous.includes(preselectedFromCreate.equipmentId as string)
            ? previous
            : [...previous, preselectedFromCreate.equipmentId as string],
        );
      }
      setDialogOpen(true);
    };

    void applyPrefill();
  }, [preselectedFromCreate, reopenDialogSignal]);

  const handleSave = async () => {
    if (!title || !startTime) {
      enqueueSnackbar('Tittel og starttid er påkrevd', { variant: 'warning' });
      return;
    }

    if (selectedCrew.length > 0 && startTime) {
      const crewConflictMap = await fetchCrewConflicts(selectedCrew, startTime, endTime || startTime);
      setCrewConflicts(crewConflictMap);
      if (crewConflictMap.size > 0) {
        const conflictingCrewNames = Array.from(crewConflictMap.keys())
          .map((id) => crew.find((member) => member.id === id)?.name)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join(', ');
        enqueueSnackbar(`Advarsel: Crew-konflikter funnet for: ${conflictingCrewNames}`, { variant: 'warning' });
      }
    }

    if (selectedEquipment.length > 0 && startTime) {
      const checkEnd = endTime || startTime;
      const { conflicts: equipmentConflictMap, conflictingIds } = await fetchEquipmentConflicts(selectedEquipment, startTime, checkEnd);
      setEquipmentConflicts(equipmentConflictMap);
      if (equipmentConflictMap.size > 0) {
        const conflictingEquipmentNames = conflictingIds
          .map(id => equipment.find(e => e.id === id)?.name)
          .filter(Boolean)
          .join(', ');
        enqueueSnackbar(`Advarsel: Utstyrskonflikter funnet for: ${conflictingEquipmentNames}`, { variant: 'warning' });
      }
    }

    setSubmitting(true);
    try {
      const selectedCrewNames = selectedCrew
        .map((id) => crew.find((member) => member.id === id)?.name)
        .filter((value): value is string => typeof value === 'string');
      const selectedCandidateNames = selectedCandidates
        .map((id) => candidates.find((candidate) => candidate.id === id)?.name)
        .filter((value): value is string => typeof value === 'string');

      let eventId = editingEvent?.id;
      if (editingEvent) {
        await calendarEventsApi.update(editingEvent.id, {
          title,
          description,
          event_type: eventType as CalendarEvent['event_type'],
          start_time: startTime,
          end_time: endTime || undefined,
          location_id: selectedLocation || undefined,
          all_day: allDay,
          candidate_ids: selectedCandidates,
          crew_ids: selectedCrew,
          equipment_ids: selectedEquipment,
          notes,
        });
        enqueueSnackbar('Hendelse oppdatert!', { variant: 'success' });
        
        const newCrewIds = selectedCrew.filter(id => !editingEvent.crew_ids?.includes(id));
        if (newCrewIds.length > 0) {
          await sendCrewNotifications(newCrewIds, title, editingEvent.id);
          enqueueSnackbar(`Varsler sendt til ${newCrewIds.length} nye crew-medlemmer`, { variant: 'info' });
        }

        try {
          const existingBookings = await equipmentBookingsApi.getByEvent(editingEvent.id);
          const removedEquipmentIds = (editingEvent.equipment_ids || []).filter(id => !selectedEquipment.includes(id));
          const bookingsToDelete = existingBookings.filter(b => removedEquipmentIds.includes(b.equipment_id));
          for (const booking of bookingsToDelete) {
            await equipmentBookingsApi.delete(booking.id);
          }
          const bookingsToUpdate = existingBookings.filter(b => selectedEquipment.includes(b.equipment_id));
          for (const booking of bookingsToUpdate) {
            await equipmentBookingsApi.update(booking.id, {
              start_date: startTime.split('T')[0],
              end_date: (endTime || startTime).split('T')[0],
              purpose: title,
            });
          }
          const existingEquipmentIds = existingBookings.map(b => b.equipment_id);
          const newEquipmentIds = selectedEquipment.filter(id => !existingEquipmentIds.includes(id));
          for (const equipmentId of newEquipmentIds) {
            await equipmentBookingsApi.create(equipmentId, {
              event_id: editingEvent.id,
              start_date: startTime.split('T')[0],
              end_date: (endTime || startTime).split('T')[0],
              purpose: title,
              status: 'confirmed',
            });
          }
        } catch (err) {
          console.error('Failed to sync equipment bookings:', err);
        }
      } else {
        eventId = await calendarEventsApi.create({
          projectId,
          title,
          description,
          eventType,
          startTime,
          endTime: endTime || undefined,
          locationId: selectedLocation || undefined,
          allDay,
          candidateIds: selectedCandidates,
          crewIds: selectedCrew,
          notes,
        });
        enqueueSnackbar('Hendelse opprettet!', { variant: 'success' });
        
        if (selectedCrew.length > 0 && eventId) {
          await sendCrewNotifications(selectedCrew, title, eventId);
          enqueueSnackbar(`Varsler sendt til ${selectedCrew.length} crew-medlemmer`, { variant: 'info' });
        }

        if (selectedEquipment.length > 0 && eventId) {
          for (const equipmentId of selectedEquipment) {
            try {
              await equipmentBookingsApi.create(equipmentId, {
                event_id: eventId,
                start_date: startTime.split('T')[0],
                end_date: (endTime || startTime).split('T')[0],
                purpose: title,
                status: 'confirmed',
              });
            } catch (err) {
              console.error('Failed to book equipment:', equipmentId, err);
            }
          }
          enqueueSnackbar(`${selectedEquipment.length} utstyr booket`, { variant: 'info' });
        }
      }
      if (notes.trim().length > 0) {
        void globalTagService
          .add([
            ...selectedCrewNames,
            ...selectedCandidateNames,
            ...globalTagService.parseExplicitMentions(notes),
          ])
          .catch((error) => {
            console.warn('Kunne ikke oppdatere globalt tag-register fra produksjonskalender:', error);
          });
      }
      setDialogOpen(false);
      resetForm();
      loadEvents();
    } catch (error) {
      enqueueSnackbar('Kunne ikke lagre hendelse', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await calendarEventsApi.delete(eventId);
      enqueueSnackbar('Hendelse slettet', { variant: 'success' });
      loadEvents();
    } catch (error) {
      enqueueSnackbar('Kunne ikke slette hendelse', { variant: 'error' });
    }
  };

  const getEventTypeConfig = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
  };

  const formatDateTime = (dateStr: string, showTime = true) => {
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('nb-NO', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
    if (!showTime) return dateFormatted;
    const timeFormatted = date.toLocaleTimeString('nb-NO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${dateFormatted} kl. ${timeFormatted}`;
  };

  const groupEventsByDate = () => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach(event => {
      const dateKey = new Date(event.start_time).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const groupedEvents = groupEventsByDate();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.25, sm: 1.5 },
          borderRadius: 2.5,
          border: '1px solid rgba(148,163,184,0.28)',
          background: 'linear-gradient(120deg, rgba(124,58,237,0.16) 0%, rgba(56,189,248,0.1) 52%, rgba(15,23,42,0.24) 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              border: '1px solid rgba(233,213,255,0.34)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(147,51,234,0.3)',
            }}
          >
            <CalendarMonthIcon sx={{ color: '#fff', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.15 }}>
              Produksjonskalender
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
              Role Room Pro-visning
            </Typography>
          </Box>
        </Box>
        <Chip
          size="small"
          label="PRO"
          sx={{
            bgcolor: 'rgba(192,132,252,0.2)',
            color: '#f5d0fe',
            border: '1px solid rgba(192,132,252,0.45)',
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            bgcolor: '#10b981',
            color: '#fff',
            fontWeight: 700,
            '&:hover': { bgcolor: '#059669' },
          }}
        >
          Ny hendelse
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {EVENT_TYPES.map((type) => (
          <Chip
            key={type.value}
            icon={type.icon as React.ReactElement}
            label={type.label}
            size="small"
            sx={{
              bgcolor: `${type.color}20`,
              color: type.color,
              '& .MuiChip-icon': { color: type.color },
            }}
          />
        ))}
      </Box>

      <CalendarMonthHeader
        monthDate={calendarMonth}
        viewMode={viewMode === 'list' ? 'month' : (viewMode as 'month' | 'week' | 'day')}
        onMonthChange={setCalendarMonth}
        onViewModeChange={(mode) => setViewMode(mode)}
      />

      {viewMode === 'month' ? (
        <MonthGridView
          monthDate={calendarMonth}
          events={events}
          eventTypeConfig={{
            audition: { label: 'Audition', color: '#f59e0b', icon: <TheatersIcon /> },
            selection: { label: 'Utvelgelse', color: '#22d3ee', icon: <HowToRegIcon /> },
            fitting: { label: 'Kostyme/Fitting', color: '#ec4899', icon: <CheckroomIcon /> },
            rehearsal: { label: 'Prøve', color: '#8b5cf6', icon: <GroupsIcon /> },
            shooting: { label: 'Opptak', color: '#10b981', icon: <MovieIcon /> },
            general: { label: 'Generelt', color: '#6b7280', icon: <EventIcon /> },
          }}
          onAddEventForDate={(date) => {
            setStartTime(`${date.toISOString().slice(0, 10)}T09:00`);
            setEndTime(`${date.toISOString().slice(0, 10)}T17:00`);
            handleOpenDialog();
          }}
          onEditEvent={(event) => handleOpenDialog(event)}
        />
      ) : events.length === 0 ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
          Ingen hendelser planlagt. Klikk "Ny hendelse" for å legge til opptak, prøver, eller andre produksjonshendelser.
        </Alert>
      ) : (
        <Box>
          {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
            <Box key={dateKey} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: { xs: 2, md: 2.5 } }}>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  color: '#fff', 
                  fontWeight: 600, 
                  mb: 0,
                  pb: 1,
                  borderBottom: '1px solid rgba(148,163,184,0.24)',
                }}
              >
                {new Date(dateKey).toLocaleDateString('nb-NO', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric',
                })}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    xl: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: { xs: 1.5, sm: 2, lg: 2.25 },
                  alignItems: 'stretch',
                }}
              >
                {dayEvents.map((event) => {
                  const typeConfig = getEventTypeConfig(event.event_type);
                  const location = locations.find(l => l.id === event.location_id);
                  const eventCandidates = candidates.filter(c => event.candidate_ids?.includes(c.id));
                  const eventCrew = crew.filter(c => event.crew_ids?.includes(c.id));

                  return (
                    <Card
                      key={event.id}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${typeConfig.color}40`,
                        borderLeft: `4px solid ${typeConfig.color}`,
                        borderRadius: 2,
                        minWidth: 0,
                        height: '100%',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: typeConfig.color,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <CardContent
                        sx={{
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.75,
                          '&:last-child': { pb: 2 },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.25 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ color: typeConfig.color }}>{typeConfig.icon}</Box>
                            <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                              {event.title}
                            </Typography>
                          </Box>
                          <Box>
                            <Tooltip title="Rediger">
                              <IconButton size="small" onClick={() => handleOpenDialog(event)}>
                                <EditIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Slett">
                              <IconButton size="small" onClick={() => handleDelete(event.id)}>
                                <DeleteIcon sx={{ fontSize: 16, color: 'rgba(239,68,68,0.7)' }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                            {event.all_day ? 'Hele dagen' : (
                              <>
                                {new Date(event.start_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                                {event.end_time && ` - ${new Date(event.end_time).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`}
                              </>
                            )}
                          </Typography>
                        </Box>

                        {location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationOnIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              {location.name}
                            </Typography>
                          </Box>
                        )}

                        {eventCandidates.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PersonIcon sx={{ fontSize: 14, color: '#8b5cf6' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              {eventCandidates.map(c => c.name).join(', ')}
                            </Typography>
                          </Box>
                        )}

                        {eventCrew.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <GroupsIcon sx={{ fontSize: 14, color: '#06b6d4' }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                              {eventCrew.map((member) => crewLabel(member)).join(', ')}
                            </Typography>
                          </Box>
                        )}

                        {event.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', pt: 0.25, fontStyle: 'italic' }}>
                            {event.description}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <CalendarStatsBar events={events} />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              color: '#fff',
              border: '1px solid rgba(168,85,247,0.45)',
              borderRadius: 3,
              background:
                'radial-gradient(120% 150% at 0% 0%, rgba(34,211,238,0.14) 0%, rgba(15,23,42,0) 44%), linear-gradient(165deg, rgba(17,12,36,0.98) 0%, rgba(8,9,22,0.98) 100%)',
              boxShadow:
                '0 28px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,211,238,0.14) inset, 0 0 32px rgba(168,85,247,0.25)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            borderBottom: '1px solid rgba(168,85,247,0.35)',
            background: 'linear-gradient(120deg, rgba(124,58,237,0.42) 0%, rgba(15,23,42,0.9) 55%, rgba(34,211,238,0.24) 100%)',
          }}
        >
          <Box sx={{ color: eventTypeConfig.color, display: 'inline-flex', alignItems: 'center' }}>
            {eventTypeConfig.icon}
          </Box>
          <CalendarMonthIcon sx={{ color: '#c084fc' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {editingEvent ? 'Rediger hendelse' : 'Ny hendelse'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.78)' }}>
              Produksjonsplan • Role Room
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            pt: 2.5,
            px: 3,
            pb: 2.75,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.34) 0%, rgba(8,10,24,0.18) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.75,
                border: '1px solid rgba(148,163,184,0.28)',
                bgcolor: 'rgba(15,23,42,0.46)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>
                  Workflow-sjekk
                </Typography>
                <Chip
                  size="small"
                  label={`${readinessLabel} • ${readinessScore}%`}
                  sx={{
                    bgcolor: hasBlockingWorkflowGap ? alpha('#ef4444', 0.2) : workflowGaps.length > 0 ? alpha('#f59e0b', 0.2) : alpha('#10b981', 0.2),
                    color: hasBlockingWorkflowGap ? '#fecaca' : workflowGaps.length > 0 ? '#fde68a' : '#bbf7d0',
                    border: `1px solid ${hasBlockingWorkflowGap ? 'rgba(239,68,68,0.55)' : workflowGaps.length > 0 ? 'rgba(245,158,11,0.55)' : 'rgba(16,185,129,0.55)'}`,
                    fontWeight: 700,
                  }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={readinessScore}
                sx={{
                  mt: 1,
                  mb: 1.25,
                  height: 8,
                  borderRadius: 999,
                  bgcolor: 'rgba(51,65,85,0.6)',
                  '& .MuiLinearProgress-bar': {
                    background: hasBlockingWorkflowGap
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : workflowGaps.length > 0
                        ? 'linear-gradient(90deg, #f59e0b, #eab308)'
                        : 'linear-gradient(90deg, #10b981, #22d3ee)',
                  },
                }}
              />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {workflowGaps.length === 0 ? (
                  <Chip
                    size="small"
                    label="Ingen workflow-gap oppdaget"
                    sx={{
                      bgcolor: 'rgba(16,185,129,0.2)',
                      color: '#bbf7d0',
                      border: '1px solid rgba(16,185,129,0.45)',
                      fontWeight: 600,
                    }}
                  />
                ) : (
                  workflowGaps.map((gap) => (
                    <Chip
                      key={gap.id}
                      size="small"
                      icon={<WarningIcon sx={{ fontSize: 14 }} />}
                      label={gap.text}
                      sx={{
                        bgcolor: gap.severity === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: gap.severity === 'error' ? '#fecaca' : '#fde68a',
                        border: `1px solid ${gap.severity === 'error' ? 'rgba(239,68,68,0.45)' : 'rgba(245,158,11,0.45)'}`,
                        '& .MuiChip-icon': {
                          color: gap.severity === 'error' ? '#fecaca' : '#fde68a',
                        },
                      }}
                    />
                  ))
                )}
              </Box>
            </Box>
            <TextField
              label="Tittel *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              sx={modalFieldSx}
            />

            <FormControl fullWidth>
              <InputLabel sx={modalFieldSx['& .MuiInputLabel-root']}>Type</InputLabel>
              <Select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                label="Type"
                sx={modalFieldSx}
              >
                {EVENT_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ color: type.color }}>{type.icon}</Box>
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  color="secondary"
                />
              }
              label="Hele dagen"
              sx={{ color: 'rgba(226,232,240,0.88)' }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Starttid *"
                type={allDay ? 'date' : 'datetime-local'}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={modalFieldSx}
              />
              {!allDay && (
                <TextField
                  label="Sluttid"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  sx={modalFieldSx}
                />
              )}
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={modalFieldSx['& .MuiInputLabel-root']}>Lokasjon</InputLabel>
              <Select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                label="Lokasjon"
                sx={modalFieldSx}
              >
                <MenuItem value="">Ingen lokasjon</MenuItem>
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleRequestEntityCreate('location')}
                sx={{
                  borderColor: 'rgba(34,211,238,0.45)',
                  color: '#67e8f9',
                  '&:hover': {
                    borderColor: 'rgba(34,211,238,0.75)',
                    bgcolor: 'rgba(34,211,238,0.12)',
                  },
                }}
              >
                Ny lokasjon
              </Button>
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={modalFieldSx['& .MuiInputLabel-root']}>Kandidater</InputLabel>
              <Select
                multiple
                value={selectedCandidates}
                onChange={(e) => setSelectedCandidates(e.target.value as string[])}
                input={<OutlinedInput label="Kandidater" />}
                sx={modalFieldSx}
                renderValue={(selected) => 
                  candidates
                    .filter(c => selected.includes(c.id))
                    .map(c => c.name)
                    .join(', ')
                }
              >
                {candidates.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <Checkbox checked={selectedCandidates.includes(c.id)} />
                    <ListItemText primary={c.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleRequestEntityCreate('candidate')}
                sx={{
                  borderColor: 'rgba(245,158,11,0.5)',
                  color: '#fcd34d',
                  '&:hover': {
                    borderColor: 'rgba(245,158,11,0.75)',
                    bgcolor: 'rgba(245,158,11,0.12)',
                  },
                }}
              >
                Ny kandidat
              </Button>
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={modalFieldSx['& .MuiInputLabel-root']}>Team</InputLabel>
              <Select
                multiple
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value as string[])}
                input={<OutlinedInput label="Team" />}
                sx={modalFieldSx}
                renderValue={(selected) => 
                  crew
                    .filter(c => selected.includes(c.id))
                    .map((member) => crewLabel(member))
                    .join(', ')
                }
              >
                {crew.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    <Checkbox checked={selectedCrew.includes(c.id)} />
                    <ListItemText
                      primary={c.name}
                      secondary={c.role ? getRoleLabel(c.role) : 'Mangler rolle'}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleRequestEntityCreate('crew')}
                sx={{
                  borderColor: 'rgba(59,130,246,0.5)',
                  color: '#93c5fd',
                  '&:hover': {
                    borderColor: 'rgba(59,130,246,0.75)',
                    bgcolor: 'rgba(59,130,246,0.12)',
                  },
                }}
              >
                Nytt crew-medlem
              </Button>
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={modalFieldSx['& .MuiInputLabel-root']}>Utstyr</InputLabel>
              <Select
                multiple
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value as string[])}
                input={<OutlinedInput label="Utstyr" />}
                sx={modalFieldSx}
                renderValue={(selected) => 
                  equipment
                    .filter(e => selected.includes(e.id))
                    .map(e => e.name)
                    .join(', ')
                }
              >
                {equipment.map((eq) => (
                  <MenuItem key={eq.id} value={eq.id}>
                    <Checkbox checked={selectedEquipment.includes(eq.id)} />
                    <ListItemText 
                      primary={eq.name} 
                      secondary={`${eq.category || ''} ${eq.brand ? `- ${eq.brand}` : ''}`}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => handleRequestEntityCreate('equipment')}
                sx={{
                  borderColor: 'rgba(16,185,129,0.5)',
                  color: '#6ee7b7',
                  '&:hover': {
                    borderColor: 'rgba(16,185,129,0.75)',
                    bgcolor: 'rgba(16,185,129,0.12)',
                  },
                }}
              >
                Nytt utstyr
              </Button>
            </Box>

            {equipmentConflicts.size > 0 && (
              <Alert severity="warning" icon={<WarningIcon />}>
                <Typography variant="body2" fontWeight="bold">Utstyrskonflikter funnet:</Typography>
                {Array.from(equipmentConflicts.entries()).map(([equipmentId, conflicts]) => (
                  <Typography key={equipmentId} variant="body2">
                    {equipment.find(e => e.id === equipmentId)?.name}: {conflicts.length} konflikt(er)
                  </Typography>
                ))}
              </Alert>
            )}

            <TextField
              label="Beskrivelse"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              fullWidth
              sx={modalFieldSx}
            />

            <TextField
              label="Notater"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
              sx={modalFieldSx}
            />
            <GlobalMentionHelper
              text={notes}
              localCandidates={mentionCandidates}
              onApplySuggestion={(name) => setNotes((previous) => applyMentionSuggestion(previous, name))}
            />
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(168,85,247,0.25)',
            bgcolor: 'rgba(8,10,24,0.84)',
            backdropFilter: 'blur(8px)',
            px: 3,
            py: 2,
            gap: 1.2,
          }}
        >
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{
              color: 'rgba(226,232,240,0.92)',
              border: '1px solid rgba(148,163,184,0.38)',
              bgcolor: 'rgba(15,23,42,0.55)',
              '&:hover': { bgcolor: 'rgba(30,41,59,0.88)', borderColor: 'rgba(168,85,247,0.5)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
            disabled={submitting || !title || !startTime || hasBlockingWorkflowGap}
            sx={{
              bgcolor: '#10b981',
              color: '#fff',
              fontWeight: 700,
              border: '1px solid rgba(167,243,208,0.4)',
              boxShadow: '0 10px 24px rgba(5,150,105,0.35)',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            {editingEvent ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductionCalendarPanel;
