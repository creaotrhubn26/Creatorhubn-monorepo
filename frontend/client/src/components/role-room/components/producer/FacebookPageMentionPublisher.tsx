/**
 * Meta App Review — Page Mentions demo panel.
 *
 * Producer picks one of their own Facebook Pages as the author,
 * writes a post body, enters the Page ID of another Page to mention,
 * and clicks Publish. Backend appends the `@[PAGE_ID]` in-line
 * mention syntax to the message and POSTs to /{page-id}/feed. Meta
 * renders the result as a clickable Page mention in the feed post,
 * which the reviewer can verify via the returned permalink.
 */
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, MenuItem, Stack,
  TextField, Typography,
} from '@mui/material';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
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
  post: {
    id: string | null;
    pageId: string;
    mentionedPageId: string;
    message: string;
    permalink: string | null;
    graphUrl: string | null;
  };
}

export function FacebookPageMentionPublisher() {
  const { user } = useAuth();
  const [pages, setPages] = useState<FbPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [message, setMessage] = useState(
    'Takk for godt samarbeid — Page Mention-demo for CreatorHub One (Meta App Review).',
  );
  const [mentionedPageId, setMentionedPageId] = useState('');
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

  const handlePublish = async () => {
    if (!selectedPageId || !message.trim() || !mentionedPageId.trim()) return;
    setPublishing(true);
    setError(null);
    setConnectRequired(false);
    setResult(null);
    try {
      const response = await fetch('/api/role-room/facebook/publish-page-post', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          pageId: selectedPageId,
          message: message.trim(),
          mentionedPageId: mentionedPageId.trim(),
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
        `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent('page-mention-demo')}`,
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

  const preview = message.trim() && mentionedPageId.trim()
    ? `${message.trim()} @[${mentionedPageId.trim()}]`
    : '';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3} data-testid="fb-page-mention-root">
        <Box>
          <Chip label="Meta App Review Demo" color="primary" size="small" sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Page Mentions
          </Typography>
          <Typography variant="body1" color="text.secondary">
            CreatorHub One lets producers mention partner, supplier, venue or
            collaborator Facebook Pages in client Page posts — e.g. a bakery
            thanking its flour supplier Page, or a studio crediting a
            collaborator Page on the client&apos;s announcement post. Pick the
            author Page, write the post body, and enter the numeric Page ID
            of the Page to mention. The final message uses Meta&apos;s
            <code> @[PAGE_ID]</code> in-line syntax.
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={2}>
          <TextField
            select
            label="Author Facebook Page"
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            fullWidth
            disabled={pagesLoading || pages.length === 0}
            inputProps={{ 'data-testid': 'fb-mention-author-page' }}
          >
            {pages.length === 0 ? (
              <MenuItem value="">(No admin pages found — click Re-connect)</MenuItem>
            ) : pages.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name || '(unnamed)'} — {p.category || 'Page'} ({p.id})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Post message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ 'data-testid': 'fb-mention-message' }}
          />

          <TextField
            label="Mention this Page (numeric Page ID)"
            value={mentionedPageId}
            onChange={(e) => setMentionedPageId(e.target.value.replace(/\D/g, ''))}
            fullWidth
            placeholder="e.g. 113187348710914"
            helperText="Find any public Facebook Page's numeric id via Graph API Explorer or the 'About' tab on facebook.com."
            inputProps={{ 'data-testid': 'fb-mention-target-id' }}
          />

          {preview ? (
            <Box
              data-testid="fb-mention-preview"
              sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.55)', border: '1px dashed rgba(59,130,246,0.35)' }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.14em', fontWeight: 700 }}>
                WILL PUBLISH AS
              </Typography>
              <Typography sx={{ mt: 0.6, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                {preview}
              </Typography>
            </Box>
          ) : null}

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={handlePublish}
              disabled={publishing || !selectedPageId || !message.trim() || !mentionedPageId.trim()}
              startIcon={publishing ? <CircularProgress size={18} color="inherit" /> : <AlternateEmailIcon />}
              data-testid="fb-mention-submit"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {publishing ? 'Publishing to Facebook…' : 'Publish Page post with mention'}
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
            Calls <code>POST /&#123;page-id&#125;/feed</code> on Meta Graph API v21.0 with
            the Page-scoped access token. Meta renders <code>@[PAGE_ID]</code> as a
            clickable Page mention in the published post.
          </Typography>
        </Stack>

        {error ? (
          <Alert severity={connectRequired ? 'warning' : 'error'}>{error}</Alert>
        ) : null}

        {result ? (
          <Box
            data-testid="fb-mention-result"
            sx={{ p: 2, borderRadius: 2.5, border: '1.5px solid rgba(16,185,129,0.4)', bgcolor: 'rgba(6,95,70,0.12)' }}
          >
            <Typography variant="overline" sx={{ color: '#6ee7b7', letterSpacing: '0.2em', fontWeight: 800 }}>
              Page post published with mention
            </Typography>
            <Stack spacing={0.6} sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: '0.9rem' }}>
                <strong>post_id:</strong> <code>{result.post.id ?? '(missing)'}</code>
              </Typography>
              <Typography sx={{ fontSize: '0.9rem' }}>
                <strong>Author Page:</strong> <code>{result.post.pageId}</code>
              </Typography>
              <Typography sx={{ fontSize: '0.9rem' }}>
                <strong>Mentioned Page:</strong> <code>{result.post.mentionedPageId}</code>
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                <strong>Rendered message:</strong>
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {result.post.message}
              </Typography>
              {result.post.permalink ? (
                <Typography sx={{ mt: 0.6, fontSize: '0.9rem' }}>
                  <a href={result.post.permalink} target="_blank" rel="noreferrer" style={{ color: '#6ee7b7' }}>
                    Open on facebook.com <LaunchIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                  </a>
                </Typography>
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}

export default FacebookPageMentionPublisher;
