// @ts-nocheck
// client/src/components/notes/TableOfContents.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Box,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Tooltip,
  Badge,
  Stack,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Search,
  Clear,
  NavigateNext,
  NavigateBefore,
  Bookmark,
  BookmarkBorder,
  Visibility,
  VisibilityOff,
  Settings,
  Refresh,
  Download,
  Share,
  MoreVert,
  Timeline,
  Speed as Speed,
  LocalOffer,
  Category,
  Person,
  Schedule,
  TrendingUp,
  AutoAwesome,
  List as ListIcon,
  ViewList,
  ViewModule,
} from '@mui/icons-material';
import type { TOCItem, TOCSearchResult, TOCConfig } from '@/services/TableOfContentsService';
import TableOfContentsService from '@/services/TableOfContentsService';

interface TableOfContentsProps {
  content: string;
  contentId?: string;
  contentType?: 'html' | 'markdown' | 'text';
  onItemClick?: (item: TOCItem) => void;
  onConfigChange?: (config: TOCConfig) => void;
  className?: string;
  maxHeight?: number;
  showSearch?: boolean;
  showProgress?: boolean;
  showMetadata?: boolean;
  enableCollapse?: boolean;
  enableNavigation?: boolean;
  variant?: 'sidebar' | 'floating' | 'embedded';
  position?: 'left' | 'right' | 'top' | 'bottom'
}

export default function TableOfContents({
  content,
  contentId = 'default',
  contentType = 'html',
  onItemClick,
  onConfigChange,
  className,
  maxHeight = 400,
  showSearch = true,
  showProgress = true,
  showMetadata = true,
  enableCollapse = true,
  enableNavigation = true,
  variant = 'sidebar',
  position = 'right',
}: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [searchQuery, setSearchQuery] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [searchResults, setSearchResults] = useState<TOCSearchResult[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [currentSection, setCurrentSection] = useState<TOCItem | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<TOCConfig>(TableOfContentsService.getInstance().getConfig());
  const [viewMode, setViewMode] = useState<'tree' | 'flat' | 'compact'>('tree');
  const [sortBy, setSortBy] = useState<'position' | 'title' | 'level'>('position');
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  
  const tocService = TableOfContentsService.getInstance();
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate TOC when content changes
  useEffect(() => {
    if (!content) {
      setTocItems([]);
      return;
  }

    let newTocItems: TOCItem[] = [];
    
    switch (contentType) {
      case 'html':
        newTocItems = tocService.generateFromHTML(content, contentId);
        break;
      case 'markdown':
        newTocItems = tocService.generateFromMarkdown(content, contentId);
        break;
      case 'text':
        newTocItems = tocService.generateFromText(content, contentId);
        break;
  }

    setTocItems(newTocItems);
    
    // Auto-expand first level items
    if (enableCollapse) {
      const firstLevelItems = newTocItems.map(item => item.id);
      setExpandedItems(new Set(firstLevelItems));
  }
}, [content, contentId, contentType, enableCollapse, tocService]);

  // Update reading progress and current section
  useEffect(() => {
    const updateProgress = () => {
      setReadingProgress(tocService.getReadingProgress(contentId));
      setCurrentSection(tocService.getCurrentSection(contentId));
  };

    updateProgress();
    window.addEventListener('scroll,', updateProgress);
    window.addEventListener('resize', updateProgress);

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
  };
}, [contentId, tocService]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
}

    setIsSearching(true);
    const results = tocService.searchTOC(query, contentId);
    setSearchResults(results);
    setIsSearching(false);
}, [contentId, tocService]);

  // Handle item click
  const handleItemClick = useCallback((item: TOCItem) => {
    tocService.navigateToItem(item, config.enableSmoothScroll);
    onItemClick?.(item);
}, [tocService, config.enableSmoothScroll, onItemClick]);

  // Toggle item expansion
  const toggleExpansion = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
  } else {
        newSet.add(itemId);
    }
      return newSet;
  });
}, []);

  // Expand/collapse all
  const toggleAllExpansion = useCallback(() => {
    if (expandedItems.size === 0) {
      // Expand all
      const allItemIds = new Set<string>();
      const collectIds = (items: TOCItem[]) => {
        items.forEach(item => {
          allItemIds.add(item.id);
          if (item.children.length > 0) {
            collectIds(item.children);
      }
      });
    };
      collectIds(tocItems);
      setExpandedItems(allItemIds);
  } else {
      // Collapse all
      setExpandedItems(new Set());
  }
}, [expandedItems.size, tocItems]);

  // Update config
  const updateConfig = useCallback((newConfig: Partial<TOCConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    tocService.updateConfig(updatedConfig);
    onConfigChange?.(updatedConfig);
}, [config, tocService, onConfigChange]);

  // Render TOC item
  const renderTOCItem = (item: TOCItem, depth: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isCurrent = currentSection?.id === item.id;
    const hasChildren = item.children.length > 0;
    const isVisible = showOnlyVisible ? item.isVisible !== false : true;

    if (!isVisible) return null;

    return (
      <React.Fragment key={item.d}>
        <ListItem
          disablePadding
          sx={{
            pl: depth * 2,
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            },
          }}
        >
          <ListItemButton
            onClick={() => handleItemClick(item)}
            selected={isCurrent}
            sx={{
              borderRadius:  1,
              mb: 0.5, '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText', '&:hover': {
                  backgroundColor: 'primary.dark',
              },
            }}}
          >
            <ListItemIcon sx={{ minWidth: 32}}>
              {hasChildren ? (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpansion(item.id);
                }}
                >
                  {isExpanded ? theming.getThemedIcon('expandLess') : theming.getThemedIcon('expandMore')}
                </IconButton>
              ) : (
                <Box sx={{ width:  24, height:  24, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Box
                    sx={{
                      width:  4,
                      height:  4,
                      borderRadius: '50%',
                      backgroundColor: 'text.secondary'}}
                  />
                </Box>
              )}
            </ListItemIcon>

            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isCurrent ? 600 : 500,
                    fontSize: `${Math.max(0.5, 1 - depth * 0.1)}rem`,
                    color: isCurrent ? 'primary.contrastText' : 'text.primary'}}
                >
                  {item.title}
                </Typography>
            }
              secondary={
                showMetadata && (item.wordCount || item.readingTime || item.metadata?.tags) && (
                  <Box sx={{ mt: 0.5}}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      {item.wordCount && (
                        <Chip
                          size="small"
                          label={`${item.wordCount} ord`}
                          icon={theming.getThemedIcon('speed')}
                          sx={{ fontSize: '0.65rem', height: 20}}
                        />
                      )}
                      {item.readingTime && (
                        <Chip
                          size="small"
                          label={`${item.readingTime} min`}
                          icon={<Box />}
                          sx={{ fontSize: '0.65rem', height: 20}}
                        />
                      )}
                      {item.metadata?.tags && item.metadata.tags.length > 0 && (
                        <Chip
                          size="small"
                          label={item.metadata.tags[0]}
                          icon={<LocalOffer />}
                          sx={{ fontSize: '0.65rem', height: 20}}
                        />
                      )}
                    </Stack>
                  </Box>
                )
            }
            />

            {isCurrent && (
              <Box sx={{ ml:  1 }}>
                <Chip
                  size="small"
                  label="Nåværende"
                  color="primary"
                  sx={{ fontSize: '0.65rem', height: 20}}
                />
              </Box>
            )}
          </ListItemButton>
        </ListItem>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children.map(child => renderTOCItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
};

  // Render search results
  const renderSearchResults = () => {
    if (!isSearching && searchResults.length === 0) return null;

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Søkeresultater ({searchResults.length})
        </Typography>
        {searchResults.map((result, index) => (
          <ListItem
            key={`search-${index}`}
            button
            onClick={() => handleItemClick(result.item)}
            sx={{ borderRadius: 1, mb: 0.5}}
          >
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  dangerouslySetInnerHTML={{ __html: result.highlightedTitle }}
                />
            }
              secondary={
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Nivå {result.item.level} • {result.item.title}
                  </Typography>
                  {result.context && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {result.context}
                    </Typography>
                  )}
                </Box>
            }
            />
            <Chip
              size="small"
              label={`${result.matchScore}%`}
              color="primary"
              sx={{ fontSize: '0.65rem', height: 20}}
            />
          </ListItem>
        ))}
      </Box>
    );
};

  // Get filtered and sorted items
  const getFilteredItems = () => {
    let filtered = [...tocItems];

    // Filter by level
    if (filterLevel !== null) {
      const filterByLevel = (items: TOCItem[]): TOCItem[] => {
        return items
          .map((item) => ({
            ...item,
            children: item.children.length > 0 ? filterByLevel(item.children) : [],
          }))
          .filter((item) => item.level === filterLevel || item.children.length > 0);
      };
      filtered = filterByLevel(filtered);
  }

    // Sort items
    const sortItems = (items: TOCItem[]): TOCItem[] => {
      return items
        .slice()
        .sort((a, b) => {
        switch (sortBy) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'level':
            return a.level - b.level;
          case 'position':
          default: return a.position - b.position;
        }
      })
        .map((item) => ({
          ...item,
          children: item.children.length > 0 ? sortItems(item.children) : [],
        }));
  };

    return sortItems(filtered);
};

  const filteredItems = getFilteredItems();

  return (
    <Paper
      className={className}
      elevation={variant === 'floating' ? 8 : 2}
      sx={{
        maxHeight,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...(variant === 'floating' && {
          position: 'fixed',
          top:  20,
          [position]: 20,
          zIndex: 10,
          minWidth: 30,
          maxWidth: 40,
      })}}
     sx={theming.getThemedCardSx()}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="h6" component="h2" sx={{ color: theming.colors.primary }}>
            Innholdsfortegnelse
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Innstillinger">
              <IconButton size="small" onClick={() => setShowSettings(true)}>
                {theming.getThemedIcon('settings')}
              </IconButton>
            </Tooltip>
            <Tooltip title="Oppdater">
              <IconButton size="small" onClick={() => window.location.reload()}>
                {theming.getThemedIcon('refresh')}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Search */}
        {showSearch && (
          <TextField
            fullWidth
            size="small"
            placeholder="Søk i innhold..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {isSearching ? theming.getThemedIcon(', ') : theming.getThemedIcon('search')}
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => handleSearch(', ')}>
                    {theming.getThemedIcon('clear')}
                  </IconButton>
                </InputAdornment>
              )}}
            sx={{ mt:  1 }}
          />
        )}

        {/* Progress bar */}
        {showProgress && (
          <Box sx={{ mt:  1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Fremgang
              </Typography>
              <LinearProgress
                variant="determinate"
                value={readingProgress}
                sx={{ flex: 1, height:  4, borderRadius:  2 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round(readingProgress)}%
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto'}}>
        {searchQuery ? (
          renderSearchResults()
        ) : (
          <List dense>
            {filteredItems.map(item => renderTOCItem(item))}
          </List>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider'}}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {tocItems.length} seksjoner
          </Typography>
          {enableCollapse && (
            <Button size="small" onClick={toggleAllExpansion}>
              {expandedItems.size === 0 ? 'Utvid alle' : 'Skjul alle'}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Settings Dialog */}
      <Menu
        open={showSettings}
        onClose={() => setShowSettings(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
        transformOrigin={{ vertical: 'top', horizontal: 'right'}}
      >
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={config.autoGenerate}
                onChange={(e) => updateConfig({ autoGenerate: e.target.checked })}
              />
          }
            label="Auto-generer"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={config.enableSmoothScroll}
                onChange={(e) => updateConfig({ enableSmoothScroll: e.target.checked })}
              />
          }
            label="Smooth scroll"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={config.includeWordCount}
                onChange={(e) => updateConfig({ includeWordCount: e.target.checked })}
              />
          }
            label="Vis ordtelling"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={
              <Switch
                checked={config.includeReadingTime}
                onChange={(e) => updateConfig({ includeReadingTime: e.target.checked })}
              />
          }
            label="Vis lesetid"
          />
        </MenuItem>
      </Menu>
    </Paper>
  );
}
