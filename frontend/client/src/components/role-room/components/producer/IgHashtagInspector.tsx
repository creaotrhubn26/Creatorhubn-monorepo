/**
 * Meta App Review — instagram_public_content_access demo panel.
 *
 * Producer types a hashtag (e.g. a client's campaign tag), clicks
 * Search. Backend resolves the hashtag via /ig_hashtag_search and
 * then fetches top media via /{hashtag-id}/top_media, returning up
 * to 9 posts with thumbnails + like/comment counts. Rendered as a
 * 3x3 grid so producers can skim public sentiment and engagement
 * around the tag before shaping their own creative.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Container, Divider, Grid, Stack,
  TextField, Typography,
} from '@mui/material';
import TagIcon from '@mui/icons-material/Tag';
import LaunchIcon from '@mui/icons-material/Launch';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useAuth } from '@/hooks/useAuth';

interface HashtagPost {
  id: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  caption: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  timestamp: string | null;
}

interface HashtagResult {
  hashtag: { id: string | null; name: string };
  posts: HashtagPost[];
  meta: { graphVersion: string; resolvedFrom: string; igUserId?: string };
}

export function IgHashtagInspector() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HashtagResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectRequired, setConnectRequired] = useState(false);
  const [context, setContext] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{
    hashtag: string;
    reasoning: string;
    hashtagId: string | null;
    topMediaPreview: string | null;
    validationError: string | null;
  }>>([]);

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

  const searchAbortRef = useRef<AbortController | null>(null);
  const handleSearch = async (override?: string) => {
    const query = (override ?? input).trim();
    if (!query) return;
    // Cancel any in-flight typeahead call so the latest keystroke wins.
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setConnectRequired(false);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const tok = resolveAuthToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      const response = await fetch('/api/role-room/agent/ig-hashtag-inspect', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ hashtag: query }),
        signal: ctrl.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body?.connectRequired) setConnectRequired(true);
        setError(body?.error || `HTTP ${response.status}`);
        return;
      }
      setResult(body as HashtagResult);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // newer keystroke superseded
      setError(e instanceof Error ? e.message : 'Request feilet');
    } finally {
      if (searchAbortRef.current === ctrl) setLoading(false);
    }
  };

  // Typeahead: debounced auto-search while the producer types. Needs
  // at least 2 chars + a-z0-9/_ to avoid hitting Meta's rate limit on
  // every empty/invalid keystroke.
  useEffect(() => {
    const trimmed = input.trim().replace(/^#/, '');
    if (trimmed.length < 2) {
      setResult(null);
      return;
    }
    if (!/^[a-z0-9_]+$/i.test(trimmed)) return;
    const handle = setTimeout(() => { void handleSearch(trimmed); }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const handleSuggest = async () => {
    if (!context.trim()) return;
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions([]);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const tok = resolveAuthToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      const response = await fetch('/api/role-room/agent/hashtag-suggest', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ context: context.trim(), count: 10 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSuggestError(body?.error || `HTTP ${response.status}`);
        return;
      }
      setSuggestions(body?.candidates || []);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : 'Suggest feilet');
    } finally {
      setSuggesting(false);
    }
  };

  const handleConnect = async () => {
    try {
      const headers: Record<string, string> = {};
      const tok = resolveAuthToken();
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
      const response = await fetch(
        `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent('ig-hashtag-demo')}`,
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

  const fmtNum = (n: number | null) =>
    typeof n === 'number' ? n.toLocaleString('en-US') : '—';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3} data-testid="ig-hashtag-inspector-root">
        <Box>
          <Chip label="Meta App Review Demo" color="primary" size="small" sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Instagram Hashtag Search
          </Typography>
          <Typography variant="body1" color="text.secondary">
            CreatorHub One uses the Instagram Public Content Access feature so producers can
            track campaign hashtags, gauge public sentiment, and discover UGC tied to a
            client&apos;s brand. Type a hashtag — we resolve it via the Hashtag Search endpoint,
            then fetch up to 9 top posts with their engagement counts.
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={2}>
          <TextField
            label="Hashtag (with or without #)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            fullWidth
            placeholder="creatorhub"
            inputProps={{ 'data-testid': 'ig-hashtag-input' }}
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={() => handleSearch()}
              disabled={loading || !input.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <TagIcon />}
              data-testid="ig-hashtag-submit"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {loading ? 'Calling Meta Graph API…' : 'Search hashtag'}
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
            Calls <code>GET /ig_hashtag_search?q=&#123;tag&#125;</code> then
            {' '}<code>GET /&#123;hashtag-id&#125;/top_media</code> on Meta Graph API v21.0
            with the admin&apos;s Instagram Business Account as user_id.
          </Typography>
        </Stack>

        {error ? (
          <Alert severity={connectRequired ? 'warning' : 'error'}>{error}</Alert>
        ) : null}

        <Divider sx={{ opacity: 0.4 }}>
          <Chip label="AI-foreslåtte hashtags" size="small" icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />} />
        </Divider>

        <Stack spacing={1.5}>
          <TextField
            label="Innhold / brief / tema"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Lim inn caption-utkast, tema, produkt eller målgruppe…"
            inputProps={{ 'data-testid': 'ig-hashtag-context' }}
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleSuggest}
              disabled={suggesting || !context.trim()}
              startIcon={suggesting ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              data-testid="ig-hashtag-suggest"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {suggesting ? 'Genererer forslag…' : 'Foreslå hashtags (AI + Meta)'}
            </Button>
          </Stack>
          {suggestError ? <Alert severity="error">{suggestError}</Alert> : null}
          {suggestions.length > 0 ? (
            <Stack
              data-testid="ig-hashtag-suggestions"
              direction="row"
              spacing={0.8}
              flexWrap="wrap"
              useFlexGap
              sx={{ gap: 0.8 }}
            >
              {suggestions.map((s) => (
                <Chip
                  key={s.hashtag}
                  label={`#${s.hashtag}${s.hashtagId ? ' ✓' : ''}`}
                  onClick={() => { setInput(s.hashtag); void handleSearch(s.hashtag); }}
                  color={s.hashtagId ? 'primary' : 'default'}
                  variant={s.hashtagId ? 'filled' : 'outlined'}
                  title={`${s.reasoning}${s.hashtagId ? ` — klikk for å se top_media` : s.validationError ? ` (${s.validationError})` : ''}`}
                  clickable
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>

        {result ? (
          <Box
            data-testid="ig-hashtag-result"
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1.5px solid rgba(221,42,123,0.45)',
              background: 'linear-gradient(180deg, rgba(221,42,123,0.12), rgba(8,15,30,0.45))',
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="overline" sx={{ color: '#f9a8d4', letterSpacing: '0.22em', fontWeight: 800 }}>
                  Top media for
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  #{result.hashtag.name}
                </Typography>
                {result.hashtag.id ? (
                  <Chip size="small" label={`id ${result.hashtag.id}`} sx={{ bgcolor: 'rgba(221,42,123,0.18)', color: '#fbcfe8' }} />
                ) : null}
              </Stack>
              {result.posts.length === 0 ? (
                <Alert severity="info">
                  Meta Graph API fant ingen top_media for denne hashtaggen — den eksisterer kanskje ikke,
                  eller har ingen public posts. Dette er fortsatt en gyldig instagram_public_content_access-kall.
                </Alert>
              ) : (
                <Grid container spacing={1.5}>
                  {result.posts.map((p, idx) => (
                    <Grid item xs={6} sm={4} key={p.id || idx}>
                      <Box
                        sx={{
                          position: 'relative',
                          aspectRatio: '1 / 1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: 'rgba(15,23,42,0.55)',
                          border: '1px solid rgba(221,42,123,0.28)',
                        }}
                      >
                        {p.thumbnailUrl || p.mediaUrl ? (
                          <Box
                            component="img"
                            src={p.thumbnailUrl || p.mediaUrl || ''}
                            alt={p.caption?.slice(0, 40) || 'IG post'}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box sx={{ p: 1.5, color: '#cbd5e1', fontSize: '0.78rem' }}>
                            {p.mediaType || '(no media)'}
                          </Box>
                        )}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            p: 0.8,
                            background: 'linear-gradient(180deg, transparent, rgba(2,6,23,0.85))',
                            color: '#f8fafc',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            ♥ {fmtNum(p.likeCount)} · 💬 {fmtNum(p.commentsCount)}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
              <Divider sx={{ opacity: 0.3 }} />
              <Typography variant="caption" color="text.secondary">
                Resolved <code>{result.meta.resolvedFrom}</code> → hashtag id <code>{result.hashtag.id}</code> via
                Meta Graph API <code>{result.meta.graphVersion}</code>. Rendered as campaign-insight tiles
                for the producer to skim top-engagement creative before shaping their own post.
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}

export default IgHashtagInspector;
