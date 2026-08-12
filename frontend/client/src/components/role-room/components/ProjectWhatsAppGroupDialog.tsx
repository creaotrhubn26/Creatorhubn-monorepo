import { type FC, useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  WhatsApp as WhatsAppIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as PendingIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import {
  roleRoomWhatsAppApi,
  type RoleRoomWhatsAppGroupConfig,
  type RoleRoomTeamInviteStatus,
} from '../services/castingApiService';
import { useT } from '../../../i18n';

type ProjectWhatsAppGroupDialogProps = {
  open: boolean;
  projectId: string;
  /** Workspace-default invite-link, vist som "arvet" når prosjektet ikke har overstyring. */
  workspaceDefaultLink?: string | null;
  workspaceStrategy?: 'workspace' | 'per_project' | null;
  onClose: () => void;
};

const ProjectWhatsAppGroupDialog: FC<ProjectWhatsAppGroupDialogProps> = ({
  open,
  projectId,
  workspaceDefaultLink,
  workspaceStrategy,
  onClose,
}) => {
  const { t } = useT();
  const [config, setConfig] = useState<RoleRoomWhatsAppGroupConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupInviteLink, setGroupInviteLink] = useState('');
  const [groupName, setGroupName] = useState('');
  const [autoInvite, setAutoInvite] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<RoleRoomTeamInviteStatus[]>([]);
  const [resendingFor, setResendingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const [cfg, statuses] = await Promise.all([
        roleRoomWhatsAppApi.getGroupConfig(projectId),
        roleRoomWhatsAppApi.getTeamInviteStatus(projectId).catch(() => [] as RoleRoomTeamInviteStatus[]),
      ]);
      setConfig(cfg);
      setInviteStatus(statuses);
      if (cfg) {
        setGroupInviteLink(cfg.groupInviteLink ?? '');
        setGroupName(cfg.groupName ?? '');
        setAutoInvite(cfg.autoInviteEnabled ?? true);
      } else {
        setGroupInviteLink('');
        setGroupName('');
        setAutoInvite(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('waGroup.errLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [open, projectId, t]);

  const handleResend = async (crewId: string) => {
    setResendingFor(crewId);
    try {
      await roleRoomWhatsAppApi.resendTeamInvite(projectId, crewId);
      const statuses = await roleRoomWhatsAppApi.getTeamInviteStatus(projectId);
      setInviteStatus(statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('waGroup.errResendFailed'));
    } finally {
      setResendingFor(null);
    }
  };

  const counts = inviteStatus.reduce(
    (acc, row) => {
      if (row.deliveryStatus === 'delivered') acc.delivered += 1;
      else if (row.deliveryStatus === 'failed') acc.failed += 1;
      else acc.pending += 1;
      return acc;
    },
    { delivered: 0, pending: 0, failed: 0 },
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (groupInviteLink.trim() === '') {
      setError(t('waGroup.errPasteFirst'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await roleRoomWhatsAppApi.upsertGroupConfig({
        projectId,
        groupInviteLink: groupInviteLink.trim(),
        groupName: groupName.trim() || null,
        autoInviteEnabled: autoInvite,
      });
      setConfig(updated);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('waGroup.errSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleResendSweep = async () => {
    setSaving(true);
    try {
      await roleRoomWhatsAppApi.triggerTeamInviteSweep();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('waGroup.errSweepFailed'));
    } finally {
      setSaving(false);
    }
  };

  const inheritingFromWorkspace =
    !config && workspaceStrategy === 'workspace' && Boolean(workspaceDefaultLink);

  return (
    <Dialog
      open={open}
      onClose={() => (saving ? null : onClose())}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: '#0f1729', color: '#f1f5f9', borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <WhatsAppIcon sx={{ color: '#22c55e' }} />
        <Typography sx={{ flex: 1, fontWeight: 700 }}>{t('waGroup.title')}</Typography>
        <IconButton onClick={onClose} disabled={saving} sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={20} sx={{ color: '#22c55e' }} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            {inheritingFromWorkspace ? (
              <Alert
                severity="info"
                sx={{ bgcolor: 'rgba(125,211,252,0.08)', color: '#bfdbfe' }}
              >
                {t('waGroup.inheritPre')}<strong>{t('waGroup.inheritStrong')}</strong>{t('waGroup.inheritPost')}
              </Alert>
            ) : !config ? (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(250,204,21,0.08)', color: '#fde047' }}>
                {workspaceStrategy === 'per_project'
                  ? t('waGroup.perProjectMode')
                  : t('waGroup.noGroup')}
              </Alert>
            ) : (
              <Alert
                severity="success"
                sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#86efac' }}
              >
                {t('waGroup.activeGroup')} {workspaceDefaultLink ? t('waGroup.wsIgnored') : ''}
              </Alert>
            )}

            <TextField
              label={t('waGroup.linkLabel')}
              value={groupInviteLink}
              onChange={(e) => setGroupInviteLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/AbCdEf123…"
              helperText={t('waGroup.linkHelper')}
              fullWidth
              size="small"
              FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.55)' } }}
              InputProps={{ sx: { color: '#f1f5f9' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
            />

            <TextField
              label={t('waGroup.groupNameLabel')}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Holy Crust Production Team"
              fullWidth
              size="small"
              InputProps={{ sx: { color: '#f1f5f9' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={autoInvite}
                  onChange={(_, checked) => setAutoInvite(checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#22c55e' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#22c55e' },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontSize: '0.9rem' }}>{t('waGroup.autoInviteLabel')}</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
                    {t('waGroup.autoInviteDesc')}
                  </Typography>
                </Box>
              }
            />

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>
                {t('waGroup.crewPreviewTitle')}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: '0.83rem',
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.65,
                }}
              >
                {t('waGroup.crewPreviewIntro')}
                <br />
                <Box component="span" sx={{ fontStyle: 'italic', color: '#bfdbfe' }}>
                  {t('waGroup.crewPreviewMsg')}
                </Box>
              </Box>
            </Box>

            {error ? (
              <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.1)', color: '#fecaca' }}>
                {error}
              </Alert>
            ) : null}

            {savedAt && !saving ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={t('waGroup.savedChip')}
                  sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac' }}
                />
                <Button
                  size="small"
                  startIcon={<RefreshIcon fontSize="small" />}
                  onClick={handleResendSweep}
                  disabled={saving}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  {t('waGroup.triggerSweep')}
                </Button>
              </Stack>
            ) : null}

            {inviteStatus.length > 0 ? (
              <Box sx={{ pt: 1 }}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>{t('waGroup.crewInvitesTitle')}</Typography>
                  <Chip
                    size="small"
                    icon={<CheckCircleIcon sx={{ color: '#86efac !important', fontSize: 14 }} />}
                    label={t('waGroup.deliveredChip', { n: counts.delivered })}
                    sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#86efac' }}
                  />
                  {counts.pending > 0 ? (
                    <Chip
                      size="small"
                      icon={<PendingIcon sx={{ color: '#fde047 !important', fontSize: 14 }} />}
                      label={t('waGroup.pendingChip', { n: counts.pending })}
                      sx={{ bgcolor: 'rgba(250,204,21,0.14)', color: '#fde047' }}
                    />
                  ) : null}
                  {counts.failed > 0 ? (
                    <Chip
                      size="small"
                      icon={<ErrorOutlineIcon sx={{ color: '#fecaca !important', fontSize: 14 }} />}
                      label={t('waGroup.failedChip', { n: counts.failed })}
                      sx={{ bgcolor: 'rgba(248,113,113,0.14)', color: '#fecaca' }}
                    />
                  ) : null}
                </Stack>

                <Box sx={{ maxHeight: 240, overflow: 'auto', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                          Crew
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                          Status
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                          {t('waGroup.colAttempts')}
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottomColor: 'rgba(255,255,255,0.08)' }}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inviteStatus.map((row) => {
                        const isDelivered = row.deliveryStatus === 'delivered';
                        const isFailed = row.deliveryStatus === 'failed';
                        return (
                          <TableRow key={row.crewId}>
                            <TableCell sx={{ borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                              <Typography sx={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#bfdbfe' }}>
                                {row.crewId.slice(0, 8)}…
                              </Typography>
                              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                                {row.recipientPhone || row.recipientEmail || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                              <Chip
                                size="small"
                                label={row.deliveryStatus}
                                sx={{
                                  bgcolor: isDelivered
                                    ? 'rgba(34,197,94,0.18)'
                                    : isFailed
                                      ? 'rgba(248,113,113,0.18)'
                                      : 'rgba(250,204,21,0.18)',
                                  color: isDelivered ? '#86efac' : isFailed ? '#fecaca' : '#fde047',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                }}
                              />
                              {row.deliveryError ? (
                                <Tooltip title={row.deliveryError}>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#fecaca', mt: 0.4 }}>
                                    {row.deliveryError.slice(0, 40)}…
                                  </Typography>
                                </Tooltip>
                              ) : null}
                            </TableCell>
                            <TableCell sx={{ borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
                                {row.retryCount}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                              <Tooltip title={t('waGroup.resendTooltip')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleResend(row.crewId)}
                                    disabled={Boolean(resendingFor)}
                                    sx={{ color: 'var(--role-cyan, #7dd3fc)' }}
                                  >
                                    {resendingFor === row.crewId ? (
                                      <CircularProgress size={14} />
                                    ) : (
                                      <SendIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            ) : null}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('waGroup.cancelBtn')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#0f1729' }} /> : <SaveIcon />}
          sx={{
            bgcolor: '#22c55e',
            color: '#0f1729',
            fontWeight: 700,
            '&:hover': { bgcolor: '#34d399' },
          }}
        >
          {saving ? t('waGroup.saving') : t('waGroup.saveBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectWhatsAppGroupDialog;
