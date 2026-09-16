/**
 * CvPage.tsx — skuespiller-CV-en.
 *
 * Bygget etter mockupen: krediteringene gruppert som Film & TV, Teater,
 * Reklame og Stemme, med rolle, produksjon, regissør og år på hver linje.
 *
 * Feltene er bevisst skuespiller-språk, ikke jobbsøker-språk: «rolle» og
 * «produksjon», ikke «stilling» og «arbeidsgiver». Produksjon, selskap og
 * regissør har autocomplete mot krediteringer som allerede finnes i
 * registeret, slik at «Nationaltheatret» blir én verdi og ikke sju
 * stavemåter — ellers er feltet verdiløst å filtrere på for byråene.
 */

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import TheaterComedyOutlinedIcon from '@mui/icons-material/TheaterComedyOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type TalentCredit,
  type TalentCreditCategory,
  type TalentCreditDraft,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';
import CvImportDialog from '../components/CvImportDialog';

interface CvPageProps {
  demoMode: boolean;
}

const SECTIONS: Array<{
  id: TalentCreditCategory;
  label: string;
  Icon: React.ComponentType<{ sx?: object }>;
  hint: string;
}> = [
  { id: 'film_tv', label: 'Film & TV', Icon: MovieOutlinedIcon, hint: 'Spillefilm, serie, kortfilm' },
  { id: 'theatre', label: 'Teater', Icon: TheaterComedyOutlinedIcon, hint: 'Scene, turné, oppsetning' },
  { id: 'commercial', label: 'Reklame', Icon: CampaignOutlinedIcon, hint: 'Reklamefilm, kampanje' },
  { id: 'voice', label: 'Stemme', Icon: MicNoneOutlinedIcon, hint: 'Dubbing, voiceover, lydbok' },
];

const ROLE_TYPES = [
  { id: 'lead', label: 'Hovedrolle' },
  { id: 'supporting', label: 'Birolle' },
  { id: 'featured', label: 'Medvirkende' },
  { id: 'ensemble', label: 'Ensemble' },
  { id: 'voice', label: 'Stemme' },
  { id: 'extra', label: 'Statist' },
];

const roleTypeLabel = (id: string | null) =>
  ROLE_TYPES.find((r) => r.id === id)?.label ?? null;

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: palette.textPrimary,
    bgcolor: palette.bgCardElevated,
    '& fieldset': { borderColor: palette.border },
  },
  '& .MuiInputLabel-root': { color: palette.textMuted },
  '& .MuiSvgIcon-root': { color: palette.textMuted },
};

const emptyDraft = (category: TalentCreditCategory): TalentCreditDraft => ({
  category,
  title: '',
  role_name: '',
  role_type: null,
  production_company: '',
  director: '',
  year: null,
});

/** Tekstfelt med forslag fra krediteringer som allerede finnes i registeret. */
function SuggestField({
  label,
  field,
  value,
  onChange,
  demoMode,
}: {
  label: string;
  field: 'title' | 'production_company' | 'director';
  value: string;
  onChange: (next: string) => void;
  demoMode: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    if (demoMode || value.trim().length < 2) {
      setOptions([]);
      return;
    }
    let live = true;
    // Debounce: hvert tastetrykk skal ikke bli en spørring.
    const timer = window.setTimeout(() => {
      void roleRoomTalentsService.suggestCreditValues(field, value).then((next) => {
        if (live) setOptions(next);
      });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [demoMode, field, value]);

  return (
    <Autocomplete
      freeSolo
      options={options}
      inputValue={value}
      onInputChange={(_, next) => onChange(next)}
      renderInput={(params) => <TextField {...params} label={label} fullWidth sx={fieldSx} />}
    />
  );
}

function CreditRow({
  credit,
  onEdit,
  onDelete,
}: {
  credit: TalentCredit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = [credit.production_company, credit.director ? `regi: ${credit.director}` : null]
    .filter(Boolean)
    .join(' · ');
  const role = [credit.role_name, roleTypeLabel(credit.role_type)].filter(Boolean).join(' — ');

  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="flex-start"
      sx={{
        py: 1.4,
        borderBottom: `1px solid ${palette.borderSubtle}`,
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.98rem' }}>
          {credit.title}
        </Typography>
        {meta && (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mt: 0.2 }}>{meta}</Typography>
        )}
        {role && (
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.85rem', mt: 0.2 }}>{role}</Typography>
        )}
      </Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', pt: 0.3, flexShrink: 0 }}>
        {credit.year ?? ''}
      </Typography>
      <Stack direction="row" spacing={0.4} sx={{ flexShrink: 0 }}>
        <IconButton size="small" onClick={onEdit} aria-label={`Rediger ${credit.title}`} sx={{ color: palette.textMuted }}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onDelete} aria-label={`Slett ${credit.title}`} sx={{ color: palette.textMuted }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

export default function CvPage({ demoMode }: CvPageProps) {
  const [credits, setCredits] = useState<TalentCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: TalentCreditDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCredits(demoMode ? [] : await roleRoomTalentsService.fetchMyCredits());
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => { void reload(); }, [reload]);

  const byCategory = useMemo(() => {
    const map = new Map<TalentCreditCategory, TalentCredit[]>();
    for (const section of SECTIONS) map.set(section.id, []);
    for (const credit of credits) {
      const list = map.get(credit.category) ?? map.get('film_tv')!;
      list.push(credit);
    }
    return map;
  }, [credits]);

  const save = useCallback(async () => {
    if (!editing) return;
    const draft = editing.draft;
    if (!draft.title?.trim()) {
      setError('Produksjonen må ha en tittel.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: TalentCreditDraft = {
      ...draft,
      title: draft.title.trim(),
      year: draft.year ? Number(draft.year) : null,
    };
    const result = editing.id
      ? await roleRoomTalentsService.updateCredit(editing.id, payload)
      : await roleRoomTalentsService.createCredit(payload);
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setEditing(null);
    void reload();
  }, [editing, reload]);

  const remove = useCallback(async (credit: TalentCredit) => {
    // Bevisst ingen window.confirm: en kreditering er lett å legge inn igjen,
    // og en blokkerende dialog per rad er verre enn tapet.
    setCredits((prev) => prev.filter((c) => c.id !== credit.id));
    const result = await roleRoomTalentsService.deleteCredit(credit.id);
    if (!result.ok) {
      setError(result.error ?? 'Klarte ikke å slette');
      void reload();
    }
  }, [reload]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Laster CV…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2.6 }}>
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary }}>CV</Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem', mt: 0.5 }}>
            Rollene dine, gruppert slik casting leser dem. Byråer ser CV-en kun hvis du har delt profilen.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Chip
            label={`${credits.length} krediteringer`}
            sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accentBright, fontWeight: 600 }}
          />
          <Button
            startIcon={<UploadFileIcon />}
            disabled={demoMode}
            onClick={() => setImportOpen(true)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              px: 2,
              borderRadius: radius.sm,
              background: palette.accentGradient,
              color: '#fff',
            }}
          >
            Importer CV
          </Button>
        </Stack>
      </Stack>

      {demoMode && (
        <Alert severity="info" sx={{ mb: 2.4, bgcolor: 'rgba(168,85,247,0.12)', color: palette.textPrimary }}>
          Demo-modus viser ingen krediteringer. Logg inn for å bygge din egen CV.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2.4 }}>{error}</Alert>}

      <Stack spacing={2.2}>
        {SECTIONS.map((section) => {
          const rows = byCategory.get(section.id) ?? [];
          const Icon = section.Icon;
          return (
            <Box key={section.id} sx={cardSx}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: rows.length ? 1 : 0.4 }}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Icon sx={{ color: palette.accentBright, fontSize: 20 }} />
                  <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>
                    {section.label}
                  </Typography>
                  {rows.length > 0 && (
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>({rows.length})</Typography>
                  )}
                </Stack>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={demoMode}
                  onClick={() => setEditing({ id: null, draft: emptyDraft(section.id) })}
                  sx={{ textTransform: 'none', color: palette.accentBright }}
                >
                  Legg til
                </Button>
              </Stack>

              {rows.length === 0 ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
                  Ingen ennå — {section.hint.toLowerCase()}.
                  {credits.length === 0 && section.id === 'film_tv' ? (
                    <> Har du CV-en som fil, er <strong>Importer CV</strong> raskeste vei.</>
                  ) : null}
                </Typography>
              ) : (
                rows.map((credit) => (
                  <CreditRow
                    key={credit.id}
                    credit={credit}
                    onEdit={() => setEditing({ id: credit.id, draft: { ...credit } })}
                    onDelete={() => void remove(credit)}
                  />
                ))
              )}
            </Box>
          );
        })}
      </Stack>

      <CvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void reload()}
      />

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg } }}
      >
        <DialogTitle sx={{ color: palette.textPrimary, fontWeight: 800 }}>
          {editing?.id ? 'Rediger kreditering' : 'Ny kreditering'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              select
              label="Kategori"
              value={editing?.draft.category ?? 'film_tv'}
              onChange={(e) =>
                setEditing((prev) =>
                  prev ? { ...prev, draft: { ...prev.draft, category: e.target.value as TalentCreditCategory } } : prev,
                )
              }
              fullWidth
              sx={fieldSx}
            >
              {SECTIONS.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>
              ))}
            </TextField>

            <SuggestField
              label="Produksjon"
              field="title"
              demoMode={demoMode}
              value={editing?.draft.title ?? ''}
              onChange={(next) =>
                setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, title: next } } : prev))
              }
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Rolle"
                value={editing?.draft.role_name ?? ''}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, role_name: e.target.value } } : prev))
                }
                fullWidth
                sx={fieldSx}
              />
              <TextField
                select
                label="Rolletype"
                value={editing?.draft.role_type ?? ''}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, role_type: e.target.value || null } } : prev))
                }
                fullWidth
                sx={fieldSx}
              >
                <MenuItem value="">Ikke satt</MenuItem>
                {ROLE_TYPES.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <SuggestField
              label="Produksjonsselskap / teater"
              field="production_company"
              demoMode={demoMode}
              value={editing?.draft.production_company ?? ''}
              onChange={(next) =>
                setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, production_company: next } } : prev))
              }
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box sx={{ flex: 2 }}>
                <SuggestField
                  label="Regissør"
                  field="director"
                  demoMode={demoMode}
                  value={editing?.draft.director ?? ''}
                  onChange={(next) =>
                    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, director: next } } : prev))
                  }
                />
              </Box>
              <TextField
                label="År"
                type="number"
                value={editing?.draft.year ?? ''}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, draft: { ...prev.draft, year: e.target.value ? Number(e.target.value) : null } } : prev,
                  )
                }
                sx={{ ...fieldSx, flex: 1 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4 }}>
          <Button onClick={() => setEditing(null)} sx={{ textTransform: 'none', color: palette.textMuted }}>
            Avbryt
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !editing?.draft.title?.trim()}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              px: 2.6,
              background: palette.accentGradient,
              color: '#fff',
            }}
          >
            {saving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
