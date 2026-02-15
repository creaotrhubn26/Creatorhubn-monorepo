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
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  TheaterComedy as RoleIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { rolePoolService, PoolRole } from '../services/rolePoolService';
import { CastingProject } from '../models/casting';

interface RolePoolPanelProps {
  projects: CastingProject[];
  currentProjectId?: string;
  onImport?: (roleId: string) => void;
}

export const RolePoolPanel: FC<RolePoolPanelProps> = ({
  projects,
  currentProjectId,
  onImport,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [poolRoles, setPoolRoles] = useState<PoolRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PoolRole | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>(currentProjectId || '');

  const TOUCH_TARGET = 44;

  useEffect(() => {
    loadPoolRoles();
  }, []);

  const loadPoolRoles = async () => {
    setLoading(true);
    try {
      const roles = await rolePoolService.getPoolRoles();
      setPoolRoles(roles);
    } catch (error) {
      console.error('Error loading pool roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFromPool = async (roleId: string) => {
    if (window.confirm('Er du sikker på at du vil fjerne denne rollen fra poolen?')) {
      const success = await rolePoolService.deleteFromPool(roleId);
      if (success) {
        setPoolRoles(prev => prev.filter(r => r.id !== roleId));
      }
    }
  };

  const handleImportClick = (role: PoolRole) => {
    setSelectedRole(role);
    setTargetProjectId(currentProjectId || '');
    setImportDialogOpen(true);
  };

  const handleImportConfirm = async () => {
    if (!selectedRole || !targetProjectId) return;
    
    const newId = await rolePoolService.importToProject(selectedRole.id, targetProjectId);
    if (newId) {
      setImportDialogOpen(false);
      setSelectedRole(null);
      if (onImport) {
        onImport(newId);
      }
    }
  };

  const filteredRoles = poolRoles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.roleType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const cardStyles = {
    bgcolor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2,
    transition: 'all 0.2s ease',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.08)',
      borderColor: 'rgba(139,92,246,0.3)',
    },
  };

  const getRoleTypeColor = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case 'hovedrolle': return '#f59e0b';
      case 'birolle': return '#8b5cf6';
      case 'statist': return '#6b7280';
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
          <RoleIcon sx={{ color: '#8b5cf6' }} />
          Rollepool
          <Chip 
            label={poolRoles.length} 
            size="small" 
            sx={{ 
              bgcolor: 'rgba(139,92,246,0.2)', 
              color: '#a78bfa',
              ml: 1,
            }} 
          />
        </Typography>

        <TextField
          placeholder="Søk i rollepool..."
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
              '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
            },
            '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.87)' },
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3 }}>
        Global rollepool - gjenbruk rollebeskrivelser på tvers av prosjekter.
        Lagre roller til poolen fra prosjekter, eller importer fra poolen til nye prosjekter.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster roller...</Typography>
        </Box>
      ) : filteredRoles.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 6, 
          bgcolor: 'rgba(255,255,255,0.02)', 
          borderRadius: 2,
          border: '1px dashed rgba(255,255,255,0.1)',
        }}>
          <RoleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
            {searchQuery ? 'Ingen roller matcher søket' : 'Ingen roller i poolen ennå'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Lagre roller fra prosjekter for å fylle poolen
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
          {filteredRoles.map((role) => (
            <Card key={role.id} sx={cardStyles}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 1,
                    bgcolor: `${getRoleTypeColor(role.roleType)}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <RoleIcon sx={{ color: getRoleTypeColor(role.roleType), fontSize: 24 }} />
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
                      {role.name}
                    </Typography>
                    
                    {role.roleType && (
                      <Chip
                        label={role.roleType}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          mt: 0.5,
                          bgcolor: `${getRoleTypeColor(role.roleType)}20`,
                          color: getRoleTypeColor(role.roleType),
                        }}
                      />
                    )}
                  </Box>
                </Box>

                {role.description && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'rgba(255,255,255,0.87)',
                      mt: 1.5,
                      fontSize: '0.8rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {role.description}
                  </Typography>
                )}

                {role.tags && role.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                    {role.tags.slice(0, 3).map((tag, idx) => (
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
                    {role.tags.length > 3 && (
                      <Chip
                        label={`+${role.tags.length - 3}`}
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
                    onClick={() => handleImportClick(role)}
                    sx={{
                      color: '#8b5cf6',
                      fontSize: '0.75rem',
                      minHeight: TOUCH_TARGET,
                      '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
                    }}
                  >
                    Importer
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteFromPool(role.id)}
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
          Importer rolle til prosjekt
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedRole && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 1,
                  bgcolor: `${getRoleTypeColor(selectedRole.roleType)}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <RoleIcon sx={{ color: getRoleTypeColor(selectedRole.roleType), fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                    {selectedRole.name}
                  </Typography>
                  {selectedRole.roleType && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {selectedRole.roleType}
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
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#8b5cf6' },
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
              bgcolor: '#8b5cf6',
              color: '#fff',
              '&:hover': { bgcolor: '#7c3aed' },
              '&.Mui-disabled': { bgcolor: 'rgba(139,92,246,0.3)', color: 'rgba(255,255,255,0.87)' },
            }}
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolePoolPanel;
