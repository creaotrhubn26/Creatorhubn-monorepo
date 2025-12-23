import * as React from 'react';
import {
  Box,
  CssBaseline,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Topbar from '@/ui/panels/Topbar';
import LeftLibrary from '@/ui/panels/LeftLibrary';
import LibraryPanel from '@/ui/panels/LibraryPanel';
import RightInspector from '@/ui/panels/RightInspector';
import BottomPreview from '@/ui/panels/BottomPreview';
import Stage2D from '@/ui/stage2d/Stage2D';
import Stage3D from '@/ui/stage3d/Stage3D';
import SceneLayers from '@/ui/panels/SceneLayers';
import MeasurementsPanel from '@/ui/panels/MeasurementsPanel';
import { colors, spacing, shadows } from '@/styles/designTokens';
import { globalStyles, initializeDesignSystem } from '@/styles/globalStyles';

// Feature panels
import ViewMode from '@/ui/features/ViewMode';
import MultiCameraView from '@/ui/features/MultiCameraView';
import CameraSwitcher from '@/ui/features/CameraSwitcher';
import HistogramPanel from '@/ui/features/HistogramPanel';
import VideoCameraPanel from '@/ui/features/VideoCameraPanel';
import ModifiersPanel from '@/ui/features/ModifiersPanel';
import GoboBrowser from '@/ui/features/GoboBrowser';
import IESPanel from '@/ui/features/IESPanel';
import TemplateManager from '@/ui/features/TemplateManager';
import GearPresetManager from '@/ui/features/GearPresetManager';
import Measurement3DPanel from '@/ui/features/Measurement3DPanel';
import SnappingToggle from '@/ui/features/SnappingToggle';
import RenderExportPanel from '@/ui/features/RenderExportPanel';
import LayoutDocking from '@/ui/features/LayoutDocking';
import TimelinePanel from '@/ui/features/TimelinePanel';
import ImageResultExporter from '@/ui/features/ImageResultExporter';
import PoseLibrary from '@/ui/features/PoseLibrary';
import ModelPoseEditor from '@/ui/features/ModelPoseEditor';
import CommunityHub from '@/ui/features/CommunityHub';

// Asset panels
import BackdropsPanel from '@/ui/panels/BackdropsPanel';
import PropsPanel from '@/ui/panels/PropsPanel';
import ClothingPanel from '@/ui/panels/ClothingPanel';

const LEFT_W = 320;
const RIGHT_W = 380;
const TOP_H = 80; // Increased to accommodate project title and controls
const BOTTOM_H = 200; // Reduced to match reference design
const VIEWPORT_3D_HEIGHT = '60%'; // 3D viewport takes 60% of center area
const VIEWPORT_2D_HEIGHT = '40%'; // 2D top view takes 40% of center area

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppShell] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Error rendering Virtual Studio
          </Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            {this.state.error?.message || 'Unknown error'}
          </Typography>
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
            Check the browser console for details
          </Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default function AppShell() {
  // Initialize design system
  React.useEffect(() => {
    initializeDesignSystem();
  }, []);

  // Hyper3D library scripts are loaded via static import in LibraryPanel
  // Functions are also exposed globally in the script file for console access

  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppShell.tsx:89',message:'AppShell component mounted',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'INIT'})}).catch(()=>{});
  }, []);
  // #endregion

  const [equipmentTab, setEquipmentTab] = React.useState(0);

  return (
    <ErrorBoundary>
    <Box sx={{ width: '100%', height: '100vh', bgcolor: colors.background.base, display: 'flex', flexDirection: 'column' }}>
      <CssBaseline />
      {/* Topbar */}
      <Box
        sx={{
          position: 'relative',
          height: TOP_H,
          borderBottom: `1px solid ${colors.border.divider}`,
          bgcolor: colors.background.panel,
          zIndex: 10,
          boxShadow: shadows.sm,
        }}
      >
        <Topbar />
      </Box>

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `${LEFT_W}px 1fr ${RIGHT_W}px`,
          overflow: 'hidden',
          minHeight: 0
        }}
      >
        {/* Left column: Equipment Library with Tabs */}
        <Box 
          sx={{ 
            borderRight: `1px solid ${colors.border.divider}`, 
            bgcolor: colors.background.panel, 
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            ...globalStyles.scrollbar,
          }}
        >
          {/* Equipment Tabs (Lights/Modifiers) */}
          <Paper 
            elevation={0} 
            sx={{ 
              bgcolor: colors.background.panel, 
              borderBottom: `1px solid ${colors.border.divider}`,
              borderRadius: 0
            }}
          >
            <Tabs 
              value={equipmentTab} 
              onChange={(_, v) => setEquipmentTab(v)}
              sx={{
                '& .MuiTab-root': {
                  color: colors.text.disabled,
                  textTransform: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  minHeight: 48,
                  transition: 'color 0.2s ease',
                  '&.Mui-selected': {
                    color: colors.text.primary,
                  },
                  '&:hover': {
                    color: colors.text.primary,
                    bgcolor: 'rgba(255,255,255,0.05)'
                  }
                },
                '& .MuiTabs-indicator': {
                  bgcolor: colors.primary,
                  height: 2
                },
              }}
            >
              <Tab label="Lights" />
              <Tab label="Modifiers" />
            </Tabs>
          </Paper>
          
          {/* Tab Content */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {equipmentTab === 0 && (
              <Box>
                <LibraryPanel />
                <LeftLibrary />
              </Box>
            )}
            {equipmentTab === 1 && (
              <Box>
                <ModifiersPanel />
              </Box>
            )}
          </Box>
          
          {/* Collapsible Sections */}
          <Box sx={{ borderTop: `1px solid ${colors.border.divider}`, bgcolor: colors.background.panel }}>
            <SceneLayers />
            <MeasurementsPanel />

          <Accordion defaultExpanded sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: `1px solid ${colors.border.divider}`, bgcolor: colors.background.panel }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: colors.text.disabled, transition: 'transform 0.2s ease' }} />}
              sx={{ 
                minHeight: 48,
                '&.Mui-expanded': { 
                  minHeight: 48,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    transform: 'rotate(180deg)'
                  }
                },
                transition: 'background-color 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: colors.text.primary
                  }
                }
              }}
            >
              <Typography fontWeight={600} fontSize={13} color={colors.text.primary}>Workspaces & Cameras</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: colors.background.panel }}>
              <ViewMode />
              <CameraSwitcher />
              <MultiCameraView />
              <HistogramPanel />
              <VideoCameraPanel />
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: `1px solid ${colors.border.divider}`, bgcolor: colors.background.panel }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: colors.text.disabled, transition: 'transform 0.2s ease' }} />}
              sx={{ 
                minHeight: 48,
                '&.Mui-expanded': { 
                  minHeight: 48,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    transform: 'rotate(180deg)'
                  }
                },
                transition: 'background-color 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: colors.text.primary
                  }
                }
              }}
            >
              <Typography fontWeight={600} fontSize={13} color={colors.text.primary}>Templates & Gear</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: colors.background.panel }}>
              <TemplateManager />
              <GearPresetManager />
              <PoseLibrary />
              <ModelPoseEditor />
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: `1px solid ${colors.border.divider}`, bgcolor: colors.background.panel }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: colors.text.disabled, transition: 'transform 0.2s ease' }} />}
              sx={{ 
                minHeight: 48,
                '&.Mui-expanded': { 
                  minHeight: 48,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    transform: 'rotate(180deg)'
                  }
                },
                transition: 'background-color 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: colors.text.primary
                  }
                }
              }}
            >
              <Typography fontWeight={600} fontSize={13} color={colors.text.primary}>Render & Export</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: colors.background.panel }}>
              <RenderExportPanel />
              <ImageResultExporter />
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: `1px solid ${colors.border.divider}`, bgcolor: colors.background.panel }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: colors.text.disabled, transition: 'transform 0.2s ease' }} />}
              sx={{ 
                minHeight: 48,
                '&.Mui-expanded': { 
                  minHeight: 48,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    transform: 'rotate(180deg)'
                  }
                },
                transition: 'background-color 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: colors.text.primary
                  }
                }
              }}
            >
              <Typography fontWeight={600} fontSize={13} color={colors.text.primary}>Assets (Clothing, Props, Backdrops)</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: colors.background.panel }}>
              {/* #region agent log */}
              {(() => {
                fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppShell.tsx:235',message:'Rendering asset panels',data:{hasClothingPanel:true,hasPropsPanel:true,hasBackdropsPanel:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'PANELS'})}).catch(()=>{});
                return null;
              })()}
              {/* #endregion */}
              <ClothingPanel />
              <PropsPanel />
              <BackdropsPanel />
            </AccordionDetails>
          </Accordion>

          <Accordion sx={{ '&:before': { display: 'none' }, boxShadow: 'none', borderBottom: '1px solid #2a2a2a', bgcolor: '#1a1a1a' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#888888', transition: 'transform 0.2s ease' }} />}
              sx={{ 
                minHeight: 48,
                '&.Mui-expanded': { 
                  minHeight: 48,
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    transform: 'rotate(180deg)'
                  }
                },
                transition: 'background-color 0.2s ease',
                '&:hover': { 
                  bgcolor: '#2a2a2a',
                  '& .MuiAccordionSummary-expandIconWrapper': {
                    color: '#ffffff'
                  }
                }
              }}
            >
              <Typography fontWeight={600} fontSize={13} color="#ffffff">Layout, Timeline & Community</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: '#1a1a1a' }}>
              <LayoutDocking />
              <TimelinePanel />
              <CommunityHub />
            </AccordionDetails>
          </Accordion>
          </Box>
        </Box>

        {/* Center stage: 3D viewport on top, 2D top view below */}
        <Box 
          sx={{ 
            position: 'relative', 
            bgcolor: colors.background.panel,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 3D Viewport (Top 60%) */}
          <Box
            sx={{
              height: VIEWPORT_3D_HEIGHT,
              position: 'relative',
              borderBottom: `2px solid ${colors.border.divider}`,
              overflow: 'hidden'
            }}
          >
            <Stage3D />
          </Box>
          
          {/* 2D Top View (Bottom 40%) */}
          <Box
            sx={{
              height: VIEWPORT_2D_HEIGHT,
              position: 'relative',
              bgcolor: colors.background.base,
              overflow: 'hidden'
            }}
          >
            <Stage2D />
          </Box>
        </Box>

        {/* Right inspector: Selection + Camera panels */}
        <Box 
          sx={{ 
            borderLeft: `1px solid ${colors.border.divider}`, 
            bgcolor: colors.background.panel, 
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            ...globalStyles.scrollbar,
          }}
        >
          <RightInspector />
        </Box>
      </Box>

      {/* Bottom bar: Lens/Camera controls, Export buttons, Notes/Assets tabs */}
      <Box
        sx={{
          height: BOTTOM_H,
          borderTop: `1px solid ${colors.border.divider}`,
          bgcolor: colors.background.panel,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          px: spacing.md,
          gap: spacing.md
        }}
      >
        <BottomPreview />
      </Box>
    </Box>
    </ErrorBoundary>
  );
}
