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
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  TheaterComedy as RoleIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { rolePoolService } from '../services/rolePoolService';
import type { CastingProject } from '../models/casting';
import { castingService } from '../services/castingService';
import type { RoleWorkflowStatus} from '../config/roleWorkflow';
import { ROLE_WORKFLOW_ORDER, getRoleWorkflowMeta } from '../config/roleWorkflow';
import { emitRoleSyncEvent, onRoleSyncEvent } from '../services/roleSyncEvents';
import { roleQueryKeys } from '../services/roleQueryKeys';
import type { RoleTemplate} from '../config/roleDomain';
import { createTemplateImportAuditEntry } from '../config/roleDomain';
import { Z_INDEX } from '../config/zIndex';
import GlobalMentionHelper from './shared/GlobalMentionHelper';

interface RolePoolPanelProps {
  projects: CastingProject[];
  currentProjectId?: string;
  onImport?: (roleId: string) => void;
}

type WorkspaceView = 'standard' | 'pro';

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('standard');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const mentionCandidates = useMemo(() => {
    const pool = new Set<string>();
    if (selectedRole?.name?.trim()) pool.add(selectedRole.name.trim());
    projects.forEach((project) => {
      if (project?.name?.trim()) pool.add(project.name.trim());
    });
    pool.add('Casting');
    pool.add('Audit');
    return Array.from(pool);
  }, [projects, selectedRole?.name]);

  const TOUCH_TARGET = 44;
  const roleTabAccent = '#b86bff';
  const roleTabAccentHover = '#a855f7';
  const roleTabAccentSoft = 'rgba(184,107,255,0.24)';
  const roleSurface = 'rgba(20,14,48,0.84)';
  const roleSurfaceMuted = 'rgba(33,24,70,0.72)';
  const roleBorder = 'rgba(184,107,255,0.32)';
  const roleText = '#f3eaff';
  const roleTextMuted = 'rgba(220,205,255,0.82)';
  const rolePanelBackdrop = "url('/role-room-assets/role_panel_backdrop.webp')";
  const roleTexture =
    `linear-gradient(180deg, rgba(9,6,26,0.9) 0%, rgba(10,7,30,0.92) 100%), radial-gradient(circle at 18% -25%, rgba(184,107,255,0.3), transparent 55%), radial-gradient(circle at 82% -10%, rgba(106,76,207,0.28), transparent 46%), ${rolePanelBackdrop}`;

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

  useEffect(() => {
    if (filteredRoles.length === 0) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId((prev) => {
      if (prev && filteredRoles.some((role) => role.id === prev)) {
        return prev;
      }
      return filteredRoles[0].id;
    });
  }, [filteredRoles]);

  const selectedTemplate = useMemo(() => {
    if (filteredRoles.length === 0) return null;
    if (!selectedTemplateId) return filteredRoles[0];
    return filteredRoles.find((role) => role.id === selectedTemplateId) ?? filteredRoles[0];
  }, [filteredRoles, selectedTemplateId]);

  const cardStyles = {
    bgcolor: roleSurface,
    border: `1px solid ${roleBorder}`,
    borderRadius: 2.25,
    transition: 'all 0.2s ease',
    '&:hover': {
      bgcolor: 'rgba(41,30,86,0.86)',
      borderColor: roleTabAccentSoft,
      transform: 'translateY(-1px)',
      boxShadow: '0 8px 18px rgba(0,0,0,0.24)',
    },
  };

  const getRoleTypeColor = (type?: string): string => {
    switch (type?.toLowerCase()) {
      case 'hovedrolle': return '#f59e0b';
      case 'birolle': return '#8f6b52';
      case 'statist': return '#6b7280';
      default: return '#b86bff';
    }
  };

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 2.5,
        border: `1px solid ${roleBorder}`,
        background: roleTexture,
        backgroundSize: 'auto, auto, auto, cover',
        backgroundPosition: 'center, center, center, center',
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
        boxShadow: '0 18px 44px rgba(0,0,0,0.34)',
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        mb: 3,
        gap: 2,
        px: { xs: 1.25, sm: 1.5 },
        py: { xs: 1, sm: 1.25 },
        borderRadius: 2,
        border: `1px solid ${roleBorder}`,
        bgcolor: roleSurfaceMuted,
        boxShadow: '0 8px 22px rgba(0,0,0,0.2)',
      }}>
        <Typography variant="h6" sx={{ 
          color: roleText, 
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
                <SearchIcon sx={{ color: roleTextMuted }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: '100%', sm: 300 },
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.04)',
              color: roleText,
              '& fieldset': { borderColor: roleBorder },
              '&:hover fieldset': { borderColor: roleTabAccentSoft },
              '&.Mui-focused fieldset': { borderColor: roleTabAccent },
            },
            '& .MuiInputBase-input::placeholder': { color: roleTextMuted },
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: roleTextMuted, mb: 3 }}>
        Global rollepool - gjenbruk rollebeskrivelser på tvers av prosjekter.
        Lagre roller til poolen fra prosjekter, eller importer fra poolen til nye prosjekter.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
          mb: 2,
          p: 1,
          bgcolor: roleSurfaceMuted,
          borderRadius: 1.5,
          border: `1px solid ${roleBorder}`,
        }}
      >
        <Typography sx={{ color: roleTextMuted, fontSize: '0.875rem', mr: 1 }}>
          Visning:
        </Typography>
        <Button
          variant={workspaceView === 'standard' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setWorkspaceView('standard')}
          sx={{
            minHeight: 36,
            bgcolor: workspaceView === 'standard' ? roleTabAccentSoft : 'transparent',
            color: workspaceView === 'standard' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: workspaceView === 'standard' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: workspaceView === 'standard' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Standard
        </Button>
        <Button
          variant={workspaceView === 'pro' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setWorkspaceView('pro')}
          sx={{
            minHeight: 36,
            bgcolor: workspaceView === 'pro' ? roleTabAccentSoft : 'transparent',
            color: workspaceView === 'pro' ? roleTabAccent : 'rgba(255,255,255,0.7)',
            borderColor: workspaceView === 'pro' ? roleTabAccent : roleBorder,
            '&:hover': {
              bgcolor: workspaceView === 'pro' ? 'rgba(184,107,255,0.28)' : 'rgba(255,255,255,0.06)',
            },
          }}
        >
          Pro-visning
        </Button>
      </Box>

      {workspaceView === 'pro' && (
        loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography sx={{ color: roleTextMuted }}>Laster roller...</Typography>
          </Box>
        ) : filteredRoles.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              bgcolor: roleSurfaceMuted,
              borderRadius: 2,
              border: `1px dashed ${roleBorder}`,
              mb: 2.5,
            }}
          >
            <RoleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
            <Typography sx={{ color: roleText, mb: 1 }}>
              {searchQuery ? 'Ingen roller matcher søket' : 'Ingen roller i poolen ennå'}
            </Typography>
            <Typography variant="body2" sx={{ color: roleTextMuted }}>
              Lagre roller fra prosjekter for å fylle poolen
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) 360px' },
              gap: 2,
              minHeight: { xs: 'auto', lg: 540 },
              mb: 2.5,
            }}
          >
            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.25,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.1rem', px: 0.5, py: 0.25 }}>
                Rollemaler
              </Typography>
              <Box sx={{ overflowY: 'auto', maxHeight: { xs: 380, lg: 520 }, pr: 0.5 }}>
                <Stack spacing={1}>
                  {filteredRoles.map((role) => {
                    const isSelected = selectedTemplateId === role.id;
                    return (
                      <Card
                        key={role.id}
                        onClick={() => setSelectedTemplateId(role.id)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: isSelected ? 'rgba(184,107,255,0.16)' : roleSurfaceMuted,
                          border: isSelected ? `1px solid ${roleTabAccent}` : `1px solid ${roleBorder}`,
                          borderRadius: 1.5,
                          '&:hover': { borderColor: roleTabAccentSoft },
                        }}
                      >
                        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1,
                                bgcolor: `${getRoleTypeColor(role.roleType)}25`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <RoleIcon sx={{ color: getRoleTypeColor(role.roleType), fontSize: 20 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ color: roleText, fontWeight: 700 }} noWrap>
                                {role.name}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, flexWrap: 'wrap' }}>
                                {role.roleType && (
                                  <Chip
                                    label={role.roleType}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      bgcolor: `${getRoleTypeColor(role.roleType)}22`,
                                      color: getRoleTypeColor(role.roleType),
                                    }}
                                  />
                                )}
                                {role.tags && role.tags.length > 0 && (
                                  <Chip
                                    label={`${role.tags.length} tags`}
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(184,107,255,0.2)', color: roleTabAccent }}
                                  />
                                )}
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.25 }}>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleImportClick(role);
                                }}
                                sx={{ color: roleTabAccent, minWidth: 30, minHeight: 30 }}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteFromPool(role);
                                }}
                                sx={{ color: roleTextMuted, minWidth: 30, minHeight: 30 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                border: `1px solid ${roleBorder}`,
                borderRadius: 2,
                bgcolor: roleSurface,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
              }}
            >
              {selectedTemplate ? (
                <>
                  <Typography sx={{ color: roleText, fontWeight: 700, fontSize: '1.35rem', lineHeight: 1.2 }}>
                    {selectedTemplate.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {selectedTemplate.roleType && (
                      <Chip
                        label={selectedTemplate.roleType}
                        sx={{
                          bgcolor: `${getRoleTypeColor(selectedTemplate.roleType)}22`,
                          color: getRoleTypeColor(selectedTemplate.roleType),
                          fontWeight: 700,
                        }}
                      />
                    )}
                    <Chip
                      label={`${selectedTemplate.tags?.length ?? 0} tags`}
                      sx={{ bgcolor: roleTabAccentSoft, color: roleTabAccent }}
                    />
                  </Box>
                  <Typography sx={{ color: roleTextMuted, fontSize: '0.92rem', minHeight: 48 }}>
                    {selectedTemplate.description || 'Ingen beskrivelse lagt inn.'}
                  </Typography>
                  <Box>
                    <Typography sx={{ color: roleText, fontWeight: 600, mb: 0.75 }}>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {selectedTemplate.tags && selectedTemplate.tags.length > 0 ? selectedTemplate.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{ bgcolor: roleTabAccentSoft, color: roleTabAccent }}
                        />
                      )) : (
                        <Typography sx={{ color: roleTextMuted, fontSize: '0.85rem' }}>Ingen tags satt</Typography>
                      )}
                    </Box>
                  </Box>
                  <Divider sx={{ borderColor: roleBorder }} />
                  <Stack spacing={1}>
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ color: roleTextMuted }}>Prosjekt</InputLabel>
                      <Select
                        value={targetProjectId}
                        onChange={(event) => setTargetProjectId(event.target.value)}
                        label="Prosjekt"
                        MenuProps={{ PaperProps: { sx: { zIndex: Z_INDEX.dialogSelect } } }}
                        sx={{
                          color: roleText,
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
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
                    <FormControl fullWidth size="small">
                      <InputLabel sx={{ color: roleTextMuted }}>Status</InputLabel>
                      <Select
                        value={importStatus}
                        onChange={(event) => setImportStatus(event.target.value as RoleWorkflowStatus)}
                        label="Status"
                        MenuProps={{ PaperProps: { sx: { zIndex: Z_INDEX.dialogSelect } } }}
                        sx={{
                          color: roleText,
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={() => handleImportClick(selectedTemplate)}
                        sx={{
                          bgcolor: roleTabAccent,
                          color: '#160a24',
                          fontWeight: 700,
                          '&:hover': { bgcolor: roleTabAccentHover },
                        }}
                      >
                        Importer
                      </Button>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => handleDeleteFromPool(selectedTemplate)}
                        sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                      >
                        Slett
                      </Button>
                    </Box>
                  </Stack>
                </>
              ) : (
                <Typography sx={{ color: roleTextMuted }}>Velg en mal for detaljer.</Typography>
              )}
            </Box>
          </Box>
        )
      )}

      {workspaceView === 'standard' && (loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Typography sx={{ color: roleTextMuted }}>Laster roller...</Typography>
        </Box>
      ) : filteredRoles.length === 0 ? (
        <Box sx={{ 
          textAlign: 'center', 
          py: 6, 
          bgcolor: roleSurfaceMuted,
          borderRadius: 2,
          border: `1px dashed ${roleBorder}`,
        }}>
          <RoleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
          <Typography sx={{ color: roleText, mb: 1 }}>
            {searchQuery ? 'Ingen roller matcher søket' : 'Ingen roller i poolen ennå'}
          </Typography>
          <Typography variant="body2" sx={{ color: roleTextMuted }}>
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
          gap: { xs: 1.5, sm: 2, md: 2.25 },
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
                      color: roleText, 
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
                      color: roleTextMuted,
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
                          bgcolor: 'rgba(184,107,255,0.26)',
                          color: '#b86bff',
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
                          bgcolor: 'rgba(255,255,255,0.08)',
                          color: roleTextMuted,
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
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      minHeight: TOUCH_TARGET,
                      borderRadius: 1.25,
                      border: `1px solid ${roleBorder}`,
                      px: 1.25,
                      '&:hover': { bgcolor: roleTabAccentSoft },
                    }}
                  >
                    Importer
                  </Button>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteFromPool(role)}
                    sx={{
                      color: roleTextMuted,
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
      ))}

      <Dialog 
        open={importDialogOpen} 
        onClose={() => setImportDialogOpen(false)}
        sx={{ zIndex: Z_INDEX.dialog }}
        slotProps={{ backdrop: { sx: { zIndex: Z_INDEX.backdrop } } }}
        PaperProps={{
          sx: {
            bgcolor: roleSurface,
            border: `1px solid ${roleBorder}`,
            minWidth: { xs: '90vw', sm: 400 },
            zIndex: Z_INDEX.dialog,
          },
        }}
      >
        <DialogTitle sx={{ color: roleText, borderBottom: `1px solid ${roleBorder}` }}>
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
                    <Typography variant="body2" sx={{ color: roleTextMuted }}>
                      {selectedRole.roleType}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: roleTextMuted }}>Velg prosjekt</InputLabel>
              <Select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                label="Velg prosjekt"
                MenuProps={{ PaperProps: { sx: { zIndex: Z_INDEX.dialogSelect } } }}
                sx={{
                  color: roleText,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
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
              <InputLabel sx={{ color: roleTextMuted }}>Workflow-status</InputLabel>
              <Select
                value={importStatus}
                onChange={(e) => setImportStatus(e.target.value as RoleWorkflowStatus)}
                label="Workflow-status"
                MenuProps={{ PaperProps: { sx: { zIndex: Z_INDEX.dialogSelect } } }}
                sx={{
                  color: roleText,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
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
                  '& .MuiInputLabel-root': { color: roleTextMuted },
                  '& .MuiOutlinedInput-root': {
                    color: roleText,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
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
                  '& .MuiInputLabel-root': { color: roleTextMuted },
                  '& .MuiOutlinedInput-root': {
                    color: roleText,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                  },
                }}
              />
            </Box>

            <TextField
              label="Audit-notat (valgfritt)"
              value={importAuditNote}
              onChange={(e) => setImportAuditNote(e.target.value)}
              placeholder="f.eks. Importert fra Sci-Fi-mal for audition-sprint"
              multiline
              minRows={2}
              sx={{
                '& .MuiInputLabel-root': { color: roleTextMuted },
                '& .MuiOutlinedInput-root': {
                  color: roleText,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: roleBorder },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccentSoft },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: roleTabAccent },
                },
              }}
            />
            <GlobalMentionHelper
              text={importAuditNote}
              localCandidates={mentionCandidates}
              onApplySuggestion={(name) => setImportAuditNote((prev) => applyMentionSuggestion(prev, name))}
              autoTagTitle="Auto-tagget i notat"
              suggestionTitle="Mener du?"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${roleBorder}`, p: 2 }}>
          <Button 
            onClick={() => setImportDialogOpen(false)}
            sx={{ color: roleTextMuted }}
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
              color: '#160a24',
              '&:hover': { bgcolor: roleTabAccentHover },
              '&.Mui-disabled': { bgcolor: 'rgba(184,107,255,0.34)', color: 'rgba(255,255,255,0.87)' },
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
        sx={{ zIndex: Z_INDEX.dialog }}
        slotProps={{ backdrop: { sx: { zIndex: Z_INDEX.backdrop } } }}
        PaperProps={{
          sx: {
            bgcolor: roleSurface,
            border: `1px solid ${roleBorder}`,
            minWidth: { xs: '90vw', sm: 420 },
            zIndex: Z_INDEX.dialog,
          },
        }}
      >
        <DialogTitle sx={{ color: roleText, borderBottom: `1px solid ${roleBorder}` }}>
          Fjern rolle fra pool
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ color: roleTextMuted }}>
            Er du sikker på at du vil fjerne{' '}
            <Box component="span" sx={{ color: roleTabAccent, fontWeight: 700 }}>
              {rolePendingDelete?.name || 'denne rollen'}
            </Box>{' '}
            fra rollepoolen?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${roleBorder}`, p: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setRolePendingDelete(null);
            }}
            sx={{ color: roleTextMuted }}
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
