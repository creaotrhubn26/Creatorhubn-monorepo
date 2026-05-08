/**
 * AdminRoom — interne arbeidsverktøy for daniel@creatorhubn.com:
 *   • IN-/EU-støtteordninger (søknad-utkast med malgenerator + statusflyt)
 *   • Investor-pipeline (kontaktkort + sammensatt e-post-generator)
 *   • Potensielle samarbeidspartnere
 *
 * Skjermes via email-sjekk på UI-laget i tillegg til server-gate.
 *
 * Maler for The Role Room som produkt EKSKLUDERER The Role Room Agent
 * (beta) — fokuserer på casting/crew/locations/storyboard/budget/avtaler
 * som er stable produktfunksjonalitet.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  fundingAppsApi,
  investorContactsApi,
  partnerContactsApi,
  businessPlanApi,
  FUNDING_SCHEME_PRESETS,
  FUNDING_STATUS_LABELS,
  INVESTOR_STATUS_LABELS,
  PARTNERSHIP_TYPE_LABELS,
  PARTNER_STATUS_LABELS,
  type FundingApp,
  type FundingAppStatus,
  type FundingAppInput,
  type InvestorContact,
  type InvestorStatus,
  type InvestorContactInput,
  type PartnerContact,
  type PartnerStatus,
  type PartnershipType,
  type PartnerContactInput,
  type BusinessPlan,
  type BusinessPlanInput,
} from '../services/adminRoomApi';

const ADMIN_ROOM_OWNER_EMAIL = 'daniel@creatorhubn.com';

type AdminRoomTab = 'funding' | 'investors' | 'partners' | 'business-plan';

// ─────────────────────────────────────────────────────────
// Stable produkt-features for søknadsmaler. Role Room Agent
// (beta) er bevisst utelatt fra denne listen.
// ─────────────────────────────────────────────────────────
const STABLE_PRODUCT_FEATURES = [
  'Casting-pipeline (roller, kandidater, kanban med 7 statuser)',
  'Crew & lokasjoner (synking mot opptaksdager)',
  'Storyboard og shotlists per scene',
  'Budsjett-styring (kategori-grupper, Avvik vs Estimat, Cashflow, Rapport-eksport)',
  'Avtaler (NDA, samarbeids-avtaler, klient/medvirkende, signering via Google)',
  'TROLL-demo for fremvisning til pilotkunder',
  'Multi-vertikal: produksjonsteam og innholdsprodusenter i samme plattform',
];

// Mal-generator for IN-Markedsavklaring (~1500 tegn)
function generateInPhase1Draft(projectName: string, applicantCompany: string | null): string {
  const company = applicantCompany?.trim() || '[Ditt selskap]';
  return `${company} søker midler til markedsavklaring for The Role Room — en Norsk-utviklet produksjonsplattform for film-, TV-, og innholdsproduksjonsteam.

Prosjektet «${projectName}» skal:

1. Validere markedsbehov hos minst 8 norske produksjonsselskaper og innholdsprodusenter
   (intervjuer + 2-ukers pilotering).
2. Avklare prising og pakke-struktur (per-prosjekt vs SaaS-abonnement).
3. Måle hvordan plattformen reduserer ledetid fra brief til klient-godkjenning sammenlignet
   med dagens fragmenterte verktøy (Google Sheets + e-post + Trello).

Forretningsmessig grunnlag — produktet leverer i dag stabil funksjonalitet for:

${STABLE_PRODUCT_FEATURES.map((f) => `• ${f}`).join('\n')}

Pilotkunde: Holy Crust (Oslo) bruker plattformen for produksjons-leveranser.

Resultatmål: kvantifisert markedsbehov + 3 LOI fra betalende kunder + tydelig
prising-modell innen 3 måneder.`;
}

// Mal-generator for IN-Kommersialisering (~3000 tegn)
function generateInPhase2Draft(projectName: string, applicantCompany: string | null): string {
  const company = applicantCompany?.trim() || '[Ditt selskap]';
  return `${company} søker midler til kommersialisering av The Role Room — en
helhetlig produksjonsplattform for det norske film- og innholdsmarkedet.

Prosjektet «${projectName}» skal skalere fra pilotvalidering til betalende kunder
gjennom tre parallelle løp:

A) PRODUKT — bredde-skalering av stable funksjonalitet:
${STABLE_PRODUCT_FEATURES.map((f) => `   • ${f}`).join('\n')}

B) GO-TO-MARKET — bygge salgskanal mot:
   • Filmproduksjons-vertikalen (Motlys, Maipo, Mer Film)
   • Innholdsprodusent-vertikalen (TVNorge, NRK Eksterne, Discovery)
   • Dans-vertikal som egen oppskaleringsbar SKU
   • Pilotkunder som referanser for europeisk ekspansjon (Sverige, Danmark)

C) LEVERANSE-OPERASJONER — onboarding, kundesuksess, support-prosesser
   som gir <1 ukes time-to-value for nye kunder.

Eksisterende validering:
• Holy Crust som live pilotkunde (produksjons-leveranser pågår).
• Komplett TROLL-demo som gir potensielle kunder en realistisk forhåndsvisning.
• Multi-vertikal arkitektur testet for både produksjonsteam og innholdsprodusenter.

Norske bransjeorganisasjoner — Norsk Filmforbund, Virke Produsentforeningen, Mediebedriftenes
Landsforening og NFI — er identifisert som distribusjons- og kvalitetspartnere.

Mål for støtteperioden:
• Minimum 15 betalende kunder (mix av studio + frilanser-prosjekter)
• Årlig omsetning på 6 MNOK ved utløp
• Validert ekspansjons-playbook for 1-2 nordiske markeder

Risiko-mitigering: konkurranselandet domineres av amerikanske point-løsninger
(StudioBinder, ShotGrid, Movie Magic). Vår vinkling er én plattform med norsk
juridisk ramme (åvl./aml./aksjelov-referanser bygget inn) og tilpasset for
NFI-prosjektøkonomi.`;
}

// Composite e-post mal til investor
function generateInvestorEmail(
  contact: InvestorContact,
  options: { senderName?: string; deckUrl?: string; askAmount?: string } = {},
): { subject: string; body: string } {
  const sender = options.senderName?.trim() || 'Daniel';
  const deck = options.deckUrl?.trim() || '[Pitch deck-lenke kommer]';
  const ask = options.askAmount?.trim() || '[Beløp]';
  const recipient = contact.contact_name?.trim() || contact.company_name;
  const focusContext = contact.focus_areas?.length
    ? ` Vi har sett at dere har fokus på ${contact.focus_areas.slice(0, 3).join(', ')}, som matcher vår vinkling godt.`
    : '';
  const subject = `The Role Room — invitasjon til samtale (${contact.company_name})`;
  const body = `Hei ${recipient},

Vi bygger The Role Room — en produksjonsplattform for det norske film- og innholdsmarkedet
som samler casting, crew, lokasjoner, storyboard, budsjett og avtaler i ett verktøy.

Hvor vi er:
• Live pilot med Holy Crust (Oslo) — produksjons-leveranser pågår
• Multi-vertikal: produksjonsteam (film/TV) + innholdsprodusenter
• Norsk juridisk ramme bygget inn (avtl./asl./åvl./aml./GDPR-referanser)
• Komplett TROLL-demo for forhåndsvisning av leveransen

Vi er i en ${INVESTOR_STATUS_LABELS[contact.status]?.toLowerCase() || 'tidlig'}-fase og søker
${ask}.${focusContext}

Vil du ta en uforpliktende samtale om hvordan dere kan bidra? Pitch deck:
${deck}

Mvh,
${sender}`;
  return { subject, body };
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined, currency = 'NOK'): string {
  if (!value || !Number.isFinite(value)) return `0 ${currency}`;
  return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Math.round(value))} ${currency}`;
}

function getCurrentUserEmail(): string {
  try {
    // Match how andre komponenter leser logged-in user
    const raw = localStorage.getItem('user') || localStorage.getItem('creatorhub_user');
    if (raw) {
      const parsed = JSON.parse(raw) as { email?: string };
      if (typeof parsed?.email === 'string') return parsed.email.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return '';
}

// ─────────────────────────────────────────────────────────
// Section: Funding apps
// ─────────────────────────────────────────────────────────

interface FundingDrawerProps {
  open: boolean;
  initial: FundingApp | null;
  onClose: () => void;
  onSaved: (item: FundingApp) => void;
}

function FundingAppDrawer({ open, initial, onClose, onSaved }: FundingDrawerProps) {
  const [form, setForm] = useState<FundingAppInput>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        scheme: initial.scheme,
        schemeLabel: initial.scheme_label,
        projectName: initial.project_name,
        applicantCompany: initial.applicant_company,
        status: initial.status,
        amountRequested: initial.amount_requested,
        currency: initial.currency,
        description: initial.description,
        contactPerson: initial.contact_person,
        contactEmail: initial.contact_email,
        submissionDate: initial.submission_date,
        decisionDate: initial.decision_date,
        notes: initial.notes,
      });
    } else {
      setForm({
        scheme: FUNDING_SCHEME_PRESETS[0].scheme,
        schemeLabel: FUNDING_SCHEME_PRESETS[0].label,
        amountRequested: FUNDING_SCHEME_PRESETS[0].defaultAmount,
        status: 'draft',
        currency: 'NOK',
      });
    }
    setError(null);
  }, [initial, open]);

  function handleSchemeChange(scheme: string) {
    const preset = FUNDING_SCHEME_PRESETS.find((p) => p.scheme === scheme);
    setForm((prev) => ({
      ...prev,
      scheme,
      schemeLabel: preset?.label,
      amountRequested: prev.amountRequested ?? preset?.defaultAmount ?? null,
    }));
  }

  function handleGenerate() {
    const projectName = form.projectName?.trim() || 'The Role Room';
    const company = form.applicantCompany ?? null;
    let draft = form.description ?? '';
    if (form.scheme === 'innovasjon_norge_1') draft = generateInPhase1Draft(projectName, company);
    else if (form.scheme === 'innovasjon_norge_2') draft = generateInPhase2Draft(projectName, company);
    setForm((prev) => ({ ...prev, description: draft }));
  }

  async function handleSave() {
    if (!form.scheme || !form.schemeLabel || !form.projectName?.trim()) {
      setError('Velg ordning og fyll inn prosjektnavn');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = initial
        ? await fundingAppsApi.patch(initial.id, form)
        : await fundingAppsApi.create(form);
      onSaved(item);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 560, md: 680 }, bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800 }}>
            {initial ? 'Rediger søknad' : 'Ny støttesøknad'}
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(226,232,240,0.7)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <FormControl fullWidth size="small">
              <InputLabel>Støtteordning</InputLabel>
              <Select label="Støtteordning" value={form.scheme ?? ''} onChange={(e) => handleSchemeChange(String(e.target.value))}>
                {FUNDING_SCHEME_PRESETS.map((p) => (
                  <MenuItem key={p.scheme} value={p.scheme}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Prosjektnavn" size="small" fullWidth value={form.projectName ?? ''} onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))} />
            <TextField label="Søker / selskap" size="small" fullWidth value={form.applicantCompany ?? ''} onChange={(e) => setForm((p) => ({ ...p, applicantCompany: e.target.value }))} />
            <Stack direction="row" spacing={1}>
              <TextField label="Beløp (NOK)" size="small" type="number" sx={{ flex: 1 }} value={form.amountRequested ?? ''} onChange={(e) => setForm((p) => ({ ...p, amountRequested: e.target.value === '' ? null : Number.parseFloat(e.target.value) }))} />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status ?? 'draft'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as FundingAppStatus }))}>
                  {(Object.keys(FUNDING_STATUS_LABELS) as FundingAppStatus[]).map((s) => (
                    <MenuItem key={s} value={s}>{FUNDING_STATUS_LABELS[s]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Innleveringsdato" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.submissionDate ?? ''} onChange={(e) => setForm((p) => ({ ...p, submissionDate: e.target.value || null }))} />
              <TextField label="Vedtaksdato" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.decisionDate ?? ''} onChange={(e) => setForm((p) => ({ ...p, decisionDate: e.target.value || null }))} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Kontaktperson" size="small" sx={{ flex: 1 }} value={form.contactPerson ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} />
              <TextField label="Kontakt-e-post" size="small" sx={{ flex: 1 }} value={form.contactEmail ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
            </Stack>
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontWeight: 600, fontSize: '0.86rem' }}>Søknadstekst</Typography>
                <Button size="small" startIcon={<AutoAwesomeIcon />} onClick={handleGenerate} sx={{ textTransform: 'none', fontWeight: 700, color: '#a78bfa' }}>
                  Generer mal
                </Button>
              </Stack>
              <TextField multiline minRows={10} fullWidth value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </Box>
            <TextField label="Interne notater" size="small" multiline minRows={3} fullWidth value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
            {saving ? 'Lagrer…' : initial ? 'Lagre endringer' : 'Opprett'}
          </Button>
          <Button variant="text" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>Avbryt</Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

function FundingAppsTab() {
  const [items, setItems] = useState<FundingApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FundingApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await fundingAppsApi.list();
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(item: FundingApp) {
    if (!window.confirm(`Slette "${item.project_name}"?`)) return;
    try {
      await fundingAppsApi.remove(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem' }}>
          {items.length} søknad{items.length === 1 ? '' : 'er'} registrert
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setDrawerOpen(true); }} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          Ny søknad
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
      ) : items.length === 0 ? (
        <Alert severity="info">Ingen søknader enda. Klikk "Ny søknad" for å starte.</Alert>
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Card key={item.id} sx={{ bgcolor: 'rgba(15,23,42,0.66)', border: '1px solid rgba(148,163,184,0.16)' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                      {item.project_name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.85rem' }}>
                      {item.scheme_label} · {formatCurrency(item.amount_requested, item.currency)}
                    </Typography>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" sx={{ mt: 0.6 }}>
                      <Chip size="small" label={FUNDING_STATUS_LABELS[item.status]} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                      {item.submission_date ? <Chip size="small" label={`Sendt ${item.submission_date}`} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} /> : null}
                      {item.decision_date ? <Chip size="small" label={`Vedtak ${item.decision_date}`} sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#86efac' }} /> : null}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => { setEditing(item); setDrawerOpen(true); }} sx={{ color: 'rgba(226,232,240,0.74)' }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(item)} sx={{ color: 'rgba(248,113,113,0.74)' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <FundingAppDrawer
        open={drawerOpen}
        initial={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={(savedItem) => {
          setItems((prev) => {
            const existing = prev.findIndex((p) => p.id === savedItem.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = savedItem;
              return next;
            }
            return [savedItem, ...prev];
          });
        }}
      />
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Investor contacts
// ─────────────────────────────────────────────────────────

interface InvestorDrawerProps {
  open: boolean;
  initial: InvestorContact | null;
  onClose: () => void;
  onSaved: (item: InvestorContact) => void;
}

function InvestorDrawer({ open, initial, onClose, onSaved }: InvestorDrawerProps) {
  const [form, setForm] = useState<InvestorContactInput>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState({ senderName: 'Daniel', deckUrl: '', askAmount: '' });

  useEffect(() => {
    if (initial) {
      setForm({
        companyName: initial.company_name,
        contactName: initial.contact_name,
        contactEmail: initial.contact_email,
        contactPhone: initial.contact_phone,
        status: initial.status,
        ticketSizeMin: initial.ticket_size_min,
        ticketSizeMax: initial.ticket_size_max,
        currency: initial.currency,
        focusAreas: initial.focus_areas,
        introSource: initial.intro_source,
        nextStep: initial.next_step,
        nextStepDue: initial.next_step_due,
        notes: initial.notes,
      });
    } else {
      setForm({ status: 'lead', currency: 'NOK', focusAreas: [] });
    }
    setError(null);
  }, [initial, open]);

  async function handleSave() {
    if (!form.companyName?.trim()) {
      setError('Selskapsnavn er påkrevd');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = initial
        ? await investorContactsApi.patch(initial.id, form)
        : await investorContactsApi.create(form);
      onSaved(item);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  }

  function openComposer() {
    if (!initial) return;
    setComposerOpen(true);
  }

  function buildMailtoLink() {
    if (!initial) return '#';
    const { subject, body } = generateInvestorEmail(initial, composer);
    return `mailto:${encodeURIComponent(initial.contact_email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 540, md: 640 }, bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}
      >
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800 }}>
              {initial ? 'Rediger investor' : 'Ny investor'}
            </Typography>
            <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(226,232,240,0.7)' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
            <Stack spacing={2}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField label="Selskap" size="small" fullWidth value={form.companyName ?? ''} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField label="Kontaktperson" size="small" sx={{ flex: 1 }} value={form.contactName ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={form.status ?? 'lead'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as InvestorStatus }))}>
                    {(Object.keys(INVESTOR_STATUS_LABELS) as InvestorStatus[]).map((s) => (
                      <MenuItem key={s} value={s}>{INVESTOR_STATUS_LABELS[s]}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField label="E-post" size="small" sx={{ flex: 1 }} value={form.contactEmail ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
                <TextField label="Telefon" size="small" sx={{ flex: 1 }} value={form.contactPhone ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField label="Ticket min (NOK)" size="small" type="number" sx={{ flex: 1 }} value={form.ticketSizeMin ?? ''} onChange={(e) => setForm((p) => ({ ...p, ticketSizeMin: e.target.value === '' ? null : Number.parseFloat(e.target.value) }))} />
                <TextField label="Ticket max (NOK)" size="small" type="number" sx={{ flex: 1 }} value={form.ticketSizeMax ?? ''} onChange={(e) => setForm((p) => ({ ...p, ticketSizeMax: e.target.value === '' ? null : Number.parseFloat(e.target.value) }))} />
              </Stack>
              <TextField
                label="Fokus-områder (komma-separert)"
                size="small"
                fullWidth
                value={(form.focusAreas ?? []).join(', ')}
                onChange={(e) => setForm((p) => ({ ...p, focusAreas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                helperText="F.eks. SaaS, B2B, Nordic, Media"
              />
              <TextField label="Intro-kilde" size="small" fullWidth value={form.introSource ?? ''} onChange={(e) => setForm((p) => ({ ...p, introSource: e.target.value }))} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField label="Neste steg" size="small" sx={{ flex: 2 }} value={form.nextStep ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextStep: e.target.value }))} />
                <TextField label="Frist" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.nextStepDue ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextStepDue: e.target.value || null }))} />
              </Stack>
              <TextField label="Notater" size="small" multiline minRows={3} fullWidth value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
            {initial?.contact_email ? (
              <Button startIcon={<EmailIcon />} onClick={openComposer} variant="outlined" sx={{ textTransform: 'none', fontWeight: 700 }}>
                Send-mal
              </Button>
            ) : null}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
              {saving ? 'Lagrer…' : initial ? 'Lagre endringer' : 'Opprett'}
            </Button>
            <Button variant="text" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>Avbryt</Button>
          </Stack>
        </Stack>
      </Drawer>

      <Dialog open={composerOpen} onClose={() => setComposerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generer e-post-mal til {initial?.company_name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Avsender-navn" size="small" value={composer.senderName} onChange={(e) => setComposer((p) => ({ ...p, senderName: e.target.value }))} />
            <TextField label="Deck-lenke" size="small" value={composer.deckUrl} onChange={(e) => setComposer((p) => ({ ...p, deckUrl: e.target.value }))} />
            <TextField label="Ask (f.eks. 5 MNOK pre-seed)" size="small" value={composer.askAmount} onChange={(e) => setComposer((p) => ({ ...p, askAmount: e.target.value }))} />
            {initial ? (
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.66)', border: '1px solid rgba(148,163,184,0.18)' }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem', mb: 0.6 }}>
                  Forhåndsvisning av e-post:
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
                  Emne: {generateInvestorEmail(initial, composer).subject}{'\n\n'}
                  {generateInvestorEmail(initial, composer).body}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComposerOpen(false)}>Avbryt</Button>
          <Button variant="contained" component="a" href={buildMailtoLink()} onClick={() => setComposerOpen(false)} sx={{ bgcolor: '#7c3aed' }}>
            Åpne i e-postklient
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function InvestorContactsTab() {
  const [items, setItems] = useState<InvestorContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<InvestorContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setItems(await investorContactsApi.list());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(item: InvestorContact) {
    if (!window.confirm(`Slette ${item.company_name}?`)) return;
    try {
      await investorContactsApi.remove(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const groupedByStatus = useMemo(() => {
    const grouped = new Map<InvestorStatus, InvestorContact[]>();
    for (const item of items) {
      const list = grouped.get(item.status) ?? [];
      list.push(item);
      grouped.set(item.status, list);
    }
    return grouped;
  }, [items]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem' }}>
          {items.length} investor{items.length === 1 ? '' : 'er'} i pipeline
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setDrawerOpen(true); }} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          Ny investor
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
      ) : items.length === 0 ? (
        <Alert severity="info">Ingen investorer enda. Klikk "Ny investor" for å starte pipeline.</Alert>
      ) : (
        (Object.keys(INVESTOR_STATUS_LABELS) as InvestorStatus[]).map((statusKey) => {
          const list = groupedByStatus.get(statusKey) ?? [];
          if (list.length === 0) return null;
          return (
            <Box key={statusKey}>
              <Typography sx={{ color: '#a78bfa', fontWeight: 800, fontSize: '0.88rem', mb: 0.6 }}>
                {INVESTOR_STATUS_LABELS[statusKey]} ({list.length})
              </Typography>
              <Stack spacing={1}>
                {list.map((item) => (
                  <Card key={item.id} sx={{ bgcolor: 'rgba(15,23,42,0.66)', border: '1px solid rgba(148,163,184,0.16)' }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ color: '#fff', fontWeight: 800 }}>{item.company_name}</Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.85rem' }}>
                            {item.contact_name ? `${item.contact_name}` : 'Ingen kontaktperson'}
                            {item.contact_email ? ` · ${item.contact_email}` : ''}
                          </Typography>
                          {item.next_step ? (
                            <Typography sx={{ color: 'rgba(251,191,36,0.85)', fontSize: '0.8rem', mt: 0.4 }}>
                              ↳ {item.next_step}{item.next_step_due ? ` (${item.next_step_due})` : ''}
                            </Typography>
                          ) : null}
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => { setEditing(item); setDrawerOpen(true); }} sx={{ color: 'rgba(226,232,240,0.74)' }}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(item)} sx={{ color: 'rgba(248,113,113,0.74)' }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          );
        })
      )}
      <InvestorDrawer
        open={drawerOpen}
        initial={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={(savedItem) => {
          setItems((prev) => {
            const existing = prev.findIndex((p) => p.id === savedItem.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = savedItem;
              return next;
            }
            return [savedItem, ...prev];
          });
        }}
      />
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Partner contacts
// ─────────────────────────────────────────────────────────

interface PartnerDrawerProps {
  open: boolean;
  initial: PartnerContact | null;
  onClose: () => void;
  onSaved: (item: PartnerContact) => void;
}

function PartnerDrawer({ open, initial, onClose, onSaved }: PartnerDrawerProps) {
  const [form, setForm] = useState<PartnerContactInput>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        companyName: initial.company_name,
        contactName: initial.contact_name,
        contactEmail: initial.contact_email,
        contactPhone: initial.contact_phone,
        partnershipType: initial.partnership_type,
        status: initial.status,
        proposalSummary: initial.proposal_summary,
        nextStep: initial.next_step,
        nextStepDue: initial.next_step_due,
        notes: initial.notes,
      });
    } else {
      setForm({ partnershipType: 'other', status: 'potential' });
    }
    setError(null);
  }, [initial, open]);

  async function handleSave() {
    if (!form.companyName?.trim()) {
      setError('Selskapsnavn er påkrevd');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const item = initial
        ? await partnerContactsApi.patch(initial.id, form)
        : await partnerContactsApi.create(form);
      onSaved(item);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520, md: 600 }, bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800 }}>
            {initial ? 'Rediger partner' : 'Ny partner'}
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(226,232,240,0.7)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Selskap" size="small" fullWidth value={form.companyName ?? ''} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Kontakt" size="small" sx={{ flex: 1 }} value={form.contactName ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
              <TextField label="E-post" size="small" sx={{ flex: 1 }} value={form.contactEmail ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={form.partnershipType ?? 'other'} onChange={(e) => setForm((p) => ({ ...p, partnershipType: e.target.value as PartnershipType }))}>
                  {(Object.keys(PARTNERSHIP_TYPE_LABELS) as PartnershipType[]).map((t) => (
                    <MenuItem key={t} value={t}>{PARTNERSHIP_TYPE_LABELS[t]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status ?? 'potential'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as PartnerStatus }))}>
                  {(Object.keys(PARTNER_STATUS_LABELS) as PartnerStatus[]).map((s) => (
                    <MenuItem key={s} value={s}>{PARTNER_STATUS_LABELS[s]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField label="Sammendrag av forslag" size="small" multiline minRows={3} fullWidth value={form.proposalSummary ?? ''} onChange={(e) => setForm((p) => ({ ...p, proposalSummary: e.target.value }))} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Neste steg" size="small" sx={{ flex: 2 }} value={form.nextStep ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextStep: e.target.value }))} />
              <TextField label="Frist" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.nextStepDue ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextStepDue: e.target.value || null }))} />
            </Stack>
            <TextField label="Notater" size="small" multiline minRows={3} fullWidth value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
            {saving ? 'Lagrer…' : initial ? 'Lagre endringer' : 'Opprett'}
          </Button>
          <Button variant="text" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>Avbryt</Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

function PartnerContactsTab() {
  const [items, setItems] = useState<PartnerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setItems(await partnerContactsApi.list());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(item: PartnerContact) {
    if (!window.confirm(`Slette ${item.company_name}?`)) return;
    try {
      await partnerContactsApi.remove(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem' }}>
          {items.length} partner{items.length === 1 ? '' : 'e'} registrert
        </Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setEditing(null); setDrawerOpen(true); }} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          Ny partner
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
      ) : items.length === 0 ? (
        <Alert severity="info">Ingen partnere enda. Klikk "Ny partner" for å starte registreringen.</Alert>
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Card key={item.id} sx={{ bgcolor: 'rgba(15,23,42,0.66)', border: '1px solid rgba(148,163,184,0.16)' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800 }}>{item.company_name}</Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.85rem' }}>
                      {item.contact_name ? `${item.contact_name}` : 'Ingen kontaktperson'}
                      {item.contact_email ? ` · ${item.contact_email}` : ''}
                    </Typography>
                    <Stack direction="row" spacing={0.6} flexWrap="wrap" sx={{ mt: 0.6 }}>
                      <Chip size="small" label={PARTNERSHIP_TYPE_LABELS[item.partnership_type]} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                      <Chip size="small" label={PARTNER_STATUS_LABELS[item.status]} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                      {item.next_step_due ? <Chip size="small" label={`Frist ${item.next_step_due}`} sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }} /> : null}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => { setEditing(item); setDrawerOpen(true); }} sx={{ color: 'rgba(226,232,240,0.74)' }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(item)} sx={{ color: 'rgba(248,113,113,0.74)' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <PartnerDrawer
        open={drawerOpen}
        initial={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={(savedItem) => {
          setItems((prev) => {
            const existing = prev.findIndex((p) => p.id === savedItem.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = savedItem;
              return next;
            }
            return [savedItem, ...prev];
          });
        }}
      />
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Forretningsplan & strategi
// ─────────────────────────────────────────────────────────

interface BizPlanSection {
  id: string;
  title: string;
  helperText?: string;
  fields: Array<{
    key: keyof BusinessPlanInput;
    dbKey: keyof BusinessPlan;
    label: string;
    helperText?: string;
    minRows?: number;
    placeholder?: string;
  }>;
}

const BIZ_PLAN_SECTIONS: BizPlanSection[] = [
  {
    id: 'exec',
    title: '1.0 Executive Summary',
    helperText: 'Kort oppsummering av hva The Role Room er, markedet, traction og hva du søker.',
    fields: [{
      key: 'execSummary',
      dbKey: 'exec_summary',
      label: 'Sammendrag',
      minRows: 6,
      placeholder: 'The Role Room er en helhetlig produksjonsplattform for det norske...',
    }],
  },
  {
    id: 'intro',
    title: '2.0 Introduksjon',
    helperText: 'Selskap, visjon, bærekraft, bransje og økonomiske nøkkeltall.',
    fields: [
      { key: 'introOverview', dbKey: 'intro_overview', label: '2.1 Selskapet', minRows: 4 },
      { key: 'introVision', dbKey: 'intro_vision', label: '2.2 Visjon', minRows: 3 },
      { key: 'introSustainability', dbKey: 'intro_sustainability', label: '2.3 Bærekraftige tiltak', minRows: 3 },
      { key: 'introIndustry', dbKey: 'intro_industry', label: '2.4 Bransje', minRows: 3 },
      { key: 'introFinancials', dbKey: 'intro_financials', label: '2.5 Regnskapstall (siste 2 år)', minRows: 3 },
    ],
  },
  {
    id: 'internal',
    title: '3.0 Internanalyse',
    helperText: 'Verdinettverk, drivere, ressurser og verdiskapningsevne.',
    fields: [
      { key: 'internalValueNetworkPrimary', dbKey: 'internal_value_network_primary', label: '3.1.1 Primæraktiviteter', minRows: 3 },
      { key: 'internalValueNetworkSupport', dbKey: 'internal_value_network_support', label: '3.1.2 Støtteaktiviteter', minRows: 3 },
      { key: 'internalDriversCustomer', dbKey: 'internal_drivers_customer', label: '3.2.1 Kundemasse og skala', minRows: 3 },
      { key: 'internalDriversCapacity', dbKey: 'internal_drivers_capacity', label: '3.2.2 Kapasitetsutnyttelse', minRows: 3 },
      { key: 'internalDriversLearning', dbKey: 'internal_drivers_learning', label: '3.2.3 Læring', minRows: 3 },
      { key: 'internalResourceAnalysis', dbKey: 'internal_resource_analysis', label: '3.3 Ressursanalyse', minRows: 4 },
      { key: 'internalOperational', dbKey: 'internal_operational', label: '3.4.1 Operasjonell evne', minRows: 3 },
      { key: 'internalDynamic', dbKey: 'internal_dynamic', label: '3.4.2 Dynamisk evne', minRows: 3 },
      { key: 'internalVrio', dbKey: 'internal_vrio', label: '3.5.1 VRIO-analyse',
        helperText: 'Verdifull, sjelden, vanskelig å imitere, organisert. Liste opp ressurser per V/R/I/O-akse.',
        minRows: 5 },
      { key: 'internalNetworkStructure', dbKey: 'internal_network_structure', label: '3.5.2 Nettverksstruktur', minRows: 3 },
      { key: 'internalStrengthsWeaknesses', dbKey: 'internal_strengths_weaknesses', label: '3.6 Styrker og svakheter', minRows: 4 },
    ],
  },
  {
    id: 'external',
    title: '4.0 Ekstern analyse',
    helperText: 'PESTEL, Porter\'s 5, konkurrenter og interessenter.',
    fields: [
      { key: 'externalPestel', dbKey: 'external_pestel', label: '4.1 PESTEL-analyse',
        helperText: 'Politisk · Økonomisk · Sosialt · Teknologisk · Miljø · Juridisk',
        minRows: 6 },
      { key: 'externalPestelConclusion', dbKey: 'external_pestel_conclusion', label: '4.1.1 Konklusjon — PESTEL', minRows: 2 },
      { key: 'externalPorter', dbKey: 'external_porter', label: '4.2.1 Porters fem krefter',
        helperText: 'Nye aktører · Leverandører · Kunder · Substitutter · Konkurranseintensitet',
        minRows: 5 },
      { key: 'externalPorterConclusion', dbKey: 'external_porter_conclusion', label: '4.2.2 Konklusjon — bransjeanalyse', minRows: 2 },
      { key: 'externalCompetitors', dbKey: 'external_competitors', label: '4.3 Konkurrentanalyse',
        helperText: 'Liste opp 3-5 hovedkonkurrenter med posisjonering, styrker og svakheter.',
        minRows: 5 },
      { key: 'externalCompetitorSummary', dbKey: 'external_competitor_summary', label: '4.3.1 Oppsummering konkurrenter', minRows: 2 },
      { key: 'externalStakeholders', dbKey: 'external_stakeholders', label: '4.4 Interessentanalyse',
        helperText: 'Kunder, NFI, Filmforbundet, leverandører, ansatte. Interesse vs påvirkning.',
        minRows: 4 },
      { key: 'externalStakeholderConclusion', dbKey: 'external_stakeholder_conclusion', label: '4.4.1 Konklusjon — interessenter', minRows: 2 },
    ],
  },
  {
    id: 'swot',
    title: '5.0 SWOT-analyse',
    helperText: 'Styrker, svakheter, muligheter, trusler — én linje per punkt.',
    fields: [
      { key: 'swotStrengths', dbKey: 'swot_strengths', label: 'Styrker (S)', minRows: 3 },
      { key: 'swotWeaknesses', dbKey: 'swot_weaknesses', label: 'Svakheter (W)', minRows: 3 },
      { key: 'swotOpportunities', dbKey: 'swot_opportunities', label: 'Muligheter (O)', minRows: 3 },
      { key: 'swotThreats', dbKey: 'swot_threats', label: 'Trusler (T)', minRows: 3 },
    ],
  },
  {
    id: 'wheel',
    title: '6.0 Strategisk hjul + nåværende strategi',
    helperText: 'Beskriv det strategiske hjulet (mål, virkemidler, tiltak) og hva som er den nåværende strategien.',
    fields: [
      { key: 'strategicWheel', dbKey: 'strategic_wheel', label: 'Strategisk hjul', minRows: 4 },
      { key: 'currentStrategy', dbKey: 'current_strategy', label: 'Nåværende strategi', minRows: 4 },
    ],
  },
  {
    id: 'recommendation',
    title: '7.0 Strategisk anbefaling',
    helperText: 'Hvor bør The Role Room være om 12-24 måneder, og hvorfor — vurdert mot SAFe-kriteriene.',
    fields: [
      { key: 'strategicRecommendation', dbKey: 'strategic_recommendation', label: 'Anbefaling', minRows: 5 },
      { key: 'safeSuitability', dbKey: 'safe_suitability', label: '7.1.1 Suitability — passer strategien?', minRows: 3 },
      { key: 'safeAcceptability', dbKey: 'safe_acceptability', label: '7.1.2 Acceptability — godtas av interessenter?', minRows: 3 },
      { key: 'safeFeasibility', dbKey: 'safe_feasibility', label: '7.1.3 Feasibility — gjennomførbar?', minRows: 3 },
    ],
  },
];

function BusinessPlanTab() {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<keyof BusinessPlan, string>>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    businessPlanApi.get()
      .then((data) => { if (!cancelled) setPlan(data); })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function valueFor(dbKey: keyof BusinessPlan): string {
    if (drafts[dbKey] !== undefined) return drafts[dbKey] as string;
    const stored = plan?.[dbKey];
    return typeof stored === 'string' ? stored : '';
  }

  function handleChange(dbKey: keyof BusinessPlan, value: string) {
    setDrafts((prev) => ({ ...prev, [dbKey]: value }));
  }

  async function handleBlur(field: { key: keyof BusinessPlanInput; dbKey: keyof BusinessPlan }) {
    if (drafts[field.dbKey] === undefined) return;
    const value = drafts[field.dbKey] as string;
    const stored = plan?.[field.dbKey];
    if (value === stored) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[field.dbKey];
        return next;
      });
      return;
    }
    setSavingField(String(field.dbKey));
    try {
      const updated = await businessPlanApi.patch({ [field.key]: value } as BusinessPlanInput);
      setPlan(updated);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[field.dbKey];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingField(null);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>;

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
            Forretningsplan & strategi — The Role Room
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
            Lagrer automatisk når du klikker ut av et felt. Følger BI/BBI-strukturen for strategiske analyser.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={handlePrint} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Skriv ut / lagre PDF
        </Button>
      </Stack>
      {BIZ_PLAN_SECTIONS.map((section) => (
        <Box
          key={section.id}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.42)',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.02rem' }}>
            {section.title}
          </Typography>
          {section.helperText ? (
            <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.84rem', mb: 1.5 }}>
              {section.helperText}
            </Typography>
          ) : null}
          <Stack spacing={1.5}>
            {section.fields.map((field) => (
              <TextField
                key={String(field.dbKey)}
                label={field.label}
                value={valueFor(field.dbKey)}
                onChange={(e) => handleChange(field.dbKey, e.target.value)}
                onBlur={() => { void handleBlur(field); }}
                fullWidth
                multiline
                minRows={field.minRows ?? 3}
                placeholder={field.placeholder}
                helperText={savingField === field.dbKey ? 'Lagrer…' : field.helperText}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────

export default function AdminRoom() {
  const [tab, setTab] = useState<AdminRoomTab>('funding');
  const userEmail = useMemo(() => getCurrentUserEmail(), []);

  if (userEmail !== ADMIN_ROOM_OWNER_EMAIL) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">
          Admin Room er kun tilgjengelig for produkteier ({ADMIN_ROOM_OWNER_EMAIL}).
        </Alert>
      </Container>
    );
  }

  let content: ReactNode = null;
  if (tab === 'funding') content = <FundingAppsTab />;
  else if (tab === 'investors') content = <InvestorContactsTab />;
  else if (tab === 'partners') content = <PartnerContactsTab />;
  else if (tab === 'business-plan') content = <BusinessPlanTab />;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem' }}>
            Admin Room
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.92rem' }}>
            Internt arbeidsrom for produkteier — IN-/EU-søknader, investor-pipeline og potensielle samarbeidspartnere.
            Ikke en del av det publiserte The Role Room-produktet.
          </Typography>
        </Box>
        <Tabs
          value={tab}
          onChange={(_event, next: AdminRoomTab) => setTab(next)}
          sx={{
            borderBottom: '1px solid rgba(148,163,184,0.16)',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, color: 'rgba(226,232,240,0.78)', minHeight: 42 },
            '& .Mui-selected': { color: '#f8fafc' },
            '& .MuiTabs-indicator': { backgroundColor: '#a78bfa' },
          }}
        >
          <Tab value="business-plan" label="Forretningsplan" />
          <Tab value="funding" label="Søknader (IN/EU)" />
          <Tab value="investors" label="Investor-pipeline" />
          <Tab value="partners" label="Samarbeidspartnere" />
        </Tabs>
        <Box>{content}</Box>
      </Stack>
    </Container>
  );
}
