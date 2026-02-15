/**
 * SceneNavigatorSidebar - Scene Navigator for ScreenplayEditor
 * 
 * A collapsible sidebar that shows all scenes in the screenplay,
 * allows quick navigation, and highlights the current scene.
 * 
 * Features:
 * - Lists all scenes with INT/EXT tags and location
 * - Click to jump to scene in editor
 * - Highlights current scene based on cursor position
 * - Shows scene count, page estimates
 * - Collapsible sidebar
 * - Works with database scenes (Troll project)
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Collapse,
  Divider,
  Badge,
  alpha,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Movie as SceneIcon,
  ChevronLeft,
  ChevronRight,
  ExpandMore,
  ExpandLess,
  Search as SearchIcon,
  Landscape as ExtIcon,
  Home as IntIcon,
  WbTwilight as DayIcon,
  NightsStay as NightIcon,
  FilterList as FilterIcon,
  ViewList as ListIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { SceneBreakdown } from '../models/casting';

// Scene parsed from Fountain content
export interface ParsedScene {
  id: string;
  sceneNumber: string;
  heading: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | null;
  location: string;
  timeOfDay: string | null;
  lineNumber: number;
  pageEstimate: number; // Rough estimate based on lines
  characterCount: number; // Number of characters in scene
}

interface SceneNavigatorSidebarProps {
  // Content-based parsing
  content?: string;
  
  // Database scenes (takes precedence if provided)
  scenes?: SceneBreakdown[];
  
  // Current cursor position in editor
  currentLine?: number;
  
  // Callback when scene is clicked
  onSceneSelect?: (scene: ParsedScene | SceneBreakdown, lineNumber: number) => void;
  
  // Sidebar state
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  
  // Width
  width?: number;
  collapsedWidth?: number;
  
  // Styling
  darkMode?: boolean;
}

// Parse Fountain content to extract scenes
function parseScenes(content: string): ParsedScene[] {
  if (!content) return [];
  
  const lines = content.split('\n');
  const scenes: ParsedScene[] = [];
  
  // Scene heading patterns
  const SCENE_HEADING_PATTERN = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;
  
  let currentSceneStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(SCENE_HEADING_PATTERN);
    
    if (match) {
      // Count characters in previous scene (rough estimate)
      let charCount = 0;
      for (let j = currentSceneStart; j < i; j++) {
        const prevLine = lines[j].trim();
        if (/^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*$/.test(prevLine)) {
          charCount++;
        }
      }
      
      const intExt = match[3]?.toUpperCase() as 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | null;
      const location = match[4]?.trim() || '';
      const timeOfDay = match[5] || null;
      
      scenes.push({
        id: `scene-${scenes.length + 1}`,
        sceneNumber: `${scenes.length + 1}`,
        heading: line.replace(/^\./, ''),
        intExt,
        location,
        timeOfDay,
        lineNumber: i + 1, // 1-indexed
        pageEstimate: Math.ceil((i - currentSceneStart) / 55), // ~55 lines per page
        characterCount: charCount,
      });
      
      currentSceneStart = i;
    }
  }
  
  return scenes;
}

// Convert database SceneBreakdown to ParsedScene
function convertDbScenes(dbScenes: SceneBreakdown[]): ParsedScene[] {
  return dbScenes.map((scene, index) => ({
    id: scene.id,
    sceneNumber: scene.sceneNumber || `${index + 1}`,
    heading: scene.sceneHeading,
    intExt: scene.intExt || null,
    location: scene.locationName,
    timeOfDay: scene.timeOfDay || null,
    lineNumber: index * 20 + 1, // Estimate if not available
    pageEstimate: scene.pageLength || 1,
    characterCount: scene.characters?.length || 0,
  }));
}

export const SceneNavigatorSidebar: React.FC<SceneNavigatorSidebarProps> = ({
  content,
  scenes: dbScenes,
  currentLine = 1,
  onSceneSelect,
  collapsed = false,
  onToggleCollapse,
  width = 280,
  collapsedWidth = 48,
  darkMode = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set(['1', '2', '3']));
  const [showFilters, setShowFilters] = useState(false);
  const [filterIntExt, setFilterIntExt] = useState<'all' | 'INT' | 'EXT'>('all');

  // Parse scenes from content or use database scenes
  const parsedScenes = useMemo(() => {
    if (dbScenes && dbScenes.length > 0) {
      return convertDbScenes(dbScenes);
    }
    return parseScenes(content || '');
  }, [content, dbScenes]);

  // Filter scenes based on search and filters
  const filteredScenes = useMemo(() => {
    return parsedScenes.filter(scene => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !scene.heading.toLowerCase().includes(query) &&
          !scene.location.toLowerCase().includes(query) &&
          !scene.sceneNumber.includes(query)
        ) {
          return false;
        }
      }
      
      // INT/EXT filter
      if (filterIntExt !== 'all') {
        if (scene.intExt !== filterIntExt) {
          return false;
        }
      }
      
      return true;
    });
  }, [parsedScenes, searchQuery, filterIntExt]);

  // Find current scene based on cursor position
  const currentSceneIndex = useMemo(() => {
    for (let i = parsedScenes.length - 1; i >= 0; i--) {
      if (parsedScenes[i].lineNumber <= currentLine) {
        return i;
      }
    }
    return 0;
  }, [parsedScenes, currentLine]);

  const currentScene = parsedScenes[currentSceneIndex];

  // Handle scene click
  const handleSceneClick = useCallback((scene: ParsedScene) => {
    if (onSceneSelect) {
      // Find corresponding DB scene if available
      const dbScene = dbScenes?.find(s => s.id === scene.id);
      onSceneSelect(dbScene || scene, scene.lineNumber);
    }
  }, [onSceneSelect, dbScenes]);

  // Group scenes by act (assuming every 3-4 scenes = 1 act for demo)
  const scenesByAct = useMemo(() => {
    const acts: { [key: string]: ParsedScene[] } = {};
    
    if (dbScenes && dbScenes.length > 0) {
      // Group by actual actId from database
      dbScenes.forEach((dbScene, index) => {
        const actId = dbScene.actId || '1';
        const actNum = actId.includes('act-1') ? '1' : 
                       actId.includes('act-2') ? '2' : 
                       actId.includes('act-3') ? '3' : '1';
        if (!acts[actNum]) acts[actNum] = [];
        acts[actNum].push(filteredScenes.find(s => s.id === dbScene.id) || convertDbScenes([dbScene])[0]);
      });
    } else {
      // Group by scene number for parsed content
      filteredScenes.forEach(scene => {
        const sceneNum = parseInt(scene.sceneNumber);
        const actNum = sceneNum <= 4 ? '1' : sceneNum <= 8 ? '2' : '3';
        if (!acts[actNum]) acts[actNum] = [];
        acts[actNum].push(scene);
      });
    }
    
    return acts;
  }, [filteredScenes, dbScenes]);

  // Toggle act expansion
  const toggleAct = (actId: string) => {
    setExpandedActs(prev => {
      const next = new Set(prev);
      if (next.has(actId)) {
        next.delete(actId);
      } else {
        next.add(actId);
      }
      return next;
    });
  };

  // Scroll current scene into view
  useEffect(() => {
    if (currentScene) {
      const element = document.getElementById(`scene-nav-${currentScene.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentScene]);

  // Colors and styling
  const bgColor = darkMode ? '#1a1a2e' : '#fff';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  const accentColor = '#a78bfa';
  const intColor = '#60a5fa';
  const extColor = '#34d399';

  if (collapsed) {
    return (
      <Paper
        sx={{
          width: collapsedWidth,
          height: '100%',
          bgcolor: bgColor,
          borderRight: `1px solid ${alpha(accentColor, 0.2)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
        }}
      >
        <Tooltip title="Utvid Scene Navigator" placement="right">
          <IconButton
            size="small"
            onClick={onToggleCollapse}
            sx={{ color: accentColor }}
          >
            <ChevronRight />
          </IconButton>
        </Tooltip>
        
        <Divider sx={{ my: 1, width: '80%' }} />
        
        {/* Mini scene indicators */}
        <Stack spacing={0.5} sx={{ mt: 1, alignItems: 'center' }}>
          {parsedScenes.slice(0, 10).map((scene, i) => (
            <Tooltip key={scene.id} title={scene.heading} placement="right">
              <Box
                onClick={() => handleSceneClick(scene)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: currentSceneIndex === i ? alpha(accentColor, 0.3) : 'transparent',
                  border: `1px solid ${scene.intExt === 'INT' ? intColor : extColor}`,
                  cursor: 'pointer',
                  fontSize: '10px',
                  color: textColor,
                  '&:hover': {
                    bgcolor: alpha(accentColor, 0.2),
                  },
                }}
              >
                {scene.sceneNumber}
              </Box>
            </Tooltip>
          ))}
          {parsedScenes.length > 10 && (
            <Typography variant="caption" color="text.secondary">
              +{parsedScenes.length - 10}
            </Typography>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        width,
        height: '100%',
        bgcolor: bgColor,
        borderRight: `1px solid ${alpha(accentColor, 0.2)}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: `1px solid ${alpha(accentColor, 0.2)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <SceneIcon sx={{ color: accentColor, fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ color: textColor, fontWeight: 600 }}>
            Scene Navigator
          </Typography>
          <Chip
            label={parsedScenes.length}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              bgcolor: alpha(accentColor, 0.2),
              color: accentColor,
            }}
          />
        </Stack>
        
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Filtrer">
            <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon sx={{ fontSize: 18, color: showFilters ? accentColor : textColor }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Skjul sidebar">
            <IconButton size="small" onClick={onToggleCollapse}>
              <ChevronLeft sx={{ fontSize: 18, color: textColor }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Search and Filters */}
      <Collapse in={showFilters}>
        <Box sx={{ p: 1, borderBottom: `1px solid ${alpha(accentColor, 0.1)}` }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Søk scener..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                bgcolor: alpha('#fff', 0.05),
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: alpha(accentColor, 0.2),
                },
              },
            }}
            sx={{ mb: 1 }}
          />
          
          <Stack direction="row" spacing={0.5}>
            <Chip
              label="Alle"
              size="small"
              onClick={() => setFilterIntExt('all')}
              sx={{
                bgcolor: filterIntExt === 'all' ? alpha(accentColor, 0.3) : 'transparent',
                border: `1px solid ${alpha(accentColor, 0.3)}`,
                color: textColor,
              }}
            />
            <Chip
              icon={<IntIcon sx={{ fontSize: 14 }} />}
              label="INT"
              size="small"
              onClick={() => setFilterIntExt('INT')}
              sx={{
                bgcolor: filterIntExt === 'INT' ? alpha(intColor, 0.3) : 'transparent',
                border: `1px solid ${alpha(intColor, 0.5)}`,
                color: intColor,
              }}
            />
            <Chip
              icon={<ExtIcon sx={{ fontSize: 14 }} />}
              label="EXT"
              size="small"
              onClick={() => setFilterIntExt('EXT')}
              sx={{
                bgcolor: filterIntExt === 'EXT' ? alpha(extColor, 0.3) : 'transparent',
                border: `1px solid ${alpha(extColor, 0.5)}`,
                color: extColor,
              }}
            />
          </Stack>
        </Box>
      </Collapse>

      {/* Stats Bar */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          bgcolor: alpha(accentColor, 0.05),
          borderBottom: `1px solid ${alpha(accentColor, 0.1)}`,
        }}
      >
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            {filteredScenes.length} scener
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ~{filteredScenes.reduce((sum, s) => sum + s.pageEstimate, 0)} sider
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {filteredScenes.filter(s => s.intExt === 'INT').length} INT / {filteredScenes.filter(s => s.intExt === 'EXT').length} EXT
          </Typography>
        </Stack>
      </Box>

      {/* Scene List by Acts */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {Object.entries(scenesByAct).map(([actNum, actScenes]) => (
          <Box key={actNum}>
            {/* Act Header */}
            <ListItemButton
              onClick={() => toggleAct(actNum)}
              sx={{
                py: 0.75,
                bgcolor: alpha(accentColor, 0.08),
                '&:hover': { bgcolor: alpha(accentColor, 0.12) },
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: accentColor }}>
                      AKT {actNum}
                    </Typography>
                    <Chip
                      label={actScenes.length}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.65rem',
                        bgcolor: 'transparent',
                        border: `1px solid ${alpha(accentColor, 0.3)}`,
                        color: 'text.secondary',
                      }}
                    />
                  </Stack>
                }
              />
              {expandedActs.has(actNum) ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={expandedActs.has(actNum)}>
              <List dense disablePadding>
                {actScenes.filter(Boolean).map((scene) => {
                  const isCurrent = currentScene?.id === scene.id;
                  const intExtColor = scene.intExt === 'INT' ? intColor : 
                                      scene.intExt === 'EXT' ? extColor : textColor;
                  
                  return (
                    <ListItemButton
                      id={`scene-nav-${scene.id}`}
                      key={scene.id}
                      onClick={() => handleSceneClick(scene)}
                      selected={isCurrent}
                      sx={{
                        py: 0.5,
                        pl: 2,
                        borderLeft: isCurrent ? `3px solid ${accentColor}` : '3px solid transparent',
                        bgcolor: isCurrent ? alpha(accentColor, 0.15) : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(accentColor, 0.1),
                        },
                        '&.Mui-selected': {
                          bgcolor: alpha(accentColor, 0.15),
                        },
                      }}
                    >
                      {/* Scene Number Badge */}
                      <Box
                        sx={{
                          minWidth: 28,
                          height: 22,
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(intExtColor, 0.15),
                          border: `1px solid ${alpha(intExtColor, 0.4)}`,
                          mr: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: 600, fontSize: '0.7rem', color: intExtColor }}
                        >
                          {scene.sceneNumber}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: isCurrent ? 600 : 400,
                            color: textColor,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {scene.intExt ? `${scene.intExt}. ` : ''}{scene.location}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                          {scene.timeOfDay && (
                            <Chip
                              size="small"
                              label={scene.timeOfDay}
                              icon={scene.timeOfDay?.includes('NIGHT') ? 
                                <NightIcon sx={{ fontSize: 10 }} /> : 
                                <DayIcon sx={{ fontSize: 10 }} />}
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                '& .MuiChip-icon': { fontSize: 10 },
                                bgcolor: 'transparent',
                                border: '1px solid',
                                borderColor: alpha(textColor, 0.2),
                              }}
                            />
                          )}
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                            L{scene.lineNumber}
                          </Typography>
                        </Stack>
                      </Box>
                    </ListItemButton>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        ))}
        
        {filteredScenes.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery ? 'Ingen scener funnet' : 'Ingen scener i manuskriptet'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Current Scene Footer */}
      {currentScene && (
        <Box
          sx={{
            p: 1,
            borderTop: `1px solid ${alpha(accentColor, 0.2)}`,
            bgcolor: alpha(accentColor, 0.1),
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block">
            Gjeldende scene
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: accentColor, fontSize: '0.8rem' }}>
            {currentScene.sceneNumber}. {currentScene.location}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default SceneNavigatorSidebar;
