/**
 * ScreenplayEditorWithNavigator - Full-featured screenplay editor with scene navigation
 * 
 * Combines ScreenplayEditor with:
 * - Scene Navigator Sidebar
 * - Beat Board / Story Cards
 * - Table Reads (TTS)
 * - Script Analysis (consistency, character conflicts)
 * - Script Locking
 * - Role-based Access Control
 * 
 * Supports database scenes (like Troll project) and content-based parsing.
 */

import { useState, useCallback, useRef, useEffect, useMemo, memo, type FC, type MouseEvent } from 'react';
import {
  Box,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Alert,
  Snackbar,
  Badge,
  Typography,
  useMediaQuery,
  useTheme,
  Drawer,
} from '@mui/material';
import {
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Analytics as AnalysisIcon,
  ViewModule as BeatBoardIcon,
  RecordVoiceOver as TableReadIcon,
  Spellcheck as SpellcheckIcon,
  Person as RoleIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
  Timeline as TimelineIcon,
  Dashboard as StoryboardIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { ScreenplayEditor } from './ScreenplayEditor';
import { SceneNavigatorSidebar, ParsedScene } from './SceneNavigatorSidebar';
import { BeatBoard } from './BeatBoard';
import { TableReadPanel } from './TableReadPanel';
import { ScriptAnalysisPanel } from './ScriptAnalysisPanel';
import { StoryStructurePanel } from './StoryStructurePanel';
import { GrammarCheckPanel } from './screenplay/GrammarCheckPanel';
import { StoryboardIntegrationView } from './StoryboardIntegrationView';
import { SceneBreakdown, UserRoleType } from '../models/casting';
import { analyzeScript, BeatCard } from '../services/scriptAnalysisService';
import { castingAuthService } from '../services/castingAuthService';

// 7-Tier Responsive Hook
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean } => {
  const theme = useTheme();
  const isXs = useMediaQuery('(max-width:599px)');
  const isSm = useMediaQuery('(min-width:600px) and (max-width:899px)');
  const isMd = useMediaQuery('(min-width:900px) and (max-width:1199px)');
  const isLg = useMediaQuery('(min-width:1200px) and (max-width:1535px)');
  const isXl = useMediaQuery('(min-width:1536px) and (max-width:1919px)');
  const isXxl = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');

  const tier: ScreenTier = is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';
  const isMobile = tier === 'xs' || tier === 'sm';
  const isTablet = tier === 'md';
  const isDesktop = tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k';

  return { tier, isMobile, isTablet, isDesktop, is4K };
};

// Get responsive values based on tier
const getResponsiveValues = (tier: ScreenTier) => {
  const values = {
    xs: { 
      bodyFontSize: '0.75rem', captionFontSize: '0.65rem', titleFontSize: '0.9rem',
      buttonSize: 'small' as const, iconSize: 16, spacing: 1, padding: 0.75, chipSize: 'small' as const,
      sidebarWidth: 240, rightPanelWidth: 280
    },
    sm: { 
      bodyFontSize: '0.8rem', captionFontSize: '0.7rem', titleFontSize: '0.95rem',
      buttonSize: 'small' as const, iconSize: 18, spacing: 1, padding: 1, chipSize: 'small' as const,
      sidebarWidth: 260, rightPanelWidth: 320
    },
    md: { 
      bodyFontSize: '0.85rem', captionFontSize: '0.75rem', titleFontSize: '1rem',
      buttonSize: 'small' as const, iconSize: 20, spacing: 1, padding: 1, chipSize: 'small' as const,
      sidebarWidth: 280, rightPanelWidth: 350
    },
    lg: { 
      bodyFontSize: '0.875rem', captionFontSize: '0.75rem', titleFontSize: '1.1rem',
      buttonSize: 'small' as const, iconSize: 20, spacing: 1, padding: 1, chipSize: 'small' as const,
      sidebarWidth: 280, rightPanelWidth: 380
    },
    xl: { 
      bodyFontSize: '0.9rem', captionFontSize: '0.8rem', titleFontSize: '1.15rem',
      buttonSize: 'medium' as const, iconSize: 22, spacing: 1, padding: 1, chipSize: 'small' as const,
      sidebarWidth: 300, rightPanelWidth: 400
    },
    xxl: { 
      bodyFontSize: '0.95rem', captionFontSize: '0.85rem', titleFontSize: '1.2rem',
      buttonSize: 'medium' as const, iconSize: 24, spacing: 1.5, padding: 1.5, chipSize: 'medium' as const,
      sidebarWidth: 320, rightPanelWidth: 450
    },
    '4k': { 
      bodyFontSize: '1.1rem', captionFontSize: '0.95rem', titleFontSize: '1.4rem',
      buttonSize: 'large' as const, iconSize: 28, spacing: 2, padding: 2, chipSize: 'medium' as const,
      sidebarWidth: 360, rightPanelWidth: 500
    },
  };
  return values[tier];
};

export type ScriptLockState = 'unlocked' | 'locked' | 'final';
export type RightPanelType = 'none' | 'analysis' | 'beatboard' | 'tableread' | 'structure' | 'grammar' | 'storyboard';

export interface ScreenplayEditorWithNavigatorProps {
  // Editor props
  value: string;
  onChange: (value: string) => void;
  characters?: string[];
  locations?: string[];
  onCharacterAdd?: (name: string) => void;
  onLocationAdd?: (name: string) => void;
  showLineNumbers?: boolean;
  editorKey?: string;
  
  // Database scenes (e.g., from Troll project)
  scenes?: SceneBreakdown[];
  
  // Callbacks
  onSceneSelect?: (scene: SceneBreakdown | ParsedScene) => void;
  onCursorChange?: (line: number, column: number, element: string | null) => void;
  
  // Layout
  sidebarDefaultCollapsed?: boolean;
  sidebarWidth?: number;
  
  // Script locking
  lockState?: ScriptLockState;
  onLockStateChange?: (state: ScriptLockState) => void;
  
  // Role-based access
  projectId?: string;
  currentUserRole?: UserRoleType;
  
  // Default panel (right side)
  defaultRightPanel?: RightPanelType;
  
  // Spellcheck
  enableSpellcheck?: boolean;
  
  // Script title for sharing
  scriptTitle?: string;
}

const ScreenplayEditorWithNavigatorComponent: FC<ScreenplayEditorWithNavigatorProps> = ({
  value,
  onChange,
  characters = [],
  locations = [],
  onCharacterAdd,
  onLocationAdd,
  showLineNumbers = true,
  scenes,
  onSceneSelect,
  onCursorChange,
  sidebarDefaultCollapsed = false,
  sidebarWidth = 280,
  lockState = 'unlocked',
  onLockStateChange,
  projectId,
  currentUserRole = 'director',
  defaultRightPanel = 'none',
  enableSpellcheck = true,
  scriptTitle = 'Untitled',
  editorKey,
}) => {
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  
  // DEBUG: Log renders
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  console.log(`📺 ScreenplayEditorWithNavigator RENDER #${renderCountRef.current}`);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(sidebarDefaultCollapsed || isMobile);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileRightDrawerOpen, setMobileRightDrawerOpen] = useState(false);
  const [currentLine, setCurrentLine] = useState(1);
  const [rightPanel, setRightPanel] = useState<RightPanelType>(defaultRightPanel);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [selectedScene, setSelectedScene] = useState<SceneBreakdown | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // Role-based permissions
  const [permissions, setPermissions] = useState({
    canEdit: true,
    canLock: true,
    canTableRead: true,
  });

  // Check permissions on mount and when role changes
  useEffect(() => {
    const checkPermissions = async () => {
      if (!projectId) {
        // Default permissions based on role
        const defaultPerms = castingAuthService.getDefaultPermissions(currentUserRole);
        setPermissions({
          canEdit: defaultPerms.canEditScript ?? true,
          canLock: defaultPerms.canLockScript ?? false,
          canTableRead: defaultPerms.canRunTableRead ?? true,
        });
        return;
      }

      const [canEdit, canLock, canTableRead] = await Promise.all([
        castingAuthService.canEditScript(projectId),
        castingAuthService.canLockScript(projectId),
        castingAuthService.canRunTableRead(projectId),
      ]);

      setPermissions({ canEdit, canLock, canTableRead });
    };

    checkPermissions();
  }, [projectId, currentUserRole]);

  // Determine if editor is read-only
  const isReadOnly = useMemo(() => {
    if (lockState === 'locked' || lockState === 'final') {
      return true;
    }
    return !permissions.canEdit;
  }, [lockState, permissions.canEdit]);

  // Debounce analysis - store value in ref, update state only after delay
  const valueRef = useRef(value);
  valueRef.current = value;
  
  const [analysisValue, setAnalysisValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnalysisValue(valueRef.current);
    }, 2000);
    return () => clearTimeout(timer);
  }, [value]);
  
  const analysis = useMemo(() => analyzeScript(analysisValue), [analysisValue]);

  // Handle cursor change from editor
  const handleCursorChange = useCallback((line: number, column: number, element: any) => {
    setCurrentLine(line);
    onCursorChange?.(line, column, element);
  }, [onCursorChange]);

  // Handle scene selection from sidebar
  const handleSceneSelect = useCallback((scene: ParsedScene | SceneBreakdown, lineNumber: number) => {
    gotoLine(lineNumber);
    // Store selected scene for storyboard panel
    if ('id' in scene && 'projectId' in scene) {
      setSelectedScene(scene as SceneBreakdown);
    } else {
      // Convert ParsedScene to minimal SceneBreakdown for storyboard
      const parsedScene = scene as ParsedScene;
      const now = new Date().toISOString();
      setSelectedScene({
        id: parsedScene.id || `scene-${lineNumber}`,
        manuscriptId: '',
        projectId: projectId || 'default',
        sceneNumber: parsedScene.sceneNumber || String(lineNumber),
        sceneHeading: parsedScene.heading || `Scene ${lineNumber}`,
        intExt: parsedScene.intExt as 'INT' | 'EXT' | 'INT/EXT' | undefined,
        locationName: parsedScene.location || 'Unknown',
        timeOfDay: (parsedScene.timeOfDay || undefined) as 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS' | 'LATER' | 'MORNING' | 'EVENING' | undefined,
        description: '',
        characters: [],
        status: 'not-scheduled',
        createdAt: now,
        updatedAt: now,
      });
    }
    onSceneSelect?.(scene);
  }, [onSceneSelect, projectId]);

  // Go to a specific line in the editor
  const gotoLine = useCallback((lineNumber: number) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      const lines = value.split('\n');
      let charIndex = 0;
      for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
        charIndex += lines[i].length + 1;
      }
      textarea.focus();
      textarea.setSelectionRange(charIndex, charIndex);
      
      const lineHeight = 24;
      textarea.scrollTop = (lineNumber - 5) * lineHeight;
    }
    setHighlightedLine(lineNumber);
    setTimeout(() => setHighlightedLine(null), 2000);
  }, [value]);

  // Handle lock state change
  const handleLockToggle = useCallback(() => {
    if (!permissions.canLock) {
      setSnackbar({
        open: true,
        message: 'Du har ikke tillatelse til å låse/låse opp manuset',
        severity: 'warning',
      });
      return;
    }

    const newState: ScriptLockState = 
      lockState === 'unlocked' ? 'locked' : 
      lockState === 'locked' ? 'final' : 'unlocked';
    
    onLockStateChange?.(newState);
    
    setSnackbar({
      open: true,
      message: newState === 'unlocked' 
        ? 'Manus låst opp for redigering' 
        : newState === 'locked' 
        ? 'Manus låst' 
        : 'Manus markert som endelig versjon',
      severity: 'success',
    });
  }, [lockState, permissions.canLock, onLockStateChange]);

  // Handle right panel toggle
  const handleRightPanelChange = useCallback((
    _event: MouseEvent<HTMLElement>,
    newPanel: RightPanelType | null
  ) => {
    setRightPanel(newPanel || 'none');
  }, []);

  // Handle beat card click
  const handleBeatClick = useCallback((beat: BeatCard) => {
    gotoLine(beat.lineNumber);
  }, [gotoLine]);

  // Handle text change with lock check
  const handleChange = useCallback((newValue: string) => {
    if (isReadOnly) {
      setSnackbar({
        open: true,
        message: 'Manuset er låst og kan ikke redigeres',
        severity: 'warning',
      });
      return;
    }
    onChange(newValue);
  }, [isReadOnly, onChange]);

  // Count issues for badge
  const issueCount = analysis.characterConflicts.length + analysis.consistencyIssues.length;

  // Fullscreen toggle handler
  const handleFullscreenToggle = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        // Fullscreen styles
        ...(isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1300,
          bgcolor: '#1a1a2e',
        }),
      }}
    >
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: responsive.padding,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 0.5 : 1,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: 'rgba(30,30,50,0.8)',
          flexWrap: 'wrap',
        }}
      >
        {/* Mobile Menu Button for Sidebar */}
        {isMobile && (
          <IconButton
            size={responsive.buttonSize}
            onClick={() => setMobileDrawerOpen(true)}
            sx={{ color: 'text.secondary' }}
          >
            <MenuIcon sx={{ fontSize: responsive.iconSize }} />
          </IconButton>
        )}

        {/* Lock Status & Toggle */}
        <Tooltip title={
          lockState === 'unlocked' ? 'Lås manus' :
          lockState === 'locked' ? 'Manus låst - klikk for endelig versjon' :
          'Endelig versjon - klikk for å låse opp'
        }>
          <IconButton
            onClick={handleLockToggle}
            color={lockState === 'unlocked' ? 'default' : lockState === 'locked' ? 'warning' : 'error'}
            disabled={!permissions.canLock}
            size={responsive.buttonSize}
          >
            {lockState === 'unlocked' ? <UnlockIcon sx={{ fontSize: responsive.iconSize }} /> : <LockIcon sx={{ fontSize: responsive.iconSize }} />}
          </IconButton>
        </Tooltip>
        
        {lockState !== 'unlocked' && !isMobile && (
          <Chip
            label={lockState === 'locked' ? 'Låst' : 'Endelig'}
            size={responsive.chipSize}
            color={lockState === 'locked' ? 'warning' : 'error'}
            sx={{ fontSize: responsive.captionFontSize }}
          />
        )}

        {/* Role indicator - hide on mobile */}
        {!isMobile && (
          <Tooltip title={`Din rolle: ${currentUserRole}`}>
            <Chip
              icon={<RoleIcon sx={{ fontSize: responsive.iconSize }} />}
              label={currentUserRole}
              size={responsive.chipSize}
              variant="outlined"
              sx={{ fontSize: responsive.captionFontSize, textTransform: 'capitalize' }}
            />
          </Tooltip>
        )}

        {isReadOnly && !permissions.canEdit && !isMobile && (
          <Chip
            label="Kun lesing"
            size={responsive.chipSize}
            color="default"
            sx={{ fontSize: responsive.captionFontSize }}
          />
        )}

        <Box sx={{ flex: 1 }} />

        {/* Fullscreen Toggle */}
        <Tooltip title={isFullscreen ? 'Avslutt fullskjerm (Esc)' : 'Fullskjerm'}>
          <IconButton
            onClick={handleFullscreenToggle}
            size={responsive.buttonSize}
            sx={{ color: isFullscreen ? 'primary.main' : 'text.secondary' }}
          >
            {isFullscreen ? (
              <FullscreenExitIcon sx={{ fontSize: responsive.iconSize }} />
            ) : (
              <FullscreenIcon sx={{ fontSize: responsive.iconSize }} />
            )}
          </IconButton>
        </Tooltip>

        {!isMobile && <Divider orientation="vertical" flexItem />}

        {/* Right Panel Toggles */}
        {isMobile ? (
          // Mobile: Show menu button for right panel
          <IconButton
            size={responsive.buttonSize}
            onClick={() => setMobileRightDrawerOpen(true)}
            disabled={rightPanel === 'none'}
            color={rightPanel !== 'none' ? 'primary' : 'default'}
          >
            <Badge badgeContent={issueCount} color="warning" max={99}>
              <AnalysisIcon sx={{ fontSize: responsive.iconSize }} />
            </Badge>
          </IconButton>
        ) : (
          <ToggleButtonGroup
            value={rightPanel}
            exclusive
            onChange={handleRightPanelChange}
            size={responsive.buttonSize}
          >
            <ToggleButton value="structure" aria-label="story structure">
              <Tooltip title="Historie & Struktur">
                <TimelineIcon sx={{ fontSize: responsive.iconSize }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="analysis" aria-label="analysis">
              <Tooltip title="Manus-analyse">
                <Badge badgeContent={issueCount} color="warning" max={99}>
                  <AnalysisIcon sx={{ fontSize: responsive.iconSize }} />
                </Badge>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="beatboard" aria-label="beat board">
              <Tooltip title="Beat Board">
                <BeatBoardIcon sx={{ fontSize: responsive.iconSize }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="tableread" aria-label="table read" disabled={!permissions.canTableRead}>
              <Tooltip title="Table Read (TTS)">
                <TableReadIcon sx={{ fontSize: responsive.iconSize }} />
              </Tooltip>
            </ToggleButton>
            {!isTablet && [
              <ToggleButton key="grammar" value="grammar" aria-label="grammar">
                <Tooltip title="Grammatikk & Stavekontroll (ML)">
                  <SpellcheckIcon sx={{ fontSize: responsive.iconSize }} />
                </Tooltip>
              </ToggleButton>,
              <ToggleButton key="storyboard" value="storyboard" aria-label="storyboard">
                <Tooltip title="Storyboard">
                  <StoryboardIcon sx={{ fontSize: responsive.iconSize }} />
                </Tooltip>
              </ToggleButton>
            ]}
          </ToggleButtonGroup>
        )}
      </Paper>

      {/* Main Content */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Mobile Sidebar Drawer */}
        {isMobile ? (
          <Drawer
            anchor="left"
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            sx={{
              '& .MuiDrawer-paper': {
                width: responsive.sidebarWidth,
                bgcolor: 'rgba(30,30,50,0.95)',
              },
            }}
          >
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton onClick={() => setMobileDrawerOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <SceneNavigatorSidebar
              content={value}
              scenes={scenes}
              currentLine={currentLine}
              onSceneSelect={(scene, lineNumber) => {
                handleSceneSelect(scene, lineNumber);
                setMobileDrawerOpen(false);
              }}
              collapsed={false}
              onToggleCollapse={() => {}}
              width={responsive.sidebarWidth - 16}
              darkMode={true}
            />
          </Drawer>
        ) : (
          /* Desktop Sidebar */
          <SceneNavigatorSidebar
            content={value}
            scenes={scenes}
            currentLine={currentLine}
            onSceneSelect={handleSceneSelect}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            width={responsive.sidebarWidth}
            darkMode={true}
          />
        )}

        {/* Main Editor */}
        <Box 
          sx={{ 
            flex: 1, 
            height: '100%', 
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {isReadOnly && (
            <Alert
              severity="info"
              icon={<LockIcon sx={{ fontSize: responsive.iconSize }} />}
              sx={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                opacity: 0.9,
                fontSize: responsive.bodyFontSize,
                py: isMobile ? 0.5 : 1,
              }}
            >
              {lockState === 'final' ? (isMobile ? 'Endelig versjon' : 'Endelig versjon - ingen endringer tillatt') :
               lockState === 'locked' ? (isMobile ? 'Låst' : 'Manuset er låst for redigering') :
               'Du har kun lesetilgang'}
            </Alert>
          )}
          <ScreenplayEditor
            key={editorKey}
            value={value}
            onChange={handleChange}
            characters={characters}
            locations={locations}
            onCharacterAdd={onCharacterAdd}
            onLocationAdd={onLocationAdd}
            readOnly={isReadOnly}
            showLineNumbers={showLineNumbers && !isMobile}
            onCursorChange={handleCursorChange}
            spellCheck={enableSpellcheck}
          />
        </Box>

        {/* Mobile Right Panel Drawer */}
        {isMobile ? (
          <Drawer
            anchor="right"
            open={mobileRightDrawerOpen && rightPanel !== 'none'}
            onClose={() => setMobileRightDrawerOpen(false)}
            sx={{
              '& .MuiDrawer-paper': {
                width: '85vw',
                maxWidth: 400,
                bgcolor: 'rgba(30,30,50,0.95)',
              },
            }}
          >
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <ToggleButtonGroup
                value={rightPanel}
                exclusive
                onChange={handleRightPanelChange}
                size="small"
              >
                <ToggleButton value="structure"><TimelineIcon sx={{ fontSize: 18 }} /></ToggleButton>
                <ToggleButton value="analysis"><AnalysisIcon sx={{ fontSize: 18 }} /></ToggleButton>
                <ToggleButton value="beatboard"><BeatBoardIcon sx={{ fontSize: 18 }} /></ToggleButton>
                <ToggleButton value="tableread"><TableReadIcon sx={{ fontSize: 18 }} /></ToggleButton>
              </ToggleButtonGroup>
              <IconButton onClick={() => setMobileRightDrawerOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ height: 'calc(100% - 48px)', overflow: 'auto' }}>
              {rightPanel === 'structure' && (
                <StoryStructurePanel
                  content={value}
                  scriptTitle={scriptTitle}
                  onGotoLine={(line) => { gotoLine(line); setMobileRightDrawerOpen(false); }}
                  showSceneNumbers={showLineNumbers}
                  darkMode={true}
                />
              )}
              {rightPanel === 'analysis' && (
                <ScriptAnalysisPanel
                  content={value}
                  onGotoLine={(line) => { gotoLine(line); setMobileRightDrawerOpen(false); }}
                  darkMode={true}
                />
              )}
              {rightPanel === 'beatboard' && (
                <BeatBoard
                  beats={analysis.beatCards}
                  onBeatClick={(beat) => { handleBeatClick(beat); setMobileRightDrawerOpen(false); }}
                  readOnly={isReadOnly}
                  actsView={true}
                  darkMode={true}
                />
              )}
              {rightPanel === 'tableread' && (
                <TableReadPanel
                  content={value}
                  onLineHighlight={(line) => { gotoLine(line); setMobileRightDrawerOpen(false); }}
                  darkMode={true}
                />
              )}
            </Box>
          </Drawer>
        ) : (
          /* Desktop Right Panel */
          rightPanel !== 'none' && (
            <Box
              sx={{
                width: responsive.rightPanelWidth,
                height: '100%',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}
            >
              {rightPanel === 'structure' && (
                <StoryStructurePanel
                  content={value}
                  scriptTitle={scriptTitle}
                  onGotoLine={gotoLine}
                  showSceneNumbers={showLineNumbers}
                  darkMode={true}
                />
              )}
              {rightPanel === 'analysis' && (
                <ScriptAnalysisPanel
                  content={value}
                  onGotoLine={gotoLine}
                  darkMode={true}
                />
              )}
              {rightPanel === 'beatboard' && (
                <BeatBoard
                  beats={analysis.beatCards}
                  onBeatClick={handleBeatClick}
                  readOnly={isReadOnly}
                  actsView={true}
                  darkMode={true}
                />
              )}
              {rightPanel === 'tableread' && (
                <TableReadPanel
                  content={value}
                  onLineHighlight={gotoLine}
                  darkMode={true}
                />
              )}
              {rightPanel === 'grammar' && (
                <GrammarCheckPanel
                  content={value}
                  onGoToLine={gotoLine}
                  onReplaceText={(lineNumber: number, columnStart: number, columnEnd: number, newText: string) => {
                    const lines = value.split('\n');
                    if (lineNumber > 0 && lineNumber <= lines.length) {
                      const line = lines[lineNumber - 1];
                      lines[lineNumber - 1] = 
                        line.substring(0, columnStart) + newText + line.substring(columnEnd);
                      onChange(lines.join('\n'));
                    }
                  }}
                  onContentChange={onChange}
                  darkMode={true}
                />
              )}
              {rightPanel === 'storyboard' && selectedScene && (
                <StoryboardIntegrationView
                  scene={selectedScene}
                  onUpdate={(updatedScene) => setSelectedScene(updatedScene)}
                  scriptContent={value}
                  onScriptChange={onChange}
                  showScriptPanel={false}
                />
              )}
              {rightPanel === 'storyboard' && !selectedScene && (
                <Box sx={{ p: isMobile ? 2 : 3, textAlign: 'center', color: 'text.secondary' }}>
                  <StoryboardIcon sx={{ fontSize: is4K ? 64 : 48, opacity: 0.5, mb: 2 }} />
                  <Typography variant="body1" sx={{ fontSize: responsive.bodyFontSize }}>
                    Velg en scene fra navigatoren for å se storyboard
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.7, fontSize: responsive.captionFontSize }}>
                    {isMobile ? 'Åpne menyen øverst' : 'Klikk på en scene i venstre panel'}
                  </Typography>
                </Box>
              )}
            </Box>
          )
        )}
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Memoized export with custom comparison to prevent unnecessary re-renders
export const ScreenplayEditorWithNavigator = memo(
  ScreenplayEditorWithNavigatorComponent,
  (prevProps, nextProps) => {
    // Return TRUE if props are equal (skip re-render), FALSE if different (re-render)
    // Order checks by cost: cheapest first (primitives), most expensive last (arrays)
    
    // Primitive comparisons (fastest)
    if (prevProps.value !== nextProps.value) return false;
    if (prevProps.editorKey !== nextProps.editorKey) return false;
    if (prevProps.lockState !== nextProps.lockState) return false;
    if (prevProps.defaultRightPanel !== nextProps.defaultRightPanel) return false;
    if (prevProps.projectId !== nextProps.projectId) return false;
    if (prevProps.scriptTitle !== nextProps.scriptTitle) return false;
    if (prevProps.currentUserRole !== nextProps.currentUserRole) return false;
    if (prevProps.showLineNumbers !== nextProps.showLineNumbers) return false;
    if (prevProps.sidebarDefaultCollapsed !== nextProps.sidebarDefaultCollapsed) return false;
    if (prevProps.enableSpellcheck !== nextProps.enableSpellcheck) return false;
    if (prevProps.sidebarWidth !== nextProps.sidebarWidth) return false;
    
    // Callback references (should be memoized, fast equality check)
    if (prevProps.onChange !== nextProps.onChange) return false;
    if (prevProps.onSceneSelect !== nextProps.onSceneSelect) return false;
    if (prevProps.onCursorChange !== nextProps.onCursorChange) return false;
    if (prevProps.onLockStateChange !== nextProps.onLockStateChange) return false;
    if (prevProps.onCharacterAdd !== nextProps.onCharacterAdd) return false;
    if (prevProps.onLocationAdd !== nextProps.onLocationAdd) return false;
    
    // Array length comparisons (avoid deep equality checks)
    const prevScenesLen = prevProps.scenes?.length ?? 0;
    const nextScenesLen = nextProps.scenes?.length ?? 0;
    if (prevScenesLen !== nextScenesLen) return false;
    
    const prevCharsLen = prevProps.characters?.length ?? 0;
    const nextCharsLen = nextProps.characters?.length ?? 0;
    if (prevCharsLen !== nextCharsLen) return false;
    
    const prevLocsLen = prevProps.locations?.length ?? 0;
    const nextLocsLen = nextProps.locations?.length ?? 0;
    if (prevLocsLen !== nextLocsLen) return false;
    
    // All checks passed - props are effectively equal, skip re-render
    return true;
  }
);

export default ScreenplayEditorWithNavigator;
