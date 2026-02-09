import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
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
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Stack,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  PhotoCameraAlt,
  Videocamcam,
  LibraryMusicNote,
  AdminPanelSettings,
  ExpandMore,
  Palette,
  Settings,
  Dashboard,
  DirectionsBusiness,
  Work,
  Group,
  Star,
  CheckCircle,
  Warning,
  Timeline,
  Psychology,
  Analytics,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import CustomerJourneyBuilder from './CustomerJourneyBuilder';

interface ProfessionConfig {
  id?: string;
  key: string;
  name: string;
  nameEnglish: string;
  description: string;
  color: string;
  icon: string;
  status: 'active' | 'inactive' | 'beta' | 'coming_soon';
  tabs: string[];
  features: string[];
  integrations: string[];
  priority: number;
  metadata: {
    marketSize?: string;
    averageRevenue?: string;
    complexity?: 'low' | 'medium' | 'high';
    developmentTime?: string;
};
  createdAt?: string;
  updatedAt?: string;
}

export default function ProfessionCMSManager() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  const [currentTab, setCurrentTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProfession, setSelectedProfession] = useState<ProfessionConfig | null>(null);
  const [selectedProfessionForJourney, setSelectedProfessionForJourney] = useState('photographer,');
  const [formData, setFormData] = useState<ProfessionConfig>({
    key: '',
    name: '',
    nameEnglish: '',
    description: '',
    color: '#2196F0',
    icon: 'business',
    status: 'active',
    tabs: ['Oversikt','Prosjekter','Kunder','Utstyr','Filer','Innstillinger'],
    features:  [],
    integrations:  [],
    priority:  1,
    metadata:  , {},
});

  // Fetch profession configurations
  const { data: rawProfessions = [], isLoading } = useQuery({
    queryKey: ['/api/admin/profession-types', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/profession-types', { headers });
    },
    retry: false,
});

  // Transform backend data to frontend format
  const professions = rawProfessions.map((p: any) => ({
    id: p.id,
    key: p.name,
    name: p.displayName,
    nameEnglish: p.displayName,
    description: p.description,
    color: p.iconColor,
    icon: getProfessionIconString(p.name),
    status: p.isActive ? 'active' : 'inactive',
    tabs: ['Oversikt','Prosjekter','Kunder','Utstyr','Filer','Innstillinger'],
    features: [],
    integrations: [],
    priority: p.sortOrder,
    metadata: {},
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
}));

  // Fetch profession statistics
  const { data: professionStats } = useQuery({
    queryKey: ['/api/admin/cms/profession-stats', ],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/cms/profession-stats', { headers });
    },
    retry: false,
});

  // Save profession mutation
  const saveProfessionMutation = useMutation({
    mutationFn: async (professionData: ProfessionConfig) => {
      // Transform data to match backend API
      const backendData = {
        name: professionData.key,
        displayName: professionData.name,
        description: professionData.description,
        iconColor: professionData.color,
        isActive: professionData.status === 'active',
        sortOrder: professionData.priority,
    };

      const headers = await auth.getAuthHeader();
      if (professionData.id) {
        return apiRequest(`/api/admin/profession-types/${professionData.id}`, {
          method: 'PUT',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify(backendData),
      });
    } else {
        return apiRequest('/api/admin/profession-types', {
          method: 'POST',
          headers: {
            ...headers, , 'Content-Type': 'application/json'
          },
          body: JSON.stringify(backendData),
      });
    }
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/profession-types', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/cms/profession-stats', ],
    });
      setOpenDialog(false);
      setSelectedProfession(null);
  },
});

  // Delete profession mutation
  const deleteProfessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/profession-types/${id}`, {
        method: 'DELETE',
        headers
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/profession-types', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/cms/profession-stats', ],
    });
  },
});

  const handleOpenDialog = (profession?: ProfessionConfig) => {
    if (profession) {
      setSelectedProfession(profession);
      setFormData(profession);
  } else {
      setSelectedProfession(null);
      setFormData({
        key: '',
        name: '',
        nameEnglish: '',
        description: ', ',
        color: '#2196F0',
        icon: 'business',
        status: 'active',
        tabs: ['Oversikt', 'Prosjekter', 'Kunder', 'Utstyr', 'Filer','Innstillinger'],
        features:  [],
        integrations:  [],
        priority:  1,
        metadata:  , {},
    });
  }
    setOpenDialog(true);
};

  const handleSave = () => {
    saveProfessionMutation.mutate(formData);
};

  const handleTabsChange = (index: number, value: string) => {
    const newTabs = [...formData.tabs];
    newTabs[index] = value;
    setFormData({ ...formData, tabs: newTabs });
};

  const addTab = () => {
    setFormData({ ...formData, tabs: [...formData.tabs'Ny Tab'] });
};

  const removeTab = (index: number) => {
    const newTabs = formData.tabs.filter((_, i) => i !== index);
    setFormData({ ...formData, tabs: newTabs });
};

  const addFeature = (feature: string) => {
    if (feature && !formData.features.includes(feature)) {
      setFormData({ ...formData, features: [...formData.features, feature] });
  }
};

  const removeFeature = (feature: string) => {
    setFormData({
      ...formData,
      features: formData.features.filter((f) => f !== feature),
  });
};

  const getProfessionIconString = (professionKey: string): string => {
    const iconStringMap: { [key: string]: string } = {
      photographer: 'camera',
      videographer: 'videocam',
      musicproducer: 'library_music',
      vendor: 'business',
  };
    return iconStringMap[professionKey] || 'business';
};

  const getProfessionIcon = (profession: ProfessionConfig) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      photographer: <PhotoCamera sx={{ color: profession.color }} />,
      videographer: <Videocam sx={{ color: profession.color }} />,
      musicproducer: <LibraryMusic sx={{ color: profession.color }} />,
      vendor: <Business sx={{ color: profession.color }} />,
      admin: <AdminPanelSettings sx={{ color: profession.color }} />,
  };
    return iconMap[profession.key] || <Business sx={{ color: profession.color }} />;
};

  const getStatusColor = (status: string) => {
    const statusColors = {
      active: 'success',
      inactive: 'default',
      beta: 'warning',
      coming_soon: 'info',
  };
    return statusColors[status as keyof typeof statusColors] || 'default';
};

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
        <Typography variant="h4" sx={{  color: '#2196F0', fontWeight: 'bold' }}>
          🎨 Profession Management CMS
        </Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => handleOpenDialog()}
          sx={{ bgcolor: '#4CAF50', '&:hover': { bgcolor: '#45a049'} }}
        >
          Legg til Profesjon
        </Button>
      </Box>

      {/* ✅ Main Navigation Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, value) => setCurrentTab(value)}
        sx={{ mb:  3, borderBottom: 1, borderColor: 'divider'}}
      >
        <Tab icon={<Dashboard />} label="Profesjoner Oversikt" iconPosition="start" />
        <Tab icon={<Box />} label="Customer Journey Builder" iconPosition="start" />
        <Tab icon={theming.getThemedIcon('analytics')}} label="Statistikk & Analyse" iconPosition="start" />
      </Tabs>

      {/* ✅ Tab Content */}
      {currentTab === 0 && (
        <Box>
          {/* Statistics Cards */}
          <Grid container spacing={3}, sx={{ mb:  3 }}>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="textSecondary" sx={{ color: theming.colors.primary }}>
                    Totale Profesjoner
                  </Typography>
                  <Typography variant="h3" sx={{  color: theming.colors.primary }}>
                    {professions.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="textSecondary" sx={{ color: theming.colors.primary }}>
                    Aktive Profesjoner
                  </Typography>
                  <Typography variant="h3" sx={{  color: theming.colors.primary }}>
                    {professions.filter((p: ProfessionConfig) => p.status === 'active').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="textSecondary" sx={{ color: theming.colors.primary }}>
                    Beta Profesjoner
                  </Typography>
                  <Typography variant="h3" sx={{  color: theming.colors.primary }}>
                    {professions.filter((p: ProfessionConfig) => p.status === 'beta').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" color="textSecondary" sx={{ color: theming.colors.primary }}>
                    Kommende
                  </Typography>
                  <Typography variant="h3" sx={{  color: theming.colors.primary }}>
                    {professions.filter((p: ProfessionConfig) => p.status === 'coming_soon').length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Profession List */}
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Konfigurerte Profesjoner
              </Typography>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Profesjon</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Antall Tabs</TableCell>
                      <TableCell>Funksjoner</TableCell>
                      <TableCell>Prioritet</TableCell>
                      <TableCell align="right">Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {professions.map((profession: ProfessionConfig) => (
                      <TableRow key={profession.id || profession.key}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: profession.color }}>
                              {getProfessionIcon(profession)}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1">{profession.name}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {profession.nameEnglish}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={profession.status}
                            color={getStatusColor(profession.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{profession.tabs.length}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            {profession.features.slice(0, 2).map((feature) => (
                              <Chip key={feature} label={feature} size="small" variant="outlined" />
                            ))}
                            {profession.features.length > 2 && (
                              <Chip label={`+${profession.features.length - 2}`} size="small" />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Star
                            sx={{
                              color: profession.priority <= 3 ? '#FFD700' : '#ccc'}}
                          />
                          {profession.priority}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleOpenDialog(profession)} color="primary">
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                          <IconButton
                            onClick={() =>
                              profession.id && deleteProfessionMutation.mutate(profession.id)
                          }
                            color="error"
                          >
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ✅ Customer Journey Builder Tab */}
      {currentTab === 1 && (
        <Box>
          {/* Profession Selector for Journey Builder */}
          <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Velg profesjon for Customer Journey: </Typography>
                <FormControl size="small" sx={{ minWidth: 200}}>
                  <Select
                    value={selectedProfessionForJourney}
                    onChange={(e) => setSelectedProfessionForJourney(e.target.value)}
                  >
                    <MenuItem value="photographer">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <PhotoCamera fontSize="small" />
                        <span>Fotograf</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="videographer">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Videocam fontSize="small" />
                        <span>Videograf</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="musicproducer">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LibraryMusic fontSize="small" />
                        <span>Musikkprodusent</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value="vendor">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Business fontSize="small" />
                        <span>Leverandør</span>
                      </Stack>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>

          {/* Customer Journey Builder Component */}
          <CustomerJourneyBuilder selectedProfession={selectedProfessionForJourney} />
        </Box>
      )}

      {/* ✅ Analytics Tab */}
      {currentTab === 2 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                <Analytics sx={{ mr: 1, verticalAlign: 'bottom'}} />
                Statistikk & Analyse
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Detaljert analyse av Customer Journey performance, brukerengasjement og
                konverteringsrater kommer snart...
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Profession Configuration Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedProfession ? 'Rediger Profesjon' : 'Ny Profesjon'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}, sx={{ mt:  1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Profesjon Key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                helperText="Unik identifikator (f.eks: photographer)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Navn (Norsk)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name (English)"
                value={formData.nameEnglish}
                onChange={(e) => setFormData({ ...formData, nameEnglish: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <MenuItem value="active">Aktiv</MenuItem>
                  <MenuItem value="inactive">Inaktiv</MenuItem>
                  <MenuItem value="beta">Beta</MenuItem>
                  <MenuItem value="coming_soon">Kommende</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Farge"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Ikon (Emoji)"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                inputProps={{ maxLength:  2 }}
              />
            </Grid>

            {/* Tabs Configuration */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Dashboard Tabs</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {formData.tabs.map((tab, index) => (
                    <Box key={index}, sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <TextField
                        fullWidth
                        value={tab}
                        onChange={(e) => handleTabsChange(index, e.target.value)}
                        sx={{ mr:  1 }}
                      />
                      <IconButton onClick={() => removeTab(index)} color="error">
                        {theming.getThemedIcon('delete')}
                      </IconButton>
                    </Box>
                  ))}
                  <Button onClick={addTab} startIcon={theming.getThemedIcon('add')}>
                    Legg til Tab
                  </Button>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Features Configuration */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Funksjoner</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack direction="row" flexWrap="wrap" gap={1}, sx={{ mb:  2 }}>
                    {formData.features.map((feature) => (
                      <Chip
                        key={feature}
                        label={feature}
                        onDelete={() => removeFeature(feature)}
                        color="primary"
                      />
                    ))}
                  </Stack>
                  <TextField
                    fullWidth
                    label="Legg til funksjon"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addFeature((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                    }
                  }}
                    helperText="Trykk Enter for å legge til"
                  />
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Avbryt</Button>
          <Button onClick={handleSave}
            variant="contained"
            disabled={saveProfessionMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {saveProfessionMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
