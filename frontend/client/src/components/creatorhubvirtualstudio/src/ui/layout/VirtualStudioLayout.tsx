/**
 * VirtualStudioLayout - Responsive layout wrapper for Virtual Studio
 * 
 * Provides:
 * - Automatic layout switching (desktop/tablet/mobile)
 * - iPad split view support
 * - Floating panels on tablet
 * - Full-screen mode toggle
 * - Apple Pencil mode indicator
 * - Orientation change handling
 */

import type { ReactNode } from 'react';
import React, { useState, useCallback, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('VirtualStudioLayout');
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Stack,
  Fab,
  Zoom,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings,
  Fullscreen,
  FullscreenExit,
  Create,
  TouchApp,
  Mouse,
  Splitscreen,
  ViewSidebar,
  ViewModule,
} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';
import {
  TabletSupportProvider,
  useTabletSupport,
  TabletOnly,
  DesktopOnly,
  PencilOnly,
  ResponsiveRender,
} from '../../providers/TabletSupportProvider';
import {
  TabletToolbar,
  TabletSidebar,
  TabletBottomSheet,
  TabletIconButton,
  GestureView,
} from '../components/TabletUI';

// =============================================================================
// Types
// =============================================================================

export interface VirtualStudioLayoutProps {
  children: ReactNode;
  
  // Header
  header?: ReactNode;
  headerHeight?: number;
  
  // Sidebar (properties panel)
  sidebar?: ReactNode;
  sidebarWidth?: number;
  sidebarTitle?: string;
  
  // Secondary sidebar (scene hierarchy, etc.)
  secondarySidebar?: ReactNode;
  secondarySidebarWidth?: number;
  secondarySidebarTitle?: string;
  
  // Toolbar
  toolbar?: ReactNode;
  
  // Bottom panel (timeline, etc.)
  bottomPanel?: ReactNode;
  bottomPanelHeight?: number;
  bottomPanelTitle?: string;
  
  // Callbacks
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onLayoutChange?: (layout: 'default' | 'compact' | 'fullscreen') => void;
}

// =============================================================================
// Styled Components
// =============================================================================

const LayoutContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0a0a14',
  overflow: 'hidden',
});

const HeaderBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'height',
})<{ height: number }>(({ height }) => ({
  height,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  backgroundColor: '#1a1a2e',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
}));

const MainContent = styled(Box)({
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
  position: 'relative',
});

const CenterArea = styled(Box)({
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
});

const InputModeIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'mode',
})<{ mode: 'mouse' | 'touch' | 'pencil' }>(({ mode }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 12px',
  borderRadius: 16,
  backgroundColor: mode === 'pencil' 
    ? 'rgba(76, 175, 80, 0.2)' 
    : mode === 'touch'
    ? 'rgba(33, 150, 243, 0.2)'
    : 'rgba(255, 255, 255, 0.1)',
  color: mode === 'pencil' 
    ? '#4CAF50' 
    : mode === 'touch'
    ? '#2196F3' : 'rgba(255, 255, 255, 0.7)',
  fontSize: 12,
  fontWeight: 500,
}));

const FloatingPanelButton = styled(Fab)({
  position: 'fixed',
  bottom: 80,
  backgroundColor: 'rgba(26, 26, 46, 0.95)',
  backdropFilter: 'blur(8px)', '&:hover': {
    backgroundColor: 'rgba(26, 26, 46, 1)',
  },
});

const SplitViewIndicator = styled(Box)({
  position: 'fixed',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '4px 12px',
  borderRadius: 12,
  backgroundColor: 'rgba(255, 193, 7, 0.2)',
  color: '#FFC107',
  fontSize: 11,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  zIndex: 100,
});

// =============================================================================
// Inner Layout Component (uses context)
// =============================================================================

const VirtualStudioLayoutInner: React.FC<VirtualStudioLayoutProps> = ({
  children,
  header,
  headerHeight = 56,
  sidebar,
  sidebarWidth = 320,
  sidebarTitle = 'Properties',
  secondarySidebar,
  secondarySidebarWidth = 280,
  secondarySidebarTitle = 'Scene',
  toolbar,
  bottomPanel,
  bottomPanelHeight = 200,
  bottomPanelTitle = 'Timeline',
  onFullscreenChange,
  onLayoutChange,
}) => {
  const {
    isTablet,
    isIPad,
    isDesktop,
    isMobile,
    isSplitView,
    splitRatio,
    layout,
    interactionMode,
    isPencilConnected,
    isFullscreenMode,
    setFullscreenMode,
  } = useTabletSupport();
  
  // Panel states for tablet
  const [showSidebar, setShowSidebar] = useState(!isTablet);
  const [showSecondarySidebar, setShowSecondarySidebar] = useState(!isTablet);
  const [showBottomPanel, setShowBottomPanel] = useState(!isMobile);
  const [activeTabletPanel, setActiveTabletPanel] = useState<'sidebar' | 'secondary' | 'bottom' | null>(null);
  
  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const newValue = !isFullscreenMode;
    setFullscreenMode(newValue);
    onFullscreenChange?.(newValue);
    
    // Actual fullscreen API
    if (newValue) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreenMode, setFullscreenMode, onFullscreenChange]);
  
  // Get input mode icon
  const getInputModeIcon = () => {
    switch (interactionMode) {
      case 'pencil':
        return <Create sx={{ fontSize: 16 }} />;
      case 'touch':
        return <TouchApp sx={{ fontSize: 16 }} />;
      default:
        return <Mouse sx={{ fontSize: 16 }} />;
    }
  };
  
  const getInputModeLabel = () => {
    switch (interactionMode) {
      case 'pencil':
        return 'Apple Pencil';
      case 'touch':
        return 'Touch';
      default:
        return 'Mouse';
    }
  };
  
  return (
    <LayoutContainer>
      {/* Split View Indicator (iPad) */}
      {isSplitView && (
        <SplitViewIndicator>
          <Splitscreen sx={{ fontSize: 14 }} />
          Split View ({Math.round(splitRatio * 100)}%)
        </SplitViewIndicator>
      )}
      
      {/* Header */}
      {!isFullscreenMode && (
        <HeaderBar height={headerHeight}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {/* Menu button on tablet/mobile */}
            {(isTablet || isMobile) && (
              <TabletIconButton onClick={() => setShowSecondarySidebar(true)}>
                <MenuIcon />
              </TabletIconButton>
            )}
            
            {header}
          </Stack>
          
          <Stack direction="row" alignItems="center" spacing={2}>
            {/* Input mode indicator */}
            <InputModeIndicator mode={interactionMode}>
              {getInputModeIcon()}
              {getInputModeLabel()}
            </InputModeIndicator>
            
            {/* Fullscreen toggle */}
            <TabletIconButton onClick={toggleFullscreen}>
              {isFullscreenMode ? <FullscreenExit /> : <Fullscreen />}
            </TabletIconButton>
          </Stack>
        </HeaderBar>
      )}
      
      <MainContent>
        {/* Secondary Sidebar (Scene hierarchy) - Desktop only inline */}
        {isDesktop && secondarySidebar && showSecondarySidebar && (
          <Box
            sx={{
              width: secondarySidebarWidth,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: '#1a1a2e',
              overflow: 'auto'}}
          >
            {secondarySidebar}
          </Box>
        )}
        
        {/* Center content area */}
        <CenterArea>
          <GestureView
            style={{ width: '100%', height: '100%' }}
            onPinchZoom={(scale) => {
              // Could dispatch to a zoom handler
              log.debug('Pinch zoom:', scale);
            }}
          >
            {children}
          </GestureView>
          
          {/* Floating toolbar */}
          {toolbar && (isTablet || isMobile) && (
            <TabletToolbar position="floating" autoHide autoHideDelay={5000}>
              {toolbar}
            </TabletToolbar>
          )}
          
          {/* Desktop inline toolbar */}
          {toolbar && isDesktop && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)'}}
            >
              <Paper
                sx={{
                  p: 1,
                  display: 'flex',
                  gap: 1,
                  bgcolor: 'rgba(26, 26, 46, 0.9)',
                  backdropFilter: 'blur(8px)'}}
              >
                {toolbar}
              </Paper>
            </Box>
          )}
        </CenterArea>
        
        {/* Primary Sidebar (Properties) - Desktop only inline */}
        {isDesktop && sidebar && showSidebar && (
          <Box
            sx={{
              width: sidebarWidth,
              flexShrink: 0,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: '#1a1a2e',
              overflow: 'auto'}}
          >
            {sidebar}
          </Box>
        )}
      </MainContent>
      
      {/* Bottom Panel - Desktop only inline */}
      {isDesktop && bottomPanel && showBottomPanel && (
        <Box
          sx={{
            height: bottomPanelHeight,
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: '#1a1a2e',
            overflow: 'auto'}}
        >
          {bottomPanel}
        </Box>
      )}
      
      {/* Tablet/Mobile: Floating panel buttons */}
      {(isTablet || isMobile) && (
        <>
          {/* Sidebar toggle */}
          {sidebar && (
            <Zoom in={!activeTabletPanel}>
              <FloatingPanelButton
                size="medium"
                sx={{ right: 16 }}
                onClick={() => setActiveTabletPanel('sidebar')}
              >
                <Badge
                  color="primary"
                  variant="dot"
                  invisible={!isPencilConnected}
                >
                  <Settings />
                </Badge>
              </FloatingPanelButton>
            </Zoom>
          )}
          
          {/* Scene hierarchy toggle */}
          {secondarySidebar && (
            <Zoom in={!activeTabletPanel}>
              <FloatingPanelButton
                size="medium"
                sx={{ left: 16 }}
                onClick={() => setActiveTabletPanel('secondary')}
              >
                <ViewSidebar />
              </FloatingPanelButton>
            </Zoom>
          )}
          
          {/* Bottom panel toggle */}
          {bottomPanel && (
            <Zoom in={!activeTabletPanel}>
              <FloatingPanelButton
                size="small"
                sx={{ right: 16, bottom: 140 }}
                onClick={() => setActiveTabletPanel('bottom')}
              >
                <ViewModule />
              </FloatingPanelButton>
            </Zoom>
          )}
        </>
      )}
      
      {/* Tablet/Mobile: Bottom sheets for panels */}
      {(isTablet || isMobile) && sidebar && (
        <TabletBottomSheet
          isOpen={activeTabletPanel === 'sidebar'}
          onClose={() => setActiveTabletPanel(null)}
          title={sidebarTitle}
          height="70vh"
        >
          {sidebar}
        </TabletBottomSheet>
      )}
      
      {(isTablet || isMobile) && secondarySidebar && (
        <TabletBottomSheet
          isOpen={activeTabletPanel === 'secondary'}
          onClose={() => setActiveTabletPanel(null)}
          title={secondarySidebarTitle}
          height="60vh"
        >
          {secondarySidebar}
        </TabletBottomSheet>
      )}
      
      {(isTablet || isMobile) && bottomPanel && (
        <TabletBottomSheet
          isOpen={activeTabletPanel === 'bottom'}
          onClose={() => setActiveTabletPanel(null)}
          title={bottomPanelTitle}
          height="50vh"
        >
          {bottomPanel}
        </TabletBottomSheet>
      )}
      
      {/* Fullscreen exit button */}
      {isFullscreenMode && (
        <Zoom in>
          <Fab
            size="small"
            onClick={toggleFullscreen}
            sx={{
              position: 'fixed',
              top: 16,
              right: 16,
              bgcolor: 'rgba(0,0,0,0.5)'}}
          >
            <FullscreenExit />
          </Fab>
        </Zoom>
      )}
    </LayoutContainer>
  );
};

// =============================================================================
// Main Component (wraps with Provider)
// =============================================================================

export const VirtualStudioLayout: React.FC<VirtualStudioLayoutProps> = (props) => {
  return (
    <TabletSupportProvider>
      <VirtualStudioLayoutInner {...props} />
    </TabletSupportProvider>
  );
};

// =============================================================================
// Export utility components
// =============================================================================

export { TabletOnly, DesktopOnly, PencilOnly, ResponsiveRender };

export default VirtualStudioLayout;

