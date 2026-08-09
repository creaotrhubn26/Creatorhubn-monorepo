/**
 * ProposeNewTalentDialog.tsx
 *
 * Phase 7.5 reverse-consent: agency foreslår en skuespiller.
 *
 * GDPR-design (Daniel-krav):
 * - Tydelig info-boks FØR Stella sender: "Skuespilleren får e-post.
 *   De må eksplisitt akseptere før de blir synlige i ditt register.
 *   Ingen data deles før det."
 * - Status-feedback når sendt: "Forslag sendt. Kopier lenken og send selv,
 *   eller vent på at vi sender e-post automatisk."
 * - For BARN under 18: ekstra varsel om at foresatte må samtykke (Phase 8 BankID-flyt)
 */

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type RoleRoomTalentConsentScope,
  type TalentProposal,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';
import { useT } from '../../../../i18n';

interface ProposalResult extends TalentProposal {
  emailSent?: boolean;
  emailReason?: string;
}

interface ProposeNewTalentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (proposal: TalentProposal) => void;
}

export default function ProposeNewTalentDialog({ open, onClose, onCreated }: ProposeNewTalentDialogProps) {
  const { t } = useT();
  const SCOPE_OPTIONS = useMemo<Array<[RoleRoomTalentConsentScope, string, string]>>(() => [
    ['basic_profile', t('propNewTalent.scopeBasicLabel'), t('propNewTalent.scopeBasicDesc')],
    ['media_portfolio', t('propNewTalent.scopeMediaLabel'), t('propNewTalent.scopeMediaDesc')],
    ['contact_info', t('propNewTalent.scopeContactLabel'), t('propNewTalent.scopeContactDesc')],
    ['demographics', t('propNewTalent.scopeDemoLabel'), t('propNewTalent.scopeDemoDesc')],
    ['availability', t('propNewTalent.scopeAvailLabel'), t('propNewTalent.scopeAvailDesc')],
    ['audition_invitations', t('propNewTalent.scopeAuditionLabel'), t('propNewTalent.scopeAuditionDesc')],
  ], [t]);
  const [form, setForm] = useState({
    proposed_email: '',
    proposed_display_name: '',
    proposed_phone: '',
    requested_scopes: ['basic_profile', 'audition_invitations'] as RoleRoomTalentConsentScope[],
    personal_message: '',
    context_role: '',
    minor_acknowledged: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ProposalResult | null>(null);

  const reset = () => {
    setForm({
      proposed_email: '',
      proposed_display_name: '',
      proposed_phone: '',
      requested_scopes: ['basic_profile', 'audition_invitations'],
      personal_message: '',
      context_role: '',
      minor_acknowledged: false,
    });
    setError(null);
    setCreated(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    const result = await roleRoomTalentsService.proposeNewTalent({
      proposed_email: form.proposed_email,
      proposed_display_name: form.proposed_display_name || undefined,
      proposed_phone: form.proposed_phone || undefined,
      requested_scopes: form.requested_scopes,
      personal_message: form.personal_message || undefined,
      context_role: form.context_role || undefined,
    });
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setCreated(result);
    onCreated(result);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: `1px solid ${palette.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800, borderBottom: `1px solid ${palette.borderSubtle}` }}>
        {created ? t('propNewTalent.titleSent') : t('propNewTalent.title')}
      </DialogTitle>
      <DialogContent sx={{ pt: 2.4 }}>
        {created ? (
          <Stack spacing={2}>
            {created.emailSent ? (
              <Alert
                severity="success"
                icon={<EmailOutlinedIcon />}
                sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.success } }}
              >
                <strong>{t('propNewTalent.emailSentTo', { name: form.proposed_display_name || form.proposed_email })}</strong> {t('propNewTalent.emailSentBody')}
              </Alert>
            ) : (
              <Alert
                severity="warning"
                sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.warning } }}
              >
                <strong>{t('propNewTalent.emailNotConfigured')}</strong>{created.emailReason ? ` (${created.emailReason})` : ''}{t('propNewTalent.emailNotConfiguredBody', { email: form.proposed_email })}
              </Alert>
            )}
            <Box sx={{ p: 1.4, borderRadius: radius.sm, bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flexGrow: 1, color: palette.textSecondary, fontSize: '0.82rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {created.acceptUrl}
              </Typography>
              <Tooltip title={t('propNewTalent.copyLink')}>
                <IconButton size="small" onClick={() => navigator.clipboard.writeText(created.acceptUrl || '')} sx={{ color: palette.accentBright }}>
                  <ContentCopyOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
              {t('propNewTalent.statusHint', { name: form.proposed_display_name || t('propNewTalent.themFallback') })}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.4}>
            {/* GDPR INFO — viktig at Stella forstår */}
            <Alert
              severity="info"
              icon={<ShieldOutlinedIcon />}
              sx={{
                bgcolor: 'rgba(168,85,247,0.10)',
                color: palette.textPrimary,
                border: `1px solid ${palette.borderStrong}`,
                '& .MuiAlert-icon': { color: palette.accentBright },
                '& .MuiAlert-message': { width: '100%' },
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', mb: 0.6 }}>{t('propNewTalent.gdprTitle')}</Typography>
              <Typography sx={{ fontSize: '0.84rem', color: palette.textSecondary, lineHeight: 1.55 }}>
                {t('propNewTalent.gdprBody1')}<strong>{t('propNewTalent.gdprBodyStrong')}</strong>{t('propNewTalent.gdprBody2')}
              </Typography>
            </Alert>

            <Stack direction="row" spacing={1.4}>
              <TextField
                fullWidth size="small"
                label={t('propNewTalent.emailLabel')}
                placeholder={t('propNewTalent.emailPlaceholder')}
                value={form.proposed_email}
                onChange={(e) => setForm({ ...form, proposed_email: e.target.value })}
                helperText={t('propNewTalent.emailHelper')}
              />
            </Stack>
            <Stack direction="row" spacing={1.4}>
              <TextField
                fullWidth size="small"
                label={t('propNewTalent.nameLabel')}
                placeholder="Kari Hansen"
                value={form.proposed_display_name}
                onChange={(e) => setForm({ ...form, proposed_display_name: e.target.value })}
              />
              <TextField
                fullWidth size="small"
                label={t('propNewTalent.phoneLabel')}
                placeholder="+47 …"
                value={form.proposed_phone}
                onChange={(e) => setForm({ ...form, proposed_phone: e.target.value })}
              />
            </Stack>

            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>
                {t('propNewTalent.scopesLabel')}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.8}>
                {SCOPE_OPTIONS.map(([scope, label, desc]) => {
                  const selected = form.requested_scopes.includes(scope);
                  return (
                    <Tooltip key={scope} title={desc} placement="top">
                      <Chip
                        label={label}
                        onClick={() => {
                          setForm({
                            ...form,
                            requested_scopes: selected
                              ? form.requested_scopes.filter((s) => s !== scope)
                              : [...form.requested_scopes, scope],
                          });
                        }}
                        sx={{
                          bgcolor: selected ? 'rgba(168,85,247,0.24)' : 'rgba(168,85,247,0.08)',
                          color: selected ? palette.accentBright : palette.textSecondary,
                          border: selected ? `1px solid ${palette.borderStrong}` : `1px solid ${palette.borderSubtle}`,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>

            <TextField
              fullWidth size="small" multiline minRows={2}
              label={t('propNewTalent.messageLabel')}
              placeholder={t('propNewTalent.messagePlaceholder')}
              value={form.personal_message}
              onChange={(e) => setForm({ ...form, personal_message: e.target.value })}
            />
            <TextField
              fullWidth size="small"
              label={t('propNewTalent.roleLabel')}
              placeholder={t('propNewTalent.rolePlaceholder')}
              value={form.context_role}
              onChange={(e) => setForm({ ...form, context_role: e.target.value })}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.minor_acknowledged}
                  onChange={(e) => setForm({ ...form, minor_acknowledged: e.target.checked })}
                />
              }
              label={
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                  {t('propNewTalent.minorLabel')}{' '}
                  <Box component="a" href="https://datatilsynet.no/personvern-pa-ulike-omrader/barn-og-unge/" target="_blank" rel="noreferrer" sx={{ color: palette.accentBright }}>
                    {t('propNewTalent.minorLink')}
                  </Box>
                </Typography>
              }
            />

            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
        <Button onClick={handleClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>
          {created ? t('propNewTalent.closeBtn') : t('propNewTalent.cancelBtn')}
        </Button>
        {!created ? (
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !form.proposed_email || form.requested_scopes.length === 0 || !form.minor_acknowledged}
            startIcon={saving ? <CircularProgress size={14} /> : <PersonAddOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
          >
            {t('propNewTalent.sendBtn')}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
