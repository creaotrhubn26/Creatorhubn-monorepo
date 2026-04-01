import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Event,
  OpenInNew,
  Save,
  VideoCall,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import NotebookLmWorkspaceCard from './NotebookLmWorkspaceCard';
import { notebookLmWorkspaceService } from '@/services/notebookLmWorkspaceService';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';

interface Project {
  id: string;
  title: string;
  name?: string;
  clientName?: string;
  clientEmail?: string;
  customerId?: string | null;
}

interface GoogleMeetCreateResponse {
  success?: boolean;
  meetLink?: string;
  title?: string;
  scheduledAt?: string;
  calendarEventId?: string | null;
  webViewUrl?: string | null;
  meetingNote?: {
    meetingId?: string | null;
    googleCalendarEventId?: string | null;
  } | null;
  notebookLmWorkspace?: {
    workspaceDocumentUrl?: string | null;
    title?: string;
  } | null;
  notebookLmStatus?: {
    workspaceReady?: boolean;
    syncEligible?: boolean;
    reason?: string | null;
  } | null;
}

interface GoogleWorkspaceMeetingManagerProps {
  profession: Profession;
  isOpen?: boolean;
  onClose?: () => void;
  preselectedProjectId?: string;
  selectedProject?: Project | null;
  onProjectSelect?: (project: Project) => void;
}

export function GoogleWorkspaceMeetingManager({
  profession,
  preselectedProjectId,
  selectedProject,
  onProjectSelect,
}: GoogleWorkspaceMeetingManagerProps): JSX.Element {
  const { user } = useAuth();
  const userId = user?.id || undefined;
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId || selectedProject?.id || '');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDateTime, setMeetingDateTime] = useState(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  const [duration, setDuration] = useState('60');
  const [description, setDescription] = useState('');
  const [lastMeeting, setLastMeeting] = useState<GoogleMeetCreateResponse | null>(null);

  const { data: projects } = useQuery({
    queryKey: ['/api/projects', profession, 'google-meet-manager'],
    queryFn: () => apiRequest('/api/projects'),
  });

  const currentProject = useMemo(
    () => (Array.isArray(projects) ? projects.find((project: Project) => project.id === selectedProjectId) : undefined),
    [projects, selectedProjectId],
  );

  useEffect(() => {
    const nextProjectId = preselectedProjectId || selectedProject?.id || '';
    setSelectedProjectId(nextProjectId);
  }, [preselectedProjectId, selectedProject?.id]);

  useEffect(() => {
    if (!meetingTitle.trim()) {
      setMeetingTitle(currentProject?.title ? `Møte: ${currentProject.title}` : 'Google Meet');
    }
  }, [currentProject?.title, meetingTitle]);

  const notebookScope = useMemo(() => ({
    userId,
    profession,
    projectId: selectedProjectId || undefined,
    clientId: currentProject?.customerId || undefined,
    projectTitle: currentProject?.title || currentProject?.name || undefined,
    clientName: currentProject?.clientName || undefined,
    clientEmail: currentProject?.clientEmail || undefined,
    latestMeetingTitle: meetingTitle || undefined,
  }), [
    userId,
    profession,
    selectedProjectId,
    currentProject?.customerId,
    currentProject?.title,
    currentProject?.name,
    currentProject?.clientName,
    currentProject?.clientEmail,
    meetingTitle,
  ]);

  const notebookWorkspaceQuery = useQuery({
    queryKey: ['notebooklm-workspace', 'google-meet-manager', notebookScope],
    queryFn: () => notebookLmWorkspaceService.getStatus(notebookScope),
    enabled: true,
  });

  const notebookWorkspaceSyncMutation = useMutation({
    mutationFn: () => notebookLmWorkspaceService.sync(notebookScope),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/google-meet/create', {
        method: 'POST',
        body: {
          title: meetingTitle,
          description,
          duration: Number(duration),
          startDateTime: new Date(meetingDateTime).toISOString(),
          projectId: selectedProjectId || undefined,
          projectName: currentProject?.title || currentProject?.name || undefined,
          clientName: currentProject?.clientName || undefined,
          clientEmail: currentProject?.clientEmail || undefined,
          clientId: currentProject?.customerId || undefined,
          participants: currentProject?.clientEmail ? [currentProject.clientEmail] : [],
          profession,
          userId,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }) as Promise<GoogleMeetCreateResponse>;
    },
    onSuccess: (response) => {
      setLastMeeting(response);
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
      if (response.meetLink) {
        window.open(response.meetLink, '_blank', 'noopener,noreferrer');
      }
    },
  });

  return (
    <Stack
      spacing={2.5}
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 4,
        background: 'linear-gradient(180deg, rgba(250,245,236,0.92) 0%, rgba(245,239,228,0.72) 100%)',
        border: '1px solid rgba(120, 96, 52, 0.12)',
      }}
    >
      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(120, 96, 52, 0.1)',
        }}
      >
        <Typography
          variant="overline"
          sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.14em' }}
        >
          CreatorHub Research Flow
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Google Meet og NotebookLM
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Dette er CreatorHub-flaten for møtet, kildene og notatrommet. NotebookLM bruker de samme Google Docs-kildene, men åpnes i eget vindu når du trenger oppsummering og Q&A.
        </Typography>
      </Box>

      <NotebookLmWorkspaceCard
        status={notebookWorkspaceQuery.data}
        loading={notebookWorkspaceQuery.isLoading}
        syncing={notebookWorkspaceSyncMutation.isPending}
        profession={profession}
        onSync={() => {
          notebookWorkspaceSyncMutation.mutate();
        }}
      />

      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.74)',
          border: '1px solid rgba(120, 96, 52, 0.1)',
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ color: '#8b6b3f', fontWeight: 800, letterSpacing: '0.12em' }}>
              Meeting Setup
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Velg prosjekt og opprett møtet i samme kunnskapskontekst som notatene dine.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <FormControl fullWidth>
              <InputLabel>Prosjekt</InputLabel>
              <Select
                value={selectedProjectId}
                label="Prosjekt"
                onChange={(event) => {
                  const nextProjectId = String(event.target.value || '');
                  setSelectedProjectId(nextProjectId);
                  const nextProject = Array.isArray(projects)
                    ? projects.find((project: Project) => project.id === nextProjectId)
                    : undefined;
                  if (nextProject) {
                    onProjectSelect?.(nextProject);
                  }
                }}
              >
                {Array.isArray(projects) && projects.length > 0 ? projects.map((project: Project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.title || project.name || project.id}
                  </MenuItem>
                )) : (
                  <MenuItem value="">Ingen prosjekter tilgjengelig</MenuItem>
                )}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Møtetittel"
              value={meetingTitle}
              onChange={(event) => setMeetingTitle(event.target.value)}
            />

            <TextField
              fullWidth
              type="datetime-local"
              label="Starttid"
              value={meetingDateTime}
              onChange={(event) => setMeetingDateTime(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="Varighet (minutter)"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </Box>

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Beskrivelse"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dette møtet vil bruke samme Google Workspace- og NotebookLM-kontekst som prosjektets notater."
          />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {currentProject?.clientEmail ? (
              <Chip size="small" icon={<Event />} label={`Inviterer ${currentProject.clientEmail}`} variant="outlined" />
            ) : null}
            {notebookWorkspaceQuery.data?.workspace?.title ? (
              <Chip size="small" icon={<Save />} label={notebookWorkspaceQuery.data.workspace.title} variant="outlined" />
            ) : null}
          </Box>
        </Stack>
      </Box>

      {lastMeeting?.notebookLmStatus?.workspaceReady ? (
        <Alert severity="success">
          Google Meet ble opprettet og koblet til samme NotebookLM-arbeidsrom som møtenotatene.
        </Alert>
      ) : null}

      {lastMeeting?.meetingNote?.meetingId ? (
        <Alert severity="info">
          Møtet er koblet til møtenotat {lastMeeting.meetingNote.meetingId}.
        </Alert>
      ) : null}

      {lastMeeting?.notebookLmStatus?.reason ? (
        <Alert severity="info">
          {lastMeeting.notebookLmStatus.reason}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<VideoCall />}
          onClick={() => createMeetingMutation.mutate()}
          disabled={!meetingTitle.trim() || !meetingDateTime || createMeetingMutation.isPending}
        >
          {createMeetingMutation.isPending ? 'Oppretter møte...' : 'Opprett Google Meet'}
        </Button>

        {lastMeeting?.meetLink ? (
          <Button component="a" href={lastMeeting.meetLink} target="_blank" rel="noreferrer" variant="outlined" startIcon={<OpenInNew />}>
            Åpne Meet
          </Button>
        ) : null}

        {lastMeeting?.notebookLmWorkspace?.workspaceDocumentUrl ? (
          <Button component="a" href={lastMeeting.notebookLmWorkspace.workspaceDocumentUrl} target="_blank" rel="noreferrer" variant="outlined" startIcon={<OpenInNew />}>
            Åpne notatrom
          </Button>
        ) : null}

        {lastMeeting?.meetingNote?.meetingId ? (
          <Button
            component="a"
            href={`/smart-meeting-notes?meetingId=${encodeURIComponent(lastMeeting.meetingNote.meetingId)}&profession=${encodeURIComponent(profession)}${selectedProjectId ? `&projectId=${encodeURIComponent(selectedProjectId)}` : ''}`}
            target="_blank"
            rel="noreferrer"
            variant="outlined"
            startIcon={<OpenInNew />}
          >
            Åpne møtenotat
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}

export default GoogleWorkspaceMeetingManager;
