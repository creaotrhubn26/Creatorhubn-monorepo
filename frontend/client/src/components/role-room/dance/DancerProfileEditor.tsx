/**
 * DancerProfileEditor — full MUI Dialog for å redigere alle extras-felt
 * for en danser.
 *
 * Seksjoner:
 *   1. Grunninfo            — displayName, primaryStyle, heightCm
 *   2. Ferdigheter          — skill_levels per kategori (chips per nivå)
 *   3. Kropp                — body_measurements grid
 *   4. Tilgjengelighet      — windows-liste med add/remove
 *   5. Skadestatus          — radio + note
 *   6. Reel                 — URL-liste med add/remove + preview-link
 *   7. Notater              — fritekst
 *
 * Validering: zod-light. Save-knapp disabled hvis ingen endring eller
 * pågående lagring.
 */

import { danceFlowColors } from './danceFlowTheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  upsertDancerProfile,
  type DancerProfile,
  type DancerProfileExtras,
  type DancerAvailabilityWindow,
  type DanceStyle,
  type InjuryStatus,
  type SkillLevel,
} from './dancerProfileService';
import type { Dancer } from './formationTypes';

// ─── Konstanter ─────────────────────────────────────────────────────────

const DANCE_STYLES: DanceStyle[] = [
  'contemporary', 'ballet', 'jazz', 'commercial', 'hip-hop', 'folk', 'other',
];
const INJURY_STATUSES: InjuryStatus[] = ['healthy', 'rehab', 'cleared-with-restriction'];
const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'pro'];
const SKILL_CATEGORIES = [
  'turns', 'leaps', 'lifts', 'partnering', 'improv', 'musicality', 'floorwork',
] as const;

const SKILL_CATEGORY_LABEL_NB: Record<(typeof SKILL_CATEGORIES)[number], string> = {
  turns: 'Piruetter',
  leaps: 'Hopp',
  lifts: 'Lift',
  partnering: 'Partnering',
  improv: 'Improvisasjon',
  musicality: 'Musikalitet',
  floorwork: 'Gulvarbeid',
};

const SKILL_LEVEL_LABEL_NB: Record<SkillLevel, string> = {
  beginner: 'Nybegynner',
  intermediate: 'Mellomnivå',
  advanced: 'Avansert',
  pro: 'Pro',
};

const INJURY_LABEL_NB: Record<InjuryStatus, string> = {
  healthy: 'Frisk',
  rehab: 'Rehab',
  'cleared-with-restriction': 'Klarert m/ restriksjon',
};

// ─── Default form-state ────────────────────────────────────────────────

function emptyExtras(): DancerProfileExtras {
  return {
    displayName: null,
    heightCm: null,
    primaryStyle: null,
    strengths: [],
    availabilityWindows: [],
    injuryStatus: 'healthy',
    injuryNote: null,
    reelUrls: [],
    bodyMeasurements: {},
    skillLevels: {},
    notes: null,
    projectId: null,
  };
}

function fromProfile(p: DancerProfile | null): DancerProfileExtras {
  if (!p) return emptyExtras();
  return {
    displayName: p.displayName,
    heightCm: p.heightCm,
    primaryStyle: p.primaryStyle,
    strengths: [...p.strengths],
    availabilityWindows: p.availabilityWindows.map((w) => ({ ...w })),
    injuryStatus: p.injuryStatus,
    injuryNote: p.injuryNote,
    reelUrls: [...p.reelUrls],
    bodyMeasurements: { ...p.bodyMeasurements },
    skillLevels: { ...p.skillLevels },
    notes: p.notes,
    projectId: p.projectId,
  };
}

function deepEqual(a: DancerProfileExtras, b: DancerProfileExtras): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Props ──────────────────────────────────────────────────────────────

export interface DancerProfileEditorProps {
  open: boolean;
  dancer: Dancer;
  initialProfile: DancerProfile | null;
  /** Valgfri prosjekt-scoping ved oppretting. */
  projectId?: string | null;
  onClose: () => void;
  onSaved: (profile: DancerProfile) => void;
}

// ─── Komponent ──────────────────────────────────────────────────────────

export const DancerProfileEditor: React.FC<DancerProfileEditorProps> = ({
  open,
  dancer,
  initialProfile,
  projectId,
  onClose,
  onSaved,
}) => {
  const baseline = useMemo(() => fromProfile(initialProfile), [initialProfile]);
  const [form, setForm] = useState<DancerProfileExtras>(() => baseline);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form når dialog åpnes/initialProfile endres
  useEffect(() => {
    if (open) {
      setForm({ ...baseline, projectId: baseline.projectId ?? projectId ?? null });
      setStatus('idle');
      setErrorMsg(null);
    }
  }, [open, baseline, projectId]);

  const dirty = useMemo(() => !deepEqual(form, baseline), [form, baseline]);

  const update = useCallback(
    <K extends keyof DancerProfileExtras>(key: K, value: DancerProfileExtras[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  // ─── Validering ───────────────────────────────────
  const validationError = useMemo((): string | null => {
    if (form.heightCm != null && (form.heightCm < 50 || form.heightCm > 250)) {
      return 'Høyde må være mellom 50 og 250 cm';
    }
    for (const w of form.availabilityWindows) {
      if (Date.parse(w.from) > Date.parse(w.to)) {
        return 'Tilgjengelighet: "fra" må være før "til"';
      }
    }
    for (const url of form.reelUrls) {
      try { new URL(url); } catch {
        return `Ugyldig URL: ${url}`;
      }
    }
    const bm = form.bodyMeasurements;
    if (bm.inseamCm != null && (bm.inseamCm < 50 || bm.inseamCm > 150)) {
      return 'Innenbenslengde må være mellom 50 og 150 cm';
    }
    if (bm.weightKg != null && (bm.weightKg < 30 || bm.weightKg > 200)) {
      return 'Vekt må være mellom 30 og 200 kg';
    }
    return null;
  }, [form]);

  // ─── Save ─────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!dirty || status === 'saving' || validationError) return;
    setStatus('saving');
    setErrorMsg(null);
    try {
      const result = await upsertDancerProfile(dancer.id, form);
      setStatus('idle');
      onSaved(result);
      onClose();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Kunne ikke lagre');
    }
  }, [dirty, status, validationError, dancer.id, form, onSaved, onClose]);

  return (
    <Dialog
      open={open}
      onClose={status === 'saving' ? undefined : onClose}
      maxWidth="md"
      fullWidth
      data-testid="dancer-profile-editor"
      PaperProps={{
        sx: { bgcolor: danceFlowColors.bgBase, border: '1px solid #1e2536', color: danceFlowColors.textSecondary },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: '1px solid #1e2536',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 11, letterSpacing: 1.8, color: danceFlowColors.lavender, fontWeight: 700 }}>
            {initialProfile ? 'REDIGER PROFIL' : 'NY DANSERPROFIL'}
          </Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>
            {form.displayName || dancer.name}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          disabled={status === 'saving'}
          aria-label="Lukk"
          sx={{ color: danceFlowColors.textMuted }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          {/* ─── 1. Grunninfo ─────────────────────────── */}
          <Section title="Grunninfo">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                label="Visningsnavn"
                size="small"
                fullWidth
                placeholder={dancer.name}
                value={form.displayName ?? ''}
                onChange={(e) => update('displayName', e.target.value || null)}
                sx={fieldSx}
              />
              <TextField
                select
                label="Hoved-stil"
                size="small"
                fullWidth
                value={form.primaryStyle ?? ''}
                onChange={(e) =>
                  update('primaryStyle', (e.target.value || null) as DanceStyle | null)
                }
                sx={fieldSx}
              >
                <MenuItem value="">— Velg —</MenuItem>
                {DANCE_STYLES.map((s) => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Høyde (cm)"
                type="number"
                size="small"
                fullWidth
                value={form.heightCm ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  update('heightCm', v === '' ? null : Math.round(Number(v)));
                }}
                inputProps={{ min: 50, max: 250 }}
                sx={fieldSx}
              />
            </Stack>
          </Section>

          {/* ─── 2. Ferdigheter ───────────────────────── */}
          <Section title="Ferdigheter">
            <Stack spacing={0.75}>
              {SKILL_CATEGORIES.map((cat) => (
                <Stack
                  key={cat}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ flexWrap: 'wrap' }}
                  useFlexGap
                >
                  <Typography
                    sx={{ fontSize: 11, color: danceFlowColors.grayLight, minWidth: 110, fontWeight: 600 }}
                  >
                    {SKILL_CATEGORY_LABEL_NB[cat]}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {SKILL_LEVELS.map((lvl) => {
                      const active = form.skillLevels[cat] === lvl;
                      return (
                        <Chip
                          key={lvl}
                          size="small"
                          label={SKILL_LEVEL_LABEL_NB[lvl]}
                          onClick={() => {
                            const next = { ...form.skillLevels };
                            if (active) delete next[cat];
                            else next[cat] = lvl;
                            update('skillLevels', next);
                          }}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            cursor: 'pointer',
                            bgcolor: active ? 'rgba(34,211,238,0.2)' : danceFlowColors.borderStrong,
                            color: active ? '#67e8f9' : danceFlowColors.textMuted,
                            border: `1px solid ${active ? 'rgba(34,211,238,0.5)' : danceFlowColors.borderSoft}`,
                            fontWeight: active ? 700 : 500,
                          }}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Section>

          {/* ─── 3. Kropp ─────────────────────────────── */}
          <Section title="Kropp">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <BodyMeasurementField
                label="Innenbenslengde (cm)"
                value={form.bodyMeasurements.inseamCm}
                min={50}
                max={150}
                onChange={(v) =>
                  update('bodyMeasurements', { ...form.bodyMeasurements, inseamCm: v })
                }
              />
              <BodyMeasurementField
                label="Rekkevidde (cm)"
                value={form.bodyMeasurements.reachCm}
                min={100}
                max={250}
                onChange={(v) =>
                  update('bodyMeasurements', { ...form.bodyMeasurements, reachCm: v })
                }
              />
              <BodyMeasurementField
                label="Vekt (kg)"
                value={form.bodyMeasurements.weightKg}
                min={30}
                max={200}
                onChange={(v) =>
                  update('bodyMeasurements', { ...form.bodyMeasurements, weightKg: v })
                }
              />
              <BodyMeasurementField
                label="Skostørrelse"
                value={form.bodyMeasurements.shoeSize}
                min={20}
                max={60}
                step={0.5}
                allowFloat
                onChange={(v) =>
                  update('bodyMeasurements', { ...form.bodyMeasurements, shoeSize: v })
                }
              />
            </Stack>
          </Section>

          {/* ─── 4. Tilgjengelighet ───────────────────── */}
          <Section title="Tilgjengelighet">
            <Stack spacing={0.75}>
              {form.availabilityWindows.map((w, i) => (
                <Stack
                  key={i}
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  alignItems="center"
                >
                  <TextField
                    label="Fra"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={toLocalDt(w.from)}
                    onChange={(e) => {
                      const next = [...form.availabilityWindows];
                      next[i] = { ...next[i], from: fromLocalDt(e.target.value) };
                      update('availabilityWindows', next);
                    }}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Til"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={toLocalDt(w.to)}
                    onChange={(e) => {
                      const next = [...form.availabilityWindows];
                      next[i] = { ...next[i], to: fromLocalDt(e.target.value) };
                      update('availabilityWindows', next);
                    }}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Notat"
                    size="small"
                    fullWidth
                    value={w.note ?? ''}
                    onChange={(e) => {
                      const next = [...form.availabilityWindows];
                      next[i] = { ...next[i], note: e.target.value || undefined };
                      update('availabilityWindows', next);
                    }}
                    sx={fieldSx}
                  />
                  <IconButton
                    size="small"
                    aria-label="Fjern tilgjengelighet"
                    onClick={() => {
                      update(
                        'availabilityWindows',
                        form.availabilityWindows.filter((_, j) => j !== i),
                      );
                    }}
                    sx={{ color: danceFlowColors.textMuted, '&:hover': { color: danceFlowColors.errorPrimary } }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => {
                  const now = new Date();
                  const later = new Date(now.getTime() + 4 * 60 * 60 * 1000);
                  update('availabilityWindows', [
                    ...form.availabilityWindows,
                    {
                      from: now.toISOString(),
                      to: later.toISOString(),
                    } satisfies DancerAvailabilityWindow,
                  ]);
                }}
                sx={addBtnSx}
                data-testid="dancer-profile-add-availability"
              >
                Legg til tilgjengelighets-vindu
              </Button>
            </Stack>
          </Section>

          {/* ─── 5. Skadestatus ──────────────────────── */}
          <Section title="Skadestatus">
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {INJURY_STATUSES.map((s) => {
                  const active = form.injuryStatus === s;
                  return (
                    <Chip
                      key={s}
                      size="small"
                      label={INJURY_LABEL_NB[s]}
                      onClick={() => update('injuryStatus', s)}
                      sx={{
                        height: 22,
                        fontSize: 10,
                        cursor: 'pointer',
                        bgcolor: active ? 'rgba(248,113,113,0.18)' : danceFlowColors.borderStrong,
                        color: active ? danceFlowColors.errorSoft : danceFlowColors.textMuted,
                        border: `1px solid ${active ? 'rgba(248,113,113,0.5)' : danceFlowColors.borderSoft}`,
                        fontWeight: active ? 700 : 500,
                      }}
                    />
                  );
                })}
              </Stack>
              <TextField
                label="Notat (valgfri)"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={form.injuryNote ?? ''}
                onChange={(e) => update('injuryNote', e.target.value || null)}
                sx={fieldSx}
              />
            </Stack>
          </Section>

          {/* ─── 6. Reel ──────────────────────────────── */}
          <Section title="Reel-URLer">
            <Stack spacing={0.75}>
              {form.reelUrls.map((url, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="https://vimeo.com/..."
                    value={url}
                    onChange={(e) => {
                      const next = [...form.reelUrls];
                      next[i] = e.target.value;
                      update('reelUrls', next);
                    }}
                    sx={fieldSx}
                  />
                  {url && (
                    <Tooltip title="Åpne i ny fane">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => window.open(url, '_blank', 'noopener')}
                          sx={{ color: danceFlowColors.lavender }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <IconButton
                    size="small"
                    aria-label="Fjern reel"
                    onClick={() => update('reelUrls', form.reelUrls.filter((_, j) => j !== i))}
                    sx={{ color: danceFlowColors.textMuted, '&:hover': { color: danceFlowColors.errorPrimary } }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => update('reelUrls', [...form.reelUrls, ''])}
                sx={addBtnSx}
                data-testid="dancer-profile-add-reel"
              >
                Legg til reel-URL
              </Button>
            </Stack>
          </Section>

          {/* ─── 7. Notater ──────────────────────────── */}
          <Section title="Notater">
            <TextField
              size="small"
              fullWidth
              multiline
              rows={3}
              placeholder="Private notater om danseren — ikke synlig for danseren selv."
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value || null)}
              sx={fieldSx}
            />
          </Section>
        </Stack>
      </DialogContent>

      <Divider sx={{ borderColor: danceFlowColors.borderStrong }} />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {validationError && (
          <Typography sx={{ fontSize: 11, color: danceFlowColors.errorSoft, mr: 'auto' }}>
            {validationError}
          </Typography>
        )}
        {errorMsg && (
          <Typography sx={{ fontSize: 11, color: danceFlowColors.errorSoft, mr: 'auto' }}>
            {errorMsg}
          </Typography>
        )}
        <Button
          onClick={onClose}
          disabled={status === 'saving'}
          sx={{ textTransform: 'none', color: danceFlowColors.textMuted }}
        >
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!dirty || status === 'saving' || validationError != null}
          data-testid="dancer-profile-save"
          sx={{
            textTransform: 'none',
            bgcolor: danceFlowColors.lavenderDark,
            '&:hover': { bgcolor: danceFlowColors.lavenderDeep },
            '&.Mui-disabled': { bgcolor: danceFlowColors.borderStrong, color: danceFlowColors.textDisabled },
          }}
        >
          {status === 'saving' ? 'Lagrer…' : 'Lagre profil'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Sub-komponenter ─────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title, children,
}) => (
  <Box>
    <Typography
      sx={{
        fontSize: 9,
        letterSpacing: 1.8,
        color: danceFlowColors.textDisabled,
        fontWeight: 700,
        textTransform: 'uppercase',
        mb: 0.75,
      }}
    >
      {title}
    </Typography>
    <Box sx={{ pl: 0 }}>{children}</Box>
  </Box>
);

interface BodyMeasurementFieldProps {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  allowFloat?: boolean;
  onChange: (v: number | undefined) => void;
}

const BodyMeasurementField: React.FC<BodyMeasurementFieldProps> = ({
  label, value, min, max, step, allowFloat, onChange,
}) => (
  <TextField
    label={label}
    type="number"
    size="small"
    fullWidth
    value={value ?? ''}
    onChange={(e) => {
      const v = e.target.value;
      if (v === '') {
        onChange(undefined);
      } else {
        const n = Number(v);
        if (Number.isFinite(n)) onChange(allowFloat ? n : Math.round(n));
      }
    }}
    inputProps={{ min, max, step: step ?? 1 }}
    sx={fieldSx}
  />
);

// ─── Hjelpefunksjoner for datetime-local ─────────────────────────────────

function toLocalDt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDt(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

// ─── Styles ──────────────────────────────────────────────────────────────

const fieldSx = {
  '& .MuiInputLabel-root': { color: danceFlowColors.textMuted, fontSize: 11 },
  '& .MuiInputBase-input': { color: danceFlowColors.textSecondary, fontSize: 12 },
  '& .MuiOutlinedInput-root': {
    bgcolor: danceFlowColors.bgPanel,
    '& fieldset': { borderColor: danceFlowColors.borderStrong },
    '&:hover fieldset': { borderColor: danceFlowColors.grayDark },
    '&.Mui-focused fieldset': { borderColor: danceFlowColors.lavenderDark },
  },
} as const;

const addBtnSx = {
  textTransform: 'none' as const,
  fontSize: 11,
  color: danceFlowColors.lavenderLight,
  borderColor: 'rgba(139,92,246,0.4)',
  alignSelf: 'flex-start' as const,
};

export default DancerProfileEditor;
