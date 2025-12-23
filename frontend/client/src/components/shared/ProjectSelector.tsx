/**
 * Project Selector Component
 *
 * Allows users to connect their current work (StoryArc, AudioEnhancement, Journey)
 * to a specific project so all outputs are saved to that project's Google Drive folder
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  FolderOpen,
  Link as LinkIcon,
  Close,
  Search,
  CheckCircle,
  Folder,
  Add,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Project {
  id: string;
  name: string;
  clientName?: string;
  projectType?: string;
  status?: string;
  googleDriveFolderId?: string;
  createdAt?: string;
}

interface ProjectSelectorProps {
  open: boolean;
  onClose: () => void;
  onProjectSelected: (project: Project) => void;
  currentProjectId?: string;
  context: 'storyarc' | 'audio-enhancement' | 'customer-journey';
  contextLabel?: string;
}

export default function ProjectSelector({
  open,
  onClose,
  onProjectSelected,
  currentProjectId,
  context,
  contextLabel,
}: ProjectSelectorProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch available projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => apiRequest('/api/projects'),
    enabled: open,
  });

  // Filter projects based on search
  const filteredProjects = projects.filter(
    (project: Project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase() ||
      project.clientName?.toLowerCase().includes(searchQuery.toLowerCase(),
  );

  // Get selected project details
  const selectedProject = projects.find((p: Project) => p.id === selectedProjectId);

  const handleConnect = () => {
    if (selectedProject) {
      onProjectSelected(selectedProject);
      onClose();
    }
  };

  const getContextDescription = () => {
    switch (context) {
      case 'storyarc': return 'Alle videoeksporter vil bli lagret i prosjektets Google Drive mappe.';
      case 'audio-enhancement': return 'Alle behandlede lydfiler vil bli lagret i prosjektets Google Drive mappe.';
      case 'customer-journey': return 'Alle genererte videoer og journey-data vil bli lagret i prosjektets Google Drive mappe.';
      default: return 'Alle filer vil bli lagret i prosjektets Google Drive mappe.';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <FolderOpen color="primary" />
            <Typography variant="h6">Koble til Prosjekt</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ py: 2 }}>
          {/* Context Info */}
          <Alert severity="info" icon={<LinkIcon />}>
            <Typography variant="body2">
              <strong>{contextLabel || context}:</strong> {getContextDescription()}
            </Typography>
          </Alert>

          {/* Current Connection Status */}
          {currentProjectId && (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography variant="body2">
                <strong>Nåværende tilkobling:</strong>{', '}
                {projects.find((p: Project) => p.id === currentProjectId)?.name || currentProjectId}
              </Typography>
            </Alert>
          )}

          {/* Search */}
          <TextField
            fullWidth
            placeholder="Søk etter prosjekt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )}}
            size="small"
          />

          {/* Project Selection */}
          <FormControl fullWidth>
            <InputLabel>Velg Prosjekt</InputLabel>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              label="Velg Prosjekt"
              disabled={isLoading}
            >
              {isLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Laster prosjekter...
                </MenuItem>
              ) : filteredProjects.length === 0 ? (
                <MenuItem disabled>
                  {searchQuery ? 'Ingen prosjekter funnet': 'Ingen prosjekter tilgjengelig'}
                </MenuItem>
              ) : (
                filteredProjects.map((project: Project) => (
                  <MenuItem key={project.id} value={project.id}>
                    <Box display="flex" alignItems="center" gap={1} width="100%">
                      <Folder fontSize="small" />
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight="medium">
                          {project.name}
                        </Typography>
                        {project.clientName && (
                          <Typography variant="caption" color="text.secondary">
                            Klient: {project.clientName}
                          </Typography>
                        )}
                      </Box>
                      {project.projectType && <Chip label={project.projectType} size="small" />}
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* Selected Project Details */}
          {selectedProject && (
            <Box
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'}}>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                Valgt Prosjekt: </Typography>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Navn: </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedProject.name}
                  </Typography>
                </Box>
                {selectedProject.clientName && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Klient: </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {selectedProject.clientName}
                    </Typography>
                  </Box>
                )}
                {selectedProject.projectType && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Type: </Typography>
                    <Chip label={selectedProject.projectType} size="small" />
                  </Box>
                )}
                {selectedProject.googleDriveFolderId && (
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Google Drive: </Typography>
                    <Chip label="Tilkoblet" size="small" color="success" icon={<CheckCircle />} />
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* Create New Project Option */}
          <Box
            sx={{
              p: 2,
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              textAlign: 'center'}}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Har du ikke et prosjekt ennå?
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => {
                // Navigate to project creation
                window.location.href ='/projects/new';
              }}
            >
              Opprett Nytt Prosjekt
            </Button>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={handleConnect}
          disabled={!selectedProjectId}
          startIcon={<LinkIcon />}
        >
          Koble til Prosjekt
        </Button>
      </DialogActions>
    </Dialog>
  );
}
