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
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  WhatsApp as WhatsAppIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import {
  roleRoomWhatsAppApi,
  type RoleRoomWhatsAppGroupConfig,
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

  const load = useCallback(async () => {
    if (!projectId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomWhatsAppApi.getGroupConfig(projectId);
      setConfig(result);
      if (result) {
        setGroupInviteLink(result.groupInviteLink ?? '');
        setGroupName(result.groupName ?? '');
        setAutoInvite(result.autoInviteEnabled ?? true);
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
