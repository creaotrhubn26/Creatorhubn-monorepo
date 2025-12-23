import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import { Box, IconButton, Fab, Tooltip } from '@mui/material';
import {
  Settings as SettingsIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudSync as CloudSyncIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import UniversalShowcase from '../components/universal/UniversalShowcase';
import { ShowcaseDriveManager } from '../components/showcase/ShowcaseDriveManager';
import { CategoryManager } from '../components/showcase/CategoryManager';
import { Dialog, DialogTitle, DialogContent, Typography, Tabs, Tab, Alert } from '@mui/material';
import { useDynamicProfessions } from '../components/universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { CREATOR_HUB_BRANDING } from '../constants/CreatorHubBranding';

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

  // User data - with dynamic profession support
  const userId = user?.id || user?.email || 'unknown-user';
  const accessToken = 'demo-access-token';

  const handleAdminTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setAdminTabValue(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative',}}>
      {/* Main Showcase Display - samme design som showcase-sidene */}
      <UniversalShowcase
        profession={profession}
        userId={userId}
        isOwner={true}
        compact={false}
        maxItems={20}
        adminMode={adminMode}
      />

      {/* Admin Controls - floating glassmorphic overlay */}
      <Box
        sx={{
          position: 'fixed',
          top:  20,
          right:  20,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap:  1,
      }}
      >
        <Tooltip title={adminMode ? 'Avslutt admin-modus' : 'Aktiver admin-modus'} placement="left">
          <Fab
            size="medium"
            onClick={() => setAdminMode(!adminMode)}
            sx={{
              background: adminMode
                ? 'linear-gradient(45deg, #ff6b35, #ff8c00)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 140, 0, 0.3)',
              color: adminMode ? 'white' : '#ff8c00', '&:hover': {
                background: 'linear-gradient(45deg, #ff6b35, #ff8c00)',
                color: 'white',
                transform: 'scale(1.05)',
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
                ? 'linear-gradient(45deg, #2196f3, #21cbf3)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(33, 150, 243, 0.3)',
              color: previewMode ? 'white' : '#2196f3','&:hover': {
                background: 'linear-gradient(45deg, #2196f3, #21cbf3)',
                color: 'white',
                transform: 'scale(1.05)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {previewMode ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </Fab>
        </Tooltip>

        <Tooltip title="Åpne admin-panel" placement="left">
          <Fab
            size="medium"
            onClick={() => setAdminDialog(true)}
            sx={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 140, 0, 0.3)',
              color: '#ff8c00', '&:hover': {
                background: 'linear-gradient(45deg, #ff8c00, #ff6b35)',
                color: 'white',
                transform: 'scale(1.05)',
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
            bottom:  20,
            left:  20,
            right:  20,
            background: 'rgba(255, 140, 0, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius:  2,
            p:  2,
            zIndex: 10,
            border: '1px solid rgba(25, 255, 255, 0.3)',
            color: 'white',
        }}
        >
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🎨 Admin-modus aktivert
          </Typography>
          <Typography variant="body2">
            Du er nå i administrasjonsmodus. Alle endringer gjøres i sanntid. Klikk på elementer for
            å redigere, eller bruk admin-panelet for avanserte innstillinger.
          </Typography>
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
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 140, 0, 0.2)',
        },
      }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.1) 0%, rgba(255, 107, 53, 0.1) 100%)',
            borderBottom: '1px solid rgba(255, 140, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
        }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {professionIcon && (
                <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                  {professionIcon}
                </Box>
              )}
              <Typography variant="h5"
                component="div"
                sx={{ 
                  background: 'linear-gradient(45deg, #ff8c00, #ff6b35)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 'bold',
                  color: theming.colors.primary,
                }}>
                {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                  ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Showcase Administration`
                  : '🎨 Showcase Administration'}
              </Typography>
            </Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
              Administrer showcase-kategorier, Drive-integrasjon og visningsinnstillinger
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p:  0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider',}}>
            <Tabs
              value={adminTabValue}
              onChange={handleAdminTabChange}
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 50,
                },
                '& .Mui-selected': {
                  color: '#ff8c00 !important',
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#ff8c00',
                },
            }}
            >
              <Tab label="📚 Kategorier" />
              <Tab label="🔗 Drive Integration" />
              <Tab label="⚙️ Innstillinger" />
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
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                ⚙️ Avanserte innstillinger
              </Typography>
              <Alert severity="info">
                <Typography variant="body2">
                  Avanserte innstillinger kommer snart. Her vil du kunne konfigurere: </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                  <li>Custom CSS og styling</li>
                  <li>SEO-innstillinger</li>
                  <li>Tilgangskontraller</li>
                  <li>Analytics og tracking</li>
                </Box>
              </Alert>
            </Box>
          </AdminTabPanel>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
