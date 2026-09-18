/**
 * Story Graph Fase 8c — Integrasjoner: CI-bevis-hooks.
 *
 * Spillbygget (Xcode/CI) setter leveransegater med bevis via en HMAC-signert webhook.
 * Her opprettes hooks (hemmeligheten vises ÉN gang), de tilbakekalles, og leveringsloggen
 * (anvendt/avvist) vises. Alle states: laster, tom, feil m/ prøv igjen, kopiert.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import RefreshIcon from '@mui/icons-material/Refresh';

import { narrativeColors } from '../narrativeTheme';
import { createCiHook, listCiDeliveries, listCiHooks, revokeCiHook, createPlaytestToken, listPlaytestTokens, revokePlaytestToken, type NarrativeCiDelivery, type NarrativeCiHook, type NarrativePlaytestToken } from '../narrativeService';
import { sceneFieldSx } from '../scenes/sceneUi';

export interface IntegrationsPanelProps {
  projectId: string;
  /** Bumpes ved sanntids-push (kind = 'scene') så loggen oppdateres når CI leverer. */
  refreshKey?: number;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}

const GATE_LABEL: Record<string, string> = {
  script_coverage: 'Manusdekning', greybox: 'Gråboks', characters_animation: 'Karakterer/animasjon', playthrough: 'Gjennomspilling', picture: 'Bilde', audio: 'Lyd',
};
const ERROR_LABEL: Record<string, string> = {
  unknown_scene: 'Ukjent scene', gate_evidence_required: '«Bestått» uten bevis', invalid_payload: 'Ugyldig payload',
};

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
}

function backendOrigin(): string {
  try { return window.location.origin; } catch { return ''; }
}

export function IntegrationsPanel({ projectId, refreshKey = 0, onNotice }: IntegrationsPanelProps) {
  const [hooks, setHooks] = useState<NarrativeCiHook[] | null>(null);
  const [deliveries, setDeliveries] = useState<NarrativeCiDelivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ hook: NarrativeCiHook; secret: string; webhookPath: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Fase 8e: spilltest-tokens (råtoken vises én gang).
  const [tokens, setTokens] = useState<NarrativePlaytestToken[] | null>(null);
  const [tokenLabel, setTokenLabel] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [freshToken, setFreshToken] = useState<{ token: NarrativePlaytestToken; rawToken: string; ingestPath: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, d, t] = await Promise.all([listCiHooks(projectId), listCiDeliveries(projectId), listPlaytestTokens(projectId).catch(() => [] as NarrativePlaytestToken[])]);
      setHooks(h); setDeliveries(d); setTokens(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste integrasjoner.');
    }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const res = await createCiHook(projectId, label.trim() || 'CI');
      setFresh(res); setLabel('');
      await load();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke opprette hook.', 'error');
    } finally { setCreating(false); }
  }, [projectId, label, load, onNotice]);

  const revoke = useCallback(async (hook: NarrativeCiHook) => {
    try { await revokeCiHook(projectId, hook.id); onNotice(`Hook «${hook.label || hook.id}» tilbakekalt.`, 'success'); await load(); }
    catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke tilbakekalle.', 'error'); }
  }, [projectId, load, onNotice]);

  const createToken = useCallback(async () => {
    setCreatingToken(true);
    try {
      const res = await createPlaytestToken(projectId, { label: tokenLabel.trim() || 'Spilltest', ttlDays: 90 });
      setFreshToken(res); setTokenLabel('');
      await load();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Kunne ikke opprette token.', 'error');
    } finally { setCreatingToken(false); }
  }, [projectId, tokenLabel, load, onNotice]);

  const revokeToken = useCallback(async (t: NarrativePlaytestToken) => {
    try { await revokePlaytestToken(projectId, t.id); onNotice(`Token «${t.label || t.id}» tilbakekalt.`, 'success'); await load(); }
    catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke tilbakekalle.', 'error'); }
  }, [projectId, load, onNotice]);

  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800); }
    catch { onNotice('Kunne ikke kopiere — marker teksten manuelt.', 'warning'); }
  }, [onNotice]);

  const curlExample = useMemo(() => {
    if (!fresh) return '';
    const url = `${backendOrigin()}${fresh.webhookPath}`;
    return [
      `export STORYGRAPH_HOOK_URL="${url}"`,
      `export STORYGRAPH_HOOK_SECRET="${fresh.secret}"`,
      `bash packages/story-graph-runtime/ci/post-gate-evidence.sh --scene P01 --gate greybox --status passed \\`,
      `  --evidence "68 bestått, 0 feil" --artifact build/Prologue-P01-Final.xcresult.zip --commit "$GITHUB_SHA"`,
    ].join('\n');
  }, [fresh]);

  const active = (hooks ?? []).filter((h) => !h.revokedAt);
  const revoked = (hooks ?? []).filter((h) => h.revokedAt);
  const activeTokens = (tokens ?? []).filter((t) => !t.revokedAt);
  const telemetryExample = useMemo(() => {
    if (!freshToken) return '';
    return [
      `curl -X POST "${backendOrigin()}${freshToken.ingestPath}" \\`,
      `  -H "Authorization: Bearer ${freshToken.rawToken}" -H "Content-Type: application/json" \\`,
      `  -d '{"events":[{"sessionId":"<tilfeldig-id>","sceneCode":"P01","event":"enter","build":"1.0 (42)","deviceClass":"iPad Pro M1"},`,
      `               {"sessionId":"<tilfeldig-id>","sceneCode":"P01","event":"choice","connectionId":"<koblings-id>","tMs":12000},`,
      `               {"sessionId":"<tilfeldig-id>","sceneCode":"P01","event":"exit","tMs":41000}]}'`,
    ].join('\n');
  }, [freshToken]);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, color: narrativeColors.text, maxWidth: 1100 }} data-testid="narrative-integrations-panel">
      <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Integrasjoner</Typography>
      <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mt: 0.5, mb: 2 }}>
        CI-bevis: spillbygget setter leveransegater med bevis via en signert webhook (HMAC-SHA256). «Bestått» krever bevis — også fra CI.
        Gater satt av CI merkes «Satt av CI» på scenekortet.
      </Typography>

      {error ? (
        <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => void load()} data-testid="narrative-integrations-retry">Prøv igjen</Button>} data-testid="narrative-integrations-error" sx={{ mb: 2 }}>{error}</Alert>
      ) : null}

      {/* ── Opprett hook ─────────────────────────────────────────────── */}
      <Box sx={{ border: `1px solid ${narrativeColors.borderStrong}`, borderRadius: 2, p: 1.5, mb: 2, bgcolor: narrativeColors.bgPanel }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>Ny CI-hook</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField size="small" label="Etikett" placeholder="F.eks. Xcode Cloud – prolog" value={label} onChange={(e) => setLabel(e.target.value)} inputProps={{ 'data-testid': 'narrative-ci-hook-label', maxLength: 200 }} sx={{ ...sceneFieldSx, flex: 1 }} disabled={creating} />
          <Button variant="contained" startIcon={creating ? <CircularProgress size={14} sx={{ color: '#04140a' }} /> : <AddIcon />} onClick={() => void create()} disabled={creating} data-testid="narrative-ci-hook-create" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, whiteSpace: 'nowrap', '&:hover': { bgcolor: narrativeColors.accentDark } }}>Opprett hook</Button>
        </Stack>
      </Box>

      {/* ── Hook-liste ───────────────────────────────────────────────── */}
      <Typography sx={{ fontSize: 13, fontWeight: 800, mb: 1 }}>Hooks</Typography>
      {hooks === null ? (
        <Box sx={{ color: narrativeColors.textDim, fontSize: 12, mb: 2 }} data-testid="narrative-integrations-loading">LASTER…</Box>
      ) : active.length === 0 ? (
        <Box sx={{ color: narrativeColors.textDim, fontSize: 12, mb: 2, p: 2, border: `1px dashed ${narrativeColors.borderSoft}`, borderRadius: 2 }} data-testid="narrative-ci-hooks-empty">
          Ingen aktive hooks. Opprett én per CI-system (hemmeligheten vises bare ved opprettelse).
        </Box>
      ) : (
        <Stack spacing={0.75} sx={{ mb: 2 }}>
          {active.map((h) => (
            <Stack key={h.id} direction="row" alignItems="center" spacing={1} sx={{ border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 1.5, p: 1 }} data-testid={`narrative-ci-hook-${h.id}`}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{h.label || 'CI-hook'}</Typography>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, fontFamily: 'monospace' }}>{h.id}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{h.deliveryCount} leveringer · sist {fmt(h.lastDeliveryAt)}</Typography>
              <Tooltip title="Tilbakekall (CI får 401 fra nå av)"><IconButton size="small" onClick={() => void revoke(h)} aria-label="Tilbakekall" data-testid={`narrative-ci-hook-revoke-${h.id}`} sx={{ color: narrativeColors.error }}><BlockIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          ))}
        </Stack>
      )}
      {revoked.length > 0 ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 2 }}>{revoked.length} tilbakekalt{revoked.length === 1 ? '' : 'e'}.</Typography> : null}

      {/* ── Leveringslogg ────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Leveringer</Typography>
        <IconButton size="small" onClick={() => void load()} aria-label="Oppdater" sx={{ color: narrativeColors.textDim }}><RefreshIcon fontSize="small" /></IconButton>
      </Stack>
      {deliveries === null ? null : deliveries.length === 0 ? (
        <Box sx={{ color: narrativeColors.textDim, fontSize: 12, p: 2, border: `1px dashed ${narrativeColors.borderSoft}`, borderRadius: 2 }} data-testid="narrative-ci-deliveries-empty">Ingen leveringer ennå.</Box>
      ) : (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, '& td, & th': { p: 0.75, borderBottom: `1px solid ${narrativeColors.borderSoft}`, textAlign: 'left', verticalAlign: 'top' }, '& th': { color: narrativeColors.textDim, fontWeight: 700, fontSize: 11 } }} data-testid="narrative-ci-deliveries">
          <thead><tr><th>Tid</th><th>Status</th><th>Scene</th><th>Gate</th><th>Resultat</th><th>Commit / kjøring</th></tr></thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} data-testid={`narrative-ci-delivery-${d.id}`}>
                <td>{fmt(d.receivedAt)}</td>
                <td><Chip size="small" label={d.status === 'applied' ? 'Anvendt' : 'Avvist'} sx={{ height: 20, bgcolor: d.status === 'applied' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: d.status === 'applied' ? narrativeColors.accent : narrativeColors.error }} /></td>
                <td>{d.sceneCode ?? '–'}</td>
                <td>{d.gateKey ? GATE_LABEL[d.gateKey] ?? d.gateKey : '–'}</td>
                <td>{d.status === 'applied' ? (d.gateStatus ?? '') : (ERROR_LABEL[d.error ?? ''] ?? d.error ?? '')}</td>
                <td>
                  {d.commitSha ? <Box component="span" sx={{ fontFamily: 'monospace' }}>{d.commitSha.slice(0, 7)}</Box> : null}
                  {d.runUrl ? <> · <a href={d.runUrl} target="_blank" rel="noreferrer" style={{ color: narrativeColors.accent }}>kjøring</a></> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      )}

      {/* ── Spilltest-tokens (Fase 8e) ───────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 3, mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, flex: 1 }}>Spilltest-telemetri</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mb: 1 }}>
        Spillet sender <code>enter</code>/<code>exit</code>/<code>choice</code>/<code>death</code>/<code>complete</code> per scene med et token; Spilltest-fanen på scenekortet viser økter, drop-off og valgfordeling. Ingen personopplysninger — kun scenekode, hendelse, tid, build og enhetsklasse.
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <TextField size="small" label="Etikett" placeholder="iPad testrunde uke 40" value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} inputProps={{ 'data-testid': 'narrative-playtest-token-label' }} sx={{ ...sceneFieldSx, minWidth: 260 }} />
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => void createToken()} disabled={creatingToken} data-testid="narrative-playtest-token-create" sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }}>Opprett token</Button>
      </Stack>
      {tokens === null ? null : activeTokens.length === 0 ? (
        <Box sx={{ color: narrativeColors.textDim, fontSize: 12, p: 2, border: `1px dashed ${narrativeColors.borderSoft}`, borderRadius: 2, mb: 2 }} data-testid="narrative-playtest-tokens-empty">Ingen aktive tokens. Tokens utløper etter 90 dager og kan tilbakekalles når som helst.</Box>
      ) : (
        <Stack spacing={0.75} sx={{ mb: 2 }}>
          {activeTokens.map((t) => (
            <Stack key={t.id} direction="row" alignItems="center" spacing={1} sx={{ border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 1.5, p: 1 }} data-testid={`narrative-playtest-token-${t.id}`}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t.label || 'Spilltest'}</Typography>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, fontFamily: 'monospace' }}>{t.id}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{t.eventCount} hendelser · sist {fmt(t.lastUsedAt)}{t.expiresAt ? ` · utløper ${fmt(t.expiresAt)}` : ''}</Typography>
              <Tooltip title="Tilbakekall (hendelser droppes stille fra nå av)"><IconButton size="small" onClick={() => void revokeToken(t)} aria-label="Tilbakekall token" data-testid={`narrative-playtest-token-revoke-${t.id}`} sx={{ color: narrativeColors.error }}><BlockIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          ))}
        </Stack>
      )}

      <Dialog open={!!freshToken} onClose={() => setFreshToken(null)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-playtest-token-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Spilltest-token opprettet — vises bare nå</DialogTitle>
        <DialogContent>
          {freshToken ? (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Alert severity="warning" sx={{ fontSize: 12 }}>Legg tokenet i spillets build-konfigurasjon (ikke i kildekoden). Kun en hash lagres her — det kan ikke hentes igjen.</Alert>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" label="Token" value={freshToken.rawToken} InputProps={{ readOnly: true }} inputProps={{ 'data-testid': 'narrative-playtest-token-raw' }} sx={{ ...sceneFieldSx, flex: 1, fontFamily: 'monospace' }} />
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copy(freshToken.rawToken, 'ptoken')} sx={{ color: narrativeColors.accent }}>{copied === 'ptoken' ? 'Kopiert!' : 'Kopier'}</Button>
              </Stack>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Eksempel (curl); Swift-snutt i docs/role-room/STORY_GRAPH_PLAYTEST_TELEMETRY.md:</Typography>
              <Box component="pre" data-testid="narrative-playtest-token-example" sx={{ m: 0, p: 1.25, fontSize: 11, bgcolor: '#0a0a0a', border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 1.5, overflowX: 'auto', whiteSpace: 'pre' }}>{telemetryExample}</Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFreshToken(null)} data-testid="narrative-playtest-token-close" sx={{ color: narrativeColors.textDim }}>Jeg har kopiert tokenet</Button>
        </DialogActions>
      </Dialog>

      {/* ── Hemmelighet vist én gang ─────────────────────────────────── */}
      <Dialog open={!!fresh} onClose={() => setFresh(null)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-ci-hook-secret-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Hook opprettet — hemmeligheten vises bare nå</DialogTitle>
        <DialogContent>
          {fresh ? (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Alert severity="warning" sx={{ fontSize: 12 }}>Kopier hemmeligheten til CI-systemets secrets. Den kan ikke hentes igjen — opprett en ny hook om den går tapt.</Alert>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" label="Webhook-URL" value={`${backendOrigin()}${fresh.webhookPath}`} InputProps={{ readOnly: true }} inputProps={{ 'data-testid': 'narrative-ci-hook-url' }} sx={{ ...sceneFieldSx, flex: 1 }} />
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copy(`${backendOrigin()}${fresh.webhookPath}`, 'url')} sx={{ color: narrativeColors.accent }}>{copied === 'url' ? 'Kopiert!' : 'Kopier'}</Button>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" label="Hemmelighet" value={fresh.secret} InputProps={{ readOnly: true }} inputProps={{ 'data-testid': 'narrative-ci-hook-secret' }} sx={{ ...sceneFieldSx, flex: 1, fontFamily: 'monospace' }} />
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copy(fresh.secret, 'secret')} data-testid="narrative-ci-hook-secret-copy" sx={{ color: narrativeColors.accent }}>{copied === 'secret' ? 'Kopiert!' : 'Kopier'}</Button>
              </Stack>
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Fra CI (skriptet ligger i monorepoet):</Typography>
              <Box component="pre" data-testid="narrative-ci-hook-example" sx={{ m: 0, p: 1.25, fontSize: 11, bgcolor: '#0a0a0a', border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 1.5, overflowX: 'auto', whiteSpace: 'pre' }}>{curlExample}</Box>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
                Payload: <code>{'{ scene, gate, status, evidence?, evidenceRefs?, commitSha?, runUrl?, build? }'}</code>, header <code>X-StoryGraph-Signature-256: sha256=&lt;hmac&gt;</code>.
                Artefakter (xcresult-zip) lastes opp til <code>…/evidence</code> med <code>X-StoryGraph-Hook: &lt;hookId&gt;:&lt;hemmelighet&gt;</code> og gir en <code>asset:</code>-ref som kan lastes ned fra gate-fanen.
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFresh(null)} data-testid="narrative-ci-hook-secret-close" sx={{ color: narrativeColors.textDim }}>Jeg har kopiert hemmeligheten</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
