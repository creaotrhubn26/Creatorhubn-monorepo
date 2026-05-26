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
import ScheduleIcon from '@mui/icons-material/Schedule';
import PublicIcon from '@mui/icons-material/Public';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import InsightsIcon from '@mui/icons-material/Insights';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CircularProgress from '@mui/material/CircularProgress';
import {
  newsletterAiApi,
  newsletterIssuesApi,
  newsletterApi,
  newsletterTemplatesApi,
  type NewsletterAudienceFilter,
  type NewsletterBlock,
  type NewsletterIssue,
  type NewsletterIssueStatus,
  type NewsletterTemplate,
  type NewsletterWeeklyInsights,
} from '../../../services/adminRoomApi';
import NewsletterBlockBuilder from './NewsletterBlockBuilder';

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
  const [editorSeed, setEditorSeed] = useState<NewsletterTemplate | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [clickReportFor, setClickReportFor] = useState<NewsletterIssue | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [repurposeFor, setRepurposeFor] = useState<NewsletterIssue | null>(null);
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
    // Åpne template-picker først; brukeren velger en mal eller "Tom" → editor.
    setTemplatePickerOpen(true);
  }
  function handlePickTemplate(template: NewsletterTemplate | null) {
    setTemplatePickerOpen(false);
    setEditing(null);
    setEditorSeed(template);
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
  async function handleSchedule(issue: NewsletterIssue) {
    // Default: kommende fredag 08:00 norsk tid
    const now = new Date();
    const friday = new Date(now);
    const dow = now.getDay(); // 0=søn, 5=fre
    const daysUntilFriday = (5 - dow + 7) % 7 || 7;
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(8, 0, 0, 0);
    const defaultIso = friday.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    const input = window.prompt(`Planlegg sending av "${issue.title}".\n\nFormat: YYYY-MM-DDTHH:mm (lokal norsk tid)`, defaultIso);
    if (!input) return;
    const scheduledDate = new Date(input);
    if (!Number.isFinite(scheduledDate.getTime())) {
      setError('Ugyldig datoformat');
      return;
    }
    try {
      await newsletterIssuesApi.schedule(issue.id, scheduledDate.toISOString());
      setSnackbar(`Planlagt for ${scheduledDate.toLocaleString('nb-NO')}`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function handlePublish(issue: NewsletterIssue) {
    const desc = window.prompt(`Publisere "${issue.title}" på theroleroom.com/brief/${issue.slug}?\n\nSEO-beskrivelse (valgfri):`, issue.seo_description ?? issue.preheader ?? '');
    if (desc === null) return;
    try {
      await newsletterIssuesApi.publish(issue.id, desc || undefined);
      setSnackbar(`Publisert på theroleroom.com/brief/${issue.slug}`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function handleUnpublish(issue: NewsletterIssue) {
    if (!window.confirm(`Fjern "${issue.title}" fra web-arkivet?`)) return;
    try {
      await newsletterIssuesApi.unpublish(issue.id);
      setSnackbar('Avpublisert');
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function handleUnschedule(issue: NewsletterIssue) {
    if (!window.confirm(`Avbryt planlagt sending av "${issue.title}"?`)) return;
    try {
      await newsletterIssuesApi.unschedule(issue.id);
      setSnackbar('Planlegging avbrutt');
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
          <Button variant="outlined" startIcon={<InsightsIcon />} onClick={() => setInsightsOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.5)' }}>
            Ukens innsikt
          </Button>
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
                  {issue.status === 'scheduled' && issue.scheduled_for ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      <ScheduleIcon sx={{ fontSize: '0.9rem', color: '#fbbf24' }} />
                      <Typography sx={{ color: '#fde68a', fontSize: '0.78rem', fontWeight: 600 }}>
                        Planlagt for {new Date(issue.scheduled_for).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })}
                      </Typography>
                    </Box>
                  ) : null}
                  {issue.audience_filter && issue.audience_filter !== 'all' ? (
                    <Chip
                      label={issue.audience_filter === 'tier1-advocates' ? 'T1 Advocates' : issue.audience_filter === 'tier1-engaged' ? 'T1 Engaged' : issue.audience_filter}
                      size="small"
                      sx={{ bgcolor: 'rgba(244,114,182,0.18)', color: '#f9a8d4', fontWeight: 700, fontSize: '0.65rem', height: 18, mt: 0.5 }}
                    />
                  ) : null}
                  {issue.published_to_web ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      <PublicIcon sx={{ fontSize: '0.9rem', color: '#34d399' }} />
                      <Typography component="a" href={`/brief/${issue.slug}`} target="_blank" rel="noreferrer" sx={{ color: '#34d399', fontSize: '0.74rem', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        theroleroom.com/brief/{issue.slug}
                      </Typography>
                      {(issue.web_view_count ?? 0) > 0 ? (
                        <Chip label={`${issue.web_view_count} visninger`} size="small" sx={{ bgcolor: 'rgba(52,211,153,0.15)', color: '#86efac', fontSize: '0.65rem', height: 18, fontWeight: 700 }} />
                      ) : null}
                    </Box>
                  ) : null}
                  {issue.status === 'sent' ? (
                    <Box sx={{ mt: 0.75, display: 'flex', gap: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                      <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.74rem' }}>
                        Sendt {issue.sent_at ? new Date(issue.sent_at).toLocaleString('nb-NO') : '—'} · {issue.sent_count} ok, {issue.failed_count} feilet
                      </Typography>
                      {(issue.sent_count ?? 0) > 0 ? (
                        <>
                          <Chip
                            label={`Åpnet ${issue.unique_open_count ?? 0}/${issue.sent_count} (${Math.round(((issue.unique_open_count ?? 0) / issue.sent_count) * 100)}%)`}
                            size="small"
                            sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: '#86efac', fontWeight: 700, fontSize: '0.68rem', height: 18 }}
                          />
                          <Chip
                            label={`Klikk ${issue.unique_click_count ?? 0} (${Math.round(((issue.unique_click_count ?? 0) / (issue.unique_open_count || issue.sent_count)) * 100)}%)`}
                            size="small"
                            onClick={() => setClickReportFor(issue)}
                            sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', fontWeight: 700, fontSize: '0.68rem', height: 18, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(167,139,250,0.28)' } }}
                          />
                        </>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => handleEdit(issue)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Rediger
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<ScienceIcon />} onClick={() => handleSendTest(issue)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    Test
                  </Button>
                  {issue.status === 'sent' ? (
                    <>
                      {issue.published_to_web ? (
                        <Button size="small" variant="outlined" startIcon={<PublicOffIcon />} onClick={() => handleUnpublish(issue)} sx={{ textTransform: 'none', fontWeight: 600, color: 'rgba(203,213,225,0.85)' }}>
                          Skjul fra web
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" startIcon={<PublicIcon />} onClick={() => handlePublish(issue)} sx={{ textTransform: 'none', fontWeight: 600, color: '#34d399', borderColor: 'rgba(52,211,153,0.4)' }}>
                          Publiser til web
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ShareIcon />}
                        onClick={() => setRepurposeFor(issue)}
                        sx={{ textTransform: 'none', fontWeight: 600, color: '#fb923c', borderColor: 'rgba(251,146,60,0.4)' }}
                      >
                        Cross-post
                      </Button>
                    </>
                  ) : null}
                  {issue.status === 'scheduled' ? (
                    <>
                      <Button size="small" variant="outlined" startIcon={<ScheduleIcon />} onClick={() => handleUnschedule(issue)} sx={{ textTransform: 'none', fontWeight: 600, color: '#fbbf24', borderColor: 'rgba(251,191,36,0.4)' }}>
                        Avbryt planlegging
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ScheduleIcon />}
                        disabled={issue.status === 'sending' || issue.status === 'sent' || (subscriberStats?.confirmed ?? 0) === 0}
                        onClick={() => handleSchedule(issue)}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Planlegg
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SendIcon />}
                        disabled={issue.status === 'sending' || issue.status === 'sent' || (subscriberStats?.confirmed ?? 0) === 0}
                        onClick={() => handleSendToAll(issue)}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}
                      >
                        Send nå
                      </Button>
                    </>
                  )}
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
        seed={editorSeed}
        onClose={() => { setEditorOpen(false); setEditing(null); setEditorSeed(null); }}
        onSaved={async () => { setEditorOpen(false); setEditing(null); setEditorSeed(null); await refresh(); setSnackbar('Lagret'); }}
        onError={setError}
      />

      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onPick={handlePickTemplate}
        onError={setError}
      />

      <ClickReportDialog
        issue={clickReportFor}
        onClose={() => setClickReportFor(null)}
        onError={setError}
      />

      <WeeklyInsightsDialog
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        onError={setError}
      />

      <RepurposeDialog
        issue={repurposeFor}
        onClose={() => setRepurposeFor(null)}
        onError={setError}
        onCopied={(label) => setSnackbar(`${label} kopiert til utklippstavlen`)}
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
  seed?: NewsletterTemplate | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

function IssueEditor({ open, initial, seed, onClose, onSaved, onError }: IssueEditorProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [preheader, setPreheader] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [bodyBlocks, setBodyBlocks] = useState<NewsletterBlock[]>([]);
  const [audienceFilter, setAudienceFilter] = useState<NewsletterAudienceFilter>('all');
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setSubject(initial.subject);
      setPreheader(initial.preheader ?? '');
      setBodyMarkdown(initial.body_markdown);
      setBodyBlocks(initial.body_blocks ?? []);
      setAudienceFilter(initial.audience_filter ?? 'all');
      lastSavedRef.current = JSON.stringify(initial.body_blocks ?? []);
    } else {
      const weekNum = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      setTitle(`Uke ${weekNum} — ${new Date().toLocaleDateString('nb-NO', { day: '2-digit', month: 'long' })}`);
      setSubject(`Norwegian Casting Brief — Uke ${weekNum}`);
      setPreheader(seed?.preheader ?? 'Ukens data, founder POV, behind-the-cast og risk-varsler.');
      setBodyMarkdown(STARTER_TEMPLATE.replace('{{nummer}}', String(weekNum)));
      // Hvis seed-template valgt, bruk dens blokker; ellers tom.
      // Erstatt "__" i header med ukenummer for å unngå manuell editing.
      if (seed?.body_blocks) {
        const seeded = seed.body_blocks.map((b) => {
          if (b.type === 'header') return { ...b, text: b.text.replace(/__/g, String(weekNum)) };
          return b;
        });
        setBodyBlocks(seeded);
        lastSavedRef.current = JSON.stringify(seeded);
      } else {
        setBodyBlocks([]);
        lastSavedRef.current = '[]';
      }
      setAudienceFilter('all');
    }
  }, [open, initial, seed]);

  const blocksJson = JSON.stringify(bodyBlocks);
  const isDirty = blocksJson !== lastSavedRef.current || (initial && (title !== initial.title || subject !== initial.subject || preheader !== (initial.preheader ?? '')));

  async function handleSave() {
    if (!title.trim()) { onError('Tittel er påkrevd'); return; }
    setSaving(true);
    try {
      if (initial) {
        await newsletterIssuesApi.patch(initial.id, { title, subject, preheader: preheader || null, bodyMarkdown, bodyBlocks, audienceFilter });
      } else {
        await newsletterIssuesApi.create({ title, subject, preheader: preheader || null, bodyMarkdown, bodyBlocks, audienceFilter });
      }
      lastSavedRef.current = blocksJson;
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
        <NewsletterBlockBuilder
          initialBlocks={bodyBlocks}
          title={title}
          subject={subject}
          preheader={preheader}
          audienceFilter={audienceFilter}
          onChange={setBodyBlocks}
          onTitleChange={setTitle}
          onSubjectChange={setSubject}
          onPreheaderChange={setPreheader}
          onAudienceFilterChange={setAudienceFilter}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid rgba(148,163,184,0.14)' }}>
        <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.78rem', flex: 1 }}>
          {bodyBlocks.length} blokker · {isDirty ? 'Ikke lagret' : 'Lagret'}
        </Typography>
        <Button
          onClick={async () => {
            const name = window.prompt('Navn på mal:', `${title} (mal)`);
            if (!name) return;
            try {
              await newsletterTemplatesApi.create({
                name,
                description: `Lagret ${new Date().toLocaleDateString('nb-NO')} fra utgave "${title}"`,
                preheader: preheader || null,
                bodyBlocks,
              });
              onError(`Lagret som mal: ${name}`);
            } catch (err) {
              onError((err as Error).message);
            }
          }}
          sx={{ textTransform: 'none', color: 'rgba(203,213,225,0.85)' }}
        >
          Lagre som mal
        </Button>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Lukk</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          {saving ? 'Lagrer…' : 'Lagre utkast'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Template picker — vises før Ny utgave-editor ─────────────────────

function TemplatePicker({ open, onClose, onPick, onError }: { open: boolean; onClose: () => void; onPick: (template: NewsletterTemplate | null) => void; onError: (msg: string) => void }) {
  const [templates, setTemplates] = useState<NewsletterTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    newsletterTemplatesApi.list().then(setTemplates).catch((err) => onError((err as Error).message)).finally(() => setLoading(false));
  }, [open, onError]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Velg mal for ny utgave</Typography>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>Laster …</Typography>
        ) : (
          <Stack spacing={1.5}>
            <Box
              onClick={() => onPick(null)}
              sx={{ p: 2, borderRadius: 1.5, border: '1px dashed rgba(148,163,184,0.3)', cursor: 'pointer', '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(139,92,246,0.06)' } }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>Tom utgave</Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.8rem', mt: 0.5 }}>Start fra blanke ark — bygg fra bunnen med block-builder.</Typography>
            </Box>
            {templates.map((t) => (
              <Box
                key={t.id}
                onClick={() => onPick(t)}
                sx={{ p: 2, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.18)', cursor: 'pointer', '&:hover': { borderColor: '#a78bfa', bgcolor: 'rgba(139,92,246,0.08)' } }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{t.name}</Typography>
                  {t.is_default ? <Chip label="Standard" size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', fontWeight: 700, fontSize: '0.62rem', height: 16 }} /> : null}
                  <Chip label={`${t.body_blocks.length} blokker`} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.15)', color: '#cbd5e1', fontSize: '0.62rem', height: 16 }} />
                </Stack>
                {t.description ? <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.82rem' }}>{t.description}</Typography> : null}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Click-rapport for en sent issue ──────────────────────────────────

function ClickReportDialog({ issue, onClose, onError }: { issue: NewsletterIssue | null; onClose: () => void; onError: (msg: string) => void }) {
  const [links, setLinks] = useState<Array<{ destination_url: string; total_clicks: number; unique_clicks: number }>>([]);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issue) return;
    setLoading(true);
    newsletterIssuesApi.clicks(issue.id).then((r) => { setLinks(r.links); setSentCount(r.sentCount); }).catch((err) => onError((err as Error).message)).finally(() => setLoading(false));
  }, [issue, onError]);

  return (
    <Dialog open={issue !== null} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Klikk-rapport</Typography>
          {issue ? <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.78rem' }}>{issue.title}</Typography> : null}
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>Laster …</Typography>
        ) : links.length === 0 ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', textAlign: 'center', py: 4 }}>Ingen klikk registrert ennå.</Typography>
        ) : (
          <Stack spacing={1}>
            {links.map((link) => {
              const ctr = sentCount > 0 ? (link.unique_clicks / sentCount) * 100 : 0;
              return (
                <Box key={link.destination_url} sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(15,23,42,0.4)' }}>
                  <Typography sx={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-all', mb: 0.5 }}>
                    {link.destination_url}
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <Chip label={`${link.total_clicks} klikk`} size="small" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', fontWeight: 700, fontSize: '0.7rem' }} />
                    <Chip label={`${link.unique_clicks} unike`} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', fontWeight: 700, fontSize: '0.7rem' }} />
                    <Chip label={`CTR ${ctr.toFixed(1)}%`} size="small" sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fde68a', fontWeight: 700, fontSize: '0.7rem' }} />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Weekly Insights — Claude-forslag fra ukens data ─────────────────

function WeeklyInsightsDialog({ open, onClose, onError }: { open: boolean; onClose: () => void; onError: (msg: string) => void }) {
  const [data, setData] = useState<NewsletterWeeklyInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setData(null); return; }
    setLoading(true);
    newsletterAiApi.weeklyInsights()
      .then(setData)
      .catch((err) => onError((err as Error).message))
      .finally(() => setLoading(false));
  }, [open, onError]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <InsightsIcon sx={{ color: '#a78bfa' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>Ukens innsikt — Claude-forslag</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Stack alignItems="center" spacing={1}>
              <AutoAwesomeIcon sx={{ color: '#a78bfa', fontSize: '2rem' }} />
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem' }}>Aggregér data + Claude analyserer …</Typography>
            </Stack>
          </Box>
        ) : !data ? null : (
          <Stack spacing={2.5}>
            {/* Forslag */}
            {data.suggestion ? (
              <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(167,139,250,0.4)' }}>
                <Typography sx={{ color: '#a78bfa', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.5 }}>
                  Forslag fra Claude
                </Typography>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.3, mb: 1.5 }}>
                  {data.suggestion.topic}
                </Typography>
                <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.9rem', lineHeight: 1.65, mb: 1.5 }}>
                  {data.suggestion.why}
                </Typography>
                <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'rgba(34,197,94,0.08)', borderLeft: '3px solid #22c55e', mb: 1.5 }}>
                  <Typography sx={{ color: '#86efac', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>Data-anker</Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.9)', fontSize: '0.88rem' }}>{data.suggestion.dataAnchor}</Typography>
                </Box>
                <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'rgba(251,191,36,0.08)', borderLeft: '3px solid #fbbf24', mb: 1.5 }}>
                  <Typography sx={{ color: '#fde68a', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>Åpningshook</Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.9)', fontSize: '0.88rem', fontStyle: 'italic' }}>{data.suggestion.draftHook}</Typography>
                </Box>
                {data.suggestion.angleAlternatives.length > 0 ? (
                  <Box>
                    <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', fontWeight: 700, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Alternative vinkler</Typography>
                    <Stack spacing={0.5}>
                      {data.suggestion.angleAlternatives.map((alt) => (
                        <Typography key={alt} sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.85rem' }}>· {alt}</Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Box>
            ) : data.suggestionError ? (
              <Alert severity="warning">Claude-forslag feilet: {data.suggestionError}</Alert>
            ) : null}

            {/* Snapshot */}
            <Box>
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                Rådata — siste 7 dager
              </Typography>
              <Stack spacing={1.5}>
                {data.snapshot.signups.length > 0 ? (
                  <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', mb: 0.75 }}>Newsletter-signups per kilde</Typography>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                      {data.snapshot.signups.map((s) => (
                        <Chip
                          key={s.source}
                          label={`${s.source}: ${s.last_7d}${s.change_pct !== null ? ` (${s.change_pct > 0 ? '+' : ''}${s.change_pct}%)` : ''}`}
                          size="small"
                          sx={{
                            bgcolor: s.change_pct !== null && s.change_pct > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                            color: s.change_pct !== null && s.change_pct > 0 ? '#86efac' : '#cbd5e1',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {data.snapshot.tier1Activity.length > 0 ? (
                  <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', mb: 0.75 }}>T1/T2-aktivitet ({data.snapshot.tier1Activity.length})</Typography>
                    <Stack spacing={0.5}>
                      {data.snapshot.tier1Activity.slice(0, 6).map((a, idx) => (
                        <Typography key={idx} sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.78rem' }}>
                          • <strong>{a.name}</strong> ({a.tier} {a.segment}) — {a.kind}{a.note ? `: "${a.note}"` : ''}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {data.snapshot.topClickedLinks.length > 0 ? (
                  <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', mb: 0.75 }}>Mest klikket (siste 30d)</Typography>
                    <Stack spacing={0.5}>
                      {data.snapshot.topClickedLinks.slice(0, 5).map((c) => (
                        <Typography key={c.url} sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                          <Chip label={c.clicks} size="small" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', height: 18, fontSize: '0.65rem', mr: 0.75, fontWeight: 700 }} />
                          {c.url}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                {data.snapshot.bestPerformingIssues.length > 0 ? (
                  <Box sx={{ p: 1.5, borderRadius: 1, border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', mb: 0.75 }}>Best open rate hittil</Typography>
                    <Stack spacing={0.5}>
                      {data.snapshot.bestPerformingIssues.map((i, idx) => (
                        <Typography key={idx} sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.78rem' }}>
                          <Chip label={i.open_rate_pct !== null ? `${i.open_rate_pct}%` : '—'} size="small" sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', height: 18, fontSize: '0.65rem', mr: 0.75, fontWeight: 700 }} />
                          {i.title}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Box>

            <Typography sx={{ color: 'rgba(203,213,225,0.45)', fontSize: '0.72rem', textAlign: 'center' }}>
              Generert {new Date(data.generatedAt).toLocaleString('nb-NO')}
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Cross-post repurposing dialog ──────────────────────────────────

interface RepurposeContent {
  linkedinEssay: string;
  instagramCarousel: Array<{ slideNumber: number; headline: string; body: string }>;
  quoteCards: Array<{ quote: string; attribution: string }>;
}

function RepurposeDialog({ issue, onClose, onError, onCopied }: { issue: NewsletterIssue | null; onClose: () => void; onError: (msg: string) => void; onCopied: (label: string) => void }) {
  const [content, setContent] = useState<RepurposeContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issue) { setContent(null); return; }
    setLoading(true);
    newsletterAiApi.repurpose(issue.id)
      .then(setContent)
      .catch((err) => onError((err as Error).message))
      .finally(() => setLoading(false));
  }, [issue, onError]);

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(label);
    } catch {
      onError('Kunne ikke kopiere — prøv manuelt');
    }
  }

  return (
    <Dialog open={issue !== null} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ShareIcon sx={{ color: '#fb923c' }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Cross-post — 1 utgave → 3 formater</Typography>
            {issue ? <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.78rem' }}>{issue.title}</Typography> : null}
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Stack alignItems="center" spacing={1}>
              <CircularProgress size={28} sx={{ color: '#fb923c' }} />
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.85rem' }}>Claude genererer LinkedIn-essay + IG-carousel + quote-cards…</Typography>
            </Stack>
          </Box>
        ) : !content ? null : (
          <Stack spacing={3}>
            {/* LinkedIn-essay */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>LinkedIn-essay</Typography>
                <Button size="small" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => copyToClipboard(content.linkedinEssay, 'LinkedIn-essay')} sx={{ textTransform: 'none', color: '#a78bfa', fontWeight: 700 }}>
                  Kopier
                </Button>
              </Stack>
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)', whiteSpace: 'pre-wrap', fontSize: '0.88rem', lineHeight: 1.65, color: 'rgba(229,231,235,0.9)' }}>
                {content.linkedinEssay}
              </Box>
              <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', mt: 0.5 }}>
                {content.linkedinEssay.length} tegn (LinkedIn max 3000)
              </Typography>
            </Box>

            {/* Instagram-carousel */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>Instagram-carousel ({content.instagramCarousel.length} slides)</Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon fontSize="small" />}
                  onClick={() => copyToClipboard(
                    content.instagramCarousel.map((s) => `Slide ${s.slideNumber}: ${s.headline}\n${s.body}`).join('\n\n---\n\n'),
                    'Hele carousel-teksten',
                  )}
                  sx={{ textTransform: 'none', color: '#a78bfa', fontWeight: 700 }}
                >
                  Kopier alle
                </Button>
              </Stack>
              <Stack spacing={1.25}>
                {content.instagramCarousel.map((slide) => (
                  <Box key={slide.slideNumber} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.25)', display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Chip label={`#${slide.slideNumber}`} size="small" sx={{ bgcolor: 'rgba(251,146,60,0.2)', color: '#fb923c', fontWeight: 800, fontSize: '0.7rem', height: 22, minWidth: 32 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', mb: 0.5 }}>{slide.headline}</Typography>
                      <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.82rem', lineHeight: 1.5 }}>{slide.body}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => copyToClipboard(`${slide.headline}\n${slide.body}`, `Slide ${slide.slideNumber}`)} sx={{ color: 'rgba(167,139,250,0.7)' }}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* Quote-cards */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>Quote-cards (evergreen-sitater)</Typography>
              </Stack>
              <Stack spacing={1}>
                {content.quoteCards.map((qc, idx) => (
                  <Box key={idx} sx={{ p: 1.75, borderRadius: 1.5, bgcolor: 'rgba(139,92,246,0.08)', borderLeft: '3px solid #8b5cf6', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{qc.quote}"
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.74rem', mt: 0.5 }}>— {qc.attribution}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => copyToClipboard(`"${qc.quote}"\n— ${qc.attribution}`, `Quote-card ${idx + 1}`)} sx={{ color: 'rgba(167,139,250,0.7)' }}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Typography sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.72rem', textAlign: 'center', mt: 2 }}>
              Repurposed via Claude. Editér fritt før posting — tonen skal være din.
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default NewsletterStudioTab;
