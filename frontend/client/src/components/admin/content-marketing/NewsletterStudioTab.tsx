import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import ScienceIcon from '@mui/icons-material/Science';
import CloseIcon from '@mui/icons-material/Close';
import {
  newsletterIssuesApi,
  newsletterApi,
  type NewsletterIssue,
  type NewsletterIssueStatus,
} from '../../../services/adminRoomApi';

/**
 * Newsletter Studio — eget dashboard for å skrive og sende Norwegian
 * Casting Brief. Erstatter behov for Beehiiv/Substack med en
 * Admin Room-integrert flow:
 *   - Liste over utgaver (draft / sent)
 *   - Markdown-editor med live HTML-preview (samme branding som mail)
 *   - "Send test" til egen e-post
 *   - "Send til alle confirmed" — kjører async batch, viser progress
 *   - Subscriber-count + status-stats
 */

const STATUS_COLORS: Record<NewsletterIssueStatus, string> = {
  draft: '#64748b',
  scheduled: '#fbbf24',
  sending: '#a78bfa',
  sent: '#22c55e',
  failed: '#ef4444',
};

const PREVIEW_BG = '#0a0a0f';
const BRAND = '#8b5cf6';

/** Minimal markdown→HTML — speiler backend-rendreren for preview. */
function renderPreview(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/(^|\n)((?:- .+(?:\n|$))+)/g, (_match, prefix, block) => {
      const items = block.trim().split('\n').map((line: string) => `<li>${line.replace(/^- /, '')}</li>`).join('');
      return `${prefix}<ul>${items}</ul>`;
    })
    .replace(/(^|\n)((?:\d+\. .+(?:\n|$))+)/g, (_match, prefix, block) => {
      const items = block.trim().split('\n').map((line: string) => `<li>${line.replace(/^\d+\. /, '')}</li>`).join('');
      return `${prefix}<ol>${items}</ol>`;
    });
  html = html
    .split(/\n{2,}/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      if (/^<(h[123]|ul|ol|blockquote)/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  return html;
}

const STARTER_TEMPLATE = `# Uke {{nummer}} — Norwegian Casting Brief

**Hva som skjedde i norsk casting denne uken**

## The data point

73% av norske kommersielle castinger inkluderer minst én rolle der "etnisitet ikke spesifisert" — men 41% av de endelige castene er fortsatt etnisk norske.

## Founder POV

Skriv kort fra ukens voice memo eller LinkedIn-post.

## Behind the cast

> Sitat fra en CD eller produsent denne uken.

## The risk

Hva endrer seg juridisk i bransjen som folk ikke har fanget opp.

---

Tipsene ovenfor er kuratert fra _Norwegian Casting Report_-data + ukens samtaler. Skriv på [theroleroom.com/brief](https://theroleroom.com/brief).
`;

export function NewsletterStudioTab() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<NewsletterIssue | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [subscriberStats, setSubscriberStats] = useState<{ confirmed: number; pending: number; total: number } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        newsletterIssuesApi.list(),
        newsletterApi.stats().catch(() => null),
      ]);
      setIssues(list);
      if (stats) {
        setSubscriberStats({
          confirmed: stats.totals.confirmed,
          pending: stats.totals.pending,
          total: stats.totals.total,
        });
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function handleNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function handleEdit(issue: NewsletterIssue) {
    setEditing(issue);
    setEditorOpen(true);
  }
  async function handleDelete(issue: NewsletterIssue) {
    if (!window.confirm(`Slette utgave "${issue.title}"?`)) return;
    try {
      await newsletterIssuesApi.remove(issue.id);
      setSnackbar('Utgave slettet');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function handleSendTest(issue: NewsletterIssue) {
    try {
      const r = await newsletterIssuesApi.sendTest(issue.id);
      setSnackbar(`Test-mail sendt til ${r.sentTo}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function handleSendToAll(issue: NewsletterIssue) {
    const count = subscriberStats?.confirmed ?? 0;
    if (!window.confirm(`Sende "${issue.title}" til ${count} bekreftede mottakere? Dette kan ikke angres.`)) return;
    try {
      const r = await newsletterIssuesApi.send(issue.id);
      setSnackbar(r.message || `Sending startet til ${r.recipientCount} mottakere`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
            Norwegian Casting Brief — Studio
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem' }}>
            Skriv, forhåndsvis og send ukens utgave. Egen stack — ingen Beehiiv eller Substack.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {subscriberStats ? (
            <>
              <Chip label={`${subscriberStats.confirmed} bekreftet`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#bbf7d0', fontWeight: 700 }} />
              <Chip label={`${subscriberStats.pending} avventer`} size="small" sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fde68a', fontWeight: 700 }} />
            </>
          ) : null}
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
            Ny utgave
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <Stack spacing={1.5}>
        {loading ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>Laster …</Typography>
        ) : issues.length === 0 ? (
          <Box sx={{ p: 4, borderRadius: 2, border: '1px dashed rgba(148,163,184,0.3)', textAlign: 'center' }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.7)', mb: 1 }}>Ingen utgaver enda.</Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.85rem', mb: 2 }}>
              Klikk "Ny utgave" og start på første Norwegian Casting Brief.
            </Typography>
          </Box>
        ) : (
          issues.map((issue) => (
            <Box key={issue.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1.5}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                    <Chip label={issue.status} size="small" sx={{ bgcolor: `${STATUS_COLORS[issue.status]}22`, color: STATUS_COLORS[issue.status], fontWeight: 700, fontSize: '0.68rem' }} />
                    <Typography component="code" sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.72rem', fontFamily: 'monospace' }}>{issue.slug}</Typography>
                  </Stack>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{issue.title}</Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>{issue.subject}</Typography>
                  {issue.status === 'sent' ? (
                    <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.75rem', mt: 0.5 }}>
                      Sendt {issue.sent_at ? new Date(issue.sent_at).toLocaleString('nb-NO') : '—'} · {issue.sent_count} ok, {issue.failed_count} feilet
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => handleEdit(issue)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Rediger
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<ScienceIcon />} onClick={() => handleSendTest(issue)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Test
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SendIcon />}
                    disabled={issue.status === 'sending' || issue.status === 'sent' || (subscriberStats?.confirmed ?? 0) === 0}
                    onClick={() => handleSendToAll(issue)}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}
                  >
                    Send
                  </Button>
                  <IconButton size="small" onClick={() => handleDelete(issue)} disabled={issue.status === 'sending'}>
                    <DeleteOutlineIcon fontSize="small" sx={{ color: 'rgba(248,113,113,0.85)' }} />
                  </IconButton>
                </Stack>
              </Stack>
            </Box>
          ))
        )}
      </Stack>

      <IssueEditor
        open={editorOpen}
        initial={editing}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        onSaved={async () => { setEditorOpen(false); setEditing(null); await refresh(); setSnackbar('Lagret'); }}
        onError={setError}
      />

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

interface IssueEditorProps {
  open: boolean;
  initial: NewsletterIssue | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

function IssueEditor({ open, initial, onClose, onSaved, onError }: IssueEditorProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setSubject(initial.subject);
      setPreheader(initial.preheader ?? '');
      setBodyMarkdown(initial.body_markdown);
      lastSavedRef.current = initial.body_markdown;
    } else {
      const weekNum = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      setTitle(`Uke ${weekNum} — ${new Date().toLocaleDateString('nb-NO', { day: '2-digit', month: 'long' })}`);
      setSubject(`Norwegian Casting Brief — Uke ${weekNum}`);
      setPreheader('Ukens data, founder POV, behind-the-cast og risk-varsler.');
      setBodyMarkdown(STARTER_TEMPLATE.replace('{{nummer}}', String(weekNum)));
      lastSavedRef.current = '';
    }
  }, [open, initial]);

  const previewHtml = useMemo(() => renderPreview(bodyMarkdown), [bodyMarkdown]);
  const isDirty = bodyMarkdown !== lastSavedRef.current || (initial && (title !== initial.title || subject !== initial.subject || preheader !== (initial.preheader ?? '')));

  async function handleSave() {
    if (!title.trim()) { onError('Tittel er påkrevd'); return; }
    setSaving(true);
    try {
      if (initial) {
        await newsletterIssuesApi.patch(initial.id, { title, subject, preheader: preheader || null, bodyMarkdown });
      } else {
        await newsletterIssuesApi.create({ title, subject, preheader: preheader || null, bodyMarkdown });
      }
      lastSavedRef.current = bodyMarkdown;
      onSaved();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0', height: '90vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(148,163,184,0.14)' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{initial ? `Rediger: ${initial.title}` : 'Ny utgave'}</Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>
            Markdown til venstre, live preview til høyre — speiler hva mottaker ser i innboksen.
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField label="Tittel" size="small" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label="Emnefelt (Subject)" size="small" fullWidth value={subject} onChange={(e) => setSubject(e.target.value)} />
            <TextField label="Preheader (gråtekst i innboks)" size="small" fullWidth value={preheader} onChange={(e) => setPreheader(e.target.value)} />
          </Stack>
        </Box>
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 0, overflow: 'hidden' }}>
          <Box sx={{ borderRight: { md: '1px solid rgba(148,163,184,0.08)' }, overflow: 'auto' }}>
            <TextField
              multiline
              fullWidth
              minRows={20}
              value={bodyMarkdown}
              onChange={(e) => setBodyMarkdown(e.target.value)}
              variant="outlined"
              placeholder="# Skriv markdown her …"
              sx={{
                height: '100%',
                '& .MuiOutlinedInput-root': {
                  height: '100%',
                  alignItems: 'flex-start',
                  bgcolor: 'rgba(2,6,23,0.7)',
                  borderRadius: 0,
                  fontFamily: '"JetBrains Mono", Menlo, monospace',
                  fontSize: '0.82rem',
                  lineHeight: 1.65,
                  color: '#e2e8f0',
                  '& fieldset': { border: 'none' },
                },
                '& textarea': { height: '100% !important' },
              }}
            />
          </Box>
          <Box sx={{ overflow: 'auto', bgcolor: PREVIEW_BG, p: 3 }}>
            <Box sx={{ maxWidth: 560, mx: 'auto' }}>
              <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2, mb: 3 }}>
                <Typography sx={{ color: BRAND, fontFamily: '"Courier New", monospace', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Norwegian Casting Brief
                </Typography>
              </Box>
              <Box
                sx={{
                  color: '#e5e7eb',
                  fontSize: '0.92rem',
                  lineHeight: 1.7,
                  '& h1': { color: '#fff', fontSize: '1.7rem', lineHeight: 1.3, m: '0 0 1rem' },
                  '& h2': { color: '#fff', fontSize: '1.2rem', lineHeight: 1.3, m: '1.75rem 0 0.75rem' },
                  '& h3': { color: '#fff', fontSize: '1rem', lineHeight: 1.3, m: '1.5rem 0 0.5rem' },
                  '& p': { m: '0 0 1rem' },
                  '& a': { color: '#a78bfa' },
                  '& blockquote': { borderLeft: `3px solid ${BRAND}`, pl: 2, color: 'rgba(229,231,235,0.78)', m: '1rem 0' },
                  '& ul, & ol': { pl: 3, my: 1.5 },
                  '& li': { my: 0.5 },
                  '& strong': { color: '#fff' },
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
              <Box sx={{ mt: 5, pt: 3, borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(229,231,235,0.5)', fontSize: '0.72rem', lineHeight: 1.6 }}>
                Du mottar denne fordi du meldte deg på via theroleroom.com. [Meld deg av]<br />
                The Role Room · Et produkt fra CreatorHub Norge AS · Oslo, Norge
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
        <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.78rem', flex: 1 }}>
          {bodyMarkdown.length} tegn · {isDirty ? 'Ikke lagret' : 'Lagret'}
        </Typography>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Lukk</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          {saving ? 'Lagrer…' : 'Lagre utkast'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewsletterStudioTab;
