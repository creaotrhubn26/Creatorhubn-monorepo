import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  PauseCircle as PauseIcon,
  PlayCircle as PlayIcon,
  StopCircle as StopIcon,
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomAdsCampaign,
  type RoleRoomAdsCampaignStatus,
  type RoleRoomMetaAdAccount,
  type RoleRoomLinkedInAccount,
  type RoleRoomLinkedInCampaignGroup,
  type RoleRoomGeneratedAdCreative,
} from '../../services/roleRoomAgentService';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

/**
 * Producer-facing campaign management: see all campaigns (status, budget),
 * pause/resume/end, and create a new Meta campaign. Backed by /ads/* routes.
 * Write paths require Meta App Review (ads_management) in production.
 */

const CARD_SX = {
  p: 1.6,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;
const LABEL = { color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' } as const;
const SUBTLE = { color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' } as const;

const nok = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n);

const buildSTATUS_META = (t: TFn): Record<RoleRoomAdsCampaignStatus, { label: string; color: string; bg: string }> => ({
  active: { label: t('adsMgmt.s000'), color: '#86efac', bg: 'rgba(134,239,172,0.12)' },
  paused: { label: t('adsMgmt.s039'), color: '#fcd34d', bg: 'rgba(252,211,77,0.12)' },
  draft: { label: t('adsMgmt.s051'), color: '#93c5fd', bg: 'rgba(147,197,253,0.12)' },
  ended: { label: t('adsMgmt.s002'), color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.12)' },
  failed: { label: t('adsMgmt.s008'), color: '#fca5a5', bg: 'rgba(252,165,165,0.12)' },
});

const buildOBJECTIVES = (t: TFn) => ([
  { value: 'OUTCOME_TRAFFIC', label: t('adsMgmt.s047') },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_SALES', label: t('adsMgmt.s041') },
  { value: 'OUTCOME_ENGAGEMENT', label: t('adsMgmt.s007') },
  { value: 'OUTCOME_AWARENESS', label: t('adsMgmt.s024') },
]);

// AI-generatorens mål (AdsGoal) — egen vokab fra Meta-objectives.
const buildAD_GOALS = (t: TFn) => ([
  { value: 'lead_generation', label: t('adsMgmt.s030') },
  { value: 'ecommerce_conversion', label: t('adsMgmt.s042') },
  { value: 'engagement', label: t('adsMgmt.s007') },
  { value: 'brand_awareness', label: t('adsMgmt.s033') },
  { value: 'retargeting', label: 'Retargeting' },
]);

export default function AdsManagementPanel({ projectId }: { projectId: string }) {
  const { t } = useT();
  const OBJECTIVES = useMemo(() => buildOBJECTIVES(t), [t]);
  const AD_GOALS = useMemo(() => buildAD_GOALS(t), [t]);
  const STATUS_META = useMemo(() => buildSTATUS_META(t), [t]);
  // OAuth popup poll lives in an event handler, not an effect — track it so we
  // can clear it on unmount and never setState on a dead component.
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    if (oauthPollRef.current) clearInterval(oauthPollRef.current);
  }, []);

  const [campaigns, setCampaigns] = useState<RoleRoomAdsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [adAccounts, setAdAccounts] = useState<RoleRoomMetaAdAccount[]>([]);
  const [googleCustomers, setGoogleCustomers] = useState<string[]>([]);
  const [linkedinAccounts, setLinkedinAccounts] = useState<RoleRoomLinkedInAccount[]>([]);
  const [linkedinGroups, setLinkedinGroups] = useState<RoleRoomLinkedInCampaignGroup[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    platform: 'meta' | 'google' | 'linkedin';
    adAccountId: string;
    customerId: string;
    linkedinAccountUrn: string;
    linkedinGroupUrn: string;
    name: string;
    objective: string;
    dailyBudgetNok: string;
  }>({ platform: 'meta', adAccountId: '', customerId: '', linkedinAccountUrn: '', linkedinGroupUrn: '', name: '', objective: 'OUTCOME_TRAFFIC', dailyBudgetNok: '' });
  const [creating, setCreating] = useState(false);

  // OAuth-flow state — hvilken plattform er midt-i-koble (åpner popup-window)
  const [oauthStarting, setOauthStarting] = useState<'google' | 'linkedin' | null>(null);

  /**
   * Start ads-OAuth-flowen for én plattform. Backend gir oss en autoriserings-
   * URL vi åpner i et popup-vindu — brukeren godkjenner mot Google/LinkedIn,
   * callback lander i Role Room, popup-en lukker seg, og vi re-fetcher
   * konto-listene så dropdownen oppdaterer seg.
   */
  const startAdsOauth = async (platform: 'google' | 'linkedin') => {
    setOauthStarting(platform);
    setAccountError(null);
    try {
      const returnPath = window.location.pathname + window.location.search;
      const res = await fetch(`/api/role-room/ads/${platform}/oauth/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          browserOrigin: window.location.origin,
          returnPath,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAccountError(
          body.detail || body.error || t('adsMgmt.p01', { v0: platform, v1: res.status }),
        );
        setOauthStarting(null);
        return;
      }
      const { authorizationUrl } = await res.json();
      // Åpne popup. Callback lukker den + post-message-r oss
      const popup = window.open(authorizationUrl, '_blank', 'width=620,height=740,noopener=no,popup=yes');
      if (!popup) {
        setAccountError(t('adsMgmt.s040'));
        setOauthStarting(null);
        return;
      }
      // Poll for at popup lukkes — da re-fetch kontolisten. Capped so an
      // orphaned/never-closed popup stops after ~15 min instead of polling
      // forever; cleared on unmount via oauthPollRef.
      if (oauthPollRef.current) clearInterval(oauthPollRef.current);
      let pollAttempts = 0;
      const maxPollAttempts = Math.ceil((15 * 60 * 1000) / 800);
      const pollInterval = setInterval(async () => {
        pollAttempts += 1;
        const expired = pollAttempts >= maxPollAttempts;
        if (!popup.closed && !expired) return;
        clearInterval(pollInterval);
        oauthPollRef.current = null;
        if (!mountedRef.current) return;
        setOauthStarting(null);
        if (expired && !popup.closed) return; // gave up; don't re-fetch
        // Re-fetch så den nye koblingen vises i dropdown
        if (platform === 'google') {
          const google = await roleRoomAgentService.listGoogleCustomers();
          if (mountedRef.current && !('error' in google)) {
            setGoogleCustomers(google.customers);
            if (google.customers[0] && !form.customerId) {
              setForm((f) => ({ ...f, customerId: google.customers[0] }));
            }
          }
        } else if (platform === 'linkedin') {
          const linkedin = await roleRoomAgentService.listLinkedInAccounts();
          if (mountedRef.current && !('error' in linkedin)) {
            setLinkedinAccounts(linkedin.accounts);
            if (linkedin.accounts[0] && !form.linkedinAccountUrn) {
              setForm((f) => ({ ...f, linkedinAccountUrn: linkedin.accounts[0].id }));
            }
          }
        }
      }, 800);
      oauthPollRef.current = pollInterval;
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : t('adsMgmt.s050'));
      setOauthStarting(null);
    }
  };

  // AI-annonsetekst (Lag 1)
  const [aiGoal, setAiGoal] = useState('lead_generation');
  const [aiInputs, setAiInputs] = useState({ businessName: '', productOrService: '', landingUrl: '', offer: '', complianceNotes: '' });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<RoleRoomGeneratedAdCreative | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);

  const runGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    const res = await roleRoomAgentService.generateAdCreatives({
      projectId,
      platform: form.platform,
      goal: aiGoal,
      businessName: aiInputs.businessName.trim() || undefined,
      productOrService: aiInputs.productOrService.trim() || undefined,
      landingUrl: aiInputs.landingUrl.trim() || undefined,
      offer: aiInputs.offer.trim() || undefined,
      complianceNotes: aiInputs.complianceNotes.trim() || undefined,
    });
    if ('error' in res) {
      const missing = res.missingFields?.length ? t('adsMgmt.p00', { v0: res.missingFields.join(', ') }) : '';
      setGenError(res.error + missing);
      setGenerated(null);
    } else {
      setGenerated(res.creative);
      setSelectedVariant(0);
      // Foreslå kampanjenavn fra valgt variant hvis tomt.
      if (!form.name.trim() && res.creative.variants[0]?.headline) {
        setForm((f) => ({ ...f, name: res.creative.variants[0].headline.slice(0, 60) }));
      }
    }
    setGenerating(false);
  };

  // Pakk valgt variant + hele settet som creative_config på kampanjen.
  const buildCreativeConfig = (): Record<string, unknown> | null => {
    if (!generated) return null;
    return {
      source: 'ai',
      generatedWithModel: generated.generatedWithModel,
      goal: generated.goal,
      landingUrl: generated.landingUrl ?? null,
      selectedVariantIndex: selectedVariant,
      selectedVariant: generated.variants[selectedVariant] ?? null,
      variants: generated.variants,
      complianceChecklist: generated.complianceChecklist ?? [],
    };
  };

  // Load LinkedIn campaign groups when the chosen LinkedIn account changes.
  useEffect(() => {
    if (form.platform !== 'linkedin' || !form.linkedinAccountUrn) return;
    let cancelled = false;
    (async () => {
      const res = await roleRoomAgentService.listLinkedInCampaignGroups(form.linkedinAccountUrn);
      if (cancelled) return;
      const groups = 'error' in res ? [] : res.groups;
      setLinkedinGroups(groups);
      setForm((f) => ({ ...f, linkedinGroupUrn: groups[0]?.id ?? '' }));
    })();
    return () => { cancelled = true; };
  }, [form.platform, form.linkedinAccountUrn]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await roleRoomAgentService.listAdsCampaigns({ projectId }));
    } catch {
      setError(t('adsMgmt.s025'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const act = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    setError(null);
    const res = await fn();
    if (!res.ok) setError(res.error || t('adsMgmt.s010'));
    await refresh();
    setBusyId(null);
  };

  const openCreate = async () => {
    const next = !createOpen;
    setCreateOpen(next);
    if (next && adAccounts.length === 0 && googleCustomers.length === 0 && linkedinAccounts.length === 0) {
      setAccountError(null);
      const [meta, google, linkedin] = await Promise.all([
        roleRoomAgentService.listMetaAdAccounts(),
        roleRoomAgentService.listGoogleCustomers(),
        roleRoomAgentService.listLinkedInAccounts(),
      ]);
      if (!('error' in meta)) {
        setAdAccounts(meta.accounts);
        if (meta.accounts[0]) setForm((f) => ({ ...f, adAccountId: meta.accounts[0].id }));
      }
      if (!('error' in google)) {
        setGoogleCustomers(google.customers);
        if (google.customers[0]) setForm((f) => ({ ...f, customerId: google.customers[0] }));
      }
      if (!('error' in linkedin)) {
        setLinkedinAccounts(linkedin.accounts);
        if (linkedin.accounts[0]) setForm((f) => ({ ...f, linkedinAccountUrn: linkedin.accounts[0].id }));
      }
      if ('error' in meta && 'error' in google && 'error' in linkedin) {
        setAccountError(t('adsMgmt.s017'));
      }
    }
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return;
    const budget = form.dailyBudgetNok ? Number(form.dailyBudgetNok) : undefined;
    setCreating(true);
    setError(null);
    let res: { campaign: unknown } | { error: string };
    const creativeConfig = buildCreativeConfig();
    if (form.platform === 'google') {
      if (!form.customerId) { setError(t('adsMgmt.s052')); setCreating(false); return; }
      res = await roleRoomAgentService.createGoogleAdsCampaign({
        projectId, customerId: form.customerId, name: form.name.trim(), dailyBudgetNok: budget ?? 0, creativeConfig,
      });
    } else if (form.platform === 'linkedin') {
      if (!form.linkedinAccountUrn) { setError(t('adsMgmt.s053')); setCreating(false); return; }
      if (!form.linkedinGroupUrn) { setError(t('adsMgmt.s054')); setCreating(false); return; }
      res = await roleRoomAgentService.createLinkedInAdsCampaign({
        projectId,
        accountUrn: form.linkedinAccountUrn,
        campaignGroupUrn: form.linkedinGroupUrn,
        name: form.name.trim(),
        dailyBudgetNok: budget ?? 0,
        creativeConfig,
      });
    } else {
      if (!form.adAccountId) { setError(t('adsMgmt.s055')); setCreating(false); return; }
      res = await roleRoomAgentService.createMetaCampaign({
        projectId, adAccountId: form.adAccountId, name: form.name.trim(), objective: form.objective, dailyBudgetNok: budget, creativeConfig,
      });
    }
    if ('error' in res) setError(res.error);
    else {
      setCreateOpen(false);
      setForm((f) => ({ ...f, name: '', dailyBudgetNok: '' }));
      setGenerated(null);
      setGenError(null);
      await refresh();
    }
    setCreating(false);
  };

  const activeCount = campaigns.filter((c) => c.status === 'active').length;

  return (
    <Stack spacing={1.2} sx={CARD_SX}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CampaignIcon sx={{ fontSize: 20, color: '#f0abfc' }} />
        <Typography sx={LABEL}>{t('adsMgmt.s001')}</Typography>
        {campaigns.length > 0 && (
          <Chip
            size="small"
            label={t('adsMgmt.p02', { v0: activeCount, v1: campaigns.length })}
            sx={{ fontWeight: 700, color: '#e2e8f0', bgcolor: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.2)' }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ textTransform: 'none', color: '#f0abfc', fontWeight: 700 }}
        >
          {t('adsMgmt.s036')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>{error}</Alert>}

      {/* MCC ↔ kunde-invitasjon (Google Ads): ett-klikk i stedet for at klient
          må gjøre 9 trinn i sin Google Ads-UI. */}
      <MccInviteSection />

      {/* Opprett-kampanje-skjema */}
      <Collapse in={createOpen} unmountOnExit>
        <Stack spacing={1} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.16)' }}>
          {accountError ? (
            <Alert
              severity="warning"
              sx={{ '& .MuiAlert-message': { fontSize: '0.78rem', width: '100%' } }}
            >
              <Stack spacing={1}>
                <Box>{accountError}</Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => startAdsOauth('google')}
                    disabled={oauthStarting === 'google'}
                    sx={{ textTransform: 'none' }}
                  >
                    {oauthStarting === 'google' ? t('adsMgmt.s061') : t('adsMgmt.s026')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => startAdsOauth('linkedin')}
                    disabled={oauthStarting === 'linkedin'}
                    sx={{ textTransform: 'none' }}
                  >
                    {oauthStarting === 'linkedin' ? t('adsMgmt.s061') : t('adsMgmt.s027')}
                  </Button>
                </Stack>
              </Stack>
            </Alert>
          ) : (
            <>
              {/* Plattform-velger */}
              <TextField select size="small" label="Plattform" value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value as 'meta' | 'google' | 'linkedin' })} sx={fieldSx}>
                <MenuItem value="meta">Meta (Facebook/Instagram)</MenuItem>
                <MenuItem value="google">Google Ads</MenuItem>
                <MenuItem value="linkedin">LinkedIn Ads</MenuItem>
              </TextField>

              {form.platform === 'meta' && (
                <TextField select size="small" label="Annonsekonto (Meta)" value={form.adAccountId}
                  onChange={(e) => setForm({ ...form, adAccountId: e.target.value })} sx={fieldSx}>
                  {adAccounts.length === 0 && <MenuItem value="" disabled>{t('adsMgmt.s016')}</MenuItem>}
                  {adAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.name} ({a.currency})</MenuItem>
                  ))}
                </TextField>
              )}
              {form.platform === 'google' && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField select size="small" label="Google Ads-konto (Customer ID)" value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })} sx={{ ...fieldSx, flex: 1 }}>
                    {googleCustomers.length === 0 && <MenuItem value="" disabled>{t('adsMgmt.s014')}</MenuItem>}
                    {googleCustomers.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </TextField>
                  {googleCustomers.length === 0 && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => startAdsOauth('google')}
                      disabled={oauthStarting === 'google'}
                      sx={{ textTransform: 'none', color: '#fde68a', borderColor: 'rgba(253,230,138,0.4)', whiteSpace: 'nowrap' }}
                    >
                      {oauthStarting === 'google' ? t('adsMgmt.s061') : t('adsMgmt.s026')}
                    </Button>
                  )}
                </Stack>
              )}
              {form.platform === 'linkedin' && (
                <>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField select size="small" label="Annonsekonto (LinkedIn)" value={form.linkedinAccountUrn}
                      onChange={(e) => setForm({ ...form, linkedinAccountUrn: e.target.value, linkedinGroupUrn: '' })} sx={{ ...fieldSx, flex: 1 }}>
                      {linkedinAccounts.length === 0 && <MenuItem value="" disabled>{t('adsMgmt.s015')}</MenuItem>}
                      {linkedinAccounts.map((a) => (
                        <MenuItem key={a.id} value={a.id}>{a.name || a.id}</MenuItem>
                      ))}
                    </TextField>
                    {linkedinAccounts.length === 0 && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => startAdsOauth('linkedin')}
                        disabled={oauthStarting === 'linkedin'}
                        sx={{ textTransform: 'none', color: '#fde68a', borderColor: 'rgba(253,230,138,0.4)', whiteSpace: 'nowrap' }}
                      >
                        {oauthStarting === 'linkedin' ? t('adsMgmt.s061') : t('adsMgmt.s027')}
                      </Button>
                    )}
                  </Stack>
                  <TextField select size="small" label="Kampanjegruppe (LinkedIn)" value={form.linkedinGroupUrn}
                    onChange={(e) => setForm({ ...form, linkedinGroupUrn: e.target.value })} sx={fieldSx}
                    disabled={!form.linkedinAccountUrn}>
                    {linkedinGroups.length === 0 && <MenuItem value="" disabled>{t('adsMgmt.s019')}</MenuItem>}
                    {linkedinGroups.map((g) => (
                      <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                    ))}
                  </TextField>
                </>
              )}

              <TextField size="small" label="Kampanjenavn" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} sx={fieldSx} />
              <Stack direction="row" spacing={1}>
                {form.platform === 'meta' && (
                  <TextField select size="small" label={t('adsMgmt.s034')} value={form.objective}
                    onChange={(e) => setForm({ ...form, objective: e.target.value })} sx={{ ...fieldSx, flex: 1 }}>
                    {OBJECTIVES.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                )}
                <TextField size="small" type="number" label="Dagsbudsjett NOK" value={form.dailyBudgetNok}
                  onChange={(e) => setForm({ ...form, dailyBudgetNok: e.target.value })} sx={{ ...fieldSx, maxWidth: 150 }} />
              </Stack>

              {/* ── AI-annonsetekst (Lag 1): agenten lager riktig copy fra bedriften ── */}
              <Stack spacing={0.9} sx={{ mt: 0.5, p: 1, borderRadius: 1.5, bgcolor: 'rgba(240,171,252,0.06)', border: '1px solid rgba(240,171,252,0.22)' }}>
                <Stack direction="row" alignItems="center" spacing={0.8}>
                  <AutoAwesomeIcon sx={{ fontSize: 17, color: '#f0abfc' }} />
                  <Typography sx={{ color: '#f0abfc', fontWeight: 700, fontSize: '0.82rem' }}>AI-annonsetekst</Typography>
                </Stack>
                <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>
                  {t('adsMgmt.s004')}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField select size="small" label={t('adsMgmt.s035')} value={aiGoal}
                    onChange={(e) => setAiGoal(e.target.value)} sx={{ ...fieldSx, flex: 1 }}>
                    {AD_GOALS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Bedriftsnavn" value={aiInputs.businessName}
                    onChange={(e) => setAiInputs({ ...aiInputs, businessName: e.target.value })} sx={{ ...fieldSx, flex: 1 }} />
                </Stack>
                <TextField size="small" label={t('adsMgmt.s012')} value={aiInputs.productOrService}
                  onChange={(e) => setAiInputs({ ...aiInputs, productOrService: e.target.value })} sx={fieldSx} />
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Landingsside-URL" value={aiInputs.landingUrl}
                    onChange={(e) => setAiInputs({ ...aiInputs, landingUrl: e.target.value })} sx={{ ...fieldSx, flex: 1 }} />
                  <TextField size="small" label="Tilbud / hook (valgfritt)" value={aiInputs.offer}
                    onChange={(e) => setAiInputs({ ...aiInputs, offer: e.target.value })} sx={{ ...fieldSx, flex: 1 }} />
                </Stack>
                <TextField size="small" label={t('adsMgmt.s005')} value={aiInputs.complianceNotes}
                  onChange={(e) => setAiInputs({ ...aiInputs, complianceNotes: e.target.value })} sx={fieldSx}
                  multiline minRows={1} />
                <Button size="small" variant="outlined" startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                  disabled={generating}
                  onClick={runGenerate}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#f0abfc', borderColor: 'rgba(240,171,252,0.4)', alignSelf: 'flex-start' }}>
                  {generating ? 'Genererer…' : generated ? t('adsMgmt.s009') : 'Generer annonsetekst'}
                </Button>

                {genError && (
                  <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.74rem' } }}>{genError}</Alert>
                )}

                {generated && (
                  <Stack spacing={0.8}>
                    <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>
                      {generated.variants.length} {t('adsMgmt.s060')}
                      {generated.usage?.costNok != null ? ` · ~${nok(generated.usage.costNok)} AI-kost` : ''}
                    </Typography>
                    {generated.variants.map((v, i) => {
                      const selected = i === selectedVariant;
                      return (
                        <Box key={i} onClick={() => setSelectedVariant(i)}
                          sx={{
                            p: 1, borderRadius: 1.2, cursor: 'pointer',
                            bgcolor: selected ? 'rgba(240,171,252,0.12)' : 'rgba(148,163,184,0.06)',
                            border: `1px solid ${selected ? 'rgba(240,171,252,0.6)' : 'rgba(148,163,184,0.18)'}`,
                          }}>
                          <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.82rem' }}>
                            {selected ? '● ' : '○ '}{v.headline}
                          </Typography>
                          {v.headlines && v.headlines.length > 0 && (
                            <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>{v.headlines.join(' · ')}</Typography>
                          )}
                          {v.primaryText && (
                            <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.76rem', mt: 0.3 }}>{v.primaryText}</Typography>
                          )}
                          {v.descriptions && v.descriptions.length > 0 && (
                            <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.76rem', mt: 0.3 }}>{v.descriptions.join(' • ')}</Typography>
                          )}
                          <Stack direction="row" spacing={0.6} sx={{ mt: 0.4, flexWrap: 'wrap', gap: 0.4 }}>
                            {v.callToAction && <Chip size="small" label={v.callToAction} sx={{ height: 18, fontSize: '0.66rem', color: '#f0abfc', bgcolor: 'rgba(240,171,252,0.1)' }} />}
                            {v.rationale && <Typography sx={{ ...SUBTLE, fontSize: '0.68rem', fontStyle: 'italic' }}>{v.rationale}</Typography>}
                          </Stack>
                          {v.imageBrief && (
                            <Typography sx={{ ...SUBTLE, fontSize: '0.68rem', mt: 0.3 }}>{v.imageBrief}</Typography>
                          )}
                        </Box>
                      );
                    })}
                    {generated.complianceChecklist && generated.complianceChecklist.length > 0 && (
                      <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '0.72rem' } }}>
                        <strong>{t('adsMgmt.s057')}</strong>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                          {generated.complianceChecklist.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </Alert>
                    )}
                  </Stack>
                )}
              </Stack>

              <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>
                {t('adsMgmt.s022')} <strong>{t('adsMgmt.s059')}</strong> {t('adsMgmt.s062')}
              </Typography>
              <Button variant="contained" size="small"
                disabled={
                  creating || !form.name.trim() ||
                  (form.platform === 'meta' ? !form.adAccountId
                    : form.platform === 'google' ? !form.customerId
                    : (!form.linkedinAccountUrn || !form.linkedinGroupUrn))
                }
                onClick={submitCreate} sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}>
                {creating ? 'Oppretter…' : t('adsMgmt.s038')}
              </Button>
            </>
          )}
        </Stack>
      </Collapse>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
          <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
          <Typography sx={SUBTLE}>{t('adsMgmt.s011')}</Typography>
        </Stack>
      ) : campaigns.length === 0 ? (
        <Typography sx={SUBTLE}>{t('adsMgmt.s020')}</Typography>
      ) : (
        <Stack spacing={0.75}>
          {campaigns.map((c) => {
            const sm = STATUS_META[c.status];
            const busy = busyId === c.id;
            // Platform-aware lifecycle controls (Meta + Google). LinkedIn = reporting only.
            const ctl =
              c.platform === 'meta'
                ? {
                    pause: () => roleRoomAgentService.pauseAdsCampaign(c.id),
                    resume: () => roleRoomAgentService.resumeAdsCampaign(c.id),
                    end: () => roleRoomAgentService.endAdsCampaign(c.id),
                  }
                : c.platform === 'google'
                  ? {
                      pause: () => roleRoomAgentService.pauseGoogleCampaign(c.id),
                      resume: () => roleRoomAgentService.resumeGoogleCampaign(c.id),
                      end: () => roleRoomAgentService.endGoogleCampaign(c.id),
                    }
                  : c.platform === 'linkedin'
                    ? {
                        pause: () => roleRoomAgentService.pauseLinkedInCampaign(c.id),
                        resume: () => roleRoomAgentService.resumeLinkedInCampaign(c.id),
                        end: () => roleRoomAgentService.endLinkedInCampaign(c.id),
                      }
                    : null;
            return (
              <Stack
                key={c.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.16)' }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                    {c.goal || c.externalCampaignId || c.id}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem' }} noWrap>
                    {c.platform} · dagsbudsjett {nok(c.dailyBudgetNok)}
                  </Typography>
                </Box>
                <Chip size="small" label={sm.label} sx={{ fontWeight: 700, color: sm.color, bgcolor: sm.bg, border: `1px solid ${sm.color}55` }} />
                {busy ? (
                  <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
                ) : !ctl ? (
                  // LinkedIn (m.fl.) er foreløpig kun rapportering — ingen styring ennå.
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem' }}>
                    {t('adsMgmt.s028')}
                  </Typography>
                ) : (
                  <Stack direction="row" spacing={0.5}>
                    {c.status === 'active' && (
                      <Button size="small" startIcon={<PauseIcon sx={{ fontSize: 16 }} />}
                        onClick={() => act(c.id, ctl.pause)}
                        sx={{ textTransform: 'none', color: '#fcd34d', minWidth: 0 }}>Pause</Button>
                    )}
                    {(c.status === 'paused' || c.status === 'draft') && (
                      <Button size="small" startIcon={<PlayIcon sx={{ fontSize: 16 }} />}
                        onClick={() => act(c.id, ctl.resume)}
                        sx={{ textTransform: 'none', color: '#86efac', minWidth: 0 }}>{t('adsMgmt.s045')}</Button>
                    )}
                    {c.status !== 'ended' && (
                      <Button size="small" startIcon={<StopIcon sx={{ fontSize: 16 }} />}
                        onClick={() => { if (window.confirm('Avslutte kampanjen permanent?')) void act(c.id, ctl.end); }}
                        sx={{ textTransform: 'none', color: '#fca5a5', minWidth: 0 }}>Avslutt</Button>
                    )}
                  </Stack>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

const fieldSx = {
  '& .MuiInputBase-input': { color: '#e2e8f0' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.6)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
  '& .MuiSvgIcon-root': { color: 'rgba(226,232,240,0.6)' },
} as const;

// ─── MccInviteSection ────────────────────────────────────────
// Lar produsenten lime inn 10-sifret Google Ads customer-id og sende
// invitasjon fra MCC. Klienten ser invitasjonen som notifikasjon i
// sin Google Ads og kan godkjenne med ett klikk.

type MccLink = {
  clientCustomerId: string;
  status: 'PENDING' | 'ACTIVE' | 'REFUSED' | 'CANCELED' | 'INACTIVE' | 'UNKNOWN';
  managerLinkId: string | null;
  hidden: boolean;
};

const buildMCC_STATUS_META = (t: TFn): Record<MccLink['status'], { color: string; bg: string; label: string }> => ({
  PENDING: { color: '#fcd34d', bg: 'rgba(252,211,77,0.12)', label: t('adsMgmt.s056') },
  ACTIVE: { color: '#86efac', bg: 'rgba(134,239,172,0.12)', label: t('adsMgmt.s046') },
  REFUSED: { color: '#fca5a5', bg: 'rgba(252,165,165,0.12)', label: t('adsMgmt.s003') },
  CANCELED: { color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.12)', label: t('adsMgmt.s023') },
  INACTIVE: { color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.12)', label: t('adsMgmt.s013') },
  UNKNOWN: { color: '#cbd5e1', bg: 'rgba(148,163,184,0.12)', label: t('adsMgmt.s048') },
});

// Formater 10-sifret id til "XXX-XXX-XXXX" for visning
const fmtCustomerId = (digits: string): string => {
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

function MccInviteSection() {
  const { t } = useT();
  const MCC_STATUS_META = useMemo(() => buildMCC_STATUS_META(t), [t]);
  const [expanded, setExpanded] = useState(false);
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [links, setLinks] = useState<MccLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const fetchLinks = async () => {
    setLoadingLinks(true);
    setListError(null);
    try {
      const res = await fetch('/api/role-room/ads/google/mcc/links', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setListError(body.detail || body.error || `HTTP ${res.status}`);
        setLinks([]);
        return;
      }
      const data = await res.json();
      setLinks(data.links || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : t('adsMgmt.s049'));
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (expanded && links.length === 0 && !listError) void fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Auto-polling: mens panelet er åpent OG vi har minst én PENDING-link,
  // poll hvert 30. sek for å fange status-endringer (klient godkjenner /
  // avviser invitasjon) uten at produsenten må klikke 'Oppdater' selv.
  // Derive the boolean in render and depend on IT, not the whole links array —
  // otherwise every poll result (setLinks) re-ran this effect and tore
  // down/recreated the interval, so the 30s timer rarely elapsed cleanly.
  const hasPendingLink = links.some((l) => l.status === 'PENDING');
  useEffect(() => {
    if (!expanded || !hasPendingLink) return;
    const interval = setInterval(() => {
      void fetchLinks();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, hasPendingLink]);

  const sendInvite = async () => {
    const digits = customerIdInput.replace(/[^0-9]/g, '');
    if (digits.length !== 10) {
      setSendError(t('adsMgmt.s006'));
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/role-room/ads/google/mcc/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customerId: digits }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(body.detail || body.error || `HTTP ${res.status}`);
        return;
      }
      // Suksess — legg til i lokal liste optimistisk, re-fetch så vi får ekte data
      setCustomerIdInput('');
      setLinks((cur) => [
        { clientCustomerId: digits, status: 'PENDING', managerLinkId: body.managerLinkId, hidden: false },
        ...cur.filter((l) => l.clientCustomerId !== digits),
      ]);
      // Re-fetch etter 2 sek for å bekrefte status fra API
      setTimeout(() => void fetchLinks(), 2000);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : t('adsMgmt.s049'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack sx={{ ...CARD_SX, p: 1.2 }} spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CampaignIcon sx={{ fontSize: 18, color: '#fcd34d' }} />
        <Typography sx={{ color: '#fcd34d', fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>
          {t('adsMgmt.s021')}
        </Typography>
        <Button
          size="small"
          onClick={() => setExpanded((cur) => !cur)}
          sx={{ textTransform: 'none', color: '#fcd34d', fontSize: '0.76rem' }}
        >
          {expanded ? t('adsMgmt.s044') : t('adsMgmt.s058')}
        </Button>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={1.2} sx={{ pt: 0.5 }}>
          <Typography sx={SUBTLE}>
            {t('adsMgmt.s031')}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label={t('adsMgmt.s029')}
              placeholder="123-456-7890"
              value={customerIdInput}
              onChange={(e) => setCustomerIdInput(e.target.value.slice(0, 14))}
              sx={{ ...fieldSx, flex: 1 }}
            />
            <Button
              size="small"
              variant="contained"
              disabled={sending || customerIdInput.replace(/[^0-9]/g, '').length !== 10}
              onClick={sendInvite}
              sx={{
                textTransform: 'none',
                bgcolor: '#6366f1',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#4f46e5' },
              }}
            >
              {sending ? 'Sender…' : t('adsMgmt.s043')}
            </Button>
          </Stack>

          {sendError && (
            <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.76rem' } }}>
              {sendError}
            </Alert>
          )}

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.82rem' }}>
              {t('adsMgmt.s032')}{links.length})
            </Typography>
            <Button
              size="small"
              onClick={() => void fetchLinks()}
              disabled={loadingLinks}
              sx={{ textTransform: 'none', color: '#a5b4fc', fontSize: '0.74rem' }}
            >
              {loadingLinks ? 'Oppdaterer…' : t('adsMgmt.s037')}
            </Button>
          </Stack>

          {listError && (
            <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.74rem' } }}>
              {listError}
            </Alert>
          )}

          {links.length === 0 && !loadingLinks && !listError && (
            <Typography sx={{ ...SUBTLE, fontStyle: 'italic' }}>
              {t('adsMgmt.s018')}
            </Typography>
          )}

          {links.map((link) => {
            const meta = MCC_STATUS_META[link.status];
            return (
              <Stack
                key={`${link.clientCustomerId}-${link.managerLinkId ?? 'no-link'}`}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  p: 0.8,
                  borderRadius: 1,
                  bgcolor: 'rgba(148,163,184,0.06)',
                  border: '1px solid rgba(148,163,184,0.16)',
                }}
              >
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.82rem', flex: 1 }}>
                  {fmtCustomerId(link.clientCustomerId)}
                </Typography>
                <Chip
                  label={meta.label}
                  size="small"
                  sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
                />
              </Stack>
            );
          })}
        </Stack>
      </Collapse>
    </Stack>
  );
}
