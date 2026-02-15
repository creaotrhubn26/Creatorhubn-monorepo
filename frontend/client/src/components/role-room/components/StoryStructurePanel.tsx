/**
 * StoryStructurePanel - Comprehensive story structure analysis
 * 
 * Features:
 * - Scene numbering (toggleable)
 * - Act and sequence labeling
 * - Beat markers
 * - Scene purpose tagging
 * - Character arc tracking
 * - Dialogue balance analysis
 * - Pacing and runtime estimation
 * - Script sharing
 */

import { useState, useMemo, useCallback, type FC, type ReactNode } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Slider,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Movie as SceneIcon,
  Person as CharacterIcon,
  Timeline as TimelineIcon,
  Speed as PacingIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Numbers as NumberIcon,
  Flag as BeatIcon,
  Label as TagIcon,
  TrendingUp as ArcIcon,
  BarChart as BalanceIcon,
  Timer as RuntimeIcon,
  Lock as LockIcon,
  Link as LinkIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  Info as InfoIcon,
  NavigateBefore as GotoIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  analyzeScriptExtended,
  ExtendedScriptAnalysis,
  NumberedScene,
  ScenePurpose,
  CharacterArc,
  DialogueBalance,
  PacingAnalysis,
  ScriptShareConfig,
  createShareConfig,
} from '../services/scriptAnalysisService';

interface StoryStructurePanelProps {
  content: string;
  scriptTitle?: string;
  onGotoLine?: (lineNumber: number) => void;
  onSceneNumberingChange?: (enabled: boolean) => void;
  showSceneNumbers?: boolean;
  darkMode?: boolean;
}

// Purpose colors and labels
const PURPOSE_CONFIG: Record<ScenePurpose, { color: string; label: string; icon: string }> = {
  exposition: { color: '#3b82f6', label: 'Eksposisjon', icon: '📖' },
  conflict: { color: '#ef4444', label: 'Konflikt', icon: '⚔️' },
  rising_action: { color: '#f59e0b', label: 'Stigende handling', icon: '📈' },
  climax: { color: '#dc2626', label: 'Klimaks', icon: '🎯' },
  falling_action: { color: '#8b5cf6', label: 'Fallende handling', icon: '📉' },
  resolution: { color: '#22c55e', label: 'Løsning', icon: '✅' },
  transition: { color: '#6b7280', label: 'Overgang', icon: '➡️' },
  character_development: { color: '#06b6d4', label: 'Karakterutvikling', icon: '👤' },
  subplot: { color: '#ec4899', label: 'Subplott', icon: '🔀' },
};

// Generate character color
function getCharacterColor(name: string): string {
  const colors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Tab Panel Component
interface TabPanelProps {
  children?: ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ height: 'calc(100% - 48px)', overflow: 'auto' }}
    >
      {value === index && children}
    </Box>
  );
}

export const StoryStructurePanel: FC<StoryStructurePanelProps> = ({
  content,
  scriptTitle = 'Untitled Script',
  onGotoLine,
  onSceneNumberingChange,
  showSceneNumbers = true,
  darkMode = true,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareConfig, setShareConfig] = useState<ScriptShareConfig | null>(null);
  const [localShowNumbers, setLocalShowNumbers] = useState(showSceneNumbers);

  // Extended analysis
  const analysis = useMemo(() => analyzeScriptExtended(content), [content]);

  // Handle scene numbering toggle
  const handleNumberingToggle = useCallback((checked: boolean) => {
    setLocalShowNumbers(checked);
    onSceneNumberingChange?.(checked);
  }, [onSceneNumberingChange]);

  // Create share link
  const handleCreateShare = useCallback((options: Partial<ScriptShareConfig>) => {
    const config = createShareConfig(scriptTitle, 'current-user', options);
    setShareConfig(config);
  }, [scriptTitle]);

  // Copy share link
  const handleCopyLink = useCallback(() => {
    if (shareConfig) {
      const link = `${window.location.origin}/share/${shareConfig.id}`;
      navigator.clipboard.writeText(link);
    }
  }, [shareConfig]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: darkMode ? '#1a1a2e' : '#f8f9fa',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: darkMode ? 'rgba(30,30,50,0.9)' : 'rgba(255,255,255,0.95)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <TimelineIcon color="primary" />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
            Historie & Struktur
          </Typography>
          <Tooltip title="Del manus">
            <IconButton size="small" onClick={() => setShareDialogOpen(true)}>
              <ShareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Quick Stats */}
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            icon={<SceneIcon />}
            label={`${analysis.numberedScenes.length} scener`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<RuntimeIcon />}
            label={`~${analysis.pacingAnalysis.estimatedRuntime} min`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<CharacterIcon />}
            label={`${analysis.characterArcs.length} karakterer`}
            size="small"
            variant="outlined"
          />
        </Stack>
      </Paper>

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          bgcolor: darkMode ? 'rgba(25,25,45,0.8)' : 'rgba(248,249,250,0.95)',
          minHeight: 42,
          '& .MuiTab-root': { minHeight: 42, py: 1 },
        }}
      >
        <Tab label="Scener" icon={<SceneIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab label="Struktur" icon={<TimelineIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab label="Karakterer" icon={<CharacterIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab label="Pacing" icon={<PacingIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <SceneListPanel
          scenes={analysis.numberedScenes}
          showNumbers={localShowNumbers}
          onToggleNumbers={handleNumberingToggle}
          onGotoLine={onGotoLine}
          darkMode={darkMode}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <StructurePanel
          analysis={analysis}
          onGotoLine={onGotoLine}
          darkMode={darkMode}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <CharacterPanel
          arcs={analysis.characterArcs}
          dialogueBalance={analysis.dialogueBalance}
          onGotoLine={onGotoLine}
          darkMode={darkMode}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <PacingPanel
          pacing={analysis.pacingAnalysis}
          scenes={analysis.numberedScenes}
          onGotoLine={onGotoLine}
          darkMode={darkMode}
        />
      </TabPanel>

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        scriptTitle={scriptTitle}
        onCreateShare={handleCreateShare}
        shareConfig={shareConfig}
        onCopyLink={handleCopyLink}
      />
    </Box>
  );
};

// Scene List Panel
interface SceneListPanelProps {
  scenes: NumberedScene[];
  showNumbers: boolean;
  onToggleNumbers: (checked: boolean) => void;
  onGotoLine?: (lineNumber: number) => void;
  darkMode?: boolean;
}

const SceneListPanel: FC<SceneListPanelProps> = ({
  scenes,
  showNumbers,
  onToggleNumbers,
  onGotoLine,
  darkMode,
}) => {
  const [filter, setFilter] = useState<ScenePurpose | 'all'>('all');

  const filteredScenes = filter === 'all' 
    ? scenes 
    : scenes.filter(s => s.purpose === filter);

  return (
    <Box sx={{ p: 2 }}>
      {/* Controls */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showNumbers}
              onChange={(e) => onToggleNumbers(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Vis scenenummer</Typography>}
        />
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter</InputLabel>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ScenePurpose | 'all')}
            label="Filter"
            MenuProps={{ sx: { zIndex: 1400 } }}
          >
            <MenuItem value="all">Alle scener</MenuItem>
            <Divider />
            {Object.entries(PURPOSE_CONFIG).map(([key, config]) => (
              <MenuItem key={key} value={key}>
                {config.icon} {config.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Scene List */}
      <List dense>
        {filteredScenes.map((scene) => {
          const purposeConfig = scene.purpose ? PURPOSE_CONFIG[scene.purpose] : null;
          
          return (
            <ListItem
              key={scene.number}
              onClick={() => onGotoLine?.(scene.lineNumber)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                cursor: 'pointer',
                borderLeft: `3px solid ${purposeConfig?.color || '#6b7280'}`,
                bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
                '&:hover': {
                  bgcolor: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
                },
              }}
              secondaryAction={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip
                    label={`${scene.dialogueLines}D / ${scene.actionLines}A`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    p.{scene.pageNumber}
                  </Typography>
                </Stack>
              }
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {showNumbers ? (
                  <Chip
                    label={scene.number}
                    size="small"
                    sx={{
                      bgcolor: purposeConfig?.color || '#6b7280',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      height: 22,
                      minWidth: 28,
                    }}
                  />
                ) : (
                  <SceneIcon sx={{ color: purposeConfig?.color || '#6b7280' }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {scene.intExt}. {scene.location}
                    </Typography>
                    <Chip
                      label={scene.timeOfDay}
                      size="small"
                      sx={{ fontSize: '0.6rem', height: 16 }}
                    />
                  </Stack>
                }
                secondary={
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    {purposeConfig && (
                      <Chip
                        label={purposeConfig.label}
                        size="small"
                        sx={{
                          bgcolor: `${purposeConfig.color}20`,
                          color: purposeConfig.color,
                          fontSize: '0.6rem',
                          height: 18,
                        }}
                      />
                    )}
                    {scene.characters.slice(0, 3).map((char, i) => (
                      <Chip
                        key={i}
                        label={char}
                        size="small"
                        sx={{
                          bgcolor: `${getCharacterColor(char)}20`,
                          color: getCharacterColor(char),
                          fontSize: '0.6rem',
                          height: 18,
                        }}
                      />
                    ))}
                    {scene.characters.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        +{scene.characters.length - 3}
                      </Typography>
                    )}
                  </Stack>
                }
                primaryTypographyProps={{ component: 'div' }}
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

// Structure Panel (Acts, Sequences, Beats)
interface StructurePanelProps {
  analysis: ExtendedScriptAnalysis;
  onGotoLine?: (lineNumber: number) => void;
  darkMode?: boolean;
}

const StructurePanel: FC<StructurePanelProps> = ({
  analysis,
  onGotoLine,
  darkMode,
}) => {
  return (
    <Box sx={{ p: 2 }}>
      {/* Act Structure */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        <TimelineIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
        Akt-struktur
      </Typography>
      
      <Stack spacing={1} sx={{ mb: 3 }}>
        {analysis.actStructure.map((act) => (
          <Paper
            key={act.actNumber}
            sx={{
              p: 1.5,
              bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Chip
                label={`Akt ${act.actNumber}`}
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {act.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Scene {act.startScene}-{act.endScene}
              </Typography>
              <Chip
                label={`${act.percentage}%`}
                size="small"
                variant="outlined"
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={act.percentage}
              sx={{ mt: 1, height: 6, borderRadius: 3 }}
            />
          </Paper>
        ))}
      </Stack>

      {/* Sequences */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        <BeatIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
        Sekvenser
      </Typography>
      
      <Stack spacing={0.5}>
        {analysis.sequences.map((seq) => {
          const purposeConfig = PURPOSE_CONFIG[seq.purpose];
          
          return (
            <Paper
              key={seq.id}
              sx={{
                p: 1,
                bgcolor: darkMode ? 'rgba(30,30,50,0.3)' : 'rgba(255,255,255,0.6)',
                borderLeft: `3px solid ${purposeConfig.color}`,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
                },
              }}
              onClick={() => {
                const firstScene = analysis.numberedScenes.find(s => s.number === seq.scenes[0]);
                if (firstScene) onGotoLine?.(firstScene.lineNumber);
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {seq.name}
                </Typography>
                <Chip
                  label={purposeConfig.label}
                  size="small"
                  sx={{
                    bgcolor: `${purposeConfig.color}20`,
                    color: purposeConfig.color,
                    fontSize: '0.6rem',
                    height: 18,
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  Scene {seq.scenes[0]}-{seq.scenes[seq.scenes.length - 1]}
                </Typography>
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      {/* Purpose Legend */}
      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
        <TagIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
        Scenetype-forklaring
      </Typography>
      
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {Object.entries(PURPOSE_CONFIG).map(([key, config]) => (
          <Chip
            key={key}
            label={`${config.icon} ${config.label}`}
            size="small"
            sx={{
              bgcolor: `${config.color}20`,
              color: config.color,
              fontSize: '0.65rem',
            }}
          />
        ))}
      </Stack>
    </Box>
  );
};

// Character Panel (Arcs and Dialogue Balance)
interface CharacterPanelProps {
  arcs: CharacterArc[];
  dialogueBalance: DialogueBalance[];
  onGotoLine?: (lineNumber: number) => void;
  darkMode?: boolean;
}

const CharacterPanel: FC<CharacterPanelProps> = ({
  arcs,
  dialogueBalance,
  onGotoLine,
  darkMode,
}) => {
  const [expanded, setExpanded] = useState<string | false>(arcs[0]?.character || false);

  const maxLines = Math.max(...dialogueBalance.map(d => d.totalLines), 1);

  return (
    <Box sx={{ p: 2 }}>
      {/* Dialogue Balance Chart */}
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        <BalanceIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
        Dialog-balanse
      </Typography>
      
      <Stack spacing={1} sx={{ mb: 3 }}>
        {dialogueBalance.slice(0, 10).map((char) => (
          <Box key={char.character}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: getCharacterColor(char.character),
                  fontSize: '0.7rem',
                }}
              >
                {char.character.charAt(0)}
              </Avatar>
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                {char.character}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {char.totalLines} linjer ({char.percentageOfTotal}%)
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(char.totalLines / maxLines) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: getCharacterColor(char.character),
                },
              }}
            />
          </Box>
        ))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Character Arcs */}
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        <ArcIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
        Karakter-buer
      </Typography>

      {arcs.slice(0, 8).map((arc) => (
        <Accordion
          key={arc.character}
          expanded={expanded === arc.character}
          onChange={(_, isExpanded) => setExpanded(isExpanded ? arc.character : false)}
          sx={{
            bgcolor: darkMode ? 'rgba(30,30,50,0.5)' : 'rgba(255,255,255,0.8)',
            '&:before': { display: 'none' },
            mb: 0.5,
          }}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: getCharacterColor(arc.character),
                  fontSize: '0.8rem',
                }}
              >
                {arc.character.charAt(0)}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {arc.character}
              </Typography>
              <Chip
                label={`${arc.scenePresence}% tilstedeværelse`}
                size="small"
                variant="outlined"
                sx={{ ml: 'auto', mr: 1, fontSize: '0.65rem', height: 20 }}
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1}>
              <Stack direction="row" spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Første scene</Typography>
                  <Typography variant="body2">{arc.appearances[0]?.sceneNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Siste scene</Typography>
                  <Typography variant="body2">{arc.appearances[arc.appearances.length - 1]?.sceneNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Dialoglinjer</Typography>
                  <Typography variant="body2">{arc.totalDialogueLines}</Typography>
                </Box>
              </Stack>
              
              {/* Scene presence timeline */}
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Scene-tilstedeværelse
                </Typography>
                <Stack direction="row" spacing={0.25} flexWrap="wrap">
                  {arc.appearances.map((app, idx) => (
                    <Tooltip key={idx} title={`Scene ${app.sceneNumber} (${app.dialogueCount} linjer)`}>
                      <Box
                        onClick={() => onGotoLine?.(app.lineNumber)}
                        sx={{
                          width: 20,
                          height: 16,
                          bgcolor: getCharacterColor(arc.character),
                          borderRadius: 0.5,
                          cursor: 'pointer',
                          opacity: 0.5 + (app.dialogueCount / 20) * 0.5,
                          '&:hover': { opacity: 1 },
                        }}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// Pacing Panel
interface PacingPanelProps {
  pacing: PacingAnalysis;
  scenes: NumberedScene[];
  onGotoLine?: (lineNumber: number) => void;
  darkMode?: boolean;
}

const PacingPanel: FC<PacingPanelProps> = ({
  pacing,
  scenes,
  onGotoLine,
  darkMode,
}) => {
  return (
    <Box sx={{ p: 2 }}>
      {/* Runtime Overview */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          bgcolor: darkMode ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.05)',
          borderRadius: 2,
        }}
      >
        <Stack direction="row" spacing={3} justifyContent="center">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {pacing.totalPages}
            </Typography>
            <Typography variant="caption" color="text.secondary">Sider</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              ~{pacing.estimatedRuntime}
            </Typography>
            <Typography variant="caption" color="text.secondary">Minutter</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {pacing.averageSceneLength}
            </Typography>
            <Typography variant="caption" color="text.secondary">Snitt linjer/scene</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Dialogue vs Action */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Dialog vs. Handling
      </Typography>
      
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="caption">Dialog</Typography>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={pacing.dialogueRatio}
            sx={{
              height: 16,
              borderRadius: 2,
              bgcolor: 'rgba(139,92,246,0.2)',
              '& .MuiLinearProgress-bar': { bgcolor: '#8b5cf6' },
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ minWidth: 40 }}>
          {pacing.dialogueRatio}%
        </Typography>
      </Stack>
      
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="caption">Handling</Typography>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={pacing.actionRatio}
            sx={{
              height: 16,
              borderRadius: 2,
              bgcolor: 'rgba(34,197,94,0.2)',
              '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' },
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ minWidth: 40 }}>
          {pacing.actionRatio}%
        </Typography>
      </Stack>

      {/* Act Pacing */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Akt-pacing
      </Typography>
      
      <Stack spacing={1} sx={{ mb: 3 }}>
        {pacing.actPacing.map((act) => (
          <Stack key={act.act} direction="row" alignItems="center" spacing={1}>
            <Chip
              label={`Akt ${act.act}`}
              size="small"
              sx={{ minWidth: 60 }}
            />
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={act.percentage}
                sx={{
                  height: 12,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: act.status === 'ideal' ? '#22c55e' : 
                             act.status === 'short' ? '#f59e0b' : '#ef4444',
                  },
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ minWidth: 35 }}>
              {act.percentage}%
            </Typography>
            <Chip
              label={act.status === 'ideal' ? 'OK' : act.status === 'short' ? 'Kort' : 'Lang'}
              size="small"
              color={act.status === 'ideal' ? 'success' : 'warning'}
              sx={{ fontSize: '0.6rem', height: 18 }}
            />
            <Typography variant="caption" color="text.secondary">
              (ideelt: {act.idealPercentage}%)
            </Typography>
          </Stack>
        ))}
      </Stack>

      {/* Pacing Issues */}
      {pacing.pacingIssues.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            <WarningIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle', color: '#f59e0b' }} />
            Pacing-problemer ({pacing.pacingIssues.length})
          </Typography>
          
          <List dense>
            {pacing.pacingIssues.map((issue, idx) => (
              <ListItem
                key={idx}
                onClick={() => onGotoLine?.(issue.lineNumber)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 1,
                  bgcolor: darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)',
                  mb: 0.5,
                  '&:hover': { bgcolor: 'rgba(245,158,11,0.2)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <WarningIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={`Scene ${issue.sceneNumber}`}
                        size="small"
                        sx={{ fontSize: '0.65rem', height: 18 }}
                      />
                      <Chip
                        label={issue.type.replace('_', ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 16 }}
                      />
                    </Stack>
                  }
                  secondary={issue.description}
                  primaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {pacing.pacingIssues.length === 0 && (
        <Alert severity="success" icon={<CheckIcon />}>
          Ingen pacing-problemer funnet!
        </Alert>
      )}
    </Box>
  );
};

// Share Dialog
interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  scriptTitle: string;
  onCreateShare: (options: Partial<ScriptShareConfig>) => void;
  shareConfig: ScriptShareConfig | null;
  onCopyLink: () => void;
}

const ShareDialog: FC<ShareDialogProps> = ({
  open,
  onClose,
  scriptTitle,
  onCreateShare,
  shareConfig,
  onCopyLink,
}) => {
  const [accessType, setAccessType] = useState<'read-only' | 'comment' | 'suggest'>('read-only');
  const [password, setPassword] = useState('');
  const [allowDownload, setAllowDownload] = useState(false);
  const [watermark, setWatermark] = useState('');

  const handleCreate = () => {
    onCreateShare({
      accessType,
      password: password || undefined,
      allowDownload,
      watermark: watermark || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ShareIcon color="primary" />
          <Typography variant="h6">Del manus</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Del "{scriptTitle}" med andre
        </Typography>

        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Tilgangstype</InputLabel>
            <Select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as 'read-only' | 'comment' | 'suggest')}
              label="Tilgangstype"
              MenuProps={{ sx: { zIndex: 1400 } }}
            >
              <MenuItem value="read-only">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ViewIcon fontSize="small" />
                  <span>Kun lesing</span>
                </Stack>
              </MenuItem>
              <MenuItem value="comment">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoIcon fontSize="small" />
                  <span>Kan kommentere</span>
                </Stack>
              </MenuItem>
              <MenuItem value="suggest">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoIcon fontSize="small" />
                  <span>Kan foreslå endringer</span>
                </Stack>
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Passord (valgfritt)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="small"
            fullWidth
          />

          <TextField
            label="Vannmerke (valgfritt)"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
            size="small"
            fullWidth
            placeholder="F.eks. 'KONFIDENSIELT' eller brukerens e-post"
          />

          <FormControlLabel
            control={
              <Switch
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
              />
            }
            label="Tillat nedlasting"
          />

          {shareConfig && (
            <Paper sx={{ p: 2, bgcolor: 'rgba(34,197,94,0.1)', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#22c55e' }}>
                <CheckIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
                Delingslenke opprettet
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  value={`${window.location.origin}/share/${shareConfig.id}`}
                  size="small"
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <Tooltip title="Kopier lenke">
                  <IconButton onClick={onCopyLink} color="primary">
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          startIcon={<LinkIcon />}
        >
          Opprett delingslenke
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoryStructurePanel;
