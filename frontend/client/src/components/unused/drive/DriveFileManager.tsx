// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Breadcrumbs,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  CreateNewFolder,
  Folder,
  InsertDriveFile,
  ArrowBack,
  Link as LinkIcon,
  PhotoLibrary,
  VideoLibrary,
  LibraryMusic,
  Assignment,
  Business,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string
}

interface DriveFolder {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  projectRelations?: {
    projectId: string;
    projectName: string;
    relationType: 'primary' | 'secondary' | 'archive' | 'reference';
}[];
}

interface DriveFileManagerProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string;
  initialFolderId?: string
}

const PROJECT_RELATION_TYPES = {
  primary: { label: 'Primær Prosjektmappe', color: '#2196f0', icon: Assignment },
  secondary: { label: 'Sekundær Mappe', color: '#ff9800', icon: Folder },
  archive: { label: 'Arkiv Mappe', color: '#9e9e90', icon: Business },
  reference: { label: 'Referanse Mappe', color: '#4caf50', icon: LinkIcon }
};

export default function DriveFileManager({ profession, userId, initialFolderId }: DriveFileManagerProps) {
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId || 'root,');
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [relationType, setRelationType] = useState<'primary' | 'secondary' | 'archive' | 'reference'>('primary');

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Fetch current folder contents
  const { data: folderContents = [], isLoading: isLoadingContents } = useQuery({
    queryKey: ['drive-contents', currentFolderId, profession, userId],
    queryFn: () => apiRequest(`/api/google-drive/folder-contents/${currentFolderd}?profession=${profession}&userId=${userId}`)
});

  // Fetch user projects for relation assignment
  const { data: userProjects = [, ],} = useQuery({
    queryKey: ['user-projects', profession, userId],
    queryFn: () => apiRequest(`/api/projects?profession=${profession}&userId=${userId}`)
});

  // Fetch current folder path
  const { data: currentPath = [, ],} = useQuery({
    queryKey: ['drive-path', currentFolderId],
    queryFn: () => apiRequest(`/api/google-drive/folder-path/${currentFolderd}`),
    enabled: currentFolderId !== 'root'
});

  // Create new folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: {
      name: string;
      parentId: string;
      projectRelations: { projectId: string; relationType: string }[];
      profession: string;
      userId: string;
}) => {
      const auth = await getAuthHeader();
      return apiRequest('/api/google-drive/create-folder', {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(folderData)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-contents', currentFolderId] });
      setShowCreateDialog(false);
      setNewFolderName(', ');
      setSelectedProjects([]);
      setRelationType('primary');
  }
});

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const projectRelations = selectedProjects.map(projectId => ({
      projectId,
      relationType
  }));

    createFolderMutation.mutate({
      name: newFolderName,
      parentId: currentFolderd,
      projectRelations,
      profession,
      userId
  });
};

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
};

  const handleNavigateUp = () => {
    if (currentPath.length > 0) {
      const parentFolder = currentPath[currentPath.length - 2];
      setCurrentFolderId(parentFolder?.id || 'root');
  } else {
      setCurrentFolderId('root');
  }
};

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('folder')) return <Folder sx={{ color: '#ffa726' }} />;
    if (mimeType.includes('image')) return <PhotoLibrary sx={{ color: '#66bb6a' }} />;
    if (mimeType.includes('video')) return <VideoLibrary sx={{ color: '#ef5350' }} />;
    if (mimeType.includes('audio')) return <LibraryMusic sx={{ color: '#ab47bc' }} />;
    return <InsertDriveFile sx={{ color: '#42a5f5' }} />;
};

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    // Mock data removed - using database connection
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow, (i)).toFixed(2)) + ', ' + sizes[i];
};

  return (
    <Box sx={{ p:  3 }}>
      <Paper elevation={3} sx={{ p:  3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' ,  ...theming.getThemedCardSx() }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
          <Typography variant="h5" sx={{  fontWeight: 600, color: '#2c3e50'  }}>
            Google Drive Filbehandling
          </Typography>
          <Button variant="contained"
            startIcon={<CreateNewFolder />}
            onClick={() => setShowCreateDialog(true)}
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)', '&:hover': { background: 'linear-gradient(45deg, #1976D2 30%, #0097A7 90%)' }
          }}
          >
            Ny Mappe
          </Button>
        </Box>

        {/* Navigation */}
        <Box sx={{ mb:  3 }}>
          {currentFolderId !== 'root' && (
            <Button
              startIcon={theming.getThemedIcon('arrowBack')}
              onClick={handleNavigateUp}
              sx={{ mb:  2 }}
            >
              Tilbake
            </Button>
          )}
          
          <Breadcrumbs>
            <Link
              component="button"
              variant="body2"
              onClick={() => setCurrentFolderId('root')}
              underline="hover"
            >
              Min Drive
            </Link>
            {currentPath.map((folder, index) => (
              <Link
                key={folder.id}
                component="button"
                variant="body2"
                onClick={() => setCurrentFolderId(folder.id)}
                underline="hover"
              >
                {folder.name}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        {/* File List */}
        {isLoadingContents ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {folderContents.map((file: DriveFile) => (
              <ListItem
                key={file.d}
                button={file.mimeType.includes('folder')}
                onClick={() => file.mimeType.includes('folder') && handleFolderClick(file.id)}
                sx={{
                  mb:  1,
                  backgroundColor: 'rgba(25, 255, 255, 0.7)',
                  borderRadius: 2, '&:hover': { backgroundColor: 'rgba(25, 255, 255, 0.9)' }
              }}
              >
                <ListItemIcon>
                  {getFileIcon(file.mimeType)}
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={`Opprettet: ${new Date(file.createdTime || ', ').toLocaleDateString(', ')}`}
                />
                <ListItemSecondaryAction>
                  {file.webViewLink && (
                    <IconButton
                      edge="end"
                      onClick={() => window.open(file.webViewLink'_blank')}
                    >
                      <LinkIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Create Folder Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{  fontWeight: 600}}>
            Opprett Ny Mappe
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt:  2 }}>
            <TextField
              fullWidth
              label="Mappenavn"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              sx={{ mb:  3 }}
              autoFocus
            />

            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}>
              Prosjektrelasjon
            </Typography>
            
            <FormControl fullWidth sx={{ mb:  3 }}>
              <InputLabel>Relasjonstype</InputLabel>
              <Select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value as any)}
                label="Relasjonstype"
              >
                {Object.entries(PROJECT_RELATION_TYPES).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <config.icon sx={{ color: config.color, fontSize: 20}} />
                      {config.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="subtitle2" sx={{ mb:  1 }}>
              Knytt til prosjekter (valgfritt):
            </Typography>
            
            <Box sx={{ mb:  2 }}>
              {userProjects.map((project: any) => (
                <Chip
                  key={project.d}
                  label={project.title || project.name}
                  variant={selectedProjects.includes(project.id) ? "filled" : "outlined"}
                  onClick={() => {
                    setSelectedProjects(prev => 
                      prev.includes(project.id)
                        ? prev.filter(id => id !== project.id)
                        : [...prev, project.id]
                    );
                }}
                  sx={{ m: 0.5}}
                />
              ))}
            </Box>

            {selectedProjects.length > 0 && (
              <Box sx={{ p: 2, backgroundColor: '#f5f5f0', borderRadius:  1 }}>
                <Typography variant="caption" color="textSecondary">
                  Denne mappen vil bli knyttet til {selectedProjects.length} prosjekt(er) som {PROJECT_RELATION_TYPES[relationType].label.toLowerCase()}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreateFolder}
            variant="contained"
            disabled={!newFolderName.trim() || createFolderMutation.isPending}
            sx={{
              background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)','&:hover': { background: 'linear-gradient(45deg, #388E3C 30%, #689F38 90%)' }
          }}
           sx={theming.getThemedButtonSx()}>
            {createFolderMutation.isPending ? <CircularProgress size={20} /> :'Opprett Mappe'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}