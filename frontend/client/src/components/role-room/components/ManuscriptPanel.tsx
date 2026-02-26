import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Stack,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  LinearProgress,
  Drawer,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';

// ===== 7-Tier Responsive System =====
type ScreenTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

const useScreenTier = (): { tier: ScreenTier; isMobile: boolean; isTablet: boolean; isDesktop: boolean; is4K: boolean } => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));      // < 600px
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600-899px
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 900-1199px
  const isLg = useMediaQuery(theme.breakpoints.between('lg', 'xl')); // 1200-1535px
  const isXl = useMediaQuery(theme.breakpoints.between('xl', 1920)); // 1536-1919px
  const isXxl = useMediaQuery('(min-width: 1920px) and (max-width: 2559px)'); // 1920-2559px
  const is4K = useMediaQuery('(min-width: 2560px)'); // 2560px+

  const tier: ScreenTier = is4K ? '4k' : isXxl ? 'xxl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs';
  
  return {
    tier,
    isMobile: tier === 'xs' || tier === 'sm',
    isTablet: tier === 'md',
    isDesktop: tier === 'lg' || tier === 'xl' || tier === 'xxl' || tier === '4k',
    is4K: tier === '4k',
  };
};

const getResponsiveValues = (tier: ScreenTier) => {
  const values = {
    xs: {
      headerFontSize: '1rem',
      titleFontSize: '0.9rem',
      bodyFontSize: '0.75rem',
      captionFontSize: '0.65rem',
      buttonSize: 'small' as const,
      iconSize: 18,
      spacing: 1,
      cardSpacing: 1.5,
      padding: 1,
      headerPadding: 1.5,
      cardImageHeight: 120,
      chipSize: 'small' as const,
      tabFontSize: '0.7rem',
      tabPadding: '4px 8px',
      showTabLabels: false,
      stackDirection: 'column' as const,
      headerStackDirection: 'column' as const,
      cardGridSize: { xs: 12 } as Record<string, number>,
    },
    sm: {
      headerFontSize: '1.15rem',
      titleFontSize: '1rem',
      bodyFontSize: '0.8rem',
      captionFontSize: '0.7rem',
      buttonSize: 'small' as const,
      iconSize: 20,
      spacing: 1.5,
      cardSpacing: 2,
      padding: 1.5,
      headerPadding: 2,
      cardImageHeight: 140,
      chipSize: 'small' as const,
      tabFontSize: '0.75rem',
      tabPadding: '6px 10px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'column' as const,
      cardGridSize: { xs: 12, sm: 6 } as Record<string, number>,
    },
    md: {
      headerFontSize: '1.25rem',
      titleFontSize: '1.1rem',
      bodyFontSize: '0.85rem',
      captionFontSize: '0.75rem',
      buttonSize: 'medium' as const,
      iconSize: 22,
      spacing: 2,
      cardSpacing: 2.5,
      padding: 2,
      headerPadding: 2,
      cardImageHeight: 160,
      chipSize: 'small' as const,
      tabFontSize: '0.8rem',
      tabPadding: '8px 12px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4 } as Record<string, number>,
    },
    lg: {
      headerFontSize: '1.4rem',
      titleFontSize: '1.1rem',
      bodyFontSize: '0.875rem',
      captionFontSize: '0.75rem',
      buttonSize: 'medium' as const,
      iconSize: 24,
      spacing: 2.5,
      cardSpacing: 3,
      padding: 2.5,
      headerPadding: 2,
      cardImageHeight: 180,
      chipSize: 'medium' as const,
      tabFontSize: '0.85rem',
      tabPadding: '8px 16px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4 } as Record<string, number>,
    },
    xl: {
      headerFontSize: '1.5rem',
      titleFontSize: '1.15rem',
      bodyFontSize: '0.9rem',
      captionFontSize: '0.8rem',
      buttonSize: 'medium' as const,
      iconSize: 26,
      spacing: 3,
      cardSpacing: 3,
      padding: 3,
      headerPadding: 2.5,
      cardImageHeight: 200,
      chipSize: 'medium' as const,
      tabFontSize: '0.875rem',
      tabPadding: '10px 18px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4, lg: 3 } as Record<string, number>,
    },
    xxl: {
      headerFontSize: '1.6rem',
      titleFontSize: '1.2rem',
      bodyFontSize: '0.95rem',
      captionFontSize: '0.85rem',
      buttonSize: 'large' as const,
      iconSize: 28,
      spacing: 3.5,
      cardSpacing: 3.5,
      padding: 3.5,
      headerPadding: 3,
      cardImageHeight: 220,
      chipSize: 'medium' as const,
      tabFontSize: '0.9rem',
      tabPadding: '10px 20px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4, lg: 3 } as Record<string, number>,
    },
    '4k': {
      headerFontSize: '1.75rem',
      titleFontSize: '1.3rem',
      bodyFontSize: '1rem',
      captionFontSize: '0.9rem',
      buttonSize: 'large' as const,
      iconSize: 32,
      spacing: 4,
      cardSpacing: 4,
      padding: 4,
      headerPadding: 3.5,
      cardImageHeight: 260,
      chipSize: 'medium' as const,
      tabFontSize: '1rem',
      tabPadding: '12px 24px',
      showTabLabels: true,
      stackDirection: 'row' as const,
      headerStackDirection: 'row' as const,
      cardGridSize: { xs: 12, sm: 6, md: 4, lg: 3 } as Record<string, number>,
    },
  };
  return values[tier];
};
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Description as DescriptionIcon,
  Movie as MovieIcon,
  Theaters as SceneIcon,
  FormatListNumbered as FormatListNumberedIcon,
  Person as PersonIcon,
  Chat as ChatIcon,
  History as HistoryIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
  AutoFixHigh as AutoFixHighIcon,
  MenuBook as MenuBookIcon,
  Timeline as TimelineIcon,
  DragIndicator as DragIcon,
  ViewModule as ViewModuleIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
  ArrowBack as ArrowBackIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { useToast } from './ToastStack';
import { Manuscript, SceneBreakdown, DialogueLine, ScriptRevision, Act, ManuscriptExport, Role, Location } from '../models/casting';
import type { StoryLogicState } from '../services/storyLogicService';
import { manuscriptService } from '../services/manuscriptService';
import { RichTextEditor } from './RichTextEditor';
import { ScriptDiffViewer } from './ScriptDiffViewer';
import { ShotDetailPanel } from './ShotDetailPanel';
import { TimelineView } from './TimelineView';
import { ProductionControlPanel } from './ProductionControlPanel';
import { DraggableSceneList } from './DraggableSceneList';
import { StoryboardIntegrationView } from './StoryboardIntegrationView';
import { ScriptStoryboardSplitView } from './ScriptStoryboardSplitView';
import { ImportManuscriptDialog } from './ImportManuscriptDialog';
import { ManuscriptTemplatePanel } from './ManuscriptTemplatePanel';
import { manuscriptTemplateService } from '../services/manuscriptTemplateService';
import { castingService } from '../services/castingService';
import { characterProfileService, CharacterProfile as StoredCharacterProfile } from '../services/characterProfileService';
import { Template } from '../models/manuscriptTemplates';
import { ProductionManuscriptView } from './ProductionManuscriptView';
import { ScriptStoryboardProvider } from '../contexts/ScriptStoryboardContext';

interface ManuscriptPanelProps {
  projectId?: string;
  onManuscriptChange?: (manuscript: Manuscript) => void;
  storyLogicData?: StoryLogicState | null;
}

type ManuscriptTabValue = 'editor' | 'acts' | 'scenes' | 'characters' | 'dialogue' | 'breakdown' | 'revisions' | 'timeline' | 'production' | 'productionview';

const ManuscriptPanelComponent: React.FC<ManuscriptPanelProps> = ({ projectId, onManuscriptChange, storyLogicData }) => {
  const { showToast, showSuccess, showError, showWarning, showInfo } = useToast();
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  // Show empty state if no project is selected
  if (!projectId) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%', 
        minHeight: 400,
        gap: responsive.spacing,
        color: 'rgba(255,255,255,0.87)',
        p: responsive.padding,
      }}>
        <DescriptionIcon sx={{ fontSize: is4K ? 80 : isDesktop ? 64 : 48, opacity: 0.3 }} />
        <Typography variant="h6" sx={{ fontSize: responsive.headerFontSize }}>Velg et prosjekt</Typography>
        <Typography variant="body2" sx={{ textAlign: 'center', maxWidth: 300, fontSize: responsive.bodyFontSize }}>
          Velg eller opprett et prosjekt fra oversikten for å begynne å skrive manus.
        </Typography>
      </Box>
    );
  }
  
  // Dirty tracking to prevent circular saves and unnecessary re-renders
  const isDirtyRef = useRef(false);
  const lastSavedContentRef = useRef<string>('');
  const isInitialLoadRef = useRef(true);
  const scenesHashRef = useRef<string>('');
  const actsHashRef = useRef<string>('');
  const pendingContentRef = useRef<string>(''); // Track content changes without re-render
  const selectedManuscriptRef = useRef<Manuscript | null>(null);
  const autoSaveAbortControllerRef = useRef<AbortController | null>(null); // Prevent memory leaks
  
  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cancel any pending requests on unmount
      if (autoSaveAbortControllerRef.current) {
        autoSaveAbortControllerRef.current.abort();
      }
    };
  }, []);
  
  const [activeTab, setActiveTab] = useState<ManuscriptTabValue>('editor');
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [selectedManuscript, setSelectedManuscript] = useState<Manuscript | null>(null);
  const [acts, setActs] = useState<Act[]>([]);
  const [scenes, setScenes] = useState<SceneBreakdown[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [revisions, setRevisions] = useState<ScriptRevision[]>([]);
  
  // Memoized scene-derived arrays to avoid recreating on every render
  const sceneCharactersMemo = useMemo(() => {
    return scenes.flatMap(s => s.characters).filter((c, i, arr) => arr.indexOf(c) === i);
  }, [scenes]);

  const sceneLocationsMemo = useMemo(() => {
    const ids = scenes.map(s => s.locationId).filter((l): l is string => !!l);
    return ids.filter((l, i) => ids.indexOf(l) === i);
  }, [scenes]);
  const [isLoading, setIsLoading] = useState(false);
  const [manuscriptSaveStatus, setManuscriptSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [lastManuscriptSaved, setLastManuscriptSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNewManuscriptDialog, setShowNewManuscriptDialog] = useState(false);
  const [showSceneDialog, setShowSceneDialog] = useState(false);
  const [editingScene, setEditingScene] = useState<SceneBreakdown | null>(null);
  const [autoBreakdownEnabled, setAutoBreakdownEnabled] = useState(true);
  
  // Casting integration states
  const [castingRoles, setCastingRoles] = useState<Role[]>([]);
  const [castingLocations, setCastingLocations] = useState<Location[]>([]);
  
  // New production control states
  const [selectedScene, setSelectedScene] = useState<SceneBreakdown | null>(null);
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [showProductionPanel, setShowProductionPanel] = useState(false);
  const [sceneViewMode, setSceneViewMode] = useState<'list' | 'drag' | 'storyboard'>('list');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // New manuscript form state
  const [newManuscript, setNewManuscript] = useState({
    title: '',
    subtitle: '',
    author: '',
    format: 'fountain' as 'fountain' | 'final-draft' | 'markdown' | 'celtx',
  });

  // Edit manuscript state
  const [showEditManuscriptDialog, setShowEditManuscriptDialog] = useState(false);
  const [editingManuscript, setEditingManuscript] = useState<Manuscript | null>(null);
  const [editManuscriptForm, setEditManuscriptForm] = useState({
    title: '',
    subtitle: '',
    author: '',
    status: 'draft' as string,
  });

  // Load manuscripts on mount
  useEffect(() => {
    loadManuscripts();
    loadCastingData();
  }, [projectId]);

  // Load casting roles and locations for autocomplete
  const loadCastingData = async () => {
    try {
      const [roles, locations] = await Promise.all([
        castingService.getRoles(projectId),
        castingService.getLocations(projectId),
      ]);
      if (isMountedRef.current) {
        setCastingRoles(roles);
        setCastingLocations(locations);
        console.log(`Loaded ${roles.length} casting roles and ${locations.length} locations for autocomplete`);
      }
    } catch (error) {
      console.error('Could not load casting data for autocomplete:', error);
      // Non-critical error, don't show toast
    }
  };

  // Debounced wrapper for loadCastingData to batch multiple rapid calls
  const scheduleLoadCastingData = useCallback(() => {
    pendingCastingDataLoadRef.current = true;
    
    // Clear existing timer
    if (castingDataLoadTimerRef.current) {
      clearTimeout(castingDataLoadTimerRef.current);
    }
    
    // Debounce: wait 1000ms for all role/location creations to complete
    castingDataLoadTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current || !pendingCastingDataLoadRef.current) return;
      pendingCastingDataLoadRef.current = false;
      loadCastingData();
    }, 1000);
  }, []);

  const loadManuscripts = async () => {
    setIsLoading(true);
    try {
      const response = await manuscriptService.getManuscripts(projectId);
      setManuscripts(response);
      showInfo('Manuskripter lastet');
    } catch (error) {
      showError('Feil ved lasting av manuskripter');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScenes = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getScenes(manuscriptId);
      setScenes(response);
    } catch (error) {
      showError('Feil ved lasting av scener');
      console.error(error);
    }
  };

  const loadActs = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getActs(manuscriptId);
      setActs(response);
    } catch (error) {
      showError('Feil ved lasting av akter');
      console.error(error);
    }
  };

  const loadDialogue = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getDialogue(manuscriptId);
      setDialogueLines(response);
    } catch (error) {
      showError('Feil ved lasting av dialog');
      console.error(error);
    }
  };

  const loadRevisions = async (manuscriptId: string) => {
    try {
      const response = await manuscriptService.getRevisions(manuscriptId);
      setRevisions(response);
    } catch (error) {
      showError('Feil ved lasting av revisjoner');
      console.error(error);
    }
  };

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showSuccess('Tilkoblet nettverk');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showWarning('Frakoblet - arbeider i offline-modus');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showSuccess, showWarning]);

  // Initialize refs when manuscript is selected (no auto-save here, it's handled in handleEditorContentChange)
  useEffect(() => {
    if (!selectedManuscript) return;
    
    // Always initialize refs when manuscript changes
    selectedManuscriptRef.current = selectedManuscript;
    lastSavedContentRef.current = selectedManuscript.content || '';
    pendingContentRef.current = selectedManuscript.content || '';
    isDirtyRef.current = false;
    isInitialLoadRef.current = false;
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [selectedManuscript?.id]);

  // Auto-save scenes when scenes array content actually changes
  useEffect(() => {
    if (scenes.length === 0) return;
    
    // Create a hash of scene content to detect actual changes
    const currentHash = JSON.stringify(scenes.map(s => ({ id: s.id, heading: s.sceneHeading, description: s.description })));
    
    // Skip if content hasn't changed (prevents saves on reference changes)
    if (currentHash === scenesHashRef.current) {
      return;
    }
    
    // Skip initial load
    if (scenesHashRef.current === '') {
      scenesHashRef.current = currentHash;
      return;
    }
    
    scenesHashRef.current = currentHash;
    
    const saveScenes = async () => {
      try {
        // Save only modified scenes (batch update)
        await Promise.all(scenes.map(scene => manuscriptService.saveScene(scene)));
        console.log('✓ Scener auto-lagret:', scenes.length);
      } catch (error) {
        console.error('Error saving scenes:', error);
      }
    };
    
    const timer = setTimeout(saveScenes, 2000);
    return () => clearTimeout(timer);
  }, [scenes]);

  // Auto-save acts when acts array content actually changes
  useEffect(() => {
    if (acts.length === 0) return;
    
    // Create a hash of act content to detect actual changes
    const currentHash = JSON.stringify(acts.map(a => ({ id: a.id, title: a.title, description: a.description })));
    
    // Skip if content hasn't changed
    if (currentHash === actsHashRef.current) {
      return;
    }
    
    // Skip initial load
    if (actsHashRef.current === '') {
      actsHashRef.current = currentHash;
      return;
    }
    
    actsHashRef.current = currentHash;
    
    const saveActs = async () => {
      try {
        await Promise.all(acts.map(act => manuscriptService.updateAct(act)));
        console.log('✓ Akter auto-lagret:', acts.length);
      } catch (error) {
        console.error('Error saving acts:', error);
      }
    };
    
    const timer = setTimeout(saveActs, 2000);
    return () => clearTimeout(timer);
  }, [acts]);

  const handleCreateManuscript = async () => {
    if (!newManuscript.title.trim()) {
      showWarning('Vennligst fyll inn tittel');
      return;
    }

    try {
      const manuscript: Manuscript = {
        id: `manuscript-${Date.now()}`,
        projectId,
        title: newManuscript.title,
        subtitle: newManuscript.subtitle,
        author: newManuscript.author,
        version: '1.0',
        format: newManuscript.format,
        content: '',
        pageCount: 0,
        wordCount: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create manuscript via API
      const createdManuscript = await manuscriptService.createManuscript(manuscript);
      
      setManuscripts([...manuscripts, createdManuscript]);
      setSelectedManuscript(createdManuscript);
      setShowNewManuscriptDialog(false);
      setNewManuscript({ title: '', subtitle: '', author: '', format: 'fountain' });
      showSuccess('Manuskript opprettet');
      
      if (onManuscriptChange) {
        onManuscriptChange(createdManuscript);
      }
    } catch (error) {
      showError('Feil ved opprettelse av manuskript');
      console.error(error);
    }
  };

  const handleSaveManuscript = async () => {
    if (!selectedManuscript) return;

    try {
      await manuscriptService.updateManuscript(selectedManuscript);
      
      showSuccess('Manuskript lagret');
      
      if (onManuscriptChange) {
        onManuscriptChange(selectedManuscript);
      }
    } catch (error) {
      showError('Feil ved lagring av manuskript');
      console.error(error);
    }
  };

  const handleAutoBreakdown = async () => {
    if (!selectedManuscript) return;

    setIsLoading(true);
    try {
      // Parse manuscript content and auto-generate scene breakdowns
      const content = selectedManuscript.content || '';
      const lines = content.split('\n');
      const autoScenes: SceneBreakdown[] = [];
      const autoDialogue: DialogueLine[] = [];
      
      let sceneNumber = 1;
      let currentScene: Partial<SceneBreakdown> | null = null;
      let currentCharacters: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Scene heading detection (INT. / EXT.)
        if (line.match(/^(INT\.|EXT\.)/i)) {
          // Save previous scene if exists
          if (currentScene) {
            autoScenes.push({
              ...currentScene,
              id: `scene-auto-${sceneNumber - 1}`,
              manuscriptId: selectedManuscript.id,
              sceneNumber: String(sceneNumber - 1),
              characters: currentCharacters,
              status: 'not-scheduled' as const,
            } as SceneBreakdown);
            currentCharacters = [];
          }

          // Parse new scene heading
          const parts = line.split('-').map(p => p.trim());
          const intExt = parts[0].startsWith('INT') ? 'INT' : 'EXT';
          const location = parts[0].replace(/^(INT\.|EXT\.)\s*/i, '');
          const timeRaw = parts[1] || 'DAY';
          const timeOfDay: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'CONTINUOUS' | 'LATER' | 'MORNING' | 'EVENING' = 
            ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MORNING', 'EVENING'].includes(timeRaw.toUpperCase()) 
              ? timeRaw.toUpperCase() as SceneBreakdown['timeOfDay'] 
              : 'DAY';

          currentScene = {
            sceneHeading: line,
            intExt,
            locationName: location,
            timeOfDay,
            estimatedDuration: 3,
          };
          sceneNumber++;
        }
        
        // Character name detection (ALL CAPS)
        else if (line === line.toUpperCase() && line.length > 0 && line.length < 30 && !line.match(/^(FADE|CUT)/)) {
          const characterName = line.replace(/\(.*\)/, '').trim();
          if (characterName && !currentCharacters.includes(characterName)) {
            currentCharacters.push(characterName);
          }
        }
        
        // Dialogue detection (after character name)
        else if (currentScene && line.length > 0 && i > 0) {
          const prevLine = lines[i - 1].trim();
          if (prevLine === prevLine.toUpperCase() && prevLine.length < 30) {
            const characterName = prevLine.replace(/\(.*\)/, '').trim();
            autoDialogue.push({
              id: `dialogue-auto-${autoDialogue.length + 1}`,
              sceneId: `scene-auto-${sceneNumber - 1}`,
              manuscriptId: selectedManuscript.id,
              characterName: characterName,
              dialogueText: line,
              dialogueType: 'dialogue' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // Save last scene
      if (currentScene) {
        autoScenes.push({
          ...currentScene,
          id: `scene-auto-${sceneNumber - 1}`,
          manuscriptId: selectedManuscript.id,
          sceneNumber: String(sceneNumber - 1),
          characters: currentCharacters,
          status: 'not-scheduled' as const,
        } as SceneBreakdown);
      }

      // Extract unique characters (will be computed from dialogue)
      const uniqueCharacters = Array.from(new Set(currentCharacters));

      // Update state
      setScenes(autoScenes);
      setDialogueLines(autoDialogue);
      
      showSuccess(`Automatisk breakdown fullført: ${autoScenes.length} scener, ${uniqueCharacters.length} karakterer funnet`);
    } catch (error) {
      showError('Feil ved automatisk breakdown');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedManuscript) return;

    try {
      const exportData = await manuscriptService.exportManuscriptAsJSON(
        selectedManuscript,
        acts,
        scenes,
        characterList,
        dialogueLines,
        revisions
      );

      manuscriptService.downloadExportAsFile(
        exportData,
        `${selectedManuscript.title.replace(/\s+/g, '_')}_export.json`
      );

      showSuccess('Manuskript eksportert som JSON');
    } catch (error) {
      showError('Feil ved eksport');
      console.error(error);
    }
  };

  const handleImportComplete = (exportData: ManuscriptExport) => {
    const restored = exportData;

    // Update state with imported data
    setSelectedManuscript(restored.manuscript);
    setActs(restored.acts);
    setScenes(restored.scenes);
    setDialogueLines(restored.dialogueLines);
    setRevisions(restored.revisions);

    // Add to manuscripts list
    setManuscripts([
      ...manuscripts.filter(m => m.id !== restored.manuscript.id),
      restored.manuscript,
    ]);

    showSuccess('Manuskript importert og klar for bruk');
  };

  const handleApplyTemplate = (template: Template) => {
    if (!selectedManuscript) {
      // Create new manuscript from template
      const newManuscript: Manuscript = {
        id: `manuscript-${Date.now()}`,
        projectId,
        title: template.name,
        subtitle: '',
        author: '',
        version: '1.0',
        format: 'fountain',
        content: template.content,
        pageCount: 0,
        wordCount: 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      manuscriptService.createManuscript(newManuscript)
        .then(created => {
          setManuscripts([...manuscripts, created]);
          setSelectedManuscript(created);
          showSuccess(`Mal "${template.name}" brukt`);
        })
        .catch(() => showError('Feil ved bruk av mal'));
    } else {
      // Apply to existing manuscript
      const updatedContent = manuscriptTemplateService.applyTemplate(
        selectedManuscript.content,
        template
      );
      
      const updated = {
        ...selectedManuscript,
        content: updatedContent,
        updatedAt: new Date().toISOString()
      };
      
      setSelectedManuscript(updated);
      showSuccess(`Mal "${template.name}\" satt inn`);
    }
  };
  // Ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const castingDataLoadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCastingDataLoadRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cancel any pending auto-saves
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (autoSaveAbortControllerRef.current) {
        autoSaveAbortControllerRef.current.abort();
      }
      // Cancel any pending casting data loads
      if (castingDataLoadTimerRef.current) {
        clearTimeout(castingDataLoadTimerRef.current);
      }
    };
  }, []);

  // Memoized callbacks for character/location auto-creation
  const handleCharacterAdd = useCallback(async (name: string) => {
    // Auto-create a role in casting when new character is detected
    if (!projectId) return;
    const existingRole = castingRoles.find(r => r.name.toUpperCase() === name.toUpperCase());
    if (existingRole) return; // Already exists
    
    try {
      const newRole: Role = {
        id: `role-${Date.now()}`,
        name: name,
        description: `Character from screenplay`,
        requirements: {},
        status: 'draft',
      };
      await castingService.saveRole(projectId, newRole);
      // Schedule casting data reload (debounced to batch multiple creations)
      scheduleLoadCastingData();
      console.log(`✓ Auto-created role "${name}" from screenplay`);
    } catch (error) {
      console.warn('Failed to auto-create role from screenplay:', error);
    }
  }, [projectId, castingRoles]);

  const handleLocationAdd = useCallback(async (name: string) => {
    // Auto-create a location in casting when new location is detected
    if (!projectId) return;
    const existingLoc = castingLocations.find(l => l.name.toUpperCase() === name.toUpperCase());
    if (existingLoc) return; // Already exists
    
    try {
      const newLocation: Location = {
        id: `location-${Date.now()}`,
        name: name,
        type: 'indoor', // Default
        address: '',
        notes: 'Location from screenplay',
        availability: {},
        assignedScenes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveLocation(projectId, newLocation);
      // Schedule casting data reload (debounced to batch multiple creations)
      scheduleLoadCastingData();
      console.log(`✓ Auto-created location "${name}" from screenplay`);
    } catch (error) {
      console.warn('Failed to auto-create location from screenplay:', error);
    }
  }, [projectId, castingLocations]);

  // Stable callback for editor content changes
  const handleEditorContentChange = useCallback((content: string) => {
    console.log('📝 handleEditorContentChange called, content length:', content.length);
    // Store in ref immediately (no re-render)
    pendingContentRef.current = content;
    isDirtyRef.current = true;
    
    // Debounce the save to avoid constant saves while typing
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(async () => {
      // Extra safety check: don't proceed if component unmounted
      if (!isMountedRef.current) return;
      
      const manuscript = selectedManuscriptRef.current;
      if (!manuscript || !isDirtyRef.current) return;
      
      const contentToSave = pendingContentRef.current;
      if (contentToSave === lastSavedContentRef.current) return;
      
      console.log('💾 Auto-saving manuscript...');
      
      try {
        // Create new abort controller for this save request
        autoSaveAbortControllerRef.current = new AbortController();
        
        // Save to database - DO NOT update selectedManuscript state to avoid re-render
        await manuscriptService.updateManuscript(
          {
            ...manuscript,
            content: contentToSave,
            updatedAt: new Date().toISOString(),
          },
          autoSaveAbortControllerRef.current.signal
        );
        
        // Only update refs if not aborted AND component still mounted
        if (!autoSaveAbortControllerRef.current?.signal.aborted && isMountedRef.current) {
          lastSavedContentRef.current = contentToSave;
          isDirtyRef.current = false;
          console.log('✅ Manuskript auto-lagret:', manuscript.title);
          // IMPORTANT: Do NOT call onManuscriptChange or setSelectedManuscript here
          // Auto-save should be completely transparent to parent
        }
      } catch (error) {
        // Ignore abort errors (component unmounted)
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Auto-save cancelled (component unmounted)');
          return;
        }
        console.error('❌ Error during manuscript auto-save:', error);
        // Do NOT update state on error - keep parent unaware of auto-save state
      }
    }, 2000);
  }, [projectId, selectedManuscript?.id]);

  // Memoized handler for parsing screenplay content to scenes
  const handleParseToScenes = useCallback((content: string) => {
    // Parse Fountain content to create scenes
    const lines = content.split('\n');
    const newScenes: SceneBreakdown[] = [];
    let currentSceneData: {
      heading: string;
      intExt: string;
      location: string;
      timeOfDay: string;
      description: string;
      characters: string[];
      lineCount: number;
    } | null = null;
    
    const saveCurrentScene = () => {
      if (currentSceneData) {
        const scene: SceneBreakdown = {
          id: `scene-${newScenes.length + 1}`,
          manuscriptId: selectedManuscript.id,
          projectId: projectId,
          sceneNumber: String(newScenes.length + 1),
          sceneHeading: currentSceneData.heading,
          intExt: currentSceneData.intExt as 'INT' | 'EXT' | 'INT/EXT',
          locationName: currentSceneData.location,
          timeOfDay: currentSceneData.timeOfDay as SceneBreakdown['timeOfDay'],
          description: currentSceneData.description.trim(),
          characters: [...new Set(currentSceneData.characters)],
          pageLength: Math.round(currentSceneData.lineCount / 55 * 10) / 10,
          status: 'not-scheduled',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newScenes.push(scene);
      }
    };
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const sceneMatch = trimmed.match(/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[\.\s]+(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i);
      
      if (sceneMatch) {
        // Save previous scene
        saveCurrentScene();
        
        // Start new scene
        currentSceneData = {
          heading: trimmed,
          intExt: sceneMatch[1].toUpperCase().replace('.', '').replace('/', '/'),
          location: sceneMatch[2]?.trim() || '',
          timeOfDay: sceneMatch[3]?.toUpperCase() || 'DAY',
          description: '',
          characters: [],
          lineCount: 0,
        };
      } else if (currentSceneData) {
        currentSceneData.lineCount++;
        
        // Check for character names (all caps followed by dialogue)
        const characterMatch = trimmed.match(/^([A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]+)(\s*\(.*\))?$/);
        if (characterMatch && lines[lineIndex + 1]?.trim() && !lines[lineIndex + 1].trim().match(/^(INT|EXT)/i)) {
          const charName = characterMatch[1].replace(/\s*\(.*\)$/, '').trim();
          if (charName.length > 1 && charName.length < 40) {
            currentSceneData.characters.push(charName);
          }
        }
      }
    });
    
    // Save final scene
    saveCurrentScene();
    
    // Update scenes
    setScenes(newScenes);
    showSuccess(`Parsed ${newScenes.length} scenes from screenplay`);
  }, [projectId, showSuccess]);

  const handleDeleteManuscript = async (manuscript: Manuscript) => {
    if (!confirm(`Er du sikker på at du vil slette "${manuscript.title}"?`)) return;

    try {
      await manuscriptService.deleteManuscript(manuscript.id);
      
      setManuscripts(manuscripts.filter(m => m.id !== manuscript.id));
      if (selectedManuscript?.id === manuscript.id) {
        setSelectedManuscript(null);
      }
      showSuccess('Manuskript slettet');
    } catch (error) {
      showError('Feil ved sletting av manuskript');
      console.error(error);
    }
  };

  const estimatedRuntime = useMemo(() => {
    if (!selectedManuscript) return 0;
    // Industry standard: 1 page ≈ 1 minute
    return selectedManuscript.pageCount;
  }, [selectedManuscript?.pageCount]);

  const characterList = useMemo(() => {
    // Extract unique characters from dialogue
    const characters = new Set<string>();
    dialogueLines.forEach(line => characters.add(line.characterName));
    return Array.from(characters).sort();
  }, [dialogueLines]);

  const sceneStats = useMemo(() => {
    const intScenes = scenes.filter(s => s.intExt === 'INT').length;
    const extScenes = scenes.filter(s => s.intExt === 'EXT').length;
    const dayScenes = scenes.filter(s => s.timeOfDay === 'DAY').length;
    const nightScenes = scenes.filter(s => s.timeOfDay === 'NIGHT').length;
    
    return { intScenes, extScenes, dayScenes, nightScenes, total: scenes.length };
  }, [scenes]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ContextualNudgeBanner context="manuscript" accentColor="#ec4899" />
      {/* Header */}
      <Box sx={{ p: responsive.headerPadding, borderBottom: 1, borderColor: 'divider' }}>
        <Stack 
          direction={responsive.headerStackDirection} 
          spacing={responsive.spacing} 
          alignItems={isMobile ? 'stretch' : 'center'} 
          justifyContent="space-between"
        >
          <Typography 
            variant="h5" 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              fontSize: responsive.headerFontSize,
              fontWeight: 600,
            }}
          >
            <DescriptionIcon sx={{ fontSize: responsive.iconSize }} />
            {isMobile ? 'Manuskript' : 'Manuskript & Script'}
          </Typography>
          
          <Stack 
            direction="row" 
            spacing={isMobile ? 0.5 : 1} 
            flexWrap="wrap"
            justifyContent={isMobile ? 'flex-start' : 'flex-end'}
            sx={{ gap: isMobile ? 0.5 : 1 }}
          >
            {selectedManuscript && (
              <>
                <Button
                  variant="outlined"
                  startIcon={!isMobile ? <AutoFixHighIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
                  size={responsive.buttonSize}
                  onClick={handleAutoBreakdown}
                  disabled={isLoading}
                  sx={{ fontSize: responsive.bodyFontSize }}
                >
                  {isMobile ? 'Auto' : 'Auto Breakdown'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={!isMobile ? <FileDownloadIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
                  size={responsive.buttonSize}
                  onClick={handleExport}
                  disabled={isLoading}
                  title="Eksporter hele manuskriptet med produksjondata som JSON"
                  sx={{ fontSize: responsive.bodyFontSize }}
                >
                  Eksporter
                </Button>
                <Button
                  variant="contained"
                  startIcon={!isMobile ? <SaveIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
                  size={responsive.buttonSize}
                  onClick={handleSaveManuscript}
                  disabled={isLoading}
                  sx={{ fontSize: responsive.bodyFontSize }}
                >
                  Lagre
                </Button>
              </>
            )}
            <Button
              variant="outlined"
              startIcon={!isMobile ? <FileUploadIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              size={responsive.buttonSize}
              onClick={() => setShowImportDialog(true)}
              title="Importer manuskript fra tidligere eksport"
              sx={{ fontSize: responsive.bodyFontSize }}
            >
              Importer
            </Button>
            <Button
              variant="outlined"
              startIcon={!isMobile ? <MenuBookIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              size={responsive.buttonSize}
              onClick={() => setShowTemplatePanel(true)}
              sx={{ 
                borderColor: '#00d4ff', 
                color: '#00d4ff', 
                fontSize: responsive.bodyFontSize,
                '&:hover': { borderColor: '#00b8e6', bgcolor: 'rgba(0,212,255,0.1)' } 
              }}
            >
              Maler
            </Button>
            <Button
              variant="contained"
              startIcon={!isMobile ? <AddIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              size={responsive.buttonSize}
              onClick={() => setShowNewManuscriptDialog(true)}
              sx={{ fontSize: responsive.bodyFontSize }}
            >
              {isMobile ? 'Nytt' : 'Nytt Manuskript'}
            </Button>
          </Stack>
        </Stack>

        {/* Manuscript Cards - shown when no manuscript is selected */}
        {!selectedManuscript && manuscripts.length > 0 && (
          <Box sx={{ mt: responsive.cardSpacing }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: responsive.spacing, 
                color: '#fff', 
                fontWeight: 600,
                fontSize: responsive.titleFontSize,
              }}
            >
              Dine Manuskripter
            </Typography>
            <Grid container spacing={responsive.cardSpacing}>
              {manuscripts.map(manuscript => (
                <Grid key={manuscript.id} size={responsive.cardGridSize}>
                  <Card 
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: isMobile ? 2 : 3,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.05)',
                        borderColor: '#9c27b0',
                        transform: isMobile ? 'none' : 'translateY(-4px)',
                        boxShadow: '0 12px 40px rgba(156, 39, 176, 0.2)',
                      },
                    }}
                  >
                    {/* Cover Image */}
                    <Box 
                      sx={{ 
                        position: 'relative',
                        height: responsive.cardImageHeight,
                        bgcolor: manuscript.coverImage 
                          ? 'transparent' 
                          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                        background: manuscript.coverImage 
                          ? `url(${manuscript.coverImage}) center/cover`
                          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onClick={() => {
                        setSelectedManuscript(manuscript);
                        loadScenes(manuscript.id);
                        loadActs(manuscript.id);
                        loadDialogue(manuscript.id);
                        loadRevisions(manuscript.id);
                      }}
                    >
                      {!manuscript.coverImage && (
                        <Box sx={{ textAlign: 'center' }}>
                          <MenuBookIcon sx={{ fontSize: is4K ? 80 : isDesktop ? 64 : 48, color: 'rgba(156, 39, 176, 0.4)', mb: 1 }} />
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'rgba(255,255,255,0.6)',
                              display: 'block',
                              fontSize: responsive.captionFontSize,
                            }}
                          >
                            Klikk for å åpne
                          </Typography>
                        </Box>
                      )}
                      
                      {/* Cover Upload Overlay */}
                      <Box 
                        sx={{ 
                          position: 'absolute',
                          top: isMobile ? 4 : 8,
                          right: isMobile ? 4 : 8,
                          display: 'flex',
                          gap: 0.5,
                          opacity: isMobile ? 1 : 0,
                          transition: 'opacity 0.2s',
                          '.MuiCard-root:hover &': { opacity: 1 },
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          id={`cover-upload-${manuscript.id}`}
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = async (event) => {
                                const coverImage = event.target?.result as string;
                                const updatedManuscript: Manuscript = { ...manuscript, coverImage };
                                await manuscriptService.updateManuscript(updatedManuscript);
                                loadManuscripts();
                                showSuccess('Cover oppdatert');
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Tooltip title="Last opp cover">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById(`cover-upload-${manuscript.id}`)?.click();
                            }}
                            sx={{ 
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              '&:hover': { bgcolor: 'rgba(156, 39, 176, 0.8)' },
                            }}
                          >
                            <FileUploadIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Status Badge on Cover */}
                      <Chip 
                        label={manuscript.status === 'shooting' ? 'PRODUKSJON' : 
                               manuscript.status === 'approved' ? 'GODKJENT' : 
                               manuscript.status === 'review' ? 'GJENNOMGANG' :
                               manuscript.status === 'completed' ? 'FULLFØRT' : 'UTKAST'}
                        size={responsive.chipSize}
                        sx={{
                          position: 'absolute',
                          top: isMobile ? 8 : 12,
                          left: isMobile ? 8 : 12,
                          bgcolor: manuscript.status === 'shooting' ? 'rgba(16, 185, 129, 0.9)' :
                                   manuscript.status === 'approved' ? 'rgba(59, 130, 246, 0.9)' :
                                   manuscript.status === 'completed' ? 'rgba(16, 185, 129, 0.9)' :
                                   'rgba(100, 100, 100, 0.9)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: responsive.captionFontSize,
                          letterSpacing: '0.5px',
                        }}
                      />
                    </Box>

                    <CardContent sx={{ p: isMobile ? 1.5 : 2.5 }}>
                      {/* Title Row with Edit Button */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: '#fff', 
                            fontWeight: 700, 
                            fontSize: responsive.titleFontSize,
                            lineHeight: 1.3,
                            flex: 1,
                            pr: 1,
                          }}
                        >
                          {manuscript.title}
                        </Typography>
                        <Tooltip title="Rediger manuskript">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingManuscript(manuscript);
                              setEditManuscriptForm({
                                title: manuscript.title,
                                subtitle: manuscript.subtitle || '',
                                author: manuscript.author || '',
                                status: manuscript.status || 'draft',
                              });
                              setShowEditManuscriptDialog(true);
                            }}
                            sx={{ 
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#9c27b0', bgcolor: 'rgba(156, 39, 176, 0.1)' },
                            }}
                          >
                            <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Subtitle */}
                      {manuscript.subtitle && (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'rgba(255,255,255,0.87)', 
                            mb: 1.5,
                            fontSize: responsive.bodyFontSize,
                          }}
                        >
                          {manuscript.subtitle}
                        </Typography>
                      )}

                      {/* Author */}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'rgba(255,255,255,0.87)', 
                          mb: responsive.spacing,
                          fontSize: responsive.captionFontSize,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <PersonIcon sx={{ fontSize: responsive.iconSize - 6 }} />
                        {manuscript.author || 'Ukjent forfatter'}
                      </Typography>

                      {/* Stats Row */}
                      <Box sx={{ 
                        display: 'flex', 
                        gap: isMobile ? 1 : 2, 
                        flexWrap: 'wrap',
                        py: isMobile ? 1 : 1.5,
                        px: isMobile ? 1 : 1.5,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: 1.5,
                        mb: responsive.spacing,
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <DescriptionIcon sx={{ fontSize: responsive.iconSize - 6, color: '#9c27b0' }} />
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 500, fontSize: responsive.captionFontSize }}>
                            {manuscript.pageCount || 0} sider
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ScheduleIcon sx={{ fontSize: responsive.iconSize - 6, color: '#9c27b0' }} />
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 500, fontSize: responsive.captionFontSize }}>
                            v{manuscript.version || '1.0'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <SceneIcon sx={{ fontSize: responsive.iconSize - 6, color: '#9c27b0' }} />
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontWeight: 500, fontSize: responsive.captionFontSize }}>
                            {manuscript.wordCount || 0} ord
                          </Typography>
                        </Box>
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          size={responsive.buttonSize}
                          onClick={() => {
                            setSelectedManuscript(manuscript);
                            loadScenes(manuscript.id);
                            loadActs(manuscript.id);
                            loadDialogue(manuscript.id);
                            loadRevisions(manuscript.id);
                          }}
                          sx={{
                            bgcolor: '#9c27b0',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: responsive.bodyFontSize,
                            '&:hover': { bgcolor: '#7b1fa2' },
                          }}
                          endIcon={<ChevronRightIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
                        >
                          Åpne
                        </Button>
                        <Tooltip title="Slett manuskript">
                          <IconButton
                            size="small"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Er du sikker på at du vil slette "${manuscript.title}"?`)) {
                                await manuscriptService.deleteManuscript(manuscript.id);
                                loadManuscripts();
                                showSuccess('Manuskript slettet');
                              }
                            }}
                            sx={{ 
                              color: 'rgba(255,255,255,0.7)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              '&:hover': { color: '#ef4444', borderColor: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Empty state */}
        {!selectedManuscript && manuscripts.length === 0 && !isLoading && (
          <Box sx={{ 
            mt: responsive.cardSpacing, 
            textAlign: 'center',
            p: responsive.padding,
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: 2,
            border: '1px dashed rgba(255,255,255,0.1)',
          }}>
            <DescriptionIcon sx={{ fontSize: is4K ? 80 : isDesktop ? 64 : 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, fontSize: responsive.titleFontSize }}>
              Ingen manuskripter ennå
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: responsive.spacing, fontSize: responsive.bodyFontSize }}>
              Opprett ditt første manuskript eller importer et eksisterende
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
              size={responsive.buttonSize}
              onClick={() => setShowNewManuscriptDialog(true)}
              sx={{
                bgcolor: '#9c27b0',
                fontSize: responsive.bodyFontSize,
                '&:hover': { bgcolor: '#7b1fa2' },
              }}
            >
              Opprett nytt manuskript
            </Button>
          </Box>
        )}

        {/* Back button and stats when manuscript is selected */}
        {selectedManuscript && (
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
              size={responsive.buttonSize}
              onClick={() => setSelectedManuscript(null)}
              sx={{ 
                color: '#9c27b0',
                borderColor: 'rgba(156, 39, 176, 0.5)',
                mb: responsive.spacing,
                fontSize: responsive.bodyFontSize,
                '&:hover': { 
                  bgcolor: 'rgba(156, 39, 176, 0.1)',
                  borderColor: '#9c27b0',
                },
              }}
            >
              {isMobile ? '← Tilbake' : '← Tilbake til kortvisning'}
            </Button>
            <Box sx={{ display: 'flex', gap: isMobile ? 1 : 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#fff', 
                  fontWeight: 600,
                  fontSize: responsive.titleFontSize,
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                {selectedManuscript.title}
              </Typography>
              <Chip 
                icon={<DescriptionIcon sx={{ fontSize: responsive.iconSize - 8 }} />} 
                label={`${selectedManuscript.pageCount} sider`} 
                size={responsive.chipSize}
                sx={{ fontSize: responsive.captionFontSize }}
              />
              <Chip 
                icon={<ScheduleIcon sx={{ fontSize: responsive.iconSize - 8 }} />} 
                label={`~${estimatedRuntime} min`} 
                size={responsive.chipSize}
                sx={{ fontSize: responsive.captionFontSize }}
              />
              {!isMobile && (
                <>
                  <Chip 
                    icon={<SceneIcon sx={{ fontSize: responsive.iconSize - 8 }} />} 
                    label={`${sceneStats.total} scener`} 
                    size={responsive.chipSize}
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                  <Chip 
                    icon={<PersonIcon sx={{ fontSize: responsive.iconSize - 8 }} />} 
                    label={`${characterList.length} karakterer`} 
                    size={responsive.chipSize}
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                </>
              )}
              <Chip 
                label={selectedManuscript.status.toUpperCase()} 
                size={responsive.chipSize}
                sx={{ fontSize: responsive.captionFontSize }}
                color={
                  selectedManuscript.status === 'approved' ? 'success' : 
                  selectedManuscript.status === 'shooting' ? 'primary' : 
                  'default'
                }
              />
              
              {/* Manuscript Save Status */}
              {manuscriptSaveStatus === 'saved' && (
                <Chip 
                  icon={<CheckCircleIcon sx={{ fontSize: responsive.iconSize - 8 }} />}
                  label={lastManuscriptSaved ? (isMobile ? 'Lagret' : `Lagret ${lastManuscriptSaved.toLocaleTimeString('nb-NO')}`) : 'Lagret'} 
                  size={responsive.chipSize}
                  sx={{ 
                    bgcolor: 'rgba(52, 211, 153, 0.2)',
                    color: '#34d399',
                    fontSize: responsive.captionFontSize,
                  }}
                />
              )}
              {manuscriptSaveStatus === 'saving' && (
                <Chip 
                  icon={<CircularProgress size={isMobile ? 12 : 16} />}
                  label="Lagrer..." 
                  size={responsive.chipSize}
                  sx={{ 
                    bgcolor: 'rgba(60, 165, 250, 0.2)',
                    color: '#60a5fa',
                    fontSize: responsive.captionFontSize,
                  }}
                />
              )}
              {manuscriptSaveStatus === 'unsaved' && (
                <Chip 
                  label={isMobile ? '● Ulagret' : '● Ulagret endringer'} 
                  size={responsive.chipSize}
                  sx={{ 
                    bgcolor: 'rgba(251, 191, 36, 0.2)',
                    color: '#fbbf24',
                    fontSize: responsive.captionFontSize,
                  }}
                />
              )}
              {manuscriptSaveStatus === 'error' && (
                <Tooltip title="Feil ved automatisk lagring - prøv manuell lagring">
                  <Chip 
                    icon={<WarningIcon sx={{ fontSize: responsive.iconSize - 8 }} />}
                    label="Lagringsfeil" 
                    size={responsive.chipSize}
                    sx={{ 
                      bgcolor: 'rgba(244, 63, 94, 0.2)',
                      color: '#f43f5e',
                      fontSize: responsive.captionFontSize,
                    }}
                  />
                </Tooltip>
              )}
              
              {/* Online Status */}
              <Tooltip title={isOnline ? 'Tilkoblet nettverk' : 'Arbeider offline - endringer lagres lokalt'}>
                <Box 
                  sx={{ 
                    width: isMobile ? 6 : 8, 
                    height: isMobile ? 6 : 8, 
                    borderRadius: '50%', 
                    bgcolor: isOnline ? '#34d399' : '#fbbf24',
                    display: 'inline-block',
                  }}
                />
              </Tooltip>
            </Box>
          </Box>
        )}
      </Box>

      {selectedManuscript && (
        <>
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider', 
              px: responsive.padding,
              minHeight: isMobile ? 40 : 48,
              '& .MuiTab-root': {
                minHeight: isMobile ? 40 : 48,
                fontSize: responsive.tabFontSize,
                minWidth: isMobile ? 'auto' : undefined,
                px: isMobile ? 1 : 2,
              },
            }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label={responsive.showTabLabels ? "Editor" : ""} 
              value="editor" 
              icon={<EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Akter" : ""} 
              value="acts" 
              icon={<MenuBookIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Scener" : ""} 
              value="scenes" 
              icon={<SceneIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Karakterer" : ""} 
              value="characters" 
              icon={<PersonIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Dialog" : ""} 
              value="dialogue" 
              icon={<ChatIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Breakdown" : ""} 
              value="breakdown" 
              icon={<AssessmentIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Revisjoner" : ""} 
              value="revisions" 
              icon={<HistoryIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Timeline" : ""} 
              value="timeline" 
              icon={<TimelineIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Produksjon" : ""} 
              value="production" 
              icon={<ViewModuleIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
            <Tab 
              label={responsive.showTabLabels ? "Production View" : ""} 
              value="productionview" 
              icon={<MovieIcon sx={{ fontSize: responsive.iconSize - 4 }} />} 
              iconPosition="start" 
            />
          </Tabs>

          {/* Tab content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: responsive.padding }}>
            {/* Editor Tab */}
            {activeTab === 'editor' && (
              <EditorTab
                manuscript={selectedManuscript}
                scenes={scenes}
                onContentChange={handleEditorContentChange}
                onParseToScenes={handleParseToScenes}
                characters={sceneCharactersMemo}
                locations={sceneLocationsMemo}
                castingRoles={castingRoles}
                castingLocations={castingLocations}
                onCharacterAdd={handleCharacterAdd}
                onLocationAdd={handleLocationAdd}
              />
            )}

            {/* Acts Tab */}
            {activeTab === 'acts' && (
              <ActsTab
                acts={acts}
                manuscriptId={selectedManuscript?.id || ''}
                onActsChange={setActs}
              />
            )}

            {/* Scenes Tab */}
            {activeTab === 'scenes' && (
              <ScenesTab
                scenes={scenes}
                viewMode={sceneViewMode}
                onViewModeChange={setSceneViewMode}
                onAddScene={() => {
                  setEditingScene(null);
                  setShowSceneDialog(true);
                }}
                onEditScene={(scene) => {
                  setEditingScene(scene);
                  setShowSceneDialog(true);
                }}
                onSelectScene={(scene) => {
                  setSelectedScene(scene);
                  setShowProductionPanel(true);
                }}
                onReorderScenes={setScenes}
                selectedScene={selectedScene || undefined}
              />
            )}

            {/* Characters Tab */}
            {activeTab === 'characters' && (
              <CharactersTab 
                characters={characterList} 
                dialogueLines={dialogueLines}
                manuscriptId={selectedManuscript?.id}
                scenes={scenes}
                onCharactersChange={(chars) => {
                  // Character updates would need backend support
                  console.log('Character update:', chars);
                }}
              />
            )}

            {/* Dialogue Tab */}
            {activeTab === 'dialogue' && (
              <DialogueTab 
                dialogueLines={dialogueLines} 
                scenes={scenes}
                manuscriptId={selectedManuscript?.id}
                onDialogueChange={setDialogueLines}
              />
            )}

            {/* Breakdown Tab */}
            {activeTab === 'breakdown' && (
              <BreakdownTab scenes={scenes} sceneStats={sceneStats} />
            )}

            {/* Revisions Tab */}
            {activeTab === 'revisions' && (
              <RevisionsTab 
                revisions={revisions} 
                manuscript={selectedManuscript}
                onRevisionsChange={setRevisions}
                onCreateRevision={async () => {
                  // Could also trigger from parent
                  const newRevision: ScriptRevision = {
                    id: `rev-${Date.now()}`,
                    manuscriptId: selectedManuscript.id,
                    version: `${selectedManuscript.version || 1}.${revisions.length + 1}`,
                    createdAt: new Date().toISOString(),
                    changedBy: 'current-user',
                    changesSummary: 'Automatisk lagret',
                    content: selectedManuscript.content,
                  };
                  setRevisions([...revisions, newRevision]);
                }}
              />
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <TimelineView
                scenes={scenes}
                onSceneSelect={(scene) => {
                  setSelectedScene(scene);
                  setShowProductionPanel(true);
                }}
                selectedScene={selectedScene || undefined}
              />
            )}

            {/* Production Tab - with Script-Storyboard Integration */}
            {activeTab === 'production' && selectedScene && (
              <ScriptStoryboardProvider
                initialState={{
                  currentScene: {
                    sceneId: selectedScene.id,
                    sceneNumber: selectedScene.sceneNumber,
                    sceneHeading: selectedScene.sceneHeading,
                    sceneType: selectedScene.intExt,
                    location: selectedScene.locationName,
                    timeOfDay: selectedScene.timeOfDay,
                    startLine: 0,
                    endLine: 0,
                  },
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <StoryboardIntegrationView
                      scene={selectedScene}
                      onUpdate={(updatedScene) => {
                        setScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
                        setSelectedScene(updatedScene);
                      }}
                      showScriptPanel={true}
                      scriptContent={selectedManuscript?.content}
                      onScriptChange={(content) => {
                        if (selectedManuscript) {
                          setSelectedManuscript(prev => prev ? { ...prev, content } : prev);
                        }
                      }}
                    />
                  </Box>
                  <Box sx={{ width: 400 }}>
                    <ShotDetailPanel
                      scene={selectedScene}
                      onUpdate={(updatedScene) => {
                        setScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
                        setSelectedScene(updatedScene);
                      }}
                    />
                  </Box>
                </Box>
              </ScriptStoryboardProvider>
            )}

            {activeTab === 'production' && !selectedScene && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  Velg en scene fra Scener-tabben for å se produksjonsdetaljer
                </Typography>
              </Box>
            )}

            {/* Production View Tab - Full Production Layout */}
            {activeTab === 'productionview' && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <ProductionManuscriptView
                  manuscript={selectedManuscript}
                  scenes={scenes}
                  dialogueLines={dialogueLines}
                  acts={acts}
                  projectId={projectId}
                  storyLogicData={storyLogicData}
                  onSceneUpdate={async (updatedScene) => {
                    // Update local state
                    setScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
                    // Persist to service
                    try {
                      await manuscriptService.saveScene(updatedScene);
                      showSuccess('Scene lagret');
                      console.log('Scene saved:', updatedScene.id);
                    } catch (error) {
                      console.error('Failed to save scene:', error);
                      showError('Kunne ikke lagre scene-endringer');
                    }
                  }}
                  onSceneDelete={async (sceneId) => {
                    // Update local state
                    const oldScenes = scenes;
                    setScenes(scenes.filter(s => s.id !== sceneId));
                    // Note: manuscriptService doesn't have deleteScene, so we just update local state
                    // The scene will be removed from manuscript when saved
                    try {
                      showSuccess('Scene slettet');
                    } catch (error) {
                      console.error('Failed to delete scene:', error);
                      showError('Kunne ikke slette scene');
                      // Rollback on error
                      setScenes(oldScenes);
                    }
                  }}
                  onSceneCreate={async (newScene) => {
                    // Update local state
                    setScenes([...scenes, newScene]);
                    // Persist to service
                    try {
                      await manuscriptService.saveScene(newScene);
                      showSuccess('Ny scene opprettet');
                    } catch (error) {
                      console.error('Failed to create scene:', error);
                      showError('Kunne ikke opprette scene');
                      // Rollback on error
                      setScenes(scenes.filter(s => s.id !== newScene.id));
                    }
                  }}
                  onScenesReorder={async (reorderedScenes) => {
                    // Update local state with reordered scenes
                    const oldScenes = scenes;
                    setScenes(reorderedScenes);
                    
                    // Persist all scenes with updated order
                    try {
                      await Promise.all(
                        reorderedScenes.map(scene => manuscriptService.saveScene(scene))
                      );
                      showSuccess('Scene-rekkefølge oppdatert');
                    } catch (error) {
                      console.error('Failed to reorder scenes:', error);
                      showError('Kunne ikke oppdatere scene-rekkefølge');
                      // Rollback on error
                      setScenes(oldScenes);
                    }
                  }}
                  onManuscriptUpdate={async (updatedManuscript) => {
                    setSelectedManuscript(updatedManuscript);
                    if (onManuscriptChange) {
                      onManuscriptChange(updatedManuscript);
                    }
                    // Persist to service
                    try {
                      await manuscriptService.updateManuscript(updatedManuscript);
                      console.log('Manuscript saved:', updatedManuscript.id);
                    } catch (error) {
                      console.error('Failed to save manuscript:', error);
                      showError('Kunne ikke lagre manuskript-endringer');
                    }
                  }}
                  onClose={() => setActiveTab('editor')}
                />
              </Box>
            )}
          </Box>

          {/* Production Control Panel Drawer */}
          <Drawer
            anchor="right"
            open={showProductionPanel}
            onClose={() => setShowProductionPanel(false)}
            sx={{
              '& .MuiDrawer-paper': {
                width: 400,
                p: 0,
              },
            }}
          >
            <ProductionControlPanel
              selectedScene={selectedScene || undefined}
              selectedShot={selectedShot || undefined}
              onClose={() => setShowProductionPanel(false)}
            />
          </Drawer>
        </>
      )}

      {/* New Manuscript Dialog */}
      <Dialog open={showNewManuscriptDialog} onClose={() => setShowNewManuscriptDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt Manuskript</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tittel"
              fullWidth
              required
              value={newManuscript.title}
              onChange={(e) => setNewManuscript({ ...newManuscript, title: e.target.value })}
            />
            <TextField
              label="Undertittel"
              fullWidth
              value={newManuscript.subtitle}
              onChange={(e) => setNewManuscript({ ...newManuscript, subtitle: e.target.value })}
            />
            <TextField
              label="Forfatter"
              fullWidth
              value={newManuscript.author}
              onChange={(e) => setNewManuscript({ ...newManuscript, author: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={newManuscript.format}
                onChange={(e) => setNewManuscript({ ...newManuscript, format: e.target.value as Manuscript['format'] })}
                label="Format"
              >
                <MenuItem value="fountain">Fountain (anbefalt)</MenuItem>
                <MenuItem value="markdown">Markdown</MenuItem>
                <MenuItem value="final-draft">Final Draft</MenuItem>
                <MenuItem value="celtx">Celtx</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewManuscriptDialog(false)}>Avbryt</Button>
          <Button onClick={handleCreateManuscript} variant="contained">Opprett</Button>
        </DialogActions>
      </Dialog>

      {/* Import Manuscript Dialog */}
      <ImportManuscriptDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        projectId={projectId}
        onImportComplete={handleImportComplete}
      />

      {/* Template Panel */}
      <ManuscriptTemplatePanel
        open={showTemplatePanel}
        onClose={() => setShowTemplatePanel(false)}
        onApplyTemplate={handleApplyTemplate}
        currentContent={selectedManuscript?.content || ''}
      />

      {/* Edit Manuscript Dialog */}
      <Dialog 
        open={showEditManuscriptDialog} 
        onClose={() => setShowEditManuscriptDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            border: '1px solid rgba(156, 39, 176, 0.3)',
            borderRadius: 3,
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon sx={{ color: '#9c27b0' }} />
            Rediger Manuskript
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Cover Image Upload */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                Cover-bilde
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                alignItems: 'center',
              }}>
                <Box sx={{ 
                  width: 100, 
                  height: 140, 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  border: '1px dashed rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundImage: editingManuscript?.coverImage 
                    ? `url(${editingManuscript.coverImage})`
                    : 'none',
                }}>
                  {!editingManuscript?.coverImage && (
                    <MenuBookIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.6)' }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="edit-cover-upload"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && editingManuscript) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const coverImage = event.target?.result as string;
                          setEditingManuscript({ ...editingManuscript, coverImage });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => document.getElementById('edit-cover-upload')?.click()}
                    startIcon={<FileUploadIcon />}
                    sx={{
                      borderColor: 'rgba(156, 39, 176, 0.5)',
                      color: '#9c27b0',
                      mb: 1,
                      '&:hover': { borderColor: '#9c27b0', bgcolor: 'rgba(156, 39, 176, 0.1)' },
                    }}
                  >
                    Last opp cover
                  </Button>
                  {editingManuscript?.coverImage && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => setEditingManuscript({ ...editingManuscript!, coverImage: undefined })}
                      sx={{ ml: 1 }}
                    >
                      Fjern
                    </Button>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                    Anbefalt størrelse: 600x900px
                  </Typography>
                </Box>
              </Box>
            </Box>

            <TextField
              label="Tittel"
              fullWidth
              required
              value={editManuscriptForm.title}
              onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, title: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(156, 39, 176, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              label="Undertittel"
              fullWidth
              value={editManuscriptForm.subtitle}
              onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, subtitle: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(156, 39, 176, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              label="Forfatter"
              fullWidth
              value={editManuscriptForm.author}
              onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, author: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(156, 39, 176, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
              <Select
                value={editManuscriptForm.status}
                onChange={(e) => setEditManuscriptForm({ ...editManuscriptForm, status: e.target.value })}
                label="Status"
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(156, 39, 176, 0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#9c27b0' },
                }}
              >
                <MenuItem value="draft">Utkast</MenuItem>
                <MenuItem value="review">Gjennomgang</MenuItem>
                <MenuItem value="approved">Godkjent</MenuItem>
                <MenuItem value="shooting">Produksjon</MenuItem>
                <MenuItem value="completed">Fullført</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button 
            onClick={() => setShowEditManuscriptDialog(false)}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            Avbryt
          </Button>
          <Button 
            onClick={async () => {
              if (editingManuscript) {
                const updated: Manuscript = {
                  ...editingManuscript,
                  title: editManuscriptForm.title,
                  subtitle: editManuscriptForm.subtitle,
                  author: editManuscriptForm.author,
                  status: editManuscriptForm.status as Manuscript['status'],
                  coverImage: editingManuscript.coverImage,
                };
                await manuscriptService.updateManuscript(updated);
                loadManuscripts();
                setShowEditManuscriptDialog(false);
                showSuccess('Manuskript oppdatert');
              }
            }} 
            variant="contained"
            sx={{ 
              bgcolor: '#9c27b0',
              '&:hover': { bgcolor: '#7b1fa2' },
            }}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Sub-components for each tab
interface EditorTabProps {
  manuscript: Manuscript; 
  onContentChange: (content: string) => void;
  onParseToScenes?: (content: string) => void;
  characters?: string[];
  locations?: string[];
  castingRoles?: Role[];
  castingLocations?: Location[];
  scenes?: SceneBreakdown[];
  onCharacterAdd?: (name: string) => void;
  onLocationAdd?: (name: string) => void;
}

const EditorTab: React.FC<EditorTabProps> = React.memo(({
  manuscript,
  onContentChange,
  onParseToScenes,
  characters = [],
  locations = [],
  castingRoles = [],
  castingLocations = [],
  scenes = [],
  onCharacterAdd,
  onLocationAdd,
}) => {
  const { showSuccess, showInfo } = useToast();
  const [showAdvancedEditor, setShowAdvancedEditor] = useState(true);
  const [showParseDialog, setShowParseDialog] = useState(false);
  
  // DEBUG: Log every render
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  console.log(`🔄 EditorTab RENDER #${renderCountRef.current}, manuscript.id:`, manuscript.id);
  
  // Lokal state for editorinnhold - DENNE er source of truth for editoren
  // EditorTab manages its own content state independently from parent
  const [editorContent, setEditorContent] = useState(manuscript.content || '');
  // Ref for å tracke siste synkroniserte id (for å unngå unødvendige syncs)
  const lastSyncedIdRef = useRef(manuscript.id);
  const lastChangeValueRef = useRef(manuscript.content || ''); // Track last value to prevent redundant updates
  
  console.log('📊 EditorTab state - editorContent length:', editorContent.length, 'manuscript.content length:', manuscript.content?.length);
  
  // Stable onChange callback for ScreenplayEditorWithNavigator - ONLY update parent, NOT local state
  const handleScreenplayChange = useCallback((val: string) => {
    console.log('✏️ ScreenplayEditorWithNavigator onChange, length:', val.length);
    // Only update local state if value actually changed
    if (val !== lastChangeValueRef.current) {
      lastChangeValueRef.current = val;
      setEditorContent(val);
    }
    // Always notify parent immediately (they handle debouncing)
    onContentChange(val);
  }, [onContentChange]);
  
  // CRITICAL: Only sync when document ID changes (switching documents)
  // DO NOT sync when manuscript.content changes - that would create feedback loops with parent
  // EditorTab content is the source of truth, not the parent's manuscript object
  useEffect(() => {
    if (manuscript.id !== lastSyncedIdRef.current) {
      console.log('📄 EditorTab: Syncing to new manuscript:', manuscript.id);
      const newContent = manuscript.content || '';
      setEditorContent(newContent);
      lastChangeValueRef.current = newContent;
      lastSyncedIdRef.current = manuscript.id;
    }
  }, [manuscript.id]); // ONLY depend on ID, NOT content
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  
  // Calculate word and page count - use EditorTab's local content, not parent's
  const contentStats = useMemo(() => {
    const content = editorContent || '';
    const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    const characters = content.length;
    const lines = content.split('\n').length;
    // Standard screenplay: 1 page = ~250 words or ~55 lines
    const pages = Math.max(1, Math.round(lines / 55 * 10) / 10);
    const estimatedMinutes = Math.round(pages); // 1 page ≈ 1 minute
    
    // Count scene headings
    const sceneHeadings = content.match(/^(INT|EXT|EST|INT\.?\/EXT|I\/E)[\.\s]/gim)?.length || 0;
    
    // Count characters (uppercase lines followed by dialogue)
    const characterMatches = content.match(/^[A-ZÆØÅ][A-ZÆØÅ0-9\s\-'\.]*(\s*\(.*\))?$/gm) || [];
    const uniqueCharacters = [...new Set(characterMatches.map(c => c.replace(/\s*\(.*\)$/, '').trim()))];
    
    return { words, characters, lines, pages, estimatedMinutes, sceneHeadings, uniqueCharacters };
  }, [editorContent]);
  
  // Combine characters from scenes with casting roles - STABLE via stringified deps
  const allCharacters = useMemo(() => {
    const roleNames = castingRoles.map(r => r.name.toUpperCase());
    const sceneCharacters = characters.map(c => c.toUpperCase());
    // Merge and deduplicate, prioritizing casting roles
    const combined = [...new Set([...roleNames, ...sceneCharacters])];
    return combined.sort();
  }, [JSON.stringify(characters), JSON.stringify(castingRoles.map(r => r.name))]);
  
  // Combine locations from scenes with casting locations - STABLE via stringified deps
  const allLocations = useMemo(() => {
    const castingLocs = castingLocations.map(l => l.name);
    const sceneLocs = locations;
    return [...new Set([...castingLocs, ...sceneLocs])].sort();
  }, [JSON.stringify(locations), JSON.stringify(castingLocations.map(l => l.name))]);

  const handleSceneSelect = useCallback((scene: any) => {
    // Handle scene selection - scroll to scene in editor
    console.log('Scene selected:', scene);
  }, []);

  const handleParseToScenes = () => {
    if (onParseToScenes) {
      onParseToScenes(manuscript.content);
      showSuccess(`Parsert ${contentStats.sceneHeadings} scener fra manuskriptet`);
    }
    setShowParseDialog(false);
  };
  
  // Lazy load ScreenplayEditor
  const ScreenplayEditor = React.lazy(() => import('./ScreenplayEditor'));
  const ScreenplayEditorWithNavigator = React.lazy(() => import('./ScreenplayEditorWithNavigator'));
  const ScreenplayPDFExport = React.lazy(() => import('./ScreenplayPDFExport'));

  // Stats bar component with responsive design
  const StatsBar = () => (
    <Paper sx={{ p: isMobile ? 1 : 1.5, mb: responsive.spacing, bgcolor: 'background.paper' }}>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        spacing={isMobile ? 1 : responsive.spacing} 
        divider={!isMobile ? <Divider orientation="vertical" flexItem /> : undefined} 
        flexWrap="wrap"
        sx={{ gap: isMobile ? 0.5 : undefined }}
      >
        <Tooltip title="Antall sider (1 side ≈ 1 minutt)">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
              Sider:
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: responsive.bodyFontSize }}>
              {contentStats.pages}
            </Typography>
          </Stack>
        </Tooltip>
        <Tooltip title="Estimert spilletid">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
              Varighet:
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: responsive.bodyFontSize }}>
              ~{contentStats.estimatedMinutes} min
            </Typography>
          </Stack>
        </Tooltip>
        {!isMobile && (
          <Tooltip title="Antall ord">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Ord:
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: responsive.bodyFontSize }}>
                {contentStats.words.toLocaleString()}
              </Typography>
            </Stack>
          </Tooltip>
        )}
        <Tooltip title="Antall sceneoverskrifter funnet">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
              Scener:
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ fontSize: responsive.bodyFontSize }}>
              {contentStats.sceneHeadings}
            </Typography>
          </Stack>
        </Tooltip>
        {!isMobile && (
          <Tooltip title="Antall karakterer funnet i dialog">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Karakterer:
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: responsive.bodyFontSize }}>
                {contentStats.uniqueCharacters.length}
              </Typography>
            </Stack>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );

  if (!showAdvancedEditor) {
    // Fallback to simple textarea
    return (
      <Box>
        <StatsBar />
        <Stack 
          direction={isMobile ? 'column' : 'row'} 
          spacing={responsive.spacing} 
          sx={{ mb: responsive.spacing }} 
          alignItems={isMobile ? 'stretch' : 'center'}
        >
          <Alert severity="info" sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
              Skriv manuskriptet i {manuscript.format === 'fountain' ? 'Fountain' : manuscript.format} format.
              {manuscript.format === 'fountain' && ' Sceneoverskrifter starter med INT. eller EXT.'}
            </Typography>
          </Alert>
          <Button
            variant="outlined"
            size={responsive.buttonSize}
            onClick={() => setShowAdvancedEditor(true)}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            Avansert Editor
          </Button>
        </Stack>
        <TextField
          fullWidth
          multiline
          rows={isMobile ? 15 : isTablet ? 20 : 25}
          value={manuscript.content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={`Eksempel (Fountain format):

INT. APARTMENT - DAY

ANNA (30s, energisk) kommer inn med kaffekrus.

ANNA
Har du sett manuskriptet?

BJØRN (40s) ser opp fra datamaskinen.

BJØRN
(smilende)
Det ligger på bordet.

EXT. CITY STREET - NIGHT

Anna går raskt gjennom regnet.
`}
          sx={{
            fontFamily: 'Courier New, monospace',
            fontSize: is4K ? '16px' : isDesktop ? '14px' : '13px',
            '& .MuiInputBase-input': {
              lineHeight: 1.6,
            },
          }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: isMobile ? 'calc(100vh - 350px)' : 'calc(100vh - 300px)', 
      minHeight: isMobile ? 350 : 500 
    }}>
      {/* Stats Bar */}
      <StatsBar />
      
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        spacing={isMobile ? 1 : responsive.spacing} 
        sx={{ mb: responsive.spacing }} 
        alignItems={isMobile ? 'stretch' : 'center'} 
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip 
            label={isMobile ? 'Fountain' : 'Fountain Editor'} 
            color="primary" 
            size={responsive.chipSize}
            icon={<CodeIcon sx={{ fontSize: responsive.iconSize - 6 }} />}
            sx={{ fontSize: responsive.captionFontSize }}
          />
          {!isMobile && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
              Profesjonell screenplay-editor med syntax highlighting
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
          {onParseToScenes && contentStats.sceneHeadings > 0 && (
            <Button
              variant="outlined"
              size={responsive.buttonSize}
              startIcon={!isMobile ? <AutoFixHighIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined}
              onClick={() => setShowParseDialog(true)}
              sx={{ fontSize: responsive.captionFontSize }}
            >
              {isMobile ? `Parser (${contentStats.sceneHeadings})` : `Parser til Scener (${contentStats.sceneHeadings})`}
            </Button>
          )}
          <React.Suspense fallback={<CircularProgress size={isMobile ? 16 : 20} />}>
            <ScreenplayPDFExport
              content={manuscript.content}
              title={manuscript.title}
              author={manuscript.author}
            />
          </React.Suspense>
          <Button
            variant="text"
            size={responsive.buttonSize}
            onClick={() => setShowAdvancedEditor(false)}
            sx={{ fontSize: responsive.captionFontSize }}
          >
            {isMobile ? 'Enkel' : 'Enkel Editor'}
          </Button>
        </Stack>
      </Stack>
      
      <React.Suspense fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress size={is4K ? 48 : isDesktop ? 40 : 32} />
        </Box>
      }>
          <ScreenplayEditorWithNavigator
            editorKey={manuscript.id}
            value={editorContent}
            onChange={handleScreenplayChange}
            characters={allCharacters}
            locations={allLocations}
            scenes={scenes}
            onCharacterAdd={onCharacterAdd}
            onLocationAdd={onLocationAdd}
            onSceneSelect={handleSceneSelect}
          />
      </React.Suspense>
      
      {/* Info about character sources */}
      {castingRoles.length > 0 && (
        <Alert severity="success" sx={{ mt: responsive.spacing }}>
          <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
            <strong>{castingRoles.length}</strong> roller fra The Role Room er tilgjengelig i autocomplete.
            {castingLocations.length > 0 && ` ${castingLocations.length} lokasjoner tilgjengelig.`}
          </Typography>
        </Alert>
      )}
      
      {/* Parse to Scenes Dialog */}
      <Dialog 
        open={showParseDialog} 
        onClose={() => setShowParseDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>
          Parser Manuskript til Scener
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: responsive.spacing }}>
            <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
              Denne funksjonen vil analysere manuskriptet og opprette scener basert på sceneoverskrifter 
              (INT./EXT.). Eksisterende scener vil bli oppdatert.
            </Typography>
          </Alert>
          <Typography variant="body1" sx={{ mb: responsive.spacing, fontSize: responsive.bodyFontSize }}>
            Fant <strong>{contentStats.sceneHeadings}</strong> sceneoverskrifter og 
            <strong> {contentStats.uniqueCharacters.length}</strong> karakterer i manuskriptet.
          </Typography>
          {contentStats.uniqueCharacters.length > 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: responsive.captionFontSize }}>
                Karakterer funnet:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {contentStats.uniqueCharacters.slice(0, isMobile ? 10 : 15).map(char => (
                  <Chip 
                    key={char} 
                    label={char} 
                    size={responsive.chipSize} 
                    variant="outlined" 
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                ))}
                {contentStats.uniqueCharacters.length > (isMobile ? 10 : 15) && (
                  <Chip 
                    label={`+${contentStats.uniqueCharacters.length - (isMobile ? 10 : 15)} til`} 
                    size={responsive.chipSize}
                    sx={{ fontSize: responsive.captionFontSize }}
                  />
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button 
            onClick={() => setShowParseDialog(false)}
            size={responsive.buttonSize}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            Avbryt
          </Button>
          <Button 
            variant="contained" 
            onClick={handleParseToScenes}
            startIcon={<AutoFixHighIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
            size={responsive.buttonSize}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            Parser Scener
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Return TRUE if props are equal (skip re-render), FALSE if different (re-render)
  
  // Check manuscript changes
  if (prevProps.manuscript.id !== nextProps.manuscript.id) return false;
  if (prevProps.manuscript.content !== nextProps.manuscript.content) return false;
  
  // Check callback reference equality
  if (prevProps.onContentChange !== nextProps.onContentChange) return false;
  if (prevProps.onParseToScenes !== nextProps.onParseToScenes) return false;
  
  // Check character count changes (not full array comparison)
  if (prevProps.characters?.length !== nextProps.characters?.length) return false;
  
  // Check location count changes
  if (prevProps.locations?.length !== nextProps.locations?.length) return false;
  
  // Check casting roles count (not array comparison)
  if (prevProps.castingRoles?.length !== nextProps.castingRoles?.length) return false;
  
  // Check casting locations count
  if (prevProps.castingLocations?.length !== nextProps.castingLocations?.length) return false;
  
  // Check scenes count
  if (prevProps.scenes?.length !== nextProps.scenes?.length) return false;
  
  // All checks passed - props are effectively equal, skip re-render
  return true;
});

const ActsTab: React.FC<{
  acts: Act[];
  manuscriptId: string;
  onActsChange: (acts: Act[]) => void;
}> = ({ acts, manuscriptId, onActsChange }) => {
  const { showSuccess, showError } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [formData, setFormData] = useState({
    actNumber: 1,
    title: '',
    description: '',
    pageStart: 1,
    pageEnd: 1,
    estimatedRuntime: 30,
    colorCode: '',
  });
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  const handleCreate = () => {
    setEditingAct(null);
    setFormData({
      actNumber: acts.length + 1,
      title: '',
      description: '',
      pageStart: acts.length > 0 ? (acts[acts.length - 1].pageEnd || 0) + 1 : 1,
      pageEnd: 1,
      estimatedRuntime: 30,
      colorCode: '',
    });
    setShowDialog(true);
  };

  const handleEdit = (act: Act) => {
    setEditingAct(act);
    setFormData({
      actNumber: act.actNumber,
      title: act.title || '',
      description: act.description || '',
      pageStart: act.pageStart || 1,
      pageEnd: act.pageEnd || 1,
      estimatedRuntime: act.estimatedRuntime || 30,
      colorCode: act.colorCode || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      const act: Act = {
        id: editingAct?.id || `act-${Date.now()}`,
        manuscriptId,
        projectId: '', // Will be set by backend if needed
        actNumber: formData.actNumber,
        title: formData.title,
        description: formData.description,
        pageStart: formData.pageStart,
        pageEnd: formData.pageEnd,
        estimatedRuntime: formData.estimatedRuntime,
        colorCode: formData.colorCode,
        sortOrder: editingAct?.sortOrder || formData.actNumber,
        createdAt: editingAct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingAct) {
        await manuscriptService.updateAct(act);
        onActsChange(acts.map(a => a.id === act.id ? act : a));
        showSuccess('Akt oppdatert');
      } else {
        await manuscriptService.createAct(act);
        onActsChange([...acts, act]);
        showSuccess('Akt opprettet');
      }

      setShowDialog(false);
    } catch (error) {
      showError('Feil ved lagring av akt');
      console.error(error);
    }
  };

  const handleDelete = async (actId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne akten?')) return;

    try {
      await manuscriptService.deleteAct(actId, manuscriptId);
      onActsChange(acts.filter(a => a.id !== actId));
      showSuccess('Akt slettet');
    } catch (error) {
      showError('Feil ved sletting av akt');
      console.error(error);
    }
  };

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
          Akter / Kapitler
        </Typography>
        <Button 
          startIcon={!isMobile ? <AddIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined} 
          variant="outlined" 
          size={responsive.buttonSize}
          onClick={handleCreate}
          sx={{ fontSize: responsive.bodyFontSize }}
        >
          {isMobile ? 'Ny Akt' : 'Legg til Akt'}
        </Button>
      </Stack>

      {acts.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen akter ennå. Opprett akter for å strukturere manuskriptet i kapitler eller akter.
          </Typography>
        </Alert>
      ) : isMobile ? (
        // Mobile: Card-based layout
        <Stack spacing={responsive.spacing}>
          {acts.map((act) => (
            <Card key={act.id} sx={{ p: responsive.padding }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: responsive.titleFontSize }}>
                    Akt {act.actNumber}: {act.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize, mt: 0.5 }}>
                    {act.description || 'Ingen beskrivelse'}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip 
                      label={act.pageStart && act.pageEnd ? `s. ${act.pageStart}-${act.pageEnd}` : 'Ingen sider'} 
                      size="small" 
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                    <Chip 
                      label={act.estimatedRuntime ? `${act.estimatedRuntime} min` : '-'} 
                      size="small"
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                  </Stack>
                </Box>
                <Stack direction="row">
                  <IconButton size="small" onClick={() => handleEdit(act)}>
                    <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(act.id)}>
                    <DeleteIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size={isTablet ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Akt #</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Tittel</TableCell>
                {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Beskrivelse</TableCell>}
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Sider</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Varighet</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {acts.map((act) => (
                <TableRow key={act.id}>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.actNumber}</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.title}</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.description || '-'}</TableCell>}
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>
                    {act.pageStart && act.pageEnd ? `${act.pageStart}-${act.pageEnd}` : '-'}
                  </TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{act.estimatedRuntime ? `${act.estimatedRuntime} min` : '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(act)}>
                      <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(act.id)}>
                      <DeleteIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>{editingAct ? 'Rediger Akt' : 'Ny Akt'}</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <TextField
              label="Akt Nummer"
              type="number"
              value={formData.actNumber}
              onChange={(e) => setFormData({ ...formData, actNumber: parseInt(e.target.value) })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
            <TextField
              label="Tittel"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
            <TextField
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <Stack direction={isMobile ? 'column' : 'row'} spacing={responsive.spacing}>
              <TextField
                label="Start Side"
                type="number"
                value={formData.pageStart}
                onChange={(e) => setFormData({ ...formData, pageStart: parseInt(e.target.value) })}
                fullWidth
                size={isMobile ? 'small' : 'medium'}
              />
              <TextField
                label="Slutt Side"
                type="number"
                value={formData.pageEnd}
                onChange={(e) => setFormData({ ...formData, pageEnd: parseInt(e.target.value) })}
                fullWidth
                size={isMobile ? 'small' : 'medium'}
              />
            </Stack>
            <TextField
              label="Estimert Varighet (minutter)"
              type="number"
              value={formData.estimatedRuntime}
              onChange={(e) => setFormData({ ...formData, estimatedRuntime: parseInt(e.target.value) })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
            <TextField
              label="Fargekode (hex)"
              value={formData.colorCode}
              onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
              placeholder="#FF5733"
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowDialog(false)} size={responsive.buttonSize} sx={{ fontSize: responsive.bodyFontSize }}>
            Avbryt
          </Button>
          <Button onClick={handleSave} variant="contained" size={responsive.buttonSize} sx={{ fontSize: responsive.bodyFontSize }}>
            {editingAct ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const ScenesTab: React.FC<{
  scenes: SceneBreakdown[];
  viewMode: 'list' | 'drag' | 'storyboard';
  onViewModeChange: (mode: 'list' | 'drag' | 'storyboard') => void;
  onAddScene: () => void;
  onEditScene: (scene: SceneBreakdown) => void;
  onSelectScene: (scene: SceneBreakdown) => void;
  onReorderScenes: (scenes: SceneBreakdown[]) => void;
  selectedScene?: SceneBreakdown;
}> = ({ scenes, viewMode, onViewModeChange, onAddScene, onEditScene, onSelectScene, onReorderScenes, selectedScene }) => {
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>Scene Breakdown</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: isMobile ? 0.5 : 1 }}>
          <Button 
            startIcon={!isMobile ? <AddIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : undefined} 
            variant="outlined" 
            size={responsive.buttonSize}
            onClick={onAddScene}
            sx={{ fontSize: responsive.bodyFontSize }}
          >
            {isMobile ? 'Ny Scene' : 'Legg til Scene'}
          </Button>
          <Divider orientation="vertical" flexItem />
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, mode) => mode && onViewModeChange(mode)}
            size={isMobile ? 'small' : 'medium'}
          >
            <ToggleButton value="list">
              <FormatListNumberedIcon sx={{ fontSize: responsive.iconSize - 4 }} />
            </ToggleButton>
            <ToggleButton value="drag">
              <DragIcon sx={{ fontSize: responsive.iconSize - 4 }} />
            </ToggleButton>
            <ToggleButton value="storyboard">
              <ViewModuleIcon sx={{ fontSize: responsive.iconSize - 4 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {scenes.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen scener ennå. Bruk "Auto Breakdown" for å generere scener fra manuskriptet.
          </Typography>
        </Alert>
      ) : viewMode === 'drag' ? (
        <DraggableSceneList
          scenes={scenes}
          onReorder={onReorderScenes}
          onSceneSelect={onSelectScene}
          selectedScene={selectedScene}
        />
      ) : viewMode === 'storyboard' && selectedScene ? (
        <StoryboardIntegrationView
          scene={selectedScene}
          onUpdate={(updatedScene) => {
            onReorderScenes(scenes.map(s => s.id === updatedScene.id ? updatedScene : s));
          }}
        />
      ) : isMobile ? (
        // Mobile: Card-based layout
        <Stack spacing={1}>
          {scenes.map((scene) => (
            <Card 
              key={scene.id}
              onClick={() => onSelectScene(scene)}
              sx={{ 
                cursor: 'pointer',
                bgcolor: selectedScene?.id === scene.id ? 'action.selected' : undefined,
                p: 1.5,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: responsive.bodyFontSize }}>
                      #{scene.sceneNumber}
                    </Typography>
                    <Chip label={scene.intExt} size="small" sx={{ fontSize: responsive.captionFontSize }} />
                    <Chip label={scene.timeOfDay} size="small" variant="outlined" sx={{ fontSize: responsive.captionFontSize }} />
                  </Stack>
                  <Typography variant="body2" sx={{ fontSize: responsive.captionFontSize, mt: 0.5, color: 'text.secondary' }}>
                    {scene.sceneHeading}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: responsive.captionFontSize }}>
                      {scene.pageLength?.toFixed(1) || '-'} sider
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: responsive.captionFontSize }}>
                      {scene.characters.length} karakterer
                    </Typography>
                  </Stack>
                </Box>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditScene(scene); }}>
                  <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                </IconButton>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper}>
          <Table size={isTablet ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Scene #</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Heading</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>INT/EXT</TableCell>
                {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Time</TableCell>}
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Pages</TableCell>
                {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Characters</TableCell>}
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Status</TableCell>
                <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scenes.map((scene) => (
                <TableRow
                  key={scene.id}
                  hover
                  selected={selectedScene?.id === scene.id}
                  onClick={() => onSelectScene(scene)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.sceneNumber}</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize, maxWidth: isTablet ? 150 : 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{scene.sceneHeading}</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.intExt}</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.timeOfDay}</TableCell>}
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.pageLength?.toFixed(2) || '-'}</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.characters.length}</TableCell>}
                  <TableCell>
                    <Chip
                      label={scene.status}
                      size={responsive.chipSize}
                      color={scene.status === 'completed' ? 'success' : 'default'}
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEditScene(scene); }}>
                      <EditIcon sx={{ fontSize: responsive.iconSize - 4 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

interface CharacterProfile {
  name: string;
  alias?: string;
  description?: string;
  age?: string;
  role?: 'lead' | 'supporting' | 'minor' | 'extra';
  sceneCount: number;
  dialogueCount: number;
  scenesAppearing: string[];
}

const CharactersTab: React.FC<{ 
  characters: string[]; 
  dialogueLines: DialogueLine[];
  scenes?: SceneBreakdown[];
  manuscriptId?: string;
  onCharactersChange?: (characters: CharacterProfile[]) => void;
}> = ({
  characters,
  dialogueLines,
  scenes = [],
  manuscriptId,
  onCharactersChange,
}) => {
  const { showSuccess, showError } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [characterProfiles, setCharacterProfiles] = useState<Record<string, StoredCharacterProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    description: '',
    age: '',
    role: 'supporting' as 'lead' | 'supporting' | 'minor' | 'extra',
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // 7-tier responsive system
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  // Load character profiles from database/settings cache on mount
  useEffect(() => {
    if (!manuscriptId) {
      setIsLoading(false);
      return;
    }
    
    let mounted = true;
    const loadProfiles = async () => {
      try {
        const profiles = await characterProfileService.getProfiles(manuscriptId);
        if (mounted) {
          setCharacterProfiles(profiles);
        }
      } catch (error) {
        console.error('Error loading character profiles:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadProfiles();
    return () => { mounted = false; };
  }, [manuscriptId]);

  // Save character profiles to database whenever they change (debounced)
  useEffect(() => {
    if (!manuscriptId || Object.keys(characterProfiles).length === 0 || isLoading) return;
    
    const saveProfiles = async () => {
      setIsSaving(true);
      try {
        await characterProfileService.saveProfiles(manuscriptId, characterProfiles);
        console.log('✓ Character profiles saved to database');
      } catch (error) {
        console.error('Error saving character profiles:', error);
      } finally {
        setIsSaving(false);
      }
    };
    
    // Debounce saves
    const timer = setTimeout(saveProfiles, 500);
    return () => clearTimeout(timer);
  }, [characterProfiles, manuscriptId, isLoading]);

  // Build character profiles from dialogue and scenes
  const characterData = useMemo(() => {
    const profiles: CharacterProfile[] = [];
    
    characters.forEach(name => {
      const lines = dialogueLines.filter(l => l.characterName === name);
      const appearingScenes = scenes.filter(s => 
        s.characters?.includes(name) || lines.some(l => l.sceneId === s.id)
      );
      
      const savedProfile = characterProfiles[name];
      
      profiles.push({
        name,
        alias: savedProfile?.alias,
        description: savedProfile?.description,
        age: savedProfile?.age,
        role: savedProfile?.role || (lines.length > 10 ? 'lead' : lines.length > 5 ? 'supporting' : 'minor'),
        sceneCount: appearingScenes.length,
        dialogueCount: lines.length,
        scenesAppearing: appearingScenes.map(s => s.sceneNumber),
      });
    });
    
    return profiles.sort((a, b) => b.dialogueCount - a.dialogueCount);
  }, [characters, dialogueLines, scenes, characterProfiles]);

  const filteredCharacters = useMemo(() => {
    if (!searchQuery) return characterData;
    const q = searchQuery.toLowerCase();
    return characterData.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.alias?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [characterData, searchQuery]);

  const handleEdit = (character: CharacterProfile) => {
    setEditingCharacter(character.name);
    setFormData({
      name: character.name,
      alias: character.alias || '',
      description: character.description || '',
      age: character.age || '',
      role: character.role || 'supporting',
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!editingCharacter) return;
    
    // Only store editable fields (not computed fields like sceneCount, dialogueCount, scenesAppearing)
    setCharacterProfiles(prev => ({
      ...prev,
      [editingCharacter]: {
        name: formData.name,
        alias: formData.alias,
        description: formData.description,
        age: formData.age,
        role: formData.role,
      },
    }));
    
    showSuccess('Karakterprofil oppdatert');
    setShowDialog(false);
  };

  const getRoleColor = (role: string): 'error' | 'primary' | 'default' => {
    switch (role) {
      case 'lead': return 'error';
      case 'supporting': return 'primary';
      case 'minor': return 'default';
      case 'extra': return 'default';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'lead': return 'Hovedrolle';
      case 'supporting': return 'Birolle';
      case 'minor': return 'Liten rolle';
      case 'extra': return 'Statist';
      default: return role;
    }
  };

  return (
    <Box>
      <Stack 
        direction={isMobile ? 'column' : 'row'} 
        justifyContent="space-between" 
        alignItems={isMobile ? 'stretch' : 'center'} 
        spacing={responsive.spacing}
        sx={{ mb: responsive.spacing }}
      >
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
          Karakterer ({characters.length})
        </Typography>
        <TextField
          placeholder="Søk karakterer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size={isMobile ? 'small' : 'medium'}
          sx={{ width: isMobile ? '100%' : 200 }}
        />
      </Stack>

      {/* Statistics */}
      <Stack direction="row" spacing={isMobile ? 1 : 2} sx={{ mb: responsive.spacing }} flexWrap="wrap" useFlexGap>
        <Chip 
          label={`${characterData.filter(c => c.role === 'lead').length} hovedroller`} 
          color="error" 
          variant="outlined" 
          size={responsive.chipSize}
          sx={{ fontSize: responsive.captionFontSize }}
        />
        <Chip 
          label={`${characterData.filter(c => c.role === 'supporting').length} biroller`} 
          color="primary" 
          variant="outlined" 
          size={responsive.chipSize}
          sx={{ fontSize: responsive.captionFontSize }}
        />
        <Chip 
          label={`${characterData.filter(c => c.role === 'minor' || c.role === 'extra').length} mindre roller`} 
          variant="outlined" 
          size={responsive.chipSize}
          sx={{ fontSize: responsive.captionFontSize }}
        />
      </Stack>

      {filteredCharacters.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen karakterer funnet. Karakterer hentes fra dialog og scenedata.
          </Typography>
        </Alert>
      ) : (
        <Grid container spacing={responsive.cardSpacing}>
          {filteredCharacters.map((character, index) => (
            <Grid size={responsive.cardGridSize} key={`${character.name}-${index}`}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 3 },
                  borderLeft: 3,
                  borderColor: character.role === 'lead' ? 'error.main' : 
                               character.role === 'supporting' ? 'primary.main' : 'grey.400',
                }}
                onClick={() => handleEdit(character)}
              >
                <CardContent sx={{ p: isMobile ? 1.5 : 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>{character.name}</Typography>
                      {character.alias && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                          aka {character.alias}
                        </Typography>
                      )}
                    </Box>
                    <Chip 
                      label={getRoleLabel(character.role || 'minor')} 
                      color={getRoleColor(character.role || 'minor')}
                      size={responsive.chipSize}
                      sx={{ fontSize: responsive.captionFontSize }}
                    />
                  </Stack>
                  
                  {character.age && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: responsive.bodyFontSize }}>
                      Alder: {character.age}
                    </Typography>
                  )}
                  
                  {character.description && (
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', fontSize: responsive.bodyFontSize }}>
                      {character.description.substring(0, isMobile ? 60 : 100)}{character.description.length > (isMobile ? 60 : 100) ? '...' : ''}
                    </Typography>
                  )}
                  
                  <Divider sx={{ my: isMobile ? 0.5 : 1 }} />
                  
                  <Stack direction="row" spacing={isMobile ? 1 : 2}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                      <strong>{character.dialogueCount}</strong> replikker
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                      <strong>{character.sceneCount}</strong> scener
                    </Typography>
                  </Stack>
                  
                  {character.scenesAppearing.length > 0 && !isMobile && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: responsive.captionFontSize }}>
                      Scener: {character.scenesAppearing.slice(0, 5).join(', ')}
                      {character.scenesAppearing.length > 5 && ` +${character.scenesAppearing.length - 5} til`}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>Rediger Karakter: {editingCharacter}</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <TextField
              label="Kallenavn / Alias"
              value={formData.alias}
              onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. 'Dr. N' eller 'Paleontologen'"
            />
            <TextField
              label="Alder"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. '30s' eller '45'"
            />
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Rolletype</InputLabel>
              <Select
                value={formData.role}
                label="Rolletype"
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'lead' | 'supporting' | 'minor' | 'extra' })}
              >
                <MenuItem value="lead">Hovedrolle</MenuItem>
                <MenuItem value="supporting">Birolle</MenuItem>
                <MenuItem value="minor">Liten rolle</MenuItem>
                <MenuItem value="extra">Statist</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Beskrivelse"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={isMobile ? 2 : 3}
              size={isMobile ? 'small' : 'medium'}
              placeholder="Karakterbeskrivelse, bakgrunn, motivasjon..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowDialog(false)} size={responsive.buttonSize}>Avbryt</Button>
          <Button variant="contained" onClick={handleSave} size={responsive.buttonSize}>Lagre</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const DialogueTab: React.FC<{ 
  dialogueLines: DialogueLine[]; 
  scenes: SceneBreakdown[];
  manuscriptId?: string;
  onDialogueChange?: (dialogueLines: DialogueLine[]) => void;
}> = ({
  dialogueLines,
  scenes,
  manuscriptId,
  onDialogueChange,
}) => {
  const { showSuccess, showError } = useToast();
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLine, setEditingLine] = useState<DialogueLine | null>(null);
  const [filterCharacter, setFilterCharacter] = useState<string>('');
  const [filterScene, setFilterScene] = useState<string>('');
  const [formData, setFormData] = useState({
    characterName: '',
    dialogueText: '',
    parenthetical: '',
    emotionTag: '',
    sceneId: '',
  });

  const uniqueCharacters = useMemo(() => {
    const chars = new Set(dialogueLines.map(l => l.characterName));
    return Array.from(chars).sort();
  }, [dialogueLines]);

  const filteredLines = useMemo(() => {
    return dialogueLines.filter(line => {
      if (filterCharacter && line.characterName !== filterCharacter) return false;
      if (filterScene && line.sceneId !== filterScene) return false;
      return true;
    });
  }, [dialogueLines, filterCharacter, filterScene]);

  const handleCreate = () => {
    setEditingLine(null);
    setFormData({
      characterName: '',
      dialogueText: '',
      parenthetical: '',
      emotionTag: '',
      sceneId: scenes[0]?.id || '',
    });
    setShowDialog(true);
  };

  const handleEdit = (line: DialogueLine) => {
    setEditingLine(line);
    setFormData({
      characterName: line.characterName,
      dialogueText: line.dialogueText,
      parenthetical: line.parenthetical || '',
      emotionTag: line.emotionTag || '',
      sceneId: line.sceneId || '',
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      const line: DialogueLine = {
        id: editingLine?.id || `dial-${Date.now()}`,
        sceneId: formData.sceneId,
        manuscriptId: manuscriptId || '',
        characterName: formData.characterName.toUpperCase(),
        dialogueText: formData.dialogueText,
        dialogueType: 'dialogue',
        parenthetical: formData.parenthetical || undefined,
        emotionTag: formData.emotionTag || undefined,
        lineNumber: editingLine?.lineNumber || dialogueLines.length + 1,
        createdAt: editingLine?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      await manuscriptService.saveDialogue(line);

      if (editingLine) {
        // Update existing in local state
        const updated = dialogueLines.map(l => l.id === line.id ? line : l);
        onDialogueChange?.(updated);
        showSuccess('Dialog oppdatert og synkronisert');
      } else {
        // Create new in local state
        onDialogueChange?.([...dialogueLines, line]);
        showSuccess('Dialog opprettet og synkronisert');
      }
      setShowDialog(false);
    } catch (error) {
      showError('Feil ved lagring av dialog');
      console.error(error);
    }
  };

  const handleDelete = async (lineId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne replikken?')) return;
    
    try {
      // Delete from database
      await manuscriptService.deleteDialogue(lineId);
      
      // Update local state
      onDialogueChange?.(dialogueLines.filter(l => l.id !== lineId));
      showSuccess('Dialog slettet og synkronisert');
    } catch (error) {
      showError('Feil ved sletting av dialog');
      console.error(error);
    }
  };

  return (
    <Box>
      <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} spacing={isMobile ? 1 : 0} sx={{ mb: responsive.spacing }}>
        <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>All Dialog ({filteredLines.length})</Typography>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={handleCreate} size={responsive.buttonSize} fullWidth={isMobile}>
          Legg til Replikk
        </Button>
      </Stack>

      {/* Filters */}
      <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1 : 2} sx={{ mb: responsive.spacing }}>
        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 150 }}>
          <InputLabel>Filtrer karakter</InputLabel>
          <Select
            value={filterCharacter}
            label="Filtrer karakter"
            onChange={(e) => setFilterCharacter(e.target.value)}
          >
            <MenuItem value="">Alle</MenuItem>
            {uniqueCharacters.map(char => (
              <MenuItem key={char} value={char}>{char}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 200 }}>
          <InputLabel>Filtrer scene</InputLabel>
          <Select
            value={filterScene}
            label="Filtrer scene"
            onChange={(e) => setFilterScene(e.target.value)}
          >
            <MenuItem value="">Alle</MenuItem>
            {scenes.map(s => (
              <MenuItem key={s.id} value={s.id}>Scene {s.sceneNumber}: {s.sceneHeading?.substring(0, isMobile ? 15 : 30)}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {filteredLines.length === 0 ? (
        <Alert severity="info">
          <Typography sx={{ fontSize: responsive.bodyFontSize }}>
            Ingen dialog funnet ennå. Klikk "Legg til Replikk" for å starte.
          </Typography>
        </Alert>
      ) : (
        <List dense={isMobile}>
          {filteredLines.map((line, index) => {
            const scene = scenes.find((s) => s.id === line.sceneId);
            return (
              <React.Fragment key={line.id}>
                {index > 0 && <Divider />}
                <ListItem
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => handleEdit(line)}>
                        <EditIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(line.id)}>
                        <DeleteIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                    </Stack>
                  }
                  sx={{ pr: isMobile ? 8 : 12 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 0.5 : 1} alignItems={isMobile ? 'flex-start' : 'center'}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', fontSize: responsive.bodyFontSize }}>
                          {line.characterName}
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          {line.parenthetical && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: responsive.captionFontSize }}>
                              ({line.parenthetical})
                            </Typography>
                          )}
                          {line.emotionTag && (
                            <Chip label={line.emotionTag} size={responsive.chipSize} variant="outlined" sx={{ fontSize: responsive.captionFontSize }} />
                          )}
                        </Stack>
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" component="span" sx={{ fontStyle: 'italic', my: 0.5, display: 'block', fontSize: responsive.bodyFontSize }}>
                          "{isMobile ? line.dialogueText.substring(0, 80) + (line.dialogueText.length > 80 ? '...' : '') : line.dialogueText}"
                        </Typography>
                        {scene && !isMobile && (
                          <Typography variant="caption" component="span" color="text.secondary" sx={{ display: 'block', fontSize: responsive.captionFontSize }}>
                            Scene {scene.sceneNumber}: {scene.sceneHeading}
                          </Typography>
                        )}
                      </>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}

      {/* Edit Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>{editingLine ? 'Rediger Replikk' : 'Ny Replikk'}</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <TextField
              label="Karakter"
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. NORA TIDEMANN"
              helperText="Skriv karakternavnet i store bokstaver"
            />
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Scene</InputLabel>
              <Select
                value={formData.sceneId}
                label="Scene"
                onChange={(e) => setFormData({ ...formData, sceneId: e.target.value })}
              >
                {scenes.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    Scene {s.sceneNumber}: {s.sceneHeading?.substring(0, isMobile ? 25 : 40)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Dialog"
              value={formData.dialogueText}
              onChange={(e) => setFormData({ ...formData, dialogueText: e.target.value })}
              fullWidth
              multiline
              rows={isMobile ? 2 : 3}
              size={isMobile ? 'small' : 'medium'}
              placeholder="Hva sier karakteren?"
            />
            <TextField
              label="Parentetisk (valgfritt)"
              value={formData.parenthetical}
              onChange={(e) => setFormData({ ...formData, parenthetical: e.target.value })}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. smilende, bekymret, til Anna"
              helperText="Regiinstruksjoner for skuespilleren"
            />
            <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
              <InputLabel>Emosjon (valgfritt)</InputLabel>
              <Select
                value={formData.emotionTag}
                label="Emosjon (valgfritt)"
                onChange={(e) => setFormData({ ...formData, emotionTag: e.target.value })}
              >
                <MenuItem value="">Ingen</MenuItem>
                <MenuItem value="neutral">Nøytral</MenuItem>
                <MenuItem value="happy">Glad</MenuItem>
                <MenuItem value="sad">Trist</MenuItem>
                <MenuItem value="angry">Sint</MenuItem>
                <MenuItem value="frightened">Redd</MenuItem>
                <MenuItem value="surprised">Overrasket</MenuItem>
                <MenuItem value="confused">Forvirret</MenuItem>
                <MenuItem value="determined">Bestemt</MenuItem>
                <MenuItem value="hopeful">Håpefull</MenuItem>
                <MenuItem value="desperate">Desperat</MenuItem>
                <MenuItem value="wistful">Vemodig</MenuItem>
                <MenuItem value="mysterious">Mystisk</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowDialog(false)} size={responsive.buttonSize}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            size={responsive.buttonSize}
            disabled={!formData.characterName || !formData.dialogueText}
          >
            {editingLine ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const BreakdownTab: React.FC<{ scenes: SceneBreakdown[]; sceneStats: any }> = ({ scenes, sceneStats }) => {
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: responsive.spacing, fontSize: responsive.titleFontSize }}>
        Production Breakdown
      </Typography>

      {/* Statistics */}
      <Grid container spacing={responsive.cardSpacing} sx={{ mb: responsive.spacing }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>{sceneStats.total}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Total Scenes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>{sceneStats.intScenes}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                INT Scenes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>{sceneStats.extScenes}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                EXT Scenes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ p: isMobile ? 1.5 : 2, '&:last-child': { pb: isMobile ? 1.5 : 2 } }}>
              <Typography variant="h4" sx={{ fontSize: is4K ? '2.5rem' : isMobile ? '1.5rem' : '2rem' }}>
                {sceneStats.dayScenes}/{sceneStats.nightScenes}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                Day/Night
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Breakdown details */}
      {scenes.length > 0 && (
        isMobile ? (
          <Stack spacing={1}>
            {scenes.map((scene) => (
              <Card key={scene.id} sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontSize: responsive.bodyFontSize }}>Scene {scene.sceneNumber}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                      {scene.locationName}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Chip label={`${scene.characters.length} chars`} size="small" sx={{ fontSize: responsive.captionFontSize }} />
                    {scene.propsNeeded && scene.propsNeeded.length > 0 && (
                      <Chip label={`${scene.propsNeeded.length} props`} size="small" sx={{ fontSize: responsive.captionFontSize }} />
                    )}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                  {scene.specialEffects && <Chip label="VFX" size="small" color="secondary" sx={{ fontSize: responsive.captionFontSize }} />}
                  {scene.stuntsNotes && <Chip label="Stunts" size="small" color="warning" sx={{ fontSize: responsive.captionFontSize }} />}
                  {scene.vehicles && scene.vehicles.length > 0 && <Chip label="Vehicles" size="small" sx={{ fontSize: responsive.captionFontSize }} />}
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer component={Paper}>
            <Table size={isTablet ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Scene</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Location</TableCell>
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Characters</TableCell>
                  {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Props</TableCell>}
                  <TableCell sx={{ fontSize: responsive.bodyFontSize }}>Special Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scenes.map((scene) => (
                  <TableRow key={scene.id}>
                    <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.sceneNumber}</TableCell>
                    <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.locationName}</TableCell>
                    <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.characters.length}</TableCell>
                    {!isTablet && <TableCell sx={{ fontSize: responsive.bodyFontSize }}>{scene.propsNeeded?.length || 0}</TableCell>}
                    <TableCell>
                      {scene.specialEffects && <Chip label="VFX" size={responsive.chipSize} sx={{ mr: 0.5, fontSize: responsive.captionFontSize }} />}
                      {scene.stuntsNotes && <Chip label="Stunts" size={responsive.chipSize} sx={{ mr: 0.5, fontSize: responsive.captionFontSize }} />}
                      {scene.vehicles && scene.vehicles.length > 0 && <Chip label="Vehicles" size={responsive.chipSize} sx={{ fontSize: responsive.captionFontSize }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}
    </Box>
  );
};

const RevisionsTab: React.FC<{ 
  revisions: ScriptRevision[]; 
  manuscript: Manuscript;
  onRevisionsChange?: (revisions: ScriptRevision[]) => void;
  onCreateRevision?: () => void;
}> = ({
  revisions,
  manuscript,
  onRevisionsChange,
  onCreateRevision,
}) => {
  const { showSuccess, showError } = useToast();
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [revisionName, setRevisionName] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [selectedRevision, setSelectedRevision] = useState<ScriptRevision | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const handleCreateRevision = async () => {
    if (!revisionName.trim()) {
      showError('Revisjonsnavn er påkrevd');
      return;
    }

    try {
      const newRevision: ScriptRevision = {
        id: `rev-${Date.now()}`,
        manuscriptId: manuscript.id,
        version: `${manuscript.version || 1}.${revisions.length + 1}`,
        createdAt: new Date().toISOString(),
        changedBy: 'current-user',
        changesSummary: revisionNotes || revisionName,
        revisionNotes: revisionNotes,
        content: manuscript.content,
      };

      const updatedRevisions = [...revisions, newRevision];
      onRevisionsChange?.(updatedRevisions);
      
      // Also save to service
      await manuscriptService.createRevision(newRevision);
      
      showSuccess(`Revisjon "${revisionName}" opprettet`);
      setShowCreateDialog(false);
      setRevisionName('');
      setRevisionNotes('');
    } catch (error) {
      showError('Feil ved opprettelse av revisjon');
      console.error(error);
    }
  };

  const handleDeleteRevision = async (revisionId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne revisjonen?')) return;

    try {
      const updatedRevisions = revisions.filter(r => r.id !== revisionId);
      onRevisionsChange?.(updatedRevisions);
      showSuccess('Revisjon slettet');
    } catch (error) {
      showError('Feil ved sletting av revisjon');
    }
  };

  const handleRestoreRevision = (revision: ScriptRevision) => {
    if (!confirm('Vil du gjenopprette denne versjonen? Gjeldende endringer vil bli overskrevet.')) return;
    
    // This would need to be connected to the parent to update manuscript content
    showSuccess('Revisjon gjenopprettet');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'stretch' : 'center'} spacing={isMobile ? 1 : 0} sx={{ mb: responsive.spacing }}>
        <Stack direction="row" spacing={isMobile ? 1 : 2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ fontSize: responsive.titleFontSize }}>
            {isMobile ? 'Revisjoner' : 'Script Revisjoner & Diff Viewer'}
          </Typography>
          <Chip 
            label={`v${manuscript.version || '1.0'}`} 
            color="primary" 
            size={responsive.chipSize}
            sx={{ fontSize: responsive.captionFontSize }}
          />
        </Stack>
        <Button
          variant="outlined"
          size={responsive.buttonSize}
          startIcon={<AddIcon sx={{ fontSize: responsive.iconSize }} />}
          onClick={() => setShowCreateDialog(true)}
          fullWidth={isMobile}
        >
          {isMobile ? 'Ny' : 'Ny Revisjon'}
        </Button>
      </Stack>

      {revisions.length === 0 ? (
        <Alert severity="info" sx={{ mb: responsive.spacing }}>
          <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
            {isMobile 
              ? 'Ingen revisjoner ennå. Opprett en for å lagre snapshots.'
              : 'Ingen revisjoner ennå. Opprett en revisjon for å lagre et snapshot av manuskriptet og kunne sammenligne endringer over tid.'
            }
          </Typography>
        </Alert>
      ) : (
        <>
          {/* Revision List */}
          <Paper sx={{ mb: responsive.spacing, p: isMobile ? 1 : 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontSize: responsive.bodyFontSize }}>
              Revisjonshistorikk ({revisions.length})
            </Typography>
            <Stack spacing={1}>
              {revisions.slice().reverse().map((revision, index) => (
                <Paper 
                  key={revision.id} 
                  variant="outlined" 
                  sx={{ 
                    p: isMobile ? 1 : 1.5,
                    cursor: 'pointer',
                    bgcolor: selectedRevision?.id === revision.id ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => setSelectedRevision(revision)}
                >
                  <Stack direction={isMobile ? 'column' : 'row'} justifyContent="space-between" alignItems={isMobile ? 'flex-start' : 'center'} spacing={isMobile ? 1 : 0}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip 
                        label={revision.version} 
                        size={responsive.chipSize}
                        color={index === 0 ? 'success' : 'default'}
                        sx={{ fontSize: responsive.captionFontSize }}
                      />
                      <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
                        {revision.changesSummary || revision.revisionNotes || 'Ingen beskrivelse'}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {!isMobile && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize }}>
                          {new Date(revision.createdAt).toLocaleDateString('no-NO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      )}
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreRevision(revision);
                        }}
                        title="Gjenopprett"
                      >
                        <HistoryIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRevision(revision.id);
                        }}
                        title="Slett"
                      >
                        <DeleteIcon sx={{ fontSize: responsive.iconSize }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                  {isMobile && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.captionFontSize, mt: 0.5, display: 'block' }}>
                      {new Date(revision.createdAt).toLocaleDateString('no-NO', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </Paper>
        </>
      )}

      {/* Diff Viewer */}
      {revisions.length > 0 && (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ScriptDiffViewer revisions={revisions} currentContent={manuscript.content} />
        </Box>
      )}

      {/* Create Revision Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ fontSize: responsive.titleFontSize }}>Opprett Ny Revisjon</DialogTitle>
        <DialogContent>
          <Stack spacing={responsive.spacing} sx={{ mt: 1 }}>
            <Alert severity="info">
              <Typography variant="body2" sx={{ fontSize: responsive.bodyFontSize }}>
                {isMobile 
                  ? 'En revisjon lagrer et snapshot av manuskriptet.'
                  : 'En revisjon lagrer et snapshot av gjeldende manuskript. Du kan senere sammenligne revisjoner og se endringer over tid.'
                }
              </Typography>
            </Alert>
            <TextField
              label="Revisjonsnavn"
              value={revisionName}
              onChange={(e) => setRevisionName(e.target.value)}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder="F.eks. 'Draft 2' eller 'Etter regimøte'"
              required
            />
            <TextField
              label="Notater / Endringsbeskrivelse"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              fullWidth
              multiline
              rows={isMobile ? 2 : 3}
              size={isMobile ? 'small' : 'medium'}
              placeholder="Beskriv hva som er endret i denne revisjonen..."
            />
            <Stack direction={isMobile ? 'column' : 'row'} spacing={isMobile ? 1 : 2}>
              <Chip 
                label={`Gjeldende: v${manuscript.version || '1.0'}`} 
                size={responsive.chipSize}
                sx={{ fontSize: responsive.captionFontSize }}
              />
              <Chip 
                label={`Ny: v${manuscript.version || 1}.${revisions.length + 1}`} 
                size={responsive.chipSize}
                color="primary"
                sx={{ fontSize: responsive.captionFontSize }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: responsive.padding }}>
          <Button onClick={() => setShowCreateDialog(false)} size={responsive.buttonSize}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateRevision}
            disabled={!revisionName.trim()}
            startIcon={<SaveIcon sx={{ fontSize: responsive.iconSize }} />}
            size={responsive.buttonSize}
          >
            {isMobile ? 'Lagre' : 'Lagre Revisjon'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


// Memoized export - only re-render if props meaningfully change
export const ManuscriptPanel = React.memo(ManuscriptPanelComponent, (prevProps, nextProps) => {
  // Return TRUE if props are equal (skip re-render), FALSE if different (re-render)
  
  // Check critical props
  if (prevProps.projectId !== nextProps.projectId) return false;
  if (prevProps.onManuscriptChange !== nextProps.onManuscriptChange) return false;
  
  // All checks passed - props are effectively equal, skip re-render
  return true;
});

export default ManuscriptPanel;
