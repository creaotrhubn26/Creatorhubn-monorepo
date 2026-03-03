import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Folder,
  PhotoLibrary,
  VideoLibrary,
  LibraryMusic,
  Description,
  CloudUpload,
  Download,
  Share,
  Delete,
  Visibility,
  Edit,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { UniversalFileUpload } from '../universal/UniversalFileUpload';

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  category: 'raw' | 'edited' | 'final' | 'backup';
  uploadedAt: string;
  url: string
}

export default function ProjectFileManager() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  const [currentTab, setCurrentTab] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Database connection for ProjectFileManager
  const { data: projectFiles = [], isLoading } = useQuery({
    queryKey: ['/api/project-files/user-files', ],
    queryFn: () => apiRequest('/api/project-files/user-files', ),
    retry: false,
});

  const { data: storageStats } = useQuery({
    queryKey: ['/api/project-files/stats', ],
    queryFn: () => apiRequest('/api/project-files/stats', ),
    retry: false,
});

  // Mutation for updating project files
  const updateProjectFile = useMutation({
    mutationFn: async (fileData: any) => {
      return apiRequest('/api/project-files/update', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify(fileData)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-files', ],});
      setUploadDialogOpen(false);
  }
});

  const handleFilesSelected = (files: File[]) => {
    console.log('📁 Prosjektfiler valgt, :', files);
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Prosjekt fil opplasting fullført, :', results);
    queryClient.invalidateQueries({ queryKey: ['/api/project-files', ],});
};

  const tabs = [
    { label: 'Alle', value: 'all', icon: theming.getThemedIcon(',') },
    { label: 'Bilder', value: 'images', icon: theming.getThemedIcon(',') },
    { label: 'Videoer', value: 'videos', icon: theming.getThemedIcon(',') },
    { label: 'Lyd', value: 'audio', icon: theming.getThemedIcon(',') },
    { label: 'Dokumenter', value: 'documents', icon: <Description />,}
  ];

  const categories = [
    { key: 'all', label: 'Alle', color: '#2196f3' },
    { key: 'raw', label: 'RA', color: '#ff9800' },
    { key: 'edited', label: 'Redigert', color: '#4caf50' },
    { key: 'final', label: 'Final', color: '#9c27b0' },
    { key: 'backup', label: 'Backup', color: '#607d8b' }
  ];

  

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'video': return theming.getThemedIcon(', ');
      case 'image': return theming.getThemedIcon('photoLibrary');
      case 'audio': return theming.getThemedIcon('libraryMusic');
      case 'archive': 
      case 'document': return <Description />;
      default: return <Description />;
}
};

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB','GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
};

  const filteredFiles = mockFiles.filter(file => 
    selectedCategory === 'all' || file.category === selectedCategory
  );

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" gutterBottom sx={{  fontWeight: 'bold'  }}>
          Prosjekt Filbehandling
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Administrer alle prosjektfiler med avansert organisering og backup
        </Typography>
      </Box>

      {/* Storage stats */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
              <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb:  1 }}>
                {theming.getThemedIcon('folder')}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{storageStats?.totalFiles || filteredFiles.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Filer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
              <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb:  1 }}>
                {theming.getThemedIcon('cloudUpload')}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>3.7 GB</Typography>
              <Typography variant="body2" color="text.secondary">
                Brukt Lagring
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
              <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb:  1 }}>
                {theming.getThemedIcon('download')}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>156</Typography>
              <Typography variant="body2" color="text.secondary">
                Nedlastinger
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
              <Button variant="contained"
                fullWidth
                startIcon={theming.getThemedIcon('cloudUpload')}
                onClick={() => setUploadDialogOpen(true)}
                sx={{ height: '100%' }}
              >
                Last opp filer
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Category filter */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Kategori: </Typography>
        {categories.map((category) => (
          <Chip
            key={category.key}
            label={category.label}
            onClick={() => setSelectedCategory(category.key)}
            variant={selectedCategory === category.key ? 'filled' : 'outlined'}
            sx={{ 
              mr: 1, mb:  1,
              bgcolor: selectedCategory === category.key ? category.color : 'transparent',
              color: selectedCategory === category.key ? 'white' : category.color,
              borderColor: category.color
        }}
          />
        ))}
      </Box>

      {/* File type tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          {tabs.map((tab, index) => (
            <Tab 
              key={tab.value}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {/* Files list */}
      <Card sx={theming.getThemedCardSx()}>
        <List>
          {filteredFiles.map((file) => (
            <ListItem key={file.id} divider>
              <ListItemIcon>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {getFileIcon(file.type)}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={file.name}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {formatFileSize(file.size)} • Opplastet {file.uploadedAt}
                    </Typography>
                    <Chip 
                      label={categories.find(c => c.key === file.category)?.label || file.category}
                      size="small"
                      sx={{ 
                        mt: 0.5,
                        bgcolor: categories.find(c => c.key === file.category)?.color || '#grey',
                        color: 'white'
                  }}
                    />
                  </Box>
              }
              />
              <ListItemSecondaryAction>
                <IconButton size="small" sx={{ mr:  1 }}>
                  {theming.getThemedIcon('visibility')}
                </IconButton>
                <IconButton size="small" sx={{ mr:  1 }}>
                  {theming.getThemedIcon('download')}
                </IconButton>
                <IconButton size="small" sx={{ mr:  1 }}>
                  {theming.getThemedIcon('share')}
                </IconButton>
                <IconButton size="small">
                  {theming.getThemedIcon('delete')}
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Card>

      {/* Upload dialog */}
      {uploadDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top:  0,
            left:  0,
            right:  0,
            bottom:  0,
            bgcolor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300}}
        >
          <Card sx={{ maxWidth: 70, width: '90, %', maxHeight: '80vh', overflow: 'auto' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Last opp prosjektfiler</Typography>
                <IconButton onClick={() => setUploadDialogOpen(false)}>
                  ×
                </IconButton>
              </Box>
              
              <UniversalFileUpload
                onFilesSelected={handleFilesSelected}
                onUploadComplete={handleUploadComplete}
                allowedTypes="all"
                maxFiles={50}
                maxFileSizeMB={2000}
                showFormatInfo={true}
                uploadEndpoint="/api/project-files/upload"
                profession="photographer"
                enableBackgroundUpload={true}
                maxRetries={3}
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mt:  2 }}>
                Støtter alle filtyper: RAW-bilder, videoer, lydfiler, dokumenter, arkiver og mer.
                Automatisk kategorisering og organisering.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}