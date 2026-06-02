import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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

const STATUS_META: Record<RoleRoomAdsCampaignStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Aktiv', color: '#86efac', bg: 'rgba(134,239,172,0.12)' },
  paused: { label: 'Pauset', color: '#fcd34d', bg: 'rgba(252,211,77,0.12)' },
  draft: { label: 'Utkast', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)' },
  ended: { label: 'Avsluttet', color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.12)' },
  failed: { label: 'Feilet', color: '#fca5a5', bg: 'rgba(252,165,165,0.12)' },
};

const OBJECTIVES = [
  { value: 'OUTCOME_TRAFFIC', label: 'Trafikk' },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_SALES', label: 'Salg' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engasjement' },
  { value: 'OUTCOME_AWARENESS', label: 'Kjennskap' },
];

// AI-generatorens mål (AdsGoal) — egen vokab fra Meta-objectives.
const AD_GOALS = [
  { value: 'lead_generation', label: 'Lead-generering' },
  { value: 'ecommerce_conversion', label: 'Salg / konvertering' },
  { value: 'engagement', label: 'Engasjement' },
  { value: 'brand_awareness', label: 'Merkekjennskap' },
  { value: 'retargeting', label: 'Retargeting' },
];

export default function AdsManagementPanel({ projectId }: { projectId: string }) {
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
      const missing = res.missingFields?.length ? ` (mangler: ${res.missingFields.join(', ')})` : '';
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
      setError('Klarte ikke å hente kampanjer.');
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
    if (!res.ok) setError(res.error || 'Handlingen feilet.');
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
        setAccountError('Ingen annonsekontoer tilgjengelig — koble Meta, Google eller LinkedIn først.');
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
      if (!form.customerId) { setError('Velg en Google-konto.'); setCreating(false); return; }
      res = await roleRoomAgentService.createGoogleAdsCampaign({
        projectId, customerId: form.customerId, name: form.name.trim(), dailyBudgetNok: budget ?? 0, creativeConfig,
      });
    } else if (form.platform === 'linkedin') {
      if (!form.linkedinAccountUrn) { setError('Velg en LinkedIn-annonsekonto.'); setCreating(false); return; }
      if (!form.linkedinGroupUrn) { setError('Velg en LinkedIn-kampanjegruppe.'); setCreating(false); return; }
      res = await roleRoomAgentService.createLinkedInAdsCampaign({
        projectId,
        accountUrn: form.linkedinAccountUrn,
        campaignGroupUrn: form.linkedinGroupUrn,
        name: form.name.trim(),
        dailyBudgetNok: budget ?? 0,
        creativeConfig,
      });
    } else {
      if (!form.adAccountId) { setError('Velg en Meta-annonsekonto.'); setCreating(false); return; }
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
        <Typography sx={LABEL}>Annonser</Typography>
        {campaigns.length > 0 && (
          <Chip
            size="small"
            label={`${activeCount} aktive / ${campaigns.length} totalt`}
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
          Ny kampanje
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>{error}</Alert>}

      {/* Opprett-kampanje-skjema */}
      <Collapse in={createOpen} unmountOnExit>
        <Stack spacing={1} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.16)' }}>
          {accountError ? (
            <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
              {accountError}
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
                  {adAccounts.length === 0 && <MenuItem value="" disabled>Ingen Meta-kontoer — koble Meta</MenuItem>}
                  {adAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.name} ({a.currency})</MenuItem>
                  ))}
                </TextField>
              )}
              {form.platform === 'google' && (
                <TextField select size="small" label="Google Ads-konto (Customer ID)" value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })} sx={fieldSx}>
                  {googleCustomers.length === 0 && <MenuItem value="" disabled>Ingen Google-kontoer — koble Google Ads</MenuItem>}
                  {googleCustomers.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              )}
              {form.platform === 'linkedin' && (
                <>
                  <TextField select size="small" label="Annonsekonto (LinkedIn)" value={form.linkedinAccountUrn}
                    onChange={(e) => setForm({ ...form, linkedinAccountUrn: e.target.value, linkedinGroupUrn: '' })} sx={fieldSx}>
                    {linkedinAccounts.length === 0 && <MenuItem value="" disabled>Ingen LinkedIn-kontoer — koble LinkedIn</MenuItem>}
                    {linkedinAccounts.map((a) => (
                      <MenuItem key={a.id} value={a.id}>{a.name || a.id}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Kampanjegruppe (LinkedIn)" value={form.linkedinGroupUrn}
                    onChange={(e) => setForm({ ...form, linkedinGroupUrn: e.target.value })} sx={fieldSx}
                    disabled={!form.linkedinAccountUrn}>
                    {linkedinGroups.length === 0 && <MenuItem value="" disabled>Ingen kampanjegrupper på kontoen</MenuItem>}
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
                  <TextField select size="small" label="Mål" value={form.objective}
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
                  CI lager plattform-tilpasset tekst fra bedriftens marketing-plan + det du fyller inn under. Du velger variant og redigerer før kampanjen opprettes.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField select size="small" label="Mål for annonsen" value={aiGoal}
                    onChange={(e) => setAiGoal(e.target.value)} sx={{ ...fieldSx, flex: 1 }}>
                    {AD_GOALS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                  </TextField>
                  <TextField size="small" label="Bedriftsnavn" value={aiInputs.businessName}
                    onChange={(e) => setAiInputs({ ...aiInputs, businessName: e.target.value })} sx={{ ...fieldSx, flex: 1 }} />
                </Stack>
                <TextField size="small" label="Hva annonseres (produkt/tjeneste)" value={aiInputs.productOrService}
                  onChange={(e) => setAiInputs({ ...aiInputs, productOrService: e.target.value })} sx={fieldSx} />
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Landingsside-URL" value={aiInputs.landingUrl}
                    onChange={(e) => setAiInputs({ ...aiInputs, landingUrl: e.target.value })} sx={{ ...fieldSx, flex: 1 }} />
                  <TextField size="small" label="Tilbud / hook (valgfritt)" value={aiInputs.offer}
                    onChange={(e) => setAiInputs({ ...aiInputs, offer: e.target.value })} sx={{ ...fieldSx, flex: 1 }} />
                </Stack>
                <TextField size="small" label="Compliance-forbud (f.eks. ingen helsepåstander)" value={aiInputs.complianceNotes}
                  onChange={(e) => setAiInputs({ ...aiInputs, complianceNotes: e.target.value })} sx={fieldSx}
                  multiline minRows={1} />
                <Button size="small" variant="outlined" startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                  disabled={generating}
                  onClick={runGenerate}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#f0abfc', borderColor: 'rgba(240,171,252,0.4)', alignSelf: 'flex-start' }}>
                  {generating ? 'Genererer…' : generated ? 'Generer på nytt' : 'Generer annonsetekst'}
                </Button>

                {genError && (
                  <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.74rem' } }}>{genError}</Alert>
                )}

                {generated && (
                  <Stack spacing={0.8}>
                    <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>
                      {generated.variants.length} varianter · velg én (lagres med kampanjen)
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
                            <Typography sx={{ ...SUBTLE, fontSize: '0.68rem', mt: 0.3 }}>🎨 {v.imageBrief}</Typography>
                          )}
                        </Box>
                      );
                    })}
                    {generated.complianceChecklist && generated.complianceChecklist.length > 0 && (
                      <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '0.72rem' } }}>
                        <strong>Verifiser før publisering:</strong>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                          {generated.complianceChecklist.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </Alert>
                    )}
                  </Stack>
                )}
              </Stack>

              <Typography sx={{ ...SUBTLE, fontSize: '0.72rem' }}>
                Kampanjen opprettes som <strong>pauset/utkast</strong> — start den når den er klar. Tilgangen din til kontoen verifiseres automatisk.
              </Typography>
              <Button variant="contained" size="small"
                disabled={
                  creating || !form.name.trim() ||
                  (form.platform === 'meta' ? !form.adAccountId
                    : form.platform === 'google' ? !form.customerId
                    : (!form.linkedinAccountUrn || !form.linkedinGroupUrn))
                }
                onClick={submitCreate} sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}>
                {creating ? 'Oppretter…' : 'Opprett kampanje'}
              </Button>
            </>
          )}
        </Stack>
      </Collapse>

      {loading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
          <CircularProgress size={16} sx={{ color: 'rgba(226,232,240,0.6)' }} />
          <Typography sx={SUBTLE}>Henter kampanjer …</Typography>
        </Stack>
      ) : campaigns.length === 0 ? (
        <Typography sx={SUBTLE}>Ingen kampanjer ennå. Opprett én med «Ny kampanje».</Typography>
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
                    Kun rapportering
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
                        sx={{ textTransform: 'none', color: '#86efac', minWidth: 0 }}>Start</Button>
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
