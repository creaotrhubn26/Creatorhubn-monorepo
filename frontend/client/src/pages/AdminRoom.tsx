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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InsightsIcon from '@mui/icons-material/Insights';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  fundingAppsApi,
  investorContactsApi,
  partnerContactsApi,
  businessPlanApi,
  decksApi,
  activityLogApi,
  FUNDING_SCHEME_PRESETS,
  FUNDING_SCHEME_DEADLINES,
  FUNDING_STATUS_LABELS,
  INVESTOR_STATUS_LABELS,
  PARTNERSHIP_TYPE_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_CONTRACT_STATUS_LABELS,
  DEFAULT_DD_CHECKLIST,
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
  type PartnerContractStatus,
  type DueDiligenceItem,
  type BusinessPlan,
  type BusinessPlanInput,
  type ActivityLogEntry,
} from '../services/adminRoomApi';

import { RoleNavConfigTab } from '../components/role-room/components/admin-room/RoleNavConfigTab';
import { STUDENT_PAGE_CONFIGS } from '../components/role-room/components/StudentSEOPage';

const ADMIN_ROOM_OWNER_EMAIL = 'daniel@creatorhubn.com';

type AdminRoomTab = 'dashboard' | 'business-plan' | 'funding' | 'investors' | 'partners' | 'activity' | 'analytics' | 'cms' | 'presence' | 'role-nav';

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
  const [generating, setGenerating] = useState(false);

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
        deadline: initial.deadline,
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
              <TextField label="Søknadsfrist" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.deadline ?? ''} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value || null }))} helperText={form.scheme && FUNDING_SCHEME_DEADLINES[form.scheme] ? FUNDING_SCHEME_DEADLINES[form.scheme] : 'Sett egen frist'} />
              <TextField label="Innleveringsdato" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.submissionDate ?? ''} onChange={(e) => setForm((p) => ({ ...p, submissionDate: e.target.value || null }))} />
              <TextField label="Vedtaksdato" size="small" type="date" InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} value={form.decisionDate ?? ''} onChange={(e) => setForm((p) => ({ ...p, decisionDate: e.target.value || null }))} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Kontaktperson" size="small" sx={{ flex: 1 }} value={form.contactPerson ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} />
              <TextField label="Kontakt-e-post" size="small" sx={{ flex: 1 }} value={form.contactEmail ?? ''} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
            </Stack>
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontWeight: 600, fontSize: '0.86rem' }}>Søknadstekst</Typography>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" startIcon={<AutoAwesomeIcon />} onClick={handleGenerate} sx={{ textTransform: 'none', fontWeight: 700, color: '#a78bfa' }}>
                    Skjelett-mal
                  </Button>
                  {initial ? (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                      onClick={async () => {
                        if (!initial) return;
                        setGenerating(true);
                        try {
                          const result = await fundingAppsApi.generate(initial.id);
                          setForm((p) => ({ ...p, description: result.item.description }));
                          onSaved(result.item);
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setGenerating(false);
                        }
                      }}
                      disabled={generating}
                      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}
                    >
                      {generating ? 'Genererer…' : 'Generer via Claude'}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
              <TextField multiline minRows={10} fullWidth value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} disabled={generating} />
            </Box>
            <TextField label="Interne notater" size="small" multiline minRows={3} fullWidth value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
          {initial ? (
            <Button
              variant="outlined"
              onClick={() => window.print()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
              className="no-print"
            >
              Skriv ut / PDF
            </Button>
          ) : null}
          <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ flex: 1, textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
            {saving ? 'Lagrer…' : initial ? 'Lagre endringer' : 'Opprett'}
          </Button>
          <Button variant="text" onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }} className="no-print">Avbryt</Button>
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
      <Alert
        severity="info"
        sx={{
          bgcolor: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.22)',
          color: '#bfdbfe',
          '& .MuiAlert-icon': { color: '#60a5fa' },
        }}
      >
        <Typography sx={{ fontWeight: 700, color: '#bfdbfe' }}>
          Søknadsvinduer — Innovasjon Norge & EU
        </Typography>
        <Stack spacing={0.4} sx={{ fontSize: '0.84rem' }}>
          <Typography sx={{ fontSize: '0.84rem', color: 'rgba(219,234,254,0.92)' }}>
            • <strong>Markedsavklaring (1)</strong>: løpende — behandling 4-8 uker
          </Typography>
          <Typography sx={{ fontSize: '0.84rem', color: 'rgba(219,234,254,0.92)' }}>
            • <strong>Kommersialisering (2)</strong>: løpende — behandling 6-10 uker
          </Typography>
          <Typography sx={{ fontSize: '0.84rem', color: 'rgba(219,234,254,0.92)' }}>
            • <strong>Innovasjonskontrakter</strong>: utlysningsbasert — typisk 2-4 cut-offs per år
          </Typography>
          <Typography sx={{ fontSize: '0.84rem', color: 'rgba(219,234,254,0.92)' }}>
            • <strong>EU Horizon EIC</strong>: cut-off hver 2-3 mnd · sjekk
            {' '}<a href="https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en" target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>EIC kalenderen</a>
          </Typography>
        </Stack>
      </Alert>
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
                      {(() => {
                        if (!item.deadline || item.status === 'approved' || item.status === 'rejected') return null;
                        const deadlineDate = new Date(item.deadline);
                        const daysUntil = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        let label: string;
                        let bg: string;
                        let fg: string;
                        if (daysUntil < 0) {
                          label = `Frist passert (${item.deadline})`;
                          bg = 'rgba(248,113,113,0.22)';
                          fg = '#fca5a5';
                        } else if (daysUntil <= 7) {
                          label = `Frist om ${daysUntil}d (${item.deadline})`;
                          bg = 'rgba(248,113,113,0.18)';
                          fg = '#fca5a5';
                        } else if (daysUntil <= 30) {
                          label = `Frist om ${daysUntil}d (${item.deadline})`;
                          bg = 'rgba(251,191,36,0.18)';
                          fg = '#fde68a';
                        } else {
                          label = `Frist ${item.deadline}`;
                          bg = 'rgba(59,130,246,0.16)';
                          fg = '#bfdbfe';
                        }
                        return <Chip size="small" label={label} sx={{ bgcolor: bg, color: fg, fontWeight: 700 }} />;
                      })()}
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
        ddChecklist: initial.dd_checklist?.length ? initial.dd_checklist : DEFAULT_DD_CHECKLIST,
        deckUrl: initial.deck_url,
        deckUploadedAt: initial.deck_uploaded_at,
      });
    } else {
      setForm({ status: 'lead', currency: 'NOK', focusAreas: [], ddChecklist: DEFAULT_DD_CHECKLIST });
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

              {/* Pitch deck-tracking */}
              <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(15,23,42,0.42)' }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.4, fontSize: '0.92rem' }}>
                  Pitch deck
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.78rem', mb: 1 }}>
                  Lim inn delelenke, eller generer et nytt internt deck (10 seksjoner) som
                  pre-fylles fra Forretningsplan-fanen.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="Deck-URL"
                    size="small"
                    sx={{ flex: 2 }}
                    value={form.deckUrl ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, deckUrl: e.target.value || null }))}
                    placeholder="https://..."
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setForm((p) => ({ ...p, deckUploadedAt: new Date().toISOString() }))}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Marker oppdatert nå
                  </Button>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={async () => {
                      try {
                        const deckTitle = `${initial?.company_name ?? form.companyName ?? 'TROLL Investor'} — pitch deck`;
                        const result = await decksApi.create({
                          title: deckTitle,
                          description: 'Generert fra Admin Room — pre-fylt fra Forretningsplan',
                        });
                        const internalUrl = `/admin-room/deck/${result.deck.id}`;
                        setForm((p) => ({ ...p, deckUrl: internalUrl, deckUploadedAt: new Date().toISOString() }));
                      } catch (err) {
                        console.warn('Deck create failed', err);
                      }
                    }}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}
                  >
                    Generer fra Forretningsplan
                  </Button>
                  {form.deckUrl && form.deckUrl.startsWith('/admin-room/deck/') ? (
                    <Button
                      size="small"
                      variant="text"
                      component="a"
                      href={form.deckUrl}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Åpne deck
                    </Button>
                  ) : null}
                </Stack>
                {form.deckUploadedAt ? (
                  <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem', mt: 0.6 }}>
                    Sist oppdatert: {new Date(form.deckUploadedAt).toLocaleString('nb-NO')}
                  </Typography>
                ) : null}
              </Box>

              {/* Due-diligence-sjekkliste */}
              <Box sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(15,23,42,0.42)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>
                      Due-diligence-sjekkliste
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.78rem' }}>
                      {(form.ddChecklist ?? []).filter((d) => d.done).length} / {(form.ddChecklist ?? []).length} fullført
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => setForm((p) => ({
                      ...p,
                      ddChecklist: [...(p.ddChecklist ?? []), { label: 'Nytt punkt', done: false }],
                    }))}
                    sx={{ textTransform: 'none', fontWeight: 700, color: '#a78bfa' }}
                  >
                    Nytt punkt
                  </Button>
                </Stack>
                <Stack spacing={0.5}>
                  {(form.ddChecklist ?? []).map((item: DueDiligenceItem, idx: number) => (
                    <Stack key={idx} direction="row" spacing={1} alignItems="center">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          ddChecklist: (p.ddChecklist ?? []).map((d, i) => i === idx ? { ...d, done: e.target.checked } : d),
                        }))}
                        style={{ width: 18, height: 18, accentColor: '#a78bfa' }}
                      />
                      <TextField
                        size="small"
                        fullWidth
                        value={item.label}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          ddChecklist: (p.ddChecklist ?? []).map((d, i) => i === idx ? { ...d, label: e.target.value } : d),
                        }))}
                        sx={{
                          '& input': { textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'rgba(226,232,240,0.5)' : '#e2e8f0' },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setForm((p) => ({
                          ...p,
                          ddChecklist: (p.ddChecklist ?? []).filter((_, i) => i !== idx),
                        }))}
                        sx={{ color: 'rgba(248,113,113,0.7)' }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </Box>
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
                          <Stack direction="row" spacing={0.6} flexWrap="wrap" sx={{ mt: 0.6 }}>
                            {item.deck_url ? (
                              <Chip
                                size="small"
                                label="Deck delt"
                                component="a"
                                href={item.deck_url}
                                target="_blank"
                                rel="noreferrer"
                                clickable
                                sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#ddd6fe', cursor: 'pointer' }}
                              />
                            ) : (
                              <Chip size="small" label="Ingen deck" sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1' }} />
                            )}
                            {(() => {
                              const total = item.dd_checklist?.length ?? 0;
                              if (total === 0) return null;
                              const done = item.dd_checklist.filter((d) => d.done).length;
                              const pct = Math.round((done / total) * 100);
                              return (
                                <Chip
                                  size="small"
                                  label={`DD ${done}/${total} (${pct}%)`}
                                  sx={{
                                    bgcolor: pct === 100
                                      ? 'rgba(16,185,129,0.18)'
                                      : pct >= 50
                                        ? 'rgba(251,191,36,0.18)'
                                        : 'rgba(148,163,184,0.16)',
                                    color: pct === 100
                                      ? '#86efac'
                                      : pct >= 50
                                        ? '#fde68a'
                                        : '#cbd5e1',
                                    fontWeight: 700,
                                  }}
                                />
                              );
                            })()}
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
        contractStatus: initial.contract_status ?? 'none',
      });
    } else {
      setForm({ partnershipType: 'other', status: 'potential', contractStatus: 'none' });
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
            <FormControl size="small" fullWidth>
              <InputLabel>Kontrakt-status</InputLabel>
              <Select
                label="Kontrakt-status"
                value={form.contractStatus ?? 'none'}
                onChange={(e) => setForm((p) => ({ ...p, contractStatus: e.target.value as PartnerContractStatus }))}
              >
                {(Object.keys(PARTNER_CONTRACT_STATUS_LABELS) as PartnerContractStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>{PARTNER_CONTRACT_STATUS_LABELS[s]}</MenuItem>
                ))}
              </Select>
            </FormControl>
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
                      {item.contract_status && item.contract_status !== 'none' ? (
                        <Chip
                          size="small"
                          label={`Kontrakt: ${PARTNER_CONTRACT_STATUS_LABELS[item.contract_status as PartnerContractStatus]}`}
                          sx={{
                            bgcolor: item.contract_status === 'signed'
                              ? 'rgba(16,185,129,0.18)'
                              : item.contract_status === 'expired'
                                ? 'rgba(248,113,113,0.18)'
                                : 'rgba(251,191,36,0.18)',
                            color: item.contract_status === 'signed'
                              ? '#86efac'
                              : item.contract_status === 'expired'
                                ? '#fca5a5'
                                : '#fde68a',
                            fontWeight: 700,
                          }}
                        />
                      ) : null}
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
  const [generatingField, setGeneratingField] = useState<string | null>(null);
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

  async function handleGenerate(field: { key: keyof BusinessPlanInput; dbKey: keyof BusinessPlan; label: string }) {
    setGeneratingField(String(field.dbKey));
    setError(null);
    try {
      const existingContent = valueFor(field.dbKey);
      const result = await businessPlanApi.generateField({
        fieldKey: String(field.key),
        fieldLabel: field.label,
        existingContent,
      });
      // Sett som draft + persist umiddelbart
      setDrafts((prev) => ({ ...prev, [field.dbKey]: result.text }));
      const updated = await businessPlanApi.patch({ [field.key]: result.text } as BusinessPlanInput);
      setPlan(updated);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[field.dbKey];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingField(null);
    }
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
              <Box key={String(field.dbKey)}>
                <TextField
                  label={field.label}
                  value={valueFor(field.dbKey)}
                  onChange={(e) => handleChange(field.dbKey, e.target.value)}
                  onBlur={() => { void handleBlur(field); }}
                  fullWidth
                  multiline
                  minRows={field.minRows ?? 3}
                  placeholder={field.placeholder}
                  helperText={savingField === field.dbKey ? 'Lagrer…' : (generatingField === field.dbKey ? 'Genererer via Claude…' : field.helperText)}
                  disabled={generatingField === field.dbKey}
                />
                <Button
                  size="small"
                  startIcon={generatingField === field.dbKey ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
                  onClick={() => { void handleGenerate(field); }}
                  disabled={generatingField !== null || savingField !== null}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#a78bfa', mt: 0.5 }}
                >
                  {generatingField === field.dbKey ? 'Genererer…' : 'Generer via Claude'}
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Activity log
// ─────────────────────────────────────────────────────────

const ENTITY_LABEL: Record<string, string> = {
  funding_app: 'Søknad',
  investor: 'Investor',
  partner: 'Partner',
  business_plan: 'Forretningsplan',
  deck: 'Deck',
  deck_slide: 'Deck-slide',
};
const ACTION_LABEL: Record<string, string> = {
  created: 'Opprettet',
  updated: 'Oppdatert',
  deleted: 'Slettet',
  generated: 'AI-generert',
  status_change: 'Status endret',
};

function ActivityLogTab() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    activityLogApi.list({ limit: 100 })
      .then((data) => { if (!cancelled) setEntries(data); })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>;

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
        Append-only endrings-spor på tvers av Søknader, Investorer, Partnere, Forretningsplan og Deck. Brukes til IN-revisjons-spor.
      </Typography>
      {entries.length === 0 ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
          Ingen aktivitet enda. Hendelser logges automatisk når du oppretter, redigerer eller AI-genererer.
        </Alert>
      ) : (
        <Stack spacing={0.6}>
          {entries.map((e) => {
            const tone = e.action === 'created' ? { bg: 'rgba(52,211,153,0.16)', fg: '#86efac' }
              : e.action === 'deleted' ? { bg: 'rgba(248,113,113,0.16)', fg: '#fca5a5' }
              : e.action === 'generated' ? { bg: 'rgba(168,85,247,0.16)', fg: '#ddd6fe' }
              : { bg: 'rgba(96,165,250,0.16)', fg: '#bfdbfe' };
            return (
              <Stack
                key={e.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
                sx={{
                  p: 1, borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.14)',
                  background: 'rgba(2,6,23,0.34)',
                }}
              >
                <Chip size="small" label={ENTITY_LABEL[e.entity_type] ?? e.entity_type} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
                <Chip size="small" label={ACTION_LABEL[e.action] ?? e.action} sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 700 }} />
                <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.summary ?? '—'}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                  {new Date(e.created_at).toLocaleString('nb-NO')}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Dashboard / Hjem
// ─────────────────────────────────────────────────────────

function DashboardTab({ onJumpToTab }: { onJumpToTab: (tab: AdminRoomTab) => void }) {
  const [funding, setFunding] = useState<FundingApp[]>([]);
  const [investors, setInvestors] = useState<InvestorContact[]>([]);
  const [partners, setPartners] = useState<PartnerContact[]>([]);
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fundingAppsApi.list().catch(() => []),
      investorContactsApi.list().catch(() => []),
      partnerContactsApi.list().catch(() => []),
      businessPlanApi.get().catch(() => null),
    ]).then(([f, i, p, bp]) => {
      if (cancelled) return;
      setFunding(f);
      setInvestors(i);
      setPartners(p);
      setPlan(bp);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const fundingByStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of funding) {
      map.set(f.status, (map.get(f.status) ?? 0) + 1);
    }
    return map;
  }, [funding]);

  const totalAsk = useMemo(
    () => funding.reduce((sum, f) => sum + (f.amount_requested ?? 0), 0),
    [funding],
  );

  const investorsByStatus = useMemo(() => {
    const map = new Map<InvestorStatus, number>();
    for (const i of investors) {
      map.set(i.status, (map.get(i.status) ?? 0) + 1);
    }
    return map;
  }, [investors]);

  const partnersByStatus = useMemo(() => {
    const map = new Map<PartnerStatus, number>();
    for (const p of partners) {
      map.set(p.status, (map.get(p.status) ?? 0) + 1);
    }
    return map;
  }, [partners]);

  const planCompletion = useMemo(() => {
    if (!plan) return { filled: 0, total: 35, pct: 0 };
    const fields: Array<keyof BusinessPlan> = [
      'exec_summary', 'intro_overview', 'intro_vision', 'intro_sustainability',
      'intro_industry', 'intro_financials', 'internal_value_network_primary',
      'internal_value_network_support', 'internal_drivers_customer',
      'internal_drivers_capacity', 'internal_drivers_learning',
      'internal_resource_analysis', 'internal_operational', 'internal_dynamic',
      'internal_vrio', 'internal_network_structure', 'internal_strengths_weaknesses',
      'external_pestel', 'external_pestel_conclusion', 'external_porter',
      'external_porter_conclusion', 'external_competitors', 'external_competitor_summary',
      'external_stakeholders', 'external_stakeholder_conclusion',
      'swot_strengths', 'swot_weaknesses', 'swot_opportunities', 'swot_threats',
      'strategic_wheel', 'current_strategy', 'strategic_recommendation',
      'safe_suitability', 'safe_acceptability', 'safe_feasibility',
    ];
    let filled = 0;
    for (const f of fields) {
      const v = plan[f];
      if (typeof v === 'string' && v.trim().length > 0) filled++;
    }
    return { filled, total: fields.length, pct: Math.round((filled / fields.length) * 100) };
  }, [plan]);

  const upcomingDeadlines = useMemo(() => {
    type Deadline = { date: string; label: string; daysUntil: number; tab: AdminRoomTab };
    const list: Deadline[] = [];
    const now = Date.now();
    for (const f of funding) {
      if (f.deadline && f.status !== 'approved' && f.status !== 'rejected') {
        const days = Math.ceil((new Date(f.deadline).getTime() - now) / (1000 * 60 * 60 * 24));
        list.push({ date: f.deadline, label: `Søknad: ${f.project_name}`, daysUntil: days, tab: 'funding' });
      }
    }
    for (const i of investors) {
      if (i.next_step_due) {
        const days = Math.ceil((new Date(i.next_step_due).getTime() - now) / (1000 * 60 * 60 * 24));
        list.push({ date: i.next_step_due, label: `Investor: ${i.company_name} — ${i.next_step ?? 'oppfølging'}`, daysUntil: days, tab: 'investors' });
      }
    }
    for (const p of partners) {
      if (p.next_step_due) {
        const days = Math.ceil((new Date(p.next_step_due).getTime() - now) / (1000 * 60 * 60 * 24));
        list.push({ date: p.next_step_due, label: `Partner: ${p.company_name} — ${p.next_step ?? 'neste steg'}`, daysUntil: days, tab: 'partners' });
      }
    }
    return list.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5);
  }, [funding, investors, partners]);

  if (loading) {
    return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>;
  }

  return (
    <Stack spacing={2}>
      {/* Top KPI-stripe */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {[
          { label: 'Søknader', value: funding.length, sub: `${formatCurrency(totalAsk)} forespurt`, tab: 'funding' as const, color: '#a78bfa' },
          { label: 'Investorer', value: investors.length, sub: `${investorsByStatus.get('term_sheet') ?? 0} i term sheet`, tab: 'investors' as const, color: '#60a5fa' },
          { label: 'Partnere', value: partners.length, sub: `${partnersByStatus.get('active') ?? 0} aktive`, tab: 'partners' as const, color: '#34d399' },
          { label: 'Forretningsplan', value: `${planCompletion.pct}%`, sub: `${planCompletion.filled} / ${planCompletion.total} felt`, tab: 'business-plan' as const, color: '#fbbf24' },
        ].map((card) => (
          <Box
            key={card.label}
            onClick={() => onJumpToTab(card.tab)}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.42)',
              cursor: 'pointer',
              transition: 'background 0.15s',
              '&:hover': { background: 'rgba(168,85,247,0.08)' },
            }}
          >
            <Typography sx={{ color: card.color, fontSize: '0.78rem', fontWeight: 700, mb: 0.4, opacity: 0.86 }}>
              {card.label}
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.6rem', lineHeight: 1 }}>
              {card.value}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem', mt: 0.4 }}>
              {card.sub}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        {/* Frister */}
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.42)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>Neste 5 frister</Typography>
          {upcomingDeadlines.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen registrerte frister enda.
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {upcomingDeadlines.map((d, idx) => {
                const tone =
                  d.daysUntil < 0 ? { bg: 'rgba(248,113,113,0.18)', fg: '#fca5a5' }
                  : d.daysUntil <= 7 ? { bg: 'rgba(248,113,113,0.14)', fg: '#fca5a5' }
                  : d.daysUntil <= 30 ? { bg: 'rgba(251,191,36,0.16)', fg: '#fde68a' }
                  : { bg: 'rgba(59,130,246,0.14)', fg: '#bfdbfe' };
                const label =
                  d.daysUntil < 0 ? `Passert ${Math.abs(d.daysUntil)}d`
                  : d.daysUntil === 0 ? 'I dag'
                  : `${d.daysUntil}d`;
                return (
                  <Stack
                    key={`${d.tab}-${idx}`}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    onClick={() => onJumpToTab(d.tab)}
                    sx={{
                      p: 1, borderRadius: 1.5,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background: 'rgba(2,6,23,0.34)',
                      cursor: 'pointer',
                      '&:hover': { background: 'rgba(168,85,247,0.08)' },
                    }}
                  >
                    <Chip size="small" label={label} sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 700, minWidth: 70 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.label}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem' }}>
                        {d.date}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Søknad-status-fordeling */}
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.42)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>Søknader per status</Typography>
          {funding.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen søknader registrert enda.
            </Alert>
          ) : (
            <Stack spacing={0.5}>
              {(Object.keys(FUNDING_STATUS_LABELS) as FundingAppStatus[]).map((status) => {
                const count = fundingByStatus.get(status) ?? 0;
                const pct = funding.length > 0 ? Math.round((count / funding.length) * 100) : 0;
                if (count === 0) return null;
                return (
                  <Box key={status}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem' }}>
                        {FUNDING_STATUS_LABELS[status]}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.84rem' }}>
                        {count} ({pct}%)
                      </Typography>
                    </Stack>
                    <Box sx={{ height: 6, bgcolor: 'rgba(148,163,184,0.16)', borderRadius: 3, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#a78bfa', transition: 'width 0.2s' }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Box>

      {/* Investor pipeline + partner liste i bunnen */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.42)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>Investor pipeline</Typography>
          {investors.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen investorer enda.
            </Alert>
          ) : (
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              {(Object.keys(INVESTOR_STATUS_LABELS) as InvestorStatus[]).map((status) => {
                const count = investorsByStatus.get(status) ?? 0;
                if (count === 0) return null;
                return (
                  <Chip
                    key={status}
                    label={`${INVESTOR_STATUS_LABELS[status]}: ${count}`}
                    sx={{ bgcolor: 'rgba(96,165,250,0.16)', color: '#bfdbfe', fontWeight: 700 }}
                  />
                );
              })}
            </Stack>
          )}
        </Box>
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.42)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>Partner-status</Typography>
          {partners.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen partnere enda.
            </Alert>
          ) : (
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              {(Object.keys(PARTNER_STATUS_LABELS) as PartnerStatus[]).map((status) => {
                const count = partnersByStatus.get(status) ?? 0;
                if (count === 0) return null;
                return (
                  <Chip
                    key={status}
                    label={`${PARTNER_STATUS_LABELS[status]}: ${count}`}
                    sx={{ bgcolor: 'rgba(52,211,153,0.16)', color: '#86efac', fontWeight: 700 }}
                  />
                );
              })}
            </Stack>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Analytics-hub — GA4 + Microsoft Clarity per domene
// ─────────────────────────────────────────────────────────

interface AnalyticsPlatform {
  name: string;
  domain: string;
  id: string;
  idLabel: string;
  url: string;
  description: string;
  tone: 'ga4' | 'clarity';
}

const ANALYTICS_PLATFORMS: AnalyticsPlatform[] = [
  {
    name: 'GA4 — CreatorHub',
    domain: 'creatorhubn.com',
    id: 'G-6E5MJT8REW',
    idLabel: 'Measurement ID',
    url: 'https://analytics.google.com/',
    description: 'Trafikk, konvertering, events. Real-time + standard-rapporter.',
    tone: 'ga4',
  },
  {
    name: 'GA4 — The Role Room',
    domain: 'theroleroom.com',
    id: 'G-9T7K5TJVFX',
    idLabel: 'Measurement ID',
    url: 'https://analytics.google.com/',
    description: 'Trafikk + Role-Room-events (role_room_*). Konfigurerbare funneler.',
    tone: 'ga4',
  },
  {
    name: 'Microsoft Clarity — CreatorHub',
    domain: 'creatorhubn.com',
    id: 'wqg9kj1vxt',
    idLabel: 'Project ID',
    url: 'https://clarity.microsoft.com/projects/view/wqg9kj1vxt/dashboard',
    description: 'Session-replay, heatmaps, rage-clicks, dead-clicks.',
    tone: 'clarity',
  },
  {
    name: 'Microsoft Clarity — The Role Room',
    domain: 'theroleroom.com',
    id: 'wqgcu06tz0',
    idLabel: 'Project ID',
    url: 'https://clarity.microsoft.com/projects/view/wqgcu06tz0/dashboard',
    description: 'Session-replay, heatmaps. Koblet til GA4 via custom dimension.',
    tone: 'clarity',
  },
];

interface CapturedEvent {
  name: string;
  params: Record<string, unknown>;
  capturedAt: number;
}

function useRecentGtagEvents(): CapturedEvent[] {
  const [events, setEvents] = useState<CapturedEvent[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      dataLayer?: unknown[];
      __adminRoomGtagHooked?: boolean;
      __adminRoomGtagListeners?: ((ev: CapturedEvent) => void)[];
    };
    w.dataLayer = w.dataLayer || [];
    w.__adminRoomGtagListeners = w.__adminRoomGtagListeners || [];

    if (!w.__adminRoomGtagHooked) {
      const originalPush = w.dataLayer.push.bind(w.dataLayer);
      w.dataLayer.push = (...args: unknown[]) => {
        for (const entry of args) {
          // dataLayer fanger både arrays (gtag-syntaks) og objekter (GTM-syntaks)
          if (Array.isArray(entry) && entry[0] === 'event' && typeof entry[1] === 'string') {
            const ev: CapturedEvent = {
              name: String(entry[1]),
              params: (entry[2] ?? {}) as Record<string, unknown>,
              capturedAt: Date.now(),
            };
            for (const cb of w.__adminRoomGtagListeners!) cb(ev);
          }
        }
        return originalPush(...args);
      };
      w.__adminRoomGtagHooked = true;
    }

    const listener = (ev: CapturedEvent) => {
      setEvents((prev) => [ev, ...prev].slice(0, 50));
    };
    w.__adminRoomGtagListeners.push(listener);

    return () => {
      const idx = w.__adminRoomGtagListeners!.indexOf(listener);
      if (idx >= 0) w.__adminRoomGtagListeners!.splice(idx, 1);
    };
  }, []);

  return events;
}

function AnalyticsTab() {
  const recentEvents = useRecentGtagEvents();
  const roleRoomEventCount = useMemo(
    () => recentEvents.filter((e) => e.name.startsWith('role_room_')).length,
    [recentEvents],
  );

  return (
    <Stack spacing={2}>
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
        Snarvei til alle analytics-platformer for begge domener. Klikk en plattform for å åpne dashboardet i ny fane.
        Hendelses-loggen under viser GA4-events fanget i denne nettleser-sessionen — bruk den for å verifisere at events
        faktisk fyres i produksjon.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        }}
      >
        {ANALYTICS_PLATFORMS.map((p) => {
          const accent = p.tone === 'ga4'
            ? { fg: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.32)' }
            : { fg: '#22d3ee', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.32)' };
          return (
            <Card
              key={p.id}
              sx={{
                background: 'rgba(2,6,23,0.42)',
                border: `1px solid ${accent.border}`,
                color: '#e2e8f0',
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  {p.tone === 'ga4' ? <InsightsIcon sx={{ color: accent.fg }} /> : <VisibilityIcon sx={{ color: accent.fg }} />}
                  <Typography sx={{ fontWeight: 700, color: '#f8fafc', flex: 1 }}>{p.name}</Typography>
                  <Chip
                    size="small"
                    label={p.domain}
                    sx={{ bgcolor: accent.bg, color: accent.fg, fontWeight: 600, fontSize: '0.7rem' }}
                  />
                </Stack>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.82rem', mb: 1 }}>
                  {p.description}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                    {p.idLabel}: <Box component="span" sx={{ color: '#cbd5e1' }}>{p.id}</Box>
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    variant="outlined"
                    endIcon={<OpenInNewIcon />}
                    sx={{
                      color: accent.fg,
                      borderColor: accent.border,
                      textTransform: 'none',
                      '&:hover': { borderColor: accent.fg, bgcolor: accent.bg },
                    }}
                  >
                    Åpne dashboard
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Card sx={{ background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.16)', color: '#e2e8f0' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, color: '#f8fafc' }}>Live GA4-events</Typography>
            <Chip
              size="small"
              label={`${recentEvents.length} totalt / ${roleRoomEventCount} role_room_*`}
              sx={{ bgcolor: 'rgba(167,139,250,0.16)', color: '#ddd6fe', fontWeight: 600 }}
            />
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem', mb: 1 }}>
            Lytter på <code>window.dataLayer.push</code> for å fange opp gtag-events i sanntid. Tom på localhost — Clarity og GA4 skipper localhost. Bruk Vercel-preview eller produksjon for å se trafikk.
          </Typography>
          {recentEvents.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
              Ingen events fanget i denne sessionen ennå. Naviger rundt i Role Room (opprett rolle, bytt tab, etc.) — events vises her i sanntid.
            </Alert>
          ) : (
            <Stack spacing={0.6} sx={{ maxHeight: 420, overflowY: 'auto' }}>
              {recentEvents.map((ev, idx) => {
                const isRoleRoom = ev.name.startsWith('role_room_');
                const tone = isRoleRoom
                  ? { bg: 'rgba(167,139,250,0.16)', fg: '#ddd6fe' }
                  : { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1' };
                return (
                  <Stack
                    key={`${ev.capturedAt}-${idx}`}
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background: 'rgba(2,6,23,0.34)',
                    }}
                  >
                    <Chip size="small" label={ev.name} sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 700, fontFamily: 'monospace' }} />
                    <Typography
                      sx={{
                        color: 'rgba(203,213,225,0.85)',
                        fontSize: '0.74rem',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontFamily: 'monospace',
                      }}
                    >
                      {Object.entries(ev.params)
                        .filter(([k]) => k !== 'platform')
                        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                        .join(' · ') || '—'}
                    </Typography>
                    <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                      {new Date(ev.capturedAt).toLocaleTimeString('nb-NO')}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: CMS — form-basert editor for SEO-landingssider
// ─────────────────────────────────────────────────────────

interface CmsUsageExample {
  title: string;
  body: string;
}

interface CmsRelatedStudy {
  name: string;
  institution: string;
  note?: string;
}

interface CmsPageContent {
  h1: string;
  subtitle: string;
  intro: string;
  audience: string;
  ctaLabel: string;
  usageExamples: CmsUsageExample[];
  highlightedFeatures: string[];
  relatedStudies?: CmsRelatedStudy[];
}

interface CmsPageRow {
  slug: string;
  variant: string;
  published: boolean;
  content: Record<string, unknown>;
  updated_at?: string;
  updated_by?: string;
}

type CmsState =
  | { kind: 'list' }
  | { kind: 'edit'; slug: string };

function CmsTab() {
  const [state, setState] = useState<CmsState>({ kind: 'list' });

  return (
    <Stack spacing={2}>
      {state.kind === 'list' ? (
        <CmsListView onEdit={(slug) => setState({ kind: 'edit', slug })} />
      ) : (
        <CmsEditView slug={state.slug} onClose={() => setState({ kind: 'list' })} />
      )}
    </Stack>
  );
}

function CmsListView({ onEdit }: { onEdit: (slug: string) => void }) {
  const defaultEntries = useMemo(() => {
    return Object.entries(STUDENT_PAGE_CONFIGS).map(([slug, config]) => ({
      slug,
      variant: 'student',
      h1: config.h1,
      audience: config.audience,
    }));
  }, []);

  const [cmsPages, setCmsPages] = useState<CmsPageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/admin/cms/pages', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { pages: [] }))
      .then((data) => {
        if (cancelled) return;
        setCmsPages(Array.isArray(data?.pages) ? data.pages : []);
      })
      .catch(() => {
        if (!cancelled) setCmsPages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cmsBySlug = useMemo(() => {
    const map: Record<string, CmsPageRow> = {};
    for (const p of cmsPages) map[p.slug] = p;
    return map;
  }, [cmsPages]);

  return (
    <Stack spacing={2}>
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
        Redigér innholdet på SEO-landingssidene uten kode-deploy. Endringer trer i kraft umiddelbart (med 5-min CDN-cache).
        Sider markert <Chip size="small" label="kode-default" sx={{ ml: 0.5, height: 18, fontSize: '0.66rem', bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} /> bruker hardkodet fallback til de overstyres her.
      </Typography>
      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>
      ) : (
        <Stack spacing={0.6}>
          {defaultEntries.map((e) => {
            const cms = cmsBySlug[e.slug];
            const hasOverride = !!cms;
            return (
              <Stack
                key={e.slug}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
                sx={{
                  p: 1.2, borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.14)',
                  background: 'rgba(2,6,23,0.34)',
                }}
              >
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                  <Chip
                    size="small"
                    label={hasOverride ? (cms.published ? 'live' : 'utkast') : 'kode-default'}
                    sx={{
                      bgcolor: hasOverride
                        ? (cms.published ? 'rgba(34,197,94,0.16)' : 'rgba(249,115,22,0.16)')
                        : 'rgba(148,163,184,0.16)',
                      color: hasOverride
                        ? (cms.published ? '#86efac' : '#fdba74')
                        : '#cbd5e1',
                      fontWeight: 700, fontSize: '0.7rem',
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.h1}
                    </Typography>
                    <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                      /{e.slug} · {e.audience.split('·')[0].trim()}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    href={`https://theroleroom.com/${e.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      color: 'rgba(203,213,225,0.85)',
                      borderColor: 'rgba(148,163,184,0.24)',
                      textTransform: 'none',
                      fontSize: '0.78rem',
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onEdit(e.slug)}
                    sx={{
                      bgcolor: '#a78bfa',
                      color: '#0b1120',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      '&:hover': { bgcolor: '#c4b5fd' },
                    }}
                  >
                    Redigér
                  </Button>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function CmsEditView({ slug, onClose }: { slug: string; onClose: () => void }) {
  const defaultConfig = useMemo(
    () => STUDENT_PAGE_CONFIGS[slug as keyof typeof STUDENT_PAGE_CONFIGS],
    [slug],
  );
  const [content, setContent] = useState<CmsPageContent>(() => ({
    h1: defaultConfig?.h1 ?? '',
    subtitle: defaultConfig?.subtitle ?? '',
    intro: defaultConfig?.intro ?? '',
    audience: defaultConfig?.audience ?? '',
    ctaLabel: defaultConfig?.ctaLabel ?? 'Kom i gang',
    usageExamples: defaultConfig?.usageExamples ?? [],
    highlightedFeatures: defaultConfig?.highlightedFeatures ?? [],
    relatedStudies: defaultConfig?.relatedStudies,
  }));
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewReadyRef = useRef(false);

  // Sanntids-preview: send content til iframe via postMessage
  // hver gang content endres. Debouncet med rAF for å unngå spam.
  useEffect(() => {
    if (!previewReadyRef.current) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const raf = requestAnimationFrame(() => {
      win.postMessage(
        { type: 'roleroom-cms-preview', pageKey: slug, content },
        '*',
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [content, slug]);

  // Vent til iframe sender "preview-ready" så vi vet at den kan motta postMessage
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'roleroom-cms-preview-ready' && event.data?.pageKey === slug) {
        previewReadyRef.current = true;
        // Send current state straks
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'roleroom-cms-preview', pageKey: slug, content },
          '*',
        );
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // Kun slug — content endring trigger separat effekt over
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Last existing CMS-override hvis den finnes — ellers behold defaults.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/cms/pages/${slug}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const c = data?.page?.content as Partial<CmsPageContent> | undefined;
        if (c && typeof c === 'object') {
          setContent((prev) => ({
            ...prev,
            ...(typeof c.h1 === 'string' && c.h1 ? { h1: c.h1 } : {}),
            ...(typeof c.subtitle === 'string' && c.subtitle ? { subtitle: c.subtitle } : {}),
            ...(typeof c.intro === 'string' && c.intro ? { intro: c.intro } : {}),
            ...(typeof c.audience === 'string' && c.audience ? { audience: c.audience } : {}),
            ...(typeof c.ctaLabel === 'string' && c.ctaLabel ? { ctaLabel: c.ctaLabel } : {}),
            ...(Array.isArray(c.usageExamples) ? { usageExamples: c.usageExamples } : {}),
            ...(Array.isArray(c.highlightedFeatures) ? { highlightedFeatures: c.highlightedFeatures } : {}),
            ...(Array.isArray(c.relatedStudies) ? { relatedStudies: c.relatedStudies } : {}),
          }));
        }
        if (typeof data?.page?.published === 'boolean') {
          setPublished(data.page.published);
        }
      })
      .catch(() => {
        // Ignore — defaults beholdes.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/cms/pages/${slug}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: 'student',
          published,
          content,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback('Lagret ✓ (cache oppdateres innen 5 min)');
    } catch (err) {
      setFeedback(`Feil: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof CmsPageContent>(key: K, value: CmsPageContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>;

  const previewWidths = { desktop: '100%', tablet: 768, mobile: 390 };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(380px, 1fr) minmax(0, 1.4fr)' },
        gap: 2,
        minHeight: '70vh',
      }}
    >
      {/* ── Editor-pane ────────────────────────────────────── */}
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button onClick={onClose} size="small" sx={{ color: 'rgba(203,213,225,0.85)', textTransform: 'none' }}>
            ← Oversikt
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="outlined"
            href={`https://theroleroom.com/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            sx={{ color: 'rgba(203,213,225,0.85)', borderColor: 'rgba(148,163,184,0.24)', textTransform: 'none', fontSize: '0.78rem' }}
          >
            Live
          </Button>
        </Stack>

        <Box sx={{ p: 2, bgcolor: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 1.5 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 0.5, fontSize: '1rem' }}>
            /{slug}
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.82rem' }}>
            Endringer i skjemaet vises i sanntid i preview-panelet. Lagre når du er fornøyd.
          </Typography>
        </Box>

        <CmsTextField label="Tittel (H1)" value={content.h1} onChange={(v) => updateField('h1', v)} />
      <CmsTextField label="Undertittel" value={content.subtitle} onChange={(v) => updateField('subtitle', v)} multiline rows={2} />
      <CmsTextField label="Intro-tekst" value={content.intro} onChange={(v) => updateField('intro', v)} multiline rows={4} />
      <CmsTextField label="Målgruppe (vises som chip)" value={content.audience} onChange={(v) => updateField('audience', v)} />
      <CmsTextField label="CTA-knapp-tekst" value={content.ctaLabel} onChange={(v) => updateField('ctaLabel', v)} />

      <CmsListEditor
        label="Bruks-eksempler (kort i sentralseksjon)"
        items={content.usageExamples}
        onChange={(items) => updateField('usageExamples', items)}
        emptyItem={{ title: '', body: '' }}
        renderItem={(item, onUpdate) => (
          <Stack spacing={1}>
            <CmsTextField label="Tittel" value={item.title} onChange={(v) => onUpdate({ ...item, title: v })} />
            <CmsTextField label="Brødtekst" value={item.body} onChange={(v) => onUpdate({ ...item, body: v })} multiline rows={3} />
          </Stack>
        )}
      />

      <CmsChipListEditor
        label="Fremhevede funksjoner (chips)"
        items={content.highlightedFeatures}
        onChange={(items) => updateField('highlightedFeatures', items)}
      />

      <CmsListEditor
        label="Relaterte studier (valgfritt — kun for studie-rettede sider)"
        items={content.relatedStudies ?? []}
        onChange={(items) => updateField('relatedStudies', items.length > 0 ? items : undefined)}
        emptyItem={{ name: '', institution: '' }}
        renderItem={(item, onUpdate) => (
          <Stack spacing={1}>
            <CmsTextField label="Studie-navn" value={item.name} onChange={(v) => onUpdate({ ...item, name: v })} />
            <CmsTextField label="Institusjon" value={item.institution} onChange={(v) => onUpdate({ ...item, institution: v })} />
            <CmsTextField label="Notat (valgfritt)" value={item.note ?? ''} onChange={(v) => onUpdate({ ...item, note: v || undefined })} />
          </Stack>
        )}
      />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.16)', bgcolor: 'rgba(2,6,23,0.34)' }}>
        <Chip
          size="small"
          label={published ? 'Live' : 'Utkast'}
          sx={{
            bgcolor: published ? 'rgba(34,197,94,0.16)' : 'rgba(249,115,22,0.16)',
            color: published ? '#86efac' : '#fdba74',
            fontWeight: 700,
          }}
        />
        <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem', flex: 1 }}>
          {published
            ? 'Innholdet vises offentlig på theroleroom.com/' + slug
            : 'Utkast — offentlige besøkende ser hardkodet default-content.'}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setPublished((p) => !p)}
          sx={{
            color: 'rgba(203,213,225,0.85)',
            borderColor: 'rgba(148,163,184,0.32)',
            textTransform: 'none',
          }}
        >
          {published ? 'Sett til utkast' : 'Publiser'}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{
            bgcolor: '#a78bfa',
            color: '#0b1120',
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { bgcolor: '#c4b5fd' },
          }}
        >
          {saving ? 'Lagrer …' : 'Lagre endringer'}
        </Button>
        {feedback ? (
          <Alert
            severity={feedback.startsWith('Feil') ? 'error' : 'success'}
            sx={{
              flex: 1,
              bgcolor: feedback.startsWith('Feil') ? 'rgba(239,68,68,0.10)' : 'rgba(34,197,94,0.10)',
              color: feedback.startsWith('Feil') ? '#fca5a5' : '#86efac',
            }}
          >
            {feedback}
          </Alert>
        ) : null}
      </Stack>
      </Stack>

      {/* ── Preview-pane ──────────────────────────────────── */}
      <Box
        sx={{
          position: 'sticky',
          top: 16,
          alignSelf: 'flex-start',
          width: '100%',
          height: 'calc(100vh - 100px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1.5,
          bgcolor: 'rgba(2,6,23,0.62)',
          border: '1px solid rgba(148,163,184,0.16)',
          borderRadius: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            size="small"
            label="Live preview"
            sx={{ bgcolor: 'rgba(34,197,94,0.16)', color: '#86efac', fontWeight: 700, fontSize: '0.7rem' }}
          />
          <Box sx={{ flex: 1 }} />
          {(['desktop', 'tablet', 'mobile'] as const).map((mode) => (
            <Button
              key={mode}
              size="small"
              onClick={() => setPreviewMode(mode)}
              sx={{
                color: previewMode === mode ? '#a78bfa' : 'rgba(148,163,184,0.85)',
                bgcolor: previewMode === mode ? 'rgba(167,139,250,0.10)' : 'transparent',
                textTransform: 'capitalize',
                minWidth: 0,
                px: 1.2,
                fontSize: '0.74rem',
                '&:hover': { bgcolor: 'rgba(167,139,250,0.08)' },
              }}
            >
              {mode}
            </Button>
          ))}
        </Stack>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            overflow: 'auto',
            bgcolor: '#000',
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              width: previewWidths[previewMode],
              maxWidth: '100%',
              height: '100%',
              transition: 'width 0.25s ease',
            }}
          >
            <iframe
              ref={iframeRef}
              src={`/${slug}`}
              title={`Preview: /${slug}`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#0b1120',
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function CmsTextField({
  label,
  value,
  onChange,
  multiline,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      multiline={multiline}
      rows={rows}
      size="small"
      fullWidth
      sx={{
        '& .MuiInputBase-root': { bgcolor: 'rgba(2,6,23,0.42)', color: '#e2e8f0' },
        '& .MuiInputLabel-root': { color: 'rgba(148,163,184,0.85)' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
      }}
    />
  );
}

function CmsListEditor<T>({
  label,
  items,
  onChange,
  emptyItem,
  renderItem,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  emptyItem: T;
  renderItem: (item: T, onUpdate: (next: T) => void) => React.ReactNode;
}) {
  return (
    <Stack spacing={1}>
      <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.84rem', fontWeight: 600 }}>{label}</Typography>
      <Stack spacing={1.5}>
        {items.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.16)',
              bgcolor: 'rgba(2,6,23,0.34)',
            }}
          >
            <Stack spacing={1}>
              {renderItem(item, (next) => {
                const copy = [...items];
                copy[idx] = next;
                onChange(copy);
              })}
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  sx={{ color: '#fca5a5', textTransform: 'none', fontSize: '0.78rem' }}
                >
                  Fjern
                </Button>
              </Stack>
            </Stack>
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange([...items, emptyItem])}
          sx={{
            color: '#a78bfa',
            textTransform: 'none',
            alignSelf: 'flex-start',
          }}
        >
          Legg til
        </Button>
      </Stack>
    </Stack>
  );
}

function CmsChipListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setInput('');
  };

  return (
    <Stack spacing={1}>
      <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.84rem', fontWeight: 600 }}>{label}</Typography>
      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
        {items.map((item, idx) => (
          <Chip
            key={`${item}-${idx}`}
            label={item}
            onDelete={() => onChange(items.filter((_, i) => i !== idx))}
            sx={{
              bgcolor: 'rgba(167,139,250,0.16)',
              color: '#ddd6fe',
              border: '1px solid rgba(167,139,250,0.32)',
            }}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
          }}
          placeholder="Ny funksjon …"
          sx={{
            flex: 1,
            '& .MuiInputBase-root': { bgcolor: 'rgba(2,6,23,0.42)', color: '#e2e8f0' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
          }}
        />
        <Button onClick={add} size="small" variant="outlined" sx={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.32)', textTransform: 'none' }}>
          Legg til
        </Button>
      </Stack>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Section: Presence — community-kanaler + posts + outreach
// ─────────────────────────────────────────────────────────

interface CommunityChannel {
  id: string;
  channel_type: string;
  display_name: string;
  handle?: string;
  url?: string;
  audience_size?: number;
  notes?: string;
  status: string;
  priority: number;
}

interface CommunityPost {
  id: string;
  channel_id: string;
  post_type: string;
  title: string;
  body?: string;
  status: string;
  scheduled_for?: string;
  published_at?: string;
  published_url?: string;
  ai_generated: boolean;
}

interface OutreachContact {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  email?: string;
  priority: number;
  status: string;
  last_contacted?: string;
  notes?: string;
}

const CHANNEL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  product_hunt: { label: 'Product Hunt', color: '#ea552c' },
  reddit: { label: 'Reddit', color: '#ff4500' },
  indie_hackers: { label: 'IndieHackers', color: '#0e2439' },
  beta_list: { label: 'BetaList', color: '#3b82f6' },
  hacker_news: { label: 'Hacker News', color: '#f97316' },
  discord: { label: 'Discord', color: '#5865f2' },
  twitter: { label: 'Twitter/X', color: '#1da1f2' },
  linkedin: { label: 'LinkedIn', color: '#0a66c2' },
  tiktok: { label: 'TikTok', color: '#000000' },
  youtube: { label: 'YouTube', color: '#ff0000' },
  blog: { label: 'Blogg/Presse', color: '#a78bfa' },
  other: { label: 'Annet', color: '#94a3b8' },
};

const STATUS_TONES: Record<string, { bg: string; fg: string; label: string }> = {
  planned: { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1', label: 'Planlagt' },
  active: { bg: 'rgba(34,197,94,0.16)', fg: '#86efac', label: 'Aktiv' },
  paused: { bg: 'rgba(249,115,22,0.16)', fg: '#fdba74', label: 'Pause' },
  won: { bg: 'rgba(167,139,250,0.16)', fg: '#ddd6fe', label: 'Vunnet' },
  lost: { bg: 'rgba(239,68,68,0.16)', fg: '#fca5a5', label: 'Tapt' },
  draft: { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1', label: 'Utkast' },
  review: { bg: 'rgba(96,165,250,0.16)', fg: '#bfdbfe', label: 'Til review' },
  scheduled: { bg: 'rgba(251,191,36,0.16)', fg: '#fcd34d', label: 'Planlagt' },
  published: { bg: 'rgba(34,197,94,0.16)', fg: '#86efac', label: 'Publisert' },
  responded: { bg: 'rgba(167,139,250,0.16)', fg: '#ddd6fe', label: 'Respons' },
  archived: { bg: 'rgba(148,163,184,0.12)', fg: 'rgba(203,213,225,0.65)', label: 'Arkivert' },
  not_contacted: { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1', label: 'Ikke kontaktet' },
  reached_out: { bg: 'rgba(96,165,250,0.16)', fg: '#bfdbfe', label: 'Pitched' },
  meeting_scheduled: { bg: 'rgba(251,191,36,0.16)', fg: '#fcd34d', label: 'Møte avtalt' },
  covered: { bg: 'rgba(167,139,250,0.16)', fg: '#ddd6fe', label: 'Dekket' },
  no_response: { bg: 'rgba(148,163,184,0.10)', fg: 'rgba(203,213,225,0.65)', label: 'Ingen respons' },
  not_interested: { bg: 'rgba(239,68,68,0.10)', fg: '#fca5a5', label: 'Ikke interessert' },
};

function PresenceTab() {
  const [section, setSection] = useState<'channels' | 'posts' | 'contacts' | 'mentions'>('channels');

  return (
    <Stack spacing={2}>
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.86rem' }}>
        Koordiner ekstern presence på community-plattformer (Product Hunt, Reddit, HN, IndieHackers, BetaList) og outreach til journalister/bloggere. Bruk The Role Room Agent for å generere post-utkast per kanal-type.
      </Typography>
      <Tabs
        value={section}
        onChange={(_e, v: 'channels' | 'posts' | 'contacts' | 'mentions') => setSection(v)}
        variant="scrollable"
        sx={{
          borderBottom: '1px solid rgba(148,163,184,0.16)',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: 'rgba(226,232,240,0.78)', minHeight: 38, fontSize: '0.84rem' },
          '& .Mui-selected': { color: '#f8fafc' },
          '& .MuiTabs-indicator': { backgroundColor: '#a78bfa' },
        }}
      >
        <Tab value="channels" label="Kanaler" />
        <Tab value="posts" label="Posts" />
        <Tab value="contacts" label="Kontakter / Outreach" />
        <Tab value="mentions" label="Reddit Mentions" />
      </Tabs>
      {section === 'channels' && <PresenceChannelsView />}
      {section === 'posts' && <PresencePostsView />}
      {section === 'contacts' && <PresenceContactsView />}
      {section === 'mentions' && <PresenceRedditMentionsView />}
    </Stack>
  );
}

function PresenceChannelsView() {
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<CommunityChannel>>({
    channel_type: 'reddit',
    display_name: '',
    handle: '',
    url: '',
    priority: 3,
    status: 'planned',
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/community/channels', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { channels: [] }))
      .then((data) => setChannels(Array.isArray(data?.channels) ? data.channels : []))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/admin/community/channels', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAddOpen(false);
      setDraft({ channel_type: 'reddit', display_name: '', handle: '', url: '', priority: 3, status: 'planned' });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.32)', textTransform: 'none' }}
        >
          Ny kanal
        </Button>
      </Stack>
      <Stack spacing={0.8}>
      {channels.length === 0 ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
          Ingen kanaler ennå. Seed-data er lagt i migrasjon 143 — om denne er tom: backend ikke deployed eller migrasjon ikke kjørt.
        </Alert>
      ) : channels.map((c) => {
        const typeMeta = CHANNEL_TYPE_LABELS[c.channel_type] ?? CHANNEL_TYPE_LABELS.other;
        const statusMeta = STATUS_TONES[c.status] ?? STATUS_TONES.planned;
        return (
          <Stack
            key={c.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            sx={{
              p: 1.2, borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.14)',
              background: 'rgba(2,6,23,0.34)',
            }}
          >
            <Chip
              label={`P${c.priority}`}
              size="small"
              sx={{
                bgcolor: c.priority === 1 ? 'rgba(239,68,68,0.16)' : c.priority === 2 ? 'rgba(249,115,22,0.16)' : 'rgba(148,163,184,0.16)',
                color: c.priority === 1 ? '#fca5a5' : c.priority === 2 ? '#fdba74' : '#cbd5e1',
                fontWeight: 700, height: 22,
              }}
            />
            <Chip
              label={typeMeta.label}
              size="small"
              sx={{ bgcolor: `${typeMeta.color}26`, color: typeMeta.color, fontWeight: 600, height: 22 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.display_name}
              </Typography>
              {c.handle ? (
                <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                  {c.handle}{c.audience_size ? ` · ${(c.audience_size / 1000).toFixed(0)}k` : ''}
                </Typography>
              ) : null}
            </Box>
            <Chip
              size="small"
              label={statusMeta.label}
              sx={{ bgcolor: statusMeta.bg, color: statusMeta.fg, fontWeight: 700, height: 22 }}
            />
            {c.url ? (
              <Button
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                sx={{ color: 'rgba(203,213,225,0.85)', textTransform: 'none', fontSize: '0.78rem' }}
              >
                Åpne
              </Button>
            ) : null}
          </Stack>
        );
      })}
      </Stack>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'rgba(2,6,23,0.95)', color: '#f8fafc' }}>Ny kanal</DialogTitle>
        <DialogContent sx={{ bgcolor: 'rgba(2,6,23,0.95)', pt: '20px !important' }}>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>Type</InputLabel>
              <Select
                label="Type"
                value={draft.channel_type ?? 'reddit'}
                onChange={(e) => setDraft({ ...draft, channel_type: e.target.value as string })}
                sx={{ color: '#e2e8f0' }}
              >
                {Object.entries(CHANNEL_TYPE_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Visning-navn"
              value={draft.display_name ?? ''}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              size="small"
              required
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' } }}
            />
            <TextField
              label="Handle (f.eks. r/Filmmakers)"
              value={draft.handle ?? ''}
              onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
              size="small"
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' } }}
            />
            <TextField
              label="URL"
              value={draft.url ?? ''}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              size="small"
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' } }}
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>Prioritet</InputLabel>
                <Select
                  label="Prioritet"
                  value={draft.priority ?? 3}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                  sx={{ color: '#e2e8f0' }}
                >
                  {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>P{n}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel sx={{ color: 'rgba(148,163,184,0.85)' }}>Status</InputLabel>
                <Select
                  label="Status"
                  value={draft.status ?? 'planned'}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as string })}
                  sx={{ color: '#e2e8f0' }}
                >
                  {['planned', 'active', 'paused', 'won', 'lost'].map((s) => (
                    <MenuItem key={s} value={s}>{STATUS_TONES[s]?.label ?? s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'rgba(2,6,23,0.95)' }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: 'rgba(203,213,225,0.85)' }}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!draft.display_name?.trim()}
            onClick={handleAdd}
            sx={{ bgcolor: '#a78bfa', color: '#0b1120', '&:hover': { bgcolor: '#c4b5fd' } }}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function PresencePostsView() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/admin/community/posts', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data) => {
        if (!cancelled) setPosts(Array.isArray(data?.posts) ? data.posts : []);
      })
      .catch(() => { if (!cancelled) setPosts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>;

  return posts.length === 0 ? (
    <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
      Ingen posts ennå. Klikk "Generer utkast via Agent" på en kanal — eller opprett manuelt via API <code>/api/admin/community/posts</code>.
    </Alert>
  ) : (
    <Stack spacing={0.8}>
      {posts.map((p) => {
        const statusMeta = STATUS_TONES[p.status] ?? STATUS_TONES.draft;
        return (
          <Stack
            key={p.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            sx={{ p: 1.2, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.34)' }}
          >
            <Chip size="small" label={statusMeta.label} sx={{ bgcolor: statusMeta.bg, color: statusMeta.fg, fontWeight: 700, height: 22 }} />
            {p.ai_generated ? (
              <Chip size="small" label="AI" sx={{ bgcolor: 'rgba(167,139,250,0.16)', color: '#ddd6fe', fontWeight: 700, height: 22 }} />
            ) : null}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.title}
              </Typography>
              <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem' }}>
                {p.post_type} {p.scheduled_for ? `· planlagt ${new Date(p.scheduled_for).toLocaleDateString('nb-NO')}` : ''}
              </Typography>
            </Box>
            {p.published_url ? (
              <Button href={p.published_url} target="_blank" rel="noopener noreferrer" size="small" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={{ color: 'rgba(203,213,225,0.85)', textTransform: 'none', fontSize: '0.78rem' }}>
                Åpne
              </Button>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}

interface RedditMention {
  id: string;
  title: string;
  permalink: string;
  subreddit: string;
  author: string;
  created_at: string;
  score: number;
  num_comments: number;
  snippet?: string;
}

function PresenceRedditMentionsView() {
  const [query, setQuery] = useState('The Role Room');
  const [mentions, setMentions] = useState<RedditMention[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthMode, setOauthMode] = useState<'oauth' | 'public-json' | 'unknown'>('unknown');

  useEffect(() => {
    fetch('/api/admin/community/reddit/status', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOauthMode(d?.mode ?? 'unknown'))
      .catch(() => setOauthMode('unknown'));
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/community/reddit/mentions?q=${encodeURIComponent(query)}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMentions(Array.isArray(data?.mentions) ? data.mentions : []);
    } catch (err) {
      setError((err as Error).message);
      setMentions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.16)', bgcolor: 'rgba(2,6,23,0.34)' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Chip
            size="small"
            label={oauthMode === 'oauth' ? 'Reddit OAuth aktiv' : oauthMode === 'public-json' ? 'Public JSON (sett ENV for OAuth)' : 'Sjekker...'}
            sx={{
              bgcolor: oauthMode === 'oauth' ? 'rgba(34,197,94,0.16)' : 'rgba(249,115,22,0.16)',
              color: oauthMode === 'oauth' ? '#86efac' : '#fdba74',
              fontWeight: 700,
            }}
          />
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem' }}>
            Søker Reddit for nye mentions av The Role Room. Last 30 dager, nyeste først.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Søkeord (f.eks. The Role Room, StudioBinder alternative)"
            sx={{
              flex: 1,
              '& .MuiInputBase-root': { bgcolor: 'rgba(2,6,23,0.62)', color: '#e2e8f0' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            sx={{ bgcolor: '#a78bfa', color: '#0b1120', '&:hover': { bgcolor: '#c4b5fd' }, textTransform: 'none' }}
          >
            {loading ? 'Søker …' : 'Søk'}
          </Button>
        </Stack>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.10)', color: '#fca5a5' }}>
          {error}
        </Alert>
      ) : null}

      {mentions.length === 0 && !loading && !error ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
          Trykk "Søk" for å hente mentions. Hvis tomt: ingen Reddit-tråder nevner søkeordet siste 30 dager.
        </Alert>
      ) : null}

      {mentions.length > 0 ? (
        <Stack spacing={0.8}>
          {mentions.map((m) => (
            <Stack
              key={m.id}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'flex-start' }}
              sx={{ p: 1.2, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.34)' }}
            >
              <Chip size="small" label={m.subreddit} sx={{ bgcolor: 'rgba(255,69,0,0.16)', color: '#ff6a33', fontWeight: 700, height: 22 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem' }}>
                  {m.title}
                </Typography>
                <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem' }}>
                  /u/{m.author} · {new Date(m.created_at).toLocaleDateString('nb-NO')} · ↑ {m.score} · 💬 {m.num_comments}
                </Typography>
                {m.snippet ? (
                  <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem', mt: 0.5 }}>
                    {m.snippet}…
                  </Typography>
                ) : null}
              </Box>
              {m.permalink ? (
                <Button
                  href={m.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  sx={{ color: 'rgba(203,213,225,0.85)', textTransform: 'none', fontSize: '0.78rem' }}
                >
                  Åpne
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function PresenceContactsView() {
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/admin/community/contacts', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((data) => {
        if (!cancelled) setContacts(Array.isArray(data?.contacts) ? data.contacts : []);
      })
      .catch(() => { if (!cancelled) setContacts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>;

  return contacts.length === 0 ? (
    <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.08)' }}>
      Ingen outreach-kontakter ennå. Legg til journalister, community-managers og film-bloggere via API <code>POST /api/admin/community/contacts</code>.
    </Alert>
  ) : (
    <Stack spacing={0.8}>
      {contacts.map((c) => {
        const statusMeta = STATUS_TONES[c.status] ?? STATUS_TONES.not_contacted;
        return (
          <Stack
            key={c.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            sx={{ p: 1.2, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.34)' }}
          >
            <Chip
              label={`P${c.priority}`}
              size="small"
              sx={{
                bgcolor: c.priority === 1 ? 'rgba(239,68,68,0.16)' : 'rgba(148,163,184,0.16)',
                color: c.priority === 1 ? '#fca5a5' : '#cbd5e1',
                fontWeight: 700, height: 22,
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem' }}>
                {c.name}
              </Typography>
              <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.74rem' }}>
                {c.role ?? ''}{c.organization ? ` · ${c.organization}` : ''}{c.email ? ` · ${c.email}` : ''}
              </Typography>
            </Box>
            <Chip size="small" label={statusMeta.label} sx={{ bgcolor: statusMeta.bg, color: statusMeta.fg, fontWeight: 700, height: 22 }} />
          </Stack>
        );
      })}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────

export default function AdminRoom() {
  const [tab, setTab] = useState<AdminRoomTab>('dashboard');
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
  if (tab === 'dashboard') content = <DashboardTab onJumpToTab={setTab} />;
  else if (tab === 'funding') content = <FundingAppsTab />;
  else if (tab === 'investors') content = <InvestorContactsTab />;
  else if (tab === 'partners') content = <PartnerContactsTab />;
  else if (tab === 'business-plan') content = <BusinessPlanTab />;
  else if (tab === 'activity') content = <ActivityLogTab />;
  else if (tab === 'analytics') content = <AnalyticsTab />;
  else if (tab === 'cms') content = <CmsTab />;
  else if (tab === 'presence') content = <PresenceTab />;
  else if (tab === 'role-nav') content = <RoleNavConfigTab />;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, px: { xs: 1.5, md: 3 } }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <Stack spacing={2}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.4rem' } }}>
            Admin Room
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: { xs: '0.84rem', md: '0.92rem' } }}>
            Internt arbeidsrom for produkteier — IN-/EU-søknader, investor-pipeline og potensielle samarbeidspartnere.
            Ikke en del av det publiserte The Role Room-produktet.
          </Typography>
        </Box>
        <Tabs
          value={tab}
          onChange={(_event, next: AdminRoomTab) => setTab(next)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            borderBottom: '1px solid rgba(148,163,184,0.16)',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, color: 'rgba(226,232,240,0.78)', minHeight: 42 },
            '& .Mui-selected': { color: '#f8fafc' },
            '& .MuiTabs-indicator': { backgroundColor: '#a78bfa' },
          }}
        >
          <Tab value="dashboard" label="Oversikt" />
          <Tab value="business-plan" label="Forretningsplan" />
          <Tab value="funding" label="Søknader (IN/EU)" />
          <Tab value="investors" label="Investor-pipeline" />
          <Tab value="partners" label="Samarbeidspartnere" />
          <Tab value="activity" label="Aktivitets-logg" />
          <Tab value="analytics" label="Analytics" />
          <Tab value="cms" label="CMS" />
          <Tab value="presence" label="Presence" />
          <Tab value="role-nav" label="Rolle-navigasjon" />
        </Tabs>
        <Box>{content}</Box>
      </Stack>
    </Container>
  );
}
