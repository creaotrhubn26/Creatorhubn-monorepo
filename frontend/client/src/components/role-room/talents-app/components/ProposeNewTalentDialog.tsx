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
import { useState } from 'react';

import roleRoomTalentsService, {
  type RoleRoomTalentConsentScope,
  type TalentProposal,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

const SCOPE_OPTIONS: Array<[RoleRoomTalentConsentScope, string, string]> = [
  ['basic_profile', 'Basis', 'Navn, by, bio'],
  ['media_portfolio', 'Media', 'Headshot, showreel, CV'],
  ['contact_info', 'Kontakt', 'E-post, telefon'],
  ['demographics', 'Demografi', 'Alder, høyde, kjønn'],
  ['availability', 'Tilgjengelighet', 'Når kan de jobbe'],
  ['audition_invitations', 'Audition-invites', 'Du kan sende roller direkte'],
];

interface ProposeNewTalentDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (proposal: TalentProposal) => void;
}

export default function ProposeNewTalentDialog({ open, onClose, onCreated }: ProposeNewTalentDialogProps) {
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
  const [created, setCreated] = useState<TalentProposal | null>(null);

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
        {created ? '✓ Forslag sendt — venter på godkjenning' : 'Foreslå ny skuespiller'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2.4 }}>
        {created ? (
          <Stack spacing={2}>
            <Alert
              severity="success"
              sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: palette.textPrimary, '& .MuiAlert-icon': { color: palette.success } }}
            >
              <strong>{form.proposed_display_name || form.proposed_email}</strong> får forslaget — de må eksplisitt godkjenne før profilen vises i ditt register.
            </Alert>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem' }}>
              <strong>Vi sender ikke e-post automatisk ennå.</strong> Kopier lenken under og send den til {form.proposed_email} selv (SMS, WhatsApp, eller e-post). Dette blir automatisk i en kommende oppdatering.
            </Typography>
            <Box sx={{ p: 1.4, borderRadius: radius.sm, bgcolor: palette.bgCardElevated, border: `1px solid ${palette.borderSubtle}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ flexGrow: 1, color: palette.textSecondary, fontSize: '0.82rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {created.acceptUrl}
              </Typography>
              <Tooltip title="Kopier">
                <IconButton size="small" onClick={() => navigator.clipboard.writeText(created.acceptUrl || '')} sx={{ color: palette.accentBright }}>
                  <ContentCopyOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Button
              href={`mailto:${form.proposed_email}?subject=${encodeURIComponent('Forespørsel om å bli lagt til i casting-registret')}&body=${encodeURIComponent(`Hei,\n\nVi vil gjerne legge deg til i vårt casting-register på The Role Room. Du må selv godkjenne dette — vi henter ingen data uten ditt samtykke.\n\nKlikk lenken under for å se hva du blir bedt om å dele og bestemme deg:\n\n${created.acceptUrl}\n\nLenken er gyldig i 30 dager.\n\nMvh`)}`}
              startIcon={<EmailOutlinedIcon />}
              sx={{
                textTransform: 'none', fontWeight: 600, py: 1, borderRadius: radius.sm,
                color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`,
                '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
              }}
            >
              Åpne i e-post
            </Button>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
              Status vises i "Mine forslag" — du får varsel her når talenten har svart.
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
              <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', mb: 0.6 }}>GDPR-regler for forslag</Typography>
              <Typography sx={{ fontSize: '0.84rem', color: palette.textSecondary, lineHeight: 1.55 }}>
                Skuespilleren får e-post med klar info om hvem du er, hvilke data du ber om, og en lenke. <strong>Profilen blir IKKE synlig i ditt register før de eksplisitt har godkjent.</strong> Vi deler ingen data før det. Forslaget utløper etter 30 dager om de ikke svarer.
              </Typography>
            </Alert>

            <Stack direction="row" spacing={1.4}>
              <TextField
                fullWidth size="small"
                label="E-post (påkrevd)"
                placeholder="kari@eksempel.no"
                value={form.proposed_email}
                onChange={(e) => setForm({ ...form, proposed_email: e.target.value })}
                helperText="Til denne adressen sender vi godkjennings-lenken"
              />
            </Stack>
            <Stack direction="row" spacing={1.4}>
              <TextField
                fullWidth size="small"
                label="Navn (valgfritt)"
                placeholder="Kari Hansen"
                value={form.proposed_display_name}
                onChange={(e) => setForm({ ...form, proposed_display_name: e.target.value })}
              />
              <TextField
                fullWidth size="small"
                label="Telefon (valgfritt)"
                placeholder="+47 …"
                value={form.proposed_phone}
                onChange={(e) => setForm({ ...form, proposed_phone: e.target.value })}
              />
            </Stack>

            <Box>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>
                Hva ber du om tilgang til? (skuespilleren ser dette og bestemmer)
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
              label="Personlig melding (valgfritt)"
              placeholder="Eks: Hei Kari, vi caster en hovedrolle for en serie og tror du passer perfekt."
              value={form.personal_message}
              onChange={(e) => setForm({ ...form, personal_message: e.target.value })}
            />
            <TextField
              fullWidth size="small"
              label="Rolle/produksjon (valgfritt)"
              placeholder="Eks: Hovedrolle i NRK-serie 'Vinterland'"
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
                  Jeg bekrefter at hvis dette gjelder en mindreårig (under 18), vil jeg sende parallellt forslag til foresatte og vente på begge godkjennelser.{' '}
                  <Box component="a" href="https://datatilsynet.no/personvern-pa-ulike-omrader/barn-og-unge/" target="_blank" rel="noreferrer" sx={{ color: palette.accentBright }}>
                    Les mer
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
          {created ? 'Lukk' : 'Avbryt'}
        </Button>
        {!created ? (
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !form.proposed_email || form.requested_scopes.length === 0 || !form.minor_acknowledged}
            startIcon={saving ? <CircularProgress size={14} /> : <PersonAddOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
          >
            Send forslag
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
