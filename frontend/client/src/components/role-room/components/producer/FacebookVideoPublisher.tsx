/**
 * Meta App Review — publish_video + pages_manage_posts demo panel.
 *
 * Producer picks a Facebook Page they admin, selects a video file,
 * optionally adds a description, clicks Publish. Backend fetches the
 * Page access token via /me/accounts, uploads the video to
 * /{page-id}/videos, and returns the new video id. UI renders the
 * video id + a link to facebook.com/{video_id} so the reviewer can
 * verify the post landed on the Page.
 */
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, MenuItem, Stack,
  TextField, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LaunchIcon from '@mui/icons-material/Launch';
import { useAuth } from '@/hooks/useAuth';

interface FbPage {
  id: string;
  name: string | null;
  category: string | null;
  tasks: string[];
  hasPageToken: boolean;
}

interface PublishResult {
  video: {
    id: string | null;
    pageId: string;
    permalink: string | null;
    graphUrl: string | null;
    sizeBytes: number;
    mimeType: string;
  };
}

export function FacebookVideoPublisher() {
  const { user } = useAuth();
  const [pages, setPages] = useState<FbPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [description, setDescription] = useState('CreatorHub One demo publish — Meta App Review end-to-end test.');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectRequired, setConnectRequired] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  const resolveAuthToken = (): string | null => {
    try {
      const rrToken = localStorage.getItem('role_room_auth_token');
      if (rrToken) return rrToken;
      const rrSession = localStorage.getItem('role_room_auth_session');
      if (rrSession) {
        const parsed = JSON.parse(rrSession);
        const id = parsed?.adminUser?.id || parsed?.user?.id || parsed?.id;
        if (id) return id;
      }
      const chToken = localStorage.getItem('creatorhub_auth_token');
      if (chToken) return chToken;
      const chUser = localStorage.getItem('creatorhub_auth_user');
      if (chUser) {
        const id = JSON.parse(chUser)?.id;
        if (id) return id;
      }
    } catch { /* fall through */ }
    return user?.id || null;
  };

  const authHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = resolveAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadPages = async () => {
    setPagesLoading(true);
    setError(null);
    setConnectRequired(false);
    try {
      const response = await fetch('/api/role-room/facebook/pages', {
        method: 'GET',
        headers: authHeaders(),
        credentials: 'include',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.connectRequired) setConnectRequired(true);
        setError(body?.error || `HTTP ${response.status}`);
        return;
      }
      setPages(body.pages || []);
      if (body.pages?.length > 0 && !selectedPageId) {
        setSelectedPageId(body.pages[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request feilet');
    } finally {
      setPagesLoading(false);
    }
  };

  useEffect(() => { void loadPages(); /* eslint-disable-next-line */ }, []);

  const handleVideoSelect = async (file: File | null) => {
    if (!file) return;
    if (file.size > 90 * 1024 * 1024) {
      setError('Velg en video under 90 MB for review-demoen.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setVideoDataUrl(typeof reader.result === 'string' ? reader.result : null);
      setVideoFileName(file.name);
    };
    reader.onerror = () => setError('Kunne ikke lese video-filen.');
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    if (!selectedPageId || !videoDataUrl) return;
    setPublishing(true);
    setError(null);
    setConnectRequired(false);
    setResult(null);
    try {
      const response = await fetch('/api/role-room/facebook/publish-video', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          pageId: selectedPageId,
          videoDataUrl,
          description,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.connectRequired) setConnectRequired(true);
        setError(body?.error || `HTTP ${response.status}`);
        return;
      }
      setResult(body as PublishResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish feilet');
    } finally {
      setPublishing(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch(
        `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent('fb-video-demo')}`,
        { headers: authHeaders(), credentials: 'include' },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.url) {
        setError(body?.error || `Kunne ikke starte Meta OAuth (${response.status})`);
        return;
      }
      window.location.href = body.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect-feilet');
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3} data-testid="fb-video-publisher-root">
        <Box>
          <Chip label="Meta App Review Demo" color="primary" size="small" sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Publish Video to Facebook Page
          </Typography>
          <Typography variant="body1" color="text.secondary">
            CreatorHub One uses the publish_video + pages_manage_posts permissions so producers
            can schedule and publish client video content directly to the client&apos;s Facebook
            Page from inside the Feed Planner — without leaving the production workflow. Pick
            a Page you administer, choose a local video file, optionally add a caption, and
            click Publish.
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={2}>
          <TextField
            select
            label="Facebook Page"
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            fullWidth
            disabled={pagesLoading || pages.length === 0}
            inputProps={{ 'data-testid': 'fb-page-select' }}
          >
            {pages.length === 0 ? (
              <MenuItem value="">(No admin pages found — click Re-connect)</MenuItem>
            ) : pages.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name || '(unnamed)'} — {p.category || 'Page'} ({p.id})
              </MenuItem>
            ))}
          </TextField>

          <Box
            component="label"
            sx={{
              p: 2.5,
              border: '1.5px dashed rgba(148,163,184,0.35)',
              borderRadius: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              '&:hover': { borderColor: '#22d3ee' },
            }}
          >
            <CloudUploadIcon sx={{ color: '#22d3ee' }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>
                {videoFileName ?? 'Select video file…'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                mp4 or mov, &lt;90 MB, 9:16 or 16:9 recommended.
              </Typography>
            </Box>
            <input
              type="file"
              accept="video/*"
              hidden
              data-testid="fb-video-file-input"
              onChange={(e) => handleVideoSelect(e.target.files?.[0] ?? null)}
            />
          </Box>

          <TextField
            label="Description / caption"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ 'data-testid': 'fb-video-description' }}
          />

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={handlePublish}
              disabled={publishing || !selectedPageId || !videoDataUrl}
              startIcon={publishing ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
              data-testid="fb-video-publish-submit"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {publishing ? 'Uploading to Facebook…' : 'Publish video to Page'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={handleConnect}
              startIcon={<LaunchIcon />}
              color={connectRequired ? 'warning' : 'primary'}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {connectRequired ? 'Connect Facebook' : 'Re-connect Facebook'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Calls <code>POST /&#123;page-id&#125;/videos</code> on Meta Graph API v21.0 with
            publish_video + pages_manage_posts scopes. Page access token is retrieved per-
            request via <code>/me/accounts</code>.
          </Typography>
        </Stack>

        {error ? (
          <Alert severity={connectRequired ? 'warning' : 'error'}>{error}</Alert>
        ) : null}

        {result ? (
          <Box
            data-testid="fb-video-publish-result"
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1.5px solid rgba(59,130,246,0.45)',
              background: 'linear-gradient(180deg, rgba(30,58,138,0.15), rgba(8,15,30,0.45))',
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="overline" sx={{ color: '#93c5fd', letterSpacing: '0.22em', fontWeight: 800 }}>
                Video published to Facebook Page
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Video ID: {result.video.id ?? '(unknown)'}
              </Typography>
              {result.video.permalink ? (
                <Typography variant="body2">
                  <a href={result.video.permalink} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
                    Open on facebook.com <LaunchIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                  </a>
                </Typography>
              ) : null}
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary">
                  Page ID: <code>{result.video.pageId}</code>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Size: {(result.video.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  MIME: <code>{result.video.mimeType}</code>
                </Typography>
              </Stack>
              <Divider sx={{ opacity: 0.3 }} />
              <Typography variant="caption" color="text.secondary">
                Meta Graph API returned a valid video id, confirming the publish_video +
                pages_manage_posts flow succeeded end-to-end.
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}

export default FacebookVideoPublisher;
