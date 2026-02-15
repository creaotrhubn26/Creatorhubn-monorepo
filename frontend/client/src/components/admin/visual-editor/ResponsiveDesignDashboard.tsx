/**
 * ResponsiveDesignDashboard Component
 * Responsive design dashboard with management and monitoring
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  Tooltip, 
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tabs,
  Tab
} from '@mui/material';
import {
  Devices,
  Settings,
  CheckCircle,
  Error,
  Warning,
  KeyboardArrowDown,
  CircularProgress as CircularProgressIcon,
  PhoneAndroid,
  Tablet,
  Laptop,
  AspectRatio
} from '@mui/icons-material';
import { useResponsiveDesign, UseResponsiveDesignOptions } from '../../../hooks/useResponsiveDesign';
import { ResponsiveConfig } from '../../../utils/responsiveDesignManager';

interface ResponsiveDesignDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showBreakpoints?: boolean;
  showDevices?: boolean;
  showPerformance?: boolean;
  showAccessibility?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onBreakpointsClick?: () => void;
  onDevicesClick?: () => void;
  onPerformanceClick?: () => void;
  onAccessibilityClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const ResponsiveDesignDashboard: React.FC<ResponsiveDesignDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showBreakpoints = true,
  showDevices = true,
  showPerformance = true,
  showAccessibility = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onBreakpointsClick,
  onDevicesClick,
  onPerformanceClick,
  onAccessibilityClick,
  className,
  style
}) => {
  const [showResponsiveDialog, setShowResponsiveDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showBreakpointsDialog, setShowBreakpointsDialog] = useState(false);
  const [showDevicesDialog, setShowDevicesDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [showAccessibilityDialog, setShowAccessibilityDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Responsive design options
  const responsiveOptions: UseResponsiveDesignOptions = useMemo(() => ({
    onBreakpointChanged: (_data: { breakpoint: string }) => {
      setFilterType('all');
      setPage(0);
  },
    onOrientationChanged: (_data: { orientation: 'portrait' | 'landscape' }) => {
      setPage(0);
  },
    onViewportChanged: (_data: { viewport: { width: number; height: number; scale: number } }) => {
      setPage(0);
  },
    onDeviceTypeChanged: (_data: { deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' }) => {
      setPage(0);
  },
    onTouchSupportChanged: (_data: { touchSupport: boolean }) => {
      setPage(0);
  },
    onAccessibilityMetricsChanged: (_data: { metrics: Record<string, unknown> }) => {
      setPage(0);
  },
    onElementResized: (_data: { element: Element; size: DOMRectReadOnly }) => {
      setPage(0);
  },
    onElementVisible: (_data: { element: Element }) => {
      setPage(0);
  },
    onError: (error: string) => {
      console.error('Responsive design error:', error);
    },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use responsive design hook
  const {
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    currentBreakpoint,
    currentOrientation,
    currentViewport,
    deviceType,
    touchSupport,
    orientationSupport,
    viewportSupport,
    performanceMetrics,
    accessibilityMetrics,
    totalBreakpointChanges,
    totalOrientationChanges,
    totalViewportChanges,
    totalPerformanceIssues,
    totalAccessibilityIssues,
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl
} = useResponsiveDesign(responsiveOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle management click
  const handleManagementClick = useCallback(() => {
    if (onManagementClick) {
      onManagementClick();
  } else {
      setShowManagementDialog(true);
  }
}, [onManagementClick]);

  // Handle monitoring click
  const handleMonitoringClick = useCallback(() => {
    if (onMonitoringClick) {
      onMonitoringClick();
  } else {
      setShowMonitoringDialog(true);
  }
}, [onMonitoringClick]);

  // Handle breakpoints click
  const handleBreakpointsClick = useCallback(() => {
    if (onBreakpointsClick) {
      onBreakpointsClick();
  } else {
      setShowBreakpointsDialog(true);
  }
}, [onBreakpointsClick]);

  // Handle devices click
  const handleDevicesClick = useCallback(() => {
    if (onDevicesClick) {
      onDevicesClick();
  } else {
      setShowDevicesDialog(true);
  }
}, [onDevicesClick]);

  // Handle performance click
  const handlePerformanceClick = useCallback(() => {
    if (onPerformanceClick) {
      onPerformanceClick();
  } else {
      setShowPerformanceDialog(true);
  }
}, [onPerformanceClick]);

  // Handle accessibility click
  const handleAccessibilityClick = useCallback(() => {
    if (onAccessibilityClick) {
      onAccessibilityClick();
  } else {
      setShowAccessibilityDialog(true);
  }
}, [onAccessibilityClick]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <Devices />;
    return theming.getThemedIcon('warning');
}, [hasError, isInitialized, isEnabled]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Disabled';
}, [hasError, isInitialized, isEnabled]);

  // Get device icon
  const getDeviceIcon = useCallback(() => {
    if (isMobile) return <PhoneAndroid />;
    if (isTablet) return <Tablet />;
    if (isDesktop) return <Laptop />;
    return <Devices />;
}, [isMobile, isTablet, isDesktop]);

  // Get orientation icon
  const getOrientationIcon = useCallback(() => {
    if (isPortrait) return theming.getThemedIcon('cropPortrait');
    if (isLandscape) return theming.getThemedIcon('cropLandscape');
    return <AspectRatio />;
}, [isPortrait, isLandscape]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,  };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Responsive: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={currentBreakpoint}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowResponsiveDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowResponsiveDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {currentBreakpoint} • {deviceType}
          </Typography>
          <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
            {currentViewport.width}×{currentViewport.height}
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Devices color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Responsive Design
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Breakpoint
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {currentBreakpoint}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Device
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getDeviceIcon()}
                <Typography variant="body2" color="text.secondary">
                  {deviceType}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Orientation
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getOrientationIcon()}
                <Typography variant="body2" color="text.secondary">
                  {currentOrientation}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon()}
                <Typography variant="body2" color={getStatusColor() + '.main'}>
                  {getStatusText()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          Viewport: {currentViewport.width}×{currentViewport.height} • Scale: {currentViewport.scale}x
        </Typography>
      </Box>
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Responsive Dialog */}
      <Dialog open={showResponsiveDialog} onClose={() => setShowResponsiveDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Devices />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Responsive Design Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Breakpoints" />
            <Tab label="Devices" />
            <Tab label="Performance" />
            <Tab label="Accessibility" />
            <Tab label="Monitoring" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Current Breakpoint
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {currentBreakpoint}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Device Type
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getDeviceIcon()}
                      <Typography variant="body2" color="text.secondary">
                        {deviceType}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Orientation
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getOrientationIcon()}
                      <Typography variant="body2" color="text.secondary">
                        {currentOrientation}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon()}
                      <Typography variant="body2" color={getStatusColor() + '.main'}>
                        {getStatusText()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Breakpoint Management
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        XS (0px+)
                      </Typography>
                      <Typography variant="h4" color={isXs ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isXs ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        SM (600px+)
                      </Typography>
                      <Typography variant="h4" color={isSm ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isSm ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        MD (900px+)
                      </Typography>
                      <Typography variant="h4" color={isMd ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isMd ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        LG (1200px+)
                      </Typography>
                      <Typography variant="h4" color={isLg ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isLg ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        XL (1536px+)
                      </Typography>
                      <Typography variant="h4" color={isXl ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isXl ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        XXL (1920px+)
                      </Typography>
                      <Typography variant="h4" color={isXxl ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isXxl ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Device Management
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Mobile
                      </Typography>
                      <Typography variant="h4" color={isMobile ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isMobile ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Tablet
                      </Typography>
                      <Typography variant="h4" color={isTablet ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isTablet ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Desktop
                      </Typography>
                      <Typography variant="h4" color={isDesktop ? 'primary' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                        {isDesktop ? 'Active' : 'Inactive'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Layout Shift
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics.layoutShift.toFixed(3)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        First Contentful Paint
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics.firstContentfulPaint.toFixed(2)}s
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Largest Contentful Paint
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics.largestContentfulPaint.toFixed(2)}s
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        First Input Delay
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics.firstInputDelay.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Accessibility Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Color Contrast
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                        {accessibilityMetrics.colorContrast.toFixed(1)}:1
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Text Size
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {accessibilityMetrics.textSize}px
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Focus Visibility
                      </Typography>
                      <Typography variant="h4" color={accessibilityMetrics.focusVisibility ? 'success' : 'error'} sx={{ color: theming.colors.primary }}>
                        {accessibilityMetrics.focusVisibility ? 'Yes' : 'No'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Keyboard Navigation
                      </Typography>
                      <Typography variant="h4" color={accessibilityMetrics.keyboardNavigation ? 'success' : 'error'} sx={{ color: theming.colors.primary }}>
                        {accessibilityMetrics.keyboardNavigation ? 'Yes' : 'No'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                System Monitoring
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Breakpoint Changes
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {totalBreakpointChanges}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Orientation Changes
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {totalOrientationChanges}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Viewport Changes
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {totalViewportChanges}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Performance Issues
                      </Typography>
                      <Typography variant="h4" color={totalPerformanceIssues > 0 ? 'error' : 'success'} sx={{ color: theming.colors.primary }}>
                        {totalPerformanceIssues}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowResponsiveDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Responsive Design Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableResponsive}
                    onChange={(e) => updateConfig({ enableResponsive: e.target.checked })}
                  />
              }
                label="Enable Responsive Design"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBreakpoints}
                    onChange={(e) => updateConfig({ enableBreakpoints: e.target.checked })}
                  />
              }
                label="Enable Breakpoints"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableFluidLayout}
                    onChange={(e) => updateConfig({ enableFluidLayout: e.target.checked })}
                  />
              }
                label="Enable Fluid Layout"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAdaptiveImages}
                    onChange={(e) => updateConfig({ enableAdaptiveImages: e.target.checked })}
                  />
              }
                label="Enable Adaptive Images"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTouchOptimization}
                    onChange={(e) => updateConfig({ enableTouchOptimization: e.target.checked })}
                  />
              }
                label="Enable Touch Optimization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableOrientationSupport}
                    onChange={(e) => updateConfig({ enableOrientationSupport: e.target.checked })}
                  />
              }
                label="Enable Orientation Support"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableViewportManagement}
                    onChange={(e) => updateConfig({ enableViewportManagement: e.target.checked })}
                  />
              }
                label="Enable Viewport Management"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePerformanceOptimization}
                    onChange={(e) => updateConfig({ enablePerformanceOptimization: e.target.checked })}
                  />
              }
                label="Enable Performance Optimization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAccessibility}
                    onChange={(e) => updateConfig({ enableAccessibility: e.target.checked })}
                  />
              }
                label="Enable Accessibility"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTesting}
                    onChange={(e) => updateConfig({ enableTesting: e.target.checked })}
                  />
              }
                label="Enable Testing"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

ResponsiveDesignDashboard.displayName ='ResponsiveDesignDashboard';

export default ResponsiveDesignDashboard;





