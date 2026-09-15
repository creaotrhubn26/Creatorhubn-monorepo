/**
 * Billing-paneler for spillstudio (Story Graph):
 *   GamePricingPage        — bruker-vendt prising + Stripe-checkout (fane «Pris»)
 *   GameSubscriptionPanel  — eget abonnement, dager igjen, kundeportal (fane «Abonnement»)
 *   GameAdminPanel         — admin: planer + tester-invites + innstillinger (fane «Admin · Planer»)
 *   PlanGateBanner         — «krever Pro/Studio»-banner ved gated funksjon
 *
 * Mønster: dance/BillingPanels.tsx, kondensert og med Story Graph-tokens.
 */

import React from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add as AddIcon, Check as CheckIcon, ContentCopy as CopyIcon, Delete as DeleteIcon, Edit as EditIcon,
  Lock as LockIcon, Star as StarIcon,
} from '@mui/icons-material';
import * as billing from './gameBillingService';
import { resetGamePlanGateCache, useGamePlanGate } from './useGamePlanGate';
import { narrativeColors as c } from '../narrative/narrativeTheme';

const BORDER = c.borderStrong;
const fieldSx = {
  '& .MuiInputBase-root': { color: c.text, bgcolor: 'rgba(255,255,255,0.03)' },
  '& .MuiInputLabel-root': { color: c.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: c.borderStrong },
  '& .MuiFormHelperText-root': { color: c.textDim },
};

/** Ber NarrativeWorkspace bytte fane (lyttes på i workspacet). */
export const NARRATIVE_OPEN_TAB_EVENT = 'narrative:open-tab';
export function requestNarrativeTab(tab: string): void {
  window.dispatchEvent(new CustomEvent(NARRATIVE_OPEN_TAB_EVENT, { detail: { tab } }));
}

// ═══════════════════════════════════════════════════════════════════════
//  PlanGateBanner
// ═══════════════════════════════════════════════════════════════════════

export interface PlanGateBannerProps {
  feature: billing.GameFeature;
  /** Kompakt variant (én linje) for verktøylinjer. */
  compact?: boolean;
}

/** Viser banner når gjeldende plan mangler featuren; ellers null. */
export function PlanGateBanner({ feature, compact }: PlanGateBannerProps): React.ReactElement | null {
  const gate = useGamePlanGate();
  if (gate.loading || gate.has(feature)) return null;
  return (
    <Alert
      severity="info" icon={<LockIcon fontSize="small" />}
      data-testid={`narrative-plan-gate-${feature}`}
      action={<Button size="small" onClick={() => requestNarrativeTab('pricing')} sx={{ color: c.accent, fontWeight: 700 }} data-testid="narrative-plan-gate-upgrade">Se planer</Button>}
      sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: c.text, border: `1px solid ${c.borderStrong}`, py: compact ? 0 : undefined, mb: 1.5, '& .MuiAlert-icon': { color: c.accent } }}
    >
      <Typography sx={{ fontSize: 12 }}>
        <b>{billing.GAME_FEATURE_LABEL[feature]}</b> er ikke inkludert i planen {gate.plan?.name ?? 'Solo'}. Oppgrader til Pro eller Studio.
      </Typography>
    </Alert>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GamePricingPage
// ═══════════════════════════════════════════════════════════════════════

export function GamePricingPage(): React.ReactElement {
  const [plans, setPlans] = React.useState<billing.GamePlan[]>([]);
  const [current, setCurrent] = React.useState<billing.EffectivePlan | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<'monthly' | 'yearly'>('monthly');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, me] = await Promise.all([billing.listPlans(), billing.getMyPlan().catch(() => null)]);
        if (!cancelled) { setPlans(p); setCurrent(me); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke laste planer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const select = async (plan: billing.GamePlan) => {
    if (billing.isFreePlan(plan)) return;
    setBusyPlan(plan.slug);
    try {
      const ret = window.location.href.split('?')[0];
      const { sessionUrl } = await billing.startCheckout({ planSlug: plan.slug, billingPeriod: period, successUrl: `${ret}?mode=game_studio&checkout=success`, cancelUrl: `${ret}?mode=game_studio&checkout=cancel` });
      window.location.href = sessionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke åpne checkout');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, color: c.text }} data-testid="game-pricing-page">
      <Stack spacing={1} alignItems="center" sx={{ mb: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: 700 }}>PRISER · SPILLSTUDIO</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Velg plan</Typography>
        <Typography sx={{ fontSize: 13, color: c.textDim, maxWidth: 620 }}>
          Solo er gratis og dekker brett, forgreninger, Play Mode og JSON/Markdown-eksport. Pro åpner deling, KI, oversettelser og Twine/Ink-import. Studio legger til runtime-pakker og seter.
        </Typography>
        {current ? (
          <Chip size="small" label={`Din plan: ${current.plan.name}${current.active ? '' : ' (uten abonnement)'}`} data-testid="game-pricing-current" sx={{ bgcolor: c.accentSoft, color: c.accent, fontWeight: 700 }} />
        ) : null}
        <Stack direction="row" sx={{ mt: 1, bgcolor: c.bgCard, borderRadius: 2, p: 0.5, border: `1px solid ${BORDER}` }}>
          {(['monthly', 'yearly'] as const).map((p) => (
            <Button key={p} size="small" onClick={() => setPeriod(p)} data-testid={`game-pricing-period-${p}`}
              sx={{ px: 2, textTransform: 'none', fontSize: 12, fontWeight: 700, color: period === p ? '#04140a' : c.textDim, bgcolor: period === p ? c.accent : 'transparent', '&:hover': { bgcolor: period === p ? c.accentDark : 'rgba(255,255,255,0.05)' } }}>
              {p === 'monthly' ? 'Månedlig' : 'Årlig (2 mnd gratis)'}
            </Button>
          ))}
        </Stack>
      </Stack>
      {error ? <Alert severity="error" sx={{ maxWidth: 800, mx: 'auto', mb: 2 }}>{error}</Alert> : null}
      {loading ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress sx={{ color: c.accent }} /></Stack> : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(260px, 1fr))' }, gap: 2, maxWidth: 1100, mx: 'auto' }}>
        {plans.map((plan) => {
          const price = period === 'yearly' ? plan.yearlyPriceKr : plan.monthlyPriceKr;
          const free = billing.isFreePlan(plan);
          const isCurrent = current?.plan.slug === plan.slug;
          return (
            <Box key={plan.slug} data-testid={`game-plan-card-${plan.slug}`} sx={{ p: 3, bgcolor: c.bgCard, border: `${plan.isFeatured ? 2 : 1}px solid ${plan.isFeatured ? c.accent : BORDER}`, borderRadius: 2, position: 'relative', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {plan.isFeatured ? <Chip size="small" icon={<StarIcon sx={{ fontSize: 14 }} />} label="Anbefalt" sx={{ position: 'absolute', top: -10, right: 16, bgcolor: c.accent, color: '#04140a', fontWeight: 700, height: 22 }} /> : null}
              <Typography variant="h5" sx={{ fontWeight: 800 }}>{plan.name}</Typography>
              {plan.description ? <Typography sx={{ fontSize: 13, color: c.textDim, minHeight: 40 }}>{plan.description}</Typography> : null}
              <Stack direction="row" spacing={0.5} alignItems="baseline">
                <Typography variant="h4" sx={{ fontWeight: 800 }}>{free ? 'Gratis' : `kr ${price ?? '—'}`}</Typography>
                {!free && price != null ? <Typography sx={{ fontSize: 13, color: c.textDim }}>/{period === 'yearly' ? 'år' : 'mnd'}</Typography> : null}
              </Stack>
              {plan.trialDays > 0 ? <Chip size="small" label={`${plan.trialDays} dager gratis prøveperiode`} sx={{ alignSelf: 'flex-start', bgcolor: c.accentSoft, color: c.accent, fontSize: 11 }} /> : null}
              <Stack spacing={0.5} sx={{ flex: 1, mt: 0.5 }}>
                {plan.features.map((f) => (
                  <Stack key={f} direction="row" spacing={0.75} alignItems="center">
                    <CheckIcon sx={{ fontSize: 14, color: c.accent }} />
                    <Typography sx={{ fontSize: 12 }}>{billing.GAME_FEATURE_LABEL[f as billing.GameFeature] ?? f}</Typography>
                  </Stack>
                ))}
                {Object.entries(plan.limits).filter(([, v]) => typeof v === 'number' && v > 0).map(([k, v]) => (
                  <Typography key={k} sx={{ fontSize: 11, color: c.textDim }}>· {k === 'maxProjects' ? `inntil ${v} prosjekter` : k === 'maxElements' ? `inntil ${v} elementer per prosjekt` : k === 'seats' ? `${v} seter` : `${k}: ${String(v)}`}</Typography>
                ))}
              </Stack>
              <Button fullWidth variant={plan.isFeatured ? 'contained' : 'outlined'} onClick={() => void select(plan)} disabled={busyPlan === plan.slug || isCurrent || free}
                data-testid={`game-plan-select-${plan.slug}`}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: plan.isFeatured ? c.accent : 'transparent', color: plan.isFeatured ? '#04140a' : c.accent, borderColor: c.accent, '&:hover': { bgcolor: plan.isFeatured ? c.accentDark : c.accentSoft } }}>
                {isCurrent ? 'Din plan' : free ? 'Inkludert' : busyPlan === plan.slug ? 'Åpner Stripe…' : 'Velg plan'}
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GameSubscriptionPanel
// ═══════════════════════════════════════════════════════════════════════

export function GameSubscriptionPanel(): React.ReactElement {
  const gate = useGamePlanGate();
  const [error, setError] = React.useState<string | null>(null);
  const sub = gate.subscription;
  const openPortal = async () => {
    try {
      const { portalUrl } = await billing.openCustomerPortal(window.location.href);
      window.location.href = portalUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke åpne kundeportal');
    }
  };
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, color: c.text, maxWidth: 720 }} data-testid="game-subscription-panel">
      <Typography sx={{ fontSize: 11, letterSpacing: 2, color: c.accent, fontWeight: 700, mb: 1 }}>ABONNEMENT</Typography>
      {gate.loading ? <CircularProgress size={22} sx={{ color: c.accent }} /> : (
        <Stack spacing={1.5}>
          <Box sx={{ p: 2, bgcolor: c.bgCard, border: `1px solid ${BORDER}`, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} data-testid="game-subscription-plan">{gate.plan?.name ?? 'Solo'}</Typography>
            <Typography sx={{ fontSize: 12, color: c.textDim }}>
              {sub ? `${sub.status} · ${sub.billingPeriod}${gate.daysRemaining != null ? ` · ${gate.daysRemaining} dager igjen` : ''}` : 'Ingen abonnement — du er på gratisplanen Solo.'}
            </Typography>
            {sub?.cancelAtPeriodEnd ? <Chip size="small" label="Avsluttes ved periodeslutt" sx={{ mt: 1, bgcolor: 'rgba(245,158,11,0.15)', color: c.warning }} /> : null}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => requestNarrativeTab('pricing')} sx={{ bgcolor: c.accent, color: '#04140a', fontWeight: 700, textTransform: 'none' }} data-testid="game-subscription-pricing">
              {sub ? 'Bytt plan' : 'Se planer'}
            </Button>
            {sub?.stripeCustomerId ? <Button variant="outlined" onClick={() => void openPortal()} sx={{ color: c.text, borderColor: BORDER, textTransform: 'none' }}>Kundeportal (faktura, kort, oppsigelse)</Button> : null}
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Typography sx={{ fontSize: 12, color: c.textDim }}>
            Planen gjelder prosjektene du eier; medlemmer arver eierens plan.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  GameAdminPanel — planer, testere, innstillinger
// ═══════════════════════════════════════════════════════════════════════

export function GameAdminPanel(): React.ReactElement {
  const [section, setSection] = React.useState<'plans' | 'testers' | 'settings'>('plans');
  return (
    <Box sx={{ color: c.text }} data-testid="game-admin-panel">
      <Tabs value={section} onChange={(_, v) => setSection(v)} sx={{ borderBottom: `1px solid ${BORDER}`, px: 2, '& .MuiTab-root': { textTransform: 'none', color: c.textDim, minHeight: 40 }, '& .Mui-selected': { color: '#fff' }, '& .MuiTabs-indicator': { bgcolor: c.accent } }}>
        <Tab value="plans" label="Planer" data-testid="game-admin-section-plans" />
        <Tab value="testers" label="Testere" data-testid="game-admin-section-testers" />
        <Tab value="settings" label="Innstillinger" data-testid="game-admin-section-settings" />
      </Tabs>
      {section === 'plans' ? <PlansAdmin /> : section === 'testers' ? <TestersAdmin /> : <SettingsAdmin />}
    </Box>
  );
}

function PlansAdmin(): React.ReactElement {
  const [plans, setPlans] = React.useState<billing.GamePlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<billing.GamePlan | null>(null);
  const [creating, setCreating] = React.useState(false);
  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setPlans(await billing.listPlansAdmin()); } catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke laste'); } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ flex: 1, fontWeight: 800 }}>{plans.length} planer</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)} data-testid="game-plan-admin-create" sx={{ bgcolor: c.accent, color: '#04140a', textTransform: 'none', fontWeight: 700 }}>Ny plan</Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <CircularProgress size={22} sx={{ color: c.accent }} /> : null}
      <Stack spacing={1}>
        {plans.map((plan) => (
          <Box key={plan.slug} data-testid={`game-plan-admin-row-${plan.slug}`} sx={{ p: 1.5, bgcolor: c.bgCard, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{plan.name}</Typography>
                  <Chip size="small" label={plan.slug} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: c.text }} />
                  {plan.isFeatured ? <Chip size="small" label="Anbefalt" sx={{ height: 18, fontSize: 10, bgcolor: c.accentSoft, color: c.accent }} /> : null}
                  {!plan.isActive ? <Chip size="small" label="Inaktiv" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(239,68,68,0.18)', color: c.error }} /> : null}
                </Stack>
                <Typography sx={{ fontSize: 11, color: c.textDim, mt: 0.5 }}>kr {plan.monthlyPriceKr ?? '—'}/mnd · kr {plan.yearlyPriceKr ?? '—'}/år · {plan.features.length} features · limits {JSON.stringify(plan.limits)}</Typography>
                <Typography sx={{ fontSize: 10, color: c.textDim, fontFamily: 'monospace' }}>Stripe: {plan.stripeMonthlyPriceId || '—'} / {plan.stripeYearlyPriceId || '—'}</Typography>
              </Box>
              <IconButton size="small" onClick={() => setEditing(plan)} data-testid={`game-plan-admin-edit-${plan.slug}`} sx={{ color: c.accent }}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
              <IconButton size="small" sx={{ color: c.textDim }} onClick={async () => {
                if (!window.confirm(`Slett planen «${plan.name}»? Feiler hvis den har abonnenter.`)) return;
                try { await billing.deletePlan(plan.slug); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Sletting feilet'); }
              }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
            </Stack>
          </Box>
        ))}
      </Stack>
      <PlanFormDialog open={creating || editing !== null} plan={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={async () => { setCreating(false); setEditing(null); resetGamePlanGateCache(); await refresh(); }} />
    </Box>
  );
}

const PlanFormDialog: React.FC<{ open: boolean; plan: billing.GamePlan | null; onClose: () => void; onSaved: () => void }> = ({ open, plan, onClose, onSaved }) => {
  const [draft, setDraft] = React.useState<Partial<billing.GamePlan>>({});
  const [featuresText, setFeaturesText] = React.useState('');
  const [limitsText, setLimitsText] = React.useState('{}');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) return;
    setDraft(plan ? { ...plan } : { isActive: true, isFeatured: false, trialDays: 14, displayOrder: 0 });
    setFeaturesText(plan?.features?.join(', ') ?? '');
    setLimitsText(JSON.stringify(plan?.limits ?? {}, null, 2));
    setError(null);
  }, [open, plan]);
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const features = featuresText.split(',').map((s) => s.trim()).filter(Boolean);
      let limits: Record<string, unknown> = {};
      try { limits = JSON.parse(limitsText); } catch { throw new Error('Limits er ikke gyldig JSON'); }
      const payload = { ...draft, features, limits };
      if (plan) await billing.patchPlan(plan.slug, payload);
      else {
        if (!draft.slug || !draft.name) throw new Error('Slug og navn er påkrevd');
        await billing.createPlan(payload as billing.GamePlan);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally { setSaving(false); }
  };
  const num = (k: keyof billing.GamePlan) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((p) => ({ ...p, [k]: e.target.value === '' ? null : Number(e.target.value) }));
  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: c.bgPanel, color: c.text, border: `1px solid ${BORDER}` } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{plan ? `Rediger: ${plan.name}` : 'Ny plan'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Slug" size="small" fullWidth required value={draft.slug ?? ''} onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value }))} disabled={!!plan} helperText="a-z 0-9 _" sx={fieldSx} inputProps={{ 'data-testid': 'game-plan-form-slug' }} />
            <TextField label="Navn" size="small" fullWidth required value={draft.name ?? ''} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} sx={fieldSx} inputProps={{ 'data-testid': 'game-plan-form-name' }} />
          </Stack>
          <TextField label="Beskrivelse" size="small" fullWidth multiline minRows={2} value={draft.description ?? ''} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={fieldSx} />
          <Stack direction="row" spacing={2}>
            <TextField label="Pris/mnd (kr)" size="small" type="number" fullWidth value={draft.monthlyPriceKr ?? ''} onChange={num('monthlyPriceKr')} sx={fieldSx} />
            <TextField label="Pris/år (kr)" size="small" type="number" fullWidth value={draft.yearlyPriceKr ?? ''} onChange={num('yearlyPriceKr')} sx={fieldSx} />
            <TextField label="Trial-dager" size="small" type="number" fullWidth value={draft.trialDays ?? 14} onChange={(e) => setDraft((p) => ({ ...p, trialDays: Number(e.target.value) }))} sx={fieldSx} />
            <TextField label="Rekkefølge" size="small" type="number" fullWidth value={draft.displayOrder ?? 0} onChange={(e) => setDraft((p) => ({ ...p, displayOrder: Number(e.target.value) }))} sx={fieldSx} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Stripe price ID (mnd)" size="small" fullWidth value={draft.stripeMonthlyPriceId ?? ''} onChange={(e) => setDraft((p) => ({ ...p, stripeMonthlyPriceId: e.target.value || null }))} helperText="Fra Stripe-dashbordet. Trengs for checkout." sx={fieldSx} />
            <TextField label="Stripe price ID (år)" size="small" fullWidth value={draft.stripeYearlyPriceId ?? ''} onChange={(e) => setDraft((p) => ({ ...p, stripeYearlyPriceId: e.target.value || null }))} sx={fieldSx} />
          </Stack>
          <TextField label="Features (komma-separert)" size="small" fullWidth multiline minRows={2} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} helperText={Object.keys(billing.GAME_FEATURE_LABEL).join(', ')} sx={fieldSx} />
          <TextField label="Limits (JSON: maxProjects, maxElements, seats)" size="small" fullWidth multiline minRows={3} value={limitsText} onChange={(e) => setLimitsText(e.target.value)} sx={{ ...fieldSx, '& textarea': { fontFamily: 'monospace', fontSize: 12 } }} />
          <Stack direction="row" spacing={3}>
            <FormControlLabel control={<Switch checked={draft.isActive !== false} onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))} />} label="Aktiv" />
            <FormControlLabel control={<Switch checked={draft.isFeatured === true} onChange={(e) => setDraft((p) => ({ ...p, isFeatured: e.target.checked }))} />} label="Vis som anbefalt" />
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} sx={{ color: c.textDim }}>Avbryt</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={saving} data-testid="game-plan-form-save" sx={{ bgcolor: c.accent, color: '#04140a', fontWeight: 700 }}>{saving ? 'Lagrer…' : plan ? 'Lagre' : 'Opprett'}</Button>
      </DialogActions>
    </Dialog>
  );
};

function TestersAdmin(): React.ReactElement {
  const [invites, setInvites] = React.useState<billing.TesterInvite[]>([]);
  const [plans, setPlans] = React.useState<billing.GamePlan[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ planSlug: '', trialDays: 90, maxUses: 1, invitedEmail: '', invitedName: '', notes: '' });
  const [submitting, setSubmitting] = React.useState(false);
  const refresh = React.useCallback(async () => {
    try {
      const [inv, p] = await Promise.all([billing.listTesterInvites(), billing.listPlansAdmin()]);
      setInvites(inv); setPlans(p);
      setDraft((d) => (d.planSlug || !p.length ? d : { ...d, planSlug: p.find((x) => x.slug === 'pro')?.slug ?? p[0].slug }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke laste'); }
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);
  const submit = async () => {
    setSubmitting(true);
    try {
      await billing.createTesterInvite({ planSlug: draft.planSlug, trialDays: draft.trialDays, maxUses: draft.maxUses, invitedEmail: draft.invitedEmail || null, invitedName: draft.invitedName || null, notes: draft.notes || null });
      setOpen(false); setDraft((d) => ({ ...d, invitedEmail: '', invitedName: '', notes: '' }));
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Opprettelse feilet'); } finally { setSubmitting(false); }
  };
  const inviteUrl = (token: string) => `${window.location.origin}/?mode=game_studio&game_invite=${encodeURIComponent(token)}`;
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ flex: 1, fontWeight: 800 }}>{invites.length} invites · {invites.filter((i) => i.acceptedAt).length} akseptert</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} data-testid="game-tester-invite-create" sx={{ bgcolor: c.accent, color: '#04140a', textTransform: 'none', fontWeight: 700 }}>Ny invite</Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Stack spacing={1}>
        {invites.map((inv) => {
          const url = inviteUrl(inv.token);
          return (
            <Box key={inv.token} data-testid={`game-tester-invite-row-${inv.token}`} sx={{ p: 1.5, bgcolor: c.bgCard, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{inv.invitedName || inv.invitedEmail || '(uten navn)'}</Typography>
                    <Chip size="small" label={inv.planSlug} sx={{ height: 18, fontSize: 10, bgcolor: c.accentSoft, color: c.accent }} />
                    <Chip size="small" label={`${inv.trialDays}d · ${inv.usedCount}/${inv.maxUses}`} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: c.text }} />
                    {inv.acceptedAt ? <Chip size="small" label="Akseptert" sx={{ height: 18, fontSize: 10, bgcolor: c.accentSoft, color: c.accent }} /> : null}
                  </Stack>
                  <Typography sx={{ fontSize: 10, color: c.textDim, fontFamily: 'monospace' }} noWrap>{url}</Typography>
                </Box>
                <Tooltip title="Kopier invite-URL"><IconButton size="small" onClick={() => { void navigator.clipboard.writeText(url); }} sx={{ color: c.accent }}><CopyIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                <IconButton size="small" sx={{ color: c.textDim }} onClick={async () => { if (!window.confirm('Slett invite?')) return; await billing.deleteTesterInvite(inv.token); await refresh(); }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Dialog open={open} onClose={submitting ? undefined : () => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: c.bgPanel, color: c.text, border: `1px solid ${BORDER}` } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Ny tester-invite</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Plan" size="small" fullWidth value={draft.planSlug} onChange={(e) => setDraft((d) => ({ ...d, planSlug: e.target.value }))} sx={fieldSx}>
              {plans.map((p) => <MenuItem key={p.slug} value={p.slug}>{p.name} ({p.slug})</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField label="Dager etter aksept" size="small" type="number" fullWidth value={draft.trialDays} onChange={(e) => setDraft((d) => ({ ...d, trialDays: Number(e.target.value) }))} sx={fieldSx} />
              <TextField label="Maks bruk" size="small" type="number" fullWidth value={draft.maxUses} onChange={(e) => setDraft((d) => ({ ...d, maxUses: Number(e.target.value) }))} sx={fieldSx} />
            </Stack>
            <TextField label="Navn (valgfritt)" size="small" fullWidth value={draft.invitedName} onChange={(e) => setDraft((d) => ({ ...d, invitedName: e.target.value }))} sx={fieldSx} />
            <TextField label="E-post (valgfritt)" size="small" fullWidth value={draft.invitedEmail} onChange={(e) => setDraft((d) => ({ ...d, invitedEmail: e.target.value }))} sx={fieldSx} />
            <TextField label="Notater" size="small" fullWidth multiline minRows={2} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} sx={fieldSx} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={submitting} sx={{ color: c.textDim }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void submit()} disabled={submitting || !draft.planSlug} data-testid="game-tester-invite-submit" sx={{ bgcolor: c.accent, color: '#04140a', fontWeight: 700 }}>{submitting ? 'Oppretter…' : 'Opprett invite'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SettingsAdmin(): React.ReactElement {
  const [settings, setSettings] = React.useState<billing.AdminSetting[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const refresh = React.useCallback(async () => {
    try {
      const data = await billing.listAdminSettings();
      setSettings(data);
      setDrafts(Object.fromEntries(data.map((s) => [s.key, JSON.stringify(s.value, null, 2)])));
    } catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke laste'); }
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);
  const save = async (s: billing.AdminSetting) => {
    try { await billing.setAdminSetting(s.key, JSON.parse(drafts[s.key] ?? '{}'), s.description); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Lagring feilet'); }
  };
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Stack spacing={2}>
        {settings.map((s) => (
          <Box key={s.key} data-testid={`game-admin-setting-${s.key}`} sx={{ p: 2, bgcolor: c.bgCard, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{s.key}</Typography>
              {s.description ? <Typography sx={{ fontSize: 11, color: c.textDim }}>{s.description}</Typography> : null}
            </Stack>
            <TextField size="small" fullWidth multiline minRows={2} value={drafts[s.key] ?? ''} onChange={(e) => setDrafts((p) => ({ ...p, [s.key]: e.target.value }))} sx={{ ...fieldSx, '& textarea': { fontFamily: 'monospace', fontSize: 12 } }} />
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}><Button size="small" onClick={() => void save(s)} sx={{ color: c.accent, textTransform: 'none' }}>Lagre</Button></Stack>
          </Box>
        ))}
        {settings.length === 0 && !error ? <Typography sx={{ fontSize: 12, color: c.textDim }}>Ingen innstillinger ennå (seedes av migrasjon 0608).</Typography> : null}
      </Stack>
    </Box>
  );
}
