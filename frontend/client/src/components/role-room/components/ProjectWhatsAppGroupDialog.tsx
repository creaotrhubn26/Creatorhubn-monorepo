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
      setError(err instanceof Error ? err.message : 'Kunne ikke hente prosjekt-gruppe');
    } finally {
      setLoading(false);
    }
  }, [open, projectId]);

  const handleResend = async (crewId: string) => {
    setResendingFor(crewId);
    try {
      await roleRoomWhatsAppApi.resendTeamInvite(projectId, crewId);
      const statuses = await roleRoomWhatsAppApi.getTeamInviteStatus(projectId);
      setInviteStatus(statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resend feilet');
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
      setError('Lim inn invite-lenken først.');
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
      setError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  };

  const handleResendSweep = async () => {
    setSaving(true);
    try {
      await roleRoomWhatsAppApi.triggerTeamInviteSweep();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sweep feilet');
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
        <Typography sx={{ flex: 1, fontWeight: 700 }}>WhatsApp-gruppe for prosjektet</Typography>
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
                Dette prosjektet bruker for øyeblikket bedriftens <strong>workspace-default-gruppe</strong>.
                Sett en lenke under for å overstyre med en prosjekt-spesifikk gruppe.
              </Alert>
            ) : !config ? (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(250,204,21,0.08)', color: '#fde047' }}>
                {workspaceStrategy === 'per_project'
                  ? 'Per-prosjekt-modus aktiv på workspace-nivå. Lim inn invite-lenken for dette prosjektet.'
                  : 'Ingen gruppe konfigurert. Lim inn invite-lenken for å sende WhatsApp-invitasjoner til crew automatisk.'}
              </Alert>
            ) : (
              <Alert
                severity="success"
                sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#86efac' }}
              >
                Prosjekt-spesifikk gruppe aktiv. {workspaceDefaultLink ? 'Workspace-default ignoreres for dette prosjektet.' : ''}
              </Alert>
            )}

            <TextField
              label="WhatsApp gruppe-invite-link"
              value={groupInviteLink}
              onChange={(e) => setGroupInviteLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/AbCdEf123…"
              helperText="Lag gruppen i din egen WhatsApp først, hent invite-lenken via Group info → Invite via link."
              fullWidth
              size="small"
              FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.55)' } }}
              InputProps={{ sx: { color: '#f1f5f9' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
            />

            <TextField
              label="Gruppenavn (valgfritt)"
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
                  <Typography sx={{ fontSize: '0.9rem' }}>Automatisk invitasjon ved tillegg</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
                    Når et nytt crew-medlem legges til prosjektet, sendes WhatsApp-invitasjon med denne lenken.
                  </Typography>
                </Box>
              }
            />

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>
                Hvordan crew opplever det
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
                Når du legger til {`{navn}`} i Crew-listen, sender The Role Room en WhatsApp-melding via bedriftens egen Cloud API:
                <br />
                <Box component="span" sx={{ fontStyle: 'italic', color: '#bfdbfe' }}>
                  "Hei {`{navn}`}, du er lagt til i {`{prosjekt}`}. Bli med i WhatsApp-gruppen → [link]"
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
                  label="✓ Lagret"
                  sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac' }}
                />
                <Button
                  size="small"
                  startIcon={<RefreshIcon fontSize="small" />}
                  onClick={handleResendSweep}
                  disabled={saving}
                  sx={{ color: 'rgba(255,255,255,0.7)' }}
                >
                  Trigge invitasjons-sweep nå
                </Button>
              </Stack>
            ) : null}

            {inviteStatus.length > 0 ? (
              <Box sx={{ pt: 1 }}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>Crew-invitasjoner</Typography>
                  <Chip
                    size="small"
                    icon={<CheckCircleIcon sx={{ color: '#86efac !important', fontSize: 14 }} />}
                    label={`${counts.delivered} levert`}
                    sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#86efac' }}
                  />
                  {counts.pending > 0 ? (
                    <Chip
                      size="small"
                      icon={<PendingIcon sx={{ color: '#fde047 !important', fontSize: 14 }} />}
                      label={`${counts.pending} venter`}
                      sx={{ bgcolor: 'rgba(250,204,21,0.14)', color: '#fde047' }}
                    />
                  ) : null}
                  {counts.failed > 0 ? (
                    <Chip
                      size="small"
                      icon={<ErrorOutlineIcon sx={{ color: '#fecaca !important', fontSize: 14 }} />}
                      label={`${counts.failed} feilet`}
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
                          Forsøk
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
                              <Tooltip title="Send invitasjon på nytt">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleResend(row.crewId)}
                                    disabled={Boolean(resendingFor)}
                                    sx={{ color: '#7dd3fc' }}
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
          Avbryt
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
          {saving ? 'Lagrer…' : 'Lagre prosjekt-gruppe'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectWhatsAppGroupDialog;
