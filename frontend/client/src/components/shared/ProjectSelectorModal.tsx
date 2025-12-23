/**
 * CreatorHub Norge - Project Selector Modal
 * Velg eksisterende prosjekter opprettet gjennom dashboards for showcase
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  Stack,
  Card as MuiCard,
  CardContent,
  Avatar,
  // Alert removed - Zero Toast Compliance
  CircularProgress
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Event,
  Person,
  Category,
  CalendarToday,
  FolderOpen,
  CloudDone
} from '@mui/icons-material';
import { useLocation } from 'wouter';

interface Project {
  id: number;
  title: string;
  description?: string;
  category: string;
  clientId?: string;
  profession: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
  driveUrl?: string;
  driveFolderId?: string
}

interface ProjectSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectSelected?: (project: Project) => Promise<any>;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor'
}

const professionConfig = {
  photographer: {
    name: 'Fotograf',
    color: '#ff8c00',
    icon: PhotoCamera,
    emptyMessage: 'Ingen fotoprosjekter funnet. Opprett prosjekter gjennom fotograf dashboardet først.'
  },
  videographer: {
    name: 'Videograf', 
    color: '#e74c30',
    icon: Videocam,
    emptyMessage: 'Ingen videoprosjekter funnet. Opprett prosjekter gjennom videograf dashboardet først.'
  },
  music_producer: {
    name: 'Musikkprodusent',
    color: '#9b59b0', 
    icon: LibraryMusic,
    emptyMessage: 'Ingen musikkprosjekter funnet. Opprett prosjekter gjennom musikkprodusent dashboardet først.'
  },
  vendor: {
    name: 'Leverandør',
    color: '#3498db',
    icon: Store,
    emptyMessage: 'Ingen leverandørprosjekter funnet. Opprett prosjekter gjennom leverandør dashboardet først.'
  }
};

export function ProjectSelectorModal({ 
  open, 
  onOpenChange, 
  onProjectSelected,
  profession 
}: ProjectSelectorModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const config = professionConfig[profession];
  const professionDisplayName = getProfessionDisplayName(profession);

  // Fetch projects for this profession
  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['/api/projects', profession],
    queryFn: async () => {
      const response = await fetch(`/api/projects?profession=${profession}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        
        credentials: 'include'
  });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
  },
    enabled: open
});

  const selectedProject = projects.find((p: Project) => p.id === selectedProjectId);

  const handleSubmit = async () => {
    if (!selectedProject || !onProjectSelected) return;

    setLoading(true);
    try {
      await onProjectSelected(selectedProject);
      onOpenChange(false);
      setSelectedProjectId(null);
} catch (error) {
      // Failed to select project - handled by error boundary
  } finally {
      setLoading(false);
  }
};

  const handleClose = () => {
    onOpenChange(false);
    setSelectedProjectId(null);
};

  return (
    <Dialog 
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: 'background.default'
    }
    }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb:  1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 1 }}>
          <Avatar sx={{ bgcolor: config.color, width:  40, height: 40}}>
            <config.icon />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            Velg prosjekt for showcase
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Velg et eksisterende {professionDisplayName.toLowerCase()}-prosjekt for å vise i showcase området
        </Typography>
      </DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py:  4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ mb:  2 }}>
            <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1, color: 'error.contrastText' }}>
              Du har ikke opprettet noen prosjekt enda fra dashbordet ditt.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={config.icon}
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = `/${profession}-dashboard-material`;
                }}
                sx={{
                  ...theming.getThemedButtonSx(),
                  bgcolor: config.color, '&:hover': {
                    bgcolor: config.color,
                    opacity: 0.8
                  }
                }}
              >
                Gå til {professionDisplayName} Dashboard
              </Button>
            </Box>
          </Box>
        ) : projects.length === 0 ? (
          <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText'}}>
            {config.emptyMessage}
          </Typography>
        ) : (
          <Box sx={{ mb:  3 }}>
            <FormControl fullWidth>
              <InputLabel>Velg prosjekt</InputLabel>
              <Select
                value={selectedProjectId || ', '}
                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                label="Velg prosjekt"
              >
                {projects.map((project: Project) => (
                  <MenuItem key={project.d} value={project.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%'}}>
                      <Box sx={{ flexGrow:  1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 50}}>
                          {project.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {project.category} • {new Date(project.createdAt).toLocaleDateString('no-NO')}
                        </Typography>
                      </Box>
                      <Chip 
                        label={project.status}
                        size="small" 
                        color={project.status === 'active' ? 'success' : 'default'}
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Project Preview Card */}
            {selectedProject && (
              <MuiCard sx={{ mt:  3, bgcolor: 'background.paper', border: `1px solid ${config.color}30` }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Forhåndsvisning av prosjekt
                  </Typography>
                  
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Event color="action" />
                      <Typography variant="body2">
                        <strong>Tittel: </strong> {selectedProject.title}
                      </Typography>
                    </Box>
                    
                    {selectedProject.description && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap:  1 }}>
                        <Category color="action" />
                        <Typography variant="body2">
                          <strong>Beskrivelse: </strong> {selectedProject.description}
                        </Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Category color="action" />
                      <Typography variant="body2">
                        <strong>Kategori: </strong> {selectedProject.category}
                      </Typography>
                    </Box>
                    
                    {selectedProject.scheduledDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <CalendarToday color="action" />
                        <Typography variant="body2">
                          <strong>Planlagt dato: </strong> {new Date(selectedProject.scheduledDate).toLocaleDateString(', ')}
                        </Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <CloudDone color="action" />
                      <Typography variant="body2">
                        <strong>Drive integrasjon: </strong> {selectedProject.driveUrl ? 'Aktivert' : 'Ikke konfigurert'}
                      </Typography>
                    </Box>
                  </Stack>

                  {selectedProject.driveUrl && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius:  1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        {theming.getThemedIcon('folderOpen')}
                        <Typography variant="body2" sx={{ color: 'success.contrastText'}}>
                          Prosjektet har automatisk Drive-mappestruktur. Innhold vil synkroniseres med showcase.
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </MuiCard>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px:  3, pb:  3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Avbryt
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedProject || loading || projects.length === 0}
          sx={{
            bgcolor: config.color,
            '&:hover': { bgcolor: config.color + 'dd' }
          }}
          startIcon={loading ? <CircularProgress size={16} /> : theming.getThemedIcon('cloudDone')}
        >
          {loading ? 'Kobler til...' : 'Koble til showcase'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProjectSelectorModal;