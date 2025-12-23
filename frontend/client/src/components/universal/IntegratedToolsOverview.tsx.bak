import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Grid,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Email,
  CloudDone,
  Article,
  PhotoCamera,
  Storage,
  Group,
  Settings,
  Store,
  Build,
  LibraryMusic,
  Videocam,
  Lightbulb
} from '@mui/icons-material';

// Import actual components
import EmailDesigner from '../EmailDesigner/EmailDesigner';
import GoogleOAuthSetup from '../google-oauth/GoogleOAuthSetup';
import CameraSelection from '../test/CameraSelectionTest';
import LightroomPluginTest from '../lightroom/LightroomPluginTest';
import PhotographyTipsCenter from '../photography/PhotographyTipsCenter';
import ContextualPhotographyTipsOverlay from '../photography/ContextualPhotographyTipsOverlay';
// import VideoEditingTools from '../demos/VideoEditingDemo'; // Module not found
import MusicProductionTools from '../music/MusicProductionTools';
import VendorManagementTools from '../vendor/VendorManagementTools';
import UniversalOnboarding from '../UniversalOnboarding';
import LightingSimulator3D from './misc/LightingSimulator3D';
// import ScenePreviewSimulator from './misc/scene-preview-simulator'; // Module not found
// import LightingComparisonTool from './misc/lighting-comparison-tool'; // Module not found

interface IntegratedToolsOverviewProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  compact?: boolean;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

const IntegratedToolsOverview: React.FC<IntegratedToolsOverviewProps> = ({
	  profession,
	  compact = false,
	  onMeetingCreate,
	  onProjectUpdate,
	  onWorklogCreate,
	  selectedProject,
	  onProjectSelect,
}) => {
	  const theming = useTheming(profession);
	  const [openTool, setOpenTool] = useState<string>('');

  const handleToolClick = (toolName: string) => {
    setOpenTool(toolName);
};

  const handleCloseDialog = () => {
    setOpenTool('');
};

  const renderToolComponent = () => {
    switch (openTool) {
      case 'email-designer':
        return <EmailDesigner />;
      case 'google-oauth':
        return <GoogleOAuthSetup compact={false} />;
      case 'camera-selection':
        return <div>Camera Selection Tool - Component Not Available</div>;
      case 'lightroom-plugin':
        return <LightroomPluginTest />;
      case 'photography-tips':
        return <PhotographyTipsCenter />;
      case 'contextual-photography-tips':
        return <ContextualPhotographyTipsOverlay />;
      case 'personalized-news':
	      window.open('/personalized-news', '_blank');
        setOpenTool(', ');
        return null;
      case 'video-tools':
        return <div>Video Editing Tools - Component Not Available</div>;
      case 'music-tools':
        return <MusicProductionTools />;
      case 'vendor-tools':
        return <VendorManagementTools />;
      case 'universal-onboarding':
        return <UniversalOnboarding />;
      case '3d-lighting-simulator':
        return <LightingSimulator3D />;
      case 'scene-preview-simulator':
        return <div>Scene Preview Simulator - Component Not Available</div>;
      case 'lighting-comparison-tool':
        return <div>Lighting Comparison Tool - Component Not Available</div>;
      default: return null;
}
};

  if (compact) {
    return (
      <Card sx={{ p: 2, bgcolor: 'rgba(25,255,255,0.7)', mb:  2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  1 }}>
          Tilgjengelige Verktøy
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Email fontSize="small" />
            E-post Designer
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <CloudDone fontSize="small" />
            Google OAuth & Drive
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Article fontSize="small" />
            Personaliserte Nyheter
          </Typography>
          {profession === 'photographer' && (
            <>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <PhotoCamera fontSize="small" />
                Kamera Database & Lightroom Plugin
              </Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <PhotoCamera fontSize="small" />
                Fotograferingstips
              </Typography>
            </>
          )}
          {profession === 'music_producer' && (
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <LibraryMusic fontSize="small" />
              Musikkprodusent Nyheter & Plugins
            </Typography>
          )}
          {profession === 'videographer' && (
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Videocam fontSize="small" />
              Video Editing & Production Tools
            </Typography>
          )}
          {(profession === 'photographer' || profession === 'videographer') && (
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Storage fontSize="small" />
              Minnekort Backup System
            </Typography>
          )}
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Group fontSize="small" />
            Universal Onboarding
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Store fontSize="small" />
            Showcase Admin
          </Typography>
          {profession === 'music_producer' && (
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Build fontSize="small" />
              Plugin & Lisens Administrasjon
            </Typography>
          )}
        </Box>
      </Card>
    );
}

  return (
    <Box sx={{ mt:  4 }}>
      <Typography variant="h6" sx={{  mb:  3, fontWeight: 600}}>
        Profesjonelle Integrasjoner & Verktøy
      </Typography>
      <Grid container spacing={3}>
        
        {/* Core Platform Tools */}
        <Grid size={{ xs:  12, md:  6 }}>
          <Card sx={{ height: '100%', bgcolor: 'rgba(25,255,255,0.9)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('build')}
                Plattform Verktøy
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                <Button
                  startIcon={theming.getThemedIcon('email')}
                  variant="outlined"
                  onClick={() => handleToolClick('email-designer')}
                  sx={{ justifyContent: 'flex-start'}}
                >
                  E-post Designer
                </Button>
                <Button
                  startIcon={theming.getThemedIcon('cloudDone')}
                  variant="outlined"
                  onClick={() => handleToolClick('google-oauth')}
                  sx={{ justifyContent: 'flex-start'}}
                >
                  Google OAuth Setup
                </Button>
                <Button
                  startIcon={theming.getThemedIcon('article')}
                  variant="outlined"
                  onClick={() => handleToolClick('personalized-news')}
                  sx={{ justifyContent: 'flex-start'}}
                >
                  Personaliserte Nyheter
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Professional-Specific Tools */}
        <Grid size={{ xs:  12, md:  6 }}>
          <Card sx={{ height: '100%', bgcolor: 'rgba(25,255,255,0.9)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('group')}
                Profesjonsspesifikke Verktøy
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                {profession === 'photographer' && (
                  <>
                    <Button
                      startIcon={theming.getThemedIcon('photoCamera')}
                      variant="outlined"
                      onClick={() => handleToolClick('camera-selection')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Kamera Database
                    </Button>
                    <Button
                      startIcon={theming.getThemedIcon('photoCamera')}
                      variant="outlined"
                      onClick={() => handleToolClick('lightroom-plugin')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Lightroom Plugin
                    </Button>
                    <Button
                      startIcon={theming.getThemedIcon('photoCamera')}
                      variant="outlined"
                      onClick={() => handleToolClick('photography-tips')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Fotograferingstips
                    </Button>
                    <Button
                      startIcon={<Lightbulb />}
                      variant="outlined"
                      onClick={() => handleToolClick('contextual-photography-tips')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Kontekstuelle Foto-tips
                    </Button>
                    <Button
                      startIcon={<Lightbulb />}
                      variant="outlined"
                      onClick={() => handleToolClick('3d-lighting-simulator')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      3D Lighting Simulator
                    </Button>
                  </>
                )}
                {profession === 'music_producer' && (
                  <>
                    <Button
                      startIcon={theming.getThemedIcon('libraryMusic')}
                      variant="outlined"
                      onClick={() => handleToolClick('music-tools')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Plugin Administrasjon
                    </Button>
                    <Button
                      startIcon={theming.getThemedIcon('libraryMusic')}
                      variant="outlined"
                      onClick={() => handleToolClick('personalized-news')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Musikkprodusent Nyheter
                    </Button>
                  </>
                )}
                {profession === 'videographer' && (
                  <>
                    <Button
                      startIcon={theming.getThemedIcon('videocam')}
                      variant="outlined"
                      onClick={() => handleToolClick('video-tools')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Video Editor
                    </Button>
                    <Button
                      startIcon={theming.getThemedIcon('videocam')}
                      variant="outlined"
                      onClick={() => handleToolClick('video-tools')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Story Arc Generator
                    </Button>
                  </>
                )}
                {profession === 'vendor' && (
                  <>
                    <Button
                      startIcon={theming.getThemedIcon('store')}
                      variant="outlined"
                      onClick={() => handleToolClick('vendor-tools')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Lager Management
                    </Button>
                    <Button
                      startIcon={theming.getThemedIcon('store')}
                      variant="outlined"
                      onClick={() => handleToolClick('vendor-tools')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Ordre Administrasjon
                    </Button>
                  </>
                )}
                {(profession === 'photographer' || profession === 'videographer') && (
                  <>
                    <Button
                      startIcon={theming.getThemedIcon('storage')}
                      variant="outlined"
                      onClick={() => handleToolClick('memory-card-backup')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Minnekort Backup
                    </Button>
                    <Button
                      startIcon={theming.getThemedIcon('photoCamera')}
                      variant="outlined"
                      onClick={() => handleToolClick('scene-preview-simulator')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Scene Preview Simulator
                    </Button>
                    <Button
                      startIcon={<Lightbulb />}
                      variant="outlined"
                      onClick={() => handleToolClick('lighting-comparison-tool')}
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Lighting Comparison Tool
                    </Button>
                  </>
                )}
                <Button
                  startIcon={theming.getThemedIcon('group')}
                  variant="outlined"
                  onClick={() => handleToolClick('universal-onboarding')}
                  sx={{ justifyContent: 'flex-start'}}
                >
                  Universal Onboarding
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Administrative Tools */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(25,255,255,0.9)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('settings')}
                Administrative Verktøy
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs:  12, sm:  4 }}>
                  <Button
                    startIcon={theming.getThemedIcon('store')}
                    variant="outlined"
                    onClick={() => handleToolClick('/showcase-admin')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start'}}
                  >
                    Showcase Admin
                  </Button>
                </Grid>
                {profession === 'music_producer' && (
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <Button
                      startIcon={theming.getThemedIcon('build')}
                      variant="outlined"
                      onClick={() => handleToolClick('/plugin-license-administration')}
                      fullWidth
                      sx={{ justifyContent: 'flex-start'}}
                    >
                      Plugin & Lisens
                    </Button>
                  </Grid>
                )}
                <Grid size={{ xs:  12, sm:  4 }}>
                  <Button
                    startIcon={theming.getThemedIcon('group')}
                    variant="outlined"
                    onClick={() => handleToolClick('/universal-communication-system-test')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start'}}
                  >
                    Kommunikasjonssystem
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tool Dialog */}
      <Dialog 
        open={Boolean(openTool && openTool !== 'personalized-news')}
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { 
            minHeight: '70vh',
            bgcolor: 'background.default'
      }
      }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          {openTool === 'email-designer' && <>{theming.getThemedIcon('email')} E-post Designer</>}
          {openTool === 'google-oauth' && <>{theming.getThemedIcon('cloudDone')} Google OAuth Setup</>}
          {openTool === 'camera-selection' && <>{theming.getThemedIcon('photoCamera')} Kamera Database</>}
          {openTool === 'lightroom-plugin' && <>{theming.getThemedIcon('photoCamera')} Lightroom Plugin</>}
          {openTool === 'photography-tips' && <>{theming.getThemedIcon('photoCamera')} Fotograferingstips</>}
          {openTool === 'video-tools' && <>{theming.getThemedIcon('videocam')} Video Production Tools</>}
          {openTool === 'music-tools' && <>{theming.getThemedIcon('libraryMusic')} Music Production Tools</>}
          {openTool === 'vendor-tools' && <>{theming.getThemedIcon('store')} Vendor Management Tools</>}
          {openTool === 'memory-card-backup' && <>{theming.getThemedIcon('storage')} Minnekort Backup System</>}
          {openTool === 'universal-onboarding' && <>{theming.getThemedIcon('group')} Universal Onboarding System</>}
          {openTool === '3d-lighting-simulator' && <><Lightbulb /> 3D Lighting Simulator</>}
          {openTool === 'scene-preview-simulator' && <>{theming.getThemedIcon('photoCamera')} Scene Preview Simulator</>}
          {openTool ==='lighting-comparison-tool' && <><Lightbulb /> Lighting Comparison Tool</>}
        </DialogTitle>
        <DialogContent sx={{ p:  0 }}>
          {renderToolComponent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegratedToolsOverview;