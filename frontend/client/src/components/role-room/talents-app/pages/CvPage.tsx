/**
 * CvPage.tsx — skuespiller-CV-en.
 *
 * Krediteringene gruppert som Film & TV, Teater, Reklame og Stemme, med
 * rolle, produksjon, regissør og år på hver linje.
 *
 * Feltene er bevisst skuespiller-språk, ikke jobbsøker-språk: «rolle» og
 * «produksjon», ikke «stilling» og «arbeidsgiver». Produksjon, selskap og
 * regissør har autocomplete mot krediteringer som allerede finnes i
 * registeret, slik at «Nationaltheatret» blir én verdi og ikke sju
 * stavemåter — ellers er feltet verdiløst å filtrere på for byråene.
 *
 * Fire ting styrer utformingen her:
 *
 *   Forhåndsvisning er et panel du slår på. En CV er et dokument som skal ut
 *   av systemet, så du må kunne se det du lager — men ikke på bekostning av
 *   en tredjedel av bredden hele tiden.
 *
 *   Tomtilstanden er designet, ikke arvet. Den ferske skuespilleren møter to
 *   veier videre, ikke fire tomme kort.
 *
 *   Sletting kan angres i stedet for å spørre først. Kallet til serveren
 *   utsettes i seks sekunder, så «angre» faktisk ikke sletter noe.
 *
 *   Lagringsstatus er en tilstand som endrer seg. En hake som alltid står
 *   der forteller ingenting.
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
  FormControlLabel,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import roleRoomTalentsService, {
  type RoleRoomTalent,
  type TalentCredit,
  type TalentCreditCategory,
  type TalentCreditDraft,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';
import CvImportDialog from '../components/CvImportDialog';
import CvDocument, { printCvDocument } from '../components/CvDocument';

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

/** Et årstall skal være et årstall. Grensene fanger «202» og «20233». */
const YEAR_MIN = 1930;
const YEAR_MAX = new Date().getFullYear() + 3;

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

/** Lagringsstatus. Endrer seg, ellers er den bare pynt som ser ut som trygghet. */
type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'failed' };

function SaveIndicator({ state }: { state: SaveState }) {
  if (state.kind === 'idle') return null;
  const text =
    state.kind === 'saving' ? 'Lagrer…'
      : state.kind === 'saved' ? `Lagret ${state.at.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
        : 'Ikke lagret — prøv igjen';
  const color =
    state.kind === 'saving' ? palette.warning : state.kind === 'saved' ? palette.success : palette.danger;

  return (
    <Typography sx={{ fontSize: '0.78rem', color, whiteSpace: 'nowrap' }} aria-live="polite">
      {text}
    </Typography>
  );
}

function CreditRow({
  credit,
  onEdit,
  onDelete,
  dragging,
  over,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  credit: TalentCredit;
  onEdit: () => void;
  onDelete: () => void;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const meta = [credit.production_company, credit.director ? `regi: ${credit.director}` : null]
    .filter(Boolean)
    .join(' · ');
  const role = [credit.role_name, roleTypeLabel(credit.role_type)].filter(Boolean).join(' — ');

  return (
    <Stack
      direction="row"
      spacing={1.6}
      alignItems="flex-start"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      sx={{
        py: 1.4,
        opacity: dragging ? 0.45 : 1,
        // Linjen viser hvor raden lander. Uten den drar man i blinde.
        boxShadow: over ? `inset 0 2px 0 ${palette.accentBright}` : 'none',
        borderBottom: `1px solid ${palette.borderSubtle}`,
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box
        sx={{ cursor: 'grab', color: palette.textMuted, pt: 0.4, '&:hover': { color: palette.accentBright } }}
        aria-hidden
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
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
      {/* Rediger og slett ligger ikke inntil hverandre: bomtrykket er billig
          å unngå her, og dyrt å oppdage etterpå. */}
      <Stack direction="row" spacing={1.4} sx={{ flexShrink: 0 }}>
        <IconButton size="small" onClick={onEdit} aria-label={`Rediger ${credit.title}`} sx={{ color: palette.textMuted }}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={onDelete}
          aria-label={`Slett ${credit.title}`}
          sx={{ color: palette.textMuted, '&:hover': { color: palette.danger } }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

export default function CvPage({ demoMode }: CvPageProps) {
  const [credits, setCredits] = useState<TalentCredit[]>([]);
  const [talent, setTalent] = useState<RoleRoomTalent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: TalentCreditDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [includeContact, setIncludeContact] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [undoItem, setUndoItem] = useState<{ credit: TalentCredit; index: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const documentRef = useRef<HTMLDivElement>(null);
  /** Slettinger som ennå ikke er sendt til serveren, per id. */
  const pendingDeletes = useRef(new Map<string, number>());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (demoMode) {
        setCredits([]);
        setTalent(null);
        return;
      }
      const [nextCredits, nextTalent] = await Promise.all([
        roleRoomTalentsService.fetchMyCredits(),
        roleRoomTalentsService.fetchMyTalent(),
      ]);
      setCredits(nextCredits);
      setTalent(nextTalent);
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => { void reload(); }, [reload]);

  // Forlater du siden med en usendt sletting, skal den fortsatt skje. Ellers
  // ville raden komme tilbake ved neste besøk, uten at noen ba om det.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      for (const [id, timer] of pending) {
        window.clearTimeout(timer);
        void roleRoomTalentsService.deleteCredit(id);
      }
      pending.clear();
    };
  }, []);

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
      setSaveState({ kind: 'failed' });
      return;
    }
    setEditing(null);
    setSaveState({ kind: 'saved', at: new Date() });
    void reload();
  }, [editing, reload]);

  /** Sender hele rekkefølgen. Serveren trenger ikke vite hva som ble flyttet. */
  const persistOrder = useCallback(async (next: TalentCredit[]) => {
    setSaveState({ kind: 'saving' });
    const result = await roleRoomTalentsService.reorderCredits(next.map((c) => c.id));
    if (!result.ok) {
      setSaveState({ kind: 'failed' });
      setError(result.error ?? 'Klarte ikke å lagre rekkefølgen');
      void reload();
      return;
    }
    setSaveState({ kind: 'saved', at: new Date() });
  }, [reload]);

  const handleDrop = useCallback((targetId: string) => {
    setOverId(null);
    if (!dragId || dragId === targetId) return;

    // Rekkefølgen regnes ut utenfor setCredits: en oppdateringsfunksjon som
    // sender et nettverkskall er ikke ren, og React kaller den gjerne to
    // ganger — da ville hver flytting blitt lagret dobbelt.
    const from = credits.findIndex((c) => c.id === dragId);
    const to = credits.findIndex((c) => c.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;

    const next = [...credits];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setCredits(next);
    void persistOrder(next);
  }, [credits, dragId, persistOrder]);

  /**
   * Sletting skjer i grensesnittet med én gang, men kallet til serveren
   * utsettes i seks sekunder. Da er «angre» virkelig en angring og ikke en
   * ny rad med ny id.
   */
  const remove = useCallback((credit: TalentCredit) => {
    const index = credits.findIndex((c) => c.id === credit.id);
    setCredits((prev) => prev.filter((c) => c.id !== credit.id));
    setUndoItem({ credit, index: Math.max(index, 0) });

    const timer = window.setTimeout(() => {
      pendingDeletes.current.delete(credit.id);
      setSaveState({ kind: 'saving' });
      void roleRoomTalentsService.deleteCredit(credit.id).then((result) => {
        if (result.ok) {
          setSaveState({ kind: 'saved', at: new Date() });
        } else {
          setSaveState({ kind: 'failed' });
          setError(result.error ?? 'Klarte ikke å slette');
          void reload();
        }
      });
    }, 6000);

    pendingDeletes.current.set(credit.id, timer);
  }, [credits, reload]);

  const undoRemove = useCallback(() => {
    if (!undoItem) return;
    const timer = pendingDeletes.current.get(undoItem.credit.id);
    if (timer) window.clearTimeout(timer);
    pendingDeletes.current.delete(undoItem.credit.id);
    setCredits((prev) => {
      const next = [...prev];
      next.splice(Math.min(undoItem.index, next.length), 0, undoItem.credit);
      return next;
    });
    setUndoItem(null);
  }, [undoItem]);

  const downloadPdf = useCallback(() => {
    // Forhåndsvisningen må være åpen for at noden skal finnes — den ER det
    // som skrives ut.
    if (!showPreview) {
      setShowPreview(true);
      window.setTimeout(() => {
        if (!printCvDocument(documentRef.current, talent?.display_name ?? 'CV')) {
          setError('Nettleseren blokkerte utskriftsvinduet. Tillat popup for denne siden.');
        }
      }, 120);
      return;
    }
    if (!printCvDocument(documentRef.current, talent?.display_name ?? 'CV')) {
      setError('Nettleseren blokkerte utskriftsvinduet. Tillat popup for denne siden.');
    }
  }, [showPreview, talent]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Laster CV…</Typography>
      </Box>
    );
  }

  const isEmpty = credits.length === 0;

  return (
    <Box sx={{ p: 3, maxWidth: showPreview ? 1360 : 1080, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-start' }}
        spacing={1.6}
        sx={{ mb: 2.6 }}
      >
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary }}>CV</Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem', mt: 0.5, maxWidth: '46ch' }}>
            Rollene dine, gruppert slik casting leser dem. Byråer ser CV-en kun hvis du har delt profilen.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SaveIndicator state={saveState} />
          {!isEmpty && (
            <Chip
              label={`${credits.length} krediteringer`}
              sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accentBright, fontWeight: 600 }}
            />
          )}
          <Button
            startIcon={showPreview ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
            onClick={() => setShowPreview((open) => !open)}
            sx={{ textTransform: 'none', fontWeight: 600, color: palette.textSecondary, borderRadius: radius.sm }}
          >
            {showPreview ? 'Skjul' : 'Forhåndsvis'}
          </Button>
          <Button
            startIcon={<PictureAsPdfOutlinedIcon />}
            disabled={demoMode}
            onClick={downloadPdf}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: palette.textSecondary,
              border: `1px solid ${palette.border}`,
              borderRadius: radius.sm,
              px: 1.6,
            }}
          >
            Last ned PDF
          </Button>
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
      {error && <Alert severity="error" sx={{ mb: 2.4 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box
        sx={{
          display: 'grid',
          gap: 2.6,
          alignItems: 'start',
          gridTemplateColumns: showPreview ? { xs: '1fr', lg: 'minmax(0, 1fr) 380px' } : '1fr',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {isEmpty ? (
            /* Tomtilstanden er den som avgjør om noen fullfører. Den får være
               ett tydelig valg, ikke fire tomme kort med «Ingen ennå». */
            <Box
              sx={{
                ...cardSx,
                textAlign: 'center',
                py: 5,
                borderStyle: 'dashed',
                borderColor: palette.borderStrong,
              }}
            >
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.24rem' }}>
                Ingen krediteringer ennå
              </Typography>
              <Typography
                sx={{ color: palette.textMuted, fontSize: '0.92rem', mt: 1, mx: 'auto', maxWidth: '44ch', lineHeight: 1.6 }}
              >
                Har du CV-en som PDF eller Word, leser vi den og fyller inn feltene. Du ser forslaget
                og godkjenner hver linje før noe lagres.
              </Typography>
              <Stack direction="row" spacing={1.4} justifyContent="center" sx={{ mt: 2.6 }} flexWrap="wrap" useFlexGap>
                <Button
                  startIcon={<UploadFileIcon />}
                  disabled={demoMode}
                  onClick={() => setImportOpen(true)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.4,
                    borderRadius: radius.sm,
                    background: palette.accentGradient,
                    color: '#fff',
                  }}
                >
                  Importer CV (PDF eller Word)
                </Button>
                <Button
                  startIcon={<AddIcon />}
                  disabled={demoMode}
                  onClick={() => setEditing({ id: null, draft: emptyDraft('film_tv') })}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2.4,
                    borderRadius: radius.sm,
                    color: palette.textSecondary,
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  Legg til første rolle
                </Button>
              </Stack>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem', mt: 2 }}>
                Filen sendes ikke videre til noen, og slettes etter at forslaget er laget.
              </Typography>
            </Box>
          ) : (
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
                      </Typography>
                    ) : (
                      rows.map((credit) => (
                        <CreditRow
                          key={credit.id}
                          credit={credit}
                          dragging={dragId === credit.id}
                          over={overId === credit.id && dragId !== credit.id}
                          onDragStart={() => setDragId(credit.id)}
                          onDragOver={() => setOverId(credit.id)}
                          onDrop={() => handleDrop(credit.id)}
                          onDragEnd={() => { setDragId(null); setOverId(null); }}
                          onEdit={() => setEditing({ id: credit.id, draft: { ...credit } })}
                          onDelete={() => remove(credit)}
                        />
                      ))
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        {showPreview && (
          <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 }, minWidth: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
              <Typography
                sx={{ color: palette.textMuted, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}
              >
                Slik ser den ut
              </Typography>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={includeContact}
                  onChange={(e) => setIncludeContact(e.target.checked)}
                />
              }
              label={
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem' }}>
                  Ta med kontaktinfo i PDF-en
                </Typography>
              }
              sx={{ mb: 1.2, ml: 0 }}
            />

            <CvDocument ref={documentRef} talent={talent} credits={credits} includeContact={includeContact} />

            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 1.4, lineHeight: 1.55 }}>
              En PDF sirkulerer videre til folk du aldri ga den til. Uten kontaktinfo kan byrået
              fortsatt nå deg gjennom The Role Room.
            </Typography>
          </Box>
        )}
      </Box>

      <Snackbar
        open={Boolean(undoItem)}
        autoHideDuration={6000}
        onClose={() => setUndoItem(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={undoItem ? `Slettet «${undoItem.credit.title}»` : ''}
        action={
          <Button size="small" onClick={undoRemove} sx={{ textTransform: 'none', color: palette.accentBright, fontWeight: 700 }}>
            Angre
          </Button>
        }
      />

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
                inputProps={{ min: YEAR_MIN, max: YEAR_MAX, step: 1 }}
                error={Boolean(editing?.draft.year) && (Number(editing?.draft.year) < YEAR_MIN || Number(editing?.draft.year) > YEAR_MAX)}
                helperText={
                  Boolean(editing?.draft.year) && (Number(editing?.draft.year) < YEAR_MIN || Number(editing?.draft.year) > YEAR_MAX)
                    ? `Mellom ${YEAR_MIN} og ${YEAR_MAX}`
                    : ' '
                }
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
