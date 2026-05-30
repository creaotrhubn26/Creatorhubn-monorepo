/**
 * PostEditDialog — inline-redigering av en marketing-plan-post.
 *
 * Brukt fra MarketingPlanWorkspace's tabell. Klikk på rad → dialog
 * med kjernefelt (hook, script, caption, CTA, format, plattform,
 * dag, status). PATCH til backend ved Lagre.
 */

import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Stack, Button, Alert, Chip, Typography,
} from '@mui/material';
import roleRoomAgentService, {
  type MarketingPlanPost,
} from '../../services/roleRoomAgentService';

interface Props {
  post: MarketingPlanPost | null;
  onClose: () => void;
  onSaved: (post: MarketingPlanPost) => void;
}

const FORMAT_OPTIONS: Array<{ value: MarketingPlanPost['format']; label: string }> = [
  { value: 'reel', label: 'Reel' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'image', label: 'Bilde' },
  { value: 'story', label: 'Story' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin_post', label: 'LinkedIn-post' },
  { value: 'youtube_short', label: 'YouTube Short' },
];

const PLATFORM_OPTIONS: Array<{ value: MarketingPlanPost['primaryPlatform']; label: string }> = [
  { value: null, label: '— Ingen —' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
];

const STATUS_OPTIONS: Array<{ value: MarketingPlanPost['status']; label: string }> = [
  { value: 'proposed', label: 'Forslag' },
  { value: 'scheduled', label: 'Planlagt' },
  { value: 'published', label: 'Publisert' },
  { value: 'skipped', label: 'Hoppet over' },
];

export function PostEditDialog({ post, onClose, onSaved }: Props) {
  const [hook, setHook] = useState('');
  const [script, setScript] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [format, setFormat] = useState<MarketingPlanPost['format']>('image');
  const [primaryPlatform, setPrimaryPlatform] = useState<MarketingPlanPost['primaryPlatform']>(null);
  const [dayOffset, setDayOffset] = useState<string>('');
  const [status, setStatus] = useState<MarketingPlanPost['status']>('proposed');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;
    setHook(post.hook ?? '');
    setScript(post.script ?? '');
    setCaptionDraft(post.captionDraft ?? '');
    setCallToAction(post.callToAction ?? '');
    setFormat(post.format);
    setPrimaryPlatform(post.primaryPlatform);
    setDayOffset(post.dayOffset !== null ? String(post.dayOffset + 1) : '');
    setStatus(post.status);
    setError(null);
  }, [post]);

  const handleSave = async () => {
    if (!post) return;
    setSaving(true);
    setError(null);
    try {
      const dayNumber = dayOffset.trim() === '' ? null : Math.max(0, parseInt(dayOffset, 10) - 1);
      const updated = await roleRoomAgentService.updateMarketingPlanPost(post.id, {
        hook: hook.trim(),
        script: script.trim(),
        captionDraft: captionDraft.trim(),
        callToAction: callToAction.trim(),
        format,
        primaryPlatform,
        dayOffset: dayNumber !== null && Number.isFinite(dayNumber) ? dayNumber : null,
        status,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!post}
            onClose={onClose}
            fullWidth maxWidth="md"
            PaperProps={{
              sx: {
                bgcolor: 'rgba(15,23,42,0.98)',
                border: '1px solid rgba(236,72,153,0.32)',
                color: '#e2e8f0',
              },
            }}>
      <DialogTitle sx={{ borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Typography sx={{ color: '#ec4899', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Redigér post
          </Typography>
          {post?.dayOffset !== null && post?.dayOffset !== undefined && (
            <Chip size="small" label={`Dag ${post.dayOffset + 1}`}
                  sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9', fontWeight: 700 }} />
          )}
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField label="Hook"
                     value={hook}
                     onChange={(e) => setHook(e.target.value)}
                     multiline rows={2}
                     fullWidth
                     sx={fieldSx} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select label="Format"
                       value={format}
                       onChange={(e) => setFormat(e.target.value as MarketingPlanPost['format'])}
                       fullWidth sx={fieldSx}>
              {FORMAT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField select label="Plattform"
                       value={primaryPlatform ?? ''}
                       onChange={(e) => setPrimaryPlatform(
                         (e.target.value === '' ? null : e.target.value) as MarketingPlanPost['primaryPlatform']
                       )}
                       fullWidth sx={fieldSx}>
              {PLATFORM_OPTIONS.map(o => (
                <MenuItem key={String(o.value ?? '__none')} value={o.value ?? ''}>{o.label}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Dag (1 = startdag)"
                       value={dayOffset}
                       onChange={(e) => setDayOffset(e.target.value)}
                       type="number"
                       inputProps={{ min: 1 }}
                       fullWidth sx={fieldSx} />
            <TextField select label="Status"
                       value={status}
                       onChange={(e) => setStatus(e.target.value as MarketingPlanPost['status'])}
                       fullWidth sx={fieldSx}>
              {STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Script / beat-sheet"
                     value={script}
                     onChange={(e) => setScript(e.target.value)}
                     multiline rows={3}
                     fullWidth sx={fieldSx} />
          <TextField label="Caption-utkast"
                     value={captionDraft}
                     onChange={(e) => setCaptionDraft(e.target.value)}
                     multiline rows={3}
                     fullWidth sx={fieldSx} />
          <TextField label="Call to action"
                     value={callToAction}
                     onChange={(e) => setCallToAction(e.target.value)}
                     fullWidth sx={fieldSx} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.16)', px: 3, py: 1.6 }}>
        <Button onClick={onClose}
                disabled={saving}
                sx={{ color: 'rgba(226,232,240,0.78)' }}>
          Avbryt
        </Button>
        <Button onClick={() => void handleSave()}
                disabled={saving}
                variant="contained"
                sx={{
                  bgcolor: '#ec4899',
                  '&:hover': { bgcolor: '#db2777' },
                  fontWeight: 700, textTransform: 'none',
                }}>
          {saving ? 'Lagrer …' : 'Lagre endringer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const fieldSx = {
  '& .MuiInputBase-root': {
    color: '#e2e8f0',
    bgcolor: 'rgba(15,23,42,0.6)',
  },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#ec4899' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(236,72,153,0.45)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ec4899 !important' },
  '& .MuiSelect-icon': { color: 'rgba(226,232,240,0.6)' },
};

export default PostEditDialog;
