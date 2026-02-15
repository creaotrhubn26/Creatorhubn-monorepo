import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  EventAvailable as AvailableIcon,
  EventBusy as UnavailableIcon,
  Schedule as TentativeIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { crewAvailabilityApi, crewConflictsApi, CrewAvailability, CrewConflict } from '../services/castingApiService';

interface CrewAvailabilityDrawerProps {
  open: boolean;
  onClose: () => void;
  crewId: string;
  crewName: string;
  projectId?: string;
}

const statusConfig = {
  available: { label: 'Tilgjengelig', color: '#22c55e', icon: AvailableIcon },
  unavailable: { label: 'Utilgjengelig', color: '#ef4444', icon: UnavailableIcon },
  tentative: { label: 'Usikker', color: '#f59e0b', icon: TentativeIcon },
};

export default function CrewAvailabilityDrawer({
  open,
  onClose,
  crewId,
  crewName,
  projectId,
}: CrewAvailabilityDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [availability, setAvailability] = useState<CrewAvailability[]>([]);
  const [conflicts, setConflicts] = useState<CrewConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    start_date: '',
    end_date: '',
    status: 'unavailable' as 'available' | 'unavailable' | 'tentative',
    is_recurring: false,
    recurrence_pattern: '',
    notes: '',
  });

  useEffect(() => {
    if (open && crewId) {
      loadData();
    }
  }, [open, crewId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const avail = await crewAvailabilityApi.getAll(crewId);
      setAvailability(avail);
      
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const conflictResult = await crewConflictsApi.check(
        crewId,
        today.toISOString().split('T')[0],
        nextMonth.toISOString().split('T')[0]
      );
      setConflicts(conflictResult.conflicts);
    } catch (error) {
      console.error('Failed to load availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    try {
      await crewAvailabilityApi.create(crewId, {
        ...newEntry,
        project_id: projectId,
      });
      setDialogOpen(false);
      setNewEntry({
        start_date: '',
        end_date: '',
        status: 'unavailable',
        is_recurring: false,
        recurrence_pattern: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Failed to add availability:', error);
    }
  };

  const handleDeleteEntry = async (availabilityId: string) => {
    try {
      await crewAvailabilityApi.delete(crewId, availabilityId);
      loadData();
    } catch (error) {
      console.error('Failed to delete availability:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 400,
            maxHeight: isMobile ? '85vh' : '100%',
            bgcolor: '#161b22',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#fff' }}>
              Tilgjengelighet: {crewName}
            </Typography>
            <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {conflicts.length > 0 && (
            <Alert
              severity="warning"
              icon={<WarningIcon />}
              sx={{
                mb: 2,
                bgcolor: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                '& .MuiAlert-icon': { color: '#f59e0b' },
              }}
            >
              {conflicts.length} konflikt{conflicts.length > 1 ? 'er' : ''} funnet neste 30 dager
            </Alert>
          )}

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            fullWidth
            sx={{
              mb: 2,
              bgcolor: '#8b5cf6',
              '&:hover': { bgcolor: '#7c3aed' },
            }}
          >
            Legg til periode
          </Button>

          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
            Registrerte perioder
          </Typography>

          {availability.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'rgba(255,255,255,0.87)' }}>
              <Typography>Ingen perioder registrert</Typography>
            </Box>
          ) : (
            <List sx={{ bgcolor: 'transparent' }}>
              {availability.map((entry) => {
                const config = statusConfig[entry.status];
                const Icon = config.icon;
                return (
                  <ListItem
                    key={entry.id}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.05)',
                      borderRadius: 1,
                      mb: 1,
                      border: `1px solid ${config.color}30`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                      <Icon sx={{ color: config.color, fontSize: 20 }} />
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: '#fff', fontSize: '0.875rem' }}>
                            {formatDate(entry.start_date)} - {formatDate(entry.end_date)}
                          </Typography>
                          <Chip
                            label={config.label}
                            size="small"
                            sx={{
                              bgcolor: `${config.color}20`,
                              color: config.color,
                              height: 20,
                              fontSize: '0.7rem',
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        entry.notes && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.75rem', mt: 0.5 }}>
                            {entry.notes}
                          </Typography>
                        )
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteEntry(entry.id)}
                        sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#ef4444' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}

          {conflicts.length > 0 && (
            <>
              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                Kommende bookinger
              </Typography>
              <List sx={{ bgcolor: 'transparent' }}>
                {conflicts.filter(c => c.type === 'event').map((conflict) => (
                  <ListItem
                    key={conflict.id}
                    sx={{
                      bgcolor: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: 1,
                      mb: 1,
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography sx={{ color: '#fff', fontSize: '0.875rem' }}>
                          {conflict.title}
                        </Typography>
                      }
                      secondary={
                        <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.75rem' }}>
                          {conflict.start_time?.split('T')[0]}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#161b22',
            color: '#fff',
            minWidth: 360,
          },
        }}
      >
        <DialogTitle>Legg til periode</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Fra dato"
              type="date"
              value={newEntry.start_date}
              onChange={(e) => setNewEntry({ ...newEntry, start_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              label="Til dato"
              type="date"
              value={newEntry.end_date}
              onChange={(e) => setNewEntry({ ...newEntry, end_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
              <Select
                value={newEntry.status}
                onChange={(e) => setNewEntry({ ...newEntry, status: e.target.value as 'available' | 'unavailable' | 'tentative' })}
                label="Status"
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                }}
              >
                <MenuItem value="available">Tilgjengelig</MenuItem>
                <MenuItem value="unavailable">Utilgjengelig</MenuItem>
                <MenuItem value="tentative">Usikker</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notater"
              multiline
              rows={2}
              value={newEntry.notes}
              onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={newEntry.is_recurring}
                  onChange={(e) => setNewEntry({ ...newEntry, is_recurring: e.target.checked })}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#8b5cf6' } }}
                />
              }
              label="Gjentakende"
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={handleAddEntry}
            variant="contained"
            disabled={!newEntry.start_date || !newEntry.end_date}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
