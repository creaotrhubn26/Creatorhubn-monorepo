/**
 * RoleRoomAgentTab — Role Room Agent's profile-recommendations UI.
 *
 * Lets the admin:
 *   1. Generate (or load cached) bio/cover/CTA-recommendations for a brand
 *   2. Copy-to-clipboard per platform field
 *   3. Auto-publish FB Page-fields (about/website/phone) via Meta API
 *   4. See publish-history-log
 *
 * Per-platform char-count badges. Copy + Publish buttons per field.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack,
  Typography, Divider, IconButton, Tooltip, TextField,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CampaignIcon from '@mui/icons-material/Campaign';
import IgDmInbox from '../../components/crm/IgDmInbox';
import AgentAdsPanel from '../../components/role-room/components/producer/AgentAdsPanel';
import WelcomeWizard from '../../components/role-room/onboarding/WelcomeWizard';

interface ProfileRecommendations {
  platforms: {
    facebook: {
      bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;
      ctaType: string; ctaLink: string; ctaReasoning: string;
    };
    instagram: {
      bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;
      linkInBio: Array<{ label: string; url: string; reasoning: string }>;
    };
    linkedin: {
      bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;
      tagline: string;
    };
    tiktok: {
      bio: string; charCount: number; recommendedHashtags: string[]; coverBrief: string;
    };
  };
  brand: {
    recommendedUsername: string;
    usernameReasoning: string;
    profilePictureBrief: string;
    primaryColorHex: string;
    voiceSummary: string;
  };
  reasoning: string;
  generatedWithModel: string;
}

interface PublishLogEntry {
  id: number;
  platform: string;
  field: string;
  value: string;
  status: 'success' | 'failed' | 'manual_copy';
  errorMessage: string | null;
  publishedAt: string;
}

const PANEL_SX = {
  background: 'rgba(2,6,23,0.42)',
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#e2e8f0',
} as const;

const PLATFORM_LIMITS: Record<string, number> = {
  facebook: 255, instagram: 150, linkedin: 2000, tiktok: 80,
};

function CharCountChip({ count, platform }: { count: number; platform: string }) {
  const limit = PLATFORM_LIMITS[platform] || 0;
  const over = count > limit;
  const close = !over && count > limit * 0.9;
  return (
    <Chip
      size="small"
      label={`${count} / ${limit}`}
      sx={{
        background: over ? 'rgba(239,68,68,0.18)' : close ? 'rgba(251,191,36,0.18)' : 'rgba(34,197,94,0.15)',
        color: over ? '#fca5a5' : close ? '#fbbf24' : '#86efac',
        fontSize: '0.7rem', height: 18,
      }}
    />
  );
}

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }, [value]);
  return (
    <Tooltip title={copied ? 'Kopiert!' : 'Kopier'}>
      <IconButton size="small" onClick={handleCopy} data-testid={testid}>
        {copied ? <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />
          : <ContentCopyIcon sx={{ fontSize: 16, color: '#7dd3fc' }} />}
      </IconButton>
    </Tooltip>
  );
}

function PlatformPanel({
  icon, name, platform, bio, charCount, hashtags, coverBrief, extra, recommendationId, onPublish, busy,
}: {
  icon: React.ReactNode;
  name: string;
  platform: string;
  bio: string;
  charCount: number;
  hashtags: string[];
  coverBrief: string;
  extra?: React.ReactNode;
  recommendationId: number | null;
  onPublish: (platform: string, field: string, value: string) => void;
  busy: string | null;
}) {
  const apiPushable = platform === 'facebook';
  const fieldName = platform === 'facebook' ? 'about' : 'bio';
  const isBusy = busy === `${platform}:${fieldName}`;
  const safeHashtags = Array.isArray(hashtags) ? hashtags : [];
  return (
    <Card sx={PANEL_SX} data-testid={`panel-${platform}`}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          {icon}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0' }}>{name}</Typography>
          <CharCountChip count={charCount} platform={platform} />
        </Stack>

        <Box sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <TextField
              value={bio}
              multiline
              fullWidth
              minRows={2}
              maxRows={platform === 'linkedin' ? 14 : 5}
              data-testid={`${platform}-bio-input`}
              InputProps={{ sx: { fontSize: '0.82rem', fontFamily: 'monospace', color: '#e2e8f0', background: 'rgba(2,6,23,0.6)' } }}
            />
            <Stack spacing={0.5}>
              <CopyButton value={bio} testid={`${platform}-bio-copy`} />
              {apiPushable && recommendationId && (
                <Tooltip title="Push til FB Page via Meta API">
                  <IconButton size="small" onClick={() => onPublish(platform, fieldName, bio)}
                    disabled={isBusy} data-testid={`${platform}-bio-publish`}>
                    {isBusy ? <CircularProgress size={16} /> : <RocketLaunchIcon sx={{ fontSize: 16, color: '#fbbf24' }} />}
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Box>

        {safeHashtags.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)', display: 'block', mb: 0.5 }}>
              Hashtags ({safeHashtags.length})
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {safeHashtags.map((h) => (
                <Chip key={h} label={h} size="small"
                  sx={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', fontSize: '0.7rem', height: 18 }} />
              ))}
              <CopyButton value={safeHashtags.join(' ')} testid={`${platform}-hashtags-copy`} />
            </Stack>
          </Box>
        )}

        {extra}

        <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)', display: 'block', mt: 1.5 }}>
          <strong>Cover-brief:</strong> {coverBrief}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function RoleRoomAgentTab() {
  const [recs, setRecs] = useState<ProfileRecommendations | null>(null);
  const [recommendationId, setRecommendationId] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [costNok, setCostNok] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState<PublishLogEntry[]>([]);
  const [publishBusy, setPublishBusy] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [ctaApplyBusy, setCtaApplyBusy] = useState(false);
  const [showIgInbox, setShowIgInbox] = useState(false);

  const loadLatest = useCallback(async () => {
    try {
      const r = await fetch('/api/role-room/agent/profile-recommendations/latest?brandKey=theroleroom', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (d.ok && d.recommendations) {
          setRecs(d.recommendations);
          setRecommendationId(d.recommendationId);
          setCostNok(d.costNok);
          setGeneratedAt(d.generatedAt);
          setCached(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const loadLog = useCallback(async () => {
    try {
      const r = await fetch('/api/role-room/agent/profile-publish-log?brandKey=theroleroom&limit=20', { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        if (d.ok) setPublishLog(Array.isArray(d.entries) ? d.entries : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadLatest(); void loadLog(); }, [loadLatest, loadLog]);

  const generate = useCallback(async (useCache: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/role-room/agent/profile-recommendations', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: 'theroleroom', useCache }),
      });
      if (!r.ok) throw new Error(`Status ${r.status}: ${await r.text()}`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Generation failed');
      setRecs(d.recommendations);
      setRecommendationId(d.recommendationId);
      setCostNok(d.costNok);
      setCached(d.cached);
      setGeneratedAt(d.generatedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const applyRecommendedCta = useCallback(async () => {
    if (!recs?.platforms?.facebook) return;
    const { ctaType, ctaLink } = recs.platforms.facebook;
    if (!ctaType || !ctaLink) return;
    setCtaApplyBusy(true);
    setPublishNotice(null);
    try {
      const r = await fetch('/api/role-room/marketing-cockpit/actions/set-cta', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctaType, ctaUrl: ctaLink }),
      });
      const d = await r.json();
      if (d.ok) {
        setPublishNotice({
          kind: 'success',
          msg: `CTA satt på Page: ${ctaType} → ${ctaLink}. ${d.note || ''}`,
        });
      } else {
        setPublishNotice({ kind: 'error', msg: d.error || 'Set CTA failed' });
      }
    } catch (err) {
      setPublishNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setCtaApplyBusy(false);
    }
  }, [recs]);

  const publish = useCallback(async (platform: string, field: string, value: string) => {
    if (!recommendationId) return;
    setPublishBusy(`${platform}:${field}`);
    setPublishNotice(null);
    try {
      const r = await fetch('/api/role-room/agent/profile-recommendations/publish', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId, brandKey: 'theroleroom', platform, field, value }),
      });
      const d = await r.json();
      if (d.ok && d.status === 'success') {
        setPublishNotice({ kind: 'success', msg: `Pushet ${platform}.${field} til Meta API ✓` });
      } else if (d.status === 'manual_copy') {
        setPublishNotice({ kind: 'success', msg: `${platform}.${field} ikke API-pushbar. Kopiert til log; copy-paste manuelt.` });
      } else {
        setPublishNotice({ kind: 'error', msg: d.errorMessage || d.error || 'Publish failed' });
      }
      void loadLog();
    } catch (err) {
      setPublishNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setPublishBusy(null);
    }
  }, [recommendationId, loadLog]);

  return (
    <Stack spacing={2} data-testid="role-room-agent-root">
      {/* Velkomst-guide (7-stegs onboarding) — scoped til Role Room Agent.
          Var tidligere mountet globalt i App.tsx og lekket inn på alle
          CreatorHub-sider (bl.a. UniversalDashboard). */}
      <WelcomeWizard />
      <IgDmInbox open={showIgInbox} onClose={() => setShowIgInbox(false)} brandColor="#a855f7" />
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h6" sx={{ color: '#e2e8f0' }}>🤖 Role Room Agent — Bio + Profil-pakke</Typography>
        <Button
          size="small" variant="contained" startIcon={<AutoAwesomeIcon />}
          onClick={() => void generate(false)}
          disabled={loading}
          data-testid="agent-generate"
          sx={{ background: 'rgba(168,85,247,0.25)', color: '#c4b5fd', '&:hover': { background: 'rgba(168,85,247,0.4)' } }}
        >
          {loading ? 'Genererer…' : 'Generer ny pakke'}
        </Button>
        <Button
          size="small" startIcon={<RefreshIcon />}
          onClick={() => void generate(true)}
          disabled={loading}
          data-testid="agent-load-cached"
          sx={{ color: '#7dd3fc' }}
        >
          Last cache
        </Button>
        <Button
          size="small" variant="outlined" startIcon={<InstagramIcon />}
          onClick={() => setShowIgInbox(true)}
          data-testid="agent-ig-inbox"
          sx={{ borderColor: 'rgba(168,85,247,0.4)', color: '#c4b5fd' }}
        >
          Instagram-innboks
        </Button>
        {generatedAt && (
          <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)', ml: 'auto' }}>
            {cached ? 'Cached' : 'Fresh'} {new Date(generatedAt).toLocaleString('nb-NO')}
            {costNok != null ? ` · ${costNok.toFixed(2)} NOK` : ''}
          </Typography>
        )}
      </Stack>

      {error && <Alert severity="error" data-testid="agent-error">{error}</Alert>}
      {publishNotice && (
        <Alert
          severity={publishNotice.kind} data-testid="agent-publish-notice"
          onClose={() => setPublishNotice(null)}
        >
          {publishNotice.msg}
        </Alert>
      )}

      {!recs && !loading && (
        <Alert severity="info" data-testid="agent-empty-state">
          Ingen profil-pakke generert ennå. Klikk "Generer ny pakke" — koster ca. 0.40 NOK med Claude Sonnet 4.5.
        </Alert>
      )}

      {recs && (
        <>
          {/* BRAND OVERVIEW */}
          <Card sx={PANEL_SX} data-testid="panel-brand">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Brand identity</Typography>
                <Box sx={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: recs.brand.primaryColorHex || '#0ea5e9',
                  border: '2px solid rgba(255,255,255,0.2)',
                }} data-testid="brand-color" />
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                  {recs.brand.primaryColorHex}
                </Typography>
              </Stack>
              <Stack spacing={0.8}>
                <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
                  <strong>Username:</strong> @{recs.brand.recommendedUsername}
                  <CopyButton value={recs.brand.recommendedUsername} testid="brand-username-copy" />
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.7)', fontStyle: 'italic' }}>
                  {recs.brand.usernameReasoning}
                </Typography>
                <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)', my: 0.5 }} />
                <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
                  <strong>Voice:</strong> {recs.brand.voiceSummary}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.7)' }}>
                  <strong>Profile picture:</strong> {recs.brand.profilePictureBrief}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {/* PLATFORMS — 2 cols on md+ */}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <PlatformPanel
              icon={<FacebookIcon sx={{ color: '#60a5fa', fontSize: 20 }} />}
              name="Facebook Page" platform="facebook"
              bio={recs.platforms.facebook.bio}
              charCount={recs.platforms.facebook.charCount}
              hashtags={recs.platforms.facebook.recommendedHashtags}
              coverBrief={recs.platforms.facebook.coverBrief}
              recommendationId={recommendationId}
              onPublish={publish}
              busy={publishBusy}
              extra={
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>CTA</Typography>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip label={recs.platforms.facebook.ctaType} size="small"
                      sx={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 600 }} />
                    <Typography variant="caption" sx={{ color: '#cbd5e1', flex: 1 }}>→ {recs.platforms.facebook.ctaLink}</Typography>
                    <Tooltip title="Sett CTA på The Role Room Page via Meta API">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={ctaApplyBusy ? <CircularProgress size={12} /> : <CampaignIcon sx={{ fontSize: 14 }} />}
                        onClick={() => void applyRecommendedCta()}
                        disabled={ctaApplyBusy}
                        data-testid="apply-recommended-cta"
                        sx={{
                          background: 'rgba(251,191,36,0.25)', color: '#fde68a',
                          textTransform: 'none', fontSize: '0.72rem',
                          '&:hover': { background: 'rgba(251,191,36,0.4)' },
                        }}
                      >
                        {ctaApplyBusy ? 'Setter…' : 'Apply til Page'}
                      </Button>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)', display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                    {recs.platforms.facebook.ctaReasoning}
                  </Typography>
                </Box>
              }
            />

            <PlatformPanel
              icon={<InstagramIcon sx={{ color: '#ec4899', fontSize: 20 }} />}
              name="Instagram Bio" platform="instagram"
              bio={recs.platforms.instagram.bio}
              charCount={recs.platforms.instagram.charCount}
              hashtags={recs.platforms.instagram.recommendedHashtags}
              coverBrief={recs.platforms.instagram.coverBrief}
              recommendationId={recommendationId}
              onPublish={publish}
              busy={publishBusy}
              extra={
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>Link-in-bio</Typography>
                  <Stack spacing={0.3} sx={{ mt: 0.3 }}>
                    {(Array.isArray(recs.platforms.instagram.linkInBio) ? recs.platforms.instagram.linkInBio : []).map((l) => (
                      <Typography key={l.url} variant="caption" sx={{ color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <strong style={{ color: '#cbd5e1' }}>{l.label}</strong> → {l.url}
                        <CopyButton value={l.url} />
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              }
            />

            <PlatformPanel
              icon={<LinkedInIcon sx={{ color: '#0a66c2', fontSize: 20 }} />}
              name="LinkedIn Company" platform="linkedin"
              bio={recs.platforms.linkedin.bio}
              charCount={recs.platforms.linkedin.charCount}
              hashtags={recs.platforms.linkedin.recommendedHashtags}
              coverBrief={recs.platforms.linkedin.coverBrief}
              recommendationId={recommendationId}
              onPublish={publish}
              busy={publishBusy}
              extra={
                recs.platforms.linkedin.tagline && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>Tagline</Typography>
                    <Typography variant="body2" sx={{ color: '#e2e8f0', fontStyle: 'italic', mt: 0.3 }}>
                      {recs.platforms.linkedin.tagline}
                      <CopyButton value={recs.platforms.linkedin.tagline} />
                    </Typography>
                  </Box>
                )
              }
            />

            <PlatformPanel
              icon={<MusicNoteIcon sx={{ color: '#f97316', fontSize: 20 }} />}
              name="TikTok Bio" platform="tiktok"
              bio={recs.platforms.tiktok.bio}
              charCount={recs.platforms.tiktok.charCount}
              hashtags={recs.platforms.tiktok.recommendedHashtags}
              coverBrief={recs.platforms.tiktok.coverBrief}
              recommendationId={recommendationId}
              onPublish={publish}
              busy={publishBusy}
            />
          </Box>

          {/* REASONING */}
          <Card sx={PANEL_SX} data-testid="panel-reasoning">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Strategi-resonnement</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.85)', lineHeight: 1.6 }}>
                {recs.reasoning}
              </Typography>
            </CardContent>
          </Card>

          {/* PUBLISH LOG */}
          {publishLog.length > 0 && (
            <Card sx={PANEL_SX} data-testid="panel-publish-log">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Publish-historikk</Typography>
                <Stack spacing={0.5}>
                  {publishLog.slice(0, 10).map((e) => (
                    <Stack key={e.id} direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.82rem' }}>
                      {e.status === 'success' && <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />}
                      {e.status === 'failed' && <ErrorOutlineIcon sx={{ fontSize: 14, color: '#ef4444' }} />}
                      {e.status === 'manual_copy' && <ContentCopyIcon sx={{ fontSize: 14, color: '#94a3b8' }} />}
                      <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>
                        {new Date(e.publishedAt).toLocaleString('nb-NO')}
                      </Typography>
                      <Chip label={e.platform} size="small" sx={{ height: 16, fontSize: '0.65rem', background: 'rgba(148,163,184,0.15)', color: '#cbd5e1' }} />
                      <Typography variant="caption" sx={{ color: '#cbd5e1' }}>{e.field}</Typography>
                      {e.errorMessage && (
                        <Typography variant="caption" sx={{ color: '#fca5a5', fontStyle: 'italic' }}>
                          {e.errorMessage.slice(0, 80)}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Ads & conversion-tracking (B0-B6 multi-tenant) — for klient-oppsett */}
      <Divider sx={{ borderColor: 'rgba(168,85,247,0.18)', my: 1.4 }} />
      <AgentAdsPanel
        clientProjectId={undefined}
        defaultClientName=""
      />
    </Stack>
  );
}
