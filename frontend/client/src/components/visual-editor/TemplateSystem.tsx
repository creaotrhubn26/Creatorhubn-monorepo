// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  PhotoCamera as PhotoCameraIcon,
  Videocam as VideocamIcon,
  MusicNote as MusicNoteIcon,
  Store as StoreIcon,
  Business as BusinessIcon,
  Widgets as WidgetsIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  TextFields as TextFieldsIcon,
  CheckBox as CheckBoxIcon,
  RadioButtonChecked as RadioButtonIcon,
  ToggleOn as ToggleOnIcon,
  ViewQuilt as ViewQuiltIcon,
  ViewStream as ViewStreamIcon,
  ViewArray as ViewArrayIcon,
  ViewColumn as ViewColumnIcon,
  Image as ImageIcon,
  VideoLibrary as VideoLibraryIcon,
  Audiotrack as AudioFileIcon,
  InsertDriveFile as InsertDriveFileIcon,
  TableChart as TableChartIcon,
  BarChart as BarChartIcon,
  Add as AddIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  CameraAlt as CameraAltIcon,
  Movie as MovieIcon,
  Album as AlbumIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Event as EventIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  Settings as SettingsIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  profession?: string;
  preview: string;
  code: string;
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  icon: React.ReactElement
}

interface TemplateSystemProps {
  onSelectTemplate: (template: Template) => void
}

export function TemplateSystem({ onSelectTemplate }: TemplateSystemProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Template kategorier
  const categories = [
    {
      id: 'dashboards',
      label: 'Dashboards',
      icon: <DashboardIcon />,
      description: 'Komplette dashboard-løsninger for hver profesjon',
  },
    {
      id: 'platform-features',
      label: 'Plattform Features',
      icon: <SettingsIcon />,
      description: 'Pris-management, feature management og profesjons-utvidelser',
  },
    {
      id: 'components',
      label: 'Komponenter',
      icon: <WidgetsIcon />,
      description: 'Gjenbrukbare UI-komponenter',
  },
    {
      id: 'layouts',
      label: 'Layouts',
      icon: <ViewQuiltIcon />,
      description: 'Layout-strukturer og maler',
  },
    {
      id: 'forms',
      label: 'Skjemaer',
      icon: <AssignmentIcon />,
      description: 'Skjema-templates og validering',
  },
    {
      id: 'data',
      label: 'Data & Tabeller',
      icon: <TableChartIcon />,
      description: 'Datavisualisering og tabeller',
  },
    {
      id: 'content',
      label: 'Innhold',
      icon: <ImageIcon />,
      description: 'Media og innholds-komponenter',
  },
  ];

  // Dashboard templates for hver profesjon
  const dashboardTemplates: Template[] = [
    {
      id: 'photographer-dashboard',
      title: 'Fotograf Dashboard',
      description: 'Komplett dashboard med prosjekter, kunder, utstyr og portefølje',
      category: 'dashboards',
      profession: 'photographer',
      preview: 'Oversikt, Prosjekter, Kunder, Utstyr, Filer, Innstillinger',
      tags: ['fotografi','prosjekter','portefølje','material-ui'],
      complexity: 'intermediate',
      icon: <PhotoCameraIcon />,
      code: `import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import {
  PhotoCamera as PhotoCameraIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  CameraAlt as CameraAltIcon,
  FolderOpen as FolderOpenIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Event as EventIcon,
} from '@mui/icons-material';

function PhotographerDashboard() {
  const [activeTab, setActiveTab] = React.useState(0);

  const tabs = [
    { label: 'Oversikt', icon: <TrendingUpIcon />, id: 'overview',},
    { label: 'Prosjekter', icon: <AssignmentIcon />, id: 'projects',},
    { label: 'Kunder', icon: <PeopleIcon />, id: 'customers',},
    { label: 'Utstyr', icon: <CameraAltIcon />, id: 'equipment',},
    { label: 'Filer', icon: <FolderOpenIcon />, id: 'files',},
    { label: 'Innstillinger', icon: <SettingsIcon />, id: 'settings',}
  ];

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, background: 'linear-gradient(45deg, #1976d2, #42a5f5)' ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: 'white', color: 'primary.main'}}>
            <PhotoCameraIcon />
          </Avatar>
          <Box sx={{ color: 'white'}}>
            <Typography variant="h5" fontWeight={700} sx={{ color: theming.colors.primary }}>
              Fotograf Dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              Administrer dine fotografiprosjekter og kunder
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Navigation Tabs */}
      <Paper elevation={1} sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider'}}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
              sx={{ minHeight: 64}}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main'}}>
                    <AssignmentIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      12
                    </Typography>
                    <Typography color="text.secondary">
                      Aktive Prosjekter
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'secondary.main'}}>
                    <PeopleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      28
                    </Typography>
                    <Typography color="text.secondary">
                      Fornøyde Kunder
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main'}}>
                    <PhotoCameraIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      1,247
                    </Typography>
                    <Typography color="text.secondary">
                      Bilder Levert
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Andre tabs kan implementeres her */}
    </Box>
  );
}

export default PhotographerDashboard;`,
  },
    {
      id: 'videographer-dashboard',
      title: 'Videograf Dashboard',
      description: 'Profesjonelt dashboard for videoprodusjoner og kunder',
      category: 'dashboards',
      profession: 'videographer',
      preview: 'Oversikt, Videoer, Bestillinger, Studio, Filer, Innstillinger',
      tags: ['video','produksjon','editing','material-ui'],
      complexity: 'intermediate',
      icon: <VideocamIcon />,
      code: `import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Tabs,
  Tab,
  Paper,
  Stack,
  LinearProgress,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  Movie as MovieIcon,
  ShoppingCart as ShoppingCartIcon,
  VideoLibrary as VideoLibraryIcon,
  FolderOpen as FolderOpenIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

function VideographerDashboard() {
  const [activeTab, setActiveTab] = React.useState(0);

  const tabs = [
    { label: 'Oversikt', icon: <TrendingUpIcon />, id: 'overview',},
    { label: 'Videoer', icon: <MovieIcon />, id: 'videos',},
    { label: 'Bestillinger', icon: <ShoppingCartIcon />, id: 'orders',},
    { label: 'Studio', icon: <VideoLibraryIcon />, id: 'studio',},
    { label: 'Filer', icon: <FolderOpenIcon />, id: 'files',},
    { label: 'Innstillinger', icon: <SettingsIcon />, id: 'settings',}
  ];

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, background: 'linear-gradient(45deg, #dc004e, #ff5983)' ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: 'white', color: 'secondary.main'}}>
            <VideocamIcon />
          </Avatar>
          <Box sx={{ color: 'white'}}>
            <Typography variant="h5" fontWeight={700} sx={{ color: theming.colors.primary }}>
              Videograf Dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              Profesjonell videoproduксjon og post-produksjon
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Navigation */}
      <Paper elevation={1} sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Aktive Produksjoner
                </Typography>
                <Box sx={{ mb:  2 }}>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Bryllupsvideo - Erik & Maria</Typography>
                    <Typography variant="body2">75%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={75} />
                </Box>
                <Box sx={{ mb:  2 }}>
                  <Stack direction="row" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Bedriftsvideo - TechStart AS</Typography>
                    <Typography variant="body2">40%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={40} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Månedlig Statistikk
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Fullførte Prosjekter: </Typography>
                    <Typography fontWeight={60}>8</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Timer Redigering: </Typography>
                    <Typography fontWeight={60}>156</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography>Kundetilfredshet: </Typography>
                    <Typography fontWeight={60}>4.9/5</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default VideographerDashboard;`,
  },
    {
      id: 'musicproducer-dashboard',
      title: 'Musikk-produsent Dashboard',
      description: 'Studio dashboard for musikk-produksjon og artister',
      category: 'dashboards',
      profession: 'musicproducer',
      preview: 'Oversikt, Låter, Artister, Lager, Filer, Innstillinger',
      tags: ['musikk','studio','produksjon','material-ui'],
      complexity: 'intermediate',
      icon: <MusicNoteIcon />,
      code: `import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Tabs,
  Tab,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import {
  MusicNote as MusicNoteIcon,
  Album as AlbumIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  FolderOpen as FolderOpenIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  MicExternalOn as MicIcon,
} from '@mui/icons-material';

function MusicProducerDashboard() {
  const [activeTab, setActiveTab] = React.useState(0);

  const tabs = [
    { label: 'Oversikt', icon: <TrendingUpIcon />, id: 'overview',},
    { label: 'Låter', icon: <AlbumIcon />, id: 'tracks',},
    { label: 'Artister', icon: <PeopleIcon />, id: 'artists',},
    { label: 'Lager', icon: <InventoryIcon />, id: 'inventory',},
    { label: 'Filer', icon: <FolderOpenIcon />, id: 'files',},
    { label: 'Innstillinger', icon: <SettingsIcon />, id: 'settings',}
  ];

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, background: 'linear-gradient(45deg, #4caf50, #81c784)' ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: 'white', color: 'success.main'}}>
            <MusicNoteIcon />
          </Avatar>
          <Box sx={{ color: 'white'}}>
            <Typography variant="h5" fontWeight={700} sx={{ color: theming.colors.primary }}>
              Musikk-produsent Dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              Studio-administrasjon og artist-samarbeid
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Navigation */}
      <Paper elevation={1} sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main'}}>
                    <AlbumIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      24
                    </Typography>
                    <Typography color="text.secondary">
                      Produserte Låter
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main'}}>
                    <MicIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      15
                    </Typography>
                    <Typography color="text.secondary">
                      Aktive Artister
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'secondary.main'}}>
                    <InventoryIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      89
                    </Typography>
                    <Typography color="text.secondary">
                      Studio Timer
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Recent Projects */}
          <Grid item xs={12}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Nylige Prosjekter
                </Typography>
                <Stack spacing={2}>
                  {[
                    { title: 'Summer Vibes', artist: 'Lisa Andersen', status: 'Miksing', genre: 'Pop',},
                    { title: 'Northern Lights', artist: 'Bergen Band', status: 'Mastering', genre: 'Rock',},
                    { title: 'Digital Dreams', artist: 'ElektroNorge', status: 'Produksjon', genre: 'Electronic',}
                  ].map((project, index) => (
                    <Paper key={index} variant="outlined" sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography fontWeight={600}>{project.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {project.artist}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Chip label={project.genre} size="small" />
                          <Chip label={project.status} size="small" color="primary" />
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default MusicProducerDashboard;`,
  },
    {
      id: 'vendor-dashboard',
      title: 'Leverandør Dashboard',
      description: 'E-handel dashboard for produktsalg og inventar',
      category: 'dashboards',
      profession: 'vendor',
      preview: 'Oversikt, Produkter, Bestillinger, Lager, Filer, Innstillinger',
      tags: ['e-handel','produkter','salg','material-ui'],
      complexity: 'intermediate',
      icon: <StoreIcon />,
      code: `import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Tabs,
  Tab,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import {
  Store as StoreIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  Warehouse as WarehouseIcon,
  FolderOpen as FolderOpenIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';

function VendorDashboard() {
  const [activeTab, setActiveTab] = React.useState(0);

  const tabs = [
    { label: 'Oversikt', icon: <TrendingUpIcon />, id: 'overview',},
    { label: 'Produkter', icon: <InventoryIcon />, id: 'products',},
    { label: 'Bestillinger', icon: <ShoppingCartIcon />, id: 'orders',},
    { label: 'Lager', icon: <WarehouseIcon />, id: 'warehouse',},
    { label: 'Filer', icon: <FolderOpenIcon />, id: 'files',},
    { label: 'Innstillinger', icon: <SettingsIcon />, id: 'settings',}
  ];

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, background: 'linear-gradient(45deg, #ff9800, #ffcc02)' ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: 'white', color: 'warning.main'}}>
            <StoreIcon />
          </Avatar>
          <Box sx={{ color: 'white'}}>
            <Typography variant="h5" fontWeight={700} sx={{ color: theming.colors.primary }}>
              Leverandør Dashboard
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              E-handel og produktadministrasjon
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Navigation */}
      <Paper elevation={1} sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main'}}>
                    <AttachMoneyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      125k
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Månedens Omsetning
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main'}}>
                    <ShoppingCartIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      89
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Nye Bestillinger
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'warning.main'}}>
                    <InventoryIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      342
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Produkter i Lager
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card elevation={2} sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'error.main'}}>
                    <WarehouseIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                      12
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Lav Lagerstatus
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default VendorDashboard;`,
  },
  ];

  // Komponent templates
  const componentTemplates: Template[] = [
    {
      id: 'stats-card',
      title: 'Statistikk Kort',
      description: 'Responsivt kort for visning av nøkkeltall',
      category: 'components',
      subcategory: 'data-display',
      preview: 'Material UI Card med ikon, tall og beskrivelse',
      tags: ['card','stats','responsive','material-ui'],
      complexity: 'beginner',
      icon: <AssessmentIcon />,
      code: `import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Stack,
} from '@mui/material';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  trend?: { value: number; positive: boolean };
}

function StatsCard({ title, value, icon, color = 'primary', trend }: StatsCardProps) {
  return (
    <Card elevation={2} sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: \`\${color}.main\` }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
              {value}
            </Typography>
            <Typography color="text.secondary">
              {title}
            </Typography>
            {trend && (
              <Typography 
                variant="caption" 
                color={trend.positive ? 'success.main' : 'error.main'}
              >
                {trend.positive ? '↗' : '↘'} {trend.value}%
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default StatsCard;`,
  },
    {
      id: 'project-card',
      title: 'Prosjekt Kort',
      description: 'Kort for visning av prosjektinformasjon med status',
      category: 'components',
      subcategory: 'project-management',
      preview: 'Card med prosjektdetaljer, progresjon og handlinger',
      tags: ['project','card','progress','material-ui'],
      complexity: 'intermediate',
      icon: <AssignmentIcon />,
      code: `import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  LinearProgress,
  IconButton,
  Stack,
  Avatar,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Visibility as VisibilityIcon } from '@mui/icons-material';

interface ProjectCardProps {
  title: string;
  client: string;
  status: 'planning' | 'active' | 'review' | 'completed';
  progress: number;
  dueDate: string;
  type: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void
}

function ProjectCard({ 
  title, 
  client, 
  status, 
  progress, 
  dueDate, 
  type,
  onEdit,
  onDelete,
  onView 
}: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'info';
      case 'active': return 'primary';
      case 'review': return 'warning';
      case 'completed': return 'success';
      default: return 'default';
}
};

  return (
    <Card elevation={2} sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: theming.colors.primary }}>
          {title}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Klient: {client}
        </Typography>
        
        <Stack direction="row" spacing={1} mb={2}>
          <Chip 
            label={status} 
            color={getStatusColor(status)} 
            size="small" 
          />
          <Chip 
            label={type} 
            variant="outlined" 
            size="small" 
          />
        </Stack>
        
        <Typography variant="body2" gutterBottom>
          Progresjon: {progress}%
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ mb:  2 }}
        />
        
        <Typography variant="caption" color="text.secondary">
          Leveringsdato: {dueDate}
        </Typography>
      </CardContent>
      
      <CardActions sx={theming.getThemedCardSx()}>
        {onView && (
          <IconButton size="small" onClick={onView}>
            <VisibilityIcon />
          </IconButton>
        )}
        {onEdit && (
          <IconButton size="small" onClick={onEdit}>
            <EditIcon />
          </IconButton>
        )}
        {onDelete && (
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
}

export default ProjectCard;`,
  },
  ];

  // Plattform Features templates
  const platformFeatureTemplates: Template[] = [
    {
      id: 'pricing-management',
      title: 'Prisadministrasjon System',
      description: 'Komplett system for dynamisk prisberegning og administrasjon',
      category: 'platform-features',
      subcategory: 'pricing',
      preview: 'Dynamisk prisberegning, pakkepriser, timessatser, sesongvariasjon',
      tags: ['pricing','administration','dynamic','material-ui'],
      complexity: 'advanced',
      icon: <AttachMoneyIcon />,
      code: `import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  Alert,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';

interface PricingRule {
  id: string;
  name: string;
  type: 'base' | 'modifier' | 'package';
  value: number;
  condition?: string;
  profession: string
}

function PricingManagement() {
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [selectedProfession, setSelectedProfession] = useState('photographer');
  const [basePrice, setBasePrice] = useState(2500);
  const [dynamicPricing, setDynamicPricing] = useState(true);
  const [seasonalAdjustment, setSeasonalAdjustment] = useState(1.0);
  
  const professions = [
    { value: 'photographer', label: getProfessionDisplayName('photographer,'), icon: '📸',},
    { value: 'videographer', label: getProfessionDisplayName('videographer,'), icon: '🎬',},
    { value: 'musicproducer', label: getProfessionDisplayName('music_producer'), icon: '🎵',},
    { value: 'vendor', label: getProfessionDisplayName('vendor'), icon: '🏪',}
  ];

  const calculateDynamicPrice = () => {
    let calculatedPrice = basePrice;
    
    // Sesong-justering
    calculatedPrice *= seasonalAdjustment;
    
    // Profesjon-spesifikke modifikatorer
    const professionModifiers = {
      photographer: 1.0,
      videographer: 1.5,
      musicproducer: 1.3,
      vendor: 0.8 };
    
    calculatedPrice *= professionModifiers[selectedProfession] || 1.0;
    
    return Math.round(calculatedPrice);
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <AttachMoneyIcon color="primary" sx={{ fontSize: 32}} />
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
            Intelligent Prisadministrasjon
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Dynamisk prisberegning basert på profesjon og marked
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* Profesjon valg */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎯 Profesjon & Innstillinger
              </Typography>
              
              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Profesjon</InputLabel>
                <Select
                  value={selectedProfession}
                  onChange={(e) => setSelectedProfession(e.target.value)}
                  label="Profesjon"
                >
                  {professions.map(prof => (
                    <MenuItem key={prof.value} value={prof.value}>
                      {prof.icon} {prof.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Basispris (NOK)"
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                sx={{ mb:  2 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={dynamicPricing}
                    onChange={(e) => setDynamicPricing(e.target.checked)}
                  />
              }
                label="Dynamisk prisberegning"
              />
              
              {dynamicPricing && (
                <Box sx={{ mt:  2 }}>
                  <Typography gutterBottom>
                    Sesong-justering: {seasonalAdjustment}x
                  </Typography>
                  <Slider
                    value={seasonalAdjustment}
                    onChange={(_, value) => setSeasonalAdjustment(value as number)}
                    min={0.7}
                    max={1.5}
                    step={0.1}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Prisberegning */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                💰 Beregnet Pris
              </Typography>
              
              <Box sx={{ textAlign: 'center', p:  3 }}>
                <Typography variant="h3" color="primary.main" fontWeight={700} sx={{ color: theming.colors.primary }}>
                  {dynamicPricing ? calculateDynamicPrice() : basePrice} NOK
                </Typography>
                
                {dynamicPricing && (
                  <Stack spacing={1} mt={2}>
                    <Chip 
                      label={\`Basispris: \${basePrice} NOK\`} 
                      size="small" 
                      variant="outlined" 
                    />
                    <Chip 
                      label={\`Sesong: \${seasonalAdjustment}x\`} 
                      size="small" 
                      color="primary" 
                    />
                    <Chip 
                      label={\`Profesjon: \${selectedProfession}\`} 
                      size="small" 
                      color="secondary" 
                    />
                  </Stack>
                )}
              </Box>
              
              <Alert severity="info" sx={{ mt:  2 }}>
                Prisen justeres automatisk basert på valgte parametere og markedsbetingelser.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Avanserte innstillinger */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                ⚙️ Avanserte Innstillinger
              </Typography>
              
              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<CalculatorIcon />}
                  fullWidth
                >
                  Pakkepriser
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<ScheduleIcon />}
                  fullWidth
                >
                  Timessatser
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<BusinessIcon />}
                  fullWidth
                >
                  Bedriftskunder
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                  fullWidth
                >
                  Markedsanalyse
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default PricingManagement;`,
  },
    {
      id: 'feature-management',
      title: 'Feature Management System',
      description: 'Dynamisk aktivering og deaktivering av plattform-funksjoner',
      category: 'platform-features',
      subcategory: 'features',
      preview: 'Feature flags, A/B testing, profesjons-spesifikke funksjoner',
      tags: ['features','flags','management','material-ui'],
      complexity: 'advanced',
      icon: <SettingsIcon />,
      code: `import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Add as AddIcon,
  Science as ScienceIcon,
  Group as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

interface Feature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  profession?: string;
  category: 'core' | 'premium' | 'experimental' | 'professional';
  percentage?: number; // For A/B testing
}

function FeatureManagement() {
  const [features, setFeatures] = useState<Feature[]>([
    {
      id: 'advanced-portfolio',
      name: 'Avansert Portefølje',
      description: 'Utvidet portefølje med SEO og analytics',
      enabled: true,
      category: 'premium'
},
    {
      id: 'ai-image-tagging',
      name: 'Automatisk Bildetagging',
      description: 'AI-drevet tagging av bilder',
      enabled: false,
      category: 'experimental',
      percentage: 25 },
    {
      id: 'client-communication',
      name: 'Klient Kommunikasjon',
      description: 'Integrert chat og prosjekt-oppdateringer',
      enabled: true,
      category: 'core'
},
    {
      id: 'photographer-timeline',
      name: 'Bryllup Timeline',
      description: 'Detaljert timeline for bryllupsfotografer',
      enabled: true,
      profession: 'photographer',
      category: 'professional'
},
    {
      id: 'video-auto-highlights',
      name: 'Automatiske Høydepunkter',
      description: 'AI-genererte video høydepunkter',
      enabled: false,
      profession: 'videographer',
      category: 'experimental'
},
    {
      id: 'music-collaboration',
      name: 'Musiker Samarbeid',
      description: 'Real-time samarbeid i studio',
      enabled: true,
      profession: 'musicproducer',
      category: 'professional'
}
  ]);
  
  const [selectedProfession, setSelectedProfession] = useState('all');
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState<Partial<Feature>>({});
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();

  const professions = [
    { value: 'all', label: 'Alle Profesjoner',},
    { value: 'photographer', label: getProfessionDisplayName('photographer'),},
    { value: 'videographer', label: getProfessionDisplayName('videographer'),},
    { value: 'musicproducer', label: getProfessionDisplayName('music_producer'),},
    { value: 'vendor', label: getProfessionDisplayName('vendor'),}
  ];

  const categories = [
    { value: 'core', label: 'Kjerne', color: 'primary',},
    { value: 'premium', label: 'Premium', color: 'warning',},
    { value: 'experimental', label: 'Eksperimentell', color: 'info',},
    { value: 'professional', label: 'Profesjonell', color: 'success',}
  ];

  const filteredFeatures = features.filter(feature => 
    selectedProfession === 'all' || 
    !feature.profession || 
    feature.profession === selectedProfession
  );

  const toggleFeature = (featureId: string) => {
    setFeatures(prev => 
      prev.map(feature => 
        feature.id === featureId 
          ? { ...feature, enabled: !feature.enabled }
          : feature
      )
    );
};

  const getCategoryStats = () => {
    const stats = categories.map(cat => ({
      ...cat,
      total: features.filter(f => f.category === cat.value).length,
      enabled: features.filter(f => f.category === cat.value && f.enabled).length
}));
    return stats;
};

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <SettingsIcon color="primary" sx={{ fontSize: 32}} />
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
            Feature Management
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Dynamisk kontroll av plattform-funksjoner
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* Kontrollpanel */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎛️ Kontrollpanel
              </Typography>
              
              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Filtrer etter profesjon</InputLabel>
                <Select
                  value={selectedProfession}
                  onChange={(e) => setSelectedProfession(e.target.value)}
                  label="Filtrer etter profesjon"
                >
                  {professions.map(prof => (
                    <MenuItem key={prof.value} value={prof.value}>
                      {prof.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowAddFeature(true)}
                sx={{ mb:  2 }}
              >
                Legg til Feature
              </Button>
              
              {/* Kategori Statistikk */}
              <Typography variant="subtitle2" gutterBottom>
                📊 Kategori Oversikt
              </Typography>
              
              <Stack spacing={1}>
                {getCategoryStats().map(stat => (
                  <Stack key={stat.value} direction="row" justifyContent="space-between" alignItems="center">
                    <Chip 
                      label={stat.label} 
                      color={stat.color as any} 
                      size="small" 
                    />
                    <Typography variant="body2">
                      {stat.enabled}/{stat.total}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Feature Liste */}
        <Grid item xs={12} md={8}>
          <Card elevation={2} sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🔧 Aktiverte Features
              </Typography>
              
              <List>
                {filteredFeatures.map((feature) => (
                  <ListItem key={feature.id} divider>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {feature.name}
                          </Typography>
                          <Chip 
                            label={categories.find(c => c.value === feature.category)?.label} 
                            color={categories.find(c => c.value === feature.category)?.color as any}
                            size="small"
                          />
                          {feature.profession && (
                            <Chip 
                              label={professions.find(p => p.value === feature.profession)?.label} 
                              size="small" 
                              variant="outlined"
                            />
                          )}
                          {feature.percentage && (
                            <Chip 
                              label={\`A/B: \${feature.percentage}%\`} 
                              size="small" 
                              color="info"
                            />
                          )}
                        </Stack>
                    }
                      secondary={feature.description}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={feature.enabled}
                        onChange={() => toggleFeature(feature.id)}
                        color="primary"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Add Feature Dialog */}
      <Dialog 
        open={showAddFeature} 
        onClose={() => setShowAddFeature(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Legg til ny Feature</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt:  1 }}>
            <TextField
              fullWidth
              label="Feature Navn"
              value={newFeature.name || ''}
              onChange={(e) => setNewFeature(prev => ({ ...prev, name: e.target.value }))}
            />
            
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Beskrivelse"
              value={newFeature.description || ''}
              onChange={(e) => setNewFeature(prev => ({ ...prev, description: e.target.value }))}
            />
            
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={newFeature.category || ', '}
                onChange={(e) => setNewFeature(prev => ({ ...prev, category: e.target.value as any }))}
                label="Kategori"
              >
                {categories.map(cat => (
                  <MenuItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Profesjon (valgfritt)</InputLabel>
              <Select
                value={newFeature.profession || ', '}
                onChange={(e) => setNewFeature(prev => ({ ...prev, profession: e.target.value }))}
                label="Profesjon (valgfritt)"
              >
                <MenuItem value="">Alle</MenuItem>
                {professions.slice(1).map(prof => (
                  <MenuItem key={prof.value} value={prof.value}>
                    {prof.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => setShowAddFeature(false)}
                fullWidth
              >
                Avbryt
              </Button>
              <Button variant="contained"
                onClick={() => {
                  if (newFeature.name && newFeature.description && newFeature.category) {
                    setFeatures(prev => [...prev, {
                      id: Date.now().toString(),
                      enabled: false,
                      ...newFeature as Feature
                  }]);
                    setNewFeature({});
                    setShowAddFeature(false);
                }
              }}
                fullWidth
              >
                Legg til
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default FeatureManagement;`,
  },
  ];

  // Layout templates
  const layoutTemplates: Template[] = [
    {
      id: 'sidebar-layout',
      title: 'Sidebar Layout',
      description: 'Responsiv layout med sidebar-navigasjon',
      category: 'layouts',
      subcategory: 'navigation',
      preview: 'Drawer-basert layout med hovedinnhold',
      tags: ['layout', 'sidebar','responsive', 'material-ui'],
      complexity: 'intermediate',
      icon: <ViewStreamIcon />,
      code: `import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

interface SidebarLayoutProps {
  children: React.ReactNode
}

function SidebarLayout({ children }: SidebarLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/',},
    { text: 'Kunder', icon: <PeopleIcon />, path: '/customers',},
    { text: 'Innstillinger', icon: <SettingsIcon />, path: '/settings',}
  ];

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
          CreatorHub Norge
        </Typography>
      </Toolbar>
      <List>
        {menuItems.map((item) => (
          <ListItem button key={item.text}>
            <ListItemIcon>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex'}}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: \`calc(100% - \${drawerWidth}px)\` },
          ml: { md: \`\${drawerWidth}px\` }}}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: 'none',} }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
            CreatorHub Norge
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none',}, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }}}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block',}, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }}}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow:  1,
          p:  3,
          width: { md: \`calc(100% - \${drawerWidth}px)\` }}}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

export default SidebarLayout;`,
  },
  ];

  // Alle templates kombinert
  const allTemplates = [
    ...dashboardTemplates,
    ...platformFeatureTemplates,
    ...componentTemplates,
    ...layoutTemplates,
  ];

  // Filtrer templates basert på aktiv kategori
  const getFilteredTemplates = () => {
    const categoryId = categories[activeCategory].id;
    let filtered = allTemplates.filter((template) => template.category === categoryId);

    if (selectedSubcategory) {
      filtered = filtered.filter((template) => template.subcategory === selectedSubcategory);
  }

    return filtered;
};

  // Få unike subkategorier for aktiv kategori
  const getSubcategories = () => {
    const categoryId = categories[activeCategory].id;
    const categoryTemplates = allTemplates.filter((template) => template.category === categoryId);
    const subcategories = [...new Set(categoryTemplates.map((t) => t.subcategory).filter(Boolean))];
    return subcategories;
};

  return (
    <Box sx={{ width: '100%'}}>
      {/* Kategori tabs */}
      <Paper elevation={1} sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Tabs
          value={activeCategory}
          onChange={(_, value) => {
            setActiveCategory(value);
            setSelectedSubcategory(null);
        }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider'}}
        >
          {categories.map((category, index) => (
            <Tab
              key={category.id}
              icon={category.icon}
              label={category.label}
              iconPosition="start"
              sx={{ minHeight: 64}}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Kategori beskrivelse */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: 'primary.50',  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          {categories[activeCategory].label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {categories[activeCategory].description}
        </Typography>
      </Paper>

      {/* Subkategori filter */}
      {getSubcategories().length > 0 && (
        <Box sx={{ mb:  3 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip
              label="Alle"
              variant={!selectedSubcategory ? 'filled' : 'outlined'}
              color="primary"
              onClick={() => setSelectedSubcategory(null)}
            />
            {getSubcategories().map((subcategory) => (
              <Chip
                key={subcategory}
                label={subcategory}
                variant={selectedSubcategory === subcategory ? 'filled' : 'outlined'}
                color="primary"
                onClick={() => setSelectedSubcategory(subcategory)}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Template grid */}
      <Grid container spacing={3}>
        {getFilteredTemplates().map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
              <CardContent sx={{ flexGrow:  1 ,  ...theming.getThemedCardSx() }}>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Avatar sx={{ bgcolor: 'primary.main'}}>{template.icon}</Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                      {template.title}
                    </Typography>
                    <Chip
                      label={template.complexity}
                      size="small"
                      color={
                        template.complexity === 'beginner'
                          ? 'success'
                          : template.complexity === 'intermediate'
                            ? 'warning' : 'error'
                    }
                    />
                  </Box>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {template.description}
                </Typography>

                <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                  {template.preview}
                </Typography>

                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {template.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button
                  startIcon={<PreviewIcon />}
                  size="small"
                  onClick={() => console.log('Preview: ', template.id)}
                >
                  Forhåndsvis
                </Button>
                <Button
                  startIcon={<CodeIcon />}
                  size="small"
                  variant="contained"
                  onClick={() => onSelectTemplate(template)}
                >
                  Bruk Template
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty state */}
      {getFilteredTemplates().length === 0 && (
        <Paper elevation={1} sx={{ p:  4, textAlign:'center',  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
            Ingen templates funnet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Prøv å velge en annen kategori eller fjern filtre
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
