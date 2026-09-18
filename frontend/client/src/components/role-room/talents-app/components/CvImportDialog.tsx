/**
 * CvImportDialog.tsx — «Legg inn CV-en, så tar vi resten.»
 *
 * UX-valgene:
 *
 *   Gjennomgang er ikke valgfri. Uttrekket er regelbasert og treffer godt på
 *   ryddige oppsett, dårligere på rotete. Skuespilleren ser hver kreditering
 *   med avkrysning før noe lagres — det er også forskjellen mellom «systemet
 *   gjettet» og «jeg bekreftet» når byrået leser profilen.
 *
 *   Demonstrer verdien tidlig. Ett valg av fil, så ligger hele CV-en der.
 *   Dette er det som gjør registeret verdt å fylle ut i det hele tatt.
 *
 *   Alle tilstander: velg fil → leser → gjennomgang → lagrer → resultat, samt
 *   fire ulike feil med hver sin forklaring og vei videre.
 *
 *   Forebygg feil. Kravene (PDF eller Word, maks 10 MB, tekst må kunne
 *   markeres) står før opplasting. En skannet CV uten tekstlag er den
 *   vanligste blindveien, og den nevnes eksplisitt.
 */

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import { useCallback, useRef, useState } from 'react';

import roleRoomTalentsService, {
  type CvImportSuggestion,
} from '../../services/roleRoomTalentsService';
import { palette, radius } from '../theme';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Kalles når krediteringer faktisk er lagret, så CV-siden kan laste på nytt. */
  onImported: (addedCredits: number) => void;
}

type Phase = 'pick' | 'reading' | 'review' | 'saving' | 'done';

const ERROR_TEXT: Record<string, string> = {
  unsupported_type: 'Filen må være PDF eller Word (.docx).',
  empty_text:
    'Vi fant ingen tekst i filen. Er den skannet som bilde, må du bruke en versjon der teksten kan markeres.',
  import_failed: 'Noe gikk galt under importen. Prøv igjen.',
};

const CATEGORY_LABEL: Record<string, string> = {
  film_tv: 'Film & TV',
  theatre: 'Teater',
  commercial: 'Reklame',
  voice: 'Stemme',
  other: 'Annet',
};

export default function CvImportDialog({ open, onClose, onImported }: Props) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<CvImportSuggestion | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setPhase('pick');
    setError(null);
    setSuggestion(null);
    setSelected(new Set());
    setSavedCount(0);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFile = useCallback(async (file: File) => {
    setPhase('reading');
    setError(null);
    const result = await roleRoomTalentsService.importCv(file);
    if ('error' in result) {
      setError(ERROR_TEXT[result.error] ?? ERROR_TEXT.import_failed);
      setPhase('pick');
      return;
    }
    setSuggestion(result);
    // Alt er valgt som utgangspunkt: den vanlige handlingen er å beholde
    // funnene, ikke å plukke dem ut én for én.
    setSelected(new Set(result.credits.map((_, index) => index)));
    setPhase('review');
  }, []);

  const save = useCallback(async () => {
    if (!suggestion) return;
    setPhase('saving');
    let added = 0;
    for (const [index, credit] of suggestion.credits.entries()) {
      if (!selected.has(index)) continue;
      const result = await roleRoomTalentsService.createCredit({
        category: credit.category,
        title: credit.title,
        role_name: credit.role_name ?? undefined,
        role_type: credit.role_type ?? undefined,
        production_company: credit.production_company ?? undefined,
        director: credit.director ?? undefined,
        year: credit.year ?? undefined,
      });
      if (!('error' in result)) added += 1;
    }
    setSavedCount(added);
    setPhase('done');
    onImported(added);
  }, [onImported, selected, suggestion]);

  const toggle = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={phase === 'reading' || phase === 'saving' ? undefined : handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.lg } }}
    >
      <DialogTitle sx={{ color: palette.textPrimary, fontWeight: 800 }}>
        {phase === 'done' ? 'Importert' : 'Importer CV'}
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {phase === 'pick' && (
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textSecondary, lineHeight: 1.6 }}>
              Last opp CV-en din som PDF eller Word, så henter vi ut krediteringene.
              Du får se alt som ble funnet, og velger selv hva som lagres.
            </Typography>
            <Box
              onClick={() => inputRef.current?.click()}
              sx={{
                border: `1px dashed ${palette.borderStrong}`,
                borderRadius: radius.md,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: palette.bgCardElevated,
              }}
            >
              <UploadFileIcon sx={{ color: palette.accentBright, fontSize: 30 }} />
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mt: 0.8 }}>
                Velg CV-fil
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mt: 0.4 }}>
                PDF eller Word (.docx) · maks 10 MB · teksten må kunne markeres
              </Typography>
            </Box>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', lineHeight: 1.5 }}>
              CV-en leses på vår egen server og sendes ikke videre til noen tredjepart. Filen
              lagres ikke, og ingenting legges inn i profilen din før du har godkjent det.
            </Typography>
          </Stack>
        )}

        {(phase === 'reading' || phase === 'saving') && (
          <Stack spacing={1.6} sx={{ py: 2 }}>
            <Stack direction="row" spacing={1.4} alignItems="center">
              <CircularProgress size={18} sx={{ color: palette.accentBright }} />
              <Typography sx={{ color: palette.textPrimary, fontWeight: 600 }}>
                {phase === 'reading' ? 'Leser CV-en…' : 'Lagrer krediteringer…'}
              </Typography>
            </Stack>
            <LinearProgress
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(75, 61, 143,0.12)',
                '& .MuiLinearProgress-bar': { background: palette.accentGradient },
              }}
            />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem' }}>
              {phase === 'reading'
                ? 'Dette tar noen sekunder.'
                : 'Ikke lukk vinduet før dette er ferdig.'}
            </Typography>
          </Stack>
        )}

        {phase === 'review' && suggestion && (
          <Stack spacing={1.6}>
            <Typography sx={{ color: palette.textSecondary, lineHeight: 1.6 }}>
              Vi kjente igjen <strong>{suggestion.credits.length}</strong>{' '}
              {suggestion.credits.length === 1 ? 'kreditering' : 'krediteringer'}. Se gjennom dem
              og fjern avhukingen på det som ikke stemmer — ingenting lagres før du trykker legg til.
              Feltene kan rettes etterpå.
            </Typography>

            {suggestion.credits.length === 0 && (
              <Alert severity="warning">
                Vi kjente ikke igjen noen krediteringer i denne filen. Legg dem inn manuelt, eller
                prøv en CV der rollene står listet med produksjon og årstall.
              </Alert>
            )}

            <Stack spacing={0.4} sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {suggestion.credits.map((credit, index) => (
                <Stack
                  key={`${credit.title}-${index}`}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  sx={{ py: 0.8, borderBottom: `1px solid ${palette.borderSubtle}` }}
                >
                  <Checkbox
                    checked={selected.has(index)}
                    onChange={() => toggle(index)}
                    size="small"
                    sx={{ color: palette.textMuted, pt: 0.2 }}
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.94rem' }}>
                        {credit.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={CATEGORY_LABEL[credit.category] ?? credit.category}
                        sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.accentBright, height: 20 }}
                      />
                      {credit.year ? (
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>{credit.year}</Typography>
                      ) : null}
                    </Stack>
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem' }}>
                      {[credit.role_name, credit.production_company, credit.director ? `regi: ${credit.director}` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Ingen detaljer funnet'}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            {suggestion.skipped.length > 0 && (
              <Alert severity="info" sx={{ bgcolor: 'rgba(75, 61, 143,0.1)', color: palette.textSecondary }}>
                Vi hoppet bevisst over linjer med persondata ({suggestion.skipped.join(', ')}).
                Slikt hører ikke hjemme i et casting-register.
              </Alert>
            )}
          </Stack>
        )}

        {phase === 'done' && (
          <Stack spacing={1.6} alignItems="center" sx={{ py: 2 }}>
            <CheckCircleIcon sx={{ color: palette.success, fontSize: 48 }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>
              {savedCount} {savedCount === 1 ? 'kreditering' : 'krediteringer'} lagt til
            </Typography>
            <Typography sx={{ color: palette.textSecondary, textAlign: 'center', lineHeight: 1.55 }}>
              Se gjennom dem i CV-en og rett opp det som mangler. Du er fortsatt usynlig for byråer
              til du deler profilen.
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.4 }}>
        {phase === 'review' && (
          <>
            <Button onClick={handleClose} sx={{ textTransform: 'none', color: palette.textMuted }}>
              Avbryt
            </Button>
            <Button
              onClick={() => void save()}
              disabled={selected.size === 0}
              sx={{ textTransform: 'none', fontWeight: 700, px: 2.6, background: palette.accentGradient, color: '#fff' }}
            >
              Legg til {selected.size}
            </Button>
          </>
        )}
        {(phase === 'pick' || phase === 'done') && (
          <Button onClick={handleClose} sx={{ textTransform: 'none', color: palette.textMuted }}>
            {phase === 'done' ? 'Ferdig' : 'Lukk'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
