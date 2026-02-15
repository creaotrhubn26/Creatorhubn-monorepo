import { useState, useEffect, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Avatar,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { candidatePoolService, PoolCandidate } from '../services/candidatePoolService';
import { CastingProject } from '../models/casting';

interface CandidatePoolPanelProps {
  projects: CastingProject[];
  currentProjectId?: string;
  onImport?: (candidateId: string) => void;
}

export const CandidatePoolPanel: FC<CandidatePoolPanelProps> = ({
  projects,
  currentProjectId,
  onImport,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  
  const [poolCandidates, setPoolCandidates] = useState<PoolCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<PoolCandidate | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>(currentProjectId || '');

  const TOUCH_TARGET = 44;

  useEffect(() => {
    loadPoolCandidates();
  }, []);

  const loadPoolCandidates = async () => {
    setLoading(true);
    try {
      const candidates = await candidatePoolService.getPoolCandidates();
      setPoolCandidates(candidates);
    } catch (error) {
      console.error('Error loading pool candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFromPool = async (candidateId: string) => {
    if (window.confirm('Er du sikker på at du vil fjerne denne kandidaten fra poolen?')) {
      const success = await candidatePoolService.deleteFromPool(candidateId);
      if (success) {
        setPoolCandidates(prev => prev.filter(c => c.id !== candidateId));
      }
    }
  };

  const handleImportClick = (candidate: PoolCandidate) => {
    setSelectedCandidate(candidate);
    setTargetProjectId(currentProjectId || '');
    setImportDialogOpen(true);
  };

  const handleImportConfirm = async () => {
    if (!selectedCandidate || !targetProjectId) return;
    
    const newId = await candidatePoolService.importToProject(selectedCandidate.id, targetProjectId);
    if (newId) {
      setImportDialogOpen(false);
      setSelectedCandidate(null);
      if (onImport) {
        onImport(newId);
      }
    }
  };

  const filteredCandidates = poolCandidates.filter(candidate =>
    candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    candidate.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const cardStyles = {
    bgcolor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2,
    transition: 'all 0.2s ease',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.08)',
      borderColor: 'rgba(0,212,255,0.3)',
    },
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
          <PersonIcon sx={{ color: '#00d4ff' }} />
          Kandidatpool
          <Chip 
            label={poolCandidates.length} 
            size="small" 
            sx={{ 
              bgcolor: 'rgba(0,212,255,0.2)', 
              color: '#00d4ff',
              ml: 1,
            }} 
          />
        </Typography>

        <TextField
          placeholder="Søk i kandidatpool..."
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
              '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
            },
            '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.87)' },
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
        Global kandidatpool - gjenbruk kandidater på tvers av prosjekter. 
        Lagre kandidater til poolen fra prosjekter, eller importer fra poolen til nye prosjekter.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster kandidater...</Typography>
        </Box>
      ) : filteredCandidates.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 6, 
          bgcolor: 'rgba(255,255,255,0.02)', 
          borderRadius: 2,
          border: '1px dashed rgba(255,255,255,0.1)',
        }}>
          <PersonIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
            {searchQuery ? 'Ingen kandidater matcher søket' : 'Ingen kandidater i poolen ennå'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Lagre kandidater fra prosjekter for å fylle poolen
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
          {filteredCandidates.map((candidate) => (
            <Card key={candidate.id} sx={cardStyles}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Avatar
                    src={candidate.photos?.[0]}
                    sx={{ 
                      width: 56, 
                      height: 56, 
                      bgcolor: 'rgba(0,212,255,0.2)',
                      color: '#00d4ff',
                    }}
                  >
                    {candidate.name.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ 
                      color: '#fff', 
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {candidate.name}
                    </Typography>
                    
                    {candidate.contactInfo?.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <EmailIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
                        <Typography variant="body2" sx={{ 
                          color: 'rgba(255,255,255,0.87)',
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {candidate.contactInfo.email}
                        </Typography>
                      </Box>
                    )}
                    
                    {candidate.contactInfo?.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                        <PhoneIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.87)' }} />
                        <Typography variant="body2" sx={{ 
                          color: 'rgba(255,255,255,0.87)',
                          fontSize: '0.75rem',
                        }}>
                          {candidate.contactInfo.phone}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {candidate.tags && candidate.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                    {candidate.tags.slice(0, 3).map((tag, idx) => (
                      <Chip
                        key={idx}
                        label={tag}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(139,92,246,0.2)',
                          color: '#a78bfa',
                        }}
                      />
                    ))}
                    {candidate.tags.length > 3 && (
                      <Chip
                        label={`+${candidate.tags.length - 3}`}
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
                    onClick={() => handleImportClick(candidate)}
                    sx={{
                      color: '#00d4ff',
                      fontSize: '0.75rem',
                      minHeight: TOUCH_TARGET,
                      '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                    }}
                  >
                    Importer
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteFromPool(candidate.id)}
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
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
          Importer kandidat til prosjekt
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedCandidate && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar
                  src={selectedCandidate.photos?.[0]}
                  sx={{ width: 48, height: 48, bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff' }}
                >
                  {selectedCandidate.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                  {selectedCandidate.name}
                </Typography>
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
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
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
              bgcolor: '#00d4ff',
              color: '#000',
              '&:hover': { bgcolor: '#00b8e6' },
              '&.Mui-disabled': { bgcolor: 'rgba(0,212,255,0.3)', color: 'rgba(0,0,0,0.5)' },
            }}
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CandidatePoolPanel;
