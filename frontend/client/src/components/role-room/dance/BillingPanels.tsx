/**
 * Billing-paneler:
 *   DancePricingPage  — bruker-vendt prising + checkout
 *   PlanAdminPanel    — admin redigerer planer + Stripe-IDs + features
 *   TesterAdminPanel  — admin oppretter invite-lenker + statusliste
 *   AdminSettingsPanel — admin redigerer dance_admin_settings
 *   TrialBanner       — vises i workspace når abonnement er trial/comp
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Check as CheckIcon,
  Star as StarIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import * as billing from './danceBillingService';

const PURPLE = '#8b5cf6';
const PURPLE_LIGHT = '#a78bfa';
const BG = '#0a0a0a';
const CARD = '#111114';
const BORDER = 'rgba(139,92,246,0.25)';

const FEATURE_LABEL: Record<string, string> = {
  reel_basic: 'Reel (basis, 5GB)',
  reel_unlimited: 'Reel (ubegrenset)',
  rehearsal_log: 'Prøvelogg',
  video_review_basic: 'Video review (basis)',
  video_review: 'Video review m/ tegninger + voice',
  public_reel_watermarked: 'Public reel m/ watermark',
  public_reel: 'Public reel uten watermark',
  nav_report: 'NAV-rapportgenerator',
  casting_export: 'Casting-eksport',
  ai_tagging: 'AI-tagging av klipp',
  reel_analytics: 'Reel-analytics',
  priority_support: 'Prioritert support',
  classes: 'Klasse-administrasjon',
  instructors: 'Instruktør-roster',
  rooms: 'Sal-booking',
  movement_vocab: 'Bevegelses-vokabular',
  multi_project: 'Flere prosjekter samtidig',
  ehf_invoice: 'EHF-faktura',
  performances_stripboard: 'Stripboard for forestillinger',
  grants: 'Tilskudd-modulen',
  white_label: 'White-label / egen branding',
  dedicated_support: 'Dedikert kontakt',
};

// ═══════════════════════════════════════════════════════════════════════
//  DancePricingPage — bruker-vendt
// ═══════════════════════════════════════════════════════════════════════

export interface DancePricingPageProps {
  /** Hvilken persona vi viser planer for. Default 'both' = alle. */
  persona?: billing.PlanPersona;
}

export function DancePricingPage({ persona }: DancePricingPageProps): React.ReactElement {
  const [plans, setPlans] = React.useState<billing.DancePlan[]>([]);
  const [subscription, setSubscription] = React.useState<billing.DanceSubscription | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = React.useState<'monthly' | 'yearly'>('monthly');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, sub] = await Promise.all([
        billing.listPlans(),
        billing.getSubscription().catch(() => null),
      ]);
      setPlans(persona && persona !== 'both'
        ? p.filter((pl) => pl.persona === persona || pl.persona === 'both')
        : p);
      setSubscription(sub);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste planer');
    } finally {
      setLoading(false);
    }
  }, [persona]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const handleSelect = async (plan: billing.DancePlan): Promise<void> => {
    if (plan.monthlyPriceKr === 0 && plan.yearlyPriceKr === 0) {
      window.alert('Free-planen aktiveres automatisk når du registrerer deg. Ingen betaling nødvendig.');
      return;
    }
    setBusyPlan(plan.slug);
    try {
      const ret = window.location.href;
      const result = await billing.startCheckout({
        planSlug: plan.slug,
        billingPeriod,
        successUrl: `${ret}?checkout=success`,
        cancelUrl: `${ret}?checkout=cancel`,
      });
      window.location.href = result.sessionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke åpne checkout');
    } finally {
      setBusyPlan(null);
    }
  };

  const openPortal = async (): Promise<void> => {
    try {
      const result = await billing.openCustomerPortal(window.location.href);
      window.location.href = result.portalUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke åpne kundeportal');
    }
  };

  return (
    <Box sx={{ bgcolor: BG, color: '#e5e7eb', minHeight: '100%', p: { xs: 2, md: 4 } }}>
      <Stack spacing={1} alignItems="center" sx={{ mb: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 11, letterSpacing: 3, color: PURPLE_LIGHT, fontWeight: 700 }}>
          PRISER
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff' }}>
          Velg plan
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)', maxWidth: 600 }}>
          Alle planer inkluderer formasjonseditor, koreografi-builder og prøvelogg.
          Oppgrader for ubegrenset lagring, AI-tagging og økonomi-modulen.
        </Typography>

        {subscription ? (
          <Chip
            label={`Aktivt abonnement: ${subscription.planSlug} · ${subscription.status}`}
            onClick={subscription.stripeCustomerId ? () => void openPortal() : undefined}
            clickable={!!subscription.stripeCustomerId}
            sx={{
              mt: 1,
              bgcolor: subscription.status === 'active' ? 'rgba(16,185,129,0.18)' : 'rgba(167,139,250,0.18)',
              color: subscription.status === 'active' ? '#10b981' : PURPLE_LIGHT,
              fontWeight: 700,
            }}
          />
        ) : null}

        <Stack direction="row" spacing={0} sx={{ mt: 2, bgcolor: CARD, borderRadius: 2, p: 0.5 }}>
          {(['monthly', 'yearly'] as const).map((p) => (
            <Button
              key={p}
              size="small"
              onClick={() => setBillingPeriod(p)}
              sx={{
                px: 2, py: 0.5, textTransform: 'none', fontSize: 12, fontWeight: 700,
                color: billingPeriod === p ? '#fff' : 'rgba(229,231,235,0.5)',
                bgcolor: billingPeriod === p ? PURPLE : 'transparent',
                '&:hover': { bgcolor: billingPeriod === p ? '#7c3aed' : 'rgba(139,92,246,0.08)' },
              }}
            >
              {p === 'monthly' ? 'Månedlig' : 'Årlig (2 mnd gratis)'}
            </Button>
          ))}
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ maxWidth: 800, mx: 'auto', mb: 2 }}>{error}</Alert> : null}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress sx={{ color: PURPLE }} />
        </Stack>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(280px, 1fr))' },
          gap: 2,
          maxWidth: 1400,
          mx: 'auto',
        }}
      >
        {plans.map((plan) => {
          const price = billingPeriod === 'yearly' ? plan.yearlyPriceKr : plan.monthlyPriceKr;
          const isCurrent = subscription?.planSlug === plan.slug;
          const isFree = (plan.monthlyPriceKr ?? 0) === 0 && (plan.yearlyPriceKr ?? 0) === 0;
          return (
            <Box
              key={plan.slug}
              sx={{
                p: 3,
                bgcolor: CARD,
                border: `${plan.isFeatured ? 2 : 1}px solid ${plan.isFeatured ? PURPLE : BORDER}`,
                borderRadius: 2,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {plan.isFeatured ? (
                <Chip
                  size="small"
                  icon={<StarIcon sx={{ fontSize: 14 }} />}
                  label="Anbefalt"
                  sx={{
                    position: 'absolute', top: -10, right: 16,
                    bgcolor: PURPLE, color: '#fff', fontWeight: 700, height: 22,
                  }}
                />
              ) : null}
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
                {plan.persona === 'dance_freelance' ? 'FRILANSER' : plan.persona === 'dance_studio' ? 'STUDIO' : 'ALLE'}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff' }}>
                {plan.name}
              </Typography>
              {plan.description ? (
                <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)', minHeight: 40 }}>
                  {plan.description}
                </Typography>
              ) : null}
              <Stack direction="row" spacing={0.5} alignItems="baseline">
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff' }}>
                  {isFree ? 'Gratis' : `kr ${price ?? '—'}`}
                </Typography>
                {!isFree && price != null ? (
                  <Typography sx={{ fontSize: 13, color: 'rgba(229,231,235,0.5)' }}>
                    /{billingPeriod === 'yearly' ? 'år' : 'mnd'}
                  </Typography>
                ) : null}
              </Stack>
              {plan.trialDays > 0 ? (
                <Chip
                  size="small"
                  label={`${plan.trialDays} dager gratis prøveperiode`}
                  sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11 }}
                />
              ) : null}
              <Box sx={{ flex: 1 }}>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {plan.features.slice(0, 8).map((f) => (
                    <Stack key={f} direction="row" spacing={0.75} alignItems="center">
                      <CheckIcon sx={{ fontSize: 14, color: PURPLE_LIGHT }} />
                      <Typography sx={{ fontSize: 12, color: 'rgba(229,231,235,0.85)' }}>
                        {FEATURE_LABEL[f] ?? f}
                      </Typography>
                    </Stack>
                  ))}
                  {plan.features.length > 8 ? (
                    <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)', mt: 0.5 }}>
                      +{plan.features.length - 8} til
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
              <Button
                fullWidth
                variant={plan.isFeatured ? 'contained' : 'outlined'}
                onClick={() => void handleSelect(plan)}
                disabled={busyPlan === plan.slug || isCurrent}
                sx={{
                  textTransform: 'none', fontWeight: 700,
                  bgcolor: plan.isFeatured ? PURPLE : 'transparent',
                  color: plan.isFeatured ? '#fff' : PURPLE_LIGHT,
                  borderColor: PURPLE,
                  '&:hover': { bgcolor: plan.isFeatured ? '#7c3aed' : 'rgba(139,92,246,0.08)' },
                }}
              >
                {isCurrent ? 'Aktiv' :
                  busyPlan === plan.slug ? 'Åpner Stripe…' :
                  isFree ? 'Velg' : 'Velg plan'}
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  PlanAdminPanel — admin
// ═══════════════════════════════════════════════════════════════════════

export function PlanAdminPanel(): React.ReactElement {
  const [plans, setPlans] = React.useState<billing.DancePlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<billing.DancePlan | null>(null);
  const [creating, setCreating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setPlans(await billing.listPlansAdmin()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke laste'); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <Box sx={{ bgcolor: BG, color: '#e5e7eb', minHeight: '100%', p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 2, color: PURPLE_LIGHT, fontWeight: 700 }}>
            ADMIN — PLANER
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>
            {plans.length} planer
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreating(true)}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}
        >
          Ny plan
        </Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <CircularProgress size={24} sx={{ color: PURPLE }} /> : null}
      <Stack spacing={1}>
        {plans.map((plan) => (
          <Box
            key={plan.slug}
            sx={{ p: 1.5, bgcolor: CARD, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {plan.name}
                  </Typography>
                  <Chip size="small" label={plan.slug} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(229,231,235,0.06)' }} />
                  {plan.isFeatured ? <Chip size="small" label="Anbefalt" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT }} /> : null}
                  {!plan.isActive ? <Chip size="small" label="Inaktiv" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5' }} /> : null}
                </Stack>
                <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.6)', mt: 0.5 }}>
                  {plan.persona} · kr {plan.monthlyPriceKr ?? '—'}/mnd · kr {plan.yearlyPriceKr ?? '—'}/år · {plan.features.length} features
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.4)', mt: 0.25, fontFamily: 'monospace' }}>
                  Stripe: {plan.stripeMonthlyPriceId || '—'} / {plan.stripeYearlyPriceId || '—'}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setEditing(plan)} sx={{ color: PURPLE_LIGHT }}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={async () => {
                  if (!window.confirm(`Slett planen "${plan.name}"? Vil feile hvis det finnes aktive abonnementer.`)) return;
                  try { await billing.deletePlan(plan.slug); await refresh(); }
                  catch (err) { setError(err instanceof Error ? err.message : 'Sletting feilet'); }
                }}
                sx={{ color: 'rgba(229,231,235,0.4)' }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          </Box>
        ))}
      </Stack>
      <PlanFormDialog
        open={creating || editing !== null}
        plan={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={async () => { setCreating(false); setEditing(null); await refresh(); }}
      />
    </Box>
  );
}

const PlanFormDialog: React.FC<{
  open: boolean;
  plan: billing.DancePlan | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, plan, onClose, onSaved }) => {
  const [draft, setDraft] = React.useState<Partial<billing.DancePlan>>({});
  const [featuresText, setFeaturesText] = React.useState('');
  const [limitsText, setLimitsText] = React.useState('{}');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(plan ? { ...plan } : { persona: 'both', isActive: true, isFeatured: false, trialDays: 14, displayOrder: 0 });
    setFeaturesText(plan?.features?.join(', ') ?? '');
    setLimitsText(JSON.stringify(plan?.limits ?? {}, null, 2));
    setError(null);
  }, [open, plan]);

  const submit = async (): Promise<void> => {
    setSaving(true); setError(null);
    try {
      const features = featuresText.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      let limits: Record<string, unknown> = {};
      try { limits = JSON.parse(limitsText); } catch { throw new Error('Limits er ikke gyldig JSON'); }
      const payload = { ...draft, features, limits };
      if (plan) {
        await billing.patchPlan(plan.slug, payload);
      } else {
        if (!draft.slug || !draft.name) throw new Error('Slug og navn er påkrevd');
        await billing.createPlan(payload as billing.DancePlan);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {plan ? `Rediger: ${plan.name}` : 'Ny plan'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Slug" size="small" fullWidth required
              value={draft.slug ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value }))}
              disabled={!!plan}
              helperText="Lower-case, kun a-z 0-9 _"
            />
            <TextField
              label="Navn" size="small" fullWidth required
              value={draft.name ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              select label="Persona" size="small" fullWidth
              value={draft.persona ?? 'both'}
              onChange={(e) => setDraft((p) => ({ ...p, persona: e.target.value as billing.PlanPersona }))}
            >
              <MenuItem value="both">Begge</MenuItem>
              <MenuItem value="dance_freelance">Frilanser</MenuItem>
              <MenuItem value="dance_studio">Studio</MenuItem>
            </TextField>
            <TextField
              label="Visnings-rekkefølge (lav = øverst)" size="small" type="number" fullWidth
              value={draft.displayOrder ?? 0}
              onChange={(e) => setDraft((p) => ({ ...p, displayOrder: Number(e.target.value) }))}
            />
          </Stack>
          <TextField
            label="Beskrivelse" size="small" fullWidth multiline minRows={2}
            value={draft.description ?? ''}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Pris/mnd (kr)" size="small" type="number" fullWidth
              value={draft.monthlyPriceKr ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, monthlyPriceKr: e.target.value === '' ? null : Number(e.target.value) }))}
            />
            <TextField
              label="Pris/år (kr)" size="small" type="number" fullWidth
              value={draft.yearlyPriceKr ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, yearlyPriceKr: e.target.value === '' ? null : Number(e.target.value) }))}
            />
            <TextField
              label="Trial-dager" size="small" type="number" fullWidth
              value={draft.trialDays ?? 14}
              onChange={(e) => setDraft((p) => ({ ...p, trialDays: Number(e.target.value) }))}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Stripe price ID (mnd)" size="small" fullWidth
              value={draft.stripeMonthlyPriceId ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, stripeMonthlyPriceId: e.target.value || null }))}
              helperText="Fra Stripe dashboard. Trengs for checkout."
            />
            <TextField
              label="Stripe price ID (år)" size="small" fullWidth
              value={draft.stripeYearlyPriceId ?? ''}
              onChange={(e) => setDraft((p) => ({ ...p, stripeYearlyPriceId: e.target.value || null }))}
            />
          </Stack>
          <TextField
            label="Features (komma-separert)" size="small" fullWidth multiline minRows={2}
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            helperText="Eks: reel_unlimited, video_review, ai_tagging"
          />
          <TextField
            label="Limits (JSON)" size="small" fullWidth multiline minRows={3}
            value={limitsText}
            onChange={(e) => setLimitsText(e.target.value)}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
          />
          <Stack direction="row" spacing={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={draft.isActive !== false}
                  onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))}
                />
              }
              label="Aktiv"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.isFeatured === true}
                  onChange={(e) => setDraft((p) => ({ ...p, isFeatured: e.target.checked }))}
                />
              }
              label="Vis som anbefalt"
            />
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={saving}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' } }}
        >
          {saving ? 'Lagrer…' : (plan ? 'Lagre' : 'Opprett')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  TesterAdminPanel
// ═══════════════════════════════════════════════════════════════════════

export function TesterAdminPanel(): React.ReactElement {
  const [invites, setInvites] = React.useState<billing.TesterInvite[]>([]);
  const [plans, setPlans] = React.useState<billing.DancePlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ planSlug: string; trialDays: number; maxUses: number; invitedEmail: string; invitedName: string; notes: string }>({
    planSlug: '', trialDays: 90, maxUses: 1, invitedEmail: '', invitedName: '', notes: '',
  });
  const [submitting, setSubmitting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [inv, p] = await Promise.all([billing.listTesterInvites(), billing.listPlansAdmin()]);
      setInvites(inv);
      setPlans(p);
      if (!draft.planSlug && p.length > 0) {
        setDraft((d) => ({ ...d, planSlug: p[0].slug }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste');
    } finally {
      setLoading(false);
    }
  }, [draft.planSlug]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await billing.createTesterInvite({
        planSlug: draft.planSlug,
        trialDays: draft.trialDays,
        maxUses: draft.maxUses,
        invitedEmail: draft.invitedEmail || null,
        invitedName: draft.invitedName || null,
        notes: draft.notes || null,
      });
      setOpen(false);
      setDraft((d) => ({ ...d, invitedEmail: '', invitedName: '', notes: '' }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opprettelse feilet');
    } finally {
      setSubmitting(false);
    }
  };

  const inviteUrl = (token: string): string => `${window.location.origin}/invite/${token}`;

  return (
    <Box sx={{ bgcolor: BG, color: '#e5e7eb', minHeight: '100%', p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 2, color: PURPLE_LIGHT, fontWeight: 700 }}>
            ADMIN — PROTOTYPE-TESTERE
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>
            {invites.length} invites · {invites.filter((i) => i.acceptedAt).length} akseptert
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}
        >
          Ny invite
        </Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <CircularProgress size={24} sx={{ color: PURPLE }} /> : null}
      <Stack spacing={1}>
        {invites.map((inv) => {
          const url = inviteUrl(inv.token);
          return (
            <Box key={inv.token} sx={{ p: 1.5, bgcolor: CARD, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {inv.invitedName || inv.invitedEmail || '(uten navn)'}
                    </Typography>
                    <Chip size="small" label={inv.planSlug} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT }} />
                    <Chip size="small" label={`${inv.trialDays}d`} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(229,231,235,0.06)' }} />
                    <Chip
                      size="small"
                      label={`${inv.usedCount}/${inv.maxUses}`}
                      sx={{
                        height: 18, fontSize: 10,
                        bgcolor: inv.usedCount >= inv.maxUses ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)',
                        color: inv.usedCount >= inv.maxUses ? '#fca5a5' : '#10b981',
                      }}
                    />
                    {inv.acceptedAt ? <Chip size="small" label="Akseptert" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(16,185,129,0.18)', color: '#10b981' }} /> : null}
                  </Stack>
                  <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.4)', mt: 0.25, fontFamily: 'monospace' }} noWrap>
                    {url}
                  </Typography>
                </Box>
                <Tooltip title="Kopier invite-URL">
                  <IconButton
                    size="small"
                    onClick={() => { void navigator.clipboard.writeText(url); }}
                    sx={{ color: PURPLE_LIGHT }}
                  >
                    <CopyIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Åpne invite-URL i ny fane">
                  <IconButton size="small" component="a" href={url} target="_blank" rel="noopener noreferrer" sx={{ color: PURPLE_LIGHT }}>
                    <OpenIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="small"
                  onClick={async () => {
                    if (!window.confirm('Slett invite?')) return;
                    await billing.deleteTesterInvite(inv.token);
                    await refresh();
                  }}
                  sx={{ color: 'rgba(229,231,235,0.4)' }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Dialog open={open} onClose={submitting ? undefined : () => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Ny tester-invite</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select label="Plan" size="small" fullWidth required
              value={draft.planSlug}
              onChange={(e) => setDraft((d) => ({ ...d, planSlug: e.target.value }))}
            >
              {plans.map((p) => <MenuItem key={p.slug} value={p.slug}>{p.name} ({p.slug})</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Trial-dager etter aksept" size="small" type="number" fullWidth
                value={draft.trialDays}
                onChange={(e) => setDraft((d) => ({ ...d, trialDays: Number(e.target.value) }))}
              />
              <TextField
                label="Maks bruk (1 = personlig, høyere = delbart)" size="small" type="number" fullWidth
                value={draft.maxUses}
                onChange={(e) => setDraft((d) => ({ ...d, maxUses: Number(e.target.value) }))}
              />
            </Stack>
            <TextField
              label="Invitert navn (valgfritt — kun for sporing)" size="small" fullWidth
              value={draft.invitedName}
              onChange={(e) => setDraft((d) => ({ ...d, invitedName: e.target.value }))}
            />
            <TextField
              label="Invitert e-post (valgfritt)" size="small" fullWidth
              value={draft.invitedEmail}
              onChange={(e) => setDraft((d) => ({ ...d, invitedEmail: e.target.value }))}
            />
            <TextField
              label="Notater" size="small" fullWidth multiline minRows={2}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={submitting}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => void submit()}
            disabled={submitting || !draft.planSlug}
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' } }}
          >
            {submitting ? 'Oppretter…' : 'Opprett invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  AdminSettingsPanel
// ═══════════════════════════════════════════════════════════════════════

export function AdminSettingsPanel(): React.ReactElement {
  const [settings, setSettings] = React.useState<billing.AdminSetting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await billing.listAdminSettings();
      setSettings(data);
      setDrafts(Object.fromEntries(data.map((s) => [s.key, JSON.stringify(s.value, null, 2)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const saveOne = async (s: billing.AdminSetting): Promise<void> => {
    try {
      const value = JSON.parse(drafts[s.key] ?? '{}');
      await billing.setAdminSetting(s.key, value, s.description);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lagring feilet');
    }
  };

  const newSettingKey = React.useRef('');
  const newSettingValue = React.useRef('{}');
  const [newKeyText, setNewKeyText] = React.useState('');
  const [newValueText, setNewValueText] = React.useState('{}');
  const [newDescText, setNewDescText] = React.useState('');

  const addNew = async (): Promise<void> => {
    if (!newKeyText.trim()) return;
    try {
      const value = JSON.parse(newValueText);
      await billing.setAdminSetting(newKeyText.trim(), value, newDescText || null);
      setNewKeyText(''); setNewValueText('{}'); setNewDescText('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opprettelse feilet');
    }
  };

  return (
    <Box sx={{ bgcolor: BG, color: '#e5e7eb', minHeight: '100%', p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <SettingsIcon sx={{ color: PURPLE_LIGHT, mr: 1 }} />
        <Typography sx={{ fontSize: 10, letterSpacing: 2, color: PURPLE_LIGHT, fontWeight: 700 }}>
          ADMIN — INNSTILLINGER
        </Typography>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <CircularProgress size={24} sx={{ color: PURPLE }} /> : null}

      <Stack spacing={2}>
        {settings.map((s) => (
          <Box key={s.key} sx={{ p: 2, bgcolor: CARD, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                {s.key}
              </Typography>
              {s.description ? (
                <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.55)' }}>
                  {s.description}
                </Typography>
              ) : null}
            </Stack>
            <TextField
              size="small" fullWidth multiline minRows={3}
              value={drafts[s.key] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
            />
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
              <Button size="small" onClick={() => void saveOne(s)} sx={{ color: PURPLE_LIGHT, textTransform: 'none' }}>
                Lagre
              </Button>
            </Stack>
          </Box>
        ))}

        <Box sx={{ p: 2, bgcolor: CARD, border: `1px dashed ${BORDER}`, borderRadius: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.6)', mb: 1, fontWeight: 700 }}>
            NY INNSTILLING
          </Typography>
          <Stack spacing={1}>
            <TextField
              size="small" placeholder="key (eks: my_setting)"
              value={newKeyText}
              onChange={(e) => setNewKeyText(e.target.value)}
            />
            <TextField
              size="small" placeholder="beskrivelse"
              value={newDescText}
              onChange={(e) => setNewDescText(e.target.value)}
            />
            <TextField
              size="small" multiline minRows={3}
              value={newValueText}
              onChange={(e) => setNewValueText(e.target.value)}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
            />
            <Button onClick={() => void addNew()} sx={{ alignSelf: 'flex-end', textTransform: 'none', color: PURPLE_LIGHT }}>
              Legg til
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TrialBanner — vises i workspace ved trial/comp
// ═══════════════════════════════════════════════════════════════════════

export function TrialBanner(): React.ReactElement | null {
  const [sub, setSub] = React.useState<billing.DanceSubscription | null>(null);
  React.useEffect(() => {
    billing.getSubscription().then(setSub).catch(() => setSub(null));
  }, []);
  if (!sub) return null;
  if (sub.status !== 'trialing' && sub.status !== 'comp') return null;
  const expires = sub.trialEndAt ?? sub.compExpiresAt ?? sub.currentPeriodEnd;
  const days = billing.daysUntil(expires);
  const isComp = sub.billingPeriod === 'comp' || sub.billingPeriod === 'tester';
  return (
    <Box
      sx={{
        bgcolor: isComp ? 'rgba(139,92,246,0.18)' : 'rgba(251,191,36,0.18)',
        color: isComp ? PURPLE_LIGHT : '#fbbf24',
        px: 2, py: 0.75, borderRadius: 1, fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 1,
      }}
      data-testid="dance-trial-banner"
    >
      <StarIcon sx={{ fontSize: 16 }} />
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'inherit' }}>
        {isComp ? 'Tester-tilgang' : 'Prøveperiode'} · {sub.planSlug}
        {days != null ? ` · ${days} dager igjen` : ''}
      </Typography>
      <Box sx={{ flex: 1 }} />
      {!isComp ? (
        <Button
          size="small"
          variant="contained"
          onClick={() => { window.location.hash = '#dance-pricing'; }}
          sx={{ bgcolor: PURPLE, color: '#fff', textTransform: 'none', fontSize: 11, py: 0.25 }}
        >
          Oppgrader
        </Button>
      ) : null}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TesterInviteLanding — landing for /invite/:token
// ═══════════════════════════════════════════════════════════════════════

export interface TesterInviteLandingProps {
  token: string;
  onAccepted?: (subscription: billing.DanceSubscription) => void;
}

export function TesterInviteLanding({
  token, onAccepted,
}: TesterInviteLandingProps): React.ReactElement {
  const [invite, setInvite] = React.useState<billing.PublicTesterInvite | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    billing.getPublicInvite(token)
      .then((inv) => setInvite(inv))
      .catch((err) => setError(err instanceof Error ? err.message : 'Kunne ikke laste'))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async (): Promise<void> => {
    setAccepting(true); setError(null);
    try {
      const sub = await billing.acceptInvite(token);
      setAccepted(true);
      onAccepted?.(sub);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kunne ikke akseptere';
      if (msg.includes('unauthorized')) {
        // Redirect to login.
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
        return;
      }
      setError(msg);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '60vh', color: PURPLE_LIGHT }}>
        <CircularProgress sx={{ color: PURPLE }} />
        <Typography sx={{ mt: 2 }}>Laster invite…</Typography>
      </Stack>
    );
  }

  if (!invite) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '60vh', p: 4 }}>
        <Alert severity="error">Invite-token er ugyldig eller har utløpt.</Alert>
      </Stack>
    );
  }

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={3}
      sx={{ minHeight: '70vh', p: 4, bgcolor: BG, color: '#e5e7eb' }}
    >
      <Typography sx={{ fontSize: 11, letterSpacing: 3, color: PURPLE_LIGHT, fontWeight: 700 }}>
        TESTER-TILGANG
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', textAlign: 'center' }}>
        Du er invitert til å teste {invite.planName}
      </Typography>
      <Typography variant="body1" sx={{ color: 'rgba(229,231,235,0.7)', maxWidth: 600, textAlign: 'center' }}>
        Trykk Aksepter for å aktivere {invite.trialDays} dager gratis tilgang
        til CreatorHub Dans-vertikalen — uten betalingsinformasjon.
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {accepted ? (
        <Alert severity="success" sx={{ maxWidth: 480 }}>
          Tilgangen er aktivert. Du kan nå starte med å bruke alle features i {invite.planName}.
        </Alert>
      ) : (
        <Button
          variant="contained"
          size="large"
          onClick={() => void accept()}
          disabled={accepting || invite.usesRemaining === 0}
          sx={{
            bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' },
            textTransform: 'none', fontWeight: 700, minWidth: 240,
          }}
        >
          {accepting ? 'Aksepterer…' :
           invite.usesRemaining === 0 ? 'Inviten er brukt opp' :
           'Aksepter invite'}
        </Button>
      )}
      <Divider sx={{ width: '100%', maxWidth: 480, borderColor: BORDER }} />
      <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)', textAlign: 'center', maxWidth: 480 }}>
        Hvis du ikke har en konto må du registrere deg først. Vi sender deg
        til innlogging og tilbake hit etter at du er logget inn.
      </Typography>
    </Stack>
  );
}

export default {
  DancePricingPage, PlanAdminPanel, TesterAdminPanel, AdminSettingsPanel, TrialBanner, TesterInviteLanding,
};
