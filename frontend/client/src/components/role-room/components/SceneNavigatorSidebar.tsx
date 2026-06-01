// @ts-nocheck
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
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  BarChart as StatsIcon,
  Person as PersonIcon,
  KeyboardArrowUp as MoveUpIcon,
  KeyboardArrowDown as MoveDownIcon,
} from '@mui/icons-material';
import type { SceneBreakdown } from '../models/casting';

// Scene parsed from Fountain content
export interface ParsedScene {
  id: string;
  sceneNumber: string;
  heading: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | null;
  location: string;
  timeOfDay: string | null;
  lineNumber: number;
  pageEstimate: number;    // Rough estimate based on lines
  characterCount: number;  // Unique character names found in scene
  characters: string[];    // Actual character names (for stats)
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

  // Reorder: flytt en scene i den globale (Fountain-tekst) rekkefølgen.
  // Aktiveres kun for Fountain-baserte scener (ikke DB-scener), siden teksten
  // er source-of-truth. fromIndex/toIndex er indekser i den globale scene-lista.
  onReorderScenes?: (fromIndex: number, toIndex: number) => void;
}

// ── Stable scene identity ─────────────────────────────────────────────────
// Hash the heading text + per-heading OCCURRENCE ordinal (ikke global posisjon).
// Slik forblir id-en stabil når scener flyttes (reorder): en gitt heading
// beholder samme id uavhengig av rekkefølge. Dupliserte headinger
// disambigueres med 0,1,2… i den rekkefølgen de dukker opp.
function stableSceneId(heading: string, occurrence: number): string {
  let h = 5381;
  for (let i = 0; i < heading.length; i++) {
    h = (((h << 5) + h) ^ heading.charCodeAt(i)) >>> 0;
  }
  return `s_${h.toString(36)}_${occurrence}`;
}

// Character line pattern (all-caps names, possibly with extension)
const CHAR_LINE_RE = /^[A-ZÆØÅ][A-ZÆØÅ0-9 \-'.]{1,}(\s*\(.*\))?$/;

// Parse Fountain content to extract scenes with stable IDs + character lists
function parseScenes(content: string): ParsedScene[] {
  if (!content) return [];

  const lines = content.split('\n');
  const scenes: ParsedScene[] = [];
  const SCENE_HEADING_PATTERN = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;

  let sceneStartLine = 0;
  let sceneChars = new Set<string>();
  // Teller hvor mange ganger hver heading har dukket opp, for stabil id.
  const headingOccurrences = new Map<string, number>();

  // Write back accumulated stats into the last pushed scene
  const flushCurrent = (upToLine: number) => {
    if (!scenes.length) return;
    const last = scenes[scenes.length - 1];
    const charArr = Array.from(sceneChars);
    scenes[scenes.length - 1] = {
      ...last,
      pageEstimate: Math.max(1, Math.ceil((upToLine - sceneStartLine) / 55)),
      characterCount: sceneChars.size,
      characters: charArr,
    };
  };

  for (let i = 0; i < lines.length; i++) {
    const raw  = lines[i];
    const line = raw.trim();
    const match = line.match(SCENE_HEADING_PATTERN);

    if (match) {
      flushCurrent(i);
      sceneStartLine = i;
      sceneChars = new Set<string>();

      const intExt    = match[3]?.toUpperCase() as 'INT' | 'EXT' | 'INT/EXT' | 'I/E' | null;
      const location  = match[4]?.trim() || '';
      const timeOfDay = match[5] || null;
      const heading   = line.replace(/^\./, '');
      const headingKey = heading.trim().toUpperCase().replace(/\s+/g, ' ');
      const occurrence = headingOccurrences.get(headingKey) ?? 0;
      headingOccurrences.set(headingKey, occurrence + 1);

      scenes.push({
        id: stableSceneId(heading, occurrence),
        sceneNumber: `${scenes.length + 1}`,
        heading,
        intExt,
        location,
        timeOfDay,
        lineNumber: i + 1,
        pageEstimate: 1,   // updated by flushCurrent
        characterCount: 0,
        characters: [],
      });
    } else if (scenes.length > 0 && CHAR_LINE_RE.test(line) && line.length > 1) {
      // Collect unique character names appearing in this scene
      const name = line.replace(/\s*\(.*\)\s*$/, '').trim();
      if (name) sceneChars.add(name);
    }
  }

  flushCurrent(lines.length); // flush the final scene
  return scenes;
}

// Scene-heading-pattern (delt med parseScenes) for å finne scene-grenser.
const SCENE_HEADING_LINE_RE = /^(\.)?((INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]+)(.+?)(?:\s*-\s*(DAY|NIGHT|DAWN|DUSK|CONTINUOUS|LATER|MORNING|EVENING|SAME))?$/i;

/**
 * Flytter en scene-blokk i Fountain-teksten (Fountain er source-of-truth).
 * En scene-blokk er alle linjer fra scene-overskriften til (men ikke med) neste
 * scene-overskrift. Eventuell preamble (tittel-side e.l.) før første scene
 * beholdes på toppen. Ren funksjon — testbar og uten side-effekter.
 *
 * @returns ny content-streng, eller uendret content hvis indeksene er ugyldige.
 */
export function reorderScenesInContent(
  content: string,
  fromIndex: number,
  toIndex: number,
): string {
  return reorderScenesWithLineMap(content, fromIndex, toIndex).content;
}

/**
 * Scene-ankre fra Fountain-tekst: stabil sceneId + 1-basert start/slutt-linje.
 * Brukes til å forankre kommentarer RELATIVT til en scene (sceneId + offset) i
 * stedet for et absolutt linjenummer — slik følger kommentarer innholdet når
 * man skriver over dem eller flytter scener. Bruker samme stabile id-skjema
 * som navigatoren (heading-hash + forekomst-ordinal). Ren funksjon.
 */
export function parseSceneAnchors(
  content: string,
): Array<{ sceneId: string; startLine: number; endLine: number }> {
  if (!content) return [];
  const lines = content.split('\n');
  const occ = new Map<string, number>();
  const heads: Array<{ sceneId: string; startLine: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (SCENE_HEADING_LINE_RE.test(line)) {
      const heading = line.replace(/^\./, '');
      const key = heading.trim().toUpperCase().replace(/\s+/g, ' ');
      const o = occ.get(key) ?? 0;
      occ.set(key, o + 1);
      heads.push({ sceneId: stableSceneId(heading, o), startLine: i + 1 });
    }
  }
  return heads.map((h, idx) => ({
    sceneId: h.sceneId,
    startLine: h.startLine,
    endLine: idx + 1 < heads.length ? heads[idx + 1].startLine : lines.length + 1,
  }));
}

/**
 * Bygger et scene-relativt kommentar-anker for en absolutt linje, eller et
 * absolutt fallback-anker (`#L:<linje>`) for linjer før første scene (preamble).
 */
export function buildLineCommentAnchor(content: string, manuscriptId: string, line: number): string {
  const scenes = parseSceneAnchors(content);
  const scene = scenes.find((s) => line >= s.startLine && line < s.endLine);
  if (scene) {
    return `${manuscriptId}#s:${scene.sceneId}:${line - scene.startLine}`;
  }
  return `${manuscriptId}#L:${line}`;
}

/**
 * Løser et kommentar-anker tilbake til gjeldende absolutt linje. Returnerer null
 * hvis scenen er slettet (foreldreløst anker). Bakoverkompatibel med gamle
 * absolutte ankre på formen `<manusId>#<tall>`.
 */
export function resolveLineCommentAnchor(content: string, manuscriptId: string, anchorRef: string): number | null {
  const prefix = `${manuscriptId}#`;
  if (!anchorRef.startsWith(prefix)) return null;
  const rest = anchorRef.slice(prefix.length);
  if (rest.startsWith('s:')) {
    const m = rest.match(/^s:(.+):(\d+)$/);
    if (!m) return null;
    const sceneId = m[1];
    const offset = parseInt(m[2], 10);
    const scene = parseSceneAnchors(content).find((s) => s.sceneId === sceneId);
    if (!scene) return null; // scene slettet → foreldreløst
    return scene.startLine + offset;
  }
  // Legacy / preamble absolutt-anker: `#L:<n>` eller `#<n>`
  const n = parseInt(rest.replace(/^L:/, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Som reorderScenesInContent, men returnerer OGSÅ en linje-mapping (1-basert
 * gammel linje → ny linje). Brukes til å re-mappe linje-ankrede kommentarer så
 * de ikke peker på feil linje etter at en scene flyttes. Ren funksjon.
 */
export function reorderScenesWithLineMap(
  content: string,
  fromIndex: number,
  toIndex: number,
): { content: string; mapLine: (oldLine: number) => number } {
  const identity = (l: number) => l;
  if (!content || fromIndex === toIndex) return { content, mapLine: identity };
  const lines = content.split('\n');

  // Finn start-linje (0-basert) for hver scene-overskrift.
  const sceneStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (SCENE_HEADING_LINE_RE.test(lines[i].trim())) {
      sceneStarts.push(i);
    }
  }
  if (
    sceneStarts.length < 2 ||
    fromIndex < 0 || toIndex < 0 ||
    fromIndex >= sceneStarts.length || toIndex >= sceneStarts.length
  ) {
    return { content, mapLine: identity };
  }

  const preambleLen = sceneStarts[0];
  const blockMeta = sceneStarts.map((start, idx) => ({
    start,
    len: (idx + 1 < sceneStarts.length ? sceneStarts[idx + 1] : lines.length) - start,
  }));

  // Ny rekkefølge av originale block-indekser.
  const order = blockMeta.map((_, i) => i);
  const [movedIdx] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, movedIdx);

  // Ny 0-basert start for hver original block.
  const newStartByOrig = new Map<number, number>();
  let cursor = preambleLen;
  for (const origIdx of order) {
    newStartByOrig.set(origIdx, cursor);
    cursor += blockMeta[origIdx].len;
  }

  const blocks = blockMeta.map((b) => lines.slice(b.start, b.start + b.len));
  const reordered = order.map((i) => blocks[i]);
  const newContent = [...lines.slice(0, preambleLen), ...reordered.flat()].join('\n');

  const mapLine = (oldLine: number): number => {
    const idx0 = oldLine - 1;
    if (idx0 < preambleLen) return oldLine; // preamble flyttes ikke
    for (let b = 0; b < blockMeta.length; b++) {
      const { start, len } = blockMeta[b];
      if (idx0 >= start && idx0 < start + len) {
        const offset = idx0 - start;
        const newStart = newStartByOrig.get(b) ?? start;
        return newStart + offset + 1;
      }
    }
    return oldLine;
  };

  return { content: newContent, mapLine };
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
    lineNumber: index * 20 + 1,
    pageEstimate: scene.pageLength || 1,
    characterCount: scene.characters?.length || 0,
    characters: [],  // DB scenes carry their own character data elsewhere
  }));
}

// ── SceneRow sub-component ─────────────────────────────────────────────────
interface SceneRowProps {
  scene: ParsedScene;
  isCurrent: boolean;
  intExtColor: string;
  accentColor: string;
  textColor: string;
  isPinned: boolean;
  onPin: (id: string, e: React.MouseEvent) => void;
  onClick: (scene: ParsedScene) => void;
  // Reorder (kun aktivt for Fountain-baserte scener — tekst er source-of-truth)
  index?: number;
  total?: number;
  onMove?: (index: number, direction: -1 | 1) => void;
}

const SceneRow: React.FC<SceneRowProps> = React.memo((
  { scene, isCurrent, intExtColor, accentColor, textColor, isPinned, onPin, onClick, index, total, onMove }
) => (
  <ListItemButton
    id={`scene-nav-${scene.id}`}
    onClick={() => onClick(scene)}
    selected={isCurrent}
    aria-label={`Scene ${scene.sceneNumber}: ${scene.intExt ? scene.intExt + '. ' : ''}${scene.location}${scene.timeOfDay ? ', ' + scene.timeOfDay : ''}${isCurrent ? ' (gjeldende scene)' : ''}`}
    aria-current={isCurrent ? 'step' : undefined}
    sx={{
      py: 0.5,
      pl: 2,
      pr: 0.75,
      borderLeft: isCurrent ? `3px solid ${accentColor}` : `3px solid ${isPinned ? alpha('#f59e0b', 0.5) : 'transparent'}`,
      bgcolor: isCurrent ? alpha(accentColor, 0.15) : 'transparent',
      '&:hover': { bgcolor: alpha(accentColor, 0.1) },
      '&.Mui-selected': { bgcolor: alpha(accentColor, 0.15) },
      '&:focus-visible': {
        outline: `2px solid ${accentColor}`,
        outlineOffset: '-2px',
        borderRadius: '4px',
      },
    }}
  >
    {/* Scene number badge */}
    <Box
      sx={{
        minWidth: 28, height: 22, borderRadius: '4px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: alpha(intExtColor, 0.15), border: `1px solid ${alpha(intExtColor, 0.4)}`, mr: 1,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: intExtColor }}>
        {scene.sceneNumber}
      </Typography>
    </Box>

    {/* Location + time-of-day */}
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <Typography
        variant="body2"
        sx={{ fontSize: '0.75rem', fontWeight: isCurrent ? 600 : 400, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {scene.intExt ? `${scene.intExt}. ` : ''}{scene.location}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.2 }}>
        {scene.timeOfDay && (
          <Chip
            size="small" label={scene.timeOfDay}
            icon={scene.timeOfDay.includes('NIGHT') ? <NightIcon sx={{ fontSize: 10 }} /> : <DayIcon sx={{ fontSize: 10 }} />}
            sx={{ height: 15, fontSize: '0.6rem', '& .MuiChip-icon': { fontSize: 10 }, bgcolor: 'transparent', border: '1px solid', borderColor: alpha(textColor, 0.2) }}
          />
        )}
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
          L{scene.lineNumber}{scene.characters.length > 0 ? ` · ${scene.characters.length} kar.` : ''}
        </Typography>
      </Stack>
    </Box>

    {/* Flytt scene opp/ned (Fountain-tekst er source-of-truth) */}
    {onMove && typeof index === 'number' && (
      <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0, mr: 0.25 }}>
        <IconButton
          size="small"
          disabled={index <= 0}
          onClick={(e) => { e.stopPropagation(); onMove(index, -1); }}
          aria-label={`Flytt scene ${scene.sceneNumber} opp`}
          sx={{ p: 0, height: 16, opacity: 0.4, '&:hover': { opacity: 1 }, '&.Mui-disabled': { opacity: 0.12 } }}
        >
          <MoveUpIcon sx={{ fontSize: 15 }} />
        </IconButton>
        <IconButton
          size="small"
          disabled={typeof total === 'number' && index >= total - 1}
          onClick={(e) => { e.stopPropagation(); onMove(index, 1); }}
          aria-label={`Flytt scene ${scene.sceneNumber} ned`}
          sx={{ p: 0, height: 16, opacity: 0.4, '&:hover': { opacity: 1 }, '&.Mui-disabled': { opacity: 0.12 } }}
        >
          <MoveDownIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
    )}

    {/* Pin toggle */}
    <IconButton
      size="small"
      onClick={(e) => onPin(scene.id, e)}
      aria-label={isPinned ? `Fjern festet: scene ${scene.sceneNumber}` : `Fest scene ${scene.sceneNumber}`}
      aria-pressed={isPinned}
      sx={{
        p: 0.3,
        opacity: isPinned ? 1 : 0.25,
        '&:hover': { opacity: 1 },
        '&:focus-visible': { opacity: 1, outline: '2px solid #f59e0b', outlineOffset: '1px', borderRadius: '3px' },
        flexShrink: 0,
      }}
    >
      {isPinned
        ? <PushPinIcon sx={{ fontSize: 13, color: '#f59e0b' }} />
        : <PushPinOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />}
    </IconButton>
  </ListItemButton>
));
SceneRow.displayName = 'SceneRow';

export const SceneNavigatorSidebar: React.FC<SceneNavigatorSidebarProps> = ({
  content,
  scenes: dbScenes,
  currentLine = 1,
  onSceneSelect,
  collapsed = false,
  onToggleCollapse,
  width = 280,
  collapsedWidth = 48,
  onReorderScenes,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set(['1', '2', '3', 'pinned']));
  const [showFilters, setShowFilters] = useState(false);
  const [filterIntExt, setFilterIntExt] = useState<'all' | 'INT' | 'EXT'>('all');
  // Pin state — persisted in a Set of stable scene IDs
  const [pinnedSceneIds, setPinnedSceneIds] = useState<Set<string>>(new Set());
  // Toggle between scene list and pro stats panel
  const [activeView, setActiveView] = useState<'scenes' | 'stats'>('scenes');

  // Parse scenes from content or use database scenes
  const parsedScenes = useMemo(() => {
    if (dbScenes && dbScenes.length > 0) {
      return convertDbScenes(dbScenes);
    }
    return parseScenes(content || '');
  }, [content, dbScenes]);

  // Reorder kun for Fountain-baserte scener (tekst er source-of-truth) — ikke
  // for DB-scener (de reorderes i produksjonsvisningen).
  const reorderEnabled = Boolean(onReorderScenes) && !(dbScenes && dbScenes.length > 0);
  const handleMoveScene = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (index < 0 || target < 0) return;
    onReorderScenes?.(index, target);
  }, [onReorderScenes]);

  // ── Pro statistics ───────────────────────────────────────────────────────
  const locationStats = useMemo(() => {
    const map = new Map<string, { count: number; pages: number }>();
    parsedScenes.forEach(s => {
      const key = s.location || 'Ukjent';
      const prev = map.get(key) ?? { count: 0, pages: 0 };
      map.set(key, { count: prev.count + 1, pages: prev.pages + s.pageEstimate });
    });
    return Array.from(map.entries())
      .map(([location, v]) => ({ location, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [parsedScenes]);

  const characterStats = useMemo(() => {
    const map = new Map<string, number>();
    parsedScenes.forEach(s =>
      s.characters.forEach(c => map.set(c, (map.get(c) ?? 0) + 1)),
    );
    return Array.from(map.entries())
      .map(([name, sceneCount]) => ({ name, sceneCount }))
      .sort((a, b) => b.sceneCount - a.sceneCount);
  }, [parsedScenes]);

  const pageDayNightStats = useMemo(() => {
    const nightWords = ['NIGHT', 'DAWN', 'DUSK'];
    const isNight = (s: ParsedScene) =>
      !!s.timeOfDay && nightWords.some(w => s.timeOfDay!.includes(w));
    return parsedScenes.reduce(
      (acc, s) => {
        const pages = s.pageEstimate;
        if (isNight(s)) return { ...acc, night: acc.night + pages };
        if (s.timeOfDay)  return { ...acc, day:   acc.day   + pages };
        return acc;
      },
      { day: 0, night: 0 },
    );
  }, [parsedScenes]);

  // Filter scenes based on search and filters
  const filteredScenes = useMemo(() => {
    return parsedScenes.filter(scene => {
      // Search: heading, location, scene number, or any character name
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const inHeading   = scene.heading.toLowerCase().includes(query);
        const inLocation  = scene.location.toLowerCase().includes(query);
        const inNumber    = scene.sceneNumber.includes(query);
        const inChars     = scene.characters.some(c => c.toLowerCase().includes(query));
        if (!inHeading && !inLocation && !inNumber && !inChars) {
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
      const dbScene = dbScenes?.find(s => s.id === scene.id);
      onSceneSelect(dbScene || scene, scene.lineNumber);
    }
  }, [onSceneSelect, dbScenes]);

  // Jump to previous / next scene relative to the current cursor position
  const handleJumpScene = useCallback((dir: 'prev' | 'next') => {
    const target = dir === 'prev' ? currentSceneIndex - 1 : currentSceneIndex + 1;
    if (target >= 0 && target < parsedScenes.length) {
      handleSceneClick(parsedScenes[target]);
    }
  }, [currentSceneIndex, parsedScenes, handleSceneClick]);

  // Toggle pin state for a scene (stable across re-parses because IDs are stable)
  const handlePinToggle = useCallback((sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSceneIds(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  }, []);

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
  const bgColor = '#1a1a2e';
  const textColor = '#e0e0e0';
  const accentColor = '#a78bfa';
  const intColor = '#60a5fa';
  const extColor = '#34d399';

  if (collapsed) {
    return (
      <Paper
        component="nav"
        aria-label="Scene Navigator (sammenslått)"
        sx={{
          width: collapsedWidth,
          height: '100%',
          bgcolor: bgColor,
          borderRight: `1px solid ${alpha(accentColor, 0.2)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 1,
          '& :focus-visible': {
            outline: `2px solid ${accentColor}`,
            outlineOffset: '2px',
            borderRadius: '3px',
          },
        }}
      >
        <Tooltip title="Utvid Scene Navigator" placement="right">
          <IconButton
            size="small"
            onClick={onToggleCollapse}
            aria-label="Utvid Scene Navigator"
            aria-expanded={false}
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
                component="button"
                onClick={() => handleSceneClick(scene)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSceneClick(scene);
                  }
                }}
                aria-label={`Gå til scene ${scene.sceneNumber}: ${scene.heading}`}
                aria-current={currentSceneIndex === i ? 'step' : undefined}
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
                  background: 'none',
                  p: 0,
                  '&:hover': { bgcolor: alpha(accentColor, 0.2) },
                  '&:focus-visible': {
                    outline: `2px solid ${accentColor}`,
                    outlineOffset: '2px',
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
      component="nav"
      aria-label="Scene Navigator"
      sx={{
        width,
        height: '100%',
        bgcolor: bgColor,
        borderRight: `1px solid ${alpha(accentColor, 0.2)}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Global focus ring for all keyboard-interactive elements inside the navigator
        '& :focus-visible': {
          outline: `2px solid ${accentColor}`,
          outlineOffset: '2px',
          borderRadius: '3px',
        },
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
        
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Filtrer">
            <IconButton size="small" onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon sx={{ fontSize: 16, color: showFilters ? accentColor : textColor }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Forrige scene">
            <span>
              <IconButton
                size="small"
                onClick={() => handleJumpScene('prev')}
                disabled={currentSceneIndex <= 0}
              >
                <PrevIcon sx={{ fontSize: 16, color: currentSceneIndex > 0 ? textColor : 'text.disabled' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Neste scene">
            <span>
              <IconButton
                size="small"
                onClick={() => handleJumpScene('next')}
                disabled={currentSceneIndex >= parsedScenes.length - 1}
              >
                <NextIcon sx={{ fontSize: 16, color: currentSceneIndex < parsedScenes.length - 1 ? textColor : 'text.disabled' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={activeView === 'stats' ? 'Vis scene-liste' : 'Statistikk (pro)'}>
            <IconButton size="small" onClick={() => setActiveView(v => v === 'stats' ? 'scenes' : 'stats')}>
              <StatsIcon sx={{ fontSize: 16, color: activeView === 'stats' ? accentColor : textColor }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Skjul sidebar">
            <IconButton size="small" onClick={onToggleCollapse}>
              <ChevronLeft sx={{ fontSize: 16, color: textColor }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Search — always visible */}
      <Box sx={{ px: 1, pt: 1, pb: 0.5, borderBottom: `1px solid ${alpha(accentColor, 0.1)}` }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Søk lokasjon, scene, karakter…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          inputProps={{ 'aria-label': 'Søk i scener etter lokasjon, scene-nummer eller karakter' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} aria-hidden="true" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')} aria-label="Fjern søketekst">
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ),
            // Don't override the outline in sx here — the global focus-visible rule covers it
            sx: {
              bgcolor: alpha('#fff', 0.05),
              fontSize: '0.75rem',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(accentColor, 0.2) },
            },
          }}
        />
      </Box>

      {/* INT/EXT filter chips — collapsed behind filter toggle */}
      <Collapse in={showFilters} id="scene-filter-panel">
        <Box
          role="group"
          aria-label="Filter etter INT/EXT"
          sx={{ px: 1, py: 0.75, borderBottom: `1px solid ${alpha(accentColor, 0.1)}` }}
        >
          <Stack direction="row" spacing={0.5}>
            {(['all', 'INT', 'EXT'] as const).map(val => (
              <Chip
                key={val}
                label={val === 'all' ? 'Alle' : val}
                size="small"
                icon={val === 'INT' ? <IntIcon sx={{ fontSize: 12 }} aria-hidden="true" /> : val === 'EXT' ? <ExtIcon sx={{ fontSize: 12 }} aria-hidden="true" /> : undefined}
                onClick={() => setFilterIntExt(val)}
                role="radio"
                aria-checked={filterIntExt === val}
                aria-label={val === 'all' ? 'Vis alle scener' : val === 'INT' ? 'Vis bare innendørs scener' : 'Vis bare utendørs scener'}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilterIntExt(val); } }}
                sx={{
                  bgcolor: filterIntExt === val ? alpha(val === 'INT' ? intColor : val === 'EXT' ? extColor : accentColor, 0.25) : 'transparent',
                  border: `1px solid ${alpha(val === 'INT' ? intColor : val === 'EXT' ? extColor : accentColor, 0.4)}`,
                  color: val === 'INT' ? intColor : val === 'EXT' ? extColor : textColor,
                  height: 20,
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Stack>
        </Box>
      </Collapse>

      {/* Stats Bar */}
      <Box
        role="status"
        aria-live="polite"
        aria-label={`${filteredScenes.length} scener, omtrent ${filteredScenes.reduce((sum, s) => sum + s.pageEstimate, 0)} sider`}
        sx={{
          px: 1.5,
          py: 0.75,
          bgcolor: alpha(accentColor, 0.05),
          borderBottom: `1px solid ${alpha(accentColor, 0.1)}`,
        }}
      >
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary" aria-hidden="true">
            {filteredScenes.length} scener
          </Typography>
          <Typography variant="caption" color="text.secondary" aria-hidden="true">
            ~{filteredScenes.reduce((sum, s) => sum + s.pageEstimate, 0)} sider
          </Typography>
          <Typography variant="caption" color="text.secondary" aria-hidden="true">
            {filteredScenes.filter(s => s.intExt === 'INT').length} INT / {filteredScenes.filter(s => s.intExt === 'EXT').length} EXT
          </Typography>
        </Stack>
      </Box>

      {/* Main scrollable area: scene list OR stats panel */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>

        {/* ── Pro Stats Panel ─────────────────────────────────────────────── */}
        {activeView === 'stats' && (
          <Box role="region" aria-label="Manuskript-statistikk" sx={{ p: 1.5 }}>

            {/* Locations */}
            <Typography variant="caption" sx={{ color: accentColor, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75 }}>
              Lokasjoner ({locationStats.length})
            </Typography>
            {locationStats.slice(0, 12).map(stat => (
              <Box key={stat.location} sx={{ mb: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ color: textColor, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    {stat.location}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', flexShrink: 0 }}>
                    {stat.count} sc · {stat.pages.toFixed(1)} s.
                  </Typography>
                </Box>
                <Box sx={{ height: 3, bgcolor: alpha(accentColor, 0.15), borderRadius: 1 }}>
                  <Box sx={{ height: '100%', bgcolor: alpha(accentColor, 0.55), borderRadius: 1, width: `${(stat.count / (locationStats[0]?.count || 1)) * 100}%` }} />
                </Box>
              </Box>
            ))}

            <Divider sx={{ my: 1.25, borderColor: alpha(accentColor, 0.12) }} />

            {/* Day / Night */}
            <Typography variant="caption" sx={{ color: accentColor, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75 }}>
              Dag / Natt (sider)
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mb: 0.5 }}>
              <Box sx={{ flex: Math.max(pageDayNightStats.day, 0.1), bgcolor: alpha('#fbbf24', 0.15), border: `1px solid ${alpha('#fbbf24', 0.35)}`, borderRadius: 1, p: 0.75, textAlign: 'center', minWidth: 40 }}>
                <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.7rem', display: 'block' }}>DAG</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>~{pageDayNightStats.day.toFixed(1)}</Typography>
              </Box>
              <Box sx={{ flex: Math.max(pageDayNightStats.night, 0.1), bgcolor: alpha('#818cf8', 0.15), border: `1px solid ${alpha('#818cf8', 0.35)}`, borderRadius: 1, p: 0.75, textAlign: 'center', minWidth: 40 }}>
                <Typography variant="caption" sx={{ color: '#818cf8', fontWeight: 700, fontSize: '0.7rem', display: 'block' }}>NATT</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>~{pageDayNightStats.night.toFixed(1)}</Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 1.25, borderColor: alpha(accentColor, 0.12) }} />

            {/* Characters */}
            <Typography variant="caption" sx={{ color: accentColor, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75 }}>
              Karakterer ({characterStats.length})
            </Typography>
            {characterStats.length === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                Ingen karakterlinjer funnet ennå
              </Typography>
            )}
            {characterStats.slice(0, 15).map(stat => (
              <Box key={stat.name} sx={{ mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <PersonIcon sx={{ fontSize: 13, color: '#60a5fa', flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" sx={{ color: textColor, fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      {stat.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', flexShrink: 0 }}>
                      {stat.sceneCount} {stat.sceneCount === 1 ? 'scene' : 'scener'}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 3, bgcolor: alpha('#60a5fa', 0.15), borderRadius: 1 }}>
                    <Box sx={{ height: '100%', bgcolor: alpha('#60a5fa', 0.55), borderRadius: 1, width: `${(stat.sceneCount / (characterStats[0]?.sceneCount || 1)) * 100}%` }} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* ── Scene List ──────────────────────────────────────────────────── */}
        {activeView === 'scenes' && (
          <>
            {/* Pinned scenes section */}
            {pinnedSceneIds.size > 0 && (
              <Box>
                <ListItemButton
                  onClick={() => toggleAct('pinned')}
                  aria-expanded={expandedActs.has('pinned')}
                  aria-controls="pinned-scenes-list"
                  aria-label={`Festede scener, ${pinnedSceneIds.size} scener, ${expandedActs.has('pinned') ? 'klikk for å skjule' : 'klikk for å utvide'}`}
                  sx={{ py: 0.6, bgcolor: alpha('#f59e0b', 0.08), '&:hover': { bgcolor: alpha('#f59e0b', 0.12) } }}
                >
                  <PushPinIcon sx={{ fontSize: 13, color: '#f59e0b', mr: 0.75 }} aria-hidden="true" />
                  <ListItemText primary={
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#f59e0b' }}>FESTEDE</Typography>
                      <Chip label={pinnedSceneIds.size} size="small" aria-hidden="true" sx={{ height: 15, fontSize: '0.6rem', bgcolor: 'transparent', border: `1px solid ${alpha('#f59e0b', 0.35)}`, color: 'text.secondary' }} />
                    </Stack>
                  } />
                  {expandedActs.has('pinned') ? <ExpandLess sx={{ fontSize: 16 }} aria-hidden="true" /> : <ExpandMore sx={{ fontSize: 16 }} aria-hidden="true" />}
                </ListItemButton>
                <Collapse in={expandedActs.has('pinned')} id="pinned-scenes-list">
                  <List dense disablePadding role="list" aria-label="Festede scener">
                    {parsedScenes
                      .filter(s => pinnedSceneIds.has(s.id))
                      .map(scene => {
                        const isCurrent = currentScene?.id === scene.id;
                        const iec = scene.intExt === 'INT' ? intColor : scene.intExt === 'EXT' ? extColor : textColor;
                        return <SceneRow key={scene.id} scene={scene} isCurrent={isCurrent} intExtColor={iec} accentColor={accentColor} textColor={textColor} isPinned onPin={handlePinToggle} onClick={handleSceneClick} />;
                      })}
                  </List>
                </Collapse>
              </Box>
            )}

            {/* Acts */}
            {Object.entries(scenesByAct).map(([actNum, actScenes]) => (
              <Box key={actNum}>
                <ListItemButton
                  onClick={() => toggleAct(actNum)}
                  aria-expanded={expandedActs.has(actNum)}
                  aria-controls={`act-scenes-${actNum}`}
                  aria-label={`Akt ${actNum}, ${actScenes.length} scener, ${expandedActs.has(actNum) ? 'klikk for å skjule' : 'klikk for å utvide'}`}
                  sx={{ py: 0.75, bgcolor: alpha(accentColor, 0.08), '&:hover': { bgcolor: alpha(accentColor, 0.12) } }}
                >
                  <ListItemText primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: accentColor }}>AKT {actNum}</Typography>
                      <Chip label={actScenes.length} size="small" aria-hidden="true" sx={{ height: 16, fontSize: '0.65rem', bgcolor: 'transparent', border: `1px solid ${alpha(accentColor, 0.3)}`, color: 'text.secondary' }} />
                    </Stack>
                  } />
                  {expandedActs.has(actNum) ? <ExpandLess aria-hidden="true" /> : <ExpandMore aria-hidden="true" />}
                </ListItemButton>
                <Collapse in={expandedActs.has(actNum)} id={`act-scenes-${actNum}`}>
                  <List dense disablePadding role="list" aria-label={`Akt ${actNum} scener`}>
                    {actScenes.filter(Boolean).map(scene => {
                      const isCurrent = currentScene?.id === scene.id;
                      const iec = scene.intExt === 'INT' ? intColor : scene.intExt === 'EXT' ? extColor : textColor;
                      const globalIndex = reorderEnabled ? parsedScenes.findIndex(s => s.id === scene.id) : undefined;
                      return <SceneRow key={scene.id} scene={scene} isCurrent={isCurrent} intExtColor={iec} accentColor={accentColor} textColor={textColor} isPinned={pinnedSceneIds.has(scene.id)} onPin={handlePinToggle} onClick={handleSceneClick} index={globalIndex} total={parsedScenes.length} onMove={reorderEnabled ? handleMoveScene : undefined} />;
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
          </>
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
