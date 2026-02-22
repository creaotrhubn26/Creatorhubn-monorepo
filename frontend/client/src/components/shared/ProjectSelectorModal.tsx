/**
 * CreatorHub Norge - Project Selector Modal
 * Velg eksisterende prosjekter opprettet gjennom dashboards for showcase
 */

import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Stack,
  Avatar,
  CircularProgress,
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Category,
  CalendarToday,
  FolderOpen,
  CloudDone,
} from '@mui/icons-material';


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
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'
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
    color: '#e74c3c',
    icon: Videocam,
    emptyMessage: 'Ingen videoprosjekter funnet. Opprett prosjekter gjennom videograf dashboardet først.'
  },
  music_producer: {
    name: 'Musikkprodusent',
    color: '#9b59b6', 
    icon: LibraryMusic,
    emptyMessage: 'Ingen musikkprosjekter funnet. Opprett prosjekter gjennom musikkprodusent dashboardet først.'
  },
  vendor: {
    name: 'Leverandør',
    color: '#3498db',
    icon: Store,
    emptyMessage: 'Ingen leverandørprosjekter funnet. Opprett prosjekter gjennom leverandør dashboardet først.'
  },
  enterprise: {
    name: 'Enterprise',
    color: '#ff6b35',
    icon: PhotoCamera,
    emptyMessage: 'Ingen enterprise-prosjekter funnet. Opprett prosjekter gjennom enterprise dashboardet først.'
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
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const config = professionConfig[profession] || professionConfig.photographer;
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
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          bgcolor: '#1a1f2e',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1, pt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ 
            bgcolor: `${config.color}20`, 
            color: config.color,
            width: 44, 
            height: 44,
            border: `2px solid ${config.color}40`,
          }}>
            <config.icon sx={{ fontSize: 22 }} />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.15rem' }}>
            Velg prosjekt
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
          Velg et {professionDisplayName.toLowerCase()}-prosjekt for showcase
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: config.color }} />
          </Box>
        ) : error ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(244, 67, 54, 0.2)' }}>
              Du har ikke opprettet noen prosjekt enda fra dashbordet ditt.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<config.icon />}
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = `/${profession}-dashboard-material`;
                }}
                sx={{
                  bgcolor: config.color,
                  color: '#fff',
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { bgcolor: config.color, opacity: 0.9 },
                }}
              >
                Gå til {professionDisplayName} Dashboard
              </Button>
            </Box>
          </Box>
        ) : projects.length === 0 ? (
          <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'rgba(33, 150, 243, 0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(33, 150, 243, 0.15)' }}>
            {config.emptyMessage}
          </Typography>
        ) : (
          <Box sx={{ mb: 2 }}>
            {/* Project Cards List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {projects.map((project: Project) => (
                <Box
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 1.5,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    bgcolor: selectedProjectId === project.id ? `${config.color}15` : 'rgba(255,255,255,0.03)',
                    border: selectedProjectId === project.id ? `2px solid ${config.color}` : '2px solid transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: selectedProjectId === project.id ? `${config.color}20` : 'rgba(255,255,255,0.06)',
                    },
                  }}
                >
                  <Avatar sx={{ 
                    width: 36, height: 36, 
                    bgcolor: `${config.color}20`, 
                    color: config.color,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    <FolderOpen sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>
                      {project.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                      {project.category} • {new Date(project.createdAt).toLocaleDateString('no-NO')}
                    </Typography>
                  </Box>
                  <Chip 
                    label={project.status}
                    size="small" 
                    sx={{
                      height: 22,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      bgcolor: project.status === 'active' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255,255,255,0.06)',
                      color: project.status === 'active' ? '#4caf50' : 'rgba(255,255,255,0.5)',
                      border: project.status === 'active' ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                  {project.driveUrl && (
                    <CloudDone sx={{ fontSize: 16, color: 'rgba(255,255,255,0.25)' }} />
                  )}
                </Box>
              ))}
            </Box>

            {/* Project Preview */}
            {selectedProject && (
              <Box sx={{ mt: 2, p: 2, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Stack spacing={1.5}>
                  {selectedProject.description && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>
                      {selectedProject.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Category sx={{ fontSize: 15, color: 'rgba(255,255,255,0.3)' }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{selectedProject.category}</Typography>
                    </Box>
                    {selectedProject.scheduledDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <CalendarToday sx={{ fontSize: 15, color: 'rgba(255,255,255,0.3)' }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          {new Date(selectedProject.scheduledDate).toLocaleDateString('no-NO')}
                        </Typography>
                      </Box>
                    )}
                    {selectedProject.driveUrl && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <CloudDone sx={{ fontSize: 15, color: '#4caf50' }} />
                        <Typography variant="caption" sx={{ color: '#4caf50' }}>Drive synkronisert</Typography>
                      </Box>
                    )}
                  </Box>
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0.5, gap: 1 }}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          sx={{ 
            color: 'rgba(255,255,255,0.5)', 
            textTransform: 'none',
            fontSize: '0.85rem',
            borderRadius: '10px',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Avbryt
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedProject || loading || projects.length === 0}
          sx={{
            bgcolor: config.color,
            color: '#fff',
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            px: 3,
            boxShadow: `0 4px 16px ${config.color}40`,
            '&:hover': { bgcolor: config.color, filter: 'brightness(1.1)' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' },
          }}
          startIcon={loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <CloudDone sx={{ fontSize: 18 }} />}
        >
          {loading ? 'Kobler til...' : 'Koble til showcase'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProjectSelectorModal;