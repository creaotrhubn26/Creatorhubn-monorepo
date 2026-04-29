import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowOutward as ArrowOutwardIcon,
  CalendarMonth as CalendarMonthIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  CloudUpload as CloudUploadIcon,
  Forum as ForumIcon,
  LockOutlined as LockOutlinedIcon,
  MarkEmailRead as MarkEmailReadIcon,
  MovieCreation as MovieCreationIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  TaskAlt as TaskAltIcon,
  TravelExplore as TravelExploreIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import {
  DEFAULT_TALENT_REMINDER_PREFS,
  talentPortalApi,
  type RoleRoomTalentPortalActivity,
  type RoleRoomTalentPortalAssignment,
  type RoleRoomTalentPortalCandidate,
  type RoleRoomTalentPortalInvite,
  type RoleRoomTalentPortalMediaItem,
  type RoleRoomTalentPortalResponse,
  type RoleRoomTalentPortalSchedule,
  type RoleRoomTalentReminderPrefs,
} from '../services/castingApiService';
import type { TalentPortalIntent, TalentPortalSection } from '../utils/talentPortal';
import { buildTalentPortalUrl } from '../utils/talentPortal';
import RoleRoomBrandMark from './shared/RoleRoomBrandMark';

interface TalentPortalViewProps {
  intent?: TalentPortalIntent | null;
  onClose?: () => void;
}

type ProfileDraft = {
  phone: string;
  agency: string;
  bio: string;
  city: string;
  baseLocation: string;
  website: string;
  instagram: string;
  portfolioUrl: string;
  showreelUrl: string;
  languages: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  reminderPrefs: RoleRoomTalentReminderPrefs;
};

type SelfTapeDraft = {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  notes: string;
};

type FeedbackDraft = {
  quote: string;
};

const SURFACE = 'rgba(7, 13, 26, 0.72)';
const SURFACE_ALT = 'rgba(10, 18, 34, 0.84)';
const BORDER = 'rgba(125, 211, 252, 0.14)';
const TEXT_PRIMARY = 'rgba(241, 245, 249, 0.96)';
const TEXT_SECONDARY = 'rgba(191, 219, 254, 0.74)';
const TEXT_MUTED = 'rgba(148, 163, 184, 0.78)';
const ACCENT = '#7dd3fc';
const ACCENT_ALT = '#a855f7';
const SUCCESS = '#34d399';
const WARNING = '#fbbf24';

const SECTION_OPTIONS: Array<{ id: TalentPortalSection; label: string }> = [
  { id: 'overview', label: 'Oversikt' },
  { id: 'auditions', label: 'Auditions' },
  { id: 'selftapes', label: 'Self tapes' },
  { id: 'activity', label: 'Oppdateringer' },
  { id: 'profile', label: 'Profil' },
];

const cardSx = {
  borderRadius: 4,
  border: `1px solid ${BORDER}`,
  bgcolor: SURFACE,
  backdropFilter: 'blur(24px)',
  boxShadow: '0 22px 80px rgba(2, 6, 23, 0.42)',
};

const formatDateLabel = (value?: string | null): string => {
  if (!value) {
    return 'Ikke satt';
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
};

const formatDateTimeLabel = (value?: string | null): string => {
  if (!value) {
    return 'Na';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const formatTimeLabel = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.slice(0, 5);
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) {
    return 'Ukjent storrelse';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let nextValue = value;
  let unitIndex = 0;
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }
  return `${nextValue.toFixed(nextValue >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const normalizeStatusLabel = (status?: string | null): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'confirmed') return 'Bekreftet';
  if (normalized === 'selected') return 'Valgt';
  if (normalized === 'shortlist') return 'Shortlist';
  if (normalized === 'requested') return 'Invitert';
  if (normalized === 'viewed') return 'Sett';
  if (normalized === 'accepted') return 'Aktiv';
  if (normalized === 'auditioned') return 'Audition gjennomfort';
  if (normalized === 'completed') return 'Fullfort';
  if (normalized === 'cancelled') return 'Avlyst';
  if (normalized === 'scheduled') return 'Planlagt';
  if (normalized === 'pending') return 'Venter';
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Aktiv';
};

const getStatusTone = (status?: string | null): { fg: string; bg: string; border: string } => {
  const normalized = String(status || '').trim().toLowerCase();
  if (['confirmed', 'selected', 'accepted'].includes(normalized)) {
    return { fg: SUCCESS, bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.32)' };
  }
  if (['cancelled', 'declined', 'rejected'].includes(normalized)) {
    return { fg: '#fda4af', bg: 'rgba(251, 113, 133, 0.12)', border: 'rgba(251, 113, 133, 0.28)' };
  }
  if (['requested', 'shortlist', 'viewed', 'sent'].includes(normalized)) {
    return { fg: WARNING, bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.28)' };
  }
  return { fg: ACCENT, bg: 'rgba(125, 211, 252, 0.12)', border: 'rgba(125, 211, 252, 0.26)' };
};

const getActivityTone = (entryType?: string | null): { fg: string; bg: string; border: string } => {
  const normalized = String(entryType || '').trim().toLowerCase();
  if (normalized.includes('upload') || normalized.includes('self_tape')) {
    return { fg: ACCENT, bg: 'rgba(8, 47, 73, 0.42)', border: BORDER };
  }
  if (normalized.includes('invite')) {
    return { fg: WARNING, bg: 'rgba(120, 53, 15, 0.26)', border: 'rgba(251, 191, 36, 0.26)' };
  }
  if (normalized.includes('message')) {
    return { fg: ACCENT_ALT, bg: 'rgba(88, 28, 135, 0.24)', border: 'rgba(168, 85, 247, 0.26)' };
  }
  return { fg: SUCCESS, bg: 'rgba(6, 78, 59, 0.24)', border: 'rgba(52, 211, 153, 0.24)' };
};

const isUpcomingSchedule = (schedule: RoleRoomTalentPortalSchedule): boolean => {
  if (!schedule.date) {
    return false;
  }
  const time = schedule.startTime || '23:59';
  const parsed = new Date(`${schedule.date}T${time}`);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() >= Date.now() - 60_000;
};

const buildProfileDraft = (candidate: RoleRoomTalentPortalCandidate): ProfileDraft => ({
  phone: candidate.phone || '',
  agency: candidate.agency || '',
  bio: candidate.profile.bio || '',
  city: candidate.profile.city || '',
  baseLocation: candidate.profile.baseLocation || '',
  website: candidate.profile.website || '',
  instagram: candidate.profile.instagram || '',
  portfolioUrl: candidate.profile.portfolioUrl || '',
  showreelUrl: candidate.profile.showreelUrl || '',
  languages: candidate.profile.languages.join(', '),
  emergencyContactName: typeof candidate.emergencyContact.name === 'string' ? candidate.emergencyContact.name : '',
  emergencyContactPhone: typeof candidate.emergencyContact.phone === 'string' ? candidate.emergencyContact.phone : '',
  emergencyContactRelationship:
    typeof candidate.emergencyContact.relationship === 'string'
      ? candidate.emergencyContact.relationship
      : '',
  reminderPrefs: candidate.reminderPrefs ?? { ...DEFAULT_TALENT_REMINDER_PREFS },
});

const emptyProfileDraft = (): ProfileDraft => ({
  phone: '',
  agency: '',
  bio: '',
  city: '',
  baseLocation: '',
  website: '',
  instagram: '',
  portfolioUrl: '',
  showreelUrl: '',
  languages: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  reminderPrefs: { ...DEFAULT_TALENT_REMINDER_PREFS },
});

const emptySelfTapeDraft = (): SelfTapeDraft => ({
  title: 'Self tape',
  videoUrl: '',
  thumbnailUrl: '',
  notes: '',
});

const normalizeFileTitle = (file: File): string => (
  file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'Self tape'
);

const renderActivityMeta = (invite?: RoleRoomTalentPortalInvite | null): string => {
  if (!invite) {
    return 'Ingen aktiv invitasjon';
  }
  if (invite.acceptedAt) {
    return `Aktivert ${formatDateTimeLabel(invite.acceptedAt)}`;
  }
  if (invite.lastViewedAt) {
    return `Sett ${formatDateTimeLabel(invite.lastViewedAt)}`;
  }
  if (invite.expiresAt) {
    return `Utloper ${formatDateLabel(invite.expiresAt.slice(0, 10))}`;
  }
  return 'Invitasjon sendt';
};

const extractFirstUrl = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      continue;
    }
    const match = value.match(/https?:\/\/[^\s)]+/i);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
};

const buildGoogleCalendarHref = (
  schedule: RoleRoomTalentPortalSchedule,
  assignment: RoleRoomTalentPortalAssignment,
): string | null => {
  if (!schedule.date || !schedule.startTime) {
    return null;
  }

  const start = new Date(`${schedule.date}T${schedule.startTime}`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const [endHours, endMinutes] = typeof schedule.endTime === 'string' && schedule.endTime.length >= 5
    ? schedule.endTime.split(':').map((value) => Number(value))
    : [NaN, NaN];
  const end = Number.isFinite(endHours) && Number.isFinite(endMinutes)
    ? new Date(`${schedule.date}T${schedule.endTime}`)
    : new Date(start.getTime() + 45 * 60 * 1000);

  const formatCalendarDate = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const title = `${schedule.roleName || 'Møte'} · ${assignment.project.name}`;
  const details = [
    schedule.notes?.trim(),
    assignment.project.description?.trim(),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatCalendarDate(start)}/${formatCalendarDate(end)}`,
    location: schedule.location?.trim() || 'The Role Room',
  });

  if (details.length > 0) {
    params.set('details', details);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export default function TalentPortalView({ intent, onClose }: TalentPortalViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [portalData, setPortalData] = useState<RoleRoomTalentPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<TalentPortalSection>(intent?.section ?? 'overview');
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [selfTapeDraft, setSelfTapeDraft] = useState<SelfTapeDraft>(emptySelfTapeDraft);
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft>({ quote: '' });
  const [messageDraft, setMessageDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingSelfTape, setSubmittingSelfTape] = useState(false);
  const [uploadingSelfTapeFile, setUploadingSelfTapeFile] = useState(false);
  const [openingMediaId, setOpeningMediaId] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const loadPortal = useCallback(async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await talentPortalApi.getOverview({
        projectId: intent?.projectId,
        candidateId: intent?.candidateId,
        inviteToken: intent?.inviteToken,
      });
      setPortalData(response);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Kunne ikke laste talentportalen';
      setError(message);
    } finally {
      if (!options?.background) {
        setLoading(false);
      }
    }
  }, [intent?.candidateId, intent?.inviteToken, intent?.projectId]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (!portalData?.assignments.length) {
      setSelectedAssignmentKey(null);
      return;
    }

    const requestedAssignment = portalData.assignments.find((assignment) => (
      (!intent?.projectId || assignment.project.id === intent.projectId)
      && (!intent?.candidateId || assignment.candidate.id === intent.candidateId)
    ));
    const fallbackAssignment = requestedAssignment ?? portalData.assignments[0];
    setSelectedAssignmentKey((current) => {
      if (current && portalData.assignments.some((assignment) => `${assignment.project.id}:${assignment.candidate.id}` === current)) {
        return current;
      }
      return `${fallbackAssignment.project.id}:${fallbackAssignment.candidate.id}`;
    });
  }, [intent?.candidateId, intent?.projectId, portalData]);

  const assignments = portalData?.assignments ?? [];

  const selectedAssignment = useMemo<RoleRoomTalentPortalAssignment | null>(() => {
    if (!assignments.length) {
      return null;
    }
    if (!selectedAssignmentKey) {
      return assignments[0];
    }
    return assignments.find((assignment) => `${assignment.project.id}:${assignment.candidate.id}` === selectedAssignmentKey) ?? assignments[0];
  }, [assignments, selectedAssignmentKey]);

  useEffect(() => {
    if (!selectedAssignment) {
      setProfileDraft(emptyProfileDraft());
      setSelfTapeDraft(emptySelfTapeDraft());
      setFeedbackDraft({ quote: '' });
      setMessageDraft('');
      setSelectedFile(null);
      return;
    }

    setProfileDraft(buildProfileDraft(selectedAssignment.candidate));
    setSelfTapeDraft(emptySelfTapeDraft());
    setFeedbackDraft({ quote: '' });
    setMessageDraft('');
    setSelectedFile(null);
  }, [selectedAssignment]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextUrl = buildTalentPortalUrl({
      projectId: selectedAssignment?.project.id,
      candidateId: selectedAssignment?.candidate.id,
      inviteToken: intent?.inviteToken,
      section: activeSection,
    });
    if (nextUrl) {
      window.history.replaceState({}, document.title, nextUrl);
    }
  }, [activeSection, intent?.inviteToken, selectedAssignment]);

  const upcomingSchedules = useMemo(
    () => selectedAssignment?.schedules.filter((schedule) => isUpcomingSchedule(schedule)) ?? [],
    [selectedAssignment],
  );

  const nextSchedule = upcomingSchedules[0] ?? null;
  const activityItems = useMemo<RoleRoomTalentPortalActivity[]>(
    () => (selectedAssignment?.activity ?? []).slice().sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    }),
    [selectedAssignment],
  );
  const invite = selectedAssignment?.invite ?? null;
  const nextScheduleJoinUrl = useMemo(
    () => extractFirstUrl(nextSchedule?.location, nextSchedule?.notes),
    [nextSchedule?.location, nextSchedule?.notes],
  );
  const nextScheduleCalendarHref = useMemo(
    () => (selectedAssignment && nextSchedule ? buildGoogleCalendarHref(nextSchedule, selectedAssignment) : null),
    [nextSchedule, selectedAssignment],
  );

  const nextStep = useMemo(() => {
    if (!selectedAssignment) {
      return {
        title: 'Venter pa tilgang',
        description: 'Sa snart du er knyttet til en audition eller produksjon dukker det opp her.',
      };
    }

    if (selectedFile) {
      return {
        title: 'Last opp self tape',
        description: `${selectedFile.name} er klar til opplasting i portalen.`,
      };
    }

    if (selectedAssignment.candidate.videos.length === 0) {
      return {
        title: 'Lever self tape',
        description: 'Du kan laste opp videofil direkte eller sende sikker videolenke til teamet.',
      };
    }

    if (nextSchedule) {
      return {
        title: 'Forbered neste audition',
        description: `${formatDateLabel(nextSchedule.date)} ${formatTimeLabel(nextSchedule.startTime)}${nextSchedule.location ? ` • ${nextSchedule.location}` : ''}`,
      };
    }

    if (invite && !invite.acceptedAt) {
      return {
        title: 'Invitasjon aktiv',
        description: 'Portalen er klar. Oppdater profilen og send inn materiale slik at teamet kan ga videre.',
      };
    }

    return {
      title: 'Portalen er aktiv',
      description: 'Hold profilen oppdatert, folg status og hold dialogen med teamet samlet her.',
    };
  }, [invite, nextSchedule, selectedAssignment, selectedFile]);

  const handleSelectAssignment = (assignment: RoleRoomTalentPortalAssignment) => {
    setSelectedAssignmentKey(`${assignment.project.id}:${assignment.candidate.id}`);
    setSuccessMessage(null);
  };

  const handleRefresh = () => {
    void loadPortal({ background: true });
  };

  const handleSaveProfile = async () => {
    if (!selectedAssignment) {
      return;
    }

    setSavingProfile(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await talentPortalApi.updateProfile({
        projectId: selectedAssignment.project.id,
        candidateId: selectedAssignment.candidate.id,
        phone: profileDraft.phone,
        agency: profileDraft.agency,
        bio: profileDraft.bio,
        city: profileDraft.city,
        baseLocation: profileDraft.baseLocation,
        website: profileDraft.website,
        instagram: profileDraft.instagram,
        portfolioUrl: profileDraft.portfolioUrl,
        showreelUrl: profileDraft.showreelUrl,
        languages: profileDraft.languages
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        emergencyContact: {
          name: profileDraft.emergencyContactName,
          phone: profileDraft.emergencyContactPhone,
          relationship: profileDraft.emergencyContactRelationship,
        },
        reminderPrefs: profileDraft.reminderPrefs,
      });
      setSuccessMessage('Profilen din er oppdatert.');
      await loadPortal({ background: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kunne ikke lagre profilen');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitSelfTapeLink = async () => {
    if (!selectedAssignment) {
      return;
    }
    if (!selfTapeDraft.videoUrl.trim()) {
      setError('Legg inn en gyldig videolenke for a sende self tape.');
      return;
    }

    setSubmittingSelfTape(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await talentPortalApi.submitSelfTape({
        projectId: selectedAssignment.project.id,
        candidateId: selectedAssignment.candidate.id,
        title: selfTapeDraft.title.trim() || 'Self tape',
        videoUrl: selfTapeDraft.videoUrl.trim(),
        thumbnailUrl: selfTapeDraft.thumbnailUrl.trim() || undefined,
        notes: selfTapeDraft.notes.trim() || undefined,
      });
      setSelfTapeDraft(emptySelfTapeDraft());
      setSuccessMessage('Self tape-lenken er sendt inn til teamet.');
      await loadPortal({ background: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke sende inn self tape');
    } finally {
      setSubmittingSelfTape(false);
    }
  };

  const handleUploadSelfTapeFile = async () => {
    if (!selectedAssignment || !selectedFile) {
      setError('Velg en videofil for a laste opp self tape.');
      return;
    }

    setUploadingSelfTapeFile(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await talentPortalApi.uploadSelfTapeFile({
        projectId: selectedAssignment.project.id,
        candidateId: selectedAssignment.candidate.id,
        title: selfTapeDraft.title.trim() || normalizeFileTitle(selectedFile),
        notes: selfTapeDraft.notes.trim() || undefined,
        file: selectedFile,
      });
      setSelectedFile(null);
      setSelfTapeDraft(emptySelfTapeDraft());
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage('Self tape-filen er lastet opp til portalens sikre videolager.');
      await loadPortal({ background: true });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Kunne ikke laste opp self tape');
    } finally {
      setUploadingSelfTapeFile(false);
    }
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
    if (nextFile) {
      setSelfTapeDraft((current) => ({
        ...current,
        title: current.title.trim() === '' || current.title === 'Self tape' ? normalizeFileTitle(nextFile) : current.title,
      }));
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackDraft.quote.trim()) {
      setError('Skriv en kort erfaring for a sende inn feedback.');
      return;
    }

    setSubmittingFeedback(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await talentPortalApi.submitTestimonial({
        quote: feedbackDraft.quote.trim(),
        roleId: 'talent',
      });
      setFeedbackDraft({ quote: '' });
      setSuccessMessage('Tilbakemeldingen din er sendt til vurdering.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke sende inn tilbakemelding');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedAssignment) {
      return;
    }
    if (messageDraft.trim().length < 5) {
      setError('Skriv en litt tydeligere melding til teamet.');
      return;
    }

    setSendingMessage(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await talentPortalApi.sendMessage({
        projectId: selectedAssignment.project.id,
        candidateId: selectedAssignment.candidate.id,
        body: messageDraft.trim(),
      });
      setMessageDraft('');
      setSuccessMessage('Meldingen er sendt til teamet og logget i portalen.');
      await loadPortal({ background: true });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Kunne ikke sende meldingen');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleOpenMedia = async (media: RoleRoomTalentPortalMediaItem) => {
    try {
      setOpeningMediaId(media.id);
      if (!media.requiresAuth && /^https?:\/\//i.test(media.url)) {
        window.open(media.url, '_blank', 'noopener,noreferrer');
        return;
      }

      const blob = await talentPortalApi.fetchProtectedMediaBlob(media.url);
      const objectUrl = window.URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Kunne ikke apne mediet');
    } finally {
      setOpeningMediaId(null);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#020617',
          color: TEXT_PRIMARY,
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress sx={{ color: ACCENT }} />
          <Typography sx={{ fontWeight: 700 }}>Laster talentportal...</Typography>
        </Stack>
      </Box>
    );
  }

  if (!selectedAssignment) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          px: { xs: 2.5, md: 4 },
          py: { xs: 3, md: 4 },
          color: TEXT_PRIMARY,
          background:
            'radial-gradient(circle at top left, rgba(125,211,252,0.16), transparent 28%), radial-gradient(circle at top right, rgba(168,85,247,0.15), transparent 26%), linear-gradient(180deg, #020617 0%, #050816 46%, #020617 100%)',
        }}
      >
        <Box sx={{ ...cardSx, maxWidth: 820, mx: 'auto', p: { xs: 3, md: 4 } }}>
          <Stack spacing={2.5}>
            <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 96, md: 124 } }} />
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 800 }}>
              Talent Portal
            </Typography>
            <Typography sx={{ color: TEXT_SECONDARY, maxWidth: 620, lineHeight: 1.75 }}>
              Dette er den dedikerte portalen for skuespillere og talent i The Role Room. Her samles invitasjoner,
              auditions, self tapes og status i en trygg arbeidsflate uten resten av produksjonsdashbordet.
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Alert severity="info" sx={{ bgcolor: 'rgba(8, 47, 73, 0.44)', color: TEXT_PRIMARY }}>
              Vi fant ingen aktive prosjekter koblet til den innloggede e-posten din. Be teamet sende deg en invitasjonslenke
              eller knytte deg til kandidatprofilen i prosjektet.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                variant="contained"
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
                sx={{
                  alignSelf: 'flex-start',
                  borderRadius: 999,
                  px: 2.2,
                  bgcolor: ACCENT,
                  color: '#031522',
                  '&:hover': { bgcolor: '#bae6fd' },
                }}
              >
                Oppdater
              </Button>
              {onClose ? (
                <Button
                  variant="outlined"
                  onClick={onClose}
                  sx={{
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    px: 2.2,
                    borderColor: BORDER,
                    color: TEXT_PRIMARY,
                  }}
                >
                  Tilbake til landing
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      </Box>
    );
  }

  const heroTone = getStatusTone(selectedAssignment.candidate.status);
  const inviteTone = getStatusTone(invite?.status);
  const rolesLabel = selectedAssignment.roles.map((role) => role.name).join(' • ') || 'Ingen roller koblet ennå';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 2, md: 3.5 },
        py: { xs: 2.25, md: 3.5 },
        color: TEXT_PRIMARY,
        background:
          'radial-gradient(circle at top left, rgba(125,211,252,0.16), transparent 24%), radial-gradient(circle at top right, rgba(168,85,247,0.16), transparent 26%), radial-gradient(circle at bottom left, rgba(52,211,153,0.12), transparent 22%), linear-gradient(180deg, #020617 0%, #050816 42%, #020617 100%)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          maxWidth: 1500,
          mx: 'auto',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(rgba(125,211,252,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'linear-gradient(180deg, rgba(255,255,255,0.42), transparent 88%)',
          },
        }}
      >
        <Box sx={{ ...cardSx, p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', lg: 'center' }}
              spacing={2}
            >
              <Stack spacing={1.4}>
                <RoleRoomBrandMark appearance="header" showLabel={false} sx={{ width: { xs: 104, md: 132 } }} />
                <Chip
                  label={`Talent Portal • ${normalizeStatusLabel(selectedAssignment.candidate.status)}`}
                  sx={{
                    alignSelf: 'flex-start',
                    color: heroTone.fg,
                    bgcolor: heroTone.bg,
                    border: `1px solid ${heroTone.border}`,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                />
                <Typography sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {selectedAssignment.candidate.name}
                </Typography>
                <Typography sx={{ color: TEXT_SECONDARY, maxWidth: 900, lineHeight: 1.75 }}>
                  En fokusert portal for skuespillere og talent i produksjon. Hold profilen oppdatert, send inn self tapes,
                  og folg hele dialogen med teamet uten a falle inn i produsentverktouyene.
                </Typography>
                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.98rem' }}>
                  {selectedAssignment.project.name} • {rolesLabel}
                </Typography>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} flexWrap="wrap">
                <Button
                  variant="outlined"
                  onClick={handleRefresh}
                  startIcon={<RefreshIcon />}
                  sx={{
                    borderRadius: 999,
                    borderColor: BORDER,
                    color: TEXT_PRIMARY,
                    px: 2.1,
                  }}
                >
                  Oppdater
                </Button>
                {onClose ? (
                  <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{
                      borderRadius: 999,
                      borderColor: BORDER,
                      color: TEXT_PRIMARY,
                      px: 2.1,
                    }}
                  >
                    Logg ut
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} flexWrap="wrap">
              {SECTION_OPTIONS.map((option) => {
                const isActive = activeSection === option.id;
                return (
                  <Button
                    key={option.id}
                    onClick={() => setActiveSection(option.id)}
                    sx={{
                      alignSelf: 'flex-start',
                      borderRadius: 999,
                      px: 2.2,
                      py: 1.05,
                      color: isActive ? '#031522' : TEXT_PRIMARY,
                      bgcolor: isActive ? ACCENT : 'rgba(15, 23, 42, 0.64)',
                      border: `1px solid ${isActive ? 'rgba(186,230,253,0.46)' : BORDER}`,
                      '&:hover': {
                        bgcolor: isActive ? '#bae6fd' : 'rgba(30, 41, 59, 0.92)',
                      },
                    }}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </Stack>

            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            {invite ? (
              <Box
                sx={{
                  ...cardSx,
                  p: 2,
                  borderColor: inviteTone.border,
                  bgcolor: 'rgba(7, 13, 26, 0.86)',
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  spacing={1.5}
                >
                  <Stack spacing={0.7}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MarkEmailReadIcon sx={{ color: inviteTone.fg, fontSize: 18 }} />
                      <Typography sx={{ fontWeight: 800 }}>
                        Invitasjonstatus: {normalizeStatusLabel(invite.status)}
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.65 }}>
                      {typeof invite.metadata.message === 'string' && invite.metadata.message.trim().length > 0
                        ? invite.metadata.message
                        : 'Du er koblet til en invitasjonsstyrt portal for dette prosjektet. All aktivitet logges i samme flyt som castingteamet bruker internt.'}
                    </Typography>
                  </Stack>
                  <Chip
                    label={renderActivityMeta(invite)}
                    sx={{
                      color: inviteTone.fg,
                      bgcolor: inviteTone.bg,
                      border: `1px solid ${inviteTone.border}`,
                    }}
                  />
                </Stack>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ mt: 1.5 }}
                >
                  <Button
                    variant="contained"
                    onClick={() => setActiveSection('auditions')}
                    startIcon={invite.acceptedAt ? <CheckCircleOutlineIcon /> : <MarkEmailReadIcon />}
                    sx={{
                      width: { xs: '100%', sm: 'auto' },
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)',
                      color: '#031522',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #bae6fd, #0ea5e9)',
                      },
                    }}
                  >
                    {invite.acceptedAt ? 'Se møteinvitasjoner' : 'Åpne invitasjonen'}
                  </Button>
                  {nextScheduleCalendarHref ? (
                    <Button
                      component="a"
                      href={nextScheduleCalendarHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      startIcon={<CalendarMonthIcon />}
                      sx={{
                        width: { xs: '100%', sm: 'auto' },
                        borderRadius: 999,
                        textTransform: 'none',
                        fontWeight: 700,
                        color: '#dbeafe',
                        borderColor: 'rgba(125, 211, 252, 0.28)',
                      }}
                    >
                      Legg i kalender
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            ) : null}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: assignments.length > 1 ? '280px 1fr' : '1fr' },
                gap: { xs: 2, xl: 2.2 },
              }}
            >
              {assignments.length > 1 ? (
                <Box sx={{ ...cardSx, p: 2.2, alignSelf: 'flex-start' }}>
                  <Stack spacing={1.2}>
                    <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                      Prosjekter
                    </Typography>
                    {assignments.map((assignment) => {
                      const isSelected = assignment.project.id === selectedAssignment.project.id && assignment.candidate.id === selectedAssignment.candidate.id;
                      const tone = getStatusTone(assignment.candidate.status);
                      return (
                        <Box
                          key={`${assignment.project.id}:${assignment.candidate.id}`}
                          onClick={() => handleSelectAssignment(assignment)}
                          sx={{
                            p: 1.6,
                            borderRadius: 3,
                            cursor: 'pointer',
                            border: `1px solid ${isSelected ? tone.border : BORDER}`,
                            bgcolor: isSelected ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.54)',
                            transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              borderColor: tone.border,
                              bgcolor: 'rgba(15, 23, 42, 0.88)',
                            },
                          }}
                        >
                          <Stack spacing={0.7}>
                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                              <Typography sx={{ fontWeight: 700 }}>{assignment.project.name}</Typography>
                              <Chip
                                size="small"
                                label={normalizeStatusLabel(assignment.candidate.status)}
                                sx={{
                                  color: tone.fg,
                                  bgcolor: tone.bg,
                                  border: `1px solid ${tone.border}`,
                                }}
                              />
                            </Stack>
                            <Typography sx={{ color: TEXT_SECONDARY, fontSize: '0.92rem' }}>
                              {assignment.roles.map((role) => role.name).join(' • ') || 'Ingen roller'}
                            </Typography>
                            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                              {assignment.stats.scheduleCount} auditions • {assignment.stats.selfTapeCount} self tapes • {assignment.stats.activityCount} oppdateringer
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              ) : null}

              <Stack spacing={2.1}>
                {nextSchedule ? (
                  <Box
                    sx={{
                      ...cardSx,
                      display: { xs: 'block', md: 'none' },
                      p: 2,
                      borderColor: 'rgba(125, 211, 252, 0.22)',
                      bgcolor: 'rgba(8, 15, 30, 0.92)',
                    }}
                  >
                    <Stack spacing={1.35}>
                      <Stack spacing={0.55}>
                        <Typography sx={{ fontSize: '0.76rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                          Neste møteinvitasjon
                        </Typography>
                        <Typography sx={{ fontSize: '1.18rem', fontWeight: 800, lineHeight: 1.2 }}>
                          {nextSchedule.roleName || 'Audition'}
                        </Typography>
                        <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                          Invitasjonen er {invite?.acceptedAt ? 'aktivert' : 'klar'} og kan håndteres direkte fra mobilen.
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={formatDateLabel(nextSchedule.date)}
                          sx={{ bgcolor: 'rgba(15, 23, 42, 0.78)', color: '#e2e8f0' }}
                        />
                        {nextSchedule.startTime ? (
                          <Chip
                            size="small"
                            label={formatTimeLabel(nextSchedule.startTime)}
                            sx={{ bgcolor: 'rgba(15, 23, 42, 0.78)', color: '#e2e8f0' }}
                          />
                        ) : null}
                        <Chip
                          size="small"
                          label={normalizeStatusLabel(nextSchedule.status)}
                          sx={{ bgcolor: 'rgba(8, 47, 73, 0.44)', color: '#bae6fd', border: `1px solid ${BORDER}` }}
                        />
                      </Stack>
                      <Typography sx={{ color: TEXT_MUTED, fontSize: '0.92rem', lineHeight: 1.6 }}>
                        {nextSchedule.location || 'Lokasjon kommer'}{nextSchedule.type ? ` • ${nextSchedule.type}` : ''}
                      </Typography>
                      <Stack spacing={0.85}>
                        {nextScheduleJoinUrl ? (
                          <Button
                            component="a"
                            href={nextScheduleJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="contained"
                            startIcon={<ArrowOutwardIcon />}
                            sx={{
                              width: '100%',
                              borderRadius: 999,
                              textTransform: 'none',
                              fontWeight: 800,
                              background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)',
                              color: '#031522',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #bae6fd, #0ea5e9)',
                              },
                            }}
                          >
                            Åpne møtelenke
                          </Button>
                        ) : null}
                        {nextScheduleCalendarHref ? (
                          <Button
                            component="a"
                            href={nextScheduleCalendarHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outlined"
                            startIcon={<CalendarMonthIcon />}
                            sx={{
                              width: '100%',
                              borderRadius: 999,
                              textTransform: 'none',
                              fontWeight: 700,
                              color: '#dbeafe',
                              borderColor: 'rgba(125, 211, 252, 0.28)',
                            }}
                          >
                            Legg i kalender
                          </Button>
                        ) : null}
                        <Button
                          variant="text"
                          startIcon={<ForumIcon />}
                          onClick={() => setActiveSection('activity')}
                          sx={{
                            width: '100%',
                            borderRadius: 999,
                            textTransform: 'none',
                            fontWeight: 700,
                            color: '#fde68a',
                          }}
                        >
                          Kontakt teamet
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                    gap: 1.2,
                  }}
                >
                  {[
                    {
                      label: 'Prosjekter',
                      value: String(portalData?.summary.projectCount ?? 0),
                      icon: <TravelExploreIcon sx={{ color: ACCENT }} />,
                    },
                    {
                      label: 'Neste audition',
                      value: nextSchedule ? formatDateLabel(nextSchedule.date) : 'Ikke satt',
                      icon: <CalendarMonthIcon sx={{ color: ACCENT_ALT }} />,
                    },
                    {
                      label: 'Self tapes',
                      value: String(selectedAssignment.candidate.videos.length),
                      icon: <MovieCreationIcon sx={{ color: SUCCESS }} />,
                    },
                    {
                      label: 'Neste steg',
                      value: nextStep.title,
                      icon: <TaskAltIcon sx={{ color: WARNING }} />,
                    },
                  ].map((item) => (
                    <Box key={item.label} sx={{ ...cardSx, p: 1.8 }}>
                      <Stack spacing={1.1}>
                        {item.icon}
                        <Typography sx={{ color: TEXT_MUTED, fontSize: '0.76rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: item.label === 'Neste steg' ? '1rem' : '1.34rem' }}>
                          {item.value}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Box>

                {(activeSection === 'overview' || activeSection === 'auditions') ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', xl: '1.15fr 0.85fr' },
                      gap: 1.6,
                    }}
                  >
                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.4 } }}>
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', md: 'center' }}
                          spacing={1.5}
                        >
                          <Box>
                            <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                              Audition Timeline
                            </Typography>
                            <Typography sx={{ fontSize: { xs: '1.4rem', md: '1.65rem' }, fontWeight: 800 }}>
                              Hold kontroll pa hvert steg
                            </Typography>
                          </Box>
                          <Chip
                            label={nextStep.title}
                            sx={{
                              color: ACCENT,
                              bgcolor: 'rgba(8, 47, 73, 0.44)',
                              border: `1px solid ${BORDER}`,
                            }}
                          />
                        </Stack>
                        <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.72 }}>
                          {nextStep.description}
                        </Typography>
                        <Divider sx={{ borderColor: BORDER }} />
                        <Stack spacing={1.2}>
                          {selectedAssignment.schedules.length === 0 ? (
                            <Alert severity="info" sx={{ bgcolor: 'rgba(8, 47, 73, 0.44)', color: TEXT_PRIMARY }}>
                              Ingen auditions eller callbacks er synlige ennå. Nar teamet legger deg inn, dukker de opp her.
                            </Alert>
                          ) : (
                            selectedAssignment.schedules.map((schedule) => {
                              const tone = getStatusTone(schedule.status);
                              const upcoming = isUpcomingSchedule(schedule);
                              const scheduleJoinUrl = extractFirstUrl(schedule.location, schedule.notes);
                              const scheduleCalendarHref = buildGoogleCalendarHref(schedule, selectedAssignment);
                              return (
                                <Box
                                  key={schedule.id}
                                  sx={{
                                    borderRadius: 3,
                                    border: `1px solid ${upcoming ? tone.border : BORDER}`,
                                    bgcolor: upcoming ? 'rgba(15, 23, 42, 0.9)' : SURFACE_ALT,
                                    p: 1.55,
                                  }}
                                >
                                  <Stack spacing={1}>
                                    <Stack
                                      direction={{ xs: 'column', sm: 'row' }}
                                      justifyContent="space-between"
                                      spacing={1}
                                    >
                                      <Box>
                                        <Typography sx={{ fontWeight: 700, fontSize: '1.04rem' }}>
                                          {schedule.roleName || 'Audition'}
                                        </Typography>
                                        <Typography sx={{ color: TEXT_SECONDARY }}>
                                          {formatDateLabel(schedule.date)} {schedule.startTime ? `• ${formatTimeLabel(schedule.startTime)}` : ''}
                                        </Typography>
                                      </Box>
                                      <Chip
                                        label={normalizeStatusLabel(schedule.status)}
                                        sx={{
                                          alignSelf: 'flex-start',
                                          color: tone.fg,
                                          bgcolor: tone.bg,
                                          border: `1px solid ${tone.border}`,
                                        }}
                                      />
                                    </Stack>
                                    <Typography sx={{ color: TEXT_MUTED, fontSize: '0.92rem' }}>
                                      {schedule.location || 'Lokasjon kommer'}{schedule.type ? ` • ${schedule.type}` : ''}
                                    </Typography>
                                    {schedule.notes ? (
                                      <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.65 }}>
                                        {schedule.notes}
                                      </Typography>
                                    ) : null}
                                    {(scheduleJoinUrl || scheduleCalendarHref) ? (
                                      <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={0.9}
                                        sx={{ pt: 0.4 }}
                                      >
                                        {scheduleJoinUrl ? (
                                          <Button
                                            component="a"
                                            href={scheduleJoinUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="contained"
                                            startIcon={<ArrowOutwardIcon />}
                                            sx={{
                                              width: { xs: '100%', sm: 'auto' },
                                              borderRadius: 999,
                                              textTransform: 'none',
                                              fontWeight: 800,
                                              background: 'linear-gradient(135deg, #7dd3fc, #38bdf8)',
                                              color: '#031522',
                                              '&:hover': {
                                                background: 'linear-gradient(135deg, #bae6fd, #0ea5e9)',
                                              },
                                            }}
                                          >
                                            Åpne møtelenke
                                          </Button>
                                        ) : null}
                                        {scheduleCalendarHref ? (
                                          <Button
                                            component="a"
                                            href={scheduleCalendarHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="outlined"
                                            startIcon={<CalendarMonthIcon />}
                                            sx={{
                                              width: { xs: '100%', sm: 'auto' },
                                              borderRadius: 999,
                                              textTransform: 'none',
                                              fontWeight: 700,
                                              color: '#dbeafe',
                                              borderColor: 'rgba(125, 211, 252, 0.28)',
                                            }}
                                          >
                                            Legg i kalender
                                          </Button>
                                        ) : null}
                                      </Stack>
                                    ) : null}
                                  </Stack>
                                </Box>
                              );
                            })
                          )}
                        </Stack>
                      </Stack>
                    </Box>

                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                      <Stack spacing={1.5}>
                        <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                          Siste oppdateringer
                        </Typography>
                        {activityItems.length === 0 ? (
                          <Alert severity="info" sx={{ bgcolor: 'rgba(8, 47, 73, 0.44)', color: TEXT_PRIMARY }}>
                            Aktivitet vises her nar invitasjoner, self tapes og meldinger begynner a flyte.
                          </Alert>
                        ) : (
                          activityItems.slice(0, 4).map((item) => {
                            const tone = getActivityTone(item.entryType);
                            return (
                              <Box
                                key={item.id}
                                sx={{
                                  borderRadius: 3,
                                  border: `1px solid ${tone.border}`,
                                  bgcolor: tone.bg,
                                  p: 1.35,
                                }}
                              >
                                <Stack spacing={0.6}>
                                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                                    <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                                    <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                                      {formatDateTimeLabel(item.createdAt)}
                                    </Typography>
                                  </Stack>
                                  {item.body ? (
                                    <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                                      {item.body}
                                    </Typography>
                                  ) : null}
                                  <Typography sx={{ color: tone.fg, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                                    {item.entryType.replace(/_/g, ' ')}
                                  </Typography>
                                </Stack>
                              </Box>
                            );
                          })
                        )}
                        <Button
                          variant="outlined"
                          onClick={() => setActiveSection('activity')}
                          sx={{
                            alignSelf: 'flex-start',
                            borderRadius: 999,
                            borderColor: BORDER,
                            color: TEXT_PRIMARY,
                          }}
                        >
                          Gaa til oppdateringer
                        </Button>
                      </Stack>
                    </Box>
                  </Box>
                ) : null}

                {(activeSection === 'overview' || activeSection === 'selftapes') ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', xl: '1.15fr 0.85fr' },
                      gap: 1.6,
                    }}
                  >
                    <Stack spacing={1.6}>
                      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                        <Stack spacing={2}>
                          <Box>
                            <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                              Secure Upload
                            </Typography>
                            <Typography sx={{ fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 800 }}>
                              Last opp self tape direkte
                            </Typography>
                          </Box>
                          <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.72 }}>
                            Fase 2 gir deg ekte videoopplasting til Role Room sitt sikre talentlager. Filen blir knyttet til kandidatprofilen din og logget i aktivitetsflyten.
                          </Typography>
                          <input
                            ref={fileInputRef}
                            hidden
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/mpeg,video/3gpp,video/x-msvideo,video/x-ms-wmv,.mp4,.mov,.webm,.m4v,.mpeg,.mpg,.3gp,.avi,.wmv"
                            onChange={handleFileSelection}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1}>
                            <Button
                              variant="contained"
                              onClick={() => fileInputRef.current?.click()}
                              startIcon={<UploadFileIcon />}
                              sx={{
                                alignSelf: 'flex-start',
                                borderRadius: 999,
                                px: 2.4,
                                bgcolor: ACCENT,
                                color: '#031522',
                                '&:hover': { bgcolor: '#bae6fd' },
                              }}
                            >
                              Velg videofil
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={handleUploadSelfTapeFile}
                              disabled={!selectedFile || uploadingSelfTapeFile}
                              startIcon={uploadingSelfTapeFile ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                              sx={{
                                alignSelf: 'flex-start',
                                borderRadius: 999,
                                borderColor: BORDER,
                                color: TEXT_PRIMARY,
                              }}
                            >
                              Last opp til portal
                            </Button>
                          </Stack>
                          {selectedFile ? (
                            <Box
                              sx={{
                                borderRadius: 3,
                                border: `1px solid ${BORDER}`,
                                bgcolor: SURFACE_ALT,
                                p: 1.5,
                              }}
                            >
                              <Stack spacing={0.6}>
                                <Typography sx={{ fontWeight: 700 }}>{selectedFile.name}</Typography>
                                <Typography sx={{ color: TEXT_SECONDARY }}>
                                  {formatBytes(selectedFile.size)} • {selectedFile.type || 'video'}
                                </Typography>
                              </Stack>
                            </Box>
                          ) : null}
                          <TextField
                            label="Tittel"
                            value={selfTapeDraft.title}
                            onChange={(event) => setSelfTapeDraft((current) => ({ ...current, title: event.target.value }))}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                          />
                          <TextField
                            label="Kort note"
                            value={selfTapeDraft.notes}
                            onChange={(event) => setSelfTapeDraft((current) => ({ ...current, notes: event.target.value }))}
                            fullWidth
                            multiline
                            rows={3}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                          />
                        </Stack>
                      </Box>

                      <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                        <Stack spacing={2}>
                          <Box>
                            <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                              Secure Link
                            </Typography>
                            <Typography sx={{ fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 800 }}>
                              Eller del en trygg videolenke
                            </Typography>
                          </Box>
                          <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.72 }}>
                            Hvis videoen ligger i Drive, Vimeo eller annen sikker hosting, kan du fortsatt sende inn lenken her.
                          </Typography>
                          <Stack spacing={1.2}>
                            <TextField
                              label="Videolenke"
                              value={selfTapeDraft.videoUrl}
                              onChange={(event) => setSelfTapeDraft((current) => ({ ...current, videoUrl: event.target.value }))}
                              fullWidth
                              InputLabelProps={{ shrink: true }}
                              sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                            />
                            <TextField
                              label="Thumbnail-lenke (valgfritt)"
                              value={selfTapeDraft.thumbnailUrl}
                              onChange={(event) => setSelfTapeDraft((current) => ({ ...current, thumbnailUrl: event.target.value }))}
                              fullWidth
                              InputLabelProps={{ shrink: true }}
                              sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                            />
                            <Button
                              variant="outlined"
                              onClick={handleSubmitSelfTapeLink}
                              disabled={submittingSelfTape}
                              startIcon={submittingSelfTape ? <CircularProgress size={16} /> : <SendIcon />}
                              sx={{
                                alignSelf: 'flex-start',
                                borderRadius: 999,
                                borderColor: BORDER,
                                color: TEXT_PRIMARY,
                              }}
                            >
                              Send sikker videolenke
                            </Button>
                          </Stack>
                        </Stack>
                      </Box>
                    </Stack>

                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                      <Stack spacing={1.4}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                            Dine videoer
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <LockOutlinedIcon sx={{ color: TEXT_MUTED, fontSize: 16 }} />
                            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem' }}>
                              Sikret per session
                            </Typography>
                          </Stack>
                        </Stack>
                        {selectedAssignment.candidate.videos.length === 0 ? (
                          <Alert severity="info" sx={{ bgcolor: 'rgba(8, 47, 73, 0.44)', color: TEXT_PRIMARY }}>
                            Ingen self tapes er sendt inn ennå.
                          </Alert>
                        ) : (
                          selectedAssignment.candidate.videos.map((video) => (
                            <Box
                              key={video.id}
                              sx={{
                                borderRadius: 3,
                                border: `1px solid ${BORDER}`,
                                bgcolor: SURFACE_ALT,
                                p: 1.45,
                              }}
                            >
                              <Stack spacing={0.7}>
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                  <Typography sx={{ fontWeight: 700 }}>{video.title}</Typography>
                                  <Chip
                                    size="small"
                                    label={video.source === 'talent_upload' ? 'Opplastet' : 'Link'}
                                    sx={{
                                      color: video.source === 'talent_upload' ? SUCCESS : ACCENT,
                                      bgcolor: video.source === 'talent_upload' ? 'rgba(6, 78, 59, 0.26)' : 'rgba(8, 47, 73, 0.44)',
                                      border: `1px solid ${BORDER}`,
                                    }}
                                  />
                                </Stack>
                                {video.notes ? (
                                  <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.65 }}>
                                    {video.notes}
                                  </Typography>
                                ) : null}
                                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                                  {video.submittedAt ? `Levert ${formatDateLabel(video.submittedAt.slice(0, 10))}` : 'Klar for review'}
                                  {video.sizeBytes ? ` • ${formatBytes(video.sizeBytes)}` : ''}
                                  {video.mimeType ? ` • ${video.mimeType}` : ''}
                                </Typography>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  {video.requiresAuth ? (
                                    <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem' }}>
                                      Aapnes via trygg session
                                    </Typography>
                                  ) : (
                                    <Link
                                      href={video.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      underline="none"
                                      sx={{
                                        color: TEXT_MUTED,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      Ekstern lenke
                                      <ArrowOutwardIcon sx={{ fontSize: 14 }} />
                                    </Link>
                                  )}
                                  <Button
                                    variant="text"
                                    onClick={() => void handleOpenMedia(video)}
                                    disabled={openingMediaId === video.id}
                                    endIcon={openingMediaId === video.id ? <CircularProgress size={14} /> : <ArrowOutwardIcon sx={{ fontSize: 16 }} />}
                                    sx={{ color: ACCENT, fontWeight: 700 }}
                                  >
                                    Apne video
                                  </Button>
                                </Stack>
                              </Stack>
                            </Box>
                          ))
                        )}
                      </Stack>
                    </Box>
                  </Box>
                ) : null}

                {(activeSection === 'overview' || activeSection === 'activity') ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', xl: '0.92fr 1.08fr' },
                      gap: 1.6,
                    }}
                  >
                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                      <Stack spacing={2}>
                        <Box>
                          <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                            Meldinger
                          </Typography>
                          <Typography sx={{ fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 800 }}>
                            Kontakt teamet uten friksjon
                          </Typography>
                        </Box>
                        <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.72 }}>
                          Sporsmal om audition, levering eller tilgjengelighet blir logget rett inn i kandidatens aktivitetshistorikk.
                        </Typography>
                        <TextField
                          label="Melding til teamet"
                          value={messageDraft}
                          onChange={(event) => setMessageDraft(event.target.value)}
                          fullWidth
                          multiline
                          minRows={5}
                          InputLabelProps={{ shrink: true }}
                          sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                        />
                        <Button
                          variant="contained"
                          onClick={handleSendMessage}
                          disabled={sendingMessage}
                          startIcon={sendingMessage ? <CircularProgress size={16} sx={{ color: '#031522' }} /> : <ForumIcon />}
                          sx={{
                            alignSelf: 'flex-start',
                            borderRadius: 999,
                            px: 2.4,
                            bgcolor: ACCENT,
                            color: '#031522',
                            '&:hover': { bgcolor: '#bae6fd' },
                          }}
                        >
                          Send melding
                        </Button>
                      </Stack>
                    </Box>

                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                      <Stack spacing={1.35}>
                        <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                          Statushistorikk
                        </Typography>
                        {activityItems.length === 0 ? (
                          <Alert severity="info" sx={{ bgcolor: 'rgba(8, 47, 73, 0.44)', color: TEXT_PRIMARY }}>
                            Ingen aktivitet er logget ennå.
                          </Alert>
                        ) : (
                          activityItems.map((item) => {
                            const tone = getActivityTone(item.entryType);
                            return (
                              <Box
                                key={item.id}
                                sx={{
                                  borderRadius: 3,
                                  border: `1px solid ${tone.border}`,
                                  bgcolor: SURFACE_ALT,
                                  p: 1.5,
                                }}
                              >
                                <Stack spacing={0.7}>
                                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                    <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                                    <Chip
                                      label={item.entryType.replace(/_/g, ' ')}
                                      size="small"
                                      sx={{
                                        alignSelf: 'flex-start',
                                        color: tone.fg,
                                        bgcolor: tone.bg,
                                        border: `1px solid ${tone.border}`,
                                        textTransform: 'uppercase',
                                      }}
                                    />
                                  </Stack>
                                  {item.body ? (
                                    <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
                                      {item.body}
                                    </Typography>
                                  ) : null}
                                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                                    {formatDateTimeLabel(item.createdAt)}
                                    {item.createdByRole ? ` • ${item.createdByRole}` : ''}
                                  </Typography>
                                </Stack>
                              </Box>
                            );
                          })
                        )}
                      </Stack>
                    </Box>
                  </Box>
                ) : null}

                {(activeSection === 'overview' || activeSection === 'profile') ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
                      gap: 1.6,
                    }}
                  >
                    <Box sx={{ ...cardSx, p: { xs: 2, md: 2.3 } }}>
                      <Stack spacing={2}>
                        <Box>
                          <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                            Profil
                          </Typography>
                          <Typography sx={{ fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 800 }}>
                            Hold infoen din produksjonsklar
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1.2,
                          }}
                        >
                          {[
                            { label: 'Telefon', key: 'phone' },
                            { label: 'Agentur', key: 'agency' },
                            { label: 'By', key: 'city' },
                            { label: 'Base', key: 'baseLocation' },
                            { label: 'Website', key: 'website' },
                            { label: 'Instagram', key: 'instagram' },
                            { label: 'Portfolio', key: 'portfolioUrl' },
                            { label: 'Showreel', key: 'showreelUrl' },
                          ].map((field) => (
                            <TextField
                              key={field.key}
                              label={field.label}
                              value={profileDraft[field.key as keyof ProfileDraft]}
                              onChange={(event) => setProfileDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                              fullWidth
                              InputLabelProps={{ shrink: true }}
                              sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                            />
                          ))}
                        </Box>
                        <TextField
                          label="Sprak"
                          value={profileDraft.languages}
                          onChange={(event) => setProfileDraft((current) => ({ ...current, languages: event.target.value }))}
                          fullWidth
                          helperText="Skill med komma. Eksempel: Norsk, English, Svenska"
                          InputLabelProps={{ shrink: true }}
                          sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                        />
                        <TextField
                          label="Kort bio"
                          value={profileDraft.bio}
                          onChange={(event) => setProfileDraft((current) => ({ ...current, bio: event.target.value }))}
                          fullWidth
                          multiline
                          rows={5}
                          InputLabelProps={{ shrink: true }}
                          sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                        />
                        <Divider sx={{ borderColor: BORDER }} />
                        <Typography sx={{ fontSize: '0.9rem', color: TEXT_SECONDARY, fontWeight: 700 }}>
                          Nodsituasjon
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1.2,
                          }}
                        >
                          <TextField
                            label="Navn"
                            value={profileDraft.emergencyContactName}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, emergencyContactName: event.target.value }))}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                          />
                          <TextField
                            label="Telefon"
                            value={profileDraft.emergencyContactPhone}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, emergencyContactPhone: event.target.value }))}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                          />
                          <TextField
                            label="Relasjon"
                            value={profileDraft.emergencyContactRelationship}
                            onChange={(event) => setProfileDraft((current) => ({ ...current, emergencyContactRelationship: event.target.value }))}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                          />
                        </Box>
                        <Divider sx={{ borderColor: BORDER }} />
                        <Typography sx={{ fontSize: '0.9rem', color: TEXT_SECONDARY, fontWeight: 700 }}>
                          Pamminnelser om audition
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: TEXT_MUTED, lineHeight: 1.6 }}>
                          Du far automatisk pamminnelse 24 timer og 1 time for audition. SMS sendes fra The Role Room. Du kan sla av kanaler du ikke onsker.
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                            gap: 0.6,
                          }}
                        >
                          <Tooltip title={profileDraft.phone.trim() ? '' : 'Legg til telefonnummer for a aktivere SMS'} placement="top" arrow>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={profileDraft.reminderPrefs.sms24h && Boolean(profileDraft.phone.trim())}
                                  disabled={!profileDraft.phone.trim()}
                                  onChange={(event) =>
                                    setProfileDraft((current) => ({
                                      ...current,
                                      reminderPrefs: { ...current.reminderPrefs, sms24h: event.target.checked },
                                    }))
                                  }
                                />
                              }
                              label="SMS 24 timer for"
                              sx={{ color: TEXT_SECONDARY }}
                            />
                          </Tooltip>
                          <Tooltip title={profileDraft.phone.trim() ? '' : 'Legg til telefonnummer for a aktivere SMS'} placement="top" arrow>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={profileDraft.reminderPrefs.sms1h && Boolean(profileDraft.phone.trim())}
                                  disabled={!profileDraft.phone.trim()}
                                  onChange={(event) =>
                                    setProfileDraft((current) => ({
                                      ...current,
                                      reminderPrefs: { ...current.reminderPrefs, sms1h: event.target.checked },
                                    }))
                                  }
                                />
                              }
                              label="SMS 1 time for"
                              sx={{ color: TEXT_SECONDARY }}
                            />
                          </Tooltip>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={profileDraft.reminderPrefs.email24h}
                                onChange={(event) =>
                                  setProfileDraft((current) => ({
                                    ...current,
                                    reminderPrefs: { ...current.reminderPrefs, email24h: event.target.checked },
                                  }))
                                }
                              />
                            }
                            label="E-post 24 timer for"
                            sx={{ color: TEXT_SECONDARY }}
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={profileDraft.reminderPrefs.email1h}
                                onChange={(event) =>
                                  setProfileDraft((current) => ({
                                    ...current,
                                    reminderPrefs: { ...current.reminderPrefs, email1h: event.target.checked },
                                  }))
                                }
                              />
                            }
                            label="E-post 1 time for"
                            sx={{ color: TEXT_SECONDARY }}
                          />
                        </Box>
                        <Button
                          variant="contained"
                          onClick={handleSaveProfile}
                          startIcon={savingProfile ? <CircularProgress size={16} sx={{ color: '#031522' }} /> : <CheckCircleOutlineIcon />}
                          disabled={savingProfile}
                          sx={{
                            alignSelf: 'flex-start',
                            borderRadius: 999,
                            px: 2.4,
                            bgcolor: ACCENT,
                            color: '#031522',
                            '&:hover': { bgcolor: '#bae6fd' },
                          }}
                        >
                          Lagre profil
                        </Button>
                      </Stack>
                    </Box>

                    <Stack spacing={1.6}>
                      <Box sx={{ ...cardSx, p: 2.2 }}>
                        <Stack spacing={1.2}>
                          <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                            Roller og status
                          </Typography>
                          {selectedAssignment.roles.length === 0 ? (
                            <Typography sx={{ color: TEXT_SECONDARY }}>
                              Teamet har ikke koblet deg til en spesifikk rolle ennå.
                            </Typography>
                          ) : (
                            selectedAssignment.roles.map((role) => (
                              <Box
                                key={role.id}
                                sx={{
                                  borderRadius: 3,
                                  border: `1px solid ${BORDER}`,
                                  bgcolor: SURFACE_ALT,
                                  p: 1.35,
                                }}
                              >
                                <Stack spacing={0.4}>
                                  <Typography sx={{ fontWeight: 700 }}>{role.name}</Typography>
                                  {role.description ? (
                                    <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.65 }}>
                                      {role.description}
                                    </Typography>
                                  ) : null}
                                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
                                    {normalizeStatusLabel(role.status)}
                                    {role.ageRange ? ` • ${role.ageRange}` : ''}
                                    {role.gender ? ` • ${role.gender}` : ''}
                                  </Typography>
                                </Stack>
                              </Box>
                            ))
                          )}
                        </Stack>
                      </Box>

                      <Box sx={{ ...cardSx, p: 2.2 }}>
                        <Stack spacing={1.3}>
                          <Typography sx={{ fontSize: '0.78rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: TEXT_MUTED }}>
                            Del erfaring
                          </Typography>
                          <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.72 }}>
                            Ekte feedback fra portalen kan godkjennes og brukes som sosial proof pa landingssiden.
                          </Typography>
                          <TextField
                            label="Kort testimonial"
                            value={feedbackDraft.quote}
                            onChange={(event) => setFeedbackDraft({ quote: event.target.value })}
                            fullWidth
                            multiline
                            minRows={4}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { color: TEXT_PRIMARY, borderRadius: 3 } }}
                          />
                          <Button
                            variant="outlined"
                            onClick={handleSubmitFeedback}
                            startIcon={submittingFeedback ? <CircularProgress size={16} /> : <SendIcon />}
                            disabled={submittingFeedback}
                            sx={{
                              alignSelf: 'flex-start',
                              borderRadius: 999,
                              px: 2.2,
                              borderColor: BORDER,
                              color: TEXT_PRIMARY,
                            }}
                          >
                            Send inn feedback
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
