/**
 * Meta App Review — Page Public Content Access demo panel.
 *
 * Producer pastes a Facebook Page URL or ID. Backend resolves the
 * page id and fetches 5 most recent posts + videos via Meta Graph
 * API. Rendered as two scannable lists so producers can skim a
 * reference brand's recent content cadence + topics + attachments
 * before shaping their own post.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, Stack,
  TextField, Typography,
} from '@mui/material';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import LaunchIcon from '@mui/icons-material/Launch';
import { useAuth } from '@/hooks/useAuth';

interface ContentPost {
  id: string | null;
  message: string | null;
  createdTime: string | null;
  permalinkUrl: string | null;
  fullPicture: string | null;
  attachments: any[];
}
interface ContentVideo {
  id: string | null;
  title: string | null;
  description: string | null;
  createdTime: string | null;
  permalinkUrl: string | null;
  source: string | null;
  picture: string | null;
}
interface ContentResult {
  posts: ContentPost[];
  videos: ContentVideo[];
  meta: { resolvedFrom: string; resolvedTo: string; graphVersion: string };
}

export function PagePublicContentInspector() {
  const { user } = useAuth();
  const [input, setInput] = useState('https://www.facebook.com/creatorhubn/');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectRequired, setConnectRequired] = useState(false);

  const resolveAuthToken = (): string | null => {
    try {
      const rr = localStorage.getItem('role_room_auth_token');
      if (rr) return rr;
      const rrSession = localStorage.getItem('role_room_auth_session');
      if (rrSession) {
        const parsed = JSON.parse(rrSession);
        const id = parsed?.adminUser?.id || parsed?.user?.id || parsed?.id;
        if (id) return id;
      }
      const ch = localStorage.getItem('creatorhub_auth_token');
      if (ch) return ch;
    } catch { /* ignore */ }
    return user?.id || null;
  };

  const handleInspect = async () => {
    setLoading(true);
    setError(null);
    setConnectRequired(false);
    setResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const tok = resolveAuthToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      const response = await fetch('/api/role-room/agent/page-content-inspect', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ pageIdOrUrl: input }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.connectRequired) setConnectRequired(true);
        setError(body?.error || `HTTP ${response.status}`);
        return;
      }
      setResult(body as ContentResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request feilet');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const headers: Record<string, string> = {};
      const tok = resolveAuthToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      const response = await fetch(
        `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent('ppca-demo')}`,
        { headers, credentials: 'include' },
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

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3} data-testid="page-content-inspector-root">
        <Box>
          <Chip label="Meta App Review Demo" color="primary" size="small" sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Page Public Content Access
          </Typography>
          <Typography variant="body1" color="text.secondary">
            CreatorHub One uses Page Public Content Access to let producers skim a reference
            brand&apos;s 5 most recent Facebook Page posts + videos — their publishing cadence,
            messaging, attachments and picture style — before shaping their own creative for
            a client. Paste a Facebook Page URL below.
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={2}>
          <TextField
            label="Facebook Page URL or ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            fullWidth
            placeholder="https://www.facebook.com/creatorhubn/"
            inputProps={{ 'data-testid': 'page-content-input' }}
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={handleInspect}
              disabled={loading || !input.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RssFeedIcon />}
              data-testid="page-content-submit"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {loading ? 'Calling Meta Graph API…' : 'Fetch recent posts + videos'}
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
            Calls <code>GET /&#123;page-id&#125;/posts</code> and <code>GET /&#123;page-id&#125;/videos</code>
            on Meta Graph API v21.0 with the admin&apos;s user access token + pages_read_engagement
            + Page Public Content Access feature.
          </Typography>
        </Stack>

        {error ? (
          <Alert severity={connectRequired ? 'warning' : 'error'}>{error}</Alert>
        ) : null}

        {result ? (
          <Stack
            spacing={2.5}
            data-testid="page-content-result"
          >
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1.5px solid rgba(16,185,129,0.4)', bgcolor: 'rgba(6,95,70,0.12)' }}>
              <Typography variant="overline" sx={{ color: '#6ee7b7', letterSpacing: '0.2em', fontWeight: 800 }}>
                Recent posts ({result.posts.length})
              </Typography>
              {result.posts.length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Ingen nylige posts returnert — Page har kanskje kun video-innhold eller er tom.
                </Alert>
              ) : (
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {result.posts.map((p, idx) => (
                    <Box key={p.id ?? `post-${idx}`} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                        {p.fullPicture ? (
                          <Box component="img" src={p.fullPicture} alt="post"
                            sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }} />
                        ) : null}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">{fmtDate(p.createdTime)}</Typography>
                          <Typography sx={{ mt: 0.3, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                            {(p.message ?? '(no caption)').slice(0, 220)}
                            {(p.message?.length ?? 0) > 220 ? '…' : ''}
                          </Typography>
                          {p.permalinkUrl ? (
                            <Typography variant="caption" sx={{ mt: 0.4, display: 'block' }}>
                              <a href={p.permalinkUrl} target="_blank" rel="noreferrer" style={{ color: '#6ee7b7' }}>
                                View on facebook.com <LaunchIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                              </a>
                            </Typography>
                          ) : null}
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Box sx={{ p: 2, borderRadius: 2.5, border: '1.5px solid rgba(59,130,246,0.4)', bgcolor: 'rgba(30,58,138,0.12)' }}>
              <Typography variant="overline" sx={{ color: '#93c5fd', letterSpacing: '0.2em', fontWeight: 800 }}>
                Recent videos ({result.videos.length})
              </Typography>
              {result.videos.length === 0 ? (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Ingen nylige videos returnert — Page har kanskje ikke video-innhold.
                </Alert>
              ) : (
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {result.videos.map((v, idx) => (
                    <Box key={v.id ?? `video-${idx}`} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                        {v.picture ? (
                          <Box component="img" src={v.picture} alt="video"
                            sx={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }} />
                        ) : null}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="caption" color="text.secondary">{fmtDate(v.createdTime)}</Typography>
                          <Typography sx={{ mt: 0.3, fontWeight: 700, fontSize: '0.92rem' }}>
                            {v.title ?? '(untitled video)'}
                          </Typography>
                          {v.description ? (
                            <Typography sx={{ mt: 0.3, whiteSpace: 'pre-wrap', fontSize: '0.85rem' }} color="text.secondary">
                              {v.description.slice(0, 200)}{v.description.length > 200 ? '…' : ''}
                            </Typography>
                          ) : null}
                          {v.permalinkUrl ? (
                            <Typography variant="caption" sx={{ mt: 0.4, display: 'block' }}>
                              <a href={v.permalinkUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
                                View on facebook.com <LaunchIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                              </a>
                            </Typography>
                          ) : null}
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              Resolved <code>{result.meta.resolvedFrom}</code> → <code>{result.meta.resolvedTo}</code> via
              Meta Graph API <code>{result.meta.graphVersion}</code>. Rendered inside the CreatorHub One
              Producer workflow for reference-brand content analysis.
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}

export default PagePublicContentInspector;
