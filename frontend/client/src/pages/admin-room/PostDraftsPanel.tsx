/**
 * PostDraftsPanel — AI-skrevet post-utkast.
 *
 * Liste over drafts grupert per status (draft/edited/published/failed).
 * Per draft: inline edit (caption + hashtags + CTA) + publish-knapp.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Stack,
  Typography, TextField, IconButton, Tooltip, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Switch, FormControlLabel,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { adminTokens, adminSx, statusChipSx } from './styles';

interface Draft {
  id: number;
  brandKey: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
  status: 'draft' | 'edited' | 'published' | 'failed' | 'manual_copy';
  sourceInsight: string | null;
  sourceAction: string | null;
  sourceReportId: number | null;
  caption: string;
  hashtags: string[];
  imageBrief: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  suggestedPublishTime: string | null;
  generatedWithModel: string | null;
  costNok: number | null;
  generatedAt: string;
  updatedAt: string;
  publishedAt: string | null;
  externalPostId: string | null;
  publishError: string | null;
  autoPublishEnabled?: boolean;
  autoPublishAttempts?: number;
  autoPublishAttemptedAt?: string | null;
  imageUrl?: string | null;
  hasImageData?: boolean;
  videoUrl?: string | null;
  hasVideoData?: boolean;
}

const PLATFORM_META: Record<Draft['platform'], { icon: React.ReactElement; color: string; name: string }> = {
  facebook:  { icon: <FacebookIcon sx={{ fontSize: 18 }} />, color: adminTokens.platforms.facebook, name: 'Facebook' },
  instagram: { icon: <InstagramIcon sx={{ fontSize: 18 }} />, color: adminTokens.platforms.instagram, name: 'Instagram' },
  linkedin:  { icon: <LinkedInIcon sx={{ fontSize: 18 }} />, color: adminTokens.platforms.linkedin, name: 'LinkedIn' },
  tiktok:    { icon: <MusicNoteIcon sx={{ fontSize: 18 }} />, color: adminTokens.platforms.tiktok, name: 'TikTok' },
};

const STATUS_META: Record<Draft['status'], { status: keyof typeof adminTokens.status; label: string }> = {
  draft:       { status: 'neutral', label: 'Draft' },
  edited:      { status: 'info',    label: 'Edited' },
  published:   { status: 'success', label: 'Publisert' },
  failed:      { status: 'error',   label: 'Failed' },
  manual_copy: { status: 'warning', label: 'Manuell copy-paste' },
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip title={copied ? 'Kopiert!' : 'Kopier'}>
      <IconButton size="small" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      }}>
        {copied ? <CheckCircleIcon sx={{ fontSize: 14, color: adminTokens.status.success.base }} />
          : <ContentCopyIcon sx={{ fontSize: 14, color: adminTokens.primary.textBright }} />}
      </IconButton>
    </Tooltip>
  );
}

function EditDialog({
  draft, open, onClose, onSave,
}: { draft: Draft; open: boolean; onClose: () => void; onSave: (patch: Partial<Draft>) => Promise<void>; }) {
  const [caption, setCaption] = useState(draft.caption);
  const [hashtags, setHashtags] = useState((Array.isArray(draft.hashtags) ? draft.hashtags : []).join(' '));
  const [imageBrief, setImageBrief] = useState(draft.imageBrief || '');
  const [imageUrl, setImageUrl] = useState(draft.imageUrl || '');
  const [videoUrl, setVideoUrl] = useState(draft.videoUrl || '');
  const [ctaText, setCtaText] = useState(draft.ctaText || '');
  const [ctaLink, setCtaLink] = useState(draft.ctaLink || '');
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: adminTokens.bg.overlay, color: adminTokens.text.body } }}>
      <DialogTitle sx={{ color: adminTokens.text.primary, fontWeight: 800 }}>
        Rediger draft · {PLATFORM_META[draft.platform].name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <TextField label="Caption" multiline minRows={6} value={caption} onChange={(e) => setCaption(e.target.value)}
            fullWidth helperText={`${caption.length} chars`}
            sx={{ '& .MuiInputBase-root': { color: adminTokens.text.body } }} />
          <TextField label="Hashtags (space-separated)" value={hashtags} onChange={(e) => setHashtags(e.target.value)}
            fullWidth sx={{ '& .MuiInputBase-root': { color: adminTokens.text.body } }} />
          <TextField label="Image-brief (intern beskrivelse for design-bruk)" multiline minRows={2}
            value={imageBrief} onChange={(e) => setImageBrief(e.target.value)}
            fullWidth sx={{ '& .MuiInputBase-root': { color: adminTokens.text.body } }} />
          <TextField label="Image-URL (offentlig HTTP-URL, kreves for IG auto-publish)"
            value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} fullWidth
            helperText={draft.platform === 'instagram' ? 'IG container-flow trenger en URL Meta kan hente bildet fra.' : 'Valgfri — kun nødvendig for IG auto-publish.'}
            placeholder="https://cdn.example.com/post-image.jpg"
            sx={{ '& .MuiInputBase-root': { color: adminTokens.text.body } }} />
          <TextField label="Video-URL (offentlig HTTP-link til MP4, kreves for TikTok auto-publish)"
            value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} fullWidth
            helperText={draft.platform === 'tiktok' ? 'TikTok henter MP4-en fra denne URL-en for inbox-upload.' : 'Valgfri — kun nødvendig for TikTok auto-publish.'}
            placeholder="https://cdn.example.com/post-video.mp4"
            sx={{ '& .MuiInputBase-root': { color: adminTokens.text.body } }} />
          <Stack direction="row" spacing={1.5}>
            <TextField label="CTA-tekst" value={ctaText} onChange={(e) => setCtaText(e.target.value)} sx={{ flex: 1 }} />
            <TextField label="CTA-link" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} sx={{ flex: 2 }} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={adminSx.secondaryButton}>Avbryt</Button>
        <Button
          variant="contained" sx={adminSx.primaryButton}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                caption,
                hashtags: hashtags.split(/\s+/).filter(Boolean),
                imageBrief, ctaText, ctaLink,
                imageUrl: imageUrl.trim() || null,
                videoUrl: videoUrl.trim() || null,
              } as Partial<Draft>);
              onClose();
            } finally { setSaving(false); }
          }}
        >
          {saving ? 'Lagrer…' : 'Lagre'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DraftCard({ draft, onEdit, onDelete, onPublish, onToggleAutoPublish, publishBusy }: {
  draft: Draft;
  onEdit: (d: Draft) => void;
  onDelete: (id: number) => Promise<void>;
  onPublish: (id: number) => Promise<void>;
  onToggleAutoPublish: (id: number, value: boolean) => Promise<void>;
  publishBusy: boolean;
}) {
  const pmeta = PLATFORM_META[draft.platform];
  const smeta = STATUS_META[draft.status];
  return (
    <Card sx={{
      background: adminTokens.bg.panel,
      border: `1px solid ${adminTokens.border.nominal}`,
      borderLeft: `4px solid ${pmeta.color}`,
    }} data-testid={`draft-card-${draft.id}`}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: `${pmeta.color}26`, color: pmeta.color }}>
            {pmeta.icon}
          </Avatar>
          <Typography sx={{ fontWeight: 700, color: adminTokens.text.primary, fontSize: '0.9rem' }}>
            {pmeta.name}
          </Typography>
          <Chip label={smeta.label} size="small" sx={statusChipSx(smeta.status)} />
          <Chip label={`${draft.caption.length} chars`} size="small" sx={statusChipSx('neutral')} />
          {draft.suggestedPublishTime && (
            <Chip label={`📅 ${new Date(draft.suggestedPublishTime).toLocaleString('nb-NO', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}
              size="small" sx={statusChipSx('info')} />
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Kopier caption">
            <Box><CopyButton value={draft.caption + (draft.hashtags?.length ? '\n\n' + draft.hashtags.join(' ') : '')} /></Box>
          </Tooltip>
          <Tooltip title="Rediger">
            <IconButton size="small" onClick={() => onEdit(draft)} data-testid={`draft-edit-${draft.id}`}>
              <EditIcon sx={{ fontSize: 16, color: adminTokens.primary.textBright }} />
            </IconButton>
          </Tooltip>
          {draft.status !== 'published' && (
            <Tooltip title={draft.platform === 'facebook' ? 'Publiser til FB Page nå' : 'Marker som klar for manuell copy-paste'}>
              <IconButton size="small" onClick={() => void onPublish(draft.id)} disabled={publishBusy}
                data-testid={`draft-publish-${draft.id}`}>
                {publishBusy ? <CircularProgress size={14} /> : <RocketLaunchIcon sx={{ fontSize: 16, color: adminTokens.status.success.base }} />}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Slett">
            <IconButton size="small" onClick={() => void onDelete(draft.id)} data-testid={`draft-delete-${draft.id}`}>
              <DeleteOutlineIcon sx={{ fontSize: 16, color: adminTokens.status.error.base }} />
            </IconButton>
          </Tooltip>
        </Stack>

        {draft.sourceInsight && (
          <Typography variant="caption" sx={{
            color: adminTokens.text.muted, fontStyle: 'italic', display: 'block', mb: 0.5,
          }}>
            Fra: {draft.sourceInsight} → {draft.sourceAction?.slice(0, 100)}
          </Typography>
        )}

        <Typography variant="body2" sx={{
          color: adminTokens.text.body, whiteSpace: 'pre-wrap', lineHeight: 1.55,
          p: 1.5, borderRadius: 1, background: adminTokens.bg.panelDeep,
          border: `1px solid ${adminTokens.border.subtle}`,
        }}>
          {draft.caption}
        </Typography>

        {draft.hashtags && draft.hashtags.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
            {draft.hashtags.map((h) => (
              <Chip key={h} label={h} size="small" sx={statusChipSx('info')} />
            ))}
          </Stack>
        )}

        {draft.imageBrief && (
          <Typography variant="caption" sx={{ color: adminTokens.text.muted, display: 'block', mt: 1 }}>
            <strong>Bilde:</strong> {draft.imageBrief}
          </Typography>
        )}

        {draft.ctaText && draft.ctaLink && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <Chip label={draft.ctaText} size="small" sx={statusChipSx('warning')} />
            <Typography variant="caption" sx={{ color: adminTokens.primary.textBright }}>
              → {draft.ctaLink}
            </Typography>
          </Stack>
        )}

        {draft.status === 'published' && draft.externalPostId && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Publisert på Facebook.{' '}
            <a href={`https://www.facebook.com/${draft.externalPostId}`} target="_blank" rel="noreferrer"
              style={{ color: '#86efac' }}>
              Åpne post <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </a>
          </Alert>
        )}
        {draft.status === 'failed' && draft.publishError && (
          <Alert severity="error" sx={{ mt: 1 }}>Publish-feil: {draft.publishError}</Alert>
        )}

        {/* PR 11: Auto-publish toggle — kun synlig hvis det er en planlagt tid + ikke publisert */}
        {draft.suggestedPublishTime && draft.status !== 'published' && (
          <Box sx={{
            mt: 1.5, pt: 1.5, borderTop: `1px solid ${adminTokens.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
          }}>
            <Tooltip title={
              draft.platform === 'facebook'
                ? 'Auto-publiser til FB Page når tidspunkt nås'
                : draft.platform === 'linkedin'
                  ? 'Auto-publiser til LinkedIn UGC når tidspunkt nås'
                  : draft.platform === 'instagram'
                    ? (draft.imageUrl || draft.hasImageData
                        ? 'Auto-publiser til IG via container-flow når tidspunkt nås'
                        : 'IG krever en image URL — sett den i Rediger først')
                    : draft.platform === 'tiktok'
                      ? (draft.videoUrl || draft.hasVideoData
                          ? 'Auto-publiser til TikTok-inbox når tidspunkt nås'
                          : 'TikTok krever en video URL (MP4) — sett den i Rediger først')
                      : 'Auto-publish støttes ikke for ' + draft.platform + ' enda'
            }>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={draft.autoPublishEnabled === true}
                    onChange={(e) => void onToggleAutoPublish(draft.id, e.target.checked)}
                    disabled={
                      (draft.platform === 'instagram' && !draft.imageUrl && !draft.hasImageData) ||
                      (draft.platform === 'tiktok' && !draft.videoUrl && !draft.hasVideoData)
                    }
                    data-testid={`draft-autopublish-toggle-${draft.id}`}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: adminTokens.text.body }}>
                    Auto-publiser ved planlagt tid
                  </Typography>
                }
                sx={{ ml: 0 }}
              />
            </Tooltip>
            {draft.autoPublishEnabled && (draft.autoPublishAttempts ?? 0) > 0 && (
              <Chip
                label={`${draft.autoPublishAttempts} forsøk${draft.autoPublishAttempts === 1 ? '' : ''}`}
                size="small"
                sx={statusChipSx((draft.autoPublishAttempts ?? 0) >= 3 ? 'error' : 'warning')}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function PostDraftsPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [publishBusy, setPublishBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/role-room/agent/post-drafts?brandKey=theroleroom&limit=50', { credentials: 'include' });
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const d = await r.json();
      setDrafts(Array.isArray(d.drafts) ? d.drafts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Listen for compose-events from CompetitorReportPanel so we reload immediately
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('role-room:draft-composed', handler);
    return () => window.removeEventListener('role-room:draft-composed', handler);
  }, [load]);

  const savePatch = useCallback(async (id: number, patch: Partial<Draft>) => {
    const r = await fetch(`/api/role-room/agent/post-drafts/${id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const d = await r.json();
    if (d.ok) {
      setNotice({ kind: 'success', msg: 'Lagret.' });
      void load();
    } else {
      setNotice({ kind: 'error', msg: d.error || 'Save failed' });
    }
  }, [load]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Slett draft?')) return;
    try {
      const r = await fetch(`/api/role-room/agent/post-drafts/${id}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json();
      if (d.ok) { setNotice({ kind: 'success', msg: 'Slettet.' }); void load(); }
      else setNotice({ kind: 'error', msg: d.error || 'Delete failed' });
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    }
  }, [load]);

  const handleToggleAutoPublish = useCallback(async (id: number, value: boolean) => {
    try {
      const r = await fetch(`/api/role-room/agent/post-drafts/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPublishEnabled: value }),
      });
      const d = await r.json();
      if (d.ok) {
        setNotice({ kind: 'success', msg: value ? 'Auto-publish slått PÅ — trigges ved planlagt tid.' : 'Auto-publish slått AV.' });
        void load();
      } else {
        setNotice({ kind: 'error', msg: d.error || 'Toggle failed' });
      }
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    }
  }, [load]);

  const handlePublish = useCallback(async (id: number) => {
    setPublishBusy(id);
    try {
      const r = await fetch(`/api/role-room/agent/post-drafts/${id}/publish`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json();
      if (d.ok && d.status === 'published') {
        setNotice({ kind: 'success', msg: `Publisert på FB Page. Permalink: ${d.permalink}` });
      } else if (d.status === 'manual_copy') {
        setNotice({ kind: 'success', msg: d.message || 'Marker som manuell.' });
      } else {
        setNotice({ kind: 'error', msg: d.error || 'Publish failed' });
      }
      void load();
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally { setPublishBusy(null); }
  }, [load]);

  return (
    <Card sx={adminSx.panel} data-testid="panel-post-drafts">
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: 1,
            background: adminTokens.primary.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EditNoteIcon sx={{ color: adminTokens.primary.textBright, fontSize: 18 }} />
          </Box>
          <Typography sx={adminSx.sectionHeader}>Post-drafts</Typography>
          <Chip label={`${drafts.length} totalt`} size="small" sx={statusChipSx('neutral')} />
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()}
            sx={adminSx.secondaryButton} data-testid="drafts-refresh">
            Refresh
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {notice && (
          <Alert severity={notice.kind} sx={{ mb: 1 }} onClose={() => setNotice(null)} data-testid="drafts-notice">
            {notice.msg}
          </Alert>
        )}

        {drafts.length === 0 && !loading && (
          <Alert severity="info" data-testid="drafts-empty"
            sx={{
              background: 'rgba(59,130,246,0.08)',
              border: `1px solid ${adminTokens.status.info.border}`,
              color: adminTokens.status.info.text,
              '& .MuiAlert-icon': { color: adminTokens.status.info.base },
            }}>
            Ingen drafts ennå. Klikk "Skriv dette innlegget"-knappen ved siden av et `actionableStep` i AI-rapporten over for å lage et utkast (~0.12 NOK).
          </Alert>
        )}

        <Stack spacing={1.5}>
          {drafts.map((d) => (
            <DraftCard
              key={d.id} draft={d}
              onEdit={(d) => setEditing(d)}
              onDelete={handleDelete}
              onPublish={handlePublish}
              onToggleAutoPublish={handleToggleAutoPublish}
              publishBusy={publishBusy === d.id}
            />
          ))}
        </Stack>

        {editing && (
          <EditDialog
            draft={editing} open={!!editing}
            onClose={() => setEditing(null)}
            onSave={(patch) => savePatch(editing.id, patch)}
          />
        )}
      </CardContent>
    </Card>
  );
}
