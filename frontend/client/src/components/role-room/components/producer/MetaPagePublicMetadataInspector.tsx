/**
 * Meta App Review — Page Public Metadata Access demo page.
 *
 * Self-contained page at /meta-page-inspector that demonstrates the
 * PPMA feature to Meta's review team. Reviewer watches a recorded
 * screencast that:
 *   1. Loads this page
 *   2. Pastes a Facebook Page URL
 *   3. Clicks "Inspect public metadata"
 *   4. Sees the Graph API response rendered as public Page fields
 *
 * Pre-review (this submission): the backend uses the admin's connected
 * Meta user access token with `pages_read_engagement`, so the demo
 * works on Pages where the caller has a role.
 *
 * Post-approval: backend switches to the app access token path and the
 * same UI works on any public Page.
 */
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import LaunchIcon from '@mui/icons-material/Launch';
import VerifiedIcon from '@mui/icons-material/Verified';

interface InspectResult {
  page: {
    id: string;
    name: string | null;
    fanCount: number | null;
    followersCount: number | null;
    category: string | null;
    categoryList: Array<{ id?: string; name?: string }> | null;
    about: string | null;
    website: string | null;
    link: string | null;
    verificationStatus: string | null;
  };
  meta: {
    resolvedFrom: string;
    resolvedTo: string;
    graphVersion: string;
  };
}

export function MetaPagePublicMetadataInspector() {
  const { user } = useAuth();
  const [input, setInput] = useState('https://www.facebook.com/creatorhubn/');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectRequired, setConnectRequired] = useState(false);

  const handleInspect = async () => {
    setLoading(true);
    setError(null);
    setConnectRequired(false);
    setResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user?.id) headers['Authorization'] = `Bearer ${user.id}`;
      const response = await fetch('/api/role-room/agent/meta-page-inspect', {
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
      setResult(body as InspectResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request feilet');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const projectId = 'meta-demo';
    try {
      const headers: Record<string, string> = {};
      if (user?.id) headers['Authorization'] = `Bearer ${user.id}`;
      const response = await fetch(
        `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent(projectId)}`,
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

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3} data-testid="meta-page-inspector-root">
        <Box>
          <Chip
            label="Meta App Review Demo"
            color="primary"
            size="small"
            sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }}
          />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Page Public Metadata Access
          </Typography>
          <Typography variant="body1" color="text.secondary">
            CreatorHub One uses this endpoint to let content producers inspect a competitor or
            reference Facebook Page&apos;s publicly documented metadata — category, fan count,
            verification status, About text — and render it inside the Competitor Intelligence
            workflow. Paste a Facebook Page URL below to demonstrate the call.
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
            inputProps={{ 'data-testid': 'meta-inspect-input' }}
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={handleInspect}
              disabled={loading || !input.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FactCheckIcon />}
              data-testid="meta-inspect-submit"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {loading ? 'Kaller Meta Graph API…' : 'Inspect public metadata'}
            </Button>
            {connectRequired ? (
              <Button
                variant="outlined"
                size="large"
                onClick={handleConnect}
                startIcon={<LaunchIcon />}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Connect Facebook
              </Button>
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Calls <code>GET /&#123;page-id&#125;?fields=fan_count,followers_count,category,about,verification_status,link</code> on
            Meta Graph API v21.0 with the signed-in admin&apos;s Meta user access token.
          </Typography>
        </Stack>

        {error ? (
          <Alert severity={connectRequired ? 'warning' : 'error'}>{error}</Alert>
        ) : null}

        {result ? (
          <Box
            data-testid="meta-inspect-result"
            sx={{
              p: 3,
              borderRadius: 3,
              border: '1.5px solid rgba(59,130,246,0.45)',
              background: 'linear-gradient(180deg, rgba(30,58,138,0.15), rgba(8,15,30,0.45))',
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="overline" sx={{ color: '#93c5fd', letterSpacing: '0.22em', fontWeight: 800 }}>
                  Meta Page Public Metadata
                </Typography>
                {result.page.verificationStatus === 'blue_verified' || result.page.verificationStatus === 'gray_verified' ? (
                  <Chip
                    icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
                    size="small"
                    label={result.page.verificationStatus.replace('_', ' ')}
                    sx={{ bgcolor: 'rgba(29,161,242,0.22)', color: '#bfdbfe', fontSize: '0.7rem' }}
                  />
                ) : null}
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {result.page.name ?? '(unnamed Page)'}
              </Typography>

              <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
                {typeof result.page.followersCount === 'number' ? (
                  <Chip label={`${result.page.followersCount.toLocaleString('en-US')} followers`} sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#bfdbfe' }} />
                ) : null}
                {typeof result.page.fanCount === 'number' ? (
                  <Chip label={`${result.page.fanCount.toLocaleString('en-US')} fans`} sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#bfdbfe' }} />
                ) : null}
                {result.page.category ? (
                  <Chip label={`Category: ${result.page.category}`} variant="outlined" />
                ) : null}
              </Stack>

              {result.page.about ? (
                <Box>
                  <Typography variant="overline" sx={{ color: '#94a3b8', letterSpacing: '0.18em' }}>
                    About
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.55 }}>
                    {result.page.about}
                  </Typography>
                </Box>
              ) : null}

              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {result.page.website ? (
                  <Typography variant="caption" color="text.secondary">
                    Website: <code>{result.page.website}</code>
                  </Typography>
                ) : null}
                {result.page.link ? (
                  <Typography variant="caption" color="text.secondary">
                    Page URL: <code>{result.page.link}</code>
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  Page ID: <code>{result.page.id}</code>
                </Typography>
              </Stack>

              <Divider sx={{ opacity: 0.3 }} />
              <Typography variant="caption" color="text.secondary">
                Resolved <code>{result.meta.resolvedFrom}</code> → <code>{result.meta.resolvedTo}</code> via
                Meta Graph API <code>{result.meta.graphVersion}</code>. This data is rendered inside
                CreatorHub One&apos;s Competitor Intelligence view for content producers.
              </Typography>
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
}

export default MetaPagePublicMetadataInspector;
