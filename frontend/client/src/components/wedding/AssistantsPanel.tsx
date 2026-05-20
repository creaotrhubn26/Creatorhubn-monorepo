// @ts-nocheck
/**
 * AssistantsPanel — Slice 9X.44 + 9X.45/46/48/49/50
 *
 * Stine forvalter assistent-fotografer for bryllup:
 *   - Liste over inviterte + aksepterte med per-rad badges
 *     (nye Drive-filer, brief booket, kontrakt signert, GDPR-status)
 *   - Detaljer-knapp åpner AssistantDetailDialog
 *   - Invite-dialog (ekstern e-post primært; intern-bruker også støttet)
 *   - Profit-split-oversikt etter faktura er lagret
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Chip,
  Box,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  List,
  ListItem,
  Divider,
  Badge,
} from '@mui/material';
import {
  PeopleAlt as TeamIcon,
  PersonAdd as InviteIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  CheckCircle as AcceptedIcon,
  HourglassEmpty as PendingIcon,
  Cancel as DeclinedIcon,
  Settings as DetailsIcon,
  CloudUpload as DriveIcon,
  EventNote as BriefIcon,
  Gavel as ContractIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/utils/ga4-client-tracking';
import { assistantEvents } from '@/utils/creatorhub-events';
import AssistantDetailDialog from './AssistantDetailDialog';

interface Assistant {
  id: string;
  assistantUserId: string | null;
  assistantEmail: string | null;
  assistantName: string | null;
  role: string;
  compensationType: 'hourly' | 'fixed' | 'percentage';
  compensationValue: number | null;
  sharePct: number | null;
  status: 'invited' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  // Drive
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  driveFolderSetupAt: string | null;
  lastKnownFileCount: number | null;
  newFilesSinceViewed: number;
  lastNewFilesAt: string | null;
  // Sub-kontrakt
  subcontractSignedAt: string | null;
  subcontractSignerName: string | null;
  // Brief
  briefMeetingUrl: string | null;
  briefMeetingAt: string | null;
  briefMeetingDurationMin: number | null;
  briefSummarizedAt: string | null;
  // GDPR
  gdprConsentAt: string | null;
  gdprDeleteRequestedAt: string | null;
  gdprAnonymizedAt: string | null;
}

interface ProfitSplit {
  invoiceTotalKr: number;
  invoiceSubtotalKr: number;
  assistantSplits: Array<{
    assistantId: string;
    assistantName: string;
    role: string;
    basis: string;
    shareKr: number;
  }>;
  primaryPhotographerKr: number;
  primaryPhotographerNote: string;
  message?: string;
}

const ROLE_LABELS: Record<string, string> = {
  primary: 'Hovedfotograf',
  assistant: 'Assistent',
  second_shooter: 'Second shooter',
  video: 'Video',
  misc: 'Annet',
};

const COMP_LABELS: Record<string, string> = {
  hourly: 'Pr. time',
  fixed: 'Fast sum',
  percentage: 'Prosent',
};

const statusChip = (status: string) => {
  if (status === 'accepted' || status === 'completed') {
    return <Chip size="small" icon={<AcceptedIcon fontSize="small" />} label="Akseptert" color="success" />;
  }
  if (status === 'declined' || status === 'cancelled') {
    return <Chip size="small" icon={<DeclinedIcon fontSize="small" />} label="Avslått" color="error" />;
  }
  return <Chip size="small" icon={<PendingIcon fontSize="small" />} label="Venter svar" />;
};

const AssistantsPanel: React.FC<{ weddingId: string }> = ({ weddingId }) => {
  const [list, setList] = useState<Assistant[]>([]);
  const [profitSplit, setProfitSplit] = useState<ProfitSplit | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<Assistant | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [a, p]: any[] = await Promise.all([
        apiRequest(`/api/wedding/${weddingId}/assistants`),
        apiRequest(`/api/wedding/${weddingId}/profit-split`).catch(() => null),
      ]);
      setList(a.assistants || []);
      setProfitSplit(p);
    } catch {
      // Stille
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [weddingId]);

  // Lytt på nudgen ("Inviter assistent" fra AssistantNeedsNudge)
  useEffect(() => {
    const onOpen = (ev: any) => {
      if (!ev?.detail || ev.detail.weddingId === weddingId) {
        setInviteOpen(true);
      }
    };
    window.addEventListener('open-assistant-invite', onOpen as any);
    return () => window.removeEventListener('open-assistant-invite', onOpen as any);
  }, [weddingId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Fjerne denne assistenten?')) return;
    try {
      await apiRequest(`/api/wedding/${weddingId}/assistants/${id}`, { method: 'DELETE' });
      reload();
    } catch { /* ignore */ }
  };

  return (
    <Card variant="outlined" data-assistants-panel>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TeamIcon color="primary" />
            <Typography variant="h6">Assistenter</Typography>
          </Stack>
          <Button startIcon={<InviteIcon />} variant="contained" size="small" onClick={() => setInviteOpen(true)}>
            Inviter
          </Button>
        </Stack>

        {loading && <CircularProgress size={20} />}

        {!loading && list.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Ingen assistenter ennå. Inviter for store bryllup (200+ gjester eller flere lokasjoner samtidig).
          </Typography>
        )}

        {!loading && list.length > 0 && (
          <List dense disablePadding>
            {list.map((a) => (
              <ListItem
                key={a.id}
                disableGutters
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Detaljer (Drive, brief, personvern)">
                      <IconButton size="small" onClick={() => setDetailFor(a)}>
                        <Badge
                          color="warning"
                          variant="dot"
                          invisible={!(a.newFilesSinceViewed > 0)}
                        >
                          <DetailsIcon fontSize="small" />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => handleDelete(a.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <Box sx={{ flex: 1, pr: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2"><b>{a.assistantName || a.assistantEmail || 'Uten navn'}</b></Typography>
                    <Chip size="small" label={ROLE_LABELS[a.role] || a.role} variant="outlined" />
                    {statusChip(a.status)}
                    {a.subcontractSignedAt && (
                      <Tooltip title={`Sub-kontrakt signert ${new Date(a.subcontractSignedAt).toLocaleDateString('nb-NO')}`}>
                        <Chip size="small" icon={<ContractIcon fontSize="small" />} label="Signert" color="success" variant="outlined" />
                      </Tooltip>
                    )}
                    {a.driveFolderId && (
                      <Tooltip title={`${a.lastKnownFileCount ?? 0} filer i delt Drive-mappe`}>
                        <Chip
                          size="small"
                          icon={<DriveIcon fontSize="small" />}
                          label={
                            a.newFilesSinceViewed > 0
                              ? `${a.lastKnownFileCount ?? 0} (+${a.newFilesSinceViewed} nye)`
                              : `${a.lastKnownFileCount ?? 0}`
                          }
                          color={a.newFilesSinceViewed > 0 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </Tooltip>
                    )}
                    {a.briefMeetingAt && (
                      <Tooltip title={`Brief ${new Date(a.briefMeetingAt).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}`}>
                        <Chip size="small" icon={<BriefIcon fontSize="small" />} label="Brief" variant="outlined" />
                      </Tooltip>
                    )}
                    {a.gdprDeleteRequestedAt && !a.gdprAnonymizedAt && (
                      <Chip size="small" color="warning" label="Sletteforespørsel" variant="outlined" />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {COMP_LABELS[a.compensationType]}{' '}
                    {a.compensationType === 'percentage'
                      ? `: ${a.sharePct ?? '?'}%`
                      : `: ${a.compensationValue ?? '?'} kr${a.compensationType === 'hourly' ? '/t' : ''}`}
                    {a.assistantEmail && ` · ${a.assistantEmail}`}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        )}

        {profitSplit && profitSplit.assistantSplits.length > 0 && !profitSplit.message && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Profit-split (basert på siste faktura)</Typography>
            <Stack spacing={0.5}>
              {profitSplit.assistantSplits.map((s) => (
                <Stack key={s.assistantId} direction="row" justifyContent="space-between">
                  <Typography variant="body2">
                    {s.assistantName} <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>· {s.basis}</Box>
                  </Typography>
                  <Typography variant="body2"><b>{s.shareKr.toFixed(0)} kr</b></Typography>
                </Stack>
              ))}
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2"><b>Din andel</b></Typography>
                <Typography variant="body2" color="success.main">
                  <b>{profitSplit.primaryPhotographerKr.toFixed(0)} kr</b>
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {profitSplit.primaryPhotographerNote}
              </Typography>
            </Stack>
          </>
        )}

        {profitSplit?.message && (
          <Alert severity="info" sx={{ mt: 1 }}>{profitSplit.message}</Alert>
        )}
      </CardContent>

      <InviteAssistantDialog
        open={inviteOpen}
        weddingId={weddingId}
        onClose={() => setInviteOpen(false)}
        onInvited={(msg) => { setSnack(msg); reload(); setInviteOpen(false); }}
      />

      <AssistantDetailDialog
        open={detailFor !== null}
        onClose={() => setDetailFor(null)}
        weddingId={weddingId}
        assistant={detailFor}
        onChanged={reload}
      />
    </Card>
  );
};

interface InviteDialogProps {
  open: boolean;
  weddingId: string;
  onClose: () => void;
  onInvited: (msg: string) => void;
}

const InviteAssistantDialog: React.FC<InviteDialogProps> = ({ open, weddingId, onClose, onInvited }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('assistant');
  const [compType, setCompType] = useState<'hourly' | 'fixed' | 'percentage'>('fixed');
  const [compValue, setCompValue] = useState('');
  const [sharePct, setSharePct] = useState('');
  const [inviteToCreatorhubn, setInviteToCreatorhubn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail(''); setName(''); setPhone('');
    setRole('assistant'); setCompType('fixed');
    setCompValue(''); setSharePct('');
    setInviteToCreatorhubn(false);
    setInviteUrl(null); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!email.trim()) { setError('E-post påkrevd'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/assistants`, {
        method: 'POST',
        body: {
          assistantEmail: email.trim(),
          assistantName: name.trim() || undefined,
          assistantPhone: phone.trim() || undefined,
          role,
          compensationType: compType,
          compensationValue: compType !== 'percentage' && compValue ? parseFloat(compValue) : undefined,
          sharePct: compType === 'percentage' && sharePct ? parseFloat(sharePct) : undefined,
          inviteToCreatorhubn,
        },
      });
      // GA4: stine sendte invitasjon + om hun valgte å pushe referral
      trackEvent('assistant_invite_sent', {
        role,
        compensation_type: compType,
        referral_offered: inviteToCreatorhubn,
      });
      assistantEvents.invited(weddingId, email.trim());
      const url = r.inviteUrl ? `${window.location.origin}${r.inviteUrl}` : null;
      setInviteUrl(url);
      if (!url) {
        onInvited(`Invitert: ${r.assistant.assistantName || email}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Invitering feilet');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* ignore */ }
    onInvited('Lenke kopiert — del med assistenten via SMS eller e-post');
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Inviter assistent</DialogTitle>
      <DialogContent dividers>
        {!inviteUrl ? (
          <Stack spacing={2}>
            <TextField label="E-post" size="small" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required type="email" />
            <TextField label="Navn (valgfri)" size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField label="Telefon (valgfri)" size="small" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
            <TextField label="Rolle" size="small" select value={role} onChange={(e) => setRole(e.target.value)} fullWidth>
              {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'primary').map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </TextField>
            <TextField label="Kompensasjon" size="small" select value={compType} onChange={(e) => setCompType(e.target.value as any)} fullWidth>
              {Object.entries(COMP_LABELS).map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </TextField>
            {compType === 'percentage' ? (
              <TextField label="% av netto" size="small" type="number" value={sharePct} onChange={(e) => setSharePct(e.target.value)} fullWidth placeholder="F.eks. 30" InputProps={{ endAdornment: '%' }} />
            ) : (
              <TextField label={compType === 'hourly' ? 'Timesats (kr)' : 'Fast sum (kr)'} size="small" type="number" value={compValue} onChange={(e) => setCompValue(e.target.value)} fullWidth placeholder={compType === 'hourly' ? '500' : '2500'} />
            )}
            <Divider />
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Box component="label" sx={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', gap: 1 }}>
                <input
                  type="checkbox"
                  checked={inviteToCreatorhubn}
                  onChange={(e) => setInviteToCreatorhubn(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Tipsboks: Inviter også til Creatorhubn
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Etter signering ser hen et tilbud om å prøve Creatorhubn gratis i 30 dager. Du får oppdatert tracking
                    her hvis hen registrerer seg (provisjon-flyt kommer senere).
                  </Typography>
                </Box>
              </Box>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Alert severity="success">Invitasjon opprettet! Send lenken til assistenten:</Alert>
            <TextField fullWidth size="small" value={inviteUrl} InputProps={{ readOnly: true }} />
            <Button startIcon={<CopyIcon />} variant="contained" onClick={handleCopy}>Kopier lenke</Button>
            <Typography variant="caption" color="text.secondary">
              Lenken er gyldig til invitasjonen er akseptert eller avslått.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{inviteUrl ? 'Ferdig' : 'Avbryt'}</Button>
        {!inviteUrl && (
          <Button variant="contained" onClick={handleSubmit} disabled={submitting || !email.trim()}>
            {submitting ? 'Sender…' : 'Send invitasjon'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AssistantsPanel;
