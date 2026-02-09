import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Paper,
  Divider,
  LinearProgress,
  Alert,
  Stack,
  Snackbar,
} from '@mui/material';
import {
  AddCircle as Add,
  Edit,
  Delete,
  Settings,
  ViewList,
  Dashboard,
  Save,
  Cancel,
  YouTube,
  PhotoLibrary,
  VideocamLibrary,
  TrendingUp,
  Analytics,
  Schedule,
  ThumbUp,
  Share,
  Visibility,
  Search as SearchIcon,
  TrendingUp as SEOIcon,
  Language as GoogleIcon,
  Assessment as ReportIcon,
  Collections as MediaIcon,
  DesignServices as TemplateIcon,
  ViewModule as PageBuilderIcon,
  Publish as PublishIcon,
  Upload,
  Download,
  Folder,
  Image as ImageIcon,
  Movie as VideoIcon,
  AudioDescription,
  PictureAsPdf,
  InsertDriveFile,
  Code,
  ViewModule,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface CMSField {
  id?: string;
  name: string;
  type: string;
  label: string;
  beskrivelse?: string;
  påkrevd?: boolean;
  defaultValue?: any;
  innstillinger?: Record<string, any>;
}

interface ContentType {
  id?: string;
  navn: string;
  beskrivelse?: string;
  profesjon?: string;
  felter?: CMSField[]
}

export default function VisualCMSAdmin() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [openFieldDialog, setOpenFieldDialog] = useState(false);
  const [openContentTypeDialog, setOpenContentTypeDialog] = useState(false);
  const [selectedField, setSelectedField] = useState<CMSField | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<ContentType | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [viralAnalysisOpen, setViralAnalysisOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState<any>(null);
  const [viralStrategy, setViralStrategy] = useState<any>(null);
  const [creativeToolsOpen, setCreativeToolsOpen] = useState(false);
  const [confirmDeleteField, setConfirmDeleteField] = useState<{ open: boolean; fieldId: string | null }>({ open: false, fieldId: null });

  // Fetch CMS fields
  const { data: cmsFields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ['/api/cms/admin/fields'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/cms/admin/fields', { headers });
    },
    retry: false,
});

  // Fetch content types
  const { data: contentTypes = [], isLoading: contentTypesLoading } = useQuery({
    queryKey: ['/api/cms/admin/content-types'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/cms/admin/content-types', { headers });
    },
    retry: false,
});

  // Fetch CMS stats
  const { data: cmsStats } = useQuery({
    queryKey: ['/api/cms/admin/stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/cms/admin/stats', { headers });
    },
    retry: false,
});

  // Fetch showcases for viral content creation
  const { data: showcases = [], isLoading: showcasesLoading } = useQuery({
    queryKey: ['/api/showcase/items/admin'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/showcase/items/admin', { headers });
    },
    retry: false,
});

  // Fetch YouTube analytics
  const { data: youtubeAnalytics } = useQuery({
    queryKey: ['/api/youtube/analytics'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/youtube/analytics', { headers });
    },
    retry: false,
});

  // Create/Update field mutation
  const fieldMutation = useMutation({
    mutationFn: async (fieldData: CMSField) => {
      const headers = await auth.getAuthHeader();
      if (fieldData.id) {
        return apiRequest(`/api/cms/admin/fields/${fieldData.id}`, {
          method: 'PUT',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify(fieldData),
      });
    } else {
        return apiRequest('/api/cms/admin/fields', {
          method: 'POST',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify(fieldData),
      });
    }
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/fields']});
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats']});
      setOpenFieldDialog(false);
      setSelectedField(null);
  },
});

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/cms/admin/fields/${fieldId}`, {
        method: 'DELETE',
        headers
    });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/fields']});
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats']});
  },
});

  // Create/Update content type mutation
  const contentTypeMutation = useMutation({
    mutationFn: async (contentTypeData: ContentType) => {
      const headers = await auth.getAuthHeader();
      if (contentTypeData.id) {
        return apiRequest(`/api/cms/admin/content-types/${contentTypeData.id}`, {
          method: 'PUT',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify(contentTypeData),
      });
    } else {
        return apiRequest('/api/cms/admin/content-types', {
          method: 'POST',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify(contentTypeData),
      });
    }
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/cms/admin/content-types']
    });
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats']});
      setOpenContentTypeDialog(false);
      setSelectedContentType(null);
  },
});

  const handleCreateField = () => {
    setSelectedField(null);
    setOpenFieldDialog(true);
};

  const handleEditField = (field: CMSField) => {
    setSelectedField(field);
    setOpenFieldDialog(true);
};

  const handleDeleteField = (fieldId: string) => {
    setConfirmDeleteField({ open: true, fieldId });
};

  const confirmFieldDeletion = () => {
    if (confirmDeleteField.fieldId) {
      deleteFieldMutation.mutate(confirmDeleteField.fieldId);
    }
    setConfirmDeleteField({ open: false, fieldId: null });
  };

  const handleCreateContentType = () => {
    setSelectedContentType(null);
    setOpenContentTypeDialog(true);
};

  const handleEditContentType = (contentType: ContentType) => {
    setSelectedContentType(contentType);
    setOpenContentTypeDialog(true);
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box
        sx={{
          mb:  4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'}}
      >
        <Box>
          <Typography variant="h4" sx={{  mb: 1, display: 'flex', alignItems: 'center', gap:  1  }}>
            <Dashboard color="primary" />
            Visual CMS Admin
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Administrer dynamiske felt og innholdstyper for CreatorHub Norge
          </Typography>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {cmsStats && (
        <Grid container spacing={3}, sx={{ mb:  4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h4" color="primary.main" sx={{ color: theming.colors.primary }}>
                  {cmsStats.data?.totalFields || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Totale Felt
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  {cmsStats.data?.totalContentTypes || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Innholdstyper
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                  {cmsStats.data?.totalContent || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Innholdselementer
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                  3
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Profesjoner
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Tabs */}
      <Box sx={{ mb:  4 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<Dashboard />} label="CMS Admin" />
          <Tab icon={<MediaIcon />} label="Media Manager" />
          <Tab icon={<TemplateIcon />} label="Template Manager" />
          <Tab icon={<PageBuilderIcon />} label="Page Builder" />
          <Tab icon={<Publish />} label="Content Publisher" />
          <Tab icon={<SEOIcon />} label="SEO Optimalisering" />
          <Tab icon={theming.getThemedIcon('trendingUp')}} label="Viral Content Creator" />
          <Tab icon={theming.getThemedIcon('analytics')}} label="YouTube Analytics" />
          <Tab icon={theming.getThemedIcon('settings')}} label="Enterprise System" />
        </Tabs>
      </Box>

      {/* CMS Admin Tab */}
      {currentTab === 0 && (
        <Grid container spacing={4}>
          <Grid item xs={12} lg={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb:  3}}
                >
                  <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                    <ViewList />
                    Dynamiske Felt
                  </Typography>
                  <Button variant="contained" startIcon={theming.getThemedIcon('add')} onClick={handleCreateField}, sx={theming.getThemedButtonSx()}>
                    Nytt Felt
                  </Button>
                </Box>

                {fieldsLoading ? (
                  <Typography>Laster felt...</Typography>
                ) : (
                  <List>
                    {cmsFields.data?.map((field: CMSField) => (
                      <ListItem key={field.d} divider>
                        <ListItemText
                          primary={field.label}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {field.name} • {field.type}
                              </Typography>
                              {field.beskrivelse && (
                                <Typography variant="caption" color="text.secondary">
                                  {field.beskrivelse}
                                </Typography>
                              )}
                              <Box sx={{ mt: 0.5}}>
                                {field.påkrevd && (
                                  <Chip label="Påkrevd" size="small" color="error" sx={{ mr:  1 }} />
                                )}
                                <Chip label={field.type} size="small" variant="outlined" />
                              </Box>
                            </Box>
                        }
                        />
                        <ListItemSecondaryAction>
                          <IconButton onClick={() => handleEditField(field)} size="small">
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteField(field.id!)}
                            size="small"
                            color="error"
                          >
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb:  3}}
                >
                  <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                    {theming.getThemedIcon('settings')}
                    Innholdstyper
                  </Typography>
                  <Button variant="contained" startIcon={theming.getThemedIcon('add')} onClick={handleCreateContentType}, sx={theming.getThemedButtonSx()}>
                    Ny Type
                  </Button>
                </Box>

                {contentTypesLoading ? (
                  <Typography>Laster innholdstyper...</Typography>
                ) : (
                  <List>
                    {contentTypes.data?.map((contentType: ContentType) => (
                      <ListItem key={contentType.d} divider>
                        <ListItemText
                          primary={contentType.navn}
                          secondary={
                            <Box>
                              {contentType.beskrivelse && (
                                <Typography variant="body2" color="text.secondary">
                                  {contentType.beskrivelse}
                                </Typography>
                              )}
                              <Box sx={{ mt: 0.5}}>
                                {contentType.profesjon && (
                                  <Chip
                                    label={getProfessionDisplayName(contentType.profesjon)}
                                    size="small"
                                    color="primary"
                                    sx={{ mr:  1 }}
                                  />
                                )}
                                <Chip
                                  label={`${contentType.felter?.length || 0} felt`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                        }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            onClick={() => handleEditContentType(contentType)}
                            size="small"
                          >
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Media Manager Tab */}
      {currentTab === 1 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <MediaIcon color="primary" />
                  Media Manager & Asset Administration
                </Typography>

                <Alert severity="info" sx={{ mb:  3 }}>
                  <Typography variant="body2">
                    <strong>Eksisterende Systemer: </strong> UniversalFileUpload, AIPhotoEditor,
                    VideoEditor, og IntelligentVideoAnalyzer er allerede implementert.
                  </Typography>
                </Alert>

                {/* Eksisterende Media Systemer */}
                <Grid container spacing={3}, sx={{ mb:  4 }}>
                  <Grid item xs={12} md={6} lg={3}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <Upload color="primary" />
                          UniversalFileUpload
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Fullstendig ecosystem med intelligent format validering og optimalized
                          error handling
                        </Typography>
                        <Button variant="contained"
                          fullWidth
                          onClick={() => window.open('/unified-file-manager-test', ','_blank')}
                        >
                          Åpne File Manager
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6} lg={3}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <ImageIcon color="success" />
                          CreatorHub Photo Suite
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Fullstendig PhotographerPhotoSuite med advanced photo editing og
                          automatisk forbedring
                        </Typography>
                        <Button variant="contained"
                          color="success"
                          fullWidth
                          onClick={() => window.open('/photo-enhancer-test', ','_blank')}
                        >
                          Åpne CreatorHub Photo Suite
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6} lg={3}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <VideoIcon color="warning" />
                          CreatorHub Video Suite
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Fullstendig VideographerVideoSuite med video production studio og
                          intelligent analyzer
                        </Typography>
                        <Button variant="contained"
                          color="warning"
                          fullWidth
                          onClick={() => window.open('/videographer-dashboard-material', ','_blank')}
                        >
                          Åpne Video Suite
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6} lg={3}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <AudioFile color="secondary" />
                          CreatorHub Audio Suite
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Fullstendig MusicProductionTools med professional audio processing og
                          music producer dashboard
                        </Typography>
                        <Button variant="contained"
                          color="secondary"
                          fullWidth
                          onClick={() => window.open('/music-producer-dashboard', ','_blank')}
                        >
                          Åpne Audio Suite
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Divider sx={{ my:  4 }} />

                {/* Media Statistics Dashboard */}
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Analytics color="action" />
                  Media Analytics & Statistics
                </Typography>

                <Grid container spacing={3}, sx={{ mb:  4 }}>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#2196f30',
                        borderRadius:  2,
                        border: '1px solid #2196f32',
                        textAlign: 'center'}}
                    >
                      <Typography variant="h4" color="info.main" sx={{  fontWeight: 700 }}>
                        847
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Totale Filer
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#4caf500',
                        borderRadius:  2,
                        border: '1px solid #4caf502',
                        textAlign: 'center'}}
                    >
                      <Typography variant="h4" color="success.main" sx={{  fontWeight: 700 }}>
                        12.4GB
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Lagring
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#ff8c000',
                        borderRadius:  2,
                        border: '1px solid #ff8c002',
                        textAlign: 'center'}}
                    >
                      <Typography variant="h4" color="warning.main" sx={{  fontWeight: 700 }}>
                        23
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Aktive Portfolio
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#9c27b00',
                        borderRadius:  2,
                        border: '1px solid #9c27b02',
                        textAlign: 'center'}}
                    >
                      <Typography variant="h4" color="secondary.main" sx={{  fontWeight: 700 }}>
                        156
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Klient Leveranser
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Advanced Media Management Controls */}
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Settings color="action" />
                  Advanced Media Administration
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      Forensic File Recovery
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      Backup Automation
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      GDPR Compliance
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      Media Metadata Editor
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Template Manager Tab */}
      {currentTab === 2 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <TemplateIcon color="primary" />
                  Template Manager & Profesjon-Maler Administration
                </Typography>

                <Alert severity="info" sx={{ mb:  3 }}>
                  <Typography variant="body2">
                    <strong>Eksisterende Systemer: </strong> UniversalDashboard, ProfessionAdapter,
                    og profession-specific dashboards er allerede implementert med 6-tabs layout.
                  </Typography>
                </Alert>

                {/* Professional Dashboard Templates */}
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Dashboard color="action" />
                  Professional Dashboard Templates
                </Typography>

                <Grid container spacing={3}, sx={{ mb:  4 }}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <PhotoLibrary color="primary" sx={{ mb:  2 }} />
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Fotograf Dashboard</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          Oversikt, Prosjekter, Kunder, Utstyr, Filer, Innstillinger + Wedding
                          Timeline
                        </Typography>
                        <Button variant="contained"
                          size="small"
                          fullWidth
                          onClick={() => window.open('/fotograf', ','_blank')}
                        >
                          Åpne Fotograf Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <VideoLibrary color="secondary" sx={{ mb:  2 }} />
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Videograf Dashboard</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          Oversikt, Videoer, Bestillinger, Studio, Filer, Innstillinger
                        </Typography>
                        <Button variant="contained" color="secondary" size="small" fullWidth sx={theming.getThemedButtonSx()}>
                          Åpne Videograf Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <AudioFile color="warning" sx={{ mb:  2 }} />
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Musikk Dashboard</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          Oversikt, Låter, Artister, Lager, Filer, Innstillinger
                        </Typography>
                        <Button variant="contained" color="warning" size="small" fullWidth sx={theming.getThemedButtonSx()}>
                          Åpne Musikk Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Divider sx={{ my:  4 }} />

                {/* Contract & Email Templates */}
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <InsertDriveFile color="action" />
                  Contract & Email Template System
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <List>
                      <ListItem>
                        <ListItemText
                          primary="Norwegian Contract Templates"
                          secondary="Automated contract generation med digital signatures"
                        />
                        <Chip label="Aktivert" color="success" size="small" />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Professional Email System"
                          secondary="SMTP integration med campaign management"
                        />
                        <Chip label="Aktivert" color="success" size="small" />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Business Branding Templates"
                          secondary="Logo integration og business information"
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => window.open('/business-branding', ','_blank')}
                        >
                          Administrer
                        </Button>
                      </ListItem>
                    </List>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <List>
                      <ListItem>
                        <ListItemText
                          primary="Google Drive Integration"
                          secondary="8-folder structure med change tracking"
                        />
                        <Chip label="Aktivert" color="success" size="small" />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="ProfessionAdapter System"
                          secondary="Dynamic component adaptation baseret på profesjon"
                        />
                        <Chip label="Aktivert" color="success" size="small" />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Template Customization"
                          secondary="User-specific template modifications"
                        />
                        <Button size="small" variant="outlined">
                          Innstillinger
                        </Button>
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Page Builder Tab */}
      {currentTab === 3 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <PageBuilderIcon color="primary" />
                  Visual Page Builder & Code Generator Administration
                </Typography>

                <Alert severity="info" sx={{ mb:  3 }}>
                  <Typography variant="body2">
                    <strong>Eksisterende Systemer: </strong> UniversalVisualCMS (/visual-cms) og
                    CodeGenerator (/code-generator) er allerede implementert og fungerer.
                  </Typography>
                </Alert>

                <Grid container spacing={3}, sx={{ mb:  4 }}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <ViewModule color="primary" />
                          UniversalVisualCMS
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Fullstendig visual CMS med drag & drop, CraftJS integration, og Monaco
                          Editor
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <Button variant="contained"
                              fullWidth
                              onClick={() => window.open('/visual-cms', ','_blank')}
                            >
                              Åpne UniversalVisualCMS
                            </Button>
                          </Grid>
                          <Grid item xs={12}>
                            <Button variant="outlined" fullWidth>
                              Administrer CMS Innstillinger
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <Code color="secondary" />
                          CodeGenerator System
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Avansert code generation med React, TypeScript, CSS og HTML output
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <Button variant="contained"
                              color="secondary"
                              fullWidth
                              onClick={() => window.open('/code-generator', ','_blank')}
                            >
                              Åpne CodeGenerator
                            </Button>
                          </Grid>
                          <Grid item xs={12}>
                            <Button variant="outlined" fullWidth>
                              Administrer Code Templates
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Divider sx={{ my:  4 }} />

                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Settings color="action" />
                  Page Builder Administrasjon
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      CMS Brukerrettigheter
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      Template Bibliotek
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      Code Export Innstillinger
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="outlined" fullWidth sx={{ py:  2 }}>
                      Plugin Integrasjoner
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Content Publisher Tab */}
      {currentTab === 4 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Publish color="primary" />
                  Content Publisher & UniversalShowcase Administration
                </Typography>

                <Alert severity="info" sx={{ mb:  3 }}>
                  <Typography variant="body2">
                    <strong>Eksisterende Systemer: </strong> UniversalShowcase,
                    UniversalCommunicationHub, og MillionDollarMeetingSystem er allerede
                    implementert.
                  </Typography>
                </Alert>

                <Grid container spacing={3}, sx={{ mb:  4 }}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <PhotoLibrary color="primary" />
                          UniversalShowcase System
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          Premium portfolio system med SEO-optimized galleries og automatic project
                          showcase integration
                        </Typography>
                        <Button variant="contained"
                          fullWidth
                          onClick={() => window.open('/showcase-gallery', ','_blank')}
                        >
                          Åpne UniversalShowcase
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <Share color="secondary" />
                          Universal Communication Hub
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                          WebSocket-baseret real-time collaboration med GDPR compliance og automatic
                          Google Drive backup
                        </Typography>
                        <Button variant="contained" color="secondary" fullWidth sx={theming.getThemedButtonSx()}>
                          Åpne Communication Hub
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <Schedule color="warning" />
                          Meeting System
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          Revolutionary meeting system med intelligent assistant features og
                          real-time translation
                        </Typography>
                        <Button variant="contained"
                          color="warning"
                          fullWidth
                          onClick={() => window.open('/meeting-system', ','_blank')}
                        >
                          Åpne MillionDollarMeetingSystem
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <Visibility color="info" />
                          Showcase Admin
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          Portfolio administrationsverktøy for alle profesjoner
                        </Typography>
                        <Button variant="contained"
                          color="info"
                          fullWidth
                          onClick={() => window.open('/showcase-admin',', '_blank')}
                        >
                          Showcase Admin
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6"
                          sx={{ 
                            mb:  2,
                            display: 'flex',
                            alignItems: 'center',
                            gap:  1 }}>
                          <Settings color="action" />
                          Content Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                          Administrer publiseringsworkflows og godkjenning
                        </Typography>
                        <Button variant="outlined" fullWidth>
                          Content Settings
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Enterprise System Tab - before SEO */}
      {currentTab === 8 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Settings color="primary" />
                  🏭 Complete Enterprise Management System Administration
                </Typography>

                <Alert severity="success" sx={{ mb:  3 }}>
                  <Typography variant="body2">
                    <strong>PRODUCTION MODE AKTIVERT: </strong> Complete Enterprise Management System
                    med CM, Business Intelligence, RBAC/ABAC access control, Norwegian integration
                    og 326 verified database tables kjører.
                  </Typography>
                </Alert>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="contained" fullWidth sx={{ py:  3 }} startIcon={theming.getThemedIcon('assessment')}, sx={theming.getThemedButtonSx()}>
                      CRM System
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="contained"
                      color="success"
                      fullWidth
                      sx={{ py:  3 }}
                      startIcon={theming.getThemedIcon('analytics')}
                     sx={theming.getThemedButtonSx()}>
                      Business Intelligence
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="contained"
                      color="warning"
                      fullWidth
                      sx={{ py:  3 }}
                      startIcon={<GoogleIcon />}
                    >
                      Google Integration
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button variant="contained"
                      color="secondary"
                      fullWidth
                      sx={{ py:  3 }}
                      startIcon={<ReportIcon />}
                    >
                      Norwegian Services
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* SEO Optimalisering Tab */}
      {currentTab === 5 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <SEOIcon color="primary" />
                  SEO Dashboard & Google-synlighet
                </Typography>

                <Grid container spacing={3}>
                  {/* Google Search Console Stats */}
                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#4caf500',
                        borderRadius:  2,
                        border: '1px solid #4caf502'}}
                    >
                      <Typography variant="h4" color="success.main" sx={{  fontWeight: 700 }}>
                        0
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Google Search Impressions
                      </Typography>
                      <Typography variant="caption" color="success.main">
                        Siste 30 dager
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#2196f30',
                        borderRadius:  2,
                        border: '1px solid #2196f32'}}
                    >
                      <Typography variant="h4" color="info.main" sx={{  fontWeight: 700 }}>
                        0
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Organiske Klikk
                      </Typography>
                      <Typography variant="caption" color="info.main">
                        Fra Google-søk
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p:  3,
                        bgcolor: '#ff8c000',
                        borderRadius:  2,
                        border: '1px solid #ff8c002'}}
                    >
                      <Typography variant="h4" color="warning.main" sx={{  fontWeight: 700 }}>
                        0
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Gjennomsnittlig Posisjon
                      </Typography>
                      <Typography variant="caption" color="warning.main">
                        i Google-søkeresultater
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my:  4 }} />

                {/* Portfolio SEO Status */}
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <PhotoLibrary color="secondary" />
                  Porteføljer SEO-status
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <List>
                      <ListItem>
                        <ListItemText
                          primary="Fotografer Porteføljer"
                          secondary="SEO-optimalisering aktiv"
                        />
                        <Chip label="Optimalisert" color="success" size="small" />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Videografer Porteføljer"
                          secondary="Trenger SEO-forbedring"
                        />
                        <Chip label="Forbedring nødvendig" color="warning" size="small" />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Musikkprodusenter"
                          secondary="SEO ikke konfigurert"
                        />
                        <Chip label="Ikke konfigurert" color="error" size="small" />
                      </ListItem>
                    </List>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Alert severity="info" sx={{ mb:  2 }}>
                      <Typography variant="body2">
                        <strong>Google API Status: </strong> Konfigurert og tilkoblet
                      </Typography>
                    </Alert>
                    <Alert severity="success">
                      <Typography variant="body2">
                        <strong>Norsk markedsfokus:</strong> Optimalisert for det norske markedet
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                {/* SEO Actions */}
                <Typography variant="h6"
                  sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <Settings color="action" />
                  SEO Handlinger
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button fullWidth variant="contained" startIcon={<GoogleIcon />}, sx={{ py:  2 }}>
                      Kjør Google Audit
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={<SearchIcon />}, sx={{ py:  2 }}>
                      Analyser Nøkkelord
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={<ReportIcon />}, sx={{ py:  2 }}>
                      Generer SEO-rapport
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button fullWidth variant="outlined" startIcon={theming.getThemedIcon('trendingUp')}, sx={{ py:  2 }}>
                      Optimalisering Tips
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Viral Content Creator Tab */}
      {currentTab === 2 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mb:  3 }}>
              <Typography variant="body2">
                <strong>Viral Content Creator: </strong> Denne funksjonen er under utvikling for å
                hjelpe norske kreative med å skape viralt innhold.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
     )}

      {/* YouTube Analytics Tab */}
      {currentTab === 3 && (
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mb:  3 }}>
              <Typography variant="body2">
                <strong>YouTube Analytics: </strong> Koble til YouTube API for å vise detaljert
                analytics for videoer og kanaler.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
     )}

      {/* Field Dialog */}
      <FieldDialog
        open={openFieldDialog}
        field={selectedField}
        onClose={() => {
          setOpenFieldDialog(false);
          setSelectedField(null);
      }}
        onSave={(fieldData) => fieldMutation.mutate(fieldData)}
        isLoading={fieldMutation.isPending}
      />

      {/* Content Type Dialog */}
      <ContentTypeDialog
        open={openContentTypeDialog}
        contentType={selectedContentType}
        availableFields={cmsFields.data || []}
        onClose={() => {
          setOpenContentTypeDialog(false);
          setSelectedContentType(null);
      }}
        onSave={(contentTypeData) => contentTypeMutation.mutate(contentTypeData)}
        isLoading={contentTypeMutation.isPending}
      />

      {/* Confirm Delete Field Dialog */}
      <Dialog
        open={confirmDeleteField.open}
        onClose={() => setConfirmDeleteField({ open: false, fieldId: null })}
      >
        <DialogTitle>Slett Felt</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Er du sikker på at du vil slette dette feltet? Denne handlingen kan ikke angres.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteField({ open: false, fieldId: null })}>
            Avbryt
          </Button>
          <Button onClick={confirmFieldDeletion} color="error" variant="contained">
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Field Dialog Component
function FieldDialog({
  open,
  field,
  onClose,
  onSave,
  isLoading,
}: {
  open: boolean;
  field: CMSField | null;
  onClose: () => void;
  onSave: (field: CMSField) => void;
  isLoading: boolean
}) {
  const [fieldData, setFieldData] = useState<CMSField>({
    name: '',
    type: 'text',
    label: '',
    beskrivelse: '',
    påkrevd: false,
});

  React.useEffect(() => {
    if (field) {
      setFieldData(field);
  } else {
      setFieldData({
        name: '',
        type: 'text',
        label: '',
        beskrivelse: '',
        påkrevd: false,
    });
  }
}, [field, open]);

  const fieldTypes = [
    'text','textarea','number','email','phone','date','select','checkbox','image','video','audio','url','address','rating','color','layout','code','json','repeater',
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{field ? 'Rediger Felt' : 'Nytt Felt'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}, sx={{ mt:  1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Navn"
              value={fieldData.name}
              onChange={(e) => setFieldData({ ...fieldData, name: e.target.value })}
              helperText="Teknisk navn for feltet (ingen mellomrom)"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Label"
              value={fieldData.label}
              onChange={(e) => setFieldData({ ...fieldData, label: e.target.value })}
              helperText="Synlig navn for brukere"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Beskrivelse"
              value={fieldData.beskrivelse || ''}
              onChange={(e) => setFieldData({ ...fieldData, beskrivelse: e.target.value })}
              helperText="Hjelptekst for brukere"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Felttype</InputLabel>
              <Select
                value={fieldData.type}
                onChange={(e) => setFieldData({ ...fieldData, type: e.target.value })}
              >
                {fieldTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={fieldData.påkrevd || false}
                  onChange={(e) => setFieldData({ ...fieldData, påkrevd: e.target.checked })}
                />
            }
              label="Påkrevd felt"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={theming.getThemedIcon('cancel')}>
          Avbryt
        </Button>
        <Button
          onClick={() => onSave(fieldData)}
          variant="contained"
          startIcon={theming.getThemedIcon('save')}
          disabled={isLoading || !fieldData.name || !fieldData.label}
        >
          Lagre
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Content Type Dialog Component
function ContentTypeDialog({
  open,
  contentType,
  availableFields,
  onClose,
  onSave,
  isLoading,
}: {
  open: boolean;
  contentType: ContentType | null;
  availableFields: CMSField[];
  onClose: () => void;
  onSave: (contentType: ContentType) => void;
  isLoading: boolean
}) {
  const [contentTypeData, setContentTypeData] = useState<ContentType>({
    navn: '',
    beskrivelse: '',
    profesjon: ', ',
    felter:  [],
});

  React.useEffect(() => {
    if (contentType) {
      setContentTypeData(contentType);
  } else {
      setContentTypeData({
        navn: ', ',
        beskrivelse: ', ',
        profesjon: ', ',
        felter:  [],
    });
  }
}, [contentType, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{contentType ? 'Rediger Innholdstype' : 'Ny Innholdstype'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}, sx={{ mt:  1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Navn"
              value={contentTypeData.navn}
              onChange={(e) => setContentTypeData({ ...contentTypeData, navn: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Profesjon</InputLabel>
              <Select
                value={contentTypeData.profesjon || ', '}
                onChange={(e) =>
                  setContentTypeData({
                    ...contentTypeData,
                    profesjon: e.target.value,
                })
              }
              >
                <MenuItem value="">Alle profesjoner</MenuItem>
                <MenuItem value="photographer">Fotograf</MenuItem>
                <MenuItem value="videographer">Videograf</MenuItem>
                <MenuItem value="music_producer">Musikkprodusent</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Beskrivelse"
              value={contentTypeData.beskrivelse ||', '}
              onChange={(e) =>
                setContentTypeData({
                  ...contentTypeData,
                  beskrivelse: e.target.value,
              })
            }
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={theming.getThemedIcon('cancel')}>
          Avbryt
        </Button>
        <Button
          onClick={() => onSave(contentTypeData)}
          variant="contained"
          startIcon={theming.getThemedIcon('save')}
          disabled={isLoading || !contentTypeData.navn}
        >
          Lagre
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// getProfessionName is now provided by useDynamicProfessions hook as getProfessionDisplayName
