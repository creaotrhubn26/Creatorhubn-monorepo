/**
 * SWOT Kanban Board
 * Drag-and-drop board for managing SWOT items through their lifecycle
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid2 as Grid,
  Stack,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { useTheming } from '@/utils/theming-helper';
import { SWOTItem } from '@/services/BusinessIntelligenceService';

interface SWOTKanbanBoardProps {
  userId: string;
  profession: string;
  items: SWOTItem[];
  onItemUpdate: (item: SWOTItem) => void;
  onItemDelete: (itemId: string) => void;
  onItemCreate: (item: Partial<SWOTItem>) => void;
}

const COLUMNS = [
  { id: 'identified', label: 'Identified', color: '#9e9e9e' },
  { id: 'analyzing', label: 'Analyzing', color: '#2196f3' },
  { id: 'in_progress', label: 'In Progress', color: '#ff9800' },
  { id: 'resolved', label: 'Resolved', color: '#4caf50' },
];

const TYPE_CONFIG = {
  strength: { icon: CheckCircleIcon, color: '#4caf50', label: 'Strength' },
  weakness: { icon: WarningIcon, color: '#f44336', label: 'Weakness' },
  opportunity: { icon: LightbulbIcon, color: '#2196f3', label: 'Opportunity' },
  threat: { icon: TrendingDownIcon, color: '#ff9800', label: 'Threat' },
};

export const SWOTKanbanBoard: React.FC<SWOTKanbanBoardProps> = ({
  userId,
  profession,
  items,
  onItemUpdate,
  onItemDelete,
  onItemCreate,
}) => {
  const theming = useTheming();
  const [draggedItem, setDraggedItem] = useState<SWOTItem | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: SWOTItem | null }>({
    open: false,
    item: null,
  });
  const [createDialog, setCreateDialog] = useState(false);
  const [formData, setFormData] = useState<Partial<SWOTItem>>({
    type: 'opportunity',
    title: '',
    description: '',
    impact: 'medium',
    probability: 50,
    urgency: 'medium',
    status: 'identified',
    category: '',
    tags: [],
  });

  const handleDragStart = (item: SWOTItem) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: string) => {
    if (draggedItem) {
      onItemUpdate({
        ...draggedItem,
        status: status as SWOTItem['status'],
      });
      setDraggedItem(null);
    }
  };

  const handleEdit = (item: SWOTItem) => {
    setFormData(item);
    setEditDialog({ open: true, item });
  };

  const handleSave = () => {
    if (editDialog.item) {
      onItemUpdate({ ...editDialog.item, ...formData });
    } else {
      onItemCreate(formData);
    }
    setEditDialog({ open: false, item: null });
    setCreateDialog(false);
    setFormData({
      type: 'opportunity',
      title: '',
      description: '',
      impact: 'medium',
      probability: 50,
      urgency: 'medium',
      status: 'identified',
      category: '',
      tags: [],
    });
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#fbc02d';
      case 'low': return '#388e3c';
      default: return '#9e9e9e';
    }
  };

  const renderItem = (item: SWOTItem) => {
    const TypeIcon = TYPE_CONFIG[item.type].icon;

    return (
      <Card
        key={item.id}
        draggable
        onDragStart={() => handleDragStart(item)}
        onDragEnd={() => setDraggedItem(null)}
        role="article"
        aria-label={`${TYPE_CONFIG[item.type].label}: ${item.title}`}
        tabIndex={0}
        sx={{
          mb: 2,
          cursor: 'grab',
          transition: 'all 0.2s', '&:hover': {
            boxShadow: 3,
            transform: 'translateY(-2px)',
          }, '&:focus-visible': {
            outline: '3px solid',
            outlineColor: 'primary.main',
            outlineOffset: '2px',
          },
          opacity: draggedItem?.id === item.id ? 0.5 : 1}}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <DragIcon aria-hidden="true" fontSize="small" sx={{ color: 'grey.400' }} />
            <TypeIcon aria-hidden="true" sx={{ color: TYPE_CONFIG[item.type].color, fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ flex: 1 }}>
              {item.title}
            </Typography>
            <IconButton
              size="small"
              onClick={() => handleEdit(item)}
              aria-label={`Rediger ${item.title}`}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              <EditIcon aria-hidden="true" fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onItemDelete(item.id)}
              color="error"
              aria-label={`Slett ${item.title}`}
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'error.main',
                  outlineOffset: '2px',
                }}}
            >
              <DeleteIcon aria-hidden="true" fontSize="small" />
            </IconButton>
          </Stack>

          {item.description && (
            <Typography variant="body2" color="text.secondary" mb={1} fontSize="0.85rem">
              {item.description.length > 100 ? `${item.description.substring(0, 100)}...` : item.description}
            </Typography>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
            <Chip
              label={item.impact.toUpperCase()}
              size="small"
              aria-label={`Påvirkning: ${item.impact}`}
              sx={{
                backgroundColor: getImpactColor(item.impact),
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem'}}
            />
            <Chip
              label={`${item.probability}%`}
              size="small"
              variant="outlined"
              aria-label={`Sannsynlighet: ${item.probability} prosent`}
              sx={{ fontSize: '0.7rem' }}
            />
            {item.category && (
              <Chip
                label={item.category}
                size="small"
                variant="outlined"
                aria-label={`Kategori: ${item.category}`}
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box role="region" aria-label="SWOT Kanban tavle">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" component="h2" fontWeight="bold" color={theming.colors.primary}>
          SWOT Kanban Board
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon aria-hidden="true" />}
          onClick={() => setCreateDialog(true)}
          aria-label="Legg til nytt SWOT element"
          sx={{
            background: theming.colors.primary,
            '&:hover': { opacity: 0.9 }, '&:focus-visible': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: '2px',
            }}}
        >
          Legg til
        </Button>
      </Box>

      <Grid container spacing={2} role="list" aria-label="SWOT kolonner">
        {COLUMNS.map((column) => (
          <Grid key={column.id} size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
              role="listitem"
              aria-label={`${column.label} kolonne med ${items.filter((item) => item.status === column.id).length} elementer`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
              sx={{
                backgroundColor: 'grey.50',
                borderRadius: 2,
                p: 2,
                minHeight: 500,
                border: '2px dashed',
                borderColor: draggedItem ? column.color : 'grey.300',
                transition: 'all 0.2s'}}
            >
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: column.color}}
                />
                <Typography variant="subtitle1" component="h3" fontWeight="bold" id={`column-${column.id}-heading`}>
                  {column.label}
                </Typography>
                <Chip
                  label={items.filter((item) => item.status === column.id).length}
                  size="small"
                  aria-label={`${items.filter((item) => item.status === column.id).length} elementer`}
                  sx={{ ml: 'auto' }}
                />
              </Stack>

              <Box role="list" aria-labelledby={`column-${column.id}-heading`}>
                {items
                  .filter((item) => item.status === column.id)
                  .map((item) => renderItem(item))}
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialog.open || createDialog}
        onClose={() => {
          setEditDialog({ open: false, item: null });
          setCreateDialog(false);
        }}
        maxWidth="md"
        fullWidth
        aria-labelledby="swot-dialog-title"
        aria-describedby="swot-dialog-description"
        role="dialog"
      >
        <DialogTitle id="swot-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {editDialog.item ? (
              <>
                <EditIcon aria-hidden="true" />
                <span>Rediger SWOT Element</span>
              </>
            ) : (
              <>
                <AddIcon aria-hidden="true" />
                <span>Opprett SWOT Element</span>
              </>
            )}
          </Box>
        </DialogTitle>
        <DialogContent id="swot-dialog-description">
          <Box component="form" role="form" aria-label="SWOT element skjema">
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="swot-type-label">Type</InputLabel>
                  <Select
                    labelId="swot-type-label"
                    id="swot-type-select"
                    value={formData.type}
                    label="Type"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as SWOTItem['type'] })}
                    inputProps={{ 'aria-label' : 'Velg SWOT type' }}
                  >
                    <MenuItem value="strength">Styrke (Strength)</MenuItem>
                    <MenuItem value="weakness">Svakhet (Weakness)</MenuItem>
                    <MenuItem value="opportunity">Mulighet (Opportunity)</MenuItem>
                    <MenuItem value="threat">Trussel (Threat)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="swot-impact-label">Påvirkning</InputLabel>
                  <Select
                    labelId="swot-impact-label"
                    id="swot-impact-select"
                    value={formData.impact}
                    label="Påvirkning"
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value as SWOTItem['impact'] })}
                    inputProps={{ 'aria-label' : 'Velg påvirkningsgrad' }}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="critical">Kritisk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Tittel"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  inputProps={{
                    'aria-label':'Tittel (påkrevd)','aria-required' : 'true'}}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Beskrivelse"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                  inputProps={{
                    'aria-label' : 'Beskrivelse av SWOT elementet'}}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Sannsynlighet (%)"
                  type="number"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
                  slotProps={{ htmlInput: { min: 0, max: 100, 'aria-label': 'Sannsynlighet i prosent' } }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="swot-urgency-label">Hastegrad</InputLabel>
                  <Select
                    labelId="swot-urgency-label"
                    id="swot-urgency-select"
                    value={formData.urgency}
                    label="Hastegrad"
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value as SWOTItem['urgency'] })}
                    inputProps={{ 'aria-label' : 'Velg hastegrad' }}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Kategori"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="f.eks. markedsføring, drift, økonomi"
                  inputProps={{
                    'aria-label' : 'Kategori for SWOT elementet'}}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions role="group" aria-label="Dialoghandlinger">
          <Button
            onClick={() => {
              setEditDialog({ open: false, item: null });
              setCreateDialog(false);
            }}
            aria-label="Avbryt og lukk dialogen"
            sx={{
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.title}
            aria-label={editDialog.item ? 'Lagre endringer' : 'Opprett SWOT element'}
            sx={{
              background: theming.colors.primary, '&:hover': { opacity: 0.9 }, '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SWOTKanbanBoard;

