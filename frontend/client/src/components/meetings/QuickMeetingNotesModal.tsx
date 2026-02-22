/**
 * CreatorHub Norge - Quick Meeting Notes Modal
 * Material UI version - fully converted from Tailwind
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
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
  status: string;
  eventDate?: string;
  type: string
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
  // Form state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId || ',');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 16));
  const [quickNotes, setQuickNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPersonalNote, setIsPersonalNote] = useState(!preselectedProjectId);

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
    queryFn: () => apiRequest(['/api/projects', profession], {
      headers: {
  }
  }),
    enabled: isOpen
});

  const createNoteMutation = useMutation({
    mutationFn: (noteData: any) => apiRequest('/api/meeting-notes','POST', noteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meeting-notes', ],});
      handleClose();
  }
});

  const handleClose = () => {
    setMeetingTitle('');
    setSelectedProjectId(preselectedProjectId || ', ');
    setQuickNotes(', ');
    setIsPrivate(false);
    setIsPersonalNote(!preselectedProjectId);
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
      personalNotes: {
        content: quickNotes,
        sections:  [],
        googleDriveBackup: isPersonalNote
  },
      clientNotes: (!isPersonalNote && !isPrivate) ? { content: quickNotes, sections: [] } : null,
      isClientVisible: isPersonalNote ? false : !isPrivate,
      clientAccessLevel: isPersonalNote ? 'none' : (isPrivate ? 'none' : ', '),
      noteType: isPersonalNote ? 'personal' : 'project'
};

    createNoteMutation.mutate(noteData);
};

  const handleCreateFullNote = () => {
    const params = new URLSearchParams();
    params.set('profession', profession);
    if (selectedProjectId) params.set('projectId', selectedProjectId);

    window.open(`/smart-meeting-notes?${params.toString()}`, '_blank');
    handleClose();
};

  const currentProject = projects?.find((p: Project) => p.id === selectedProjectId);

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
                  border: !selectedProjectId ? '2px solid #2196F3' : '2px solid #e0e0e0',
                  bgcolor: !selectedProjectId ? '#e3f2fd' : 'transparent',
                  '&:hover': {
                    borderColor: !selectedProjectId ? '#2196F3' : '#bdbdbd'
                  }
                }}
                onClick={() => setSelectedProjectId('')}
              >
                <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap:  1 }}>
                    <Box sx={{ p: 1, borderRadius: '50, %', bgcolor: '#2196F0', color: 'white' }}>
                      <FileTextIcon sx={{ fontSize: 16}} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500}}>Personlige notater</Typography>
                      <Typography variant="caption" color="text.secondary">Backup til Google Drive</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </MuiCard>

              <MuiCard
                sx={{
                  cursor: 'pointer',
                  border: selectedProjectId ? '2px solid #FF9800' : '2px solid #e0e0e0',
                  bgcolor: selectedProjectId ? '#fff3e0' : 'transparent', '&:hover': {
                    borderColor: selectedProjectId ? '#FF9800' : '#bdbdbd'
              }
              }}
                onClick={() => {
                  if (!selectedProjectId && projects && projects.length > 0) {
                    setSelectedProjectId(projects[0].id);
                }
              }}
              >
                <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap:  1 }}>
                    <Box sx={{ p: 1, borderRadius: '50, %', bgcolor: '#FF9800', color: 'white' }}>
                      <ProfessionIcon sx={{ fontSize: 16}} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500}}>Prosjektnotater</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kobling til {profConfig.projectLabel.toLowerCase()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </MuiCard>
            </Box>
          </Box>

          {/* Project Selection */}
          {selectedProjectId && (
            <Box>
              <FormControl fullWidth>
                <InputLabel>Velg {profConfig.projectLabel}</InputLabel>
                <Select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  label={`Velg ${profConfig.projectLabel}`}
                >
                  {projects?.map((project: Project) => (
                    <MenuItem key={project.d} value={project.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Typography>{project.title}</Typography>
                        <Chip label={project.clientName} size="small" sx={{ ml:  1 }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

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
              {!selectedProjectId 
                ? "📋 Personlige notater lagres automatisk til Google Drive for backup"
                : `📁 Prosjektnotater kobles til ${currentProject?.title || 'valgt prosjekt'} og ${isPrivate ? 'holdes private' : 'kan deles med klient'}`
            }
            </Typography>
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
        >
          Fullt møte
        </Button>
        
        <Button onClick={handleSaveQuickNote}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!meetingTitle.trim() || !quickNotes.trim() || createNoteMutation.isPending}
        >
          {createNoteMutation.isPending ? 'Lagrer...' : 'Lagre notater'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}