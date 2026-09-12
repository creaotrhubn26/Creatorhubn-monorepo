/**
 * DeepLinkPicker.tsx — LTI Deep Linking-autorering (flaggskip).
 *
 * Vises når Canvas/Moodle launcher oss som en Deep Linking-forespørsel
 * (?deeplink=1): faglærer er midt i LMS-en og forfatter en FULL oppgave her —
 * produksjon (velg/opprett) + kull + Artefakt/Steg (view-targeting) + tittel +
 * brief + frist + læringsmål + arbeidskrav/eksamen/vurderingsform. Ved
 * «Publiser» sender vi det rike payloadet til deep-link-response (Task 6),
 * som oppretter en ekte `role_room_education_assignments`-rad og en signert
 * DeepLinkingResponse. Klienten auto-poster JWT-en til Canvas/Moodle
 * (`submitToCanvas`) — LMS-en overtar derfra (ingen egen suksess-skjerm).
 *
 * Design (BINDENDE): docs/superpowers/specs/2026-08-09-edu-artifact-ui-design.md
 * §2 «Flate B» + Impeccable-callouts (synlighets-tiers, sticky primærhandling,
 * dynamisk konsekvens-hint, tredelt feil-copy, motion gated bak
 * prefers-reduced-motion). Gjenbruker <ArtifactStegFields> (Task 3) — ingen
 * duplisert Artefakt/Steg-logikk.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Alert,
  TextField, MenuItem, Collapse, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  Assignment as AssignmentIcon, Send as SendIcon, KeyboardArrowDown as CaretIcon,
} from '@mui/icons-material';
import educationLtiService from './educationLtiService';
import { educationProductionsService, type Production } from './educationProductionsService';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { ArtifactStegFields, artifactLabel, stegLabel } from './ArtifactStegFields';
import { ACCENT } from './_eduUi';

const VURDERINGSFORM_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Ikke satt' },
  { key: 'bestatt', label: 'Bestått / ikke bestått' },
  { key: 'bokstav', label: 'Bokstavkarakter (A–F)' },
  { key: 'mappe', label: 'Mappevurdering' },
];

const ERROR_REASONS: Record<string, string> = {
  title_required: 'tittel mangler',
  cohort_required: 'kull mangler',
  cohort_not_found: 'valgt kull ble ikke funnet',
  production_required: 'produksjon mangler',
  production_not_found: 'valgt produksjon ble ikke funnet',
  not_a_deep_link_launch: 'denne økten støtter ikke publisering',
  not_found: 'økten ble ikke funnet',
};

/** Tredelt feilformel (Impeccable ux-writing.md): hva skjedde → tilstand →
 *  hva nå. `{årsak}` mappes til norsk der vi kjenner koden; ukjent → generisk. */
export function buildErrorMessage(code: string, lms: string | null): string {
  const reason = ERROR_REASONS[code] ?? 'en teknisk feil oppstod';
  return `Kunne ikke publisere: ${reason}. Ingenting ble lagt til i ${lms ?? 'LMS-en'}. Sjekk at produksjon og kull er valgt, og prøv igjen.`;
}

/** Utleder Canvas/Moodle fra launch-plattformens navn (LTI tool_platform-claim
 *  → `institution`), ellers nøytralt (ingen LMS-spesifikk copy). */
function deriveLms(institution: string | null): 'Canvas' | 'Moodle' | null {
  if (!institution) return null;
  const s = institution.toLowerCase();
  if (s.includes('canvas')) return 'Canvas';
  if (s.includes('moodle')) return 'Moodle';
  return null;
}

/** Dynamisk konsekvens-hint under primærknappen: faglærer ser hvor studenten
 *  lander FØR de sender (emil-design-eng). */
export function consequenceHint(artifactKind: string, artifactView: string): string {
  if (!artifactKind) return 'Studenten åpner produksjonen.';
  if (artifactKind === 'story-arc') {
    return artifactView ? `Studenten lander rett i ${stegLabel(artifactView)}.` : 'Studenten lander i Story Arc-studio.';
  }
  return `Studenten åpner ${artifactLabel(artifactKind)}.`;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function submitToCanvas(returnUrl: string, jwt: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = returnUrl;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'JWT';
  input.value = jwt;
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

interface FormState {
  productionId: string;
  cohortId: string;
  artifactKind: string;
  artifactView: string;
  title: string;
  brief: string;
  dueAt: string;
  learningGoals: string;
  isArbeidskrav: boolean;
  isExam: boolean;
  vurderingsform: string;
}
const EMPTY_FORM: FormState = {
  productionId: '', cohortId: '', artifactKind: '', artifactView: '',
  title: '', brief: '', dueAt: '', learningGoals: '',
  isArbeidskrav: false, isExam: false, vurderingsform: '',
};

export type DeepLinkPublishPayload = Parameters<typeof educationLtiService.deepLinkResponse>[1];

/** Rent bygg av POST-payloadet til deep-link-response — trukket ut av
 *  `publish()` for enkel enhetstesting av kontrakten (Task 6). `creatingProduction`
 *  slår av `productionId`/`projectId` til fordel for `createProduction: true`
 *  (backend gjenbruker oppgavens `title` som ny produksjons tittel). `projectId`
 *  holder gammel-sti-kompatibilitet (deep-link-response sin ikke-rike gren
 *  leser fortsatt `projectId`, ikke `productionId`). */
export function buildPublishPayload(f: FormState, creatingProduction: boolean, selectedProjectId?: string): DeepLinkPublishPayload {
  return {
    title: f.title.trim(),
    cohortId: f.cohortId || undefined,
    productionId: creatingProduction ? undefined : (f.productionId || undefined),
    projectId: creatingProduction ? undefined : selectedProjectId,
    createProduction: creatingProduction || undefined,
    artifactKind: f.artifactKind || undefined,
    artifactView: (f.artifactKind === 'story-arc' && f.artifactView) ? f.artifactView : undefined,
    brief: f.brief.trim() || undefined,
    learningGoals: f.learningGoals.trim() || undefined,
    dueAt: f.dueAt || undefined,
    isArbeidskrav: f.isArbeidskrav || undefined,
    isExam: f.isExam || undefined,
    vurderingsform: f.vurderingsform || undefined,
  };
}

/** Gate for primærknappen. Kull er PÅKREVD her — ikke bare valgfritt tier-2
 *  synlig, se §2.2/§2.4-spenningen: uten dette kan faglærer fylle ut
 *  tittel/brief/artefakt, glemme kull, og Publiser ville stille tatt backendens
 *  gamle sti (isRichPayload keyer på tittel der, men KREVER kull når tittel
 *  finnes — 400 cohort_required). Denne gaten forhindrer at faglærer i det
 *  hele tatt kommer dit (defense in depth, Task 7-review). */
export function canPublishForm(f: FormState, creatingProduction: boolean, publishing: boolean): boolean {
  const hasProduction = creatingProduction || !!f.productionId;
  return hasProduction && f.title.trim().length > 0 && !!f.cohortId && !publishing;
}

export function DeepLinkPicker() {
  const [launchId] = useState<string | null>(() => educationLtiService.getLaunchId());
  const [productions, setProductions] = useState<Production[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [lms, setLms] = useState<'Canvas' | 'Moodle' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const [creatingProduction, setCreatingProduction] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const autoOpenedRef = useRef(false);
  const reduceMotion = useMemo(prefersReducedMotion, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [prods, chs] = await Promise.all([
        educationProductionsService.listProductions(),
        educationCohortsService.listCohorts().catch(() => [] as Cohort[]),
      ]);
      setProductions(prods); setCohorts(chs);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente produksjoner'); }
    finally { setLoading(false); }
    if (launchId) {
      educationLtiService.getContext(launchId).then((ctx) => setLms(deriveLms(ctx.institution))).catch(() => {});
    }
  }, [launchId]);
  useEffect(() => { void load(); }, [load]);

  // Ingen produksjoner ennå → åpne «opprett ny» automatisk (én gang).
  useEffect(() => {
    if (!loading && productions.length === 0 && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setCreatingProduction(true);
    }
  }, [loading, productions.length]);

  // Krysstoning (blur+opacity) på konsekvens-hintet når valget endrer teksten
  // (emil blur-mask: samme element bytter tilstand, ikke et nytt kom til).
  const hintText = consequenceHint(f.artifactKind, f.artifactView);
  const [hintVisible, setHintVisible] = useState(true);
  const prevHint = useRef(hintText);
  useEffect(() => {
    if (prevHint.current === hintText) return;
    prevHint.current = hintText;
    if (reduceMotion) return;
    setHintVisible(false);
    const t = setTimeout(() => setHintVisible(true), 20);
    return () => clearTimeout(t);
  }, [hintText, reduceMotion]);

  const canPublish = canPublishForm(f, creatingProduction, publishing);

  const publish = async () => {
    if (!launchId) { setError('Mangler launch-kontekst. Last siden på nytt og prøv igjen.'); return; }
    if (!canPublish) return;
    setPublishing(true); setError(null);
    try {
      const selected = productions.find((p) => p.id === f.productionId);
      const payload = buildPublishPayload(f, creatingProduction, selected?.projectId);
      const { returnUrl, jwt } = await educationLtiService.deepLinkResponse(launchId, payload);
      submitToCanvas(returnUrl, jwt);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'deep_link_failed';
      setError(buildErrorMessage(code, lms));
      setPublishing(false);
    }
  };

  const fieldTouchSx = { '& .MuiInputBase-root': { minHeight: { xs: 44 } } };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff', p: { xs: 2, md: 4 }, display: 'grid', placeItems: 'start center' }}>
      <Box sx={{ width: '100%', maxWidth: 560 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AssignmentIcon /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{lms ? `Publiser oppgave til ${lms}` : 'Publiser oppgave'}</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>Oppretter oppgaven og legger en direkte lenke i emnet.</Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ my: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 2 }}>
            {/* 1. HVOR — produksjon + kull */}
            <Stack spacing={0.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  size="small" select label="Produksjon" value={f.productionId}
                  onChange={(e) => setField('productionId', e.target.value)}
                  disabled={creatingProduction}
                  helperText={productions.length === 0 ? 'Ingen produksjoner ennå. Opprett en for å starte.' : undefined}
                  fullWidth sx={fieldTouchSx}
                >
                  {productions.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
                </TextField>
                <TextField
                  size="small" select label="Kull" value={f.cohortId}
                  onChange={(e) => setField('cohortId', e.target.value)}
                  helperText={(!f.cohortId && f.title.trim()) ? 'Velg kull for å publisere oppgaven' : undefined}
                  sx={{ minWidth: { sm: 170 }, ...fieldTouchSx }}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
              </Stack>
              <Typography
                role="button" tabIndex={0}
                onClick={() => setCreatingProduction((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter') setCreatingProduction((v) => !v); }}
                sx={{ fontSize: 12.5, fontWeight: 600, color: ACCENT, cursor: 'pointer', py: 1, alignSelf: 'flex-start' }}
              >
                {creatingProduction ? '‹ Velg eksisterende produksjon' : '› Opprett ny produksjon'}
              </Typography>
              {creatingProduction && (
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', mt: -0.5 }}>Ny produksjon opprettes med tittelen under.</Typography>
              )}
            </Stack>

            {/* 2. HVA — artefakt-targeting (delt med AssignmentsTab) */}
            <ArtifactStegFields
              artifactKind={f.artifactKind}
              artifactView={f.artifactView}
              onArtifactKindChange={(v) => setField('artifactKind', v)}
              onArtifactViewChange={(v) => setField('artifactView', v)}
            />

            {/* 3. HVA studenten ser */}
            <TextField size="small" label="Tittel" value={f.title} onChange={(e) => setField('title', e.target.value)} fullWidth sx={fieldTouchSx} />
            <TextField size="small" label="Brief" value={f.brief} onChange={(e) => setField('brief', e.target.value)} multiline minRows={2} fullWidth />
            <TextField
              size="small" type="date" label="Frist" InputLabelProps={{ shrink: true }}
              value={f.dueAt} onChange={(e) => setField('dueAt', e.target.value)}
              sx={{ minWidth: 170, ...fieldTouchSx }}
            />

            {/* 4. AVANSERT — foldet (Impeccable ≤4 arbeidsminne: én gruppe) */}
            <Box>
              <Stack
                direction="row" alignItems="center" spacing={0.5}
                role="button" tabIndex={0} aria-label="Vis flere valg"
                onClick={() => setShowAdvanced((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter') setShowAdvanced((v) => !v); }}
                sx={{ cursor: 'pointer', color: ACCENT, py: 1, userSelect: 'none' }}
              >
                <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Flere valg (læringsmål, arbeidskrav, vurderingsform)</Typography>
                <CaretIcon sx={{ fontSize: 16, transition: reduceMotion ? 'none' : 'transform 200ms ease-out', transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </Stack>
              <Collapse in={showAdvanced} timeout={reduceMotion ? 0 : { enter: 220, exit: 160 }} easing="cubic-bezier(0.23,1,0.32,1)">
                <Stack spacing={1.5} sx={{ pt: 0.5, pb: 0.5 }}>
                  <TextField size="small" label="Læringsmål (kunnskap / ferdigheter / generell kompetanse)" value={f.learningGoals} onChange={(e) => setField('learningGoals', e.target.value)} fullWidth />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                    <TextField size="small" select label="Vurderingsform" value={f.vurderingsform} onChange={(e) => setField('vurderingsform', e.target.value)} sx={{ minWidth: 220 }}>
                      {VURDERINGSFORM_OPTIONS.map((o) => <MenuItem key={o.key || 'none'} value={o.key}>{o.label}</MenuItem>)}
                    </TextField>
                    <FormControlLabel
                      control={<Checkbox checked={f.isArbeidskrav} onChange={(e) => setField('isArbeidskrav', e.target.checked)} disabled={f.isExam} sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: '#f59e0b' } }} />}
                      label={<Typography sx={{ fontSize: 13 }}>Arbeidskrav (må godkjennes før eksamen)</Typography>}
                    />
                    <FormControlLabel
                      control={<Checkbox checked={f.isExam} onChange={(e) => setField('isExam', e.target.checked)} disabled={f.isArbeidskrav} sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: '#ec4899' } }} />}
                      label={<Typography sx={{ fontSize: 13 }}>Eksamen / sluttvurdering</Typography>}
                    />
                  </Stack>
                </Stack>
              </Collapse>
            </Box>

            {/* Sticky primærhandling — full bredde, gradient-scrim, safe-area */}
            <Box
              sx={{
                position: 'sticky', bottom: 0, pt: 2, mt: 1,
                pb: 'max(16px, env(safe-area-inset-bottom))',
                background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, #0a0a0a 40%)',
              }}
            >
              <Button
                fullWidth variant="contained"
                onClick={publish}
                disabled={!canPublish}
                endIcon={publishing ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
                sx={{
                  bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' },
                  '&:active': { transform: reduceMotion ? 'none' : 'scale(0.985)' },
                  transition: reduceMotion ? 'none' : 'transform 120ms ease-out',
                  textTransform: 'none', fontWeight: 700, borderRadius: 2, fontSize: 14.5, minHeight: 48,
                }}
              >
                {publishing ? 'Publiserer…' : (lms ? `Publiser til ${lms}` : 'Publiser oppgaven')}
              </Button>
              <Typography
                sx={{
                  textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.72)', mt: 1,
                  opacity: hintVisible ? 1 : 0,
                  filter: hintVisible ? 'blur(0px)' : 'blur(2px)',
                  transition: reduceMotion ? 'none' : 'opacity 150ms ease-out, filter 150ms ease-out',
                }}
              >
                {hintText}
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export default DeepLinkPicker;
