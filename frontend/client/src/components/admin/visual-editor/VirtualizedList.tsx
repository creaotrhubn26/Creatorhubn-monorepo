/**
 * VirtualizedList Component
 * High-performance virtualized list component
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Avatar,
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
  VisibilityOff,
  Tune,
  Analytics,
  Warning,
  CheckCircle,
  Error,
  Search,
  FilterList,
  Sort,
  ViewList,
  ViewModule,
  ViewComfy,
} from '@mui/icons-material';
import type { UseVirtualizationOptions } from '../../../hooks/useVirtualization';
import { useVirtualization } from '../../../hooks/useVirtualization';
import type { VirtualItem, VirtualizationConfig } from '../../../utils/virtualizationUtils';

interface VirtualizedListProps {
  items: unknown[];
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  enableDynamicSizing?: boolean;
  enableSmoothScrolling?: boolean;
  enableMomentum?: boolean;
  onItemClick?: (item: unknown, index: number) => void;
  onItemSelect?: (item: unknown, index: number, selected: boolean) => void;
  onItemRender?: (item: unknown, index: number) => React.ReactNode;
  onScroll?: (scrollTop: number) => void;
  showMetrics?: boolean;
  showControls?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  showSorting?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  filters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
}>;
  sortOptions?: Array<{
    key: string;
    label: string;
    direction: 'asc' | 'desc';
    onChange: (key: string, direction: 'asc' | 'desc') => void;
}>;
  selectedItems?: Set<number>;
  onSelectionChange?: (selectedItems: Set<number>) => void;
  className?: string;
  style?: React.CSSProperties
}

const VirtualizedList: React.FC<VirtualizedListProps> = memo(({
  items,
  itemHeight = 50,
  containerHeight = 400,
  overscan = 5,
  enableDynamicSizing = false,
  enableSmoothScrolling = true,
  enableMomentum = true,
  onItemClick,
  onItemSelect,
  onItemRender,
  onScroll,
  showMetrics = true,
  showControls = true,
  showSearch = false,
  showFilters = false,
  showSorting = false,
  searchQuery = '',
  onSearchChange,
  filters = [],
  sortOptions = [],
  selectedItems = new Set<number>(),
  onSelectionChange,
  className,
  style
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'comfortable'>('list');
  const [showSettings, setShowSettings] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [optimizationLevel, setOptimizationLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [filteredItems, setFilteredItems] = useState(items);
  const [sortedItems, setSortedItems] = useState(items);

  const toRecord = useCallback((value: unknown): Record<string, unknown> => {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }, []);

  const toComparableValue = useCallback((value: unknown): string | number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value.toLowerCase();
    if (typeof value === 'boolean') return value ? 1 : 0;
    return '';
  }, []);

  const toDisplayString = useCallback((value: unknown, fallback: string): string => {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }, []);

  // Virtualization configuration
  const virtualizationConfig: Partial<VirtualizationConfig> = useMemo(() => ({
    itemHeight: itemHeight,
    containerHeight: containerHeight,
    overscan: overscan,
    enableDynamicSizing: enableDynamicSizing,
    enableSmoothScrolling: enableSmoothScrolling,
    enableMomentum: enableMomentum,
    enableVertical: true,
    enableHorizontal: false
}), [itemHeight, containerHeight, overscan, enableDynamicSizing, enableSmoothScrolling, enableMomentum]);

  // Virtualization options
  const renderCountRef = useRef(0);
  const virtualizationOptions: UseVirtualizationOptions = useMemo(() => ({
    config: virtualizationConfig,
    items: sortedItems,
    onItemRender: (_item: VirtualItem) => {
      renderCountRef.current += 1;
},
    onItemUnrender: (_item: VirtualItem) => {
      renderCountRef.current = Math.max(0, renderCountRef.current - 1);
},
    onScroll: (scrollTop: number) => {
      if (onScroll) {
        onScroll(scrollTop);
  }
  },
    onMetricsUpdate: (_metrics) => {
      // Metrics consumed by useVirtualization hook internally
},
    onStateUpdate: (_state) => {
      // State consumed by useVirtualization hook internally
}
}), [virtualizationConfig, sortedItems, onScroll]);

  // Use virtualization hook
  const {
    visibleItems,
    renderedItems,
    state,
    metrics,
    scrollToItem,
    getItemAtPosition,
    updateConfig,
    getOptimizationRecommendations,
    reset
} = useVirtualization(virtualizationOptions);

  // Filter items
  useEffect(() => {
    if (!searchQuery && filters.length === 0) {
      setFilteredItems(items);
      return;
  }

    let filtered = items;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
      );
  }

    // Apply filters
    filters.forEach(filter => {
      if (filter.value) {
        filtered = filtered.filter(item => toRecord(item)[filter.key] === filter.value);
    }
  });

    setFilteredItems(filtered);
}, [items, searchQuery, filters]);

  // Sort items
  useEffect(() => {
    if (sortOptions.length === 0) {
      setSortedItems(filteredItems);
      return;
  }

    const sorted = [...filteredItems];

    sortOptions.forEach(sort => {
      sorted.sort((a, b) => {
        const aVal = toComparableValue(toRecord(a)[sort.key]);
        const bVal = toComparableValue(toRecord(b)[sort.key]);
        
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
    });
  });

    setSortedItems(sorted);
}, [filteredItems, sortOptions, toComparableValue, toRecord]);

  // Handle item click
  const handleItemClick = useCallback((item: unknown, index: number) => {
    if (onItemClick) {
      onItemClick(item, index);
  }
}, [onItemClick]);

  // Handle item select
  const handleItemSelect = useCallback((item: unknown, index: number, selected: boolean) => {
    if (onItemSelect) {
      onItemSelect(item, index, selected);
  }
    
    if (onSelectionChange) {
      const newSelected = new Set<number>(selectedItems);
      if (selected) {
        newSelected.add(index);
    } else {
        newSelected.delete(index);
    }
      onSelectionChange(newSelected);
  }
}, [onItemSelect, onSelectionChange, selectedItems]);

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop;
    virtualizationOptions.onScroll?.(scrollTop, 0);
}, [virtualizationOptions]);

  // Handle optimization level change
  const handleOptimizationLevelChange = useCallback((level: 'low' | 'medium' | 'high') => {
    setOptimizationLevel(level);
    
    const newConfig: Partial<VirtualizationConfig> = {
      overscan: level === 'high' ? 10 : level === 'medium' ? 5 : 2,
      enableSmoothScrolling: level !== 'low',
      enableMomentum: level !== 'low'
};
    
    updateConfig(newConfig);
}, [updateConfig]);

  // Get performance status
  const getPerformanceStatus = useCallback(() => {
    if (metrics.performanceScore >= 80) return { status: 'excellent', color: 'success' as const, icon: CheckCircle };
    if (metrics.performanceScore >= 60) return { status: 'good', color: 'info' as const, icon: CheckCircle };
    if (metrics.performanceScore >= 40) return { status: 'fair', color: 'warning' as const, icon: Warning };
    return { status: 'poor', color: 'error' as const, icon: Error };
}, [metrics.performanceScore]);

  // Get memory status
  const getMemoryStatus = useCallback(() => {
    if (metrics.memoryUsage < 50) return { status: 'excellent', color: 'success' as const };
    if (metrics.memoryUsage < 100) return { status: 'good', color: 'info' as const };
    if (metrics.memoryUsage < 200) return { status: 'fair', color: 'warning' as const };
    return { status: 'poor', color: 'error' as const };
}, [metrics.memoryUsage]);

  const performanceStatus = getPerformanceStatus();
  const memoryStatus = getMemoryStatus();

  // Render item
  const renderItem = useCallback((item: VirtualItem) => {
    const { data, index } = item;
    const isSelected = selectedItems.has(index);
    const dataRecord = toRecord(data);
    const name = toDisplayString(dataRecord.name, `Item ${index + 1}`);
    const description = toDisplayString(dataRecord.description, `Description for item ${index + 1}`);
    const type = toDisplayString(dataRecord.type, 'default');
    
    if (onItemRender) {
      return onItemRender(data, index);
  }
    
    return (
      <ListItem
        key={item.key}
        disablePadding
        sx={{
          height: itemHeight,
          minHeight: itemHeight,
          maxHeight: itemHeight,
          position: 'absolute',
          top: item.start,
          left:  0,
          right:  0,
          width: '100%'
    }}
      >
        <ListItemButton
          onClick={() => handleItemClick(data, index)}
          selected={isSelected}
          sx={{ height: '100%' }}
        >
          <Checkbox
            checked={isSelected}
            onChange={(e) => handleItemSelect(data, index, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
          <Avatar sx={{ mr:  2 }}>
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <ListItemText
            primary={name}
            secondary={description}
          />
        </ListItemButton>
        <ListItemSecondaryAction>
          <Chip
            label={type}
            size="small"
            color="primary"
            variant="outlined"
          />
        </ListItemSecondaryAction>
      </ListItem>
    );
}, [itemHeight, selectedItems, onItemRender, handleItemClick, handleItemSelect, toDisplayString, toRecord]);

  return (
    <Box className={className} style={style}>
      {/* Controls */}
      {showControls && (
        <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <ButtonGroup size="small">
                <Button
                  startIcon={theming.getThemedIcon('refresh')}
                  onClick={reset}
                  variant="outlined"
                >
                  Reset
                </Button>
                <Button
                  startIcon={theming.getThemedIcon('settings')}
                  onClick={() => setShowSettings(!showSettings)}
                  variant="outlined"
                >
                  Settings
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
              <ButtonGroup size="small">
                <Button
                  startIcon={<ViewList />}
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'contained' : 'outlined'}
                >
                  List
                </Button>
                <Button
                  startIcon={<ViewModule />}
                  onClick={() => setViewMode('grid')}
                  variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                >
                  Grid
                </Button>
                <Button
                  startIcon={<ViewComfy />}
                  onClick={() => setViewMode('comfortable')}
                  variant={viewMode === 'comfortable' ? 'contained' : 'outlined'}
                >
                  Comfortable
                </Button>
              </ButtonGroup>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                {renderedItems.length} of {items.length} items
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Search and Filters */}
      {(showSearch || showFilters || showSorting) && (
        <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Grid container spacing={2} alignItems="center">
            {showSearch && (
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Search</InputLabel>
                  <Select
                    value={searchQuery}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    label="Search"
                    startAdornment={theming.getThemedIcon('search')}
                  />
                </FormControl>
              </Grid>
            )}
            
            {showFilters && filters.length > 0 && (
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  startIcon={theming.getThemedIcon('filter')}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  Filters ({filters.length})
                </Button>
              </Grid>
            )}
            
            {showSorting && sortOptions.length > 0 && (
              <Grid item xs={12} sm={6} md={4}>
                <Button
                  startIcon={theming.getThemedIcon('sort')}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  Sort ({sortOptions.length})
                </Button>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Virtualized List */}
      <Paper elevation={2} sx={{ position: 'relative',  ...theming.getThemedCardSx() }}>
        <Box
          ref={containerRef}
          onScroll={handleScroll}
          sx={{
            height: containerHeight,
            overflow: 'auto',
            position: 'relative'
      }}
        >
          <Box
            sx={{
              height: state.totalHeight,
              position: 'relative'
        }}
          >
            {renderedItems.map(renderItem)}
          </Box>
        </Box>
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
                    <Typography variant="subtitle2">Performance</Typography>
                  </Box>
                  <Typography variant="h4" color={performanceStatus.color} sx={{ color: theming.colors.primary }}>
                    {metrics.performanceScore.toFixed(0)}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={metrics.performanceScore}
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
                    <Visibility color="primary" sx={{ mr:  1 }} />
                    <Typography variant="subtitle2">Visible</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {metrics.visibleItems}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Analytics color="primary" sx={{ mr:  1 }} />
                    <Typography variant="subtitle2">Render Time</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {metrics.renderTime.toFixed(1)}ms
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
});

VirtualizedList.displayName ='VirtualizedList';

export default VirtualizedList;


