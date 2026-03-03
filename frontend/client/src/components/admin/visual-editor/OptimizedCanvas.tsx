/**
 * OptimizedCanvas Component
 * High-performance canvas component with optimization features
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useMemo, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  ButtonGroup,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  Settings,
  Speed as Speed,
  Memory,
  Visibility,
  Analytics,
  Warning,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { useCanvasOptimization, UseCanvasOptimizationOptions } from '../../../hooks/useCanvasOptimization';
import { CanvasConfig, RenderObject, Viewport } from '../../../utils/canvasOptimizer';

interface OptimizedCanvasProps {
  width?: number;
  height?: number;
  config?: Partial<CanvasConfig>;
  objects?: RenderObject[];
  viewport?: Partial<Viewport>;
  onObjectClick?: (obj: RenderObject) => void;
  onObjectHover?: (obj: RenderObject | null) => void;
  onViewportChange?: (viewport: Viewport) => void;
  showMetrics?: boolean;
  showOptimization?: boolean;
  showControls?: boolean;
  className?: string;
  style?: React.CSSProperties
}

const OptimizedCanvas: React.FC<OptimizedCanvasProps> = memo(({
  width = 80,
  height = 600,
  config = {},
  objects = [],
  viewport = {},
  onObjectClick,
  onObjectHover,
  onViewportChange,
  showMetrics = true,
  showOptimization = true,
  showControls = true,
  className,
  style
}) => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredObject, setHoveredObject] = useState<RenderObject | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [optimizationLevel, setOptimizationLevel] = useState<'low' | 'medium' | 'high'>('medium');

  // Canvas optimization options
  const optimizationOptions: UseCanvasOptimizationOptions = useMemo(() => ({
    config: {
      enableHardwareAcceleration: true,
      enableOffscreenCanvas: true,
      enableWebGL: false,
      enableImageSmoothing: true,
      enablePixelRatioScaling: true,
      enableViewportCulling: true,
      enableLOD: true,
      enableBatching: true,
      enableCaching: true,
      maxFPS:  60,
      targetFPS: optimizationLevel === 'high' ? 60 : optimizationLevel === 'medium' ? 30 : 15,
      renderDistance: optimizationLevel === 'high' ? 2000 : optimizationLevel === 'medium' ? 1000 : 50,
      cacheSize: optimizationLevel === 'high' ? 100 : optimizationLevel === 'medium' ? 50 : 25,
      ...config
  },
    autoStart: true,
    enableMetrics: showMetrics,
    enableOptimization: showOptimization,
    onMetricsUpdate: (_metrics) => {
      console.debug('Canvas metrics updated');
},
    onOptimizationUpdate: (_result) => {
      console.debug('Canvas optimization updated');
}
}), [config, showMetrics, showOptimization, optimizationLevel]);

  // Use canvas optimization hook
  const {
    canvasRef,
    metrics,
    optimizationResult,
    isRendering,
    startRendering,
    stopRendering,
    addObject,
    removeObject,
    updateObject,
    setViewport,
    updateConfig,
    getOptimizationRecommendations,
    clearCanvas,
    resetMetrics
} = useCanvasOptimization(optimizationOptions);

  // Update viewport when props change
  useEffect(() => {
    if (viewport && Object.keys(viewport).length > 0) {
      setViewport(viewport);
  }
}, [viewport, setViewport]);

  // Add objects when props change
  useEffect(() => {
    objects.forEach(obj => {
      addObject(obj);
  });
}, [objects, addObject]);

  // Handle mouse down
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });

    // Check for object clicks
    if (onObjectClick) {
      const clickedObject = objects.find(obj => 
        x >= obj.x && x <= obj.x + obj.width &&
        y >= obj.y && y <= obj.y + obj.height
      );
      
      if (clickedObject) {
        onObjectClick(clickedObject);
    }
  }
}, [objects, onObjectClick]);

  // Handle mouse move
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const deltaX = x - dragStart.x;
    const deltaY = y - dragStart.y;

    // Update viewport
    const newViewport = {
      x: viewport.x || 0 - deltaX,
      y: viewport.y || 0 - deltaY
};

    setViewport(newViewport);
    
    if (onViewportChange) {
      onViewportChange({
        x: newViewport.x,
        y: newViewport.y,
        width: viewport.width || width,
        height: viewport.height || height,
        zoom: viewport.zoom || 1,
        rotation: viewport.rotation || 0 });
  }
}, [isDragging, dragStart, viewport, width, height, setViewport, onViewportChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
}, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredObject(null);
    
    if (onObjectHover) {
      onObjectHover(null);
  }
}, [onObjectHover]);

  // Handle object hover
  const handleMouseOver = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hovered = objects.find(obj => 
      x >= obj.x && x <= obj.x + obj.width &&
      y >= obj.y && y <= obj.y + obj.height
    );
    const nextHovered = hovered ?? null;

    if (nextHovered !== hoveredObject) {
      setHoveredObject(nextHovered);
      
      if (onObjectHover) {
        onObjectHover(nextHovered);
  }
  }
}, [objects, hoveredObject, onObjectHover]);

  // Handle optimization level change
  const handleOptimizationLevelChange = useCallback((level: 'low' | 'medium' | 'high') => {
    setOptimizationLevel(level);
    
    const newConfig: Partial<CanvasConfig> = {
      targetFPS: level === 'high' ? 60 : level === 'medium' ? 30 : 15,
      renderDistance: level === 'high' ? 2000 : level === 'medium' ? 1000 : 50,
      cacheSize: level === 'high' ? 100 : level === 'medium' ? 50 : 25 };
    
    updateConfig(newConfig);
}, [updateConfig]);

  // Get performance status
  const getPerformanceStatus = useCallback(() => {
    if (metrics.fps >= 50) return { status: 'excellent', color: 'success' as const, icon: CheckCircle };
    if (metrics.fps >= 30) return { status: 'good', color: 'info' as const, icon: CheckCircle };
    if (metrics.fps >= 15) return { status: 'fair', color: 'warning' as const, icon: Warning };
    return { status: 'poor', color: 'error' as const, icon: Error };
}, [metrics.fps]);

  // Get memory status
  const getMemoryStatus = useCallback(() => {
    if (metrics.memoryUsage < 50) return { status: 'excellent', color: 'success' as const };
    if (metrics.memoryUsage < 100) return { status: 'good', color: 'info' as const };
    if (metrics.memoryUsage < 200) return { status: 'fair', color: 'warning' as const };
    return { status: 'poor', color: 'error' as const };
}, [metrics.memoryUsage]);

  const performanceStatus = getPerformanceStatus();
  const memoryStatus = getMemoryStatus();

  return (
    <Box className={className} style={style}>
      {/* Controls */}
      {showControls && (
        <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <ButtonGroup size="small">
                <Button startIcon={theming.getThemedIcon('play')}
                  onClick={startRendering}
                  disabled={isRendering}
                  variant="contained"
                 sx={theming.getThemedButtonSx()}>
                  Start
                </Button>
                <Button
                  startIcon={theming.getThemedIcon('pause')}
                  onClick={stopRendering}
                  disabled={!isRendering}
                  variant="outlined"
                >
                  Pause
                </Button>
                <Button
                  startIcon={theming.getThemedIcon('stop')}
                  onClick={stopRendering}
                  variant="outlined"
                >
                  Stop
                </Button>
              </ButtonGroup>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Optimization</InputLabel>
                <Select
                  value={optimizationLevel}
                  onChange={(e) => handleOptimizationLevelChange(e.target.value as 'low' | 'medium' | 'high')}
                  label="Optimization"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Button
                startIcon={theming.getThemedIcon('settings')}
                onClick={() => setShowSettings(!showSettings)}
                variant="outlined"
                size="small"
              >
                Settings
              </Button>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Button
                startIcon={theming.getThemedIcon('refresh')}
                onClick={resetMetrics}
                variant="outlined"
                size="small"
              >
                Reset Metrics
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Canvas Settings
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Hardware Acceleration"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Viewport Culling"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Object Batching"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Caching"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Canvas */}
      <Paper elevation={2} sx={{ position: 'relative',  ...theming.getThemedCardSx() }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseOver={handleMouseOver}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'block',
            width: '100%',
            height: 'auto'
      }}
        />
        
        {/* Hover indicator */}
        {hoveredObject && (
          <Box
            sx={{
              position: 'absolute',
              left: hoveredObject.x,
              top: hoveredObject.y,
              width: hoveredObject.width,
              height: hoveredObject.height,
              border: '2px dashed',
              borderColor: 'primary.main',
              pointerEvents: 'none',
              zIndex: 1}}
          />
        )}
      </Paper>

      {/* Metrics */}
      {showMetrics && (
        <Paper elevation={2} sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Performance Metrics
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Speed color="primary" sx={{ mr:  1 }} />
                    <Typography variant="subtitle2">FPS</Typography>
                  </Box>
                  <Typography variant="h4" color={performanceStatus.color} sx={{ color: theming.colors.primary }}>
                    {metrics.fps}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((metrics.fps / 60) * 100, 100)}
                    color={performanceStatus.color}
                    sx={{ mt:  1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Memory color="primary" sx={{ mr:  1 }} />
                    <Typography variant="subtitle2">Memory</Typography>
                  </Box>
                  <Typography variant="h4" color={memoryStatus.color} sx={{ color: theming.colors.primary }}>
                    {metrics.memoryUsage.toFixed(1)}MB
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((metrics.memoryUsage / 200) * 100, 100)}
                    color={memoryStatus.color}
                    sx={{ mt:  1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Analytics color="primary" sx={{ mr:  1 }} />
                    <Typography variant="subtitle2">Draw Calls</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {metrics.drawCalls}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Visibility color="primary" sx={{ mr:  1 }} />
                    <Typography variant="subtitle2">Objects</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {objects.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Optimization Recommendations */}
      {showOptimization && optimizationResult && (
        <Paper elevation={2} sx={{ p: 2, mt: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Optimization Recommendations
          </Typography>
          
          {optimizationResult.improvements.length > 0 && (
            <Alert severity="warning" sx={{ mb:  2 }}>
              <AlertTitle>Performance Issues Detected</AlertTitle>
              {optimizationResult.improvements.map((improvement, index) => (
                <Typography key={index} variant="body2">
                  • {improvement.description}: {improvement.before} → {improvement.after} 
                  ({improvement.improvement > 0 ? '+' : ','},{improvement.improvement})
                </Typography>
              ))}
            </Alert>
          )}
          
          {optimizationResult.recommendations.length > 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Recommendations: </Typography>
              {optimizationResult.recommendations.map((rec, index) => (
                <Chip
                  key={index}
                  label={rec.description}
                  color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'default'}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
});

OptimizedCanvas.displayName ='OptimizedCanvas';

export default OptimizedCanvas;




