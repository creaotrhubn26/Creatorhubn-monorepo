// @ts-nocheck
import { useState, cloneElement, type FC, type ChangeEvent, type ReactElement } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Divider,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Face as FaceIcon,
  Checkroom as CostumeIcon,
  Brush as MakeupIcon,
  Category as PropsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Compare as CompareIcon,
  Schedule as TimeIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import type { SceneBreakdown } from '../models/casting';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

interface ContinuityEntry {
  id: string;
  sceneId: string;
  shotId?: string;
  takeNumber?: number;
  timestamp: string;
  category: 'costume' | 'hair' | 'makeup' | 'props' | 'set' | 'lighting' | 'position';
  character?: string;
  description: string;
  images: string[];
  notes: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

interface ContinuityLoggerProps {
  scenes: SceneBreakdown[];
  onLogEntry?: (entry: ContinuityEntry) => void;
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

export const ContinuityLogger: FC<ContinuityLoggerProps> = ({
  scenes,
  onLogEntry,
}) => {
  const [entries, setEntries] = useState<ContinuityEntry[]>([
    // Demo entries
    {
      id: '1',
      sceneId: 'scene-1',
      shotId: 'shot-1a',
      takeNumber: 3,
      timestamp: new Date().toISOString(),
      category: 'costume',
      character: 'NORA',
      description: 'Grå jakke, blå t-skjorte, svarte jeans, brune støvler',
      images: [],
      notes: 'Jakken har en rift på venstre erme - viktig for kontinuitet',
      verified: true,
      verifiedBy: 'Script Supervisor',
      verifiedAt: new Date().toISOString(),
    },
    {
      id: '2',
      sceneId: 'scene-1',
      timestamp: new Date().toISOString(),
      category: 'hair',
      character: 'NORA',
      description: 'Løst hår, litt bustete, fell mot venstre side',
      images: [],
      notes: 'Håret skal se ut som hun nettopp har våknet',
      verified: true,
    },
    {
      id: '3',
      sceneId: 'scene-1',
      timestamp: new Date().toISOString(),
      category: 'props',
      description: 'Kaffekopp (hvit med blå stripe) på bordet til høyre',
      images: [],
      notes: 'Koppen er halvfull',
      verified: false,
    },
  ]);
  
  const [activeTab, setActiveTab] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ContinuityEntry | null>(null);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterScene, setFilterScene] = useState<string>('all');

  const [newEntry, setNewEntry] = useState<Partial<ContinuityEntry>>({
    category: 'costume',
    description: '',
    notes: '',
    images: [],
    character: '',
    sceneId: '',
  });

  type IconWithSx = ReactElement<{ sx?: Record<string, unknown> }>;

  const categoryConfig: Record<ContinuityEntry['category'], { icon: IconWithSx; label: string; color: string }> = {
    costume: { icon: <CostumeIcon />, label: 'Kostyme', color: '#e91e63' },
    hair: { icon: <FaceIcon />, label: 'Hår', color: '#9c27b0' },
    makeup: { icon: <MakeupIcon />, label: 'Sminke', color: '#ec407a' },
    props: { icon: <PropsIcon />, label: 'Rekvisitter', color: '#9333ea' },
    set: { icon: <LocationIcon />, label: 'Set/Lokasjon', color: '#4caf50' },
    lighting: { icon: <ImageIcon />, label: 'Lys', color: '#ffeb3b' },
    position: { icon: <LocationIcon />, label: 'Posisjon', color: '#2196f3' },
  };

  const handleAddEntry = () => {
    const entry: ContinuityEntry = {
      id: `entry-${Date.now()}`,
      sceneId: newEntry.sceneId || '',
      timestamp: new Date().toISOString(),
      category: newEntry.category as ContinuityEntry['category'],
      character: newEntry.character,
      description: newEntry.description || '',
      images: newEntry.images || [],
      notes: newEntry.notes || '',
      verified: false,
    };

    setEntries(prev => [entry, ...prev]);
    if (onLogEntry) onLogEntry(entry);
    
    setShowAddDialog(false);
    setNewEntry({
      category: 'costume',
      description: '',
      notes: '',
      images: [],
      character: '',
      sceneId: '',
    });
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setNewEntry(prev => ({
          ...prev,
          images: [...(prev.images || []), imageData],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleVerified = (entryId: string) => {
    setEntries(prev => prev.map(entry => 
      entry.id === entryId 
        ? { 
            ...entry, 
            verified: !entry.verified,
            verifiedBy: !entry.verified ? 'Current User' : undefined,
            verifiedAt: !entry.verified ? new Date().toISOString() : undefined,
          }
        : entry
    ));
  };

  const deleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const filteredEntries = entries.filter(entry => {
    if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
    if (filterScene !== 'all' && entry.sceneId !== filterScene) return false;
    return true;
  });

  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const key = entry.character || 'Generelt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {} as Record<string, ContinuityEntry[]>);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // WCAG 2.2 - 2.5.5: 44x44 min touch target for alle IconButtons
        '& .MuiIconButton-root': {
          minWidth: TOUCH_TARGET_SIZE,
          minHeight: TOUCH_TARGET_SIZE,
        },
      }}
    >
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraIcon color="primary" />
            Kontinuitetslogg
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CompareIcon />}
              onClick={() => setShowCompareDialog(true)}
            >
              Sammenlign
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
            >
              Ny Logg
            </Button>
          </Stack>
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Kategori</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Kategori"
            >
              <MenuItem value="all">Alle kategorier</MenuItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {config.icon}
                    <span>{config.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Scene</InputLabel>
            <Select
              value={filterScene}
              onChange={(e) => setFilterScene(e.target.value)}
              label="Scene"
            >
              <MenuItem value="all">Alle scener</MenuItem>
              {scenes.map(scene => (
                <MenuItem key={scene.id} value={scene.id}>
                  Scene {scene.sceneNumber}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Stats Overview */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {Object.entries(categoryConfig).map(([key, config]) => {
          const count = entries.filter(e => e.category === key).length;
          const verified = entries.filter(e => e.category === key && e.verified).length;
          
          return (
            <Grid key={key} size={{ xs: 6, sm: 4, md: 2 }}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 1, 
                  textAlign: 'center',
                  borderLeft: `4px solid ${config.color}`,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => setFilterCategory(filterCategory === key ? 'all' : key)}
              >
                <Badge badgeContent={count} color="primary">
                  {cloneElement(config.icon, { sx: { color: config.color } })}
                </Badge>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {config.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {verified}/{count} ✓
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Entries List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {Object.entries(groupedEntries).map(([character, charEntries]) => (
          <Card key={character} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FaceIcon />
                {character}
                <Chip label={`${charEntries.length} logger`} size="small" />
              </Typography>
              
              <Grid container spacing={2}>
                {charEntries.map(entry => {
                  const config = categoryConfig[entry.category];
                  
                  return (
                    <Grid key={entry.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <Paper 
                        variant="outlined"
                        sx={{ 
                          p: 2,
                          borderLeft: `4px solid ${config.color}`,
                          position: 'relative',
                        }}
                      >
                        {/* Header */}
                        <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 1 }}>
                          <Chip 
                            icon={config.icon}
                            label={config.label}
                            size="small"
                            sx={{ bgcolor: `${config.color}22` }}
                          />
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title={entry.verified ? 'Verifisert' : 'Ikke verifisert'}>
                              <IconButton 
                                size="small" 
                                onClick={() => toggleVerified(entry.id)}
                                color={entry.verified ? 'success' : 'default'}
                              >
                                <CheckIcon />
                              </IconButton>
                            </Tooltip>
                            <IconButton
                              size="small"
                              onClick={() => deleteEntry(entry.id)}
                              color="error"
                              aria-label="Slett oppføring"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        {/* Description */}
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                          {entry.description}
                        </Typography>

                        {/* Notes */}
                        {entry.notes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            💡 {entry.notes}
                          </Typography>
                        )}

                        {/* Images */}
                        {entry.images.length > 0 && (
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
                            {entry.images.slice(0, 3).map((img, i) => (
                              <Box
                                key={i}
                                component="img"
                                src={img}
                                sx={{
                                  width: 50,
                                  height: 50,
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                  cursor: 'pointer',
                                }}
                                onClick={() => setSelectedEntry(entry)}
                              />
                            ))}
                            {entry.images.length > 3 && (
                              <Box sx={{ 
                                width: 50, 
                                height: 50, 
                                borderRadius: 1, 
                                bgcolor: 'action.hover',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <Typography variant="caption">+{entry.images.length - 3}</Typography>
                              </Box>
                            )}
                          </Stack>
                        )}

                        {/* Meta */}
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(entry.timestamp).toLocaleString('nb-NO')}
                          </Typography>
                          {entry.shotId && (
                            <Chip label={`Shot ${entry.shotId}`} size="small" variant="outlined" />
                          )}
                        </Stack>

                        {/* Verification Badge */}
                        {entry.verified && (
                          <Box sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8,
                            bgcolor: 'success.main',
                            color: '#fff',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <CheckIcon sx={{ fontSize: 14 }} />
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>
        ))}

        {filteredEntries.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CameraIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Ingen kontinuitetslogger ennå
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Start med å logge kostyme, hår, sminke eller rekvisitter
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowAddDialog(true)}>
              Opprett første logg
            </Button>
          </Paper>
        )}
      </Box>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ny Kontinuitetslogg</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={newEntry.category}
                onChange={(e) => setNewEntry(prev => ({ ...prev, category: e.target.value as ContinuityEntry['category'] }))}
                label="Kategori"
              >
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {config.icon}
                      <span>{config.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Scene</InputLabel>
              <Select
                value={newEntry.sceneId || ''}
                onChange={(e) => setNewEntry(prev => ({ ...prev, sceneId: e.target.value }))}
                label="Scene"
              >
                {scenes.map(scene => (
                  <MenuItem key={scene.id} value={scene.id}>
                    Scene {scene.sceneNumber}: {scene.locationName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Karakter (valgfritt)"
              value={newEntry.character || ''}
              onChange={(e) => setNewEntry(prev => ({ ...prev, character: e.target.value }))}
              placeholder="F.eks. NORA, TOBIAS"
            />

            <TextField
              label="Beskrivelse"
              value={newEntry.description || ''}
              onChange={(e) => setNewEntry(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
              placeholder="Detaljert beskrivelse av kostyme, hår, rekvisitter osv."
              required
            />

            <TextField
              label="Notater"
              value={newEntry.notes || ''}
              onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
              multiline
              rows={2}
              placeholder="Ekstra notater, viktige detaljer å huske"
            />
            <GlobalMentionHelper
              text={typeof newEntry.notes === 'string' ? newEntry.notes : ''}
              localCandidates={[
                ...new Set(
                  [
                    ...scenes.map((scene) => `Scene ${scene.sceneNumber}`),
                    ...entries.map((entry) => entry.character || '').filter(Boolean),
                  ].filter((value): value is string => typeof value === 'string' && value.trim().length >= 2),
                ),
              ]}
              onApplySuggestion={(name) =>
                setNewEntry((prev) => ({
                  ...prev,
                  notes: applyMentionSuggestion(prev.notes, name),
                }))
              }
            />

            {/* Image Upload */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Bilder</Typography>
              <input
                type="file"
                accept="image/*"
                multiple
                id="continuity-image-upload"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={() => document.getElementById('continuity-image-upload')?.click()}
              >
                Last opp bilder
              </Button>
              
              {newEntry.images && newEntry.images.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {newEntry.images.map((img, i) => (
                    <Box
                      key={i}
                      sx={{ position: 'relative' }}
                    >
                      <Box
                        component="img"
                        src={img}
                        sx={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 1,
                        }}
                      />
                      <IconButton
                        size="small"
                        aria-label="Fjern bilde"
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'error.main',
                          color: '#fff',
                          '&:hover': { bgcolor: 'error.dark' },
                        }}
                        onClick={() => setNewEntry(prev => ({
                          ...prev,
                          images: prev.images?.filter((_, idx) => idx !== i),
                        }))}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Avbryt</Button>
          <Button onClick={handleAddEntry} variant="contained" disabled={!newEntry.description}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={showCompareDialog} onClose={() => setShowCompareDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Sammenlign Kontinuitet</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Velg to scener eller shots for å sammenligne kontinuitetsdetaljer
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, height: 400, overflow: 'auto' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Scene A</Typography>
                {entries.slice(0, 3).map(entry => (
                  <Box key={entry.id} sx={{ mb: 2 }}>
                    <Chip label={categoryConfig[entry.category].label} size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2">{entry.description}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, height: 400, overflow: 'auto' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Scene B</Typography>
                {entries.slice(0, 3).map(entry => (
                  <Box key={entry.id} sx={{ mb: 2 }}>
                    <Chip label={categoryConfig[entry.category].label} size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2">{entry.description}</Typography>
                  </Box>
                ))}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCompareDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Image Viewer Dialog */}
      {selectedEntry && (
        <Dialog open={!!selectedEntry} onClose={() => setSelectedEntry(null)} maxWidth="md" fullWidth>
          <DialogTitle>
            {categoryConfig[selectedEntry.category].label} - {selectedEntry.character || 'Generelt'}
          </DialogTitle>
          <DialogContent>
            {selectedEntry.images.length > 0 ? (
              <ImageList cols={2} gap={8}>
                {selectedEntry.images.map((img, i) => (
                  <ImageListItem key={i}>
                    <img src={img} alt={`Kontinuitet ${i + 1}`} style={{ borderRadius: 8 }} />
                  </ImageListItem>
                ))}
              </ImageList>
            ) : (
              <Typography color="text.secondary">Ingen bilder</Typography>
            )}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2">Beskrivelse</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>{selectedEntry.description}</Typography>
            {selectedEntry.notes && (
              <>
                <Typography variant="subtitle2">Notater</Typography>
                <Typography variant="body2">{selectedEntry.notes}</Typography>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedEntry(null)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default ContinuityLogger;
