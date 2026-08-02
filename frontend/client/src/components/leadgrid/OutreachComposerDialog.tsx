/**
 * OutreachComposerDialog.tsx — outreach med butler
 *
 * Selgeren velger mål, skriver (eller lar være å skrive) et utkast, og
 * butleren svarer med: dossier-fakta plattformen kjenner, deterministisk
 * ryddighets-analyse av utkastet, vinklings-råd forankret i fakta
 * («hovedfokuset deres er X [3] — legg dem frem sånn») og et forslag
 * til ferdig tekst. Forslaget er et forslag — selgeren eier teksten.
 */

import { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Select, Stack, TextField,
  Typography,
} from '@mui/material';
import {
  AutoFixHigh as ButlerIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

interface DossierFact { n: number; source: string; label: string; value: string }
interface TextAnalysis { words: number; avgSentenceLength: number; warnings: string[] }
interface ComposerResult {
  facts: DossierFact[];
  analysis: TextAnalysis | null;
  butlerNotes: Array<{ kind: string; note: string }>;
  suggestedDraft: string;
}

const INTENTS = [
  'Første kontakt — introdusere oss',
  'Oppfølging etter tidligere kontakt',
  'Foreslå møte/demo',
  'Anbud/tilbud — avklare behov',
  'Reaktivere stille lead',
];

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem('creatorhub_auth_token') ?? localStorage.getItem('token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function OutreachComposerDialog({
  open, onClose, leadId, leadName,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
}) {
  const [intent, setIntent] = useState(INTENTS[0]);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<ComposerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const compose = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const r = await fetch('/api/integrations/outreach/compose', {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, intent, draft: draft.trim() || undefined }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error === 'butler_besto_ikke_siterings_validering'
          ? 'Butleren fant på ting og ble avvist — prøv igjen.'
          : `Kunne ikke komponere (${body?.error ?? r.status})`);
        return;
      }
      setResult(body.result as ComposerResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const copyDraft = async () => {
    if (!result?.suggestedDraft) return;
    await navigator.clipboard.writeText(result.suggestedDraft);
    setCopied(true);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ButlerIcon sx={{ color: '#c084fc' }} />
          <span>Outreach — {leadName}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Select size="small" value={intent} onChange={(e) => setIntent(e.target.value)} sx={{ minWidth: 260 }}>
              {INTENTS.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </Select>
            <Button variant="contained" onClick={() => void compose()} disabled={loading}
              startIcon={loading ? <CircularProgress size={14} /> : <ButlerIcon />}>
              {loading ? 'Butleren tenker…' : draft.trim() ? 'Vurder utkastet mitt' : 'Skriv forslag'}
            </Button>
          </Stack>

          <TextField multiline minRows={3} maxRows={8} fullWidth size="small"
            placeholder="Skriv utkastet ditt her — eller la stå tomt, så foreslår butleren fra det plattformen vet om selskapet."
            value={draft} onChange={(e) => setDraft(e.target.value)} />

          {error && <Alert severity="warning">{error}</Alert>}

          {result && (
            <>
              {result.analysis && result.analysis.warnings.length > 0 && (
                <Alert severity="info" icon={false}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    Ryddighets-sjekk ({result.analysis.words} ord, snitt {result.analysis.avgSentenceLength} ord/setning)
                  </Typography>
                  {result.analysis.warnings.map((w, i) => (
                    <Typography key={i} variant="caption" sx={{ display: 'block' }}>• {w}</Typography>
                  ))}
                </Alert>
              )}

              {result.butlerNotes.length > 0 && (
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(192,132,252,0.08)', borderLeft: '3px solid #c084fc' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#c084fc', display: 'block', mb: 0.5 }}>
                    Butleren bemerker
                  </Typography>
                  {result.butlerNotes.map((n, i) => (
                    <Typography key={i} variant="body2" sx={{ fontSize: '0.82rem', mb: 0.5 }}>
                      {n.kind === 'selskap' ? '🏢 ' : '✒️ '}{n.note}
                    </Typography>
                  ))}
                </Box>
              )}

              {result.suggestedDraft && (
                <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.3)' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Forslag (ditt å redigere)</Typography>
                    <Button size="small" startIcon={<CopyIcon />} onClick={() => void copyDraft()}>
                      {copied ? 'Kopiert ✓' : 'Kopier'}
                    </Button>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                    {result.suggestedDraft}
                  </Typography>
                </Box>
              )}

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                  Faktagrunnlaget ([n] i rådene)
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {result.facts.map((f) => (
                    <Chip key={f.n} size="small" variant="outlined"
                      label={`[${f.n}] ${f.label}: ${f.value.slice(0, 40)}`}
                      sx={{ fontSize: 10, height: 20 }} />
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}
