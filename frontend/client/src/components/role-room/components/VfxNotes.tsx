import React, { useState } from 'react';
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
  Checkbox,
  FormControlLabel,
  Slider,
  Tooltip,
  LinearProgress,
  Divider,
  Badge,
} from '@mui/material';
import {
  AutoFixHigh as VfxIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  CropFree as TrackingIcon,
  Gradient as GreenScreenIcon,
  Layers as CompositeIcon,
  Animation as AnimationIcon,
  ThreeDRotation as ThreeDIcon,
  Brush as PaintIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  AttachMoney as BudgetIcon,
  Person as ArtistIcon,
} from '@mui/icons-material';
import type { SceneBreakdown} from '../models/casting';
import { CastingShot } from '../models/casting';

type VfxCategory = 'greenscreen' | 'tracking' | 'composite' | 'cgi' | 'cleanup' | 'animation' | 'matte_painting' | 'particle' | 'other';
type VfxComplexity = 'simple' | 'medium' | 'complex' | 'hero';
type VfxStatus = 'identified' | 'planned' | 'in_progress' | 'review' | 'approved' | 'final';

interface VfxNote {
  id: string;
  sceneId: string;
  shotId?: string;
  title: string;
  description: string;
  category: VfxCategory;
  complexity: VfxComplexity;
  status: VfxStatus;
  requirements: string[];
  trackingMarkers?: {
    needed: boolean;
    color: string;
    count: number;
    placement: string;
  };
  greenScreen?: {
    needed: boolean;
    color: 'green' | 'blue';
    size: string;
    placement: string;
  };
  referenceImages: string[];
  estimatedHours: number;
  assignedArtist?: string;
  deadline?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface VfxNotesProps {
  scenes: SceneBreakdown[];
  onNoteUpdate?: (note: VfxNote) => void;
}

export const VfxNotes: React.FC<VfxNotesProps> = ({
  scenes,
  onNoteUpdate,
}) => {
  const [notes, setNotes] = useState<VfxNote[]>([
    // Demo data
    {
      id: '1',
      sceneId: 'scene-1',
      shotId: 'shot-1a',
      title: 'Troll i fjellet - full CG',
      description: 'Trollet skal erstatte placeholder på settet. Full CG-karakter med interaksjon med miljøet.',
      category: 'cgi',
      complexity: 'hero',
      status: 'planned',
      requirements: [
        'Motion capture data fra previz',
        'HDRI fra lokasjon',
        'Chrome/gray ball referanse',
        'Lidar scan av settet',
      ],
      estimatedHours: 120,
      assignedArtist: 'VFX Team Alpha',
      deadline: '2026-03-15',
      referenceImages: [],
      notes: 'Hovedshot i filmen. Må matche concept art fra produksjonsdesigner.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      sceneId: 'scene-1',
      shotId: 'shot-2b',
      title: 'Helikopter wire removal',
      description: 'Fjern sikkerhetswirer fra helikopterscene',
      category: 'cleanup',
      complexity: 'medium',
      status: 'identified',
      requirements: ['Clean plate', 'Alpha matte'],
      estimatedHours: 8,
      referenceImages: [],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      sceneId: 'scene-5',
      title: 'Oslo skyline - matte painting',
      description: 'Erstatt moderne bygninger med ødeleggelse etter trollangrep',
      category: 'matte_painting',
      complexity: 'complex',
      status: 'in_progress',
      requirements: [
        'Fotografier av Oslo',
        'Concept art av ødeleggelse',
        'Røyk/støv elementer',
      ],
      greenScreen: {
        needed: true,
        color: 'green',
        size: '40x20 ft',
        placement: 'Bak vinduet',
      },
      estimatedHours: 40,
      assignedArtist: 'Matte Dept',
      referenceImages: [],
      notes: 'Se referanse fra "Cloverfield" for destruksjon-stil',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<VfxNote | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const categoryConfig: Record<VfxCategory, { icon: React.ReactElement; label: string; color: string }> = {
    greenscreen: { icon: <GreenScreenIcon />, label: 'Green Screen', color: '#4caf50' },
    tracking: { icon: <TrackingIcon />, label: 'Tracking', color: '#2196f3' },
    composite: { icon: <CompositeIcon />, label: 'Compositing', color: '#9c27b0' },
    cgi: { icon: <ThreeDIcon />, label: 'CGI/3D', color: '#7c3aed' },
    cleanup: { icon: <PaintIcon />, label: 'Cleanup', color: '#795548' },
    animation: { icon: <AnimationIcon />, label: 'Animasjon', color: '#e91e63' },
    matte_painting: { icon: <PaintIcon />, label: 'Matte Painting', color: '#607d8b' },
    particle: { icon: <VfxIcon />, label: 'Partikler', color: '#9333ea' },
    other: { icon: <VfxIcon />, label: 'Annet', color: '#9e9e9e' },
  };

  const statusConfig: Record<VfxStatus, { label: string; color: string }> = {
    identified: { label: 'Identifisert', color: '#6b7280' },
    planned: { label: 'Planlagt', color: '#3b82f6' },
    in_progress: { label: 'Pågår', color: '#f59e0b' },
    review: { label: 'Review', color: '#8b5cf6' },
    approved: { label: 'Godkjent', color: '#10b981' },
    final: { label: 'Final', color: '#059669' },
  };

  const complexityConfig: Record<VfxComplexity, { label: string; hours: string; color: string }> = {
    simple: { label: 'Enkel', hours: '1-4 timer', color: '#10b981' },
    medium: { label: 'Medium', hours: '4-16 timer', color: '#f59e0b' },
    complex: { label: 'Kompleks', hours: '16-40 timer', color: '#ef4444' },
    hero: { label: 'Hero Shot', hours: '40+ timer', color: '#8b5cf6' },
  };

  const [newNote, setNewNote] = useState<Partial<VfxNote>>({
    title: '',
    description: '',
    category: 'composite',
    complexity: 'medium',
    status: 'identified',
    requirements: [],
    estimatedHours: 8,
    notes: '',
    referenceImages: [],
  });

  const handleSaveNote = () => {
    const note: VfxNote = {
      id: editingNote?.id || `vfx-${Date.now()}`,
      sceneId: newNote.sceneId || '',
      shotId: newNote.shotId,
      title: newNote.title || '',
      description: newNote.description || '',
      category: newNote.category as VfxCategory,
      complexity: newNote.complexity as VfxComplexity,
      status: newNote.status as VfxStatus,
      requirements: newNote.requirements || [],
      trackingMarkers: newNote.trackingMarkers,
      greenScreen: newNote.greenScreen,
      referenceImages: newNote.referenceImages || [],
      estimatedHours: newNote.estimatedHours || 8,
      assignedArtist: newNote.assignedArtist,
      deadline: newNote.deadline,
      notes: newNote.notes || '',
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingNote) {
      setNotes(prev => prev.map(n => n.id === note.id ? note : n));
    } else {
      setNotes(prev => [note, ...prev]);
    }

    if (onNoteUpdate) onNoteUpdate(note);
    
    setShowAddDialog(false);
    setEditingNote(null);
    setNewNote({
      title: '',
      description: '',
      category: 'composite',
      complexity: 'medium',
      status: 'identified',
      requirements: [],
      estimatedHours: 8,
      notes: '',
      referenceImages: [],
    });
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const editNote = (note: VfxNote) => {
    setEditingNote(note);
    setNewNote(note);
    setShowAddDialog(true);
  };

  const filteredNotes = notes.filter(note => {
    if (filterCategory !== 'all' && note.category !== filterCategory) return false;
    if (filterStatus !== 'all' && note.status !== filterStatus) return false;
    return true;
  });

  // Calculate stats
  const totalHours = notes.reduce((sum, n) => sum + n.estimatedHours, 0);
  const completedHours = notes
    .filter(n => n.status === 'approved' || n.status === 'final')
    .reduce((sum, n) => sum + n.estimatedHours, 0);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VfxIcon color="primary" />
            VFX & Spesialeffekt-noter
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAddDialog(true)}
          >
            Ny VFX Note
          </Button>
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
              <MenuItem value="all">Alle</MenuItem>
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
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">Alle</MenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>{config.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <VfxIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4">{notes.length}</Typography>
            <Typography variant="caption" color="text.secondary">VFX Shots</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <ScheduleIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
            <Typography variant="h4">{totalHours}</Typography>
            <Typography variant="caption" color="text.secondary">Estimerte timer</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h4">
              {notes.filter(n => n.status === 'approved' || n.status === 'final').length}
            </Typography>
            <Typography variant="caption" color="text.secondary">Fullført</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">Fremgang</Typography>
            <LinearProgress 
              variant="determinate" 
              value={totalHours > 0 ? (completedHours / totalHours) * 100 : 0}
              sx={{ height: 10, borderRadius: 1, my: 1 }}
            />
            <Typography variant="body2">
              {completedHours}/{totalHours} timer ({totalHours > 0 ? ((completedHours / totalHours) * 100).toFixed(0) : 0}%)
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Notes List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Grid container spacing={2}>
          {filteredNotes.map(note => {
            const catConfig = categoryConfig[note.category];
            const statConfig = statusConfig[note.status];
            const compConfig = complexityConfig[note.complexity];

            return (
              <Grid key={note.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    {/* Header */}
                    <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 2 }}>
                      <Box>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                          <Chip 
                            icon={catConfig.icon}
                            label={catConfig.label}
                            size="small"
                            sx={{ bgcolor: `${catConfig.color}22`, color: catConfig.color }}
                          />
                          <Chip 
                            label={compConfig.label}
                            size="small"
                            sx={{ bgcolor: `${compConfig.color}22`, color: compConfig.color }}
                          />
                        </Stack>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {note.title}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => editNote(note)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteNote(note.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>

                    {/* Status */}
                    <Chip 
                      label={statConfig.label}
                      size="small"
                      sx={{ 
                        bgcolor: statConfig.color,
                        color: '#fff',
                        fontWeight: 600,
                        mb: 2,
                      }}
                    />

                    {/* Description */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {note.description}
                    </Typography>

                    {/* Requirements */}
                    {note.requirements.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">Krav:</Typography>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          {note.requirements.slice(0, 3).map((req, i) => (
                            <Chip key={i} label={req} size="small" variant="outlined" />
                          ))}
                          {note.requirements.length > 3 && (
                            <Chip label={`+${note.requirements.length - 3}`} size="small" />
                          )}
                        </Stack>
                      </Box>
                    )}

                    {/* Green Screen / Tracking */}
                    {note.greenScreen?.needed && (
                      <Box sx={{ mb: 1, p: 1, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <GreenScreenIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                          {note.greenScreen.color === 'green' ? 'Grønn' : 'Blå'} skjerm: {note.greenScreen.size}
                        </Typography>
                      </Box>
                    )}

                    {note.trackingMarkers?.needed && (
                      <Box sx={{ mb: 1, p: 1, bgcolor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TrackingIcon sx={{ fontSize: 14, color: '#2196f3' }} />
                          {note.trackingMarkers.count} tracking markers ({note.trackingMarkers.color})
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {/* Meta */}
                    <Stack direction="row" spacing={2} justifyContent="space-between">
                      <Box>
                        <Typography variant="caption" color="text.secondary">Estimert</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {note.estimatedHours} timer
                        </Typography>
                      </Box>
                      {note.assignedArtist && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Tildelt</Typography>
                          <Typography variant="body2">{note.assignedArtist}</Typography>
                        </Box>
                      )}
                      {note.deadline && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Deadline</Typography>
                          <Typography variant="body2">
                            {new Date(note.deadline).toLocaleDateString('nb-NO')}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {filteredNotes.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <VfxIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Ingen VFX-noter ennå
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowAddDialog(true)} sx={{ mt: 2 }}>
              Opprett første VFX-note
            </Button>
          </Paper>
        )}
      </Box>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onClose={() => { setShowAddDialog(false); setEditingNote(null); }} maxWidth="md" fullWidth>
        <DialogTitle>{editingNote ? 'Rediger VFX Note' : 'Ny VFX Note'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Tittel"
                fullWidth
                value={newNote.title || ''}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Beskrivelse"
                fullWidth
                multiline
                rows={3}
                value={newNote.description || ''}
                onChange={(e) => setNewNote(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>

            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={newNote.category || 'composite'}
                  onChange={(e) => setNewNote(prev => ({ ...prev, category: e.target.value as VfxCategory }))}
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
            </Grid>

            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Kompleksitet</InputLabel>
                <Select
                  value={newNote.complexity || 'medium'}
                  onChange={(e) => setNewNote(prev => ({ ...prev, complexity: e.target.value as VfxComplexity }))}
                  label="Kompleksitet"
                >
                  {Object.entries(complexityConfig).map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      {config.label} ({config.hours})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newNote.status || 'identified'}
                  onChange={(e) => setNewNote(prev => ({ ...prev, status: e.target.value as VfxStatus }))}
                  label="Status"
                >
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <MenuItem key={key} value={key}>{config.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6 }}>
              <TextField
                label="Estimerte timer"
                type="number"
                fullWidth
                value={newNote.estimatedHours || 8}
                onChange={(e) => setNewNote(prev => ({ ...prev, estimatedHours: parseInt(e.target.value) || 8 }))}
              />
            </Grid>

            <Grid size={{ xs: 6 }}>
              <TextField
                label="Tildelt artist/team"
                fullWidth
                value={newNote.assignedArtist || ''}
                onChange={(e) => setNewNote(prev => ({ ...prev, assignedArtist: e.target.value }))}
              />
            </Grid>

            <Grid size={{ xs: 6 }}>
              <TextField
                label="Deadline"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={newNote.deadline || ''}
                onChange={(e) => setNewNote(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Spesielle krav</Typography>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={newNote.greenScreen?.needed || false}
                      onChange={(e) => setNewNote(prev => ({
                        ...prev,
                        greenScreen: { 
                          ...prev.greenScreen, 
                          needed: e.target.checked,
                          color: 'green',
                          size: '20x10 ft',
                          placement: '',
                        },
                      }))}
                    />
                  }
                  label="Green/Blue Screen"
                />
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={newNote.trackingMarkers?.needed || false}
                      onChange={(e) => setNewNote(prev => ({
                        ...prev,
                        trackingMarkers: { 
                          ...prev.trackingMarkers, 
                          needed: e.target.checked,
                          color: 'green',
                          count: 12,
                          placement: '',
                        },
                      }))}
                    />
                  }
                  label="Tracking Markers"
                />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Notater"
                fullWidth
                multiline
                rows={2}
                value={newNote.notes || ''}
                onChange={(e) => setNewNote(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowAddDialog(false); setEditingNote(null); }}>Avbryt</Button>
          <Button onClick={handleSaveNote} variant="contained" disabled={!newNote.title}>
            {editingNote ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VfxNotes;
