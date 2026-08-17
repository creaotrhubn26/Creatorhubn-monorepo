/**
 * WorkspaceSplitSheet — dashboardets split-sheet-modal, brakt inn i workspacet i
 * ws-design og scopet til prosjektet. Gjenbruker de SAMME komponentene som
 * UniversalDashboard: SplitSheetEarningsOverview (Statistikk), TeamMembersDirectory
 * (Team) og SplitSheetRoleWizard (rolle-basert opprettelse). Profesjons-bevisst —
 * musikkprodusent får royalty/master/komposisjon-roller, foto/video sine.
 *
 * Data: prosjekt-scopet localStorage (`split-sheet-entries-<projectId>`, som
 * dashboardets flyt) + POST til /api/split-sheets (project_id) for varig lagring.
 * localStorage er den primære, alltid tilgjengelige butikken — POST-en er
 * supplerende varig lagring; feiler den, beholdes fordelingen lokalt med en
 * synlig «kun lokalt»-indikator i stedet for å gå tapt stille.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, Dialog, DialogContent, IconButton, Tabs as MuiTabs, Tab, Avatar } from '@mui/material';
import AccountBalance from '@mui/icons-material/AccountBalance';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import SplitSheetEarningsOverview, { type SplitSheetEntry } from '../universal/split-sheets/SplitSheetEarningsOverview';
import TeamMembersDirectory from '../universal/split-sheets/TeamMembersDirectory';
import SplitSheetRoleWizard from '../universal/split-sheets/SplitSheetRoleWizard';
import { ws } from './workspaceTheme';
import { useWorkspaceCategory } from './useWorkspaceCategory';
import { wsIcon } from './crewIcons';
import { WsCard, WsTag } from './ui';
import { useWsLocale, makeT, type WsDict } from './wsLocale';

// split_sheet_contributors.role har CHECK-constraint (kun disse slug-ene). Wizardens
// roleId (f.eks. 'photo', 'second-shooter') og norske labels bryter den → map til
// gyldig slug (ellers 'collaborator'); den lesbare rollen lagres i custom_fields.
const ROLE_SLUGS = new Set(['producer', 'artist', 'songwriter', 'composer', 'lyricist', 'vocalist', 'instrumentalist', 'mix_engineer', 'mastering_engineer', 'arranger', 'featured_artist', 'backing_vocalist', 'session_musician', 'collaborator', 'publisher', 'label', 'other']);
const toRoleSlug = (roleId?: string): string => (roleId && ROLE_SLUGS.has(roleId) ? roleId : 'collaborator');

const T: WsDict = {
  openSplitSheet: { no: 'Åpne split sheet', en: 'Open split sheet' },
  newSplitSheet: { no: 'Nytt split sheet', en: 'New split sheet' },
  royaltyDistribution: { no: 'royalty-fordeling', en: 'royalty split' },
  feeDistribution: { no: 'honorar-fordeling', en: 'fee split' },
  royaltyDistributionTeam: { no: 'Royalty-fordeling i team', en: 'Team royalty split' },
  feeDistributionTeam: { no: 'Honorar-fordeling i team', en: 'Team fee split' },
  distributionSingular: { no: 'fordeling', en: 'split' },
  distributionPlural: { no: 'fordelinger', en: 'splits' },
  royaltyBlurb: { no: 'Royalty/master/komposisjon per bidragsyter.', en: 'Royalty/master/composition per contributor.' },
  feeBlurb: { no: 'Hvem får hvor stor andel av honoraret.', en: 'Who gets how large a share of the fee.' },
  statsTab: { no: 'Statistikk & honorar', en: 'Stats & fees' },
  teamTab: { no: 'Team-direktorat', en: 'Team directory' },
  shareHeading: { no: 'Del til signering', en: 'Share for signing' },
  shareBlurb: { no: 'Send lenken til bandet/bidragsyterne. De ser hele fordelingen og signerer godkjennelse — uten konto. Har de CreatorHub-konto med samme e-post, finner de avtalen igjen under «Mine avtaler».', en: 'Send the link to the band/contributors. They see the full split and sign approval — no account needed. If they have a CreatorHub account with the same email, they’ll find the agreement again under "My agreements".' },
  sendToTeam: { no: 'Send til bandet', en: 'Send to the band' },
  sending: { no: 'Sender…', en: 'Sending…' },
  copied: { no: 'Kopiert ✓', en: 'Copied ✓' },
  copy: { no: 'Kopier', en: 'Copy' },
  statusAndLog: { no: 'Status & logg', en: 'Status & log' },
  signingStatus: { no: 'Signeringsstatus', en: 'Signing status' },
  signed: { no: 'Signert', en: 'Signed' },
  waiting: { no: 'Venter', en: 'Waiting' },
  auditLog: { no: 'Audit-logg', en: 'Audit log' },
  noEvents: { no: 'Ingen hendelser ennå.', en: 'No events yet.' },
  evSigningEnabled: { no: 'Signering aktivert', en: 'Signing enabled' },
  evViewed: { no: 'Åpnet avtalen', en: 'Opened the agreement' },
  evSigned: { no: 'Signerte', en: 'Signed' },
  evCompleted: { no: 'Alle signert ✓', en: 'All signed ✓' },
  methodDrawn: { no: 'tegnet', en: 'drawn' },
  methodTyped: { no: 'skrevet', en: 'typed' },
  noDistributionsYet: { no: 'Ingen fordeling ennå', en: 'No split yet' },
  createFirstDistribution: { no: 'Lag den første {word} for prosjektet med rolle-veiviseren.', en: 'Create the first {word} for the project with the role wizard.' },
  close: { no: 'Lukk', en: 'Close' },
  ofWord: { no: 'av', en: 'of' },
  sendSuccess1: { no: 'Signeringslenken er sendt til', en: 'The signing link was sent to' },
  sendSuccess2: { no: 'bidragsytere med e-post.', en: 'contributors with email.' },
  sendFailed: { no: 'Kunne ikke sende. Sjekk at bidragsyterne har e-post.', en: 'Could not send. Check that contributors have email.' },
  syncFailedBanner: { no: 'kunne ikke synkroniseres med server — lagret kun lokalt på denne enheten.', en: 'could not sync with the server — saved locally on this device only.' },
};

function eventLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    signing_enabled: t('evSigningEnabled'),
    viewed: t('evViewed'),
    signed: t('evSigned'),
    completed: t('evCompleted'),
  };
  return map[type] || type;
}

function formatEventTime(iso: string): string {
  try { return new Date(iso).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

// Dev-only feillogging for stille .catch()-håndterte kall — samme mønster som
// OversiktTab (import.meta.env.DEV-gated console.warn), endrer ikke produksjonsatferd.
function devWarn(context: string): (err: unknown) => void {
  return (err) => {
    if (import.meta.env.DEV) {
      console.warn(`[WorkspaceSplitSheet] ${context}`, err);
    }
  };
}

interface LocalSplitSheetEntry extends SplitSheetEntry {
  sheetId?: string;
  accessCode?: string;
  shareUrl?: string;
  /** POST /api/split-sheets feilet — entryen finnes kun lokalt, ikke på server. */
  syncFailed?: boolean;
}

interface WizardParticipant {
  id: string;
  name: string;
  email?: string;
  roleId?: string;
  roleLabel?: string;
  sharePct: number;
  shareKr: number;
}

interface WizardSaveData {
  projectName: string;
  projectAmount: number;
  model: 'equal' | 'weighted' | 'manual' | 'hybrid';
  participants: WizardParticipant[];
}

interface CreateSplitSheetResponse {
  success: boolean;
  data?: { id: string; [key: string]: unknown };
}

interface EnableSigningResponse {
  ok: boolean;
  accessCode?: string;
  shareUrl?: string;
}

interface SigningStatusContributor {
  id: string;
  name: string;
  email: string;
  role: string;
  percentage: number;
  signed: boolean;
  signedAt: string | null;
}

interface SigningStatusEvent {
  type: string;
  actor: string | null;
  method: string | null;
  ip: string | null;
  detail: string | null;
  at: string;
}

interface SigningStatusResponse {
  title: string;
  accessCode: string | null;
  status: string;
  shareUrl: string | null;
  contributors: SigningStatusContributor[];
  signedCount: number;
  total: number;
  events: SigningStatusEvent[];
}

interface SendInvitesResponse {
  ok: boolean;
  sent: number;
  total: number;
  shareUrl: string;
}

interface WorkspaceSplitSheetProps {
  projectId: string;
  profession?: string;
  userId?: string;
  projectName?: string;
}

const WorkspaceSplitSheet: React.FC<WorkspaceSplitSheetProps> = ({ projectId, profession, projectName }) => {
  const locale = useWsLocale();
  const t = useMemo(() => makeT(T, locale), [locale]);
  const wsCategory = useWorkspaceCategory(profession);
  const music = wsCategory === 'music';
  const distributionWord = music ? t('royaltyDistribution') : t('feeDistribution');

  const storeKey = `split-sheet-entries-${projectId}`;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'stats' | 'team'>('stats');
  const [wizard, setWizard] = useState(false);
  const [entries, setEntries] = useState<LocalSplitSheetEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      setEntries(raw ? JSON.parse(raw) : []);
    } catch (err) {
      devWarn('load entries from localStorage')(err);
      setEntries([]);
    }
  }, [storeKey]);

  const persist = useCallback((next: LocalSplitSheetEntry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch (err) {
      devWarn('persist entries to localStorage')(err);
    }
  }, [storeKey]);

  const [share, setShare] = useState<{ shareUrl: string; accessCode: string; sheetId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<SigningStatusResponse | null>(null);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const loadStatus = useCallback(async (sheetId: string) => {
    if (!sheetId) return;
    try {
      const r = await apiRequest(`/api/split-sheets/${sheetId}/signing-status`) as SigningStatusResponse;
      setStatus(r);
    } catch (err) {
      devWarn('load signing status')(err);
      setStatus(null);
    }
  }, []);

  const onWizardSave = useCallback(async (data: WizardSaveData) => {
    const entry: LocalSplitSheetEntry = {
      id: `local-${Date.now()}`,
      projectName: data.projectName,
      projectAmount: data.projectAmount,
      createdAt: new Date().toISOString(),
      model: data.model,
      participants: data.participants,
    };
    try {
      const resp = await apiRequest('/api/split-sheets', {
        method: 'POST',
        body: {
          project_id: projectId,
          title: data.projectName || 'Split sheet',
          description: data.projectAmount ? `Beløp: ${data.projectAmount} kr` : null,
          contributors: (data.participants || []).map((p) => ({ name: p.name, email: p.email, role: toRoleSlug(p.roleId), percentage: p.sharePct, custom_fields: { roleLabel: p.roleLabel || '' } })),
        },
      }) as CreateSplitSheetResponse;
      const sheetId = resp?.data?.id;
      if (sheetId) {
        entry.sheetId = sheetId;
        try {
          const en = await apiRequest(`/api/split-sheets/${sheetId}/enable-signing`, { method: 'POST', body: {} }) as EnableSigningResponse;
          entry.accessCode = en?.accessCode;
          entry.shareUrl = en?.shareUrl;
          if (en?.shareUrl && en?.accessCode) {
            setShare({ shareUrl: en.shareUrl, accessCode: en.accessCode, sheetId });
          }
        } catch (err) {
          devWarn('enable signing')(err);
        }
      } else {
        entry.syncFailed = true;
      }
    } catch (err) {
      devWarn('create split sheet')(err);
      entry.syncFailed = true;
    }
    setEntries((prev) => { const next = [entry, ...prev]; persist(next); return next; });
    setWizard(false);
    setTab('stats');
  }, [projectId, persist]);

  const copyLink = useCallback((url: string) => {
    try {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      devWarn('copy link to clipboard')(err);
    }
  }, []);

  const sendInvites = useCallback(async (sheetId: string) => {
    if (!sheetId || sending) return;
    setSending(true);
    try {
      const r = await apiRequest(`/api/split-sheets/${encodeURIComponent(sheetId)}/send-invites`, { method: 'POST', body: {} }) as SendInvitesResponse;
      setSendResult({ ok: true, text: `${t('sendSuccess1')} ${r?.sent ?? 0} ${t('ofWord')} ${r?.total ?? 0} ${t('sendSuccess2')}` });
      loadStatus(sheetId);
    } catch (err) {
      setSendResult({ ok: false, text: err instanceof Error ? err.message : t('sendFailed') });
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(null), 4000);
    }
  }, [sending, loadStatus, t]);

  const totalKr = useMemo(() => entries.reduce((s, e) => s + (Number(e.projectAmount) || 0), 0), [entries]);
  const syncFailedCount = useMemo(() => entries.filter((e) => e.syncFailed).length, [entries]);

  return (
    <WsCard>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AccountBalance sx={{ color: ws.accent, fontSize: 21 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Split sheet — {distributionWord}</Typography>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>
            {entries.length
              ? `${entries.length} ${entries.length === 1 ? t('distributionSingular') : t('distributionPlural')}${totalKr ? ` · ${Math.round(totalKr).toLocaleString('nb-NO')} kr` : ''}`
              : (music ? t('royaltyBlurb') : t('feeBlurb'))}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setOpen(true)}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, flexShrink: 0, '&:hover': { bgcolor: ws.accentHover } }}>
          {t('openSplitSheet')}
        </Button>
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: `${ws.radius}px`, bgcolor: ws.bg, backgroundImage: 'none', color: ws.text, border: `1px solid ${ws.border}`, maxHeight: '92vh' } }}>
        {/* Header — ws-tema */}
        <Box sx={{ px: 3, pt: 3, pb: 2, background: `linear-gradient(135deg, ${ws.accentSoft}, transparent)`, borderBottom: `1px solid ${ws.borderSoft}`, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: ws.accentSoft, color: ws.accent }}><AccountBalance /></Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: ws.accent, letterSpacing: '0.18em' }}>Split Sheets</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{music ? t('royaltyDistributionTeam') : t('feeDistributionTeam')}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button startIcon={<Add />} onClick={() => setWizard(true)}
              sx={{ borderRadius: '999px', px: 2.5, py: 1, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: ws.accentHover } }}>
              {t('newSplitSheet')}
            </Button>
            <IconButton onClick={() => setOpen(false)} aria-label={t('close')} sx={{ color: ws.textDim }}><Close /></IconButton>
          </Stack>
        </Box>

        <Box sx={{ px: 3, pt: 2, borderBottom: `1px solid ${ws.borderSoft}` }}>
          <MuiTabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: ws.textDim, minHeight: 40, py: 0.5, '&.Mui-selected': { color: ws.accent } }, '& .MuiTabs-indicator': { backgroundColor: ws.accent, height: 3, borderRadius: 2 } }}>
            <Tab value="stats" label={t('statsTab')} />
            <Tab value="team" label={t('teamTab')} />
          </MuiTabs>
        </Box>

        <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, borderColor: ws.borderSoft }}>
          {tab === 'stats' && syncFailedCount > 0 && (
            <Box sx={{ mb: 2, p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.amberSoft, border: `1px solid ${ws.amber}` }}>
              <Typography sx={{ fontSize: 12, color: ws.text }}>
                {syncFailedCount} {syncFailedCount === 1 ? t('distributionSingular') : t('distributionPlural')} {t('syncFailedBanner')}
              </Typography>
            </Box>
          )}
          {/* Delingslenke til bandet — de åpner den, ser fordelingen og signerer godkjennelse */}
          {tab === 'stats' && (share?.shareUrl || entries.find((e) => e.shareUrl)) && (() => {
            const link = share?.shareUrl || entries.find((e) => e.shareUrl)?.shareUrl;
            const activeSheetId = share?.sheetId || entries.find((e) => e.shareUrl)?.sheetId;
            return (
              <Box sx={{ mb: 2, p: 1.75, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
                <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 13, fontWeight: 700, mb: 0.5 }}>{wsIcon('Link', { fontSize: 14 })}{t('shareHeading')}</Typography>
                <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 1 }}>{t('shareBlurb')}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, px: 1.25, py: 0.9, borderRadius: 1, bgcolor: ws.panel, border: `1px solid ${ws.borderSoft}`, fontSize: 12, color: ws.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</Box>
                  <Button size="small" variant="contained" disabled={sending} onClick={() => activeSheetId && sendInvites(activeSheetId)}
                    sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap', '&:hover': { bgcolor: ws.accentHover } }}>{sending ? t('sending') : t('sendToTeam')}</Button>
                  <Button size="small" onClick={() => link && copyLink(link)} sx={{ color: copied ? ws.green : ws.accent, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>{copied ? t('copied') : t('copy')}</Button>
                  <Button size="small" onClick={() => activeSheetId && loadStatus(activeSheetId)} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>{t('statusAndLog')}</Button>
                </Stack>

                {sendResult && (
                  <Typography sx={{ fontSize: 11.5, mt: 1, color: sendResult.ok ? ws.green : ws.red }}>{sendResult.text}</Typography>
                )}

                {status && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${ws.borderSoft}` }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.75 }}>{t('signingStatus')} — {status.signedCount}/{status.total} {t('signed').toLowerCase()}</Typography>
                    <Stack spacing={0.4} sx={{ mb: 1 }}>
                      {(status.contributors || []).map((c) => (
                        <Stack key={c.id} direction="row" alignItems="center" spacing={1}>
                          <Typography sx={{ fontSize: 12, flex: 1 }} noWrap>{c.name}{c.role ? ` · ${c.role}` : ''} · {c.percentage}%</Typography>
                          {c.signed ? <WsTag label={t('signed')} tone="green" /> : <WsTag label={t('waiting')} tone="amber" />}
                        </Stack>
                      ))}
                    </Stack>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>{t('auditLog')}</Typography>
                    <Stack spacing={0.25}>
                      {(status.events || []).length === 0 ? <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{t('noEvents')}</Typography> :
                        (status.events || []).slice(0, 20).map((e, i) => (
                          <Typography key={i} sx={{ fontSize: 11, color: ws.textDim }}>
                            <b style={{ color: ws.textFaint }}>{formatEventTime(e.at)}</b> · {eventLabel(e.type, t)}{e.actor ? ` — ${e.actor}` : ''}{e.method ? ` (${e.method === 'drawn' ? t('methodDrawn') : t('methodTyped')})` : ''}{e.ip ? ` · ${e.ip}` : ''}
                          </Typography>
                        ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            );
          })()}
          {tab === 'stats' && (
            entries.length === 0 ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
                <AccountBalance sx={{ fontSize: 40, color: ws.textFaint }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('noDistributionsYet')}</Typography>
                <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 420 }}>{t('createFirstDistribution').replace('{word}', distributionWord)}</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => setWizard(true)} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('newSplitSheet')}</Button>
              </Stack>
            ) : (
              <SplitSheetEarningsOverview sheets={entries} />
            )
          )}
          {tab === 'team' && <TeamMembersDirectory profession={profession} />}
        </DialogContent>
      </Dialog>

      {/* Rolle-veiviser — samme som dashboardet, profesjons-bevisst */}
      <SplitSheetRoleWizard
        open={wizard}
        onClose={() => setWizard(false)}
        profession={profession}
        projectName={projectName || ''}
        onSave={onWizardSave}
      />
    </WsCard>
  );
};

export default WorkspaceSplitSheet;
