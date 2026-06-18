/**
 * ClientVaultView — klient-selvbetjent Access Vault (trust-først). Klienten
 * legger inn sine egne plattform-tilganger (f.eks. Google Ads) trygt i UI, med
 * innsyns-policy + valgfritt tidsvindu, i stedet for å sende passord på e-post.
 * Produsenten får aldri se hemmeligheten uten godkjent forespørsel + 2FA.
 *
 * Bruker eksisterende, sikkerhets-reviewet backend (#661): AES-256-GCM i hvile,
 * TLS i transit, dekryptert kun i minne ved godkjent reveal, uforanderlig audit.
 * Sannferdig sikkerhets-copy — INGEN falske «kryptert i nettleseren»-løfter.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, CircularProgress, Snackbar,
  Select, MenuItem, FormControl, InputLabel, Collapse,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  LockOutlined as LockIcon,
  AddCircleOutline as AddIcon,
  PersonOutline as ClientOwnedIcon,
  BusinessCenterOutlined as ProducerOwnedIcon,
  VisibilityOutlined as RevealIcon,
  HistoryOutlined as AuditIcon,
  VerifiedUserOutlined as MfaIcon,
} from '@mui/icons-material';
import { roleRoomAccessVaultApi } from '../../services/castingApiService';
import type {
  RoleRoomAccessVaultState, RoleRoomAccessVaultSecretSummary, ProducerAccountAccessPlatform,
} from '../../models/casting';

const PLATFORMS: { value: ProducerAccountAccessPlatform; label: string }[] = [
  { value: 'google', label: 'Google (Ads / Analytics)' },
  { value: 'meta', label: 'Meta (Facebook / Instagram)' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];
const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));

const POLICIES: { value: string; label: string; hint: string }[] = [
  { value: 'approval_required', label: 'Godkjenning kreves', hint: 'Du må godkjenne hver gang produsenten ber om innsyn.' },
  { value: 'mfa_required', label: 'Godkjenning + 2FA', hint: 'Produsenten må bekrefte med 2FA før innsyn vises. Tryggest.' },
  { value: 'one_time', label: 'Engangs-innsyn', hint: 'Kan kun vises én gang etter godkjenning.' },
];

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ClientVaultView({ projectId }: { projectId: string }) {
  const [state, setState] = useState<RoleRoomAccessVaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [platform, setPlatform] = useState<ProducerAccountAccessPlatform>('google');
  const [accountLabel, setAccountLabel] = useState('');
  const [username, setUsername] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [revealPolicy, setRevealPolicy] = useState('mfa_required');
  const [expiresAt, setExpiresAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setState(await roleRoomAccessVaultApi.getVault(projectId)); }
    catch { setState({ secrets: [], requests: [], audit: [] }); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const secrets = state?.secrets ?? [];
  const myAudit = useMemo(() => (state?.audit ?? []).slice(0, 8), [state]);

  const handleAdd = useCallback(async () => {
    if (!secretValue.trim() && !username.trim()) { setToast('Fyll inn minst brukernavn eller hemmelighet.'); return; }
    setSaving(true);
    try {
      await roleRoomAccessVaultApi.upsertSecret(projectId, platform, {
        accountLabel: accountLabel.trim() || undefined,
        ownerSide: 'client',
        label: accountLabel.trim() || PLATFORM_LABEL[platform],
        username: username.trim() || undefined,
        secretValue: secretValue.trim() || undefined,
        revealPolicy,
        status: 'not_shared',
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setToast('Tilgang lagret — kryptert og trygt. Produsenten ser den ikke uten din godkjenning.');
      setAdding(false); setAccountLabel(''); setUsername(''); setSecretValue(''); setExpiresAt('');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke lagre tilgangen.'); }
    finally { setSaving(false); }
  }, [projectId, platform, accountLabel, username, secretValue, revealPolicy, expiresAt, load]);

  const fieldSx = { '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)' }, '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' } };

  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>Tilganger &amp; vault</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.66)', mt: 0.3 }}>
          Del plattform-tilganger (f.eks. Google Ads) trygt — uten å sende passord på e-post. Du eier nøklene.
        </Typography>
      </Box>

      {/* Tillits-/sikkerhets-banner (sannferdig) */}
      <Box sx={{ p: 1.4, borderRadius: 2, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.07)' }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <ShieldIcon sx={{ color: '#6ee7b7', fontSize: 22, mt: 0.2 }} />
          <Box>
            <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.86rem' }}>Du har kontrollen</Typography>
            <Stack spacing={0.3} sx={{ mt: 0.5 }}>
              <SecurityLine icon={<LockIcon sx={{ fontSize: 14, color: '#6ee7b7' }} />} text="Kryptert i hvile (AES-256-GCM) + TLS i transit. Vi dekrypterer kun i minnet ved godkjent innsyn — aldri logget eller bufret." />
              <SecurityLine icon={<MfaIcon sx={{ fontSize: 14, color: '#6ee7b7' }} />} text="Produsenten må be om innsyn med begrunnelse + 2FA. Du godkjenner — aldri stille uttak." />
              <SecurityLine icon={<AuditIcon sx={{ fontSize: 14, color: '#6ee7b7' }} />} text="Du ser alltid hvem som så hva, når — i en uforanderlig logg." />
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* Legg til tilgang */}
      {!adding ? (
        <Button onClick={() => setAdding(true)} startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, minHeight: 44, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
          Legg til tilgang
        </Button>
      ) : (
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(124,58,237,0.06)' }}>
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.95rem', mb: 1 }}>Ny tilgang</Typography>
          <Stack spacing={1.25}>
            <FormControl size="small" fullWidth sx={fieldSx}>
              <InputLabel>Plattform</InputLabel>
              <Select label="Plattform" value={platform} onChange={(e) => setPlatform(e.target.value as ProducerAccountAccessPlatform)} sx={{ color: '#f1f5f9' }}>
                {PLATFORMS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Konto-navn (f.eks. «Google Ads – hovedkonto»)" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} size="small" fullWidth sx={fieldSx} />
            <TextField label="Brukernavn / e-post" value={username} onChange={(e) => setUsername(e.target.value)} size="small" fullWidth sx={fieldSx} autoComplete="off" />
            <TextField label="Passord / token" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} size="small" fullWidth type="password" sx={fieldSx} autoComplete="new-password" />
            <FormControl size="small" fullWidth sx={fieldSx}>
              <InputLabel>Innsyns-policy</InputLabel>
              <Select label="Innsyns-policy" value={revealPolicy} onChange={(e) => setRevealPolicy(e.target.value)} sx={{ color: '#f1f5f9' }}>
                {POLICIES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem', mt: -0.5 }}>
              {POLICIES.find((p) => p.value === revealPolicy)?.hint}
            </Typography>
            <TextField label="Tilgang utløper (valgfritt tidsvindu)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <Stack direction="row" spacing={1}>
              <Button onClick={() => void handleAdd()} disabled={saving} startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <LockIcon />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>
                {saving ? 'Lagrer …' : 'Lagre kryptert'}
              </Button>
              <Button onClick={() => setAdding(false)} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 44, color: 'rgba(226,232,240,0.7)' }}>Avbryt</Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* Lagrede tilganger */}
      <Box>
        <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.82rem', fontWeight: 800, mb: 1 }}>
          Dine tilganger {loading ? '' : `· ${secrets.length}`}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>
        ) : secrets.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem', py: 2, textAlign: 'center' }}>Ingen tilganger lagt inn ennå.</Typography>
        ) : (
          <Stack spacing={1}>{secrets.map((s) => <SecretRow key={s.id} s={s} />)}</Stack>
        )}
      </Box>

      {/* Hvem så hva (audit) */}
      {myAudit.length > 0 ? (
        <Box>
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.78rem', fontWeight: 700, mb: 0.75 }}>Hvem så hva</Typography>
          <Stack spacing={0.5}>
            {myAudit.map((a) => (
              <Stack key={a.id} direction="row" spacing={0.75} alignItems="center" sx={{ px: 1, py: 0.6, borderRadius: 1, background: 'rgba(255,255,255,0.02)' }}>
                <AuditIcon sx={{ fontSize: 14, color: 'rgba(226,232,240,0.5)' }} />
                <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.74rem', flex: 1 }}>
                  {String(a.action ?? 'hendelse').replace(/_/g, ' ')}{a.actorRole ? ` · ${a.actorRole}` : ''}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.7rem' }}>{fmtDate(a.createdAt)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Snackbar open={Boolean(toast)} autoHideDuration={4500} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}

function SecurityLine({ icon, text }: { icon: React.ReactElement; text: string }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="flex-start">
      <Box sx={{ mt: 0.2 }}>{icon}</Box>
      <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.76rem' }}>{text}</Typography>
    </Stack>
  );
}

function SecretRow({ s }: { s: RoleRoomAccessVaultSecretSummary }) {
  const [showInfo, setShowInfo] = useState(false);
  const clientOwned = s.ownerSide === 'client';
  const revoked = Boolean(s.revokedAt);
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.4)', p: 1.1, opacity: revoked ? 0.6 : 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <LockIcon sx={{ fontSize: 18, color: '#c4b5fd', flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: '#f1f5f9', fontSize: '0.86rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.accountLabel || s.label || PLATFORM_LABEL[s.platform] || s.platform}
          </Typography>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.2, flexWrap: 'wrap', rowGap: 0.3 }}>
            <Chip size="small" icon={clientOwned ? <ClientOwnedIcon sx={{ fontSize: 12, color: '#6ee7b7 !important' }} /> : <ProducerOwnedIcon sx={{ fontSize: 12, color: '#c4b5fd !important' }} />}
              label={clientOwned ? 'Du eier' : 'Produsent'} sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: clientOwned ? '#6ee7b7' : '#c4b5fd', background: clientOwned ? 'rgba(16,185,129,0.12)' : 'rgba(168,85,247,0.14)' }} />
            <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>{PLATFORM_LABEL[s.platform] ?? s.platform}</Typography>
            {s.maskedReference ? <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem', fontFamily: 'monospace' }}>{s.maskedReference}</Typography> : null}
          </Stack>
        </Box>
        <Button size="small" onClick={() => setShowInfo((v) => !v)} startIcon={<RevealIcon sx={{ fontSize: 15 }} />} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 36, color: 'rgba(226,232,240,0.65)' }}>Detaljer</Button>
      </Stack>
      <Collapse in={showInfo}>
        <Stack spacing={0.4} sx={{ mt: 0.8, pl: 3.5 }}>
          <Detail label="Innsyns-policy" value={s.revealPolicy === 'mfa_required' ? 'Godkjenning + 2FA' : s.revealPolicy === 'one_time' ? 'Engangs' : 'Godkjenning kreves'} />
          {s.expiresAt ? <Detail label="Utløper" value={fmtDate(s.expiresAt)} /> : null}
          {s.rotatedAt ? <Detail label="Sist rotert" value={fmtDate(s.rotatedAt)} /> : null}
          {s.lastRevealedAt ? <Detail label="Sist vist" value={fmtDate(s.lastRevealedAt)} /> : <Detail label="Sist vist" value="Aldri" />}
          {revoked ? <Detail label="Status" value="Tilbaketrukket" /> : null}
        </Stack>
      </Collapse>
    </Box>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1}>
      <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', minWidth: 96 }}>{label}</Typography>
      <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.72rem', fontWeight: 600 }}>{value}</Typography>
    </Stack>
  );
}
