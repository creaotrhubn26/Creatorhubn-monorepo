// @ts-nocheck
/**
 * CreatorHub Norge - Quick Meeting Notes Modal
 * Material UI version - fully converted from Tailwind
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Box,
  Button,
  Badge,
  Card as MuiCard,
  CardContent,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormLabel as Label,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  Alert,
} from '@mui/material';
import {
  Save as SaveIcon,
  Event as CalendarIcon,
  People as UsersIcon,
  Description as FileTextIcon,
  PhotoCamera as CameraIcon,
  Videocam as VideoIcon,
  LibraryMusic as MusicIcon,
  Business as BuildingIcon,
  Close as XIcon,
  Add as PlusIcon,
  Schedule as ClockIcon,
  LocationOn as MapPinIcon,
  CloudDone as CloudDoneIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import NotebookLmWorkspaceCard from './NotebookLmWorkspaceCard';
import { notebookLmWorkspaceService } from '@/services/notebookLmWorkspaceService';

interface QuickMeetingNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  preselectedProjectId?: string;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface Project {
  id: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  description?: string;
  location?: string;
  status: string;
  eventDate?: string;
  type: string;
  customerId?: string | null;
}

export function QuickMeetingNotesModal({
  isOpen,
  onClose,
  profession,
  preselectedProjectId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}: QuickMeetingNotesModalProps) {
  const { user } = useAuth();
  const userId = user?.id || undefined;
  const initialProjectId = preselectedProjectId || selectedProject?.id || '';

  // Form state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 16));
  const [quickNotes, setQuickNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPersonalNote, setIsPersonalNote] = useState(!initialProjectId);

  const queryClient = useQueryClient();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  // Profession configurations
  const professionConfigs = {
    photographer: {
      name: getProfessionDisplayName('photographer'),
      color: 'primary',
      icon: CameraIcon,
      projectLabel: 'Fotoshoot'
    },
    videographer: {
      name: getProfessionDisplayName('videographer'),
      color: 'secondary',
      icon: VideoIcon,
      projectLabel: 'Videoproduksjon'
    },
    music_producer: {
      name: getProfessionDisplayName('music_producer'),
      color: 'warning',
      icon: MusicIcon,
      projectLabel: 'Musikkprosjekt'
    },
    vendor: {
      name: getProfessionDisplayName('vendor'),
      color: 'success',
      icon: BuildingIcon,
      projectLabel: 'Leveranseprosjekt'
    }
  };

  const profConfig = professionConfigs[profession] || professionConfigs.photographer;
  const ProfessionIcon = profConfig.icon;

  // Fetch projects for the current user
  const { data: projects } = useQuery({
    queryKey: ['/api/projects', profession],
    queryFn: () => apiRequest('/api/projects', {
      headers: {
  }
  }),
    enabled: isOpen
});

  const currentProject = projects?.find((p: Project) => p.id === selectedProjectId);
  const requiresProjectSelection = !isPersonalNote && !selectedProjectId;

  const notebookWorkspaceScope = useMemo(() => ({
    userId,
    profession,
    projectId: selectedProjectId || undefined,
    clientId: currentProject?.customerId || selectedProject?.customerId || undefined,
    projectTitle: currentProject?.title || selectedProject?.title || undefined,
    clientName: currentProject?.clientName || selectedProject?.clientName || undefined,
    clientEmail: currentProject?.clientEmail || selectedProject?.clientEmail || undefined,
    latestMeetingTitle: meetingTitle || undefined,
  }), [
    userId,
    profession,
    selectedProjectId,
    currentProject?.customerId,
    currentProject?.title,
    currentProject?.clientName,
    currentProject?.clientEmail,
    selectedProject?.customerId,
    selectedProject?.title,
    selectedProject?.clientName,
    selectedProject?.clientEmail,
    meetingTitle,
  ]);

  const notebookWorkspaceQuery = useQuery({
    queryKey: ['notebooklm-workspace', 'quick-modal', notebookWorkspaceScope],
    queryFn: () => notebookLmWorkspaceService.getStatus(notebookWorkspaceScope),
    enabled: isOpen,
  });

  const notebookWorkspaceSyncMutation = useMutation({
    mutationFn: () => notebookLmWorkspaceService.sync(notebookWorkspaceScope),
    onSuccess: (status) => {
      queryClient.setQueryData(['notebooklm-workspace', 'quick-modal', notebookWorkspaceScope], status);
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (noteData: any) => apiRequest('/api/meeting-notes', {
      method: 'POST',
      body: noteData,
    }),
    onSuccess: (note: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meeting-notes', ],});
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });
      if (onMeetingCreate) {
        onMeetingCreate(note);
      }
      handleClose();
  }
});

  const createFullNoteMutation = useMutation({
    mutationFn: async () => {
      const resolvedTitle = meetingTitle.trim() || (selectedProjectId
        ? `Møte - ${currentProject?.title || profConfig.projectLabel}`
        : 'Møtenotat');

      return apiRequest('/api/meeting-notes', {
        method: 'POST',
        body: {
          title: resolvedTitle,
          meetingDate,
          profession,
          projectId: selectedProjectId || null,
          clientId: currentProject?.customerId || selectedProject?.customerId || null,
          clientName: currentProject?.clientName || selectedProject?.clientName || '',
          clientEmail: currentProject?.clientEmail || selectedProject?.clientEmail || '',
          personalNotes: {
            content: quickNotes,
            sections: [],
            googleDriveBackup: isPersonalNote,
          },
          clientNotes: (!isPersonalNote && !isPrivate) ? { content: quickNotes, sections: [] } : null,
          isClientVisible: isPersonalNote ? false : !isPrivate,
          clientAccessLevel: isPersonalNote ? 'none' : (isPrivate ? 'none' : 'summary'),
          noteType: isPersonalNote ? 'personal' : 'project',
        },
      }) as Promise<{ meetingId?: string; id?: string }>;
    },
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/meeting-notes'] });
      void queryClient.invalidateQueries({ queryKey: ['notebooklm-workspace'] });

      const params = new URLSearchParams();
      params.set('profession', profession);

      const resolvedMeetingId = String(note?.meetingId || note?.id || '').trim();
      if (resolvedMeetingId) {
        params.set('meetingId', resolvedMeetingId);
      }
      if (selectedProjectId) {
        params.set('projectId', selectedProjectId);
      }

      window.open(`/smart-meeting-notes?${params.toString()}`, '_blank');
      handleClose();
    },
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextProjectId = preselectedProjectId || selectedProject?.id || '';
    setSelectedProjectId(nextProjectId);
    setIsPersonalNote(!nextProjectId);
  }, [isOpen, preselectedProjectId, selectedProject]);

  useEffect(() => {
    if (!isOpen || !Array.isArray(projects) || projects.length === 0 || !selectedProjectId) {
      return;
    }

    const hasSelectedProject = projects.some((project: Project) => project.id === selectedProjectId);
    if (!hasSelectedProject) {
      setSelectedProjectId('');
      setIsPersonalNote(true);
    }
  }, [isOpen, projects, selectedProjectId]);

  const handleClose = () => {
    const nextProjectId = preselectedProjectId || selectedProject?.id || '';
    setMeetingTitle('');
    setSelectedProjectId(nextProjectId);
    setQuickNotes('');
    setIsPrivate(false);
    setIsPersonalNote(!nextProjectId);
    onClose();
};

  const handleSaveQuickNote = () => {
    if (!meetingTitle.trim() || !quickNotes.trim()) {
      return;
  }

    const noteData = {
      title: meetingTitle,
      meetingDate,
      profession,
      projectId: selectedProjectId || null,
      clientId: currentProject?.customerId || selectedProject?.customerId || null,
      clientName: currentProject?.clientName || selectedProject?.clientName || '',
      clientEmail: currentProject?.clientEmail || selectedProject?.clientEmail || '',
      personalNotes: {
        content: quickNotes,
        sections:  [],
        googleDriveBackup: isPersonalNote
  },
      clientNotes: (!isPersonalNote && !isPrivate) ? { content: quickNotes, sections: [] } : null,
      isClientVisible: isPersonalNote ? false : !isPrivate,
      clientAccessLevel: isPersonalNote ? 'none' : (isPrivate ? 'none' : 'summary'),
      noteType: isPersonalNote ? 'personal' : 'project'
};

    createNoteMutation.mutate(noteData);
};

  const handleCreateFullNote = () => {
    if (requiresProjectSelection) {
      return;
    }

    createFullNoteMutation.mutate();
  };

  const selectedProjectValue = Array.isArray(projects) && projects.some((project: Project) => project.id === selectedProjectId)
    ? selectedProjectId
    : '';

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Box sx={{
            p:  1,
            borderRadius:  2,
            bgcolor: (profConfig.color || 'primary') + '.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center'
      }}>
            <ProfessionIcon sx={{ fontSize: 20}} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Nytt møtenotat</Typography>
            <Typography variant="body2" color="text.secondary">
              {profConfig.name} • Rask notater eller detaljert møte
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap:  3, py:  2 }}>
          {/* Meeting Title */}
          <Box>
            <Label>Møtetittel *</Label>
            <TextField
              fullWidth
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="F.eks. Bryllupsplanlegging - Første møte"
              sx={{ mt:  1 }}
            />
          </Box>

          {/* Note Type Selection */}
          <Box>
            <Label>Type notat</Label>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <MuiCard
                sx={{
                  cursor: 'pointer',
                  border: isPersonalNote ? '2px solid #2196F3' : '2px solid #e0e0e0',
                  bgcolor: isPersonalNote ? '#e3f2fd' : 'transparent',
                  '&:hover': {
                    borderColor: isPersonalNote ? '#2196F3' : '#bdbdbd'
                  }
                }}
                onClick={() => {
                  setSelectedProjectId('');
                  setIsPersonalNote(true);
                }}
              >
                <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap:  1 }}>
                    <Box sx={{ p: 1, borderRadius: '50%', bgcolor: '#2196F0', color: 'white' }}>
                      <FileTextIcon sx={{ fontSize: 16}} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500}}>Personlige notater</Typography>
                      <Typography variant="caption" color="text.secondary">Internt notat med Drive-backup</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </MuiCard>

              <MuiCard
                sx={{
                  cursor: 'pointer',
                  border: !isPersonalNote ? '2px solid #FF9800' : '2px solid #e0e0e0',
                  bgcolor: !isPersonalNote ? '#fff3e0' : 'transparent', '&:hover': {
                    borderColor: !isPersonalNote ? '#FF9800' : '#bdbdbd'
              }
              }}
                onClick={() => {
                  setIsPersonalNote(false);
                  if (!selectedProjectId && projects && projects.length > 0) {
                    setSelectedProjectId(projects[0].id);
                    onProjectSelect?.(projects[0]);
                  }
              }}
              >
                <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap:  1 }}>
                    <Box sx={{ p: 1, borderRadius: '50%', bgcolor: '#FF9800', color: 'white' }}>
                      <ProfessionIcon sx={{ fontSize: 16}} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500}}>Prosjektnotater</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kobles til prosjekt og NotebookLM
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </MuiCard>
            </Box>

            <Box
              sx={{
                mt: 1.5,
                p: 2,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: !isPersonalNote ? 'rgba(245, 158, 11, 0.28)' : 'rgba(59, 130, 246, 0.22)',
                bgcolor: !isPersonalNote ? 'rgba(255, 247, 237, 0.92)' : 'rgba(239, 246, 255, 0.92)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                {!isPersonalNote ? 'Dette blir en NotebookLM-kilde' : 'Dette blir et internt notat'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {!isPersonalNote
                  ? (currentProject
                    ? `Prosjektnotater for ${currentProject.title} lagres som møtenotat, synkes til Google Drive og tas inn i prosjektets NotebookLM-workspace.`
                    : 'Velg et prosjekt under. Da lagres notatet som møtenotat, synkes til Google Drive og tas inn i prosjektets NotebookLM-workspace.')
                  : 'Personlige notater lagres som interne notater for deg. De kan sikkerhetskopieres til Google Drive, men de går ikke inn i NotebookLM før notatet er koblet til et prosjekt eller en klient.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
                <Chip
                  size="small"
                  color={!isPersonalNote ? 'warning' : 'primary'}
                  label={!isPersonalNote ? 'Sync: Google Drive + NotebookLM' : 'Sync: intern note'}
                  variant={!isPersonalNote ? 'filled' : 'outlined'}
                />
                {!isPersonalNote ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={currentProject ? `Prosjekt: ${currentProject.title}` : 'Prosjekt: velg under'}
                  />
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    label="NotebookLM: ikke før prosjektkobling"
                  />
                )}
              </Box>
            </Box>

            {!isPersonalNote ? (
              <Box
                sx={{
                  mt: 1.25,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(255, 247, 237, 0.78)',
                  border: '1px solid rgba(245, 158, 11, 0.16)',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Slik vet CreatorHub hvilket prosjekt dette gjelder: hvis du åpnet møtenotatet fra et prosjekt i dashboardet er prosjektet forhåndsvalgt. Hvis ikke velger du prosjektet manuelt i listen under.
                </Typography>
              </Box>
            ) : null}
          </Box>

          {/* Project Selection */}
          {!isPersonalNote && (
            <Box>
              <FormControl fullWidth>
                <InputLabel>Velg prosjekt</InputLabel>
                <Select
                  value={selectedProjectValue}
                  onChange={(e) => {
                    const nextProjectId = String(e.target.value || '');
                    setSelectedProjectId(nextProjectId);
                    setIsPersonalNote(!nextProjectId);
                    const nextProject = projects?.find((project: Project) => project.id === nextProjectId);
                    if (nextProject) {
                      onProjectSelect?.(nextProject);
                    }
                  }}
                  label="Velg prosjekt"
                >
                  <MenuItem value="" disabled>
                    Velg prosjekt
                  </MenuItem>
                  {projects?.map((project: Project) => (
                    <MenuItem key={project.id} value={project.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Typography>{project.title}</Typography>
                        <Chip label={project.clientName} size="small" sx={{ ml:  1 }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {currentProject
                  ? `Dette notatet blir koblet til ${currentProject.title}.`
                  : 'Velg prosjektet som notatet skal lagres under.'}
              </Typography>
            </Box>
          )}

          {!isPersonalNote && currentProject ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid rgba(245, 158, 11, 0.2)',
                bgcolor: 'rgba(255, 247, 237, 0.88)',
              }}
            >
              <Typography variant="overline" sx={{ color: 'warning.dark', fontWeight: 700, letterSpacing: 1 }}>
                Aktiv prosjektkobling
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.25 }}>
                {currentProject.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {[
                  currentProject.clientName || null,
                  currentProject.location || null,
                  currentProject.eventDate || null,
                ]
                  .filter(Boolean)
                  .join(' • ') || 'Prosjektet brukes som kilde for møtenotat og NotebookLM'}
              </Typography>
              {currentProject.description ? (
                <Typography variant="body2" sx={{ mt: 1.25 }}>
                  {currentProject.description}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          <NotebookLmWorkspaceCard
            status={notebookWorkspaceQuery.data}
            loading={notebookWorkspaceQuery.isLoading}
            syncing={notebookWorkspaceSyncMutation.isPending}
            profession={profession}
            onSync={() => {
              notebookWorkspaceSyncMutation.mutate();
            }}
            dense
          />

          {/* Meeting Date */}
          <Box>
            <Label>Møtedato og tid</Label>
            <TextField
              fullWidth
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              sx={{ mt:  1 }}
            />
          </Box>

          {/* Quick Notes */}
          <Box>
            <Label>Notater *</Label>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={quickNotes}
              onChange={(e) => setQuickNotes(e.target.value)}
              placeholder="Skriv dine møtenotater her..."
              sx={{ mt:  1 }}
            />
          </Box>

          {/* Privacy Settings */}
          {selectedProjectId && (
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
              }
                label="Privat notat (ikke synlig for klient)"
              />
            </Box>
          )}

          {/* Action Info */}
          <Alert severity="info" sx={{ mt:  2 }}>
            <Typography variant="body2">
              {isPersonalNote
                ? "📋 Personlige notater lagres automatisk til Google Drive for backup"
                : `📁 Prosjektnotater kobles til ${currentProject?.title || 'valgt prosjekt'} og ${isPrivate ? 'holdes private' : 'kan deles med klient'}`
              }
            </Typography>
            {!isPersonalNote ? (
              <Typography variant="body2" sx={{ mt: 1 }}>
                `Åpne full møteeditor` oppretter først et ekte møtenotat med denne prosjektkoblingen og åpner deretter hele møteeditoren med samme NotebookLM-arbeidsrom.
              </Typography>
            ) : null}
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p:  3, gap:  2 }}>
        <Button onClick={handleClose} variant="outlined">
          Avbryt
        </Button>
        
        <Button
          onClick={handleCreateFullNote}
          variant="outlined"
          startIcon={<PlusIcon />}
          disabled={requiresProjectSelection || createFullNoteMutation.isPending}
        >
          {createFullNoteMutation.isPending ? 'Åpner editor...' : 'Åpne full møteeditor'}
        </Button>
        
        <Button onClick={handleSaveQuickNote}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!meetingTitle.trim() || !quickNotes.trim() || requiresProjectSelection || createNoteMutation.isPending}
        >
          {createNoteMutation.isPending ? 'Lagrer...' : 'Lagre notater'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
