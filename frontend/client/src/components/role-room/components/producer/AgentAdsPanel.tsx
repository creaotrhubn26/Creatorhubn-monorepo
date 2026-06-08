/**
 * AgentAdsPanel.tsx
 *
 * The Role Room Agent — multi-tenant Google Ads conversion-tracking-flate
 * for innholdsprodusenter. Brukerflate:
 *
 *   1. Discovery — producer skriver inn klient-URL + navn
 *   2. Claude analyserer (B1) — viser bransje + 3-7 foreslåtte actions
 *   3. Review — producer kan tilpasse navn/verdi/trigger per action
 *   4. Save — config + actions lagres i client_ads_configs + client_ads_actions
 *   5. (B2/B3) OAuth-koble klientens Google Ads + auto-opprett actions
 *   6. (B5) Velg tracking-deployment-metode
 *
 * Denne komponenten dekker steg 1-4. B2/B3/B5/B6 hekker på senere.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CodeIcon from '@mui/icons-material/Code';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

const palette = {
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  borderSubtle: 'rgba(168,85,247,0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface PageSnapshot {
  url: string;
  finalUrl: string | null;
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  detectedGtagIds: string[];
  formCount: number;
  cta_phrases: string[];
  htmlBytes: number;
}

interface SuggestedAction {
  action_name: string;
  display_name: string;
  goal_category: string;
  default_value: number;
  currency: string;
  trigger_type: string;
  url_pattern?: string;
  claude_reasoning: string;
}

interface DiscoveryResult {
  url: string;
  fetched_at: string;
  business_type: string;
  business_subcategory: string;
  business_summary: string;
  detected_gtag_id: string | null;
  detected_gtm_id: string | null;
  page_snapshot: PageSnapshot;
  suggested_actions: SuggestedAction[];
  notes: string[];
  warnings: string[];
}

const GOAL_CATEGORIES = [
  { value: 'purchase', label: 'Purchase (kjøp)' },
  { value: 'add_to_cart', label: 'Add to cart' },
  { value: 'begin_checkout', label: 'Begin checkout' },
  { value: 'submit_lead_form', label: 'Submit lead form' },
  { value: 'book_appointment', label: 'Book appointment' },
  { value: 'sign_up', label: 'Sign-up' },
  { value: 'subscribe', label: 'Subscribe' },
  { value: 'request_quote', label: 'Request quote' },
  { value: 'contact', label: 'Contact' },
  { value: 'page_view', label: 'Page view' },
  { value: 'outbound_click', label: 'Outbound click' },
  { value: 'other', label: 'Other' },
];

const TRIGGER_TYPES = [
  { value: 'page_load', label: 'Page load (URL-mønster)' },
  { value: 'form_submit', label: 'Form submit' },
  { value: 'click', label: 'Klikk på element' },
  { value: 'event', label: 'JS-event (custom)' },
  { value: 'outbound', label: 'Outbound link' },
  { value: 'manual', label: 'Manuell trigger' },
];

export default function AgentAdsPanel({
  clientProjectId,
  defaultClientName,
}: {
  clientProjectId?: string;
  defaultClientName?: string;
}) {
  const [stage, setStage] = useState<'discover' | 'review' | 'saved'>('discover');

  // Discovery form
  const [clientName, setClientName] = useState(defaultClientName ?? '');
  const [clientUrl, setClientUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Review-stage editable actions
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Notes/warnings expansion
  const [showNotes, setShowNotes] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedConfigId, setSavedConfigId] = useState<string | null>(null);

  // Approval — send til klient
  const [sendingForApproval, setSendingForApproval] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [approvalSent, setApprovalSent] = useState(false);
  const [approvalDeadline, setApprovalDeadline] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Management fee — 20% standard, kan endres per klient.
  // Forhandlet sats markeres med management_fee_negotiated på backend.
  const [managementFeePct, setManagementFeePct] = useState<number>(20);
  const [editingFee, setEditingFee] = useState(false);

  const sendForApproval = async () => {
    if (!savedConfigId) return;
    setSendingForApproval(true);
    setApprovalError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${savedConfigId}/request-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: approvalMessage.trim() || undefined,
          management_fee_pct: managementFeePct,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setApprovalSent(true);
      setApprovalDeadline(data.deadline ?? null);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Kunne ikke sende til godkjenning');
    } finally {
      setSendingForApproval(false);
    }
  };

  // Trigger discovery
  const runDiscovery = async () => {
    setDiscovering(true);
    setDiscoveryError(null);
    setDiscoveryResult(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: clientUrl.trim(),
          client_name: clientName.trim() || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.error || data.detail || `HTTP ${r.status}`);
      }
      setDiscoveryResult(data.result);
      setActions(data.result.suggested_actions);
      setStage('review');
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : 'Analyse feilet');
    } finally {
      setDiscovering(false);
    }
  };

  // Save config + actions
  const saveConfig = async () => {
    if (!discoveryResult || !clientProjectId) {
      setSaveError('client_project_id mangler — kan ikke lagre uten knytting til prosjekt.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_project_id: clientProjectId,
          client_name: clientName.trim(),
          client_website_url: clientUrl.trim(),
          analysis: discoveryResult,
          actions,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || data.detail || `HTTP ${r.status}`);
      setSavedConfigId(data.configId);
      setStage('saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  };

  // Pre-fill on mount if defaultClientName provided
  useEffect(() => {
    if (defaultClientName) setClientName(defaultClientName);
  }, [defaultClientName]);

  return (
    <Box sx={{ color: palette.textPrimary }}>
      <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2.4 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.6,
            background: palette.accentGradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.04rem' }}>
            Ads & conversion-tracking
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
            Agent setter opp Google Ads-tracking for klienten — tilpasset deres bransje.
          </Typography>
        </Box>
      </Stack>

      {/* Stage 1: Discovery */}
      {stage === 'discover' ? (
        <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, color: palette.textPrimary }}>
          <CardContent>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 1, mb: 1.6, textTransform: 'uppercase' }}>
              Steg 1 av 4 — Klient-analyse
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Klient-navn"
                placeholder="f.eks. PreVisit AI"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                fullWidth
                size="small"
                InputProps={{ sx: { color: palette.textPrimary } }}
                InputLabelProps={{ sx: { color: palette.textMuted } }}
              />
              <TextField
                label="Klientens nettside (URL)"
                placeholder="https://klient.no"
                value={clientUrl}
                onChange={(e) => setClientUrl(e.target.value)}
                fullWidth
                size="small"
                InputProps={{ sx: { color: palette.textPrimary } }}
                InputLabelProps={{ sx: { color: palette.textMuted } }}
              />
              {discoveryError ? (
                <Alert severity="error" onClose={() => setDiscoveryError(null)}>
                  {discoveryError}
                </Alert>
              ) : null}
              <Button
                onClick={runDiscovery}
                disabled={discovering || !clientUrl.trim()}
                startIcon={discovering ? <CircularProgress size={16} /> : <SearchIcon />}
                sx={{
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  py: 1.2,
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  '&:disabled': { background: 'rgba(168,85,247,0.32)', color: 'rgba(255,255,255,0.5)' },
                }}
              >
                {discovering ? 'Claude analyserer…' : 'Analyser klient'}
              </Button>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                Agent fetcher klient-siden, kjenner igjen bransje, og foreslår 3-7 conversion-actions tilpasset hva slags virksomhet det er.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {/* Stage 2: Review */}
      {stage === 'review' && discoveryResult ? (
        <Stack spacing={2}>
          {/* Discovery-summary */}
          <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.4 }}>
                <Box>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 1, mb: 0.6, textTransform: 'uppercase' }}>
                    Steg 2 av 4 — Review + tilpass
                  </Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: palette.textPrimary }}>
                    {clientName || 'Klienten'} — analyse
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<RefreshIcon fontSize="small" />}
                  onClick={() => setStage('discover')}
                  sx={{ color: palette.accent, textTransform: 'none' }}
                >
                  Analyser på nytt
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.4 }}>
                <Chip
                  label={`Bransje: ${discoveryResult.business_type}`}
                  sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent, fontWeight: 700, fontSize: '0.78rem' }}
                />
                <Chip
                  label={discoveryResult.business_subcategory}
                  sx={{ bgcolor: 'rgba(168,85,247,0.08)', color: palette.textSecondary, fontSize: '0.78rem' }}
                />
                {discoveryResult.detected_gtag_id ? (
                  <Chip label={`GA4: ${discoveryResult.detected_gtag_id}`} size="small" sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontSize: '0.74rem' }} />
                ) : null}
                {discoveryResult.detected_gtm_id ? (
                  <Chip label={`GTM: ${discoveryResult.detected_gtm_id}`} size="small" sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontSize: '0.74rem' }} />
                ) : null}
                <Tooltip title={`Åpne ${discoveryResult.page_snapshot.finalUrl ?? discoveryResult.url} i ny fane`}>
                  <IconButton
                    size="small"
                    component="a"
                    href={discoveryResult.page_snapshot.finalUrl ?? discoveryResult.url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ color: palette.textMuted }}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', lineHeight: 1.55 }}>
                {discoveryResult.business_summary}
              </Typography>
            </CardContent>
          </Card>

          {/* Notes */}
          {discoveryResult.notes.length > 0 ? (
            <Card sx={{ bgcolor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.18)', color: palette.textPrimary }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ cursor: 'pointer' }} onClick={() => setShowNotes((v) => !v)}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: '#60a5fa' }}>
                    Claude-innsikt ({discoveryResult.notes.length})
                  </Typography>
                  <IconButton size="small" sx={{ color: '#60a5fa' }}>
                    {showNotes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
                {showNotes ? (
                  <Stack spacing={1} sx={{ mt: 1.2 }}>
                    {discoveryResult.notes.map((n, i) => (
                      <Typography key={i} sx={{ color: palette.textSecondary, fontSize: '0.86rem', lineHeight: 1.5 }}>
                        • {n}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Warnings */}
          {discoveryResult.warnings.length > 0 ? (
            <Card sx={{ bgcolor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', color: palette.textPrimary }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ cursor: 'pointer' }} onClick={() => setShowWarnings((v) => !v)}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', color: '#fbbf24' }}>
                    Advarsler ({discoveryResult.warnings.length})
                  </Typography>
                  <IconButton size="small" sx={{ color: '#fbbf24' }}>
                    {showWarnings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
                {showWarnings ? (
                  <Stack spacing={1} sx={{ mt: 1.2 }}>
                    {discoveryResult.warnings.map((w, i) => (
                      <Typography key={i} sx={{ color: palette.textSecondary, fontSize: '0.86rem', lineHeight: 1.5 }}>
                        ⚠ {w}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Actions list */}
          <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, color: palette.textPrimary }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
                  Conversion-actions ({actions.length})
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={() => {
                    const newAction: SuggestedAction = {
                      action_name: `custom_action_${actions.length + 1}`,
                      display_name: 'Ny custom action',
                      goal_category: 'other',
                      default_value: 0,
                      currency: 'NOK',
                      trigger_type: 'manual',
                      claude_reasoning: 'Lagt til manuelt av producer',
                    };
                    setActions([...actions, newAction]);
                    setEditingIdx(actions.length);
                  }}
                  sx={{ color: palette.accent, textTransform: 'none' }}
                >
                  Legg til
                </Button>
              </Stack>
              <Stack spacing={1.4}>
                {actions.map((a, idx) => (
                  <ActionCard
                    key={idx}
                    action={a}
                    isEditing={editingIdx === idx}
                    onEdit={() => setEditingIdx(idx)}
                    onSave={(updated) => {
                      const next = [...actions];
                      next[idx] = updated;
                      setActions(next);
                      setEditingIdx(null);
                    }}
                    onCancel={() => setEditingIdx(null)}
                    onDelete={() => {
                      setActions(actions.filter((_, i) => i !== idx));
                      if (editingIdx === idx) setEditingIdx(null);
                    }}
                  />
                ))}
              </Stack>

              {saveError ? <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSaveError(null)}>{saveError}</Alert> : null}

              <Divider sx={{ my: 2.4, borderColor: palette.borderSubtle }} />

              <Stack direction="row" spacing={1.4}>
                <Button
                  onClick={saveConfig}
                  disabled={saving || actions.length === 0 || !clientProjectId}
                  startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                    '&:disabled': { background: 'rgba(168,85,247,0.32)' },
                  }}
                >
                  {saving ? 'Lagrer…' : 'Lagre + gå videre til OAuth'}
                </Button>
                <Button
                  onClick={() => setStage('discover')}
                  sx={{ color: palette.textMuted, textTransform: 'none' }}
                >
                  Avbryt
                </Button>
              </Stack>
              {!clientProjectId ? (
                <Typography sx={{ color: '#f87171', fontSize: '0.78rem', mt: 1 }}>
                  Mangler client_project_id — denne komponenten må mountes med et prosjekt.
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        </Stack>
      ) : null}

      {/* Stage 3: Saved + Deployment guide */}
      {stage === 'saved' && savedConfigId && discoveryResult ? (
        <Stack spacing={2}>
          <Card sx={{ bgcolor: palette.bgCard, border: `1px solid rgba(52,211,153,0.32)`, color: palette.textPrimary }}>
            <CardContent>
              <Typography sx={{ color: '#34d399', fontWeight: 800, fontSize: '1rem', mb: 1.2 }}>
                ✓ Lagret — config og {actions.length} actions
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', mb: 1.4 }}>
                Neste: send anbefalingene til klienten for godkjenning før du går videre til Google Ads-setup.
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                Config-ID: <code>{savedConfigId}</code>
              </Typography>
            </CardContent>
          </Card>

          {/* Send til klient for godkjenning */}
          {!approvalSent ? (
            <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
              <CardContent>
                <Typography sx={{ fontWeight: 800, fontSize: '0.96rem', mb: 1.2 }}>
                  Send til klient for godkjenning
                </Typography>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.6 }}>
                  Klienten ser anbefalingene i sin "Client Economy"-fane i Role Room.
                  De kan godkjenne, avvise eller be om endringer. Hvis ingen respons innen
                  3 business-dager → auto-godkjent (per MedInnova §5.2).
                </Typography>
                <Box sx={{
                  bgcolor: 'rgba(168,85,247,0.10)',
                  border: `1px solid ${palette.borderStrong}`,
                  borderRadius: 1.2,
                  p: 1.4,
                  mb: 1.6,
                }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
                    <Typography sx={{ color: palette.accent, fontWeight: 700, fontSize: '0.82rem' }}>
                      💰 Din management fee
                    </Typography>
                    {!editingFee ? (
                      <Button
                        size="small"
                        startIcon={<EditIcon fontSize="small" />}
                        onClick={() => setEditingFee(true)}
                        sx={{ color: palette.accent, textTransform: 'none', minWidth: 0 }}
                      >
                        {managementFeePct !== 20 ? `${managementFeePct}% (forhandlet)` : '20% (standard)'}
                      </Button>
                    ) : (
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <TextField
                          type="number"
                          value={managementFeePct}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v) && v >= 0 && v <= 100) setManagementFeePct(v);
                          }}
                          size="small"
                          inputProps={{ min: 0, max: 100, step: 1, style: { textAlign: 'right', width: 50 } }}
                          InputProps={{
                            endAdornment: <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', ml: 0.4 }}>%</Typography>,
                            sx: { color: palette.textPrimary, fontWeight: 700, fontSize: '0.86rem' },
                          }}
                        />
                        <Button
                          size="small"
                          onClick={() => setEditingFee(false)}
                          sx={{ color: '#34d399', textTransform: 'none', minWidth: 0 }}
                        >
                          Lagre
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                  <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem', lineHeight: 1.5 }}>
                    Google Ads-kontoen står på klienten — spend trekkes direkte fra klientens kort/bank
                    til Google. Du håndterer aldri ads-pengene; du har kun OAuth-tilgang for setup
                    + optimalisering. Din faktura = KUN management-fee (20% av spend, standard).
                    Eks: klient bruker 20 000 kr/mnd → du fakturerer 4 000 kr/mnd. Justér per klient
                    — klient ser satsen før godkjenning.
                  </Typography>
                </Box>
                <TextField
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  label="Beskjed til klient (optional)"
                  placeholder="Hei [klient], her er forslagene mine basert på Claude-analysen…"
                  value={approvalMessage}
                  onChange={(e) => setApprovalMessage(e.target.value)}
                  sx={{ mb: 1.6 }}
                  InputProps={{ sx: { color: palette.textPrimary } }}
                  InputLabelProps={{ sx: { color: palette.textMuted } }}
                />
                {approvalError ? (
                  <Alert severity="error" onClose={() => setApprovalError(null)} sx={{ mb: 1.4 }}>
                    {approvalError}
                  </Alert>
                ) : null}
                <Button
                  onClick={sendForApproval}
                  disabled={sendingForApproval}
                  startIcon={sendingForApproval ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  }}
                >
                  {sendingForApproval ? 'Sender…' : 'Send til klient'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ bgcolor: 'rgba(96,165,250,0.06)', border: `1px solid rgba(96,165,250,0.24)`, color: palette.textPrimary }}>
              <CardContent>
                <Typography sx={{ color: '#60a5fa', fontWeight: 800, fontSize: '0.96rem', mb: 1 }}>
                  📤 Sendt til klient for godkjenning
                </Typography>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem' }}>
                  Klient har frist til {approvalDeadline ? new Date(approvalDeadline).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '3 business-dager'}.
                  Du får notification i Admin Room når klienten har bestemt seg.
                </Typography>
              </CardContent>
            </Card>
          )}

          <DeploymentGuide
            clientName={clientName || 'Klienten'}
            clientUrl={discoveryResult.url}
            businessType={discoveryResult.business_type}
            businessSummary={discoveryResult.business_summary}
            detectedGtag={discoveryResult.detected_gtag_id}
            detectedGtm={discoveryResult.detected_gtm_id}
            isSpa={discoveryResult.page_snapshot.htmlBytes < 5000}
            actions={actions}
          />

          <Button
            onClick={() => {
              setStage('discover');
              setDiscoveryResult(null);
              setActions([]);
              setSavedConfigId(null);
            }}
            sx={{ color: palette.accent, textTransform: 'none', alignSelf: 'flex-start' }}
          >
            Sett opp ny klient
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────
// DeploymentGuide — viser kode-snippet + AI-prompt for å installere
// tracking på klientens nettside.
// ──────────────────────────────────────────────────────────────────
function DeploymentGuide({
  clientName,
  clientUrl,
  businessType,
  businessSummary,
  detectedGtag,
  detectedGtm,
  isSpa,
  actions,
}: {
  clientName: string;
  clientUrl: string;
  businessType: string;
  businessSummary: string;
  detectedGtag: string | null;
  detectedGtm: string | null;
  isSpa: boolean;
  actions: SuggestedAction[];
}) {
  const [tab, setTab] = useState<'gads' | 'ai' | 'html' | 'react' | 'wordpress'>('gads');
  const [copied, setCopied] = useState<string | null>(null);

  const gadsSetup = generateGoogleAdsSetupInstructions(clientName, actions);
  const aiPrompt = generateAiPrompt({ clientName, clientUrl, businessType, businessSummary, detectedGtag, detectedGtm, isSpa, actions });
  const htmlSnippet = generateHtmlSnippet(actions);
  const reactSnippet = generateReactSnippet(actions);
  const wpInstructions = generateWordpressInstructions(actions);

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* fallback */ }
  };

  const codeBoxSx = {
    bgcolor: '#0a0118',
    border: `1px solid ${palette.borderSubtle}`,
    borderRadius: 1.2,
    p: 2,
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.78rem',
    color: '#c4b5fd',
    lineHeight: 1.55,
    overflow: 'auto',
    maxHeight: 480,
    whiteSpace: 'pre' as const,
  };

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
            Steg 4 av 4 — Installer på klientens side
          </Typography>
        </Stack>

        {/* Tabs */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.8 }}>
          <Button
            size="small"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={() => setTab('gads')}
            sx={tabBtnSx(tab === 'gads')}
          >
            1. Google Ads oppsett
          </Button>
          <Button
            size="small"
            startIcon={<SmartToyOutlinedIcon fontSize="small" />}
            onClick={() => setTab('ai')}
            sx={tabBtnSx(tab === 'ai')}
          >
            2. AI-prompt (anbefalt)
          </Button>
          <Button
            size="small"
            startIcon={<CodeIcon fontSize="small" />}
            onClick={() => setTab('html')}
            sx={tabBtnSx(tab === 'html')}
          >
            HTML / gtag
          </Button>
          <Button
            size="small"
            onClick={() => setTab('react')}
            sx={tabBtnSx(tab === 'react')}
          >
            React / Next.js
          </Button>
          <Button
            size="small"
            onClick={() => setTab('wordpress')}
            sx={tabBtnSx(tab === 'wordpress')}
          >
            WordPress
          </Button>
        </Stack>

        {/* Google Ads UI-oppsett */}
        {tab === 'gads' ? (
          <Box>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.4 }}>
              <strong>Først:</strong> du må opprette {actions.length} conversion-actions i klientens
              Google Ads-konto for å få AW-ID + labels. Følg disse stegene før du går videre til
              kode-installasjon (B2 OAuth-flow vil automatisere dette i nær fremtid).
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <Box sx={codeBoxSx}>{gadsSetup}</Box>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => copy(gadsSetup, 'gads')}
                sx={{ position: 'absolute', top: 8, right: 8, color: palette.accent, bgcolor: 'rgba(0,0,0,0.4)', textTransform: 'none' }}
              >
                {copied === 'gads' ? 'Kopiert ✓' : 'Kopier guide'}
              </Button>
            </Box>
            <Button
              variant="outlined"
              size="small"
              href="https://ads.google.com/aw/conversions/summary"
              target="_blank"
              rel="noreferrer"
              startIcon={<OpenInNewIcon fontSize="small" />}
              sx={{ mt: 1.6, color: palette.accent, borderColor: palette.borderStrong, textTransform: 'none' }}
            >
              Åpne Google Ads → Conversions
            </Button>
          </Box>
        ) : null}

        {/* AI-prompt */}
        {tab === 'ai' ? (
          <Box>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.4 }}>
              Lim denne prompten inn i klientens AI-builder (Lovable, Bolt, v0, Cursor, ChatGPT etc.).
              AI-en installerer alle 3-7 conversion-events tilpasset {clientName}'s site.
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <Box sx={codeBoxSx}>{aiPrompt}</Box>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => copy(aiPrompt, 'ai')}
                sx={{ position: 'absolute', top: 8, right: 8, color: palette.accent, bgcolor: 'rgba(0,0,0,0.4)', textTransform: 'none' }}
              >
                {copied === 'ai' ? 'Kopiert ✓' : 'Kopier prompt'}
              </Button>
            </Box>
          </Box>
        ) : null}

        {/* HTML / gtag */}
        {tab === 'html' ? (
          <Box>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.4 }}>
              Lim hele blokken inn rett før <code>{'</head>'}</code> på klientens nettside.
              {isSpa ? ' SPA-deteksjon: bruk dataLayer.push istedenfor URL-baserte page-load-triggers (se kommentarer).' : ''}
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <Box sx={codeBoxSx}>{htmlSnippet}</Box>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => copy(htmlSnippet, 'html')}
                sx={{ position: 'absolute', top: 8, right: 8, color: palette.accent, bgcolor: 'rgba(0,0,0,0.4)', textTransform: 'none' }}
              >
                {copied === 'html' ? 'Kopiert ✓' : 'Kopier'}
              </Button>
            </Box>
          </Box>
        ) : null}

        {/* React / Next */}
        {tab === 'react' ? (
          <Box>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.4 }}>
              For Next.js/React-baserte sider: legg gtag-config i <code>app/layout.tsx</code> eller <code>_app.tsx</code>,
              og bruk helper-funksjonen for å fyre conversions.
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <Box sx={codeBoxSx}>{reactSnippet}</Box>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => copy(reactSnippet, 'react')}
                sx={{ position: 'absolute', top: 8, right: 8, color: palette.accent, bgcolor: 'rgba(0,0,0,0.4)', textTransform: 'none' }}
              >
                {copied === 'react' ? 'Kopiert ✓' : 'Kopier'}
              </Button>
            </Box>
          </Box>
        ) : null}

        {/* WordPress */}
        {tab === 'wordpress' ? (
          <Box>
            <Box sx={{ position: 'relative' }}>
              <Box sx={codeBoxSx}>{wpInstructions}</Box>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => copy(wpInstructions, 'wp')}
                sx={{ position: 'absolute', top: 8, right: 8, color: palette.accent, bgcolor: 'rgba(0,0,0,0.4)', textTransform: 'none' }}
              >
                {copied === 'wp' ? 'Kopiert ✓' : 'Kopier'}
              </Button>
            </Box>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}

function tabBtnSx(active: boolean) {
  return {
    textTransform: 'none' as const,
    fontWeight: 700,
    fontSize: '0.82rem',
    px: 1.6,
    py: 0.6,
    borderRadius: 999,
    bgcolor: active ? 'rgba(168,85,247,0.18)' : 'transparent',
    color: active ? palette.accent : palette.textMuted,
    border: `1px solid ${active ? palette.borderStrong : palette.borderSubtle}`,
    '&:hover': { bgcolor: 'rgba(168,85,247,0.10)', color: palette.textPrimary },
  };
}

// ──────────────────────────────────────────────────────────────────
// Google Ads UI setup-instruksjon (manuell — B2 automatiserer dette)
// ──────────────────────────────────────────────────────────────────
function generateGoogleAdsSetupInstructions(clientName: string, actions: SuggestedAction[]): string {
  const actionTable = actions.map((a, i) => {
    const goal = describeGoogleAdsCategory(a.goal_category);
    return `### Conversion ${i + 1} av ${actions.length}: ${a.display_name}
- **Goal:** ${goal}
- **Conversion name:** \`${a.action_name}\` (gi den dette navnet for å matche koden)
- **Value:** Use the same value → **${a.default_value} ${a.currency}**
- **Count:** One
- **Click-through window:** 30 days
- **View-through window:** 1 day
- **Attribution model:** Data-driven (default)
- **Method:** **Manually with code** (IKKE "Automatically without code" — vi fyrer presist via JS)

→ Etter "Done" trykker du **"Tag setup" → "Use Google Tag Manager or install tag yourself" → "Event snippet"**.
   Noter ned label-en (det som står etter \`AW-XXXXXXXXXX/\` i \`send_to\`). Den brukes i kode-snippetene.`;
  }).join('\n\n');

  return `# Google Ads UI-oppsett for ${clientName}
# ${actions.length} conversion-actions å opprette manuelt

## Forutsetninger
- Du må ha tilgang til klientens Google Ads-konto (logg inn med riktig konto)
- B2 OAuth-flow vil automatisere dette steg — inntil videre manuell setup

## Steg 1: Naviger til Conversions
1. Logg inn på [ads.google.com](https://ads.google.com)
2. Bytt til klientens konto (top-right account-switcher)
3. **Tools & Settings → Measurement → Conversions**
4. Klikk **"+ New conversion action" → "Website"**

## Steg 2: Velg data-source
- ✅ "Conversions on a website"
- Skriv inn klientens domene (f.eks. \`klientensite.no\`)
- "Save and continue"

## Steg 3: Opprett hver action

${actionTable}

## Steg 4: Noter ned for hver action

Etter at du har opprettet alle, samle inn:

- **AW-ID** (samme for alle, f.eks. \`AW-18197346774\`)
${actions.map((a) => `- **Label for ${a.display_name}** (${a.action_name}): \`<11-20 tegn etter / i send_to>\``).join('\n')}

## Steg 5: Tilbake til Agent

Lim verdiene inn i Agent UI (eller når B2 OAuth lander, blir disse fetched automatisk).

## Tips
- **Verdier**: Du kan justere de foreslåtte NOK-verdiene basert på faktisk LTV per
  konvertering hos klienten. Smart Bidding optimaliserer mot verdiene du oppgir.
- **Test først**: Bruk "Google Tag Assistant" Chrome-extensjon for å verifisere
  at conversions firer riktig før du går live med kampanjer.
- **Diagnostics**: Etter installasjon, sjekk Google Ads → Conversions → Diagnostics
  for hver action — kan ta opptil 24t før første "Recording conversions"-status.
- **Mindreårige/sensitive bransjer**: Hvis klienten er i helse/finans/etc., sjekk
  Google Ads' annonsepolicyer for sertifiseringskrav (LegitScript m.fl.).`;
}

function describeGoogleAdsCategory(cat: string): string {
  const map: Record<string, string> = {
    purchase: 'Purchase',
    add_to_cart: 'Add to cart',
    begin_checkout: 'Begin checkout',
    submit_lead_form: 'Submit lead form',
    book_appointment: 'Book appointment',
    sign_up: 'Sign-up',
    subscribe: 'Subscribe',
    request_quote: 'Request quote',
    contact: 'Contact',
    page_view: 'Page view',
    outbound_click: 'Outbound click',
    other: 'Other',
  };
  return map[cat] ?? cat;
}

// ──────────────────────────────────────────────────────────────────
// AI-prompt-generator — tilpasset klientens analyserte site
// ──────────────────────────────────────────────────────────────────
function generateAiPrompt(args: {
  clientName: string;
  clientUrl: string;
  businessType: string;
  businessSummary: string;
  detectedGtag: string | null;
  detectedGtm: string | null;
  isSpa: boolean;
  actions: SuggestedAction[];
}): string {
  const { clientName, clientUrl, businessType, businessSummary, detectedGtag, detectedGtm, isSpa, actions } = args;

  const actionList = actions
    .map((a, i) => {
      const trigger = describeTrigger(a);
      return `${i + 1}. **${a.display_name}** (\`${a.action_name}\`)
   - Kategori: ${a.goal_category}
   - Verdi: ${a.default_value} ${a.currency}
   - Trigger: ${trigger}
   - URL-mønster: ${a.url_pattern ?? '(any)'}
   - send_to: \`AW-XXXXXXXXXX/<LABEL_${a.action_name.toUpperCase()}>\`
   - Hvorfor: ${a.claude_reasoning}`;
    })
    .join('\n\n');

  return `# MASTER-OPPGAVE: Installer hele Google-stacken for ${clientName}

Dette er en KOMPLETT oppsett for klientens digitale målings-infrastruktur — ikke kun Google Ads.
Den dekker fire Google-tools som henger sammen:

  1. **Google Tag Manager (GTM)** — sentral tag-håndtering (anbefalt fundament)
  2. **Google Analytics 4 (GA4)** — site-analytics + brukeradferd
  3. **Google Ads** — conversion-tracking + bidding (${actions.length} events)
  4. **Google Search Console (GSC)** — SEO + indexing-status

Følg sekvensen 1→4. GTM først; så GA4 + Google Ads + GSC inni GTM.

---

## Om klienten
- **Nettside:** ${clientUrl}
- **Bransje:** ${businessType}
- **Hva de gjør:** ${businessSummary}
- **Arkitektur:** ${isSpa ? 'Single Page Application (SPA) — bruk JS-events + History Change-trigger i GTM, ikke URL-baserte page-views' : 'Tradisjonell multi-page site'}
- **Eksisterende tracking:** ${detectedGtag ? `GA4 ${detectedGtag} oppdaget — IKKE fjern, gjenbruk` : detectedGtm ? `GTM ${detectedGtm} oppdaget — bruk eksisterende container` : 'Ingen tracking detektert — frisk start'}

---

## STEG 1: Google Tag Manager (GTM)

${detectedGtm ? `**GTM er allerede installert (${detectedGtm}). Hopp til Steg 2.**` : `Sett opp et nytt GTM container — dette blir hub-en for alle andre tags.

Lim dette i \`<head>\` på hver side:
\`\`\`html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->
\`\`\`

Og dette rett etter \`<body>\`:
\`\`\`html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
\`\`\``}

---

## STEG 2: Google Analytics 4 (GA4)

${detectedGtag ? `Gjenbruk eksisterende ${detectedGtag}. Sørg for at den fyres via GTM med "Google Tag" → Measurement ID = ${detectedGtag}.` : `Sett opp ny GA4-property:

1. Gå til [analytics.google.com](https://analytics.google.com) → Admin → Create Property
2. Property name: "${clientName}"
3. Tidsone: Oslo (UTC+1), valuta: NOK
4. Data Stream: Web → URL ${clientUrl}
5. Noter Measurement ID (\`G-XXXXXXXXXX\`)

I GTM:
- Ny tag → Google Tag (gtag) → Measurement ID = \`G-XXXXXXXXXX\`
- Trigger: All Pages
- Lagre + Publiser`}

---

## STEG 3: Google Ads conversion-tracking

Du skal opprette **${actions.length} conversion-events** i GTM som fyrer Google Ads-conversions.

### Actions å sette opp

${actionList}

### For hver action — i GTM:
1. Ny tag → Google Ads Conversion Tracking
2. Conversion ID: \`AW-XXXXXXXXXX\`
3. Conversion Label: \`<LABEL_*>\` (én per action)
4. Value: action-verdi i NOK
5. Currency: NOK
6. Trigger: matchende type (Form Submit / Page View / Click / Custom Event)
7. ${isSpa ? '**SPA:** lag dataLayer.push events i koden + bruk Custom Event-triggers' : 'Multi-page: bruk URL-pattern-triggers der trigger_type=page_load'}

---

## STEG 4: Google Search Console (GSC)

${detectedGtag ? `Du kan verifisere via eksisterende GA4 (${detectedGtag}) — enkleste vei.

1. Gå til [search.google.com/search-console](https://search.google.com/search-console)
2. Add property → URL prefix → ${clientUrl}
3. Verifiser via "Google Analytics" → bruker ${detectedGtag}
4. Etter verify: submit sitemap.xml${isSpa ? ' (krever server-rendered sitemap for SPA — sjekk om klienten har en)' : ''}` : `Verifiser klientens domene i GSC:

1. Gå til [search.google.com/search-console](https://search.google.com/search-console)
2. Add property → URL prefix → ${clientUrl}
3. Velg verifikasjons-metode:
   - **HTML meta-tag** (enklest hvis du har site-access):
     \`<meta name="google-site-verification" content="<TOKEN>">\` i \`<head>\`
   - **DNS TXT-record** (krever DNS-tilgang)
4. Etter verify: submit \`${clientUrl}/sitemap.xml\`${isSpa ? ' (krever server-rendered sitemap for SPA — sjekk om klienten har en)' : ''}`}

---

## STEG 5: GDPR Consent Mode v2 (PÅKREVD for EU/Norge)

Implementér Google Consent Mode v2 i GTM. Default = denied:

\`\`\`js
// Før gtag/GTM lastes
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied',
  'functionality_storage': 'granted',
  'security_storage': 'granted',
  'wait_for_update': 500
});

// Etter brukers samtykke (consent-banner)
gtag('consent', 'update', {
  'ad_storage': 'granted',
  'ad_user_data': 'granted',
  'ad_personalization': 'granted',
  'analytics_storage': 'granted'
});
\`\`\`

Bruk en consent-banner (Cookiebot / OneTrust / Termly) som integrerer med Consent Mode v2.

---

## STEG 6: Link alle tools sammen

I **Google Ads**:
- Tools → Linked accounts → Google Analytics → koble til GA4-propertyen
- Importér GA4-conversions for cross-bidding

I **GA4**:
- Admin → Product Links → Google Ads → koble til ads-konto
- Admin → Product Links → Search Console → koble til GSC-property
- Aktivér Google Signals (i Data Settings) for cross-device tracking

---

## Når du er ferdig

Lever en sluttrapport:
- ✅ GTM container-ID: \`GTM-XXXXXXX\`
- ✅ GA4 Measurement-ID: \`G-XXXXXXXXXX\`
- ✅ Google Ads Conversion-ID: \`AW-XXXXXXXXXX\` + ${actions.length} labels
- ✅ GSC verifisert: ${clientUrl}
- ✅ Consent Mode v2 implementert
- 📊 Test-resultater (Tag Assistant + GA4 DebugView + Google Ads Diagnostics)

---

## VIKTIG: placeholders du må fylle inn

- \`GTM-XXXXXXX\` — Google Tag Manager container-ID
- \`G-XXXXXXXXXX\` — GA4 Measurement-ID
- \`AW-XXXXXXXXXX\` — Google Ads conversion-ID
- \`<TOKEN>\` — GSC site-verification-token
- \`<LABEL_${actions.map((a) => a.action_name.toUpperCase()).join('>, <LABEL_')}>\` — én label per Google Ads-action

${isSpa ? `## SPA-SPESIFIKT (gjelder for ${clientName})

Klientens site er en SPA. Vær spesielt obs på:
- Ikke bruk URL-baserte page-view-triggers — bruk History Change-trigger i GTM
- Fyre conversions via dataLayer.push({event: 'conversion_X'}) etter faktisk API-OK
- GA4 må konfigureres med "Enhanced measurement" + History Change
- GSC sitemap krever server-rendered XML — prerender hvis nødvendig
` : ''}

Start arbeidet. Spør hvis noe er uklart.`;
}

function describeTrigger(a: SuggestedAction): string {
  switch (a.trigger_type) {
    case 'page_load': return `Page load på URL-mønster ${a.url_pattern ?? '(spesifiser)'}`;
    case 'form_submit': return `Form submit (etter validering + API-OK)`;
    case 'click': return `Klikk på element (definer selector)`;
    case 'event': return `JS-event (dataLayer.push eller direkte gtag-kall)`;
    case 'outbound': return `Outbound link-klikk`;
    default: return `Manuell trigger (definer)`;
  }
}

// ──────────────────────────────────────────────────────────────────
// HTML / vanilla gtag snippet
// ──────────────────────────────────────────────────────────────────
function generateHtmlSnippet(actions: SuggestedAction[]): string {
  const events = actions.map((a) => {
    return `// ${a.display_name} (${a.action_name}) — ${a.goal_category}
// Trigger: ${describeTrigger(a)}
function fire_${a.action_name}(transactionId) {
  if (typeof gtag !== 'function') return;
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXXX/<LABEL_${a.action_name.toUpperCase()}>',
    'value': ${a.default_value},
    'currency': '${a.currency}',
    ...(transactionId && { 'transaction_id': transactionId })
  });
}`;
  }).join('\n\n');

  return `<!-- Google Ads conversion-tracking — generert av The Role Room Agent -->
<!-- 1) gtag.js global config (legg én gang i <head>) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
</script>

<!-- 2) Conversion-event-helpers -->
<script>
${events}
</script>

<!--
EKSEMPLER PÅ HVORDAN FYRE EVENTENE:

- På form-submit (etter API-200):
    document.querySelector('#contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await fetch('/api/lead', { method: 'POST', body: new FormData(e.target) });
      if (r.ok) fire_${actions[0]?.action_name ?? 'submit'}(crypto.randomUUID());
    });

- På page-load (kun på thank-you-page):
    window.addEventListener('load', () => {
      if (location.pathname.startsWith('/takk-for-bestillingen')) {
        fire_${actions[0]?.action_name ?? 'submit'}(new URLSearchParams(location.search).get('order_id'));
      }
    });

- På click (CTA-button):
    document.querySelector('#book-demo-btn').addEventListener('click', () => {
      fire_${actions[0]?.action_name ?? 'submit'}();
    });
-->`;
}

// ──────────────────────────────────────────────────────────────────
// React / Next.js snippet
// ──────────────────────────────────────────────────────────────────
function generateReactSnippet(actions: SuggestedAction[]): string {
  const events = actions.map((a) => {
    return `  ${a.action_name}: () => fireConversion('AW-XXXXXXXXXX/<LABEL_${a.action_name.toUpperCase()}>', { value: ${a.default_value}, currency: '${a.currency}' }),`;
  }).join('\n');

  return `// utils/google-ads.ts — generert av The Role Room Agent
// Bruk i Next.js (app router) eller hvilken som helst React-app.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const AW_ID = 'AW-XXXXXXXXXX'; // Google Ads conversion-ID

export function initGoogleAds() {
  if (typeof window === 'undefined' || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = \`https://www.googletagmanager.com/gtag/js?id=\${AW_ID}\`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', AW_ID);
}

function fireConversion(
  sendTo: string,
  opts: { value: number; currency: string; transactionId?: string },
) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'conversion', {
    send_to: sendTo,
    value: opts.value,
    currency: opts.currency,
    ...(opts.transactionId && { transaction_id: opts.transactionId }),
  });
}

export const adsEvents = {
${events}
};

// EKSEMPEL:
//   import { initGoogleAds, adsEvents } from '@/utils/google-ads';
//   useEffect(() => { initGoogleAds(); }, []);
//   const onSubmit = async () => { await api.submit(); adsEvents.${actions[0]?.action_name ?? 'submit'}(); };`;
}

// ──────────────────────────────────────────────────────────────────
// WordPress instruksjoner
// ──────────────────────────────────────────────────────────────────
function generateWordpressInstructions(actions: SuggestedAction[]): string {
  return `# WordPress — Google Ads conversion-tracking
# Generert av The Role Room Agent for ${actions.length} actions

## Anbefalt: Site Kit by Google (offisiell plugin)

1. Installer "Site Kit by Google" fra Plugins → Add New
2. Koble Google-konto + Google Ads
3. Site Kit installerer gtag.js automatisk

## Manuell installasjon (alternativ til Site Kit)

### Steg 1 — Legg gtag.js i <head>

I theme-en sin \`header.php\` (eller via "Insert Headers and Footers"-plugin), rett før \`</head>\`:

\`\`\`html
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
</script>
\`\`\`

### Steg 2 — Fyre conversions

For Contact Form 7, WPForms, Gravity Forms etc — installer "Form Analytics"-plugin
og koble den til Google Ads. Eller bruk dette JavaScriptet i samme header.php:

${actions.map((a) => `
// ${a.display_name}
window.addEventListener('${a.trigger_type === 'form_submit' ? 'wpcf7mailsent' : 'load'}', function() {
  ${a.trigger_type === 'page_load' && a.url_pattern ? `if (!location.pathname.match(/${a.url_pattern.replace(/\*/g, '.*')}/)) return;` : ''}
  gtag('event', 'conversion', {
    'send_to': 'AW-XXXXXXXXXX/<LABEL_${a.action_name.toUpperCase()}>',
    'value': ${a.default_value},
    'currency': '${a.currency}'
  });
});`).join('\n')}

### Steg 3 — For WooCommerce-purchases

Hvis klienten har WooCommerce, kan du legge dette i functions.php for å fyre 'purchase'
ved hver fullført ordre:

\`\`\`php
add_action('woocommerce_thankyou', function($order_id) {
  $order = wc_get_order($order_id);
  $total = $order->get_total();
  ?>
  <script>
    gtag('event', 'conversion', {
      'send_to': 'AW-XXXXXXXXXX/<LABEL_PURCHASE>',
      'value': <?php echo esc_js($total); ?>,
      'currency': 'NOK',
      'transaction_id': '<?php echo esc_js($order_id); ?>'
    });
  </script>
  <?php
});
\`\`\`

## Placeholders du må fylle inn
- AW-XXXXXXXXXX     — Google Ads conversion-ID
${actions.map((a) => `- <LABEL_${a.action_name.toUpperCase()}>  — label for ${a.display_name}`).join('\n')}`;
}

// ──────────────────────────────────────────────────────────────────
// ActionCard — én rad i review-listen
// ──────────────────────────────────────────────────────────────────
function ActionCard({
  action,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  action: SuggestedAction;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (a: SuggestedAction) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<SuggestedAction>(action);
  useEffect(() => setDraft(action), [action]);

  if (!isEditing) {
    return (
      <Box
        sx={{
          bgcolor: palette.bgElevated,
          border: `1px solid ${palette.borderSubtle}`,
          borderRadius: 1.6,
          p: 1.8,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.8 }}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4, flexWrap: 'wrap', gap: 0.4 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.96rem', color: palette.textPrimary }}>
                {action.display_name}
              </Typography>
              <Chip
                label={action.goal_category}
                size="small"
                sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accent, fontSize: '0.7rem', height: 18 }}
              />
              <Chip
                label={`${action.default_value} ${action.currency}`}
                size="small"
                sx={{ bgcolor: 'rgba(52,211,153,0.14)', color: '#34d399', fontSize: '0.7rem', height: 18, fontWeight: 700 }}
              />
              <Chip
                label={action.trigger_type}
                size="small"
                sx={{ bgcolor: 'rgba(96,165,250,0.14)', color: '#60a5fa', fontSize: '0.7rem', height: 18 }}
              />
            </Stack>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 0.4 }}>
              <code>{action.action_name}</code>
              {action.url_pattern ? <> · URL-mønster: <code>{action.url_pattern}</code></> : null}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', fontStyle: 'italic', lineHeight: 1.4 }}>
              {action.claude_reasoning}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.4}>
            <IconButton size="small" onClick={onEdit} sx={{ color: palette.textMuted }}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onDelete} sx={{ color: '#f87171' }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: palette.bgElevated,
        border: `1px solid ${palette.borderStrong}`,
        borderRadius: 1.6,
        p: 2,
      }}
    >
      <Stack spacing={1.4}>
        <Stack direction="row" spacing={1.4}>
          <TextField
            label="Action-navn (snake_case) — LÅST"
            value={draft.action_name}
            disabled
            size="small"
            sx={{ flex: 1 }}
            InputProps={{ sx: { color: palette.textMuted, fontFamily: 'monospace', WebkitTextFillColor: palette.textMuted } }}
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            helperText="Kan ikke endres — knyttet til Google Ads-labelen"
            FormHelperTextProps={{ sx: { color: palette.textMuted } }}
          />
          <TextField
            label="Display-navn (norsk)"
            value={draft.display_name}
            onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{ sx: { color: palette.textPrimary } }}
            InputLabelProps={{ sx: { color: palette.textMuted } }}
          />
        </Stack>
        <Stack direction="row" spacing={1.4}>
          <TextField
            select
            label="Goal-kategori"
            value={draft.goal_category}
            onChange={(e) => setDraft({ ...draft, goal_category: e.target.value })}
            size="small"
            sx={{ flex: 1 }}
            SelectProps={{ native: true }}
            InputProps={{ sx: { color: palette.textPrimary } }}
            InputLabelProps={{ sx: { color: palette.textMuted } }}
          >
            {GOAL_CATEGORIES.map((g) => <option key={g.value} value={g.value} style={{ color: '#000' }}>{g.label}</option>)}
          </TextField>
          <TextField
            type="number"
            label="Verdi (NOK)"
            value={draft.default_value}
            onChange={(e) => setDraft({ ...draft, default_value: Number(e.target.value) || 0 })}
            size="small"
            sx={{ width: 140 }}
            InputProps={{ sx: { color: palette.textPrimary } }}
            InputLabelProps={{ sx: { color: palette.textMuted } }}
          />
          <TextField
            select
            label="Trigger-type"
            value={draft.trigger_type}
            onChange={(e) => setDraft({ ...draft, trigger_type: e.target.value })}
            size="small"
            sx={{ flex: 1 }}
            SelectProps={{ native: true }}
            InputProps={{ sx: { color: palette.textPrimary } }}
            InputLabelProps={{ sx: { color: palette.textMuted } }}
          >
            {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value} style={{ color: '#000' }}>{t.label}</option>)}
          </TextField>
        </Stack>
        <TextField
          label="URL-mønster (optional — kun for page_load)"
          value={draft.url_pattern ?? ''}
          onChange={(e) => setDraft({ ...draft, url_pattern: e.target.value || undefined })}
          size="small"
          placeholder="/takk-for-bestillingen*"
          InputProps={{ sx: { color: palette.textPrimary, fontFamily: 'monospace' } }}
          InputLabelProps={{ sx: { color: palette.textMuted } }}
        />
        <Stack direction="row" spacing={1.2} justifyContent="flex-end">
          <Button onClick={onCancel} sx={{ color: palette.textMuted, textTransform: 'none' }}>
            Avbryt
          </Button>
          <Button
            onClick={() => onSave(draft)}
            startIcon={<SaveOutlinedIcon fontSize="small" />}
            sx={{
              background: palette.accentGradient,
              color: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Lagre endring
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
