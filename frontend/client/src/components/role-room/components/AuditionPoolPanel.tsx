import { useState, useEffect, type FC } from "react";
import { Box, Typography, Button, IconButton, Card, CardContent, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Chip, InputAdornment, Select, MenuItem, FormControl, InputLabel, useMediaQuery, useTheme } from "@mui/material";
import { Delete as DeleteIcon, Search as SearchIcon, Download as DownloadIcon, AccessTime as TimeIcon } from "@mui/icons-material";
import { AuditionsIcon as AuditionIcon, LocationsIcon as LocationIcon } from "./icons/CastingIcons";
import { auditionPoolService, type PoolAudition } from "../services/auditionPoolService";
import type { CastingProject } from "../models/casting";

interface AuditionPoolPanelProps {
  projects: CastingProject[];
  currentProjectId?: string;
  onImport?: (scheduleId: string) => void;
}

export const AuditionPoolPanel: FC<AuditionPoolPanelProps> = ({
  projects,
  currentProjectId,
  onImport,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [poolAuditions, setPoolAuditions] = useState<PoolAudition[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedAudition, setSelectedAudition] = useState<PoolAudition | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>(currentProjectId || '');

  const TOUCH_TARGET = 44;

  useEffect(() => {
    loadPoolAuditions();
  }, []);

  const loadPoolAuditions = async () => {
    setLoading(true);
    try {
      const auditions = await auditionPoolService.getPoolAuditions();
      setPoolAuditions(auditions);
    } catch (error) {
      console.error('Error loading pool auditions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFromPool = async (auditionId: string) => {
    if (window.confirm('Er du sikker på at du vil fjerne denne auditionmalen fra poolen?')) {
      const success = await auditionPoolService.deleteFromPool(auditionId);
      if (success) {
        setPoolAuditions(prev => prev.filter(a => a.id !== auditionId));
      }
    }
  };

  const handleImportClick = (audition: PoolAudition) => {
    setSelectedAudition(audition);
    setTargetProjectId(currentProjectId || '');
    setImportDialogOpen(true);
  };

  const handleImportConfirm = async () => {
    if (!selectedAudition || !targetProjectId) return;
    
    const newId = await auditionPoolService.importToProject(selectedAudition.id, targetProjectId);
    if (newId) {
      setImportDialogOpen(false);
      setSelectedAudition(null);
      if (onImport) {
        onImport(newId);
      }
    }
  };

  const filteredAuditions = poolAuditions.filter(audition =>
    audition.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audition.auditionType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audition.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    audition.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const cardStyles = {
    bgcolor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2,
    transition: 'all 0.2s ease',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.08)',
      borderColor: 'rgba(16,185,129,0.3)',
    },
  };

  const getAuditionTypeColor = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case 'selvtape': return '#f59e0b';
      case 'callback': return '#8b5cf6';
      case 'førstegangs': return '#10b981';
      case 'kjemi-test': return '#ec4899';
      default: return '#00d4ff';
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        mb: 3,
        gap: 2,
      }}>
        <Typography variant="h6" sx={{ 
          color: '#fff', 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <AuditionIcon sx={{ color: '#10b981' }} />
          Auditionmaler
          <Chip 
            label={poolAuditions.length} 
            size="small" 
            sx={{ 
              bgcolor: 'rgba(16,185,129,0.2)', 
              color: '#10b981',
              ml: 1,
            }} 
          />
        </Typography>

        <TextField
          placeholder="Søk i auditionmaler..."
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: '100%', sm: 300 },
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#10b981' },
            },
            '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.87)' },
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
        Global auditionpool - gjenbruk auditionmaler på tvers av prosjekter.
        Lagre auditions til poolen fra prosjekter, eller importer fra poolen til nye prosjekter.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster auditionmaler...</Typography>
        </Box>
      ) : filteredAuditions.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 6, 
          bgcolor: 'rgba(255,255,255,0.02)', 
          borderRadius: 2,
          border: '1px dashed rgba(255,255,255,0.1)',
        }}>
          <AuditionIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
            {searchQuery ? 'Ingen auditionmaler matcher søket' : 'Ingen auditionmaler i poolen ennå'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Lagre auditions fra prosjekter for å fylle poolen
          </Typography>
        </Box>
      ) : (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}>
          {filteredAuditions.map((audition) => (
            <Card key={audition.id} sx={cardStyles}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 1,
                    bgcolor: `${getAuditionTypeColor(audition.auditionType)}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <AuditionIcon sx={{ color: getAuditionTypeColor(audition.auditionType), fontSize: 24 }} />
                  </Box>
                  
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ 
                      color: '#fff', 
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {audition.title}
                    </Typography>
                    
                    {audition.auditionType && (
                      <Chip
                        label={audition.auditionType}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          mt: 0.5,
                          bgcolor: `${getAuditionTypeColor(audition.auditionType)}20`,
                          color: getAuditionTypeColor(audition.auditionType),
                        }}
                      />
                    )}
                  </Box>
                </Box>

                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {audition.durationMinutes && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TimeIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.75rem' }}>
                        {audition.durationMinutes} minutter
                      </Typography>
                    </Box>
                  )}
                  
                  {audition.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
                      <Typography variant="body2" sx={{ 
                        color: 'rgba(255,255,255,0.87)', 
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {audition.location}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {audition.description && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.87)',
                      mt: 1,
                      fontSize: '0.8rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {audition.description}
                  </Typography>
                )}

                {audition.tags && audition.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                    {audition.tags.slice(0, 3).map((tag, idx) => (
                      <Chip
                        key={idx}
                        label={tag}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(0,212,255,0.2)',
                          color: '#00d4ff',
                        }}
                      />
                    ))}
                    {audition.tags.length > 3 && (
                      <Chip
                        label={`+${audition.tags.length - 3}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.87)',
                        }}
                      />
                    )}
                  </Box>
                )}

                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mt: 2,
                  pt: 1.5,
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                    onClick={() => handleImportClick(audition)}
                    sx={{
                      color: '#10b981',
                      fontSize: '0.75rem',
                      minHeight: TOUCH_TARGET,
                      '&:hover': { bgcolor: 'rgba(16,185,129,0.1)' },
                    }}
                  >
                    Importer
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteFromPool(audition.id)}
                    aria-label="Slett fra pool"
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      minWidth: TOUCH_TARGET,
                      minHeight: TOUCH_TARGET,
                      '&:hover': { 
                        color: '#ef4444',
                        bgcolor: 'rgba(239,68,68,0.1)',
                      },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog 
        open={importDialogOpen} 
        onClose={() => setImportDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: { xs: '90vw', sm: 400 },
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          Importer auditionmal til prosjekt
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedAudition && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 1,
                  bgcolor: `${getAuditionTypeColor(selectedAudition.auditionType)}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <AuditionIcon sx={{ color: getAuditionTypeColor(selectedAudition.auditionType), fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    {selectedAudition.title}
                  </Typography>
                  {selectedAudition.auditionType && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {selectedAudition.auditionType}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          )}
          
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Velg prosjekt</InputLabel>
            <Select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              label="Velg prosjekt"
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' },
              }}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button 
            onClick={() => setImportDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleImportConfirm}
            disabled={!targetProjectId}
            startIcon={<DownloadIcon />}
            sx={{
              bgcolor: '#10b981',
              color: '#fff',
              '&:hover': { bgcolor: '#059669' },
              '&.Mui-disabled': { bgcolor: 'rgba(16,185,129,0.3)', color: 'rgba(255,255,255,0.87)' },
            }}
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditionPoolPanel;
