// @ts-nocheck
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs as _useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter as _useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon as _getProfessionIcon } from '@/utils/profession-icons';
import { useDynamicProfessions as _useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
// Project Context integration
import { useProject } from '../../contexts/ProjectContext';
// Comprehensive feature system integration
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
// Resume/CV Integration
import { useProjectCompletionTrigger, addCompletedProjectToResumes as _addCompletedProjectToResumes } from '../../utils/resume-project-integration';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem as _MenuItem,
  Chip,
  Card,
  CardContent,
  IconButton,
  Stack,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as _RadioButtonUncheckedIcon,
  Flag as _FlagIcon,
  WorkOutline as _WorkOutline,
  MovieCreation as _MovieCreation,
  Notifications,
  NotificationsActive,
  AccountBalance as SplitSheetIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

interface TimelineEvent {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  eventDate: string;
  eventTime?: string;
  location?: string;
  type: string;
  status: string;
  priority: string;
  notes?: string;
  notificationSent?: boolean;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const eventTypes = [
  { value: 'pre_planning', label: 'Pre-planning', color: '#9e9e9e' },
  { value: 'pre_production', label: 'Pre-production', color: '#2196f3' },
  { value: 'production', label: 'Production', color: '#ff9800' },
  { value: 'post_production', label: 'Post-production', color: '#4caf50' },
  { value: 'meeting', label: 'Møte', color: '#1976d2' },
  { value: 'milestone', label: 'Milepæl', color: '#9c27b0' },
  { value: 'deadline', label: 'Frist', color: '#f44336' },
  { value: 'delivery', label: 'Levering', color: '#ff9800' },
  { value: 'ceremony', label: 'Seremoni', color: '#e91e63' },
  { value: 'photo_session', label: 'Fotografering', color: '#4caf50' },
  { value: 'editing', label: 'Redigering', color: '#795548' },
  { value: 'review', label: 'Gjennomgang', color: '#607d8b' },
  { value: 'contract', label: 'Kontrakt', color: '#00695c' },
  { value: 'split_sheet_created', label: 'Split Sheet Opprettet', color: '#9f7aea' },
  { value: 'split_sheet_signed', label: 'Split Sheet Signert', color: '#ff9800' },
  { value: 'split_sheet_completed', label: 'Split Sheet Fullført', color: '#4caf50' },
];

const statusOptions = [
  { value: 'planned', label: 'Planlagt', color: '#2196f3' },
  { value: 'in_progress', label: 'Pågående', color: '#ff9800' },
  { value: 'completed', label: 'Fullført', color: '#4caf50' },
  { value: 'cancelled', label: 'Avbrutt', color: '#f44336' },
];

const priorityOptions = [
  { value: 'low', label: 'Lav', color: '#4caf50' },
  { value: 'medium', label: 'Middels', color: '#ff9800' },
  { value: 'high', label: 'Høy', color: '#f44336' },
  { value: 'critical', label: 'Kritisk', color: '#9c27b0' },
];

interface ProjectTimelineProps {
  projectId: string;
  onMeetingCreate?: (meeting: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectUpdate?: (project: any) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

// Slice 9X.5 — package + client-status snapshot card. Pulls from
// existing endpoints (no new backend) so deploys are decoupled:
//   - /api/photographer/galleries  → all this user's galleries; we
//     filter to those linked to projectId via gallery_settings.projectId
//   - /api/pricing/packages?userId  → photographer's packages with
//     inclusions.images / inclusions.hours
// Renders nothing when neither package nor gallery exists, so silent
// for projects that haven't been wired up.
function ProjectStatusCard({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}) {
  const { data: galleries } = useQuery<{ galleries: Array<{
    id: string;
    projectId?: string | null;
    status: string;
    completedAt?: string | null;
    shareUrl: string;
    clientName: string;
    clientEmail: string;
    imageCount: number;
    selectionCount: number;
    paidCount: number;
    packageId?: string | null;
    linkedPackageName?: string | null;
    linkedPackageImagesIncluded?: number | null;
  }> }>({
    queryKey: ['/api/photographer/galleries'],
    queryFn: () => apiRequest('/api/photographer/galleries'),
    refetchInterval: 30_000,
  });
  const linkedGalleries = (galleries?.galleries ?? []).filter(
    (g) => g.projectId === projectId,
  );
  const primary = linkedGalleries[0];

  const { data: packages } = useQuery<Array<{
    id: string | number;
    name?: string;
    package_name?: string;
    inclusions?: { images?: number; hours?: number };
    basePrice?: number;
  }>>({
    queryKey: ['/api/pricing/packages', userId, 'project-status-card'],
    enabled: Boolean(userId),
    queryFn: () =>
      apiRequest(`/api/pricing/packages?userId=${encodeURIComponent(userId)}`).then(
        (r: unknown) => (Array.isArray(r) ? r : []) as never[],
      ),
  });

  if (linkedGalleries.length === 0) return null;

  // Status label for the photographer at a glance.
  let statusLabel = 'Aktiv';
  let statusColor: 'default' | 'success' | 'warning' | 'info' = 'info';
  if (primary?.completedAt || primary?.status === 'completed') {
    statusLabel = `Levert ${primary.completedAt ? new Date(primary.completedAt).toLocaleDateString('nb-NO') : ''}`.trim();
    statusColor = 'success';
  } else if (primary?.paidCount && primary.paidCount > 0) {
    statusLabel = 'Betalt — venter levering';
    statusColor = 'warning';
  } else if (primary?.selectionCount && primary.selectionCount > 0) {
    statusLabel = `${primary.selectionCount} valg gjort`;
    statusColor = 'info';
  }

  const pkgFromGallery = primary?.linkedPackageName
    ? {
        name: primary.linkedPackageName,
        images: primary.linkedPackageImagesIncluded,
      }
    : null;
  const pkgFallback = primary?.packageId
    ? (packages ?? []).find((p) => String(p.id) === String(primary.packageId))
    : null;
  const pkg =
    pkgFromGallery ??
    (pkgFallback
      ? {
          name: pkgFallback.package_name || pkgFallback.name || 'Pakke',
          images: pkgFallback.inclusions?.images ?? null,
        }
      : null);

  return (
    <Paper sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1 }}>
          Klient-status
        </Typography>
        <Chip size="small" color={statusColor} label={statusLabel} />
        {pkg && (
          <Chip
            size="small"
            variant="outlined"
            label={pkg.images ? `${pkg.name} · ${pkg.images} bilder` : pkg.name}
          />
        )}
        {primary && (
          <Chip
            size="small"
            variant="outlined"
            label={`${primary.imageCount} bilder · ${primary.selectionCount} valgt`}
            onClick={() => window.open(primary.shareUrl, '_blank')}
          />
        )}
        {linkedGalleries.length > 1 && (
          <Chip
            size="small"
            variant="outlined"
            label={`+${linkedGalleries.length - 1} galleri til`}
          />
        )}
      </Stack>
    </Paper>
  );
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
  projectId,
  onMeetingCreate,
  onWorklogCreate,
  selectedProject,
  profession,
}) => {
  const _theme = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = user?.id;
  const { pushEnabled, isSupported } = usePushNotifications(userId, projectId);

  const {
    addProjectMilestone,
    getProjectTimeline,
    updateProjectStatus: _updateProjectStatus,
    addProjectComment: _addProjectComment,
    getProjectComments,
    getProjectFiles,
    getProjectIntegrations,
    getProjectPermissions,
    getProjectCollaborators,
    validateProjectCompliance,
    getProjectAuditTrail,
    checkProjectHealth,
    getProjectAnalytics,
    optimizeProjectData: _optimizeProjectData,
    analyzeProjectData: _analyzeProjectData,
  } = useProject() || {};

  const { features, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  const theming = useTheming('photographer');
  const { handleProjectCompleted } = useProjectCompletionTrigger();
  const normalizedProjectId = String(projectId || '').trim();
  const hasRealProjectId =
    Boolean(normalizedProjectId) &&
    !['guest', 'current-user', 'current_user', 'anonymous'].includes(normalizedProjectId) &&
    !normalizedProjectId.startsWith('dev-session-');

  // Query for timeline events - must be before useEffect to avoid hoisting issues
  const { data: timelineEvents = [], isLoading } = useQuery({
    queryKey: ['timeline-events', projectId],
    queryFn: () => getProjectTimeline?.(projectId),
    enabled: hasRealProjectId && !!getProjectTimeline,
  });

  const events = timelineEvents;

  // Register component with integration system
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'project-timeline',
      name: 'Project Timeline',
      type: 'project',
      category: 'project',
      capabilities: ['timeline-management', 'event-tracking', 'milestone-management'],
      dataKeys: ['timeline-events', 'project-status'],
      dependencies: [],
      props: [],
      events: []
    });

    communication.registerComponent('project-timeline', 'project', ['timeline-management', 'event-tracking']);

    // DataFlow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'project-timeline',
      dataKey: `timeline-events-${projectId}`,
      transform: (data) => data
    });

    // Listen for timeline update requests
    const unsubscribe = communication.onMessageType('timeline:add-event', (message: any) => {
      if (message.data?.projectId === projectId) {
        setDialogOpen(true);
        if (message.data?.eventType) {
          setFormData((prev: any) => ({ ...prev, type: message.data.eventType }));
        }
      }
    });

    return () => {
      componentRegistry.unregisterComponent('project-timeline');
      dataFlow.unregisterNode(`timeline-events-${projectId}`);
      unsubscribe?.();
    };
  }, [projectId, events, componentRegistry, communication, dataFlow]);

  const { data: _eventsQuery = [] } = useQuery({
    queryKey: [`project-timeline-${projectId}`],
    enabled: hasRealProjectId && !!getProjectTimeline,
    queryFn: async () => await getProjectTimeline?.(projectId),
  });

  // Detect profession from selectedProject or prop
  const detectedProfession = profession || selectedProject?.profession || selectedProject?.type || 'photographer';
  const isMusicProducer = detectedProfession === 'music_producer';

  // Fetch split sheets for music producer projects
  const { data: splitSheetsData } = useQuery({
    queryKey: ['split-sheets-timeline', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/split-sheets?project_id=${projectId}`);
      return response;
    },
    enabled: hasRealProjectId && isMusicProducer,
  });

  const splitSheets = splitSheetsData?.data || [];

  // Convert split sheets to timeline events
  const splitSheetEvents = useMemo(() => {
    if (!splitSheets || splitSheets.length === 0) return [];

    const events: any[] = [];

    splitSheets.forEach((sheet: any) => {
      // Event: Split sheet created
      if (sheet.created_at) {
        events.push({
          id: `split-sheet-created-${sheet.id}`,
          projectId: projectId,
          title: `Split Sheet Opprettet: ${sheet.title}`,
          description: `Split sheet "${sheet.title}" ble opprettet`,
          eventDate: sheet.created_at,
          type: 'split_sheet_created',
          status: 'completed',
          priority: 'medium',
          metadata: {
            splitSheetId: sheet.id,
            splitSheetTitle: sheet.title,
            contributorCount: sheet.contributor_count || 0,
          },
        });
      }

      // Event: First signature (if any contributors signed)
      // Note: We'll fetch contributors separately if needed, or rely on signed_count
      if (sheet.signed_count > 0) {
        // Try to get earliest signature date from contributors if available
        let earliestSignature: string | null = null;
        if (sheet.contributors && Array.isArray(sheet.contributors)) {
          const signedContributors = sheet.contributors.filter((c: any) => c.signed_at);
          if (signedContributors.length > 0) {
            earliestSignature = signedContributors
              .map((c: any) => c.signed_at)
              .sort()[0];
          }
        }
        
        // If we have signed_count but no specific date, use updated_at as fallback
        const signatureDate = earliestSignature || sheet.updated_at || sheet.created_at;
        
        events.push({
          id: `split-sheet-signed-${sheet.id}`,
          projectId: projectId,
          title: `Split Sheet Signert: ${sheet.title}`,
          description: `${sheet.signed_count} av ${sheet.contributor_count || 0} bidragsytere har signert`,
          eventDate: signatureDate,
          type: 'split_sheet_signed',
          status: sheet.status === 'completed' ? 'completed' : 'in_progress',
          priority: 'high',
          metadata: {
            splitSheetId: sheet.id,
            splitSheetTitle: sheet.title,
            signedCount: sheet.signed_count,
            totalCount: sheet.contributor_count,
          },
        });
      }

      // Event: All signatures completed
      if (sheet.status === 'completed' && sheet.completed_at) {
        events.push({
          id: `split-sheet-completed-${sheet.id}`,
          projectId: projectId,
          title: `Split Sheet Fullført: ${sheet.title}`,
          description: `Alle ${sheet.contributor_count} bidragsytere har signert split sheet`,
          eventDate: sheet.completed_at,
          type: 'split_sheet_completed',
          status: 'completed',
          priority: 'high',
          metadata: {
            splitSheetId: sheet.id,
            splitSheetTitle: sheet.title,
            contributorCount: sheet.contributor_count,
          },
        });
      }
    });

    return events;
  }, [splitSheets, projectId]);

  // Contract status (read-only)
  const { data: contractSummary } = useQuery({
    queryKey: ['project-contract-summary', projectId],
    enabled: hasRealProjectId,
    retry: false,
    queryFn: async () => {
      try {
        return await apiRequest(`/api/contracts/summary?projectId=${projectId}`);
      } catch {
        try {
          return await apiRequest(`/api/projects/${projectId}/contract/status`);
        } catch {
          return null as any;
        }
      }
    },
  });

  useEffect(() => {
    features.trackFeatureUsage('project-timeline', 'component_opened', {
      projectId,
      eventCount: events?.length || 0,
      timestamp: new Date().toISOString(),
    });
  }, [features, projectId, events?.length]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    eventTime: '',
    location: '',
    type: 'meeting',
    status: 'planned',
    priority: 'medium',
    notes: '',
  });

  // Enhanced Project Context state
  const [projectHealth, setProjectHealth] = useState<any>(null);
  const [projectAnalytics, setProjectAnalytics] = useState<any>(null);
  const [projectCollaborators, setProjectCollaborators] = useState<any[]>([]);
  const [projectComments, setProjectComments] = useState<any[]>([]);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [projectIntegrations, setProjectIntegrations] = useState<any[]>([]);
  const [_projectPermissions, _setProjectPermissions] = useState<any>(null);
  const [projectCompliance, setProjectCompliance] = useState<any>(null);
  const [_projectAuditTrail, setProjectAuditTrail] = useState<any[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  // Signed contract dialog state
  const [signersOpen, setSignersOpen] = useState(false);
  const [signersLoading, setSignersLoading] = useState(false);
  const [signersError, setSignersError] = useState<string | null>(null);
  const [signers, setSigners] = useState<Array<{ name?: string; email?: string; signedDate?: string }>>([]);

  // Reminder dialog state (pending signature)
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState<string | null>(null);
  const [reminderSubject, setReminderSubject] = useState('Påminnelse: Vennligst signer kontrakten');
  const [reminderMessage, setReminderMessage] = useState('Hei! Dette er en vennlig påminnelse om å signere kontrakten for prosjektet. Gi beskjed om du har spørsmål.');
  const [reminderScheduleAt, setReminderScheduleAt] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) =>
      await addProjectMilestone(projectId, {
        title: eventData.title,
        description: eventData.description,
        dueDate: eventData.eventDate,
        status: eventData.status,
        priority: eventData.priority,
        type: eventData.type,
        metadata: {
          location: eventData.location,
          notes: eventData.notes,
          notificationSent: !!eventData.notificationSent,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`project-timeline-${projectId}`] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, eventData }: { eventId: string; eventData: any }) => {
      const response = await fetch(`/api/projects/${projectId}/timeline/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error('Failed to update timeline event');
      return response.json();
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`project-timeline-${projectId}`] });
      setDialogOpen(false);
      setEditingEvent(null);
      resetForm();

      if (variables.eventData.status === 'completed' && selectedProject) {
        try {
          await handleProjectCompleted({
            projectId,
            projectTitle: selectedProject.title || selectedProject.name || 'Untitled Project',
            clientName: selectedProject.clientName || 'Client',
            projectType: selectedProject.projectType || 'general',
            description: selectedProject.description || variables.eventData.description,
            location: selectedProject.location || variables.eventData.location,
            startDate: selectedProject.createdAt || selectedProject.eventDate,
            endDate: variables.eventData.eventDate,
            completedAt: new Date().toISOString(),
            userId: user?.id || '',
          });
        } catch (e) {
          console.warn('Auto CV/resume update failed: ', e);
        }
      }
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/projects/${projectId}/timeline/${eventId}`, {
        method: 'DELETE',
        headers: { 'Content-Type' : 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to delete timeline event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`project-timeline-${projectId}`] });
    },
  });

  const _createMeetingMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const meetingPayload = {
        title: eventData.title,
        description: eventData.description,
        date: eventData.eventDate,
        time: eventData.eventTime,
        duration: 60,
        type: 'client_meeting',
        projectId,
        projectName: selectedProject?.title || selectedProject?.name,
        clientName: selectedProject?.clientName,
        location: eventData.location,
        notes: eventData.notes,
        profession: 'photographer',
      };
      const response = await apiRequest('/api/google-meet/create', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(meetingPayload),
      });
      return { meeting: response, event: eventData };
    },
    onSuccess: (data) => {
      createEventMutation.mutate({
        ...data.event,
        type: 'meeting',
        status: 'planned',
        notes: `Google Meet, link: ${data.meeting?.meetLink || 'TBA'}`,
      });
      onMeetingCreate?.(data.meeting);
    },
  });

  const _createWorklogMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const worklogData = {
        projectId,
        userId: user?.id || user?.email || 'unknown-user',
        day: 1,
        title: eventData.title,
        description: eventData.description,
        timeSpent: 60,
        category: eventData.type === 'meeting' ? 'client_meeting' : 'planning',
        mood: 'productive',
        nextSteps: eventData.notes,
        isPrivate: false,
        projectName: selectedProject?.title || selectedProject?.name,
        projectType: selectedProject?.projectType || 'general',
        profession: 'photographer',
        clientName: selectedProject?.clientName,
        eventDate: selectedProject?.eventDate,
        location: selectedProject?.location,
      };
      const response = await apiRequest(`/api/projects/${projectId}/worklog`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(worklogData),
      });
      return { worklog: response, event: eventData };
    },
    onSuccess: (data) => {
      onWorklogCreate?.(data.worklog);
    },
  });

  // Load project context data - useCallback and useEffect must be before any early returns
  const loadProjectContextData = useCallback(async () => {
    if (!hasRealProjectId) {
      setProjectHealth(null);
      setProjectAnalytics(null);
      setProjectCollaborators([]);
      setProjectComments([]);
      setProjectFiles([]);
      setProjectIntegrations([]);
      _setProjectPermissions(null);
      setProjectCompliance(null);
      setProjectAuditTrail([]);
      setContextError(null);
      return;
    }

    try {
      setContextLoading(true);
      setContextError(null);

      const [health, analytics, collaborators, comments, files, integrations, permissions, compliance, auditTrail] = await Promise.all([
        checkProjectHealth?.(projectId).catch(() => null),
        getProjectAnalytics?.(projectId).catch(() => null),
        getProjectCollaborators?.(projectId).catch(() => []),
        getProjectComments?.(projectId).catch(() => []),
        getProjectFiles?.(projectId).catch(() => []),
        getProjectIntegrations?.(projectId).catch(() => []),
        getProjectPermissions?.(projectId).catch(() => null),
        validateProjectCompliance?.(projectId, []).catch(() => null),
        getProjectAuditTrail?.(projectId).catch(() => []),
      ]);

      setProjectHealth(health);
      setProjectAnalytics(analytics);
      setProjectCollaborators(collaborators || []);
      setProjectComments(comments || []);
      setProjectFiles(files || []);
      setProjectIntegrations(integrations || []);
      _setProjectPermissions(permissions);
      setProjectCompliance(compliance);
      setProjectAuditTrail(auditTrail || []);
    } catch (error: any) {
      console.warn('Project context load error:', error);
      setContextError(error?.message || 'Kunne ikke laste kontekst');
    } finally {
      setContextLoading(false);
    }
  }, [projectId, hasRealProjectId, checkProjectHealth, getProjectAnalytics, getProjectCollaborators, getProjectComments, getProjectFiles, getProjectIntegrations, getProjectPermissions, validateProjectCompliance, getProjectAuditTrail]);

  // Load project context data when projectId changes
  useEffect(() => {
    if (hasRealProjectId) {
      loadProjectContextData();
    }
  }, [hasRealProjectId, loadProjectContextData]);

  // Combine regular events with split sheet events - must be before early returns
  const allEvents = useMemo(() => {
    // Safely extract events array from various API response formats
    const eventsArray = Array.isArray(events) 
      ? events 
      : (events as any)?.data || (events as any)?.events || (events as any)?.timeline || [];
    const splitSheetArray = Array.isArray(splitSheetEvents) ? splitSheetEvents : [];
    return [...eventsArray, ...splitSheetArray];
  }, [events, splitSheetEvents]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      eventDate: '',
      eventTime: '',
      location: ', ',
      type: 'meeting',
      status: 'planned',
      priority: 'medium',
      notes: ', ',
    });
  };

  const handleOpenDialog = (event?: TimelineEvent) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || ', ',
        eventDate: event.eventDate,
        eventTime: event.eventTime || ', ',
        location: event.location || ', ',
        type: event.type,
        status: event.status,
        priority: event.priority,
        notes: event.notes || ', ',
      });
    } else {
      resetForm();
      setEditingEvent(null);
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    features.trackFeatureUsage('project-timeline', editingEvent ? 'event_update' : 'event_create', {
      projectId,
      eventType: formData.type,
      eventTitle: formData.title,
      isEditing: !!editingEvent,
      timestamp: new Date().toISOString(),
    });

    if (editingEvent) {
      updateEventMutation.mutate({ eventId: editingEvent.id, eventData: formData });
    } else {
      createEventMutation.mutate(formData);
    }
  };

  const handleDelete = (eventId: string) => {
    setConfirmDeleteId(eventId);
  };

  const executeDelete = () => {
    if (!confirmDeleteId) return;
    features.trackFeatureUsage('project-timeline','event_delete', {
      projectId,
      eventId: confirmDeleteId,
      timestamp: new Date().toISOString(),
    });
    deleteEventMutation.mutate(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const getEventTypeInfo = (value: string) => eventTypes.find((t) => t.value === value) || eventTypes[0];
  const getStatusInfo = (value: string) => statusOptions.find((s) => s.value === value) || statusOptions[0];
  const getPriorityInfo = (value: string) => priorityOptions.find((p) => p.value === value) || priorityOptions[1];

  // DaVinci Resolve integration
  const davinciIntegrationAccess = features.checkFeatureAccess('davinci-resolve-integration');
  const _openDavinciScriptManager = (event: TimelineEvent) => {
    if (!davinciIntegrationAccess.hasAccess) return;
    features.trackFeatureUsage('davinci-resolve-integration','timeline_event_triggered', {
      projectId,
      eventId: event.id,
      eventType: event.type,
      timestamp: new Date().toISOString(),
    });
    // Hook to open script manager could be added here
    console.log('Opening DaVinci Resolve Script Manager for', event.title);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Laster tidslinje...</Typography>
      </Box>
    );
  }

  const timelineAccess = features.checkFeatureAccess('project-timeline');
  if (!timelineAccess.hasAccess) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom sx={{ color: theming.colors.primary }}>
          Timeline-funksjonen er ikke tilgjengelig
        </Typography>
        <Typography variant="body2" color="text.secondary">{timelineAccess.reason}</Typography>
      </Box>
    );
  }

  const openSignersDialog = async () => {
    setSignersOpen(true);
    setSignersLoading(true);
    setSignersError(null);
    try {
      const cid = (contractSummary as any)?.contractId;
      let data: any = null;
      try {
        data = await apiRequest(`/api/contracts/signers?projectId=${projectId}`);
      } catch (e1) {
        if (cid) {
          data = await apiRequest(`/api/contracts/${cid}/signers`);
        } else {
          throw e1 as any;
        }
      }
      const list = Array.isArray(data) ? data : (data?.signers || []);
      setSigners(list);
    } catch (err: any) {
      setSignersError(err?.message || 'Kunne ikke hente signaturer');
    } finally {
      setSignersLoading(false);
    }
  };

  const openReminderDialog = () => {
    setReminderOpen(true);
    setReminderError(null);
    setReminderSuccess(null);
    // Optionally prefill from contractSummary
    try {
      const cname = (contractSummary as any)?.clientName || selectedProject?.clientName || ', ';
      if (cname) {
        setReminderMessage(`Hei ${cname}! Dette er en vennlig påminnelse om å signere kontrakten. Ta kontakt hvis noe er uklart.`);
      }
    } catch (_e) {
      // Empty catch block - error handling not needed
    }
  };

  const sendReminder = async () => {
    setReminderLoading(true);
    setReminderError(null);
    setReminderSuccess(null);
    try {
      // Route through UniversalChatWidget: prefill message and open widget
      const prefill = `${reminderSubject}\n\n${reminderMessage}`;
      try {
        communication?.sendMessage?.({
          from: 'project-timeline',
          to: 'universal-chat-widget',
          type: 'chat:prefill',
          priority: 'medium',
          data: { message: prefill, selectConversationId: null, projectId }
        });
      } catch (_e) {
        // Empty catch block - error handling not needed
      }
      setReminderSuccess('Påminnelse er gjort klar i chatten.');
    } catch (err: any) {
      setReminderError(err?.message || 'Kunne ikke starte påminnelse');
    } finally {
      setReminderLoading(false);
    }
  };

  const renderProjectContextPanel = () => {
    if (contextLoading) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Laster prosjektkontekst...
          </Typography>
        </Box>
      );
    }

    if (contextError) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="error">
            Feil ved lasting av kontekst: {contextError}
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2 }}>
        {projectHealth && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: projectHealth.status === 'healthy' ? 'success.light' : 'warning.light' }}>
            <Typography variant="subtitle2" gutterBottom>
              Prosjekthelse: {projectHealth.status}
            </Typography>
            {projectHealth.issues?.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Problemer: {projectHealth.issues.join(', ')}
              </Typography>
            )}
          </Paper>
        )}

        {projectAnalytics && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Analyse
            </Typography>
            <Typography variant="body2" color="text.secondary">Totalt: {projectAnalytics.totalEvents || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Fullført: {projectAnalytics.completedEvents || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Fremdrift: {projectAnalytics.progress || 0}%</Typography>
          </Paper>
        )}

        {projectCollaborators.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Samarbeidspartnere ({projectCollaborators.length})
            </Typography>
            {projectCollaborators.slice(0, 3).map((collab, idx) => (
              <Typography key={idx} variant="body2" color="text.secondary">
                {collab.name || collab.email}
              </Typography>
            ))}
          </Paper>
        )}

        {projectComments.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Siste kommentarer ({projectComments.length})
            </Typography>
            {projectComments.slice(0, 2).map((comment: any, idx: number) => (
              <Typography key={idx} variant="body2" color="text.secondary">
                {comment.content?.substring(0, 80)}...
              </Typography>
            ))}
          </Paper>
        )}

        {projectFiles.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filer ({projectFiles.length})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total størrelse: {projectFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0)} bytes
            </Typography>
          </Paper>
        )}

        {projectIntegrations.length > 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Active Integrations ({projectIntegrations.length})
            </Typography>
            {projectIntegrations.map((integration, index) => (
              <Typography key={index} variant="body2" color="text.secondary">
                {integration.type}: {integration.status}
              </Typography>
            ))}
          </Paper>
        )}

        {/* Split Sheets Panel - Only for Music Producers */}
        {isMusicProducer && splitSheets.length > 0 && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: alpha('#9f7aea', 0.1), border: '1px solid', borderColor: alpha('#9f7aea', 0.3) }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#9f7aea' }}>
                Split Sheets ({splitSheets.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  // Navigate to split sheets tab or open split sheet manager
                  if (communication) {
                    communication.sendMessage({
                      from: 'project-timeline',
                      to: 'universal-dashboard',
                      type: 'navigate:split-sheets',
                      data: { projectId },
                      priority: 'medium'
                    });
                  }
                }}
                sx={{ 
                  color: '#9f7aea', 
                  borderColor: alpha('#9f7aea', 0.3),
                  fontSize: '0.7rem',
                  py: 0.5,
                  px: 1
                }}
              >
                Se alle
              </Button>
            </Box>
            {splitSheets.slice(0, 3).map((splitSheet: any) => (
              <Box key={splitSheet.id} sx={{ mb: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {splitSheet.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={splitSheet.status === 'completed' ? 'Fullført' : 
                           splitSheet.status === 'pending_signatures' ? 'Venter signaturer' : 
                           'Utkast'}
                    size="small"
                    sx={{
                      bgcolor: splitSheet.status === 'completed' ? '#4caf50' : 
                               splitSheet.status === 'pending_signatures' ? '#ff9800' : '#9e9e9e',
                      color: 'white',
                      fontSize: '0.65rem',
                      height: 20
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {splitSheet.signed_count || 0}/{splitSheet.contributor_count || 0} signert
                  </Typography>
                </Box>
              </Box>
            ))}
            {splitSheets.length > 3 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                +{splitSheets.length - 3} flere split sheets
              </Typography>
            )}
          </Paper>
        )}

        {projectCompliance && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: projectCompliance.compliant ? 'success.light' : 'warning.light' }}>
            <Typography variant="subtitle2" gutterBottom>
              Samsvar: {projectCompliance.compliant ? 'OK' : 'Problemer funnet'}
            </Typography>
            {projectCompliance.violations && projectCompliance.violations.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Brudd: {projectCompliance.violations.length}
              </Typography>
            )}
          </Paper>
        )}
      </Box>
    );
  };

  // Normalize events to handle different field name formats
  const normalizedEvents = allEvents.map((event: any) => ({
    id: event.id,
    projectId: event.projectId || event.project_id,
    title: event.title || event.name || 'Untitled Event',
    description: event.description,
    eventDate: event.eventDate || event.event_date || event.createdAt || event.created_at,
    eventTime: event.eventTime || event.event_time,
    location: event.location,
    type: event.type || event.eventType || 'meeting',
    status: event.status || 'planned',
    priority: event.priority || 'medium',
    notes: event.notes,
    notificationSent: event.notificationSent || event.notification_sent,
    completedAt: event.completedAt || event.completed_at,
    createdAt: event.createdAt || event.created_at,
    updatedAt: event.updatedAt || event.updated_at,
    // Preserve metadata for split sheet events
    metadata: event.metadata || (event.metadata_field ? JSON.parse(event.metadata_field) : null),
  }));

  // Sort events by date (most recent first)
  const sortedEvents = [...normalizedEvents].sort((a, b) => {
    const dateA = new Date(a.eventDate || a.createdAt || 0).getTime();
    const dateB = new Date(b.eventDate || b.createdAt || 0).getTime();
    return dateB - dateA; // Most recent first
  });

  return (
    <Box sx={{ p: 2 }}>
      {/* Slice 9X.5 — pakke + klient-status-kort. Surfacer linkages
          mellom dette prosjektet, valgt pris-pakke (inkluderte
          bilder/timer) og evt. levert klient-galleri (status, antall
          valg, betaling). Lar fotografen umiddelbart se hvor klienten
          er i flyten uten å hoppe mellom faner. */}
      <ProjectStatusCard projectId={projectId} userId={userId} />

      {/* Timeline Events Display */}
      <Paper sx={{ mb: 3, p: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon /> Prosjekttidslinje
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Split Sheet Actions for Music Producers */}
            {isMusicProducer && (
              <Button
                variant="outlined"
                startIcon={<SplitSheetIcon />}
                onClick={() => {
                  // Navigate to split sheets or open create dialog
                  if (communication) {
                    communication.sendMessage({
                      from: 'project-timeline',
                      to: 'universal-dashboard',
                      type: 'navigate:split-sheets',
                      data: { projectId, action: 'create' },
                      priority: 'medium'
                    });
                  }
                }}
                sx={{ 
                  color: '#9f7aea', 
                  borderColor: alpha('#9f7aea', 0.3),
                  '&:hover': {
                    borderColor: '#9f7aea',
                    bgcolor: alpha('#9f7aea', 0.1)
                  }
                }}
              >
                Opprett Split Sheet
              </Button>
            )}
            {isSupported && (
              <Button
                variant="outlined"
                startIcon={pushEnabled ? <NotificationsActive /> : <Notifications />}
                onClick={() => setPushSettingsOpen(true)}
                color={pushEnabled ? 'primary' : 'inherit'}
              >
                Push-varsler
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Legg til hendelse
            </Button>
          </Box>
        </Box>

        {sortedEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Ingen hendelser i tidslinjen ennå
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ mt: 2 }}
            >
              Legg til første hendelse
            </Button>
          </Box>
        ) : (
          <Timeline>
            {sortedEvents.map((event, index) => {
              const eventTypeInfo = getEventTypeInfo(event.type);
              const statusInfo = getStatusInfo(event.status);
              const priorityInfo = getPriorityInfo(event.priority);
              const eventDate = event.eventDate ? new Date(event.eventDate) : null;
              const isCompleted = event.status === 'completed' || event.completedAt;

              return (
                <TimelineItem key={event.id || index}>
                  <TimelineSeparator>
                    <TimelineDot
                      sx={{
                        bgcolor: isCompleted ? statusInfo.color : eventTypeInfo.color,
                        border: `2px solid ${alpha(eventTypeInfo.color, 0.3)}`}}
                    >
                      {event.type?.startsWith('split_sheet') ? (
                        <SplitSheetIcon sx={{ fontSize: 20, color: 'white' }} />
                      ) : isCompleted ? (
                        <CheckCircleIcon sx={{ fontSize: 20, color: 'white' }} />
                      ) : (
                        <EventIcon sx={{ fontSize: 20, color: 'white' }} />
                      )}
                    </TimelineDot>
                    {index < sortedEvents.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Card
                      sx={{
                        mb: 2,
                        border: '1px solid',
                        borderColor: 'divider', '&:hover': {
                          boxShadow: 2,
                          borderColor: eventTypeInfo.color,
                        }}}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" gutterBottom>
                              {event.title}
                            </Typography>
                            {event.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                {event.description}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                            {/* Split Sheet Events - Show View button instead of Edit */}
                            {event.metadata?.splitSheetId ? (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<SplitSheetIcon />}
                                onClick={() => {
                                  if (communication) {
                                    communication.sendMessage({
                                      from: 'project-timeline',
                                      to: 'split-sheet-manager',
                                      type: 'view-split-sheet',
                                      priority: 'medium',
                                      data: { splitSheetId: event.metadata.splitSheetId }
                                    });
                                  }
                                }}
                                sx={{ color: '#9f7aea', borderColor: '#9f7aea' }}
                              >
                                Vis Split Sheet
                              </Button>
                            ) : (
                              <>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDialog(event)}
                                  sx={{ color: 'primary.main' }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(event.id)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                          <Chip
                            label={eventTypeInfo.label}
                            size="small"
                            sx={{
                              bgcolor: alpha(eventTypeInfo.color, 0.1),
                              color: eventTypeInfo.color,
                              border: `1px solid ${alpha(eventTypeInfo.color, 0.3)}`}}
                          />
                          <Chip
                            label={statusInfo.label}
                            size="small"
                            sx={{
                              bgcolor: alpha(statusInfo.color, 0.1),
                              color: statusInfo.color,
                              border: `1px solid ${alpha(statusInfo.color, 0.3)}`}}
                          />
                          <Chip
                            label={priorityInfo.label}
                            size="small"
                            sx={{
                              bgcolor: alpha(priorityInfo.color, 0.1),
                              color: priorityInfo.color,
                              border: `1px solid ${alpha(priorityInfo.color, 0.3)}`}}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                          {eventDate && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ScheduleIcon fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {eventDate.toLocaleDateString('no-NO', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                                {event.eventTime && ` • ${event.eventTime}`}
                              </Typography>
                            </Box>
                          )}
                          {event.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationIcon fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {event.location}
                              </Typography>
                            </Box>
                          )}
                          {event.completedAt && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CheckCircleIcon fontSize="small" color="success" />
                              <Typography variant="caption" color="text.secondary">
                                Fullført: {new Date(event.completedAt).toLocaleDateString('no-NO')}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Split Sheet Metadata Display */}
                        {event.metadata?.splitSheetId && (
                          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <SplitSheetIcon sx={{ fontSize: 16, color: '#9f7aea' }} />
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#9f7aea' }}>
                                Split Sheet: {event.metadata.splitSheetTitle}
                              </Typography>
                            </Box>
                            {event.metadata.contributorCount && (
                              <Typography variant="caption" color="text.secondary">
                                {event.metadata.contributorCount} bidragsytere
                              </Typography>
                            )}
                            {event.metadata.signedCount !== undefined && event.metadata.totalCount && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Signaturer: {event.metadata.signedCount} av {event.metadata.totalCount}
                              </Typography>
                            )}
                          </Box>
                        )}
                        {event.notes && !event.metadata?.splitSheetId && (
                          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              {event.notes}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}
      </Paper>

      {/* Event Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingEvent ? 'Rediger hendelse' : 'Legg til hendelse'}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Tittel"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Dato"
                type="date"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
              <TextField
                label="Tid"
                type="time"
                value={formData.eventTime}
                onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>
            <TextField
              label="Sted"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                select
                label="Type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                fullWidth
                SelectProps={{ native: true }}
              >
                {eventTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                fullWidth
                SelectProps={{ native: true }}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </TextField>
              <TextField
                select
                label="Prioritet"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                fullWidth
                SelectProps={{ native: true }}
              >
                {priorityOptions.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </TextField>
            </Box>
            <TextField
              label="Notater"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.title || !formData.eventDate || createEventMutation.isPending || updateEventMutation.isPending}
          >
            {createEventMutation.isPending || updateEventMutation.isPending
              ? 'Lagrer...'
              : editingEvent
              ? 'Oppdater'
              : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contract signers dialog */}
      <Dialog open={signersOpen} onClose={() => setSignersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Signaturdetaljer</DialogTitle>
        <DialogContent dividers>
          {signersLoading && (
            <Typography variant="body2" color="text.secondary">Laster signaturer...</Typography>
          )}
          {signersError && (
            <Typography variant="body2" color="error">{signersError}</Typography>
          )}
          {!signersLoading && !signersError && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {signers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Ingen signaturer funnet.</Typography>
              ) : (
                signers.map((s, i) => (
                  <Paper key={i} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2"><strong>Navn:</strong> {s.name || 'Ukjent'}</Typography>
                    <Typography variant="body2"><strong>E-post:</strong> {s.email || 'Ukjent'}</Typography>
                    {s.signedDate && (
                      <Typography variant="body2"><strong>Signert:</strong> {new Date(s.signedDate).toLocaleString('no-NO')}</Typography>
                    )}
                  </Paper>
                ))
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignersOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Pending signature reminder dialog */}
      <Dialog open={reminderOpen} onClose={() => setReminderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send påminnelse</DialogTitle>
        <DialogContent dividers>
          {reminderError && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>{reminderError}</Typography>
          )}
          {reminderSuccess && (
            <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>{reminderSuccess}</Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Emne"
              value={reminderSubject}
              onChange={(e) => setReminderSubject(e.target.value)}
              fullWidth
            />
            <TextField
              label="Melding"
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              fullWidth
              multiline
              rows={4}
            />
            <TextField
              label="Planlegg (valgfritt)"
              type="datetime-local"
              value={reminderScheduleAt}
              onChange={(e) => setReminderScheduleAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Send nå, eller planlegg et tidspunkt"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderOpen(false)}>Lukk</Button>
          <Button onClick={sendReminder} variant="contained" disabled={reminderLoading}>
            {reminderLoading ? 'Sender...' : 'Send påminnelse'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Push Notification Settings Dialog */}
      <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Push-varsler innstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <PushNotificationSettings userId={userId} contextId={projectId} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Project Context & Analytics */}
      <Paper sx={{ mt: 3, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnalyticsIcon /> Prosjektkontekst og Analyse
        </Typography>
        {(() => {
          const has = !!contractSummary?.hasContract || !!contractSummary?.contractId;
          const signed = !!contractSummary?.isSigned || contractSummary?.status === 'signed';
          const navigateContracts = () => {
            try {
              communication?.sendMessage?.({ from: 'project-timeline', to: 'all', type: 'navigate:contracts', priority: 'medium', data: { projectId } });
            } catch (_e) {
              // Empty catch block - error handling not needed
            }
            try {
              window.dispatchEvent(new CustomEvent('custom-navigation', { detail: { type: 'navigate', tab: 'contracts' } }));
            } catch (_e) {
              // Empty catch block - error handling not needed
            }
          };
          if (!has) {
            return (
              <Box sx={{ display: 'flex', gap: 1, alignItems:'center' }}>
                <Chip color="warning" size="small" label="Mangler kontrakt" />
                <Button size="small" variant="outlined" onClick={navigateContracts}>Opprett kontrakt</Button>
              </Box>
            );
          }
          if (signed) return <Chip color="success" size="small" label="Kontrakt signert" clickable onClick={openSignersDialog} />;
          return <Chip color="info" size="small" label="Venter signatur" clickable onClick={openReminderDialog} />;
        })()}
        {renderProjectContextPanel()}
      </Paper>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne hendelsen? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Avbryt</Button>
          <Button onClick={executeDelete} color="error" variant="contained">Slett</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectTimeline;
