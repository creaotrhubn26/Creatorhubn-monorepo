import { useState, useEffect, useMemo, type FC } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Stack,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  TheaterComedy as RoleIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { rolePoolService } from '../services/rolePoolService';
import { CastingProject } from '../models/casting';
import { castingService } from '../services/castingService';
import { ROLE_WORKFLOW_ORDER, RoleWorkflowStatus, getRoleWorkflowMeta } from '../config/roleWorkflow';
import { emitRoleSyncEvent, onRoleSyncEvent } from '../services/roleSyncEvents';
import { roleQueryKeys } from '../services/roleQueryKeys';
import { RoleTemplate, createTemplateImportAuditEntry } from '../config/roleDomain';

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
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleTemplate | null>(null);
  const [rolePendingDelete, setRolePendingDelete] = useState<RoleTemplate | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>(currentProjectId || '');
  const [importStatus, setImportStatus] = useState<RoleWorkflowStatus>('draft');
  const [castingWindowStart, setCastingWindowStart] = useState('');
  const [castingWindowEnd, setCastingWindowEnd] = useState('');
  const [importAuditNote, setImportAuditNote] = useState('');

  const TOUCH_TARGET = 44;
  const roleTabAccent = '#f48fb1';
  const roleTabAccentHover = '#f06292';
  const roleTabAccentSoft = 'rgba(244,143,177,0.2)';

  const {
    data: poolRoles = [],
    isLoading: loading,
  } = useQuery({
    queryKey: roleQueryKeys.pool,
    queryFn: rolePoolService.getPoolRoles,
  });

  useEffect(() => {
    return onRoleSyncEvent((event) => {
      if (event.type === 'pool-updated') {
        void queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
      }
    });
  }, [queryClient]);

  const handleDeleteFromPool = (role: RoleTemplate) => {
    setRolePendingDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rolePendingDelete) return;
    const success = await rolePoolService.deleteFromPool(rolePendingDelete.id);
    if (success) {
      await queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
      emitRoleSyncEvent({ type: 'pool-updated', source: 'role-pool-panel' });
    }
    setDeleteDialogOpen(false);
    setRolePendingDelete(null);
  };

  const handleImportClick = (role: RoleTemplate) => {
    setSelectedRole(role);
    setTargetProjectId(currentProjectId || '');
    setImportStatus('draft');
    setCastingWindowStart('');
    setCastingWindowEnd('');
    setImportAuditNote('');
    setImportDialogOpen(true);
  };

  const handleImportConfirm = async () => {
    if (!selectedRole || !targetProjectId) return;

    const newId = await rolePoolService.importToProject(selectedRole.id, targetProjectId, {
      initialStatus: importStatus,
      castingWindow: {
        start: castingWindowStart || undefined,
        end: castingWindowEnd || undefined,
      },
      auditNote: importAuditNote || undefined,
    });

    if (newId) {
      // Enrich imported role locally when backend does not yet persist the options payload.
      try {
        const project = await castingService.getProject(targetProjectId);
        const importedRole = project?.roles?.find((role) => role.id === newId);
        if (importedRole) {
          const rawMetadata = 'metadata' in importedRole ? importedRole.metadata : undefined;
          const metadata = isRecord(rawMetadata) ? rawMetadata : {};
          const existingRoleAudit = Array.isArray(metadata['roleAudit']) ? metadata['roleAudit'] : [];
          const auditEntry = createTemplateImportAuditEntry({
            templateId: selectedRole.id,
            actor: 'role-pool-panel',
            note: importAuditNote || undefined,
          });
          await castingService.saveRole(targetProjectId, {
            ...importedRole,
            status: importStatus,
            metadata: {
              ...metadata,
              castingWindow: {
                start: castingWindowStart || null,
                end: castingWindowEnd || null,
              },
              poolImport: {
                importedAt: new Date().toISOString(),
                importedBy: 'role-pool-panel',
                sourceRolePoolId: selectedRole.id,
                note: importAuditNote || null,
              },
              roleAudit: [...existingRoleAudit, auditEntry],
            },
          });
        }
      } catch (error) {
        console.warn('Imported role overrides could not be persisted:', error);
      }

      setImportDialogOpen(false);
      setSelectedRole(null);
      if (onImport) {
        onImport(newId);
      }
      await queryClient.invalidateQueries({ queryKey: roleQueryKeys.pool });
      await queryClient.invalidateQueries({ queryKey: roleQueryKeys.projectRoles(targetProjectId) });
      emitRoleSyncEvent({
        type: 'pool-imported-to-project',
        source: 'role-pool-panel',
        projectId: targetProjectId,
      });
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRoles = useMemo(() => {
    if (!normalizedQuery) return poolRoles;
    return poolRoles.filter((role) =>
      role.name.toLowerCase().includes(normalizedQuery) ||
      role.roleType?.toLowerCase().includes(normalizedQuery) ||
      role.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  }, [poolRoles, normalizedQuery]);

  const cardStyles = {
    bgcolor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2,
    transition: 'all 0.2s ease',
    '&:hover': {
      bgcolor: 'rgba(255,255,255,0.08)',
      borderColor: roleTabAccentSoft,
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
          <RoleIcon sx={{ color: roleTabAccent }} />
          Rollepool
          <Chip 
            label={poolRoles.length} 
            size="small" 
            sx={{ 
              bgcolor: roleTabAccentSoft,
              color: roleTabAccent,
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
              '&.Mui-focused fieldset': { borderColor: roleTabAccent },
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
                      color: roleTabAccent,
                      fontSize: '0.75rem',
                      minHeight: TOUCH_TARGET,
                      '&:hover': { bgcolor: roleTabAccentSoft },
                    }}
                  >
                    Importer
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteFromPool(role)}
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

          <Stack spacing={2}>
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
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                }}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Workflow-status</InputLabel>
              <Select
                value={importStatus}
                onChange={(e) => setImportStatus(e.target.value as RoleWorkflowStatus)}
                label="Workflow-status"
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                }}
              >
                {ROLE_WORKFLOW_ORDER.map((status) => (
                  <MenuItem key={status} value={status}>
                    {getRoleWorkflowMeta(status).label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Casting fra"
                type="date"
                value={castingWindowStart}
                onChange={(e) => setCastingWindowStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><EventIcon sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 18 }} /></InputAdornment> }}
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                  },
                }}
              />
              <TextField
                label="Casting til"
                type="date"
                value={castingWindowEnd}
                onChange={(e) => setCastingWindowEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{ startAdornment: <InputAdornment position="start"><EventIcon sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 18 }} /></InputAdornment> }}
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                  },
                }}
              />
            </Box>

            <TextField
              label="Audit-notat (valgfritt)"
              value={importAuditNote}
              onChange={(e) => setImportAuditNote(e.target.value)}
              placeholder="f.eks. Importert fra Sci-Fi template for audition sprint"
              multiline
              minRows={2}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                },
              }}
            />
          </Stack>
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
              bgcolor: roleTabAccent,
              color: '#fff',
              '&:hover': { bgcolor: roleTabAccentHover },
              '&.Mui-disabled': { bgcolor: 'rgba(244,143,177,0.3)', color: 'rgba(255,255,255,0.87)' },
            }}
          >
            Importer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setRolePendingDelete(null);
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            minWidth: { xs: '90vw', sm: 420 },
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          Fjern rolle fra pool
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Er du sikker på at du vil fjerne{' '}
            <Box component="span" sx={{ color: roleTabAccent, fontWeight: 700 }}>
              {rolePendingDelete?.name || 'denne rollen'}
            </Box>{' '}
            fra rollepoolen?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setRolePendingDelete(null);
            }}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            startIcon={<DeleteIcon />}
            sx={{
              bgcolor: '#ef4444',
              color: '#fff',
              '&:hover': { bgcolor: '#dc2626' },
            }}
          >
            Fjern
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolePoolPanel;
