import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Fab,
  Tooltip,
  Card as MuiCard,
  CardContent,
  Grid,
  Avatar,
  LinearProgress,
  Chip,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudSync as CloudSyncIcon,
  Dashboard as DashboardIcon,
  PhotoLibrary as PhotoLibraryIcon,
  VideoLibrary as VideoLibraryIcon,
  AudioFile as AudioFileIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Favorite as FavoriteIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  FilterList as FilterListIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import UniversalShowcase from '../components/universal/UniversalShowcase';
import { ShowcaseDriveManager } from '../components/showcase/ShowcaseDriveManager';
import { CategoryManager } from '../components/showcase/CategoryManager';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Tabs,
  Tab,
  Alert,
  Button,
} from '@mui/material';
import { useDynamicProfessions } from '../components/universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { CREATOR_HUB_BRANDING } from '../constants/CreatorHubBranding';
import { ProjectProvider } from '../contexts/ProjectContext';

// Import profession system hooks and utilities
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';


interface AdminTabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number; 
}

function AdminTabPanel(props: AdminTabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function ShowcaseAdmin() {
  const [adminMode, setAdminMode] = useState(false);
  const [adminDialog, setAdminDialog] = useState(false);
  const [adminTabValue, setAdminTabValue] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  // Dynamic profession integration
  const { user } = useAuth();
  
  // Use dynamic profession system
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters
  const professionAdapter = useProfessionAdapter();
  
  // Get current profession (from user or dynamic system)
  const currentUserProfession = professionAdapter.profession || user?.profession || 'photographer';
  const profession = currentUserProfession;
  
  // Get profession icon
  const professionIcon = getProfessionIcon(profession);
  
  // Get profession config
  const professionConfig = professionConfigs?.[profession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[profession] || professionConfig;
  
  // Get profession color from dynamic system
  const professionColor = getUserProfessionColor(profession) || '#ff8c00';
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const muiTheme = useTheme();

  // User data - with dynamic profession support
  const userId = user?.id || user?.email || 'unknown-user';
  const accessToken = 'demo-access-token';
  
  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Demo stats (would come from API in production)
  const stats = {
    totalItems: 24,
    totalViews: 1842,
    totalLikes: 156,
    totalDownloads: 47,
    photos: 18,
    videos: 4,
    audio: 2,
  };

  const handleAdminTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setAdminTabValue(newValue);
  };

  // Stat card component
  const StatCard = ({ 
    icon, 
    label, 
    value, 
    trend, 
    color 
  }: { 
    icon: React.ReactNode; 
    label: string; 
    value: number | string; 
    trend?: string;
    color: string;
  }) => (
    <MuiCard
      sx={{
        background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: 3,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(color, 0.2)}`,
          borderColor: alpha(color, 0.4),
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            {trend && (
              <Chip 
                size="small" 
                label={trend} 
                sx={{ 
                  mt: 1, 
                  height: 22,
                  fontSize: '0.7rem',
                  bgcolor: alpha(color, 0.15),
                  color,
                  fontWeight: 600,
                }}
              />
            )}
          </Box>
          <Avatar
            sx={{
              bgcolor: alpha(color, 0.15),
              color,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </MuiCard>
  );

  return (
    <ProjectProvider>
      <Box sx={{ 
        minHeight: '100vh', 
        position: 'relative',
        bgcolor: '#06080d',
        color: '#edf0f7',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        background:
          'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.18), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.12), rgba(6,8,14,0) 44%), linear-gradient(135deg, #06080d 0%, #090d16 52%, #120d08 100%)',
      }}>
        
        {/* Header Section */}
        <Box
          sx={{
            background:
              'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
            px: { xs: 2, md: 4 },
            py: 3,
          }}
        >
          <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            {/* Title Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {professionIcon && (
                  <Avatar
                    sx={{
                      bgcolor: alpha(professionColor, 0.15),
                      color: professionColor,
                      width: 56,
                      height: 56,
                    }}
                  >
                    {professionIcon}
                  </Avatar>
                )}
                <Box>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 700,
                      fontFamily: 'Barlow Condensed, sans-serif',
                      letterSpacing: '0.04em',
                      background: 'linear-gradient(135deg, #f8d27a 0%, #f5a623 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Showcase Admin
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(237,240,247,0.64)' }}>
                    Administrer ditt portfolio og showcase
                  </Typography>
                </Box>
              </Box>
              
              {/* Quick Actions */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  sx={{
                    borderColor: alpha(theming.colors.primary, 0.3),
                    color: theming.colors.primary,
                    '&:hover': {
                      borderColor: theming.colors.primary,
                      bgcolor: alpha(theming.colors.primary, 0.08),
                    },
                  }}
                >
                  Last opp
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{
                    bgcolor: theming.colors.primary,
                    '&:hover': {
                      bgcolor: theming.colors.secondary,
                    },
                  }}
                >
                  Nytt prosjekt
                </Button>
              </Box>
            </Box>

            {/* Stats Row */}
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4} md={2}>
                <StatCard
                  icon={<PhotoLibraryIcon />}
                  label="Totalt"
                  value={stats.totalItems}
                  trend="+3 denne uken"
                  color={theming.colors.primary}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <StatCard
                  icon={<TrendingUpIcon />}
                  label="Visninger"
                  value={stats.totalViews}
                  trend="+12%"
                  color={theming.colors.info || '#2196f3'}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <StatCard
                  icon={<FavoriteIcon />}
                  label="Liker"
                  value={stats.totalLikes}
                  trend="+8%"
                  color={theming.colors.error || '#f44336'}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <StatCard
                  icon={<DownloadIcon />}
                  label="Nedlastinger"
                  value={stats.totalDownloads}
                  color={theming.colors.success || '#4caf50'}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <StatCard
                  icon={<VideoLibraryIcon />}
                  label="Videoer"
                  value={stats.videos}
                  color="#9c27b0"
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <StatCard
                  icon={<AudioFileIcon />}
                  label="Lydklipp"
                  value={stats.audio}
                  color="#00bcd4"
                />
              </Grid>
            </Grid>
          </Box>
        </Box>

        {/* Filter Bar */}
        <Box
          sx={{
            px: { xs: 2, md: 4 },
            py: 2,
            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(11,15,24,0.82)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Box sx={{ maxWidth: 1400, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label="Alle" 
                color="primary" 
                variant="filled"
                sx={{ fontWeight: 600 }}
              />
              <Chip label="Bilder" variant="outlined" onClick={() => {}} />
              <Chip label="Videoer" variant="outlined" onClick={() => {}} />
              <Chip label="Lyd" variant="outlined" onClick={() => {}} />
              <Chip label="Favoritter" variant="outlined" icon={<FavoriteIcon />} onClick={() => {}} />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Tooltip title="Filtrer">
                <IconButton size="small">
                  <FilterListIcon />
                </IconButton>
              </Tooltip>
              <Box sx={{ 
                display: 'flex', 
                border: `1px solid ${alpha(theming.colors.primary, 0.2)}`,
                borderRadius: 1,
                overflow: 'hidden',
              }}>
                <IconButton 
                  size="small"
                  onClick={() => setViewMode('grid')}
                  sx={{ 
                    borderRadius: 0,
                    bgcolor: viewMode === 'grid' ? alpha(theming.colors.primary, 0.1) : 'transparent',
                    color: viewMode === 'grid' ? theming.colors.primary : 'text.secondary',
                  }}
                >
                  <ViewModuleIcon />
                </IconButton>
                <IconButton 
                  size="small"
                  onClick={() => setViewMode('list')}
                  sx={{ 
                    borderRadius: 0,
                    bgcolor: viewMode === 'list' ? alpha(theming.colors.primary, 0.1) : 'transparent',
                    color: viewMode === 'list' ? theming.colors.primary : 'text.secondary',
                  }}
                >
                  <ViewListIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Main Showcase Display */}
        <Box sx={{ px: { xs: 2, md: 4 }, py: 3 }}>
          <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            <UniversalShowcase
              profession={profession}
              userId={userId}
              isOwner={true}
              compact={false}
              maxItems={20}
              adminMode={adminMode}
            />
          </Box>
        </Box>

      {/* Admin Controls - floating glassmorphic overlay */}
      <Box
        sx={{
          position: 'fixed',
          top: 100,
          right: 20,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
      }}
      >
        <Tooltip title={adminMode ? 'Avslutt admin-modus' : 'Aktiver admin-modus'} placement="left">
          <Fab
            size="medium"
            onClick={() => setAdminMode(!adminMode)}
            sx={{
              background: adminMode
                ? `linear-gradient(135deg, ${theming.colors.primary}, ${theming.colors.secondary})`
                : alpha(muiTheme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theming.colors.primary, 0.3)}`,
              color: adminMode ? 'white' : theming.colors.primary,
              boxShadow: `0 4px 20px ${alpha(theming.colors.primary, 0.2)}`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theming.colors.primary}, ${theming.colors.secondary})`,
                color: 'white',
                transform: 'scale(1.08)',
                boxShadow: `0 6px 24px ${alpha(theming.colors.primary, 0.35)}`,
              },
              transition: 'all 0.3s ease',
            }}
          >
            <EditIcon />
          </Fab>
        </Tooltip>

        <Tooltip title="Forhåndsvis som besøkende" placement="left">
          <Fab
            size="medium"
            onClick={() => setPreviewMode(!previewMode)}
            sx={{
              background: previewMode
                ? 'linear-gradient(135deg, #2196f3, #21cbf3)'
                : alpha(muiTheme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(33, 150, 243, 0.3)',
              color: previewMode ? 'white' : '#2196f3',
              boxShadow: '0 4px 20px rgba(33, 150, 243, 0.15)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2196f3, #21cbf3)',
                color: 'white',
                transform: 'scale(1.08)',
                boxShadow: '0 6px 24px rgba(33, 150, 243, 0.3)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {previewMode ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </Fab>
        </Tooltip>

        <Tooltip title="Del showcase" placement="left">
          <Fab
            size="medium"
            sx={{
              background: alpha(muiTheme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha('#4caf50', 0.3)}`,
              color: '#4caf50',
              boxShadow: '0 4px 20px rgba(76, 175, 80, 0.15)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4caf50, #66bb6a)',
                color: 'white',
                transform: 'scale(1.08)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            <ShareIcon />
          </Fab>
        </Tooltip>

        <Tooltip title="Åpne admin-panel" placement="left">
          <Fab
            size="medium"
            onClick={() => setAdminDialog(true)}
            sx={{
              background: alpha(muiTheme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theming.colors.primary, 0.3)}`,
              color: theming.colors.primary,
              boxShadow: `0 4px 20px ${alpha(theming.colors.primary, 0.15)}`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theming.colors.primary}, ${theming.colors.secondary})`,
                color: 'white',
                transform: 'scale(1.08)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            <DashboardIcon />
          </Fab>
        </Tooltip>
      </Box>

      {/* Admin Mode Overlay */}
      {adminMode && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.95)}, ${alpha(theming.colors.secondary, 0.9)})`,
            backdropFilter: 'blur(12px)',
            borderRadius: 3,
            p: 2.5,
            zIndex: 10,
            border: `1px solid ${alpha('#fff', 0.2)}`,
            color: 'white',
            boxShadow: `0 8px 32px ${alpha(theming.colors.primary, 0.4)}`,
        }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              <EditIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>
                Admin-modus aktivert
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Klikk på elementer for å redigere, dra for å omorganisere, eller bruk admin-panelet for avanserte innstillinger.
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => setAdminMode(false)}
              sx={{ 
                color: 'white', 
                borderColor: 'rgba(255,255,255,0.5)',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              Avslutt
            </Button>
          </Box>
        </Box>
      )}

      {/* Admin Dialog Panel */}
      <Dialog
        open={adminDialog}
        onClose={() => setAdminDialog(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '80vh',
            background: muiTheme.palette.background.paper,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${alpha(theming.colors.primary, 0.15)}`,
            borderRadius: 3,
        },
      }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.08)} 0%, ${alpha(theming.colors.secondary, 0.05)} 100%)`,
            borderBottom: `1px solid ${alpha(theming.colors.primary, 0.1)}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 2.5,
        }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {professionIcon && (
                <Avatar
                  sx={{ 
                    bgcolor: alpha(professionColor, 0.15),
                    color: professionColor,
                    width: 44,
                    height: 44,
                  }}
                >
                  {professionIcon}
                </Avatar>
              )}
              <Box>
                <Typography variant="h5"
                  component="div"
                  sx={{ 
                    background: `linear-gradient(135deg, ${theming.colors.primary}, ${theming.colors.secondary})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 700,
                  }}>
                  Showcase Administration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Administrer kategorier, Drive-integrasjon og visningsinnstillinger
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={adminTabValue}
              onChange={handleAdminTabChange}
              sx={{
                px: 2,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  minHeight: 56,
                },
                '& .Mui-selected': {
                  color: `${theming.colors.primary} !important`,
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: theming.colors.primary,
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                },
            }}
            >
              <Tab icon={theming.getThemedIcon('Category', { sx: { mr: 1 } })} iconPosition="start" label="Kategorier" />
              <Tab icon={theming.getThemedIcon('CloudSync', { sx: { mr: 1 } })} iconPosition="start" label="Drive Integration" />
              <Tab icon={theming.getThemedIcon('Settings', { sx: { mr: 1 } })} iconPosition="start" label="Innstillinger" />
            </Tabs>
          </Box>

          <AdminTabPanel value={adminTabValue} index={0}>
            <CategoryManager userId={userId} profession={profession} editMode={true} />
          </AdminTabPanel>

          <AdminTabPanel value={adminTabValue} index={1}>
            <ShowcaseDriveManager
              userId={userId}
              profession={profession}
              accessToken={accessToken}
            />
          </AdminTabPanel>

          <AdminTabPanel value={adminTabValue} index={2}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600 }}>
                {theming.getThemedIcon('Settings', { sx: { mr: 1, verticalAlign: 'middle' } })}
                Avanserte innstillinger
              </Typography>
              <Alert 
                severity="info"
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theming.colors.info || '#2196f3', 0.2)}`,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Avanserte innstillinger kommer snart
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  <li>Custom CSS og styling</li>
                  <li>SEO-innstillinger for bedre synlighet</li>
                  <li>Tilgangskontroller og deling</li>
                  <li>Analytics og besøksstatistikk</li>
                  <li>Watermark og brandinghttps</li>
                </Box>
              </Alert>
            </Box>
          </AdminTabPanel>
        </DialogContent>
      </Dialog>
      </Box>
    </ProjectProvider>
  );
}
